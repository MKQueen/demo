/**
 * ============================================================================
 * 例 2：只做一次"工具调用"，把协议看个透
 * ============================================================================
 *
 * 例 1 里模型只会说话。现在给它一个"手"：get_time 工具。
 *
 * 跑法（在项目根目录）：
 *
 *   node examples/02-one-tool.ts --mock   # 用一个 20 行的假模型，不联网
 *   node examples/02-one-tool.ts          # 用真模型（需要 .env 里的 key）
 *
 * 这个例子**故意不写循环**，而是手动走两轮请求，让你亲眼看到：
 *
 *   第 1 次请求：程序把 tools 定义一起发过去
 *   模型回复：  "我要调用 get_time 工具"（一段 JSON，不是真的执行）
 *   程序：      自己解析 JSON、自己执行函数
 *   第 2 次请求：把工具结果作为 role="tool" 的消息塞回历史
 *   模型回复：  看到结果后，用自然语言回答用户
 *
 * 看懂这个"两轮往返"，你就看懂了所有 Agent 工具调用的本质。
 * 例 3 会把这两轮往返放进 while 循环，那就是 Agent 了。
 */
import process from "node:process";
import { resolveConfig } from "../src/config.ts";
import { createProvider } from "../src/llm/client.ts";
import type {
  ChatMessage,
  LLMProvider,
  ToolCall,
  ToolDefinition,
} from "../src/llm/types.ts";
import { sleep } from "../src/util.ts";
import { contentToText } from "../src/llm/content.ts";

// ---------------------------------------------------------------------------
// 1. 定义工具：给模型看的说明书（JSON Schema）
// ---------------------------------------------------------------------------
const tools: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_time",
      description: "获取指定时区的当前日期和时间。",
      parameters: {
        type: "object",
        properties: {
          timezone: {
            type: "string",
            description: "IANA 时区名，例如 Asia/Shanghai、America/New_York。默认 Asia/Shanghai。",
          },
        },
        additionalProperties: false,
      },
    },
  },
];

// ---------------------------------------------------------------------------
// 2. 工具的**真正实现**（模型不会执行它，执行它的是我们）
// ---------------------------------------------------------------------------
function executeGetTime(args: { timezone?: string }): string {
  const timezone = args.timezone ?? "Asia/Shanghai";
  const now = new Date();
  // toLocaleString 遇到非法时区会抛错，这个错误也要能返回给模型
  return now.toLocaleString("zh-CN", {
    timeZone: timezone,
    dateStyle: "full",
    timeStyle: "medium",
  });
}

/** 模拟用户问问题时的初始历史。 */
const messages: ChatMessage[] = [
  { role: "system", content: "你是一个中文助手。需要当前时间时，调用 get_time 工具，不要自己猜。" },
  { role: "user", content: "现在上海几点？" },
];

// ---------------------------------------------------------------------------
// 3. 选择模型：真模型 或 离线假模型
// ---------------------------------------------------------------------------
const config = resolveConfig(process.cwd(), { mock: process.argv.includes("--mock") });

/**
 * 离线假模型：按剧本演"第 1 轮请求工具、第 2 轮总结"。
 *
 * 注意它实现的是同一个 LLMProvider 接口 —— 这就是"模型可替换"：
 * 对下面的 Agent 代码来说，假模型和真模型没有区别。
 */
function createOfflineModel(): LLMProvider {
  let turn = 0;
  return {
    id: "offline-demo",
    model: "offline-demo",
    async *stream(history) {
      turn++;
      if (turn === 1) {
        // 第 1 轮：请求调用 get_time
        const toolCall: ToolCall = {
          id: "call_time_1",
          type: "function",
          function: { name: "get_time", arguments: '{"timezone":"Asia/Shanghai"}' },
        };
        yield { type: "tool_calls", toolCalls: [toolCall] };
        yield { type: "done", finishReason: "tool_calls" };
        return;
      }
      // 第 2 轮：看到 tool 消息后，用它来回答
      const lastTool = [...history].reverse().find((message) => message.role === "tool");
      yield { type: "text", text: "我调用工具查了一下：" };
      await sleep(20);
      yield { type: "text", text: contentToText(lastTool?.content) || "（没拿到工具结果）" };
      yield { type: "done", finishReason: "stop" };
    },
  };
}

let provider: LLMProvider;
if (config.mock) {
  provider = createOfflineModel();
} else {
  if (!config.apiKey) {
    console.error("没有 API key。加 --mock 离线跑，或配置 .env。");
    process.exit(1);
  }
  provider = createProvider({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
  });
}

console.log(`provider = ${provider.id}\n`);

// ---------------------------------------------------------------------------
// 4. 第 1 次请求：带上 tools 定义
// ---------------------------------------------------------------------------
console.log("=== 第 1 次请求（带工具定义） ===");
console.log("请求里的 tools:", JSON.stringify(tools, null, 2));

let assistantText = "";
const toolCalls: ToolCall[] = [];

for await (const event of provider.stream(messages, { tools })) {
  if (event.type === "text") {
    assistantText += event.text;
    process.stdout.write(event.text);
  }
  if (event.type === "tool_calls") {
    toolCalls.push(...event.toolCalls);
  }
}

// 关键一步：把模型的回复原样写进历史（包括 content 可能为空、tool_calls）
const assistantMessage: ChatMessage = {
  role: "assistant",
  content: assistantText || null,
  ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
};
messages.push(assistantMessage);

console.log("\n\n模型请求调用工具（注意：这只是 JSON，模型什么都没执行）：");
console.log(JSON.stringify(toolCalls, null, 2));

if (toolCalls.length === 0) {
  console.log("\n模型没有调用工具，可能它直接回答了。");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 5. 程序执行工具，并把结果作为 role="tool" 的消息写回历史
// ---------------------------------------------------------------------------
for (const call of toolCalls) {
  // 真实项目在这里会做：JSON 解析 → schema 校验 → 权限检查 → 执行
  // 例子里简化成"直接解析 + 执行"
  const args = JSON.parse(call.function.arguments || "{}") as { timezone?: string };
  console.log(`\n>>> 程序开始执行 ${call.function.name}(${JSON.stringify(args)})`);

  let output: string;
  try {
    output = executeGetTime(args);
    console.log(`>>> 执行结果：${output}`);
  } catch (err) {
    output = `工具执行失败：${err instanceof Error ? err.message : String(err)}`;
    console.log(`>>> ${output}`);
  }

  messages.push({
    role: "tool",
    tool_call_id: call.id, // 必须带！模型靠它对应"这是哪次调用的结果"
    name: call.function.name,
    content: output,
  });
}

// ---------------------------------------------------------------------------
// 6. 第 2 次请求：带着工具结果再问模型
// ---------------------------------------------------------------------------
console.log("\n=== 第 2 次请求（带上工具结果） ===");
console.log("历史里的 tool 消息:", JSON.stringify(messages.at(-1), null, 2));
console.log("\n--- 模型最终回答 ---\n");

for await (const event of provider.stream(messages)) {
  if (event.type === "text") process.stdout.write(event.text);
}

console.log("\n\n--- 关键结论 ---");
console.log("1. 模型只输出了一段 '我要调用 get_time' 的 JSON，它没有执行任何代码。");
console.log("2. 真正执行工具的是程序，结果通过 role='tool' + tool_call_id 回填。");
console.log("3. 把这两次往返放进 while 循环，就是例 3 的 Agent。");
