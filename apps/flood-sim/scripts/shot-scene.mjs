#!/usr/bin/env node
/**
 * shot-scene.mjs —— 本地调试截图：用 Playwright 打开 dev-scene.html，等待场景就绪，
 * 支持设置水位/视角后截图。用于迭代地形/水面/建筑视觉。
 *
 * 用法：
 *   node scripts/shot-scene.mjs                         # 默认全景
 *   node scripts/shot-scene.mjs --level 18 --preset village --out scene-village.png
 *   node scripts/shot-scene.mjs --url http://127.0.0.1:5183/dev-scene.html
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const url = arg('url', 'http://127.0.0.1:5183/dev-scene.html');
const level = Number(arg('level', '2.5'));
const preset = arg('preset', 'overview');
const outName = arg('out', `scene-${preset}-${String(level).replace('.', '_')}.png`);
const waitMs = Number(arg('wait', '4000'));
const width = Number(arg('w', '1600'));
const height = Number(arg('h', '1000'));

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width, height } });
const errors = [];
const warnings = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
  if (msg.type() === 'warning') warnings.push(msg.text());
});
page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
page.on('response', (res) => {
  if (res.status() >= 400) errors.push(`HTTP ${res.status()} ${res.url()}`);
});

console.log('▸', url);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
try {
  await page.waitForFunction(() => window.__floodReady === true || window.__ready === true, { timeout: 60000 });
} catch {
  console.log('⚠ 场景就绪超时，继续截图');
}
await page.evaluate(
  ({ level, preset }) => {
    const s = window.__floodStore || window.__store;
    if (s) {
      s.cameraPreset = preset;
      s.targetLevel = level;
      s.waterLevel = level;
      s.loading.visible = false;
    }
  },
  { level, preset },
);
await page.waitForTimeout(waitMs);
const dir = path.join(APP, 'screenshots', 'wip');
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, outName);
await page.screenshot({ path: out, type: 'png', fullPage: false });
console.log('✓', path.relative(APP, out));
if (errors.length) {
  console.log('\n✗ console/page errors:');
  for (const e of [...new Set(errors)].slice(0, 30)) console.log('  -', e.slice(0, 300));
} else {
  console.log('✓ 无 console/page error');
}
if (warnings.length) {
  console.log('\nwarnings:');
  for (const w of [...new Set(warnings)].slice(0, 12)) console.log('  -', w.slice(0, 200));
}
const stats = await page.evaluate(() => {
  const s = window.__floodStore || window.__store;
  return s ? { fps: s.fps, stats: s.stats, loading: s.loading, error: s.error } : null;
});
console.log('\nstore:', JSON.stringify(stats).slice(0, 1200));
await browser.close();
