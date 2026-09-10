/**
 * 字数统计（CJK 逐字计 + 非 CJK 按空白分词）。
 * 用于章节 20000 字硬上限（B1/L012）与统计。
 */
const CJK_RE = /[㐀-䶿一-鿿豈-﫿぀-ゟ゠-ヿ]/g;

export function countWords(text: string): number {
  const cjk = (text.match(CJK_RE) || []).length;
  const nonCjk = text
    .replace(CJK_RE, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + nonCjk;
}
