// Land finder: classifies the rendered top-down view of the planet and lists
// large smooth grass/stone patches (candidate district sites), then screenshots
// the best ones.
//
//   node tools/beijing/findland.mjs [baseUrl]
import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:5190').replace(/\/$/, '');
const APP_DIR = new URL('../..', import.meta.url).pathname;
const OUT = '/tmp/dsh-beijing/recon';
fs.mkdirSync(OUT, { recursive: true });

const VIEWS = {
  spawn: [5.81095, 5.80205, 25.7794],
  village: [20.3565, 19.1747, 2.20046],
  city: [26.2539, 9.70977, 1.39919],
  countryside: [-8.91062, -21.1061, 0.906382],
  mountain: [-8.17226, 32.3472, -1.76941],
  harbor: [15.8793, 16.9006, 11.2543],
  west: [-30, 6, 4],
  east: [30, -6, 4],
  north: [0, 30, -6],
  south: [0, -28, 4],
};
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
page.on('pageerror', (error) => console.log('  [pageerror]', error.message.slice(0, 300)));
await page.goto(`${BASE}/tools/beijing/test.html?mode=probe&freeze=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 240000 });
if (await page.evaluate(() => window.__error)) { console.error(await page.evaluate(() => window.__error)); process.exit(1); }

const all = {};
for (const [key, raw] of Object.entries(VIEWS)) {
  const center = norm(raw);
  const scan = await page.evaluate(({ center, distance, fov }) => window.__app.scanLand({ center, distance, fov, step: 4, minArea: 260 }), { center, distance: 34, fov: 58 });
  all[key] = scan;
  const grass = (scan.grass || []).filter((g) => g.smooth >= 0.65 && g.meanRadius > 23 && g.spread < 4);
  console.log(`\n== ${key}: ${grass.length} smooth grass patches`);
  for (const [i, g] of grass.slice(0, 6).entries()) {
    console.log(`  g#${i} area=${g.area} smooth=${g.smooth} r=${g.meanRadius} spread=${g.spread} dir=[${g.dir.join(',')}]`);
  }
  const grey = (scan.grey || []).filter((g) => g.smooth >= 0.65);
  for (const [i, g] of grey.slice(0, 4).entries()) {
    console.log(`  grey#${i} area=${g.area} smooth=${g.smooth} r=${g.meanRadius} dir=[${g.dir.join(',')}]`);
  }
}
fs.writeFileSync(path.join(OUT, 'land.json'), JSON.stringify(all, null, 2));

// screenshots of the best grass patches
const candidates = [];
for (const [key, scan] of Object.entries(all)) {
  for (const g of (scan.grass || [])) {
    if (g.smooth < 0.7 || g.meanRadius < 23 || g.spread > 3.5) continue;
    candidates.push({ key, ...g });
  }
}
candidates.sort((a, b) => b.area * b.smooth - a.area * a.smooth);
console.log('\nbest grass candidates:');
for (const [i, c] of candidates.slice(0, 12).entries()) {
  console.log(`  #${i} ${c.key} area=${c.area} smooth=${c.smooth} r=${c.meanRadius} dir=[${c.dir.join(',')}]`);
}

for (const [i, c] of candidates.slice(0, 10).entries()) {
  await page.evaluate((dir) => {
    const T = window.__app.THREE;
    const up = new T.Vector3(...dir);
    const ref = Math.abs(up.y) > 0.95 ? new T.Vector3(0, 0, 1) : new T.Vector3(0, 1, 0);
    const right = new T.Vector3().crossVectors(ref, up).normalize();
    const fwd = new T.Vector3().crossVectors(up, right).normalize();
    const ground = window.__app.groundAt(dir);
    const target = new T.Vector3(...ground.point);
    const camPos = target.clone().addScaledVector(up, 16).addScaledVector(fwd, -6);
    window.__app.setCamera({ position: camPos.toArray(), target: target.toArray(), fov: 52, up: fwd.toArray() });
  }, c.dir);
  await page.waitForTimeout(160);
  const file = path.join(OUT, `land-${i}.png`);
  await page.screenshot({ path: file });
  console.log('  saved', path.relative(APP_DIR, file), `${c.key} [${c.dir.join(',')}]`);
}

await browser.close();
