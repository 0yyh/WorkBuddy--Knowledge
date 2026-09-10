/**
 * 索引装载期库（02 §3.4 / §18.2 秒开路径）：
 *  - 常驻：manifest.json、taxonomy.json、search/title.json、entries/<letter>.json
 *  - 惰性：search/sNN.json（L2 全文检索按需拉取 + 缓存）
 * 全部通过 fetch 读取 public/content 下的静态资源。
 */
import { SearchEngine, decodePostings } from '@pks/core';
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
   * P0-III：全局 BM25 统计原始数据（Record 形式的 df），供 Worker init 重建 Map。
   * 缺失（旧产物）为 null → Worker 与主线程均退化为分片内 BM25。
   */
  statsSeed: { totalDocs: number; avgLen: number; df: Record<string, number> } | null;
}

const shardCache = new Map<number, ShardIndex>();
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
  index?: ShardIndex['index'];
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
        : (wire.index ?? {});
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
 * 首屏装载：并行拉取常驻三件套，再按首字母拉取词条元数据分片。
 * 幂等：整个进程内只装载一次（StrictMode 双跑安全）。
 */
export function loadStation(): Promise<StationBundle> {
  if (bundlePromise) return bundlePromise;

  bundlePromise = (async (): Promise<StationBundle> => {
    const [manifest, taxonomy, titleIndex, dfData] = await Promise.all([
      fetchJson<IndexManifest>('index/manifest.json'),
      fetchJson<TaxonomyNode[]>('index/taxonomy.json'),
      fetchJson<TitleIndexItem[]>('index/search/title.json'),
      // P0-II 全局检索统计：缺失（旧产物）时回落到分片内 BM25，不阻断首屏
      fetchJson<{ totalDocs: number; avgDocLen: number; df: Record<string, number> }>(
        'index/search/df.json',
      ).catch(() => null),
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

    // P0-II：全局 BM25 统计（跨分片打分可比）；df.json 缺失时 stats 为 undefined → 分片内 BM25
    // P0-III：statsSeed 为同一数据的 Record 形式，供 Worker init 重建 Map。
    const statsSeed = dfData
      ? {
          totalDocs: dfData.totalDocs ?? manifest.search.docs,
          avgLen: dfData.avgDocLen ?? manifest.search.avgDocLen,
          df: dfData.df ?? {},
        }
      : null;
    const stats = statsSeed
      ? {
          totalDocs: statsSeed.totalDocs,
          avgLen: statsSeed.avgLen,
          df: new Map<string, number>(Object.entries(statsSeed.df)),
        }
      : undefined;

    const engine = new SearchEngine(manifest, titleIndex, (shard: number): ShardIndex | null => {
      return shardCache.get(shard) ?? null;
    }, stats);

    return { manifest, taxonomy, titleIndex, slugMap, engine, statsSeed };
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

  await ensureAllShards(bundle.manifest.search.shards);
  const hits: SearchHit[] = bundle.engine.searchL2(q);
  return bundle.engine.groupByEntry(hits);
}
