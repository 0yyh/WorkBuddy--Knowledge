/**
 * 阅读器重构（第 1 步 + 第 2 步）回归 e2e。
 * 纯 Node 18+ 原生 CDP 驱动本机 headless Chrome，零第三方依赖。
 *
 * 第 1 步断言（打开 #/entry-reader/plato）：
 *   V1 .reader-root 计算背景 = rgb(245, 241, 230)（#F5F1E6 护眼米黄）
 *   V2 .reader-doc .prose p  font-size=18px / line-height=32.4px / text-indent=36px
 *   V3 .reader-doc .prose h2 font-size=22px / font-weight>=700 / color=rgb(0,0,0)
 *   V4 阅读器作用域内 box-shadow 非 none 的元素数 = 0
 *   V5 点正文中央 → 3 等分导航栏出现；三项文字=目录/夜间/设置；三项宽度近似相等(±2px)
 *   V6 底部常驻信息条存在，左下文本匹配 /^\d+\/\d+$/
 *
 * 第 2 步断言（面板层）：
 *   P1..P12 主设置面板：纯白面 / 圆角20px / 半透明遮罩 / 护眼按钮 / 字号px / 7 色块 /
 *           翻页 5 胶囊配色 / 底部「间距设置+更多」
 *   P13 护眼模式 sepia⇄white 切换
 *   P14 A−/A+ 连续步进 + 12/30 边界 disabled + 复位 18
 *   S1..S7 间距子层三组默认值 / 自定义滑块 / 智能匹配 padding clamp
 *   M1..M4 更多子层 3 开关默认态 [false,true,true] + 开关配色
 *   D1..D5 划词工具条(srgb 51,51,51 / 8px) + 释义卡(12px 12px 0 0 / #333)
 *   S8 源 styles.css ::selection 含 #E8D3A2
 *   S9 源 styles.css .dict-toast 背景 = #333333；S10 废弃 reader-* 死类已清除
 *   T1 深色主题（dark）渲染：.reading-bg-dark / 背景为深色 / 仍无投影 / 面板非纯白 / 可还原
 *
 * 依赖：本机 Chrome（PKS_CHROME 可覆盖）；运行前请先 `npm --prefix apps/web run build`。
 * 运行：node scripts/tools/e2e-reader-refactor.mjs    （exit 0=全绿）
 */
import http from 'node:http';
import net from 'node:net';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
const DIST = join(ROOT, 'apps', 'web', 'dist');
/*
 * CDP 调试端口：默认**自动选一个空闲端口**。
 * 原因：固定端口在上一轮 Chrome 未退干净时会被占用，脚本会复用那个残留浏览器，
 * 页面根本没挂载 → 全量断言拿到 undefined 的"假失败"（本仓库确实踩过一次）。
 * 需要固定端口时用环境变量 PKS_CDP_PORT 覆盖。
 */
const FIXED_DBG_PORT = process.env.PKS_CDP_PORT ? Number(process.env.PKS_CDP_PORT) : null;
let DBG_PORT = 0;
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
/** 选一个当前空闲的本地端口（避免与残留 Chrome 的 CDP 端口冲突）。 */
async function pickFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });
}
DBG_PORT = FIXED_DBG_PORT ?? (await pickFreePort());

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

  /* ====================================================================
     第 2 步：设置面板 / 间距子层 / 更多子层 / 划词浮层 / 选区高亮
     ==================================================================== */
  try {
    /* ---- 打开设置面板（点 3 等分导航栏里的「设置」） ---- */
    const OPEN_SETTINGS = `(function(){
      var tabs = Array.prototype.slice.call(document.querySelectorAll('.reader-bottom-tabs .reader-tab'));
      var t = tabs.filter(function(x){ var s=x.querySelector('.reader-tab-label'); return s && s.textContent.trim()==='设置'; })[0];
      if(!t) return false; t.click(); return true;
    })()`;
    await evaluate(OPEN_SETTINGS);

    const PANEL_PROBE = `(function(){
      var sheet = document.querySelector('.reader-sheet');
      if(!sheet) return { open:false };
      var mask = document.querySelector('.reader-sheet-mask');
      var cs = function(el){ return el?getComputedStyle(el):null; };
      var sheetCs = cs(sheet), maskCs = cs(mask);
      var eye = sheet.querySelector('.reader-eye-btn');
      var fontNum = sheet.querySelector('.reader-font-num');
      var dots = Array.prototype.slice.call(sheet.querySelectorAll('.reader-color-dot'));
      var dotOn = dots.filter(function(d){ return d.classList.contains('is-on'); })[0];
      var animPills = Array.prototype.slice.call(sheet.querySelectorAll('.reader-pills-tone .reader-pill'));
      var animOn = animPills.filter(function(p){ return p.classList.contains('is-on'); })[0];
      var animOff = animPills.filter(function(p){ return !p.classList.contains('is-on'); })[0];
      var actions = Array.prototype.slice.call(sheet.querySelectorAll('.reader-sheet-actions button')).map(function(b){return b.textContent.trim();});
      return {
        open:true,
        sheetBg: sheetCs.backgroundColor,
        sheetRadius: sheetCs.borderTopLeftRadius,
        sheetClass: sheet.className,
        maskBg: maskCs ? maskCs.backgroundColor : null,
        eyePresent: !!eye,
        eyePressed: eye ? eye.getAttribute('aria-pressed') : null,
        fontNum: fontNum ? fontNum.textContent.trim() : null,
        dotCount: dots.length,
        dotOnBorder: dotOn ? cs(dotOn).borderTopColor : null,
        animCount: animPills.length,
        animOnBg: animOn ? cs(animOn).backgroundColor : null,
        animOnColor: animOn ? cs(animOn).color : null,
        animOffBg: animOff ? cs(animOff).backgroundColor : null,
        actions: actions
      };
    })()`;

    let panel = null;
    {
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        panel = await evaluate(PANEL_PROBE);
        if (panel && panel.open) break;
        await sleep(150);
      }
    }
    check('P1 设置面板已打开（.reader-sheet）', panel?.open === true, `open=${panel?.open}`);
    check('P2 面板背景 = rgb(255,255,255)（sepia 主题纯白面）', panel?.sheetBg === 'rgb(255, 255, 255)', `sheetBg=${panel?.sheetBg} class=${panel?.sheetClass}`);
    check('P3 面板圆角 = 20px', panel?.sheetRadius === '20px', `radius=${panel?.sheetRadius}`);
    const maskOk = typeof panel?.maskBg === 'string' && panel.maskBg.indexOf('rgba') === 0 && /,\s*(0?\.\d+|0)\)$/.test(panel.maskBg);
    check('P4 遮罩为半透明（rgba 且 alpha<1）', maskOk, `maskBg=${panel?.maskBg}`);
    check('P5 亮度行含「护眼模式」按钮且默认 aria-pressed=true', panel?.eyePresent === true && panel?.eyePressed === 'true', `present=${panel?.eyePresent} pressed=${panel?.eyePressed}`);
    check('P6 字号行数字 = 当前 px（默认 18）', panel?.fontNum === '18', `fontNum=${panel?.fontNum}`);
    check('P7 颜色行 7 个色块', panel?.dotCount === 7, `dotCount=${panel?.dotCount}`);
    check('P8 选中色块描边 = rgb(0,0,0)', panel?.dotOnBorder === 'rgb(0, 0, 0)', `border=${panel?.dotOnBorder}`);
    check('P9 翻页行 5 胶囊', panel?.animCount === 5, `count=${panel?.animCount}`);
    check('P10a 选中翻页胶囊背景 = rgb(255,255,255)', panel?.animOnBg === 'rgb(255, 255, 255)', `bg=${panel?.animOnBg}`);
    check('P10b 选中翻页胶囊字色 = rgb(0,0,0)', panel?.animOnColor === 'rgb(0, 0, 0)', `color=${panel?.animOnColor}`);
    check('P11 未选中翻页胶囊背景 = rgb(240,240,240)', panel?.animOffBg === 'rgb(240, 240, 240)', `bg=${panel?.animOffBg}`);
    const acts = panel?.actions || [];
    check('P12 底部含「间距设置」与「更多」', acts.some((a) => a.indexOf('间距设置') >= 0) && acts.some((a) => a.indexOf('更多') >= 0), `actions=${JSON.stringify(acts)}`);

    /* ---- 护眼模式切换（sepia ⇄ white） ---- */
    const EYE_TOGGLE = `(async function(){
      var sleep = function(ms){ return new Promise(function(r){setTimeout(r,ms);}); };
      var cls = function(){ var s=document.querySelector('.reader-sheet'); return s?s.className:''; };
      var eye = document.querySelector('.reader-sheet .reader-eye-btn');
      var before = cls();
      eye.click(); await sleep(90);
      var after = cls();
      document.querySelector('.reader-sheet .reader-eye-btn').click(); await sleep(90);
      var back = cls();
      return { before:before, after:after, back:back };
    })()`;
    const eyeRes = await evaluate(EYE_TOGGLE);
    check('P13a 护眼按钮初始为 sepia 主题', /reader-sheet-bg-sepia/.test(eyeRes?.before || ''), `before=${eyeRes?.before}`);
    check('P13b 点击后切到 white 主题', /reader-sheet-bg-white/.test(eyeRes?.after || ''), `after=${eyeRes?.after}`);
    check('P13c 再点回 sepia 主题', /reader-sheet-bg-sepia/.test(eyeRes?.back || ''), `back=${eyeRes?.back}`);

    /* ---- 深色主题渲染（补上「非 sepia 主题未逐一验证」的缺口） ---- */
    const DARK_TEST = `(async function(){
      var sleep = function(ms){ return new Promise(function(r){setTimeout(r,ms);}); };
      var dots = document.querySelectorAll('.reader-sheet .reader-color-dot');
      var dark = dots[dots.length-1];   /* 色板末位 = dark */
      dark.click(); await sleep(150);
      var root = document.querySelector('.reader-root');
      var cls = root.className;   /* 必须在还原前捕获 */
      var bg = getComputedStyle(root).backgroundColor;
      var m = bg.match(/\\d+/g) || [];
      var lum = m.length>=3 ? (Number(m[0])+Number(m[1])+Number(m[2]))/3 : 999;
      var nonNone = 0;
      root.querySelectorAll('*').forEach(function(el){ var s=getComputedStyle(el).boxShadow; if(s && s!=='none') nonNone++; });
      var sheetBg = getComputedStyle(document.querySelector('.reader-sheet')).backgroundColor;
      dots[1].click(); await sleep(150);   /* 还原 sepia */
      return { cls: cls, bg: bg, lum: lum, nonNone: nonNone, sheetBg: sheetBg, backCls: document.querySelector('.reader-root').className };
    })()`;
    const dk = await evaluate(DARK_TEST);
    check('T1a 切到 dark 主题（.reading-bg-dark）', /reading-bg-dark/.test(dk?.cls || ''), `cls=${dk?.cls}`);
    check('T1b dark 主题阅读区背景为深色（平均亮度<110）', (dk?.lum ?? 999) < 110, `bg=${dk?.bg} lum=${dk?.lum}`);
    check('T1c dark 主题下阅读器作用域仍无投影', dk?.nonNone === 0, `nonNone=${dk?.nonNone}`);
    check('T1d dark 主题面板非纯白（深色面）', dk?.sheetBg !== 'rgb(255, 255, 255)', `sheetBg=${dk?.sheetBg}`);
    check('T1e 已还原为 sepia', /reading-bg-sepia/.test(dk?.backCls || ''), `backCls=${dk?.backCls}`);

    /* ---- 字号 A−/A+ 连续性 + 边界 ---- */
    const FONT_TEST = `(async function(){
      var sleep = function(ms){ return new Promise(function(r){setTimeout(r,ms);}); };
      var num = function(){ return document.querySelector('.reader-sheet .reader-font-num').textContent.trim(); };
      var steps = document.querySelectorAll('.reader-sheet .reader-font-step');
      var minus = steps[0], plus = steps[1];
      var fsVar = function(){ return getComputedStyle(document.documentElement).getPropertyValue('--reader-fs').trim(); };
      var before = num();
      plus.click(); await sleep(80);
      var afterUp = num(); var fsAfterUp = fsVar();
      for(var i=0;i<40 && !plus.disabled;i++){ plus.click(); await sleep(28); }
      var top = num(); var topDisabled = plus.disabled;
      for(var j=0;j<40 && !minus.disabled;j++){ minus.click(); await sleep(28); }
      var bottom = num(); var bottomDisabled = minus.disabled;
      for(var k=0;k<6;k++){ plus.click(); await sleep(28); }
      var restored = num();
      return { before:before, afterUp:afterUp, fsAfterUp:fsAfterUp, top:top, topDisabled:topDisabled, bottom:bottom, bottomDisabled:bottomDisabled, restored:restored };
    })()`;
    const fr = await evaluate(FONT_TEST);
    check('P14a 点击 A+ 后 = 19', fr?.afterUp === '19', `afterUp=${fr?.afterUp}`);
    check('P14b 点击 A+ 后 --reader-fs = 19px', fr?.fsAfterUp === '19px', `fsVar=${fr?.fsAfterUp}`);
    check('P14c 连续 A+ 到 30 且 A+ disabled', fr?.top === '30' && fr?.topDisabled === true, `top=${fr?.top} disabled=${fr?.topDisabled}`);
    check('P14d 连续 A− 到 12 且 A− disabled', fr?.bottom === '12' && fr?.bottomDisabled === true, `bottom=${fr?.bottom} disabled=${fr?.bottomDisabled}`);
    check('P14e 复位回 18', fr?.restored === '18', `restored=${fr?.restored}`);

    /* ---- 打开间距设置子层 ---- */
    await evaluate(`(function(){ var b=document.querySelector('.reader-sheet .reader-action-primary'); if(!b) return false; b.click(); return true; })()`);
    const SPACING_PROBE = `(function(){
      var sheet = document.querySelector('.reader-more-sheet');
      if(!sheet) return { open:false };
      var groups = Array.prototype.slice.call(sheet.querySelectorAll('.reader-spacing-group'));
      var data = groups.map(function(g){
        var label = g.querySelector('.reader-spacing-label');
        var pills = Array.prototype.slice.call(g.querySelectorAll('.reader-pill'));
        var on = pills.filter(function(p){return p.classList.contains('is-on');})[0];
        return { label: label?label.textContent.trim():null, count: pills.length, on: on?on.textContent.trim():null };
      });
      var slider = sheet.querySelector('.reader-spacing-slider input[type=range]');
      return {
        open:true,
        groups: data,
        hasSlider: !!slider,
        paraSpacing: document.documentElement.getAttribute('data-paraspacing'),
        pageMargin: document.documentElement.getAttribute('data-pagemargin')
      };
    })()`;
    let spacing = null;
    {
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        spacing = await evaluate(SPACING_PROBE);
        if (spacing && spacing.open) break;
        await sleep(150);
      }
    }
    const g0 = spacing?.groups?.[0], g1 = spacing?.groups?.[1];
    check('S1 间距子层三组（行段间距/页面边距/对齐）', spacing?.open === true && spacing?.groups?.length === 3, `labels=${JSON.stringify((spacing?.groups||[]).map((g)=>g.label))}`);
    check('S2 行段间距 5 档且默认选中「适中」', g0?.count === 5 && g0?.on === '适中', `count=${g0?.count} on=${g0?.on}`);
    check('S3 页面边距 5 档且默认选中「智能匹配」', g1?.count === 5 && g1?.on === '智能匹配', `count=${g1?.count} on=${g1?.on}`);
    check('S4 默认 data-paraspacing=md / data-pagemargin=smart', spacing?.paraSpacing === 'md' && spacing?.pageMargin === 'smart', `para=${spacing?.paraSpacing} page=${spacing?.pageMargin}`);
    check('S5 自定义前无滑块', spacing?.hasSlider === false, `hasSlider=${spacing?.hasSlider}`);

    await evaluate(`(function(){ var g=document.querySelectorAll('.reader-spacing-group')[0]; var pills=g.querySelectorAll('.reader-pill'); for(var i=0;i<pills.length;i++){ if(pills[i].textContent.trim()==='自定义'){ pills[i].click(); return true; } } return false; })()`);
    await sleep(200);
    const spacing2 = await evaluate(SPACING_PROBE);
    check('S6 选中「自定义」后出现 input[type=range]', spacing2?.hasSlider === true, `hasSlider=${spacing2?.hasSlider}`);

    /* ---- 智能匹配：两视口下 padding-inline 取不同值（clamp 生效） ---- */
    const READ_DOC_PAD = `(function(){ var d=document.querySelector('.reader-doc'); if(!d) return null; var cs=getComputedStyle(d); return { left: cs.paddingLeft, right: cs.paddingRight }; })()`;
    try { await client.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 820, deviceScaleFactor: 1, mobile: true }); } catch {}
    await sleep(300);
    const pad390 = await evaluate(READ_DOC_PAD);
    try { await client.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 820, deviceScaleFactor: 1, mobile: false }); } catch {}
    await sleep(300);
    const pad900 = await evaluate(READ_DOC_PAD);
    try { await client.send('Emulation.clearDeviceMetricsOverride'); } catch {}
    await sleep(200);
    const px = (s) => parseFloat(s || 'NaN');
    const clampOk = pad390 && pad900 && pad390.left !== pad900.left && px(pad390.left) >= 16 && px(pad390.left) <= 40 && px(pad900.left) >= 16 && px(pad900.left) <= 40;
    check('S7 智能匹配 padding-inline 随视口变化（390≠900，均∈[16,40]）', clampOk, `390=${JSON.stringify(pad390)} 900=${JSON.stringify(pad900)}`);

    /* ---- 关闭间距子层，打开更多子层 ---- */
    await evaluate(`(function(){ var c=document.querySelector('.reader-more-sheet .reader-more-close'); if(c) c.click(); return true; })()`);
    await sleep(200);
    await evaluate(`(function(){ var b=document.querySelector('.reader-sheet .reader-action-more'); if(b) b.click(); return true; })()`);
    const MORE_PROBE = `(function(){
      var sheet = document.querySelector('.reader-more-sheet');
      if(!sheet) return { open:false };
      var rows = Array.prototype.slice.call(sheet.querySelectorAll('.reader-more-row'));
      var sw = rows.map(function(r){
        var s=r.querySelector('.reader-switch');
        var l=r.querySelector('.reader-more-label');
        return { on: s?s.classList.contains('is-on'):null, bg: s?getComputedStyle(s).backgroundColor:null, label: l?l.textContent.trim():null };
      });
      return { open:true, rowCount: rows.length, switches: sw };
    })()`;
    let more = null;
    {
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        more = await evaluate(MORE_PROBE);
        if (more && more.open && more.rowCount === 3) break;
        await sleep(150);
      }
    }
    check('M1 更多子层恰好 3 个开关行', more?.open === true && more?.rowCount === 3, `rowCount=${more?.rowCount} labels=${JSON.stringify((more?.switches||[]).map((s)=>s.label))}`);
    const onStates = (more?.switches || []).map((s) => s.on);
    check('M2 默认开关态 = [false,true,true]', JSON.stringify(onStates) === JSON.stringify([false, true, true]), `on=${JSON.stringify(onStates)}`);
    const offBg = (more?.switches || []).filter((s) => s.on === false).map((s) => s.bg);
    const onBg = (more?.switches || []).filter((s) => s.on === true).map((s) => s.bg);
    check('M3 开态开关背景 = rgb(255,106,0)', onBg.length === 2 && onBg.every((b) => b === 'rgb(255, 106, 0)'), `onBg=${JSON.stringify(onBg)}`);
    check('M4 关态开关背景 = rgb(224,224,224)', offBg.length === 1 && offBg.every((b) => b === 'rgb(224, 224, 224)'), `offBg=${JSON.stringify(offBg)}`);

    /* ---- 划词浮层：工具条 + 释义卡 ---- */
    const SELECT_AND_OPEN_MENU = `(async function(){
      var host = document.querySelector('.reader-scroll');
      var p = document.querySelector('.reader-doc .prose p');
      if(!host || !p) return { ok:false, why:'no host/p' };
      // 工具条对选区长度有 120 字上限 → 只选首个文本节点的前 6 个字
      var walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null);
      var tn = walker.nextNode();
      if(!tn) return { ok:false, why:'no text node' };
      var len = Math.min(6, (tn.nodeValue || '').length);
      if(len < 1) return { ok:false, why:'empty text node' };
      var range = document.createRange();
      range.setStart(tn, 0); range.setEnd(tn, len);
      var sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      var sleep = function(ms){ return new Promise(function(r){setTimeout(r,ms);}); };
      await sleep(250);
      var menu = document.querySelector('.dict-menu');
      if(!menu) return { ok:false, why:'no menu', selText: sel.toString() };
      var cs = getComputedStyle(menu);
      return { ok:true, menuBg: cs.backgroundColor, menuRadius: cs.borderTopLeftRadius, btnCount: document.querySelectorAll('.dict-menu-btn').length, selText: sel.toString() };
    })()`;
    const menuRes = await evaluate(SELECT_AND_OPEN_MENU);
    check('D1 划词工具条出现（复制/查询 2 按钮）', menuRes?.ok === true && menuRes?.btnCount === 2, JSON.stringify(menuRes));
    check('D2 工具条背景 = rgb(51,51,51)', menuRes?.menuBg === 'rgb(51, 51, 51)', `bg=${menuRes?.menuBg}`);
    check('D3 工具条圆角 = 8px', menuRes?.menuRadius === '8px', `radius=${menuRes?.menuRadius}`);

    await evaluate(`(function(){ var b=document.querySelectorAll('.dict-menu-btn'); if(b.length<2) return false; b[1].click(); return true; })()`);
    const CARD_PROBE = `(function(){
      var c=document.querySelector('.dict-card'); if(!c) return {open:false};
      var cs=getComputedStyle(c);
      return { open:true, tl:cs.borderTopLeftRadius, tr:cs.borderTopRightRadius, bl:cs.borderBottomLeftRadius, bg:cs.backgroundColor };
    })()`;
    let card = null;
    {
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) {
        card = await evaluate(CARD_PROBE);
        if (card && card.open) break;
        await sleep(150);
      }
    }
    check('D4 释义卡圆角 = 12px 12px 0 0', card?.tl === '12px' && card?.tr === '12px' && card?.bl === '0px', `tl=${card?.tl} tr=${card?.tr} bl=${card?.bl}`);
    check('D5 释义卡背景 = rgb(51,51,51)', card?.bg === 'rgb(51, 51, 51)', `bg=${card?.bg}`);

    /* ---- 选区高亮：源 styles.css 含 #E8D3A2 ---- */
    let cssText = '';
    try { cssText = await readFile(join(ROOT, 'apps', 'web', 'src', 'styles.css'), 'utf8'); } catch (e) { cssText = ''; }
    check('S8 styles.css ::selection 规则含 #E8D3A2', /#E8D3A2/i.test(cssText), `cssLen=${cssText.length}`);
    check('S9 源 styles.css .dict-toast 背景 = #333333（浮层家族统一深色）', /\.dict-toast\s*\{[^}]*background:\s*#333333/i.test(cssText), `hit=${/\.dict-toast\s*\{[^}]*background:\s*#333333/i.test(cssText)}`);
    check('S10 源 styles.css 已清除废弃 reader-* 死类', !/\.reader-bg-thumb|\.reader-sheet-tools|\.reader-brightness-bar|\.reader-pos-mini|\.reader-tools\b/i.test(cssText), `deadLeft=${/\.reader-bg-thumb|\.reader-sheet-tools|\.reader-brightness-bar|\.reader-pos-mini|\.reader-tools\b/i.test(cssText)}`);
  } catch (e) {
    check('step2-harness', false, String((e && e.stack) || e));
  }

  finish(checks.every((c) => c.pass) ? 0 : 2);
} catch (e) {
  check('harness', false, String((e && e.stack) || e));
  finish(2);
}
