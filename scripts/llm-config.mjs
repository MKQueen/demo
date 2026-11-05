#!/usr/bin/env node
/**
 * llm-config.mjs —— 本地预览用的「真实大模型」配置解析
 *
 * 为什么需要这一层？
 *   RAG 观测台在构建版里把知识库与检索管线全部放进浏览器（不需要任何 RAG 后端），
 *   但生成回答必须真的调用大模型。模型网关（OpenAI 兼容）通常不允许浏览器跨域直连
 *   （OPTIONS 预检被拒 / 没有 Access-Control-Allow-Origin），而且把 API Key 放进前端
 *   产物也不安全。因此本地预览服务器（scripts/static-server.mjs）提供一个**极薄的转发**：
 *
 *     浏览器 ──POST /api/llm/chat/completions──► 本地预览服务器 ──► 模型网关
 *              （同源、无预检）                    （注入 Authorization，SSE 原样透传）
 *
 *   这一层只做两件事：注入 API Key、CORS 绕行。知识库、切块、向量/BM25/RRF、
 *   Prompt 拼装、引用解析全部仍在浏览器里完成，它不是 RAG 后端。
 *
 * 配置优先级（前面的优先）：
 *   1. 进程环境变量（RAG_LLM_* / DEEPSEEK_API_KEY / OPENAI_BASE_URL / RAG_MODEL…）
 *   2. apps/rag-lab/.env
 *   3. apps/agent-lab/.env（复用 mini-opencode 已经在用的同一份网关配置）
 *
 * 注意：API Key 只存在于本机 Node 进程，不会进入 site/ 产物，也不会发给浏览器。
 */
import fs from 'node:fs';
import path from 'node:path';

/** 占位符 / 示例值不算配置（.env.example 里那句「在这里填」） */
const PLACEHOLDER = /在这里填|your[-_ ]?key|sk-xxx|^<.*>$/i;

/**
 * 解析极简 KEY=VALUE 格式的 .env（支持引号、注释、行内 export）。
 * @param {string} file
 * @returns {Record<string, string>}
 */
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
    if (key) out[key] = value;
  }
  return out;
}

/**
 * 读取「真实模型转发」配置。
 *
 * @param {{root?: string, env?: NodeJS.ProcessEnv, prefix?: string}} [options]
 * @returns {{
 *   enabled: true,
 *   configured: boolean,
 *   prefix: string,
 *   baseUrl: string,
 *   apiKey: string,
 *   model: string,
 *   timeoutMs: number,
 *   source: {key: string, baseUrl: string, model: string},
 *   note: string,
 *   health: () => object,
 * }}
 */
export function loadLlmProxyConfig({ root = process.cwd(), env = process.env, prefix = '/api/llm' } = {}) {
  const sources = [
    { name: '进程环境变量', vars: env || {} },
    { name: 'apps/rag-lab/.env', vars: parseEnvFile(path.join(root, 'apps', 'rag-lab', '.env')) },
    { name: 'apps/agent-lab/.env', vars: parseEnvFile(path.join(root, 'apps', 'agent-lab', '.env')) },
  ];

  /** 按优先级在多个来源里找第一个非空值 */
  const pick = (keys) => {
    for (const source of sources) {
      for (const key of keys) {
        const value = String(source.vars?.[key] ?? '').trim();
        if (value) return { value, source: source.name, key };
      }
    }
    return null;
  };

  const keyHit = pick([
    'RAG_LLM_API_KEY',
    'DEEPSEEK_API_KEY',
    'OPENAI_API_KEY',
    'RAG_API_KEY',
    'LLM_API_KEY',
    'MINI_API_KEY',
  ]);
  const baseHit = pick(['RAG_LLM_BASE_URL', 'OPENAI_BASE_URL', 'RAG_BASE_URL', 'MINI_BASE_URL']);
  const modelHit = pick(['RAG_LLM_MODEL', 'RAG_MODEL', 'MINI_MODEL']);

  const apiKey = keyHit && !PLACEHOLDER.test(keyHit.value) ? keyHit.value : '';
  const configured = Boolean(apiKey);
  const baseUrl = String(baseHit?.value || 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = String(modelHit?.value || (configured ? 'deepseek-chat' : '')).trim();

  const timeoutMs = Number(process.env.RAG_LLM_TIMEOUT_MS) > 0 ? Number(process.env.RAG_LLM_TIMEOUT_MS) : 120_000;

  const note = configured
    ? `OpenAI 兼容接口 · ${model || '未命名模型'}`
    : '未配置模型 Key：在 apps/rag-lab/.env（或复用 apps/agent-lab/.env）写入 DEEPSEEK_API_KEY / OPENAI_BASE_URL / RAG_MODEL，然后重启 npm run serve';

  return {
    enabled: true,
    configured,
    prefix,
    baseUrl,
    apiKey,
    model,
    timeoutMs,
    source: {
      key: keyHit?.source || '',
      baseUrl: baseHit?.source || '',
      model: modelHit?.source || '',
    },
    note,
    /** GET /api/llm/health 的响应体（永远不含 key） */
    health() {
      return {
        ok: true,
        configured,
        mode: configured ? 'llm' : 'disconnected',
        model: configured ? model : '',
        baseUrl: configured ? baseUrl : '',
        note,
      };
    },
  };
}
