#!/usr/bin/env node
/**
 * copy-cesium-assets.mjs —— 把 Cesium 的静态资源复制到 public/cesium。
 *
 * 为什么需要：CesiumJS 运行时按 CESIUM_BASE_URL 去拉 Workers / Assets /
 * Widgets / ThirdParty 这些**非打包资源**。Vite 不会自动处理它们，所以
 * 在 postinstall 阶段把 node_modules/cesium/Build/Cesium 下的资源目录
 * 拷进 public/cesium（public 目录会被 Vite 原样复制进 dist，也支持 dev）。
 *
 * 这样构建产物是相对路径（./cesium/），可以部署在任意子目录。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(APP_ROOT, 'node_modules', 'cesium', 'Build', 'Cesium');
const DEST = path.join(APP_ROOT, 'public', 'cesium');
const DIRS = ['Assets', 'ThirdParty', 'Widgets', 'Workers'];

if (!fs.existsSync(SRC)) {
  // npm install 尚未完成（比如 postinstall 由脚本触发但 node_modules 还没就位）
  console.warn(`[cesium-assets] 跳过：未找到 ${SRC}`);
  process.exit(0);
}

fs.mkdirSync(DEST, { recursive: true });
for (const dir of DIRS) {
  const from = path.join(SRC, dir);
  const to = path.join(DEST, dir);
  if (!fs.existsSync(from)) {
    console.warn(`[cesium-assets] 缺少 ${dir}，跳过`);
    continue;
  }
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  console.log(`[cesium-assets] ${dir} ✓`);
}

// 一个标记文件，方便排查版本
const pkg = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'node_modules', 'cesium', 'package.json'), 'utf8'));
fs.writeFileSync(path.join(DEST, 'version.json'), JSON.stringify({ cesium: pkg.version, copiedAt: new Date().toISOString() }, null, 2));
console.log(`[cesium-assets] 完成 → public/cesium （CesiumJS ${pkg.version}）`);
