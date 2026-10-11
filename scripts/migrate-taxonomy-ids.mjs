#!/usr/bin/env node
/**
 * migrate-taxonomy-ids.mjs — 类目引用键解耦迁移
 * ---------------------------------------------------------------------------
 * 把词条 entry.md 的 `categories` 从「标题路径」改写为「id 路径」（或反向回滚）。
 *
 *   - 默认 dry-run：只打印将改哪些文件、多少条 categories、有无断链，不写盘。
 *   - --apply：真正改写（仅替换 categories 列表项的值，frontmatter 其余不动）。
 *   - --direction toId（默认）：标题路径 → id 路径。
 *   - --direction title：id 路径 → 标题路径（回滚）。
 *   - --content <dir>：内容根，默认 content。
 *   - --taxonomy <file>：taxonomy 文件，默认 <content>/taxonomy.yaml。
 *
 * 特性：纯 Node 标准库（无第三方依赖）；幂等（已是目标形态不重复改写）；
 *       仅处理 block 风格 `categories:`（全站现状风格）；断链（未知引用）只报告不中断。
 * ---------------------------------------------------------------------------
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ---------- 参数解析 ----------
const args = process.argv.slice(2);
const has = (n) => args.includes(n);
const val = (n, d) => {
  const i = args.indexOf(n);
  if (i === -1) return d;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const APPLY = has('--apply');
const DIRECTION = val('--direction', 'toId'); // 'toId' | 'title'
const CONTENT = resolve(val('--content', 'content'));
const TAXONOMY = resolve(val('--taxonomy', join(CONTENT, 'taxonomy.yaml')));

if (DIRECTION !== 'toId' && DIRECTION !== 'title') {
  console.error(`✗ --direction 取值非法：${DIRECTION}（应为 toId|title）`);
  process.exit(1);
}

// ---------- 1. 行式解析 taxonomy.yaml（无 yaml 库） ----------
function parseTaxonomy(text) {
  const roots = [];
  const stack = []; // { indent, node }
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.trim() === '') continue;
    if (line.trimStart().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    const t = line.trim();
    if (t.startsWith('- id:')) {
      const id = t.slice('- id:'.length).trim();
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      const parent = stack.length ? stack[stack.length - 1].node : null;
      const node = { id, title: '', order: 0, children: [], level: parent ? parent.level + 1 : 1 };
      if (parent) parent.children.push(node);
      else roots.push(node);
      stack.push({ indent, node });
    } else if (t.startsWith('title:')) {
      const title = t.slice('title:'.length).trim();
      if (stack.length) stack[stack.length - 1].node.title = title;
    }
    // order:/children: 等其它字段忽略
  }
  const assign = (n, pT, pI) => {
    n.titlePath = pT ? `${pT}/${n.title}` : n.title;
    n.idPath = pI ? `${pI}/${n.id}` : n.id;
    for (const c of n.children || []) assign(c, n.titlePath, n.idPath);
  };
  for (const r of roots) assign(r, '', '');
  return roots;
}

// ---------- 2. 建映射 ----------
let taxText;
try {
  taxText = readFileSync(TAXONOMY, 'utf8').replace(/\r\n/g, '\n'); // 兼容 CRLF
} catch (e) {
  console.error(`✗ 无法读取 taxonomy：${TAXONOMY}（${e.message}）`);
  process.exit(1);
}
const roots = parseTaxonomy(taxText);
const titleToId = new Map();
const idToTitle = new Map();
(function walk(ns) {
  for (const n of ns) {
    titleToId.set(n.titlePath, n.idPath);
    idToTitle.set(n.idPath, n.titlePath);
    if (n.children) walk(n.children);
  }
})(roots);

// 来源映射：toId 用 titleToId；title 用 idToTitle
const sourceMap = DIRECTION === 'title' ? idToTitle : titleToId;
// 目标形态集合（已正确则跳过）：toId 目标是 id 路径；title 目标是标题路径
const targetValid = DIRECTION === 'title' ? titleToId : idToTitle;

// ---------- 3. 收集所有 entry.md ----------
const entryFiles = [];
(function collect(base) {
  let ents;
  try {
    ents = readdirSync(base);
  } catch {
    return;
  }
  for (const name of ents) {
    const full = join(base, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) collect(full);
    else if (name === 'entry.md') entryFiles.push(full);
  }
})(CONTENT);

// ---------- 4. 逐文件处理 ----------
let totalFiles = 0;
let filesChanged = 0;
let catsChanged = 0;
let brokenCount = 0;
let skippedNoFm = 0; // 无有效 frontmatter（--- ... ---）
let skippedNoCat = 0; // 有 frontmatter 但无 block 风格 categories:
const changes = []; // { rel, changed:[{old,new}], broken:[val] }

for (const file of entryFiles) {
  totalFiles++;
  let text;
  try {
    text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n'); // 兼容 CRLF（关键：否则 .* 匹配不到行尾 \r）
  } catch {
    continue;
  }
  const lines = text.split('\n');

  // frontmatter：首个 '---' 到下一个 '---'
  let fmStart = -1;
  let fmEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      fmStart = i;
      break;
    }
  }
  if (fmStart === -1) { skippedNoFm++; continue; }
  for (let i = fmStart + 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      fmEnd = i;
      break;
    }
  }
  if (fmEnd === -1) { skippedNoFm++; continue; }

  // 找 categories:（block 风格：冒号后为空）
  let catIdx = -1;
  for (let i = fmStart + 1; i < fmEnd; i++) {
    if (/^categories:\s*$/.test(lines[i])) {
      catIdx = i;
      break;
    }
  }
  if (catIdx === -1) { skippedNoCat++; continue; }

  // 收集 categories 列表项（缩进 '- ' 开头；遇空行/新键/缩进变化停止）
  const itemIdx = [];
  for (let i = catIdx + 1; i < fmEnd; i++) {
    const ln = lines[i];
    if (/^\s*-\s+/.test(ln)) itemIdx.push(i);
    else if (ln.trim() === '') break;
    else break;
  }

  const changedList = [];
  const brokenList = [];
  let fileChanged = false;

  for (const i of itemIdx) {
    const ln = lines[i];
    const m = ln.match(/^(\s*-\s*)(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v === '') continue;
    if (targetValid.has(v)) continue; // 已是目标形态
    if (sourceMap.has(v)) {
      const newVal = sourceMap.get(v);
      changedList.push({ old: v, new: newVal });
      if (APPLY) lines[i] = `${m[1]}${newVal}`;
      fileChanged = true;
    } else {
      brokenList.push(v); // 既不是标题路径也不是 id 路径 → 断链
    }
  }

  if (fileChanged) {
    filesChanged++;
    catsChanged += changedList.length;
  }
  if (brokenList.length) brokenCount += brokenList.length;
  if (fileChanged || brokenList.length) {
    changes.push({
      rel: file.replace(CONTENT, '<content>').split('\\').join('/'),
      changed: changedList,
      broken: brokenList,
    });
  }
  if (APPLY && fileChanged) {
    writeFileSync(file, lines.join('\n'), 'utf8');
  }
}

// ---------- 5. 报告 ----------
const mode = DIRECTION === 'title' ? '回滚(id→标题)' : '标题→id';
console.log(`# 类目 id 解耦迁移 · ${mode} · ${APPLY ? 'APPLY(已写盘)' : 'DRY-RUN(只报告)'}`);
console.log(`taxonomy: ${TAXONOMY}`);
console.log(`扫描词条目录文件: ${totalFiles}`);
console.log(`将改文件: ${filesChanged}（涉及 ${catsChanged} 条 categories 值）`);
console.log(`无需改动(无 categories 块): ${skippedNoCat} ｜ 无有效 frontmatter: ${skippedNoFm}`);
console.log(`断链(未知引用): ${brokenCount} 处`);
if (brokenCount > 0) {
  console.log('\n⚠ 断链清单（须先修复 taxonomy 或词条再 --apply）：');
  for (const c of changes) for (const b of c.broken) console.log(`   ${c.rel}  →  ${b}`);
}
// 仅展示前 15 个文件的转换样例，避免刷屏；完整清单可重跑或接 CI 日志
const SAMPLE = 15;
if (changes.length) {
  console.log(`\n样例转换（前 ${Math.min(SAMPLE, changes.length)} 个文件）：`);
  for (const c of changes.slice(0, SAMPLE)) {
    console.log(`\n📄 ${c.rel}`);
    for (const x of c.changed) console.log(`   ✎ ${x.old}  →  ${x.new}`);
    for (const b of c.broken) console.log(`   ⚠ 断链: ${b}`);
  }
  if (changes.length > SAMPLE) {
    console.log(`\n… 其余 ${changes.length - SAMPLE} 个文件省略（运行脚本可见完整输出）。`);
  }
}
console.log(`\n${APPLY ? '✅ 已写盘' : 'ℹ 这是 dry-run，未改动任何文件。加 --apply 才真正改写。'}`);
