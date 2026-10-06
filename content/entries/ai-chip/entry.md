---
schema: 1
slug: ai-chip
title: 人工智能芯片
original_title: AI Chip
aliases: [AI芯片, AI加速器, 神经网络处理器]
type: concept
categories:
  - 技术/信息技术
tags: [人工智能芯片, GPU, NPU, TPU, 算力]
summary: >-
  人工智能芯片是为机器学习尤其是深度学习 workload 专门优化的处理器，核心目标是高效完成海量矩阵乘加运算。通用处理器在并行度与能效上难以满足需求，于是图形处理器凭借并行架构率先担纲，随后神经网络处理器、张量处理器等专用加速器兴起。它们通过提升并行度、压缩数据精度与优化存储层级来换取算力与能效。人工智能芯片已成为大模型与自动驾驶等应用的关键底座。
status: published
confidence: high
license: public-domain
ai_generated: true
ai_annotated: true
created_at: 2026-10-05
updated_at: 2026-10-05
rev: 1
structure:
  levels: [章]
  total_sections: 5
  total_words: 9000
sources:
  - title: "Wikipedia: AI accelerator"
    url: https://en.wikipedia.org/wiki/AI_accelerator
    license: Fair-Use
  - title: "维基百科 - 人工智能芯片"
    url: https://zh.wikipedia.org/wiki/人工智能芯片
    license: Fair-Use
see_also: [data-center, internet-of-things, blockchain]
---

# 人工智能芯片

**人工智能芯片**（AI Chip）指专门为人工智能计算、尤其是深度学习训练与推理而设计的处理器。它的核心使命，是用更低的能耗完成更多的乘加运算——因为神经网络的本质，就是由海量矩阵乘法与加法堆叠而成的数学模型。当通用处理器在并行度与能效上力不从心，图形处理器、张量处理器、神经网络处理器等专用芯片便应运而生。它们是大模型、自动驾驶、智能终端背后的算力底座（详见「数据中心」词条中关于算力基础设施的讨论）。

本词条按「算力专门化 → GPU 与并行计算 → NPU/TPU 与加速 → 存储器与互联 → 能效与趋势」五章展开。

## 导读

- 人工智能芯片的本质是**为矩阵运算而生的专用算力**。
- 图形处理器凭借并行架构成为深度学习的早期主力。
- 张量处理器与神经网络处理器进一步追求能效与定制。
- 存储带宽与片间互联常比峰值算力更决定实际表现。
- 能效比与先进封装是未来竞争的焦点。

> 📝 编者注：评价人工智能芯片，常被「峰值算力」数字误导。真实性能取决于数据能否及时喂给计算单元，存储与互联往往才是瓶颈，而非纸面算力。

<!-- PKS_EXPANDED_V5 -->
