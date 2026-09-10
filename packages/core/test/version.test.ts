import { describe, it, expect } from 'vitest';
import { compareVersions, isNewerVersion } from '../src/util/version.js';

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0);
  });

  it('detects greater / lesser on the differing segment', () => {
    expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
  });

  it('ignores an optional v / V prefix', () => {
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('V1.2.3', 'v1.2.3')).toBe(0);
    expect(compareVersions('v2.0.0', '1.9.9')).toBe(1);
  });

  it('pads missing segments with zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.0', '1.2')).toBe(0);
    expect(compareVersions('1.2.1', '1.2')).toBe(1);
    expect(compareVersions('1', '1.0.0.0')).toBe(0);
  });

  it('treats non-numeric segments as 0 instead of throwing', () => {
    expect(compareVersions('1.x.0', '1.0.0')).toBe(0);
    expect(compareVersions('abc', '0.0.0')).toBe(0);
    expect(compareVersions('1.0.0-beta', '1.0.0')).toBe(0);
  });

  it('handles multi-digit segments numerically, not lexicographically', () => {
    // 词法比较会得出 '10' < '9'，必须按数值比较
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
  });
});

describe('isNewerVersion', () => {
  it('is true only when the first version is strictly greater', () => {
    expect(isNewerVersion('1.2.4', '1.2.3')).toBe(true);
    expect(isNewerVersion('1.2.3', '1.2.4')).toBe(false);
    expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false);
  });
});
