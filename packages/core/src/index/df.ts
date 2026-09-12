/**
 * 全局文档频率(df) 分片（① df 分片化，解决运行期单表 48MB 卡顿）。
 *
 * 设计：
 *  - term 按 `fnv1a(term) & (DF_BUCKET_COUNT - 1)` 散列到固定 B=64 个桶；
 *    桶号与检索分片数 M（slug 哈希）无关，M 跳变不影响 df 桶。
 *  - 落盘：`.index/search/df/meta.json`（全局 {totalDocs, avgLen}）+
 *    `.index/search/df/bucket-NNN.json`（每桶 {n, df: Record<term, count>}）。
 *  - 消费端（Worker / CLI）只在查询时按需懒加载命中的桶，不再整表进内存。
 *
 * tokenize 空间一致性：df 桶与 BM25 打分都依赖 term 空间，必须复用 core 既有的
 * `tokenize` / `fnv1a`，不引入新的分词器。
 */
import { fnv1a } from '../util/fnv1a.js';
import { DF_BUCKET_COUNT } from '../constants.js';
import type { ShardIndex } from './inverted.js';

/** 全局检索统计里的全局参数部分（原 df.json 的 {totalDocs, avgLen}） */
export interface DfMeta {
  totalDocs: number;
  /** 全语料平均文档长度（token 数） */
  avgLen: number;
}

/** 单个 df 桶：桶号 + 该桶内 term → 全局文档频率 */
export interface DfBucket {
  n: number;
  df: Record<string, number>;
}

/**
 * term → 桶号。fnv1a 已是 32 位无符号整数，B 为 2 的幂，直接掩码即可。
 * 与 `shardOf` 同款哈希思路，但作用于 term（不是 slug），且桶数固定为 DF_BUCKET_COUNT。
 */
export function dfBucketOf(term: string): number {
  return fnv1a(term) & (DF_BUCKET_COUNT - 1);
}

/**
 * 聚合全局 df 并分桶。
 *
 * @param shards 各检索分片的 ShardIndex；`shard.index[term].length` = 该分片含 term 的文档数。
 * @returns
 *  - `meta`：全局参数 {totalDocs, avgLen}（原 df.json 的全局部分）。
 *  - `buckets`：仅含非空桶的列表（桶号即 `n`，三位补零用于文件名）。
 *
 * 全局 df[term] = Σ各分片 index[term].length；跨全语料可比，保证 BM25 分片间打分一致。
 */
export function buildDfBuckets(shards: ShardIndex[]): { meta: DfMeta; buckets: DfBucket[] } {
  // 聚合全局 df
  const globalDf = new Map<string, number>();
  for (const sh of shards) {
    for (const term of Object.keys(sh.index)) {
      globalDf.set(term, (globalDf.get(term) ?? 0) + sh.index[term].length);
    }
  }

  // 初始化 B 个桶，再按 term 哈希归桶。
  // term 全局排序后再归桶：保证同一 term→count 集合在「全量/增量、不同分片解码顺序」
  // 下产出**字节一致**的桶文件（增量复用的确定性前提）。
  const buckets: DfBucket[] = Array.from({ length: DF_BUCKET_COUNT }, (_, n) => ({ n, df: {} }));
  for (const term of [...globalDf.keys()].sort()) {
    const bucket = buckets[dfBucketOf(term)];
    bucket.df[term] = globalDf.get(term)!;
  }
  const nonEmpty = buckets.filter((b) => Object.keys(b.df).length > 0);

  // 全局参数：totalDocs = Σ分片 docs 数；avgLen = 总 token / 总文档（与 builder 的 avgDocLen 一致）
  let totalDocs = 0;
  let totalLen = 0;
  for (const sh of shards) {
    totalDocs += sh.docs.length;
    totalLen += sh.lengths.reduce((a, b) => a + b, 0);
  }
  const avgLen = totalDocs ? Math.round((totalLen / totalDocs) * 100) / 100 : 0;

  return {
    meta: { totalDocs, avgLen },
    buckets: nonEmpty,
  };
}
