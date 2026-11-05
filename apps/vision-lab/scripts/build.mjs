#!/usr/bin/env node
/**
 * build.mjs —— 纯静态构建（零依赖，不需要 Vite）。
 *
 * 产物 dist/ 结构：
 *   index.html / app.js / labels.js / style.css / favicon.svg
 *   samples/           两张示例图片（Pexels License）
 *   mp/detector.worker.js
 *   mp/vision_bundle.js
 *   mp/wasm/*          MediaPipe Tasks Vision 的 WASM 运行时
 *   mp/person_detector.tflite   EfficientDet-Lite0（COCO 80 类 · 快速模式）
 *   mp/efficientdet_lite2.tflite EfficientDet-Lite2（COCO 80 类 · 高精度模式）
 *
 * 为什么是「复制」而不是 npm 依赖：
 *   MediaPipe 的运行时文件（约 39MB）在仓库里只存一份 —— 复用
 *   apps/mecha-battle/public/mediapipe/ 下已经随项目提供的资源。
 *   vision-lab 只是把它们复制进自己的构建产物，不重复提交进 git。
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

if (!fs.existsSync(MP_SRC)) {
  fail(`找不到共享的 MediaPipe 资源：${MP_SRC}\n  vision-lab 复用 apps/mecha-battle/public/mediapipe/ 下的运行时与模型，请保持 monorepo 结构完整。`);
}
const model = path.join(MP_SRC, 'person_detector.tflite');
const bundle = path.join(MP_SRC, 'vision_bundle.js');
const accurateModel = path.join(PUBLIC, 'models', 'efficientdet_lite2.tflite');
if (!fs.existsSync(model)) fail(`缺少模型文件：${model}`);
if (!fs.existsSync(bundle)) fail(`缺少 MediaPipe 浏览器运行时：${bundle}`);
if (!fs.existsSync(accurateModel)) fail(`缺少高精度模型：${accurateModel}`);

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

copy(path.join(ROOT, 'index.html'), path.join(DIST, 'index.html'));
copy(path.join(PUBLIC, 'favicon.svg'), path.join(DIST, 'favicon.svg'));
copy(path.join(SRC, 'app.js'), path.join(DIST, 'app.js'));
copy(path.join(SRC, 'labels.js'), path.join(DIST, 'labels.js'));
copy(path.join(SRC, 'style.css'), path.join(DIST, 'style.css'));
copy(path.join(SRC, 'detector.worker.js'), path.join(MP_OUT, 'detector.worker.js'));
copy(bundle, path.join(MP_OUT, 'vision_bundle.js'));
copy(model, path.join(MP_OUT, 'person_detector.tflite'));
copy(accurateModel, path.join(MP_OUT, 'efficientdet_lite2.tflite'));

// 两张示例图（Pexels License，见 README）
fs.mkdirSync(path.join(DIST, 'samples'), { recursive: true });
for (const name of fs.readdirSync(path.join(PUBLIC, 'samples'))) {
  if (!/\.(jpe?g|png|webp)$/i.test(name)) continue;
  copy(path.join(PUBLIC, 'samples', name), path.join(DIST, 'samples', name));
}

// WASM 运行时（SIMD + 非 SIMD，MediaPipe 自行选择）
fs.cpSync(path.join(MP_SRC, 'wasm'), path.join(MP_OUT, 'wasm'), { recursive: true });

const required = [
  'index.html',
  'app.js',
  'labels.js',
  'style.css',
  'mp/detector.worker.js',
  'mp/vision_bundle.js',
  'mp/person_detector.tflite',
  'mp/efficientdet_lite2.tflite',
  'mp/wasm/vision_wasm_internal.js',
  'mp/wasm/vision_wasm_internal.wasm',
  'mp/wasm/vision_wasm_nosimd_internal.js',
  'mp/wasm/vision_wasm_nosimd_internal.wasm',
];
const missing = required.filter((file) => !fs.existsSync(path.join(DIST, file)));
if (missing.length) fail(`构建产物不完整，缺少：\n  ${missing.join('\n  ')}`);

console.log('✓ 视觉感知 · VISION LAB 静态构建完成');
console.log(`  模型与 WASM 复用自 apps/mecha-battle/public/mediapipe（不重复提交 git）`);
console.log(`  产物：dist/  ${(sizeOf(DIST) / 1024 / 1024).toFixed(1)} MB`);
