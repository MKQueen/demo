/**
 * 通用小工具。这个文件没有任何依赖，全部手写。
 *
 * 为什么单独一个文件？
 * 因为下面这些东西会被 LLM 层、工具层、UI 层同时用到：
 *  - `.env` 解析（不想为了读个环境变量引入 dotenv）
 *  - token 估算（Agent 的生死线，见 agent/context.ts）
 *  - 文本截断（工具输出可能几十万字符，必须截断后再喂给模型）
 */
import fs from "node:fs";

/**
 * 读取 .env 文件并写进 process.env。
 *
 * 规则很简单：每行 KEY=VALUE，`#` 开头是注释，值两边的引号会被去掉。
 * 如果系统环境变量里已经有同名变量，不覆盖（命令行 > 系统环境 > .env）。
 *
 * 真实项目里通常用 dotenv 这个库，但它也就 100 行，手写一遍你就明白
 * “环境变量”其实没有任何魔法，就是进程内存里的一个字符串字典。
 */
export function loadDotEnv(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  const text = fs.readFileSync(filePath, "utf8");
  let loaded = 0;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
      loaded++;
    }
  }
  return loaded;
}

/**
 * 估算一段文本大概占多少 token。
 *
 * ⚠️ 这只是“估算”，不是精确值：
 *  - 英文大约 4 个字符 = 1 token
 *  - 中文大约 1 个汉字 ≈ 1~1.5 token
 * 这里用 cjk * 1.1 + 其它字符 / 3.5 做一个便宜的近似。
 *
 * 为什么 Agent 需要它？
 * 因为模型有“上下文窗口”上限（比如 64K token），你必须在发请求**之前**
 * 就知道自己会不会超。生产级实现会用模型对应的 BPE 分词器（如 tiktoken）
 * 精确计数，但那个要几 MB 的词表数据；教学项目用估算足够了。
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    const isCjk =
      (code >= 0x2e80 && code <= 0x9fff) || // 中日韩统一表意文字 + 部首
      (code >= 0x3040 && code <= 0x30ff) || // 日文假名
      (code >= 0xac00 && code <= 0xd7af) || // 韩文
      (code >= 0xf900 && code <= 0xfaff) || // 兼容汉字
      (code >= 0xff00 && code <= 0xffef); // 全角符号
    if (isCjk) cjk++;
    else other++;
  }
  return Math.ceil(cjk * 1.1 + other / 3.5);
}

/**
 * 从中间截断文本：保留开头和结尾，中间用省略标记代替。
 *
 * 为什么不直接 slice(0, max)？
 * 因为 Agent 读文件/跑命令时，**结尾往往比开头重要**：
 * 报错信息一般在最后，命令输出结果一般在最后。
 * 只保留开头会丢关键信息，所以两边都留。
 */
export function truncateMiddle(text: string, maxChars: number, headRatio = 0.6): string {
  if (text.length <= maxChars) return text;
  if (maxChars <= 40) return text.slice(0, maxChars) + "…";
  const headLen = Math.floor(maxChars * headRatio);
  const tailLen = maxChars - headLen;
  const omitted = text.length - headLen - tailLen;
  return (
    text.slice(0, headLen) +
    `\n…[中间省略 ${omitted} 个字符]…\n` +
    text.slice(text.length - tailLen)
  );
}

/** 简单的睡眠，用于重试退避和 mock 模型模拟打字效果。 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 生成一个短小的会话 id，例如 20261102-103501-a1b2。 */
export function shortId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${rand}`;
}

/** 当前时间的 ISO 字符串。 */
export function nowIso(): string {
  return new Date().toISOString();
}

/** 把毫秒数格式化成人话：123ms / 1.5s / 2m3s。 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m${s}s`;
}

/** 把多行文本压成一行并截断，用来在 UI 上显示工具参数预览。 */
export function oneLine(text: string, maxChars = 120): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > maxChars ? flat.slice(0, maxChars) + "…" : flat;
}

/** 安全 JSON.parse：返回结果对象而不是抛异常。 */
export function safeParseJson<T = unknown>(
  text: string,
): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** 数字格式化：1234567 -> 1,234,567，用于展示 token 数。 */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}
