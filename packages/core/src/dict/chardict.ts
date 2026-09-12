/**
 * 汉字词典（character）解析与构建层。
 *
 * 数据源：content/dict/chinese-dictionary/character/
 *   - char_base.json   JSONL  {index,char,strokes,pinyin[],radicals,frequency,structure}
 *   - char_detail.json JSONL  {char,pronunciations:[{pinyin,explanations:[{content,detail:[{text,book}]}]}]}
 *   - polyphone.json   标准 JSON 数组 [{index,char,strokes,pinyin[],frequency}]
 *   - related.json     标准 JSON 数组 [{char,synonyms[],antonyms[],index}]
 *
 * 注意：char_base / char_detail 为 JSONL（每行一个对象），不可整体 JSON.parse。
 *
 * 同构（不依赖 DOM / node:*），CLI 构建期与 web 运行期共用：
 *   - CLI `build:chardict`：parse* + buildCharIndex 合并为单个 index.json；
 *   - web 运行期：fetch 已合并的 index.json，用 parseCharIndex 读成 Map。
 */
import { z } from 'zod';

// ============================================================
// 输入/输出类型
// ============================================================

export interface CharBase {
  index: number;
  char: string;
  strokes?: number;
  pinyin: string[];
  radicals?: string;
  frequency?: number;
  structure?: string;
}

export interface CharDetail {
  char: string;
  pronunciations: {
    pinyin: string;
    explanations: {
      content?: string;
      detail?: { text?: string; book?: string }[];
    }[];
  }[];
}

export interface Polyphone {
  index: number;
  char: string;
  strokes?: number;
  pinyin: string[];
  frequency?: number;
}

export interface Related {
  char: string;
  synonyms?: string[];
  antonyms?: string[];
  index?: number;
}

/** 合并后的单字信息（同时也是 index.json 中 chars 的值 schema） */
export interface CharInfo {
  char: string;
  pinyin: string[];
  strokes?: number;
  radicals?: string;
  structure?: string;
  frequency?: number;
  explanations: string[];
  synonyms: string[];
  antonyms: string[];
}

// ============================================================
// 通用解析辅助
// ============================================================

export interface ParseResult<T> {
  value: T[];
  errors: string[];
}

/** 把「每行一个 JSON 对象」的文本解析为对象数组（JSONL）。空行忽略，坏行计入 errors。 */
export function parseJsonl<T>(text: string): ParseResult<T> {
  const value: T[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // 源文件每行对象后带一个多余逗号（形如 `{...},\n{...}`），解析前去尾逗号
    const trimmed = line.endsWith(',') ? line.slice(0, -1) : line;
    try {
      value.push(JSON.parse(trimmed) as T);
    } catch (e) {
      errors.push(`line ${i + 1}: ${(e as Error).message}`);
    }
  }
  return { value, errors };
}

export function parseCharBase(text: string): ParseResult<CharBase> {
  return parseJsonl<CharBase>(text);
}

export function parseCharDetail(text: string): ParseResult<CharDetail> {
  return parseJsonl<CharDetail>(text);
}

function pickStrArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function parsePolyphone(raw: unknown): ParseResult<Polyphone> {
  const errors: string[] = [];
  const value: Polyphone[] = [];
  if (!Array.isArray(raw)) return { value, errors: ['polyphone.json 不是数组'] };
  for (let i = 0; i < raw.length; i++) {
    const o = raw[i] as Record<string, unknown>;
    if (!o || typeof o !== 'object' || typeof o.char !== 'string') {
      errors.push(`#${i}: 缺 char`);
      continue;
    }
    value.push({
      index: typeof o.index === 'number' ? o.index : i,
      char: o.char,
      strokes: typeof o.strokes === 'number' ? o.strokes : undefined,
      pinyin: pickStrArr(o.pinyin),
      frequency: typeof o.frequency === 'number' ? o.frequency : undefined,
    });
  }
  return { value, errors };
}

export function parseRelated(raw: unknown): ParseResult<Related> {
  const errors: string[] = [];
  const value: Related[] = [];
  if (!Array.isArray(raw)) return { value, errors: ['related.json 不是数组'] };
  for (let i = 0; i < raw.length; i++) {
    const o = raw[i] as Record<string, unknown>;
    if (!o || typeof o !== 'object' || typeof o.char !== 'string') {
      errors.push(`#${i}: 缺 char`);
      continue;
    }
    value.push({
      char: o.char,
      synonyms: pickStrArr(o.synonyms),
      antonyms: pickStrArr(o.antonyms),
      index: typeof o.index === 'number' ? o.index : undefined,
    });
  }
  return { value, errors };
}

// ============================================================
// 合并为单字索引
// ============================================================

export interface BuildCharIndexResult {
  chars: Record<string, CharInfo>;
  errors: string[];
}

/**
 * 把四份源数据按 `char` 合并为 `char -> CharInfo`。
 * 优先级：base（笔画/部首/结构/基础拼音） → polyphone（补多音） → detail（释义，缺拼音时补拼音） → related（近/反义）。
 */
export function buildCharIndex(
  base: CharBase[],
  detail: CharDetail[],
  poly: Polyphone[],
  related: Related[],
): BuildCharIndexResult {
  const errors: string[] = [];
  const map = new Map<string, CharInfo>();

  for (const b of base) {
    if (!b.char) {
      errors.push('char_base: 缺 char');
      continue;
    }
    map.set(b.char, {
      char: b.char,
      pinyin: Array.isArray(b.pinyin) ? b.pinyin : [],
      strokes: typeof b.strokes === 'number' ? b.strokes : undefined,
      radicals: b.radicals,
      structure: b.structure,
      frequency: typeof b.frequency === 'number' ? b.frequency : undefined,
      explanations: [],
      synonyms: [],
      antonyms: [],
    });
  }

  for (const p of poly) {
    if (!p.char) continue;
    let info = map.get(p.char);
    if (!info) {
      info = { char: p.char, pinyin: [], explanations: [], synonyms: [], antonyms: [] };
      map.set(p.char, info);
    }
    const set = new Set(info.pinyin);
    for (const py of p.pinyin) set.add(py);
    info.pinyin = [...set];
  }

  for (const d of detail) {
    if (!d.char) continue;
    const info = map.get(d.char);
    if (!info) {
      errors.push(`char_detail: 无 base 记录 ${d.char}`);
      continue;
    }
    const expl: string[] = [];
    const pronSet = new Set<string>();
    for (const pron of d.pronunciations ?? []) {
      if (pron?.pinyin) pronSet.add(pron.pinyin);
      for (const ex of pron?.explanations ?? []) {
        const c = ex?.content;
        if (c && typeof c === 'string') expl.push(c);
      }
    }
    info.explanations = expl;
    if (info.pinyin.length === 0 && pronSet.size > 0) info.pinyin = [...pronSet];
  }

  for (const r of related) {
    if (!r.char) continue;
    const info = map.get(r.char);
    if (!info) {
      errors.push(`related: 无 base 记录 ${r.char}`);
      continue;
    }
    info.synonyms = r.synonyms ?? [];
    info.antonyms = r.antonyms ?? [];
  }

  const chars: Record<string, CharInfo> = {};
  for (const [k, v] of map) chars[k] = v;
  return { chars, errors };
}

// ============================================================
// 运行期：解析构建产物 index.json 为 Map
// ============================================================

const charInfoSchema = z.object({
  char: z.string(),
  pinyin: z.array(z.string()).default([]),
  strokes: z.number().optional(),
  radicals: z.string().optional(),
  structure: z.string().optional(),
  frequency: z.number().optional(),
  explanations: z.array(z.string()).default([]),
  synonyms: z.array(z.string()).default([]),
  antonyms: z.array(z.string()).default([]),
});

export const charIndexFileSchema = z.object({
  version: z.string().optional(),
  built_at: z.string().optional(),
  source: z.string().optional(),
  count: z.number().optional(),
  chars: z.record(z.string(), charInfoSchema),
});

export interface ParseCharIndexResult {
  value?: Map<string, CharInfo>;
  errors: string[];
}

/** 校验并解析合并后的 index.json 为 Map<char, CharInfo>。不抛异常。 */
export function parseCharIndex(raw: unknown): ParseCharIndexResult {
  const r = charIndexFileSchema.safeParse(raw);
  if (!r.success) {
    return { errors: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  const map = new Map<string, CharInfo>();
  for (const k of Object.keys(r.data.chars)) map.set(k, r.data.chars[k]);
  return { value: map, errors: [] };
}
