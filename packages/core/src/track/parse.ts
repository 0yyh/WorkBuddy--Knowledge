/**
 * 学习序列（Track）解析（01b §6）。
 * 读取 content/tracks/*.yaml，产出 Track + 派生双轨字段（cross_timeline / tl / sd）。
 */
import yaml from 'js-yaml';
import type { Track, TrackItem, OrderMode } from '../types.js';

const ORDER_MODES: OrderMode[] = ['chronological', 'difficulty', 'dependency', 'school_then_chronological'];

export function parseTrack(content: string, fileId?: string): { track: Track | null; errors: string[] } {
  const errors: string[] = [];
  let obj: any;
  try {
    obj = yaml.load(content);
  } catch (e) {
    return { track: null, errors: [`YAML 解析失败：${String(e)}`] };
  }
  if (typeof obj !== 'object' || obj === null) return { track: null, errors: ['Track 不是合法 YAML 对象'] };

  const id = String(obj.id ?? fileId ?? '');
  if (!id) errors.push('Track.id 缺失');

  const order_mode = (obj.order_mode as OrderMode) ?? 'chronological';
  if (!ORDER_MODES.includes(order_mode)) errors.push(`order_mode "${order_mode}" 非法`);

  const items: TrackItem[] = Array.isArray(obj.items) ? obj.items.map((it: any, i: number) => ({
    order: String(it.order ?? `${i + 1}`),
    entry: String(it.entry ?? ''),
    sort_date: typeof it.sort_date === 'number' ? it.sort_date : undefined,
    date_label: it.date_label ? String(it.date_label) : undefined,
    era: it.era ? String(it.era) : undefined,
    note: it.note ? String(it.note) : undefined,
    title: it.title ? String(it.title) : undefined,
    cross_timeline: it.cross_timeline === true ? true : undefined,
    level: typeof it.level === 'number' ? it.level : undefined,
    school: it.school ? String(it.school) : undefined,
    requires: Array.isArray(it.requires) ? it.requires.map(String) : undefined,
  })) : [];
  if (items.some((it) => !it.entry)) errors.push('存在 items[].entry 为空');

  const track: Track = {
    id,
    title: String(obj.title ?? id),
    category: String(obj.category ?? ''),
    order_mode,
    timeline: obj.timeline === 'world' || obj.timeline === 'china' ? obj.timeline : undefined,
    description: obj.description ? String(obj.description) : undefined,
    era_labels: obj.era_labels as Record<string, string> | undefined,
    items,
  };
  return { track, errors };
}

/**
 * 由 tracks 推导每个 entry 的 cross_timeline 标志（02 §18.11 B4）。
 * 任一 TrackItem.cross_timeline=true 则该 entry ctl=1。
 */
export function deriveCrossTimeline(tracks: Track[]): Set<string> {
  const set = new Set<string>();
  for (const t of tracks) {
    for (const it of t.items) {
      if (it.cross_timeline && it.entry) set.add(it.entry);
    }
  }
  return set;
}

/** 由 tracks 推导 entry -> timeline 维度集合（['world']|['china']|['china','world']） */
export function deriveTimelineDimensions(tracks: Track[], entryTimelineField?: Record<string, string[]>): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  const add = (slug: string, dim: string) => {
    if (!map.has(slug)) map.set(slug, new Set());
    map.get(slug)!.add(dim);
  };
  for (const t of tracks) {
    const dim = t.timeline ?? 'world';
    for (const it of t.items) if (it.entry) add(it.entry, dim);
  }
  if (entryTimelineField) {
    for (const [slug, dims] of Object.entries(entryTimelineField)) dims.forEach((d) => add(slug, d));
  }
  return new Map([...map.entries()].map(([k, v]) => [k, [...v]]));
}
