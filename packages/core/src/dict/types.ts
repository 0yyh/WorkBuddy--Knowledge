/**
 * 离线词典查询层 —— 类型与校验（02 §8.1 同构原则：不依赖 DOM / node:*）。
 *
 * ⚠️ 数据源约定：本层**不内置词典数据**。唯一权威词典数据位于
 * `content/dict/dictionary.json`（随内容资源 / OTA / 局域网更新下发），
 * schema 见下方类型。packages/core 只提供类型 + 查询/加载辅助，供上层复用。
 *
 * 词条结构（与 content/dict 一致）：
 *   顶层 { version, built_at, count, source, description, entries }
 *   entries 以 word 为 key -> {
 *     word, pinyin, pos,
 *     defs: string[]        // 常规义（多义项，纯文本）
 *     specialized: [{ field, defs: string[] }]  // 专业义（field=学科）
 *     source
 *   }
 */
import { z } from 'zod';

// ============================================================
// 单条专业义（field = 学科名）
// ============================================================
export interface DictSpecialized {
  /** 学科名，如「政治学」「马克思主义」「哲学」 */
  field: string;
  /** 该学科下的释义（可为多条） */
  defs: string[];
}

// ============================================================
// 词条（content/dict schema）
// ============================================================
export interface DictEntry {
  /** 词头原文（= 其在 entries 对象中的 key） */
  word: string;
  /** 拼音 */
  pinyin?: string;
  /** 英文音标（英文词条用；本词表以中文为主） */
  ipa?: string;
  /** 词性，如 名/n./v. */
  pos?: string;
  /** 常规义（多义项，纯文本） */
  defs: string[];
  /** 专业义（学科 + 该学科释义）；可为空数组 */
  specialized: DictSpecialized[];
  /** 来源署名 */
  source?: string;
}

// ============================================================
// 整本词典
// ============================================================
export interface Dictionary {
  version?: string;
  built_at?: string;
  /** 词条数（可能滞后于实际，以 entries 长度为准） */
  count?: number;
  source?: string;
  description?: string;
  /** 以 word 为 key 的词条表 */
  entries: Record<string, DictEntry>;
}

/** 查询结果 */
export interface DictLookupResult {
  /** 命中词条；未命中为 null */
  entry: DictEntry | null;
  /** 命中时返回命中的词头；未命中为空串 */
  word: string;
}

// ============================================================
// 校验（zod）—— 从任意 JSON 解析并校验为 Dictionary
// ============================================================
const specializedSchema = z.object({
  field: z.string().min(1),
  defs: z.array(z.string().min(1)).min(1),
});

const entrySchema = z.object({
  word: z.string().min(1),
  pinyin: z.string().optional(),
  ipa: z.string().optional(),
  pos: z.string().optional(),
  defs: z.array(z.string().min(1)).min(1),
  specialized: z.array(specializedSchema).default([]),
  source: z.string().optional(),
});

const dictionarySchema = z.object({
  version: z.string().optional(),
  built_at: z.string().optional(),
  count: z.number().optional(),
  source: z.string().optional(),
  description: z.string().optional(),
  entries: z.record(z.string(), entrySchema),
});

/**
 * 校验并规范化一个字典对象（通常是解析后的 content/dict/dictionary.json）。
 * 返回 `{ value?, errors }`；不抛异常。保证 entries 的 key 与 entry.word 一致。
 */
export function parseDictionary(raw: unknown): {
  value?: Dictionary;
  errors: string[];
} {
  const r = dictionarySchema.safeParse(raw);
  if (!r.success) {
    return { errors: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  const data = r.data as Dictionary;
  const errors: string[] = [];
  const entries: Record<string, DictEntry> = {};
  for (const key of Object.keys(data.entries)) {
    const e = data.entries[key];
    if (e.word !== key) {
      errors.push(`entries["${key}"]: word 字段(${e.word})与 key 不一致`);
    }
    entries[e.word] = e;
  }
  return { value: { ...data, entries }, errors };
}
