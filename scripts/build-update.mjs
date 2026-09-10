#!/usr/bin/env node
/**
 * 构建「内容更新包」到 release/latest/，供 scripts/serve-lan.mjs 直接托管。
 *
 * 产物结构（serve 根目录即 release/latest）：
 *   release/latest/
 *   ├── manifest.json      ← { built_at, content_url, files:[{path,sha256,size}] }
 *   ├── index/             ← 从 apps/web/public/content 拷贝
 *   ├── entries/
 *   ├── tracks/
 *   └── dict/
 *
 * 为什么是「逐文件清单」而不是单个 zip：
 *   客户端（Android WebView）当前没有任何解压库，且禁止新增依赖；
 *   `DecompressionStream` 只支持 gzip/deflate、不支持 zip 容器。
 *   清单 + 静态目录可以让客户端用原生 fetch 逐文件下载并写入 IndexedDB，
 *   还能天然做到增量（只有 sha256 变化的文件重下）与断点重试。
 *
 * 用法：
 *   node scripts/build-update.mjs [outDir]
 *     outDir 默认 ./release/latest（从项目根解析）
 *
 * 零依赖：只用 node:crypto / node:fs。
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DEFAULT_SRC = resolve(ROOT, 'apps', 'web', 'public', 'content');
const DEFAULT_OUT = resolve(ROOT, 'release', 'latest');

const argOut = process.argv[2];
const SRC_DIR = DEFAULT_SRC;
const OUT_DIR = argOut ? resolve(argOut) : DEFAULT_OUT;

/** 递归列出目录下所有文件（返回相对 root 的 POSIX 路径） */
async function walk(dir, root) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(abs, root)));
    } else if (entry.isFile()) {
      out.push(relative(root, abs).split('\\').join('/'));
    }
  }
  return out;
}

function sha256File(absPath) {
  return readFile(absPath).then((buf) => createHash('sha256').update(buf).digest('hex'));
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  const srcStat = await stat(SRC_DIR).catch(() => null);
  if (!srcStat || !srcStat.isDirectory()) {
    process.stderr.write(`[build-update] 内容源目录不存在：${SRC_DIR}\n`);
    process.exit(1);
  }

  // 产物目录是我们自己生成的，整目录重建以保证「删掉的文件不残留」
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  await cp(SRC_DIR, OUT_DIR, { recursive: true });

  const relPaths = (await walk(OUT_DIR, OUT_DIR)).sort();

  const files = [];
  let totalBytes = 0;
  for (const rel of relPaths) {
    const abs = join(OUT_DIR, rel);
    const info = await stat(abs);
    const sha256 = await sha256File(abs);
    totalBytes += info.size;
    files.push({ path: rel, sha256, size: info.size });
  }

  const manifest = {
    built_at: new Date().toISOString(),
    content_url: './',
    note: '由 scripts/build-update.mjs 生成；用 scripts/serve-lan.mjs 托管后，在 App「我的 → 内容更新」填入地址即可更新。',
    files,
  };

  await writeFile(join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  const byTop = new Map();
  for (const f of files) {
    const top = f.path.split('/')[0];
    byTop.set(top, (byTop.get(top) ?? 0) + 1);
  }

  process.stdout.write('==================================================\n');
  process.stdout.write(' 内容更新包已生成\n');
  process.stdout.write(` 输出目录  ${OUT_DIR}\n`);
  process.stdout.write(` built_at  ${manifest.built_at}\n`);
  process.stdout.write(` 文件数    ${files.length}（${humanSize(totalBytes)}）\n`);
  for (const [top, count] of byTop) {
    process.stdout.write(`   - ${top.padEnd(10)} ${count}\n`);
  }
  process.stdout.write('--------------------------------------------------\n');
  process.stdout.write(' 托管命令：node scripts/serve-lan.mjs release/latest 8080\n');
  process.stdout.write(' App 内：我的 → 内容更新 → 填 http://<电脑IP>:8080/\n');
  process.stdout.write('==================================================\n');
}

main().catch((err) => {
  process.stderr.write(`[build-update] 失败：${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
});
