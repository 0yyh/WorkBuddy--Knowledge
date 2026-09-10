/**
 * 词典序列化：校验一个 Dictionary 对象（通常来自 content/dict/dictionary.json 的 JSON.parse），
 * 并重新导出为规范 JSON 字符串。
 *
 * 用途：
 * - CLI/内容打包前验证数据合法性；
 * - 把内存中的字典重新写回 content/dict/dictionary.json 时使用。
 * 本模块为同构纯函数，不直接写盘。
 */
import type { DictEntry, Dictionary } from './types.js';
import { parseDictionary } from './types.js';

/** 规范化单条词条为可 JSON.stringify 的结构（剔除 undefined 字段） */
export function normalizeEntry(e: DictEntry): DictEntry {
  const out: Record<string, unknown> = {
    word: e.word,
    defs: e.defs,
    specialized: e.specialized,
  };
  if (e.pinyin) out.pinyin = e.pinyin;
  if (e.ipa) out.ipa = e.ipa;
  if (e.pos) out.pos = e.pos;
  if (e.source) out.source = e.source;
  return out as unknown as DictEntry;
}

/**
 * 把 Dictionary 对象序列化为 JSON 字符串。
 * @param dict 待序列化的字典（会先校验；若有错则抛错，避免写出脏数据）
 * @param pretty 是否美化（默认 false，紧凑）
 */
export function serializeDictionary(dict: Dictionary, pretty = false): string {
  const v = parseDictionary(dict);
  if (v.errors.length) {
    throw new Error(`词典校验失败：\n${v.errors.join('\n')}`);
  }
  const d = v.value!;
  const out: Record<string, unknown> = {};
  if (d.version) out.version = d.version;
  if (d.built_at) out.built_at = d.built_at;
  out.count = Object.keys(d.entries).length;
  if (d.source) out.source = d.source;
  if (d.description) out.description = d.description;
  out.entries = d.entries;
  return pretty ? JSON.stringify(out, null, 2) : JSON.stringify(out);
}
