import { describe, it, expect } from 'vitest';
import { countWords } from '../src/parse/words.js';

describe('countWords', () => {
  it('returns 0 for empty or whitespace-only input', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t ')).toBe(0);
  });

  it('counts each CJK character as one word', () => {
    expect(countWords('你好世界')).toBe(4);
  });

  it('counts non-CJK text by whitespace-separated tokens', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('one')).toBe(1);
  });

  it('handles mixed CJK and latin text', () => {
    expect(countWords('中文 English 混合')).toBe(5);
    expect(countWords('hello 世界')).toBe(3);
  });

  it('counts kana as CJK characters', () => {
    expect(countWords('ひらがな')).toBe(4);
  });
});
