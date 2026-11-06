#!/usr/bin/env node
/**
 * build.mjs —— 纯静态构建（零依赖，不需要 Vite）。
 *
 * 产物 dist/：
 *   index.html / app.js / game.js / style.css / favicon.svg
 *   mp/hand.worker.js
 *   mp/hand_landmarker.task      MediaPipe 手部 21 关键点模型（7.5 MB）
 *   mp/vision_bundle.js          MediaPipe Tasks Vision 浏览器运行时
 *   mp/wasm/*                    推理后端（SIMD / 非 SIMD）
 *   media/hand-poster.jpg        封面用示意图（Pexels License）
 *
 * 复用 apps/mecha-battle/public/mediapipe 的运行时与 WASM，仓库里只存一份；
 * 手部模型随本 app 入库。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src');
const PUBLIC = path.join(ROOT, 'public');
const MP_SRC = path.resolve(ROOT, '../mecha-battle/public/mediapipe');
const MP_OUT = path.join(DIST, 'mp');

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

function copy(file, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(file, destination);
}

function sizeOf(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(file);
      else total += fs.statSync(file).size;
    }
  }
  return total;
}

const bundle = path.join(MP_SRC, 'vision_bundle.js');
const model = path.join(PUBLIC, 'models', 'hand_landmarker.task');
if (!fs.existsSync(MP_SRC)) fail(`找不到 MediaPipe 运行时目录：${MP_SRC}\n  本 demo 复用 apps/mecha-battle/public/mediapipe 下的 vision_bundle.js 与 wasm/。`);
if (!fs.existsSync(bundle)) fail(`缺少 MediaPipe 浏览器运行时：${bundle}`);
if (!fs.existsSync(model)) fail(`缺少手部模型：${model}`);

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

copy(path.join(ROOT, 'index.html'), path.join(DIST, 'index.html'));
copy(path.join(PUBLIC, 'favicon.svg'), path.join(DIST, 'favicon.svg'));
copy(path.join(SRC, 'app.js'), path.join(DIST, 'app.js'));
copy(path.join(SRC, 'game.js'), path.join(DIST, 'game.js'));
copy(path.join(SRC, 'style.css'), path.join(DIST, 'style.css'));
copy(path.join(SRC, 'hand.worker.js'), path.join(MP_OUT, 'hand.worker.js'));
copy(bundle, path.join(MP_OUT, 'vision_bundle.js'));
copy(model, path.join(MP_OUT, 'hand_landmarker.task'));
fs.mkdirSync(path.join(DIST, 'media'), { recursive: true });
copy(path.join(PUBLIC, 'media', 'hand-poster.jpg'), path.join(DIST, 'media', 'hand-poster.jpg'));
fs.cpSync(path.join(MP_SRC, 'wasm'), path.join(MP_OUT, 'wasm'), { recursive: true });

const required = [
  'index.html',
  'app.js',
  'game.js',
  'style.css',
  'mp/hand.worker.js',
  'mp/vision_bundle.js',
  'mp/hand_landmarker.task',
  'mp/wasm/vision_wasm_internal.js',
  'mp/wasm/vision_wasm_internal.wasm',
  'mp/wasm/vision_wasm_nosimd_internal.js',
];
const missing = required.filter((file) => !fs.existsSync(path.join(DIST, file)));
if (missing.length) fail(`构建产物不完整，缺少：\n  ${missing.join('\n  ')}`);

console.log('✓ 手势贪吃蛇 · HAND SNAKE 静态构建完成');
console.log('  手部模型随 app 入库；运行时/WASM 复用 apps/mecha-battle/public/mediapipe');
console.log(`  产物：dist/  ${(sizeOf(DIST) / 1024 / 1024).toFixed(1)} MB`);
