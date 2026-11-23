// 用 Playwright 给静态 UI 五屏截图（需要 Lead 的 dev server 跑在 5190）
//   node tools/ui/shot.mjs
// 输出：apps/beijing-courier/screenshots/ui/*.png
import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../screenshots/ui');
const BASE = process.env.UI_BASE || 'http://127.0.0.1:5190/tools/ui/test.html';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--font-render-hinting=none'],
});

const errors = [];

async function captureOnce(viewport, url, file, { wait = 900, dialogue = false } = {}) {
  // 每张截图用独立 context：共享 dev server + HMR + 上一个页面的动画都不会干扰结果
  const context = await browser.newContext({ ...viewport });
  const page = await context.newPage();
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-fonts-ready="1"]', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(250);
  if (dialogue) {
    await page
      .waitForFunction(
        () => {
          const box = document.querySelector('.bc-dialog');
          const text = document.querySelector('.bc-dialog__text');
          if (!box || !text) return false;
          return (
            box.classList.contains('is-on') &&
            getComputedStyle(box).opacity === '1' &&
            (text.textContent || '').length >= 10
          );
        },
        { timeout: 15000 }
      )
      .catch(() => {});
  }
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(OUT, file) });
  await context.close();
  console.log('✓', file);
}

// ---- 桌面 1440×900（参考截图同样尺寸） ----
const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const shot = (screen, file, opts) => captureOnce(desktop, `${BASE}?clean=1&screen=${screen}`, file, opts);
await shot('intro', '01-intro.png');
await shot('loading', '02-loading.png', { wait: 700 });
await shot('dialogue', '03-dialogue.png', { wait: 1500, dialogue: true });
await shot('checklist', '04-checklist.png');
await shot('outfit', '05-outfit.png');
await shot('emoji', '06-emoji.png');
await shot('hud', '07-hud.png');

// ---- 手机 390×844 ----
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const shotMobile = (screen, file, opts) =>
  captureOnce(mobile, `${BASE}?clean=1&screen=${screen}&touch=1`, file, opts);
await shotMobile('intro', '10-mobile-intro.png', { wait: 900 });
await shotMobile('dialogue', '11-mobile-dialogue.png', { wait: 1500, dialogue: true });
await shotMobile('checklist', '12-mobile-checklist.png');
await shotMobile('touch', '13-mobile-touch.png');

// ---- 其他常见尺寸，防止 UI 挤坏（不要求完美） ----
const wide = { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 };
await captureOnce(wide, `${BASE}?clean=1&screen=dialogue`, '20-1920-dialogue.png', { wait: 1200, dialogue: true });
await captureOnce(wide, `${BASE}?clean=1&screen=intro`, '21-1920-intro.png');


await browser.close();

if (errors.length) {
  console.log('\n⚠️ 浏览器报错：');
  for (const err of [...new Set(errors)]) console.log(' -', err);
  process.exitCode = 1;
} else {
  console.log('\n没有浏览器报错。');
}
