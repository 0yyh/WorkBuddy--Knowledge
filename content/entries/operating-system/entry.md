---
schema: 1
slug: operating-system
title: 操作系统
aliases: [作业系统, 操作系统, Operating System]
type: concept
categories:
  - 技术/信息技术
tags: [操作系统, 进程, 内核, 文件系统, 多任务]
summary: >-
  操作系统是管理计算机硬件与软件资源、为应用程序提供运行环境的基础软件。它抽象了复杂的硬件细节，以进程调度、内存管理、文件系统与设备驱动，让人类得以高效、安全地使用机器。从批处理到分时、从命令行到图形界面，操作系统决定了人与计算机协作的方式，是数字世界的中枢层。
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
  - title: "Operating system - Encyclopaedia Britannica"
    url: https://www.britannica.com/technology/operating-system
    license: Fair-Use
  - title: "Operating System Concepts"
    url: https://www.wiley.com/en-us/Operating+System+Concepts%2C+10th+Edition-p-9781119456339
    license: Fair-Use
see_also: [microprocessor, compiler, computer-network, database, artificial-neural-network]
---

# 操作系统

**操作系统**（Operating System）是管理计算机硬件与软件资源、为应用程序提供运行环境的**基础软件**。没有它，程序员就得直接面对寄存器、中断与磁盘扇区，寸步难行。操作系统把杂乱的硬件抽象成简洁的接口：它决定哪个程序先用处理器、谁的内存不被谁踩、文件存到哪里、键盘鼠标如何响应。从早期批处理到今天手机里的系统，它始终是人与机器之间那层中枢。理解计算机，操作系统是绕不开的「看不见的管家」。

本词条按「为何需要操作系统 → 从裸机到管理程序 → 进程、内存与文件 → 图形界面与多任务 → 移动、分布式与未来」五章展开。

## 导读

- 操作系统的本质是「抽象与仲裁」：把复杂硬件藏起来，把稀缺资源公平分配。
- 没有操作系统，应用要直接操纵硬件，开发与运行都不可行。
- 进程调度决定多任务如何「看似同时」运行；内存管理防止程序互踩。
- 文件系统把离散的存储介质组织成可寻址的树状命名空间。
- 图形界面降低了使用门槛，使计算机从专家走向大众。
- 移动与云时代，操作系统走向轻量、分布式与跨设备协同。

> 📝 编者注：常见误解是「操作系统就是桌面那层图标」。其实图标的底下，是内核在毫秒级地调度成千上万的事件。用户看到的是界面，机器跑的是调度与隔离——前者是门面，后者才是灵魂。

<!-- PKS_EXPANDED_V5 -->
