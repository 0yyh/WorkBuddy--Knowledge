import { describe, it, expect } from 'vitest';
import {
  createBundleZip,
  extractBundleZip,
  computeBundleChecksum,
  verifyBundleChecksum,
  type BundleInput,
} from '../src/merge/bundle.js';
import type { PackManifest } from '../src/types.js';

const input: BundleInput = {
  contentFiles: { 'entries/x/entry.md': '# X' },
  indexFiles: {
    'search/s00.json': '{"shard":0}',
    'search/s01.json': '{"shard":1}',
    'search/title.json': '[]',
  },
  pack: { level: 'seed' },
  scope: { type: 'all' },
  stats: { entries: 1, sections: 0, words: 3, bytes: 10 },
  base_snapshot: { x: { u: '2026-09-10', r: 1 } },
};

describe('createBundleZip / extractBundleZip', () => {
  it('round-trips content, index and bundle.json', () => {
    const files = extractBundleZip(createBundleZip(input));
    expect(files['content/entries/x/entry.md']).toBe('# X');
    expect(files['.index/search/s00.json']).toBe('{"shard":0}');
    expect(files['bundle.json']).toBeTruthy();
    expect(JSON.parse(files['feedback.json'])).toEqual({ schema: 1, items: [] });
  });

  it('writes a well-formed manifest with detected index shards', () => {
    const files = extractBundleZip(createBundleZip(input));
    const manifest = JSON.parse(files['bundle.json']) as PackManifest;
    expect(manifest.format).toBe('pks-bundle');
    expect(manifest.pack.level).toBe('seed');
    expect(manifest.scope.type).toBe('all');
    expect(manifest.index_shards).toEqual([0, 1]); // title.json 不计入
    expect(manifest.base_snapshot.x).toEqual({ u: '2026-09-10', r: 1 });
    expect(manifest.includes_userdata).toBe(false);
  });

  it('includes a custom feedback file when provided', () => {
    const files = extractBundleZip(
      createBundleZip({
        ...input,
        feedback: {
          schema: 1,
          items: [{ slug: 'x', type: 'typo', severity: 'low', created_at: '2026-09-10' }],
        },
      }),
    );
    expect(JSON.parse(files['feedback.json']).items).toHaveLength(1);
  });
});

describe('bundle checksum', () => {
  it('labels the digest as sha1 and verifies round-trip', () => {
    const files = extractBundleZip(createBundleZip(input));
    const manifest = JSON.parse(files['bundle.json']) as PackManifest;
    expect(manifest.checksum.startsWith('sha1:')).toBe(true);
    expect(verifyBundleChecksum(manifest)).toBe(true);
  });

  it('is stable across recomputation', () => {
    const files = extractBundleZip(createBundleZip(input));
    const manifest = JSON.parse(files['bundle.json']) as PackManifest;
    expect(computeBundleChecksum(manifest)).toBe(manifest.checksum);
  });

  it('detects tampering', () => {
    const files = extractBundleZip(createBundleZip(input));
    const manifest = JSON.parse(files['bundle.json']) as PackManifest;
    const tampered: PackManifest = {
      ...manifest,
      stats: { ...manifest.stats, words: 999 },
    };
    expect(verifyBundleChecksum(tampered)).toBe(false);
  });
});
