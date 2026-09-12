/**
 * pks gen 子命令分发（T03）。
 *    run      --work-order <file> --provider file|openai --answers-dir <dir> --concurrency <n> --strict
 *    resume   同 run（复用 .pks-gen-state.json 重试 pending/failed）
 *    promote  <slug>
 *    status
 * 公共参数：--content <dir>（默认 content）。
 */
import { resolve } from 'node:path';
import { runPipeline, resume, status as statusCmd, promote } from '../gen/runner.js';

export interface GenFlags {
  content?: string | boolean;
  workOrder?: string;
  provider?: string;
  answersDir?: string;
  concurrency?: string;
  strict?: boolean;
  [key: string]: unknown;
}

function contentDirOf(flags: GenFlags): string {
  const raw = flags.content;
  if (typeof raw !== 'string' || raw.trim() === '') {
    console.error('✗ 缺少 --content 目录参数（例如：--content content）');
    process.exit(1);
  }
  return resolve(process.cwd(), raw);
}

export function genCmd(positional: string[], flags: GenFlags): void {
  const sub = positional[0];
  const contentDir = contentDirOf(flags);
  switch (sub) {
    case 'run':
    case 'resume': {
      const workOrder = typeof flags['work-order'] === 'string' ? flags['work-order'] : 'workorder.yaml';
      const provider = typeof flags.provider === 'string' ? flags.provider : 'file';
      const answersDir =
        typeof flags['answers-dir'] === 'string' ? flags['answers-dir'] : resolve(contentDir, '.staging/answers');
      const concurrency = flags.concurrency != null ? Number(flags.concurrency) : 2;
      const opts = {
        contentDir,
        workOrderPath: resolve(process.cwd(), workOrder),
        provider,
        answersDir,
        concurrency: Number.isFinite(concurrency) ? concurrency : 2,
        strict: Boolean(flags.strict),
      };
      const fn = sub === 'resume' ? resume : runPipeline;
      fn(opts).catch((e) => {
        console.error(`✗ gen ${sub} 失败：${String(e instanceof Error ? e.message : e)}`);
        process.exit(1);
      });
      break;
    }
    case 'promote': {
      const slug = positional[1];
      if (!slug) {
        console.error('用法: gen promote <slug>');
        process.exit(1);
      }
      try {
        promote(contentDir, slug);
      } catch (e) {
        console.error(`✗ ${String(e instanceof Error ? e.message : e)}`);
        process.exit(1);
      }
      break;
    }
    case 'status':
      statusCmd(contentDir);
      break;
    default:
      printGenHelp();
  }
}

function printGenHelp(): void {
  console.log(`pks gen —— 批量生成管线
用法：
  pks gen run       --work-order <file> [--provider file|openai] [--answers-dir <dir>] [--concurrency <n>] [--strict]
  pks gen resume    同 run（复用 .pks-gen-state.json 重试 pending/failed）
  pks gen promote   <slug>    把 content/.staging/<slug> 移到 content/entries/<slug>
  pks gen status              打印各 slug 生成状态
公共参数：--content <dir>（默认 content）`);
}
