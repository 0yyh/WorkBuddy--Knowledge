import { spawnSync } from 'node:child_process';

const root = 'D:/WorkBuddy--Knowledge';
const tsx = root + '/node_modules/.pnpm/tsx@4.23.13/node_modules/tsx/dist/cli.mjs';

const r = spawnSync(
  'node',
  [tsx, 'packages/cli/src/index.ts', 'lint'],
  { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }
);

process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
console.log('LINT_EXIT=' + (r.status ?? r.signal));
