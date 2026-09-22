---
schema: 1
slug: causal-inference
title: 因果推断
aliases: [因果分析, Causal Inference, 潜在结果框架]
type: concept
categories:
  - 经济学/计量经济学
tags: [因果推断, 潜在结果框架, 混杂, 准实验, 政策评估]
summary: >-
  因果推断（Causal Inference）研究如何从数据中识别「一个变量改变另一个变量」的效应，而不仅停留于相关。其现代基础是鲁宾的潜在结果框架：因果效应被定义为同一单位在干预与不干预两种状态下结果的差，其中一种状态永远不可观测，因此因果问题本质上是缺失数据问题。这一定义把含混的「原因」变成可估计的参数，也让随机试验与准实验（工具变量、双重差分、断点回归）在同一框架下获得统一理解——它们的共同点是设法让干预分配近似随机。因果推断由此成为计量经济学、流行病学与公共政策评估的共同语言，也是判断任何一条「数据显示」式结论是否可信的第一道关卡。
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
  - title: "Rubin, D. B. (1974). Estimating Causal Effects of Treatments in Randomized and Nonrandomized Studies. Journal of Educational Psychology"
    url: https://doi.org/10.1037/h0037350
    license: Fair-Use
  - title: "Hernán, M. A. & Robins, J. M. (2020). Causal Inference: What If. CRC Press"
    url: https://miguelhernan.org/whatifbook
    license: Fair-Use
see_also: [econometrics, instrumental-variables, ordinary-least-squares, time-series-analysis]
---

# 因果推断

**因果推断**（Causal Inference）研究如何从数据中识别「一个变量改变另一个变量」的效应，而不仅是它们同时变动。它的现代基础是鲁宾（Donald Rubin）的**潜在结果框架**：把因果效应定义为同一单位在「接受干预」与「不接受干预」两种状态下结果的差异，而其中一种状态永远不可观测——于是因果问题在数学上成为缺失数据问题。这一定义把哲学化的「原因」变成可估计的量，也让随机试验与准实验在统一框架下得到理解：它们的共同点，是设法让干预状态的分配「像随机一样」。因果推断由此成为计量经济学、流行病学与政策评估的共同语言，也是判断任何一条「数据显示」式结论是否可信的第一道关卡。

本词条按「相关不是因果：问题的起点」「潜在结果框架：鲁宾的因果模型」「混杂与选择偏误：观测数据的陷阱」「随机试验：黄金标准的逻辑」「准实验与可信性革命：统一视角」五章展开。

## 导读

- 「相关不蕴含因果」不是一句空洞的告诫：混杂、反向因果与选择偏误会共同制造看似坚实的虚假联系。
- 潜在结果框架把因果效应定义为同一单位在两种状态下结果的差，由于一种状态永远缺失，因果问题成为缺失数据问题。
- 平均因果效应（ATE）与处理组平均效应（ATT）是两个不同的目标参数，识别策略必须先说清楚它在估计哪一个。
- 混杂使简单对比有偏；辛普森悖论与「坏控制变量」警示：条件化本身可能引入新的偏误。
- 随机试验通过随机分配使潜在结果独立于干预，从而同时消除可观测与不可观测混杂；准实验则把同一逻辑搬到观测数据。

> 📝 编者注：本站交叉阅读建议——工具变量（instrumental-variables）与普通最小二乘（ordinary-least-squares）是本章框架下最常被调用的识别与估计工具；时间序列分析（time-series-analysis）中的「格兰杰因果」仅是预测意义上的先后关系，与本章的干预因果并非一回事，初学者极易混淆。

<!-- PKS_EXPANDED_V5 -->
