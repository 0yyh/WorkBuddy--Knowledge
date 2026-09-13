/**
 * 索引装载期库（02 §3.4 / §18.2 秒开路径）：
 *  - 常驻：manifest.json、taxonomy.json、search/title.json、entries/<letter>.json
 *  - 惰性：search/sNN.json（L2 全文检索按需拉取 + 缓存）
 * 全部通过 fetch 读取 public/content 下的静态资源。
 */
import { SearchEngine, decodePostings, dfBucketOf, tokenize, LRUCache, SHARD_CACHE_CAPACITY, inlineIndexToMap } from '@pks/core';
import type {
  DfBucket,
  EntryIndexItem,
  IndexManifest,
  SearchHit,
  SearchResultGroup,
  ShardIndex,
  TaxonomyNode,
  TitleIndexItem,
} from '@pks/core';
import { ACTIVATED_KEY, getCached, getMeta, putCached } from './contentCache';
import { searchViaWorker, warmSearchWorker } from './searchWorkerClient';

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
  /**
   * ① df 分片化：全局 BM25 全局参数（{totalDocs, avgLen}），由 `index/search/df/meta.json` 读取。
   * 全量 df 不再随包常驻，改为按查询词哈希按需懒加载（见 loadDfForTerms / loadDfBuckets）。
   */
  dfMeta: { totalDocs: number; avgLen: number };
  /**
   * 主线程兜底检索用的全局 df Map。与 `engine.stats.df` 是**同一引用**，
   * 兜底路径按需把查询词命中的桶合并进此 Map，BM25 立即可见（无需重建引擎）。
   */
  dfMap: Map<string, number>;
}

/** P0-2：主线程兜底检索的解码分片缓存，改 LRU 有界（检索完成后仅保留最近使用的有限个分片）。 */
const shardCache = new LRUCache<number, ShardIndex>(SHARD_CACHE_CAPACITY);
const shardInflight = new Map<number, Promise<void>>();
/** P0-III：分片原始文本缓存（worker 与主线程共享，避免重复下载）。 */
const shardTextCache = new Map<number, string>();
/** P0-III：分片文本在途请求（并发去重：空闲预热与首搜可能同时请求同一分片）。 */
const shardTextInflight = new Map<number, Promise<string>>();
let bundlePromise: Promise<StationBundle> | null = null;

/** 分片相对路径（唯一拼装点）。 */
function shardPath(shard: number): string {
  return `index/search/s${String(shard).padStart(2, '0')}.json`;
}

/**
 * 读取单个检索分片的**原始 JSON 文本**（走 fetchText 缓存优先链路）。
 * worker 消费原始文本（从而局域网 OTA 更新过的内容仍可检索），
 * 并与主线程 loadShard 共享同一份缓存 —— 同一分片只下载一次（含并发去重）。
 */
export function fetchShardText(shard: number): Promise<string> {
  const hit = shardTextCache.get(shard);
  if (hit !== undefined) return Promise.resolve(hit);
  const inflight = shardTextInflight.get(shard);
  if (inflight) return inflight;

  const task = fetchText(shardPath(shard))
    .then((text) => {
      shardTextCache.set(shard, text);
      shardTextInflight.delete(shard);
      return text;
    })
    .catch((e: unknown) => {
      shardTextInflight.delete(shard);
      throw e;
    });
  shardTextInflight.set(shard, task);
  return task;
}

/** 由 slug 推导首字母分片名；非字母开头归入 '_' */
function letterOf(slug: string): string {
  const ch = slug.charAt(0).toLowerCase();
  return /[a-z]/.test(ch) ? ch : '_';
}

/** 检索分片线上格式：P0-I 起倒排走 `postings`（base64）；旧产物仍为内联 `index`。 */
interface WireShardIndex {
  shard: number;
  docs: ShardIndex['docs'];
  lengths: number[];
  /** 新格式：base64(varint 差分 + zlib) 的倒排表 */
  postings?: string;
  /** 旧格式：内联展开的倒排表（向后兼容） */
  index?: Record<string, Array<[number, number]>>;
}

/** 拉取单个检索分片（幂等 + 单飞） */
export function loadShard(shard: number): Promise<void> {
  const cached = shardInflight.get(shard);
  if (cached) return cached;
  if (shardCache.has(shard)) return Promise.resolve();

  const task = fetchShardText(shard)
    .then((text) => {
      const wire = JSON.parse(text) as WireShardIndex;
      // P0-I：优先解 base64 倒排；旧产物回落到内联 index（不崩）。
      const index: ShardIndex['index'] = wire.postings
        ? decodePostings(wire.postings)
        : (wire.index ? inlineIndexToMap(wire.index) : {});
      const data: ShardIndex = {
        shard: wire.shard,
        docs: wire.docs,
        lengths: wire.lengths,
        index,
      };
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
 * 仅预热全部分片的**原始文本**（不解码）。
 * P0-III：worker 可用时解码只在 worker 内发生一次；若 worker 降级，主线程兜底检索时
 * 会经 loadShard → fetchShardText 命中本缓存后再按需解码。避免「主线程 + worker 各解一遍」。
 */
export async function ensureAllShardTexts(shards: number): Promise<void> {
  const tasks: Array<Promise<string>> = [];
  for (let i = 0; i < shards; i++) tasks.push(fetchShardText(i).catch(() => ''));
  await Promise.all(tasks);
}

/**
 * 空闲预热：把全部分片文本在浏览器空闲期提前 fetch（+ 交给 Worker 解码），
 * 使首次全文检索无需等待下载/解码（实测首搜秒级 → 预热后 <50ms）。
 * P0-III：只预热**文本**（不再在主线程预解码），解码交由 Worker 完成；
 * worker 不可用时主线程兜底仍会按需解码，且文本已缓存、不会二次下载。
 * 幂等：shardTextCache / shardTextInflight / sentShards 均保证不重复。
 */
export function warmSearchShards(): void {
  const run = (): void => {
    void loadStation()
      .then((b) => ensureAllShardTexts(b.manifest.search.shards).then(() => warmSearchWorker(b)))
      .catch(() => undefined);
  };
  const ric = (globalThis as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  }).requestIdleCallback;
  if (typeof ric === 'function') ric(run, { timeout: 3000 });
  else window.setTimeout(run, 1200);
}

/**
 * ① df 分片化：全局文档频率(df) 桶懒加载。
 *
 * df 被拆成 `.index/search/df/bucket-NNN.json` 多个小文件；Worker/主线程只在查询时，
 * 按查询词哈希算出的桶号按需拉取命中的少数桶（缓存 + 单飞去重），不再整表加载。
 */

/** df 桶相对路径（唯一拼装点）。 */
function dfBucketPath(n: number): string {
  return `index/search/df/bucket-${String(n).padStart(3, '0')}.json`;
}

/** df 桶原始文本缓存（与 shardTextCache 同款，跨 worker/主线程共享） */
const dfBucketCache = new Map<number, DfBucket>();
/** df 桶在途请求（并发去重） */
const dfBucketInflight = new Map<number, Promise<DfBucket | null>>();

/** 拉取单个 df 桶（幂等 + 单飞）；缺失（404/损坏）视为空桶返回 null */
function fetchDfBucket(n: number): Promise<DfBucket | null> {
  const hit = dfBucketCache.get(n);
  if (hit !== undefined) return Promise.resolve(hit);
  const inflight = dfBucketInflight.get(n);
  if (inflight) return inflight;

  const task = fetchText(dfBucketPath(n))
    .then((text) => {
      const bucket = JSON.parse(text) as DfBucket;
      dfBucketCache.set(n, bucket);
      dfBucketInflight.delete(n);
      return bucket;
    })
    .catch(() => {
      // 桶文件缺失/损坏：当作该桶无 df（词不在任何文档），不打断检索。
      dfBucketInflight.delete(n);
      return null;
    });
  dfBucketInflight.set(n, task);
  return task;
}

/**
 * 按需拉取指定桶号的 df 桶（缓存 + 单飞），返回非零桶列表。
 * 供 Worker `dfb` 消息直接投递（形状为 `Array<{ n, df }>`）。
 */
export async function loadDfBuckets(idxs: number[]): Promise<DfBucket[]> {
  const unique = [...new Set(idxs)];
  const results = await Promise.all(unique.map((n) => fetchDfBucket(n)));
  return results.filter((b): b is DfBucket => b !== null);
}

/**
 * 按查询词集合计算命中桶并合并为 `Map<term, df>`，供主线程兜底 BM25 打分使用。
 * 仅需加载查询词对应的极少数桶（典型 1–3 个），消除整表加载卡顿。
 */
export async function loadDfForTerms(terms: string[]): Promise<Map<string, number>> {
  const idxs = [...new Set(terms.map((t) => dfBucketOf(t)))];
  const buckets = await loadDfBuckets(idxs);
  const map = new Map<string, number>();
  for (const b of buckets) {
    for (const [term, count] of Object.entries(b.df)) map.set(term, count);
  }
  return map;
}

/**
 * 首屏装载：并行拉取常驻三件套，再按首字母拉取词条元数据分片。
 * 幂等：整个进程内只装载一次（StrictMode 双跑安全）。
 */
export function loadStation(): Promise<StationBundle> {
  if (bundlePromise) return bundlePromise;

  bundlePromise = (async (): Promise<StationBundle> => {
    const [manifest, taxonomy, titleIndex, dfMetaData] = await Promise.all([
      fetchJson<IndexManifest>('index/manifest.json'),
      fetchJson<TaxonomyNode[]>('index/taxonomy.json'),
      fetchJson<TitleIndexItem[]>('index/search/title.json'),
      // ① df 分片化：常驻极小 meta.json（{totalDocs, avgLen}）；不再整表加载 df.json。
      // 缺失（旧产物）时回落到 manifest.search 的全局参数，不阻断首屏。
      fetchJson<{ totalDocs: number; avgLen: number }>('index/search/df/meta.json').catch(() => null),
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

    // ① df 分片化：全局参数（totalDocs / avgLen）用于 BM25 归一化；全量 df 不再常驻，
    // 由 loadDfForTerms / loadDfBuckets 按需懒加载（Worker 走 dfb，主线程兜底走同样路径）。
    const dfMeta = dfMetaData
      ? {
          totalDocs: dfMetaData.totalDocs ?? manifest.search.docs,
          avgLen: dfMetaData.avgLen ?? manifest.search.avgDocLen,
        }
      : { totalDocs: manifest.search.docs, avgLen: manifest.search.avgDocLen };

    // 该 Map 与 engine.stats.df 为同一引用：主线程兜底检索时按需填充（见 fullTextSearch）。
    const dfMap = new Map<string, number>();
    const stats = {
      totalDocs: dfMeta.totalDocs,
      avgLen: dfMeta.avgLen,
      df: dfMap,
    };

    const engine = new SearchEngine(manifest, titleIndex, async (shard: number): Promise<ShardIndex | null> => {
      // P0-2：on-demand 加载——命中 LRU 直接返回；否则经 loadShard 拉取+解码后回填 LRU。
      const hit = shardCache.get(shard);
      if (hit) return hit;
      await loadShard(shard);
      return shardCache.get(shard) ?? null;
    }, stats);

    return { manifest, taxonomy, titleIndex, slugMap, engine, dfMeta, dfMap };
  })().catch((e: unknown) => {
    bundlePromise = null; // 允许重试
    throw e;
  });

  return bundlePromise;
}

/**
 * L2 全文检索：worker 优先（解码 + BM25 全在 worker），失败/不可用则安静降级到主线程。
 * 签名保持不变：SearchPage / AppContext 依赖 `(bundle, query) => Promise<SearchResultGroup[]>`。
 */
export async function fullTextSearch(
  bundle: StationBundle,
  query: string,
): Promise<SearchResultGroup[]> {
  const q = query.trim();
  if (!q) return [];

  try {
    const viaWorker = await searchViaWorker(bundle, q);
    if (viaWorker) return viaWorker; // 成功即返回（含空结果）
  } catch {
    // Worker 不可用或执行失败：静默降级到主线程，保证功能不回归。
  }

  // ① df 分片化：兜底路径同样只懒加载查询词命中的 df 桶，合并进 engine.stats.df（同一引用），
  // 保持与 Worker 路径一致的全局 BM25 打分口径（否则退化为分片内 df）。
  const df = await loadDfForTerms(tokenize(q));
  for (const [term, count] of df) bundle.dfMap.set(term, count);
  // P0-2：searchL2 现 async，逐分片 on-demand 经引擎加载器加载（LRU 有界），不再预载全部分片。
  const hits: SearchHit[] = await bundle.engine.searchL2(q);
  return bundle.engine.groupByEntry(hits);
}
