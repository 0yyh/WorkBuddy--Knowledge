# PKS 内容作者统一规范（本轮：卫生/发展经济学 + 科学薄弱项 + 历史方法·古代文明 + 马政经）

你是 PKS 知识站词条作者。本文件是你**唯一规范依据**。先完整读完，再开始写。

## 1. 文件结构
每个词条目录 `content/entries/<slug>/`：
- `entry.md` —— 封面页（四段式，见 §3）
- `chapters/ch-01.md … ch-05.md` —— 5 章正文

## 2. 硬性格式（lint 会拦截，务必遵守）
- **每个文件（entry.md 与每个 ch-NN.md）的最后一行必须是 `<!-- PKS_EXPANDED_V5 -->`**（其前一行是空行）。写完后用 Read 工具回读每个文件末 3 行逐一确认。
- `entry.md` 除「导读」外不得有第二个 `##` 标题。
- 章节正文内可自由使用多个 `##` 小节标题。
- 章节 frontmatter 的 `order` **必须是数组** `order: [1]`（标量会触发 C6 报错）。
- 引号规范：外层「」，内层 ""，不用英文直引号。
- 译名：马克思、恩格斯、庇古、科斯、诺斯、皮亚杰、尤努斯、森等用标准译名。
- 引文格式：`> 📜 「……」 —— 作者《著作名》`，每章 0–2 处，**不能确证出处宁可不引（可改为 📝 编者注）**。

## 3. entry.md 四段式（封面页）
frontmatter 字段：schema(=1), slug, title, original_title, aliases, type(concept|person|event|work|term), categories(真实路径列表), tags, summary(>-，80–300字), status(published), confidence(high), license(CC-BY-SA-4.0), ai_generated(true), ai_annotated(true), created_at/updated_at(2026-09-22), rev(=1), structure(levels:[章], total_sections:5, total_words), sources(≥1条 {title 双引号, url, license}), see_also(白名单内 slug)。

正文：H1 标题 → 定位段（150–250 字）→「本词条按「章一 → 章二 → …… → 章五」五章展开。」→ `## 导读`（3–6 条 bullet）→ 可选编者注 → 空行 + `<!-- PKS_EXPANDED_V5 -->`。

## 4. chapters/ch-NN.md 模板
frontmatter：schema(=1), slug(`<slug>/ch-NN`), work(`<slug>`), key(ch-NN), title, order([N]), path([章标题]), depth(1), status(published), license(CC-BY-SA-4.0), ai_generated(true), ai_annotated(true), sources(≥1条), summary({tldr ≤120字, keyPoints 每条 ≤80字})。

正文：1200–2400 中文字，H1 标题与 frontmatter title 一致，论证有结构，章末空行 + `<!-- PKS_EXPANDED_V5 -->`。

## 5. YAML 陷阱
- `sources` 每条 `title` 一律双引号包裹（书名含 `: ` 会炸 YAML）。
- `summary.tldr` ≤120 字；`keyPoints` 每条 ≤80 字；`order`/`structure` 用数组。
- `see_also` 只能引用「已存在 slug ∪ 本组同批 slug」。

## 6. 本轮 28 条明细（slug 固定，不得改动）

### 组 W1 · 卫生经济学（分类：经济学/卫生经济学，×3）
1. `health-insurance`（医疗保险）—— 风险池与大数定律；道德风险与逆选择；单一支付 vs 多元竞争；奥巴马医改与中国医保。see_also 可用：[health-economics, healthcare-moral-hazard, cost-effectiveness-analysis, market-failure]
2. `qaly`（质量调整生命年）—— 效用测量（EQ-5D、时间权衡法）；成本效用比与阈值；年龄/残疾权重的伦理争议。see_also：[cost-effectiveness-analysis, health-economics, healthcare-moral-hazard]
3. `health-inequality`（健康不平等）—— 社会梯度（Marmot 白厅研究）；健康的社会决定因素；度量与政策。see_also：[health-economics, human-capital, development-economics]

### 组 W2 · 发展经济学（分类：经济学/发展经济学，×4）
1. `structural-change`（结构转型）—— 刘易斯二元经济与无限劳动供给；库兹涅茨结构变迁；农业→工业→服务业；过早去工业化。see_also：[development-economics, development-theory, economic-growth, labor-productivity]
2. `microfinance`（小额信贷）—— 尤努斯与格莱珉银行；团体贷款与同伴监督；RCT 证据的修正；商业化争议。see_also：[development-economics, poverty-trap, credit-creation, development-theory]
3. `human-development-index`（人类发展指数）—— Sen 能力方法；HDI 三维构造；与 GDP 的分歧；批评与 HDI 家族。see_also：[development-economics, economic-growth, national-accounts, green-gdp]
4. `foreign-aid`（对外援助）—— 援助类型与渠道；Sachs 大推力 vs Easterly 批评；援助依赖与治理；成效证据。see_also：[development-economics, poverty-trap, development-theory, capital-mobility]

### 组 W3 · 系统与复杂性（分类：科学/数学与系统科学/系统与复杂性，×3）
1. `self-organization`（自组织）—— 耗散结构（普里高津）；贝纳德对流、BZ 反应、图灵斑图；远离平衡态；序参量。see_also：[complexity, emergence, chaos-theory]
2. `network-science`（网络科学）—— 随机图（ER）vs 小世界（Watts-Strogatz）vs 无标度（Barabási-Albert）；枢纽节点与鲁棒-脆弱性；应用。see_also：[complexity, emergence, chaos-theory, game-theory]
3. `feedback-loop`（反馈回路）—— 负反馈与稳态、正反馈与增长/崩溃；时滞与振荡；系统动力学（福瑞斯特、梅多斯）。see_also：[chaos-theory, complexity, emergence]

### 组 W4 · 数学基础（分类：科学/数学与系统科学/数学基础，×3）
1. `set-theory`（集合论）—— 康托尔对角线与无穷等级；ZFC 公理化；选择公理与连续统假设的独立性。see_also：[godels-incompleteness-theorems, russell-paradox, euclidean-geometry, probability]
2. `infinity`（无穷）—— 潜无穷 vs 实无穷；希尔伯特旅馆；极限与收敛；不同大小的无穷。see_also：[set-theory, euclidean-geometry, godels-incompleteness-theorems]
3. `computability`（可计算性）—— 图灵机与邱奇-图灵论题；停机问题；可判定性与不可判定性；与不完备定理的联系。see_also：[godels-incompleteness-theorems, computer, set-theory]

### 组 W5 · 心理学分支（分类：科学/人类认知与心理/心理学分支，×4）
1. `developmental-psychology`（发展心理学）—— 皮亚杰阶段理论；维果茨基最近发展区；依恋理论；毕生发展。see_also：[psychology, emotion, memory, attention]
2. `social-psychology`（社会心理学）—— 从众（阿希）、服从（米尔格拉姆）、斯坦福实验及其批评；群际关系；可重复性危机。see_also：[psychology, cognitive-bias, emotion, heuristics]
3. `clinical-psychology`（临床心理学与心理治疗）—— 诊断与 DSM；CBT、精神分析、人本主义疗法；循证治疗；心身问题。see_also：[psychology, emotion, mental-model]
4. `behavioral-genetics`（行为遗传学）—— 双生子设计与遗传度；GWAS 与多基因评分；基因-环境交互；争议与伦理。see_also：[psychology, genetics, evolution-theory, memory]

### 组 W6 · 历史方法与概念（分类：历史/历史方法与概念，×4）
1. `periodization`（历史分期）—— 古代/中世纪/近代三分法的来历；分期的人为性与跨文化难题；全球史对分期的挑战。see_also：[historiography, historical-source, historical-causation]
2. `historical-causation`（历史因果）—— 一因多果与多因一果；近因/远因；结构 vs 事件（布罗代尔长时段）；偶然性的作用。see_also：[historiography, historical-source, periodization]
3. `counterfactual-history`（反事实历史）—— 「假如没有……」的史学价值；Ferguson《虚拟的历史》；决定论批评；计量史学中的反事实（铁路与经济增长）。see_also：[historiography, historical-causation, historical-source]
4. `archive`（档案与史料库）—— 档案的定义与权力（「档案暴力」）；档案馆的拣选与沉默；数字档案与开放获取。see_also：[historical-source, historiography, periodization]

### 组 W7 · 古代文明（分类：历史/世界史/古代文明，×4）
1. `ancient-india`（古印度文明）—— 印度河流域（哈拉帕）；吠陀时代与种姓秩序；孔雀王朝与阿育王；数学与天文学遗产。see_also：[mesopotamia, ancient-egypt, ancient-greece, buddhism]
2. `mesoamerica`（中美洲文明）—— 奥尔梅克；玛雅历法与文字；特奥蒂瓦坎；阿兹特克与西班牙征服前的美洲。see_also：[ancient-egypt, mesopotamia, ancient-greece, roman-empire]
3. `persian-empire`（波斯帝国）—— 居鲁士与大流士；行省制度与御道；希波战争；对希腊与西亚文明的影响。see_also：[mesopotamia, ancient-greece, roman-empire, arab-empire]
4. `bronze-age-collapse`（青铜时代晚期崩溃）—— 前1200年前后东地中海体系崩溃；海上民族；赫梯消亡与埃及衰落；复杂系统脆弱性的古代案例。see_also：[mesopotamia, ancient-egypt, persian-empire]

### 组 W8 · 马克思主义政治经济学（分类：政治理论/马克思主义/马克思主义政治经济学，×3）
1. `mode-of-production`（生产方式）—— 生产力与生产关系；亚细亚/古代/封建/资本主义诸形态；唯物史观的分析单元。see_also：[capitalism, karl-marx, das-kapital, german-ideology]
2. `commodity-fetishism`（商品拜物教）—— 《资本论》第一章第四节；使用价值/交换价值/价值形式；拜物教的批判锋芒；卢卡奇物化。see_also：[das-kapital, karl-marx, surplus-value, capitalism]
3. `primitive-accumulation`（原始积累）—— 圈地运动；殖民与掠夺；《资本论》第八篇；当代新生积累（哈维）。see_also：[capitalism, karl-marx, das-kapital, german-ideology]

## 7. 备注
- 引文、人名、年代、著作名务必准确；不能确证的宁可泛化或编者注，不要伪造。
- see_also 若引用「已存在 slug」以本文件所列为准；同组新 slug 之间可互引。
- 写完自查：① sources.title 双引号；② tldr ≤120 字；③ 末行标记（前一行空行）；④ see_also 合法；⑤ order 是数组。
