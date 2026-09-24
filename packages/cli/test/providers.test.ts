/**
 * Provider 单测 + 生成回路退避重试（任务 2）。
 *  - FileProvider：answers 读取 / 各类错误分支。
 *  - OpenAIProvider：缺参构造报错；200 解析文本；5xx/429 抛出（交由 runner 退避重试）。
 *  - 退避重试（runner 层，复用真实 OpenAIProvider + mock fetch）：
 *      5xx / 429 连续失败 → 退避重试 3 次后判定 failed（attempts=3）；
 *      首次 5xx 后恢复 → done（attempts=2）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FileProvider } from '../src/gen/providers/file.js';
import { OpenAIProvider } from '../src/gen/providers/openai.js';
import { runPipeline } from '../src/gen/runner.js';
import {
  buildModelResponse,
  makeTmpDir,
  setupContentFixture,
  TEST_SLUG,
} from './helpers.js';

const RESPONSE = buildModelResponse();

describe('OpenAIProvider', () => {
  it('缺少 baseUrl / apiKey / model 时构造报错', () => {
    expect(() => new OpenAIProvider({ baseUrl: '', apiKey: 'k', model: 'm' })).toThrow(/BASE_URL/i);
    expect(() => new OpenAIProvider({ baseUrl: 'http://llm', apiKey: '', model: 'm' })).toThrow(/API_KEY/i);
    expect(() => new OpenAIProvider({ baseUrl: 'http://llm', apiKey: 'k', model: '' })).toThrow(/MODEL/i);
  });

  it('200 响应解析出文本，且请求体含 model / system / user', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'hello' } }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const p = new OpenAIProvider({ baseUrl: 'http://llm', apiKey: 'k', model: 'm' });
    const r = await p.generate({ system: 'SYS', user: 'USR' });
    expect(r.text).toBe('hello');
    expect(fetchMock).toHaveBeenCalledOnce();
    const reqBody = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(reqBody.model).toBe('m');
    expect(reqBody.messages[0]).toEqual({ role: 'system', content: 'SYS' });
    expect(reqBody.messages[1]).toEqual({ role: 'user', content: 'USR' });
  });

  it('5xx 抛出（交由 runner 退避重试）', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const p = new OpenAIProvider({ baseUrl: 'http://llm', apiKey: 'k', model: 'm' });
    await expect(p.generate({ system: 's', user: 'u' })).rejects.toThrow(/503/);
  });

  it('429 抛出（限流，交由 runner 退避重试）', async () => {
    const fetchMock = vi.fn(async () => new Response('rate', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    const p = new OpenAIProvider({ baseUrl: 'http://llm', apiKey: 'k', model: 'm' });
    await expect(p.generate({ system: 's', user: 'u' })).rejects.toThrow(/429/);
  });
});

describe('FileProvider', () => {
  it('从 answers/{slug}.json 读取，并从 user prompt 解析 slug', async () => {
    const dir = makeTmpDir();
    mkdirSync(join(dir, 'answers'), { recursive: true });
    writeFileSync(join(dir, 'answers', 'foo.json'), JSON.stringify({ text: 'ANSWER' }), 'utf8');
    const p = new FileProvider({ answersDir: join(dir, 'answers') });
    const r = await p.generate({ system: 's', user: 'x <!--pks-gen-slug:foo-->' });
    expect(r.text).toBe('ANSWER');
    rmSync(dir, { recursive: true, force: true });
  });

  it('user prompt 无 slug 标记则报错', async () => {
    const p = new FileProvider({ answersDir: makeTmpDir() });
    await expect(p.generate({ system: 's', user: 'no marker' })).rejects.toThrow(/slug/i);
  });

  it('answers 文件缺失则报错', async () => {
    const p = new FileProvider({ answersDir: makeTmpDir() });
    await expect(p.generate({ system: 's', user: '<!--pks-gen-slug:missing-->' })).rejects.toThrow(/找不到/);
  });

  it('answers 非合法 JSON 则报错', async () => {
    const dir = makeTmpDir();
    mkdirSync(join(dir, 'answers'), { recursive: true });
    writeFileSync(join(dir, 'answers', 'bad.json'), 'not json', 'utf8');
    const p = new FileProvider({ answersDir: join(dir, 'answers') });
    await expect(p.generate({ system: 's', user: '<!--pks-gen-slug:bad-->' })).rejects.toThrow(/JSON/);
    rmSync(dir, { recursive: true, force: true });
  });

  it('answers 缺 text 字段则报错', async () => {
    const dir = makeTmpDir();
    mkdirSync(join(dir, 'answers'), { recursive: true });
    writeFileSync(join(dir, 'answers', 'notext.json'), JSON.stringify({ nope: 1 }), 'utf8');
    const p = new FileProvider({ answersDir: join(dir, 'answers') });
    await expect(p.generate({ system: 's', user: '<!--pks-gen-slug:notext-->' })).rejects.toThrow(/text/);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('生成回路 退避重试（5xx / 429）', () => {
  let root: string;
  beforeEach(() => {
    // createProvider('openai') 用 new OpenAIProvider() 读环境变量构造；HTTP 已被 mock，仅填占位值即可。
    process.env.PKS_LLM_BASE_URL = 'http://test-llm';
    process.env.PKS_LLM_API_KEY = 'test-key';
    process.env.PKS_LLM_MODEL = 'test-model';
    root = makeTmpDir();
    setupContentFixture(root);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PKS_LLM_BASE_URL;
    delete process.env.PKS_LLM_API_KEY;
    delete process.env.PKS_LLM_MODEL;
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    process.exitCode = 0;
  });

  const runOpts = () => ({
    contentDir: root,
    workOrderPath: join(root, 'workorder.yaml'),
    provider: 'openai' as const,
    answersDir: join(root, 'answers'),
    concurrency: 1,
    strict: false,
  });

  const readState = () =>
    JSON.parse(readFileSync(join(root, '.pks-gen-state.json'), 'utf8')) as {
      items: Record<string, { status: string; attempts: number }>;
    };

  it('5xx 连续失败 → 退避重试 3 次后 failed（attempts=3，fetch 被调用 3 次）', async () => {
    const fetchMock = vi.fn(async () => new Response('err', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    await runPipeline(runOpts());
    const st = readState();
    expect(st.items[TEST_SLUG].status).toBe('failed');
    expect(st.items[TEST_SLUG].attempts).toBe(3);
    expect(fetchMock.mock.calls.length).toBe(3);
  });

  it('429 连续失败 → 退避重试 3 次后 failed（attempts=3，fetch 被调用 3 次）', async () => {
    const fetchMock = vi.fn(async () => new Response('rate', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    await runPipeline(runOpts());
    const st = readState();
    expect(st.items[TEST_SLUG].status).toBe('failed');
    expect(st.items[TEST_SLUG].attempts).toBe(3);
    expect(fetchMock.mock.calls.length).toBe(3);
  });

  it('首次 5xx 后恢复 → done（attempts=2，证明退避重试可恢复）', async () => {
    let n = 0;
    const fetchMock = vi.fn(async () => {
      n += 1;
      if (n === 1) return new Response('err', { status: 500 });
      return new Response(JSON.stringify({ choices: [{ message: { content: RESPONSE } }] }), {
        status: 200,
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    await runPipeline(runOpts());
    const st = readState();
    expect(st.items[TEST_SLUG].status).toBe('done');
    expect(st.items[TEST_SLUG].attempts).toBe(2);
    expect(existsSync(join(root, '.staging', TEST_SLUG, 'entry.md'))).toBe(true);
  });
});
