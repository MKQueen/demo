/**
 * 内置工具清单。
 *
 * 这个函数决定“Agent 手里有什么工具”，CLI 和 Web 服务器共用同一份。
 *
 * 注意 build / plan 两种模式的工具集不同：
 *  - build：读 + 写 + 执行，能真正干活
 *  - plan ：只读（read/glob/grep）+ todowrite + task，不能改文件、不能跑 bash
 *
 * 这是“提示词约束 + 工具注册约束”的双保险：plan 模式下即使模型想改文件，
 * 它手里也没有 write/edit/bash 这些工具。
 */
import { ToolRegistry } from "./registry.ts";
import { editTool, globTool, grepTool, readTool, writeTool } from "./files.ts";
import { bashTool } from "./bash.ts";
import { todoWriteTool } from "./todo.ts";
import { taskTool } from "./task.ts";
import { registerCachedMcpTools } from "./mcp.ts";
import { webfetchTool } from "./webfetch.ts";
import { skillTool } from "./skills.ts";
import { rewindTool } from "./checkpoint.ts";

export type AgentMode = "build" | "plan";

export function buildRegistry(mode: AgentMode): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(readTool).register(globTool).register(grepTool).register(webfetchTool).register(skillTool);
  if (mode === "build") {
    registry.register(writeTool).register(editTool).register(bashTool).register(rewindTool);
  }
  registry.register(todoWriteTool).register(taskTool);

  // MCP：把外部 server 的工具挂进来（`mcp__<server>__<tool>`）。
  //
  // 这里故意做成“同步读模块级缓存”，而不是 async 现场加载，原因有两个：
  //   1. buildRegistry 是同步 API，CLI / Web / 子 Agent 到处都在调；
  //   2. 加载子进程很慢，每回合重连一遍会让 Agent 明显卡顿。
  // 真正的加载由 ensureMcp(cwd) 负责（CLI 每回合 run 前、Web 服务按 hook 调用），
  // 缓存为空时这一行什么也不做——所以没配 MCP 的项目完全无感。
  registerCachedMcpTools(registry, mode);
  return registry;
}

/** 工具名 → 一句人话简介（给 UI 的“能力清单”用）。 */
export const TOOL_SUMMARY: Record<string, string> = {
  read: "读取文件内容（带行号、可分段）",
  write: "创建/覆盖文件",
  edit: "精确字符串替换（改代码主力）",
  glob: "按模式找文件",
  grep: "按内容正则搜索",
  bash: "执行 shell 命令（超时/进程组/环境变量清洗）",
  todowrite: "维护待办清单（Agent 的工作记忆）",
  task: "派子 Agent 做只读调研（上下文隔离）",
  webfetch: "抓取公开网页并转成纯文本",
  skill: "按需读取项目技能说明",
  rewind: "回退最近一次文件 checkpoint",
};
