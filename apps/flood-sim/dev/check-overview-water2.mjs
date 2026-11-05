import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = '/tmp/ovcheck';
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.PROD_URL ?? 'http://127.0.0.1:5321/';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
page.on('console', m => { if (m.type()==='error') console.log('[err]', m.text().slice(0,300)); });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__floodReady === true, null, { timeout: 120000 });
await page.addStyleTag({ content: `.ui-layer,.ui-right,.drawer-toggle,.cesium-viewer-bottom{display:none!important}` });
await page.evaluate(() => {
  const scene = document.querySelector('.scene-canvas') || document.querySelector('#app > div');
  if (scene && scene.parentElement) Array.from(scene.parentElement.children).forEach((el) => { if (el !== scene) el.style.display = 'none'; });
  const s = window.__floodStore; s.loading.visible = false; s.cameraPreset = 'overview'; s.targetLevel = 2.5; s.waterLevel = 2.5;
});
await page.waitForTimeout(3600);
await page.waitForFunction(() => window.__floodApp?.viewer?.scene?.globe?.tilesLoaded, null, { timeout: 60000 }).catch(() => {});
const info = await page.evaluate(() => {
  const scene = window.__floodApp.viewer.scene;
  const stage = scene.postProcessStages._stages.find((x) => x && String(x.name).startsWith('flood-water'));
  const c = scene.camera;
  return {
    dtat: scene.globe.depthTestAgainstTerrain,
    clearGlobeDepth: scene._environmentState.clearGlobeDepth,
    msaa: scene.msaaSamples,
    camAlt: +c.positionCartographic.height.toFixed(1),
    camPitch: +(c.pitch * 180 / Math.PI).toFixed(2),
    frustum: { near: c.frustum.near, far: c.frustum.far },
    bands: scene.view.frustumCommandsList.map((f) => [Math.round(f.near), Math.round(f.far)]),
    stageEnabled: stage && stage.enabled,
    uniforms: stage ? { level: stage.uniforms.u_waterLevel, motion: stage.uniforms.u_motion, normalScale: stage.uniforms.u_normalScale } : null,
  };
});
console.log(JSON.stringify(info, null, 1));
const setDbg = (d) => page.evaluate((dd) => {
  const scene = window.__floodApp.viewer.scene;
  const stage = scene.postProcessStages._stages.find((x) => x && String(x.name).startsWith('flood-water'));
  stage.uniforms.u_debug = dd;
}, d);
for (const [d, name] of [[4,'mask'],[8,'ts-twater'],[97,'tScene'],[96,'tWater'],[93,'winDepth'],[0,'final']]) {
  await setDbg(d);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `ov-${name}.png`) });
  console.log('shot', name);
}
await browser.close();
