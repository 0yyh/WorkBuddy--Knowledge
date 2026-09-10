/**
 * 应用外壳：顶栏（桌面保留完整导航；移动端只留 logo）+ 内容区 + 底部标签栏。
 * 阅读页（isReader）时整体隐藏 header / footer / tabbar，由 EntryReaderPage 全屏接管。
 * 顶栏「知识」导航会在主区域下滑时隐藏、上滑时显现（避免遮挡长列表）。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, navigate } from '../router';
import { SearchBox } from './SearchBox';
import { useStation } from '../state/AppContext';
import { useImmersive } from '../state/ImmersiveContext';
import { TabBar } from './TabBar';
import { Spinner } from './Spinner';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps): JSX.Element {
  const { loading, error, tracks, manifest, reload } = useStation();
  const { isImmersive, isReader } = useImmersive();
  const showChrome = !isReader;

  // 顶栏自动隐藏：下滑超过阈值隐藏、上滑显示；距离顶部 ≤ 阈值始终显示
  // 注意：本布局下滚动发生在 window/document（.app-shell 是普通文档流，.app-main 无 overflow），
  // 而非 <main> 元素——必须监听 window scroll（document.scrollingElement.scrollTop），
  // 否则 el.scrollTop 恒为 0，顶栏永不隐藏。
  const [headerHidden, setHeaderHidden] = useState<boolean>(false);
  const lastYRef = useRef<number>(0);
  const showChromeRef = useRef(showChrome);
  showChromeRef.current = showChrome;
  useEffect(() => {
    let raf = 0;
    const THRESHOLD = 6; // 单次滑动 > 6px 才判定方向，避免抖动
    const TOP_KEEP = 40; // 距顶 ≤ 40px 时强制显示
    const onScroll = (): void => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        if (!showChromeRef.current) return;
        const scroller = document.scrollingElement || document.documentElement;
        const y = scroller.scrollTop;
        if (y <= TOP_KEEP) {
          setHeaderHidden(false);
        } else {
          const delta = y - lastYRef.current;
          if (delta > THRESHOLD) setHeaderHidden(true);
          else if (delta < -THRESHOLD) setHeaderHidden(false);
        }
        lastYRef.current = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  // 离开阅读态（返回详情/其它页）时，强制顶栏显示、滚动基准归零，
  // 避免「返回后顶栏不出现、要再按一次返回才出现」的观感问题。
  useEffect(() => {
    if (!isReader) {
      setHeaderHidden(false);
      lastYRef.current = 0;
    }
  }, [isReader]);

  return (
    <div
      className={`app-shell${isImmersive ? ' is-immersive' : ''}${isReader ? ' is-reader' : ''}${headerHidden ? ' header-hidden' : ''}`}
    >
      {showChrome ? (
        <header className="app-header">
          <div className="header-inner">
            <Link to="/" className="brand" title="返回首页">
              <span className="brand-mark">知</span>
              <span className="brand-text">
                <strong>知识</strong>
                <small>本地 · 离线 · 顺序阅读</small>
              </span>
            </Link>

            <nav className="nav-links">
              <Link to="/" className="nav-link">
                首页
              </Link>
              <Link to="/timeline" className="nav-link">
                时间线
              </Link>
              {tracks.map((t) => (
                <Link key={t.id} to={`/timeline/${t.id}`} className="nav-link nav-link-sub">
                  {t.title}
                </Link>
              ))}
            </nav>

            <div className="header-search">
              <SearchBox />
            </div>
          </div>
        </header>
      ) : null}

      <main className="app-main">
        {loading ? (
          <div className="state-box">
            <Spinner />
            <p className="state-title">正在装载本地索引…</p>
            <p className="state-hint">首次打开需要读取 manifest / taxonomy / title 三个常驻索引</p>
          </div>
        ) : error ? (
          <div className="state-box">
            <div className="error-card">
              <h2>内容资源未就绪</h2>
              <p className="error-msg">{error}</p>
              <ol className="error-steps">
                <li>
                  构建索引：<code>pnpm build:index</code>
                </li>
                <li>
                  同步资源：<code>pnpm -F @pks/web copy:content</code>
                </li>
                <li>刷新本页面</li>
              </ol>
              <div className="row-actions">
                <button type="button" className="btn btn-primary" onClick={reload}>
                  重新加载
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>
                  回到首页
                </button>
              </div>
            </div>
          </div>
        ) : (
          children
        )}
      </main>

      {showChrome ? (
        <footer className="app-footer">
          <span>
            {manifest
              ? `共 ${manifest.stats.entries} 词条 · ${manifest.stats.sections} 章节 · ${manifest.stats.words} 字 · 索引 ${manifest.built_at.slice(0, 10)}`
              : '本地内容'}
          </span>
          <span className="footer-dim">内容由 @pks/core 校验并净化后渲染</span>
        </footer>
      ) : null}

      <TabBar />
    </div>
  );
}
