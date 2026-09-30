/**
 * P2-F：searchCache LRU 不变式。
 *
 * 模块级单例缓存，测试间用 `clearSearchResultCache()` 隔离状态。
 * mock 策略：vi.mock('../lib/loader') → 只劫持 fullTextSearch，其它保留原行为。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/loader', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/loader')>();
  return {
    ...mod,
    fullTextSearch: vi.fn(),
  };
});

import type { IndexManifest, StationBundle } from '../lib/loader';
import { cachedFullTextSearch, clearSearchResultCache } from '../lib/searchCache';
import { fullTextSearch } from '../lib/loader';

const mockedFullTextSearch = vi.mocked(fullTextSearch);

function makeBundle(contentHash: string): StationBundle {
  const manifest = { contentHash } as unknown as IndexManifest;
  return {
    manifest,
    taxonomy: [],
    titleIndex: [],
    slugMap: new Map(),
    engine: {} as StationBundle['engine'],
    dfMeta: { totalDocs: 0, avgLen: 0 },
    dfMap: new Map(),
  };
}

beforeEach(() => {
  clearSearchResultCache();
  mockedFullTextSearch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cachedFullTextSearch · 缓存命中与失效', () => {
  it('同 query 二次调用：第二次直接命中缓存，fullTextSearch 只调一次', async () => {
    const bundle = makeBundle('hash-A');
    const result = [{ entry: { slug: 'x', title: 'X', type: 'concept' }, hits: [], total: 1 }];
    mockedFullTextSearch.mockResolvedValue(result);

    const r1 = await cachedFullTextSearch(bundle, '康德');
    const r2 = await cachedFullTextSearch(bundle, '康德');

    expect(r1).toBe(result);
    expect(r2).toBe(result); // 返回同一引用（来自缓存）
    expect(mockedFullTextSearch).toHaveBeenCalledTimes(1);
  });

  it('空 / 纯空白 query 立即返回 []，不调 fullTextSearch', async () => {
    const bundle = makeBundle('hash-A');
    expect(await cachedFullTextSearch(bundle, '')).toEqual([]);
    expect(await cachedFullTextSearch(bundle, '   ')).toEqual([]);
    expect(mockedFullTextSearch).not.toHaveBeenCalled();
  });

  it('查询字符串 trim：trim 后相同的 query 视为同一缓存键', async () => {
    const bundle = makeBundle('hash-A');
    const result: Awaited<ReturnType<typeof cachedFullTextSearch>> = [];
    mockedFullTextSearch.mockResolvedValue(result);

    await cachedFullTextSearch(bundle, ' 康德 ');
    await cachedFullTextSearch(bundle, '康德');
    await cachedFullTextSearch(bundle, '  康德');

    expect(mockedFullTextSearch).toHaveBeenCalledTimes(1);
  });

  it('bundle.manifest.contentHash 变化 → 缓存自然失效', async () => {
    const bundleA = makeBundle('hash-A');
    const bundleB = makeBundle('hash-B');
    mockedFullTextSearch.mockResolvedValue([]);

    await cachedFullTextSearch(bundleA, '康德');
    await cachedFullTextSearch(bundleA, '康德'); // 命中缓存
    await cachedFullTextSearch(bundleB, '康德'); // hash 变 → 必须重算

    expect(mockedFullTextSearch).toHaveBeenCalledTimes(2);
  });

  it('失败不入缓存：同一 query 第二次仍会重试 fullTextSearch', async () => {
    const bundle = makeBundle('hash-A');
    mockedFullTextSearch.mockRejectedValueOnce(new Error('boom'));

    await expect(cachedFullTextSearch(bundle, '康德')).rejects.toThrow('boom');
    mockedFullTextSearch.mockResolvedValueOnce([]);
    await cachedFullTextSearch(bundle, '康德'); // 失败后必须重试

    expect(mockedFullTextSearch).toHaveBeenCalledTimes(2);
  });
});

describe('cachedFullTextSearch · LRU 上限 20', () => {
  it('第 21 个不同 query 进来时，第 1 个被淘汰', async () => {
    const bundle = makeBundle('hash-A');
    mockedFullTextSearch.mockResolvedValue([]);

    // 21 个不同 query 各跑一次
    for (let i = 0; i < 21; i++) {
      await cachedFullTextSearch(bundle, `q${i}`);
    }
    // 此时 q0 应已被淘汰；再访问 q0 必须重算（fullTextSearch 多调一次）
    await cachedFullTextSearch(bundle, 'q0');

    expect(mockedFullTextSearch).toHaveBeenCalledTimes(22);
  });

  it('访问已缓存的旧 query 会刷新 LRU 顺序，避免被淘汰', async () => {
    const bundle = makeBundle('hash-A');
    mockedFullTextSearch.mockResolvedValue([]);

    // 装满 20 个：q0..q19
    for (let i = 0; i < 20; i++) {
      await cachedFullTextSearch(bundle, `q${i}`);
    }
    // 触达 q0 → 把它刷到最新
    await cachedFullTextSearch(bundle, 'q0');
    // 再装一个新 q20 → q1 被淘汰（不是 q0）
    await cachedFullTextSearch(bundle, 'q20');
    // q0 仍命中缓存
    await cachedFullTextSearch(bundle, 'q0');
    // q1 已淘汰，必须重算
    await cachedFullTextSearch(bundle, 'q1');

    // 期望：q0..q19(20) + q20(1) + q1 已淘汰(1) = 22 次；
    // 触达 q0 走 cache hit 不计调用；q0 二次访问仍命中。
    expect(mockedFullTextSearch).toHaveBeenCalledTimes(22);
  });
});
