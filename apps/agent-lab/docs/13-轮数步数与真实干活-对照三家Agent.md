# 第 13 章 轮数、步数与"真干活"：对照 Claude Code / Codex / DeepSeek Harness

> **本章目标**：回答一个非常实际的问题——**为什么有的 Agent 能自己改半天代码，有的聊两句就停？**
> 我们把三家主流 Agent 的循环约束拆开对比，然后照着调教自己的 `mini-opencode`：
> 提高步数、加工具上限、加重复熔断、加优雅收尾、加"自动改文件"档位。
>
> 预计：40 分钟。对应代码：`src/agent/loop.ts`、`src/config.ts`、`src/permission.ts`、`src/web/server.ts`。

---

## 13.1 先把三个词分清楚

大家说"轮数/步数"时，经常混用三个完全不同的东西：

| 概念 | 英文 | 是什么 | 谁在限制 |
| --- | --- | --- | --- |
| 回合 | turn | 一次用户输入 → Agent 干到"自认为完成"或停下 | 用户 / 预算 / 权限 |
| 步 | step | 回合内**一次模型请求**（模型说一句话或请求一批工具） | 执行器（步数上限） |
| 工具调用 | tool call | 一次真实副作用（读文件、改文件、跑命令） | 执行器（工具上限） |

还有一个经常被忽略的：**token / 费用预算**。步数少不代表花钱少——一步里模型可能生成 6 万 token、并行调 8 个工具。

> 所以"Claude Code 能跑多少步"这个问题，正确问法是：
> **「它有没有硬步数上限？靠什么兜底？权限和预算怎么配？」**

---

## 13.2 Claude Code：交互模式没有硬步数上限，但有一整套刹车

按官方 CLI/成本文档与第三方对照表（2026-10 更新）整理：

| 维度 | Claude Code 的做法 |
| --- | --- |
| 步数上限 | **交互模式没有硬上限**；`--max-turns` 只用于 `-p`（print/headless）模式，计"agentic turns" |
| 费用 | `--max-budget-usd` 可设美元预算（估算，可能略超阈值） |
| 工具调用 | 没有单独的"工具次数"硬上限；靠权限逐次确认 |
| 权限档 | `default`（逐次问）/ **`acceptEdits`（自动允许改文件）** / `plan`（只读）/ `bypassPermissions`（等价 `--dangerously-skip-permissions`） |
| 上下文 | 接近窗口时自动 compact（摘要压缩） |
| 子 Agent | 支持子任务隔离上下文 |
| 事故 | 官方 issue #15909：子 Agent 重试同一条命令 300+ 次、约 2700 万 token / 4.6 小时——所以"没硬上限"必须配合别的刹车 |

资料来源：
[Claude Code CLI reference](https://code.claude.com/docs/en/cli-reference)、
[Manage costs effectively](https://code.claude.com/docs/en/costs)、
[第三方面板参数对照（2026-10-15）](https://github.com/ScottRBK/agent-shell/blob/main/docs/development/agent_parameter_comparison.md)、
[失控循环案例整理](https://github.com/XuebinMa/AIWiki/blob/main/docs/05-implementation/runaway-agent-loops.mdx)、
[issue #15909](https://github.com/anthropics/claude-code/issues/15909)。

**给我们的启示**：
1. 想要"真干活"，不要一上来就卡 20 多步；
2. 但必须有别的刹车（工具上限、重复熔断、预算、用户 Stop）；
3. `acceptEdits` 是最实用的档位——改文件不再逐个点，但 shell 仍要确认。

---

## 13.3 OpenAI Codex：连 `--max-turns` 都没有，靠审批 + 沙箱

Codex CLI 的策略和 Claude Code 不同：

| 维度 | Codex 的做法 |
| --- | --- |
| 步数上限 | **没有 `--max-turns`**（社区在 issue #12336 里请求加这个参数） |
| 审批档 | `--ask-for-approval untrusted / on-request / never`；`--full-auto` 自动批准除高风险外；`--yolo` 全放行 |
| 沙箱 | `read-only` / `workspace-write` / `danger-full-access`，用文件系统边界兜底 |
| 上下文 | 配置 `model_context_window` / `model_max_output_tokens`，接近窗口自动压缩 |
| 会话 | 支持 resume，长任务跨次继续 |

资料来源：
[Codex Agent approvals & security](https://developers.openai.com/codex/agent-approvals-security)、
[issue #12336：请求增加 --max-turns](https://github.com/openai/codex/issues/12336)、
第三方面板对照。

**给我们的启示**：
1. 不设步数上限时，**审批 + 沙箱**就是主要约束；
2. 但沙箱只限制"能碰哪里"，**不限制花多少 token / 调多少次工具**——这两件事要分开做；
3. 长任务要有 resume / 进度可恢复。

---

## 13.4 DeepSeek Harness：社区治理插件给出"保守基线"

DSH 本身把循环扩展点暴露成 `agent/pre-step`（请求前）和 `tools/pre-execute`（工具执行前）。
社区插件 [`dsh-turn-budget`](https://github.com/Nunchakus888/dsh-turn-budget) 用这两个点做了一个 **fail-closed**（超限就拒绝、不猜）的每回合预算器，**默认基线**：

```
maxStepsPerTurn           = 24     # 每回合最多 24 次模型请求
maxToolCallsPerTurn       = 40     # 每回合最多 40 次工具执行
maxProviderTokensPerTurn  = 250000 # 可选：每回合最多 25 万 provider token
```

它的语义值得抄：
- 超限时是 **拒绝下一步请求 / 拒绝下一次工具执行**，不是"提醒提示词"；
- 达到工具上限时，**还会给模型留一次不带工具的输出机会**（收尾总结）——和我们下面实现的一样；
- token 计数只认 provider 报告的 usage，不估算。

> 注意：这是**社区插件**的默认值，不是 DeepSeek Harness 的官方默认值；但它反映了一个现实：
> 即使是"能干活"的 harness，也需要一个显式的每回合预算。

---

## 13.5 三家对照总表

| 维度 | Claude Code | Codex CLI | DeepSeek Harness（社区治理基线） | mini-opencode（本章之后） |
| --- | --- | --- | --- | --- |
| 单回合步数上限 | 交互无；print `--max-turns` | 无参数 | 24（插件） | **默认不限**（`0`；需要时 `--max-steps`） |
| 工具调用上限 | 无单独参数（靠审批） | 无（靠审批/沙箱） | 40（插件） | **默认不限**（`0`；需要时 `--max-tool-calls`） |
| token/费用上限 | `--max-budget-usd` | 无直接参数 | 25 万 token（可选） | 上下文预算 + 每回合 usage 可见（可继续加） |
| 自动改文件 | `acceptEdits` 档 | `--full-auto` + workspace-write | 审批配置 | **`--accept-edits` / 网页「自动改文件」** |
| 只读规划 | `plan` 档 | `--sandbox read-only` | plan 模式 | plan 模式（只有 5 个只读工具） |
| 上下文压缩 | 自动 compact | 自动压缩 | 扩展点 | 摘要压缩 + 整轮裁剪 + 快照 |
| 重复调用熔断 | 无（issue 事故） | 无 | 有（步数/工具/token） | **有（默认开，`--no-repeat-guard` 可关）** |
| 达到上限的收尾 | 无统一 | 无统一 | 留一次输出机会 | **有（自动请求进度小结）** |

---

## 13.5.1 先纠正一个错误：默认不该设硬上限

这一章之前在项目里落地时，我把默认值设成了 **64 步 / 120 次工具**——这是**误读**：
三家在交互模式下都**没有硬步数上限**，64/120 只是 DSH 社区插件的保守基线。

更糟的是有真实代价：就在写这版文档时，一个真实任务在 **120 次工具调用处被暂停**，
多模态改造做到一半被迫停下（`types.ts`/`content.ts` 已写、UI 还没做）。
工具上限对"无人值守/CI"是有用的，但对"用户坐在屏幕前看着它干活"是纯摩擦。

所以改成：

```ts
// src/config.ts
maxSteps: 0,        // 默认不限（对齐 Claude Code 交互模式 / Codex）
maxToolCalls: 0,    // 默认不限
repeatGuard: true,  // 默认只保留“卡死检测”，它不是数量上限
```

**上限保留为可选参数**：`--max-steps 200`、`--max-tool-calls 300`，给 CI、批处理、无人值守用。
网页「模型配置」里也能改，`0` 就是不限。

---

## 13.6 我们具体改了什么

### 1）默认不限步数/工具数，上限变成可选

- `maxSteps=0`、`maxToolCalls=0`：不限（默认）；
- 需要时 `--max-steps 200` / `--max-tool-calls 300`；
- 真正兜底的是：**用户 Stop**、**卡死熔断**、**上下文自动压缩**、以及可选的 token/费用预算（后续可加）。

### 2）卡死熔断（不是数量上限）

连续 3 次"相同工具 + 相同参数"就停，防止模型在原地打转（Claude Code 的 2700 万 token 事故就是这类）。
它只在"完全重复"时触发，正常读文件/跑测试不会误伤；不想要可以 `--no-repeat-guard` 或 `MINI_REPEAT_GUARD=0` 关掉。

### 3）重复调用熔断的细节

这是三家都没有显式参数、但真实事故（Claude Code #15909）暴露出的需求。
实现位置在 `src/agent/loop.ts` 的工具执行循环：

```ts
const signature = `${call.function.name}:${call.function.arguments}`;
sameToolStreak = signature === lastToolSignature ? sameToolStreak + 1 : 1;
if (sameToolStreak >= 3) {
  stopReason = "repeat";
  // 给没执行的 tool_call 补一条“未执行”的 tool 消息（保证协议完整）
  break runLoop;
}
```

### 4）优雅收尾：被上限/熔断暂停时，让模型做一次"不调工具"的总结

```ts
// 追加一条 [系统] 用户消息，然后不带 tools 再请求一次
const request = [
  { role: "system", content: system },
  ...history,
  { role: "user", content: "[系统] 本回合因为「…」暂停了。请不要再调用任何工具，用简短中文总结…" },
];
```

这样用户看到的不是冷冰冰的"到达上限"，而是：
**改了什么、还剩什么、下一步建议**。这对应 DSH 插件里"留一次输出机会"的设计。

### 5）acceptEdits：自动改文件，但 shell 仍然要问

```ts
// src/permission.ts
if (this.acceptEdits && tool.category === "write") {
  return { allowed: true, reason: "acceptEdits 模式：自动允许修改文件" };
}
```

- CLI：`--accept-edits`
- 网页：顶栏「自动改文件」开关
- 它只放行 `write` / `edit`；`bash` 仍然走审批，危险命令仍然黄字警告。
- 效果：让 Agent 真的能连续改代码，而不是每一步都等你点"允许"。

---

## 13.7 动手实验

**实验 1：不自动改文件 vs 自动改文件**

```bash
npm run web
# 不开「自动改文件」：让它改 3 个文件 → 每个 write/edit 都弹审批
# 开「自动改文件」：同样任务 → 文件操作直接过，bash 仍会问
```

**实验 2：故意触发工具上限（可选上限）**

```bash
node src/main.ts run --mock --yolo --max-tool-calls 2 "帮我创建一个 hello.txt"
```

观察：第 3 个工具被标记"已暂停，未执行"，随后出现【收尾小结】和"本回合已暂停"。
（mock 模型的收尾是固定文案；真模型会真的总结。）

**实验 3：重复熔断**

把 `--max-tool-calls` 调大，然后让一个模型反复调用同一个工具。
真实模型下可以提示它："请反复执行 `ls` 十次"。观察第 3 次相同调用触发熔断。

**实验 4：默认不限步数跑长任务**

```bash
node src/main.ts run --yolo "把 src 里所有 console.log 清理掉并跑测试"
```

默认就是不限（`maxSteps=0`）；想给无人值守加保险才显式设 `--max-steps 200`。
不限步数不等于"无限烧钱"：用户可随时 Stop、卡死熔断会兜底、上下文会自动压缩。

**实验 5：在网页里调参数**

「模型配置」里把 `maxSteps` 改成 8，做一个中等任务，观察它如何在第 8 步停下并收尾。

---

## 13.8 常见坑

| 坑 | 症状 | 原因 / 解决 |
| --- | --- | --- |
| 以为步数=工具次数 | 设了 64 步还是很快停 | 一步里可能调多个工具；要同时看 `maxToolCalls` |
| 误以为默认有步数上限 | 以为 64 步就停 | 现在默认 `0`=不限；只有显式设了 `--max-steps` 才会撞上限 |
| 想给无人值守加保险 | 跑飞/烧钱 | 用 `--max-steps 200 --max-tool-calls 300`；再配合 `--max-budget-usd`（Claude 类比）或后续 token 预算 |
| 把卡死熔断当"上限" | 正常重复操作被停 | 它只对"完全相同工具+参数连续 3 次"生效，可用 `--no-repeat-guard` 关闭 |
| 把 `--yolo` 当默认 | 危险命令静默执行 | 日常用 `--accept-edits`；yolo 只在隔离环境 |
| 模型卡在"重试同一个命令" | 一直转圈、烧钱 | 我们的重复熔断能兜住；也可在 AGENTS.md 里写"同一命令失败 2 次就换方案" |
| 达到上限后没有上下文 | 会话恢复后模型不知道进度 | 本章的收尾总结会写进历史；会话也有 JSONL 快照 |
| 以为自动改文件=安全 | 误改/删文件 | acceptEdits 只是省确认，不是沙箱；重要仓库先 commit |

---

## 13.9 小结

- 三家并不是"谁步数多谁强"：Claude Code 交互不设硬上限但权限/预算齐全；Codex 用审批+沙箱；DSH 社区用显式每回合预算。
- **能干活 = 默认不限步数/工具数 + 不用每步点确认（acceptEdits）+ 停下来时能说清进度**。
- 我们纠正了默认值：不限（0），把上限改成**可选**（CI/无人值守），保留卡死熔断与优雅收尾，并补上 acceptEdits 档位。
- 安全阀一个没少：危险命令仍问、路径边界仍在、权限可逐次确认、Stop 随时可用。

---

## 13.10 练习

1. **动手改阈值**：把重复熔断从 3 次改成 5 次，思考会多花多少 token、能救回哪些场景。
2. **加"时间上限"**：给 `runAgent` 加一个 `maxWallClockMs`（比如 10 分钟），到点走收尾流程。提示：在每步开头检查 `Date.now() - startedAt`。
3. **加 token 预算**：参考 `dsh-turn-budget`，累计 `usage.total_tokens`，超过 `maxTurnTokens`（例如 100 万）就暂停收尾。
4. **对照实验**：用同一个真实任务分别跑 `--max-steps 25` 和 `--max-steps 0 --max-tool-calls 120`，记录步数、工具数、token 和最终改动质量。
5. **思考题**：为什么"重复调用熔断"不能简单按"工具名"判断，而必须比较参数？（提示：读文件、跑测试本来就会重复同一个工具。）

---

👉 上一章：[第 12 章 网页版可视化](./12-Web可视化与真实模型接入.md)　|　下一章：[第 14 章 MCP 与工具生态](./14-MCP与工具生态.md)
