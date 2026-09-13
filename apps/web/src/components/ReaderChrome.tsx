/**
 * ReaderChrome —— 阅读页底部/顶部常驻 chrome（P2-9）。
 *
 * 从 EntryReaderPage.tsx 抽出的纯展示组件：顶部返回/目录条、章节进度条（上一章 /
 * 滑杆 / 下一章）、常驻 3 等分导航栏（目录 / 夜间 / 设置）、底部信息条（进度 / 时间 /
 * 电量）。DOM 结构与类名与原页面内联渲染完全一致，确保 e2e 选择器（.reader-top /
 * .reader-bottom / .reader-bottom-tabs / .reader-statusbar / .reader-chapter-slider）不变。
 *
 * 行为约束（见任务硬契约）：
 *  - 底部 chrome 用实色 var(--reading-bg)，绝不用半透明 chrome 底（否则正文透上来）。
 *  - 信息条显隐仅由 showProgress 控制；滑杆 ref 由 useReaderScroll 直写 DOM 联动进度。
 */
import type { FormEvent, MutableRefObject } from 'react';

interface ReaderChromeProps {
  index: number;
  total: number;
  showProgress: boolean;
  isNight: boolean;
  clock: string;
  battery: number | null;
  /** 章节进度滑杆 ref（由 useReaderScroll 直写 DOM 联动进度） */
  sliderRef: MutableRefObject<HTMLInputElement | null>;
  onBack: () => void;
  onOpenChapter: () => void;
  onToggleNight: () => void;
  onOpenSettings: () => void;
  go: (delta: number) => void;
  onSliderInput: (e: FormEvent<HTMLInputElement>) => void;
}

export function ReaderChrome({
  index,
  total,
  showProgress,
  isNight,
  clock,
  battery,
  sliderRef,
  onBack,
  onOpenChapter,
  onToggleNight,
  onOpenSettings,
  go,
  onSliderInput,
}: ReaderChromeProps): JSX.Element {
  const currentPos = Math.min(index + 1, total);

  return (
    <>
      <header className="reader-top">
        {/* 顶部：左侧返回「<」；右侧竖排「⋮」= 打开章节目录 */}
        <div className="reader-top-bar reader-top-bar-solo">
          <button
            type="button"
            className="reader-circle-btn reader-circle-btn-sm"
            aria-label="返回详情"
            onClick={onBack}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="reader-circle-btn reader-circle-btn-sm"
            aria-label="章节目录"
            onClick={onOpenChapter}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <circle cx="12" cy="5" r="1.7" fill="currentColor" />
              <circle cx="12" cy="12" r="1.7" fill="currentColor" />
              <circle cx="12" cy="19" r="1.7" fill="currentColor" />
            </svg>
          </button>
        </div>
      </header>

      {/* 章节条：随 overlay 显隐（滚隐亦作用于此）；常驻导航栏已抽离为下方 <nav> */}
      <footer className="reader-bottom">
        {/* 上一章 + 章节进度条（可拖动跳章） + 下一章 */}
        <div className="reader-bottom-nav">
          <button
            type="button"
            className="reader-pill-btn"
            disabled={index <= 0}
            onClick={() => go(-1)}
            aria-label="上一章"
          >
            上一章
          </button>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            className="reader-chapter-slider"
            ref={sliderRef}
            defaultValue={0}
            aria-label="章节阅读进度"
            onInput={onSliderInput}
          />
          <button
            type="button"
            className="reader-pill-btn"
            disabled={index >= total - 1}
            onClick={() => go(1)}
            aria-label="下一章"
          >
            下一章
          </button>
        </div>
      </footer>

      {/* 常驻 3 等分导航栏（目录 / 夜间 / 设置），始终可见可点 */}
      <nav className="reader-bottom-tabs">
        <button type="button" className="reader-tab" aria-label="章节目录" onClick={onOpenChapter}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </g>
          </svg>
          <span className="reader-tab-label">目录</span>
        </button>
        <button
          type="button"
          className="reader-tab"
          aria-label={isNight ? '日间模式' : '夜间模式'}
          onClick={onToggleNight}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            {isNight ? (
              <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="2" x2="12" y2="4" />
                <line x1="12" y1="20" x2="12" y2="22" />
                <line x1="2" y1="12" x2="4" y2="12" />
                <line x1="20" y1="12" x2="22" y2="12" />
              </g>
            ) : (
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
          <span className="reader-tab-label">{isNight ? '日间' : '夜间'}</span>
        </button>
        <button
          type="button"
          className="reader-tab"
          aria-label="阅读区设置"
          onClick={onOpenSettings}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l8.66 5v10L12 22l-8.66-5V7L12 2z" />
              <circle cx="12" cy="12" r="2.5" />
            </g>
          </svg>
          <span className="reader-tab-label">设置</span>
        </button>
      </nav>

      {/* 底部常驻信息条（不受 overlay 影响）：左下 进度 1/666，右下 时间 + 电量 */}
      {showProgress ? (
        <div className="reader-statusbar" aria-live="off">
          <span className="reader-statusbar-progress">{`${currentPos}/${total}`}</span>
          <span className="reader-statusbar-right">
            <span className="reader-statusbar-time">{clock}</span>
            {battery !== null ? <span className="reader-statusbar-battery">{`${battery}%`}</span> : null}
          </span>
        </div>
      ) : null}
    </>
  );
}
