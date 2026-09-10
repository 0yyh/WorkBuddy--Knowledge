import { describe, it, expect } from 'vitest';
import { chooseShardCount, assignShard } from '../src/index/shards.js';
import { shardOf } from '../src/util/fnv1a.js';

describe('chooseShardCount', () => {
  it('returns 16 below the 3M threshold (default)', () => {
    expect(chooseShardCount(0)).toBe(16);
    expect(chooseShardCount(100)).toBe(16);
    expect(chooseShardCount(2_999_999)).toBe(16);
  });

  it('returns 64 at/above the 3M threshold', () => {
    expect(chooseShardCount(3_000_000)).toBe(64);
    expect(chooseShardCount(9_999_999)).toBe(64);
  });

  it('returns 256 at/above the 10M threshold', () => {
    expect(chooseShardCount(10_000_000)).toBe(256);
    expect(chooseShardCount(50_000_000)).toBe(256);
  });
});

describe('assignShard', () => {
  it('is deterministic for the same key and m', () => {
    expect(assignShard('foo/bar', 16)).toBe(assignShard('foo/bar', 16));
  });

  it('is always within [0, m)', () => {
    for (const m of [16, 64, 256]) {
      const s = assignShard('马克思主义/资本论', m);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(m);
    }
  });

  it('is equivalent to shardOf(key, m)', () => {
    expect(assignShard('capital', 16)).toBe(shardOf('capital', 16));
  });
});
