// One-off reconnaissance: loads the game planet in the Beijing harness, probes
// the ground height around the candidate district centres and saves overview /
// close-up screenshots used to pick the placement areas.
//
//   node tools/beijing/recon.mjs [baseUrl]
import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:5190').replace(/\/$/, '');
const APP_DIR = new URL('../..', import.meta.url).pathname;
const OUT_DIR = '/tmp/dsh-beijing/recon';
fs.mkdirSync(OUT_DIR, { recursive: true });

const CANDIDATES = {
  spawn: [5.81095, 5.80205, 25.7794],
  harbor: [15.8793, 16.9006, 11.2543],
  village: [20.3565, 19.1747, 2.20046],
  city: [26.2539, 9.70977, 1.39919],
  countryside: [-8.91062, -21.1061, 0.906382],
  mountain: [-8.17226, 32.3472, -1.76941],
};

const norm = (v) => {
  const len = Math.hypot(...v);
  return v.map((x) => x / len);
};

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (error) => console.log('  [pageerror]', error.message.slice(0, 400)));
page.on('console', (message) => {
  if (message.type() === 'error') console.log('  [console]', message.text().slice(0, 400));
});
page.on('response', (res) => {
  if (res.status() >= 400) console.log('  [http]', res.status(), res.url());
});

const shot = async (name) => {
  await page.waitForTimeout(150);
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file });
  console.log('  saved', path.relative(APP_DIR, file));
};

console.log('loading probe harness…');
await page.goto(`${BASE}/tools/beijing/test.html?mode=probe`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 240000 });
const error = await page.evaluate(() => window.__error);
if (error) { console.error(error); process.exit(1); }
await page.evaluate(() => window.__app.freeze(true));
console.log('planet ready');

// -------------------------------------------------------------- overview
const RADIUS = 33;
const views = [
  ['overview-a.png', [RADIUS * 2.1, RADIUS * 0.9, RADIUS * 1.7], [0, 0, 0]],
  ['overview-b.png', [-RADIUS * 2.0, RADIUS * 0.5, RADIUS * 1.6], [0, 0, 0]],
  ['overview-c.png', [RADIUS * 0.4, RADIUS * 2.2, RADIUS * 0.6], [0, 0, 0]],
  ['overview-d.png', [RADIUS * 0.2, -RADIUS * 2.3, -RADIUS * 0.4], [0, 0, 0]],
];
for (const [name, position, target] of views) {
  await page.evaluate(({ position, target }) => window.__app.setCamera({ position, target, fov: 42 }), { position, target });
  await shot(name);
}

// -------------------------------------------------------------- close-ups
const regionAngles = [
  ['a', [1, 0, 0]],
  ['b', [0, 1, 0]],
  ['c', [0, 0, 1]],
];
for (const [key, raw] of Object.entries(CANDIDATES)) {
  const n = norm(raw);
  const ground = await page.evaluate((normal) => window.__app.groundAt(normal), n);
  for (const [suffix, tangentRaw] of regionAngles) {
    await page.evaluate(({ n: normal, tangentRaw: tangent, point }) => {
      const T = window.__app.THREE;
      const up = new T.Vector3(...normal);
      const t = new T.Vector3(...tangent).addScaledVector(up, -new T.Vector3(...tangent).dot(up)).normalize();
      const p = new T.Vector3(...point);
      const camPos = p.clone().addScaledVector(up, 3.4).addScaledVector(t, 7.5);
      const target = p.clone().addScaledVector(up, 1.2);
      window.__app.setCamera({ position: camPos.toArray(), target: target.toArray(), fov: 55 });
    }, { n, tangentRaw, point: ground.point });
    await shot(`${key}-${suffix}.png`);
  }
}

// -------------------------------------------------------------- probes
const probes = {};
for (const [key, raw] of Object.entries(CANDIDATES)) {
  const n = norm(raw);
  probes[key] = await page.evaluate((normal) => window.__app.probeGrid({ center: normal, size: 8, steps: 17 }), n);
}
fs.writeFileSync(path.join(OUT_DIR, 'probe.json'), JSON.stringify(probes, null, 2));
console.log('probe.json written');

await browser.close();
