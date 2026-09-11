/**
 * 首页（V7 类目导航收敛）：
 *   标题 → 统计卡（4 格）→ 时间线 banner（品牌色 + 双轨 pill）
 *   → L1 类目卡片网格（5 张，点按直达 #/browse/:catId）
 *
 * 独立的「全部类目」折叠树已移除：子类目导航全部收敛进类目卡片，
 * 落地页 BrowsePage 顶部直接列出该主题的子类目，随内容增长首页不再变长。
 * 数据来源不变：manifest.stats 与 useStation().categoryViews / tracks。
 * components/CategoryTree 仍保留给 BrowsePage 侧栏。
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from '../router';
import { useStation } from '../state/AppContext';
import { getLastRead } from '../lib/history';

interface L1Visual {
  /** 角色块里的单汉字 */
  icon: string;
  /** 角色块背景（CSS 变量引用） */
  bg: string;
  /** 角色块文字色 */
  fg: string;
}

/**
 * L1 配色表：严格按评审锁定的五组色，色值回退到 tokens.css 的语义变量
 * （--l1-color-* / --l1-color-*-soft），便于后续主题化 / 暗色一致。
 * 键为 L1 标题全匹配；未来新增 L1 走 L1_FALLBACK 灰。
 */
const L1_VISUAL: Record<string, L1Visual> = {
  历史: { icon: '史', bg: 'var(--l1-color-history-soft)', fg: 'var(--l1-color-history)' },
  哲学: { icon: '哲', bg: 'var(--l1-color-philosophy-soft)', fg: 'var(--l1-color-philosophy)' },
  科学: { icon: '理', bg: 'var(--l1-color-science-soft)', fg: 'var(--l1-color-science)' },
  经济学: { icon: '经', bg: 'var(--l1-color-economics-soft)', fg: 'var(--l1-color-economics)' },
  政治理论: { icon: '政', bg: 'var(--l1-color-politics-soft)', fg: 'var(--l1-color-politics)' },
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
              // 卡片直达该主题的类目页：页内列出子类目 + 全部词条（首页不再挂独立类目树）
              <Link
                key={l1.id}
                to={`/browse/${encodeURIComponent(l1.id)}`}
                className="l1-card"
                style={{ '--i': i } as CSSProperties}
              >
                <span className="l1-icon" style={{ background: visual.bg, color: visual.fg }}>
                  {visual.icon}
                </span>
                <span className="l1-name">{l1.title}</span>
                <span className="l1-count">{l1.count} 词条</span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
