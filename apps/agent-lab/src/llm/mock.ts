/**
 * ============================================================================
 * Mock 模型：一个“按剧本演戏”的假 LLM。
 * ============================================================================
 *
 * 为什么教学项目要自带假模型？
 *  1. 你还没填 API key 时，也能把“Agent 循环”整条链路跑通、看到效果；
 *  2. 读代码时不被网络问题打扰；
 *  3. 它完整实现了 LLMProvider 接口 —— 这本身就证明了“模型是可替换的”。
 *
 * 它的“智能”只有一句话：看用户说了什么，返回预先写好的剧本。
 * 剧本里既有文本，也有工具调用请求 —— 和真模型的行为结构一模一样。
 *
 * 真实模型是“生成”这些 JSON；mock 是“硬编码”这些 JSON。
 * 对 Agent 程序来说，两者没有区别。
 */
import type {
  ChatMessage,
  LLMProvider,
  StreamEvent,
  StreamOptions,
  ToolCall,
  Usage,
} from "./types.ts";
import { contentImages, contentToText, estimateContentTokens } from "./content.ts";
import { estimateTokens, sleep } from "../util.ts";

export interface MockProviderOptions {
  /** 每个字块之间的延迟（毫秒）。0 = 立即返回，测试用。 */
  delayMs?: number;
  /** 假模型的名字。 */
  model?: string;
}

/** 剧本里的一轮：说点什么 + 调哪些工具。 */
interface MockTurn {
  text?: string;
  toolCalls?: ToolCall[];
}

/** 根据用户输入挑一套剧本。 */
interface MockScenario {
  match: RegExp;
  turns: MockTurn[];
}

function call(id: string, name: string, args: Record<string, unknown>): ToolCall {
  return { id, type: "function", function: { name, arguments: JSON.stringify(args) } };
}

/** 剧本一：用户让“创建文件”，演示 bash → write → read 三步。 */
const FILE_SCENARIO: MockScenario = {
  match: /文件|创建|新建|写个|写一个|hello|file|目录/i,
  turns: [
    {
      text: "好，我先看看当前目录里有什么。\n",
      toolCalls: [call("call_mock_1", "bash", { command: "ls -la" })],
    },
    {
      text: "目录看完了。我现在创建一个 hello.txt。\n",
      toolCalls: [
        call("call_mock_2", "write", {
          path: "hello.txt",
          content: "你好，Agent！\n这一行是模型通过 write 工具写进文件的。\n",
        }),
      ],
    },
    {
      toolCalls: [call("call_mock_3", "read", { path: "hello.txt" })],
    },
    {
      text:
        "✅ 完成了。刚才发生了这些事：\n" +
        "1. 我请求调用 bash 看目录 —— 你的程序执行后把结果喂回给我\n" +
        "2. 我请求 write 创建文件 —— 程序写完后把结果喂回给我\n" +
        "3. 我请求 read 验证内容 —— 确认写对了\n\n" +
        "这个 hello.txt 现在就在你的项目目录里，打开看看。\n" +
        "（提示：把 .env 里的 key 填上，换成真模型，试试让它做点更复杂的事。）",
    },
  ],
};

/** 剧本二：用户让“拆任务”，演示 todo 工具（Agent 的工作记忆）。 */
const TODO_SCENARIO: MockScenario = {
  match: /todo|待办|拆解|拆一下|计划|规划|任务/i,
  turns: [
    {
      text: "好，我先把任务拆成几步。\n",
      toolCalls: [
        call("call_mock_todo_1", "todowrite", {
          todos: [
            { content: "阅读现有代码，理解结构", status: "in_progress" },
            { content: "设计改动方案", status: "pending" },
            { content: "实现并跑测试", status: "pending" },
          ],
        }),
      ],
    },
    {
      text: "第一步完成，继续下一步。\n",
      toolCalls: [
        call("call_mock_todo_2", "todowrite", {
          todos: [
            { content: "阅读现有代码，理解结构", status: "completed" },
            { content: "设计改动方案", status: "in_progress" },
            { content: "实现并跑测试", status: "pending" },
          ],
        }),
      ],
    },
    {
      text: "任务已经拆好了，清单在上面的工具结果里。\n（真实模型会按这个清单一步步用工具干活，你可以看它怎么更新进度。）",
    },
  ],
};

const SCENARIOS: MockScenario[] = [FILE_SCENARIO, TODO_SCENARIO];

const DEFAULT_TURNS: MockTurn[] = [
  {
    text:
      "我是 mock 模型 —— 不联网、不花钱、只会演剧本。\n" +
      "不过 Agent 循环、工具调用、权限审批、会话记录，全都是真的。\n\n" +
      "试试这两句话（会触发不同的剧本）：\n" +
      "  · 帮我创建一个 hello.txt\n" +
      "  · 用 todo 拆解一下这个任务\n\n" +
      "想接真模型？把项目根目录的 .env 填上 DEEPSEEK_API_KEY，然后去掉 --mock 重启。",
  },
];

/** 判断是不是“上下文压缩”请求（agent/context.ts 会发这种请求）。 */
function isCompactionRequest(messages: ChatMessage[]): boolean {
  const system = messages.find((m) => m.role === "system");
  return typeof system?.content === "string" && system.content.includes("上下文压缩器");
}

/** 找出最后一条 user 消息的下标。 */
function lastUserIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === "user") return i;
  }
  return -1;
}

/** 数一数“最后一次用户输入之后”已经有了几条工具结果。 */
function toolResultsSinceLastUser(messages: ChatMessage[]): number {
  const start = lastUserIndex(messages);
  if (start < 0) return 0;
  return messages.slice(start + 1).filter((m) => m.role === "tool").length;
}

/** 取最后一次用户输入之后的最后一条 tool 消息。 */
function lastToolMessage(messages: ChatMessage[]): ChatMessage | undefined {
  const start = lastUserIndex(messages);
  if (start < 0) return undefined;
  for (let i = messages.length - 1; i > start; i--) {
    if (messages[i]!.role === "tool") return messages[i];
  }
  return undefined;
}

/**
 * 检测“工具被拦住”的情况。
 *
 * 为什么假模型要在意这个？
 * 因为如果权限拒绝了写文件、或者当前模式没有某个工具，
 * 剧本还硬说“✅ 完成了”，会误导正在学习的新手。
 * 一个诚实的 demo 比一个漂亮的 demo 重要。
 */
function detectBlockedTurn(messages: ChatMessage[]): MockTurn | null {
  const last = lastToolMessage(messages);
  const content = typeof last?.content === "string" ? last.content : "";
  if (!content) return null;

  if (content.includes("权限系统拒绝") || content.includes("需要用户确认")) {
    return {
      text:
        "我刚刚的操作被权限系统拦住了 —— 这正是 Agent 的安全机制在起作用。\n\n" +
        "你现在可以：\n" +
        "  · 在交互式终端里重新触发，然后选 y（允许）或 a（本会话始终允许）\n" +
        "  · 加 --yolo 参数跳过所有确认（只建议在学习环境里用）\n" +
        "  · 用 /mode plan 切到只读模式，我就只调查、不修改\n\n" +
        "模型没法绕过这道闸门：它只能“请求”调用工具，真正执行的是程序。",
    };
  }

  if (content.includes("没有名为")) {
    return {
      text:
        "当前模式下我没有完成这个任务所需的工具。\n\n" +
        `程序返回的信息是：${content}\n\n` +
        "这不是 bug：工具是由程序按当前模式注册的，模型只能用程序给它的工具。\n" +
        "plan 模式（只读）下没有 write/edit/bash，就是为了防止模型改文件。",
    };
  }

  return null;
}

function lastUserText(messages: ChatMessage[]): string {
  const idx = lastUserIndex(messages);
  return contentToText(idx >= 0 ? messages[idx]?.content : "");
}

/** 最后一条用户消息带了几张图片（用来演示多模态请求确实进来了）。 */
function lastUserImageCount(messages: ChatMessage[]): number {
  const idx = lastUserIndex(messages);
  return idx >= 0 ? contentImages(messages[idx]?.content).length : 0;
}

/** 把一整段文字切成小块，模拟“打字机”效果。 */
function* chunkText(text: string, size = 3): Generator<string> {
  for (let i = 0; i < text.length; i += size) {
    yield text.slice(i, i + size);
  }
}

function abortError(): Error {
  const err = new Error("已取消");
  err.name = "AbortError";
  return err;
}

/**
 * 创建 mock provider。
 * 它和真实 provider 实现同一个 LLMProvider 接口 —— 这就是“可替换的模型”。
 */
export function createMockProvider(options: MockProviderOptions = {}): LLMProvider {
  const delayMs = options.delayMs ?? 8;
  const model = options.model ?? "mock-model";

  return {
    id: "mock",
    model,

    async *stream(
      messages: ChatMessage[],
      streamOptions?: StreamOptions,
    ): AsyncGenerator<StreamEvent, void, void> {
      // 1. 压缩请求：直接返回一段假摘要
      if (isCompactionRequest(messages)) {
        const summary =
          "- 用户和 Agent 之前讨论了一个编码任务。\n" +
          "- 已经用工具查看了目录、创建了文件、验证了内容。\n" +
          "- 当前没有未解决的报错。\n" +
          "（这是 mock 模型生成的假摘要；真实模型会真的总结历史。）";
        yield { type: "usage", usage: fakeUsage(messages, summary) };
        for (const piece of chunkText(summary)) {
          if (streamOptions?.signal?.aborted) throw abortError();
          if (delayMs) await sleep(delayMs);
          yield { type: "text", text: piece };
        }
        yield { type: "done", finishReason: "stop" };
        return;
      }

      // 2. 收尾请求（循环被上限/熔断暂停后，loop 会发一条 [系统] 消息要总结）
      const lastUser = lastUserText(messages);
      if (/\[系统\] 本回合因为/.test(lastUser)) {
        const summary =
          "【收尾小结】本回合因为达到上限而暂停。\n" +
          "（mock 模型不会真正总结；换成真实模型时，这里会列出已完成的修改和剩余工作。）\n" +
          "上面的时间线里能看到每一步的上下文、工具调用和结果。";
        yield { type: "usage", usage: fakeUsage(messages, summary) };
        for (const piece of chunkText(summary)) {
          if (streamOptions?.signal?.aborted) throw abortError();
          if (delayMs) await sleep(delayMs);
          yield { type: "text", text: piece };
        }
        yield { type: "done", finishReason: "stop" };
        return;
      }

      // 3. 没有注册工具时（比如 examples/01 只聊天），只回文本
      const hasTools = (streamOptions?.tools?.length ?? 0) > 0;

      // 4. 如果上一步工具被权限拦住 / 工具不存在，诚实地说明情况（而不是硬演剧本）
      if (hasTools) {
        const blocked = detectBlockedTurn(messages);
        if (blocked) {
          for (const piece of chunkText(blocked.text ?? "")) {
            if (streamOptions?.signal?.aborted) throw abortError();
            if (delayMs) await sleep(delayMs);
            yield { type: "text", text: piece };
          }
          yield { type: "usage", usage: fakeUsage(messages, blocked.text ?? "") };
          yield { type: "done", finishReason: "stop" };
          return;
        }
      }

      // 5. 按用户输入挑剧本
      const userText = lastUserText(messages);
      const scenario = SCENARIOS.find((s) => s.match.test(userText));
      const turns = scenario ? scenario.turns : DEFAULT_TURNS;

      // 6. 根据“已经执行过几个工具”决定演到第几幕
      const step = toolResultsSinceLastUser(messages);
      const turn = turns[Math.min(step, turns.length - 1)]!;

      // 7. 吐出文本（逐块，模拟流式）
      for (const piece of chunkText(turn.text ?? "")) {
        if (streamOptions?.signal?.aborted) throw abortError();
        if (delayMs) await sleep(delayMs);
        yield { type: "text", text: piece };
      }

      // 8. 吐出工具调用请求
      const toolCalls = hasTools ? turn.toolCalls : undefined;
      if (toolCalls?.length) {
        yield { type: "tool_calls", toolCalls };
      }

      // 9. 用量 + 结束
      yield { type: "usage", usage: fakeUsage(messages, turn.text ?? "") };
      yield { type: "done", finishReason: toolCalls?.length ? "tool_calls" : "stop" };
    },
  };
}

/** 伪造一个看起来合理的 token 用量。 */
function fakeUsage(messages: ChatMessage[], completion: string): Usage {
  const prompt = messages.reduce((sum, m) => sum + estimateContentTokens(m.content), 0);
  const out = estimateTokens(completion);
  return { prompt_tokens: prompt, completion_tokens: out, total_tokens: prompt + out };
}
