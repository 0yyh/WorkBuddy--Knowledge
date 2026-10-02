# 薄弱 L1 均衡补强 · 实现设计文档（供工程师逐批落地）

> 作者：架构师 高见远 ｜ 日期：2026-10-02
> 输入依据：`docs/PRD_weak_L1_balancing.md`、`content/taxonomy.yaml`、`PHILO_SPEC.md`、`AUTHORING_BRIEF.md`、`content/entries/capitalism/entry.md`（样例）、`packages/cli/src/commands/lint.ts`（L001–L013）、`content/taxonomy.titles.json`（L012 冻结基线）
> 主理人裁定（已采纳）：① 新增 L3 节点 法学16 + 语言学2；② 目标总量 法学70/语言学65/宗教65/文学70/艺术65/技术70；③ 技术 +6 纳入；④ 儒教按宗教条目规范写（祭祀/礼制）；⑤ 真实跨域词条启用第二 L1 双标签。
> 范围：本次**只新增** 197 条（6 个指定 L1），**不改**既有 598 条正文；仅语言学拆分需对齐 2 条既有词的 `categories` 元数据（见 §2.4 / §6）。

---

## 1. 词条文件结构规范

### 1.1 目录与文件

```
content/entries/<slug>/
├── entry.md                封面页：frontmatter + 四段式正文
└── chapters/
    ├── ch-01.md            第 1 章正文（真正的阅读内容）
    ├── ch-02.md
    ├── ch-03.md
    ├── ch-04.md
    └── ch-05.md            通常 5 章（深条目 6–7，浅条目 ≥4）
```

`slug` 规则：`^[a-z0-9]+(-[a-z0-9]+)*$`，**必须与目录名一致**。PRD 已核对 197 个 slug 与既有 598 不冲突、彼此不重复。

### 1.2 entry.md frontmatter 字段清单（必填 / 可选）

| 字段 | 必填 | 取值与说明 |
|------|------|-----------|
| `schema` | 必 | `1` |
| `slug` | 必 | 与目录名一致 |
| `title` | 必 | 中文标题 |
| `original_title` | 选 | **仅西方人物 / 概念 / 著作**需要（如 `Law of War`）；纯中文条目省略此字段 |
| `aliases` | 推(必) | 别名数组，至少含英文原名 / 常见别称；无则写 `[]` |
| `type` | 必 | `concept` / `person` / `work` / `event` / `term` |
| `categories` | 必 | **taxonomy 标题路径数组**（如 `法学/法理学/法律实证主义`）；可多 L1（双标签见 §4.4）；≥1 |
| `tags` | 必 | 标签数组（3–6 个） |
| `summary` | 必 | `>-` 折叠标量，80–300 字（去空白后纯串计长，见 §5 L008） |
| `status` | 必 | `published` |
| `confidence` | 必 | `high` / `medium` / `low`（公认主题用 high，争议主题用 medium） |
| `license` | 必 | `public-domain`（古典/公有领域人物文本）/ `CC-BY-SA-4.0`（现当代）/ `Fair-Use`（百科/文献引用） |
| `ai_generated` | 必 | `true` |
| `ai_annotated` | 必 | `true` |
| `created_at` | 必 | `YYYY-MM-DD`（初版与 updated_at 同值） |
| `updated_at` | 必 | `YYYY-MM-DD` |
| `rev` | 必 | `1` |
| `structure` | 必 | `levels: [章]`、`total_sections: 5`、`total_words: <估算整数>`（量级对即可，不精确造假） |
| `sources` | 必 | ≥1 条，每条 `{title 双引号, url, license}`（见 §4.2） |
| `see_also` | 必 | 数组，仅含**已存在 slug ∪ 同批新 slug**（见 §4.1） |

### 1.3 封面四段式写法（严格四段，不得多也不得少）

1. **H1 标题**：`# <标题>`
2. **定位段（150–250 字）**：最锋利的定义与定位，让外行读完知道「这东西解决什么问题」，加粗关键术语。
3. **章节路线图句**：`本词条按「第一章标题 → 第二章标题 → …… → 第五章标题」五章展开。`
4. **`## 导读`**：4–6 条 bullet，每条「主张 + 理由/后果」句式（不是目录复述）；其后可加 1 条 `> 📝 编者注`。

> ⚠️ **硬约束**：`entry.md` 除「导读」外**不得有第二个 `##` 标题**（历史上有把章节正文重复贴到封面造成双 `##` 的错误，绝对避免）。封面页只写封面内容。
> 末行（前空一行）：`<!-- PKS_EXPANDED_V5 -->`

### 1.4 chapters/ch-NN.md frontmatter 字段清单

| 字段 | 必填 | 取值 |
|------|------|------|
| `schema` | 必 | `1` |
| `slug` | 必 | `<entry-slug>/ch-NN`（如 `hart-hla/ch-01`） |
| `work` | 必 | `<entry-slug>` |
| `key` | 必 | `ch-NN` |
| `title` | 必 | `第N章 <章标题>`（与正文 H1 一致） |
| `order` | 必 | `[N]`（**数组**，标量触发 C6 报错） |
| `path` | 必 | `[第N章 <章标题>]` |
| `depth` | 必 | `1` |
| `status` | 必 | `published` |
| `license` | 必 | 同 entry 的 `license` |
| `ai_generated` | 必 | `true` |
| `ai_annotated` | 必 | `true` |
| `sources` | 必 | ≥1 条 |
| `summary` | 必 | `tldr: ≤120 字（建议 ≤115 留余量，超限 L004 报错）`；`keyPoints:` 每条 ≤80 字 |

**正文要求**：每章 1200–2400 中文字（**纯汉字 ≥1300**，见 §5 L013）；章内用 `##` 分小节、`###` 更细；同一章内不出现两个同名 `##`；引文 `> 📜 「……」 —— 作者《著作名》` 每章 0–2 处（不能确证宁用 📝 编者注不伪造）；章末空行 + `<!-- PKS_EXPANDED_V5 -->`。

### 1.5 可直接复制的模板

#### 模板 A：entry.md（通用，含全部坑位标注）

```markdown
---
schema: 1
slug: <slug>
title: <中文标题>
original_title: <外文原名>          # 仅西方人物/概念/著作需要；中文条目整行删除
aliases: [<别名1>, <别名2>, <English>]
type: concept                        # concept|person|work|event|term
categories:
  - 法学/法理学/法律实证主义          # 必须是 taxonomy.yaml 的「标题路径」（中文），不是 id
  # - 经济学/制度经济学               # 仅当真实跨域时启用第二 L1（见 §4.4）
tags: [<标签1>, <标签2>, <标签3>]
summary: >-
  80–300 字概述。用 >- 折叠标量，按去空白后的纯字符串计长，别靠换行凑字数。
  应当说清：它是什么 → 核心主张 → 为什么重要。
status: published
confidence: high
license: CC-BY-SA-4.0               # 古典/公有领域用 public-domain；百科文献用 Fair-Use
ai_generated: true
ai_annotated: true
created_at: 2026-10-02
updated_at: 2026-10-02
rev: 1
structure:
  levels: [章]
  total_sections: 5                  # 必须等于 chapters/ 下文件数
  total_words: 8000                  # 估算整数
sources:
  - title: "来源名（含冒号或特殊符号必须双引号）"   # title 一律双引号包裹
    url: https://example.com/xxx
    license: Fair-Use                # public-domain|CC-BY-SA-4.0|Fair-Use
see_also: [<同批slug1>, <同批slug2>, <已存在slug>]   # 只能引用真实存在或同批新建的 slug
---

# <标题>

**<标题>**（<外文原名>）是……（第一段 150–250 字，最锋利定义与定位，加粗关键术语。）

本词条按「第一章标题 → 第二章标题 → 第三章标题 → 第四章标题 → 第五章标题」五章展开。

## 导读

- 要点一（主张 + 理由/后果句式）。
- 要点二。
- 要点三。

> 📝 编者注：取舍说明 / 常见误解澄清 / 与站内其他词条交叉阅读建议。

<!-- PKS_EXPANDED_V5 -->
```

#### 模板 B：chapters/ch-NN.md（通用）

```markdown
---
schema: 1
slug: <slug>/ch-01
work: <slug>
key: ch-01
title: 第一章 <章标题>
order: [1]                          # 必须是数组
path: [第一章 <章标题>]
depth: 1
status: published
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
sources:
  - title: "来源名（双引号包裹）"
    url: https://example.com/xxx
    license: Fair-Use
summary:
  tldr: 本章一句话结论，≤120 字（建议 ≤115 留余量）。   # L004 报错上限 120
  keyPoints:
    - 要点一，≤80 字。
    - 要点二，≤80 字。
    - 要点三，≤80 字。
---

<开篇导语段 100–200 字，直接切入本章要解决的问题，不要写「本章将介绍……」>

## <小节标题>

正文（纯汉字 ≥1300，整章 1200–2400 中文字）。

### <更细层次，按需>

正文。

> 📝 编者注：辨析一个常见误解（每章 0–1 条）。

## <下一小节>

正文。

> 📜 「原文引文。」 —— 作者《著作名》

<收束段：落回词条主线或抛向下一章。>

<!-- PKS_EXPANDED_V5 -->
```

#### 模板 C：person 类型 + 跨 L1 双标签 的实填样例（哈特，B1 P0）

```markdown
---
schema: 1
slug: hart-hla
title: 哈特
original_title: H. L. A. Hart
aliases: [H·L·A·哈特, Herbert Hart, 哈特法理学]
type: person
categories:
  - 法学/法理学/法律实证主义
  # - 哲学/西方哲学/英美与现当代哲学   # hart 核心为法理学，按 §4.4 单标签；仅确属双域才启用第二 L1
tags: [哈特, 法律实证主义, 承认规则, 法律的概念, 奥斯丁]
summary: >-
  赫伯特·莱昂内尔·阿道弗·哈特（H. L. A. Hart，1907–1992）是二十世纪英语世界最具影响力的法律实证主义者，代表作为《法律的概念》。他取代奥斯汀的「主权者命令说」，提出以「初级规则与次级规则」结合与「承认规则」为核心的法律体系观，主张法律与道德在「存在」上分离、仅在「内容」上偶有重合。其规则模式深刻塑造了当代法理学的概念工具，并引发与德沃金、富勒的持续论战。
status: published
confidence: high
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
created_at: 2026-10-02
updated_at: 2026-10-02
rev: 1
structure:
  levels: [章]
  total_sections: 5
  total_words: 8500
sources:
  - title: "Hart, H. L. A. (1961). The Concept of Law. Oxford University Press"
    url: https://doi.org/10.1093/acprof:oso/9780198764884.001.0001
    license: Fair-Use
  - title: "斯坦福哲学百科全书：法律实证主义"
    url: https://plato.stanford.edu/entries/legal-positivism/
    license: Fair-Use
see_also: [kelsen-pure-theory, austin-command-theory, dworkin-rights, fuller-morality-law]
---

# 哈特

**哈特**（H. L. A. Hart）是……（定位段）

本词条按「……」五章展开。

## 导读

- ……

> 📝 编者注：……

<!-- PKS_EXPANDED_V5 -->
```

---

## 2. taxonomy 落点变更清单

本次**只新增节点**，不改动任何既有节点 `id` 与 `title`（否则触发 L012，见 §5）。共 **18 个 L3 节点**：法学 16 + 语言学 2。

### 2.1 法学 16 个 L3 节点（父节点均为现有 L2）

| 父 L2（id / title） | 新增 L3 id | 新增 L3 title | order |
|----|----|----|----|
| law-juris / 法理学 | law-juris-positivism | 法律实证主义 | 1 |
| law-juris / 法理学 | law-juris-natural | 自然法理论 | 2 |
| law-juris / 法理学 | law-juris-socio | 法社会学 | 3 |
| law-constitutional / 宪法与公法 | law-constitutional-rights | 基本权利与人权 | 1 |
| law-constitutional / 宪法与公法 | law-constitutional-admin | 行政法学 | 2 |
| law-civil / 民法 | law-civil-property | 物权 | 1 |
| law-civil / 民法 | law-civil-obligations | 债权与合同 | 2 |
| law-civil / 民法 | law-civil-tort | 侵权与人格权 | 3 |
| law-civil / 民法 | law-civil-family | 婚姻家庭与继承 | 4 |
| law-criminal / 刑法 | law-criminal-general | 犯罪与刑罚总论 | 1 |
| law-criminal / 刑法 | law-criminal-offenses | 具体犯罪 | 2 |
| law-international / 国际法 | law-intl-public | 国际公法 | 1 |
| law-international / 国际法 | law-intl-private | 国际私法 | 2 |
| law-international / 国际法 | law-intl-org | 国际组织与条约 | 3 |
| law-history / 法律史 | law-history-china | 中国法律史 | 1 |
| law-history / 法律史 | law-history-west | 西方法律史 | 2 |

### 2.2 语言学 2 个 L3 节点（拆 `社会与心理语言学` 为子节点，不破坏现有词条）

| 父节点（id / title） | 新增 L3 id | 新增 L3 title | order |
|----|----|----|----|
| ling-socio-psy / 社会与心理语言学 | ling-sociology | 社会语言学 | 1 |
| ling-socio-psy / 社会与心理语言学 | ling-psychology | 心理语言学 | 2 |

> 这 2 个节点作为 `ling-socio-psy` 的**子节点**（order 1、2）。`ling-socio-psy`（order 5）节点本身保留不变，其下原有 2 条词条（sociolinguistics、psycholinguistics）的 `categories` 继续指向 `语言学/社会与心理语言学`，**无需修改**。新词条落点用 `语言学/社会与心理语言学/社会语言学` 与 `语言学/社会与心理语言学/心理语言学`（与 PRD §3.2 字面一致）。

### 2.3 插入位置与缩进（YAML 片段，直接替换对应节点块）

**法学 `law` 节点**：把现有 6 个叶子 L2 替换为带 `children` 的版本（缩进 4 空格为 L2，6 空格为 L3）：

```yaml
    - id: law-juris
      title: 法理学
      order: 1
      children:
        - id: law-juris-positivism
          title: 法律实证主义
          order: 1
        - id: law-juris-natural
          title: 自然法理论
          order: 2
        - id: law-juris-socio
          title: 法社会学
          order: 3
    - id: law-constitutional
      title: 宪法与公法
      order: 2
      children:
        - id: law-constitutional-rights
          title: 基本权利与人权
          order: 1
        - id: law-constitutional-admin
          title: 行政法学
          order: 2
    - id: law-civil
      title: 民法
      order: 3
      children:
        - id: law-civil-property
          title: 物权
          order: 1
        - id: law-civil-obligations
          title: 债权与合同
          order: 2
        - id: law-civil-tort
          title: 侵权与人格权
          order: 3
        - id: law-civil-family
          title: 婚姻家庭与继承
          order: 4
    - id: law-criminal
      title: 刑法
      order: 4
      children:
        - id: law-criminal-general
          title: 犯罪与刑罚总论
          order: 1
        - id: law-criminal-offenses
          title: 具体犯罪
          order: 2
    - id: law-international
      title: 国际法
      order: 5
      children:
        - id: law-intl-public
          title: 国际公法
          order: 1
        - id: law-intl-private
          title: 国际私法
          order: 2
        - id: law-intl-org
          title: 国际组织与条约
          order: 3
    - id: law-history
      title: 法律史
      order: 6
      children:
        - id: law-history-china
          title: 中国法律史
          order: 1
        - id: law-history-west
          title: 西方法律史
          order: 2
```

**语言学 `ling-socio-psy` 节点**：保留该节点，并在其下追加 2 个 L3 子节点（缩进 6 空格）：

```yaml
    - id: ling-socio-psy
      title: 社会与心理语言学
      order: 5
      children:
        - id: ling-sociology
          title: 社会语言学
          order: 1
        - id: ling-psychology
          title: 心理语言学
          order: 2
```

### 2.4 ⚠️ L012 护栏与语言学拆节点的处理

- `content/taxonomy.titles.json` 是**冻结基线**：仅当某节点 `title` 相对基线被改，才触发 L012（**warn 级**）。**新增节点不会触发 L012**。
- 本方案**保留 `ling-socio-psy` 的 id 与 title「社会与心理语言学」完全不变**（不触发 L012），仅在其**下**新增 `ling-sociology` / `ling-psychology` 两个**子节点**（落点 `语言学/社会与心理语言学/社会语言学` 等）。
- **既有 2 条词无需改动**：`sociolinguistics`、`psycholinguistics` 的 `categories` 继续指向 `语言学/社会与心理语言学`（父节点保留，引用有效），本批**不修改任何既有 598 条**。新词条才用 `语言学/社会与心理语言学/社会语言学`、`语言学/社会与心理语言学/心理语言学`。
- `ling-socio-psy` 节点保留其原有 2 条词条（非 0 条目），不产生孤儿节点，也不触发 L012。
- 宗教/文学/艺术/技术**无需新增节点**：宗教 `rel-ruism 儒教与儒家祭祀` 等节点已存在（当前 0 条，直接填内容）。

> 词条 `categories` 一律用**标题路径**（中文，如 `法学/法理学/法律实证主义`），绝不写 id（如 `law-juris-positivism`）。

---

## 3. 批次实现顺序

采用 PRD 的 11 批（B1–B11），按薄弱度与类目聚拢。**批间无强阻塞依赖**——仅 `see_also` 存在跨批互链（见 §4.1），可后置补。建议执行顺序：

**B1→B3（法学）→ B4→B5（语言学）→ B6→B7（宗教）→ B8→B9（文学）→ B10（艺术）→ B11（技术）**

| 批次 | 内容 | 条数 | 备注 |
|----|----|----|----|
| B1 | 法学·P0 骨架（各 L2 锚点） | 14 | 最先建骨架 |
| B2 | 法学·P1 扩展 | 22 | 承接 B1 |
| B3 | 法学·P2 深度补充 | 14 | 法学收尾（50 条） |
| B4 | 语言学·核心 P0/P1（普通/历史/社会语言学/部分语音） | 23 | |
| B5 | 语言学·P2 细分（语音/句法/心理/词源） | 22 | 语言学收尾（45 条） |
| B6 | 宗教·P0/P1 核心（世界宗教+中国宗教主条目+宗教哲学） | 20 | |
| B7 | 宗教·P2 细分（宗教史/教派/中国宗教补充） | 20 | 宗教收尾（40 条） |
| B8 | 文学·理论+体裁+世界文学（亚非/欧美）P0/P1 | 24 | |
| B9 | 文学·中国文学（古代/近现代） | 7 | 小尾批 |
| B10 | 艺术·全类（史/绘画/雕塑/音乐/建筑/影视/设计） | 25 | 艺术收尾（25 条） |
| B11 | 技术·微补（6 条） | 6 | 小尾批，可选类目 |
| **合计** | | **197** | |

**依赖说明**：
- 每批内部 slug 已在 PRD §3 规划互相 `see_also`，同批可互引。
- 跨批引用（如 B1 法学 → B6 宗教的 `sharia`、B8 文学等）**不阻塞**：写本批时只在 `see_also` 放「已存在 slug ∪ 同批 slug」；跨批目标落地后由**最终互链扫尾批**统一补（见 §4.1 / §5 的 `--interlink`）。
-  taxonomy 节点（§2）须**在 B1 开工前一次性写入** `taxonomy.yaml`，否则 B1 起所有 `categories` 会 L002 报错。
- 语言学 2 条既有词 `categories` 本批**不修改**（§2.4，采用子节点方案），B4 开工无需前置对齐动作。

---

## 4. 跨文件共享约定

### 4.1 see_also 互链

- **写入规则**：每条 `see_also` 仅可引用 ① 既有 598 条中真实存在的 slug；② 本批新建的 slug。跨批目标**不得**在写本批时预填（会 L006 warn）。
- **同批互引**：PRD §3 每类目下的 slug 已规划互链，直接互引（如 B1 的 `hart-hla ↔ kelsen-pure-theory ↔ austin-command-theory`）。
- **跨批补链**：全部 11 批写完后，跑一次 `lint --interlink`（见 §5），挑出 in-degree=0 的新词条，按 PRD §5.1.2 的相邻 L1 指引（法学↔政治理论、语言学↔科学/认知、宗教↔哲学、文学↔历史、艺术↔技术）补 `see_also`，目标已 100% 存在，不再告警。
- **优先链向**：同 L2 优先，其次相邻 L1，避免无意义的远距离互链。

### 4.2 sources 格式

- 每条至少含 `title`（**一律双引号包裹**，书名含 `: ` 或 `#` 会炸 YAML）、`url`、`license`。
- `license` 取值：`public-domain`（古典/公有领域人物与文本）、`CC-BY-SA-4.0`（现当代概念/人物）、`Fair-Use`（百科/文献/数据库引用）。
- 现当代学术概念/人物优先 `CC-BY-SA-4.0`；古典/公有领域（如《唐律疏议》《拿破仑法典》原文、孔子）用 `public-domain`（仿 capitalism 样例）。
- 建议带 `url`（doi/官网/百科），便于 L010（`--citations`）核验；L010 默认关，不影响 0-error 基线。

### 4.3 统一译名（全站一致，不得自创）

- 遵循 `PHILO_SPEC.md §5` 译名表：密尔（非穆勒）、休谟、贝克莱、斯宾诺莎、阿奎那、奥古斯丁、罗尔斯、海德格尔、胡塞尔、维特根斯坦等。
- **法学/宗教专有名词用大陆通译**：凯尔森、德沃金、奥斯汀、哈特、富勒、波斯纳；什叶派、逊尼派、苏菲派；奥义书、毗湿奴、湿婆；儒教用「祭祀/礼制」措辞。
- **人名、年代、著作名须准确**；不能确证的宁用 `> 📝 编者注` 说明，或泛化表述，**绝不伪造引文**。引文格式 `> 📜 「……」 —— 作者《著作名》`，每章 0–2 处。
- 引号：外层「」，内层 ""，不用英文直引号；中西文混排中文之间用中文标点。

### 4.4 跨 L1 双标签判定口径

**唯一标准**：仅当词条**核心内容同时落在两个 L1 领域**时，才在 `categories` 打第二个 L1 标题路径；派生/相关但核心单一者不打。

**本次确定的双标签名单（共 4 条）**：

| slug | 主 L1 落点 | 第二 L1 标签 | 判定理由 |
|------|-----------|-------------|---------|
| law-and-economics | 法学/法理学/法社会学 | 经济学/制度经济学 | 以经济学效率视角分析法律，核心双域 |
| wto-law | 法学/国际法/国际组织与条约 | 经济学/国际经济学 | 最惠国/国民待遇/争端解决本质是国际经济制度 |
| ui-design | 艺术/设计/产品与工业 | 技术/信息技术 | 人机界面同时是设计对象与信息技术产物 |
| chinese-opera | 艺术/音乐 | 文学/文体与体裁/戏剧 | 戏曲「歌舞演故事」，剧本为文学体裁、演出为艺术，核心双域 |

**不打第二标签（明确排除）**：
- `yoga-religion`（瑜伽）：核心为印度教宗教实践，身体修炼属派生 → 仅 `宗教/世界宗教/印度教`。
- `jewish-law`（犹太法/哈拉卡）：核心为宗教律法传统 → 仅 `宗教/世界宗教/犹太教`（不跨 法学）。
- `cognitive-linguistics`（认知语言学）：核心为语言学理论 → 仅 `语言学/普通语言学`（不跨 科学/人类认知与心理）。
- `sociology-of-law` / `legal-realism` / `legal-transplant`：核心为法学内部视角 → 仅 法学。
- 儒教 5 条（`confucian-ritual` 等）：按主理人裁定仅 `宗教/中国宗教/儒教与儒家祭祀`，**不**跨 哲学/中国哲学（避免与哲学/中国哲学条目重复）。

> 若工程师对某条拿不准是否跨域，默认**单标签**，并在编者注说明关联的另一 L1，留待最终互链批处理。

---

## 5. lint 校验清单

### 5.1 规则要点（L001–L013）

| 规则 | 级别 | 要点（工程师每批须关注） |
|------|------|------------------------|
| L001 | error | slug 全局唯一（PRD 已核对，同批内勿重复） |
| L002 | error | `categories` 路径必须存在于 taxonomy（**先写 §2 节点**再写词条） |
| L003 | error | 单章 ≤20000 字（远超不会，正常 1200–2400） |
| L004 | error | 章节 `summary.tldr` ≤120 字（**建议 ≤115 留余量**，超限报错） |
| L005 | warn | 标 `cross_timeline` 须 timeline 维度 ≥2（本次词条一般不打此标） |
| L006 | warn | `see_also` 指向必须真实存在（跨批预填会 warn，见 §4.1） |
| L007 | error | section slug 唯一（`ch-01`…`ch-05` 不重即可） |
| L008 | warn/error | entry `summary` 80–300 字（<80 warn，>300 error） |
| L009 | error | **每文件（entry.md + 每个 ch-NN.md）末行必须是且仅一个 `<!-- PKS_EXPANDED_V5 -->`**（前空一行；版本须 V5，无裸 token / 双重包裹 / 多重） |
| L010 | warn | sources 缺可核验引用（默认关，不影响 0-error） |
| L011 | warn | 互链覆盖率（默认关，`--interlink` 用于最终扫尾） |
| L012 | warn | taxonomy 节点 title 相对 `taxonomy.titles.json` 被改即告警（**本次只新增不改标题**，不触发；§2.4 的 ling 拆法保留原 title） |
| L013 | warn | **薄章下限：章节正文纯汉字 ≥1300**（默认关，`--thin` 开启；中位目标 1600–2400，写 ≥1400 更稳） |

### 5.2 每批运行命令

**薄章软告警（每批写完跑，挑出 <1300 纯汉字的章补写）：**
```bash
node node_modules/.pnpm/tsx@4.23.13/node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts lint --thin
```

**完整 lint（0-error 基线，每批收尾必须 0 error；warn 尽量清零）：**
```bash
node node_modules/.pnpm/tsx@4.23.13/node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts lint
```

**最终互链扫尾（全部批完成后，补跨批 see_also 后跑）：**
```bash
node node_modules/.pnpm/tsx@4.23.13/node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts lint --interlink
```

> 注：日志输出量大，按 `PHILO_SPEC.md §8` 习惯重定向到 `LINT.log` 再 Read；`npm run` 不可用，必须直调 node 入口。若想顺带编译检查可先跑 `tsc -p packages/core/tsconfig.json`（非强制）。

### 5.3 每批自检清单（写文件时逐项核对）

1. `sources` 每条 `title` 双引号包裹；
2. 章节 `tldr` ≤115 字、`keyPoints` 每条 ≤80 字；
3. 每文件末行 `<!-- PKS_EXPANDED_V5 -->`（前一行空行，用 Read 回读末 3 行确认）；
4. `see_also` 仅含已存在 slug ∪ 同批 slug；
5. `order` / `structure` 是数组；
6. 每章纯汉字 ≥1400（保 L013 通过）；
7. entry `summary` 80–300 字（去空白计）；
8. `categories` 用 taxonomy 标题路径（非 id），双标签仅 §4.4 名单。

---

## 6. 待明确事项与已决断

| # | 事项 | 决断 / 建议 |
|---|------|------------|
| 1 | L004 tldr 上限 | 代码 `TLDR_MAX` 硬上限 120（报错）；工程实践目标 ≤115 留余量。团队统一按 ≤115 写。 |
| 2 | 语言学拆节点是否改 `ling-socio-psy` 标题 | **不改**（保留 id+title 不变，避免 L012）；在其**下**新增 `ling-sociology`/`ling-psychology` **子节点**（落点 `语言学/社会与心理语言学/社会语言学` 等，与 PRD §3.2 一致）；**不修改**既有 2 条词 `categories`（继续指向 `语言学/社会与心理语言学`），严格遵守「不修改现有 598 条」。 |
| 3 | 技术 6 条是否执行 | 主理人已裁定「技术 +6 纳入」，B11 照常执行。 |
| 4 | 儒教条目是否跨 哲学/中国哲学 | 主理人裁定「按宗教条目规范写（祭祀/礼制），不与哲学/中国哲学重复」→ **仅单标签** `宗教/中国宗教/儒教与儒家祭祀`。 |
| 5 | 跨 L1 双标签范围 | 仅 §4.4 名单 4 条（law-and-economics / wto-law / ui-design / chinese-opera）；其余单标签。 |
| 6 | 文学现状 38–39 vs 目标 70 | 按 PRD +31 后约 69–70，接受；以实际落点 slug 计，不强行凑整数。 |
| 7 | 章节数 | 统一 5 章（深条目可 6，浅条目 ≥4）；`structure.total_sections` 须等于 `chapters/` 实际文件数。 |
| 8 | taxonomy 基线刷新 | 新增节点后**不必**立即刷新 `taxonomy.titles.json`（L012 只查改名）；建议全部批完成后跑一次 `taxonomy:baseline` 刷新，便于今后捕获误改名。 |
| 9 | 优先级口径 P0/P1/P2 | 采纳 PRD 分配：P0=锚点骨架、P1=重要扩展、P2=深度补充；批内按 PRD §3 列出 slug 顺序写。 |

> 其余 PRD §5.1 假设默认成立。任何新发现的 slug 冲突或 taxonomy 路径疑问，先停批报主理人，勿擅自改既有条目。
