#!/usr/bin/env node
/**
 * setup-env.mjs —— PKS 开发者环境一键自检 / 固化脚本（R2）
 *
 * 目标：让一台全新机器在 ~10 分钟内具备开发 / 构建 PKS 的环境，并把最容易踩坑的
 * 「@pks/core 手工 junction」问题自动化修复。本脚本**只检测 + 兜底建 junction**，
 * 不重装任何依赖（重装会破坏 junction，见 README 红线）。
 *
 * 步骤：
 *   1. 打印 Node 版本；< 18 告警（本仓库 engines 要求 ≥ 20.11，旧版无保障）。
 *   2. 检查 JAVA_HOME —— 期望 D:\JDK\jdk-19.0.1；若缺失或 JAVA_HOME/bin/javac 不存在则告警。
 *   3. 检查 ANDROID_HOME —— 期望 D:\Android SDK；缺失则告警（仅影响 APK 构建）。
 *   4. 检查并（必要时）重建 @pks/core junction：
 *        apps/web/node_modules/@pks/core   → packages/core
 *        packages/cli/node_modules/@pks/core → packages/core
 *      仅当链接缺失时才用 fs.symlinkSync(..., 'junction') 重建；已存在且解析正确则跳过。
 *   5. 若 packages/core/dist 缺失或过期，则跑 core build（沙箱内若报错则记录并继续）。
 *   6. 打印 ✅/⚠️ 自检清单汇总。
 *
 * 设计：每一步独立 try/catch，互不阻塞；最终 process.exit(0)（脚本本职是检测 + junction）。
 * 运行：node scripts/setup-env.mjs
 */

import { existsSync, lstatSync, realpathSync, symlinkSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const ROOT = normalize(join(dirname(__filename), '..'));
const CORE_DIR = join(ROOT, 'packages', 'core');

// 本机约定路径（可按需修改；脚本对「任意合法 JDK / SDK 路径」均接受）
const EXPECTED_JAVA_HOME = 'D:\\JDK\\jdk-19.0.1';
const EXPECTED_ANDROID_HOME = 'D:\\Android SDK';

// 已经实测存在的 pnpm 缓存内工具路径（node_modules 被 .gitignore，勿重装）
const TSC = join(ROOT, 'node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc');

const LINKS = [
  join(ROOT, 'apps', 'web', 'node_modules', '@pks/core'),
  join(ROOT, 'packages', 'cli', 'node_modules', '@pks/core'),
];

// 步骤结果收集（⚠️ 不阻断后续步骤）
const results = [];
function record(ok, label, detail) {
  results.push({ ok, label, detail });
  const icon = ok ? '✅' : '⚠️';
  console.log(`  ${icon} ${label}${detail ? ' —— ' + detail : ''}`);
}

function normPath(p) {
  const n = normalize(p).replace(/\\/g, '/');
  return process.platform === 'win32' ? n.toLowerCase() : n;
}

function coreRealpath() {
  try {
    return normalize(realpathSync(CORE_DIR));
  } catch {
    return normalize(CORE_DIR);
  }
}

function linkResolvesToCore(linkPath) {
  if (!existsSync(linkPath)) return false;
  let rp;
  try {
    rp = normalize(realpathSync(linkPath));
  } catch {
    return false;
  }
  return normPath(rp) === normPath(coreRealpath());
}

function ensureParentDir(linkPath) {
  const parent = dirname(linkPath);
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
}

// 时间：src 是否比 dist 新（用于判断 core build 是否需要重跑）
function coreDistStale() {
  const distMain = join(CORE_DIR, 'dist', 'index.js');
  if (!existsSync(distMain)) return true;
  let distTime;
  try {
    distTime = statSync(distMain).mtimeMs;
  } catch {
    return true;
  }
  const srcDir = join(CORE_DIR, 'src');
  let newest = 0;
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.ts')) newest = Math.max(newest, statSync(p).mtimeMs);
    }
  };
  try {
    walk(srcDir);
  } catch {
    return true;
  }
  return newest > distTime;
}

// ────────────────────────────────────────────────────────────
// 步骤 1：Node 版本
// ────────────────────────────────────────────────────────────
console.log('\n==================================================');
console.log('▶ [1/6] Node 版本检查');
console.log('==================================================');
try {
  const ver = process.versions.node;
  const major = parseInt(ver.split('.')[0], 10);
  console.log('  Node ' + ver);
  if (major < 18) record(false, 'Node 版本过低', `当前 ${ver}，建议 ≥ 20.11（仓库 engines 要求）`);
  else record(true, 'Node 版本满足要求', `当前 ${ver}`);
} catch (e) {
  record(false, 'Node 版本检测异常', e.message);
}

// ────────────────────────────────────────────────────────────
// 步骤 2：JAVA_HOME
// ────────────────────────────────────────────────────────────
console.log('\n==================================================');
console.log('▶ [2/6] JAVA_HOME 检查（影响 APK 构建）');
console.log('==================================================');
try {
  const javaHome = process.env.JAVA_HOME;
  if (!javaHome) {
    record(false, 'JAVA_HOME 未设置', `期望 ${EXPECTED_JAVA_HOME}（任意含 bin/javac 的 JDK 均可）`);
  } else {
    console.log('  JAVA_HOME = ' + javaHome);
    const javac = join(javaHome, 'bin', 'javac');
    const javacExe = join(javaHome, 'bin', 'javac.exe');
    const hasJavac = existsSync(javac) || existsSync(javacExe);
    if (!hasJavac) {
      record(false, 'JAVA_HOME 未指向有效 JDK', `在 ${javaHome}\\bin 下找不到 javac；期望 ${EXPECTED_JAVA_HOME}`);
    } else {
      const isExpected = normPath(javaHome) === normPath(EXPECTED_JAVA_HOME);
      record(true, 'JAVA_HOME 指向有效 JDK', isExpected ? '与约定路径一致' : `非约定路径 ${EXPECTED_JAVA_HOME}，但可用`);
    }
  }
} catch (e) {
  record(false, 'JAVA_HOME 检测异常', e.message);
}

// ────────────────────────────────────────────────────────────
// 步骤 3：ANDROID_HOME
// ────────────────────────────────────────────────────────────
console.log('\n==================================================');
console.log('▶ [3/6] ANDROID_HOME 检查（影响 APK 构建）');
console.log('==================================================');
try {
  const androidHome = process.env.ANDROID_HOME;
  if (!androidHome) {
    record(false, 'ANDROID_HOME 未设置', `期望 ${EXPECTED_ANDROID_HOME}`);
  } else {
    console.log('  ANDROID_HOME = ' + androidHome);
    const isExpected = normPath(androidHome) === normPath(EXPECTED_ANDROID_HOME);
    if (!existsSync(androidHome)) {
      record(false, 'ANDROID_HOME 路径不存在', `${androidHome} 目录缺失；期望 ${EXPECTED_ANDROID_HOME}`);
    } else {
      record(true, 'ANDROID_HOME 存在', isExpected ? '与约定路径一致' : `非约定路径 ${EXPECTED_ANDROID_HOME}，但可用`);
    }
  }
} catch (e) {
  record(false, 'ANDROID_HOME 检测异常', e.message);
}

// ────────────────────────────────────────────────────────────
// 步骤 4：@pks/core junction 检查 / 重建
// ────────────────────────────────────────────────────────────
console.log('\n==================================================');
console.log('▶ [4/6] @pks/core 手工 junction 校验 / 重建');
console.log('==================================================');
try {
  if (!existsSync(CORE_DIR)) {
    record(false, '@pks/core 源目录缺失', `${relative(ROOT, CORE_DIR)} 不存在，无法建立 junction`);
  } else {
    for (const link of LINKS) {
      const rel = relative(ROOT, link);
      if (linkResolvesToCore(link)) {
        const isSym = (() => { try { return lstatSync(link).isSymbolicLink(); } catch { return false; } })();
        record(true, `junction 完好：${rel}`, isSym ? '符号链接' : '目录联接(junction)');
        continue;
      }
      // 缺失或解析错误 → 尝试重建（绝不直接删除已有内容，仅当目标缺失时建 junction）
      try {
        ensureParentDir(link);
        symlinkSync(CORE_DIR, link, 'junction');
        record(true, `junction 已重建：${rel}`, `→ ${relative(ROOT, CORE_DIR)}`);
      } catch (e) {
        record(false, `junction 重建失败：${rel}`, e.message + '（可手动：cmd /c mklink /J "' + rel.split('/').join('\\') + '" packages\\core）');
      }
    }
  }
} catch (e) {
  record(false, '@pks/core junction 检测异常', e.message);
}

// ────────────────────────────────────────────────────────────
// 步骤 5：core build（按需）
// ────────────────────────────────────────────────────────────
console.log('\n==================================================');
console.log('▶ [5/6] @pks/core 构建（按需）');
console.log('==================================================');
try {
  if (!existsSync(TSC)) {
    record(false, '找不到 tsc', `预期路径 ${relative(ROOT, TSC)} 不存在（node_modules 被重装？）`);
  } else {
    const stale = coreDistStale();
    if (!stale) {
      record(true, 'core dist 已是最新，跳过构建', 'src 未比 dist 更新');
    } else {
      console.log('  core dist 缺失/过期，运行 tsc -p packages/core/tsconfig.json ...');
      const r = spawnSync('node', [TSC, '-p', join(CORE_DIR, 'tsconfig.json')], {
        cwd: ROOT,
        stdio: 'inherit',
      });
      if (r.status === 0) record(true, '@pks/core 构建成功', 'tsc 退出码 0');
      else record(false, '@pks/core 构建未通过', `tsc 退出码 ${r.status ?? '?'}` + (r.error ? `（${r.error.message}）` : '') + '（沙箱内可能受限，可稍后手动重跑）');
    }
  }
} catch (e) {
  record(false, '@pks/core 构建异常', e.message);
}

// ────────────────────────────────────────────────────────────
// 步骤 6：汇总
// ────────────────────────────────────────────────────────────
console.log('\n==================================================');
console.log('▶ [6/6] 自检清单汇总');
console.log('==================================================');
let allOk = true;
for (const r of results) {
  if (!r.ok) allOk = false;
  const icon = r.ok ? '✅' : '⚠️';
  console.log(`  ${icon} ${r.label}${r.detail ? ' —— ' + r.detail : ''}`);
}

console.log('');
if (allOk) {
  console.log('🎉 环境自检全部通过，可开始开发 / 构建。');
  console.log('   下一步：node ... tsc -p packages/core/tsconfig.json  &&  npm run apk');
} else {
  console.log('⚠️  存在告警项（上方 ⚠️）。除 JAVA_HOME/ANDROID_HOME 仅影响 APK 构建外，');
  console.log('   junction 与 core build 失败通常已尝试自动修复，或需手动按提示处理后再跑一次本脚本。');
}
console.log('   详见 docs/contributing.md（完整贡献者 / 运维指南）。\n');

process.exit(0);
