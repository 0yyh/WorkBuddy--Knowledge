/**
 * lint —— 内容规范校验（02 §9.5 / 08 报告）。M0 实现 8 条核心规则：
 * L001 slug 唯一 · L002 类目存在 · L003 章节≤20000字 · L004 tldr≤120
 * L005 cross_timeline 双维度 · L006 see_also 目标存在 · L007 section slug 唯一 · L008 published 有摘要
 */
import { NodeFsVfs } from '@pks/core/node';
import { loadSnapshot } from '@pks/core';
import type { TaxonomyNode } from '@pks/core';
import { SECTION_WORD_LIMIT, TLDR_MAX } from '@pks/core';

interface Issue { rule: string; severity: 'error' | 'warn'; message: string; }

function collectPaths(nodes: TaxonomyNode[], acc: Set<string>): void {
  for (const n of nodes) { acc.add(n.path); if (n.children) collectPaths(n.children, acc); }
}

export function lintCmd(contentDir: string): { issues: Issue[]; errorCount: number } {
  const vfs = new NodeFsVfs(contentDir);
  const { snapshot, errors, warnings } = loadSnapshot(vfs);
  const issues: Issue[] = [];

  for (const e of errors) issues.push({ rule: 'parse', severity: 'error', message: e });
  for (const w of warnings) issues.push({ rule: 'parse', severity: 'warn', message: w });

  const validPaths = new Set<string>();
  collectPaths(snapshot.taxonomy, validPaths);

  const slugSet = new Map<string, number>();
  const sectionSlugSet = new Map<string, number>();
  const allSlugs = new Set(snapshot.entries.map((e) => e.slug));

  for (const e of snapshot.entries) {
    slugSet.set(e.slug, (slugSet.get(e.slug) ?? 0) + 1);

    // L002 类目存在
    for (const c of e.categories) {
      if (!validPaths.has(c)) issues.push({ rule: 'L002', severity: 'error', message: `词条 ${e.slug} 类目不存在于 taxonomy：${c}` });
    }
    // L008 published 有摘要 80–300
    if (e.status === 'published') {
      if (!e.summary || e.summary.length < 80) issues.push({ rule: 'L008', severity: 'warn', message: `词条 ${e.slug} 摘要偏短（<80字）` });
      else if (e.summary.length > 300) issues.push({ rule: 'L008', severity: 'error', message: `词条 ${e.slug} 摘要超 300 字` });
    }
    // L006 see_also 目标存在
    for (const sa of e.see_also ?? []) {
      if (!allSlugs.has(sa)) issues.push({ rule: 'L006', severity: 'warn', message: `词条 ${e.slug} see_also 指向不存在的 slug：${sa}` });
    }

    const secs = snapshot.sections[e.slug] ?? [];
    for (const sec of secs) {
      sectionSlugSet.set(sec.slug, (sectionSlugSet.get(sec.slug) ?? 0) + 1);
      // L003 章节字数上限（仅 content）
      if (sec.kind !== 'container' && (sec.words ?? 0) > SECTION_WORD_LIMIT) {
        issues.push({ rule: 'L003', severity: 'error', message: `章节 ${sec.slug} 字数 ${sec.words} 超 ${SECTION_WORD_LIMIT}` });
      }
      // L004 tldr ≤120
      if (sec.summary && sec.summary.tldr.length > TLDR_MAX) {
        issues.push({ rule: 'L004', severity: 'error', message: `章节 ${sec.slug} tldr 超 ${TLDR_MAX} 字` });
      }
    }

    // L005 cross_timeline 双维度
    const cross = snapshot.tracks.some((t) => t.items.some((it) => it.cross_timeline && it.entry === e.slug));
    if (cross && (e.timeline?.length ?? 0) < 2) {
      issues.push({ rule: 'L005', severity: 'warn', message: `词条 ${e.slug} 标记 cross_timeline 但 timeline 维度 <2` });
    }
  }

  // L001 / L007 唯一性
  for (const [slug, n] of slugSet) if (n > 1) issues.push({ rule: 'L001', severity: 'error', message: `slug 重复：${slug}（${n} 次）` });
  for (const [slug, n] of sectionSlugSet) if (n > 1) issues.push({ rule: 'L007', severity: 'error', message: `section slug 重复：${slug}（${n} 次）` });

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  console.log(`🔍 lint 完成：${issues.length} 条（error ${errorCount} / warn ${issues.length - errorCount}）`);
  for (const i of issues) console.log(`   [${i.severity === 'error' ? '✗' : '!'} ${i.rule}] ${i.message}`);
  return { issues, errorCount };
}
