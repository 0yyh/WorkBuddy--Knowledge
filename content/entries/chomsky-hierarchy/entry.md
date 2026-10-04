---
schema: 1
slug: chomsky-hierarchy
title: 乔姆斯基谱系
original_title: Chomsky Hierarchy
aliases: [乔姆斯基层级, 语言谱系, 乔姆斯基层级, 形式语法谱系]
type: concept
categories:
  - 语言学/句法与语义
tags: [乔姆斯基谱系, 形式语法, 形式语言, 自动机, 0型文法, 上下文无关, 正则语言]
summary: >-
  乔姆斯基谱系是语言学与计算机科学交叉领域中对形式语法按其生成能力由弱到强排列的层级体系，由诺姆·乔姆斯基在二十世纪五十年代提出，后经与克林等人的工作逐步完善。它把文法分为0型（无限制文法，生成递归可枚举语言）、1型（上下文有关文法）、2型（上下文无关文法）与3型（正则文法）四个层次，每一层对应一类抽象自动机与一类形式语言，层级之间呈严格包含关系。该谱系既刻画了自然语言句法复杂度所处的大致区间——介于上下文无关与上下文有关之间——也为编译器设计、形式语言理论与计算复杂性研究奠定了概念基础，是理解句法如何被形式化以及计算能力极限何在的关键坐标。
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
  - title: "Chomsky, Noam (1956). Three Models for the Description of Language. IRE Transactions on Information Theory"
    url: https://chomsky.info/195609/
    license: Fair-Use
  - title: "Hopcroft, John E. and Ullman, Jeffrey D. (1979). Introduction to Automata Theory, Languages, and Computation. Addison-Wesley"
    url: https://en.wikipedia.org/wiki/Introduction_to_Automata_Theory,_Languages,_and_Computation
    license: Fair-Use
see_also: [transformational-grammar, dependency-grammar, compositionality, lexical-semantics]
---

# 乔姆斯基谱系

**乔姆斯基谱系（Chomsky Hierarchy）是语言学与计算机科学交叉领域中对形式语法按其生成能力由弱到强排列的层级体系，由诺姆·乔姆斯基在二十世纪五十年代提出，后经与克林（Kleene）等人的工作逐步完善。它把文法分为0型（无限制文法，生成递归可枚举语言）、1型（上下文有关文法）、2型（上下文无关文法）与3型（正则文法）四个层次，每一层对应一类抽象自动机与一类形式语言，层级之间呈严格包含关系。该谱系既刻画了自然语言句法复杂度所处的大致区间——介于上下文无关与上下文有关之间——也为编译器设计、形式语言理论与计算复杂性研究奠定了概念基础，是理解句法如何被形式化以及计算能力极限何在的关键坐标。**

本词条按「形式语法与形式语言的基本界定 → 0型递归可枚举语言与无限制文法 → 1型上下文有关语言与线性有界自动机 → 2型上下文无关语言与下推自动机 → 3型正则语言与层级总体关系」五章展开。

## 导读

- 乔姆斯基谱系按文法生成能力由弱到强分为0、1、2、3四型，层级之间为严格包含关系。
- 0型文法对应图灵机，生成递归可枚举语言，是能力最强但也最难处理的类别。
- 1型上下文有关文法对应线性有界自动机，2型上下文无关文法对应下推自动机，3型正则文法对应有限自动机。
- 自然语言的句法复杂度大致位于2型与1型之间，纯2型文法不足以完全刻画自然语言。
- 谱系不仅服务于语言学，也支撑了编译器构造与形式语言理论。

> 📝 编者注：本词条与同批的「转换语法」「词汇语义学」「组合性原则」「语言变体」并列。乔姆斯基谱系处理形式语法的计算层级，而转换语法是乔姆斯基在语言学内部的句法理论，二者同源却分属形式化层级与具体语言学理论两个层面，可对照阅读。

<!-- PKS_EXPANDED_V5 -->
