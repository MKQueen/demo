/**
 * ============================================================================
 * todo 工具：Agent 的“工作记忆”
 * ============================================================================
 *
 * 这是个小巧但很能说明问题的工具：
 * 它**不改变磁盘上的任何东西**，只改变 Agent 自己的状态。
 *
 * 为什么模型需要它？
 * 大任务跑十几步之后，早期计划会被挤到上下文远处，模型容易忘。
 * 把计划写成结构化清单、每步更新，相当于给 Agent 一个“外部白板”。
 * 真实 opencode 也有 todowrite，思路完全一样。
 */
import type { Tool } from "./types.ts";
import { errorResult } from "./types.ts";

export type TodoStatus = "pending" | "in_progress" | "completed";

export interface TodoItem {
  content: string;
  status: TodoStatus;
}

/** 从会话共享状态里读 todo（供 /todos 命令和 UI 使用）。 */
export function getTodos(state: Record<string, unknown>): TodoItem[] {
  const value = state.todos;
  return Array.isArray(value) ? (value as TodoItem[]) : [];
}

const STATUS_MARK: Record<TodoStatus, string> = {
  pending: "[ ]",
  in_progress: "[~]",
  completed: "[x]",
};

export const todoWriteTool: Tool = {
  name: "todowrite",
  description:
    "创建/更新当前任务的待办清单。做多步骤复杂任务时先拆解成清单，" +
    "每完成一步就更新状态。每次调用要传**完整的**清单（不是增量）。",
  category: "read", // 只改内存状态，不碰文件，所以归为只读
  parameters: {
    type: "object",
    properties: {
      todos: {
        type: "array",
        description: "完整的待办清单",
        items: {
          type: "object",
          properties: {
            content: { type: "string", description: "任务内容，一句话" },
            status: {
              type: "string",
              enum: ["pending", "in_progress", "completed"],
              description: "pending=待办，in_progress=进行中（同一时间建议只有一个），completed=已完成",
            },
          },
          required: ["content", "status"],
          additionalProperties: false,
        },
      },
    },
    required: ["todos"],
    additionalProperties: false,
  },

  async execute(args, ctx) {
    const raw = args.todos;
    if (!Array.isArray(raw)) {
      return errorResult("todowrite", "todos 必须是数组");
    }

    const todos: TodoItem[] = raw.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        content: String(record.content ?? ""),
        status: (record.status as TodoStatus) ?? "pending",
      };
    });

    // 提示：同一时间不应该有多个进行中（这是真实 Agent 的常见约定）
    const inProgress = todos.filter((t) => t.status === "in_progress");
    if (inProgress.length > 1) {
      return errorResult(
        "todowrite",
        `同时有 ${inProgress.length} 个 in_progress 任务。请只保留一个进行中，其余改成 pending。`,
      );
    }

    ctx.state.todos = todos;
    // 通知宿主把这份清单落到会话文件里：
    // todo 是“这个会话做到哪了”的一部分，不落盘的话切会话就丢、重启就丢。
    ctx.onStateChange?.(ctx.state);

    if (todos.length === 0) {
      return { title: "更新待办", output: "待办清单已清空。" };
    }

    const lines = todos.map((todo, index) => `${STATUS_MARK[todo.status]} ${index + 1}. ${todo.content}`);
    const done = todos.filter((t) => t.status === "completed").length;
    return {
      title: `更新待办（${done}/${todos.length} 完成）`,
      output: lines.join("\n"),
    };
  },
};
