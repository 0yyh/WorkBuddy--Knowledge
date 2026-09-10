/**
 * Wiki 链接解析（02 §9 / 04 §2.2 内链）。
 * 支持 `[[slug]]`、`[[slug|label]]`、`[[slug/sectionKey]]`、`[[slug/sectionKey|label]]`
 * 与 Markdown 形式 `[text](entry://slug/sectionKey)`。
 */
import type { WikiLinkRef } from '../types.js';

export interface ParsedWikiLink {
  target: string; // slug（可能含 /sectionKey）
  label?: string;
  section?: string;
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const ENTRY_LINK_RE = /\[([^\]]+)\]\(entry:\/\/([^)\s]+)\)/g;

export function extractWikiLinks(md: string): ParsedWikiLink[] {
  const out: ParsedWikiLink[] = [];
  let m: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(md)) !== null) {
    const target = m[1].trim();
    const [slug, section] = splitTarget(target);
    out.push({ target: slug, section, label: m[2]?.trim() });
  }
  ENTRY_LINK_RE.lastIndex = 0;
  while ((m = ENTRY_LINK_RE.exec(md)) !== null) {
    const [slug, section] = splitTarget(m[2].trim());
    out.push({ target: slug, section, label: m[1].trim() });
  }
  return out;
}

function splitTarget(target: string): [string, string | undefined] {
  const idx = target.indexOf('/');
  if (idx === -1) return [target, undefined];
  return [target.slice(0, idx), target.slice(idx + 1)];
}

/** 结合已知 slug 集合，解析为带 resolved 标记的 WikiLinkRef 列表 */
export function resolveWikiLinks(md: string, knownSlugs: Set<string>): WikiLinkRef[] {
  return extractWikiLinks(md).map((l) => ({
    target: l.target,
    label: l.label,
    section: l.section,
    resolved: knownSlugs.has(l.target),
  }));
}
