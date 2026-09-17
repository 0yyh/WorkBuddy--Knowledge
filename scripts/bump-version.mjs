#!/usr/env node
/**
 * versionCode / versionName 联动（P1-4）。
 *
 * 单一真源：仓库根 package.json 的 `version`（语义化版本）。本脚本据此推导 Android
 * 的 `versionCode`（单调递增整数）并回写 android/app/build.gradle，避免「发了新包却忘了
 * 自增 versionCode 导致 Play / 应用市场拒绝」的低级事故。
 *
 * versionCode 推导：major*10000 + minor*100 + patch（如 1.8.3 -> 10803）。
 * 该方案对三位语义版本提供单调递增空间，且新 code 恒大于旧（8 -> 10803 亦满足）。
 *
 * 用法：
 *   node scripts/bump-version.mjs                 # 以当前 package.json version 同步 Android
 *   node scripts/bump-version.mjs 1.9.0           # 先改 package.json version，再同步 Android
 *   node scripts/bump-version.mjs --dry-run       # 只打印将执行的操作，不落盘
 *
 * 单调性守卫：若算出的 versionCode <= 当前 build.gradle 中的值，直接报错退出（不覆盖）。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PKG = join(ROOT, 'package.json');
const GRADLE = join(ROOT, 'apps', 'web', 'android', 'app', 'build.gradle');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const versionArg = args.find((a) => !a.startsWith('--'));

function parseVersion(v) {
  const m = String(v).trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) throw new Error(`非法语义版本：${v}（期望 x.y.z）`);
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

function toCode({ major, minor, patch }) {
  return major * 10000 + minor * 100 + patch;
}

async function main() {
  if (!existsSync(PKG)) throw new Error(`找不到 ${PKG}`);
  const pkgText = await readFile(PKG, 'utf8');
  const pkg = JSON.parse(pkgText);

  if (versionArg) {
    parseVersion(versionArg); // 合法性校验
    pkg.version = versionArg;
  }
  const ver = parseVersion(pkg.version);
  const code = toCode(ver);

  if (!existsSync(GRADLE)) throw new Error(`找不到 ${GRADLE}`);
  let gradle = await readFile(GRADLE, 'utf8');

  const codeMatch = gradle.match(/versionCode\s+(\d+)/);
  const nameMatch = gradle.match(/versionName\s+"([^"]+)"/);
  if (!codeMatch || !nameMatch) throw new Error('build.gradle 中未找到 versionCode / versionName');
  const oldCode = +codeMatch[1];

  if (code <= oldCode) {
    throw new Error(
      `versionCode 必须单调递增：算出 ${code} <= 当前 ${oldCode}。请提升 package.json 的 version（当前 ${pkg.version}）。`,
    );
  }

  const newGradle = gradle
    .replace(/versionCode\s+\d+/, `versionCode ${code}`)
    .replace(/versionName\s+"[^"]+"/, `versionName "${pkg.version}"`);

  process.stdout.write(`版本联动${dryRun ? '（dry-run）' : ''}：\n`);
  process.stdout.write(`  package.json version = ${pkg.version}\n`);
  process.stdout.write(`  versionCode  ${oldCode} -> ${code}\n`);
  process.stdout.write(`  versionName  ${nameMatch[1]} -> ${pkg.version}\n`);

  if (dryRun) {
    process.stdout.write('  （dry-run：未写入任何文件）\n');
    return;
  }

  // 回写 package.json（若 version 被参数更新）
  if (versionArg) {
    await writeFile(PKG, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    process.stdout.write(`  已更新 ${PKG}\n`);
  }
  await writeFile(GRADLE, newGradle, 'utf8');
  process.stdout.write(`  已更新 ${GRADLE}\n`);
}

main().catch((err) => {
  process.stderr.write(`[bump-version] 失败：${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
