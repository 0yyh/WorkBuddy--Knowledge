/**
 * 正文阅读页（全屏）：#/entry-reader/:slug
 *
 * 薄编排层（P2-9 重构后）：仅持有 prefs / index / loaded / status / overlay、4 个互斥浮层
 * 开关、headingsMap / clock / battery，并渲染 reader-root + chrome + 各浮层。
 * 滚动 / 翻章 / 信息栏滚隐 / 章末自动加载 抽至 hooks/useReaderScroll.ts；
 * 目录面板内容抽至 components/ReaderToc.tsx；底部 chrome 抽至 components/ReaderChrome.tsx。
 * 3 层设置浮层已由 components/ReaderSettingsSheet.tsx + SubSheet 常驻渲染（含互斥状态），保持不变。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Spinner } from '../components/Spinner';
import {
  ReaderFontSheet,
  ReaderMoreSheet,
  ReaderSettingsSheet,
  ReaderSpacingSheet,
} from '../components/ReaderSettingsSheet';
import { BaseSheet } from '../components/sheet/BaseSheet';
import { ReaderSelectionMenu } from '../components/ReaderSelectionMenu';
import { ReaderChrome } from '../components/ReaderChrome';
import { ReaderToc, type DocDef } from '../components/ReaderToc';
import { useReaderScroll } from '../hooks/useReaderScroll';
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
import { CLOCK_INTERVAL_MS, TAP_LEFT_RATIO, TAP_RIGHT_RATIO } from '../lib/reader-constants';
import { useStation } from '../state/AppContext';
import type { HeadingView } from '../types';

interface EntryReaderPageProps {
  slug: string;
  /** 从详情页目录点击进入时指定起始章节下标（docs 数组下标，0=导读）；缺省走续读恢复 */
  chapterStart?: number;
}

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
  const [index, setIndex] = useState<number>(() => {
    if (typeof chapterStart === 'number' && Number.isFinite(chapterStart)) {
      return Math.max(0, Math.floor(chapterStart));
    }
    const last = getLastRead();
    return last && last.slug === slug ? Math.max(0, Math.floor(last.chapterIndex)) : 0;
  });
  const [loaded, setLoaded] = useState<{ html: string; title: string } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  const [overlay, setOverlay] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [chapterOpen, setChapterOpen] = useState<boolean>(false);
  // 字体 / 间距 / 更多子层：与主设置面板互斥，同一时间仅显示一个卡片
  const [fontOpen, setFontOpen] = useState<boolean>(false);
  const [spacingOpen, setSpacingOpen] = useState<boolean>(false);
  const [moreOpen, setMoreOpen] = useState<boolean>(false);
  // 目录二级小节：key(文档 key) → 该文档内的标题列表
  const [headingsMap, setHeadingsMap] = useState<Record<string, HeadingView[]>>({});
  const [clock, setClock] = useState<string>(() => formatClock(new Date()));
  const [battery, setBattery] = useState<number | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);

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

  // 左右滑 / 点按翻章：关闭目录并夹取边界
  const go = useCallback(
    (delta: number) => {
      setChapterOpen(false);
      setIndex((v) => Math.min(docs.length - 1, Math.max(0, v + delta)));
    },
    [docs.length],
  );

  // 滚动 / 翻章 / 信息栏滚隐 / 章末自动加载：全部 DOM 交互交给 hook
  const {
    scrollRef,
    sliderRef,
    onTouchStart,
    onTouchEnd,
    onSliderInput,
    revealChrome,
    requestScrollToHeading,
    chromeDismissed,
  } = useReaderScroll({ index, loaded, overlay, autoLoadRef, totalRef, setIndex, go });

  const backToCover = useCallback(() => {
    replaceRoute(`/entry-cover/${encodeURIComponent(slug)}`);
  }, [slug]);

  // 浮层互斥：打开任一浮层时关闭其它
  const openChapter = useCallback(() => {
    setSettingsOpen(false);
    setFontOpen(false);
    setSpacingOpen(false);
    setMoreOpen(false);
    setChapterOpen(true);
  }, []);

  const openSettings = useCallback(() => {
    setFontOpen(false);
    setSpacingOpen(false);
    setMoreOpen(false);
    setChapterOpen(false);
    setSettingsOpen(true);
  }, []);
  const openFont = useCallback(() => {
    setSettingsOpen(false);
    setSpacingOpen(false);
    setMoreOpen(false);
    setFontOpen(true);
  }, []);
  const openSpacing = useCallback(() => {
    setSettingsOpen(false);
    setFontOpen(false);
    setMoreOpen(false);
    setSpacingOpen(true);
  }, []);
  const openMore = useCallback(() => {
    setSettingsOpen(false);
    setFontOpen(false);
    setSpacingOpen(false);
    setMoreOpen(true);
  }, []);
  const closeFont = useCallback(() => setFontOpen(false), []);
  const closeSpacing = useCallback(() => setSpacingOpen(false), []);
  const closeMore = useCallback(() => setMoreOpen(false), []);

  // 快速「夜间」开关：进入深色背景，退出恢复到进入前的浅色背景
  const prevBgRef = useRef<BgColorPref | null>(null);
  const toggleNight = useCallback(() => {
    const cur = prefs.bgColor;
    if (cur === 'dark') {
      const restore: BgColorPref =
        prevBgRef.current && prevBgRef.current !== 'dark' ? prevBgRef.current : 'white';
      prevBgRef.current = null;
      setPrefs(writeReadPref('bgColor', restore));
    } else {
      prevBgRef.current = cur;
      setPrefs(writeReadPref('bgColor', 'dark'));
    }
  }, [prefs.bgColor]);

  const changePref = useCallback(
    <K extends keyof ReaderPrefs>(key: K, value: ReaderPrefs[K]): void => {
      setPrefs(writeReadPref(key, value));
    },
    [],
  );

  // 点中央：先清掉残留滚隐态，再判定（唤出 overlay / 左右翻章）
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
      // 唤起 overlay 时必须同时清掉滚隐态：否则任何残留的 chromeDismissed 会让卡片
      // 「已唤起却不可见」，用户感觉点击失灵要多点几次。
      revealChrome();
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) {
        setOverlay(true);
        return;
      }
      const ratio = (e.clientX - rect.left) / rect.width;
      if (ratio < TAP_LEFT_RATIO) {
        go(-1);
      } else if (ratio > TAP_RIGHT_RATIO) {
        go(1);
      } else {
        setOverlay(true);
      }
    },
    [overlay, settingsOpen, chapterOpen, go, revealChrome],
  );

  const onJumpToChapter = useCallback((i: number) => {
    setIndex(i);
    setChapterOpen(false);
  }, []);
  const onJumpToHeading = useCallback(
    (i: number, text: string) => {
      requestScrollToHeading(i, text);
      setChapterOpen(false);
    },
    [requestScrollToHeading],
  );

  // 装载目录二级小节：词条就绪后并行抓取各文档（导读 + 各章）的标题层级
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
        setLoaded({
          html: d.html,
          title: 'title' in d && typeof d.title === 'string' ? d.title : def.title,
        });
        setStatus('ready');
        // 进度按当前章节 / 总章节估算（章节间均匀），用于「看过」页进度条
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

  // 浏览器/桌面端返回兜底：弹回非阅读页 hash 时补发 hashchange 让路由重新解析
  useEffect(() => {
    const onPop = (): void => {
      window.dispatchEvent(new Event('hashchange'));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 原生返回键浮层优先：目录 / 设置 / 子层打开时，先关浮层而不是直接退出阅读页
  useEffect(() => {
    setBackInterceptor(() => {
      if (fontOpen) {
        setFontOpen(false);
        return true;
      }
      if (spacingOpen) {
        setSpacingOpen(false);
        return true;
      }
      if (moreOpen) {
        setMoreOpen(false);
        return true;
      }
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
  }, [settingsOpen, chapterOpen, fontOpen, spacingOpen, moreOpen]);

  // 内容收缩（本地索引变更）时把越界的章节下标拉回合法范围
  useEffect(() => {
    if (!item || !ready) return;
    if (docs.length > 0 && index > docs.length - 1) {
      setIndex(docs.length - 1);
    }
  }, [index, docs.length, item, ready]);

  // 续读位置即时持久化：章节一切换就落盘（与正文异步装载解耦）
  useEffect(() => {
    if (!item || !ready) return;
    setLastRead(slug, Math.max(0, Math.min(index, docs.length - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, index, item, ready, docs.length]);

  // 进入阅读页即应用阅读区偏好
  useEffect(() => {
    applyReadPrefs(readReadPrefs());
  }, [prefs]);

  // 底部信息条显隐同步到 body class：面板层经 Portal 挂到 body，须让 body 也知道
  // showProgress 状态，这样 --reader-statusbar-h 能在面板/目录等层级正确归 0
  useEffect(() => {
    if (prefs.showProgress) {
      document.body.classList.remove('reader-no-statusbar');
    } else {
      document.body.classList.add('reader-no-statusbar');
    }
    return () => document.body.classList.remove('reader-no-statusbar');
  }, [prefs.showProgress]);

  // 底部信息条「当前时间」：showProgress 开启时每秒刷新
  useEffect(() => {
    if (!prefs.showProgress) return;
    setClock(formatClock(new Date()));
    const id = window.setInterval(() => setClock(formatClock(new Date())), CLOCK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [prefs.showProgress]);

  // 底部信息条「电量」：仅当 navigator.getBattery 可用时读取；不可用则保持 null
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

  // 状态栏常驻：仅作用于阅读页；进入隐藏系统状态栏（除非用户开了"手机状态栏常驻"）
  useEffect(() => {
    const w = window as unknown as { PKS?: { setStatusBarPermanent?: (on: boolean) => void } };
    const call = (on: boolean): void => {
      try {
        w.PKS?.setStatusBarPermanent?.(on);
      } catch {
        /* ignore */
      }
    };
    const immersive = !prefs.statusbarPermanent;
    call(!immersive);
    if (rootRef.current) {
      rootRef.current.dataset.immersive = immersive ? '1' : '0';
    }
    document.documentElement.style.setProperty('--reader-inset-top-override', immersive ? '0px' : '');
    return () => {
      call(true);
      document.documentElement.style.removeProperty('--reader-inset-top-override');
    };
  }, [prefs.statusbarPermanent]);

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
  // 仅「提亮」（filter > 1）时用 CSS filter；压暗交给 .reader-veil 黑色遮罩（零重绘）
  const filterBrightness = Number(brightnessFilter(prefs.brightnessLevel));
  const rootStyle: React.CSSProperties =
    filterBrightness > 1.001 ? { filter: `brightness(${filterBrightness})` } : {};
  const total = docs.length;
  const isNight = prefs.bgColor === 'dark';

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

      <ReaderChrome
        index={index}
        total={total}
        showProgress={prefs.showProgress}
        isNight={isNight}
        clock={clock}
        battery={battery}
        sliderRef={sliderRef}
        onBack={backToCover}
        onOpenChapter={openChapter}
        onToggleNight={toggleNight}
        onOpenSettings={openSettings}
        go={go}
        onSliderInput={onSliderInput}
      />

      <ReaderSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        prefs={prefs}
        onChange={changePref}
        onOpenFont={openFont}
        onOpenSpacing={openSpacing}
        onOpenMore={openMore}
      />

      {/* 子层改为「常驻渲染 + open 驱动」：由 SubSheet 播完退场动画再卸载 */}
      <ReaderFontSheet
        open={fontOpen}
        bg={prefs.bgColor}
        fontFamily={prefs.fontFamily}
        onPick={(v) => {
          changePref('fontFamily', v);
          setFontOpen(false);
        }}
        onClose={closeFont}
      />
      <ReaderSpacingSheet
        open={spacingOpen}
        bg={prefs.bgColor}
        align={prefs.align}
        onAlignChange={(v) => changePref('align', v)}
        onClose={closeSpacing}
      />
      <ReaderMoreSheet
        open={moreOpen}
        bg={prefs.bgColor}
        prefs={prefs}
        onChange={changePref}
        onClose={closeMore}
      />

      {/* 划词词典：浮动工具条 + 释义卡（自身 portal 到 body） */}
      <ReaderSelectionMenu
        bg={prefs.bgColor}
        scrollRef={scrollRef}
        resetKey={`${slug}:${index}`}
        enabled={status === 'ready' && !!loaded}
      />

      <BaseSheet
        open={chapterOpen}
        onClose={() => setChapterOpen(false)}
        title="目录"
        titleClassName="reader-sheet-title-sm"
        bg={prefs.bgColor}
        className="reader-chapter-sheet"
      >
        <ReaderToc
          docs={docs}
          headingsMap={headingsMap}
          index={index}
          entryTitle={entryTitle}
          onJumpToChapter={onJumpToChapter}
          onJumpToHeading={onJumpToHeading}
        />
      </BaseSheet>
    </div>,
    document.body,
  );
}
