/**
 * relativeTime 纯函数单测（Phase 0 · E）。
 * 仅依赖确定性输入，无 DOM / 网络依赖，可在 vitest 下稳定通过。
 */
import { describe, it, expect } from 'vitest';
import { formatRelative } from './relativeTime';

// 固定「现在」基准，避免依赖系统时钟导致的不稳定
const NOW = 1_700_000_000_000;

describe('formatRelative', () => {
  it('非有限时间戳返回破折号占位', () => {
    expect(formatRelative(Number.NaN, NOW)).toBe('—');
  });

  it('未来时间戳视为「刚刚」', () => {
    expect(formatRelative(NOW + 1_000, NOW)).toBe('刚刚');
  });

  it('小于 5 秒视为「刚刚」', () => {
    expect(formatRelative(NOW - 4_000, NOW)).toBe('刚刚');
  });

  it('分钟级格式正确（最少 1 分钟）', () => {
    expect(formatRelative(NOW - 60_000, NOW)).toBe('1 分钟前');
    expect(formatRelative(NOW - 3 * 60_000, NOW)).toBe('3 分钟前');
    expect(formatRelative(NOW - 10_000, NOW)).toBe('1 分钟前');
  });

  it('小时级格式正确', () => {
    expect(formatRelative(NOW - 3_600_000, NOW)).toBe('1 小时前');
    expect(formatRelative(NOW - 5 * 3_600_000, NOW)).toBe('5 小时前');
  });

  it('昨天显示为「昨天 HH:MM」', () => {
    const base = new Date(2024, 0, 10, 12, 0, 0).getTime();
    const yesterday = new Date(2024, 0, 9, 9, 30, 0).getTime();
    expect(formatRelative(yesterday, base)).toBe('昨天 09:30');
  });

  it('本年早些日期显示为「MM-DD」', () => {
    const base = new Date(2024, 5, 1, 12, 0, 0).getTime();
    const past = new Date(2024, 0, 15, 9, 5, 0).getTime();
    expect(formatRelative(past, base)).toBe('01-15');
  });

  it('跨年日期显示为「YYYY-MM-DD」', () => {
    const base = new Date(2024, 5, 1, 12, 0, 0).getTime();
    const past = new Date(2023, 0, 15, 9, 5, 0).getTime();
    expect(formatRelative(past, base)).toBe('2023-01-15');
  });
});
