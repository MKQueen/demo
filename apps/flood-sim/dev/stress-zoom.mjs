/**
 * stress-zoom.mjs —— 缩放闪烁压力测试（生产构建 @5321）。
 *
 * 做法：
 *  1) 打开生产页，隐藏 UI，village 8m 起手；
 *  2) 把水面 stage 切到 u_debug=4（红=水面像素，灰=陆地，蓝=天空），
 *     这样每帧"红色像素占比"就是水面覆盖率，缩放时应平滑变化；
 *  3) 连续滚轮 zoom-in → zoom-out、右键拖拽、相机预设 flyTo，期间逐帧截图；
 *  4) Python 端统计每帧红色占比，帧间跳变 > 阈值即视为闪烁/错位；
 *  5) 恢复 u_debug=0 拍几张正常画面。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const WIP = path.join(APP, 'screenshots', 'wip');
const OUT = '/tmp/stress-zoom';
const BASE = process.env.PROD_URL ?? 'http://127.0.0.1:5321/';
fs.mkdirSync(OUT, { recursive: true });

const HIDE_UI = `.ui-layer,.ui-right,.drawer-toggle,.cesium-viewer-bottom,.atmosphere,.scene-fallback,.loading-overlay,.top-bar,.control-panel,.stats-panel,.camera-dock,.legend-bar,.fps-badge,.info-modal,.building-card,.credits,.cesium-credit-lightbox-overlay,.flood-credits{display:none!important}`;

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => window.__floodReady === true, null, { timeout: 120000 });
await page.addStyleTag({ content: HIDE_UI });
await page.evaluate(() => {
  const s = window.__floodStore;
  s.loading.visible = false;
  s.cameraPreset = 'village';
  s.targetLevel = 8;
  s.waterLevel = 8;
});
await page.waitForTimeout(3600);
await page.waitForFunction(() => window.__floodApp?.viewer?.scene?.globe?.tilesLoaded, null, { timeout: 60000 }).catch(() => {});

const setDebug = (d) => page.evaluate((dd) => {
  const scene = window.__floodApp.viewer.scene;
  const stage = scene.postProcessStages._stages.find((x) => x && String(x.name).startsWith('flood-water'));
  if (stage) stage.uniforms.u_debug = dd;
}, d);
const camInfo = () => page.evaluate(() => {
  const c = window.__floodApp.viewer.scene.camera;
  return {
    lon: +(c.positionCartographic.longitude * 180 / Math.PI).toFixed(5),
    lat: +(c.positionCartographic.latitude * 180 / Math.PI).toFixed(5),
    h: +c.positionCartographic.height.toFixed(1),
    heading: +(c.heading * 180 / Math.PI).toFixed(1),
    pitch: +(c.pitch * 180 / Math.PI).toFixed(1),
    fps: window.__floodStore.fps,
  };
});

// ---- 水面覆盖率掩码（u_debug=4）----
await setDebug(4);
await page.waitForTimeout(500);

const shots = []; // { file, tag, cam }
let seq = 0;
const snap = async (tag) => {
  const file = path.join(OUT, `${String(seq++).padStart(3, '0')}-${tag}.png`);
  await page.screenshot({ path: file });
  shots.push({ file, tag, cam: await camInfo() });
};

// 视口中心
const cx = 640, cy = 400;
await page.mouse.move(cx, cy);

// 1) 连续 zoom-in 12 帧
for (let i = 0; i < 12; i += 1) {
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(90);
  await snap('zoom-in');
}
// 2) 连续 zoom-out 12 帧
for (let i = 0; i < 12; i += 1) {
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(90);
  await snap('zoom-out');
}
// 3) 右键拖拽（旋转/俯仰）8 帧
await page.mouse.move(cx, cy);
await page.mouse.down({ button: 'right' });
for (let i = 0; i < 8; i += 1) {
  await page.mouse.move(cx + i * 22 - 80, cy + i * 6 - 20);
  await page.waitForTimeout(90);
  await snap('drag');
}
await page.mouse.up({ button: 'right' });
// 4) 预设 flyTo（overview → village → river → sea），飞行中逐帧
for (const preset of ['overview', 'village', 'river', 'sea', 'village']) {
  await page.evaluate((p) => { window.__floodStore.cameraPreset = p; }, preset);
  for (let i = 0; i < 6; i += 1) {
    await page.waitForTimeout(120);
    await snap(`flyTo-${preset}`);
  }
}
// 5) 恢复正式画面，拍 2 张
await setDebug(0);
await page.waitForTimeout(500);
await page.evaluate(() => { window.__floodStore.cameraPreset = 'village'; window.__floodStore.targetLevel = 8; window.__floodStore.waterLevel = 8; });
await page.waitForTimeout(3200);
await snap('final-village-8');
await page.evaluate(() => { window.__floodStore.cameraPreset = 'overview'; window.__floodStore.targetLevel = 2.5; window.__floodStore.waterLevel = 2.5; });
await page.waitForTimeout(3200);
await snap('final-overview-2.5');

const result = { base: BASE, frames: shots, errors };
fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify(result, null, 1));
console.log(`captured ${shots.length} frames, errors=${errors.length}`);
console.log('errors:', errors.slice(0, 5));
await browser.close();
