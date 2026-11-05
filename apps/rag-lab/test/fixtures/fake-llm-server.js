/**
 * fake-llm-server.js —— 测试专用的本地假 OpenAI 兼容服务（零依赖，不联网）
 *
 * 只被 test/*.test.js 引用，server.js / rag/ 不会加载它。
 * 行为刻意贴近真实网关：
 *   1) 校验收到的是 POST /v1/chat/completions，并把请求头 / JSON body 存在内存里供断言；
 *   2) 以 `text/event-stream` 逐段吐 reasoning_content 与 content；
 *   3) 最后发一条 OpenAI 兼容的 usage chunk（choices: [] + usage）；
 *   4) 以 `data: [DONE]` 结束。
 *
 * 这样测试就能验证「服务端真的调用了模型、答案来自模型流、usage 来自上游」，
 * 而不是离线伪造出来的。
 */
import http from 'node:http';

export const FAKE_MODEL = 'fake-model';
export const FAKE_REASONING_PARTS = ['先判断问题类型：', '质量问题退货。'];
export const FAKE_ANSWER_PARTS = ['您好，耳机有杂音', '属于质量问题，', '签收次日起 15 天内可以退', ' [1]。'];
export const FAKE_USAGE = { prompt_tokens: 1234, completion_tokens: 56, total_tokens: 1290 };
export const FAKE_ANSWER = FAKE_ANSWER_PARTS.join('');
export const FAKE_REASONING = FAKE_REASONING_PARTS.join('');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 启动一个监听 127.0.0.1 随机端口的假模型服务。
 *
 * @param {{status?: number, errorMessage?: string, chunkDelayMs?: number}} [options]
 *   - status：非 200 时模拟网关报错（用于验证「失败只报错、不伪造答案」）
 *   - chunkDelayMs：每段 SSE 之间的间隔，验证服务端是真流式转发而不是攒一发
 * @returns {Promise<{port:number, baseUrl:string, requests:Array, lastRequest:object|null, close:()=>Promise<void>}>}
 */
export async function startFakeLlmServer(options = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: { message: `not found: ${req.url}` } }));
      return;
    }

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      let body = null;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        body = null;
      }
      requests.push({ headers: req.headers, body });

      if (options.status && options.status !== 200) {
        res.writeHead(options.status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({ error: { message: options.errorMessage || 'fake llm error' } }),
        );
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      let closed = false;
      res.on('close', () => {
        closed = true;
      });
      const write = (payload) => {
        if (closed) return false;
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        return true;
      };

      const delay = Number(options.chunkDelayMs) > 0 ? Number(options.chunkDelayMs) : 1;
      for (const part of FAKE_REASONING_PARTS) {
        if (!write({ choices: [{ index: 0, delta: { reasoning_content: part } }] })) return;
        await sleep(delay);
      }
      for (const part of FAKE_ANSWER_PARTS) {
        if (!write({ choices: [{ index: 0, delta: { content: part } }] })) return;
        await sleep(delay);
      }
      if (!write({ choices: [], usage: FAKE_USAGE })) return;
      if (!closed) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();

  return {
    port,
    baseUrl: `http://127.0.0.1:${port}/v1`,
    requests,
    get lastRequest() {
      return requests.at(-1) || null;
    },
    close() {
      return new Promise((resolve) => {
        server.close(() => resolve());
        // 测试进程里 fetch 会保持 keep-alive 连接，先强制断开，避免 close() 一直挂着
        server.closeAllConnections?.();
      });
    },
  };
}
