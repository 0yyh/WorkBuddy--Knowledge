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
 *  - 仅 `transform`/`will-change` 走 GPU，避免触发重绘，目标 60fps。
 *
 * 注意：拖拽手柄（.reader-sheet-handle）在 CSS 中设 `touch-action: none`，
 * 是移动端最可靠的拖拽起点；面板本体 `touch-action: pan-y` 保留内部原生滚动。
 */
import type * as React from 'react';
import { useCallback, useRef, useState } from 'react';

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
  dragging: boolean;
  translateY: number;
  bind: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
}

export function useSheetDrag(opts: SheetDragOptions): SheetDrag {
  const { onClose, getScrollEl, damping = 0.55, closeRatio = 0.4, velocity = 0.6 } = opts;
  const [translateY, setTranslateY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const startY = useRef(0);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const pointerId = useRef<number | null>(null);
  const decided = useRef(false); // 是否已判定本次手势为"拖面板"还是"滚内容"
  const draggingRef = useRef(false);
  const panelRef = useRef<HTMLElement | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerId.current = e.pointerId;
    startY.current = e.clientY;
    lastY.current = e.clientY;
    lastT.current = e.timeStamp;
    decided.current = false;
    draggingRef.current = false;
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
        setDragging(true);
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* 某些环境不支持 setPointerCapture，忽略不影响拖拽 */
        }
      }

      if (!draggingRef.current) return;
      if (dy < 0) {
        setTranslateY(0);
        return;
      }
      setTranslateY(dy * damping);
      lastY.current = e.clientY;
      lastT.current = e.timeStamp;
      if (e.cancelable) e.preventDefault();
    },
    [damping, getScrollEl],
  );

  const finish = useCallback(
    (e: React.PointerEvent) => {
      if (pointerId.current === null || e.pointerId !== pointerId.current) return;
      pointerId.current = null;
      if (!draggingRef.current) {
        setDragging(false);
        return;
      }
      draggingRef.current = false;
      setDragging(false);

      const dy = e.clientY - startY.current;
      const dt = Math.max(1, e.timeStamp - lastT.current);
      const v = Math.abs(e.clientY - lastY.current) / dt;
      const panelH = panelRef.current?.offsetHeight ?? 0;

      if (dy > panelH * closeRatio || v > velocity) {
        setTranslateY(0);
        onClose();
      } else {
        setTranslateY(0); // spring 回弹由 BaseSheet 的过渡负责
      }
    },
    [closeRatio, velocity, onClose],
  );

  return {
    panelRef,
    dragging,
    translateY,
    bind: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish },
  };
}
