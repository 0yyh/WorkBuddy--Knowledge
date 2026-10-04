---
schema: 1
slug: dependency-grammar
title: 依存语法
original_title: Dependency Grammar
aliases: [依存关系语法, 从属语法, 配价语法, 依存句法]
type: concept
categories:
  - 语言学/句法与语义
tags: [依存语法, 依存关系, 配价, 特斯尼耶尔, 短语结构, 句法表征]
summary: >-
  依存语法是一种以「词与词之间的依存关系」而非「短语成分」为核心的句法理论，由特斯尼耶尔（Tesnière）在《结构句法基础》中系统提出。它把句子看作由核心词（head）与从属词（dependent）构成的有向树：每个从属词唯一依附于一个核心词，并通过配价规定核心能支配的从属数目与类型。与以名词短语、动词短语等成分为节点的短语结构语法相对，依存语法更贴近词义组合与语义角色，是现代计算语言学与树库标注（如 Universal Dependencies）的事实标准之一。
status: published
confidence: high
license: public-domain
ai_generated: true
ai_annotated: true
created_at: 2026-10-04
updated_at: 2026-10-04
rev: 1
structure:
  levels: [章]
  total_sections: 5
  total_words: 9000
sources:
  - title: "Tesnière, Lucien (1959). Éléments de syntaxe structurale. Klincksieck"
    url: https://archive.org/details/lucien-tesnire-lments-de-syntaxe-structurale
    license: Fair-Use
  - title: "Mel'čuk, Igor (1988). Dependency Syntax. State University of New York Press"
    url: https://sunypress.edu/Books/D/Dependency-Syntax
    license: Fair-Use
see_also: [chomsky-hierarchy, transformational-grammar, lexical-semantics, compositionality]
---

# 依存语法

**依存语法**（Dependency Grammar）是一种以「词与词之间的依存关系」而非「短语成分」为主轴的句法理论。它由法国语言学家特斯尼耶尔（Lucien Tesnière）在遗著《结构句法基础》中系统奠基，主张句子本质上是一张由核心词（tête／head）与从属词（subordonné／dependent）编织而成的有向关系网：每个词（除根以外）都唯一依附于另一个词，受其支配。依存语法用「配价」刻画一个词能联结多少、何种从属，从而把句法结构与词汇意义、语义角色紧密扣合。它与以名词短语、动词短语等成分为节点的短语结构语法形成鲜明对照，前者更经济、更贴近语义组合，后者更擅长刻画成分的层级包孕。进入数字时代后，依存表征因简洁宜于标注，成为 Universal Dependencies 等大规模树库与依存句法分析的主流范式。

本词条按「依存语法的起源与基本理念 → 依存关系的形式定义与表示 → 与短语结构语法的对比 → 配价与论元结构 → 应用与计算实现」五章展开。

## 导读

- 依存语法以词—词关系为基，每个从属词唯一依附一个核心，构成有向树。
- 特斯尼耶尔的配价概念，把句法能力直接绑定到具体词的语义需求。
- 依存表征比短语结构更简洁，且与语义角色、题元关系天然对接。
- 二者并非绝对对立，许多现代理论在形式层面可相互转换。
- 依存树库与自动分析已成为自然语言处理的关键基础设施。

> 📝 编者注：本词条与「乔姆斯基谱系」「转换语法」「词汇语义学」「组合性」相互支撑：谱系提供形式语言背景，转换语法代表短语结构一路，词汇语义学提供配价所需的词义资源，组合性则关乎依存如何决定整体释义。本词条沿用大陆通译，Tesnière 译特斯尼耶尔、Mel'čuk 译梅尔丘克。

<!-- PKS_EXPANDED_V5 -->
