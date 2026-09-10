/**
 * 正文阅读页（全屏）：
 *   #/entry-reader/:slug
 * 撑满 100dvh，无 header/tabbar/footer；正文 = 导读 + 各章（左右滑动 / 点按左右区域翻章）。
 * 点击中央唤出/隐藏上下浮层（淡入淡出）；右上「设置」打开阅读区设置底部浮层。
 * 阅读偏好（字号/字体/背景/翻页/行距/亮度）只读 pks_pref_read_*。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Spinner } from '../components/Spinner';
import { ReaderSettingsSheet } from '../components/ReaderSettingsSheet';
import { ReaderSelectionMenu } from '../components/ReaderSelectionMenu';
import { Link, navigate, replaceRoute } from '../router';
import { flattenChapterList, fetchDocHeadings, loadChapterDocument, loadEntryDocument } from '../lib/content';
import { setBackInterceptor } from '../lib/backHandler';
import { addToHistory, getLastRead, setLastRead } from '../lib/history';
import {
  applyReadPrefs,
  bgClassOf,
  brightnessFilter,
  brightnessVeil,
  readReadPrefs,
  writeReadPref,
  type BgColorPref,
  type ReaderPrefs,
} from '../lib/preferences';
import { useStation } from '../state/AppContext';
import type { HeadingView } from '../types';

type DocKind = 'main' | 'chapter';

interface DocDef {
  key: string;
  kind: DocKind;
  title: string;
}

interface EntryReaderPageProps {
  slug: string;
  /** 从详情页目录点击进入时指定起始章节下标（docs 数组下标，0=导读）；缺省走续读恢复 */
  chapterStart?: number;
}

interface LoadedDoc {
  html: string;
  title: string;
}

const SWIPE_X = 60;

/** 当前时间格式化为 HH:MM（24 小时制，补零）。 */
function formatClock(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function EntryReaderPage({ slug, chapterStart }: EntryReaderPageProps): JSX.Element {
  const { ready, slugMap, knownSlugs } = useStation();
  const item = slugMap.get(slug);
  const entryTitle = item?.t ?? slug;

  const [prefs, setPrefs] = useState<ReaderPrefs>(() => readReadPrefs());
  // 起始章节：
  //   1) 从详情页章节目录点进来（URL 带 ?ch=<docs 下标>，0=导读）→ 直达该章；
  //   2) 否则冷启动 / 返回再进：若续读记录属于当前词条，恢复到离开时的章节（而非一律导读 0）。
  const [index, setIndex] = useState<number>(() => {
    if (typeof chapterStart === 'number' && Number.isFinite(chapterStart)) {
      return Math.max(0, Math.floor(chapterStart));
    }
    const last = getLastRead();
    return last && last.slug === slug ? Math.max(0, Math.floor(last.chapterIndex)) : 0;
  });
  const [loaded, setLoaded] = useState<LoadedDoc | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  const [overlay, setOverlay] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [chapterOpen, setChapterOpen] = useState<boolean>(false);
  // 目录搜索：过滤章节名 / 二级小节标题
  const [tocQuery, setTocQuery] = useState<string>('');
  // 信息栏滚隐：overlay 显示期间，用户滚动正文时信息栏淡出，停顿 ~2s 后自动淡入。
  // 仍保留「点中央唤出/隐藏」的既有交互；二者叠加构成灵动显隐。
  const [chromeDismissed, setChromeDismissed] = useState<boolean>(false);
  // 章内阅读进度 0-100（拖动滑杆时也是这个值；切章时由 reset effect 归 0 并随 scroll 实时刷新）
  const [chapterScrollPct, setChapterScrollPct] = useState<number>(0);
  // 目录二级小节：key(文档 key) → 该文档内的标题列表
  const [headingsMap, setHeadingsMap] = useState<Record<string, HeadingView[]>>({});
  // 点击小节后：跳到目标章并滚动到对应标题（载入完成后再执行滚动）
  const [pendingScroll, setPendingScroll] = useState<{ index: number; text: string } | null>(null);
  // 底部常驻信息条：当前时间（HH:MM，每秒刷新）+ 电量（getBattery 可用时；不可用则不显示）。
  const [clock, setClock] = useState<string>(() => formatClock(new Date()));
  const [battery, setBattery] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // 目录面板「左缘右滑关闭」手势：记录起点，结束滑动时判定
  const sheetTouchStart = useRef<{ x: number; y: number } | null>(null);
  // 信息栏滚隐计时：停止滚动后延时淡入
  const chromeRevealTimer = useRef<number | null>(null);
  // 章末自动加载：去抖计时 + 是否已触发的去抖保护
  const autoNextTimer = useRef<number | null>(null);
  const autoNextArmed = useRef<boolean>(false);
  const overlayRef = useRef<boolean>(false);
  overlayRef.current = overlay;

  // 文档清单：导读 + 全部内容章节（container 卷不单独成页）
  const docs = useMemo<DocDef[]>(() => {
    const list: DocDef[] = [{ key: '__main__', kind: 'main', title: entryTitle }];
    const chs = flattenChapterList(item?.toc ?? []).filter((c) => c.kind !== 'container');
    for (const c of chs) list.push({ key: c.key, kind: 'chapter', title: c.title });
    return list;
  }, [item, entryTitle]);
  // 章末自动加载用最新章数（scroll effect 每次切章重挂，读到最新 total）
  const totalRef = useRef<number>(docs.length);
  totalRef.current = docs.length;
  // 章末自动加载开关（Ref 读取，避免滚动监听因开关而反复重挂）
  const autoLoadRef = useRef<boolean>(prefs.autoLoad);
  autoLoadRef.current = prefs.autoLoad;

  // 装载目录二级小节：词条就绪后并行抓取各文档（导读 + 各章）的标题层级。
  // 失败不影响阅读，仅该文档不显示小节（fetchDocHeadings 已 try/catch 返回 []）。
  useEffect(() => {
    if (!ready || !item) return;
    let alive = true;
    Promise.all(
      docs.map((d) =>
        fetchDocHeadings(slug, { kind: d.kind, key: d.key }, knownSlugs).then(
          (hs) => [d.key, hs] as const,
        ),
      ),
    )
      .then((pairs) => {
        if (alive) setHeadingsMap(Object.fromEntries(pairs));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [ready, item, slug, docs, knownSlugs]);

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
      parent.scrollTo({ top: Math.max(0, top - 12), behavior: 'smooth' });
    }
    setPendingScroll(null);
  }, [pendingScroll, loaded, index]);

  // 装载当前文档
  useEffect(() => {
    let alive = true;
    const def = docs[Math.min(index, docs.length - 1)];
    setStatus('loading');
    setLoaded(null);
    if (!def || !ready) return;
    if (!item) {
      setStatus('error');
      setError('该 slug 不在本地索引中');
      return;
    }
    const task =
      def.kind === 'main'
        ? loadEntryDocument(slug, knownSlugs, item.toc ?? [])
        : loadChapterDocument(slug, def.key, knownSlugs);
    task
      .then((d) => {
        if (!alive) return;
        setLoaded({ html: d.html, title: 'title' in d && typeof d.title === 'string' ? d.title : def.title });
        setStatus('ready');
        // 阅读历史（仅成功装载后记录；续读位置由下方即时持久化 effect 负责）
        // 进度按当前章节 / 总章节估算（章节间均匀），用于「看过」页进度条。
        const totalCh = docs.length;
        const progress = totalCh > 1 ? Math.round((index / (totalCh - 1)) * 100) : 100;
        addToHistory(slug, entryTitle, progress);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setStatus('error');
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, index, ready, item, knownSlugs, entryTitle]);

  // 路由层按 slug 重挂载本组件（routeKey = entry-reader:{slug}），slug 不会原地变化；
  // 因此无需「slug 变化复位到导读」——初始章节由上面 useState 从续读记录恢复。

  // —— 系统返回兜底 ——
  // Android 物理/手势返回由原生层接管（MainActivity.onBackPressed → evaluateJavascript
  // 调 window.__pksHandleBack()，见 lib/backHandler.ts），阅读页返回会原地 replace 到封面，
  // 无需也不应在 Web 层用 replaceState/pushState 造 history 栈 —— 那套逻辑在真机上会因
  // WebView 对 replaceState 补发 hashchange 而把页面从阅读页「闪回」详情页。
  //
  // 这里仅保留 popstate 监听，作为浏览器/桌面端（无原生返回通道）的返回兜底：
  // 物理返回弹到封面 hash 时补发一次 hashchange，让 hash 路由把封面渲染出来。浏览器端
  // 由地址栏 history 驱动，popstate 必触发；桌面端无原生 onBackPressed，此监听负责兜底。
  useEffect(() => {
    const onPop = (): void => {
      // 仅作浏览器/桌面兜底：弹回非阅读页 hash 时补发 hashchange 让路由重新解析。
      // 不主动改 hash、不 navigate —— 避免与原生返回链路冲突或造成跳转闪烁。
      window.dispatchEvent(new Event('hashchange'));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 原生返回键浮层优先：目录 / 阅读设置打开时，先关浮层而不是直接退出阅读页。
  // 通过 lib/backHandler 的拦截器接入，返回 true 表示本次返回已被消费。
  useEffect(() => {
    setBackInterceptor(() => {
      if (settingsOpen) {
        setSettingsOpen(false);
        return true;
      }
      if (chapterOpen) {
        setChapterOpen(false);
        return true;
      }
      return false;
    });
    return () => setBackInterceptor(null);
  }, [settingsOpen, chapterOpen]);

  // 内容收缩（本地索引变更）时把越界的章节下标拉回合法范围。
  // 仅在索引就绪后生效：就绪前 docs 是「仅导读」的占位清单，不能据此复位续读章节。
  useEffect(() => {
    if (!item || !ready) return;
    if (docs.length > 0 && index > docs.length - 1) {
      setIndex(docs.length - 1);
    }
  }, [index, docs.length, item, ready]);

  // 续读位置即时持久化：词条合法且索引就绪时，章节一切换就落盘。
  // 与正文异步装载解耦，避免快速切章后立刻返回时位置仍停留在上一章。
  useEffect(() => {
    if (!item || !ready) return;
    setLastRead(slug, Math.max(0, Math.min(index, docs.length - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, index, item, ready, docs.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    // 切章时把滑杆归 0（随后随 scroll 实时刷新到正确百分比）
    setChapterScrollPct(0);
    // 切章后取消可能悬置的滚隐计时，并恢复信息栏（若原本唤出）
    setChromeDismissed(false);
  }, [index]);

  /**
   * 章节内滚动 → 滑杆百分比联动 + 信息栏滚隐 + 章末自动加载下一章：
   *  - scroll 事件 → 计算 (scrollTop) / (scrollHeight - clientHeight) × 100
   *  - 短内容（无需滚动）→ 100%（用户已"读完"）
   *  - 拖动滑杆 → setScrollTop 到对应位置（onChange 走 slider 的 setter）
   *  - rAF 节流，避免拖动时频繁 setState
   *  - 用户滚动时隐藏信息栏，停顿 ~1.8s 后自动淡入（仅在 overlay 唤出态生效）
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
      if (!overlayRef.current) return;
      setChromeDismissed(true);
      if (chromeRevealTimer.current !== null) window.clearTimeout(chromeRevealTimer.current);
      chromeRevealTimer.current = window.setTimeout(() => {
        chromeRevealTimer.current = null;
        setChromeDismissed(false);
      }, 1800);
    };
    const compute = (): void => {
      raf = 0;
      const max = el.scrollHeight - el.clientHeight;
      const pct = max <= 0 ? 100 : Math.max(0, Math.min(100, (el.scrollTop / max) * 100));
      setChapterScrollPct(pct);
      // 章末自动加载：仅当「自动加载」开启、内容可滚动(max>0)且真正滚到底(距底≤4px)才触发，
      // 短章(max<=0)不自动跳，避免「装载即级联切章」；去抖 400ms 防惯性误触。
      const autoLoadOn = autoLoadRef.current;
      const atBottom = max > 0 && el.scrollTop >= max - 4;
      if (atBottom && autoLoadOn && !autoNextArmed.current) {
        autoNextArmed.current = true;
        autoNextTimer.current = window.setTimeout(() => {
          autoNextTimer.current = null;
          autoNextArmed.current = false;
          onBottom();
        }, 400);
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

  // 进入阅读页即应用阅读区偏好
  useEffect(() => {
    applyReadPrefs(readReadPrefs());
  }, [prefs]);

  // 底部信息条「当前时间」：showProgress 开启时每秒刷新；关闭或离开页面时清理 interval。
  useEffect(() => {
    if (!prefs.showProgress) return;
    setClock(formatClock(new Date()));
    const id = window.setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => window.clearInterval(id);
  }, [prefs.showProgress]);

  // 底部信息条「电量」：仅当 navigator.getBattery 可用时读取；不可用则保持 null（只显示时间，不编造）。
  useEffect(() => {
    if (!prefs.showProgress) return;
    let alive = true;
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{ level: number }>;
    };
    if (typeof nav.getBattery !== 'function') {
      setBattery(null);
      return;
    }
    nav
      .getBattery()
      .then((b) => {
        if (alive) setBattery(Math.round((b.level ?? 0) * 100));
      })
      .catch(() => {
        if (alive) setBattery(null);
      });
    return () => {
      alive = false;
    };
  }, [prefs.showProgress]);

  /**
   * 状态栏常驻：仅作用于阅读页（不在其他页面生效）。
   *   进入阅读页 → 隐藏系统状态栏（除非用户开了"手机状态栏常驻"）
   *   离开阅读页 → 立刻显示系统状态栏（恢复其他页面的默认行为）
   *   切换 pref → 立即同步给原生层
   * 同时把"沉浸态"标到 .reader-root（CSS 用它把 env(safe-area-inset-top) 强制归 0，
   * 避免状态栏已隐藏但 WebView 仍为旧 inset 高度预留空白）。
   */
  useEffect(() => {
    const w = window as unknown as { PKS?: { setStatusBarPermanent?: (on: boolean) => void } };
    const call = (on: boolean): void => {
      try { w.PKS?.setStatusBarPermanent?.(on); } catch { /* ignore */ }
    };
    const immersive = !prefs.statusbarPermanent;
    call(!immersive);
    if (rootRef.current) {
      rootRef.current.dataset.immersive = immersive ? '1' : '0';
    }
    document.documentElement.style.setProperty(
      '--reader-inset-top-override',
      immersive ? '0px' : '',
    );
    return () => {
      // 离开阅读页 → 始终恢复显示（避免污染其他页面）
      call(true);
      document.documentElement.style.removeProperty('--reader-inset-top-override');
    };
  }, [prefs.statusbarPermanent]);
  const go = useCallback(
    (delta: number) => {
      setChapterOpen(false);
      setIndex((v) => Math.min(docs.length - 1, Math.max(0, v + delta)));
    },
    [docs.length],
  );

  // ← 返回封面：用 replaceRoute 原地替换（不新增历史层），避免「阅读页↔封面」
  // 在系统返回时反复出现；同时也保证返回后顶部导航栏一定出现，不会卡在阅读态。
  const backToCover = useCallback(() => {
    replaceRoute(`/entry-cover/${encodeURIComponent(slug)}`);
  }, [slug]);

  const openChapter = useCallback(() => {
    setSettingsOpen(false);
    setChapterOpen(true);
  }, []);

  // 快速「夜间」开关：进入深色背景，退出恢复到进入前的浅色背景。
  const prevBgRef = useRef<BgColorPref | null>(null);
  const toggleNight = useCallback(() => {
    const cur = prefs.bgColor;
    if (cur === 'dark') {
      const restore: BgColorPref = prevBgRef.current && prevBgRef.current !== 'dark' ? prevBgRef.current : 'white';
      prevBgRef.current = null;
      setPrefs(writeReadPref('bgColor', restore));
    } else {
      prevBgRef.current = cur;
      setPrefs(writeReadPref('bgColor', 'dark'));
    }
  }, [prefs.bgColor]);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (t) touchStart.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const start = touchStart.current;
      touchStart.current = null;
      if (!start) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dx) > SWIPE_X && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (dx < 0) go(1);
        else go(-1);
      }
    },
    [go],
  );

  // 目录面板左缘右滑关闭：起点需在屏幕左缘(≤40px)且明显向右滑、纵向位移小
  const onSheetTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (t) sheetTouchStart.current = { x: t.clientX, y: t.clientY };
  }, []);
  const onSheetTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const s = sheetTouchStart.current;
      sheetTouchStart.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (s.x <= 40 && dx > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        setChapterOpen(false);
      }
    },
    [],
  );

  const changePref = useCallback(
    <K extends keyof ReaderPrefs>(key: K, value: ReaderPrefs[K]): void => {
      setPrefs(writeReadPref(key, value));
    },
    [],
  );

  const onSurfaceClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.closest('a, button, input, textarea, select, label, [data-control]')) return;
      if (settingsOpen) {
        setSettingsOpen(false);
        return;
      }
      if (chapterOpen) {
        setChapterOpen(false);
        return;
      }
      if (overlay) {
        setOverlay(false);
        return;
      }
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) {
        setOverlay(true);
        return;
      }
      const ratio = (e.clientX - rect.left) / rect.width;
      if (ratio < 0.26) {
        go(-1);
      } else if (ratio > 0.74) {
        go(1);
      } else {
        setOverlay(true);
      }
    },
    [overlay, settingsOpen, chapterOpen, go],
  );

  if (!ready) {
    return (
      <div className="reader-root reader-state">
        <div className="state-box">
          <Spinner />
          <p className="state-title">正在装载本地索引…</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="reader-root reader-state">
        <div className="state-box">
          <div className="error-card">
            <h2>词条不存在</h2>
            <p className="error-msg">
              <code>{slug}</code> 不在本地索引中。
            </p>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
              回到首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  const bg = bgClassOf(prefs.bgColor);
  const veilOpacity = brightnessVeil(prefs.brightnessLevel);
  // 亮度调节的合成开销优化：
  //   filter 施加在 .reader-root 上会让「包含滚动容器的整屏」成为 filter layer，
  //   滚动时每帧重新栅格化 → 掉帧。因此只在【需要提亮】（filter > 1）时使用 CSS filter，
  //   压暗（filter <= 1，含默认与调暗档）完全交给 .reader-veil 黑色遮罩（仅 opacity 合成，零重绘）。
  //   这样绝大多数场景滚动内容不处于 filter 层内，滚动顺滑。
  const filterBrightness = Number(brightnessFilter(prefs.brightnessLevel));
  const rootStyle: React.CSSProperties =
    filterBrightness > 1.001 ? { filter: `brightness(${filterBrightness})` } : {};
  const total = docs.length;
  const isNight = prefs.bgColor === 'dark';
  const currentPos = Math.min(index + 1, total);

  return createPortal(
    <div
      ref={rootRef}
      className={`reader-root${bg ? ` ${bg}` : ''}${overlay ? ' has-overlay' : ''}${chromeDismissed ? ' chrome-dismissed' : ''}${prefs.showProgress ? '' : ' reader-no-statusbar'}`}
      style={rootStyle}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onClick={onSurfaceClick}
    >
      <div ref={scrollRef} className="reader-scroll">
        <article
          key={`${slug}:${docs[Math.min(index, total - 1)]?.key ?? index}:${index}`}
          className="reader-doc"
          data-anim={prefs.animation}
        >
          {status === 'loading' ? (
            <div className="reader-loading">
              <Spinner size={22} />
            </div>
          ) : status === 'error' || !loaded ? (
            <div className="reader-error">
              <p>{error || '正文加载失败'}</p>
              <Link to={`/entry/${encodeURIComponent(slug)}`} className="btn btn-ghost">
                返回详情
              </Link>
            </div>
          ) : (
            <div className="prose" dangerouslySetInnerHTML={{ __html: loaded.html }} />
          )}
        </article>
      </div>

      {veilOpacity > 0 ? <div className="reader-veil" style={{ opacity: veilOpacity }} aria-hidden="true" /> : null}

      <header className="reader-top">
        {/* 顶部按新稿仅保留左侧返回「<」；进度与目录已分别移到底部信息条 / 3 等分导航栏 */}
        <div className="reader-top-bar reader-top-bar-solo">
          <button
            type="button"
            className="reader-circle-btn reader-circle-btn-sm"
            aria-label="返回详情"
            onClick={backToCover}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>

      <footer className="reader-bottom">
        {/* 上行：上一章 + 章节进度条（可拖动跳章） + 下一章 */}
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
            value={Math.round(chapterScrollPct)}
            aria-label="章节阅读进度"
            aria-valuetext={`已读 ${Math.round(chapterScrollPct)}%`}
            onInput={(e) => {
              const pct = Number((e.target as HTMLInputElement).value);
              const el = scrollRef.current;
              if (!el) return;
              const max = el.scrollHeight - el.clientHeight;
              el.scrollTo({ top: (max * pct) / 100, behavior: 'auto' });
            }}
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
        {/* 下行：3 等分导航栏（目录 / 夜间 / 设置），图标在上、文字在下，三项等宽 */}
        <div className="reader-bottom-tabs">
          <button type="button" className="reader-tab" aria-label="章节目录" onClick={openChapter}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <line x1="4" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="4" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="reader-tab-label">目录</span>
          </button>
          <button
            type="button"
            className="reader-tab"
            aria-label={isNight ? '日间模式' : '夜间模式'}
            onClick={toggleNight}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              {isNight ? (
                <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4" />
                  <line x1="12" y1="2" x2="12" y2="4" />
                  <line x1="12" y1="20" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="4" y2="12" />
                  <line x1="20" y1="12" x2="22" y2="12" />
                </g>
              ) : (
                <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="currentColor" />
              )}
            </svg>
            <span className="reader-tab-label">{isNight ? '日间' : '夜间'}</span>
          </button>
          <button
            type="button"
            className="reader-tab"
            aria-label="阅读区设置"
            onClick={() => setSettingsOpen(true)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <span className="reader-tab-label">设置</span>
          </button>
        </div>
      </footer>

      {/* 底部常驻信息条（不受 overlay 影响）：左下 进度 1/666，右下 时间 + 电量。
          仅 prefs.showProgress 开启时渲染。 */}
      {prefs.showProgress ? (
        <div className="reader-statusbar" aria-live="off">
          <span className="reader-statusbar-progress">{`${currentPos}/${total}`}</span>
          <span className="reader-statusbar-right">
            <span className="reader-statusbar-time">{clock}</span>
            {battery !== null ? <span className="reader-statusbar-battery">{`${battery}%`}</span> : null}
          </span>
        </div>
      ) : null}

      <ReaderSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        prefs={prefs}
        onChange={changePref}
      />

      {/* 划词词典：浮动工具条 + 释义卡（自身 portal 到 body，与 .reader-root 同级，
          不参与 onSurfaceClick / 左右滑切章判定；切章自动清空） */}
      <ReaderSelectionMenu
        bg={prefs.bgColor}
        scrollRef={scrollRef}
        resetKey={`${slug}:${index}`}
        enabled={status === 'ready' && !!loaded}
      />

      {chapterOpen ? (
        <div className="reader-sheet-layer" data-control="sheet">
          <div className="reader-sheet-mask" onClick={() => setChapterOpen(false)} />
          <div
            className={`reader-sheet reader-chapter-sheet reader-sheet-bg-${prefs.bgColor}`}
            role="dialog"
            aria-label="章节目录"
            onTouchStart={onSheetTouchStart}
            onTouchEnd={onSheetTouchEnd}
          >
            <div className="reader-sheet-handle" aria-hidden="true" />
            <h3 className="reader-sheet-title reader-sheet-title-sm">目录</h3>
            <div className="reader-sheet-body reader-chapter-body">
              {/* 目录搜索：按章节名 / 二级小节标题过滤 */}
              <div className="toc-search">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                  <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  className="toc-search-input"
                  type="search"
                  placeholder="搜索章节 / 小节"
                  value={tocQuery}
                  onChange={(e) => setTocQuery(e.target.value)}
                  aria-label="搜索章节"
                />
                {tocQuery ? (
                  <button
                    type="button"
                    className="toc-search-clear"
                    aria-label="清空搜索"
                    onClick={() => setTocQuery('')}
                  >
                    ×
                  </button>
                ) : null}
              </div>
              <div className="toc-search-list">
              {(() => {
                const cur = Math.min(index, total - 1);
                const q = tocQuery.trim().toLowerCase();
                // 卷标题 kind='container' 在第一层 toc；这里 docs 已被剥掉，
                // 故我们简化为单卷连续列表；如果数据有卷，请用原始 toc 渲染卷头。
                let chapterNo = 0;
                const rows = docs.map((d, i) => {
                  const isMain = d.kind === 'main';
                  if (!isMain) chapterNo++;
                  const subs = (headingsMap[d.key] ?? []).filter(
                    (s) => !q || s.text.toLowerCase().includes(q),
                  );
                  const titleMatch = !q || d.title.toLowerCase().includes(q) || (isMain && entryTitle.toLowerCase().includes(q));
                  if (q && !titleMatch && subs.length === 0) return null; // 搜索时不命中则整组隐藏
                  const shownSubs = q ? subs : (headingsMap[d.key] ?? []);
                  const isActive = i === cur;
                  const readPercent = isActive ? 100 : i < cur ? 100 : 0;
                  return (
                    <div
                      key={`${d.kind}:${d.key}`}
                      className={`chapter-group${isActive ? ' is-active' : ''}`}
                    >
                      <div
                        className="chapter-row"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setIndex(i);
                          setChapterOpen(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setIndex(i);
                            setChapterOpen(false);
                          }
                        }}
                      >
                        <div className="chapter-row-main">
                          <span className="chapter-no">{isMain ? '序' : `第${chapterNo}章`}</span>
                          <span className="chapter-name">{isMain ? entryTitle : d.title}</span>
                          {isActive ? <span className="chapter-here">读到这里</span> : null}
                          {readPercent > 0 ? (
                            <span className="chapter-read">读至{readPercent}%</span>
                          ) : null}
                        </div>
                      </div>
                      {shownSubs.length > 0 ? (
                        <ul className="chapter-sublist">
                          {shownSubs.map((s, si) => (
                            <li key={`${d.key}:${si}`}>
                              <button
                                type="button"
                                className="chapter-subitem"
                                onClick={() => {
                                  setIndex(i);
                                  setPendingScroll({ index: i, text: s.text });
                                  setChapterOpen(false);
                                }}
                              >
                                {s.text}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  );
                }).filter((r): r is JSX.Element => r !== null);
                if (rows.length === 0) {
                  return <div className="toc-search-empty">未找到「{tocQuery}」相关章节</div>;
                }
                return rows;
              })()}
              </div>
            </div>
            {/* 无"收起"按钮：点击屏幕空白处即关（@4.jpg 标注） */}
          </div>
        </div>
      ) : null}
    </div>,
    document.body
  );
}
