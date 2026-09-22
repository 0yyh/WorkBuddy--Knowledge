---
schema: 1
slug: maximum-likelihood
title: 最大似然估计
aliases: [极大似然估计, 最大似然法, Maximum Likelihood, MLE]
type: concept
categories:
  - 经济学/计量经济学
tags: [最大似然估计, 似然函数, Probit, Logit, 渐近理论]
summary: >-
  最大似然估计（Maximum Likelihood Estimation，MLE）是统计学与计量经济学最通用的估计原理：选定一个概率模型，寻找使「已观测数据出现概率最大」的参数值。其力量在于几乎普适的渐近理论——在正则条件下，MLE 一致、渐近正态且渐近有效，并自带标准误推断框架（费希尔信息）。离散选择模型 Probit 与 Logit 是其经济学招牌应用，因变量受限、计数、久期等非线性模型皆以 MLE 为标准引擎。它与普通最小二乘在正态误差下等价，更广设定中则分化：OLS 依赖矩条件、对分布设定稳健，MLE 依赖完全分布设定、更有效率但对误设更敏感，准最大似然（QMLE）是两者间的实用折中。
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
  - title: "Fisher, R. A. (1922). On the Mathematical Foundations of Theoretical Statistics. Philosophical Transactions of the Royal Society A"
    url: https://doi.org/10.1098/rsta.1922.0009
    license: Fair-Use
  - title: "Cameron, A. C. & Trivedi, P. K. (2005). Microeconometrics: Methods and Applications. Cambridge University Press"
    url: https://www.cambridge.org/
    license: Fair-Use
see_also: [econometrics, ordinary-least-squares, probability, time-series-analysis]
---

# 最大似然估计

**最大似然估计**（Maximum Likelihood Estimation，MLE）是概率统计中最具普适性的估计原理：给定一个概率模型，选择使**已观测数据出现可能性最大**的参数值。这一思想的现代形式由费希尔（Ronald Fisher）在 1922 年的系统论文中奠定，其力量不在直观，而在一套几乎覆盖全部正则模型的渐近理论：MLE 一致、渐近正态、且在同类估计中方差最小（渐近有效），费希尔信息矩阵自动给出标准误与推断框架。经济学中，Probit 与 Logit 等离散选择模型是其招牌应用，受限因变量、计数与久期模型也都以 MLE 为标准引擎。与普通最小二乘相比，MLE 用「完全分布设定」换取效率，也因此对误设更敏感；准最大似然（QMLE）提供了实用折中。理解 MLE，就理解了从线性回归到深度学习损失函数背后那条共同的主线。

本词条按「似然函数：估计原理的基石」「大样本性质：一致性、渐近正态与有效」「Probit 与 Logit：离散选择模型」「与 OLS 的分野」「实践中的最大似然」五章展开。

## 导读

- 似然是「参数给定下数据的概率」，与「数据给定下参数的概率」（后验）方向相反，贝叶斯与频率学派的分岔由此开始。
- MLE 的三件套——一致性、渐近正态、渐近有效——在正则条件下成立；费希尔信息给出方差下界（克拉默-拉奥）。
- Probit（正态链接）与 Logit（逻辑斯蒂链接）是二元结果的两大标准模型；系数不是边际效应，解读需转换。
- 正态同方差下 OLS 就是 MLE；偏离时二者分道：OLS 稳健而欠优，MLE 效率高但怕误设。
- QMLE（如 Logit 拟贝叶斯性、正态 QMLE 在 GARCH 中）以「只设对均值/方差」的弱假设换取稳健。

> 📝 编者注：本站交叉阅读建议——MLE 与普通最小二乘（ordinary-least-squares）的关系是本词条主线之一；其概率基础见 probability 词条；时间序列中的 MLE（ARMA 的条件/精确似然、GARCH）见 time-series-analysis；作为估计原理它在计量经济学（econometrics）中与广义矩并列两大支柱。

<!-- PKS_EXPANDED_V5 -->
