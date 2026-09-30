/**
 * @pks/core 主入口（同构，不依赖 node:* / DOM 之外的浏览器 API）。
 * Node-only 能力（NodeFsVfs / buildIndex 落盘）通过子路径引入：
 *   import { NodeFsVfs } from '@pks/core/node';
 *   import { buildIndex } from '@pks/core/build';
 */
import yaml from 'js-yaml';

export * from './constants.js';
export * from './types.js';

// 通用工具
export * from './util/version.js';
export * from './util/lru.js';
// 纯 TS SHA-1（不依赖 node:crypto / crypto.subtle），供同构端做完整性校验
export * from './util/sha1.js';

// 解析层
export * from './parse/frontmatter.js';
export * from './parse/markdown.js';
export * from './parse/wikilink.js';
export * from './parse/slugify.js';
export * from './parse/words.js';

// VFS（不含 node:fs 实现）
export * from './vfs/index.js';

// 内容仓储
export * from './content/repository.js';
export * from './content/hash.js';

// 通用 JSON ↔ base64(zlib) 编解码（同构，复用 fflate 文本载体）
export * from './util/compress.js';

// 合并 / 打包 / 冲突
export * from './merge/conflict.js';
export * from './merge/bundle.js';

// Track
export * from './track/parse.js';

// ============================================================
// 检索相关（SearchEngine / df / bm25 / tokenizer / shard-codec 等）
// 已迁出主 barrel 到 `@pks/core/search` 子路径——搜索调用方一律从
// `@pks/core/search` 引入，避免 vite 把整条检索链打进 vendor-core /
// 误拉进 worker chunk。
// 旧 import 兼容：以下 8 行再 export 保留到 2026-12；之后会删除。
// （web 端本次已迁移；core 测试全用相对路径，无影响；CLI 不依赖）
// ============================================================
export {
  SearchEngine,
  SHARD_CACHE_CAPACITY,
  buildShards,
  decodePostings,
  inlineIndexToMap,
  encodePostings,
  tokenize,
  termFrequencies,
  bm25Term,
  dfBucketOf,
  buildDfBuckets,
  decodeDfBucket,
  buildFuzzyIndex,
  expandQueryFuzzy,
  editDistance,
  chooseShardCount,
  assignShard,
  LRUCache,
  DF_BUCKET_COUNT,
} from './search.js';
export type {
  ShardIndex,
  IndexingDoc,
  GlobalSearchStats,
  PostingsTable,
  DfBucket,
} from './search.js';

// 词典类型（仅供类型引用；数据与查询逻辑走 @pks/core/dict 子路径）
export type {
  DictEntry, DictSpecialized, Dictionary, DictLookupResult,
} from './dict/types.js';

// ============================================================
// 生成管线（T03）复用导出
// 仅新增 barrel 导出，不引入任何新依赖（js-yaml 已在 core 依赖中）。
// 说明：生成器本身位于 @pks/cli（非 core，避免污染 web 包 worker 体积），
// core 只暴露下列纯函数供 CLI 复用。
// ============================================================
// 显式重导出 frontmatter 校验函数（主 barrel 已通过 export * 包含，这里显式列出以便生成管线稳定引用）
export { validateEntryMeta, validateSectionMeta } from './parse/frontmatter.js';

/** 解析 YAML 文本（同 js-yaml.load），供 work-order / 配置解析复用 */
export function yamlLoad(text: string): unknown {
  return yaml.load(text);
}

/** 序列化对象为 YAML 文本（禁用换行折叠、关闭引用锚点），供解析 LLM 输出为 frontmatter 复用 */
export function yamlDump(data: unknown): string {
  return yaml.dump(data, { lineWidth: -1, noRefs: true, sortKeys: false });
}
