---
schema: 1
slug: compiler
title: 编译器
aliases: [编译器, 编译程序, Compiler]
type: concept
categories:
  - 技术/信息技术
tags: [编译器, 翻译, 中间表示, 优化, 代码生成]
summary: >-
  编译器是把用高级编程语言写成的源程序，翻译成等价、可执行的机器代码或低级代码的程序。它通常由前端（词法、语法、语义分析）、中端（优化）与后端（代码生成）串成，把人类易读的逻辑逐步降维成硬件能跑的指令。理解编译器，是理解「代码如何变成动作」的核心一环。
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
  - title: "Compilers - Principles, Techniques and Tools - Aho, Lam, Sethi, Ullman"
    url: https://www.amazon.com/Compilers-Principles-Techniques-Tools-2nd/dp/0321486811
    license: Fair-Use
  - title: "Engineering a Compiler - Cooper and Torczon"
    url: https://www.elsevier.com/books/engineering-a-compiler/cooper/978-0-12-088478-0
    license: Fair-Use
see_also: [programming-language, computer, software, operating-system]
---

# 编译器

**编译器**（Compiler）是一种特殊程序：它的输入是另一段用高级语言写成的「源程序」，输出是与之等价、可由机器直接执行或进一步处理的「目标代码」。它像一位精通两种语言的翻译，把人易读、易写的逻辑，转换成硬件只认得的一串串指令。没有编译器，程序员就得用近似开关的机器码或繁琐的汇编直接与芯片对话，软件的规模与复利效应都无从谈起。现代编译器还不止翻译——它会在翻译途中重写代码，使其跑得更快、占用更少，这种「优化」让同一份高级代码在不同机器上都接近手工调校的效率。从浏览器里的脚本到卫星上的固件，几乎每段软件都经过编译器的手。理解它，就是理解「我们写的字，如何变成世界上真实的动作」。

本词条按「编译器做什么 → 词法与语法分析 → 语义与中间表示 → 优化 → 代码生成与后端」五章展开。

## 导读

- 编译器把高级源程序翻译成等价的低级目标代码。
- 翻译分前端解析、中端优化、后端生成三段。
- 词法分析切词，语法分析验结构，二者都靠形式文法。
- 中间表示让优化与机器无关，后端再落地到具体芯片。
- 优化重写代码以提升速度或省空间，但须保持语义等价。
- 解释器边读边执行，与编译器先翻后跑形成对照。

> 📝 编者注：常有人把「编译」「解释」对立成优劣。其实它们是执行模型的选择：编译先翻全篇再跑，启动慢、运行快；解释边读边做，启动快、运行慢。许多现代语言（如 Java、Python）走混合路线——先编译到中间字节码，再由虚拟机解释或即时编译，兼取两者之长。

<!-- PKS_EXPANDED_V5 -->
