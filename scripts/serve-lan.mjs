#!/usr/bin/env node
/**
 * 局域网内容分发静态服务器（带 CORS）。
 *
 * 用于「应用内一键更新」的作者调试通道（见 docs/11-UI改进与OTA方案设计.md §4.9）：
 * 在 PC 本机托管 content 更新包（manifest.json + content.zip），手机经同一局域网
 * `http://<PC-IP>:<port>/` 直接 GET。零第三方依赖，仅用 node:http / node:fs。
 *
 * 用法：
 *   node scripts/serve-lan.mjs [dir] [port]
 *     dir  默认为 ./release/latest（从项目根解析），也可用绝对/相对路径
 *     port 默认为 8080
 *
 * 特性：
 *   - 返回 Access-Control-Allow-Origin:* 等 CORS 头（WebView fetch 必需）
 *   - 处理 OPTIONS 预检
 *   - 支持 Range（可选，为超大 zip 预留）
 *   - 目录索引关闭；尝试请求目录时回落到 index.html（若存在）
 *   - 打印局域网可达地址提示
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = resolve(HERE, '..', 'release', 'latest');

const argDir = process.argv[2];
const ROOT_DIR = argDir ? resolve(argDir) : DEFAULT_DIR;
const PORT = Number(process.argv[3] || 8080);

const MIME = {
  '.json': 'application/json; charset=utf-8',
  '.zip': 'application/zip',
  '.pks': 'application/zip',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
  };
}

async function send(res, status, body, type) {
  res.writeHead(status, {
    ...corsHeaders(),
    'Content-Type': type ?? 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function safeResolve(root, reqPath) {
  // 去掉 query / hash
  let p = decodeURIComponent(reqPath.split('?')[0].split('#')[0]);
  // 反斜杠归一
  p = p.replace(/\\/g, '/');
  const target = resolve(root, '.' + p);
  // 防止路径穿越
  if (target !== root && !target.startsWith(root + sep)) return null;
  return target;
}

const server = createServer(async (req, res) => {
  const urlPath = (req.url ?? '/').split('?')[0];

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  let target = safeResolve(ROOT_DIR, urlPath);
  if (!target) {
    send(res, 403, 'Forbidden');
    return;
  }

  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      // 目录索引关闭；有 index.html 则回退
      const idx = join(target, 'index.html');
      if (existsSync(idx)) {
        target = idx;
      } else {
        send(res, 404, 'Not Found');
        return;
      }
    }
  } catch {
    send(res, 404, 'Not Found');
    return;
  }

  // Range 支持（对 zip 大包有用）
  const range = req.headers.range;
  let data;
  try {
    data = await readFile(target);
  } catch {
    send(res, 500, 'Server Error');
    return;
  }

  const type = MIME[extname(target).toLowerCase()] ?? 'application/octet-stream';

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const size = data.length;
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (isNaN(start) || start < 0) start = 0;
    if (isNaN(end) || end >= size) end = size - 1;
    if (start > end) {
      res.writeHead(416, { ...corsHeaders(), 'Content-Range': `bytes */${size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      ...corsHeaders(),
      'Content-Type': type,
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
    });
    res.end(data.subarray(start, end + 1));
    return;
  }

  res.writeHead(200, {
    ...corsHeaders(),
    'Content-Type': type,
    'Content-Length': data.length,
    'Accept-Ranges': 'bytes',
  });
  res.end(data);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    process.stderr.write(`[serve-lan] 端口 ${PORT} 已被占用，请换端口：node scripts/serve-lan.mjs ${argDir ?? ''} ${PORT + 1}\n`);
  } else {
    process.stderr.write(`[serve-lan] 服务错误：${err.message}\n`);
  }
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  process.stdout.write('==================================================\n');
  process.stdout.write(` 局域网内容分发服务器已启动\n`);
  process.stdout.write(` 根目录  ${ROOT_DIR}\n`);
  const ips = lanIps();
  if (ips.length) {
    for (const ip of ips) {
      process.stdout.write(` 手机访问 http://${ip}:${PORT}/manifest.json\n`);
    }
  } else {
    process.stdout.write(` 端口    http://0.0.0.0:${PORT}\n`);
  }
  process.stdout.write(' CORS    已开启 (Access-Control-Allow-Origin: *)\n');
  process.stdout.write(' 按 Ctrl+C 停止\n');
  process.stdout.write('==================================================\n');
});

function lanIps() {
  const out = [];
  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}
