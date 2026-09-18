---
schema: 1
slug: godels-incompleteness-theorems
title: 哥德尔不完备定理
original_title: Gödel's incompleteness theorems
aliases: [哥德尔不完全性定理, 不完备定理, Gödel incompleteness theorems]
type: concept
categories:
  - 哲学/逻辑与批判性思维
  - 科学/数学与系统科学/数学基础
tags: [哥德尔, 不完备性, 希尔伯特纲领, 自指, 形式系统]
summary: >-
  哥德尔不完备定理是 1931 年发表的两条结果：第一，任何一致的、足够强到包含初等算术的形式系统，都存在一个在该系统中既不能证明也不能否证的命题；第二，这样的系统不能在自身内部证明自己的一致性。它们终结了希尔伯特为全部数学寻找完备且一致的形式化基础的纲领。本词条介绍希尔伯特纲领的背景、哥德尔数与自指句的构造技巧、两条定理的直观与证明思路、对数学基础的实际冲击，以及对若干流行误读的澄清。
status: published
confidence: high
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
created_at: 2026-09-13
updated_at: 2026-09-13
rev: 1
structure:
  levels: [章]
  total_sections: 5
  total_words: 10800
sources:
  - title: 哥德尔不完备定理 - 斯坦福哲学百科全书
    url: https://plato.stanford.edu/entries/goedel-incompleteness/
    license: Fair-Use
  - title: 希尔伯特纲领 - 斯坦福哲学百科全书
    url: https://plato.stanford.edu/entries/hilbert-program/
    license: Fair-Use
see_also: [formal-logic, metaphysics, epistemology, scientific-method, computer]
---

# 哥德尔不完备定理

**哥德尔不完备定理**（Gödel's incompleteness theorems）是 1931 年库尔特·哥德尔在《论〈数学原理〉及相关系统的形式不可判定命题》中发表的两条结果。第一条说：任何一致的、足够强到包含初等算术的形式系统，都存在一个句子 G，使得 G 与它的否定在该系统中都不可证——G 说的是「我在这个系统中不可证」。第二条说：这样的系统不能在自身内部证明自己的一致性。它们一起粉碎了希尔伯特的梦想——为全部数学建立一个**完备且可自证一致**的形式化基础。不完备性不是某个系统的缺陷，而是任何足够强的形式系统的**结构性限制**。

本词条按「希尔伯特纲领与 1931 年前的局面 → 哥德尔数、自指与对角线 → 第一不完备定理 → 第二不完备定理与对希尔伯特纲领的冲击 → 常见通俗误读的澄清」五章展开。

## 导读

- 不完备性是**足够强的**系统的性质：弱到只有加法、没有乘法的算术，反而可以是完备且可判定的。
- **哥德尔数**把语法编码为算术，使一个形式系统能够「谈论自己的证明」——这是自指句得以构造的技术前提。
- **第一定理**的直观：构造句子 G 说「G 不可证」；若 G 可证则系统不一致，若 ¬G 可证则系统证明了假命题，故在一致（且 ω-一致）的系统中 G 不可判定。
- **第二定理**表明：一致性不能在系统内证明，因此希尔伯特用「有限方法」证明数学一致性的目标**不可能达成**。
- 常见误读必须澄清：不完备定理**不意味着**「数学不可靠」「真理不可知」「人有超越机器的神秘能力」——这些是流行文化中流传最广、也最离谱的引申。

> 📝 编者注：本词条与站内「罗素悖论」构成前后篇——1901 年的悖论危机引出了公理化与元数学，而元数学正是哥德尔定理的直接母体。与「形式逻辑」配套阅读，可看清「语法（可证）」与「语义（真）」的分离为何是理解不完备性的关键。

<!-- PKS_EXPANDED_V5 -->
