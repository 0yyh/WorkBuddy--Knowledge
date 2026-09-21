---
schema: 1
slug: cost-effectiveness-analysis
title: 成本效果分析
aliases: [成本效益分析, 费用效果分析, Cost-Effectiveness Analysis]
type: concept
categories:
  - 经济学/卫生经济学
tags: [成本效果分析, QALY, 卫生技术评估]
summary: >-
  成本效果分析是卫生资源配置的核心工具：以货币成本除以非货币的健康效果，得到每单位健康的成本，供干预间比较与优先排序。本词条梳理其概念基础、质量调整生命年与残疾调整生命年两类效果度量、阈值与预算约束下的决策规则，以及估值争议、公平权重与罕见病等方法论与伦理前沿。
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
  total_words: 9000
sources:
  - title: Michael Drummond et al., Methods for the Economic Evaluation of Health Care Programmes (4th ed., 2015)
    url: https://global.oup.com/academic/product/methods-for-the-economic-evaluation-of-health-care-programmes-9780199665884
    license: Fair-Use
  - title: Milton Weinstein and William Stason, Foundations of Cost-Effectiveness Analysis for Health and Medical Practices (1977)
    url: https://www.nejm.org/doi/full/10.1056/NEJM197707142970304
    license: Fair-Use
see_also: [health-economics, healthcare-moral-hazard, public-finance, welfare-economics]
---

# 成本效果分析

**成本效果分析**（Cost-Effectiveness Analysis, CEA）是卫生经济学为稀缺预算提供的排序工具：把一项干预的总成本除以其产生的健康效果——通常以**质量调整生命年**（QALY）或**残疾调整生命年**（DALY）计量——得到每单位健康的成本。它刻意不把健康折算成货币收益，从而绕开「生命值多少钱」的直接定价，同时保住机会成本纪律：预算花在这里，就花不到那里。

本词条按「第一章 概念：成本与效果之比 → 第二章 效果度量：QALY 与 DALY → 第三章 阈值、预算约束与优先排序 → 第四章 方法争议：估值、公平权重、罕见病 → 第五章 政策应用：医保目录、疫苗、全球健康」五章展开。

## 导读

- 成本效果分析与成本收益分析的分野是刻意的：前者拒绝给生命定价，以「每单位健康的成本」替代货币化的收益判断。
- 平均成本效果比会严重误导决策，只有增量比（ICER）才回答「多花这笔钱多买多少健康」。
- 正确的阈值在理论上是被挤占干预的边际生产率，而非任意常数；预算约束越硬，这一逻辑越清晰。
- QALY 与 DALY 的度量选择内嵌价值立场：谁的偏好、对残疾如何折价、是否给年龄加权。
- 公平与效率的冲突（年龄权重、严重度溢价、罕见病例外）不能靠把指标做复杂来回避，只能靠显式的价值选择解决。
- 它与 welfare-economics 的关系：成本效果分析是福利经济学的简化版——放弃了加总个人效用的完整框架，换取在真实预算约束下的可操作性。

> 📝 编者注：成本效果分析最常见的误用是把「划算的干预清单」当作政策答案。清单只完成了效率的一半；分配这一半——谁优先、谁等待、谁例外——需要政治过程在场，工具的意义在于让政治过程面对真实的数字。

<!-- PKS_EXPANDED_V5 -->
