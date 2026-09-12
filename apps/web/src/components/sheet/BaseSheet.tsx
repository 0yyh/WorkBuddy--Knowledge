/**
 * BaseSheet —— 阅读器底部面板通用壳（指南 §2.1：所有面板复用，手势单一维护点）。
 *
 * 职责：
 *  - 遮罩（.reader-sheet-mask）+ 面板（.reader-sheet）+ 拖拽条（.reader-sheet-handle）+ 标题。
 *  - 跟手拖拽阻尼 + 阈值关闭（useSheetDrag）。
 *  - 开 / 关生命周期：open=true 立即挂载并播入场；onClose（遮罩点击 /
 *    拖拽超阈值）后先播退场动画再卸载，避免"瞬间跳变"（指南 §3.2）。
 *  - 主题底色由调用方传入 bg（reader-sheet-bg-${bg}），保证面板与阅读背景协调。
 *
 * 子层（字体 / 间距 / 更多）作为 children 传入即可，BaseSheet 不关心其内部结构。
 *
 * ───────────────────────── 动画实现（性能版） ─────────────────────────
 * 旧实现同时存在两套动画：
 *   ① CSS `@keyframes sheet-up`（面板 class 上声明 animation）
 *   ② 本组件写在 inline style 上的 transform + transition
 * 由于 CSS 动画优先级高于 inline style，入场期间 ② 被 ① 完全覆盖，动画结束后
 * 才回落到 ②；两套时长/曲线还不一致（350ms ease-spring vs 280ms ease-out-expo），
 * 交叠处出现抖动与掉帧。此外 `@keyframes sheet-up` 在样式表里有两份同名定义，
 * 「后者胜出」使实际生效的是无 opacity、无 translate3d 的那一份。
 *
 * 现统一为**单一过渡机制**：
 *   - 面板位移只用 transform（合成属性），时长/曲线取 --sheet-* 令牌；
 *   - 入场 INIT(100%) → OPEN(0)：挂载后推迟一帧再切到 OPEN，使"首次渲染
 *     （目录可达上千节点）"与"动画启动"分处两帧，削掉首帧峰值；
 *   - 退场 OPEN → CLOSED(100%)：用 --sheet-ease-out（无过冲），
 *     取代原来的 ease-spring 回弹曲线（回弹会让面板上冲露出底缝）；
 *   - closing 由 open 派生而非 effect 滞后设置，避免"回弹一帧再下滑"的抖动；
 *   - 遮罩淡入淡出走 .reader-sheet-layer 上的 is-open / is-closing 状态类。
 */
import { useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { BgColorPref } from '../../lib/preferences';
import { useSheetDrag } from './useSheetDrag';

/** 退场动画时长，须与 tokens.css 的 --sheet-duration 一致 */
const EXIT_MS = 280;

/**
 * 面板位移过渡（与 --sheet-* 令牌同源）。
 * 常量提到模块级：对象引用稳定，React 不会在每次渲染时重复写 DOM。
 *
 * ⚠️ 键顺序有意为之（transition 在前、transform 在后）：React 提交样式时按对象键序
 * 逐个 setProperty，先写 transition 再写 transform，本次位移才会用「目标态」的曲线
 * 播放；若顺序颠倒，会用上一个状态的曲线（例如关闭时走成入场曲线）。
 */
const TRANSITION_IN = 'transform var(--sheet-duration) var(--sheet-ease-in)';
const TRANSITION_OUT = 'transform var(--sheet-duration) var(--sheet-ease-out)';

/** 初始态：收在屏幕外，无过渡（等待下一帧再展开，避免首帧同时布局与动画） */
const STYLE_INIT: CSSProperties = { transition: 'none', transform: 'translate3d(0, 100%, 0)' };
/** 展开态 */
const STYLE_OPEN: CSSProperties = { transition: TRANSITION_IN, transform: 'translate3d(0, 0, 0)' };
/** 退场态 */
const STYLE_CLOSED: CSSProperties = { transition: TRANSITION_OUT, transform: 'translate3d(0, 100%, 0)' };
/** 拖拽中：过渡关闭，transform 由 useSheetDrag 直接写 DOM（不经过 React 渲染） */
const STYLE_DRAG: CSSProperties = { transition: 'none', transform: 'translate3d(0, 0, 0)' };

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
  const [entered, setEntered] = useState(false);
  const drag = useSheetDrag({ onClose, getScrollEl: () => drag.panelRef.current });

  // 退场由 open 派生：与父级同一次渲染生效，避免"先回弹再下滑"的中间帧。
  const closing = mounted && !open;

  useEffect(() => {
    if (open) {
      setMounted(true);
      return undefined;
    }
    if (!mounted) return undefined;
    // 播完退场动画再卸载
    const t = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  // 入场：挂载后跳过一帧再切到展开态，把"重排/绘制"与"动画启动"错开。
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

  const panelStyle = drag.dragging
    ? STYLE_DRAG
    : closing
      ? STYLE_CLOSED
      : entered
        ? STYLE_OPEN
        : STYLE_INIT;

  const layerClass = `reader-sheet-layer${entered && !closing ? ' is-open' : ''}${closing ? ' is-closing' : ''}`;

  return (
    <div className={layerClass} data-control="sheet">
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
