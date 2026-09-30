/**
 * @pks/core/search 子路径：L2 全文检索内核所需的纯计算符号集合。
 *
 * 刻意只重导出检索链（tokenizer / bm25 / shards / inverted / fuzzy / df /
 * shard-codec / lru），不导出 markdown / wikilink / yaml 等解析或渲染模块——
 * 这些模块即使 `sideEffects: false` 下也绝不应当被打进检索 Web Worker 的 chunk
 * （worker 无 DOM，且体积敏感）。
 *
 * 检索 Worker（apps/web/src/lib/search.worker.ts）与主线程的检索调用方都应只从
 * `@pks/core/search` 引入，避免通过主 barrel `@pks/core` 误把 markdown 渲染链
 * 拉进检索 chunk / 放大 vendor-core。
 */
export { SearchEngine, SHARD_CACHE_CAPACITY } from './index/inverted.js';
export type { ShardIndex, IndexingDoc, GlobalSearchStats } from './index/inverted.js';
export { buildShards } from './index/inverted.js';
export { decodePostings, inlineIndexToMap, encodePostings } from './index/shard-codec.js';
export type { PostingsTable } from './index/shard-codec.js';
export { tokenize, termFrequencies } from './index/tokenizer.js';
export { bm25Term } from './index/bm25.js';
export { dfBucketOf, buildDfBuckets, decodeDfBucket } from './index/df.js';
export type { DfBucket } from './index/df.js';
export { buildFuzzyIndex, expandQueryFuzzy, editDistance } from './index/fuzzy.js';
export { chooseShardCount, assignShard } from './index/shards.js';
export { LRUCache } from './util/lru.js';
// DF_BUCKET_COUNT 是常量（来源 packages/core/src/constants.ts），主 barrel 也 export，
// 这里单独再 export 让检索调用方完全不必触碰主 barrel。
export { DF_BUCKET_COUNT } from './constants.js';
