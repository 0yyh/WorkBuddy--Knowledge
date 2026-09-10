import { describe, it, expect } from 'vitest';
import {
  normalizeQuery,
  entryId,
  lookupDict,
  parseDictionary,
  buildLookupTable,
  serializeDictionary,
} from '../src/dict/index.js';

// 一组内联样例（结构对齐 content/dict/dictionary.json）
const SAMPLE: Record<string, unknown> = {
  version: '1.0.0',
  built_at: '2026-09-10T00:00:00.000Z',
  count: 4,
  source: 'PKS 内置词典',
  description: '测试样例',
  entries: {
    剩余价值: {
      word: '剩余价值', pinyin: 'shèng yú jià zhí', pos: 'n.',
      defs: ['超出成本、被无偿占有的那部分价值增量。'],
      specialized: [
        { field: '马克思主义', defs: ['雇佣工人在剩余劳动时间内创造、被资本家无偿占有的价值。'] },
      ],
      source: 'PKS 内置专业词典',
    },
    辩证法: {
      word: '辩证法', pinyin: 'biàn zhèng fǎ', pos: 'n.',
      defs: ['关于对立统一和变化发展的思维方法。'],
      specialized: [
        { field: '哲学', defs: ['马克思主义唯物辩证法以对立统一为核心规律。'] },
      ],
      source: 'PKS 内置专业词典',
    },
    闻人: {
      word: '闻人', pinyin: 'wén rén', pos: 'n.',
      defs: ['有名望的人。', '复姓。'],
      specialized: [],
      source: 'PKS 内置汉语词典',
    },
    Dialectic: {
      word: 'Dialectic', ipa: '/ˌdaɪəˈlektɪk/', pos: 'n.',
      defs: ['dialectics considered as a method.'],
      specialized: [],
    },
  },
};

describe('dict parseDictionary', () => {
  it('parses a valid dictionary and reconciles key==word', () => {
    const v = parseDictionary(SAMPLE);
    expect(v.errors).toEqual([]);
    expect(v.value).toBeDefined();
    expect(Object.keys(v.value!.entries)).toEqual(['剩余价值', '辩证法', '闻人', 'Dialectic']);
  });

  it('rejects malformed payloads (missing entries / empty defs)', () => {
    expect(parseDictionary({}).errors.length).toBeGreaterThan(0);
    expect(parseDictionary({ entries: { x: { word: 'x', defs: [] } } }).errors.length).toBeGreaterThan(0);
  });
});

describe('dict query (content schema)', () => {
  it('lookup hits by word and strips whitespace/full-width/punct', () => {
    const { value: dict } = parseDictionary(SAMPLE);
    expect(lookupDict(dict!, '剩余价值').entry?.specialized[0]?.field).toBe('马克思主义');
    expect(lookupDict(dict!, '　剩余价值、').entry?.word).toBe('剩余价值');
    expect(lookupDict(dict!, '《辩证法》').entry?.word).toBe('辩证法');
  });

  it('handles mixed-case / english token via normalized key map', () => {
    const { value: dict } = parseDictionary(SAMPLE);
    expect(lookupDict(dict!, 'dialectic').entry?.word).toBe('Dialectic');
    expect(lookupDict(dict!, 'DIALECTIC').entry?.word).toBe('Dialectic');
  });

  it('misses unknown and empty input', () => {
    const { value: dict } = parseDictionary(SAMPLE);
    expect(lookupDict(dict!, '唯物主义').entry).toBeNull();
    expect(lookupDict(dict!, '').entry).toBeNull();
    expect(lookupDict(dict!, '剩余价值的全部内容都不该命中').entry).toBeNull();
  });

  it('buildLookupTable works for repeated lookups', () => {
    const { value: dict } = parseDictionary(SAMPLE);
    const t = buildLookupTable(dict!);
    expect(t.get('闻人')?.word).toBe('闻人');
    expect(t.get('dialectic')?.word).toBe('Dialectic');
  });

  it('defs is string[] and specialized separate — reflects content schema', () => {
    const { value: dict } = parseDictionary(SAMPLE);
    const s = lookupDict(dict!, '闻人').entry!;
    expect(Array.isArray(s.defs)).toBe(true);
    expect(s.defs).toEqual(['有名望的人。', '复姓。']);
    expect(s.specialized).toEqual([]);
    const m = lookupDict(dict!, '剩余价值').entry!;
    expect(m.specialized[0]?.defs.some((d) => d.includes('被资本家无偿占有'))).toBe(true);
  });
});

describe('normalize + serialize', () => {
  it('normalizeQuery strips whitespace, full-width, punctuation, quotes', () => {
    expect(normalizeQuery('　剩余价值、')).toBe('剩余价值');
    expect(normalizeQuery('《辩证法》')).toBe('辩证法');
    expect(normalizeQuery('  Capital ')).toBe('capital');
    expect(entryId('Sheng Yu')).toBe('shengyu');
  });

  it('serializeDictionary round-trips and fixes count', () => {
    const { value: dict } = parseDictionary(SAMPLE);
    const s = serializeDictionary(dict!);
    const parsed = JSON.parse(s) as { count: number; entries: Record<string, unknown> };
    expect(parsed.count).toBe(4);
    expect(parsed.entries['闻人']).toBeDefined();
  });

  it('serializeDictionary throws on invalid dict', () => {
    expect(() => serializeDictionary({ entries: { x: { word: 'y', defs: [] } } })).toThrow();
  });
});
