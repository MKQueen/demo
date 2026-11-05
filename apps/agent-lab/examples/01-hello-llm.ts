/**
 * ============================================================================
 * 例 1：最小可跑 —— 只调用一次大模型
 * ============================================================================
 *
 * 这是整个 Agent 的地基：一次 HTTP 请求。
 * 在终端里跑：
 *
 *   node examples/01-hello-llm.ts --mock     # 不联网（用假模型）
 *   node examples/01-hello-llm.ts            # 需要项目根目录 .env 里有 key
 *
 * 你会看到：
 *   1. 我们发出去的请求长什么样（messages 数组）
 *   2. 模型怎么一个字一个字地流式返回
 *   3. 回答占了多少 token
 *
 * 只看这一个文件，你就能明白"和模型聊天"到底发生了什么。
 */
import process from "node:process";
import { resolveConfig } from "../src/config.ts";
import { createProvider } from "../src/llm/client.ts";
import { createMockProvider } from "../src/llm/mock.ts";
import type { ChatMessage, Usage } from "../src/llm/types.ts";
import { estimateTokens } from "../src/util.ts";

// ---------------------------------------------------------------------------
// 1. 准备消息。注意这是一个**数组**，模型的"对话"就是不断往里加消息。
// ---------------------------------------------------------------------------
const messages: ChatMessage[] = [
  {
    // system：给模型定人设 / 规则。它是"导演"，不是"演员"，不参与对话。
    role: "system",
    content: "你是一个简洁的中文助手，回答不超过 60 个字。",
  },
  {
    // user：用户说的话。
    role: "user",
    content: "用一句话解释什么是 AI Agent。",
  },
];

// ---------------------------------------------------------------------------
// 2. 读配置，创建 provider（模型客户端）
// ---------------------------------------------------------------------------
const config = resolveConfig(process.cwd(), { mock: process.argv.includes("--mock") });

if (!config.mock && !config.apiKey) {
  console.error("没有找到 API key。");
  console.error("  1) 复制 .env.example 为 .env 并填入 DEEPSEEK_API_KEY");
  console.error("  2) 或者加 --mock 参数离线体验");
  process.exit(1);
}

const provider = config.mock
  ? createMockProvider({ delayMs: 15 })
  : createProvider({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      temperature: 0.3,
    });

console.log(`provider = ${provider.id}，model = ${provider.model}`);
console.log("\n发给模型的消息：");
console.log(JSON.stringify(messages, null, 2));
console.log("\n--- 模型开始流式输出 ---\n");

// ---------------------------------------------------------------------------
// 3. 发起流式请求，边收边打印
// ---------------------------------------------------------------------------
let answer = "";
const usage: Usage = {};

// for await：流式事件像水流一样一个个到达
for await (const event of provider.stream(messages, { temperature: 0.3 })) {
  switch (event.type) {
    case "text":
      answer += event.text;
      process.stdout.write(event.text); // 逐字打印，这就是"打字机效果"
      break;

    case "thinking":
      // 推理模型（如 deepseek-reasoner）会先吐思考过程，这里跳过
      break;

    case "usage":
      usage.prompt_tokens = event.usage.prompt_tokens;
      usage.completion_tokens = event.usage.completion_tokens;
      usage.total_tokens = event.usage.total_tokens;
      break;

    case "tool_calls":
      // 例 1 没给模型任何工具，所以不会有工具调用
      console.log("\n[意外] 模型请求了工具：", JSON.stringify(event.toolCalls));
      break;

    case "done":
      // 流结束
      break;
  }
}

// ---------------------------------------------------------------------------
// 4. 打印统计
// ---------------------------------------------------------------------------
console.log("\n\n--- 完成 ---");
console.log(`回答长度：${answer.length} 字符（启发式估算 ${estimateTokens(answer)} tokens）`);
console.log(
  `接口返回的用量：prompt ${usage.prompt_tokens ?? "?"} / completion ${usage.completion_tokens ?? "?"} / total ${usage.total_tokens ?? "?"}`,
);
console.log(
  "\n注意一个反直觉的点：所谓的“对话”没有状态，",
);
console.log("每一次请求，程序都会把【完整历史】重新发给模型。模型本身不记得任何东西。");
