#!/usr/bin/env node
/**
 * ============================================================================
 * 最小 MCP 客户端 demo：直接和 examples/04-mcp-server.mjs 对话
 * ============================================================================
 *
 * 运行：
 *   node examples/05-mcp-client.mjs
 *
 * 它复用项目里的 McpStdioClient（和 Agent 用的是同一个客户端），把 MCP
 * 最小生命周期完整走一遍：
 *   启动子进程 → initialize 握手 → tools/list → tools/call(hello) → close
 *
 * 看输出就够了；不需要 API key，也不需要模型。
 */
import { McpStdioClient } from "../src/mcp/client.ts";
import { fileURLToPath } from "node:url";

const serverPath = fileURLToPath(new URL("./04-mcp-server.mjs", import.meta.url));

const client = new McpStdioClient({
  name: "hello",
  command: process.execPath, // 用当前 Node 解释器
  args: [serverPath],
});

try {
  console.log("① 启动子进程并 initialize 握手…");
  const init = await client.connect();
  console.log("   serverInfo:", init.serverInfo);
  console.log("   protocolVersion:", init.protocolVersion);

  console.log("\n② tools/list 拉工具清单…");
  const tools = await client.listTools();
  console.log("   工具数:", tools.length);
  for (const tool of tools) {
    console.log(`   - ${tool.name}: ${tool.description}`);
    console.log("     inputSchema:", JSON.stringify(tool.inputSchema));
    console.log("     readOnlyHint:", tool.annotations?.readOnlyHint);
  }

  console.log("\n③ tools/call 调用 hello…");
  const result = await client.callTool("hello", { name: "小明" });
  console.log("   isError:", result.isError ?? false);
  for (const block of result.content ?? []) {
    if (block.type === "text") console.log("   ←", block.text);
    else console.log(`   ← [${block.type} 内容]`);
  }

  console.log("\n④ close 关闭子进程");
} finally {
  await client.close();
}
