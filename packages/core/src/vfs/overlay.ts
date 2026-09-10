/**
 * 修正层 VFS（04 §2.2）。在基础层之上叠加：覆盖（patch）/ 新增 / 删除（墓碑）。
 * 永远优先于基础层；用于「App 内修正」「导入新数据覆盖」与合并。
 */
import type { Vfs, VfsStat } from './types.js';
import { normalizePath } from './types.js';

interface OverlayEntry {
  bytes?: Uint8Array;
  tombstone?: boolean;
}

export class OverlayVfs implements Vfs {
  private overlay = new Map<string, OverlayEntry>();

  constructor(private base: Vfs) {}

  /** 覆盖/新增文件（text） */
  putText(path: string, text: string): void {
    this.overlay.set(normalizePath(path), { bytes: new TextEncoder().encode(text) });
  }

  putBytes(path: string, bytes: Uint8Array): void {
    this.overlay.set(normalizePath(path), { bytes });
  }

  /** 删除（墓碑，逻辑删除，不触碰 base） */
  tombstone(path: string): void {
    this.overlay.set(normalizePath(path), { tombstone: true });
  }

  hasOverlay(path: string): boolean {
    return this.overlay.has(normalizePath(path));
  }

  exists(path: string): boolean {
    const p = normalizePath(path);
    const o = this.overlay.get(p);
    if (o) return !o.tombstone;
    return this.base.exists(p);
  }

  stat(path: string): VfsStat | null {
    const p = normalizePath(path);
    const o = this.overlay.get(p);
    if (o) {
      if (o.tombstone) return null;
      return { path: p, isDir: false, size: o.bytes?.length ?? 0 };
    }
    return this.base.stat(p);
  }

  readText(path: string): string {
    const p = normalizePath(path);
    const o = this.overlay.get(p);
    if (o) {
      if (o.tombstone) throw new Error(`OverlayVfs: 已墓碑删除 ${path}`);
      return new TextDecoder().decode(o.bytes);
    }
    return this.base.readText(p);
  }

  readBytes(path: string): Uint8Array {
    const p = normalizePath(path);
    const o = this.overlay.get(p);
    if (o) {
      if (o.tombstone) throw new Error(`OverlayVfs: 已墓碑删除 ${path}`);
      return o.bytes!;
    }
    return this.base.readBytes(p);
  }

  listDir(path: string): string[] {
    const base = new Set(this.base.listDir(path));
    const p = normalizePath(path);
    const prefix = p ? p + '/' : '';
    for (const k of this.overlay.keys()) {
      if (k.startsWith(prefix)) {
        const rest = k.slice(prefix.length);
        const seg = rest.includes('/') ? rest.slice(0, rest.indexOf('/')) : rest;
        if (seg) base.add(seg);
      }
    }
    // 墓碑目录项不移除（目录可能仍含其他文件）
    return Array.from(base);
  }

  walk(path: string): string[] {
    const base = new Set(this.base.walk(path));
    const p = normalizePath(path);
    const prefix = p ? p + '/' : '';
    for (const k of this.overlay.keys()) {
      if (k.startsWith(prefix)) {
        const o = this.overlay.get(k)!;
        if (o.tombstone) base.delete(k);
        else base.add(k);
      }
    }
    return Array.from(base).sort();
  }
}
