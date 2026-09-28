---
schema: 1
slug: database
title: 数据库
aliases: [资料库, 数据库, Database]
type: concept
categories:
  - 技术/信息技术
tags: [数据库, 关系模型, SQL, 事务, NoSQL, 数据]
summary: >-
  数据库是长期存储、管理与高效检索数据的系统，使应用不必关心数据如何落地。从早期的层次与网状模型，到科德提出的关系模型与结构化查询语言，再到应对海量与高并发的分布式与非关系数据库，数据库把「数据」变成可治理、可共享、可信任的资产，是现代信息系统的地基。
status: published
confidence: high
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
created_at: 2026-09-26
updated_at: 2026-09-26
rev: 1
structure:
  levels: [章]
  total_sections: 5
  total_words: 9000
sources:
  - title: "Database - Encyclopaedia Britannica"
    url: https://www.britannica.com/technology/database
    license: Fair-Use
  - title: "A Relational Model of Data for Large Shared Data Banks - Codd 1970"
    url: https://dl.acm.org/doi/10.1145/362384.362685
    license: Fair-Use
see_also: [operating-system, computer-network, algorithm, artificial-neural-network]
---

# 数据库

**数据库**（Database）是长期存储、管理与高效检索数据的系统，让应用程序不必关心数据究竟存在哪块磁盘、如何索引、怎样并发访问。没有它，每个程序都要自己造一套文件格式与读写逻辑，数据无法共享、极易不一致。从早期的层次与网状模型，到一九七〇年科德提出**关系模型**与随之而来的结构化查询语言，再到今天应对海量与高并发的分布式与非关系数据库，数据库把「数据」变成可治理、可共享、可信任的资产。它是现代信息系统的地基。

本词条按「数据管理的起源 → 关系模型与查询语言 → 事务与一致性 → 非关系与大数据 → 分布式与云数据库」五章展开。

## 导读

- 数据库的使命是「让数据可被多应用安全共享」，而非单纯存文件。
- 科德的关系模型用「表」统一数据组织，是数据库史上的分水岭。
- 结构化查询语言把「要什么」与「怎么取」分离，提升抽象层级。
- 事务的四大特性保证并发与故障下数据仍可信。
- 海量与高并发催生非关系数据库，以灵活与扩展换部分一致性。
- 分布式与云让数据跨节点协同，也带来一致性与成本的再平衡。

> 📝 编者注：常见误解是把数据库等同于「存数据的文件柜」。其实它的核心价值在「管理」：并发控制、故障恢复、约束校验，这些才是让数据可信的硬功夫。没有这些，文件再多也只是散沙。

<!-- PKS_EXPANDED_V5 -->
