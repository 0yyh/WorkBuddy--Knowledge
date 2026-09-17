/**
 * hashEntryDir（词条目录内容指纹 · ② 增量构建）单测 · T05 回归加固。
 *
 * 该函数此前**零测试**，却是增量构建正确性的根基。它承担一个二分判定：
 *   未变 → 复用旧分片 postings（跳过分词）；变了 → 重新分词。
 *
 * 判定错的两个方向后果不对称，且都很难发现：
 *  - **假阴性（内容变了但 hash 没变）**：复用旧索引 → 搜到的正文与实际内容不符，
 *    表现为「改了内容但搜索结果没更新」，没有任何报错；
 *  - **假阳性（内容没变但 hash 变了）**：增量失效退化为全量，只是慢，属可接受退化。
 *
 * 所以这里重点锁死「**无关因素不得影响 hash**」与「**任何实质变化必须改变 hash**」。
 * 尤其 `listDir` 的返回顺序属于无关因素 —— 它若渗进 hash，同一份内容在不同
 * 平台/不同构建下会得到不同指纹，增量复用将变成随机行为。
 */
import { describe, it, expect } from 'vitest';
import { MemoryVfs } from '../src/vfs/memory.js';
import { hashEntryDir } from '../src/content/hash.js';
import { sha1 } from '../src/util/sha1.js';
import type { Vfs } from '../src/vfs/types.js';

/** 让 listDir / walk 返回**逆序**结果，用于证明指纹与枚举顺序无关 */
class ReversedListVfs implements Vfs {
  private inner: Vfs;
  constructor(inner: Vfs) {
    this.inner = inner;
  }
  exists(path: string): boolean {
    return this.inner.exists(path);
  }
  stat(path: string) {
    return this.inner.stat(path);
  }
  readText(path: string): string {
    return this.inner.readText(path);
  }
  readBytes(path: string): Uint8Array {
    return this.inner.readBytes(path);
  }
  listDir(path: string): string[] {
    return [...this.inner.listDir(path)].reverse();
  }
  walk(path: string): string[] {
    return [...this.inner.walk(path)].reverse();
  }
}

/** 基准词条目录 */
const fixture = (): Record<string, string> => ({
  'entries/demo/entry.md': '# 演示词条\n\n这是定位段。',
  'entries/demo/chapters/ch-01.md': '第一章正文',
  'entries/demo/chapters/ch-02.md': '第二章正文',
});

const hashOf = (files: Record<string, string>, slug = 'demo'): string =>
  hashEntryDir(new MemoryVfs(files), slug);

describe('hashEntryDir（稳定性与无关因素）', () => {
  it('稳定性：同一内容多次计算恒得同一指纹（跨调用可复现）', () => {
    expect(hashOf(fixture())).toBe(hashOf(fixture()));
  });

  it('输出为 40 位十六进制（sha1 形态）', () => {
    expect(hashOf(fixture())).toMatch(/^[0-9a-f]{40}$/);
  });

  it('★ 枚举顺序无关：listDir 逆序仍得同一指纹（增量复用的前提）', () => {
    const plain = hashEntryDir(new MemoryVfs(fixture()), 'demo');
    const reversed = hashEntryDir(new ReversedListVfs(new MemoryVfs(fixture())), 'demo');
    expect(reversed).toBe(plain);
  });

  it('★ 无关文件不参与：chapters 下的非 .md 文件不影响指纹', () => {
    const withJunk = { ...fixture(), 'entries/demo/chapters/notes.txt': '随手记的笔记' };
    expect(hashOf(withJunk)).toBe(hashOf(fixture()));
  });

  it('★ 无关目录不参与：其他 slug 的内容不影响本词条指纹', () => {
    const withOther = { ...fixture(), 'entries/other/entry.md': '别的词条' };
    expect(hashOf(withOther, 'demo')).toBe(hashOf(fixture(), 'demo'));
  });
});

describe('hashEntryDir（变化必须被感知 —— 这是「跳过分词」的安全边界）', () => {
  it('★ entry.md 内容变化 → 指纹改变', () => {
    const changed = { ...fixture(), 'entries/demo/entry.md': '# 演示词条\n\n定位段已改写。' };
    expect(hashOf(changed)).not.toBe(hashOf(fixture()));
  });

  it('★ 任一章节内容变化 → 指纹改变', () => {
    const changed = { ...fixture(), 'entries/demo/chapters/ch-02.md': '第二章正文（修订）' };
    expect(hashOf(changed)).not.toBe(hashOf(fixture()));
  });

  it('★ 新增章节 → 指纹改变', () => {
    const added = { ...fixture(), 'entries/demo/chapters/ch-03.md': '第三章正文' };
    expect(hashOf(added)).not.toBe(hashOf(fixture()));
  });

  it('★ 删除章节 → 指纹改变', () => {
    const removed = fixture();
    delete removed['entries/demo/chapters/ch-02.md'];
    expect(hashOf(removed)).not.toBe(hashOf(fixture()));
  });

  it('★ 单字符改动即被感知（不得做规范化裁剪）', () => {
    const changed = { ...fixture(), 'entries/demo/chapters/ch-01.md': '第一章正文。' };
    expect(hashOf(changed)).not.toBe(hashOf(fixture()));
  });

  it('★ 内容在文件间「搬家」→ 指纹改变（路径参与哈希）', () => {
    // 等量同内容，但章节文件名不同 → 视为不同快照
    const moved = {
      'entries/demo/entry.md': '# 演示词条\n\n这是定位段。',
      'entries/demo/chapters/ch-01.md': '第二章正文',
      'entries/demo/chapters/ch-02.md': '第一章正文',
    };
    expect(hashOf(moved)).not.toBe(hashOf(fixture()));
  });

  it('★ 同样内容放在不同 slug 下 → 指纹不同（路径参与哈希）', () => {
    const sameContentOtherSlug: Record<string, string> = {
      'entries/other/entry.md': '# 演示词条\n\n这是定位段。',
      'entries/other/chapters/ch-01.md': '第一章正文',
      'entries/other/chapters/ch-02.md': '第二章正文',
    };
    expect(hashOf(sameContentOtherSlug, 'other')).not.toBe(hashOf(fixture(), 'demo'));
  });
});

describe('hashEntryDir（容错：目录不全时不得抛错）', () => {
  it('缺 chapters/ → 不抛错，仅以 entry.md 参与指纹', () => {
    const noChapters = { 'entries/demo/entry.md': '# 演示词条\n\n这是定位段。' };
    expect(() => hashOf(noChapters)).not.toThrow();
    expect(hashOf(noChapters)).toMatch(/^[0-9a-f]{40}$/);
    expect(hashOf(noChapters)).not.toBe(hashOf(fixture()));
  });

  it('缺 entry.md → 不抛错，仅以章节参与指纹', () => {
    const noEntry = {
      'entries/demo/chapters/ch-01.md': '第一章正文',
      'entries/demo/chapters/ch-02.md': '第二章正文',
    };
    expect(() => hashOf(noEntry)).not.toThrow();
    expect(hashOf(noEntry)).not.toBe(hashOf(fixture()));
  });

  it('目录完全不存在 → 不抛错（返回空内容指纹，供调用方按「无法复用」处理）', () => {
    expect(() => hashOf({}, 'ghost')).not.toThrow();
    expect(hashOf({}, 'ghost')).toMatch(/^[0-9a-f]{40}$/);
  });

  it('空词条目录（存在但无文件）与不存在目录指纹一致（均为空序列化）', () => {
    expect(hashOf({}, 'ghost')).toBe(hashOf({ 'entries/other/entry.md': 'x' }, 'ghost'));
  });
});

describe('hashEntryDir（与序列化规约一致）', () => {
  it('等于按「# 路径\\n内容」拼接后取 sha1（显式固化序列化格式）', () => {
    const expected = sha1(
      [
        '# entries/demo/entry.md\n# 演示词条\n\n这是定位段。',
        '# chapters/ch-01.md\n第一章正文',
        '# chapters/ch-02.md\n第二章正文',
      ].join('\n\n'),
    );
    expect(hashOf(fixture())).toBe(expected);
  });
});
