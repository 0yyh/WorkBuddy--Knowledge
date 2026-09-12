/**
 * 离线词典查询层统一出口。
 *
 * 定位：**纯类型 + 查询/序列化辅助**，不内置词典数据。
 * 数据源 = 随内容下发的 `content/dict/dictionary.json`（可经 OTA / 局域网更新）。
 *
 * 用法：
 *   const raw = await fetchJson('/content/dict/dictionary.json');
 *   const { value: dict, errors } = parseDictionary(raw);
 *   if (!errors.length) {
 *     const { entry } = lookupDict(dict, '剩余价值');
 *   }
 */
export * from './types.js';
export * from './query.js';
export * from './serialize.js';
export * from './chardict.js';
