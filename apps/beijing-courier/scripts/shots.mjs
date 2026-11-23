#!/usr/bin/env node
// Playwright screenshot pass for 京城来信 v3 (原创北京资产版).
//
//   npm run dev            # in one terminal
//   npm run shots          # in another
//
// Screenshots land in screenshots/ and cover.jpg.
// The script skips gracefully when the dev server is not reachable.

import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.COURIER_URL || 'http://127.0.0.1:5190/';
const OUT = path.resolve(import.meta.dirname, '..', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

async function shot(name) {
  await page.screenshot({ path: path.join(OUT, name) });
  console.log('  ·', name);
}

async function finishDialogue(max = 60) {
  for (let i = 0; i < max; i += 1) {
    const active = await page.evaluate(() => window.__courier?.ui?.dialogueActive);
    if (!active) return;
    await page.evaluate(() => window.__courier.ui.advanceDialogue());
    await page.waitForTimeout(140);
  }
}

await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(15000);
const ready = await page.evaluate(() => window.__courier?.state?.mode);
if (ready !== 'intro') {
  console.error('✗ intro did not become ready (mode =', ready, ')');
  process.exitCode = 1;
  await browser.close();
  process.exit();
}

await shot('01-intro.png');

await page.click('.bc-begin');
for (let i = 0; i < 80; i += 1) {
  const mode = await page.evaluate(() => window.__courier?.state?.mode);
  if (mode === 'playing') break;
  await page.waitForTimeout(500);
}
await page.waitForTimeout(1800);
await shot('02-opening-hutong.png'); // cinematic opening in the hutong
await finishDialogue();
await page.waitForTimeout(1200);
await shot('03-gameplay.png');
fs.copyFileSync(path.join(OUT, '03-gameplay.png'), path.join(OUT, 'cover.jpg'));

// dialogue screenshot: talk to the first giver
await page.evaluate(() => {
  const c = window.__courier;
  c.placeAtSpot('spot_diver');
  c.followCamera.update(0.016, { drag: false, wheel: 0 });
});
await page.waitForTimeout(1000);
await page.keyboard.press('KeyE');
await page.waitForTimeout(1800);
await shot('04-dialogue.png');
await finishDialogue();
await page.waitForTimeout(800);

// checklist + outfit overlays (own courier wardrobe: hat / bag / scarf)
await page.keyboard.press('KeyB');
await page.waitForTimeout(700);
await shot('05-checklist.png');
await page.keyboard.press('KeyB');
await page.waitForTimeout(500);
await page.keyboard.press('KeyC');
await page.waitForTimeout(700);
await shot('06-outfit.png');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// Beijing district views (self-built district camera presets)
const views = await page.evaluate(() => window.__courier.beijingViews());
const wanted = ['hutong-street', 'hutong-aerial', 'hutong-gate', 'axis-temple', 'cbd-street', 'cbd-tower', 'wall-ridge', 'wall-aerial'];
const pretty = {
  'hutong-street': '07-beijing-hutong.png',
  'hutong-aerial': '08-beijing-hutong-aerial.png',
  'hutong-gate': '09-beijing-paifang.png',
  'axis-temple': '10-beijing-temple.png',
  'cbd-street': '11-beijing-cbd.png',
  'cbd-tower': '12-beijing-citic.png',
  'wall-ridge': '13-beijing-greatwall.png',
  'wall-aerial': '14-beijing-greatwall-aerial.png',
};
for (const view of views) {
  const key = `${view.district}-${view.id}`;
  const file = pretty[key];
  if (!file || !wanted.includes(key)) continue;
  await page.evaluate(({ position, target, fov }) => {
    window.__courier.setFreeCamera(position, target, fov);
  }, view);
  await page.waitForTimeout(700);
  await shot(file);
}
await page.evaluate(() => window.__courier.clearFreeCamera());

// environment spots (reference planetscapes still used for the delivery loop)
const spots = [
  ['15-harbor.png', 'spot_diver'],
  ['16-village.png', 'spot_chef'],
  ['17-forest.png', 'spot_scout'],
  ['18-mountain.png', 'spot_mountainman'],
  ['19-waterfall.png', 'spot_musician'],
];
for (const [file, spot] of spots) {
  await page.evaluate((s) => {
    const c = window.__courier;
    c.placeAtSpot(s);
    c.followCamera.update(0.016, { drag: false, wheel: 0 });
  }, spot);
  await page.waitForTimeout(1200);
  await shot(file);
}

// mobile layout
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await mobile.goto(BASE, { waitUntil: 'load', timeout: 60000 });
await mobile.waitForTimeout(15000);
await mobile.screenshot({ path: path.join(OUT, '20-mobile-intro.png') });
console.log('  · 20-mobile-intro.png');
await mobile.click('.bc-begin');
for (let i = 0; i < 80; i += 1) {
  const mode = await mobile.evaluate(() => window.__courier?.state?.mode);
  if (mode === 'playing') break;
  await mobile.waitForTimeout(500);
}
await mobile.waitForTimeout(2000);
for (let i = 0; i < 60; i += 1) {
  const active = await mobile.evaluate(() => window.__courier?.ui?.dialogueActive);
  if (!active) break;
  await mobile.evaluate(() => window.__courier.ui.advanceDialogue());
  await mobile.waitForTimeout(140);
}
await mobile.waitForTimeout(1200);
await mobile.screenshot({ path: path.join(OUT, '21-mobile-game.png') });
console.log('  · 21-mobile-game.png');

console.log('\nerrors captured:', errors.length);
for (const e of [...new Set(errors)].slice(0, 8)) console.log('  !', e);
await browser.close();
