/* PKS 知识站 · 轻量离线 Service Worker（手写，无外部依赖）
 *
 * 策略：
 *  - install：预缓存核心 app-shell（index.html + favicon）。
 *  - fetch（同源 GET）：
 *      · 导航请求（mode === 'navigate'）→ 网络优先，失败回退缓存的 index.html（SPA 离线壳）。
 *      · /assets/ 带 hash 的静态资源（JS/CSS，不可变）→ cache-first（命中即返，未命中取网并回填）。
 *      · /content/ 等大体积数据 → stale-while-revalidate（先返缓存，后台静默更新）。
 *      · 其它同源 GET → stale-while-revalidate。
 *  - 非 GET / 跨域请求 → 直接透传 fetch()，不干预。
 *  - activate：clients.claim() + 清理旧版本缓存。
 *
 * 注意：本文件位于 public/，Vite 会原样拷贝到 dist 根；不进 TS 编译，故用原生 SW JS 书写。
 * 仅 web 端生效，不影响 Android APK 既有的内置资产 + 局域网 OTA 离线路径。
 */
const CACHE = 'pks-cache-v1';
const CORE = [
  './index.html',
  './favicon.ico',
  './favicon-32.png',
  './favicon-192.png',
  './favicon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // 非 GET 直接透传

  const url = new URL(req.url);
  if (!isSameOrigin(url)) return; // 跨域直接透传

  // 导航请求：网络优先，失败回退 app-shell（保证离线可进首页）
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => undefined);
          return res;
        })
        .catch(() =>
          caches.match('./index.html').then((r) => r || caches.match('./')),
        ),
    );
    return;
  }

  const path = url.pathname;

  // assets：带 hash 不可变 → cache-first
  if (path.indexOf('/assets/') !== -1) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
          }
          return res;
        });
      }),
    );
    return;
  }

  // content 及其它同源 GET：stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
