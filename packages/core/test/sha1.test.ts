import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { sha1, sha1hex } from '../src/util/sha1.js';

const ref = (s: string): string => createHash('sha1').update(s, 'utf8').digest('hex');

describe('sha1', () => {
  it('matches the FIPS 180-1 / RFC 3174 known vectors', () => {
    expect(sha1('')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(sha1('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(sha1('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))
      .toBe('84983e441c3bd26ebaae4aa1f95129e5e54670f1');
  });

  it('agrees with node:crypto across ASCII, CJK and emoji (UTF-8)', () => {
    const samples = [
      'hello world',
      '知识',
      '马克思主义政治经济学',
      'emoji 😀🚀 mixed 中文',
      'x'.repeat(55), // 单块边界前
      'x'.repeat(56), // 需要额外的 64 字节块
      'x'.repeat(64),
      'y'.repeat(1000),
      '\u0000\u007f\u0080\u07ff\u0800\uffff',
    ];
    for (const s of samples) {
      expect(sha1(s)).toBe(ref(s));
    }
  });

  it('always returns 40 lowercase hex chars', () => {
    const h = sha1('whatever');
    expect(h).toMatch(/^[0-9a-f]{40}$/);
  });

  it('sha1hex prefixes with sha1:', () => {
    expect(sha1hex('abc')).toBe('sha1:a9993e364706816aba3e25717850c26c9cd0d89d');
  });
});
