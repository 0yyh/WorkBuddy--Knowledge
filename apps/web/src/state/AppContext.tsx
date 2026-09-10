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
  /** 类目 id → 其子树（含自身）内「主键归属」于此类的词条 slug（不相交并集） */
  nodeSlugs: Map<string, string[]>;
  /** 类目 id → 仅「主键归属」于此节点本身（不含后代）的词条 slug。
   *  用于首页折叠树：混合节点（既有本类直接词条、又有子分类）展开时，
   *  把这部分「本类词条」显式列出，使父级计数 = 本组 + 各子分类之和，肉眼可对账。 */
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
 * 类目计数采用「主键分区」模型，彻底解决「词条数与子词条数不一致」：
 *  - 旧实现对每棵子树取 entrySlugs 并集去重，导致父级计数 < 各子级之和
 *    （例：「历史」父级 26，子级 15+12+1=28），首页父词条数与子词条数对不上。
 *  - 新模型：每个词条选定唯一「主键类目」= 引用它的层级最深（level 最大）的类目；
 *    同层多处引用时取 path 最小者，保证确定性。主键是全树的不相交划分，故
 *    父级 count == Σ 直接子级 count（可加、无重叠），且 BrowsePage 展示的列表
 *    恰好等于该 count，标签与条目数永远一致。
 */

/** slug → 主键类目 id（引用层级最深者；同层取 path 最小，确定性强） */
function buildSlugPrimary(nodes: TaxonomyNode[]): Map<string, string> {
  const best = new Map<string, { level: number; path: string; id: string }>();
  const walk = (node: TaxonomyNode): void => {
    const cand = { level: node.level, path: node.path, id: node.id };
    for (const slug of node.entrySlugs ?? []) {
      const ex = best.get(slug);
      if (!ex || cand.level > ex.level || (cand.level === ex.level && cand.path < ex.path)) {
        best.set(slug, cand);
      }
    }
    for (const c of node.children ?? []) walk(c);
  };
  for (const n of nodes) walk(n);
  const map = new Map<string, string>();
  for (const [slug, { id }] of best) map.set(slug, id);
  return map;
}

/** 类目 id → 主键归属于该类的词条 slug 列表 */
function buildNodePrimarySlugs(slugPrimary: Map<string, string>): Map<string, string[]> {
  const perNode = new Map<string, string[]>();
  for (const [slug, id] of slugPrimary) {
    const arr = perNode.get(id) ?? [];
    arr.push(slug);
    perNode.set(id, arr);
  }
  return perNode;
}

/** 类目 id → 其子树（含自身）全部主键词条 slug（不相交并集 → size == count） */
function buildSubtreeSlugs(
  nodes: TaxonomyNode[],
  perNode: Map<string, string[]>,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const walk = (node: TaxonomyNode): string[] => {
    const acc = [...(perNode.get(node.id) ?? [])];
    for (const c of node.children ?? []) acc.push(...walk(c));
    out.set(node.id, acc);
    return acc;
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
    // 「主键分区」计数：保证父级 == 各直接子级之和，且浏览列表 == 该 count
    const slugPrimary = buildSlugPrimary(bundle.taxonomy);
    const perNode = buildNodePrimarySlugs(slugPrimary);
    const nodeSlugs = buildSubtreeSlugs(bundle.taxonomy, perNode);
    const counts = new Map<string, number>();
    for (const [id, slugs] of nodeSlugs) counts.set(id, slugs.length);
    // 仅本节点主键归属的词条（不含后代），供首页折叠树把混合节点的「本类词条」显式列出
    const nodeOwnSlugs = new Map<string, string[]>();
    for (const [id, arr] of perNode) nodeOwnSlugs.set(id, [...arr]);
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
