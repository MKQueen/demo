/**
 * Agent 主循环测试：不联网、不调真模型，用“剧本 provider”驱动。
 *
 * 这是最有价值的测试类型之一：
 * 它验证的不是某个函数，而是**整个循环的控制流** ——
 * 模型要工具 → 执行 → 结果回填 → 再调模型 → 结束。
 *
 * 如果以后有人改坏了循环（比如忘了 push tool 消息、忘了检查权限），
 * 这个测试会立刻红。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { runAgent } from "../src/agent/loop.ts";
import type { AgentUI } from "../src/agent/loop.ts";
import { ToolRegistry } from "../src/tools/registry.ts";
import { Permissions } from "../src/permission.ts";
import type { ChatMessage, LLMProvider, ToolCall } from "../src/llm/types.ts";
import { contentToText } from "../src/llm/content.ts";
import type { Tool } from "../src/tools/types.ts";

/** 剧本 provider：按顺序吐预先写好的轮次。 */
function scriptedProvider(
  turns: Array<{ text?: string; toolCalls?: ToolCall[] }>,
): LLMProvider {
  let index = 0;
  return {
    id: "scripted",
    model: "scripted-model",
    async *stream() {
      const turn = turns[Math.min(index, turns.length - 1)]!;
      index++;
      if (turn.text) yield { type: "text", text: turn.text };
      if (turn.toolCalls) yield { type: "tool_calls", toolCalls: turn.toolCalls };
      yield { type: "usage", usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } };
      yield { type: "done" };
    },
  };
}

function toolCall(name: string, args: Record<string, unknown>, id = "call_1"): ToolCall {
  return { id, type: "function", function: { name, arguments: JSON.stringify(args) } };
}

/** 静默 UI：测试不关心渲染。 */
function silentUI(): AgentUI {
  return {
    assistantStart() {},
    assistantText() {},
    assistantThinking() {},
    assistantEnd() {},
    toolStart() {},
    toolEnd() {},
    info() {},
    notice() {},
    error() {},
  };
}

/** 记录所有事件，方便断言。 */
function recordingUI(): { ui: AgentUI; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    ui: {
      assistantStart() {
        calls.push("assistantStart");
      },
      assistantText(delta: string) {
        calls.push(`text:${delta}`);
      },
      assistantThinking() {},
      assistantEnd() {
        calls.push("assistantEnd");
      },
      toolStart(name: string) {
        calls.push(`toolStart:${name}`);
      },
      toolEnd(result) {
        calls.push(`toolEnd:${result.title}:${result.isError ? "error" : "ok"}`);
      },
      info() {},
      notice() {},
      error() {},
    },
  };
}

function makeRegistry(tool: Tool): ToolRegistry {
  return new ToolRegistry().register(tool);
}

const echoTool: Tool = {
  name: "echo",
  description: "回显一段文字",
  category: "read",
  parameters: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
    additionalProperties: false,
  },
  async execute(args) {
    return { title: "echo", output: `echo:${String(args.text)}` };
  },
};

const baseOptions = (overrides: Partial<Parameters<typeof runAgent>[0]>) =>
  ({
    provider: scriptedProvider([]),
    registry: new ToolRegistry(),
    system: "system prompt",
    history: [] as ChatMessage[],
    cwd: process.cwd(),
    maxSteps: 10,
    contextBudget: 100_000,
    permissions: new Permissions({ yolo: true }),
    ui: silentUI(),
    signal: new AbortController().signal,
    ...overrides,
  }) as Parameters<typeof runAgent>[0];

test("Agent 循环: 工具调用 → 执行 → 结果回填 → 模型收尾", async () => {
  const history: ChatMessage[] = [{ role: "user", content: "帮我 echo 一下" }];
  const provider = scriptedProvider([
    { text: "我来调用工具。", toolCalls: [toolCall("echo", { text: "hi" })] },
    { text: "完成了。" },
  ]);

  const result = await runAgent(
    baseOptions({
      provider,
      registry: makeRegistry(echoTool),
      history,
    }),
  );

  assert.equal(result.steps, 2);
  assert.equal(result.aborted, false);
  assert.equal(result.hitStepLimit, false);
  assert.deepEqual(
    history.map((message) => message.role),
    ["user", "assistant", "tool", "assistant"],
  );

  // assistant 消息里带了工具调用请求
  assert.equal(history[1]!.tool_calls?.[0]!.function.name, "echo");
  // tool 消息必须带 tool_call_id，且内容是工具真实返回
  assert.equal(history[2]!.tool_call_id, "call_1");
  assert.equal(contentToText(history[2]!.content), "echo:hi");
  // 最后一轮 assistant 是纯文本收尾
  assert.equal(contentToText(history[3]!.content), "完成了。");
  assert.equal(history[3]!.tool_calls, undefined);
});

test("Agent 循环: 工具参数 JSON 坏掉时会回填错误并让模型重试", async () => {
  const history: ChatMessage[] = [{ role: "user", content: "echo" }];
  const provider = scriptedProvider([
    {
      text: "",
      toolCalls: [
        // 故意给一个坏 JSON
        { id: "bad", type: "function", function: { name: "echo", arguments: '{text: "hi"' } },
      ],
    },
    { text: "我拿到错误了，修正后再说。" },
  ]);

  await runAgent(baseOptions({ provider, registry: makeRegistry(echoTool), history }));

  const toolMessage = history.find((message) => message.role === "tool");
  assert.ok(toolMessage);
  assert.match(contentToText(toolMessage.content), /不是合法的 JSON/);
  // 循环继续了，没有崩
  assert.equal(history[history.length - 1]!.role, "assistant");
});

test("Agent 循环: 参数 schema 不合法时回填具体错误", async () => {
  const history: ChatMessage[] = [{ role: "user", content: "echo" }];
  const provider = scriptedProvider([
    { text: "", toolCalls: [toolCall("echo", { text: 123 })] },
    { text: "好，我改。" },
  ]);

  await runAgent(baseOptions({ provider, registry: makeRegistry(echoTool), history }));
  const toolMessage = history.find((message) => message.role === "tool");
  assert.match(contentToText(toolMessage!.content), /参数校验失败/);
  assert.match(contentToText(toolMessage!.content), /text 应该是字符串/);
});

test("Agent 循环: 调用不存在的工具时告诉模型有哪些工具", async () => {
  const history: ChatMessage[] = [{ role: "user", content: "x" }];
  const provider = scriptedProvider([
    { text: "", toolCalls: [toolCall("nonexistent", {})] },
    { text: "抱歉，我换一个。" },
  ]);

  await runAgent(baseOptions({ provider, registry: makeRegistry(echoTool), history }));
  const toolMessage = history.find((message) => message.role === "tool");
  assert.match(contentToText(toolMessage!.content), /没有名为 "nonexistent" 的工具/);
  assert.match(contentToText(toolMessage!.content), /echo/);
});

test("Agent 循环: 权限拒绝会变成一条模型可见的错误消息", async () => {
  const history: ChatMessage[] = [{ role: "user", content: "x" }];
  const provider = scriptedProvider([
    { text: "", toolCalls: [toolCall("echo", { text: "hi" })] },
    { text: "好的，我不调用工具了。" },
  ]);

  await runAgent(
    baseOptions({
      provider,
      registry: makeRegistry(echoTool),
      history,
      permissions: new Permissions({ yolo: false, interactive: false, overrides: { echo: "ask" } }),
    }),
  );

  const toolMessage = history.find((message) => message.role === "tool");
  assert.match(contentToText(toolMessage!.content), /权限系统拒绝/);
});

test("Agent 循环: 达到最大步数会停下并标记 hitStepLimit", async () => {
  const history: ChatMessage[] = [{ role: "user", content: "一直调工具" }];
  // 每轮调用参数不同，避开重复熔断，专门测试步数上限
  const provider = scriptedProvider([
    { text: "", toolCalls: [toolCall("echo", { text: "step-1" }, "c1")] },
    { text: "", toolCalls: [toolCall("echo", { text: "step-2" }, "c2")] },
    { text: "", toolCalls: [toolCall("echo", { text: "step-3" }, "c3")] },
  ]);

  const result = await runAgent(
    baseOptions({ provider, registry: makeRegistry(echoTool), history, maxSteps: 3 }),
  );

  assert.equal(result.hitStepLimit, true);
  assert.equal(result.stopReason, "step_limit");
  assert.equal(result.steps, 3);
  // 3 轮 × (assistant + tool) + 1 条 user
  assert.equal(history.length, 1 + 3 * 2);
});

test("Agent 循环: 连续 3 次相同工具调用会熔断，并让模型收尾总结", async () => {
  const history: ChatMessage[] = [{ role: "user", content: "卡住的模型" }];
  let seq = 0;
  const provider: LLMProvider = {
    id: "repeat",
    model: "repeat",
    async *stream(_messages, options) {
      if (options?.tools && options.tools.length > 0) {
        seq++;
        yield { type: "tool_calls", toolCalls: [toolCall("echo", { text: "same" }, `c${seq}`)] };
      } else {
        // 收尾请求：不带工具，返回一段总结
        yield { type: "text", text: "收尾总结：连续调用了相同工具，已暂停。" };
      }
      yield { type: "done" };
    },
  };

  const result = await runAgent(
    baseOptions({
      provider,
      registry: makeRegistry(echoTool),
      history,
      maxSteps: 10,
      maxToolCalls: 100,
    }),
  );

  assert.equal(result.stopReason, "repeat");
  assert.equal(result.hitStepLimit, true);
  // 前两次执行了；第三次在真正执行前被熔断，但补了一条“未执行”的 tool 消息
  const toolMessages = history.filter((m) => m.role === "tool");
  assert.equal(toolMessages.length, 3);
  assert.equal(contentToText(toolMessages[0]!.content), "echo:same");
  assert.equal(contentToText(toolMessages[1]!.content), "echo:same");
  assert.match(String(toolMessages[2]!.content), /系统暂停/);
  // 收尾总结被写进历史
  const last = history[history.length - 1]!;
  assert.equal(last.role, "assistant");
  assert.match(String(last.content), /收尾总结/);
});

test("Agent 循环: 工具调用超过上限会暂停并请模型收尾", async () => {
  const history: ChatMessage[] = [{ role: "user", content: "工具很多" }];
  let seq = 0;
  const provider: LLMProvider = {
    id: "many-tools",
    model: "many-tools",
    async *stream(_messages, options) {
      if (options?.tools && options.tools.length > 0) {
        seq++;
        // 参数不同，避免触发重复熔断
        yield { type: "tool_calls", toolCalls: [toolCall("echo", { text: `call-${seq}` }, `t${seq}`)] };
      } else {
        yield { type: "text", text: "收尾总结：工具调用到达上限。" };
      }
      yield { type: "done" };
    },
  };

  const result = await runAgent(
    baseOptions({
      provider,
      registry: makeRegistry(echoTool),
      history,
      maxSteps: 10,
      maxToolCalls: 2,
    }),
  );

  assert.equal(result.stopReason, "tool_limit");
  assert.equal(result.hitStepLimit, true);
  // 实际执行 2 次；第 3 次被拒绝并补了“未执行”的 tool 消息
  const toolMessages = history.filter((m) => m.role === "tool");
  assert.equal(toolMessages.length, 3);
  assert.match(String(toolMessages[2]!.content), /工具调用上限/);
  assert.match(String(history[history.length - 1]!.content), /收尾总结/);
});

test("Agent 循环: 用户中断时保留已生成的部分文本", async () => {
  const history: ChatMessage[] = [{ role: "user", content: "慢慢说" }];
  const controller = new AbortController();

  const provider: LLMProvider = {
    id: "slow",
    model: "slow",
    async *stream() {
      yield { type: "text", text: "我正在" };
      controller.abort();
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    },
  };

  const result = await runAgent(
    baseOptions({ provider, history, signal: controller.signal, registry: makeRegistry(echoTool) }),
  );

  assert.equal(result.aborted, true);
  assert.equal(history[history.length - 1]!.role, "assistant");
  assert.match(contentToText(history[history.length - 1]!.content), /我正在/);
});

test("Agent 循环: 中途中断会为未执行的工具补齐 tool 消息（保证协议完整）", async () => {
  const controller = new AbortController();
  const history: ChatMessage[] = [{ role: "user", content: "一次调两个工具" }];

  const provider = scriptedProvider([
    {
      text: "",
      toolCalls: [toolCall("abort-then-echo", { text: "a" }, "c1"), toolCall("echo", { text: "b" }, "c2")],
    },
  ]);

  // 第一个工具执行时触发中断，第二个工具不应该执行，但必须有 tool 消息
  const abortTool: Tool = {
    name: "abort-then-echo",
    description: "执行时触发中断",
    category: "read",
    parameters: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
      additionalProperties: false,
    },
    async execute() {
      controller.abort();
      return { title: "abort-then-echo", output: "已执行并中断" };
    },
  };

  const registry = new ToolRegistry().register(abortTool).register(echoTool);
  const result = await runAgent(
    baseOptions({ provider, registry, history, signal: controller.signal }),
  );

  assert.equal(result.aborted, true);
  const toolMessages = history.filter((m) => m.role === "tool");
  assert.equal(toolMessages.length, 2, "两个 tool_call 都必须有 tool 消息");
  assert.equal(toolMessages[0]!.tool_call_id, "c1");
  assert.equal(toolMessages[1]!.tool_call_id, "c2");
  assert.match(String(toolMessages[1]!.content), /中断/);
});

test("Agent 循环: UI 收到的顺序符合流式语义", async () => {
  const history: ChatMessage[] = [{ role: "user", content: "x" }];
  const { ui, calls } = recordingUI();
  const provider = scriptedProvider([
    { text: "看", toolCalls: [toolCall("echo", { text: "a" })] },
    { text: "完" },
  ]);

  await runAgent(baseOptions({ provider, registry: makeRegistry(echoTool), history, ui }));

  assert.equal(calls[0], "assistantStart");
  assert.equal(calls[1], "text:看");
  assert.equal(calls[2], "assistantEnd");
  assert.equal(calls[3], "toolStart:echo");
  assert.equal(calls[4], "toolEnd:echo:ok");
  assert.equal(calls[5], "assistantStart");
  assert.equal(calls[6], "text:完");
  assert.equal(calls[7], "assistantEnd");
});
