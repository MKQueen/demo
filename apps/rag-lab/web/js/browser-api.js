/**
 * browser-api.js —— 浏览器模式（构建版）的「本地 API 层」
 *
 * 构建脚本注入 window.__RAG_BROWSER_MODE__ = true 时，api.js 会把这些函数当作同名远程接口的替代品：
 *
 *   getHealth()   ≈ GET  /api/health
 *   getKb()       ≈ GET  /api/kb
 *   postRetrieve()≈ POST /api/retrieve
 *   postEval()    ≈ POST /api/eval
 *   streamChat()  ≈ POST /api/chat（SSE）
 *
 * 数据与检索全部在浏览器里完成：kb-data.json 由构建脚本用 rag/loader.js 解析生成，
 * 切块 / 哈希向量 / BM25 / RRF / PCA 复用 web/js/engine/ 的浏览器版内核。
 *
 * 生成是**真实的大模型调用**：浏览器把拼好的 prompt.messages POST 到同源转发层
 * /api/llm/chat/completions（由本地预览服务器注入 Authorization 并透传 SSE），
 * 浏览器永远不接触 API Key。没有可用模型时只报错，绝不伪造/兜底答案。
 *
 * streamChat 按与服务端模式一致的事件顺序逐事件回调：
 *   meta → retrieval → prompt → reasoning* → delta* → done
 * 失败时先 error(message/code)、再 done(failed:true)。
 */
import { createStaticRag, resolveAssetUrl } from './engine/index.js';
import { estimateTokens, round, roundMs } from './engine/util.js';

/** 模型转发层（同源；站点根拦截，不受 /demos/<id>/ 前缀影响） */
const LLM_HEALTH_URL = '/api/llm/health';
const LLM_CHAT_URL = '/api/llm/chat/completions';
const LLM_HEALTH_TIMEOUT_MS = 4000;
const DEFAULT_MAX_TOKENS = 1024;

const DISCONNECTED_NOTE =
  '未连接真实模型：请在项目根目录运行 npm run serve 启动本地预览与模型转发，然后点「重新连接」。';
const UNCONFIGURED_NOTE =
  '未配置模型 Key：在 apps/rag-lab/.env（或复用 apps/agent-lab/.env）写入 DEEPSEEK_API_KEY / OPENAI_BASE_URL / RAG_MODEL，然后重启 npm run serve。';

const state = {
  ragPromise: null,
  rag: null,
  kbCache: null,
  /** 健康检查里的模型状态：每次 getHealth 重新探测，不做结果缓存（「重新连接」要能立刻生效） */
  llmHealthPromise: null,
  startedAt: typeof performance !== 'undefined' ? performance.now() : Date.now(),
};

/* ==========================================================================
   基础工具
   ========================================================================== */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function abortError() {
  return new DOMException('生成已被用户取消', 'AbortError');
}

function isAbortError(error) {
  return error && (error.name === 'AbortError' || error.code === 20);
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) throw abortError();
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`加载 ${url} 失败（HTTP ${response.status}）`);
  }
  return response.json();
}

function normalizeTopK(value, fallback) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.max(1, Math.min(20, number));
}

function normalizeMode(mode) {
  return ['hybrid', 'vector', 'keyword'].includes(mode) ? mode : 'hybrid';
}

function normalizeTemperature(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.3;
  return Math.max(0, Math.min(2, number));
}

function normalizeMaxTokens(value) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_MAX_TOKENS;
  return Math.min(8192, number);
}

/** 与 server.js 的 normalizeMessages 保持一致的校验与裁剪 */
function normalizeMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    const error = new Error('messages 不能为空');
    error.code = 'bad_request';
    throw error;
  }
  const messages = raw
    .filter((m) => m && typeof m.content === 'string' && ['user', 'assistant', 'system'].includes(m.role))
    .map((m) => ({ role: m.role, content: m.content }))
    .slice(-24);
  if (!messages.some((m) => m.role === 'user')) {
    const error = new Error('messages 里必须包含 user 消息');
    error.code = 'bad_request';
    throw error;
  }
  return messages;
}

/** 上游 usage → done.usage 的三字段口径；全是 0 / 缺失时返回 null，交给本地估算 */
function normalizeUsage(usage) {
  if (!usage) return null;
  const prompt = Number(usage.prompt_tokens ?? usage.input_tokens);
  const completion = Number(usage.completion_tokens ?? usage.output_tokens);
  const total = Number(usage.total_tokens);
  const promptTokens = Number.isFinite(prompt) && prompt > 0 ? prompt : 0;
  const completionTokens = Number.isFinite(completion) && completion > 0 ? completion : 0;
  const hasUsage = promptTokens > 0 || completionTokens > 0 || (Number.isFinite(total) && total > 0);
  if (!hasUsage) return null;
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: Number.isFinite(total) && total > 0 ? total : promptTokens + completionTokens,
  };
}

const EMPTY_USAGE = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

/** 上游没给 usage 时按 prompt + 已生成正文本地估算（口径与服务端 fallbackUsage 一致） */
function fallbackUsage(prompt, history, answer) {
  const historyTokens = (Array.isArray(history) ? history : []).map((message) => message.content).join('');
  const promptTokens = (prompt?.tokens?.total || 0) + estimateTokens(historyTokens);
  const completionTokens = estimateTokens(answer || '');
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
  };
}

/* ==========================================================================
   RAG 实例 / 真实模型健康状态
   ========================================================================== */
export function getRag() {
  if (!state.ragPromise) {
    state.ragPromise = createStaticRag({ kbUrl: resolveAssetUrl('kb-data.json') })
      .then((rag) => {
        state.rag = rag;
        return rag;
      })
      .catch((error) => {
        state.ragPromise = null; // 允许重试
        throw error;
      });
  }
  return state.ragPromise;
}

/**
 * 探测同源模型转发层：返回 GET /api/llm/health 的形状（再补一个 mode 归一化）。
 * 探测失败（静态托管 404 / 预览服务没起 / 超时）一律视为未连接，并给出可操作提示。
 * @returns {Promise<{ok:boolean, configured:boolean, mode:'llm'|'disconnected', model:string, baseUrl:string, note:string}>}
 */
async function fetchLlmHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(LLM_HEALTH_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const configured = Boolean(data?.configured) && data?.mode !== 'disconnected';
    return {
      ok: Boolean(data?.ok ?? true),
      configured,
      mode: configured ? 'llm' : 'disconnected',
      model: configured ? String(data?.model || '') : '',
      baseUrl: configured ? String(data?.baseUrl || '') : '',
      note: String(data?.note || '') || (configured ? '真实模型转发层已连接。' : UNCONFIGURED_NOTE),
    };
  } catch {
    return {
      ok: false,
      configured: false,
      mode: 'disconnected',
      model: '',
      baseUrl: '',
      note: DISCONNECTED_NOTE,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 并发去重（不是结果缓存）：boot / 重连 / 对话结束后可能同时触发 */
function loadLlmHealth() {
  if (!state.llmHealthPromise) {
    state.llmHealthPromise = fetchLlmHealth().finally(() => {
      state.llmHealthPromise = null;
    });
  }
  return state.llmHealthPromise;
}

/* ==========================================================================
   GET /api/health
   ========================================================================== */
export async function getHealth() {
  const [llm, ragResult] = await Promise.all([
    loadLlmHealth(),
    getRag().then(
      (rag) => ({ rag }),
      (error) => ({ error }),
    ),
  ]);

  const rag = ragResult.rag || null;
  const kb = { docs: 0, chunks: 0, tokens: 0 };
  let embedding = {
    mode: 'hash',
    dim: 0,
    note: '浏览器内哈希向量（字符 bigram + 签名哈希 + 句子级 max-pool）',
  };
  if (rag) {
    const stats = rag.stats();
    kb.docs = stats.docs;
    kb.chunks = stats.chunks;
    kb.tokens = stats.totalTokens || 0;
    embedding = { ...rag.embedding };
  }

  const payload = {
    ok: Boolean(rag),
    browser: true,
    version: rag?.info?.version || '0.1.0',
    llm,
    embedding,
    kb,
    uptimeMs: roundMs((typeof performance !== 'undefined' ? performance.now() : Date.now()) - state.startedAt),
  };
  if (!rag) payload.kbError = ragResult.error?.message || '浏览器内知识库加载失败';
  return payload;
}

/* ==========================================================================
   GET /api/kb
   ========================================================================== */
export async function getKb() {
  const rag = await getRag();
  if (!state.kbCache) state.kbCache = await rag.snapshot();
  return state.kbCache;
}

/* ==========================================================================
   POST /api/retrieve
   ========================================================================== */
export async function postRetrieve(query, topK = 5, mode = 'hybrid') {
  const rag = await getRag();
  const text = typeof query === 'string' ? query : '';
  if (!text.trim()) {
    const error = new Error('query 不能为空');
    error.code = 'bad_request';
    throw error;
  }
  return rag.retrieve(text, { topK: normalizeTopK(topK, rag.defaultTopK || 6), mode: normalizeMode(mode) });
}

/* ==========================================================================
   POST /api/eval —— 结构和 server.js handleEval 完全一致
   ========================================================================== */
export async function postEval(topK = 5) {
  const rag = await getRag();
  const k = normalizeTopK(topK, 5);

  let cases;
  try {
    const raw = await fetchJson(resolveAssetUrl('eval.json'));
    cases = raw;
    if (!Array.isArray(cases) || !cases.length) throw new Error('评测集为空');
  } catch (error) {
    return { ok: false, reason: `未找到可用的 eval.json：${error.message}` };
  }

  const results = [];
  let latencySum = 0;
  // 逐条让出主线程：既能让「运行中」的 loading 状态真的渲染出来，也避免长任务卡住页面
  for (const item of cases) {
    const query = String(item.query || '').trim();
    if (!query) continue;
    const result = await rag.retrieve(query, { topK: Math.max(k, 5), mode: 'hybrid' });
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
      hit: rank !== null && rank <= k,
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
    await sleep(8);
  }

  const total = results.length || 1;
  const hitAt1 = results.filter((r) => r.rank === 1).length / total;
  const hitAt3 = results.filter((r) => r.rank !== null && r.rank <= 3).length / total;
  const hitAtK = results.filter((r) => r.hit).length / total;
  const mrr = results.reduce((sum, r) => sum + (r.rank ? 1 / r.rank : 0), 0) / total;

  return {
    ok: true,
    topK: k,
    total: results.length,
    hitAt1: round(hitAt1, 3),
    hitAt3: round(hitAt3, 3),
    hitAtK: round(hitAtK, 3),
    mrr: round(mrr, 3),
    avgLatencyMs: round(latencySum / total, 2),
    cases: results,
  };
}

/* ==========================================================================
   POST /api/chat（浏览器内检索 + 真实模型流式生成）
   ========================================================================== */

/**
 * 解析 OpenAI 兼容 SSE 的一行；命中时把内容追加到生成结果里。
 * @param {string} rawLine
 * @param {{answer:string, reasoning:string, usage:object|null, error:string|null}} acc
 * @param {(event: string, data: any) => void} onEvent
 */
function consumeSseLine(rawLine, acc, onEvent) {
  const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
  if (!line || line.startsWith(':')) return;
  if (!line.startsWith('data:')) return;
  let payload = line.slice(5);
  if (payload.startsWith(' ')) payload = payload.slice(1);
  payload = payload.trim();
  if (!payload || payload === '[DONE]') return;

  let data;
  try {
    data = JSON.parse(payload);
  } catch {
    return; // 网关的注释/心跳等非 JSON 行，忽略即可
  }

  if (data?.error) {
    acc.error = data.error.message || data.error.code || '模型返回了错误';
    return;
  }

  const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
  const delta = choice?.delta || choice?.message || null;
  const reasoningText = delta?.reasoning_content ?? delta?.reasoning;
  if (typeof reasoningText === 'string' && reasoningText) {
    acc.reasoning += reasoningText;
    onEvent('reasoning', { text: reasoningText });
  }
  const content = delta?.content;
  if (typeof content === 'string' && content) {
    acc.answer += content;
    onEvent('delta', { text: content });
  }
  const usage = normalizeUsage(data?.usage);
  if (usage) acc.usage = usage;
}

/**
 * 浏览器模式对话：浏览器内检索 → 浏览器内 Prompt 拼装 → 同源转发层真实生成。
 *
 * @param {object} params
 * @param {Array<{role:string, content:string}>} params.messages
 * @param {number} [params.topK]
 * @param {'hybrid'|'vector'|'keyword'} [params.mode]
 * @param {number} [params.temperature]
 * @param {number} [params.maxTokens]
 * @param {AbortSignal} [params.signal]
 * @param {(event: string, data: any) => void} params.onEvent
 * @returns {Promise<void>} 正常结束（含 done.failed）时 resolve；用户取消时 reject AbortError
 */
export async function streamChat({
  messages,
  topK,
  mode = 'hybrid',
  temperature = 0.3,
  maxTokens = DEFAULT_MAX_TOKENS,
  signal,
  onEvent,
} = {}) {
  if (typeof onEvent !== 'function') throw new Error('streamChat 需要 onEvent 回调');

  const list = normalizeMessages(messages);
  const question = [...list].reverse().find((message) => message.role === 'user')?.content || '';
  const history = list.slice(0, -1);
  const k = normalizeTopK(topK, 5);
  const temperatureValue = normalizeTemperature(temperature);
  const maxTokensValue = normalizeMaxTokens(maxTokens);

  const startedAt = Date.now();
  const startMark = typeof performance !== 'undefined' ? performance.now() : startedAt;
  const latency = () => roundMs((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMark);

  throwIfAborted(signal);

  // --- 第一步：确认有可用的真实模型（没有就只报错，绝不伪造答案） ---
  const llm = await loadLlmHealth();
  throwIfAborted(signal);

  onEvent('meta', { mode: 'llm', model: llm.model || '', startedAt });

  /** done.citations 结构（service 端契约不变）：Top-K 命中 → [1] [2] … 角标 */
  const citationsOf = (list) =>
    (Array.isArray(list) ? list : []).map((hit, index) => ({
      chunkId: hit.chunkId,
      docTitle: hit.docTitle,
      section: hit.section,
      marker: `[${index + 1}]`,
    }));

  /** 失败收尾：先 error，再 done(failed:true)；已生成的部分保留在上层 UI 里 */
  const fail = (message, code, { prompt = null, hits = [], answer = '', reasoning = '', usage = null } = {}) => {
    onEvent('error', { message, code });
    onEvent('done', {
      mode: 'llm',
      latencyMs: latency(),
      usage: usage || (answer ? fallbackUsage(prompt, history, answer) : { ...EMPTY_USAGE }),
      citations: citationsOf(hits),
      reasoning: reasoning ? true : undefined,
      failed: true,
    });
  };

  if (!llm.configured) {
    fail(llm.note || UNCONFIGURED_NOTE, 'llm_not_configured');
    return;
  }

  // --- 第二步：浏览器内检索 + Prompt 拼装（RAG 的 R 与 A 之间的可解释部分） ---
  let rag;
  let retrieval;
  let prompt;
  try {
    rag = await getRag();
    throwIfAborted(signal);
    retrieval = await rag.retrieve(question, { topK: k, mode: normalizeMode(mode) });
    throwIfAborted(signal);
    prompt = rag.buildPrompt({ hits: retrieval.hits, history, question });
  } catch (error) {
    if (isAbortError(error)) throw error;
    fail(`检索失败：${error?.message || error}`, 'retrieval_error');
    return;
  }

  const hits = Array.isArray(retrieval?.hits) ? retrieval.hits : [];

  throwIfAborted(signal);
  onEvent('retrieval', retrieval);
  onEvent('prompt', prompt);

  // --- 第三步：把真实 prompt.messages POST 到同源转发层，逐 delta 解析 ---
  const body = {
    model: llm.model,
    messages: prompt.messages,
    stream: true,
    // 让网关在流末尾补一条 usage chunk（前端与转发层都只做透传，不碰上游协议细节）
    stream_options: { include_usage: true },
    temperature: temperatureValue,
    max_tokens: maxTokensValue,
  };

  let response;
  try {
    response = await fetch(LLM_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
      cache: 'no-store',
    });
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw error;
    fail(
      '无法连接真实模型转发层：请确认本地预览服务正在运行（项目根目录 npm run serve），然后点「重新连接」。',
      'llm_network_error',
    );
    return;
  }

  if (!response.ok) {
    let message = `真实模型请求失败（HTTP ${response.status}）`;
    let code = '';
    try {
      const data = await response.json();
      message = data?.error?.message || message;
      code = data?.error?.code || '';
    } catch {
      /* 非 JSON 错误体忽略 */
    }
    fail(message, code || 'llm_http_error');
    return;
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const acc = { answer: '', reasoning: '', usage: null, error: null };

  // 少数兼容网关会忽略 stream:true 直接返回一个完整 JSON：那也是真实模型输出，照常展示
  if (!contentType.includes('text/event-stream')) {
    let data = null;
    try {
      data = await response.json();
    } catch {
      /* ignore */
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content) {
      acc.answer = content;
      acc.usage = normalizeUsage(data?.usage);
      acc.reasoning = String(data?.choices?.[0]?.message?.reasoning_content || '');
      if (acc.reasoning) onEvent('reasoning', { text: acc.reasoning });
      onEvent('delta', { text: content });
    } else {
      const message = data?.error?.message || '真实模型转发层没有返回可解析的内容（不是 SSE 流）';
      fail(message, data?.error?.code || 'llm_bad_response');
      return;
    }
  } else if (!response.body) {
    fail('真实模型响应没有可读取的流（response.body 为空）', 'llm_stream_error');
    return;
  } else {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finished = false;
    try {
      while (true) {
        throwIfAborted(signal);
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          consumeSseLine(buffer.slice(0, newline), acc, onEvent);
          buffer = buffer.slice(newline + 1);
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) consumeSseLine(buffer, acc, onEvent);
      finished = true;
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) throw error;
      fail(`流式连接中断：${error?.message || error}`, 'llm_stream_error', {
        prompt,
        hits,
        answer: acc.answer,
        reasoning: acc.reasoning,
        usage: acc.usage,
      });
      return;
    } finally {
      if (!finished) {
        try {
          await reader.cancel();
        } catch {
          /* 连接已断开时忽略 */
        }
      }
      try {
        reader.releaseLock();
      } catch {
        /* ignore */
      }
    }
  }

  throwIfAborted(signal);

  if (acc.error) {
    fail(acc.error, 'llm_stream_error', {
      prompt,
      hits,
      answer: acc.answer,
      reasoning: acc.reasoning,
      usage: acc.usage,
    });
    return;
  }

  if (!acc.answer.trim()) {
    fail('模型没有返回任何内容，请重试或检查模型配置。', 'empty_response', {
      prompt,
      hits,
      reasoning: acc.reasoning,
      usage: acc.usage,
    });
    return;
  }

  onEvent('done', {
    mode: 'llm',
    latencyMs: latency(),
    usage: acc.usage || fallbackUsage(prompt, history, acc.answer),
    citations: citationsOf(hits),
    reasoning: acc.reasoning ? true : undefined,
  });
}
