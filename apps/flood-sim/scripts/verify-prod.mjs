#!/usr/bin/env node
/**
 * verify-prod.mjs —— 生产构建验收：真实 WebGL 下检查 scene/水面/画质切换/视角交互/建筑点选/统计（16 项）。
 * 用法：先 npm run build，再起静态服务 `python3 -m http.server 5190 -d dist`，然后 node scripts/verify-prod.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.VERIFY_URL || 'http://127.0.0.1:5190/';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
const warnings = [];
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error') errors.push(t); if (m.type() === 'warning') warnings.push(t); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__floodReady === true, { timeout: 90000 });
await page.waitForTimeout(1200);
check('scene ready', true);
check('no boot errors', errors.length === 0, errors.slice(0, 3).join(' | '));

// 基础状态
const base = await page.evaluate(() => {
  const s = window.__floodStore;
  return {
    water: s.waterLevel, target: s.targetLevel, total: s.stats.totalBuildings,
    flooded: s.stats.floodedBuildings, area: s.stats.inundatedAreaM2,
    viewer: !!window.__floodApp?.viewer, fps: s.fps,
    canvas: { w: window.__floodApp.viewer.canvas.width, h: window.__floodApp.viewer.canvas.height },
  };
});
check('viewer + canvas', base.viewer && base.canvas.w >= 1600, JSON.stringify(base.canvas));
check('buildings loaded (>=90)', base.total >= 90, `total=${base.total}`);

// 水位联动 + 平滑
await page.evaluate(() => { const s = window.__floodStore; s.loading.visible = false; s.targetLevel = 15; });
await page.waitForTimeout(3500);
const at15 = await page.evaluate(() => {
  const s = window.__floodStore;
  return { water: s.waterLevel, flooded: s.stats.floodedBuildings, total: s.stats.totalBuildings, area: s.stats.inundatedAreaM2, fps: s.fps };
});
check('water level animation → 15m', at15.water > 14.5, `water=${at15.water}`);
check('flood stats update', at15.flooded > base.flooded && at15.area > base.area, `flooded ${base.flooded}→${at15.flooded}, area ${(base.area/1e6).toFixed(1)}→${(at15.area/1e6).toFixed(1)}km²`);

// 画质切换（之前的 DeveloperError 回归）
const qualityErrorsBefore = errors.length;
for (const q of ['medium', 'low', 'high']) {
  await page.evaluate((qv) => { window.__floodStore.quality = qv; }, q);
  await page.waitForTimeout(900);
}
const fpsAfterQuality = await page.evaluate(() => window.__floodStore.fps);
await page.waitForTimeout(1200);
check('quality toggle no error', errors.length === qualityErrorsBefore, errors.slice(qualityErrorsBefore, qualityErrorsBefore + 2).join(' | '));
check('fps still updating', fpsAfterQuality > 0, `fps=${fpsAfterQuality}`);

// 视角交互（左键拖拽旋转 / 右键拖拽倾斜 / 滚轮缩放 / 键盘 / store.viewCommand）
{
  const camState = () => page.evaluate(() => {
    const cam = window.__floodApp.viewer.camera;
    const p = cam.positionCartographic;
    return {
      h: p.height,
      lon: (p.longitude * 180) / Math.PI,
      lat: (p.latitude * 180) / Math.PI,
      heading: cam.heading,
      pitch: cam.pitch,
    };
  });
  const before = await camState();

  // 左键拖拽 = 旋转（Cesium 3D 低空表现为绕地球旋转，近观感类似平移）
  await page.mouse.move(800, 500);
  await page.mouse.down({ button: 'left' });
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(800 + i * 20, 500 + i * 3);
    await page.waitForTimeout(25);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(700);
  const afterRotate = await camState();
  const movedM = Math.hypot(afterRotate.lon - before.lon, afterRotate.lat - before.lat) * 111000;
  check(
    'left-drag rotate',
    movedM > 2 || Math.abs(afterRotate.heading - before.heading) > 0.05,
    `moved ${movedM.toFixed(0)}m, dHeading ${(((afterRotate.heading - before.heading) * 180) / Math.PI).toFixed(1)}°`,
  );

  // 右键拖拽 = 倾斜（pitch 变化；Cesium 原生 tilt）
  await page.mouse.move(800, 500);
  await page.mouse.down({ button: 'right' });
  for (let i = 1; i <= 5; i++) {
    await page.mouse.move(800, 500 + i * 4);
    await page.waitForTimeout(30);
  }
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(700);
  const afterTilt = await camState();
  check(
    'right-drag tilt',
    Math.abs(afterTilt.pitch - afterRotate.pitch) > 0.02,
    `pitch ${((afterTilt.pitch * 180) / Math.PI).toFixed(1)}°（Δ${(((afterTilt.pitch - afterRotate.pitch) * 180) / Math.PI).toFixed(1)}°）`,
  );

  // 滚轮 = 缩放（向外拉，保证后续 zoomIn 有空间）
  const beforeWheel = await camState();
  await page.mouse.move(800, 500);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(700);
  const afterWheel = await camState();
  check('wheel zoom', afterWheel.h > beforeWheel.h * 1.02, `h ${beforeWheel.h.toFixed(0)} → ${afterWheel.h.toFixed(0)}`);

  // 键盘旋转
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(350);
  const afterKeys = await camState();
  check(
    'keyboard orbit',
    Math.abs(afterKeys.heading - afterWheel.heading) > 0.05,
    `heading ${(((afterKeys.heading - afterWheel.heading) * 180) / Math.PI).toFixed(1)}°`,
  );

  await page.evaluate(() => { window.__floodStore.viewCommand = { type: 'zoom', dir: 1 }; });
  await page.waitForTimeout(700);
  const afterZoom = await camState();
  check('store.viewCommand zoom', afterZoom.h < afterKeys.h * 0.98, `h ${afterKeys.h.toFixed(0)} → ${afterZoom.h.toFixed(0)}`);

  await page.evaluate(() => { window.__floodStore.viewCommand = { type: 'reset' }; });
  await page.waitForTimeout(2400);
  const afterReset = await camState();
  check('store.viewCommand reset', Math.abs(afterReset.h - before.h) < Math.max(80, before.h * 0.15), `h ${afterReset.h.toFixed(0)}`);
}

// 蓄水区（在地形上框选矩形 → 区域填水 + 分析）
{
  await page.evaluate(() => { window.__floodStore.cameraPreset = 'overview'; });
  await page.waitForTimeout(3000);
  await page.evaluate(() => { window.__floodStore.zoneMode = true; });
  await page.waitForTimeout(300);
  await page.mouse.move(420, 460);
  await page.mouse.down({ button: 'left' });
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(420 + i * 32, 460 + i * 22);
    await page.waitForTimeout(30);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(1200);
  const zoneState = await page.evaluate(() => {
    const s = window.__floodStore;
    return {
      zoneMode: s.zoneMode,
      zone: s.zone && { level: s.zone.level, stats: s.zone.stats },
      range: s.zoneLevelRange,
      primitives: window.__floodApp.viewer.scene.primitives.length,
    };
  });
  check(
    'draw reservoir zone',
    !!zoneState.zone && zoneState.zone.stats.areaKm2 > 0 && zoneState.zone.stats.waterAreaKm2 > 0,
    `area=${zoneState.zone?.stats.areaKm2.toFixed(2)}km² water=${zoneState.zone?.stats.waterAreaKm2.toFixed(2)}km² level=${zoneState.zone?.level}`,
  );

  await page.evaluate(() => { window.__floodStore.zoneCommand = { type: 'clear', seq: Date.now() }; });
  await page.waitForTimeout(500);
  const cleared = await page.evaluate(() => window.__floodStore.zone);
  check('clear reservoir zone', cleared === null, 'zone=null');

  await page.evaluate(() => { window.__floodStore.zoneMode = false; });
}

// 相机预设
for (const p of ['overview', 'village', 'river', 'sea', 'compare']) {
  await page.evaluate((pv) => { window.__floodStore.cameraPreset = pv; }, p);
  await page.waitForTimeout(400);
}
await page.waitForTimeout(2600);
const cam = await page.evaluate(() => {
  const c = window.__floodApp.viewer.camera;
  return { lon: c.positionCartographic.longitude * 180 / Math.PI, lat: c.positionCartographic.latitude * 180 / Math.PI, h: c.positionCartographic.height };
});
check('camera preset flyTo', cam.h > 100 && cam.lon > 119 && cam.lon < 121, JSON.stringify(cam));

// 建筑点选（设置 village 视角后从画面中心附近找可 pick 的 3D Tiles 要素）
await page.evaluate(() => { const s = window.__floodStore; s.cameraPreset = 'village'; s.targetLevel = 8; });
await page.waitForTimeout(3500);

// 用更简单的方式：直接点画布若干位置，看 store.selectedBuilding
let selected = null;
outer: for (let gy = 350; gy <= 750; gy += 25) {
  for (let gx = 250; gx <= 1150; gx += 25) {
    await page.mouse.click(gx, gy);
    await page.waitForTimeout(60);
    selected = await page.evaluate(() => window.__floodStore.selectedBuilding);
    if (selected) break outer;
  }
}
check('building pick → selectedBuilding', !!selected, selected ? `${selected.name} depth=${selected.depth?.toFixed?.(2)}m` : 'no hit');
const cardVisible = await page.evaluate(() => !!document.querySelector('.building-card, [class*="building"]'));
check('building card rendered', cardVisible);

// 截图（带 UI）
await page.waitForTimeout(800);
await page.screenshot({ path: 'screenshots/verify-prod.png' });

check('no runtime errors at end', errors.length === 0, errors.slice(0, 3).join(' | '));
if (warnings.length) console.log('\nwarnings:', [...new Set(warnings)].slice(0, 5));

const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length ? '✗ 验收未通过' : '✓ 生产构建验收通过'}  (${results.length - failed.length}/${results.length})`);
await browser.close();
process.exit(failed.length ? 1 : 0);
