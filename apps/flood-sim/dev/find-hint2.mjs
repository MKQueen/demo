import { chromium } from 'playwright';
const BASE = process.env.PROD_URL ?? 'http://127.0.0.1:5321/';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__floodReady === true, null, { timeout: 120000 });
await page.waitForTimeout(1200);
const out = await page.evaluate(() => {
  const el = document.elementFromPoint(150, 105);
  const chain = [];
  let cur = el;
  while (cur && chain.length < 10) { chain.push(`${cur.tagName}.${String(cur.className || '').replace(/\s+/g, '.')}${cur.id ? '#' + cur.id : ''}`); cur = cur.parentElement; }
  const html = el ? el.outerHTML.slice(0, 200) : null;
  // 也列出所有 fixed/absolute 且覆盖视口的元素
  const overlays = Array.from(document.querySelectorAll('*')).filter((e) => {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return (cs.position === 'fixed' || cs.position === 'absolute') && r.width > 200 && r.height > 60 && cs.display !== 'none';
  }).slice(0, 12).map((e) => `${e.tagName}.${String(e.className||'').replace(/\s+/g,'.')} r=${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)} z=${getComputedStyle(e).zIndex}`);
  return { chain, html, overlays };
});
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
await browser.close();
