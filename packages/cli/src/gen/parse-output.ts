/**
 * 解析 LLM 输出为文件集 Map<filename, content>（T03）。
 *
 * 支持三种形式：
 *  (a) 单个 JSON：{ entry:{...}, body:'...', chapters:[{name, frontmatter, body}] }
 *  (b) 多个带文件名标记的围栏块：块首行 `# file: entry.md` 或 `--- entry.md ---`
 *  (c) 直接以 `# file:` / `--- name ---` 行的目录文件清单
 *
 * 解析失败抛出错误，由 runner 触发重试（把错误拼回 prompt）。
 */
import { yamlDump } from '@pks/core';

const FENCE_RE = /^\s*```/;
const FILE_HASH_RE = /^\s*#\s*file:\s*(\S+)\s*$/;
const FILE_DASH_RE = /^\s*---\s*(\S+)\s*---\s*$/;
const CH_RE = /^ch-\d+\.md$/;

/**
 * 规范化每文件的 PKS_EXPANDED 标记：剥离所有残留形态（double-wrap / 单注释 / 裸 token，含 V1~V6），
 * 追加单一 `<!-- PKS_EXPANDED_V5 -->`。生成管线产出即合规，使 lint L009 通过（否则每篇生成稿都会被判缺标记）。
 */
const MARKER_STRIP_RE = [
  /<!--\s*<!--\s*PKS_EXPANDED_V\d+\s*-->\s*-->/g,
  /<!--\s*PKS_EXPANDED_V\d+\s*-->/g,
  /PKS_EXPANDED_V\d+/g,
];
export function normalizeMarker(content: string): string {
  let s = content;
  for (const re of MARKER_STRIP_RE) s = s.replace(re, '');
  s = s.replace(/\s+$/, '');
  return s + '\n\n<!-- PKS_EXPANDED_V5 -->\n';
}

export function parseOutput(text: string): Map<string, string> {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      if (obj && typeof obj === 'object' && 'entry' in obj) {
        return fromJson(obj as Record<string, unknown>);
      }
    } catch {
      // 不是合法 JSON，继续尝试围栏/标记解析
    }
  }
  const files = fromMarkers(text);
  if (files.size === 0) {
    throw new Error(
      'parseOutput: 无法将 LLM 输出解析为文件集。请使用 JSON {entry,body,chapters} 或带 `# file: <name>` 标记的文件块。',
    );
  }
  return files;
}

function fromJson(obj: Record<string, unknown>): Map<string, string> {
  const files = new Map<string, string>();
  const entry = obj.entry;
  if (!entry || typeof entry !== 'object') {
    throw new Error('parseOutput: JSON 缺少 entry 对象');
  }
  const entryBody = typeof obj.body === 'string' ? obj.body : '';
  files.set('entry.md', normalizeMarker(`---\n${yamlDump(entry)}\n---\n${entryBody}`));

  const chapters = Array.isArray(obj.chapters) ? (obj.chapters as unknown[]) : [];
  for (const raw of chapters) {
    if (!raw || typeof raw !== 'object') continue;
    const ch = raw as Record<string, unknown>;
    const name = typeof ch.name === 'string' ? ch.name : 'ch-01.md';
    const key = name.includes('/') ? name : CH_RE.test(name) ? `chapters/${name}` : name;
    const fm = ch.frontmatter && typeof ch.frontmatter === 'object' ? yamlDump(ch.frontmatter) : '';
    const body = typeof ch.body === 'string' ? ch.body : '';
    files.set(key, normalizeMarker(`---\n${fm}\n---\n${body}`));
  }
  if (files.size === 0) {
    throw new Error('parseOutput: JSON 未产生任何文件');
  }
  return files;
}

function fromMarkers(text: string): Map<string, string> {
  const files = new Map<string, string>();
  const lines = text.split(/\r?\n/);
  let curName: string | null = null;
  let buf: string[] = [];
  const flush = (): void => {
    if (curName && buf.length) {
      let content = buf.join('\n');
      content = content.replace(/^\n+/, '').replace(/\n+$/, '') + '\n';
      const key = curName.includes('/') ? curName : CH_RE.test(curName) ? `chapters/${curName}` : curName;
      files.set(key, normalizeMarker(content));
    }
    buf = [];
  };
  for (const line of lines) {
    const mh = line.match(FILE_HASH_RE);
    const md = line.match(FILE_DASH_RE);
    if (mh || md) {
      flush();
      curName = mh ? mh[1] : md![1];
      continue;
    }
    if (FENCE_RE.test(line)) continue; // 跳过 ``` 围栏行
    if (curName) buf.push(line);
  }
  flush();
  return files;
}
