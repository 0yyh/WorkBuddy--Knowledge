/**
 * 词条目录内容指纹（② builder 增量构建）。
 *
 * `hashEntryDir` = sha1(entry.md + chapters/*.md 的稳定序列化)，用于判断某词条
 * 相对上次构建是否发生变化：未变 → 复用旧分片 postings（跳过分词，O(变更)）；
 * 变了 → 重新分词。
 *
 * 注意：与 `manifest.contentHash`（sha1(slug:rev)，包指纹/OTA 用途）职责不同，勿混。
 * 序列化必须稳定：文件按名称排序、路径与内容拼接，保证同一内容恒得同一 hash。
 */
import { sha1 } from '../util/sha1.js';
import type { Vfs } from '../vfs/types.js';

/** 计算某词条目录（entry.md + chapters/*.md）的内容指纹。 */
export function hashEntryDir(vfs: Vfs, slug: string): string {
  const parts: string[] = [];
  const entryFile = `entries/${slug}/entry.md`;
  if (vfs.exists(entryFile)) parts.push(`# ${entryFile}\n${vfs.readText(entryFile)}`);

  const chaptersDir = `entries/${slug}/chapters`;
  if (vfs.exists(chaptersDir)) {
    const files = vfs.listDir(chaptersDir).filter((f) => f.endsWith('.md')).sort();
    for (const f of files) {
      parts.push(`# chapters/${f}\n${vfs.readText(`${chaptersDir}/${f}`)}`);
    }
  }
  return sha1(parts.join('\n\n'));
}
