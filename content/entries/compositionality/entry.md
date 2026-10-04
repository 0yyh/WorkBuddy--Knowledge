---
schema: 1
slug: compositionality
title: 组合性原则
original_title: Principle of Compositionality
aliases: [语义组合性, 组合原理, 弗雷格原则]
type: concept
categories:
  - 语言学/句法与语义
tags: [组合性原则, 弗雷格, 蒙塔古, 形式语义学, 函数应用, 意义组合]
summary: >-
  组合性原则，又称弗雷格原则，主张复合表达式的意义由其组成部分的意义以及组合这些部分的句法结构决定。它构成形式语义学的基石：给定词项的语义值与组合规则，句子的真值条件可被系统地计算出来。该原则由弗雷格在十九世纪末提出，经蒙塔古等形式语义学家发展为以类型论与函数应用为核心的形式体系，用来刻画自然语言的意义组合。尽管习语、隐喻、量词辖域等现象对其构成挑战，组合性原则仍是当代语义学与自然语言处理中组织意义计算的核心纲领。
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
  - title: "Frege, Gottlob (1892). Über Sinn und Bedeutung. Zeitschrift für Philosophie und philosophische Kritik"
    url: https://en.wikipedia.org/wiki/On_Sense_and_Reference
    license: Fair-Use
  - title: "Montague, Richard (1973). The Proper Treatment of Quantification in Ordinary English. In Approaches to Natural Language. Reidel"
    url: https://en.wikipedia.org/wiki/Montague_grammar
    license: Fair-Use
see_also: [lexical-semantics, transformational-grammar, chomsky-hierarchy, dependency-grammar]
---

# 组合性原则

**组合性原则（Principle of Compositionality），又称弗雷格原则，主张复合表达式的意义由其组成部分的意义以及组合这些部分的句法结构共同决定。它是形式语义学的基石：只要给出每个词项的语义值，再规定句法结构如何驱动意义组合，整句话的真值条件就能被系统地、可计算地推导出来。该原则由德国逻辑学家弗雷格（Gottlob Frege）在十九世纪末提出，后经蒙塔古（Richard Montague）等形式语义学家发展为以类型论与函数应用为核心的形式体系，用来严谨地刻画自然语言的意义组合。尽管习语、隐喻与量词辖域等现象对其构成持久挑战，组合性原则依然是当代语义学与自然语言处理中组织意义计算的核心纲领。**

本词条按「弗雷格原则与历史来源 → 形式语义学的函数—论元模型 → 组合性的边界与非组合现象 → 在蒙塔古语法与自然语言处理中的应用 → 争议与哲学意涵」五章展开。

## 导读

- 组合性原则主张句子意义由词项意义按句法结构组合得出，是形式语义学的基石。
- 弗雷格最早提出原则雏形，蒙塔古将其发展为类型论与函数应用的形式体系。
- 形式语义学用函数作用于论元来刻画意义组合，句法结构决定组合顺序。
- 习语、隐喻、量词辖域等现象构成对组合性的挑战，需补充处理策略。
- 组合性原则深刻影响了蒙塔古语法与自然语言处理中的意义表示。

> 📝 编者注：本词条与同批的「词汇语义学」「转换语法」「乔姆斯基谱系」「语言变体」并列。词汇语义学解决「词项意义是什么」，本词条承接它回答「词项意义如何拼成句义」，二者构成意义研究的上下游；转换语法提供的结构派生则是组合得以进行的句法舞台。

<!-- PKS_EXPANDED_V5 -->
