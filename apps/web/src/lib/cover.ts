/**
 * 详情页（cover）装载：拉取 index/covers/{slug}.json 并交给 @pks/core 校验规范化。
 * 兼容旧产物：文件不存在时返回 null，由页面回退到 entries 分片合成。
 */
import { parseEntryCover } from '@pks/core';
import type { EntryCover } from '@pks/core';
import { fetchJson } from './loader';

/** 按 slug 拉取 cover 元数据；缺失/损坏返回 null（不抛错，便于回退展示） */
export async function fetchCover(slug: string): Promise<EntryCover | null> {
  try {
    const raw = await fetchJson<unknown>(`index/covers/${encodeURIComponent(slug)}.json`);
    return parseEntryCover(raw);
  } catch {
    return null;
  }
}
