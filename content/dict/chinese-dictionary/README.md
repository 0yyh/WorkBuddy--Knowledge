# 汉字词典资源（chinese-dictionary / character）

本目录收录从外部开源词典仓库 `chinese-dictionary-main` 的 `character/` 文件夹导入的
**单汉字**词典数据，供 PKS 项目引用（离线词典，随包 / OTA 下发到 web 与 Android）。

## 导入范围与排除项

- ✅ 仅导入源 `character/` 文件夹内的全部词典文件（见下）。
- ⛔ **明确排除** `idiom.json`（成语）与 `word.json`（词语），二者本次暂不引入。
  （如后续需要，可在此目录下新增 `idiom/`、`word/` 子目录对称扩展。）

## 目录结构

```
content/dict/chinese-dictionary/
└── character/
    ├── char_base.json      基础字表（拼音、笔画、部首、频率、结构）— JSONL
    ├── char_detail.json    字形字义详解（含《说文》等典籍引文）— JSONL
    ├── polyphone.json      多音字表（2495 条）— 标准 JSON 数组
    ├── related.json        相关字（近义 / 反义 / 形近，3076 条）— 标准 JSON 数组
    └── README.md           源仓库自带说明（原始副本）
```

## 数据格式说明（重要）

源仓库 README 称「所有文件均为 JSON 格式」，实际**两个大文件为 JSONL（JSON Lines，
每行一个独立 JSON 对象）**，并非单个 JSON 数组。解析时须按行读取，逐行 `JSON.parse`：

| 文件 | 格式 | 规模 | 单条结构 |
|------|------|------|----------|
| `char_base.json` | **JSONL**（每行一个对象） | ~21057 行 | `{ "index", "char", "strokes", "pinyin":[], "radicals", "frequency", "structure" }` |
| `char_detail.json` | **JSONL**（每行一个对象） | ~21042 行 | `{ "char", "pronunciations":[ { "pinyin", "explanations":[ { "content", "detail":[ { "text", "book" } ] } ] } ] }` |
| `polyphone.json` | 标准 JSON（数组） | 2495 条 | `{ "index", "char", "strokes", "pinyin":[], "frequency" }` |
| `related.json` | 标准 JSON（数组） | 3076 条 | `{ "char", "synonyms":[], "antonyms":[], "index" }` |

> ⚠️ 切勿对 `char_base.json` / `char_detail.json` 直接整体 `JSON.parse`，
> 否则会报 `Unexpected non-whitespace character after JSON`。须按行切分后再解析。

## 数据完整性与可读性

- 所有文件由源目录**逐字节拷贝**，未做任何改写、转码或格式化，原始数据完整保留。
- 引用代码应通过稳定路径 `content/dict/chinese-dictionary/character/<file>` 读取；
  经 `scripts/copy-content.mjs` 投递后，运行端可从 `public/content/dict/chinese-dictionary/character/<file>` 获取。

## 来源

- 上游仓库：`chinese-dictionary-main`（仓库根含 `.gitignore` / `LICENSE` / `README.md`）。
- 许可证：见上游 `LICENSE`（MIT，详见源仓库）。
