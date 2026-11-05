/**
 * ============================================================================
 * 把 MCP server 的工具“翻译”成本项目 Agent 能用的 Tool
 * ============================================================================
 *
 * 这个文件是 MCP 和主循环之间的适配层，只做三件事：
 *
 *   1. 读配置、启动 server（生命周期归 `ensureMcp` / `shutdownMcp` 管）；
 *   2. 把 MCP 的 `tools/list` 结果转成 `Tool`，注册进 `ToolRegistry`；
 *   3. `execute` 时转手调用 MCP 的 `tools/call`，把结果整理成一段文本。
 *
 * 几个容易踩的坑，先在这里说清楚：
 *
 *  - **工具名冲突**：MCP 工具叫 `read`、内置工具也叫 `read` 怎么办？
 *    统一加前缀 `mcp__<server>__<tool>`，并 sanitize 成只含 [A-Za-z0-9_]。
 *    （模型 API 对工具名有字符集限制，真实 opencode 也是这么做的。）
 *
 *  - **危险等级不能全信 server**：MCP 的 `annotations.readOnlyHint` 只是
 *    “服务端自称只读”。我们据此把它标成 read 类（自动放行），否则标成 exec
 *    （默认要用户审批）。也就是说：**凡是没声明只读的外部工具，一律按危险处理**。
 *
 *  - **失败不能崩 Agent**：server 启动失败、调用超时、进程退出，都只让这个
 *    工具返回错误文本（模型能看到），而不是把整个程序带崩。
 *
 * 生命周期设计（和真实 opencode 的“启动时加载 + 工作区变化时 reload”一致）：
 *
 *   ensureMcp(cwd) ── 读 mcp.json；cwd/配置没变就复用，变了就先关旧客户端再重连；
 *                     结果放进模块级缓存（servers + 工具清单）
 *   buildRegistry(mode) ── 同步地从缓存里把工具注册进 registry（见 tools/builtin.ts）
 *   registerMcpTools(registry, cwd) ── 显式版：先 ensure，再往给定 registry 注册（可重复调用）
 *   shutdownMcp() ── 杀掉所有子进程（进程退出 / Web 服务关闭时调用）
 *
 * 为什么缓存要放模块级？因为 CLI 每回合都会重新 `buildRegistry()`，
 * 如果每次重建都重启一堆子进程，用起来会又慢又吵。缓存还让 Web 服务端的
 * snapshot() 这种同步代码也能看到 MCP 工具（ensure 跑过一次之后）。
 */
import path from "node:path";
import process from "node:process";
import type { JSONSchema } from "../llm/types.ts";
import { McpStdioClient } from "../mcp/client.ts";
import { loadMcpConfig } from "../mcp/config.ts";
import type { McpConfig } from "../mcp/config.ts";
import type { McpToolCallResult, McpToolInfo } from "../mcp/types.ts";
import { truncateMiddle } from "../util.ts";
import type { ToolRegistry } from "./registry.ts";
import type { Tool, ToolResult } from "./types.ts";

/** 工具名前缀：`mcp__demo__echo`。双下划线方便肉眼区分 server 和工具。 */
const MCP_TOOL_PREFIX = "mcp__";

/**
 * 工具名最大长度。
 *
 * OpenAI 兼容协议的 function.name 限制是 64 个字符，而 MCP server 的工具名
 * 可能又长又带命名空间（例如 `github_search_repositories_in_org`）。
 * 超长时截断并加 8 位哈希，保证同名不同工具不会撞车。
 */
const MAX_TOOL_NAME_LENGTH = 64;

/**
 * 单次 MCP 工具结果最多喂给模型多少字符。
 *
 * MCP server 是外部进程，返回 1MB 文本完全可能（比如整张表 dump）。
 * 不截断的话一次工具调用就能把上下文窗口撑爆。
 */
const MAX_MCP_OUTPUT_CHARS = 16_000;

/** 模式：plan 只注册“只读”MCP 工具，build 全注册。 */
export type McpToolMode = "build" | "plan";

export interface McpRegisterOptions {
  /** 当前模式；缺省 build（全注册）。 */
  mode?: McpToolMode;
}

/** registerMcpTools 的返回摘要，方便 CLI/Web 打日志或测试断言。 */
export interface McpRegistration {
  /** 成功连上的 server 数量。 */
  servers: number;
  /** 本次新注册进 registry 的工具数量（已存在的会跳过）。 */
  tools: number;
  /** 配置/启动层面的问题（坏配置、单 server 失败），不阻塞 Agent。 */
  errors: string[];
}

/** 一个已经连上的 MCP server。 */
interface ActiveMcpServer {
  name: string;
  client: McpStdioClient;
  tools: McpToolInfo[];
}

/** 模块级缓存：当前 cwd + 配置指纹对应的所有 server。 */
interface McpRuntime {
  cwd: string;
  configPath: string;
  fingerprint: string;
  servers: ActiveMcpServer[];
  errors: string[];
}

let runtime: McpRuntime | null = null;

/**
 * 所有创建过的客户端（包括正在连接、还没进 runtime 的）。
 * 用途只有一个：进程退出时确保它们统统被杀掉，不留孤儿进程。
 */
const liveClients = new Set<McpStdioClient>();

/**
 * 串行化 ensureMcp 的加载过程。
 *
 * 为什么需要？Web 服务里多个回合/工作区切换可能并发触发 ensure，
 * 如果两个加载同时跑，会出现“A 加载一半被 B 关掉”的竞态。
 * 用一个 Promise 链把操作排队，逻辑最简单也最不容易出玄学 bug。
 */
let ensureChain: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const next = ensureChain.then(task, task);
  ensureChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function logMcp(message: string): void {
  process.stderr.write(`${message.startsWith("[") ? "" : "[mcp] "}${message}\n`);
}

// ---------------------------------------------------------------------------
// 工具名 / schema 适配
// ---------------------------------------------------------------------------

/**
 * sanitize：MCP 工具名允许的字符集比模型 function.name 宽松（可能带 `-`、`.`），
 * 统一替换成 `_`。这不会影响调用——我们在 Tool.execute 里用的是 remote 原名。
 */
export function sanitizeMcpName(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_]/g, "_");
  return cleaned === "" ? "unnamed" : cleaned;
}

/** 32 位 FNV-1a，只用于“超长工具名截断后防撞车”，不是安全哈希。 */
function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** 拼出最终注册给模型的工具名：`mcp__<server>__<tool>`（超长会截断+哈希）。 */
export function mcpToolName(serverName: string, toolName: string): string {
  const full = `${MCP_TOOL_PREFIX}${sanitizeMcpName(serverName)}__${sanitizeMcpName(toolName)}`;
  if (full.length <= MAX_TOOL_NAME_LENGTH) return full;
  return `${full.slice(0, MAX_TOOL_NAME_LENGTH - 9)}_${shortHash(full)}`;
}

/**
 * MCP 的 inputSchema 本来就是 JSON Schema，直接透传。
 * 只兜底一种情况：server 没写 type（模型 API 要求参数 schema 是 object）。
 */
function toJsonSchema(inputSchema: Record<string, unknown> | undefined): JSONSchema {
  if (!inputSchema || typeof inputSchema !== "object" || Array.isArray(inputSchema)) {
    return { type: "object", properties: {} };
  }
  if (typeof inputSchema.type !== "string") {
    return { ...inputSchema, type: "object" } as unknown as JSONSchema;
  }
  return inputSchema as unknown as JSONSchema;
}

/** 把 tools/call 的 content 数组拼成一段给模型看的文本。 */
function formatToolContent(result: McpToolCallResult): string {
  const blocks = Array.isArray(result.content) ? result.content : [];
  const parts: string[] = [];

  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
      continue;
    }
    // resource 里常带文本（比如文件内容），优先取文本。
    if (
      block.type === "resource" &&
      block.resource &&
      typeof block.resource.text === "string"
    ) {
      parts.push(block.resource.text);
      continue;
    }
    if (block.type === "image") {
      // 本项目先不把 MCP 图片转成模型多模态内容，降级成一句说明（见 docs/14）。
      parts.push(
        `[图片内容：${typeof block.mimeType === "string" ? block.mimeType : "未知类型"}，` +
          "mini-opencode 暂不支持把 MCP 图片喂给模型]",
      );
      continue;
    }
    parts.push(`[${String(block.type)} 内容]`);
  }

  const text = parts.join("\n");
  if (text.trim() === "") {
    return result.isError === true
      ? "MCP 工具返回了错误，但没有附带错误文本。"
      : "（MCP 工具没有返回文本内容）";
  }
  return truncateMiddle(text, MAX_MCP_OUTPUT_CHARS);
}

/** 把一条 tools/list 记录包装成 Agent 的 Tool。 */
function adaptMcpTool(
  serverName: string,
  remote: McpToolInfo,
  client: McpStdioClient,
): Tool {
  const readOnly = remote.annotations?.readOnlyHint === true;
  const title = `MCP ${serverName}/${remote.name}`;
  const description =
    `[MCP:${serverName}] ` +
    (remote.description?.trim() || `MCP server "${serverName}" 提供的工具 ${remote.name}`);

  return {
    name: mcpToolName(serverName, remote.name),
    description,
    parameters: toJsonSchema(remote.inputSchema),
    // 没声明 readOnlyHint 的外部工具一律按“执行类”处理（默认要审批）。
    category: readOnly ? "read" : "exec",
    async execute(args, ctx): Promise<ToolResult> {
      try {
        const result = await client.callTool(remote.name, args, { signal: ctx.signal });
        const output = formatToolContent(result);
        if (result.isError === true) return { title, output, isError: true };
        return { title, output };
      } catch (err) {
        // 超时 / server 退出 / 协议错误：都变成模型能看懂的失败文本，不往上抛。
        return {
          title,
          output: `MCP 调用失败（server=${serverName}, tool=${remote.name}）：${messageOf(err)}`,
          isError: true,
        };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 生命周期：加载 / 注册 / 关闭
// ---------------------------------------------------------------------------

async function closeServers(servers: ActiveMcpServer[]): Promise<void> {
  await Promise.allSettled(
    servers.map(async (server) => {
      liveClients.delete(server.client);
      await server.client.close();
    }),
  );
}

/**
 * 按配置启动所有 server 并拉取工具清单。
 *
 * 单个 server 失败只记录、不抛：Agent 少几个外部工具照样能干活，
 * 而“因为一个 MCP server 起不来就整程序崩掉”是绝对不能接受的。
 */
async function startRuntime(cwd: string, config: McpConfig): Promise<McpRuntime> {
  const servers: ActiveMcpServer[] = [];
  const errors: string[] = [];
  const failed: ActiveMcpServer[] = [];

  for (const error of config.errors) {
    errors.push(error);
    logMcp(`配置问题（${config.configPath}）：${error}`);
  }

  for (const entry of config.servers) {
    const client = new McpStdioClient({
      name: entry.name,
      command: entry.command,
      args: entry.args,
      // cwd 缺省跟随当前工作区；配置里写了相对路径也按工作区解析。
      cwd: entry.cwd ? path.resolve(cwd, entry.cwd) : cwd,
      env: entry.env,
      timeoutMs: entry.timeoutMs,
      log: logMcp,
    });
    liveClients.add(client);

    try {
      const info = await client.connect();
      const tools = await client.listTools();
      servers.push({ name: entry.name, client, tools });
      logMcp(
        `server "${entry.name}" 已连接（${info.serverInfo.name || "unknown"} ` +
          `${info.serverInfo.version}），拿到 ${tools.length} 个工具`,
      );
    } catch (err) {
      const message = messageOf(err);
      errors.push(`server "${entry.name}" 启动失败：${message}`);
      logMcp(`server "${entry.name}" 启动失败，已跳过：${message}`);
      liveClients.delete(client);
      failed.push({ name: entry.name, client, tools: [] });
    }
  }

  // 失败的客户端统一收尸，避免留下半死不活的子进程。
  await closeServers(failed);

  return {
    cwd,
    configPath: config.configPath,
    fingerprint: config.fingerprint,
    servers,
    errors,
  };
}

/**
 * 确保当前工作区对应的 MCP server 已加载（可重复调用）。
 *
 * - 配置内容和 cwd 都没变：直接复用，不重启子进程（这是“可重复调用”的关键）；
 * - 变了（改了 mcp.json / 切换工作区）：先关旧客户端，再按新配置重连；
 * - 没有 mcp.json：什么都不做（正常状态，不报错）。
 *
 * 这个函数**不 throw**：所有问题都会记到 stderr，然后让 Agent 继续跑。
 */
export async function ensureMcp(cwd: string): Promise<void> {
  try {
    await serialize(async () => {
      const config = loadMcpConfig(cwd);
      if (runtime && runtime.cwd === cwd && runtime.fingerprint === config.fingerprint) {
        return;
      }
      const old = runtime;
      runtime = null;
      if (old) await closeServers(old.servers);
      runtime = await startRuntime(cwd, config);
    });
  } catch (err) {
    // 理论上走不到这里（loadMcpConfig / startRuntime 都自己兜底了），
    // 但生命周期函数是“公共 API”，绝不能让调用方因为 MCP 崩掉。
    logMcp(`加载 MCP 失败（Agent 会继续运行，只是没有外部工具）：${messageOf(err)}`);
  }
}

/**
 * 把模块级缓存里的 MCP 工具同步注册进 registry（不触发加载）。
 *
 * 谁调用它？
 *  - `tools/builtin.ts` 的 buildRegistry：每回合构建 registry 时顺手挂上；
 *  - `registerMcpTools`：显式注册时复用同一份缓存。
 *
 * 返回本次新注册的工具数量。重复注册同名工具会安静跳过。
 */
export function registerCachedMcpTools(
  registry: ToolRegistry,
  mode: McpToolMode = "build",
): number {
  if (!runtime) return 0;
  let registered = 0;

  for (const server of runtime.servers) {
    for (const remote of server.tools) {
      const tool = adaptMcpTool(server.name, remote, server.client);
      // plan 模式是“只读”：没声明 readOnlyHint 的 MCP 工具物理上不给。
      if (mode === "plan" && tool.category !== "read") continue;
      // registry 里已有同名工具（内置工具/别的 server 撞名/sanitize 后撞名）→ 跳过。
      if (registry.get(tool.name)) continue;
      registry.register(tool);
      registered += 1;
    }
  }

  return registered;
}

/**
 * 显式版注册：先 ensure 当前 cwd 的 MCP，再把工具注册进传进来的 registry。
 *
 * 这个 API 给“自己管 registry 生命周期”的调用方用（例如 Web 服务端的 run 流程），
 * 可重复调用：工具已存在就跳过，不会抛“工具名重复”。
 */
export async function registerMcpTools(
  registry: ToolRegistry,
  cwd: string,
  options: McpRegisterOptions = {},
): Promise<McpRegistration> {
  await ensureMcp(cwd);
  const tools = registerCachedMcpTools(registry, options.mode ?? "build");
  return {
    servers: runtime?.servers.length ?? 0,
    tools,
    errors: runtime?.errors ?? [],
  };
}

/**
 * 关闭所有 MCP 客户端（幂等、不抛）。
 *
 * 重要细节：`client.close()` 的同步前半段会立即发 SIGTERM，
 * 所以即使这个方法是在 `process.on("exit")` 里被调用的（异步逻辑已经来不及跑），
 * 子进程也一定能收到信号，不会变成孤儿。
 */
export function shutdownMcp(): Promise<void> {
  const current = runtime;
  runtime = null;

  const clients = new Set<McpStdioClient>();
  if (current) {
    for (const server of current.servers) clients.add(server.client);
  }
  for (const client of liveClients) clients.add(client);
  liveClients.clear();

  if (clients.size === 0) return Promise.resolve();

  const closing = [...clients].map((client) => client.close());
  return Promise.allSettled(closing).then(() => undefined);
}

/** 给测试 / 调试用：当前缓存里有什么（不触发加载）。 */
export function getMcpRuntimeInfo(): {
  cwd: string;
  configPath: string;
  servers: Array<{ name: string; toolCount: number }>;
  errors: string[];
} | null {
  if (!runtime) return null;
  return {
    cwd: runtime.cwd,
    configPath: runtime.configPath,
    servers: runtime.servers.map((server) => ({
      name: server.name,
      toolCount: server.tools.length,
    })),
    errors: [...runtime.errors],
  };
}
