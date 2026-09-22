---
schema: 1
slug: feedback-loop
title: 反馈回路
original_title: Feedback loop
aliases: [反馈环, 回馈回路, feedback]
type: concept
categories:
  - 科学/数学与系统科学/系统与复杂性
tags: [反馈, 负反馈, 正反馈, 稳态, 时滞, 系统动力学]
summary: >-
  反馈回路指系统的输出反过来成为其输入的一部分，从而影响后续行为的回路结构。负反馈抵抗偏差、维持稳态，正反馈放大偏差、驱动增长或崩溃；两者的耦合与时滞则制造振荡。本词条从瓦特调速器讲起，梳理负反馈与稳态、正反馈与增长崩溃、时滞与振荡三大主题，最后介绍福瑞斯特与梅多斯的系统动力学以及《增长的极限》引发的争论。
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
  total_words: 8400
sources:
  - title: "Feedback - Wikipedia"
    url: https://en.wikipedia.org/wiki/Feedback
    license: CC-BY-SA-3.0
  - title: "System dynamics - Wikipedia"
    url: https://en.wikipedia.org/wiki/System_dynamics
    license: CC-BY-SA-3.0
see_also: [chaos-theory, complexity, emergence]
---

# 反馈回路

**反馈回路**（feedback loop）指系统的输出反过来成为其后续输入的一部分，从而影响系统自身行为的回路结构。恒温器感受到室温偏差就开动加热，是反馈；你的收入存入银行产生利息、利息并入本金再生产利息，也是反馈。回路的两个基本类型方向相反：负反馈削减偏差，把系统拉回目标状态，是一切稳态与自我调节的基础；正反馈放大偏差，驱动指数增长、军备竞赛与雪崩式崩溃。当反馈带上时滞，回路还会自发振荡。理解了回路，就理解了为什么许多系统会自我维持、自我强化或自我毁灭——而不需要任何外部指挥。

本词条按「瓦特的调速器：反馈概念的诞生 → 负反馈与稳态 → 正反馈与增长、崩溃 → 时滞与振荡 → 系统动力学与《增长的极限》」五章展开。

## 导读

- 反馈的定义是输出绕回输入；回路的极性（负或正）决定它抵抗偏差还是放大偏差。
- 负反馈是「目标寻求」的机制：恒温器、体内血糖调节、市场价格的稳定作用，都靠偏差驱动的反向校正。
- 正反馈与善恶无关：复利增长、病毒式传播是它，银行挤兑、军备竞赛也是它；它只回答「偏差被放大还是被削减」。
- 时滞是振荡之母：淋浴水温忽冷忽热、库存周期与经济周期，都源于校正作用滞后于偏差的显现。
- 系统动力学把存量、流量与回路写成可模拟的方程；《增长的极限》把正反馈（人口与资本增长）与时滞（污染与资源耗竭）的组合推到了公众面前。

> 📝 编者注：本词条与站内「复杂性」「混沌理论」「涌现」配套阅读——反馈是复杂系统自我组织的引擎，而确定性混沌往往就诞生于非线性反馈回路之中。

<!-- PKS_EXPANDED_V5 -->
