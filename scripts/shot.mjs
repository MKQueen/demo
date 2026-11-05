#!/usr/bin/env node
/**
 * shot.mjs —— 统一的无头浏览器截图 / 冒烟检查脚本（Playwright）。
 *
 * 用法：
 *   node scripts/shot.mjs <url> <输出图片> [选项]
 *
 * 选项：
 *   --wait <ms>          打开页面后等待（默认 4000）
 *   --width/--height     视口尺寸（默认 1600x1000）
 *   --full               整页截图（默认只截视口）
 *   --actions <file>     JSON 动作序列，例如：
 *                        [{"click":"#floors-btn"},{"waitFor":".floor-plan"},{"wait":800}]
 *                        支持的动作：click / waitFor / wait / eval / press / hover / scrollTo
 *   --strict             出现 console error 或 pageerror 时退出码 1（用于验收）
 *   --keep-open <ms>     截图后额外等待（默认 0）
 *
 * 输出：截图 + 控制台报告（pageerror / console error / 失败请求）。
 * 截图格式按扩展名推断（.jpg 自动 quality=85）。
 */
import path from 'node:path';
import fs from 'node:fs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('用法：node scripts/shot.mjs <url> <输出图片> [--wait 4000] [--actions actions.json] [--strict]');
  process.exit(1);
}
const url = args[0];
const out = path.resolve(args[1]);
const getArg = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const hasFlag = (flag) => args.includes(flag);

const waitMs = Number(getArg('--wait', 4000));
const width = Number(getArg('--width', 1600));
const height = Number(getArg('--height', 1000));
const keepOpenMs = Number(getArg('--keep-open', 0));
const fullPage = hasFlag('--full');
const strict = hasFlag('--strict');
const gpu = hasFlag('--gpu');
const actionsFile = getArg('--actions', null);

const actions = actionsFile && fs.existsSync(path.resolve(actionsFile)) ? JSON.parse(fs.readFileSync(path.resolve(actionsFile), 'utf8')) : [];
fs.mkdirSync(path.dirname(out), { recursive: true });

// --gpu：启用真实 GPU（macOS 上走 ANGLE Metal）。Cesium / 3D 类 demo 截图时用，
// 否则 headless 默认的 SwiftShader 软件渲染会非常慢，HUD 上的 FPS 也会失真。
const browser = await chromium.launch({
  headless: true,
  args: gpu ? ['--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [],
});
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => pageErrors.push(String(err && err.message ? err.message : err)));
page.on('requestfailed', (req) => failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText || 'failed'}`));

console.log(`→ ${url}`);
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(waitMs);

for (const action of actions) {
  try {
    if (action.click) {
      await page.click(action.click, { timeout: action.timeout || 10000 });
      console.log(`  · click ${action.click}`);
    } else if (action.waitFor) {
      await page.waitForSelector(action.waitFor, { timeout: action.timeout || 15000, state: action.state || 'visible' });
      console.log(`  · waitFor ${action.waitFor}`);
    } else if (action.wait) {
      await page.waitForTimeout(action.wait);
    } else if (action.eval) {
      const result = await page.evaluate(action.eval);
      if (result !== undefined) console.log(`  · eval → ${JSON.stringify(result).slice(0, 300)}`);
    } else if (action.press) {
      await page.keyboard.press(action.press);
      console.log(`  · press ${action.press}`);
    } else if (action.hover) {
      await page.hover(action.hover);
    } else if (action.scrollTo) {
      await page.evaluate((y) => window.scrollTo(0, y), action.scrollTo);
    }
  } catch (error) {
    console.error(`  ✗ 动作失败 ${JSON.stringify(action)}：${error.message}`);
    if (strict) {
      await browser.close();
      process.exit(1);
    }
  }
}

if (keepOpenMs) await page.waitForTimeout(keepOpenMs);

const ext = path.extname(out).toLowerCase();
const shotOptions = { path: out, fullPage, type: ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : 'png' };
if (shotOptions.type === 'jpeg') shotOptions.quality = 88;
await page.screenshot(shotOptions);
const size = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`✓ 截图 ${path.relative(process.cwd(), out)} (${size} KB)`);

const title = await page.title();
console.log(`  标题：${title}`);

if (pageErrors.length) {
  console.log(`\n✗ pageerror (${pageErrors.length}):`);
  pageErrors.slice(0, 10).forEach((e) => console.log('  ' + e));
}
if (consoleErrors.length) {
  console.log(`\n✗ console.error (${consoleErrors.length}):`);
  [...new Set(consoleErrors)].slice(0, 12).forEach((e) => console.log('  ' + e.slice(0, 400)));
}
if (failedRequests.length) {
  console.log(`\n⚠ 失败请求 (${failedRequests.length}):`);
  [...new Set(failedRequests)].slice(0, 15).forEach((e) => console.log('  ' + e));
}
if (!pageErrors.length && !consoleErrors.length && !failedRequests.length) {
  console.log('✓ 无 pageerror / console.error / 失败请求');
}

await browser.close();
if (strict && (pageErrors.length || consoleErrors.length)) process.exit(1);
