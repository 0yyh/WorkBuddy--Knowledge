---
schema: 1
slug: computer-vision
title: 计算机视觉
original_title: Computer Vision
aliases: [机器视觉, 图像识别, 视觉计算]
type: concept
categories:
  - 技术/信息技术
tags: [计算机视觉, 深度学习, 图像识别, 物体检测, 人工智能]
summary: >-
  计算机视觉研究如何让机器从图像与视频中获取、处理并理解视觉信息，使计算机具备类似「看」与「懂」的能力。它涵盖图像分类、物体检测、语义分割与三维重建等任务，是自动驾驶、医疗影像与工业质检的技术底座。深度学习的兴起使视觉系统的精度发生阶跃，但数据偏见、可解释性与隐私等问题也随之凸显。
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
  - title: "Computer vision - Encyclopaedia Britannica"
    url: https://www.britannica.com/technology/computer-vision
    license: Fair-Use
see_also: [artificial-intelligence, machine-learning, artificial-neural-network, smartphone, computer]
---

# 计算机视觉

**计算机视觉**（Computer Vision）是让计算机从图像与视频中自动提取信息、理解内容的学科，目标是赋予机器一套「看」并「懂」的能力。对人类而言，视觉几乎是本能；对机器而言，一张图片最初只是一堆按行列排列的数字（像素），没有任何「意义」。计算机视觉要做的，正是把这些数字还原为边缘、形状、物体乃至场景语义。它支撑着人脸解锁、医学读片、工厂瑕疵检测与自动驾驶感知等关键应用。近十余年，以卷积神经网络为代表的深度学习方法让视觉系统的准确率突飞猛进，也使得这一领域从实验室走向了每个人的手机。

本词条按「图像与特征 → 从传统方法到深度学习 → 物体检测与分割 → 三维与视频理解 → 应用与伦理」五章展开。

## 导读

- 图像在机器眼中是像素矩阵，视觉任务即从中反推结构与语义。
- 传统方法手工设计特征，深度学习则让网络自学习特征。
- 检测与分割把「有物体」推进到「在哪、是什么、像素属于谁」。
- 视频与三维理解引入时间与空间维度，逼近真实感知。
- 偏见、误判与隐私，是视觉能力扩张必须面对的阴影。

> 📝 编者注：计算机视觉与图像处理不同：前者重在「理解」，后者重在「增强」；二者方法交叉，但目标一个在语义、一个在画质。

<!-- PKS_EXPANDED_V5 -->
