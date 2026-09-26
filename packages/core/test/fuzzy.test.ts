/**
 * T5 检索增强（#425）单测：编辑距离模糊召回的纯函数 + 端到端召回。
 * 验证：editDistance 正确性、buildFuzzyIndex 首字分桶、expandQueryFuzzy 扩展逻辑，
 * 以及「扩展后的查询喂给 searchL2 能召回原精确零命中的近词文档」（loader.fullTextSearch 的兜底核心）。
 */
import { describe, it, expect } from 'vitest';
import { editDistance, buildFuzzyIndex, expandQueryFuzzy } from '../src/index/fuzzy.js';
import { SearchEngine, buildShards } from '../src/index/inverted.js';
import type { TitleIndexItem } from '../src/types.js';

describe('editDistance', () => {
  it('空串边界', () => {
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('abc', '')).toBe(3);
    expect(editDistance('', '')).toBe(0);
  });
  it('单字符替换/插入/删除', () => {
    expect(editDistance('bat', 'cat')).toBe(1);
    expect(editDistance('cat', 'cats')).toBe(1);
    expect(editDistance('cats', 'cat')).toBe(1);
  });
  it('中文繁简形近 = 1（哲學 vs 哲学）', () => {
    expect(editDistance('哲學', '哲学')).toBe(1);
  });
  it('经典用例 kitten/sitting = 3', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('buildFuzzyIndex', () => {
  it('按首字分桶', () => {
    const idx = buildFuzzyIndex(['哲学', '学术', '理性']);
    expect(idx.get('哲')).toContain('哲学');
    expect(idx.get('学')).toContain('学术');
    expect(idx.get('理')).toContain('理性');
  });
});

describe('expandQueryFuzzy', () => {
  const vocab = buildFuzzyIndex(['哲学', '学术', '理性', '美学']);

  it('精确词不扩展（仅保留原词）', () => {
    expect(expandQueryFuzzy('哲学', vocab)).toEqual(['哲学']);
  });

  it('繁简/笔误零命中 → 扩展为近词（哲學→哲学）', () => {
    const out = expandQueryFuzzy('哲學', vocab);
    expect(out).toContain('哲學'); // 原词保留
    expect(out).toContain('哲学'); // 近词补入
  });

  it('近词必须共享首字（学术 不会因小距离混入 哲学）', () => {
    const out = expandQueryFuzzy('哲學', vocab);
    expect(out).not.toContain('学术'); // 首字不同，跳过
  });

  it('多词查询逐个扩展', () => {
    const out = expandQueryFuzzy('哲學 理姓', vocab);
    expect(out).toContain('哲学');
    expect(out).toContain('理性');
  });
});

describe('fuzzy recall end-to-end (searchL2 over expanded query)', () => {
  it('精确零命中时，扩展查询能召回近词文档', async () => {
    const docs = [
      {
        id: 'e:phil',
        kind: 'entry' as const,
        slug: 'phil',
        title: '哲学',
        text: '这是一段关于哲学的讨论。',
        entrySlug: 'phil',
        entryTitle: '哲学',
      },
    ];
    const shards = buildShards(docs, 1);
    const manifest = { search: { shards: 1, docs: 1, terms: 10, avgDocLen: 10 } };
    const titleIndex: TitleIndexItem[] = [{ slug: 'phil', title: '哲学', aliases: [], words: 10 }];
    const stats = { totalDocs: 1, avgLen: 10, df: new Map<string, number>([['哲学', 1]]) };
    const engine = new SearchEngine(manifest, titleIndex, async (s) => shards[s], stats);

    // 精确查询（繁体）零命中
    const exact = await engine.searchL2('哲學');
    expect(exact.length).toBe(0);

    // 扩展后召回
    const vocab = buildFuzzyIndex(stats.df.keys());
    const expanded = expandQueryFuzzy('哲學', vocab);
    expect(expanded).toContain('哲学');
    const hits = await engine.searchL2(expanded.join(' '));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].doc.slug).toBe('phil');
  });
});
