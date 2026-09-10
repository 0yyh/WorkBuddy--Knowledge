import { describe, it, expect } from 'vitest';
import { buildIndex } from '../src/index/builder.js';
import { getEntryCover, parseEntryCover } from '../src/content/repository.js';
import { MemoryVfs } from '../src/vfs/memory.js';

function makeContentVfs(): MemoryVfs {
  return new MemoryVfs({
    'taxonomy.yaml': `- id: philosophy
  title: Philosophy
  order: 1
`,
    'entries/foo/entry.md': `---
slug: foo
title: Foo Concept
subtitle: A modern reading
type: concept
categories: [Philosophy]
tags: [theory, value]
summary: This summary is deliberately written to exceed the eighty character minimum so that validation passes without a warning about being too short for the field.
status: published
sources:
  - title: Stanford Encyclopedia
    url: https://plato.stanford.edu
see_also: [bar, missing-entry]
---
# Foo Concept
Some body text discussing capital and labor and surplus value in detail here.
`,
    'entries/bar/entry.md': `---
slug: bar
title: Bar Work
original_title: Das Original
type: work
categories: [Philosophy]
summary: Another sufficiently long summary describing the work and its historical context and significance within the broader philosophical tradition over time.
status: published
sources:
  - title: Wikipedia
    url: https://en.wikipedia.org
---
# Bar Work
Body text about the work and its contributions to theory and practice in economics.
`,
  });
}

describe('covers', () => {
  it('buildIndex emits .index/covers/{slug}.json for every entry', () => {
    const result = buildIndex(makeContentVfs());
    expect(result.files['.index/covers/foo.json']).toBeDefined();
    expect(result.files['.index/covers/bar.json']).toBeDefined();

    const cover = parseEntryCover(JSON.parse(result.files['.index/covers/foo.json']) as unknown);
    expect(cover.slug).toBe('foo');
    expect(cover.title).toBe('Foo Concept');
    expect(cover.subtitle).toBe('A modern reading');
    expect(cover.categories).toEqual(['Philosophy']);
    expect(cover.tags).toContain('value');
    expect(cover.word_count).toBeGreaterThan(0);
    expect(cover.chapter_count).toBe(0);
    // see_also 中存在的 slug 进入 related；缺失的剔除
    expect(cover.related).toEqual(['bar']);
  });

  it('getEntryCover reads a cover back from a Vfs built from result.files', () => {
    const result = buildIndex(makeContentVfs());
    const idxVfs = new MemoryVfs(result.files);
    const cover = getEntryCover(idxVfs, 'foo');
    expect(cover).not.toBeNull();
    expect(cover?.title).toBe('Foo Concept');
    expect(cover?.word_count).toBeGreaterThan(0);
    expect(getEntryCover(idxVfs, 'nope')).toBeNull();
  });

  it('parseEntryCover rejects malformed payloads', () => {
    expect(() => parseEntryCover(null)).toThrow();
    expect(() => parseEntryCover({})).toThrow();
    expect(() => parseEntryCover({ slug: 'x' })).toThrow();
    // 合法数据缺少可选字段时不抛错，回退默认
    const ok = parseEntryCover({ slug: 'x', title: 'X' });
    expect(ok.summary).toBe('');
    expect(ok.tags).toEqual([]);
    expect(ok.chapter_count).toBe(0);
  });
});
