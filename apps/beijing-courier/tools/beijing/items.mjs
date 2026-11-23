// Debug: render every asset builder in isolation (single-asset mode) and save
// screenshots to /tmp/dsh-beijing/items for quick visual inspection.
//
//   node tools/beijing/items.mjs [baseUrl] [keys,csv]
import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const BASE = (process.argv[2] || 'http://127.0.0.1:5190').replace(/\/$/, '');
const OUT = '/tmp/dsh-beijing/items';
fs.mkdirSync(OUT, { recursive: true });

const ALL = ['courtyard', 'courtyard2', 'shop', 'breakfast', 'sign', 'mailbox', 'bike', 'lion',
  'tree', 'laundry', 'gulou', 'temple', 'citic', 'cctv', 'nest', 'factory', 'lanterns'];
const keys = process.argv[3] ? process.argv[3].split(',') : ALL;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
page.on('pageerror', (error) => console.log('  [pageerror]', error.message.slice(0, 400)));
page.on('console', (message) => {
  if (message.type() === 'error') console.log('  [console]', message.text().slice(0, 400));
});
await page.goto(`${BASE}/tools/beijing/test.html?mode=single&key=courtyard&freeze=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 240000 });
const error = await page.evaluate(() => window.__error);
if (error) { console.error(error); process.exit(1); }
await page.evaluate(() => window.__app.freeze(true));

const CAMERAS = {
  courtyard: { position: [8.2, 5.2, 11.2], target: [0, 1.4, 0], fov: 42 },
  courtyard2: { position: [7.4, 4.6, 10.2], target: [0, 1.3, 0], fov: 42 },
  shop: { position: [6.2, 3.4, 8.4], target: [0, 1.5, 0], fov: 42 },
  breakfast: { position: [6.6, 3.6, 8.8], target: [0, 1.4, 0], fov: 42 },
  sign: { position: [3.6, 2.6, 5.0], target: [0, 1.5, 0], fov: 44 },
  mailbox: { position: [2.6, 1.9, 3.8], target: [0, 0.8, 0], fov: 44 },
  bike: { position: [3.2, 2.2, 4.4], target: [0, 0.6, 0], fov: 44 },
  lion: { position: [2.8, 2.0, 3.8], target: [0, 0.7, 0], fov: 44 },
  tree: { position: [7.0, 5.0, 9.0], target: [0, 2.2, 0], fov: 42 },
  laundry: { position: [4.6, 2.6, 6.0], target: [0, 1.3, 0], fov: 44 },
  gulou: { position: [11.0, 6.4, 14.0], target: [0, 3.0, 0], fov: 42 },
  temple: { position: [10.5, 5.6, 13.0], target: [0, 2.8, 0], fov: 42 },
  citic: { position: [12.0, 7.4, 17.0], target: [0, 4.6, 0], fov: 42 },
  cctv: { position: [10.0, 4.6, 13.0], target: [0, 2.6, 0], fov: 42 },
  nest: { position: [7.2, 3.4, 9.6], target: [0, 1.0, 0], fov: 44 },
  factory: { position: [9.0, 4.6, 12.0], target: [0, 2.4, 0], fov: 42 },
  lanterns: { position: [4.4, 3.0, 5.6], target: [0, 1.2, 0], fov: 44 },
};
for (const key of keys) {
  await page.evaluate(async ({ key, cam }) => {
    await window.__app.setAsset(key);
    const { camera } = window.__app;
    camera.up.set(0, 1, 0);
    camera.position.set(...cam.position);
    camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);
    camera.fov = cam.fov;
    camera.updateProjectionMatrix();
    window.__app.renderOnce();
  }, { key, cam: CAMERAS[key] || { position: [6, 3.5, 8], target: [0, 1.2, 0], fov: 42 } });
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${OUT}/item-${key}.png` });
  console.log('  saved', `item-${key}.png`);
}

await browser.close();
