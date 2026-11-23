// Real-game integration check: loads the actual game page (shared dev server),
// starts the game, compares the Lead's computed spawn with beijing.spawn, then
// teleports to the recommended spawn and screenshots the real follow camera.
//
//   node tools/beijing/realpage.mjs [baseUrl]
//
// Intermediate screenshots are written to /tmp (writing inside the Vite root
// would hot-reload the page); the final ones are copied to screenshots/beijing/.
import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:5190').replace(/\/$/, '');
const APP_DIR = new URL('../..', import.meta.url).pathname;
const TMP = '/tmp/dsh-beijing/real';
const OUT = path.join(APP_DIR, 'screenshots/beijing');
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const report = { baseUrl: BASE, startedAt: new Date().toISOString(), shots: [], console: [], errors: [] };
page.on('pageerror', (error) => {
  report.errors.push(error.message.slice(0, 500));
  console.log('  [pageerror]', error.message.slice(0, 400));
});
page.on('console', (message) => {
  if (message.type() === 'error') console.log('  [console]', message.text().slice(0, 400));
});

await page.goto(`${BASE}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__courier, null, { timeout: 240000 });
console.log('courier ready, starting game…');
await page.evaluate(async () => {
  await window.__courier.startGame();
});
await page.waitForFunction(() => window.__courier.state.mode === 'playing', null, { timeout: 300000 });
await page.waitForTimeout(2500);
// close the intro dialogue so the HUD does not cover the scene
await page.evaluate(() => {
  const c = window.__courier;
  try { c.ui.hideDialogue?.(); } catch { /* ignore */ }
  try { c.ui.hideLoading?.(); } catch { /* ignore */ }
});
await page.waitForTimeout(600);

const info = await page.evaluate(() => {
  const c = window.__courier;
  const b = c.beijing;
  const world = b.districts.find((d) => d.id === 'hutong');
  const landmark = b.landmarks.find((entry) => entry.id === 'hutong-street');
  return {
    hasBeijing: !!b,
    spawn: b.spawn,
    landmarkHutongStreet: landmark,
    districts: b.districts.map((d) => ({ id: d.id, terraceTop: d.terraceTop, terrace: d.terrace, origin: d.origin, up: d.up, right: d.right, forward: d.forward })),
    npcSpots: b.npcSpots,
    landmarks: b.landmarks.map((l) => ({ id: l.id, name: l.name, point: l.point })),
    currentSpawn: c.world ? { point: c.world.spawn.point.toArray(), normal: c.world.spawn.normal.toArray(), heading: c.world.spawn.heading } : null,
    player: c.controller ? { position: c.controller.position.toArray(), grounded: c.controller.grounded } : null,
    beijingLandmarkPositions: (b.landmarks || []).length,
    world,
    sceneStats: (() => { let meshes = 0; c.scene.traverse((o) => { if (o.isMesh) meshes += 1; }); return { meshes }; })(),
  };
});
console.log('\n--- beijing.spawn ---');
console.log(JSON.stringify(info.spawn, null, 1));
console.log('\n--- current game spawn (Lead heuristic) ---');
console.log(JSON.stringify(info.currentSpawn, null, 1));
console.log('\nplayer at boot:', JSON.stringify(info.player));
report.info = info;

async function shot(name) {
  await page.waitForTimeout(700);
  const file = path.join(TMP, name);
  await page.screenshot({ path: file });
  report.shots.push(name);
  console.log('  saved', name);
}

// 1) screenshot of the current in-game spawn as Lead integrated it
await shot('real-00-lead-spawn.png');

// 2) teleport to the recommended spawn, wait for the follow camera to settle
await page.evaluate(() => {
  const c = window.__courier;
  const s = c.beijing.spawn;
  const T = c.THREE;
  const point = new T.Vector3(...s.point);
  const normal = new T.Vector3(...s.normal);
  c.controller.position.copy(point);
  c.controller.normal.copy(normal);
  c.controller._smoothedNormal?.copy(normal);
  c.controller.heading = s.heading;
  c.controller.speed = 0;
  c.followCamera.yaw = s.heading;
  c.followCamera.currentPos.copy(point).addScaledVector(normal, 3);
  c.followCamera.currentTarget.copy(point);
  c.followCamera.frameUp.copy(normal);
});
await page.waitForTimeout(1200);
const spawnState = await page.evaluate(() => {
  const c = window.__courier;
  return {
    position: c.controller.position.toArray(),
    grounded: c.controller.grounded,
    heading: c.controller.heading,
    camPos: c.camera.position.toArray(),
  };
});
console.log('\nplayer at recommended spawn:', JSON.stringify(spawnState));
report.spawnState = spawnState;
await shot('real-01-recommended-spawn.png');

// 3) walk forward for a moment (keyboard) and screenshot: does the player stay on the terrace?
await page.keyboard.down('KeyW');
await page.waitForTimeout(1400);
await page.keyboard.up('KeyW');
await page.waitForTimeout(500);
const walkState = await page.evaluate(() => {
  const c = window.__courier;
  return {
    position: c.controller.position.toArray(),
    grounded: c.controller.grounded,
    speed: c.controller.speed,
  };
});
console.log('\nafter walking forward:', JSON.stringify(walkState));
report.walkState = walkState;
await shot('real-02-walk-forward.png');

// 4) turn around 180° and look back toward the paifang/street
await page.evaluate(() => {
  const c = window.__courier;
  c.controller.heading += Math.PI;
  c.followCamera.yaw = c.controller.heading;
});
await shot('real-03-turn-around.png');

report.finishedAt = new Date().toISOString();
await browser.close();
for (const name of report.shots) fs.copyFileSync(path.join(TMP, name), path.join(OUT, name));
fs.writeFileSync(path.join(OUT, 'realpage-report.json'), JSON.stringify(report, null, 2));
console.log('\nwrote', report.shots.length, 'real-page screenshots ->', path.relative(APP_DIR, OUT));
