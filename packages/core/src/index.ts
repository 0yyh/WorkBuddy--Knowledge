/**
 * @pks/core 主入口（同构，不依赖 node:* / DOM 之外的浏览器 API）。
 * Node-only 能力（NodeFsVfs / buildIndex 落盘）通过子路径引入：
 *   import { NodeFsVfs } from '@pks/core/node';
 *   import { buildIndex } from '@pks/core/build';
 */
export * from './constants.js';
export * from './types.js';

// 通用工具
export * from './util/version.js';

// 解析层
export * from './parse/frontmatter.js';
export * from './parse/markdown.js';
export * from './parse/wikilink.js';
export * from './parse/slugify.js';
export * from './parse/words.js';

// VFS（不含 node:fs 实现）
export * from './vfs/index.js';

// 索引 / 搜索
export * from './index/tokenizer.js';
export * from './index/bm25.js';
export * from './index/shards.js';
export * from './index/inverted.js';
export * from './index/lazy-loader.js';

// 合并 / 打包 / 冲突
export * from './merge/conflict.js';
export * from './merge/bundle.js';

// Track
export * from './track/parse.js';

// 内容仓储
export * from './content/repository.js';

// 词典类型（仅供类型引用；数据与查询逻辑走 @pks/core/dict 子路径）
export type {
  DictEntry, DictSpecialized, Dictionary, DictLookupResult,
} from './dict/types.js';
