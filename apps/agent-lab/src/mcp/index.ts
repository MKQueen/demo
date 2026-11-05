/**
 * MCP 模块的统一出口。
 *
 * 分层：
 *   types.ts   —— 协议数据结构（与官方规范字段名一致）
 *   config.ts  —— 读 mcp.json / MINI_MCP_CONFIG，坏配置只报告不抛异常
 *   client.ts  —— stdio JSON-RPC 2.0 客户端（initialize / tools/list / tools/call / 超时 / close）
 *
 * 工具适配与生命周期（ensureMcp / registerMcpTools / shutdownMcp）放在
 * `src/tools/mcp.ts`——因为它们要依赖 ToolRegistry / Tool，属于“工具层”。
 */
export {
  MCP_CLIENT_INFO,
  MCP_PROTOCOL_VERSION,
  DEFAULT_MCP_TIMEOUT_MS,
  McpStdioClient,
} from "./client.ts";
export type { McpClientOptions } from "./client.ts";
export {
  MCP_CONFIG_FILE_NAME,
  loadMcpConfig,
  parseMcpConfig,
  resolveMcpConfigPath,
} from "./config.ts";
export type { McpConfig, McpServerEntry } from "./config.ts";
export type {
  McpContentBlock,
  McpInitializeResult,
  McpToolAnnotations,
  McpToolCallResult,
  McpToolInfo,
} from "./types.ts";
