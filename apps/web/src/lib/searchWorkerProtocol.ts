/**
 * L2 全文检索 Worker 的消息协议（P0-III）。
 * worker 与 client 共同 import 本文件，保证 request/response 联合类型一致。
 *
 * 设计要点：
 *  - 主线程只负责「fetch 原始分片文本 + 消息收发」，解码与 BM25 扫描全部在 worker 内完成。
 *  - 分片文本走主线程的缓存优先链路（fetchText），从而局域网 OTA 更新过的内容仍可检索。
 */
import type { IndexManifest, SearchResultGroup, TitleIndexItem } from '@pks/core';

/** Worker init 用全局 BM25 全局参数（与 loader 的 dfMeta 对齐；缺失为 null → 分片内 BM25）。
 *  ① df 分片化后不再整表传 df：全量 df 由按需 `dfb` 消息懒加载。 */
export interface SearchWorkerDfMeta {
  totalDocs: number;
  avgLen: number;
}

/** 主 → worker：初始化引擎（发送一次） */
export interface SearchWorkerInitRequest {
  type: 'init';
  manifest: IndexManifest;
  titleIndex: TitleIndexItem[];
  dfMeta: SearchWorkerDfMeta | null;
}

/** 主 → worker：投喂原始分片 JSON 文本（可增量多次发送） */
export interface SearchWorkerShardsRequest {
  type: 'shards';
  items: Array<{ n: number; text: string }>;
}

/** 主 → worker：投喂检索所需的 df 桶（已按查询词哈希算桶，按需懒加载）。
 *  worker 合并进内部 dfMap 供 BM25 打分。 */
export interface SearchWorkerDfbRequest {
  type: 'dfb';
  buckets: Array<{ n: number; df: Record<string, number> }>;
}

/** 主 → worker：执行一次全文检索 */
export interface SearchWorkerSearchRequest {
  type: 'search';
  id: number;
  query: string;
}

export type SearchWorkerRequest =
  | SearchWorkerInitRequest
  | SearchWorkerShardsRequest
  | SearchWorkerDfbRequest
  | SearchWorkerSearchRequest;

/** worker → 主：引擎就绪 */
export interface SearchWorkerReadyResponse {
  type: 'ready';
}

/** worker → 主：检索结果 */
export interface SearchWorkerResultResponse {
  type: 'result';
  id: number;
  groups: SearchResultGroup[];
  hitCount: number;
  tookMs: number;
}

/** worker → 主：单次检索失败（可继续用） */
export interface SearchWorkerErrorResponse {
  type: 'error';
  id: number;
  message: string;
}

/** worker → 主：致命错误（应降级主线程） */
export interface SearchWorkerFatalResponse {
  type: 'fatal';
  message: string;
}

export type SearchWorkerResponse =
  | SearchWorkerReadyResponse
  | SearchWorkerResultResponse
  | SearchWorkerErrorResponse
  | SearchWorkerFatalResponse;
