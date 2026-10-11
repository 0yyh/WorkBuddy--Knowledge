import { promises as fs } from 'node:fs';
import path from 'node:path';

const dist = 'D:/WorkBuddy--Knowledge/apps/web/dist';
const pub = 'D:/WorkBuddy--Knowledge/apps/web/android/app/src/main/assets/public';
const KEEP = new Set(['capacitor.config.json']);

async function rmrf(p) {
  const st = await fs.stat(p).catch(() => null);
  if (!st) return;
  if (st.isDirectory()) {
    for (const e of await fs.readdir(p)) await rmrf(path.join(p, e));
    await fs.rmdir(p);
  } else {
    await fs.unlink(p);
  }
}

async function cpdir(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  for (const e of await fs.readdir(src)) {
    const s = path.join(src, e), d = path.join(dst, e);
    const st = await fs.stat(s);
    if (st.isDirectory()) await cpdir(s, d);
    else await fs.copyFile(s, d);
  }
}

// 1. clean pub except KEEP
for (const e of await fs.readdir(pub)) {
  if (KEEP.has(e)) continue;
  await rmrf(path.join(pub, e));
}
// 2. copy dist/* into pub
for (const e of await fs.readdir(dist)) {
  const s = path.join(dist, e), d = path.join(pub, e);
  const st = await fs.stat(s);
  if (st.isDirectory()) await cpdir(s, d);
  else await fs.copyFile(s, d);
}

// verify capacitor.config.json still present
const cfg = await fs.readFile(path.join(pub, 'capacitor.config.json'), 'utf8');
console.log('capacitor.config.json preserved:', cfg.includes('com.pks.app'));
const idx = await fs.readFile(path.join(pub, 'index.html'), 'utf8');
console.log('index.html bytes:', idx.length);
console.log('content dir present:', await fs.stat(path.join(pub, 'content')).then(() => true).catch(() => false));
console.log('SYNC_DONE');
