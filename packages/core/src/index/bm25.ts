/**
 * BM25 打分（02 §4）。标准 Okapi BM25。
 */
import { BM25_K1, BM25_B } from '../constants.js';

/**
 * 单个查询词对单篇文档的贡献分。
 * @param tf 词频
 * @param docLen 文档长度（字数）
 * @param avgLen 平均文档长度
 * @param df 含该词的文档数
 * @param totalDocs 总文档数
 */
export function bm25Term(
  tf: number,
  docLen: number,
  avgLen: number,
  df: number,
  totalDocs: number,
  k1 = BM25_K1,
  b = BM25_B,
): number {
  const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
  const denom = tf + k1 * (1 - b + b * (docLen / avgLen));
  return idf * ((tf * (k1 + 1)) / denom);
}
