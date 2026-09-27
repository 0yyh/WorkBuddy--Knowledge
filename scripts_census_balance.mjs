// C2/C3 内容域均衡普查：统计各 L1/L2 词条与章节分布，识别覆盖缺口。
// 仅读 content/entries 与 content/taxonomy.yaml，零外部依赖。
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const ENTRIES = resolve(ROOT, 'content/entries');
const TAX = resolve(ROOT, 'content/taxonomy.yaml');

function parseFrontmatterCategories(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return [];
  const fm = m[1];
  const lines = fm.split('\n');
  const cats = [];
  let inCat = false;
  for (const line of lines) {
    if (/^categories:\s*$/.test(line)) { inCat = true; continue; }
    if (inCat) {
      const mm = line.match(/^\s*-\s+(.+)$/);
      if (mm) { cats.push(mm[1].trim()); continue; }
      if (/^\S/.test(line)) break; // 下一个顶层字段，结束
    }
  }
  return cats;
}

// 解析 taxonomy.yaml 的 L1/L2 标题（仅取顶层与直接子层，足以定位缺口）
function parseTaxonomy() {
  const txt = readFileSync(TAX, 'utf8');
  const lines = txt.split('\n');
  const l1 = [];
  let curL1 = null;
  for (const line of lines) {
    // L1: `- id: xxx` 紧跟 `  title: 历史` 模式在嵌套两行后；这里用 title 在 order 前判断层级
    const l1m = line.match(/^- id:\s*(\S+)\s*$/);
    const l2m = line.match(/^    - id:\s*(\S+)\s*$/); // 4 空格 = L2
    const l3m = line.match(/^      - id:\s*(\S+)\s*$/); // 6 空格 = L3
    const titleM = line.match(/^\s*title:\s*(.+)$/);
    if (l1m) { curL1 = { id: l1m[1], title: null, l2: [] }; l1.push(curL1); continue; }
    if (titleM && curL1 && curL1.title === null) { curL1.title = titleM[1].trim(); continue; }
    if (l2m) { curL1.l2.push({ id: l2m[1], title: null }); continue; }
    if (titleM && curL1 && curL1.l2.length && curL1.l2[curL1.l2.length - 1].title === null) {
      curL1.l2[curL1.l2.length - 1].title = titleM[1].trim();
    }
  }
  return l1;
}

const tax = parseTaxonomy();
const l1TitleToId = {};
for (const t of tax) if (t.title) l1TitleToId[t.title] = t.id;

// 遍历 entries
const slugs = readdirSync(ENTRIES).filter(s => existsSync(resolve(ENTRIES, s, 'entry.md')));
const l1Entries = {}; // id -> Set(slug)
const l1Chapters = {}; // id -> count
const l2Entries = {}; // "l1Id/l2Title" -> Set(slug)
let uncategorized = 0;

for (const slug of slugs) {
  const p = resolve(ENTRIES, slug, 'entry.md');
  const txt = readFileSync(p, 'utf8');
  const cats = parseFrontmatterCategories(txt);
  // 章节数
  const chDir = resolve(ENTRIES, slug, 'chapters');
  let chCount = 0;
  if (existsSync(chDir)) chCount = readdirSync(chDir).filter(f => /^ch-\d+\.md$/.test(f)).length;

  if (cats.length === 0) { uncategorized++; }
  for (const c of cats) {
    const seg = c.split('/');
    const l1Title = seg[0];
    const l1Id = l1TitleToId[l1Title];
    if (!l1Id) { continue; }
    (l1Entries[l1Id] ||= new Set()).add(slug);
    l1Chapters[l1Id] = (l1Chapters[l1Id] || 0) + chCount;
    if (seg.length >= 2) (l2Entries[`${l1Id}|${seg[1]}`] ||= new Set()).add(slug);
  }
}

// 输出
console.log(`# 词条总数: ${slugs.length}  未分类: ${uncategorized}`);
console.log('\n## L1 分布（词条数 / 章节数 / 均章/词条）');
const order = ['history','philosophy','science','economics','politics','technology','literature','art'];
const idToTitle = {};
for (const t of tax) if (t.id) idToTitle[t.id] = t.title;
const rows = [];
for (const id of order) {
  const e = l1Entries[id] ? l1Entries[id].size : 0;
  const ch = l1Chapters[id] || 0;
  rows.push({ id, title: idToTitle[id] || id, e, ch, avg: e ? (ch/e).toFixed(1) : '0' });
}
for (const r of rows) console.log(`${r.title.padEnd(8)} | entries=${String(r.e).padStart(4)} | chapters=${String(r.ch).padStart(5)} | avg=${r.avg}`);
const totalE = rows.reduce((a,r)=>a+r.e,0);
console.log(`L1 去重合计(词条-类目映射): ${totalE}  (注: 一词条可跨多 L1, 故 > 总词条)`);

// L2 缺口（每 L1 下哪些 L2 无词条）
console.log('\n## L2 覆盖缺口（literature/art/science/technology 重点）');
for (const id of ['science','technology','literature','art','economics','politics','history','philosophy']) {
  const t = tax.find(x=>x.id===id);
  if (!t) continue;
  const empty = [];
  for (const l2 of t.l2) {
    const key = `${id}|${l2.title}`;
    const n = l2Entries[key] ? l2Entries[key].size : 0;
    if (n === 0) empty.push(l2.title);
  }
  console.log(`${t.title}: L2 共 ${t.l2.length}, 空=${empty.length} -> [${empty.join(', ')}]`);
}
