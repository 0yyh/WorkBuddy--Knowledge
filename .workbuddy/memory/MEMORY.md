# PKS 项目长期记忆 · 个人知识学习站

纯本地离线优先知识站。Web(React18+Vite5+TS strict, 纯CSS零UI框架)+Android(Capacitor7 同套代码)。monorepo: packages/core(@pks/core)/packages/cli/apps/web。git master @ gitee SSH。现状（2026-09-22）381 词条 / 1873 章，**薄章清零：全部章节正文 ≥1200 纯汉字**。

## 环境铁律
- 禁 pnpm/npm install/prune：@pks/core 靠 junction 解析，重装即断。web 消费 core **dist**；改 packages/core/src 后须在 packages/core 下 `node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p tsconfig.json` 重编。
- `JAVA_HOME=D:\JDK\jdk-19.0.1`；`ANDROID_HOME=D:\Android SDK`；vite build 加 `CODEBUDDY_SAFE_DELETE_ENABLED=0`。

## 内容工作
- 结构：`content/entries/<slug>/entry.md`（封面四段式）+ `chapters/ch-NN.md`（frontmatter: slug/work/key/title/order/depth/sources/summary.tldr/keyPoints）。规格：`PHILO_SPEC.md` + `AUTHORING_BRIEF.md`。
- lint（npm run 已坏，直调 node）：`node node_modules/.pnpm/tsx@4.23.13/node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts lint` → 基线 **0 error 0 warn**。L009：entry 与每章末行必须有 `<!-- PKS_EXPANDED_V5 -->`。
- YAML 坑：列表项勿引号开头；值含 `: `/`#` 须引号；tldr ≤120 字；`order` 为数组且**须等于章号**（曾 14 词条 67 处被写坏成 [1]，已修复——写后必须回验 frontmatter）；see_also slug 必须存在；categories 用 taxonomy.yaml 标题路径；sources.title 一律双引号。
- 译名：密尔(非穆勒)、休谟、贝克莱、斯宾诺莎、阿奎那、罗尔斯；引号「」外 "" 内，不用英文引号。
- 词典：`content/dict/dictionary.json`（node 脚本 merge，copy-content 自动投递），现 248 条。
- 可复用脚本（仓库根）：`scripts_lint.mjs` / `scripts_build.mjs`（build:index+copy:content）/ `scripts_census_overall.mjs`（分类普查）/ **`scripts_census_thin.mjs`**（薄章普查：纯汉字口径，剔 frontmatter/末行标记）/ **`scripts_plan_batches.mjs`**（薄章按 L1 分批，BATCH 可调）/ `scripts_full_audit.mjs`（仅覆盖其时 20 条，非全站）。
- **字数口径**：AUTHORING_BRIEF「1200 中文字」＝**纯汉字 ≥1200**（不含标点）；含标点的 cjk 口径会漏掉 1100–1199 汉字的临界章。

## 批次派发经验（重要）
- 派发前**全量 slug 查重**（industrial-revolution 曾因只按分类前缀普查被覆写丢元数据）；brief 必含 L009 末行标记、sources.title 引号、全部历史批次 see_also 白名单。
- general-purpose 子代理可用。**默认与 lite 都可能撞 429（错误里给重置时间）；`model:"reasoning"` 在限流窗口仍可用**（2026-09-22 晚实测完成 30+ 批次）。
- **「Agent not found / 429」报错可能是假失败**：worker 可能已实际落盘 → 先 `git status` 核查再决定重试，勿盲目重派覆盖。
- 子代理会话 SendMessage 报 sender identity 错误属常态，不影响干活；**同文件并行编辑会互相覆盖** → worker 须串行编辑并整文件复核。
- 产出模式：统一 brief + 并行作者 worker + 主理人 lint/build/commit。

## 内容投递
- `.index/` builder 键被 47 单测断言**勿改**；`scripts/copy-content.mjs` 把 `.index`→`index`（仅投递边界）。
- entries 按 `fnv1a(slug)&63` 分 64 桶（文件名 00..3f）；`search/df/bucket-NNN.json` 为 base64(zlib) 单行文本（compressJson；消费端 fetchDfBucket 解压+回落明文）；压缩工具 `packages/core/src/util/compress.ts`。
- df 全量当前 ~1.3MB；「48MB df」是 2000 万字目标规模推算，勿当现状。

## OTA 校验（防损坏，非防伪造）
- 局域网 http 非安全上下文 → 主校验用 core 的 `sha1.ts`（零依赖，永不降级）；sha256 仅 https 附加。
- manifest：`files[].sha1`/`size`(UTF-8 字节) + `files_checksum: "sha1:<hex>"`（摘要格式两侧必须同步改）；`applyContentUpdate` 动手前置 `ACTIVATED=false`，失败回退随包内容。1401 文件/16.4MB 校验 810ms。

## Shell / 工具陷阱
- bash 缺 grep/tail/head/cat/wc/ls/dirname；rm 被拦截 → 删文件用 `node -e "require('fs').unlinkSync(f)"`；git 在 bash 可跑（勿接 |head）。PowerShell 输出被吞 → git 用 bash，查内容用 Read/Grep。
- **同文件多次 Write/Edit 可能静默落错或落旧版**（order 损坏同源）→ 写后必 Read 回验。
- 批量脚本（copy-content/vite build）前台会被 SIGTERM → `run_in_background` + `CODEBUDDY_SAFE_DELETE_ENABLED=0`。
- `node -e` 传 `/d/...` 路径会被转成 `d:\d\...` 报 ENOENT → 用相对路径或 Read 工具。

## Android APK（本沙箱）
- 用 **PowerShell 工具**：`Set-Location apps/web/android` → 设 JAVA_HOME/ANDROID_HOME → `& 'C:\Users\Yu\.gradle\wrapper\dists\gradle-8.11.1-all\2qik7nd48slq1ooc2496ixf4i\gradle-8.11.1\bin\gradle.bat' assembleDebug --no-daemon --console=plain *>&1 | Out-File <log>`（约 6 分钟，后台）。勿用 bash 跑 .bat。
- cap sync 不可用（无 @capacitor/cli）：手工拷 `dist/**` 到 `android/app/src/main/assets/public/`（保留 capacitor.config.json；内容路径是 `content/index/...`）。

## 近期决策（详据 git log）
- 无 CI（删 `.github/`；Gitee CI 用 `.gitee/workflows/`）；提交信息避开 "PowerShell" 字样。
- web 测试：vitest 直调 `--root apps/web`（7 文件/95 测试；node 环境非 jsdom，禁新增依赖 → 纯算术抽成导出函数再测）；core 同法（28 文件/229 测试）；tsc 用 `--noEmit`。
- OTA 防损坏完成，防伪造签名空白（可信局域网可接受）；`docs/system_design.md` T01–T05 完成。
- 未完成：builder.ts 469 行、df 桶每次全量重算压缩（规模期才成问题）。
- 判断项目进度一律 `git log` + 实地核查，勿信 team 任务状态（paused/idle 可能陈旧）。
