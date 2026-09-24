# 贡献者 & 运维指南（Contributor & Ops Guide）

> 面向新成员与值班运维。读完本文 + 跑一遍 `node scripts/setup-env.mjs`，即可在 ~10 分钟内具备开发 / 构建能力。
> 配套脚本：`scripts/setup-env.mjs`（环境自检 + junction 兜底）、`scripts/build-apk.mjs`（一键 APK）、`scripts/check-links.mjs`（junction 校验）。

---

## 0. 三条红线（先读，违反即断构建）

1. **禁止重装依赖**：`npm install` / `pnpm install` / `pnpm prune` 一律不要跑。原因见下「@pks/core junction」。
2. **勿手改构建产物**：`content/.index/`、`apps/web/public/content/`、`content/_browse/` 都是构建期派生，手改会丢失。
3. **内容只在 `content/entries/<slug>/` 手写**；索引 / 影子树由工具生成。

---

## 1. 仓库布局

| 路径 | 角色 | 说明 |
| --- | --- | --- |
| `packages/core` | `@pks/core` | 同构核心引擎：类型 / front-matter+markdown 解析 / VFS（内存·overlay·zip）/ 倒排+BM25 检索 / 索引构建 / Track / 词典 / 冲突合并打包。主入口不依赖 `node:*`，Node 能力走 `@pks/core/node` |
| `packages/cli` | `@pks/cli` | Node 工具链：`build:index` / `lint` / `bundle` / `rename` / `browse:gen` / `search` |
| `apps/web` | `@pks/web` | React 18 + Vite 5 + TS strict 阅读端（纯 CSS，无 UI 框架，自研 hash 路由）；同一产物经 Capacitor 7 打包为 Android App |
| `content/entries/<slug>/` | **仅此目录手写内容** | 每个 slug 一个目录：`entry.md` + `chapters/ch-NN.md` |
| `content/taxonomy.yaml` | 类目权威源 | 词条 `categories` 用「标题路径」引用此文件 |
| `content/.index/`、`apps/web/public/content/` | 构建产物 | **勿手改**，由 `build:index` / `copy-content` 生成 |

依赖解析要点：`apps/web` 与 `packages/cli` 在 `package.json` 里把 `@pks/core` 声明为 `"workspace:*"`，但 npm 不识别该协议。真实解析靠**手工文件系统 junction**：

```
apps/web/node_modules/@pks/core   → packages/core   (junction)
packages/cli/node_modules/@pks/core → packages/core  (junction)
```

一旦误跑 `npm install` / `pnpm install`，`node_modules` 被重建，junction 即断链且无 git 回滚（node_modules 被忽略），web 构建会拉不到 `@pks/core` 的 dist。**junction 丢失不要重装，跑 `node scripts/setup-env.mjs` 自动重建即可。**

---

## 2. 技术栈

- **前端**：React 18 + Vite 5 + TypeScript（strict）。**纯 CSS**，无 Tailwind / 无 UI 框架，自研 hash 路由。
- **移动端**：Capacitor 7 → Android（同一 Web 产物打包）。
- **核心库**：`@pks/core` 同构（browser + node），主入口无 `node:*` 依赖。
- **构建 / 索引**：`@pks/cli`（基于 `tsx` 运行 `packages/cli/src/index.ts`）。
- **测试**：Vitest（`packages/core`、`apps/web`）。

---

## 3. 内容创作工作流

必读两份规格（决定了 lint 能否 0 error 0 warn）：

- `PHILO_SPEC.md` —— 内容结构 / 字数 / front-matter 字段的硬规格。
- `AUTHORING_BRIEF.md` —— 单条词条的「entry + 5 章」创作清单与回读自检流程。

### 硬规则（lint 会逐项校验，违反即 error / warn）

1. **末行标记（L009）**：每个 `entry.md` 与每个 `chapters/ch-NN.md` 的**最后一行**必须是 `<!-- PKS_EXPANDED_V5 -->`，其**前一行是空行**。缺失 →「缺少 PKS_EXPANDED 标记」error。
2. **章节字数**：每章正文 **≥ 1200 中文字（CJK 字符，不计标点）**，建议 1200–2400。整条 5 章约 7000–11000 字。
3. **`categories`**：必须是 `content/taxonomy.yaml` 中真实存在的「标题路径」数组（如 `科学/人类认知与心理`），不是 `id`。
4. **`order`**：必须是**数组**，如 `order: [1]`；写成标量会触发告警。
5. **`see_also`**：列出的 slug 必须真实存在（或本批同批 slug）。
6. **`sources`**：至少 1 条；每条 `title` 必须用**双引号**包裹（书名含 `: ` 会炸 YAML）。
7. **`summary.tldr` ≤ 120 字；`keyPoints` 每条 ≤ 80 字**。

### 典型创作循环

```bash
# 1) 写 content/entries/<slug>/entry.md 与 chapters/ch-01..05.md（末行空行 + 标记）
# 2) 校验规范（见第 4 节 lint 命令）
# 3) 重新构建索引 + 拷贝
node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p packages/core/tsconfig.json
CODEBUDDY_SAFE_DELETE_ENABLED=0 node node_modules/.pnpm/tsx@4.23.13/node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts build:index
node scripts/copy-content.mjs
# 4) 本地预览
npm --prefix apps/web run dev
```

---

## 4. 如何跑检查

> ⚠️ **根目录 `npm run <script>` 当前在部分环境不可用**（依赖解析 / 沙箱限制）。以下命令直接调用仓库内已锁定的二进制，**最稳妥**，请照抄路径。

### 4.1 内容规范 lint（必须 0 error 0 warn）

```bash
CODEBUDDY_SAFE_DELETE_ENABLED=0 node node_modules/.pnpm/tsx@4.23.13/node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts lint
```

要求：**0 error 0 warn**。非零即阻断后续构建（CI 同此校验）。

### 4.2 核心库编译（`@pks/core`）

```bash
node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p packages/core/tsconfig.json
```

产物写入 `packages/core/dist/`。`apps/web` 与 `packages/cli` 通过 junction 直接消费 `dist`。

### 4.3 前端测试（Vitest）

```bash
cd apps/web && npx vitest run
# 或仓库内锁定路径：
# node apps/web/node_modules/.pnpm/vitest@*/node_modules/vitest/vitest.mjs run
```

### 4.4 类型检查（三方）

```bash
node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p packages/core/tsconfig.json --noEmit
node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p packages/cli/tsconfig.json --noEmit
npm --prefix apps/web run typecheck
```

---

## 5. 一键 APK 构建

```bash
npm run apk
```

内部编排（见 `scripts/build-apk.mjs`）：

1. `build:index` + `copy-content`（`scripts_build.mjs`，需 `CODEBUDDY_SAFE_DELETE_ENABLED=0`）
2. `vite build`（`apps/web`，需 `CODEBUDDY_SAFE_DELETE_ENABLED=0`）
3. 同步 `dist` → `android` public（`scripts_sync_android_assets.mjs`）
4. `gradle assembleDebug`（**必须走 PowerShell**，原生 `*> ` 重定向，绝不用管道）

### ⚠️ 沙箱 / 平台注意事项

- **嵌套 `spawnSync('node', ...)` 可能命中 `EBUSY`**：在受限沙箱里，多进程嵌套启 node 会偶发 EBUSY；构建失败可重试或在本机直接运行。
- **Gradle 必须走 PowerShell + 原生 `*> ` 重定向**：若改回管道（`| Out-File` / `| Tee-Object`），会**吞掉 gradle.bat 的退出码**，造成「构建其实成功却被报 failed」的假失败。
- **必需环境变量**：
  ```
  JAVA_HOME=D:\JDK\jdk-19.0.1
  ANDROID_HOME=D:\Android SDK
  CODEBUDDY_SAFE_DELETE_ENABLED=0
  ```
- 产物：`apps/web/android/app/build/outputs/apk/debug/app-debug.apk`。

---

## 6. 新成员 10 分钟清单

```bash
# 1) 克隆仓库（含 node_modules，勿重装）
git clone <repo-url> && cd WorkBuddy--Knowledge

# 2) 跑环境自检 + 兜底重建 junction（自动）
node scripts/setup-env.mjs

# 3) 编译核心库
node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p packages/core/tsconfig.json

# 4) 对任一内容做 lint 抽样，确认 0 error 0 warn
CODEBUDDY_SAFE_DELETE_ENABLED=0 node node_modules/.pnpm/tsx@4.23.13/node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts lint

# 5) 一键出包，确认产出 app-debug.apk
npm run apk
```

完成后即可开始：在 `content/entries/<slug>/` 手写词条 → `build:index` → `copy-content` → 本地 `npm --prefix apps/web run dev` 预览。

---

## 7. 故障速查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| web 构建拉不到 `@pks/core` | junction 断链（误跑过 install） | `node scripts/setup-env.mjs` 自动重建；或 `cmd /c mklink /J apps\web\node_modules\@pks\core packages\core` |
| lint 报「缺少 PKS_EXPANDED 标记」 | 文件末行缺 `<!-- PKS_EXPANDED_V5 -->` 或前一行非空 | 回读末 3 行补标记 |
| `npm run xxx` 报命令不存在 | 根脚本在当前环境受限 | 改用第 4 节直调二进制路径 |
| APK 构建「假失败」 | Gradle 走了管道吞退出码 | 确认 `scripts/build-apk.mjs` 用 PowerShell `*> ` 重定向 |
| `EBUSY` | 沙箱嵌套 spawn node | 本机直接重跑 / 重试 |
