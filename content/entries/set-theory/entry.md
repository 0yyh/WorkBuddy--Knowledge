---
schema: 1
slug: set-theory
title: 集合论
original_title: Set theory
aliases: [集合理论, 公理化集合论, ZFC, Set theory]
type: concept
categories:
  - 科学/数学与系统科学/数学基础
tags: [集合论, 康托尔, 无穷, ZFC, 选择公理, 连续统假设]
summary: >-
  集合论是现代数学的共同语言：几乎所有数学对象都可以被定义为集合。它起源于康托尔对无穷的研究——对角线法证明了实数比自然数「更多」，从而建立起无穷的等级。随之而来的罗素悖论暴露了朴素集合论的缺陷，促使数学家以 ZFC 公理系统重建基础；选择公理的正当性之争与连续统假设的独立性结果，则揭示了公理化方法的边界：有些问题在标准公理之下既不能证明也不能否证。本词条沿康托尔革命、悖论危机、公理化、选择公理、独立性结果五步展开。
status: published
confidence: high
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
created_at: 2026-09-22
updated_at: 2026-09-22
rev: 1
structure:
  levels: [章]
  total_sections: 5
  total_words: 8800
sources:
  - title: "集合论 - 斯坦福哲学百科全书"
    url: https://plato.stanford.edu/entries/set-theory/
    license: Fair-Use
  - title: "连续统假设 - 斯坦福哲学百科全书"
    url: https://plato.stanford.edu/entries/continuum-hypothesis/
    license: Fair-Use
see_also: [godels-incompleteness-theorems, russell-paradox, euclidean-geometry, probability]
---

# 集合论

**集合论**（set theory）研究集合——把一些对象视为一个整体而形成的基本数学对象——以及集合上的运算、关系与无穷的结构。它由格奥尔格·康托尔在 19 世纪 70 至 90 年代创立，起因看似平凡：分析学中需要精确刻画无穷点集。康托尔很快发现，用「一一对应」比较无穷集合的大小会得到惊人的结论——自然数与有理数一样多，实数却严格地更多。无穷不再是单一混沌的「无限大」，而是一个有等级、可运算的体系。20 世纪初罗素悖论击穿了朴素集合论，ZFC 公理系统随即重建了基础；选择公理与连续统假设的独立性则表明：公理框架本身也有不可判定的问题，数学基础的故事并未终结。

本词条按「康托尔的革命与对角线法 → 悖论危机 → ZFC 公理化 → 选择公理之争 → 连续统假设与独立性结果」五章展开。

## 导读

- 集合论诞生于一个技术细节：为「病态函数」和无穷点集寻找精确语言，结果是数学基础的重建。
- **对角线法**只用「假设列全 → 构造漏网之鱼」一步，就证明实数不可数——它也是哥德尔定理、停机问题与罗素悖论共用的引擎。
- 罗素悖论证明朴素集合论**不一致**：集合的概括原则允许构造「所有不属于自身的集合」。
- ZFC 用公理限制集合的生成方式，并以累积层级的观念取代「一切对象皆集合」的天真图景。
- 选择公理与连续统假设在 ZFC 中均不可判定：前者被广泛接受，后者的地位至今悬而未决。

> 📝 编者注：本词条与「无穷」构成基础关系——无穷的数学处理是集合论的核心成果；与「罗素悖论」「哥德尔不完备定理」构成因果链——悖论引出公理化，公理化的元数学引出不完备性与独立性。可对照「欧几里得几何」阅读：那里的平行公理独立性是集合论中独立性结果的历史先声。

<!-- PKS_EXPANDED_V5 -->
