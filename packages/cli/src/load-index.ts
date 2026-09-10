/** 从已构建的 .index/ 目录加载索引，构造可查询的 SearchEngine（CLI search / 验证用） */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SearchEngine, decodePostings } from '@pks/core';
import type { TitleIndexItem, IndexManifest, ShardIndex } from '@pks/core';

/**
 * 从已构建的 .index/ 目录加载索引，构造可查询的 SearchEngine（CLI search / 验证用）。
 *
 * 返回 null 表示「尚无可用索引」（关键文件缺失）——调用方据此提示先跑 build:index；
 * 文件存在但 JSON 解析失败则抛错（索引已损坏，属于需要用户处理的状态）。
 * @throws 当 manifest / title.json 存在但内容损坏时
 */
export function loadIndex(contentDir: string): SearchEngine | null {
  const idxDir = join(contentDir, '.index');
  const manifestPath = join(idxDir, 'manifest.json');
  const titlePath = join(idxDir, 'search', 'title.json');
  if (!existsSync(manifestPath) || !existsSync(titlePath)) return null;

  let manifest: IndexManifest;
  let titleIndex: TitleIndexItem[];
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    titleIndex = JSON.parse(readFileSync(titlePath, 'utf8'));
  } catch (e) {
    throw new Error(
      `索引文件损坏（${e instanceof Error ? e.message : String(e)}），请重新运行 build:index`,
    );
  }

  const shardLoader = (s: number): ShardIndex | null => {
    const p = join(idxDir, 'search', `s${String(s).padStart(2, '0')}.json`);
    if (!existsSync(p)) return null;
    try {
      const raw = JSON.parse(readFileSync(p, 'utf8'));
      // P0-I：倒排走 `postings`（base64(varint 差分 + zlib)）；旧产物回落到内联 `index`。
      const index = raw.postings ? decodePostings(raw.postings) : (raw.index ?? {});
      return { shard: raw.shard, docs: raw.docs, lengths: raw.lengths, index };
    } catch {
      // 单个分片损坏按「该分片不存在」处理：L2 少召回一部分，但不炸整个检索。
      return null;
    }
  };

  return new SearchEngine(manifest, titleIndex, shardLoader);
}
