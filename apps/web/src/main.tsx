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

const container = document.getElementById('root');
if (!container) {
  throw new Error('未找到 #root 挂载点');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
