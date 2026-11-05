/**
 * api.js —— 与数据来源交互的唯一出口
 *
 * 两种运行模式共用这一份前端：
 *   - 浏览器模式（npm run build 产物，本地预览）：index.html 里注入了
 *     window.__RAG_BROWSER_MODE__ = true，此时所有接口改走 browser-api.js：
 *     知识库 / 切块 / 哈希向量 / BM25 / RRF / PCA 全部在浏览器内运行，
 *     生成则通过同源轻量转发层（/api/llm/*）真实调用大模型，浏览器不接触 API Key；
 *   - 服务器模式（apps/rag-lab 下 npm start）：同源相对路径请求 /api/*。
 *
 * SSE 用 fetch + ReadableStream 手工解析（需要 POST 与 AbortController，EventSource 做不了）；
 * 浏览器模式的 browser-api 也按同样的事件顺序逐事件回调，对上层完全透明。
 */

/** 统一错误类型，UI 层据此展示友好提示 */
export class ApiError extends Error {
  /**
   * @param {string} message 用户可读的错误信息
   * @param {{ code?: string, status?: number, kind?: 'http'|'network'|'timeout'|'stream'|'parse'|'aborted' }} [meta]
   */
  constructor(message, meta = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = meta.code || '';
    this.status = meta.status || 0;
    this.kind = meta.kind || 'http';
  }
}

/** fetch 网络错误 → 用户可读的中文提示 */
const NETWORK_HINT =
  '无法连接本地服务。请在 apps/rag-lab 目录运行 npm start（或在项目根目录运行 npm run serve 启动一体化预览），然后重试。';

function isAbortError(error) {
  return error && (error.name === 'AbortError' || error.code === 20);
}

/* ==========================================================================
   模式分流：浏览器构建产物 vs 服务器模式
   ========================================================================== */
/** 构建脚本注入的浏览器模式标记；服务器模式下不存在 */
export function isBrowserMode() {
  return Boolean(globalThis.__RAG_BROWSER_MODE__);
}

/** browser-api.js 只在浏览器模式下按需动态加载，服务器模式不会多请求一个文件 */
let browserApiPromise = null;
function loadBrowserApi() {
  if (!browserApiPromise) {
    browserApiPromise = import('./browser-api.js').catch((error) => {
      browserApiPromise = null;
      throw new ApiError(`浏览器本地引擎加载失败：${error?.message || error}`, { kind: 'network' });
    });
  }
  return browserApiPromise;
}

/**
 * 通用 JSON 请求：超时、HTTP 错误、非 JSON 响应统一转成 ApiError。
 * @param {string} path
 * @param {{ method?: string, body?: object, signal?: AbortSignal, timeout?: number }} [options]
 */
async function fetchJSON(path, options = {}) {
  const { method = 'GET', body, signal, timeout = 15000 } = options;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    signal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = window.setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new ApiError(`服务返回了非 JSON 内容（HTTP ${response.status}）`, {
          kind: 'parse',
          status: response.status,
        });
      }
    }
    if (!response.ok) {
      const message = data?.error?.message || `请求失败（HTTP ${response.status}）`;
      throw new ApiError(message, {
        kind: 'http',
        status: response.status,
        code: data?.error?.code || '',
      });
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (isAbortError(error)) {
      if (signal?.aborted) throw error; // 调用方主动取消，交给调用方处理
      throw new ApiError(`请求超时（${Math.round(timeout / 1000)} 秒）`, { kind: 'timeout' });
    }
    throw new ApiError(NETWORK_HINT, { kind: 'network' });
  } finally {
    window.clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/* ==========================================================================
   接口
   ========================================================================== */

/** §1 健康检查（含本地知识库统计 / 真实模型连接状态） */
export async function getHealth() {
  if (isBrowserMode()) return (await loadBrowserApi()).getHealth();
  return fetchJSON('/api/health', { timeout: 6000 });
}

/** §2 知识库全量快照（文档、块、二维投影） */
export async function getKb() {
  if (isBrowserMode()) return (await loadBrowserApi()).getKb();
  return fetchJSON('/api/kb', { timeout: 12000 });
}

/** §3 仅检索（当前界面主要用 SSE 里的 retrieval；此接口用于调试与兜底） */
export async function postRetrieve(query, topK = 5, mode = 'hybrid') {
  if (isBrowserMode()) return (await loadBrowserApi()).postRetrieve(query, topK, mode);
  return fetchJSON('/api/retrieve', {
    method: 'POST',
    body: { query, topK, mode },
    timeout: 15000,
  });
}

/** §5 检索评测（按需触发） */
export async function postEval(topK = 5) {
  if (isBrowserMode()) return (await loadBrowserApi()).postEval(topK);
  return fetchJSON('/api/eval', {
    method: 'POST',
    body: { topK },
    timeout: 30000,
  });
}

/* ==========================================================================
   §4 SSE 流式对话
   ========================================================================== */

/**
 * 解析单个 SSE 事件块（形如 "event: delta\ndata: {...}"）。
 * 返回 null 表示该块没有 data 行。
 */
function parseSseBlock(block) {
  let eventName = 'message';
  const dataLines = [];
  for (const rawLine of block.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      // SSE 规范：冒号后若有一个空格则去掉（仅去掉一个）
      let value = line.slice(5);
      if (value.startsWith(' ')) value = value.slice(1);
      dataLines.push(value);
    }
  }
  if (!dataLines.length) return null;
  const raw = dataLines.join('\n');
  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { raw };
  }
  return { event: eventName, data: payload };
}

/**
 * 发起 SSE 对话请求并逐事件回调。
 *
 * @param {object} params
 * @param {Array<{role:string, content:string}>} params.messages 完整多轮历史（最后一条是 user）
 * @param {number} params.topK
 * @param {'hybrid'|'vector'|'keyword'} [params.mode]
 * @param {number} [params.temperature]
 * @param {number} [params.maxTokens]
 * @param {AbortSignal} [params.signal] 用于「停止生成」
 * @param {(event: string, data: any) => void} params.onEvent 事件回调（meta/retrieval/prompt/reasoning/delta/error/done）
 * @returns {Promise<void>} 流正常结束时 resolve；被取消时 reject AbortError
 */
export async function streamChat({
  messages,
  topK,
  mode = 'hybrid',
  temperature = 0.3,
  maxTokens = 1024,
  signal,
  onEvent,
}) {
  // 浏览器模式：浏览器内检索 + Prompt 拼装，生成走同源模型转发层
  if (isBrowserMode()) {
    const browserApi = await loadBrowserApi();
    return browserApi.streamChat({ messages, topK, mode, temperature, maxTokens, signal, onEvent });
  }

  let response;
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ messages, topK, mode, temperature }),
      signal,
      cache: 'no-store',
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError(NETWORK_HINT, { kind: 'network' });
  }

  if (!response.ok) {
    let message = `对话请求失败（HTTP ${response.status}）`;
    let code = '';
    try {
      const data = await response.json();
      message = data?.error?.message || message;
      code = data?.error?.code || '';
    } catch {
      /* 忽略非 JSON 错误体 */
    }
    throw new ApiError(message, { kind: 'http', status: response.status, code });
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    // 服务端异常兜底返回 JSON 时，也给出可读错误，而不是静默失败
    let message = '服务没有返回 SSE 流（Content-Type 不是 text/event-stream）';
    try {
      const data = await response.json();
      message = data?.error?.message || message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, { kind: 'stream', status: response.status });
  }

  if (!response.body) {
    throw new ApiError('当前浏览器不支持流式响应（response.body 为空）', { kind: 'stream' });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finished = false;
  let eventCount = 0;

  const dispatch = (block) => {
    const parsed = parseSseBlock(block);
    if (!parsed) return;
    eventCount += 1;
    onEvent(parsed.event, parsed.data);
  };

  try {
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // 兼容 \r\n：先归一化，再按空行切事件
      if (buffer.includes('\r')) buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      let separator = buffer.indexOf('\n\n');
      while (separator >= 0) {
        const block = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        if (block.trim()) dispatch(block);
        separator = buffer.indexOf('\n\n');
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) dispatch(buffer);
    finished = true;
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError('流式连接中断，请重试。', { kind: 'stream' });
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
    if (eventCount === 0 && !signal?.aborted) {
      throw new ApiError('SSE 流已结束但未收到任何事件，请检查服务端实现。', { kind: 'stream' });
    }
  }
}
