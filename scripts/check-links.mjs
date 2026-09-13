#!/usr/bin/env node
/**
 * P0-1 自检：校验手工 junction（@pks/core 依赖解析）未被 npm/pnpm 破坏。
 *
 * 背景：@pks/core 在 web/cli 的 package.json 里声明为 "workspace:*"，但 npm 不识别该
 * 协议；实际依赖解析靠手工文件系统 junction：
 *   - apps/web/node_modules/@pks/core   → packages/core
 *   - packages/cli/node_modules/@pks/core → packages/core
 * 一旦误跑 `npm install` / `pnpm install`，node_modules 被重建，junction 即断链，
 * web 构建会拉不到 @pks/core 的 dist，且无 git 回滚（node_modules 被忽略）。
 *
 * 本脚本校验这两个 junction 仍解析到 packages/core；断链即非零退出 + 明确修复提示。
 * 运行：node scripts/check-links.mjs
 */
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const CORE = join(ROOT, 'packages', 'core');

// 文件系统路径比较在 Windows 上对分隔符（\ vs /）与大小写不敏感；
// realpathSync 返回反斜杠，而 join/normalize 默认正斜杠，须统一后再比。
function normPath(p) {
  const n = normalize(p).replace(/\\/g, '/');
  return process.platform === 'win32' ? n.toLowerCase() : n;
}

const LINKS = [
  join(ROOT, 'apps', 'web', 'node_modules', '@pks/core'),
  join(ROOT, 'packages', 'cli', 'node_modules', '@pks/core'),
];

function coreRealpath() {
  try {
    return normalize(realpathSync(CORE));
  } catch {
    return normalize(CORE);
  }
}

function linkInfo(p) {
  if (!existsSync(p)) {
    return { exists: false, isSymlink: false, resolvesToCore: false, detail: '路径不存在' };
  }
  let isSymlink = false;
  try {
    isSymlink = lstatSync(p).isSymbolicLink();
  } catch {
    /* ignore */
  }
  let rp;
  try {
    rp = normalize(realpathSync(p));
  } catch {
    return { exists: true, isSymlink, resolvesToCore: false, detail: '路径存在但无法解析真实路径' };
  }
  const ok = normPath(rp) === normPath(coreRealpath());
  return {
    exists: true,
    isSymlink,
    resolvesToCore: ok,
    detail: ok ? (isSymlink ? '符号链接' : '目录联接(junction)') : `解析到 ${relative(ROOT, rp)}，而非 packages/core`,
  };
}

let ok = true;
const problems = [];

console.log('🔗 校验 @pks/core 手工 junction ...\n');
for (const link of LINKS) {
  const rel = relative(ROOT, link);
  const info = linkInfo(link);
  if (!info.exists) {
    ok = false;
    problems.push(`✗ ${rel} 不存在 —— junction 已丢失，可能误跑过 npm/pnpm install。`);
    continue;
  }
  if (!info.resolvesToCore) {
    ok = false;
    problems.push(`✗ ${rel} ${info.detail}。`);
    continue;
  }
  console.log(`  ✓ ${rel} → packages/core (${info.detail})`);
}

if (!ok) {
  console.error('\n❌ junction 自检失败：');
  for (const p of problems) console.error('  ' + p);
  console.error('\n修复（不要跑 npm/pnpm install，重建手工 junction 即可）：');
  console.error('  # Windows (cmd / PowerShell)');
  console.error(`  cmd /c mklink /J "${relative(ROOT, LINKS[0]).split('/').join('\\')}" packages\\core`);
  console.error(`  cmd /c mklink /J "${relative(ROOT, LINKS[1]).split('/').join('\\')}" packages\\core`);
  console.error('  # macOS / Linux');
  console.error(`  ln -s packages/core "${LINKS[0]}"`);
  console.error(`  ln -s packages/core "${LINKS[1]}"`);
  process.exit(1);
}

console.log('\n✅ @pks/core junction 完好，可安全构建。');
process.exit(0);
