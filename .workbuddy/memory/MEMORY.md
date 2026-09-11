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
- **首页 V7 类目导航收敛**（`75b1d70`，2026-09-11）：**首页不再有独立类目树**（`.home-tree`/l2-*/l3-* 样式已全删）——L1 卡片（`<a class="l1-card">` 直达 `#/browse/:id`）；BrowsePage 标题下新增「子类目」网格（`.browse-sub-card`，数据=`node.children`+`categoryCounts`）承接下钻，下方仍列该类目含子孙全部词条。新增 L1 无配色走 L1_FALLBACK 灰（如「技术」）。同文件多处 Edit 严禁并行发（会静默漏写，须逐条顺序+grep 复核）。
- **2000万字优化：P0-I/II/III 全部完成**（`5a5679d` / `7fc773a` / P0-III）。core 本已实现 BM25/LRU/PartitionLoader/varint/SearchEngine，web 已接线 contentCache；P0-IV/V 等效覆盖。拒绝 Tantivy-wasm/Meilisearch/DuckDB-wasm。
- **P0-I**：分片仍是 JSON 文本，倒排内嵌 `postings`=base64(varint 差分+fflate zlib)（`core/index/shard-codec.ts`）；旧内联 `index` 兼容。**格式消费点 3 处须同步**：`web/lib/loader.ts`、`cli/src/load-index.ts`、`builder.ts`。13.3MB→1.42MB。
- **P0-III**：`web/lib/{search.worker,searchWorkerClient,searchWorkerProtocol}.ts`。主线程只 fetch 文本（`fetchShardText` 缓存+并发去重），worker 解码+BM25+分组；`fullTextSearch` worker 优先+主线程兜底（**永久降级开关**）；探针 `window.__pksSearchViaWorker`。
- **`@pks/core` 已加 `"sideEffects": false`**（core 零模块级副作用）：根治 worker 经 barrel 带入 markdown 链的 `document.createElement` 崩溃，worker chunk 222KB→8.45KB；`workerDocumentShim.ts` 留作 dev 兜底。
- **e2e**：`node scripts/tools/e2e-search-worker.mjs`（零依赖 headless Chrome+CDP）10 断言，含 `window.Worker=undefined` 降级安全网。
- **阅读器「番茄小说」风重构**（`275605a` 第1步 / `917304c` 第2步 / `b14e900` review 修正）：`ReaderPrefs.fontSize` 改**数值 px**(12–30,默认18；`SysPrefs.fontSize` 仍枚举)；`BgColorPref` 7 色(默认 sepia `#F5F1E6`)；新增 `showProgress`；`statusbarPermanent` 默认改 **true**；行高 1.8。阅读区无投影 / 3 等分导航栏 + 常驻信息条(进度+时钟+电量)；设置面板白底 20px / 7 色板 / 翻页胶囊(专属 `reader-pills-tone` 作用域，**勿改全局 `.reader-pill`**) / 间距子层(5 档含自定义滑块+智能匹配+对齐) / 更多子层(**严格 3 开关**)。划词浮层**固定深色 `#333`**(操作栏 8px/卡片 12px)；**`::selection` 仅阅读区 `#E8D3A2`，全站默认仍陶土橙**。e2e：`scripts/tools/e2e-reader-refactor.mjs`（**52 断言**，headless Chrome+CDP，**默认自动选空闲端口**——固定端口会被残留 Chrome 占用导致假失败）。
- **设置面板互斥下钻 + 底栏番茄风**（`40fb715` / `5b30328`，2026-09-10/11）：面板四态(font/spacing/more/settings)存 `EntryReaderPage`，开任一必关其余（Portal 面板互斥靠 state 不靠 CSS）；`reader-no-statusbar` 须同时挂 `.reader-root` **和 body**（Portal 面板在 body 子树，否则关信息条后面板不跟沉）；**`--reader-nav-h` 必须在 `.reader-root, body` 上计算、不能放 `:root`**（CSS 变量在声明处替换后按计算值继承，`:root` 会把 statusbar-h=30px 烤进 nav-h → 关信息条后章节条/面板不下沉、裂 30px 露正文；凡子作用域覆写变量参与 calc 的，calc 须放同一作用域，`07472ce`）。切章滚隐竞态：`scrollTo(0)` 的异步 scroll 事件会晚于 `setChromeDismissed(false)` 触发 hideChrome → `chromeSuppressRef` 抑制 + 新章 load 后复位 + onSurfaceClick 唤起时强制清 dismissed。**底部 chrome（章节条/导航栏/信息条）一律实色 `var(--reading-bg)`**——半透明 `--reader-chrome-bg` 会透字（用户红框反馈），勿改回。底栏图标=番茄风细线 SVG(strokeWidth 1.5)：目录三横线/线框月牙/六角螺母，Tab 无竖线分隔，色用 `var(--rp-soft)`。`ReaderPrefs.autoLoad` 默认 **false**（「自动翻页」开关）。翻页胶囊无「无动画」(4 档)。**番茄参考图底栏有第 4 Tab 待用户定功能**（缓存/更多？），勿擅自加。
