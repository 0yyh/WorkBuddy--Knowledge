#!/usr/bin/env node
/**
 * 构建「内容更新包」到 release/latest/，供 scripts/serve-lan.mjs 直接托管。
 *
 * 产物结构（serve 根目录即 release/latest）：
 *   release/latest/
 *   ├── manifest.json      ← { built_at, content_url, files:[{path,sha256,sha1,size}],
 *   │                          files_checksum: "sha1:<hex>" }
 *   ├── index/             ← 从 apps/web/public/content 拷贝
 *   ├── entries/
 *   ├── tracks/
 *   └── dict/
 *
 * 完整性校验为什么同时给 sha256 和 sha1：
 *   OTA 走 http://<局域网IP>，浏览器只在**安全上下文**（https / localhost）暴露
 *   `crypto.subtle`，所以 sha256 在真实 OTA 场景下根本算不出来 —— 只剩 sha1 可用。
 *   sha1 用 core 的纯 TS 实现（`packages/core/src/util/sha1.ts`，同构、零依赖），
 *   在客户端永远可算。防损坏场景下 160bit 摘要与 sha256 等价可靠；
 *   sha256 保留给 https 场景做更强的附加校验。
 *   两者均基于**同一份规范化 UTF-8 文本**计算（见下方 BOM 处理）。
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
  const bomFiles = [];
  let totalBytes = 0;
  for (const rel of relPaths) {
    const abs = join(OUT_DIR, rel);
    // 统一以「UTF-8 文本」为校验基准：客户端拿到的是 `res.text()` 解码后的字符串，
    // 只有生成侧与消费端基于同一份文本求哈希，两端才可能算出一致的结果。
    let text = await readFile(abs, 'utf8');
    if (text.charCodeAt(0) === 0xfeff) {
      // 浏览器 UTF-8 decode 同样会剥离 BOM，此处对齐该行为，保持两端一致。
      bomFiles.push(rel);
      text = text.slice(1);
    }
    const buf = Buffer.from(text, 'utf8');
    totalBytes += buf.length;
    files.push({
      path: rel,
      sha256: createHash('sha256').update(buf).digest('hex'),
      // 与 packages/core/src/util/sha1.ts 的纯 TS 实现等价（同为 UTF-8 输入，
      // 已由 packages/core/test/sha1.test.ts 与 node:crypto 对拍验证）。
      sha1: createHash('sha1').update(text, 'utf8').digest('hex'),
      size: buf.length,
    });
  }

  // 清单自校验：对 files 列表的规范摘要取 sha1，不含 files_checksum 自身（避免自引用）。
  // 消费端据此发现「清单被截断 / 少了几个文件 / 哈希或大小被改」这类损坏 ——
  // 否则一个少了几项的清单会合法通过校验，并在清理阶段误删本机缓存。
  const filesSummary = files.map((f) => `${f.path}\n${f.sha1}\n${f.size}`).join('\n');

  const manifest = {
    built_at: new Date().toISOString(),
    content_url: './',
    note: '由 scripts/build-update.mjs 生成；用 scripts/serve-lan.mjs 托管后，在 App「我的 → 内容更新」填入地址即可更新。',
    files,
    files_checksum: `sha1:${createHash('sha1').update(filesSummary, 'utf8').digest('hex')}`,
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
  process.stdout.write(` 清单自校验 ${manifest.files_checksum}\n`);
  for (const [top, count] of byTop) {
    process.stdout.write(`   - ${top.padEnd(10)} ${count}\n`);
  }
  if (bomFiles.length > 0) {
    process.stdout.write(` ⚠ ${bomFiles.length} 个文件带 UTF-8 BOM，已剥离后计算校验和：\n`);
    for (const rel of bomFiles.slice(0, 5)) process.stdout.write(`   - ${rel}\n`);
    if (bomFiles.length > 5) process.stdout.write(`   - …等共 ${bomFiles.length} 个\n`);
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
