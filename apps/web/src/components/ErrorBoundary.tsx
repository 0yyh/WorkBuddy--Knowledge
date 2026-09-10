import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** 受保护的子树 */
  children?: ReactNode;
  /** 兜底 UI 标题，默认「页面出错了」 */
  title?: string;
  /** 点击「返回首页」时触发（用于清理本地状态后再跳转）；可选。 */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * 应用级错误边界（Phase 0 · A）。
 *
 * 捕获子树「渲染期」抛出的异常，显示中文兜底 UI（含「返回首页」按钮），避免整页白屏。
 * - componentDidCatch 内用 console.error('[PKS] render error', error, info) 本地留痕。
 * - 「返回首页」优先触发 props.onReset（如清空本地状态后跳首页），
 *   否则退回 window.history.back()；两者皆不可用时仅重置边界状态以便重渲染。
 *
 * 注意：错误边界只能捕获「渲染 / 生命周期 / 构造函数」中的错误，
 * 无法捕获事件处理器、异步代码与 SSR 逻辑的异常（后者由 lib/perf.ts 全局监听兜底）。
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  /** 渲染期出错 → 进入兜底态（不在此处 console，统一在 componentDidCatch 记录） */
  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  /** 错误边界核心钩子：上报错误详情供排查 */
  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[PKS] render error', error, info);
  }

  /** 返回首页：优先 onReset，否则 history.back；最后重置边界以便重渲染 */
  private handleReset = (): void => {
    const { onReset } = this.props;
    if (typeof onReset === 'function') {
      onReset();
    } else if (typeof window !== 'undefined' && typeof window.history.back === 'function') {
      window.history.back();
    }
    this.setState({ hasError: false, message: '' });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="page state-box">
          <div className="error-card">
            <h2>{this.props.title ?? '页面出错了'}</h2>
            <p className="error-msg">{this.state.message || '发生未知错误'}</p>
            <button type="button" className="btn btn-primary" onClick={this.handleReset}>
              返回首页
            </button>
          </div>
        </div>
      );
    }
    return this.props.children ?? null;
  }
}

export default ErrorBoundary;
