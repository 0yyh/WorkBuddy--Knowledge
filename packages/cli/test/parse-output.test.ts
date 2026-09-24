/**
 * parse-output 单测（任务 3）。
 * 覆盖三种 LLM 输出形式：JSON / 多 ``` 围栏 + # file: 标记 / 目录式 --- name --- 标记，
 * 以及规范化（每文件恰好一个 PKS_EXPANDED_V5）与解析失败抛错。
 */
import { describe, expect, it } from 'vitest';
import { parseOutput } from '../src/gen/parse-output.js';

const MINIMAL_ENTRY = {
  entry: {
    schema: 1,
    slug: 'x',
    title: 'X',
    type: 'concept',
    categories: ['a'],
    status: 'stub',
    summary: 's',
    sources: [{ title: 't' }],
  },
  body: 'BODY',
};

describe('parseOutput', () => {
  it('JSON 格式 → entry.md + chapters/ch-01.md', () => {
    const text = JSON.stringify({
      ...MINIMAL_ENTRY,
      chapters: [
        {
          name: 'ch-01.md',
          frontmatter: {
            slug: 'x/ch-01',
            work: 'x',
            key: 'ch-01',
            title: 'C',
            order: [1],
            depth: 1,
            kind: 'content',
          },
          body: 'CHBODY',
        },
      ],
    });
    const m = parseOutput(text);
    expect(m.has('entry.md')).toBe(true);
    expect(m.has('chapters/ch-01.md')).toBe(true);
    expect(m.get('entry.md')).toContain('slug: x');
    expect(m.get('chapters/ch-01.md')).toContain('CHBODY');
  });

  it('多 ``` 围栏 + # file: 标记', () => {
    const text = [
      '以下是生成结果：',
      '```',
      '# file: entry.md',
      'schema: 1',
      'slug: y',
      '---',
      '# Y',
      '```',
      '# file: chapters/ch-02.md',
      '---',
      'slug: y/ch-02',
      '---',
      '第二章',
    ].join('\n');
    const m = parseOutput(text);
    expect(m.has('entry.md')).toBe(true);
    expect(m.has('chapters/ch-02.md')).toBe(true);
    expect(m.get('entry.md')).toContain('slug: y');
    expect(m.get('chapters/ch-02.md')).toContain('第二章');
  });

  it('目录式 --- name --- 标记', () => {
    const text = ['--- entry.md ---', 'schema: 1', 'slug: z', '---', 'Z 正文'].join('\n');
    const m = parseOutput(text);
    expect(m.has('entry.md')).toBe(true);
    expect(m.get('entry.md')).toContain('slug: z');
  });

  it('无法解析 → 抛错', () => {
    expect(() => parseOutput('完全是无关文本，没有任何文件标记')).toThrow(/无法将 LLM 输出/);
  });

  it('规范化：每文件恰好一个 PKS_EXPANDED_V5', () => {
    const m = parseOutput(JSON.stringify({ ...MINIMAL_ENTRY, body: 'b' }));
    const content = m.get('entry.md') as string;
    const matches = content.match(/<!--\s*PKS_EXPANDED_V(\d+)\s*-->/g) ?? [];
    expect(matches.length).toBe(1);
    expect(content).toContain('PKS_EXPANDED_V5');
  });
});
