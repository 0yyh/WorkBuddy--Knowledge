---
schema: 1
slug: number-theory
title: 数论
original_title: Number theory
aliases: [整数论, 高等算术, 算术]
type: concept
categories:
  - 科学/数学与系统科学/数学基础
tags: [数论, 素数, 同余, 费马, 欧拉, 黎曼猜想, 模运算]
summary: >-
  数论研究整数及其整除关系，是数学中最古老也最纯粹的分支。它从整除、最大公约数与同余出发，揭示素数的神秘分布；费马小定理与欧拉定理把模运算变成可计算的工具，而黎曼ζ函数则把素数分布与复分析深刻相连，催生出数学最重要的未解猜想之一。现代公钥密码（RSA、Diffie-Hellman）正是建立在「大整数分解」与「离散对数」这两个数论难题之上——最抽象的整数游戏，由此成为信息安全的基石。本词条按「整除与同余 → 素数分布 → 费马小定理与欧拉定理 → 解析数论（黎曼ζ）→ 现代公钥基础」五章展开。
status: published
confidence: high
license: public-domain
ai_generated: true
ai_annotated: true
created_at: 2026-09-24
updated_at: 2026-09-24
rev: 1
structure:
  levels: [章]
  total_sections: 5
  total_words: 9000
sources:
  - title: "数论 - 斯坦福哲学百科全书"
    url: https://plato.stanford.edu/entries/number-theory/
    license: Fair-Use
  - title: "素数定理 - 大英百科全书"
    url: https://www.britannica.com/science/prime-number-theorem
    license: Fair-Use
see_also: [algebra, computability, set-theory, infinity]
---

# 数论

**数论**是关于整数——尤其关于素数——的学问。它问的常常是看似幼稚的问题：哪些数能写成两个平方数之和？是否存在无穷多个素数？为什么任意两个相邻整数互素。这些问题小学生也能听懂，却能让最杰出的数学家耗尽一生。高斯说「数学是科学的女王，数论是数学的女王」。数论的纯粹曾令人怀疑它毫无用处；然而今天，互联网的每一次加密握手都依赖数论难题。它证明了：最远离应用的数学，往往在某天成为应用最深处的基础。

本词条按「整除与同余 → 素数分布 → 费马小定理与欧拉定理 → 解析数论（黎曼ζ）→ 现代公钥基础」五章展开。

## 导读

- 数论从整除与最大公约数出发，用**欧几里得算法**高效求公约数，是算法的古老典范。
- **同余**（模运算）把整数按余数分类，是数论与现代计算机算术的共同语言。
- 费马小定理与欧拉定理给出幂在模下的简洁规律，是公钥密码的直接数学依据。
- 素数分布由**素数定理**描述，而黎曼ζ函数的零点猜想试图解释其更深层的规律。
- 现代**公钥密码**（RSA、Diffie-Hellman）把「分解大数难」「离散对数难」变成锁。

> 📝 编者注：本词条与「代数」的有限域、模运算互为表里；与「可计算性」相关——许多数论问题（如整数分解）的「困难性」正是密码学依赖的假设。可对照「无穷」理解素数无穷这一出发点。

<!-- PKS_EXPANDED_V5 -->
