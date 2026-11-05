/**
 * 模型/网络错误 → 人能照着做的提示。
 *
 * 为什么单独抽出来？
 * CLI（main.ts）和 Web（server.ts）要做同一件事，而且这段逻辑最容易写成
 * 一堆 `if (err.includes("401"))`。集中在一处，新增一种错误两边同时生效。
 *
 * 特别处理网关的“模型名不匹配”错误，例如：
 *   400 Bad Request：The supported API model names are deepseek-flash, deepseek-v4-pro,
 *   but you passed deepseek.
 * 这句话对新手非常迷惑（“我明明写了 deepseek 啊”）。我们直接把可用模型名抠出来，
 * 并告诉用户该改哪里。
 */
export function explainLLMError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  // 1) 模型名不被服务商支持：把可用列表抠出来，直接给可操作建议
  const supported = raw.match(/supported API model names are\s+([^.\n]+?)(?:,\s*but\b|\.)/i)?.[1]?.trim();
  if (supported) {
    return (
      `${raw}\n` +
      `提示：当前接口不支持这个模型名。可用模型：${supported}。\n` +
      "把模型改成其中之一：网页右上角「模型配置」/ --model / .env 里的 MINI_MODEL。"
    );
  }

  // 2) 其它 400：参数或模型名不被接受（最常见的仍是模型名写错/和 baseUrl 不是同一家）
  if (/invalid_request_error/i.test(raw) && /\bmodel\b/i.test(raw)) {
    return `${raw}\n提示：服务商拒绝了请求。确认 baseUrl 与 model 属于同一家服务商（模型名写错最常见）。`;
  }

  // 3) 鉴权与配额
  if (/\b401\b/.test(raw)) {
    return `${raw}\n提示：API key 无效或没填。检查 .env 的 DEEPSEEK_API_KEY，或在网页「模型配置」里重填。`;
  }
  if (/\b403\b/.test(raw)) {
    return `${raw}\n提示：这个 key 没有调用该模型的权限（或地区/额度受限）。`;
  }
  if (/\b402\b/.test(raw) || /insufficient balance/i.test(raw)) {
    return `${raw}\n提示：账户余额不足。`;
  }

  // 4) 地址/模型/限流/网络
  if (/\b404\b/.test(raw)) {
    return `${raw}\n提示：接口路径或模型名不对。检查 --base-url 和 --model；baseUrl 应是 OpenAI 兼容接口的根地址。`;
  }
  if (/\b429\b/.test(raw)) {
    return `${raw}\n提示：请求太频繁（限流），等几秒再试。`;
  }
  if (/ECONNREFUSED|fetch failed|ENOTFOUND/i.test(raw)) {
    return `${raw}\n提示：连不上模型接口。检查网络，或先用 --mock 离线体验。`;
  }
  if (/连接中断|terminated|socket hang up|ECONNRESET|premature close/i.test(raw)) {
    return `${raw}\n提示：和模型的长连接中断了（网络抖动/代理超时）。重试一次即可，已生成的内容会保留。`;
  }

  return raw;
}
