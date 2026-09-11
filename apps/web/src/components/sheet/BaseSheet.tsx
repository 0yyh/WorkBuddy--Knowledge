/**
 * BaseSheet —— 阅读器底部面板通用壳（指南 §2.1：所有面板复用，手势单一维护点）。
 *
 * 职责：
 *  - 遮罩（.reader-sheet-mask）+ 面板（.reader-sheet）+ 拖拽条（.reader-sheet-handle）+ 标题。
 *  - 跟手拖拽阻尼 + 阈值关闭（useSheetDrag）。
 *  - 开 / 关生命周期：open=true 立即挂载并播入场（CSS sheet-up）；onClose（遮罩点击 /
 *    拖拽超阈值）后先播退场动画再卸载，避免"瞬间跳变"（指南 §3.2）。
 *  - 主题底色由调用方传入 bg（reader-sheet-bg-${bg}），保证面板与阅读背景协调。
 *
 * 子层（字体 / 间距 / 更多）作为 children 传入即可，BaseSheet 不关心其内部结构。
 */
import { useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { BgColorPref } from '../../lib/preferences';
import { useSheetDrag } from './useSheetDrag';

/** 退场动画时长，须与 .reader-sheet 退场 transition 时长一致 */
const EXIT_MS = 300;

export interface BaseSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  bg: BgColorPref;
  /** 附加到面板 class（如 reader-chapter-sheet） */
  className?: string;
  /** 附加到标题 class */
  titleClassName?: string;
  children: ReactNode;
}

export function BaseSheet({
  open,
  onClose,
  title,
  bg,
  className,
  titleClassName,
  children,
}: BaseSheetProps): JSX.Element | null {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const drag = useSheetDrag({ onClose, getScrollEl: () => drag.panelRef.current });

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      const t = window.setTimeout(() => setMounted(false), EXIT_MS);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open, mounted]);

  if (!mounted) return null;

  const panelStyle: CSSProperties = drag.dragging
    ? { transform: `translate3d(0, ${drag.translateY}px, 0)`, transition: 'none' }
    : closing
      ? {
          transform: 'translate3d(0, 100%, 0)',
          transition: `transform var(--duration-slow) var(--ease-spring)`,
        }
      : {
          transform: 'translate3d(0, 0, 0)',
          transition: `transform var(--duration-slow) var(--ease-spring)`,
        };

  return (
    <div className="reader-sheet-layer" data-control="sheet">
      <div className="reader-sheet-mask" onClick={onClose} />
      <div
        ref={drag.panelRef as RefObject<HTMLDivElement>}
        className={`reader-sheet reader-sheet-bg-${bg}${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-label={title}
        {...drag.bind}
        style={panelStyle}
      >
        <div className="reader-sheet-handle" aria-hidden="true" />
        {title ? (
          <h3 className={`reader-sheet-title${titleClassName ? ` ${titleClassName}` : ''}`}>{title}</h3>
        ) : null}
        {children}
      </div>
    </div>
  );
}
