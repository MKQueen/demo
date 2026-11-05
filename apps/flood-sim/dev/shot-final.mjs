/**
 * shot-final.mjs —— 水面最终验收截图（生产构建 @5321，UI 隐藏，1600×1000）。
 * 用法：PROD_URL=http://127.0.0.1:5321/ node dev/shot-final.mjs [name1,name2]
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const OUT = path.join(APP, 'screenshots', 'wip');
const BASE = process.env.PROD_URL ?? 'http://127.0.0.1:5321/';
const HIDE_UI = `.ui-layer,.ui-right,.drawer-toggle,.cesium-viewer-bottom,.atmosphere,.scene-fallback,.loading-overlay,.top-bar,.control-panel,.stats-panel,.camera-dock,.legend-bar,.fps-badge,.info-modal,.building-card,.credits,.cesium-credit-lightbox-overlay,.flood-credits{display:none!important}`;
const SCENARIOS = [
  { name: 'water-fixed-overview', preset: 'overview', level: 2.5 },
  { name: 'water-fixed-village-8', preset: 'village', level: 8 },
  { name: 'water-fixed-village-15', preset: 'village', level: 15 },
  { name: 'water-fixed-river-8', preset: 'river', level: 8 },
  { name: 'water-fixed-sea-5', preset: 'sea', level: 5 },
  { name: 'water-fixed-compare-8', preset: 'compare', level: 8 },
];
const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
const list = only ? SCENARIOS.filter((s) => only.has(s.name)) : SCENARIOS;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__floodReady === true, null, { timeout: 120000 });
await page.addStyleTag({ content: HIDE_UI });
// 更彻底地隐藏 UI：按已知类名 + 文本兜底（操作提示面板等）
await page.evaluate(() => {
  const hide = (el) => { if (el && el.style) el.style.display = 'none'; };
  document.querySelectorAll('.ui-layer,.ui-right,.loading-overlay,.atmosphere,.drawer-toggle,.cesium-viewer-bottom').forEach(hide);
  document.querySelectorAll('#app div, #app aside, #app section').forEach((el) => {
    const t = el.textContent || '';
    if (t.includes('操作提示') && el.getBoundingClientRect().width < 700) hide(el);
  });
  const scene = document.querySelector('.scene-canvas');
  if (scene && scene.parentElement) Array.from(scene.parentElement.children).forEach((el) => { if (el !== scene) hide(el); });
});
await page.evaluate(() => { window.__floodStore.loading.visible = false; });
// 操作提示（InteractionHint）可能被 Teleport 到 body，且 9s 后自动消失：
// 先等它消失，同时用 CSS 兜底隐藏 body 下非 #app 的覆盖层
await page.waitForTimeout(9500);
await page.addStyleTag({ content: 'body > *:not(#app){display:none!important}' });
await page.waitForFunction(() => window.__floodApp?.viewer?.scene?.globe?.tilesLoaded, null, { timeout: 60000 }).catch(() => {});
for (const sc of list) {
  await page.evaluate(({ preset, level }) => {
    const s = window.__floodStore;
    s.cameraPreset = preset; s.targetLevel = level; s.waterLevel = level;
  }, sc);
  await page.waitForTimeout(3400);
  await page.evaluate((level) => { window.__floodStore.targetLevel = level; window.__floodStore.waterLevel = level; }, sc.level);
  await page.waitForTimeout(700);
  const info = await page.evaluate(() => ({ level: +window.__floodStore.waterLevel.toFixed(2), fps: window.__floodStore.fps }));
  // 只截 Cesium canvas：天然排除所有 DOM 覆盖层（UI/提示框）
  const canvas = page.locator('#app canvas').first();
  await canvas.screenshot({ path: path.join(OUT, `${sc.name}.png`) });
  console.log(`[shot] ${sc.name} level=${info.level} fps=${info.fps}`);
}
console.log('console errors:', errors.length, errors.slice(0, 5));
await browser.close();
