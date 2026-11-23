// Inspect hand-picked candidate district sites: top-down + street views plus a
// height probe so the terrace dimensions can be planned.
//
//   node tools/beijing/inspect.mjs [baseUrl]
import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const BASE = (process.argv[2] || 'http://127.0.0.1:5190').replace(/\/$/, '');
const OUT = '/tmp/dsh-beijing/recon';
fs.mkdirSync(OUT, { recursive: true });

const SITES = {
  'hutong-a': [-0.1551, 0.2591, 0.9533],
  'axis-mtn-a': [-0.0493, 0.9988, 0.0022],
  'wall-mesa-a': [-0.5035, 0.8481, 0.1648],
  'wall-mesa-b': [-0.5361, 0.8368, 0.1113],
  'wall-cliff-a': [0.0037, 0.9477, -0.3191],
};

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
page.on('pageerror', (error) => console.log('  [pageerror]', error.message.slice(0, 300)));
await page.goto(`${BASE}/tools/beijing/test.html?mode=probe&freeze=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 240000 });
if (await page.evaluate(() => window.__error)) { console.error(await page.evaluate(() => window.__error)); process.exit(1); }

const probes = {};
for (const [name, raw] of Object.entries(SITES)) {
  const dir = raw;
  const probe = await page.evaluate(({ dir }) => window.__app.probeGrid({ center: dir, size: 7, steps: 15 }), { dir });
  probes[name] = probe;
  const ground = await page.evaluate((dir) => window.__app.groundAt(dir), dir);
  const heights = probe.rows.flat().filter((v) => v != null);
  console.log(`${name} r=${ground.radius.toFixed(2)} relief=${probe.relief.toFixed(2)} min=${probe.min.toFixed(2)} max=${probe.max.toFixed(2)}`);

  // top-down
  await page.evaluate(({ dir, point }) => {
    const T = window.__app.THREE;
    const up = new T.Vector3(...dir);
    const ref = Math.abs(up.y) > 0.95 ? new T.Vector3(0, 0, 1) : new T.Vector3(0, 1, 0);
    const right = new T.Vector3().crossVectors(ref, up).normalize();
    const fwd = new T.Vector3().crossVectors(up, right).normalize();
    const target = new T.Vector3(...point);
    const camPos = target.clone().addScaledVector(up, 15).addScaledVector(fwd, -4);
    window.__app.setCamera({ position: camPos.toArray(), target: target.toArray(), fov: 55, up: fwd.toArray() });
  }, { dir, point: ground.point });
  await page.waitForTimeout(180);
  await page.screenshot({ path: `${OUT}/site-${name}-top.png` });

  // street view
  await page.evaluate(({ dir, point }) => {
    const T = window.__app.THREE;
    const up = new T.Vector3(...dir);
    const ref = Math.abs(up.y) > 0.95 ? new T.Vector3(0, 0, 1) : new T.Vector3(0, 1, 0);
    const right = new T.Vector3().crossVectors(ref, up).normalize();
    const fwd = new T.Vector3().crossVectors(up, right).normalize();
    const target = new T.Vector3(...point).addScaledVector(up, 1.4);
    const camPos = target.clone().addScaledVector(up, 1.1).addScaledVector(fwd, -8).addScaledVector(right, 1.5);
    window.__app.setCamera({ position: camPos.toArray(), target: target.toArray(), fov: 55, up: up.toArray() });
  }, { dir, point: ground.point });
  await page.waitForTimeout(180);
  await page.screenshot({ path: `${OUT}/site-${name}-street.png` });
  console.log('  saved', name);
}

fs.writeFileSync(`${OUT}/site-probes.json`, JSON.stringify(probes, null, 2));
await browser.close();
