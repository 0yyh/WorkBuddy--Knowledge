/** browse:gen —— 生成 _browse/ 影子树：每个类目一页，列出其下词条（02 §9.1 软链接替代） */
import { join } from 'node:path';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { NodeFsVfs } from '@pks/core/node';
import { loadSnapshot } from '@pks/core';

export function browseGenCmd(contentDir: string): void {
  const vfs = new NodeFsVfs(contentDir);
  const { snapshot } = loadSnapshot(vfs);

  const byCat = new Map<string, { slug: string; title: string }[]>();
  for (const e of snapshot.entries) {
    for (const c of e.categories) {
      if (!byCat.has(c)) byCat.set(c, []);
      byCat.get(c)!.push({ slug: e.slug, title: e.title });
    }
  }

  const outDir = join(contentDir, '_browse');
  mkdirSync(outDir, { recursive: true });
  for (const [cat, items] of byCat) {
    const fname = cat.replace(/\//g, '__') + '.md';
    const lines = [`# ${cat}`, '', ...items.map((it) => `- [[${it.slug}|${it.title}]]`)];
    writeFileSync(join(outDir, fname), lines.join('\n'), 'utf8');
  }
  console.log(`🌳 browse:gen 完成：${byCat.size} 个类目影子页 → ${outDir}`);
  if (!existsSync(join(contentDir, '.index', 'manifest.json'))) {
    console.log('   （提示：先运行 build:index 以获得完整索引）');
  }
}
