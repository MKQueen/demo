/**
 * ============================================================================
 * LLM 客户端：手写一个 OpenAI 兼容的流式请求。
 * ============================================================================
 *
 * 这个文件回答了“Agent 怎么和模型说话”：
 *
 *   1. 用 fetch POST 一个 /chat/completions 请求
 *   2. 响应是 SSE（Server-Sent Events）流，一行一行地来
 *   3. 我们把 "data: {...}" 一行行解析成 delta，拼成正文
 *   4. 工具调用的 JSON 参数是**分片**到达的，必须按 index 拼接
 *
 * 为什么不直接用 openai npm 包？
 * 因为那个包会把这一切藏起来。手写一遍你才知道：
 *  - 所谓“流式”就是 HTTP chunked 编码 + 每行一个 JSON
 *  - 所谓“工具调用”就是模型在 delta 里吐了一段 JSON 字符串
 *  - 重试、超时、取消，全都要你自己管
 *
 * 生产环境直接用 SDK 没问题，但要先知道 SDK 底下发生了什么。
 */
import type {
  ChatMessage,
  LLMProvider,
  StreamEvent,
  StreamOptions,
  ToolCall,
  Usage,
} from "./types.ts";
import { sleep, truncateMiddle } from "../util.ts";

export interface LLMClientConfig {
  /** 接口根地址，例如 https://api.deepseek.com */
  baseUrl: string;
  /** 密钥。会在请求头里变成 Authorization: Bearer xxx */
  apiKey: string;
  model: string;
  /** 额外请求头（有些网关需要自定义 header）。 */
  headers?: Record<string, string>;
  /** 重试次数：只对“一个事件都还没吐出来”的失败重试。 */
  retries?: number;
  /** 默认温度。Agent 场景建议低一点（0~0.3），要稳定不要发散。 */
  temperature?: number;
  /** 单次回复的最大 token。 */
  maxTokens?: number;
  /**
   * 流式响应「空闲超时」（毫秒）：多久没收到**任何新数据**就判定卡住并中断。
   *
   * 为什么需要它？
   *   网关偶尔会出现「连接建立了、SSE 头也回来了，然后就再也没有字节」的情况。
   *   没有超时的话 Agent 会永远卡在等待里（用户只看到转圈），比报错还糟。
   *   注意这跟「总耗时」无关：只要模型还在持续吐字，等多久都不会被中断。
   *   默认 120s；设 0 关闭。
   */
  idleTimeoutMs?: number;
}

/** 模型调用失败。把“能不能重试”编码进错误对象，上层好处理。 */
export class LLMError extends Error {
  readonly status: number | undefined;
  readonly retryable: boolean;

  constructor(message: string, options: { status?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = "LLMError";
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

/** 判断一个异常是不是“用户主动取消”。 */
export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof Error && err.name === "AbortError") ||
    (err instanceof DOMException && err.name === "AbortError")
  );
}

/**
 * ============================================================================
 * SSE 解析器
 * ============================================================================
 *
 * SSE 的规则比想象中简单：
 *   - 响应体是一段文本，事件之间用**空行**分隔
 *   - 每个事件里可能有若干 "data: xxx" 行
 *   - 我们的场景里每个事件只有一个 data 行，内容是 JSON
 *   - 最后一个事件是 "data: [DONE]"
 *
 * 难点在于：网络分片是“随便切”的，可能把一个 JSON 切成两半。
 * 所以必须自己维护 buffer，只处理完整的“空行分隔”块。
 *
 * 单独抽出来是为了可测试（test/unit.test.ts 会直接喂它人造数据）。
 */
export class SseParser {
  private buffer = "";

  /** 喂一块网络数据，返回其中已经完整的事件 data 列表。 */
  push(chunk: string): string[] {
    // 有些服务端用 \r\n，先归一化成 \n，后面判断空行就简单了
    this.buffer += chunk.replace(/\r\n/g, "\n");
    const events: string[] = [];

    let boundary = this.buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      for (const rawLine of block.split("\n")) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue; // 忽略 event: / id: / 注释行
        const data = line.slice("data:".length).trim();
        if (data) events.push(data);
      }
      boundary = this.buffer.indexOf("\n\n");
    }
    return events;
  }

  /** 流结束时，把缓冲区里最后一个没有空行结尾的事件也吐出来。 */
  flush(): string[] {
    if (!this.buffer.trim()) {
      this.buffer = "";
      return [];
    }
    const rest = this.buffer;
    this.buffer = "";
    return rest
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice("data:".length).trim())
      .filter(Boolean);
  }
}

/** 流式响应里工具调用的临时累加器（按 index 分组）。 */
interface ToolCallSlot {
  id: string;
  name: string;
  args: string;
}

/**
 * 发起一次真正的流式请求，把 SSE 翻译成 StreamEvent。
 *
 * 注意这个函数是 async generator：调用它不会立刻发请求，
 * 第一次 for await 迭代时才真正 fetch（惰性执行）。
 */
async function* streamOnce(
  config: LLMClientConfig,
  messages: ChatMessage[],
  options: StreamOptions | undefined,
): AsyncGenerator<StreamEvent, void, void> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    // 关键：stream=true 才会返回 SSE 流
    stream: true,
    // 请求在最后一个 chunk 里带上 token 用量（很多网关支持）
    stream_options: { include_usage: true },
    temperature: options?.temperature ?? config.temperature ?? 0.2,
  };
  if (config.maxTokens) body.max_tokens = config.maxTokens;
  // 推理强度：OpenAI 兼容字段叫 reasoning_effort，DeepSeek 的 reasoner 也认这个。
  // 为什么要判断 "default"？——不同的 provider 对“不发这个字段”的解释不一样：
  // 不传 = 各家自己的默认；传 "default" 有些网关会 400（它们只认 low/medium/high）。
  // 所以“default”必须是“不发”，而不是“发个 default 字符串”。
  if (options?.reasoningEffort && options.reasoningEffort !== "default") {
    body.reasoning_effort = options.reasoningEffort;
  }
  if (options?.tools?.length) {
    body.tools = options.tools;
    // tool_choice=auto：让模型自己决定要不要调工具
    body.tool_choice = "auto";
  }

  // -------------------------------------------------------------------------
  // 取消 / 空闲超时：外部点「停止」和内部「卡住检测」共用同一个 controller
  // -------------------------------------------------------------------------
  const idleTimeoutMs = config.idleTimeoutMs ?? 120_000;
  const controller = new AbortController();
  const externalSignal = options?.signal;
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let idleTimedOut = false;
  const clearIdleTimer = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };
  /** 每次准备读下一块数据前重新上表；收到数据就清掉。 */
  const armIdleTimer = () => {
    if (!(idleTimeoutMs > 0)) return;
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      idleTimedOut = true;
      // abort 之后正在 pending 的 fetch / reader.read() 会立刻以 AbortError 结束
      controller.abort();
    }, idleTimeoutMs);
  };
  const idleTimeoutError = () =>
    new LLMError(
      `模型接口 ${Math.round(idleTimeoutMs / 1000)} 秒没有返回任何新数据（网关或网络可能卡住了），已中断本次请求`,
      { retryable: true },
    );
  const releaseSignal = () => {
    clearIdleTimer();
    externalSignal?.removeEventListener("abort", onExternalAbort);
  };

  const url = `${config.baseUrl}/chat/completions`;
  let response: Response;
  try {
    armIdleTimer();
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
        ...config.headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearIdleTimer();
  } catch (err) {
    releaseSignal();
    if (idleTimedOut) throw idleTimeoutError();
    if (isAbortError(err)) throw err;
    // 网络层失败（DNS、断网、超时）通常是可重试的
    throw new LLMError(`请求模型失败：${err instanceof Error ? err.message : String(err)}`, {
      retryable: true,
    });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    releaseSignal();
    // 429=限流，5xx=服务端抖动：值得重试；401/400 重试也没用
    const retryable = response.status === 429 || response.status >= 500;
    throw new LLMError(
      `模型接口返回 ${response.status} ${response.statusText}：${truncateMiddle(detail, 400)}`,
      { status: response.status, retryable },
    );
  }
  if (!response.body) {
    releaseSignal();
    throw new LLMError("模型接口没有返回响应体（body 为空）", { retryable: true });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  const pending = new Map<number, ToolCallSlot>();
  let finishReason: string | undefined;
  let sawDone = false;

  /** 把拼好的工具调用一次性发给上层。 */
  const flushToolCalls = function* (): Generator<StreamEvent> {
    if (pending.size === 0) return;
    const toolCalls: ToolCall[] = [];
    for (const [index, slot] of [...pending.entries()].sort((a, b) => a[0] - b[0])) {
      toolCalls.push({
        // 有些兼容实现后面几个分片不带 id，这里兜底
        id: slot.id || `call_${index}`,
        type: "function",
        function: { name: slot.name, arguments: slot.args },
      });
    }
    pending.clear();
    yield { type: "tool_calls", toolCalls };
  };

  try {
    while (!sawDone) {
      // 读之前上表：如果上游超过 idleTimeoutMs 一个字节都不给，就判定卡住
      armIdleTimer();
      const { done, value } = await reader.read();
      clearIdleTimer();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      for (const data of parser.push(text)) {
        if (data === "[DONE]") {
          sawDone = true;
          break;
        }

        let json: {
          error?: { message?: string };
          usage?: Usage;
          choices?: Array<{
            delta?: {
              content?: string | null;
              reasoning_content?: string | null;
              tool_calls?: Array<{
                index: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
            finish_reason?: string | null;
          }>;
        };
        try {
          json = JSON.parse(data);
        } catch {
          // 极少数网关会发心跳/非 JSON 数据，跳过即可
          continue;
        }

        if (json.error) {
          throw new LLMError(`模型返回错误：${json.error.message ?? JSON.stringify(json.error)}`);
        }

        // usage 可能出现在最后一个 chunk（此时 choices 为空数组）
        if (json.usage) {
          yield {
            type: "usage",
            usage: {
              prompt_tokens: json.usage.prompt_tokens,
              completion_tokens: json.usage.completion_tokens,
              total_tokens: json.usage.total_tokens,
              prompt_cache_hit_tokens: json.usage.prompt_cache_hit_tokens,
              prompt_cache_miss_tokens: json.usage.prompt_cache_miss_tokens,
            },
          };
        }

        const choice = json.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta ?? {};

        // 推理模型（如 deepseek-reasoner）会先吐思考过程
        if (delta.reasoning_content) {
          yield { type: "thinking", text: delta.reasoning_content };
        }
        if (delta.content) {
          yield { type: "text", text: delta.content };
        }

        // ---- 工具调用分片拼接：这是整个文件最容易写错的地方 ----
        if (Array.isArray(delta.tool_calls)) {
          for (const part of delta.tool_calls) {
            const index = part.index ?? 0;
            const slot = pending.get(index) ?? { id: "", name: "", args: "" };
            if (part.id) slot.id = part.id;
            if (part.function?.name) slot.name = part.function.name;
            // arguments 是字符串分片，直接拼
            if (part.function?.arguments) slot.args += part.function.arguments;
            pending.set(index, slot);
          }
        }

        if (choice.finish_reason) finishReason = choice.finish_reason;
      }
    }

    // 处理流结束时残留在 parser 里的最后一段
    for (const data of parser.flush()) {
      if (data === "[DONE]") continue;
      // 这里通常不会有新内容，保守起见只解析 usage
      try {
        const json = JSON.parse(data) as { usage?: Usage };
        if (json.usage) {
          yield {
            type: "usage",
            usage: {
              prompt_tokens: json.usage.prompt_tokens,
              completion_tokens: json.usage.completion_tokens,
              total_tokens: json.usage.total_tokens,
              prompt_cache_hit_tokens: json.usage.prompt_cache_hit_tokens,
              prompt_cache_miss_tokens: json.usage.prompt_cache_miss_tokens,
            },
          };
        }
      } catch {
        /* 忽略 */
      }
    }
  } catch (err) {
    // 空闲超时：reader.read() 被 abort 后抛的是 AbortError，这里要先把"不是用户取消"认出来
    if (idleTimedOut) throw idleTimeoutError();
    // reader.read() 在连接中断时可能抛 TypeError（例如 "terminated"）。
    // 包装成 LLMError：用户能看懂，而且如果还没吐过任何事件，重试层会自动重试。
    if (isAbortError(err)) throw err;
    // 已经是业务错误（例如 SSE 里带了 data.error）就原样抛出，
    // 否则会被误包装成“连接中断”并被重试层重试（这是修复时引入过的回归）。
    if (err instanceof LLMError) throw err;
    throw new LLMError(
      `读取模型流式响应时连接中断：${err instanceof Error ? err.message : String(err)}`,
      { retryable: true },
    );
  } finally {
    // 无论正常结束还是异常/取消，都要释放 reader 和信号监听
    clearIdleTimer();
    releaseSignal();
    reader.releaseLock();
  }

  yield* flushToolCalls();
  yield { type: "done", finishReason };
}

/**
 * 创建 provider，并给流加上“自动重试”。
 *
 * 重试策略很重要：**只有在一个字都还没吐出来时才重试**。
 * 如果已经给用户输出了一半内容再重试，会出现重复文本，体验很糟。
 * 这是所有流式系统的通用坑，记住它。
 */
export function createProvider(config: LLMClientConfig): LLMProvider {
  const maxRetries = config.retries ?? 2;

  return {
    id: "openai-compatible",
    model: config.model,
    async *stream(messages, options) {
      let emittedAnything = false;
      let attempt = 0;

      for (;;) {
        try {
          for await (const event of streamOnce(config, messages, options)) {
            emittedAnything = true;
            yield event;
          }
          return; // 正常结束
        } catch (err) {
          // 用户取消：立刻退出，不重试
          if (options?.signal?.aborted || isAbortError(err)) throw err;

          const retryable = err instanceof LLMError && err.retryable;
          if (!retryable || emittedAnything || attempt >= maxRetries) throw err;

          attempt++;
          // 指数退避：0.6s → 1.2s
          await sleep(600 * 2 ** (attempt - 1));
        }
      }
    },
  };
}
