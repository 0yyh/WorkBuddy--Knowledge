/**
 * build-apk.mjs —— 一键 APK 构建脚本
 *
 * 把零散、易错的 Android 打包流程固化为单条命令，按顺序编排 4 步：
 *   1. build:index + copy:content  （node scripts_build.mjs，需 CODEBUDDY_SAFE_DELETE_ENABLED=0）
 *   2. vite build                  （apps/web，需 CODEBUDDY_SAFE_DELETE_ENABLED=0）
 *   3. 同步 dist → android public   （node scripts_sync_android_assets.mjs，保留 capacitor.config.json）
 *   4. Gradle assembleDebug         （PowerShell 调 gradle.bat，*> 重定向到日志，绝不管道）
 *
 * 设计要点（见任务约束）：
 *   - Gradle 必须用 PowerShell 跑（bash 解析 .bat 会出错）。
 *   - 禁止管道（| Out-File / | Tee-Object）：管道会吞掉 gradle.bat 的退出码，
 *     造成“构建成功却被报 failed”的假失败。改用 PowerShell 原生 *> 重定向 + exit $LASTEXITCODE。
 *   - 不改动 build:index / vite build / gradle 的实质逻辑，只做编排。
 *   - 不触碰 packages/core 的 junction 解析（P0，本次跳过）。
 */

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..'); // D:/WorkBuddy--Knowledge
const ANDROID_DIR = path.join(ROOT, 'apps/web/android');
const APK_PATH = path.join(ANDROID_DIR, 'app/build/outputs/apk/debug/app-debug.apk');
const GRADLE_LOG = path.join(ANDROID_DIR, 'build-apk-gradle.log');

const JAVA_HOME = 'D:\\JDK\\jdk-19.0.1';
const ANDROID_HOME = 'D:\\Android SDK';
const GRADLE_BAT =
  'C:\\Users\\Yu\\.gradle\\wrapper\\dists\\gradle-8.11.1-all\\2qik7nd48slq1ooc2496ixf4i\\gradle-8.11.1\\bin\\gradle.bat';

function step(label) {
  console.log('\n==================================================');
  console.log('▶ ' + label);
  console.log('==================================================');
}

/**
 * 运行一个子进程，流式继承输出，返回退出码。
 * @param {string} cmd
 * @param {string[]} args
 * @param {import('node:child_process').SpawnOptions} opts
 * @returns {Promise<number>}
 */
function runProc(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('error', reject);
    p.on('close', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const safeEnv = { ...process.env, CODEBUDDY_SAFE_DELETE_ENABLED: '0' };

  // ---- Step 1: build:index + copy:content ----
  step('1/4  build:index + copy:content  (node scripts_build.mjs)');
  const c1 = await runProc('node', ['scripts_build.mjs'], { cwd: ROOT, env: safeEnv });
  if (c1 !== 0) {
    console.error('\n✗ 步骤 1 失败（exit ' + c1 + '）：build:index / copy-content 未通过。');
    process.exit(1);
  }
  console.log('✓ 步骤 1 完成');

  // ---- Step 2: vite build ----
  step('2/4  vite build  (apps/web)');
  const c2 = await runProc('npm', ['run', 'build'], {
    cwd: path.join(ROOT, 'apps/web'),
    env: safeEnv,
    shell: true,
  });
  if (c2 !== 0) {
    console.error('\n✗ 步骤 2 失败（exit ' + c2 + '）：vite build 未通过。');
    process.exit(1);
  }
  console.log('✓ 步骤 2 完成');

  // ---- Step 3: sync dist -> android public ----
  step('3/4  同步 dist → android public  (node scripts_sync_android_assets.mjs)');
  const c3 = await runProc('node', ['scripts_sync_android_assets.mjs'], { cwd: ROOT });
  if (c3 !== 0) {
    console.error('\n✗ 步骤 3 失败（exit ' + c3 + '）：android assets 同步未通过。');
    process.exit(1);
  }
  console.log('✓ 步骤 3 完成');

  // ---- Step 4: Gradle assembleDebug via PowerShell ----
  step('4/4  Gradle assembleDebug  (PowerShell, 日志 → ' + GRADLE_LOG + ')');

  try {
    await fs.access(GRADLE_BAT);
  } catch {
    console.error('\n✗ 未找到 gradle.bat：' + GRADLE_BAT);
    process.exit(1);
  }

  // 关键：PowerShell 原生 *> 重定向到日志文件；绝不使用管道。
  // 末尾 exit $LASTEXITCODE 把 gradle 的真实退出码透传给 node，避免“假失败”。
  const psCommand = [
    "$env:JAVA_HOME='" + JAVA_HOME + "'",
    "$env:ANDROID_HOME='" + ANDROID_HOME + "'",
    "& '" + GRADLE_BAT + "' assembleDebug --no-daemon --console=plain *> '" + GRADLE_LOG + "'",
    'exit $LASTEXITCODE',
  ].join('; ');

  const gradleCode = await new Promise((resolve) => {
    const g = spawn('powershell', ['-NoProfile', '-Command', psCommand], { cwd: ANDROID_DIR });
    g.on('error', (e) => {
      console.error('gradle 进程启动失败：' + e.message);
      resolve(1);
    });
    g.on('close', (code) => resolve(code ?? 1));
  });

  // 无论成败都打印日志尾部，便于排查；并显式 grep BUILD SUCCESSFUL
  try {
    const log = await fs.readFile(GRADLE_LOG, 'utf8');
    const lines = log.split('\n');
    const tail = lines.slice(-40).join('\n');
    console.log('\n----- gradle 日志尾部 -----\n' + tail);
    const successLine = lines.find((l) => l.includes('BUILD SUCCESSFUL'));
    if (successLine) {
      console.log('\n✅ Gradle 构建结果：' + successLine.trim());
    } else {
      console.log('\n⚠ 未在日志中发现 "BUILD SUCCESSFUL" 行（可能构建失败或输出被截断）。');
    }
  } catch {
    console.log('（无法读取 gradle 日志：' + GRADLE_LOG + '）');
  }

  if (gradleCode !== 0) {
    console.error('\n✗ 步骤 4 失败（exit ' + gradleCode + '）：Gradle assembleDebug 未通过，详见 ' + GRADLE_LOG);
    process.exit(1);
  }
  console.log('✓ 步骤 4 完成（Gradle 构建成功）');

  // ---- 最终校验产物 ----
  step('校验产物 APK');
  try {
    const stat = await fs.stat(APK_PATH);
    const mb = (stat.size / (1024 * 1024)).toFixed(2);
    console.log('✅ APK 产出成功：');
    console.log('   ' + APK_PATH);
    console.log('   大小：' + stat.size + ' 字节（' + mb + ' MB）');
  } catch {
    console.error('\n✗ 未找到 APK：' + APK_PATH);
    process.exit(1);
  }

  console.log('\n🎉 一键 APK 构建完成。');
}

main().catch((e) => {
  console.error('build-apk 异常：', e);
  process.exit(1);
});
