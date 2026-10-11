# 类目引用键与展示名解耦设计（taxonomy id 路径迁移）

> 作者：架构师 高见远 ｜ 日期：2026-10-06
> 来源：系统分析报告「维度二·类目引用键与展示名未解耦」
> 关联：`content/taxonomy.yaml`、`packages/core/src/index/builder.ts`、`packages/cli/src/commands/lint.ts`、`apps/web/src/state/AppContext.tsx`
> 范围：**本次只做设计 + 规范 + 脚本**，不批量改 795 词条；类目命名即日起冻结（见 taxonomy.yaml 顶部铁律）。

---

## 0. 现状与问题

- `content/taxonomy.yaml` 每个节点**已同时具备** `id`（slug 化，如 `cog-psych`、`law-juris-positivism`）与 `title`（中文展示名，如 `人类认知与心理`）与 `path`（完整中文路径，如 `科学/人类认知与心理`）。
- 词条 `entry.md` 的 `categories` 字段用**标题路径**引用（如 `科学/人类认知与心理`）。`TaxonomyNode` 类型注释明确写「类目路径：中文，斜杠分隔，必须存在于 taxonomy.yaml」。
- 改名即断链：谁改了某个节点 `title`，所有引用该标题路径的词条 `categories` 立即失效（lint L002 报错 / L012 告警），且旧词条正文里没有 id 兜底。

**结论**：`id` 已稳定存在，但**内容侧不消费 id 链**，展示名（title）被当成引用键，导致命名脆弱。中远期目标：让 `categories` 引用稳定的 `id 路径`，`title` 仅作展示。

---

## 1. 每个节点如何获得稳定 id

节点 `id` 早已在 taxonomy.yaml 中手工指定（非自动生成），规则：

- **L1**：约定英文 slug（11 个固定：`history` / `philosophy` / `science` / `economics` / `politics` / `technology` / `literature` / `art` / `religion` / `linguistics` / `law`）。
- **L2/L3**：`父id-本义slug` 形式，如 `law-juris`、`law-juris-positivism`、`cog-psych`、`cog-process`。全站 id 唯一（无冲突，lint L001 同机理）。

**id 路径** = 从根到该节点的 id 以 `/` 拼接：

| 节点 | title 路径（现状引用键） | id 路径（目标引用键） |
|------|------------------------|----------------------|
| 科学 | 科学 | `science` |
| 人类认知与心理 | 科学/人类认知与心理 | `science/cog-psych` |
| 认知过程 | 科学/人类认知与心理/认知过程 | `science/cog-psych/cog-process` |
| 法律实证主义 | 法学/法理学/法律实证主义 | `law/law-juris/law-juris-positivism` |

> 末段 id 即节点自身 `id`；id 路径的「最后一段」可 1:1 反查节点，无需再查表。

---

## 2. 词条 categories 如何从标题路径过渡到 id 路径

**目标形态**（entry.md 内）：

```yaml
categories:
  - science/cog-psych          # 原：科学/人类认知与心理
  - law/law-juris/law-juris-positivism   # 原：法学/法理学/法律实证主义
```

- `title` 字段**完全不变**，仅作文档/UI 展示；引用键改为 id 路径。
- 多类目（跨 L1 双标签）写法不变，只是每个元素从标题路径换成对应 id 路径。
- 迁移是**机械的双射**：taxonomy.yaml 已提供 `标题路径 ↔ id 路径` 完整映射，脚本可无损互转。

---

## 3. CLI 构建期：建 title↔id 映射 + 校验无断链

代码位置：`packages/core/src/index/builder.ts` 与 `packages/cli/src/commands/lint.ts`。

### 3.1 现状（已具备，但绑定标题路径）

- `buildCategoryIdMap(taxonomy)`（`builder.ts` L66-76）：建 `Map<path(标题路径), id>`。
- `categoryIdsOf(cats)`（`builder.ts` L196）：`cats.map(c => idMap.get(c) ?? c)` —— 把 entry 的 `categories`（标题路径）解析成 id 数组，写入 `EntryIndexItem.c`（categoryIds）。
- `assignSlugs`（`builder.ts` L206-212）：`n.entrySlugs = entries.filter(e => e.categories.includes(n.path))` —— 用标题路径匹配回填每个节点的词条列表。
- lint `collectPaths`（`lint.ts` L23-28）+ L002（`lint.ts` L184-189）：`validPaths` 收集 `n.path`（标题路径），`categories` 不在其中即 L002 error。

### 3.2 过渡期（双形态兼容，迁移脚本跑 `--apply` 前后都能 build/lint 通过）

- `buildCategoryIdMap` 改为建 `Map<key, id>`，**key 同时含标题路径与 id 路径**：
  `map.set(n.path, n.id); map.set(n.idPath, n.id);`（idPath 由 taxonomy 派生，见 §1）。
- `categoryIdsOf`：`idMap.get(c) ?? c` 不变（标题或 id 路径都能查到 id）。
- `assignSlugs`：匹配条件改为 `e.categories.includes(n.path) || e.categories.includes(n.idPath)`。
- lint `collectPaths`：`validPaths` 同时收集 `n.path` 与 `n.idPath`（双集合），L002 两种写法都不报错。
- 这样**部分迁移**（某些词条已改 id 路径、某些仍是标题路径）时，构建与 lint 均不破。

### 3.3 终态（全量迁移完成后）

- 删除 `validPaths` 中的标题路径，只收 `n.idPath`；`buildCategoryIdMap` 只建 id 路径映射；`assignSlugs` 只匹配 `n.idPath`。
- 标题路径彻底退为纯展示，`TaxonomyNode.path` 可保留（UI 用）或逐步废弃。

### 3.4 断链校验（脚本负责，CI 也可接）

- 迁移脚本（§5）扫描所有 `entry.md`，凡 `categories` 值**既不在标题路径集合、也不在 id 路径集合** → 视为断链（引用了不存在的类目），dry-run 全量列出，0 断链才允许 `--apply`。
- 这等价于把 L002 的「断链」提前在迁移前暴露，避免 `--apply` 后产生坏数据。

---

## 4. web 端：按 id 聚合、按 title 展示

代码位置：`apps/web/src/state/AppContext.tsx`（已读）。

**关键发现：web 端当前已经「按 id 聚合、按 title 展示」，迁移 categories→id 路径后 web 业务代码零改动（只要 bundle 仍携带 node.title/path）。**

- `buildUnionSlugs`（L184-194）：以 `node.id` 为 key 聚合 `node.entrySlugs`（含子孙），计数与浏览列表一致。
- `buildCategoryViews`（L207-225）：`CategoryView` 返回 `{ id, title, path, level, count, children }` —— **key 用 id，展示用 title/path**。
- `buildNodeMaps`（L227-241）：同时建 `nodeById`（id→节点）与 `nodeByPath`（path→节点），跳转/反查都覆盖。
- `EntryIndexItem.c`（`types.ts` L309）已是 categoryIds 数组（构建期已从 categories 解析为 id），web 搜索/筛选直接消费 id。

**唯一需对齐点（非阻塞，可选）**：`builder.ts` 写的 `covers/{slug}.json` 中 `categories` 字段目前透传 `e.categories` 原值（迁移后变成 id 路径）。若详情页「类目面包屑」直接用 `covers.categories` 渲染中文，应改为经 `nodeById` 反查 `title`；或构建期在 cover 里同时保留 id 与 title。属于展示层小修，不阻塞迁移。

---

## 5. 迁移脚本（scripts/migrate-taxonomy-ids.mjs）

- 纯 Node 标准库实现（无第三方依赖，本仓未装 yaml/js-yaml）。
- 行式解析 `taxonomy.yaml` 建 `标题路径 ↔ id 路径` 映射；递归扫描 `content/entries/**/entry.md`。
- **默认 dry-run**：只打印将改哪些文件、多少条 categories、有无断链，**不写盘**。
- `--apply`：真正改写（仅改 `categories` 列表项的值，frontmatter 其余不动）。
- `--direction toId`（默认）标题→id；`--direction title` 回滚（id→标题），实现可逆。
- **幂等**：已是目标形态（id 路径）的条目不重复改写，可重复运行。
- 仅处理 block 风格 `categories:`（全站现状均为此风格）；inline 风格 `categories: [a, b]` 跳过重报。

用法：
```bash
# 默认 dry-run（验证脚本可用，不改任何文件）
node scripts/migrate-taxonomy-ids.mjs

# 指定方向 / 内容根
node scripts/migrate-taxonomy-ids.mjs --direction toId --content content
node scripts/migrate-taxonomy-ids.mjs --direction title            # 回滚

# 真正执行（须先确认 dry-run 0 断链）
node scripts/migrate-taxonomy-ids.mjs --apply
```

### 5.1 已知边界与实测结果（2026-10-11 验证）

- **CRLF 行尾坑（已修复）**：部分 `entry.md` 使用 CRLF 行尾（实测 3 个：`byzantine-art`、`relief-sculpture`、`watercolor`）。若按 `\n` 切行，行尾 `\r` 会使 JS 正则 `.*` 匹配不到，导致该文件全部 `categories` 项被静默跳过、`--apply` 后漏改。脚本已在读取 taxonomy 与 entry 时统一 `replace(/\r\n/g,'\n')` 归一，修复此坑。
- **WIP 词条安全跳过**：实测 5 个词条有开头 `---` 但无结尾 `---`（撰写中的半成品：`anti-duhring`、`october-revolution`、`on-contradiction`、`on-practice`、`reform-and-opening`），脚本按「无有效 frontmatter」跳过，不触碰、不破坏；待其撰写完成后重跑即被纳入（幂等）。**这些词条当前不在 790 将改范围内**，但含 `categories:` 字段，属已知待补。
- **dry-run 实测（DANGER：未 --apply，未改 795 词条）**：
  - 扫描词条目录文件：**795**
  - 将改文件：**790**（涉及 **917** 条 `categories` 值）
  - 无需改动（无 `categories` 块）：**0** ｜ 无有效 frontmatter（WIP）：**5**
  - 断链（未知引用）：**0 处** ✅
- **幂等 & 回滚验证**：用 5 个词条临时副本跑 `forward --apply` → 重跑 dry-run **0 改动**；再 `rollback --direction title --apply` → 重跑 dry-run **0 改动**，原值无损还原。证明 `--apply` 安全、可逆、可重复。

---

## 6. 兼容 / 回滚策略

| 阶段 | categories 形态 | 操作 | 风险 |
|------|----------------|------|------|
| 现在 | 全部标题路径 | 冻结命名（taxonomy.yaml 铁律） | 改名仍断链，但已禁止 |
| 过渡 | 标题/ id 混存 | 跑 `--apply` 分批/全量改写；CLI 双集合兼容 | 无（双形态都能 build/lint） |
| 终态 | 全部 id 路径 | CLI 切到仅收 id 路径；可选清理 `path` | 改名不再影响内容（id 稳定） |
| 回滚 | id→标题 | 跑 `--direction title --apply` | 无（双射可逆） |

- **回滚**：因映射是 taxonomy.yaml 内的双射，回滚 = 同脚本反向跑一遍，机械无损。
- **断链兜底**：任何 `--apply` 前 dry-run 显示断链（未知引用），先修 taxonomy 或词条再执行；脚本不因断链中断，只报告。
- **构建产物**：`--apply` 后需重跑 `build:index`（taxonomy 节点 `entrySlugs` 与 `EntryIndexItem.c` 由构建期重新解析）。

---

## 7. 落地 Checklist（中远期执行 --apply 时）

1. 确认本设计 §3.2 的 CLI 双集合兼容已合入（否则 `--apply` 后 L002 全红）。
2. 跑 `node scripts/migrate-taxonomy-ids.mjs`（dry-run），确认「断链 = 0、将改文件数 = 当前标题路径条目数」。
3. 跑 `node scripts/migrate-taxonomy-ids.mjs --apply`。
4. 重跑 `build:index` + `lint`，确认 0 error。
5. （可选）web 详情页类目面包屑经 `nodeById` 反查 title。
6. 全量迁移稳定后，按 §3.3 切到 id 路径终态，刷新 `taxonomy:baseline`。
