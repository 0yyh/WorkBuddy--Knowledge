/**
 * 标题 slugify：中文保留，空格转连字符（02 §9.6 锚点约定）。
 * 与渲染层锚点生成保持一致，供 TOC 跳转。
 */
export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
