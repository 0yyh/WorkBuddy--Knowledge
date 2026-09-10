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
import { chooseShardCount } from './shards.js';
import { deriveCrossTimeline, deriveTimelineDimensions } from '../track/parse.js';
import { sha1 } from '../util/sha1.js';
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
}

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
    // 词条正文词数
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

    const item: EntryIndexItem = {
      s: e.slug,
      t: e.title,
      ty: e.type,
      st: e.status,
      w: entryWords,
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
      word_count: entryWords,
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
        words: entryWords,
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

    // 章节级 IndexingDoc + 字数累计
    for (const sec of secs) {
      const bodyText = bodies[e.slug]?.[sec.key] ?? '';
      totalWords += sec.words ?? 0;
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
    totalWords += entryWords;

    if (e.sectionCount > 30) tocHeavy.push(e.slug);
  }

  // 分片
  const M = opts.shardCount ?? chooseShardCount(totalWords);
  const shards = buildShards(indexingDocs, M);

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
  files['.index/manifest.json'] = JSON.stringify(manifest, null, 2);

  // entries 分片（按 slug 首字母 26 片）
  const alphaMap = new Map<string, EntryIndexItem[]>();
  for (const it of entryItems) {
    const letter = (it.s[0] || 'z').toLowerCase();
    if (!alphaMap.has(letter)) alphaMap.set(letter, []);
    alphaMap.get(letter)!.push(it);
  }
  const entryShards: string[] = [];
  for (const [letter, items] of alphaMap) {
    files[`.index/entries/${letter}.json`] = JSON.stringify({ shard: letter, items }, null, 2);
    entryShards.push(letter);
  }
  manifest.entryShards = entryShards.sort();

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
  for (const sh of shards) {
    files[`.index/search/s${String(sh.shard).padStart(2, '0')}.json`] = JSON.stringify(
      { shard: sh.shard, docs: sh.docs, lengths: sh.lengths, index: sh.index },
      null,
      2,
    );
  }

  return { files, manifest, titleIndex, shards, snapshot, errors, warnings };
}

/** 将构建产物落盘（Node，CLI 用） */
export function writeIndexFiles(rootDir: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const full = join(rootDir, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
  }
}
