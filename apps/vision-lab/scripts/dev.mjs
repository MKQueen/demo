#!/usr/bin/env node
/**
 * dev.mjs —— 先构建，再用一个零依赖静态服务器预览。
 *
 *   node scripts/dev.mjs            # http://127.0.0.1:5187/
 *   node scripts/dev.mjs 5192       # 自定义端口
 *
 * 说明：这个 demo 没有 Vite / HMR，改完源码重新运行即可；
 * 摄像头需要 HTTPS 或 localhost，本机 127.0.0.1 满足要求。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const port = Number(process.argv[2] || 5187);

const build = spawnSync('node', [path.join(ROOT, 'scripts', 'build.mjs')], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status || 1);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.tflite': 'application/octet-stream',
  '.task': 'application/octet-stream',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  let file = path.join(DIST, urlPath);
  const relative = path.relative(DIST, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Not Found: ${urlPath}`);
    return;
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`\n  视觉感知 VISION LAB：http://127.0.0.1:${port}/`);
  console.log('  摄像头需要 localhost / HTTPS 权限；关闭终端即停止预览\n');
});
