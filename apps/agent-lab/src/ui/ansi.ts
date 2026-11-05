/**
 * 终端 ANSI 转义码小工具。
 *
 * 终端里“上色”就是往输出里塞特殊字符序列，例如 \x1b[36m 表示青色。
 * 没有魔法，也不需要 chalk 这种库。
 *
 * 注意：如果不是 TTY（比如输出被管道重定向），就不要加颜色，
 * 否则日志里会全是乱码转义字符。
 */
const enabled = process.stdout.isTTY === true && !process.env.NO_COLOR;

export const codes = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
} as const;

function paint(text: string, code: string): string {
  return enabled ? `${code}${text}${codes.reset}` : text;
}

export const red = (text: string) => paint(text, codes.red);
export const green = (text: string) => paint(text, codes.green);
export const yellow = (text: string) => paint(text, codes.yellow);
export const cyan = (text: string) => paint(text, codes.cyan);
export const magenta = (text: string) => paint(text, codes.magenta);
export const bold = (text: string) => paint(text, codes.bold);
export const dim = (text: string) => paint(text, codes.dim);
export const gray = (text: string) => paint(text, codes.gray);

/** 清除当前行（用于“思考中…”变成正式输出）。非 TTY 时退化为换行。 */
export function clearLine(): string {
  return enabled ? "\r\x1b[2K" : "\n";
}

export const symbols = {
  user: "❯",
  assistant: "●",
  tool: "→",
  ok: "✓",
  fail: "✗",
  notice: "!",
  info: "·",
} as const;
