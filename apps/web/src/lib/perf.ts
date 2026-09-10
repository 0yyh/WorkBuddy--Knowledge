/**
 * 性能可观测性工具（Phase 0 · B）。
 *
 * 仅封装浏览器 Performance API 与全局错误监听；不引入任何外部服务 / 上报 SDK。
 * - perfMark / perfMeasure / perfNow 是对 performance.* 的安全包裹（环境缺失时降级）。
 * - installPerfGuard 注册 window 'error' 与 'unhandledrejection'，用 console.warn 记录，
 *   便于本地排查渲染期与未捕获 Promise 异常（前缀 [PKS perf]）。
 */

/**
 * 打一个命名时间点标记（对应 performance.mark）。
 * @param name 标记名（建议语义化，如 'home-mount'）
 */
export function perfMark(name: string): void {
  if (typeof performance === 'undefined') return;
  try {
    performance.mark(name);
  } catch {
    /* 部分受限环境 mark 抛错，忽略 */
  }
}

/**
 * 测量两个标记点之间的时长（对应 performance.measure）。
 * @param name 测量名
 * @param start 起点标记名
 * @param end 终点标记名
 */
export function perfMeasure(name: string, start: string, end: string): void {
  if (typeof performance === 'undefined') return;
  try {
    performance.measure(name, start, end);
  } catch {
    /* 标记点缺失时忽略 */
  }
}

/** 返回高精度当前时间（ms）。环境缺失时降级为 Date.now()。 */
export function perfNow(): number {
  if (typeof performance === 'undefined') return Date.now();
  return performance.now();
}

/** 幂等守卫：installPerfGuard 仅注册一次 */
let guardInstalled = false;

/**
 * 注册全局错误监听，用 console.warn('[PKS perf]', ...) 记录：
 *  - window 'error'（资源 / 脚本运行时错误）
 *  - 'unhandledrejection'（未捕获 Promise 异常）
 * 不阻断默认行为，仅做本地可观测。
 */
export function installPerfGuard(): void {
  if (guardInstalled) return;
  if (typeof window === 'undefined') return;
  guardInstalled = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    console.warn('[PKS perf]', 'window.error', event.message, event.filename, event.lineno);
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason: unknown = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    console.warn('[PKS perf]', 'unhandledrejection', message);
  });
}
