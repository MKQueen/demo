import { chromium } from 'playwright';
import fs from 'fs';
const OUT = '/Users/one/AI/demo/apps/flood-sim/docs/research/raw';
const browser = await chromium.launch({ headless: false, channel: 'chrome', args: ['--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, locale: 'en-US' });
await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
const page = await ctx.newPage();
const resp = await page.goto('https://www.shadertoy.com/view/Ms2SD1', { waitUntil: 'domcontentloaded', timeout: 120000 });
console.log('status', resp && resp.status(), 'title', await page.title());
// wait up to 60s for either CF challenge to clear or content
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(2000);
  const t = await page.title();
  if (!/just a moment|attention required/i.test(t)) { console.log('cleared at', i*2, 's title:', t); break; }
  if (i % 5 === 0) console.log('still waiting', i*2, t);
}
console.log('final title:', await page.title());
console.log('url:', page.url());
const html = await page.content();
fs.writeFileSync(`${OUT}/shadertoy-headful.html`, html);
console.log('bytes', html.length);
const info = await page.evaluate(() => ({
  textareas: [...document.querySelectorAll('textarea')].map(e => ({ id: e.id, cls: e.className, len: (e.value||'').length })),
  bodyText: document.body.innerText.slice(0, 800),
  scripts: [...document.querySelectorAll('script')].map(s => (s.textContent||'').length).filter(n=>n>300),
}));
console.log(JSON.stringify(info, null, 2).slice(0, 2500));
await page.screenshot({ path: `${OUT}/shadertoy-headful.png`, fullPage: false });
await browser.close();
