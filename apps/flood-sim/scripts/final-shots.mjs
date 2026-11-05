#!/usr/bin/env node
/**
 * final-shots.mjs —— 生产构建最终出图（封面 + 5 张验收图）。
 *
 * 前置：
 *   cd apps/flood-sim && npm run build
 *   python3 -m http.server 5190 -d dist
 * 用法：
 *   node scripts/final-shots.mjs            # 默认 http://127.0.0.1:5190/
 *   VERIFY_URL=http://127.0.0.1:5191/ node scripts/final-shots.mjs
 *
 * 输出（apps/flood-sim/screenshots/）：
 *   cover.jpg / final-cover-source.png
 *   final-overview-2_5.png / final-overview-15.png
 *   final-village-2_5.png / final-village-15.png
 *   final-ui-mobile.png / final-ui-narrow-900.png
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(APP, 'screenshots');
const URL_BASE = process.env.VERIFY_URL || 'http://127.0.0.1:5190/';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

/** 打开页面，等场景就绪、隐藏 loading，返回 page */
async function openPage(viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__floodReady === true, { timeout: 90000 });
  await page.evaluate(() => {
    const s = window.__floodStore;
    if (s) s.loading.visible = false;
  });
  await page.waitForTimeout(1200);
  return { page, errors };
}

async function shotAt(page, preset, level, waitMs = 4200) {
  await page.evaluate(
    ({ preset, level }) => {
      const s = window.__floodStore;
      if (!s) return;
      s.loading.visible = false;
      s.cameraPreset = preset;
      s.targetLevel = level;
      s.waterLevel = level;
    },
    { preset, level },
  );
  await page.waitForTimeout(waitMs);
}

const allErrors = [];

// ---------------------------------------------------------------------------
// 1) 桌面 1600×1000：验收图 + 封面
// ---------------------------------------------------------------------------
{
  const { page, errors } = await openPage({ width: 1600, height: 1000 });
  allErrors.push(...errors);

  await shotAt(page, 'overview', 2.5);
  await page.screenshot({ path: path.join(OUT, 'final-overview-2_5.png') });

  await shotAt(page, 'overview', 15);
  await page.screenshot({ path: path.join(OUT, 'final-overview-15.png') });

  await shotAt(page, 'village', 2.5);
  await page.screenshot({ path: path.join(OUT, 'final-village-2_5.png') });

  await shotAt(page, 'village', 15);
  await page.screenshot({ path: path.join(OUT, 'final-village-15.png') });

  // 封面：村庄半淹（水位 10m）能同时看到山、水、村庄与 UI
  await shotAt(page, 'village', 10, 4500);
  await page.screenshot({ path: path.join(OUT, 'final-cover-source.png') });
  await page.screenshot({ path: path.join(OUT, 'cover.jpg'), type: 'jpeg', quality: 88 });

  const finalErrors = errors.slice();
  await page.close();
  if (finalErrors.length) console.log('桌面页错误：', [...new Set(finalErrors)].slice(0, 5));

  // 2) 窄屏 900×1200（抽屉态由 UI 自身响应式处理）
  const { page: narrow, errors: narrowErrors } = await openPage({ width: 900, height: 1200 });
  allErrors.push(...narrowErrors);
  await narrow.evaluate(() => {
    const s = window.__floodStore;
    if (s) {
      s.loading.visible = false;
      s.cameraPreset = 'village';
      s.targetLevel = 12;
      s.waterLevel = 12;
    }
  });
  await narrow.waitForTimeout(4200);
  await narrow.screenshot({ path: path.join(OUT, 'final-ui-narrow-900.png') });
  await narrow.close();

  // 3) 手机 390×844
  const { page: mobile, errors: mobileErrors } = await openPage({ width: 390, height: 844 });
  allErrors.push(...mobileErrors);
  await mobile.evaluate(() => {
    const s = window.__floodStore;
    if (s) {
      s.loading.visible = false;
      s.cameraPreset = 'village';
      s.targetLevel = 12;
      s.waterLevel = 12;
    }
  });
  await mobile.waitForTimeout(4200);
  await mobile.screenshot({ path: path.join(OUT, 'final-ui-mobile.png') });
  await mobile.close();
}

await browser.close();

const files = fs.readdirSync(OUT).filter((f) => f.startsWith('final-') || f === 'cover.jpg');
console.log('\n✓ 最终截图：');
for (const f of files) console.log(`  screenshots/${f}`);
if (allErrors.length) {
  console.log('\n✗ 页面错误（请检查）：');
  for (const e of [...new Set(allErrors)].slice(0, 10)) console.log('  -', e.slice(0, 300));
  process.exitCode = 1;
} else {
  console.log('\n✓ 无 console / page / HTTP 错误');
}
