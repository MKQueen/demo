/**
 * shot-bright.mjs —— 水面提亮 A/B 截图（生产构建 @5321，1600×1000，canvas 直出）。
 *
 * 场景：
 *   overview15 / village15 / sea5   —— 全局 PostProcess 水面
 *   zone                            —— 山区蓄水区（waterMaterial 版，2.5km 视距）
 *
 * 用法：TAG=before node dev/shot-bright.mjs   → water-bright-before-*.png
 *       TAG=after  node dev/shot-bright.mjs   → water-bright-after-*.png
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const OUT = path.join(APP, 'screenshots', 'wip');
const BASE = process.env.PROD_URL ?? 'http://127.0.0.1:5321/';
const TAG = process.env.TAG ?? 'after';
const HIDE_UI = `.ui-layer,.ui-right,.drawer-toggle,.cesium-viewer-bottom,.atmosphere,.scene-fallback,.loading-overlay,.top-bar,.control-panel,.stats-panel,.camera-dock,.legend-bar,.fps-badge,.info-modal,.building-card,.credits,.cesium-credit-lightbox-overlay,.flood-credits{display:none!important}`;

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

async function boot() {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__floodReady === true, null, { timeout: 120000 });
  await page.addStyleTag({ content: HIDE_UI });
  await page.evaluate(() => {
    window.__floodStore.loading.visible = false;
  });
  // 等操作提示（9s）消失 + 地形瓦片
  await page.waitForTimeout(9500);
  await page.addStyleTag({ content: 'body > *:not(#app){display:none!important}' });
  await page.waitForFunction(() => window.__floodApp?.viewer?.scene?.globe?.tilesLoaded, null, { timeout: 60000 }).catch(() => {});
}

async function shot(name) {
  const canvas = page.locator('#app canvas').first();
  await canvas.screenshot({ path: path.join(OUT, `water-bright-${TAG}-${name}.png`) });
  const info = await page.evaluate(() => ({ level: +window.__floodStore.waterLevel.toFixed(2), fps: window.__floodStore.fps, zone: window.__floodStore.zone ? true : false }));
  console.log(`[shot] ${TAG}-${name}`, JSON.stringify(info));
}

async function presetShot(name, preset, level) {
  await page.evaluate(({ preset, level }) => {
    const s = window.__floodStore;
    s.cameraPreset = preset; s.targetLevel = level; s.waterLevel = level;
  }, { preset, level });
  await page.waitForTimeout(3600);
  await page.evaluate((level) => { window.__floodStore.targetLevel = level; window.__floodStore.waterLevel = level; }, level);
  await page.waitForTimeout(800);
  await shot(name);
}

// ---------------- 全局水面三机位 ----------------
await boot();
if (process.env.ONLY_ZONE !== '1') {
  await presetShot('overview15', 'overview', 15);
  await presetShot('village15', 'village', 15);
  await presetShot('sea5', 'sea', 5);
  await presetShot('river8', 'river', 8);
}

if (process.env.NO_ZONE === '1') {
  console.log('console errors:', errors.length, errors.slice(0, 5));
  await browser.close();
  process.exit(0);
}

// ---------------- 蓄水区（Material 水面）----------------
// 相机放到山区盆地的北侧 ~3km，俯视盆地，拖拽框出水库
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
await page.waitForTimeout(700);
await page.mouse.move(650, 380);
await page.mouse.down();
for (let i = 1; i <= 10; i += 1) {
  await page.mouse.move(650 + i * 55, 380 + i * 38);
  await page.waitForTimeout(45);
}
await page.mouse.up();
await page.waitForTimeout(1500);
let zoneOk = await page.evaluate(() => !!window.__floodStore.zone);
console.log('zone created:', zoneOk);
if (!zoneOk) {
  await page.evaluate(() => { window.__floodStore.zoneMode = true; });
  await page.waitForTimeout(600);
  await page.mouse.move(600, 420);
  await page.mouse.down();
  for (let i = 1; i <= 10; i += 1) { await page.mouse.move(600 + i * 60, 420 + i * 42); await page.waitForTimeout(45); }
  await page.mouse.up();
  await page.waitForTimeout(1500);
  zoneOk = await page.evaluate(() => !!window.__floodStore.zone);
  console.log('zone retry:', zoneOk);
}
if (zoneOk) {
  // 抬高蓄水水位：让湖面大一些、一眼能看出是水
  await page.evaluate(() => {
    const s = window.__floodStore;
    const z = s.zone;
    const target = Math.min(s.zoneLevelRange[1] - 2, (z.stats?.terrainMin ?? 400) + 95);
    s.zoneLevel = Math.round(target);
  });
  await page.waitForTimeout(1600);
  // 构图：先在当前画面里拾取"湖面实际位置"（右下大水面），再以 ~2.5km 视距侧上方取景
  const zc = await page.evaluate(() => {
    const z = window.__floodStore.zone;
    const scene = window.__floodApp.viewer.scene;
    const camera = scene.camera;
    const Pos = camera.position.constructor;
    const target = new Pos(1300, 560);
    let wc = null;
    try { wc = scene.pickPosition(target); } catch (e) { wc = null; }
    if (!wc) wc = scene.globe.pick(camera.getPickRay(target), scene);
    let lx = (z.minX + z.maxX) / 2, ly = (z.minY + z.maxY) / 2;
    if (wc) {
      const carto = scene.globe.ellipsoid.cartesianToCartographic(wc);
      const deg = 180 / Math.PI, lon0 = 120.05, lat0 = 26.98, M_LON = 99287, M_LAT = 110803;
      lx = (carto.longitude * deg - lon0) * M_LON;
      ly = (carto.latitude * deg - lat0) * M_LAT;
    }
    return { x: lx, y: ly, level: window.__floodStore.zoneLevel };
  });
  await setCam({ x: zc.x + 1400, y: zc.y + 2000, h: zc.level + 780 }, { x: zc.x, y: zc.y, h: zc.level });
  await page.waitForTimeout(2600);
  await shot('zone');
  // 更远一点（~3.2km），验证"远看也能看出是湖面"
  await setCam({ x: zc.x + 1900, y: zc.y + 2600, h: zc.level + 1000 }, { x: zc.x, y: zc.y, h: zc.level });
  await page.waitForTimeout(2200);
  await shot('zone-far');
  const zoneInfo = await page.evaluate(() => {
    const s = window.__floodStore;
    return { zoneLevel: s.zoneLevel, range: s.zoneLevelRange, waterKm2: +(s.zone?.stats?.waterAreaKm2 ?? 0).toFixed(2), areaKm2: +(s.zone?.stats?.areaKm2 ?? 0).toFixed(2), maxDepth: +(s.zone?.stats?.maxDepth ?? 0).toFixed(1) };
  });
  console.log('zone info', JSON.stringify(zoneInfo));
}

console.log('console errors:', errors.length, errors.slice(0, 5));
await browser.close();
