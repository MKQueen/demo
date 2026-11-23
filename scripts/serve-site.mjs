#!/usr/bin/env node
/**
 * serve-site.mjs —— 本地预览打包后的合集站点
 *
 *   npm run serve                          # http://127.0.0.1:5180/
 *   node scripts/serve-site.mjs 8080       # 自定义站点端口
 *   node scripts/serve-site.mjs --static   # 只起静态服务（不启动 Agent 后端、不转发模型）
 *   node scripts/serve-site.mjs --no-llm   # Agent 正常，但不给 rag-lab 转发真实模型
 *
 * 和以前最大的不同：
 *   mini-opencode 现在是**真 Agent**，不是回放。它需要一个本地 Node 后端，
 *   所以这个脚本在起静态站的同时，把真实 Agent 后端也拉起来，
 *   并把站点同源的 /api/* 反向代理过去（SSE 流式透传）。
 *
 *   RAG 观测台也改成真实的了：知识库与检索管线全部在浏览器里跑（没有 RAG 后端），
 *   但回答要真实调用大模型。模型网关不允许浏览器跨域直连，所以这里再提供一层极薄的
 *   /api/llm/* 转发（注入 API Key + SSE 透传）；它不属于 RAG 后端，只做 CORS 绕行。
 *
 *   这样浏览器里打开 /demos/agent-lab/ 看到的就是真的：模型真的在回复，
 *   工具真的在读写那个演示沙盒目录，权限审批也真的会阻塞在服务端；
 *   打开 /demos/rag-lab/ 提问，回答也是真实模型实时生成的。
 *
 * 站点目录为 ./site，必须先执行 `npm run build` 生成。
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './static-server.mjs';
import { startAgentBackend } from './agent-backend.mjs';
import { loadLlmProxyConfig } from './llm-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((arg) => arg.startsWith('--')));
const positional = argv.filter((arg) => !arg.startsWith('--'));
const staticOnly = flags.has('--static') || process.env.MINI_AGENT_OFF === '1';
const noLlm = flags.has('--no-llm') || process.env.RAG_LLM_OFF === '1';

const port = Number(positional[0] || process.env.PORT || 5180);
const host = positional[1] || process.env.HOST || '127.0.0.1';

if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  console.error('✗ 未找到 site/index.html，请先运行：npm run build');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. 真实 Agent 后端（agent-lab 用）
// ---------------------------------------------------------------------------
let agent = null;
if (!staticOnly) {
  try {
    agent = await startAgentBackend({ host, quiet: true });
    console.log(`\n  mini-opencode 真实后端：${agent.url}`);
    console.log(`  模型：${agent.modelLine}`);
    console.log(`  演示工作区：${path.relative(ROOT, agent.workspace)}/  （Agent 只在这里读写/执行）`);
    if (agent.configWarning) {
      console.log(`  ⚠ ${agent.configWarning}`);
    }
  } catch (error) {
    // 后端起不来时不要假装一切正常：把原因打出来，站点仍然可看（面板会显示未连接）
    console.error('\n  ⚠ 真实 Agent 后端启动失败，agent-lab 面板将显示「未连接」：');
    console.error(`    ${String(error && error.message ? error.message : error).split('\n').join('\n    ')}`);
    console.error('    排查：1) Node 版本 ≥ 22.6  2) apps/agent-lab/.env 配置  3) 端口占用\n');
  }
} else {
  console.log('\n  （--static：只起静态服务，agent-lab 不会连接真实后端）');
}

// ---------------------------------------------------------------------------
// 2. 真实模型转发（rag-lab 用；不是 RAG 后端，只做 CORS 绕行 + key 注入）
// ---------------------------------------------------------------------------
let llm = null;
if (staticOnly || noLlm) {
  console.log(
    `\n  （${staticOnly ? '--static' : '--no-llm'}：rag-lab 不会连接真实模型，页面会显示「未连接真实模型」）\n`,
  );
} else {
  llm = loadLlmProxyConfig({ root: ROOT });
  if (llm.configured) {
    console.log(`  RAG 真实模型：${llm.model}  转发路径 /api/llm/chat/completions`);
    console.log(`  网关：${llm.baseUrl}（key 来自 ${llm.source.key || '未知来源'}，不会进入前端产物）`);
  } else {
    console.log('  ⚠ RAG 未配置模型 Key，rag-lab 页面将显示「未连接真实模型」：');
    console.log('    在 apps/rag-lab/.env 或 apps/agent-lab/.env 配置 DEEPSEEK_API_KEY / OPENAI_BASE_URL / RAG_MODEL 后重启。');
  }
}

// ---------------------------------------------------------------------------
// 3. 静态站 + /api 反向代理 + /api/llm 模型转发
// ---------------------------------------------------------------------------
const proxies = agent ? [{ prefix: '/api', target: agent.url }] : [];

// 兜底：不管后面静态服务起没起来，父进程退出时都别把 Agent 子进程留成孤儿
const killAgentChild = () => {
  if (agent && agent.child && agent.child.exitCode === null) {
    try {
      agent.child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
};
process.on('exit', killAgentChild);

let staticHandle;
try {
  staticHandle = await startStaticServer({ root: SITE, prefix: '/', port, host, quiet: true, proxies, llm });
} catch (error) {
  console.error(`✗ 静态服务启动失败（${host}:${port}）：${error.message}`);
  if (agent) await agent.stop();
  if (courier) await courier.close();
  process.exit(1);
}
const { url, close } = staticHandle;

console.log(`  DEMO 合集预览：${url}`);
console.log(`  静态根目录：${SITE}`);
console.log('  按 Ctrl+C 停止\n');

// ---------------------------------------------------------------------------
// 3. 优雅退出：先关 Agent 子进程，别把 Node 进程留在后台
// ---------------------------------------------------------------------------
let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  if (signal) console.log(`\n  收到 ${signal}，正在关闭…`);
  try {
    await close();
  } catch {
    /* ignore */
  }
  if (agent) {
    try {
      await agent.stop();
    } catch {
      /* ignore */
    }
  }
  if (courier) await courier.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
