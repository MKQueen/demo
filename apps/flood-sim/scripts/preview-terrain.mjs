#!/usr/bin/env node
/**
 * preview-terrain.mjs —— 地形模型离线预览（不依赖 Cesium / 浏览器）。
 *
 * 生成一张带山体阴影、河流、海岸线、村庄范围的地形图，并打印高程统计与性能，
 * 用于快速迭代 src/geo/terrainModel.js 的地形手感。
 *
 * 用法：node scripts/preview-terrain.mjs
 * 输出：screenshots/wip/terrain-preview.png
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  SCENE,
  HALF_W,
  HALF_H,
  VILLAGE,
  WATER,
  RIVER_PATH,
  COASTLINE,
  heightAtLocal,
  computeInundatedArea,
  localToLonLat,
} from '../src/geo/terrainModel.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(APP, 'screenshots', 'wip', 'terrain-preview.png');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const W = 700;
const H = 600;
const heights = new Float32Array(W * H);
const t0 = performance.now();
for (let j = 0; j < H; j++) {
  const y = HALF_H - ((j + 0.5) / H) * SCENE.heightMeters; // 北在上
  for (let i = 0; i < W; i++) {
    const x = -HALF_W + ((i + 0.5) / W) * SCENE.widthMeters;
    heights[j * W + i] = heightAtLocal(x, y);
  }
}
const dt = performance.now() - t0;
console.log(`采样 ${W}x${H} = ${W * H} 点，耗时 ${dt.toFixed(1)} ms → 单点 ${(dt / (W * H) * 1000).toFixed(2)} µs`);

let min = Infinity;
let max = -Infinity;
for (const h of heights) {
  if (h < min) min = h;
  if (h > max) max = h;
}
console.log(`高程范围: ${min.toFixed(1)} ~ ${max.toFixed(1)} m`);
console.log(`村庄中心海拔: ${heightAtLocal(VILLAGE.centerX, VILLAGE.centerY).toFixed(2)} m`);
console.log(`村庄中心经纬度: ${VILLAGE.centerLon.toFixed(5)}, ${VILLAGE.centerLat.toFixed(5)}`);
console.log('河流剖面:');
for (const p of RIVER_PATH) {
  console.log(`  along=${p.along.toFixed(2)} (${p.x},${p.y}) bed=${p.bedHeight.toFixed(1)} m  地形=${heightAtLocal(p.x, p.y).toFixed(1)} m`);
}
for (const level of [0, 2.5, 6, 10, 15, 20, 24, 30]) {
  const a = computeInundatedArea(level, 140);
  console.log(`水位 ${String(level).padStart(4)} m → 淹没 ${(a.inundatedAreaM2 / 1e6).toFixed(3)} km² / ${(a.ratio * 100).toFixed(1)}%`);
}

// --- 渲染（山体阴影 + 分级色 + 水系/村庄叠加） ---
const rgb = new Uint8Array(W * H * 3);
const col = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
const bands = [
  [-999, -6, '#12333f'],
  [-6, 0, '#3d6b75'],
  [0, 2.5, '#c9b98a'],
  [2.5, 15, '#7a9a5f'],
  [15, 120, '#3f6b45'],
  [120, 380, '#6f7358'],
  [380, 9999, '#9b968a'],
].map(([a, b, c]) => [a, b, col(c)]);
function colorFor(h) {
  for (const [a, b, c] of bands) if (h >= a && h < b) return c;
  return [200, 200, 200];
}
const light = [0.5, 0.72, 0.48];
const ll = Math.hypot(...light);
for (let j = 0; j < H; j++) {
  for (let i = 0; i < W; i++) {
    const k = j * W + i;
    const h = heights[k];
    const hl = heights[j * W + Math.max(0, i - 1)];
    const hr = heights[j * W + Math.min(W - 1, i + 1)];
    const hu = heights[Math.max(0, j - 1) * W + i];
    const hd = heights[Math.min(H - 1, j + 1) * W + i];
    const dzdx = ((hr - hl) * W) / SCENE.widthMeters;
    const dzdy = ((hu - hd) * H) / SCENE.heightMeters;
    // 法线 (-dzdx, -dzdy, 1)
    const nx = -dzdx;
    const ny = -dzdy;
    const nz = 1;
    const nl = Math.hypot(nx, ny, nz);
    const shade = Math.max(0.32, Math.min(1.25, (nx * light[0] + ny * light[1] + nz * light[2]) / (nl * ll) * 1.25));
    const base = colorFor(h);
    const r = Math.min(255, base[0] * shade);
    const g = Math.min(255, base[1] * shade);
    const b = Math.min(255, base[2] * shade);
    rgb[k * 3] = r;
    rgb[k * 3 + 1] = g;
    rgb[k * 3 + 2] = b;
  }
}
// 河流（深蓝线）
function toPix(x, y) {
  return [((x + HALF_W) / SCENE.widthMeters) * W, ((HALF_H - y) / SCENE.heightMeters) * H];
}
function drawLine(x1, y1, x2, y2, c, width = 1) {
  const [px1, py1] = toPix(x1, y1);
  const [px2, py2] = toPix(x2, y2);
  const steps = Math.ceil(Math.max(Math.abs(px2 - px1), Math.abs(py2 - py1)) * 2);
  for (let s = 0; s <= steps; s++) {
    const t = steps ? s / steps : 0;
    const px = Math.round(px1 + (px2 - px1) * t);
    const py = Math.round(py1 + (py2 - py1) * t);
    for (let oy = -width; oy <= width; oy++) {
      for (let ox = -width; ox <= width; ox++) {
        const x = px + ox;
        const y = py + oy;
        if (x < 1 || y < 1 || x > W - 2 || y > H - 2) continue;
        const k = (y * W + x) * 3;
        rgb[k] = c[0];
        rgb[k + 1] = c[1];
        rgb[k + 2] = c[2];
      }
    }
  }
}
for (let i = 0; i < RIVER_PATH.length - 1; i++) {
  drawLine(RIVER_PATH[i].x, RIVER_PATH[i].y, RIVER_PATH[i + 1].x, RIVER_PATH[i + 1].y, [26, 90, 120], 2);
}
for (let i = 0; i < COASTLINE.length - 1; i++) {
  drawLine(COASTLINE[i].x, COASTLINE[i].y, COASTLINE[i + 1].x, COASTLINE[i + 1].y, [230, 220, 180], 1);
}
// 村庄圈
const [vx, vy] = toPix(VILLAGE.centerX, VILLAGE.centerY);
const vr = (VILLAGE.radiusMeters / SCENE.widthMeters) * W;
for (let a = 0; a < Math.PI * 2; a += 0.02) {
  const x = Math.round(vx + Math.cos(a) * vr);
  const y = Math.round(vy + Math.sin(a) * vr);
  if (x < 0 || y < 0 || x >= W || y >= H) continue;
  const k = (y * W + x) * 3;
  rgb[k] = 255; rgb[k + 1] = 210; rgb[k + 2] = 90;
}

// --- PNG 编码（RGB8，无滤波） ---
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 3)] = 0;
  Buffer.from(rgb.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync(OUT, png);
console.log(`\n✓ ${path.relative(APP, OUT)}  (${(png.length / 1024).toFixed(0)} KB)`);
console.log(`场景范围: ${SCENE.widthMeters}m × ${SCENE.heightMeters}m，中心 ${SCENE.lon0}, ${SCENE.lat0}`);
