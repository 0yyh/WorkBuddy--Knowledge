/**
 * 数据包打包与解包（01 §8 / 02 §18.13 pack.level 三级）。
 * 用 fflate 生成 self-contained zip：bundle.json（含 pack 元信息）+ content/ + .index/ + feedback.json。
 * 同构（fflate 纯 JS），CLI 与运行期导入均可用。
 */
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { BUNDLE_FORMAT, BUNDLE_VERSION, GENERATOR } from '../constants.js';
import { sha1 } from '../util/sha1.js';
import type { PackLevel, PackManifest, FeedbackFile, IsoDate } from '../types.js';

export interface BundleInput {
  /** 内容文件：相对 content/ 的路径 -> 文本 */
  contentFiles: Record<string, string>;
  /** 索引文件：相对 .index/ 的路径 -> 文本 */
  indexFiles: Record<string, string>;
  pack: { level: PackLevel; category?: string; works?: string[] };
  scope: { type: 'all' | 'category' | 'selection'; value?: string };
  stats: { entries: number; sections: number; words: number; bytes: number };
  base_snapshot: Record<string, { u: IsoDate; r: number }>;
  feedback?: FeedbackFile;
}

function toBytesMap(files: Record<string, string>, prefix: string): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  for (const [rel, text] of Object.entries(files)) out[`${prefix}${rel}`] = strToU8(text);
  return out;
}

/** 生成数据包 zip 字节 */
export function createBundleZip(input: BundleInput): Uint8Array {
  const manifest: PackManifest = {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    generator: GENERATOR,
    created_at: new Date().toISOString(),
    pack: input.pack,
    scope: input.scope,
    stats: input.stats,
    checksum: '',
    base_snapshot: input.base_snapshot,
    index_shards: detectIndexShards(input.indexFiles),
    includes_userdata: false,
  };
  manifest.checksum = computeBundleChecksum(manifest);

  const map: Record<string, Uint8Array> = {
    'bundle.json': strToU8(JSON.stringify(manifest, null, 2)),
    ...toBytesMap(input.contentFiles, 'content/'),
    ...toBytesMap(input.indexFiles, '.index/'),
    'feedback.json': strToU8(JSON.stringify(input.feedback ?? { schema: 1, items: [] }, null, 2)),
  };

  return zipSync(map, { level: 6 });
}

/**
 * 包校验和：对「不含 checksum 字段」的 manifest 规范 JSON 取 SHA-1，前缀 `sha1:`，
 * 与 SourceRef.fingerprint 的 `sha1:<hex>` 约定一致（原实现误标为 `sha256:`）。
 * 因排除了 checksum 自身，可由 bundle.json 原样复算校验。
 */
export function computeBundleChecksum(manifest: PackManifest): string {
  const body: Record<string, unknown> = { ...manifest };
  delete body.checksum;
  return `sha1:${sha1(JSON.stringify(body, null, 2))}`;
}

/** 校验包校验和是否自洽（导入前的完整性检查） */
export function verifyBundleChecksum(manifest: PackManifest): boolean {
  return manifest.checksum === computeBundleChecksum(manifest);
}

/** 从索引文件名收集实际存在的检索分片号（如 search/s00.json → 0） */
function detectIndexShards(indexFiles: Record<string, string>): number[] {
  const shards = new Set<number>();
  for (const key of Object.keys(indexFiles)) {
    const m = key.match(/search\/s(\d+)\.json$/);
    if (m) shards.add(Number(m[1]));
  }
  return [...shards].sort((a, b) => a - b);
}

/** 解包 zip 为文件映射（path -> text） */
export function extractBundleZip(bytes: Uint8Array): Record<string, string> {
  const entries = unzipSync(bytes);
  const out: Record<string, string> = {};
  for (const [name, data] of Object.entries(entries)) {
    if (!name.endsWith('/')) out[name] = strFromU8(data);
  }
  return out;
}
