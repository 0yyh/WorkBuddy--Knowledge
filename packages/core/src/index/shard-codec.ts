/**
 * 检索分片倒排 postings 二进制编解码（P0-I，02 §3.4 .bin 落地）。
 *
 * 目的：把 `.index/search/sNN.json` 里全量展开的
 *   `index: Record<string, Array<[number, number]>>`（term -> [docId, tf][]）
 * 压缩为一段 base64 文本，挂到分片 JSON 的 `postings` 字段上：
 *   { shard, docs, lengths, postings: "<base64>" }
 *
 * 为什么用 base64 文本载体（而非裸 .bin 文件）：
 *   内容管线（contentCache.ts / contentUpdater.ts / build-update.mjs / merge/bundle.ts）
 *   全程按「文本」处理文件（strToU8 / res.text() / IndexedDB 字符串）。base64 是纯文本，
 *   可零改动穿过整条管线；裸二进制会被 text 管线破坏。
 *
 * 编码格式（v1，小端 varint / LEB128）：
 *   [u8 version=1]
 *   [varint termCount]
 *   对每个 term（按 Object.keys 顺序）：
 *     [varint utf8ByteLen][utf8 term bytes][varint postingCount]
 *     对每个 posting（postings 内 docId 升序）：
 *       [varint docIdDelta][varint tf]
 *       （docIdDelta = 相对该 term 上一个 posting 的 docId 差值；首个 posting 为绝对值）
 *   整段再经 fflate.zlibSync 压缩，最后 base64 编码。
 *
 * 同构：不 import `node:buffer`；base64 走 `Buffer`（Node）或 `atob`/`btoa`（浏览器）分支。
 */
import { zlibSync, unzlibSync } from 'fflate';
import { encodeVarint, decodeVarint } from '../util/varint.js';

/** postings 表：term -> Map<docId, tf>（解码期即建成 Map，BM25 查找 O(1)，P1-4） */
export type PostingsTable = Record<string, Map<number, number>>;

/** 当前编码版本号 */
const CODEC_VERSION = 1;

/** 可增长的 Uint8Array 写缓冲：整体只分配一次，扩容时倍增（避免每次写入都新建数组）。 */
class ByteWriter {
  private buf: Uint8Array;
  private len = 0;

  constructor(initialCapacity = 1024) {
    this.buf = new Uint8Array(Math.max(1, initialCapacity));
  }

  /** 确保剩余容量至少 n 字节，不足则按倍增扩容。 */
  private ensure(n: number): void {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  writeByte(b: number): void {
    this.ensure(1);
    this.buf[this.len++] = b & 0xff;
  }

  writeBytes(bytes: Uint8Array): void {
    this.ensure(bytes.length);
    this.buf.set(bytes, this.len);
    this.len += bytes.length;
  }

  /** 写入一个 varint（复用 util/varint 的 encodeVarint，结果拷入本缓冲，不重建输出数组）。 */
  writeVarint(n: number): void {
    this.writeBytes(encodeVarint(n));
  }

  /** 取已写入内容的精确切片。 */
  toUint8Array(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

/** 同构 utf8 编码：优先 TextEncoder，缺失时回落 Node Buffer。 */
function utf8Encode(s: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
  // 兜底（极旧环境）：Buffer 仅在 Node 下存在
  return new Uint8Array(Buffer.from(s, 'utf8'));
}

/** 同构 utf8 解码：优先 TextDecoder，缺失时回落 Node Buffer。 */
function utf8Decode(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
  return Buffer.from(bytes).toString('utf8');
}

/**
 * 字节 -> base64（同构）。
 * 浏览器 btoa 需分块 String.fromCharCode，避免超长参数触发调用栈溢出。
 */
function bytesToB64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunk = 0x8000; // 32768，远低于参数上限，避开栈溢出
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** base64 -> 字节（同构）。 */
function b64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * 将 postings 表编码为 base64 文本（zlib 压缩）。
 * @param index term -> [docId, tf][]（docId 在同 term 内升序）
 * @returns base64(zlibSync(bytes))
 */
export function encodePostings(index: PostingsTable): string {
  const w = new ByteWriter();
  w.writeByte(CODEC_VERSION);

  const terms = Object.keys(index);
  w.writeVarint(terms.length);

  for (const term of terms) {
    const termBytes = utf8Encode(term);
    w.writeVarint(termBytes.length);
    w.writeBytes(termBytes);

    const postings = index[term]!;
    w.writeVarint(postings.size);
    let prevDocId = 0;
    for (const [docId, tf] of postings) {
      w.writeVarint(docId - prevDocId); // 差分（升序 docId 下恒 >= 0）
      prevDocId = docId;
      w.writeVarint(tf);
    }
  }

  const raw = w.toUint8Array();
  const compressed = zlibSync(raw);
  return bytesToB64(compressed);
}

/**
 * 将 base64 文本解码回 postings 表（encodePostings 的逆操作）。
 * @param b64 base64(zlibSync(bytes))
 * @returns term -> [docId, tf][]
 */
export function decodePostings(b64: string): PostingsTable {
  const raw = unzlibSync(b64ToBytes(b64));

  let offset = 0;
  const version = raw[offset++];
  if (version !== CODEC_VERSION) {
    throw new Error(`不支持的 postings 编码版本：${version}`);
  }

  const termCountRes = decodeVarint(raw, offset);
  offset = termCountRes.next;
  const termCount = termCountRes.value;

  const out: PostingsTable = {};
  for (let i = 0; i < termCount; i++) {
    const lenRes = decodeVarint(raw, offset);
    offset = lenRes.next;
    const termBytes = raw.subarray(offset, offset + lenRes.value);
    offset += lenRes.value;
    const term = utf8Decode(termBytes);

    const countRes = decodeVarint(raw, offset);
    offset = countRes.next;
    const postingCount = countRes.value;

    const postings = new Map<number, number>();
    let prevDocId = 0;
    for (let j = 0; j < postingCount; j++) {
      const deltaRes = decodeVarint(raw, offset);
      offset = deltaRes.next;
      const docId = prevDocId + deltaRes.value;
      prevDocId = docId;

      const tfRes = decodeVarint(raw, offset);
      offset = tfRes.next;

      postings.set(docId, tfRes.value);
    }
    out[term] = postings;
  }

  return out;
}

/**
 * 旧内联倒排表（term -> [docId, tf][]）转 Map<docId, tf>。
 * 用于解码旧产物 / 旧 wire 格式的 `index` 字段（新产物统一走 base64 `postings`，已由 decodePostings 建 Map）。
 */
export function inlineIndexToMap(index: Record<string, Array<[number, number]>>): PostingsTable {
  const out: PostingsTable = {};
  for (const term of Object.keys(index)) {
    const m = new Map<number, number>();
    for (const [docId, tf] of index[term]) m.set(docId, tf);
    out[term] = m;
  }
  return out;
}
