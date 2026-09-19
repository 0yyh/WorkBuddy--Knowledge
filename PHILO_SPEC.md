# 哲学条目写作规格（本项目专用 · 写作前必读）

仓库根：`D:\WorkBuddy--Knowledge`。内容源唯一目录：`content/entries/<slug>/`。
索引 `content/.index/` 与影子树 `content/_browse/` 是构建产物，**不要手改、不要提交**。

---

## 1. 目录与文件

```
content/entries/<slug>/
├── entry.md              封面页：元数据 + 一句话定位 + 路线图 + 导读
└── chapters/
    ├── ch-01.md          第 1 章（正文，真正的阅读内容）
    ├── ch-02.md
    └── ...               通常 5 章（深条目可 6–7 章，浅条目不少于 4 章）
```

`slug` 规则：`^[a-z0-9]+(-[a-z0-9]+)*$`，必须与目录名一致。

---

## 2. entry.md 结构（**严格照此四段，不得多也不得少**）

```markdown
---
schema: 1
slug: <slug>
title: <中文标题>
original_title: <外文原名>          # 仅西方人物/概念需要
aliases: [别名1, 别名2, English]
type: concept | person | work | event | term
categories:
  - 哲学/西方哲学/近代欧陆哲学        # 必须是 taxonomy.yaml 里的「标题路径」
  - 哲学/认识论                      # 可多值
tags: [标签1, 标签2, 标签3]
summary: >-
  80–300 字概述。用 >- 折叠标量，按去空白后的纯字符串计长，别靠换行凑字数。
  应当说清：它是什么 → 核心主张 → 为什么重要。
status: published
confidence: high
license: public-domain               # 公有领域人物/古典文本用 public-domain；现当代用 CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
created_at: 2026-09-13
updated_at: 2026-09-13
rev: 1
structure:
  levels: [章]
  total_sections: 5                  # 必须等于 chapters/ 下文件数
  total_words: 9000                  # 估算整数，别精确造假，量级对就行
sources:
  - title: 斯坦福哲学百科全书 - 某条目
    url: https://plato.stanford.edu/entries/xxx/
    license: Fair-Use
see_also: [plato, kant, utilitarianism]   # 目标 slug 必须真实存在，否则 lint 告警
---

# <标题>

**<标题>**（<外文原名>）是……（第一段：150–250 字。给出最锋利的定义与定位，
要让完全不懂的人读完知道「这东西在解决什么问题」。加粗关键术语。）

本词条按「第一章标题 → 第二章标题 → 第三章标题 → 第四章标题 → 第五章标题」五章展开。

## 导读

- 4–6 条要点，每条一行，是全文最值得记住的论断（不是章节摘要，不是目录复述）。
- 用「主张 + 理由/后果」的句式，不要写成名词罗列。
- 可加一条指路：「它与 XX 的对立构成本领域的基本张力」。

> 📝 编者注：本词条的取舍说明、常见误解澄清、或与站内其他词条的交叉阅读建议。
```

**⚠️ 硬性要求：`entry.md` 里除「导读」外不得再有第二个 `##` 标题。**
历史上有若干条目的封面页把章节正文重复贴了一遍（旧版本 + 扩展版本叠加），
造成标题与段落整段重复。**绝对不要重复这个错误。** 封面页就只写封面页的内容。

---

## 3. chapters/ch-NN.md 结构

```markdown
---
schema: 1
slug: <entry-slug>/ch-01
work: <entry-slug>
key: ch-01
title: 第一章 <章标题>
order: [1]
path: [第一章 <章标题>]
depth: 1
status: published
license: public-domain
ai_generated: true
ai_annotated: true
sources:
  - title: 来源名
    url: https://...
    license: Fair-Use
summary:
  tldr: 本章一句话结论，≤120 字（超限 lint 报错）。
  keyPoints:
    - 要点一，≤80 字
    - 要点二，≤80 字
    - 要点三，≤80 字
---

<开篇导语段：100–200 字，直接切入本章要解决的问题，不要写「本章将介绍……」>

## <小节标题>

正文。

### <更细的层次，按需使用>

正文。

> 📝 编者注：辨析一个常见误解、补充一个反例、或指出与另一学派的细微差别。
> 每章 0–1 条，不要每节都加。

## <下一小节>

正文。

> 📜 「原文引文。」 —— 作者《著作名》

<收束段：把本章落回整个词条的主线，或抛向下一章。>
```

**章节字数**：每章 1200–2400 字（中文字符）。整条 5 章约 7000–11000 字。
硬上限 20000 字/章。宁可深，不可水。

**标题层级**：章内用 `##` 分小节、`###` 分更细层次。同一章内不要出现两个同名 `##` 标题。

---

## 4. 内容质量标准（这是重点）

每条须覆盖：**核心观点 → 代表人物 → 经典著作 → 关键论证**。

- **关键论证必须写出论证结构本身**，不能只说「某人论证了 X」。
  要写清：前提是什么 → 推理步骤 → 结论 → 这个论证的薄弱点在哪里 → 后人如何反驳。
  例：写阿奎那「五路论证」，要逐路给出起点（运动/因果/可能必然/等级/目的）、
  推理链与 Aristotle「不动的动者」的承接，以及康德对该类论证的批判。
- **区分「该学派自己怎么说」与「别人怎么批评它」**，两方都要有分量。
- **给具体文本**：著作名 + 年代 + 具体章节/段落，不要只提书名。
- **允许有立场**：编者注里可以做判断（哪些批评更有力、哪些流行解读是误读），
  但要说明依据，不要空下断言。
- **引文用 `> 📜 「……」 —— 作者《著作名》`**，每条每章 0–2 处，务求准确。
  **不能确证原文出处时，宁可不引，不要编造引文。**
- **不要写成百科词条罗列**：要有连贯的论证脉络，段落之间有推进关系。

---

## 5. 术语译名（**全站统一，不得自创**）

| 中文 | 外文 | 备注 |
| --- | --- | --- |
| 密尔 | John Stuart Mill | **不用「穆勒」** |
| 休谟 | David Hume | 不用「休姆」 |
| 贝克莱 | George Berkeley | 不用「巴克萊」 |
| 斯宾诺莎 | Baruch Spinoza | |
| 阿奎那 | Thomas Aquinas | |
| 奥古斯丁 | Augustine of Hippo | |
| 罗尔斯 | John Rawls | |
| 海德格尔 | Martin Heidegger | |
| 胡塞尔 | Edmund Husserl | |
| 维特根斯坦 | Ludwig Wittgenstein | |
| 王阳明 | | 阳明心学亦用此名 |
| 荀子、老子、墨子、韩非 | | 先秦诸子用「子」尊称 |
| 程颢、程颐、陆九渊、王夫之 | | |

其他沿用本站既有译名：康德、黑格尔、笛卡尔、尼采、柏拉图、亚里士多德、苏格拉底、
洛克、边沁、克尔凯郭尔、加缪、普罗提诺。

**引号**：正文用直角引号「」，内层用双引号“”，不用英文引号。
**顿号/逗号**：中西文混排时，中文之间用中文标点。

---

## 6. YAML 陷阱（lint 高频报错，务必避开）

- **列表项不能以引号开头**。`- "适"指…` 会被当成未闭合标量，报
  `bad indentation of a sequence entry`。把引号挪到句中：`- 适者生存中的适指…`。
- 值里含 `: `（冒号加空格）或 `#` 时必须加引号。
- `summary` 用 `>-` 折叠标量；80–300 字按**去换行去空格**后的纯字符串计。
- `order` 必须是数组 `order: [1]`，写成字符串会告警。
- `summary.tldr` ≤ 120 字（**报错**，不是告警）。
- `sources` 至少 1 条且每条必须有 `title`。
- `see_also` 里的 slug 必须真实存在。
- `categories` 用「标题路径」引用 taxonomy.yaml，不是 id。

---

## 7. 可用的哲学分类路径（taxonomy.yaml）

```
哲学/思想史
哲学/中国哲学
哲学/西方哲学/古希腊哲学
哲学/西方哲学/中世纪哲学
哲学/西方哲学/近代欧陆哲学
哲学/西方哲学/英美与现当代哲学
哲学/形而上学            ← 新增
哲学/认识论              ← 新增
哲学/伦理学              ← 新增
哲学/美学                ← 新增
哲学/政治哲学            ← 新增
哲学/逻辑与批判性思维
哲学/社会学              ← 新增（古典社会理论：孔德/涂尔干/韦伯/齐美尔 + 社会事实/失范/科层制/社会分层/符号互动论/结构功能主义 等）
```

跨 L1 的合理组合（照抄既有惯例）：
`哲学/西方哲学/古希腊哲学 | 政治理论/政治思想`
`哲学/西方哲学/近代欧陆哲学 | 科学/科学方法论`
`哲学/认识论 | 科学/科学方法论`

---

## 8. 完成后自检

```bash
# 在仓库根执行（npm run 当前不可用，必须直接调 node 入口）
node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p packages/core/tsconfig.json > LINT.log 2>&1 && node node_modules/.pnpm/tsx@4.23.13/node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts lint >> LINT.log 2>&1; echo "EXIT=$?" >> LINT.log
```
然后读 `LINT.log`。**必须 0 error 0 warn**（当前基线就是 0/0，不允许退化）。

长输出一律 `> X.log 2>&1` 再读文件，**不要用 `| tail` / `| head`**（这些命令在本环境不存在，
且会吞掉输出）。日志用完删除：`node -e "require('fs').rmSync('LINT.log',{force:true})"`。

**不要用 `| grep` 或 `| tail`** —— 本环境的 shell 缺少这些命令，且会吞反斜杠，
复杂脚本请写成 `.mjs` 文件再 `node` 执行。
