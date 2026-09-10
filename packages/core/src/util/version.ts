/**
 * 语义化版本号工具（同构，无平台依赖）。
 *
 * 从原阅读端 `apps/web/src/lib/update.ts`（孤儿模块，已删除）上移而来，
 * 便于被 Web / CLI / 未来的内容更新逻辑共用。
 *
 * 支持的比较口径：
 *  - 允许可选的 `v` / `V` 前缀（`v1.2.3` 与 `1.2.3` 等价）；
 *  - 逐段按数值比较，段数不等时缺失段按 0 补齐（`1.2` == `1.2.0`）；
 *  - 非法段（非数字）按 0 处理，不抛错 —— 保证在脏数据下也不会中断调用方。
 */

/**
 * 比较两个语义化版本号。
 * @returns a > b → 1；a < b → -1；相等 → 0
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((s) => Number.parseInt(s, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((s) => Number.parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

/** 版本号是否「严格更新」：a 的版本号大于 b 时为真 */
export function isNewerVersion(a: string, b: string): boolean {
  return compareVersions(a, b) > 0;
}
