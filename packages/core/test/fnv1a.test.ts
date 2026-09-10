import { describe, it, expect } from 'vitest';
import { fnv1a, shardOf } from '../src/util/fnv1a.js';

describe('fnv1a', () => {
  it('is deterministic for the same input', () => {
    expect(fnv1a('hello')).toBe(fnv1a('hello'));
    expect(fnv1a('马克思主义')).toBe(fnv1a('马克思主义'));
  });

  it('returns different hashes for different inputs', () => {
    expect(fnv1a('a')).not.toBe(fnv1a('b'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = fnv1a('some-long-string-with-lots-of-chars-12345');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('shardOf', () => {
  it('stays within [0, m)', () => {
    for (const m of [16, 64, 256]) {
      for (const key of ['a', 'foo/bar', '马克思主义', 'Capital', 'key-123']) {
        const s = shardOf(key, m);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThan(m);
      }
    }
  });

  it('is deterministic for the same key and shard count', () => {
    expect(shardOf('foo', 16)).toBe(shardOf('foo', 16));
  });

  it('distributes reasonably evenly across 16 shards', () => {
    const m = 16;
    const counts = new Array(m).fill(0);
    for (let i = 0; i < 1000; i++) counts[shardOf(`key-${i}`, m)]++;
    // No shard should be empty, and the max should not be wildly above average.
    const avg = 1000 / m;
    for (const c of counts) expect(c).toBeGreaterThan(0);
    const max = Math.max(...counts);
    expect(max).toBeLessThanOrEqual(3 * avg);
  });
});
