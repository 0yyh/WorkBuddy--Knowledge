import { describe, it, expect } from 'vitest';
import {
  parseTrack,
  deriveCrossTimeline,
  deriveTimelineDimensions,
} from '../src/track/parse.js';
import type { Track } from '../src/types.js';

const VALID = `id: t1
title: 测试序列
category: 历史
order_mode: chronological
timeline: world
description: 描述
items:
  - order: "1"
    entry: alpha
    sort_date: -100
    date_label: "公元前100年"
    era: "古代"
    note: "首项"
    cross_timeline: true
  - entry: beta
`;

describe('parseTrack', () => {
  it('parses a valid track and normalizes items', () => {
    const { track, errors } = parseTrack(VALID);
    expect(errors).toEqual([]);
    expect(track).not.toBeNull();
    expect(track!.id).toBe('t1');
    expect(track!.title).toBe('测试序列');
    expect(track!.order_mode).toBe('chronological');
    expect(track!.timeline).toBe('world');
    expect(track!.items).toHaveLength(2);
    expect(track!.items[0]).toMatchObject({
      order: '1',
      entry: 'alpha',
      sort_date: -100,
      date_label: '公元前100年',
      era: '古代',
      note: '首项',
      cross_timeline: true,
    });
    // 未显式给 order 时按序号补
    expect(track!.items[1].order).toBe('2');
    expect(track!.items[1].cross_timeline).toBeUndefined();
  });

  it('coerces numeric order to string', () => {
    const { track } = parseTrack('id: t\nitems:\n  - {order: 5, entry: x}\n');
    expect(track!.items[0].order).toBe('5');
  });

  it('falls back to fileId when id is missing', () => {
    const { track, errors } = parseTrack('title: 无 id\nitems: []\n', 'from-file');
    expect(errors).toEqual([]);
    expect(track!.id).toBe('from-file');
  });

  it('reports a missing id when neither id nor fileId is given', () => {
    const { errors } = parseTrack('title: 无 id\nitems: []\n');
    expect(errors).toContain('Track.id 缺失');
  });

  it('reports an invalid order_mode but keeps parsing', () => {
    const { track, errors } = parseTrack('id: t\norder_mode: weird\nitems: []\n');
    expect(errors.some((e) => e.includes('order_mode'))).toBe(true);
    expect(track).not.toBeNull();
  });

  it('defaults order_mode to chronological when absent', () => {
    const { track } = parseTrack('id: t\nitems: []\n');
    expect(track!.order_mode).toBe('chronological');
  });

  it('reports items with an empty entry', () => {
    const { errors } = parseTrack('id: t\nitems:\n  - order: "1"\n');
    expect(errors).toContain('存在 items[].entry 为空');
  });

  it('drops an unsupported timeline value', () => {
    const { track } = parseTrack('id: t\ntimeline: galaxy\nitems: []\n');
    expect(track!.timeline).toBeUndefined();
  });

  it('returns null on invalid YAML', () => {
    const { track, errors } = parseTrack('id: [unclosed\n');
    expect(track).toBeNull();
    expect(errors[0]).toContain('YAML 解析失败');
  });

  it('rejects a non-object YAML document', () => {
    const { track, errors } = parseTrack('42\n');
    expect(track).toBeNull();
    expect(errors).toContain('Track 不是合法 YAML 对象');
  });

  it('tolerates a missing items list', () => {
    const { track, errors } = parseTrack('id: t\ntitle: x\n');
    expect(track!.items).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe('deriveCrossTimeline', () => {
  it('collects entries flagged cross_timeline in any track', () => {
    const t1: Track = {
      id: 'a', title: 'a', category: 'c', order_mode: 'chronological',
      items: [{ order: '1', entry: 'x', cross_timeline: true }, { order: '2', entry: 'y' }],
    };
    const t2: Track = {
      id: 'b', title: 'b', category: 'c', order_mode: 'chronological',
      items: [{ order: '1', entry: 'z', cross_timeline: true }],
    };
    const set = deriveCrossTimeline([t1, t2]);
    expect([...set].sort()).toEqual(['x', 'z']);
  });
});

describe('deriveTimelineDimensions', () => {
  it('assigns each entry the dimensions of the tracks it appears in', () => {
    const world: Track = {
      id: 'w', title: 'w', category: 'c', order_mode: 'chronological', timeline: 'world',
      items: [{ order: '1', entry: 'shared' }, { order: '2', entry: 'onlyWorld' }],
    };
    const china: Track = {
      id: 'c', title: 'c', category: 'c', order_mode: 'chronological', timeline: 'china',
      items: [{ order: '1', entry: 'shared' }],
    };
    const map = deriveTimelineDimensions([world, china]);
    expect(map.get('shared')!.sort()).toEqual(['china', 'world']);
    expect(map.get('onlyWorld')).toEqual(['world']);
  });

  it('defaults a track without a timeline value to world', () => {
    const t: Track = {
      id: 'x', title: 'x', category: 'c', order_mode: 'chronological',
      items: [{ order: '1', entry: 'e' }],
    };
    expect(deriveTimelineDimensions([t]).get('e')).toEqual(['world']);
  });

  it('merges in the optional entry timeline field', () => {
    const map = deriveTimelineDimensions([], { lone: ['china', 'world'] });
    expect(map.get('lone')!.sort()).toEqual(['china', 'world']);
  });
});
