/**
 * 生成管线 —— Provider 抽象（T03）。
 *
 * 设计边界：`LLMProvider.generate(req)` 仅做 text→text，不碰文件系统、不碰 lint、
 * 不碰 PKS 目录布局。这样 OpenAIProvider / FileProvider（pilot）/ 未来的流式 Provider
 * 可以完全互换，且便于在 CI 与本地复用同一套 runner。
 */

/** 一次生成请求：系统提示 + 用户提示 */
export interface GenRequest {
  system: string;
  user: string;
}

/** 一次生成响应：模型输出文本 */
export interface GenResponse {
  text: string;
}

/** 文本生成提供者（LLM 或 Pilot 用的文件回放） */
export interface LLMProvider {
  generate(req: GenRequest): Promise<GenResponse>;
}
