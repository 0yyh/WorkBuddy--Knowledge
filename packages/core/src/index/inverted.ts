/**
 * 倒排索引构建与查询（02 §4 / §3.4）。
 * - 索引期：将 IndexingDoc 按 `fnv1a(slug) & (M-1)` 分片，生成每片的 doc 表 + 词典 postings。
 * - 查询期：L1 仅查 title/aliases（秒开），L2 跨分片 BM25。
 * M0 用 JSON 分片；二进制 varint 压缩为容量期优化（见 02 §3.4 .bin）。
 */
import { tokenize, termFrequencies } from './tokenizer.js';
import { bm25Term } from './bm25.js';
import { shardOf } from '../util/fnv1a.js';
import type { SearchDoc, SearchHit, SearchResultGroup, TitleIndexItem, EntryType } from '../types.js';

export interface IndexingDoc {
  id: string;
  kind: 'entry' | 'section';
  slug: string;
  title: string;
  text: string; // 索引用全文
  entrySlug?: string;
  entryTitle?: string;
  anchor?: string;
  tl?: string[];
  sd?: number;
  ctl?: 0 | 1;
}

export interface ShardIndex {
  shard: number;
  docs: SearchDoc[];
  lengths: number[]; // 与 docs 对齐的 token 长度
  index: Record<string, Array<[number, number]>>; // term -> [docId, tf][]
}

/** 将文档集合分片构建为倒排索引 */
export function buildShards(docs: IndexingDoc[], m: number): ShardIndex[] {
  const shards: ShardIndex[] = Array.from({ length: m }, (_, i) => ({
    shard: i,
    docs: [],
    lengths: [],
    index: {},
  }));

  for (const doc of docs) {
    const s = shardOf(doc.slug, m);
    const shard = shards[s];
    const docId = shard.docs.length;
    const tfs = termFrequencies(doc.text);
    const length = [...tfs.values()].reduce((a, b) => a + b, 0);

    const slim: SearchDoc = {
      id: doc.id,
      kind: doc.kind,
      slug: doc.slug,
      title: doc.title,
      anchor: doc.anchor,
      entrySlug: doc.entrySlug,
      entryTitle: doc.entryTitle,
      words: length,
      tl: doc.tl,
      sd: doc.sd,
      ctl: doc.ctl,
    };
    shard.docs.push(slim);
    shard.lengths.push(length);

    for (const [term, tf] of tfs) {
      (shard.index[term] ??= []).push([docId, tf]);
    }
  }
  return shards;
}

function searchInShard(shard: ShardIndex, queryTokens: string[]): SearchHit[] {
  const totalDocs = shard.docs.length;
  if (totalDocs === 0 || queryTokens.length === 0) return [];
  const avgLen = shard.lengths.reduce((a, b) => a + b, 0) / totalDocs;

  // 候选文档 = 命中任一查询词的文档并集
  const candidates = new Set<number>();
  const termDf = new Map<string, number>();
  for (const term of queryTokens) {
    const postings = shard.index[term];
    if (!postings) continue;
    termDf.set(term, postings.length);
    for (const [docId] of postings) candidates.add(docId);
  }
  if (candidates.size === 0) return [];

  const hits: SearchHit[] = [];
  for (const docId of candidates) {
    let score = 0;
    const matched = new Set<string>();
    for (const term of queryTokens) {
      const postings = shard.index[term];
      if (!postings) continue;
      const entry = postings.find((p) => p[0] === docId);
      if (!entry) continue;
      const tf = entry[1];
      score += bm25Term(tf, shard.lengths[docId], avgLen, termDf.get(term)!, totalDocs);
      matched.add(term);
    }
    if (score > 0) {
      hits.push({ doc: shard.docs[docId], score, matchedTerms: [...matched] });
    }
  }
  return hits.sort((a, b) => b.score - a.score);
}

/** L1 轻量索引：title + aliases token 重叠打分（02 §18.2 常驻秒开） */
export function searchTitleIndex(titleIndex: TitleIndexItem[], query: string, limit = 30): SearchHit[] {
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return [];
  const hits: SearchHit[] = [];
  for (const item of titleIndex) {
    const hay = tokenize(item.title + ' ' + item.aliases.join(' '));
    const haySet = new Set(hay);
    let overlap = 0;
    for (const t of qTokens) if (haySet.has(t)) overlap++;
    // 标题直接包含查询串的强信号
    const direct = item.title.toLowerCase().includes(query.toLowerCase()) ? 5 : 0;
    if (overlap > 0) {
      const score = overlap + direct;
      const doc: SearchDoc = {
        id: `e:${item.slug}`,
        kind: 'entry',
        slug: item.slug,
        title: item.title,
        words: item.words,
      };
      hits.push({ doc, score, matchedTerms: [...qTokens].filter((t) => haySet.has(t)) });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export class SearchEngine {
  private shardCache = new Map<number, ShardIndex>();

  constructor(
    private manifest: { search: { shards: number; docs: number; terms: number; avgDocLen: number } },
    private titleIndex: TitleIndexItem[],
    private shardLoader: (shard: number) => ShardIndex | null,
  ) {}

  private loadShard(s: number): ShardIndex | null {
    if (this.shardCache.has(s)) return this.shardCache.get(s)!;
    const sh = this.shardLoader(s);
    if (sh) this.shardCache.set(s, sh);
    return sh;
  }

  /** L1 仅标题/别名（零加载分片） */
  searchL1(query: string): SearchHit[] {
    return searchTitleIndex(this.titleIndex, query);
  }

  /** L2 全文：跨全部分片 BM25 合并 */
  searchL2(query: string): SearchHit[] {
    const q = tokenize(query);
    const m = this.manifest.search.shards;
    const merged = new Map<string, SearchHit>(); // docId(slug) 去重
    for (let s = 0; s < m; s++) {
      const shard = this.loadShard(s);
      if (!shard) continue;
      for (const hit of searchInShard(shard, q)) {
        const key = hit.doc.id;
        const prev = merged.get(key);
        if (!prev || hit.score > prev.score) merged.set(key, hit);
      }
    }
    return [...merged.values()].sort((a, b) => b.score - a.score);
  }

  /** 按 entry 分组（02 §8.1 SearchResultGroup） */
  groupByEntry(hits: SearchHit[]): SearchResultGroup[] {
    const groups = new Map<string, SearchResultGroup>();
    for (const hit of hits) {
      const entrySlug = hit.doc.entrySlug ?? hit.doc.slug;
      let g = groups.get(entrySlug);
      if (!g) {
        g = {
          entry: { slug: entrySlug, title: hit.doc.entryTitle ?? hit.doc.title, type: 'concept' as EntryType },
          hits: [],
          total: 0,
        };
        groups.set(entrySlug, g);
      }
      g.hits.push(hit);
      g.total++;
    }
    return [...groups.values()];
  }
}
