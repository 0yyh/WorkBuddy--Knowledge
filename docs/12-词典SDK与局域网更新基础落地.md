# 词典查询层 + 局域网更新基础（执行记录）

> 阶段：已完成数据源确认与查询层落地；尚未接入阅读页 UI（后续编码阶段）。

## ⚖️ 关键决策（用户已确认）
- 已存在权威词典数据 **`content/dict/dictionary.json`**（146 词，含截图示例词「闻人」）。
- **统一以 content/dict 为唯一数据源**（可随内容包 OTA / 局域网更新）。
- **字段结构沿用 content/dict**：`defs: string[]`(常规义) + `specialized: [{field, defs:string[]}]`(专业义)。
- 原本轮初版「在 packages/core 内置 62 词、defs 对象 tag 结构」的设想**作废并删除**。

## 1. 局域网更新环境（两项能力已验证可跑通）

### 1.1 本地静态服务器 + CORS → `scripts/serve-lan.mjs`
- 零依赖（仅 `node:http`/`node:fs`），不触碰任何 npm/pnpm 安装，不破坏 `@pks/core` junction。
- 实测（项目内临时目录）：
  - `GET /manifest.json` → `200 OK`，body 正确返回；
  - 响应头带 `Access-Control-Allow-Origin: *` 等 CORS 头；
  - `OPTIONS` 预检 → `204` + CORS 头；
  - 支持 `Range`；目录索引关闭。
- 用法：`node scripts/serve-lan.mjs [dir] [port]`，dir 默认 `./release/latest`，port 默认 `8080`。
  - ⚠️ Git Bash 传路径需用 Windows 风格：`node scripts/serve-lan.mjs "$(pwd -W)/release/latest"`，否则 `/d/...` 被 Node 当 `D:\d\...` 而 404。

### 1.2 Android 允许明文 HTTP → 已改并重打包
- `AndroidManifest.xml` `<application>` 加 `android:usesCleartextTraffic="true"`。
- 重打包成功：`apps/web/android/app/build/outputs/apk/debug/app-debug.apk`（6,941,800 字节）。
- 说明：仅允许局域网明文 `http://192.168.x.x` 被 WebView 访问；不改变 `compileSdk=35 / targetSdk=34`。

## 2. 词典查询层（packages/core，读取 content/dict）

### 数据源（不随 SDK 内置）
- `content/dict/dictionary.json`：顶层 `{version,built_at,count,source,description,entries}`；
  `entries` 以 word 为 key → `{word,pinyin,pos,defs:string[],specialized:[{field,defs:string[]}],source}`。
- 实际 146 词；144 词带专业义；含截图示例「闻人」。

### SDK（packages/core/src/dict/）
- `types.ts` —— 类型（DictEntry/Dictionary/DictSpecialized…）+ `parseDictionary`（zod 校验、key==word 校准）
- `query.ts` —— `normalizeQuery`/`entryId`/`lookupDict`/`buildLookupTable`
- `serialize.ts` —— `serializeDictionary`/`normalizeEntry`（校验后重导出、修正 count）
- `index.ts` —— 桶出口
- 编译产物 `dist/dict/`；子路径 `@pks/core/dict`；主入口仅重导出 dict 类型（不拖数据）
- **不含任何内置数据**（删除初版 entries-data.ts）

### 验证
- `packages/core` 全量单测 **11 文件 / 60 用例全通过**（dict.test.ts 10 例：parse/校验、规范化、查询命中/未命中、content schema 断言、serialize 回环）。
- 用**真实 content 词典**实跑：parse 无错、146 词；命中 剩余价值/国家/阶级/辩证法/闻人/市场经济，`《资本论》` MISS 正确。
- web 端 `@pks/core/dict` 可解析、`tsc --noEmit` 通过。

## 3. 状态与下一步
- ✅ content/dict 为唯一数据源；packages/core/dict = 纯查询层（类型+parse+query+serialize）。
- ✅ 环境两项 + APK。
- ⏭ 后续编码：① `scripts/copy-content.mjs` 加入 `dict/` 拷贝（词典才能进 APK/更新包）；② 阅读页选中→浮动工具条(复制/查询)→底部卡片，经 `@pks/core/dict` + `loader` 读取 `content/dict`。

