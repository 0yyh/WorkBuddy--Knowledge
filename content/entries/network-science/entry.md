---
schema: 1
slug: network-science
title: 网络科学
original_title: Network science
aliases: [复杂网络研究, 网络理论, network science]
type: concept
categories:
  - 科学/数学与系统科学/系统与复杂性
tags: [网络科学, 随机图, 小世界, 无标度, 枢纽节点, 优先连接]
summary: >-
  网络科学研究由节点与连边构成的复杂连接结构，是一门 1990 年代末定型的交叉学科。本词条从图论的起源讲起，依次介绍随机图（ER 模型）的相变与失败、小世界网络（Watts-Strogatz）与无标度网络（Barabási-Albert）两大里程碑、枢纽节点带来的「鲁棒又脆弱」特性，最后梳理网络科学在流行病学、神经科学与金融系统性风险中的应用，以及对幂律滥用的批评。
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
  - title: "Network science - Wikipedia"
    url: https://en.wikipedia.org/wiki/Network_science
    license: CC-BY-SA-3.0
  - title: "Scale-free network - Wikipedia"
    url: https://en.wikipedia.org/wiki/Scale-free_network
    license: CC-BY-SA-3.0
see_also: [complexity, emergence, chaos-theory, game-theory]
---

# 网络科学

**网络科学**（network science）研究由节点与连边构成的连接结构——它的普遍规律、生成机制与后果。互联网、社交圈、食物网、代谢通路、航线与电网，都可以抽象成节点加连边的网络，而 1990 年代末的几项研究揭示了它们的共同特征：真实的网络既不是纯粹随机的，也不是规则整齐的，而是呈现小世界特征与无标度结构。一门把图论、统计物理与社会网络分析熔于一炉的交叉学科由此定型。网络的连接方式不是无关紧要的背景，它决定疾病如何传播、电网如何崩溃、创新如何扩散——连接本身就有力量。

本词条按「从哥尼斯堡七桥到一门新学科 → 随机图：ER 模型与它的失败 → 小世界与无标度：两大里程碑 → 枢纽节点、鲁棒与脆弱 → 应用与反思」五章展开。

## 导读

- 网络科学的基本词汇是度、路径与聚类系数；把系统看成一堆节点加连边，往往能回答成分清单回答不了的问题。
- 随机图（ER 模型）在 1959 年给出了第一个严格的网络理论：连边概率超过临界值时，巨连通分量像相变一样突然出现。
- 真实网络与随机图系统性偏离：既高度聚类（小世界），又出现少数枢纽、幂律度分布（无标度）；Watts-Strogatz 与 Barabási-Albert 模型分别捕捉了这两个特征。
- 无标度网络「鲁棒又脆弱」：随机故障几乎伤不了它，蓄意攻击枢纽却能让它瘫痪；流行病阈值也可能随之消失。
- 网络科学的教训适用于一切领域：理解一个系统，不仅要看它由什么构成，更要看它如何连接。

> 📝 编者注：本词条与站内「复杂性」「涌现」配套阅读——网络是复杂系统的骨架，涌现行为常常就发生在网络结构之上；与「博弈论」的关联则在于网络上的策略互动（合作、竞争与信息传播如何受连接结构约束）。

<!-- PKS_EXPANDED_V5 -->
