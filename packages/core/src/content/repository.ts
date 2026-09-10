/**
 * 内容仓储（02 §3 / §9）。从任意 Vfs 加载 taxonomy / entries / sections / tracks，
 * 解析 front-matter、构建 Section 树。被 build:index 与（T04）运行期阅读器复用。
 */
import yaml from 'js-yaml';
import type { Vfs } from '../vfs/types.js';
import {
  parseYamlFrontmatter,
  validateEntryMeta,
  validateSectionMeta,
} from '../parse/frontmatter.js';
import { toPlainText } from '../parse/markdown.js';
import { countWords } from '../parse/words.js';
import { parseTrack } from '../track/parse.js';
import type {
  Entry, EntryCover, SectionMeta, SectionNode, SourceRef, TaxonomyNode, Track,
} from '../types.js';

export interface LoadResult<T> {
  value: T;
  errors: string[];
  warnings: string[];
}

// ============================================================
// Taxonomy
// ============================================================
interface TaxoRaw {
  id: string;
  title: string;
  order: number;
  children?: TaxoRaw[];
}

export function parseTaxonomy(raw: string): LoadResult<TaxonomyNode[]> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let obj: unknown;
  try {
    obj = yaml.load(raw);
  } catch (e) {
    return { value: [], errors: [`taxonomy.yaml 解析失败：${String(e)}`], warnings };
  }
  if (!Array.isArray(obj)) return { value: [], errors: ['taxonomy.yaml 顶层应为数组'], warnings };

  const build = (nodes: TaxoRaw[], parentPath: string, level: 1 | 2 | 3): TaxonomyNode[] =>
    nodes.map((n, i) => {
      const path = parentPath ? `${parentPath}/${n.title}` : n.title;
      const id = n.id ?? slugifyId(path);
      const node: TaxonomyNode = {
        id,
        title: n.title,
        order: typeof n.order === 'number' ? n.order : i + 1,
        level,
        path,
        children: n.children ? build(n.children, path, (level + 1) as 1 | 2 | 3) : undefined,
      };
      return node;
    });

  const value = build(obj as TaxoRaw[], '', 1);
  return { value, errors, warnings };
}

function slugifyId(path: string): string {
  return path.replace(/\//g, '-').replace(/\s+/g, '-');
}

// ============================================================
// Entries
// ============================================================
export function listEntrySlugs(vfs: Vfs): string[] {
  if (!vfs.exists('entries')) return [];
  return vfs
    .listDir('entries')
    .filter((name) => vfs.exists(`entries/${name}/entry.md`));
}

export function loadEntry(vfs: Vfs, slug: string): LoadResult<Entry> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const entryFile = `entries/${slug}/entry.md`;
  if (!vfs.exists(entryFile)) {
    return { value: undefined as unknown as Entry, errors: [`缺少 ${entryFile}`], warnings };
  }
  const raw = vfs.readText(entryFile);
  const fm = parseYamlFrontmatter(raw);
  if (!fm.data) {
    return { value: undefined as unknown as Entry, errors: [`${entryFile}: ${fm.error}`], warnings };
  }
  const v = validateEntryMeta(fm.data);
  errors.push(...v.errors);
  warnings.push(...v.warnings);

  const chaptersDir = `entries/${slug}/chapters`;
  const hasSections = vfs.exists(chaptersDir) && vfs.listDir(chaptersDir).some((f) => f.endsWith('.md'));
  const sectionCount = hasSections
    ? vfs.listDir(chaptersDir).filter((f) => f.endsWith('.md')).length
    : 0;

  const entry: Entry = {
    ...v.value,
    dirPath: `entries/${slug}`,
    entryFile,
    sectionCount,
    hasSections,
  };
  return { value: entry, errors, warnings };
}

// ============================================================
// Covers（词条详情页元数据，.index/covers/{slug}.json）
// ============================================================
function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** 校验并规范化 cover JSON（由 buildIndex 产出，也可安全解析运行时文件） */
export function parseEntryCover(raw: unknown): EntryCover {
  if (!raw || typeof raw !== 'object') throw new Error('cover 数据应为对象');
  const o = raw as Record<string, unknown>;
  if (typeof o.slug !== 'string' || o.slug.length === 0) throw new Error('cover 缺少 slug');
  if (typeof o.title !== 'string' || o.title.length === 0) throw new Error('cover 缺少 title');
  return {
    slug: o.slug,
    title: o.title,
    subtitle: typeof o.subtitle === 'string' && o.subtitle.length > 0 ? o.subtitle : undefined,
    summary: typeof o.summary === 'string' ? o.summary : '',
    categories: stringArray(o.categories),
    tags: stringArray(o.tags),
    original_title:
      typeof o.original_title === 'string' && o.original_title.length > 0 ? o.original_title : undefined,
    word_count: typeof o.word_count === 'number' ? o.word_count : 0,
    sources: Array.isArray(o.sources) ? (o.sources as SourceRef[]) : [],
    updated_at: typeof o.updated_at === 'string' ? o.updated_at : '',
    chapter_count: typeof o.chapter_count === 'number' ? o.chapter_count : 0,
    related: stringArray(o.related),
  };
}

/** 从已构建索引（Vfs）读取某词条的 cover 元数据；不存在或损坏返回 null */
export function getEntryCover(vfs: Vfs, slug: string): EntryCover | null {
  const rel = `.index/covers/${slug}.json`;
  if (!vfs.exists(rel)) return null;
  try {
    return parseEntryCover(JSON.parse(vfs.readText(rel)) as unknown);
  } catch {
    return null;
  }
}

// ============================================================
// Sections
// ============================================================
export function loadSections(
  vfs: Vfs,
  slug: string,
): LoadResult<{ sections: SectionMeta[]; bodies: Record<string, string> }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const chaptersDir = `entries/${slug}/chapters`;
  if (!vfs.exists(chaptersDir)) return { value: { sections: [], bodies: {} }, errors, warnings };

  const files = vfs.listDir(chaptersDir).filter((f) => f.endsWith('.md')).sort();
  const sections: SectionMeta[] = [];
  const bodies: Record<string, string> = {};

  for (const f of files) {
    const raw = vfs.readText(`${chaptersDir}/${f}`);
    const fm = parseYamlFrontmatter(raw);
    if (!fm.data) {
      errors.push(`${chaptersDir}/${f}: ${fm.error}`);
      continue;
    }
    const v = validateSectionMeta(fm.data);
    errors.push(...v.errors);
    warnings.push(...v.warnings);
    const bodyText = toPlainText(fm.body);
    const words = countWords(bodyText);
    const section: SectionMeta = { ...v.value, words, file: `chapters/${f}` };
    sections.push(section);
    bodies[section.key] = bodyText;
  }
  return { value: { sections, bodies }, errors, warnings };
}

/** 由 SectionMeta[] 构建树（按 parent / orderKey） */
export function buildSectionTree(sections: SectionMeta[]): SectionNode[] {
  const bySlug = new Map<string, SectionNode>();
  for (const s of sections) bySlug.set(s.slug, { ...s, index: 0, children: [] });

  const roots: SectionNode[] = [];
  for (const s of sections) {
    const node = bySlug.get(s.slug)!;
    if (s.parent && bySlug.has(s.parent)) {
      bySlug.get(s.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRec = (nodes: SectionNode[]) => {
    nodes.sort((a, b) => (a.orderKey ?? '').localeCompare(b.orderKey ?? ''));
    nodes.forEach((n, i) => {
      n.index = i + 1;
      sortRec(n.children);
    });
  };
  sortRec(roots);
  return roots;
}

// ============================================================
// Tracks
// ============================================================
export function loadTracks(vfs: Vfs): LoadResult<Track[]> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!vfs.exists('tracks')) return { value: [], errors, warnings };
  const files = vfs.listDir('tracks').filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  const tracks: Track[] = [];
  for (const f of files) {
    const raw = vfs.readText(`tracks/${f}`);
    const { track, errors: e } = parseTrack(raw, f.replace(/\.ya?ml$/, ''));
    errors.push(...e);
    if (track) tracks.push(track);
  }
  return { value: tracks, errors, warnings };
}

/** 读取整个内容仓库（构建期一次性） */
export interface ContentSnapshot {
  taxonomy: TaxonomyNode[];
  entries: Entry[];
  sections: Record<string, SectionMeta[]>;
  bodies: Record<string, Record<string, string>>; // slug -> key -> bodyText
  trees: Record<string, SectionNode[]>;
  tracks: Track[];
}

export function loadSnapshot(vfs: Vfs): {
  snapshot: ContentSnapshot;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  let taxonomy: TaxonomyNode[] = [];
  if (vfs.exists('taxonomy.yaml')) {
    const r = parseTaxonomy(vfs.readText('taxonomy.yaml'));
    taxonomy = r.value;
    errors.push(...r.errors);
  } else {
    errors.push('缺少 taxonomy.yaml');
  }

  const slugs = listEntrySlugs(vfs);
  const entries: Entry[] = [];
  const sections: Record<string, SectionMeta[]> = {};
  const bodies: Record<string, Record<string, string>> = {};
  const trees: Record<string, SectionNode[]> = {};

  for (const slug of slugs) {
    const er = loadEntry(vfs, slug);
    errors.push(...er.errors);
    warnings.push(...er.warnings);
    if (er.errors.length === 0) {
      entries.push(er.value);
      const sr = loadSections(vfs, slug);
      errors.push(...sr.errors);
      warnings.push(...sr.warnings);
      sections[slug] = sr.value.sections;
      bodies[slug] = sr.value.bodies;
      trees[slug] = buildSectionTree(sr.value.sections);
    }
  }

  const tr = loadTracks(vfs);
  errors.push(...tr.errors);

  return {
    snapshot: { taxonomy, entries, sections, bodies, trees, tracks: tr.value },
    errors,
    warnings,
  };
}
