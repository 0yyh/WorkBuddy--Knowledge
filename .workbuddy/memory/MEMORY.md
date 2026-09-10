# PKS 项目长期记忆 · 个人知识学习站

纯本地离线优先知识站。Web(React18+Vite5+TS strict, **纯CSS无Tailwind**)+Android(Capacitor7，同套代码)。monorepo: packages/core(@pks/core, isomorphic)、packages/cli、apps/web。已git化: master @ gitee SSH (Peter-Y / 2270778780@qq.com)，密钥 ~/.ssh/id_ed25519。

## 环境铁律（违反即失败）
- **禁止 pnpm / npm install / prune**：@pks/core 靠手工 junction 解析（`apps/web/node_modules/@pks/core` → `packages/core`），重装会断链接→构建断。web 消费 core 的 **dist**（非 src）；改 `packages/core/src/**` 须重编：`node ../../node_modules/typescript/bin/tsc -p tsconfig.json`（在 packages/core 下）。
- `JAVA_HOME` 必须显式 `D:\JDK\jdk-19.0.1`（PATH 默认 java 16.0.2 太旧；Gradle8.11/AGP8.7.2 需 JDK17+；本机无 JDK21）。`ANDROID_HOME=D:\Android SDK`。
- vite build 的 emptyOutDir 触发 safe-delete 守卫 → 加 `CODEBUDDY_SAFE_DELETE_ENABLED=0`。

## Android / Capacitor（勿随意改）
- `variables.gradle`：`compileSdk=35`、`targetSdk=34`（避 Android15 变更）、`minSdk=23`、`androidxCore=1.13.1`（1.14.0 不存在，线 1.13.1→1.15.0）。Capacitor 7.6.9 硬性要 compileSdk 35（用了 API35 符号）。
- 根 `android/build.gradle`：`subprojects.afterEvaluate` 强置 `compileOptions`=**Java17**（覆盖 cap 生成的 Java21 DO NOT EDIT 文件）；`resolutionStrategy.force` 锁 `androidx.core:core` 与 `core-ktx`=1.13.1。
- `capacitor.config.ts` **必须保留 `android.allowMixedContent:true`**：App 页 origin=`https://localhost`，更新源=局域网 `http://192.168.x.x:8080` 明文；缺它 WebView `MIXED_CONTENT_NEVER_ALLOW` 拦断 fetch → App 报「无法连接更新源(Failed to fetch)」。`AndroidManifest` 的 `usesCleartextTraffic` 是系统网络栈另一道门，不能替代。

## 内容投递（最大坑）
- core/cli 产出 `.index/`（builder `files['.index/...']` 键被 47 个 core 单测断言，**勿改**）。但带点目录被 cap sync(dot:false) + AGP MergeAssets 双重丢弃 → `scripts/copy-content.mjs` 重命名 `.index`→`index`；web `loader.ts`/`content.ts` 按 `index/` 读。改名只在投递边界。
- 构建顺序：`build:index` → (改core则重编) → `copy:content` → vite build → `cap sync android` → `gradlew assembleDebug`。APK=`apps/web/android/app/build/outputs/apk/debug/app-debug.apk`。`.gitignore` 已忽略 `apps/web/dist/`、`apps/web/android/`。
- 内容格式坑：YAML 列表项勿引号开头；`summary: >-` 折叠须≥80字；`categories` 用 taxonomy 标题路径。

## 时间线 Track（前端零改动自动出现）
- `content/tracks/*.yaml`→`build:index`→`index/tracks.json`；`AppShell.tsx`/`TimelinePage.tsx`/`Home.tsx` 动态遍历。`timeline` 仅 `world|china`，**跨领域轨勿设**否则污染首页中国史/世界史计数**。lint L005 查词条 frontmatter `timeline` 维度≥2（跨领域轨勿标 `cross_timeline`）。

## 阅读页 & 校验
- `#/entry-reader/{slug}?ch=<N>` 的 N=`docs` 数组下标（导读+非container章）；`EntryCoverPage` 传 ch 须**按内容章节计数**，toc 有「卷」不能用 i+1。
- 校验：`npm run typecheck`(core+cli+web) / `npm run test`(vitest, 仅core) / `npm run lint`(内容)。诊断死代码用 `tsc --noUnusedLocals`（配置刻意关，勿改）。同文件多发 Edit 会部分静默未落盘，改完必回读/grep 校验。

## 近期决策（2026-09-10）
- **C1/C2 UI = 纯CSS + design token，严禁 MUI/Tailwind**。docs/02 §18 误写「MUI+Tailwind」，需更正为纯CSS+token方案。
- **内置词典**：`chinese-xinhua`(MIT, ©2018 PWXCOO) 可作数据源；build-step 归一化→`content/dict/dictionary.json`，排除完整 264k `ci`（仅取 idiom+word+精选ci）；须随包 LICENSE+署名。评估见 `docs/reports/词典数据源评估-chinese-xinhua-2026-09-10.md`。
- **2000万字优化**：docs/02 §18 蓝图**大部分已落地**（读码确认）。core 已实现 BM25/LRU/PartitionLoader(IndexedDB+LRU)/varint/inverted(SearchEngine L1+L2)/shards；web 已接线 `SearchEngine`+惰性分片加载+`warmSearchShards` 预热+`contentCache`(IndexedDB) 持久化；离线词典已完整落地（`content/dict/dictionary.json`+`@pks/core/dict`+`lib/dict.ts`）。**剩 P0-I 索引二进制化 / P0-II 全局BM25（已完成, commit 7fc773a）/ P0-III 检索移 Web Worker**；P0-IV(PartitionLoader 接线)/P0-V(OPFS) 已由 web loader+contentCache(IndexedDB) 等效覆盖。拒绝 Tantivy-wasm/Meilisearch/MiniSearch/DuckDB-wasm（体积/离线不符）。
