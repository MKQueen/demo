/**
 * 配置解析。
 *
 * Agent 程序启动时要回答几个问题：
 *  1. 调哪个模型？走哪个接口？key 从哪来？
 *  2. 一次任务最多循环多少轮？（防止失控烧钱）
 *  3. 上下文预算多少？（超过就开始裁剪历史）
 *
 * 优先级：命令行参数 > 环境变量 > .env 文件 > 内置默认值。
 * 这是所有 CLI 工具的通用约定，记住这个“从具体到通用”的顺序。
 */
import path from "node:path";
import { loadDotEnv } from "./util.ts";

export interface AppConfig {
  /** OpenAI 风格接口的根地址，例如 https://api.deepseek.com */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 单次任务里“模型→工具→模型”最多循环几轮 */
  maxSteps: number;
  /** 单回合最大工具调用次数；0 = 不限。 */
  maxToolCalls: number;
  /** 重复调用熔断（连续 3 次相同工具+参数就暂停）；是“卡死检测”，不是步数上限。 */
  repeatGuard: boolean;
  /** 上下文 token 预算，超过就开始裁剪 */
  contextBudget: number;
  temperature: number;
  /** 推理强度（provider 支持时生效）：default / low / medium / high / max */
  reasoningEffort: ReasoningEffort;
  /**
   * 模型流式响应的「空闲超时」（毫秒）：多久没收到新数据就中断。
   *
   * 为什么是配置项而不是写死？
   * 不同网关/模型的吐字节奏差很多（推理模型可能先憋一会儿思考），
   * 太短会误杀正常请求，太长会让“卡死”看起来像死机。0 表示关闭。
   */
  llmIdleTimeoutMs: number;
  /** 是否使用假模型（无需联网、无需 key） */
  mock: boolean;
}

export type ReasoningEffort = "default" | "low" | "medium" | "high" | "max";
export const REASONING_EFFORTS: ReasoningEffort[] = ["default", "low", "medium", "high", "max"];

/** 命令行允许覆盖的字段。 */
export interface ConfigOverrides {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  maxSteps?: number;
  maxToolCalls?: number;
  repeatGuard?: boolean;
  contextBudget?: number;
  temperature?: number;
  reasoningEffort?: ReasoningEffort;
  mock?: boolean;
}

const DEFAULTS = {
  baseUrl: "https://api.deepseek.com",
  // 不同入口的模型名不一样：
  //  - 官方 DeepSeek API（api.deepseek.com）：deepseek-v4-flash / deepseek-v4-pro
  //    （旧的 deepseek-chat / deepseek-reasoner 已停止使用）
  //  - 某些网关 / 中转：deepseek-flash / deepseek-v4-pro
  // 这里默认用网关名（当前演示环境）；连官方 API 时用 --model 或 .env 的 MINI_MODEL 覆盖。
  model: "deepseek-flash",
  // 默认不限步数：参考 Claude Code 交互模式（无硬上限）与 Codex（无 max-turns）。
  // 0 = 不限；需要给 CI/无人值守场景设上限时用 --max-steps 或 MINI_MAX_STEPS。
  maxSteps: 0,
  // 默认不限工具调用次数；0 = 不限。需要时用 --max-tool-calls / MINI_MAX_TOOL_CALLS。
  maxToolCalls: 0,
  temperature: 0.2,
  reasoningEffort: "default" as ReasoningEffort,
  // 默认 120s 没有新数据就判定卡住；0 = 关闭（不推荐，网关挂起时会一直等）
  llmIdleTimeoutMs: 120_000,
};

/**
 * 各模型系列的上下文窗口（token）。
 *
 * 为什么要维护这张表？
 *  - 窗口大小是“模型属性”，不是“用户该背的参数”。用户换了模型，预算应该自动跟着变；
 *  - 写死一个小默认值（比如 24K）会让 256K 的 DeepSeek 只用了不到十分之一，
 *    历史被无谓地裁掉，Agent 就表现得“没有记忆”。
 *
 * 正则匹配模型名，允许带日期/版本后缀（如 deepseek-flash、gpt-4o-2024-08-06）。
 *
 * ⚠️ 注意：这里的 DeepSeek 按 256K 是**刻意保守**的。
 * 官方 DeepSeek V4（deepseek-v4-pro / deepseek-v4-flash）标称 1M 上下文，
 * 但默认预算若按 1M 算会得到 ~875K——一次塞太满既慢又贵，也容易“中间失忆”。
 * 所以默认只给 224K；需要时用 --budget / MINI_CONTEXT_BUDGET 手动放大。
 */
const MODEL_CONTEXT_WINDOWS: Array<[RegExp, number]> = [
  [/deepseek/i, 256_000],
  [/claude/i, 200_000],
  [/gemini/i, 1_000_000],
  [/gpt-4\.1|gpt-4o|o[134]/i, 128_000],
];

/** 认不出的模型按 128K 保守估计，宁可少记一点也不要把请求撑爆。 */
const FALLBACK_CONTEXT_WINDOW = 128_000;

/**
 * 按模型窗口算出“安全预算”。
 *
 * 为什么不直接把预算设成窗口大小？
 *  - 系统提示词、工具定义、模型回复都要占地方；
 *  - 贴着窗口上限发请求，很容易被服务商 400（超过最大上下文）。
 * 所以留 1/8 余量：DeepSeek 256K → 224K，GPT-4o 128K → 112K。
 *
 * 到线才触发裁剪/压缩，所以“预算大”不等于“每次请求都大”，只是历史能留得更久。
 */
export function contextBudgetForModel(model: string): number {
  const window =
    MODEL_CONTEXT_WINDOWS.find(([pattern]) => pattern.test(model))?.[1] ?? FALLBACK_CONTEXT_WINDOW;
  return Math.max(16_000, Math.floor(window / 8) * 7);
}

/** 采样温度的合法区间（OpenAI / DeepSeek 都是 0~2）。 */
export const TEMPERATURE_MIN = 0;
export const TEMPERATURE_MAX = 2;

/**
 * 把温度收进合法区间。
 *
 * 为什么单独一个函数？
 * 1) 0 是合法值（最确定），不能像 maxSteps 那样要求“正整数”；
 * 2) 命令行、环境变量、网页配置三个入口都要做同样的校验；
 * 3) 越界不要静默接受（有些服务商会 400），直接夹到边界并保留可解释性。
 */
export function clampTemperature(value: number, fallback = DEFAULTS.temperature): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(TEMPERATURE_MAX, Math.max(TEMPERATURE_MIN, value));
}

/**
 * 从当前工作目录加载 .env。只认当前目录，不向上找——
 * 向上找容易出现“我在 A 目录却读到了 B 目录的 key”的惊喜。
 */
export function loadEnv(cwd: string): number {
  return loadDotEnv(path.join(cwd, ".env"));
}

/**
 * 把用户填的 baseUrl 归一化：
 *  - 去掉结尾的 /
 *  - 如果用户不小心把完整 endpoint 填进来（.../chat/completions），也帮他切回去
 * 这样后面拼 `${baseUrl}/chat/completions` 永远是对的。
 */
export function normalizeBaseUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, "");
  url = url.replace(/\/chat\/completions$/, "");
  return url;
}

export function resolveConfig(cwd: string, overrides: ConfigOverrides = {}): AppConfig {
  loadEnv(cwd);

  const baseUrl = normalizeBaseUrl(
    overrides.baseUrl ??
      process.env.OPENAI_BASE_URL ??
      process.env.DEEPSEEK_BASE_URL ??
      DEFAULTS.baseUrl,
  );

  // key 的查找顺序：命令行 > 本项目的 MINI_API_KEY > DeepSeek 官方变量 > OpenAI 变量
  const apiKey =
    overrides.apiKey ??
    process.env.MINI_API_KEY ??
    process.env.DEEPSEEK_API_KEY ??
    process.env.OPENAI_API_KEY ??
    "";

  const model = overrides.model ?? process.env.MINI_MODEL ?? DEFAULTS.model;

  // maxSteps = 0 表示不限步数（交互模式参考 Claude Code），靠工具调用上限/重复熔断/用户 Stop 兜底
  const maxSteps = overrides.maxSteps ?? readNonNegativeEnv("MINI_MAX_STEPS", DEFAULTS.maxSteps);
  const maxToolCalls =
    overrides.maxToolCalls ?? readNonNegativeEnv("MINI_MAX_TOOL_CALLS", DEFAULTS.maxToolCalls);
  // 默认开启；只有显式 --no-repeat-guard 或 MINI_REPEAT_GUARD=0 才关
  const repeatGuard =
    overrides.repeatGuard ?? process.env.MINI_REPEAT_GUARD !== "0";
  const contextBudget =
    overrides.contextBudget ??
    readNumberEnv("MINI_CONTEXT_BUDGET", contextBudgetForModel(model));

  // 注意：0 是合法温度，不能用 readNumberEnv（它要求 >0）。
  const envTemperature = process.env.MINI_TEMPERATURE
    ? Number(process.env.MINI_TEMPERATURE)
    : DEFAULTS.temperature;

  const reasoningRaw = overrides.reasoningEffort ?? process.env.MINI_REASONING_EFFORT ?? "default";
  const reasoningEffort: ReasoningEffort = REASONING_EFFORTS.includes(reasoningRaw as ReasoningEffort)
    ? (reasoningRaw as ReasoningEffort)
    : "default";

  // 0 合法 = 关闭空闲超时；其余非负数都按毫秒处理
  const llmIdleTimeoutMs = readNonNegativeEnv(
    "MINI_LLM_IDLE_TIMEOUT",
    DEFAULTS.llmIdleTimeoutMs,
  );

  return {
    baseUrl,
    apiKey,
    model,
    maxSteps,
    maxToolCalls,
    repeatGuard,
    contextBudget,
    temperature: clampTemperature(overrides.temperature ?? envTemperature),
    reasoningEffort,
    llmIdleTimeoutMs,
    mock: overrides.mock ?? process.env.MINI_MOCK === "1",
  };
}

/** 和 readNumberEnv 一样，但允许 0（maxSteps=0 表示不限步数）。 */
function readNonNegativeEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function readNumberEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 给用户看的配置摘要（注意：绝不能打印 apiKey）。 */
export function describeConfig(config: AppConfig): string {
  const keyHint = config.mock
    ? "mock 模式（不联网）"
    : config.apiKey
      ? `已配置（${config.apiKey.slice(0, 3)}***${config.apiKey.slice(-4)}）`
      : "未配置";
  return [
    `model      ${config.model}`,
    `baseUrl    ${config.baseUrl}`,
    `apiKey     ${keyHint}`,
    `maxSteps   ${config.maxSteps === 0 ? "不限" : config.maxSteps}`,
    `maxTools   ${config.maxToolCalls === 0 ? "不限" : config.maxToolCalls}`,
    `卡死熔断   ${config.repeatGuard ? "开" : "关"}`,
    `空闲超时   ${config.llmIdleTimeoutMs > 0 ? `${Math.round(config.llmIdleTimeoutMs / 1000)}s 无新数据则中断` : "关"}`,
    `budget     ${config.contextBudget.toLocaleString("en-US")} tokens`,
  ].join("\n");
}
