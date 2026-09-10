/**
 * 检索分区懒加载骨架（02 §18.3）。
 * 运行期按需加载检索分区 → LRU 卸载；命中后写入 IndexedDB 磁盘缓存避免重复 parse。
 * 浏览器才有 IndexedDB；Node/测试环境退化为纯内存 LRU。同构、零网络。
 */
import type { ShardIndex } from './inverted.js';
import { LRUCache } from '../util/lru.js';

export class PartitionLoader {
  private cache: LRUCache<number, ShardIndex>;
  private hasIDB: boolean;

  constructor(
    private shardLoader: (shard: number) => ShardIndex | null,
    private cacheName = 'pks-index-cache',
    capacity = 12,
  ) {
    this.cache = new LRUCache<number, ShardIndex>(capacity);
    this.hasIDB = typeof indexedDB !== 'undefined';
  }

  /** 加载分区（内存 → IndexedDB → 磁盘加载器），并回填缓存 */
  async load(shard: number): Promise<ShardIndex | null> {
    const mem = this.cache.get(shard);
    if (mem) return mem;
    if (this.hasIDB) {
      const fromDb = await this.readIDB(shard);
      if (fromDb) {
        this.cache.set(shard, fromDb);
        return fromDb;
      }
    }
    const sh = this.shardLoader(shard);
    if (sh) {
      this.cache.set(shard, sh);
      if (this.hasIDB) void this.writeIDB(shard, sh);
    }
    return sh;
  }

  /** 驱逐最久未用分区并返回被驱逐的 shard 号（字节在 Worker 持有，不进 RAM 对象） */
  evictOldest(): number[] {
    const keys = this.cache.evictable(1);
    // 真正移除：evictable 只给候选，必须显式 delete（get 只会把它提升为 MRU）
    for (const k of keys) this.cache.delete(k);
    return keys;
  }

  private async readIDB(shard: number): Promise<ShardIndex | null> {
    try {
      const db = await openDB(this.cacheName);
      return (await getStore(db, `shard:${shard}`)) as ShardIndex | null;
    } catch {
      return null;
    }
  }

  private async writeIDB(shard: number, data: ShardIndex): Promise<void> {
    try {
      const db = await openDB(this.cacheName);
      await putStore(db, `shard:${shard}`, data);
    } catch {
      /* 缓存失败不影响主流程 */
    }
  }
}

// ---- 极简 IndexedDB 封装（仅在浏览器被调用）----
function openDB(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('shards');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function getStore(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shards', 'readonly');
    const req = tx.objectStore('shards').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function putStore(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('shards', 'readwrite');
    tx.objectStore('shards').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
