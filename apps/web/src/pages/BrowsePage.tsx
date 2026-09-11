/**
 * 类目浏览页 #/browse/:catId：
 *   标题 → 子类目卡片网格（直接下钻，承接首页 L1 卡片点击）
 *   → 该类目（含子孙）下的全部词条。
 */
import { Link, navigate } from '../router';
import { CategoryTree } from '../components/CategoryTree';
import { useStation } from '../state/AppContext';
import type { EntryIndexItem } from '@pks/core';

interface BrowsePageProps {
  catId: string;
}

export function BrowsePage({ catId }: BrowsePageProps): JSX.Element {
  // nodeSlugs 与首页计数同源（主键分区）：浏览列表 == 类目计数，标签与条目数永远一致
  const { nodeById, slugMap, categoryViews, categoryCounts, nodeSlugs } = useStation();
  const node = nodeById.get(catId);

  if (!node) {
    return (
      <div className="page state-box">
        <div className="error-card">
          <h2>未找到该类目</h2>
          <p className="error-msg">
            类目 <code>{catId}</code> 不在 taxonomy 中。
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
            回到首页
          </button>
        </div>
      </div>
    );
  }

  const slugs = nodeSlugs.get(node.id) ?? [];
  const items: EntryIndexItem[] = slugs
    .map((s) => slugMap.get(s))
    .filter((x): x is EntryIndexItem => Boolean(x));

  // 直接子类目：首页 L1 卡片点进来先看到主题下的分支，再逐层下钻
  const children = node.children ?? [];

  return (
    <div className="page browse-layout">
      <aside className="browse-side">
        <h2 className="section-title">全部分类</h2>
        <CategoryTree views={categoryViews} activeId={catId} />
      </aside>

      <section className="browse-main">
        <h1 className="page-title">{node.title}</h1>

        {children.length > 0 ? (
          <nav className="browse-subs" aria-label="子类目">
            <div className="browse-subs-grid">
              {children.map((child) => (
                <Link
                  key={child.id}
                  to={`/browse/${encodeURIComponent(child.id)}`}
                  className="browse-sub-card"
                >
                  <span className="browse-sub-main">
                    <span className="browse-sub-name">{child.title}</span>
                    <span className="browse-sub-count">
                      {categoryCounts.get(child.id) ?? 0} 词条
                    </span>
                  </span>
                  <span className="browse-sub-arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </nav>
        ) : null}

        {items.length === 0 ? (
          <p className="empty">该类目暂无已发布词条</p>
        ) : (
          <ul className="card-list">
            {items.map((item) => (
              <li key={item.s} className="card card-hover entry-card">
                <Link to={`/entry/${encodeURIComponent(item.s)}`} className="entry-card-link">
                  <span className="card-title link-strong">{item.t}</span>
                  <p className="clamp-3">{item.sm}</p>
                  <span className="meta-row meta-row-sm">
                    {item.sc > 0 ? <span className="dim">{item.sc} 章节</span> : null}
                    {item.ctl === 1 ? <span className="badge badge-cross">双轨</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
