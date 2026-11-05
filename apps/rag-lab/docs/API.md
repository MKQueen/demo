# API 契约（前后端唯一约定，实现必须严格遵守）

服务地址：`http://127.0.0.1:8900`（可用 `PORT` 环境变量覆盖）
所有接口返回 JSON；流式接口使用 SSE（`text/event-stream`）。
**本文件是契约：字段名、类型、层级一旦写入，后端必须照此输出，前端必须照此消费。**
如需新增字段可以，但**禁止改名或删除已有字段**。

---

## 0. 通用约定

- 时间单位：毫秒（number，保留 1 位小数即可）。
- 相似度分数：`0~1` 之间的 number（向量余弦分数、融合分数）。BM25 原始分可以为大于 1 的数，但 `scores.keyword` 一律归一化到 `0~1`。
- 文本块 id 形如 `退换货政策#3`（`docId#序号`，序号从 0 开始）。
- 所有接口在失败时返回 HTTP 4xx/5xx + `{ "error": { "message": "...", "code": "..." } }`。

---

## 1. GET /api/health

用于顶部状态栏。**绝不能**返回 apiKey。

```json
{
  "ok": true,
  "version": "0.1.0",
  "llm": {
    "configured": true,
    "mode": "llm",
    "model": "deepseek-flash",
    "baseUrl": "https://api.deepseek.com",
    "note": "已连接 OpenAI 兼容接口"
  },
  "embedding": { "mode": "hash", "dim": 8192, "note": "本地哈希向量（字符 bigram + 签名哈希 + 句子级 max-pool）" },
  "kb": { "docs": 8, "chunks": 48, "tokens": 4921 },
  "uptimeMs": 1234.5
}
```

- `llm.mode`: `"llm"`（已配置可用 key，回答由真实大模型生成）或 `"disconnected"`（未配置 key：接口会明确报未连接，不会生成任何离线 / 模拟答案）。
- `llm.configured`: boolean，是否配置了**可用**的 API Key（`.env.example` 里的占位符 key 视为未配置）。
- 未配置时 `note` 会提示把 `.env.example` 复制为 `.env` 并填写 `DEEPSEEK_API_KEY`（或复用 `apps/agent-lab/.env`）。

---

## 2. GET /api/kb

一次性返回知识库全量快照，前端用于「知识库」页签和向量空间散点图。

```json
{
  "docs": [
    {
      "id": "退换货政策",
      "title": "退换货政策",
      "file": "01-退换货政策.md",
      "order": 1,
      "summary": "7 天无理由退货、质量问题的退换流程、运费承担规则……",
      "chunkCount": 9
    }
  ],
  "chunks": [
    {
      "id": "退换货政策#0",
      "docId": "退换货政策",
      "docTitle": "退换货政策",
      "section": "1. 七天无理由退货",
      "text": "……",
      "tokens": 156,
      "chars": 412,
      "order": 0
    }
  ],
  "embedding": { "mode": "hash", "dim": 8192, "note": "..." },
  "projection": [
    { "chunkId": "退换货政策#0", "docId": "退换货政策", "x": -0.42, "y": 0.31 }
  ],
  "stats": {
    "docs": 8,
    "chunks": 48,
    "totalTokens": 4921,
    "avgTokens": 163,
    "dim": 8192
  }
}
```

`projection`：把 8192 维向量用 PCA 降到 2 维（**确定性**，同样输入永远同样输出），
x/y 已缩放到大致 `[-1, 1]` 区间，供 canvas 绘制。每个 chunk 一条。

---

## 3. POST /api/retrieve

仅检索，不调用 LLM。请求：

```json
{ "query": "七天无理由退货怎么操作", "topK": 6, "mode": "hybrid" }
```

`mode`: `"hybrid"`（默认，向量+BM25 RRF 融合）| `"vector"` | `"keyword"`。

响应：

```json
{
  "query": "七天无理由退货怎么操作",
  "mode": "hybrid",
  "topK": 6,
  "latencyMs": 12.4,
  "candidates": 48,
  "steps": [
    { "key": "analyze", "name": "查询理解", "ms": 0.3, "detail": "去停用词后得到 6 个检索词" },
    { "key": "embed", "name": "向量化", "ms": 0.6, "detail": "hash-embedding · dim=8192" },
    { "key": "vector", "name": "向量召回", "ms": 0.5, "detail": "余弦相似度 · 48 个块" },
    { "key": "keyword", "name": "关键词召回", "ms": 0.4, "detail": "BM25 · 48 个块" },
    { "key": "fuse", "name": "融合重排", "ms": 0.2, "detail": "RRF(k=60) → top 6" }
  ],
  "hits": [
    {
      "chunkId": "退换货政策#2",
      "docId": "退换货政策",
      "docTitle": "退换货政策",
      "section": "1.2 无理由退货的条件",
      "text": "……",
      "rank": 1,
      "scores": { "vector": 0.83, "keyword": 0.71, "fused": 0.0325 },
      "matchedTerms": ["退货", "无理由", "七天"]
    }
  ],
  "queryEmbedding": { "dim": 8192, "nonzero": 78, "preview": [0.12, -0.03, 0.08] },
  "queryPoint": { "x": 0.21, "y": -0.44 },
  "keywordTerms": ["七天", "无理由", "退货"]
}
```

- `hits` 按 `rank` 升序，长度 ≤ topK。
- `scores.fused` 是 RRF 归一化后的分数（0~1），用于展示。
- `queryPoint` 是查询向量投到同一 PCA 空间的坐标（散点图上画成会动的星标）。
- `matchedTerms` 是**该 chunk 文本里真实出现**的高亮词，最多 6 个。

---

## 4. POST /api/chat  （SSE）

客服对话主接口。请求：

```json
{
  "messages": [
    { "role": "user", "content": "我买的耳机有杂音，能退吗？" }
  ],
  "topK": 5,
  "mode": "hybrid",
  "temperature": 0.3
}
```

- `messages` 至少包含最后一条 user 消息；前端负责附带历史。服务端取**最后一条 user 消息**作为检索 query。
- 回答**只由真实大模型生成**：没有可用 API Key 时不会降级成本地答案，而是按下面的「未配置 Key」路径明确报错。
- 响应头：`Content-Type: text/event-stream; charset=utf-8`、`Cache-Control: no-cache`、`Connection: keep-alive`、`X-Accel-Buffering: no`。

SSE 事件（每条形如 `event: NAME\ndata: {JSON}\n\n`），**顺序固定**：

| 顺序 | event | data |
|---|---|---|
| 1 | `meta` | `{ "mode": "llm", "model": "deepseek-flash", "startedAt": 1793686700000 }` |
| 2 | `retrieval` | 与 §3 的响应体完全相同 |
| 3 | `prompt` | `{ "messages": [{"role":"system","content":"..."}], "contextBlocks": [{ "chunkId": "...", "docTitle": "...", "section": "...", "text": "...", "tokens": 150, "marker": "[1]" }], "tokens": { "system": 420, "context": 700, "history": 120, "total": 1240 } }` |
| 4 | `reasoning` | `{ "text": "…" }` 可 0~N 条（模型思考流，前端折叠展示） |
| 5 | `delta` | `{ "text": "…" }` 1~N 条（答案正文流） |
| 6 | `done` | `{ "mode": "llm", "latencyMs": 2310.4, "usage": { "prompt_tokens": 1240, "completion_tokens": 210, "total_tokens": 1450 }, "citations": [{ "chunkId": "...", "docTitle": "...", "section": "...", "marker": "[1]" }], "stopped"?: true, "reasoning"?: true, "failed"?: true }` |

`meta.mode` 只可能是 `"llm"`；`done.mode` 取值 `"llm"`（本次真实生成）或 `"disconnected"`（未配置 Key，见下）。
真实生成路径下 `done.usage` 是上游返回的真实 token 用量（请求带 `stream_options.include_usage`）；
个别网关不返回 usage 时才按 prompt / 答案长度本地估算（只影响统计，不影响答案）。
`done.citations` 是本次检索命中的来源列表，结构与 §3 的 hits 一一对应。

**未配置 Key**（`llm.mode = "disconnected"`）：服务端只发两条事件，顺序为
`error`（`{ "message": "未连接真实大模型…", "code": "llm_not_configured" }`）→
`done`（`{ "mode": "disconnected", "failed": true, "usage": 全 0, "citations": [] }`），
**不会发送任何 `delta`**，更不会伪造/抽取答案。

**生成失败**（HTTP 错误、超时、模型返回空内容等）：先发 `event: error`
（`data: { "message": "...", "code": "llm_error" }`），随后发 `done`
（`mode: "llm"`、`failed: true`，`citations` 保留已完成的检索结果，`usage` 若拿不到上游值则为本地估算）。
不会再用本地抽取式答案兜底。前端必须能处理「retrieval 成功但之后 error」的情况。

**浏览器模式（`npm run build` 的 dist 产物）**：前端不请求本接口——检索在浏览器内用同一套
`rag/` 算法完成；生成直接 `POST` 同源 `/api/llm/chat/completions`（由本地预览服务器转发的
OpenAI 兼容 SSE，见浏览器模式前端契约）。没有同源转发层时，前端显示「未连接真实模型」，
同样不会生成本地答案。

---

## 5. POST /api/eval

跑内置评测集（`kb/eval.json`），在「检索命中率」页签展示。请求：`{ "topK": 5 }`。

```json
{
  "ok": true,
  "topK": 5,
  "total": 15,
  "hitAt1": 0.667,
  "hitAt3": 0.933,
  "hitAtK": 1,
  "mrr": 0.8,
  "avgLatencyMs": 1.6,
  "cases": [
    {
      "query": "发票开错了能重开吗",
      "expectDoc": "支付方式与发票",
      "expectKeywords": ["重开", "发票"],
      "hit": true,
      "rank": 1,
      "topHit": { "chunkId": "...", "docTitle": "...", "section": "...", "text": "…" },
      "latencyMs": 1.4
    }
  ]
}
```

`kb/eval.json` 缺失时返回 `{ "ok": false, "reason": "未找到 kb/eval.json" }`（HTTP 200）。

---

## 6. 静态资源

- `GET /` → `web/index.html`
- `GET /css/*` `GET /js/*` `GET /assets/*` → 对应文件（禁止路径穿越）。
- 未知路径 → 404 JSON。

---

## 7. 前端必须实现的交互（验收清单）

1. **顶部状态栏**：LLM 状态（已连接 / 未连接）、模型名、向量维度、知识库块数；点击右侧「运行评测」可跳到评测页签。
2. **对话区**：多轮消息、流式打字、`[1] [2]` 引用角标（hover 显示来源 section，点击滚动/高亮对应检索卡片）、停止生成、清空对话、3~5 个推荐问题、Enter 发送 / Shift+Enter 换行。
3. **可视化页签**（对话结束后自动刷新）：
   - 管道流程图：5 个阶段（查询理解 → 向量化 → 向量召回 → 关键词召回 → 融合重排 → 生成），每个阶段显示耗时条，流式过程中逐段点亮。
   - 向量空间散点图：canvas 或 SVG，绘制全部 chunk 点（按 doc 上色）、查询点（星标 + 到 top-k 的连线）、hover tooltip、点击定位到检索卡片。
   - 召回卡片列表：排名、来源、section、正文片段、三种分数条（vector/keyword/fused）、命中词高亮。
4. **提示词页签**：展示完整 system + user 消息、上下文块（带 [n] 标记、token 估算）、token 统计条。
5. **知识库页签**：doc 列表 → 展开 chunk；支持关键词过滤；显示每块 token 数。
6. **评测页签**：表格展示 15 条用例命中情况 + 汇总指标 + 耗时；高亮失败用例。
7. 温度滑块（可选）、topK 选择（3/5/8）。未连接真实模型时禁用发送，但检索 / 评测 / 知识库等本地能力照常可用。
8. 不引用任何外部 CDN / 外部字体 / 外部图片；没有真实模型 Key 时页面明确显示「未连接」，**不生成任何离线/模拟答案**。

---

## 8. 内部模块契约（rag/*.js 与 server.js 之间）

`server.js` 只依赖 `rag/index.js` 的 `createRag`：

```js
// rag/index.js
export async function createRag(options) -> Promise<Rag>

// options = {
//   kbDir: string,                       // 知识库目录（含 *.md）
//   topK: number,                        // 默认 6
//   llmConfig: { apiKey, baseUrl, model, reasoningEffort } | null,
//   dim?: number                         // 哈希向量维度，默认 8192（越大碰撞越少、检索越准）
// }
//
// Rag = {
//   stats(): { docs: number, chunks: number, dim: number, totalTokens: number },
//   snapshot(): Promise<{ docs, chunks, embedding, projection, stats }>,   // 结构与 GET /api/kb 一致
//   retrieve(query: string, opts?: { topK?: number, mode?: "hybrid"|"vector"|"keyword" }):
//       Promise<RetrievalResult>,        // 结构与 POST /api/retrieve 一致
//   buildPrompt(opts: { hits, history, question }): {
//       messages: [{role, content}],
//       contextBlocks: [{ chunkId, docTitle, section, text, tokens, marker }],
//       tokens: { system, context, history, total }
//   },
//   llm: {
//     available: boolean,                // 只看 apiKey 是否可用（占位符 key 视为不可用）
//     mode: "llm" | "disconnected",      // 不再有 mock
//     model: string,
//     baseUrl: string,
//     stream(messages, opts?: { temperature?: number, maxTokens?: number, signal?: AbortSignal }):
//         AsyncIterable<
//           { type: "reasoning", text: string } |
//           { type: "delta", text: string } |
//           { type: "usage", usage: { prompt_tokens, completion_tokens, total_tokens } }
//         >,
//   },
//   reload(): Promise<void>,
// }
```

`server.js` 负责：HTTP 路由、静态文件、SSE 编码、eval 读文件并调 `rag.retrieve`、
健康检查、错误兜底。**没有 Key 时明确报 `llm_not_configured`，不做任何降级生成**；
`rag/` 里不出现任何 HTTP 代码，也不再提供离线抽取式答案。

新增的 rag 文件由 rag-engine 负责，建议拆分：
`loader.js`（读 md）、`chunker.js`（切块）、`embedder.js`（向量）、`store.js`（召回+融合+PCA）、
`prompt.js`（拼 prompt+token 估算）、`llm.js`（OpenAI 兼容流式客户端）、`util.js`、`index.js`。
（原 `mock-answer.js` 离线抽取式答案已删除：回答只由真实大模型生成。）
