/**
 * 应用根组件：StationProvider + ImmersiveProvider + 哈希路由分发。
 * 启动引导：冷启动统一落到首页；深链（带 hash）被尊重；不做自动续读。
 * 路由切到 entry-reader 时把 isReader 置 true（AppShell 隐藏 chrome，阅读页全屏接管）。
 */
import { useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { HomePage } from './pages/Home';
import { BrowsePage } from './pages/BrowsePage';
import { EntryCoverPage } from './pages/EntryCoverPage';
import { EntryReaderPage } from './pages/EntryReaderPage';
import { SearchPage } from './pages/SearchPage';
import { TimelinePage } from './pages/TimelinePage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { MePage } from './pages/MePage';
import { useHashRoute, navigate } from './router';
import { StationProvider } from './state/AppContext';
import { ImmersiveProvider, useImmersive } from './state/ImmersiveContext';
import { ExitToastProvider } from './components/ExitToast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { installPerfGuard } from './lib/perf';
import { applyAllPrefs } from './lib/preferences';
import { installNativeBackHandler } from './lib/backHandler';
import type { Route } from './types';

/** 模块级一次性引导标记：App 冷启动决定初始路由。 */
let bootstrapped = false;

/**
 * 冷启动引导：必须在 **React 首帧渲染之前** 同步执行（见 main.tsx）。
 *
 * 背景：Android 冷启动时 WebView 会恢复「上次提交的 URL」，因此 location.hash
 * 仍会是 `#/entry-reader/...`。若等到 React 首次渲染后再用 location.replace('#/')
 * 纠正，React 会先按旧 hash 渲染一次阅读页，随后 hashchange 再切回首页 →
 * 表现为「先停在阅读页一两秒再跳首页」的闪烁。
 *
 * 因此这里在渲染前把 hash 同步规范化：尊重深链（带 hash 且非空），
 * 否则一律 replace 到 `#/`，使 React 首帧直接渲染首页，不做多余中转。
 * 原因：杀进程后的冷启动与首次安装都是「无有效深链」的冷启动，Web 层无法区分，
 * 故统一进首页；续读入口由首页「继续阅读」卡片承担。
 */
export function bootstrapRoute(): void {
  if (bootstrapped || typeof window === 'undefined') return;
  bootstrapped = true;

  applyAllPrefs(); // 首帧前应用两套偏好

  const hash = window.location.hash;
  if (hash && hash !== '#') return; // 深链直达，尊重当前地址

  // 同步把地址规范化为首页，确保 React 首帧即读到 #/（避免先渲染阅读页再跳转）。
  // location.replace 对 hash 的更新是本步同步生效的，随后 React 读取到的即为 #/。
  window.location.replace('#/');
}

function renderRoute(route: Route): JSX.Element {
  switch (route.name) {
    case 'home':
      return <HomePage />;
    case 'browse':
      return <BrowsePage catId={route.catId} />;
    case 'entry':
    case 'entry-cover':
      return <EntryCoverPage slug={route.slug} />;
    case 'entry-reader':
      return <EntryReaderPage slug={route.slug} chapterStart={route.chapter} />;
    case 'search':
      return <SearchPage query={route.query} full={route.full} />;
    case 'timeline':
      return <TimelinePage trackId={route.trackId} />;
    case 'history':
      return <HistoryPage />;
    case 'settings':
      return <SettingsPage />;
    case 'me':
      return <MePage />;
    case 'not-found':
    default:
      return (
        <div className="page state-box">
          <div className="error-card">
            <h2>页面不存在</h2>
            <p className="error-msg">未知路由：{route.name === 'not-found' ? route.raw : ''}</p>
            <a className="btn btn-primary" href="#/">
              回到首页
            </a>
          </div>
        </div>
      );
  }
}

/** 路由切页时重挂载页面组件（保证各自状态从干净起点开始），但不重挂载头部/标签栏 */
function routeKey(route: Route): string {
  switch (route.name) {
    case 'browse':
      return `browse:${route.catId}`;
    case 'entry':
    case 'entry-cover':
      return `entry-cover:${route.slug}`;
    case 'entry-reader':
      return `entry-reader:${route.slug}`;
    case 'search':
      return `search:${route.query}:${route.full}`;
    case 'timeline':
      return `timeline:${route.trackId}`;
    default:
      return route.name;
  }
}

function Router(): JSX.Element {
  const route = useHashRoute();
  const { setReader } = useImmersive();

  useEffect(() => {
    const isReader = route.name === 'entry-reader';
    setReader(isReader);
    return () => setReader(false);
  }, [route.name, setReader]);

  return (
    <AppShell>
      {/* 错误边界包裹路由主体：阅读页 / 搜索页等渲染异常时显示中文兜底 UI，
          并提供「重新加载」恢复入口，避免整页白屏。 */}
      <ErrorBoundary>
        <div key={routeKey(route)} className="route-fade">
          {renderRoute(route)}
        </div>
      </ErrorBoundary>
    </AppShell>
  );
}

export default function App(): JSX.Element {
  // 兜底：正常情况下 main.tsx 已在 render 前调用 bootstrapRoute() 完成规范化；
  // 这里再调一次是幂等的（bootstrapped 守卫），保证任何入口（含测试/热重载）行为一致。
  bootstrapRoute();

  useEffect(() => {
    // 首帧后兜底：确保 data-* 属性与 CSS 变量始终就绪（如偏好被外部清空）
    applyAllPrefs();
  }, []);

  useEffect(() => {
    // 挂载原生返回键桥接（Android/Capacitor）：供 MainActivity.onBackPressed
    // 通过 evaluateJavascript 调用 window.__pksHandleBack()。
    // 浏览器/桌面不调用原生 onBackPressed，此钩子无副作用，可安全全局挂载。
    return installNativeBackHandler();
  }, []);

  useEffect(() => {
    // 全局崩溃 / 未处理 rejection 可观测：离线优先无远程上报，
    // 仅在页面顶部渲染非阻塞提示条，便于真机自测第一时间发现运行期异常。
    return installPerfGuard();
  }, []);

  return (
    <StationProvider>
      <ImmersiveProvider>
        <ExitToastProvider>
          <Router />
        </ExitToastProvider>
      </ImmersiveProvider>
    </StationProvider>
  );
}
