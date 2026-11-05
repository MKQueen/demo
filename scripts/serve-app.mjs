#!/usr/bin/env node
/**
 * serve-app.mjs —— 以「子路径静态托管」的方式预览单个 demo 的构建产物。
 *
 * 合集站点里每个 demo 都位于 /demos/<id>/ 下，所以绝对路径资源（/models/x.glb）
 * 在真实部署时会 404。这个脚本可以提前暴露这类问题：
 *
 *   node scripts/serve-app.mjs apps/mecha-battle/dist /demos/mecha-battle 5281
 *   → http://127.0.0.1:5281/demos/mecha-battle/
 *
 * 也可以不传前缀，直接按根路径预览：
 *
 *   node scripts/serve-app.mjs apps/rag-lab/dist / 5282
 *
 * 预览 rag-lab 时加 --llm 可启用 /api/llm 真实模型转发（否则页面显示「未连接真实模型」）：
 *
 *   node scripts/serve-app.mjs apps/rag-lab/dist /demos/rag-lab 5283 --llm
 *
 * 参数：<dist 目录> [URL 前缀] [端口] [--llm]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './static-server.mjs';
import { loadLlmProxyConfig } from './llm-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const wantLlm = argv.includes('--llm');
const positional = argv.filter((arg) => !arg.startsWith('--'));
const target = positional[0];
if (!target) {
  console.error('用法：node scripts/serve-app.mjs <dist 目录> [URL 前缀] [端口]');
  process.exit(1);
}
const dir = path.resolve(ROOT, target);
const prefix = (positional[1] || '/').trim() || '/';
const port = Number(positional[2] || process.env.PORT || 5280);

if (!fs.existsSync(path.join(dir, 'index.html'))) {
  console.error(`✗ ${path.relative(ROOT, dir)}/index.html 不存在，请先在该 app 目录执行 npm run build`);
  process.exit(1);
}

const llm = wantLlm ? loadLlmProxyConfig({ root: ROOT }) : null;
const { url } = await startStaticServer({ root: dir, prefix, port, host: '127.0.0.1', quiet: true, llm });
console.log(`\n  单 demo 预览：${url}`);
console.log(`  静态目录：${dir}`);
if (llm) {
  console.log(
    llm.configured
      ? `  RAG 真实模型：${llm.model}（/api/llm 转发，key 来自 ${llm.source.key || '未知来源'}）`
      : '  ⚠ 已启用 /api/llm，但未配置模型 Key，rag-lab 会显示「未连接真实模型」',
  );
}
if (dir.replace(/\\/g, '/').includes('agent-lab')) {
  console.log('  ⚠ agent-lab 是真实 Agent：这个脚本不代理 /api，面板会显示「未连接后端」；');
  console.log('    要连真实后端请用项目根目录的 npm run serve（会自动起后端 + 代理）。');
}
if (dir.replace(/\\/g, '/').includes('rag-lab') && !wantLlm) {
  console.log('  ⚠ rag-lab 需要真实模型转发：加 --llm 才会启用 /api/llm，否则页面显示「未连接真实模型」。');
}
console.log(`  （已按子路径托管，用于验证相对路径资源）\n  按 Ctrl+C 停止\n`);
