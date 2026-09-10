# 项目长期记忆 · 个人知识学习站（PKS）

纯本地、离线优先的个人知识学习站。Web（React 18 + Vite 5 + TS strict，**纯 CSS 无 Tailwind**）
+ Android（Capacitor 7，同一套代码）。pnpm monorepo：`packages/core`、`packages/cli`、`apps/web`。
**项目已 git 化**（2026-09-10）：分支 `master`，远程 `git@gitee.com:Peter-Y/WorkBuddy--Knowledge.git`（SSH），
身份 `Peter-Y / 2270778780@qq.com`。密钥 `~/.ssh/id_ed25519`。

## 目录约定（2026-09-10 重整后）
- `docs/` **只放现行规范**（01–06 设计类、11–14 方案/评审/重构）。
- `docs/archive/` = 历史审计与评审（07–10），结论可能过期，**不作为规范引用**。
- `docs/reports/` = 各轮过程报告与状态快照（根目录不再散落 md，除 README.md）。
- `scripts/` = 构建投递（`build-update` / `copy-content` / `serve-lan`）；`scripts/tools/` = 一次性辅助工具。
  原 `apps/web/scripts/` **已删除**，脚本入口唯一。
- `.gitignore` 已改为精确忽略 Android **构建产物**（`.gradle/ build/ app/build/ assets/public/ local.properties`），
  **手改的 Gradle / Java / Manifest 全部入库**（此前被整行 `apps/web/android/` 吞掉，换机无法重建）。
- `.workbuddy/*` 被忽略但 `!.workbuddy/memory/` 保留入库。

## 环境约束（违反会直接失败）
- **禁止 `pnpm`**：本项目下 pnpm 触发沙箱 wmic 拦截 → 一律用 `npm`（依赖已装好，勿 reinstall）。
- **`JAVA_HOME` 必须显式设为 `D:\JDK\jdk-19.0.1`**：PATH 上默认 java 是 **16.0.2**，而 Gradle 8.11 /
  AGP 8.7.2 需要 JDK 17+。本机只有 1.8 / 16.0.2 / 19.0.1，**没有 JDK 21**。
- `ANDROID_HOME=D:\Android SDK`（已装 android-34 与 android-35）。
- vite build 的 emptyOutDir 会触发 safe-delete 守卫 → 加 `CODEBUDDY_SAFE_DELETE_ENABLED=0`。

## Android / Capacitor 配置（来之不易，勿随意改）
- `variables.gradle`：`compileSdkVersion=35`、**`targetSdkVersion=34`**（避免 Android 15 行为变更）、
  `minSdkVersion=23`、`androidxCoreVersion=1.13.1`。
  - androidx.core 1.15.0 要求 compileSdk 35；**1.14.0 根本不存在**（版本线 1.13.1 → 1.15.0）。
- **Capacitor 7.6.9 硬性要求 compileSdk 35**：其 Java 源码用了 API 35 符号
  （`VANILLA_ICE_CREAM`、`windowOptOutEdgeToEdgeEnforcement`）。**不要降回 34**。
- 根 `android/build.gradle` 有 `subprojects.afterEvaluate` 强制 `compileOptions` = **Java 17**：
  Capacitor 生成的 `app/capacitor.build.gradle` 硬编码 Java 21，且每次 `cap sync` 重新生成
  （文件标注 DO NOT EDIT），不能直接改，只能这样覆盖。
- 根 `android/build.gradle` 还有 `resolutionStrategy.force` 锁 `androidx.core:core` 与
  `core-ktx` = 1.13.1（core-ktx 是 appcompat 的传递依赖，只改变量锁不住）。
- **`capacitor.config.ts` 必须保留 `android: { allowMixedContent: true }`（勿删）**：
  App 页面 origin = `https://localhost`（`server.androidScheme:'https'`），而内容更新源是局域网
  `http://192.168.x.x:8080`（明文）。若 `allowMixedContent` 为默认 `false`，Capacitor 从不调用
  `WebView.setMixedContentMode(ALWAYS_ALLOW)`（见 `Bridge.java:598` / `CapConfig.java:46`），
  WebView 默认 `MIXED_CONTENT_NEVER_ALLOW` → 拦断 `fetch` → App 报
  **「无法连接更新源（Failed to fetch）」**（`contentUpdater.ts` 的包装文案）。
  ⚠️ `AndroidManifest.xml` 的 `usesCleartextTraffic="true"` 是**系统网络栈**那道门，
  **不能**打开 WebView 混合内容开关（两道独立的门）。浏览器能开是因为"顶层导航"不算混合内容。

## 内容格式坑（lint 触发）
- **YAML 列表项（如 frontmatter 的 keyPoints / summary 折叠下的 `-` 项）绝不能用引号开头**：`- "宁做…"` / `- “转形问题”…` 会被 YAML 当作未闭合引号标量 → parse 失败。开头去引号即可（引号放句中无碍）。
- `summary:` 用 `>-` 折叠标量时按**去换行去空格的纯字符串**计，须 ≥80 字，否则 lint 报错。
- categories 用「标题路径」引用 taxonomy（如 `科学/人类认知与心理`、`经济学/金融/货币与银行`），改 taxonomy 节点标题会破坏旧词条。

## 内容投递约定（最大的坑）
- `packages/core` / `packages/cli` 内部仍产出 **`.index/`**（builder 的 `files['.index/...']`
  键被 47 个 core 单测断言，**不要改**）。
- 但 `.index` 这类**带前导点的目录**会被丢弃**两次**：①Capacitor 的 `cap sync`（dot:false glob）
  ②AGP 的 `MergeAssets`。实测打补丁（gradle 重新注入）无效——文件进了源 assets 目录，
  合并产物里依然没有。**必须改名，不能绕。**
- 所以在 `scripts/copy-content.mjs` 搬运时重命名 **`.index` → `index`**；web 端
  `loader.ts` / `content.ts` 按 `index/...` 读取。改名只发生在投递边界，core 测试零改动。

## 依赖解析：`@pks/core` 靠手工 junction（勿 reinstall / 勿 ln -s）
- `apps/web/package.json` 里 `@pks/core` 声明为 **`"workspace:*"`**（pnpm/yarn 协议）。
  **npm 无法解析该协议** → 绝对不要跑 `npm install` / `pnpm install` / `prune`，
  否则 node_modules 被重建、workspace 链接丢失 → 构建直接断。依赖已装好，勿动。
- `@pks/core` 实际解析靠**手工 junction**：
  `apps/web/node_modules/@pks/core` → `D:/WorkBuddy--Knowledge/packages/core`
- ⚠️ **重建时必须用 `junction`，不能用 Git Bash 的 `ln -s`**：`ln -s` 在 Windows 生成
  0 字节文件型符号链接，Node 模块解析遍历不了（报 MODULE_NOT_FOUND）。正确方式：
  ```js
  require('fs').symlinkSync('D:/WorkBuddy--Knowledge/packages/core',
                            'D:/WorkBuddy--Knowledge/apps/web/node_modules/@pks/core',
                            'junction')
  ```
- **web 消费的是 core 的 `dist`，不是 src**：`packages/core/package.json` 的 main/exports
  指向 `./dist/index.js`。改了 `packages/core/src/**` 必须重编 core
  （`node ../../node_modules/typescript/bin/tsc -p tsconfig.json`，在 packages/core 下执行），
  否则 web build / APK **静默用旧 dist**。

## 构建流程（顺序不能乱）
```
build:index              # CLI 产出 content/.index/（勿用 pnpm，走 CLI/npm）
# 若改过 packages/core/src，先重编 core 产出 dist（见上节）
npm run copy:content     # content/ -> public/content/（.index 改名 index）
npm run build            # vite：public -> dist
npm run cap -- sync android  # dist -> android assets
gradlew assembleDebug --no-daemon
```
改前端后必须按此顺序重跑，否则 APK 里还是旧资源。
APK 产物：`apps/web/android/app/build/outputs/apk/debug/app-debug.apk`
`.gitignore` 已忽略 `apps/web/dist/`、`apps/web/android/`。

## 内容新增 & 交付（CLI 勿用 pnpm）
- 新增词条 = `content/entries/<slug>/` 下放 `entry.md`（作品级）+ `chapters/ch-NN.md`。
  `slug` 须匹配 `^[a-z0-9]+(-[a-z0-9]+)*$`；`categories` 必须**精确等于** taxonomy 的标题路径。
- CLI 直接跑 tsx（**不要用根 package.json 的 pnpm 脚本**，其仍写 apps/reader）：
  `./node_modules/.bin/tsx packages/cli/src/index.ts lint`（先 lint）
  `./node_modules/.bin/tsx packages/cli/src/index.ts build:index`
- 交付两套更新物（内容 = 数据，**改内容不必重打包**，但换 UI/代码才要）：
  ```bash
  node scripts/copy-content.mjs                      # 在 apps/web 下（或 npm run copy:content）
  CODEBUDDY_SAFE_DELETE_ENABLED=0 npm run build       # vite
  node scripts/build-update.mjs                       # → release/latest/（App 内 OTA 包）
  npm run android:sync && (cd android && JAVA_HOME=/d/JDK/jdk-19.0.1 ANDROID_HOME="D:/Android SDK" ./gradlew assembleDebug --no-daemon)
  ```
- OTA 自测：`node scripts/serve-lan.mjs`（默认托管 release/latest:8080）→ App「我的→内容更新」
  填 `http://<PC-IP>:8080/` → 检查更新 → 下载 → 重新加载。
- **APK 增量构建后必须验真**：`:app:packageDebug` 执行不代表资源更新，需
  `unzip -p <apk> assets/public/content/index/manifest.json` 核对 entries/built_at。

## 时间线（Track）机制（前端零改动自动出现）
- `content/tracks/*.yaml` → `build:index` → `index/tracks.json`。前端 `AppShell.tsx`（顶部导航）、
  `TimelinePage.tsx`（`/timeline` 列表）、`Home.tsx` **动态遍历全部 track**，**新增轨道无需改代码**。
- 字段：`id/title/category/order_mode/timeline/description/items[]`；item：
  `order`(字符串)/`entry`(slug)/`sort_date`(number, 公元前取负)/`date_label`/`era`/`note`/`cross_timeline`。
  `order_mode` 仅允许 `chronological|difficulty|dependency|school_then_chronological`。
- **`timeline` 字段只接受 `world|china`**；且 `Home.tsx` 只统计 `timeline` 为 china/world 的轨道
  来算"中国史/世界史"数量 → **跨领域新轨（哲学史/科技史/跨领域对照）不要设 `timeline`**，否则污染首页计数。
- **lint L005**：检查的是**词条自身 frontmatter 的 `timeline` 维度**（需 ≥2），不是轨道；
  若某词条在轨里标了 `cross_timeline: true` 但其 frontmatter `timeline` 只有 1 维 → 报 warn
  「cross_timeline 但 timeline 维度 <2」。**跨领域新轨一律不标 `cross_timeline`** 即 0/0。
- 现有 5 轨：`history-china`(11) / `history-world`(15) / `philosophy-history`(16) /
  `tech-history`(14) / `civilization-cross`(25，跨领域对照)。
- 已新增大类 `技术`（L1，order 6）与节点 `哲学/西方哲学/中世纪哲学`（id `west-medieval`）。
- 新增词条（11）：`plato`、`aristotle`、`scholasticism`、`descartes`、`kant`、`hegel`、
  `euclidean-geometry`、`printing-press`、`steam-engine`、`computer`、`internet`。

## 阅读页章节导航语义 & 质量巡检经验（2026-09-10）
- **`#/entry-reader/{slug}?ch=<N>` 的 N = 阅读页 `docs` 数组下标**：
  `docs[0]` 是「导读」，其后为 `flattenChapterList(toc).filter(kind !== 'container')`。
  **container（卷）不单独成页**。故 `EntryCoverPage` 传 `ch` 时必须**按内容章节计数**
  （`chapterRows` + running `docIndex`），**不能**直接用 `i+1`——若 toc 有「卷」会错位。
- **死代码诊断技巧（只诊断，勿改配置）**：
  `tsc -p <pkg>/tsconfig.json --noEmit --noUnusedLocals --noUnusedParameters`
  一次性列出未使用 import/局部变量。⚠️ 该开关在 `tsconfig.base.json` 是**刻意关闭**的，
  只用于临时诊断，**改了会破坏构建**。
- **Edit 工具坑**：同一条消息里对**同一文件**发多个 Edits，出现过「部分生效、部分静默未落盘」。
  **改完必须回读 / `grep` 校验**；发现缺失就逐文件单独重发。
- 校验命令：`npm run typecheck`（core+cli+web）、`npm run test`（vitest，仅 core，当前 135 过）、
  `npm run lint`（内容 0/0）；web 构建 `CODEBUDDY_SAFE_DELETE_ENABLED=0 npm --prefix apps/web run build`。
- **`setBackInterceptor` 并非死代码**（曾误记）：`EntryReaderPage` 注册它，`handleNativeBack`
  第 1 步消费（浮层优先）；`App.tsx` 装 `installNativeBackHandler`，`MainActivity` 调
  `window.__pksHandleBack`，链路完整。
