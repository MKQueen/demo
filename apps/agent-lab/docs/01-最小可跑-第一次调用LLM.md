# 第 1 章 最小可跑：第一次调用 LLM

> **本章目标**：搞懂"调用大模型"这件事在网络上到底发生了什么。
> 读完你能：手写一个流式请求、看懂 SSE 响应、知道 token 和 temperature 在影响什么、
> 并且理解为什么我们要自己写一个 `client.ts` 而不是直接用 SDK。
>
> 预计：40 分钟。对应代码：`src/llm/types.ts`、`src/llm/client.ts`、`src/llm/mock.ts`。

---

## 1.1 先把它当成一次普通的 HTTP 请求

抛开所有"AI"的光环，调用大模型就是往一个 URL POST 一段 JSON：

```
POST {baseUrl}/chat/completions
Authorization: Bearer sk-xxxx
Content-Type: application/json
```

请求体（body）的核心字段：

```json
{
  "model": "deepseek-v4-flash",
  "messages": [
    { "role": "system", "content": "你是一个简洁的中文助手" },
    { "role": "user", "content": "你好" }
  ],
  "stream": true,
  "temperature": 0.2
}
```

就这几样。`model` 决定用哪个模型，`messages` 是对话历史，`stream` 决定是不是流式返回。

### 手动试一次：curl

如果你配置了 DeepSeek 的 key（在 `.env` 里填了 `DEEPSEEK_API_KEY`），打开终端：

```bash
# 把 .env 里的 key 读进环境变量（也可以直接粘贴 sk-xxx）
export DEEPSEEK_API_KEY=sk-你的key

# 非流式：等它想完，一次性返回
curl https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [{"role": "user", "content": "用一句话解释什么是 token"}],
    "stream": false
  }'
```

你会收到一个 JSON，里面有 `choices[0].message.content` 和 `usage`。

> 说明：模型名必须和 baseUrl 属于同一家服务商。上面用的是**官方 DeepSeek API** 当前的
> `deepseek-v4-flash`（旧的 `deepseek-chat` 已停止使用）；如果你走网关/中转，就换成网关文档里的名字（例如 `deepseek-flash`）。

现在把 `"stream": false` 改成 `"stream": true`，并加上 `--no-buffer`（让 curl 别攒着，收到多少显示多少）：

```bash
curl --no-buffer https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [{"role": "user", "content": "用三句话解释什么是 token"}],
    "stream": true
  }'
```

你会看到类似这样的东西一行行冒出来：

```
data: {"id":"...","choices":[{"delta":{"content":"Token"},"index":0}]}

data: {"id":"...","choices":[{"delta":{"content":" 是"},"index":0}]}

data: {"id":"...","choices":[{"delta":{"content":"模型"},"index":0}]}

data: {"id":"...","choices":[],"usage":{"prompt_tokens":22,"completion_tokens":53,"total_tokens":75}}

data: [DONE]
```

**恭喜，你已经看到了"流式输出"的原始形态。** 所谓"AI 打字机效果"，就是这几个 `data:` 行的解析结果。

> 💡 没有 key 也能学：本项目内置了 mock 模型（`--mock`），它按剧本返回"流式文本"，
> 让你在完全离线的情况下把后面的所有实验跑完。见 1.7 节。

---

## 1.2 messages：对话就是不断变长的数组

模型本身**没有记忆**。每次请求你都要把完整历史重新发过去，它才知道上下文。

| role | 谁产生的 | 作用 |
| --- | --- | --- |
| `system` | 你的程序 | 给模型定人设、规则、环境信息。一般只在最前面一条 |
| `user` | 用户（或程序代拟） | 用户说的话 |
| `assistant` | 模型 | 模型的回复。可能带 `tool_calls`（见第 2 章） |
| `tool` | 你的程序 | 工具执行结果，喂回给模型看 |

一次多轮对话的历史大概长这样：

```json
[
  { "role": "system", "content": "你是编码助手" },
  { "role": "user", "content": "src 目录里有什么？" },
  { "role": "assistant", "content": "我看看。", "tool_calls": [ ... ] },
  { "role": "tool", "content": "src/main.ts\nsrc/util.ts", "tool_call_id": "call_1" },
  { "role": "assistant", "content": "src 目录下有 main.ts 和 util.ts 两个文件。" }
]
```

**注意第 3、4 条**：`assistant` 请求调用工具，`tool` 返回结果。这就是 Agent 的骨架，
第 2 章会专门拆解。本章先把"纯聊天"跑通。

---

## 1.3 流式响应：SSE 是什么

服务端返回的这段文本格式叫 **SSE（Server-Sent Events）**。规则很简单：

1. 响应体是纯文本，事件之间用**空行**分隔
2. 每个事件里可能有若干行 `data: xxx`
3. 我们的场景里每行 data 是一个 JSON，最后一行是 `data: [DONE]`

听起来简单，但写起来有个坑：**网络分片是随便切的**。

假设第一个网络包给你 `data: {"content":"你`，第二个包给你 `好"}\n\n`。
如果你拿到什么就 `JSON.parse` 什么，第一个包就会解析失败。

所以必须自己维护一个缓冲区（buffer），只处理"已经完整"的事件：

```ts
// src/llm/client.ts 的核心思路
this.buffer += chunk;                       // 先拼到缓冲区
let boundary = this.buffer.indexOf("\n\n"); // 找事件边界
while (boundary !== -1) {
  const block = this.buffer.slice(0, boundary); // 取出一个完整事件
  this.buffer = this.buffer.slice(boundary + 2); // 剩下的留着下次
  // 解析 block 里的 data: 行 …
  boundary = this.buffer.indexOf("\n\n");
}
```

`src/llm/client.ts` 里的 `SseParser` 类就是这个逻辑，只不过处理了 `\r\n`、
多行 data、流结束时的残留缓冲。它单独抽出来是有原因的——**纯函数好测试**，
`test/unit.test.ts` 里就在喂它人造数据验证。

### 为什么非要流式？

三个实际原因：

1. **首 token 延迟（TTFT）**：完整回答可能要 10 秒，但第一个字 0.5 秒就来了，体感完全不同
2. **工具调用需要流式**：模型可能"说一半就决定调用工具"，工具参数也是分片流式吐出的
3. **可中断**：用户看到不对劲可以直接 Ctrl+C，不用等它说完

代价是：解析复杂了、错误处理复杂了、重试变难了（吐了一半再重试会重复输出）。
这就是工程里的经典取舍。

---

## 1.4 我们的客户端：`src/llm/client.ts` 导览

这个文件分三层，建议按这个顺序读：

### 第一层：错误类型 `LLMError`

```ts
export class LLMError extends Error {
  readonly status: number | undefined;   // HTTP 状态码
  readonly retryable: boolean;           // 这个错值不值得重试
}
```

把"能不能重试"编码进错误对象，上层就不用猜。比如：

- `429`（限流）、`5xx`（服务端抖动）→ `retryable: true`
- `401`（key 错了）、`400`（参数错）→ `retryable: false`，重试一万次也没用

### 第二层：`streamOnce` —— 一次请求

它做的事就是 1.1 节那个 curl：

```ts
const response = await fetch(`${config.baseUrl}/chat/completions`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${config.apiKey}`,
  },
  body: JSON.stringify({
    model: config.model,
    messages,
    stream: true,
    stream_options: { include_usage: true }, // 让最后一个 chunk 带用量
    temperature,
    ...(tools.length > 0 ? { tools, tool_choice: "auto" } : {}),
  }),
  signal: options?.signal,   // ← 中断能力，第 3 章会用到
});
```

拿到响应后，它把 SSE 翻译成项目内部统一的事件：

```ts
yield { type: "text", text: delta.content };        // 正文增量
yield { type: "thinking", text: reasoning_content }; // 推理模型的思考过程
yield { type: "tool_calls", toolCalls: [...] };      // 工具调用（拼完整后一次性给）
yield { type: "usage", usage: {...} };               // 用量
yield { type: "done", finishReason: "stop" };        // 结束
```

**这层适配器是整个项目的关键设计。** 上层（主循环、UI）只认这五种事件，
不关心底层是 DeepSeek、OpenAI 还是 mock。想换模型？改 `createProvider` 那一层就行。

### 第三层：`createProvider` —— 包一层重试

重试有一个非常容易踩的坑：**如果已经吐了一半再重试，用户会看到重复内容。**

所以这里的策略是：

```ts
let emittedAnything = false;
for (;;) {
  try {
    for await (const event of streamOnce(...)) {
      emittedAnything = true;   // 只要吐出过一个事件，就不再重试
      yield event;
    }
    return;
  } catch (err) {
    if (!retryable || emittedAnything || attempt >= maxRetries) throw err;
    await sleep(600 * 2 ** attempt);  // 指数退避：0.6s、1.2s
  }
}
```

这个"只在还没开始输出时重试"的规则，是所有流式系统的通用经验。

---

## 1.5 token、上下文窗口、temperature

**token（词元）**：模型处理文本的最小单位。注意它不是"字"，也不是"词"：

- 英文大概 4 个字符 ≈ 1 token
- 中文大概 1 个汉字 ≈ 1~1.5 token
- 代码里 `function`、空格、标点都会各自算 token

**上下文窗口（context window）**：一次请求里模型能"看到"的 token 上限。
比如 64K 上下文 ≈ 能一次看 5 万汉字。超过就报错，或者被截断。
这是第 6 章"上下文管理"存在的全部理由。

**usage**：接口返回的实际用量，三个数字：

```json
{ "prompt_tokens": 1234, "completion_tokens": 567, "total_tokens": 1801 }
```

`prompt` 是你发过去的（输入），`completion` 是模型生成的（输出）。计费按这两个分别算。

我们的代码里用了一个**估算函数** `estimateTokens`（`src/util.ts`）：

```ts
// 中文按 1.1 token/字，其他按 3.5 字符/token，粗略估算
return Math.ceil(cjk * 1.1 + other / 3.5);
```

为什么不用精确分词器？因为精确计数要几 MB 的词表数据，而"估算 + 留 20% 余量"在工程上够用。
生产级 Agent 会引入 tiktoken 这类库，但原理就是"按模型的分词规则数一下"。

**temperature（温度）**：控制输出的随机性，0 最确定、1 最发散。
Agent 场景一般用 `0 ~ 0.3`，因为你要的是"稳定执行任务"，不是"写诗"。
本项目的默认值在 `src/config.ts` 里：`temperature: 0.2`，三种改法：

```bash
# 1) 命令行参数
node src/main.ts chat --temperature 0.3

# 2) .env（长期生效）
# MINI_TEMPERATURE=0.3

# 3) 网页版：右上角「模型配置」→ temperature
```

---

## 1.6 没有 key 怎么办：mock 模型

`src/llm/mock.ts` 是一个 100 多行的假模型，和真模型实现**同一个接口** `LLMProvider`：

```ts
export interface LLMProvider {
  id: string;
  model: string;
  stream(messages: ChatMessage[], options?: StreamOptions): AsyncGenerator<StreamEvent>;
}
```

它干的事很简单：看用户说了什么，从预置剧本里挑一套返回。剧本里既有文本，也有工具调用请求——
**结构和真模型完全一样**。所以：

- 你没有 key 也能跑通整条链路（`--mock`）
- 读代码时不会被网络问题打断
- 它顺便证明了"模型是可替换的"这件事不是空话

```bash
node examples/01-hello-llm.ts --mock
```

---

## 1.7 动手实验

**实验 1：跑通第一个例子（1 分钟）**

```bash
node examples/01-hello-llm.ts --mock
```

观察输出：请求里的 messages 数组、流式打印、最后的 usage 统计。

**实验 2：换成真模型（需要 key）**

```bash
# 确保项目根目录 .env 里有 DEEPSEEK_API_KEY
node examples/01-hello-llm.ts
```

**实验 3：改 messages，观察行为变化**

编辑 `examples/01-hello-llm.ts`：

```ts
// 把 system 改成更"凶"的人设，看输出语气变化
content: "你是一个只说方言（粤语）的助手，回答不超过 30 个字。",
```

```ts
// 或者把 user 换成一个需要多轮才能回答的问题，然后自己加一条 assistant + user
```

**实验 4：观察错误处理**

故意用一个坏 key，看程序怎么报错、提示是否清楚：

```bash
DEEPSEEK_API_KEY=sk-invalid-key-123 node examples/01-hello-llm.ts
```

你会看到 `401` 被翻译成"API key 无效或没填"的提示——这就是 `explainError` 的价值：
**错误信息是给用户看的，不是给日志看的。**

**实验 5：中断流式输出**

真模型下，运行例子时按 `Ctrl+C`。思考：为什么前端能立刻停下？
（答案在 1.4 节：`fetch` 的 `signal` 参数。）

---

## 1.8 常见坑

| 坑 | 症状 | 原因 / 解决 |
| --- | --- | --- |
| 把 `arguments` 当对象 | `undefined` / 解析失败 | 工具调用参数是 **JSON 字符串**，必须 `JSON.parse`（第 2 章详讲） |
| 流式解析直接 `JSON.parse(chunk)` | 偶发解析错误 | 网络分片会切断 JSON，必须用 buffer 等完整事件（1.3 节） |
| 401 后无限重试 | 日志刷屏、被封 | 鉴权错误不 retryable；只有 429/5xx 才重试 |
| 400 `supported API model names are …` | 模型名不被该服务商支持 | 按报错列出的名字改 `model`；确认 `baseUrl` 与 `model` 属于同一家 |
| 用 `temperature: 1` 跑 Agent | 行为飘、不按格式 | Agent 任务用 0~0.3；创意任务才调高 |
| 忘记 `stream_options` | 拿不到 usage | 流式请求默认不返回用量，要显式请求 |
| 把 key 写进代码 | 泄漏 | 只从环境变量/.env 读；`.env` 加进 `.gitignore` |

---

## 1.9 本章小结

- 调模型 = 一次 HTTP POST，body 里是 `model + messages + 参数`。
- `messages` 是完整历史，模型本身没有记忆。
- 流式响应是 SSE：`data: {...}` 一行行来，必须用 buffer 处理网络分片。
- 我们把 SSE 适配成五种内部事件（text/thinking/tool_calls/usage/done），上层与厂商解耦。
- 重试只在"还没吐出任何事件"时进行，否则会重复输出。
- token 是计费和上下文窗口的单位；temperature 控制随机性，Agent 用低值。
- 没有 key 可以用 mock 模型完整学习，接口一致是它能替换的前提。

---

## 1.10 练习

1. **改 mock 剧本**：在 `src/llm/mock.ts` 的 `DEFAULT_TURNS` 里加一句话，让 mock 回答得更热情。
   跑 `node examples/01-hello-llm.ts --mock` 验证（提示：找到 `DEFAULT_TURNS` 数组）。
2. **加一条 system 消息**：在 `examples/01-hello-llm.ts` 里把 system 改成"你是鲁迅"，看真模型输出变化。
   如果没 key，先想清楚"mock 会不会理会 system 提示词"——答案是不会，为什么？
3. **算一笔账**：假设一次请求 `prompt_tokens=8000`、`completion_tokens=500`，
   便宜模型定价按输入 ¥1/百万 token、输出 ¥2/百万 token，一次请求多少钱？
   如果一次 Agent 任务跑 30 轮，大概多少钱？（提示：先算单轮，再乘轮数）
4. **思考题**：为什么 `stream_options: { include_usage: true }` 要单独加？
   如果服务端不支持这个字段会发生什么？（提示：看代码里 usage 是可选的处理）

> 想验证自己对 SSG 解析的理解？打开 `test/unit.test.ts`，把 SseParser 的测试改成"每次只喂 1 个字符"，
> 看看还能不能解析出来。能，就说明你真的懂了。

---

👉 上一章：[第 0 章 从零理解 Agent](./00-从零理解Agent.md)　|　下一章：[第 2 章 消息、角色与工具调用协议](./02-消息与工具调用协议.md)
