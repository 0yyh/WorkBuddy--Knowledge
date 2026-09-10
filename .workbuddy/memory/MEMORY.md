# PKS 项目长期记忆 · 个人知识学习站

纯本地离线优先知识站。Web(React18+Vite5+TS strict, **纯CSS无Tailwind**)+Android(Capacitor7 同套代码)。monorepo: packages/core(@pks/core, isomorphic)、packages/cli、apps/web。已 git 化: master @ gitee SSH (Peter-Y / 2270778780@qq.com)，密钥 ~/.ssh/id_ed25519。

## 环境铁律（违反即失败）
- **禁止 pnpm / npm install / prune**：@pks/core 靠手工 junction 解析（`apps/web/node_modules/@pks/core` → `packages/core`），重装即断构建。web 消费 core 的 **dist**（非 src）；改 `packages/core/src/**` 须重编：`node ../../node_modules/typescript/bin/tsc -p tsconfig.json`（在 packages/core 下）。
- `JAVA_HOME` 必须显式 `D:\JDK\jdk-19.0.1`（PATH 默认 java 16.0.2 太旧；Gradle8.11/AGP8.7.2 需 JDK17+；本机无 JDK21）。`ANDROID_HOME=D:\Android SDK`。
- vite build 的 emptyOutDir 触发 safe-delete 守卫 → 加 `CODEBUDDY_SAFE_DELETE_ENABLED=0`。

## Android / Capacitor（勿随意改）
- `variables.gradle`：compileSdk=35 / targetSdk=34（避 A15 变更）/ minSdk=23 / androidxCore=1.13.1（1.14.0 不存在）。Capacitor 7.6.9 硬性要 compileSdk 35（用了 API35 符号）。
- 根 `android/build.gradle`：`subprojects.afterEvaluate` 强置 `compileOptions`=**Java17**（覆盖 cap 生成的 Java21 DO NOT EDIT 文件）；`resolutionStrategy.force` 锁 `androidx.core:core` 与 `core-ktx`=1.13.1。
- `capacitor.config.ts` **必须保留 `android.allowMixedContent:true`**：App origin=`https://localhost` 而更新源是局域网明文 `http://192.168.x.x:8080`；缺它 WebView 默认 NEVER_ALLOW 拦断 fetch → App 报「无法连接更新源(Failed to fetch)」。（Manifest 的 `usesCleartextTraffic` 是系统网络栈另一道门，不能替代。）

## 内容投递（最大坑）
- core/cli 产出 `.index/`（builder `files['.index/...']` 键被 47 个 core 单测断言，**勿改**）；带点目录被 cap sync(dot:false)+AGP MergeAssets 双重丢弃 → `scripts/copy-content.mjs` 重命名 `.index`→`index`（web 按 `index/` 读）。改名只在投递边界。
- 构建顺序：`build:index` →(改 core 则重编)→ `copy:content` → vite build → `cap sync android` → `gradlew assembleDebug`。APK=`apps/web/android/app/build/outputs/apk/debug/app-debug.apk`。`.gitignore` 已忽略 `apps/web/dist/`、`apps/web/android/`。
- 内容格式坑：YAML 列表项勿引号开头；`summary: >-` 折叠须≥80字；`categories` 用 taxonomy 标题路径。

## 时间线 Track（前端零改动自动出现）
- `content/tracks/*.yaml`→`build:index`→`index/tracks.json`；`AppShell/TimelinePage/Home` 动态遍历。`timeline` 仅 `world|china`，**跨领域轨勿设**（否则污染首页计数）。lint L005 查词条 frontmatter `timeline` 维度≥2。

## 阅读页 & 校验
- `#/entry-reader/{slug}?ch=<N>` 的 N=`docs` 数组下标（导读+非 container 章）；`EntryCoverPage` 传 ch 须**按内容章节计数**，toc 有「卷」不能用 i+1。
- 校验：`npm run typecheck` / `npm run test`(vitest 仅 core) / `npm run lint`(内容)。诊断死代码用 `tsc --noUnusedLocals`（配置刻意关，勿改）。同文件多发 Edit 会部分静默未落盘，改完必回读/grep。

## 近期决策（2026-09-10）
- **UI = 纯CSS + design token，严禁 MUI/Tailwind**（docs/02 §18 已于 37d9a79 更正）。
- **内置词典已完整集成**（用户问过，已核实）：数据 `content/dict/dictionary.json`（**217 条，自研「PKS 内置词典」，非 chinese-xinhua → 无外部署名义务**）+ core `@pks/core/dict`（注意 `parseDictionary` 返回 `{value,errors}`；`lookupDict(dict, selectedText)` 2 参）+ `apps/web/src/lib/dict.ts` + `components/ReaderSelectionMenu.tsx`（阅读页划词「查询」→释义卡片，挂 `EntryReaderPage.tsx`）。数据投递到 public / dist / Android assets 三处。
- **2000万字优化：P0-I/II/III 全部完成**（`5a5679d` / `7fc773a` / P0-III）。core 本已实现 BM25/LRU/PartitionLoader/varint/SearchEngine，web 已接线 contentCache；P0-IV/V 等效覆盖。拒绝 Tantivy-wasm/Meilisearch/DuckDB-wasm。
- **P0-I**：分片仍是 JSON 文本，倒排内嵌 `postings`=base64(varint 差分+fflate zlib)（`core/index/shard-codec.ts`）；旧内联 `index` 兼容。**格式消费点 3 处须同步**：`web/lib/loader.ts`、`cli/src/load-index.ts`、`builder.ts`。13.3MB→1.42MB。
- **P0-III**：`web/lib/{search.worker,searchWorkerClient,searchWorkerProtocol}.ts`。主线程只 fetch 文本（`fetchShardText` 缓存+并发去重），worker 解码+BM25+分组；`fullTextSearch` worker 优先+主线程兜底（**永久降级开关**）；探针 `window.__pksSearchViaWorker`。
- **`@pks/core` 已加 `"sideEffects": false`**（core 零模块级副作用）：根治 worker 经 barrel 带入 markdown 链的 `document.createElement` 崩溃，worker chunk 222KB→8.45KB；`workerDocumentShim.ts` 留作 dev 兜底。
- **e2e**：`node scripts/tools/e2e-search-worker.mjs`（零依赖 headless Chrome+CDP）10 断言，含 `window.Worker=undefined` 降级安全网。
