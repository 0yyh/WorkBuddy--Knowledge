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
import { SearchEngine, decodePostings, LRUCache, SHARD_CACHE_CAPACITY } from '@pks/core';
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

/** 解码后的分片表（与主线程 shardCache 同构）。P0-2：改 LRU 有界，检索完成后仅保留最近使用的有限个分片。 */
const decoded = new LRUCache<number, ShardIndex>(SHARD_CACHE_CAPACITY);
/** 主线程投喂的原始分片 JSON 文本（LRU 解码前的源；按 shard 唯一，总量=分片数，体积很小）。 */
const shardTexts = new Map<number, string>();
let engine: SearchEngine | null = null;

/**
 * ① df 分片化：Worker 内全局 df（term → 全局文档频率）。
 * 与 engine.stats.df 持有同一 Map 引用；收到 `dfb` 消息时增量合并进此 Map，
 * 引擎无需重建即可看到最新 df。仅在查询词命中的桶被懒加载后填充。
 */
const dfMap = new Map<string, number>();

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
        // ① df 分片化：init 只建全局参数（totalDocs/avgLen）；全量 df 由后续 dfb 消息按需合并。
        // dfMap 与 engine.stats.df 共用同一引用，故 dfb 增量写入对引擎立即可见。
        const stats = msg.dfMeta
          ? { totalDocs: msg.dfMeta.totalDocs, avgLen: msg.dfMeta.avgLen, df: dfMap }
          : undefined;
        engine = new SearchEngine(
          msg.manifest,
          msg.titleIndex,
          async (shard: number): Promise<ShardIndex | null> => {
            // P0-2：on-demand 解码——命中 LRU 直接返回；否则从主线程投喂的原始文本解码后回填 LRU。
            const hit = decoded.get(shard);
            if (hit) return hit;
            const text = shardTexts.get(shard);
            if (text === undefined) return null;
            const d = decodeWire(text);
            decoded.set(shard, d);
            return d;
          },
          stats,
        );
        reply({ type: 'ready' });
        break;
      }

      case 'dfb': {
        // 合并各桶 df 进 dfMap（同引用对 engine 可见）。Worker 复用，跨查询累积命中词的 df。
        for (const bucket of msg.buckets) {
          for (const [term, count] of Object.entries(bucket.df)) dfMap.set(term, count);
        }
        break;
      }

      case 'shards': {
        // P0-2：只暂存原始文本，解码推迟到 searchL2 逐分片 on-demand（LRU 有界）。
        // 不再在此处全量解码，避免 256 分片常驻 +30–50MB。
        for (const item of msg.items) {
          shardTexts.set(item.n, item.text);
        }
        break;
      }

      case 'search': {
        if (!engine) {
          reply({ type: 'error', id: msg.id, message: '检索引擎尚未初始化' });
          break;
        }
        // searchL2 现 async：逐分片 on-demand 解码（经 LRU）；缺失分片返回 null 并被跳过，不抛错。
        // 用 async IIFE 包裹，保持 onmessage 同步签名（ctx 类型要求返回 void）。
        void (async (): Promise<void> => {
          try {
            const t0 = performance.now();
            const hits = await engine!.searchL2(msg.query);
            const groups = engine!.groupByEntry(hits);
            const tookMs = Math.round(performance.now() - t0);
            reply({ type: 'result', id: msg.id, groups, hitCount: hits.length, tookMs });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            reply({ type: 'error', id: msg.id, message });
          }
        })();
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
