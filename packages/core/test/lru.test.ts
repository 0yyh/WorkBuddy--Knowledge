import { describe, it, expect } from 'vitest';
import { LRUCache } from '../src/util/lru.js';

describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const lru = new LRUCache<string, number>(3);
    lru.set('a', 1);
    expect(lru.get('a')).toBe(1);
    expect(lru.get('missing')).toBeUndefined();
    expect(lru.size).toBe(1);
  });

  it('evicts the least-recently-used entry when over capacity', () => {
    const lru = new LRUCache<string, number>(2);
    lru.set('a', 1);
    lru.set('b', 2);
    lru.set('c', 3); // 触发淘汰 a
    expect(lru.has('a')).toBe(false);
    expect(lru.get('b')).toBe(2);
    expect(lru.get('c')).toBe(3);
    expect(lru.size).toBe(2);
  });

  it('get() promotes an entry to most-recently-used', () => {
    const lru = new LRUCache<string, number>(2);
    lru.set('a', 1);
    lru.set('b', 2);
    lru.get('a'); // a 变最新
    lru.set('c', 3); // 淘汰最旧的 b
    expect(lru.has('a')).toBe(true);
    expect(lru.has('b')).toBe(false);
  });

  it('re-setting an existing key updates value and refreshes recency', () => {
    const lru = new LRUCache<string, number>(2);
    lru.set('a', 1);
    lru.set('b', 2);
    lru.set('a', 10);
    expect(lru.get('a')).toBe(10);
    expect(lru.size).toBe(2);
  });

  it('delete() removes a key and reports whether it existed', () => {
    const lru = new LRUCache<string, number>(3);
    lru.set('a', 1);
    expect(lru.delete('a')).toBe(true);
    expect(lru.delete('a')).toBe(false);
    expect(lru.size).toBe(0);
  });

  describe('evictable', () => {
    it('returns keys oldest-first without removing them', () => {
      const lru = new LRUCache<string, number>(3);
      lru.set('a', 1);
      lru.set('b', 2);
      lru.set('c', 3);
      expect(lru.evictable(2)).toEqual(['a', 'b']);
      // 未删除，容量不变
      expect(lru.size).toBe(3);
      expect(lru.has('a')).toBe(true);
    });

    it('clamps count to [0, size]', () => {
      const lru = new LRUCache<string, number>(3);
      lru.set('a', 1);
      expect(lru.evictable(0)).toEqual([]);
      expect(lru.evictable(-5)).toEqual([]);
      expect(lru.evictable(99)).toEqual(['a']);
    });

    it('respects recency order after get()', () => {
      const lru = new LRUCache<string, number>(3);
      lru.set('a', 1);
      lru.set('b', 2);
      lru.set('c', 3);
      lru.get('a'); // a 变最新，b 变最旧
      expect(lru.evictable(1)).toEqual(['b']);
    });
  });

  it('clear() empties the cache', () => {
    const lru = new LRUCache<string, number>(3);
    lru.set('a', 1);
    lru.set('b', 2);
    lru.clear();
    expect(lru.size).toBe(0);
    expect(lru.get('a')).toBeUndefined();
  });
});
