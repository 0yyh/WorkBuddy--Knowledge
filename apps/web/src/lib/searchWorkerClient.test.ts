/**
 * searchWorkerClient 单元测试（P2-11）。
 *
 * 覆盖 Worker 路径的三件关键事：
 *  ① 能力探测与**永久降级**：`Worker` 缺失 → 抛 WorkerUnavailableError 且不重建；
 *     worker 回报 fatal → 置 degraded 后同样不再重建（避免反复失败拖慢每次检索）。
 *  ② 消息协议形状：init / shards / search 三类请求的字段与发送顺序。
 *  ③ `__pksSearchViaWorker` 探针语义：只有在**真的拿到 worker 结果**后才置真，
 *     降级路径绝不允许置真（否则 e2e 的"确实走了 worker"断言会被误骗过）。
 *
 * ⚠ 本模块持有模块级可变状态（degraded / initialized / sentShards / pending / seq），
 *    因此每个用例都必须 `vi.resetModules()` + 动态 import 取一份全新实例，否则互相污染。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// 打断 loader <-> searchWorkerClient 的循环依赖，并让分片文本可控
vi.mock('./loader', () => ({
  fetchShardText: vi.fn(async (n: number) => `shard-text-${n}`),
  loadDfBuckets: vi.fn(async () => []),
}));

/** 可捕获 postMessage 的假 Worker。 */
class FakeWorker {
  static instances: FakeWorker[] = [];
  posted: Array<Record<string, unknown>> = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;

  constructor(_url: unknown, _opts?: unknown) {
    FakeWorker.instances.push(this);
  }

  postMessage(msg: Record<string, unknown>): void {
    this.posted.push(msg);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** 测试辅助：模拟 worker 向主线程回包。 */
  emit(data: unknown): void {
    this.onmessage?.({ data });
  }

  last(type: string): Record<string, unknown> | undefined {
    return [...this.posted].reverse().find((m) => m.type === type);
  }
}

const GROUPS = [
  { entry: { slug: 'alpha', title: 'Alpha', type: 'concept' }, hits: [], total: 1 },
];

function makeBundle() {
  return {
    manifest: { search: { shards: 2, docs: 3, terms: 4, avgDocLen: 2 } },
    titleIndex: [{ slug: 'alpha', title: 'Alpha', aliases: [], type: 'concept', categoryIds: [], docId: 'e:alpha', words: 3 }],
    dfMeta: { totalDocs: 3, avgLen: 2 },
  } as never;
}

/** 轮询等待条件成立（替代固定 sleep，避免时序脆弱）。 */
async function waitFor(pred: () => boolean, label = 'condition', timeout = 2000): Promise<void> {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeout) throw new Error(`waitFor 超时：${label}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** 取一份全新的 searchWorkerClient 模块实例（清空其模块级状态）。 */
async function freshClient(): Promise<typeof import('./searchWorkerClient')> {
  vi.resetModules();
  return await import('./searchWorkerClient');
}

const probe = (): boolean | undefined =>
  (globalThis as { __pksSearchViaWorker?: boolean }).__pksSearchViaWorker;

describe('能力探测与永久降级', () => {
  beforeEach(() => {
    FakeWorker.instances.length = 0;
    delete (globalThis as { __pksSearchViaWorker?: boolean }).__pksSearchViaWorker;
  });

  it('Worker 缺失时抛 WorkerUnavailableError，且不创建任何 Worker', async () => {
    vi.stubGlobal('Worker', undefined);
    const mod = await freshClient();

    await expect(mod.searchViaWorker(makeBundle(), 'graph')).rejects.toMatchObject({
      name: 'WorkerUnavailableError',
    });
    expect(FakeWorker.instances.length).toBe(0);
    // 降级期间探针绝不能置真
    expect(probe()).toBeFalsy();
  });

  it('worker 回报 fatal 后永久降级：在途请求被拒，且不再重建 Worker', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const mod = await freshClient();

    const p = mod.searchViaWorker(makeBundle(), 'graph');
    await waitFor(() => FakeWorker.instances[0]?.posted.some((m) => m.type === 'init'), 'init 已发送');

    FakeWorker.instances[0].emit({ type: 'fatal', message: 'worker 崩溃' });
    await expect(p).rejects.toThrow(/worker 崩溃/);

    const countBefore = FakeWorker.instances.length;
    // 再次调用应立即失败（走 degraded 快路径），且不 new Worker
    await expect(mod.searchViaWorker(makeBundle(), 'graph')).rejects.toMatchObject({
      name: 'WorkerUnavailableError',
    });
    expect(FakeWorker.instances.length).toBe(countBefore);
  });

  it('worker 构造抛错时降级，不向上冒泡', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('CSP 阻止创建 Worker');
        }
      },
    );
    const mod = await freshClient();

    await expect(mod.searchViaWorker(makeBundle(), 'graph')).rejects.toMatchObject({
      name: 'WorkerUnavailableError',
    });
  });

  it('warmSearchWorker 失败静默（预热属可选优化，不得影响调用方）', async () => {
    vi.stubGlobal('Worker', undefined);
    const mod = await freshClient();

    await expect(mod.warmSearchWorker(makeBundle())).resolves.toBeUndefined();
  });
});

describe('消息协议形状与顺序', () => {
  beforeEach(() => {
    FakeWorker.instances.length = 0;
    delete (globalThis as { __pksSearchViaWorker?: boolean }).__pksSearchViaWorker;
  });

  it('init → shards → search 依次发出，字段完整', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const mod = await freshClient();

    const p = mod.searchViaWorker(makeBundle(), 'graph');
    await waitFor(() => FakeWorker.instances[0]?.posted.some((m) => m.type === 'init'), 'init');

    const w = FakeWorker.instances[0];
    const init = w.last('init') as { type: string; manifest: unknown; titleIndex: unknown; dfMeta: unknown };
    expect(init.type).toBe('init');
    expect(init.manifest).toMatchObject({ search: { shards: 2 } });
    expect(Array.isArray(init.titleIndex)).toBe(true);
    expect(init.dfMeta).toEqual({ totalDocs: 3, avgLen: 2 });

    // 回 ready，让流程继续走到 shards / search
    w.emit({ type: 'ready' });
    await waitFor(() => w.posted.some((m) => m.type === 'search'), 'search');

    const shards = w.last('shards') as { type: string; items: Array<{ n: number; text: string }> };
    expect(shards.type).toBe('shards');
    expect(shards.items).toEqual([
      { n: 0, text: 'shard-text-0' },
      { n: 1, text: 'shard-text-1' },
    ]);

    const search = w.last('search') as { type: string; id: number; query: string };
    expect(search.type).toBe('search');
    expect(search.query).toBe('graph');
    expect(typeof search.id).toBe('number');
    expect(search.id).toBeGreaterThan(0);

    // 发回 result，请求应 resolve
    w.emit({ type: 'result', id: search.id, groups: GROUPS, hitCount: 1, tookMs: 2 });
    await expect(p).resolves.toEqual(GROUPS);
  });

  it('init 只发一次（记忆 readyPromise），即便多次检索', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const mod = await freshClient();

    const p1 = mod.searchViaWorker(makeBundle(), 'graph');
    await waitFor(() => FakeWorker.instances[0]?.posted.some((m) => m.type === 'init'), 'init');
    FakeWorker.instances[0].emit({ type: 'ready' });
    await waitFor(() => FakeWorker.instances[0]?.posted.some((m) => m.type === 'search'), 'search#1');
    const w = FakeWorker.instances[0];
    const id1 = (w.last('search') as { id: number }).id;
    w.emit({ type: 'result', id: id1, groups: GROUPS, hitCount: 1, tookMs: 1 });
    await p1;

    const p2 = mod.searchViaWorker(makeBundle(), 'theory');
    await waitFor(() => (w.last('search') as { id: number })?.id !== id1, 'search#2');
    const id2 = (w.last('search') as { id: number }).id;
    w.emit({ type: 'result', id: id2, groups: [], hitCount: 0, tookMs: 1 });
    await p2;

    expect(w.posted.filter((m) => m.type === 'init').length).toBe(1);
    // 分片已投喂过 → 第二次不再重发
    expect(w.posted.filter((m) => m.type === 'shards').length).toBe(1);
    // 请求 id 自增，保证回包能正确路由
    expect(id2).toBeGreaterThan(id1);
  });

  it('拿到真实结果后 __pksSearchViaWorker 探针置真', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const mod = await freshClient();

    const p = mod.searchViaWorker(makeBundle(), 'graph');
    await waitFor(() => FakeWorker.instances[0]?.posted.some((m) => m.type === 'init'), 'init');
    const w = FakeWorker.instances[0];
    w.emit({ type: 'ready' });
    await waitFor(() => w.posted.some((m) => m.type === 'search'), 'search');
    const id = (w.last('search') as { id: number }).id;

    // 尚未回包时探针不应为真
    expect(probe()).toBeFalsy();

    w.emit({ type: 'result', id, groups: GROUPS, hitCount: 1, tookMs: 1 });
    await p;

    expect(probe()).toBe(true);
  });

  it('worker 回报 error 时仅该次请求失败，不触发全局降级', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    const mod = await freshClient();

    const p = mod.searchViaWorker(makeBundle(), 'graph');
    await waitFor(() => FakeWorker.instances[0]?.posted.some((m) => m.type === 'init'), 'init');
    const w = FakeWorker.instances[0];
    w.emit({ type: 'ready' });
    await waitFor(() => w.posted.some((m) => m.type === 'search'), 'search');
    const id = (w.last('search') as { id: number }).id;

    w.emit({ type: 'error', id, message: '分片解码失败' });
    await expect(p).rejects.toThrow(/分片解码失败/);

    // 未置 degraded：仍可继续检索（Worker 未被 terminate）
    expect(w.terminated).toBe(false);
  });
});
