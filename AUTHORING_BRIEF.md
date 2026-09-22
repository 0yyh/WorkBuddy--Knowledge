# PKS 内容作者统一规范（本轮：经济学应用分支 + 科学 + 历史 补强）

你是 PKS 知识站词条作者。本文件是你**唯一规范依据**。先完整读完，再开始写。

## 1. 文件结构
每个词条目录 `content/entries/<slug>/`：
- `entry.md` —— 封面页（四段式，见 §3）
- `chapters/ch-01.md … ch-05.md` —— 5 章正文

## 2. 硬性格式（lint 会拦截，务必遵守）
- **每个文件（entry.md 与每个 ch-NN.md）的最后一行必须是 `<!-- PKS_EXPANDED_V5 -->`**（其前一行是空行）。Write 工具偶尔吞末行标记——写完后用 Read 工具回读每个文件末 3 行逐一确认。
- `entry.md` 除「导读」外不得有第二个 `##` 标题（封面只有「导读」这一个 `##`）。
- 章节正文内可自由使用多个 `##` 小节标题。
- 章节 frontmatter 的 `order` **必须是数组** `order: [1]`（不能是标量 `order: 1`，否则 C6 规则报错）。
- 引号规范：外层「」，内层 ""，不用英文直引号。
- 译名：马克思、罗尔斯、伯林、密尔、凯恩斯、科斯、诺斯、达尔文、牛顿、爱因斯坦等用标准译名；正文「」内可再用 "" 引次级。
- 引文格式：`> 📜 「……」 —— 作者《著作名》`，每章 0–2 处，不能确证出处宁可不引。

## 3. entry.md 四段式（封面页）
```
---
schema: 1
slug: <slug>
title: <中文标题>
original_title: <English Title 或留空>
aliases: [别名1, 别名2]
type: concept | person | event | work | term
categories:
  - <真实存在的分类路径，见 taxonomy.yaml>
tags: [标签1, 标签2]
summary: >-
  <定位段：80–300 字，概述该词条是什么、为何重要、核心张力>
status: published
confidence: high
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
created_at: 2026-09-22
updated_at: 2026-09-22
rev: 1
structure:
  levels: [章]
  total_sections: 5
  total_words: 8000
sources:
  - title: "英文书名/文献名（含 : 或 # 必须双引号包裹）"
    url: https://...
    license: Fair-Use
see_also: [已存在的 slug1, 已存在的 slug2]
---

# <中文标题>

<定位段：150–250 字，与 summary 衔接但不重复，说明本词条在知识地图中的位置>

本词条按「<章一主题> → <章二主题> → …… → <章五主题>」五章展开。

## 导读
- <核心要点 bullet，3–6 条>
- <……>

> 📝 编者注：<每章≤1 处编者注；可选，放在章末或封面>

<!-- PKS_EXPANDED_V5 -->
```

## 4. chapters/ch-NN.md 模板
```
---
schema: 1
slug: <slug>/ch-<NN>
work: <slug>
key: ch-<NN>
title: <第N章 标题>
order: [<N>]
path: [<第N章 标题>]
depth: 1
status: published
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
sources:
  - title: "英文书名（含 : 必须双引号）"
    url: https://...
summary:
  tldr: <≤120 字的本章摘要>
  keyPoints:
    - <≤80 字要点>
    - <……>
---

# <第N章 标题>

<正文：1200–2400 中文字，论证有结构（前提→推理→结论→反驳），区分「自陈」与「批评」，给具体文本（著作名+年代）>

<!-- PKS_EXPANDED_V5 -->
```

## 5. YAML 陷阱（必读，违反即 lint 报错）
- `sources` 每条 `title` **一律用双引号包裹**（英文书名含 `: ` 或 `#` 会炸 YAML）。
- `summary.tldr` **≤120 字**（YAML 折叠 `>-` 也计入，中文按字符数）。
- `keyPoints` 每条 **≤80 字**。
- `order`/`structure` 用数组写法。
- `see_also` **只能引用本文件第 6 节白名单里的真实 slug**（不得自创、不得引用不存在的 slug）。

## 6. 本轮 24 条明细（slug 固定，不得改动；分类与建议 see_also 见各组）

### 组 E1 · 环境经济学（分类：经济学/环境经济学）
1. `tragedy-of-commons`（公地悲剧，concept）—— 哈丁 1968《公地的悲剧》；非排他性与过度使用；与产权、国家管制的关系；反例与批评。see_also: [environmental-economics, externalities, carbon-pricing, property-rights]
2. `pigouvian-tax`（庇古税/环境税，concept）—— 庇古《福利经济学》外部性内部化；与配额/可交易许可证对比；双重红利假说；实践（碳税）。see_also: [environmental-economics, externalities, carbon-pricing, welfare-economics]
3. `green-gdp`（绿色GDP，concept）—— 对传统 GDP 的资源环境扣减；核算方法（SEEA）；中国的绿色GDP试点；局限与争议。see_also: [environmental-economics, national-accounts, economic-growth, carbon-pricing]
4. `ecological-economics`（生态经济学，concept）—— 戴利、科斯坦扎；稳态经济；自然资本；与主流环境经济学的分歧。see_also: [environmental-economics, economic-growth, sustainability]

### 组 E2 · 国际经济学（分类：经济学/国际经济学）
1. `comparative-advantage`（比较优势，concept）—— 李嘉图《政治经济学及赋税原理》1817；相对成本；赫克歇尔-俄林要素禀赋；对发展政策的含义与批评。see_also: [international-trade, protectionism, balance-of-payments, exchange-rate]
2. `capital-mobility`（资本流动，concept）—— 跨境资本流动的类型与驱动；资本账户开放；热钱与资本管制；蒙代尔-弗莱明模型。see_also: [international-trade, balance-of-payments, exchange-rate, monetary-policy]
3. `wto`（世界贸易组织，concept/term）—— 1995 取代 GATT；最惠国/国民待遇原则；争端解决机制；多哈回合停滞与批评。see_also: [international-trade, protectionism, balance-of-payments, globalization]
4. `current-account`（经常账户，concept）—— 经常账户构成（货物、服务、初次/二次收入）；与资本账户、外汇储备的关系；顺差逆差的含义。see_also: [balance-of-payments, exchange-rate, international-trade, monetary-policy]

### 组 E3 · 劳动经济学（分类：经济学/劳动经济学）
1. `wage`（工资，concept）—— 边际生产力工资理论；效率工资；最低工资；工资与生产率。see_also: [labor-economics, labor-market, human-capital, unemployment]
2. `labor-unions`（工会与集体谈判，concept）—— 工会的经济效应（工资溢价 vs 就业）；集体谈判；罢工；劳动力市场制度。see_also: [labor-economics, labor-market, unemployment, institutional-economics]
3. `labor-supply`（劳动供给，concept）—— 收入效应与替代效应；劳动力参与率；家庭生产；弹性。see_also: [labor-economics, labor-market, human-capital, wage]
4. `labor-productivity`（劳动生产率，concept）—— 定义与测度；与工资、增长的关系；技术进步的驱动；国别差异。see_also: [labor-economics, economic-growth, technological-progress]

### 组 E4 · 制度经济学（分类：经济学/制度经济学）
1. `coase-theorem`（科斯定理，concept）—— 科斯《社会成本问题》1960；零交易成本下谈判达帕累托最优；交易成本与产权界定；对庇古税的冲击。see_also: [institutional-economics, transaction-cost, property-rights, externalities]
2. `new-institutional-economics`（新制度经济学，concept）—— 诺斯、威廉姆森；制度作为约束；交易成本经济学；路径依赖。see_also: [institutional-economics, transaction-cost, property-rights, economic-history]
3. `institutional-change`（制度变迁，concept）—— 诺斯制度变迁理论；正式/非正式制度；诱致性 vs 强制性变迁；路径依赖。see_also: [institutional-economics, new-institutional-economics, property-rights, economic-history]
4. `informal-institutions`（非正式制度，concept）—— 习俗、规范、信任；与正式制度互补或冲突；发展中国家治理；社会资本。see_also: [institutional-economics, property-rights, social-capital, development-economics]

### 组 S1 · 科学（化学+天文）
1. `chemical-bond`（化学键，concept）—— 离子键、共价键、金属键；路易斯结构；键能与分子形状。see_also: [periodic-table, chemistry, atoms, molecular-structure]
2. `chemical-reaction`（化学反应，concept）—— 反应物/产物；速率与平衡（勒夏特列）；催化；能量变化（放热/吸热）。see_also: [periodic-table, chemical-bond, thermodynamics, catalysis]
3. `solar-system`（太阳系，concept）—— 行星分类（类地/巨行星）；轨道与开普勒定律；形成（星云假说）；太阳。see_also: [astronomy, big-bang, earth-science, planetary-science]
4. `galaxy`（星系，concept）—— 旋涡/椭圆/不规则星系；银河系结构；哈勃分类；星系形成与演化。see_also: [astronomy, big-bang, solar-system, cosmology]

### 组 S2 · 科学/历史 交叉薄弱项
1. `emergence`（涌现，concept）—— 整体大于部分之和；还原论局限；实例（蚁群、意识、生命）；复杂系统。分类：科学/数学与系统科学/系统与复杂性。see_also: [complexity, chaos-theory, systems-theory, network-science]
2. `attention`（注意（认知），concept）—— 选择性注意；注意资源有限性；自上而下/自下而上；认知负荷。分类：科学/人类认知与心理/认知过程。see_also: [cognitive-bias, heuristics, memory, mental-model]
3. `historical-source`（史料与史料批判，concept）—— 一手/二手史料；考据与内/外证；史料批判方法（伯伦汉、朗格诺瓦）；数字史学。分类：历史/历史方法与概念。see_also: [historiography, periodization, historical-causation, archive]
4. `ancient-greece`（古希腊文明，concept/event）—— 城邦、民主（雅典）、哲学（苏格拉底-柏拉图-亚里士多德）、科学渊源；对西方的影响。分类：历史/世界史/古代文明。see_also: [ancient-egypt, mesopotamia, roman-empire, classical-antiquity]

## 7. 备注
- 引文、人名、年代、著作名务必准确；不能确证的宁可泛化表述，不要编造具体引文。
- 章与章之间要有逻辑递进，避免重复；每章给出可验证的史实/文献锚点。
- 写完自查：① sources.title 双引号；② tldr ≤120 字；③ 末行标记；④ see_also 只在白名单内。
