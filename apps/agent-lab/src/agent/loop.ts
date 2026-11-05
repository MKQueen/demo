/**
 * ============================================================================
 * Agent 主循环 —— 整个项目的心脏
 * ============================================================================
 *
 * 先用一句话说清 Agent 是什么：
 *
 *   Agent = 大模型 + 工具 + 一个循环 + 上下文管理
 *
 * 这个循环长这样（伪代码）：
 *
 *   messages = [用户的请求]
 *   while (步数 < 上限) {
 *     reply = 调模型(messages, 工具清单)
 *     messages.push(reply)
 *     if (reply 没有要求调用工具) break      // 模型认为任务完成了
 *     for (每个工具调用) {
 *       检查权限 → 执行 → 把结果作为 tool 消息 push 进 messages
 *     }
 *   }
 *
 * 就这么多。所谓“AI 自己会干活”，本质就是：
 * 模型每轮只能“说”和“请求调用工具”，程序负责执行并把结果喂回去，
 * 模型看到结果后决定下一步 —— 直到它认为任务完成。
 *
 * 这个文件里还藏着一堆工程细节，每个都值得单独记住：
 *   - 步数上限（防止模型死循环烧钱）
 *   - 工具参数 JSON 解析失败怎么办（不能崩，要喂回去让模型改）
 *   - 未知工具怎么办（喂回去告诉它有哪些工具）
 *   - 工具执行抛异常怎么办（转成错误结果喂回去）
 *   - 用户按 Ctrl+C 怎么办（中断但保留已生成的部分）
 *   - 上下文快爆了怎么办（先压缩，再裁剪）
 *   - 每一轮都要写会话记录（可恢复、可审计）
 */
import type { ChatMessage, LLMProvider, ToolCall, Usage } from "../llm/types.ts";
import { isAbortError } from "../llm/client.ts";
import type { ToolRegistry } from "../tools/registry.ts";
import { formatValidationErrors, validateArgs } from "../tools/registry.ts";
import type { SubagentRequest, Tool, ToolContext, ToolResult } from "../tools/types.ts";
import type { Permissions } from "../permission.ts";
import {
  compactHistory,
  estimateMessagesTokens,
  fitContext,
} from "./context.ts";
import { runPostToolHook, runPreToolHook } from "./hooks.ts";
import { estimateTokens, nowIso, oneLine, truncateMiddle } from "../util.ts";

/**
 * UI 接口：主循环只管“发生了什么”，不关心怎么显示。
 *
 * 这样设计的好处：
 *  - 终端 UI（ui/renderer.ts）实现它
 *  - 测试里的静默 UI 也实现它
 *  - 将来换成网页 UI，主循环一行都不用改
 */
export interface AgentUI {
  assistantStart(): void;
  assistantText(delta: string): void;
  assistantThinking(delta: string): void;
  assistantEnd(): void;
  toolStart(name: string, argsPreview: string): void;
  toolEnd(result: ToolResult, durationMs: number): void;
  info(message: string): void;
  notice(message: string): void;
  error(message: string): void;
}

/**
 * 会话持久化接口（由 session.ts 实现，测试里可以传 undefined）。
 *
 * 注意只有 persistMessage（只落盘、不碰内存历史）——
 * 历史数组的所有权在主循环，否则两边都 push 会出现重复消息。
 * appendSnapshot 用于“压缩后重写历史”的场景：JSONL 是追加写，
 * 用一条 snapshot 行表达“从这里开始，历史以这份快照为准”。
 */
export interface SessionSink {
  persistMessage(message: ChatMessage): void;
  appendEvent(event: Record<string, unknown>): void;
  appendSnapshot?(messages: ChatMessage[]): void;
}

/**
 * 结构化 trace 事件。
 *
 * AgentUI 负责“给人看”的流式渲染；trace 负责“给机器看”的结构化记录
 * （Web UI 的步骤时间线、会话事件日志、可观测性分析都靠它）。
 * 二者刻意分开：UI 可以随便换，trace 的字段保持稳定。
 */
export type TraceEvent =
  | {
      type: "step_start";
      step: number;
      historyMessages: number;
      contextTokens: number;
      budget: number;
      tools: string[];
    }
  | { type: "context"; removed: number; truncatedToolOutputs: number; tokens: number; budget: number }
  | { type: "compaction"; before: number; after: number; summary: string }
  | {
      type: "assistant_message";
      content: string;
      toolCalls: Array<{ id: string; name: string; arguments: string }>;
    };

export interface AgentRunOptions {
  provider: LLMProvider;
  registry: ToolRegistry;
  /** 系统提示词。 */
  system: string;
  /** 对话历史。注意：这个数组会被**原地修改**（push 新消息），这是有意为之。 */
  history: ChatMessage[];
  /** 工作目录，传给工具做路径边界检查。 */
  cwd: string;
  /** 单回合最多几次模型请求；0 表示不限（默认）。 */
  maxSteps: number;
  /** 单回合最多多少次工具调用；0/不传表示不限。 */
  maxToolCalls?: number;
  /** 重复调用熔断（默认开）：连续 3 次相同工具+参数提示卡死。它不是步数上限。 */
  repeatGuard?: boolean;
  contextBudget: number;
  /** 推理强度，透传给 provider（default 时不发该参数）。 */
  reasoningEffort?: string;
  permissions: Permissions;
  ui: AgentUI;
  signal: AbortSignal;
  session?: SessionSink;
  /** 工具之间共享的会话状态（todo 清单等）。 */
  toolState?: Record<string, unknown>;
  /** 工具改动 toolState 后的落盘回调（由 main / web 注入，接到 Session 上）。 */
  onToolStateChange?: (state: Record<string, unknown>) => void;
  /** 子 Agent 执行器（由 main 注入，避免 loop → task → loop 的循环依赖）。 */
  spawnSubagent?: (request: SubagentRequest) => Promise<string>;
  /** 可选的结构化 trace 回调（Web UI / 会话记录用）。 */
  trace?: (event: TraceEvent) => void;
}

export interface AgentRunResult {
  steps: number;
  usage: Usage;
  aborted: boolean;
  /** 是否因为达到最大步数而停下（通常意味着任务没完成）。 */
  hitStepLimit: boolean;
  /** 被权限系统拒绝的工具调用次数（run 模式据此判断任务是否被挡住）。 */
  toolDenials: number;
  /** 停止原因（completed / step_limit / tool_limit / repeat / aborted）。 */
  stopReason?: "completed" | "step_limit" | "tool_limit" | "repeat" | "aborted";
}

/** 从任意异常里安全地取出 message。 */
function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** 累加 usage（有些 provider 会分多次给）。 */
function addUsage(total: Usage, delta: Usage): void {
  total.prompt_tokens = (total.prompt_tokens ?? 0) + (delta.prompt_tokens ?? 0);
  if (delta.prompt_cache_hit_tokens !== undefined || total.prompt_cache_hit_tokens !== undefined) {
    total.prompt_cache_hit_tokens = (total.prompt_cache_hit_tokens ?? 0) + (delta.prompt_cache_hit_tokens ?? 0);
  }
  if (delta.prompt_cache_miss_tokens !== undefined || total.prompt_cache_miss_tokens !== undefined) {
    total.prompt_cache_miss_tokens = (total.prompt_cache_miss_tokens ?? 0) + (delta.prompt_cache_miss_tokens ?? 0);
  }
  total.completion_tokens = (total.completion_tokens ?? 0) + (delta.completion_tokens ?? 0);
  total.total_tokens = (total.total_tokens ?? 0) + (delta.total_tokens ?? 0);
}

/** 收集本轮的工具调用（按 id 去重合并，兼容分片到达的情况）。 */
class ToolCallCollector {
  private calls = new Map<string, ToolCall>();

  add(calls: ToolCall[]): void {
    for (const call of calls) {
      const key = call.id || `${call.function.name}-${this.calls.size}`;
      const existing = this.calls.get(key);
      if (existing) {
        existing.function.arguments += call.function.arguments;
      } else {
        this.calls.set(key, { ...call, function: { ...call.function } });
      }
    }
  }

  list(): ToolCall[] {
    return [...this.calls.values()];
  }
}

/**
 * 运行 Agent，直到任务完成 / 达到步数上限 / 被中断。
 */
export async function runAgent(options: AgentRunOptions): Promise<AgentRunResult> {
  const {
    provider,
    registry,
    system,
    history,
    maxSteps,
    maxToolCalls,
    contextBudget,
    reasoningEffort,
    permissions,
    ui,
    signal,
  } = options;
  const trace = options.trace;

  const usage: Usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const toolState = options.toolState ?? {};
  const toolCtx: ToolContext = {
    cwd: options.cwd,
    signal,
    state: toolState,
    spawnSubagent: options.spawnSubagent,
    onStateChange: options.onToolStateChange,
  };
  const toolDefinitions = registry.toDefinitions();

  // 预算必须把 system 提示词也算进去：它是每次请求都要发的，而且动辄几百 token。
  // （之前的实现只算 history，导致 --budget 很小时 system 已经超了却毫无提示。）
  const systemTokens = estimateTokens(system) + 4;
  const historyBudget = Math.max(256, contextBudget - systemTokens);
  if (systemTokens > contextBudget) {
    ui.notice(
      `系统提示词本身约 ${systemTokens} tokens，已经超过预算 ${contextBudget}；` +
        `无法再裁剪，请用 --budget 调大预算。`,
    );
  }

  // 默认不限步数/工具数（对齐 Claude Code 交互与 Codex 的行为）。
  // 需要无人值守时，调用方可以传 maxSteps / maxToolCalls 做硬上限（CI、脚本、批处理）。
  // 重复熔断和用户 Stop 是“卡死/失控”的安全阀，不是数量上限。
  const stepLimit = maxSteps > 0 ? maxSteps : Number.POSITIVE_INFINITY;
  const toolCallLimit =
    options.maxToolCalls && options.maxToolCalls > 0
      ? options.maxToolCalls
      : Number.POSITIVE_INFINITY;
  const repeatGuard = options.repeatGuard ?? true;

  let steps = 0;
  let toolDenials = 0;
  let warnedOverBudget = false;
  let toolCallCount = 0;
  let stopReason: "step_limit" | "tool_limit" | "repeat" | undefined;
  let lastToolSignature = "";
  let sameToolStreak = 0;
  const onDenied = () => {
    toolDenials++;
  };

  runLoop: for (let step = 1; step <= stepLimit; step++) {
    steps = step;

    // 不限步数时，每 25 步非阻塞提醒一次用量（有感知，但不打断）
    if (maxSteps === 0 && step > 1 && step % 25 === 0) {
      ui.notice(
        `已运行 ${step} 步，累计约 ${usage.total_tokens?.toLocaleString?.("en-US") ?? usage.total_tokens ?? 0} tokens；` +
          "随时可以 Stop 或 Ctrl+C。",
      );
    }

    // ---------------------------------------------------------------
    // 0. 用户中断检查
    // ---------------------------------------------------------------
    if (signal.aborted) {
      return { steps: steps - 1, usage, aborted: true, hitStepLimit: false, toolDenials };
    }

    // ---------------------------------------------------------------
    // 1. 上下文管理：先尝试 LLM 摘要压缩，再退化为裁剪
    // ---------------------------------------------------------------
    const rawTokens = estimateMessagesTokens(history);
    if (rawTokens + systemTokens > contextBudget && history.length >= 8) {
      try {
        const compacted = await compactHistory({
          messages: history,
          provider,
          signal,
          keepRecent: 4,
        });
        history.splice(0, history.length, ...compacted.messages);
        // 压缩改变了历史，必须落一条快照，否则恢复会话时会读回压缩前的旧消息
        options.session?.appendSnapshot?.(history);
        options.session?.appendEvent({
          type: "compaction",
          before: compacted.before,
          after: compacted.after,
          summary: compacted.summary,
          at: nowIso(),
        });
        trace?.({
          type: "compaction",
          before: compacted.before,
          after: compacted.after,
          summary: compacted.summary,
        });
        ui.notice(
          `上下文已自动压缩：约 ${compacted.before} → ${compacted.after} tokens（旧历史变成一段摘要）`,
        );
      } catch (err) {
        if (signal.aborted || isAbortError(err)) {
          return { steps: steps - 1, usage, aborted: true, hitStepLimit: false, toolDenials };
        }
        // 压缩失败不是致命错误：裁剪还能兜底
        ui.notice(`自动压缩失败（${messageOf(err)}），将使用裁剪后的上下文继续。`);
      }
    }

    const fitted = fitContext(history, historyBudget);
    if (fitted.removed > 0 || fitted.truncatedToolOutputs > 0) {
      const parts: string[] = [];
      if (fitted.removed > 0) parts.push(`移除 ${fitted.removed} 条最早的消息`);
      if (fitted.truncatedToolOutputs > 0) parts.push(`截断 ${fitted.truncatedToolOutputs} 条过长的工具输出`);
      trace?.({
        type: "context",
        removed: fitted.removed,
        truncatedToolOutputs: fitted.truncatedToolOutputs,
        tokens: fitted.tokens + systemTokens,
        budget: contextBudget,
      });
      ui.notice(`上下文裁剪：${parts.join("，")}（当前约 ${fitted.tokens} tokens）`);
    } else if (
      !warnedOverBudget &&
      systemTokens <= contextBudget &&
      fitted.tokens + systemTokens > contextBudget
    ) {
      // 历史已经只剩最后一条 user，没东西可删了，但总预算还是超——如实告诉用户（每回合只提醒一次）
      warnedOverBudget = true;
      ui.notice(
        `上下文超出预算（历史约 ${fitted.tokens} + 系统约 ${systemTokens} tokens > ${contextBudget}），` +
          `但没有可裁剪的历史了。可以用 /compact 或调大 --budget。`,
      );
    }
    const promptMessages = fitted.messages;

    trace?.({
      type: "step_start",
      step,
      historyMessages: promptMessages.length,
      contextTokens: fitted.tokens + systemTokens,
      budget: contextBudget,
      tools: registry.names,
    });

    // ---------------------------------------------------------------
    // 2. 调模型（流式）
    // ---------------------------------------------------------------
    ui.assistantStart();
    let text = "";
    const toolCalls = new ToolCallCollector();

    try {
      for await (const event of provider.stream(
        [{ role: "system", content: system }, ...promptMessages],
        { tools: toolDefinitions, signal, reasoningEffort },
      )) {
        switch (event.type) {
          case "text":
            text += event.text;
            ui.assistantText(event.text);
            break;
          case "thinking":
            // 推理模型的思考过程只显示，不进入正式历史
            ui.assistantThinking(event.text);
            break;
          case "tool_calls":
            toolCalls.add(event.toolCalls);
            break;
          case "usage":
            addUsage(usage, event.usage);
            break;
          case "done":
            break;
        }
      }
    } catch (err) {
      ui.assistantEnd();

      // 用户中断：保留已经生成的部分文本，方便接着聊
      if (signal.aborted || isAbortError(err)) {
        if (text.trim()) {
          const partial: ChatMessage = {
            role: "assistant",
            content: text + "\n\n[本回合被用户中断]",
          };
          history.push(partial);
          options.session?.persistMessage(partial);
        }
        return { steps, usage, aborted: true, hitStepLimit: false, toolDenials };
      }
      // 其他错误（网络、鉴权、限流）抛给上层处理
      throw err;
    }

    ui.assistantEnd();

    // ---------------------------------------------------------------
    // 3. 把模型回复写进历史
    // ---------------------------------------------------------------
    const calls = toolCalls.list();
    const assistantMessage: ChatMessage = {
      role: "assistant",
      // 只调工具不说话时，content 必须是 null 或 ""（OpenAI 协议要求）
      content: text.length > 0 ? text : null,
    };
    if (calls.length > 0) assistantMessage.tool_calls = calls;

    history.push(assistantMessage);
    options.session?.persistMessage(assistantMessage);
    trace?.({
      type: "assistant_message",
      content: text,
      toolCalls: calls.map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments,
      })),
    });

    // 没有工具调用 = 模型认为任务完成，循环结束
    if (calls.length === 0) {
      return { steps, usage, aborted: false, hitStepLimit: false, toolDenials, stopReason: "completed" };
    }

    // ---------------------------------------------------------------
    // 4. 依次执行工具，把结果写回历史
    // ---------------------------------------------------------------
    for (let index = 0; index < calls.length; index++) {
      const call = calls[index]!;

      // 熔断（默认开）：连续 3 次完全相同的工具+参数 → 大概率卡住了，停下来让模型总结
      const signature = `${call.function.name}:${call.function.arguments}`;
      sameToolStreak = signature === lastToolSignature ? sameToolStreak + 1 : 1;
      lastToolSignature = signature;
      if (repeatGuard && sameToolStreak >= 3) {
        stopReason = "repeat";
        for (const skipped of calls.slice(index)) {
          appendSkippedToolResult(skipped, { history, session: options.session, ui }, "重复调用熔断");
        }
        break runLoop;
      }

      // 可选硬上限：工具调用总次数（默认 Infinity，不触发）
      if (toolCallCount >= toolCallLimit) {
        stopReason = "tool_limit";
        for (const skipped of calls.slice(index)) {
          appendSkippedToolResult(skipped, { history, session: options.session, ui }, "工具调用上限");
        }
        break runLoop;
      }
      toolCallCount++;

      if (signal.aborted) {
        // 中断时不能直接 return：assistant 消息里声明了 N 个 tool_call，
        // 就必须有 N 条 tool 消息回应，否则下次把这个历史发给真实接口会 400。
        // 所以给所有“还没来得及执行”的调用补一条“被中断”的结果。
        for (const pendingCall of calls.slice(index)) {
          appendInterruptedToolResult(pendingCall, {
            history,
            session: options.session,
          });
        }
        return { steps, usage, aborted: true, hitStepLimit: false, toolDenials };
      }
      await executeToolCall(call, {
        registry,
        toolCtx,
        permissions,
        ui,
        history,
        session: options.session,
        onDenied,
      });
    }
    // 回到循环开头，让模型看工具结果继续推理
  }

  // 循环结束但没等到“模型认为完成”：可能是步数用尽，也可能是被熔断
  if (!stopReason) stopReason = "step_limit";

  const reasonText =
    stopReason === "step_limit"
      ? `步数上限（${maxSteps}）`
      : stopReason === "tool_limit"
        ? `工具调用上限（${toolCallLimit} 次）`
        : "重复调用熔断（连续 3 次相同的工具+参数）";

  // 关键体验：不要冷冰冰地停掉——再请模型做一次“不调工具”的收尾总结，
  // 告诉用户改了什么、还剩什么。这是 Claude Code 类工具常见的 graceful stop。
  await finalizeTurn({
    provider,
    system,
    history,
    signal,
    ui,
    session: options.session,
    reason: reasonText,
  });

  ui.notice(
    `本回合已暂停：${reasonText}。已让模型给出进度小结；你可以继续发消息接着做，` +
      `或用 --max-steps / --max-tool-calls 调大上限。`,
  );
  return { steps, usage, aborted: false, hitStepLimit: true, toolDenials, stopReason };
}

/**
 * 回合被硬性上限暂停时的“收尾总结”。
 *
 * 做法：追加一条 [系统] 用户消息，让模型**不带工具**再请求一次，只要文本总结。
 * 注意：只有真的拿到文本才把这轮消息写进历史，避免留下没有回复的孤儿消息。
 */
async function finalizeTurn(deps: {
  provider: LLMProvider;
  system: string;
  history: ChatMessage[];
  signal: AbortSignal;
  ui: AgentUI;
  session?: SessionSink;
  reason: string;
}): Promise<void> {
  if (deps.signal.aborted) return;

  const note: ChatMessage = {
    role: "user",
    content:
      `[系统] 本回合因为「${deps.reason}」暂停了。请不要再调用任何工具，` +
      "用简短中文总结：已经完成了什么、修改了哪些文件、还有什么没做、下一步建议。",
  };
  const request: ChatMessage[] = [
    { role: "system", content: deps.system },
    ...deps.history,
    note,
  ];

  let text = "";
  deps.ui.assistantStart();
  try {
    for await (const event of deps.provider.stream(request, { signal: deps.signal })) {
      if (event.type === "text") {
        text += event.text;
        deps.ui.assistantText(event.text);
      }
    }
  } catch {
    // 收尾失败不影响主流程；用户仍能看到“已暂停”的说明
  } finally {
    deps.ui.assistantEnd();
  }

  if (!text.trim()) return;
  const message: ChatMessage = { role: "assistant", content: text };
  deps.history.push(message);
  deps.session?.persistMessage(message);
  deps.session?.appendEvent({ type: "finalize", reason: deps.reason, at: nowIso() });
}

/**
 * 用户中断时，给一个没有执行的 tool_call 补一条“被中断”的 tool 消息。
 *
 * 为什么必须补？协议要求每个 tool_call 都有对应的 tool 消息。
 * 少一条，这份历史就永远无法再发给模型（真实接口直接 400），
 * 用 --session 恢复后也会废掉。
 */
/** 因熔断/上限跳过执行的 tool_call：补一条“未执行”的 tool 消息，保证协议完整。 */
function appendSkippedToolResult(
  call: ToolCall,
  deps: { history: ChatMessage[]; session?: SessionSink; ui?: AgentUI },
  reason: string,
): void {
  const result: ToolResult = {
    title: call.function.name,
    output: `[系统暂停：${reason}，这个工具没有执行]`,
    isError: true,
  };
  deps.ui?.toolStart(call.function.name, "(已暂停，未执行)");
  deps.ui?.toolEnd(result, 0);

  const message: ChatMessage = {
    role: "tool",
    tool_call_id: call.id,
    name: call.function.name,
    content: `[系统暂停：${reason}，这个工具没有执行]`,
  };
  deps.history.push(message);
  deps.session?.persistMessage(message);
  deps.session?.appendEvent({
    type: "tool",
    name: call.function.name,
    skipped: true,
    reason,
    at: nowIso(),
  });
}

function appendInterruptedToolResult(
  call: ToolCall,
  deps: { history: ChatMessage[]; session?: SessionSink },
): void {
  const message: ChatMessage = {
    role: "tool",
    tool_call_id: call.id,
    name: call.function.name,
    content: "[用户中断：这个工具没有执行]",
  };
  deps.history.push(message);
  deps.session?.persistMessage(message);
  deps.session?.appendEvent({
    type: "tool",
    name: call.function.name,
    interrupted: true,
    at: nowIso(),
  });
}

/** 执行一次工具调用，并把结果写进历史。 */
async function executeToolCall(
  call: ToolCall,
  deps: {
    registry: ToolRegistry;
    toolCtx: ToolContext;
    permissions: Permissions;
    ui: AgentUI;
    history: ChatMessage[];
    session?: SessionSink;
    onDenied?: () => void;
  },
): Promise<void> {
  const name = call.function.name;
  const startedAt = Date.now();

  deps.ui.toolStart(name, oneLine(call.function.arguments));

  const preHook = await runPreToolHook(name, call.function.arguments, deps.toolCtx.cwd);
  const result = preHook.blocked
    ? { title: `${name}（hook 阻止）`, output: preHook.output, isError: true }
    : await runToolSafely(call, deps);
  const postOutput = await runPostToolHook(name, call.function.arguments, deps.toolCtx.cwd);
  if (postOutput) deps.ui.notice(postOutput);
  const durationMs = Date.now() - startedAt;

  deps.ui.toolEnd(result, durationMs);

  // 无论成功失败，都必须给模型一条 tool 消息（协议要求每个 tool_call 都有回应）
  const toolMessage: ChatMessage = {
    role: "tool",
    tool_call_id: call.id,
    name,
    content: result.output,
  };
  deps.history.push(toolMessage);
  deps.session?.persistMessage(toolMessage);
  deps.session?.appendEvent({
    type: "tool",
    name,
    arguments: call.function.arguments,
    isError: result.isError ?? false,
    durationMs,
    at: nowIso(),
  });
}

/**
 * 把“可能出错的工具执行”包成一个永不抛异常的流程。
 *
 * 这里是 Agent 鲁棒性的关键：工具层的一切失败都要变成
 * “一条模型能看懂的 tool 消息”，而不是让整个程序崩掉。
 */
async function runToolSafely(
  call: ToolCall,
  deps: {
    registry: ToolRegistry;
    toolCtx: ToolContext;
    permissions: Permissions;
    onDenied?: () => void;
  },
): Promise<ToolResult> {
  const name = call.function.name;

  // (1) 未知工具：告诉模型有哪些工具可用
  const tool = deps.registry.get(name);
  if (!tool) {
    return {
      title: name,
      output:
        `没有名为 "${name}" 的工具。当前可用工具：${deps.registry.names.join(", ")}。` +
        "请从这些工具里选择，并注意工具名的大小写。",
      isError: true,
    };
  }

  // (2) JSON 解析：模型写坏 JSON 是家常便饭
  const rawArguments = call.function.arguments?.trim() ? call.function.arguments : "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments);
  } catch (err) {
    return {
      title: name,
      output:
        `工具参数不是合法的 JSON：${messageOf(err)}\n` +
        `你给的原始参数：${truncateMiddle(rawArguments, 400)}\n` +
        "请重新生成合法的 JSON 参数（注意引号转义、不要有尾逗号）。",
      isError: true,
    };
  }

  // (3) schema 校验：给出具体哪个字段错了
  const validation = validateArgs(tool.parameters, parsed);
  if (!validation.ok) {
    return {
      title: name,
      output: formatValidationErrors(validation.errors),
      isError: true,
    };
  }

  // (4) 权限：可能弹窗问用户，也可能直接拒绝
  const permission = await deps.permissions.check(tool, validation.value);
  if (!permission.allowed) {
    deps.onDenied?.();
    return {
      title: name,
      output:
        `权限系统拒绝了这次 ${name} 调用：${permission.reason}\n` +
        "不要尝试绕过权限系统；可以换一种不需要该权限的方式，或者向用户说明你需要什么权限。",
      isError: true,
    };
  }

  // (5) 真正执行
  try {
    return await tool.execute(validation.value, deps.toolCtx);
  } catch (err) {
    return {
      title: name,
      output: `工具执行过程中出错：${messageOf(err)}`,
      isError: true,
    };
  }
}
