import { describe, it, expect } from 'vitest';
import { encodeVarint, decodeVarint } from '../src/util/varint.js';

describe('varint (LEB128)', () => {
  it('encodes small values as a single byte', () => {
    expect([...encodeVarint(0)]).toEqual([0]);
    expect([...encodeVarint(1)]).toEqual([1]);
    expect([...encodeVarint(127)]).toEqual([127]);
  });

  it('encodes 128 as two bytes with continuation bit', () => {
    expect([...encodeVarint(128)]).toEqual([0x80, 0x01]);
  });

  it('round-trips boundary and large values', () => {
    for (const n of [0, 1, 127, 128, 255, 300, 16383, 16384, 1_000_000, 0xffffffff]) {
      const bytes = encodeVarint(n);
      const { value, next } = decodeVarint(bytes);
      expect(value).toBe(n >>> 0);
      expect(next).toBe(bytes.length);
    }
  });

  it('decodes from a non-zero offset', () => {
    const bytes = new Uint8Array([0xff, ...encodeVarint(300), 0xff]);
    const { value, next } = decodeVarint(bytes, 1);
    expect(value).toBe(300);
    expect(next).toBe(1 + encodeVarint(300).length);
  });

  it('treats negative inputs as unsigned 32-bit', () => {
    // -1 >>> 0 === 0xffffffff
    const { value } = decodeVarint(encodeVarint(-1));
    expect(value).toBe(0xffffffff);
  });

  it('does not run past the end on a truncated varint', () => {
    // 仅给出有 continuation 位的首字节，缺少后续字节
    const { next } = decodeVarint(new Uint8Array([0x80]));
    expect(next).toBe(1);
  });
});
