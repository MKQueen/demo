/** tune-zone3.mjs —— 用当前默认值搭好 zone，再在真实视图里对比 3 组参数并采样 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const OUT = '/tmp/zonetune3';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.PROD_URL ?? 'http://127.0.0.1:5321/';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
page.on('console', m => { if (m.type()==='error') console.log('[err]', m.text().slice(0,250)); });
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0,250)));
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
await page.waitForTimeout(1600);
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
  const cam = { x: cx + 1500, y: cy + 1900, h: s.zoneLevel + 850 };
  const dest = scene.globe.ellipsoid.cartographicToCartesian(new Carto((lon0 + cam.x / M_LON) * deg, (lat0 + cam.y / M_LAT) * deg, cam.h));
  const dx = cx - cam.x, dy = cy - cam.y, dz = s.zoneLevel - cam.h;
  camera.setView({ destination: dest, orientation: { heading: Math.atan2(dx, dy), pitch: Math.atan2(dz, Math.hypot(dx, dy)), roll: 0 } });
});
await page.waitForTimeout(2200);
const cur = await page.evaluate(() => {
  const m = window.__zoneMat; return { diff: m.uniforms.u_diffMul, emis: m.uniforms.u_emisMul, alpha: m.uniforms.u_alphaBase, spec: m.uniforms.u_specMul };
});
console.log('current uniforms', JSON.stringify(cur));
const combos = [
  { name: 'default', diff: 3.0, emis: 2.6, spec: 1.2, alpha: 0.90 },
  { name: 'half', diff: 1.4, emis: 1.2, spec: 1.0, alpha: 0.80 },
  { name: 'blue', diff: 1.8, emis: 1.0, spec: 1.0, alpha: 0.85 },
  { name: 'mid', diff: 1.0, emis: 2.0, spec: 1.0, alpha: 0.85 },
];
for (const c of combos) {
  await page.evaluate((cc) => {
    const m = window.__zoneMat;
    m.uniforms.u_diffMul = cc.diff; m.uniforms.u_emisMul = cc.emis; m.uniforms.u_specMul = cc.spec;
    m.uniforms.u_alphaBase = cc.alpha; m.uniforms.u_debug = 0;
  }, c);
  await page.waitForTimeout(500);
  await page.locator('#app canvas').first().screenshot({ path: path.join(OUT, `zone-${c.name}.png`) });
  console.log('shot', c.name);
}
await browser.close();
