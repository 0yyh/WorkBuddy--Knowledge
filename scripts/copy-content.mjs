#!/usr/bin/env node
/**
 * 把构建好的 content/ 资源增量拷贝到 apps/web/public/content/，供 Vite / Capacitor 静态托管。
 *
 * 用法（在 apps/web 下）：node ../../scripts/copy-content.mjs [--force]
 *   --force  忽略上次指纹，重新全量拷贝（并重置指纹）
 *
 * 拷贝范围（与旧版一致，仅扫描这四个子树，不碰 content 根目录其它文件，如 .pks-build-state.json）：
 *   content/.index    -> apps/web/public/content/index（改名为 index，去掉前导点）
 *   content/entries   -> apps/web/public/content/entries
 *   content/tracks    -> apps/web/public/content/tracks
 *   content/dict      -> apps/web/public/content/dict（离线词典，随包/OTA 下发）
 *
 * 增量策略（P1-1）：
 *   - 以「源文件 mtime(ms) + size」作为指纹，落盘到目标侧的 `.copy-state.json`；
 *   - 仅拷贝「目标缺失 / 指纹变化」的文件；源已删除的文件从目标侧清理（prune）；
 *   - 首次运行（无指纹）退化为全量；`build:index` 每次重写 `.index` 派生产物，故 `.index`
 *     子树在每次索引构建后仍会按新 mtime 重拷，但体量更大的静态 `entries/`、`dict/`、`tracks/`
 *     在「未改内容」的纯索引重建中会被完整跳过 —— 这是增量拷贝的主要收益点。
 *
 * 为什么把 .index 改名成 index：
 *   - Capacitor 的 `cap sync`（webDir -> assets/public）使用 dot:false 的 glob，会跳过所有以点开头的目录；
 *   - AGP 的 MergeAssets 同样会丢弃点号目录（实测：源 assets 里有 .index，mergeDebugAssets 产物里没有）。
 *   两道过滤叠加导致 Android 端 fetch(".index/...") 全部 404。因此在搬运这一步统一改名为 index/。
 */
import { cp, mkdir, readdir, rm, stat, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC_CONTENT = join(ROOT, 'content');
const DEST_CONTENT = join(ROOT, 'apps', 'web', 'public', 'content');
const STATE_FILE = join(DEST_CONTENT, '.copy-state.json');

/** 需要搬运的四个源子树（相对 content/） */
const SUBTREES = ['.index', 'entries', 'tracks', 'dict'];

/** .index -> index 改名（仅首段） */
function toDestRel(rel) {
  return rel.replace(/^\.index(\/|$)/, 'index$1');
}

/** 离线词典运行端只需构建产物 index.json，剔除 4 个原始大文件（约 16MB JSONL/JSON） */
const STRIP_DICT_FILES = new Set([
  'dict/chinese-dictionary/character/char_base.json',
  'dict/chinese-dictionary/character/char_detail.json',
  'dict/chinese-dictionary/character/polyphone.json',
  'dict/chinese-dictionary/character/related.json',
]);

/** 递归列出某子树下的全部文件，返回 相对 content/ 的 posix 路径数组 */
async function listFiles(subtree) {
  const out = [];
  const base = join(SRC_CONTENT, subtree);
  if (!existsSync(base)) return out;
  const walk = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile()) {
        out.push(relative(SRC_CONTENT, full).split(sep).join('/'));
      }
    }
  };
  await walk(base);
  return out;
}

/** 读取上次指纹；不存在/损坏则视为空 */
async function loadState() {
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function copyFile(from, to) {
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to, { recursive: false });
}

async function main() {
  const force = process.argv.includes('--force');
  if (!existsSync(SRC_CONTENT)) throw new Error(`找不到源目录：${SRC_CONTENT}`);
  await mkdir(DEST_CONTENT, { recursive: true });

  const prevState = force ? {} : await loadState();
  const newState = {};
  let copied = 0;
  let unchanged = 0;
  let pruned = 0;

  // 1) 扫描四棵子树并增量拷贝
  for (const subtree of SUBTREES) {
    const files = await listFiles(subtree);
    for (const rel of files) {
      const destRel = toDestRel(rel);
      if (STRIP_DICT_FILES.has(destRel)) continue; // 运行端不需要的原始大文件
      const from = join(SRC_CONTENT, rel);
      const to = join(DEST_CONTENT, destRel);
      const info = await stat(from);
      const sig = { mtime: Math.round(info.mtimeMs), size: info.size };
      const old = prevState[destRel];
      const needCopy = !old || old.mtime !== sig.mtime || old.size !== sig.size;
      if (needCopy) {
        await copyFile(from, to);
        copied++;
      } else {
        unchanged++;
      }
      newState[destRel] = sig;
    }
  }

  // 2) 清理目标侧「源已删除」的文件（prune）；保留 .copy-state.json
  const expected = new Set(Object.keys(newState));
  const destFiles = [];
  const walkDest = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        await walkDest(full);
      } else if (e.isFile()) {
        destFiles.push(full);
      }
    }
  };
  await walkDest(DEST_CONTENT);
  for (const full of destFiles) {
    const rel = relative(DEST_CONTENT, full).split(sep).join('/');
    if (rel === '.copy-state.json') continue;
    if (!expected.has(rel)) {
      await rm(full, { force: true });
      pruned++;
    }
  }

  // 3) 兜底：剔除可能残留的 4 个词典大文件（旧全量拷贝遗留）
  for (const f of STRIP_DICT_FILES) {
    const p = join(DEST_CONTENT, f);
    if (existsSync(p)) {
      await rm(p, { force: true });
      pruned++;
    }
  }

  // 4) 落盘指纹
  await writeFile(STATE_FILE, JSON.stringify(newState), 'utf8');

  // 5) 报告（与旧版口径保持一致的信息）
  const indexFiles = await readdir(join(DEST_CONTENT, 'index'));
  const jf = (await readdir(join(DEST_CONTENT, 'index', 'entries'))).length;
  const sf = (await readdir(join(DEST_CONTENT, 'index', 'search'))).length;
  const ef = (await readdir(join(DEST_CONTENT, 'entries'))).length;

  process.stdout.write(`content 增量拷贝完成（${force ? '全量' : '增量'}）：\n`);
  process.stdout.write(`  新增/变更   ${copied} 个文件\n`);
  process.stdout.write(`  跳过未变   ${unchanged} 个文件\n`);
  process.stdout.write(`  清理删除   ${pruned} 个文件\n`);
  process.stdout.write(`  目标目录   ${DEST_CONTENT}\n`);
  process.stdout.write(`  index        ${indexFiles.join(', ')}\n`);
  process.stdout.write(`  entries      ${ef} 个词条目录\n`);
  process.stdout.write(`  entries 索引 ${jf} 个分片\n`);
  process.stdout.write(`  search 索引  ${sf} 个文件\n`);
}

main().catch((err) => {
  process.stderr.write(`[copy-content] 失败：${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
