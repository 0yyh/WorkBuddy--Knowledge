/**
 * lint 规则单测（R4 #427）。
 * 聚焦 L010「sources 可核验引用」：默认关闭（citations=false），开启（citations=true）时
 * 聚合每条词条一行 warn，且 url/doi/isbn/ref 任一即视为可核验。覆盖 entry 与章节两级 sources。
 *
 * 直接测 `lintEntryRules`（被 lintCmd 全量与 lintEntryDir 单条目共用），避免触碰真实 content/。
 */
import { describe, expect, it } from 'vitest';
import { lintEntryRules } from '../src/commands/lint.js';
import type { ContentSnapshot, Entry, SectionMeta, SourceRef } from '@pks/core';

const VALID_PATH = '根/概念';
const validPaths = new Set([VALID_PATH]);
const allSlugs = new Set(['sample-entry']);
const tracks: ContentSnapshot['tracks'] = [];
const emptySecs: SectionMeta[] = [];

/** 一个 lint 除 L010 外全绿的词条（published + 摘要 ≥80 字 + 类目合法）。 */
function makeEntry(sources: SourceRef[]): Entry {
  return {
    schema: 1,
    slug: 'sample-entry',
    title: '示例词条',
    type: 'concept',
    categories: [VALID_PATH],
    summary:
      '这是一段用于事实核查 lint 测试的固定示例摘要内容，长度被刻意控制在八十到三百字之间以满足 L008 的 published 摘要校验要求，从而让测试词条一次性通过除 L010 外的全部规则而不需要额外处理。',
    status: 'published',
    confidence: 'medium',
    license: 'CC-BY-SA-4.0',
    ai_generated: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    rev: 1,
    sources,
    dirPath: 'entries/sample-entry',
    entryFile: 'entry.md',
    sectionCount: 0,
    hasSections: false,
  };
}

describe('lint L010 citations (R4)', () => {
  it('默认关闭 citations：缺可核验引用的 sources 不产生 L010', () => {
    const entry = makeEntry([{ title: '仅有标题' }]);
    const issues = lintEntryRules(entry, emptySecs, validPaths, allSlugs, tracks, false);
    expect(issues.find((i) => i.rule === 'L010')).toBeUndefined();
  });

  it('开启 citations 且 entry sources 全部缺引用：产生 L010 warn（聚合行）', () => {
    const entry = makeEntry([{ title: '仅有标题' }, { title: '另一无引用' }]);
    const issues = lintEntryRules(entry, emptySecs, validPaths, allSlugs, tracks, true);
    const l010 = issues.find((i) => i.rule === 'L010');
    expect(l010).toBeDefined();
    expect(l010?.severity).toBe('warn');
    expect(l010?.message).toContain('2 条 sources');
  });

  it('开启 citations 且所有 sources 均有 url：不产生 L010', () => {
    const entry = makeEntry([{ title: '有 url', url: 'https://example.com/a' }]);
    const issues = lintEntryRules(entry, emptySecs, validPaths, allSlugs, tracks, true);
    expect(issues.find((i) => i.rule === 'L010')).toBeUndefined();
  });

  it('开启 citations：doi / isbn / ref 任一即视为可核验', () => {
    const entry = makeEntry([
      { title: '有 doi', doi: '10.1234/abc' },
      { title: '有 isbn', isbn: '978-3-16-148410-0' },
      { title: '有 ref', ref: 'entry://other/ch-01' },
    ]);
    const issues = lintEntryRules(entry, emptySecs, validPaths, allSlugs, tracks, true);
    expect(issues.find((i) => i.rule === 'L010')).toBeUndefined();
  });

  it('开启 citations：章节 sources 缺引用也计入聚合', () => {
    const entry = makeEntry([{ title: '有 url', url: 'https://example.com/a' }]);
    const secs: SectionMeta[] = [
      {
        slug: 'sample-entry/ch-01',
        work: 'sample-entry',
        key: 'ch-01',
        title: '第一章',
        order: [1],
        path: ['sample-entry'],
        depth: 1,
        status: 'published',
        license: 'CC-BY-SA-4.0',
        ai_generated: true,
        sources: [{ title: '章节无引用' }],
        file: 'chapters/ch-01.md',
      },
    ];
    const issues = lintEntryRules(entry, secs, validPaths, allSlugs, tracks, true);
    const l010 = issues.find((i) => i.rule === 'L010');
    expect(l010).toBeDefined();
    expect(l010?.message).toContain('1 条 sources');
  });
});
