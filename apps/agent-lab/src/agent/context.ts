/**
 * ============================================================================
 * 上下文管理：Agent 最容易“死”的地方
 * ============================================================================
 *
 * 一个残酷的事实：模型的上下文窗口是有限的（比如 64K token），
 * 但 Agent 跑起来之后，历史会**指数级膨胀**：
 *
 *   用户问题(100) → 模型回复(200) + 工具调用(50) → 工具结果(5000!)
 *   → 模型再回复 + 更多工具结果 …
 *
 * 尤其是 bash 输出和 read 文件，一条就可能几万 token。
 * 如果不管理，几轮之后就爆了，API 直接报错。
 *
 * 所以真实 Agent 都有三层防御（这个文件就是三层）：
 *
 *   第一层：截断工具输出（truncateToolOutputs）
 *     - 单条工具结果最多留 2000 字符，中间省略
 *     - 大多数情况下这一层就够了
 *
 *   第二层：裁剪旧消息（fitContext）
 *     - 按“轮”为单位删掉最老的历史（整轮删，不能把 assistant 和 tool 拆散）
 *     - 永远保留 system、最后一条 user、最近的几条消息
 *
 *   第三层：LLM 摘要压缩（compactHistory）
 *     - 让模型把旧历史总结成一段话，用摘要替换原文
 *     - 这是最“贵”但最不丢信息的方案，真实 opencode 的 auto-compact 就是它
 *
 * 记住：上下文管理不是优化，是**正确性**问题。不管理就一定崩。
 */
import type { ChatMessage, LLMProvider } from "../llm/types.ts";
import { estimateContentTokens, flattenMessageContent } from "../llm/content.ts";
import { estimateTokens } from "../util.ts";
import { truncateMiddle } from "../util.ts";

/** 单条工具输出允许保留的最大字符数。 */
export const MAX_TOOL_OUTPUT_CHARS = 2000;

/** 估算单条消息的 token（含格式开销）。 */
export function messageTokens(message: ChatMessage): number {
  let tokens = estimateContentTokens(message.content) + 4; // 4 是 role 等格式开销的经验值
  if (message.tool_calls) {
    for (const call of message.tool_calls) {
      tokens += estimateTokens(call.function.name + call.function.arguments) + 8;
    }
  }
  return tokens;
}

/** 估算整个历史数组的 token。 */
export function estimateMessagesTokens(messages: ChatMessage[]): number {
  let total = 0;
  for (const message of messages) total += messageTokens(message);
  return total;
}

export interface FittedContext {
  messages: ChatMessage[];
  /** 裁剪后的估算 token 数。 */
  tokens: number;
  /** 删掉了几条消息。 */
  removed: number;
  /** 截断了几条工具输出。 */
  truncatedToolOutputs: number;
}

/**
 * 第一层 + 第二层：把历史压进预算。
 *
 * 注意我们**不修改传入的数组**（map 复制 + 新数组 splice），
 * 因为外面还持有原历史（要写进会话文件、要展示）。
 */
export function fitContext(messages: ChatMessage[], budget: number): FittedContext {
  let truncatedToolOutputs = 0;

  // ---- 第一层：截断超长工具输出 ----
  let working: ChatMessage[] = messages.map((message) => {
    if (message.role !== "tool" || typeof message.content !== "string") return message;
    if (message.content.length <= MAX_TOOL_OUTPUT_CHARS) return message;
    truncatedToolOutputs++;
    return {
      ...message,
      content:
        truncateMiddle(message.content, MAX_TOOL_OUTPUT_CHARS) +
        `\n[提示] 原始工具输出共 ${message.content.length} 字符，已截断。需要细节请重新精确查询。`,
    };
  });

  // ---- 第二层：从最老的“轮”开始删 ----
  // 一条 user 消息开启一轮，直到下一条 user 之前的内容是一整轮（assistant + tool 结果）。
  // 必须整轮删：只删 assistant 会留下没有对应调用的 tool 消息，API 会报错。
  let removed = 0;
  let tokens = estimateMessagesTokens(working);

  while (tokens > budget && working.length > 2) {
    const firstUser = working.findIndex((m) => m.role === "user");
    if (firstUser === -1) break;
    const lastUser = working.findLastIndex((m) => m.role === "user");
    // 只剩最后一轮了，不能再删（删了模型就不知道用户在问什么）
    if (firstUser === lastUser) break;

    let nextUser = working.findIndex((m, i) => i > firstUser && m.role === "user");
    if (nextUser === -1) nextUser = working.length;

    const dropCount = nextUser - firstUser;
    working.splice(firstUser, dropCount);
    removed += dropCount;
    tokens = estimateMessagesTokens(working);
  }

  // ---- 兜底：如果单条消息本身就超长（比如用户粘了一大段代码），再硬截 ----
  if (tokens > budget) {
    working = working.map((message) => {
      if (typeof message.content === "string" && message.content.length > 1200) {
        return { ...message, content: truncateMiddle(message.content, 1200) };
      }
      return message;
    });
    tokens = estimateMessagesTokens(working);
  }

  return { messages: working, tokens, removed, truncatedToolOutputs };
}

export interface CompactionResult {
  messages: ChatMessage[];
  summary: string;
  before: number;
  after: number;
}

/**
 * 第三层：让模型把旧历史压缩成摘要。
 *
 * 输入：完整历史
 * 处理：把“最近 N 条”之外的部分拼成文本，让模型总结
 * 输出：[摘要消息, ...最近 N 条]
 *
 * 注意：摘要消息用 assistant 角色（而不是 system），
 * 这样不会改变系统提示词的权威性，也更接近真实实现。
 */
export async function compactHistory(options: {
  messages: ChatMessage[];
  provider: LLMProvider;
  signal?: AbortSignal;
  keepRecent?: number;
}): Promise<CompactionResult> {
  const keepRecent = options.keepRecent ?? 4;

  // 切点必须落在“轮边界”上，否则会把 assistant.tool_calls 和它的 tool 结果拆散，
  // 生成一条孤儿的 tool 消息。真实接口会直接 400：
  //   messages with role 'tool' must be a response to a preceding message with 'tool_calls'
  //
  // （这个 bug 是独立验收时发现的：6 轮历史 + keepRecent=4 正好切在
  //  assistant(call_5) 和 tool(call_5) 之间，`/compact` 后接真模型必炸。）
  // 空历史直接给出可读错误：以前这里会去读 messages[0].role，
  // 结果是 TypeError（Cannot read properties of undefined），用户看到一头雾水。
  if (options.messages.length === 0) throw new Error("历史太短，不需要压缩");

  let cut = Math.max(0, options.messages.length - keepRecent);

  // 1) 不能从 tool 消息开始 recent
  while (cut > 0 && options.messages[cut]?.role === "tool") cut--;

  // 2) 尽量从某一轮的开头（user 消息）开始 recent，保留完整的一轮
  let userAtOrBefore = -1;
  for (let i = cut; i >= 0; i--) {
    if (options.messages[i]?.role === "user") {
      userAtOrBefore = i;
      break;
    }
  }
  if (userAtOrBefore > 0) cut = userAtOrBefore;

  // 3) 没有可压缩的历史了（只有一轮）就放弃
  if (cut <= 0) throw new Error("历史太短，不需要压缩");

  const older = options.messages.slice(0, cut);
  const recent = options.messages.slice(cut);

  // 把旧历史转成一段纯文本（每条都截断，防止摘要请求本身超长）
  const transcript = older
    .map((message) => {
      // 多模态消息拍平成文本：摘要器只需要知道“用户问了什么”，图片用占位说明。
      const content = flattenMessageContent(message);
      const calls =
        message.tool_calls
          ?.map((call) => `[请求调用 ${call.function.name}(${truncateMiddle(call.function.arguments, 200)})]`)
          .join(" ") ?? "";
      return `${message.role.toUpperCase()}: ${truncateMiddle(content, 800)} ${calls}`.trim();
    })
    .join("\n")
    .slice(0, 24_000);

  // 注意这段 system 里包含“上下文压缩器”几个字：
  // mock 模型靠它识别“这是压缩请求”，从而返回假摘要。
  const request: ChatMessage[] = [
    {
      role: "system",
      content:
        "你是一个上下文压缩器。把下面的对话历史压缩成一段简洁的中文摘要。" +
        "必须保留：用户的目标、已完成的动作（改了哪些文件、跑了什么命令）、" +
        "当前状态、尚未解决的问题。不要编造没有发生的事，不要输出多余的解释。",
    },
    { role: "user", content: transcript },
  ];

  let summary = "";
  for await (const event of options.provider.stream(request, {
    signal: options.signal,
    temperature: 0.1,
  })) {
    if (event.type === "text") summary += event.text;
  }

  summary = summary.trim();
  if (!summary) throw new Error("压缩请求没有返回内容");

  const merged: ChatMessage[] = [
    { role: "assistant", content: `[早前对话摘要]\n${summary}` },
    ...recent,
  ];

  // 防御性校验：压缩结果里每条 tool 消息都必须能找到对应的 assistant.tool_calls。
  // 这类“内部错误”如果漏出去，要等到真实 API 才报 400，很难查。
  const knownCallIds = new Set<string>();
  for (const message of merged) {
    if (message.role === "assistant") {
      for (const call of message.tool_calls ?? []) knownCallIds.add(call.id);
    }
    if (message.role === "tool" && (!message.tool_call_id || !knownCallIds.has(message.tool_call_id))) {
      throw new Error(
        "压缩产生了非法的工具消息配对（tool 消息找不到对应的 assistant.tool_calls），已放弃本次压缩",
      );
    }
  }

  const before = estimateMessagesTokens(options.messages);
  const after = estimateMessagesTokens(merged);

  // 压缩反而变长就别压了：摘要本身也是 token，短历史压缩是负收益。
  if (after >= before) {
    throw new Error(`压缩没有减少 token（${before} → ${after}），已跳过`);
  }

  return { messages: merged, summary, before, after };
}
