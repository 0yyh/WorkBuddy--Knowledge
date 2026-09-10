/**
 * 导入冲突三方合并（01 §8 / 04 §2.2）。
 * 基线（bundle.base_snapshot）= 导出时各 slug 的 (updated_at, rev)；
 * 本地基线（imports.json）= 本地这份是从哪个基线来的；
 * 进来的包 = 待合并内容。按「双方是否各自改过」定 action。
 */
import type { EntryMeta, ImportPlan, ImportPlanItem, ImportAction, IsoDate } from '../types.js';

export interface LocalBaseline {
  [slug: string]: { u: IsoDate; r: number; hash?: string };
}
export interface IncomingEntry {
  meta: EntryMeta;
  contentHash: string;
  bytes: number;
}

function isChanged(local: { r: number } | undefined, base: { r: number } | undefined): boolean {
  const baseR = base?.r ?? 0;
  return (local?.r ?? 0) > baseR;
}

/** 计算导入计划（dry-run，不落盘） */
export function computeImportPlan(
  incoming: Map<string, IncomingEntry>,
  bundleBase: Record<string, { u: IsoDate; r: number }>,
  localBaseline: LocalBaseline,
): ImportPlan {
  const items: ImportPlanItem[] = [];
  let add = 0, update = 0, keep = 0, conflict = 0, skip = 0, bytes = 0;

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  for (const [slug, inc] of incoming) {
    const base = bundleBase[slug];
    const local = localBaseline[slug];
    const title = inc.meta.title;
    const size = inc.bytes;
    bytes += size;

    if (!local) {
      items.push({ slug, action: 'add', title, bytes: size });
      add++;
      continue;
    }

    const localChanged = isChanged(local, base);
    const incomingChanged = isChanged({ r: inc.meta.rev }, base);

    let action: ImportAction;
    if (!localChanged && !incomingChanged) {
      action = local.hash === inc.contentHash ? 'skip' : 'conflict';
    } else if (localChanged && !incomingChanged) {
      action = 'keep';
    } else if (!localChanged && incomingChanged) {
      action = 'update';
    } else {
      action = 'conflict';
    }

    if (action === 'conflict') {
      // 同名不同源：抽查 source fingerprint 不一致则标记 conflict-source
      const localFp = local.hash ?? '';
      const incFp = inc.contentHash;
      if (localFp && incFp && localFp !== incFp && local.hash !== inc.contentHash) {
        action = 'conflict-source';
      }
      items.push({
        slug,
        action,
        title,
        localRev: local.r,
        incomingRev: inc.meta.rev,
        bytes: size,
        conflictAs: `${slug}.conflict-${today}`,
      });
      conflict++;
    } else {
      items.push({ slug, action, title, localRev: local.r, incomingRev: inc.meta.rev, bytes: size });
      switch (action) {
        case 'update': update++; break;
        case 'keep': keep++; break;
        case 'skip': skip++; break;
      }
    }
  }

  return {
    bundleId: '',
    items,
    summary: { add, update, keep, conflict, skip, bytes },
    strategy: 'keep-both',
  };
}

/** 从快照生成 base_snapshot（导出用） */
export function buildBaseSnapshot(entries: EntryMeta[]): Record<string, { u: IsoDate; r: number }> {
  const out: Record<string, { u: IsoDate; r: number }> = {};
  for (const e of entries) out[e.slug] = { u: e.updated_at, r: e.rev };
  return out;
}
