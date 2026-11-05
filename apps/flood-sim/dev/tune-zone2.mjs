/** tune-zone2.mjs —— 组件隔离：diffuse / emission / specular / alpha 分别关掉，采样湖面像素 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const OUT = '/tmp/zonetune2';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.PROD_URL ?? 'http://127.0.0.1:5321/';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
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
    if (mat && mat.uniforms && 'u_alphaBase' in mat.uniforms) window.__zoneMat = mat;
  }
  const s = window.__floodStore; const z = s.zone;
  const cx = (z.minX + z.maxX) / 2, cy = (z.minY + z.maxY) / 2;
  const camera = scene.camera;
  const Carto = camera.positionCartographic.constructor;
  const deg = Math.PI / 180, lon0 = 120.05, lat0 = 26.98, M_LON = 99287, M_LAT = 110803;
  const cam = { x: cx + 1200, y: cy + 1900, h: s.zoneLevel + 800 };
  const dest = scene.globe.ellipsoid.cartographicToCartesian(new Carto((lon0 + cam.x / M_LON) * deg, (lat0 + cam.y / M_LAT) * deg, cam.h));
  const dx = cx - cam.x, dy = cy - cam.y, dz = s.zoneLevel - cam.h;
  camera.setView({ destination: dest, orientation: { heading: Math.atan2(dx, dy), pitch: Math.atan2(dz, Math.hypot(dx, dy)), roll: 0 } });
});
await page.waitForTimeout(2400);
const combos = [
  { name: 'cur-normal', diff: 1.0, emis: 1.0, spec: 1.0, alpha: 0.62, debug: 0 },
  { name: 'bright-a', diff: 2.2, emis: 2.0, spec: 1.0, alpha: 0.85, debug: 0 },
  { name: 'bright-b', diff: 3.0, emis: 2.6, spec: 1.2, alpha: 0.9, debug: 0 },
  { name: 'bright-c', diff: 2.6, emis: 1.6, spec: 1.2, alpha: 0.88, debug: 0 },
  { name: 'bright-d', diff: 1.6, emis: 3.0, spec: 1.0, alpha: 0.82, debug: 0 },
];
for (const c of combos) {
  await page.evaluate((cc) => {
    const m = window.__zoneMat;
    m.uniforms.u_diffMul = cc.diff; m.uniforms.u_emisMul = cc.emis; m.uniforms.u_specMul = cc.spec;
    m.uniforms.u_alphaBase = cc.alpha; m.uniforms.u_debug = cc.debug;
  }, c);
  await page.waitForTimeout(450);
  const file = path.join(OUT, `zone-${c.name}.png`);
  await page.locator('#app canvas').first().screenshot({ path: file });
  console.log('shot', c.name);
}
await browser.close();
