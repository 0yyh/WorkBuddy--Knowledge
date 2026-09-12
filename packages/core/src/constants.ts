/**
 * 全局常量。容量/索引相关的「一处切换」常量集中在此，
 * 2000 万字档将 SHARD_COUNT 由 16 翻到 256（见 02 §18.2）。
 */

/** front-matter schema 版本，用于 migrate */
export const SCHEMA_VERSION = 1 as const;

/**
 * 检索倒排分区数 M（02 §18.2）。
 * 16（≤300 万字）→ 64（≥300 万）→ 256（≥1000 万）。
 * M0 内容约 20 词条，取 16；2000 万字档改 256 为「一处切换」。
 * 必须为 2 的幂，因分片用 `fnv1a(slug) & (M-1)`。
 */
export const SHARD_COUNT = 16 as const;

/**
 * 全局文档频率(df) 分桶数（① df 分片化，解决运行期单表 48MB 卡顿）。
 * term 按 `fnv1a(term) & (DF_BUCKET_COUNT - 1)` 散列；固定 64、与检索分片数 M 解耦，
 * M 跳变只动 `sNN`、不影响 df 桶。每个桶约 48MB/64 ≈ 750KB，Worker 按需懒加载。
 * 必须为 2 的幂，且 builder 与消费端（worker/CLI/loader）共用同一常量，避免 manifest 耦合。
 */
export const DF_BUCKET_COUNT = 64 as const;

/** entries 元数据分片：按 slug 首字母 26 片（02 §3.4 轴 B） */
export const ENTRY_SHARD_ALPHA = 26 as const;

/** BM25 参数 */
export const BM25_K1 = 1.2;
export const BM25_B = 0.75;

/** 单章正文硬上限（字符/字），container 不计入（02 §18.9 B1） */
export const SECTION_WORD_LIMIT = 20000;

/** 章节级摘要 tldr 上限（02 §18.12 B7） */
export const TLDR_MAX = 120;
/** keyPoints 单条上限；最多 8 条 */
export const KEYPOINT_MAX = 80;
export const KEYPOINT_MAX_COUNT = 8;

/** 著作级 summary 区间（02 §8.1 EntryMeta.summary 80–300 字） */
export const SUMMARY_MIN = 80;
export const SUMMARY_MAX = 300;

/** 标注问题回传文件名（04 §2.6） */
export const FEEDBACK_FILE = 'feedback.json';

export const BUNDLE_FORMAT = 'pks-bundle' as const;
export const BUNDLE_VERSION = 1 as const;
export const GENERATOR = 'pks/0.1.0' as const;

/** 词条目录/章节文件命名正则（02 §9.1 / §9.2） */
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SECTION_KEY_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** 类目路径分隔 */
export const CATEGORY_SEP = '/';
