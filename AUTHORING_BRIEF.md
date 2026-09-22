# PKS 内容作者统一规范（本轮：计量经济学 + 天文地球 + 中世纪 + 国际关系）

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
- 译名：李嘉图、弗里德曼、安斯康姆、韦格纳、哈丁、修昔底德、沃尔兹、温特等用标准译名。
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

## 6. 本轮 16 条明细（slug 固定，不得改动）

### 组 M1 · 计量经济学（分类：经济学/计量经济学，×4）
1. `causal-inference`（因果推断）—— 潜在结果框架（Rubin）；相关≠因果；混杂、选择偏误；随机试验与准实验的统一视角。see_also：[econometrics, instrumental-variables, ordinary-least-squares, time-series-analysis]
2. `difference-in-differences`（双重差分法）—— 前后×处理组对照组；平行趋势假设；Ashenfelter 卡 card 最低工资研究；事件研究与交错 DID 的新批评。see_also：[causal-inference, econometrics, instrumental-variables, ordinary-least-squares]
3. `panel-data`（面板数据）—— 个体/时间双维；固定效应与随机效应；组内估计；面板的优势与局限。see_also：[econometrics, ordinary-least-squares, time-series-analysis, instrumental-variables]
4. `maximum-likelihood`（最大似然估计）—— 似然函数与估计量性质（一致性/渐近正态/有效）；Probit/Logit；与 OLS 的关系。see_also：[econometrics, ordinary-least-squares, probability, time-series-analysis]

### 组 M2 · 天文与地球科学（分类：科学/自然科学基础/天文与地球科学，×4）
1. `stellar-evolution`（恒星演化）—— 主序、红巨星、超新星；赫罗图；核聚变与元素合成；白矮星/中子星/黑洞。see_also：[astronomy, big-bang, galaxy, solar-system]
2. `plate-tectonics`（板块构造）—— 韦格纳大陆漂移；海底扩张与磁条带；三大边界类型；地震火山带与构造地貌。see_also：[astronomy, solar-system, big-bang, geologic-time]
3. `geologic-time`（地质年代）—— 均变论 vs 灾变论；放射性测年；地质年代表（宙代纪世）；寒武纪大爆发与五次大灭绝。see_also：[plate-tectonics, astronomy, solar-system, evolution-theory]
4. `exoplanet`（系外行星）—— 视向速度法与凌星法；开普勒与 TESS；宜居带；热木星与超级地球。see_also：[astronomy, solar-system, stellar-evolution, galaxy]

### 组 M3 · 中世纪（分类：历史/世界史/中世纪，×4）
1. `feudalism`（封建制度）—— 采邑/附庸/领主契约；封建金字塔与王权；中日学者「封建」译名的错位；布洛赫《封建社会》与布代尔批评。see_also：[byzantine-empire, crusades, black-death, arab-empire]
2. `holy-roman-empire`（神圣罗马帝国）—— 奥托复兴；帝国与教皇的授职权之争；选帝侯与松散联邦；伏尔泰评语再审视。see_also：[byzantine-empire, crusades, feudalism, black-death]
3. `hundred-years-war`（百年战争）—— 王位继承与封建义务；长弓与骑士衰落；民族认同萌芽；圣女贞德与战争余波。see_also：[feudalism, holy-roman-empire, crusades, black-death]
4. `mongol-empire`（蒙古帝国）—— 成吉思汗统一与扩张；驿站与治理；四大汗国；对欧亚贸易与疾病传播的影响。see_also：[arab-empire, byzantine-empire, silk-road, crusades]

### 组 M4 · 国际关系（分类：政治理论/国际关系，×4）
1. `deterrence`（威慑）—— 威慑的逻辑（能力×意志×信号）；核威慑与相互确保摧毁；扩展威慑；威慑失败案例。see_also：[realism-ir, balance-of-power, hegemony, international-relations]
2. `security-dilemma`（安全困境）—— 赫茨与 Jervis；防御/进攻性武器模糊性；螺旋模型；缓解机制（透明、军控）。see_also：[realism-ir, balance-of-power, deterrence, international-relations]
3. `liberalism-ir`（自由制度主义）—— 康德永久和平与民主和平论；复合相互依存（Keohane-Nye）；制度降低交易成本；对现实主义的回应。see_also：[international-relations, realism-ir, hegemony, democracy]
4. `constructivism-ir`（建构主义）—— 温特「无政府是国家造就的」；观念/身份/规范；规范扩散与变迁；与理性主义的辩论。see_also：[international-relations, realism-ir, liberalism-ir, hegemony]

## 7. 备注
- 引文、人名、年代、著作名务必准确；不能确证的宁可泛化或编者注，不要伪造。
- see_also 若引用「已存在 slug」以本文件所列为准；同组新 slug 之间可互引。
- 写完自查：① sources.title 双引号；② tldr ≤120 字；③ 末行标记（前一行空行）；④ see_also 合法；⑤ order 是数组。
