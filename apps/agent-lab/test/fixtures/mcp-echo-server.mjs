#!/usr/bin/env node
/**
 * ============================================================================
 * 测试用 MCP server（stdio + 换行分隔的 JSON-RPC 2.0）
 * ============================================================================
 *
 * 它不是产品代码，是 `test/mcp.test.ts` 的“假 MCP server”，用来把客户端
 * 该测的行为都测一遍：
 *
 *   - initialize 握手（回显客户端给的协议版本）
 *   - notifications/initialized（通知，不需要响应）
 *   - tools/list 的分页（故意两页返回，逼客户端处理 nextCursor）
 *   - tools/call：
 *       echo  —— 正常结果，并且返回**两个** text 内容块，测“拼接”
 *       add   —— 正常结果，测参数传递
 *       fail  —— result.isError=true（工具失败，不是协议错误），测错误文本回传
 *       sleep —— 睡 N 毫秒，测客户端超时和 close 清理
 *   - 未知方法 / 未知工具 → JSON-RPC error
 *   - 服务器主动发通知？没有，但客户端已处理（见 client.ts）
 *
 * 两条铁律（MCP stdio 传输的规矩）：
 *   1. **stdout 只能写 JSON-RPC 消息**，一行一条；
 *   2. 日志一律写 stderr，否则会污染协议流（客户端会把它当坏 JSON 丢弃并告警）。
 *
 * 调试本 server 时可以用：MCP_ECHO_DEBUG=1 node test/fixtures/mcp-echo-server.mjs
 */
import process from "node:process";
import readline from "node:readline";

const SERVER_INFO = { name: "mcp-echo-server", version: "1.0.0" };
const PROTOCOL_VERSION = "2024-11-05";
/** 每页工具数：故意小于工具总数，让 tools/list 必须翻页。 */
const PAGE_SIZE = 2;

const DEBUG = process.env.MCP_ECHO_DEBUG === "1";

/** 工具清单。annotations.readOnlyHint 决定客户端把它标成 read 还是 exec。 */
const TOOLS = [
  {
    name: "echo",
    description: "把输入原样回显（用来检查连通性和内容块拼接）",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "要回显的文本" },
      },
      required: ["text"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "add",
    description: "两个整数相加",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "integer", description: "第一个加数" },
        b: { type: "integer", description: "第二个加数" },
      },
      required: ["a", "b"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "fail",
    description: "总是返回 isError=true（用来测试工具失败怎么喂回模型）",
    inputSchema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "失败原因" },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
  },
  {
    name: "sleep",
    description: "等待 ms 毫秒后返回（用来测试请求超时与关闭清理）",
    inputSchema: {
      type: "object",
      properties: {
        ms: { type: "integer", description: "睡眠毫秒数" },
      },
      required: ["ms"],
    },
    annotations: { readOnlyHint: false },
  },
];

function debug(...args) {
  if (DEBUG) process.stderr.write(`[mcp-echo-server] ${args.join(" ")}\n`);
}

/** 写一条 JSON-RPC 消息到 stdout（唯一合法的 stdout 用法）。 */
function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

/** tools/list 的分页：cursor 形如 "offset:2"，没 cursor 就是第一页。 */
function listTools(params) {
  const cursor = params && typeof params.cursor === "string" ? params.cursor : "";
  let start = 0;
  if (cursor.startsWith("offset:")) {
    const parsed = Number(cursor.slice("offset:".length));
    start = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  }
  const page = TOOLS.slice(start, start + PAGE_SIZE);
  const nextStart = start + PAGE_SIZE;
  const result = { tools: page };
  if (nextStart < TOOLS.length) result.nextCursor = `offset:${nextStart}`;
  return result;
}

/** tools/call：所有工具的实现都在这。 */
async function callTool(params) {
  const name = params && params.name;
  const args = (params && params.arguments) || {};

  switch (name) {
    case "echo": {
      const text = typeof args.text === "string" ? args.text : "";
      // 故意拆成两个 text 块：客户端必须把它们拼起来，模型才能看到完整内容。
      return {
        content: [
          { type: "text", text: `echo: ${text}` },
          { type: "text", text: `（长度 ${[...text].length} 个字符）` },
        ],
      };
    }

    case "add": {
      if (typeof args.a !== "number" || typeof args.b !== "number") {
        return {
          isError: true,
          content: [{ type: "text", text: "add 需要两个数字参数：a 和 b" }],
        };
      }
      return { content: [{ type: "text", text: `${args.a} + ${args.b} = ${args.a + args.b}` }] };
    }

    case "fail": {
      const reason = typeof args.reason === "string" ? args.reason : "这是测试用的失败";
      return { isError: true, content: [{ type: "text", text: `工具执行失败：${reason}` }] };
    }

    case "sleep": {
      const ms = typeof args.ms === "number" ? args.ms : 0;
      await new Promise((resolve) => setTimeout(resolve, ms));
      return { content: [{ type: "text", text: `slept ${ms}ms` }] };
    }

    default:
      return null; // 由调用方转成 JSON-RPC error
  }
}

async function handleMessage(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) return;

  const { id, method, params } = message;
  const isRequest = id !== undefined && id !== null;

  // 通知（没有 id）不需要响应。
  if (!isRequest) {
    debug("notification:", method);
    return;
  }

  try {
    switch (method) {
      case "initialize": {
        const requested =
          params && typeof params.protocolVersion === "string"
            ? params.protocolVersion
            : PROTOCOL_VERSION;
        debug("initialize, client =", JSON.stringify(params && params.clientInfo));
        sendResult(id, {
          protocolVersion: requested,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
        });
        return;
      }

      case "ping":
        sendResult(id, {});
        return;

      case "tools/list":
        sendResult(id, listTools(params));
        return;

      case "tools/call": {
        const result = await callTool(params);
        if (result === null) {
          sendError(id, -32602, `未知工具：${params && params.name}`);
          return;
        }
        sendResult(id, result);
        return;
      }

      default:
        sendError(id, -32601, `方法不存在：${String(method)}`);
    }
  } catch (err) {
    sendError(id, -32603, `内部错误：${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// 主循环：stdin 每来一行就处理一条消息
// ---------------------------------------------------------------------------
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", (line) => {
  const text = line.trim();
  if (!text) return;
  let message;
  try {
    message = JSON.parse(text);
  } catch {
    process.stderr.write(`[mcp-echo-server] 收到非法 JSON，忽略：${text.slice(0, 120)}\n`);
    return;
  }
  void handleMessage(message);
});

rl.on("close", () => {
  debug("stdin 已关闭，退出");
  process.exit(0);
});

process.on("SIGTERM", () => {
  debug("收到 SIGTERM，退出");
  process.exit(0);
});

debug("started, pid =", process.pid);
