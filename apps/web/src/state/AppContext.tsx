/**
 * 全局应用状态（React Context）。
 * 负责：装载索引束（秒开三件套）→ 暴露 { ready/loading/error, taxonomy, slugMap, engine, tracks }。
 * 派生：类目计数、id/path → 节点映射、已知 slug 集合、L2 全文检索入口。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { EntryIndexItem, IndexManifest, SearchEngine, SearchResultGroup, TaxonomyNode, Track } from '@pks/core';
import { fullTextSearch, loadStation, warmSearchShards, type StationBundle } from '../lib/loader';
import { fetchTrack, fetchTrackSummaries } from '../lib/content';
import type { CategoryView, TrackSummary } from '../types';

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

const EMPTY_STATE: StationState = {
  loading: true,
  ready: false,
  error: null,
  manifest: null,
  taxonomy: [],
  slugMap: new Map<string, EntryIndexItem>(),
  knownSlugs: new Set<string>(),
  engine: null,
  tracks: [],
  categoryViews: [],
  categoryCounts: new Map<string, number>(),
  nodeSlugs: new Map<string, string[]>(),
  nodeOwnSlugs: new Map<string, string[]>(),
  nodeById: new Map<string, TaxonomyNode>(),
  nodeByPath: new Map<string, TaxonomyNode>(),
  searchFullText: async () => [],
  getTrack: async () => {
    throw new Error('尚未初始化');
  },
  reload: () => undefined,
};

const StationContext = createContext<StationState>(EMPTY_STATE);

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
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
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

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  const value = useMemo<StationState>(() => {
    if (!bundle) {
      return { ...EMPTY_STATE, loading, error, tracks, reload };
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
      loading,
      ready: true,
      error,
      manifest: bundle.manifest,
      taxonomy: bundle.taxonomy,
      slugMap: bundle.slugMap,
      knownSlugs,
      engine: bundle.engine,
      tracks,
      categoryViews,
      categoryCounts: counts,
      nodeSlugs,
      nodeOwnSlugs,
      nodeById: byId,
      nodeByPath: byPath,
      searchFullText: (query: string) => fullTextSearch(bundle, query),
      getTrack: (trackId: string) => fetchTrack(trackId),
      reload,
    };
  }, [bundle, tracks, loading, error, reload]);

  return <StationContext.Provider value={value}>{children}</StationContext.Provider>;
}

/** 读取全局状态 */
export function useStation(): StationState {
  return useContext(StationContext);
}
