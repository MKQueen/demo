#!/usr/bin/env node
/**
 * ============================================================================
 * 入口 + 交互式 REPL + 命令分发
 * ============================================================================
 *
 * 这个文件是“总装车间”：把前面所有零件接起来。
 *
 *   配置(config) + 模型(llm) + 工具(tools) + 主循环(agent/loop)
 *   + 权限(permission) + 会话(session) + 界面(ui)
 *
 * 接线顺序很重要（也是真实 Agent 的启动顺序）：
 *   1. 解析命令行参数
 *   2. 读 .env、决定用哪个模型 / 是否 mock
 *   3. 创建会话（新建或恢复）
 *   4. 构建工具注册表（按模式过滤）
 *   5. 构建系统提示词（注入 AGENTS.md）
 *   6. 进入 REPL：读用户输入 → 跑一轮 Agent → 等下一次输入
 *
 * 你可以把这里当成“main 函数”，但它干的事比普通 main 多：
 * 它负责处理进程信号（Ctrl+C）、会话切换、模型切换、手动压缩等交互。
 */
import path from "node:path";
import process from "node:process";
import { describeConfig, resolveConfig } from "./config.ts";
import type { AppConfig } from "./config.ts";
import { createModel } from "./llm/factory.ts";
import { explainLLMError } from "./llm/errors.ts";
import type { LLMProvider, Usage } from "./llm/types.ts";
import { getTodos } from "./tools/todo.ts";
import type { SubagentRequest } from "./tools/types.ts";
import { runAgent } from "./agent/loop.ts";
import { buildSystemPrompt, loadProjectRules } from "./agent/prompt.ts";
import { loadSkills } from "./tools/skills.ts";
import type { AgentMode } from "./agent/prompt.ts";
import { buildRegistry } from "./tools/builtin.ts";
import { ensureMcp, shutdownMcp } from "./tools/mcp.ts";
import { compactHistory } from "./agent/context.ts";
import { spawnSubagent } from "./agent/subagent.ts";
import { Permissions } from "./permission.ts";
import { Session } from "./session.ts";
import { Renderer } from "./ui/renderer.ts";
import { Input } from "./ui/input.ts";
import { cyan, dim } from "./ui/ansi.ts";

const VERSION = "0.2.0";

// ============================================================================
// 1. 命令行参数解析
// ============================================================================
interface CliOptions {
  command: "chat" | "run" | "web" | "sessions" | "help" | "version";
  prompt?: string;
  mock: boolean;
  yolo: boolean;
  acceptEdits: boolean;
  plan: boolean;
  model?: string;
  baseUrl?: string;
  maxSteps?: number;
  maxToolCalls?: number;
  repeatGuard?: boolean;
  reasoningEffort?: "default" | "low" | "medium" | "high" | "max";
  sessionId?: string;
  budget?: number;
  temperature?: number;
  /** web 模式监听端口（默认 8787）。 */
  port?: number;
  /** web 模式监听地址（默认 127.0.0.1，只允许本机访问）。 */
  host?: string;
  /**
   * web 模式的初始工作区（默认跟随启动目录 cwd）。
   *
   * 为什么把「启动目录」和「工作区」拆开？
   *  - 启动目录负责放 .env / 会话记录（程序自己的事）；
   *  - 工作区才是 Agent 读写文件、执行命令的地方，工具会被限制在这个目录内；
   *  - 演示站因此可以让 Agent 只在一个独立沙盒目录里干活，不会碰项目源码。
   */
  workspace?: string;
}

function requireValue(args: string[], flag: string): string {
  const value = args.shift();
  if (!value || value.startsWith("--")) {
    throw new Error(`参数 ${flag} 需要一个值`);
  }
  return value;
}

/** 非负整数（0 合法）：--max-steps 0 表示不限步数。 */
function requireNonNegativeInt(args: string[], flag: string): number {
  const raw = requireValue(args, flag);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`参数 ${flag} 需要一个非负整数（0 表示不限），收到的是 ${JSON.stringify(raw)}`);
  }
  return value;
}

/** 温度必须是 0~2 的有限数字（0 合法）。 */
function requireTemperature(args: string[], flag: string): number {
  const raw = requireValue(args, flag);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 2) {
    throw new Error(`参数 ${flag} 需要 0~2 之间的数字（例如 0 / 0.2 / 1.0），收到的是 ${JSON.stringify(raw)}`);
  }
  return value;
}

/** 数值参数必须是正整数，否则 NaN/0/负数会一路传到循环里变成诡异行为。 */
function requirePositiveInt(args: string[], flag: string): number {
  const raw = requireValue(args, flag);
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`参数 ${flag} 需要一个正整数，收到的是 ${JSON.stringify(raw)}`);
  }
  return value;
}

function parseArgs(argv: string[]): CliOptions {
  const args = [...argv];
  const options: CliOptions = {
    command: "chat",
    mock: false,
    yolo: false,
    acceptEdits: false,
    plan: false,
  };
  const commands = new Set(["chat", "run", "web", "sessions", "help", "version"]);

  if (args[0] && commands.has(args[0])) {
    options.command = args.shift()! as CliOptions["command"];
  }

  const rest: string[] = [];
  while (args.length > 0) {
    const arg = args.shift()!;
    switch (arg) {
      case "--mock":
        options.mock = true;
        break;
      case "--yolo":
        options.yolo = true;
        break;
      case "--accept-edits":
        options.acceptEdits = true;
        break;
      case "--no-repeat-guard":
        options.repeatGuard = false;
        break;
      case "--reasoning-effort": {
        const value = requireValue(args, arg);
        if (![ "default", "low", "medium", "high", "max" ].includes(value)) {
          throw new Error(`--reasoning-effort 只能是 default/low/medium/high/max，收到 ${value}`);
        }
        options.reasoningEffort = value as typeof options.reasoningEffort;
        break;
      }
      case "--plan":
        options.plan = true;
        break;
      case "--model":
        options.model = requireValue(args, arg);
        break;
      case "--base-url":
        options.baseUrl = requireValue(args, arg);
        break;
      case "--max-steps":
        options.maxSteps = requireNonNegativeInt(args, arg);
        break;
      case "--max-tool-calls":
        options.maxToolCalls = requirePositiveInt(args, arg);
        break;
      case "--budget":
        options.budget = requirePositiveInt(args, arg);
        break;
      case "--session":
        options.sessionId = requireValue(args, arg);
        break;
      case "--temperature":
        options.temperature = requireTemperature(args, arg);
        break;
      case "--port":
        options.port = requirePositiveInt(args, arg);
        break;
      case "--host":
        options.host = requireValue(args, arg);
        break;
      case "--workspace":
        options.workspace = requireValue(args, arg);
        break;
      case "--help":
      case "-h":
        options.command = "help";
        break;
      case "--version":
      case "-v":
        options.command = "version";
        break;
      default:
        if (arg.startsWith("-")) throw new Error(`未知参数：${arg}`);
        rest.push(arg);
    }
  }

  if (options.command === "run") {
    options.prompt = rest.join(" ").trim() || undefined;
  } else if (rest.length > 0) {
    throw new Error(`多余参数：${rest.join(" ")}`);
  }

  return options;
}

// ============================================================================
// 2. 小工具
// ============================================================================
function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ============================================================================
// 3. REPL 应用
// ============================================================================
class App {
  private config: AppConfig;
  private provider: LLMProvider;
  private session: Session;
  private readonly renderer: Renderer;
  private readonly input: Input | null;
  private readonly permissions: Permissions;
  private readonly acceptEdits: boolean;
  private readonly cwd: string;
  private readonly projectRules: string | null;
  private mode: AgentMode;
  private abortController: AbortController | null = null;
  private generating = false;

  constructor(options: {
    config: AppConfig;
    provider: LLMProvider;
    session: Session;
    cwd: string;
    mode: AgentMode;
    interactive: boolean;
    yolo: boolean;
    acceptEdits: boolean;
    withInput: boolean;
  }) {
    this.config = options.config;
    this.provider = options.provider;
    this.session = options.session;
    this.cwd = options.cwd;
    this.acceptEdits = options.acceptEdits;
    this.mode = options.mode;
    this.renderer = new Renderer({ interactive: options.interactive });
    this.input = options.withInput ? new Input() : null;
    this.projectRules = loadProjectRules(options.cwd);

    // 权限系统：交互式终端才能弹窗；否则 ask 会直接拒绝
    this.permissions = new Permissions({
      yolo: options.yolo,
      acceptEdits: options.acceptEdits,
      interactive: options.interactive,
      confirm: async (request) => {
        this.renderer.showApproval(request.toolName, request.detail, request.danger);
        const answer = await this.askApproval();
        return answer;
      },
    });
  }

  get isGenerating(): boolean {
    return this.generating;
  }

  /** 中断当前回合（Ctrl+C 触发）。 */
  abortCurrentTurn(): void {
    if (!this.abortController) return;
    this.renderer.notice("已中断当前回合（已生成的内容会保留）");
    this.abortController.abort();
  }

  /** 启动 REPL，返回退出码。 */
  async start(): Promise<number> {
    this.printBanner();

    for (;;) {
      const line = await this.input!.ask(this.promptString());
      if (line === null) {
        this.renderer.info("再见 👋");
        break;
      }
      const text = line.trim();
      if (!text) continue;

      // 斜杠命令：本地处理，不进 Agent
      if (text.startsWith("/")) {
        const keepRunning = await this.handleCommand(text);
        if (!keepRunning) break;
        continue;
      }

      // 非交互式输入（管道）不会回显，这里补一下
      if (process.stdin.isTTY !== true) this.renderer.userMessage(text);
      await this.runTurn(text);
    }

    this.input?.close();
    return 0;
  }

  /** 一次性执行（run 命令用）。返回是否成功。 */
  async runOnce(prompt: string): Promise<boolean> {
    this.printBanner();
    return this.runTurn(prompt);
  }

  shutdown(code: number): never {
    this.input?.close();
    process.exit(code);
  }

  // ---- 内部实现 ----

  private promptString(): string {
    if (process.stdin.isTTY !== true) return "";
    return `\n${cyan("❯")} `;
  }

  private printBanner(): void {
    this.renderer.banner({
      model: this.provider.model,
      cwd: this.cwd,
      sessionId: this.session.meta.id,
      mock: this.config.mock,
      mode: this.mode,
    });
  }

  /** 权限审批：y / n / a（a = 本会话始终允许）。 */
  private async askApproval(): Promise<"yes" | "no" | "always"> {
    if (!this.input) return "no";
    const answer = await this.input.ask(
      `${dim("允许？[y] 允许  [n] 拒绝  [a] 本会话始终允许：")}`,
    );
    const value = (answer ?? "").trim().toLowerCase();
    if (value === "y" || value === "yes") return "yes";
    if (value === "a" || value === "always") return "always";
    return "no";
  }

  /** 跑一轮完整 Agent（用户输入 → 模型 → 工具 → … → 最终回答）。 */
  private async runTurn(text: string): Promise<boolean> {
    if (this.generating) {
      this.renderer.notice("上一轮还没结束，请稍等。");
      return false;
    }

    this.generating = true;
    const controller = new AbortController();
    this.abortController = controller;
    const startedAt = Date.now();

    this.session.appendMessage({ role: "user", content: text });

    // MCP：先把 mcp.json 里的外部 server 准备好（按 cwd 缓存，没配就是空操作）。
    // 之后再 buildRegistry——它会把缓存里的 MCP 工具同步注册进来。
    // ensureMcp 不会抛异常：坏配置 / 单个 server 起不来只会记日志然后跳过。
    await ensureMcp(this.cwd);

    const registry = buildRegistry(this.mode);
    const system = buildSystemPrompt({
      cwd: this.cwd,
      mode: this.mode,
      model: this.config.model,
      agentsMd: this.projectRules,
      toolNames: registry.names,
      skills: loadSkills(this.cwd),
    });

    // 子 Agent 执行器：绑定本回合的 signal 和工具集
    const spawn = async (request: SubagentRequest): Promise<string> => {
      this.renderer.notice(`↳ 派子 Agent 调研：${request.description}`);
      const result = await spawnSubagent({
        provider: this.provider,
        parentRegistry: registry,
        cwd: this.cwd,
        contextBudget: this.config.contextBudget,
        permissions: this.permissions,
        signal: controller.signal,
        description: request.description,
        prompt: request.prompt,
      });
      this.renderer.info(`子 Agent 返回 ${result.length} 字符的结论`);
      return result;
    };

    try {
      const result = await runAgent({
        provider: this.provider,
        registry,
        system,
        history: this.session.messages,
        cwd: this.cwd,
        maxSteps: this.config.maxSteps,
        maxToolCalls: this.config.maxToolCalls,
        repeatGuard: this.config.repeatGuard,
        contextBudget: this.config.contextBudget,
        reasoningEffort: this.config.reasoningEffort,
        permissions: this.permissions,
        ui: this.renderer,
        signal: controller.signal,
        session: this.session,
        toolState: this.session.toolState,
        // 和 web 端一致：todo 属于会话，改了就落盘，/todos 和下次恢复才有内容
        onToolStateChange: (state: Record<string, unknown>) => {
          const todos = state.todos;
          if (Array.isArray(todos)) this.session.persistTodos(todos);
        },
        spawnSubagent: spawn,
      });

      this.session.appendEvent({
        type: "turn_end",
        steps: result.steps,
        usage: toUsageRecord(result.usage),
        aborted: result.aborted,
        hitStepLimit: result.hitStepLimit,
        toolDenials: result.toolDenials,
      });

      if (!result.aborted) {
        this.renderer.usage({
          promptTokens: result.usage.prompt_tokens ?? 0,
          completionTokens: result.usage.completion_tokens ?? 0,
          steps: result.steps,
          durationMs: Date.now() - startedAt,
        });
      }
      // run 是脚本接口：中断 / 步数上限 / 有工具被权限拒绝，都意味着任务大概率没完成，
      // 退出码要反映出来（chat 模式不看返回值，不受影响）
      return !result.aborted && !result.hitStepLimit && result.toolDenials === 0;
    } catch (err) {
      this.renderer.error(this.explainError(err));
      return false;
    } finally {
      this.generating = false;
      this.abortController = null;
    }
  }

  /** 斜杠命令。返回 false 表示退出 REPL。 */
  private async handleCommand(input: string): Promise<boolean> {
    const [rawCommand, ...rest] = input.trim().split(/\s+/);
    const command = rawCommand ?? "";
    const argument = rest.join(" ").trim();

    switch (command) {
      case "/exit":
      case "/quit":
        this.renderer.info("再见 👋");
        return false;

      case "/help":
        printHelp();
        return true;

      case "/new": {
        this.session = Session.create({ cwd: this.cwd, model: this.config.model });
        this.renderer.info(`新会话：${this.session.meta.id}`);
        return true;
      }

      case "/sessions": {
        const list = Session.list(this.cwd);
        if (list.length === 0) {
          this.renderer.info("还没有历史会话。");
          return true;
        }
        this.renderer.info(`历史会话（${list.length} 个）：`);
        for (const item of list) {
          this.renderer.info(`  ${item.id}  ${item.messageCount} 条  ${item.title}`);
        }
        return true;
      }

      case "/session": {
        if (!argument) {
          this.renderer.error("用法：/session <id>（先用 /sessions 查看）");
          return true;
        }
        try {
          this.session = Session.load(this.cwd, argument);
          this.renderer.info(
            `已恢复会话 ${argument}（${this.session.messages.length} 条消息）`,
          );
        } catch (err) {
          this.renderer.error(messageOf(err));
        }
        return true;
      }

      case "/model": {
        if (!argument) {
          this.renderer.info(`当前模型：${this.provider.model}（用法 /model <名字>）`);
          return true;
        }
        this.config.model = argument;
        try {
          this.provider = createModel(this.config, this.config.model);
          this.renderer.info(`已切换模型：${this.provider.model}`);
        } catch (err) {
          this.renderer.error(messageOf(err));
        }
        return true;
      }

      case "/mode": {
        if (argument !== "build" && argument !== "plan") {
          this.renderer.info(`当前模式：${this.mode}（用法 /mode build|plan）`);
          return true;
        }
        this.mode = argument;
        this.renderer.info(
          argument === "plan"
            ? "已切到 plan 模式：只读，只能调查和出方案。"
            : "已切到 build 模式：可以修改文件、执行命令。",
        );
        return true;
      }

      case "/yolo": {
        const next = !this.permissions.isYolo;
        this.permissions.setYolo(next);
        this.renderer.info(
          next ? "已开启 yolo：所有工具不再询问（危险，仅建议在学习环境用）" : "已关闭 yolo：恢复权限确认",
        );
        return true;
      }

      case "/compact": {
        await this.handleCompact();
        return true;
      }

      case "/todos": {
        const todos = getTodos(this.session.toolState);
        if (todos.length === 0) {
          this.renderer.info("当前没有待办清单。");
          return true;
        }
        for (const todo of todos) {
          const mark = todo.status === "completed" ? "[x]" : todo.status === "in_progress" ? "[~]" : "[ ]";
          this.renderer.info(`${mark} ${todo.content}`);
        }
        return true;
      }

      default:
        this.renderer.error(`未知命令：${command}（输入 /help 查看可用命令）`);
        return true;
    }
  }

  /** 手动压缩上下文（/compact）。 */
  private async handleCompact(): Promise<void> {
    this.renderer.info("正在压缩上下文…");
    try {
      const result = await compactHistory({
        messages: this.session.messages,
        provider: this.provider,
        keepRecent: 4,
      });
      this.session.messages.splice(0, this.session.messages.length, ...result.messages);
      // 压缩改变了历史，落一条快照：否则恢复会话时读回的还是压缩前的旧消息
      this.session.appendSnapshot(this.session.messages);
      this.session.appendEvent({
        type: "compaction",
        manual: true,
        before: result.before,
        after: result.after,
        summary: result.summary,
      });
      this.renderer.info(`压缩完成：约 ${result.before} → ${result.after} tokens`);
      this.renderer.info(`摘要：${result.summary.slice(0, 400)}`);
    } catch (err) {
      this.renderer.error(`压缩失败：${messageOf(err)}`);
    }
  }

  /** 把技术错误翻译成用户能看懂的建议（与 Web 版共用同一份逻辑）。 */
  private explainError(err: unknown): string {
    return explainLLMError(err);
  }
}

function toUsageRecord(usage: Usage): Record<string, number> {
  return {
    prompt_tokens: usage.prompt_tokens ?? 0,
    completion_tokens: usage.completion_tokens ?? 0,
    total_tokens: usage.total_tokens ?? 0,
  };
}

// ============================================================================
// 4. 帮助信息
// ============================================================================
function printHelp(): void {
  const lines = [
    `mini-opencode v${VERSION} — 手搓版 AI 编码 Agent`,
    "",
    "用法：",
    "  node src/main.ts chat [选项]           交互式对话（默认命令）",
    '  node src/main.ts run "任务" [选项]     执行一次任务后退出',
    "  node src/main.ts web [选项]            启动网页版可视化面板（推荐）",
    "  node src/main.ts sessions              列出历史会话",
    "  node src/main.ts chat --session <id>   恢复某个会话",
    "",
    "选项：",
    "  --mock            使用假模型（不需要 API key，离线可跑）",
    "  --yolo            跳过所有权限确认（危险，学习时方便）",
    "  --plan            以只读的 plan 模式启动",
    "  --model <name>    覆盖模型名",
    "  --base-url <url>  覆盖接口根地址（OpenAI 兼容）",
    "  --max-steps <n>   单次任务最大循环步数（默认 0=不限）",
    "  --budget <n>      上下文 token 预算（默认按模型窗口自动算，如 DeepSeek 224K）",
    "  --temperature <n> 采样温度 0~2（默认 0.2；Agent 建议 0~0.3，越大越发散）",
    "  --port <n>        web 模式端口（默认 8787）",
    "  --host <addr>     web 模式监听地址（默认 127.0.0.1）",
    "  --workspace <dir> web 模式初始工作区（默认=启动目录；演示站用它指向沙盒）",
    "",
    "MCP：",
    "  在项目根放 mcp.json（或设环境变量 MINI_MCP_CONFIG 指向配置文件），",
    "  Agent 就会自动接入外部 MCP server；工具名形如 mcp__<server>__<tool>。",
    "  配置示例见 mcp.example.json，原理见 docs/14-MCP与工具生态.md。",
    "",
    "对话中的命令：",
    "  /help                    显示帮助",
    "  /new                     新建会话",
    "  /sessions                列出历史会话",
    "  /session <id>            切换到某个历史会话",
    "  /model [name]            查看/切换模型",
    "  /mode [build|plan]       查看/切换模式（plan 只读）",
    "  /yolo                    开关权限确认",
    "  /compact                 手动压缩上下文",
    "  /todos                   查看待办清单",
    "  /exit                    退出",
    "",
    "例子：",
    '  npm run mock                                 离线体验（推荐先跑这个）',
    '  npm run web                                  打开网页可视化面板（http://127.0.0.1:8787）',
    '  node src/main.ts chat --session 20261102-…   恢复会话',
    '  node src/main.ts run --yolo "列出 src 下的文件并总结项目结构"',
    "",
    "更多说明见 README.md 和 docs/ 目录。",
  ];
  console.log(lines.join("\n"));
}

// ============================================================================
// 5. 主入口
// ============================================================================
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function main(): Promise<void> {
  // 进程退出（正常结束 / process.exit / 被信号杀掉）时收掉 MCP 子进程。
  // 注意：shutdownMcp() 的同步前半段会立即发 SIGTERM，所以这里不 await 也来得及。
  process.once("exit", () => {
    void shutdownMcp();
  });

  let options: CliOptions;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`参数错误：${messageOf(err)}`);
    console.error("用 --help 查看用法。");
    process.exit(1);
  }

  if (options.command === "help") {
    printHelp();
    return;
  }
  if (options.command === "version") {
    console.log(`mini-opencode v${VERSION}`);
    return;
  }

  const cwd = process.cwd();
  const config = resolveConfig(cwd, {
    // 没传 --mock 时传 undefined，让 .env / 环境变量（MINI_MOCK=1）说了算
    mock: options.mock ? true : undefined,
    model: options.model,
    baseUrl: options.baseUrl,
    maxSteps: options.maxSteps,
    maxToolCalls: options.maxToolCalls,
    repeatGuard: options.repeatGuard,
    reasoningEffort: options.reasoningEffort,
    contextBudget: options.budget,
    temperature: options.temperature,
  });

  // web 命令：启动可视化面板（HTTP 服务 + SSE 事件流）
  if (options.command === "web") {
    const { startWebServer } = await import("./web/server.ts");
    // 启动前先准备一次 MCP：这样首屏 state.tools 里就能看到外部工具。
    await ensureMcp(cwd);
    await startWebServer({
      cwd,
      config,
      host: options.host ?? "127.0.0.1",
      port: options.port ?? 8787,
      mode: options.plan ? "plan" : "build",
      yolo: options.yolo,
      sessionId: options.sessionId,
      // 初始工作区与启动目录解耦：工具只在这个目录里读写/执行。
      // 不传时沿用 cwd（CLI 交互模式的原有行为）。
      workspace: options.workspace,
      // 把 MCP 生命周期交给 Web 服务：每回合 ensure(cwd)、关服务时 shutdown。
      // server.ts 不认识 MCP，只会在对的时间点回调这两个函数。
      mcp: { ensure: (path: string) => ensureMcp(path), shutdown: () => shutdownMcp() },
    });
    return;
  }

  // sessions 命令：只列会话，不需要模型
  if (options.command === "sessions") {
    const list = Session.list(cwd);
    if (list.length === 0) {
      console.log("还没有历史会话。");
      return;
    }
    console.log(`历史会话（${list.length} 个，目录 ${path.join(cwd, ".mini-opencode", "sessions")}）：`);
    for (const item of list) {
      console.log(`  ${item.id}  ${String(item.messageCount).padStart(3)} 条  ${item.title}`);
    }
    return;
  }

  // run 命令：提示词可以来自参数，也可以来自管道
  let prompt = options.prompt;
  if (options.command === "run" && !prompt) {
    if (process.stdin.isTTY) {
      console.error('用法：node src/main.ts run "要执行的任务"');
      process.exit(1);
    }
    prompt = await readStdin();
  }
  if (options.command === "run" && !prompt) {
    console.error("没有收到任务描述。");
    process.exit(1);
  }

  let provider: LLMProvider;
  try {
    provider = createModel(config, options.model);
  } catch (err) {
    console.error(messageOf(err));
    process.exit(1);
  }

  // 新建或恢复会话
  let session: Session;
  try {
    session = options.sessionId
      ? Session.load(cwd, options.sessionId)
      : Session.create({ cwd, model: config.model });
  } catch (err) {
    console.error(messageOf(err));
    process.exit(1);
  }

  const interactive = process.stdin.isTTY === true && options.command === "chat";

  const app = new App({
    config,
    provider,
    session,
    cwd,
    mode: options.plan ? "plan" : "build",
    interactive,
    yolo: options.yolo,
    acceptEdits: options.acceptEdits,
    withInput: options.command === "chat",
  });

  // Ctrl+C：运行中 = 中断当前回合；空闲 = 退出
  process.on("SIGINT", () => {
    if (app.isGenerating) {
      app.abortCurrentTurn();
    } else {
      app.shutdown(0);
    }
  });

  if (options.command === "run") {
    if (config.mock) {
      console.error(dim("（mock 模式：不联网，用假模型演示 Agent 循环）"));
    }
    const ok = await app.runOnce(prompt!);
    app.shutdown(ok ? 0 : 1);
  }

  if (!config.mock) {
    // 把配置摘要打到 stderr，避免污染 stdout 输出
    console.error(dim(describeConfig(config).split("\n").join("\n")));
  }
  const code = await app.start();
  app.shutdown(code);
}

main().catch((err) => {
  console.error(`启动失败：${messageOf(err)}`);
  process.exit(1);
});
