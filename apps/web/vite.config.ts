import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

/**
 * P0-perf：把 tokens.css 在编译期直接 inject 到 index.html <head>，
 * 首屏不再多一次 CSS HTTP 请求（省一个 RTT）。styles.css 已不再 @import tokens.css，
 * 否则产出会重复包含 tokens 内容。
 */
function inlineTokensPlugin(): Plugin {
  const tokensPath = resolve(__dirname, 'src/styles/tokens.css');
  return {
    name: 'pks-inline-tokens',
    transformIndexHtml() {
      // dev/build 都生效。dev 时 index.html 由 vite dev server 渲染，tokens 仍写入 <head>。
      const css = readFileSync(tokensPath, 'utf8');
      return [
        {
          tag: 'style',
          attrs: { 'data-pks-tokens': 'inline' },
          children: css,
          injectTo: 'head',
        },
      ];
    },
  };
}

/**
 * Web 阅读端构建配置。
 * - base 使用相对路径 './'，便于放在子路径 / Capacitor assets 下直接打开。
 * - publicDir 默认的 public/ 存放 copy-content 落盘的 content/ 资源。
 * - @pks/core 主入口已真正同构（node:fs 只存在于 @pks/core/node 与 @pks/core/build），
 *   因此这里不再需要任何 node:* 别名或 shim。
 */
export default defineConfig({
  base: './',
  plugins: [react(), inlineTokensPlugin()],
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
    // P0-perf：路由级 React.lazy 已把页面拆开，但主 bundle (index-*.js) 仍承载
    // 全部 React/rehype/markdown 解析链。把 @pks/core + 重型 markdown 渲染拆出独立 chunk，
    // 既能跨页面缓存（多数页面都用 core），也让首页首屏不下载 reader 专属代码。
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // ① 第三方大块（core + markdown 渲染链）单独 chunk
          if (id.includes('@pks/core') || id.includes('node_modules')) {
            // markdown/rehype 这条重链独立，进一步降首页下载量
            if (
              id.includes('react-markdown') ||
              id.includes('remark') ||
              id.includes('rehype') ||
              id.includes('mdast') ||
              id.includes('unified') ||
              id.includes('micromark')
            ) {
              return 'vendor-markdown';
            }
            return 'vendor-core';
          }
          // ② 阅读页专属（HeadingView、renderMarkdown、shards decode 等）独立 chunk，
          // 让首页不下载阅读页才用到的代码。
          if (id.includes('src/pages/EntryReaderPage')) {
            return 'reader';
          }
          // ③ 应用壳与工具（路由、状态、辅助库）共享 index chunk
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@pks/core'],
  },
});
