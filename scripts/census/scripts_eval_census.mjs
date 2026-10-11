import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = 'D:/WorkBuddy--Knowledge';
const entriesDir = path.join(root, 'content/entries');

function parseFrontmatter(s) {
  const m = s.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
}
function getField(fm, key) {
  const m = fm.match(new RegExp('^' + key + ':\\s*(.*)$', 'm'));
  return m ? m[1].trim() : null;
}
function getList(fm, key) {
  const lines = fm.split('\n');
  const out = [];
  let inList = false;
  for (const ln of lines) {
    if (new RegExp('^' + key + ':\\s*$').test(ln)) { inList = true; continue; }
    if (inList) {
      if (/^\s*-\s+/.test(ln)) out.push(ln.replace(/^\s*-\s+/, '').trim());
      else if (/^\S/.test(ln)) inList = false;
    }
  }
  return out;
}
function hasL009(s) {
  const lines = s.replace(/\r/g, '').split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === '') continue;
    return lines[i].trim() === '<!-- PKS_EXPANDED_V5 -->';
  }
  return false;
}

const entryDirs = (await fs.readdir(entriesDir, { withFileTypes: true }))
  .filter(d => d.isDirectory()).map(d => d.name);

let totalChapters = 0, missingL009 = 0, entryMissingL009 = 0, noSummary = 0, orderMismatch = 0;
const seeAlsoMissing = [];
const catL1 = {};
const allSlugs = new Set(entryDirs);

for (const slug of entryDirs) {
  const ed = path.join(entriesDir, slug);
  const entryPath = path.join(ed, 'entry.md');
  let entryTxt = '';
  try { entryTxt = await fs.readFile(entryPath, 'utf8'); } catch { continue; }
  const efm = parseFrontmatter(entryTxt);
  if (!hasL009(entryTxt)) entryMissingL009++;
  if (!getField(efm, 'summary')) noSummary++;
  const cats = getList(efm, 'categories');
  if (cats.length) {
    const l1 = cats[0].split('/')[0];
    catL1[l1] = (catL1[l1] || 0) + 1;
  }
  const sa = getList(efm, 'see_also');
  for (const t of sa) if (!allSlugs.has(t)) seeAlsoMissing.push(`${slug} -> ${t}`);
  // chapters
  const chapDir = path.join(ed, 'chapters');
  let chFiles = [];
  try { chFiles = (await fs.readdir(chapDir)).filter(f => /^ch-\d+\.md$/.test(f)); } catch {}
  totalChapters += chFiles.length;
  for (const cf of chFiles) {
    const ct = await fs.readFile(path.join(chapDir, cf), 'utf8');
    if (!hasL009(ct)) missingL009++;
    const cfm = parseFrontmatter(ct);
    const order = getField(cfm, 'order');
    const num = parseInt(cf.match(/ch-(\d+)/)[1]);
    if (order && !new RegExp('\\[' + num + '\\]').test(order)) orderMismatch++;
  }
}

console.log('=== CONTENT CENSUS ===');
console.log('entries:', entryDirs.length);
console.log('chapters:', totalChapters);
console.log('avg chapters/entry:', (totalChapters / entryDirs.length).toFixed(2));
console.log('entry.md missing L009:', entryMissingL009);
console.log('chapters missing L009:', missingL009);
console.log('entry.md missing summary:', noSummary);
console.log('order mismatch:', orderMismatch);
console.log('see_also broken refs:', seeAlsoMissing.length);
console.log('  sample:', seeAlsoMissing.slice(0, 12).join(' | '));
console.log('=== L1 category distribution ===');
Object.entries(catL1).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v));
