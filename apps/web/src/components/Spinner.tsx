/**
 * 加载指示器（纯 CSS，无依赖）。
 */
interface SpinnerProps {
  size?: number;
}

export function Spinner({ size = 28 }: SpinnerProps): JSX.Element {
  return (
    <span
      className="spinner"
      role="status"
      aria-label="加载中"
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
}
