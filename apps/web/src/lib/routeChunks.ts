/**
 * 路由级 chunk 单一来源（Sprint 3 · 首屏/启动资源与预取优化）。
 *
 * 页面动态 import 的 thunk 集中在此，既供 `React.lazy` 复用，也供「路由预取」
 * 在空闲 / 交互时提前触发下载，使首屏之后的导航近乎瞬时。
 *
 * 关键点：
 * - 动态 import 由打包器自动去重（同一 chunk 只 eval 一次），因此 `lazy()` 与
 *   `prefetchRoute()` 共用同一 thunk 不会重复加载模块。
 * - `prefetchRoute` 为 fire-and-forget，失败静默忽略，不阻塞首屏。
 * - 用 `satisfies` 约束值类型但不 widen，保留各页面的精确 props 类型供 `lazy` 使用。
 */
import type { ComponentType } from 'react';

export type RouteChunkName =
  | 'home'
  | 'browse'
  | 'entryCover'
  | 'entryReader'
  | 'search'
  | 'timeline'
  | 'history'
  | 'settings'
  | 'me';

export const routeChunks = {
  home: () => import('../pages/Home').then((m) => ({ default: m.HomePage })),
  browse: () => import('../pages/BrowsePage').then((m) => ({ default: m.BrowsePage })),
  entryCover: () =>
    import('../pages/EntryCoverPage').then((m) => ({ default: m.EntryCoverPage })),
  entryReader: () =>
    import('../pages/EntryReaderPage').then((m) => ({ default: m.EntryReaderPage })),
  search: () => import('../pages/SearchPage').then((m) => ({ default: m.SearchPage })),
  timeline: () =>
    import('../pages/TimelinePage').then((m) => ({ default: m.TimelinePage })),
  history: () =>
    import('../pages/HistoryPage').then((m) => ({ default: m.HistoryPage })),
  settings: () =>
    import('../pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
  me: () => import('../pages/MePage').then((m) => ({ default: m.MePage })),
} satisfies Record<RouteChunkName, () => Promise<{ default: ComponentType<any> }>>;

/**
 * 提前触发某路由 chunk 下载（fire-and-forget）。
 * 动态 import 自带去重，重复调用不会重复 eval；失败时静默忽略。
 */
export function prefetchRoute(name: RouteChunkName): void {
  void routeChunks[name]().catch(() => undefined);
}
