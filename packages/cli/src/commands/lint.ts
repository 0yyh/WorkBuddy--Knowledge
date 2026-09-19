/**
 * lint —— 内容规范校验（02 §9.5 / 08 报告）。M0 实现 8 条核心规则：
 * L001 slug 唯一 · L002 类目存在 · L003 章节≤20000字 · L004 tldr≤120
 * L005 cross_timeline 双维度 · L006 see_also 目标存在 · L007 section slug 唯一 · L008 published 有摘要
 * L009 每文件单一 PKS_EXPANDED_V5 标记（约定层，全局双标记审计收口后强制）
 *
 * 复用：核心规则抽成 `lintEntryRules`，被 `lintCmd`（全量）与 `lintEntryDir`（单条目，T03 生成回路）共用，
 * 不重复造轮子。
 */
import { NodeFsVfs } from '@pks/core/node';
import { loadSnapshot } from '@pks/core';
import type { TaxonomyNode, ContentSnapshot, Entry, SectionMeta, Vfs } from '@pks/core';
import { SECTION_WORD_LIMIT, TLDR_MAX } from '@pks/core';

export interface Issue {
  rule: string;
  severity: 'error' | 'warn';
  message: string;
}

function collectPaths(nodes: TaxonomyNode[], acc: Set<string>): void {
  for (const n of nodes) {
    acc.add(n.path);
    if (n.children) collectPaths(n.children, acc);
  }
}

/**
 * 单条词条的 8 规则校验（L002/L003/L004/L005/L006/L008）。
 * 供 lintCmd 全量与 lintEntryDir 单条目复用。
 */
/**
 * L009 —— 每文件（entry.md 与其 chapters/*.md）必须含有且仅有一个规范的
 * `<!-- PKS_EXPANDED_V5 -->` 标记（02 §9.5 约定层；全局双标记审计收口后强制）。
 * 避免出现：缺标记（MISSING）、残留旧版本（V1~V4/V6）、多重标记（MULTI）、
 * 双重注释包裹（DOUBLE）或裸 token（未包在 <!-- --> 内）。
 *
 * `lintMarkerText` 是纯函数（便于单测，不依赖 vfs）；`lintMarkerRule` 走 vfs 读取原始文件，
 * 被 `lintCmd`（全量）与 `lintEntryDir`（单条目）共用。
 */

const MARKER_COMMENT_RE = /<!--\s*PKS_EXPANDED_V(\d+)\s*-->/g;
const MARKER_BARE_RE = /PKS_EXPANDED_V\d+/;
const MARKER_DOUBLE_RE = /<!--\s*<!--[\s\S]*?PKS_EXPANDED_V\d+[\s\S]*?-->\s*-->/;
const MARKER_ANY_COMMENT_RE = /<!--[\s\S]*?-->/g;

export function lintMarkerText(text: string, label: string): string[] {
  const problems: string[] = [];
  const doubleWrap = MARKER_DOUBLE_RE.test(text);
  if (doubleWrap) problems.push(`${label} 标记被双重注释包裹（double-wrapped）`);
  const commented = [...text.matchAll(MARKER_COMMENT_RE)].map((m) => m[1]);
  const withoutComments = text.replace(MARKER_ANY_COMMENT_RE, '');
  const hasBare = MARKER_BARE_RE.test(withoutComments);
  if (hasBare) {
    problems.push(`${label} 存在裸 PKS_EXPANDED 标记（未包在 <!-- --> 内）`);
  }
  if (commented.length === 0 && !doubleWrap && !hasBare) {
    problems.push(`${label} 缺少 PKS_EXPANDED 标记`);
  }
  if (commented.length > 1) {
    problems.push(`${label} 存在多个标记（${commented.length} 个）`);
  }
  const wrong = commented.filter((v) => v !== '5');
  if (wrong.length > 0) {
    problems.push(`${label} 标记版本错误：V${wrong.join('/')}（应为 V5）`);
  }
  return problems;
}

export function lintMarkerRule(vfs: Vfs, slug: string): Issue[] {
  const issues: Issue[] = [];
  const entryPath = `entries/${slug}/entry.md`;
  if (vfs.exists(entryPath)) {
    for (const p of lintMarkerText(vfs.readText(entryPath), `词条 ${slug} entry.md`)) {
      issues.push({ rule: 'L009', severity: 'error', message: p });
    }
  }
  const chDir = `entries/${slug}/chapters`;
  if (vfs.exists(chDir)) {
    for (const name of vfs.listDir(chDir)) {
      if (!name.endsWith('.md')) continue;
      const text = vfs.readText(`${chDir}/${name}`);
      for (const p of lintMarkerText(text, `词条 ${slug} chapters/${name}`)) {
        issues.push({ rule: 'L009', severity: 'error', message: p });
      }
    }
  }
  return issues;
}

export function lintEntryRules(
  entry: Entry,
  secs: SectionMeta[],
  validPaths: Set<string>,
  allSlugs: Set<string>,
  tracks: ContentSnapshot['tracks'],
): Issue[] {
  const issues: Issue[] = [];
  for (const c of entry.categories) {
    if (!validPaths.has(c)) {
      issues.push({ rule: 'L002', severity: 'error', message: `词条 ${entry.slug} 类目不存在于 taxonomy：${c}` });
    }
  }
  if (entry.status === 'published') {
    if (!entry.summary || entry.summary.length < 80) {
      issues.push({ rule: 'L008', severity: 'warn', message: `词条 ${entry.slug} 摘要偏短（<80字）` });
    } else if (entry.summary.length > 300) {
      issues.push({ rule: 'L008', severity: 'error', message: `词条 ${entry.slug} 摘要超 300 字` });
    }
  }
  for (const sa of entry.see_also ?? []) {
    if (!allSlugs.has(sa)) {
      issues.push({ rule: 'L006', severity: 'warn', message: `词条 ${entry.slug} see_also 指向不存在的 slug：${sa}` });
    }
  }
  for (const sec of secs) {
    if (sec.kind !== 'container' && (sec.words ?? 0) > SECTION_WORD_LIMIT) {
      issues.push({ rule: 'L003', severity: 'error', message: `章节 ${sec.slug} 字数 ${sec.words} 超 ${SECTION_WORD_LIMIT}` });
    }
    if (sec.summary && sec.summary.tldr.length > TLDR_MAX) {
      issues.push({ rule: 'L004', severity: 'error', message: `章节 ${sec.slug} tldr 超 ${TLDR_MAX} 字` });
    }
  }
  const cross = tracks.some((t) => t.items.some((it) => it.cross_timeline && it.entry === entry.slug));
  if (cross && (entry.timeline?.length ?? 0) < 2) {
    issues.push({ rule: 'L005', severity: 'warn', message: `词条 ${entry.slug} 标记 cross_timeline 但 timeline 维度 <2` });
  }
  return issues;
}

export function lintCmd(contentDir: string): { issues: Issue[]; errorCount: number } {
  const vfs = new NodeFsVfs(contentDir);
  const { snapshot, errors, warnings } = loadSnapshot(vfs);
  const issues: Issue[] = [];

  for (const e of errors) issues.push({ rule: 'parse', severity: 'error', message: e });
  for (const w of warnings) issues.push({ rule: 'parse', severity: 'warn', message: w });

  const validPaths = new Set<string>();
  collectPaths(snapshot.taxonomy, validPaths);
  const allSlugs = new Set(snapshot.entries.map((e) => e.slug));

  for (const e of snapshot.entries) {
    issues.push(...lintEntryRules(e, snapshot.sections[e.slug] ?? [], validPaths, allSlugs, snapshot.tracks));
    issues.push(...lintMarkerRule(vfs, e.slug));
  }

  // L001 / L007 唯一性（全局）
  const slugSet = new Map<string, number>();
  const sectionSlugSet = new Map<string, number>();
  for (const e of snapshot.entries) {
    slugSet.set(e.slug, (slugSet.get(e.slug) ?? 0) + 1);
    for (const sec of snapshot.sections[e.slug] ?? []) {
      sectionSlugSet.set(sec.slug, (sectionSlugSet.get(sec.slug) ?? 0) + 1);
    }
  }
  for (const [slug, n] of slugSet) {
    if (n > 1) issues.push({ rule: 'L001', severity: 'error', message: `slug 重复：${slug}（${n} 次）` });
  }
  for (const [slug, n] of sectionSlugSet) {
    if (n > 1) issues.push({ rule: 'L007', severity: 'error', message: `section slug 重复：${slug}（${n} 次）` });
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  console.log(`🔍 lint 完成：${issues.length} 条（error ${errorCount} / warn ${issues.length - errorCount}）`);
  for (const i of issues) console.log(`   [${i.severity === 'error' ? '✗' : '!'} ${i.rule}] ${i.message}`);
  return { issues, errorCount };
}

/**
 * 单条目 lint（T03 生成回路用）。接收一个 Vfs（通常由 stagingEntryVfs 构造，把 entries/{slug} 映射到
 * .staging/{slug}），复用 loadSnapshot 取 taxonomy validPaths + allSlugs，对该 slug 跑
 * L002/L003/L004/L005/L006/L008 以及 validateEntryMeta/validateSectionMeta 的致命错误
 * （loadSnapshot 的 errors 已含这些致命错误）。返回 { issues, errorCount }。
 */
export function lintEntryDir(vfs: Vfs, slug: string): { issues: Issue[]; errorCount: number } {
  const { snapshot, errors } = loadSnapshot(vfs);
  const issues: Issue[] = [];

  // validateEntryMeta / validateSectionMeta 致命错误（来自 loadSnapshot 的 errors），按目标 slug 过滤
  for (const e of errors) {
    if (e.includes(`词条 ${slug}`) || e.includes(`章节 ${slug}/`)) {
      issues.push({ rule: 'validate', severity: 'error', message: e });
    }
  }

  const entry = snapshot.entries.find((e) => e.slug === slug);
  if (!entry) {
    issues.push({ rule: 'validate', severity: 'error', message: `lintEntryDir: 在 vfs 中未找到条目 ${slug}` });
    return { issues, errorCount: issues.length };
  }

  const validPaths = new Set<string>();
  collectPaths(snapshot.taxonomy, validPaths);
  const allSlugs = new Set(snapshot.entries.map((e) => e.slug));
  issues.push(...lintEntryRules(entry, snapshot.sections[slug] ?? [], validPaths, allSlugs, snapshot.tracks));
  issues.push(...lintMarkerRule(vfs, slug));

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  if (errorCount > 0) {
    console.log(`   lintEntryDir(${slug}): ${errorCount} 个 error`);
    for (const i of issues.filter((x) => x.severity === 'error')) {
      console.log(`     [✗ ${i.rule}] ${i.message}`);
    }
  }
  return { issues, errorCount };
}
