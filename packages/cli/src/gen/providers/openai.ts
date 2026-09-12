/**
 * OpenAI 兼容 Provider（T03）。
 *
 * 通过全局 `fetch` 调用 `${PKS_LLM_BASE_URL}/v1/chat/completions`，
 * 头 `Authorization: Bearer ${PKS_LLM_API_KEY}`，body 含 `model=${PKS_LLM_MODEL}`。
 * 兼容任意 OpenAI 协议端点（Ollama / OpenRouter / 本地 vLLM 等）。
 * 环境变量缺失时给出清晰报错，而不是抛出晦涩的 undefined 错误。
 */
import type { GenRequest, GenResponse, LLMProvider } from '../provider.js';

export interface OpenAIProviderOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

interface ChatCompletionChoice {
  message?: { content?: string };
}
interface ChatCompletion {
  choices?: ChatCompletionChoice[];
}

export class OpenAIProvider implements LLMProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(opts: OpenAIProviderOptions = {}) {
    const baseUrl = opts.baseUrl ?? process.env.PKS_LLM_BASE_URL;
    const apiKey = opts.apiKey ?? process.env.PKS_LLM_API_KEY;
    const model = opts.model ?? process.env.PKS_LLM_MODEL;
    if (!baseUrl || !baseUrl.trim()) {
      throw new Error('OpenAIProvider: 缺少 PKS_LLM_BASE_URL（或构造参数 baseUrl）');
    }
    if (!apiKey || !apiKey.trim()) {
      throw new Error('OpenAIProvider: 缺少 PKS_LLM_API_KEY（或构造参数 apiKey）');
    }
    if (!model || !model.trim()) {
      throw new Error('OpenAIProvider: 缺少 PKS_LLM_MODEL（或构造参数 model）');
    }
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(req: GenRequest): Promise<GenResponse> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: req.system },
        { role: 'user', content: req.user },
      ],
    };
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error(`OpenAIProvider: 请求 ${url} 失败：${String(e)}`);
    }
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      throw new Error(`OpenAIProvider: HTTP ${resp.status} ${resp.statusText} ${detail}`);
    }
    const data = (await resp.json()) as ChatCompletion;
    const text = data?.choices?.[0]?.message?.content ?? '';
    if (typeof text !== 'string' || text.length === 0) {
      throw new Error('OpenAIProvider: 响应缺少 choices[0].message.content');
    }
    return { text };
  }
}
