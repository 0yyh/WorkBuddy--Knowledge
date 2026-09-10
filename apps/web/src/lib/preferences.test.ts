/**
 * preferences 纯函数单测（Phase 0 · E）。
 * 覆盖无 DOM 依赖的确定性计算：亮度遮罩 / 提亮系数 / 背景 class。
 */
import { describe, it, expect } from 'vitest';
import { brightnessVeil, brightnessFilter, bgClassOf } from './preferences';

describe('brightnessVeil', () => {
  it('≥70 时不压暗（返回 0）', () => {
    expect(brightnessVeil(70)).toBe(0);
    expect(brightnessVeil(100)).toBe(0);
  });

  it('随等级下降线性压暗，0 时达上限 0.6', () => {
    expect(brightnessVeil(0)).toBeCloseTo(0.6, 5);
    expect(brightnessVeil(35)).toBeCloseTo(0.3, 5);
  });
});

describe('brightnessFilter', () => {
  it('70 时约为自然亮度 1.036', () => {
    expect(brightnessFilter(70)).toBe('1.036');
  });

  it('>70 提亮（>1），<70 压暗（<1）', () => {
    expect(Number(brightnessFilter(100))).toBeGreaterThan(1);
    expect(Number(brightnessFilter(0))).toBeLessThan(1);
  });
});

describe('bgClassOf', () => {
  it('7 个主题全部显式返回 reading-bg-<bg>（含 white，消除「无类=白」隐式语义）', () => {
    expect(bgClassOf('white')).toBe('reading-bg-white');
    expect(bgClassOf('sepia')).toBe('reading-bg-sepia');
    expect(bgClassOf('green')).toBe('reading-bg-green');
    expect(bgClassOf('blue')).toBe('reading-bg-blue');
    expect(bgClassOf('black')).toBe('reading-bg-black');
    expect(bgClassOf('gray')).toBe('reading-bg-gray');
    expect(bgClassOf('dark')).toBe('reading-bg-dark');
  });
});
