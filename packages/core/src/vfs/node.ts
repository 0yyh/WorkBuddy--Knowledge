/**
 * Node 文件系统 VFS（CLI 用，node-only）。
 * 相对路径映射到 root 目录；提供同步读取（构建期足够）。
 */
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Vfs, VfsStat } from './types.js';
import { normalizePath } from './types.js';
import { zipVfsFromBytes } from './zip.js';

/**
 * 从磁盘 zip 文件构造只读 VFS（node-only，供 CLI / 导入包使用）。
 * 与 `zipVfsFromBytes` 复用同一套解压逻辑，避免主入口引入 node:fs。
 */
export function zipVfsFromFile(path: string): Vfs {
  return zipVfsFromBytes(readFileSync(path));
}

export class NodeFsVfs implements Vfs {
  constructor(private root: string) {}

  private abs(path: string): string {
    return join(this.root, normalizePath(path));
  }

  exists(path: string): boolean {
    return existsSync(this.abs(path));
  }

  stat(path: string): VfsStat | null {
    const a = this.abs(path);
    if (!existsSync(a)) return null;
    const st = statSync(a);
    return { path: normalizePath(path), isDir: st.isDirectory(), size: st.size };
  }

  readText(path: string): string {
    return readFileSync(this.abs(path), 'utf8');
  }

  readBytes(path: string): Uint8Array {
    return readFileSync(this.abs(path));
  }

  listDir(path: string): string[] {
    const a = this.abs(path);
    if (!existsSync(a)) return [];
    return readdirSync(a);
  }

  walk(path: string): string[] {
    const a = this.abs(path);
    if (!existsSync(a)) return [];
    const out: string[] = [];
    const rec = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) rec(full);
        else out.push(normalizePath(relative(this.root, full)));
      }
    };
    rec(a);
    return out.sort();
  }
}
