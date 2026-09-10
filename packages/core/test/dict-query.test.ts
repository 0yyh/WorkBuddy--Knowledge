import { describe, it, expect } from 'vitest';
import { normalizeQuery, entryId, lookupDict, buildLookupTable } from '../src/dict/query.js';
import type { Dictionary, DictEntry } from '../src/dict/types.js';

const entry = (word: string): DictEntry => ({
  word,
  defs: [`${word} 的释义`],
  specialized: [],
});

const dict: Dictionary = {
  entries: {
    '资本论': entry('资本论'),
    'Well-Known': entry('Well-Known'),
    constructor: entry('constructor'),
  },
};

describe('normalizeQuery', () => {
  it('trims, lowercases and strips punctuation/whitespace', () => {
    expect(normalizeQuery('  马克思  ')).toBe('马克思');
    expect(normalizeQuery('Hello!')).toBe('hello');
    expect(normalizeQuery('（资本论）')).toBe('资本论');
    expect(normalizeQuery('well-known')).toBe('wellknown');
    expect(normalizeQuery('a b\tc')).toBe('abc');
  });

  it('converts fullwidth latin and digits to halfwidth', () => {
    expect(normalizeQuery('ＡＢＣ１２３')).toBe('abc123');
  });

  it('returns an empty string for punctuation-only input', () => {
    expect(normalizeQuery('《》！！！')).toBe('');
  });

  it('entryId is an alias of normalizeQuery', () => {
    expect(entryId('  《资本论》 ')).toBe(normalizeQuery('  《资本论》 '));
  });
});

describe('lookupDict', () => {
  it('finds a CJK headword with surrounding punctuation', () => {
    const r = lookupDict(dict, '（资本论）');
    expect(r.entry?.word).toBe('资本论');
    expect(r.word).toBe('资本论');
  });

  it('finds a latin headword case-insensitively', () => {
    const r = lookupDict(dict, 'well known');
    expect(r.entry?.word).toBe('Well-Known');
  });

  it('returns null for empty or punctuation-only selections', () => {
    expect(lookupDict(dict, '')).toEqual({ entry: null, word: '' });
    expect(lookupDict(dict, '！！！')).toEqual({ entry: null, word: '' });
  });

  it('returns null for a missing word', () => {
    expect(lookupDict(dict, '不存在的词')).toEqual({ entry: null, word: '' });
  });

  it('does not leak Object.prototype keys (regression)', () => {
    // 'constructor' 归一化后仍是 'constructor'，历史实现会命中 Object.prototype.constructor
    const bare: Dictionary = { entries: { '资本论': entry('资本论') } };
    expect(lookupDict(bare, 'constructor').entry).toBeNull();
    // 但词表里真的有该词时，必须命中
    expect(lookupDict(dict, 'constructor').entry?.word).toBe('constructor');
  });
});

describe('buildLookupTable', () => {
  it('maps both raw and normalized keys to entries', () => {
    const table = buildLookupTable(dict);
    expect(table.get('资本论')?.word).toBe('资本论');
    expect(table.get('wellknown')?.word).toBe('Well-Known');
    expect(table.get('Well-Known')?.word).toBe('Well-Known');
  });
});
