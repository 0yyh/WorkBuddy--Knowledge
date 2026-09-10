/**
 * 阅读页「划词词典」：
 *   正文长按/选中一段文字 → 浮动工具条（复制 / 查询，番茄小说风格）
 *   点「查询」→ 底部滑出释义卡（词头 / 拼音 / 词性 / 常规义 / 专业义）
 *
 * 事件隔离设计：
 *   - 本组件以 createPortal(document.body) 的「兄弟节点」渲染（.dict-menu / .dict-card-layer），
 *     不进 .reader-root 内部 → 点按钮天然不会被 EntryReaderPage 的 onSurfaceClick 吞掉。
 *   - 触发通道共三条，任一命中即显示工具条（状态驱动，无前置守卫）：
 *       1. mouseup             —— 桌面拖选 / 双击选词
 *       2. touchend/touchcancel —— 移动端抬手（含系统以 touchcancel 收尾的情况）
 *       3. document selectionchange —— 移动端长按的「主通道」：原生选区 UI 常在
 *          抬手之后才形成选区，只有这条能可靠补上。
 *   - 若选区锚点落在正文内且非坍缩，则在抬手事件里 stopPropagation，
 *     阻断 .reader-root 的左右滑切章 / 点击翻页，避免选字与翻页打架；
 *     隐藏/关闭后的短暂窗口也会吸收一次点击，防止「刚收起菜单就被判为翻页」。
 *   - 释义卡主题跟随阅读背景：复用 .reader-sheet-bg-${bg} 的 --t-* token。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DictEntry } from '@pks/core/dict';
import { lookupWord } from '../lib/dict';
import type { BgColorPref } from '../lib/preferences';

interface ReaderSelectionMenuProps {
  /** 阅读背景主题（white/sepia/green/blue/dark）→ 释义卡配色 token */
  bg: BgColorPref;
  /** 正文滚动容器（.reader-scroll，内部含 .prose）；选区必须落在这里 */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** 章节变化时重置（切章 → 关闭工具条与释义卡） */
  resetKey: string;
  /** 阅读页就绪后才挂监听（loading / error 时不显示） */
  enabled: boolean;
}

interface MenuState {
  text: string;
  x: number;
  y: number;
  /** 箭头方向：up = 工具条在选区上方；down = 翻到选区下方 */
  arrow: 'up' | 'down';
}

type QueryStatus = 'closed' | 'loading' | 'done';

interface QueryState {
  status: QueryStatus;
  /** 用户查询的词（未命中时用于提示） */
  queried: string;
  entry: DictEntry | null;
}

/** 复制后提示与菜单尺寸（定位 clamp 用） */
const MENU_W = 164;
const MENU_H = 68;
const MENU_GAP = 10;
const HIDE_ABSORB_MS = 350;

/** 复制文本：优先 Clipboard API，异常/不可用时回退 textarea + execCommand（Android WebView） */
async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.left = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 阅读视口宽高（visualViewport 优先，移动端缩放安全） */
function viewportSize(): { w: number; h: number } {
  const vv = window.visualViewport;
  if (vv && vv.width > 0) return { w: vv.width, h: vv.height };
  return { w: window.innerWidth, h: window.innerHeight };
}

/** 依据选区 rect 计算工具条 fixed 坐标（优先选区上方居中，放不下翻到下方，再 clamp） */
function menuPosition(rect: DOMRect): { x: number; y: number; arrow: 'up' | 'down' } {
  const { w: vw, h: vh } = viewportSize();
  let arrow: 'up' | 'down' = 'up';
  let y = rect.top - MENU_H - MENU_GAP;
  if (y < 10) {
    arrow = 'down';
    y = rect.bottom + MENU_GAP;
  }
  if (y + MENU_H > vh - 10) {
    y = Math.max(10, vh - MENU_H - 10);
  }
  const x = Math.max(10, Math.min(rect.left + rect.width / 2 - MENU_W / 2, vw - MENU_W - 10));
  return { x, y, arrow };
}

export function ReaderSelectionMenu({
  bg,
  scrollRef,
  resetKey,
  enabled,
}: ReaderSelectionMenuProps): JSX.Element | null {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [query, setQuery] = useState<QueryState>({ status: 'closed', queried: '', entry: null });
  const [toast, setToast] = useState<string>('');

  const toastTimer = useRef<number | null>(null);
  // 菜单刚隐藏的时间戳：吸收紧随其后的一次正文点击，避免「收起菜单」被误判为翻页
  const lastHideAt = useRef<number>(0);
  // 释义卡是否已展开：展开期间不再叠加工具条，避免两套浮层互相遮挡
  // （用 ref 是因 readAndShow 在原生事件回调里执行，需读到最新值而非闭包快照）
  const cardOpenRef = useRef<boolean>(false);
  // 卡片下滑关闭手势起点
  const cardDragStart = useRef<{ y: number } | null>(null);
  // 查询竞态序号：只采纳最后一次查询
  const querySeq = useRef<number>(0);

  const showToast = useCallback((msg: string): void => {
    setToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      toastTimer.current = null;
      setToast('');
    }, 1800);
  }, []);

  const hideMenu = useCallback((): void => {
    lastHideAt.current = Date.now();
    setMenu(null);
  }, []);

  const closeCard = useCallback((): void => {
    querySeq.current += 1;
    setQuery({ status: 'closed', queried: '', entry: null });
  }, []);

  // 同步释义卡展开标记（原生事件回调用 ref 读取，避免闭包过期）
  useEffect(() => {
    cardOpenRef.current = query.status !== 'closed';
  }, [query.status]);

  // 切章 / 失能 → 工具条、释义卡、toast 全部清空
  useEffect(() => {
    setMenu(null);
    querySeq.current += 1;
    setQuery({ status: 'closed', queried: '', entry: null });
    setToast('');
  }, [resetKey, enabled]);

  useEffect(() => {
    const host = scrollRef.current;
    if (!host || !enabled) return;

    /** 读取当前选区：非空、非坍缩、锚点落在正文容器内才显示工具条 */
    const readAndShow = (): void => {
      // 释义卡展开期间不再叠工具条（两套浮层会互相遮挡）
      if (cardOpenRef.current) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const raw = sel.toString().trim();
      if (!raw || raw.replace(/\s+/g, ' ').length > 120) return;
      const anchor = sel.anchorNode;
      if (!anchor || !host.contains(anchor)) return;
      if (sel.rangeCount < 1) return;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const pos = menuPosition(rect);
      // 复制保留原始换行/缩进；查询交给 lookupWord 做规范化
      setMenu({ text: raw, x: pos.x, y: pos.y, arrow: pos.arrow });
    };

    let raf = 0;
    const scheduleShow = (): void => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        readAndShow();
      });
    };

    /**
     * 指针抬起（mouseup / touchend / touchcancel 共用）：
     *  - 选区仍存活 → stopPropagation，阻断 .reader-root 的滑切章 / 点击翻页；
     *  - 选区已坍缩但菜单刚收起 → 同样吸收这一次抬起，避免「收起菜单」被判为翻页。
     * 注意：passive 监听下 preventDefault 无效，但 stopPropagation 照常生效。
     */
    const onPointerRelease = (e: Event): void => {
      if (!(e.target instanceof Node) || !host.contains(e.target)) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        e.stopPropagation();
      } else if (Date.now() - lastHideAt.current < HIDE_ABSORB_MS) {
        e.stopPropagation();
      }
      scheduleShow();
    };

    /**
     * 选区变化（移动端长按的「主通道」）：
     * Android WebView 长按选词时，系统原生选区 UI 常在 touchend 之后甚至以 touchcancel
     * 结束触摸序列后才形成选区，因此这里必须「状态驱动」而非「手势时间戳驱动」：
     * 只要选区非坍缩且锚点落在正文内就直接定位显示，不再依赖任何前置守卫
     * （旧实现用只能在 readAndShow 里赋值的 lastGestureAt 做 900ms 门槛 = 死锁，
     *  导致移动端工具条 100% 不弹）。
     */
    const onSelectionChange = (): void => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        hideMenu();
        return;
      }
      const anchor = sel.anchorNode;
      if (!anchor || !host.contains(anchor)) {
        hideMenu();
        return;
      }
      scheduleShow();
    };

    /** 正文滚动 → 工具条消失 */
    const onScroll = (): void => {
      hideMenu();
    };

    const onResize = (): void => {
      hideMenu();
    };

    // mouseup：桌面拖选 / 双击选词的主通道
    host.addEventListener('mouseup', onPointerRelease);
    // touchend / touchcancel：移动端两条通道。
    // Android 长按时系统常以 touchcancel 结束触摸序列（或原生选区 UI 吞掉 touchend），
    // 只挂 touchend 会漏掉这条路径 → 工具条不弹。
    host.addEventListener('touchend', onPointerRelease, { passive: true });
    host.addEventListener('touchcancel', onPointerRelease, { passive: true });
    document.addEventListener('selectionchange', onSelectionChange);
    host.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      host.removeEventListener('mouseup', onPointerRelease);
      host.removeEventListener('touchend', onPointerRelease);
      host.removeEventListener('touchcancel', onPointerRelease);
      document.removeEventListener('selectionchange', onSelectionChange);
      host.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [scrollRef, enabled, hideMenu]);

  /** 复制：使用菜单快照文本；完成后菜单收起（选区交给系统处理） */
  const onCopy = useCallback(async (): Promise<void> => {
    if (!menu) return;
    const text = menu.text;
    setMenu(null);
    const ok = await copyTextToClipboard(text);
    showToast(ok ? '已复制' : '复制失败，请手动长按复制');
  }, [menu, showToast]);

  /** 查询：立即收起工具条并滑出释义卡（loading → done） */
  const onQuery = useCallback((): void => {
    if (!menu) return;
    const text = menu.text;
    setMenu(null);
    const seq = ++querySeq.current;
    setQuery({ status: 'loading', queried: text, entry: null });
    void lookupWord(text)
      .then((entry) => {
        if (seq !== querySeq.current) return;
        setQuery({ status: 'done', queried: text, entry });
      })
      .catch(() => {
        if (seq !== querySeq.current) return;
        setQuery({ status: 'done', queried: text, entry: null });
      });
  }, [menu]);

  /** 卡片顶部 handle 下滑关闭 */
  const onCardTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>): void => {
    const t = e.touches[0];
    if (t) cardDragStart.current = { y: t.clientY };
  }, []);
  const onCardTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>): void => {
      const s = cardDragStart.current;
      cardDragStart.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dy = t.clientY - s.y;
      if (dy > 64) closeCard();
    },
    [closeCard],
  );

  const prevent = (e: React.SyntheticEvent): void => {
    e.preventDefault();
    e.stopPropagation();
  };

  const entry = query.entry;
  const phonetics = [entry?.pinyin, entry?.ipa].filter(Boolean).join(' / ');

  return createPortal(
    <>
      {/* 浮动工具条 */}
      {menu ? (
        <div
          className="dict-menu"
          data-control="dict"
          data-arrow={menu.arrow}
          style={{ left: menu.x, top: menu.y }}
          role="toolbar"
          aria-label="文本操作"
          onPointerDown={prevent}
          onMouseDown={prevent}
        >
          <button type="button" className="dict-menu-btn" aria-label="复制选中文本" onClick={onCopy}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="dict-menu-label">复制</span>
          </button>
          <button type="button" className="dict-menu-btn" aria-label="查询释义" onClick={onQuery}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="dict-menu-label">查询</span>
          </button>
        </div>
      ) : null}

      {/* 释义卡（底部弹出） */}
      {query.status !== 'closed' ? (
        <div
          className="dict-card-layer"
          data-control="dict"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="dict-card-mask" onClick={closeCard} />
          <div
            className={`dict-card reader-sheet-bg-${bg}`}
            role="dialog"
            aria-label="词典释义"
            onTouchStart={onCardTouchStart}
            onTouchEnd={onCardTouchEnd}
          >
            <div className="reader-sheet-handle" aria-hidden="true" />

            {query.status === 'loading' ? (
              <div className="dict-card-body dict-card-body-loading">
                <span className="dict-loading-spin" aria-hidden="true" />
                <p className="dict-loading-text">正在查询「{query.queried}」…</p>
              </div>
            ) : entry ? (
              <>
                <header className="dict-card-head">
                  <div className="dict-head-main">
                    {/* 竖向层级：拼音 → 词头(+词性)（番茄小说释义卡） */}
                    {phonetics ? <span className="dict-phonetic">{phonetics}</span> : null}
                    <div className="dict-head-word">
                      <h3 className="dict-word">{entry.word}</h3>
                      {entry.pos ? <span className="dict-pos">{entry.pos}</span> : null}
                    </div>
                  </div>
                  <button type="button" className="dict-close" aria-label="关闭释义" onClick={closeCard}>
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </header>

                <div className="dict-card-body">
                  {entry.defs.length > 0 ? (
                    <ol className="dict-defs">
                      {entry.defs.map((d, i) => (
                        <li key={i} className="dict-def">
                          <span className="dict-def-no">{i + 1}</span>
                          <span className="dict-def-text">{d}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}

                  {entry.specialized.length > 0 ? (
                    <div className="dict-specialized">
                      {entry.specialized.map((sp, i) => (
                        <section key={i} className="dict-spec-group">
                          <h4 className="dict-spec-field">{sp.field}</h4>
                          <ol className="dict-defs">
                            {sp.defs.map((d, j) => (
                              <li key={j} className="dict-def">
                                <span className="dict-def-no">{j + 1}</span>
                                <span className="dict-def-text">{d}</span>
                              </li>
                            ))}
                          </ol>
                        </section>
                      ))}
                    </div>
                  ) : null}

                  {entry.source ? (
                    <p className="dict-source">来自 {entry.source} ›</p>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <header className="dict-card-head">
                  <div className="dict-head-main">
                    <h3 className="dict-word dict-word-miss">未收录该词</h3>
                  </div>
                  <button type="button" className="dict-close" aria-label="关闭释义" onClick={closeCard}>
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </header>
                <div className="dict-card-body">
                  <p className="dict-miss-text">
                    「{query.queried}」不在离线词表中
                  </p>
                  <p className="dict-miss-hint">换个词试试，或先复制到外部词典查询</p>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* 复制结果提示 */}
      {toast ? (
        <div className="dict-toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </>,
    document.body,
  );
}
