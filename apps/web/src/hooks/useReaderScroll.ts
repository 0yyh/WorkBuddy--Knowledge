/**
 * useReaderScroll —— 阅读页滚动 / 翻章 / 信息栏滚隐 / 章末自动加载 的全部 DOM 交互。
 *
 * 从 EntryReaderPage.tsx 抽出（P2-9），让页面成为薄编排层。本 hook 独占：
 *   - scrollRef / sliderRef（进度条 ref 直写 DOM，避免每帧 setState 重渲染整页）
 *   - chromeRevealTimer / chromeSuppressRef / touchStart（滚隐与切章竞态抑制）
 *   - pendingScroll（点击小节 → 等目标章载入后滚动到对应标题）
 *   - 左右滑切章（SWIPE_X / SWIPE_Y_RATIO）、点按翻章、滑杆拖动跳章
 *
 * 行为严格对齐重构前：进度条直写、切章 scrollTo(0) 的异步 scroll 事件被抑制、
 * 滚隐仅在 overlay 唤出态生效、章末自动加载去抖 400ms。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Dispatch,
  FormEvent,
  MutableRefObject,
  SetStateAction,
  TouchEvent,
} from 'react';
import {
  AUTO_NEXT_DEBOUNCE_MS,
  CHROME_REVEAL_DELAY_MS,
  HEADING_SCROLL_OFFSET,
  SCROLL_BOTTOM_THRESHOLD_PX,
  SWIPE_X,
  SWIPE_Y_RATIO,
} from '../lib/reader-constants';

export interface UseReaderScrollOptions {
  /** 当前章节下标（驱动切章 effect 与滚动重挂） */
  index: number;
  /** 当前章节已装载的文档（null 表示 loading/error） */
  loaded: { html: string } | null;
  /** overlay 是否唤出（滚隐仅在唤出态生效） */
  overlay: boolean;
  /** 自动加载开关（Ref 读取，避免滚动监听因开关反复重挂） */
  autoLoadRef: MutableRefObject<boolean>;
  /** 最新章节总数（Ref 读取，章末自动加载判断是否有下一章） */
  totalRef: MutableRefObject<number>;
  /** 章节切换 setter（自动加载下一章 / 跳到小节目标章） */
  setIndex: Dispatch<SetStateAction<number>>;
  /** 左右滑 / 点按翻章回调（关闭目录并夹取边界） */
  go: (delta: number) => void;
}

export interface UseReaderScrollResult {
  scrollRef: MutableRefObject<HTMLDivElement | null>;
  sliderRef: MutableRefObject<HTMLInputElement | null>;
  onTouchStart: (e: TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: (e: TouchEvent<HTMLDivElement>) => void;
  onSliderInput: (e: FormEvent<HTMLInputElement>) => void;
  /** 清掉滚隐计时并恢复信息栏（点中央唤出 overlay 前调用） */
  revealChrome: () => void;
  /** 点击小节：切到目标章并标记待滚动，载入完成后由内部 effect 滚动到标题 */
  requestScrollToHeading: (chapterIndex: number, text: string) => void;
  /** 信息栏滚隐态（用于 .reader-root 的 chrome-dismissed class） */
  chromeDismissed: boolean;
}

export function useReaderScroll(options: UseReaderScrollOptions): UseReaderScrollResult {
  const { index, loaded, overlay, autoLoadRef, totalRef, setIndex, go } = options;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sliderRef = useRef<HTMLInputElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // 信息栏滚隐计时：停止滚动后延时淡入
  const chromeRevealTimer = useRef<number | null>(null);
  // 切章滚隐抑制旗标：[index] effect 里 scrollTo(0) 会在旧内容上触发一次**异步** scroll
  // 事件（晚于同 effect 的 setChromeDismissed(false)），hideChrome 会看到 overlay 仍为 true
  // 而把 chrome 重新滚隐 → 切章后 overlay 在但卡片不可见，首次点击像「失灵」。
  const chromeSuppressRef = useRef<boolean>(false);
  // 章末自动加载：去抖计时 + 是否已触发的去抖保护
  const autoNextTimer = useRef<number | null>(null);
  const autoNextArmed = useRef<boolean>(false);
  // overlay 当前值（Ref 读取，避免滚动监听因 overlay 变化反复重挂）
  const overlayRef = useRef<boolean>(overlay);
  overlayRef.current = overlay;

  const [chromeDismissed, setChromeDismissed] = useState<boolean>(false);
  // 点击小节后：跳到目标章并滚动到对应标题（载入完成后再执行滚动）
  const [pendingScroll, setPendingScroll] = useState<{ index: number; text: string } | null>(null);

  // 点击小节后：等目标章载入完成，滚动到对应标题
  useEffect(() => {
    if (!pendingScroll || !loaded || !scrollRef.current) return;
    if (index !== pendingScroll.index) {
      setPendingScroll(null);
      return;
    }
    const parent = scrollRef.current;
    const heads = parent.querySelectorAll<HTMLElement>('.prose h2, .prose h3, .prose h4');
    let target: HTMLElement | null = null;
    const want = pendingScroll.text.trim();
    for (const h of Array.from(heads)) {
      const t = (h.textContent ?? '').trim();
      if (t === want || t.includes(want) || want.includes(t)) {
        target = h;
        break;
      }
    }
    if (target) {
      const top =
        target.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop;
      parent.scrollTo({ top: Math.max(0, top - HEADING_SCROLL_OFFSET), behavior: 'smooth' });
    }
    setPendingScroll(null);
  }, [pendingScroll, loaded, index]);

  // 切章：scrollTo(0) + 滑杆归零 + 取消滚隐计时 + 恢复信息栏
  useEffect(() => {
    // 抑制随后 scrollTo(0) 触发的异步 scroll 事件把 chrome 重新滚隐（见 chromeSuppressRef 注释）
    chromeSuppressRef.current = true;
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    // 切章时把滑杆归 0（随后 scroll/compute 实时刷新到正确百分比）
    const slider0 = sliderRef.current;
    if (slider0) {
      slider0.value = '0';
      slider0.setAttribute('aria-valuetext', '已读 0%');
    }
    // 切章后取消可能悬置的滚隐计时，并恢复信息栏（若原本唤出）
    if (chromeRevealTimer.current !== null) {
      window.clearTimeout(chromeRevealTimer.current);
      chromeRevealTimer.current = null;
    }
    setChromeDismissed(false);
  }, [index]);

  /**
   * 章节内滚动 → 滑杆百分比联动 + 信息栏滚隐 + 章末自动加载下一章：
   *  - scroll 事件 → 计算 (scrollTop) / (scrollHeight - clientHeight) × 100
   *  - 短内容（无需滚动）→ 100%（用户已"读完"）
   *  - 拖动滑杆 → setScrollTop 到对应位置（onSliderInput 走 slider 的 setter）
   *  - rAF 节流，避免拖动时频繁 setState
   *  - 用户滚动时隐藏信息栏，停顿后自动淡入（仅在 overlay 唤出态生效）
   *  - 真正滚到可滚动内容的章末 → 自动加载下一章（去抖 400ms，防惯性误触）
   */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    let onBottom: () => void = () => undefined;
    const clearTimers = (): void => {
      if (chromeRevealTimer.current !== null) {
        window.clearTimeout(chromeRevealTimer.current);
        chromeRevealTimer.current = null;
      }
      if (autoNextTimer.current !== null) {
        window.clearTimeout(autoNextTimer.current);
        autoNextTimer.current = null;
      }
      autoNextArmed.current = false;
    };
    // 用户在 overlay 唤出态下开始滚动 → 隐藏信息栏，停顿后淡入
    const hideChrome = (): void => {
      // 切章 scrollTo(0) 的异步 scroll 事件：消费掉抑制旗标、不当作用户滚动
      if (chromeSuppressRef.current) {
        chromeSuppressRef.current = false;
        return;
      }
      if (!overlayRef.current) return;
      setChromeDismissed(true);
      if (chromeRevealTimer.current !== null) window.clearTimeout(chromeRevealTimer.current);
      chromeRevealTimer.current = window.setTimeout(() => {
        chromeRevealTimer.current = null;
        setChromeDismissed(false);
      }, CHROME_REVEAL_DELAY_MS);
    };
    const compute = (): void => {
      raf = 0;
      const max = el.scrollHeight - el.clientHeight;
      const pct = max <= 0 ? 100 : Math.max(0, Math.min(100, (el.scrollTop / max) * 100));
      // 直写进度条 DOM，避免每帧 setState 触发整页 re-render
      const slider = sliderRef.current;
      if (slider) {
        const rounded = Math.round(pct);
        slider.value = String(rounded);
        slider.setAttribute('aria-valuetext', `已读 ${rounded}%`);
      }
      // 章末自动加载：仅当「自动加载」开启、内容可滚动(max>0)且真正滚到底(距底≤阈值)才触发，
      // 短章(max<=0)不自动跳，避免「装载即级联切章」；去抖 400ms 防惯性误触。
      const autoLoadOn = autoLoadRef.current;
      const atBottom = max > 0 && el.scrollTop >= max - SCROLL_BOTTOM_THRESHOLD_PX;
      if (atBottom && autoLoadOn && !autoNextArmed.current) {
        autoNextArmed.current = true;
        autoNextTimer.current = window.setTimeout(() => {
          autoNextTimer.current = null;
          autoNextArmed.current = false;
          onBottom();
        }, AUTO_NEXT_DEBOUNCE_MS);
      } else if ((!atBottom || !autoLoadOn) && autoNextArmed.current) {
        autoNextArmed.current = false;
        if (autoNextTimer.current !== null) {
          window.clearTimeout(autoNextTimer.current);
          autoNextTimer.current = null;
        }
      }
    };
    const onScroll = (): void => {
      hideChrome();
      if (raf) return;
      raf = window.requestAnimationFrame(compute);
    };
    onBottom = (): void => {
      // 用最新 total 判断是否有下一章（每次切章 effect 重挂，闭包取当前 index）
      setIndex((cur) => (cur >= totalRef.current - 1 ? cur : cur + 1));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    // 初次计算（内容刚加载/刚切章）
    compute();
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, loaded?.html]);

  const onTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (t) touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) > SWIPE_X && Math.abs(dx) > Math.abs(dy) * SWIPE_Y_RATIO) {
        if (dx < 0) go(1);
        else go(-1);
      }
    },
    [go],
  );

  const onSliderInput = useCallback(
    (e: FormEvent<HTMLInputElement>) => {
      const pct = Number((e.target as HTMLInputElement).value);
      const el = scrollRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTo({ top: (max * pct) / 100, behavior: 'auto' });
    },
    [],
  );

  const revealChrome = useCallback(() => {
    if (chromeRevealTimer.current !== null) {
      window.clearTimeout(chromeRevealTimer.current);
      chromeRevealTimer.current = null;
    }
    setChromeDismissed(false);
  }, []);

  const requestScrollToHeading = useCallback(
    (chapterIndex: number, text: string) => {
      setIndex(chapterIndex);
      setPendingScroll({ index: chapterIndex, text });
    },
    [setIndex],
  );

  return {
    scrollRef,
    sliderRef,
    onTouchStart,
    onTouchEnd,
    onSliderInput,
    revealChrome,
    requestScrollToHeading,
    chromeDismissed,
  };
}
