/**
 * Web 阅读端入口。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App, { bootstrapRoute } from './App';
import './styles.css';

// 关键：在 React 首帧渲染之前完成冷启动路由规范化。
// Android 冷启动会恢复上次 URL（hash 可能仍是 #/entry-reader/...），
// 若等渲染后再纠正会出现「先停在阅读页再跳首页」的闪烁。先同步规范化到 #/，
// 使 React 首帧即渲染首页（深链仍被尊重）。
bootstrapRoute();

// 离线优先：注册手写 Service Worker（public/sw.js 会被 Vite 原样拷到 dist 根），仅在 web 端生效。
// 使用 import.meta.env.BASE_URL 拼接，兼容子路径部署（Vite base 为 './'）；注册失败静默忽略。
// P0-perf：把注册时机从 `load`（所有资源下载完成后）提前到 DOMContentLoaded，
// 通常早 1-2s，让 install 阶段预缓存首屏三件套尽早开始下载。
if ('serviceWorker' in navigator) {
  const register = (): void => {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + 'sw.js')
      .catch(() => undefined);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', register, { once: true });
  } else {
    register();
  }
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('未找到 #root 挂载点');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
