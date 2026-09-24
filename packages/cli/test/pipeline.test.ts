/**
 * FileProvider 闭环测试（任务 1）：run → 落盘 .staging 且 frontmatter 合法 → promote 移入
 * entries 并移走 .staging → 断点续跑（再跑一次）跳过已 done/promoted 的 slug。
 *
 * 全程使用临时目录，绝不污染真实 content/entries。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runPipeline, resume, promote } from '../src/gen/runner.js';
import { parseYamlFrontmatter, validateEntryMeta } from '@pks/core';
import {
  buildModelResponse,
  deleteAnswers,
  makeTmpDir,
  setupContentFixture,
  TEST_SLUG,
  writeAnswers,
} from './helpers.js';

let root: string;

beforeEach(() => {
  root = makeTmpDir();
  setupContentFixture(root);
  writeAnswers(root, TEST_SLUG, buildModelResponse());
});

afterEach(() => {
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  process.exitCode = 0;
});

const readState = () =>
  JSON.parse(readFileSync(join(root, '.pks-gen-state.json'), 'utf8')) as {
    items: Record<string, { status: string; attempts: number }>;
  };

describe('FileProvider 闭环', () => {
  it('run 落盘 .staging 且 frontmatter 合法，promote 移入 entries，再跑跳过', async () => {
    // —— 1) run ——
    await runPipeline({
      contentDir: root,
      workOrderPath: join(root, 'workorder.yaml'),
      provider: 'file',
      answersDir: join(root, 'answers'),
      concurrency: 1,
      strict: true,
    });

    // 落盘：entry.md + chapters/ch-01.md
    expect(existsSync(join(root, '.staging', TEST_SLUG, 'entry.md'))).toBe(true);
    expect(existsSync(join(root, '.staging', TEST_SLUG, 'chapters', 'ch-01.md'))).toBe(true);

    // frontmatter 合法：解析 staged entry.md 并跑 validateEntryMeta 应无致命错误
    const raw = readFileSync(join(root, '.staging', TEST_SLUG, 'entry.md'), 'utf8');
    const { data, error } = parseYamlFrontmatter(raw);
    expect(error).toBeUndefined();
    const { errors } = validateEntryMeta(data as Record<string, unknown>);
    expect(errors).toEqual([]);

    // 状态机：lint 通过后应为 done
    expect(readState().items[TEST_SLUG].status).toBe('done');

    // —— 2) promote ——
    promote(root, TEST_SLUG);
    expect(existsSync(join(root, 'entries', TEST_SLUG, 'entry.md'))).toBe(true);
    expect(existsSync(join(root, 'entries', TEST_SLUG, 'chapters', 'ch-01.md'))).toBe(true);
    expect(existsSync(join(root, '.staging', TEST_SLUG))).toBe(false);
    expect(readState().items[TEST_SLUG].status).toBe('promoted');

    // —— 3) 断点续跑：删掉 answers，再 run 应跳过已 promoted 的 slug（不再调用 provider）——
    deleteAnswers(root, TEST_SLUG);
    await runPipeline({
      contentDir: root,
      workOrderPath: join(root, 'workorder.yaml'),
      provider: 'file',
      answersDir: join(root, 'answers'),
      concurrency: 1,
      strict: true,
    });
    // 仍为 promoted（未被重新生成），且 entries 仍在、.staging 未被重建
    expect(readState().items[TEST_SLUG].status).toBe('promoted');
    expect(existsSync(join(root, 'entries', TEST_SLUG, 'entry.md'))).toBe(true);
    expect(existsSync(join(root, '.staging', TEST_SLUG))).toBe(false);
  });

  it('resume 跳过已 done 的 slug（删除 answers 后再 resume 不应触发 provider）', async () => {
    await runPipeline({
      contentDir: root,
      workOrderPath: join(root, 'workorder.yaml'),
      provider: 'file',
      answersDir: join(root, 'answers'),
      concurrency: 1,
      strict: true,
    });
    expect(readState().items[TEST_SLUG].status).toBe('done');

    // 删除 answers 后 resume：若未跳过，FileProvider 会抛「找不到 answers 文件」→ failed。
    deleteAnswers(root, TEST_SLUG);
    await resume({
      contentDir: root,
      workOrderPath: join(root, 'workorder.yaml'),
      provider: 'file',
      answersDir: join(root, 'answers'),
      concurrency: 1,
      strict: true,
    });
    expect(readState().items[TEST_SLUG].status).toBe('done');
  });
});
