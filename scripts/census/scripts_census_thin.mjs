// 全站薄章普查：按章中文字数扫描，找出深度不足的章节。
// 标准（与 lint L013 / PHILO_SPEC 统一）：每章正文（不含 frontmatter / 末行标记）纯汉字应 ≥ 1500。
// 1450–1499 为软告警临界带（warn，不阻断）；<1500 计为薄章。
// 输出：按 slug 分组的薄章清单 + 汇总统计。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/WorkBuddy--Knowledge/content/entries';

function cjkCount(s) {
  // 纯汉字统计（CJK 统一表意 + 扩展 A + 兼容表意），不含中文标点/全角符号
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if ((c >= 0x4e00 && c <= 0x9fff) || (c >= 0x3400 && c <= 0x4dbf) || (c >= 0xf900 && c <= 0xfaff)) n++;
  }
  return n;
}

function bodyOf(raw) {
  // 去掉 frontmatter（首两个 --- 之间）
  const fmEnd = raw.indexOf('\n---', 3);
  let body = fmEnd >= 0 ? raw.slice(fmEnd + 4) : raw;
  // 去掉末行标记与相邻空行
  body = body.replace(/<!--\s*PKS_EXPANDED_V5\s*-->\s*$/u, '');
  return body;
}

const entries = fs.readdirSync(ROOT).filter(d => {
  const p = path.join(ROOT, d);
  return fs.statSync(p).isDirectory() && d !== '_drafts';
});

const THIN = 1500; // 硬下限：正文纯汉字 <1500 计为薄章（与 lint L013 一致）
const THIN_WARN = 1450; // 软告警临界带：1450–1499 为 warn（与 lint L013 一致）
const records = []; // {slug, ch, file, cjk, bodyLen}
for (const slug of entries) {
  const chDir = path.join(ROOT, slug, 'chapters');
  if (!fs.existsSync(chDir)) continue;
  const files = fs.readdirSync(chDir).filter(f => /^ch-\d+\.md$/.test(f)).sort();
  for (const f of files) {
    const fp = path.join(chDir, f);
    const raw = fs.readFileSync(fp, 'utf8');
    const body = bodyOf(raw);
    const cjk = cjkCount(body);
    records.push({ slug, ch: f, cjk, bodyLen: body.length });
  }
}

// 薄章（<1500）与软告警临界带（1450–1499）
const thin = records.filter(r => r.cjk < THIN).sort((a, b) => a.cjk - b.cjk);
const borderline = records.filter(r => r.cjk >= THIN_WARN && r.cjk < THIN);

// 按 slug 聚合
const bySlug = new Map();
for (const r of thin) {
  if (!bySlug.has(r.slug)) bySlug.set(r.slug, []);
  bySlug.get(r.slug).push(r);
}

console.log('=== 全站薄章普查 ===');
console.log('词条总数:', entries.length);
console.log('章节总数:', records.length);
console.log(`薄章(<${THIN} 中文字):`, thin.length, ` (占 ${(100 * thin.length / records.length).toFixed(1)}%)`);
console.log(`临界章(${THIN_WARN}-${THIN - 1} 软告警):`, borderline.length);
console.log('涉及词条数(薄章):', bySlug.size);
console.log('');

// 每个词条薄章数 / 该词条章节数
console.log('--- 词条级薄章分布（按薄章数降序）---');
const slugSummary = [];
for (const [slug, arr] of bySlug) {
  const totalCh = records.filter(r => r.slug === slug).length;
  slugSummary.push({ slug, thinCh: arr.length, totalCh, min: Math.min(...arr.map(r => r.cjk)) });
}
slugSummary.sort((a, b) => b.thinCh - a.thinCh || a.min - b.min);
for (const s of slugSummary) {
  console.log(`${s.slug.padEnd(28)} 薄 ${s.thinCh}/${s.totalCh}  最少 ${s.min}字`);
}

console.log('');
console.log('--- 最薄章节 TOP 40 ---');
for (const r of thin.slice(0, 40)) {
  console.log(`${r.slug.padEnd(26)} ${r.ch.padEnd(10)} ${r.cjk}字`);
}

// 导出 JSON 供后续批次规划
const out = {
  threshold: THIN,
  warnThreshold: THIN_WARN,
  totalEntries: entries.length,
  totalChapters: records.length,
  thinCount: thin.length,
  thinBySlug: slugSummary,
  thinChapters: thin.map(r => ({ slug: r.slug, ch: r.ch, cjk: r.cjk })),
};
fs.writeFileSync('D:/WorkBuddy--Knowledge/.thin_census.json', JSON.stringify(out, null, 2), 'utf8');
console.log('\n已写出 .thin_census.json');
