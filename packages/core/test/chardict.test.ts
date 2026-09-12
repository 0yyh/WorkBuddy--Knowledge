import { describe, it, expect } from 'vitest';
import {
  parseJsonl,
  parseCharBase,
  parseCharDetail,
  parsePolyphone,
  parseRelated,
  buildCharIndex,
  parseCharIndex,
  type CharBase,
  type CharDetail,
} from '../src/dict/chardict';

describe('chardict · parseJsonl', () => {
  it('按行解析 JSONL，忽略空行，坏行计入 errors', () => {
    const text = '\n{"a":1}\nnot json\n{"b":2}\n';
    const r = parseJsonl<{ a?: number; b?: number }>(text);
    expect(r.value.length).toBe(2);
    expect(r.errors.length).toBe(1);
  });

  it('容忍每行末尾多余逗号（源文件实际格式 {…},\n{…}）', () => {
    const text = '{"a":1},\n{"b":2},\n';
    const r = parseJsonl<{ a?: number; b?: number }>(text);
    expect(r.value.length).toBe(2);
    expect(r.errors.length).toBe(0);
  });
});

describe('chardict · 源文件解析', () => {
  it('parseCharBase / parseCharDetail 走 JSONL 解析（不整体 JSON.parse 失败）', () => {
    const jsonl = '{"index":1,"char":"一","strokes":1,"pinyin":["yī"],"radicals":"一"}\n{"index":2,"char":"乙","strokes":1,"pinyin":["yǐ"]}\n';
    expect(parseCharBase(jsonl).value.length).toBe(2);
    expect(parseCharDetail('{"char":"一","pronunciations":[]}\n').value.length).toBe(1);
  });

  it('parsePolyphone / parseRelated 解析标准 JSON 数组', () => {
    expect(parsePolyphone([{ index: 6, char: '厂', pinyin: ['chǎng', 'ān'] }]).value[0].pinyin).toEqual(['chǎng', 'ān']);
    expect(parseRelated([{ char: '一', synonyms: ['壹'], antonyms: ['百'] }]).value[0].antonyms).toEqual(['百']);
  });
});

describe('chardict · buildCharIndex', () => {
  const base: CharBase[] = [{ index: 1, char: '一', strokes: 1, pinyin: ['yī'], radicals: '一', frequency: 1, structure: '独体' }];
  const detail: CharDetail[] = [{ char: '一', pronunciations: [{ pinyin: 'yī', explanations: [{ content: '最小的正整数。' }] }] }];
  const poly = [{ index: 1, char: '一', strokes: 1, pinyin: ['yī', 'yāo'], frequency: 1 }];
  const related = [{ char: '一', synonyms: ['壹', '幺'], antonyms: ['百'], index: 1 }];

  it('按 char 合并四源，补多音、释义、近反义', () => {
    const { chars, errors } = buildCharIndex(base, detail, poly, related);
    const info = chars['一'];
    expect(info).toBeTruthy();
    expect(info.pinyin).toContain('yī');
    expect(info.pinyin).toContain('yāo'); // 来自 polyphone 合并
    expect(info.strokes).toBe(1);
    expect(info.radicals).toBe('一');
    expect(info.structure).toBe('独体');
    expect(info.explanations[0]).toContain('正整数');
    expect(info.synonyms).toEqual(['壹', '幺']);
    expect(info.antonyms).toEqual(['百']);
    expect(errors.length).toBe(0);
  });

  it('detail/related 缺 base 记录时计入 errors 且不抛出', () => {
    const { errors } = buildCharIndex([], [{ char: '永', pronunciations: [] }], [], [{ char: '永', synonyms: ['羕'] }]);
    expect(errors.length).toBe(2);
  });
});

describe('chardict · parseCharIndex', () => {
  it('把合并后的 index.json 读成 Map<char, CharInfo>', () => {
    const { chars } = buildCharIndex(
      [{ index: 1, char: '一', pinyin: ['yī'] }],
      [{ char: '一', pronunciations: [{ pinyin: 'yī', explanations: [{ content: 'x' }] }] }],
      [],
      [],
    );
    const file = { version: '1', built_at: 'now', source: 't', count: 1, chars };
    const r = parseCharIndex(file);
    expect(r.errors.length).toBe(0);
    expect(r.value?.get('一')?.explanations[0]).toBe('x');
  });

  it('畸形数据返回 errors 而非抛异常', () => {
    const r = parseCharIndex({ chars: 'not a record' });
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.value).toBeUndefined();
  });
});
