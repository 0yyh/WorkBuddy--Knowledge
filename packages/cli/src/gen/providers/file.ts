/**
 * FileProvider（T03 / Pilot）。零 API：从 answers 目录读取预写的生成结果。
 *
 * answers 文件命名 `{slug}.json`，结构 `{ "text": "<可直接被 parse-output 解析的目录文件集文本>" }`。
 * slug 由 user prompt 末尾的标记 `<!--pks-gen-slug:SLUG-->` 解析得到，因此同一份
 * FileProvider 实例可服务多个 slug，且不影响真实 LLM（OpenAI）的 prompt 结构。
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GenRequest, GenResponse, LLMProvider } from '../provider.js';

export interface FileProviderOptions {
  answersDir: string;
}

const SLUG_MARKER = /<!--\s*pks-gen-slug:\s*([^\s>]+)\s*-->/;

export class FileProvider implements LLMProvider {
  private readonly answersDir: string;

  constructor(opts: FileProviderOptions) {
    this.answersDir = resolve(opts.answersDir);
  }

  async generate(req: GenRequest): Promise<GenResponse> {
    const m = req.user.match(SLUG_MARKER);
    const slug = m ? m[1] : '';
    if (!slug) {
      throw new Error('FileProvider: 无法从 user prompt 解析 slug（需包含 <!-- pks-gen-slug: <slug> -->）');
    }
    const file = resolve(this.answersDir, `${slug}.json`);
    if (!existsSync(file)) {
      throw new Error(`FileProvider: 找不到 answers 文件：${file}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      throw new Error(`FileProvider: ${file} 不是合法 JSON：${String(e)}`);
    }
    const text = (parsed as { text?: unknown })?.text;
    if (typeof text !== 'string') {
      throw new Error(`FileProvider: ${file} 缺少字符串 text 字段`);
    }
    return { text };
  }
}
