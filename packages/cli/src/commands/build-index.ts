/** build:index —— 内容目录 → .index/ 分片索引（02 §15.3 T03mini） */
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { NodeFsVfs } from '@pks/core/node';
import { buildIndex, writeIndexFiles, BUILD_STATE_FILE } from '@pks/core/build';
import type { BuildResult } from '@pks/core/build';

export interface BuildIndexCmdOptions {
  /** ② 增量构建（默认开启；--full 关闭） */
  incremental?: boolean;
}

export function buildIndexCmd(contentDir: string, opts: BuildIndexCmdOptions = {}): BuildResult {
  const vfs = new NodeFsVfs(contentDir);
  const incremental = opts.incremental !== false;
  const result = buildIndex(vfs, { incremental });
  // files 键以 '.index/' 开头，故落到 contentDir/.index/ 下
  writeIndexFiles(contentDir, result.files);

  // ② 增量 state 落到 content 根：gitignore、不进 .index/、不随包/APK 分发。
  writeFileSync(resolve(contentDir, BUILD_STATE_FILE), JSON.stringify(result.buildState, null, 2), 'utf8');

  const m = result.manifest;
  const mode = result.incrementalUsed ? '增量' : '全量';
  console.log(`✅ build:index 完成（${mode}${incremental ? '' : '·--full'}）`);
  console.log(`   词条 ${m.stats.entries} · 章节 ${m.stats.sections} · 字数 ${m.stats.words}`);
  console.log(`   检索分区 ${m.stats.shards} · 索引词项 ${m.search.terms} · 平均文档长 ${m.search.avgDocLen}`);
  console.log(`   entry 分片 ${m.entryShards.join(',')} · 重 TOC ${m.tocHeavy.length}`);
  if (result.errors.length) console.log(`   ⚠ 解析错误 ${result.errors.length} 条（见 lint）`);
  return result;
}
