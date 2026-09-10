/**
 * 极简 LRU 缓存（Map 保序）。用于分区懒加载（02 §18.3 LRU(8–12)）与 AST LRU(30) 的通用底座。
 * 同构，零依赖。
 */
export class LRUCache<K, V> {
  private map = new Map<K, V>();
  constructor(private capacity: number) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const v = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  /** 删除并返回是否命中（不改变其余元素的相对顺序） */
  delete(key: K): boolean {
    return this.map.delete(key);
  }

  /**
   * 按「最久未用 → 最近使用」顺序返回至多 count 个待驱逐的 key（**不删除**，交由调用方落盘/处理）。
   * 注意：仅返回候选，调用方需自行 `delete`；Map 迭代序即最近使用序（get/set 都会刷新）。
   */
  evictable(count: number): K[] {
    const n = Math.max(0, Math.min(Math.floor(count), this.map.size));
    return Array.from(this.map.keys()).slice(0, n);
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}
