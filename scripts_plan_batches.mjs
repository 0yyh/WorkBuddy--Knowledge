// 依据薄章普查结果，按词条 L1 分类分簇，将受影响词条切成若干批次（每批 ≤ BATCH 个词条），
// 每批交由一个作者 worker 扩写其薄章。输出 .thin_batches.json。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/WorkBuddy--Knowledge/content/entries';
const census = JSON.parse(fs.readFileSync('D:/WorkBuddy--Knowledge/.thin_census.json', 'utf8'));

// 读取词条 L1 分类
function l1Of(slug) {
  const fp = path.join(ROOT, slug, 'entry.md');
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const fm = raw.split('---')[1] || '';
    const m = fm.match(/categories:\s*\n((?:\s*-\s*.+\n)+)/);
    if (m) {
      const first = m[1].match(/-\s*(.+)/);
      if (first) return first[1].trim().split('/')[0];
    }
  } catch {}
  return '未分类';
}

// 每个受影响的词条：薄章列表 + 最少字数 + L1
const slugMap = new Map();
for (const t of census.thinChapters) {
  if (!slugMap.has(t.slug)) slugMap.set(t.slug, { thinChapters: [], min: Infinity });
  slugMap.get(t.slug).thinChapters.push(t);
  slugMap.get(t.slug).min = Math.min(slugMap.get(t.slug).min, t.cjk);
}
const entries = [];
for (const [slug, v] of slugMap) {
  entries.push({ slug, l1: l1Of(slug), min: v.min, thinChapters: v.thinChapters.sort((a, b) => a.cjk - b.cjk) });
}
// 按严重度（min 升序）排序，再按 L1 聚合
entries.sort((a, b) => a.min - b.min);

const BATCH = 8;
const groups = new Map();
for (const e of entries) {
  if (!groups.has(e.l1)) groups.set(e.l1, []);
  groups.get(e.l1).push(e);
}

const batches = [];
for (const [l1, list] of groups) {
  for (let i = 0; i < list.length; i += BATCH) {
    batches.push({ l1, entries: list.slice(i, i + BATCH) });
  }
}
// 给批次编号
batches.forEach((b, i) => { b.id = i + 1; });

fs.writeFileSync('D:/WorkBuddy--Knowledge/.thin_batches.json', JSON.stringify(batches, null, 2), 'utf8');

// 打印摘要
console.log('受影响词条:', entries.length, ' 薄章:', census.thinCount);
console.log('批次数:', batches.length);
const byL1 = {};
for (const b of batches) byL1[b.l1] = (byL1[b.l1] || 0) + 1;
console.log('按 L1 批次分布:', JSON.stringify(byL1, null, 0));
let tot = 0; for (const b of batches) tot += b.entries.length;
console.log('批次词条合计:', tot);
console.log('\n各批次：');
for (const b of batches) {
  console.log(`#${String(b.id).padStart(2)} [${b.l1}] ${b.entries.map(e => e.slug).join(', ')}`);
}
