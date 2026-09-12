#!/usr/bin/env node
/**
 * @pks/cli 入口：命令分发。
 * 命令：build:index / lint / bundle / rename / browse:gen / search
 * 公共参数：--content <dir>（默认 content）
 */
import { resolve } from 'node:path';
import { buildIndexCmd } from './commands/build-index.js';
import { lintCmd } from './commands/lint.js';
import { bundleCmd } from './commands/bundle.js';
import { renameCmd } from './commands/rename.js';
import { browseGenCmd } from './commands/browse-gen.js';
import { searchCmd } from './commands/search.js';
import { buildCharDictCmd } from './commands/build-chardict.js';

interface Flags {
  content: string | boolean;
  level?: string;
  category?: string;
  out?: string;
  [key: string]: unknown;
}

function parse(argv: string[]): { cmd: string; positional: string[]; flags: Flags } {
  // 命令是 argv 中首个命中已知集合的 token；其前的路径/加载器参数（如 tsx 以 import()
  // 同进程加载时把脚本路径也塞进 argv）一律忽略。这样无论 node 直接 re-exec 还是 tsx
  // import() 加载，命令都能被正确识别。
  const KNOWN = new Set([
    'build:index',
    'lint',
    'bundle',
    'rename',
    'browse:gen',
    'build:chardict',
    'search',
  ]);
  let cmd = '';
  let idx = -1;
  for (let i = 0; i < argv.length; i++) {
    if (KNOWN.has(argv[i])) {
      cmd = argv[i];
      idx = i;
      break;
    }
  }
  const rest = idx >= 0 ? argv.slice(idx + 1) : [];
  const positional: string[] = [];
  const flags: Flags = { content: 'content' };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { cmd, positional, flags };
}

const contentDir = (f: Flags): string => {
  const raw = f.content;
  // `--content` 单独出现时会被解析为 true，此处给出明确报错而非静默解析成 "true" 目录
  if (typeof raw !== 'string' || raw.trim() === '') {
    console.error('✗ 缺少 --content 目录参数（例如：--content content）');
    process.exit(1);
  }
  return resolve(process.cwd(), raw);
};

const PACK_LEVELS = ['seed', 'digest', 'full'] as const;

function packLevel(v: unknown): 'seed' | 'digest' | 'full' | undefined {
  if (typeof v !== 'string') return undefined;
  if ((PACK_LEVELS as readonly string[]).includes(v)) return v as 'seed' | 'digest' | 'full';
  console.error(`✗ --level 取值非法：${v}（应为 ${PACK_LEVELS.join('/')}）`);
  process.exit(1);
}

const SEARCH_LEVELS = ['l1', 'l2'] as const;

/** search 的 --level：缺省 l1；给了非法值直接报错，不静默降级 */
function searchLevel(v: unknown): 'l1' | 'l2' {
  if (v === undefined) return 'l1';
  if (typeof v === 'string' && (SEARCH_LEVELS as readonly string[]).includes(v)) {
    return v as 'l1' | 'l2';
  }
  console.error(`✗ --level 取值非法：${String(v)}（应为 ${SEARCH_LEVELS.join('/')}）`);
  process.exit(1);
}

function printHelp(): void {
  console.log(`个人知识学习站 · CLI
用法：pks <命令> [--content <dir>]

  build:index       内容目录 → .index/ 分片索引
  lint              内容规范校验
  bundle [--level seed|digest|full] [--category X] [--out <dir>]
                     导出数据包 zip
  rename <old> <new>  slug 改名级联
  browse:gen        生成 _browse/ 影子树
  build:chardict    字符词典（character）合并为单个 index.json
  search <query> [--level l1|l2]   在已构建索引上检索
`);
}

function main(): void {
  console.error('DBG_ARGV', JSON.stringify(process.argv));
  const { cmd, positional, flags } = parse(process.argv.slice(2));
  console.error('DBG_CMD', JSON.stringify(cmd));
  switch (cmd) {
    case 'build:index':
      buildIndexCmd(contentDir(flags));
      break;
    case 'lint':
      lintCmd(contentDir(flags));
      break;
    case 'bundle':
      bundleCmd(contentDir(flags), {
        level: packLevel(flags.level),
        category: typeof flags.category === 'string' ? flags.category : undefined,
        outDir: typeof flags.out === 'string' ? flags.out : undefined,
      });
      break;
    case 'rename':
      if (positional.length < 2) { console.error('用法: rename <old> <new>'); process.exit(1); }
      renameCmd(contentDir(flags), positional[0], positional[1]);
      break;
    case 'browse:gen':
      browseGenCmd(contentDir(flags));
      break;
    case 'search':
      if (positional.length < 1) { console.error('用法: search <query> [--level l1|l2]'); process.exit(1); }
      searchCmd(contentDir(flags), positional.join(' '), searchLevel(flags.level));
      break;
    case 'build:chardict':
      buildCharDictCmd(contentDir(flags));
      break;
    default:
      printHelp();
  }
}

main();
