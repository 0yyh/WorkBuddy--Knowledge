import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { MemoryVfs } from '../src/vfs/memory.js';
import { OverlayVfs } from '../src/vfs/overlay.js';
import { zipVfsFromBytes } from '../src/vfs/zip.js';
import { normalizePath } from '../src/vfs/types.js';

describe('normalizePath', () => {
  it('normalizes separators, leading ./ and redundant slashes', () => {
    expect(normalizePath('a\\b\\c')).toBe('a/b/c');
    expect(normalizePath('./a//b/')).toBe('a/b');
    expect(normalizePath('/a/b/')).toBe('a/b');
  });
});

describe('MemoryVfs', () => {
  const vfs = new MemoryVfs({
    'a/b.txt': 'A',
    'a/c.txt': 'B',
    'd.txt': 'D',
  });

  it('detects files and directories', () => {
    expect(vfs.exists('a/b.txt')).toBe(true);
    expect(vfs.exists('a')).toBe(true); // 目录
    expect(vfs.exists('missing')).toBe(false);
  });

  it('stats files and directories', () => {
    expect(vfs.stat('a/b.txt')).toEqual({ path: 'a/b.txt', isDir: false, size: 1 });
    expect(vfs.stat('a')).toEqual({ path: 'a', isDir: true, size: 0 });
    expect(vfs.stat('missing')).toBeNull();
  });

  it('reads text and bytes', () => {
    expect(vfs.readText('a/b.txt')).toBe('A');
    expect([...vfs.readBytes('a/b.txt')]).toEqual([65]);
  });

  it('throws when reading a missing file', () => {
    expect(() => vfs.readText('missing')).toThrow(/文件不存在/);
    expect(() => vfs.readBytes('missing')).toThrow(/文件不存在/);
  });

  it('lists directory children', () => {
    expect(vfs.listDir('').sort()).toEqual(['a', 'd.txt']);
    expect(vfs.listDir('a').sort()).toEqual(['b.txt', 'c.txt']);
    expect(vfs.listDir('missing')).toEqual([]);
  });

  it('walks files recursively in sorted order', () => {
    expect(vfs.walk('')).toEqual(['a/b.txt', 'a/c.txt', 'd.txt']);
    expect(vfs.walk('a')).toEqual(['a/b.txt', 'a/c.txt']);
  });

  it('supports writing text after construction', () => {
    const m = new MemoryVfs();
    m.writeText('x.txt', 'X');
    expect(m.readText('x.txt')).toBe('X');
  });
});

describe('OverlayVfs', () => {
  const make = (): OverlayVfs => {
    const base = new MemoryVfs({ 'a.txt': 'A', 'b.txt': 'B' });
    const ov = new OverlayVfs(base);
    ov.putText('a.txt', 'A2'); // 覆盖
    ov.putText('c.txt', 'C');  // 新增
    ov.tombstone('b.txt');     // 删除
    return ov;
  };

  it('overrides, adds and tombstones over the base layer', () => {
    const ov = make();
    expect(ov.readText('a.txt')).toBe('A2');
    expect(ov.exists('a.txt')).toBe(true);
    expect(ov.exists('b.txt')).toBe(false);
    expect(ov.stat('b.txt')).toBeNull();
    expect(ov.exists('c.txt')).toBe(true);
    expect(ov.readText('c.txt')).toBe('C');
  });

  it('throws when reading a tombstoned file', () => {
    expect(() => make().readText('b.txt')).toThrow(/墓碑删除/);
  });

  it('reports overlay membership', () => {
    const ov = make();
    expect(ov.hasOverlay('a.txt')).toBe(true);
    expect(ov.hasOverlay('absent.txt')).toBe(false);
  });

  it('walk removes tombstones and keeps overlay additions', () => {
    expect(make().walk('')).toEqual(['a.txt', 'c.txt']);
  });

  it('falls back to the base layer for untouched paths', () => {
    const base = new MemoryVfs({ 'only.txt': 'O' });
    const ov = new OverlayVfs(base);
    expect(ov.readText('only.txt')).toBe('O');
    expect(ov.walk('')).toEqual(['only.txt']);
  });
});

describe('zipVfsFromBytes', () => {
  it('exposes files and skips directory entries', () => {
    const zip = zipSync({
      'a.txt': strToU8('A'),
      'empty.txt': strToU8(''),
      'sub/': new Uint8Array(0),
      'sub/b.txt': strToU8('B'),
    });
    const vfs = zipVfsFromBytes(zip);
    expect(vfs.readText('a.txt')).toBe('A');
    expect(vfs.readText('empty.txt')).toBe(''); // 空文件必须保留
    expect(vfs.readText('sub/b.txt')).toBe('B');
    expect(vfs.walk('')).toEqual(['a.txt', 'empty.txt', 'sub/b.txt']);
  });
});
