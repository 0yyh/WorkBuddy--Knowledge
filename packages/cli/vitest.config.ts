import { defineConfig } from 'vitest/config';

/**
 * CLI 包测试配置（与 packages/core/vitest.config.ts 保持一致）。
 * 仅测试 Node 端生成管线，故 environment 固定为 node。
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
  },
});
