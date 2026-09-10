/**
 * 内存 VFS。用于测试、overlay 基类、以及 zip 解压后的只读视图。
 * 路径以 '/' 分隔，统一小写无关（保留原样）。
 */
import type { Vfs, VfsStat } from './types.js';
import { normalizePath } from './types.js';

export class MemoryVfs implements Vfs {
  private files = new Map<string, Uint8Array>();

  constructor(initial?: Record<string, string | Uint8Array>) {
    if (initial) {
      for (const [k, v] of Object.entries(initial)) {
        this.write(k, typeof v === 'string' ? new TextEncoder().encode(v) : v);
      }
    }
  }

  write(path: string, bytes: Uint8Array): void {
    this.files.set(normalizePath(path), bytes);
  }

  writeText(path: string, text: string): void {
    this.write(path, new TextEncoder().encode(text));
  }

  exists(path: string): boolean {
    const p = normalizePath(path);
    if (this.files.has(p)) return true;
    // 目录判定：是否有以该前缀开头的文件
    const prefix = p ? p + '/' : '';
    for (const k of this.files.keys()) if (k.startsWith(prefix)) return true;
    return false;
  }

  stat(path: string): VfsStat | null {
    const p = normalizePath(path);
    if (this.files.has(p)) {
      const b = this.files.get(p)!;
      return { path: p, isDir: false, size: b.length };
    }
    const prefix = p ? p + '/' : '';
    let count = 0;
    for (const k of this.files.keys()) if (k.startsWith(prefix)) count++;
    if (count > 0) return { path: p, isDir: true, size: 0 };
    return null;
  }

  readText(path: string): string {
    const p = normalizePath(path);
    const b = this.files.get(p);
    if (!b) throw new Error(`MemoryVfs: 文件不存在 ${path}`);
    return new TextDecoder().decode(b);
  }

  readBytes(path: string): Uint8Array {
    const p = normalizePath(path);
    const b = this.files.get(p);
    if (!b) throw new Error(`MemoryVfs: 文件不存在 ${path}`);
    return b;
  }

  listDir(path: string): string[] {
    const p = normalizePath(path);
    const prefix = p ? p + '/' : '';
    const set = new Set<string>();
    for (const k of this.files.keys()) {
      if (k.startsWith(prefix)) {
        const rest = k.slice(prefix.length);
        const seg = rest.includes('/') ? rest.slice(0, rest.indexOf('/')) : rest;
        if (seg) set.add(seg);
      }
    }
    return Array.from(set);
  }

  walk(path: string): string[] {
    const p = normalizePath(path);
    const prefix = p ? p + '/' : '';
    const out: string[] = [];
    for (const k of this.files.keys()) if (k.startsWith(prefix)) out.push(k);
    return out.sort();
  }
}
