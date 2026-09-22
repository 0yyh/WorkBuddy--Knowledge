import fs from 'fs';
const base = 'D:/WorkBuddy--Knowledge/content/entries';
const slugs = fs.readdirSync(base).filter(s => fs.existsSync(base + '/' + s + '/entry.md'));

// 解析 entry.md 的 categories（取 --- 块内 categories 列表行）
function getCategories(p) {
  const t = fs.readFileSync(p, 'utf8');
  const fm = t.split('---')[1] || '';
  const lines = fm.split('\n');
  const cats = [];
  let inCats = false;
  for (const line of lines) {
    if (/^categories:/.test(line.trim())) { inCats = true; continue; }
    if (inCats) {
      if (/^\s*-\s+/.test(line)) {
        const v = line.replace(/^\s*-\s+/, '').trim();
        if (v) cats.push(v);
      } else if (line.trim() === '' || /^\S/.test(line)) {
        if (!/^\s/.test(line)) break; // 下一个顶层字段
      }
    }
  }
  return cats;
}

const catCount = {}; // "L1 > L2 > L3" -> Set(slug)
const l1Count = {};
for (const s of slugs) {
  const cats = getCategories(base + '/' + s + '/entry.md');
  for (const c of cats) {
    const parts = c.split('/');
    const l1 = parts[0];
    l1Count[l1] = (l1Count[l1] || 0) + 1;
    catCount[c] = catCount[c] || new Set();
    catCount[c].add(s);
  }
}

console.log('=== 总词条数（含交叉，按 slug 去重） ===');
console.log('distinct slugs on disk:', slugs.length);
console.log('\n=== 各 L1 大类条目数（含交叉重复计数） ===');
for (const [k, v] of Object.entries(l1Count).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);

console.log('\n=== 各 L2/L3 子类条目数（薄弱 <4 标★） ===');
const rows = Object.entries(catCount).map(([k, set]) => [k, set.size]).sort((a, b) => a[0].localeCompare(b[0]));
for (const [k, n] of rows) {
  const flag = n < 4 ? '  ★薄弱' : '';
  console.log(`  ${k}: ${n}${flag}`);
}
