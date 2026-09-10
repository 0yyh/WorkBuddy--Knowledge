/**
 * 极简哈希路由器（无第三方依赖）。
 * 路由：#/ 、#/browse/:catId 、#/entry/:slug 、#/search?q=&full=1 、#/timeline/:trackId
 *
 * 只监听 hashchange —— 静态托管 / Capacitor 均可直接使用，无需服务端 rewrite。
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { Route } from './types';

/** 把形如 `#/entry/das-kapital` 的 hash 解析成结构化 Route */
export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  if (raw === '' || raw === '/') return { name: 'home' };

  const qIndex = raw.indexOf('?');
  const path = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const search = qIndex === -1 ? '' : raw.slice(qIndex + 1);
  const params = new URLSearchParams(search);

  const parts = path.split('/').filter((p) => p.length > 0);
  const head = parts[0];

  if (head === 'browse' && parts[1]) {
    return { name: 'browse', catId: decodeURIComponent(parts[1]) };
  }
  if (head === 'entry-reader' && parts[1]) {
    let chapter: number | undefined;
    const chRaw = params.get('ch');
    if (chRaw !== null && chRaw !== '') {
      const n = Number.parseInt(chRaw, 10);
      if (!Number.isNaN(n) && n >= 0) chapter = n;
    }
    return { name: 'entry-reader', slug: decodeURIComponent(parts[1]), chapter };
  }
  if (head === 'entry-cover' && parts[1]) {
    return { name: 'entry-cover', slug: decodeURIComponent(parts[1]) };
  }
  if (head === 'entry' && parts[1]) {
    return { name: 'entry', slug: decodeURIComponent(parts[1]) };
  }
  if (head === 'search') {
    return {
      name: 'search',
      query: params.get('q') ?? '',
      full: params.get('full') === '1',
    };
  }
  if (head === 'timeline' && parts[1]) {
    return { name: 'timeline', trackId: decodeURIComponent(parts[1]) };
  }
  if (head === 'timeline') {
    return { name: 'timeline', trackId: '' };
  }
  if (head === 'history') {
    return { name: 'history' };
  }
  if (head === 'settings') {
    return { name: 'settings' };
  }
  if (head === 'me') {
    return { name: 'me' };
  }
  return { name: 'not-found', raw };
}

/** 程序化跳转：写入 location.hash，由 hashchange 驱动重渲染（新增一条历史记录） */
export function navigate(path: string): void {
  const next = path.startsWith('#') ? path : `#${path}`;
  if (window.location.hash === next) return;
  window.location.hash = next;
}

/** replace 式跳转：原地替换当前历史记录（不新增层），用于阅读页无可退封面时收栈 */
export function replaceRoute(path: string): void {
  const next = path.startsWith('#') ? path : `#${path}`;
  if (window.location.hash === next) return;
  window.location.replace(next);
}

/* ------------------------- 会话路由轨迹（供阅读页返回决策） -------------------------
 * 浏览器不允许 JS 读取历史栈内容，因此用会话内「上一路由」近似判断：
 * 阅读页 ← 只有在上一路由是同一词条的封面时才可安全 history.back()，
 * 否则（冷启动 replace 直进 / 深链）原地 replace 到封面，避免多退一层。
 */
let sessionPrevRoute: Route | null = null;
let sessionCurrentRoute: Route | null = null;

/** 返回会话内最近一次路由（当前路由之前的那一格） */
export function previousRoute(): Route | null {
  return sessionPrevRoute;
}

/** 阅读页返回判断：history 栈上一格是否为同一词条的封面路由。
 * 注意：仅用于「跳过冗余的栈修复」这类优化判断；返回正确性由阅读页的
 * replaceState+navigate 栈重建 + popstate 桥接保证，不依赖本函数。 */
export function canBackToCover(slug: string): boolean {
  const prev = sessionPrevRoute;
  if (!prev) return false;
  if (prev.name !== 'entry' && prev.name !== 'entry-cover') return false;
  return prev.slug === slug;
}

/** 读取当前 hash 并构造 href（保证首屏 SSR-less 下也一致） */
function currentHash(): string {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

/** 订阅 hash 变化的 hook */
export function useHashRoute(): Route {
  const [hash, setHash] = useState<string>(() => currentHash());

  useEffect(() => {
    // 建立会话轨迹基线：把当前路由记为「当前」，此前无可回溯路由
    if (!sessionCurrentRoute) {
      sessionCurrentRoute = parseHash(currentHash());
    }
    const onChange = (): void => {
      const nextHash = currentHash();
      const nextRoute = parseHash(nextHash);
      sessionPrevRoute = sessionCurrentRoute;
      sessionCurrentRoute = nextRoute;
      setHash(nextHash);
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    // 注意：空 hash 的规范化由 App.bootstrapRoute() 在首帧渲染前同步完成（见 main.tsx），
    // 此处不再于 effect 里补 replace('#/')，否则会在首帧后触发一次多余的中转跳转。
    // 同时监听 hashchange 与 popstate：返回键驱动的 history.back() 在部分 WebView
    // 上可能只派发 popstate 而不补发 hashchange，两条都听保证路由一定随地址刷新。
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);

  return parseHash(hash);
}

interface LinkProps {
  to: string;
  children: ReactNode;
  className?: string;
  title?: string;
  /** 行内样式：列表项需要 flex 抢占剩余宽度等场景（纯增量字段，不影响既有调用） */
  style?: CSSProperties;
}

/** 站内导航链接（等价于 <a href="#/xxx">，统一入口便于后续埋点） */
export function Link({ to, children, className, title, style }: LinkProps): JSX.Element {
  const href = to.startsWith('#') ? to : `#${to}`;
  return (
    <a className={className} href={href} title={title} style={style}>
      {children}
    </a>
  );
}
