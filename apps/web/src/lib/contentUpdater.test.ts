/**
 * contentUpdater 单元测试（局域网 OTA：清单校验 → 并发下载 → 校验 → 缓存激活）。
 *
 * 本模块此前**零测试**，却是全项目风险最高的一块：它负责下载并应用远端内容、
 * 写 IndexedDB、并在成功后激活缓存层 —— 一旦语义出错会直接污染本地内容。
 * 因此这里重点锁死几条**安全语义**（与实现注释一一对应）：
 *  - 空清单（files=[]）必须被拒绝：否则「清理清单外旧缓存」会把整份缓存清空；
 *  - 哈希不匹配 / 部分失败 → 不推进 built_at、不激活，杜绝「半新半旧被当作最新」；
 *  - 全部成功 → 才激活 + 清理清单外残留。
 * 另覆盖 relPathOfFile、清单格式校验与规整、版本比较、本机文件导入白名单。
 *
 * 新增覆盖「防损坏」语义：
 *  - 局域网是 http（非安全上下文），`crypto.subtle` 不可用 —— sha1 作为主校验**永不降级**，
 *    损坏文件必须仍被拦下，而不是像旧实现那样「跳过校验」；
 *  - files_checksum 挡住清单被截断/少项（否则会合法通过并误删本机缓存）；
 *  - 已激活状态下部分失败 → 必须摘掉激活标记，杜绝 loader 读到「半新半旧」。
 *
 * 依赖全部打桩：contentCache（IndexedDB）与 loader 均被 vi.mock 替换，
 * fetch 走可控路由，从而把被测面收敛到 contentUpdater 自身。
 * 哈希期望值一律用 node:crypto **独立**算一遍（而不是复用被测代码的实现），
 * 校验的不是「有没有返回值」而是**值对不对**。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'node:crypto';

const sha = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const sha1ref = (s: string): string => createHash('sha1').update(s, 'utf8').digest('hex');

/** 造一条与 `scripts/build-update.mjs` 同构的清单条目（三个字段互相自洽） */
function entryOf(path: string, body: string) {
  return { path, sha256: sha(body), sha1: sha1ref(body), size: Buffer.byteLength(body, 'utf8') };
}

// —— 打桩状态（vi.hoisted 保证在 vi.mock 工厂里可用）——
const h = vi.hoisted(() => ({
  meta: new Map<string, unknown>(),
  cache: new Map<string, string>(),
  putFail: { on: false as boolean },
}));

vi.mock('./contentCache', () => ({
  ACTIVATED_KEY: 'pks:activated',
  BUILT_AT_KEY: 'pks:builtAt',
  getMeta: async (k: string) => (h.meta.has(k) ? h.meta.get(k) : null),
  setMeta: async (k: string, v: unknown) => { h.meta.set(k, v); },
  putCached: async (p: string, t: string) => {
    if (h.putFail.on) return false;
    h.cache.set(p, t);
    return true;
  },
  getCached: async (p: string) => h.cache.get(p) ?? null,
  deleteCached: async (p: string) => { h.cache.delete(p); },
  listCachedPaths: async () => [...h.cache.keys()],
  clearCache: async () => { h.cache.clear(); },
}));

vi.mock('./loader', () => ({
  assetUrl: (rel: string) => `/content/${rel}`,
  invalidateContentCacheFlag: vi.fn(),
}));

const {
  relPathOfFile,
  sha256Available,
  sha256Hex,
  computeFilesChecksum,
  verifyEntryText,
  byteLengthOf,
  fetchUpdateManifest,
  checkForContentUpdate,
  applyContentUpdate,
  importLocalFiles,
  resetContentCache,
  getUpdateSourceUrl,
  setUpdateSourceUrl,
  UPDATE_URL_KEY,
} = await import('./contentUpdater');

/** 构造最小 Response（只用到 .ok / .status / .text() / .json()）。 */
function res(body: string, ok = true, status = ok ? 200 : 404): Response {
  return {
    ok,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
  } as unknown as Response;
}

/** 可控 fetch：路由表 + 可切换的处理器。 */
const routes = new Map<string, string>();
let handler: (url: string) => Promise<Response> = async (url) => {
  const body = routes.get(url);
  return body === undefined ? res('not found', false, 404) : res(body);
};
const fetchMock = vi.fn(async (url: string) => handler(url));

/**
 * 造一个 File 替身：模块内会调用 `file.text()` 读内容，
 * 因此必须提供 text()，否则会被 catch 成「跳过」而掩盖真实行为。
 */
function fakeFile(name: string, rel?: string, text = 'file-content'): File {
  return {
    name,
    text: async () => text,
    ...(rel ? { webkitRelativePath: rel } : {}),
  } as unknown as File;
}

function manifest(builtAt: string, files: Array<{ path: string; sha256: string; size?: number }>) {
  return JSON.stringify({ built_at: builtAt, files });
}

beforeEach(() => {
  h.meta.clear();
  h.cache.clear();
  h.putFail.on = false;
  routes.clear();
  fetchMock.mockClear();
  handler = async (url) => {
    const body = routes.get(url);
    return body === undefined ? res('not found', false, 404) : res(body);
  };
  vi.stubGlobal('fetch', fetchMock);
});

describe('relPathOfFile（本机导入路径推导）', () => {
  it('webkitRelativePath 含 content/ 时取其后段', () => {
    expect(relPathOfFile(fakeFile('manifest.json', 'D:/pkg/content/index/manifest.json')))
      .toBe('index/manifest.json');
  });

  it('反斜杠归一化，且剥离前导斜杠', () => {
    expect(relPathOfFile(fakeFile('a.json', 'content\\index\\a.json'))).toBe('index/a.json');
  });

  it('无 webkitRelativePath 时回退为文件名', () => {
    expect(relPathOfFile(fakeFile('manifest.json'))).toBe('manifest.json');
  });

  it('路径中不含 content/ 时返回归一化后的原始值', () => {
    expect(relPathOfFile(fakeFile('x.json', 'somewhere/else/x.json'))).toBe('somewhere/else/x.json');
  });
});

describe('sha256（完整性校验）', () => {
  it('sha256Hex 与 node:crypto 结果一致（不是只返回非空）', async () => {
    expect(await sha256Hex('hello')).toBe(sha('hello'));
    expect(await sha256Hex('中文内容')).toBe(sha('中文内容'));
  });

  it('crypto.subtle 不可用时返回 null（调用方据此跳过校验）', async () => {
    vi.stubGlobal('crypto', {});
    expect(await sha256Available()).toBe(false);
    expect(await sha256Hex('hello')).toBeNull();
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('默认环境（node）下 subtle 可用', async () => {
    expect(await sha256Available()).toBe(true);
  });
});

describe('fetchUpdateManifest（清单拉取 / 校验 / 规整）', () => {
  const base = 'http://192.168.1.9:8080';

  it('URL 拼装：base 末尾多余斜杠被裁剪', async () => {
    routes.set(`${base}/manifest.json`, manifest('2026-01-01', [
      entryOf('index/manifest.json', 'x'),
    ]));
    await fetchUpdateManifest(`${base}///`);
    expect(fetchMock.mock.calls[0][0]).toBe(`${base}/manifest.json`);
  });

  it('规整：反斜杠转正斜杠、sha256/sha1 转小写、默认 content_url', async () => {
    routes.set(`${base}/manifest.json`, manifest('2026-01-01', [
      { path: '\\index\\a.json', sha256: 'ABCD', sha1: 'EF01', size: 5 },
    ]));
    const m = await fetchUpdateManifest(base);
    expect(m.files[0].path).toBe('index/a.json');
    expect(m.files[0].sha256).toBe('abcd');
    expect(m.files[0].sha1).toBe('ef01');
    expect(m.files[0].size).toBe(5);
    expect(m.content_url).toBe('./');
  });

  it('★ 清单缺 sha1 → 明确报错（局域网无 subtle，缺 sha1 等于零校验）', async () => {
    routes.set(`${base}/manifest.json`, JSON.stringify({
      built_at: 'x', files: [{ path: 'index/a.json', sha256: 'aa', size: 1 }],
    }));
    await expect(fetchUpdateManifest(base)).rejects.toThrow(/缺少 sha1/);
  });

  // size 是 isManifestShaped 的必填项，故 normalizeManifest 里「缺 size 补 0」的兜底
  // 经 fetchUpdateManifest 实际不可达 —— 这里锁死真实行为：缺 size 直接判为格式不符。
  it('条目缺 size → 判为格式不符（size 必填）', async () => {
    routes.set(`${base}/manifest.json`, JSON.stringify({
      built_at: 'x', files: [{ path: 'index/a.json', sha256: 'ab' }],
    }));
    await expect(fetchUpdateManifest(base)).rejects.toThrow(/格式不符/);
  });

  it('HTTP 非 2xx → 抛出明确错误', async () => {
    handler = async () => res('', false, 500);
    await expect(fetchUpdateManifest(base)).rejects.toThrow(/HTTP 500/);
  });

  it('非 JSON → 抛出「不是合法 JSON」', async () => {
    routes.set(`${base}/manifest.json`, 'not json at all');
    await expect(fetchUpdateManifest(base)).rejects.toThrow(/不是合法 JSON/);
  });

  it('格式不符（files 为空 / 缺 sha256）→ 抛出格式错误', async () => {
    routes.set(`${base}/manifest.json`, JSON.stringify({ built_at: 'x', files: [] }));
    await expect(fetchUpdateManifest(base)).rejects.toThrow(/格式不符/);

    routes.set(`${base}/manifest.json`, JSON.stringify({ built_at: 'x', files: [{ path: 'a' }] }));
    await expect(fetchUpdateManifest(base)).rejects.toThrow(/格式不符/);
  });

  it('网络不可达 → 抛出「无法连接更新源」', async () => {
    handler = async () => { throw new Error('ECONNREFUSED'); };
    await expect(fetchUpdateManifest(base)).rejects.toThrow(/无法连接更新源/);
  });
});

describe('checkForContentUpdate（版本比较）', () => {
  const base = 'http://192.168.1.9:8080';

  beforeEach(() => {
    routes.set(`${base}/manifest.json`, manifest('2026-02-02T00:00:00Z', [
      entryOf('index/manifest.json', 'x'),
    ]));
  });

  it('空地址 → 直接提示先填写，不发请求', async () => {
    const r = await checkForContentUpdate('   ');
    expect(r.hasUpdate).toBe(false);
    expect(r.reason).toMatch(/请先填写更新源地址/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('本机无版本记录 → 判定有更新', async () => {
    const r = await checkForContentUpdate(base);
    expect(r.hasUpdate).toBe(true);
    expect(r.reason).toMatch(/尚无内容版本记录/);
  });

  it('版本一致 → 已是最新', async () => {
    h.meta.set('pks:builtAt', '2026-02-02T00:00:00Z');
    const r = await checkForContentUpdate(base);
    expect(r.hasUpdate).toBe(false);
    expect(r.reason).toBe('已是最新');
  });

  it('版本不同 → 有更新，并给出本机→远端说明', async () => {
    h.meta.set('pks:builtAt', '2026-01-01T00:00:00Z');
    const r = await checkForContentUpdate(base);
    expect(r.hasUpdate).toBe(true);
    expect(r.reason).toMatch(/本机 .* → 远端/);
  });
});

describe('applyContentUpdate（下载 → 校验 → 激活）', () => {
  const base = 'http://192.168.1.9:8080';
  const body1 = 'hello one';
  const body2 = 'hello two';

  const files = [
    entryOf('index/a.json', body1),
    entryOf('index/b.json', body2),
  ];

  beforeEach(() => {
    routes.set(`${base}/index/a.json`, body1);
    routes.set(`${base}/index/b.json`, body2);
  });

  it('全部成功 → 激活，写入 built_at/activated，并清理清单外旧缓存', async () => {
    h.cache.set('index/stale.json', 'old'); // 清单里没有的残留
    const r = await applyContentUpdate(base, { built_at: '2026-03-03', files, content_url: './' });

    expect(r).toMatchObject({ updated: 2, failed: 0, activated: true });
    expect(h.cache.get('index/a.json')).toBe(body1);
    expect(h.cache.has('index/stale.json')).toBe(false); // 残留被清理
    expect(h.meta.get('pks:builtAt')).toBe('2026-03-03');
    expect(h.meta.get('pks:activated')).toBe(true);
  });

  it('★ 空清单必须拒绝：不激活、不写 built_at、且不清空缓存', async () => {
    h.cache.set('index/keep.json', 'important');
    const r = await applyContentUpdate(base, { built_at: '2026-03-03', files: [], content_url: './' });

    expect(r.activated).toBe(false);
    expect(r.warnings.join()).toMatch(/更新清单为空/);
    expect(h.cache.get('index/keep.json')).toBe('important'); // 关键：整份缓存未被清空
    expect(h.meta.get('pks:builtAt')).toBeUndefined();
    expect(h.meta.get('pks:activated')).toBeUndefined();
  });

  it('★ SHA-256 不符 → 该文件不入库、整体不激活、不推进 built_at', async () => {
    const bad = [{ ...files[0], sha256: sha('tampered') }];
    const r = await applyContentUpdate(base, { built_at: '2026-03-03', files: bad, content_url: './' });

    expect(r.activated).toBe(false);
    expect(r.failed).toBe(1);
    expect(h.cache.has('index/a.json')).toBe(false); // 不入库
    expect(h.meta.get('pks:builtAt')).toBeUndefined(); // 不推进版本
  });

  it('★ SHA-1 不符（内容被改）→ 拦下，不入库、不激活', async () => {
    const bad = [{ ...files[0], sha1: sha1ref('tampered'), sha256: sha('tampered') }];
    const r = await applyContentUpdate(base, { built_at: '2026-03-03', files: bad, content_url: './' });

    expect(r.failed).toBe(1);
    expect(r.activated).toBe(false);
    expect(h.cache.has('index/a.json')).toBe(false);
  });

  it('★ 文件被截断（大小不符）→ 拦下', async () => {
    routes.set(`${base}/index/a.json`, body1.slice(0, 3)); // 服务端只给了半个文件
    const r = await applyContentUpdate(base, { built_at: '2026-03-03', files: [files[0]], content_url: './' });

    expect(r.failed).toBe(1);
    expect(r.activated).toBe(false);
    expect(h.cache.has('index/a.json')).toBe(false);
  });

  it('★ 已激活状态下部分失败 → 必须摘掉激活标记（否则 loader 读到半新半旧）', async () => {
    h.meta.set('pks:activated', true);            // 上一轮已激活
    h.cache.set('index/stale.json', 'old');       // 上一轮残留内容
    routes.delete(`${base}/index/b.json`);        // 本轮 b 下载失败

    const r = await applyContentUpdate(base, { built_at: '2026-03-03', files, content_url: './' });

    expect(r.failed).toBe(1);
    expect(r.activated).toBe(false);
    expect(h.meta.get('pks:activated')).toBe(false);      // ★ 核心：不能停留在 true
    expect(h.meta.get('pks:builtAt')).toBeUndefined();
  });

  it('★ 非安全上下文（subtle 不可用）时，损坏文件仍被 SHA-1 拦住 —— 不再是「跳过校验」', async () => {
    vi.stubGlobal('crypto', {});                          // 模拟局域网 http
    routes.set(`${base}/index/a.json`, 'corrupted-on-the-wire');

    const r = await applyContentUpdate(base, { built_at: '2026-03-03', files: [files[0]], content_url: './' });

    expect(r.failed).toBe(1);                             // ★ 损坏内容必须被拦
    expect(r.activated).toBe(false);
    expect(h.cache.has('index/a.json')).toBe(false);

    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('★ 部分失败（其中一个 404）→ 不激活，避免半新半旧被当作最新', async () => {
    routes.delete(`${base}/index/b.json`); // b 下载失败
    const r = await applyContentUpdate(base, { built_at: '2026-03-03', files, content_url: './' });

    expect(r.failed).toBe(1);
    expect(r.updated).toBe(1);
    expect(r.activated).toBe(false);
    expect(h.meta.get('pks:builtAt')).toBeUndefined();
    // 开头已先摘掉激活标记，失败后保持 false → loader 回退随包内容
    expect(h.meta.get('pks:activated')).toBe(false);
  });

  it('写入缓存失败（putCached 返回 false）计入 failed 且不激活', async () => {
    h.putFail.on = true;
    const r = await applyContentUpdate(base, { built_at: '2026-03-03', files, content_url: './' });
    expect(r.failed).toBe(2);
    expect(r.activated).toBe(false);
  });

  it('进度回调按 (done, total) 递增，最终达到总数', async () => {
    const seen: Array<[number, number]> = [];
    await applyContentUpdate(base, { built_at: '2026-03-03', files, content_url: './' },
      (done, total) => seen.push([done, total]));

    expect(seen).toHaveLength(2);
    expect(seen[seen.length - 1]).toEqual([2, 2]);
    expect(seen.every(([, total]) => total === 2)).toBe(true);
  });

  it('SHA-256 不可用（局域网 http）→ 改用 SHA-1 校验，正常内容仍能完成并激活', async () => {
    vi.stubGlobal('crypto', {});
    const r = await applyContentUpdate(base, { built_at: '2026-03-03', files, content_url: './' });

    expect(r.warnings.join()).toMatch(/不支持 SHA-256/);
    expect(r.warnings.join()).toMatch(/SHA-1/);
    expect(r.updated).toBe(2);
    expect(r.activated).toBe(true);

    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', fetchMock);
  });
});

describe('清单自校验 files_checksum（挡住清单被截断 / 少项）', () => {
  const base = 'http://192.168.1.9:8080';
  const entries = [entryOf('index/a.json', 'aaa'), entryOf('index/b.json', 'bbb')];

  it('算法与生成侧一致：对 files 的规范摘要取 sha1，带 sha1: 前缀', () => {
    const summary = entries.map((f) => `${f.path}\n${f.sha1}\n${f.size}`).join('\n');
    expect(computeFilesChecksum(entries)).toBe(`sha1:${sha1ref(summary)}`);
  });

  it('校验值正确 → 放行', async () => {
    routes.set(`${base}/manifest.json`, JSON.stringify({
      built_at: 'x', files: entries, files_checksum: computeFilesChecksum(entries),
    }));
    const m = await fetchUpdateManifest(base);
    expect(m.files).toHaveLength(2);
  });

  it('★ 清单被截断（少一项却带着完整摘要）→ 判为损坏并拒绝', async () => {
    routes.set(`${base}/manifest.json`, JSON.stringify({
      built_at: 'x',
      files: [entries[0]],                              // 少了一项
      files_checksum: computeFilesChecksum(entries),    // 却是完整清单的摘要
    }));
    await expect(fetchUpdateManifest(base)).rejects.toThrow(/自校验失败/);
  });

  it('★ 清单中某项的哈希被改 → 摘要不符 → 拒绝', async () => {
    const tampered = [{ ...entries[0], sha1: sha1ref('tampered') }];
    routes.set(`${base}/manifest.json`, JSON.stringify({
      built_at: 'x', files: tampered, files_checksum: computeFilesChecksum(entries),
    }));
    await expect(fetchUpdateManifest(base)).rejects.toThrow(/自校验失败/);
  });

  it('未提供 files_checksum（旧版生成）→ 不阻断，仅提示', async () => {
    routes.set(`${base}/manifest.json`, JSON.stringify({ built_at: 'x', files: entries }));
    const m = await fetchUpdateManifest(base);
    expect(m.files_checksum).toBeUndefined();

    const r = await applyContentUpdate(base, { built_at: 'x', files: entries, content_url: './' });
    expect(r.warnings.join()).toMatch(/files_checksum/);
  });
});

describe('verifyEntryText / byteLengthOf（单文件校验原语）', () => {
  const body = 'hello 中文';
  const entry = entryOf('index/a.json', body);

  it('byteLengthOf 按 UTF-8 字节计（中文 3 字节，不是字符数）', () => {
    expect(byteLengthOf('中文')).toBe(6);
    expect(byteLengthOf(body)).toBe(Buffer.byteLength(body, 'utf8'));
  });

  it('内容完好 → 通过（返回 null）', async () => {
    expect(await verifyEntryText(entry, body, { canSha256: true })).toBeNull();
    expect(await verifyEntryText(entry, body, { canSha256: false })).toBeNull();
  });

  it('缺 sha1 → 视为不可校验，按损坏拒绝（不留「跳过」后门）', async () => {
    const noSha1 = { ...entry, sha1: '' };
    expect(await verifyEntryText(noSha1, body, { canSha256: true })).toMatch(/缺少 sha1/);
  });

  it('canSha256=false 时仍做 SHA-1 校验（等长篡改，避开前面的 size 预检）', async () => {
    // 必须等长：否则会先被 size 预检拦下，测不到 SHA-1 这一层
    const sameSize = 'hello 中英';
    expect(byteLengthOf(sameSize)).toBe(byteLengthOf(body));
    expect(await verifyEntryText(entry, sameSize, { canSha256: false })).toMatch(/SHA-1/);
  });
});

describe('importLocalFiles（本机文件导入）', () => {
  it('只接受 entries|index|tracks|dict 前缀，其余跳过', async () => {
    const r = await importLocalFiles([
      fakeFile('manifest.json', 'pkg/content/index/manifest.json'),
      fakeFile('a.md', 'pkg/content/entries/a/entry.md'),
      fakeFile('junk.txt', 'pkg/content/whatever/junk.txt'),
    ]);

    expect(r.imported).toBe(2);
    expect(r.skipped).toBe(1);
    expect(r.paths).toEqual(['index/manifest.json', 'entries/a/entry.md']);
  });

  it('导入成功后激活缓存层', async () => {
    await importLocalFiles([fakeFile('m.json', 'pkg/content/index/m.json')]);
    expect(h.meta.get('pks:activated')).toBe(true);
    expect(h.cache.get('index/m.json')).toBeDefined();
  });

  it('全部不合规 → 不激活', async () => {
    const r = await importLocalFiles([fakeFile('x.txt', 'pkg/content/other/x.txt')]);
    expect(r.imported).toBe(0);
    expect(h.meta.get('pks:activated')).toBeUndefined();
  });
});

describe('更新源地址与缓存重置', () => {
  it('set/get 更新源地址走 localStorage 往返', () => {
    expect(getUpdateSourceUrl()).toBe('');
    setUpdateSourceUrl('  http://192.168.1.9:8080  ');
    expect(getUpdateSourceUrl()).toBe('http://192.168.1.9:8080');
    expect(localStorage.getItem(UPDATE_URL_KEY)).toBe('http://192.168.1.9:8080');
  });

  it('resetContentCache 清空缓存内容', async () => {
    h.cache.set('index/a.json', 'x');
    await resetContentCache();
    expect(h.cache.size).toBe(0);
  });
});
