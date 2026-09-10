/**
 * 底部标签栏（≤700px 显示）：首页 / 搜索 / 看过 / 我的。
 * 阅读页（isReader）整体不渲染；沉浸态由 CSS opacity 过渡隐藏。
 * 设置不再占独立 Tab，收进「我的」页（符合阅读 App 习惯，避免反模式）。
 */
import { Link, useHashRoute } from '../router';
import { useImmersive } from '../state/ImmersiveContext';
import type { Route } from '../types';

interface TabDef {
  to: string;
  icon: string;
  label: string;
  isActive: (route: Route) => boolean;
}

const TABS: TabDef[] = [
  { to: '/', icon: '⌂', label: '首页', isActive: (r) => r.name === 'home' },
  { to: '/search', icon: '⌕', label: '搜索', isActive: (r) => r.name === 'search' },
  { to: '/history', icon: '◷', label: '看过', isActive: (r) => r.name === 'history' },
  { to: '/me', icon: '☻', label: '我的', isActive: (r) => r.name === 'me' || r.name === 'settings' },
];

export function TabBar(): JSX.Element | null {
  const route = useHashRoute();
  const { isReader } = useImmersive();

  if (isReader) return null;

  return (
    <nav className="app-tabbar" aria-label="主导航">
      {TABS.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          className={`tab-item${tab.isActive(route) ? ' is-active' : ''}`}
        >
          <span className="tab-icon" aria-hidden="true">
            {tab.icon}
          </span>
          <span className="tab-label">{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
