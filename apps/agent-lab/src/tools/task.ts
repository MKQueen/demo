/**
 * ============================================================================
 * task 工具：子 Agent（Subagent）
 * ============================================================================
 *
 * 一个 Agent 在解决复杂任务时，经常需要“派一个小弟去调研”。
 * 比如：“这个项目里权限系统是怎么实现的？”——它可能需要读十几个文件，
 * 但主 Agent 并不想把这些文件的全文都塞进自己的上下文。
 *
 * 子 Agent 的玩法：
 *   主 Agent 调用 task(description, prompt)
 *     → 程序启动一个**全新的 Agent 循环**
 *         · 全新的上下文（不污染主上下文）
 *         · 受限的工具集（只读：read/glob/grep）
 *         · 独立的最大步数
 *     → 子 Agent 跑完后，只把**一段总结**返回给主 Agent
 *
 * 这就是“上下文隔离子 Agent”的核心思想。
 * 真实 opencode 有 general / explore 等子 agent，Claude Code 有 Task tool，
 * 本质都是这个模式。
 *
 * 注意：这个工具本身不实现子 Agent，它通过 ctx.spawnSubagent 回调调用。
 * 为什么？避免循环依赖：loop → task 工具 → loop。用依赖注入就干净了。
 */
import type { Tool } from "./types.ts";
import { errorResult } from "./types.ts";

export const taskTool: Tool = {
  name: "task",
  description:
    "启动一个子 Agent 去做调研/搜索。子 Agent 有独立的上下文和只读工具（read/glob/grep），" +
    "不会修改文件。适合回答“这个项目里 X 是怎么实现的”这类需要翻很多文件的问题。" +
    "把你希望它回答的问题写清楚，它会返回一段总结。",
  category: "read",
  parameters: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "用 3-6 个词概括这次调研任务，用于 UI 显示，例如“调研权限系统”",
        minLength: 1,
      },
      prompt: {
        type: "string",
        description: "完整的任务描述，要具体：要找什么、关注哪些文件、希望回答什么",
        minLength: 1,
      },
    },
    required: ["description", "prompt"],
    additionalProperties: false,
  },

  async execute(args, ctx) {
    const description = String(args.description ?? "").trim();
    const prompt = String(args.prompt ?? "").trim();

    if (!description || !prompt) {
      return errorResult("task", "description 和 prompt 都不能为空");
    }
    if (!ctx.spawnSubagent) {
      return errorResult("task", "当前运行环境没有提供子 Agent 能力。");
    }

    const result = await ctx.spawnSubagent({ description, prompt });
    return {
      title: `子 Agent · ${description}`,
      output: result,
    };
  },
};
