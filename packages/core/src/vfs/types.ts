/**
 * VFS 抽象（02 §3.3 / 04 §2.2）。
 * 正文 = 只读文件，通过 VFS 读取；修正层 overlay 叠加在基础层之上（永远优先）。
 * 接口同构；具体实现（node/zip）按需引入，主入口不依赖 node:*。
 */
export interface VfsStat {
  path: string;
  isDir: boolean;
  size: number;
}

export interface Vfs {
  exists(path: string): boolean;
  stat(path: string): VfsStat | null;
  readText(path: string): string;
  readBytes(path: string): Uint8Array;
  /** 列出子项名称（不含前缀），目录不存在返回 [] */
  listDir(path: string): string[];
  /** 递归收集某目录下的全部文件路径（vfs 内相对路径） */
  walk(path: string): string[];
}

/** 归一并规范化路径（统一用 '/'） */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/').replace(/(^\/|\/$)/g, '');
}
