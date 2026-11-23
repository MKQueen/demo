// Map views: top-down screenshots around the existing NPC regions so an open
// patch of terrain can be picked for each Beijing district.
//
//   node tools/beijing/maps.mjs [baseUrl]
import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:5190').replace(/\/$/, '');
const APP_DIR = new URL('../..', import.meta.url).pathname;
const OUT = '/tmp/dsh-beijing/recon';
fs.mkdirSync(OUT, { recursive: true });

const REGIONS = {
  village: [20.3565, 19.1747, 2.20046],
  city: [26.2539, 9.70977, 1.39919],
  countryside: [-8.91062, -21.1061, 0.906382],
  mountain: [-8.17226, 32.3472, -1.76941],
  harbor: [15.8793, 16.9006, 11.2543],
  spawn: [5.81095, 5.80205, 25.7794],
};
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.on('pageerror', (error) => console.log('  [pageerror]', error.message.slice(0, 300)));
await page.goto(`${BASE}/tools/beijing/test.html?mode=probe&freeze=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 240000 });
if (await page.evaluate(() => window.__error)) { console.error(await page.evaluate(() => window.__error)); process.exit(1); }

const views = [
  { id: 'wide', dist: 34, fov: 52 },
  { id: 'mid', dist: 22, fov: 55 },
];
for (const [key, raw] of Object.entries(REGIONS)) {
  const n = norm(raw);
  for (const view of views) {
    await page.evaluate(({ dir, dist, fov }) => {
      const T = window.__app.THREE;
      const up = new T.Vector3(...dir);
      const ref = Math.abs(up.y) > 0.9 ? new T.Vector3(0, 0, 1) : new T.Vector3(0, 1, 0);
      const right = new T.Vector3().crossVectors(ref, up).normalize();
      const fwd = new T.Vector3().crossVectors(up, right).normalize();
      const ground = window.__app.groundAt(dir);
      const camPos = new T.Vector3(...ground.point).addScaledVector(up, dist).addScaledVector(fwd, -2);
      window.__app.setCamera({ position: camPos.toArray(), target: new T.Vector3(...ground.point).toArray(), fov });
    }, { dir: n, dist: view.dist, fov: view.fov });
    await page.waitForTimeout(160);
    const file = path.join(OUT, `map-${key}-${view.id}.png`);
    await page.screenshot({ path: file });
    console.log('  saved', path.relative(APP_DIR, file));
  }
}
await browser.close();
