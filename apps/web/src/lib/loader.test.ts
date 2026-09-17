/**
 * loader 单元测试（P2-11）。
 *
 * 覆盖此前的盲区（apps/web 端零测试）：
 *  - `fetchShardText`：URL 拼装 / 进程内缓存 / 并发单飞去重。
 *  - `loadShard` 的**两种线上格式**：P0-I 起的 base64 `postings` 与旧产物内联 `index`
 *    （后者走 `inlineIndexToMap`）——两条解码路径都在真实装载链路里被验证。
 *  - `fullTextSearch` 在 Worker 不可用时的**主线程兜底**，以及降级期间
 *    `window.__pksSearchViaWorker` 探针保持为假（不得误报"走了 worker"）。
 *
 * 依赖全部打桩：contentCache（IndexedDB）与 searchWorkerClient 均被 vi.mock 替换，
 * 只让 fetch 走可控路由，从而把被测面收敛到 loader 自身。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { encodePostings } from '@pks/core';

// —— 依赖打桩（vi.mock 会被提升，必须在 import 被测模块前声明）——
vi.mock('./contentCache', () => ({
  ACTIVATED_KEY: 'pks:activated',
  getMeta: vi.fn(async () => false), // 缓存未激活 → 直接走随包资源
  getCached: vi.fn(async () => null),
  putCached: vi.fn(async () => undefined),
  clearContentCache: vi.fn(async () => undefined),
}));

vi.mock('./searchWorkerClient', () => ({
  // 模拟「Worker 不可用」：检索请求一律失败，迫使 loader 走主线程兜底。
  searchViaWorker: vi.fn(async () => {
    throw new Error('WorkerUnavailableError: 测试环境无 Worker');
  }),
  warmSearchWorker: vi.fn(async () => undefined),
}));

const { CONTENT_ROOT, fetchShardText, loadStation, fullTextSearch } = await import('./loader');

/** 构造一个最小可用的 fetch Response（只用到 .ok / .status / .text()）。 */
function makeResponse(body: string, ok = true, status = ok ? 200 : 404): Response {
  return {
    ok,
    status,
    text: async () => body,
  } as unknown as Response;
}

/** 可控 fetch 路由表：相对路径前缀 -> 响应体。 */
const routes = new Map<string, string>();
const fetchMock = vi.fn(async (url: string) => {
  const body = routes.get(url);
  return body === undefined ? makeResponse('not found', false, 404) : makeResponse(body);
});

// ——— 语料夹具 ———
// slug -> 分片（fnv1a & (2-1)）：gamma=0，alpha=1，beta=1（已用 node 实测确认）
// shard 0 故意用**新格式**（base64 postings）
// shard 1 故意用**旧格式**（内联 index），从而一次检索同时覆盖两条解码路径。

const SHARD0 = {
  shard: 0,
  docs: [
    { id: 'e:gamma', kind: 'entry' as const, slug: 'gamma', title: 'Gamma', words: 2 },
  ],
  lengths: [2],
  postings: encodePostings({
    theory: new Map([[0, 1]]),
    set: new Map([[0, 1]]),
  }),
};

const SHARD1 = {
  shard: 1,
  docs: [
    { id: 'e:alpha', kind: 'entry' as const, slug: 'alpha', title: 'Alpha', words: 3 },
    { id: 'e:beta', kind: 'entry' as const, slug: 'beta', title: 'Beta', words: 1 },
  ],
  lengths: [3, 1],
  // 旧格式：内联倒排表（term -> [docId, tf][]）
  index: {
    graph: [[0, 2], [1, 1]] as Array<[number, number]>,
    theory: [[0, 1]] as Array<[number, number]>,
  },
};

const MANIFEST = {
  schema: 1,
  generator: 'test',
  built_at: '2026-09-13T00:00:00.000Z',
  contentHash: 'test-hash',
  contentRoot: 'content/entries',
  stats: { categories: 0, entries: 3, sections: 0, words: 6, bytes: 0, shards: 2 },
  // entryShards 留空：验证 loader 从 titleIndex 推导首字母的兜底逻辑
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

function seedRoutes(): void {
  routes.clear();
  const put = (rel: string, data: unknown): void => {
    routes.set(`${CONTENT_ROOT}/${rel}`, JSON.stringify(data));
  };

  put('index/manifest.json', MANIFEST);
  put('index/taxonomy.json', []);
  put('index/search/title.json', TITLE_INDEX);
  put('index/search/df/meta.json', { totalDocs: 3, avgLen: 2 });

  // entryShards 为空 → 由 titleIndex 推导首字母 a / b / g
  put('index/entries/a.json', { shard: 'a', items: [entryItem('alpha', 'Alpha', 3)] });
  put('index/entries/b.json', { shard: 'b', items: [entryItem('beta', 'Beta', 1)] });
  put('index/entries/g.json', { shard: 'g', items: [entryItem('gamma', 'Gamma', 2)] });

  put('index/search/s00.json', SHARD0); // 新格式
  put('index/search/s01.json', SHARD1); // 旧格式
  put('index/search/s05.json', { shard: 5, docs: [], lengths: [], postings: encodePostings({}) });
  put('index/search/s09.json', { shard: 9, docs: [], lengths: [], postings: encodePostings({}) });
}

const urlOf = (rel: string): string => `${CONTENT_ROOT}/${rel}`;

describe('fetchShardText（分片原始文本：缓存 + 单飞）', () => {
  beforeEach(() => {
    seedRoutes();
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('按 sNN.json 两位补零拼装 URL，并返回原始文本', async () => {
    const text = await fetchShardText(0);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(urlOf('index/search/s00.json'));
    expect(JSON.parse(text)).toMatchObject({ shard: 0 });
  });

  it('补零规则：个位分片号补成两位', async () => {
    await fetchShardText(5);
    expect(fetchMock.mock.calls[0][0]).toBe(urlOf('index/search/s05.json'));
  });

  it('二次调用命中缓存，不再发起网络请求', async () => {
    await fetchShardText(0);
    const afterFirst = fetchMock.mock.calls.length;

    const again = await fetchShardText(0);

    expect(fetchMock.mock.calls.length).toBe(afterFirst); // 无新增请求
    expect(again).toBe(await fetchShardText(0)); // 同一份文本
  });

  it('并发调用同一分片只下载一次（在途请求去重）', async () => {
    const [a, b] = await Promise.all([fetchShardText(9), fetchShardText(9)]);

    expect(a).toBe(b);
    expect(fetchMock.mock.calls.filter((c) => c[0] === urlOf('index/search/s09.json')).length).toBe(1);
  });
});

describe('loadShard 双格式解码（新 postings / 旧 index）', () => {
  beforeEach(() => {
    seedRoutes();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('一次检索同时命中新格式分片与旧格式分片，两条解码路径均产出结果', async () => {
    const bundle = await loadStation();

    // theory 同时存在于 shard 0（新 base64 postings）与 shard 1（旧内联 index）
    const groups = await fullTextSearch(bundle, 'theory');
    const slugs = groups.map((g) => g.entry.slug).sort();

    expect(slugs).toEqual(['alpha', 'gamma']);
    // gamma 来自新格式分片，alpha 来自旧格式分片 —— 缺任一条解码路径都会少一个
    expect(slugs).toContain('gamma');
    expect(slugs).toContain('alpha');
  });

  it('仅存在于旧格式分片的词（graph）也能检出，且短文档排序在前', async () => {
    const bundle = await loadStation();
    const groups = await fullTextSearch(bundle, 'graph');

    expect(groups.map((g) => g.entry.slug).sort()).toEqual(['alpha', 'beta']);
    expect(groups[0].hits.length).toBeGreaterThan(0);
  });

  it('未命中词返回空数组，不抛错', async () => {
    const bundle = await loadStation();
    expect(await fullTextSearch(bundle, 'nonexistentterm')).toEqual([]);
  });
});

describe('Worker 降级兜底', () => {
  beforeEach(() => {
    seedRoutes();
    vi.stubGlobal('fetch', fetchMock);
    // 确保探针为干净初始态
    delete (globalThis as { __pksSearchViaWorker?: boolean }).__pksSearchViaWorker;
  });

  it('Worker 不可用时静默降级主线程，仍返回检索结果', async () => {
    const bundle = await loadStation();
    const groups = await fullTextSearch(bundle, 'theory');

    expect(groups.length).toBeGreaterThan(0);
  });

  it('降级期间 __pksSearchViaWorker 探针不得置真（避免 e2e 误判"走了 worker"）', async () => {
    const bundle = await loadStation();
    await fullTextSearch(bundle, 'theory');

    expect((globalThis as { __pksSearchViaWorker?: boolean }).__pksSearchViaWorker).toBeFalsy();
  });

  it('空查询/纯空白直接返回空数组，不触发任何检索', async () => {
    const bundle = await loadStation();

    expect(await fullTextSearch(bundle, '')).toEqual([]);
    expect(await fullTextSearch(bundle, '   ')).toEqual([]);
  });
});

describe('loadStation 首字母推导兜底', () => {
  beforeEach(() => {
    seedRoutes();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('manifest.entryShards 为空时，由 titleIndex 推导首字母并装载全部词条', async () => {
    const bundle = await loadStation();

    expect([...bundle.slugMap.keys()].sort()).toEqual(['alpha', 'beta', 'gamma']);
    expect(bundle.dfMeta).toEqual({ totalDocs: 3, avgLen: 2 });
  });

  it('loadStation 幂等：多次调用返回同一 bundle', async () => {
    const a = await loadStation();
    const b = await loadStation();
    expect(a).toBe(b);
  });
});

describe('loadStation 哈希分片主路径（entryShards 已填充）', () => {
  beforeEach(() => {
    routes.clear();
    const put = (rel: string, data: unknown): void => {
      routes.set(`${CONTENT_ROOT}/${rel}`, JSON.stringify(data));
    };
    // 新产物：manifest 自带 entryShards（P1-2 哈希分桶名），无需首字母兜底。
    put('index/manifest.json', { ...MANIFEST, entryShards: ['00', '01', '02'] });
    put('index/taxonomy.json', []);
    put('index/search/title.json', TITLE_INDEX);
    put('index/search/df/meta.json', { totalDocs: 3, avgLen: 2 });
    put('index/entries/00.json', { shard: '00', items: [entryItem('alpha', 'Alpha', 3)] });
    put('index/entries/01.json', { shard: '01', items: [entryItem('beta', 'Beta', 1)] });
    put('index/entries/02.json', { shard: '02', items: [entryItem('gamma', 'Gamma', 2)] });
    put('index/search/s00.json', SHARD0);
    put('index/search/s01.json', SHARD1);
    vi.stubGlobal('fetch', fetchMock);
  });

  it('manifest 自带 entryShards 时直接按分片名装载，无需首字母兜底', async () => {
    const bundle = await loadStation();
    expect([...bundle.slugMap.keys()].sort()).toEqual(['alpha', 'beta', 'gamma']);
  });
});
