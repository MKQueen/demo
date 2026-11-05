/**
 * stress-shimmer.mjs —— 缩放"闪烁/微光"检测（正常画面）。
 * A) 静止相机 10 帧（只有波浪动画）
 * B) 缓慢连续 zoom-in 10 帧
 * C) 缓慢连续 zoom-out 10 帧
 * 之后比较相邻帧像素差：静止基线 vs 运动，判断是否存在运动 shimmer。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/tmp/stress-shimmer';
const BASE = process.env.PROD_URL ?? 'http://127.0.0.1:5321/';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
console.log('[step] launch');
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
console.log('[step] goto');
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
console.log('[step] wait ready');
await page.waitForFunction(() => window.__floodReady === true, null, { timeout: 120000 });
console.log('[step] ready');
await page.waitForTimeout(300);
await page.evaluate(() => {
  const scene = document.querySelector('.scene-canvas') || document.querySelector('#app > div');
  if (scene && scene.parentElement) {
    Array.from(scene.parentElement.children).forEach((el) => { if (el !== scene) el.style.display = 'none'; });
  }
  const st = window.__floodStore;
  st.loading.visible = false;
  st.cameraPreset = 'sea';
  st.targetLevel = 5;
  st.waterLevel = 5;
});
await page.waitForTimeout(4200);
console.log('[step] scene set, tiles=', await page.evaluate(() => !!window.__floodApp?.viewer?.scene?.globe?.tilesLoaded));
const snap = async (tag, i) => {
  const file = path.join(OUT, `${String(i).padStart(2, '0')}-${tag}.png`);
  await page.screenshot({ path: file, timeout: 20000 });
  process.stdout.write(`.${i}`);
  return file;
};
console.log('\n[step] still frames');
for (let i = 0; i < 10; i += 1) { await page.waitForTimeout(80); await snap('still', i); }
console.log('\n[step] zoom-in frames');
await page.evaluate(() => {
  const viewer = window.__floodApp.viewer; const cam = viewer.scene.camera;
  window.__stopZoom = false;
  const step = () => { if (window.__stopZoom) return; cam.zoomIn(1.4); requestAnimationFrame(step); };
  requestAnimationFrame(step);
});
for (let i = 10; i < 20; i += 1) { await page.waitForTimeout(80); await snap('zoom-in', i); }
console.log('\n[step] zoom-out frames');
await page.evaluate(() => {
  window.__stopZoom = true;
  const viewer = window.__floodApp.viewer; const cam = viewer.scene.camera;
  setTimeout(() => {
    window.__stopZoom = false;
    const step = () => { if (window.__stopZoom) return; cam.zoomOut(1.4); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, 120);
});
for (let i = 20; i < 30; i += 1) { await page.waitForTimeout(80); await snap('zoom-out', i); }
await page.evaluate(() => { window.__stopZoom = true; });
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ errors }, null, 1));
console.log('\ncaptured 30 frames, errors=', errors.length, errors.slice(0, 3));
await browser.close();
