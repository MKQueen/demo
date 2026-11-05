/**
 * ============================================================================
 * 例 3：从零手搓一个 Agent 循环（约 100 行核心代码）
 * ============================================================================
 *
 * 这是本项目最重要的示例：**一个完整、可跑、可读的 Agent**。
 * 它和 src/agent/loop.ts 的原理完全相同，只是砍掉了权限、上下文管理、
 * 会话持久化、UI 渲染这些"生产化"的部分。
 *
 * 跑法（在项目根目录）：
 *
 *   node examples/03-mini-agent.ts --mock
 *   node examples/03-mini-agent.ts --mock "你的任务"
 *   node examples/03-mini-agent.ts "在当前目录创建 agent-demo.txt，写入 Hello，然后读出来确认"
 *
 * 你会看到它：
 *   第 1 轮：模型请求 write_file
 *   第 2 轮：模型看到写入结果，请求 read_file
 *   第 3 轮：模型看到内容，输出最终总结（不再请求工具，循环结束）
 *
 * 读代码时请记住这个公式：
 *   Agent = LLM（大脑） + Tools（手） + Loop（心脏） + Context（记忆）
 */
import fs from "node:fs";
import path from "node:path";
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

// ============================================================================
// 第 1 部分：工具定义（给模型看的说明书）
// ============================================================================
const tools: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "write_file",
      description: "把内容写入文件（覆盖已有文件）。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件路径，相对当前目录" },
          content: { type: "string", description: "要写入的完整内容" },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "读取文件内容。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件路径，相对当前目录" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
];

// ============================================================================
// 第 2 部分：工具的真正的实现（执行它们的是我们，不是模型）
// ============================================================================
function safeResolve(relativePath: string): string {
  const root = process.cwd();
  const target = path.resolve(root, relativePath);
  const rel = path.relative(root, target);
  // 极简的路径安全检查：不允许跑到当前目录外面
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`路径越界：${relativePath}（只能操作当前目录内的文件）`);
  }
  return target;
}

function executeTool(name: string, args: Record<string, unknown>): string {
  if (name === "write_file") {
    const file = safeResolve(String(args.path));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, String(args.content), "utf8");
    return `已写入 ${args.path}（${String(args.content).length} 字符）`;
  }
  if (name === "read_file") {
    const file = safeResolve(String(args.path));
    if (!fs.existsSync(file)) return `文件不存在：${args.path}`;
    return fs.readFileSync(file, "utf8");
  }
  return `未知工具：${name}`;
}

// ============================================================================
// 第 3 部分：模型（真模型 或 离线假模型）
// ============================================================================
const config = resolveConfig(process.cwd(), { mock: process.argv.includes("--mock") });

/**
 * 离线假模型：按步数演一个"写文件 → 读文件 → 总结"的剧本。
 * 它和真模型实现同一个接口，所以下面的循环代码完全不用改。
 */
function createOfflineModel(): LLMProvider {
  let step = 0;
  return {
    id: "offline-demo",
    model: "offline-demo",
    async *stream() {
      step++;
      if (step === 1) {
        yield { type: "text", text: "好，我先创建文件。\n" };
        yield {
          type: "tool_calls",
          toolCalls: [
            {
              id: "call_1",
              type: "function",
              function: {
                name: "write_file",
                arguments: JSON.stringify({
                  path: "agent-demo.txt",
                  content: "你好，我是被一个 100 行的 Agent 写出来的文件。\n",
                }),
              },
            },
          ],
        };
        yield { type: "done", finishReason: "tool_calls" };
        return;
      }
      if (step === 2) {
        yield {
          type: "tool_calls",
          toolCalls: [
            {
              id: "call_2",
              type: "function",
              function: { name: "read_file", arguments: '{"path":"agent-demo.txt"}' },
            },
          ],
        };
        yield { type: "done", finishReason: "tool_calls" };
        return;
      }
      await sleep(30);
      yield {
        type: "text",
        text:
          "✅ 任务完成：\n" +
          "1. 用 write_file 创建了 agent-demo.txt\n" +
          "2. 用 read_file 读回来验证了内容\n" +
          "这就是 Agent 的工作方式：每一轮根据上一轮的工具结果决定下一步。",
      };
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
  provider = createProvider({ baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model });
}

// ============================================================================
// 第 4 部分：Agent 循环（核心！）
// ============================================================================
const userTask =
  process.argv.slice(2).filter((arg) => !arg.startsWith("--")).join(" ") ||
  "在当前目录创建 agent-demo.txt，写入一句话，然后读出来确认内容。";

const history: ChatMessage[] = [
  {
    role: "system",
    content:
      "你是一个编码 Agent。你可以调用 write_file 和 read_file 工具。" +
      "完成任务后不要再调用工具，用中文简短总结你做了什么。",
  },
  { role: "user", content: userTask },
];

const MAX_STEPS = 8; // 安全阀：防止模型无限循环
let finalText = "";

console.log(`provider = ${provider.id}`);
console.log(`任务：${userTask}\n`);

for (let step = 1; step <= MAX_STEPS; step++) {
  console.log(`── 第 ${step} 轮 ─────────────────────────────`);

  // 1) 调模型，流式收集文本 + 工具调用
  let text = "";
  const toolCalls: ToolCall[] = [];

  for await (const event of provider.stream(history, { tools })) {
    if (event.type === "text") {
      text += event.text;
      process.stdout.write(event.text);
    }
    if (event.type === "tool_calls") {
      toolCalls.push(...event.toolCalls);
    }
  }

  // 2) 把模型回复写进历史
  const assistantMessage: ChatMessage = {
    role: "assistant",
    content: text || null,
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  };
  history.push(assistantMessage);

  // 3) 没有工具调用 = 模型认为任务完成 → 退出循环
  if (toolCalls.length === 0) {
    finalText = text;
    break;
  }

  // 4) 执行每个工具，把结果作为 tool 消息写回历史
  for (const call of toolCalls) {
    console.log(`\n  → 调用 ${call.function.name}(${call.function.arguments})`);
    let output: string;
    try {
      const args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      output = executeTool(call.function.name, args);
    } catch (err) {
      // 工具失败不抛出去，而是变成一条模型能看懂的错误消息
      output = `工具执行失败：${err instanceof Error ? err.message : String(err)}`;
    }
    console.log(`  ← ${output.split("\n").join("\n    ")}`);

    history.push({
      role: "tool",
      tool_call_id: call.id,
      name: call.function.name,
      content: output,
    });
  }
  console.log();
}

if (!finalText) {
  console.log(`\n⚠️ 达到最大步数 ${MAX_STEPS}，任务可能没完成。`);
}

console.log("\n=== 循环结束 ===");
console.log(`历史里共有 ${history.length} 条消息（user/assistant/tool）。`);
console.log("这，就是一个 Agent。");
