# 第 14 章 MCP 与工具生态

> **本章目标**：搞懂 MCP 解决什么问题、协议长什么样，把工具系统从"只有 11 个手写内置工具"扩展到
> "接上外部生态"：能写 `mcp.json`、接别人的 server、写一个最小 server，并清楚为什么要小心权限与供应链。
>
> 预计：35 分钟。对应代码：`src/mcp/`、`src/tools/mcp.ts`、`src/tools/builtin.ts`、
> `test/fixtures/mcp-echo-server.mjs`、`test/mcp.test.ts`。

## 14.1 直觉先行：插座与转换头

假设有 M 个 Agent 产品（opencode、Claude Code、Cursor、本项目……）和 N 个外部服务（文件系统、
GitHub、浏览器、数据库……）。没有标准时，每个 Agent 都要为每个服务写一遍适配，总共 **M × N** 份。
MCP（Model Context Protocol）定义一种"插座标准"：服务方实现 **MCP server**，Agent 方实现
**MCP client**，总共 **M + N** 份——把集成问题从乘法变成加法。类比 USB-C：一根线通用所有外设。

## 14.2 三个角色与两层协议

| 角色 | 在本项目里是谁 | 干什么 |
| --- | --- | --- |
| Host | `src/main.ts` / Web 服务 | 承载 Agent、决定接哪些 server、管权限 |
| Client | `src/mcp/client.ts` | 维护**一条**连接：发请求、收响应、管超时 |
| Server | 独立子进程（如 `node test/fixtures/mcp-echo-server.mjs`） | 真正提供工具/资源/提示词 |

MCP 分两层：**数据层**是 JSON-RPC 2.0（请求有 `id` 按 id 配对，通知没有 id、不等响应）；
**传输层**本地用 **stdio**（子进程 stdin/stdout，一行一条 JSON），远程用 **Streamable HTTP**（更早的
HTTP+SSE 已废弃）。本项目只实现 stdio。协议还定义三种能力：**tools**（可调用函数）、**resources**
（可读数据）、**prompts**（提示词模板）；本项目只接 **tools**——Agent 循环本来只需要工具。
## 14.3 协议长什么样：本项目实际走的四步

stdio 本质就是"往子进程 stdin 写一行 JSON，从 stdout 读一行 JSON"，完整交互如下：

```
client                                      server
  │ ── initialize ────────────────────────▶ │
  │ ◀──────────────── result(serverInfo) ── │
  │ ── notifications/initialized ─────────▶ │   （通知，不等响应）
  │ ── tools/list ────────────────────────▶ │
  │ ◀──────── { tools: [...], nextCursor } │   （工具多时分页，按 cursor 继续）
  │ ── tools/call {name, arguments} ──────▶ │
  │ ◀──────── { content: [...], isError } ─ │
```

真实消息长这样（在 `test/fixtures/mcp-echo-server.mjs` 里都能复现）：

```jsonc
{ "jsonrpc": "2.0", "id": 1, "method": "initialize",            // 1) 握手
  "params": { "protocolVersion": "2024-11-05", "capabilities": {},
              "clientInfo": { "name": "mini-opencode", "version": "0.2.0" } } }
{ "jsonrpc": "2.0", "id": 2, "result": { "tools": [ ... ],      // 2) tools/list
  "nextCursor": "offset:2" } }                                  //    还有下一页
{ "jsonrpc": "2.0", "id": 3,                                    // 3) tools/call
  "result": { "content": [ { "type": "text", "text": "echo: hi" } ] } }
```

**版本演进**（2026 年社区正在换挡）：

| 版本 | 关键变化 |
| --- | --- |
| 2024-11-05 | 初版；`initialize` 握手 + JSON-RPC，本项目用的就是它 |
| 2025-03-26 | Streamable HTTP 取代 HTTP+SSE；引入 OAuth 2.1 |
| 2026-07-28 | **stateless 大改**：删掉 `initialize` 握手，每个请求在 `_meta` 里带协议版本/客户端能力；新增 `server/discover`；结果带 `resultType`；多轮请求（MRTR）取代 server 主动请求；roots/sampling/logging 进入废弃期 |

2026-07-28 变化很大，但**已部署的 server 和 SDK 仍普遍兼容经典握手**，所以本项目选择"兼容面优先"：
用 2024-11-05 的 initialize 流程，能接上绝大多数现有 server。要接 2026 版无状态 server 时，扩展点在
`src/mcp/client.ts`：加 `server/discover` 探测分支，并在每个请求的 `_meta` 里带协议版本即可，工具适配层
不用动。（参考：[2026-07-28 Key Changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)）

## 14.4 2026 采用情况与典型 server

- **2025 年 12 月，MCP 被捐给 Linux Foundation 旗下的 Agentic AI Foundation（AAIF）**，与 goose、
  AGENTS.md 一起成为中立项目，OpenAI、Anthropic、Google 等共同参与，标准不再属于某一家公司
  （[Anthropic 公告](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation)、
  [Linux Foundation 新闻稿](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)）。
- 主流 Agent 产品基本都支持 MCP：Claude Code、Codex、opencode、Cursor、VS Code 等，各家文档都有
  "MCP servers" 章节（如 [opencode](https://opencode.ai/docs/mcp-servers/)、
  [Claude Code](https://docs.claude.com/en/docs/claude-code/mcp)）。
| server | 谁维护 | 提供什么 | 启发 |
| --- | --- | --- | --- |
| **filesystem** | MCP 官方参考实现（`@modelcontextprotocol/server-filesystem`） | 限定目录内的读/写/搜 | 权限边界由"允许目录"参数决定 |
| **github** | GitHub 官方（`github/github-mcp-server`） | 仓库/Issue/PR/代码搜索，按 toolset 分组 | 工具可能上百个 → **上下文爆炸风险** |
| **playwright** | Microsoft 官方（`microsoft/playwright-mcp`） | 用无障碍树驱动真实浏览器 | 外部副作用工具，必须审批 |
| **sqlite** | 参考 server（历史版本在官方仓库，现多为社区维护/派生） | 执行 SQL、读写数据库 | 一条 `DROP TABLE` 不可逆，看清 `readOnlyHint` |

真实的坑：**server 越多，模型每步要读的工具定义越多**。GitHub server 开满 toolsets 能塞进几十上百个
工具，每次请求都要付 token。所以官方文档反复提醒"按需启用"；本项目用 `disabled` 字段临时关掉某个 server。

## 14.5 本项目的实现：从 mcp.json 到模型手里的一个工具

```
mcp.json / MINI_MCP_CONFIG
  └─ src/mcp/config.ts     解析 + 校验（坏配置只报告，不抛异常）
  └─ src/mcp/client.ts     每个 server 一个 McpStdioClient：initialize → tools/list → tools/call
  └─ src/tools/mcp.ts      adaptMcpTool：MCP 工具 → Tool
  └─ src/tools/builtin.ts  buildRegistry() 自动挂到 registry
  └─ src/agent/loop.ts     像内置工具一样执行并喂回模型
```

**① 配置解析不能崩。** `src/mcp/config.ts:92` 的 `parseMcpConfig()` 是纯函数：JSON 语法错、字段类型错、
单个 server 配置坏，全部收进 `errors` 数组，**绝不 throw**；`loadMcpConfig()` 在
`src/mcp/config.ts:194` 把"文件不存在"当正常状态（`found:false`，没有任何错误噪音）。
配置里的 `fingerprint`（路径 + 文件原文）给生命周期用：**内容不变就不重连**。

**② stdio 客户端的三件苦活。** 按行分帧（`src/mcp/client.ts:401`）：stdio 没有长度头，只有换行——
维护一个 buffer，凑满一行 `JSON.parse` 一条，解析失败只告警不崩。请求-响应配对 + 超时
（`src/mcp/client.ts:315`）：每个请求发个自增 `id` 存进 `pending` Map，响应回来按 `id` 取。超时不止
reject，还要清理 pending 并通知 server 取消，否则会留一堆永远不结束的 Promise：

```ts
const timer = setTimeout(() => {
  this.finishWithError(
    id,
    new Error(`MCP 请求超时（${timeoutMs}ms）：${method}（server=${this.name}）`),
    true,
  );
}, timeoutMs);
```

生命周期（`src/mcp/client.ts:485`）——`close()` 的**同步前半段**会立刻 reject 挂起请求并给子进程发
SIGTERM，之后才异步等退出、1 秒不退就 SIGKILL。这是为 `process.on("exit")` 服务的：进程退出时异步
逻辑来不及跑，但信号必须发出去。握手（`src/mcp/client.ts:149`）则是 `request("initialize", {...})`
→ 校验 result → `notify("notifications/initialized")`；`tools/list`（`:249`）按 `nextCursor` 循环翻页。

**③ 把远程工具翻译成本地 `Tool`（`src/tools/mcp.ts:221`）。** MCP 的 `tools/list` 每一项和本项目的
`Tool` 几乎一一对应，适配层很薄，但有三个关键决定：

```ts
const readOnly = remote.annotations?.readOnlyHint === true;
// 名字：mcp__<server>__<tool>；非 [A-Za-z0-9_] 的字符替换成 _
name: mcpToolName(serverName, remote.name),
description: `[MCP:${serverName}] ${remote.description ?? "..."}`,
parameters: toJsonSchema(remote.inputSchema),  // 原样透传 JSON Schema
category: readOnly ? "read" : "exec",
```

1. **前缀 + sanitize**：避免和内置工具撞名，也满足模型 API 对函数名的字符集限制。超过 64 字符会截断
   并加 8 位哈希（`src/tools/mcp.ts:160`），防止不同工具撞名。
2. **`readOnlyHint` 只是 server 的自述**：true 标 `read`（自动放行），否则标 `exec`（默认要审批）。
   这是"宁可多问一次"的保守策略。
3. **执行**：`execute()` 转手调 `tools/call`，把 `content` 里所有 `type:"text"` 的块用换行拼起来；
   `result.isError===true` 时把文本以 `isError: true` 返回，模型才能看到失败原因并自我纠正。
   结果超过 16000 字符会中间截断，防止一个慢查询把上下文顶爆。

**④ 生命周期——不重启、不泄漏（`src/tools/mcp.ts:336`）。** 核心是模块级缓存 + 指纹复用：
`runtime.cwd` 和 `config.fingerprint` 都没变就直接返回；变了先 `closeServers(old.servers)` 关旧客户端，
再 `startRuntime(cwd, config)` 按新配置重连。所以每回合调用都不会反复重启子进程。

`ensureMcp(cwd)` 是**异步加载**，而 `buildRegistry(mode)`（`src/tools/builtin.ts:37`）是同步的，只从缓存
"取货"：`registerCachedMcpTools(registry, mode)`。所以顺序必须是 **先 `await ensureMcp(cwd)`，再
`buildRegistry()`**：CLI 每次 run 前做（`src/main.ts:348`），Web 服务通过 `WebMcpHooks` 在每回合开始前做；
进程退出/服务关闭时调 `shutdownMcp()`（`src/tools/mcp.ts:413`）。没配 mcp.json 的项目这些全是空操作。


## 14.6 最小可跑示例：一个文件、一个工具

项目里已经带了一个**最小 MCP server**（`examples/04-mcp-server.mjs`，约 120 行、零依赖），
只实现 initialize / tools/list / tools/call，工具只有一个 `hello`：

```bash
# 1) 直接和它对话（不需要模型/API key）
node examples/05-mcp-client.mjs

# 2) 把它接进 Agent（工具列表里会多出 mcp__hello__hello）
MINI_MCP_CONFIG="$PWD/examples/mcp-hello.json" node src/main.ts web --mock

# 3) 或者复制成项目根 mcp.json，之后自动加载
cp examples/mcp-hello.json mcp.json
```

客户端 demo 会打印完整生命周期：`serverInfo → tools/list(1 个工具) → tools/call(hello) → close`。
把 `04-mcp-server.mjs` 改一改（加一个工具、改 inputSchema、返回多段 text），
或者用 `MINI_MCP_CONFIG` 指向自己的 `mcp.json` 多接几个 server，就是下一节练习的起点。

## 14.7 动手实验：接上第一个外部工具

**实验 1：用测试 fixture 体验完整链路**：

```bash
cd mini-opencode
node --test test/mcp.test.ts        # 22 个 MCP 用例，真起子进程
cp mcp.example.json mcp.json        # example 里的 demo server 直接可用
node src/main.ts chat --mock --yolo # 启动后问模型“有哪些工具”
```

mock 模型不会真的调用 MCP 工具；想看到工具执行，用 `node --test test/mcp.test.ts`，或接真实模型后
让 Agent 调用 `mcp__demo__echo`。**实验 2：手工裸调 MCP server（最有效的调试方式）**——直接把
JSON-RPC 打进 fixture 的 stdin：

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"mini-opencode","version":"0.2.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"add","arguments":{"a":2,"b":3}}}' \
  | node test/fixtures/mcp-echo-server.mjs
```

预期看到 initialize 结果、分页的 tools、以及 `2 + 3 = 5`。

**实验 3：切到 filesystem server（注意它会下载并执行代码）**——把 `mcp.json` 里 `filesystem` 的
`disabled` 去掉，args 里的 `.` 换成想让它访问的目录，重启 Agent（`npx -y @modelcontextprotocol/
server-filesystem /tmp/mcp-playground`）。工具里会出现 `mcp__filesystem__read_file` 之类。
**跑完记得重新 disabled**：工具越多越贵。

**实验 4/5：换配置、故意配坏、自己写 server**——`MINI_MCP_CONFIG=/tmp/other-mcp.json node src/main.ts chat --mock`
可以换配置文件；把 mcp.json 改成非法 JSON 应只在 stderr 打一行配置错误、程序照常跑。自己写 server
最小实现只需处理 `initialize` / `tools/list` / `tools/call`：stdout **只写** JSON-RPC，日志写 stderr。

## 14.8 安全边界：MCP server 等于"你亲手启动的本地进程"

MCP 让 Agent 变强的方式本质上和 `bash` 工具一样：**以你的用户权限执行东西**。

1. **没有沙箱**。`command` 写什么就执行什么，server 能读 `~/.ssh`、能联网、能删文件。`npx -y 某个包`
   意味着**每次启动都可能下载并运行陌生人的代码**，属于供应链风险。只接信得过的 server。
2. **`readOnlyHint` 不是安全机制**，只是服务端自我声明；恶意 server 可以声称只读然后偷改文件。
   我们映射成 `read` 只代表"默认自动放行"，不代表可信。
3. **工具描述和结果都是不可信输入**。描述可能夹带提示词注入（"忽略之前的指令……"），返回内容里也可能
   藏指令。模型看到的外部文本要按"数据"而不是"命令"对待。
4. **环境变量会泄露给 server**。启动子进程时合并了 `process.env`，server 能看见你的 API key；接不可信
   server 时应像 `src/tools/bash.ts` 的 `scrubEnv` 那样做环境清洗。
5. **权限层仍生效**：没声明只读的 MCP 工具是 `exec` 类，默认要审批；plan 模式只注册 `readOnlyHint=true`
   的工具；非交互 `run` 不加 `--yolo` 时会被权限系统拒绝；工具太多还会挤占上下文。

一句话：**MCP 是能力扩展，不是安全扩展。** 信任边界要划在"接哪个 server"这一步。

## 14.9 它和 function calling 是什么关系？

| 对比项 | Function calling | MCP |
| --- | --- | --- |
| 解决什么 | 模型**怎么表达**"我要调工具" | 工具**从哪来、怎么发现和复用** |
| 谁定义 schema | 你的程序每次请求给 `tools` 数组 | server 通过 `tools/list` 自报 |
| 执行在哪里 | 你的进程内 | 独立 server 进程/远程服务 |
| 复用性 | 换个 Agent 得重写 | 一个 server 所有 Agent 都能用 |
| 上下文开销 | 只发你选的那几个工具 | server 工具可能很多，要自己筛 |

它们**不是替代关系**，本项目的接法就是标准答案：`MCP server --tools/list--> McpStdioClient --> Tool`
随 `chat/completions` 发给模型；模型返回 `tool_calls` 后，程序按名字找到 Tool 并 `client.callTool()` 让 MCP
server 真正执行。**MCP 管"工具供给侧"，function calling 管"模型侧协议"**。

## 14.10 调试与常见坑

三板斧：① stderr 全是线索（客户端日志带 `[mcp:server名]` 前缀，`MCP_ECHO_DEBUG=1` 让 fixture 打内部动作）；
② 裸管道验证协议（实验 2），先确认 server 能按规范说话；③ 看工具清单：Web 面板「工具与能力」Tab 或
`GET /api/state` 的 `tools`。

| 症状 | 常见原因 | 解决 |
| --- | --- | --- |
| 工具没出现 | 没放 `mcp.json`、路径不对、`disabled:true`、JSON 坏 | 看 stderr 的 `[mcp] 配置问题`；用 `MINI_MCP_CONFIG` 指绝对路径 |
| 调用一直超时 | server 工具很慢或卡住 | 30s 超时返回错误文本；给该 server 配 `timeoutMs` 调大 |
| 报"无法解析的 stdout 行" | server 往 stdout 打了日志 | 让 server 把日志改到 stderr（协议铁律） |
| 模型报"没有名为 mcp__x__y 的工具" | 名字被 sanitize / 截断 | 看 registry 里的真实名字；`-`、`.` 会变 `_` |
| 切工作区后还是旧工具 | 顺序错了或配置指纹没变 | 必须 `await ensureMcp()` → `buildRegistry()`；改 mcp.json 后下回合自动重载 |

## 14.11 本章小结

- MCP = 工具集成的"USB-C 标准"：**M×N 变 M+N**；数据层 JSON-RPC 2.0，传输层 stdio / Streamable HTTP。
  本项目实现经典握手路线（`2024-11-05`）：`initialize` → `notifications/initialized` →
  `tools/list`（cursor 分页）→ `tools/call`；2026-07-28 规范已改为无状态（`server/discover` +
  每请求 `_meta`），扩展点已留好。
- 适配层三件事：命名 `mcp__<server>__<tool>` + sanitize、`readOnlyHint` 决定 read/exec、`execute`
  拼 text content 并把 `isError` 变成错误文本；生命周期 `ensureMcp()` / `buildRegistry()` /
  `shutdownMcp()` 三段式，CI/退出都不能留孤儿。安全上记住：**MCP server 就是本地进程，能力=你的
  用户权限**，只读声明不可全信，工具描述/返回都是不可信输入，`npx` 供应链要谨慎。

## 14.12 练习
1. **加一个只读工具**：在 `test/fixtures/mcp-echo-server.mjs` 里加 `reverse` 工具（输入 text，返回反转
   文本）并标 `readOnlyHint: true`；给 `test/mcp.test.ts` 加用例，断言 `mcp__demo__reverse` 的
   `category === "read"`。提示：看 fixture 的 `TOOLS` 数组和 `callTool` 的 `switch`。
2. **让前缀可配置**：现在前缀写死 `mcp__`，假设有人想要 `ext__`——在不破坏现有测试的前提下把前缀改成
   可配置。提示：`mcpToolName` 是唯一入口，想想配置从哪传进来、测试怎么断言。
3. **给 MCP 子进程做环境清洗**：模仿 `src/tools/bash.ts` 的 `scrubEnv`，在启动子进程前删掉 `*_KEY` /
   `*_TOKEN` 类环境变量。先写测试（会回显 env 的 fixture 工具），再改实现——体会"安全改动要有测试兜底"。

---

👉 上一章：[第 13 章 轮数、步数与"真干活"](./13-轮数步数与真实干活-对照三家Agent.md)　|　下一章：[第 99 章 术语表与常见坑](./99-术语表与常见坑.md)
