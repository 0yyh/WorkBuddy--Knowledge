# PKS 项目进度快照（状态报告 · 阅读体验 QA 轮结束后）

> 生成时间：2026-09（对话暂停点）。本文件为"项目推进到哪一步 / 下一步 / 距离完工"的状态快照，非代码改动。
> 详细逐轮记录见 `.workbuddy/memory/2026-09-06.md ~ 2026-09-08.md`。

## 一、当前推进到哪一步

**已实现并交付（debug APK 已产出，最新 4.22MB，18 个内容文件，离线可用）：**

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| M0 / T01–T03 | `@pks/core`（同构核心：解析/VFS/倒排+BM25/索引/Track/打包）+ `@pks/cli`（build:index/lint/bundle/rename/browse:gen）；47 单测全过 | ✅ |
| T04 | Web 阅读端（Vite5+React18+TS strict，纯 CSS，自研 hash 路由；home/browse/entry/search/timeline） | ✅ |
| T05 | Capacitor 7 Android 工程打通，debug APK 构建成功（com.pks.app / targetSdk34 / compileSdk35） | ✅ |
| V1 | 移动端 App 化：底部 4 Tab、沉浸阅读、续读、看过历史、阅读偏好 | ✅ |
| V2 | 10 条大改：类目页、系统返回手势、设置拆分、双层阅读（封面→阅读）、视觉圆润化、OTA 占位 | ✅ |
| V3 | 真机 7 条修复（OTA 文案、原生返回栈、背景污染、chrome 减重、搜索去重、世界线卡片、详情页去面包屑） | ✅ |
| V4 | 5 条 + 原生返回拦截（MainActivity.onBackPressed 全权委托 JS）+ 阅读页小说化 + 系统字号 rem 化 | ✅ |
| 修复轮 | 状态栏沉浸（edge-to-edge 按需切换）、子层弹层主题自适应、状态栏常驻真持久化、间距设置改版、目录强调色主题、返回"逐级回首页 + 双击退出" | ✅ |

**结论：APP 的"功能骨架 + 阅读体验"已实现并多轮真机打磨，你已确认"UI 暂时没什么大问题"。**

## 二、下一步要干什么（按优先级）

1. **真机复验闭环（你侧，非代码）** —— 在真机确认：状态栏沉浸/常驻、子层弹层主题、间距/目录背景、返回逐级回首页 + 首页双击退出"再按一次退出知识"。若有新问题反馈，我再修。这是"可发布"的前置闸门。
2. **正式签名 release 包** —— 配 `signingConfig` + `gradlew assembleRelease`；核对体积（≤80MB 约束）、ProGuard/混淆、版本号。当前仅 debug 包。
3. **OTA 自更新（可选）** —— `lib/update.ts` 仍是占位 URL；需你提供托管域名/manifest.json；且 Android 无法静默安装，需自建"下载 + 申请安装权限"流程，或明确本轮砍掉。
4. **内容规模化** —— PRD 规划量级约 2000 万字，当前仅 ~16 个样例词条。这是"完工"的最大工程量（内容生产/录入，非纯代码）。
5. **大内容性能骨架（若量级上来）** —— 分区懒加载 + IndexedDB 缓存骨架（T02mini 提过，未实做）；当前样例无压力，不阻塞 MVP。

## 三、距离"完工"还有多少步骤

"完工"无形式化定义，按"可发布 v1.0"理解，剩余明确步骤约 **6–8 步**：

| # | 步骤 | 类型 | 备注 |
| --- | --- | --- | --- |
| 1 | 真机复验阅读体验全量 + 修复反馈 | 你侧+我修 | 闸门 |
| 2 | 正式签名 release 包 | 工程 | 需 keystore |
| 3 | OTA 接入 或 砍掉 | 决策+工程 | 需托管 |
| 4 | 首批真实内容录入（N 书目/若干万字） | 内容 | 主导工程量 |
| 5 | 大内容性能骨架（懒加载+IndexedDB） | 工程 | 视量级 |
| 6 | iOS 平台（Capacitor add ios + 构建/签名） | 工程 | 同套代码 |
| 7 | 数据管理/导入导出完善 | 工程 | 视 PRD |
| 8 | 增强功能（笔记/评论/书签真实化） | 工程 | 可选 |

**当前处于"实现完成、待真机复验 + 发布就绪"阶段。** 最大不确定性是内容规模（2000万字 vs 当前样例）与"完工"边界，需你拍板。

## 四、已知残留（低危，非阻断）

- `setBackInterceptor` 为死代码：目录/设置浮层打开时按返回不会先关浮层，而是直接离开阅读页。
- 封面图：`covers/{slug}.json` 目前靠 `synthesizeCover` 回退，无真实封面数据。
- 评论/笔记：目录 sheet 的"笔记"已删，评论为占位，未实做。
- 个别 WebView 对 `replaceState` 偶发误发 `hashchange`（无害重算，已观察）。

---

## 更新（2026-09-10 · 内容扩建 + 缺陷修复轮）

> 上文为历史快照，以下为当前状态增量登记（不改写原记录）。

**规模**：内容 90 → **101 词条 / 500 章 / 44.3 万字**；新增 `技术`（L1）大类、
`哲学/西方哲学/中世纪哲学` 节点；新增 **3 条时间线**（哲学史 16 节点 / 科学技术史 14 节点 /
文明长河·跨领域对照 25 节点），前端零改动自动出现。

**已修复的缺陷**

| # | 位置 | 问题 | 处置 |
| --- | --- | --- | --- |
| 1 | `lib/contentUpdater` + `capacitor.config.ts` | App 内更新报「无法连接更新源（Failed to fetch）」 | WebView 混合内容被拦；显式开 `android.allowMixedContent` |
| 2 | 根 `package.json` | `typecheck` 指向不存在的 `apps/reader`；`build`/`dev` 引用不存在的 `@pks/reader`；`build:content` 指向不存在的 `scripts/build-content.mjs` | 全部改指 `apps/web` / `@pks/web` / `scripts/copy-content.mjs`，并新增 `build:update`、`serve:lan`、`android:*` |
| 3 | `util/lru.ts` + `index/lazy-loader.ts` | `LRUCache` 无 `delete`；`PartitionLoader.evictOldest` 用 `get()` 反而把目标提升为 MRU，**从未真正驱逐** | 补 `delete()`、明确 `evictable()` 语义、`evictOldest` 改为显式删除 |
| 4 | `dict/query.ts` | `lookupDict` 直接索引 `entries[q]`，选中 `constructor` 等会命中 `Object.prototype` | 改为自有属性判定（回归测试已覆盖） |
| 5 | `merge/bundle.ts` | 校验和用 SHA-1 却标 `sha256:` 前缀；无校验函数 | 改标 `sha1:`，新增 `computeBundleChecksum` / `verifyBundleChecksum` |
| 6 | `vfs/zip.ts` | 恒真判断 `data.length >= 0` 与注释不符 | 去掉恒真条件，明确「目录项跳过、空文件保留」 |
| 7 | `README.md` | 指向不存在的 `@pks/reader`、`content/README.md`；命令与本仓库实际不符 | 重写；补写 `content/README.md`（含 YAML 引号等踩坑） |

**测试**：`@pks/core` 单测 60 → **135 全过**（新增 lru / varint / sha1 / slugify / words /
track / vfs / dict-query / bundle 共 9 个测试文件）；core · cli · web 三端 `typecheck` 干净；
`lint` 0 error / 0 warn。

**残留项状态修订**

- `setBackInterceptor` 死代码 —— **复核后确认已不成立**（见 §四修订），链路完整可用。
- 封面 `covers/{slug}.json` 靠 `synthesizeCover` 回退 —— 保持。
- 评论/笔记占位 —— 保持（未实做）。
- `lib/update.ts` 的 APK 自更新占位 URL —— 保持（需公开托管域名后启用）。

---

## 更新（2026-09-10 · 质量巡检轮：代码质量 / 错误处理 / 边界 / 文档）

> 纯本地加固，**不新增依赖、不改架构**；全部经 typecheck（core+cli+web）+ 135 单测 +
> lint 0/0 + `vite build` 验证。

**真实功能 Bug（3）**

| # | 位置 | 问题 | 处置 |
| --- | --- | --- | --- |
| 1 | `EntryReaderPage` | `chapterStart` prop **从未被读取** → 详情页点某章只按续读位置打开，「点章节不跳章」 | 初始 `index` 优先取 `chapterStart`（有限数取整、夹 ≥0），否则回退续读 |
| 2 | `EntryCoverPage` | 章节 `?ch=i+1` 与阅读页 `docs`（剔除 container 卷）**潜在错位** | 改为按内容章节计数（`chapterRows` + running `docIndex`；container 渲染为不可点行）——当前内容无卷，故无行为变化，消除未来错位 |
| 3 | `SearchPage` | `pushRecent` 写 localStorage 却从不 `setRecent` → 清空查询后「最近搜索」仍显示旧列表 | `pushRecent` 返回新列表并 `setRecent` 同步 |

**错误处理 / 边界（3）**

| # | 位置 | 问题 | 处置 |
| --- | --- | --- | --- |
| 4 | `cli/load-index.ts` + `commands/search.ts` | manifest 在但 `search/title.json` 缺 → 原生 ENOENT 栈回溯 | 关键文件缺失 → 返回 `null`（提示先 build:index）；文件在但 JSON 损坏 → **抛明确错误**；单分片损坏 → 按缺失处理（少召回不炸） |
| 5 | `web/lib/contentUpdater.ts` | 清单 `files: []` 时 `keep` 空集 → 「清理旧缓存」**清空整份缓存** | `isManifestShaped` 拒绝空 `files`；`applyContentUpdate` 对 `total===0` 提前返回且不激活 |
| 6 | `cli/index.ts` | `search --level` 非法值静默降级为 l1 | 与 `bundle --level` 一致——非法值直接报错退出 |

**死代码清理（用 `tsc --noUnusedLocals` 诊断逐一确认，三包复检均 0 条）**

- `core/index/builder.ts` 删循环内未用 `const secs`；
- `core/content/repository.ts` 删未用 `normalizePath` 导入 + 未用 `EntryMeta` 类型；
- `cli/commands/build-index.ts` 删未用 `join` 导入；
- `web/lib/content.ts` 删**全项目零引用**的 `buildChapterTree`（含内部 `byKey`/`void byKey`）；
  `web/types.ts` 同步删仅它使用的 `ChapterView`。

**文档修正**：§四「`setBackInterceptor` 死代码」经复核为**过时结论**，已改正（链路实际完整）。

**方法记录**：用 `tsc --noUnusedLocals --noUnusedParameters`（**仅诊断，不改 tsconfig**，
因该开关是刻意关闭的）可一次性列出三包未使用符号，精准定位死代码。

