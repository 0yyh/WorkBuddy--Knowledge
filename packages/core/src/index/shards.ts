/**
 * 检索分区选择（02 §18.2 / §16 决策 #1）。
 * M = 2 的幂；16（≤300 万）→ 64（≥300 万）→ 256（≥1000 万）。
 * 分片 = `fnv1a(key) & (M-1)`，分片是最小替换/懒加载单位。
 */
import { SHARD_COUNT } from '../constants.js';
import { shardOf } from '../util/fnv1a.js';

export function chooseShardCount(totalWords: number): number {
  if (totalWords >= 10_000_000) return 256;
  if (totalWords >= 3_000_000) return 64;
  return SHARD_COUNT;
}

export function assignShard(key: string, m: number): number {
  return shardOf(key, m);
}
