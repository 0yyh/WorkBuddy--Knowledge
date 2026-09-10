# 内容目录（content/）编写规范

> 本目录是站点的**唯一内容源**。所有正文都是纯 markdown 文件；索引（`.index/`）与影子树（`_browse/`）
> 都是构建期派生产物，**不要手改、不要提交**。
> 校验命令：`npm run lint`（0 error 才算通过）。构建顺序见根 `README.md`。

## 目录布局

```
content/
├── taxonomy.yaml        类目体系（唯一权威，改节点标题会破坏引用它的旧词条）
├── entries/<slug>/
│   ├── entry.md         著作/概念/人物级元数据 + 导读
│   └── chapters/ch-01.md 章节（作品按章拆分）
├── tracks/<id>.yaml     学习序列 / 时间线（前端自动列出，新增无需改代码）
├── dict/dictionary.json 离线词典数据资源（随包与内容更新下发）
├── .index/              build:index 产物（gitignore）
└── _browse/             browse:gen 影子树（gitignore）
```

## entry.md（著作级）

front-matter 必填：`schema`、`slug`、`title`、`type`、`categories`、`summary`、`status`、`sources`。

| 字段 | 约束 |
| --- | --- |
| `slug` | `^[a-z0-9]+(-[a-z0-9]+)*$`（小写、连字符分隔）；须与所在目录名一致 |
| `type` | `concept` \| `work` \| `person` \| `event` \| `term` |
| `categories` | 用**标题路径**引用 `taxonomy.yaml`（如 `科学/自然科学基础/物理`、`哲学/西方哲学/中世纪哲学`）；至少 1 项 |
| `summary` | 80–300 字（<80 仅告警，>300 报错）。折叠标量按**去换行去空格的纯字符串**计长 |
| `status` | `published` \| `stub` \| `draft` \| `deprecated` |
| `sources` | 至少 1 条，每条需有 `title`（溯源要求） |
| `aliases` / `tags` | 字符串数组，可选 |
| `see_also` | 相关词条 slug 数组，可选（目标须存在，否则 lint 告警） |
| `sort_date` | 数字；公元前取负数（用于时间线排序） |

## chapters/*.md（章节级）

front-matter 必填：`slug`、`work`、`key`、`title`、`order`、`depth`。

| 字段 | 约束 |
| --- | --- |
| `slug` | 惯例为 `<work-slug>/ch-NN` |
| `work` | 所属 `entry.md` 的 slug |
| `key` | 章节 key，如 `ch-01` |
| `order` | 1–3 长度数字数组，YAML 里写成 `order: [1]`（写成字符串会告警） |
| `depth` | `1` \| `2` \| `3` |
| `kind` | `content`（默认，有正文）\| `container`（仅分组，如「卷」，不计字数、可无 summary） |
| `summary.tldr` | **≤ 120 字**，超长报错 |
| `summary.keyPoints` | 最多 8 条，单条 ≤ 80 字（超限仅告警） |

正文字数硬上限 20000 字/章（`container` 不计入）。

## ⚠️ YAML 编写陷阱（lint 高频报错）

- **列表项不能以引号开头**。`- "适"指…` / `- “转形问题”…` 会被 YAML 当作未闭合引号标量，
  报 `bad indentation of a sequence entry`。把引号挪到句中即可（`- 适者生存中的适指…`）。
- 值里含 `: `（冒号加空格）或 `#` 时需加引号（如 `date_label: "约公元前300年"`）；
  纯中文短句一般无需加引号。
- `>` / `>-` 折叠标量的长度校验按去空白后的纯字符串计，别靠换行凑字数。

## tracks/*.yaml（学习序列 / 时间线）

```yaml
id: philosophy-history          # 必填，唯一
title: 哲学史主线
category: 哲学                   # 展示用分组（自由文本）
order_mode: chronological       # chronological | difficulty | dependency | school_then_chronological
timeline: world                 # 可选，只接受 world | china
description: 一句话说明
items:
  - order: "1"
    entry: plato                # 必填，须为已存在的 slug
    sort_date: -387             # 数字，公元前为负
    date_label: "公元前387年"
    era: "古代"                  # 古代 / 中世纪 / 近代 / 现当代
    note: "柏拉图创学园"
    cross_timeline: true        # 可选：该词条同时出现在双轨
```

注意事项：

- `items[].entry` 必须指向存在的 slug，`order` 为字符串。
- **`timeline` 只接受 `world` / `china`**。首页「中国史 / 世界史」计数只统计带该字段的序列；
  跨领域序列（哲学史 / 科技史 / 跨领域对照）**不要设 `timeline`**，否则会污染首页计数。
- **lint `L005`**：若某词条在序列里标了 `cross_timeline: true`，则其 **entry.md 自身的
  `timeline` 维度必须 ≥2**，否则告警。跨领域新序列建议**不标** `cross_timeline`。
- 前端（顶部导航 / `/timeline` / 首页）**动态遍历全部序列**，新增轨道无需改任何代码。

## taxonomy.yaml

- 六大 L1：`历史 / 哲学 / 科学 / 经济学 / 政治理论 / 技术`，每个节点有 `id`、`title`、`order`、可选 `children`。
- 词条通过**标题路径**引用节点；**改/删节点标题会破坏所有引用它的旧词条**，请谨慎。

## 常用流程

```bash
npm run lint          # 先校验内容
npm run build:index   # content/ -> content/.index/
npm run content:copy  # -> apps/web/public/content/（.index 改名 index）
npm run build:web     # 或 npm run build
npm run build:update  # 生成局域网更新包 release/latest/
```
