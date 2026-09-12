/**
 * useSheetDrag —— 底部面板跟手拖拽阻尼（指针事件，桌面鼠标 + 移动端触摸通用）。
 *
 * 设计要点（对齐 reader-ui-spec.md §一.3 / 指南 §五）：
 *  - 用 Pointer Events，鼠标与触摸同一套逻辑，开发者可在桌面浏览器直接调试。
 *  - 阻尼跟随：向下拖拽位移 × damping（<1）后作用于面板 transform，呈现"略拖后"手感。
 *  - scroll-vs-drag 判定：面板内列表滚动到顶（scrollTop<=0）后继续下拉才触发面板拖拽收起；
 *    未到顶时交给原生惯性滚动，互不打架。
 *  - 阈值 / 速度关闭：位移 > 面板高 × closeRatio 或松手速度 > velocity → onClose；
 *    否则 spring 回弹到 0。
 *
 * ───────────────────── 性能：跟手位移不走 React ─────────────────────
 * 旧实现在每次 pointermove 里 `setTranslateY(dy * damping)`，即每个指针事件触发一次
 * React 重渲染；高刷屏一秒可产生 120+ 次事件，面板（目录可达上千节点）所在子树被
 * 反复 reconcile，是"滑动跟手卡顿"的主因。
 *
 * 现改为：pointermove 只把最新位移写进 ref，再用 requestAnimationFrame 合并到每帧
 * 一次，直接写 `el.style.transform`（合成属性）。整个拖拽过程 React 只渲染 2 次
 * （drag 开始 / 结束），中间零重渲染、零重排。
 *
 * 注意：拖拽期间组件的 inline style 由本 hook 接管，BaseSheet 在 dragging 态下
 * 传入的是**引用稳定的常量** style 对象，不会与这里的直接写 DOM 打架；
 * 手势结束时本 hook 会补上过渡并写入终态，随后 React 渲染回常态（值相同，无跳变）。
 *
 * 拖拽手柄（.reader-sheet-handle）在 CSS 中设 `touch-action: none`，
 * 是移动端最可靠的拖拽起点；面板本体 `touch-action: pan-y` 保留内部原生滚动。
 */
import type * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

/** 与 tokens.css --sheet-* 同源的过渡（内联 var() 在运行时解析，单一真源） */
const TRANSITION_IN = 'transform var(--sheet-duration) var(--sheet-ease-in)';
const TRANSITION_OUT = 'transform var(--sheet-duration) var(--sheet-ease-out)';

export interface SheetDragOptions {
  onClose: () => void;
  /** 返回面板内部可滚动容器，用于 scroll-vs-drag 判定（默认取面板自身） */
  getScrollEl?: () => HTMLElement | null;
  /** 向下拖拽阻尼系数（0–1，越小越"拖后"） */
  damping?: number;
  /** 关闭位移阈值：占面板高度比例 */
  closeRatio?: number;
  /** 关闭速度阈值：px/ms */
  velocity?: number;
}

export interface SheetDrag {
  panelRef: React.MutableRefObject<HTMLElement | null>;
  /** 是否处于拖拽接管态（仅开始/结束时翻转，不随位移变化） */
  dragging: boolean;
  bind: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}

export function useSheetDrag(opts: SheetDragOptions): SheetDrag {
  const { onClose, getScrollEl, damping = 0.55, closeRatio = 0.4, velocity = 0.6 } = opts;
  const [dragging, setDragging] = useState(false);

  const startY = useRef(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const pointerId = useRef<number | null>(null);
  const decided = useRef(false); // 是否已判定本次手势为"拖面板"还是"滚内容"
  const draggingRef = useRef(false);
  const panelRef = useRef<HTMLElement | null>(null);

  /** 本帧待写入的位移；配合 rafRef 做"每帧最多写一次 DOM" */
  const nextY = useRef(0);
  const rafRef = useRef(0);

  const flush = useCallback((): void => {
    rafRef.current = 0;
    const el = panelRef.current;
    if (el) el.style.transform = `translate3d(0, ${nextY.current}px, 0)`;
  }, []);

  /** 拖拽期间直接写 DOM：只在动画帧里更新 transform，绝不触发 React 渲染 */
  const schedule = useCallback(
    (y: number): void => {
      nextY.current = y;
      if (rafRef.current === 0) {
        rafRef.current = window.requestAnimationFrame(flush);
      }
    },
    [flush],
  );

  // 卸载时收尾，避免残留的动画帧回调
  useEffect(
    () => () => {
      if (rafRef.current !== 0) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    },
    [],
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerId.current = e.pointerId;
    startY.current = e.clientY;
    lastY.current = e.clientY;
    lastT.current = e.timeStamp;
    decided.current = false;
    draggingRef.current = false;
    nextY.current = 0;
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (pointerId.current === null || e.pointerId !== pointerId.current) return;
      const dy = e.clientY - startY.current;

      if (!decided.current) {
        const scrollEl = getScrollEl?.();
        const atTop = !scrollEl || scrollEl.scrollTop <= 0;
        // 向上拖：一律交给原生滚动 / 不拖面板
        if (dy <= 0) {
          decided.current = true;
          return;
        }
        // 未滚到顶：原生滚动优先，本次手势不接管面板
        if (!atTop) {
          decided.current = true;
          return;
        }
        // 已到顶且继续下拉 → 接管面板拖拽
        decided.current = true;
        draggingRef.current = true;
        // 立即关掉过渡，保证跟手（不等 React 渲染完成）
        const el = panelRef.current;
        if (el) el.style.transition = 'none';
        setDragging(true);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* 某些环境不支持 setPointerCapture，忽略不影响拖拽 */
        }
      }

      if (!draggingRef.current) return;
      lastY.current = e.clientY;
      lastT.current = e.timeStamp;
      schedule(dy < 0 ? 0 : dy * damping);
      if (e.cancelable) e.preventDefault();
    },
    [damping, getScrollEl, schedule],
  );

  const finish = useCallback(
    (e: React.PointerEvent) => {
      if (pointerId.current === null || e.pointerId !== pointerId.current) return;
      pointerId.current = null;

      // 取消尚未执行的动画帧，改由本函数直接写终态
      if (rafRef.current !== 0) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }

      if (!draggingRef.current) {
        setDragging(false);
        return;
      }
      draggingRef.current = false;

      const dy = e.clientY - startY.current;
      const dt = Math.max(1, e.timeStamp - lastT.current);
      const v = Math.abs(e.clientY - lastY.current) / dt;
      const panelH = panelRef.current?.offsetHeight ?? 0;
      const shouldClose = dy > panelH * closeRatio || v > velocity;

      // 终态由本 hook 直接写入：补上过渡 + 目标 transform，React 随后渲染的
      // 常态 style 与之同值，因此不会产生二次跳变。
      const el = panelRef.current;
      if (el) {
        el.style.transition = shouldClose ? TRANSITION_OUT : TRANSITION_IN;
        el.style.transform = shouldClose ? 'translate3d(0, 100%, 0)' : 'translate3d(0, 0, 0)';
      }
      nextY.current = 0;

      setDragging(false);
      if (shouldClose) onClose();
    },
    [closeRatio, velocity, onClose],
  );

  return {
    panelRef,
    dragging,
    bind: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish },
  };
}
