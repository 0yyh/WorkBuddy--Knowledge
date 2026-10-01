/**
 * dict:expand —— 离线词典扩容（CT-4 配套）。
 *
 * 从现有内容抽取候选词头（词条 title + taxonomy 节点 title），合并进
 * `content/dict/dictionary.json`，去重后写回，提升阅读页划词命中率。
 * 抽取为确定性、无 LLM 依赖：词条 title 与类目名本就是用户会划选的术语。
 *
 * 新增条目 defs 留空（划词命中仍需释义时，UI 显示「命中术语」），源标记为「PKS 内容抽取」，
 * 不覆盖任何已有词条。后续可用 gen 管线为高频词补专业释义。
 *
 * 用法：pks dict:expand [--content content]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NodeFsVfs } from '@pks/core/node';
import { loadSnapshot } from '@pks/core';
import type { DictEntry, Dictionary } from '@pks/core/dict';

const DICT_REL = 'dict/dictionary.json';
// 抽取 stub 的占位释义：schema 要求 defs 非空（packages/core/dict/types.ts），
// 故 stub 必须带一条占位义，否则整本词典会被 parseDictionary 判非法、阅读页离线词典整体失效。
const STUB_DEF = '（术语已收录，释义待补）';

export function dictExpandCmd(contentDir: string): void {
  const vfs = new NodeFsVfs(contentDir);
  const { snapshot } = loadSnapshot(vfs);

  // 候选词头：词条 title + taxonomy 节点 title（均 ≥2 字、含汉字）
  const candidates = new Set<string>();
  for (const e of snapshot.entries) {
    if (e.title && e.title.length >= 2) candidates.add(e.title);
  }
  const walk = (nodes: typeof snapshot.taxonomy): void => {
    for (const n of nodes) {
      if (n.title && n.title.length >= 2) candidates.add(n.title);
      if (n.children) walk(n.children);
    }
  };
  walk(snapshot.taxonomy);

  const raw = vfs.readText(DICT_REL);
  const parsed = JSON.parse(raw) as Dictionary;
  const entries = (parsed.entries ?? {}) as Record<string, DictEntry>;
  const before = Object.keys(entries).length;

  let healed = 0;
  let added = 0;

  // 1) 治愈历史 run 产生的空释义 stub（defs:[] 违反 schema，会使整本词典加载失败）
  for (const term of Object.keys(entries)) {
    const e = entries[term];
    if (e && e.source === 'PKS 内容抽取' && (!Array.isArray(e.defs) || e.defs.length === 0)) {
      e.defs = [STUB_DEF];
      healed++;
    }
  }

  // 2) 新增候选词头（去重、仅收录含汉字的术语）
  for (const term of candidates) {
    if (entries[term]) continue;
    if (!/[一-鿿]/.test(term)) continue;
    entries[term] = {
      word: term,
      pinyin: '',
      pos: '',
      defs: [STUB_DEF],
      specialized: [],
      source: 'PKS 内容抽取',
    };
    added++;
  }

  const next: Dictionary = { ...parsed, count: before + added, entries };
  writeFileSync(resolve(contentDir, DICT_REL), JSON.stringify(next, null, 2) + '\n', 'utf8');

  console.log(
    `📖 词典扩容：现有 ${before} 条 → 新增 ${added} / 治愈空释义 ${healed} → 现 ${before + added} 条`,
  );
  if (added === 0 && healed === 0) console.log('（内容词头均已覆盖，无需扩充）');
}
