/**
 * 正文装载层：拉取 entry.md / chapters/*.md，切分并校验 front-matter，
 * 再用 @pks/core 的 renderMarkdown（内含 rehype-sanitize）产出安全 HTML。
 *
 * 安全约定（05 §2）：本应用从不拼接未净化的 HTML，UI 层仅渲染本模块返回的 html 字段。
 */
import {
  LRUCache,
  parseYamlFrontmatter,
  renderMarkdown,
  resolveWikiLinks,
  validateEntryMeta,
  validateSectionMeta,
} from '@pks/core';
import type { EntryMeta, SectionMeta, TocNode, Track } from '@pks/core';
import { fetchJson, fetchText } from './loader';
import type { ChapterDocument, EntryDocument, HeadingView, TrackSummary } from '../types';

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const ENTRY_LINK_RE = /\[([^\]]+)\]\(entry:\/\/([^)\s]+)\)/g;

/* ------------------------------- 文档 LRU ------------------------------- */
/**
 * P1-A：阅读页二次访问（最近阅读 / 搜索结果回点 / 收藏）的「整篇文档」LRU。
 *
 * @pks/core 内部的 `renderMarkdown` 已对最终 HTML 字符串按 `entry:<slug>` /
 * `chapter:<slug>:<key>` 做 LRU(64)；本模块在外层再叠加一层「完整 EntryDocument /
 * ChapterDocument」缓存，把**入口外的 fetchText + parseYamlFrontmatter +
 * validateMeta + renderMarkdown**（YAML 解析、schema 校验、wiki link 转换）
 * 整段全部跳过，命中即同步返回对象引用（~0 ms）。
 *
 * 失效：cacheKey 用 `slug#knownSlugs.size`。新词条录入会让 size 同步增长 →
 * key 变化 → 旧缓存自然失效，无需显式 clear。reload / OTA 后 App 上下文重建
 * 新的 knownSlugs（Set 新引用），size 会变化，同样触发自然失效。
 * 重置场景（OTA 失败回退随包内容、debug 主动清空）调 `clearDocumentCaches`。
 *
 * 容量估算：entry 80（80 个词条全量正文，每词条平均 30 KB markdown → ~2.4 MB
 * 渲染后 HTML 缓存）+ chapter 200（80 词条 × 平均 2.5 章 / 篇，热点阅读深度的
 * 全部覆盖）= ~10 MB 内存上限，移动端可接受。
 */
const entryDocCache = new LRUCache<string, EntryDocument>(80);
const chapterDocCache = new LRUCache<string, ChapterDocument>(200);

/** 清空文档 LRU（reload / 调试用） */
export function clearDocumentCaches(): void {
  entryDocCache.clear();
  chapterDocCache.clear();
}

export interface LinkifyResult {
  md: string;
  unresolved: string[];
}

/**
 * 把 `[[slug|label]]` / `[label](entry://slug)` 转成站内哈希链接 `[label](#/entry/slug)`。
 * 转换发生在 renderMarkdown 之前，之后仍然经过 rehype-sanitize —— 净化始终是最后一道关卡。
 *
 * @param md 原始 Markdown 正文
 * @param knownSlugs 已录入词条集合（用于标记失效链接）
 */
export function linkifyMarkdown(md: string, knownSlugs: Set<string>): LinkifyResult {
  const unresolved = new Set<string>();
  const refs = resolveWikiLinks(md, knownSlugs);
  for (const ref of refs) if (!ref.resolved) unresolved.add(ref.target);

  const splitTarget = (target: string): [string, string | undefined] => {
    const idx = target.indexOf('/');
    return idx === -1 ? [target, undefined] : [target.slice(0, idx), target.slice(idx + 1)];
  };

  let out = md.replace(WIKILINK_RE, (_m, targetRaw: string, label?: string) => {
    const [slug] = splitTarget(targetRaw.trim());
    const text = (label && label.trim()) || targetRaw.trim();
    return `[${text}](#/entry/${slug})`;
  });

  out = out.replace(ENTRY_LINK_RE, (_m, label: string, targetRaw: string) => {
    const [slug] = splitTarget(targetRaw.trim());
    return `[${label.trim()}](#/entry/${slug})`;
  });

  return { md: out, unresolved: [...unresolved] };
}

/** 从正文推导标题目录（剔除代码块内的 # ） */
export function extractHeadings(body: string): HeadingView[] {
  const bodyNoCode = body.replace(/```[\s\S]*?```/g, '').replace(/~~~[\s\S]*?~~~/g, '');
  const out: HeadingView[] = [];
  for (const line of bodyNoCode.split(/\r?\n/)) {
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2].replace(/[*_`]/g, '').trim() });
  }
  return out;
}

/** 目录行（阅读器 / 详情页章节列表通用） */
export interface ChapterListEntry {
  key: string;
  title: string;
  words: number;
  order: number[];
  kind: 'content' | 'container';
}

/** 把 TocNode（可能嵌套 children）拍平成有序目录行 */
export function flattenChapterList(toc: TocNode[]): ChapterListEntry[] {
  const out: ChapterListEntry[] = [];
  const walk = (nodes: TocNode[]): void => {
    for (const n of nodes) {
      out.push({
        key: n.k,
        title: n.t,
        words: n.w ?? 0,
        order: n.o ?? [],
        kind: n.kd ?? 'content',
      });
      if (n.c) walk(n.c);
    }
  };
  walk(toc);
  return out;
}

/** 装载并渲染词条正文 */
export async function loadEntryDocument(
  slug: string,
  knownSlugs: Set<string>,
  toc: TocNode[] = [],
): Promise<EntryDocument> {
  // P1-A：文档 LRU 命中检查（knownSlugs.size 作为失效标识：新增词条会让 size 同步增长）。
  const cacheKey = `${slug}#${knownSlugs.size}`;
  const hit = entryDocCache.get(cacheKey);
  if (hit) {
    // toc 由调用方传入（每次可能不同：reader / cover / browse 三处各自的 toc）
    // 其余字段全部来自缓存命中，省 fetchText + parseYamlFrontmatter + validateMeta + renderMarkdown。
    return { ...hit, toc };
  }

  const raw = await fetchText(`entries/${slug}/entry.md`);
  const fm = parseYamlFrontmatter(raw);
  if (!fm.data) throw new Error(`词条 ${slug} 缺少 front-matter：${fm.error ?? '未知原因'}`);

  const validated = validateEntryMeta(fm.data);
  const meta: EntryMeta = validated.value;
  const linkified = linkifyMarkdown(fm.body, knownSlugs);
  const html = await renderMarkdown(linkified.md, `entry:${slug}`);

  const doc: EntryDocument = {
    slug,
    meta,
    html,
    body: fm.body,
    headings: extractHeadings(linkified.md),
    toc,
    unresolved: linkified.unresolved,
    warnings: [...validated.errors, ...validated.warnings],
  };
  entryDocCache.set(cacheKey, doc);
  return doc;
}

/** 装载并渲染单章正文 */
export async function loadChapterDocument(
  slug: string,
  key: string,
  knownSlugs: Set<string>,
): Promise<ChapterDocument> {
  // P1-A：文档 LRU 命中检查。
  const cacheKey = `${slug}#${key}#${knownSlugs.size}`;
  const hit = chapterDocCache.get(cacheKey);
  if (hit) return hit;

  const raw = await fetchText(`entries/${slug}/chapters/${key}.md`);
  const fm = parseYamlFrontmatter(raw);
  let meta: SectionMeta | null = null;
  let body = fm.body;
  if (fm.data) {
    meta = validateSectionMeta(fm.data).value;
  }
  const linkified = linkifyMarkdown(body, knownSlugs);
  const html = await renderMarkdown(linkified.md, `chapter:${slug}:${key}`);
  const doc: ChapterDocument = {
    key,
    slug,
    meta,
    html,
    tldr: meta?.summary?.tldr,
    keyPoints: meta?.summary?.keyPoints,
    path: meta?.path ?? [],
    title: meta?.title ?? key,
    unresolved: linkified.unresolved,
  };
  chapterDocCache.set(cacheKey, doc);
  return doc;
}

/**
 * 为目录「二级小节」抓取单篇文档（词条导读或单章）的标题层级。
 * 只抽取 Markdown 标题、不渲染整篇，开销极小：
 *  - 词条导读（main）取 level >= 2（H1 是词条大标题，已在目录显示为「序」）；
 *  - 单章（chapter）取 level >= 3（H2 是章节标题，已在目录显示为章节行）。
 * 失败返回空数组，目录降级为不显示小节，不影响阅读。
 */
export async function fetchDocHeadings(
  slug: string,
  doc: { kind: 'main' | 'chapter'; key: string },
  knownSlugs: Set<string>,
): Promise<HeadingView[]> {
  try {
    const raw =
      doc.kind === 'main'
        ? await fetchText(`entries/${slug}/entry.md`)
        : await fetchText(`entries/${slug}/chapters/${doc.key}.md`);
    const fm = parseYamlFrontmatter(raw);
    const body = fm.body ?? raw;
    const linkified = linkifyMarkdown(body, knownSlugs);
    const headings = extractHeadings(linkified.md);
    const minLevel = doc.kind === 'main' ? 2 : 3;
    return headings.filter((h) => h.level >= minLevel);
  } catch {
    return [];
  }
}

/* ------------------------------- Tracks ------------------------------- */

let summariesCache: TrackSummary[] | null = null;
const trackCache = new Map<string, Track>();

/**
 * 读取可用学习序列清单。
 * tracks.json 由 CLI `build:index` 直接产出（已是解析后的 Track 对象），
 * 因此阅读端无需再拉 YAML、也无需在浏览器里跑 js-yaml。
 */
export async function fetchTrackSummaries(): Promise<TrackSummary[]> {
  if (summariesCache) return summariesCache;
  try {
    const data = await fetchJson<{ tracks?: Track[] }>('index/tracks.json');
    const tracks = data.tracks ?? [];
    for (const t of tracks) trackCache.set(t.id, t);
    summariesCache = tracks.map((t) => ({
      id: t.id,
      title: t.title,
      timeline: t.timeline,
      // P0-perf：随 TrackSummary 吐出 itemCount；Home 等展示列表数时不再 await getTrack。
      itemCount: t.items.length,
    }));
  } catch {
    summariesCache = [];
  }
  return summariesCache;
}

/** 按 id 取得 Track（已由 build:index 解析并落盘） */
export async function fetchTrack(trackId: string): Promise<Track> {
  const cached = trackCache.get(trackId);
  if (cached) return cached;

  await fetchTrackSummaries(); // 触发一次 tracks.json 装载并填充缓存
  const found = trackCache.get(trackId);
  if (!found) {
    throw new Error(
      `未找到学习序列「${trackId}」（请确认已执行 pnpm build:index 并同步 index/tracks.json）`,
    );
  }
  return found;
}

