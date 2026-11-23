// Terrain probe only: dumps ground heights around candidate district centres.
//   node tools/beijing/probe.mjs [baseUrl]
import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:5190').replace(/\/$/, '');
const APP_DIR = new URL('../..', import.meta.url).pathname;
const OUT = '/tmp/dsh-beijing/recon';
fs.mkdirSync(OUT, { recursive: true });

const CANDIDATES = {
  spawn: [5.81095, 5.80205, 25.7794],
  harbor: [15.8793, 16.9006, 11.2543],
  village: [20.3565, 19.1747, 2.20046],
  city: [26.2539, 9.70977, 1.39919],
  countryside: [-8.91062, -21.1061, 0.906382],
  mountain: [-8.17226, 32.3472, -1.76941],
  // offsets around the dense area to find open flat ground
  villageEast: [24.0, 17.0, 2.5],
  villageNorth: [19.0, 22.0, 3.0],
  cityNorth: [24.5, 13.0, 3.0],
  cityEast: [27.5, 6.0, 2.5],
  countrysideNorth: [-8.0, -21.5, 6.0],
  countrySouth: [-9.0, -18.0, 4.0],
  mountainRidge: [-9.5, 30.0, -2.5],
  northPole: [0, 33, 0],
  southPole: [0, -30, 0],
};

const norm = (v) => {
  const len = Math.hypot(...v);
  return v.map((x) => x / len);
};

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.on('pageerror', (error) => console.log('  [pageerror]', error.message.slice(0, 400)));
page.on('console', (message) => {
  if (message.type() === 'error') console.log('  [console]', message.text().slice(0, 400));
});

await page.goto(`${BASE}/tools/beijing/test.html?mode=probe&freeze=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 240000 });
const error = await page.evaluate(() => window.__error);
if (error) { console.error(error); process.exit(1); }

const probes = {};
for (const [key, raw] of Object.entries(CANDIDATES)) {
  const n = norm(raw);
  probes[key] = await page.evaluate((normal) => window.__app.probeGrid({ center: normal, size: 8, steps: 17 }), n);
  const p = probes[key];
  console.log(key, 'relief', p.relief, 'min', p.min.toFixed(2), 'max', p.max.toFixed(2));
}

fs.writeFileSync(path.join(OUT, 'probe.json'), JSON.stringify(probes, null, 2));
console.log('written', path.relative(APP_DIR, path.join(OUT, 'probe.json')));
await browser.close();
