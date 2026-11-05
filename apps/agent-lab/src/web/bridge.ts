/**
 * Web UI 的事件桥。
 *
 * Agent 主循环只认 `AgentUI` 接口（assistantStart / toolStart / ...），
 * 这个类把它翻译成结构化事件，通过 SSE 推给浏览器。
 *
 * 这样做的好处：主循环完全不知道自己被 CLI 还是 Web 驱动；
 * 想换成桌面端、日志系统、录屏工具，只需要再实现一个 AgentUI。
 */
import type { AgentUI, TraceEvent } from "../agent/loop.ts";
import type { ToolResult } from "../tools/types.ts";

export type EmitFn = (type: string, data?: Record<string, unknown>) => void;

export class WebBridge implements AgentUI {
  private emit: EmitFn;
  /** toolEnd 只给 ToolResult，没有工具名；按顺序记录最近一次 toolStart 的名字。 */
  private currentToolName = "";

  constructor(emit: EmitFn) {
    this.emit = emit;
  }

  assistantStart(): void {
    this.emit("assistant_start");
  }

  assistantText(delta: string): void {
    this.emit("assistant_delta", { text: delta });
  }

  assistantThinking(delta: string): void {
    this.emit("thinking_delta", { text: delta });
  }

  assistantEnd(): void {
    this.emit("assistant_end");
  }

  toolStart(name: string, argsPreview: string): void {
    this.currentToolName = name;
    this.emit("tool_start", { name, argsPreview });
  }

  toolEnd(result: ToolResult, durationMs: number): void {
    this.emit("tool_end", {
      name: this.currentToolName,
      title: result.title,
      output: result.output,
      isError: result.isError ?? false,
      durationMs,
    });
  }

  info(message: string): void {
    this.emit("info", { message });
  }

  notice(message: string): void {
    this.emit("notice", { message });
  }

  error(message: string): void {
    this.emit("error", { message });
  }
}

/** trace 事件转 SSE 事件的辅助函数（字段原样透传，便于前端/日志消费）。 */
export function emitTrace(emit: EmitFn, event: TraceEvent): void {
  emit("trace", event);
}
