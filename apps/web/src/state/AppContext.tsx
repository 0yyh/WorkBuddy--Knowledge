/**
 * 全局应用状态（React Context）。
 * 负责：装载索引束（秒开三件套）→ 暴露 { ready/loading/error, taxonomy, slugMap, engine, tracks }。
 * 派生：类目计数、id/path → 节点映射、已知 slug 集合、L2 全文检索入口。
 *
 * P0-perf：把 StationState 拆成 3 个独立 context，按数据变化频率分组：
 *  - DataContext：稳定但大的数据（懒变更：一次 loadStation 后基本不变）
 *    → 内部用 useMemo + 严格依赖列表，bundle/tracks 引用未变时整个 value 引用稳定。
 *  - StatusContext：高频变化（小、订阅广：loading/ready/error）
 *    → 仅 reload 流程或错误捕获时变化。
 *  - ActionsContext：稳定引用（useCallback + useMemo 锁住）
 *    → reload/searchFullText/getTrack 引用跨渲染稳定，依赖项最小化。
 *
 * 旧 caller 用 `useStation()`（内部合并三个 context）保持行为不变；
 * 新代码推荐 `useStationData()` / `useStationStatus()` / `useStationActions()` 精订阅。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  EntryIndexItem,
  IndexManifest,
  SearchEngine,
  SearchResultGroup,
  TaxonomyNode,
  Track,
} from '@pks/core';
import { fullTextSearch, loadStation, warmSearchShards, type StationBundle } from '../lib/loader';
import { fetchTrack, fetchTrackSummaries } from '../lib/content';
import type { CategoryView, TrackSummary } from '../types';

/* ------------------------------------------------------------------ *
 * 公开接口：useStation() 的返回类型保持不变（19 字段），所有旧 caller 无需改。
 * ------------------------------------------------------------------ */
export interface StationState {
  loading: boolean;
  ready: boolean;
  error: string | null;
  manifest: IndexManifest | null;
  taxonomy: TaxonomyNode[];
  slugMap: Map<string, EntryIndexItem>;
  knownSlugs: Set<string>;
  engine: SearchEngine | null;
  tracks: TrackSummary[];
  categoryViews: CategoryView[];
  categoryCounts: Map<string, number>;
  /** 类目 id → 该类目（含全部子孙）所引用的全部词条 slug（去重，标签语义；count == 该列表长度） */
  nodeSlugs: Map<string, string[]>;
  /** 类目 id → 仅该类目本身直接引用的词条 slug（不含后代）。
   *  供首页折叠树把「本类直接词条」与「子分类」区分展示。 */
  nodeOwnSlugs: Map<string, string[]>;
  nodeById: Map<string, TaxonomyNode>;
  nodeByPath: Map<string, TaxonomyNode>;
  searchFullText: (query: string) => Promise<SearchResultGroup[]>;
  getTrack: (trackId: string) => Promise<Track>;
  reload: () => void;
}

/* ------------------------------------------------------------------ *
 * 三个 context 的拆分值类型（按变化频率分组）。
 *  DataContext：稳定大块 + 派生。
 *  StatusContext：高频小信号（loading/ready/error）。
 *  ActionsContext：稳定引用，闭包依赖最小化。
 * ------------------------------------------------------------------ */
export interface DataContextValue {
  manifest: IndexManifest | null;
  taxonomy: TaxonomyNode[];
  slugMap: Map<string, EntryIndexItem>;
  knownSlugs: Set<string>;
  engine: SearchEngine | null;
  /** 全局 BM25 参数（{totalDocs, avgLen}）；与 loader 输出的 bundle.dfMeta 同源。 */
  dfMeta: { totalDocs: number; avgLen: number } | null;
  /** 主线程兜底检索用的全局 df Map（与 engine.stats.df 同引用）；按需填充。 */
  dfMap: Map<string, number>;
  tracks: TrackSummary[];
  categoryViews: CategoryView[];
  categoryCounts: Map<string, number>;
  nodeSlugs: Map<string, string[]>;
  nodeOwnSlugs: Map<string, string[]>;
  nodeById: Map<string, TaxonomyNode>;
  nodeByPath: Map<string, TaxonomyNode>;
}

export interface StatusContextValue {
  loading: boolean;
  /** 与原 useStation().ready 同语义：bundle 装载完成即 true（不计空、不计 error）。 */
  ready: boolean;
  error: string | null;
}

export interface ActionsContextValue {
  reload: () => void;
  searchFullText: (query: string) => Promise<SearchResultGroup[]>;
  getTrack: (trackId: string) => Promise<Track>;
}

/* ------------------------------------------------------------------ *
 * Fallback 默认值：必须是 module-level 单例。
 *
 * ⚠️  React Context Provider 比较走 Object.is，若 fallback 在每次调用时新建对象，
 *    会让 useContext 返回不同引用、误触发 consumer 重渲染。所以 EMPTY_* 一律
 *    在文件顶层创建一次，下游所有 fallback 都引用同一对象。
 *
 * EMPTY_DATA：把 Map/Set 字段也都提到顶层，避免每次解构时新建空 Map/Set。
 * EMPTY_STATUS：基础类型字段，单例足够。
 * EMPTY_ACTIONS：searchFullText/getTrack/reload 都是「尚未初始化」的占位实现；
 *   reload = noop；searchFullText 直接返回空数组；getTrack 抛错（与原 EMPTY_STATE 语义一致）。
 * ------------------------------------------------------------------ */
const EMPTY_SLUG_MAP: Map<string, EntryIndexItem> = new Map();
const EMPTY_KNOWN_SLUGS: Set<string> = new Set();
const EMPTY_CATEGORY_COUNTS: Map<string, number> = new Map();
const EMPTY_NODE_SLUGS: Map<string, string[]> = new Map();
const EMPTY_NODE_OWN_SLUGS: Map<string, string[]> = new Map();
const EMPTY_NODE_BY_ID: Map<string, TaxonomyNode> = new Map();
const EMPTY_NODE_BY_PATH: Map<string, TaxonomyNode> = new Map();
const EMPTY_DF_MAP: Map<string, number> = new Map();
const EMPTY_TRACKS: TrackSummary[] = [];
const EMPTY_CATEGORY_VIEWS: CategoryView[] = [];
const EMPTY_TAXONOMY: TaxonomyNode[] = [];

const EMPTY_DATA: DataContextValue = {
  manifest: null,
  taxonomy: EMPTY_TAXONOMY,
  slugMap: EMPTY_SLUG_MAP,
  knownSlugs: EMPTY_KNOWN_SLUGS,
  engine: null,
  dfMeta: null,
  dfMap: EMPTY_DF_MAP,
  tracks: EMPTY_TRACKS,
  categoryViews: EMPTY_CATEGORY_VIEWS,
  categoryCounts: EMPTY_CATEGORY_COUNTS,
  nodeSlugs: EMPTY_NODE_SLUGS,
  nodeOwnSlugs: EMPTY_NODE_OWN_SLUGS,
  nodeById: EMPTY_NODE_BY_ID,
  nodeByPath: EMPTY_NODE_BY_PATH,
};

const EMPTY_STATUS: StatusContextValue = {
  loading: true,
  ready: false,
  error: null,
};

const EMPTY_ACTIONS: ActionsContextValue = {
  reload: (): void => undefined,
  searchFullText: async (): Promise<SearchResultGroup[]> => [],
  getTrack: async (): Promise<Track> => {
    throw new Error('尚未初始化');
  },
};

/* ------------------------------------------------------------------ *
 * 三个独立 context 实例。createContext 默认值显式为 null：
 *  - 类型为 ContextType | null，下游用 `useContext(...) ?? EMPTY_*` 兜底。
 *  - 真正的「无 Provider」场景（理论上不会发生，因为根组件一定有 StationProvider）
 *    也能安全 fallback，不破坏 hook 顺序与重渲染语义。
 * ------------------------------------------------------------------ */
const DataContext = createContext<DataContextValue | null>(null);
const StatusContext = createContext<StatusContextValue | null>(null);
const ActionsContext = createContext<ActionsContextValue | null>(null);

/**
 * 类目计数采用「标签语义」模型（并集去重）：
 *  - 一个词条可同时归属多个类目——哲学分类存在两条交叉轴：主题轴
 *    形而上学/认识论/伦理学/美学/政治哲学/逻辑与批判性思维 在 level 2，时期轴
 *    中国哲学/西方哲学/{古希腊,中世纪,近代欧陆,英美与现当代}/思想史 在 level 2~3。
 *  - 旧「主键分区」（每个词条只归层级最深的类目）会让时期轴永远压过主题轴，
 *    导致 哲学/美学 显示 0 条（实际 11 条引用）、哲学/形而上学 1 条（实际 10 条）等失真。
 *  - 新模型：类目计数 = 该类目（含全部子孙）所引用的全部词条 slug 去重，
 *    与 BrowsePage 实际展示的列表完全一致：「点进去看到几条」==「树上写几条」。
 *  - 代价：父类目计数可能 < 各直接子级之和（同一词条被多个轴引用，跨轴重叠），
 *    这是多轴分类的固有属性，不再强制「父 = 子之和」。
 */

/** 类目 id → 该类目（含全部子孙）引用的全部词条 slug（去重，标签语义） */
function buildUnionSlugs(nodes: TaxonomyNode[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const walk = (node: TaxonomyNode): Set<string> => {
    const set = new Set<string>(node.entrySlugs ?? []);
    for (const c of node.children ?? []) for (const s of walk(c)) set.add(s);
    out.set(node.id, [...set]);
    return set;
  };
  for (const n of nodes) walk(n);
  return out;
}

/** 扁平化所有节点，供派生「本类直接词条」使用 */
function flattenNodes(nodes: TaxonomyNode[]): TaxonomyNode[] {
  const out: TaxonomyNode[] = [];
  const walk = (n: TaxonomyNode): void => {
    out.push(n);
    for (const c of n.children ?? []) walk(c);
  };
  for (const n of nodes) walk(n);
  return out;
}

/** 产出视图树；count 直接读入参 counts（已在外部按主键分区算好，保证父==子之和） */
function buildCategoryViews(
  nodes: TaxonomyNode[],
  counts: Map<string, number>,
): CategoryView[] {
  const walk = (node: TaxonomyNode): CategoryView => {
    const children = (node.children ?? []).map(walk);
    const total = counts.get(node.id) ?? 0;
    return {
      id: node.id,
      title: node.title,
      path: node.path,
      level: node.level,
      count: total,
      children,
    };
  };
  return nodes.map(walk);
}

/** 扁平化 id/path → 节点映射，供 Browse / Entry 侧跳转使用 */
function buildNodeMaps(nodes: TaxonomyNode[]): {
  byId: Map<string, TaxonomyNode>;
  byPath: Map<string, TaxonomyNode>;
} {
  const byId = new Map<string, TaxonomyNode>();
  const byPath = new Map<string, TaxonomyNode>();
  const walk = (node: TaxonomyNode): void => {
    byId.set(node.id, node);
    byPath.set(node.path, node);
    for (const child of node.children ?? []) walk(child);
  };
  for (const node of nodes) walk(node);
  return { byId, byPath };
}

export function StationProvider({ children }: { children: ReactNode }): JSX.Element {
  const [bundle, setBundle] = useState<StationBundle | null>(null);
  const [tracks, setTracks] = useState<TrackSummary[]>(EMPTY_TRACKS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [reloadToken, setReloadToken] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    loadStation()
      .then(async (b) => {
        if (!alive) return;
        setBundle(b);
        const list = await fetchTrackSummaries();
        if (!alive) return;
        setTracks(list);
        setLoading(false);
        warmSearchShards();
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : String(e);
        setError(
          `${msg}。请先在仓库根目录执行 pnpm build:index，再执行 pnpm -F @pks/web copy:content 生成 content 资源。`,
        );
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [reloadToken]);

  // reload：稳定引用，依赖项空；只通过 reloadToken 触发 useEffect 重启装载。
  const reload = useCallback((): void => {
    setReloadToken((n) => n + 1);
  }, []);

  // searchFullText：依赖 bundle（用 closure 捕获当前 bundle 引用）；bundle 变化时引用变。
  // getTrack：reload 与 fetchTrack 都是无状态模块函数，无依赖 → 引用永远稳定。
  const searchFullText = useCallback(
    (query: string): Promise<SearchResultGroup[]> => {
      // bundle 为 null 时理论上不会调到这里（Provider 装配完才渲染 children），
      // 这里做兜底：避免 binding 在初始态被调时崩。
      if (!bundle) return Promise.resolve([]);
      return fullTextSearch(bundle, query);
    },
    [bundle],
  );
  const getTrack = useCallback((trackId: string): Promise<Track> => fetchTrack(trackId), []);

  // StatusContext value：loading/ready/error 都是高频信号。
  // 单独 useMemo 锁住，依赖项最小；StatusContext 消费者（AppShell/EntryReaderPage 等）
  // 只在装载/重载过程中重渲染，不会被 DataContext 大对象拖动。
  const statusValue = useMemo<StatusContextValue>(
    () => ({ loading, ready: bundle !== null, error }),
    [loading, bundle, error],
  );

  // DataContext value：稳定大块 + 派生。
  // bundle 不变时整个 value 引用稳定 → DataContext 消费者（Home/BrowsePage 等）
  // 不会因 reload 调用本身重渲染，仅在 bundle/tracks 真正变化时才重渲染。
  const dataValue = useMemo<DataContextValue>(() => {
    if (!bundle) {
      // bundle 未到 → 直接返回单例 EMPTY_DATA；tracks 留 EMPTY（EMPTY_TRACKS 同引用）。
      return EMPTY_DATA;
    }
    // 「标签语义」计数：类目计数 == 该类目（含子孙）引用的全部词条去重数 == 浏览列表长度
    const nodeSlugs = buildUnionSlugs(bundle.taxonomy);
    const counts = new Map<string, number>();
    for (const [id, slugs] of nodeSlugs) counts.set(id, slugs.length);
    // 每个节点自己直接引用的词条（不含后代），供首页折叠树区分「本类词条」与「子分类」
    const nodeOwnSlugs = new Map<string, string[]>();
    for (const n of flattenNodes(bundle.taxonomy)) nodeOwnSlugs.set(n.id, [...(n.entrySlugs ?? [])]);
    const categoryViews = buildCategoryViews(bundle.taxonomy, counts);
    const { byId, byPath } = buildNodeMaps(bundle.taxonomy);
    const knownSlugs = new Set<string>(bundle.slugMap.keys());

    return {
      manifest: bundle.manifest,
      taxonomy: bundle.taxonomy,
      slugMap: bundle.slugMap,
      knownSlugs,
      engine: bundle.engine,
      dfMeta: bundle.dfMeta,
      dfMap: bundle.dfMap,
      tracks,
      categoryViews,
      categoryCounts: counts,
      nodeSlugs,
      nodeOwnSlugs,
      nodeById: byId,
      nodeByPath: byPath,
    };
  }, [bundle, tracks]);

  // ActionsContext value：三个 callback 全部 useCallback 锁住 → 整体 useMemo 引用稳定
  // （searchFullText 因依赖 bundle 会随 bundle 变化而变，这是预期行为）。
  const actionsValue = useMemo<ActionsContextValue>(
    () => ({ reload, searchFullText, getTrack }),
    [reload, searchFullText, getTrack],
  );

  return (
    <DataContext.Provider value={dataValue}>
      <StatusContext.Provider value={statusValue}>
        <ActionsContext.Provider value={actionsValue}>{children}</ActionsContext.Provider>
      </StatusContext.Provider>
    </DataContext.Provider>
  );
}

/* ------------------------------------------------------------------ *
 * Selector hooks（新 caller 推荐使用；细粒度订阅，按 context 各自订阅）。
 *  - 用 `useContext(...) ?? EMPTY_*` 兜底：若 Provider 不在树上（理论不会发生），
 *    也返回稳定单例，hook 顺序与重渲染语义不变。
 * ------------------------------------------------------------------ */

/** 只订阅稳定大块数据（manifest/slugMap/engine/tracks/派生类目树）。 */
export function useStationData(): DataContextValue {
  return useContext(DataContext) ?? EMPTY_DATA;
}

/** 只订阅高频小信号（loading/ready/error）。 */
export function useStationStatus(): StatusContextValue {
  return useContext(StatusContext) ?? EMPTY_STATUS;
}

/** 只订阅稳定引用 actions（reload/searchFullText/getTrack）。 */
export function useStationActions(): ActionsContextValue {
  return useContext(ActionsContext) ?? EMPTY_ACTIONS;
}

/**
 * 读取全局状态（兼容旧 caller）：内部合并三个 context，返回完整 StationState。
 *
 * ⚠️  注意：这个 hook 合并的 value 引用在 DataContext/StatusContext/ActionsContext
 *    任一变化时都会变。**旧 caller 若关心重渲染频率，应迁移到三个 selector hook 之一**。
 *    本函数保留的唯一目的是不强制 caller 改 main。
 */
export function useStation(): StationState {
  const data = useStationData();
  const status = useStationStatus();
  const actions = useStationActions();

  // 把三个 context 合并为 StationState 形状；显式列字段（避免带 DataContext 内部的 dfMeta/dfMap 漏到 StationState）。
  return useMemo<StationState>(
    () => ({
      loading: status.loading,
      ready: status.ready,
      error: status.error,
      manifest: data.manifest,
      taxonomy: data.taxonomy,
      slugMap: data.slugMap,
      knownSlugs: data.knownSlugs,
      engine: data.engine,
      tracks: data.tracks,
      categoryViews: data.categoryViews,
      categoryCounts: data.categoryCounts,
      nodeSlugs: data.nodeSlugs,
      nodeOwnSlugs: data.nodeOwnSlugs,
      nodeById: data.nodeById,
      nodeByPath: data.nodeByPath,
      searchFullText: actions.searchFullText,
      getTrack: actions.getTrack,
      reload: actions.reload,
    }),
    [data, status, actions],
  );
}