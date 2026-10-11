import fs from 'node:fs';
const base = 'D:/WorkBuddy--Knowledge/content/entries';

// all real slugs on disk
const all = new Set(fs.readdirSync(base).filter(s => fs.existsSync(base + '/' + s + '/entry.md')));

const want = ['monarchy','totalitarianism','parliamentarism','presidentialism','political-parties','electoral-systems','direct-democracy','populism','international-relations','realism-ir','balance-of-power','hegemony','justice','liberty','equality','human-rights','political-ideology','power-politics','nation-state','social-movements'];

let problems = [];
for (const s of want) {
  const d = base + '/' + s;
  if (!fs.existsSync(d)) { problems.push(s + ': ENTRY MISSING'); continue; }
  const chaptersDir = d + '/chapters';
  const files = fs.existsSync(chaptersDir) ? fs.readdirSync(chaptersDir).filter(f=>f.endsWith('.md')).sort() : [];
  const expected = ['ch-01.md','ch-02.md','ch-03.md','ch-04.md','ch-05.md'];
  for (const e of expected) {
    const p = chaptersDir + '/' + e;
    if (!fs.existsSync(p)) { problems.push(s + '/' + e + ': MISSING'); continue; }
    const t = fs.readFileSync(p, 'utf8');
    const lines = t.replace(/\s+$/,'').split('\n');
    if (lines[lines.length-1] !== '<!-- PKS_EXPANDED_V5 -->') problems.push(s + '/' + e + ': NO MARKER');
    // tldr length
    const tm = t.match(/tldr:\s*(.+)/);
    if (tm) { const len = tm[1].trim().length; if (len > 120) problems.push(s+'/'+e+': TLDR='+len); }
  }
  // entry see_also
  const entry = fs.readFileSync(d + '/entry.md', 'utf8');
  const m = entry.match(/see_also:\s*\[([^\]]*)\]/);
  if (m) {
    const arr = m[1].split(',').map(x=>x.trim()).filter(Boolean);
    for (const x of arr) if (!all.has(x)) problems.push(s + ' see_also bad: ' + x);
  }
  const lines = entry.replace(/\s+$/,'').split('\n');
  if (lines[lines.length-1] !== '<!-- PKS_EXPANDED_V5 -->') problems.push(s + ' ENTRY NO MARKER');
}

console.log('PROBLEMS (' + problems.length + '):');
for (const p of problems) console.log(' - ' + p);
if (problems.length === 0) console.log('ALL 20 ENTRIES COMPLETE & VALID');
