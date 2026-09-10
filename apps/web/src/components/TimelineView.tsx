/**
 * 时间轴视图：按 Track.items 顺序渲染；跨双轨条目加「双轨」标记。
 */
import { Link } from '../router';
import type { TimelineRow } from '../types';

interface TimelineViewProps {
  rows: TimelineRow[];
  title: string;
  description?: string;
  timeline?: 'world' | 'china';
}

export function TimelineView({ rows, title, description }: TimelineViewProps): JSX.Element {
  return (
    <section className="timeline-view">
      <header className="timeline-head">
        <div>
          <h1 className="page-title">{title}</h1>
          {description ? <p className="page-sub">{description}</p> : null}
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="empty">该序列暂无条目</p>
      ) : (
        <ol className="timeline">
          {rows.map((row, i) => {
            const inner = (
              <>
                <div className="tl-rail" aria-hidden="true">
                  <span className="tl-dot" />
                </div>
                <div className="tl-date">
                  <span className="tl-order">{row.item.order}</span>
                  {row.item.date_label ? <span className="tl-year">{row.item.date_label}</span> : null}
                  {row.item.sort_date !== undefined ? (
                    <span className="tl-sort">{row.item.sort_date}</span>
                  ) : null}
                </div>
                <div className="tl-body">
                  <div className="tl-title-row">
                    {row.exists ? (
                      <span className="tl-title">{row.title}</span>
                    ) : (
                      <span className="tl-title is-missing">{row.title}（未录入）</span>
                    )}
                    {row.item.era ? <span className="chip chip-era">{row.item.era}</span> : null}
                  </div>
                  {row.summary ? <p className="tl-summary">{row.summary}</p> : null}
                  {row.item.note ? <p className="tl-note">{row.item.note}</p> : null}
                </div>
              </>
            );
            return (
              <li
                key={`${row.item.entry}-${i}`}
                className={`tl-item${row.exists ? ' has-link' : ''}`}
              >
                {row.exists ? (
                  <Link to={`/entry/${encodeURIComponent(row.item.entry)}`} className="tl-card-link">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
