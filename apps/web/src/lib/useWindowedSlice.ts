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

/** 计算可见切片所需的几何量（从 DOM 量得，见 hook 内 compute） */
export interface WindowGeometry {
  /** 列表顶部相对视口顶部的偏移（向上滚过为正、未滚到为负） */
  offsetTop: number;
  /** 列表自身高度（含 padding） */
  listHeight: number;
  viewportHeight: number;
  /** 单行步距 = 实测行高 + gap */
  stride: number;
  overscan: number;
  /** 列表总条数 */
  total: number;
}

/**
 * 可见切片区间（左闭右开）。**纯函数**，从 hook 里抽出来以便直接单测 ——
 * 这段算术是虚拟化的全部正确性所在，藏在 useEffect 里就只能靠 DOM 环境测，
 * 而本项目未引入 jsdom。
 */
export function computeWindow(g: WindowGeometry): { start: number; end: number } {
  // stride <= 0 会让除法得到 Infinity：start 变 Infinity、end 被 clamp 成 total，
  // 于是 start > end → slice 为空 → **整个列表渲染空白**。调用方传 rowHeight=0
  // 且 gap=0 时会踩到；这里退化为「全量渲染」，宁可多渲染也不要空白。
  if (!(g.stride > 0)) return { start: 0, end: g.total };

  const visibleTop = Math.max(0, g.offsetTop);
  const visibleBottom = Math.min(g.listHeight, g.offsetTop + g.viewportHeight);
  let start = Math.floor(visibleTop / g.stride) - g.overscan;
  let end = Math.ceil(visibleBottom / g.stride) + g.overscan;

  // 两端都要 clamp 到 [0, total]：
  //  - 上界：列表尚未进入视口时 offsetTop 为负 → visibleBottom 为负 → end 算出负数。
  //    若不管，`slice(start, 负数)` 会被 JS 当作**倒数**语义，反而渲染出几乎全部条目
  //    —— 虚拟化静默失效（页面越长越慢，且无任何报错）。
  //  - 下界：列表已完全滚到视口上方（下方还有页脚等内容时可能发生）→ start 会超过
  //    total，此时应渲染空，而不是让 start > end 产生「倒数」式切片。
  start = Math.max(0, Math.min(g.total, start));
  end = Math.min(g.total, Math.max(start, end));
  return { start, end };
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
      const next = computeWindow({
        offsetTop: -rect.top, // 列表顶部相对视口顶部的偏移（已滚过为负）
        listHeight: rect.height,
        viewportHeight: vh,
        stride,
        overscan,
        total: items.length,
      });
      setRange((r) => (r.start === next.start && r.end === next.end ? r : next));
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
