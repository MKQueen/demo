/**
 * nature.js —— 山、雾、树、花、鸟、日、灯（负责：自然模块）。
 * 契约：export function buildNature(ctx) → THREE.Group。
 *
 * 美术原则（墨分五色）：
 *   · 山不是一块黑影：山脚化进纸里，山腰是淡墨，山脊深一点，峰顶留一点雪意；
 *     近山偏 INK_MID、中景 INK_SOFT、远山 INK_WASH，靠雾一层层推开。
 *   · 山形在 terrainHeight 的基础上叠一层高频噪声，做出多峰与向背；
 *     长城沿线把噪声淡出，保证城墙严格贴在 layout 给出的地形上。
 *   · 树统一走 lib/flora.js 的笔触树，不再自己拼几何。
 *
 * 所有随机都用固定种子，保证每次打开是同一幅画。
 */
import * as THREE from 'three';
import * as P from '../lib/palette.js';
import { u } from '../lib/units.js';
import {
  terrainHeight,
  LAKES,
  MOAT,
  CANALS,
  RIVERS,
  INNER_CITY,
  OUTER_CITY,
  PALACE,
  GATES,
  GREAT_WALL,
} from '../layout.js';
import { makeRng, fbm2 } from '../lib/rand.js';
import { buildTrees } from '../lib/flora.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function distToPolyline(x, z, points) {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const ax = points[i][0];
    const az = points[i][1];
    const bx = points[i + 1][0];
    const bz = points[i + 1][1];
    const vx = bx - ax;
    const vz = bz - az;
    const wx = x - ax;
    const wz = z - az;
    const len2 = vx * vx + vz * vz || 1;
    let t = (wx * vx + wz * vz) / len2;
    t = Math.min(1, Math.max(0, t));
    const dx = wx - vx * t;
    const dz = wz - vz * t;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < best) best = d;
  }
  return best;
}

/* -------------------------------------------------------------------------- */
/*  程序化小纹理（本地 helper，不依赖外部资源）                                   */
/* -------------------------------------------------------------------------- */

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function canvasTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** 花瓣：一颗小椭圆。 */
let _petalTex = null;
function petalTexture() {
  if (_petalTex) return _petalTex;
  const S = 32;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(S / 2, S / 2, S * 0.42, S * 0.26, 0, 0, Math.PI * 2);
  g.fill();
  _petalTex = canvasTexture(c);
  return _petalTex;
}

/** 日轮：中间是实一点的暖盘，边缘慢慢化开 —— 有「日」的形，没有描边。 */
let _sunTex = null;
function sunCoreTexture() {
  if (_sunTex) return _sunTex;
  const S = 256;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const R = S * 0.5;
  const grad = g.createRadialGradient(R, R, 0, R, R, R);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.42, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.72)');
  grad.addColorStop(0.68, 'rgba(255,255,255,0.4)');
  grad.addColorStop(0.84, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(R, R, R, 0, Math.PI * 2);
  g.fill();
  _sunTex = canvasTexture(c);
  return _sunTex;
}

/** 雾带：横向云气，四周全部渐隐，plane 边缘不会出现硬边。 */
let _fogTex = null;
function fogTexture() {
  if (_fogTex) return _fogTex;
  const W = 512;
  const H = 256;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const rng = makeRng(31771);
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 22; i++) {
    const x = W * (0.5 + (rng() - 0.5) * 0.95);
    const y = H * (0.5 + (rng() - 0.5) * 0.55);
    const rx = W * (0.1 + rng() * 0.26);
    const ry = rx * (0.1 + rng() * 0.2);
    const grad = g.createRadialGradient(x, y, 0, x, y, rx);
    const a = 0.22 + rng() * 0.3;
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(0.55, `rgba(255,255,255,${a * 0.55})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    g.translate(-x, -y);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // 上下左右渐隐，plane 边缘不会出现硬边
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createLinearGradient(0, 0, 0, H);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.22, 'rgba(0,0,0,0.85)');
  fade.addColorStop(0.78, 'rgba(0,0,0,0.85)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, W, H);
  const fadeX = g.createLinearGradient(0, 0, W, 0);
  fadeX.addColorStop(0, 'rgba(0,0,0,0)');
  fadeX.addColorStop(0.12, 'rgba(0,0,0,1)');
  fadeX.addColorStop(0.88, 'rgba(0,0,0,1)');
  fadeX.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fadeX;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  _fogTex = canvasTexture(c);
  return _fogTex;
}

/** 飞鸟：一笔「人」字，两翼各一道弧，远处看就是一个小墨点。 */
let _birdTex = null;
function birdTexture() {
  if (_birdTex) return _birdTex;
  const S = 64;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.strokeStyle = 'rgba(28,34,37,0.96)';
  g.lineCap = 'round';
  g.lineWidth = 4.2;
  g.beginPath();
  g.moveTo(5, 25);
  g.quadraticCurveTo(19, 11, 32, 29);
  g.stroke();
  g.beginPath();
  g.moveTo(32, 29);
  g.quadraticCurveTo(45, 11, 59, 25);
  g.stroke();
  g.fillStyle = 'rgba(28,34,37,0.96)';
  g.beginPath();
  g.ellipse(32, 31, 4.4, 2.4, 0, 0, Math.PI * 2);
  g.fill();
  _birdTex = canvasTexture(c);
  return _birdTex;
}

/* -------------------------------------------------------------------------- */
/*  一、山                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 山体高度：layout.terrainHeight 的宏观山形 + 多峰起伏。
 * 平原 / 湖盆保持 0；长城沿线噪声淡出（城墙要贴地）；
 * 远处山体放大，才撑得起「远山如黛」的体量。
 */
function mountainHeight(x, z, base) {
  let b = base === undefined ? terrainHeight(x, z) : base;
  if (b < 0.02) return b;
  const wallDist = distToPolyline(x, z, GREAT_WALL.points);
  const wallFade = smoothstep(7, 32, wallDist);
  const dist = Math.hypot(x, z);
  const grow = 1 + 1.55 * smoothstep(410, 700, dist) * smoothstep(16, 96, wallDist);
  b *= grow;
  if (wallFade <= 0) return b;

  const far = smoothstep(340, 720, dist);
  const big = fbm2(x * 0.0082, z * 0.0082, 433, 3); // 大起大落
  const mid = fbm2(x * 0.021, z * 0.021, 911, 2); // 中频：多峰
  const ridge = Math.pow(1 - Math.abs(fbm2(x * 0.012, z * 0.012, 137, 3)), 1.6);
  const amp = b * (0.08 + 0.42 * far) * (0.4 + 0.6 * ridge);
  return b + (big * 0.95 + mid * 0.46) * amp * wallFade;
}

/** 山面乘的「刷痕」噪声：横向拉长的淡墨，让山不是一块平色。 */
let _mtnNoise = null;
function mountainNoiseTexture() {
  if (_mtnNoise) return _mtnNoise;
  const S = 512;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n1 = fbm2(x / 96, y / 24, 41, 4); // 横向刷痕
      const n2 = fbm2(x / 17, y / 21, 77, 3); // 细皴
      const v = 238 + n1 * 26 + n2 * 12;
      const i = (y * S + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = v < 0 ? 0 : v > 255 ? 255 : v;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  _mtnNoise = canvasTexture(c);
  _mtnNoise.wrapS = _mtnNoise.wrapT = THREE.RepeatWrapping;
  return _mtnNoise;
}

/** 墨阶：近山重、中景淡、远山化纸。 */
const MTN_BANDS = [
  [210, 0x8b9592], // 近山：淡墨（参考实测 139,149,146）
  [340, 0x97a09b],
  [470, 0xa6ada7],
  [600, 0xb3b9b3], // 中景
  [760, 0xc1c6bf],
  [930, 0xd0d3ca],
  [1100, 0xdedfd6], // 远山：几乎化进纸里
  [1350, 0xeaeae0],
].map(([d, hex]) => [d, new THREE.Color(hex)]);

const MTN_LIGHT = new THREE.Vector3(0.45, 0.78, 0.44).normalize();
const _cPaper = new THREE.Color(P.PAPER);

function sampleBands(d, out) {
  if (d <= MTN_BANDS[0][0]) return out.copy(MTN_BANDS[0][1]);
  for (let i = 0; i < MTN_BANDS.length - 1; i++) {
    const [d0, c0] = MTN_BANDS[i];
    const [d1, c1] = MTN_BANDS[i + 1];
    if (d <= d1) {
      const k = clamp01((d - d0) / (d1 - d0));
      return out.copy(c0).lerp(c1, k);
    }
  }
  return out.copy(MTN_BANDS[MTN_BANDS.length - 1][1]);
}

/**
 * 山体顶点色：远近定墨层，高度定浓淡（山脊重墨），向背给一点体积，
 * 山脚化进纸里。面的笔触质感交给 mountainNoiseTexture。
 */
function mountainColor(x, z, y, hL, hR, hU, hD, dx, dz, out) {
  const dist = Math.hypot(x, z);
  sampleBands(dist, out);

  // 山脊只比山脚沉一点点（淡墨）
  const t = clamp01(y / 34);
  out.multiplyScalar(1.02 - t * 0.1);

  // 向背：东南来的天光
  const gx = (hR - hL) / Math.max(0.001, dx);
  const gz = (hD - hU) / Math.max(0.001, dz);
  const inv = 1 / Math.hypot(gx, 1, gz);
  const shade = clamp01(((-gx * MTN_LIGHT.x + MTN_LIGHT.y - gz * MTN_LIGHT.z) * inv) * 1.1);
  out.multiplyScalar(0.96 + 0.1 * shade);

  // 山脚化纸（网格边界也落在这里，看不到硬边）
  out.lerp(_cPaper, 1 - smoothstep(0.5, 5.0, y));
  return out;
}

function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

const RIBBONS = [...CANALS, ...RIVERS];

/** 水面所在格：山网格要在这里挖空，不然会把湖盖住。 */
function cellOverWater(x, z) {
  for (const lake of Object.values(LAKES)) {
    if (pointInPolygon(x, z, lake.points)) return true;
    const d = Math.hypot((x - lake.cx) / lake.rx, (z - lake.cz) / lake.rz);
    if (d < 1.06) return true;
  }
  for (const r of RIBBONS) {
    if (distToPolyline(x, z, r.points) < r.width * 0.95) return true;
  }
  return false;
}

/**
 * 山体网格：以城为中心的**极坐标网格**——近城密、远处疏，
 * 外边界用噪声做成不规则的一圈，再在颜色里化进纸里，
 * 所以任何角度都看不到直边方块。
 */
function buildMountains() {
  const group = new THREE.Group();
  group.name = 'mountains';

  // 半径：近密远疏
  const radii = [];
  let r = 235;
  while (r < 1120) {
    radii.push(r);
    r += r < 430 ? 5.5 : r < 700 ? 9.5 : r < 940 ? 17 : 30;
  }
  const ANG = 288;
  const rows = radii.length;
  const cols = ANG;
  const pos = new Float32Array(rows * cols * 3);
  const col = new Float32Array(rows * cols * 3);
  const uv = new Float32Array(rows * cols * 2);

  // 预采样高度
  const H = new Float32Array(rows * cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = (j / cols) * Math.PI * 2;
      const x = Math.cos(a) * radii[i];
      const z = Math.sin(a) * radii[i];
      H[i * cols + j] = mountainHeight(x, z);
    }
  }

  const color = new THREE.Color();
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = (j / cols) * Math.PI * 2;
      const x = Math.cos(a) * radii[i];
      const z = Math.sin(a) * radii[i];
      const y = H[i * cols + j];
      const idx = (i * cols + j) * 3;
      pos[idx] = x;
      pos[idx + 1] = y;
      pos[idx + 2] = z;
      uv[(i * cols + j) * 2] = x * 0.0042;
      uv[(i * cols + j) * 2 + 1] = z * 0.0042;

      const jL = (j - 1 + cols) % cols;
      const jR = (j + 1) % cols;
      const iU = Math.max(0, i - 1);
      const iD = Math.min(rows - 1, i + 1);
      const dxL = Math.cos(((j - 1 + cols) / cols) * Math.PI * 2) * radii[i];
      const dxR = Math.cos(((j + 1) / cols) * Math.PI * 2) * radii[i];
      mountainColor(
        x,
        z,
        y,
        H[i * cols + jL],
        H[i * cols + jR],
        H[iU * cols + j],
        H[iD * cols + j],
        Math.max(1, Math.abs(dxR - dxL)),
        Math.max(1, radii[iD] - radii[iU]),
        color,
      );
      col[idx] = color.r;
      col[idx + 1] = color.g;
      col[idx + 2] = color.b;
    }
  }

  // 不规则外边界：每个角度的最大半径带噪声
  const maxR = new Float32Array(cols);
  for (let j = 0; j < cols; j++) {
    const a = (j / cols) * Math.PI * 2;
    const n = fbm2(Math.cos(a) * 2.4, Math.sin(a) * 2.4, 517, 3);
    maxR[j] = 980 + n * 120 + (Math.sin(a * 3.0) * 0.5 + 0.5) * 90;
  }

  const indices = [];
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols; j++) {
      const j2 = (j + 1) % cols;
      const a = (j / cols) * Math.PI * 2;
      const rm = radii[i] + 4;
      // 太远（超出不规则边界）就不画
      if (rm > maxR[j]) continue;
      const h00 = H[i * cols + j];
      const h10 = H[i * cols + j2];
      const h01 = H[(i + 1) * cols + j];
      const h11 = H[(i + 1) * cols + j2];
      if (h00 < 0.7 && h10 < 0.7 && h01 < 0.7 && h11 < 0.7) continue;
      const mx = Math.cos(a) * rm;
      const mz = Math.sin(a) * rm;
      if (cellOverWater(mx, mz)) continue;
      const A = i * cols + j;
      const B = i * cols + j2;
      const C = (i + 1) * cols + j;
      const D = (i + 1) * cols + j2;
      // 朝上（法线 +Y）
      indices.push(A, B, C, B, D, C);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  // 山面：不吃场景雾（自带远近墨层），也不写深度——
  // 这样 InkPost 不会在山面上描出重墨等高线，山脊保持「淡墨」
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    map: mountainNoiseTexture(),
    fog: false,
    toneMapped: false,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'mountain-mesh';
  mesh.frustumCulled = false;
  group.add(mesh);
  group.userData.tris = indices.length / 3;
  group.userData.counts = { verts: rows * cols, rings: rows };
  return group;
}

/**
 * 手绘远山背板：一张 360° 无缝画布（三层山脊 + 云气 + 留白），
 * 贴在半径 1250 的圆筒内壁——3D 山化进纸之后，天际线仍是画出来的。
 */
let _ridgeTex = null;
function paintedRidgeTexture() {
  if (_ridgeTex) return _ridgeTex;
  const W = 2048;
  const H = 1024; // 画布很高：上半部透明，圆筒上沿永远不会从高处露出直边
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const rng = makeRng(20260718);

  // 三道远山：从 canvas y≈700 起，向下填到画布底
  const layers = [
    { top: 700, amp: 26, color: [152, 160, 154], alpha: 0.34, freqs: [2, 3, 5, 8], w: [1, 0.6, 0.36, 0.2], ridge: 0.6 },
    { top: 762, amp: 32, color: [118, 128, 123], alpha: 0.42, freqs: [1, 2, 4, 7], w: [1, 0.7, 0.42, 0.24], ridge: 0.9 },
    { top: 840, amp: 36, color: [84, 96, 92], alpha: 0.5, freqs: [1, 3, 6, 9], w: [1, 0.55, 0.3, 0.16], ridge: 1.2 },
  ];
  const phases = layers.map(() => Array.from({ length: 8 }, () => rng() * Math.PI * 2));

  for (let li = 0; li < layers.length; li++) {
    const L = layers[li];
    const ph = phases[li];
    const pts = [];
    for (let x = 0; x <= W; x += 2) {
      const t = x / W;
      let v = 0;
      let norm = 0;
      for (let k = 0; k < L.freqs.length; k++) {
        v += Math.sin(t * Math.PI * 2 * L.freqs[k] + ph[k]) * L.w[k];
        norm += L.w[k];
      }
      v /= norm;
      const n = fbm2(t * 26, li * 5.3, 13 + li, 4) * 0.2;
      pts.push([x, L.top - L.amp * (v * 0.9 + n * L.ridge)]);
    }
    // 只画一条「山影带」：向下 120px 渐隐，圆筒下半截保持透明，
    // 这样纸面之外不会出现一大片灰色
    const bandBottom = L.top + 120;
    const grad = g.createLinearGradient(0, L.top - L.amp, 0, bandBottom);
    grad.addColorStop(0, `rgba(${L.color[0]},${L.color[1]},${L.color[2]},${L.alpha})`);
    grad.addColorStop(0.5, `rgba(${L.color[0]},${L.color[1]},${L.color[2]},${L.alpha * 0.55})`);
    grad.addColorStop(1, `rgba(${L.color[0]},${L.color[1]},${L.color[2]},0)`);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, bandBottom);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.lineTo(W, bandBottom);
    g.closePath();
    g.fill();
    // 山脊线
    g.strokeStyle = `rgba(${L.color[0] - 18},${L.color[1] - 18},${L.color[2] - 18},${L.alpha * 0.65})`;
    g.lineWidth = 1.8;
    g.beginPath();
    for (let i = 0; i < pts.length; i++) {
      if (i === 0) g.moveTo(pts[i][0], pts[i][1]);
      else g.lineTo(pts[i][0], pts[i][1]);
    }
    g.stroke();
  }
  // 底部云气：把山脚化进纸
  const mist = g.createLinearGradient(0, H * 0.9, 0, H);
  mist.addColorStop(0, 'rgba(241,233,215,0)');
  mist.addColorStop(0.5, 'rgba(241,233,215,0.85)');
  mist.addColorStop(1, 'rgba(241,233,215,1)');
  g.fillStyle = mist;
  g.fillRect(0, H * 0.9, W, H * 0.1);
  _ridgeTex = canvasTexture(c);
  _ridgeTex.wrapS = THREE.RepeatWrapping;
  return _ridgeTex;
}

function buildPaintedRidges() {
  const group = new THREE.Group();
  group.name = 'painted-ridges';
  const radius = 1250;
  const height = 880;
  const geo = new THREE.CylinderGeometry(radius, radius, height, 96, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    map: paintedRidgeTexture(),
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
    opacity: 0.9,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.position.set(0, height * 0.5 - 60, 0);
  ring.renderOrder = -3;
  group.add(ring);
  return group;
}

/** 一两座山寺/塔的淡墨剪影，给西山一点地标。 */
let _pagodaTex = null;
function pagodaTexture() {
  if (_pagodaTex) return _pagodaTex;
  const W = 96;
  const H = 192;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(48,58,58,0.82)';
  g.strokeStyle = 'rgba(48,58,58,0.82)';
  const cx = W / 2;
  // 台基
  g.fillRect(cx - 20, H - 30, 40, 12);
  // 五层塔身 + 檐
  let y = H - 34;
  let w = 26;
  for (let k = 0; k < 5; k++) {
    const bh = 16;
    g.fillRect(cx - w * 0.34, y - bh, w * 0.68, bh);
    // 檐
    g.beginPath();
    g.moveTo(cx - w * 0.72, y - bh);
    g.quadraticCurveTo(cx, y - bh - 10, cx + w * 0.72, y - bh);
    g.lineTo(cx + w * 0.52, y - bh + 2);
    g.lineTo(cx - w * 0.52, y - bh + 2);
    g.closePath();
    g.fill();
    y -= bh + 3;
    w *= 0.84;
  }
  // 塔刹
  g.fillRect(cx - 1.6, y - 22, 3.2, 22);
  g.beginPath();
  g.arc(cx, y - 24, 4, 0, Math.PI * 2);
  g.fill();
  _pagodaTex = canvasTexture(c);
  return _pagodaTex;
}

function buildPagodas(ctx) {
  const group = new THREE.Group();
  group.name = 'pagodas';
  const { camera } = ctx;
  const mat = new THREE.MeshBasicMaterial({
    map: pagodaTexture(),
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    fog: false,
    side: THREE.DoubleSide,
    opacity: 0.85,
  });
  const spots = [
    [-u(17800), -u(2600)], // 玉泉山方向
    [-u(21000), u(1800)], // 香山方向
  ];
  const sprites = [];
  for (const [x, z] of spots) {
    const geo = new THREE.PlaneGeometry(9, 18);
    const m = new THREE.Mesh(geo, mat);
    const y = mountainHeight(x, z);
    m.position.set(x, y + 8.6, z);
    m.renderOrder = 6;
    group.add(m);
    sprites.push(m);
  }
  if (typeof ctx.onTick === 'function') {
    const q = new THREE.Quaternion();
    ctx.onTick(() => {
      q.copy(camera.quaternion);
      for (const m of sprites) m.quaternion.copy(q);
    });
  }
  return group;
}

/* -------------------------------------------------------------------------- */
/*  二、雾带                                                                    */
/* -------------------------------------------------------------------------- */

function buildFog(ctx) {
  const group = new THREE.Group();
  group.name = 'fog';
  const { tex } = ctx;

  const addBand = ({ x, y, z, w, h, repeat, opacity, tint, amp, phase, tilt, ry = 0 }) => {
    const map = fogTexture().clone();
    map.needsUpdate = true;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeat, 1);
    const mat = new THREE.MeshBasicMaterial({
      map,
      color: tint,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.scale.set(w, h, 1);
    mesh.position.set(x, y, z);
    mesh.rotation.set(tilt || 0, ry, 0);
    mesh.renderOrder = 30;
    group.add(mesh);
    return mesh;
  };

  // 燕山山脚：三层横雾，贴着山根，别挡在城与山之间
  addBand({ x: 0, y: 13, z: -u(14200), w: 1500, h: 34, repeat: 3.4, opacity: 0.5, tint: 0xf7f1e4, amp: 60, phase: 0, tilt: -0.06 });
  addBand({ x: -40, y: 22, z: -u(17600), w: 1650, h: 46, repeat: 3.0, opacity: 0.34, tint: 0xf3ecdf, amp: 75, phase: 2.1, tilt: -0.1 });
  addBand({ x: 30, y: 32, z: -u(22000), w: 1800, h: 62, repeat: 2.6, opacity: 0.2, tint: 0xefe8dc, amp: 90, phase: 4.2, tilt: -0.14 });
  addBand({ x: -60, y: 48, z: -u(32000), w: 2000, h: 100, repeat: 2.2, opacity: 0.12, tint: 0xefe8dc, amp: 100, phase: 1.4, tilt: -0.2 });
  // 西山一侧：沿南北方向铺开
  addBand({ x: -u(16000), y: 18, z: -u(1800), w: 1700, h: 50, repeat: 3.0, opacity: 0.26, tint: 0xf2ebdf, amp: 45, phase: 3.3, tilt: -0.1, ry: Math.PI / 2 });
  // 城郊一层贴地薄雾
  {
    const map = fogTexture().clone();
    map.needsUpdate = true;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(3.2, 2.4);
    const mat = new THREE.MeshBasicMaterial({
      map,
      color: 0xf7f1e4,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.scale.set(620, 440, 1);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(-10, 0.5, -20);
    mesh.renderOrder = 29;
    group.add(mesh);
  }

  // 山顶云气：在山脊上慢慢飘的几团
  for (const [cx, cy, cz, cw, ch, cop] of [
    [-260, 42, -u(15000), 420, 70, 0.16],
    [60, 58, -u(18500), 360, 62, 0.13],
    [-520, 34, -u(11000), 300, 54, 0.12],
  ]) {
    const map = fogTexture().clone();
    map.needsUpdate = true;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(2, 1);
    const mat = new THREE.MeshBasicMaterial({
      map,
      color: 0xf3ecdf,
      transparent: true,
      opacity: cop,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.scale.set(cw, ch, 1);
    mesh.position.set(cx, cy, cz);
    mesh.rotation.set(-0.12, 0, 0);
    mesh.renderOrder = 31;
    group.add(mesh);
  }

  const bands = group.children.map((mesh, i) => ({
    mesh,
    basePos: mesh.position.clone(),
    speed: 0.4 + (i % 3) * 0.25,
    amp: 22 + i * 7,
    phase: i * 1.7,
    bob: 0.5 + (i % 2) * 0.5,
    horizontal: i === 5,
  }));

  if (typeof ctx.onTick === 'function') {
    ctx.onTick((time) => {
      const t = typeof time === 'number' ? time : 0;
      for (const b of bands) {
        const m = b.mesh;
        const drift = Math.sin(t * b.speed * 0.13 + b.phase) * b.amp;
        if (b.horizontal) {
          m.position.z = b.basePos.z + drift;
          m.position.x = b.basePos.x + Math.sin(t * b.speed * 0.21 + b.phase) * 2;
        } else {
          m.position.x = b.basePos.x + drift;
        }
        m.position.y = b.basePos.y + Math.sin(t * b.speed * 0.34 + b.phase * 2.3) * b.bob;
      }
    });
  }
  return group;
}

/* -------------------------------------------------------------------------- */
/*  三、树（统一用 lib/flora.js 的笔触树）                                        */
/* -------------------------------------------------------------------------- */

function inLake(x, z) {
  for (const lake of Object.values(LAKES)) {
    if (pointInPolygon(x, z, lake.points)) return true;
    const d = Math.hypot((x - lake.cx) / lake.rx, (z - lake.cz) / lake.rz);
    if (d < 0.98) return true;
  }
  return false;
}

function inMoat(x, z) {
  const o = MOAT.outer;
  const i = MOAT.inner;
  const inOuter = Math.abs(x) <= o.halfX && z >= o.north && z <= o.south;
  const inInner = Math.abs(x) <= i.halfX && z >= i.north && z <= i.south;
  return inOuter && !inInner;
}

/** 不能种树的地方（地标 / 宫城 / 水面）。 */
const NO_TREE_RECTS = [
  { x0: -PALACE.halfW - 1.2, x1: PALACE.halfW + 1.2, z0: PALACE.north - 1.4, z1: PALACE.south + 1.4 },
  { x0: 15, x1: 53, z0: 52, z1: 90 }, // 天坛（landmarks 负责柏树林）
  { x0: -8.5, x1: 8.5, z0: -21, z1: -5 }, // 景山
  { x0: -u(12200), x1: -u(10700), z0: -u(12200), z1: -u(10200) }, // 万寿山（landmarks 负责）
];

const NO_TREE_CIRCLES = [
  { x: -u(1450), z: -u(900), r: u(560) }, // 北海琼华岛
  { x: 0, z: -u(2900), r: 7 }, // 钟鼓楼
  { x: -24, z: 21, r: 6.0 }, // 国家大剧院水池（modern 模块自带水面）
  { x: u(1600), z: -u(9800), r: 6 }, // 十七孔桥东桥头
  ...GATES.map((g) => ({ x: g.x, z: g.z, r: 4.5 })),
];

function blockedForTree(x, z) {
  for (const r of NO_TREE_RECTS) {
    if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return true;
  }
  for (const c of NO_TREE_CIRCLES) {
    if (Math.hypot(x - c.x, z - c.z) < c.r) return true;
  }
  if (inLake(x, z)) return true;
  if (inMoat(x, z)) return true;
  for (const r of RIBBONS) {
    if (distToPolyline(x, z, r.points) < r.width * 0.7) return true;
  }
  return false;
}

/** 岸边柳 / 湖边柳：贴着水走一圈。 */
function willowSpecs(rng, quality) {
  const out = [];
  const k = quality === 'low' ? 0.55 : 1;

  // 护城河外圈
  {
    const o = MOAT.outer;
    const path = [
      [-o.halfX, o.north],
      [o.halfX, o.north],
      [o.halfX, o.south],
      [-o.halfX, o.south],
      [-o.halfX, o.north],
    ];
    for (let s = 0; s < path.length - 1; s++) {
      const [ax, az] = path[s];
      const [bx, bz] = path[s + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const count = Math.max(2, Math.floor((len / 5.2) * k));
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5 + (rng() - 0.5) * 0.7) / count;
        let x = ax + (bx - ax) * t;
        let z = az + (bz - az) * t;
        const nl = Math.hypot(x, z) || 1;
        const off = 1.7 + rng() * 2.4;
        x += (x / nl) * off;
        z += (z / nl) * off;
        if (inLake(x, z)) continue;
        out.push({ kind: 'willow', x, z, y: 0, h: 1.05 + rng() * 0.55, rot: rng() * Math.PI * 2 });
      }
    }
  }

  // 湖边
  const LAKE_WILLOWS = { beihai: 20, zhongnanhai: 12, shichahai: 16, kunming: 30 };
  for (const [key, count] of Object.entries(LAKE_WILLOWS)) {
    const lake = LAKES[key];
    if (!lake) continue;
    const n = Math.max(4, Math.round(count * k));
    for (let i = 0; i < n; i++) {
      const a0 = lake.points[Math.floor(rng() * lake.points.length)];
      const a1 = lake.points[(lake.points.indexOf(a0) + 1) % lake.points.length];
      const t = rng();
      let x = a0[0] + (a1[0] - a0[0]) * t;
      let z = a0[1] + (a1[1] - a0[1]) * t;
      const dx = x - lake.cx;
      const dz = z - lake.cz;
      const len = Math.hypot(dx, dz) || 1;
      const off = 1.3 + rng() * 2.6;
      x += (dx / len) * off;
      z += (dz / len) * off;
      if (inLake(x, z)) continue;
      out.push({ kind: 'willow', x, z, y: 0, h: 1.0 + rng() * 0.6, rot: rng() * Math.PI * 2 });
    }
  }

  // 河道两岸
  for (const canal of CANALS) {
    const hw = canal.width / 2;
    const pts = canal.points;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i - 1];
      const [x1, z1] = pts[i + 1];
      const dx = x1 - x0;
      const dz = z1 - z0;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      const count = Math.max(1, Math.round(2 * k));
      for (let c = 0; c < count; c++) {
        const side = rng() < 0.5 ? 1 : -1;
        const off = hw + 1.3 + rng() * 2.4;
        out.push({
          kind: 'willow',
          x: pts[i][0] + nx * side * off + (rng() - 0.5) * 2,
          z: pts[i][1] + nz * side * off + (rng() - 0.5) * 2,
          y: 0,
          h: 0.95 + rng() * 0.5,
          rot: rng() * Math.PI * 2,
        });
      }
    }
  }
  return out;
}

/** 胡同槐：沿东西向街巷点状，不铺满。 */
function locustSpecs(rng, quality) {
  const out = [];
  const k = quality === 'low' ? 0.5 : 1;
  const zLines = [];
  for (let z = INNER_CITY.north + 7; z < INNER_CITY.south - 5; z += 9.2) zLines.push(z);
  for (let z = OUTER_CITY.north + 8; z < OUTER_CITY.south - 5; z += 10.5) zLines.push(z);

  for (const zBase of zLines) {
    for (let x = -INNER_CITY.halfX + 4; x < INNER_CITY.halfX - 4; x += 6.8) {
      if (rng() > 0.42 * k + 0.12) continue;
      const px = x + (rng() - 0.5) * 2.2;
      const pz = zBase + (rng() - 0.5) * 2.0;
      if (blockedForTree(px, pz)) continue;
      out.push({ kind: 'locust', x: px, z: pz, y: 0, h: 0.72 + rng() * 0.42, rot: rng() * Math.PI * 2 });
    }
  }

  // 城外零散树
  const extra = Math.round(18 * k);
  for (let i = 0; i < extra; i++) {
    const a = rng() * Math.PI * 2;
    const r = u(3800) + rng() * u(5600);
    const px = Math.cos(a) * r;
    const pz = Math.sin(a) * r * 0.8;
    if (blockedForTree(px, pz)) continue;
    if (terrainHeight(px, pz) > 1.0) continue;
    out.push({ kind: 'locust', x: px, z: pz, y: 0, h: 0.7 + rng() * 0.4, rot: rng() * Math.PI * 2 });
  }
  return out;
}

/** 山松：成片，贴着山体网格的高度落。 */
function pineSpecs(rng, quality) {
  const out = [];
  const target = quality === 'low' ? 240 : 600;
  let guard = 0;
  while (out.length < target && guard++ < target * 12) {
    const north = rng() < 0.62;
    let x;
    let z;
    if (north) {
      x = -u(11000) + rng() * u(15000);
      z = -u(13800) - rng() * u(11500);
    } else {
      x = -u(13800) - rng() * u(10000);
      z = -u(9000) + rng() * u(16000);
    }
    const base = terrainHeight(x, z);
    if (base < 0.45 || base > 14) continue;
    if (cellOverWater(x, z)) continue;
    // 避开长城脚下，免得树钻进墙里
    if (distToPolyline(x, z, GREAT_WALL.points) < 2.2) continue;
    const y = mountainHeight(x, z, base) - 0.04;
    const h = 0.52 + rng() * 0.42;
    out.push({ kind: 'pine', x, z, y, h, rot: rng() * Math.PI * 2 });
    if (rng() < 0.6) {
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const px = x + (rng() - 0.5) * 3.6;
        const pz = z + (rng() - 0.5) * 3.6;
        const pb = terrainHeight(px, pz);
        if (pb < 0.35 || pb > 16) continue;
        if (cellOverWater(px, pz)) continue;
        if (distToPolyline(px, pz, GREAT_WALL.points) < 2.2) continue;
        out.push({ kind: 'pine', x: px, z: pz, y: mountainHeight(px, pz, pb) - 0.04, h: 0.46 + rng() * 0.38, rot: rng() * Math.PI * 2 });
      }
    }
  }
  return out;
}

/** 少量粉白海棠：宫墙 / 湖边 / 河岸。 */
function blossomSpecs(rng, quality) {
  const out = [];
  const target = quality === 'low' ? 20 : 44;
  const lakes = Object.values(LAKES);
  for (let i = 0; i < target; i++) {
    if (rng() < 0.55) {
      const side = Math.floor(rng() * 4);
      let x;
      let z;
      if (side === 0) {
        x = -PALACE.halfW - 1.4 - rng() * 2.6;
        z = PALACE.north + rng() * (PALACE.south - PALACE.north);
      } else if (side === 1) {
        x = PALACE.halfW + 1.4 + rng() * 2.6;
        z = PALACE.north + rng() * (PALACE.south - PALACE.north);
      } else if (side === 2) {
        x = -PALACE.halfW + rng() * PALACE.w;
        z = PALACE.south + 1.4 + rng() * 2.6;
      } else {
        x = -PALACE.halfW + rng() * PALACE.w;
        z = PALACE.north - 1.4 - rng() * 2.6;
      }
      if (!blockedForTree(x, z)) out.push({ kind: 'blossom', x, z, y: 0, h: 0.55 + rng() * 0.3, rot: rng() * Math.PI * 2 });
    } else {
      const lake = lakes[Math.floor(rng() * lakes.length)];
      const p = lake.points[Math.floor(rng() * lake.points.length)];
      const dx = p[0] - lake.cx;
      const dz = p[1] - lake.cz;
      const len = Math.hypot(dx, dz) || 1;
      const off = 1.1 + rng() * 2.6;
      const x = p[0] + (dx / len) * off;
      const z = p[1] + (dz / len) * off;
      if (!blockedForTree(x, z) && !inLake(x, z)) out.push({ kind: 'blossom', x, z, y: 0, h: 0.5 + rng() * 0.3, rot: rng() * Math.PI * 2 });
    }
  }
  return out;
}

function buildTreesSection(ctx) {
  const group = new THREE.Group();
  group.name = 'trees';
  const rng = makeRng(20261105);
  const quality = ctx.quality;

  const specs = [
    ...willowSpecs(rng, quality),
    ...locustSpecs(rng, quality),
    ...pineSpecs(rng, quality),
    ...blossomSpecs(rng, quality),
  ];
  group.add(buildTrees(specs, ctx));
  group.userData.count = specs.length;
  return group;
}

/* -------------------------------------------------------------------------- */
/*  四、飞鸟                                                                    */
/* -------------------------------------------------------------------------- */

function buildBirds(ctx) {
  const group = new THREE.Group();
  group.name = 'birds';
  const { tex, camera } = ctx;

  const FLOCKS = [
    { cx: 2, cy: 14, cz: -u(1000), r: 19, dr: 5, speed: 0.16, count: 10, size: 3.5 },
    { cx: 0, cy: 18, cz: -u(2900), r: 13, dr: 4, speed: -0.22, count: 8, size: 3.2 },
    { cx: u(1500), cy: 12, cz: u(1200), r: 16, dr: 5, speed: 0.12, count: 7, size: 3.0 },
  ];

  const birds = [];
  const rng = makeRng(7749);
  for (const f of FLOCKS) {
    for (let i = 0; i < f.count; i++) {
      birds.push({
        flock: f,
        angle: rng() * Math.PI * 2,
        radius: f.r * (0.62 + rng() * 0.5),
        y: f.cy + (rng() - 0.5) * f.dr,
        yPhase: rng() * Math.PI * 2,
        size: f.size * (0.8 + rng() * 0.45),
        phase: rng() * Math.PI * 2,
      });
    }
  }

  const geo = new THREE.PlaneGeometry(1, 0.52);
  const mat = new THREE.MeshBasicMaterial({
    map: birdTexture(),
    color: 0x252d30,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: true,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, birds.length);
  mesh.frustumCulled = false;
  mesh.name = 'bird-flocks';
  mesh.renderOrder = 40;
  group.add(mesh);

  const dummy = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const qcam = new THREE.Quaternion();

  if (typeof ctx.onTick === 'function') {
    ctx.onTick((time) => {
      const t = typeof time === 'number' ? time : 0;
      qcam.copy(camera.quaternion);
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i];
        const f = b.flock;
        const a = b.angle + t * f.speed;
        pos.set(f.cx + Math.cos(a) * b.radius, b.y + Math.sin(t * 0.55 + b.yPhase) * 1.1, f.cz + Math.sin(a) * b.radius * 0.72);
        const flap = 1 + 0.3 * Math.sin(t * 5.6 + b.phase);
        scl.set(b.size * flap, b.size * (0.78 + 0.22 * Math.sin(t * 2.8 + b.phase)), 1);
        dummy.compose(pos, qcam, scl);
        mesh.setMatrixAt(i, dummy);
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
  }
  group.userData.count = birds.length;
  return group;
}

/* -------------------------------------------------------------------------- */
/*  五、日                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 太阳：画在留白里的一轮暖日。
 * 用 tex.glow 的径向渐变同时做「核心」和「光晕」——没有边、没有描边，
 * 只跟着相机固定在画面右上方；暮色更低、更红、更暗。
 */
function buildSun(ctx) {
  const group = new THREE.Group();
  group.name = 'sun';
  const { tex, camera } = ctx;

  const haloMat = new THREE.SpriteMaterial({
    map: tex.glow,
    color: 0xeec49a,
    transparent: true,
    opacity: 0.3,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
  });
  const coreMat = new THREE.SpriteMaterial({
    map: tex.glow,
    color: 0xe8bd90,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
    fog: false,
  });

  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(280);
  halo.renderOrder = 100;
  const core = new THREE.Sprite(coreMat);
  core.scale.setScalar(120);
  core.renderOrder = 101;
  group.add(halo, core);
  group.renderOrder = 100;

  const DAY_CORE = new THREE.Color(0xdda36c);
  const DUSK_CORE = new THREE.Color(0xc9603a);
  const DAY_HALO = new THREE.Color(0xefc79c);
  const DUSK_HALO = new THREE.Color(0xd0653c);
  const DAY_OFF = new THREE.Vector3(0.3, 0.235, -1);
  const DUSK_OFF = new THREE.Vector3(0.32, 0.1, -1);
  const offset = new THREE.Vector3();
  let blend = 0;

  const apply = () => {
    offset.copy(DAY_OFF).lerp(DUSK_OFF, blend).normalize().multiplyScalar(1000);
    offset.applyQuaternion(camera.quaternion);
    group.position.copy(camera.position).add(offset);
    coreMat.color.copy(DAY_CORE).lerp(DUSK_CORE, blend);
    haloMat.color.copy(DAY_HALO).lerp(DUSK_HALO, blend);
    haloMat.opacity = 0.28 + blend * 0.22;
    coreMat.opacity = 0.92 - blend * 0.08;
    halo.scale.setScalar(280 + blend * 60);
    core.scale.setScalar(120 + blend * 10);
  };

  const isDusk = () => {
    const t = document.body && document.body.dataset && document.body.dataset.time;
    return t === 'dusk';
  };

  if (typeof ctx.onTick === 'function') {
    ctx.onTick((time, delta) => {
      const dt = typeof delta === 'number' && delta > 0 && delta < 0.5 ? delta : 0.016;
      blend += ((isDusk() ? 1 : 0) - blend) * Math.min(1, dt * 2.2);
      apply();
    });
  }
  apply();
  return group;
}

/* -------------------------------------------------------------------------- */
/*  六、灯笼                                                                    */
/* -------------------------------------------------------------------------- */

function buildLanterns(ctx) {
  const group = new THREE.Group();
  group.name = 'lanterns';
  const { tex } = ctx;

  const specs = [];
  const rng = makeRng(3311);

  // 前门大街两侧
  for (let z = INNER_CITY.south + 2; z < OUTER_CITY.south - 2; z += 4.6) {
    for (const side of [-1, 1]) specs.push({ x: side * 2.0, y: 2.4, z });
  }
  // 宫墙一圈
  {
    for (const z of [PALACE.north, PALACE.south]) {
      for (let x = -PALACE.halfW + 2; x < PALACE.halfW; x += 6.2) {
        specs.push({ x, y: 2.0, z: z + (z > 0 ? 1.3 : -1.3) });
      }
    }
    for (const x of [-PALACE.halfW, PALACE.halfW]) {
      for (let z = PALACE.north + 2; z < PALACE.south; z += 6.4) {
        specs.push({ x: x + (x > 0 ? 1.3 : -1.3), y: 2.0, z });
      }
    }
  }
  // 城门
  for (const g of GATES) {
    specs.push({ x: g.x - 3.4, y: 2.5, z: g.z });
    specs.push({ x: g.x + 3.4, y: 2.5, z: g.z });
  }

  const bodyGeo = new THREE.BoxGeometry(0.22, 0.3, 0.22);
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x5a2418, toneMapped: false });
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, specs.length);
  const dummy = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);
  const q = new THREE.Quaternion();
  specs.forEach((s, i) => {
    pos.set(s.x, s.y, s.z);
    dummy.compose(pos, q, scl);
    bodies.setMatrixAt(i, dummy);
  });
  bodies.instanceMatrix.needsUpdate = true;
  bodies.frustumCulled = false;
  bodies.name = 'lantern-bodies';
  group.add(bodies);

  const glowPos = new Float32Array(specs.length * 3);
  specs.forEach((s, i) => {
    glowPos[i * 3] = s.x;
    glowPos[i * 3 + 1] = s.y;
    glowPos[i * 3 + 2] = s.z;
  });
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  glowGeo.computeBoundingSphere();
  const glowMat = new THREE.PointsMaterial({
    map: tex.glow,
    color: 0xff7d4e,
    size: 3.4,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.03,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: true,
  });
  const glows = new THREE.Points(glowGeo, glowMat);
  glows.frustumCulled = false;
  glows.renderOrder = 45;
  glows.name = 'lantern-glows';
  group.add(glows);

  const BODY_DAY = new THREE.Color(0x5a2418);
  const BODY_DUSK = new THREE.Color(0xd94a2a);
  let blend = 0;
  const isDusk = () => {
    const t = document.body && document.body.dataset && document.body.dataset.time;
    return t === 'dusk';
  };
  if (typeof ctx.onTick === 'function') {
    ctx.onTick((time, delta) => {
      const dt = typeof delta === 'number' && delta > 0 && delta < 0.5 ? delta : 0.016;
      blend += ((isDusk() ? 1 : 0) - blend) * Math.min(1, dt * 2.2);
      bodyMat.color.copy(BODY_DAY).lerp(BODY_DUSK, blend);
      glowMat.opacity = 0.03 + blend * 0.55;
      glowMat.size = 3.0 + blend * 1.8;
    });
  }
  group.userData.count = specs.length;
  return group;
}

/* -------------------------------------------------------------------------- */
/*  七、飘落物（柳絮 / 花瓣）                                                    */
/* -------------------------------------------------------------------------- */

function buildPetals(ctx) {
  const group = new THREE.Group();
  group.name = 'petals';
  const { renderer } = ctx;

  const COUNT = ctx.quality === 'low' ? 110 : 200;
  const rng = makeRng(66123);
  const positions = new Float32Array(COUNT * 3);
  const seeds = new Float32Array(COUNT * 2);
  const sizes = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = -u(5000) + rng() * u(10000);
    positions[i * 3 + 1] = 2 + rng() * 18;
    positions[i * 3 + 2] = -u(7000) + rng() * u(12000);
    seeds[i * 2] = rng();
    seeds[i * 2 + 1] = rng();
    sizes[i] = 2.0 + rng() * 2.8;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 2));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.computeBoundingSphere();

  const uniforms = {
    uTime: { value: 0 },
    uMap: { value: petalTexture() },
    uColor: { value: new THREE.Color(0xe9dccf) },
    uPixelRatio: { value: Math.min(renderer.getPixelRatio ? renderer.getPixelRatio() : 1, 2) },
  };

  const vert = /* glsl */ `
    attribute vec2 aSeed;
    attribute float aSize;
    uniform float uTime;
    uniform float uPixelRatio;
    varying float vAlpha;
    void main() {
      float span = 20.0;
      float speed = 0.3 + aSeed.x * 0.5;
      float y = mod(position.y - uTime * speed, span);
      vec3 p = position;
      p.y = y + 1.2;
      float ph = aSeed.y * 6.2831;
      p.x += sin(uTime * 0.3 + ph) * 1.4;
      p.z += cos(uTime * 0.25 + ph * 1.3) * 1.4;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = aSize * uPixelRatio * (240.0 / max(1.0, -mv.z));
      vAlpha = 0.4 + 0.35 * sin(uTime * 0.8 + ph);
    }
  `;
  const frag = /* glsl */ `
    uniform sampler2D uMap;
    uniform vec3 uColor;
    varying float vAlpha;
    void main() {
      vec4 t = texture2D(uMap, gl_PointCoord);
      float a = t.a * clamp(vAlpha, 0.0, 1.0) * 0.75;
      if (a < 0.015) discard;
      gl_FragColor = vec4(uColor, a);
      #include <colorspace_fragment>
    }
  `;
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.name = 'petals';
  group.add(points);

  if (typeof ctx.onTick === 'function') {
    ctx.onTick((time) => {
      uniforms.uTime.value = typeof time === 'number' ? time : 0;
    });
  }
  return group;
}

/* -------------------------------------------------------------------------- */
/*  主入口                                                                      */
/* -------------------------------------------------------------------------- */

export function buildNature(ctx) {
  const group = new THREE.Group();
  group.name = 'nature';

  group.add(buildPaintedRidges());
  const mountains = buildMountains();
  group.add(mountains);
  group.add(buildPagodas(ctx));
  const fog = buildFog(ctx);
  group.add(fog);
  const trees = buildTreesSection(ctx);
  group.add(trees);
  group.add(buildBirds(ctx));
  group.add(buildSun(ctx));
  group.add(buildLanterns(ctx));
  group.add(buildPetals(ctx));

  group.userData.stats = {
    mountainTris: mountains.userData.tris,
    trees: trees.userData.count,
  };
  return group;
}
