import { spawnSync } from 'node:child_process';

const root = 'D:/WorkBuddy--Knowledge';
const tsx = root + '/node_modules/.pnpm/tsx@4.23.13/node_modules/tsx/dist/cli.mjs';

function run(label, args) {
  const r = spawnSync('node', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
  console.log('=== ' + label + ' exit=' + (r.status ?? r.signal));
  if (r.stdout) process.stdout.write(r.stdout.slice(0, 3000));
  if (r.stderr) process.stderr.write(r.stderr.slice(0, 3000));
  return r.status === 0;
}

const ok1 = run('build:index', [tsx, 'packages/cli/src/index.ts', 'build:index']);
if (!ok1) { console.log('BUILD_INDEX_FAILED'); process.exit(1); }

const ok2 = run('copy-content', ['scripts/copy-content.mjs']);
console.log(ok2 ? 'ALL_DONE' : 'COPY_FAILED');
process.exit(ok2 ? 0 : 1);
