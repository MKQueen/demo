/**
 * test/api.test.js —— 端到端契约测试（真正的 server.js + 真正的知识库 + 真正的 rag + 本地假模型）
 *
 * 测试里会起两个 server.js 子进程：
 *   1) 「已配置 Key」：OPENAI_BASE_URL 指向 test/fixtures/fake-llm-server.js 起的本地假
 *      OpenAI 兼容 SSE 服务，断言真实链路——health.mode='llm'、SSE 事件顺序、
 *      答案来自模型流、done.usage 来自上游 usage；
 *   2) 「未配置 Key」：断言 /api/chat 明确返回 error(llm_not_configured) + done(failed)，
 *      且没有任何 delta —— 绝不伪造/抽取答案。
 *
 * 全程不联网、不调用付费接口；每一步都断言 docs/API.md 里承诺的字段，防止契约漂移。
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  FAKE_ANSWER,
  FAKE_ANSWER_PARTS,
  FAKE_MODEL,
  FAKE_REASONING,
  FAKE_USAGE,
  startFakeLlmServer,
} from './fixtures/fake-llm-server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 找一个空闲端口，避免并行跑测试时端口冲突 */
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const children = [];
let fakeLlm = null;
let serverLog = '';
let baseUrl = '';
let noKeyBaseUrl = '';

function spawnServer(port, env) {
  const child = spawn(process.execPath, ['server.js', '--port', String(port)], {
    cwd: ROOT,
    env: { ...process.env, LOG: '0', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  child.stdout.on('data', (chunk) => {
    serverLog += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    serverLog += chunk.toString();
  });
  return child;
}

async function waitForHealth(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return await res.json();
      lastError = `HTTP ${res.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`服务未在 ${timeoutMs}ms 内就绪: ${lastError}\n${serverLog}`);
}

async function postJson(base, pathname, body) {
  const res = await fetch(`${base}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

/** 读取 SSE 流并按事件解析成数组 */
async function readSse(base, pathname, body) {
  const res = await fetch(`${base}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(res.status, 200, 'SSE 应返回 200');
  assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index = buffer.indexOf('\n\n');
    while (index >= 0) {
      const raw = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const eventLine = raw.split('\n').find((line) => line.startsWith('event:'));
      const dataLine = raw.split('\n').find((line) => line.startsWith('data:'));
      if (eventLine && dataLine) {
        events.push({
          event: eventLine.slice(6).trim(),
          data: JSON.parse(dataLine.slice(5).trim()),
        });
      }
      index = buffer.indexOf('\n\n');
    }
  }
  return events;
}

before(async () => {
  fakeLlm = await startFakeLlmServer();

  // 已配置 Key 的服务：baseUrl 指向本地假模型，key/model 都用测试值
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  spawnServer(port, {
    DEEPSEEK_API_KEY: 'test-key',
    OPENAI_API_KEY: '',
    RAG_API_KEY: '',
    LLM_API_KEY: '',
    OPENAI_BASE_URL: fakeLlm.baseUrl,
    RAG_BASE_URL: '',
    RAG_MODEL: FAKE_MODEL,
    RAG_EMBED_DIM: '8192',
  });

  // 未配置 Key 的服务：所有 key 变量都清空（覆盖 .env 里的配置），只验证「明确报未连接」
  const noKeyPort = await freePort();
  noKeyBaseUrl = `http://127.0.0.1:${noKeyPort}`;
  spawnServer(noKeyPort, {
    DEEPSEEK_API_KEY: '',
    OPENAI_API_KEY: '',
    RAG_API_KEY: '',
    LLM_API_KEY: '',
    OPENAI_BASE_URL: '',
    RAG_BASE_URL: '',
    RAG_MODEL: '',
    RAG_EMBED_DIM: '8192',
  });

  await Promise.all([waitForHealth(baseUrl), waitForHealth(noKeyBaseUrl)]);
});

after(async () => {
  for (const child of children) child.kill('SIGTERM');
  await fakeLlm?.close();
});

test('GET /api/health：已配置 Key 时 mode=llm，且不泄露 key', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const health = await res.json();
  assert.equal(health.ok, true);
  assert.ok(health.llm, 'health.llm 必须存在');
  assert.equal(health.llm.mode, 'llm', '配置了可用 Key 时 mode 应为 llm');
  assert.equal(health.llm.configured, true);
  assert.equal(health.llm.model, FAKE_MODEL);
  assert.equal(health.llm.baseUrl, fakeLlm.baseUrl);
  assert.match(health.llm.note, /OpenAI 兼容接口/);
  assert.ok(health.embedding.dim > 0);
  assert.ok(health.kb.chunks > 0, '知识库应至少有一个块');
  const raw = JSON.stringify(health);
  assert.ok(!/sk-[a-zA-Z0-9]{6,}/.test(raw), 'health 里绝不能出现 apiKey');
  assert.ok(!raw.includes('test-key'), 'health 里不能出现真实 key 值');
});

test('GET /api/health：未配置 Key 时明确报 disconnected（不出现 mock）', async () => {
  const res = await fetch(`${noKeyBaseUrl}/api/health`);
  assert.equal(res.status, 200);
  const health = await res.json();
  assert.equal(health.ok, true);
  assert.equal(health.llm.mode, 'disconnected');
  assert.equal(health.llm.configured, false);
  assert.match(health.llm.note, /未配置 API Key/);
  assert.equal(JSON.stringify(health).includes('"mock"'), false, 'health 里不应再出现 mock');
});

test('GET /api/kb 返回文档、块与向量空间投影', async () => {
  const res = await fetch(`${baseUrl}/api/kb`);
  assert.equal(res.status, 200);
  const kb = await res.json();

  assert.ok(Array.isArray(kb.docs) && kb.docs.length >= 8, '应有 8 篇知识库文档');
  assert.ok(Array.isArray(kb.chunks) && kb.chunks.length > 0);
  assert.equal(kb.projection.length, kb.chunks.length, '每个块都要有 2D 投影坐标');
  assert.ok(kb.embedding.dim > 0);
  assert.equal(kb.stats.docs, kb.docs.length);
  assert.equal(kb.stats.chunks, kb.chunks.length);

  for (const chunk of kb.chunks) {
    assert.match(chunk.id, /^.+?#\d+$/, `chunk.id 形如 文档#序号，实际 ${chunk.id}`);
    assert.equal(chunk.docId, chunk.id.split('#')[0]);
    assert.ok(typeof chunk.text === 'string' && chunk.text.length > 20);
    assert.ok(typeof chunk.section === 'string' && chunk.section.length > 0);
    assert.ok(chunk.tokens > 0);
  }
  for (const point of kb.projection) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), '投影坐标必须是数字');
    assert.ok(Math.abs(point.x) <= 1.5 && Math.abs(point.y) <= 1.5, '投影坐标应缩放');
  }
  // 文档顺序必须稳定（前端按 order 排序）
  const orders = kb.docs.map((doc) => doc.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
});

test('POST /api/retrieve 返回 5 个阶段、排序正确的命中与查询投影点', async () => {
  const { res, json } = await postJson(baseUrl, '/api/retrieve', {
    query: '七天无理由退货怎么申请',
    topK: 4,
    mode: 'hybrid',
  });
  assert.equal(res.status, 200);
  assert.equal(json.mode, 'hybrid');
  assert.equal(json.topK, 4);
  assert.ok(json.candidates > 0);
  assert.ok(json.latencyMs >= 0);
  assert.equal(json.steps.length, 5, '管道应有 5 个阶段');
  assert.deepEqual(
    json.steps.map((step) => step.key),
    ['analyze', 'embed', 'vector', 'keyword', 'fuse'],
  );
  assert.ok(json.hits.length > 0 && json.hits.length <= 4);
  assert.deepEqual(
    json.hits.map((hit) => hit.rank),
    json.hits.map((_, index) => index + 1),
    'hits 必须按 rank 升序',
  );
  for (const hit of json.hits) {
    assert.ok(hit.scores.vector >= 0 && hit.scores.vector <= 1, `vector 分数越界: ${hit.scores.vector}`);
    assert.ok(hit.scores.fused >= 0 && hit.scores.fused <= 1);
    assert.ok(Array.isArray(hit.matchedTerms));
  }
  assert.ok(json.hits[0].docId.includes('退换货'), `top1 应为退换货政策，实际 ${json.hits[0].docId}`);
  assert.ok(Number.isFinite(json.queryPoint.x) && Number.isFinite(json.queryPoint.y));
  assert.equal(json.queryEmbedding.dim, 8192);

  // mode 切换必须真的换算法
  const vectorOnly = await postJson(baseUrl, '/api/retrieve', { query: '发票重开', topK: 3, mode: 'vector' });
  assert.equal(vectorOnly.json.mode, 'vector');
  const keywordOnly = await postJson(baseUrl, '/api/retrieve', { query: '发票重开', topK: 3, mode: 'keyword' });
  assert.equal(keywordOnly.json.mode, 'keyword');
});

test('POST /api/retrieve 参数校验', async () => {
  const { res, json } = await postJson(baseUrl, '/api/retrieve', { query: '   ' });
  assert.equal(res.status, 400);
  assert.equal(json.error.code, 'bad_request');
});

test('POST /api/chat：真实模型链路的事件顺序、流式答案与上游 usage', async () => {
  const events = await readSse(baseUrl, '/api/chat', {
    messages: [{ role: 'user', content: '我上周买的耳机有杂音，还能退吗？' }],
    topK: 3,
  });

  const names = events.map((item) => item.event);
  assert.equal(names[0], 'meta');
  assert.equal(names[1], 'retrieval');
  assert.equal(names[2], 'prompt');
  assert.equal(names.at(-1), 'done');
  // prompt 之后、done 之前只允许 reasoning / delta（上游真实流）
  assert.ok(names.slice(3, -1).every((name) => name === 'reasoning' || name === 'delta'), names.join(','));
  assert.ok(names.includes('delta'), '必须有流式正文');
  assert.equal(names.filter((name) => name === 'delta').length, FAKE_ANSWER_PARTS.length);

  const meta = events[0].data;
  assert.equal(meta.mode, 'llm', 'meta.mode 只能是 llm');
  assert.equal(meta.model, FAKE_MODEL);
  assert.ok(Number.isFinite(meta.startedAt));

  const retrieval = events[1].data;
  assert.ok(retrieval.hits.length > 0);
  assert.ok(retrieval.hits.length <= 3);

  const prompt = events[2].data;
  assert.ok(Array.isArray(prompt.messages) && prompt.messages.length >= 2);
  assert.equal(prompt.messages[0].role, 'system');
  assert.ok(prompt.contextBlocks.length > 0);
  assert.ok(prompt.contextBlocks[0].marker === '[1]');
  assert.ok(prompt.tokens.total > 0);
  assert.ok(prompt.messages.at(-1).content.includes('[1]'), '上下文要带引用标记');

  const answer = events
    .filter((item) => item.event === 'delta')
    .map((item) => item.data.text)
    .join('');
  assert.equal(answer, FAKE_ANSWER, 'delta 拼出的答案必须来自假模型流');
  assert.match(answer, /\[\d\]/, '答案里应带引用角标');

  const reasoning = events
    .filter((item) => item.event === 'reasoning')
    .map((item) => item.data.text)
    .join('');
  assert.equal(reasoning, FAKE_REASONING, 'reasoning 事件应来自模型思考流');

  const done = events.at(-1).data;
  assert.equal(done.mode, 'llm');
  assert.ok(done.latencyMs >= 0);
  assert.equal(done.failed, undefined);
  assert.equal(done.reasoning, true);
  assert.deepEqual(done.usage, FAKE_USAGE, 'done.usage 必须是上游返回的真实 usage');
  assert.equal(done.citations.length, retrieval.hits.length);
  assert.equal(done.citations[0].marker, '[1]');
  assert.equal(done.citations[0].chunkId, retrieval.hits[0].chunkId);

  // 服务端确实以「真实模型」方式调用了上游：带 Bearer key、stream、include_usage、完整 prompt
  const upstream = fakeLlm.lastRequest;
  assert.ok(upstream, '假模型服务应收到请求');
  assert.equal(upstream.headers.authorization, 'Bearer test-key');
  assert.equal(upstream.body.model, FAKE_MODEL);
  assert.equal(upstream.body.stream, true);
  assert.deepEqual(upstream.body.stream_options, { include_usage: true });
  assert.equal(upstream.body.messages[0].role, 'system');
  assert.ok(upstream.body.messages.at(-1).content.includes('【知识库片段】'));
});

test('POST /api/chat 会带上多轮历史（真实模型链路）', async () => {
  const events = await readSse(baseUrl, '/api/chat', {
    messages: [
      { role: 'user', content: '退货运费谁出？' },
      { role: 'assistant', content: '质量问题由平台承担运费。' },
      { role: 'user', content: '那无理由退货呢？' },
    ],
    topK: 3,
  });
  const prompt = events.find((item) => item.event === 'prompt').data;
  const lastUser = prompt.messages.at(-1).content;
  assert.match(lastUser, /那无理由退货呢/);
  assert.ok(prompt.messages.length >= 3, '历史消息应进入 prompt');
  const retrieval = events.find((item) => item.event === 'retrieval').data;
  assert.match(retrieval.query, /那无理由退货呢/);
});

test('POST /api/chat 参数校验', async () => {
  const { res, json } = await postJson(baseUrl, '/api/chat', { messages: [] });
  assert.equal(res.status, 400);
  assert.equal(json.error.code, 'bad_request');
});

test('POST /api/chat：未配置 Key 时只报 llm_not_configured + done(failed)，没有任何 delta', async () => {
  const events = await readSse(noKeyBaseUrl, '/api/chat', {
    messages: [{ role: 'user', content: '我上周买的耳机有杂音，还能退吗？' }],
    topK: 3,
  });

  assert.deepEqual(
    events.map((item) => item.event),
    ['error', 'done'],
    '未配置 Key 时只能发 error + done，不能有 delta',
  );

  const error = events[0].data;
  assert.equal(error.code, 'llm_not_configured');
  assert.match(error.message, /未连接真实大模型/);
  assert.match(error.message, /\.env/, '错误信息里要给出配置 .env 的可操作提示');

  const done = events[1].data;
  assert.equal(done.mode, 'disconnected');
  assert.equal(done.failed, true);
  assert.deepEqual(done.usage, { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
  assert.deepEqual(done.citations, []);
  assert.equal(events.some((item) => item.event === 'delta'), false);
  assert.equal(events.some((item) => item.event === 'reasoning'), false);
});

test('POST /api/chat：LLM 报错时只发 error + done(failed)，不降级伪造答案', async () => {
  // 让假模型服务对这批请求返回 500：服务端应如实报错，不能生成本地答案
  await fakeLlm.close();
  const failing = await startFakeLlmServer({ status: 500, errorMessage: 'fake upstream down' });
  const port = await freePort();
  const failBase = `http://127.0.0.1:${port}`;
  spawnServer(port, {
    DEEPSEEK_API_KEY: 'test-key',
    OPENAI_API_KEY: '',
    RAG_API_KEY: '',
    LLM_API_KEY: '',
    OPENAI_BASE_URL: failing.baseUrl,
    RAG_BASE_URL: '',
    RAG_MODEL: FAKE_MODEL,
    RAG_EMBED_DIM: '8192',
  });
  try {
    await waitForHealth(failBase);
    const events = await readSse(failBase, '/api/chat', {
      messages: [{ role: 'user', content: '耳机有杂音能退吗' }],
      topK: 2,
    });
    const names = events.map((item) => item.event);
    assert.equal(names.includes('error'), true, '上游失败时必须有 error 事件');
    assert.equal(events.some((item) => item.event === 'delta'), false, '不能降级出任何答案文本');
    const done = events.at(-1).data;
    assert.equal(done.mode, 'llm');
    assert.equal(done.failed, true);
    assert.ok(Array.isArray(done.citations) && done.citations.length > 0, '检索结果仍应保留在 citations');
  } finally {
    await failing.close();
  }
});

test('POST /api/eval 跑 kb/eval.json 并给出命中率', async () => {
  let raw = null;
  try {
    raw = JSON.parse(await fs.readFile(path.join(ROOT, 'kb', 'eval.json'), 'utf8'));
  } catch {
    // 评测集还没写：跳过（kb-content 负责补齐）
    return;
  }
  const { res, json } = await postJson(baseUrl, '/api/eval', { topK: 5 });
  assert.equal(res.status, 200);
  assert.equal(json.ok, true);
  assert.equal(json.total, raw.length);
  assert.ok(json.hitAt1 >= 0 && json.hitAt1 <= 1);
  assert.ok(json.hitAtK >= 0.6, `hit@5 应至少 0.6，实际 ${json.hitAtK}`);
  assert.equal(json.cases.length, raw.length);
  for (const item of json.cases) {
    assert.ok(item.query && item.expectDoc);
    assert.ok(item.topHit && item.topHit.docTitle, '每个用例都要带回 top1 供前端展示');
  }
});

test('静态页面可访问', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
  const html = await res.text();
  assert.match(html, /<html/i);
  assert.match(html, /<\/body>/i);
});

test('未知接口返回结构化 404', async () => {
  const res = await fetch(`${baseUrl}/api/nope`);
  assert.equal(res.status, 404);
  const json = await res.json();
  assert.equal(json.error.code, 'not_found');
});
