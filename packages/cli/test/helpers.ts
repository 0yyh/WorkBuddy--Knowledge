/**
 * 生成管线测试的共享夹具（非测试文件，vitest include 仅匹配 *.test.ts）。
 *
 * 提供一个「完全 lint 通过」的词条生成结果（entry + 1 章），被 FileProvider 闭环测试、
 * OpenAIProvider 重试测试共用，保证两条 provider 走的是同一套真实产物。
 *
 * 全部落在临时目录，绝不触碰真实 content/entries。
 */
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const TEST_SLUG = 'sample-concept';
export const TEST_CATEGORY = '根/概念';

/**
 * 一个 lint 全绿的词条生成结果（JSON 形式，与 parse-output.ts 的输入对齐）：
 * entry + body + 1 个 chapters/ch-01.md。categories 与 TEST_CATEGORY 一致，
 * sources / summary / tldr 等字段均满足 validateEntryMeta / validateSectionMeta / L002~L009。
 */
export function buildModelResponse(): string {
  const entry = {
    schema: 1,
    slug: TEST_SLUG,
    title: '示例概念',
    aliases: ['示例概念别名'],
    type: 'concept',
    categories: [TEST_CATEGORY],
    tags: ['测试'],
    summary:
      '这是一段用于批量生成管线测试的固定示例摘要内容。它的长度被刻意控制在八十到三百字之间，以满足 L008 的 published 摘要校验要求，从而让生成的词条能够一次性通过 lint 而不需要重做。',
    status: 'published',
    confidence: 'medium',
    license: 'CC-BY-SA-4.0',
    ai_generated: true,
    ai_annotated: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    rev: 1,
    sources: [{ title: '测试来源', url: 'https://example.com/s', license: 'CC-BY-SA-4.0' }],
  };
  const chapters = [
    {
      name: 'ch-01.md',
      frontmatter: {
        schema: 1,
        slug: `${TEST_SLUG}/ch-01`,
        work: TEST_SLUG,
        key: 'ch-01',
        title: '第一章 示例',
        order: [1],
        depth: 1,
        kind: 'content',
        status: 'published',
        license: 'CC-BY-SA-4.0',
        ai_generated: true,
        ai_annotated: true,
        sources: [{ title: '测试来源', url: 'https://example.com/s', license: 'CC-BY-SA-4.0' }],
        summary: { tldr: '本章介绍示例概念的第一章内容。', keyPoints: ['要点一', '要点二'] },
      },
      body: '## 第一章 标题\n\n这是第一章的正文内容，用于演示生成管线。\n\n### 小节\n一些细节说明。',
    },
  ];
  return JSON.stringify({ entry, body: '示例词条正文。', chapters });
}

/**
 * 在给定 content 根目录下铺好闭环测试所需的最小结构：taxonomy.yaml（含 TEST_CATEGORY）
 * + workorder.yaml（含 TEST_SLUG）。不创建任何 entries。
 */
export function setupContentFixture(root: string): void {
  mkdirSync(join(root, 'entries'), { recursive: true });
  writeFileSync(
    join(root, 'taxonomy.yaml'),
    '- id: root\n  title: 根\n  order: 1\n  children:\n    - id: concept\n      title: 概念\n      order: 1\n',
    'utf8',
  );
  const workOrder = [
    'items:',
    `  - slug: ${TEST_SLUG}`,
    '    title: 示例概念',
    `    categories: [${TEST_CATEGORY}]`,
    '    outline:',
    '      - 第一章',
  ].join('\n');
  writeFileSync(join(root, 'workorder.yaml'), workOrder, 'utf8');
}

/** 把模型应答写入 answers/{slug}.json（FileProvider 的读取格式 { text }）。 */
export function writeAnswers(root: string, slug: string, text: string): void {
  const dir = join(root, 'answers');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${slug}.json`), JSON.stringify({ text }), 'utf8');
}

/** 删除 answers/{slug}.json（用于验证「跳过已 done 的 slug」时 provider 不再被调用）。 */
export function deleteAnswers(root: string, slug: string): void {
  rmSync(join(root, 'answers', `${slug}.json`), { force: true });
}

/** 创建带前缀的临时目录。 */
export function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'pks-gen-test-'));
}
