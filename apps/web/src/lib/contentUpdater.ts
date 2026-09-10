/**
 * 内容更新（局域网 OTA）：manifest 清单 + IndexedDB 缓存层。
 *
 * 与 `lib/update.ts`（APK 自更新）**完全无关**，两者 manifest schema 不同：
 *   - APK 自更新：{ latestVersion, apkUrl }
 *   - 内容更新（本文件）：{ built_at, files[], content_url }
 *
 * 为什么不用 zip：
 *   项目当前没有 fflate/jszip/pako，且禁止新增依赖；`DecompressionStream` 只支持
 *   gzip/deflate、不支持 zip 容器。因此改为「清单 + 逐文件 fetch」，服务端就是
 *   `scripts/serve-lan.mjs` 托管的静态目录（带 CORS，支持 Range）。
 *   代价是 642 个请求；收益是零依赖、可断点重试、可增量（只下变化的文件）。
 *
 * 流程：
 *   1. GET {baseUrl}/manifest.json          → UpdateManifest
 *   2. 与本机已应用的 built_at 比较          → hasUpdate
 *   3. 并发（默认 6）fetch 每个文件 → sha256 校验 → 写入 IndexedDB
 *   4. 全部成功 → 记录 built_at + 激活缓存层；清空不在清单里的旧缓存
 *   5. UI 提示「重新加载」→ location.reload() 后 loader 走缓存优先，内容即生效
 */

import {
  ACTIVATED_KEY,
  BUILT_AT_KEY,
  clearCache,
  deleteCached,
  getMeta,
  listCachedPaths,
  putCached,
  setMeta,
} from './contentCache';
import { assetUrl, invalidateContentCacheFlag } from './loader';

/** 更新源地址的 localStorage 键 */
export const UPDATE_URL_KEY = 'pks_content_update_url';

/** 默认并发数：移动端 WebView 下 6 条并发是吞吐与内存占用的平衡点 */
export const FETCH_CONCURRENCY = 6;

export interface UpdateFileEntry {
  /** 相对 content 根的路径，如 `index/manifest.json` */
  path: string;
  sha256: string;
  size: number;
}

export interface UpdateManifest {
  built_at: string;
  files: UpdateFileEntry[];
  /** 内容根相对 manifest 的 URL，默认 './' */
  content_url?: string;
  note?: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  manifest: UpdateManifest | null;
  /** 失败原因 / 判定说明（UI 直接展示） */
  reason?: string;
}

export interface UpdateApplyResult {
  updated: number;
  failed: number;
  /** 非致命降级说明，如「当前环境不支持 SHA-256，已跳过校验」 */
  warnings: string[];
  /** 是否全部成功（只有全部成功才会激活缓存层） */
  activated: boolean;
}

/* ------------------------------- 更新源地址 ------------------------------- */

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getUpdateSourceUrl(): string {
  const store = safeStorage();
  if (!store) return '';
  try {
    return store.getItem(UPDATE_URL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setUpdateSourceUrl(url: string): void {
  const store = safeStorage();
  if (!store) return;
  try {
    store.setItem(UPDATE_URL_KEY, url.trim());
  } catch {
    /* 隐私模式写失败：仅本次会话生效，不阻断 */
  }
}

/* --------------------------------- 工具 --------------------------------- */

function joinUrl(baseUrl: string, relPath: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  return `${base}/${relPath.replace(/^\/+/, '')}`;
}

/** SHA-256 是否可用：crypto.subtle 仅在安全上下文（https / localhost）存在 */
export async function sha256Available(): Promise<boolean> {
  try {
    const c: Crypto | undefined = typeof crypto === 'undefined' ? undefined : crypto;
    return typeof c?.subtle?.digest === 'function';
  } catch {
    return false;
  }
}

/** 文本 → 小写 hex SHA-256；不可用时返回 null（调用方据此跳过校验） */
export async function sha256Hex(text: string): Promise<string | null> {
  try {
    const c: Crypto | undefined = typeof crypto === 'undefined' ? undefined : crypto;
    if (!c?.subtle?.digest) return null;
    const bytes = new TextEncoder().encode(text);
    const digest = await c.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

function isManifestShaped(raw: unknown): raw is UpdateManifest {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  if (typeof o.built_at !== 'string' || o.built_at.length === 0) return false;
  if (!Array.isArray(o.files) || o.files.length === 0) return false;
  return o.files.every((f: unknown) => {
    if (!f || typeof f !== 'object') return false;
    const e = f as Record<string, unknown>;
    return typeof e.path === 'string' && typeof e.sha256 === 'string' && typeof e.size === 'number';
  });
}

/** 把任意 manifest 形态规整为 UpdateManifest（缺 size 时补 0，不阻断） */
function normalizeManifest(raw: UpdateManifest): UpdateManifest {
  return {
    built_at: raw.built_at,
    content_url: typeof raw.content_url === 'string' ? raw.content_url : './',
    ...(typeof raw.note === 'string' ? { note: raw.note } : {}),
    files: raw.files.map((f) => ({
      path: f.path.replace(/\\/g, '/').replace(/^\/+/, ''),
      sha256: f.sha256.toLowerCase(),
      size: typeof f.size === 'number' ? f.size : 0,
    })),
  };
}

/* ------------------------------ 拉取与校验 ------------------------------ */

export async function fetchUpdateManifest(baseUrl: string): Promise<UpdateManifest> {
  const url = joinUrl(baseUrl, 'manifest.json');
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch (e) {
    throw new Error(`无法连接更新源（${e instanceof Error ? e.message : String(e)}）`);
  }
  if (!res.ok) throw new Error(`更新源返回 HTTP ${res.status}`);

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new Error('更新清单不是合法 JSON');
  }
  if (!isManifestShaped(raw)) {
    throw new Error('更新清单格式不符（需包含 built_at 与非空 files[].path/sha256/size）');
  }
  return normalizeManifest(raw);
}

/**
 * 本机当前内容版本。优先取缓存里记录的已应用 built_at；
 * 没有记录时回退读随包 manifest 的 built_at（并顺带落库，供下次比较）。
 */
export async function getCurrentContentBuiltAt(): Promise<string | null> {
  const stored = await getMeta<string>(BUILT_AT_KEY);
  if (stored) return stored;

  try {
    const res = await fetch(assetUrl('index/manifest.json'), { cache: 'no-cache' });
    if (res.ok) {
      const json: unknown = await res.json();
      if (json && typeof json === 'object') {
        const builtAt = (json as Record<string, unknown>).built_at;
        if (typeof builtAt === 'string' && builtAt.length > 0) {
          await setMeta(BUILT_AT_KEY, builtAt);
          return builtAt;
        }
      }
    }
  } catch {
    /* 读不到就当没有记录 */
  }
  return null;
}

export async function checkForContentUpdate(baseUrl: string): Promise<UpdateCheckResult> {
  const url = baseUrl.trim();
  if (!url) return { hasUpdate: false, manifest: null, reason: '请先填写更新源地址' };

  let manifest: UpdateManifest;
  try {
    manifest = await fetchUpdateManifest(url);
  } catch (e) {
    return {
      hasUpdate: false,
      manifest: null,
      reason: e instanceof Error ? e.message : String(e),
    };
  }

  const local = await getCurrentContentBuiltAt();
  if (!local) {
    return { hasUpdate: true, manifest, reason: '本机尚无内容版本记录' };
  }
  if (local !== manifest.built_at) {
    return { hasUpdate: true, manifest, reason: `本机 ${local.slice(0, 16)} → 远端 ${manifest.built_at.slice(0, 16)}` };
  }
  return { hasUpdate: false, manifest, reason: '已是最新' };
}

async function fetchOneFile(baseUrl: string, entry: UpdateFileEntry): Promise<string> {
  const url = joinUrl(baseUrl, entry.path);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

/**
 * 应用更新：并发下载 → 校验 → 写缓存 → 激活。
 *
 * @param onProgress 进度回调（done, total）
 */
export async function applyContentUpdate(
  baseUrl: string,
  manifest: UpdateManifest,
  onProgress?: (done: number, total: number) => void,
): Promise<UpdateApplyResult> {
  const warnings: string[] = [];
  const total = manifest.files.length;
  let done = 0;
  let updated = 0;
  let failed = 0;

  const canHash = await sha256Available();
  if (!canHash) {
    warnings.push('当前环境不支持 SHA-256（非安全上下文），已跳过完整性校验');
  }

  // 空清单直接拒绝：否则下面的「清理不在清单里的旧缓存」会把整份缓存清空 ——
  // 一个格式合法但 files=[] 的清单不应被当作「有效内容」激活。
  if (total === 0) {
    warnings.push('更新清单为空（files=[]），已忽略本次更新');
    return { updated: 0, failed: 0, warnings, activated: false };
  }

  const queue: UpdateFileEntry[] = [...manifest.files];
  const worker = async (): Promise<void> => {
    for (;;) {
      const entry = queue.shift();
      if (!entry) return;
      try {
        const text = await fetchOneFile(baseUrl, entry);
        if (canHash) {
          const actual = await sha256Hex(text);
          if (actual !== null && actual !== entry.sha256) {
            failed += 1;
            continue;
          }
        }
        const ok = await putCached(entry.path, text);
        if (ok) updated += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
      done += 1;
      onProgress?.(done, total);
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(FETCH_CONCURRENCY, total)) }, () => worker());
  await Promise.all(workers);

  if (failed > 0) {
    // 部分失败：不更新 built_at、不激活，保证不会出现「半新半旧」被当作最新
    return { updated, failed, warnings, activated: false };
  }

  // 清理清单里已不存在的文件，避免旧内容残留
  const keep = new Set(manifest.files.map((f) => f.path));
  const cached = await listCachedPaths();
  for (const path of cached) {
    if (!keep.has(path)) await deleteCached(path);
  }

  await setMeta(BUILT_AT_KEY, manifest.built_at);
  await setMeta(ACTIVATED_KEY, true);
  invalidateContentCacheFlag();

  return { updated, failed, warnings, activated: true };
}

/** 清掉本机内容缓存，回到随包内容（用于更新出问题时自救） */
export async function resetContentCache(): Promise<void> {
  await clearCache();
  invalidateContentCacheFlag();
}

/* --------------------------- 本机文件导入（辅路） --------------------------- */

const IMPORT_ACCEPT = /^(entries|index|tracks|dict)\//;

/** 从 File 推导缓存相对路径：优先 webkitRelativePath 中 `content/` 之后的部分 */
export function relPathOfFile(file: File): string {
  const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  const raw = rel && rel.length > 0 ? rel : file.name;
  const normalized = raw.replace(/\\/g, '/').replace(/^\/+/, '');
  const idx = normalized.lastIndexOf('content/');
  return idx >= 0 ? normalized.slice(idx + 'content/'.length) : normalized;
}

export interface LocalImportResult {
  imported: number;
  skipped: number;
  paths: string[];
}

/**
 * 导入本机选中的文件（索引 / 正文 / 序列 / 词典）。
 *
 * 说明：zip 容器无法在零依赖前提下解压，zip 包请走「局域网更新」通道；
 * 这里支持的是解压后的散文件（或多选文件）。
 */
export async function importLocalFiles(files: readonly File[]): Promise<LocalImportResult> {
  let imported = 0;
  let skipped = 0;
  const paths: string[] = [];

  for (const file of files) {
    const path = relPathOfFile(file);
    if (!IMPORT_ACCEPT.test(path)) {
      skipped += 1;
      continue;
    }
    try {
      const text = await file.text();
      const ok = await putCached(path, text);
      if (ok) {
        imported += 1;
        paths.push(path);
      } else {
        skipped += 1;
      }
    } catch {
      skipped += 1;
    }
  }

  if (imported > 0) {
    await setMeta(ACTIVATED_KEY, true);
    invalidateContentCacheFlag();
  }
  return { imported, skipped, paths };
}

/** 供 UI 展示：本机缓存是否已激活 */
export async function isContentCacheActive(): Promise<boolean> {
  return (await getMeta<boolean>(ACTIVATED_KEY)) === true;
}
