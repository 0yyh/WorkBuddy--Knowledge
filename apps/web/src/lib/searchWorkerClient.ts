/**
 * L2 全文检索 Worker 的主线程客户端（P0-III）。
 *
 * 能力：
 *  - 惰性单例 worker（`new URL('./search.worker.ts', import.meta.url)`，module worker）。
 *  - 能力探测：环境不支持 Worker 或创建失败 → 判定不可用（返回明确错误，调用方走主线程兜底）。
 *  - 永久降级：worker onerror / onmessageerror / 收到 fatal → 置 degraded、terminate，
 *    此后直接 reject，**不重建 worker**。
 *  - init 只发一次（readyPromise 记忆）；分片用 sentShards 去重（幂等）。
 *  - 分片文本由本模块负责获取（fetchShardText，与主线程 loadShard 共享同一份缓存，不重复下载）。
 */
import { tokenize, dfBucketOf } from '@pks/core';
import type { SearchResultGroup } from '@pks/core';
import type { StationBundle } from './loader';
import { fetchShardText, loadDfBuckets } from './loader';
import type {
  SearchWorkerRequest,
  SearchWorkerResponse,
} from './searchWorkerProtocol';

/** Worker 不可用（能力缺失或已永久降级）时抛出的明确错误，供 loader 兜底。 */
export class WorkerUnavailableError extends Error {
  constructor(message = '检索 Worker 不可用，回退主线程') {
    super(message);
    this.name = 'WorkerUnavailableError';
  }
}

let worker: Worker | null = null;
/** 永久降级开关：一旦置位，不再尝试创建/使用 worker。 */
let degraded = false;
/** init 是否已发送。 */
let initialized = false;
/** readyPromise：init 的完成信号（记忆，只发一次 init）。 */
let readyPromise: Promise<void> | null = null;
let resolveReady: (() => void) | null = null;
let rejectReady: ((e: unknown) => void) | null = null;

/** 待回填的检索请求：id -> { resolve, reject }。 */
const pending = new Map<number, { resolve: (g: SearchResultGroup[]) => void; reject: (e: unknown) => void }>();
/** 已投喂给 worker 的分片号（幂等去重）。 */
const sentShards = new Set<number>();
let seq = 0;

/** 创建/获取 worker 单例；不可用或已降级返回 null。 */
function ensureWorker(): Worker | null {
  if (degraded) return null;
  if (worker) return worker;
  if (typeof Worker === 'undefined') {
    degraded = true;
    return null;
  }
  try {
    worker = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    degraded = true;
    worker = null;
    return null;
  }
  worker.onmessage = (e: MessageEvent<SearchWorkerResponse>): void => handleMessage(e.data);
  worker.onerror = (): void => degrade(new Error('检索 Worker 运行错误'));
  worker.onmessageerror = (): void => degrade(new Error('检索 Worker 消息反序列化失败'));
  return worker;
}

/** 永久降级：终止 worker、拒绝所有在途请求、释放等待中的 ready。 */
function degrade(err: Error): void {
  degraded = true;
  try {
    worker?.terminate();
  } catch {
    /* ignore */
  }
  worker = null;
  if (rejectReady) {
    const r = rejectReady;
    rejectReady = null;
    resolveReady = null;
    r(err);
  }
  for (const [, p] of pending) p.reject(err);
  pending.clear();
}

/** 处理 worker 回包。 */
function handleMessage(msg: SearchWorkerResponse): void {
  switch (msg.type) {
    case 'ready': {
      const r = resolveReady;
      resolveReady = null;
      rejectReady = null;
      r?.();
      break;
    }
    case 'result': {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        p.resolve(msg.groups);
      }
      break;
    }
    case 'error': {
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        p.reject(new Error(msg.message));
      }
      break;
    }
    case 'fatal': {
      degrade(new Error(msg.message));
      break;
    }
  }
}

/** 确保 init 已发送，并返回就绪信号。 */
async function ensureInitialized(bundle: StationBundle): Promise<void> {
  const w = ensureWorker();
  if (!w) throw new WorkerUnavailableError();
  if (!initialized) {
    readyPromise = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const initMessage: SearchWorkerRequest = {
      type: 'init',
      manifest: bundle.manifest,
      titleIndex: bundle.titleIndex,
      dfMeta: bundle.dfMeta,
    };
    w.postMessage(initMessage);
    initialized = true;
  }
  await readyPromise;
}

/** 确保全部分片文本已投喂给 worker（增量、幂等）。 */
async function ensureShardsSent(shardTotal: number): Promise<void> {
  const w = ensureWorker();
  if (!w) throw new WorkerUnavailableError();
  const items: Array<{ n: number; text: string }> = [];
  for (let i = 0; i < shardTotal; i++) {
    if (sentShards.has(i)) continue;
    const text = await fetchShardText(i);
    items.push({ n: i, text });
    sentShards.add(i);
  }
  if (items.length > 0) {
    const shardsMessage: SearchWorkerRequest = { type: 'shards', items };
    w.postMessage(shardsMessage);
  }
}

/**
 * 经 worker 执行 L2 全文检索。
 * 不可用/已降级/执行失败时 reject 明确错误，由 loader 兜底主线程。
 */
export async function searchViaWorker(
  bundle: StationBundle,
  query: string,
): Promise<SearchResultGroup[]> {
  const w = ensureWorker();
  if (!w) throw new WorkerUnavailableError();

  await ensureInitialized(bundle);

  // ① df 分片化：按查询词哈希算桶 → 懒加载命中桶 → 发 dfb 消息。
  // Web Worker 消息 FIFO：先发 dfb 再发 search，保证检索时 dfMap 已合并就绪。
  const qTerms = tokenize(query);
  const qIdxs = [...new Set(qTerms.map((t) => dfBucketOf(t)))];
  const dfBuckets = await loadDfBuckets(qIdxs);
  if (dfBuckets.length > 0) {
    w.postMessage({ type: 'dfb', buckets: dfBuckets });
  }

  await ensureShardsSent(bundle.manifest.search.shards);

  const id = ++seq;
  const groups = await new Promise<SearchResultGroup[]>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const current = ensureWorker();
    if (!current) {
      pending.delete(id);
      reject(new WorkerUnavailableError());
      return;
    }
    const searchMessage: SearchWorkerRequest = { type: 'search', id, query };
    current.postMessage(searchMessage);
  });

  // 供 e2e 断言「确实走了 worker」。仅在真实拿到结果后置位。
  (globalThis as { __pksSearchViaWorker?: boolean }).__pksSearchViaWorker = true;
  return groups;
}

/**
 * 预热 worker（init + 投喂全部分片），让首次全文检索零等待。
 * 失败静默 —— 预热属可选优化，不影响功能。
 */
export async function warmSearchWorker(bundle: StationBundle): Promise<void> {
  try {
    await ensureInitialized(bundle);
    await ensureShardsSent(bundle.manifest.search.shards);
  } catch {
    /* 预热失败静默：正式检索时仍会重试/兜底 */
  }
}
