#!/usr/bin/env node
/**
 * ============================================================================
 * 最小 MCP server（stdio + JSON-RPC 2.0），只有一个工具：hello
 * ============================================================================
 *
 * 运行方式（不需要任何依赖）：
 *   node examples/04-mcp-server.mjs
 *
 * 它不会自己打印东西——它在等 stdin 上的 JSON-RPC 请求。
 * 想看效果请运行配套客户端：node examples/05-mcp-client.mjs
 *
 * 两条铁律（stdio 传输）：
 *   1. **stdout 只能写 JSON-RPC**，一行一条 JSON；
 *   2. 日志一律写 stderr，否则会污染协议流。
 *
 * 一个 MCP server 最少要处理三件事：
 *   1. initialize           —— 握手，告诉客户端"我支持什么能力"；
 *   2. tools/list           —— 我有哪些工具（name/description/inputSchema）；
 *   3. tools/call           —— 客户端让我执行某个工具，我返回 content[]。
 * 其他都是可选的（资源、提示词、通知）。
 */
import process from "node:process";
import readline from "node:readline";

const SERVER_INFO = { name: "hello-mcp", version: "0.1.0" };
const PROTOCOL_VERSION = "2024-11-05";

/** 工具定义：MCP 的 inputSchema 就是 JSON Schema，和 OpenAI function calling 一样。 */
const TOOL = {
  name: "hello",
  description: "跟指定的人打招呼，返回一句中文问候。",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "要打招呼的人名，默认是“世界”" },
    },
    required: [],
    additionalProperties: false,
  },
  // 只读声明：客户端（如 mini-opencode）会据此把工具标成 read，免审批。
  annotations: { readOnlyHint: true },
};

// ---------------------------------------------------------------------------
// 协议层：读一行 JSON-RPC → 处理 → 写一行 JSON-RPC
// ---------------------------------------------------------------------------
const rl = readline.createInterface({ input: process.stdin });

/** 发一条成功响应。注意：通知（没有 id）不需要响应。 */
function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

/** 发一条 JSON-RPC 错误（协议错误；工具执行失败用 result.isError，不是这个）。 */
function replyError(id, code, message) {
  process.stdout.write(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n",
  );
}

/** 处理一条请求。 */
function handle(request) {
  // 通知不需要回复，直接处理即可（这里只有 initialized 需要忽略）。
  const isNotification = request.id === undefined;

  switch (request.method) {
    case "initialize":
      reply(request.id, {
        // 回显客户端发来的版本；我们的 server 其实只认 2024-11-05，但简单起见就回显。
        protocolVersion: request.params?.protocolVersion ?? PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      return;

    case "notifications/initialized":
      // 客户端说"我准备好了"，不需要响应。
      return;

    case "tools/list":
      // 只有一个工具，不需要分页（分页才需要 nextCursor）。
      reply(request.id, { tools: [TOOL] });
      return;

    case "tools/call": {
      if (request.params?.name !== "hello") {
        replyError(request.id, -32602, `没有名为 ${request.params?.name} 的工具`);
        return;
      }
      const name = String(request.params?.arguments?.name ?? "世界");
      // content 是数组，可以返回多段文本/图片；MCP 客户端会把 text 拼起来。
      reply(request.id, {
        content: [
          {
            type: "text",
            text: `你好，${name}！我是你写的最简单的 MCP 工具 👋\n` +
              `这次调用走的是：你的 Agent → stdio JSON-RPC → 本进程 → 原路返回。`,
          },
        ],
        isError: false,
      });
      return;
    }

    case "ping":
      reply(request.id, {});
      return;

    default:
      if (!isNotification) {
        replyError(request.id, -32601, `未知方法：${request.method}`);
      }
  }
}

// 用 line 事件逐行读；stderr 写启动日志，绝不写到 stdout。
rl.on("line", (line) => {
  if (!line.trim()) return;
  let request;
  try {
    request = JSON.parse(line);
  } catch (err) {
    // 坏 JSON 不崩：stdout 是协议流，不能回一条非协议消息。
    process.stderr.write(`[hello-mcp] 收到无法解析的行：${err.message}\n`);
    return;
  }
  try {
    handle(request);
  } catch (err) {
    if (request?.id !== undefined) {
      replyError(request.id, -32603, `server 内部错误：${err?.message ?? err}`);
    }
  }
});

process.stderr.write(`[hello-mcp] 已启动，等待 MCP 客户端连接（stdio）\n`);
