/**
 * 生成管线编排（T03）。
 *
 *  - runPipeline: 读 work-order → 逐条 生成→解析→写 staging→lint；lint 失败把错误拼回 prompt 重试（≤3）；
 *    并发限流（默认 2）+ 指数退避；failed 隔离；全部跑完即退出；--strict + failed → 退出码 1。
 *  - resume: 复用 state 重试 pending/failed（行为同 run，跳过 done/promoted）。
 *  - status: 打印各 slug 状态。
 *  - promote: 移动 staging→entries 并置状态为 promoted。
 *
 * state 文件：content/.pks-gen-state.json（gitignored）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NodeFsVfs } from '@pks/core/node';
import { loadSnapshot } from '@pks/core';
import type { TaxonomyNode } from '@pks/core';
import {
  parseWorkOrder,
  validateWorkOrderCategories,
  type WorkOrderItem,
  type WorkOrder,
} from './workorder.js';
import { buildSystemPrompt, buildUserPrompt, type PromptContext } from './prompt.js';
import { parseOutput } from './parse-output.js';
import { lintEntryDir, type Issue } from '../commands/lint.js';
import { stagingEntryVfs, writeStaging, promote as stagePromote } from './staging.js';
import { FileProvider } from './providers/file.js';
import { OpenAIProvider } from './providers/openai.js';
import type { LLMProvider } from './provider.js';

export type ItemStatus = 'pending' | 'done' | 'promoted' | 'failed';

export interface ItemState {
  status: ItemStatus;
  attempts: number;
  error?: string;
}

export interface GenState {
  items: Record<string, ItemState>;
}

export interface RunOptions {
  contentDir: string;
  workOrderPath: string;
  provider: string;
  answersDir: string;
  concurrency: number;
  strict: boolean;
}

const MAX_ATTEMPTS = 3;
const STATE_FILE = '.pks-gen-state.json';

function statePath(contentDir: string): string {
  return resolve(contentDir, STATE_FILE);
}

function readState(contentDir: string): GenState {
  const p = statePath(contentDir);
  if (!existsSync(p)) return { items: {} };
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as GenState;
  } catch {
    return { items: {} };
  }
}

function writeState(contentDir: string, st: GenState): void {
  mkdirSync(contentDir, { recursive: true });
  writeFileSync(statePath(contentDir), JSON.stringify(st, null, 2), 'utf8');
}

function collectPaths(nodes: TaxonomyNode[], acc: Set<string>): void {
  for (const n of nodes) {
    acc.add(n.path);
    if (n.children) collectPaths(n.children, acc);
  }
}

function createProvider(name: string, answersDir: string): LLMProvider {
  if (name === 'file') return new FileProvider({ answersDir });
  if (name === 'openai') return new OpenAIProvider();
  throw new Error(`未知 provider: ${name}（支持 file|openai）`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 第 n 次失败后的退避毫秒数（1s, 2s, 4s, 封顶 8s） */
function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** (attempt - 1), 8000);
}

export function runPipeline(opts: RunOptions): Promise<void> {
  return runCore(opts);
}

export function resume(opts: RunOptions): Promise<void> {
  return runCore(opts);
}

async function runCore(opts: RunOptions): Promise<void> {
  const { contentDir, workOrderPath, provider: providerName, answersDir, concurrency, strict } = opts;
  if (!existsSync(workOrderPath)) {
    throw new Error(`work-order 文件不存在：${workOrderPath}`);
  }
  let order: WorkOrder;
  try {
    order = parseWorkOrder(readFileSync(workOrderPath, 'utf8'));
  } catch (e) {
    throw new Error(`解析 work-order 失败：${String(e)}`);
  }

  // 校验 categories（WIP）：非法类目直接报错，避免生成后才被 lint 打回
  const baseVfs = new NodeFsVfs(contentDir);
  const { snapshot } = loadSnapshot(baseVfs);
  const validPaths = new Set<string>();
  collectPaths(snapshot.taxonomy, validPaths);
  const catErrors = validateWorkOrderCategories(order.items, validPaths);
  if (catErrors.length > 0) {
    for (const e of catErrors) console.error(`✗ ${e}`);
    throw new Error(`work-order 含 ${catErrors.length} 处非法 categories，已终止`);
  }

  const ctx: PromptContext = { validPaths: [...validPaths] };
  const provider = createProvider(providerName, answersDir);
  const state = readState(contentDir);

  // 初始化状态（新条目置 pending）
  for (const it of order.items) {
    if (!state.items[it.slug]) {
      state.items[it.slug] = { status: 'pending', attempts: 0 };
    }
  }
  writeState(contentDir, state);

  const itemBySlug = new Map<string, WorkOrderItem>(order.items.map((it) => [it.slug, it]));
  const queue = order.items
    .filter((it) => {
      const s = state.items[it.slug];
      return s.status === 'pending' || s.status === 'failed';
    })
    .map((it) => it.slug);

  let hadFailure = false;
  let idx = 0;
  const worker = async (): Promise<void> => {
    while (idx < queue.length) {
      const slug = queue[idx++];
      const item = itemBySlug.get(slug);
      if (!item) continue;
      try {
        await processItem(item, provider, ctx, contentDir, state, providerName);
      } catch (err) {
        hadFailure = true;
        const prev = state.items[slug] ?? { status: 'pending' as ItemStatus, attempts: 0 };
        state.items[slug] = {
          ...prev,
          status: 'failed',
          error: String(err instanceof Error ? err.message : err),
        };
        console.error(`✗ ${slug} 失败：${state.items[slug].error}`);
      }
      writeState(contentDir, state);
    }
  };

  const n = Math.max(1, Math.min(concurrency, queue.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));

  printStatus(state);
  if (strict && hadFailure) {
    process.exitCode = 1;
  }
}

async function processItem(
  item: WorkOrderItem,
  provider: LLMProvider,
  ctx: PromptContext,
  contentDir: string,
  state: GenState,
  _providerName: string,
): Promise<void> {
  const slug = item.slug;
  const st = state.items[slug];
  let feedback = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    st.attempts = attempt;
    writeState(contentDir, state);
    try {
      const system = buildSystemPrompt(ctx);
      let user = buildUserPrompt(item);
      if (feedback) {
        user += `\n\n# 上次 lint 校验失败，请修正以下问题后重新输出\n${feedback}\n`;
      }
      user += `\n\n<!--pks-gen-slug:${slug}-->`;
      const res = await provider.generate({ system, user });
      const files = parseOutput(res.text);
      writeStaging(contentDir, slug, files);

      const vfs = stagingEntryVfs(contentDir, slug);
      const { issues, errorCount } = lintEntryDir(vfs, slug);
      if (errorCount > 0) {
        feedback = issues
          .filter((i) => i.severity === 'error')
          .map((i) => `[${i.rule}] ${i.message}`)
          .join('\n');
        console.warn(`⚠ ${slug} lint 未通过（attempt ${attempt}/${MAX_ATTEMPTS}）：\n${feedback}`);
        if (attempt < MAX_ATTEMPTS) {
          await sleep(backoffMs(attempt));
        }
        continue;
      }
      st.status = 'done';
      st.error = undefined;
      writeState(contentDir, state);
      console.log(`✓ ${slug} 生成并通过 lint（attempt ${attempt}）`);
      return;
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err);
      console.warn(`⚠ ${slug} 生成/解析异常（attempt ${attempt}/${MAX_ATTEMPTS}）：${msg}`);
      feedback = `生成或解析阶段出错：${msg}`;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(backoffMs(attempt));
      }
    }
  }
  st.status = 'failed';
  st.error = feedback || '未知失败';
  writeState(contentDir, state);
  throw new Error(`${slug} 经 ${MAX_ATTEMPTS} 次尝试仍未通过`);
}

export function printStatus(state: GenState): void {
  const rows = Object.entries(state.items);
  console.log(`\n📋 生成状态（${rows.length} 条）：`);
  for (const [slug, s] of rows) {
    const mark =
      s.status === 'done' ? '✓' : s.status === 'promoted' ? '⬆' : s.status === 'failed' ? '✗' : '·';
    console.log(
      `  ${mark} ${slug}  [${s.status}]  attempts=${s.attempts}${s.error ? `  err=${s.error}` : ''}`,
    );
  }
}

export function status(contentDir: string): void {
  printStatus(readState(contentDir));
}

export function promote(contentDir: string, slug: string): void {
  const state = readState(contentDir);
  if (!state.items[slug]) {
    console.log(`ℹ state 中无 ${slug}，尝试直接 promote`);
  }
  stagePromote(contentDir, slug);
  if (state.items[slug]) {
    state.items[slug].status = 'promoted';
    state.items[slug].error = undefined;
    writeState(contentDir, state);
  }
  console.log(`⬆ ${slug} 已 promote 到 content/entries/${slug}`);
}

// 仅用于类型引用，避免未使用告警
export type { Issue };
