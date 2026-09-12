/**
 * build:chardict —— 把 character/ 下 4 个源文件合并为单个 index.json。
 *
 * 读取：<content>/dict/chinese-dictionary/character/
 *        {char_base,char_detail}.json（JSONL） + {polyphone,related}.json（标准 JSON 数组）
 * 写出：<content>/dict/chinese-dictionary/character/index.json（标准 JSON，运行期只取这一个）
 *
 * 合并逻辑见 @pks/core/dict 的 buildCharIndex（按 char 合并 base/poly/detail/related）。
 * 原始 4 文件保留在 content/dict 源目录（保完整性与可读性）；运行期经 copy-content 自动剔除。
 */
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  parseCharBase,
  parseCharDetail,
  parsePolyphone,
  parseRelated,
  buildCharIndex,
} from '@pks/core/dict';

export function buildCharDictCmd(contentDir: string): void {
  const dir = join(contentDir, 'dict', 'chinese-dictionary', 'character');

  const readText = (f: string): string => {
    const p = join(dir, f);
    if (!existsSync(p)) {
      console.error(`✗ 找不到字符词典源文件：${p}`);
      process.exit(1);
    }
    return readFileSync(p, 'utf8');
  };
  const readJson = (f: string): unknown => {
    try {
      return JSON.parse(readText(f));
    } catch (e) {
      console.error(`✗ ${f} 不是标准 JSON：${(e as Error).message}`);
      process.exit(1);
    }
  };

  const base = parseCharBase(readText('char_base.json')).value;
  const detail = parseCharDetail(readText('char_detail.json')).value;
  const poly = parsePolyphone(readJson('polyphone.json')).value;
  const related = parseRelated(readJson('related.json')).value;

  const { chars, errors } = buildCharIndex(base, detail, poly, related);
  const out = {
    version: '1.0.0',
    built_at: new Date().toISOString(),
    source: 'chinese-dictionary (character)',
    count: Object.keys(chars).length,
    chars,
  };
  const outPath = join(dir, 'index.json');
  writeFileSync(outPath, JSON.stringify(out), 'utf8');

  console.log(`🔤 build:chardict 完成：${out.count} 字 → ${outPath}`);
  console.log(`   （char_base ${base.length} / char_detail ${detail.length} / polyphone ${poly.length} / related ${related.length}）`);
  if (errors.length) {
    console.log(`   ⚠ ${errors.length} 条 detail/related 缺 base 记录，已跳过：${errors.slice(0, 3).join('、')}${errors.length > 3 ? '…' : ''}`);
  }
  console.log('   运行期只需 index.json；原始 4 文件请勿随包下发（copy-content 会自动剔除）。');
}
