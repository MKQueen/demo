/**
 * explore-zone.mjs —— 在山区找一个能框出"像样水库"的相机与拖拽方式。
 * 输出每种候选 drag 得到的 zone 宽高/面积，帮助挑最终截图参数。
 */
import { chromium } from 'playwright';
const BASE = process.env.PROD_URL ?? 'http://127.0.0.1:5321/';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
page.on('console', m => { if (m.type()==='error') console.log('[err]', m.text().slice(0,300)); });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__floodReady === true, null, { timeout: 120000 });
await page.addStyleTag({ content: `.ui-layer,.ui-right,.drawer-toggle{display:none!important}` });
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

const attempts = [
  { cam: { x: -5600, y: 3300, h: 1500 }, tgt: { x: -5600, y: 200, h: 520 }, drag: [[700,420],[1350,800]] },
  { cam: { x: -5600, y: 3300, h: 1500 }, tgt: { x: -5600, y: 200, h: 520 }, drag: [[650,380],[1200,760]] },
  { cam: { x: -3000, y: 1200, h: 1700 }, tgt: { x: -5600, y: 200, h: 520 }, drag: [[600,420],[1150,780]] },
  { cam: { x: -5600, y: 3300, h: 1100 }, tgt: { x: -5600, y: 200, h: 520 }, drag: [[700,450],[1300,780]] },
];
for (let i = 0; i < attempts.length; i += 1) {
  const a = attempts[i];
  await setCam(a.cam, a.tgt);
  await page.waitForTimeout(2200);
  await page.evaluate(() => { window.__floodStore.zoneMode = true; });
  await page.waitForTimeout(500);
  const [s, e] = a.drag;
  await page.mouse.move(s[0], s[1]);
  await page.mouse.down();
  for (let k = 1; k <= 10; k += 1) {
    await page.mouse.move(s[0] + (e[0]-s[0])*k/10, s[1] + (e[1]-s[1])*k/10);
    await page.waitForTimeout(40);
  }
  await page.mouse.up();
  await page.waitForTimeout(900);
  const info = await page.evaluate(() => {
    const z = window.__floodStore.zone;
    if (!z) return null;
    const w = z.maxX - z.minX, h = z.maxY - z.minY;
    return { w: Math.round(w), h: Math.round(h), areaKm2: +(w*h/1e6).toFixed(2), level: z.level, stats: z.stats && { waterKm2: +z.stats.waterAreaKm2.toFixed(2), minH: +z.stats.terrainMin.toFixed(0), maxH: +z.stats.terrainMax.toFixed(0) } };
  });
  console.log('attempt', i, JSON.stringify(info));
  // 清空，准备下一次
  await page.evaluate(() => { window.__floodStore.zoneCommand = { type: 'clear', seq: Date.now() }; });
  await page.waitForTimeout(400);
}
await browser.close();
