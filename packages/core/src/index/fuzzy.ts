/**
 * T5 检索增强（#425）—— 编辑距离模糊召回（查询容错）。
 *
 * 设计原则：**不动 SearchEngine 热路径**。模糊是「查询扩展」而非「检索算法改造」：
 *  - 精确检索零命中时，才用编辑距离把查询词扩展到近词，再跑一次精确检索；
 *  - 近词与原文词共享 BM25 打分（首版不做 penalize，召回优先；长尾命中自然靠 tf/idf 排序）。
 *  - 词表（vocab）由调用方从 df 桶一次性构建并缓存（见 web loader 的 loadDfVocab），
 *    本模块只提供纯函数，便于单测、不依赖网络。
 */
import { tokenize } from './tokenizer.js';

/** Levenshtein 编辑距离（按字符，兼容中文）。用于查询词容错。 */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = cur;
    cur = tmp;
  }
  return prev[n];
}

/**
 * 首字 → 词表 索引，供模糊候选在 O(同首字词数) 内检索，避免全词表扫描。
 * 中文近词（形近/繁简/笔误）几乎都共享首字，故按首字分桶即可覆盖绝大多数 dist≤2 情形。
 */
export function buildFuzzyIndex(vocab: Iterable<string>): Map<string, string[]> {
  const idx = new Map<string, string[]>();
  for (const term of vocab) {
    if (!term) continue;
    const key = term[0];
    const list = idx.get(key);
    if (list) list.push(term);
    else idx.set(key, [term]);
  }
  return idx;
}

/**
 * 把查询扩展为「原词 + 编辑距离 ≤ maxDist 的近词」集合（去重）。
 * 仅当某词在词表中有近词时才扩展；精确词始终保留。
 *
 * @param index 由 buildFuzzyIndex 产出的首字索引
 * @param maxDist 最大编辑距离（默认 1；中文笔误/繁简多为 1）
 * @param capPerTerm 每词近词上限（默认 12，防止极端词爆量）
 */
export function expandQueryFuzzy(
  query: string,
  index: Map<string, string[]>,
  maxDist = 1,
  capPerTerm = 12,
): string[] {
  const tokens = tokenize(query);
  const out = new Set<string>(tokens);
  for (const t of tokens) {
    const list = index.get(t[0] ?? '') ?? [];
    const cands: Array<{ term: string; d: number }> = [];
    for (const v of list) {
      if (Math.abs(v.length - t.length) > maxDist) continue;
      const d = editDistance(t, v);
      if (d > 0 && d <= maxDist) cands.push({ term: v, d });
    }
    cands.sort((a, b) => a.d - b.d);
    for (const c of cands.slice(0, capPerTerm)) out.add(c.term);
  }
  return [...out];
}
