/**
 * compress（JSON ↔ base64(zlib) 文本载体）单测 · T05 回归加固。
 *
 * 该模块此前只被 builder 测试**间接**覆盖，自身无直接单测，却被 df 桶 / 分片产物依赖。
 * 最关键的契约是**载体形式**：产物必须是**纯单行 base64 文本**。
 * 原因（见模块头注释）：它要零改动穿过 contentCache / OTA / merge 整条「文本」管线
 * （`res.text()` / IndexedDB 字符串 / JSON 内嵌）—— 裸二进制或含换行的输出都会被破坏。
 * 因此这里把「可穿文本管线」当成一等断言，而不只测往返。
 */
import { describe, it, expect } from 'vitest';
import { zlibSync, strToU8 } from 'fflate';
import { compressJson, decompressJson } from '../src/util/compress.js';

/** 合法 base64：不含换行/空格，仅 A–Z a–z 0–9 + / 与末尾至多两个 '=' */
const PURE_B64 = /^[A-Za-z0-9+/]+={0,2}$/;

describe('compressJson / decompressJson（往返）', () => {
  it('基本类型往返', () => {
    for (const v of [1, 0, -1, 3.14, true, false, null, 'text', '', [] as unknown[], {}]) {
      expect(decompressJson(compressJson(v))).toEqual(v);
    }
  });

  it('中文 / emoji / 特殊字符往返（UTF-8 编码正确）', () => {
    const cases = [
      '哲学：形而上学与认识论',
      'emoji 😀🎉 与代理对',
      '换行\n制表\t引号"\'反斜杠\\',
      '{"看起来":"像 JSON 的字符串"}',
    ];
    for (const s of cases) {
      expect(decompressJson<string>(compressJson(s))).toBe(s);
    }
  });

  it('嵌套结构往返（df 桶的真实形状）', () => {
    const bucket = { n: 42, df: { alpha: 3, beta: 17, '中文词': 1 } };
    expect(decompressJson(compressJson(bucket))).toEqual(bucket);
  });

  it('大对象往返（1000 键，贴近真实 df 桶体量）', () => {
    const big: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) big[`term_${i}`] = i;
    const back = decompressJson<Record<string, number>>(compressJson(big));
    expect(Object.keys(back)).toHaveLength(1000);
    expect(back['term_999']).toBe(999);
  });
});

describe('★ 文本载体契约（能否零改动穿过 contentCache / OTA 文本管线）', () => {
  it('输出是单行纯 base64：无换行、无空白、字符集受限', () => {
    const out = compressJson({ n: 0, df: { alpha: 1, beta: 2 } });
    expect(out).not.toMatch(/[\r\n\t ]/);
    expect(out).toMatch(PURE_B64);
  });

  it('大对象输出同样保持单行（base64 实现不得插入换行）', () => {
    const big: Record<string, number> = {};
    for (let i = 0; i < 500; i++) big[`k${i}`] = i * 7;
    const out = compressJson(big);
    expect(out).not.toMatch(/[\r\n]/);
    expect(out).toMatch(PURE_B64);
  });

  it('输出可直接放进 JSON 字符串并被 JSON.parse 还原（JSON 内嵌安全）', () => {
    const payload = { n: 1, df: { '中文': 2 } };
    const carrier = JSON.stringify({ body: compressJson(payload) }); // 不转义也不会破坏 JSON
    const parsed = JSON.parse(carrier) as { body: string };
    expect(decompressJson(parsed.body)).toEqual(payload);
  });

  it('模拟文本管线往返：编码 → 当作纯文本搬运 → 解码仍一致', () => {
    const payload = { n: 7, df: { x: 1 } };
    const text = compressJson(payload);
    // 模拟 res.text() / IndexedDB 字符串的「文本搬运」：不做任何二进制处理
    const carried = text.normalize('NFC');
    expect(carried).toBe(text);
    expect(decompressJson(carried)).toEqual(payload);
  });
});

describe('与 fflate 的兼容性（确认载体就是 zlib + base64）', () => {
  it('产物可被 fflate 直接解压（不是私有格式）', () => {
    const payload = { hello: '世界' };
    const b64 = compressJson(payload);
    const bytes = new Uint8Array(Buffer.from(b64, 'base64'));
    const raw = new TextDecoder().decode(bytes);
    // 应为合法 zlib 流（fflate 头部 0x78）
    expect(raw.charCodeAt(0)).toBe(0x78);
  });

  it('fflate 直接产出的 zlib 结果与 compressJson 一致（同编码参数）', () => {
    const payload = { n: 3, df: { a: 1 } };
    const expected = Buffer.from(zlibSync(strToU8(JSON.stringify(payload)))).toString('base64');
    expect(compressJson(payload)).toBe(expected);
  });
});

describe('压缩有效性（体积收益是引入本模块的理由）', () => {
  it('高冗余数据压缩后显著小于原文（即使含 base64 的 33% 膨胀）', () => {
    const payload = { terms: Array.from({ length: 2000 }, () => 'knowledge') };
    const rawLen = JSON.stringify(payload).length;
    const compressedLen = compressJson(payload).length;
    expect(compressedLen).toBeLessThan(rawLen / 2);
  });
});

describe('错误契约（调用方需自行 try/catch）', () => {
  it('非 base64 输入抛错，而不是静默返回垃圾', () => {
    expect(() => decompressJson('这不是 base64!!')).toThrow();
  });

  it('base64 合法但非 zlib 内容 → 抛错（不会返回半截数据）', () => {
    const notZlib = Buffer.from('plain text not compressed').toString('base64');
    expect(() => decompressJson(notZlib)).toThrow();
  });

  it('空字符串 → 抛错', () => {
    expect(() => decompressJson('')).toThrow();
  });
});
