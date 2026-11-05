/**
 * stress-zoom2.mjs —— 缩放闪烁压力测试 v2（生产构建 @5321）
 *
 * 方法：
 *  - 页面内用 rAF 循环做「每帧小步长连续缩放」（模拟滚轮），先 zoom-in 4s 再
 *    zoom-out 4s，最后做两次 flyTo；
 *  - 水面 stage 切到 u_debug=4（红=水面像素，灰=水线 AA 带，其余=陆地/水面下场景），
 *    逐帧截图后比较相邻帧 mask 的 XOR 比例：
 *      平滑相机运动 → 只有水线边缘会变化（XOR 很小且均匀）；
 *      若水面 uniform 滞后一帧 → 水面/陆地成片翻转（XOR 出现尖峰）。
 *  - 同时保留正常画面帧用于人眼检查。
 *
 * 输出：/tmp/stress-zoom2/frames/*.png + frames.json
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const OUT = '/tmp/stress-zoom2';
const BASE = process.env.PROD_URL ?? 'http://127.0.0.1:5321/';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });

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
await page.waitForTimeout(500);
// 隐藏所有非场景容器（#app 下除 .scene-canvas 之外的所有元素）
await page.evaluate(() => {
  const scene = document.querySelector('.scene-canvas') || document.querySelector('#app > div');
  if (scene) {
    // 场景容器可能带子元素 UI；把它的兄弟节点全部隐藏
    const parent = scene.parentElement;
    Array.from(parent.children).forEach((el) => { if (el !== scene) el.style.display = 'none'; });
    // 场景容器内部的 UI 层（绝对定位覆盖物）也隐藏（保留 canvas 所在子树）
    Array.from(scene.children).forEach((el) => {
      if (!el.querySelector || !el.querySelector('canvas')) el.style.display = 'none';
    });
  }
  const st = window.__floodStore;
  st.loading.visible = false;
  st.cameraPreset = 'village';
  st.targetLevel = 8;
  st.waterLevel = 8;
});
await page.waitForTimeout(3600);
await page.waitForFunction(() => window.__floodApp?.viewer?.scene?.globe?.tilesLoaded, null, { timeout: 60000 }).catch(() => {});

const setDebug = (d) => page.evaluate((dd) => {
  const scene = window.__floodApp.viewer.scene;
  const stage = scene.postProcessStages._stages.find((x) => x && String(x.name).startsWith('flood-water'));
  if (stage) stage.uniforms.u_debug = dd;
}, d);

const MODES = [
  { mode: 'zoom-in', frames: 22, interval: 140 },
  { mode: 'zoom-out', frames: 22, interval: 140 },
  { mode: 'flyTo', frames: 18, interval: 140 },
];
const meta = [];
let idx = 0;
const snap = async (tag, mode) => {
  const file = path.join(OUT, 'frames', `${String(idx++).padStart(3, '0')}-${tag}.png`);
  const cam = await page.evaluate(() => {
    const c = window.__floodApp.viewer.scene.camera;
    return { h: +c.positionCartographic.height.toFixed(1), heading: +(c.heading * 180 / Math.PI).toFixed(1), fps: window.__floodStore.fps };
  });
  await page.screenshot({ path: file });
  meta.push({ file, tag, mode, cam });
};

// ---- 水面 mask 模式，连续平滑缩放 ----
await setDebug(4);
await page.waitForTimeout(400);
await page.evaluate(() => {
  const viewer = window.__floodApp.viewer;
  const cam = viewer.scene.camera;
  window.__stopZoom = false;
  window.__zoomDir = -1;
  const step = () => {
    if (window.__stopZoom) return;
    const h = cam.positionCartographic.height;
    cam.zoomIn(window.__zoomDir * Math.max(0.6, h * 0.012));
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
});
for (let i = 0; i < 22; i += 1) { await page.waitForTimeout(140); await snap('zoom-in', 'zoom-in'); }
await page.evaluate(() => { window.__zoomDir = 1; });
for (let i = 0; i < 22; i += 1) { await page.waitForTimeout(140); await snap('zoom-out', 'zoom-out'); }
await page.evaluate(() => { window.__stopZoom = true; });

// ---- flyTo 平滑飞行 ----
await page.evaluate(() => { window.__floodStore.cameraPreset = 'overview'; });
for (let i = 0; i < 18; i += 1) { await page.waitForTimeout(140); await snap('flyTo-overview', 'flyTo'); }
await page.evaluate(() => { window.__floodStore.cameraPreset = 'sea'; });
for (let i = 0; i < 18; i += 1) { await page.waitForTimeout(140); await snap('flyTo-sea', 'flyTo'); }

// ---- 恢复正式画面（无 mask）拍几张 ----
await setDebug(0);
await page.waitForTimeout(600);
await page.evaluate(() => { window.__floodStore.cameraPreset = 'village'; window.__floodStore.targetLevel = 8; window.__floodStore.waterLevel = 8; });
await page.waitForTimeout(3200);
await snap('final-village-8', 'final');
await page.evaluate(() => { window.__floodStore.cameraPreset = 'river'; window.__floodStore.targetLevel = 8; window.__floodStore.waterLevel = 8; });
await page.waitForTimeout(3200);
await snap('final-river-8', 'final');
await page.evaluate(() => { window.__floodStore.cameraPreset = 'overview'; window.__floodStore.targetLevel = 2.5; window.__floodStore.waterLevel = 2.5; });
await page.waitForTimeout(3200);
await snap('final-overview-2.5', 'final');

fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify({ base: BASE, meta, errors }, null, 1));
console.log(`captured ${meta.length} frames, errors=${errors.length}`);
await browser.close();
