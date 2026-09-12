---
schema: 1
slug: relational-database
title: 关系数据库
original_title: Relational database
aliases: [关系数据库, 关系型数据库, RDBMS, 关系数据模型]
type: concept
categories:
  - 技术/信息技术
tags: [关系数据库, SQL, 关系模型, ACID, 规范化, 事务]
summary: >-
  关系数据库是基于埃德加·科德（E. F. Codd）1970 年提出的关系模型的数据管理系统：数据以二维表（关系）组织，行是元组、列是属性，靠主键唯一标识、外键关联表间关系，用 SQL 以声明方式查询。事务以 ACID（原子性、一致性、隔离性、持久性）保证可靠，规范化（1NF–5NF）消除冗余。它自 1980 年代商业化以来，仍是业务数据的默认底座。
status: published
confidence: high
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
created_at: 2026-09-12
updated_at: 2026-09-12
rev: 1
sort_date: 1970
structure:
  levels: [章]
  total_sections: 3
  total_words: 2000
sources:
  - title: Codd, E.F. (1970) A Relational Model of Data for Large Shared Data Banks
    url: https://doi.org/10.1145/362384.362685
    license: ACM
  - title: Relational model - Wikipedia
    url: https://en.wikipedia.org/wiki/Relational_model
    license: CC-BY-SA-4.0
  - title: Härder & Reuter (1983) Principles of Transaction-Oriented Database Recovery
    url: https://doi.org/10.1145/289.291
    license: ACM
see_also: [internet]
---

# 关系数据库

**关系数据库（relational database）** 是按**关系模型**组织数据的数据管理系统。它的核心思想由 IBM 研究员 **埃德加·科德（E. F. Codd）** 在 1970 年的论文《A Relational Model of Data for Large Shared Data Banks》中奠定：用二维表（关系）表示数据，用声明式语言（SQL）查询，让应用程序不必关心数据如何物理存储。

本词条按「关系模型与数学基础 → SQL 与声明式查询 → 事务 ACID 与规范化」三章展开。

## 导读

- 数据即**关系**（表）：行是元组、列是属性；**主键**唯一标识每行，**外键**关联不同表。
- **SQL**（ISO/IEC 9075）只描述"要什么"，不规定"怎么取"——优化器负责高效执行。
- **事务**以 **ACID** 保证可靠：原子性、一致性、隔离性、持久性（Härder & Reuter, 1983）。
- **规范化**（1NF–5NF）消除冗余、避免更新异常，是关系设计的核心纪律。

> 📝 编者注：科德那篇论文的第一句话就是答案——"未来大型数据 bank 的用户，必须免受'数据在机器里如何组织'的困扰。"**数据独立性**正是关系模型存在的根本原因。

下文分三章展开：第一章讲关系模型与数学基础，第二章讲 SQL 与声明式查询，第三章讲事务 ACID 与规范化。

<!-- PKS_EXPANDED_V4 -->
