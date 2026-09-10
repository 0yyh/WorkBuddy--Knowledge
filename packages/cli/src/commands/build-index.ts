/** build:index —— 内容目录 → .index/ 分片索引（02 §15.3 T03mini） */
import { NodeFsVfs } from '@pks/core/node';
import { buildIndex, writeIndexFiles } from '@pks/core/build';
import type { BuildResult } from '@pks/core/build';

export function buildIndexCmd(contentDir: string): BuildResult {
  const vfs = new NodeFsVfs(contentDir);
  const result = buildIndex(vfs);
  // files 键以 '.index/' 开头，故落到 contentDir/.index/ 下
  writeIndexFiles(contentDir, result.files);

  const m = result.manifest;
  console.log('✅ build:index 完成');
  console.log(`   词条 ${m.stats.entries} · 章节 ${m.stats.sections} · 字数 ${m.stats.words}`);
  console.log(`   检索分区 ${m.stats.shards} · 索引词项 ${m.search.terms} · 平均文档长 ${m.search.avgDocLen}`);
  console.log(`   entry 分片 ${m.entryShards.join(',')} · 重 TOC ${m.tocHeavy.length}`);
  if (result.errors.length) console.log(`   ⚠ 解析错误 ${result.errors.length} 条（见 lint）`);
  return result;
}
