---
schema: 1
slug: tcp-ip
title: TCP/IP 协议套件
original_title: Internet protocol suite (TCP/IP)
aliases: [TCP/IP, TCP/IP 协议族, 互联网协议套件]
type: concept
categories:
  - 技术/信息技术
tags: [TCP/IP, 网络, 协议, 互联网, IP, TCP, 分层模型]
summary: >-
  TCP/IP（互联网协议套件）是互联网的事实标准通信协议族，以传输控制协议（TCP）与网际协议（IP）得名，按 RFC 1122 分为链路层、网际层、传输层、应用层四层。IP 提供无连接、尽力而为的寻址与路由，TCP 在其上提供可靠、有序、带重传与拥塞控制的字节流；UDP 与 QUIC 面向低时延。整套规范由 IETF 以 RFC 文档维护，自 1983 年阿帕网全面切换 TCP/IP 起支撑了全球互联网。
status: published
confidence: high
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
created_at: 2026-09-12
updated_at: 2026-09-12
rev: 1
sort_date: 1983
structure:
  levels: [章]
  total_sections: 3
  total_words: 2100
sources:
  - title: RFC 791 - Internet Protocol
    url: https://www.rfc-editor.org/rfc/rfc791
    license: IETF-Trust
  - title: RFC 9293 - Transmission Control Protocol (TCP)
    url: https://www.rfc-editor.org/rfc/rfc9293
    license: IETF-Trust
  - title: RFC 1122 - Requirements for Internet Hosts
    url: https://www.rfc-editor.org/rfc/rfc1122
    license: IETF-Trust
  - title: Internet protocol suite - Wikipedia
    url: https://en.wikipedia.org/wiki/Internet_protocol_suite
    license: CC-BY-SA-4.0
see_also: [internet, http, public-key-cryptography]
---

# TCP/IP 协议套件

**TCP/IP**（互联网协议套件，Internet protocol suite）是把全球计算机网络互联、相互通信的**事实标准协议族**。它并非单指 TCP 与 IP 两个协议，而是一整套按功能分层的协作协议——IP 负责寻址与路由，TCP 负责可靠传输，再配合 UDP、ICMP、DNS、HTTP 等构成"网络的网络"（internetworking）。

本词条按「四层模型与端到端哲学 → IP 与 TCP 两大基石 → 如何支撑互联网」三章展开。

## 导读

- TCP/IP 由 **RFC 1122** 定义为四层：链路层、网际层、传输层、应用层（而非教学的七层 OSI 模型）。
- **IP**（RFC 791）只管"尽力送达"：无连接、不保证可靠；**TCP**（RFC 9293）在 IP 之上补上可靠、有序、重传与拥塞控制。
- **端到端（end-to-end）** 原则：智能放在通信两端，网络只做简单转发——这是互联网半个世纪持续创新的结构性原因。
- TCP/IP 由 **IETF** 以一系列 RFC 文档维护；1983 年 1 月 1 日阿帕网"旗帜日"全面切换，常被视为互联网生日。

> 📝 编者注：TCP/IP 与 OSI 常被混谈。工程中真正运行的是 TCP/IP 四层；OSI 七层更多是教学参考模型，二者并非严格对应。

下文分三章展开：第一章讲四层模型与端到端哲学，第二章剖析 IP 与 TCP 两大基石，第三章说明协议套件如何支撑起整个互联网。

<!-- PKS_EXPANDED_V4 -->
