/**
 * Markdown 渲染与纯文本提取。
 * - `renderMarkdown`：unified 管线 + rehype-sanitize，供阅读器（T04）使用，强制 sanitize（05 §2 安全要求）。
 * - `toPlainText`：去除标记，供索引/摘要/字数统计使用（构建期同步调用，不引入 unified）。
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeSanitize, {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      code: [...(defaultSchema.attributes?.code ?? []), ['className']],
      span: [['className']],
      div: [['className']],
    },
  })
  .use(rehypeStringify);

/** 渲染 Markdown → 已 sanitize 的 HTML 字符串 */
export async function renderMarkdown(md: string): Promise<string> {
  const file = await processor.process(md);
  return String(file);
}

/** 去除 Markdown 标记，得到可用于索引/摘要的纯文本 */
export function toPlainText(md: string): string {
  let s = md;

  // 代码块：整段移除（内容不进索引）
  s = s.replace(/```[\s\S]*?```/g, ' ');
  s = s.replace(/~~~[\s\S]*?~~~/g, ' ');

  // 行内代码
  s = s.replace(/`([^`]+)`/g, '$1');

  // 数学块/行内数学：保留公式内文字
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  s = s.replace(/\$([^$\n]+)\$/g, '$1');

  // 图片 ![alt](url) → 保留 alt
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

  // 链接 [text](url) → text；wiki [[slug|label]] / [[slug]] → label/slug
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, t, label) => (label ? label : t));

  // 标题 #、列表 -/*、引用 >、分隔线
  s = s.replace(/^#{1,6}\s+/gm, '');
  s = s.replace(/^\s*[-*+]\s+/gm, '');
  s = s.replace(/^\s*>\s?/gm, '');
  s = s.replace(/^\s*\d+\.\s+/gm, '');
  s = s.replace(/^={3,}\s*$/gm, ' ');
  s = s.replace(/^-{3,}\s*$/gm, ' ');

  // 粗体/斜体标记
  s = s.replace(/(\*\*|__)(.*?)\1/g, '$2');
  s = s.replace(/(\*|_)(.*?)\1/g, '$2');

  // 脚注引用 [^1]
  s = s.replace(/\[\^[\w-]+\]/g, ' ');

  // 折叠 HTML 标签（保险）
  s = s.replace(/<[^>]+>/g, ' ');

  return s.replace(/\s+/g, ' ').trim();
}
