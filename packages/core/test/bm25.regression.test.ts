/**
 * BM25 打分回归（P2-11 / P0-II 全局统计 / P1-4 Map postings）。
 *
 * 目的：把「打分公式 + 长度归一化 + 全局 df/totalDocs/avgLen 覆盖」这三件事
 * 用**硬编码的金值**钉死。任何一处被无意改动（换公式、改 k1/b、退回分片内统计、
 * postings 由 Map 退化回数组导致查不到 tf），这里的断言会立刻失败。
 *
 * 金值由 `bm25Term` 实际计算得出（非手写），保留 10 位小数比对。
 */
import { describe, it, expect } from 'vitest';
import { buildShards, SearchEngine } from '../src/index/inverted.js';
import { bm25Term } from '../src/index/bm25.js';
import type { IndexingDoc, ShardIndex, GlobalSearchStats } from '../src/index/inverted.js';
import type { IndexManifest } from '../src/types.js';

/**
 * 固定语料（slug 顺序即 docId 顺序：alpha=0, beta=1, gamma=2）。
 * 西文整词分词：[graph, theory, graph] / [graph] / [set, theory]
 *   lengths = [3, 1, 2] → avgLen = 2, totalDocs = 3
 */
const DOCS: IndexingDoc[] = [
  { id: 'e:alpha', kind: 'entry', slug: 'alpha', title: 'Alpha', text: 'graph theory graph' },
  { id: 'e:beta', kind: 'entry', slug: 'beta', title: 'Beta', text: 'graph' },
  { id: 'e:gamma', kind: 'entry', slug: 'gamma', title: 'Gamma', text: 'set theory' },
];

const MANIFEST = {
  search: { shards: 1, docs: 3, terms: 3, avgDocLen: 2 },
} as unknown as IndexManifest;

/** 单分片语料：m=1 时全部文档落在 shard 0，打分完全确定（无分片间差异）。 */
function buildSingleShard(): ShardIndex {
  return buildShards(DOCS, 1)[0];
}

function makeEngine(stats?: GlobalSearchStats): SearchEngine {
  const shard = buildSingleShard();
  return new SearchEngine(MANIFEST, [], async () => shard, stats);
}

/** 取出按分数降序的 (slug, score) 列表，便于断言排序与金值。 */
function ranked(hits: Awaited<ReturnType<SearchEngine['searchL2']>>): Array<[string, number]> {
  return hits.map((h) => [h.doc.slug, h.score] as [string, number]);
}

describe('BM25 打分金值回归', () => {
  it('buildShards 产出 Map<docId, tf> 倒排（P1-4），非数组', () => {
    const shard = buildSingleShard();

    expect(shard.index.graph).toBeInstanceOf(Map);
    expect(shard.index.theory).toBeInstanceOf(Map);
    // graph: alpha tf=2, beta tf=1；theory: alpha tf=1, gamma tf=1
    expect(shard.index.graph.get(0)).toBe(2);
    expect(shard.index.graph.get(1)).toBe(1);
    expect(shard.index.graph.get(2)).toBeUndefined();
    expect(shard.index.theory.get(0)).toBe(1);
    expect(shard.index.theory.get(2)).toBe(1);
    expect([...shard.lengths]).toEqual([3, 1, 2]);
  });

  it('查询 graph：两篇命中，短文档（beta）靠长度归一化胜出 tf 更高的长文档', async () => {
    const engine = makeEngine();
    const hits = await engine.searchL2('graph');

    expect(hits.length).toBe(2);
    // 排序：beta(0.5909) > alpha(0.5666)
    expect(ranked(hits)[0][0]).toBe('beta');
    expect(ranked(hits)[1][0]).toBe('alpha');

    // 金值（无全局统计时退化为分片内：totalDocs=3, avgLen=2, df(graph)=2）
    expect(ranked(hits)[0][1]).toBeCloseTo(0.5908617053374963, 10);
    expect(ranked(hits)[1][1]).toBeCloseTo(0.5665797174469142, 10);

    // 与 bm25Term 直接计算一致（锁定公式未被替换）
    expect(ranked(hits)[1][1]).toBeCloseTo(bm25Term(2, 3, 2, 2, 3), 10);
    expect(ranked(hits)[0][1]).toBeCloseTo(bm25Term(1, 1, 2, 2, 3), 10);
  });

  it('查询 theory：gamma（较短）排在 alpha 之前', async () => {
    const engine = makeEngine();
    const hits = await engine.searchL2('theory');

    expect(hits.length).toBe(2);
    expect(ranked(hits)[0][0]).toBe('gamma');
    expect(ranked(hits)[0][1]).toBeCloseTo(0.4700036292457356, 10); // bm25Term(1,2,2,2,3)
    expect(ranked(hits)[1][0]).toBe('alpha');
    expect(ranked(hits)[1][1]).toBeCloseTo(0.39019169220400696, 10); // bm25Term(1,3,2,2,3)
  });

  it('打分确定性：同一查询重复执行结果完全一致', async () => {
    const engine = makeEngine();
    const a = await engine.searchL2('graph');
    const b = await engine.searchL2('graph');

    expect(ranked(a)).toEqual(ranked(b));
    expect(a[0].score).toBe(b[0].score);
  });

  it('matchedTerms 只含真正命中的词', async () => {
    const engine = makeEngine();
    const hits = await engine.searchL2('graph');

    for (const h of hits) expect(h.matchedTerms).toEqual(['graph']);
  });

  it('空查询 / 未命中词返回空数组，不抛错', async () => {
    const engine = makeEngine();

    expect(await engine.searchL2('')).toEqual([]);
    expect(await engine.searchL2('   ')).toEqual([]);
    expect(await engine.searchL2('nonexistentterm')).toEqual([]);
  });
});

describe('P0-II 全局统计覆盖分片内统计', () => {
  it('传入全局 stats 后，df / totalDocs / avgLen 均改用全局值（分数与局部统计不同）', async () => {
    const local = await makeEngine().searchL2('graph');
    const stats: GlobalSearchStats = {
      totalDocs: 10,
      avgLen: 2.5,
      df: new Map([['graph', 5]]),
    };
    const global = await makeEngine(stats).searchL2('graph');

    // 金值：bm25Term(1,1,2.5,5,10) 与 bm25Term(2,3,2.5,5,10)
    expect(ranked(global)[0][1]).toBeCloseTo(0.9186287935131805, 10);
    expect(ranked(global)[1][1]).toBeCloseTo(0.9023217735099881, 10);

    // 全局统计确实生效：分数与局部统计结果不同，且排序保持不变
    expect(ranked(global)[0][1]).not.toBeCloseTo(ranked(local)[0][1], 6);
    expect(ranked(global)[0][0]).toBe('beta');
    expect(ranked(global)[1][0]).toBe('alpha');
  });

  it('全局 df 缺失该词时，df 回退为分片内 postings.size（不崩、不为 0）', async () => {
    const stats: GlobalSearchStats = {
      totalDocs: 10,
      avgLen: 2.5,
      df: new Map(), // 故意不含 graph
    };
    const hits = await makeEngine(stats).searchL2('graph');

    expect(hits.length).toBe(2);
    // df 回退为 2，等价于 bm25Term(1,1,2.5,2,10) / bm25Term(2,3,2.5,2,10)
    expect(ranked(hits)[0][1]).toBeCloseTo(bm25Term(1, 1, 2.5, 2, 10), 10);
    expect(ranked(hits)[1][1]).toBeCloseTo(bm25Term(2, 3, 2.5, 2, 10), 10);
  });
});

describe('groupByEntry', () => {
  it('按 entrySlug 分组（无 entrySlug 时退回自身 slug）', async () => {
    const engine = makeEngine();
    const hits = await engine.searchL2('graph');
    const groups = engine.groupByEntry(hits);

    expect(groups.length).toBe(2);
    expect(groups.map((g) => g.entry.slug).sort()).toEqual(['alpha', 'beta']);
    for (const g of groups) {
      expect(g.hits.length).toBe(1);
      expect(g.total).toBe(1);
    }
  });

  it('同 entry 的多个 section 命中共用一组', () => {
    const engine = makeEngine();
    const groups = engine.groupByEntry([
      { doc: { id: 's:a/1', kind: 'section', slug: 'a/1', title: 'A1', entrySlug: 'alpha', entryTitle: 'Alpha', words: 3 }, score: 2, matchedTerms: ['graph'] },
      { doc: { id: 's:a/2', kind: 'section', slug: 'a/2', title: 'A2', entrySlug: 'alpha', entryTitle: 'Alpha', words: 3 }, score: 1, matchedTerms: ['graph'] },
    ]);

    expect(groups.length).toBe(1);
    expect(groups[0].entry.slug).toBe('alpha');
    expect(groups[0].entry.title).toBe('Alpha');
    expect(groups[0].total).toBe(2);
  });
});
