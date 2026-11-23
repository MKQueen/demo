// Terrain survey: raycasts a global lat/lon grid, finds open flat patches and
// renders a top-down view of the best candidates so a Beijing district can be
// placed on safe ground.
//
//   node tools/beijing/survey.mjs [baseUrl]
import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:5190').replace(/\/$/, '');
const APP_DIR = new URL('../..', import.meta.url).pathname;
const OUT = '/tmp/dsh-beijing/recon';
fs.mkdirSync(OUT, { recursive: true });

const LAT_STEP = 4;
const LON_STEP = 4;
const LAT_MIN = -28;
const LAT_MAX = 84;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
page.on('pageerror', (error) => console.log('  [pageerror]', error.message.slice(0, 400)));
page.on('console', (message) => {
  if (message.type() === 'error') console.log('  [console]', message.text().slice(0, 400));
});

await page.goto(`${BASE}/tools/beijing/test.html?mode=probe&freeze=1`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 240000 });
if (await page.evaluate(() => window.__error)) {
  console.error(await page.evaluate(() => window.__error));
  process.exit(1);
}

const dirFor = (latDeg, lonDeg) => {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
};

const dirs = [];
const index = [];
for (let lat = LAT_MIN; lat <= LAT_MAX; lat += LAT_STEP) {
  for (let lon = 0; lon < 360; lon += LON_STEP) {
    dirs.push(dirFor(lat, lon));
    index.push([lat, lon]);
  }
}
console.log('sampling', dirs.length, 'directions…');
const samples = [];
const BATCH = 600;
for (let i = 0; i < dirs.length; i += BATCH) {
  const part = await page.evaluate((batch) => window.__app.sampleDirs(batch), dirs.slice(i, i + BATCH));
  samples.push(...part);
}
const rows = Math.round((LAT_MAX - LAT_MIN) / LAT_STEP) + 1;
const cols = 360 / LON_STEP;
console.log('rows', rows, 'cols', cols, 'samples', samples.length);

// ------------------------------------------------------------------ analysis
const heights = samples.map((s) => (s ? s.radius : -1));
const at = (r, c) => heights[r * cols + ((c + cols) % cols)];

// A sample is "open" when every neighbour within 2 rings is close in height:
// buildings/roofs show up as plateaus with sharp cliffs at their edges.
const rough = new Float32Array(rows * cols);
const flat = new Uint8Array(rows * cols);
for (let r = 0; r < rows; r += 1) {
  for (let c = 0; c < cols; c += 1) {
    const h = at(r, c);
    if (h < 0) { rough[r * cols + c] = 99; continue; }
    let maxDiff = 0;
    for (let dr = -2; dr <= 2; dr += 1) {
      const rr = r + dr;
      if (rr < 0 || rr >= rows) continue;
      for (let dc = -2; dc <= 2; dc += 1) {
        const hh = at(rr, c + dc);
        if (hh < 0) continue;
        maxDiff = Math.max(maxDiff, Math.abs(hh - h));
      }
    }
    rough[r * cols + c] = maxDiff;
    flat[r * cols + c] = maxDiff < 0.9 ? 1 : 0;
  }
}

// connected components of open cells (4-neighbourhood), stop at 30 cells
const visited = new Uint8Array(rows * cols);
const clusters = [];
for (let r = 0; r < rows; r += 1) {
  for (let c = 0; c < cols; c += 1) {
    const idx = r * cols + c;
    if (!flat[idx] || visited[idx]) continue;
    const stack = [[r, c]];
    visited[idx] = 1;
    const cells = [];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      cells.push([cr, cc]);
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = cr + dr;
        const c2 = cc + dc;
        if (rr < 0 || rr >= rows) continue;
        const wrapped = (c2 + cols) % cols;
        const ii = rr * cols + wrapped;
        if (flat[ii] && !visited[ii]) { visited[ii] = 1; stack.push([rr, wrapped]); }
      }
    }
    if (cells.length >= 12) {
      let hsum = 0;
      let latSum = 0;
      let lonSum = 0;
      for (const [cr, cc] of cells) {
        hsum += at(cr, cc);
        latSum += LAT_MIN + cr * LAT_STEP;
        lonSum += (cc * LON_STEP);
      }
      clusters.push({
        cells: cells.length,
        lat: latSum / cells.length,
        lon: lonSum / cells.length,
        height: hsum / cells.length,
      });
    }
  }
}
clusters.sort((a, b) => b.cells - a.cells);
const REGIONS = {
  village: [20.3565, 19.1747, 2.20046],
  city: [26.2539, 9.70977, 1.39919],
  countryside: [-8.91062, -21.1061, 0.906382],
  mountain: [-8.17226, 32.3472, -1.76941],
  harbor: [15.8793, 16.9006, 11.2543],
};
const toDir = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
console.log('\ntop open-flat clusters:');
for (const [i, cl] of clusters.slice(0, 18).entries()) {
  const dir = dirFor(cl.lat, cl.lon);
  const near = Object.entries(REGIONS)
    .map(([k, v]) => [k, Math.acos(Math.min(1, dir.reduce((s, x, j) => s + x * toDir(v)[j], 0))) * 25])
    .sort((a, b) => a[1] - b[1])[0];
  console.log(
    `#${i} cells=${cl.cells} lat=${cl.lat.toFixed(1)} lon=${cl.lon.toFixed(1)} h=${cl.height.toFixed(2)} ` +
    `dir=[${dir.map((v) => v.toFixed(3)).join(',')}] near=${near[0]}(${near[1].toFixed(1)}u)`,
  );
}

fs.writeFileSync(path.join(OUT, 'survey.json'), JSON.stringify({
  rows, cols, latStep: LAT_STEP, lonStep: LON_STEP, latMin: LAT_MIN, latMax: LAT_MAX,
  clusters: clusters.slice(0, 30), heights,
}, null, 0));
console.log('survey.json written');

// ------------------------------------------------------------------ candidate screenshots
const viewDirs = clusters.slice(0, 8).map((cl) => dirFor(cl.lat, cl.lon));
for (const [i, dir] of viewDirs.entries()) {
  await page.evaluate((n) => {
    const T = window.__app.THREE;
    const up = new T.Vector3(...n).normalize();
    const ref = Math.abs(up.y) > 0.9 ? new T.Vector3(0, 0, 1) : new T.Vector3(0, 1, 0);
    const right = new T.Vector3().crossVectors(ref, up).normalize();
    const fwd = new T.Vector3().crossVectors(up, right).normalize();
    const camPos = up.clone().multiplyScalar(42).addScaledVector(fwd, -8).addScaledVector(right, 2);
    window.__app.setCamera({ position: camPos.toArray(), target: up.clone().multiplyScalar(22).toArray(), fov: 34 });
  }, dir);
  await page.waitForTimeout(150);
  const file = path.join(OUT, `cluster-${i}.png`);
  await page.screenshot({ path: file });
  console.log('  saved', path.relative(APP_DIR, file));
}

await browser.close();
