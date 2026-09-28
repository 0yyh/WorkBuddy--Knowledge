---
schema: 1
slug: distributed-systems
title: 分布式系统
original_title: Distributed Systems
aliases: [分布式计算, 分散式系统, 分布式架构]
type: concept
categories:
  - 技术/信息技术
tags: [分布式, 共识算法, 容错, 一致性, 云计算]
summary: >-
  分布式系统是由多台通过网络协作的计算机组成的整体，对外呈现为单一连贯的服务。它用多节点的并发与冗余换取可扩展性、可用性与地理分布能力，是现代互联网、云计算与大数据的基础设施。其根本挑战在于：节点会崩溃、网络会延迟丢失、时钟不完全同步，而系统仍须给出正确且一致的结果。共识、复制与容错，正是为驯服这些不确定性而生。
status: published
confidence: high
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
created_at: 2026-09-28
updated_at: 2026-09-28
rev: 1
structure:
  levels: [章]
  total_sections: 5
  total_words: 9000
sources:
  - title: "Distributed computing - Encyclopaedia Britannica"
    url: https://www.britannica.com/technology/distributed-computing
    license: Fair-Use
see_also: [computer-network, internet, database, cloud-computing, operating-system]
---

# 分布式系统

**分布式系统**（Distributed Systems）是由多台独立计算机通过网络连接、协同工作而构成的系统，用户与开发者感知到的却是一个整体服务。你每天用的搜索引擎、社交平台与在线支付，背后都不是一台机器，而是成千上万台服务器分工合作。把计算分散开，本意是获得单机无法企及的能力：横向扩展以应对海量请求、跨地域部署以降低延迟、冗余备份以抵御硬件故障。但分散也带来麻烦——节点会宕机、消息会丢失、时钟各走各的。分布式系统的全部学问，几乎都可归结为：在这些不可靠的零件之上，构建出可靠、一致且高效的整体。

本词条按「基本概念与挑战 → 时间与一致性 → 共识算法 → 容错与复制 → 大规模实践」五章展开。

## 导读

- 分布式系统用多机协作换取扩展性与可用性，却要直面故障与不可靠网络。
- 一致性、可用性与分区容忍三者难以兼得，即 CAP 张力。
- 共识算法让无主的节点就某件事达成一致，是系统的信任基石。
- 复制与冗余把「单点失效」转化为「持续可用」。
- 真正的难点常在工程细节：时钟、乱序、脑裂与运维。

> 📝 编者注：分布式系统常被视为纯软件议题，但其正确性高度依赖网络、时钟与故障模型的假设；脱离这些假设谈「可靠」是危险的。

<!-- PKS_EXPANDED_V5 -->
