#!/usr/bin/env node
/**
 * 把构建好的 content/ 资源拷贝到 apps/web/public/content/，供 Vite / Capacitor 静态托管。
 *
 * 用法（在 apps/web 下）：node ../../scripts/copy-content.mjs
 *
 * 拷贝内容（索引与词条由 CLI `build:index` 产出；dict 为词典内容资源，本脚本一并搬运）：
 *   content/.index    -> apps/web/public/content/index（改名为 index，去掉前导点）
 *   content/entries   -> apps/web/public/content/entries
 *   content/tracks    -> apps/web/public/content/tracks
 *   content/dict      -> apps/web/public/content/dict（离线词典，随包/OTA 下发）
 *
 * 为什么要把 .index 改名成 index：
 *   - Capacitor 的 `cap sync`（webDir -> assets/public）使用 dot:false 的 glob，
 *     会跳过所有以点开头的目录；
 *   - AGP 的 MergeAssets 同样会丢弃点号目录（实测：源 assets 里有 .index，
 *     mergeDebugAssets 产物里没有）。
 *   两道过滤叠加导致 Android 端 fetch(".index/...") 全部 404。因此在"搬运进 web
 *   产物"这一步统一改名为 index/，阅读端 loader/content 也相应按 index/ 读取。
 */
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC_CONTENT = join(ROOT, 'content');
const DEST_CONTENT = join(ROOT, 'apps', 'web', 'public', 'content');

/**
 * @param {string} rel     源 content/ 下的相对路径
 * @param {string} destRel 目标 public/content/ 下的相对路径（默认与源同名）
 */
async function copyDir(rel, destRel = rel) {
  const from = join(SRC_CONTENT, rel);
  const to = join(DEST_CONTENT, destRel);
  const info = await stat(from);
  if (!info.isDirectory()) throw new Error(`不是目录：${from}`);
  await mkdir(to, { recursive: true });
  await cp(from, to, { recursive: true });
}

async function main() {
  if (!existsSync(SRC_CONTENT)) throw new Error(`找不到源目录：${SRC_CONTENT}`);

  await rm(DEST_CONTENT, { recursive: true, force: true });
  await mkdir(DEST_CONTENT, { recursive: true });

  // .index -> index（去掉前导点，避免被 Capacitor / AGP 丢弃）
  await copyDir('.index', 'index');
  await copyDir('entries');
  await copyDir('tracks');
  // 离线词典（content/dict/dictionary.json）；随包与内容更新一并下发
  await copyDir('dict');

  const indexFiles = await readdir(join(DEST_CONTENT, 'index'));
  const jf = await readdir(join(DEST_CONTENT, 'index', 'entries'));
  const sf = (await readdir(join(DEST_CONTENT, 'index', 'search'))).length;
  const ef = (await readdir(join(DEST_CONTENT, 'entries'))).length;

  process.stdout.write('content 拷贝完成：\n');
  process.stdout.write(`  目标目录     ${DEST_CONTENT}\n`);
  process.stdout.write(`  index        ${indexFiles.join(', ')}\n`);
  process.stdout.write(`  entries      ${ef} 个词条目录\n`);
  process.stdout.write(`  entries 索引 ${jf.length} 个分片（${jf.join(', ')}）\n`);
  process.stdout.write(`  search 索引  ${sf} 个文件\n`);
}

main().catch((err) => {
  process.stderr.write(`[copy-content] 失败：${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
