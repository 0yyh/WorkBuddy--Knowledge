# PKS 知识学习站 · 系统性问题清单（2026-10-06 刷新）

**方法**：实地核查 `packages/core`、`packages/cli`、`apps/web`、`apps/web/android`、`content/`、`scripts/` 与关键源码 + 对 `docs/architecture-review-2026-10-01.md` 的过期项重新核验 + 独立运行章节深度普查（3932 章全文扫描）。每条均给出可定位证据。

**基线规模**（当前）：795 词条 / 3932 章 / 约 696 万字；11 个 L1 类目；APK `app-debug.apk` 已签名交付。

> ⚠️ **对既有评估（2026-10-01）的两处重要纠正**——下面两条在原文档中列为未做，经本次核验**实际已完成**，请勿重复排期：
> 1. **TS-1「Web 端无 Service Worker」已不成立**：`apps/web/src/main.tsx:19-30` 已注册手写 SW（`public/sw.js`），离线壳已实现；唯一缺口是**缺少 `manifest.webmanifest`，故不可安装为 PWA**（见维度二·A）。
> 2. **Q-1「APK 冒烟缺测」已闭环**：`apps/web/src/lib/apkAssets.integration.test.ts` 已存在并断言 `assets/public/content/manifest.json`。

---

## 关键问题置顶（优先处理）

| # | 问题 | 维度 | 严重度 | 一句话理由 |
|---|---|---|---|---|
| K1 | **构建机器锁**：JDK/SDK/Gradle 路径硬编码 | 构建 | **高** | 换机或 CI 直接假失败，APK 不可复现 |
| K2 | **本地复现脆弱**：Windows 手工 junction + 禁 `npm install` | 架构 | **高** | 误装依赖即断；新机接入依赖铁律记忆 |
| K3 | **内容深度临界带**：32.5% 章节低于 1500 CJK 下限 | 内容 | 中 | 阅读体验下限抖动，且体量下治理成本高 |
| K4 | **类目引用键未解耦**（中文 title 作键） | 架构 | 中 | 改名/合并/国际化成本极高，趁早定规范 |

---

## 维度一：技术栈与构建

### A-1　构建机器锁（JDK/SDK/Gradle 硬编码）　**严重度：高**
- **表现**：`scripts/build-apk.mjs:30-33` 无条件写死 `JAVA_HOME='D:\JDK\jdk-19.0.1'`、`ANDROID_HOME='D:\Android SDK'`、`GRADLE_BAT='C:\Users\Yu\.gradle\...gradle-8.11.1\bin\gradle.bat'`；`build-apk.bat:5-9` 同样硬编码。路径不存在即假失败。
- **影响**：换机器、CI、或本机重装 JDK/SDK 后 APK 构建直接中断；不可复现、不可协作分发（K1）。
- **建议**：改为读环境变量，缺省回退约定路径并告警（`scripts/setup-env.mjs` 已有检测逻辑可复用）；`gradle.properties` 经 `local.properties`（`sdk.dir`）注入。优先级 P1。

### A-2　本地复现脆弱（junction 非原生 + 禁 install）　**严重度：高**
- **表现**：`apps/web/node_modules/@pks/core` 与 `packages/cli/node_modules/@pks/core` 是 Git Bash `ln -s` 创建的 POSIX 软链（非 Windows 原生 `mklink /J`）；项目铁律「禁 `pnpm/npm install`」即源于此。但 `.gitee/workflows/ci.yml` 在 Linux 上 `pnpm install --frozen-lockfile` 已跑通，证明 pnpm workspace 本身可用——junction 只是本地绕行。
- **影响**：误跑 `npm install` → web 拉不到 core dist 即崩；跨工具链（PowerShell/CMD/mingw）解析可能失败；新人接入依赖记忆（K2）。
- **建议**：`setup-env.mjs` 重建链接优先用 `cmd /c mklink /J`；tsc 路径由硬编码改为 `glob node_modules/.pnpm/typescript@*/.../tsc` 或 `npx tsc`；或验证本地 pnpm 可用后改为 pnpm 主路径。优先级 P1。

### A-3　Android 资产同步脆弱（与 A-1 同源）　**严重度：中**
- **表现**：`dist/` → `assets/public` 同步依赖原生 `cp -r`（因 node `fs` 被 recycle-bin shim 拦截），且需 `CODEBUDDY_SAFE_DELETE_ENABLED=0`；`scripts/android/scripts_sync_android_assets.mjs` 用 `fs.unlink` 双重失效（见既有记忆）。本会话已用 git-bash `cp -r` 跑通，但流程未被固化进一键脚本的稳定路径。
- **影响**：同步步骤易错、不可复现；与 A-1 共同构成 APK 交付的人肉门槛。
- **建议**：在 `build-apk.mjs` 步骤 3 用原生 `cp -r`（coreutils 二进制）替代 node 同步脚本，并幂等校验 `assets/public/content/manifest.json` 存在。

### A-4　仅 Android 端，无 iOS / 桌面　**严重度：中**
- **表现**：Capacitor7 仅打包 `apps/web/android`；无 iOS target、无桌面分发（T3）。
- **影响**：iPhone/Mac 用户不可用，覆盖受限。
- **建议**：先确认需求；若需覆盖，加 Capacitor iOS target（复用同一套 web 代码，零业务改动，需 Mac 构建机）。优先级 P2。

### A-5　OTA 完整性校验防损坏不防伪造　**严重度：中**
- **表现**：`contentUpdater.ts` OTA 主路径用纯 JS `sha1`（主校验永不降级）+ `sha256`（仅安全上下文）+ `files_checksum`（清单自校验），**但无签名**。局域网可信场景足够；内容分发渠道拓宽（Gitee Releases/直传）后伪造面扩大。
- **影响**：当前风险低；渠道公网化后存在被替换风险。
- **建议**：manifest 增 `signature`（离线私钥对 `files_checksum` 签名，端内置公钥验签），默认关闭、可开关。优先级 P2。

### A-6　纯 CSS 零 UI 框架的可持续性　**严重度：低**
- **表现**：`tokens.css`+`styles.css` 体系完善且全站消费，但组件样式为全局 class（约 60 个 `.tsx`），未组件级 scoped，靠命名约定防冲突。
- **建议**：高频改动组件（`Reader*`、`*Sheet`、`TimelineView`）逐步改 CSS Modules。优先级 P2（当前规模可接受）。

---

## 维度二：架构与耦合

### B-1　类目引用键与展示名未解耦（taxonomy 中文 title 作引用键）　**严重度：中**
- **表现**：`content/taxonomy.yaml` 铁律要求词条 `categories` 用**标题路径**引用（如 `科学/人类认知与心理`）；`packages/cli/src/index.ts` 与 `apps/web/src/state/AppContext.tsx` 的 `buildUnionSlugs` 均按中文标题聚合。节点 `id` 已稳定存在，但内容侧不消费 `id` 链。
- **影响**：改/删任一节点标题即破坏所有旧词条引用；与「数据驱动、零代码扩展」目标张力大（K4）。
- **建议**：中远期把 `categories` 由中文标题路径改为 L1 id 链（如 `science/cog-psych`），`title` 仅展示；提供一次性迁移脚本 + lint 适配。**当前可先冻结命名规范**（不再改已有节点标题）。优先级 P2。

### B-2　本地导入（`importLocalFiles`）无完整性校验　**严重度：中**
- **表现**：`contentUpdater.ts:521-568`（`importLocalFiles`）与 `importFromZip`（:461-493）对导入文件**直接 `putCached` 写入 IndexedDB，不做 sha1/size 校验**；结构不符仅静默 `skipped`，损坏文件也会被写入。而同文件的 OTA 主路径有完整校验——两路校验强度不对称。
- **影响**：用户导入损坏/错结构的包时，错误内容静默入 IDB，可能污染阅读页状态，且难以溯源（无校验失败提示）。
- **建议**：导入路径至少做「清单存在性 + 关键文件可解析」的轻量校验；写入前对 `index/manifest.json` 做 JSON schema 校验；导入失败时给出明确 `skipped` 原因。优先级 P2。

### B-3　可安装 PWA 缺失（SW 已存在，仅缺 manifest）　**严重度：中**　（重框原 TS-1）
- **表现**：SW 壳已就绪（`main.tsx:19-30` + `public/sw.js`，precache 首屏三件套 + `content/` stale-while-revalidate），但全仓**无 `manifest.webmanifest`**，故浏览器「添加到主屏幕」不可用；且 SW 缓存的代码壳与 OTA 激活的 IDB 内容层**未做显式协调**（OTA 后未触发 `SW.update()`，可能短期仍用旧壳）。
- **影响**：桌面/移动浏览器可离线打开，但**不能像 App 一样安装/常驻**；OTA 后壳更新滞后。
- **建议**：补 `manifest.webmanifest`（name/icons/theme_color/display:standalone）+ 在 OTA 成功回调里 `navigator.serviceWorker.getRegistration()?.update()` 并提示重载。优先级 P2（远低于原文档误判的 P1）。

### B-4　治理脚本散落　**严重度：低**
- **表现**：根 `scripts_*.mjs` 与 `scripts/` 并存，命名风格不一、职责重叠；`package.json` scripts 只暴露 `scripts/` 部分。
- **建议**：收口进 `scripts/`（按 census/audit/lint/android 分组），统一暴露并补 README 索引。优先级 P2。

### B-5　core 主 barrel 检索兼容 shim 待清理　**严重度：低**
- **表现**：`packages/core/src/index.ts:50-77` 仍把 `SearchEngine` 等 8+ 导出「再 export 保留到 2026-12」作兼容过渡。
- **建议**：2026-12 前全局核对仅 `@pks/core/search` 引用后删除；`contributing.md` 固化「改 core 后必重编 core + 清 vite cache」。优先级 P3。

---

## 维度三：内容组织与实现质量

### C-1　薄章临界带（低于 1500 CJK 下限）　**严重度：中**　（独立普查实测）
- **表现**：全仓 **3932 章**，扫描正文纯汉字数：**1276 章（32.5%）低于 1500**；其中 <1200 仅 2 章，即 **约 1274 章落在 1200–1499 带**。B11 批次已将新章阈值抬到 ≥1500，但早期章节（2026-09-23 评估的 602 章 1200–1299 带）仍大量低于新下限。
- **影响**：阅读体验下限抖动、部分章节偏空；795 体量下治理成本不低（K3）。
- **建议**：用 gen 管线或代理批次对 1200–1499 带二次扩写；将下限固化为 ≥1500 并纳入 lint 硬约束。**先跑 `node scripts/census/scripts_census_thin.mjs` 取权威最新快照**（本普查为点的 CJK 口径，二者应一致）。优先级 P2。

### C-2　译名规范：穆勒→密尔　**严重度：低**
- **表现**：grep 命中 11 个文件含「穆勒」。其中 `john-stuart-mill/entry.md`、`freedom-of-speech/entry.md` 为解释性引用（说明旧译名），其余约 9 处正文应改为规范译名「密尔」（休谟/贝克莱/斯宾诺莎/阿奎那/罗尔斯等译名已统一）。
- **建议**：对 9 处正文批量替换；两处解释性引用保留但加「旧译」标注。优先级 P3。

### C-3　章号误标　**严重度：低**
- **表现**：`free-will`、`political-philosophy` 的 `ch-02.md` 标题写成「第一章」（应为第二章）；属 frontmatter/标题笔误。
- **建议**：随下次修订顺手修正；lint 可加 `title` 与 `order` 一致性软告警。优先级 P3。

### C-4　非 `ch-N.md` 命名的章节文件　**严重度：低**
- **表现**：12 个文件未遵循 `ch-N.md` 规范（`part-1..4.md`、`v1-p1-ch01..v1-p7-ch08.md`），多为早期/多卷结构遗留。
- **影响**：检索/索引按命名约定聚合时易漏；与 C-3 同类内容卫生债。
- **建议**：迁移改名为 `ch-NN.md` 或确认其结构特殊性后在 lint 加白名单。优先级 P3。

### C-5　`rev>1` 修订版本残留　**严重度：低**
- **表现**：21 处章节 frontmatter `rev` 字段 >1（多次修订累积），无功能危害，但增加内容溯源噪声。
- **建议**：可选在 lint 加 `rev` 上限或随大版本归零。优先级 P3。

### C-6　死类目节点　**严重度：低**
- **表现**：1 个 taxonomy 节点无任何词条引用（孤儿节点），渲染时计数显示为 0。
- **建议**：删除或补词条；lint 加「无引用叶子节点」软告警。优先级 P3。

### C-7（元问题）　薄章阈值口径不统一　**严重度：低/中**
- **表现**：同一仓库内阈值定义打架——`L013` warn 阈 1300、`PHILO_SPEC` 要求 1500–2000、`scripts/census/scripts_census_thin.mjs` 仍按 1200 口径。三者不一致导致「薄章」判定随工具而变。
- **建议**：统一为单一权威阈值（建议 ≥1500，warn 1450），三处同步。优先级 P2（先统一口径再谈扩写）。

---

## 本会话已闭环（无需再排期）

1. **版本号硬编码** → `vite.config.ts` 经 `define` 注入 `__PKS_APP_VERSION__`（读 `package.json` version），`vite-env.d.ts` 加全局声明；`MePage.tsx`/`SettingsPage.tsx` 改 `v{__PKS_APP_VERSION__}`。提交 `2e6795c`。
2. **「检查更新」语义错位** → 三处按钮改名「检查内容更新」，与 OTA（内容更新）语义对齐。
3. **导入内容包实用性** → `contentUpdater.ts` 接入 `@pks/core` 的 `zipVfsFromBytes`，支持 `.zip`/`.pks` 单包导入（零依赖解压），文件选择器 `accept` 加 `.zip,.pks`，导入后刷新本机内容版本号。
4. **APK 重建** → 含上述修复的 web dist 已同步进 `assets/public`，走既定 SOP 重建并 `apksigner` 签名交付 `app-debug.apk`（40.5MB）。

---

## 优先级总表（高 / 中 / 低）

| 维度 | 问题 | 编号 | 严重度 | 建议优先级 |
|---|---|---|---|---|
| 构建 | 构建机器锁（JDK/SDK/Gradle 硬编码） | A-1 | **高** | P1 |
| 架构 | 本地复现脆弱（junction + 禁 install） | A-2 | **高** | P1 |
| 内容 | 薄章临界带（32.5% < 1500） | C-1 | 中 | P2 |
| 架构 | 类目引用键未解耦 | B-1 | 中 | P2（规范趁早冻结） |
| 架构 | 本地导入无校验 | B-2 | 中 | P2 |
| 架构 | 可安装 PWA 缺失（缺 manifest + SW/OTA 协调） | B-3 | 中 | P2 |
| 技术栈 | 仅 Android，无 iOS/桌面 | A-4 | 中 | P2（视需求） |
| 技术栈 | OTA 无签名 | A-5 | 中 | P2 |
| 内容 | 薄章阈值口径不统一 | C-7 | 中/低 | P2（先统一） |
| 构建 | Android 资产同步脆弱 | A-3 | 中 | P2 |
| 技术栈 | CSS Modules 局部作用域 | A-6 | 低 | P2 |
| 架构 | 治理脚本散落 | B-4 | 低 | P2 |
| 内容 | 译名 穆勒→密尔 | C-2 | 低 | P3 |
| 内容 | 章号误标 | C-3 | 低 | P3 |
| 内容 | 非 ch-N.md 命名 | C-4 | 低 | P3 |
| 内容 | rev>1 残留 | C-5 | 低 | P3 |
| 内容 | 死类目节点 | C-6 | 低 | P3 |
| 架构 | core barrel 兼容 shim 清理 | B-5 | 低 | P3 |

**排期建议**：下一阶段集中做 **A-1 + A-2（解除机器锁与本地复现脆弱）**——这俩直接决定项目能否换机/CI/协作；随后 **C-7 统一阈值口径 → C-1 薄章扩写**、**B-1 冻结类目命名规范**趁早定；B-2/B-3 可并行小步推进。P3 为巩固项，随修订顺手清。
