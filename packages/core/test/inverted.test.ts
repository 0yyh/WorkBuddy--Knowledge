import { describe, it, expect } from 'vitest';
import {
  buildShards,
  searchTitleIndex,
  SearchEngine,
  type ShardIndex,
  type IndexingDoc,
} from '../src/index/inverted.js';
import type { TitleIndexItem, SearchDoc } from '../src/types.js';

describe('buildShards', () => {
  it('builds a ShardIndex with postings and aligned lengths', () => {
    const docs: IndexingDoc[] = [
      { id: 'e:a', kind: 'entry', slug: 'alpha', title: 'Alpha', text: 'capital labor surplus' },
      { id: 'e:b', kind: 'entry', slug: 'beta', title: 'Beta', text: 'capital value exchange' },
    ];
    const shards = buildShards(docs, 4);
    expect(shards).toHaveLength(4);
    // Every doc appears exactly once across all shards.
    const totalDocs = shards.reduce((a, s) => a + s.docs.length, 0);
    expect(totalDocs).toBe(2);
    // 'capital' postings reference a real doc.
    const capitalShard = shards.find((s) => s.index['capital']?.length);
    expect(capitalShard).toBeDefined();
    const [docId, tf] = capitalShard!.index['capital'][0];
    expect(capitalShard!.docs[docId].slug).toBe('alpha'); // or beta, but must exist
    expect(tf).toBeGreaterThan(0);
  });
});

describe('searchTitleIndex', () => {
  const titleIndex: TitleIndexItem[] = [
    { slug: 'capital', title: 'Capital Theory', aliases: ['Marx'], type: 'concept', categoryIds: [], docId: 'e:capital', words: 10 },
    { slug: 'labor', title: 'Labor Value', aliases: [], type: 'concept', categoryIds: [], docId: 'e:labor', words: 10 },
  ];

  it('returns ranked title hits with matched terms', () => {
    const hits = searchTitleIndex(titleIndex, 'Capital');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].doc.slug).toBe('capital');
    expect(hits[0].matchedTerms).toContain('capital');
    expect(hits[0].score).toBeGreaterThan(0);
  });

  it('returns empty for non-matching query', () => {
    expect(searchTitleIndex(titleIndex, 'zzzznotfound')).toEqual([]);
  });
});

describe('SearchEngine (L1/L2/groupByEntry)', () => {
  // Build a ShardIndex manually (this exercises searchInShard internally via L2).
  function makeShard(): ShardIndex {
    const docs: SearchDoc[] = [
      { id: 'e:capital', kind: 'entry', slug: 'capital', title: 'Capital', words: 6 },
      { id: 's:capital/c1', kind: 'section', slug: 'capital/c1', title: 'Ch.1', entrySlug: 'capital', entryTitle: 'Capital', words: 6 },
    ];
    return {
      shard: 0,
      docs,
      lengths: [6, 6],
      index: {
        capital: [[0, 3], [1, 1]],
        labor: [[0, 1], [1, 2]],
        surplus: [[0, 2], [1, 3]],
      },
    };
  }

  const titleIndex: TitleIndexItem[] = [
    { slug: 'capital', title: 'Capital', aliases: ['Marx'], type: 'concept', categoryIds: [], docId: 'e:capital', words: 6 },
  ];

  function makeEngine(): SearchEngine {
    const shard = makeShard();
    return new SearchEngine(
      { search: { shards: 16, docs: 2, terms: 3, avgDocLen: 6 } },
      titleIndex,
      async (s) => (s === 0 ? shard : null),
    );
  }

  it('searchL1 returns title hits', () => {
    const hits = makeEngine().searchL1('Capital');
    expect(hits.length).toBe(1);
    expect(hits[0].doc.slug).toBe('capital');
  });

  it('searchL2 returns ranked full-text hits ordered by score desc', async () => {
    const engine = makeEngine();
    const hits = await engine.searchL2('capital surplus');
    expect(hits.length).toBeGreaterThan(0);
    // doc 0 has higher tf for both terms -> should rank first.
    expect(hits[0].doc.id).toBe('e:capital');
    expect(hits[0].score).toBeGreaterThanOrEqual(hits[1].score);
    expect(hits[0].matchedTerms).toContain('capital');
  });

  it('groupByEntry groups section hits under their entry', async () => {
    const engine = makeEngine();
    const hits = await engine.searchL2('labor');
    const groups = engine.groupByEntry(hits);
    expect(groups.length).toBe(1);
    expect(groups[0].entry.slug).toBe('capital');
    expect(groups[0].total).toBe(hits.length);
    expect(groups[0].hits.length).toBe(hits.length);
  });

  it('searchL2 returns empty when no shard is loaded', async () => {
    const engine = new SearchEngine(
      { search: { shards: 16, docs: 0, terms: 0, avgDocLen: 0 } },
      [],
      async () => null,
    );
    expect(await engine.searchL2('anything')).toEqual([]);
  });
});
