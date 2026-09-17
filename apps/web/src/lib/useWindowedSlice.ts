/**
 * 列表窗口化（P1-3）：在「页面滚动」下只渲染可见区附近的一小段 <li>，
 * 用上下 padding 预留完整的滚动高度，从而把上万条 DOM 节点降到几十个。
 *
 * 设计约束（不破坏现有样式 / DOM 语义）：
 *  - 仍使用真实的 <ul>/<li> 与既有 `.card-list` / `.result-list` 样式，不做绝对定位；
 *  - 仅当 items.length > threshold 才启用虚拟化；小列表完全走旧渲染路径（零回归）；
 *  - 步距(stride) 先按预估 rowHeight+gap，再从「首个已渲染 <li> 的真实高度」回测校正，
 *    抵消可变卡片高度带来的滚动偏移累积 —— 卡片高度相近时几乎无漂移。
 *
 * 返回：
 *  - listRef      绑到 <ul> 上
 *  - start/end    当前应渲染的切片区间（左闭右开）
 *  - padTop/padBottom  预留给未渲染段的滚动高度（px），直接作为 <ul> 的 padding
 *  - enabled      是否处于虚拟化模式
 */
import { useEffect, useRef, useState, type RefObject } from 'react';

interface WindowOptions {
  /** 预估单行高度（px），仅用于首帧窗口估算 */
  rowHeight: number;
  /** 行间距（与 CSS gap / 分割线高度对齐），用于步距换算，默认 0 */
  gap?: number;
  /** 视口上下各多渲染多少行 */
  overscan?: number;
  /** 超过该数量才启用虚拟化，否则全量渲染 */
  threshold?: number;
}

export interface WindowResult {
  listRef: RefObject<HTMLUListElement>;
  start: number;
  end: number;
  padTop: number;
  padBottom: number;
  enabled: boolean;
}

export function useWindowedSlice<T>(items: T[], opts: WindowOptions): WindowResult {
  const { rowHeight, gap = 0, overscan = 6, threshold = 60 } = opts;
  const listRef = useRef<HTMLUListElement>(null);
  const [range, setRange] = useState<{ start: number; end: number }>({ start: 0, end: items.length });
  const [measured, setMeasured] = useState<number>(rowHeight);

  const enabled = items.length > threshold;
  const stride = measured + gap;

  // 实测首个已渲染 <li> 的真实高度，回测校正步距（自愈偏移累积）
  useEffect(() => {
    if (!enabled) return;
    const el = listRef.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    if (first && first.offsetHeight > 0) setMeasured(first.offsetHeight);
  }, [enabled, items, range.start, rowHeight]);

  useEffect(() => {
    if (!enabled) {
      setRange({ start: 0, end: items.length });
      return;
    }
    const el = listRef.current;
    if (!el) return;
    let raf = 0;
    const compute = (): void => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const offsetTop = -rect.top; // 列表顶部相对视口顶部的偏移（已滚过为负）
      const visibleTop = Math.max(0, offsetTop);
      const visibleBottom = Math.min(rect.height, offsetTop + vh);
      let start = Math.floor(visibleTop / stride) - overscan;
      let end = Math.ceil(visibleBottom / stride) + overscan;
      start = Math.max(0, start);
      end = Math.min(items.length, end);
      setRange((r) => (r.start === start && r.end === end ? r : { start, end }));
    };
    const onScroll = (): void => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        compute();
      });
    };
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [enabled, items.length, stride, overscan, threshold]);

  if (!enabled) {
    return { listRef, start: 0, end: items.length, padTop: 0, padBottom: 0, enabled: false };
  }
  const { start, end } = range;
  return {
    listRef,
    start,
    end,
    padTop: start * stride,
    padBottom: (items.length - end) * stride,
    enabled: true,
  };
}
