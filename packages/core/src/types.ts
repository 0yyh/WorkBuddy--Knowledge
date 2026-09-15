/**
 * 全局类型定义（02 §8.1）。同构核心层，浏览器/Node 通用。
 * 凡涉及「仅类型」的导出，在 index.ts 中用 `export type` 重导出以满足 isolatedModules。
 */

// ============================================================
// 基础别名
// ============================================================
export type Slug = string;
/** 类目路径：中文，斜杠分隔，必须存在于 taxonomy.yaml（02 §9.1） */
export type CategoryPath = string;
export type IsoDate = string; // YYYY-MM-DD

export type EntryType = 'concept' | 'work' | 'person' | 'event' | 'term';
export type EntryStatus = 'published' | 'stub' | 'draft' | 'deprecated';
export type Confidence = 'high' | 'medium' | 'low' | 'auto';
export type License = string; // 'CC-BY-SA-4.0' | 'public-domain' | 'fair-use' | ...

// ============================================================
// 来源 / 溯源（04 §2.4）
// ============================================================
export interface SourceRef {
  title: string;
  url?: string;
  /** entry://<slug>/<sectionKey> 站内引用 */
  ref?: string;
  license?: License;
  edition?: string;
  fetched_at?: IsoDate;
  /** sha1:<hex> 内容指纹，用于去重/溯源（04 §2.4.5） */
  fingerprint?: string;
}

// ============================================================
// 词条（Entry）
// ============================================================
export interface EntryMeta {
  schema: number;
  slug: Slug;
  title: string;
  subtitle?: string;
  original_title?: string;
  aliases?: string[];
  type: EntryType;
  /** 1..n，每项必须存在于 taxonomy */
  categories: CategoryPath[];
  tags?: string[];
  /** 80–300 字 */
  summary: string;
  status: EntryStatus;
  confidence: Confidence;
  license: License | string;
  ai_generated: boolean;
  /** 含「📝 编者注」块时必须为 true（假设 C） */
  ai_annotated?: boolean;
  created_at: IsoDate;
  updated_at: IsoDate;
  /** 本地修订号，每次保存 +1，冲突检测基线（C2） */
  rev: number;
  /** 构建期回填 */
  words?: number;
  sources: SourceRef[];
  see_also?: Slug[];
  review_notes?: string;

  // work 专用
  author?: string;
  editor?: string;
  structure?: { levels: string[]; total_sections: number; total_words: number };
  source_edition?: { base: string; online?: string; license: string; note?: string };

  // person 专用
  birth?: string;
  death?: string;
  // event 专用
  date?: string;
  location?: string;

  // 顺序轴字段（01b §5）
  timeline?: ('world' | 'china')[]; // 历史双轨标记
  sort_date?: number; // 公元前为负
  order_mode?: OrderMode;
  level?: number; // difficulty 序列 1–5
  school?: string; // school_then_chronological 流派
  requires?: Slug[]; // dependency 前置
}

export interface Entry extends EntryMeta {
  dirPath: string;
  entryFile: string;
  sectionCount: number;
  hasSections: boolean;
  cover?: string;
}

/** 词条详情页（cover）元数据：由 buildIndex 从已有 front-matter 派生（.index/covers/{slug}.json） */
export interface EntryCover {
  slug: Slug;
  title: string;
  subtitle?: string;
  summary: string;
  /** 类目完整路径（中文，斜杠分隔，与 taxonomy.yaml 一致） */
  categories: CategoryPath[];
  tags: string[];
  original_title?: string;
  /** 词条总字数（统一口径：各 content 章节正文之和；无章节单页词条为词条正文字数） */
  word_count: number;
  sources: SourceRef[];
  updated_at: IsoDate;
  chapter_count: number;
  /** 相关词条 slug（构建期按索引内存在过滤） */
  related: Slug[];
}

// ============================================================
// 篇目 / 章节（Section）
// ============================================================
export type SectionKind = 'content' | 'container';

/** 章节级摘要：tldr ≤120 字；keyPoints 每条 ≤80 字、≤8 条（02 §18.12 B7） */
export interface SectionSummary {
  tldr: string;
  keyPoints?: string[];
}

export interface SectionMeta {
  slug: string; // "das-kapital/v1-p1-ch01"（全局唯一）
  work: Slug; // 所属词条 slug
  key: string; // "v1-p1-ch01"（= 文件名去扩展名）
  title: string;
  /** 数字数组，不用 "1.1.1" 字符串（C6） */
  order: number[];
  /** 构建期生成零填充键 "001.001.001" */
  orderKey?: string;
  path: string[];
  depth: 1 | 2 | 3;
  parent?: string;
  status: EntryStatus;
  license: License | string;
  ai_generated: boolean;
  ai_annotated?: boolean;
  /** 构建期回填，硬上限 20000（container 为子孙字数和） */
  words?: number;
  pages?: string;
  source_edition?: string;
  sources: SourceRef[];
  file: string;
  /** B1：汇编体 Section 树 —— container（卷）无正文 */
  kind?: SectionKind;
  /** B7：章节级摘要 */
  summary?: SectionSummary;
}

export interface SectionNode extends SectionMeta {
  index: number; // 同级序号（1-based）
  children: SectionNode[];
}

// ============================================================
// 正文块（运行期 AST 单元，不落盘、不进索引）
// ============================================================
export type BlockType =
  | 'heading' | 'paragraph' | 'quote' | 'list' | 'table'
  | 'code' | 'math' | 'hr' | 'footnote' | 'editor-note' | 'image';

export interface Block {
  id: string;
  type: BlockType;
  scope: string; // 词条 slug 或 sectionSlug
  order: number;
  anchor?: string;
  level?: number;
  text: string;
  html: string;
  meta?: {
    noteKind?: 'ai-editor' | 'warning' | 'source-conflict' | 'tip';
    lang?: string;
    caption?: string;
    links?: WikiLinkRef[];
  };
}

export interface WikiLinkRef {
  target: Slug;
  label?: string;
  section?: string;
  resolved: boolean;
}

// ============================================================
// 搜索
// ============================================================
export type SearchDocKind = 'entry' | 'section';

/** 倒排 doc（02 §8.1 / §3.4） */
export interface SearchDoc {
  id: string; // "e:surplus-value" | "s:das-kapital/v1-p1-ch01"
  kind: SearchDocKind;
  slug: string;
  title: string;
  anchor?: string;
  entrySlug?: string;
  entryTitle?: string;
  words: number;
  // 历史双轨（02 §18.11 B4）
  tl?: string[]; // timeline ['world']|['china']|['china','world']
  sd?: number; // sort_date（公元前负）
  ctl?: 0 | 1; // cross_timeline 标志
}

export interface SearchHit {
  doc: SearchDoc;
  score: number;
  excerpt?: string;
  matchedTerms: string[];
}

export interface SearchResultGroup {
  entry: { slug: string; title: string; type: EntryType };
  hits: SearchHit[];
  total: number;
}

// ============================================================
// 类目树（taxonomy.yaml 驱动）
// ============================================================
export interface TaxonomyNode {
  id: string; // 与 path 末段同；L1 用约定 id
  title: string;
  order: number;
  level: 1 | 2 | 3;
  path: CategoryPath; // 完整中文路径
  children?: TaxonomyNode[];
  /** 该节点（含子孙）下的词条 slug 列表（构建期回填，分片携带） */
  entrySlugs?: Slug[];
}

// ============================================================
// 学习序列（Track，01b §6）
// ============================================================
export type OrderMode = 'chronological' | 'difficulty' | 'dependency' | 'school_then_chronological';

export interface TrackItem {
  order: string; // "C01-01" / "1.1"
  entry: Slug;
  /** 时间线节点自定义显示名：无对应词条时用作标题，避免渲染 slug（未录入） */
  title?: string;
  sort_date?: number;
  date_label?: string;
  era?: string;
  note?: string;
  /** B4：双轨同时出现（取代旧 string 形式） */
  cross_timeline?: boolean;
  // 顺序轴辅助字段
  level?: number;
  school?: string;
  requires?: Slug[];
}

export interface Track {
  id: string;
  title: string;
  category: CategoryPath;
  order_mode: OrderMode;
  timeline?: 'world' | 'china';
  description?: string;
  era_labels?: Record<string, string>;
  items: TrackItem[];
}

// ============================================================
// 索引产物（02 §3.4）
// ============================================================
export interface IndexManifest {
  schema: number;
  generator: string;
  built_at: string;
  contentHash: string;
  contentRoot: string;
  stats: {
    categories: number;
    entries: number;
    sections: number;
    words: number;
    bytes: number;
    shards: number;
  };
  entryShards: string[];
  tocHeavy: string[];
  search: { shards: number; docs: number; terms: number; avgDocLen: number };
  bundleOf?: string;
}

/** entries 分片 item（短 key 压缩，02 §3.4） */
export interface EntryIndexItem {
  s: Slug;
  t: string;
  ty: EntryType;
  st: EntryStatus;
  /** 词条总字数（与 cover.word_count 同口径：各 content 章节之和，无章节时回退正文） */
  w: number;
  ua: IsoDate;
  rv: number;
  al: string[];
  c: string[]; // 类目 **id** 数组
  sc: number; // sectionCount
  sm: string; // summary 截断 120 字
  ag: 0 | 1;
  an: 0 | 1;
  toc?: TocNode[];
  // 历史双轨（02 §18.11 B4）
  tl?: string[]; // timeline 维度
  sd?: number; // sort_date
  ctl?: 0 | 1; // cross_timeline 标志
}

export interface TocNode {
  k: string; // section key
  t: string;
  o: number[];
  d: 1 | 2 | 3;
  w: number;
  st: EntryStatus;
  kd?: SectionKind; // B1
  c?: TocNode[];
}

/** L1 轻量索引 item（02 §18.2 升格为常驻秒开索引；title/alias 无 summary） */
export interface TitleIndexItem {
  slug: Slug;
  title: string;
  aliases: string[];
  type: EntryType;
  categoryIds: string[];
  docId: string;
  words: number;
}

/** 检索分片文件（M0 用 JSON；二进制 varint 为容量期优化，见 02 §3.4） */
export interface SearchShard {
  shard: number;
  docs: SearchDoc[]; // docId = index in this array
  /** term -> docId[] （postings） */
  index: Record<string, number[]>;
}

// ============================================================
// 用户数据（03 §8.1 / 02 §3.5）
// ============================================================
export interface ReadProgress {
  slug: Slug;
  sectionSlug?: string;
  blockId?: string;
  scrollPct: number;
  scrollY: number;
  totalWords: number;
  updatedAt: number;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'sepia';
  fontScale: 1 | 2 | 3 | 4 | 5;
  lineHeight: 1 | 2 | 3;
  fontFamily: 'sans' | 'serif';
  pageWidth: 'narrow' | 'medium' | 'wide';
  continuousReading: boolean;
}

export interface UserData {
  schema: 1;
  settings: UserSettings;
  favorites: Slug[];
  recent: Array<{ slug: Slug; sectionSlug?: string; at: number }>;
  progress: Record<Slug, ReadProgress>;
  bookmarks?: Array<{ id: string; slug: Slug; sectionSlug?: string; blockId: string; text: string; at: number }>;
}

// ============================================================
// 导入 / 导出 / 包（01 §8 / 02 §18.13）
// ============================================================
export type PackLevel = 'seed' | 'digest' | 'full';
export type ImportAction =
  | 'add' | 'update' | 'keep' | 'conflict' | 'conflict-source' | 'skip';

export interface PackManifest {
  format: 'pks-bundle';
  version: number;
  generator: string;
  created_at: string;
  pack: { level: PackLevel; category?: string; works?: string[] };
  scope: { type: 'all' | 'category' | 'selection'; value?: string };
  stats: { entries: number; sections: number; words: number; bytes: number };
  checksum: string;
  base_snapshot: Record<Slug, { u: IsoDate; r: number }>;
  index_shards: number[];
  includes_userdata: boolean;
}

export interface ImportPlanItem {
  slug: Slug;
  action: ImportAction;
  title: string;
  localRev?: number;
  incomingRev?: number;
  bytes: number;
  conflictAs?: string;
}

export interface ImportPlan {
  bundleId: string;
  items: ImportPlanItem[];
  summary: { add: number; update: number; keep: number; conflict: number; skip: number; bytes: number };
  strategy: 'keep-both' | 'overwrite' | 'skip-conflicts';
}

// ============================================================
// 标注问题回传（04 §2.6）
// ============================================================
export type FeedbackType = 'fact-error' | 'source-doubt' | 'typo' | 'broken-link' | 'other';
export type FeedbackSeverity = 'low' | 'medium' | 'high';

export interface FeedbackRecord {
  slug: Slug;
  sectionId?: string;
  selectedText?: string;
  type: FeedbackType;
  severity: FeedbackSeverity;
  comment?: string;
  created_at: string; // ISO8601
}

export interface FeedbackFile {
  schema: 1;
  items: FeedbackRecord[];
}

// ============================================================
// 修正层 overlay（04 §2.2）—— 永远优先于基础层
// ============================================================
export interface OverlayCorrection {
  slug: Slug;
  sectionKey?: string;
  /** 修正后的字段值（部分覆盖正文/summary/title 等） */
  patch: Record<string, unknown>;
  updated_at: IsoDate;
  rev: number;
}
