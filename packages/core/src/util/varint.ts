/**
 * 变长整数（varint, LEB128）编解码。预留给容量期倒排 postings 的二进制压缩（02 §3.4 .bin）。
 * M0 索引用 JSON，本模块暂不被主链路调用，但已就绪。
 */

export function encodeVarint(n: number): Uint8Array {
  const out: number[] = [];
  let value = n >>> 0;
  while (value >= 0x80) {
    out.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  out.push(value);
  return new Uint8Array(out);
}

export function decodeVarint(bytes: Uint8Array, offset = 0): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let i = offset;
  while (i < bytes.length) {
    const b = bytes[i++];
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result >>> 0, next: i };
}
