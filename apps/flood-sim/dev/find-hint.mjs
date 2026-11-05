import { chromium } from 'playwright';
const BASE = process.env.PROD_URL ?? 'http://127.0.0.1:5321/';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__floodReady === true, null, { timeout: 120000 });
await page.waitForTimeout(1200);
const out = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('*'));
  const hit = all.filter((el) => (el.textContent || '').includes('操作提示') && el.children.length < 12);
  return hit.slice(-6).map((el) => {
    const chain = [];
    let cur = el;
    while (cur && chain.length < 8) { chain.push(`${cur.tagName}.${String(cur.className || '').replace(/\s+/g, '.')}${cur.id ? '#' + cur.id : ''}`); cur = cur.parentElement; }
    const r = el.getBoundingClientRect();
    return { chain, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], display: getComputedStyle(el).display };
  });
});
console.log(JSON.stringify(out, null, 1).slice(0, 3000));
await browser.close();
