import { describe, it, expect } from 'vitest';
import { tokenize, termFrequencies } from '../src/index/tokenizer.js';

describe('tokenize', () => {
  it('returns empty array for empty/blank input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });

  it('produces adjacent bigrams for a CJK string', () => {
    // 马克思主义 -> 4 chars -> 4 bigrams
    expect(tokenize('马克思主义')).toEqual(['马克', '克思', '思主', '主义']);
  });

  it('keeps a single CJK character as one token', () => {
    expect(tokenize('中')).toEqual(['中']);
  });

  it('tokenizes latin words lowercased and ignores punctuation', () => {
    expect(tokenize('Hello, World!')).toEqual(['hello', 'world']);
  });

  it('tokenizes mixed CJK + latin text in the right space', () => {
    const toks = tokenize('资本 Capital 论 Theory');
    expect(toks).toContain('资本');
    expect(toks).toContain('capital');
    expect(toks).toContain('theory');
  });
});

describe('termFrequencies', () => {
  it('counts token frequencies correctly for a string', () => {
    const tf = termFrequencies('capital Capital labor capital');
    expect(tf.get('capital')).toBe(3);
    expect(tf.get('labor')).toBe(1);
    expect(tf.size).toBe(2);
  });

  it('returns an empty map for empty input', () => {
    expect(termFrequencies('')).toEqual(new Map());
  });

  it('counts CJK bigrams', () => {
    const tf = termFrequencies('马克思主义');
    expect(tf.get('马克')).toBe(1);
    expect(tf.get('主义')).toBe(1);
    expect(tf.size).toBe(4);
  });
});
