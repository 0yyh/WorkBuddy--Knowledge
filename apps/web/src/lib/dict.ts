/**
 * 离线词典装载层（阅读页划词查询用）。
 *
 * 数据源 = 随内容下发的 content/dict/dictionary.json（已由 copy-content 从 content/dict 搬运）。
 * 结构解析与查询逻辑复用 @pks/core/dict（packages/core/src/dict）。
 *
 * 惰性 + 幂等：词典较大（~70KB）不进首屏，首次查询才 fetch 并缓存；失败不阻断阅读。
 */
import { parseDictionary, lookupDict, normalizeQuery } from '@pks/core/dict';
import type { DictEntry, Dictionary } from '@pks/core/dict';

let dictCache: Dictionary | null = null;
let dictInflight: Promise<Dictionary | null> | null = null;

/**
 * 词典 JSON 的确定 URL。
 *
 * 不走 loader.assetUrl 的纯相对路径（base 为 './' 时会拼出 './content/...'，
 * 由浏览器按「当前文档 URL」解析，一旦路由/落盘位置与 base 不匹配就 404）。
 * 这里以 import.meta.env.BASE_URL 为准，并显式用 document.baseURI（index.html 自身
 * 的位置，不随 hash 路由漂移）解析成绝对 URL，保证任何路由下都指向同一份词典。
 */
function dictUrl(): string {
  const base: string =
    (import.meta.env && import.meta.env.BASE_URL ? import.meta.env.BASE_URL : '/') || '/';
  const prefix = base.endsWith('/') ? base.slice(0, -1) : base;
  const baseUri = typeof document !== 'undefined' && document.baseURI ? document.baseURI : base;
  return new URL(`${prefix}/content/dict/dictionary.json`, baseUri).href;
}

/** 惰性装载整本词典（缓存 + 单飞幂等）；失败返回 null（不抛，阅读不受影响） */
export function loadDictionary(): Promise<Dictionary | null> {
  if (dictCache) return Promise.resolve(dictCache);
  if (dictInflight) return dictInflight;

  const url = dictUrl();
  dictInflight = fetch(url, { cache: 'no-cache' })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<unknown>;
    })
    .then((raw) => {
      const v = parseDictionary(raw);
      dictCache = v.errors.length ? null : (v.value ?? null);
      return dictCache;
    })
    .catch(() => null)
    .finally(() => {
      dictInflight = null;
    });
  return dictInflight;
}

/**
 * 划词查询：规范化 + 命中一个词条。
 * @param selectedText 用户在正文选中的原始文本（含标点/空白/书名号等均可）
 * @returns 命中的词条，或 null（未命中 / 词典加载失败）
 */
export async function lookupWord(selectedText: string): Promise<DictEntry | null> {
  const text = (selectedText ?? '').trim();
  if (!text) return null;

  const dict = dictCache ?? (await loadDictionary());
  if (!dict) return null;

  // 1) 精确 / 规范化命中（@pks/core 已处理去标点、全半角、英文小写等）
  const exact = lookupDict(dict, text).entry;
  if (exact) return exact;

  // 2) 兜底：选区较长或含修饰时，做「最长子串/包含」匹配，让划词更可能命中词典。
  //    例如选中「资本主义生产方式」→ 命中「资本主义」；
  //        选中「关于国家的话题」→ 命中「国家」；
  //        选中「马克思主义基本原理」→ 命中「马克思主义」。
  //    取词长最长者（更具体）优先，避免短词抢匹配。
  const q = normalizeQuery(text);
  if (q.length >= 2 && dict.entries) {
    let best: DictEntry | null = null;
    let bestLen = 0;
    for (const w of Object.keys(dict.entries)) {
      const nw = normalizeQuery(w);
      if (!nw) continue;
      if ((q.includes(nw) || nw.includes(q)) && nw.length > bestLen) {
        best = dict.entries[w];
        bestLen = nw.length;
      }
    }
    if (best) return best;
  }
  return null;
}

/** 词典是否已就绪（已装载 / 装载中） */
export function dictReady(): boolean {
  return dictCache !== null || dictInflight !== null;
}

/** 重置缓存（供内容更新后清空用） */
export function resetDictCache(): void {
  dictCache = null;
  dictInflight = null;
}
