// Pilot 辅助脚本（T03）：生成 content/.staging/answers/{slug}.json 预写生成结果。
// 每个文件结构 { "text": "<可直接被 parse-output 解析的目录文件集文本>" }，
// 文本采用「# file: <name>」多文件块格式（parse-output 的 mode b）。
// 用法：node packages/cli/templates/make-pilot-answers.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '../../../content/.staging/answers');
mkdirSync(ROOT, { recursive: true });

const block = (name, body) => `# file: ${name}\n${body.trim()}\n`;

function entry(slug, title, summary, seeAlso, body) {
  const fm = `---
schema: 1
slug: ${slug}
title: ${title}
aliases: [${title}, ${slug}]
type: concept
categories:
  - ${slug === 'velocity-of-money' ? '经济学/宏观经济学' : '经济学/金融/货币与银行'}
tags: [${slug}, 货币, 金融]
summary: >-
  ${summary}
status: published
confidence: high
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
created_at: 2026-09-12
updated_at: 2026-09-12
rev: 1
sources:
  - title: Source - Wikipedia
    url: https://en.wikipedia.org/wiki/${slug}
    license: Fair-Use
see_also: [${seeAlso}]
---`;
  return block('entry.md', `${fm}\n\n# ${title}\n\n${body}`);
}

function chapter(slug, n, title, tldr, keypoints, body) {
  const fm = `---
schema: 1
slug: ${slug}/ch-${String(n).padStart(2, '0')}
work: ${slug}
key: ch-${String(n).padStart(2, '0')}
title: 第${['一', '二', '三', '四'][n - 1] ?? n}章 ${title}
order: [${n}]
path: [第${['一', '二', '三', '四'][n - 1] ?? n}章 ${title}]
depth: 1
status: published
license: CC-BY-SA-4.0
ai_generated: true
ai_annotated: true
sources:
  - title: Source - Wikipedia
    url: https://en.wikipedia.org/wiki/${slug}
    license: Fair-Use
summary:
  tldr: ${tldr}
  keyPoints:
${keypoints.map((k) => `    - ${k}`).join('\n')}
---`;
  return block(`chapters/ch-${String(n).padStart(2, '0')}.md`, `${fm}\n\n## 第${['一', '二', '三', '四'][n - 1] ?? n}章 ${title}\n\n${body}`);
}

const DATA = {
  'monetary-base': entry(
    'monetary-base',
    '基础货币',
    '基础货币（monetary base，又称高能货币）是中央银行的负债，由流通于银行体系之外的现金与商业银行存放在中央银行的准备金两部分构成。它是整个货币供应的源头，通过货币乘数放大为广义货币供应量；理解基础货币是理解现代信用货币创造与货币政策传导的逻辑起点。',
    'money, central-banking, inflation',
    '**基础货币**（monetary base / high-powered money）是中央银行资产负债表中的负债项，等于流通中现金（C）与商业银行在央行的准备金存款（R）之和，即 B = C + R。\n\n## 构成\n\n- **流通中现金**：公众持有的纸币与硬币。\n- **银行准备金**：商业银行存放在央行的存款，分法定与超额准备金。\n\n> 📝 编者注：基础货币之所以称为"高能"，是因为一元基础货币可支撑数倍于自身的广义货币。\n\n## 与货币乘数的关系\n\n货币供应量 M ≈ 基础货币 B × 货币乘数 m。\n\n## 央行的投放与回笼\n\n央行通过公开市场操作、再贴现、准备金率调节基础货币总量。',
  ) + chapter('monetary-base', 1, '基础货币的定义与构成', '基础货币是央行负债，由流通中现金与银行准备金构成，是货币供应的源头。', ['B = 流通中现金 C + 银行准备金 R', '央行直接可控的负债项', '经货币乘数放大为广义货币'], '基础货币（monetary base）是中央银行负债，由流通中现金与银行准备金构成，是理解信用货币创造的第一块基石。') + chapter('monetary-base', 2, '基础货币与货币乘数', '货币供应 M 约等于基础货币乘以货币乘数，乘数受准备金率与现金漏损影响。', ['M = m × B', '准备金率越低乘数越大', '现金漏损削弱乘数'], '货币供应量 M 约等于基础货币 B 乘以货币乘数 m，货币乘数受准备金率、现金漏损率等因素影响。') + chapter('monetary-base', 3, '央行的投放与回笼', '央行用公开市场操作等工具调节基础货币，进而影响货币与信用。', ['公开市场操作买卖国债', '再贴现调节准备金', '准备金率影响乘数'], '央行通过公开市场操作、再贴现与存款准备金率等工具调节基础货币总量，进而影响全社会货币与信用条件。'),

  'credit-creation': entry(
    'credit-creation',
    '信用创造',
    '信用创造指在部分准备金制度下，商业银行通过发放贷款将一笔原始存款转化为数倍广义货币的过程。它是现代信用货币体系的核心机制，也是理解货币供应为何主要由银行贷款而非央行印刷决定的关键。',
    'money, central-banking, inflation',
    '**信用创造**（credit creation）是商业银行在部分准备金制度下，把原始存款通过贷款循环放大为更多存款货币的过程。\n\n## 部分准备金与存款创造\n\n银行只需保留一部分存款作准备金，其余可贷出；贷出资金存入他行后又成为新准备金，循环往复。\n\n## 贷款—存款循环\n\n一笔贷款立即成为借款人的存款，该存款再次进入银行体系参与下一轮放贷。\n\n> 📝 编者注：现代货币多是"银行贷款创造存款"，而非央行印刷。',
  ) + chapter('credit-creation', 1, '部分准备金与存款创造', '部分准备金制度下，银行保留部分存款作准备金，其余贷出，形成存款创造。', ['准备金率决定可贷比例', '超额准备金可贷出', '原始存款被放大'], '在部分准备金制度下，银行只需保留一部分存款作准备金，其余可用于放贷，从而启动存款创造。') + chapter('credit-creation', 2, '贷款—存款循环与货币乘数', '贷款转化为借款人存款，再次进入体系参与放贷，形成货币乘数。', ['贷款即新增存款', '多轮循环放大', '乘数受漏损约束'], '一笔贷款立即成为借款人的存款，该存款再次进入银行体系参与下一轮放贷，形成货币乘数。') + chapter('credit-creation', 3, '信用创造的上限与现实约束', '理论乘数有上限，现实受需求、资本与监管约束。', ['理论乘数 = 1/准备金率', '信贷需求不足则收缩', '资本充足率约束'], '理论货币乘数存在上限 1/准备金率，但现实中受信贷需求、银行资本与监管约束而低于理论值。'),

  'velocity-of-money': entry(
    'velocity-of-money',
    '货币流通速度',
    '货币流通速度衡量单位货币在一定时期内的周转次数，由交易方程式 MV = PQ 表达。它连接货币存量与名义产出，是古典数量论与货币政策分析的重要变量；其短期的不稳定性也构成对简单货币数量论的挑战。',
    'money, inflation, interest-rate',
    '**货币流通速度**（velocity of money）衡量同一单位货币在一定时期内被用于交易的次数。\n\n## 定义 MV = PQ\n\n名义支出（MV）等于名义产出（PQ），V 即流通速度。\n\n## 费雪方程\n\n费雪把货币数量与价格水平直接联系起来。\n\n> 📝 编者注：若 V 稳定，货币供给决定物价；但 V 在短期往往不稳定。',
  ) + chapter('velocity-of-money', 1, '货币流通速度的定义', '货币流通速度是单位货币在一段时间内的周转次数，由 MV=PQ 表达。', ['V = 名义GDP / 货币存量', '衡量货币周转效率', '连接存量与产出'], '货币流通速度 V 定义为名义 GDP 与货币存量之比，衡量单位货币的周转次数。') + chapter('velocity-of-money', 2, '费雪方程与古典数量论', '费雪方程 MV=PQ 将货币存量与价格水平直接联系。', ['M 变动同向影响 P', '古典假设 V 稳定', '长期近似成立'], '费雪方程 MV = PQ 把货币数量与价格水平直接联系起来；古典学派假设 V 长期稳定。') + chapter('velocity-of-money', 3, '对货币政策的含义', 'V 短期不稳定削弱货币数量论的简单预测力。', ['V 波动影响传导', '不能简单以 M 预测 P', '需结合信贷与需求'], '由于 V 在短期往往不稳定，货币政策不能仅靠调节 M 来精确预测物价，还需考虑信贷与需求。'),
};

for (const [slug, text] of Object.entries(DATA)) {
  const file = resolve(ROOT, `${slug}.json`);
  writeFileSync(file, JSON.stringify({ text }, null, 2), 'utf8');
  console.log('wrote', file);
}
console.log('done');
