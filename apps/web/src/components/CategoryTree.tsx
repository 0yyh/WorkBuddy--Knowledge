/**
 * 类目树（taxonomy 驱动）。点击叶节点 → #/browse/:catId。
 */
import { Link } from '../router';
import type { CategoryView } from '../types';

interface CategoryTreeProps {
  views: CategoryView[];
  activeId?: string;
}

export function CategoryTree({ views, activeId }: CategoryTreeProps): JSX.Element {
  if (views.length === 0) {
    return <p className="empty">暂无类目（请确认 content/index/taxonomy.json 已同步）</p>;
  }

  const renderLevel = (nodes: CategoryView[], depth: number): JSX.Element => (
    <ul className={`tree-level tree-depth-${depth}`}>
      {nodes.map((node) => {
        const active = node.id === activeId;
        return (
          <li key={node.id} className="tree-item">
            <div className="tree-row">
              <Link
                to={`/browse/${encodeURIComponent(node.id)}`}
                className={`tree-label${active ? ' is-active' : ''}`}
                title={node.path}
              >
                {node.title}
              </Link>
              <span className="tree-count">{node.count}</span>
            </div>
            {node.children.length > 0 ? renderLevel(node.children, depth + 1) : null}
          </li>
        );
      })}
    </ul>
  );

  return <div className="tree">{renderLevel(views, 0)}</div>;
}
