// Whole-planet top-down map (fog disabled) used to pick empty areas to host the
// Beijing districts. Also queries directions for chosen screen pixels.
//
//   node tools/beijing/mapall.mjs [baseUrl]
import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const BASE = (process.argv[2] || 'http://127.0.0.1:5190').replace(/\/$/, '');
const OUT = '/tmp/dsh-beijing/recon';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
page.on('pageerror', (error) => console.log('  [pageerror]', error.message.slice(0, 300)));
await page.goto(`${BASE}/tools/beijing/test.html?mode=probe&freeze=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 240000 });
if (await page.evaluate(() => window.__error)) { console.error(await page.evaluate(() => window.__error)); process.exit(1); }

await page.evaluate(() => {
  window.__app.setFog(false);
  window.__app.setCamera({ position: [0, 86, 0.001], target: [0, 0, 0], fov: 42, up: [0, 0, 1] });
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/planet-top.png` });
console.log('saved planet-top.png');

// second angle: from the -X side, tilted down (shows the western hemisphere)
await page.evaluate(() => {
  window.__app.setCamera({ position: [-70, 40, 40], target: [0, 0, 0], fov: 45 });
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/planet-side-x.png` });
await page.evaluate(() => {
  window.__app.setCamera({ position: [40, 40, -70], target: [0, 0, 0], fov: 45 });
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/planet-side-z.png` });
console.log('saved side views');

// pixel -> direction picks passed as "name=x,y;name2=x,y"
const picks = (process.argv[3] || '').split(';').filter(Boolean);
for (const entry of picks) {
  const [name, coords] = entry.split('=');
  const [px, py] = coords.split(',').map(Number);
  const hit = await page.evaluate(({ px, py }) => window.__app.pick(px, py), { px, py });
  console.log(name, JSON.stringify(hit));
}

await browser.close();
