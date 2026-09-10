import { describe, it, expect } from 'vitest';
import { encodePostings, decodePostings } from '../src/index/shard-codec.js';
import type { PostingsTable } from '../src/index/shard-codec.js';

describe('shard-codec（postings 二进制化，P0-I）', () => {
  it('空对象往返一致', () => {
    const x: PostingsTable = {};
    expect(decodePostings(encodePostings(x))).toEqual(x);
  });

  it('单 term 单 posting 往返一致', () => {
    const x: PostingsTable = { alpha: [[0, 1]] };
    expect(decodePostings(encodePostings(x))).toEqual(x);
  });

  it('多 term 多 posting、升序 docId 往返一致', () => {
    const x: PostingsTable = {
      alpha: [[0, 3], [2, 1], [5, 7]],
      beta: [[1, 2], [3, 4]],
      gamma: [[0, 1]],
    };
    expect(decodePostings(encodePostings(x))).toEqual(x);
  });

  it('覆盖 docId 差值 >127（varint 多字节）与 tf >127', () => {
    const x: PostingsTable = {
      big: [[0, 1], [200, 300], [100000, 5000]],
    };
    // 差值确认确实需要多字节 varint：200-0=200>127，100000-200=99800>127
    expect(200 - 0).toBeGreaterThan(127);
    expect(100000 - 200).toBeGreaterThan(127);

    const decoded = decodePostings(encodePostings(x));
    expect(decoded).toEqual(x);
    // 显式校验多字节字段还原正确
    expect(decoded.big[1][0]).toBe(200);
    expect(decoded.big[1][1]).toBe(300);
    expect(decoded.big[2][0]).toBe(100000);
    expect(decoded.big[2][1]).toBe(5000);
  });

  it('base64 载体是纯文本字符串，可反复穿过文本管线', () => {
    const x: PostingsTable = { t: [[0, 1], [128, 2]] };
    const s = encodePostings(x);
    expect(typeof s).toBe('string');
    // 二次编码/解码仍稳定（模拟 JSON 文本往返）
    expect(decodePostings(JSON.parse(JSON.stringify(s)) as string)).toEqual(x);
  });
});
