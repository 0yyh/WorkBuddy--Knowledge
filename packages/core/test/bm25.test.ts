import { describe, it, expect } from 'vitest';
import { bm25Term } from '../src/index/bm25.js';

describe('bm25Term', () => {
  it('produces a positive finite number for a sane input', () => {
    const s = bm25Term(1, 100, 100, 1, 10);
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
  });

  it('increases score as term frequency increases', () => {
    const low = bm25Term(1, 100, 100, 1, 10);
    const high = bm25Term(5, 100, 100, 1, 10);
    expect(high).toBeGreaterThan(low);
  });

  it('decreases score as document length increases (length normalization)', () => {
    const short = bm25Term(3, 50, 100, 1, 10);
    const long = bm25Term(3, 500, 100, 1, 10);
    expect(long).toBeLessThan(short);
  });

  it('is finite and >= 0 for edge cases (df == totalDocs)', () => {
    const s = bm25Term(2, 80, 100, 10, 10);
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});
