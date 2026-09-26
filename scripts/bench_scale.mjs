/**
 * R3 规模化压测（#426）——@pks/core 级别，不依赖浏览器。
 *
 * 目标：验证「2000 万字」规模下客户端 BM25 检索（SearchEngine.searchL2）延迟是否可接受，
 * 为 T4（Context 拆分）是否必要提供实测依据。
 *
 * 做法：
 *  1. 载入真实已构建索引（apps/web/public/content/index）：manifest / titleIndex /
 *     64 个检索分片（base64 postings 解码）/ 65 个 df 桶。
 *  2. 基线引擎：真实语料（≈318 万字 terms，2528 docs，64 分片）。
 *  3. 规模化引擎：把每个分片的倒排表复制 K 份（docId 偏移 c*L，df 同步 ×K），
 *     模拟 ~2000 万字（K=7 → 17696 docs，≈2226 万字 terms）。
 *  4. 各跑一批代表查询（真实标题 + 常用哲学词），统计 p50/p95/平均延迟与构建/预热耗时、内存。
 *
 * 运行：从 packages/cli 目录执行（@pks/core 经 workspace 软链解析）：
 *   node ../../node_modules/.pnpm/tsx@4.23.13/node_modules/tsx/dist/cli.mjs ../../scripts/bench_scale.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SearchEngine,
  decodePostings,
  decodeDfBucket,
  inlineIndexToMap,
} from '../packages/core/dist/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = resolve(ROOT, 'apps/web/public/content/index');
const K = 7; // 规模化倍率：318万字 × 7 ≈ 2226 万字（贴近 2000 万字目标）

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** 解码单个检索分片为 ShardIndex（postings / 内联 index 双格式兼容）。 */
function decodeShard(file) {
  const wire = readJson(file);
  const index = wire.postings
    ? decodePostings(wire.postings)
    : wire.index
      ? inlineIndexToMap(wire.index)
      : {};
  return { shard: wire.shard, docs: wire.docs, lengths: wire.lengths, index };
}

function loadBase() {
  const manifest = readJson(resolve(CONTENT, 'manifest.json'));
  const titleIndex = readJson(resolve(CONTENT, 'search/title.json'));
  const shards = [];
  for (let s = 0; s < manifest.search.shards; s++) {
    shards.push(decodeShard(resolve(CONTENT, `search/s${String(s).padStart(2, '0')}.json`)));
  }
  // 合并 df 桶
  const baseDf = new Map();
  const dfDir = resolve(CONTENT, 'search/df');
  for (const f of readdirSync(dfDir)) {
    if (!f.startsWith('bucket-')) continue; // 跳过 meta.json
    const bucket = decodeDfBucket(readFileSync(resolve(dfDir, f), 'utf8'));
    for (const [term, count] of Object.entries(bucket.df)) {
      baseDf.set(term, (baseDf.get(term) ?? 0) + count);
    }
  }
  return { manifest, titleIndex, shards, baseDf };
}

/** 把真实分片复制 K 份（docId 偏移），产出规模化分片。 */
function scaleShard(base, k) {
  const L = base.docs.length;
  const docs = [];
  const lengths = [];
  for (let c = 0; c < k; c++) {
    for (const d of base.docs) docs.push(d);
    for (const l of base.lengths) lengths.push(l);
  }
  const index = {};
  for (const [term, postings] of Object.entries(base.index)) {
    const out = new Map();
    for (let c = 0; c < k; c++) {
      for (const [docLocal, tf] of postings) out.set(docLocal + c * L, tf);
    }
    index[term] = out;
  }
  return { shard: base.shard, docs, lengths, index };
}

function buildEngine(manifest, titleIndex, shards, df, totalDocs, avgLen) {
  const cache = new Map();
  const shardLoader = async (s) => {
    if (cache.has(s)) return cache.get(s);
    const sh = shards[s] ?? null;
    cache.set(s, sh);
    return sh;
  };
  const stats = { totalDocs, avgLen, df };
  return new SearchEngine(manifest, titleIndex, shardLoader, stats);
}

/** 生成代表查询集：真实标题片段 + 常用单/双字哲学词。 */
function buildQueries(titleIndex) {
  const fromTitles = titleIndex
    .filter((_, i) => i % Math.max(1, Math.floor(titleIndex.length / 40)) === 0)
    .slice(0, 40)
    .map((t) => t.title);
  const terms = ['哲学', '自由', '正义', '国家', '理性', '美', '时间', '语言', '社会', '意识', '知识', '道德'];
  return [...fromTitles, ...terms];
}

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function benchSearch(engine, queries, rounds) {
  // 预热：触发全部分片加载
  const t0 = performance.now();
  await engine.searchL2(queries[0]);
  const warm = performance.now() - t0;

  const perQuery = [];
  for (const q of queries) {
    let best = Infinity;
    for (let r = 0; r < rounds; r++) {
      const ts = performance.now();
      await engine.searchL2(q);
      best = Math.min(best, performance.now() - ts);
    }
    perQuery.push(best);
  }
  perQuery.sort((a, b) => a - b);
  const avg = perQuery.reduce((a, b) => a + b, 0) / perQuery.length;
  return {
    warmMs: warm,
    p50: percentile(perQuery, 50),
    p95: percentile(perQuery, 95),
    avg,
    min: perQuery[0],
    max: perQuery[perQuery.length - 1],
    queries: perQuery.length,
  };
}

function mb(n) {
  return (n / 1024 / 1024).toFixed(1);
}

async function main() {
  console.log(`载入真实索引（CONTENT=${CONTENT}）…`);
  const { manifest, titleIndex, shards: baseShards, baseDf } = loadBase();
  const baseDocs = manifest.search.docs;
  const baseAvg = manifest.search.avgDocLen;
  const baseTerms = baseDocs * baseAvg;
  console.log(
    `基线：docs=${baseDocs} avgLen=${baseAvg.toFixed(0)} ≈${(baseTerms / 10000).toFixed(0)}万字terms 分片=${manifest.search.shards} df词=${baseDf.size}`,
  );

  // 基线引擎
  const mem0 = process.memoryUsage().heapUsed;
  const tBuild0 = performance.now();
  const baseEngine = buildEngine(manifest, titleIndex, baseShards, baseDf, baseDocs, baseAvg);
  const build0 = performance.now() - tBuild0;

  // 规模化引擎（K 份复制）
  const scaledShards = baseShards.map((s) => scaleShard(s, K));
  const scaledDf = new Map();
  for (const [t, c] of baseDf) scaledDf.set(t, c * K);
  const scaledDocs = baseDocs * K;
  const scaledTerms = scaledDocs * baseAvg;
  console.log(
    `规模化(K=${K})：docs=${scaledDocs} ≈${(scaledTerms / 10000).toFixed(0)}万字terms 分片=${manifest.search.shards} df词=${scaledDf.size}`,
  );
  const tBuild1 = performance.now();
  const scaledEngine = buildEngine(manifest, titleIndex, scaledShards, scaledDf, scaledDocs, baseAvg);
  const build1 = performance.now() - tBuild1;
  const mem1 = process.memoryUsage().heapUsed;

  const queries = buildQueries(titleIndex);
  console.log(`查询集：${queries.length} 条（${titleIndex.length} 条标题采样 + 常用词），每查询 ${3} 轮取最快\n`);

  const baseRes = await benchSearch(baseEngine, queries, 3);
  const scaledRes = await benchSearch(scaledEngine, queries, 3);

  const row = (label, r, build) =>
    `${label.padEnd(10)} 构建 ${build.toFixed(1)}ms | 预热 ${r.warmMs.toFixed(1)}ms | ` +
    `p50 ${r.p50.toFixed(2)}ms p95 ${r.p95.toFixed(2)}ms 平均 ${r.avg.toFixed(2)}ms (min ${r.min.toFixed(2)} / max ${r.max.toFixed(2)})`;

  console.log('┌─ 检索延迟（searchL2，单查询最优）');
  console.log('│ ' + row('基线', baseRes, build0));
  console.log('│ ' + row(`K=${K}`, scaledRes, build1));
  const ratio = scaledRes.p95 / Math.max(0.001, baseRes.p95);
  console.log(`└─ p95 放大倍数 ≈ ${ratio.toFixed(2)}×`);
  console.log(`\n堆内存：基线构建后 ${mb(mem0)}MB → 规模化后 ${mb(mem1)}MB（+${mb(mem1 - mem0)}MB）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
