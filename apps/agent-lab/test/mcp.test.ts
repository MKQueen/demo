/**
 * MCP 测试：真起子进程、真走 JSON-RPC 协议，不 mock 传输层。
 *
 * 为什么不做“假 client”单测？
 * 因为 MCP 客户端最容易出错的地方恰恰是进程和协议细节：stdout 按行分帧、
 * 请求 id 配对、cursor 分页、子进程退出、超时后清理。mock 掉这些就测了个寂寞。
 *
 * 测试用的 server 是 `test/fixtures/mcp-echo-server.mjs`（零依赖、纯 stdout JSON-RPC），
 * 每个用例根据需要写一份临时 `mcp.json`，全部用完删掉，不污染仓库。
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { McpStdioClient } from "../src/mcp/client.ts";
import { loadMcpConfig, parseMcpConfig, resolveMcpConfigPath } from "../src/mcp/config.ts";
import { buildRegistry } from "../src/tools/builtin.ts";
import {
  ensureMcp,
  getMcpRuntimeInfo,
  mcpToolName,
  registerMcpTools,
  sanitizeMcpName,
  shutdownMcp,
} from "../src/tools/mcp.ts";
import { ToolRegistry } from "../src/tools/registry.ts";
import type { ToolContext } from "../src/tools/types.ts";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = path.join(PROJECT_ROOT, "test", "fixtures", "mcp-echo-server.mjs");
/** 用当前 Node 可执行文件启动 fixture，避免依赖 PATH 里的 node。 */
const NODE = process.execPath;

let dir: string;
let ctx: ToolContext;
const originalMcpConfigEnv = process.env.MINI_MCP_CONFIG;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** 写一份 <dir>/mcp.json。 */
function writeConfig(servers: Record<string, unknown>): void {
  fs.writeFileSync(path.join(dir, "mcp.json"), JSON.stringify({ mcpServers: servers }, null, 2));
}

/** demo server 的启动配置（可以覆盖字段，构造坏配置）。 */
function demoServer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { command: NODE, args: [FIXTURE], env: {}, ...overrides };
}

before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mini-opencode-mcp-"));
  ctx = { cwd: dir, signal: new AbortController().signal, state: {} };
  // 测试必须不受开发者本机环境变量影响。
  delete process.env.MINI_MCP_CONFIG;
});

after(async () => {
  await shutdownMcp();
  if (originalMcpConfigEnv === undefined) delete process.env.MINI_MCP_CONFIG;
  else process.env.MINI_MCP_CONFIG = originalMcpConfigEnv;
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 配置解析
// ---------------------------------------------------------------------------
test("配置: 合法 mcp.json 能解析出 server 和启动参数", () => {
  const parsed = parseMcpConfig(
    JSON.stringify({ mcpServers: { demo: demoServer({ timeoutMs: 5000 }) } }),
  );
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.servers.length, 1);
  assert.equal(parsed.servers[0]?.name, "demo");
  assert.deepEqual(parsed.servers[0]?.args, [FIXTURE]);
  assert.equal(parsed.servers[0]?.timeoutMs, 5000);
});

test("配置: 坏配置只报告错误，不抛异常", () => {
  // 1) JSON 语法错
  assert.match(parseMcpConfig("{ 这不是 JSON").errors[0] ?? "", /JSON 解析失败/);
  // 2) 顶层不是对象
  assert.match(parseMcpConfig("[]").errors[0] ?? "", /顶层必须是一个 JSON 对象/);
  // 3) 缺 mcpServers
  assert.match(parseMcpConfig("{}").errors[0] ?? "", /mcpServers/);
  // 4) 部分 server 配置坏：坏的跳过，好的保留
  const mixed = parseMcpConfig(
    JSON.stringify({
      mcpServers: {
        "no-command": {},
        "bad-args": { command: "node", args: "oops" },
        good: demoServer(),
      },
    }),
  );
  assert.deepEqual(
    mixed.servers.map((server) => server.name),
    ["good"],
  );
  assert.equal(mixed.errors.length, 2);
});

test("配置: disabled=true 的 server 会被跳过（方便临时关闭）", () => {
  const parsed = parseMcpConfig(
    JSON.stringify({ mcpServers: { demo: demoServer({ disabled: true }) } }),
  );
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.servers, []);
});

test("配置: 没有 mcp.json 属于正常情况（found=false，无错误）", () => {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "mini-opencode-mcp-empty-"));
  try {
    const config = loadMcpConfig(emptyDir);
    assert.equal(config.found, false);
    assert.deepEqual(config.servers, []);
    assert.deepEqual(config.errors, []);
    assert.equal(config.configPath, path.join(emptyDir, "mcp.json"));
  } finally {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  }
});

test("配置: MINI_MCP_CONFIG 可以覆盖默认路径（相对路径按 cwd 解析）", () => {
  const customDir = fs.mkdtempSync(path.join(os.tmpdir(), "mini-opencode-mcp-custom-"));
  const customPath = path.join(customDir, "custom-mcp.json");
  try {
    fs.writeFileSync(customPath, JSON.stringify({ mcpServers: { demo: demoServer() } }));
    process.env.MINI_MCP_CONFIG = customPath;
    assert.equal(resolveMcpConfigPath(dir), customPath);
    const config = loadMcpConfig(dir);
    assert.equal(config.found, true);
    assert.equal(config.servers[0]?.name, "demo");
  } finally {
    delete process.env.MINI_MCP_CONFIG;
    fs.rmSync(customDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 客户端：握手 / 列表 / 调用 / 超时 / 退出 / 关闭
// ---------------------------------------------------------------------------
test("客户端: initialize 握手 + tools/list 自动处理 cursor 分页", async () => {
  const client = new McpStdioClient({
    name: "echo",
    command: NODE,
    args: [FIXTURE],
    log: () => {},
  });
  try {
    const info = await client.connect();
    assert.equal(info.serverInfo.name, "mcp-echo-server");
    assert.equal(info.protocolVersion, "2024-11-05");

    // fixture 每页只给 2 个工具，4 个工具必须翻 2 页才能拿全。
    const tools = await client.listTools();
    assert.deepEqual(
      tools.map((tool) => tool.name),
      ["echo", "add", "fail", "sleep"],
    );
    assert.equal(tools[0]?.annotations?.readOnlyHint, true);
    assert.equal((tools[0]?.inputSchema as { type?: string } | undefined)?.type, "object");
  } finally {
    await client.close();
  }
});

test("客户端: tools/call 正常结果、isError 结果、未知工具协议错误", async () => {
  const client = new McpStdioClient({
    name: "echo",
    command: NODE,
    args: [FIXTURE],
    log: () => {},
  });
  try {
    await client.connect();

    const echo = await client.callTool("echo", { text: "你好" });
    assert.equal(echo.content?.[0]?.text, "echo: 你好");
    assert.equal(echo.content?.length, 2);

    const fail = await client.callTool("fail", { reason: "故意失败" });
    assert.equal(fail.isError, true);
    assert.match(fail.content?.[0]?.text ?? "", /故意失败/);

    // 未知工具是 JSON-RPC error（协议层），客户端应该 reject。
    await assert.rejects(() => client.callTool("nope", {}), /MCP 错误/);
  } finally {
    await client.close();
  }
});

test("客户端: 请求超时会 reject 且带上方法名（不会把 Agent 卡死）", async () => {
  const client = new McpStdioClient({
    name: "echo",
    command: NODE,
    args: [FIXTURE],
    log: () => {},
  });
  try {
    await client.connect();
    await assert.rejects(
      () => client.callTool("sleep", { ms: 5000 }, { timeoutMs: 250 }),
      /MCP 请求超时.*tools\/call/,
    );
    // 超时之后客户端本身还是可用的，可以继续发别的请求。
    const echo = await client.callTool("echo", { text: "still-alive" });
    assert.match(echo.content?.[0]?.text ?? "", /still-alive/);
  } finally {
    await client.close();
  }
});

test("客户端: close 会让挂起请求立即失败，且可以重复调用", async () => {
  const client = new McpStdioClient({
    name: "echo",
    command: NODE,
    args: [FIXTURE],
    log: () => {},
  });
  await client.connect();

  // 先挂一个 5 秒的请求，确保它在 close 时还处于 pending。
  const pending = client.callTool("sleep", { ms: 5000 });
  const settled = pending.then(
    () => null,
    (err: Error) => err,
  );
  await sleep(50);

  const startedAt = Date.now();
  await client.close();
  const err = await settled;
  assert.ok(err instanceof Error, "挂起请求应该以错误结束");
  assert.match(err.message, /关闭|已退出/);
  assert.ok(Date.now() - startedAt < 2000, "close 不应该等工具自然结束");

  // 幂等：重复 close 不抛、不挂。
  await client.close();
});

test("客户端: 命令不存在时 connect 抛错而不是让进程崩掉", async () => {
  const client = new McpStdioClient({
    name: "missing",
    command: "/definitely/not/a/real-mcp-binary-xyz",
    log: () => {},
  });
  try {
    await assert.rejects(() => client.connect(), /无法启动|ENOENT|已退出/);
  } finally {
    await client.close();
  }
});

test("客户端: server 启动后立刻退出时，挂起请求收到明确错误", async () => {
  const client = new McpStdioClient({
    name: "dies",
    command: NODE,
    args: ["-e", "process.exit(3)"],
    log: () => {},
  });
  try {
    await assert.rejects(() => client.connect(), /已退出|无法启动/);
  } finally {
    await client.close();
  }
});

// ---------------------------------------------------------------------------
// 注册：mcp__<server>__<tool>
// ---------------------------------------------------------------------------
test("注册: 工具名带前缀，描述带 [MCP:server]，readOnlyHint 决定 read/exec", async () => {
  writeConfig({ demo: demoServer() });
  const registry = new ToolRegistry();
  const result = await registerMcpTools(registry, dir);

  assert.equal(result.errors.length, 0);
  assert.equal(result.servers, 1);
  assert.ok(result.tools >= 4);

  const echo = registry.get("mcp__demo__echo");
  assert.ok(echo, "echo 应该被注册成 mcp__demo__echo");
  assert.match(echo.description, /^\[MCP:demo\]/);
  assert.equal(echo.category, "read");
  assert.equal(echo.parameters.type, "object");

  // 没声明 readOnlyHint 的工具按 exec 处理（默认要审批）。
  assert.equal(registry.get("mcp__demo__fail")?.category, "exec");
  assert.equal(registry.get("mcp__demo__sleep")?.category, "exec");
});

test("注册: execute 调 tools/call，文本拼接、isError 变成错误文本", async () => {
  writeConfig({ demo: demoServer() });
  const registry = new ToolRegistry();
  await registerMcpTools(registry, dir);

  const echo = registry.get("mcp__demo__echo");
  const add = registry.get("mcp__demo__add");
  const fail = registry.get("mcp__demo__fail");
  assert.ok(echo && add && fail);

  const echoed = await echo.execute({ text: "你好" }, ctx);
  assert.equal(echoed.isError, undefined);
  // fixture 返回两个 text 块，输出里应该都拼上。
  assert.match(echoed.output, /echo: 你好/);
  assert.match(echoed.output, /长度 2 个字符/);

  const added = await add.execute({ a: 2, b: 3 }, ctx);
  assert.match(added.output, /2 \+ 3 = 5/);

  const failed = await fail.execute({}, ctx);
  assert.equal(failed.isError, true);
  assert.match(failed.output, /工具执行失败/);
});

test("注册: plan 模式只注册只读 MCP 工具（物理上不给 exec 工具）", async () => {
  writeConfig({ demo: demoServer() });
  const registry = new ToolRegistry();
  await registerMcpTools(registry, dir, { mode: "plan" });

  assert.ok(registry.get("mcp__demo__echo"));
  assert.ok(registry.get("mcp__demo__add"));
  assert.equal(registry.get("mcp__demo__fail"), undefined);
  assert.equal(registry.get("mcp__demo__sleep"), undefined);
});

test("注册: 可重复调用，同名工具不会抛“工具名重复”", async () => {
  writeConfig({ demo: demoServer() });
  const registry = new ToolRegistry();
  await registerMcpTools(registry, dir);
  const size = registry.all().length;
  assert.ok(size > 0);

  const again = await registerMcpTools(registry, dir);
  assert.equal(again.tools, 0, "第二次调用不应该重复注册");
  assert.equal(registry.all().length, size);
});

test("注册: server 名里的非法字符会被 sanitize", async () => {
  writeConfig({ "bad-name.v2": demoServer() });
  const registry = new ToolRegistry();
  const result = await registerMcpTools(registry, dir);
  assert.equal(result.errors.length, 0);
  assert.ok(registry.get("mcp__bad_name_v2__echo"));
  assert.equal(sanitizeMcpName("bad-name.v2"), "bad_name_v2");
  assert.equal(sanitizeMcpName(""), "unnamed");
});

test("注册: 单个 server 启动失败时，其他 server 和 Agent 都不受影响", async () => {
  writeConfig({
    good: demoServer(),
    broken: { command: "/definitely/not/a/real-mcp-binary-xyz" },
  });
  const registry = new ToolRegistry();
  const result = await registerMcpTools(registry, dir);

  assert.ok(registry.get("mcp__good__echo"));
  assert.equal(result.servers, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0] ?? "", /broken/);
});

test("注册: mcp.json 是坏 JSON 时 register 不抛异常、register 为空", async () => {
  fs.writeFileSync(path.join(dir, "mcp.json"), "{ 这不是合法 JSON");
  const registry = new ToolRegistry();
  const result = await registerMcpTools(registry, dir);

  assert.equal(result.tools, 0);
  assert.equal(result.servers, 0);
  assert.deepEqual(registry.all(), []);
  assert.ok(result.errors.length > 0);
  assert.match(result.errors[0] ?? "", /JSON 解析失败/);
});

test("生命周期: buildRegistry 会自动带上 ensureMcp 缓存过的工具", async () => {
  writeConfig({ demo: demoServer() });
  await ensureMcp(dir);

  const build = buildRegistry("build");
  assert.ok(build.get("mcp__demo__echo"), "build 模式应包含 MCP 只读工具");
  assert.ok(build.get("mcp__demo__fail"), "build 模式应包含 MCP exec 工具");
  assert.ok(build.get("read"), "内置工具不能丢");

  const plan = buildRegistry("plan");
  assert.ok(plan.get("mcp__demo__echo"));
  assert.equal(plan.get("mcp__demo__fail"), undefined);
  assert.equal(plan.get("bash"), undefined);
});

test("生命周期: shutdownMcp 清掉缓存和子进程，之后 ensure 可以重新加载", async () => {
  writeConfig({ demo: demoServer() });
  await ensureMcp(dir);
  assert.equal(getMcpRuntimeInfo()?.servers.length, 1);

  await shutdownMcp();
  assert.equal(getMcpRuntimeInfo(), null);

  await ensureMcp(dir);
  assert.equal(getMcpRuntimeInfo()?.servers.length, 1);
  assert.equal(getMcpRuntimeInfo()?.servers[0]?.name, "demo");
});

test("示例配置: mcp.example.json 是合法模板（demo 可直接跑，filesystem 默认关闭）", () => {
  const examplePath = path.join(PROJECT_ROOT, "mcp.example.json");
  const raw = fs.readFileSync(examplePath, "utf8");
  const parsed = parseMcpConfig(raw);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(
    parsed.servers.map((server) => server.name),
    ["demo"],
  );
  assert.equal(parsed.servers[0]?.command, "node");
});

test("工具名: 超长名字会被截断到模型 API 允许的 64 字符以内", () => {
  const longTool = "x".repeat(100);
  const name = mcpToolName("demo", longTool);
  assert.ok(name.length <= 64, `工具名太长：${name.length}`);
  assert.match(name, /^[A-Za-z0-9_]+$/);
  // 截断后不同工具名不应该撞车（靠哈希后缀区分）。
  assert.notEqual(mcpToolName("demo", longTool), mcpToolName("demo", `${longTool}y`));
  assert.equal(mcpToolName("demo", "echo"), "mcp__demo__echo");
});

test("MCP config: 相对路径 args 按配置文件目录解析（切工作区后仍能找到 fixture）", () => {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const previous = process.env.MINI_MCP_CONFIG;
  process.env.MINI_MCP_CONFIG = path.join(projectRoot, "mcp.example.json");
  try {
    const loaded = loadMcpConfig(projectRoot);
    const demo = loaded.servers.find((item) => item.name === "demo");
    assert.ok(demo, "mcp.example.json 里应有 demo server");
    const fixture = path.join(projectRoot, "test/fixtures/mcp-echo-server.mjs");
    assert.equal(demo.args[0], fixture);
    assert.ok(demo.args[0].startsWith("/"), "应是绝对路径");
  } finally {
    if (previous === undefined) delete process.env.MINI_MCP_CONFIG;
    else process.env.MINI_MCP_CONFIG = previous;
  }
});

test("最小示例: examples/04-mcp-server.mjs 能被客户端列出并调用", async () => {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const client = new McpStdioClient({
    name: "hello-demo",
    command: process.execPath,
    args: [path.join(projectRoot, "examples/04-mcp-server.mjs")],
    log: () => {},
  });
  try {
    const init = await client.connect();
    assert.equal(init.serverInfo.name, "hello-mcp");
    const tools = await client.listTools();
    assert.ok(tools.some((tool) => tool.name === "hello"));
    const result = await client.callTool("hello", { name: "小明" });
    assert.equal(result.isError ?? false, false);
    const text = (result.content ?? []).map((block) => block.text ?? "").join("\n");
    assert.match(text, /你好，小明/);
  } finally {
    await client.close();
  }
});
