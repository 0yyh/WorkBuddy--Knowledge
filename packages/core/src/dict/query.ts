/**
 * 离线词典查询逻辑（同构：浏览器 / Node 通用，无副作用）。
 *
 * 职责：
 * - 词头规范化（去空白/标点/引号；英文转小写）—— 用于与选区文本匹配
 * - 在已解析的 Dictionary（entries 以 word 为 key）中精确 + 兜底命中
 * - 说明：本层不负责网络/文件加载；由调用方传入已 parse 的 Dictionary 对象。
 */
import type { DictEntry, DictLookupResult, Dictionary } from './types.js';

// ============================================================
// 规范化
// ============================================================

/** 规范化一个可查询串：去空白、全角转半角、去掉常见标点/引号、英文转小写 */
export function normalizeQuery(raw: string): string {
  let s = raw;
  s = s.replace(/[\u3000\u00a0]/g, ' ');
  s = s.trim();
  // 全角标点/字母 → 半角
  s = s.replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  s = s.replace(
    /[《》「」『』“”‘’""''（）()【】\[\]〈〉<>,，。．.、；;：:！!？?…—·\-_\s]+/g,
    '',
  );
  return s.toLowerCase();
}

/** 由词头生成规范 id（= normalizeQuery 的别名，语义化） */
export function entryId(word: string): string {
  return normalizeQuery(word);
}

// ============================================================
// 查询
// ============================================================

/**
 * 在字典中查找某个选区文本。
 * 说明：entries 的 key 即 word（原文）。当规范后的选区与某 word 一致即命中；
 * 若 word 含空格/英文，则额外用规范化后的表做一次匹配。
 * @param dict 已 parse 的字典（建议用 parseDictionary 校验过）
 * @param selectedText 用户选中的原文
 */
export function lookupDict(dict: Dictionary, selectedText: string): DictLookupResult {
  const entries = dict.entries;
  const q = normalizeQuery(selectedText);
  if (!q) return { entry: null, word: '' };

  // 1) 直接按 word 命中（中文词 key 即原文）
  const direct = ownEntry(entries, q);
  if (direct) return { entry: direct, word: q };

  // 2) 兜底：对含标点/装饰的选区去掉极端边界后再试
  const q2 = q.replace(/^['’“”]+|['’“”]+$/g, '');
  if (q2 !== q) {
    const direct2 = ownEntry(entries, q2);
    if (direct2) return { entry: direct2, word: q2 };
  }

  // 3) 对英文/含空格词：扫一遍做规范化 key 匹配（词表通常较小，线性可接受）
  const byKey = buildNormalizedKey(entries);
  const hit = byKey.get(q);
  if (hit) return { entry: hit, word: hit.word };

  return { entry: null, word: '' };
}

/**
 * 仅取词表「自有属性」的词条。
 * 直接 `entries[q]` 会误命中 Object.prototype 上的键（如 `__proto__` / `constructor` /
 * `toString`），用户在正文里选中这类字符串时会返回伪词条，故必须用自有属性判定。
 */
function ownEntry(entries: Record<string, DictEntry>, key: string): DictEntry | undefined {
  return Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : undefined;
}

/** 构建 规范化key -> entry 的查找表（供多次查询复用；词表小，线性构建一次） */
export function buildLookupTable(dict: Dictionary): Map<string, DictEntry> {
  return buildNormalizedKey(dict.entries);
}

function buildNormalizedKey(entries: Record<string, DictEntry>): Map<string, DictEntry> {
  const m = new Map<string, DictEntry>();
  for (const w of Object.keys(entries)) {
    m.set(w, entries[w]);
    const nk = normalizeQuery(w);
    if (nk !== w) m.set(nk, entries[w]);
  }
  return m;
}
