/**
 * 阅读器重构（第 1 步：偏好模型 + 阅读区视觉 + 顶/底 chrome）回归 e2e。
 * 纯 Node 18+ 原生 CDP 驱动本机 headless Chrome，零第三方依赖。
 *
 * 断言（打开 #/entry-reader/plato）：
 *   V1 .reader-root 计算背景 = rgb(245, 241, 230)（#F5F1E6 护眼米黄）
 *   V2 .reader-doc .prose p  font-size=18px / line-height=32.4px / text-indent=36px
 *   V3 .reader-doc .prose h2 font-size=22px / font-weight>=700 / color=rgb(0,0,0)
 *   V4 阅读器作用域内 box-shadow 非 none 的元素数 = 0
 *   V5 点正文中央 → 3 等分导航栏出现；三项文字=目录/夜间/设置；三项宽度近似相等(±2px)
 *   V6 底部常驻信息条存在，左下文本匹配 /^\d+\/\d+$/
 *
 * 依赖：本机 Chrome（PKS_CHROME 可覆盖）；运行前请先 `npm --prefix apps/web run build`。
 * 运行：node scripts/tools/e2e-reader-refactor.mjs    （exit 0=全绿）
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
const DBG_PORT = Number(process.env.PKS_CDP_PORT || 9337);
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
const profile = mkdtempSync(join(tmpdir(), 'pks-reader-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${DBG_PORT}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
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
    }
  });
  const ready = new Promise((res, rej) => { ws.addEventListener('open', () => res()); ws.addEventListener('error', () => rej(new Error('ws error'))); });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const myId = ++id; waiters.set(myId, { resolve, reject });
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
  return { ws, ready, send };
}

/** 读取全部阅读区视觉/度量；在页面内执行，返回普通对象。 */
const PROBE = `(function(){
  var root = document.querySelector('.reader-root');
  if(!root) return { ready:false };
  var p = document.querySelector('.reader-doc .prose p');
  var h2 = document.querySelector('.reader-doc .prose h2');
  var cs = function(el){ return el ? getComputedStyle(el) : null; };
  var rootCs = cs(root), pCs = cs(p), h2Cs = cs(h2);
  var shadowNone = 0, shadowNon = 0;
  root.querySelectorAll('*').forEach(function(el){
    var s = getComputedStyle(el).boxShadow;
    if(s === 'none' || s === '') shadowNone++; else shadowNon++;
  });
  var bar = document.querySelector('.reader-statusbar');
  var prog = document.querySelector('.reader-statusbar-progress');
  return {
    ready: true,
    bg: rootCs ? rootCs.backgroundColor : null,
    fontScale: getComputedStyle(document.documentElement).getPropertyValue('--reading-font-scale').trim(),
    readerFs: getComputedStyle(document.documentElement).getPropertyValue('--reader-fs').trim(),
    pFont: pCs ? pCs.fontSize : null,
    pLine: pCs ? pCs.lineHeight : null,
    pIndent: pCs ? pCs.textIndent : null,
    h2Font: h2Cs ? h2Cs.fontSize : null,
    h2Weight: h2Cs ? h2Cs.fontWeight : null,
    h2Color: h2Cs ? h2Cs.color : null,
    hasH2: !!h2,
    shadowNon: shadowNon,
    shadowNone: shadowNone,
    statusbar: !!bar,
    statusText: prog ? (prog.textContent || '') : null,
  };
})()`;

const TABS_PROBE = `(function(){
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.reader-bottom-tabs .reader-tab'));
  return {
    overlay: document.querySelector('.reader-root') ? document.querySelector('.reader-root').classList.contains('has-overlay') : false,
    count: tabs.length,
    labels: tabs.map(function(t){ var s=t.querySelector('.reader-tab-label'); return (s&&s.textContent||'').trim(); }),
    widths: tabs.map(function(t){ return Math.round(t.getBoundingClientRect().width * 100) / 100; }),
  };
})()`;

/** 点正文中央（模拟用户点中央唤出 overlay）。 */
const CLICK_CENTER = `(function(){
  var root = document.querySelector('.reader-root');
  var r = root.getBoundingClientRect();
  var x = r.left + r.width / 2, y = r.top + r.height / 2;
  var el = document.elementFromPoint(x, y) || root;
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
  return true;
})()`;

try {
  await waitChrome(15000);
  const nt = await fetch(`http://127.0.0.1:${DBG_PORT}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  const target = await nt.json();
  const client = cdp(target.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  const evaluate = async (expr) => (await client.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;

  await client.send('Page.navigate', { url: `${baseUrl}#/entry-reader/plato` });

  // 等正文装载
  let st = null;
  {
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      st = await evaluate(PROBE);
      if (st && st.ready && st.pFont && st.hasH2) break;
      await sleep(300);
    }
  }

  /* V1 背景 */
  const bgOk = st && st.bg === 'rgb(245, 241, 230)';
  check('V1 .reader-root 背景 = rgb(245,241,230)', bgOk, `bg=${st?.bg} fontScale=${st?.fontScale} readerFs=${st?.readerFs}`);

  /* V2 正文度量 */
  check('V2a 正文 font-size = 18px', st?.pFont === '18px', `pFont=${st?.pFont}`);
  check('V2b 正文 line-height = 32.4px', st?.pLine === '32.4px', `pLine=${st?.pLine}`);
  check('V2c 正文 text-indent = 36px', st?.pIndent === '36px', `pIndent=${st?.pIndent}`);

  /* V3 标题 */
  check('V3a h2 font-size = 22px', st?.h2Font === '22px', `h2Font=${st?.h2Font}`);
  check('V3b h2 font-weight >= 700', Number(st?.h2Weight) >= 700, `h2Weight=${st?.h2Weight}`);
  check('V3c h2 color = rgb(0, 0, 0)', st?.h2Color === 'rgb(0, 0, 0)', `h2Color=${st?.h2Color}`);

  /* V4 无投影 */
  check('V4 阅读器作用域 box-shadow 非 none 数量 = 0', st?.shadowNon === 0, `nonNone=${st?.shadowNon} none=${st?.shadowNone}`);

  /* V6 底部常驻信息条（点中央前就应存在） */
  check('V6a 底部信息条存在', st?.statusbar === true, `statusbar=${st?.statusbar}`);
  check('V6b 信息条进度匹配 /^\\d+\\/\\d+$/', /^\d+\/\d+$/.test(st?.statusText || ''), `statusText=${JSON.stringify(st?.statusText)}`);

  /* V5 点中央 → 3 等分导航栏 */
  await evaluate(CLICK_CENTER);
  let tabs = null;
  {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      tabs = await evaluate(TABS_PROBE);
      if (tabs && tabs.count === 3) break;
      await sleep(150);
    }
  }
  const labels = tabs?.labels || [];
  check('V5a 点中央后 overlay 出现', tabs?.overlay === true, `overlay=${tabs?.overlay}`);
  check('V5b 3 等分导航栏含 3 项', tabs?.count === 3, `count=${tabs?.count}`);
  check('V5c 三项文字 = 目录 / 夜间 / 设置', labels[0] === '目录' && labels[1] === '夜间' && labels[2] === '设置', `labels=${JSON.stringify(labels)}`);
  const w = tabs?.widths || [];
  const wMax = Math.max(...w), wMin = Math.min(...w);
  check('V5d 三项宽度近似相等(±2px)', w.length === 3 && (wMax - wMin) <= 2, `widths=${JSON.stringify(w)}`);

  finish(checks.every((c) => c.pass) ? 0 : 2);
} catch (e) {
  check('harness', false, String((e && e.stack) || e));
  finish(2);
}
