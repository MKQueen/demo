/**
 * ============================================================================
 * MCP stdio 客户端：用 JSON-RPC 2.0 跟一个本地子进程说话
 * ============================================================================
 *
 * 一句话解释 MCP 的 stdio 传输：
 *   **你 spawn 一个进程，往它的 stdin 写一行 JSON，从它的 stdout 读一行 JSON。**
 * 就这么简单，没有 HTTP、没有端口、没有序列化框架。
 *
 * 为什么要按行读？
 *   规范规定 stdio 传输用“换行分隔的 JSON-RPC 消息”（每行一条完整 JSON，
 *   消息内部不能有换行）。所以客户端要维护一个缓冲区，遇到 "\n" 就切一条消息。
 *   这和 HTTP 的 Content-Length 分帧是同一个问题，只是更土。
 *
 * 这个文件实现四件事：
 *   1. 子进程生命周期（spawn / stderr 转发 / exit 处理 / close）
 *   2. 请求-响应配对（每个请求一个自增 id，Pending 表）
 *   3. 超时与中断（默认 30s，支持 AbortSignal）
 *   4. 三个协议方法：initialize、tools/list（带 cursor 分页）、tools/call
 *
 * 为什么不直接用一个 JSON-RPC 库？
 *   因为整条链路不到 300 行，自己写一遍你才能明白“协议”到底是什么：
 *   无非就是“消息格式 + 配对规则 + 超时清理”。而且本项目零运行时依赖。
 */
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import process from "node:process";
import type { McpInitializeResult, McpToolCallResult, McpToolInfo } from "./types.ts";

/** 默认请求超时：30 秒。工具调用偶尔很慢，但无限等会把 Agent 卡死。 */
export const DEFAULT_MCP_TIMEOUT_MS = 30_000;

/** 本项目使用的 MCP 协议版本（和官方规范对齐；server 可能协商成别的版本）。 */
export const MCP_PROTOCOL_VERSION = "2024-11-05";

/** 客户端自报家门，server 端日志/兼容分支会用到。 */
export const MCP_CLIENT_INFO = { name: "mini-opencode", version: "0.2.0" } as const;

export interface McpClientOptions {
  /** server 在配置里的名字，只用于日志前缀和报错。 */
  name: string;
  command: string;
  args?: string[];
  /** 子进程工作目录；缺省继承当前进程。 */
  cwd?: string;
  /** 额外环境变量，会合并到 process.env 之上。 */
  env?: Record<string, string>;
  /** 单次请求超时毫秒数，默认 30000。 */
  timeoutMs?: number;
  /** 协议版本，默认 2024-11-05。 */
  protocolVersion?: string;
  /** 客户端信息，默认 mini-opencode 0.2.0。 */
  clientInfo?: { name: string; version: string };
  /** 日志出口，默认打到 stderr。测试里可以传一个收集器。 */
  log?: (message: string) => void;
}

interface PendingRequest {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  signal?: AbortSignal;
  onAbort?: () => void;
}

interface RequestOptions {
  /** 覆盖本次请求的超时（毫秒）。 */
  timeoutMs?: number;
  /** 取消信号：Agent 被 Ctrl+C 时用它把“等 MCP”也一起中断。 */
  signal?: AbortSignal;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 等一个 Promise 最多 ms 毫秒；返回是否在时限内完成。 */
async function waitForSettled(promise: Promise<void> | null, ms: number): Promise<boolean> {
  if (!promise) return true;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
    timer.unref?.();
  });
  const done = await Promise.race([promise.then(() => true), timeout]);
  if (timer) clearTimeout(timer);
  return done;
}

export class McpStdioClient {
  /** server 名（配置里的 key）。 */
  readonly name: string;

  private readonly command: string;
  private readonly args: string[];
  private readonly cwd: string | undefined;
  private readonly env: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly protocolVersion: string;
  private readonly clientInfo: { name: string; version: string };
  private readonly log: (message: string) => void;

  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private exitPromise: Promise<void> | null = null;
  private closePromise: Promise<void> | null = null;
  private connected = false;
  private closed = false;

  constructor(options: McpClientOptions) {
    this.name = options.name;
    this.command = options.command;
    this.args = options.args ?? [];
    this.cwd = options.cwd;
    this.env = options.env ?? {};
    this.timeoutMs = options.timeoutMs ?? DEFAULT_MCP_TIMEOUT_MS;
    this.protocolVersion = options.protocolVersion ?? MCP_PROTOCOL_VERSION;
    this.clientInfo = options.clientInfo ?? { ...MCP_CLIENT_INFO };
    this.log = options.log ?? ((message) => process.stderr.write(`${message}\n`));
  }

  /** 握手成功、可以发请求了。 */
  get isConnected(): boolean {
    return this.connected && !this.closed;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  // --------------------------------------------------------------------------
  // 1. 启动与握手
  // --------------------------------------------------------------------------

  /**
   * 启动子进程并完成 MCP 握手：
   *   initialize（请求，等响应）→ notifications/initialized（通知，不等响应）。
   *
   * 所有失败（命令不存在、进程秒退、initialize 报错）都会 throw，
   * 由上层决定“跳过这个 server 继续跑”——不让 MCP 拖垮整个 Agent。
   */
  async connect(): Promise<McpInitializeResult> {
    if (this.child) throw new Error(`MCP 客户端 ${this.name} 已经启动过了`);
    if (this.closed) throw new Error(`MCP 客户端 ${this.name} 已经关闭`);

    this.spawnChild();

    let raw: unknown;
    try {
      raw = await this.request("initialize", {
        protocolVersion: this.protocolVersion,
        capabilities: {},
        clientInfo: this.clientInfo,
      });
    } catch (err) {
      // 握手失败时把子进程收掉，避免留下孤儿进程。
      await this.close().catch(() => {});
      throw err;
    }

    if (!isPlainObject(raw)) {
      await this.close().catch(() => {});
      throw new Error(`MCP server ${this.name} 的 initialize 响应不是对象`);
    }

    const serverInfo = isPlainObject(raw.serverInfo) ? raw.serverInfo : {};
    const result: McpInitializeResult = {
      protocolVersion:
        typeof raw.protocolVersion === "string" ? raw.protocolVersion : this.protocolVersion,
      capabilities: isPlainObject(raw.capabilities)
        ? (raw.capabilities as Record<string, unknown>)
        : {},
      serverInfo: {
        name: typeof serverInfo.name === "string" ? serverInfo.name : this.name,
        version: typeof serverInfo.version === "string" ? serverInfo.version : "",
      },
    };

    // 通知：告诉 server “我这边准备好了”。通知没有 id，也不需要等响应。
    this.notify("notifications/initialized");
    this.connected = true;
    return result;
  }

  private spawnChild(): void {
    const env: NodeJS.ProcessEnv = { ...process.env, ...this.env };
    const child = spawn(this.command, this.args, {
      cwd: this.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child = child;

    // exitPromise 用于 close() 时判断“子进程到底死没死”。
    this.exitPromise = new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
      child.once("error", () => resolve());
    });

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.handleStdout(chunk));

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => this.handleStderr(chunk));

    child.on("error", (err) => {
      // 典型场景：command 写错 → ENOENT。这里不能 throw（事件回调里没人接），
      // 只能把所有等着的请求全部 reject 掉，让上层感知失败。
      this.closed = true;
      this.connected = false;
      this.log(`[mcp:${this.name}] 子进程启动/运行失败：${messageOf(err)}`);
      this.failAllPending(new Error(`无法启动 MCP server ${this.name}：${messageOf(err)}`));
    });

    child.on("exit", (code, signal) => {
      const wasClosedByUs = this.closed;
      this.closed = true;
      this.connected = false;
      if (!wasClosedByUs) {
        this.log(
          `[mcp:${this.name}] 子进程已退出（code=${code ?? "null"}, signal=${signal ?? "null"}）`,
        );
      }
      this.failAllPending(
        new Error(`MCP server ${this.name} 已退出（code=${code ?? "null"}）`),
      );
    });
  }

  // --------------------------------------------------------------------------
  // 2. 协议方法
  // --------------------------------------------------------------------------

  /**
   * 拉取工具清单，自动处理 cursor 分页。
   *
   * 为什么必须处理分页？有些 server（比如暴露大量 GitHub API 的）工具很多，
   * 一次返回会撑爆消息；规范允许服务端用 nextCursor 让你“下一页”。
   * 不处理的话你只能拿到第一页，模型会莫名其妙少工具。
   */
  async listTools(options: RequestOptions = {}): Promise<McpToolInfo[]> {
    const tools: McpToolInfo[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;

    // 防御：万一某个 server 的 cursor 永远不结束，最多翻 100 页就停。
    for (let page = 0; page < 100; page += 1) {
      const raw = await this.request(
        "tools/list",
        cursor === undefined ? {} : { cursor },
        options,
      );
      const pageTools = isPlainObject(raw) && Array.isArray(raw.tools) ? raw.tools : [];

      for (const item of pageTools) {
        if (!isPlainObject(item) || typeof item.name !== "string" || item.name === "") continue;
        if (seen.has(item.name)) continue;
        seen.add(item.name);
        tools.push({
          name: item.name,
          description: typeof item.description === "string" ? item.description : undefined,
          inputSchema: isPlainObject(item.inputSchema)
            ? (item.inputSchema as Record<string, unknown>)
            : undefined,
          annotations: isPlainObject(item.annotations)
            ? (item.annotations as McpToolInfo["annotations"])
            : undefined,
        });
      }

      const nextCursor = isPlainObject(raw) ? raw.nextCursor : undefined;
      if (typeof nextCursor !== "string" || nextCursor === "") return tools;
      cursor = nextCursor;
    }

    this.log(`[mcp:${this.name}] tools/list 超过 100 页，停止继续翻页（检查 server 的 cursor）`);
    return tools;
  }

  /**
   * 调用一个 MCP 工具。
   *
   * 注意区分两种“失败”：
   *   - JSON-RPC error（协议层错误）：这里直接 throw；
   *   - result.isError = true（工具执行失败）：正常 resolve，由上层转成“错误文本喂给模型”。
   * 后者很重要：模型要看到失败原因才能自我纠正。
   */
  async callTool(
    name: string,
    args: Record<string, unknown>,
    options: RequestOptions = {},
  ): Promise<McpToolCallResult> {
    const raw = await this.request(
      "tools/call",
      { name, arguments: args },
      options,
    );
    if (!isPlainObject(raw)) return {};
    return raw as McpToolCallResult;
  }

  // --------------------------------------------------------------------------
  // 3. 请求-响应配对 + 超时 / 中断
  // --------------------------------------------------------------------------

  /** 发一个 JSON-RPC 请求并等它的响应（按 id 配对）。 */
  private request(method: string, params: unknown, options: RequestOptions = {}): Promise<unknown> {
    if (this.closed || !this.child) {
      return Promise.reject(new Error(`MCP 客户端 ${this.name} 未连接或已关闭`));
    }

    const signal = options.signal;
    if (signal?.aborted) {
      return Promise.reject(new Error(`MCP 请求已中断：${method}`));
    }

    const id = this.nextId;
    this.nextId += 1;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.finishWithError(
          id,
          new Error(`MCP 请求超时（${timeoutMs}ms）：${method}（server=${this.name}）`),
          true,
        );
      }, timeoutMs);
      // unref：别让一个 MCP 超时定时器把整个 Node 进程的退出拖住。
      timer.unref?.();

      const pending: PendingRequest = { method, resolve, reject, timer, signal };
      if (signal) {
        pending.onAbort = () => {
          this.finishWithError(id, new Error(`MCP 请求已中断：${method}`), true);
        };
        signal.addEventListener("abort", pending.onAbort, { once: true });
      }
      this.pending.set(id, pending);

      const sent = this.writeMessage({ jsonrpc: "2.0", id, method, params });
      if (!sent) {
        this.finishWithError(id, new Error(`MCP 请求发送失败：${method}`), false);
      }
    });
  }

  /** 发一个 JSON-RPC 通知（没有 id，不期待响应）。 */
  private notify(method: string, params?: Record<string, unknown>): void {
    const message: Record<string, unknown> = { jsonrpc: "2.0", method };
    if (params !== undefined) message.params = params;
    this.writeMessage(message);
  }

  private writeMessage(message: Record<string, unknown>): boolean {
    const child = this.child;
    if (!child || this.closed) return false;
    try {
      child.stdin.write(`${JSON.stringify(message)}\n`);
      return true;
    } catch (err) {
      this.log(`[mcp:${this.name}] 写 stdin 失败：${messageOf(err)}`);
      return false;
    }
  }

  /** 结束一个挂起请求：清定时器、摘 abort 监听、按需通知 server 取消。 */
  private finishWithError(id: number, error: Error, notifyServer: boolean): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    clearTimeout(pending.timer);
    if (pending.signal && pending.onAbort) {
      pending.signal.removeEventListener("abort", pending.onAbort);
    }
    if (notifyServer) {
      // 告诉 server “这个请求我不要了”，省得它继续算/继续查数据库。
      this.notify("notifications/cancelled", { requestId: id, reason: error.message });
    }
    pending.reject(error);
  }

  private failAllPending(error: Error): void {
    for (const [id] of [...this.pending]) {
      this.finishWithError(id, error, false);
    }
  }

  // --------------------------------------------------------------------------
  // 4. stdout 解析：一行一条 JSON-RPC 消息
  // --------------------------------------------------------------------------

  private handleStdout(chunk: string): void {
    this.buffer += chunk;
    for (;;) {
      const index = this.buffer.indexOf("\n");
      if (index === -1) break;
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (line) this.handleLine(line);
    }
  }

  private handleLine(line: string): void {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      // stdout 必须是纯 JSON-RPC。出现别的输出（比如 server 往 stdout 打日志）
      // 时不能崩，只能记录并忽略——这也是要求“日志写 stderr”的原因。
      const preview = line.length > 200 ? `${line.slice(0, 200)}…` : line;
      this.log(`[mcp:${this.name}] 忽略无法解析的 stdout 行：${preview}`);
      return;
    }
    if (!isPlainObject(message)) return;

    const id = message.id;
    const isResponse = typeof id === "number" && ("result" in message || "error" in message);
    if (isResponse) {
      const pending = this.pending.get(id as number);
      // 超时/取消之后迟到的响应直接丢弃（Promise 已经 settle，再 reject 也没意义）。
      if (!pending) return;
      this.pending.delete(id as number);
      clearTimeout(pending.timer);
      if (pending.signal && pending.onAbort) {
        pending.signal.removeEventListener("abort", pending.onAbort);
      }

      if ("error" in message && isPlainObject(message.error)) {
        const code = message.error.code;
        const text = message.error.message;
        pending.reject(
          new Error(
            `MCP 错误 [${String(code ?? "?")}]：${typeof text === "string" ? text : JSON.stringify(message.error)}（${pending.method}）`,
          ),
        );
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    // server → client 的请求（例如 sampling/createMessage）。本项目不实现这些能力，
    // 按 JSON-RPC 规范回一个“方法不存在”，比装死不回更友好。
    if (typeof message.method === "string" && id !== undefined) {
      this.writeMessage({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `mini-opencode 客户端未实现方法：${message.method}` },
      });
      return;
    }

    // server 主动通知（tools/list_changed、logging 等）：本项目不订阅，记一行日志即可。
    if (typeof message.method === "string") {
      this.log(`[mcp:${this.name}] 收到通知：${message.method}`);
    }
  }

  private handleStderr(chunk: string): void {
    for (const rawLine of chunk.split("\n")) {
      const line = rawLine.trimEnd();
      if (line) this.log(`[mcp:${this.name}] ${line}`);
    }
  }

  // --------------------------------------------------------------------------
  // 5. 关闭
  // --------------------------------------------------------------------------

  /**
   * 关闭客户端：先 SIGTERM，1 秒还没退就 SIGKILL。
   *
   * 注意 close() 的前半段是**同步**执行的（挂起请求立即 reject、杀进程信号立即发出），
   * 这样即使调用方是在 process.on("exit") 里调它，子进程也来得及被杀掉。
   */
  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;

    this.closed = true;
    this.connected = false;
    this.failAllPending(new Error(`MCP 客户端 ${this.name} 已关闭`));

    const child = this.child;
    this.child = null;
    if (!child) {
      this.closePromise = Promise.resolve();
      return this.closePromise;
    }

    // 先礼后兵：关 stdin 让 server 自己退出，同时发 SIGTERM。
    try {
      child.stdin.end();
    } catch {
      // 进程可能已经死了，忽略。
    }
    try {
      child.kill("SIGTERM");
    } catch {
      // 忽略。
    }

    this.closePromise = (async () => {
      const exited = await waitForSettled(this.exitPromise, 1000);
      if (!exited) {
        this.log(`[mcp:${this.name}] SIGTERM 1s 未退出，改用 SIGKILL`);
        try {
          child.kill("SIGKILL");
        } catch {
          // 忽略。
        }
        await waitForSettled(this.exitPromise, 1000);
      }
    })();
    return this.closePromise;
  }
}
