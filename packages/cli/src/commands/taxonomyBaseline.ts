/**
 * taxonomy:baseline —— 生成 taxonomy 标题冻结基线（CT-1 配套）。
 *
 * 把当前 taxonomy 所有节点的 `{id: title}` 写入 `content/taxonomy.titles.json`，
 * 供 lint 的 L012 规则比对：日后若某节点标题被改，L012 即告警（因为词条 categories
 * 以标题路径引用节点，改名会破坏旧引用）。
 *
 * 用法：pks taxonomy:baseline [--content content]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NodeFsVfs } from '@pks/core/node';
import { loadSnapshot } from '@pks/core';

export function taxonomyBaselineCmd(contentDir: string): void {
  const vfs = new NodeFsVfs(contentDir);
  const { snapshot } = loadSnapshot(vfs);

  const baseline: Record<string, string> = {};
  const walk = (nodes: typeof snapshot.taxonomy): void => {
    for (const n of nodes) {
      baseline[n.id] = n.title;
      if (n.children) walk(n.children);
    }
  };
  walk(snapshot.taxonomy);

  const outPath = resolve(contentDir, 'taxonomy.titles.json');
  writeFileSync(outPath, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
  console.log(`🔒 已生成 taxonomy 冻结基线：${outPath}（${Object.keys(baseline).length} 个节点）`);
}
