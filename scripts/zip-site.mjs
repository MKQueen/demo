#!/usr/bin/env node
/**
 * zip-site.mjs —— 把 site/ 打成可直接上传的 site.zip。
 *
 * 优先使用系统 zip（macOS/Linux 自带），保留目录结构、排除 .DS_Store。
 * 输出：项目根目录 site.zip
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const OUT = path.join(ROOT, 'site.zip');

if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  console.error('✗ 未找到 site/index.html，请先运行：npm run build');
  process.exit(1);
}

if (fs.existsSync(OUT)) fs.rmSync(OUT);

console.log('正在打包 site.zip …');
console.log('提示：站点是纯静态产物；mini-opencode 需要本机后端（npm run serve），');
console.log('      RAG 观测台的检索/可视化静态可看，但真实模型回答需要本机 npm run serve 的 /api/llm 转发；');
console.log('      静态托管时两处都会明确显示「未连接」，不会用假数据冒充。');
const res = spawnSync(
  'zip',
  ['-r', '-q', '-X', OUT, '.', '-x', '*.DS_Store', '-x', '__MACOSX/*'],
  { cwd: SITE, stdio: 'inherit' },
);

if (res.status !== 0) {
  console.error('✗ 打包失败（需要系统 zip 命令）');
  process.exit(res.status || 1);
}

const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
console.log(`✓ 已生成 ${path.relative(ROOT, OUT)}（${mb} MB）`);
console.log('  上传后把站点根目录指向解压后的 site/ 即可：大部分 Demo 纯静态可看；');
console.log('  mini-opencode 与 RAG 观测台的真实模型回答需要本机 npm run serve（后端只监听 127.0.0.1，别暴露公网）。');
