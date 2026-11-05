import { chromium } from 'playwright';
const BASE = process.env.PROD_URL ?? 'http://127.0.0.1:5321/';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__floodReady === true, null, { timeout: 120000 });
await page.evaluate(() => { const s = window.__floodStore; s.loading.visible = false; s.cameraPreset = 'overview'; s.targetLevel = 2.5; s.waterLevel = 2.5; });
await page.waitForTimeout(3600);
const res = await page.evaluate(() => {
  const viewer = window.__floodApp.viewer; const scene = viewer.scene; const camera = scene.camera;
  const ellipsoid = scene.globe.ellipsoid;
  const CP = Object.getPrototypeOf(camera.position).constructor;
  const samples = [[520,560],[700,620],[900,600],[1050,560],[600,480],[820,660],[420,600],[300,700]];
  const out = [];
  for (const [x,y] of samples) {
    const ray = camera.getPickRay(new CP(x,y));
    const pick = scene.globe.pick(ray, scene);
    if (!pick) { out.push({px:[x,y], note:'nopick'}); continue; }
    const carto = ellipsoid.cartesianToCartographic(pick);
    let h = null;
    try { h = +scene.globe.getHeight(carto).toFixed(2); } catch (e) { h = 'err'; }
    out.push({ px:[x,y], alt: +carto.height.toFixed(2), globeHeight: h });
  }
  return { samples: out, waterLevel: window.__floodStore.waterLevel };
});
console.log(JSON.stringify(res));
await browser.close();
