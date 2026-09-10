/**
 * Worker 环境垫片（P0-III）—— 必须在引入 `@pks/core` **之前**求值。
 *
 * 背景（实测根因）：
 *  - `@pks/core` 主入口 `index.ts` 里 `export * from './parse/markdown.js'`，
 *    把整条 markdown 解析链（remark / rehype / micromark …）带进依赖图；
 *  - 其中某个依赖在**模块顶层**执行 `const Fi = document.createElement('i')`（HTML 实体解码的准备），
 *    这是一处无法被 Rollup tree-shake 的 module-level side effect（core 未声明 sideEffects:false）；
 *  - 于是该副作用被一并打进 worker chunk。**Worker 里没有 `document`** →
 *    模块求值即抛 `ReferenceError: document is not defined`，worker 启动失败、检索被迫降级主线程。
 *
 * 已落地的**根治**（bundle 层）：
 *  `packages/core/package.json` 已声明 `"sideEffects": false`（core 自身确为纯函数库，
 *  无 module-scope 副作用）。于是生产构建里 Rollup 可直接摇掉整条未被使用的 markdown 链 ——
 *  实测 worker chunk 222.35 kB → 8.45 kB（−96%），且 chunk 内 `document.createElement` 归零。
 *
 * 本垫片为何**仍然保留**（防御性，非死代码）：
 *  Vite **dev** 模式不做 tree-shaking（按需源码直出 ESM，`export *` 一律求值），
 *  其依赖预打包产物中仍含该 `createElement`。dev 下 worker 若启动失败会静默降级主线程，
 *  功能不回归但失去 worker 收益；保留垫片可让 dev 与生产行为一致，也防未来回归。
 *
 * 处理方式：在 worker 入口以**第一个 import** 引入本文件。ESM 规定依赖按 import 声明顺序求值：
 *  本模块先于 `@pks/core` 求值，从而在 `@pks/core` 的模块体运行前注入一个最小 `document` 垫片，
 *  仅用于吸收那一次 `createElement`（检索路径不会真正使用它）。
 */
interface ShimElement {
  innerHTML: string;
  textContent: string;
}

const g = globalThis as unknown as { document?: { createElement: (tag?: string) => ShimElement } };

if (typeof g.document === 'undefined') {
  g.document = {
    createElement: (): ShimElement => ({ innerHTML: '', textContent: '' }),
  };
}

export {};
