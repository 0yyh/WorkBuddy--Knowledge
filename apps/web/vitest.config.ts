import { defineConfig } from 'vitest/config';

/**
 * Web 端单元测试配置（Phase 0 · E）。
 * - 纯 jsdom 环境（贴近浏览器运行时），但本期仅承载「纯函数单测」；
 *   组件测试需 @testing-library/react，本期未安装，故暂缓。
 * - globals: true —— 测试可直接使用 describe / it / expect（需 vitest 已安装）。
 * - include 仅覆盖 src 下的 *.test.ts(x)，与 tsconfig 的 exclude 对应，
 *   避免应用 tsc 类型检查被缺失的 vitest 类型打断。
 *
 * 重要：依赖未安装前无法运行。落地后需「受控」补充 devDeps
 * （vitest + jsdom + 可选 @testing-library/react）并重建 web 的
 * @pks/core 符号链接（junction），详见交付报告。
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
