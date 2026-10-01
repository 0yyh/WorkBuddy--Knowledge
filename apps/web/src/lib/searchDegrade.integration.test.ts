/**
 * 检索降级真实 e2e（Q-1）。
 *
 * 与 loader.test.ts 的关键区别：**不 mock `./searchWorkerClient`**，让 node 环境天然
 * 无 `Worker` 全局对象，从而真实触发 `searchViaWorker` 的永久降级（degraded），再经
 * `loader.fullTextSearch` 的 `searchOnce` 静默回落到主线程 BM25 检索。
 *
 * 这覆盖了架构评审 Q-1 明确缺失的断言：「Worker 不可用 → 主线程兜底」的真实端到端链路，
 * 而非用假 Worker 或 mock 跳过这一环。
 *
 * 三件事必须同时成立：
 *  ① fullTextSearch 在 worker 不可用时仍返回主线程检索结果（功能不回归）；
 *  ② 全程 `globalThis.__pksSearchViaWorker` 探针保持 falsy（证明没误报"走了 worker"）；
 *  ③ 直接调用 searchViaWorker 确实 reject WorkerUnavailableError（证明 worker 路径真实不可用，
 *     兜底之所以生效正是因为它，而非侥幸）。
 *
 * 依赖打桩：仅 contentCache（IndexedDB）被替换；fetch 走可控路由。语料复用 loader.test.ts。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { encodePostings } from '@pks/core/search';

// 仅打桩 IndexedDB 缓存层；检索 worker 客户端保持真实（不 mock），以触发真降级。
vi.mock('./contentCache', () => ({
  ACTIVATED_KEY: 'pks:activated',
  getMeta: vi.fn(async () => false),
  getCached: vi.fn(async () => null),
  putCached: vi.fn(async () => undefined),
  clearContentCache: vi.fn(async () => undefined),
}));

const { CONTENT_ROOT, fetchShardText, loadStation, fullTextSearch } = await import('./loader');
const { searchViaWorker } = await import('./searchWorkerClient');

/** 构造最小可用的 fetch Response（只用到 .ok / .status / .text()）。 */
function makeResponse(body: string, ok = true, status = ok ? 200 : 404): Response {
  return {
    ok,
    status,
    text: async () => body,
  } as unknown as Response;
}

// —— 语料夹具（与 loader.test.ts 同构：gamma→shard0 新格式，alpha/beta→shard1 旧格式）——
const SHARD0 = {
  shard: 0,
  docs: [{ id: 'e:gamma', kind: 'entry' as const, slug: 'gamma', title: 'Gamma', words: 2 }],
  lengths: [2],
  postings: encodePostings({ theory: new Map([[0, 1]]), set: new Map([[0, 1]]) }),
};
const SHARD1 = {
  shard: 1,
  docs: [
    { id: 'e:alpha', kind: 'entry' as const, slug: 'alpha', title: 'Alpha', words: 3 },
    { id: 'e:beta', kind: 'entry' as const, slug: 'beta', title: 'Beta', words: 1 },
  ],
  lengths: [3, 1],
  index: { graph: [[0, 2], [1, 1]] as Array<[number, number]>, theory: [[0, 1]] as Array<[number, number]> },
};
const MANIFEST = {
  schema: 1,
  generator: 'test',
  built_at: '2026-09-13T00:00:00.000Z',
  contentHash: 'test-hash',
  contentRoot: 'content/entries',
  stats: { categories: 0, entries: 3, sections: 0, words: 6, bytes: 0, shards: 2 },
  entryShards: [],
  search: { shards: 2, docs: 3, terms: 4, avgDocLen: 2 },
};
const TITLE_INDEX = [
  { slug: 'alpha', title: 'Alpha', aliases: [], type: 'concept', categoryIds: [], docId: 'e:alpha', words: 3 },
  { slug: 'beta', title: 'Beta', aliases: [], type: 'concept', categoryIds: [], docId: 'e:beta', words: 1 },
  { slug: 'gamma', title: 'Gamma', aliases: [], type: 'concept', categoryIds: [], docId: 'e:gamma', words: 2 },
];
function entryItem(s: string, t: string, w: number) {
  return { s, t, ty: 'concept', st: 'draft', w, ua: '2026-01-01', rv: 1, al: [], c: [], sc: 0, sm: '' };
}

const routes = new Map<string, string>();
const fetchMock = vi.fn(async (url: string) => {
  const body = routes.get(url);
  return body === undefined ? makeResponse('not found', false, 404) : makeResponse(body);
});

function seedRoutes(): void {
  routes.clear();
  const put = (rel: string, data: unknown): void => {
    routes.set(`${CONTENT_ROOT}/${rel}`, JSON.stringify(data));
  };
  put('index/manifest.json', MANIFEST);
  put('index/taxonomy.json', []);
  put('index/search/title.json', TITLE_INDEX);
  put('index/search/df/meta.json', { totalDocs: 3, avgLen: 2 });
  put('index/entries/a.json', { shard: 'a', items: [entryItem('alpha', 'Alpha', 3)] });
  put('index/entries/b.json', { shard: 'b', items: [entryItem('beta', 'Beta', 1)] });
  put('index/entries/g.json', { shard: 'g', items: [entryItem('gamma', 'Gamma', 2)] });
  put('index/search/s00.json', SHARD0);
  put('index/search/s01.json', SHARD1);
}

const probe = (): boolean | undefined =>
  (globalThis as { __pksSearchViaWorker?: boolean }).__pksSearchViaWorker;

describe('检索降级真实 e2e（Q-1）', () => {
  beforeEach(() => {
    seedRoutes();
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    // 强制无 Worker 全局对象：真实触发 searchViaWorker 的永久降级快路径。
    vi.stubGlobal('Worker', undefined);
    delete (globalThis as { __pksSearchViaWorker?: boolean }).__pksSearchViaWorker;
  });

  it('Worker 不可用时 fullTextSearch 静默降级主线程，仍返回检索结果', async () => {
    const bundle = await loadStation();
    const groups = await fullTextSearch(bundle, 'theory');

    expect(groups.length).toBeGreaterThan(0);
    expect(groups.map((g) => g.entry.slug).sort()).toEqual(['alpha', 'gamma']);
  });

  it('降级期间 __pksSearchViaWorker 探针保持 falsy（不得误报"走了 worker"）', async () => {
    const bundle = await loadStation();
    await fullTextSearch(bundle, 'theory');

    expect(probe()).toBeFalsy();
  });

  it('searchViaWorker 直接拒绝 WorkerUnavailableError（worker 路径真实不可用）', async () => {
    const bundle = await loadStation();
    await expect(searchViaWorker(bundle, 'theory')).rejects.toMatchObject({
      name: 'WorkerUnavailableError',
    });
  });

  it('零命中词也走主线程兜底返回空数组，不抛错（功能不回归）', async () => {
    const bundle = await loadStation();
    expect(await fullTextSearch(bundle, 'nonexistentterm')).toEqual([]);
    expect(probe()).toBeFalsy();
  });
});
