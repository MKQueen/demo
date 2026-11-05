# 第 10 章 进阶：子 Agent 模式与 MCP

> **本章目标**：搞懂"主 Agent 派小弟去调研"到底省了什么、代价是什么，并顺着一次真实的
> `task` 调用把代码从头到尾跑一遍。最后把 MCP、Skills、LSP、插件、快照这几个你一定会
> 听到的名词，逐个回答"它解决什么问题"。
>
> 预计：35 分钟。读之前请先读完第 6 章（上下文管理）和第 8 章（系统提示词）。

---

## 10.1 直觉先行：办公桌与资料室

用户问："这个项目的权限系统是怎么实现的？"

**方案 A（笨办法）**：主 Agent 自己上。`grep` 找到 6 个文件、`read` 读 10 遍，几万 token 全塞进历史；
等它能回答时上下文已经用掉三万多 token，后面用户再说"顺便修个 bug"，它已经快没地方放了。

**方案 B（子 Agent）**：主 Agent 调用 `task("调研权限系统", "去读 src/permission.ts 和
相关调用方，回答：三档决策是什么、危险命令怎么处理、非交互终端为什么全拒")`。程序另起
一个**全新的 Agent 循环**，让它在自己上下文里翻那 10 个文件，最后只把一段结论（比如
300 字）交回来。主 Agent 的上下文只增加 300 字。

打个比方：**主 Agent 的上下文是办公桌，子 Agent 是资料室。** 在资料室里翻多少书都行，
但拿回办公桌上的，只能是一张便签。`src/agent/subagent.ts` 开头那句"只把 300 字结论返回
给主 Agent"，说的就是这件事。

## 10.2 它到底解决了哪几个问题

| 问题 | 不用子 Agent | 用了子 Agent |
| --- | --- | --- |
| 上下文占用 | 读过的每个文件全文都留在历史里 | 只留一段结论 |
| 注意力稀释 | 历史越长，模型越容易忽略中间的关键信息 | 主 Agent 的历史始终干净 |
| 误操作面 | 调研过程可能顺手 `write`/`bash` 改坏东西 | 子 Agent 只有 `read`/`glob`/`grep` |

注意：**子 Agent 不是"更聪明的模型"**，它和主 Agent 用同一个 provider、同一个模型。
它唯一的优势是"上下文干净 + 工具受限 + 目标单一"。

## 10.3 五个关键设计（先记住，再看代码）

| 机制 | 代码位置 | 为什么这么设计 |
| --- | --- | --- |
| 全新对话历史 | `src/agent/subagent.ts:71` | 不继承主 Agent 历史，避免污染，也避免两套历史混在一起 |
| 只读工具子集 | `subagent.ts:30` + `ToolRegistry.filterBy` | 从父注册表筛出 `read/glob/grep`，物理上不给写权限 |
| 独立步数与预算 | `subagent.ts:82,84` | `maxSteps` 默认 10；上下文预算最多 16000 token |
| 不写父会话记录 | `subagent.ts:89` | `session: undefined`，子 Agent 的中间过程不进父会话 JSONL |
| 禁止递归 | `subagent.ts:91` + 子注册表没有 `task` | 双保险：注册表里没有 `task`，回调也传 `undefined` |

还有 `silentUI()`（`subagent.ts:46-58`）：子 Agent 全程静默，主界面只显示
`↳ 派子 Agent 调研：xxx` 和 `子 Agent 返回 N 字符的结论` 两行，不然界面会分不清谁在干活。

## 10.4 代码导览：一次 task 调用的完整链路

先看全景（这张图值得画三遍）：

```
用户提问
  └─ runAgent（主循环，history = 完整会话）
       └─ 模型返回 task 工具调用 → taskTool.execute(args, toolCtx)
            └─ toolCtx.spawnSubagent(...)           ← main.ts 注入的闭包
                 └─ spawnSubagent()                 ← agent/subagent.ts
                      ├─ parentRegistry.filterBy(["read","glob","grep"])  ← 只读
                      ├─ history = [{ role: "user", content: prompt }]    ← 全新
                      └─ runAgent({ ... })          ← 递归！子循环
       └─ 返回的结论作为 tool 消息进入主历史（只占几百字）
```

### 第一步：task 工具只负责"传话"

`src/tools/task.ts` 里没有一行子 Agent 的实现，只做三件事：校验参数、检查能力、调用回调。

```ts
  if (!description || !prompt) return errorResult("task", "description 和 prompt 都不能为空");
  if (!ctx.spawnSubagent) return errorResult("task", "当前运行环境没有提供子 Agent 能力。");
  const result = await ctx.spawnSubagent({ description, prompt });
  return { title: `子 Agent · ${description}`, output: result };
```

### 第二步：依赖注入，切断循环依赖

如果 `task.ts` 直接 `import { runAgent } from "../agent/loop.ts"`，就会变成
`loop.ts → task.ts → loop.ts` 的循环依赖。解法：工具不 import 循环，只声明回调。
`ToolContext` 里只多一个可选函数（`src/tools/types.ts:51`）：

```ts
  spawnSubagent?: (request: SubagentRequest) => Promise<string>;
```

`src/agent/loop.ts:168` 在每轮开始时把它塞进 `toolCtx`：
`spawnSubagent: options.spawnSubagent`。**依赖注入在这里的唯一目的：让底层工具能调用
上层能力，但不认识上层模块。**

### 第三步：main.ts 把"本回合的上下文"绑进闭包

`src/main.ts:337-351` 的 `runTurn` 里，每轮临时构造一个 `spawn` 闭包，把**本回合的
`controller.signal`、本回合的 `registry`、同一个 `this.permissions`、`contextBudget`**
传给 `spawnSubagent`，并在派发/返回时各打一行提示。为什么不能写成模块级函数？因为
`signal` 和 `registry` 是**每回合**创建的：`plan` 模式下注册表里根本没有写工具；用户按
Ctrl+C 时 `signal` 中断，子 Agent 也必须一起停。**闭包把"这一次运行"的环境固定住了。**

### 第四步：spawnSubagent 真正开一个子循环

```ts
export async function spawnSubagent(options: SubagentOptions): Promise<string> {
  const registry = options.parentRegistry.filterBy(READ_ONLY_TOOL_NAMES);
  if (registry.all().length === 0) return "（父 Agent 没有提供只读工具，子 Agent 无法工作）";

  // 全新的对话历史：只有一条 user 消息。这是“上下文隔离”的关键。
  const history: ChatMessage[] = [{ role: "user", content: options.prompt }];

  const result = await runAgent({
    provider: options.provider, registry,
    system: buildSubagentSystemPrompt({ cwd: options.cwd, description: options.description }),
    history, cwd: options.cwd,
    maxSteps: options.maxSteps ?? 10,
    contextBudget: Math.min(options.contextBudget, 64_000), // 子 Agent 预算更小，但 64K 够翻完一个模块
    permissions: options.permissions, ui: silentUI(), signal: options.signal,
    // 不给子 Agent 会话记录、也不允许它再派子 Agent（防止无限递归）
    session: undefined, toolState: {}, spawnSubagent: undefined,
  });
```

最后从子 Agent 的历史里倒着找最后一条非空 `assistant` 文本，就是结论；找不到就返回
`（子 Agent 没有得出结论）`，被中断则追加一行提示（`subagent.ts:95-101`）。

### 第五步：所谓"递归"，其实是复用同一个 runAgent

`runAgent` 不关心自己跑的是主 Agent 还是子 Agent。它只认参数：`registry`、`system`、
`history`、`maxSteps`、`contextBudget`、`session`。子 Agent 就是"换一套参数再调一次
`runAgent`"，没有第二套循环实现。**你在第 3 章学的主循环，就是子 Agent 的全部执行引擎。**

---

## 10.5 代价与取舍：什么时候值得派子 Agent

先接受一句话：**子 Agent 不是免费的。** 它至少多一次模型调用（实际是多次），多一份
独立的 prompt 和工具往返，慢；而且它看到的只是 `prompt` 字符串——主对话里之前聊过什么，
它一概不知道。

| 场景 | 建议 |
| --- | --- |
| "这个项目里 X 是怎么实现的？" 需要翻很多文件 | ✅ 典型适合：读 10 个文件换 300 字结论 |
| 需要精确修改文件 / 答案依赖刚才的对话 | ❌ 子 Agent 只读、且是全新历史 |
| 很小的任务（读一个已知文件） | ❌ 多一次调用反而更慢更贵 |

本项目的实现还有几个明确上限：`maxSteps` 默认 10（`subagent.ts:82`），复杂调研可能不够；
预算封顶 16000 token（`subagent.ts:84`），超过靠压缩/裁剪，结论质量会下降；只能拿到
**最后一条 assistant 文本**；不能换模型——真实 opencode 可以给 agent 单独配模型，我们共用 provider。

> 💡 判断标准：**这次调研会不会把主 Agent 的上下文搞脏？** 会，就派子 Agent；
> 不会，就自己干，省一次调用。

## 10.6 延伸概念 1：MCP（Model Context Protocol）

**它解决什么问题**：假设有 M 个 Agent 产品（opencode、Claude Code、Cursor……）和 N 个
外部服务（数据库、Jira、Sentry、浏览器……）。没有标准时，每个 Agent 为每个服务写一遍
适配，总共 M×N 份工作。MCP 把它变成 M+N：服务方实现 MCP server，Agent 方实现 MCP
client，双方只按协议说话。

**协议长什么样**（[官方架构文档](https://modelcontextprotocol.io/docs/learn/architecture)）：
MCP 分两层——**数据层**基于 **JSON-RPC 2.0**，定义能力发现、工具、资源、提示词、通知；
**传输层**是 **stdio**（本地子进程）和 **Streamable HTTP**（远程；更早的规范用 HTTP+SSE，
所以旧文章里会看到"SSE 传输"）。连接生命周期是 `initialize`（交换协议版本和能力）→
操作 → 关闭。操作阶段最常用的两个方法：

```jsonc
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {} }
{ "jsonrpc": "2.0", "id": 2, "method": "tools/call",
  "params": { "name": "get_issue", "arguments": { "id": "PROJ-123" } } }
```

`tools/list` 返回的每个工具都带 `name`、`description`、`inputSchema`（JSON Schema）——
**这和本项目的 `Tool` 结构几乎一一对应**，所以适配层很薄：

```ts
// 真实实现见 src/tools/mcp.ts（下面是精简版结构，不是伪代码）
import { registerCachedMcpTools } from "./mcp.ts";

// buildRegistry(mode) 末尾：把 ensureMcp(cwd) 缓存的 MCP 工具挂进来
registerCachedMcpTools(registry, mode);
```

真正的适配在 `src/tools/mcp.ts` 的 `mcpToolName`/`execute`：工具名 `mcp__<server>__<tool>`，
description 加 `[MCP:<server>]` 前缀，`annotations.readOnlyHint` 为 true 时 category=read，
否则 exec（仍走权限审批）；参数 `inputSchema` 原样透传，结果取 `content[].type==="text"` 拼接、
16k 截断，`isError` 作为错误文本喂回模型。



这些工程量已经在本项目里落地：子进程启动/关闭、30s 超时、AbortSignal、tools/list 分页、
坏配置不崩、Web 切工作区后自动重载。还没做的：远程 OAuth、MCP 图片转多模态、`list_changed` 热更新——
留给第 14 章的练习。完整实现见 `src/mcp/`，教程见 [第 14 章](./14-MCP与工具生态.md)。

**真实 opencode 怎么做**（官方文档）：配置在 `opencode.json` 的 `mcp` 字段下，分
`type: "local"`（`command` 数组启动子进程）和 `type: "remote"`（`url` + `headers`，
支持 OAuth）；MCP 工具和内置工具一起交给模型，工具名带服务器前缀，可用 `"mymcp_*": false`
整体禁用。官方明确提醒：**MCP server 会增加上下文占用**，工具太多的 server（比如 GitHub）
很容易把上下文顶爆，要按需启用。详见 <https://opencode.ai/docs/mcp-servers/>。

## 10.7 延伸概念 2：Skills、LSP、hooks、快照

| 概念 | 解决什么问题 | 真实 opencode（官方文档） | 本项目的对应/缺口 |
| --- | --- | --- | --- |
| **Skills** | 系统提示词不能无限大：把"某类任务的做法"写成文档，先只暴露名字+描述，需要时再加载全文（渐进式披露） | `SKILL.md` 放在 `.opencode/skills/<name>/` 或全局目录；frontmatter 必填 `name`/`description`；`skill` 工具按需加载全文 | 没有 Skills。最接近的是 `loadProjectRules()` 把 `AGENTS.md` **一次性**全塞进提示词 |
| **LSP** | 模型改完代码，怎么知道类型/引用错没错？文本搜索只能找字符串，不懂语义 | 内置多种 LSP server（TS/Python/Go…），把 diagnostics 反馈给 Agent；默认关闭，实验性 `lsp` 工具需开环境变量 | 没有 LSP。只能 `bash` 跑 `npm run typecheck` / `npm test` 当"穷人版诊断" |
| **hooks/plugins** | Agent 核心不应该认识所有集成（通知、审计、脱敏、自定义工具）；需要在生命周期节点留钩子 | `.opencode/plugins/` 或 npm 插件；钩子如 `tool.execute.before/after`、`session.idle`、`shell.env`；插件也能注册自定义工具 | 没有插件系统。但 `AgentUI` 接口就是现成的缝：换 UI 不用改循环；同理可加钩子数组 |
| **快照/撤销** | Agent 改错了文件，能不能"人和文件一起回退"？ | V2 在每步模型调用前后抓快照，`/undo`、`/redo` 同时回退对话和文件；依赖 Git worktree，快照存在内部 git object 库 | 只有**会话历史快照**（JSONL 里的 `snapshot` 行），**不能撤销文件改动** |

补充：Skills 和 `AGENTS.md` 的区别不在格式，而在**加载时机**——前者是"贴在墙上的书名
目录，要用哪本再去拿"，后者是"每次请求都带上的员工手册"。LSP 也有反直觉的一点：官方
文档承认它可能和磁盘不同步、占内存，很多项目直接用 `lint`/`typecheck` 反而更稳——
所以"没有 LSP"不一定是缺陷，**有可靠的验证命令 + 让模型跑它**同样能闭环。

## 10.8 动手实验

### 实验 A：找到 task 的完整调用链（只读，30 秒）

```bash
cd mini-opencode
grep -rn "spawnSubagent" src/
```

预期能看到这些关键行（行号可能因实现微调）：

```
src/agent/subagent.ts:63:export async function spawnSubagent(...)
src/agent/loop.ts:168:    spawnSubagent: options.spawnSubagent,
src/main.ts:339:      const result = await spawnSubagent({
src/tools/task.ts:64:    const result = await ctx.spawnSubagent({ description, prompt });
src/tools/types.ts:51:  spawnSubagent?: (request: SubagentRequest) => Promise<string>;
```

沿着 `main.ts:339 → subagent.ts:63 → loop.ts:168` 读一遍，你就把"工具 → 回调 → 子循环"
这条链串起来了。

### 实验 B：亲手验证只读工具子集（不需要 API key）

```bash
node --input-type=module -e "
import { ToolRegistry } from './src/tools/registry.ts';
import { readTool, globTool, grepTool, writeTool } from './src/tools/files.ts';
const full = new ToolRegistry();
full.register(readTool).register(globTool).register(grepTool).register(writeTool);
console.log(full.names.join(','), '|', full.filterBy(['read','glob','grep']).names.join(','));
"
```

预期输出：`read,glob,grep,write | read,glob,grep`。

### 实验 C：用真模型体验 task（mock 不行）

mock 模型只会按剧本演 `bash/write/read/todowrite`，**没有 task 剧本**，所以 `--mock`
下你永远看不到子 Agent。配好 `.env` 的 key 后：

```bash
node src/main.ts run "用 task 工具派一个子 Agent 去调研 src/agent/subagent.ts 的实现，然后总结给我"
```

观察点：终端出现 `↳ 派子 Agent 调研：…`，隔一会儿出现 `子 Agent 返回 N 字符的结论`，
最后主 Agent 基于这段结论回答。N 通常只有几百。

---

## 10.9 常见坑

1. **`task` 的 prompt 写得太省。** 子 Agent 是全新历史，不知道你刚才聊了什么。"去看看那个
   文件"在它眼里等于没有信息；路径、目标、要回答的问题都要写全。
2. **想让子 Agent 顺便把文件改了。** 它只有只读工具，模型即使"想改"也会收到
   `没有名为 write 的工具`。改代码永远回主 Agent。
3. **把子 Agent 的结论当事实。** 它只返回最后一段文本，没有工具原始输出；结论里要求
   `文件路径:行号`，主 Agent 需要时再自己验证一遍。
4. **以为 `task` 能自动并行 / 在 mock 下等子 Agent。** 本项目一次只跑一个且主循环 `await`
   它；mock 也没有 task 剧本，这不是 bug。

## 10.10 本章小结

- 子 Agent 的本质是**用一次额外的模型调用，换主上下文的干净**。核心是上下文隔离。
- 机制只有五条：全新 history、只读工具子集、独立步数/预算、不写会话、禁止递归。
- `task` 工具不实现子 Agent，只通过 `ctx.spawnSubagent` 回调传话——这是切断
  `loop ↔ task` 循环依赖的依赖注入。
- 子 Agent 就是"换一套参数再调一次 `runAgent`"，没有第二套循环；代价是慢、贵、可能重复
  调研，只有"调研会弄脏主上下文"时才值得。
- MCP 用 JSON-RPC 把 M×N 的集成问题变成 M+N；Skills 用按需加载解决"提示词放不下"；
  LSP 给模型语义反馈；插件留生命周期钩子；快照让"对话 + 文件"可以一起回退。
  这些本项目都没实现，但你现在知道它们各自补的是哪块缺口了。

## 10.11 练习

1. **给子 Agent 加一个工具。** 想让子 Agent 也能用 `bash` 跑只读命令，你会改哪几行？
   提示：`READ_ONLY_TOOL_NAMES` 和 `buildRegistry`，再想想"只读 bash"怎么保证。
2. **让多个 task 并行。** 当前 `loop.ts` 是 `for (const call of calls) await ...` 串行执行。
   如果模型一次返回两个 `task` 调用，怎么改才能并行？提示：`Promise.all`，但要先想清楚
   两个子 Agent 同时写 `silentUI`、共享 `AbortSignal` 会不会有问题。
3. **把子 Agent 的"证据"带回来。** 现在只取最后一条 assistant 文本，试着约定它在结论里
   附上"关键文件:行号"，并在 task 工具描述里强调这一点，观察效果。

👉 下一章：[第 11 章 对照真实 opencode 源码](./11-对照真实opencode源码.md)
