# PKS 内容站 · 薄弱 L1 均衡补强 PRD（简单模式）

> 作者：产品经理 许清楚 ｜ 日期：2026-10-02 ｜ 模式：简单 PRD（中文，结构化）
> 依据：`content/taxonomy.yaml`、`PHILO_SPEC.md`、`AUTHORING_BRIEF.md`、`content/entries/capitalism/entry.md`
> 实测现状：全站 598 条；薄弱 L1 与现状均来自主理人提供 + 本机 `Glob`/`Grep` 核对（已确认 slug 不与现有 598 冲突）。

---

## 1. 目标总量表

| L1 | 现状 | 目标新增 | 目标总数 | 说明 |
|----|----|----|----|----|
| 法学 | 20 | +50 | 70 | 6 个 L2 平均补到 ~11–12 |
| 语言学 | 20 | +45 | 65 | 重点补最薄的社会与心理语言学(2→12) |
| 宗教 | 25 | +40 | 65 | 重点补中国宗教(2→14，其中儒教 0→5) |
| 文学 | 39 | +31 | 70 | 重点补文学理论(2→9)与文体(6→11) |
| 艺术 | 40 | +25 | 65 | 重点补设计(5→12)与建筑(4→7) |
| 技术 | 64 | +6 | 70 | 微补（可选，仅 6 条） |
| **合计** | **208** | **+197** | **405** | 新增约 **197 条 ≈ 200 条** |

> 注：强 L1（哲学/历史/科学/经济学/政治理论）均值约 88，本法学/语言学/宗教/文学/艺术目标 65–70，属「大体量均衡」取向，与用户已确认目标一致。

---

## 2. taxonomy 调整建议

### 2.1 法学（建议新增 16 个 L3 节点）
现状 6 个 L2 均为叶子节点，+50 条目后每 L2 将达 8–12 条，扁平列表不利导航。**建议**为每个 L2 增加 L3：

| 父节点(id) | 新增 L3(id / title) |
|----|----|
| law-civil 民法 | law-civil-property 物权；law-civil-obligations 债权与合同；law-civil-tort 侵权与人格权；law-civil-family 婚姻家庭与继承 |
| law-criminal 刑法 | law-criminal-general 犯罪与刑罚总论；law-criminal-offenses 具体犯罪 |
| law-juris 法理学 | law-juris-positivism 法律实证主义；law-juris-natural 自然法理论；law-juris-socio 法社会学 |
| law-constitutional 宪法与公法 | law-constitutional-rights 基本权利与人权；law-constitutional-admin 行政法学 |
| law-international 国际法 | law-intl-public 国际公法；law-intl-private 国际私法；law-intl-org 国际组织与条约 |
| law-history 法律史 | law-history-china 中国法律史；law-history-west 西方法律史 |

> **回退方案**：若主理人否决 L3 新增，本 PRD 所有法学条目落点退化为对应 L2（如 `法学/民法`），条目仍可执行，仅导航层级变浅。

### 2.2 语言学（建议新增 2 个 L3 节点）
`ling-socio-psy 社会与心理语言学` 当前 2 条、将补到 12 条，且「社会」与「心理」混为一谈不妥。**建议**拆分为：
- `ling-sociology 社会语言学`
- `ling-psychology 心理语言学`

> 其余 L1（宗教/文学/艺术/技术）**无需新增节点**：宗教的 `rel-ruism 儒教与儒家祭祀` 节点已存在（当前 0 条，仅需填内容）；文学/艺术/技术的现有 L2/L3 足以承载。

---

## 3. 具体新增词条清单（共 197 条）

格式：`slug | 中文标题 | 落点 | 优先级 | 范围说明`
优先级：P0=锚点骨架 / P1=重要扩展 / P2=深度补充。

### 3.1 法学（50）

**法理学（law-juris）**
- hart-hla | 哈特 | 法学/法理学/法律实证主义 | P0 | 现代法律实证主义代表，《法律的概念》的规制、习惯性服从与承认规则
- kelsen-pure-theory | 凯尔森纯粹法学 | 法学/法理学/法律实证主义 | P0 | 基础规范说与层级效力体系，规范法学派的纯粹性立场
- austin-command-theory | 奥斯汀主权命令说 | 法学/法理学/法律实证主义 | P1 | 早期命令论：法律为主权者命令+制裁，影响与局限
- fuller-morality-law | 富勒法律的内在道德 | 法学/法理学/自然法理论 | P1 | 八项合法性原则（富勒），程序自然法与法律的可预测目标
- dworkin-rights | 德沃金权利论 | 法学/法理学/自然法理论 | P1 | 原则、政策与权利；对规则模式的批判与「认真对待权利」
- legal-realism | 法律现实主义 | 法学/法理学/法社会学 | P1 | 美国现实主义：法律预测说、法官行为视角，反拨概念法学
- sociology-of-law | 法社会学 | 法学/法理学/法社会学 | P0 | 法律与社会结构互动、埃利希「活法」、韦伯法律类型
- critical-legal-studies | 批判法学 | 法学/法理学/法社会学 | P2 | 法律 indeterminacy、意识形态批判，对自由主义的挑战
- law-and-economics | 法律经济学 | 法学/法理学/法社会学 | P2 | 效率视角分析侵权/合同/刑法，科斯与波斯纳（cross 经济学/制度经济学）
- legal-transplant | 法律移植 | 法学/法理学/法社会学 | P2 | 法律制度的跨国继受、本土化与阻力

**宪法与公法（law-constitutional）**
- basic-rights | 基本权利 | 法学/宪法与公法/基本权利与人权 | P0 | 权利目录、水平/垂直效力、限制与比例原则
- human-rights-law | 人权法 | 法学/宪法与公法/基本权利与人权 | P0 | 国际与宪法层面人权保障、平等与不歧视
- constitutional-court | 宪法法院 | 法学/宪法与公法 | P1 | 宪法审查模式（集中/分散）、违宪审查功能
- administrative-procedure | 行政程序 | 法学/宪法与公法/行政法学 | P1 | 正当程序、听证、说明理由在行政中的适用
- administrative-litigation | 行政诉讼 | 法学/宪法与公法/行政法学 | P1 | 民告官救济、复审范围与审查强度
- freedom-of-speech | 言论自由 | 法学/宪法与公法/基本权利与人权 | P1 | 界限、事先审查、公共论坛理论
- electoral-law | 选举法 | 法学/宪法与公法 | P2 | 选举制度类型、代表制与选区划分
- constitutional-amendment | 宪法修改 | 法学/宪法与公法 | P2 | 修宪程序、刚性/柔性宪法、界限理论

**民法（law-civil）**
- civil-code | 民法典 | 法学/民法 | P0 | 法典化体例（总则/物权/合同/人格权/婚姻家庭/继承）、潘德克顿传统
- real-rights | 物权 | 法学/民法/物权 | P0 | 物权类型、所有权与用益物权、物权变动公示原则
- obligation-law | 债权法 | 法学/民法/债权与合同 | P0 | 债的发生/履行/保全/移转，与合同法衔接
- unjust-enrichment | 不当得利 | 法学/民法/债权与合同 | P2 | 无法律上原因获利之返还
- personality-rights | 人格权 | 法学/民法/侵权与人格权 | P1 | 生命/健康/姓名/名誉等人格权益保护
- family-law | 婚姻家庭法 | 法学/民法/婚姻家庭与继承 | P1 | 结婚/夫妻财产/离婚/亲子，身份关系特殊性
- inheritance-law | 继承法 | 法学/民法/婚姻家庭与继承 | P1 | 法定继承与遗嘱继承、特留份
- agency-law | 代理 | 法学/民法/债权与合同 | P2 | 代理权、显名/隐名代理、表见代理

**刑法（law-criminal）**
- theory-of-crime | 犯罪构成理论 | 法学/刑法/犯罪与刑罚总论 | P0 | 三阶层（该当/违法/有责）或四要件，归责框架
- criminal-responsibility | 刑事责任 | 法学/刑法/犯罪与刑罚总论 | P1 | 责任能力、年龄、违法性认识可能性
- punishment-theory | 刑罚论 | 法学/刑法/犯罪与刑罚总论 | P1 | 报应/预防目的、刑种与量刑
- criminal-intent | 犯罪故意与过失 | 法学/刑法/犯罪与刑罚总论 | P1 | 故意/过失区分、认识错误
- inchoate-crime | 未完成罪 | 法学/刑法/犯罪与刑罚总论 | P2 | 预备/未遂/中止的处罚根据
- homicide | 杀人罪 | 法学/刑法/具体犯罪 | P1 | 故意杀人/过失致死、情节与死刑争议
- property-crime | 财产犯罪 | 法学/刑法/具体犯罪 | P2 | 盗窃/诈骗/抢劫的构造
- white-collar-crime | 白领犯罪 | 法学/刑法/具体犯罪 | P2 | 经济犯罪、背信与职务犯罪的界定

**国际法（law-international）**
- international-court | 国际法院 | 法学/国际法/国际公法 | P0 | 管辖权、渊源（条约/习惯）、判决执行力局限
- international-human-rights | 国际人权法 | 法学/国际法/国际公法 | P0 | 公约体系、个人申诉、普遍管辖权
- law-of-sea | 海洋法 | 法学/国际法/国际公法 | P1 | 领海/专属经济区/公海、UNCLOS 制度
- diplomatic-law | 外交与领事关系法 | 法学/国际法/国际公法 | P1 | 豁免、特权、维也纳公约
- sovereign-immunity | 国家豁免 | 法学/国际法/国际公法 | P2 | 绝对/限制豁免、商业交易例外
- international-org | 国际组织法 | 法学/国际法/国际组织与条约 | P1 | 国际组织法律人格、表决权与责任
- international-criminal-law | 国际刑法 | 法学/国际法/国际公法 | P2 | 国际刑事法院、灭绝种族/战争罪管辖
- wto-law | 世界贸易组织法 | 法学/国际法/国际组织与条约 | P1 | 最惠国/国民待遇、争端解决机制（cross 国际经济学）

**法律史（law-history）**
- chinese-legal-tradition | 中华法系 | 法学/法律史/中国法律史 | P0 | 礼法合一、刑鼎至律令、东亚影响
- civil-law-tradition | 大陆法系 | 法学/法律史 | P0 | 罗马法—法典化传统（与英美法系对照）
- magna-carta | 大宪章 | 法学/法律史/西方法律史 | P0 | 王权受限、法治与议会源流
- tang-code | 唐律 | 法学/法律史/中国法律史 | P1 | 唐律疏议、十恶与礼入法
- code-napoleon | 拿破仑法典 | 法学/法律史/西方法律史 | P1 | 法国民法典、所有权绝对与过错责任
- canon-law | 教会法 | 法学/法律史/西方法律史 | P1 | 教会法体系及其对世俗法影响
- hammurabi-code | 汉谟拉比法典 | 法学/法律史/西方法律史 | P1 | 早期成文法、同态复仇与神授王权
- qing-code | 清律 | 法学/法律史/中国法律史 | P2 | 大清律例、例的扩张与晚清修律

### 3.2 语言学（45）

**普通语言学（ling-general）**
- language-universal | 语言普遍性 | 语言学/普通语言学 | P1 | 普遍语法特征、类型共性（Greenberg）
- typology-linguistic | 语言类型学 | 语言学/普通语言学 | P0 | 形态/语序类型（SOV/SVO）、类型参项
- sapir-whorf | 萨丕尔-沃尔夫假说 | 语言学/普通语言学 | P1 | 语言相对论：语言结构影响思维
- speech-act | 言语行为理论 | 语言学/普通语言学 | P0 | 奥斯汀/塞尔：言内/言外/言后行为
- discourse-analysis | 话语分析 | 语言学/普通语言学 | P1 | 篇章衔接、会话结构、批评话语分析
- corpus-linguistics | 语料库语言学 | 语言学/普通语言学 | P1 | 大规模真实语料、频率与搭配
- cognitive-linguistics | 认知语言学 | 语言学/普通语言学 | P0 | 范畴化、隐喻、意象图式（Lakoff）
- conversational-implicature | 会话含义 | 语言学/普通语言学 | P1 | 格赖斯合作原则与推断
- deixis | 指示语 | 语言学/普通语言学 | P2 | 人称/时间/处所指示与语境依赖
- grammaticalization | 语法化 | 语言学/普通语言学 | P1 | 词汇→语法功能的演变机制

**语音与音系（ling-phon）**
- intonation | 语调 | 语言学/语音与音系 | P1 | 音高曲拱、焦点与语气功能
- syllable-structure | 音节结构 | 语言学/语音与音系 | P2 | 音首/韵腹/韵尾、音节音系约束
- phonology-optimality | 优选论音系 | 语言学/语音与音系 | P2 | 生成器+制约条件评估（Prince/Smolensky）
- articulation | 发音语音学 | 语言学/语音与音系 | P1 | 发音器官、辅音/元音的发音特征
- sound-change | 语音演变 | 语言学/语音与音系 | P1 | 音变规律（如格里姆定律）、规则性与例外
- prosody | 韵律 | 语言学/语音与音系 | P2 | 重音/节奏/声调的超音段组织
- phonological-feature | 音系特征 | 语言学/语音与音系 | P2 | 区别特征矩阵、特征几何
- acoustic-phonetics | 声学语音学 | 语言学/语音与音系 | P1 | 声谱、共振峰、语音声学参数

**句法与语义（ling-syntax-sem）**
- dependency-grammar | 依存语法 | 语言学/句法与语义 | P2 | 依存关系 vs 短语结构
- chomsky-hierarchy | 乔姆斯基谱系 | 语言学/句法与语义 | P1 | 形式语法层级（0/1/2/3 型）
- lexical-semantics | 词汇语义学 | 语言学/句法与语义 | P1 | 义素、词义关系（同义/反义/上下义）
- thematic-roles | 题元角色 | 语言学/句法与语义 | P2 | 施事/受事等格角色与论元结构
- binding-theory | 约束理论 | 语言学/句法与语义 | P2 | 照应/代词/指称的约束条件（A/B/C）
- functional-grammar | 功能语法 | 语言学/句法与语义 | P1 | 句法形式的功能动因（类型学取向）
- transformational-grammar | 转换语法 | 语言学/句法与语义 | P1 | 深层/表层结构、移位规则
- compositionality | 组合性原则 | 语言学/句法与语义 | P1 | 整体意义由部分与结构决定

**历史语言学（ling-historical）**
- language-change | 语言演变 | 语言学/历史语言学 | P0 | 语音/形态/语义/句法的变化机制
- reconstruction-comparative | 历史比较重建 | 语言学/历史语言学 | P1 | 同源词、构拟原始形式的方法
- language-contact | 语言接触 | 语言学/历史语言学 | P1 | 借用、混合语、语言联盟
- sino-tibetan | 汉藏语系 | 语言学/历史语言学 | P0 | 汉语与藏缅等亲属关系、分类争议
- proto-language | 原始语 | 语言学/历史语言学 | P2 | 原始共同语构拟与树形分化
- genetic-classification | 谱系分类 | 语言学/历史语言学 | P1 | 语系/语族/语支的亲缘层级
- etymology | 词源学 | 语言学/历史语言学 | P2 | 词形与词义的历史溯源
- language-death | 语言消亡 | 语言学/历史语言学 | P1 | 濒危语言、语言转用与复兴
- borrowing-loanword | 借词 | 语言学/历史语言学 | P2 | 词汇借用类型与汉化（音译/意译）

**社会与心理语言学（ling-socio-psy，建议拆 L3）**
- language-variety | 语言变体 | 语言学/社会与心理语言学/社会语言学 | P1 | 方言/标准语/语域的连续统
- sociolinguistic-variation | 社会语言学变异 | 语言学/社会与心理语言学/社会语言学 | P1 | Labov 变异研究、社会变量与语言变量
- bilingualism | 双语现象 | 语言学/社会与心理语言学/社会语言学 | P1 | 双语习得、语码转换
- language-policy | 语言政策 | 语言学/社会与心理语言学/社会语言学 | P1 | 官方语言、语言规划与权利
- diglossia | 双语体现象 | 语言学/社会与心理语言学/社会语言学 | P2 | 高低变体分工（Fishman）
- language-ideology | 语言意识形态 | 语言学/社会与心理语言学/社会语言学 | P2 | 语言态度、标准语神话
- speech-production | 言语产生 | 语言学/社会与心理语言学/心理语言学 | P2 | 从概念到发音的编码阶段
- speech-perception | 言语感知 | 语言学/社会与心理语言学/心理语言学 | P2 | 音位恢复、范畴感知
- reading-process | 阅读心理 | 语言学/社会与心理语言学/心理语言学 | P2 | 字词识别、眼动与阅读发展
- aphasiology | 失语症 | 语言学/社会与心理语言学/心理语言学 | P2 | 失语类型与语言模块定位

### 3.3 宗教（40）

**宗教史（rel-history）**
- primitive-religion | 原始宗教 | 宗教/宗教史 | P1 | 图腾、巫术、万物有灵（Tylor/Frazer）
- shamanism | 萨满教 | 宗教/宗教史 | P1 | 出神技术、通灵与北亚/北极分布
- ancient-near-east-religion | 古代近东宗教 | 宗教/宗教史 | P2 | 美索不达米亚/埃及多神与一神源流
- greco-roman-religion | 古希腊罗马宗教 | 宗教/宗教史 | P2 | 城邦祭祀、神谕与帝国多神
- religious-syncretism | 宗教融合 | 宗教/宗教史 | P2 | 文化接触中的信仰混合（密特拉、诺斯替等）

**基督教（rel-christianity）**
- paul-apostle | 保罗 | 宗教/世界宗教/基督教 | P1 | 外邦传教、保罗书信与普世化
- catholicism | 天主教 | 宗教/世界宗教/基督教 | P1 | 教阶、圣事与罗马权威
- eastern-orthodoxy | 东正教 | 宗教/世界宗教/基督教 | P1 | 拜占庭传统、圣像与东西分裂
- protestantism | 新教 | 宗教/世界宗教/基督教 | P2 | 因信称义、改革宗/路德宗分流
- christian-theology | 基督教神学 | 宗教/世界宗教/基督教 | P2 | 三位一体/救赎/恩典的系统论述

**伊斯兰教（rel-islam）**
- sunni-islam | 逊尼派 | 宗教/世界宗教/伊斯兰教 | P1 | 大众派、四大法学派与哈里发观
- shia-islam | 什叶派 | 宗教/世界宗教/伊斯兰教 | P1 | 伊玛目继承、十二伊玛目与伊斯玛仪
- sufism | 苏菲派 | 宗教/世界宗教/伊斯兰教 | P2 | 神秘主义、修持与诗歌
- sharia | 伊斯兰教法 | 宗教/世界宗教/伊斯兰教 | P0 | 沙里亚渊源（古兰/圣训/类比/公议）

**佛教（rel-buddhism）**
- theravada | 上座部佛教 | 宗教/世界宗教/佛教 | P1 | 巴利传统、南传与戒律
- mahayana | 大乘佛教 | 宗教/世界宗教/佛教 | P0 | 菩萨道、空性与普度
- pure-land | 净土宗 | 宗教/世界宗教/佛教 | P2 | 念佛往生、他力本愿
- tibetan-buddhism | 藏传佛教 | 宗教/世界宗教/佛教 | P1 | 显密兼备、活佛与宗派
- buddhist-cosmology | 佛教宇宙观 | 宗教/世界宗教/佛教 | P2 | 三界六道、轮回与劫

**印度教（rel-hinduism）**
- vedas | 吠陀 | 宗教/世界宗教/印度教 | P0 | 四吠陀与早期祭祀传统
- upanishads | 奥义书 | 宗教/世界宗教/印度教 | P0 | 梵我合一、终极知识（与 brahman 互补）
- vishnu-shiva | 毗湿奴与湿婆 | 宗教/世界宗教/印度教 | P2 | 两大主神谱系与化身
- yoga-religion | 瑜伽 | 宗教/世界宗教/印度教 | P1 | 瑜伽体系（王瑜伽等）与解脱之道

**犹太教（rel-judaism）**
- rabbinic-judaism | 拉比犹太教 | 宗教/世界宗教/犹太教 | P1 | 塔木德传统、口传律法
- jewish-law | 犹太法（哈拉卡） | 宗教/世界宗教/犹太教 | P2 | 哈拉卡体系（与教规/民法交叉）

**中国宗教·民间信仰（rel-folk）**
- ancestor-worship | 祖先崇拜 | 宗教/中国宗教/民间信仰 | P1 | 慎终追远、祭祖与宗族
- taoist-popular-cult | 民间道教信仰 | 宗教/中国宗教/民间信仰 | P2 | 俗神/符箓/醮仪的下层实践
- chinese-folk-deity | 民间神灵 | 宗教/中国宗教/民间信仰 | P2 | 地方神祇、城隍/土地/妈祖

**中国宗教·道教（rel-daoism）**
- daoist-canon | 道藏 | 宗教/中国宗教/道教 | P2 | 道教经典集成与分类
- daoist-practice | 道教修炼 | 宗教/中国宗教/道教 | P1 | 内丹/外丹、斋醮与养生
- zhang-daoling | 张道陵 | 宗教/中国宗教/道教 | P2 | 五斗米道创立、天师世系
- daoist-philosophy | 道教哲学 | 宗教/中国宗教/道教 | P2 | 道/气/神仙观的理论化

**中国宗教·儒教（rel-ruism，当前 0 条）**
- confucian-ritual | 儒家祭祀 | 宗教/中国宗教/儒教与儒家祭祀 | P0 | 郊社/宗庙/释奠的礼制性质
- confucian-temple | 孔庙与文庙 | 宗教/中国宗教/儒教与儒家祭祀 | P2 | 庙学合一、从祀制度
- state-confucianism | 国家儒学 | 宗教/中国宗教/儒教与儒家祭祀 | P1 | 政教关系、科举与礼制国家
- confucian-sacrifice | 祭孔 | 宗教/中国宗教/儒教与儒家祭祀 | P2 | 释奠礼的沿革与当代
- rujiao-modern | 当代儒教运动 | 宗教/中国宗教/儒教与儒家祭祀 | P2 | 儒教是否宗教的争论与现代重建

**宗教哲学（rel-philosophy）**
- mysticism | 神秘主义 | 宗教/宗教哲学 | P1 | 与绝对合一的体验（各传统共性）
- analogical-language | 类比语言论 | 宗教/宗教哲学 | P2 | 有限语言论说上帝（托马斯/麦奎利）
- reason-revelation | 理性与启示 | 宗教/宗教哲学 | P1 | 信仰与理性的调和（安瑟伦/阿奎那）

### 3.4 文学（31）

**文学理论（lit-theory）**
- narratology | 叙事学 | 文学/文学理论/叙事学 | P0 | 故事/话语二分、叙事功能（Propp/Genette）
- focalization | 聚焦 | 文学/文学理论/叙事学 | P1 | 视角类型（零/内/外聚焦）
- unreliable-narrator | 不可靠叙述者 | 文学/文学理论/叙事学 | P1 | 叙述者不可信的修辞效果
- lyric-poetry | 抒情诗 | 文学/文学理论/诗学 | P1 | 抒情主体、意象与音乐性
- reception-theory | 接受理论 | 文学/文学理论 | P0 | 期待视野、读者作用（姚斯/伊瑟尔）
- feminist-criticism | 女性主义批评 | 文学/文学理论 | P1 | 性别、父权批评与重写
- postcolonial-criticism | 后殖民批评 | 文学/文学理论 | P1 | 东方主义、失语与杂合（萨义德/斯皮瓦克）

**文体与体裁（lit-genre）**
- bildungsroman | 成长小说 | 文学/文体与体裁/小说 | P2 | 教育小说类型（歌德—经典传统）
- stream-of-consciousness | 意识流小说 | 文学/文体与体裁/小说 | P1 | 内心独白技法（伍尔夫/乔伊斯）
- sonnet | 十四行诗 | 文学/文体与体裁/诗歌 | P1 | 彼特拉克/莎士比亚体格律
- classical-chinese-poetics | 中国古典诗学 | 文学/文体与体裁/诗歌 | P1 | 言志/意境/格调说
- comedy-genre | 喜剧 | 文学/文体与体裁/戏剧 | P1 | 讽刺/幽默机制（对照悲剧）
- essay-genre | 散文 | 文学/文体与体裁 | P2 | 随笔/小品文的传统与功能

**世界文学·亚非（lit-asia-africa）**
- arabic-literature | 阿拉伯文学 | 文学/世界文学/亚非文学 | P1 | 贾希利叶诗歌—《一千零一夜》—现代
- persian-literature | 波斯文学 | 文学/世界文学/亚非文学 | P1 | 鲁米/哈菲兹、波斯诗歌
- japanese-literature | 日本文学 | 文学/世界文学/亚非文学 | P0 | 物语/俳句/私小说脉络
- indian-literature | 印度文学 | 文学/世界文学/亚非文学 | P1 | 梵语文学—近现代多语写作
- african-literature | 非洲文学 | 文学/世界文学/亚非文学 | P1 | 口传—阿契贝/索因卡（衔接现有亚非条目）

**中国文学·古代（lit-china-classical）**
- ci-poetry | 宋词 | 文学/中国文学/古代文学 | P1 | 词体、婉约/豪放与音乐性
- yuan-qu | 元曲 | 文学/中国文学/古代文学 | P2 | 杂剧/散曲的戏曲文学
- tang-song-prose | 唐宋古文 | 文学/中国文学/古代文学 | P2 | 古文运动、八家与唐宋文脉

**中国文学·近现代（lit-china-modern）**
- may-fourth-literature | 五四文学 | 文学/中国文学/近现代文学 | P0 | 白话文运动与人的文学
- left-wing-literature | 左翼文学 | 文学/中国文学/近现代文学 | P1 | 左联、普罗文学与社会关怀
- misty-poetry | 朦胧诗 | 文学/中国文学/近现代文学 | P1 | 1970s 末诗潮、意象与隐喻
- xiangtu-literature | 乡土文学 | 文学/中国文学/近现代文学 | P2 | 乡村书写与地域文化

**世界文学·欧美（lit-europe）**
- russian-literature | 俄罗斯文学 | 文学/世界文学/欧美文学 | P0 | 19 世纪巨匠与白银时代
- french-literature | 法国文学 | 文学/世界文学/欧美文学 | P1 | 古典—现代主义脉络
- english-literature | 英国文学 | 文学/世界文学/欧美文学 | P1 | 莎士比亚后小说与现代主义
- american-literature | 美国文学 | 文学/世界文学/欧美文学 | P1 | 独立后民族文学与多元声音
- german-literature | 德国文学 | 文学/世界文学/欧美文学 | P2 | 启蒙—浪漫—现代
- latin-american-literature | 拉美文学 | 文学/世界文学/欧美文学 | P1 | 魔幻现实主义与文学爆炸

### 3.5 艺术（25）

**艺术史（art-history）**
- neoclassicism | 新古典主义 | 艺术/艺术史 | P1 | 尚古、理性与公民美德（大卫）
- romanticism-art | 浪漫主义艺术 | 艺术/艺术史 | P1 | 情感/自然/个体（德拉克罗瓦）
- realism-art | 现实主义艺术 | 艺术/艺术史 | P2 | 库尔贝、面向当下的再现

**绘画（art-painting）**
- watercolor | 水彩画 | 艺术/视觉艺术/绘画 | P2 | 透明媒材与水韵技法
- fresco | 湿壁画 | 艺术/视觉艺术/绘画 | P2 | 湿灰泥上作画的传统
- byzantine-art | 拜占庭艺术 | 艺术/视觉艺术/绘画 | P2 | 圣像与金色背景

**雕塑（art-sculpture）**
- relief-sculpture | 浮雕 | 艺术/视觉艺术/雕塑 | P2 | 浅/高浮雕与建筑结合
- installation-art | 装置艺术 | 艺术/视觉艺术/雕塑 | P2 | 空间/现成品的场域艺术
- public-sculpture | 公共雕塑 | 艺术/视觉艺术/雕塑 | P2 | 纪念性/城市公共艺术

**音乐（art-music）**
- romantic-music | 浪漫主义音乐 | 艺术/音乐 | P1 | 标题音乐、情感扩张（柏辽兹/舒曼）
- baroque-music | 巴洛克音乐 | 艺术/音乐 | P2 | 通奏低音、对位与数字低音
- chinese-opera | 中国戏曲 | 艺术/音乐 | P0 | 歌舞演故事、程式与腔系
- folk-music | 民间音乐 | 艺术/音乐 | P2 | 口传、地方乐种与活态传承

**建筑（art-architecture）**
- roman-architecture | 罗马建筑 | 艺术/建筑 | P1 | 拱券/混凝土/公共工程
- chinese-garden | 中国园林 | 艺术/建筑 | P1 | 借景/叠山理水与文人意趣
- international-style | 国际式 | 艺术/建筑 | P2 | 形式追随功能、白盒子（cross 现代建筑）

**影视与新媒体（art-film）**
- documentary-film | 纪录片 | 艺术/影视与新媒体 | P1 | 真实再现、直接电影与观察式
- cinema-history | 电影史 | 艺术/影视与新媒体 | P1 | 从默片到数字的技术与美学分期
- video-art | 录像艺术 | 艺术/影视与新媒体 | P2 | 影像装置与单频录像

**设计（art-design）**
- visual-identity | 视觉识别系统 | 艺术/设计/平面与视觉传达 | P2 | 标志/色彩/应用规范
- editorial-design | 书籍装帧设计 | 艺术/设计/平面与视觉传达 | P2 | 网格、排版与阅读体验
- information-design | 信息设计 | 艺术/设计/平面与视觉传达 | P2 | 图表/导视的数据可视化
- furniture-design | 家具设计 | 艺术/设计/产品与工业 | P2 | 功能/材料/工艺结合
- automotive-design | 汽车设计 | 艺术/设计/产品与工业 | P2 | 造型、空气动力与品牌
- ui-design | 界面设计 | 艺术/设计/产品与工业 | P2 | 人机界面（cross 技术/信息技术）

### 3.6 技术（6，微补）

- internet-of-things | 物联网 | 技术/信息技术 | P1 | 物物互联、传感网与边缘计算
- blockchain | 区块链 | 技术/信息技术 | P1 | 分布式账本、共识与智能合约
- ai-chip | 人工智能芯片 | 技术/信息技术 | P2 | GPU/NPU 与算力专门化
- electric-vehicle | 电动汽车 | 技术/交通与制造 | P2 | 三电系统（电池/电机/电控）
- 3d-printing | 增材制造 | 技术/交通与制造 | P2 | 3D 打印原理与材料
- data-center | 数据中心 | 技术/信息技术 | P2 | 算力基础设施与能耗

---

## 4. 批次划分（共 11 批，按类目+优先级聚拢；无强依赖，按薄弱度排序）

| 批次 | 内容 | 条数 | 备注 |
|----|----|----|----|
| B1 | 法学·P0 骨架（法理学/宪法/民法/刑法/国际法/法律史各锚点） | 14 | 最先建骨架 |
| B2 | 法学·P1 扩展 | 22 | 承接 B1 |
| B3 | 法学·P2 深度补充 | 14 | 法学收尾 |
| B4 | 语言学·核心 P0/P1（普通/历史/社会语言学/部分语音） | 23 | |
| B5 | 语言学·P2 细分（语音/句法/心理/词源） | 22 | |
| B6 | 宗教·P0/P1 核心（世界宗教+中国宗教主条目+宗教哲学） | 20 | |
| B7 | 宗教·P2 细分（宗教史/教派/中国宗教补充） | 20 | |
| B8 | 文学·理论+体裁+世界文学（亚非/欧美）P0/P1 | 24 | |
| B9 | 文学·中国文学（古代/近现代） | 7 | 小批（剩余量） |
| B10 | 艺术·全类（史/绘画/雕塑/音乐/建筑/影视/设计） | 25 | |
| B11 | 技术·微补（6 条） | 6 | 小批，可选类目 |

> 说明：B9、B11 因剩余量/可选类目小于 15 条，为有意设置的小尾批；其余均落在 15–25 区间。建议执行顺序 B1→B3（法学）→B4→B5（语言学）→B6→B7（宗教）→B8→B9（文学）→B10→B11（艺术/技术）。每批内 slug 已规划互相 see_also（同批可互引，跨批引用须待目标 slug 落地后补链）。

---

## 5. 待确认 / 假设

### 5.1 假设（默认成立，除非主理人否定）
1. **篇幅与格式**：每条严格遵循 `PHILO_SPEC.md`/`AUTHORING_BRIEF.md`——entry 四段式 + 5 章正文（约 7000–11000 字）、末行 `<!-- PKS_EXPANDED_V5 -->`、YAML 字段与陷阱（sources.title 双引号、tldr≤120 字、order 数组、see_also 白名单）。
2. **see_also 互链**：同批内互引；跨批引用在目标 slug 已存在后补全；优先链向同 L2 及相邻 L1（如 法学↔政治理论、语言学↔科学/认知、宗教↔哲学、文学↔历史、艺术↔技术）。
3. **来源署名**：现当代概念/人物用 `CC-BY-SA-4.0`；古典/公有领域用 `public-domain`（仿 capitalism 样例）。
4. **译名**：遵循 `PHILO_SPEC.md §5` 统一译名表；法学/宗教专有名词用大陆通译（凯尔森、德沃金、什叶派、奥义书等）。人名、年代、著作名须准确，不能确证的宁用 📝 编者注不伪造引文。
5. **落点回退**：若 §2 的 L3 未批准，法学/语言学条目落点退化为对应 L2 标题路径。
6. **范围边界**：本次只补强 6 个指定 L1，不新增强 L1 词条；不修改现有 598 条。

### 5.2 需主理人拍板
1. **taxonomy L3 是否批准**？法学 16 节点 + 语言学 2 节点（见 §2）。否决则落点退化为 L2。
2. **目标总量确认**？法学70/语言学65/宗教65/文学70/艺术65/技术70。注文学现有 38–39（实测略低于提供的 39），+31 后约 69–70，是否接受。
3. **技术 6 条是否执行**？还是仅聚焦 5 个薄弱 L1（则新增 191 条）。
4. **优先级口径**：P0=锚点骨架（每 L2 先建）、P1=重要扩展、P2=深度补充——是否认可本 PRD 的 P0/P1/P2 分配。
5. **儒教条目定位**：`rel-ruism` 当前 0 条，是否按「宗教条目」规范撰写（含祭祀/礼制/政教关系），避免与「哲学/中国哲学」内容重复；跨标 `哲学/中国哲学` 是否必要。
6. **跨 L1 双向 categories**：`law-and-economics`、`wto-law`、`ui-design`、`yoga-religion`、`chinese-opera`（可跨 `文学/文体与体裁/戏剧`）等是否同时打第二 L1 标签。

---

## 附：slug 唯一性核对
已通过 `ls content/entries`（598 目录）逐条比对，本 PRD 全部 197 个 slug 均与现有不冲突，且彼此互不重复。建议工程师建批前用 `scripts` 中现有 census/lint 脚本复验。
