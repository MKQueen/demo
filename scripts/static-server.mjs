/**
 * static-server.mjs —— 零依赖静态文件服务，供本地预览 / 嵌套路径验证使用。
 *
 * 为什么需要它：
 *   1. 合集站点里每个 demo 都部署在 /demos/<id>/ 这种子路径下，
 *      直接用 vite preview 只能验证根路径，必须模拟「子目录静态托管」才能发现绝对路径问题。
 *   2. 打包前用与线上一致的静态托管方式跑一遍，避免上传后 404。
 *   3. mini-opencode 是「真 Agent」，需要在同源下访问本机后端：所以服务端支持
 *      把 /api/* 反向代理到本地 Agent 进程（SSE 也是流式透传，不缓冲）。
 *   4. RAG 观测台的构建版把知识库/检索放在浏览器，但生成要真实调用大模型。
 *      模型网关通常禁止浏览器跨域直连，且 key 不能进前端产物，所以这里再提供一个
 *      **极薄的模型转发**：/api/llm/health + /api/llm/chat/completions。
 *      它只注入 Authorization 并原样透传 SSE，不承载任何 RAG 逻辑。
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jsonl': 'application/x-ndjson; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.tflite': 'application/octet-stream',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.blend': 'application/octet-stream',
  '.py': 'text/plain; charset=utf-8',
  '.zip': 'application/zip',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(body);
}

/** 逐跳头（hop-by-hop header）不能透传，由每一跳自己决定连接行为。 */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/**
 * 找出请求命中的代理规则（最长前缀优先）。
 * 例如 proxies = [{ prefix: '/api', target: 'http://127.0.0.1:8787' }]
 */
function matchProxy(proxies, urlPath) {
  let best = null;
  for (const item of proxies || []) {
    if (!item || !item.prefix || !item.target) continue;
    const prefix = item.prefix.endsWith('/') ? item.prefix.slice(0, -1) : item.prefix;
    if (urlPath === prefix || urlPath.startsWith(prefix + '/')) {
      if (!best || prefix.length > best.prefix.length) best = { prefix, target: item.target };
    }
  }
  return best;
}

/**
 * 把请求原样转发给本地后端，并把响应原样流回来。
 *
 * 关键点：**不能缓冲响应**。
 * /api/events 是 SSE 长连接，Agent 每产生一个 token 就写一行；
 * 一旦在代理层做 await/聚合，浏览器就会卡到回合结束才看到内容。
 * 所以这里用 pipe 直接把上游字节流接到下游。
 */
function proxyRequest(req, res, urlPath, search, proxy) {
  let target;
  try {
    target = new URL(proxy.target);
  } catch {
    return send(res, 502, `代理目标地址不合法：${proxy.target}`);
  }

  const headers = { ...req.headers };
  for (const key of HOP_BY_HOP) delete headers[key];
  headers.host = target.host;

  const upstreamReq = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: req.method,
      path: urlPath + search,
      headers,
    },
    (upstreamRes) => {
      const outHeaders = {};
      for (const [key, value] of Object.entries(upstreamRes.headers)) {
        if (HOP_BY_HOP.has(key.toLowerCase())) continue;
        outHeaders[key] = value;
      }
      // Agent 面板的数据都是实时的，任何中间缓存都可能让页面看到旧状态
      outHeaders['cache-control'] = 'no-store';
      res.writeHead(upstreamRes.statusCode || 502, outHeaders);
      upstreamRes.pipe(res);
      upstreamRes.on('error', () => res.destroy());
    },
  );

  upstreamReq.on('error', (err) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(
      JSON.stringify({
        error: 'Agent 后端未连接',
        detail: err.message,
        hint: '在项目根目录运行 npm run serve（会同时启动真实 Agent 后端），再刷新页面。',
      }),
    );
  });

  // 浏览器中途关页面 / 点停止时，别把上游连接留着
  req.on('aborted', () => upstreamReq.destroy());
  res.on('close', () => {
    if (!res.writableFinished) upstreamReq.destroy();
  });

  req.pipe(upstreamReq);
}

/* ==========================================================================
   真实模型转发（RAG 观测台用）
   --------------------------------------------------------------------------
   浏览器 ──同源──► 本地预览服务器 ──► OpenAI 兼容网关
   - GET  /api/llm/health            本地响应，告诉页面能否真调模型（不含 key）
   - POST /api/llm/chat/completions  注入 Authorization 后原样转发 + SSE 透传
   只做 CORS 绕行与 key 注入；检索、Prompt 拼装、引用解析都在浏览器里。
   ========================================================================== */

function sendJson(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function normalizeLlmPrefix(llm) {
  const prefix = String(llm?.prefix || '/api/llm').replace(/\/+$/, '');
  return prefix.startsWith('/') ? prefix : `/${prefix}`;
}

/** 未配置模型时的错误体，前端据此展示可操作提示 */
function llmNotConfiguredBody(llm) {
  return {
    error: {
      message:
        llm?.note ||
        '未配置真实模型：在 apps/rag-lab/.env（或复用 apps/agent-lab/.env）配置 DEEPSEEK_API_KEY / OPENAI_BASE_URL / RAG_MODEL 后重启 npm run serve',
      code: 'llm_not_configured',
    },
  };
}

function proxyLlmChat(req, res, llm) {
  if (!llm.configured) {
    return sendJson(res, 503, llmNotConfiguredBody(llm));
  }

  let target;
  try {
    target = new URL(`${String(llm.baseUrl).replace(/\/+$/, '')}/chat/completions`);
  } catch {
    return sendJson(res, 502, {
      error: { message: `模型网关地址不合法：${llm.baseUrl}`, code: 'llm_upstream_error' },
    });
  }

  const headers = { ...req.headers };
  for (const key of HOP_BY_HOP) delete headers[key];
  headers.host = target.host;
  // key 只在本机进程里注入，绝不进入前端产物 / 浏览器
  headers.authorization = `Bearer ${llm.apiKey}`;

  // 模型网关一般是 https：按目标协议选 transport
  const transport = target.protocol === 'https:' ? https : http;
  const upstreamReq = transport.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: 'POST',
      path: target.pathname + target.search,
      headers,
    },
    (upstreamRes) => {
      const outHeaders = {};
      for (const [key, value] of Object.entries(upstreamRes.headers)) {
        if (HOP_BY_HOP.has(key.toLowerCase())) continue;
        outHeaders[key] = value;
      }
      outHeaders['cache-control'] = 'no-store';
      res.writeHead(upstreamRes.statusCode || 502, outHeaders);
      upstreamRes.pipe(res);
      upstreamRes.on('error', () => res.destroy());
    },
  );

  upstreamReq.on('error', (err) => {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    sendJson(res, 502, {
      error: {
        message: `真实模型请求失败：${err?.message || err}`,
        code: 'llm_upstream_error',
      },
    });
  });

  // 模型首 token 可能较慢；用空闲超时兜底，避免连接一直挂着
  const timeoutMs = Number(llm.timeoutMs) > 0 ? Number(llm.timeoutMs) : 120_000;
  upstreamReq.setTimeout(timeoutMs, () => {
    upstreamReq.destroy(new Error(`模型网关 ${Math.round(timeoutMs / 1000)} 秒无响应`));
  });

  // 浏览器点「停止生成」/关页面时，别把上游连接留着
  req.on('aborted', () => upstreamReq.destroy());
  res.on('close', () => {
    if (!res.writableFinished) upstreamReq.destroy();
  });

  req.pipe(upstreamReq);
}

/**
 * 处理 /api/llm/* 请求；命中前缀返回 true（响应已结束或已开始流式透传）。
 */
function handleLlmRequest(req, res, urlPath, llm) {
  const prefix = normalizeLlmPrefix(llm);
  if (urlPath !== prefix && !urlPath.startsWith(prefix + '/')) return false;

  const sub = urlPath.slice(prefix.length) || '/';
  const method = String(req.method || 'GET').toUpperCase();

  if (sub === '/health') {
    if (method !== 'GET' && method !== 'HEAD') {
      sendJson(res, 405, { error: { message: '只支持 GET', code: 'method_not_allowed' } }, { allow: 'GET, HEAD' });
      return true;
    }
    const payload = typeof llm.health === 'function' ? llm.health() : {
      ok: true,
      configured: Boolean(llm.configured),
      mode: llm.configured ? 'llm' : 'disconnected',
      model: llm.configured ? String(llm.model || '') : '',
      baseUrl: llm.configured ? String(llm.baseUrl || '') : '',
      note: llm.note || '',
    };
    if (method === 'HEAD') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end();
      return true;
    }
    sendJson(res, 200, payload);
    return true;
  }

  if (sub === '/chat/completions') {
    if (method !== 'POST') {
      sendJson(res, 405, { error: { message: '只支持 POST', code: 'method_not_allowed' } }, { allow: 'POST' });
      return true;
    }
    proxyLlmChat(req, res, llm);
    return true;
  }

  sendJson(res, 404, { error: { message: `未知的模型转发路径：${urlPath}`, code: 'not_found' } });
  return true;
}

/**
 * @param {{
 *   root: string,
 *   prefix?: string,
 *   spaFallback?: boolean,
 *   quiet?: boolean,
 *   proxies?: Array<{ prefix: string, target: string }>,
 *   llm?: null | { enabled?: boolean, prefix?: string, configured: boolean, baseUrl: string, apiKey: string, model: string, timeoutMs?: number, note?: string, health?: () => object },
 * }} options
 *   root     静态根目录（绝对路径）
 *   prefix   URL 前缀，例如 '/demos/mecha-battle'；请求会去掉前缀后再映射到 root
 *   proxies  反向代理规则（按最长前缀匹配），用于把 /api/* 交给本地 Agent 后端
 *   llm      真实模型转发配置（scripts/llm-config.mjs 的返回值）；null = 不启用
 */
export function createStaticServer({
  root,
  prefix = '/',
  spaFallback = false,
  quiet = false,
  proxies = [],
  llm = null,
}) {
  const absRoot = path.resolve(root);
  const cleanPrefix = prefix === '/' ? '/' : '/' + prefix.replace(/^\/+|\/+$/g, '') + '/';

  return http.createServer((req, res) => {
    const started = Date.now();
    let parsedUrl;
    let urlPath;
    try {
      parsedUrl = new URL(req.url || '/', 'http://localhost');
      urlPath = decodeURIComponent(parsedUrl.pathname);
    } catch {
      return send(res, 400, 'Bad Request');
    }

    // 真实模型转发最优先：/api/llm/* 只做 key 注入与 CORS 绕行（RAG 观测台用）
    if (llm && llm.enabled !== false && handleLlmRequest(req, res, urlPath, llm)) {
      return;
    }

    // 反向代理优先于静态文件：/api/* 交给真实 Agent 后端（GET/POST/DELETE 都支持）
    const proxy = matchProxy(proxies, urlPath);
    if (proxy) {
      return proxyRequest(req, res, urlPath, parsedUrl.search, proxy);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, 'Method Not Allowed', { allow: 'GET, HEAD' });
    }

    // 子路径托管：缺尾斜杠时补上，保证页面内的相对路径解析正确
    if (cleanPrefix !== '/' && urlPath === cleanPrefix.slice(0, -1)) {
      res.writeHead(301, { location: cleanPrefix + (parsedUrl.search || '') });
      return res.end();
    }

    let rel;
    if (cleanPrefix === '/') {
      rel = urlPath;
    } else if (urlPath.startsWith(cleanPrefix)) {
      rel = urlPath.slice(cleanPrefix.length - 1) || '/';
    } else {
      return send(res, 404, `Not Found: ${urlPath}\n（当前服务根路径为 ${cleanPrefix}）`);
    }

    let filePath = path.join(absRoot, rel);
    const relToRoot = path.relative(absRoot, filePath);
    if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
      return send(res, 403, 'Forbidden');
    }

    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      if (spaFallback) {
        filePath = path.join(absRoot, 'index.html');
        try {
          stat = fs.statSync(filePath);
        } catch {
          return send(res, 404, 'Not Found');
        }
      } else {
        return send(res, 404, `Not Found: ${urlPath}`);
      }
    }

    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      try {
        stat = fs.statSync(filePath);
      } catch {
        return send(res, 404, `Not Found (directory without index.html): ${urlPath}`);
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const headers = {
      'content-type': type,
      'content-length': stat.size,
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      // 部分 wasm / 体感模型需要跨域隔离时用不上，但保留关键头不影响普通资源
      'cross-origin-resource-policy': 'cross-origin',
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath)
      .on('error', () => res.destroy())
      .pipe(res)
      .on('finish', () => {
        if (!quiet) console.log(`[static] ${req.method} ${urlPath} → ${stat.size}B ${Date.now() - started}ms`);
      });
  });
}

/**
 * 启动一个静态服务并打印可访问地址。
 * @param {{
 *   root: string,
 *   prefix?: string,
 *   port?: number,
 *   host?: string,
 *   quiet?: boolean,
 *   spaFallback?: boolean,
 *   proxies?: Array<{ prefix: string, target: string }>,
 *   llm?: null | object,
 * }} options
 */
export function startStaticServer({
  root,
  prefix = '/',
  port = 5180,
  host = '127.0.0.1',
  quiet = false,
  spaFallback = false,
  proxies = [],
  llm = null,
}) {
  const server = createStaticServer({ root, prefix, quiet, spaFallback, proxies, llm });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      resolve({
        server,
        url: `http://${host}:${port}${prefix === '/' ? '/' : prefix}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}
