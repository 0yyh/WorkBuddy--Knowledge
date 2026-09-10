/**
 * 首页"再按一次退出知识"提示浮层。
 *
 * 挂载于 App 根部，用 registerExitHint() 把自己接进 lib/backHandler 的返回链路：
 * 用户在首页按第一次返回键时，handleNativeBack 会调用这里的显示回调 → 弹出一个
 * 底部半透明胶囊，2.2s 后淡出；若用户在窗口内再次按返回（仍在首页）则真退出。
 *
 * 纯 UI：状态机（显示/隐藏）完全由这里管理，不依赖路由上下文。
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { registerExitHint } from '../lib/backHandler';

/** 提示停留时长（ms） */
const HINT_VISIBLE_MS = 2200;

export function ExitToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [visible, setVisible] = useState<boolean>(false);
  const timer = useRef<number | null>(null);

  const show = useCallback(() => {
    setVisible(true);
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setVisible(false);
      timer.current = null;
    }, HINT_VISIBLE_MS);
  }, []);

  useEffect(() => {
    // 让 backHandler 在"首页按返回"时能弹出本提示
    const unregister = registerExitHint(show);
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
      unregister();
    };
  }, [show]);

  return (
    <>
      {children}
      {visible ? (
        <div className="exit-toast" role="status" aria-live="polite">
          <span className="exit-toast-text">再按一次退出知识</span>
        </div>
      ) : null}
    </>
  );
}
