---
schema: 1
slug: artificial-neural-network
title: 人工神经网络
aliases: [人工神经网络, 神经网络, Artificial Neural Network, ANN]
type: concept
categories:
  - 技术/信息技术
tags: [神经网络, 深度学习, 机器学习, 反向传播, 感知机]
summary: >-
  人工神经网络是一类受生物神经元启发、由大量简单计算单元分层连接而成的数学模型，通过调整连接权重从数据中学习映射。多层网络配合反向传播，构成了当代深度学习的基础，在视觉、语音与语言任务上取得了突破性进展，却也带来可解释性与可靠性的深层挑战。
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
  - title: "Deep Learning - Goodfellow, Bengio, Courville"
    url: https://www.deeplearningbook.org/
    license: CC-BY-SA-4.0
  - title: "Neural Networks and Learning Machines - Simon Haykin"
    url: https://www.wiley.com/en-us/Neural+Networks+and+Learning+Machines%2C+3rd+Edition-p-9780131471399
    license: Fair-Use
see_also: [transistor, computer, algorithm, integrated-circuit]
---

# 人工神经网络

**人工神经网络**（Artificial Neural Network）是一类由大量简单计算单元分层连接而成的数学模型，其灵感来自人脑神经元通过突触传递信号的方式。每个单元接收若干输入、做加权求和、再经一个非线性函数输出；成千上万个这样的单元叠成多层，整体便能用一组可调整的权重去逼近极其复杂的输入到输出映射。它并非真的在「思考」，而是用纯粹的数值方法，从海量样本中自动提炼出完成任务所需的规律。近十余年，随着数据、算力与算法的汇流，深层神经网络在图像识别、语音理解与机器翻译上接连超越旧方法，成为人工智能浪潮的核心引擎。理解它，是理解当代智能技术无法绕开的一课。

本词条按「从神经元到感知机 → 多层网络与反向传播 → 卷积与循环网络 → 训练的艺术 → 表示学习与局限」五章展开。

## 导读

- 神经网络的本质是「可调权重的多层函数」，学习即调权重。
- 单个神经元只会线性组合，非线性激活才让它具备拟合复杂边界的能力。
- 反向传播把误差从输出层逐层送回，给出每个权重的调整方向。
- 卷积网络擅长图像，循环网络擅长序列，结构要匹配数据形态。
- 过拟合是头号敌人，正则化与足量数据是克制它的两手。
- 性能强大不等于可解释，黑箱与鲁棒性恰是其最被诟病之处。

> 📝 编者注：常有人把神经网络形容为「模仿大脑」，这是修辞而非事实。生物神经元与人工单元在细节上相差悬殊，网络的学习机制也与人脑相去甚远。把它当作一种高效的数学函数逼近器，比当作「硅基大脑」更准确，也更能看清其能力与边界。

<!-- PKS_EXPANDED_V5 -->
