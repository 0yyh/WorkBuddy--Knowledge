/**
 * contentUpdater · 集成测试（真实缓存层 + 真实 loader 读取链路）。
 *
 * 与 `contentUpdater.test.ts`（全 mock）的区别：本文件**不 mock contentCache 也不 mock
 * loader**，而是给真实模块喂一个内存版 IndexedDB（`fake-indexeddb` 本仓未依赖，按任务说明
 * 用内存 stub），只把网络层（全局 `fetch`）打桩。这样验证的是端到端语义：
 *   - OTA 下载/校验后写入的是**真实 IndexedDB**；
 *   - 激活标记（ACTIVATED/BUILT_AT）落在**真实 meta 表**；
 *   - loader 的「缓存优先」读取路径在已激活 / 未激活下读到的是**真实正确**的内容，
 *     不会出现「新下载成功那部分 + 上次残留那部分」被混读的「半新半旧」。
 *
 * 覆盖任务三点：
 *   1. 损坏文件回退：被篡改文件校验失败 → 不激活、不污染缓存、loader 回退随包内容；
 *   2. 半截写入（部分下载失败）：不留下可被 loader 读到的混合内容、激活标记摘掉；
 *   3. 正常全量更新：激活置 true、BUILT_AT 更新、loader 走缓存优先读到 OTA 内容、清理残留。
 *
 * 由于生产代码已在 applyContentUpdate 开头先 `setMeta(ACTIVATED_KEY, false)`（contentUpdater.ts:365），
 * 上述「半新半旧」bug 已被修复；本测试用真实缓存层锁死该不变式，无需再改生产逻辑。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const sha1 = (s: string): string => createHash('sha1').update(s, 'utf8').digest('hex');
const byteLen = (s: string): number => Buffer.byteLength(s, 'utf8');

/** 造一条与 `scripts/build-update.mjs` 同构的清单条目（三字段互相自洽） */
function entryOf(path: string, body: string) {
  return { path, sha256: sha256(body), sha1: sha1(body), size: byteLen(body) };
}

/* ============================ 内存版 IndexedDB ============================ */
/* 仅实现 contentCache.ts 实际用到的子集，足以驱动真实 contentCache 的读写语义。
 * 事务在 setTimeout(0) 中提交：先逐个触发 request.onsuccess，再触发 tx.oncomplete，
 * 与真实 IDB「请求同步发起、事件循环空闲后提交」的时序一致。 */

class FakeRequest {
  result: unknown = undefined;
  error: unknown = null;
  onsuccess: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  fired = false;
  constructor(result?: unknown) {
    this.result = result;
  }
}

class FakeObjectStore {
  private data: Map<unknown, unknown>;
  private tx: FakeTransaction | null;
  constructor(data: Map<unknown, unknown>, tx: FakeTransaction | null) {
    this.data = data;
    this.tx = tx;
  }
  private track(r: FakeRequest): FakeRequest {
    if (this.tx) this.tx.track(r);
    return r;
  }
  put(value: unknown, key?: unknown): FakeRequest {
    const r = new FakeRequest(key);
    this.data.set(key, value);
    r.result = key;
    return this.track(r);
  }
  get(key: unknown): FakeRequest {
    const r = new FakeRequest();
    r.result = this.data.has(key) ? this.data.get(key) : undefined;
    return this.track(r);
  }
  delete(key: unknown): FakeRequest {
    const r = new FakeRequest();
    this.data.delete(key);
    return this.track(r);
  }
  getAllKeys(): FakeRequest {
    const r = new FakeRequest();
    r.result = [...this.data.keys()];
    return this.track(r);
  }
  clear(): FakeRequest {
    const r = new FakeRequest();
    this.data.clear();
    return this.track(r);
  }
}

class FakeTransaction {
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  private db: FakeDatabase;
  private names: string[];
  private reqs: FakeRequest[] = [];
  private committed = false;
  constructor(db: FakeDatabase, names: string | string[], _mode: string) {
    this.db = db;
    this.names = Array.isArray(names) ? names : [names];
    setTimeout(() => this.commit(), 0);
  }
  objectStore(name: string): FakeObjectStore {
    return new FakeObjectStore(this.db.storeMap(name), this);
  }
  track(r: FakeRequest): void {
    this.reqs.push(r);
  }
  private commit(): void {
    if (this.committed) return;
    this.committed = true;
    for (const r of this.reqs) {
      if (!r.fired) {
        r.fired = true;
        r.onsuccess?.();
      }
    }
    // 真实 IndexedDB 的 oncomplete 在 onsuccess 之后的「下一个任务」才派发；
    // 而 contentCache 的 getMeta/getCached 是先 `await requestValue(req)` 再
    // `await requestDone(tx)`，即 oncomplete 处理器是在 req.onsuccess 触发后的微任务里
    // 才挂上的。因此这里必须把 oncomplete 推迟到独立 macrotask，否则会早于处理器挂载，
    // 导致 requestDone 的 Promise 永不 resolve（测试卡死）。
    setTimeout(() => {
      this.oncomplete?.();
    }, 0);
  }
}

class FakeDatabase {
  objectStoreNames: { contains: (n: string) => boolean };
  private stores: Record<string, Map<unknown, unknown>> = {};
  constructor() {
    this.objectStoreNames = { contains: (n: string) => n in this.stores };
  }
  storeMap(name: string): Map<unknown, unknown> {
    return this.stores[name];
  }
  createObjectStore(name: string): FakeObjectStore {
    this.stores[name] = new Map();
    this.objectStoreNames = { contains: (n: string) => n in this.stores };
    return new FakeObjectStore(this.stores[name], null);
  }
  transaction(names: string | string[], mode: string): FakeTransaction {
    return new FakeTransaction(this, names, mode);
  }
  close(): void {
    /* noop */
  }
}

class FakeFactory {
  private dbs: Record<string, FakeDatabase> = {};
  open(name: string, _version: number): unknown {
    const req = new FakeRequest();
    setTimeout(() => {
      const existing = this.dbs[name];
      if (!existing) {
        const db = new FakeDatabase();
        this.dbs[name] = db;
        req.result = db;
        (req as FakeRequest & { onupgradeneeded?: () => void }).onupgradeneeded?.();
        req.onsuccess?.();
      } else {
        req.result = existing;
        req.onsuccess?.();
      }
    }, 0);
    return req;
  }
  deleteDatabase(name: string): void {
    delete this.dbs[name];
  }
}

/* ============================ 受控 fetch ============================ */

interface ResInit {
  ok?: boolean;
  status?: number;
}
function res(body: string, init: ResInit = {}): Response {
  const ok = init.ok ?? true;
  const status = init.status ?? (ok ? 200 : 404);
  return {
    ok,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
  } as unknown as Response;
}

const OTA = 'http://ota.test';
const routes = new Map<string, string>();
const throwUrls = new Set<string>();
let fetchMock: ReturnType<typeof vi.fn>;

/* ============================ 真实模块（每测试重导入以获得干净 DB） ============================ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cc: typeof import('./contentCache');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ld: typeof import('./loader');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cu: typeof import('./contentUpdater');

beforeEach(async () => {
  // 每个测试用全新的内存 IndexedDB + 全新模块图（openCache 的 dbPromise 在模块内记忆）。
  vi.stubGlobal('indexedDB', new FakeFactory());
  vi.resetModules();
  cc = await import('./contentCache');
  ld = await import('./loader');
  cu = await import('./contentUpdater');

  routes.clear();
  throwUrls.clear();
  fetchMock = vi.fn(async (url: string) => {
    if (throwUrls.has(url)) throw new Error('network down');
    const body = routes.get(url);
    return body === undefined ? res('not found', { ok: false, status: 404 }) : res(body);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('集成 · 损坏文件回退（防污染 + 不误激活）', () => {
  it('被篡改文件校验失败 → 不激活、缓存不被污染、loader 回退随包内容', async () => {
    const good = 'real-content-A';
    const tampered = 'tampered-A!!!'; // 等长篡改，确保走 sha1/sha256 校验层
    const entry = entryOf('index/a.json', good);

    // OTA 源返回被篡改的内容（与清单哈希不符）
    routes.set(`${OTA}/index/a.json`, tampered);
    // 随包（bundled）内容：用于验证 loader 在未激活时回退读到的是它，而非被篡改内容
    routes.set('/content/index/a.json', 'BUNDLED_A');

    const r = await cu.applyContentUpdate(OTA, {
      built_at: '2026-09-01',
      files: [entry],
      content_url: './',
    });

    // 1) 更新判定为失败、绝不激活
    expect(r.updated).toBe(0);
    expect(r.failed).toBe(1);
    expect(r.activated).toBe(false);

    // 2) 激活标记没有被错误地置为 true（真实 meta 表）
    expect(await cc.getMeta(cc.ACTIVATED_KEY)).toBe(false);
    expect(await cc.getMeta(cc.BUILT_AT_KEY)).toBeNull();

    // 3) 被篡改内容没有写进缓存（不污染）
    expect(await cc.getCached('index/a.json')).toBeNull();

    // 4) loader 走「缓存优先」但此时未激活 → 回退到随包内容，且读到的不是被篡改内容
    const fromLoader = await ld.fetchText('index/a.json');
    expect(fromLoader).toBe('BUNDLED_A');
  });
});

describe('集成 · 半截写入（部分下载失败，杜绝半新半旧）', () => {
  it('已激活状态下部分文件下载失败 → 激活摘掉、loader 不读到混合内容', async () => {
    const bodyA = 'content-one';
    const bodyB = 'content-two';
    const files = [entryOf('index/a.json', bodyA), entryOf('index/b.json', bodyB)];

    // 预设「上一轮已激活」的状态：meta 激活、缓存里有旧的全量内容
    await cc.setMeta(cc.ACTIVATED_KEY, true);
    await cc.putCached('index/a.json', 'OLD_A');
    await cc.putCached('index/b.json', 'OLD_B');

    // a 正常下载；b 下载中途抛错（模拟半截写入/断网）
    routes.set(`${OTA}/index/a.json`, bodyA);
    throwUrls.add(`${OTA}/index/b.json`);
    // 随包内容（回退目标）
    routes.set('/content/index/a.json', 'BUNDLED_A');
    routes.set('/content/index/b.json', 'BUNDLED_B');

    const r = await cu.applyContentUpdate(OTA, {
      built_at: '2026-09-01',
      files,
      content_url: './',
    });

    // 1) 一个成功、一个失败，整体不激活
    expect(r.updated).toBe(1);
    expect(r.failed).toBe(1);
    expect(r.activated).toBe(false);

    // 2) ★ 核心：激活标记被摘回 false（真实 meta 表），否则 loader 会混读
    expect(await cc.getMeta(cc.ACTIVATED_KEY)).toBe(false);
    expect(await cc.getMeta(cc.BUILT_AT_KEY)).toBeNull();

    // 3) 缓存里确实留下了「新的 a」（部分写入发生），但——
    expect(await cc.getCached('index/a.json')).toBe(bodyA);
    expect(await cc.getCached('index/b.json')).toBe('OLD_B'); // b 仍是上一轮残留

    // 4) ★ loader 未激活 → 完全忽略缓存，读到的是随包内容而非「新 a + 旧 b」混合
    expect(await ld.fetchText('index/a.json')).toBe('BUNDLED_A');
    expect(await ld.fetchText('index/b.json')).toBe('BUNDLED_B');
  });
});

describe('集成 · 正常全量更新（激活 + 缓存优先 + 清理残留）', () => {
  it('全部校验通过 → 激活置 true、BUILT_AT 更新、loader 走缓存优先、清理清单外残留', async () => {
    const bodyA = 'fresh-A';
    const bodyB = 'fresh-B';
    const files = [entryOf('index/a.json', bodyA), entryOf('index/b.json', bodyB)];

    routes.set(`${OTA}/index/a.json`, bodyA);
    routes.set(`${OTA}/index/b.json`, bodyB);
    routes.set('/content/index/a.json', 'BUNDLED_A');
    routes.set('/content/index/b.json', 'BUNDLED_B');

    // 预置一个不在新清单里的旧残留
    await cc.putCached('index/stale.json', 'OLD_STALE');

    const r = await cu.applyContentUpdate(OTA, {
      built_at: '2026-09-02',
      files,
      content_url: './',
    });

    // 1) 全部成功并激活
    expect(r).toMatchObject({ updated: 2, failed: 0, activated: true });
    expect(await cc.getMeta(cc.ACTIVATED_KEY)).toBe(true);
    expect(await cc.getMeta(cc.BUILT_AT_KEY)).toBe('2026-09-02');

    // 2) 新内容已落真实缓存
    expect(await cc.getCached('index/a.json')).toBe(bodyA);
    expect(await cc.getCached('index/b.json')).toBe(bodyB);

    // 3) 清单外的旧残留被清理
    expect(await cc.getCached('index/stale.json')).toBeNull();

    // 4) ★ loader 已激活 → 缓存优先，读到的是 OTA 新内容（而非随包 BUNDLED_*）
    expect(await ld.fetchText('index/a.json')).toBe(bodyA);
    expect(await ld.fetchText('index/b.json')).toBe(bodyB);
  });
});
