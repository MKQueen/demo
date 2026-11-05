/** webfetch：抓取网页并转成纯文本（CC / DSH 都有的基础联网工具）。 */
import type { Tool } from "./types.ts";
import { errorResult } from "./types.ts";

const PRIVATE_HOST_RE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|::1$|\[::1\])/i;

export function isPrivateHost(hostname: string): boolean {
  return PRIVATE_HOST_RE.test(hostname) || hostname.endsWith(".local");
}

/** 极简 HTML → 文本：去脚本/样式/标签，解常用实体；不追求完整 HTML 解析。 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const webfetchTool: Tool = {
  name: "webfetch",
  description: "抓取一个公开网页并返回纯文本（只读；用于查文档/资料，不支持内网地址）。",
  category: "read",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "http(s) URL" },
      max_chars: { type: "integer", description: "最多返回多少字符（1000~20000，默认 8000）" },
    },
    required: ["url"],
    additionalProperties: false,
  },
  async execute(args, ctx) {
    let url: URL;
    try {
      url = new URL(String(args.url ?? "").trim());
    } catch {
      return errorResult("webfetch", "url 不是合法 URL");
    }
    if (!/^https?:$/.test(url.protocol)) return errorResult("webfetch", "只支持 http/https");
    if (isPrivateHost(url.hostname)) return errorResult("webfetch", `拒绝访问内网地址：${url.hostname}`);
    const maxChars = Math.min(20000, Math.max(1000, Number(args.max_chars) || 8000));
    try {
      const signal = ctx.signal;
      const timeout = AbortSignal.timeout(15000);
      const response = await fetch(url, {
        signal: ctx.signal ? AbortSignal.any([signal, timeout]) : timeout,
        headers: { "user-agent": "mini-opencode-webfetch/0.2" },
        redirect: "follow",
      });
      if (!response.ok) return errorResult("webfetch", `HTTP ${response.status} ${response.statusText}`);
      const contentType = response.headers.get("content-type") || "";
      let text = await response.text();
      if (text.length > 2_000_000) text = text.slice(0, 2_000_000);
      if (contentType.includes("html")) text = htmlToText(text);
      text = text.replace(/[ \t]+/g, " ").trim().slice(0, maxChars);
      return { title: `webfetch ${url.hostname}`, output: text || "(空内容)" };
    } catch (err) {
      return errorResult("webfetch", `抓取失败：${err instanceof Error ? err.message : String(err)}`);
    }
  },
};
