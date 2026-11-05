import { chromium } from 'playwright';
import fs from 'fs';
const OUT = '/Users/one/AI/demo/apps/flood-sim/docs/research/raw';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const hits = [];
page.on('response', async (r) => {
  const u = r.url();
  try {
    const ct = r.headers()['content-type'] || '';
    if (/json|javascript|text\/plain/.test(ct) && !/\.js$/.test(u)) {
      const body = await r.text().catch(() => '');
      if (/void main|fragmentShader|Ms2SD1|gl_FragColor/.test(body)) {
        hits.push({ url: u, ct, len: body.length, body });
        console.log('HIT', u, body.length);
      } else {
        console.log('resp', r.status(), u.slice(0, 120), ct, body.length);
      }
    }
  } catch {}
});
await page.goto('https://editor.isf.video/shaders/6769241c2909a9001a007182', { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(8000);
console.log('title:', await page.title());
console.log('body text head:', (await page.evaluate(() => document.body.innerText)).slice(0, 1200));
const val = await page.evaluate(() => {
  const ta = [...document.querySelectorAll('textarea')];
  return ta.map(e => ({ id: e.id, cls: e.className, len: (e.value || '').length, head: (e.value||'').slice(0, 200) }));
});
console.log('textareas', JSON.stringify(val, null, 2).slice(0, 2000));
fs.writeFileSync(`${OUT}/isf-page.html`, await page.content());
fs.writeFileSync(`${OUT}/isf-hits.json`, JSON.stringify(hits, null, 2));
console.log('hits:', hits.length);
for (const h of hits) console.log('==', h.url, h.len, '\n', h.body.slice(0, 300));
await page.screenshot({ path: `${OUT}/isf.png` });
await browser.close();
