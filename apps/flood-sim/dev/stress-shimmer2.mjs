/**
 * stress-shimmer2.mjs —— 定位"缩放时的高频微光"来源：
 * 对 SSRON/SSROFF、SPECON/SPECOFF、正常 三组配置，分别采集
 * A) 静止相机 6 帧  B) 缓慢连续 zoom 8 帧，
 * 计算相邻帧平均像素差；若某效果关闭后「zoom/静止」差异比显著下降，
 * 说明该效果是运动 shimmer 的来源。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const OUT = '/tmp/stress-shimmer2';
const BASE = process.env.PROD_URL ?? 'http://127.0.0.1:5321/';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__floodReady === true, null, { timeout: 120000 });
await page.waitForTimeout(300);
await page.evaluate(() => {
  const scene = document.querySelector('.scene-canvas') || document.querySelector('#app > div');
  if (scene && scene.parentElement) Array.from(scene.parentElement.children).forEach((el) => { if (el !== scene) el.style.display = 'none'; });
  const st = window.__floodStore;
  st.loading.visible = false; st.cameraPreset = 'sea'; st.targetLevel = 5; st.waterLevel = 5;
});
await page.waitForTimeout(4200);
const setUniforms = (patch) => page.evaluate((p) => {
  const scene = window.__floodApp.viewer.scene;
  const stage = scene.postProcessStages._stages.find((x) => x && String(x.name).startsWith('flood-water'));
  if (!stage) return;
  stage.uniforms.u_ssr = 1; stage.uniforms.u_specScale = 1;
  for (const [k, v] of Object.entries(p)) stage.uniforms[k] = v;
}, patch);
const stopZoom = () => page.evaluate(() => { window.__stopZoom = true; });
const startZoom = (dir) => page.evaluate((d) => {
  const cam = window.__floodApp.viewer.scene.camera;
  window.__stopZoom = false;
  let n = 0;
  const step = () => {
    if (window.__stopZoom || n++ > 30) return;
    if (d < 0) cam.zoomIn(1.4); else cam.zoomOut(1.4);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}, dir);
let idx = 0;
const snap = async (cfg, phase) => {
  await page.screenshot({ path: path.join(OUT, `${cfg}-${phase}-${idx++}.png`), timeout: 20000 });
};
const configs = [
  { name: 'normal', patch: {} },
  { name: 'ssr-off', patch: { u_ssr: 0 } },
  { name: 'spec-off', patch: { u_specScale: 0 } },
  { name: 'both-off', patch: { u_ssr: 0, u_specScale: 0 } },
];
for (const cfg of configs) {
  await setUniforms(cfg.patch);
  await page.waitForTimeout(500);
  await stopZoom();
  for (let i = 0; i < 6; i += 1) { await page.waitForTimeout(80); await snap(cfg.name, 'still'); }
  await startZoom(-1);
  for (let i = 0; i < 8; i += 1) { await page.waitForTimeout(80); await snap(cfg.name, 'zoomin'); }
  await stopZoom();
  await page.waitForTimeout(300);
  await startZoom(1);
  for (let i = 0; i < 8; i += 1) { await page.waitForTimeout(80); await snap(cfg.name, 'zoomout'); }
  await stopZoom();
  await page.waitForTimeout(200);
  console.log('[cfg]', cfg.name);
}
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ errors }, null, 1));
console.log('errors=', errors.length, errors.slice(0,3));
await browser.close();
