/**
 * @pks/core/search 子路径：L2 全文检索内核所需的纯计算符号集合。
 *
 * 刻意只重导出检索链（inverted / shard-codec / lru），不导出 markdown / wikilink /
 * yaml 等解析或渲染模块——这些模块即使 `sideEffects: false` 下也绝不应当被打进
 * 检索 Web Worker 的 chunk（worker 无 DOM，且体积敏感）。
 *
 * 检索 Worker（apps/web/src/lib/search.worker.ts）应只从 `@pks/core/search` 引入，
 * 而非主 barrel `@pks/core`，以确保 markdown 渲染链不被拉入 worker。
 */
export { SearchEngine, SHARD_CACHE_CAPACITY } from './index/inverted.js';
export type { ShardIndex } from './index/inverted.js';
export { decodePostings, inlineIndexToMap } from './index/shard-codec.js';
export type { PostingsTable } from './index/shard-codec.js';
export { LRUCache } from './util/lru.js';
