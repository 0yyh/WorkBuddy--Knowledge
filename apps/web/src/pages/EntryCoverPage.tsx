/**
 * 词条详情页（cover）：
 *   #/entry/:slug（兼容旧链）与 #/entry-cover/:slug 都渲染本页。
 *   Banner（标题/副标/原名/面包屑）→ 元数据卡（字数/章节/来源/更新/类目）
 *   → 摘要卡 → 章节目录（有多章才显示）→ 相关词条 → 大号「开始阅读」。
 */
import { useEffect, useMemo, useState } from 'react';
import type { EntryCover, EntryIndexItem } from '@pks/core';
import { Spinner } from '../components/Spinner';
import { Link } from '../router';
import { fetchCover } from '../lib/cover';
import { flattenChapterList } from '../lib/content';
import { useStation } from '../state/AppContext';
import { navigate } from '../router';

const TYPE_LABEL: Record<string, string> = {
  concept: '概念',
  work: '著作',
  person: '人物',
  event: '事件',
  term: '术语',
};

const STATUS_LABEL: Record<string, string> = {
  published: '已发布',
  stub: '存根',
  draft: '草稿',
  deprecated: '已废弃',
};

interface EntryCoverPageProps {
  slug: string;
}

/** 从 entries 分片 item 合成最简 cover（老产物无 covers 文件时的回退） */
function synthesizeCover(item: EntryIndexItem, catIdToPath: Map<string, string>): EntryCover {
  return {
    slug: item.s,
    title: item.t,
    summary: item.sm || '',
    categories: (item.c ?? []).map((id) => catIdToPath.get(id) ?? id),
    tags: [],
    word_count: item.w ?? 0,
    sources: [],
    updated_at: item.ua ?? '',
    chapter_count: item.sc ?? 0,
    related: [],
  };
}

function formatDate(iso: string): string {
  if (!iso) return '未知';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function EntryCoverPage({ slug }: EntryCoverPageProps): JSX.Element {
  const { slugMap, nodeByPath, knownSlugs } = useStation();
  const item = slugMap.get(slug);

  const [cover, setCover] = useState<EntryCover | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 详情页不挂 .reading-bg-*：阅读区背景变量只属于阅读页（.reader-root），
  // 挂到详情页会让整页（含「开始阅读」按钮上下）被米黄/深色横条污染。

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setCover(null);
    fetchCover(slug).then((c) => {
      if (!alive) return;
      if (c) setCover(c);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [slug]);

  // 目录层级数据（若产物太旧没带 toc，只显示章节数）
  const chapters = useMemo(
    () => (item?.toc && item.toc.length > 0 ? flattenChapterList(item.toc) : []),
    [item],
  );

  // 与阅读页 docs 数组对齐的章节行：docs[0] 是「导读」，内容章节自 1 起编号，
  // container（卷）不单独成页（见 EntryReaderPage 的 docs 构造）。docIndex 即 ?ch= 的取值。
  const chapterRows = useMemo(() => {
    let docIndex = 0;
    return chapters.map((ch) => ({
      ch,
      docIndex: ch.kind === 'container' ? null : ++docIndex,
    }));
  }, [chapters]);

  // id → 类目路径（回退合成 cover 时把分片里的类目 id 还原成中文路径）
  const catIdToPath = useMemo(() => {
    const map = new Map<string, string>();
    for (const [path, node] of nodeByPath) map.set(node.id, path);
    return map;
  }, [nodeByPath]);

  const resolved = cover ?? (item ? synthesizeCover(item, catIdToPath) : null);

  // 「字数」展示口径：严格等于下方「章节目录」中 content 章节逐行字数之和
  // （container/卷 行不显示字数、也不计入）。索引里的 cover.word_count 已按同一口径生成
  // （见 core builder 统一字数规则）；此处再按目录行求和做二次保证，使
  // 「总字数 === 各章节字数之和」在 UI 层恒成立。无内联目录（超长词条）时回退 cover.word_count。
  const displayWords = useMemo(() => {
    const contentRows = chapterRows.filter((r) => r.docIndex !== null);
    if (contentRows.length === 0) return resolved?.word_count ?? 0;
    return contentRows.reduce((acc, r) => acc + (r.ch.words ?? 0), 0);
  }, [chapterRows, resolved]);

  if (loading && !resolved) {
    return (
      <div className="page state-box">
        <Spinner />
        <p className="state-title">正在装载详情…</p>
      </div>
    );
  }

  if (!resolved) {
    return (
      <div className="page state-box">
        <div className="error-card">
          <h2>词条不存在</h2>
          <p className="error-msg">
            该 slug 不在本地索引中：<code>{slug}</code>
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
            回到首页
          </button>
        </div>
      </div>
    );
  }

  const showChapters = resolved.chapter_count > 0;

  return (
    <div className="page entry-cover-page">
      <section className="entry-cover">
        <header className="cover-head">
          <div className="entry-badges">
            {item ? <span className="badge badge-type">{TYPE_LABEL[item.ty] ?? item.ty}</span> : null}
            {item ? (
              <span className="badge">{STATUS_LABEL[item.st] ?? item.st}</span>
            ) : null}
          </div>
          <h1 className="entry-title">{resolved.title}</h1>
          {resolved.original_title ? <p className="entry-original">{resolved.original_title}</p> : null}
          {resolved.subtitle ? <p className="entry-subtitle">{resolved.subtitle}</p> : null}
        </header>

        <div className="cover-meta-card">
          <div className="meta-cell">
            <span className="meta-k">字数</span>
            <strong>{displayWords.toLocaleString()}</strong>
          </div>
          <div className="meta-cell">
            <span className="meta-k">章节</span>
            <strong>{resolved.chapter_count}</strong>
          </div>
          <div className="meta-cell">
            <span className="meta-k">更新</span>
            <strong>{formatDate(resolved.updated_at)}</strong>
          </div>
          <div className="meta-cell">
            <span className="meta-k">来源</span>
            <strong>{resolved.sources.length}</strong>
          </div>
        </div>

        <div className="card summary-card cover-summary">
          <h3 className="card-label">内容简介</h3>
          <p className="summary-text">{resolved.summary}</p>
          {resolved.tags.length > 0 ? (
            <div className="chip-row cover-tags">
              {resolved.tags.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {resolved.categories.length > 0 ? (
          <div className="cover-cat-row">
            <span className="meta-k">类目</span>
            <div className="chip-row">
              {resolved.categories.map((path) => {
                const node = nodeByPath.get(path);
                const inner = (
                  <span className="chip chip-cat" key={path}>
                    {path}
                  </span>
                );
                return node ? (
                  <Link key={path} to={`/browse/${encodeURIComponent(node.id)}`}>
                    {inner}
                  </Link>
                ) : (
                  inner
                );
              })}
            </div>
          </div>
        ) : null}

        {showChapters ? (
          <section className="card cover-section">
            <h3 className="card-label">章节目录</h3>
            {chapters.length > 0 ? (
              <ol className="cover-chapters">
                {chapterRows.map(({ ch, docIndex }) =>
                  docIndex === null ? (
                    <li key={ch.key} className="cover-chapter-row">
                      <span className="cover-chapter-title">{ch.title}</span>
                    </li>
                  ) : (
                    <li
                      key={ch.key}
                      className="cover-chapter-row cover-chapter-clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/entry-reader/${encodeURIComponent(slug)}?ch=${docIndex}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/entry-reader/${encodeURIComponent(slug)}?ch=${docIndex}`);
                        }
                      }}
                    >
                      <span className="cover-chapter-title">{ch.title}</span>
                      {ch.words > 0 ? <span className="cover-chapter-words">{ch.words} 字</span> : null}
                    </li>
                  ),
                )}
              </ol>
            ) : (
              <p className="empty">长文词条，共 {resolved.chapter_count} 章，进入阅读后可在目录中浏览。</p>
            )}
          </section>
        ) : null}

        {resolved.related.length > 0 ? (
          <section className="card cover-section">
            <h3 className="card-label">相关词条</h3>
            <div className="chip-row cover-related">
              {resolved.related.map((s) =>
                knownSlugs.has(s) ? (
                  <Link key={s} to={`/entry/${encodeURIComponent(s)}`} className="chip chip-link">
                    {slugMap.get(s)?.t ?? s}
                  </Link>
                ) : null,
              )}
            </div>
          </section>
        ) : null}

        <div className="cover-actions">
          <Link to={`/entry-reader/${encodeURIComponent(slug)}`} className="btn btn-primary btn-start">
            开始阅读
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
