/**
 * 阅读历史（"看过"页）：localStorage 持久化，最新在前，截断保留最近 200 条。
 */
export interface HistoryItem {
  slug: string;
  title: string;
  timestamp: number;
  /** 阅读进度 0-100（章节级估算），无记录时缺省 */
  progress?: number;
}

const STORAGE_KEY = 'pks_readingHistory';
const MAX_ITEMS = 200;

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 读取历史（新 → 旧）；坏数据一律回退空列表 */
export function getHistory(): HistoryItem[] {
  const store = safeStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is HistoryItem =>
          typeof x === 'object' &&
          x !== null &&
          typeof (x as HistoryItem).slug === 'string' &&
          typeof (x as HistoryItem).title === 'string' &&
          typeof (x as HistoryItem).timestamp === 'number',
      )
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

/** 记录一次阅读：同 slug 去重后置于队首，截断到 200 条 */
export function addToHistory(slug: string, title: string, progress?: number): HistoryItem[] {
  const rest = getHistory().filter((it) => it.slug !== slug);
  const item: HistoryItem = { slug, title, timestamp: Date.now() };
  if (typeof progress === 'number' && Number.isFinite(progress)) {
    item.progress = Math.max(0, Math.min(100, Math.round(progress)));
  }
  const next = [item, ...rest].slice(0, MAX_ITEMS);
  const store = safeStorage();
  if (store) {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* 写失败不影响阅读 */
    }
  }
  return next;
}

/**
 * 删除单条阅读历史（P3-2）。
 * 按 slug + timestamp 精确匹配（同一 slug 可有多条不同时间的记录），返回删除后的列表。
 */
export function removeFromHistory(slug: string, timestamp: number): HistoryItem[] {
  const next = getHistory().filter((it) => !(it.slug === slug && it.timestamp === timestamp));
  const store = safeStorage();
  if (store) {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* 写失败不影响阅读 */
    }
  }
  return next;
}

/** 清空阅读历史（设置页调用） */
export function clearHistory(): void {
  const store = safeStorage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------- 续读位置 ------------------------------- */

/** 续读位置：正文文档序号（0 = 导读，1..n = 第 n 章，与阅读页 docs 下标一致） */
export interface LastRead {
  slug: string;
  chapterIndex: number;
  updatedAt: number;
  /** 预留：章内滚动比例（当前不强求精确恢复，可空） */
  scrollRatio?: number;
}

const LAST_READ_KEY = 'pks_lastRead';
const LEGACY_LAST_READ_KEY = 'pks_lastReadSlug';

function isLastRead(value: unknown): value is LastRead {
  if (typeof value !== 'object' || value === null) return false;
  const rec = value as LastRead;
  return (
    typeof rec.slug === 'string' &&
    typeof rec.chapterIndex === 'number' &&
    Number.isFinite(rec.chapterIndex) &&
    rec.chapterIndex >= 0
  );
}

/** 读取上次阅读位置（App 冷启动续读 / 阅读页恢复章节用） */
export function getLastRead(): LastRead | null {
  const store = safeStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(LAST_READ_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isLastRead(parsed)) return parsed;
    }
  } catch {
    /* 数据损坏按缺失处理 */
  }
  // V1 兼容：旧实现仅在 pks_lastReadSlug 存 slug 字符串
  try {
    const legacy = store.getItem(LEGACY_LAST_READ_KEY);
    if (legacy && legacy.length > 0) {
      return { slug: legacy, chapterIndex: 0, updatedAt: Date.now() };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** 读取上次阅读 slug（App 冷启动决定续读目标用） */
export function getLastReadSlug(): string | null {
  return getLastRead()?.slug ?? null;
}

/** 记录续读位置（阅读页章节切换 / 正文装载成功后调用） */
export function setLastRead(slug: string, chapterIndex: number): void {
  const store = safeStorage();
  if (!store) return;
  try {
    const prev = getLastRead();
    const rec: LastRead = {
      slug,
      chapterIndex: Math.max(0, Math.floor(chapterIndex)),
      updatedAt: Date.now(),
    };
    if (prev?.slug === slug && prev.scrollRatio !== undefined) rec.scrollRatio = prev.scrollRatio;
    store.setItem(LAST_READ_KEY, JSON.stringify(rec));
  } catch {
    /* 写失败不影响阅读 */
  }
}

/** 兼容旧调用：仅记录 slug（视作回到导读） */
export function setLastReadSlug(slug: string): void {
  setLastRead(slug, 0);
}

/** 清除续读位置（设置页调用） */
export function clearLastReadSlug(): void {
  const store = safeStorage();
  if (!store) return;
  try {
    store.removeItem(LAST_READ_KEY);
    store.removeItem(LEGACY_LAST_READ_KEY);
  } catch {
    /* ignore */
  }
}
