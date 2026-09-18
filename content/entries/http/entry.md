---
schema: 1
slug: http
title: 超文本传输协议（HTTP）
original_title: Hypertext Transfer Protocol
aliases: [HTTP, 超文本传输协议, HTTP 协议]
type: concept
categories:
  - 技术/信息技术
tags: [HTTP, 万维网, Web, 应用层协议, REST, URL]
summary: >-
  超文本传输协议（HTTP）是万维网的应用层协议，采用无状态请求/响应模型：客户端发出请求（方法、URL、首部），服务器返回响应（状态码、首部、主体）。2022 年 IETF 将规范整体重写为 RFC 9110（语义）、RFC 9112（HTTP/1.1）、RFC 9113（HTTP/2，基于 TCP 的二进制多路复用）与 RFC 9114（HTTP/3，基于 QUIC/UDP），并以 HTTPS 叠加 TLS 提供加密与认证，构成现代 Web 的安全底座。
status: published
confidence: high
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
created_at: 2026-09-12
updated_at: 2026-09-12
rev: 1
sort_date: 1991
structure:
  levels: [章]
  total_sections: 3
  total_words: 2000
sources:
  - title: RFC 9110 - HTTP Semantics
    url: https://www.rfc-editor.org/rfc/rfc9110
    license: IETF-Trust
  - title: RFC 9112 - HTTP/1.1
    url: https://www.rfc-editor.org/rfc/rfc9112
    license: IETF-Trust
  - title: RFC 9113 - HTTP/2
    url: https://www.rfc-editor.org/rfc/rfc9113
    license: IETF-Trust
  - title: RFC 9114 - HTTP/3
    url: https://www.rfc-editor.org/rfc/rfc9114
    license: IETF-Trust
  - title: HTTP - MDN Web Docs
    url: https://developer.mozilla.org/en-US/docs/Web/HTTP
    license: CC-BY-SA-4.0
see_also: [internet, tcp-ip]
---

# 超文本传输协议（HTTP）

**超文本传输协议（HTTP）** 是万维网的应用层协议，定义了浏览器与服务器之间如何请求与返回资源。它采用**无状态**的请求/响应模型：客户端发出一个请求（含方法、URL、首部），服务器返回一个响应（含状态码、首部、主体）。

本词条按「请求/响应模型与报文 → 从 HTTP/1.1 到 HTTP/3 的演进 → 无状态、缓存与 Web 安全」三章展开。

## 导读

- HTTP 由 **RFC 9110** 定义「版本无关」的核心语义（方法、状态码、首部），与传输无关。
- **HTTP/1.1**（RFC 9112）用文本报文与持久连接；**HTTP/2**（RFC 9113）在 TCP 上做二进制帧与多路复用；**HTTP/3**（RFC 9114）改跑在 QUIC/UDP 上以消除队头阻塞。
- HTTP 本身**无状态**，靠 **Cookie**（RFC 6265）维持会话、靠缓存（RFC 9111）提速。
- **HTTPS** = HTTP 叠加 TLS，提供加密、身份认证与完整性，是现代 Web 的默认形态。

> 📝 编者注：2022 年 IETF 把散落多年的 HTTP 规范重写为一套「单一协议、多种映射」的连贯 RFC 族——理解「HTTP 不分版本、版本只是传输映射」，是读懂现代 Web 的关键。

下文分三章展开：第一章讲请求/响应模型与报文结构，第二章梳理 HTTP/1.1→2→3 的演进，第三章谈无状态、缓存与 Web 安全。

<!-- PKS_EXPANDED_V5 -->
