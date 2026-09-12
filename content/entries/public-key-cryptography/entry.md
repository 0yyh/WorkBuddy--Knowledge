---
schema: 1
slug: public-key-cryptography
title: 公钥密码学
original_title: Public-key cryptography
aliases: [公钥密码学, 非对称加密, 公开密钥密码体系, 公钥加密]
type: concept
categories:
  - 技术/信息技术
tags: [公钥密码学, 非对称加密, RSA, Diffie-Hellman, 数字签名, TLS, 密钥交换]
summary: >-
  公钥密码学（非对称加密）使用一对数学相关但不同的密钥：公钥可公开，用于加密或验证；私钥须保密，用于解密或签名。其安全性建立在"从公钥推算私钥在计算上不可行"的数学难题上。1976 年 Diffie 与 Hellman 首次提出该思想并给出密钥交换协议，1978 年 Rivest、Shamir 与 Adleman 提出首个实用算法 RSA（基于大整数分解）。它与数字证书、PKI 共同构成 TLS/HTTPS、SSH 等现代网络安全的基础。
status: published
confidence: high
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
created_at: 2026-09-12
updated_at: 2026-09-12
rev: 1
sort_date: 1976
structure:
  levels: [章]
  total_sections: 3
  total_words: 2000
sources:
  - title: Diffie & Hellman (1976) New Directions in Cryptography
    url: https://doi.org/10.1109/TIT.1976.1055638
    license: IEEE
  - title: Rivest, Shamir & Adleman (1978) A Method for Obtaining Digital Signatures and Public-Key Cryptosystems
    url: https://doi.org/10.1145/359340.359342
    license: ACM
  - title: Public-key cryptography - Wikipedia
    url: https://en.wikipedia.org/wiki/Public-key_cryptography
    license: CC-BY-SA-4.0
see_also: [tcp-ip, http]
---

# 公钥密码学

**公钥密码学（public-key cryptography）**，又称**非对称加密**，是现代密码学的核心机制。它用一对数学相关但不同的密钥：

- **公钥（public key）** 可以公开，用来**加密**或**验证签名**；
- **私钥（private key）** 必须保密，用来**解密**或**签名**。

它解决了对称加密最大的痛点——**密钥如何安全地分发给彼此不认识的双方**。

本词条按「对称加密的困境与公钥思想 → Diffie–Hellman 与 RSA 两大算法 → 数字签名与 TLS 中的现实作用」三章展开。

## 导读

- 对称加密的死穴：通信双方越多，所需密钥数随人数平方暴涨，分发成难题。
- **1976 年** Diffie 与 Hellman 首次提出公钥思想，并给出 **Diffie–Hellman 密钥交换**（基于离散对数）。
- **1978 年** Rivest、Shamir、Adleman 提出 **RSA**（基于大整数分解），首个实用化公钥算法，兼做加密与数字签名。
- 公钥 + 数字证书（X.509）+ CA 构成 **PKI**，是 TLS/HTTPS、SSH 的安全根基。

> 📝 编者注：历史学家 David Kahn 称公钥密码学是"文艺复兴多表代换密码以来，这个领域最革命性的新概念"。它的颠覆在于——加密不再需要先安全地交换密钥。

下文分三章展开：第一章讲对称加密困境与公钥思想，第二章讲 Diffie–Hellman 与 RSA，第三章讲数字签名与在 TLS 中的现实作用。

<!-- PKS_EXPANDED_V4 -->
