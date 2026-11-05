/**
 * ============================================================================
 * MCP 协议里用到的数据结构（只定义客户端真正需要的部分）
 * ============================================================================
 *
 * MCP（Model Context Protocol）是一套“Agent 怎么调用外部工具”的标准协议。
 * 官方规范定义了非常多东西（resources、prompts、sampling、roots……），
 * 本项目只需要其中最常用的一条链路：
 *
 *   initialize（握手） → tools/list（要工具清单） → tools/call（调工具）
 *
 * 所以这里的类型也刻意只覆盖这三步。字段名保持和 MCP 规范一致，
 * 这样你对照官方文档（https://modelcontextprotocol.io）时能一一对上。
 */

/** 一个 MCP 工具的描述（tools/list 返回数组里的一项）。 */
export interface McpToolInfo {
  /** 工具在 MCP server 里的名字，例如 "read_file"。 */
  name: string;
  /** 给模型看的说明。可能为空（有些 server 偷懒不写）。 */
  description?: string;
  /** 参数 JSON Schema，MCP 规定字段名就叫 inputSchema。 */
  inputSchema?: Record<string, unknown>;
  /** 工具行为提示。readOnlyHint=true 表示“只读”，权限系统可以据此放宽。 */
  annotations?: McpToolAnnotations;
}

/** MCP 工具的 annotations（行为提示，不是强制约束）。 */
export interface McpToolAnnotations {
  /** 只读：调用不会改变外部状态。 */
  readOnlyHint?: boolean;
  /** 破坏性：可能删改数据。 */
  destructiveHint?: boolean;
  /** 幂等：重复调用结果一样。 */
  idempotentHint?: boolean;
  /** 只访问“开放世界”（例如访问互联网）。 */
  openWorldHint?: boolean;
  [key: string]: unknown;
}

/** initialize 握手成功后拿到的服务端信息。 */
export interface McpInitializeResult {
  /** 协商后的协议版本，例如 "2024-11-05"。 */
  protocolVersion: string;
  /** 服务端能力表，例如 { tools: {} } 表示支持工具。 */
  capabilities: Record<string, unknown>;
  /** 服务端自我描述，用于日志和排错。 */
  serverInfo: { name: string; version: string };
}

/**
 * tools/call 返回的内容块。
 *
 * MCP 的 content 是一个数组，元素类型常见有：
 *  - { type: "text", text: "..." }
 *  - { type: "image", data: "<base64>", mimeType: "image/png" }
 *  - { type: "resource", resource: { uri, text } }
 *
 * 本项目只把文本拼给模型看；图片/资源降级成一句占位说明。
 * （原因见 docs/14：模型多模态协议和 MCP 的 content 格式不是一回事，
 *   真要把图片喂给模型还得转成 image_url 片段，这里先不做。）
 */
export interface McpContentBlock {
  type: string;
  /** type=text 时的文本。 */
  text?: string;
  /** type=image 时的 base64 数据。 */
  data?: string;
  /** type=image 时的 MIME 类型。 */
  mimeType?: string;
  /** type=resource 时内嵌的资源。 */
  resource?: {
    uri?: string;
    text?: string;
    mimeType?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** tools/call 的返回结构。 */
export interface McpToolCallResult {
  /** 内容块数组；注意可能缺失（有些 server 出 bug 直接返回空对象）。 */
  content?: McpContentBlock[];
  /** true 表示“工具执行失败”——它是正常响应，不是 JSON-RPC 错误。 */
  isError?: boolean;
  [key: string]: unknown;
}
