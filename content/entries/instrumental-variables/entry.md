---
schema: 1
slug: instrumental-variables
title: 工具变量与因果识别
aliases: [工具变量, Instrumental Variables, IV, 因果识别, 两阶段最小二乘]
type: concept
categories:
  - 经济学/计量经济学
tags: [工具变量, 内生性, 因果推断, 2SLS, 计量经济学, 政策评估]
summary: >-
  工具变量（Instrumental Variables, IV）是计量经济学中用于解决内生性、从而识别因果效应的核心方法。当解释变量与误差项相关时，普通最小二乘（OLS）估计会系统性偏误且不一致；IV 借助一个「只通过处理变量影响结果、自身不受结果反作用」的外生变量，剥离混杂后恢复一致的因果估计。两阶段最小二乘（2SLS）是其标准实现。它的重要性在于：在难以随机实验的领域（劳动、教育、政策评估），IV 是少数能逼近「反事实」的武器，但也因弱工具与不可验证的外生性假设而长期受争议。
status: published
confidence: high
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
created_at: 2026-09-21
updated_at: 2026-09-21
rev: 1
structure:
  levels: [章]
  total_sections: 5
  total_words: 7000
sources:
  - title: Angrist & Pischke《Mostly Harmless Econometrics》(2009)
    url: https://www.mostlyharmlesseconometrics.com/
    license: Fair-Use
  - title: Wooldridge《Introductory Econometrics》(2019)
    url: https://www.cengage.com/c/introductory-econometrics-a-modern-approach-7e-wooldridge/
    license: Fair-Use
see_also: [econometrics, ordinary-least-squares, time-series-analysis, public-finance, fiscal-policy, unemployment]
---

# 工具变量与因果识别

**工具变量（Instrumental Variables，简称 IV）** 是计量经济学中用来从观测数据里「挖出」因果关系的利器。现实世界里，我们常想问「多上一年学能让工资涨多少」「某项政策是否真拉动了就业」，但影响工资的还有能力、家庭背景等看不见的因素，它们同时左右「上学年限」与「工资」，使简单的回归把相关误当成因果。**内生性** 指解释变量与模型误差项相关的现象，它让最常用的最小二乘估计彻底失效。工具变量的思路是：找一个只「从旁」推动解释变量、却不直接决定结果的外生冲击，相当于人为造出半个实验，从而把干净的因果部分分离出来。

本词条按「第一章 内生性问题 → 第二章 工具变量的原理 → 第三章 工具的有效性 → 第四章 其他实验/准实验设计 → 第五章 应用」五章展开。

## 导读

- 内生性是 OLS 失效的根源：遗漏变量、测量误差、联立性都会让 cov(X,ε)≠0，估计量有偏且不一致。
- 工具变量须同时满足「相关性」（与内生变量相关）与「外生性」（只经该变量影响结果），二者缺一不可。
- 2SLS 先用工具预测内生变量、再用预测值回归，相当于用外生变异替换混杂变异。
- 弱工具（第一阶段 F 偏小）会让 IV 估计方差暴涨且偏回 OLS；过度识别时可用 Sargan/Hansen 检验排除无效工具。
- IV 识别的通常是「局部平均处理效应（LATE）」而非总体平均效应，且外生性假设本质上不可直接检验，这是争议焦点。
- 除 IV 外，双重差分、断点回归、匹配与随机对照试验共同构成观测数据的因果识别工具箱，彼此互补。

> 📝 编者注：工具变量常被误读为「万能去偏法」。它只解决由内生性造成的偏误，且依赖一个无法被数据证伪的外生假设；阅读时应与站内「普通最小二乘」「计量经济学」「财政政策」「公共财政」等词条交叉对照，理解其适用边界。

<!-- PKS_EXPANDED_V5 -->
