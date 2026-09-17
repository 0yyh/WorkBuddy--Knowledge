import { describe, it, expect } from 'vitest';
import { buildIndex, writeIndexFiles } from '../src/index/builder.js';
import { MemoryVfs } from '../src/vfs/memory.js';
import { fnv1a, shardOf } from '../src/util/fnv1a.js';
import { DF_BUCKET_COUNT } from '../src/constants.js';
import { decompressJson } from '../src/index.js';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeContentFiles(): Record<string, string> {
  return {
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
  };
}

function makeContentVfs(): MemoryVfs {
  return new MemoryVfs(makeContentFiles());
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

    // ① df 分片化：不再产出整表 df.json，改为 df/meta.json + 多个 df/bucket-NNN.json。
    expect(result.files['.index/search/df.json']).toBeUndefined();
    expect(result.files['.index/search/df/meta.json']).toBeDefined();
    const dfMeta = JSON.parse(result.files['.index/search/df/meta.json']) as {
      totalDocs: number;
      avgLen: number;
    };
    expect(dfMeta.totalDocs).toBe(3); // 3 indexing docs (foo entry+section, bar entry)

    // 至少存在一个非空 df 桶，且桶形状为 { n, df: Record<term, count> }。
    const bucketKeys = Object.keys(result.files).filter((k) => k.startsWith('.index/search/df/bucket-'));
    expect(bucketKeys.length).toBeGreaterThan(0);
    const sample = decompressJson<{ n: number; df: Record<string, number> }>(result.files[bucketKeys[0]]);
    expect(typeof sample.n).toBe('number');
    expect(Object.keys(sample.df).length).toBeGreaterThan(0);
    // 桶号与 term 哈希一致：桶内每个 term 的 dfBucketOf(term) === 该桶号。
    for (const term of Object.keys(sample.df)) {
      const bucket = (fnv1a(term) & (DF_BUCKET_COUNT - 1)) as number;
      expect(bucket).toBe(sample.n);
    }
  });

  it('P1-2 entries 按哈希分桶，落盘 manifest.entryShards 非空且文件名两位补零', () => {
    const vfs = makeContentVfs();
    const result = buildIndex(vfs);

    // 落盘 manifest 自带 entryShards（修复序列化顺序 bug：旧产物恒为 []）。
    const manifest = JSON.parse(result.files['.index/manifest.json']);
    expect(Array.isArray(manifest.entryShards)).toBe(true);
    expect(manifest.entryShards.length).toBeGreaterThan(0);
    // 每个分片名两位补零 00..3f（十六进制）。
    for (const name of manifest.entryShards) {
      expect(/^[0-9a-f]{2}$/.test(name)).toBe(true);
    }
    // 每个 entry 文件都存在，且文件名与 manifest 列的一致。
    for (const name of manifest.entryShards) {
      expect(result.files[`.index/entries/${name}.json`]).toBeDefined();
    }
    // 两个词条各自落入的分片可由 shardOf 复现，且都被 manifest 收录。
    const barBucket = String(shardOf('bar', 64)).padStart(2, '0');
    const fooBucket = String(shardOf('foo', 64)).padStart(2, '0');
    expect(manifest.entryShards).toContain(barBucket);
    expect(manifest.entryShards).toContain(fooBucket);
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

describe('buildIndex 增量构建（②）', () => {
  /** 用「内容文件 + 上次构建产物 + build-state」构造可增量构建的 Vfs。 */
  function seedVfs(files: Record<string, string>, built: ReturnType<typeof buildIndex>): MemoryVfs {
    return new MemoryVfs({
      ...files,
      ...built.files,
      '.pks-build-state.json': JSON.stringify(built.buildState),
    });
  }

  it('无内容变化 → 走增量且全部产物（除 manifest.built_at）字节一致', () => {
    const files = makeContentFiles();
    const full = buildIndex(new MemoryVfs(files));
    const inc = buildIndex(seedVfs(files, full), { incremental: true });

    expect(inc.incrementalUsed).toBe(true);
    expect(Object.keys(inc.files).sort()).toEqual(Object.keys(full.files).sort());
    for (const key of Object.keys(full.files)) {
      if (key === '.index/manifest.json') continue;
      expect(inc.files[key], `key=${key} 应字节一致`).toBe(full.files[key]);
    }
    const a = JSON.parse(full.files['.index/manifest.json']);
    const b = JSON.parse(inc.files['.index/manifest.json']);
    expect(b.stats).toEqual(a.stats);
    expect(b.search).toEqual(a.search);
  });

  it('仅改一个词条 → 只重建其 docs 命中的分片，其余分片字节不变', () => {
    const files = makeContentFiles();
    const full = buildIndex(new MemoryVfs(files));
    const fooShards = new Set(full.buildState.entries['foo'].shards);
    expect(fooShards.size).toBeGreaterThan(0);

    const changed: Record<string, string> = {
      ...files,
      'entries/foo/chapters/c1.md':
        files['entries/foo/chapters/c1.md'] + '\n新增一段关于价值与劳动的补充论述。\n',
    };
    const inc = buildIndex(seedVfs(changed, full), { incremental: true });
    expect(inc.incrementalUsed).toBe(true);

    let fooChanged = 0;
    for (const key of Object.keys(full.files)) {
      const m = key.match(/^\.index\/search\/s(\d{2})\.json$/);
      if (!m) continue;
      const s = Number(m[1]);
      const same = inc.files[key] === full.files[key];
      if (fooShards.has(s)) {
        if (!same) fooChanged++;
      } else {
        expect(same, `未涉及分片 s${m[1]} 应字节不变`).toBe(true);
      }
    }
    // 被改词条命中的分片至少有一个确实重建（内容变了）
    expect(fooChanged).toBeGreaterThan(0);
  });

  it('分区数 M 变化 → 回退全量', () => {
    const files = makeContentFiles();
    const full = buildIndex(new MemoryVfs(files));
    const tampered = { ...full.buildState, shardCount: 999 };
    const vfs = new MemoryVfs({
      ...files,
      ...full.files,
      '.pks-build-state.json': JSON.stringify(tampered),
    });
    const inc = buildIndex(vfs, { incremental: true });
    expect(inc.incrementalUsed).toBe(false);
  });

  it('缺旧 state → 全量，并产出可用 build-state', () => {
    const files = makeContentFiles();
    const inc = buildIndex(new MemoryVfs(files), { incremental: true });
    expect(inc.incrementalUsed).toBe(false);
    expect(inc.buildState.version).toBe(1);
    expect(Object.keys(inc.buildState.entries).sort()).toEqual(['bar', 'foo']);
  });

  it('删除一个词条 → 增量且被删词条消失、其旧分片变化、无关分片字节不变', () => {
    const files = makeContentFiles();
    const full = buildIndex(new MemoryVfs(files));
    expect(full.titleIndex.find((t) => t.slug === 'bar')).toBeDefined();

    // 仅删除 bar（移除其 entry 文件；track 仍引用 bar 不影响构建）
    const changed: Record<string, string> = {};
    for (const [k, v] of Object.entries(files)) {
      if (k === 'entries/bar/entry.md') continue;
      changed[k] = v;
    }
    const inc = buildIndex(seedVfs(changed, full), { incremental: true });
    expect(inc.incrementalUsed).toBe(true);

    // 被删词条从标题索引消失，foo 仍在
    expect(inc.titleIndex.find((t) => t.slug === 'bar')).toBeUndefined();
    expect(inc.titleIndex.find((t) => t.slug === 'foo')).toBeDefined();

    const barShards = new Set(full.buildState.entries['bar'].shards);
    const fooShards = new Set(full.buildState.entries['foo'].shards);

    let barChanged = 0;
    for (const key of Object.keys(full.files)) {
      const m = key.match(/^\.index\/search\/s(\d{2})\.json$/);
      if (!m) continue;
      const s = Number(m[1]);
      const same = inc.files[key] === full.files[key];
      if (barShards.has(s)) {
        if (!same) barChanged++;
      } else if (!fooShards.has(s)) {
        // 既不涉及 bar 也不涉及 foo 的分片必须字节级不变
        expect(same, `无关分片 s${m[1]} 应字节不变`).toBe(true);
      }
    }
    // 被删词条命中的分片至少有一个确实重建（其内容被移除）
    expect(barChanged).toBeGreaterThan(0);

    // build-state 不再登记已删词条
    expect(inc.buildState.entries['bar']).toBeUndefined();
  });
});
