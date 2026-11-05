/**
 * server.js —— RAG 客服 Demo 的 HTTP 层（零依赖）
 *
 * 职责边界（很重要）：
 *   - server.js 只做 HTTP 相关的事：路由、静态文件、SSE 编码、参数校验、错误兜底。
 *   - 检索、向量化、Prompt 拼装、LLM 调用全部在 rag/ 里，server.js 不写任何 RAG 算法。
 *   - 契约见 docs/API.md，前端只认那份契约，所以这里输出的 JSON 必须严格对齐。
 *
 * 生成只走真实大模型：没有 API Key 时 /api/chat 会明确返回 error + done(failed)，
 * 绝不降级成本地抽取式答案来「假装」回答。
 *
 * 启动：node server.js            （默认 http://127.0.0.1:8900）
 *      node server.js --port 9000
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './config.js';

const config = loadConfig();
const startedAt = Date.now();

/* ------------------------------------------------------------------ *
 * 一、静态资源
 * ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  // 目录穿越防护：解析后的真实路径必须仍在 web/ 之内
  const filePath = path.resolve(config.webDir, '.' + rel);
  if (!filePath.startsWith(config.webDir + path.sep)) {
    return sendJson(res, 403, { error: { message: '禁止访问', code: 'forbidden' } });
  }
  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': data.length,
      // 开发用 Demo：不缓存，改完刷新即生效
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    sendJson(res, 404, { error: { message: `资源不存在: ${rel}`, code: 'not_found' } });
  }
}

/* ------------------------------------------------------------------ *
 * 二、通用小工具
 * ------------------------------------------------------------------ */

function sendJson(res, status, body) {
  if (res.headersSent) {
    res.end();
    return;
  }
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(data);
}

function sendError(res, status, message, code = 'internal') {
  sendJson(res, status, { error: { message, code } });
}

function badRequest(message) {
  return Object.assign(new Error(message), { code: 'bad_request' });
}

async function readJsonBody(req, limit = 2 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw badRequest('请求体过大（上限 2MB）');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest('请求体不是合法 JSON');
  }
}

const round = (n, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(Number(n) * factor) / factor;
};

function estimateTokens(text) {
  // 与 rag/prompt.js 的估算口径保持一致的粗略规则：中文约 1 token / 1.5 字，英文约 1 token / 4 字符
  const str = String(text || '');
  let cjk = 0;
  for (const ch of str) {
    if (/[\u3400-\u9fff\uf900-\ufaff]/.test(ch)) cjk++;
  }
  const rest = str.length - cjk;
  return Math.max(0, Math.round(cjk / 1.5 + rest / 4));
}

/* ------------------------------------------------------------------ *
 * 三、RAG 内核装配
 * ------------------------------------------------------------------ */

let rag = null;
let ragError = null;

async function initRag() {
  try {
    // 动态导入：即使 rag/ 还没写完，server 也能起来并给出可读的错误提示
    const mod = await import('./rag/index.js');
    rag = await mod.createRag({
      kbDir: config.kbDir,
      topK: config.topK,
      dim: config.embedding.dim,
      llmConfig: {
        apiKey: config.llm.apiKey,
        baseUrl: config.llm.baseUrl,
        model: config.llm.model,
        reasoningEffort: config.llm.reasoningEffort,
      },
    });
    const stats = rag.stats();
    console.log(
      `[rag] 知识库就绪：${stats.docs} 篇文档 / ${stats.chunks} 个块 / 向量维度 ${stats.dim}`,
    );
    console.log(
      `[llm] ${
        rag.llm.available
          ? `已连接 ${config.llm.model} @ ${config.llm.baseUrl}`
          : '未配置 API Key → 未连接真实大模型（/api/chat 会明确返回 llm_not_configured）'
      }`,
    );
  } catch (error) {
    ragError = error;
    console.error('[rag] 初始化失败：', error?.stack || error);
    console.error('[rag] 页面仍可打开，但 /api/* 会返回 503。修复后重启即可。');
  }
}

/** 统一的 503 兜底：RAG 内核没就绪时给出可执行的提示 */
function requireRag(res) {
  if (rag) return true;
  sendError(
    res,
    503,
    `RAG 内核未就绪：${ragError?.message || '未知错误'}。请确认 rag/index.js 存在并重启服务。`,
    'rag_unavailable',
  );
  return false;
}

/* ------------------------------------------------------------------ *
 * 四、接口：健康检查 / 知识库快照
 * ------------------------------------------------------------------ */

function handleHealth(res) {
  const stats = rag ? rag.stats() : { docs: 0, chunks: 0, dim: config.embedding.dim, totalTokens: 0 };
  // 只有「真的拿到可用 Key」才算已连接；占位符 key 在 rag/llm.js 里已被判为不可用
  const llmAvailable = Boolean(rag?.llm?.available);
  sendJson(res, 200, {
    ok: Boolean(rag),
    version: config.version,
    llm: {
      configured: llmAvailable,
      mode: llmAvailable ? 'llm' : 'disconnected',
      model: llmAvailable ? config.llm.model : '',
      baseUrl: llmAvailable ? config.llm.baseUrl : '',
      note: llmAvailable
        ? `OpenAI 兼容接口 · ${config.llm.model}`
        : '未配置 API Key：请把 apps/rag-lab/.env.example 复制为 .env 并填写 DEEPSEEK_API_KEY（或复用 apps/agent-lab/.env），然后重启服务',
    },
    embedding: {
      mode: config.embedding.mode,
      dim: rag?.embedder?.dim || stats.dim || config.embedding.dim,
      note: rag?.embedder?.note || '本地哈希向量（字符 bigram + 签名哈希 + 句子级 max-pool）',
    },
    kb: { docs: stats.docs, chunks: stats.chunks, tokens: stats.totalTokens || 0 },
    uptimeMs: round(Date.now() - startedAt),
  });
}

let kbCache = null;

async function handleKb(req, res, url) {
  if (!requireRag(res)) return;
  if (url.searchParams.get('reload') === '1' || !kbCache) {
    kbCache = await rag.snapshot();
  }
  sendJson(res, 200, kbCache);
}

/* ------------------------------------------------------------------ *
 * 五、接口：检索
 * ------------------------------------------------------------------ */

function normalizeMode(mode) {
  return ['hybrid', 'vector', 'keyword'].includes(mode) ? mode : 'hybrid';
}

function normalizeTopK(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(1, Math.min(20, Math.floor(n)));
}

async function handleRetrieve(req, res, url) {
  if (!requireRag(res)) return;
  const body = await readJsonBody(req);
  const query = typeof body.query === 'string' ? body.query : url.searchParams.get('query') || '';
  if (!query.trim()) {
    return sendError(res, 400, 'query 不能为空', 'bad_request');
  }
  const topK = normalizeTopK(body.topK, config.topK);
  const mode = normalizeMode(body.mode);
  const result = await rag.retrieve(query, { topK, mode });
  sendJson(res, 200, result);
}

/* ------------------------------------------------------------------ *
 * 六、接口：对话（SSE 流式）
 * ------------------------------------------------------------------ */

/** 校验并裁剪前端传来的会话历史 */
function normalizeMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw badRequest('messages 不能为空');
  }
  const messages = raw
    .filter((m) => m && typeof m.content === 'string' && ['user', 'assistant', 'system'].includes(m.role))
    .map((m) => ({ role: m.role, content: m.content }))
    .slice(-24); // 上下文别无限增长，演示场景够用
  if (!messages.some((m) => m.role === 'user')) {
    throw badRequest('messages 里必须包含 user 消息');
  }
  return messages;
}

function createSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'X-Content-Type-Options': 'nosniff',
  });
  // 关掉 Nagle + 立即 flush，保证流式效果
  res.socket?.setNoDelay(true);
  let closed = false;
  res.on('close', () => {
    closed = true;
  });
  return {
    get closed() {
      return closed || res.writableEnded;
    },
    send(event, data) {
      if (this.closed) return false;
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        return true;
      } catch {
        closed = true;
        return false;
      }
    },
    comment(text) {
      if (!this.closed) {
        try {
          res.write(`: ${text}\n\n`);
        } catch {
          closed = true;
        }
      }
    },
    end() {
      if (!res.writableEnded) res.end();
    },
  };
}

async function handleChat(req, res) {
  if (!requireRag(res)) return;
  const body = await readJsonBody(req);
  const messages = normalizeMessages(body.messages);
  const question = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const history = messages.slice(0, -1);
  const topK = normalizeTopK(body.topK, 5);
  const mode = normalizeMode(body.mode);
  const temperature = Number.isFinite(Number(body.temperature))
    ? Math.max(0, Math.min(2, Number(body.temperature)))
    : 0.3;

  const requestStart = Date.now();
  const sse = createSse(res);

  // 没有可用的 Key：明确报「未连接」，绝不降级成本地答案（docs/API.md §4）
  if (!rag.llm.available) {
    sse.send('error', {
      message:
        '未连接真实大模型：未配置 API Key。请把 apps/rag-lab/.env.example 复制为 apps/rag-lab/.env 并填写 DEEPSEEK_API_KEY（或复用 apps/agent-lab/.env），然后重启服务。',
      code: 'llm_not_configured',
    });
    sse.send('done', {
      mode: 'disconnected',
      latencyMs: round(Date.now() - requestStart),
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      citations: [],
      failed: true,
    });
    return sse.end();
  }

  const abortController = new AbortController();
  res.on('close', () => {
    // 用户点「停止生成」或关页面：终止上游 LLM 请求，别浪费 token
    abortController.abort();
  });

  sse.send('meta', { mode: 'llm', model: rag.llm.model, startedAt: requestStart });

  // --- 第一步：检索（无论生成是否成功都先做，这是 RAG 的"R"） ---
  let retrieval;
  let prompt;
  try {
    retrieval = await rag.retrieve(question, { topK, mode });
    prompt = rag.buildPrompt({ hits: retrieval.hits, history, question });
  } catch (error) {
    console.error('[chat] 检索失败：', error);
    sse.send('error', { message: `检索失败：${error.message}`, code: 'retrieval_error' });
    sse.send('done', {
      mode: 'llm',
      latencyMs: round(Date.now() - requestStart),
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      citations: [],
      failed: true,
    });
    return sse.end();
  }

  if (!sse.send('retrieval', retrieval)) return sse.end();
  if (!sse.send('prompt', prompt)) return sse.end();

  // --- 第二步：真实生成（失败就如实报错，不再有抽取式兜底） ---
  let answer = '';
  let reasoning = '';
  let usage = null;
  let failed = false;

  try {
    for await (const chunk of rag.llm.stream(prompt.messages, {
      temperature,
      signal: abortController.signal,
    })) {
      if (sse.closed) break;
      if (chunk.type === 'reasoning') {
        reasoning += chunk.text;
        sse.send('reasoning', { text: chunk.text });
      } else if (chunk.type === 'delta') {
        answer += chunk.text;
        sse.send('delta', { text: chunk.text });
      } else if (chunk.type === 'usage' && chunk.usage) {
        usage = chunk.usage;
      }
    }
    if (!answer.trim() && !sse.closed) {
      throw new Error('模型返回了空内容');
    }
  } catch (error) {
    failed = true;
    if (abortController.signal.aborted) {
      // 用户主动停止/关页面：不算错误事件，done.stopped 会告诉前端
    } else {
      console.error('[chat] LLM 调用失败：', error);
      sse.send('error', { message: `模型调用失败：${error.message}`, code: 'llm_error' });
    }
  }

  const latencyMs = Date.now() - requestStart;
  // 优先用上游返回的真实 usage；个别网关不返回时按 prompt/答案长度估算（只影响统计，不影响答案）
  const finalUsage = usage || {
    prompt_tokens: prompt.tokens.total + estimateTokens(history.map((m) => m.content).join('')),
    completion_tokens: estimateTokens(answer),
    total_tokens: 0,
  };
  if (!finalUsage.total_tokens) {
    finalUsage.total_tokens = finalUsage.prompt_tokens + finalUsage.completion_tokens;
  }

  sse.send('done', {
    mode: 'llm',
    latencyMs: round(latencyMs),
    usage: finalUsage,
    citations: retrieval.hits.map((hit, index) => ({
      chunkId: hit.chunkId,
      docTitle: hit.docTitle,
      section: hit.section,
      marker: `[${index + 1}]`,
    })),
    // 附加信息：停止生成时告诉前端"是被你停掉的"
    stopped: abortController.signal.aborted || undefined,
    reasoning: reasoning ? true : undefined,
    failed: failed || undefined,
  });
  sse.end();
}
/* ------------------------------------------------------------------ *
 * 七、接口：评测（检索命中率回归）
 * ------------------------------------------------------------------ */

async function handleEval(req, res) {
  if (!requireRag(res)) return;
  const body = await readJsonBody(req).catch(() => ({}));
  const topK = normalizeTopK(body.topK, 5);

  let cases;
  try {
    const raw = await fs.readFile(config.evalPath, 'utf8');
    cases = JSON.parse(raw);
    if (!Array.isArray(cases) || !cases.length) throw new Error('评测集为空');
  } catch (error) {
    return sendJson(res, 200, {
      ok: false,
      reason: `未找到可用的 kb/eval.json：${error.message}`,
    });
  }

  const results = [];
  let latencySum = 0;
  for (const item of cases) {
    const query = String(item.query || '').trim();
    if (!query) continue;
    const result = await rag.retrieve(query, { topK: Math.max(topK, 5), mode: 'hybrid' });
    latencySum += result.latencyMs;
    const rankIndex = result.hits.findIndex(
      (hit) => hit.docId === item.expectDoc || hit.docTitle === item.expectDoc,
    );
    const rank = rankIndex >= 0 ? rankIndex + 1 : null;
    const topHit = result.hits[0];
    results.push({
      query,
      expectDoc: item.expectDoc,
      expectKeywords: item.expectKeywords || [],
      hit: rank !== null && rank <= topK,
      rank,
      topHit: topHit
        ? {
            chunkId: topHit.chunkId,
            docTitle: topHit.docTitle,
            section: topHit.section,
            text: topHit.text,
          }
        : null,
      latencyMs: result.latencyMs,
    });
  }

  const total = results.length || 1;
  const hitAt1 = results.filter((r) => r.rank === 1).length / total;
  const hitAt3 = results.filter((r) => r.rank !== null && r.rank <= 3).length / total;
  const hitAtK = results.filter((r) => r.hit).length / total;
  const mrr = results.reduce((sum, r) => sum + (r.rank ? 1 / r.rank : 0), 0) / total;

  sendJson(res, 200, {
    ok: true,
    topK,
    total: results.length,
    hitAt1: round(hitAt1, 3),
    hitAt3: round(hitAt3, 3),
    hitAtK: round(hitAtK, 3),
    mrr: round(mrr, 3),
    avgLatencyMs: round(latencySum / total, 2),
    cases: results,
  });
}

/* ------------------------------------------------------------------ *
 * 八、路由
 * ------------------------------------------------------------------ */

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const { pathname } = url;
  const method = req.method || 'GET';

  if (pathname.startsWith('/api/')) {
    if (method === 'GET' && pathname === '/api/health') return handleHealth(res);
    if (method === 'GET' && pathname === '/api/kb') return handleKb(req, res, url);
    if (method === 'POST' && pathname === '/api/retrieve') return handleRetrieve(req, res, url);
    if (method === 'POST' && pathname === '/api/chat') return handleChat(req, res);
    if (method === 'POST' && pathname === '/api/eval') return handleEval(req, res);
    return sendError(res, 404, `接口不存在：${method} ${pathname}`, 'not_found');
  }

  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('ok');
  }

  if (method === 'GET' || method === 'HEAD') return serveStatic(req, res, pathname);
  return sendError(res, 405, `不支持的方法：${method}`, 'method_not_allowed');
}

const server = http.createServer((req, res) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (process.env.LOG === '0') return;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    console.log(
      `[http] ${time} ${req.method} ${decodeURIComponent(req.url || '')} → ${res.statusCode} ${ms.toFixed(1)}ms`,
    );
  });
  route(req, res).catch((error) => {
    // 参数类错误给 400，其它一律 500，前端可以据此区分"我传错了"还是"服务坏了"
    const status = error?.code === 'bad_request' ? 400 : error?.code === 'not_found' ? 404 : 500;
    if (status >= 500) console.error('[http] 未捕获异常：', error?.stack || error);
    if (!res.headersSent) {
      sendError(res, status, error?.message || String(error), error?.code || 'internal');
    } else {
      res.end();
    }
  });
});

// SSE 长连接需要关掉默认的请求超时，否则生成慢一点就会被掐断
server.requestTimeout = 0;
server.headersTimeout = 0;
server.keepAliveTimeout = 65_000;

async function main() {
  await initRag();
  server.listen(config.port, config.host, () => {
    console.log('');
    console.log('  ██████╗  █████╗  ██████╗     ██████╗███████╗');
    console.log('  ██╔══██╗██╔══██╗██╔════╝    ██╔════╝██╔════╝');
    console.log('  ██████╔╝███████║██║  ███╗    ██║     ███████╗');
    console.log('  ██╔══██╗██╔══██║██║   ██║    ██║     ╚════██║');
    console.log('  ██║  ██║██║  ██║╚██████╔╝    ╚██████╗███████║');
    console.log('  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝      ╚═════╝╚══════╝');
    console.log('');
    console.log(`  RAG 客服 Demo 已启动: http://${config.host}:${config.port}`);
    console.log(
      `  模式: ${
        rag?.llm?.available
          ? `真实大模型（${config.llm.model}）`
          : '未连接真实大模型（未配置 API Key，/api/chat 会返回 llm_not_configured）'
      }`,
    );
    console.log('');
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\n[server] 收到 ${signal}，正在关闭…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  });
}

main().catch((error) => {
  console.error('[server] 启动失败：', error);
  process.exit(1);
});
