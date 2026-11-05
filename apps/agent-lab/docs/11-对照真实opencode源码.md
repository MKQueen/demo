# 第 11 章 对照真实 opencode 源码

> **本章目标**：把你手搓的 `mini-opencode` 和真实 opencode 摆在一起，看清"哪些是 Agent
> 原理、哪些是工程厚度"。然后知道：我们故意省略了什么、为什么可以省略、想读真实源码
> 该从哪个文件开始，以及——**所有资料都有保质期**。
>
> 预计：30 分钟。官方资料抓取时间：2026-11-02。

---

## 11.1 直觉先行：先把"真实 opencode"校准

opencode 是一个开源 AI 编码 Agent，官方提供终端 TUI、桌面应用和 IDE 扩展三种形态
（[官方 Intro](https://opencode.ai/docs/)）。它有两个必须知道的事实：

1. **它现在是"两代并存"的。** 官方文档明确写着 OpenCode 1 和 OpenCode 2 都使用
   `opencode` 命令、不能在同一命令下并存安装；`/docs` 是 1.x 文档，`/v2/docs` 是 2.x
   文档（[V2 文档入口](https://opencode.ai/v2/docs/)、[V2 迁移说明](https://opencode.ai/v2/docs/migrate-v1/)）。
   你搜到的任何文章，第一件事就是确认它讲的是哪一代。
2. **它是 client-server 架构。** [官方 Server 文档](https://opencode.ai/docs/server/)原话：
   运行 `opencode` 时会同时启动 TUI 和 server，**TUI 是客户端**，通过 HTTP 与 server
   通信；server 暴露 OpenAPI 3.1 规范（`/doc`），SDK 就从这个规范生成。`opencode serve`
   可以只启动无头 server。

在此基础上，官方文档能核实的能力边界：

| 维度 | 官方说法 | 链接 |
| --- | --- | --- |
| 工具 | 内置 `bash` `edit` `write` `read` `grep` `glob` `lsp`(实验) `apply_patch` `skill` `todowrite` `webfetch` `websearch` `question` | [tools](https://opencode.ai/docs/tools/) |
| 权限 | `allow`/`ask`/`deny`；可用对象语法按参数做通配符规则（最后匹配者胜）；`external_directory`、`doom_loop` 是额外安全闸；`.env` 默认要审批 | [permissions](https://opencode.ai/docs/permissions/) |
| Agents | 主 Agent `build`/`plan`；子 Agent `general`/`explore`；还有隐藏的 `compaction`/`title`/`summary`；支持 JSON 和 Markdown 配置 | [agents](https://opencode.ai/docs/agents/) |
| 规则 | 项目 `AGENTS.md`、全局 `~/.config/opencode/AGENTS.md`，兼容 Claude Code 的 `CLAUDE.md` 回退 | [rules](https://opencode.ai/docs/rules/) |
| MCP | 本地（`command` 启动子进程）和远程（`url`）两种，远程支持 OAuth；MCP 工具会增加上下文占用 | [mcp](https://opencode.ai/docs/mcp-servers/) |
| Skills | `SKILL.md` 按需加载，frontmatter 必填 `name`/`description` | [skills](https://opencode.ai/docs/skills/) |
| LSP | 集成语言服务器把 diagnostics 反馈给 Agent；默认关闭，实验性 `lsp` 工具需开环境变量 | [lsp](https://opencode.ai/docs/lsp/) |
| 插件 | `.opencode/plugins/` 或 npm 插件；`tool.execute.before/after`、`session.idle` 等钩子；可注册自定义工具 | [plugins](https://opencode.ai/docs/plugins/) |
| Provider | 基于 AI SDK + Models.dev，官方称支持 75+ LLM provider | [providers](https://opencode.ai/docs/providers/) |
| 快照 | V2 的 `/undo`/`/redo` 同时回退对话和文件，依赖 Git worktree，快照存内部 git object 库 | [snapshots](https://opencode.ai/v2/docs/snapshots/) |

**非官方资料补充（必须标注）**：一份 2026-08-17 收录的逆向分析（
[《OpenCode 技术内幕》](https://github.com/cdavid817/agent-interview/blob/415c377f19d1caa11f5ace2dce09ebd7eae6de5c/docs/reference/deep-dive/opencode-%E6%8A%80%E6%9C%AF%E5%86%85%E5%B9%95.md)，
**非官方，基于 dev 分支 1.17.13，可能与官方实现不一致**）说：真实 opencode 是
TypeScript + Bun 的 monorepo（Turborepo 编排），大量使用 Effect；会话存 SQLite（Drizzle）
并做事件溯源；TUI 用 OpenTUI/Solid；仓库里 V1（`packages/opencode/src/session/` 的
`SessionPrompt` 单体）和 V2（`packages/core` 的事件溯源运行时）并存。这些**只能当参考**，
下一节会单独讲怎么对待它们。

---

## 11.2 真实结构 ↔ mini-opencode 映射表

这张表是第 0 章 0.6 节的扩展版。左边是真实 opencode（官方文档优先，非官方处标注），
右边是我们 27 个文件的教学版。

| 维度 | 真实 opencode | mini-opencode | 差距说明 |
| --- | --- | --- | --- |
| 定位 | TUI + 桌面 + IDE + server + SDK 多端产品 | CLI + 网页可视化面板（教学） | 多端是产品工程，不是 Agent 原理 |
| 语言/运行时 | TypeScript + Bun monorepo（非官方） | Node 24 原生跑 TS，零运行时依赖 | 我们刻意不要构建工具，源码即教材 |
| 架构 | client-server：TUI 通过 HTTP 连 server，OpenAPI 3.1 + SSE | 进程内直接函数调用 + stdout | 我们的"通信层"是函数调用和终端 |
| 会话 | SQLite + 事件溯源（非官方）；官方 API 有 session/message/events | JSONL 追加写 + 历史快照（`src/session.ts` 的 `appendSnapshot`） | 规模、并发、重放是工程需求 |
| 工具 | 文档列出的 13 个内置工具，`grep`/`glob` 底层是 ripgrep（子 Agent 另由 agents 机制提供） | 11 个：`bash` `edit` `write` `read` `grep` `glob` `todowrite` `task` `webfetch` `skill` `rewind` | 保留 Agent 闭环核心，并补了 CC/DSH 的联网、技能、回退 |
| 忽略规则 | ripgrep 尊重 `.gitignore`，可用 `.ignore` 反向放行 | 手写 `IGNORED_DIRS` 黑名单 | 教学版不处理复杂 ignore 语义 |
| 权限 | 三档 + 对象语法通配符 + 每 Agent 覆盖 + `external_directory`/`doom_loop` | 三档按工具类别 + 工具名覆盖 + 危险命令粗筛（`src/permission.ts`） | 保留了决策模型，简化了配置层 |
| Agents | build/plan + general/explore + 隐藏系统 Agent，可单独配模型/温度/步数 | build/plan 两种模式 + 一个通用 `task` 子 Agent | 见第 10 章 |
| 子 Agent | 官方：子 Agent 会创建 child session；非官方：独立 session drain | 全新 history、只读工具、无 session、禁止递归 | 我们只保留"上下文隔离"这一核心 |
| 提示词 | AGENTS.md + instructions；非官方说 V2 用可组合的 System Context | 模板字符串拼接 + AGENTS.md（`src/agent/prompt.ts`） | 动态更新/可组合是进阶能力 |
| Provider | AI SDK + Models.dev 目录，75+ provider，OAuth 登录 | OpenAI 兼容协议 + mock（`src/llm/`） | 我们靠 `LLMProvider` 接口留了扩展缝 |
| MCP | local/remote、OAuth、工具前缀、按需启用 | **stdio 本地 server**：初始化/列工具/调用/超时/权限，第 14 章 |
| Skills | `SKILL.md` 按需加载 | 无；`AGENTS.md` 一次性加载 | 渐进式披露 vs 全量注入 |
| LSP | 内置多语言 server，诊断回灌 | 无；用 `bash npm run typecheck` 代替 | 我们没有长驻语言服务器 |
| 快照 | `/undo`/`/redo` 对话+文件一起回退 | 只有会话历史快照（JSONL 的 `snapshot` 行），**没有文件回退** | 文件级回退需要 Git 或额外存储 |
| 插件 | 插件目录 + npm + 生命周期钩子 + 自定义工具 | 无；`AgentUI` 接口是唯一的"缝" | 接口隔离思想相同，机制未实现 |
| 配置 | `opencode.json` / `tui.json` + 环境变量 | `.env` + CLI 参数 + 少量环境变量（`src/config.ts`） | 我们只保留常用项 |
| 测试 | Bun test；非官方称偏好真实实现、少 mock | Node 内置 `node:test`，116 个测试（含 `test/session.test.ts` 6 个、`test/web.test.ts` 21 个、`test/mcp.test.ts` 24 个） | 覆盖核心循环、权限、上下文、SSE、会话快照 |

> 📌 一句话：**骨架（模型 + 工具 + 循环 + 上下文 + 权限）我们全有；差的是每一层的
> 工程厚度。** 读这张表时，重点看"差距说明"那一列——它告诉你真实项目在为什么买单。

---

## 11.3 我们故意省略了什么、为什么

| 省略项 | 真实怎么做（官方文档） | 为什么省略 | 想补从哪下手 |
| --- | --- | --- | --- |
| **LSP** | 集成语言服务器，把 diagnostics 作为反馈 | 需要长驻进程、协议握手、各种语言环境，和 Agent 主循环正交 | 先用 `bash` 跑 `tsc --noEmit` 形成"诊断回灌"闭环，再考虑接 LSP |
| **MCP** | 配置 local/remote server，OAuth，工具带前缀 | 远程 OAuth、Streamable HTTP、图片内容还没做 | 已实现 stdio 客户端（`src/mcp/`，第 14 章）；远程是下一个练习 |
| **webfetch/websearch** | 内置联网工具，受权限控制 | 引入网络、SSRF、内容注入风险，会让安全章节失焦 | 新增一个 `Tool`，`category: "exec"` 默认要审批，输出必须截断 |
| **Skills** | `SKILL.md` 按需加载 | 教学项目没有"技能库"的规模，`AGENTS.md` 已能演示"规则注入" | 扫描目录 + 在提示词里列 name/description + 加 `skill` 工具 |
| **快照/undo** | V2 每步前后抓快照，`/undo` 回退文件+对话 | 文件级回退需要 Git 对象库或文件副本；我们只做了会话历史快照（JSONL 的 `snapshot` 行），做不了文件回退 | 先接 `git stash`/`git diff`，把文件变化写进会话事件 |
| **插件/hooks** | 生命周期事件 + 自定义工具 | 会引入动态加载和第三方代码执行，安全和复杂度都高 | 在 `executeToolCall` 前后加钩子数组，`AgentUI` 已是现成范式 |
| **多 provider** | AI SDK + Models.dev，75+ | 我们只需要证明"provider 可替换"，mock 已做到 | 实现第二个 `LLMProvider`（如 Anthropic Messages），接口不变 |
| **Server/SDK** | 无头 HTTP server + OpenAPI + SSE + 生成 SDK | 多端通信是产品工程；单进程已能讲清 Agent | 把 `runAgent` 包进一个 HTTP handler，事件按 SSE 推给客户端 |
| **TUI 框架** | OpenTUI/Solid（非官方）；官方 TUI 功能丰富 | 终端渲染不是 Agent 原理，ANSI + readline 足够演示 | 先加多行输入/历史记录，再考虑换渲染框架 |
| **云/分享** | Console、Enterprise 分享等云端产品（官方导航可见；Zen 网关细节见非官方分析） | 商业与基础设施层，和 Agent 内核无关 | 不需要补，理解它属于产品层即可 |

省略不是偷懒，是**把预算花在原理上**。真实项目里每一层都是几十人年的工作量，
但它们的核心问题——上下文怎么管、工具怎么设计、权限怎么卡——和这 27 个文件是同一套。

---

## 11.4 代码导览：想读真实源码的建议顺序

直接冲进 monorepo 大概率会迷路。建议按"你会用到的顺序"读，每一步都拿本项目做对照。
先记住我们这边的"坐标"——一个工具在 `src/tools/types.ts` 里只由五样东西组成：

```ts
export interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  category: ToolCategory;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
```

去真实源码里找"每个工具怎么声明名字、描述、参数、执行函数"。它的写法可能不同（比如用
zod 定义参数、用 `tool()` 辅助函数包装），但**信息结构是一样的**；这个坐标能帮你快速
认出"哦，这是工具定义"，而不是被语法细节劝退。

1. **工具层**：先找工具定义（名字、描述、参数 schema、execute）。对照 `src/tools/files.ts`
   和 `src/tools/bash.ts` 看结构差异。官方 [tools 文档](https://opencode.ai/docs/tools/)
   是行为级地图，先看文档再看代码，效率最高。
2. **会话/提示词层**：一次用户输入是怎么变成请求的。对照 `src/agent/loop.ts` 的
   `runAgent` 和 `src/agent/prompt.ts`。⚠️ 非官方分析提到 V1 的 `SessionPrompt` 是约
   66KB 的单体文件——**别从它开始读**，先看官方 server 文档里的 session/message API 建立
   外部行为，再挑感兴趣的函数进去。
3. **Agent 定义**：内置 Agent 是怎么配置出来的（mode、prompt、model、steps、permission）。
   对照 `src/agent/prompt.ts` 的 `MODE_TEXT` 和 `buildSubagentSystemPrompt`。官方
   [agents 文档](https://opencode.ai/docs/agents/)把 build/plan/general/explore 的行为写得很清楚。
4. **权限层**：看 `allow/ask/deny` 怎么解析、通配符怎么匹配、ask 怎么弹给 UI。
   对照 `src/permission.ts`。官方 [permissions 文档](https://opencode.ai/docs/permissions/)
   解释了"对象语法、最后匹配者胜、external_directory、doom_loop"这些规则。
5. **Provider 层**：看模型请求怎么被适配、流式事件怎么统一。对照 `src/llm/types.ts`
   和 `src/llm/client.ts`（我们手写 SSE 解析，真实项目多用 AI SDK）。
   官方 [providers 文档](https://opencode.ai/docs/providers/)说明目录从哪来。

再补三条读源码的技巧：

- **用 GitHub 搜索代替通读。** 搜 `"tool.execute.before"`、`"external_directory"`、`"snapshots"`
  这类文档里出现过的字符串，能直接定位到实现。
- **先看生成代码之外的东西。** SDK 里大量文件是生成的，读它不如读协议定义。
- **用运行时观察代替静态阅读。** 装好 opencode 后 `opencode serve`，访问 `/doc` 就能看到
  完整 API 契约，比在源码里猜入口快得多。

---

## 11.5 资料时效性：把这句话刻在脑子里

**opencode 的架构演进非常快，任何"内部结构"描述都会过期。** 证据就在眼前：

- 官方 Intro 页面同时写着 OpenCode 1 和 OpenCode 2（[官方说明](https://opencode.ai/docs/)），
  `/docs` 和 `/v2/docs` 两套文档并存——这本身就是"资料会分层"的信号。
- 我们引用的非官方分析收录于 **2026-08-17**，基于 dev 分支 **1.17.13**，明确说自己
  "基于逆向分析与泄露源码整理，与官方实际实现可能不一致"（**非官方资料**）。它提到的
  V2 重构、Effect、包结构、`SessionPrompt` 体积，都可能在你读到这一章时已经变了。
- 连 `/undo` 的实现两代都不同：V1 TUI 文档说内部用 Git 管理文件变化；V2 snapshots 文档
  说快照存在 OpenCode 自己的 data 目录下的内部 git object 库。行为相似，实现不同。

所以本章的引用规则是：

| 内容类型 | 来源 | 怎么标注 |
| --- | --- | --- |
| 工具有哪些、权限怎么配、Agent 有哪些、MCP/Skills/LSP 怎么用 | 官方文档 | 直接给官网链接 |
| 包结构、Effect、SQLite 事件溯源、V1/V2 代码路径、SessionPrompt 大小 | 非官方逆向分析 | 必须写"非官方资料"，并注明版本/日期 |
| 具体版本号、文件行数、内部函数名 | 都不可靠 | 只作为线索，以官方仓库最新代码为准 |

**核实的正确姿势**：打开 <https://github.com/anomalyco/opencode>（官方文档页脚给出的仓库
地址），用默认分支的最新代码 + 官方文档对照。本章只对 **2026-11-02 抓取到的官方文档**
负责；如果你在半年后读到，请重新抓一遍。

---

## 11.6 动手实验

### 实验 A：把本项目的工具清单摸一遍（只读）

```bash
cd mini-opencode
node src/main.ts --help | head -20
grep -rn "name: \"" src/tools/*.ts
npm test 2>&1 | tail -8
```

预期：`--help` 列出命令和选项；`grep` 列出 11 个工具名（`read` `write` `edit` `glob`
`grep` `bash` `todowrite` `task`）；`npm test` 最后显示 `pass 74`。

### 实验 B：对照官方文档数工具（需要网络）

打开 <https://opencode.ai/docs/tools/>，和实验 A 的 8 个工具对比。你会发现真实 opencode
多了 `lsp` `apply_patch` `skill` `webfetch` `websearch` `question`。**先别急着补**——
回到 11.3 的表，看每个工具对应的是哪类工程成本。

### 实验 C：看真实 opencode 的 API 契约（可选，需安装 opencode）

```bash
opencode serve --port 4096
# 另开一个终端：
curl -s http://127.0.0.1:4096/doc | head -40
```

`/doc` 是官方文档承诺的 OpenAPI 3.1 规范入口。你会看到 sessions、messages、permissions、
mcp 等分组——这就是"client-server 架构"最直接的证据，不用读一行源码。

---

## 11.7 常见坑（读真实源码/资料时）

1. **把非官方分析当官方文档。** 它自己都写了"与官方可能不一致"。看到"V2 用 Effect"
   这种结论，先当成线索，再去官方仓库核实。
2. **忽略 V1/V2 两套文档。** 在 `/docs` 学到的行为，去 `/v2/docs` 可能已经变了；
   搜索时先看 URL 里有没有 `/v2/`。
3. **从最大的文件开始读。** 非官方分析说 V1 的 `SessionPrompt` 约 66KB——这种单体是
   历史包袱，不是入口。从工具和 API 契约切入。
4. **把配置文档当实现文档。** 文档告诉你"能配什么"，不告诉你"代码怎么跑"。行为用文档对，
   实现用源码对，别混。
5. **忘记默认值差异。** 官方权限默认整体宽松（多数 `allow`，`doom_loop`/`external_directory`
   为 `ask`，`.env` 要审批）；本项目教学默认 `write`/`exec` 是 `ask`。拿真实默认值套我们的
   配置，会得出相反结论。

---

## 11.8 本章小结

- 真实 opencode 是 client-server 架构的多端产品：TUI 是 client，server 暴露 OpenAPI 3.1，
  SDK 由规范生成；现在 OpenCode 1 与 2 两代并存、两套文档。
- 官方文档能核实的是"能力面"：工具列表、权限模型、Agents、规则、MCP、Skills、LSP、
  插件、Provider、快照。包结构/Effect/SQLite 事件溯源来自**非官方资料**，只能当线索。
- 我们省略了 LSP、远程 MCP、webfetch、Skills、快照、插件、多 provider、server/SDK、TUI 框架——
  省略的是工程厚度，不是 Agent 原理。
- 读真实源码的顺序：工具 → 会话/提示词 → Agent 定义 → 权限 → Provider；用 GitHub 搜索和
  运行时 API 契约辅助，别通读。
- 资料有保质期：V1/V2 已经在分叉，非官方分析基于 1.17.13（2026-08-17）。**以官方仓库
  最新代码为准。**

---

## 11.9 练习

1. **列一张你自己的对照表。** 从 `mini-opencode` 里挑 3 个"你觉得简单"的位置（比如
   `ToolRegistry`、`Permissions.check`、`fitContext`），去官方文档找一个对应能力，
   写下"如果要在真实项目里支持它，我还缺什么"。
2. **验证一个非官方说法。** 挑本章提到的"V1 `SessionPrompt` 约 66KB"或"V2 事件溯源"，
   去官方仓库用 GitHub 搜索/文件浏览核实。核实不了就记录"存疑"，这比记住一个错结论强。
3. **设计一个最小 server 版。** 这个练习第 12 章已经实现并变成了网页版：用 Node 内置
   `http` 把 `runAgent` 包起来，POST 发任务，把 `AgentUI` + `trace` 事件按 SSE 推给客户端。
   建议先自己写一遍再看 [第 12 章](./12-Web可视化与真实模型接入.md)。

---

👉 回到目录：[第 0 章 从零理解 Agent](./00-从零理解Agent.md) ·
👉 下一章：[第 12 章 网页版可视化](./12-Web可视化与真实模型接入.md) ·
👉 最后一章：[第 99 章 术语表与常见坑](./99-术语表与常见坑.md)
