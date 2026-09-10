import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Web 阅读端构建配置。
 * - base 使用相对路径 './'，便于放在子路径 / Capacitor assets 下直接打开。
 * - publicDir 默认的 public/ 存放 copy-content 落盘的 content/ 资源。
 * - @pks/core 主入口已真正同构（node:fs 只存在于 @pks/core/node 与 @pks/core/build），
 *   因此这里不再需要任何 node:* 别名或 shim。
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  publicDir: 'public',
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    assetsInlineLimit: 8192,
  },
  optimizeDeps: {
    exclude: ['@pks/core'],
  },
});
