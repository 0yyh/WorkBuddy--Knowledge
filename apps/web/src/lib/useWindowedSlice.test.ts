/**
 * 列表虚拟化窗口计算单测 · T05 回归加固。
 *
 * 该模块此前**零测试**，而它是把「上万条 DOM」降到「几十条」的唯一手段：
 * Browse / Search 两个页面都靠它，算错就是白屏或卡死。
 *
 * 测试策略：本项目**未引入 jsdom / @testing-library**（依赖约束），无法渲染真实
 * DOM 来驱动 hook。因此把窗口算术从 useEffect 里抽成导出的纯函数 `computeWindow`
 * 直接测 —— 等价覆盖面更高，且不依赖环境。hook 自身只负责「量 DOM + 订阅滚动」。
 */
import { describe, it, expect } from 'vitest';
import { computeWindow, type WindowGeometry } from './useWindowedSlice';

/** 常用几何：1000 条、行高 64、视口 800 */
const geo = (over: Partial<WindowGeometry> = {}): WindowGeometry => ({
  offsetTop: 0,
  listHeight: 64000,
  viewportHeight: 800,
  stride: 64,
  overscan: 8,
  total: 1000,
  ...over,
});

describe('computeWindow（可见区间）', () => {
  it('列表顶部与视口对齐：从头渲染，末位含 overscan 余量', () => {
    // start = floor(0/64) - 8 → 负 → 收敛到 0；end = ceil(800/64) + 8 = 13 + 8 = 21
    expect(computeWindow(geo())).toEqual({ start: 0, end: 21 });
  });

  it('滚动到中部：窗口随滚动位移平移', () => {
    // offsetTop = 3200 → 第 50 行对齐视口顶
    // start = 50 - 8 = 42；end = ceil(4000/64) + 8 = 63 + 8 = 71
    expect(computeWindow(geo({ offsetTop: 3200 }))).toEqual({ start: 42, end: 71 });
  });

  it('列表底部：end 被 clamp 到 total，不越界', () => {
    const g = geo({ total: 100, listHeight: 6400, offsetTop: 6000 });
    // start = floor(6000/64) - 8 = 93 - 8 = 85；end = ceil(6400/64) + 8 = 108 → clamp 100
    expect(computeWindow(g)).toEqual({ start: 85, end: 100 });
  });

  it('overscan = 0 时严格贴合可见区', () => {
    expect(computeWindow(geo({ overscan: 0 }))).toEqual({ start: 0, end: 13 });
  });

  it('gap 通过 stride 生效：步距变大则同视口内行数变少', () => {
    const noGap = computeWindow(geo({ stride: 64, overscan: 0 }));
    const withGap = computeWindow(geo({ stride: 80, overscan: 0 })); // 64 + 16 gap
    expect(withGap.end).toBeLessThan(noGap.end);
  });
});

describe('★ computeWindow（曾经失效的边界：列表尚未进入视口）', () => {
  it('列表整体在视口下方 → 渲染空窗，而不是「几乎全量」', () => {
    // 列表顶部在视口下方 3000px：offsetTop = -3000
    // visibleBottom = min(listHeight, -3000 + 800) = -2200 → end 原会算出负数
    const r = computeWindow(geo({ offsetTop: -3000 }));
    expect(r).toEqual({ start: 0, end: 0 });
  });

  it('★ 回归护栏：若 end 落成负数，slice 会按「倒数」语义渲染几乎全部条目', () => {
    const items = Array.from({ length: 1000 }, (_, i) => i);
    const r = computeWindow(geo({ offsetTop: -3000 }));
    // 这正是修复前的错误行为（end = -26 → slice(0, -26) 取到前 974 条），
    // 显式断言它不会发生 —— 虚拟化静默失效是没有任何报错的性能塌陷。
    expect(items.slice(0, -26)).toHaveLength(974);
    expect(items.slice(r.start, r.end)).toHaveLength(0);
  });

  it('列表恰好开始进入视口（offsetTop 略小于 0）时不出负值', () => {
    const r = computeWindow(geo({ offsetTop: -100 }));
    expect(r.start).toBeGreaterThanOrEqual(0);
    expect(r.end).toBeGreaterThanOrEqual(r.start);
  });
});

describe('computeWindow（退化输入不崩）', () => {
  it('stride = 0（rowHeight 与 gap 都为 0）→ 退化为全量渲染，而非空白', () => {
    // 不保护时：floor(x/0) = Infinity → start = Infinity > end → 列表整片空白
    expect(computeWindow(geo({ stride: 0 }))).toEqual({ start: 0, end: 1000 });
  });

  it('stride 为负（异常配置）→ 同样退化为全量', () => {
    expect(computeWindow(geo({ stride: -64 }))).toEqual({ start: 0, end: 1000 });
  });

  it('空列表 → {0, 0}', () => {
    expect(computeWindow(geo({ total: 0, listHeight: 0 }))).toEqual({ start: 0, end: 0 });
  });

  it('viewportHeight = 0 → 不出负值、不越界', () => {
    const r = computeWindow(geo({ viewportHeight: 0, overscan: 0 }));
    expect(r.start).toBeGreaterThanOrEqual(0);
    expect(r.end).toBeGreaterThanOrEqual(r.start);
    expect(r.end).toBeLessThanOrEqual(1000);
  });
});

describe('computeWindow（不变量：任意输入下切片恒合法）', () => {
  const cases: WindowGeometry[] = [
    geo(),
    geo({ offsetTop: -1e6 }),
    geo({ offsetTop: 1e6 }),
    geo({ offsetTop: 3200 }),
    geo({ overscan: 0 }),
    geo({ overscan: 100 }),
    geo({ stride: 1 }),
    geo({ total: 1 }),
    geo({ total: 0 }),
    geo({ listHeight: 0 }),
    geo({ viewportHeight: 0 }),
    geo({ viewportHeight: 1e5 }),
  ];

  it('恒满足 0 <= start <= end <= total（保证 slice 语义与滚动高度计算成立）', () => {
    for (const g of cases) {
      const { start, end } = computeWindow(g);
      expect(Number.isFinite(start), `start 应为有限数：${JSON.stringify(g)}`).toBe(true);
      expect(Number.isFinite(end), `end 应为有限数：${JSON.stringify(g)}`).toBe(true);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThanOrEqual(start);
      expect(end).toBeLessThanOrEqual(g.total);
    }
  });

  it('渲染条数远小于总数（虚拟化的意义所在）', () => {
    const { start, end } = computeWindow(geo());
    expect(end - start).toBeLessThan(50);
    expect(geo().total - (end - start)).toBeGreaterThan(950);
  });
});
