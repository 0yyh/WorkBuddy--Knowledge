/**
 * ReaderToc —— 阅读页章节目录面板内容（P2-9）。
 *
 * 从 EntryReaderPage.tsx 抽出：TOC 搜索框 + 章节/小节列表。渲染在页面已有的
 * <BaseSheet> 内部（见 EntryReaderPage 的组装），自身只管「内容」。
 * 逻辑与重构前一致：卷/container 不计入章节序号、活动章高亮、小节点击触发跳章+滚动到标题。
 */
import { useMemo, useState } from 'react';
import type { HeadingView } from '../types';

/** 扁平化后的文档清单行（导读 + 各章）。与 EntryReaderPage 共用。 */
export interface DocDef {
  key: string;
  kind: 'main' | 'chapter';
  title: string;
}

interface ReaderTocProps {
  docs: DocDef[];
  /** key(文档 key) → 该文档内的二级小节标题 */
  headingsMap: Record<string, HeadingView[]>;
  index: number;
  entryTitle: string;
  /** 点击章节行：跳到该章并关闭目录 */
  onJumpToChapter: (i: number) => void;
  /** 点击小节：跳到该章并滚动到对应标题，随后关闭目录 */
  onJumpToHeading: (i: number, text: string) => void;
}

export function ReaderToc({
  docs,
  headingsMap,
  index,
  entryTitle,
  onJumpToChapter,
  onJumpToHeading,
}: ReaderTocProps): JSX.Element {
  const [tocQuery, setTocQuery] = useState<string>('');

  const cur = Math.min(index, docs.length - 1);

  const rows = useMemo<React.ReactNode>(() => {
    const q = tocQuery.trim().toLowerCase();
    let chapterNo = 0;
    const list = docs
      .map((d, i) => {
        const isMain = d.kind === 'main';
        if (!isMain) chapterNo++;
        const subs = (headingsMap[d.key] ?? []).filter(
          (s) => !q || s.text.toLowerCase().includes(q),
        );
        const titleMatch =
          !q || d.title.toLowerCase().includes(q) || (isMain && entryTitle.toLowerCase().includes(q));
        if (q && !titleMatch && subs.length === 0) return null;
        const shownSubs = q ? subs : headingsMap[d.key] ?? [];
        const isActive = i === cur;
        const readPercent = isActive ? 100 : i < cur ? 100 : 0;
        return (
          <div
            key={`${d.kind}:${d.key}`}
            className={`chapter-group${isActive ? ' is-active' : ''}`}
          >
            <div
              className="chapter-row"
              role="button"
              tabIndex={0}
              onClick={() => onJumpToChapter(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onJumpToChapter(i);
                }
              }}
            >
              <div className="chapter-row-main">
                <span className="chapter-no">{isMain ? '序' : `第${chapterNo}章`}</span>
                <span className="chapter-name">{isMain ? entryTitle : d.title}</span>
                {isActive ? <span className="chapter-here">读到这里</span> : null}
                {readPercent > 0 ? <span className="chapter-read">读至{readPercent}%</span> : null}
              </div>
            </div>
            {shownSubs.length > 0 ? (
              <ul className="chapter-sublist">
                {shownSubs.map((s, si) => (
                  <li key={`${d.key}:${si}`}>
                    <button
                      type="button"
                      className="chapter-subitem"
                      onClick={() => onJumpToHeading(i, s.text)}
                    >
                      {s.text}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })
      .filter((r): r is JSX.Element => r !== null);
    if (list.length === 0) {
      return <div className="toc-search-empty">未找到「{tocQuery}」相关章节</div>;
    }
    return list;
  }, [docs, headingsMap, cur, tocQuery, entryTitle, onJumpToChapter, onJumpToHeading]);

  return (
    <div className="reader-sheet-body reader-chapter-body">
      {/* 目录搜索：按章节名 / 二级小节标题过滤 */}
      <div className="toc-search">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          className="toc-search-input"
          type="search"
          placeholder="搜索章节 / 小节"
          value={tocQuery}
          onChange={(e) => setTocQuery(e.target.value)}
          aria-label="搜索章节"
        />
        {tocQuery ? (
          <button
            type="button"
            className="toc-search-clear"
            aria-label="清空搜索"
            onClick={() => setTocQuery('')}
          >
            ×
          </button>
        ) : null}
      </div>
      <div className="toc-search-list">{rows}</div>
    </div>
  );
}
