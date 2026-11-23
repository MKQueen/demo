// Pick ground directions for hand-chosen screen pixels in the region map views.
//
//   node tools/beijing/picks.mjs [baseUrl]
import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';

const BASE = (process.argv[2] || 'http://127.0.0.1:5190').replace(/\/$/, '');

const REGIONS = {
  village: [20.3565, 19.1747, 2.20046],
  city: [26.2539, 9.70977, 1.39919],
  countryside: [-8.91062, -21.1061, 0.906382],
  mountain: [-8.17226, 32.3472, -1.76941],
  harbor: [15.8793, 16.9006, 11.2543],
  spawn: [5.81095, 5.80205, 25.7794],
};
const VIEWS = { wide: { dist: 34, fov: 52 }, mid: { dist: 22, fov: 55 } };
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };

// screen pixels are in the 1100x800 map screenshot space
const PICKS = [
  ['hutong-a', 'spawn', 'mid', 235, 352],
  ['hutong-b', 'spawn', 'mid', 300, 420],
  ['hutong-c', 'spawn', 'wide', 293, 293],
  ['hutong-d', 'spawn', 'wide', 380, 330],
  ['axis-a', 'countryside', 'mid', 492, 504],
  ['axis-b', 'countryside', 'mid', 352, 586],
  ['axis-c', 'countryside', 'wide', 504, 352],
  ['axis-d', 'countryside', 'wide', 380, 460],
  ['cbd-a', 'city', 'mid', 550, 400],
  ['cbd-b', 'city', 'mid', 560, 430],
  ['cbd-c', 'city', 'wide', 550, 400],
  ['wall-a', 'mountain', 'mid', 938, 410],
  ['wall-b', 'mountain', 'mid', 800, 150],
  ['wall-c', 'mountain', 'wide', 900, 300],
  ['axis-mtn-a', 'mountain', 'mid', 352, 352],
  ['axis-mtn-b', 'mountain', 'mid', 300, 420],
  ['axis-mtn-c', 'mountain', 'wide', 380, 360],
  ['wall-mesa-a', 'mountain', 'mid', 903, 129],
  ['wall-mesa-b', 'mountain', 'mid', 860, 250],
  ['wall-mesa-c', 'mountain', 'mid', 940, 350],
  ['wall-cliff-a', 'village', 'wide', 704, 70],
  ['wall-cliff-b', 'village', 'mid', 600, 30],
  ['axis-cs-a', 'countryside', 'mid', 293, 563],
  ['axis-cs-b', 'countryside', 'mid', 704, 563],
  ['axis-cs-c', 'countryside', 'wide', 293, 176],
];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
page.on('pageerror', (error) => console.log('  [pageerror]', error.message.slice(0, 300)));
await page.goto(`${BASE}/tools/beijing/test.html?mode=probe&freeze=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 240000 });
if (await page.evaluate(() => window.__error)) { console.error(await page.evaluate(() => window.__error)); process.exit(1); }

async function setRegionView(region, viewId) {
  const dir = norm(REGIONS[region]);
  const view = VIEWS[viewId];
  await page.evaluate(({ dir, dist, fov }) => {
    const T = window.__app.THREE;
    const up = new T.Vector3(...dir);
    const ref = Math.abs(up.y) > 0.9 ? new T.Vector3(0, 0, 1) : new T.Vector3(0, 1, 0);
    const right = new T.Vector3().crossVectors(ref, up).normalize();
    const fwd = new T.Vector3().crossVectors(up, right).normalize();
    const ground = window.__app.groundAt(dir);
    const target = new T.Vector3(...ground.point);
    const camPos = target.clone().addScaledVector(up, dist).addScaledVector(fwd, -2);
    window.__app.setCamera({ position: camPos.toArray(), target: target.toArray(), fov, up: fwd.toArray() });
  }, { dir, dist: view.dist, fov: view.fov });
}

for (const [name, region, viewId, px, py] of PICKS) {
  await setRegionView(region, viewId);
  const hit = await page.evaluate(({ px, py }) => window.__app.pick(px, py), { px, py });
  console.log(name, region, viewId, `px=${px},${py}`, hit ? `dir=[${hit.dir.join(',')}] r=${hit.radius} normal=[${hit.normal.join(',')}]` : 'MISS');
}

await browser.close();
