/**
 * preferences 系统偏好解析单测（Phase 0 · E）。
 * 验证 readSysPrefs 的「缺省回退 / 合法读取 / 非法值回退」三态。
 * 依赖 jsdom 提供的 localStorage（需 vitest environment: 'jsdom'）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readSysPrefs, SYS_DEFAULTS } from './preferences';

describe('readSysPrefs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('存储为空时返回完整默认偏好', () => {
    expect(readSysPrefs()).toEqual(SYS_DEFAULTS);
  });

  it('读取到合法值时覆盖对应字段', () => {
    localStorage.setItem('pks_pref_sys_bg', 'dark');
    expect(readSysPrefs().bg).toBe('dark');
  });

  it('读取到非法值时回退默认（不打断其它字段）', () => {
    localStorage.setItem('pks_pref_sys_bg', 'rainbow');
    expect(readSysPrefs().bg).toBe(SYS_DEFAULTS.bg);
  });
});
