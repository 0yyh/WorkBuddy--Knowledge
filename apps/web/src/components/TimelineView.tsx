/**
 * 时间轴视图：按 Track.items 顺序渲染；跨双轨条目加「双轨」标记。
 */
import { Link } from '../router';
import type { TimelineRow } from '../types';
import styles from './TimelineView.module.css';

interface TimelineViewProps {
  rows: TimelineRow[];
  title: string;
  description?: string;
  timeline?: 'world' | 'china';
}

export function TimelineView({ rows, title, description }: TimelineViewProps): JSX.Element {
  return (
    <section className={styles['timeline-view']}>
      <header className={styles['timeline-head']}>
        <div>
          <h1 className="page-title">{title}</h1>
          {description ? <p className="page-sub">{description}</p> : null}
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="empty">该序列暂无条目</p>
      ) : (
        <ol className={styles['timeline']}>
          {rows.map((row, i) => {
            const inner = (
              <>
                <div className={styles['tl-rail']} aria-hidden="true">
                  <span className={styles['tl-dot']} />
                </div>
                <div className={styles['tl-date']}>
                  <span className={styles['tl-order']}>{row.item.order}</span>
                  {row.item.date_label ? <span className={styles['tl-year']}>{row.item.date_label}</span> : null}
                  {row.item.sort_date !== undefined ? (
                    <span className={styles['tl-sort']}>{row.item.sort_date}</span>
                  ) : null}
                </div>
                <div className={styles['tl-body']}>
                  <div className={styles['tl-title-row']}>
                    {row.exists || row.item.title ? (
                      <span className={styles['tl-title']}>{row.title}</span>
                    ) : (
                      <span className={`${styles['tl-title']} is-missing`}>{row.title}（未录入）</span>
                    )}
                    {row.item.era ? <span className="chip chip-era">{row.item.era}</span> : null}
                  </div>
                  {row.summary ? <p className={styles['tl-summary']}>{row.summary}</p> : null}
                  {row.item.note ? <p className={styles['tl-note']}>{row.item.note}</p> : null}
                </div>
              </>
            );
            return (
              <li
                key={`${row.item.entry}-${i}`}
                className={`${styles['tl-item']}${row.exists ? ' has-link' : ''}`}
              >
                {row.exists ? (
                  <Link to={`/entry/${encodeURIComponent(row.item.entry)}`} className={styles['tl-card-link']}>
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
