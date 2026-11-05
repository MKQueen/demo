/** diag-zone.mjs —— 蓄水区 Material 水面诊断：找到 primitive，切换 u_debug 输出各分量 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = '/tmp/zonediag';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.PROD_URL ?? 'http://127.0.0.1:5321/';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
page.on('console', m => { if (m.type()==='error') console.log('[err]', m.text().slice(0,250)); });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__floodReady === true, null, { timeout: 120000 });
await page.addStyleTag({ content: '.ui-layer,.ui-right,.drawer-toggle{display:none!important}' });
await page.evaluate(() => { window.__floodStore.loading.visible = false; });
await page.waitForTimeout(1200);

const setCam = (cam, tgt) => page.evaluate(({ cam, tgt }) => {
  const viewer = window.__floodApp.viewer; const scene = viewer.scene; const camera = scene.camera;
  const Carto = camera.positionCartographic.constructor;
  const deg = Math.PI / 180, lon0 = 120.05, lat0 = 26.98, M_LON = 99287, M_LAT = 110803;
  const dest = scene.globe.ellipsoid.cartographicToCartesian(
    new Carto((lon0 + cam.x / M_LON) * deg, (lat0 + cam.y / M_LAT) * deg, cam.h));
  const dx = tgt.x - cam.x, dy = tgt.y - cam.y, dz = tgt.h - cam.h;
  camera.setView({ destination: dest, orientation: { heading: Math.atan2(dx, dy), pitch: Math.atan2(dz, Math.hypot(dx, dy)), roll: 0 } });
}, { cam, tgt });

const basin = { x: -5600, y: 200 };
await setCam({ x: basin.x, y: basin.y + 3100, h: 1500 }, { x: basin.x, y: basin.y, h: 520 });
await page.waitForTimeout(2600);
await page.evaluate(() => { window.__floodStore.zoneMode = true; });
await page.waitForTimeout(600);
await page.mouse.move(650, 380); await page.mouse.down();
for (let i = 1; i <= 10; i += 1) { await page.mouse.move(650 + i * 55, 380 + i * 38); await page.waitForTimeout(45); }
await page.mouse.up();
await page.waitForTimeout(1500);
const zoneOk = await page.evaluate(() => !!window.__floodStore.zone);
console.log('zone:', zoneOk);
await page.evaluate(() => {
  const s = window.__floodStore; const z = s.zone;
  s.zoneLevel = Math.round(Math.min(s.zoneLevelRange[1] - 2, (z.stats?.terrainMin ?? 400) + 95));
});
await page.waitForTimeout(1500);
// 找到 zone primitive 的 material
const matInfo = await page.evaluate(() => {
  const scene = window.__floodApp.viewer.scene;
  const out = [];
  for (let i = 0; i < scene.primitives.length; i += 1) {
    const p = scene.primitives.get(i);
    const mat = p && p.appearance && p.appearance.material;
    if (mat && mat.uniforms) {
      out.push({ i, type: mat.type, uniforms: Object.keys(mat.uniforms).filter(k => k.startsWith('u_') || k === 'diffuse' || k === 'emission') });
      window.__zoneMat = mat;
    }
  }
  return out;
});
console.log('materials:', JSON.stringify(matInfo[0] || null));
// 定位到视距 2.5km 的视点
await page.evaluate(() => {
  const s = window.__floodStore; const z = s.zone;
  const cx = (z.minX + z.maxX) / 2, cy = (z.minY + z.maxY) / 2;
  const viewer = window.__floodApp.viewer; const scene = viewer.scene; const camera = scene.camera;
  const Carto = camera.positionCartographic.constructor;
  const deg = Math.PI / 180, lon0 = 120.05, lat0 = 26.98, M_LON = 99287, M_LAT = 110803;
  const cam = { x: cx + 1200, y: cy + 1900, h: s.zoneLevel + 800 };
  const dest = scene.globe.ellipsoid.cartographicToCartesian(
    new Carto((lon0 + cam.x / M_LON) * deg, (lat0 + cam.y / M_LAT) * deg, cam.h));
  const dx = cx - cam.x, dy = cy - cam.y, dz = s.zoneLevel - cam.h;
  camera.setView({ destination: dest, orientation: { heading: Math.atan2(dx, dy), pitch: Math.atan2(dz, Math.hypot(dx, dy)), roll: 0 } });
  const info = document.getElementById('app');
});
await page.waitForTimeout(2400);
for (const [dbg, name] of [[0,'normal'],[1,'diffuse-red'],[2,'emission-green'],[3,'baseline-blue'],[5,'waterbody'],[6,'normal-ts'],[7,'fresnel']]) {
  await page.evaluate((d) => { if (window.__zoneMat) window.__zoneMat.uniforms.u_debug = d; }, dbg);
  await page.waitForTimeout(400);
  await page.locator('#app canvas').first().screenshot({ path: path.join(OUT, `zone-${name}.png`) });
  console.log('shot', name);
}
await browser.close();
