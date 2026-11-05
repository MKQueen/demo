/**
 * 模型工厂：根据配置创建 provider。
 *
 * 为什么单独抽一个文件？
 * CLI（src/main.ts）和 Web 服务器（src/web/server.ts）都要创建模型，
 * 逻辑必须完全一致：mock 优先、没 key 给出可操作的报错、真实模型走 OpenAI 兼容协议。
 * 抽出来之后，两边都调用同一个 createModel，不重复、也不会行为漂移。
 */
import { createProvider } from "./client.ts";
import { createMockProvider } from "./mock.ts";
import type { AppConfig } from "../config.ts";
import type { LLMProvider } from "./types.ts";

export function createModel(config: AppConfig, requestedModel?: string): LLMProvider {
  // mock 模式也尊重传入的模型名：纯粹是为了让 UI / 日志诚实显示用户请求的模型
  if (config.mock) return createMockProvider({ model: requestedModel ?? "mock-model" });

  if (!config.apiKey) {
    throw new Error(
      "没有找到 API key。两种办法：\n" +
        "  1) 复制 .env.example 为 .env，填入 DEEPSEEK_API_KEY=sk-xxx\n" +
        "  2) 先用 --mock 离线体验整套流程（不需要 key）",
    );
  }

  return createProvider({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    temperature: config.temperature,
    // CLI 和 Web 都从这里过，空闲超时必须一起传下去，别只在一个入口生效
    idleTimeoutMs: config.llmIdleTimeoutMs,
  });
}
