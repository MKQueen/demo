/**
 * 单元测试：SSE 解析、参数校验、上下文裁剪/压缩、权限系统。
 *
 * 跑法：npm test
 * Node 24 自带 test runner，不需要 vitest/jest。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import http from "node:http";

import { SseParser, createProvider } from "../src/llm/client.ts";
import { validateArgs } from "../src/tools/registry.ts";
import { fitContext, estimateMessagesTokens, compactHistory } from "../src/agent/context.ts";
import { Permissions } from "../src/permission.ts";
import { explainLLMError } from "../src/llm/errors.ts";
import { resolveConfig } from "../src/config.ts";
import { contentToText } from "../src/llm/content.ts";
import { globToRegExp, resolveInside } from "../src/tools/files.ts";
import type { ChatMessage, LLMProvider } from "../src/llm/types.ts";
import type { Tool } from "../src/tools/types.ts";

// ---------------------------------------------------------------------------
// SSE 解析
// ---------------------------------------------------------------------------
test("SseParser: 一个网络分片里包含多个完整事件", () => {
  const parser = new SseParser();
  const events = parser.push('data: {"a":1}\n\ndata: {"b":2}\n\n');
  assert.deepEqual(events, ['{"a":1}', '{"b":2}']);
});

test("SseParser: JSON 被网络分片切碎也能拼回来", () => {
  const parser = new SseParser();
  const first = parser.push('data: {"content":"你');
  assert.equal(first.length, 0); // 还没有完整的空行分隔，先憋着
  const second = parser.push('好"}\n\ndata: [DONE]\n\n');
  assert.deepEqual(second, ['{"content":"你好"}', "[DONE]"]);
});

test("SseParser: 支持 \\r\\n 和结尾残留", () => {
  const parser = new SseParser();
  assert.deepEqual(parser.push('data: {"x":1}\r\n\r\n'), ['{"x":1}']);
  assert.deepEqual(parser.push("data: [DONE]"), []); // 没有空行结尾
  assert.deepEqual(parser.flush(), ["[DONE]"]);
});

// ---------------------------------------------------------------------------
// 工具参数校验
// ---------------------------------------------------------------------------
const readSchema = {
  type: "object" as const,
  properties: {
    path: { type: "string" as const },
    limit: { type: "integer" as const, minimum: 1 },
  },
  required: ["path"],
  additionalProperties: false,
};

test("validateArgs: 合法参数通过", () => {
  const result = validateArgs(readSchema, { path: "a.ts", limit: 10 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("validateArgs: 缺必填 / 类型错 / 未知参数都能报出来", () => {
  const missing = validateArgs(readSchema, {});
  assert.equal(missing.ok, false);
  assert.match(missing.errors.join("\n"), /缺少必填参数 "path"/);

  const wrongType = validateArgs(readSchema, { path: "a.ts", limit: "10" });
  assert.equal(wrongType.ok, false);
  assert.match(wrongType.errors.join("\n"), /limit 应该是整数/);

  const unknown = validateArgs(readSchema, { path: "a.ts", file_path: "x" });
  assert.equal(unknown.ok, false);
  assert.match(unknown.errors.join("\n"), /出现未知参数 "file_path"/);
});

test("validateArgs: 参数不是对象时直接拒绝", () => {
  const result = validateArgs(readSchema, "src/a.ts");
  assert.equal(result.ok, false);
  assert.match(result.errors[0]!, /必须是一个 JSON 对象/);
});

// ---------------------------------------------------------------------------
// 上下文管理
// ---------------------------------------------------------------------------
function makeTurn(index: number, toolOutputSize = 20): ChatMessage[] {
  return [
    { role: "user", content: `第 ${index} 个问题` },
    {
      role: "assistant",
      content: null,
      tool_calls: [
        { id: `call_${index}`, type: "function", function: { name: "read", arguments: '{"path":"a.ts"}' } },
      ],
    },
    { role: "tool", tool_call_id: `call_${index}`, name: "read", content: "x".repeat(toolOutputSize) },
  ];
}

test("fitContext: 超长工具输出会被截断", () => {
  const messages = makeTurn(1, 10_000);
  const fitted = fitContext(messages, 100_000);
  assert.equal(fitted.truncatedToolOutputs, 1);
  assert.ok(contentToText(fitted.messages[2]!.content).length < 10_000);
  assert.match(contentToText(fitted.messages[2]!.content), /已截断/);
});

test("fitContext: 预算不够时删除最老的整轮，保留最后一条用户消息", () => {
  const messages = [
    ...makeTurn(1),
    ...makeTurn(2),
    ...makeTurn(3),
  ];
  const fitted = fitContext(messages, 80);

  const roles = fitted.messages.map((m) => m.role);
  // 最后一条 user 消息必须保留（否则模型不知道当前要回答什么）
  const lastUser = fitted.messages.findLast((m) => m.role === "user");
  assert.ok(lastUser);
  assert.equal(contentToText(lastUser.content), "第 3 个问题");
  assert.ok(fitted.removed > 0);
  assert.ok(fitted.messages.length < messages.length);
  // 每一轮都是完整的 user → assistant → tool，没有被拆散
  assert.deepEqual(roles, ["user", "assistant", "tool", "user", "assistant", "tool"]);
  // tool 消息必须能对上前面 assistant 的 tool_call id
  const assistantCallIds = fitted.messages
    .filter((m) => m.role === "assistant")
    .flatMap((m) => m.tool_calls?.map((call) => call.id) ?? []);
  const toolCallIds = fitted.messages
    .filter((m) => m.role === "tool")
    .map((m) => m.tool_call_id!);
  assert.deepEqual(toolCallIds, assistantCallIds);
});

test("fitContext: 不修改传入的原数组", () => {
  const messages = [...makeTurn(1, 10_000), ...makeTurn(2)];
  const before = JSON.stringify(messages);
  fitContext(messages, 100);
  assert.equal(JSON.stringify(messages), before);
});

test("compactHistory: 用摘要替换旧历史，保留最近的消息", async () => {
  const fakeProvider: LLMProvider = {
    id: "fake",
    model: "fake",
    async *stream() {
      yield { type: "text", text: "用户想做 A，已完成 B，还剩 C。" };
      yield { type: "done" };
    },
  };

  const messages: ChatMessage[] = [];
  for (let i = 1; i <= 6; i++) messages.push(...makeTurn(i));

  const result = await compactHistory({ messages, provider: fakeProvider, keepRecent: 4 });
  assert.equal(result.messages[0]!.role, "assistant");
  assert.match(contentToText(result.messages[0]!.content), /早前对话摘要/);
  // 切点会回退到“轮的边界”，所以最近消息会比 keepRecent 略多（保证配对完整）
  assert.equal(result.messages.length, 7); // 1 条摘要 + 最近 2 轮完整对话
  assert.equal(result.messages[1]!.role, "user");
  assert.equal(result.messages[1]!.content, "第 5 个问题");
  assert.ok(result.after < result.before);
});

test("compactHistory: 绝不把 assistant.tool_calls 和 tool 结果拆散", async () => {
  // 18 条 = 6 轮 × 3 条，keepRecent=4 时旧实现正好切在 assistant/tool 中间，
  // 产生孤儿 tool 消息，真实接口会 400。这是验收发现的 bug，必须有测试钉住。
  const fakeProvider: LLMProvider = {
    id: "fake",
    model: "fake",
    async *stream() {
      yield { type: "text", text: "摘要" };
      yield { type: "done" };
    },
  };
  const messages: ChatMessage[] = [];
  for (let i = 1; i <= 6; i++) messages.push(...makeTurn(i));

  const result = await compactHistory({ messages, provider: fakeProvider, keepRecent: 4 });
  const knownCallIds = new Set<string>();
  for (const message of result.messages) {
    if (message.role === "assistant") {
      for (const call of message.tool_calls ?? []) knownCallIds.add(call.id);
    }
    if (message.role === "tool") {
      assert.ok(message.tool_call_id, "tool 消息必须带 tool_call_id");
      assert.ok(
        knownCallIds.has(message.tool_call_id),
        `tool(${message.tool_call_id}) 找不到对应的 assistant.tool_calls`,
      );
    }
  }
});

test("estimateMessagesTokens: 消息越多 token 越多", () => {
  const one = estimateMessagesTokens(makeTurn(1));
  const two = estimateMessagesTokens([...makeTurn(1), ...makeTurn(2)]);
  assert.ok(two > one);
});

// ---------------------------------------------------------------------------
// 权限系统
// ---------------------------------------------------------------------------
function fakeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    name: "write",
    description: "test",
    parameters: { type: "object", properties: {} },
    category: "write",
    async execute() {
      return { title: "write", output: "ok" };
    },
    ...overrides,
  };
}

test("权限: 只读工具默认放行", async () => {
  const permissions = new Permissions({ interactive: false });
  const result = await permissions.check(fakeTool({ name: "read", category: "read" }), {});
  assert.equal(result.allowed, true);
});

test("权限: 非交互环境下的 ask 默认拒绝", async () => {
  const permissions = new Permissions({ interactive: false });
  const result = await permissions.check(fakeTool(), { path: "a" });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /需要用户确认/);
});

test("权限: 用户选 always 后本会话不再询问", async () => {
  let asked = 0;
  const permissions = new Permissions({
    interactive: true,
    confirm: async () => {
      asked++;
      return "always";
    },
  });
  const tool = fakeTool();
  const first = await permissions.check(tool, { path: "a" });
  const second = await permissions.check(tool, { path: "b" });
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(asked, 1); // 只问了第一次
});

test("权限: 危险命令即使默认 allow 也要询问", async () => {
  let asked = 0;
  const permissions = new Permissions({
    interactive: true,
    overrides: { bash: "allow" },
    confirm: async () => {
      asked++;
      return "no";
    },
  });
  const bash: Tool = fakeTool({ name: "bash", category: "exec" });
  const result = await permissions.check(bash, { command: "rm -rf ~" });
  assert.equal(asked, 1);
  assert.equal(result.allowed, false);
});

test("权限: acceptEdits 自动允许改文件，但 bash 仍要询问", async () => {
  let asked = 0;
  const permissions = new Permissions({
    acceptEdits: true,
    interactive: true,
    confirm: async () => {
      asked++;
      return "no";
    },
  });

  const write = await permissions.check(fakeTool({ name: "write", category: "write" }), { path: "a" });
  assert.equal(write.allowed, true);
  assert.match(write.reason, /acceptEdits/);

  const bash = await permissions.check(fakeTool({ name: "bash", category: "exec" }), {
    command: "ls",
  });
  assert.equal(bash.allowed, false);
  assert.equal(asked, 1);
});

test("权限: 选过 always 之后，危险命令仍然要询问", async () => {
  let asked = 0;
  const permissions = new Permissions({
    interactive: true,
    confirm: async () => {
      asked++;
      return "always";
    },
  });
  const bash: Tool = fakeTool({ name: "bash", category: "exec" });

  // 普通命令：选 always 之后不再问
  await permissions.check(bash, { command: "ls" });
  await permissions.check(bash, { command: "pwd" });
  assert.equal(asked, 1);

  // 危险命令：即使之前选过 always，也必须重新确认
  await permissions.check(bash, { command: "sudo rm -rf /" });
  assert.equal(asked, 2);
  // 而且危险命令的 always 不会被记住：下一次还要问
  await permissions.check(bash, { command: "rm -rf ~" });
  assert.equal(asked, 3);
});

test("权限: clearSessionAllowed 会清空 always 记忆（切会话时用）", async () => {
  let asked = 0;
  const permissions = new Permissions({
    interactive: true,
    confirm: async () => {
      asked++;
      return "always";
    },
  });
  const bash: Tool = fakeTool({ name: "bash", category: "exec" });

  await permissions.check(bash, { command: "ls" });
  await permissions.check(bash, { command: "pwd" });
  assert.equal(asked, 1, "always 之后同类工具不再问");

  permissions.clearSessionAllowed();
  await permissions.check(bash, { command: "echo hi" });
  assert.equal(asked, 2, "清空记忆后应该重新询问");
});

test("权限: --yolo 全放行", async () => {
  const permissions = new Permissions({ yolo: true });
  const result = await permissions.check(fakeTool(), { path: "a" });
  assert.equal(result.allowed, true);
});

// ---------------------------------------------------------------------------
// 配置：temperature
// ---------------------------------------------------------------------------
test("config: 默认不限步数/工具数，需要时再设上限", () => {
  // 这个用例断言的是“内置默认值”，所以必须屏蔽两处外部干扰：
  //   1) 项目自己的 .env（开发者本地常常设了 MINI_MAX_TOOL_CALLS，会盖掉默认值）
  //   2) 前面用例可能塞进 process.env 的 MINI_* 变量（loadEnv 是写回 process.env 的）
  // 所以换一个空的临时目录当 cwd，并临时清掉 MINI_* —— 否则在本地跑必然红。
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "mini-cfg-"));
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("MINI_")) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  }
  try {
    const defaults = resolveConfig(cwd, { mock: true });
    assert.equal(defaults.maxSteps, 0, "默认不限步数（对齐 Claude Code / Codex 交互模式）");
    assert.equal(defaults.maxToolCalls, 0, "默认不限工具调用");
    assert.equal(defaults.repeatGuard, true, "卡死熔断默认开");
    assert.equal(resolveConfig(cwd, { mock: true, maxSteps: 64 }).maxSteps, 64);
    assert.equal(resolveConfig(cwd, { mock: true, maxToolCalls: 50 }).maxToolCalls, 50);
    assert.equal(resolveConfig(cwd, { mock: true, repeatGuard: false }).repeatGuard, false);
  } finally {
    Object.assign(process.env, saved);
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test("config: temperature 支持默认值 / 命令行覆盖 / 环境变量，0 也合法", () => {
  const original = process.env.MINI_TEMPERATURE;

  // 1) 命令行覆盖优先
  assert.equal(resolveConfig(process.cwd(), { mock: true, temperature: 1.5 }).temperature, 1.5);

  // 2) 环境变量
  process.env.MINI_TEMPERATURE = "0.9";
  assert.equal(resolveConfig(process.cwd(), { mock: true }).temperature, 0.9);

  // 3) 0 是合法温度（旧实现会把它当成“没设置”回退 0.2）
  process.env.MINI_TEMPERATURE = "0";
  assert.equal(resolveConfig(process.cwd(), { mock: true }).temperature, 0);

  // 4) 非法值回退默认 0.2，越界夹到 0~2
  process.env.MINI_TEMPERATURE = "abc";
  assert.equal(resolveConfig(process.cwd(), { mock: true }).temperature, 0.2);
  assert.equal(resolveConfig(process.cwd(), { mock: true, temperature: 99 }).temperature, 2);

  if (original === undefined) delete process.env.MINI_TEMPERATURE;
  else process.env.MINI_TEMPERATURE = original;
});

// ---------------------------------------------------------------------------
// 错误翻译
// ---------------------------------------------------------------------------
test("explainLLMError: 400 模型名错误会列出可用模型并告诉用户改哪", () => {
  // 这就是真实网关返回的报错格式（用户实际踩到过）
  const err = new Error(
    '模型接口返回 400 Bad Request：{"error":{"message":"The supported API model names are deepseek-flash, deepseek-v4-pro, but you passed deepseek. (request_id: abc)"}}',
  );
  const message = explainLLMError(err);
  assert.match(message, /可用模型：deepseek-flash, deepseek-v4-pro/);
  assert.doesNotMatch(message, /可用模型：[^\n]*but you passed/, "只应提取模型列表，不要把后半句一起截进来");
  assert.match(message, /MINI_MODEL/);
});

test("explainLLMError: 401 / 429 / 网络错误有对应提示", () => {
  assert.match(explainLLMError(new Error("模型接口返回 401 Unauthorized")), /API key 无效/);
  assert.match(explainLLMError(new Error("模型接口返回 429 Too Many Requests")), /限流/);
  assert.match(explainLLMError(new Error("fetch failed")), /连不上模型接口/);
});

// ---------------------------------------------------------------------------
// 路径安全 & glob
// ---------------------------------------------------------------------------
test("resolveInside: 拒绝 ../ 越界", () => {
  const cwd = process.cwd();
  assert.throws(() => resolveInside(cwd, "../outside.txt"), /路径越界/);
});

test("globToRegExp: 支持 *、**、?", () => {
  assert.equal(globToRegExp("*.ts").test("a.ts"), true);
  assert.equal(globToRegExp("*.ts").test("src/a.ts"), false);
  assert.equal(globToRegExp("src/**/*.ts").test("src/a/b/c.ts"), true);
  assert.equal(globToRegExp("src/**/*.ts").test("src/a.ts"), true);
  assert.equal(globToRegExp("a?.js").test("ab.js"), true);
});

// ---------------------------------------------------------------------------
// 推理强度：必须真的写进请求体
// ---------------------------------------------------------------------------
test("reasoningEffort: 透传成 reasoning_effort，default 时不发送", async () => {
  // 起一个假网关，把请求体抓下来 —— 只断言“配置里有这个字段”是不够的，
  // 真正的 bug 往往是“参数在层层传递中被忘了”，只有看请求体才能发现。
  const bodies: Array<Record<string, unknown>> = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      bodies.push(JSON.parse(raw) as Record<string, unknown>);
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n');
      res.write("data: [DONE]\n\n");
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const provider = createProvider({
    baseUrl: `http://127.0.0.1:${port}`,
    apiKey: "test-key",
    model: "test-model",
    temperature: 0.2,
  });

  const drain = async (effort: string | undefined) => {
    for await (const _event of provider.stream([{ role: "user", content: "hi" }], { reasoningEffort: effort })) {
      // 消费掉事件即可，内容不关心
    }
  };

  try {
    await drain("high");
    assert.equal(bodies.at(-1)?.reasoning_effort, "high");

    await drain("default");
    assert.equal("reasoning_effort" in (bodies.at(-1) ?? {}), false, "default 表示不发这个字段");

    await drain(undefined);
    assert.equal("reasoning_effort" in (bodies.at(-1) ?? {}), false, "没配置时也不发");
  } finally {
    server.close();
  }
});

// ---------------------------------------------------------------------------
// 空闲超时：网关「连着但不吐字」时必须能中断，不能永远卡住
// ---------------------------------------------------------------------------
test("idleTimeout: 上游不再吐数据时会中断并给出可读错误", async () => {
  // 模拟最讨厌的一种故障：HTTP 200 + SSE 头都正常，先吐一个 chunk，然后彻底安静
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.write('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n');
    // 故意不写 [DONE]、不 end —— 真实网关卡住时就长这样
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  const provider = createProvider({
    baseUrl: `http://127.0.0.1:${port}`,
    apiKey: "test-key",
    model: "test-model",
    retries: 0,
    idleTimeoutMs: 300,
  });

  const started = Date.now();
  try {
    await assert.rejects(
      async () => {
        for await (const _event of provider.stream([{ role: "user", content: "hi" }])) {
          // 消费掉第一个 chunk，然后就会卡在等第二个
        }
      },
      /没有返回任何新数据/,
    );
    // 300ms 的空闲超时，不该拖成好几秒
    assert.ok(Date.now() - started < 5000, `空闲超时没有尽快生效：${Date.now() - started}ms`);
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
