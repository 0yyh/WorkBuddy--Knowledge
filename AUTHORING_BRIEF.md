# AUTHORING_BRIEF · 政治类深入补充批次（第二轮）

仓库根：`D:\WorkBuddy--Knowledge`。内容源唯一目录：`content/entries/<slug>/`。
索引 `content/.index/` 与投递树 `content/index/`、`apps/web/android/.../public/` 是构建产物，**不要手改、不要提交**。

本批次目标：弥补政治类「覆盖面不全、深度不够」两大短板。
- 新增 **国际关系** 整个子领域（此前全站为零覆盖）。
- 补齐 **政体类型对比**（君主制/议会制/总统制/极权主义）、**选举与政党**、**规范政治理论概念**（正义/自由/平等/人权/权力/意识形态）、**民族国家/社会运动**。
- 每条 5 章、每章 1200–2400 中文字、整条约 7000–11000 字；论证要有结构（前提→推理→结论→反驳），不要写成百科罗列。

本文件是作者唯一依据。你**不需要**读 PHILO_SPEC.md，本 brief 已含全部硬规则。

---

## 1. 目录与文件（每条 6 个文件）

```
content/entries/<slug>/
├── entry.md              封面页：YAML + 定位段 + 路线图 + 导读 + 编者注
└── chapters/
    ├── ch-01.md          第 1 章
    ├── ch-02.md
    ├── ch-03.md
    ├── ch-04.md
    └── ch-05.md
```

`slug` 规则：`^[a-z0-9]+(-[a-z0-9]+)*$`，必须与目录名一致。本批次 slug 见第 5 节分配，**不得自创或改动 slug**。

---

## 2. entry.md 结构（四段，严格照此）

```markdown
---
schema: 1
slug: <slug>
title: <中文标题>
original_title: <外文原名>          # 西方概念/人物需要；纯中文概念删此行
aliases: [别名1, 别名2, English]
type: concept | person | work | event | term
categories:
  - 政治理论/政体与国家制度        # 必须是 taxonomy.yaml 的「标题路径」；本批允许路径见第 4 节
tags: [标签1, 标签2, 标签3]
summary: >-
  80–300 字概述（用 >- 折叠标量）。说清：它是什么 → 核心主张 → 为什么重要。
status: published
confidence: high
license: CC-BY-SA-4.0              # 古典/公有领域人物用 public-domain
ai_generated: true
ai_annotated: true
created_at: 2026-09-21
updated_at: 2026-09-21
rev: 1
structure:
  levels: [章]
  total_sections: 5                  # 必须等于 chapters/ 文件数
  total_words: 9000                  # 估算整数，量级对即可
sources:
  - title: "来源名（含冒号或#必须这样用双引号包裹）"
    url: https://...
    license: Fair-Use
see_also: [slug1, slug2]            # 只能引用第 6 节白名单里的真实 slug
---

# <标题>

**<标题>**（<外文原名>）是……（第一段 150–250 字：最锋利的定义与定位，加粗关键词。）

本词条按「第一章标题 → 第二章标题 → 第三章标题 → 第四章标题 → 第五章标题」五章展开。

## 导读

- 4–6 条要点，每条「主张 + 理由/后果」句式，是全文最值得记住的论断。
- 可加一条指路：它与 XX 的对立构成本领域基本张力。

> 📝 编者注：取舍说明 / 常见误解澄清 / 与站内词条的交叉阅读建议。

<!-- PKS_EXPANDED_V5 -->
```

**硬性要求（lint 报错项）：**
- `entry.md` 除「导读」外**不得有第二个 `##` 标题**（封面页就是封面页，不要把章节正文再贴一遍）。
- **最后一行必须是 `<!-- PKS_EXPANDED_V5 -->`**，前一行为空行。缺失 = error。
- `summary` 用 `>-`，按去空白纯字符串计 80–300 字。
- `sources` 至少 1 条，每条**必须有 `title`**，且一律用双引号包裹（防 `: `/`#` 炸 YAML）。
- `see_also` 的 slug 必须真实存在（见第 6 节白名单）。
- `order`/`structure.total_sections` 等数组字段写数组形式。

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
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
sources:
  - title: "来源名"
    url: https://...
    license: Fair-Use
summary:
  tldr: 本章一句话结论，≤120 字（超限 lint 报错）。
  keyPoints:
    - 要点一，≤80 字
    - 要点二，≤80 字
    - 要点三，≤80 字
---

<开篇导语段 100–200 字：直接切入本章问题，不要写「本章将介绍……」>

## <小节标题>

正文（论证要有结构：前提→推理→结论→反驳）。

### <更细层次，按需>

正文。

> 📝 编者注：辨析误解 / 补反例 / 指细微差别。每章 0–1 条。

## <下一小节>

正文。

> 📜 「原文引文。」 —— 作者《著作名》

<收束段：落回词条主线或抛向下一章。>

<!-- PKS_EXPANDED_V5 -->
```

**硬性要求（lint 报错项）：**
- 每章 **1200–2400 中文字**（宁可深不可水）。整条 5 章。
- 章内 `##` 分小节、`###` 更细；同章不出现两个同名 `##`。
- `slug` = `<entry-slug>/ch-NN`；`work` = `<entry-slug>`；`key` = `ch-NN`；`order: [N]`。
- **`summary.tldr` ≤ 120 字（报错）**；`keyPoints` 每条 ≤ 80 字。
- **最后一行必须是 `<!-- PKS_EXPANDED_V5 -->`**（前空一行）。每个 chapter 都要。

---

## 4. 本批允许的 categories 标题路径

只用以下之一或组合（多值用 `-` 换行）：
- `政治理论/政治思想`
- `政治理论/政治学概念`
- `政治理论/政体与国家制度`
- `政治理论/马克思主义`（本批不用，历史词条用）
- `政治理论/国际关系`  ← 新增 L2，本批 IR 组四条用此
- 跨 L1 合理组合示例：`哲学/西方哲学/近代欧陆哲学 | 政治理论/政治思想`

**每条的推荐分类见第 5 节分配。**

---

## 5. 本批 20 条目分配（slug / 标题 / 推荐分类 / 五章路线图 / 建议 see_also）

### 组 A — 政体类型（cat: 政治理论/政体与国家制度）
**A1 monarchy 君主制**
路线图：君主制的类型(世袭/选举/立宪/绝对) → 历史演化(绝对君主到君主立宪) → 君主的权力与象征功能 → 君主制 vs 共和制(优劣与当代存续) → 当代君主制的挑战
see_also: [republic, constitutionalism, democracy, authoritarianism]

**A2 totalitarianism 极权主义**
路线图：概念界定(阿伦特/弗里德里希-布热津斯基模型) → 极权 vs 威权(关键区分) → 运作机制(总意识形态/单一政党/恐怖/传媒垄断) → 历史案例与兴衰 → 当代反思(后极权/总监控)
see_also: [authoritarianism, communism, political-legitimacy, liberalism]

**A3 parliamentarism 议会制**
路线图：定义与起源(英国) → 议会制 vs 总统制(权力来源/解散权) → 政府组建与责任(信任投票) → 变体(威斯敏斯特/半总统) → 优势与脆弱性
see_also: [presidentialism, democracy, separation-of-powers, constitutionalism]

**A4 presidentialism 总统制**
路线图：定义(美国1787) → 权力结构(行政立法分立) → vs 议会制(问责/僵局) → 拉美实践与"委任民主" → 危机与改革
see_also: [parliamentarism, separation-of-powers, democracy, federalism]

### 组 B — 选举与代表（cat: 政治理论/政治学概念）
**B1 political-parties 政党**
路线图：定义与功能(代表/聚合/动员/治理) → 类型(群众党/干部党/卡特尔党;左/右) → 政党制度(一党/两党/多党) → 与民主关系(迪韦尔热定律) → 当代政党危机(去中心化/民粹化)
see_also: [electoral-systems, democracy, populism, political-legitimacy]

**B2 electoral-systems 选举制度**
路线图：类型(多数制/比例代表/混合) → 多数制(FPTP)效应(两党/地域代表) → 比例代表效应(多党/代表性) → 混合制(德国联立) → 制度如何塑造政党体系
see_also: [political-parties, democracy, parliamentarism, federalism]

**B3 direct-democracy 直接民主**
路线图：含义与古典源头(雅典) → 现代工具(公投/倡议/召回) → vs 代议民主(理性无知/多数暴政) → 数字时代(电子投票/参与式预算) → 限度
see_also: [democracy, republic, populism, civil-society]

**B4 populism 民粹主义**
路线图：定义(人民vs精英的薄意识形态) → 左翼与右翼民粹主义 → 与民主的紧张(多数vs少数/制度) → 当代崛起原因(不平等/文化反弹/媒体) → 类型学与案例
see_also: [democracy, political-parties, nationalism, liberalism]

### 组 C — 国际关系（cat: 政治理论/国际关系）
**C1 international-relations 国际关系**
路线图：学科对象与研究层次 → 无政府状态(anarchy)与主权体系 → 主要范式概览(现实/自由/建构) → 国际制度的角色 → 当代议题(全球化/安全/气候)
see_also: [sovereignty, realism-ir, balance-of-power, globalization]

**C2 realism-ir 现实主义（国际政治）**
路线图：核心假设(人性/权力/无政府) → 经典现实(马基雅维利/霍布斯/修昔底德) → 结构现实(沃尔兹) → 进攻性vs防御性现实 → 批评(忽视合作/制度)
see_also: [international-relations, balance-of-power, hegemony, machiavelli, hobbes]

**C3 balance-of-power 均势**
路线图：概念与逻辑 → 机制(内部/外部/分化) → 历史案例(欧洲均势/冷战) → 均势是否带来稳定 → 当代(多极化/中美)
see_also: [realism-ir, international-relations, hegemony, sovereignty]

**C4 hegemony 霸权**
路线图：定义(领导+强制) → 霸权稳定论(金德尔伯格/吉尔平) → 历史霸权国(荷兰/英国/美国) → 衰落逻辑 → 当代霸权竞争(中美)
see_also: [realism-ir, balance-of-power, international-relations, globalization]

### 组 D — 规范政治理论（cat: 政治理论/政治学概念）
**D1 justice 正义**
路线图：正义问题(分配/报复/程序) → 功利主义正义(边沁/密尔) → 自由至上正义(诺齐克) → 作为公平的正义(罗尔斯) → 多元与全球正义
see_also: [rawls, nozick, utilitarianism, equality, liberalism]

**D2 liberty 自由**
路线图：含义(消极/积极) → 伯林两种自由 → 密尔论自由(伤害原则) → 自由与平等的张力 → 当代议题(言论/隐私)
see_also: [berlin, john-stuart-mill, equality, liberalism, human-rights]

**D3 equality 平等**
路线图：类型(形式/实质/机会/结果) → 与自由的张力(哈耶克/德沃金) → 论证(罗尔斯差异原则) → 不平等来源与测量 → 边界(应得/贡献)
see_also: [justice, liberty, rawls, welfare-state, liberalism]

**D4 human-rights 人权**
路线图：概念与起源(自然权利/启蒙) → 文件(宣言/公约) → 哲学基础(尊严/普遍) → vs 主权(普世vs文化相对) → 实施困境
see_also: [liberty, rule-of-law, sovereignty, enlightenment, liberalism]

### 组 E — 基础概念与运动（cat: 政治理论/政治学概念；political-ideology 用 政治理论/政治思想）
**E1 political-ideology 政治意识形态**
路线图：定义(曼海姆/马克思) → 功能与结构 → 主要谱系(自由/保守/社会/民族/生态) → 左右轴与政治光谱 → 意识形态终结之争
see_also: [liberalism, conservatism, socialism, nationalism, populism]

**E2 power-politics 权力**
路线图：定义(韦伯/达尔/卢克斯三维度) → 来源(资源/制度/话语) → 权力与权威(合法性) → 谁统治?(精英/多元) → 软权力与结构性权力
see_also: [sovereignty, political-legitimacy, bureaucracy, realism-ir, c-wright-mills]

**E3 nation-state 民族国家**
路线图：民族与国家的结合(安德森) → 形成(战争/印刷资本主义) → 民族主义类型(公民/族裔) → 与主权/国际体系 → 当代挑战(跨国/分离/全球治理)
see_also: [nationalism, sovereignty, international-relations, globalization]

**E4 social-movements 社会运动**
路线图：定义与类型 → 资源动员与政治过程理论 → 新社会运动(环保/女权/身份) → 与民主/变革(非暴力/革命) → 数字时代
see_also: [civil-society, nationalism, populism, democracy]

---

## 6. see_also 白名单（仅可引用这些真实 slug）

**既有政治类**：democracy, republic, federalism, constitutionalism, authoritarianism, sovereignty, rule-of-law,
separation-of-powers, political-legitimacy, civil-society, welfare-state, bureaucracy, liberalism, conservatism,
socialism, nationalism, social-contract, political-philosophy, communitarianism, rawls, berlin, nozick, arendt,
c-wright-mills, rousseau, locke, hobbes, montesquieu, machiavelli, plato, bentham, john-stuart-mill, the-republic,
confucius, legalism, sun-yat-sen, karl-marx, engels, lenin, communism, capitalism, surplus-value,
labour-theory-of-value, das-kapital, communist-manifesto, german-ideology, anti-duhring, chinese-marxism,
cpc-history, october-revolution, on-contradiction, on-practice, imperial-exam

**跨 L1 既有**：enlightenment, french-revolution, xinhai-revolution, american-revolution, napoleonic-wars,
second-world-war, first-world-war, cold-war, dissolution-of-ussr, globalization, max-weber, social-stratification,
utilitarianism, ethics

**本批新增（同批内可互引）**：monarchy, totalitarianism, parliamentarism, presidentialism, political-parties,
electoral-systems, direct-democracy, populism, international-relations, realism-ir, balance-of-power, hegemony,
justice, liberty, equality, human-rights, political-ideology, power-politics, nation-state, social-movements

> 不得引用白名单之外的 slug。若想引某概念但不在名单，改用正文叙述，不要写进 see_also。

---

## 7. 术语与引号

- **引号**：正文用直角引号「」，内层用双引号“”，**不用英文引号**。例：「人民的统治」。
- **译名统一**（沿用本站）：密尔(非穆勒)、休谟、贝克莱、斯宾诺莎、阿奎那、罗尔斯、洛克、边沁、康德、黑格尔、韦伯、哈耶克、诺齐克、沃尔兹、阿伦特、柏林、安德森。
- **引文**用 `> 📜 「……」 —— 作者《著作名》`，每条每章 0–2 处，务求准确。**不能确证出处宁可不引，绝不编造。**
- 区分「该学派自陈」与「别人批评」，两方都要有分量；给具体文本(著作名+年代+章节)。

---

## 8. 完成前自检（每条必做）

1. `entry.md` + `chapters/ch-01..05.md` 共 6 文件齐全。
2. 每个文件的**最后一行**是 `<!-- PKS_EXPANDED_V5 -->`（前空一行）。用 Read 工具回读每个文件末 3 行确认（Write 工具偶尔会吞掉末行标记）。
3. `entry.md` 只有「导读」一个 `##`。
4. `summary.tldr` ≤ 120 字；`keyPoints` 每条 ≤ 80 字。
5. `sources` 每条 `title` 用双引号包裹。
6. `see_also` 仅含白名单 slug。
7. `categories` 用第 4 节路径。
8. 每章 1200–2400 字；整条 5 章。

完成后向主理人汇报：你负责的 4 个 slug、各文件字数、self-check 是否全过。
