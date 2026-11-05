/**
 * ============================================================================
 * 这个文件是整个项目的“宪法”：Agent 和模型之间到底在传什么数据结构。
 * ============================================================================
 *
 * 如果你只记住一句话：
 *   大模型 API 本质上就是一个函数 —— 你传给它一串消息，它还给你一条消息。
 *   所谓 Agent，就是围着这个函数加了一圈“工具 + 循环 + 权限 + 上下文管理”。
 *
 * 这里定义的所有结构都对齐 OpenAI 的 /chat/completions 协议
 * （DeepSeek、Moonshot、硅基流动、Ollama 等都兼容这套协议）。
 * 真实 opencode 内部也是把各家协议统一成类似的一套 message 结构。
 */

/** 消息角色。四种角色各有分工，下面注释是重点。 */
export type Role =
  /** 系统提示词：模型的“人设 + 行为准则”，一般只在最前面一条。 */
  | "system"
  /** 用户输入。 */
  | "user"
  /** 模型的回复（可能带工具调用请求）。 */
  | "assistant"
  /** 工具执行结果。注意：这不是用户说的话，是程序喂回去的观察结果。 */
  | "tool";

/**
 * 模型请求调用一个工具。
 *
 * 一个非常关键的设计：模型**不会真的执行任何东西**，
 * 它只是在回复里生成一段“我想调用 xxx 工具，参数是 {...}”的 JSON。
 * 真正执行的是你的程序（见 agent/loop.ts）。
 *
 * 所以所谓“AI 操作电脑”，本质是：
 *   模型生成 JSON  →  你的程序解析并执行  →  把结果作为 tool 消息喂回模型
 */
export interface ToolCall {
  /** 调用 id。工具结果必须带着同一个 id 回去，模型才知道这是哪次调用的结果。 */
  id: string;
  /** 目前只有 "function" 一种。 */
  type: "function";
  function: {
    /** 工具名，必须和 tools 定义里的一致。 */
    name: string;
    /**
     * 参数是“JSON 字符串”，不是对象！
     * 因为模型是流式吐字符的，它只能吐文本。
     * 所以你的代码里需要 JSON.parse，而且必须处理解析失败（模型经常写坏 JSON）。
     */
    arguments: string;
  };
}

/**
 * 多模态消息里的“内容片段”。
 *
 * 纯文本消息可以直接写 content: "你好"；
 * 一旦要带图片，OpenAI 兼容协议要求把 content 从字符串改成数组：
 *   [
 *     { "type": "text", "text": "这张图里是什么？" },
 *     { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
 *   ]
 *
 * 为什么图片用 data URL 而不是本地路径？
 * 因为模型 API 在云端，它读不到你电脑上的 /Users/xxx/a.png。
 * 把图片编码成 base64 字符串放进请求体，是“上传图片”最直接的做法。
 */
export interface TextContentPart {
  type: "text";
  text: string;
}

export interface ImageContentPart {
  type: "image_url";
  image_url: {
    /** 可以是 https URL，也可以是 data:image/...;base64,... */
    url: string;
    /** 清晰度偏好：auto 让服务端自己决定。 */
    detail?: "auto" | "low" | "high";
  };
}

export type ContentPart = TextContentPart | ImageContentPart;

/** 消息内容：要么是一段纯文本，要么是文本/图片片段数组。 */
export type MessageContent = string | ContentPart[];

/**
 * 对话历史里的一条消息。
 *
 * 注意每种角色能带哪些字段：
 *  - system / user：只有 content
 *  - assistant：content 可以为 null（当它只想调用工具、不想说话时），
 *               可以带 tool_calls
 *  - tool：必须有 tool_call_id（对应哪次调用）和 content（执行结果）
 */
export interface ChatMessage {
  role: Role;
  content: MessageContent | null;
  /** 仅 assistant 使用：这一轮请求调用的工具列表（可能并行多个）。 */
  tool_calls?: ToolCall[];
  /** 仅 tool 使用：对应哪个 ToolCall.id。 */
  tool_call_id?: string;
  /** 仅 tool 使用：工具名（OpenAI 协议里可选，但带上便于调试）。 */
  name?: string;
}

/**
 * JSON Schema 的一个子集。我们只实现 Agent 工具用得到的部分。
 *
 * 为什么工具参数要用 JSON Schema 描述？
 * 因为模型需要知道“这个工具要什么参数、什么类型、哪些必填”。
 * tools 定义会被序列化后一起发给模型，模型据此生成合法的 arguments。
 *
 * 生产里一般用 zod / TypeBox 生成 JSON Schema，教学项目手写结构更直观。
 */
export interface JSONSchema {
  type?: "object" | "string" | "number" | "integer" | "boolean" | "array" | "null";
  description?: string;
  /** type=object 时：各个属性的 schema。 */
  properties?: Record<string, JSONSchema>;
  /** type=object 时：必填字段名列表。 */
  required?: string[];
  /** 枚举约束，例如 status 只能是 pending/in_progress/completed。 */
  enum?: Array<string | number>;
  /** type=array 时：数组元素的 schema。 */
  items?: JSONSchema;
  /** 是否允许额外字段。工具参数建议 false，避免模型乱塞字段。 */
  additionalProperties?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

/** 发给模型的“工具说明书”。注意这层包装是 OpenAI 协议要求的固定形状。 */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}

/** 用量统计。模型接口会返回，用来算钱和观察上下文膨胀。 */
export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  /** DeepSeek 等 provider 会返回：命中缓存的 prompt token 数。 */
  prompt_cache_hit_tokens?: number;
  /** 未命中缓存的 prompt token 数。 */
  prompt_cache_miss_tokens?: number;
}

/**
 * 流式事件。
 *
 * 为什么不用“一次性返回完整回复”？
 *  - 体验：字一个个蹦出来，人才不会觉得卡死
 *  - 延迟：首 token 时间（TTFT）远小于完整响应时间
 *  - 工具调用：模型可能在生成一部分文本后就开始请求工具
 *
 * 我们的 provider 接口统一吐这几种事件，上层（agent loop / UI）只认事件，
 * 不关心底层是 OpenAI、DeepSeek 还是 mock。这就是“适配器模式”。
 */
export type StreamEvent =
  /** 推理模型的思考过程（DeepSeek 的 reasoning_content）。不放进正式回答。 */
  | { type: "thinking"; text: string }
  /** 正文增量。 */
  | { type: "text"; text: string }
  /** 本轮累积完成的工具调用（流结束时一次性给出，方便上层处理）。 */
  | { type: "tool_calls"; toolCalls: ToolCall[] }
  /** 用量。 */
  | { type: "usage"; usage: Usage }
  /** 结束。finishReason 可能是 stop / length / tool_calls。 */
  | { type: "done"; finishReason?: string };

/** 调用模型时的可选参数。 */
export interface StreamOptions {
  /** 用于取消请求（Ctrl+C）。fetch 原生支持。 */
  signal?: AbortSignal;
  /** 本轮允许使用的工具。没有工具时模型只能聊天。 */
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  /** 推理强度（OpenAI 兼容的 reasoning_effort）：default/low/medium/high/max，取决于 provider。 */
  reasoningEffort?: string;
}

/**
 * 模型提供方接口。
 *
 * 整个项目只依赖这个接口，不依赖任何具体厂商。
 * 想接新模型？实现一个 stream() 就行。
 * 这也是为什么我们能在“真实模型”和“mock 假模型”之间无缝切换。
 */
export interface LLMProvider {
  /** 用于日志展示，例如 "openai-compatible" / "mock"。 */
  id: string;
  model: string;
  stream(
    messages: ChatMessage[],
    options?: StreamOptions,
  ): AsyncGenerator<StreamEvent, void, void>;
}
