/**
 * FNV-1a 32-bit 哈希。纯 TS，浏览器/Node 通用。
 * 用于 slug 分片：`fnv1a(slug) >>> 0 & (M - 1)`。
 */

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** 返回无符号 32 位整数 */
export function fnv1a(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // 乘 0x01000193，用 Math.imul 保持 32 位
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** 分片号：对 M（2 的幂）取模 */
export function shardOf(key: string, shardCount: number): number {
  return fnv1a(key) & (shardCount - 1);
}
