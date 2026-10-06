# PKS 知识学习站 · 架构与选型系统评估（刷新版 · 2026-10-01）

**评估人**：高见远（架构师）　**基线**：对齐 `docs/project-evaluation-2026-09-23.md` 并刷新　**方法**：实地核查 `packages/core`、`packages/cli`、`apps/web`、`apps/web/android`、`content/`、`scripts/`、`.gitee/` 与关键源码（非印象）

> 范围聚焦主理人指定的三维度：**① 整体架构与目录结构　② 技术栈选型与适用性匹配度　③ 项目内容与业务功能完整性及实现质量**。每处「问题」均引用可定位的文件/模块/代码现象；每处「解决方案」给出改哪个文件、怎么做、优先级与可量化预期收益。

---

## TL;DR

**总评**：PKS 在「内容质量、索引/检索架构、生成管线、CI、性能优化」上已相当成熟，是一份工程纪律很好的作品；当前真正阻碍它从「个人精修站」走向「可协作/可规模化/可分发」的，是**三个本地化短板**——Web 端离线能力名不副实（无 PWA）、Web/Android 构建与机器环境强耦合、以及内容类目引用键与展示名未解耦。

**最该优先做的 3 件事**：
1. **补 Web 端 PWA / Service Worker**（TS-1，P1）——让「离线优先」名副其实，桌面/移动浏览器真离线，而不只靠 APK。
2. **解耦 Web/Android 构建 + 去除 JDK/SDK 硬编码**（AR-2，P1）——解除机器锁（R2），让 APK 可在换机/CI 构建。
3. **内容类目引用键由中文 title 改为稳定 id 链**（CT-1，P2 但趁早定规范）——为内容持续演进松绑，避免未来改名即断链。

**本次刷新已闭环（对比 2026-09-23 评估，确认不再排期）**：
- A2 最小化 CI ✅（`.gitee/workflows/ci.yml` + `pnpm run ci`，lint+typecheck+单测，Linux 上 `pnpm install --frozen-lockfile` 跑通，证明 pnpm workspace 本身可用）
- A3 生成管线生产化 ✅（`packages/cli/src/gen/runner.ts` 成熟 + `packages/cli/test/{pipeline,providers,parse-output}.test.ts`）
- A4 检索链 barrel 隔离 ✅（`packages/core/package.json` 已声明 `./search`/`./dict`/`./node`/`./build` 子路径导出，`apps/web/src/lib/loader.ts` 走 `@pks/core/search`）
- T1 样式体系 ✅（`apps/web/src/styles/tokens.css` 已是完整 design tokens 且全站消费）
- T4 Context 拆分 ✅（`apps/web/src/state/AppContext.tsx` 已拆 DataContext/StatusContext/ActionsContext + 3 个 selector hook）
- T5 检索召回增强 ✅（`packages/core/src/index/fuzzy.ts` + `expandQueryFuzzy`，零命中才模糊扩展）
- C2/C3 内容域均衡 ✅（2026-10-01：598 词条 / 2947 章 / 约 509 万字；文学40/艺术40/科学90/技术64/宗教25/语言学20/法学20 + 原有 5 类，已达 `docs/content-blueprint.md` 阶段一目标）
- C4 tracks 补齐 ✅（`content/tracks/` 8 个 yaml：history-china/world、philosophy、science、tech-history、economics、politics、civilization-cross）
- B2 发布签名脚手架 ✅、B3 分发文档 ✅、R3 规模化压测 ✅（`scripts/bench_scale.mjs`）、R4 事实核查 lint（L010）✅

---

## 维度一：整体架构与目录结构

### 架构现状（先写实）
- monorepo：`pnpm-workspace.yaml` 声明 `packages/*` + `apps/*`；4 个包：`@pks/core`（同构核心）、`@pks/cli`（内容工具链）、`@pks/web`（阅读端/构建入口）、`apps/web/android`（Capacitor7 工程）。
- **core 同构边界清晰**：主 barrel `packages/core/src/index.ts` 不依赖 `node:*`，Node 能力隔离在 `@pks/core/node`（VFS）与 `@pks/core/build`（索引落盘），Web 端经 `@pks/core/search`、`@pks/core/dict` 子路径按需引入。这是高质量设计。
- **数据驱动内容**：`content/taxonomy.yaml` + `content/tracks/*.yaml` + `content/entries/**` → CLI `build:index` → `apps/web/public/content/` 静态资源；Web 端全部 `fetch` 静态 JSON（秒开三件套 + 惰性分片）。内容与代码彻底分离。
- **构建产物不入库**：`.gitignore` 已正确忽略 `dist/`、`apps/web/dist/`、`content/.index/`、`public/content`、`android/**/build/`、`assets/public`、`local.properties`——目录卫生良好（曾因安卓 gradle 配置丢失而修正过，见 `.gitignore` 注释）。

### 问题清单（问题—影响—解决方案）

#### AR-1　`@pks/core` 解析仍依赖 Windows 本地手工 junction（A1 续）
- **问题**：`apps/web/node_modules/@pks/core` 与 `packages/cli/node_modules/@pks/core` 是手工文件系统链接（`scripts/check-links.mjs`、`docs/14-重构引用路径台账与回归验证基线.md` §3 Top7）。链接目标写成 POSIX 形式 `/d/WorkBuddy--Knowledge/packages/core`（由 Git Bash `ln -s` 创建），**非 Windows 原生 junction**；跨工具链（PowerShell/CMD/不同 mingw）解析可能失败。约束「禁 `npm install`」是 Windows 本地铁律，但 `.gitee/workflows/ci.yml` 在 Linux 上跑 `pnpm install --frozen-lockfile` 已证明 **pnpm workspace 本身完全可用**——即 junction 只是本地绕行，不是架构必需。
- **影响**：新 Windows 机器接入 / 误跑 `npm install` → web 构建拉不到 core dist 即崩；且本地「机器锁定」使协作与 CI 之外的复现脆弱。
- **解决方案**：
  - **（推荐·尊重现有铁律）** 在 `scripts/setup-env.mjs` 第 4 步把链接重建从 `symlinkSync(CORE_DIR, link, 'junction')` 改为优先用 `cmd /c mklink /J`（原生 Windows junction，跨工具链稳定），并对 POSIX 软链做兼容检测；同时把第 38 行硬编码的 `node_modules/.pnpm/typescript@5.9.3/.../tsc` 改为**动态探测**（`glob node_modules/.pnpm/typescript@*/node_modules/typescript/bin/tsc` 或 `npx tsc`），避免版本号写死后失效。
  - **（候选·若本地 pnpm 验证可用）** 直接改用 `pnpm install` 作为主路径（删 junction），`contributing.md` 改为「推荐 pnpm install；junction 仅作无 pnpm 时的兜底」。CI 已证此路可行。
  - 优先级 **P1**。预期收益：新机接入 10min→<5min；消除「重装即断」；junction 跨工具链解析失败归零。

#### AR-2　Web 与 Android 构建强耦合 + JDK/SDK 路径硬编码（B1 / R2 续）
- **问题**：`apps/web` 同时是 Web 构建入口与 Capacitor 宿主（`apps/web/android`）。vite `build` 产出 `dist/` 后需手工 `cp -r`（原生，禁 node fs，因 recycle-bin shim）到 `apps/web/android/app/src/main/assets/public`。`apps/web/android` 的 gradle 链硬编码 `JAVA_HOME=D:\JDK\jdk-19.0.1`、`ANDROID_HOME=D:\Android SDK`（见 `docs/14` 与 `scripts/setup-env.mjs` 期望路径）。出 APK 须串两条链且状态手动对齐（`CODEBUDDY_SAFE_DELETE_ENABLED=0`）。
- **影响**：换机 / CI 构建 APK 失败（路径不存在即假失败）；构建步骤多易错（R2 机器锁）。
- **解决方案**：在 `scripts/build-apk.mjs`（已串成 `npm run apk`）中把 JDK/SDK 改为**读环境变量，缺省回退约定路径并告警**（复用 `setup-env.mjs` 的检测逻辑）；`gradle.properties` 经 `local.properties`（`sdk.dir`）注入而非硬编码；把 `cp -r` 同步做成幂等 + 校验 `assets/public/content/manifest.json` 存在（`packages/cli/test` 已有 apkanalyzer 思路可补）。优先级 **P1**。预期收益：任意装好 JDK/SDK 的机器可一键出 APK；APK 构建纳入可复现流程。

#### AR-3　构建/治理脚本散落（B4 续）
- **问题**：根目录 `scripts_*.mjs`（`scripts_build`/`scripts_census_*`/`scripts_eval_census`/`scripts_full_audit`/`scripts_lint`/`scripts_plan_batches`/`scripts_sync_android_assets`）与 `scripts/`（build-apk/build-update/serve-lan/check-links/bump-version/copy-content/setup-env/bench_scale）并存，命名风格不一、职责重叠。
- **影响**：维护心智负担；新人不知跑哪个；`package.json` scripts 只暴露了 `scripts/` 部分，根 `scripts_*.mjs` 易成孤儿。
- **解决方案**：把根 `scripts_*.mjs` 收口进 `scripts/`（去 `scripts_` 前缀，按 `census/`、`audit/`、`lint/`、`android/` 分组），统一在根 `package.json` `scripts` 暴露并补 README 索引。优先级 **P2**。预期收益：维护心智负担下降；命令可发现性提升；零功能风险。

#### AR-4　core 主 barrel 的检索兼容 shim 待清理（小幅技术债）
- **问题**：`packages/core/src/index.ts` 第 50–77 行仍把 `SearchEngine/shard-codef/...` 等 8+ 导出「再 export 保留到 2026-12」作兼容；这是为 web 迁移 `@pks/core/search` 留的过渡，有删除截止日。
- **影响**：过渡期双导出，未来删除时需全仓 grep 确认无旧引用；属可控技术债。
- **解决方案**：2026-12 前全局 `grep "from '@pks/core'" | SearchEngine` 核对，确认仅 `@pks/core/search` 引用后删主 barrel 的兼容导出；在 `contributing.md` 固化「改 core 后必须重编 core（`core:build`）且清 vite cache」步骤。优先级 **P3**。预期收益：消除双真相、明确契约。

---

## 维度二：技术栈选型与其适用性的匹配度

### 正向结论（沿用并确认 2026-09-23）
React18 + Vite5 + **TS `strict:true`** + 同构 `@pks/core`（node:fs 隔离在 `/node`/`/build`）+ **Web Worker 检索**（主线程兜底、能力探测、永久降级）选型合理，应保持不变。bundle 切分到位：`index 14.63KB / vendor-core 298.99KB / vendor-markdown 115.53KB / reader 76.66KB / search.worker 9.43KB`（`vite.config.ts` `manualChunks` 把 markdown 链独立、阅读页独立、core 常驻）。

### 问题清单（问题—影响—解决方案）

#### TS-1　Web 端「离线优先」名不副实——无 Service Worker / PWA（T2 续，★最该做）
- **问题**：`apps/web/vite.config.ts` 无 `vite-plugin-pwa` 或任何 SW 插件；全仓 grep `serviceWorker`/`registerSW` 仅命中 2026-09-23 评估文档本身，源码无任何注册。桌面浏览器刷新/断网后无法打开应用（静态资源 404），离线仅限 APK 资产内置。
- **影响**：产品定位「纯本地、离线优先」在 Web 端不成立；桌面用户断网即不可用；与 APK 体验割裂。
- **解决方案**：
  - 引入 `vite-plugin-pwa`（或手写最小 SW）：`precache` 应用壳（`index.html` + `index-*.js` + `vendor-*` + `reader` + `search.worker` + `tokens.css`），`runtime cache` 走 `content/` 静态资源（`stale-while-revalidate`）。
  - **关键协调点**：`apps/web/src/lib/contentUpdater.ts` 已用 **IndexedDB** 做 OTA 内容缓存（与 SW 不冲突——SW 管「代码壳」、IDB 管「内容」）。但 SW 的 `content/` runtime cache 与 OTA 激活需对齐：OTA 更新后建议 `SW.update()` + 提示重载，避免 SW 缓存旧壳。
  - 注意 `base: './'` 下 SW `scope` 在 Capacitor 受限，Web 端 `scope` 设为仓库根即可。
  - 优先级 **P1**。预期收益：桌面/移动浏览器真离线（断网可开）；「离线优先」名副其实；几乎不增加主包体积（SW 独立 chunk）。

#### TS-2　仅 Android 端，无 iOS / 桌面（T3 续）
- **问题**：Capacitor7 仅打包 `apps/web/android`；无 iOS target、无桌面分发。
- **影响**：iPhone/Mac 用户不可用；覆盖受限。
- **解决方案**：若目标用户含 Apple 设备，加 Capacitor iOS target（需 Mac 构建机，复用同一套 web 代码，零业务改动）；桌面可选 Tauri（Rust 壳，体积更小）但改造成本高。建议**先确认需求**再排期。优先级 **P2**。预期收益：覆盖更广；成本中等（iOS 需 Mac CI）。

#### TS-3　OTA 完整性校验防损坏不防伪造（A5 续）
- **问题**：`apps/web/src/lib/contentUpdater.ts` 用纯 JS `sha1`（主校验，永不降级）+ `sha256`（仅安全上下文）+ `files_checksum`（清单自校验），但**无签名**。局域网可信场景足够，若 OTA 源误暴露公网有被替换风险。
- **影响**：当前定位「可信局域网」风险低；但内容分发渠道拓宽（B3 已支持 Gitee Releases / 直传）后，伪造面扩大。
- **解决方案**：manifest 增 `signature`（仓库离线私钥对 `files_checksum` 签名，端上内置公钥验签），默认关闭、可开关；不影响现有局域网流程。优先级 **P2**。预期收益：OTA 误暴露公网也不被篡改；零体积增加。

#### TS-4　纯 CSS 零 UI 框架的可持续性（T1 完成态下的改进项）
- **问题**：`styles/tokens.css` + `styles.css` 已建立 design tokens 体系且全站消费（T1 判完成）。但组件样式为全局 class（约 60 个 `.tsx` + `components/sheet/`），未组件级 scoped，靠命名约定防冲突；功能数增长后样式维护成本线性上升。
- **影响**：中（未来功能增加时改样式易误伤）；当前规模可接受。
- **解决方案**：不急于引入重型 UI 库（保体积）；对高频改动的组件（`Reader*`、`*Sheet`、`TimelineView`）逐步改用 **CSS Modules**（`*.module.css`）局部作用域，tokens 仍全局。优先级 **P2**。预期收益：样式回归风险下降、组件可读性与复用性提升。

---

## 维度三：项目内容与业务功能的完整性及实现质量

### 3.1　内容覆盖完整性

#### 正向（已闭环）
- **C2/C3 均衡收官**：2026-10-01 实测 598 词条 / 2947 章 / 约 509 万字；11 个 L1（历史/哲学/科学/经济学/政治理论/技术/文学/艺术/宗教/语言学/法学），新领域 lit40/art40/sci90/tech64/rel25/ling20/law20 已达 `docs/content-blueprint.md` 阶段一目标。
- **C4 tracks 补齐**：`content/tracks/` 8 个 yaml，schema 规范（`id/title/category/order_mode/timeline/description` + `items[order,entry,sort_date,date_label,era,note]`），`civilization-cross.yaml` 支撑历史双轨同期对照。
- **内容卫生优秀**：断链 / L009 / order / summary 异常 0；L010 可核验引用（`R4`）已加。

#### CT-1　类目引用键与展示名未解耦（taxonomy 中文 title 作引用键）——架构演进债
- **问题**：`content/taxonomy.yaml` 头部铁律写明「词条 `categories` 用**标题路径**引用（如 `科学/人类认知与心理`）」；`packages/cli/src/index.ts` 与 `apps/web/src/state/AppContext.tsx` 的 `buildUnionSlugs` 均按中文标题路径聚合。改/删任一节点**标题**即破坏所有旧词条引用（`rename` 命令可级联但成本高）。
- **影响**：类目树演进（改名、合并、国际化）成本极高；与「数据驱动、零代码扩展」的设计目标（见 `06 §4`）存在张力——节点 `id` 已稳定存在，但内容侧不消费 `id` 链。
- **解决方案**：中远期把内容 `categories` 由中文标题路径改为 **L1 id 链**（如 `science/cog-psych`），taxonomy 保留 `title` 仅作展示；提供一次性迁移脚本（`@pks/cli rename` 扩展）+ lint 适配。**当前可先冻结命名规范**（不再改已有节点标题），待内容规模稳定后迁移。优先级 **P2**（但规范趁早定）。预期收益：类目治理零断链风险；支持未来改名/合并/多语言。

#### CT-2　薄章临界带残留（C5 续）
- **问题**：仍有章节处于 1200–1299 纯汉字临界带（2026-09-23 评估约 602 章），未来修订易回退成薄章。
- **影响**：低（内容质量下限抖动）；阅读体验略虚。
- **解决方案**：把目标从「≥1200」抬至「中位 1600–2400、下限 1300」，用 gen 管线或代理批次对临界带二次扩写（复用 `AUTHORING_BRIEF.md` 格式）。优先级 **P2**。预期收益：抗回退、阅读更扎实。

#### CT-3　新领域词条互链率待达标（C6 续）
- **问题**：新 L1（文学/艺术/宗教/语言学/法学）词条互链率未达 `docs/content-blueprint.md` 验收的 ≥60%。
- **影响**：低（知识网络密度）；新领域偏「孤岛」。
- **解决方案**：在 `cli lint` 加软告警「新词条须在 ≥N 个已有词条 `see_also` 中被引用」。优先级 **P3**。预期收益：知识网络更密、导航更顺。

#### CT-4　离线词典词条量仍有限（P3）
- **问题**：`content/dict/dictionary.json` 约 120KB（历史评估称 ~248 条），划词命中率受限；`apps/web/src/lib/dict.ts` 已有子串兜底匹配，但底池小。
- **影响**：低（阅读增强体验）；专业术语常划不中。
- **解决方案**：用 gen 管线辅助扩充 `dictionary.json`（从现有词条 `summary`/术语抽取）。优先级 **P3**。预期收益：划词命中率提升。

### 3.2　业务功能实现质量（逐项核查）

| 功能 | 实现位置 | 质量评估 | 关键证据 |
|---|---|---|---|
| **检索（L2 全文）** | `lib/loader.ts` `fullTextSearch` + `lib/searchWorkerClient.ts` + `lib/search.worker.ts` | **高** | Worker 优先、主线程兜底、能力探测/永久降级（`degrade()`）；df 分片懒加载（`loadDfForTerms`）；T5 零命中才模糊扩展；`searchWorkerClient.test.ts` 覆盖 |
| **阅读渲染** | `lib/content.ts` `loadEntryDocument/loadChapterDocument` | **高** | 双 LRU（entry 80 / chapter 200）；`renderMarkdown` 内含 `rehype-sanitize`（安全最后一道关）；wiki link 解析 + 失效标记；缓存键 `slug#knownSlugs.size` 自然失效 |
| **导航/类目** | `state/AppContext.tsx` `buildCategoryViews` + `components/CategoryTree` + `TabBar` | **高** | 「标签语义」计数（解决哲学/美学显示 0 的失真，见注释）；`nodeOwnSlugs` 区分本类/子分类 |
| **OTA 更新** | `lib/contentUpdater.ts` + `SettingsPage`/`MePage` | **高** | manifest + IDB + `sha1` 主校验 + `files_checksum` 自校验 + **原子激活**（失败回退随包内容，杜绝半新半旧）；`importLocalFiles` 本机导入辅路；`contentUpdater.test.ts` + `.integration.test.ts` 覆盖 |
| **时间线/学习序列** | `content/tracks/*` + `lib/content.ts` `fetchTrack` + `components/TimelineView` | **高** | 8 tracks；`build:index` 预解析为 `tracks.json`，阅读端不跑 js-yaml；C4 已补齐 |
| **离线词典（划词）** | `lib/dict.ts` | **好** | `dictionary.json` 惰性 + 单飞 + 子串兜底；汉字词典 `chinese-dictionary/character/index.json`；失败不阻断阅读 |
| **设置/阅读偏好** | `lib/preferences.ts` + `SettingsPage` + `ReaderSettingsSheet` | **好** | 阅读设置、OTA 源地址、本地导入入口齐备 |
| **内容生成管线** | `packages/cli/src/gen/*` | **高（已生产化）** | `runner.ts`：work-order→生成→lint 重试(≤3)→staging→promote；并发限流+指数退避+状态机(resume)；`FileProvider`/`OpenAIProvider`；`cli/test/{pipeline,providers,parse-output}.test.ts` 覆盖 |

**残留测试缺口（Q1 续）**：
- **Q-1　高风险链路缺端到端/集成测试**：OTA 有单测+集成测，gen 有单测，但 **APK 冒烟（解包断言 `assets/public/content` 存在）无自动化**；检索降级路径有 `searchWorkerClient.test.ts` 但无「Worker 不可用→主线程兜底」的 e2e 断言。
- **解决方案**：补两类集成测试——① `apkanalyzer`/解包断言 `android/app/src/main/assets/public/content/manifest.json`；② 强制 `degraded=true` 后断言 `fullTextSearch` 走主线程返回。优先级 **P2**。预期收益：APK/检索兜底有回归护栏。

---

## 改进项优先级总表

| 维度 | 问题 | 编号 | 优先级 | 预期收益（可量化） | 大致工作量 |
|---|---|---|---|---|---|
| 技术栈 | Web 端补 PWA/Service Worker（离线一致性） | TS-1 | **P1** | 桌面/移动浏览器真离线；体积 +SW chunk（<20KB） | 中（SW + 缓存策略 + 与 OTA/IDB 协调） |
| 架构 | Web/Android 构建去 JDK/SDK 硬编码 + 一键 apk 固化 | AR-2 | **P1** | 任意装 JDK/SDK 的机器可出 APK；解除机器锁 | 中 |
| 架构 | junction 改原生 Windows junction + 动态探测 tsc（或验证本地 pnpm 可用） | AR-1 | **P1** | 新机接入 <5min；消除「重装即断」 | 小 |
| 内容 | 类目引用键由 title 改稳定 id 链（先冻结命名规范） | CT-1 | P2 | 类目演进零断链；支撑改名/合并/多语 | 中（迁移脚本+lint） |
| 内容 | 薄章临界带抬高中位线 | CT-2 | P2 | 抗回退；阅读更扎实 | 中（gen 批次） |
| 技术栈 | OTA 可选签名（manifest signature） | TS-3 | P2 | 误暴露公网不被篡改 | 小 |
| 技术栈 | 高频组件 CSS Modules 局部作用域化 | TS-4 | P2 | 样式回归风险↓；复用性↑ | 中 |
| 架构 | 根 `scripts_*.mjs` 收口进 `scripts/` | AR-3 | P2 | 维护心智负担↓；命令可发现性↑ | 小 |
| 测试 | APK 解包断言 + 检索降级 e2e | Q-1 | P2 | APK/检索兜底回归护栏 | 小 |
| 技术栈 | 评估 Capacitor iOS / 桌面 target | TS-2 | P2 | 覆盖 iPhone/Mac（需 Mac CI） | 中（视需求） |
| 内容 | 新领域词条互链率软告警 | CT-3 | P3 | 知识网络更密 | 小 |
| 内容 | 词典词条量扩充（gen 辅助） | CT-4 | P3 | 划词命中率↑ | 小 |
| 架构 | core 主 barrel 检索兼容 shim 清理（2026-12 前） | AR-4 | P3 | 消除双真相 | 小 |

> **排期建议**：P1 三项（TS-1 / AR-2 / AR-1）应在下一阶段集中做完，直接对应「离线一致性 + 机器锁解除 + 本地可复现」三件最影响协作与分发的事；P2 中 CT-1 规范**趁早冻结**（不改代码也能先定规矩），其余按资源滚动；P3 为巩固项。
