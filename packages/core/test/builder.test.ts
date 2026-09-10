import { describe, it, expect } from 'vitest';
import { buildIndex, writeIndexFiles } from '../src/index/builder.js';
import { MemoryVfs } from '../src/vfs/memory.js';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeContentVfs(): MemoryVfs {
  return new MemoryVfs({
    'taxonomy.yaml': `- id: philosophy
  title: Philosophy
  order: 1
`,
    'entries/foo/entry.md': `---
slug: foo
title: Foo Concept
type: concept
categories: [Philosophy]
summary: This summary is deliberately written to exceed the eighty character minimum so that validation passes without a warning about being too short for the field.
status: published
sources:
  - title: Stanford Encyclopedia
    url: https://plato.stanford.edu
aliases: [Bar, Baz]
---
# Foo Concept
Some body text discussing capital and labor and surplus value in detail here.
`,
    'entries/foo/chapters/c1.md': `---
slug: foo/c1
work: foo
key: c1
title: Chapter One
order: [1]
depth: 1
kind: content
summary:
  tldr: This tldr explains the first chapter and its main argument about value and labor in a concise way.
---
# Chapter One
Body text about surplus value and exploitation and the extraction of surplus from labor.
`,
    'entries/bar/entry.md': `---
slug: bar
title: Bar Work
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
    'tracks/seq.yaml': `id: seq1
title: Sequence One
category: Philosophy
order_mode: chronological
items:
  - order: "1"
    entry: foo
  - order: "2"
    entry: bar
`,
  });
}

describe('buildIndex', () => {
  it('produces manifest, titleIndex and non-empty shards from a tiny content tree', () => {
    const vfs = makeContentVfs();
    const result = buildIndex(vfs);

    // No fatal errors during the build.
    expect(result.errors).toEqual([]);

    // Manifest stats.
    expect(result.manifest.stats.entries).toBe(2);
    expect(result.manifest.stats.sections).toBe(1);
    expect(result.manifest.search.shards).toBe(16); // tiny corpus -> default 16

    // Title index contains both published entries.
    expect(result.titleIndex).toHaveLength(2);
    const slugs = result.titleIndex.map((t) => t.slug).sort();
    expect(slugs).toEqual(['bar', 'foo']);

    // Shards: 16 total, with 3 indexing docs distributed across them.
    expect(result.shards).toHaveLength(16);
    const totalDocs = result.shards.reduce((a, s) => a + s.docs.length, 0);
    expect(totalDocs).toBe(3);
    const nonEmpty = result.shards.filter((s) => s.docs.length > 0);
    expect(nonEmpty.length).toBeGreaterThan(0);

    // Files map contains the expected products.
    expect(result.files['.index/manifest.json']).toBeDefined();
    expect(result.files['.index/search/title.json']).toBeDefined();
  });

  it('writes index files to a temp directory', () => {
    const vfs = makeContentVfs();
    const result = buildIndex(vfs);
    const dir = mkdtempSync(join(tmpdir(), 'pks-builder-'));
    try {
      writeIndexFiles(dir, result.files);
      expect(existsSync(join(dir, '.index', 'manifest.json'))).toBe(true);
      const manifest = JSON.parse(readFileSync(join(dir, '.index', 'manifest.json'), 'utf8'));
      expect(manifest.stats.entries).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
