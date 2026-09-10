/** bundle —— 导出自包含数据包 zip（含 content + 索引 + bundle.json + feedback.json，02 §18.13） */
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { NodeFsVfs } from '@pks/core/node';
import { buildIndex } from '@pks/core/build';
import { createBundleZip, buildBaseSnapshot } from '@pks/core';
import type { PackLevel } from '@pks/core';

export function bundleCmd(
  contentDir: string,
  opts: { level?: PackLevel; category?: string; outDir?: string },
): string {
  const vfs = new NodeFsVfs(contentDir);
  const result = buildIndex(vfs);

  // 内容文件（排除派生产物）
  const contentFiles: Record<string, string> = {};
  let bytes = 0;
  for (const f of vfs.walk('')) {
    if (f.startsWith('.index/') || f.startsWith('_browse/') || f.startsWith('.pks/')) continue;
    const text = vfs.readText(f);
    contentFiles[f] = text;
    bytes += Buffer.byteLength(text, 'utf8'); // 精确字节数（原为 *3 粗估）
  }

  // 索引文件：去掉 '.index/' 前缀
  const indexFiles: Record<string, string> = {};
  for (const [k, v] of Object.entries(result.files)) indexFiles[k.replace(/^\.index\//, '')] = v;

  const zip = createBundleZip({
    contentFiles,
    indexFiles,
    pack: { level: opts.level ?? 'seed', category: opts.category },
    scope: { type: opts.category ? 'category' : 'all', value: opts.category },
    stats: { ...result.manifest.stats, bytes },
    base_snapshot: buildBaseSnapshot(result.snapshot.entries),
  });

  const out = opts.outDir ?? 'dist-bundle';
  mkdirSync(out, { recursive: true });
  const name = `pks-${opts.level ?? 'seed'}${opts.category ? '-' + opts.category : ''}.zip`;
  const outPath = join(out, name);
  writeFileSync(outPath, zip);
  console.log(`📦 bundle 完成：${outPath}（${zip.length} bytes，${result.manifest.stats.entries} 词条）`);
  return outPath;
}
