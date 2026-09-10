# 个人本地知识学习站（Personal Knowledge Station）

> 纯本地、离线优先、内容永不锁定的个人知识阅读器。
> Web + Android（Capacitor）一套代码；正文 = 只读 md 文件（VFS），索引 = 构建期派生产物，用户数据 = 极小 KV。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `packages/core` | `@pks/core` 同构核心：类型 / 解析（front-matter + markdown）/ VFS（内存 · overlay · zip）/ 倒排 + BM25 检索 / 索引构建 / Track / 词典 / 冲突合并与打包。主入口不依赖 `node:*`，Node 能力走 `@pks/core/node` |
| `packages/cli` | `@pks/cli` Node 工具链：`build:index` / `lint` / `bundle` / `rename` / `browse:gen` / `search` |
| `apps/web` | `@pks/web` Vite 5 + React 18 + TS strict 阅读端（纯 CSS，无 Tailwind，自研 hash 路由）；同一产物经 Capacitor 7 打包为 Android App |
| `content` | 内容源（taxonomy / entries / tracks / dict），格式见 `content/README.md` |
| `scripts` | 内容投递与局域网分发：`copy-content.mjs`、`build-update.mjs`、`serve-lan.mjs` |
| `scripts/tools` | 一次性辅助工具：`gen-icons.py`（图标生成，非构建流程） |
| `docs` | 现行方案文档（01–06 · 11–14） |
| `docs/archive` | 已定稿的历史审计 / 评审记录（07–10），仅留档，不作为现行规范 |
| `docs/reports` | 各轮迭代的过程报告与状态快照 |

## 环境要求

- Node ≥ 20.11；本仓库为 pnpm workspace（`pnpm-lock.yaml`），**依赖安装用 `pnpm install`**。
- 依赖装好后，**所有任务脚本均通过根 `package.json` 调用**，不强制依赖 pnpm：
  `tsc` / `tsx` / `node` / `npm --prefix apps/web …`。若本机 pnpm 受限，直接用 `npm run <script>` 即可。
- **切勿**执行 `npm install` / `pnpm prune` 之外的依赖变更：`apps/web` 的 `@pks/core` 依赖
  通过 workspace 链接解析（`"workspace:*"`），npm 无法识别该协议，重建 `node_modules` 会断掉链接。
- Android 构建需 JDK 17+（AGP 8.7 / Gradle 8.11；本机用 `D:\JDK\jdk-19.0.1`）
  与 Android SDK（`compileSdk 35` / `targetSdk 34`）。

## 常用命令

```bash
npm run typecheck      # core + cli + web 类型检查
npm run test           # @pks/core 单元测试（vitest）
npm run build          # 编译 core/cli dist + 类型检查 + vite 构建

npm run build:index    # content/ -> content/.index/（分片索引）
npm run lint           # 内容规范校验
npm run bundle         # 导出数据包 zip
npm run browse:gen     # 生成 content/_browse/ 影子树
npm run rename old new # slug 改名级联

npm run content:copy   # content/ -> apps/web/public/content/（.index 改名 index）
npm run dev            # 启动阅读端 dev server

npm run build:update   # 生成局域网内容更新包 -> release/latest/
npm run serve:lan      # 托管更新包（默认 release/latest:8080）
npm run android:sync   # vite 产物 -> android assets
npm run android:build  # cap sync + gradlew assembleDebug
```

> 内容更新（不重装 App）：`node scripts/build-update.mjs` → `node scripts/serve-lan.mjs release/latest 8080`
> → 手机同一局域网访问 App「我的 → 内容更新」填入 `http://<电脑IP>:8080/`。

## 阅读端内容读取优先级

打包内置的只读内容（APK 内 `assets/public/content`）为兜底；一旦通过局域网 OTA 或本机文件导入
成功，IndexedDB 覆盖层被激活并**优先于**内置内容（`lib/loader.ts` 缓存优先）。清缓存即回到随包内容。

## 关键常量

集中在 `packages/core/src/constants.ts`：检索分区数 `SHARD_COUNT`（16/64/256）、BM25 `k1/b`、
Section 字数硬上限 20000、`tldr ≤ 120` 字、`keyPoints ≤ 80 字 × 8 条`、
著作级 `summary` 80–300 字、slug 正则等。

## 内容目录

```
content/
├── taxonomy.yaml        类目体系（唯一权威）
├── entries/<slug>/      扁平，一个 slug 一个目录
│   ├── entry.md
│   └── chapters/*.md    大著作拆章
├── tracks/*.yaml        学习序列 / 时间线
├── dict/                离线词典数据资源
├── .index/              构建期产物（gitignore）
└── _browse/             再生浏览影子树（gitignore）
```

详见 `content/README.md`；方案文档全部在 `docs/`。

## 文档索引

**现行规范（`docs/`）**

| 文件 | 内容 |
| --- | --- |
| `01-PRD-知识学习站.md` | 产品需求 |
| `01b-PRD补充-学习顺序与类目扩展.md` | 学习顺序与类目扩展 |
| `02-架构设计-知识学习站.md` | 架构设计 |
| `03-决策与整合总览.md` | 关键决策与整合 |
| `04-数据可信与修正机制设计.md` | 数据可信与修正 |
| `05-技术路径与UI性能安全.md` | 技术路径 / UI / 性能 / 安全 |
| `06-类目内容规划.md` | 类目内容规划 |
| `11-UI改进与OTA方案设计.md` | UI 改进与 OTA |
| `12-词典SDK与局域网更新基础落地.md` | 词典 SDK 与局域网更新 |
| `13-目录重构方案与结构改进评审.md` | 目录重构方案（本次整理依据） |
| `14-重构引用路径台账与回归验证基线.md` | 引用路径台账与回归基线 |

**历史留档（`docs/archive/`，结论可能已过时）**：`07` 全项目查漏审计、`08` 全维度查漏补全、`09` 外部 UI 方案评审、`10` 新界面与 UI 建议评审。

**过程报告（`docs/reports/`）**：各轮迭代报告、进度快照与操作说明，按文件名中的日期区分。
