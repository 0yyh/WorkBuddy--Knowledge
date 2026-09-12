/**
 * prompt 构造（T03）。为生成器构造严格约束的 system/user 消息：
 *  - frontmatter schema 说明（entry.md / chapters/*.md）
 *  - lint 8 条硬契约
 *  - taxonomy 上下文（合法 categories 路径）
 *  - outline 章节骨架
 *  - sources 溯源要求
 *  - 明确的输出格式（与 parse-output.ts 对齐）
 */
import type { WorkOrderItem } from './workorder.js';

export interface PromptContext {
  /** taxonomy 中所有合法类目路径（用于提示模型） */
  validPaths: string[];
}

const LINT_CONTRACT = `你生成的文件必须满足以下 8 条硬性校验（lint），任一失败都会被退回重做：
- L001 slug 唯一：整站 slug 不得重复
- L002 类目存在：entry 的 categories 每项必须属于 taxonomy 中的真实路径
- L003 章节≤20000字：单章正文（含标题）不超过 20000 字
- L004 tldr≤120字：每章 summary.tldr 不超过 120 字
- L005 cross_timeline 双维度：若被标记跨时间线，timeline 至少 2 个维度
- L006 see_also 存在：see_also 指向的 slug 必须已存在（可留空）
- L007 section slug 唯一：章节 slug 不得重复
- L008 published 摘要 80–300字：status=published 时 summary 介于 80–300 字`;

const FORMAT_SPEC = `输出格式（任选其一，推荐 JSON）：
【格式 A：单个 JSON】
\`\`\`json
{
  "entry": { "...entry.md 的 frontmatter 字段对象..." },
  "body": "entry.md 的 Markdown 正文（不含 frontmatter）",
  "chapters": [
    { "name": "ch-01.md", "frontmatter": { "...": "..." }, "body": "章节 Markdown 正文" },
    { "name": "ch-02.md", "frontmatter": { "...": "..." }, "body": "..." }
  ]
}
\`\`\`

【格式 B：带文件名标记的块】
\`\`\`markdown
# file: entry.md
---  ← 下面是该文件的完整内容（含 frontmatter 与正文）
schema: 1
slug: <slug>
...
---
# 标题
正文...
# file: chapters/ch-01.md
---
schema: 1
...
---
## 章节标题
正文...
\`\`\`

务必保证：entry 与每章都带有合法的 YAML frontmatter（以 --- 包裹），
且章节 frontmatter 的 key（如 ch-01）= 文件名去扩展名、work = entry 的 slug。`;

export function buildSystemPrompt(ctx: PromptContext): string {
  const tax = ctx.validPaths.length
    ? ctx.validPaths.map((p) => `- ${p}`).join('\n')
    : '(taxonomy 为空或不可用)';
  return `你是 PKS 知识站的词条生成助手。你只输出结构化的「目录文件集」，由下游管线写入磁盘并做 lint 校验。

# taxonomy 合法类目路径（categories 只能从下列选取）
${tax}

# frontmatter schema
entry.md 顶层字段：schema(=1), slug(小写连字符 ^[a-z0-9]+(-[a-z0-9]+)*$), title, aliases(列表), type(concept|work|person|event|term), categories(真实路径列表), tags(列表), summary(折叠 >-，80–300字), status(published|stub|draft|deprecated), confidence(high|medium|low), license(如 CC-BY-SA-4.0), ai_generated(true), ai_annotated(true), created_at/updated_at(YYYY-MM-DD), rev(=1), sources(至少1条 {title,url,license}), see_also(已存在 slug 列表，可空)。
chapters/ch-NN.md 字段：schema(=1), slug(<entry>/ch-NN), work(<entry>), key(ch-NN), title, order([N] 1–3长度数字数组), path([标题]), depth(1|2|3), status, license, ai_generated(true), ai_annotated(true), sources(至少1条), summary({ tldr(≤120字), keyPoints(≤8条) })。

# lint 8 条硬契约
${LINT_CONTRACT}

# 输出格式
${FORMAT_SPEC}

注意：YAML 列表项不要以引号开头；summary 用 >- 折叠写法；正文用 Markdown，可含 ## 章标题、### 小节、> 编者注。`;
}

export function buildUserPrompt(item: WorkOrderItem): string {
  const categories = item.categories.map((c) => `- ${c}`).join('\n');
  const outline = item.outline.map((o, i) => `${i + 1}. ${o}`).join('\n');
  const sources = (item.sources ?? [])
    .map((s) => `- ${s.title} <${s.url}> (${s.license ?? 'Fair-Use'})`)
    .join('\n');
  const seeAlso = (item.see_also ?? []).length ? item.see_also!.join(', ') : '(无，可空)';
  const timeline = (item.timeline ?? []).length ? item.timeline!.join(', ') : '(无)';
  const material = item.material ? `\n# 参考素材 / 材料\n${item.material}\n` : '';
  const hint = item.provider_hint ? `\n# 生成提示\n${item.provider_hint}\n` : '';
  return `# 待生成词条
slug: ${item.slug}
title: ${item.title}
categories:
${categories}
timeline: ${timeline}
see_also(指向已存在 slug): ${seeAlso}

# 章节骨架（outline，章节数=${item.outline.length}）
${outline}

# 溯源来源（sources，至少1条）
${sources || '(无)'}
${material}${hint}
请按上述大纲与来源，生成「${item.title}」词条的 entry.md 与 ${item.outline.length} 个 chapters/ch-NN.md 文件，严格遵守 lint 8 条与 frontmatter schema，并按指定格式输出。`;
}
