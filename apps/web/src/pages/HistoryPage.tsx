/**
 * "看过"页：按「今天 / 昨天 / 本周 / 更早」分组（分组标题吸顶），
 * 每项显示标题 + 相对时间 + 阅读进度条；顶部提供清空入口（自定义确认弹窗）。
 */
import { useMemo, useState } from 'react';
import { Link } from '../router';
import { getHistory, clearHistory, removeFromHistory, type HistoryItem } from '../lib/history';
import { formatRelative } from '../lib/relativeTime';
import { ConfirmDialog } from '../components/ConfirmDialog';

type Bucket = '今天' | '昨天' | '本周' | '更早';

const BUCKET_ORDER: Bucket[] = ['今天', '昨天', '本周', '更早'];

/** 把时间戳归入日期分组（按本地自然日） */
function bucketOf(ts: number, now: number): Bucket {
  const DAY = 86_400_000;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const today0 = startOfToday.getTime();
  const diffDays = Math.floor((today0 - ts) / DAY);
  if (diffDays <= 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays <= 7) return '本周';
  return '更早';
}

export function HistoryPage(): JSX.Element {
  // 改：items 改由 useState 承载（原为 useMemo 只在挂载时算一次，删单条后无法刷新）
  const [items, setItems] = useState<HistoryItem[]>(() => getHistory());
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);

  const grouped = useMemo(() => {
    const now = Date.now();
    const map = new Map<Bucket, HistoryItem[]>();
    for (const it of items) {
      const b = bucketOf(it.timestamp, now);
      const arr = map.get(b) ?? [];
      arr.push(it);
      map.set(b, arr);
    }
    return BUCKET_ORDER.filter((b) => (map.get(b)?.length ?? 0) > 0).map((b) => ({
      bucket: b,
      list: map.get(b) as HistoryItem[],
    }));
  }, [items]);

  return (
    <div className="page">
      <div className="history-head">
        <h1 className="page-title">看过</h1>
        {items.length > 0 ? (
          <button type="button" className="btn btn-ghost btn-danger history-clear" onClick={() => setConfirmOpen(true)}>
            清空
          </button>
        ) : null}
      </div>
      <p className="page-sub">按时间倒序，最近阅读在最上方（本地保存最近 200 条）</p>

      {items.length === 0 ? (
        <p className="empty">还没有阅读记录</p>
      ) : (
        grouped.map(({ bucket, list }) => (
          <section key={bucket} className="history-group">
            <h2 className="history-group-title">{bucket}</h2>
            <ul className="history-list">
              {list.map((it) => {
                const pct = typeof it.progress === 'number' ? it.progress : 0;
                return (
                  <li
                    key={`${it.slug}-${it.timestamp}`}
                    className="history-item"
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <Link
                      to={`/entry/${encodeURIComponent(it.slug)}`}
                      className="history-link"
                      style={{ flex: '1 1 auto', minWidth: 0 }}
                    >
                      <span className="history-title">{it.title}</span>
                      <span className="history-meta">
                        <span className="history-time">{formatRelative(it.timestamp)}</span>
                        <span className="history-progress" aria-label={`阅读进度 ${pct}%`}>
                          <span className="history-progress-bar" style={{ width: `${pct}%` }} />
                        </span>
                      </span>
                    </Link>
                    {/* P3-2：单条删除。刻意放在 <Link> 外层，避免 <button> 嵌 <a> 的非法结构 */}
                    <button
                      type="button"
                      className="history-item-del"
                      aria-label={`删除《${it.title}》的阅读记录`}
                      title="删除这条记录"
                      onClick={() => setItems(removeFromHistory(it.slug, it.timestamp))}
                      style={{
                        flex: '0 0 auto',
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-dim)',
                        fontSize: 18,
                        lineHeight: 1,
                        cursor: 'pointer',
                      }}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <ConfirmDialog
        visible={confirmOpen}
        danger
        title="清空阅读历史"
        message="将删除全部阅读历史记录，此操作不可恢复。"
        confirmText="确认清空"
        cancelText="取消"
        onConfirm={() => {
          clearHistory();
          setItems([]);
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
