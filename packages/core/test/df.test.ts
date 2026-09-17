/**
 * df 分桶单测（① df 分片化 · T05 回归加固）。
 *
 * 该模块此前**零直接单测**，却是搜索正确性的地基：
 *  - BM25 的 df 必须跨全语料可比（分片间打分口径一致），聚合一错，跨分片排序就失真；
 *  - 桶号必须与 term 严格绑定且**可复现** —— 消费端（Worker/CLI）是「主线程算桶号 →
 *    只拉那几个桶」的懒加载协议，桶号或聚合一旦不确定，查询会静默漏载词项。
 *
 * 因此这里锁死三类不变量：
 *  1. 桶号：范围 [0, DF_BUCKET_COUNT)、同 term 恒同桶；
 *  2. 聚合：全局 df = Σ各分片 index[term].size；meta 的 totalDocs / avgLen 口径；
 *  3. 确定性：分片顺序变化不改变产出（`buildDfBuckets` 注释明确声明这是
 *     「全量/增量产出字节一致」的前提，增量复用依赖它）。
 */
import { describe, it, expect } from 'vitest';
import { dfBucketOf, buildDfBuckets } from '../src/index/df.js';
import { DF_BUCKET_COUNT } from '../src/constants.js';
import type { ShardIndex } from '../src/index/inverted.js';

/**
 * 造一个最小 ShardIndex。
 * `df` 形参是「term → 该分片含该词的文档数」，转成真实的 `Map<docId, tf>`（size 即文档数）。
 */
function shard(n: number, docCount: number, lengths: number[], df: Record<string, number>): ShardIndex {
  const index: Record<string, Map<number, number>> = {};
  for (const [term, count] of Object.entries(df)) {
    const m = new Map<number, number>();
    for (let i = 0; i < count; i++) m.set(i, i + 1);
    index[term] = m;
  }
  return {
    shard: n,
    docs: Array.from({ length: docCount }, (_, i) => ({ id: `d${i}` })) as never[],
    lengths,
    index,
  };
}

describe('dfBucketOf（term → 桶号）', () => {
  it('桶数契约：DF_BUCKET_COUNT 为 2 的幂（掩码实现的前提）', () => {
    expect(DF_BUCKET_COUNT).toBe(64);
    expect(Math.log2(DF_BUCKET_COUNT) % 1).toBe(0);
  });

  it('桶号始终落在 [0, DF_BUCKET_COUNT)', () => {
    const terms = ['a', 'the', '知识', 'BM25', 'x'.repeat(200), '', '哲学', 'term_42'];
    for (const t of terms) {
      const b = dfBucketOf(t);
      expect(Number.isInteger(b)).toBe(true);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(DF_BUCKET_COUNT);
    }
  });

  it('确定性：同一 term 多次调用恒得同一桶（跨进程可复现）', () => {
    for (const t of ['alpha', 'beta', '中文词', 'z']) {
      expect(dfBucketOf(t)).toBe(dfBucketOf(t));
    }
  });

  it('能区分不同 term：不会把所有词都堆进同一个桶', () => {
    const samples = Array.from({ length: 200 }, (_, i) => `term${i}`);
    const used = new Set(samples.map(dfBucketOf));
    // 200 个词散到 64 桶，用到的桶数应明显大于 1（弱断言，避免依赖具体哈希分布）
    expect(used.size).toBeGreaterThan(8);
    for (const b of used) expect(b).toBeLessThan(DF_BUCKET_COUNT);
  });
});

describe('buildDfBuckets（聚合 + 分桶）', () => {
  it('空输入 → 空桶列表且 meta 归零', () => {
    const { meta, buckets } = buildDfBuckets([]);
    expect(buckets).toEqual([]);
    expect(meta).toEqual({ totalDocs: 0, avgLen: 0 });
  });

  it('无任何 term 的分片 → 不产出空桶', () => {
    const { meta, buckets } = buildDfBuckets([shard(0, 3, [1, 1, 1], {})]);
    expect(buckets).toEqual([]); // 空桶被过滤掉
    expect(meta.totalDocs).toBe(3);
  });

  it('全局 df = 各分片 df 之和（跨分片可比的关键）', () => {
    // 分片 0 有 2 个文档含 "alpha"，分片 1 有 3 个 → 全局应为 5
    const shards = [
      shard(0, 10, [1, 1], { alpha: 2, beta: 1 }),
      shard(1, 20, [1, 1, 1], { alpha: 3 }),
    ];
    const { buckets } = buildDfBuckets(shards);
    const flat = Object.assign({}, ...buckets.map((b) => b.df));
    expect(flat['alpha']).toBe(5);
    expect(flat['beta']).toBe(1);
  });

  it('每个 term 落在 dfBucketOf 指定的桶里', () => {
    const shards = [shard(0, 5, [1], { alpha: 1, gamma: 1, delta: 1 })];
    const { buckets } = buildDfBuckets(shards);
    for (const term of ['alpha', 'gamma', 'delta']) {
      const owner = buckets.find((b) => term in b.df);
      expect(owner, `term ${term} 应出现在某个桶中`).toBeDefined();
      expect(owner!.n).toBe(dfBucketOf(term));
    }
  });

  it('桶号唯一且无重复桶（每桶只出现一次）', () => {
    const shards = [shard(0, 5, [1], { a: 1, b: 1, c: 1, d: 1, e: 1 })];
    const { buckets } = buildDfBuckets(shards);
    const ns = buckets.map((b) => b.n);
    expect(new Set(ns).size).toBe(ns.length);
  });

  it('meta.totalDocs = Σ docs.length，avgLen = 总 token / 总文档（保留 2 位）', () => {
    // 文档数 2 + 3 = 5；token 总数 (2+4) + (6+8+10) = 6+24 = 30 → avg = 6
    const shards = [shard(0, 2, [2, 4], {}), shard(1, 3, [6, 8, 10], {})];
    const { meta } = buildDfBuckets(shards);
    expect(meta.totalDocs).toBe(5);
    expect(meta.avgLen).toBe(6);
  });

  it('avgLen 四舍五入到 2 位小数（避免浮点尾巴进 manifest）', () => {
    // 总 token 1，文档 3 → 0.3333… → 0.33
    const shards = [shard(0, 3, [1, 0, 0], {})];
    const { meta } = buildDfBuckets(shards);
    expect(meta.avgLen).toBe(0.33);
  });

  it('★ 确定性：分片顺序颠倒不改变产出（增量复用的前提）', () => {
    const a = shard(0, 4, [1, 2], { alpha: 2, beta: 1, zeta: 3 });
    const b = shard(1, 6, [3, 4], { alpha: 1, gamma: 2 });
    const forward = buildDfBuckets([a, b]);
    const reversed = buildDfBuckets([b, a]);

    expect(reversed.meta).toEqual(forward.meta);
    // 桶内 term 已全局排序，因此序列化结果应逐字节一致
    expect(JSON.stringify(reversed.buckets)).toBe(JSON.stringify(forward.buckets));
  });

  it('★ 确定性：分片内 term 声明顺序不同，产出仍一致', () => {
    const x = shard(0, 3, [1], { alpha: 1, beta: 2, gamma: 3 });
    const y = shard(0, 3, [1], { gamma: 3, alpha: 1, beta: 2 });
    expect(JSON.stringify(buildDfBuckets([y]))).toBe(JSON.stringify(buildDfBuckets([x])));
  });

  it('桶内 term 按字典序排列（字节一致性的直接保证）', () => {
    const { buckets } = buildDfBuckets([shard(0, 3, [1], { zeta: 1, alpha: 1, mu: 1 })]);
    for (const b of buckets) {
      const keys = Object.keys(b.df);
      expect(keys).toEqual([...keys].sort());
    }
  });

  it('同 term 跨分片累加不受分片数影响（M 跳变安全）', () => {
    // 同一批文档，分 1 片 vs 分 3 片：全局 df 应相同（df 与 M 解耦）
    const one = buildDfBuckets([shard(0, 3, [1, 1, 1], { alpha: 3 })]);
    const three = buildDfBuckets([
      shard(0, 1, [1], { alpha: 1 }),
      shard(1, 1, [1], { alpha: 1 }),
      shard(2, 1, [1], { alpha: 1 }),
    ]);
    const flat = (r: ReturnType<typeof buildDfBuckets>): Record<string, number> =>
      Object.assign({}, ...r.buckets.map((b) => b.df));
    expect(flat(three)['alpha']).toBe(flat(one)['alpha']);
    expect(three.meta).toEqual(one.meta);
  });
});
