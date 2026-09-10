/**
 * 沉浸 / 阅读器状态：
 *  - isReader：当前位于阅读页（EntryReaderPage）。为 true 时隐藏 App 头部/底栏/footer，
 *    阅读页自身提供全屏浮层（淡入淡出）。
 *  - isImmersive：兼容旧版“点击唤出导航”状态；Chrome 用 opacity 过渡淡入淡出。
 * 仅移动端（≤700px）通常进入阅读页；桌面端阅读页同样全屏接管。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface ImmersiveState {
  isImmersive: boolean;
  setImmersive: (value: boolean) => void;
  toggle: () => void;
  isReader: boolean;
  setReader: (value: boolean) => void;
}

const ImmersiveContext = createContext<ImmersiveState>({
  isImmersive: false,
  setImmersive: () => undefined,
  toggle: () => undefined,
  isReader: false,
  setReader: () => undefined,
});

export function ImmersiveProvider({ children }: { children: ReactNode }): JSX.Element {
  const [isImmersive, setIsImmersive] = useState<boolean>(false);
  const [isReader, setIsReader] = useState<boolean>(false);

  const setImmersive = useCallback((value: boolean) => {
    setIsImmersive(value);
  }, []);

  const toggle = useCallback(() => {
    setIsImmersive((v) => !v);
  }, []);

  const setReader = useCallback((value: boolean) => {
    setIsReader(value);
  }, []);

  const value = useMemo<ImmersiveState>(
    () => ({ isImmersive, setImmersive, toggle, isReader, setReader }),
    [isImmersive, setImmersive, toggle, isReader, setReader],
  );

  return <ImmersiveContext.Provider value={value}>{children}</ImmersiveContext.Provider>;
}

/** 读取沉浸/阅读器状态 */
export function useImmersive(): ImmersiveState {
  return useContext(ImmersiveContext);
}

/** 移动端断点（与 styles.css 的 @media (max-width: 700px) 保持一致） */
export const MOBILE_QUERY = '(max-width: 700px)';

/** 订阅移动端断点（用于 JS 侧守卫，避免桌面误触沉浸切换） */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (): void => setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
