/**
 * APK 资源解包断言（Q-1）。
 *
 * 架构评审 Q-1 明确指出缺失「APK 冒烟（解包断言 assets/public/content 存在）」的自动化。
 * 本集成测试充当出包回归护栏：断言 Capacitor 资产目录内确实交付了内容索引清单
 * `android/app/src/main/assets/public/content/index/manifest.json`，且其结构合法
 * （schema=1、search.shards>0）。
 *
 * 若 Android 资源未同步（漏跑 web build + cp 到 assets/public）或 manifest 损坏，
 * 本测试会直接失败，提醒出包前先补齐资产——而非把"半包"APK 放出去。
 *
 * 走 node:fs 直接读 Android 资产（不依赖 apkanalyzer，vitest node 环境即可跑）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const MANIFEST = fileURLToPath(
  new URL('../../android/app/src/main/assets/public/content/index/manifest.json', import.meta.url),
);

describe('APK 资源解包断言（Q-1）', () => {
  it('android 资产内含 content/index/manifest.json 且结构合法（出包回归护栏）', () => {
    expect(existsSync(MANIFEST)).toBe(true);

    const json = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    expect(json.schema).toBe(1);
    expect(typeof json.search?.shards).toBe('number');
    expect(json.search.shards).toBeGreaterThan(0);
  });
});
