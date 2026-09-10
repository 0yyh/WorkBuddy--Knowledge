/**
 * 中文全文检索分词器（02 §4 / 04 §2.5）。
 * CJK 段 → 相邻 bigram；西文/数字 → 整词（小写）。查询与索引共用，保证 token 空间一致。
 * 纯 TS，可插拔（03 §16 决策 #3：默认 bigram，M1 实测后可换词典分词）。
 */

const TOKEN_RE = /[㐀-䶿一-鿿豈-﫿぀-ゟ゠-ヿ]+|[A-Za-z0-9]+/g;

export function tokenize(text: string): string[] {
  if (!text) return [];
  const tokens: string[] = [];
  let m: RegExpExecArray | null = TOKEN_RE.exec(text);
  while (m !== null) {
    const seg = m[0];
    if (/[A-Za-z0-9]/.test(seg[0])) {
      tokens.push(seg.toLowerCase());
    } else {
      // CJK 段：相邻 bigram；单字特例
      if (seg.length === 1) tokens.push(seg);
      else for (let i = 0; i < seg.length - 1; i++) tokens.push(seg.slice(i, i + 2));
    }
    m = TOKEN_RE.exec(text);
  }
  return tokens;
}

/** 统计词频（与 tokenize 同空间） */
export function termFrequencies(text: string): Map<string, number> {
  const tfs = new Map<string, number>();
  for (const t of tokenize(text)) tfs.set(t, (tfs.get(t) ?? 0) + 1);
  return tfs;
}
