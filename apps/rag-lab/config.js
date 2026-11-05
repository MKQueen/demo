/**
 * config.js —— 运行时配置（零依赖）
 *
 * 优先级：命令行参数 > 进程环境变量 > 项目根目录 .env > 内置默认值。
 * 这里刻意手写了一个极简 .env 解析器：RAG Demo 不需要 dotenv 这种依赖。
 *
 * 生成只走真实大模型：配置里不再有「离线演示 / mock」开关。
 * 没有可用 API Key 时 llm 客户端 available=false，server.js 会明确返回「未连接」错误，
 * 不会伪造任何本地答案。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const VERSION = '0.1.0';

/** 解析简单 KEY=VALUE 格式的 .env（支持引号、注释、行内 export） */
export function parseEnvFile(file) {
  const out = {};
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).replace(/^export\s+/, '').trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** 解析 `--port 8900 --host 127.0.0.1` 这类简易 CLI 参数 */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

export function loadConfig(overrides = {}) {
  const fileEnv = parseEnvFile(path.join(ROOT, '.env'));
  const env = { ...fileEnv, ...process.env };
  const args = { ...parseArgs(), ...overrides };

  // 兼容多种环境变量名；key 是否真的可用（含 .env.example 占位符判断）由 rag/llm.js 统一裁决
  const apiKey = String(
    env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY || env.RAG_API_KEY || env.LLM_API_KEY || '',
  ).trim();
  const baseUrl = String(
    env.OPENAI_BASE_URL || env.RAG_BASE_URL || 'https://api.deepseek.com',
  ).replace(/\/+$/, '');
  const model = env.RAG_MODEL || env.MINI_MODEL || 'deepseek-flash';

  const port = Number(args.port || env.PORT || 8900);
  const host = String(args.host || env.HOST || '127.0.0.1');
  const topK = Math.max(1, Math.min(20, Number(args['top-k'] || env.RAG_TOP_K || 6)));
  const dim = Math.max(64, Math.min(16384, Number(env.RAG_EMBED_DIM || 8192)));

  return {
    version: VERSION,
    port,
    host,
    topK,
    llm: {
      apiKey,
      baseUrl,
      model,
      // 思考强度：客服场景默认 low（越快越好），空字符串表示不发送该字段
      reasoningEffort: String(env.RAG_REASONING_EFFORT ?? 'low').trim(),
      // 供前端展示，不包含 key
      displayBaseUrl: baseUrl,
    },
    embedding: { mode: 'hash', dim },
    kbDir: path.join(ROOT, 'kb'),
    evalPath: path.join(ROOT, 'kb', 'eval.json'),
    webDir: path.join(ROOT, 'web'),
    docsDir: path.join(ROOT, 'docs'),
  };
}
