---
schema: 1
slug: algorithm
title: 算法
aliases: [算法, 演算法, Algorithm]
type: concept
categories:
  - 技术/信息技术
tags: [算法, 计算, 复杂度, 数据结构, 可计算性]
summary: >-
  算法是为解决某类问题而设计的、有限且确定的步骤序列，是计算机科学的心脏。它把「怎么做」从具体硬件中抽象出来，使同一思路能在任何机器上复现。衡量算法的不是代码长短，而是时间与空间的开销；而可计算性理论则划定「算法永远做不到」的边界。
status: published
confidence: high
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
created_at: 2026-09-28
updated_at: 2026-09-28
rev: 1
structure:
  levels: [章]
  total_sections: 5
  total_words: 9000
sources:
  - title: "Introduction to Algorithms - Cormen, Leiserson, Rivest, Stein"
    url: https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/
    license: Fair-Use
  - title: "Algorithms - Robert Sedgewick and Kevin Wayne"
    url: https://algs4.cs.princeton.edu/home/
    license: Fair-Use
see_also: [computer, software, programming-language, artificial-neural-network]
---

# 算法

**算法**（Algorithm）是为解决某一类计算问题而设计的、有限且确定的步骤序列。它不依赖任何具体机器，只描述「从输入到输出的可靠变换规则」：给定一份明确的输入，按算法逐步执行，必在有限步内停下并给出正确结果。早在公元九世纪，波斯学者花拉子米便在代数学著作里用步骤化方式求解线性方程，其名「算法」正是由他的拉丁译名演化而来；而现代意义下的算法，则随着二十世纪计算机科学的建立成为一门精确学问。算法是程序的灵魂——编程语言写出的是算法的外壳，真正决定程序能力与效率的，是内里那套步骤的设计。没有好的算法，再快的硬件也救不回一个拙劣的方法。

本词条按「什么是算法 → 如何衡量算法 → 几类经典范式 → 排序与查找 → 算法与计算理论」五章展开。

## 导读

- 算法的本质是「有限、确定、有效」的步骤，而非某段具体代码。
- 同一问题可以有无数算法，差别主要在时间与空间的开销上。
- 大O记号描述开销随规模增长的趋势，忽略常数、只看量级。
- 分治、贪心、动态规划是三种最常被套用的设计范式，各有适用面。
- 排序不只是「把数排好」，它是理解比较次数与信息下界的最佳范本。
- 可计算性理论告诉我们：有些问题根本不存在算法解，与机器快慢无关。

> 📝 编者注：日常语境常把「算法」等同于「手机推荐引擎」之类的具体系统，这是比喻用法。严格地说，推荐系统背后是许多算法的组合；本条所说的算法，是更底层、更中性的「步骤序列」概念，适用于从煮蛋到登月的任何可计算任务。

<!-- PKS_EXPANDED_V5 -->
