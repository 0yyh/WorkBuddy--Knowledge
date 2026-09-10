# P0 检索优化三级落地报告（P0-I / P0-II / P0-III）

> 面向「2000 万字」容量目标的检索链路改造。三轮改动互不冲突、逐层递进，均已提交并独立验证。

## TL;DR

| 项 | 内容 | 提交 | 关键收益 |
|---|---|---|---|
| **P0-II** | 全局 BM25 检索统计 | `7fc773a` | 修复跨分片打分不可比、合并排序失真 |
| **P0-I** | 倒排 postings 二进制化 | `5a5679d` | 16 分片 13.3MB → **1.42MB（−89.3%）** |
| **P0-III** | L2 检索移入 Web Worker | `d26322e` | 解码+BM25 离开主线程；worker chunk **222KB → 8.45KB** |

## 背景与定位

读码核对后确认：docs/02 §18 蓝图**大部分基础设施早已实现**（core 的 `bm25.ts` / `util/lru.ts` /
`index/lazy-loader.ts` 的 `PartitionLoader`（IndexedDB+LRU）/ `util/varint.ts` / `index/inverted.ts`
的 `SearchEngine`（L1+L2）/ `index/shards.ts`；web 的 `lib/loader.ts` 已接线 `SearchEngine` + 惰性分片加载 +
`warmSearchShards` 空闲预热 + `contentCache`(IndexedDB) 持久化；离线词典已完整）。
真正缺口只有三项，即本报告的三级。

---

## P0-II：全局 BM25 统计（`7fc773a`）

**问题**：`searchInShard` 原先各自用**分片内**的 `totalDocs` / `avgLen` / `df` 计算 BM25，
导致不同分片产出的分数量纲不一致，跨分片合并后排序失真。

**改动**：core `inverted.ts` 新增 `GlobalSearchStats{totalDocs,avgLen,df}`，`SearchEngine` 构造签名
追加**可选** `stats`（缺失即退回分片内 BM25 → 兼容旧产物与 47 个既有单测）；`builder.ts` 产出
`.index/search/df.json`；web `loader.ts` 拉取装配。

---

## P0-I：倒排 postings 二进制化（`5a5679d`）

**约束（决定方案形态）**：整条内容管线（`contentCache` / `contentUpdater` / `merge/bundle.ts` /
`build-update.mjs` / OTA）**全程按文本处理**（`strToU8` / `res.text()` / IndexedDB 字符串）。
裸二进制文件会**直接破坏 OTA 更新链路**。

**方案**：分片仍是 **JSON 文本**，把全量展开的倒排 `index` 换成内嵌的 `postings` =
`base64(varint 差分 + fflate zlib)`，从而**管线零改动**。

- 新增 `packages/core/src/index/shard-codec.ts`：`encodePostings` / `decodePostings`，格式 v1 =
  `[u8 ver][varint termCount]` → 每 term `[varint utf8Len][utf8][varint postingCount]`
  → 每 posting `[varint docIdDelta][varint tf]`，整段 `fflate.zlibSync` 后 base64。
  varint 复用 `util/varint`；写侧自建可增长 ByteWriter；base64/utf8 同构（Buffer / atob-btoa / TextEncoder）。
- `builder.ts`：检索分片改紧凑 JSON + `postings`（其余产物一律不动）。
- `apps/web/src/lib/loader.ts`：`postings ? decodePostings(postings) : (index ?? {})`（兼容旧产物）。
- 🔴 **复核发现并修复的回归**：`packages/cli/src/load-index.ts:36` 仍在读 `raw.index`，新格式下为
  `undefined` → **CLI 的 L2 检索会崩**。已同步修复。
  **教训：分片线上格式变更时，web 与 CLI 两处消费者都要改。**

**收益**：单分片 s00 829,849 → 84,940 B（−89.8%）；16 分片 13.3MB → 1.42MB（−89.3%）。

---

## P0-III：L2 检索移入 Web Worker（`d26322e`）

**目标**：P0-I 后分片仅 1.42MB，但**解码（base64 + inflate + varint 解析 264,657 条 posting）与
BM25 扫描（187,264 个 term）仍在主线程**。把「解码 + `searchL2` + `groupByEntry`」整段移出主线程。

**设计（管线零改动）**：主线程仍负责 **fetch**（走缓存优先的 `fetchText`，因此局域网 OTA 更新过的
内容仍可检索），只把**原始分片文本**投喂给 worker；worker 内解码 + BM25 + 分组。
`fullTextSearch(bundle, query)` **签名不变**，实现为 **worker 优先 + 主线程兜底 + 永久降级开关**
（构造或运行失败即 `terminate` 且不再重建）。

新增 `apps/web/src/lib/`：`search.worker.ts`、`searchWorkerClient.ts`、`searchWorkerProtocol.ts`、
`workerDocumentShim.ts`；改 `loader.ts`（`StationBundle.statsSeed`、`shardTextCache` +
`shardTextInflight` + `fetchShardText`、`loadShard` 改走 `fetchShardText`、`ensureAllShardTexts`、
`warmSearchShards` 只预热文本以消除双重解码）。

### 🔴 过程中发现并根治的真实缺陷

首次 e2e 全绿但 **`__pksSearchViaWorker=false`** —— worker 实际**直接崩溃**，检索静默降级回了主线程。

- **现象**：worker chunk 抛 `Uncaught ReferenceError: document is not defined`。
- **根因链**：`@pks/core` 主入口 `export * from './parse/markdown.js'` → 整条 remark/rehype 链进入
  worker 依赖图 → 末端 `decode-named-character-reference/index.dom.js` 在**模块顶层**执行
  `const element = document.createElement('i')`；core 当时未声明 `sideEffects`，Rollup 摇不掉该
  模块级副作用 → worker 无 `document`，模块求值即崩。
- **根治**：`packages/core/package.json` 新增 `"sideEffects": false`。
  **前置安全审计**：扫描 `packages/core/src/**` 顶层语句，确认**零模块级副作用**（纯函数库）后才声明。
- **效果**：worker chunk **222.35 kB → 8.45 kB（−96.2%）**，chunk 内 `document.createElement` **归零**；
  主 bundle 未缩水（markdown 链在主包被正常保留，阅读页不受影响）。
- **垫片保留**：`workerDocumentShim.ts` 保留为 **dev / 防御性兜底** —— Vite **dev 模式不做
  tree-shaking**（源码直出 ESM，`export *` 一律求值），dev 下仍会踩到；保留可让 dev 与生产行为一致。

---

## 验证（全部由 lead 独立复跑，非采信实施者报告）

| 检查 | 结果 |
|---|---|
| core `tsc` / vitest | exit 0 / **147 测试全过**（22 文件） |
| 16 分片独立解码核对 | totalTerms=**187264**（与 build:index 一致）、totalPostings=264657、**bad=0** |
| CLI `search 资本 --level l2` | 106 条合理命中（走通二进制解码真实消费路径） |
| `apps/web` `tsc --noEmit` / `vite build` | exit 0 / exit 0（worker chunk 8.45 kB） |
| **`node scripts/tools/e2e-search-worker.mjs`** | **exit 0，10/10 断言全绿** |

e2e 断言明细（新增回归脚本，纯 Node 18+、**零第三方依赖**、headless Chrome/Edge + 原生 CDP）：

- **A 主路径**：`hits=106` / `window.__pksSearchViaWorker=true` / worker 仅创建 1 次
- **B 分片不重复下载**：连搜两词，`16 → 16`，`unique=16`
- **C markdown 回归**：阅读页正文 `len=365`、块级元素 `blocks=7`
  —— **直接证据**证明 `sideEffects:false` 未把主包里真正被使用的 markdown 链误摇
- **D 降级安全网**：注入 `window.Worker=undefined` 后仍出结果（`hits=106`，`marker=false`）
  —— 对应「Android 老 WebView 不支持 module worker」时功能不回归

## 未验证项（诚实标注）

- **真机 Android WebView / Capacitor** 下 module worker（`{type:'module'}`）的实际可用性未验证；
  靠能力探测 + 永久降级兜底（D 组即该兜底的桌面等价验证）。
- **真实生产托管**（HTTPS/CDN/跨域 worker 路径）未验证，仅在 `127.0.0.1` 静态服务下验证。
- **局域网 OTA 更新内容后检索新内容**的运行时验证未做（分片文本走 `fetchText` 缓存链路，逻辑支持）。

## 后续可选优化

- `index/search/df.json` 仍是 pretty JSON（1.46MB，现为 `search/` 下最大文件），可紧凑化或同样二进制化。
- 内容未变更，**APK 无需重新打包即可用**；但 P0-III 是**代码变更**，如需让设备端用上 worker，
  需按标准流程重跑 `copy:content → vite build → cap sync → gradlew assembleDebug`。
