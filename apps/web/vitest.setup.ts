/**
 * Web 单测的全局准备（P2-11）。
 *
 * 背景：本仓未安装 jsdom（详见 vitest.config.ts 注释），故 environment 为 'node'，
 * 测试进程里**没有** DOM 提供的 `localStorage`。而 `preferences` 等模块是浏览器代码，
 * 会直接读写 `localStorage`。这里补一个最小内存实现，让既有 web 测试能真正跑起来。
 *
 * 语义对齐 Web Storage 规范：只存字符串、`getItem` 缺失返回 `null`、
 * 提供 `clear` / `removeItem` / `key` / `length`。
 *
 * ⚠ 这是**测试期垫片**，不是产品代码：仅作用于测试进程，不参与构建。
 *   将来若受控安装了 jsdom，可删除本文件并移除 vitest.config.ts 的 setupFiles。
 */
class MemoryStorage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

const g = globalThis as { localStorage?: unknown; sessionStorage?: unknown };

if (typeof g.localStorage === 'undefined') {
  Object.defineProperty(g, 'localStorage', {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
}

if (typeof g.sessionStorage === 'undefined') {
  Object.defineProperty(g, 'sessionStorage', {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
}

/**
 * `preferences.ts` 的 `safeStorage()` 取的是 **`window.localStorage`**：
 *   if (typeof window === 'undefined' || !window.localStorage) return null;
 * node 环境没有 `window` → 直接返回 null → `readSysPrefs` 静默回退默认值，
 * 于是「写入后再读回」的用例永远读到默认值，真实读写行为被掩盖。
 * 这里把 `window` 指向 globalThis，使 `window.localStorage` 命中上面的垫片。
 */
const gw = globalThis as { window?: unknown };
if (typeof gw.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: globalThis,
    writable: true,
    configurable: true,
  });
}
