// Playwright screenshots for the procedural Beijing asset pack.
//
//   node tools/beijing/shots.mjs [baseUrl]
//
// Writes into screenshots/beijing/:
//   00-asset-gallery.png      资产陈列（全部自建资产）
//   01-hutong-street.png      胡同区街景
//   02-hutong-aerial.png      胡同区鸟瞰
//   03-axis-street.png        中轴区（鼓楼+天坛）
//   04-axis-temple.png        天坛祈年殿
//   05-cbd-street.png         CBD 街景
//   06-cbd-aerial.png         CBD 鸟瞰
//   07-great-wall-ridge.png   山脊长城
//   08-great-wall-aerial.png  长城鸟瞰
//   09-district-overview.png  三个片区 + 长城全景（远景）
//   report.json               渲染信息 / draw calls / 三角面
//
// Intermediate writes go to /tmp so the Vite dev server doesn't hot-reload the
// page while the screenshots are taken.
import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:5190').replace(/\/$/, '');
const APP_DIR = new URL('../..', import.meta.url).pathname;
const TMP = '/tmp/dsh-beijing/shots';
const OUT = path.join(APP_DIR, 'screenshots/beijing');
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const report = { baseUrl: BASE, startedAt: new Date().toISOString(), screenshots: [], renders: {}, info: {} };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (error) => console.log('  [pageerror]', error.message.slice(0, 500)));
page.on('console', (message) => {
  if (message.type() === 'error') console.log('  [console]', message.text().slice(0, 400));
  if (message.text().startsWith('[beijing]')) console.log('  [beijing]', message.text().slice(0, 500));
});

async function capture(name) {
  await page.waitForTimeout(220);
  const tmpFile = path.join(TMP, name);
  await page.screenshot({ path: tmpFile });
  report.screenshots.push(name);
  console.log('  saved', name);
}

async function open(url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 240000 });
  const error = await page.evaluate(() => window.__error);
  if (error) throw new Error(error.slice(0, 1500));
  await page.evaluate(() => window.__app.freeze(true));
}

// -------------------------------------------------------------- asset gallery
console.log('[1/2] asset gallery');
await open(`${BASE}/tools/beijing/test.html?mode=gallery&freeze=1`);
await page.waitForTimeout(600);
await page.evaluate(() => {
  const { camera, THREE } = window.__app;
  camera.up.set(0, 1, 0);
  camera.position.set(0.4, 13.5, 19.0);
  camera.lookAt(0, 0.6, 0);
  camera.fov = 48;
  camera.updateProjectionMatrix();
  window.__app.renderOnce();
});
await capture('00-asset-gallery.png');
report.info.gallery = await page.evaluate(() => {
  window.__app.renderOnce();
  return {
    items: window.__app.beijing.items.map((item) => item.name),
    stats: window.__app.sceneStats(),
  };
});

// -------------------------------------------------------------- districts
console.log('[2/2] districts');
await page.goto(`${BASE}/tools/beijing/test.html?mode=scene&district=hutong&freeze=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 240000 });
const sceneError = await page.evaluate(() => window.__error);
if (sceneError) throw new Error(sceneError.slice(0, 2000));
await page.evaluate(() => window.__app.freeze(true));
await page.waitForTimeout(500);

report.info.scene = await page.evaluate(() => ({
  stats: window.__app.sceneStats(),
  landmarks: window.__app.beijing.landmarks,
  districts: window.__app.beijing.districts,
  spawn: window.__app.beijing.spawn || null,
  warnings: window.__app.beijing.warnings || [],
}));
console.log('  draw calls:', report.info.scene.stats.draws, 'triangles:', report.info.scene.stats.triangles);
console.log('  landmarks:', report.info.scene.landmarks.length);

const views = [
  ['01-hutong-street.png', 'hutong', 'street'],
  ['02-hutong-paifang.png', 'hutong', 'paifang'],
  ['03-hutong-gate.png', 'hutong', 'gate'],
  ['04-hutong-aerial.png', 'hutong', 'aerial'],
  ['05-axis-street.png', 'axis', 'street'],
  ['06-axis-temple.png', 'axis', 'temple'],
  ['07-axis-gulou.png', 'axis', 'gulou'],
  ['08-axis-aerial.png', 'axis', 'aerial'],
  ['09-cbd-street.png', 'cbd', 'street'],
  ['10-cbd-tower.png', 'cbd', 'tower'],
  ['11-cbd-aerial.png', 'cbd', 'aerial'],
  ['12-great-wall-ridge.png', 'wall', 'ridge'],
  ['13-great-wall-aerial.png', 'wall', 'aerial'],
];
for (const [name, district, view] of views) {
  const applied = await page.evaluate(({ district, view }) => window.__app.applyView(district, view), { district, view });
  if (!applied) console.log('  !! view missing', district, view);
  await capture(name);
}

// whole-district overview: pull the camera back from the hutong hill
await page.evaluate(() => {
  const { beijing, THREE, camera, localToWorld, districtById } = window.__app;
  const hutong = districtById('hutong');
  const position = localToWorld(hutong, [-18, 14, 22]);
  const target = localToWorld(hutong, [0, 1, -4]);
  camera.up.set(...hutong.up);
  camera.position.copy(position);
  camera.lookAt(target);
  camera.fov = 52;
  camera.updateProjectionMatrix();
  window.__app.renderOnce();
  void beijing;
  void THREE;
});
await capture('14-hutong-hill-overview.png');

report.finishedAt = new Date().toISOString();
// copy results into the app (single write burst after the browser closed)
await browser.close();
for (const name of report.screenshots) {
  fs.copyFileSync(path.join(TMP, name), path.join(OUT, name));
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log('\nwrote', report.screenshots.length, 'screenshots ->', path.relative(APP_DIR, OUT));
console.log('report:', path.relative(APP_DIR, path.join(OUT, 'report.json')));
