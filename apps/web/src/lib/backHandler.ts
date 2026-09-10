/**
 * 原生返回键桥接（Android / Capacitor）。
 *
 * 背景：Android WebView 对「纯 hash 历史项」的物理返回行为与浏览器不一致 ——
 * 浏览器保证的 popstate / hashchange 在真机上可能根本不派发，导致阅读页按系统
 * 返回键直接穿透到栈底退出 App。因此改由原生层（MainActivity.onBackPressed）
 * 拦截，并通过 evaluateJavascript 调用 window.__pksHandleBack()。
 *
 * 返回层级约定（"不断返回会回到首页"）：
 *   entry-reader 阅读页 → 原地 replace 到 entry-cover 封面
 *   封面/内页/其它 tab → history.back() 逐级回退；无可退时回首页
 *   home 首页         → 第一按弹"再按一次退出知识"提示并进入待退状态；
 *                       2.2s 内再次在首页按返回 → 返回 false 交给原生真退出
 *
 * 约定：
 *   返回 true  = Web 层已处理，原生不要退出 App
 *   返回 false = 当前已在首页且用户确认退出，交给原生真退出
 *
 * 浏览器 / 桌面端没有这个原生通道，EntryReaderPage 里的 popstate 兜底逻辑保留，
 * 两条路径互不冲突。
 */
import { parseHash, replaceRoute } from '../router';

/** 供原生 evaluateJavascript 调用的全局钩子类型声明 */
declare global {
  interface Window {
    __pksHandleBack?: () => boolean;
  }
}

/** 可插拔的「返回拦截器」：返回 true 表示已消费（例如先关掉浮层） */
export type BackInterceptor = () => boolean;

let overlayInterceptor: BackInterceptor | null = null;

/** 注册 / 注销返回拦截器（阅读页用它来优先关闭目录、设置浮层） */
export function setBackInterceptor(fn: BackInterceptor | null): void {
  overlayInterceptor = fn;
}

/* ------------------------- 首页双击退出 ------------------------- */
/** 是否已在首页处于"待退出"状态（2.2s 内再按才退出） */
let exitArmed = false;
let exitArmedHash = '';
let exitArmedAt = 0;
/** React 层注册的提示显示回调：显示"再按一次退出知识"浮层 */
let exitHintCallback: (() => void) | null = null;
/** 首页双击退出确认窗口（毫秒） */
const EXIT_WINDOW_MS = 2200;

/** 判断当前 hash 是否为首页（首页是"最高一级"，只有它触发双击退出） */
function isHomeRoute(hash: string): boolean {
  return parseHash(hash).name === 'home';
}

/** React 挂载时注册：首页按返回弹出提示浮层 */
export function registerExitHint(fn: () => void): () => void {
  exitHintCallback = fn;
  return () => {
    exitHintCallback = null;
  };
}

/** 首页按返回的处理：首次弹提示并进入待退，第二次（仍在首页、窗口内）才真退出 */
function handleHomeBack(): boolean {
  const now = Date.now();
  const hash = window.location.hash;
  if (exitArmed && exitArmedHash === hash && now - exitArmedAt < EXIT_WINDOW_MS) {
    // 用户确认退出
    exitArmed = false;
    return false; // 交给原生真退出
  }
  // 第一次（或超时/离开了首页后回来）：弹提示 + 进入待退
  exitArmed = true;
  exitArmedAt = now;
  exitArmedHash = hash;
  try {
    exitHintCallback?.();
  } catch {
    /* 提示回调异常不应阻断返回链路 */
  }
  return true;
}

/** 从首页路由离开时清除待退状态（避免用户跳去别的 tab 再快速返回造成误退出） */
function resetExitArmIfLeftHome(): void {
  if (exitArmed && !isHomeRoute(window.location.hash)) {
    exitArmed = false;
  }
}

/** 从 `#/entry-reader/{slug}` 中取出 slug；非阅读页返回 null */
export function readerSlugOf(hash: string): string | null {
  const prefix = '#/entry-reader/';
  if (!hash.startsWith(prefix)) return null;
  const raw = hash.slice(prefix.length).split('?')[0];
  return raw ? decodeURIComponent(raw) : null;
}

/**
 * 原生返回键实际执行的 Web 侧逻辑。
 *
 * 阅读页用 replaceRoute（location.replace）而不是 navigate（push）：
 * navigate 会再压一条历史，下一次返回又会弹回阅读页，形成「返回死循环」；
 * replace 把阅读页那条直接换成封面，栈不增长且一定能落到封面。
 */
export function handleNativeBack(): boolean {
  if (typeof window === 'undefined') return false;

  // 1) 浮层优先：目录 / 阅读设置打开时，先关浮层，不翻页也不退出
  if (overlayInterceptor) {
    try {
      if (overlayInterceptor()) return true;
    } catch {
      /* 拦截器异常不应阻断返回链路，继续走下面的兜底 */
    }
  }

  const hash = window.location.hash;

  // 2) 阅读页 → 原地换成封面（绝不退出 App）
  const slug = readerSlugOf(hash);
  if (slug) {
    replaceRoute(`/entry-cover/${encodeURIComponent(slug)}`);
    return true;
  }

  // 3) 首页（最高一级）→ 双击退出确认
  if (isHomeRoute(hash)) {
    return handleHomeBack();
  }

  // 4) 其它内页 / 非首页 tab → 逐级回退一格；无可退时兜底回首页
  if (window.history.length > 1) {
    window.history.back();
    return true;
  }
  replaceRoute('/');
  return true;
}

/** 把回调挂到 window，供原生调用；返回卸载函数 */
export function installNativeBackHandler(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.__pksHandleBack = handleNativeBack;
  // 离开首页时清除"待退出"态，防止跨 tab 快速往返造成误退出
  window.addEventListener('hashchange', resetExitArmIfLeftHome);
  return () => {
    delete window.__pksHandleBack;
    window.removeEventListener('hashchange', resetExitArmIfLeftHome);
  };
}
