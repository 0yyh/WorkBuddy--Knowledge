/**
 * 全文检索结果缓存（P2-F）：
 * - 复用 `fullTextSearch` 的 `(bundle, query) => Promise<SearchResultGroup[]>` 签名，
 *   在 AppContext 直接替换，零调用方改动。
 * - key = `${query}#${bundle.manifest.contentHash}`：
 *   contentHash 是构建期产物指纹，OTA 升级后变更 → 缓存自然失效，
 *   无需手动管理失效逻辑。
 * - 失败不入缓存：失败 promise 上链一个 .catch(() => undefined swallow，
 *   避免反复重试同一 query 时反复失败。
 * - LRU 上限 20：典型用户最近 20 个搜索词完全够用；超过则按 LRU 淘汰最久未访问。
 * - 模块级单例：跨 reload 持久，避免每次重装载都重新计算最近 query。
 */
import { LRUCache } from '@pks/core/search';
import type { SearchResultGroup } from '@pks/core';
import { fullTextSearch, type StationBundle } from './loader';

const CACHE_CAPACITY = 20;
const cache = new LRUCache<string, SearchResultGroup[]>(CACHE_CAPACITY);

/**
 * 带缓存的全文检索。语义同 `fullTextSearch`，但命中缓存时直接返回历史结果，
 * 不再走 BM25 / Worker RPC（首次检索的 ~80–300 ms 节省为接近 0）。
 */
export function cachedFullTextSearch(
  bundle: StationBundle,
  query: string,
): Promise<SearchResultGroup[]> {
  const q = query.trim();
  if (!q) return Promise.resolve([]);
  const key = `${q}#${bundle.manifest.contentHash}`;
  const hit = cache.get(key);
  if (hit !== undefined) return Promise.resolve(hit);

  const p = fullTextSearch(bundle, q);
  // 失败不入缓存；then 链同步注册，不阻塞调用方
  p.then((r) => {
    cache.set(key, r);
  }).catch(() => {
    /* 失败不入缓存，下次同 query 会重新尝试 */
  });
  return p;
}

/** 主动清空缓存（供测试 / 调试用，不暴露给 UI） */
export function clearSearchResultCache(): void {
  cache.clear();
}
