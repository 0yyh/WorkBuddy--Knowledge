---
schema: 1
slug: difference-in-differences
title: 双重差分法
aliases: [双重差分, 差分中的差分, Difference-in-Differences, DID]
type: concept
categories:
  - 经济学/计量经济学
tags: [双重差分, 平行趋势, 政策评估, 事件研究, 准实验]
summary: >-
  双重差分法（Difference-in-Differences，DID）是政策评估中最常用的准实验设计之一：用「处理组前后的变化」减去「对照组前后的变化」，以差中差消去两类共同干扰——不随时间变化的组间差异与所有组共同经历的时间趋势。其识别基石是平行趋势假设：若处理组未受干预，其结果轨迹将与对照组平行。1994 年卡德与克鲁格对新泽西州最低工资上调的快餐店研究是标志性应用，引爆了劳动经济学的自然实验范式。近年交错实施政策下异质性处理效应的发现（Goodman-Bacon 分解）暴露了传统双向固定效应估计的偏误来源，催生了一批稳健估计量。DID 的可信度来自研究设计，而非软件命令。
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
  total_words: 8500
sources:
  - title: "Card, D. & Krueger, A. B. (1994). Minimum Wages and Employment: A Case Study of the Fast-Food Industry in New Jersey and Pennsylvania. American Economic Review"
    url: https://www.aeaweb.org/journals/aer
    license: Fair-Use
  - title: "Goodman-Bacon, A. (2021). Difference-in-Differences with Variation in Treatment Timing. Journal of Econometrics"
    url: https://doi.org/10.1016/j.jeconom.2021.03.014
    license: Fair-Use
see_also: [causal-inference, econometrics, instrumental-variables, ordinary-least-squares]
---

# 双重差分法

**双重差分法**（Difference-in-Differences，DID）是观测数据中最常被使用的准实验设计：用一个「差」消去组间固有的水平差异，再用第二个「差」消去所有组共同经历的时间冲击，剩下的就是政策的因果效应。它的识别基石是**平行趋势假设**——若未受干预，处理组与对照组的结果轨迹将保持平行；这条假设无法被数据证明，只能被论证、被间接检验。1994 年卡德（David Card）与克鲁格（Alan Krueger）对新泽西州最低工资上调的快餐店研究，让 DID 从劳动经济学的技术手段跃升为「自然实验」范式的旗帜。而近年来交错实施政策下的新批评——尤其是 Goodman-Bacon 的分解——揭示了传统双向固定效应估计可能用「已处理组」当对照组而产生偏误，催生了一代新估计量，也再次印证：DID 的力量在于研究设计，而非回归公式本身。

本词条按「从前后对比到差中差」「平行趋势假设：识别的生命线」「卡德与克鲁格的最低工资研究」「回归实现与事件研究」「交错 DID 的新批评与修复」五章展开。

## 导读

- 单独的「前后对比」混入时间趋势，单独的「组间对比」混入固有差异；DID 用两个差互相抵消这两类污染。
- 平行趋势假设的严格表述是关于**潜在结果**的：反事实轨迹平行，而非观测数据平行。
- 前趋势检验是必要但不充分的诊断：平行假设可能只对处理期之后成立。
- 事件研究图把 DID 变成可视化论证：处理前的系数应近零，处理后的系数描绘动态效应。
- 交错实施与效应异质下，双向固定效应的估计可能是各成分 2×2 DID 的加权平均，权重可为负，需改用新的稳健估计量。

> 📝 编者注：本站交叉阅读建议——DID 是因果推断（causal-inference）框架下最典型的观测数据识别策略；其回归实现依赖普通最小二乘（ordinary-least-squares）与双向固定效应；面板数据结构（panel-data）是 DID 的天然载体；当平行趋势难以辩护时，工具变量（instrumental-variables）是常见的替代识别路线。

<!-- PKS_EXPANDED_V5 -->
