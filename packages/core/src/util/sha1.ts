/**
 * 纯 TS SHA-1（FIPS 180-1）。用于内容指纹与包校验和，使核心层保持同构（不依赖 node:crypto）。
 * 参考 RFC 3174 的朴素实现；M0 数据量下性能足够，容量期可换 WASM/WebCrypto。
 */

function rotl(n: number, s: number): number {
  return (n << s) | (n >>> (32 - s));
}

function toBytes(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // 代理对
      const hi = code;
      const lo = str.charCodeAt(++i);
      code = 0x10000 + ((hi - 0xd800) << 10) + (lo - 0xdc00);
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return new Uint8Array(bytes);
}

export function sha1(input: string): string {
  const msg = toBytes(input);
  const ml = msg.length * 8;

  // 补位
  const withOne = msg.length + 1;
  const totalLen = ((withOne + 8 + 63) & ~63);
  const padded = new Uint8Array(totalLen);
  padded.set(msg);
  padded[msg.length] = 0x80;
  // 64 位长度（仅低位 32 位写入，足够 M0）
  const dv = new DataView(padded.buffer);
  dv.setUint32(totalLen - 4, ml >>> 0, false);
  dv.setUint32(totalLen - 8, Math.floor(ml / 0x100000000), false);

  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;

  const w = new Array<number>(80);
  for (let off = 0; off < totalLen; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = dv.getUint32(off + i * 4, false);
    }
    for (let i = 16; i < 80; i++) {
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const temp = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
      e = d; d = c; c = rotl(b, 30); b = a; a = temp;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }

  const hex = [h0, h1, h2, h3, h4].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
  return hex;
}

/** 便捷：sha1:<hex> 形式（与 SourceRef.fingerprint 约定一致） */
export function sha1hex(input: string): string {
  return `sha1:${sha1(input)}`;
}
