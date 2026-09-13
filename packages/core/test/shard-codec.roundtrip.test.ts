/**
 * shard-codec 往返回归（P2-11）。
 *
 * 与既有 `shard-codec.test.ts` 的分工：
 *   既有文件覆盖「基本往返 + 多字节 varint + base64 文本载体」；
 *   本文件补齐它**没覆盖**的三块：
 *     ① `inlineIndexToMap`（旧内联倒排 → Map，旧产物兼容路径，此前零覆盖）
 *     ② 中文/CJK term 的 utf8 多字节往返（本语料主体是中文，字节长度 ≠ 字符长度）
 *     ③ 版本号校验与损坏输入的失败路径
 */
import { describe, it, expect } from 'vitest';
import { zlibSync } from 'fflate';
import {
  encodePostings,
  decodePostings,
  inlineIndexToMap,
} from '../src/index/shard-codec.js';
import type { PostingsTable } from '../src/index/shard-codec.js';

/** 手工构造一段「非当前版本」的 base64 载荷，用于校验版本拒绝逻辑。 */
function craftPayloadWithVersion(version: number): string {
  const raw = new Uint8Array([version & 0xff, 0]); // [version][termCount=0]
  return Buffer.from(zlibSync(raw)).toString('base64');
}

describe('inlineIndexToMap（旧内联倒排 → Map，旧产物兼容）', () => {
  it('单 term 多 posting 转为 Map，键值与顺序均正确', () => {
    const out = inlineIndexToMap({ alpha: [[0, 1], [2, 5], [7, 3]] });

    expect(out.alpha).toBeInstanceOf(Map);
    expect(out.alpha.size).toBe(3);
    expect(out.alpha.get(0)).toBe(1);
    expect(out.alpha.get(2)).toBe(5);
    expect(out.alpha.get(7)).toBe(3);
    // 迭代顺序 = 插入顺序（后续 BM25 遍历依赖 docId 升序）
    expect([...out.alpha.keys()]).toEqual([0, 2, 7]);
  });

  it('多 term 全部转为独立的 Map 实例（互不共享引用）', () => {
    const out = inlineIndexToMap({
      alpha: [[0, 1]],
      beta: [[0, 2]],
    });

    expect(Object.keys(out).sort()).toEqual(['alpha', 'beta']);
    expect(out.alpha).toBeInstanceOf(Map);
    expect(out.beta).toBeInstanceOf(Map);
    expect(out.alpha).not.toBe(out.beta);
    expect(out.alpha.get(0)).toBe(1);
    expect(out.beta.get(0)).toBe(2);
  });

  it('空输入返回空对象；空 posting 列表保留为空 Map', () => {
    expect(inlineIndexToMap({})).toEqual({});
    const out = inlineIndexToMap({ alpha: [] });
    expect(out.alpha).toBeInstanceOf(Map);
    expect(out.alpha.size).toBe(0);
  });

  it('转 Map 后再编码解码，与直接构造的 Map 等价（两条路径收敛）', () => {
    const inline = { alpha: [[0, 2], [5, 1]], beta: [[3, 4]] };
    const viaInline = decodePostings(encodePostings(inlineIndexToMap(inline)));
    const direct: PostingsTable = {
      alpha: new Map([[0, 2], [5, 1]]),
      beta: new Map([[3, 4]]),
    };

    expect(viaInline).toEqual(direct);
    expect(viaInline.alpha).toBeInstanceOf(Map);
  });
});

describe('中文 / CJK term 往返（utf8 字节长度 ≠ 字符长度）', () => {
  it('纯中文 term 往返一致', () => {
    const x: PostingsTable = {
      柏拉图: new Map([[0, 3], [4, 1]]),
      理念论: new Map([[2, 2]]),
    };
    const decoded = decodePostings(encodePostings(x));

    expect(decoded).toEqual(x);
    expect(Object.keys(decoded)).toEqual(['柏拉图', '理念论']);
  });

  it('中英混排 + 单字 term 往返一致（单字不产生 bigram，term 可为单字）', () => {
    const x: PostingsTable = {
      道: new Map([[0, 1]]),
      '剩余价值': new Map([[1, 2], [3, 1]]),
      kapital: new Map([[1, 1]]),
      ' Hegel ': new Map([[2, 5]]),
    };
    const decoded = decodePostings(encodePostings(x));

    expect(decoded).toEqual(x);
    expect(Object.keys(decoded)).toEqual(['道', '剩余价值', 'kapital', ' Hegel ']);
  });

  it('term 的 utf8 字节数确实大于字符数（证明长度前缀按字节写）', () => {
    const term = '剩余价值';
    expect(Buffer.byteLength(term, 'utf8')).toBeGreaterThan(term.length);
    expect(Buffer.byteLength(term, 'utf8')).toBe(term.length * 3);

    const decoded = decodePostings(encodePostings({ [term]: new Map([[1, 1]]) }));
    expect(decoded[term]).toEqual(new Map([[1, 1]]));
  });

  it('emoji / 4 字节字符 term 往返一致', () => {
    const x: PostingsTable = { '📚知识': new Map([[9, 2]]) };
    expect(decodePostings(encodePostings(x))).toEqual(x);
  });
});

describe('失败路径与健壮性', () => {
  it('遇到不支持的版本号时抛出明确错误', () => {
    expect(() => decodePostings(craftPayloadWithVersion(2))).toThrow(
      /不支持的 postings 编码版本：2/,
    );
    expect(() => decodePostings(craftPayloadWithVersion(0))).toThrow(
      /不支持的 postings 编码版本：0/,
    );
  });

  it('当前版本（1）可正常解码手工载荷：空 term 表', () => {
    expect(decodePostings(craftPayloadWithVersion(1))).toEqual({});
  });

  it('大规模表往返一致（500 term × 平均 20 posting）', () => {
    const big: PostingsTable = {};
    for (let t = 0; t < 500; t++) {
      const m = new Map<number, number>();
      for (let d = 0; d < 20; d++) m.set(d * 7 + t, (t + d) % 9 + 1);
      big[`term${t}词条`] = m;
    }

    const decoded = decodePostings(encodePostings(big));
    expect(Object.keys(decoded).length).toBe(500);
    expect(decoded).toEqual(big);
  });

  it('docId 非从 0 开始、且间隔很大时差分仍正确还原', () => {
    const x: PostingsTable = { sparse: new Map([[1000, 1], [70000, 2], [2000000, 3]]) };
    const decoded = decodePostings(encodePostings(x));

    expect(decoded).toEqual(x);
    expect([...decoded.sparse.keys()]).toEqual([1000, 70000, 2000000]);
  });
});
