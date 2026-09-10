import { describe, it, expect } from 'vitest';
import { computeImportPlan, buildBaseSnapshot, type IncomingEntry, type LocalBaseline } from '../src/merge/conflict.js';
import type { EntryMeta } from '../src/types.js';

function inc(title: string, rev: number, hash: string, bytes = 100): IncomingEntry {
  return { meta: { title, rev } as EntryMeta, contentHash: hash, bytes };
}

describe('computeImportPlan', () => {
  // Base snapshot when the bundle was exported.
  const bundleBase: Record<string, { u: string; r: number }> = {
    a: { u: '2024-01-01', r: 1 },
    b: { u: '2024-01-01', r: 1 },
    e: { u: '2024-01-01', r: 1 },
  };

  // Local baseline: which rev the local copy was derived from.
  const localBaseline: LocalBaseline = {
    a: { u: '2024-01-01', r: 1, hash: 'HA' }, // local unchanged
    b: { u: '2024-01-01', r: 2, hash: 'HB' }, // local changed
    e: { u: '2024-01-01', r: 1, hash: 'HE' }, // local unchanged
  };

  const incoming = new Map<string, IncomingEntry>([
    ['a', inc('A', 2, 'HA2', 100)], // incoming changed, local not -> update
    ['b', inc('B', 1, 'HB2', 100)], // local changed, incoming not -> keep
    ['c', inc('C', 1, 'HC', 50)],  // not in local -> add
    ['e', inc('E', 1, 'HE', 50)],  // neither changed, same hash -> skip
  ]);

  it('decides add / update / keep / skip correctly', () => {
    const plan = computeImportPlan(incoming, bundleBase, localBaseline);
    const bySlug = new Map(plan.items.map((i) => [i.slug, i.action]));

    expect(bySlug.get('a')).toBe('update');
    expect(bySlug.get('b')).toBe('keep');
    expect(bySlug.get('c')).toBe('add');
    expect(bySlug.get('e')).toBe('skip');

    expect(plan.summary).toMatchObject({ add: 1, update: 1, keep: 1, skip: 1, conflict: 0 });
    expect(plan.strategy).toBe('keep-both');
  });

  it('flags a genuine conflict when both sides changed differently', () => {
    const incoming2 = new Map<string, IncomingEntry>([
      ['b', inc('B', 3, 'HB3', 100)], // both changed (local r=2, incoming r=3), different hashes
    ]);
    const plan = computeImportPlan(incoming2, bundleBase, localBaseline);
    // Both sides changed with different content hashes -> refined to 'conflict-source'.
    expect(plan.items[0].action).toBe('conflict-source');
    expect(plan.summary.conflict).toBe(1);
  });
});

describe('buildBaseSnapshot', () => {
  it('maps entries to their updated_at and rev', () => {
    const entries: EntryMeta[] = [
      { slug: 'x', title: 'X', rev: 2, updated_at: '2024-05-05' } as EntryMeta,
      { slug: 'y', title: 'Y', rev: 1, updated_at: '2024-06-06' } as EntryMeta,
    ];
    const snap = buildBaseSnapshot(entries);
    expect(snap.x).toEqual({ u: '2024-05-05', r: 2 });
    expect(snap.y).toEqual({ u: '2024-06-06', r: 1 });
  });
});
