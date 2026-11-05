/** tune-zone.mjs —— 在真实场景里实时调蓄水区材质参数（u_diffMul/u_emisMul/u_alphaBase）并截图取样 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const OUT = '/tmp/zonetune';
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
  const dest = scene.globe.ellipsoid.cartographicToCartesian(new Carto((lon0 + cam.x / M_LON) * deg, (lat0 + cam.y / M_LAT) * deg, cam.h));
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
await page.evaluate(() => {
  const s = window.__floodStore; const z = s.zone;
  s.zoneLevel = Math.round(Math.min(s.zoneLevelRange[1] - 2, (z.stats?.terrainMin ?? 400) + 95));
});
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const scene = window.__floodApp.viewer.scene;
  for (let i = 0; i < scene.primitives.length; i += 1) {
    const p = scene.primitives.get(i); const mat = p && p.appearance && p.appearance.material;
    if (mat && mat.uniforms && mat.uniforms.u_waterLevel !== undefined && 'u_alphaBase' in mat.uniforms) window.__zoneMat = mat;
  }
  const s = window.__floodStore; const z = s.zone;
  const cx = (z.minX + z.maxX) / 2, cy = (z.minY + z.maxY) / 2;
  const scene2 = window.__floodApp.viewer.scene; const camera = scene2.camera;
  const Carto = camera.positionCartographic.constructor;
  const deg = Math.PI / 180, lon0 = 120.05, lat0 = 26.98, M_LON = 99287, M_LAT = 110803;
  const cam = { x: cx + 1200, y: cy + 1900, h: s.zoneLevel + 800 };
  const dest = scene2.globe.ellipsoid.cartographicToCartesian(new Carto((lon0 + cam.x / M_LON) * deg, (lat0 + cam.y / M_LAT) * deg, cam.h));
  const dx = cx - cam.x, dy = cy - cam.y, dz = s.zoneLevel - cam.h;
  camera.setView({ destination: dest, orientation: { heading: Math.atan2(dx, dy), pitch: Math.atan2(dz, Math.hypot(dx, dy)), roll: 0 } });
});
await page.waitForTimeout(2400);
const combos = [
  { name: 'a-base', diff: 1.0, emis: 1.0, alpha: 0.62 },
  { name: 'b-no-diff', diff: 0.0, emis: 1.0, alpha: 0.62 },
  { name: 'c-low-diff', diff: 0.25, emis: 1.2, alpha: 0.7 },
  { name: 'd-emis-only-2', diff: 0.0, emis: 2.2, alpha: 0.85 },
  { name: 'e-mix', diff: 0.35, emis: 1.6, alpha: 0.8 },
  { name: 'f-mix2', diff: 0.5, emis: 1.2, alpha: 0.7 },
];
for (const c of combos) {
  await page.evaluate((cc) => {
    const m = window.__zoneMat;
    m.uniforms.u_diffMul = cc.diff; m.uniforms.u_emisMul = cc.emis; m.uniforms.u_alphaBase = cc.alpha; m.uniforms.u_debug = 0;
  }, c);
  await page.waitForTimeout(400);
  await page.locator('#app canvas').first().screenshot({ path: path.join(OUT, `zone-${c.name}.png`) });
  const px = await page.evaluate(() => {
    // 取湖面中心附近的屏幕坐标：用 zone 中心投影
    const scene = window.__floodApp.viewer.scene; const camera = scene.camera;
    const s = window.__floodStore; const z = s.zone;
    const cx = (z.minX + z.maxX) / 2, cy = (z.minY + z.maxY) / 2;
    const Carto = camera.positionCartographic.constructor;
    const deg = Math.PI / 180, lon0 = 120.05, lat0 = 26.98, M_LON = 99287, M_LAT = 110803;
    const ell = scene.globe.ellipsoid;
    const carto = new Carto((lon0 + cx / M_LON) * deg, (lat0 + cy / M_LAT) * deg, s.zoneLevel);
    const wc = ell.cartographicToCartesian(carto);
    const sp = scene.cartesianToCanvasCoordinates ? null : null;
    const Cesium = null;
    return null;
  });
  console.log('shot', c.name);
}
await browser.close();
