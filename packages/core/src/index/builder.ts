/**
 * 索引构建（02 §3.4 / §15.3 T02mini）。
 * 读取内容仓库（任意 Vfs），产出 .index/ 全部派生产物：
 * manifest / taxonomy / entries 分片 / toc / search 分片 + L1 title 索引。
 * 纯函数，返回 { files, manifest, ... }，由 CLI 负责落盘。
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Vfs } from '../vfs/types.js';
import { loadSnapshot, type ContentSnapshot } from '../content/repository.js';
import { parseYamlFrontmatter } from '../parse/frontmatter.js';
import { toPlainText } from '../parse/markdown.js';
import { countWords } from '../parse/words.js';
import { buildShards, type IndexingDoc, type ShardIndex } from './inverted.js';
import { buildDfBuckets } from './df.js';
import { encodePostings, decodePostings, inlineIndexToMap } from './shard-codec.js';
import { compressJson } from '../util/compress.js';
import { chooseShardCount } from './shards.js';
import { deriveCrossTimeline, deriveTimelineDimensions } from '../track/parse.js';
import { sha1 } from '../util/sha1.js';
import { shardOf } from '../util/fnv1a.js';
import { hashEntryDir } from '../content/hash.js';
import {
  GENERATOR, SCHEMA_VERSION, TLDR_MAX,
} from '../constants.js';
import type {
  EntryCover, EntryIndexItem, IndexManifest, TocNode, TitleIndexItem, TaxonomyNode,
} from '../types.js';

export interface BuildIndexOptions {
  /** 覆盖分区数（默认按字数自动 16/64/256，02 §18.2） */
  shardCount?: number;
  /** 内容字节数（用于 manifest.bytes，可选） */
  contentBytes?: number;
  /**
   * ② 增量构建：命中「旧 build-state 有效 + 分区数 M 未变 + 旧分片齐全」时，
   * 仅重建脏分片、干净分片复用旧文本（跳过分词）。默认关闭（全量），由 CLI 透传。
   */
  incremental?: boolean;
}

/** 单条词条的构建指纹（② 增量构建 state 项）。 */
export interface EntryBuildFingerprint {
  /** hashEntryDir 内容指纹 */
  hash: string;
  /** 该词条全部 docs（entry-doc + 各 section-doc）命中的检索分片号集合 */
  shards: number[];
}

/** 增量构建状态（落 `content/.pks-build-state.json`，gitignore，不进 .index/、不随包分发）。 */
export interface BuildState {
  version: 1;
  /** 构建时的检索分区数 M；M 变化即强转全量。 */
  shardCount: number;
  entries: Record<string, EntryBuildFingerprint>;
  built_at: string;
}

/** 增量 state 落盘相对路径（相对 content/ 根） */
export const BUILD_STATE_FILE = '.pks-build-state.json';

function countNodes(nodes: TaxonomyNode[]): number {
  return nodes.reduce((acc, n) => acc + 1 + (n.children ? countNodes(n.children) : 0), 0);
}

function buildCategoryIdMap(taxonomy: TaxonomyNode[]): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (nodes: TaxonomyNode[]) => {
    for (const n of nodes) {
      map.set(n.path, n.id);
      if (n.children) walk(n.children);
    }
  };
  walk(taxonomy);
  return map;
}

function sectionToToc(nodes: ContentSnapshot['trees'][string]): TocNode[] {
  return nodes.map((n) => ({
    k: n.key,
    t: n.title,
    o: n.order,
    d: n.depth,
    w: n.words ?? 0,
    st: n.status,
    kd: n.kind,
    c: n.children.length ? sectionToToc(n.children) : undefined,
  }));
}

export interface BuildResult {
  files: Record<string, string>;
  manifest: IndexManifest;
  titleIndex: TitleIndexItem[];
  shards: ShardIndex[];
  snapshot: ContentSnapshot;
  errors: string[];
  warnings: string[];
  /** ② 增量构建：本次构建状态（由 CLI 落到 content/.pks-build-state.json）。 */
  buildState: BuildState;
  /** 本次是否真正走了增量路径（false = 全量，含首次/回退）。 */
  incrementalUsed: boolean;
}

/** 读取旧增量 state；缺失/损坏/版本不符 → null（触发全量）。 */
function readBuildState(vfs: Vfs): BuildState | null {
  try {
    if (!vfs.exists(BUILD_STATE_FILE)) return null;
    const o = JSON.parse(vfs.readText(BUILD_STATE_FILE)) as BuildState;
    if (!o || o.version !== 1 || typeof o.shardCount !== 'number' || !o.entries) return null;
    return o;
  } catch {
    return null;
  }
}

/** 解码线上分片文本为 ShardIndex（postings 优先，旧内联 index 兜底）。 */
function decodeShardText(text: string): ShardIndex {
  const wire = JSON.parse(text) as {
    shard: number;
    docs: ShardIndex['docs'];
    lengths: number[];
    postings?: string;
    index?: Record<string, Array<[number, number]>>;
  };
  const index = wire.postings ? decodePostings(wire.postings) : (wire.index ? inlineIndexToMap(wire.index) : {});
  return { shard: wire.shard, docs: wire.docs, lengths: wire.lengths, index };
}

/**
 * ② 增量构建尝试。命中条件（全部满足）：
 *  - opts.incremental 开启；
 *  - 旧 build-state 存在且 `shardCount === m`（M 未变）；
 *  - 旧检索分片 `.index/search/sNN.json` 全部齐全（缺一即全量）。
 * 脏分片 = 变更/删除词条的**旧 docs 分片** ∪ 变更/新增词条的**当前 docs 分片**；
 * 干净分片复用旧文本（字节级不变），脏分片按当前 docs 重建。
 */
function tryLoadIncremental(
  vfs: Vfs,
  m: number,
  hashes: Map<string, string>,
  indexingDocs: IndexingDoc[],
  enabled: boolean,
): { shards: ShardIndex[]; reuseText: Map<number, string> } | null {
  if (!enabled) return null;
  const prev = readBuildState(vfs);
  if (!prev || prev.shardCount !== m) return null;

  const prevText = new Map<number, string>();
  for (let s = 0; s < m; s++) {
    const rel = `.index/search/s${String(s).padStart(2, '0')}.json`;
    if (!vfs.exists(rel)) return null; // 旧分片不齐 → 全量
    prevText.set(s, vfs.readText(rel));
  }

  const dirty = new Set<number>();
  // 变更/删除的旧词条：其旧 docs 所在分片全部标记脏
  for (const [slug, fp] of Object.entries(prev.entries)) {
    const cur = hashes.get(slug);
    if (cur === undefined || cur !== fp.hash) {
      for (const s of fp.shards) dirty.add(s);
    }
  }
  // 变更/新增词条的当前 docs 所在分片（覆盖「新增章节落在别的分片」的情况）
  const changedEntries = new Set<string>();
  for (const [slug, h] of hashes) {
    const p = prev.entries[slug];
    if (!p || p.hash !== h) changedEntries.add(slug);
  }
  for (const d of indexingDocs) {
    const owner = d.kind === 'entry' ? d.slug : d.entrySlug ?? d.slug;
    if (changedEntries.has(owner)) dirty.add(shardOf(d.slug, m));
  }

  const shards: ShardIndex[] = new Array(m);
  const reuseText = new Map<number, string>();
  for (let s = 0; s < m; s++) {
    if (!dirty.has(s)) {
      const text = prevText.get(s)!;
      shards[s] = decodeShardText(text);
      reuseText.set(s, text);
    } else {
      const subset = indexingDocs.filter((d) => shardOf(d.slug, m) === s);
      shards[s] = buildShards(subset, m)[s];
    }
  }
  return { shards, reuseText };
}

export function buildIndex(vfs: Vfs, opts: BuildIndexOptions = {}): BuildResult {
  const { snapshot, errors, warnings } = loadSnapshot(vfs);
  const { taxonomy, entries, sections, bodies, trees, tracks } = snapshot;

  // 类目 id 映射
  const idMap = buildCategoryIdMap(taxonomy);
  const categoryIdsOf = (cats: string[]): string[] => cats.map((c) => idMap.get(c) ?? c);

  // 双轨推导
  const crossSet = deriveCrossTimeline(tracks);
  const entryTimelineField: Record<string, string[]> = {};
  for (const e of entries) if (e.timeline) entryTimelineField[e.slug] = e.timeline;
  const tlDims = deriveTimelineDimensions(tracks, entryTimelineField);

  // 给 taxonomy 节点回填 entrySlugs
  const taxonomyWithSlugs: TaxonomyNode[] = JSON.parse(JSON.stringify(taxonomy));
  const assignSlugs = (nodes: TaxonomyNode[]) => {
    for (const n of nodes) {
      n.entrySlugs = entries.filter((e) => e.categories.includes(n.path)).map((e) => e.slug);
      if (n.children) assignSlugs(n.children);
    }
  };
  assignSlugs(taxonomyWithSlugs);

  // 构建 entries 索引分片 + IndexingDoc
  const entryItems: EntryIndexItem[] = [];
  const covers: EntryCover[] = [];
  const knownSlugs = new Set(entries.map((e) => e.slug));
  const indexingDocs: IndexingDoc[] = [];
  const titleIndex: TitleIndexItem[] = [];
  const tocHeavy: string[] = [];

  let totalSections = 0;
  let totalWords = 0;

  for (const e of entries) {
    // 词条「导读」正文字数（仅用于「无章节的单页词条」回退口径）
    let entryWords = 0;
    try {
      const raw = vfs.readText(e.entryFile);
      const body = parseYamlFrontmatter(raw).body;
      entryWords = countWords(toPlainText(body));
    } catch { /* 容错 */ }

    const cats = categoryIdsOf(e.categories);
    const tl = tlDims.get(e.slug);
    const sd = e.sort_date;
    const ctl = crossSet.has(e.slug) ? 1 : 0;

    const secs = sections[e.slug] ?? [];
    totalSections += secs.length;

    // ★ 统一字数口径（唯一规则，勿分叉）：词条「总字数」= 各章节正文（kind !== 'container'）字数之和；
    //   container（卷）无正文且不计入（与 lint L003 口径一致）；无章节的单页词条回退为词条正文字数。
    //   `w` / `cover.word_count` / `titleIndex.words` / `stats.words` 全部改由本口径派生，
    //   从而保证详情页「字数」严格等于其「章节目录」逐章字数之和。
    const chapterWords = secs.reduce(
      (acc, s) => acc + (s.kind === 'container' ? 0 : (s.words ?? 0)),
      0,
    );
    const entryTotalWords = secs.some((s) => s.kind !== 'container') ? chapterWords : entryWords;
    totalWords += entryTotalWords;

    const item: EntryIndexItem = {
      s: e.slug,
      t: e.title,
      ty: e.type,
      st: e.status,
      w: entryTotalWords,
      ua: e.updated_at,
      rv: e.rev,
      al: e.aliases ?? [],
      c: cats,
      sc: e.sectionCount,
      sm: (e.summary || '').slice(0, TLDR_MAX),
      ag: e.ai_generated ? 1 : 0,
      an: e.ai_annotated ? 1 : 0,
      tl,
      sd,
      ctl,
    };
    if (e.sectionCount <= 30 && secs.length > 0) {
      item.toc = sectionToToc(trees[e.slug] ?? []);
    }
    entryItems.push(item);

    // 详情页元数据（cover）：复用既有 front-matter，供阅读端详情页直接消费
    const related = [...(e.see_also ?? []), ...(e.requires ?? [])]
      .filter((slug, i, arr) => knownSlugs.has(slug) && arr.indexOf(slug) === i);
    covers.push({
      slug: e.slug,
      title: e.title,
      subtitle: e.subtitle,
      summary: e.summary || '',
      categories: [...e.categories],
      tags: e.tags ?? [],
      original_title: e.original_title,
      word_count: entryTotalWords,
      sources: e.sources ?? [],
      updated_at: e.updated_at,
      chapter_count: e.sectionCount,
      related,
    });

    if (e.status === 'published') {
      titleIndex.push({
        slug: e.slug,
        title: e.title,
        aliases: e.aliases ?? [],
        type: e.type,
        categoryIds: cats,
        docId: `e:${e.slug}`,
        words: entryTotalWords,
      });
    }

    // 词条级 IndexingDoc
    indexingDocs.push({
      id: `e:${e.slug}`,
      kind: 'entry',
      slug: e.slug,
      title: e.title,
      text: `${e.title} ${e.summary} ${(e.aliases ?? []).join(' ')}`,
      tl, sd, ctl,
    });

    // 章节级 IndexingDoc（字数已在词条级按「章节之和」口径统一累计，此处不再重复累加）
    for (const sec of secs) {
      const bodyText = bodies[e.slug]?.[sec.key] ?? '';
      indexingDocs.push({
        id: `s:${sec.slug}`,
        kind: 'section',
        slug: sec.slug,
        title: sec.title,
        entrySlug: e.slug,
        entryTitle: e.title,
        anchor: sec.key,
        text: `${sec.title} ${sec.summary?.tldr ?? ''} ${bodyText}`,
        tl, sd, ctl,
      });
    }
    if (e.sectionCount > 30) tocHeavy.push(e.slug);
  }

  // 分片（② 增量：命中则仅重建脏分片，干净分片复用旧文本）
  const M = opts.shardCount ?? chooseShardCount(totalWords);
  const hashes = new Map<string, string>();
  for (const e of entries) hashes.set(e.slug, hashEntryDir(vfs, e.slug));
  const incremental = tryLoadIncremental(vfs, M, hashes, indexingDocs, opts.incremental === true);
  const reuseText = incremental?.reuseText ?? new Map<number, string>();
  const shards = incremental?.shards ?? buildShards(indexingDocs, M);

  // 计算 terms / avgDocLen
  let terms = 0;
  let totalLen = 0;
  for (const sh of shards) {
    terms += Object.keys(sh.index).length;
    totalLen += sh.lengths.reduce((a, b) => a + b, 0);
  }
  const avgDocLen = indexingDocs.length ? totalLen / indexingDocs.length : 0;

  const manifest: IndexManifest = {
    schema: SCHEMA_VERSION,
    generator: GENERATOR,
    built_at: new Date().toISOString(),
    contentHash: sha1(entries.map((e) => `${e.slug}:${e.rev}`).join('|')),
    contentRoot: 'content/entries',
    stats: {
      categories: countNodes(taxonomy),
      entries: entries.length,
      sections: totalSections,
      words: totalWords,
      bytes: opts.contentBytes ?? totalWords * 3,
      shards: M,
    },
    entryShards: [],
    tocHeavy,
    search: { shards: M, docs: indexingDocs.length, terms, avgDocLen: Math.round(avgDocLen * 100) / 100 },
  };

  // 组装 files
  const files: Record<string, string> = {};

  // entries 分片（P1-2：按 slug 哈希分桶，固定 64 桶；文件名两位补零 00..3f）。
  // 哈希分桶使单片在词条数增长（>1000）时仍保持小而均衡，避免单字母片膨胀。
  // 必须在序列化 manifest 之前完成，保证落盘 manifest.entryShards 非空（旧产物因序列
  // 化顺序 bug 恒为 []，依赖 loader 首字母兜底；此处修正后新产物自带正确分片清单）。
  const ENTRY_BUCKET_COUNT = 64;
  const entryShardMap = new Map<string, EntryIndexItem[]>();
  for (const it of entryItems) {
    const bucket = String(shardOf(it.s, ENTRY_BUCKET_COUNT)).padStart(2, '0');
    if (!entryShardMap.has(bucket)) entryShardMap.set(bucket, []);
    entryShardMap.get(bucket)!.push(it);
  }
  const entryShards: string[] = [];
  for (const [bucket, items] of entryShardMap) {
    files[`.index/entries/${bucket}.json`] = JSON.stringify({ shard: bucket, items }, null, 2);
    entryShards.push(bucket);
  }
  manifest.entryShards = entryShards.sort();

  files['.index/manifest.json'] = JSON.stringify(manifest, null, 2);

  // taxonomy
  files['.index/taxonomy.json'] = JSON.stringify(taxonomyWithSlugs, null, 2);

  // tracks（学习序列，阅读端直接消费，免去 YAML 二次解析）
  files['.index/tracks.json'] = JSON.stringify(
    { schema: SCHEMA_VERSION, generator: GENERATOR, tracks },
    null,
    2,
  );

  // covers（词条详情页元数据，每词条一文件）
  for (const cov of covers) {
    files[`.index/covers/${cov.slug}.json`] = JSON.stringify(cov, null, 2);
  }

  // toc 重条目
  for (const slug of tocHeavy) {
    files[`.index/toc/${slug}.json`] = JSON.stringify({ slug, toc: sectionToToc(trees[slug] ?? []) }, null, 2);
  }

  // search
  files['.index/search/meta.json'] = JSON.stringify(manifest.search, null, 2);
  files['.index/search/title.json'] = JSON.stringify(titleIndex, null, 2);
  // ① df 分片化：meta(全局 {totalDocs, avgLen}) + 按 term 哈希分桶的多个小文件；
  // Worker/CLI 只在查询时按需懒加载命中的桶，不再整表加载进内存。
  // （注：早期笔记的「整表 48MB」是 2000 万字目标规模的推算；当前 143 万词实测全量 df
  //   仅约 1.3MB —— 分片化的真实收益是「按需只取 1–3 个桶」，而非整表体积本身。）
  const { meta: dfMeta, buckets: dfBuckets } = buildDfBuckets(shards);
  files['.index/search/df/meta.json'] = JSON.stringify(dfMeta, null, 2);
  // ① df 桶压缩（zlib + base64，复用 shard-codec 同款 fflate 文本载体）：桶内容压成单行
  // base64 文本，查询时按需懒加载命中的少数桶并解压，随语料规模上升收益更明显。
  for (const b of dfBuckets) {
    files[`.index/search/df/bucket-${String(b.n).padStart(3, '0')}.json`] = compressJson({ n: b.n, df: b.df });
  }
  for (const sh of shards) {
    const key = `.index/search/s${String(sh.shard).padStart(2, '0')}.json`;
    const reused = reuseText.get(sh.shard);
    // ② 增量：干净分片直接复用旧文本（字节级不变）；脏分片才重新编码。
    // P0-I：倒排 postings 二进制化（varint 差分 + zlib + base64），doc 表/长度仍为 JSON。
    // 用紧凑 JSON（无缩进）进一步减小体积；其余产物保持 pretty JSON 不变。
    files[key] = reused ?? JSON.stringify({
      shard: sh.shard,
      docs: sh.docs,
      lengths: sh.lengths,
      postings: encodePostings(sh.index),
    });
  }

  // ② 增量构建：产出词条指纹（hash + 全部 docs 命中的分片集合），供下次构建比对。
  const buildState: BuildState = {
    version: 1,
    shardCount: M,
    entries: {},
    built_at: manifest.built_at,
  };
  for (const e of entries) {
    const docShards = new Set<number>();
    docShards.add(shardOf(e.slug, M));
    for (const sec of sections[e.slug] ?? []) docShards.add(shardOf(sec.slug, M));
    buildState.entries[e.slug] = {
      hash: hashes.get(e.slug) ?? '',
      shards: [...docShards].sort((a, b) => a - b),
    };
  }

  return { files, manifest, titleIndex, shards, snapshot, errors, warnings, buildState, incrementalUsed: incremental !== null };
}

/** 将构建产物落盘（Node，CLI 用） */
export function writeIndexFiles(rootDir: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const full = join(rootDir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
  }
}
