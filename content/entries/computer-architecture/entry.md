---
schema: 1
slug: computer-architecture
title: 计算机体系结构
original_title: Computer Architecture
aliases: [体系结构, 计算机组织, 微体系结构]
type: concept
categories:
  - 技术/信息技术
tags: [计算机, 处理器, 指令集, 存储层次, 并行计算]
summary: >-
  计算机体系结构研究计算机各部件的组织方式与协作规则，回答「这台机器如何被设计以高效执行程序」的问题。它介于软件与硬件之间，涵盖指令集、数据通路、存储层次与并行结构等。从冯·诺依曼的存储程序思想到多核与异构计算，体系结构的每一次跃迁都重新定义了算力的边界，是信息技术之所以强大的底层支撑。
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
  - title: "Computer architecture - Encyclopaedia Britannica"
    url: https://www.britannica.com/technology/computer-architecture
    license: Fair-Use
see_also: [computer, microprocessor, integrated-circuit, transistor, semiconductor, operating-system]
---

# 计算机体系结构

**计算机体系结构**（Computer Architecture）是一门关于「计算机如何被组织起来」的学科，它在指令集、数据通路、存储与互联的层面上规定硬件与软件的接口与协作方式。如果说晶体管是砖块，那么体系结构就是图纸——它决定了这些砖块如何砌成能跑程序的房子。最早的现代计算机遵循冯·诺依曼提出的「存储程序」思想：指令与数据同存于内存，机器按顺序取指执行。此后的七十余年，体系结构的演进主线是不断在「做快」与「做多」之间腾挪：用流水线与缓存逼近单核极限，又用多核与异构突破功耗墙。它既关乎工程，也关乎抽象——好的体系结构能让程序员以简单模型驾驭复杂硬件。

本词条按「从 ENIAC 到存储程序 → 指令集与处理器 → 存储层次 → 并行与多核 → 现代体系结构趋势」五章展开。

## 导读

- 存储程序思想让「可编程」取代「重接线」，是计算机之所以通用的根基。
- 指令集是软硬件的契约，复杂指令与精简指令各有哲学。
- 存储层次用速度与容量的金字塔，掩盖了内存慢于处理器的鸿沟。
- 多核与并行是突破单核功耗墙的必然选择。
- 异构与领域专用架构，正成为后摩尔时代算力增长的新引擎。

> 📝 编者注：体系结构（architecture）与微体系结构（microarchitecture）常被混用；前者更偏接口与抽象，后者指具体实现，二者层级不同。

<!-- PKS_EXPANDED_V5 -->
