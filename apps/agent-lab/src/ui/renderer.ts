/**
 * ============================================================================
 * 终端渲染器
 * ============================================================================
 *
 * 它实现 agent/loop.ts 里的 AgentUI 接口，负责把 Agent 的运行过程画出来：
 *
 *   ❯ 帮我看一下这个项目            ← 用户输入
 *   ● 我先看看目录结构…             ← 模型流式输出（逐字打印）
 *   → bash ls -la                   ← 工具调用开始
 *   ✓ bash · ls -la (12ms)
 *     total 48 …                    ← 工具结果（截断显示）
 *   ● 这个项目是…                   ← 模型继续
 *   ↑ 1,234 / 567 tokens · 3 步 · 2.1s   ← 统计
 *
 * 流式渲染的一个小技巧：
 * 请求刚发出时先显示 “● 思考中…”，第一个字到达时用 \r + 清行把它擦掉，
 * 换成正式的 “● ”。这样等待期间不会一片死寂，也不会留下残影。
 */
import type { AgentUI } from "../agent/loop.ts";
import type { ToolResult } from "../tools/types.ts";
import { formatDuration, formatNumber } from "../util.ts";
import {
  bold,
  clearLine,
  cyan,
  dim,
  green,
  gray,
  magenta,
  red,
  symbols,
  yellow,
} from "./ansi.ts";

export interface BannerInfo {
  model: string;
  cwd: string;
  sessionId: string;
  mock: boolean;
  mode: string;
}

export class Renderer implements AgentUI {
  private interactive: boolean;
  /** 是否还在“思考中”占位状态。 */
  private pending = false;

  constructor(options: { interactive?: boolean } = {}) {
    this.interactive = options.interactive ?? process.stdout.isTTY === true;
  }

  /** 启动横幅。 */
  banner(info: BannerInfo): void {
    const lines = [
      "┌ mini-opencode · 手搓版",
      `│ model    ${info.model}${info.mock ? "  (mock 假模型，不联网)" : ""}`,
      `│ cwd      ${info.cwd}`,
      `│ mode     ${info.mode}    session ${info.sessionId}`,
      "└ /help 看命令 · Ctrl+C 中断当前回合",
    ];
    process.stdout.write("\n" + lines.map((line) => gray(line)).join("\n") + "\n");
  }

  userMessage(text: string): void {
    process.stdout.write(`\n${cyan(symbols.user)} ${text}\n`);
  }

  // ---- AgentUI 实现 ----

  assistantStart(): void {
    process.stdout.write("\n");
    if (this.interactive) {
      // 先占位，等第一个字到了再擦掉
      this.pending = true;
      process.stdout.write(cyan(symbols.assistant) + " " + dim("思考中…"));
    } else {
      process.stdout.write(cyan(symbols.assistant) + " ");
    }
  }

  assistantText(delta: string): void {
    if (this.pending) {
      process.stdout.write(clearLine());
      process.stdout.write(cyan(symbols.assistant) + " ");
      this.pending = false;
    }
    process.stdout.write(delta);
  }

  assistantThinking(delta: string): void {
    if (this.pending) {
      process.stdout.write(clearLine());
      process.stdout.write(cyan(symbols.assistant) + " ");
      this.pending = false;
    }
    // 思考过程用灰色，和正式回答区分开
    process.stdout.write(dim(delta));
  }

  assistantEnd(): void {
    if (this.pending) {
      process.stdout.write(clearLine());
      this.pending = false;
    }
    process.stdout.write("\n");
  }

  toolStart(name: string, argsPreview: string): void {
    process.stdout.write(
      `\n${dim(symbols.tool)} ${bold(name)} ${dim(argsPreview)}\n`,
    );
  }

  toolEnd(result: ToolResult, durationMs: number): void {
    const mark = result.isError ? red(symbols.fail) : green(symbols.ok);
    process.stdout.write(
      `${mark} ${dim(result.title)} ${dim(`· ${formatDuration(durationMs)}`)}\n`,
    );

    // 工具输出只显示前 12 行（完整内容在会话记录里）
    const lines = result.output.split("\n");
    const maxLines = 12;
    for (const line of lines.slice(0, maxLines)) {
      process.stdout.write(dim(`  ${line}`) + "\n");
    }
    if (lines.length > maxLines) {
      process.stdout.write(dim(`  …（还有 ${lines.length - maxLines} 行，已省略）`) + "\n");
    }
  }

  info(message: string): void {
    process.stdout.write(dim(`${symbols.info} ${message}`) + "\n");
  }

  notice(message: string): void {
    process.stdout.write(yellow(`${symbols.notice} ${message}`) + "\n");
  }

  error(message: string): void {
    process.stdout.write(red(`${symbols.fail} ${message}`) + "\n");
  }

  /** 每回合结束后的统计行。 */
  usage(stats: {
    promptTokens: number;
    completionTokens: number;
    steps: number;
    durationMs: number;
  }): void {
    process.stdout.write(
      dim(
        `↑ ${formatNumber(stats.promptTokens)} / ${formatNumber(stats.completionTokens)} tokens` +
          ` · ${stats.steps} 步 · ${formatDuration(stats.durationMs)}`,
      ) + "\n",
    );
  }

  /** 权限确认框的展示部分（读取用户输入在 ui/input.ts 里）。 */
  showApproval(toolName: string, detail: string, danger: string | null): void {
    process.stdout.write("\n");
    if (danger) {
      process.stdout.write(yellow(`${symbols.notice} 危险操作：${danger}`) + "\n");
    }
    process.stdout.write(magenta(`? 允许执行 ${toolName} 吗？`) + "\n");
    const lines = detail.split("\n");
    for (const line of lines.slice(0, 20)) {
      process.stdout.write(dim(`  ${line}`) + "\n");
    }
    if (lines.length > 20) {
      process.stdout.write(dim(`  …（参数太长，已省略 ${lines.length - 20} 行）`) + "\n");
    }
  }
}
