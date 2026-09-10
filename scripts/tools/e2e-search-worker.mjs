/**
 * P0-III 回归 e2e：L2 全文检索走 Web Worker（无需任何第三方依赖）。
 *
 * 做法：起一个静态服务指向 apps/web/dist，用**本机 headless Chrome + 原生 CDP**
 * （Node 18+ 自带全局 fetch/WebSocket）驱动，注入探针后断言。
 *
 * 覆盖：
 *   A 主路径：worker 真的在用（window.__pksSearchViaWorker===true）+ 渲染出全文结果 + worker 仅创建 1 次
 *   B 分片不重复下载：连搜两词，search/sNN.json 网络请求数不增
 *   C markdown 回归：进入词条阅读页，正文（.reader-doc .prose）由 markdown 转换而来且非空
 *     —— 证明 core 的 sideEffects:false 未把主包里真正使用的 markdown 链误摇
 *   D 降级安全网：注入 window.Worker=undefined 后，全文检索仍能出结果（走主线程兜底）
 *
 * 依赖：本机 Chrome（默认找常见路径；可用环境变量 PKS_CHROME 覆盖）。
 * 运行：node scripts/tools/e2e-search-worker.mjs
 *   exit 0 = 全绿；否则打印 E2E_RESULT 里的 failed 列表。
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
const DIST = join(ROOT, 'apps', 'web', 'dist');
const DBG_PORT = Number(process.env.PKS_CDP_PORT || 9336);
const CHROME = process.env.PKS_CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [];
function check(name, pass, detail) { checks.push({ name, pass: !!pass, detail }); }

if (!CHROME) {
  console.log('E2E_RESULT', JSON.stringify({ ok: false, error: 'no Chrome/Edge found; set PKS_CHROME' }));
  process.exit(3);
}
if (!existsSync(join(DIST, 'index.html'))) {
  console.log('E2E_RESULT', JSON.stringify({ ok: false, error: 'apps/web/dist not built: ' + DIST }));
  process.exit(3);
}

/* ---------- 静态服务 ---------- */
const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/' || p === '') p = '/index.html';
    const full = normalize(join(DIST, p));
    if (!full.startsWith(normalize(DIST))) { res.writeHead(403); res.end('forbidden'); return; }
    if (!existsSync(full)) { res.writeHead(404); res.end('not found'); return; }
    const data = await readFile(full);
    res.writeHead(200, { 'content-type': MIME[extname(full).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;

/* ---------- headless Chrome ---------- */
const profile = mkdtempSync(join(tmpdir(), 'pks-e2e-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${DBG_PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const shardRequests = [];
function cleanup() { try { chrome.kill(); } catch {} try { server.close(); } catch {} try { rmSync(profile, { recursive: true, force: true }); } catch {} }
function finish(code) { console.log('E2E_RESULT', JSON.stringify({ ok: checks.every((c) => c.pass), checks }, null, 2)); cleanup(); process.exit(code); }

async function waitChrome(t) {
  const t0 = Date.now();
  while (Date.now() - t0 < t) {
    try { const r = await fetch(`http://127.0.0.1:${DBG_PORT}/json/version`); if (r.ok) return; } catch {}
    await sleep(150);
  }
  throw new Error('chrome devtools endpoint not reachable');
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const waiters = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiters.has(msg.id)) {
      const { resolve, reject } = waiters.get(msg.id); waiters.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
    } else if (msg.method === 'Network.requestWillBeSent') {
      const u = msg.params.request.url;
      if (/\/content\/index\/search\/s\d+\.json$/.test(u)) shardRequests.push(u);
    }
  });
  const ready = new Promise((res, rej) => { ws.addEventListener('open', () => res()); ws.addEventListener('error', () => rej(new Error('ws error'))); });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const myId = ++id; waiters.set(myId, { resolve, reject });
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
  return { ws, ready, send };
}

try {
  await waitChrome(15000);
  const nt = await fetch(`http://127.0.0.1:${DBG_PORT}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  const target = await nt.json();
  const client = cdp(target.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Network.enable');
  // 探针1：统计 Worker 创建次数（每次新文档都注入）
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    (function(){var Orig=window.Worker;window.__pksWorkerCreates=0;
     try{window.Worker=function(u,o){window.__pksWorkerCreates++;return (o===undefined)?new Orig(u):new Orig(u,o);};window.Worker.prototype=Orig.prototype;}catch(e){window.__pksWorkerCreates=-1;}})();
  ` });

  const evaluate = async (expr) => (await client.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
  const searchSnap = () => evaluate(`(function(){var el=document.querySelector('.page');return {marker:(window.__pksSearchViaWorker===true),creates:(window.__pksWorkerCreates||0),text:(el&&el.innerText)||''};})()`);
  async function waitSearch(matchText, timeoutMs) {
    const deadline = Date.now() + timeoutMs; let st = null;
    while (Date.now() < deadline) {
      st = await searchSnap();
      if (st && /全文结果\s*（\d+\s*处命中/.test(st.text) && st.text.includes(matchText)) return st;
      await sleep(250);
    }
    return st;
  }
  const hitOf = (t) => Number((t.match(/全文结果\s*（(\d+)\s*处命中/) || [])[1] || 0);

  /* ---------- A + B：主路径 + 不重复下载 ---------- */
  await client.send('Page.navigate', { url: `${baseUrl}#/search?q=${encodeURIComponent('资本')}&full=1` });
  const s1 = await waitSearch('资本', 20000);
  const shardReq1 = shardRequests.length;
  check('A1 渲染出全文结果（资本）命中>0', hitOf(s1?.text || '') > 0, `hits=${hitOf(s1?.text || '')}`);
  check('A2 window.__pksSearchViaWorker===true（用了 worker）', s1?.marker === true, `marker=${s1?.marker}`);
  check('A3 worker 仅创建 1 次', s1?.creates === 1, `creates=${s1?.creates}`);

  await evaluate(`location.hash = '#/search?q=${encodeURIComponent('哲学')}&full=1'`);
  const s2 = await waitSearch('哲学', 20000);
  const shardReq2 = shardRequests.length;
  check('B1 第二次搜索仍命中>0（哲学）', hitOf(s2?.text || '') > 0, `hits=${hitOf(s2?.text || '')}`);
  check('B2 二次搜索未重复下载分片', shardReq2 === shardReq1, `after1=${shardReq1} after2=${shardReq2} unique=${new Set(shardRequests).size}`);
  check('B3 首次下载数 = 分片总数(16)', shardReq1 === 16, `after1=${shardReq1}`);

  /* ---------- C：markdown 回归（阅读页正文非空） ---------- */
  await evaluate(`location.hash = '#/entry-reader/plato'`);
  let prose = null;
  {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      prose = await evaluate(`(function(){var el=document.querySelector('.reader-doc .prose');if(!el)return null;return {len:(el.textContent||'').trim().length, blocks:el.querySelectorAll('p,h1,h2,h3,h4,ul,ol,blockquote,pre').length};})()`);
      if (prose && prose.len > 200 && prose.blocks > 0) break;
      await sleep(300);
    }
  }
  check('C1 阅读页正文非空(textContent>200)', !!prose && prose.len > 200, `len=${prose?.len}`);
  check('C2 阅读页正文含 markdown 转换出的块级元素', !!prose && prose.blocks > 0, `blocks=${prose?.blocks}`);

  /* ---------- D：降级安全网（window.Worker=undefined） ---------- */
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.Worker = undefined;` });
  await client.send('Page.navigate', { url: `${baseUrl}?dl=1#/search?q=${encodeURIComponent('资本')}&full=1` }); // 带 query → 整页重载（新文档）
  const s3 = await waitSearch('资本', 20000);
  check('D1 降级后仍渲染全文结果', hitOf(s3?.text || '') > 0, `hits=${hitOf(s3?.text || '')}`);
  check('D2 降级后不再使用 worker（marker 非 true）', s3?.marker !== true, `marker=${s3?.marker}`);

  finish(checks.every((c) => c.pass) ? 0 : 2);
} catch (e) {
  check('harness', false, String((e && e.stack) || e));
  finish(2);
}
