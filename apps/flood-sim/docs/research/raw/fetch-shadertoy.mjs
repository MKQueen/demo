import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUT = '/Users/one/AI/demo/apps/flood-sim/docs/research/raw';
fs.mkdirSync(OUT, { recursive: true });

const targets = [
  { name: 'view', url: 'https://www.shadertoy.com/view/Ms2SD1' },
  { name: 'embed', url: 'https://www.shadertoy.com/embed/Ms2SD1?gui=false&t=10' },
];

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
});
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  viewport: { width: 1600, height: 900 },
  locale: 'en-US',
});
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
});

for (const t of targets) {
  const page = await ctx.newPage();
  const reqs = [];
  page.on('response', async (r) => {
    const u = r.url();
    if (/shadertoy\.com\/(shadertoy|api|view|embed|ajax|json)/i.test(u) || /\.json/i.test(u)) {
      reqs.push({ url: u, status: r.status(), ct: r.headers()['content-type'] || '' });
    }
  });
  try {
    console.log(`\n=== ${t.name} : ${t.url} ===`);
    const resp = await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    console.log('status', resp && resp.status());
    await page.waitForTimeout(9000);
    const title = await page.title();
    console.log('title:', title);
    const html = await page.content();
    fs.writeFileSync(path.join(OUT, `shadertoy-${t.name}.html`), html);
    console.log('html bytes:', html.length);

    const info = await page.evaluate(() => {
      const res = {};
      res.textareas = [...document.querySelectorAll('textarea')].map(e => ({ id: e.id, cls: e.className, len: (e.value||'').length, head: (e.value||'').slice(0,120) }));
      res.aces = [...document.querySelectorAll('.ace_editor, .ace_text-layer, [id*=shader], [class*=shader]')].slice(0,40).map(e => ({ tag: e.tagName, id: e.id, cls: String(e.className).slice(0,100), len: (e.textContent||'').length }));
      const scripts = [...document.querySelectorAll('script')].map(s => s.textContent || '').filter(s => s.length > 200);
      res.scriptLens = scripts.map(s => s.length);
      res.hasVoidMain = scripts.filter(s => s.includes('void main')).length;
      res.bodyText = (document.body.innerText || '').slice(0, 1500);
      // look for globals
      res.globals = Object.keys(window).filter(k => /shader|Shader|effect|Effect|data|Data|g_/.test(k)).slice(0, 60);
      return res;
    });
    console.log(JSON.stringify(info, null, 2).slice(0, 4000));
    console.log('--- interesting requests ---');
    console.log(JSON.stringify(reqs.slice(0, 40), null, 2));
    await page.screenshot({ path: path.join(OUT, `shadertoy-${t.name}.png`) });
  } catch (e) {
    console.log('ERROR', t.name, e.message);
  }
  await page.close();
}
await browser.close();
