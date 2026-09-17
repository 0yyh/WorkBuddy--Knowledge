/**
 * 搜索页 #/search?q=&full=1：
 *  - L1：标题/别名即时匹配（常驻索引）
 *  - full=1 时异步拉全文分片展示 L2 BM25 结果（按词条分组）
 *  - 关键词高亮（标题 / 摘要中命中片段加亮）
 *  - 标题 / 全文 切换（Segmented 风格）
 *  - 最近搜索历史（localStorage，空查询时展示）
 * 去重规则：全文结果与标题匹配若指向同一 slug，只出一次 —— 优先全文。
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SearchHit, SearchResultGroup } from '@pks/core';
import { SearchBox } from '../components/SearchBox';
import { Spinner } from '../components/Spinner';
import { Link, navigate } from '../router';
import { useStation } from '../state/AppContext';
import { useWindowedSlice } from '../lib/useWindowedSlice';

const RECENT_KEY = 'pks_recentSearches';
const RECENT_LIMIT = 8;

function readRecent(): string[] {
  try {
    const raw = window.localStorage?.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string').slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

/** 写入一条最近搜索（去重 + 置顶 + 截断）并返回更新后的列表 */
function pushRecent(q: string): string[] {
  const term = q.trim();
  if (!term) return readRecent();
  try {
    const cur = readRecent().filter((x) => x !== term);
    const next = [term, ...cur].slice(0, RECENT_LIMIT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    return next;
  } catch {
    return readRecent();
  }
}

/** 关键词高亮：把命中片段拆成 <mark> 片段，大小写不敏感 */
function highlight(text: string, q: string): ReactNode {
  const term = q.trim();
  if (!term) return text;
  const lower = text.toLowerCase();
  const ql = term.toLowerCase();
  const out: ReactNode[] = [];
  let i = 0;
  let idx = lower.indexOf(ql, i);
  let k = 0;
  while (idx !== -1) {
    if (idx > i) out.push(text.slice(i, idx));
    out.push(
      <mark key={k++} className="hl">
        {text.slice(idx, idx + term.length)}
      </mark>,
    );
    i = idx + term.length;
    idx = lower.indexOf(ql, i);
  }
  if (i < text.length) out.push(text.slice(i));
  return out;
}

interface SearchPageProps {
  query: string;
  full: boolean;
}

export function SearchPage({ query, full }: SearchPageProps): JSX.Element {
  const { engine, searchFullText, slugMap } = useStation();
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>(() => readRecent());

  const q = query.trim();

  const allL1: SearchHit[] = useMemo(() => {
    if (!q || !engine) return [];
    return engine.searchL1(q);
  }, [q, engine]);

  useEffect(() => {
    let alive = true;
    setGroups([]);
    setError(null);
    if (!full || !q) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // 同步内存态与 localStorage：否则清空查询后「最近搜索」仍是上一次的旧列表
    setRecent(pushRecent(q));
    searchFullText(q)
      .then((g) => {
        if (alive) setGroups(g);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [q, full, searchFullText]);

  const switchMode = (nextFull: boolean): void => {
    const base = `/search?q=${encodeURIComponent(q)}&full=${nextFull ? '1' : '0'}`;
    navigate(base);
  };

  // 已出现在全文结果中的 slug —— 标题匹配不再重复展示
  const fullSlugs = useMemo(() => new Set(groups.map((g) => g.entry.slug)), [groups]);
  const titleHits = useMemo(() => {
    if (!full) return allL1;
    return allL1.filter((h) => !fullSlugs.has(h.doc.slug));
  }, [allL1, full, fullSlugs]);

  // 标题匹配 section 的可见性：仅在「无全文命中」或「未开全文模式」且自己有命中时显示
  const showTitleSection = (!full || groups.length === 0) && titleHits.length > 0;

  const total = groups.reduce((sum, g) => sum + g.total, 0);

  // P1-3：超阈值才虚拟化；结果少时走旧全量渲染路径（零回归）。
  // result-list 为块级列表（分隔线代替 gap），故 gap=0，步距由首个 <li> 实测回校。
  const groupWin = useWindowedSlice(groups, { rowHeight: 64, gap: 0, overscan: 8, threshold: 60 });
  const titleWin = useWindowedSlice(titleHits, { rowHeight: 64, gap: 0, overscan: 8, threshold: 60 });

  return (
    <div className="page">
      <SearchBox size="large" initialQuery={q} />

      {/* 标题 / 全文 切换 */}
      <div className="search-mode" role="tablist" aria-label="检索范围">
        <button
          type="button"
          role="tab"
          aria-selected={!full}
          className={`search-mode-btn${!full ? ' is-active' : ''}`}
          onClick={() => switchMode(false)}
        >
          标题匹配
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={full}
          className={`search-mode-btn${full ? ' is-active' : ''}`}
          onClick={() => switchMode(true)}
        >
          全文检索
        </button>
      </div>

      {q ? (
        <p className="page-sub">
          关键词：<strong>{q}</strong>
          {full ? ' · 全文检索模式' : ''}
        </p>
      ) : (
        /* 空查询：展示最近搜索 */
        <section className="card recent-card">
          <h2 className="section-title">最近搜索</h2>
          {recent.length === 0 ? (
            <p className="empty">还没有搜索记录</p>
          ) : (
            <div className="recent-chips">
              {recent.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="chip chip-link recent-chip"
                  onClick={() => navigate(`/search?q=${encodeURIComponent(r)}&full=1`)}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {q && full ? (
        <section className="card">
          <h2 className="section-title">
            全文结果 {loading ? '' : `（${total} 处命中 · ${groups.length} 个词条）`}
          </h2>
          {loading ? (
            <div className="state-box state-inline">
              <Spinner size={22} />
              <p className="state-title">正在加载检索分片…</p>
            </div>
          ) : error ? (
            <p className="notice notice-error">{error}</p>
          ) : groups.length === 0 ? (
            <p className="empty">没有命中结果，试试更短的关键词</p>
          ) : (
            <ul
              ref={groupWin.listRef}
              className="result-list"
              style={groupWin.padTop || groupWin.padBottom ? { paddingTop: groupWin.padTop, paddingBottom: groupWin.padBottom } : undefined}
            >
              {groups.slice(groupWin.start, groupWin.end).map((g) => {
                const meta = slugMap.get(g.entry.slug);
                return (
                  <li key={g.entry.slug} className="card result-card">
                    <Link
                      to={`/entry-cover/${encodeURIComponent(g.entry.slug)}`}
                      className="result-card-link"
                    >
                      <span className="result-group-head">
                        <span className="link-strong">{highlight(g.entry.title, q)}</span>
                        <span className="dim">
                          {g.total} 处命中{meta ? ` · ${meta.w} 字` : ''}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {showTitleSection ? (
        <section className="card">
          <h2 className="section-title">标题匹配（{titleHits.length}）</h2>
          <ul
            ref={titleWin.listRef}
            className="result-list"
            style={titleWin.padTop || titleWin.padBottom ? { paddingTop: titleWin.padTop, paddingBottom: titleWin.padBottom } : undefined}
          >
            {titleHits.slice(titleWin.start, titleWin.end).map((h) => {
              const meta = slugMap.get(h.doc.slug);
              return (
                <li key={h.doc.id} className="result-group">
                  <Link
                    to={`/entry-cover/${encodeURIComponent(h.doc.slug)}`}
                    className="result-card-link"
                  >
                    <span className="result-group-head">
                      <span className="link-strong">{highlight(h.doc.title, q)}</span>
                      <span className="dim">{h.doc.words} 字</span>
                    </span>
                    {meta ? <p className="clamp-2">{highlight(meta.sm, q)}</p> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
