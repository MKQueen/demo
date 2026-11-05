#!/usr/bin/env node
/**
 * ============================================================================
 * verify-agent-live.mjs —— 验收「mini-opencode 在合集站点里是真 Agent」
 * ============================================================================
 *
 * 为什么需要这个脚本？
 *   以前 agent-lab 是静态回放，验收只要看页面有没有渲染出录好的数据；
 *   现在它是真实 Agent，光看页面长得对不够 —— 必须确认：
 *     1. 页面真的连上了本地后端（不是离线提示条）；
 *     2. 顶栏模型是真实模型（不是 mock）；
 *     3. 发一句话，真的能等到模型回答（走同源 /api 代理 + SSE）；
 *     4. 全程没有 pageerror / console.error。
 *
 * 前提：先在项目根目录 `npm run serve`（里面已经带真实后端）。
 *
 * 用法：
 *   node scripts/verify-agent-live.mjs                      # 默认 http://127.0.0.1:5180/demos/agent-lab/
 *   node scripts/verify-agent-live.mjs http://127.0.0.1:5199/demos/agent-lab/
 *   node scripts/verify-agent-live.mjs --shot               # 额外截图 screenshots/audit/agent-live.jpg
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOT_DIR = path.join(ROOT, 'screenshots', 'audit');

const argv = process.argv.slice(2);
const wantShot = argv.includes('--shot');
const target = argv.find((arg) => arg.startsWith('http')) || 'http://127.0.0.1:5180/demos/agent-lab/';

const PROMPT =
  '先用 read 工具读 notes.md，再用 glob 列出这个沙盒目录里的文件，然后用三句话总结这份会议纪要。只读，不要修改任何文件，也不要运行命令。';

const failures = [];
const consoleErrors = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (error) => consoleErrors.push('pageerror: ' + error.message));

try {
  console.log(`▸ 打开 ${target}`);
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#conn[data-state="open"]', { timeout: 30000 });
  console.log('  ✓ SSE 已连接');

  const backendState = await page.evaluate(() =>
    document.documentElement.getAttribute('data-agent-backend'),
  );
  if (backendState !== 'online') failures.push(`后端在线标记异常：${backendState}`);
  if (await page.$('#agent-offline-banner')) failures.push('页面出现了「未连接后端」提示条');

  const modelText = (await page.textContent('#badge-model'))?.trim() || '';
  const kindText = (await page.textContent('#badge-kind'))?.trim() || '';
  console.log(`  · 模型：${modelText}（${kindText}）`);
  if (!modelText || modelText === '—') failures.push('顶栏没有显示模型名');
  if (/mock/i.test(modelText) || /mock/i.test(kindText)) failures.push('当前是 mock 模式，不是真实模型');
  if (!/真实/.test(kindText)) failures.push(`模型来源没有标「真实」：${kindText}`);

  await page.waitForSelector('#input:not([disabled])', { timeout: 20000 });
  await page.fill('#input', PROMPT);
  await page.click('#send-btn');
  console.log('  · 已发送真实任务，等待模型回答…');

  await page.waitForFunction(
    () => {
      const send = document.querySelector('#send-btn');
      const agents = Array.from(document.querySelectorAll('.msg.agent .msg-text'));
      const last = agents.length ? agents[agents.length - 1].textContent.trim() : '';
      return send && !send.disabled && last.length > 30;
    },
    null,
    { timeout: 240000, polling: 1500 },
  );

  const answer = await page.evaluate(() => {
    const agents = Array.from(document.querySelectorAll('.msg.agent .msg-text'));
    return agents.length ? agents[agents.length - 1].textContent.trim() : '';
  });
  console.log('  ✓ 模型真实回答：' + answer.slice(0, 120).replace(/\s+/g, ' ') + '…');

  if (wantShot) {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    const out = path.join(SHOT_DIR, 'agent-live.jpg');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
    console.log(`  ✓ 截图：${path.relative(ROOT, out)}`);
  }
} catch (error) {
  failures.push(String(error && error.message ? error.message : error));
} finally {
  await browser.close();
}

if (consoleErrors.length) {
  console.log('\n前端错误：');
  consoleErrors.slice(0, 8).forEach((item) => console.log('  ·', item));
  failures.push(`${consoleErrors.length} 个 console/page error`);
}

if (failures.length) {
  console.error('\n✗ 真实 Agent 验收失败：');
  failures.forEach((item) => console.error('  ·', item));
  process.exit(1);
}
console.log('\n✓ 通过：页面 = 真实后端 = 真实模型 = 真实工具（且无前端错误）');
