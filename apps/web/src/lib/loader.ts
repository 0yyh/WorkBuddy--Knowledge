/**
 * 索引装载期库（02 §3.4 / §18.2 秒开路径）：
 *  - 常驻：manifest.json、taxonomy.json、search/title.json、entries/<letter>.json
 *  - 惰性：search/sNN.json（L2 全文检索按需拉取 + 缓存）
 * 全部通过 fetch 读取 public/content 下的静态资源。
 */
import { SearchEngine } from '@pks/core';
import type {
  EntryIndexItem,
  IndexManifest,
  SearchHit,
  SearchResultGroup,
  ShardIndex,
  TaxonomyNode,
  TitleIndexItem,
} from '@pks/core';
import { ACTIVATED_KEY, getCached, getMeta, putCached } from './contentCache';

/** 静态资源根：跟随 Vite base（开发 '/'、构建 './'） */
const RAW_BASE: string = (import.meta.env && import.meta.env.BASE_URL ? import.meta.env.BASE_URL : '/') || '/';
export const CONTENT_ROOT = `${RAW_BASE.endsWith('/') ? RAW_BASE.slice(0, -1) : RAW_BASE}/content`;

/** 拼装 content 资源的 URL */
export function assetUrl(relPath: string): string {
  return `${CONTENT_ROOT}/${relPath.replace(/^\/+/, '')}`;
}

/**
 * 内容缓存是否已激活。
 *
 * 只有**成功应用过一次局域网更新**后才会为 true。这样保证：
 *  - 从未更新过的设备行为与改造前完全一致（直接读随包资源，不碰 IndexedDB）；
 *  - 不会因为旧的 IndexedDB 缓存把「新装的 APK 里的新内容」盖住。
 * 结果做进程内记忆，避免每个文件都查一次 IndexedDB；更新生效后由
 * `invalidateContentCacheFlag()` 重置。
 */
let cacheActive: boolean | null = null;

export async function isContentCacheActive(): Promise<boolean> {
  if (cacheActive === null) {
    cacheActive = (await getMeta<boolean>(ACTIVATED_KEY)) === true;
  }
  return cacheActive;
}

/** 内容缓存激活状态变化后调用（applyContentUpdate / resetContentCache 内部已调用） */
export function invalidateContentCacheFlag(): void {
  cacheActive = null;
}

/** 统一文本读取（缓存优先：命中 IndexedDB 直接用，未命中回落到随包资源顺带写回） */
export async function fetchText(relPath: string): Promise<string> {
  const active = await isContentCacheActive();
  if (active) {
    const hit = await getCached(relPath);
    if (hit !== null) return hit;
  }

  const url = assetUrl(relPath);
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-cache' });
  } catch (e) {
    throw new Error(`无法读取 ${url}（${e instanceof Error ? e.message : String(e)}）`);
  }
  if (!res.ok) throw new Error(`无法读取 ${url}（HTTP ${res.status}）`);
  const text = await res.text();

  if (active) await putCached(relPath, text);
  return text;
}

/** 统一 JSON 读取（走与 fetchText 一致的缓存优先链路） */
export async function fetchJson<T>(relPath: string): Promise<T> {
  const text = await fetchText(relPath);
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`${relPath} 不是合法 JSON（${e instanceof Error ? e.message : String(e)}）`);
  }
}

/** 一次装载完成的索引束 */
export interface StationBundle {
  manifest: IndexManifest;
  taxonomy: TaxonomyNode[];
  titleIndex: TitleIndexItem[];
  slugMap: Map<string, EntryIndexItem>;
  engine: SearchEngine;
}

const shardCache = new Map<number, ShardIndex>();
const shardInflight = new Map<number, Promise<void>>();
let bundlePromise: Promise<StationBundle> | null = null;

/** 由 slug 推导首字母分片名；非字母开头归入 '_' */
function letterOf(slug: string): string {
  const ch = slug.charAt(0).toLowerCase();
  return /[a-z]/.test(ch) ? ch : '_';
}

/** 拉取单个检索分片（幂等 + 单飞） */
export function loadShard(shard: number): Promise<void> {
  const cached = shardInflight.get(shard);
  if (cached) return cached;
  if (shardCache.has(shard)) return Promise.resolve();

  const task = fetchJson<ShardIndex>(`index/search/s${String(shard).padStart(2, '0')}.json`)
    .then((data) => {
      shardCache.set(shard, data);
      shardInflight.delete(shard);
    })
    .catch(() => {
      shardInflight.delete(shard);
      throw new Error(`检索分片 ${shard} 加载失败`);
    });
  shardInflight.set(shard, task);
  return task;
}

/** 拉取全部分片（L2 全文检索前置；分片很小且总数有限） */
export async function ensureAllShards(shards: number): Promise<void> {
  const tasks: Array<Promise<void>> = [];
  for (let i = 0; i < shards; i++) tasks.push(loadShard(i).catch(() => undefined));
  await Promise.all(tasks);
}

/**
 * 空闲预热：把全部分片在浏览器空闲期提前 fetch + parse 进 shardCache，
 * 使首次全文检索无需等待 13.45MB JSON 解析（实测首搜秒级 → 预热后 <50ms）。
 * 幂等：shardCache / shardInflight 已保证重复调用不重复拉取。
 */
export function warmSearchShards(): void {
  const run = (): void => {
    void loadStation()
      .then((b) => ensureAllShards(b.manifest.search.shards))
      .catch(() => undefined);
  };
  const ric = (globalThis as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;
  if (typeof ric === 'function') ric(run, { timeout: 3000 });
  else window.setTimeout(run, 1200);
}

/**
 * 首屏装载：并行拉取常驻三件套，再按首字母拉取词条元数据分片。
 * 幂等：整个进程内只装载一次（StrictMode 双跑安全）。
 */
export function loadStation(): Promise<StationBundle> {
  if (bundlePromise) return bundlePromise;

  bundlePromise = (async (): Promise<StationBundle> => {
    const [manifest, taxonomy, titleIndex] = await Promise.all([
      fetchJson<IndexManifest>('index/manifest.json'),
      fetchJson<TaxonomyNode[]>('index/taxonomy.json'),
      fetchJson<TitleIndexItem[]>('index/search/title.json'),
    ]);

    // entryShards 可能为空（旧产物），退回由 title 索引推导
    const letters = new Set<string>();
    for (const s of manifest.entryShards ?? []) letters.add(String(s));
    if (letters.size === 0) for (const item of titleIndex) letters.add(letterOf(item.slug));

    const shards = await Promise.all(
      [...letters].map(async (letter) => {
        const data = await fetchJson<{ shard: string; items: EntryIndexItem[] }>(
          `index/entries/${letter}.json`,
        );
        return data.items ?? [];
      }),
    );

    const slugMap = new Map<string, EntryIndexItem>();
    for (const items of shards) for (const item of items) slugMap.set(item.s, item);

    const engine = new SearchEngine(manifest, titleIndex, (shard: number): ShardIndex | null => {
      return shardCache.get(shard) ?? null;
    });

    return { manifest, taxonomy, titleIndex, slugMap, engine };
  })().catch((e: unknown) => {
    bundlePromise = null; // 允许重试
    throw e;
  });

  return bundlePromise;
}

/** L2 全文检索：先并行预热分片，再交给核心 SearchEngine 做 BM25 */
export async function fullTextSearch(
  bundle: StationBundle,
  query: string,
): Promise<SearchResultGroup[]> {
  const q = query.trim();
  if (!q) return [];
  await ensureAllShards(bundle.manifest.search.shards);
  const hits: SearchHit[] = bundle.engine.searchL2(q);
  return bundle.engine.groupByEntry(hits);
}
