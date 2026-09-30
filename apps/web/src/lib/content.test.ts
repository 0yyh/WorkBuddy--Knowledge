/**
 * content.ts · 文档 LRU 缓存（P1-A）单元测试
 *
 * 覆盖：
 *  - 二次访问命中缓存（不再走 fetch）
 *  - knownSlugs.size 变化 → 缓存自然失效（新增词条场景）
 *  - toc 是调用方传入的（缓存命中时也用最新 toc，不复用旧值）
 *  - clearDocumentCaches 清空
 *  - 词条 / 章节按独立 key 缓存
 *
 * 策略：mock contentCache 让 fetchText 走全局 fetch（loader.test.ts 同款），由
 * 测试维护路由表。可控性更强。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./contentCache', () => ({
  ACTIVATED_KEY: 'pks:activated',
  getMeta: vi.fn(async () => false), // 未激活 → fetchText 直读随包
  getCached: vi.fn(async () => null),
  putCached: vi.fn(async () => undefined),
}));

const { loadEntryDocument, loadChapterDocument, clearDocumentCaches } = await import('./content');
import type { TocNode } from '@pks/core';

/** 路由：相对路径 → markdown body */
const routes = new Map<string, string>();

const fetchMock = vi.fn(async (url: string) => {
  const body = routes.get(url);
  return body === undefined
    ? ({ ok: false, status: 404, text: async () => 'not found' } as unknown as Response)
    : ({ ok: true, status: 200, text: async () => body } as unknown as Response);
});

/** 构造带 frontmatter 的最小可用 entry markdown */
function mockEntryMarkdown(body: string): string {
  return `---\ntitle: 测试词条\nstatus: published\nconfidence: high\nrev: 1\n---\n${body}`;
}

/** 构造带 frontmatter 的最小可用 chapter markdown */
function mockChapterMarkdown(body: string): string {
  return `---\ntitle: 测试章节\nstatus: published\nconfidence: high\nrev: 1\norder:\n  - 1\n---\n${body}`;
}

describe('content · 文档 LRU 缓存（P1-A）', () => {
  beforeEach(() => {
    clearDocumentCaches();
    routes.clear();
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('二次访问命中缓存：fetch 只调一次', async () => {
    routes.set('/content/entries/a/entry.md', mockEntryMarkdown('正文 A'));

    const known = new Set(['a']);
    const r1 = await loadEntryDocument('a', known, []);
    const r2 = await loadEntryDocument('a', known, []);

    expect(r1.html).toBe(r2.html);
    expect(fetchMock.mock.calls.length).toBe(1);
  });

  it('knownSlugs.size 变化 → 缓存自然失效', async () => {
    routes.set('/content/entries/a/entry.md', mockEntryMarkdown('正文'));

    const known1 = new Set(['a']);
    const known2 = new Set(['a', 'b']); // 新增词条 → size 变

    await loadEntryDocument('a', known1, []);
    await loadEntryDocument('a', known2, []);

    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it('toc 是调用方当前传入的（不缓存为旧值）', async () => {
    routes.set('/content/entries/a/entry.md', mockEntryMarkdown('正文'));

    const toc1: TocNode[] = [{ k: 'ch1', t: '章1', o: [1] }];
    const toc2: TocNode[] = [
      { k: 'ch1', t: '章1', o: [1] },
      { k: 'ch2', t: '章2', o: [2] },
    ];

    const known = new Set(['a']);
    const r1 = await loadEntryDocument('a', known, toc1);
    const r2 = await loadEntryDocument('a', known, toc2);

    expect(r1.toc).toEqual(toc1);
    expect(r2.toc).toEqual(toc2);
  });

  it('clearDocumentCaches 清空两个 LRU', async () => {
    routes.set('/content/entries/a/entry.md', mockEntryMarkdown('正文'));

    const known = new Set(['a']);
    await loadEntryDocument('a', known, []);
    clearDocumentCaches();
    await loadEntryDocument('a', known, []);

    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it('词条 / 章节按独立 key 缓存：相同 slug 不同章节独立 miss', async () => {
    routes.set('/content/entries/a/chapters/ch1.md', mockChapterMarkdown('章 1'));
    routes.set('/content/entries/a/chapters/ch2.md', mockChapterMarkdown('章 2'));

    const known = new Set(['a']);
    await loadChapterDocument('a', 'ch1', known);
    await loadChapterDocument('a', 'ch1', known); // 命中
    await loadChapterDocument('a', 'ch2', known); // miss

    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it('slug 不同则独立 miss', async () => {
    routes.set('/content/entries/a/entry.md', mockEntryMarkdown('A'));
    routes.set('/content/entries/b/entry.md', mockEntryMarkdown('B'));

    const known = new Set(['a', 'b']);
    await loadEntryDocument('a', known, []);
    await loadEntryDocument('a', known, []); // 命中
    await loadEntryDocument('b', known, []); // miss

    expect(fetchMock.mock.calls.length).toBe(2);
  });
});