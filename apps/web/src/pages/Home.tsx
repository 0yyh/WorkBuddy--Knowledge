/**
 * 首页（V5 类目导航改造）：
 *   标题 → 统计卡（4 格）→ 时间线 banner（品牌色 + 双轨 pill）
 *   → L1 类目卡片网格（5 张，点按定位到下方折叠组）
 *   → 5 组 L1 的 L2/L3 折叠树（默认折叠，点 L2 头部就地展开，L3 → #/browse/:catId）
 *
 * 数据来源不变：manifest.stats 与 useStation().categoryViews / tracks。
 * 折叠树是本页内部组件（CollapsibleCategoryTree），components/CategoryTree 保留给 BrowsePage。
 */
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link } from '../router';
import { useStation } from '../state/AppContext';
import { getLastRead } from '../lib/history';
import type { CategoryView } from '../types';

interface L1Visual {
  /** 角色块里的单汉字 */
  icon: string;
  /** 角色块背景（CSS 变量引用） */
  bg: string;
  /** 角色块文字色 */
  fg: string;
}

/**
 * L1 配色表：严格按评审锁定的五组色，不引其它色。
 * 键为 L1 标题全匹配；未来新增 L1 走 L1_FALLBACK 灰。
 */
const L1_VISUAL: Record<string, L1Visual> = {
  历史: { icon: '史', bg: 'var(--c-amber-50)', fg: 'var(--c-amber-600)' },
  哲学: { icon: '哲', bg: 'var(--c-purple-50)', fg: 'var(--c-purple-600)' },
  科学: { icon: '理', bg: 'var(--c-green-50)', fg: 'var(--c-green-600)' },
  经济学: { icon: '经', bg: 'var(--c-blue-50)', fg: 'var(--c-blue-600)' },
  政治理论: { icon: '政', bg: 'var(--c-coral-50)', fg: 'var(--c-coral-600)' },
};

/** 未收录的 L1 用中性灰，避免出现"没配色"的裸卡片 */
const L1_FALLBACK: L1Visual = {
  icon: '类',
  bg: 'var(--c-gray-50, var(--bg-soft))',
  fg: 'var(--c-gray-600, var(--text-soft))',
};

function l1VisualOf(title: string): L1Visual {
  return L1_VISUAL[title] ?? L1_FALLBACK;
}

/** 字数 ≥ 1 万折算成「万」，避免统计格被长数字撑破 */
function formatWords(words: number): string {
  if (words >= 10000) {
    const wan = words / 10000;
    return `${wan >= 10 ? String(Math.round(wan)) : wan.toFixed(1)}万`;
  }
  return words.toLocaleString();
}

interface StatCell {
  num: string;
  unit: string;
}

/** L1 分组 id（供卡片点击定位） */
function groupDomId(l1Id: string): string {
  return `l1-group-${l1Id}`;
}

/**
 * L1 折叠组：L1 标题 → L2 头部（可展开）→ L3 叶子（跳 browse）。
 * 展开状态是本地 Set，同一 L1 内多个 L2 互不干扰。
 */
function CollapsibleCategoryTree({ views }: { views: CategoryView[] }): JSX.Element {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set<string>());
  // 读取「仅本节点主键归属」的词条，用于混合节点展开时显式列出「本类词条」，
  // 让父级计数 = 本组条目数 + 各子分类计数之和，肉眼可对账。
  const { nodeOwnSlugs, slugMap } = useStation();

  const toggle = useCallback((id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (views.length === 0) {
    return <p className="empty">暂无类目（请确认 content/index/taxonomy.json 已同步）</p>;
  }

  return (
    <div className="home-tree-list">
      {views.map((l1) => (
        <section key={l1.id} id={groupDomId(l1.id)} className="l2-group">
          <h3 className="l1-head">
            <Link to={`/browse/${encodeURIComponent(l1.id)}`} className="l1-head-link">
              <span className="l1-head-name">{l1.title}</span>
              <span className="l1-head-count">{l1.count} 词条</span>
            </Link>
          </h3>

          <ul className="l2-list">
            {l1.children.map((l2) => {
              const open = expanded.has(l2.id);
              const isLeaf = l2.children.length === 0;
              return (
                <li key={l2.id} className="l2-item">
                  <div className="l2-head">
                    {/* 类目标题始终可点进 browse，精确罗列该分类下全部 count 词条，
                        解决「有计数但展开无子项」的观感不一致。 */}
                    <Link to={`/browse/${encodeURIComponent(l2.id)}`} className="l2-head-main">
                      <span className="l2-name">{l2.title}</span>
                      <span className="l2-count">{l2.count}</span>
                    </Link>
                    {!isLeaf ? (
                      <button
                        type="button"
                        className="l2-caret"
                        aria-expanded={open}
                        aria-label={open ? '收起' : '展开'}
                        onClick={() => toggle(l2.id)}
                      >
                        {open ? '▾' : '▸'}
                      </button>
                    ) : null}
                  </div>

                  {open ? (
                    <div className="l2-expand">
                      {/* 混合节点（既有本类直接词条、又有子分类）：把「本类词条」单独成组列出，
                          使父级计数 = 本组条目数 + 各子分类计数之和，肉眼可对账。
                          例：金融(6) = 本类直接词条(3) + 货币与银行(2) + 资本市场与资产(1)。 */}
                      {((): JSX.Element | null => {
                        const own = nodeOwnSlugs.get(l2.id) ?? [];
                        if (isLeaf || own.length === 0) return null;
                        return (
                          <ul className="l3-list l3-own-list">
                            <li className="l3-own-head" key={`${l2.id}-own`}>
                              本类直接词条（{own.length}）
                            </li>
                            {own.map((slug, i) => {
                              const item = slugMap.get(slug);
                              const title = item?.t ?? slug;
                              return (
                                <li key={slug} style={{ '--i': i } as CSSProperties}>
                                  <Link
                                    to={`/entry-reader/${encodeURIComponent(slug)}`}
                                    className="l3-row l3-own-row"
                                  >
                                    <span className="l3-name">{title}</span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        );
                      })()}
                      {!isLeaf ? (
                        <ul className="l3-list">
                          {l2.children.map((l3, i) => (
                            //  stagger 序号挂在 li 上：router 的 Link 不接受 style prop（红线：不改 router.tsx）
                            <li key={l3.id} style={{ '--i': i } as CSSProperties}>
                              <Link to={`/browse/${encodeURIComponent(l3.id)}`} className="l3-row">
                                <span className="l3-name">{l3.title}</span>
                                <span className="l3-count">{l3.count}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {isLeaf && l2.count > 0 ? (
                        <p className="l2-empty-note">
                          该分类下 {l2.count} 条词条直接归属，点击上方标题查看
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function HomePage(): JSX.Element {
  const { manifest, categoryViews, tracks, getTrack, slugMap } = useStation();
  const stats = manifest?.stats;

  // 续读卡片：取上次阅读位置；标题/章节总数来自 slugMap 分片。
  const lastRead = getLastRead();
  const lastItem = lastRead ? slugMap.get(lastRead.slug) : undefined;
  const lastTitle = lastItem?.t ?? lastRead?.slug ?? '';
  const lastTotalCh = lastItem?.sc ?? 0;
  const lastPct = lastRead && lastTotalCh > 0 ? Math.round((lastRead.chapterIndex / lastTotalCh) * 100) : 0;

  // 时间线双轨条目数：TrackSummary 不含 count，按需拉一次序列取 items.length
  const [trackCounts, setTrackCounts] = useState<{ china: number | null; world: number | null }>({
    china: null,
    world: null,
  });

  useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      let china: number | null = null;
      let world: number | null = null;
      for (const summary of tracks) {
        if (summary.timeline !== 'china' && summary.timeline !== 'world') continue;
        try {
          const track = await getTrack(summary.id);
          const n = track.items.length;
          if (summary.timeline === 'china') china = (china ?? 0) + n;
          else world = (world ?? 0) + n;
        } catch {
          /* 单条序列读取失败不影响首页渲染 */
        }
      }
      if (alive) setTrackCounts({ china, world });
    };
    void load();
    return () => {
      alive = false;
    };
  }, [tracks, getTrack]);

  const statCells: StatCell[] = stats
    ? [
        { num: String(stats.entries), unit: '词条' },
        { num: String(stats.sections), unit: '章节' },
        { num: String(stats.categories), unit: '类目' },
        { num: formatWords(stats.words), unit: '字' },
      ]
    : [];

  /** L1 卡片 → 定位到下方对应折叠组（当前页 anchor scroll，不改 hash） */
  const scrollToGroup = useCallback((l1Id: string): void => {
    const el = document.getElementById(groupDomId(l1Id));
    if (!el) return;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, []);

  return (
    <div className="page home-page">
      <h1 className="home-title">知识</h1>

      {lastRead && lastTitle ? (
        <Link
          to={`/entry-reader/${encodeURIComponent(lastRead.slug)}`}
          className="resume-card card card-hover"
        >
          <div className="resume-left">
            <span className="resume-label">继续阅读</span>
            <span className="resume-title">{lastTitle}</span>
          </div>
          <div className="resume-right">
            {lastTotalCh > 0 ? (
              <span className="resume-progress">
                {lastPct}% · 第 {Math.min(lastRead.chapterIndex + 1, lastTotalCh)}/{lastTotalCh} 部分
              </span>
            ) : null}
            <span className="resume-arrow" aria-hidden="true">
              →
            </span>
          </div>
        </Link>
      ) : null}

      {statCells.length > 0 ? (
        <div className="stat-strip">
          {statCells.map((cell) => (
            <div key={cell.unit} className="stat-card">
              <span className="stat-num">{cell.num}</span>
              <span className="stat-unit">{cell.unit}</span>
            </div>
          ))}
        </div>
      ) : null}

      <Link to="/timeline" className="timeline-card card card-hover">
        <span className="timeline-card-main">
          <strong className="timeline-card-title">时间线</strong>
          <span className="timeline-card-sub">按时间顺序浏览历史脉络 · 中国史 / 世界史双轨</span>
          <span className="timeline-pills">
            <span className="timeline-pill">
              <span className="timeline-pill-dot" aria-hidden="true" />
              中国史{trackCounts.china != null ? ` · ${trackCounts.china}` : ''}
            </span>
            <span className="timeline-pill is-world">
              <span className="timeline-pill-dot" aria-hidden="true" />
              世界史{trackCounts.world != null ? ` · ${trackCounts.world}` : ''}
            </span>
          </span>
        </span>
        <span className="timeline-card-arrow" aria-hidden="true">
          →
        </span>
      </Link>

      <section className="home-l1">
        <h2 className="section-title">分类浏览</h2>
        <div className="l1-grid">
          {categoryViews.map((l1, i) => {
            const visual = l1VisualOf(l1.title);
            return (
              <button
                key={l1.id}
                type="button"
                className="l1-card"
                style={{ '--i': i } as CSSProperties}
                onClick={() => scrollToGroup(l1.id)}
              >
                <span className="l1-icon" style={{ background: visual.bg, color: visual.fg }}>
                  {visual.icon}
                </span>
                <span className="l1-name">{l1.title}</span>
                <span className="l1-count">{l1.count} 词条</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="home-tree">
        <h2 className="section-title">全部类目</h2>
        <CollapsibleCategoryTree views={categoryViews} />
      </section>
    </div>
  );
}
