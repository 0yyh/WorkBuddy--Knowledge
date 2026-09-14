---
schema: 1
slug: russell-paradox
title: 罗素悖论
original_title: Russell's paradox
aliases: [罗素佯谬, 集合论悖论, Russell's paradox]
type: concept
categories:
  - 哲学/逻辑与批判性思维
  - 科学/数学与系统科学/数学基础
tags: [悖论, 集合论, 罗素, 弗雷格, 公理化]
summary: >-
  罗素悖论于 1901 年被伯特兰·罗素发现：考虑「所有不属于自身的集合」所构成的集合，问它是否属于自身，会得出它属于自身当且仅当它不属于自身。这一矛盾直接击中弗雷格《算术基本规律》所依赖的概括公理，引发了二十世纪初的数学基础危机。本词条介绍朴素集合论的背景、悖论的构造与它为何难以回避、罗素致弗雷格的那封信与弗雷格的回应、类型论与 ZF 公理化的两种应对，以及与之相关的悖论家族和这一事件的历史意义。
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
  total_words: 10200
sources:
  - title: 罗素悖论 - 斯坦福哲学百科全书
    url: https://plato.stanford.edu/entries/russell-paradox/
    license: Fair-Use
  - title: 早期集合论 - 斯坦福哲学百科全书
    url: https://plato.stanford.edu/entries/settheory-early/
    license: Fair-Use
see_also: [formal-logic, metaphysics, epistemology, scientific-method, aristotle]
---

# 罗素悖论

**罗素悖论**（Russell's paradox）是集合论中最著名的矛盾：把**所有不属于自身的集合**收集起来，得到集合 R；然后问 R 是否属于自身——若 R 属于 R，则按 R 的定义它必须不属于自身；若 R 不属于 R，则它满足条件，应当属于 R。两边都推向反面。这个悖论看似只是集合论里的一个技术故障，实际后果却极为严重：它直接摧毁了弗雷格《算术基本规律》（1893、1903）所依赖的逻辑基础，使整个「把数学还原为逻辑」的纲领在出版前夕崩塌，并由此开启了公理集合论、类型论与数理逻辑的现代化进程。

本词条按「朴素集合论与概括公理 → 悖论的构造与它为何难以回避 → 罗素致弗雷格的信 → 类型论与 ZF 公理化的两种应对 → 悖论家族与历史意义」五章展开。

## 导读

- 悖论的关键不是「自指」，而是**无限制的概括原则**：任意性质都能定义一个集合。
- 罗素悖论**不需要**复杂的编码技术，只用「属于」与「不属于」两个概念，因此极难绕过。
- 1902 年罗素致弗雷格的信，让弗雷格在第二卷付印前仓促加了一个承认失败的附录——这是学术史上最有名的一封信。
- 两种主流应对：**罗素的类型论**（分层禁止自我归属）与**策梅洛的 ZF**（把概括改为分离），后者成为今天数学的标准基础。
- 与说谎者悖论结构相似但性质不同：罗素悖论是**集合论**的病，靠改公理治愈；说谎者悖论是**语义**的病，靠限制语言或放弃二值缓解。

> 📝 编者注：本词条与站内「说谎者悖论」「哥德尔不完备定理」构成一条线索——1901 年的悖论危机，1910—1913 年《数学原理》的类型论应对，1931 年哥德尔对希尔伯特纲领的终结。三者串起来，就是二十世纪数学基础研究的完整弧线。
