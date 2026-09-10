/** rename —— slug 改名级联（目录 / entry.slug / 章节 work / 跨词条 see_also 与 wiki 链接 / tracks，02 §9.2） */
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, renameSync, readdirSync, statSync } from 'node:fs';

function replaceRefs(text: string, oldSlug: string, newSlug: string): string {
  return text
    .replace(new RegExp(`(entry://)${oldSlug}\\b`, 'g'), `$1${newSlug}`)
    .replace(new RegExp(`(\\[\\[)${oldSlug}(\\|)`, 'g'), `$1${newSlug}$2`)
    .replace(new RegExp(`(\\[\\[)${oldSlug}(\\]\\])`, 'g'), `$1${newSlug}$2`)
    .replace(new RegExp(`(entry:\\s*)${oldSlug}\\b`, 'g'), `$1${newSlug}`);
}

/** 需要级联更新的 YAML 列表型引用键（裸 slug，见 content/README.md） */
const LIST_KEYS = 'see_also|requires';

function stripQuotes(s: string): string {
  return s.trim().replace(/^['"]|['"]$/g, '');
}

/** 保留原引号风格：原项带引号则沿用同一引号 */
function requote(orig: string, value: string): string {
  const t = orig.trim();
  const q = t[0] === '"' || t[0] === "'" ? t[0] : '';
  return q ? `${q}${value}${q}` : value;
}

/**
 * 更新 YAML 列表型引用里的裸 slug：兼容行内式 `see_also: [a, b]` 与
 * 块式 `see_also:\n  - a`。只精确匹配整个列表项，避免误伤子串。
 */
function replaceListRefs(text: string, oldSlug: string, newSlug: string): string {
  const lines = text.split('\n');
  const inlineRe = new RegExp(`^(\\s*(?:${LIST_KEYS}):\\s*\\[)(.*?)(\\]\\s*)$`);
  const blockHeadRe = new RegExp(`^(\\s*)(?:${LIST_KEYS}):\\s*$`);
  let blockIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const inline = inlineRe.exec(line);
    if (inline) {
      const items = inline[2].split(',').map((s) => s.trim()).filter((s) => s.length > 0);
      const patched = items.map((s) => (stripQuotes(s) === oldSlug ? requote(s, newSlug) : s));
      lines[i] = `${inline[1]}${patched.join(', ')}${inline[3]}`;
      blockIndent = -1;
      continue;
    }

    const head = blockHeadRe.exec(line);
    if (head) {
      blockIndent = head[1].length;
      continue;
    }

    if (blockIndent >= 0) {
      const item = /^(\s*)-\s+(.+?)\s*$/.exec(line);
      if (item && item[1].length > blockIndent) {
        if (stripQuotes(item[2]) === oldSlug) lines[i] = `${item[1]}- ${requote(item[2], newSlug)}`;
      } else if (line.trim() !== '') {
        blockIndent = -1; // 离开列表块
      }
    }
  }
  return lines.join('\n');
}

/** 应用全部级联替换：显式引用（entry:// / [[..]] / entry:）+ 列表型引用 */
function cascade(text: string, oldSlug: string, newSlug: string): string {
  return replaceListRefs(replaceRefs(text, oldSlug, newSlug), oldSlug, newSlug);
}

export function renameCmd(contentDir: string, oldSlug: string, newSlug: string): void {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(newSlug)) {
    console.error(`✗ 新 slug "${newSlug}" 不合法（应为 /^[a-z0-9]+(-[a-z0-9]+)*$/）`);
    process.exit(1);
  }
  if (oldSlug === newSlug) {
    console.error('✗ 新旧 slug 相同，无需改名');
    process.exit(1);
  }

  const entriesDir = join(contentDir, 'entries');
  const oldDir = join(entriesDir, oldSlug);
  const newDir = join(entriesDir, newSlug);
  if (!existsSync(oldDir)) {
    console.error(`✗ 源词条不存在：${oldSlug}`);
    process.exit(1);
  }
  if (existsSync(newDir)) {
    console.error(`✗ 目标已存在：${newSlug}`);
    process.exit(1);
  }

  renameSync(oldDir, newDir);

  const entryFile = join(newDir, 'entry.md');
  writeFileSync(entryFile, readFileSync(entryFile, 'utf8').replace(/^slug:\s*\S+/m, `slug: ${newSlug}`));

  const chaptersDir = join(newDir, 'chapters');
  if (existsSync(chaptersDir)) {
    for (const ch of readdirSync(chaptersDir)) {
      const p = join(chaptersDir, ch);
      writeFileSync(p, readFileSync(p, 'utf8').replace(/^work:\s*\S+/m, `work: ${newSlug}`));
    }
  }

  let changed = 0;
  for (const dir of readdirSync(entriesDir)) {
    const d = join(entriesDir, dir);
    if (!statSync(d).isDirectory()) continue;
    const ef = join(d, 'entry.md');
    if (!existsSync(ef)) continue;
    const t = readFileSync(ef, 'utf8');
    const nt = cascade(t, oldSlug, newSlug);
    if (nt !== t) { writeFileSync(ef, nt); changed++; }
  }

  const tracksDir = join(contentDir, 'tracks');
  if (existsSync(tracksDir)) {
    for (const f of readdirSync(tracksDir)) {
      const p = join(tracksDir, f);
      const t = readFileSync(p, 'utf8');
      const nt = cascade(t, oldSlug, newSlug);
      if (nt !== t) { writeFileSync(p, nt); changed++; }
    }
  }

  console.log(`🔁 rename ${oldSlug} → ${newSlug}（级联更新 ${changed} 处引用）`);
}
