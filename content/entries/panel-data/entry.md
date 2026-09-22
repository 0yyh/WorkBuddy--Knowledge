---
schema: 1
slug: panel-data
title: 面板数据
aliases: [面板数据模型, 面板, Panel Data, 纵向数据]
type: concept
categories:
  - 经济学/计量经济学
tags: [面板数据, 固定效应, 随机效应, 组内估计, 豪斯曼检验]
summary: >-
  面板数据（Panel Data）同时对多个个体在多个时期进行观测，形成个体×时间的双维结构。它最大的价值是让不可观测的个体异质性进入分析视野：固定效应通过组内变换吸收与个体绑定的一切未观测因素，随机效应则在更严格的假设下换取效率，二者的取舍由豪斯曼检验裁决。相比横截面数据，面板提供了更大的变异、更高的自由度与对动态行为的追踪能力；但它也带来流失、测量误差被放大、大 N 小 T 下动态模型偏误（如 Nickell 偏误）等新问题。从劳动经济学的工资方程到政策评估中的双向固定效应，面板结构是现代实证微观经济学与双重差分法的天然载体。
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
  total_words: 8000
sources:
  - title: "Wooldridge, J. M. (2010). Econometric Analysis of Cross Section and Panel Data. MIT Press"
    url: https://mitpress.mit.edu/
    license: Fair-Use
  - title: "Baltagi, B. H. (2021). Econometric Analysis of Panel Data. Springer"
    url: https://link.springer.com/
    license: Fair-Use
see_also: [econometrics, ordinary-least-squares, time-series-analysis, instrumental-variables]
---

# 面板数据

**面板数据**（Panel Data，也称纵向数据）指对同一批个体在多个时期重复观测所得到的数据：$N$ 个个体 × $T$ 个时期，形成双维结构。横截面数据只见「不同人某个时点的差异」，时间序列只见「同一个人随时间的变化」，面板则同时拥有两个维度——这不仅是样本量的叠加，更让一类此前无法处理的问题进入视野：那些**与个体绑定、随时间不变、却难以观测的因素**（能力、家风、文化、地理），在面板中可以通过「同一个体前后对比」被差掉。固定效应与随机效应两大估计框架围绕「如何对待个体异质性」展开，组内估计是固定效应的核心技术。当然，双维结构也带来新麻烦：样本流失、动态偏误与推断复杂化。从工资方程到双重差分，面板结构是现代实证微观经济学的地基。

本词条按「双维结构：面板提供了什么」「固定效应与组内估计」「随机效应与豪斯曼检验」「动态面板与推断问题」「面板的优势与局限」五章展开。

## 导读

- 面板的关键增量不是样本更大，而是获得「同一个体的纵向变异」，使不可观测异质性可被处理。
- 固定效应（组内估计）允许个体效应与解释变量任意相关，代价是丢弃组间比较、无法估计不随时间变化的变量系数。
- 随机效应假设个体效应与解释变量无关，效率更高但该假设常不成立；豪斯曼检验在二者间裁决。
- 大 N 小 T 的动态面板中，组内估计因滞后因变量产生 Nickell 偏误，需 Arellano-Bond 类广义矩方法。
- 面板不自动解决内生性：固定效应只清除「不随时间变化」的混杂，时变混杂仍需其他识别策略。

> 📝 编者注：本站交叉阅读建议——组内估计本质是对普通最小二乘（ordinary-least-squares）的变换应用；双向固定效应是双重差分（difference-in-differences）的回归载体；动态面板的广义矩估计与工具变量（instrumental-variables）思想同源；面板的时间维度延伸则通往时间序列分析（time-series-analysis）。

<!-- PKS_EXPANDED_V5 -->
