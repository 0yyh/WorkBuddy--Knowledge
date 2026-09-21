---
schema: 1
slug: econometrics
title: 计量经济学
aliases: [计量经济, Econometrics, 计量经济分析]
type: concept
categories:
  - 经济学/计量经济学
tags: [计量经济学, 因果推断, 经济政策评估, 统计建模]
summary: >-
  计量经济学（Econometrics）是以统计方法、经济理论与数据三角支撑，将抽象经济假说转化为可被数据检验的定量命题的学科。它不满足于描述相关，而致力于在充满混杂与噪声的观测数据中识别因果结构——一项政策或冲击如何改变结果变量的期望。这使它区别于纯理论推演（不处理观测误差）与数据科学（更重预测而非可识别性）。对现代宏观与微观政策评估而言，它是连接经济模型与现实世界的桥，也是公共财政与货币政策争论的实证仲裁者。
status: published
confidence: high
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
created_at: 2026-09-20
updated_at: 2026-09-20
rev: 1
structure:
  levels: [章]
  total_sections: 5
  total_words: 7000
sources:
  - title: 伍德里奇《计量经济学导论：现代观点》
    url: https://www.pearson.com/
    license: Fair-Use
see_also: [ordinary-least-squares, time-series-analysis, instrumental-variables, national-accounts, public-finance]
---

# 计量经济学

**计量经济学**（Econometrics）是以**统计方法、经济理论与数据**为三角支架，把抽象的经济学说转化为可被数据检验的定量命题的学科。它要解决的核心难题是：当现实数据充满混杂与噪声时，如何判断「A 是否真的导致 B」，而不仅停留在相关。传统统计学关注「预测」与「描述分布」，计量经济学则追问**因果结构**——一项政策、一次冲击、一个变量的变化，如何改变另一变量的期望结果。因此它既区别于纯理论推演（不处理观测误差），也区别于数据科学（更强调模型的可识别性与经济含义的可解释性）。对现代宏观与微观政策评估而言，计量经济学是连接象牙塔模型与真实世界的桥，也是公共财政与货币政策争论的实证仲裁者。

本词条按「什么是计量经济学」「数据结构」「因果识别的基本问题」「识别策略概览」「应用与伦理」五章展开。

## 导读

- 计量经济学的终极目标不是预测，而是**因果识别**——在观测数据中区分相关与因果，否则政策建议可能南辕北辙。
- 内生性是观测性研究的阿喀琉斯之踵：当解释变量与误差项相关，普通回归系数不再一致，且样本越大越偏离真值。
- 潜在结果框架（Rubin）把「因果」重新定义为同一单位在干预与否下的结果之差，从而把因果问题变成可计算的缺失数据问题。
- 识别策略（工具变量、双重差分、RDD）本质上是在向自然「借」随机性，用研究设计而非样本量来换取可信度。
- 复制危机警示：p 值崇拜与数据挖掘会制造虚假显著，好的实践要求预注册、透明代码与多重稳健性检验。

> 📝 编者注：本站与站内词条的交叉阅读建议——读完本词条可顺链进入普通最小二乘（ordinary-least-squares）看基础估计量，进入时间序列分析（time-series-analysis）与工具变量（instrumental-variables）看两大主力方法，再借国民账户（national-accounts）与公共财政（public-finance）看它如何落地为政策评估。常见误解：把「统计显著」等同于「因果成立」或「效应重要」，二者皆错。

<!-- PKS_EXPANDED_V5 -->
