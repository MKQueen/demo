# 第 3 章 Agent 循环：把 ReAct 装进 `while`

> **本章目标**：读懂本项目最核心的 200 行——`src/agent/loop.ts`。
> 读完你能：从零写出一个 Agent 循环、正确处理终止/错误/中断、
> 理解为什么循环里要留那么多"钩子"，并用测试证明循环是对的。
>
> 预计：60 分钟。对应代码：`src/agent/loop.ts`、`examples/03-mini-agent.ts`、`test/loop.test.ts`。

---

## 3.1 从"两轮往返"到"一直往返"

例 2 里我们手动走了两轮：

```
第 1 次请求 → 拿到 tool_calls → 执行 → 回填 tool 消息
第 2 次请求 → 拿到最终文本 → 结束
```

如果任务需要 8 步呢？难道手写 8 段请求？显然不行。

**把"两轮往返"放进 while 循环，就是 Agent。** 就这么简单，也这么重要。

```ts
while (步数 < 上限) {
  const 回复 = await 调模型(历史, 工具清单);
  历史.push(回复);

  if (回复 没有 tool_calls) break;   // 模型认为任务完成

  for (const 调用 of 回复.tool_calls) {
    const 结果 = await 执行工具(调用);
    历史.push(工具结果消息);
  }
  // 回到循环开头，模型会看到工具结果，决定下一步
}
```

`examples/03-mini-agent.ts` 就是这个伪代码的完整实现（约 100 行，无任何依赖）。
建议你现在就打开它，和这一章对照着读。

---

## 3.2 循环每一轮做的五件事

`src/agent/loop.ts` 的 `runAgent` 每一轮都按固定顺序做五件事：

| 步骤 | 代码位置 | 干什么 |
| --- | --- | --- |
| ① 管理上下文 | `fitContext` / `compactHistory` | 历史太长就先压缩，避免超窗口 |
| ② 调模型 | `provider.stream(...)` | 流式收集文本和 tool_calls |
| ③ 写历史 | `history.push(assistantMessage)` | 模型说了什么、要调什么，存起来 |
| ④ 判断终止 | `if (calls.length === 0) return` | 没有工具调用 = 任务完成 |
| ⑤ 执行工具 | `executeToolCall(...)` | 逐个执行，结果写回历史 |

然后回到 ①。**这五步的顺序不能乱**：
尤其③必须在⑤之前（工具结果要跟在 assistant 消息后面），
④必须在⑤之前（不然后面永远走不到）。

> 💡 一个判断技巧：如果你看到某个 Agent 行为诡异（比如工具结果被忽略、模型重复调用同一工具），
> 先检查它循环里的这五步顺序对不对。

---

## 3.3 什么时候停下来？

一个 `while` 循环必须有出口，否则就是死循环。Agent 有六种停法：

| 停止条件 | 触发时机 | 代码表现 |
| --- | --- | --- |
| **自然完成** | 模型某轮不再请求工具 | `if (calls.length === 0) return` |
| **达到步数上限**（可选） | 你显式设了 `maxSteps`（默认 `0`=不限） | 返回 `hitStepLimit: true` |
| **达到工具调用上限**（可选） | 你显式设了 `maxToolCalls`（默认 `0`=不限） | 暂停 + 补"未执行"结果 + 收尾 |
| **重复调用熔断** | 连续 3 次相同工具 + 相同参数 | 暂停 + 收尾（防止模型原地打转） |
| **用户中断** | Ctrl+C → `AbortController.abort()` | 返回 `aborted: true`，保留部分输出 |
| **致命错误** | 鉴权失败、网络断、JSON 坏到无法恢复 | 抛异常给上层处理 |

> **被上限暂停 ≠ 直接死掉**：`runAgent` 会调用 `finalizeTurn`——追加一条 `[系统]` 消息，
> 然后**不带工具**再请求一次模型，让它总结"已完成了什么、改了哪些文件、还剩什么"。
> 这个收尾总结会写进历史，所以恢复会话/继续对话时模型知道进度。

### 那为什么还保留 `maxSteps` 这个参数？

三个真实原因：

1. **模型可能死循环**：反复调用同一个工具、反复读同一个文件
2. **成本失控**：每轮都是一次 API 计费，无限循环就是无限烧钱
3. **任务卡死**：模型陷入"再确认一下"的循环，永远不结束

**默认不设上限**（对齐 Claude Code 交互模式与 Codex）：`maxSteps = 0` 表示不限。
原因是真实编码任务经常要读十几个文件、改几处、跑测试，固定上限很容易"干到一半被砍"。
但保留这个参数给 CI/无人值守场景：`--max-steps 200` 这类硬上限仍然是需要的。

达到上限不算"崩溃"，而是一种**正常的失败模式**：

```
! 本回合已暂停：步数上限（200）。已让模型给出进度小结；你可以继续发消息接着做，或用 --max-steps 调大上限。
```

注意这句话的措辞：它告诉用户"发生了什么、可以怎么办"，而不是只报一个数字。
**Agent 的每一种失败都要对用户可解释**——这是产品化的重要细节。

---

## 3.4 错误处理的三个原则

Agent 里到处都是会失败的东西。`loop.ts` 的处理原则可以总结为三条：

### 原则 1：工具内部的一切失败，都变成"模型能看懂的 tool 消息"

```ts
// runToolSafely：永不抛异常
try {
  return await tool.execute(validation.value, deps.toolCtx);
} catch (err) {
  return { title: name, output: `工具执行过程中出错：${messageOf(err)}`, isError: true };
}
```

为什么？因为**模型是唯一能修正错误的一方**。
你把异常抛出去，模型永远不知道发生了什么，也就没法重试。
把错误变成 tool 消息，模型下一轮就能改参数、换命令。

### 原则 2：协议层的错误，给模型最具体的提示

模型把工具名写错：告诉它"当前可用工具：read, write, bash..."。
模型把 JSON 写坏：把原始参数和解析错误一起给它。
参数类型错：逐个字段列出"哪个字段、期望什么、收到什么"。

对比一下两种错误消息：

```
❌ {"error": "Invalid arguments"}
✅ 参数校验失败：
   - 缺少必填参数 "path"
   - limit 应该是整数，收到的是 string
   请修正参数后重新调用这个工具。
```

后者模型一次就能改对。**错误消息的质量，直接决定 Agent 的自愈能力。**

### 原则 3：模型 API 的错误，交给上层决定重试还是终止

网络错误、429、5xx 由 `client.ts` 的重试层处理；
401/400 这类"重试没用"的错误直接抛给 `main.ts`，翻译成用户能看懂的提示。

**分层原则：底层知道"怎么修"，上层知道"要不要修"。**

---

## 3.5 中断：Ctrl+C 之后发生了什么

用户按 Ctrl+C 时，理想行为不是"直接杀进程"，而是：

1. 立刻停止等待模型/工具
2. **保留已经生成的内容**（用户可能想接着聊）
3. 回到 REPL，历史还在

实现靠两个东西：

**① `AbortController`**：从 `main.ts` 传到 `runAgent`，再传到 `fetch` 和每个工具：

```
main.ts 创建 controller
  → runAgent(options.signal)
    → provider.stream({ signal })   → fetch 立刻中止
    → toolCtx.signal                → bash 杀子进程、read 等操作可检查
```

**② 两种中断位置，收尾方式不一样**：

**情况 A：正在流式生成时中断** —— 把已经流出的文本保存成一条 assistant 消息（别让用户的话白说）：

```ts
if (signal.aborted || isAbortError(err)) {
  if (text.trim()) {
    const partial: ChatMessage = {
      role: "assistant",
      content: text + "\n\n[本回合被用户中断]",
    };
    history.push(partial);
    options.session?.persistMessage(partial);
  }
  return { steps, usage, aborted: true, hitStepLimit: false, toolDenials };
}
```

**情况 B：正在执行工具时中断** —— 这里有个协议陷阱：assistant 消息里可能声明了 3 个 `tool_call`，
但只执行完 1 个就中断了。**缺少 tool 结果的历史是"非法"的**，恢复会话后接真实模型会 400。
所以要给没执行的调用补一条"被中断"的结果：

```ts
for (let index = 0; index < calls.length; index++) {
  if (signal.aborted) {
    // 给所有“还没来得及执行”的调用补一条 tool 消息，保证协议配对完整
    for (const pendingCall of calls.slice(index)) {
      appendInterruptedToolResult(pendingCall, { history, session: options.session });
    }
    return { steps, usage, aborted: true, hitStepLimit: false, toolDenials };
  }
  await executeToolCall(calls[index]!, { /* … */ });
}
```

```ts
function appendInterruptedToolResult(call, deps) {
  const message: ChatMessage = {
    role: "tool",
    tool_call_id: call.id,
    name: call.function.name,
    content: "[用户中断：这个工具没有执行]",
  };
  deps.history.push(message);
  deps.session?.persistMessage(message);
  deps.session?.appendEvent({ type: "tool", name: call.function.name, interrupted: true, at: nowIso() });
}
```

> 🐛 这个坑是独立验收时实测出来的：中断后历史里 `assistant(calls:c1,c2)` 只有 `tool(c1)`，
> 用 `--session` 恢复接真实接口直接 400。修复就是"补配对"，并加了回归测试
> （`test/loop.test.ts` 的「中途中断会为未执行的工具补齐 tool 消息」）。

`main.ts` 里的信号处理：

```ts
process.on("SIGINT", () => {
  if (app.isGenerating) app.abortCurrentTurn();  // 生成中 → 中断本回合
  else app.shutdown(0);                          // 空闲 → 退出
});
```

**注意 skill 细节**：非 TTY 环境（管道、CI）里没有 Ctrl+C，abort 更多用于超时/上层取消。

---

## 3.6 完整代码导览：`src/agent/loop.ts`

这个文件只有两个公开函数 + 几个内部函数，我们按调用顺序看。

### `runAgent(options)` —— 主循环

参数很多，但每个都有存在理由（这也是"钩子设计"的体现）：

```ts
export interface AgentRunOptions {
  provider: LLMProvider;          // 模型（可替换：真/mock）
  registry: ToolRegistry;         // 可用工具（按模式裁剪）
  system: string;                 // 系统提示词
  history: ChatMessage[];         // 对话历史（会被原地修改）
  cwd: string;                    // 工作目录（工具边界）
  maxSteps: number;               // 步数上限（默认 0=不限）
  maxToolCalls?: number;          // 工具调用上限（默认 0=不限）
  contextBudget: number;          // token 预算
  permissions: Permissions;       // 权限检查
  ui: AgentUI;                    // 渲染接口
  signal: AbortSignal;            // 中断信号
  session?: SessionSink;          // 持久化（可选，测试时可省）
  toolState?: Record<string, unknown>;  // 工具共享状态（todo）
  spawnSubagent?: (...) => Promise<string>; // 子 Agent 能力
}
```

**注意 `history` 是"原地修改"的**（`push` 新消息）。这是有意设计：
主循环拥有历史数组的所有权，UI 和 session 只是观察者。
（这里藏着一个我们真踩过的 bug：如果 session 也往里 push，历史就会重复，见第 7 章。）

主循环里最值得细看的几段：

**① 上下文压缩放在调模型之前**

```ts
const rawTokens = estimateMessagesTokens(history);
if (rawTokens > contextBudget && history.length >= 8) {
  const compacted = await compactHistory({ messages: history, provider, signal, keepRecent: 4 });
  history.splice(0, history.length, ...compacted.messages);
  // ...
}
const fitted = fitContext(history, contextBudget);
```

先尝试"贵但不丢信息"的 LLM 摘要，失败再退化为"便宜但会丢"的裁剪。
这个降级顺序很重要。

**② 流式事件的收集**

```ts
for await (const event of provider.stream([{ role: "system", content: system }, ...promptMessages], {
  tools: toolDefinitions,
  signal,
})) {
  switch (event.type) {
    case "text":  text += event.text; ui.assistantText(event.text); break;
    case "thinking": ui.assistantThinking(event.text); break;
    case "tool_calls": toolCalls.add(event.toolCalls); break;
    case "usage": addUsage(usage, event.usage); break;
    case "done": break;
  }
}
```

**③ 终止判断：没有工具调用就是完成**

```ts
if (calls.length === 0) {
  return { steps, usage, aborted: false, hitStepLimit: false };
}
```

这是整个循环唯一的"自然出口"。

### `executeToolCall(call, deps)` —— 执行 + 回填

```ts
deps.ui.toolStart(name, oneLine(call.function.arguments));  // UI：开始
const result = await runToolSafely(call, deps);             // 五步防护
const durationMs = Date.now() - startedAt;
deps.ui.toolEnd(result, durationMs);                        // UI：结束

const toolMessage: ChatMessage = {
  role: "tool",
  tool_call_id: call.id,      // 必须配对
  name,
  content: result.output,     // 无论成功失败都要回填
};
deps.history.push(toolMessage);
deps.session?.persistMessage(toolMessage);
```

### `runToolSafely(call, deps)` —— 五步防护

| 步骤 | 检查 | 失败时给模型的提示 |
| --- | --- | --- |
| 1 | 工具存在吗 | "当前可用工具：…" |
| 2 | JSON 能解析吗 | "原始参数是…，解析失败：…" |
| 3 | schema 匹配吗 | "缺少必填参数 / 类型错误…" |
| 4 | 权限允许吗 | "权限系统拒绝：…不要尝试绕过" |
| 5 | 执行抛异常吗 | "工具执行过程中出错：…" |

**这五步是 Agent 鲁棒性的全部秘密。** 每一步都确保：程序不崩、模型知情、下一轮可修正。

---

## 3.7 为什么循环里要留"钩子"（依赖注入）

你可能会问：为什么 `runAgent` 要收那么多参数，而不是直接 `import` 那些模块？

因为**这些能力都应该可替换**：

| 钩子 | 生产实现 | 测试实现 | 换掉的理由 |
| --- | --- | --- | --- |
| `provider` | 真模型 / mock | 剧本 provider | 离线测试、换厂商 |
| `ui` | 终端渲染器 | 静默/记录 UI | 换网页 UI、断言事件顺序 |
| `permissions` | 交互审批 | 固定 allow/deny | 测试权限分支 |
| `session` | JSONL 落盘 | 内存记录 | 测试持久化 |
| `spawnSubagent` | 子 Agent | undefined | 测试不支持子 Agent 的场景 |
| `trace` | 结构化步骤事件（Web UI / 日志） | 不传 | 想观测每一步时（见第 12 章） |

> `AgentUI` 负责"给人看的流式渲染"，`trace` 负责"给机器看的结构化记录"。
> 两者刻意分开：终端 UI 可以换成网页、桌面端，trace 的字段保持稳定。

这不是"过度设计"，而是**测试友好**的直接收益：
`test/loop.test.ts` 里用 20 行的"剧本 provider"就把整个循环测了，完全不联网。

> 📌 一个经验：当你发现某个模块"没法测"，通常不是测试的问题，
> 而是它把依赖写死了。把依赖从参数传进来，就活了。

---

## 3.8 怎么证明循环是对的：读测试

`test/loop.test.ts` 有 11 个用例，每个都在验证一条控制流规则：

| 测试 | 验证的规则 |
| --- | --- |
| 工具调用 → 执行 → 回填 → 收尾 | 正常路径的消息顺序 |
| 坏 JSON | 错误回喂后循环继续 |
| schema 不合法 | 具体字段错误被回喂 |
| 未知工具 | 提示可用工具列表 |
| 权限拒绝 | 拒绝信息对模型可见 |
| 达到 maxSteps | 循环会停，且步数正确 |
| 工具调用超上限 | 补一条"未执行"tool 消息，并让模型收尾 |
| 重复调用熔断 | 连续 3 次相同调用会停下，同样收尾 |
| 用户中断 | 保留部分文本 | 
| 中断多工具调用 | 未执行的 tool_call 也补一条"被中断"结果（否则恢复后 400） |
| UI 事件顺序 | 流式语义（start → delta → end → tool…） |

**测试即文档**：如果你想知道"循环在各种情况下应该怎么表现"，读这些测试比读源码快。

```bash
npm test
```

---

## 3.9 动手实验

**实验 1：跑一个真正的循环（离线）**

```bash
node examples/03-mini-agent.ts --mock
```

观察输出：3 轮、2 次工具调用、历史共 7 条消息。

**实验 2：把上限调成 1，看失败长什么样**

编辑 `examples/03-mini-agent.ts`，把 `const MAX_STEPS = 8;` 改成 `1`，再跑。
你会看到它写完文件就停了，没来得及读、也没总结。
**思考**：这个失败是"可解释"的吗？用户会知道发生了什么吗？

**实验 3：让工具故意失败**

把 `examples/03-mini-agent.ts` 里的 `executeTool` 改成永远抛异常：

```ts
function executeTool(): string {
  throw new Error("我是故意报错的工具");
}
```

再跑。观察：程序没有崩，模型收到了错误消息，下一轮还能继续。
（假模型不会"改"，但真模型通常会尝试别的方法。）

**实验 4：改坏循环，看哪个测试会红**

打开 `src/agent/loop.ts`，把 `history.push(assistantMessage)` 这一行注释掉，然后：

```bash
npm test
```

至少会有 3 个测试失败。恢复代码后全部通过。
**这个练习的价值**：让你体会"测试是安全网"，而不是负担。

**实验 5：观察真实 Agent 的循环**

用真模型跑：

```bash
node src/main.ts run --yolo "列出 src 目录的文件，读出 loop.ts 的行数并告诉我"
```

观察它每一步的工具调用、结果回填、以及最后的总结。
你会看到和例 3 一模一样的结构，只是工具更多、UI 更好看。

---

## 3.10 常见坑

| 坑 | 症状 | 原因 / 解决 |
| --- | --- | --- |
| 忘了 push assistant 消息 | 模型重复调同一工具 / 接口报错 | 每轮模型回复必须先落历史，再执行工具 |
| 工具结果没有 `tool_call_id` | 接口 400 | 用 `assistant.tool_calls[i].id` 原样回填 |
| 工具错误直接 throw | 整个程序崩，模型不知情 | 包成 `{ isError: true }` 的 tool 消息 |
| 没有 `maxSteps` | 死循环、烧钱 | 永远给循环一个上限 |
| **历史重复 push**（真实踩过） | 模型看到两份相同对话，行为错乱 | 历史所有权只归主循环；持久化层只写盘（`persistMessage`） |
| 上下文超限才处理 | 跑到中途 400 | 每轮调模型**之前**就裁剪/压缩 |
| 中断时直接杀进程 | 部分输出丢失 | AbortController + 保存部分文本 |
| 工具并行执行但顺序不回填 | 模型对不上结果 | 按 tool_calls 顺序回填（或至少保证 id 配对） |

---

## 3.11 本章小结

- Agent = 把"调模型 → 执行工具 → 回填结果"放进 `while` 循环。
- 每轮五步：管上下文 → 调模型 → 写历史 → 判终止 → 执行工具。
- 六种停法：自然完成、步数上限（可选）、工具调用上限（可选）、重复熔断、用户中断、致命错误；每种都要对用户可解释。
- **上限默认关闭**（0=不限），卡死熔断默认开启但可关；这是"能干活"和"防失控"的折中。
- 被硬上限暂停时要"优雅收尾"（不带工具再请求一次总结），而不是直接冷冰冰停掉。
- 工具失败不抛异常，转成 tool 消息让模型自我修正；错误信息越具体，自愈越快。
- 中断靠 AbortController 贯穿 fetch/工具；要保留已生成内容，并为未执行的 tool_call 补齐结果（协议完整性）。
- 主循环只做编排，所有能力（模型/UI/权限/持久化/子 Agent）通过参数注入。
- 剧本 provider + 8 个测试，就能在离线状态下把整个循环钉死。

---

## 3.12 练习

1. **从零默写**：合上本章，用伪代码写出 Agent 循环（五种停止条件里的前三种）。
   写完对照 3.1 节，看漏了什么。
2. **加一个停止条件**：如果连续 3 轮模型都调用同一个工具且参数完全相同，就主动停下并提示用户。
   提示：在主循环里维护一个 `Map<工具名+参数, 次数>`。
3. **让错误更友好**：在 `runToolSafely` 的第 5 步，把异常堆栈的前 3 行也放进 output，
   但只在 `--debug` 模式下。思考：为什么默认不给模型看堆栈？
4. **思考题**：为什么 `maxSteps` 用"轮数"而不是"总 token 数"来限制？两者要不要同时设？
   如果要换成 token 总量限制，应该在哪里统计？会遇到什么麻烦？

---

👉 上一章：[第 2 章 消息与工具调用协议](./02-消息与工具调用协议.md)　|　下一章：[第 4 章 文件工具与路径安全](./04-文件工具与路径安全.md)
