/**
 * ============================================================================
 * 子 Agent：用“分头调研”换更干净的上下文
 * ============================================================================
 *
 * 场景：用户问“这个项目的权限系统怎么实现的？”
 *
 * 方案 A（笨办法）：主 Agent 自己 grep → read 10 个文件 → 上下文塞满 3 万 token，
 *                   然后它还得继续做别的事，很快就爆了。
 *
 * 方案 B（子 Agent）：主 Agent 调 task("调研权限系统", "去找...并回答...")，
 *                  子 Agent 在自己的上下文里翻 10 个文件，
 *                  只把 300 字结论返回给主 Agent。
 *
 * 这就是“上下文隔离”。主 Agent 的上下文只增加 300 字，而不是 3 万字。
 *
 * 三个关键设计（和真实 opencode / Claude Code 一致）：
 *  1. 子 Agent 的上下文是**全新**的，不带主 Agent 的历史
 *  2. 子 Agent 只能用**只读工具**，防止它偷偷改文件
 *  3. 子 Agent 的最终输出必须是一段**可被主 Agent 直接使用的总结**
 */
import type { ChatMessage, LLMProvider } from "../llm/types.ts";
import { contentToText } from "../llm/content.ts";
import type { ToolRegistry } from "../tools/registry.ts";
import type { Permissions } from "../permission.ts";
import type { AgentUI } from "./loop.ts";
import { runAgent } from "./loop.ts";
import { buildSubagentSystemPrompt } from "./prompt.ts";

/** 子 Agent 只能用的工具（只读三件套）。 */
const READ_ONLY_TOOL_NAMES = ["read", "glob", "grep"];

export interface SubagentOptions {
  provider: LLMProvider;
  /** 父 Agent 的注册表，我们会从中筛出只读工具。 */
  parentRegistry: ToolRegistry;
  cwd: string;
  contextBudget: number;
  permissions: Permissions;
  signal: AbortSignal;
  description: string;
  prompt: string;
  maxSteps?: number;
}

/** 静默 UI：子 Agent 的执行过程不刷屏，只留最后结论。 */
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

/**
 * 启动一个子 Agent 并等待它返回结论。
 */
export async function spawnSubagent(options: SubagentOptions): Promise<string> {
  const registry = options.parentRegistry.filterBy(READ_ONLY_TOOL_NAMES);

  if (registry.all().length === 0) {
    return "（父 Agent 没有提供只读工具，子 Agent 无法工作）";
  }

  // 全新的对话历史：只有一条 user 消息。这是“上下文隔离”的关键。
  const history: ChatMessage[] = [{ role: "user", content: options.prompt }];

  const result = await runAgent({
    provider: options.provider,
    registry,
    system: buildSubagentSystemPrompt({
      cwd: options.cwd,
      description: options.description,
    }),
    history,
    cwd: options.cwd,
    maxSteps: options.maxSteps ?? 10,
    // 子 Agent 的预算要小于主 Agent，避免它自己又爆上下文；
    // 但 16K 太小（读几个文件就到线），64K 足够它翻完一个模块再总结。
    contextBudget: Math.min(options.contextBudget, 64_000),
    permissions: options.permissions,
    ui: silentUI(),
    signal: options.signal,
    // 不给子 Agent 会话记录、也不允许它再派子 Agent（防止无限递归）
    session: undefined,
    toolState: {},
    spawnSubagent: undefined,
  });

  // 从子 Agent 的历史里找出最后一条 assistant 文本，就是它的结论
  const last = [...history]
    .reverse()
    .find((message) => message.role === "assistant" && contentToText(message.content).trim());

  const text = contentToText(last?.content).trim();
  if (!text) return "（子 Agent 没有得出结论）";
  return result.aborted ? `${text}\n（子 Agent 被中断）` : text;
}
