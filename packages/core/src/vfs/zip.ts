/**
 * Zip-backed 只读 VFS（同构，不依赖 node:fs）。
 * 用 fflate 解压为内存映射后行为等同 MemoryVfs。
 * 注意：从磁盘读取 zip 的 `zipVfsFromFile` 属于 node-only 能力，位于 `../vfs/node.js`。
 */
import { unzipSync } from 'fflate';
import { MemoryVfs } from './memory.js';
import type { Vfs } from './types.js';

export function zipVfsFromBytes(bytes: Uint8Array): Vfs {
  const entries = unzipSync(bytes);
  const mem = new MemoryVfs();
  for (const [name, data] of Object.entries(entries)) {
    // 目录项（以 '/' 结尾）跳过；真正的空文件（length === 0）是合法内容，必须保留。
    if (!name.endsWith('/') && data) mem.write(name, data);
  }
  return mem;
}
