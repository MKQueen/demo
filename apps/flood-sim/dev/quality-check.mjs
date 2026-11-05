import { chromium } from 'playwright';
const BASE = process.env.PROD_URL ?? 'http://127.0.0.1:5321/';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__floodReady === true, null, { timeout: 120000 });
await page.evaluate(() => { window.__floodStore.loading.visible = false; });
await page.waitForTimeout(1500);
const seq = ['medium','low','high','low','medium'];
for (const q of seq) {
  await page.evaluate((qq) => { window.__floodStore.quality = qq; }, q);
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => ({ q: window.__floodStore.quality, fps: window.__floodStore.fps }));
  console.log('quality ->', st.q, 'fps=', st.fps);
}
// 水位快速扫一遍
for (const lv of [0, 2.5, 8, 15, 24]) {
  await page.evaluate((v) => { window.__floodStore.targetLevel = v; window.__floodStore.waterLevel = v; }, lv);
  await page.waitForTimeout(500);
}
console.log('quality/level console errors:', errors.length, errors.slice(0,3));
await browser.close();
