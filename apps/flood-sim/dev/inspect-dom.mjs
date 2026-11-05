import { chromium } from 'playwright';
const BASE = process.env.PROD_URL ?? 'http://127.0.0.1:5321/';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__floodReady === true, null, { timeout: 120000 });
await page.waitForTimeout(800);
const out = await page.evaluate(() => {
  const res = [];
  const walk = (el, depth) => {
    if (depth > 3) return;
    res.push({ tag: el.tagName, cls: el.className && String(el.className).slice(0, 60), id: el.id, children: el.children.length, rect: (() => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })() });
    Array.from(el.children).forEach((c) => walk(c, depth + 1));
  };
  walk(document.getElementById('app'), 0);
  return res;
});
for (const r of out) if (r.rect && r.rect[2] > 100) console.log(JSON.stringify(r));
await browser.close();
