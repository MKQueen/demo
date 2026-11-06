#!/usr/bin/env node
/**
 * shot.mjs —— 场景截图工具（开发自检 / 封面 / 视觉验收）。
 *
 * 假设 Vite dev server 已在 5210 端口运行（npm run dev -- --port 5210），
 * 用 Playwright 打开场景、等待就绪、截图，并打印页面 console error / pageerror。
 *
 * 用法：
 *   node tools/shot.mjs --out screenshots/dev/hero.png
 *   node tools/shot.mjs --url "http://127.0.0.1:5210/?view=corner&still=1" --out x.png
 *   node tools/shot.mjs --w 1600 --h 1000 --wait 3000 --out x.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
function arg(name, fallback = null) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
}
const url = arg('url', 'http://127.0.0.1:5210/');
const out = arg('out', 'screenshots/dev/shot.png');
const width = Number(arg('w', 1600));
const height = Number(arg('h', 1000));
const dpr = Number(arg('dpr', 1));
const wait = Number(arg('wait', 2600));
const timeout = Number(arg('timeout', 45000));
const evalJs = arg('eval', null);

fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'],
});
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: dpr,
});
const page = await context.newPage();
const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => {
  if (!r.url().includes('favicon')) logs.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText || ''}`);
});

const t0 = Date.now();
let ready = false;
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  await page.waitForFunction('window.__KONBINI__ && window.__KONBINI__.ready === true', null, { timeout });
  ready = true;
  if (evalJs) await page.evaluate(evalJs);
  await page.waitForTimeout(wait);
} catch (error) {
  logs.push(`[shot] ${error.message}`);
}
await page.screenshot({ path: path.resolve(out) });
const ms = Date.now() - t0;
const info = await page.evaluate(() => {
  const k = window.__KONBINI__;
  if (!k) return null;
  return {
    calls: k.renderer?.info?.render?.calls ?? null,
    triangles: k.renderer?.info?.render?.triangles ?? null,
    programs: k.renderer?.info?.programs?.length ?? null,
    textures: k.renderer?.info?.memory?.textures ?? null,
    geometries: k.renderer?.info?.memory?.geometries ?? null,
    fps: k.fps ?? null,
    extras: k.debug ?? null,
  };
});
await browser.close();
console.log(JSON.stringify({ out, url, ms, ready, info, logs: logs.slice(0, 40) }, null, 2));
if (!ready) process.exitCode = 2;
