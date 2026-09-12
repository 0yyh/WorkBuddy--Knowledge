/**
 * staging 落盘与 promote（T03）。
 *  - writeStaging: 把解析出的文件集写入 content/.staging/{slug}/（entry.md + chapters/*.md）
 *  - promote: 把 .staging/{slug} 整体移到 content/entries/{slug}（已存在则报错）
 *  - readStaging: 读回文件集（用于调试 / 人工抽查）
 *  - stagingEntryVfs: 构造一个 Vfs，将 entries/{slug} 映射到 .staging/{slug}，其余仍走真实 content，
 *    以便 loadSnapshot 在「全量 taxonomy/allSlugs」上下文中单独校验该 staged 条目。
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { NodeFsVfs } from '@pks/core/node';
import type { Vfs, VfsStat } from '@pks/core';

const STAGING_DIR = '.staging';
const ENTRIES_DIR = 'entries';

export function stagingDir(contentDir: string, slug: string): string {
  return resolve(contentDir, STAGING_DIR, slug);
}

export function writeStaging(contentDir: string, slug: string, files: Map<string, string>): void {
  const dir = stagingDir(contentDir, slug);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of files) {
    const target = resolve(dir, name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
  }
}

export function readStaging(contentDir: string, slug: string): Map<string, string> | null {
  const dir = stagingDir(contentDir, slug);
  if (!existsSync(dir)) return null;
  const files = new Map<string, string>();
  const walk = (rel: string): void => {
    const abs = rel ? join(dir, rel) : dir;
    for (const name of readdirSync(abs)) {
      const full = join(abs, name);
      const st = statSync(full);
      const rel2 = rel ? `${rel}/${name}` : name;
      if (st.isDirectory()) walk(rel2);
      else files.set(rel2.split('\\').join('/'), readFileSync(full, 'utf8'));
    }
  };
  walk('');
  return files;
}

export function promote(contentDir: string, slug: string): void {
  const from = stagingDir(contentDir, slug);
  const to = resolve(contentDir, ENTRIES_DIR, slug);
  if (!existsSync(from)) {
    throw new Error(`promote: staging 目录不存在 ${from}`);
  }
  if (existsSync(to)) {
    throw new Error(`promote: 目标已存在（拒绝覆盖）${to}`);
  }
  mkdirSync(resolve(contentDir, ENTRIES_DIR), { recursive: true });
  renameSync(from, to);
}

/**
 * 构造一个 Vfs，将 `entries/{slug}` 映射到 `.staging/{slug}`，其余路径仍走真实 content 目录。
 * 这样 loadSnapshot(vfs) 能在「全量 taxonomy + 全部已有 slug」上下文中单独校验该 staged 条目
 * （L002 类目、L006 see_also 依赖全量上下文）。
 */
export function stagingEntryVfs(contentDir: string, slug: string): Vfs {
  const base = new NodeFsVfs(contentDir);
  const root = stagingDir(contentDir, slug);
  const prefix = `entries/${slug}`;
  const remap = (p: string): string | null => {
    if (p === prefix || p.startsWith(`${prefix}/`)) {
      const rel = p === prefix ? '' : p.slice(prefix.length + 1);
      return rel === '' ? root : join(root, rel);
    }
    return null;
  };
  const norm = (p: string): string => p.split('\\').join('/').replace(/^\.\//, '').replace(/\/+/g, '/');
  const vfs: Vfs = {
    exists(p: string): boolean {
      const m = remap(p);
      if (m !== null) return existsSync(m);
      return base.exists(p);
    },
    stat(p: string): VfsStat | null {
      const m = remap(p);
      if (m !== null) {
        if (!existsSync(m)) return null;
        const st = statSync(m);
        return { path: norm(p), isDir: st.isDirectory(), size: st.size };
      }
      return base.stat(p);
    },
    readText(p: string): string {
      const m = remap(p);
      if (m !== null) return readFileSync(m, 'utf8');
      return base.readText(p);
    },
    readBytes(p: string): Uint8Array {
      const m = remap(p);
      if (m !== null) return readFileSync(m);
      return base.readBytes(p);
    },
    listDir(p: string): string[] {
      if (p === 'entries') {
        const list = base.listDir('entries');
        return list.includes(slug) ? list : [...list, slug];
      }
      const m = remap(p);
      if (m !== null) {
        if (!existsSync(m)) return [];
        return readdirSync(m);
      }
      return base.listDir(p);
    },
    walk(p: string): string[] {
      const m = remap(p);
      const out: string[] = [];
      const rec = (abs: string, rel: string): void => {
        if (!existsSync(abs)) return;
        for (const name of readdirSync(abs)) {
          const full = join(abs, name);
          const st = statSync(full);
          const r = rel ? `${rel}/${name}` : name;
          if (st.isDirectory()) rec(full, r);
          else out.push(norm(r));
        }
      };
      if (m !== null) {
        rec(m, '');
        return out;
      }
      return base.walk(p);
    },
  };
  return vfs;
}
