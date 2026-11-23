// Plot finder: searches open, plane-like ground patches around the existing
// NPC regions so a flat Beijing district can be placed nearby without burying
// buildings or water. Saves a ranking + candidate screenshots.
//
//   node tools/beijing/plots.mjs [baseUrl]
import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:5190').replace(/\/$/, '');
const APP_DIR = new URL('../..', import.meta.url).pathname;
const OUT = '/tmp/dsh-beijing/recon';
fs.mkdirSync(OUT, { recursive: true });

const REGIONS = {
  village: [20.3565, 19.1747, 2.20046],
  city: [26.2539, 9.70977, 1.39919],
  countryside: [-8.91062, -21.1061, 0.906382],
  mountain: [-8.17226, 32.3472, -1.76941],
  harbor: [15.8793, 16.9006, 11.2543],
  spawn: [5.81095, 5.80205, 25.7794],
};
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
page.on('pageerror', (error) => console.log('  [pageerror]', error.message.slice(0, 300)));
await page.goto(`${BASE}/tools/beijing/test.html?mode=probe&freeze=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 240000 });
if (await page.evaluate(() => window.__error)) { console.error(await page.evaluate(() => window.__error)); process.exit(1); }

// ------------------------------------------------------------ build candidate dirs
const R = 25.5; // rough surface radius for tangent offsets
const SAMPLE_FOOTPRINT = { w: 9, d: 7 }; // half sizes
const FOOT_STEPS = { x: 4, z: 3 };
const results = {};

for (const [regionName, centerRaw] of Object.entries(REGIONS)) {
  const center = norm(centerRaw);
  const ground = await page.evaluate((n) => window.__app.groundAt(n), center);
  const up = (() => {
    const y = ground.point[1];
    return Math.abs(y) > 0.9 ? [0, 0, 1] : [0, 1, 0];
  })();
  // frame
  const upv = center;
  const ref = up;
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const nrm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  let right = nrm(cross(ref, upv));
  const forward = nrm(cross(upv, right));

  const candidates = [];
  for (let x = -10; x <= 10; x += 2) {
    for (let z = -10; z <= 10; z += 2) {
      const dist = Math.hypot(x, z);
      if (dist > 10.5) continue;
      candidates.push({ x, z, dist });
    }
  }
  const dirRows = [];
  for (const cand of candidates) {
    const cm = nrm([0, 1, 2].map((i) => upv[i] + right[i] * (cand.x / R) + forward[i] * (cand.z / R)));
    const rows = [];
    for (let ix = 0; ix <= FOOT_STEPS.x; ix += 1) {
      for (let iz = 0; iz <= FOOT_STEPS.z; iz += 1) {
        const ox = -SAMPLE_FOOTPRINT.w / 2 + (ix / FOOT_STEPS.x) * SAMPLE_FOOTPRINT.w;
        const oz = -SAMPLE_FOOTPRINT.d / 2 + (iz / FOOT_STEPS.z) * SAMPLE_FOOTPRINT.d;
        const d = nrm([0, 1, 2].map((i) => cm[i] + right[i] * (ox / R) + forward[i] * (oz / R)));
        rows.push({ ox, oz, d });
      }
    }
    dirRows.push({ cand, cm, rows });
  }
  const allDirs = dirRows.flatMap((row) => row.rows.map((s) => s.d));
  const sampled = await page.evaluate((dirs) => window.__app.sampleDirs(dirs), allDirs);

  let offset = 0;
  const scored = [];
  for (const row of dirRows) {
    const pts = [];
    for (const s of row.rows) {
      const hit = sampled[offset];
      offset += 1;
      if (!hit) continue;
      pts.push({ x: s.ox, z: s.oz, h: hit.radius });
    }
    if (pts.length < 12) continue;
    // least-squares plane h = a*x + b*z + c
    let n = 0; const sums = { x: 0, z: 0, h: 0, xx: 0, xz: 0, zz: 0, xh: 0, zh: 0 };
    for (const p of pts) {
      n += 1;
      sums.x += p.x; sums.z += p.z; sums.h += p.h;
      sums.xx += p.x * p.x; sums.xz += p.x * p.z; sums.zz += p.z * p.z;
      sums.xh += p.x * p.h; sums.zh += p.z * p.h;
    }
    // solve via normal equations (small 3x3) with simple elimination
    const A = [
      [sums.xx, sums.xz, sums.x],
      [sums.xz, sums.zz, sums.z],
      [sums.x, sums.z, n],
    ];
    const B = [sums.xh, sums.zh, sums.h];
    for (let i = 0; i < 3; i += 1) {
      let piv = i;
      for (let k = i + 1; k < 3; k += 1) if (Math.abs(A[k][i]) > Math.abs(A[piv][i])) piv = k;
      [A[i], A[piv]] = [A[piv], A[i]];
      [B[i], B[piv]] = [B[piv], B[i]];
      const div = A[i][i] || 1e-9;
      for (let j = i; j < 3; j += 1) A[i][j] /= div;
      B[i] /= div;
      for (let k = 0; k < 3; k += 1) {
        if (k === i) continue;
        const f = A[k][i];
        for (let j = i; j < 3; j += 1) A[k][j] -= f * A[i][j];
        B[k] -= f * B[i];
      }
    }
    const [a, b, c] = B;
    let maxResidual = 0;
    let maxH = -Infinity;
    let minH = Infinity;
    for (const p of pts) {
      const pred = a * p.x + b * p.z + c;
      maxResidual = Math.max(maxResidual, Math.abs(p.h - pred));
      maxH = Math.max(maxH, p.h);
      minH = Math.min(minH, p.h);
    }
    const slope = Math.hypot(a, b);
    const meanH = (maxH + minH) / 2;
    const waterPenalty = meanH < 23 ? 4 : 0;
    const score = maxResidual * 3 + slope * 3 + row.cand.dist * 0.16 + waterPenalty;
    scored.push({ ...row.cand, maxResidual, slope, maxH, minH, meanH, score, cm: row.cm });
  }
  scored.sort((a, b) => a.score - b.score);
  results[regionName] = scored.slice(0, 10);
  console.log(`\n== ${regionName} best plots:`);
  for (const [i, s] of scored.slice(0, 6).entries()) {
    console.log(
      `  #${i} x=${s.x} z=${s.z} dist=${s.dist.toFixed(1)} res=${s.maxResidual.toFixed(2)} ` +
      `slope=${s.slope.toFixed(2)} h=${s.meanH.toFixed(2)} score=${s.score.toFixed(2)} dir=[${s.cm.map((v) => v.toFixed(3))}]`,
    );
  }
}

fs.writeFileSync(path.join(OUT, 'plots.json'), JSON.stringify(results, null, 2));

// ------------------------------------------------------------ top-down screenshots of the best 3 per region
for (const [regionName, list] of Object.entries(results)) {
  for (const [i, plot] of list.slice(0, 3).entries()) {
    await page.evaluate(({ dir }) => {
      const T = window.__app.THREE;
      const n = new T.Vector3(...dir);
      const ref = Math.abs(n.y) > 0.9 ? new T.Vector3(0, 0, 1) : new T.Vector3(0, 1, 0);
      const right = new T.Vector3().crossVectors(ref, n).normalize();
      const fwd = new T.Vector3().crossVectors(n, right).normalize();
      const ground = window.__app.groundAt(dir);
      const camPos = new T.Vector3(...ground.point).addScaledVector(n, 15).addScaledVector(fwd, -3);
      const target = new T.Vector3(...ground.point);
      window.__app.setCamera({ position: camPos.toArray(), target: target.toArray(), fov: 45 });
    }, { dir: plot.cm });
    await page.waitForTimeout(150);
    const file = path.join(OUT, `plot-${regionName}-${i}.png`);
    await page.screenshot({ path: file });
    console.log('  saved', path.relative(APP_DIR, file));
  }
}

await browser.close();
