/**
 * 工具层的公共类型。
 *
 * 一个工具 = 名字 + 描述 + 参数 schema + 一个真正执行的函数。
 * 这三样东西里，前三个是给**模型**看的（它会读描述、按 schema 生成参数），
 * 最后一个是给**你的程序**用的（模型说“我要调用”，程序真的去干）。
 */
import type { JSONSchema } from "../llm/types.ts";

/**
 * 工具的危险等级。权限系统按这个等级给默认策略：
 *  - read ：只读（read/glob/grep），默认直接放行
 *  - write：改文件（write/edit），默认要用户确认
 *  - exec ：执行命令（bash），默认要用户确认
 *
 * 注意这只是“默认值”，真实 opencode 的权限是按工具名 + 通配符配置的，
 * 我们简化成按等级配置，更容易理解。
 */
export type ToolCategory = "read" | "write" | "exec";

/** 工具执行结果。注意 output 会被原样塞回对话历史，所以必须控制长度。 */
export interface ToolResult {
  /** 一句话标题，给 UI 显示，例如 `read src/main.ts`。 */
  title: string;
  /** 真正喂回给模型的内容。 */
  output: string;
  /** 是否失败。失败也会作为 tool 消息喂回去，模型会看到并尝试修正。 */
  isError?: boolean;
}

/** 子 Agent 请求（task 工具用）。 */
export interface SubagentRequest {
  description: string;
  prompt: string;
}

/**
 * 工具执行上下文。
 *
 * 工具不直接读全局变量（那样没法测试、也没法限制），
 * 所有它需要的外部能力都从这里注入：
 *  - cwd：工作目录边界
 *  - signal：取消信号
 *  - state：会话级共享状态（比如 todo 清单）
 *  - spawnSubagent：子 Agent 能力（由主循环注入，避免循环依赖）
 */
export interface ToolContext {
  cwd: string;
  signal: AbortSignal;
  state: Record<string, unknown>;
  spawnSubagent?: (request: SubagentRequest) => Promise<string>;
  /**
   * 工具改动了 `state` 之后，用它通知宿主“该存盘了”。
   *
   * 为什么要这个钩子？
   * `state` 是“会话级共享状态”（典型例子是 todo 清单），
   * 但工具本身不该知道会话文件长什么样 —— 那是 Session 的职责。
   * 所以这里只留一个回调：工具负责改，宿主负责存。
   *
   * 不接这个钩子也能跑（CLI 子 Agent 就不接），只是状态只在内存里，
   * 切会话/重启会丢。
   */
  onStateChange?: (state: Record<string, unknown>) => void;
}

/** 工具定义。 */
export interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  category: ToolCategory;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

/** 包装函数，纯粹为了获得类型提示（和 zod 的 defineTool 一个意思）。 */
export function defineTool(tool: Tool): Tool {
  return tool;
}

/** 快速构造一个失败结果。 */
export function errorResult(title: string, message: string): ToolResult {
  return { title, output: message, isError: true };
}
