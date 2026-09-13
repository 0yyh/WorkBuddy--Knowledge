// 一次性恢复脚本：apps/web/node_modules 被意外删除后，从根 node_modules/.pnpm 存量重新
// 建立顶层软链（junction），并重建 @pks/core 手工 junction（→ packages/core）。
// 不运行 pnpm install（遵守仓库铁律），仅复用已完整的 pnpm store。
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const nm = path.join(root, 'apps/web/node_modules');
fs.mkdirSync(nm, { recursive: true });
const store = path.join(root, 'node_modules/.pnpm');

function link(topName, storeRel) {
  const target = path.join(store, storeRel, 'node_modules', topName);
  const dest = path.join(nm, topName);
  if (fs.existsSync(dest)) {
    console.log('exists', topName);
    return;
  }
  if (!fs.existsSync(target)) {
    console.error('MISSING store entry for', topName, '->', target);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.symlinkSync(target, dest, 'junction');
  console.log('linked', topName, '->', target);
}

link('vite', 'vite@5.4.21_@types+node@22.20.1');
link('react', 'react@18.3.1');
link('react-dom', 'react-dom@18.3.1_react@18.3.1');
link('@vitejs/plugin-react', '@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@22.20.1_');
link('@types/react', '@types+react@18.3.31');
link('@types/react-dom', '@types+react-dom@18.3.7_@types+react@18.3.31');

const coreTarget = path.join(root, 'packages/core');
const coreDest = path.join(nm, '@pks/core');
if (!fs.existsSync(coreDest)) {
  fs.mkdirSync(path.dirname(coreDest), { recursive: true });
  fs.symlinkSync(coreTarget, coreDest, 'junction');
  console.log('junction @pks/core ->', coreTarget);
} else {
  console.log('exists @pks/core');
}
console.log('done');
