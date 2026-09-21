---
schema: 1
slug: ordinary-least-squares
title: 普通最小二乘法
aliases: [OLS, 最小二乘法, Ordinary Least Squares]
type: concept
categories:
  - 经济学/计量经济学
tags: [计量经济学, 回归分析, 线性回归, Gauss-Markov, 估计方法]
summary: >-
  普通最小二乘法（OLS）是线性回归模型最基础、最常用的参数估计方法。它通过最小化残差平方和，在给定自变量时找出最能拟合因变量观测值的直线（或超平面）。OLS 的核心魅力在于：在满足经典假设的条件下，它给出的估计量具有最小方差且线性无偏（BLUE 定理）。这使得 OLS 成为经济学实证研究的默认工具，几乎支撑了从劳动经济学、发展经济学到宏观政策评估的每一项经验研究。理解 OLS 不仅意味着会跑回归，更意味着理解「相关」与「因果」之间的微妙边界，以及假设一旦被违背时结论会如何失真。
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
    url: https://www.cengage.com
    license: Fair-Use
  - title: Greene《Econometric Analysis》
    url: https://www.pearson.com
    license: Fair-Use
see_also: [econometrics, time-series-analysis, instrumental-variables, national-accounts, economic-growth, unemployment]
---

# 普通最小二乘法

**普通最小二乘法**（Ordinary Least Squares, OLS）是线性回归中用于估计未知参数的基本方法：面对一组「自变量—因变量」的散点，它寻找一条能使所有观测点到这条直线的**垂直距离（残差）平方和最小**的直线，从而用一个紧凑的数学关系概括变量之间的联系。它解决的根本问题是——当我们相信两个经济变量之间存在某种线性规律，却只能观测到带噪声的数据时，如何用最合理的方式还原那条「规律」本身。OLS 不仅给出一组系数估计，还自带一套完整的统计推断框架，让研究者能判断某个系数是否显著不等于零、模型整体解释力有多强。正因如此，它构成了现代经济学**经验研究**的通用语言，也是理解更复杂估计方法（如工具变量、广义矩估计）的必要起点。

本词条按「回归的思想 → OLS 的推导 → 经典假设(Gauss-Markov) → 假设违背 → 应用」五章展开。

## 导读

- OLS 的本质是「让残差平方和最小」，它在几何上等价于把因变量向量**投影**到自变量张成的空间上。
- 在满足 Gauss-Markov 五条假设时，OLS 估计量是**最优线性无偏估计（BLUE）**——但「线性无偏」不等于「正确」，假设一旦违背，结论就会失真。
- 异方差、自相关、内生性是 OLS 三大常见病；前两者不破坏无偏性但扭曲推断，内生性则直接让系数估计**有偏且不一致**。
- 系数显著不等于存在因果关系；遗漏变量、反向因果、选择性偏差都会让「拟合良好」的回归给出误导性结论。
- 稳健标准误与工具变量是应对假设违背的两把主力钥匙，前者修正推断、后者修正偏差，二者不可混淆。

> 📝 编者注：OLS 是「相关性」的工具，不是「因果性」的特许状。本词条刻意把「假设违背与内生性」单列一章，正是因为多数初学者误以为跑出显著系数就等于证明了因果，而真正的因果识别往往需要超出 OLS 的设计。

<!-- PKS_EXPANDED_V5 -->
