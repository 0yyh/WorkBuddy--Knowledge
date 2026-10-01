/**
 * 路由懒加载兜底骨架屏（Sprint 3 · 首屏/启动资源与预取优化）。
 *
 * 路由切换 / 首屏进入某页面时，懒加载 chunk 未就绪前用此骨架占位，
 * 以「微光呼吸」的卡片栅格替代原本的空白或「加载中…」文案，
 * 降低感知等待、避免内容突兀闪现。
 *
 * - 纯 CSS 动画，无额外依赖；尺寸用 token，深浅主题自适应。
 * - `aria-hidden` 避免读屏重复播报；尊重 `prefers-reduced-motion`（见 styles.css）。
 */
import type { CSSProperties } from 'react';

interface PageSkeletonProps {
  /** grid：首页/类目等卡片栅格；list：时间线/历史等单列列表。 */
  variant?: 'grid' | 'list';
}

export function PageSkeleton({ variant = 'grid' }: PageSkeletonProps): JSX.Element {
  const count = variant === 'grid' ? 8 : 6;
  const cards = Array.from({ length: count });

  return (
    <div className="page-skeleton" aria-hidden="true">
      <div className="sk-hero" />
      <div className={`sk-grid sk-${variant}`}>
        {cards.map((_, i) => (
          <div className="sk-card" key={i}>
            <span className="sk-thumb" />
            <span className="sk-line sk-w70" />
            <span className="sk-line sk-w45" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 供阅读页等长内容页使用的单列骨架（hero + 段落条）。 */
export function ReaderSkeleton(): JSX.Element {
  const lines = Array.from({ length: 10 });
  return (
    <div className="reader-skeleton" aria-hidden="true">
      <span className="sk-line sk-w55 sk-title" />
      {lines.map((_, i) => (
        <span
          className="sk-line sk-para"
          key={i}
          style={{ width: `${62 + ((i * 7) % 34)}%` } as CSSProperties}
        />
      ))}
    </div>
  );
}
