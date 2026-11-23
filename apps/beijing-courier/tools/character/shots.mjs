// Reusable Playwright screenshot script for the character/NPC harness.
//
//   node tools/character/shots.mjs [baseUrl]
//
// Defaults to the shared Vite dev server on http://127.0.0.1:5190 (start it with
// `npm run dev` in apps/beijing-courier first). Writes the screenshots + a small
// JSON report into apps/beijing-courier/screenshots/character/.
//
// The harness tries the real MRT pipeline + ported character shader and silently
// falls back to a MeshToonMaterial + palette-atlas stand-in when that layer is
// temporarily broken. The chosen mode is printed and stored in report.json.
import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:5190').replace(/\/$/, '');
const APP_DIR = new URL('../..', import.meta.url).pathname;
const OUT_DIR = path.join(APP_DIR, 'screenshots/character');
const HARNESS = `${BASE}/tools/character/test.html`;

if (!fs.existsSync(path.join(APP_DIR, 'package.json'))) {
  console.error(`Could not locate apps/beijing-courier from ${import.meta.url}`);
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (error) => console.log('  [pageerror]', error.message.slice(0, 500)));
page.on('console', (message) => {
  if (message.type() === 'error') console.log('  [console]', message.text().slice(0, 500));
});

const report = { baseUrl: BASE, startedAt: new Date().toISOString(), screenshots: [], renders: {}, info: {}, npcTypes: {} };

async function open(mode, params = {}, options = {}) {
  const query = new URLSearchParams({ mode, ...params }).toString();
  await page.goto(`${HARNESS}?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready || window.__error, { timeout: 180000 });
  const error = await page.evaluate(() => window.__error);
  if (error) throw new Error(`harness failed (${mode}): ${error.slice(0, 1200)}`);
  if (options.freeze !== false) await page.evaluate(() => window.__app.freeze(true));
  await page.waitForTimeout(options.settle ?? 450);
  return page.evaluate(() => window.__app.renderMode);
}

async function capture(name, options = {}) {
  const target = options.selector ? page.locator(options.selector) : page;
  const file = path.join(OUT_DIR, name);
  await target.screenshot({ path: file });
  report.screenshots.push({ file: path.relative(APP_DIR, file), mode: options.mode });
  console.log('  saved', path.relative(APP_DIR, file));
}

const viewport = (width, height) => page.setViewportSize({ width, height });

async function main() {
  await viewport(1440, 900);

  console.log('[1/8] lineup (4 poses + 4 outfits)');
  report.renders.lineup = await open('lineup', { render: 'auto' });
  await capture('01-lineup.png', { mode: 'lineup' });
  report.info.lineup = await page.evaluate(() => window.__app.info());

  await viewport(900, 1000);
  const singleViews = [
    ['02-pose-idle.png', { pose: 'idle', view: 'front', time: '0.45' }],
    ['03-pose-run.png', { pose: 'run', view: 'side', time: '0.28' }],
    ['04-pose-sprint.png', { pose: 'sprint', view: 'side', time: '0.3' }],
    ['05-pose-air.png', { pose: 'air', view: 'side', time: '0.5' }],
    ['06-pose-back.png', { pose: 'idle', view: 'back', time: '0.45' }],
    ['07-head-detail.png', { pose: 'idle', view: 'head', time: '0.45' }],
  ];
  let index = 2;
  for (const [name, params] of singleViews) {
    console.log(`[${index}/8] ${name.replace('.png', '')}`);
    const render = await open('single', { render: 'auto', ...params });
    report.renders[name] = render;
    await capture(name, { mode: 'single' });
    index++;
  }

  console.log('[8/8] npc row, talking npc, catalog, reference comparison');
  await viewport(1440, 900);
  report.renders.npcs = await open('npcs', { render: 'auto' });
  await capture('08-npcs-world.png', { mode: 'npcs' });
  report.info.npcs = await page.evaluate(() => window.__app.info());

  await viewport(1000, 900);
  report.renders.npcTalking = await open('npc', { render: 'auto', type: 'young-lady', talk: '1' });
  await capture('09-npc-talking.png', { mode: 'npc' });
  report.info.npcTalking = await page.evaluate(() => window.__app.info());

  await viewport(1500, 900);
  report.renders.catalog = await open('catalog', { render: 'basic', base: 'hair3,top2,bottom4,shoes5' });
  await capture('10-catalog-accessories.png', { mode: 'catalog', selector: '#grid-canvas' });

  await viewport(1440, 900);
  report.renders.compare = await open('compare', { render: 'auto' });
  await capture('11-compare-reference.png', { mode: 'compare', selector: '#grid-canvas' });

  // Measure draw calls with the plain renderer (the MRT pipeline adds its own
  // fullscreen pass, so renderer.info is not meaningful there).
  console.log('[extra] basic-renderer draw call measurement');
  report.renders.basicLineup = await open('lineup', { render: 'basic' });
  report.info.lineupBasic = await page.evaluate(() => {
    window.__app.renderOnce();
    return window.__app.info();
  });

  report.finishedAt = new Date().toISOString();
  const reportFile = path.join(OUT_DIR, 'report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log('\nrender modes:', JSON.stringify(report.renders));
  console.log('report:', path.relative(APP_DIR, reportFile));
}

try {
  await main();
} catch (error) {
  console.error('\nScreenshot run failed:', error.message);
  await browser.close();
  process.exit(1);
}
await browser.close();
