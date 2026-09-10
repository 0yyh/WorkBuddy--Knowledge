/**
 * L2 全文检索 Web Worker（P0-III）。
 *
 * 职责：把「分片解码（base64 + fflate inflate + varint 解析）+ BM25 扫描 + 分组」
 * 整段移出主线程。主线程只需 fetch 原始分片文本并投喂进来。
 *
 * 与 loader.ts 的语义严格对齐：
 *  - 分片线上格式 `WireShardIndex` 一致（`postings` 优先，旧产物回落内联 `index`）。
 *  - 组装出的 `ShardIndex` 与主线程 `shardCache` 中的完全同构。
 *
 * 注意：本文件不引入 `/// <reference lib="webworker" />`（会与 tsconfig 的 DOM lib 冲突），
 * 改为用一个最小结构类型断言 `self`。
 */
// ⚠️ 必须第一个 import：在任何 @pks/core 模块体求值前注入最小 document 垫片。
// 原因见 workerDocumentShim.ts（@pks/core 的 markdown 链含一处 module-scope `document.createElement`，
// worker 无 document 会直接抛错导致 worker 启动失败）。不要调整下面这行的顺序。
import './workerDocumentShim';
import { SearchEngine, decodePostings } from '@pks/core';
import type { ShardIndex } from '@pks/core';
import type {
  SearchWorkerRequest,
  SearchWorkerResponse,
} from './searchWorkerProtocol';

/** 检索分片线上格式（与 apps/web/src/lib/loader.ts 的 WireShardIndex 保持一致） */
interface WireShardIndex {
  shard: number;
  docs: ShardIndex['docs'];
  lengths: number[];
  /** 新格式：base64(varint 差分 + zlib) 的倒排表 */
  postings?: string;
  /** 旧格式：内联展开的倒排表（向后兼容） */
  index?: ShardIndex['index'];
}

/** 不去引 webworker lib；用最小结构类型断言 worker 全局上下文。 */
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<SearchWorkerRequest>) => void) | null;
  postMessage: (message: SearchWorkerResponse) => void;
  onerror: ((e: unknown) => void) | null;
};

/** 解码后的分片表（与主线程 shardCache 同构） */
const decoded = new Map<number, ShardIndex>();
let engine: SearchEngine | null = null;

function reply(message: SearchWorkerResponse): void {
  ctx.postMessage(message);
}

/** 将线上 wire 分片文本解码为 ShardIndex（含旧产物 index 兜底）。 */
function decodeWire(text: string): ShardIndex {
  const wire = JSON.parse(text) as WireShardIndex;
  const index: ShardIndex['index'] = wire.postings
    ? decodePostings(wire.postings)
    : (wire.index ?? {});
  return {
    shard: wire.shard,
    docs: wire.docs,
    lengths: wire.lengths,
    index,
  };
}

ctx.onmessage = (e: MessageEvent<SearchWorkerRequest>): void => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case 'init': {
        const stats = msg.stats
          ? {
              totalDocs: msg.stats.totalDocs,
              avgLen: msg.stats.avgLen,
              df: new Map<string, number>(Object.entries(msg.stats.df)),
            }
          : undefined;
        engine = new SearchEngine(
          msg.manifest,
          msg.titleIndex,
          (shard: number): ShardIndex | null => decoded.get(shard) ?? null,
          stats,
        );
        reply({ type: 'ready' });
        break;
      }

      case 'shards': {
        for (const item of msg.items) {
          decoded.set(item.n, decodeWire(item.text));
        }
        break;
      }

      case 'search': {
        if (!engine) {
          reply({ type: 'error', id: msg.id, message: '检索引擎尚未初始化' });
          break;
        }
        // 分片可能尚未全部到达：SearchEngine.searchL2 对缺失分片返回 null 并跳过，
        // 因此按已有分片尽力检索，不抛错。
        const t0 = performance.now();
        const hits = engine.searchL2(msg.query);
        const groups = engine.groupByEntry(hits);
        const tookMs = Math.round(performance.now() - t0);
        reply({ type: 'result', id: msg.id, groups, hitCount: hits.length, tookMs });
        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (msg.type === 'search') {
      // 单次检索失败：让调用方降级，但 worker 仍可用
      reply({ type: 'error', id: msg.id, message });
    } else {
      // init / shards 阶段失败：致命，通知主线程彻底降级
      reply({ type: 'fatal', message });
    }
  }
};

// 冗余兜底：worker 内任何未捕获异常都不至于静默。
ctx.onerror = (e: unknown): void => {
  const message = e instanceof Error ? e.message : String(e);
  reply({ type: 'fatal', message: `worker 运行错误：${message}` });
};
