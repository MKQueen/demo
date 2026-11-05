/**
 * llm.js —— OpenAI 兼容的流式客户端（零依赖，只用 fetch）。
 *
 * 约定：
 *   - 请求 `POST {baseUrl}/chat/completions`，body 里 `stream: true`，并带
 *     `stream_options: { include_usage: true }` 让上游把真实 token 用量放在最后一条 chunk 里；
 *   - 逐行解析 SSE 的 `data: {...}`，DeepSeek 会先吐 `delta.reasoning_content`
 *     （思考过程，映射成 {type:"reasoning"}）再吐 `delta.content`（正文，{type:"delta"}）；
 *     末尾带 `usage` 的 chunk 映射成 {type:"usage"}；
 *   - 支持 AbortSignal（前端「停止生成」）与超时（默认 60s）；
 *   - 没配可用 API key 时 available=false、mode="disconnected"、stream() 直接抛错。
 *     调用方（server.js）必须把「未连接」如实报给前端，绝不用本地答案兜底。
 *
 * 这里刻意不依赖 openai SDK：HTTP 细节全部可读，正好是教学 Demo 想展示的部分。
 */
export const DEFAULT_BASE_URL = 'https://api.deepseek.com';
export const DEFAULT_MODEL = 'deepseek-flash';
export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_TOKENS = 1024;
export const DEFAULT_TEMPERATURE = 0.3;

/**
 * @param {{apiKey?: string, baseUrl?: string, model?: string, timeoutMs?: number}|null} llmConfig
 */
export function createLlm(llmConfig = null) {
  const config = llmConfig || {};
  const apiKey = String(config.apiKey || '').trim();
  const baseUrl = String(config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const model = String(config.model || DEFAULT_MODEL);
  // 客服场景不需要长思考：默认 low，能明显缩短首字延迟；不同厂商若不支持该字段可用空字符串关掉
  const reasoningEffort = String(config.reasoningEffort ?? 'low').trim();
  const timeoutMs =
    Number(config.timeoutMs) > 0 ? Number(config.timeoutMs) : DEFAULT_TIMEOUT_MS;

  // 占位符 key（.env.example 里那句 "在这里填"）同样视为没配置，避免发一次必失败的请求。
  // available 只看 key：不再有 mock / 强制离线之类的旁路。
  const available = Boolean(apiKey) && !apiKey.includes('在这里填');

  async function* stream(messages, options = {}) {
    if (!available) {
      throw llmError(
        '未配置可用的 LLM API Key：请把 apps/rag-lab/.env.example 复制为 .env 并填写 DEEPSEEK_API_KEY，或复用 apps/agent-lab/.env',
      );
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort(llmError(`LLM 请求超时（${timeoutMs}ms）`));
    }, timeoutMs);

    const externalSignal = options.signal;
    const onExternalAbort = () => {
      controller.abort(externalSignal?.reason ?? llmError('生成已被用户取消'));
    };
    if (externalSignal) {
      if (externalSignal.aborted) onExternalAbort();
      else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const response = await requestChat(messages, options, controller.signal);
      const contentType = (response.headers.get('content-type') || '').toLowerCase();

      // 少数兼容服务会忽略 stream:true 直接回一个完整 JSON，这里也兼容掉
      if (!contentType.includes('text/event-stream')) {
        const payload = await response.json().catch(() => null);
        const content = payload?.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content) yield { type: 'delta', text: content };
        const usage = normalizeUsage(payload?.usage);
        if (usage) yield { type: 'usage', usage };
        return;
      }
      if (!response.body) throw llmError(`LLM 响应没有可读取的流（HTTP ${response.status}）`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline;
          while ((newline = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newline).replace(/\r$/, '');
            buffer = buffer.slice(newline + 1);
            const parsed = parseDataLine(line);
            if (!parsed) continue;
            if (parsed.done) return;
            for (const event of parsed.events) yield event;
          }
        }
        buffer += decoder.decode();
        const trailing = parseDataLine(buffer);
        if (trailing && !trailing.done) {
          for (const event of trailing.events) yield event;
        }
      } finally {
        try {
          await reader.cancel();
        } catch {
          // 流已结束，cancel 报错可以忽略
        }
      }
    } catch (error) {
      if (error?.code === 'llm_error') throw error;
      if (externalSignal?.aborted) throw llmError('生成已被用户取消', { cause: error });
      if (timedOut) throw llmError(`LLM 请求超时（${timeoutMs}ms）`, { cause: error });
      throw llmError(`LLM 请求失败：${error?.message || error}`, { cause: error });
    } finally {
      clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }

  async function requestChat(messages, options, signal) {
    const payload = {
      model,
      messages: sanitizeMessages(messages),
      stream: true,
      // 让上游在流末尾返回真实 token 用量（OpenAI 兼容字段，DeepSeek 等网关均支持）
      stream_options: { include_usage: true },
      temperature: toNumber(options.temperature, DEFAULT_TEMPERATURE),
      max_tokens: toNumber(options.maxTokens, DEFAULT_MAX_TOKENS),
    };
    if (reasoningEffort) payload.reasoning_effort = reasoningEffort;

    let response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (error) {
      throw error; // 交给外层统一包装/分类
    }

    if (!response.ok) {
      // 把服务端真实原因透出去，前端和日志才能看懂（JSON 里常带 error.message）
      let detail = '';
      try {
        const text = await response.text();
        if (text) {
          try {
            const json = JSON.parse(text);
            detail = json?.error?.message || json?.message || text;
          } catch {
            detail = text;
          }
        }
      } catch {
        // 读错误体失败就只留状态码
      }
      throw llmError(
        `LLM 接口返回 HTTP ${response.status}${detail ? `：${String(detail).slice(0, 300)}` : ''}`,
        { status: response.status },
      );
    }
    return response;
  }

  return {
    available,
    mode: available ? 'llm' : 'disconnected',
    model,
    baseUrl,
    stream,
  };
}

/** 解析一行 SSE：返回 {done} / {events} / null；data 里的 error 会直接抛错 */
function parseDataLine(line) {
  if (!line.startsWith('data:')) return null; // 空行、注释行（: keep-alive）直接跳过
  const data = line.slice(5).trim();
  if (!data) return null;
  if (data === '[DONE]') return { done: true };

  let payload;
  try {
    payload = JSON.parse(data);
  } catch {
    return null; // 半截 JSON/服务端心跳，忽略即可
  }
  if (payload?.error) {
    throw llmError(`LLM 返回错误：${payload.error.message || JSON.stringify(payload.error)}`);
  }

  const events = [];
  const delta = payload?.choices?.[0]?.delta ?? payload?.choices?.[0]?.message;
  if (delta) {
    // DeepSeek reasoner 先输出思考内容，再输出正文；不同厂商字段名略有差异，两个都兼容
    const reasoning = delta.reasoning_content ?? delta.reasoning;
    if (typeof reasoning === 'string' && reasoning) {
      events.push({ type: 'reasoning', text: reasoning });
    }
    if (typeof delta.content === 'string' && delta.content) {
      events.push({ type: 'delta', text: delta.content });
    }
  }

  // 带 include_usage 时，最后一条 chunk 的 choices 为空、只带 usage：如实透传给调用方
  const usage = normalizeUsage(payload?.usage);
  if (usage) events.push({ type: 'usage', usage });

  return { done: false, events };
}

/** 上游 usage 归一化：只保留标准字段（数字缺失按 0 处理），拿不到就返回 null */
function normalizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const promptTokens = Number(usage.prompt_tokens);
  const completionTokens = Number(usage.completion_tokens);
  const totalTokens = Number(usage.total_tokens);
  if (![promptTokens, completionTokens, totalTokens].every(Number.isFinite)) return null;
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
  };
}

function sanitizeMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message && typeof message.content === 'string')
    .map((message) => ({ role: message.role || 'user', content: message.content }));
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function llmError(message, extra = {}) {
  const error = new Error(message);
  error.code = 'llm_error';
  Object.assign(error, extra);
  return error;
}
