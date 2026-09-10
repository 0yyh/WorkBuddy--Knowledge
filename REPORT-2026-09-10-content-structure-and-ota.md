# PKS 项目内容与结构梳理 · 兼内容更新机制说明

> 日期：2026-09-10 ｜ 类型：内容/结构审计 + 更新机制说明（**本次不含任何代码改动**）

---

## 0. 结论先行

| 问题 | 结论 |
|----|----|
| 内容结构是否清晰、可维护？ | **是**。内容（`content/`）与代码（`packages/apps`）彻底分离，内容以「作品目录 + frontmatter」为载体，经 CLI 编译为索引产物，再投递进 App，链路单向、可复现。 |
| 后续在 app 上更新内容，能直接生效吗？ | **能，且无需重装 APK**——前提是走「**局域网 OTA**」或「**本机文件导入**」两条通道之一，且本次更新**全部成功**。两条通道会把新内容写入本机 **IndexedDB 覆盖层**并「激活」，之后 App 读取即缓存优先，点一次「重新加载」即可生效。 |
| 前提条件与适用范围？ | 见 **§9**。核心前提：① 有一份带 `built_at` + 逐文件 `sha256` 的 `manifest.json`；② 更新源可达（本机同局域网服务器 / 或本机文件选择器）；③ 更新「全量成功」才会激活；④ iOS/浏览器需安全上下文才能做 SHA-256 校验。适用范围：**仅内容数据**（index / entries / tracks / dict），**不含** App 代码、UI、路由、数据格式（schema）变更。 |

---

## 1. 项目概览

- **定位**：纯本地、离线优先的个人知识学习站。
- **形态**：Web（React 18 + Vite 5 + TypeScript strict，**纯 CSS、无 Tailwind**）+ Android（Capacitor 7，**同一套代码**打包 APK）。
- **工程约束**：名义上是 pnpm monorepo，但本项目下 **禁止 `pnpm` 与 `npm install`**（会重建 `node_modules`、破坏 `@pks/core` 手工 junction）。依赖已装好。
- **非 git 仓库**：进度靠 `.workbuddy/memory/` 日志保存。

### 1.1 各目录职责

| 目录 | 职责 |
|----|----|
| `packages/core` | 领域内核：索引模型、`SearchEngine`（BM25）、taxonomy、词典查询层。**web 消费的是它的 `dist`，不是 src**。 |
| `packages/cli` | 内容构建流水线：`build:index` / `lint` / `browse:gen` / `bundle` / `rename`。 |
| `apps/web` | 前端 App（React SPA）+ Capacitor Android 壳。 |
| `scripts/` | 构建与分发脚本：`copy-content.mjs`、`build-update.mjs`、`serve-lan.mjs`。 |
| `docs/` | 设计与审计文档 `01`–`12`。 |
| `content/` | **唯一内容源**（见 §2）。 |
| `release/latest/` | 已生成的「内容更新包」（供局域网分发，见 §8）。 |

> ⚠️ 注意：**根 `package.json` 的 scripts 已过时**——仍写着 `apps/reader` / `@pks/reader` 与 `pnpm`。实际的 app 是 `apps/web`，构建以 `apps/web/package.json` 的脚本为准。

---

## 2. 内容资产全景（`content/`）

```
content/
├── entries/          # ★ 词条正文：84 个作品目录，共 514 个 .md
│   └── <slug>/       #   一个作品 = 一个目录（如 adam-smith）
│       ├── entry.md          #   作品级元数据 + 导读（200~400 字）
│       └── chapters/
│           └── ch-NN.md      #   章节正文（多数 5 章）
├── dict/
│   └── dictionary.json       # 离线词典：217 词条（含拼音/词性/常规义/专业义）
├── tracks/           # 阅读主线（按时间排序的串联）
│   ├── history-china.yaml    #   中国历史主线
│   └── history-world.yaml    #   世界历史主线
├── taxonomy.yaml     # 类目体系（唯一权威）：5 个 L1、共 47 个节点
├── .index/           # ★ 构建产物（由 CLI build:index 生成，勿手改）
│   ├── manifest.json         #   版本令牌 built_at + 统计 + 检索参数
│   ├── taxonomy.json         #   taxonomy.yaml 的运行时形态
│   ├── tracks.json           #   tracks/*.yaml 的运行时形态
│   ├── entries/<letter>.json #   按首字母分片的词条元数据（21 个）
│   ├── search/               #   检索索引：title.json + s00–s15 共 16 分片
│   └── covers/*.json         #   封面数据
├── _browse/          # 浏览层源文件（8 个 .md，browse:gen 的输入，不投递给 App）
└── _bundles/         # 内容种子包 pks-seed.zip（历史遗留）
```

**一句话：** `entries/` 是「写什么」，`taxonomy.yaml` 是「怎么分类」，`tracks/` 是「怎么串讲」；三者经 CLI 编译进 `.index/`，再投递进 App。

---

## 3. 词条结构规范

### 3.1 两级文件

| 层级 | 文件 | 作用 |
|----|----|----|
| 作品级 | `<slug>/entry.md` | 标题、别名、类型、**categories 归属**、摘要、来源、`see_also` |
| 章节级 | `<slug>/chapters/ch-NN.md` | 章节正文；含 `tldr` + `keyPoints` 摘要 |

### 3.2 关键 frontmatter 字段

**作品级**：`schema` / `slug` / `title` / `aliases` / `type` / **`categories`** / `tags` / `summary` / `status` / `confidence` / `license` / `ai_generated` / `ai_annotated` / `created_at` / `updated_at` / `rev` / `structure` / `sources` / `see_also`

**章节级**：`schema` / `slug`（`作品/章节`）/ `work` / `key` / `title` / `order` / `path` / `depth` / `status` / `license` / `ai_generated` / `ai_annotated` / `sources` / `summary{tldr, keyPoints[]}`

- `categories` 用「**标题路径**」引用 taxonomy（如 `科学/人类认知与心理`），**不是 id**。
- `type` ∈ `concept`（概念）| `event`（事件）| `work`（著作）| `person`（人物）。

### 3.3 已知格式坑（lint 会报错）

1. YAML 列表项**不能以引号开头**（`- "…"` 会被当作未闭合引号标量导致 parse 失败）。
2. `summary:` 用 `>-` 折叠标量时，按**去换行去空格的纯字符串**计，须 **≥ 80 字**。
3. **改 taxonomy 节点标题会破坏旧词条的 categories 引用**——只能增节点，不能随意改标题。

---

## 4. 规模统计（当前快照）

| 指标 | 数值 | 来源 |
|----|----|----|
| 类目节点 | **47** | `manifest.stats.categories` |
| 作品（词条） | **84** | `manifest.stats.entries` |
| 章节（sections） | **430** | `manifest.stats.sections` |
| 正文总字数 | **410,161** | `manifest.stats.words` |
| 内容总字节 | **≈ 1.23 MB** | `manifest.stats.bytes` |
| `.md` 文件总数 | **514**（430 章 + 84 作品） | 文件系统 |
| 检索文档 | **514** | `manifest.search.docs` |
| 检索词项 | **175,981** | `manifest.search.terms` |
| 检索分片 | **16** | `manifest.search.shards` |
| 离线词典 | **217** 词 | `dictionary.json` |
| 内容版本令牌 | `2026-09-09T14:50:58Z` | `manifest.built_at` |

**类型分布**：concept **69** / event **8** / work **6** / person **1**。

**L1 覆盖（子树去重作品数）**：历史 26 · 哲学 17 · 科学 16 · 经济学 17 · 政治理论 20（作品可跨 L1，故合计 > 84）。

---

## 5. 构建产物与投递层

内容从「源」到「App 能读到」要过两道关，关键动作是**目录改名**：

```
content/.index/  ──copy-content.mjs──►  apps/web/public/content/index/   （去掉前导点）
content/entries/ ──copy-content.mjs──►  apps/web/public/content/entries/
content/tracks/  ──copy-content.mjs──►  apps/web/public/content/tracks/
content/dict/    ──copy-content.mjs──►  apps/web/public/content/dict/
```

**为什么必须把 `.index` 改名成 `index`：** 带前导点的目录会被**丢弃两次**——
1. Capacitor 的 `cap sync`（`dot:false` glob）跳过点目录；
2. AGP 的 `MergeAssets` 同样丢弃点目录。

结果就是 Android 端 `fetch(".index/...")` 全部 404。改名只发生在「投递边界」，`packages/core` / `packages/cli` 内部**仍产出 `.index/`**（47 个 core 单测断言了该键，不能动）。

**投递后的 `public/content/` 结构**（即 APK 内置只读资源）：

```
public/content/
├── index/        # manifest.json · taxonomy.json · tracks.json · entries/ · search/ · covers/
├── entries/      # 514 个正文 .md
├── tracks/       # 2 个 .yaml
└── dict/         # dictionary.json
```

> 注意：根 `pageage.json`… 更正——`apps/web/package.json` 里的 `copy:content` 脚本执行的就是上面这一步。`_browse/`、`_bundles/`、根 `taxonomy.yaml` **不投递**，它们只作 CLI 输入。

---

## 6. 运行期读取链路（App 侧）

```
页面/组件
   └─ loader.ts: fetchText(relPath) / fetchJson<T>(relPath)
         │
         ├─ ① isContentCacheActive() ?  →  contentCache.getCached(relPath)   （IndexedDB 覆盖层，命中即返回）
         │
         └─ ② 回落随包资源 fetch(`${CONTENT_ROOT}/${relPath}`)
                └─ 若激活态，顺带 putCached() 写回覆盖层

loadStation():  并行拉 index/manifest.json + index/taxonomy.json + index/search/title.json
                → 再按首字母拉 index/entries/<letter>.json → 组 slugMap + SearchEngine
fullTextSearch: ensureAllShards() 预热 s00–s15 → SearchEngine.searchL2()（BM25）
warmSearchShards(): 空闲期预热全部分片（首搜秒级 → 预热后 <50ms）
```

- `CONTENT_ROOT` = Vite `BASE_URL` + `/content`。
- **关键开关 `activated`**：只有**成功应用过一次更新**后，覆盖层才参与读取（`ACTIVATED_KEY`）。这样保证：从未更新过的设备行为与旧版完全一致；新装 APK 的新内容不会被旧的 IndexedDB 缓存盖住。

---

## 7. 内容覆盖现状与「补充」建议

### 7.1 覆盖表（直接 = 本节点直接引用；子树 = 含子孙去重）

| 类目 | 直接 | 子树 | 备注 |
|----|----|----|----|
| 历史 | 0 | 26 | L1 容器节点，靠子节点承载 |
| └ 世界史 | 5 | 15 | 古代 2 / 中世纪 3 / 近代 2 / 现当代 3 |
| └ 中国史 | 3 | 12 | 先秦秦汉 2 / **魏晋隋唐 1** / 宋元明清 4 / 近现代 2 |
| └ 历史方法与概念 | 1 | 1 | **偏薄** |
| 哲学 | 0 | 17 | |
| └ 思想史 | 5 | 5 | |
| └ 中国哲学 | 4 | 4 | |
| └ 西方哲学 | 0 | 6 | L2 容器，3 子节点各 2 |
| └ 逻辑与批判性思维 | 2 | 2 | |
| 科学 | 0 | 16 | |
| └ 人类认知与心理 | 3 | 6 | 认知过程 1 / 心理学分支 2 |
| └ 科学方法论 | 1 | 1 | **偏薄** |
| └ 自然科学基础 | 0 | 6 | 物理 3 / **化学 1** / **生物 1** / **天文 1** |
| └ 数学与系统科学 | 0 | 3 | **数学基础 1** / 系统与复杂性 2 |
| 经济学 | 0 | 17 | |
| └ 微观 / 宏观 / 学说 | 各 3 | | |
| └ 金融 | 5 | 8 | 货币与银行 2 / **资本市场与资产 1** |
| 政治理论 | 0 | 20 | |
| └ 政治思想 / 政治学概念 / 政体 | 各 3 | | |
| └ 马克思主义 | 1 | 11 | 经典著作 8 / 政治经济学 3 |

> L1 节点「直接=0」是**正常的**——L1 是伞形容器，词条一律挂在 L2/L3。这不代表内容空缺（子树 16–26 部作品）。真正的「薄」出现在**直接=1 的叶子节点**。

### 7.2 缺口清单

**① 类型严重失衡**：`concept` 69 部，`person` 仅 1 部（只有亚当·斯密），`work` 6 部，`event` 8 部。
→ 知识站缺了「**人物**」与「**经典著作**」两大主线。

**② 单薄叶子类目**（直接=1）：中国史/魏晋至隋唐、历史方法与概念、人类认知与心理/认知过程、科学方法论、化学、生物与生命、天文与地球科学、数学基础、金融/资本市场与资产、马克思主义（哲学侧）。

**③ 阅读主线只有 2 条**（中国史、世界史），哲学/科学/经济/马克思主义尚无主线。

### 7.3 建议的下一批补充（按优先级）

**P0 · 补类型结构（推荐先做）**
- **人物（person）**：牛顿、爱因斯坦、达尔文、柏拉图、亚里士多德、孔子、马克思、凯恩斯、哈耶克、弗洛伊德、图灵 等 → 分别挂到 物理 / 生物 / 古希腊哲学 / 中国哲学 / 马克思主义 / 经济学说 等已有类目。
- **著作（work）**：《物种起源》《几何原本》《理想国》《社会契约论》《君主论》《相对论》 等 → 与已有 `see_also` 形成互链（如 `adam-smith` 已指向 `labour-theory-of-value`）。

**P1 · 补薄叶子类目**
| 类目 | 建议新增题材 |
|----|----|
| 中国史/魏晋至隋唐 | 唐诗、节度使与藩镇、佛教东传、科举前身 |
| 科学/科学方法论 | 可证伪性、范式转换、奥卡姆剃刀、双盲实验 |
| 自然科学基础/生物与生命 | 遗传学、DNA、细胞学说、免疫 |
| 自然科学基础/化学 | 化学键、有机化学、化学反应 |
| 自然科学基础/天文与地球科学 | 板块构造、宇宙学、气候变化 |
| 数学与系统科学/数学基础 | 微积分、集合论、数论 |
| 金融/资本市场与资产 | 债券、衍生品、资产定价 |
| 马克思主义 | 马克思主义哲学、科学社会主义 |

**P2 · 补阅读主线（tracks）**：哲学思想史主线、科学史主线、经济思想史主线、马克思主义发展主线。

**P3 · 扩词典**：`dictionary.json` 现 217 词，可继续补专业义（金融/哲学/科学术语）。

> 以上为**内容增补**（`.md` / `.yaml` / `.json`），不属于代码改动。实际写稿前建议先确认优先顺序。

---

## 8. 内容更新机制（三条通道）

项目里其实有**三条**互不相同的「更新」通道，务必分清：

| 通道 | 对象 | 实现文件 | 状态 |
|----|----|----|----|
| **A. 局域网 OTA**（主） | **内容数据** | `contentUpdater.ts` + `build-update.mjs` + `serve-lan.mjs` | ✅ 已实现 |
| **B. 本机文件导入**（辅） | **内容数据** | `contentUpdater.ts`（`importLocalFiles`） | ✅ 已实现 |
| **C. APK 自更新** | **应用本身** | `lib/update.ts` | ⛔ 占位未启用（`UPDATE_MANIFEST_CONFIGURED=false`） |

### 8.1 为什么是「清单 + 逐文件」，而不是 zip

- 客户端（Android WebView）**没有任何解压库**，且**禁止新增依赖**；`DecompressionStream` 只支持 gzip/deflate、**不支持 zip 容器**。
- 于是设计成：**逐文件清单** `manifest.json`（含每个文件的 `path` / `sha256` / `size`）+ 静态目录，客户端用原生 `fetch` 逐个下载写入 IndexedDB。
- 代价：**642 个请求**（当前内容量）；收益：零依赖、可断点重试、**天然增量**（只下 sha256 变化的文件）。可用 `Range` 加速。

### 8.2 通道 A：局域网 OTA（主通道）

**作者侧（PC）：**
```
# 1. 重建索引与投递
npm run build:index        # CLI 产出 content/.index/
npm run copy:content       # .index → public/content/index
# 2. 生成更新包（release/latest：manifest.json + 全部内容文件）
node scripts/build-update.mjs
# 3. 起局域网服务（带 CORS + Range）
node scripts/serve-lan.mjs release/latest 8080
# 控制台会打印形如 http://192.168.x.x:8080/manifest.json 的地址
```

**App 侧（手机）：**「**我的 → 内容更新**」→ 填 `http://<PC-IP>:8080/` → **检查更新** → **下载更新** → 点「**重新加载**」。

**App 内部流程**（`contentUpdater.ts`）：
1. `GET {baseUrl}/manifest.json` → 校验形态（`built_at` + `files[].path/sha256/size`）；
2. 与本机 `built_at` 比较（本机无记录 → 视为有更新）；
3. **6 路并发**逐文件 `fetch` → 有 `crypto.subtle` 时做 **sha256 校验** → 写入 IndexedDB；
4. **全部成功**才：记录 `built_at`、置 `activated=true`、清掉清单外旧文件；
5. UI 提示「更新完成…请点『重新加载』生效」→ `location.reload()` 后 `loader` 走缓存优先，**内容生效**。

> `release/latest/manifest.json` 当前已存在（`built_at=2026-09-09T23:53Z`，642 文件：entries 514 / index 125 / tracks 2 / dict 1），即打包链路已跑通、只差在手机端发起一次。

### 8.3 通道 B：本机文件导入（离线兜底）

- 场景：没有电脑/局域网时，把内容包经 USB / 微信 / 云盘传到手机，直接选文件。
- 入口：「我的 → **导入内容包**」→ `<input type="file">`（WebView 原生支持）。
- 限制：**只收散文件**（相对路径须落在 `entries/ index/ tracks/ dict/` 之下）；**不支持 zip**（同上，零依赖无法解压）。导入成功即 `activated=true`，同样需「重新加载」。

### 8.4 通道 C：APK 自更新（独立，未启用）

- `lib/update.ts`，manifest schema **完全不同**：`{ latestVersion, apkUrl }`（与内容通道的 `{built_at, files[]}` 无关）。
- 目前 `UPDATE_MANIFEST_URL` 为占位、`UPDATE_MANIFEST_CONFIGURED=false`，**未启用**。应用本身升级仍需重新打包 APK。

---

## 9. 核心问答：更新能否直接生效？前提？范围？

### 9.1 能直接生效吗？—— **能**

在 App 内通过「我的 → 内容更新」发起一次**成功**的（局域网 OTA 或本机导入）之后：
- 新内容写入本机 **IndexedDB 覆盖层**并置 `activated=true`；
- `loader.fetchText` 变为**缓存优先**，`manifest/taxonomy/tracks/entries/search/dict` 全部走新数据；
- 用户点一次「**重新加载**」即看到新内容。

**全程无需重装 APK、无需重新签名。**

### 9.2 完整前提条件清单

| # | 前提 | 说明 |
|----|----|----|
| 1 | **一份合规的更新包** | `manifest.json` 必须含 `built_at` 与 `files[{path,sha256,size}]`，且**文件内容与之匹配**。由 `scripts/build-update.mjs` 生成。 |
| 2 | **更新源可达** | 通道 A：手机与 PC **同一局域网**，PC 已开机跑 `serve-lan`，防火墙放行端口，且服务器返回 **CORS 头**、**明文本地 HTTP 被允许**（`usesCleartextTraffic="true"` 已开）。通道 B：手机能选中目标文件。 |
| 3 | **`built_at` 判定为「有新版本」** | 本机记录的 `built_at` ≠ 远端 `built_at` 才算更新；相同则提示「已是最新」。 |
| 4 | **本次更新「全量成功」** | 只要**有一个文件失败或校验不过**，就**不写 `built_at`、不激活**，避免「半新半旧」被当成最新。 |
| 5 | **SHA-256 校验的前提** | `crypto.subtle` **仅在安全上下文**存在。Android WebView 以 `https` scheme（`https://localhost`）加载 → **支持**；若在普通 http 页面打开 App，则**跳过校验**（降级警告，不阻断）。 |
| 6 | **手动「重新加载」** | 写入完成后需点一次按钮触发 `location.reload()`，让缓存优先链路生效。 |
| 7 | **版本令牌语义** | 以 `manifest.built_at`（ISO 时间戳）为主键比较，`version` 仅展示用。 |

### 9.3 适用范围（能 / 不能）

**✅ 适用范围（纯内容数据，改完即生效）**：`index/*`、`entries/*`、`tracks/*`、`dict/*`
→ 新增/修改/删除词条、章节正文、类目结构（taxonomy）、阅读主线（tracks）、离线词典。

**❌ 不在范围内（必须重新打包并重装 APK）**：
- 任何 **App 代码 / UI / 样式** 改动（`.tsx` / `.ts` / `.css`）；
- 路由、组件、交互逻辑变更；
- **数据格式（schema）/ frontmatter 字段语义**变更——
  > 内容通道只搬运「已编译好的静态文件」，若 schema 变了但 App 代码没跟着变，会出现「新数据 + 旧解析器」的不匹配。
- Capacitor 配置、原生插件、Android 权限等。

### 9.4 注意事项与失败场景

- **内容更新 ≠ 应用更新**：内容通道改不了 App 本身；App 升级仍是 APK 重装（通道 C 未启用）。
- **安全**：局域网明文 HTTP 无 TLS，`sha256` 只能**防篡改**、不能**防窃听**；仅适合家庭/个人局域网，**不要用于公共/校园 WiFi**。
- **网络限制**：公共 WiFi 常开「AP 隔离」，手机会连不上 PC；跨网/公网不可用。
- **依赖人工**：PC 必须开机且服务在运行，无法「用户自助随时更新」。
- **回滚**：Mepage 提供「清除本机内容缓存」（`resetContentCache`），可一键回到随包内容自救。

---

## 附录：本次审计涉及的关键文件

| 文件 | 作用 |
|----|----|
| `content/taxonomy.yaml` | 类目体系源（47 节点） |
| `content/.index/manifest.json` | 版本令牌 + 统计 + 检索参数 |
| `apps/web/src/lib/loader.ts` | 读取入口（缓存优先）+ 索引装载 + 检索 |
| `apps/web/src/lib/contentCache.ts` | IndexedDB 覆盖层（`activated` 开关） |
| `apps/web/src/lib/contentUpdater.ts` | 局域网 OTA + 本机导入 |
| `apps/web/src/lib/update.ts` | APK 自更新（占位未启用） |
| `apps/web/src/pages/MePage.tsx` | 「内容更新 / 导入内容包」UI 入口 |
| `scripts/copy-content.mjs` | `.index` → `index` 投递改名 |
| `scripts/build-update.mjs` | 生成更新包 + 逐文件 sha256 清单 |
| `scripts/serve-lan.mjs` | 局域网静态服务器（CORS + Range） |
| `docs/11-UI改进与OTA方案设计.md` | OTA 方案设计（§4 全文 + §4.9 局域网部署） |
| `docs/12-词典SDK与局域网更新基础落地.md` | 局域网更新环境验证记录 |
