# 内置词典数据源评估：chinese-xinhua

> 评估日期：2026-09-10｜目的：判断 GitHub 开源数据包 `pwxcoo/chinese-xinhua` 能否作为 App 内置词典功能的数据来源。
> 结论：**可用（推荐）**。授权为 MIT（宽松、可再分发/商用），字段结构与现有 `DictEntry` 高度匹配，内置体积与加载方式可行。

---

## 1. 授权协议（关键项）

- `LICENSE` 原文为**完整 MIT License**（Copyright (c) 2018 PWXCOO），允许：使用、复制、修改、合并、出版、分发、再许可、销售，**仅要求在所有副本中保留版权声明与许可声明**。
- README 的 "Copyright" 段虽写"数据从网上收集整理、无商业目的、侵权即删"，但**那是作者对数据来源的免责说明，不影响 MIT 许可证对代码/数据包本身的授权效力**。
- **落地要求**：打包内置时，必须在 App 内"关于/开源许可"页或词典数据侧**附带 MIT LICENSE 全文 + 作者署名（PWXCOO）+ 数据来源声明（GitHub pwxcoo/chinese-xinhua）**。做到即合规。

## 2. 数据规模（README 公示）

| 数据集 | 文件 | 条数 |
| --- | --- | --- |
| 歇后语 | `xiehouyu.json` | 14,032 |
| 汉字 | `word.json` | 16,142 |
| 词语 | `ci.json` | **264,434** |
| 成语 | `idiom.json` | 31,648 |

> 注：`ci.json` 的 26 万条绝大多数为低频/专有短语，对"查词词典"价值密度低且体积占比最大，内置时应**排除或仅取精选子集**。

## 3. 字段结构（与词典需求匹配度）

| 文件 | 字段 | 与 `DictEntry` 匹配 |
| --- | --- | --- |
| `idiom.json` | `word, pinyin, explanation, example, derivation, abbreviation` | ✅ 极好：`word`→词头、`pinyin`→拼音、`explanation`→`defs[]`；`example`/`derivation` 可作附加义或注释 |
| `word.json`（汉字） | `word, oldword, strokes, radicals, pinyin, explanation, more` | ✅ 好：`pinyin` 有、`explanation`→`defs[]`、`radicals`/`strokes` 可作 `pos` 或专业义 |
| `ci.json` | `ci, explanation` | ⚠️ 可用但**缺 pinyin**（可省略或构建期派生）；仅 `{词, 释义}` |
| `xiehouyu.json` | `riddle, answer` | ➖ 与"词典释义"语义不同，一般不含入查词词典 |

**与现有 `DictEntry` schema 的对应**（`packages/core/src/dict/types.ts`）：
- `word` ← `word`/`ci`
- `pinyin?` ← `pinyin`（ci 可空）
- `defs: string[]` ← `[explanation]`（可将 `example` 并入或单列）
- `pos?` ← 汉字的 `radicals`/`strokes`
- `specialized[]` ← 可承载 `derivation` 等
- `source?` ← `"chinese-xinhua (MIT)"`

**结论：字段结构匹配良好，仅需一个构建期归一化步骤**将 xinhua JSON 扁平化为 `{ word, pinyin?, defs:[explanation], source }` 并建查词索引。

## 4. 内置体积与加载方式（可行性）

- **全量原始体积**：四文件合计 raw ≈ 50–70 MB（其中 `ci.json` 264k 条占大头）。
- **推荐内置范围**：`idiom.json`（31,648）+ `word.json`（16,142）+ 可选精选 `ci` 子集 ≈ **15–25 MB raw / gzip（fflate，已为项目依赖）≈ 3–6 MB**。
- **加载方式（契合现有架构）**：
  - 应用词典数据权威源为 `content/dict/dictionary.json`，经内容资源 / OTA / 局域网更新下发（`dict/types.ts` 约定）。
  - 归一化后的 xinhua 词典写入 `content/dict/`（或作为独立 **词典内容包**，契合 docs/02 §18 三层分发思路），**随包仅 Seed 级或作可选下载包**，不进初始 JS 包。
  - 首次查词经现有 VFS / IndexedDB 覆盖层（`contentCache.ts`）**懒加载 + fflate 解压**，3–6 MB 完全可行，不影响冷启动（首屏与词典数据解耦，见 §18.6）。
- **可行性结论：✅ 可行**。

## 5. 风险与注意

1. **数据清洗**：`word.json` 的 `explanation`/`more` 含原始抓取噪声（内嵌换行、半角引号、`\n` 转义），归一化时需做空白折叠与引号规整。
2. **pinyin 质量**：idiom/汉字的 `pinyin` 带声调（如 `ā bí dì yù`），可直接支撑拼音搜索（对应 P05 优化点）；`ci.json` 缺 pinyin，需派生或放弃该子集的拼音检索。
3. **内置边界**：建议**仅内置 idiom + 汉字 + 精选 ci**，把 26 万 `ci` 全量留给"扩展词包"（用户按需下载），既控体积又保查词广度。
4. **备选数据源**：若未来需要更权威/大陆规范释义，可考虑 **萌典 moedict（CC BY 3.0，g0v，基于教育部国语辞典）** 作为备选；当前 xinhua MIT 已足够起步。

## 6. 建议落地动作（供实现阶段采用）

1. 在内容构建链新增一步：拉取 xinhua `idiom.json`+`word.json`(+精选 `ci`) → 归一化为 `Dictionary` schema → 写 `content/dict/dictionary.json`（或单独 dict 包）。
2. 打包内置时附带 `LICENSE`（MIT）+ 署名 + 来源声明。
3. 走现有 `dict` 加载通道，首次查词懒加载，无需改 `packages/core` 查询逻辑。
