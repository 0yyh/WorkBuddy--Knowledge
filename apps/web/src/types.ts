/**
 * 阅读端视图层类型（04 UI 层本地模型）。
 * 与 @pks/core 的数据模型区分：这里只描述「屏幕怎么画」，不含持久化语义。
 */
import type { EntryMeta, SectionMeta, TocNode, TrackItem } from '@pks/core';

/** 哈希路由解析结果 */
export type Route =
  | { name: 'home' }
  | { name: 'browse'; catId: string }
  | { name: 'entry'; slug: string }
  | { name: 'entry-cover'; slug: string }
  | { name: 'entry-reader'; slug: string; chapter?: number }
  | { name: 'search'; query: string; full: boolean }
  | { name: 'timeline'; trackId: string }
  | { name: 'history' }
  | { name: 'settings' }
  | { name: 'me' }
  | { name: 'not-found'; raw: string };

/** 类目树的视图模型：节点 + 含子孙的词条总数 */
export interface CategoryView {
  id: string;
  title: string;
  path: string;
  level: 1 | 2 | 3;
  count: number;
  children: CategoryView[];
}

/** 由正文标题推导的目录项（无锚点，仅导航定位用） */
export interface HeadingView {
  level: number;
  text: string;
}

/** 词条正文的完整视图模型 */
export interface EntryDocument {
  slug: string;
  meta: EntryMeta;
  /** 已经过 renderMarkdown（rehype-sanitize）净化的 HTML */
  html: string;
  body: string;
  headings: HeadingView[];
  toc: TocNode[];
  /** 指向尚未录入词条的内链目标 */
  unresolved: string[];
  warnings: string[];
}

/** 单章（chapters/*.md）的视图模型 */
export interface ChapterDocument {
  key: string;
  title: string;
  slug: string;
  meta: SectionMeta | null;
  html: string;
  tldr?: string;
  keyPoints?: string[];
  path: string[];
  unresolved: string[];
}

/** index/tracks.json 中的序列摘要（由 CLI build:index 产出） */
export interface TrackSummary {
  id: string;
  title: string;
  timeline?: 'world' | 'china';
}

/** 时间轴行：TrackItem + 词条标题/摘要 + 跨轨标记 */
export interface TimelineRow {
  item: TrackItem;
  title: string;
  summary: string;
  exists: boolean;
  cross: boolean;
}

/** 搜索结果（词条分组）在 UI 层的补充字段 */
export interface SearchState {
  query: string;
  loading: boolean;
  error: string | null;
}
