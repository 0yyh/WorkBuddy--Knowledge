/**
 * Web 端单元测试配置（Phase 0 · E；P2-11 修复为「可实际运行」）。
 *
 * ⚠ 为什么不再 `import { defineConfig } from 'vitest/config'`：
 *   vitest 只装在 `packages/core`（apps/web 未声明该 devDep，而本仓禁止 npm install），
 *   从 apps/web 解析 'vitest/config' 会抛 ERR_MODULE_NOT_FOUND —— 配置文件**根本加载不了**，
 *   这正是「web 端零测试」长期没被发现的直接原因。
 *   导出**普通对象**即可：`defineConfig` 仅提供类型提示，运行期完全不需要。
 *
 * ⚠ 为什么 environment 是 'node' 而不是 'jsdom'：
 *   本仓未安装 jsdom（`node_modules/.pnpm` 下无 `jsdom@*`），声明 'jsdom' 会在启动时报错。
 *   现有 web 测试均为纯模块测试（外部依赖全部用 vi.mock / vi.stubGlobal 打桩），无需 DOM。
 *   将来若要补组件测试（需 @testing-library/react + jsdom），必须**受控**安装这两个包，
 *   届时再把 environment 改回 'jsdom'，并同步更新本注释与 docs/14 的 Top 8。
 *
 * - globals: true —— 测试可直接使用 describe / it / expect。
 * - include 仅覆盖 src 下的 *.test.ts(x)，与 tsconfig 的 exclude 对应，
 *   避免应用 tsc 类型检查被缺失的 vitest 类型打断。
 *
 * 运行方式（仓库根执行；npm run 脚本当前不可用，见 MEMORY 的绕过命令表）：
 *   node node_modules/.pnpm/vitest@2.1.9_@types+node@22.20.1/node_modules/vitest/vitest.mjs run --root apps/web
 */
export default {
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    // 补 node 环境缺失的 localStorage / sessionStorage（内存垫片，仅测试进程生效）
    setupFiles: ['./vitest.setup.ts'],
  },
};
