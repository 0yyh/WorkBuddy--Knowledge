---
schema: 1
slug: programming-language
title: 编程语言
aliases: [编程语言, 程序设计语言, Programming Language]
type: concept
categories:
  - 技术/信息技术
tags: [编程语言, 语法, 类型系统, 编译, 范式]
summary: >-
  编程语言是人类用来向计算机精确描述「算什么、怎么算」的规范化符号系统，是人与机器之间的契约。它提供抽象（变量、函数、类型）与控件（顺序、分支、循环），并因范式、类型与执行模型的不同而各有性格。选一门语言，往往是在可读性、性能与安全之间做权衡。
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
  - title: "Structure and Interpretation of Computer Programs - Abelson and Sussman"
    url: https://mitpress.mit.edu/9780262510875/structure-and-interpretation-of-computer-programs/
    license: CC-BY-SA-4.0
  - title: "Types and Programming Languages - Benjamin Pierce"
    url: https://www.cis.upenn.edu/~bcpierce/tapl/
    license: Fair-Use
see_also: [computer, software, compiler, algorithm]
---

# 编程语言

**编程语言**（Programming Language）是人类用来向计算机下达精确指令的规范化符号系统。它介于自然语言（灵活却含糊）与机器码（精确却难写）之间，让我们用近似「描述逻辑」的方式，写出机器能忠实执行的东西。一门语言不只是语法，更是一套**抽象工具箱**：用变量装数据、用函数封装步骤、用类型标注意义、用控制结构表达顺序与选择。从汇编到今天的高级语言，演化主线就是不断把「机器关心的细节」藏起来，让人专注「要解决的问题」。世界上有数千门语言，没有哪门通吃，因为每门都在可读性、性能、安全之间做了不同取舍。理解编程语言，是理解「人如何指挥机器」的核心。

本词条按「为何需要语言 → 命令式与声明式 → 类型系统 → 编译与解释 → 语言设计权衡」五章展开。

## 导读

- 编程语言是人与机器间的精确契约，介于自然语言与机器码之间。
- 抽象层次越高，人越省力，机器越要替你想更多。
- 命令式描述「怎么做」，声明式描述「要什么」。
- 类型系统是静态安全网，也是表达力的双刃剑。
- 编译先翻后跑，解释边读边跑，混合路线渐成主流。
- 选语言本质是在可读性、性能、安全间权衡。

> 📝 编者注：常有人追问「哪门语言最好」。这是伪问题。语言是工具，工具适不适合，看任务与团队。系统内核用贴近硬件的语言，数据科学用表达力强的语言，网页前端受运行环境所限用特定语言。问「最好」不如问「何时该用哪门」。

<!-- PKS_EXPANDED_V5 -->
