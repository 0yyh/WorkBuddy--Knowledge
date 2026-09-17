/**
 * 通用 JSON ↔ base64(zlib) 编解码（同构：Node 与浏览器通用）。
 *
 * 与 `index/shard-codec.ts` 的 postings 编解码同款 fflate + base64 **文本载体**：
 *  - base64 是纯文本，可零改动穿过 contentCache / OTA / merge 整条「文本」管线
 *    （strToU8 / res.text() / IndexedDB 字符串），裸二进制会被 text 管线破坏；
 *  - zlib 压缩由已作为 core 依赖的 `fflate` 提供，浏览器/Node 共用一份实现。
 *
 * 用途：把「整表」类产物（如 df 桶）压缩为单行 base64 文本，显著减小体积，
 * 查询时按需懒加载命中桶并解压即可，避免整表进内存。
 */
import { zlibSync, unzlibSync } from 'fflate';

/** 字节 → base64（同构：浏览器 btoa 需分块，避开调用栈溢出；Node 走 Buffer）。 */
function bytesToB64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunk = 0x8000; // 32768，远低于参数上限
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** base64 → 字节（同构）。 */
function b64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** 将任意 JSON 可序列化对象压缩为 base64(zlib) 文本。 */
export function compressJson<T>(obj: T): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  return bytesToB64(zlibSync(bytes));
}

/** 将 base64(zlib) 文本解压回原对象（compressJson 的逆操作）。 */
export function decompressJson<T>(b64: string): T {
  const bytes = unzlibSync(b64ToBytes(b64));
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}
