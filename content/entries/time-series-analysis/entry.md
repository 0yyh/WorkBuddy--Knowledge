---
schema: 1
slug: time-series-analysis
title: 时间序列分析
aliases: [时间序列, 时间数列, Time Series Analysis, 时序分析]
type: concept
categories:
  - 经济学/计量经济学
tags: [计量经济学, 平稳性, ARMA, 协整, 预测, 单位根, GARCH]
summary: >-
  时间序列分析是一套以「随时间观测得到的有序数据」为对象、用于描述规律、识别结构与预测未来的计量方法。它假定观测值之间并非相互独立，而是存在可建模的序列相关（自相关）。核心主张是：通过平稳性检验、趋势与季节分解、ARMA/协整等模型，可以从历史数据中分离出趋势、周期、季节与随机冲击，并据以推断经济与金融变量的未来路径。它的重要性在于，宏观与金融数据天然带时间维度，忽略序列相关会得出伪回归与误导性结论，而正确的时序建模是预测、政策评估与风险管理的基础。
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
  - title: 詹姆斯·汉密尔顿《时间序列分析》
    url: https://mitpress.mit.edu/9780691042893/time-series-analysis/
    license: Fair-Use
  - title: 沃尔特·恩德斯《应用计量经济学时间序列分析》
    url: https://www.wiley.com/en-us/Applied+Econometric+Time+Series%2C+4th+Edition-p-9781118808569
    license: Fair-Use
  - title: 罗伯特·恩格尔、克莱夫·格兰杰协整与 ARCH 相关论文
    url: https://www.nobelprize.org/prizes/economic-sciences/2003/summary/
    license: Fair-Use
see_also: [econometrics, ordinary-least-squares, instrumental-variables, business-cycle, stock-market, phillips-curve, economic-growth]
---

# 时间序列分析

**时间序列分析**（Time Series Analysis）是研究按时间先后顺序排列的观测数据、从中提取规律并预测未来的一整套计量方法。日常经济与金融数据——GDP、通胀率、股价、汇率、利率——本质上都是「带时间标签」的序列，而非彼此独立的横截面样本。这套方法最锋利的起点是：**今天的数据往往携带昨天的信息**，变量之间可能存在自相关、趋势、季节与周期结构。如果像普通回归那样假设误差相互独立且同方差，就会得到「看起来显著、实则虚假」的伪回归。时间序列分析正是通过**平稳性检验、分解趋势与季节、构建 ARMA 与协整模型**，把序列拆成可解释、可预测的成分，并为预测区间与模型局限提供统计依据。

本词条按「第一章 时间序列的基础 → 第二章 趋势与季节 → 第三章 ARMA 模型 → 第四章 协整与误差修正 → 第五章 应用」五章展开。

## 导读

- 平稳性是绝大多数时序模型的基石：非平稳序列直接回归会产生伪回归，必须先差分或去趋势。
- 白噪声是「无结构可言」的基准；ACF 与 PACF 则是识别序列相关、区分 AR 与 MA 的探针。
- 单位根意味着「随机趋势」而非「确定趋势」，差分是去单位根的标准操作，但过度差分也会损失信息。
- 协整解决「各自游走却长期同行」的难题，使水平变量之间可建立误差修正机制（VECM）。
- 时序预测给出的是带区间的概率判断，而非确定值；模型在结构突变（危机、政策转向）面前极易失效。

> 📝 编者注：时间序列分析与普通回归（OLS）共用许多工具，但核心差异在于对「序列相关」的处理——后者默认独立同分布，前者恰恰以序列相关为研究对象。阅读建议：先掌握 `ordinary-least-squares` 的回归直觉，再理解单位根与协整为何会「摧毁」普通回归的有效性。

<!-- PKS_EXPANDED_V5 -->
