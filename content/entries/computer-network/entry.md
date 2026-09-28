---
schema: 1
slug: computer-network
title: 计算机网络
aliases: [计算机网络, 网络, Computer Network]
type: concept
categories:
  - 技术/信息技术
tags: [网络, 协议, TCP/IP, 路由, 互联网]
summary: >-
  计算机网络是把分散的计算设备通过链路与交换节点互联、按共同规则（协议）交换数据的系统。分层协议栈把复杂的通信拆成可管理的层次，分组交换取代独占电路，使全球设备得以低成本互连。理解网络，是理解互联网、云与一切联机服务的前提。
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
  - title: "Computer Networking - A Top-Down Approach - Kurose and Ross"
    url: https://gaia.cs.umass.edu/kurose_ross/
    license: Fair-Use
  - title: "RFC 1122 - Internet Host Requirements"
    url: https://www.rfc-editor.org/rfc/rfc1122
    license: Fair-Use
see_also: [computer, operating-system, internet, transistor]
---

# 计算机网络

**计算机网络**（Computer Network）是把地理位置分散的计算设备，通过通信链路与交换节点彼此连接，使它们能按约定的规则交换信息的系统。从两台电脑用一根线直连，到横跨地球、连接数十亿设备的互联网，本质都是「让数据找到该去的地方」。早期通信靠独占的电路（像电话那样先占一条线），代价高昂且浪费；现代网络改用**分组交换**：把数据切成一个个小包，各自寻路、到端重组，链路被所有用户分时共享。支撑这一切的，是一套层层叠叠的「协议」——它规定了数据怎么打包、怎么寻址、出错怎么重传。没有网络，计算机只是孤岛；有了网络，孤岛连成大陆。

本词条按「网络为何分层 → 局域网与分组交换 → 传输层 TCP 与 UDP → 应用层 DNS 与 HTTP → 安全与演进」五章展开。

## 导读

- 分层把复杂通信拆成各管一摊的层次，层间只约接口。
- 分组交换让链路被多用户共享，远比独占电路高效。
- IP 负责把包送到地址，TCP 负责可靠、UDP 负责轻快。
- DNS 把人名变成 IP，HTTP 规定了网页怎么取。
- 加密与信任机制，是把开放网络变可用的前提。
- 网络仍在演进：从 IPv4 到 IPv6，从中心化到边缘智能。

> 📝 编者注：常有人把「互联网」与「计算机网络」混用。严格说，互联网只是众多计算机网络中的一种——一个覆盖全球、基于 TCP/IP 的特定网络。局域网、企业内网也都是计算机网络，只是范围与协议栈选择不同。本条谈的是更一般的「网络」原理。

<!-- PKS_EXPANDED_V5 -->
