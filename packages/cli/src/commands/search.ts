/** search —— 在已构建索引上执行查询（演示 L1 标题索引 / L2 全文 BM25） */
import type { SearchEngine } from '@pks/core';
import { loadIndex } from '../load-index.js';

export async function searchCmd(contentDir: string, query: string, level: 'l1' | 'l2'): Promise<void> {
  let engine: SearchEngine | null;
  try {
    engine = loadIndex(contentDir);
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
  if (!engine) {
    console.error('✗ 未找到索引，请先运行 build:index');
    process.exit(1);
  }
  const hits = level === 'l1' ? engine.searchL1(query) : await engine.searchL2(query);
  console.log(`🔎 "${query}"（${level === 'l1' ? 'L1 标题索引' : 'L2 全文'}）→ ${hits.length} 命中`);
  for (const h of hits.slice(0, 20)) {
    console.log(`   ${h.score.toFixed(2).padStart(7)}  ${h.doc.title}  [${h.doc.kind}:${h.doc.slug}]` + (h.matchedTerms.length ? `  «${h.matchedTerms.join(',')}»` : ''));
  }
}
