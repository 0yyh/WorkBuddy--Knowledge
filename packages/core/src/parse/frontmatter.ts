/**
 * Front-matter 解析与校验（02 §8.1 / §9）。
 * 解析用 js-yaml；校验返回结构化错误列表，供 build:index 与 lint 复用。
 */
import yaml from 'js-yaml';
import { SLUG_RE, SUMMARY_MIN, SUMMARY_MAX, TLDR_MAX, KEYPOINT_MAX, KEYPOINT_MAX_COUNT } from '../constants.js';
import type { EntryMeta, SectionMeta, SectionSummary, SectionKind, EntryType, EntryStatus, Confidence, SourceRef } from '../types.js';

export interface RawFrontmatter {
  data: Record<string, unknown> | null;
  body: string;
  error?: string;
}

/** 切分 `---\n...\n---\n` 包裹的 YAML 头 */
export function splitFrontmatter(raw: string): { data: string; body: string } | null {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  return { data: m[1], body: m[2] };
}

export function parseYamlFrontmatter(raw: string): RawFrontmatter {
  const split = splitFrontmatter(raw);
  if (!split) return { data: null, body: raw, error: '缺少 front-matter（---\\n...\n---）' };
  try {
    const data = yaml.load(split.data) as Record<string, unknown> | null;
    if (typeof data !== 'object' || data === null) {
      return { data: null, body: split.body, error: 'front-matter 不是合法 YAML 对象' };
    }
    return { data, body: split.body };
  } catch (e) {
    return { data: null, body: split.body, error: `YAML 解析失败：${String(e)}` };
  }
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : v === undefined || v === null ? undefined : String(v);
}
function asStringArray(v: unknown): string[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v)) return undefined;
  return v.map((x) => String(x));
}
function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' ? v : v === undefined ? undefined : Number(v);
}

export interface ValidationResult<T> {
  value: T;
  errors: string[]; // 致命/需修正
  warnings: string[]; // 可放行
}

const ENTRY_TYPES: EntryType[] = ['concept', 'work', 'person', 'event', 'term'];
const STATUSES: EntryStatus[] = ['published', 'stub', 'draft', 'deprecated'];

/** 校验并规范化 EntryMeta（entry.md） */
export function validateEntryMeta(obj: Record<string, unknown>): ValidationResult<EntryMeta> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const slug = asString(obj.slug);
  if (!slug) errors.push('slug 缺失');
  else if (!SLUG_RE.test(slug)) errors.push(`slug "${slug}" 不符合 /^[a-z0-9]+(-[a-z0-9]+)*$/`);

  const title = asString(obj.title);
  if (!title) errors.push('title 缺失');

  const type = asString(obj.type) as EntryType | undefined;
  if (!type) errors.push('type 缺失');
  else if (!ENTRY_TYPES.includes(type)) errors.push(`type "${type}" 非法（应为 ${ENTRY_TYPES.join('/')}）`);

  const categories = asStringArray(obj.categories);
  if (!categories || categories.length === 0) errors.push('categories 为空（至少 1 项）');

  const summary = asString(obj.summary);
  if (!summary) errors.push('summary 缺失');
  else if (summary.length < SUMMARY_MIN) warnings.push(`summary 偏短（<${SUMMARY_MIN} 字）`);
  else if (summary.length > SUMMARY_MAX) errors.push(`summary 超长（>${SUMMARY_MAX} 字）`);

  const status = asString(obj.status) as EntryStatus | undefined;
  if (!status) errors.push('status 缺失');
  else if (!STATUSES.includes(status)) errors.push(`status "${status}" 非法`);

  const confidence = asString(obj.confidence) as Confidence | undefined;
  if (!confidence) warnings.push('confidence 缺失，默认 auto');

  const sources = obj.sources;
  if (!Array.isArray(sources) || sources.length === 0) errors.push('sources 至少 1 条（溯源要求，04 §2.4）');
  else {
    const srcs: SourceRef[] = sources.map((s) => {
      const sm = s as Record<string, unknown>;
      return {
        title: asString(sm.title) ?? '',
        url: asString(sm.url),
        ref: asString(sm.ref),
        license: asString(sm.license),
        edition: asString(sm.edition),
        fetched_at: asString(sm.fetched_at),
        fingerprint: asString(sm.fingerprint),
      };
    });
    if (srcs.some((s) => !s.title)) errors.push('sources 中存在空 title');
    (obj as Record<string, unknown>).sources = srcs;
  }

  const rev = asNumber(obj.rev);
  if (rev === undefined) { (obj as Record<string, unknown>).rev = 1; warnings.push('rev 缺失，默认 1'); }

  const value = {
    schema: asNumber(obj.schema) ?? 1,
    slug: slug!, title: title!, subtitle: asString(obj.subtitle),
    original_title: asString(obj.original_title),
    aliases: asStringArray(obj.aliases) ?? [],
    type: type!, categories: categories!, tags: asStringArray(obj.tags),
    summary: summary!, status: status!, confidence: confidence ?? 'auto',
    license: asString(obj.license) ?? 'unknown',
    ai_generated: Boolean(obj.ai_generated),
    ai_annotated: obj.ai_annotated === true ? true : undefined,
    created_at: asString(obj.created_at) ?? '1970-01-01',
    updated_at: asString(obj.updated_at) ?? '1970-01-01',
    rev: rev ?? 1,
    words: asNumber(obj.words),
    sources: (obj.sources as SourceRef[]) ?? [],
    see_also: asStringArray(obj.see_also),
    review_notes: asString(obj.review_notes),
    author: asString(obj.author), editor: asString(obj.editor),
    structure: obj.structure as EntryMeta['structure'],
    source_edition: obj.source_edition as EntryMeta['source_edition'],
    birth: asString(obj.birth), death: asString(obj.death),
    date: asString(obj.date), location: asString(obj.location),
    timeline: obj.timeline as EntryMeta['timeline'],
    sort_date: asNumber(obj.sort_date),
    order_mode: obj.order_mode as EntryMeta['order_mode'],
    level: asNumber(obj.level), school: asString(obj.school),
    requires: asStringArray(obj.requires),
  } as EntryMeta;

  return { value, errors, warnings };
}

const SECTION_KINDS: SectionKind[] = ['content', 'container'];

/** 校验并规范化 SectionMeta（chapters/*.md） */
export function validateSectionMeta(obj: Record<string, unknown>): ValidationResult<SectionMeta> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const slug = asString(obj.slug);
  if (!slug) errors.push('slug 缺失');
  const work = asString(obj.work);
  if (!work) errors.push('work 缺失');
  const key = asString(obj.key);
  if (!key) errors.push('key 缺失');
  const title = asString(obj.title);
  if (!title) errors.push('title 缺失');

  let order = obj.order;
  if (typeof order === 'string') {
    order = order.split('.').map((x) => Number(x)).filter((n) => !Number.isNaN(n));
    warnings.push('order 为字符串，已尝试按 "." 拆分');
  }
  if (!Array.isArray(order) || order.length === 0 || order.length > 3) {
    errors.push('order 必须为 1–3 长度数字数组（C6）');
  } else {
    obj.order = order;
    // 派生 orderKey 零填充（C6）
    (obj as Record<string, unknown>).orderKey = (order as number[])
      .map((n) => String(n).padStart(3, '0')).join('.');
  }

  const depth = asNumber(obj.depth);
  if (depth !== 1 && depth !== 2 && depth !== 3) errors.push('depth 必须为 1|2|3');

  const kind = (asString(obj.kind) as SectionKind | undefined) ?? 'content';
  if (!SECTION_KINDS.includes(kind)) errors.push(`kind "${kind}" 非法（应为 content|container）`);

  let summary: SectionSummary | undefined;
  if (obj.summary !== undefined && obj.summary !== null) {
    const sm = obj.summary as Record<string, unknown>;
    const tldr = asString(sm.tldr);
    if (!tldr) errors.push('section.summary.tldr 缺失（B7）');
    else if (tldr.length > TLDR_MAX) errors.push(`section.summary.tldr 超 ${TLDR_MAX} 字`);
    const kps = asStringArray(sm.keyPoints);
    if (kps) {
      if (kps.length > KEYPOINT_MAX_COUNT) warnings.push(`keyPoints 条数 > ${KEYPOINT_MAX_COUNT}`);
      if (kps.some((k) => k.length > KEYPOINT_MAX)) warnings.push(`keyPoints 存在 > ${KEYPOINT_MAX} 字条目`);
    }
    summary = { tldr: tldr ?? '', keyPoints: kps };
  }

  // container 不要求 summary（B7/L027）
  if (kind === 'container' && !summary) {
    // 允许
  } else if (!summary && kind === 'content') {
    warnings.push('content 章节缺少 section.summary（建议补 tldr）');
  }

  const value = {
    slug: slug!, work: work!, key: key!, title: title!,
    order: (obj.order as number[]) ?? [1],
    orderKey: asString(obj.orderKey),
    path: asStringArray(obj.path) ?? [],
    depth: (depth as 1 | 2 | 3) ?? 1,
    parent: asString(obj.parent),
    status: (asString(obj.status) as EntryMeta['status']) ?? 'published',
    license: asString(obj.license) ?? 'unknown',
    ai_generated: Boolean(obj.ai_generated),
    ai_annotated: obj.ai_annotated === true ? true : undefined,
    words: asNumber(obj.words),
    pages: asString(obj.pages),
    source_edition: asString(obj.source_edition),
    sources: (obj.sources as SourceRef[]) ?? [],
    file: asString(obj.file) ?? '',
    kind, summary,
  } as SectionMeta;

  return { value, errors, warnings };
}
