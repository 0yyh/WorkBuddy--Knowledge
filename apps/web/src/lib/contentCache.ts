/**
 * 内容缓存层：原生 IndexedDB 封装（零新增依赖）。
 *
 * 为什么需要它：
 *   APK 内的 content 是**随包资源**（只读），要让手机在不重装应用的情况下拿到新内容，
 *   必须有一个可写的本机内容层。Capacitor Filesystem 插件当前不可用，因此用 Web 标准
 *   IndexedDB —— 双端零插件、零新增依赖。
 *
 * 失败安全（硬要求）：
 *   IndexedDB 在隐私模式 / 部分 WebView（`capacitor://` 非安全上下文）下可能不可用。
 *   本模块**所有方法都不抛错**：不可用时一律降级为「不缓存」，绝不阻断阅读。
 *
 * 存储内容：key = 相对路径（如 `index/manifest.json`），value = 文本。
 */

const DB_NAME = 'pks-content-cache';
const DB_VERSION = 1;
const STORE_FILES = 'files';
const STORE_META = 'meta';

/** 缓存是否已激活：只有成功应用过一次更新后才为 true（见 contentUpdater.ACTIVATED_KEY） */
export const ACTIVATED_KEY = 'activated';
export const BUILT_AT_KEY = 'built_at';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function idbFactory(): IDBFactory | null {
  try {
    if (typeof indexedDB === 'undefined' || indexedDB === null) return null;
    return indexedDB;
  } catch {
    return null;
  }
}

/**
 * 打开（并按需建库）。
 * 返回 null 表示 IndexedDB 不可用 —— 调用方按「无缓存」处理即可。
 */
export function openCache(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    const factory = idbFactory();
    if (!factory) {
      resolve(null);
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = factory.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    let settled = false;
    let lateHandle: IDBDatabase | null = null;

    const settle = (db: IDBDatabase | null): void => {
      if (settled) return;
      settled = true;
      resolve(db);
    };

    request.onupgradeneeded = (): void => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_FILES)) db.createObjectStore(STORE_FILES);
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
    };
    request.onsuccess = (): void => {
      if (settled) {
        // 超时后才成功：关闭句柄，避免泄漏一个无人使用的连接
        try {
          request.result.close();
        } catch {
          /* ignore */
        }
        return;
      }
      lateHandle = request.result;
      settle(lateHandle);
    };
    request.onerror = (): void => settle(null);
    request.onblocked = (): void => settle(null);

    // 极少数 WebView 上 open 会静默挂起；5s 兜底为「无缓存」而不是让 UI 卡死。
    setTimeout(() => settle(null), 5000);
  });

  return dbPromise;
}

/** 缓存层是否可用（供 UI 显示提示） */
export async function isCacheAvailable(): Promise<boolean> {
  return (await openCache()) !== null;
}

function requestDone(tx: IDBTransaction): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    tx.oncomplete = (): void => resolve(true);
    tx.onerror = (): void => resolve(false);
    tx.onabort = (): void => resolve(false);
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    request.onsuccess = (): void => resolve(request.result ?? null);
    request.onerror = (): void => resolve(null);
  });
}

/** 读取缓存文件文本；未命中 / 缓存不可用 → null */
export async function getCached(path: string): Promise<string | null> {
  const db = await openCache();
  if (!db) return null;
  try {
    const tx = db.transaction(STORE_FILES, 'readonly');
    const value = await requestValue<string>(tx.objectStore(STORE_FILES).get(path) as IDBRequest<string>);
    await requestDone(tx).catch(() => undefined);
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

/** 写入缓存文件；失败返回 false（不抛错） */
export async function putCached(path: string, text: string): Promise<boolean> {
  const db = await openCache();
  if (!db) return false;
  try {
    const tx = db.transaction(STORE_FILES, 'readwrite');
    tx.objectStore(STORE_FILES).put(text, path);
    return await requestDone(tx);
  } catch {
    return false;
  }
}

/** 删除单个缓存文件 */
export async function deleteCached(path: string): Promise<boolean> {
  const db = await openCache();
  if (!db) return false;
  try {
    const tx = db.transaction(STORE_FILES, 'readwrite');
    tx.objectStore(STORE_FILES).delete(path);
    return await requestDone(tx);
  } catch {
    return false;
  }
}

/** 列出全部已缓存的相对路径（用于更新后清理被删除的旧文件） */
export async function listCachedPaths(): Promise<string[]> {
  const db = await openCache();
  if (!db) return [];
  try {
    const tx = db.transaction(STORE_FILES, 'readonly');
    const keys = await requestValue<IDBValidKey[]>(
      tx.objectStore(STORE_FILES).getAllKeys() as IDBRequest<IDBValidKey[]>,
    );
    await requestDone(tx).catch(() => undefined);
    return (keys ?? []).filter((k): k is string => typeof k === 'string');
  } catch {
    return [];
  }
}

/** 清空全部缓存与元数据（回到「只读随包内容」状态） */
export async function clearCache(): Promise<boolean> {
  const db = await openCache();
  if (!db) return false;
  try {
    const tx = db.transaction([STORE_FILES, STORE_META], 'readwrite');
    tx.objectStore(STORE_FILES).clear();
    tx.objectStore(STORE_META).clear();
    return await requestDone(tx);
  } catch {
    return false;
  }
}

/** 读取元数据项 */
export async function getMeta<T>(key: string): Promise<T | null> {
  const db = await openCache();
  if (!db) return null;
  try {
    const tx = db.transaction(STORE_META, 'readonly');
    const value = await requestValue<T>(tx.objectStore(STORE_META).get(key) as IDBRequest<T>);
    await requestDone(tx).catch(() => undefined);
    return value ?? null;
  } catch {
    return null;
  }
}

/** 写入元数据项 */
export async function setMeta<T>(key: string, value: T): Promise<boolean> {
  const db = await openCache();
  if (!db) return false;
  try {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(value, key);
    return await requestDone(tx);
  } catch {
    return false;
  }
}
