/**
 * SubSheet —— 阅读器「子层」通用壳（字体 / 间距 / 更多）。
 *
 * 与 BaseSheet 同一套动画状态机，只是外观不同（子层为「左箭头 + 居中标题」的
 * .reader-more-head，无拖拽条）：
 *  - 位移只走 transform（合成属性），时长/曲线取 --sheet-* 令牌；
 *  - 入场 INIT(100%) → OPEN(0)：挂载后推迟一帧再展开，错开首帧的重排与动画；
 *  - 退场走 --sheet-ease-out（无过冲），closing 由 open 派生，避免中间帧抖动；
 *  - 遮罩淡入淡出由 .reader-more-layer 的 is-open / is-closing 驱动。
 *
 * 原先三个子层是「父级条件渲染 → CSS animation 入场 → 直接卸载（无退场）」，
 * 既没有收起动画，也与主面板时长不一致（0.26s ease-out-expo vs 350ms ease-spring）。
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { BgColorPref } from '../../lib/preferences';

/** 退场动画时长，须与 tokens.css 的 --sheet-duration 一致 */
const EXIT_MS = 280;

const TRANSITION_IN = 'transform var(--sheet-duration) var(--sheet-ease-in)';
const TRANSITION_OUT = 'transform var(--sheet-duration) var(--sheet-ease-out)';

/* ⚠️ 键顺序有意为之（transition 在前、transform 在后）：React 提交样式时按对象键序
   逐个 setProperty，先写 transition 再写 transform，本次位移才会用「目标态」的曲线
   播放；若顺序颠倒，会用上一个状态的曲线（例如收起时走成入场曲线）。 */
const STYLE_INIT: CSSProperties = { transition: 'none', transform: 'translate3d(0, 100%, 0)' };
const STYLE_OPEN: CSSProperties = { transition: TRANSITION_IN, transform: 'translate3d(0, 0, 0)' };
const STYLE_CLOSED: CSSProperties = { transition: TRANSITION_OUT, transform: 'translate3d(0, 100%, 0)' };

export interface SubSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  bg: BgColorPref;
  children: ReactNode;
}

export function SubSheet({ open, onClose, title, bg, children }: SubSheetProps): JSX.Element | null {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);

  // 与 BaseSheet 一致：退场由 open 派生，与父级同一次渲染生效
  const closing = mounted && !open;

  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }
    if (!mounted) return undefined;
    const t = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    if (!mounted || closing) {
      setEntered(false);
      return undefined;
    }
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [mounted, closing]);

  if (!mounted) return null;

  const style = closing ? STYLE_CLOSED : entered ? STYLE_OPEN : STYLE_INIT;
  const layerClass = `reader-more-layer${entered && !closing ? ' is-open' : ''}${closing ? ' is-closing' : ''}`;

  return (
    <div className={layerClass}>
      <div className="reader-more-mask" onClick={onClose} />
      <div
        className={`reader-more-sheet reader-sheet-bg-${bg}`}
        role="dialog"
        aria-label={title}
        style={style}
      >
        <div className="reader-more-head">
          <button type="button" className="reader-more-close" aria-label="收起" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h3 className="reader-more-title">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}
