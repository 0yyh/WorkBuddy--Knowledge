# M0 第一批实现交付概览（T01mini + T02mini + T03mini）

> 本地离线优先「个人知识学习站」—— Web + Android(Capacitor) 同构代码库（React+Vite+TS）。
> 本批次交付**同构核心库 + Node 工具链 + 样例内容 + 单测**，打通 B0 端到端（导出→导入→阅读）的底层能力。

## TL;DR
`@pks/core`（同构核心）与 `@pks/cli`（6 条命令）编译通过；样例内容 10 词条 / 4 章节 / 2 双时间线 Track 跑通全链路 5 命令，**lint 0 错误 0 警告**；**Vitest 47/47 全过，无源码 bug**。M0 验收达成。

## 交付状态
| 检查项 | 结果 |
|---|---|
| `@pks/core` 编译 | ✅ exit 0（28 源文件，主入口同构，无 node:fs 依赖） |
| `@pks/cli` 编译 | ✅ exit 0（build:index / lint / bundle / rename / browse:gen / search） |
| build:index | ✅ 10 词条 · 4 章节 · 1588 字 · 16 检索分区 · 1207 索引词项 |
| lint | ✅ error 0 / warn 0 |
| bundle（seed） | ✅ `content/_bundles/pks-seed.zip`，10 词条 |
| browse:gen | ✅ 8 个类目影子页 → `content/_browse/` |
| search（L1 标题 / L2 全文） | ✅ CJK 二元分词 + BM25 排序正确（如 `鸦片`→鸦片战争 1.72） |
| 双时间线 B4 | ✅ `opium-war` 索引含 `tl:["china","world"]` + `ctl:1` |
| Vitest 单测 | ✅ 47/47 通过（9 文件） |

## 关键设计落地
- **同构核心**：主入口不依赖 node:fs；Node 专属能力经子路径 `@pks/core/node`、`@pks/core/build` 引入。
- **VFS 抽象**：Memory / NodeFs / Overlay / Zip 四种实现，内容 = 只读 md。
- **检索**：CJK 二元分词 + BM25(k1=1.2,b=0.75)；分片 `fnv1a(slug)&(M-1)`，M 默认 16（2000 万字档升 256）；L1 标题索引常驻 + L2 全文分片懒加载骨架（IndexedDB 缓存接口已预留）。
- **安全**：Markdown 渲染强制 `rehype-sanitize`。
- **两轴知识模型**：分类树(taxonomy.yaml) × Track 线性序列；跨轨条目自动推导 `cross_timeline`。

## 文件清单（本批次新增/确认）
- 核心库：`packages/core/src/**`（constants/types/util/parse/vfs/index/merge/track/content）
- 工具链：`packages/cli/src/**`（index + 6 commands + load-index）
- 样例内容：`content/taxonomy.yaml`、`content/entries/*`（10 词条）、`content/tracks/history-{china,world}.yaml`
- 单测：`packages/core/test/*.test.ts`（9 文件，47 用例）
- 构建产物（gitignore）：`packages/*/dist/`、`content/.index/`、`content/_bundles/`、`content/_browse/`

## 用户下一步
1. **Web 端（T04）**：基于 `@pks/core` 的 L1/L2 检索 + 分类/双时间线浏览，用 Vite+React 实现秒开阅读器。
2. **Android（T05）**：Capacitor 封装，导入 `.zip` 包 → 落 IndexedDB → 离线阅读。
3. **内容规模化**：当前 ~1.6k 字样例；录入真实内容时需补「分区懒加载 + IndexedDB 缓存」骨架（2000 万字档）。
4. **本地复跑**：见 `D:\WorkBuddy--Knowledge\.workbuddy\memory\2026-09-07.md` 末尾的沙箱可用命令（避免 pnpm wmic 拦截）。

## T04 Web 阅读端（apps/web）
| 检查项 | 结果 |
|---|---|
| web `tsc --noEmit` | ✅ exit 0 |
| `vite build` | ✅ exit 0（index.js ≈396 kB / gzip 125 kB，css 16.5 kB） |
| dev server 冒烟 | ✅ `/`、`manifest/taxonomy/title/tracks.json`、`entry.md` 全 200 |
| 核心同构性 | ✅ 主入口 `node:*` 说明符 0（见下「架构修正」） |
| core vitest（回归） | ✅ 47/47 |

- **技术栈**：Vite 5 + React 18 + TS strict；自研极简 hash 路由（不引 react-router）；纯 CSS（不引 Tailwind/MUI，为 ≤80MB apk 让路）。
- **内容链路**：`scripts/copy-content.mjs` 拷贝 `.index/entries/tracks` → `apps/web/public/content/`；L1 `title.json` 常驻（秒开）+ L2 分片按需 fetch；正文经 `renderMarkdown`（rehype-sanitize）后注入；wikilink → `#/entry/slug`。
- **页面**：home（分类树）/ browse / entry（正文 + TOC + 章节树 + see_also）/ search（L1 即时 + L2 全文）/ timeline（双时间线，`cross_timeline` 条目两侧展示）。

### ⚠️ 架构修正：@pks/core 主入口原本并非真同构
- **缺陷**：`vfs/zip.ts` 静态 `import { readFileSync } from 'node:fs'`，而 `vfs/index.ts` 再导出 `zipVfsFromFile` → 主入口被 node:fs 污染，vite/rollup 直接报错（初版靠 alias shim 掩盖）。
- **修正**：`zipVfsFromFile` 移入 `vfs/node.ts`（随 `@pks/core/node` 导出）；`zip.ts` 只留同构的 `zipVfsFromBytes`；`vfs/index.ts` 不再导出 Node 版。现已移除 shim，构建产物 0 处 `node:fs`。
- **附带修正**：`tracks.json` 原由拷贝脚本合成，已改由 `buildIndex` 正式输出 `.index/tracks.json`。
- **约定**：今后任何 Node-only 能力只能放 `@pks/core/node` 或 `@pks/core/build`，禁止从主入口 re-export。

## 已知问题 / 风险
- T04 已完成；T05（Capacitor Android）尚未启动。
- `pnpm` 在本沙箱触发 wmic 拦截；`vite build` CLI 亦被拦（用 Vite 编程式 API 等效验证通过），**建议本地补跑一次 `vite build` 与 `vitest run` 确认**。
- 未做浏览器点击级验证（沙箱无可用 headless），仅 dev server + Node 级冒烟。
- vite 依赖预构建缓存若 >50 文件，沙箱批量删除会被拒 → 先 `rm -rf apps/web/node_modules/.vite`。
- 样例内容 ~1.6k 字偏教学性；真实 2000 万字录入需补分区懒加载 + IndexedDB 缓存。
