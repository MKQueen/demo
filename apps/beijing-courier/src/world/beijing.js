// 自建程序化北京资产包 · Procedural Beijing Asset Pack
// ---------------------------------------------------------------------------
// 全部资产由 Three.js 几何 + canvas 贴图在本文件内程序化生成，不加载任何外部模型。
// 所有材质来自 src/render/toon.js 的 createToonMaterial：与游戏场景共用 MRT 描边 +
// LUT 调色管线，所以风格（色块、硬边、深色描边、低多边形）与星球/角色一致。
//
// 对外接口：
//   buildBeijing({ scene, collision, spots, group })
//     -> { group, update(time, dt), landmarks, districts, ready, fontsReady, info() }
//   buildBeijingAssetGallery({ scene, group })
//     -> 资产陈列（工具页用），items 带 labelPosition
//
// 坐标系约定：
//   - 星球 Y 轴向上；本模块用「片区切平面坐标系」布置：
//       世界位置 = origin + right * x + up * y + forward * z
//     up = 片区中心的球面法线（径向）；right/forward 为切平面基。
//   - 每个资产 builder 都在自己的局部坐标系里建模：原点在脚底中心、+Y 向上、
//     +Z 正面朝向。放置时由片区自动套上切平面基。
//   - 角色身高 1.64，故院墙约 1.9、正房脊高约 3.1、鼓楼约 6.8、中国尊约 9.2。

import * as THREE from 'three';
import { createToonMaterial, makeCanvasTexture, box as toonBox, merge as mergeGeometry } from '../render/toon.js';

// ---------------------------------------------------------------------------
// 调色板（取色向现有卡通场景靠拢：奶油墙、灰瓦、砖红、邮政绿、天坛蓝）
// ---------------------------------------------------------------------------
const C = {
  roof: '#77807f',
  roofDark: '#5e6766',
  roofLight: '#8b9290',
  ridge: '#4f5857',
  cream: '#e7dfcd',
  creamDark: '#d6ccb5',
  creamLight: '#f0e9da',
  greyWall: '#aaaba2',
  greyWallDark: '#909289',
  stone: '#c9c4b4',
  stoneDark: '#a8a293',
  stoneLight: '#dad5c6',
  paving: '#b9b5a8',
  pavingDark: '#a09c8f',
  red: '#b6483c',
  redDark: '#8e352b',
  redLight: '#c65a47',
  imperial: '#a2443a',
  gold: '#d2a750',
  goldLight: '#e6c274',
  wood: '#8a6a4f',
  woodDark: '#6b4f3a',
  woodLight: '#a3825f',
  leaf: '#5b9f7b',
  leaf2: '#4e8c6d',
  leaf3: '#6aa982',
  leaf4: '#487f62',
  trunk: '#6f5a49',
  trunkDark: '#5b4a3c',
  postGreen: '#2f7d5a',
  postGreenDark: '#26674b',
  glass: '#7d98a6',
  glassDark: '#68828f',
  glassLight: '#9db3bd',
  templeBlue: '#3f6f8f',
  templeBlueDark: '#345d78',
  templeBlueLight: '#57849f',
  white: '#f2ede1',
  paper: '#f4ecd9',
  black: '#2f3334',
  ink: '#3a3e3f',
  warm: '#f0c46a',
  lantern: '#cf4a38',
  lanternDark: '#b03c2c',
  brickRed: '#9c5a45',
  brickRedDark: '#834835',
  brickRedLight: '#b06b52',
  concrete: '#b9b5a8',
  concreteDark: '#9c988c',
  sand: '#d9d0ba',
  water: '#5b8f95',
};

// ---------------------------------------------------------------------------
// 小工具：颜色 / 属性 / 合并
// ---------------------------------------------------------------------------
const _colorCache = new Map();
function color(hex) {
  if (!_colorCache.has(hex)) _colorCache.set(hex, new THREE.Color(hex));
  return _colorCache.get(hex);
}

function ensureAttribute(geometry, name, itemSize) {
  if (geometry.getAttribute(name)) return;
  const count = geometry.getAttribute('position').count;
  geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(count * itemSize), itemSize));
}

function colorize(geometry, hex) {
  const count = geometry.getAttribute('position').count;
  const attr = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
  const c = color(hex);
  for (let i = 0; i < count; i += 1) {
    attr.setXYZ(i, c.r, c.g, c.b);
  }
  geometry.setAttribute('color', attr);
  return geometry;
}

function remapUV(geometry, rect) {
  const uv = geometry.getAttribute('uv');
  if (!uv) return geometry;
  const w = rect.w;
  const h = rect.h;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, rect.x + uv.getX(i) * w, rect.y + uv.getY(i) * h);
  }
  uv.needsUpdate = true;
  return geometry;
}

/** Merge parts (each with position/normal/uv[, color]) into one geometry.
 *  Wraps the toon.js merge helper and concatenates vertex colors in order. */
function mergeParts(parts) {
  if (!parts.length) return null;
  const originals = parts.map((part) => part.geometry);
  // merge() from toon.js only rebuilds the index when *every* input geometry is
  // indexed. IcosahedronGeometry (tree canopies) is non-indexed, so flatten the
  // whole bucket to non-indexed before merging; otherwise the indexed parts lose
  // their triangle connectivity and the merged mesh explodes.
  const flatten = originals.some((geometry) => !geometry.getIndex());
  const geometries = flatten
    ? originals.map((geometry) => (geometry.getIndex() ? geometry.toNonIndexed() : geometry))
    : originals.slice();
  for (const geometry of geometries) {
    ensureAttribute(geometry, 'normal', 3);
    ensureAttribute(geometry, 'uv', 2);
  }
  const merged = mergeGeometry(geometries);
  const colored = geometries.every((geometry) => geometry.getAttribute('color'));
  if (colored) {
    let total = 0;
    for (const geometry of geometries) total += geometry.getAttribute('color').array.length;
    const data = new Float32Array(total);
    let offset = 0;
    for (const geometry of geometries) {
      data.set(geometry.getAttribute('color').array, offset);
      offset += geometry.getAttribute('color').array.length;
    }
    merged.setAttribute('color', new THREE.BufferAttribute(data, 3));
  }
  for (const geometry of geometries) {
    if (!originals.includes(geometry)) geometry.dispose();
  }
  for (const geometry of originals) geometry.dispose();
  return merged;
}

// ---------------------------------------------------------------------------
// 基础几何缓存
// ---------------------------------------------------------------------------
const geometryCache = new Map();
function cached(key, factory) {
  if (!geometryCache.has(key)) geometryCache.set(key, factory());
  return geometryCache.get(key);
}

function boxGeometry(w, h, d, jitter = 0) {
  if (jitter > 0) return toonBox(w, h, d, jitter);
  return cached(`box:${w}:${h}:${d}`, () => toonBox(w, h, d));
}
function cylinderGeometry(radiusTop, radiusBottom, height, segments = 8) {
  return cached(`cyl:${radiusTop}:${radiusBottom}:${height}:${segments}`,
    () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1));
}
function coneGeometry(radius, height, segments = 8) {
  return cached(`cone:${radius}:${height}:${segments}`,
    () => new THREE.ConeGeometry(radius, height, segments, 1));
}
function sphereGeometry(radius, widthSegments = 8, heightSegments = 6) {
  return cached(`sph:${radius}:${widthSegments}:${heightSegments}`,
    () => new THREE.SphereGeometry(radius, widthSegments, heightSegments));
}
function icosaGeometry(radius, detail = 0) {
  return cached(`ico:${radius}:${detail}`, () => new THREE.IcosahedronGeometry(radius, detail));
}
function torusGeometry(radius, tube, radialSegments = 6, tubularSegments = 14) {
  return cached(`tor:${radius}:${tube}:${radialSegments}:${tubularSegments}`,
    () => new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments));
}
function planeGeometry(w, h) {
  return cached(`plane:${w}:${h}`, () => new THREE.PlaneGeometry(w, h));
}
function circleGeometry(radius, segments = 16) {
  return cached(`circle:${radius}:${segments}`, () => new THREE.CircleGeometry(radius, segments));
}

/** Triangular prism: base (w × depth) at y=0, ridge at y=h, depth along z. */
function prismGeometry(w, h, depth) {
  return cached(`prism:${w}:${h}:${depth}`, () => {
    const hw = w / 2;
    const hd = depth / 2;
    const positions = new Float32Array([
      -hw, 0, hd, hw, 0, hd, 0, h, hd,
      -hw, 0, -hd, hw, 0, -hd, 0, h, -hd,
    ]);
    const uvs = new Float32Array([
      0, 0, 1, 0, 0.5, 1,
      0, 0, 1, 0, 0.5, 1,
    ]);
    const index = new Uint16Array([
      0, 1, 2, // front
      3, 5, 4, // back
      0, 5, 3, 0, 2, 5, // left slope
      1, 4, 5, 1, 5, 2, // right slope
      0, 3, 4, 0, 4, 1, // bottom
    ]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    geometry.computeVertexNormals();
    return geometry;
  });
}

// ---------------------------------------------------------------------------
// 图集贴图：胡同路牌 / 店铺招牌 / 匾额 / 门神福字 / 邮徽
// 单张 1024² canvas，所有贴图都从这一张取，因此招牌合并后只需 1 个 draw call。
// ---------------------------------------------------------------------------
const ATLAS_SIZE = 1024;
const SIGN_FONT = '"ZCOOL KuaiLe", "Ma Shan Zheng", "Kaiti SC", "STKaiti", serif';
const HAND_FONT = '"Ma Shan Zheng", "Kaiti SC", "STKaiti", serif';

const CELLS = {
  'sign-chunfeng': { x: 16, y: 16, w: 384, h: 96 },
  'sign-nanluo': { x: 416, y: 16, w: 384, h: 96 },
  'plaque-gulou': { x: 816, y: 16, w: 192, h: 96 },
  'banner-zaodian': { x: 16, y: 128, w: 384, h: 96 },
  'banner-shop': { x: 416, y: 128, w: 384, h: 96 },
  'plaque-qinian': { x: 816, y: 128, w: 192, h: 96 },
  'banner-noodle': { x: 16, y: 240, w: 384, h: 96 },
  'banner-798': { x: 416, y: 240, w: 384, h: 96 },
  'plaque-cbd': { x: 816, y: 240, w: 192, h: 96 },
  'sign-yandai': { x: 16, y: 352, w: 384, h: 96 },
  'fu': { x: 416, y: 352, w: 128, h: 128 },
  'post': { x: 560, y: 352, w: 128, h: 128 },
  'notice': { x: 704, y: 352, w: 160, h: 96 },
  'couplet': { x: 880, y: 352, w: 96, h: 256 },
};

function uvRectOf(cellId) {
  const cell = CELLS[cellId];
  if (!cell) return { x: 0, y: 0, w: 1, h: 1 };
  return {
    x: cell.x / ATLAS_SIZE,
    y: 1 - (cell.y + cell.h) / ATLAS_SIZE,
    w: cell.w / ATLAS_SIZE,
    h: cell.h / ATLAS_SIZE,
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawAtlas(ctx) {
  const S = ATLAS_SIZE;
  ctx.clearRect(0, 0, S, S);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const roadSign = (cell, title, latin) => {
    ctx.save();
    roundRect(ctx, cell.x, cell.y, cell.w, cell.h, 12);
    ctx.fillStyle = '#2f7d55';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#f2ede1';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 54px ${SIGN_FONT}`;
    ctx.fillText(title, cell.x + cell.w / 2, cell.y + cell.h * 0.42);
    ctx.font = `600 20px "Trebuchet MS", sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(latin, cell.x + cell.w / 2, cell.y + cell.h * 0.78);
    ctx.restore();
  };

  const banner = (cell, title, bg, fg, border) => {
    ctx.save();
    ctx.fillStyle = bg;
    ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
    ctx.lineWidth = 8;
    ctx.strokeStyle = border;
    ctx.strokeRect(cell.x + 4, cell.y + 4, cell.w - 8, cell.h - 8);
    ctx.fillStyle = fg;
    ctx.font = `700 58px ${SIGN_FONT}`;
    ctx.fillText(title, cell.x + cell.w / 2, cell.y + cell.h / 2 + 2);
    ctx.restore();
  };

  const plaque = (cell, title, bg, fg, border) => {
    ctx.save();
    ctx.fillStyle = bg;
    ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
    ctx.lineWidth = 6;
    ctx.strokeStyle = border;
    ctx.strokeRect(cell.x + 6, cell.y + 6, cell.w - 12, cell.h - 12);
    ctx.fillStyle = fg;
    ctx.font = `700 52px ${SIGN_FONT}`;
    ctx.fillText(title, cell.x + cell.w / 2, cell.y + cell.h / 2 + 2);
    ctx.restore();
  };

  roadSign(CELLS['sign-chunfeng'], '春风胡同', 'CHUNFENG HUTONG');
  roadSign(CELLS['sign-nanluo'], '南锣鼓巷', 'NANLUOGUXIANG');
  roadSign(CELLS['sign-yandai'], '烟袋斜街', 'YANDAI XIEJIE');

  banner(CELLS['banner-zaodian'], '老张早点', '#f3e6c8', '#b6483c', '#b6483c');
  banner(CELLS['banner-shop'], '胡同小卖部', '#f3e6c8', '#3c5f72', '#3c5f72');
  banner(CELLS['banner-noodle'], '老北京炸酱面', '#b6483c', '#f6e6b8', '#f6e6b8');
  banner(CELLS['banner-798'], '七九八 · 艺术区', '#eez', '#e8dcc0', '#a89a7c');
  plaque(CELLS['plaque-gulou'], '鼓楼', '#2f4257', '#e6c274', '#e6c274');
  plaque(CELLS['plaque-qinian'], '祈年殿', '#2f4257', '#e6c274', '#e6c274');
  plaque(CELLS['plaque-cbd'], '国贸 CBD', '#2f4257', '#e6c274', '#e6c274');

  // 福字（红底金字，贴在大门/影壁上）
  {
    const cell = CELLS.fu;
    ctx.save();
    ctx.fillStyle = '#b6483c';
    ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#e6c274';
    ctx.strokeRect(cell.x + 5, cell.y + 5, cell.w - 10, cell.h - 10);
    ctx.fillStyle = '#f2d98a';
    ctx.font = `700 104px ${HAND_FONT}`;
    ctx.fillText('福', cell.x + cell.w / 2, cell.y + cell.h / 2 + 6);
    ctx.restore();
  }

  // 邮徽（绿底白字「邮」）
  {
    const cell = CELLS.post;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cell.x + cell.w / 2, cell.y + cell.h / 2, cell.w / 2 - 4, 0, Math.PI * 2);
    ctx.fillStyle = '#2f7d5a';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#f2ede1';
    ctx.stroke();
    ctx.fillStyle = '#f7f2e6';
    ctx.font = `700 76px ${HAND_FONT}`;
    ctx.fillText('邮', cell.x + cell.w / 2, cell.y + cell.h / 2 + 4);
    ctx.restore();
  }

  // 公告/邮筒取信时间小牌
  {
    const cell = CELLS.notice;
    ctx.save();
    ctx.fillStyle = '#f2ede1';
    ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#4a4f4d';
    ctx.strokeRect(cell.x + 3, cell.y + 3, cell.w - 6, cell.h - 6);
    ctx.fillStyle = '#3c5f72';
    ctx.font = `700 24px ${HAND_FONT}`;
    ctx.fillText('开箱时间', cell.x + cell.w / 2, cell.y + 26);
    ctx.fillStyle = '#6b6f6a';
    ctx.font = `600 17px "Trebuchet MS", sans-serif`;
    ctx.fillText('08:00 / 16:30', cell.x + cell.w / 2, cell.y + 56);
    ctx.fillText('中国邮政', cell.x + cell.w / 2, cell.y + 78);
    ctx.restore();
  }

  // 红底金字春联（竖排）
  {
    const cell = CELLS.couplet;
    ctx.save();
    ctx.fillStyle = '#b6483c';
    ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
    ctx.strokeStyle = '#e6c274';
    ctx.lineWidth = 5;
    ctx.strokeRect(cell.x + 4, cell.y + 4, cell.w - 8, cell.h - 8);
    ctx.fillStyle = '#f2d98a';
    ctx.font = `700 54px ${HAND_FONT}`;
    const chars = ['新', '春', '大', '吉'];
    chars.forEach((ch, index) => {
      ctx.fillText(ch, cell.x + cell.w / 2, cell.y + 44 + index * 52);
    });
    ctx.restore();
  }
}

function createAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d');
  drawAtlas(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  const redraw = () => {
    drawAtlas(ctx);
    texture.needsUpdate = true;
  };
  return { canvas, ctx, texture, redraw };
}

/** Load the CN sign fonts (same woff2 files the UI uses) and repaint the atlas. */
function prepareFonts(atlas) {
  const faces = [
    ['BeijingSignBlock', '/fonts/zcool-kuaile-chinese-simplified-400-normal.woff2', '春风胡同'],
    ['BeijingSignKai', '/fonts/ma-shan-zheng-chinese-simplified-400-normal.woff2', '春风胡同'],
  ];
  const loadOne = async ([family, url, sample]) => {
    try {
      if (document.fonts?.check?.(`48px "${family}"`)) return;
      const face = new FontFace(family, `url(${url})`);
      await face.load();
      document.fonts.add(face);
    } catch (error) {
      console.warn('[beijing] sign font failed', family, error?.message || error);
    }
  };
  return Promise.all(faces.map(loadOne)).then(() => {
    atlas.redraw();
    return true;
  });
}

// ---------------------------------------------------------------------------
// Batch：收集一个资产/一个片区的几何，按桶（paint / decal / glow）合并
// ---------------------------------------------------------------------------
const _matrix = new THREE.Matrix4();
const _quaternion = new THREE.Quaternion();
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3(1, 1, 1);
const _euler = new THREE.Euler();

function localMatrix({ x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 }) {
  _position.set(x, y, z);
  _euler.set(rx, ry, rz);
  _quaternion.setFromEuler(_euler);
  _scale.set(sx, sy, sz);
  return new THREE.Matrix4().compose(_position, _quaternion, _scale);
}

class Batch {
  constructor() {
    this.paint = [];
    this.decals = [];
    this.glow = [];
  }

  _push(bucket, geometry, hex, matrix) {
    const g = geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    ensureAttribute(g, 'normal', 3);
    ensureAttribute(g, 'uv', 2);
    colorize(g, hex);
    bucket.push({ geometry: g });
  }

  add(geometry, hex, options = {}) {
    this._push(this.paint, geometry, hex, localMatrix(options));
  }

  /** Box: (x, y, z) is the BOTTOM-centre of the box; y = bottom. */
  box(w, h, d, hex, options = {}) {
    const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, jitter = 0 } = options;
    this._push(this.paint, boxGeometry(w, h, d, jitter), hex,
      localMatrix({ x, y: y + h / 2, z, rx, ry, rz }));
  }

  cyl(radiusTop, radiusBottom, h, hex, options = {}) {
    const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, segments = 8 } = options;
    this._push(this.paint, cylinderGeometry(radiusTop, radiusBottom, h, segments), hex,
      localMatrix({ x, y: y + h / 2, z, rx, ry, rz }));
  }

  cone(radius, h, hex, options = {}) {
    const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, segments = 8 } = options;
    this._push(this.paint, coneGeometry(radius, h, segments), hex,
      localMatrix({ x, y: y + h / 2, z, rx, ry, rz }));
  }

  sphere(radius, hex, options = {}) {
    const { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, segments = 8, rings = 6 } = options;
    this._push(this.paint, sphereGeometry(radius, segments, rings), hex,
      localMatrix({ x, y, z, sx, sy, sz }));
  }

  ico(radius, hex, options = {}) {
    const { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, detail = 0 } = options;
    this._push(this.paint, icosaGeometry(radius, detail), hex,
      localMatrix({ x, y, z, sx, sy, sz }));
  }

  torus(radius, tube, hex, options = {}) {
    const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, radialSegments = 6, tubularSegments = 14 } = options;
    this._push(this.paint, torusGeometry(radius, tube, radialSegments, tubularSegments), hex,
      localMatrix({ x, y, z, rx, ry, rz, sx, sy, sz }));
  }

  /** A 3D box beam between two local points. */
  beam3(a, b, thickness, hex) {
    const dir = b.clone().sub(a);
    const length = dir.length();
    if (length < 1e-4) return;
    dir.normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const matrix = new THREE.Matrix4().compose(mid, quat, new THREE.Vector3(1, 1, 1));
    this._push(this.paint, boxGeometry(length, thickness, thickness), hex, matrix);
  }

  circle(radius, hex, options = {}) {
    const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, segments = 16 } = options;
    this._push(this.paint, circleGeometry(radius, segments), hex,
      localMatrix({ x, y, z, rx, ry, rz }));
  }

  /** Gable (two-slope) Chinese roof; (x, y, z) = eave line centre, y = eave height. */
  gableRoof(w, d, h, hex, options = {}) {
    const { x = 0, y = 0, z = 0, overhang = 0.3, ridgeColor = C.ridge, ry = 0 } = options;
    const width = w + overhang * 2;
    const depth = d + overhang * 2;
    const prism = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1));
    this._push(this.paint, prismGeometry(width, h, depth), hex, prism);
    // ridge beam
    this._push(this.paint, boxGeometry(0.2, 0.14, depth + 0.1), ridgeColor,
      localMatrix({ x, y: y + h - 0.05, z, ry }));
    // 檐口挑檐线（前后两条，随屋顶朝向旋转）
    for (const zSign of [-1, 1]) {
      const local = new THREE.Matrix4().makeTranslation(0, 0, zSign * (depth / 2 + 0.02));
      const m = localMatrix({ x, y, z, ry }).multiply(local);
      this._push(this.paint, boxGeometry(width + 0.16, 0.09, 0.1), ridgeColor, m);
    }
  }

  prism(w, h, depth, hex, options = {}) {
    const { x = 0, y = 0, z = 0, ry = 0 } = options;
    this._push(this.paint, prismGeometry(w, h, depth), hex, localMatrix({ x, y, z, ry }));
  }

  /** Flat textured decal (plane facing +Z) mapped to an atlas cell. */
  decal(w, h, cellId, options = {}) {
    const { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, back = false } = options;
    const rect = uvRectOf(cellId);
    const geometry = planeGeometry(w, h).clone();
    remapUV(geometry, rect);
    this.decals.push({ geometry, matrix: localMatrix({ x, y, z, rx, ry, rz }) });
    if (back) {
      const backGeometry = planeGeometry(w, h).clone();
      remapUV(backGeometry, rect);
      // mirror horizontally for the back side so text reads correctly
      const uv = backGeometry.getAttribute('uv');
      for (let i = 0; i < uv.count; i += 1) {
        uv.setX(i, rect.x + rect.w - (uv.getX(i) - rect.x));
      }
      uv.needsUpdate = true;
      this.decals.push({ geometry: backGeometry, matrix: localMatrix({ x, y, z, rx, ry: ry + Math.PI, rz }) });
    }
  }

  /** Static glowing lantern (hanging red paper lantern) -> glow bucket. */
  lantern(x, y, z, size = 0.22) {
    const s = size;
    this._push(this.glow, sphereGeometry(s, 8, 6), C.lantern, localMatrix({ x, y, z, sy: 1.15 }));
    this._push(this.glow, cylinderGeometry(s * 0.55, s * 0.55, s * 0.4, 6), C.gold, localMatrix({ x, y: y + s * 1.15, z }));
    this._push(this.glow, cylinderGeometry(s * 0.55, s * 0.55, s * 0.4, 6), C.gold, localMatrix({ x, y: y - s * 1.15, z }));
    this._push(this.glow, cylinderGeometry(s * 0.1, s * 0.14, s * 1.1, 5), C.lanternDark, localMatrix({ x, y: y - s * 2.0, z }));
    this._push(this.glow, boxGeometry(0.02, s * 1.4, 0.02), C.ink, localMatrix({ x, y: y + s * 2.1, z }));
  }

  mergeInto(group, materials, name) {
    const meshes = {};
    const paintGeometry = mergeParts(this.paint);
    if (paintGeometry) {
      const mesh = new THREE.Mesh(paintGeometry, materials.paint);
      mesh.name = `${name}-paint`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      meshes.paint = mesh;
    }
    const decalParts = this.decals.map((item) => {
      const geometry = item.geometry.clone();
      if (item.matrix) geometry.applyMatrix4(item.matrix);
      ensureAttribute(geometry, 'normal', 3);
      return { geometry };
    });
    const decalGeometry = mergeParts(decalParts);
    if (decalGeometry) {
      const mesh = new THREE.Mesh(decalGeometry, materials.decal);
      mesh.name = `${name}-decal`;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      group.add(mesh);
      meshes.decal = mesh;
    }
    const glowGeometry = mergeParts(this.glow);
    if (glowGeometry) {
      const mesh = new THREE.Mesh(glowGeometry, materials.glow);
      mesh.name = `${name}-glow`;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      group.add(mesh);
      meshes.glow = mesh;
    }
    this.paint = [];
    this.decals = [];
    this.glow = [];
    return meshes;
  }
}

// ---------------------------------------------------------------------------
// 资产 builders（局部坐标：原点脚底中心，+Y 上，+Z 正面）
// ---------------------------------------------------------------------------

/** 老槐树 / 行道树。 */
function buildTree(b, { scale = 1, lean = 0, variant = 0 } = {}) {
  const s = scale;
  const trunkH = 2.1 * s;
  b.cyl(0.16 * s, 0.26 * s, trunkH, C.trunk, { y: 0, rz: lean, segments: 6 });
  b.cyl(0.08 * s, 0.14 * s, 0.9 * s, C.trunk, { y: trunkH * 0.72, x: 0.32 * s, rz: 0.7, segments: 5 });
  b.cyl(0.07 * s, 0.12 * s, 0.85 * s, C.trunkDark, { y: trunkH * 0.78, x: -0.28 * s, rz: -0.6, segments: 5 });
  const blobs = [
    [0.0, 2.9, 0.0, 1.45, C.leaf],
    [0.95, 2.55, 0.15, 0.95, C.leaf2],
    [-0.9, 2.7, -0.18, 1.0, C.leaf3],
    [0.2, 3.55, -0.3, 0.92, C.leaf2],
    [-0.25, 2.35, 0.8, 0.85, C.leaf4],
    [0.35, 2.45, -0.8, 0.8, C.leaf],
    [-1.25, 2.15, 0.35, 0.62, C.leaf3],
    [1.25, 2.2, -0.3, 0.6, C.leaf4],
  ];
  for (const [x, y, z, radius, hex] of blobs) {
    b.ico(radius * s, hex, { x: x * s, y: y * s, z: z * s, sy: 0.85, sx: 1.05, sz: 1.0 });
  }
  if (variant === 1) {
    b.ico(0.55 * s, C.leaf3, { x: -0.9 * s, y: 1.9 * s, z: 0.6 * s });
  }
}

/** 四合院：灰瓦坡顶 + 院墙 + 红门 + 门墩（可选石狮/灯笼）。 */
function buildCourtyard(b, options = {}) {
  const {
    width = 5.2, depth = 4.2, wallH = 1.85, wallColor = C.greyWall,
    houseColor = C.cream, roofColor = C.roof, gate = true, lions = false,
    lanterns = true, fu = true,
  } = options;
  const hw = width / 2;
  const hd = depth / 2;

  // 院内地面
  b.box(width - 0.4, 0.06, depth - 0.4, C.stoneLight, { y: 0 });
  // 院墙（四边，正面留门）
  const t = 0.16;
  b.box(width, wallH, t, wallColor, { z: -hd + t / 2 });
  b.box(t, wallH, depth, wallColor, { x: -hw + t / 2 });
  b.box(t, wallH, depth, wallColor, { x: hw - t / 2 });
  // 墙帽（深灰）
  b.box(width + 0.06, 0.14, 0.28, C.roofDark, { y: wallH, z: -hd + t / 2 });
  b.box(0.28, 0.14, depth + 0.06, C.roofDark, { x: -hw + t / 2, y: wallH });
  b.box(0.28, 0.14, depth + 0.06, C.roofDark, { x: hw - t / 2, y: wallH });

  // 正房（北）
  const mainW = width * 0.68;
  const mainD = 1.35;
  const mainZ = -hd + 0.3 + mainD / 2;
  b.box(mainW, 2.05, mainD, houseColor, { z: mainZ });
  b.box(mainW * 0.42, 0.9, 0.06, C.glassDark, { y: 1.0, z: mainZ + mainD / 2 + 0.01 });
  b.box(mainW * 0.42, 0.9, 0.06, C.glassDark, { y: 1.0, z: mainZ + mainD / 2 + 0.02, x: -mainW * 0.3 });
  b.gableRoof(mainW, mainD, 1.05, roofColor, { y: 2.05, z: mainZ });
  // 正房红柱
  for (const side of [-1, 1]) {
    b.cyl(0.07, 0.07, 2.05, C.red, { x: side * mainW * 0.44, y: 0, z: mainZ + mainD / 2 - 0.12, segments: 6 });
  }

  // 厢房（东 / 西）
  for (const side of [-1, 1]) {
    const wingW = 0.95;
    const wingD = depth * 0.46;
    const wingX = side * (hw - 0.35 - wingW / 2);
    const wingZ = -0.15;
    b.box(wingW, 1.7, wingD, houseColor, { x: wingX, z: wingZ });
    b.gableRoof(wingW, wingD, 0.8, roofColor, { x: wingX, y: 1.7, z: wingZ, overhang: 0.2 });
    b.box(0.05, 0.7, wingD * 0.5, C.glassDark, { x: wingX + side * (wingW / 2 + 0.01), y: 0.8, z: wingZ });
  }

  // 倒座房（南侧，中间留门）
  const frontSegW = (width * 0.5 - 0.75) / 2;
  for (const side of [-1, 1]) {
    const segX = side * (width * 0.25 + 0.4);
    b.box(frontSegW, 1.6, 0.95, houseColor, { x: segX, z: hd - 0.75 });
    b.gableRoof(frontSegW, 0.95, 0.7, roofColor, { x: segX, y: 1.6, z: hd - 0.75, overhang: 0.18 });
  }

  // 门楼 + 红门
  if (gate) {
    const gateW = 1.25;
    const gateH = 2.0;
    b.box(gateW, gateH, 0.18, C.greyWallDark, { z: hd - 0.15 });
    b.box(gateW * 0.66, 1.75, 0.1, C.red, { z: hd - 0.06 });
    // 门钉
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        b.sphere(0.035, C.gold, { x: (j - 0.5) * 0.26, y: 0.85 + i * 0.42, z: hd - 0.005, segments: 5, rings: 4 });
      }
    }
    if (fu) b.decal(0.34, 0.34, 'fu', { x: 0, y: 1.28, z: hd - 0.001, back: false });
    b.gableRoof(gateW + 0.5, 0.7, 0.55, roofColor, { y: gateH, z: hd - 0.2, overhang: 0.22 });
    // 门墩
    for (const side of [-1, 1]) {
      b.box(0.24, 0.3, 0.26, C.stone, { x: side * (gateW * 0.42), y: 0, z: hd + 0.2 });
      b.sphere(0.1, C.stoneLight, { x: side * (gateW * 0.42), y: 0.36, z: hd + 0.2, segments: 6, rings: 4 });
    }
    // 台阶
    for (let i = 0; i < 2; i += 1) {
      b.box(gateW + 0.35 + i * 0.28, 0.12, 0.34 + i * 0.2, C.stoneDark, { y: -0.12 - i * 0.001, z: hd + 0.42 + i * 0.1 });
    }
    // 门楼灯笼
    if (lanterns) {
      for (const side of [-1, 1]) {
        b.lantern(side * (gateW * 0.72), gateH - 0.18, hd + 0.28, 0.2);
      }
    }
    // 春联
    for (const side of [-1, 1]) {
      b.decal(0.17, 0.95, 'couplet', { x: side * (gateW * 0.4), y: 1.05, z: hd - 0.001 });
    }
  }

  if (lions) {
    buildLion(b, { x: -0.95, z: hd + 1.0, ry: 0.25 });
    buildLion(b, { x: 0.95, z: hd + 1.0, ry: -0.25 });
  }
}

/** 石狮子。 */
function buildLion(b, { x = 0, y = 0, z = 0, ry = 0, scale = 1 } = {}) {
  const s = scale;
  const px = x;
  const pz = z;
  b.box(0.52 * s, 0.24 * s, 0.78 * s, C.stoneLight, { x: px, y, z: pz, ry });
  b.box(0.32 * s, 0.42 * s, 0.5 * s, C.stone, { x: px, y: y + 0.24 * s, z: pz, ry });
  // 前腿
  for (const side of [-1, 1]) {
    b.box(0.12 * s, 0.3 * s, 0.34 * s, C.stone, { x: px + side * 0.11 * s, y: y + 0.24 * s, z: pz + 0.18 * s, ry });
  }
  // 头
  b.sphere(0.21 * s, C.stone, { x: px, y: y + 0.78 * s, z: pz + 0.1 * s, sx: 1.0, sy: 0.95, sz: 1.0, segments: 7, rings: 5, ry });
  // 鬃毛
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    b.sphere(0.075 * s, C.stoneLight, {
      x: px + Math.cos(angle) * 0.17 * s, y: y + 0.96 * s, z: pz + 0.08 * s + Math.sin(angle) * 0.13 * s,
      segments: 5, rings: 4,
    });
  }
  // 耳朵/眼睛
  for (const side of [-1, 1]) {
    b.sphere(0.045 * s, C.stoneDark, { x: px + side * 0.13 * s, y: y + 0.86 * s, z: pz + 0.25 * s, segments: 4, rings: 3 });
  }
  // 尾巴
  b.cyl(0.04 * s, 0.07 * s, 0.34 * s, C.stoneDark, { x: px, y: y + 0.24 * s, z: pz - 0.28 * s, rx: 0.9, segments: 5 });
  // 绣球
  b.sphere(0.08 * s, C.stoneLight, { x: px + 0.14 * s, y: y + 0.26 * s, z: pz + 0.34 * s, segments: 5, rings: 4 });
}

/** 胡同牌楼（跨街的木牌坊，灰瓦顶 + 绿匾）。 */
function buildPaifang(b, { x = 0, y = 0, z = 0, ry = 0, plaque = 'sign-chunfeng' } = {}) {
  const half = 1.75;
  // 石基座 + 红柱
  for (const side of [-1, 1]) {
    const pz = z + side * half;
    b.box(0.6, 0.34, 0.6, C.stoneDark, { x, y, z: pz, ry });
    b.cyl(0.2, 0.24, 3.15, C.red, { x, y: y + 0.34, z: pz, segments: 8 });
    b.cyl(0.24, 0.24, 0.14, C.gold, { x, y: y + 3.35, z: pz, segments: 8 });
  }
  // 两道额枋（沿 z 轴连接两根柱子）
  b.box(0.34, 0.3, half * 2 + 0.7, C.red, { x, y: y + 2.55, z, ry });
  b.box(0.3, 0.24, half * 2 + 0.4, C.redDark, { x, y: y + 2.2, z, ry });
  // 匾额（两面朝 ±x）
  b.box(0.12, 0.56, 1.7, C.creamLight, { x, y: y + 2.88, z, ry });
  b.decal(1.55, 0.44, plaque, { x: x + 0.07, y: y + 3.16, z, ry: ry + Math.PI / 2 });
  b.decal(1.55, 0.44, plaque, { x: x - 0.07, y: y + 3.16, z, ry: ry - Math.PI / 2 });
  // 灰瓦顶（屋脊沿 z）
  b.gableRoof(1.0, half * 2 + 0.9, 0.5, C.roof, { x, y: y + 3.42, z, ry, overhang: 0.22 });
  // 檐下灯笼一对
  for (const side of [-1, 1]) {
    b.lantern(0.55, y + 2.75, z + side * 1.05, 0.19);
    b.lantern(-0.55, y + 2.75, z + side * 1.05, 0.19);
  }
}

/** 胡同路牌：灰杆 + 绿色双面路牌。 */
function buildHutongSign(b, { x = 0, y = 0, z = 0, cell = 'sign-chunfeng', ry = 0 } = {}) {
  b.cyl(0.045, 0.055, 2.35, C.roofDark, { x, y, z, segments: 6 });
  b.box(0.16, 0.12, 0.16, C.stoneDark, { x, y, z, ry });
  // 牌子（双面）
  b.box(1.5, 0.44, 0.05, C.ink, { x, y: y + 1.76, z, ry });
  b.decal(1.42, 0.36, cell, { x, y: y + 1.98, z: z + 0.032, ry });
  b.decal(1.42, 0.36, cell, { x, y: y + 1.98, z: z + 0.032, ry: ry + Math.PI, back: true });
}

/** 绿色邮筒（中国邮政）。 */
function buildMailbox(b, { x = 0, y = 0, z = 0, ry = 0 } = {}) {
  b.cyl(0.3, 0.34, 0.16, C.postGreenDark, { x, y, z, segments: 10 });
  b.cyl(0.28, 0.28, 1.05, C.postGreen, { x, y: y + 0.16, z, segments: 10 });
  b.sphere(0.28, C.postGreen, { x, y: y + 1.21, z, sy: 0.55, segments: 10, rings: 6 });
  // 投信口
  b.box(0.3, 0.055, 0.04, C.ink, { x, y: y + 0.92, z: z + 0.255, ry });
  // 邮徽 + 取信时间
  b.decal(0.3, 0.3, 'post', { x, y: y + 0.62, z: z + 0.255, ry });
  b.decal(0.3, 0.18, 'notice', { x, y: y + 0.34, z: z + 0.255, ry });
  // 底座小台阶
  b.box(0.7, 0.08, 0.7, C.stone, { x, y, z });
}

/** 二八自行车。 */
function buildBike(b, { x = 0, y = 0, z = 0, ry = 0, color: frameColor = C.black } = {}) {
  for (const side of [-1, 1]) {
    b.torus(0.34, 0.032, C.ink, { x: side * 0.55, y: y + 0.36, z, radialSegments: 5, tubularSegments: 12, ry });
    // 车条（两片交叉，低模表示）
    b.box(0.02, 0.6, 0.02, C.roofDark, { x: side * 0.55, y: y + 0.07, z, ry });
    b.box(0.02, 0.02, 0.6, C.roofDark, { x: side * 0.55, y: y + 0.36, z, ry });
  }
  const beam = (x1, y1, x2, y2, thickness, hex) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    b.box(length, thickness, thickness, hex, { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - thickness / 2, z, ry, rz: angle });
  };
  // 车架
  beam(-0.55, 0.36, -0.12, 0.82, 0.05, frameColor); // 后下叉->座管
  beam(-0.12, 0.82, 0.36, 0.78, 0.05, frameColor); // 上管
  beam(-0.12, 0.36, 0.36, 0.78, 0.05, frameColor); // 下管
  beam(-0.12, 0.36, -0.12, 0.82, 0.05, frameColor); // 座管
  beam(0.36, 0.78, 0.55, 0.36, 0.05, frameColor); // 前叉
  // 车把
  b.box(0.05, 0.05, 0.42, C.ink, { x: 0.36, y: y + 0.94, z, ry });
  b.cyl(0.035, 0.035, 0.12, C.woodDark, { x: -0.12, y: y + 0.84, z, rx: 0, segments: 5 }); // 座杆
  b.box(0.3, 0.07, 0.16, C.woodDark, { x: -0.16, y: y + 0.9, z }); // 车座
  // 后座架
  b.box(0.42, 0.04, 0.22, C.roofDark, { x: -0.42, y: y + 0.74, z });
  // 链条/牙盘
  b.cyl(0.075, 0.075, 0.03, C.roofDark, { x: -0.08, y: y + 0.32, z: z + 0.05, rx: Math.PI / 2, segments: 8 });
  // 车铃
  b.sphere(0.045, C.goldLight, { x: 0.3, y: y + 0.99, z: z + 0.1, segments: 5, rings: 4 });
}

/** 小卖部 / 杂货铺。 */
function buildShop(b, { x = 0, y = 0, z = 0, ry = 0, banner = 'banner-shop' } = {}) {
  const w = 2.7;
  const d = 2.0;
  b.box(w, 2.15, d, C.cream, { x, y, z, ry });
  b.gableRoof(w, d, 0.75, C.roof, { x, y: y + 2.15, z, ry, overhang: 0.3 });
  // 门 + 窗
  b.box(0.72, 1.7, 0.06, C.woodDark, { x: x - w * 0.24, y, z: z + d / 2 + 0.01, ry });
  b.box(1.0, 0.75, 0.06, C.glassDark, { x: x + w * 0.2, y: y + 0.85, z: z + d / 2 + 0.02, ry });
  b.box(1.06, 0.06, 0.08, C.creamLight, { x: x + w * 0.2, y: y + 0.82, z: z + d / 2 + 0.03, ry });
  // 招牌（挂在门楣上）
  b.box(w * 0.92, 0.5, 0.09, C.creamLight, { x, y: y + 1.45, z: z + d / 2 + 0.02, ry });
  b.decal(w * 0.86, 0.4, banner, { x, y: y + 1.7, z: z + d / 2 + 0.08, ry });
  // 雨棚
  b.box(w * 0.95, 0.08, 0.9, C.red, { x, y: y + 1.32, z: z + d / 2 + 0.42, ry, rx: 0.18 });
  // 门口泡沫箱 / 杂物
  b.box(0.4, 0.34, 0.4, C.postGreenDark, { x: x + w * 0.42, y, z: z + d / 2 + 0.5, ry });
  b.box(0.3, 0.26, 0.3, C.wood, { x: x + w * 0.42, y: y + 0.34, z: z + d / 2 + 0.5, ry });
}

/** 早点铺：棚子 + 蒸笼 + 长凳。 */
function buildBreakfast(b, { x = 0, y = 0, z = 0, ry = 0 } = {}) {
  // 操作台
  b.box(2.3, 0.85, 0.85, C.woodLight, { x, y, z, ry });
  b.box(2.4, 0.08, 0.95, C.woodDark, { x, y: y + 0.85, z, ry });
  // 四根棚柱
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.cyl(0.045, 0.045, 2.25, C.woodDark, { x: x + sx * 1.18, y, z: z + sz * 0.85, segments: 5 });
    }
  }
  // 棚顶（坡）
  b.box(2.7, 0.1, 2.0, C.creamLight, { x, y: y + 2.25, z, ry, rx: 0.06 });
  b.box(2.75, 0.12, 0.16, C.red, { x, y: y + 2.2, z: z + 0.98, ry });
  // 招牌
  b.box(2.1, 0.46, 0.08, C.creamLight, { x, y: y + 2.4, z: z + 1.02, ry });
  b.decal(2.0, 0.38, 'banner-zaodian', { x, y: y + 2.62, z: z + 1.07, ry });
  // 蒸笼堆
  for (let i = 0; i < 3; i += 1) {
    b.cyl(0.26, 0.26, 0.14, C.woodLight, { x: x - 0.55, y: y + 0.95 + i * 0.14, z: z + 0.1, segments: 10 });
    b.cyl(0.27, 0.27, 0.02, C.cream, { x: x - 0.55, y: y + 1.09 + i * 0.14, z: z + 0.1, segments: 10 });
  }
  // 大锅
  b.cyl(0.3, 0.26, 0.28, C.ink, { x: x + 0.5, y: y + 0.89, z: z + 0.05, segments: 10 });
  b.cyl(0.31, 0.31, 0.04, C.ink, { x: x + 0.5, y: y + 1.17, z: z + 0.05, segments: 10 });
  // 长凳 & 小桌
  b.box(1.0, 0.06, 0.26, C.wood, { x: x - 0.7, y: y + 0.42, z: z + 1.35, ry });
  b.box(0.08, 0.42, 0.2, C.wood, { x: x - 1.1, y, z: z + 1.35 });
  b.box(0.08, 0.42, 0.2, C.wood, { x: x - 0.3, y, z: z + 1.35 });
  b.cyl(0.26, 0.26, 0.06, C.woodLight, { x: x + 0.75, y: y + 0.55, z: z + 1.3, segments: 8 });
  b.cyl(0.05, 0.06, 0.55, C.woodDark, { x: x + 0.75, y, z: z + 1.3, segments: 5 });
}

/** 晾衣绳。 */
function buildLaundry(b, { x = 0, y = 0, z = 0, ry = 0 } = {}) {
  for (const side of [-1, 1]) {
    b.cyl(0.04, 0.05, 2.1, C.wood, { x: x + side * 1.3, y, z, segments: 5 });
  }
  b.box(2.7, 0.02, 0.02, C.ink, { x, y: y + 2.05, z, ry });
  const clothColors = [C.red, C.creamLight, C.glass, C.goldLight];
  clothColors.forEach((hex, index) => {
    const cx = x - 0.95 + index * 0.62;
    b.box(0.48, 0.5, 0.03, hex, { x: cx, y: y + 1.5, z, ry });
  });
}

/** 鼓楼（砖红台基 + 拱门 + 重檐灰瓦木楼）。 */
function buildDrumTower(b, options = {}) {
  const { y = 0 } = options;
  const baseW = 3.6;
  const baseD = 2.5;
  const baseH = 2.7;
  // 台基（灰砖，留出中间拱门：左右墩 + 上方过梁）
  b.box(baseW * 0.34, baseH, baseD, C.greyWall, { y, x: -baseW * 0.33 });
  b.box(baseW * 0.34, baseH, baseD, C.greyWall, { y, x: baseW * 0.33 });
  b.box(baseW * 0.32, baseH * 0.42, baseD, C.greyWall, { y: y + baseH * 0.58 });
  // 台基红墙带
  b.box(baseW + 0.06, 0.5, baseD + 0.06, C.imperial, { y: y + baseH - 0.55 });
  // 拱门阴影（用深色块填出门洞视觉）
  b.box(baseW * 0.32, baseH * 0.58, 0.06, C.ink, { y, z: baseD / 2 - 0.02 });
  b.box(0.9, 0.55, 0.07, C.ink, { y: y + baseH * 0.58, z: baseD / 2 - 0.02 });
  // 台基压顶
  b.box(baseW + 0.4, 0.18, baseD + 0.4, C.stoneDark, { y: y + baseH });
  // 上层木楼
  const upperW = 2.9;
  const upperD = 1.9;
  const upperY = y + baseH + 0.18;
  b.box(upperW, 1.75, upperD, C.cream, { y: upperY });
  // 红柱
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.cyl(0.09, 0.1, 1.75, C.red, { x: sx * upperW * 0.45, y: upperY, z: sz * upperD * 0.42, segments: 6 });
    }
  }
  // 门窗（深色）
  b.box(upperW * 0.5, 0.78, 0.06, C.woodDark, { y: upperY + 0.18, z: upperD / 2 + 0.01 });
  for (const sx of [-1, 1]) {
    b.box(0.5, 0.7, 0.06, C.woodDark, { x: sx * upperW * 0.3, y: upperY + 0.25, z: upperD / 2 + 0.02 });
  }
  // 匾额
  b.box(1.0, 0.5, 0.06, C.ink, { y: upperY + 1.06, z: upperD / 2 + 0.01 });
  b.decal(0.92, 0.46, 'plaque-gulou', { y: upperY + 1.31, z: upperD / 2 + 0.05 });
  // 下层腰檐
  b.gableRoof(upperW + 0.7 - 0.3, upperD + 0.7, 0.55, C.roof, { y: upperY + 1.75, overhang: 0.3 });
  // 上层屋顶
  b.box(upperW * 0.8, 0.6, upperD * 0.75, C.cream, { y: upperY + 2.25 });
  b.gableRoof(upperW + 0.2, upperD + 0.3, 0.9, C.roof, { y: upperY + 2.85, overhang: 0.34 });
  // 屋脊兽/宝顶
  b.box(0.2, 0.22, 0.2, C.gold, { y: upperY + 3.75 });
  // 台基四角石灯/红旗
  for (const sx of [-1, 1]) {
    b.lantern(sx * (baseW * 0.5), y + baseH - 0.1, baseD * 0.55, 0.22);
  }
}

/** 天坛祈年殿（三层汉白玉圆台 + 三重蓝琉璃檐）。 */
function buildTempleOfHeaven(b, options = {}) {
  const { y = 0 } = options;
  // 三层圆台
  const tiers = [
    { r: 2.7, h: 0.42, color: C.stoneLight },
    { r: 2.25, h: 0.4, color: C.stoneLight },
    { r: 1.85, h: 0.38, color: C.stoneLight },
  ];
  let cy = y;
  for (const tier of tiers) {
    b.cyl(tier.r, tier.r + 0.06, tier.h, tier.color, { y: cy, segments: 20 });
    b.cyl(tier.r + 0.07, tier.r + 0.07, 0.06, C.stoneDark, { y: cy + tier.h - 0.06, segments: 20 });
    cy += tier.h;
  }
  // 汉白玉栏杆（用细柱环一圈，低模）
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    const ring = i % 2 === 0 ? tiers[0].r - 0.12 : tiers[1].r - 0.1;
    b.cyl(0.05, 0.05, 0.36, C.white, { x: Math.cos(angle) * ring, y: y + 0.03, z: Math.sin(angle) * ring, segments: 4 });
  }
  // 大殿圆墙
  const hallY = cy;
  b.cyl(1.15, 1.22, 1.05, C.imperial, { y: hallY, segments: 20 });
  b.cyl(1.24, 1.24, 0.12, C.white, { y: hallY, segments: 20 });
  // 门窗（深蓝/金）
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    b.box(0.22, 0.62, 0.06, C.templeBlueDark, {
      x: Math.cos(angle) * 1.18, y: hallY + 0.2, z: Math.sin(angle) * 1.18, ry: -angle,
    });
  }
  // 三重圆檐
  const roofs = [
    { r: 1.95, h: 1.0, y: hallY + 1.05, color: C.templeBlue },
    { r: 1.5, h: 0.95, y: hallY + 1.72, color: C.templeBlueLight },
    { r: 1.08, h: 0.95, y: hallY + 2.38, color: C.templeBlue },
  ];
  for (const roof of roofs) {
    b.cone(roof.r, roof.h, roof.color, { y: roof.y, segments: 16 });
    b.cyl(roof.r + 0.02, roof.r + 0.02, 0.08, C.goldLight, { y: roof.y, segments: 16 });
  }
  // 宝顶
  b.cyl(0.26, 0.3, 0.18, C.gold, { y: hallY + 3.28, segments: 10 });
  b.sphere(0.22, C.goldLight, { y: hallY + 3.62, segments: 8, rings: 6 });
  b.cone(0.1, 0.45, C.gold, { y: hallY + 3.8, segments: 6 });
}

/** 中国尊（中信大厦）：收腰 + 外扩顶冠。 */
function buildCiticTower(b, options = {}) {
  const { y = 0 } = options;
  const H = 9.6;
  const profile = [
    [0.0, 0.0], [0.78, 0.0], [0.84, 0.4], [0.78, 1.4], [0.66, 2.8],
    [0.6, 4.2], [0.58, 5.4], [0.62, 6.4], [0.7, 7.4], [0.8, 8.3],
    [0.84, 9.0], [0.62, H], [0.0, H],
  ];
  const radiusAt = (height) => {
    for (let i = 1; i < profile.length; i += 1) {
      const [r1, h1] = profile[i];
      const [r0, h0] = profile[i - 1];
      if (height <= h1) return r0 + ((height - h0) / Math.max(0.001, h1 - h0)) * (r1 - r0);
    }
    return 0.6;
  };
  const points = profile.map(([r, h]) => new THREE.Vector2(r, h));
  const geometry = new THREE.LatheGeometry(points, 10);
  b.add(geometry, C.glass, { y });
  // 楼层横带（沿收腰曲线贴合）
  for (let floor = 1; floor <= 7; floor += 1) {
    const height = (floor / 8) * (H - 0.6);
    const radius = radiusAt(height) + 0.015;
    b.cyl(radius, radius, 0.1, C.glassDark, { y: y + height, segments: 10 });
  }
  // 顶冠金带 + 顶部收口
  b.cyl(0.86, 0.86, 0.16, C.glassLight, { y: y + 8.95, segments: 10 });
  b.cyl(0.64, 0.64, 0.16, C.goldLight, { y: y + H - 0.2, segments: 10 });
  // 底座广场
  b.cyl(1.15, 1.25, 0.18, C.stoneLight, { y, segments: 12 });
}

/** 央视大楼（拐角门形）。 */
function buildCCTV(b, options = {}) {
  const { y = 0, ry = 0 } = options;
  const glass = C.glass;
  const dark = C.glassDark;
  // 两条腿，略向内倾
  b.box(0.95, 4.9, 1.3, glass, { x: -1.25, y, z: 0, ry, rz: 0.14 });
  b.box(0.95, 4.9, 1.3, glass, { x: 1.25, y, z: 0, ry, rz: -0.14 });
  // 顶部横向连接体（悬挑）
  b.box(3.4, 0.95, 1.3, glass, { x: 0.05, y: y + 4.35, z: 0, ry });
  // 底部横向悬挑
  b.box(2.4, 0.8, 1.1, dark, { x: -0.35, y: y + 1.5, z: 0, ry, rz: -0.05 });
  // 玻璃幕墙横带（深色线）
  for (let i = 0; i < 4; i += 1) {
    b.box(0.99, 0.08, 1.34, dark, { x: -1.25, y: y + 0.9 + i * 1.0, z: 0, ry, rz: 0.14 });
    b.box(0.99, 0.08, 1.34, dark, { x: 1.25, y: y + 0.9 + i * 1.0, z: 0, ry, rz: -0.14 });
  }
  for (let i = 0; i < 3; i += 1) {
    b.box(3.4, 0.08, 1.34, dark, { x: 0.05, y: y + 4.55 + i * 0.18, z: 0, ry });
  }
  // 底座
  b.box(3.8, 0.24, 1.7, C.stoneDark, { y, z: 0, ry });
}

/** 鸟巢（国家体育场）简版：椭圆柱面编织钢架 + 碗形看台 + 火炬塔。 */
function buildBirdNest(b, options = {}) {
  const { y = 0, ry = 0 } = options;
  const EX = 2.15;
  const EZ = 1.7;
  const levels = [
    { radius: 2.15, height: 0.92 },
    { radius: 1.95, height: 1.5 },
    { radius: 1.72, height: 2.05 },
  ];
  // 碗形看台（椭圆近似）
  b.cyl(1.5, 1.15, 0.9, C.stoneDark, { y: y + 0.05, segments: 14, sx: 1.0, sz: 0.82 });
  b.cyl(1.42, 1.42, 0.1, C.brickRedDark, { y: y + 0.82, segments: 14, sx: 1.0, sz: 0.8 });
  // 内场
  b.circle(1.32, C.leaf2, { y: y + 0.88, rx: -Math.PI / 2, sx: 1.0, sz: 0.8 });
  // 顶部椭圆环
  for (const level of levels) {
    b.torus(1, 0.055, C.white, {
      y: y + level.height, rx: Math.PI / 2, sx: level.radius, sz: level.radius * (EZ / EX),
      radialSegments: 4, tubularSegments: 20,
    });
  }
  // 编织钢架：三层之间的交叉斜梁
  const segments = 18;
  const pointOn = (level, index, offset = 0) => {
    const angle = (index / segments) * Math.PI * 2 + offset;
    return new THREE.Vector3(
      Math.cos(angle) * level.radius,
      y + level.height,
      Math.sin(angle) * level.radius * (EZ / EX),
    );
  };
  for (let levelIndex = 0; levelIndex < levels.length - 1; levelIndex += 1) {
    const lower = levels[levelIndex];
    const upper = levels[levelIndex + 1];
    const twist = levelIndex % 2 === 0 ? 0.16 : -0.16;
    for (let i = 0; i < segments; i += 1) {
      const a = pointOn(lower, i, -twist * 0.5);
      const bpt = pointOn(upper, i, twist * 0.5);
      b.beam3(a, bpt, 0.05, C.white);
      const c = pointOn(lower, i + 0.5, twist * 0.5);
      const d = pointOn(upper, i + 0.5, -twist * 0.5);
      b.beam3(c, d, 0.045, C.stoneLight);
    }
  }
  // 底部斜撑
  for (let i = 0; i < segments; i += 2) {
    const a = new THREE.Vector3(Math.cos((i / segments) * Math.PI * 2) * 1.42, y + 0.12, Math.sin((i / segments) * Math.PI * 2) * 1.42 * (EZ / EX));
    const bpt = pointOn(levels[0], i, 0.1);
    b.beam3(a, bpt, 0.05, C.stoneLight);
  }
  // 火炬塔
  b.cyl(0.12, 0.16, 1.7, C.stoneDark, { x: 2.45, y, z: -0.85, segments: 6 });
  b.cyl(0.2, 0.12, 0.3, C.stoneLight, { x: 2.45, y: y + 1.7, z: -0.85, segments: 6 });
  b.sphere(0.15, C.gold, { x: 2.45, y: y + 2.08, z: -0.85, segments: 6, rings: 4 });
  void ry;
}

/** 798 红砖厂房 + 烟囱。 */
function buildFactory798(b, { y = 0, x = 0, z = 0, ry = 0 } = {}) {
  // 厂房
  b.box(2.9, 2.15, 2.1, C.brickRed, { x, y, z, ry });
  // 锯齿厂房顶（一排三棱柱）
  for (let i = 0; i < 3; i += 1) {
    b.prism(0.95, 0.55, 2.1, C.roof, { x: x - 0.95 + i * 0.95, y: y + 2.15, z, ry });
  }
  // 窗
  for (let i = 0; i < 3; i += 1) {
    b.box(0.5, 0.62, 0.06, C.glassDark, { x: x - 0.85 + i * 0.85, y: y + 0.9, z: z + 1.06, ry });
  }
  // 大门（红色铁门）
  b.box(0.62, 1.15, 0.06, C.red, { x: x + 0.85, y, z: z + 1.06, ry });
  // 烟囱
  b.cyl(0.24, 0.4, 5.6, C.brickRedLight, { x: x - 1.65, y, z: z - 0.6, segments: 10 });
  b.cyl(0.27, 0.27, 0.16, C.creamLight, { x: x - 1.65, y: y + 4.5, z: z - 0.6, segments: 10 });
  b.cyl(0.25, 0.25, 0.16, C.creamLight, { x: x - 1.65, y: y + 4.95, z: z - 0.6, segments: 10 });
  b.cyl(0.24, 0.2, 0.22, C.ink, { x: x - 1.65, y: y + 5.6, z: z - 0.6, segments: 10 });
}

/** 静态石阶 / 广场垫层（片区用）。 */
function addStoneBase(b, { w, d, h = 0.3, x = 0, y = 0, z = 0, ry = 0, color: hex = C.stone }) {
  b.box(w, h, d, hex, { x, y, z, ry });
  b.box(w + 0.12, 0.08, d + 0.12, C.stoneDark, { x, y: y + h - 0.04, z, ry });
}

// ---------------------------------------------------------------------------
// 片区：切平面坐标系 + 地面采样 + 资产放置 + 地标
// ---------------------------------------------------------------------------
const _up = new THREE.Vector3();
const _forward = new THREE.Vector3();

class District {
  constructor({ id, name, center, forwardHint, collision }) {
    this.id = id;
    this.name = name;
    this.collision = collision;
    this.up = new THREE.Vector3(...center).normalize();
    const hit = collision?.groundAtDirection(this.up);
    this.origin = hit ? hit.point.clone() : this.up.clone().multiplyScalar(27);
    this.radius = this.origin.length();
    _up.copy(this.up);
    _forward.set(...forwardHint).addScaledVector(_up, -_forward.dot(_up));
    if (_forward.lengthSq() < 1e-5) _forward.set(1, 0, 0).addScaledVector(_up, -_up.x);
    this.forward = _forward.clone().normalize();
    this.right = new THREE.Vector3().crossVectors(this.up, this.forward).normalize();
    this.basis = new THREE.Matrix4().makeBasis(this.right, this.up, this.forward);
    this.basis.setPosition(this.origin);
    this.paint = [];
    this.decals = [];
    this.glow = [];
    this.animated = [];
    this.landmarks = [];
    this.npcSpots = [];
    this.colliders = [];
    this.terrace = null;
    this.height = 0; // 片区基准点地面高度（相对 origin 沿 up）
  }

  directionAt(x, z) {
    return this.up.clone()
      .addScaledVector(this.right, x / this.radius)
      .addScaledVector(this.forward, z / this.radius)
      .normalize();
  }

  groundAt(x, z) {
    const direction = this.directionAt(x, z);
    const hit = this.collision?.groundAtDirection(direction);
    if (!hit) {
      const point = this.localPoint(x, 0, z);
      return { point, h: 0, normal: this.up.clone() };
    }
    return { point: hit.point, h: hit.point.clone().sub(this.origin).dot(this.up), normal: hit.normal };
  }

  localPoint(x, y, z) {
    return this.origin.clone()
      .addScaledVector(this.right, x)
      .addScaledVector(this.up, y)
      .addScaledVector(this.forward, z);
  }

  /** Local transform matrix: local (x,y,z) rotY -> world. */
  matrixFor(x, y, z, yaw = 0) {
    const rotation = new THREE.Matrix4().makeRotationY(yaw);
    rotation.setPosition(x, y, z);
    return this.basis.clone().multiply(rotation);
  }

  /** Build an asset in its local space and bake it into the district buckets. */
  addAsset(build, { x = 0, y = 0, z = 0, rotY = 0 } = {}) {
    const temp = new Batch();
    build(temp, {});
    const world = this.matrixFor(x, y, z, rotY);
    for (const part of temp.paint) {
      part.geometry.applyMatrix4(world);
      this.paint.push(part);
    }
    for (const item of temp.decals) {
      const geometry = item.geometry;
      geometry.applyMatrix4(world.clone().multiply(item.matrix));
      this.decals.push({ geometry });
    }
    for (const part of temp.glow) {
      part.geometry.applyMatrix4(world);
      this.glow.push(part);
    }
    return temp;
  }

  addAnimated(obj) {
    this.animated.push(obj);
  }

  /** Register a horizontal OBB collider for a building block.
   *  (x, z) = footprint centre in the district tangent plane, y = ground y,
   *  w/d = footprint size along the building's local X/Z, h = height. */
  addCollider(id, { name = '', x = 0, z = 0, y = 0, w = 1, d = 1, h = 2, rotY = 0 } = {}) {
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const rightAxis = this.right.clone().multiplyScalar(cos).addScaledVector(this.forward, -sin).normalize();
    const forwardAxis = this.right.clone().multiplyScalar(sin).addScaledVector(this.forward, cos).normalize();
    const round = (v) => +v.toFixed(4);
    const centerGround = this.localPoint(x, y, z);
    const center = this.localPoint(x, y + h / 2, z);
    this.colliders.push({
      id,
      name,
      district: this.id,
      center: center.toArray().map(round),
      centerGround: centerGround.toArray().map(round),
      up: this.up.toArray().map(round),
      right: rightAxis.toArray().map(round),
      forward: forwardAxis.toArray().map(round),
      half: [+(w / 2).toFixed(4), +(d / 2).toFixed(4)],
      height: +h.toFixed(4),
      obb: {
        center: center.toArray().map(round),
        axes: [rightAxis.toArray().map(round), this.up.toArray().map(round), forwardAxis.toArray().map(round)],
        half: [+(w / 2).toFixed(4), +(h / 2).toFixed(4), +(d / 2).toFixed(4)],
      },
    });
    return this.colliders[this.colliders.length - 1];
  }

  /** Recommended NPC standing position (on the terrace / walkable ground). */
  npcSpot(id, name, local, facingLocal, description = '') {
    const point = this.localPoint(local[0], local[1], local[2]);
    const facing = this.right.clone().multiplyScalar(facingLocal[0])
      .addScaledVector(this.forward, facingLocal[1]);
    facing.addScaledVector(this.up, -facing.dot(this.up));
    if (facing.lengthSq() > 1e-6) facing.normalize();
    const entry = {
      id,
      name,
      district: this.id,
      point: point.toArray().map((v) => +v.toFixed(3)),
      normal: this.up.toArray().map((v) => +v.toFixed(4)),
      facing: facing.toArray().map((v) => +v.toFixed(4)),
      description,
    };
    this.npcSpots.push(entry);
    return entry;
  }

  landmark(id, name, local, extra = {}) {
    const point = local.isVector3 ? local.clone() : this.localPoint(local[0], local[1], local[2]);
    const entry = {
      id,
      name,
      district: this.id,
      point: point.toArray().map((v) => +v.toFixed(3)),
      normal: this.up.toArray().map((v) => +v.toFixed(3)),
      ...extra,
    };
    this.landmarks.push(entry);
    return entry;
  }

  /** Sample a footprint and return {hMin,hMax,topY}. */
  sampleFootprint(x, z, w, d, steps = 4) {
    let hMin = Infinity;
    let hMax = -Infinity;
    for (let ix = 0; ix <= steps; ix += 1) {
      for (let iz = 0; iz <= steps; iz += 1) {
        const sx = x - w / 2 + (ix / steps) * w;
        const sz = z - d / 2 + (iz / steps) * d;
        const { h } = this.groundAt(sx, sz);
        hMin = Math.min(hMin, h);
        hMax = Math.max(hMax, h);
      }
    }
    return { hMin, hMax, topY: hMax + 0.06, relief: hMax - hMin };
  }

  /** Level a footprint with a stone terrace and return the flat top height. */
  addTerrace({ x = 0, z = 0, w, d, topY, color: hex = C.paving, sink = 0.6, lip = 0.12 }) {
    this.terrace = { x, z, w, d };
    const sample = this.sampleFootprint(x, z, w, d, 4);
    const top = topY ?? sample.topY;
    const thickness = top - (sample.hMin - sink);
    const world = this.matrixFor(x, 0, z, 0);
    const geometry = boxGeometry(w, thickness, d).clone();
    geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, top - thickness / 2, 0));
    geometry.applyMatrix4(world);
    colorize(geometry, hex);
    this.paint.push({ geometry });
    // 压顶石边
    const lipGeometry = boxGeometry(w + 0.16, lip, d + 0.16).clone();
    lipGeometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, top - lip / 2, 0));
    lipGeometry.applyMatrix4(world);
    colorize(lipGeometry, C.stoneDark);
    this.paint.push({ geometry: lipGeometry });
    return top;
  }

  /** Simple stone steps from the terrace edge down the local +z side. */
  addSteps({ x = 0, z = 0, w = 2.0, topY = 0, steps = 3, depth = 0.4, height = 0.2 }) {
    for (let i = 0; i < steps; i += 1) {
      const stepY = topY - (i + 1) * height;
      const sz = z + (i + 0.5) * depth;
      const { h } = this.groundAt(x, sz);
      const bottom = Math.min(stepY - height, h - 0.2);
      const boxHeight = stepY - bottom;
      const world = this.matrixFor(x, 0, sz, 0);
      const geometry = boxGeometry(w, boxHeight, depth + 0.02).clone();
      geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, bottom + boxHeight / 2, 0));
      geometry.applyMatrix4(world);
      colorize(geometry, C.stoneDark);
      this.paint.push({ geometry });
    }
  }

  /** Lantern string across the street: returns the animated mesh. */
  addLanternString({ x = 0, y = 2.6, z = 0, length = 3.4, count = 3, materials, group, phase = 0, yaw = Math.PI / 2 }) {
    const batch = new Batch();
    const half = length / 2;
    const poleLength = Math.max(1.6, y - (this.terraceTop || 0));
    // 竖直吊杆（两端）：从横杆高度落到地面
    for (const side of [-1, 1]) {
      batch.cyl(0.035, 0.045, poleLength, C.woodDark, { x: side * (half + 0.1), y: -poleLength });
    }
    // 横杆
    batch.box(length + 0.2, 0.05, 0.05, C.ink, { x: 0, y: 0.02, z: 0 });
    // 灯笼
    for (let i = 0; i < count; i += 1) {
      const lx = -half + (i / (count - 1)) * length;
      batch.cyl(0.16, 0.16, 0.24, C.lantern, { x: lx, y: -0.42, z, segments: 8 });
      batch.cyl(0.17, 0.17, 0.03, C.gold, { x: lx, y: -0.18, z, segments: 8 });
      batch.cyl(0.17, 0.17, 0.03, C.gold, { x: lx, y: -0.45, z, segments: 8 });
      batch.box(0.02, 0.16, 0.02, C.ink, { x: lx, y: 0.0, z });
      batch.box(0.02, 0.1, 0.02, C.redDark, { x: lx, y: -0.52, z });
    }
    const geometry = mergeParts(batch.paint);
    const mesh = new THREE.Mesh(geometry, materials.glow);
    mesh.name = 'lantern-string';
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    const world = this.matrixFor(x, y, z, yaw);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    world.decompose(position, quaternion, scale);
    mesh.position.copy(position);
    mesh.quaternion.copy(quaternion);
    group.add(mesh);
    const entry = { mesh, baseQuaternion: quaternion.clone(), phase };
    this.animated.push(entry);
    return entry;
  }

  mergeInto(group, materials) {
    const batch = new Batch();
    batch.paint = this.paint;
    batch.decals = this.decals;
    batch.glow = this.glow;
    const meshes = batch.mergeInto(group, materials, this.id);
    this.paint = [];
    this.decals = [];
    this.glow = [];
    return meshes;
  }
}

// ---------------------------------------------------------------------------
// 长城：沿山脊逐段贴地 + 烽火台
// ---------------------------------------------------------------------------
function buildGreatWall({ scene, collision, group, materials, baseDistrict, path, wallHeight = 1.5, thickness = 0.85 }) {
  const paint = [];
  const push = (geometry, hex, matrix) => {
    const g = geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    ensureAttribute(g, 'normal', 3);
    ensureAttribute(g, 'uv', 2);
    colorize(g, hex);
    paint.push({ geometry: g });
  };
  const landmarks = [];

  const addSegmentBox = ({ a, b, topHeight, bottomExtra = 0.8, width = thickness, hex = C.stone }) => {
    const up = a.point.clone().add(b.point).multiplyScalar(0.5).normalize();
    const mid = a.point.clone().add(b.point).multiplyScalar(0.5);
    const dir = b.point.clone().sub(a.point);
    dir.addScaledVector(up, -dir.dot(up));
    const length = dir.length() + 0.14;
    if (length < 0.05) return;
    const forward = dir.normalize();
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    const h1 = a.point.dot(up);
    const h2 = b.point.dot(up);
    const midH = mid.dot(up);
    const top = Math.max(h1, h2) + topHeight;
    const bottom = Math.min(h1, h2) - midH - bottomExtra;
    const height = top - bottom;
    const basis = new THREE.Matrix4().makeBasis(right, up, forward);
    basis.setPosition(mid.clone().addScaledVector(up, bottom + height / 2 - midH));
    push(boxGeometry(width, height, length + 0.06), hex, basis);
    // 垛口（外侧交替）
    const merlons = Math.max(2, Math.round(length / 0.9));
    for (let i = 0; i < merlons; i += 1) {
      if (i % 2 === 1) continue;
      const offset = -length / 2 + (i + 0.5) * (length / merlons);
      const position = mid.clone()
        .addScaledVector(forward, offset)
        .addScaledVector(up, top + 0.22 - midH)
        .addScaledVector(right, width / 2 - 0.14);
      const merlon = new THREE.Matrix4().makeBasis(right, up, forward);
      merlon.setPosition(position);
      push(boxGeometry(0.26, 0.44, 0.52), C.stoneDark, merlon);
    }
    // 墙顶压条
    const capMatrix = new THREE.Matrix4().makeBasis(right, up, forward);
    capMatrix.setPosition(mid.clone().addScaledVector(up, top + 0.03 - midH));
    push(boxGeometry(width + 0.1, 0.08, length + 0.1), C.stoneLight, capMatrix);
    return { top, mid, up };
  };

  // 墙体
  for (let i = 0; i < path.length - 1; i += 1) {
    addSegmentBox({ a: path[i], b: path[i + 1], topHeight: wallHeight });
  }

  // 烽火台（塔楼）
  for (const tower of path.towers || []) {
    const up = tower.point.clone().normalize();
    const forward = tower.forward ? tower.forward.clone().addScaledVector(up, -tower.forward.dot(up)).normalize() : new THREE.Vector3(0, 0, 1);
    if (forward.lengthSq() < 1e-4) forward.set(1, 0, 0);
    forward.addScaledVector(up, -forward.dot(up)).normalize();
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    const base = new THREE.Matrix4().makeBasis(right, up, forward);
    base.setPosition(tower.point.clone());
    // 塔基（略收分）
    const towerH = tower.height || 3.0;
    push(boxGeometry(1.9, 0.3, 1.9), C.stoneDark, base.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.15, 0)));
    const body = base.clone().multiply(new THREE.Matrix4().makeTranslation(0, towerH / 2, 0));
    push(boxGeometry(1.6, towerH, 1.6), C.stone, body);
    // 塔顶垛口一圈
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2;
      for (const side of [-1, 1]) {
        const px = Math.cos(angle) * 0.78 + Math.cos(angle + Math.PI / 2) * side * 0.55;
        const pz = Math.sin(angle) * 0.78 + Math.sin(angle + Math.PI / 2) * side * 0.55;
        const m = base.clone().multiply(new THREE.Matrix4().makeTranslation(px, towerH + 0.18, pz));
        push(boxGeometry(0.34, 0.36, 0.34), C.stoneDark, m);
      }
    }
    // 塔顶平台
    push(boxGeometry(1.9, 0.12, 1.9), C.stoneLight, base.clone().multiply(new THREE.Matrix4().makeTranslation(0, towerH + 0.06, 0)));
    // 拱窗
    for (const angle of [0, Math.PI]) {
      const m = base.clone()
        .multiply(new THREE.Matrix4().makeRotationY(angle))
        .multiply(new THREE.Matrix4().makeTranslation(0, towerH * 0.55, 0.81));
      push(boxGeometry(0.36, 0.6, 0.06), C.ink, m);
    }
    // 旗
    const flagMatrix = base.clone().multiply(new THREE.Matrix4().makeTranslation(0.7, towerH + 0.9, 0));
    push(boxGeometry(0.05, 1.5, 0.05), C.woodDark, flagMatrix);
    const flag = base.clone().multiply(new THREE.Matrix4().makeTranslation(0.95, towerH + 1.45, 0));
    push(boxGeometry(0.5, 0.34, 0.03), C.red, flag);
    landmarks.push({
      id: `wall-tower-${landmarks.length}`,
      name: '长城烽火台',
      district: 'wall',
      point: tower.point.clone().addScaledVector(up, towerH * 0.6).toArray().map((v) => +v.toFixed(3)),
      normal: up.toArray().map((v) => +v.toFixed(3)),
    });
  }

  const geometry = mergeParts(paint);
  if (geometry) {
    const mesh = new THREE.Mesh(geometry, materials.paint);
    mesh.name = 'great-wall';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  void baseDistrict;
  void scene;
  void collision;
  return { mesh: null, landmarks };
}

// ---------------------------------------------------------------------------
// 片区布局
// ---------------------------------------------------------------------------

/** 胡同台地外沿的城墙片段（垛口 + 两座烽火台），作为「长城」的卡通化表达。 */
function buildHutongWall(district, { z = 4.35, xMin = -6.2, xMax = 2.3, height = 2.15, topY = 0 } = {}) {
  const paint = district.paint;
  const push = (geometry, hex, matrix) => {
    const g = geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    ensureAttribute(g, 'normal', 3);
    ensureAttribute(g, 'uv', 2);
    colorize(g, hex);
    paint.push({ geometry: g });
  };
  const segLen = 1.05;
  const count = Math.max(1, Math.round((xMax - xMin) / segLen));
  const step = (xMax - xMin) / count;
  const baseY = topY;
  for (let i = 0; i < count; i += 1) {
    const cx = xMin + (i + 0.5) * step;
    const m = district.matrixFor(cx, 0, z, 0);
    // 墙身（从台面向上）
    push(boxGeometry(step + 0.06, height, 0.82), C.stone, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, baseY + height / 2, 0)));
    // 墙顶压条
    push(boxGeometry(step + 0.1, 0.09, 0.95), C.stoneLight, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, baseY + height + 0.04, 0)));
    // 外侧垛口（交替）
    if (i % 2 === 0) {
      push(boxGeometry(step * 0.62, 0.5, 0.26), C.stoneDark,
        m.clone().multiply(new THREE.Matrix4().makeTranslation(0, baseY + height + 0.33, 0.34)));
    }
  }
  // 两座烽火台
  const towers = [xMin + (xMax - xMin) * 0.22, xMin + (xMax - xMin) * 0.78];
  const towerH = 2.9;
  for (const tx of towers) {
    const m = district.matrixFor(tx, 0, z + 0.05, 0);
    // 塔基
    push(boxGeometry(2.0, 0.26, 2.0), C.stoneDark, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, baseY + 0.13, 0)));
    // 塔身
    push(boxGeometry(1.7, towerH, 1.7), C.stone, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, baseY + 0.26 + towerH / 2, 0)));
    // 塔顶平台 + 一圈垛口
    push(boxGeometry(1.98, 0.12, 1.98), C.stoneLight, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, baseY + 0.26 + towerH + 0.06, 0)));
    for (let k = 0; k < 4; k += 1) {
      for (const side of [-1, 1]) {
        const angle = (k / 4) * Math.PI * 2;
        const px = Math.cos(angle) * 0.8 + Math.cos(angle + Math.PI / 2) * side * 0.62;
        const pz = Math.sin(angle) * 0.8 + Math.sin(angle + Math.PI / 2) * side * 0.62;
        push(boxGeometry(0.34, 0.34, 0.34), C.stoneDark,
          m.clone().multiply(new THREE.Matrix4().makeTranslation(px, baseY + 0.26 + towerH + 0.29, pz)));
      }
    }
    // 拱窗（深色）
    push(boxGeometry(0.4, 0.62, 0.06), C.ink, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, baseY + 0.26 + towerH * 0.55, 0.87)));
    // 旗杆 + 红旗
    push(boxGeometry(0.05, 1.6, 0.05), C.woodDark, m.clone().multiply(new THREE.Matrix4().makeTranslation(0.6, baseY + 0.26 + towerH + 0.9, 0)));
    push(boxGeometry(0.52, 0.36, 0.03), C.red, m.clone().multiply(new THREE.Matrix4().makeTranslation(0.88, baseY + 0.26 + towerH + 1.5, 0)));
  }
  // 地标
  const mark = (id, name, x, y) => district.landmark(id, name, [x, y, z], {
    description: '胡同台地外沿的城墙片段（垛口 + 烽火台），可俯瞰山脊',
    facing: district.forward.toArray(),
  });
  mark('wall-ridge', '山脊长城', (xMin + xMax) / 2, topY + height + 0.3);
  mark('wall-tower-1', '长城烽火台 1', towers[0], topY + height + 0.9);
  mark('wall-tower-2', '长城烽火台 2', towers[1], topY + height + 0.9);
}

/** 胡同区：春风胡同（牌楼 + 两座四合院 + 小卖部/早点铺 + 灯笼串）。 */
function layoutHutong(district, ctx) {
  const { materials, group } = ctx;
  // 平整的胡同台地
  const topY = district.addTerrace({ x: 0, z: 0, w: 13.0, d: 9.4, color: C.paving, sink: 0.9 });
  district.terraceTop = topY;

  // 街面（比台地略亮的一条带，沿 local x 方向）
  const street = boxGeometry(12.2, 0.06, 3.0).clone();
  street.applyMatrix4(new THREE.Matrix4().makeTranslation(0, topY + 0.015, 0.2));
  street.applyMatrix4(district.basis);
  colorize(street, C.stoneLight);
  district.paint.push({ geometry: street });
  // 路面石板
  for (let i = 0; i < 14; i += 1) {
    const gx = -5.4 + (i / 13) * 10.8;
    const gz = 0.2 + (i % 2 === 0 ? -0.85 : 0.85);
    const g = boxGeometry(0.68, 0.015, 0.5).clone();
    g.applyMatrix4(new THREE.Matrix4().makeTranslation(gx, topY + 0.05, gz));
    g.applyMatrix4(district.basis);
    colorize(g, C.pavingDark);
    district.paint.push({ geometry: g });
  }

  const baseY = topY + 0.05;

  // 胡同牌楼（西端）
  district.addAsset((b) => buildPaifang(b, { plaque: 'sign-chunfeng' }), {
    x: -5.75, y: baseY, z: 0.35, rotY: 0,
  });

  // 北侧：两座四合院
  district.addAsset((b) => buildCourtyard(b, {
    width: 4.4, depth: 3.4, gate: true, lions: false, lanterns: true,
  }), { x: -3.2, y: baseY, z: -2.95, rotY: 0 });
  // 牌楼两侧石狮
  district.addAsset((b) => buildLion(b, { scale: 1.05 }), { x: -5.85, y: baseY, z: -1.15, rotY: 0.18 });
  district.addAsset((b) => buildLion(b, { scale: 1.05 }), { x: -5.85, y: baseY, z: 1.65, rotY: -0.18 });
  district.addAsset((b) => buildCourtyard(b, {
    width: 4.4, depth: 3.4, gate: true, lions: false, lanterns: true,
  }), { x: 2.7, y: baseY, z: -3.0, rotY: 0.04 });

  // 南侧：小卖部 + 早点铺 + 小院
  district.addAsset((b) => buildShop(b, { banner: 'banner-shop' }), {
    x: -3.95, y: baseY, z: 2.85, rotY: Math.PI,
  });
  district.addAsset((b) => buildBreakfast(b), {
    x: 1.15, y: baseY, z: 2.9, rotY: Math.PI,
  });
  district.addAsset((b) => buildCourtyard(b, {
    width: 3.6, depth: 2.8, gate: true, lanterns: false, lions: false,
  }), { x: 4.85, y: baseY, z: 3.0, rotY: Math.PI - 0.03 });

  // 街边道具
  district.addAsset((b) => buildMailbox(b), { x: 1.1, y: baseY, z: -1.1, rotY: 0.12 });
  district.addAsset((b) => buildBike(b), { x: -4.6, y: baseY, z: 1.35, rotY: 0.35 });
  district.addAsset((b) => buildBike(b), { x: 5.55, y: baseY, z: 1.35, rotY: 1.25 });
  district.addAsset((b) => buildHutongSign(b, { cell: 'sign-nanluo' }), {
    x: 5.95, y: baseY, z: 0.1, rotY: Math.PI / 2 - 0.15,
  });
  district.addAsset((b) => buildHutongSign(b, { cell: 'sign-yandai' }), {
    x: -6.15, y: baseY, z: 3.7, rotY: 0.5,
  });
  district.addAsset((b) => buildLaundry(b), { x: -6.15, y: baseY, z: 2.35, rotY: Math.PI / 2 });

  // 老槐树（角落花池边）
  district.addAsset((b) => buildTree(b, { scale: 1.0, variant: 0 }), { x: -5.9, y: baseY, z: 3.5, rotY: 0.4 });
  district.addAsset((b) => buildTree(b, { scale: 0.9, variant: 1 }), { x: 5.95, y: baseY, z: -3.6, rotY: -0.3 });
  district.addAsset((b) => buildTree(b, { scale: 0.85, variant: 0 }), { x: -1.5, y: baseY, z: 3.3, rotY: 1.1 });

  // 灯笼串（跨街，高度高于相机，避免遮挡）
  district.addLanternString({ x: -4.0, y: topY + 3.7, z: 0.2, length: 2.7, count: 3, materials, group, phase: 0 });
  district.addLanternString({ x: 0.9, y: topY + 3.65, z: 0.2, length: 2.7, count: 3, materials, group, phase: 1.7 });

  // 台地西端台阶（牌楼外侧，两级）
  for (let i = 0; i < 2; i += 1) {
    const stepX = -6.55 - i * 0.36;
    const stepY = topY - (i + 1) * 0.24;
    const stepTop = stepY + 0.24;
    const { h } = district.groundAt(stepX, 0.2);
    const bottom = Math.min(stepTop - 0.26, h - 0.15);
    const g = boxGeometry(0.36, stepTop - bottom, 3.0).clone();
    g.applyMatrix4(new THREE.Matrix4().makeTranslation(0, bottom + (stepTop - bottom) / 2, 0));
    const world = district.matrixFor(stepX, 0, 0.2, 0);
    g.applyMatrix4(world);
    colorize(g, C.stoneDark);
    district.paint.push({ geometry: g });
  }

  // ---- 出生点：街心，面朝西（牌楼方向）
  const spawn = district.localPoint(-1.8, topY, 0.2);
  const facing = district.right.clone().multiplyScalar(-1); // 面朝 local -x
  district.spawn = buildSpawn(district, spawn, facing);

  // 地标
  district.landmark('hutong-street', '春风胡同 · 街心', [-1.8, topY + 0.1, 0.2], {
    description: '胡同街心，西望牌楼与两座四合院；推荐作为出生点/任务点',
    facing: [facing.x, facing.y, facing.z],
  });
  district.landmark('hutong-paifang', '春风胡同牌楼', [-5.75, topY + 2.2, 0.35], {
    description: '胡同西口牌楼，牌匾「春风胡同」；面朝 +x（胡同里）摆 NPC 最佳',
    facing: [district.right.x, district.right.y, district.right.z],
  });
  district.landmark('hutong-courtyard', '四合院', [-3.2, topY + 1.7, -1.25], {
    description: '带石狮/红门的四合院门口，面朝 +z（街上）',
    facing: [district.forward.x, district.forward.y, district.forward.z],
  });
  district.landmark('hutong-mailbox', '绿色邮筒', [1.1, topY + 0.8, -1.1], {
    description: '邮筒旁，适合放拾取点/邮差 NPC，面朝 +x 或 +z',
    facing: [district.right.x, district.right.y, district.right.z],
  });
  district.landmark('hutong-shop', '胡同小卖部', [-3.95, topY + 1.2, 1.85], {
    description: '小卖部门口，面朝 -z（街心）',
    facing: [-district.forward.x, -district.forward.y, -district.forward.z],
  });
  district.landmark('hutong-breakfast', '老张早点', [1.15, topY + 1.3, 1.9], {
    description: '早点铺前，适合放摊主 NPC，面朝 -z（街心）',
    facing: [-district.forward.x, -district.forward.y, -district.forward.z],
  });
  district.landmark('hutong-tree', '老槐树', [-5.9, topY + 2.6, 3.5], {
    description: '西南角老槐树下，适合聊天/回忆点',
    facing: [district.right.x, district.right.y, district.right.z],
  });

  // ---- 长城片段：沿台地南侧外沿的城墙 + 两座烽火台（自建，绝不会和既有建筑穿插）
  buildHutongWall(district, { z: 4.35, xMin: -6.2, xMax: 2.3, height: 2.15, topY });

  // ---- 建筑碰撞盒（给 PlayerController 做水平 OBB 阻挡；街心/牌楼下保持可通行）
  const gy = topY + 0.05;
  district.addCollider('hutong-courtyard-1', { name: '四合院（带石狮）', x: -3.2, z: -2.95, y: gy, w: 4.4, d: 3.4, h: 3.2, rotY: 0 });
  district.addCollider('hutong-courtyard-2', { name: '四合院（东）', x: 2.7, z: -3.0, y: gy, w: 4.4, d: 3.4, h: 3.2, rotY: 0.04 });
  district.addCollider('hutong-courtyard-3', { name: '四合院（小院）', x: 4.85, z: 3.0, y: gy, w: 3.6, d: 2.8, h: 2.7, rotY: Math.PI - 0.03 });
  district.addCollider('hutong-shop', { name: '胡同小卖部', x: -3.95, z: 2.85, y: gy, w: 2.7, d: 2.0, h: 3.0, rotY: Math.PI });
  district.addCollider('hutong-breakfast', { name: '老张早点（操作台）', x: 1.15, z: 2.9, y: gy, w: 2.4, d: 0.9, h: 1.05, rotY: Math.PI });
  // 牌楼两根柱子（中间可过）
  district.addCollider('hutong-paifang-pillar-1', { name: '牌楼柱（北）', x: -5.75, z: 0.35 - 1.75, y: gy, w: 0.62, d: 0.62, h: 3.6 });
  district.addCollider('hutong-paifang-pillar-2', { name: '牌楼柱（南）', x: -5.75, z: 0.35 + 1.75, y: gy, w: 0.62, d: 0.62, h: 3.6 });
  // 城墙 + 两座烽火台
  district.addCollider('hutong-wall', { name: '城墙片段', x: (-6.2 + 2.3) / 2, z: 4.35, y: topY, w: 8.5, d: 0.82, h: 2.15 });
  {
    const xMin = -6.2;
    const xMax = 2.3;
    const t1 = xMin + (xMax - xMin) * 0.22;
    const t2 = xMin + (xMax - xMin) * 0.78;
    district.addCollider('hutong-wall-tower-1', { name: '长城烽火台 1', x: t1, z: 4.4, y: topY, w: 2.0, d: 2.0, h: 3.45 });
    district.addCollider('hutong-wall-tower-2', { name: '长城烽火台 2', x: t2, z: 4.4, y: topY, w: 2.0, d: 2.0, h: 3.45 });
  }

  // 推荐 NPC 站位（街上，地面已被台地垫平；周围 0.8u 无道具）
  district.npcSpot('npc-hutong-daye', '遛鸟大爷', [-5.05, topY, 0.55], [1, 0],
    '牌楼里侧街边，面朝胡同东口，适合放遛鸟大爷');
  district.npcSpot('npc-hutong-dama', '广场舞大妈', [0.35, topY, 1.35], [-1, 0],
    '早点铺前街边，面朝西（牌楼方向），适合放胡同大妈');
  district.npcSpot('npc-hutong-xuesheng', '红领巾小学生', [2.55, topY, -0.55], [-1, 0.2],
    '邮筒旁街边，面朝西，适合放放学的小学生');
  district.npcSpot('npc-hutong-laoshi', '胡同老街坊', [4.35, topY, 1.35], [-1, 0],
    '胡同东口街边，面朝西（能看见牌楼），适合放老街坊/小卖部老板');
  return topY;
}

/** 计算出生点数据：point / normal / heading（与 src/game/player.js 的 heading 约定一致）。 */
function buildSpawn(district, point, facing) {
  const up = district.up.clone().normalize();
  const base = new THREE.Vector3(1, 0, 0).addScaledVector(up, -up.x);
  if (base.lengthSq() < 1e-5) base.set(0, 0, 1).addScaledVector(up, -up.z);
  base.normalize();
  const right = new THREE.Vector3().crossVectors(up, base).normalize();
  const dir = facing.clone().addScaledVector(up, -facing.dot(up)).normalize();
  const heading = Math.atan2(dir.dot(right), dir.dot(base));
  return {
    point: point.toArray(),
    normal: up.toArray(),
    facing: dir.toArray(),
    heading,
    cameraDirection: dir.toArray(),
    district: district.id,
  };
}

/** 中轴区：鼓楼 + 天坛祈年殿（在星球北面的高地草坪上）。 *//** 中轴区：鼓楼 + 天坛祈年殿（在星球北面的高地草坪上）。 */
function layoutAxis(district, ctx) {
  // 中轴广场（低台地）
  const topY = district.addTerrace({ x: 0, z: 0, w: 8.4, d: 6.6, color: C.paving, sink: 0.7 });
  district.terraceTop = topY;
  // 中轴石板路
  const road = boxGeometry(7.4, 0.05, 1.1).clone();
  road.applyMatrix4(new THREE.Matrix4().makeTranslation(0, topY + 0.02, 0.2));
  road.applyMatrix4(district.basis);
  colorize(road, C.stoneLight);
  district.paint.push({ geometry: road });

  // 天坛祈年殿（西侧，自带三层圆台）
  const templeX = -2.15;
  const templeZ = -0.9;
  const templeBase = district.groundAt(templeX, templeZ).h + 0.04;
  district.addAsset((b) => buildTempleOfHeaven(b, { y: 0 }), {
    x: templeX, y: templeBase, z: templeZ, rotY: 0.2,
  });
  // 天坛前的华表一对
  for (const side of [-1, 1]) {
    district.addAsset((b) => {
      b.cyl(0.09, 0.12, 0.18, C.stoneLight, { y: 0, segments: 8 });
      b.cyl(0.07, 0.08, 2.1, C.white, { y: 0.18, segments: 8 });
      b.box(0.7, 0.08, 0.08, C.stoneLight, { y: 2.05 });
      b.box(0.7, 0.08, 0.08, C.stoneLight, { y: 1.78 });
      b.box(0.16, 0.3, 0.16, C.stoneDark, { y: 2.26 });
    }, { x: templeX + side * 1.5, y: templeBase, z: templeZ + 2.3, rotY: 0 });
  }

  // 鼓楼（东侧，方形石台）
  const drumX = 2.4;
  const drumZ = 0.3;
  const drumBase = district.groundAt(drumX, drumZ).h + 0.04;
  district.addAsset((b) => addStoneBase(b, { w: 4.4, d: 3.4, h: 0.3, color: C.stone }), {
    x: drumX, y: drumBase, z: drumZ,
  });
  district.addAsset((b) => buildDrumTower(b, { y: 0 }), {
    x: drumX, y: drumBase + 0.3, z: drumZ, rotY: -0.1,
  });
  // 鼓楼前石狮
  district.addAsset((b) => buildLion(b, { scale: 0.9 }), { x: drumX - 0.85, y: drumBase + 0.3, z: drumZ + 2.0, rotY: 0.2 });
  district.addAsset((b) => buildLion(b, { scale: 0.9 }), { x: drumX + 0.85, y: drumBase + 0.3, z: drumZ + 2.0, rotY: -0.2 });

  // 建筑碰撞盒
  district.addCollider('axis-temple', { name: '天坛祈年殿（含三层圆台）', x: templeX, z: templeZ, y: templeBase, w: 5.4, d: 5.4, h: 6.4 });
  district.addCollider('axis-gulou', { name: '鼓楼（含石台）', x: drumX, z: drumZ, y: drumBase, w: 4.4, d: 3.4, h: 7.2, rotY: -0.1 });

  // 灯笼串 + 树
  district.addLanternString({ x: -0.1, y: topY + 2.9, z: 0.2, length: 3.0, count: 3, materials: ctx.materials, group: ctx.group, phase: 0.9 });
  district.addAsset((b) => buildTree(b, { scale: 0.95, variant: 1 }), { x: -4.1, y: topY + 0.02, z: 2.3, rotY: 0.4 });

  const facingFwd = new THREE.Vector3(...district.forward.toArray());
  const facingRight = new THREE.Vector3(...district.right.toArray());
  district.landmark('qiniandian', '天坛祈年殿', [templeX, templeBase + 3.4, templeZ], {
    description: '祈年殿正面，三星圆台 + 蓝琉璃三重檐；建议从 +z 方向参观/放 NPC',
    facing: facingFwd.toArray(),
  });
  district.landmark('gulou', '鼓楼', [drumX, drumBase + 4.4, drumZ], {
    description: '鼓楼门洞前，面朝 +z（中轴广场方向）',
    facing: facingFwd.toArray(),
  });
  district.landmark('axis-plaza', '中轴广场', [0, topY + 0.2, 0.2], {
    description: '鼓楼与天坛之间的中轴石板广场，适合放任务点/合影视角',
    facing: [...facingRight.toArray()],
  });
  district.landmark('axis-street', '中轴街头', [0.4, topY + 0.2, 1.4], {
    description: '中轴广场南侧街心，面向鼓楼/天坛',
    facing: facingFwd.toArray(),
  });
  district.npcSpot('npc-axis-daye', '中轴遛鸟大爷', [0.55, topY, 1.25], [0, 1],
    '中轴广场南侧，面朝北（天坛/鼓楼之间）');
  return topY;
}

/** CBD 区：中国尊 + 央视大楼 + 鸟巢 + 798 烟囱（国贸街广场）。 */
function layoutCbd(district, ctx) {
  const topY = district.addTerrace({ x: 0, z: 0, w: 9.0, d: 6.8, color: C.paving, sink: 0.4 });
  district.terraceTop = topY;
  // 广场铺装分格（浅色地砖）
  for (let ix = 0; ix < 5; ix += 1) {
    for (let iz = 0; iz < 3; iz += 1) {
      if ((ix + iz) % 2 === 1) continue;
      const gx = -3.6 + ix * 1.8;
      const gz = -2.4 + iz * 1.8;
      const g = boxGeometry(1.5, 0.02, 1.5).clone();
      g.applyMatrix4(new THREE.Matrix4().makeTranslation(gx, topY + 0.012, gz));
      g.applyMatrix4(district.basis);
      colorize(g, C.stoneLight);
      district.paint.push({ geometry: g });
    }
  }

  const y = topY + 0.05;
  // 中国尊（东侧，面向广场）
  district.addAsset((b) => buildCiticTower(b), { x: 3.15, y, z: -1.35, rotY: 0.2 });
  // 央视大楼（北侧）
  district.addAsset((b) => buildCCTV(b), { x: -1.0, y, z: -2.55, rotY: 0.1 });
  // 鸟巢（西南角）
  district.addAsset((b) => buildBirdNest(b), { x: -3.15, y, z: 2.0, rotY: 0.5 });
  // 798 烟囱厂房（东南角，稍小一点保持天际线层次）
  district.addAsset((b) => {
    const temp = new Batch();
    buildFactory798(temp, { y: 0, x: 0, z: 0, ry: 0 });
    const scale = new THREE.Matrix4().makeScale(0.85, 0.85, 0.85);
    for (const part of temp.paint) { part.geometry.applyMatrix4(scale); }
    for (const part of temp.glow) { part.geometry.applyMatrix4(scale); }
    district.addAsset((target) => {
      target.paint.push(...temp.paint);
      target.glow.push(...temp.glow);
    }, { x: 3.2, y, z: 2.4, rotY: -0.12 });
  });
  // 建筑碰撞盒
  district.addCollider('cbd-citic', { name: '中国尊', x: 3.15, z: -1.35, y, w: 2.5, d: 2.5, h: 9.6 });
  district.addCollider('cbd-cctv', { name: '央视大楼', x: -1.0, z: -2.55, y, w: 4.0, d: 1.7, h: 5.5, rotY: 0.1 });
  district.addCollider('cbd-birdnest', { name: '鸟巢', x: -3.15, z: 2.0, y, w: 4.4, d: 3.4, h: 2.3, rotY: 0.5 });
  district.addCollider('cbd-factory', { name: '798 红砖厂房', x: 3.2, z: 2.4, y, w: 2.55, d: 1.78, h: 2.1, rotY: -0.12 });
  district.addCollider('cbd-chimney', { name: '798 烟囱', x: 1.87, z: 1.73, y, w: 0.8, d: 0.8, h: 4.8 });

  // 广场小品：花坛、路灯、国贸匾
  for (const [px, pz] of [[-1.6, 1.7], [1.3, 0.9]]) {
    district.addAsset((b) => {
      b.cyl(0.5, 0.56, 0.34, C.stoneDark, { y: 0, segments: 10 });
      b.cyl(0.46, 0.46, 0.06, C.leaf2, { y: 0.3, segments: 10 });
      b.ico(0.32, C.leaf, { y: 0.55, sy: 0.7 });
      b.ico(0.22, C.leaf3, { x: 0.25, y: 0.5, z: 0.14 });
    }, { x: px, y, z: pz, rotY: 0 });
  }
  for (const [px, pz] of [[-4.1, 0.9], [4.2, -0.2]]) {
    district.addAsset((b) => {
      b.cyl(0.06, 0.08, 2.4, C.ink, { y: 0, segments: 6 });
      b.box(0.06, 0.06, 0.5, C.ink, { y: 2.32 });
      b.sphere(0.11, C.warm, { y: 2.42, segments: 6, rings: 4 });
    }, { x: px, y, z: pz, rotY: 0 });
  }
  // 国贸 CBD 标识牌
  district.addAsset((b) => {
    b.box(1.9, 0.12, 0.3, C.stoneDark, { y: 0 });
    b.box(1.7, 0.7, 0.14, C.stoneLight, { y: 0.12 });
    b.decal(1.6, 0.6, 'plaque-cbd', { y: 0.42, z: 0.075 });
  }, { x: 0.3, y, z: 2.75, rotY: 0.06 });

  const fwd = new THREE.Vector3(...district.forward.toArray());
  const right = new THREE.Vector3(...district.right.toArray());
  district.landmark('citic', '中国尊', [3.05, y + 4.6, -1.55], {
    description: '中国尊脚下（收腰曲线塔，高 9.6），适合仰视合影',
    facing: right.negate().toArray(),
  });
  district.landmark('cctv', '央视大楼', [-0.7, y + 2.5, -2.5], {
    description: '央视大楼（拐角门形）正面',
    facing: fwd.negate().toArray(),
  });
  district.landmark('birdnest', '鸟巢', [-3.1, y + 0.9, 2.05], {
    description: '鸟巢编织钢架前，面朝 -z（广场）',
    facing: fwd.toArray(),
  });
  district.landmark('factory-798', '798 烟囱', [2.4, y + 3.0, 2.1], {
    description: '798 红砖厂房与烟囱',
    facing: right.negate().toArray(),
  });
  district.landmark('cbd-plaza', '国贸 CBD 广场', [0, y + 0.2, 1.0], {
    description: 'CBD 广场中心，适合任务点与四塔合影',
    facing: fwd.negate().toArray(),
  });
  district.npcSpot('npc-cbd-worker', '国贸上班族', [0.35, y - 0.05, 0.75], [0, 1],
    'CBD 广场中心，面朝中国尊/央视');
  return topY;
}

// ---------------------------------------------------------------------------
// 片区配置
// ---------------------------------------------------------------------------
const DISTRICT_SPECS = [
  {
    id: 'hutong',
    name: '春风胡同',
    center: [-0.1186, 0.2957, 0.9479],
    forwardHint: [0.0, 0.965, -0.2623],
    layout: layoutHutong,
    // 视角：[位置, 目标, fov]（片区切平面局部坐标）
    views: [
      { id: 'street', title: '胡同街景（出生点视角）', position: [3.2, 2.0, 0.2], target: [-6.6, 2.1, 0.2], fov: 52 },
      { id: 'paifang', title: '胡同牌楼', position: [1.4, 1.9, 0.4], target: [-5.75, 2.5, 0.35], fov: 54 },
      { id: 'aerial', title: '胡同鸟瞰', position: [9.5, 8.0, 11.5], target: [0, 1.2, 0], fov: 48 },
      { id: 'gate', title: '四合院门口', position: [-3.1, 1.6, 1.6], target: [-3.2, 1.9, -2.7], fov: 52 },
    ],
  },
  {
    id: 'axis',
    name: '中轴 · 鼓楼天坛',
    center: [-0.0337, 0.9984, -0.0446],
    forwardHint: [0.0, 0.0022, -1.0],
    layout: layoutAxis,
    views: [
      { id: 'street', title: '中轴广场（鼓楼↔天坛）', position: [-1.4, 3.4, 9.4], target: [-0.2, 2.5, -0.6], fov: 64 },
      { id: 'aerial', title: '中轴鸟瞰', position: [8.5, 8.6, 11.5], target: [0, 1.8, 0], fov: 50 },
      { id: 'temple', title: '天坛祈年殿', position: [2.6, 1.7, 3.4], target: [-2.15, 2.9, -0.9], fov: 56 },
      { id: 'gulou', title: '鼓楼', position: [-3.2, 1.7, 4.4], target: [2.4, 3.2, 0.3], fov: 56 },
    ],
  },
  {
    id: 'cbd',
    name: '国贸 CBD',
    center: [0.9368, 0.3464, 0.0499],
    forwardHint: [0.35, -0.9272, -0.1336],
    layout: layoutCbd,
    views: [
      { id: 'street', title: 'CBD 街景', position: [0.6, 2.2, 5.3], target: [1.7, 3.3, -1.2], fov: 66 },
      { id: 'aerial', title: 'CBD 鸟瞰', position: [9.0, 9.0, 11.0], target: [0, 2.2, 0], fov: 48 },
      { id: 'tower', title: '中国尊', position: [-0.2, 1.35, 2.5], target: [3.15, 4.8, -1.35], fov: 62 },
    ],
  },
  {
    id: 'wall',
    name: '山脊长城',
    center: [-0.1186, 0.2957, 0.9479], // 与胡同同坐标系；长城建在胡同台地南沿
    forwardHint: [0.0, 0.965, -0.2623],
    layout: null,
    inheritTerrace: 'hutong',
    views: [
      { id: 'ridge', title: '城墙片段', position: [0.4, 3.3, 10.6], target: [-2.0, 2.6, 4.4], fov: 58, flat: true },
      { id: 'aerial', title: '城墙鸟瞰', position: [-2.0, 11.0, 4.4], target: [-2.0, 0.0, 4.4], fov: 55, flat: true, up: 'forward' },
    ],
  },
];

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------
export function buildBeijing({ scene, collision, spots, group } = {}) {
  if (!collision) throw new Error('buildBeijing: collision is required');
  const root = group || new THREE.Group();
  root.name = root.name || 'beijing-assets';
  if (scene && !root.parent) scene.add(root);

  const atlas = createAtlas();
  const materials = {
    paint: createToonMaterial({
      color: '#ffffff', vertexColors: true, flatShading: true, surfaceId: 0.17,
    }),
    decal: createToonMaterial({
      color: '#ffffff', map: atlas.texture, flatShading: false, surfaceId: 0.31,
    }),
    glow: createToonMaterial({
      color: '#ffffff', vertexColors: true, flatShading: true, emissive: '#2c1008', surfaceId: 0.19,
    }),
  };
  for (const material of Object.values(materials)) {
    material.name = `beijing-${Math.random().toString(36).slice(2, 6)}`;
  }

  const districts = {};
  const landmarks = [];
  const warnings = [];
  const groupMeshes = [];

  // 现有 NPC / 交互点：用来做距离检查（避免把建筑压在任务点上）
  const reserved = [];
  if (spots) {
    for (const [id, spot] of Object.entries(spots)) {
      if (spot?.point) reserved.push({ id, point: new THREE.Vector3(...spot.point) });
    }
  }
  const checkClear = (label, localPoint, radius) => {
    const world = localPoint.isVector3 ? localPoint : new THREE.Vector3(...localPoint);
    for (const item of reserved) {
      const distance = world.distanceTo(item.point);
      if (distance < radius) warnings.push(`${label} 距离现有交互点 ${item.id} 仅 ${distance.toFixed(2)}u`);
    }
  };

  for (const spec of DISTRICT_SPECS) {
    const district = new District({
      id: spec.id,
      name: spec.name,
      center: spec.center,
      forwardHint: spec.forwardHint,
      collision,
    });
    district.views = spec.views || [];
    districts[spec.id] = district;

    if (spec.layout) {
      spec.layout(district, { materials, group: root });
    }
    if (spec.inheritTerrace && districts[spec.inheritTerrace]) {
      district.terraceTop = districts[spec.inheritTerrace].terraceTop;
    }

  }

  // 汇总地标 + 清空各片区的几何缓冲
  const info = { districts: {}, draws: 0, triangles: 0 };
  for (const [id, district] of Object.entries(districts)) {
    const meshes = district.mergeInto(root, materials);
    let triangles = 0;
    for (const mesh of Object.values(meshes)) {
      groupMeshes.push(mesh);
      const geometry = mesh.geometry;
      const index = geometry?.getIndex();
      if (index) triangles += index.count / 3;
      else if (geometry) triangles += geometry.getAttribute('position').count / 3;
    }
    info.districts[id] = {
      name: district.name,
      origin: district.origin.toArray().map((v) => +v.toFixed(3)),
      up: district.up.toArray().map((v) => +v.toFixed(4)),
      forward: district.forward.toArray().map((v) => +v.toFixed(4)),
      right: district.right.toArray().map((v) => +v.toFixed(4)),
      terraceTop: district.terraceTop ?? null,
      terrace: district.terrace,
      triangles: Math.round(triangles),
      meshes: Object.keys(meshes),
    };
    info.draws += Object.keys(meshes).length;
    info.triangles += triangles;
    landmarks.push(...district.landmarks);
    // 距离检查：片区中心是否压到现有交互点
    checkClear(`${district.name} 中心`, district.origin, 3.0);
    district.landmarks.forEach((entry) => checkClear(entry.name, entry.point, 1.2));
  }

  const spawn = districts.hutong?.spawn || null;
  const npcSpots = [];
  const wallColliders = [];
  for (const district of Object.values(districts)) {
    npcSpots.push(...district.npcSpots);
    wallColliders.push(...district.colliders);
  }
  const fontsReady = prepareFonts(atlas);

  const update = (time) => {
    for (const district of Object.values(districts)) {
      for (const entry of district.animated) {
        if (!entry.mesh || !entry.baseQuaternion) continue;
        const angle = Math.sin(time * 0.85 + entry.phase) * 0.045 + Math.sin(time * 1.9 + entry.phase * 2) * 0.012;
        entry.mesh.quaternion.copy(entry.baseQuaternion).multiply(
          new THREE.Quaternion().setFromEuler(new THREE.Euler(angle, 0, 0)),
        );
      }
    }
  };

  return {
    group: root,
    update,
    spawn,
    npcSpots,
    wallColliders,
    landmarks,
    districts: Object.values(districts).map((district) => ({
      id: district.id,
      name: district.name,
      origin: district.origin.toArray(),
      up: district.up.toArray(),
      right: district.right.toArray(),
      forward: district.forward.toArray(),
      terraceTop: district.terraceTop || 0,
      terrace: district.terrace,
      views: district.views,
    })),
    ready: Promise.resolve(true),
    fontsReady,
    materials,
    atlas,
    warnings,
    info: () => ({ ...info, warnings, landmarks: landmarks.length, colliders: wallColliders.length, npcSpots: npcSpots.length }),
  };
}

// ---------------------------------------------------------------------------
// 资产陈列（tools/beijing/test.html?mode=gallery）
// ---------------------------------------------------------------------------
export function buildBeijingAssetGallery({ scene, group, keys = null } = {}) {
  const root = group || new THREE.Group();
  root.name = 'beijing-gallery';
  if (scene && !root.parent) scene.add(root);

  const atlas = createAtlas();
  const materials = {
    paint: createToonMaterial({ color: '#ffffff', vertexColors: true, flatShading: true, surfaceId: 0.17 }),
    decal: createToonMaterial({ color: '#ffffff', map: atlas.texture, flatShading: false, surfaceId: 0.31 }),
    glow: createToonMaterial({ color: '#ffffff', vertexColors: true, flatShading: true, emissive: '#2c1008', surfaceId: 0.19 }),
  };

  const allItems = [
    { key: 'courtyard', name: '四合院', w: 6, build: (b) => buildCourtyard(b, { lions: true }) },
    { key: 'courtyard2', name: '四合院（小院）', w: 5, build: (b) => buildCourtyard(b, { width: 4.2, depth: 3.4, lions: false }) },
    { key: 'shop', name: '小卖部', w: 3.4, build: (b) => buildShop(b) },
    { key: 'breakfast', name: '早点铺', w: 3.6, build: (b) => buildBreakfast(b) },
    { key: 'paifang', name: '胡同牌楼', w: 4.2, build: (b) => buildPaifang(b) },
    { key: 'sign', name: '胡同路牌', w: 1.8, build: (b) => buildHutongSign(b) },
    { key: 'mailbox', name: '绿色邮筒', w: 1.2, build: (b) => buildMailbox(b) },
    { key: 'bike', name: '二八自行车', w: 1.6, build: (b) => buildBike(b) },
    { key: 'lion', name: '石狮子', w: 1.2, build: (b) => buildLion(b) },
    { key: 'tree', name: '老槐树', w: 3.6, build: (b) => buildTree(b, { scale: 1.2 }) },
    { key: 'laundry', name: '晾衣绳', w: 3.2, build: (b) => buildLaundry(b) },
    { key: 'gulou', name: '鼓楼', w: 4.6, build: (b) => buildDrumTower(b) },
    { key: 'temple', name: '天坛祈年殿', w: 5.6, build: (b) => buildTempleOfHeaven(b) },
    { key: 'citic', name: '中国尊', w: 3.4, build: (b) => buildCiticTower(b) },
    { key: 'cctv', name: '央视大楼', w: 4.0, build: (b) => buildCCTV(b) },
    { key: 'nest', name: '鸟巢', w: 4.2, build: (b) => buildBirdNest(b) },
    { key: 'factory', name: '798 厂房烟囱', w: 4.4, build: (b) => buildFactory798(b) },
  ];

  const items = keys ? allItems.filter((item) => keys.includes(item.key)) : allItems;
  const batch = new Batch();
  const labelItems = [];
  const columns = 4;
  const spacingX = 5.6;
  const spacingZ = 5.2;
  const rows = Math.ceil(items.length / columns);
  const offsetX = ((columns - 1) * spacingX) / 2;
  const offsetZ = ((rows - 1) * spacingZ) / 2;
  items.forEach((item, index) => {
    const gx = index % columns;
    const gz = Math.floor(index / columns);
    const x = gx * spacingX - offsetX;
    const z = gz * spacingZ - offsetZ;
    // 每件资产下面一个石台
    batch.box(item.w, 0.16, item.w * 0.8, C.stoneDark, { x, y: 0.02, z });
    const temp = new Batch();
    item.build(temp);
    const world = new THREE.Matrix4().makeTranslation(x, 0.18, z);
    for (const part of temp.paint) { part.geometry.applyMatrix4(world); batch.paint.push(part); }
    for (const entry of temp.decals) { entry.geometry.applyMatrix4(world.clone().multiply(entry.matrix)); batch.decals.push({ geometry: entry.geometry }); }
    for (const part of temp.glow) { part.geometry.applyMatrix4(world); batch.glow.push(part); }
    labelItems.push({
      key: item.key,
      name: item.name,
      labelPosition: new THREE.Vector3(x, 3.6, z),
    });
  });

  // 灯笼串（动态）
  const lanternBatch = new Batch();
  const lanternGeomData = [];
  {
    const temp = new Batch();
    const length = 3.0;
    for (const side of [-1, 1]) temp.cyl(0.035, 0.045, 2.0, C.woodDark, { x: side * (length / 2 + 0.1), y: 0 });
    temp.box(length + 0.2, 0.05, 0.05, C.ink, { y: 2.0 });
    for (let i = 0; i < 3; i += 1) {
      const lx = -length / 2 + (i / 2) * length;
      temp.cyl(0.16, 0.16, 0.24, C.lantern, { x: lx, y: 1.58, segments: 8 });
      temp.cyl(0.17, 0.17, 0.03, C.gold, { x: lx, y: 1.82, segments: 8 });
      temp.cyl(0.17, 0.17, 0.03, C.gold, { x: lx, y: 1.55, segments: 8 });
      temp.box(0.02, 0.16, 0.02, C.ink, { x: lx, y: 2.0 });
    }
    lanternBatch.paint.push(...temp.paint);
    const geometry = mergeParts(lanternBatch.paint);
    lanternGeomData.push(geometry);
  }
  const lanternMesh = new THREE.Mesh(lanternGeomData[0], materials.glow);
  lanternMesh.position.set(offsetX + 3.0, 0.18, offsetZ + 2.6);
  lanternMesh.castShadow = true;
  root.add(lanternMesh);

  const animated = [{ mesh: lanternMesh, baseQuaternion: lanternMesh.quaternion.clone(), phase: 0 }];

  const meshes = batch.mergeInto(root, materials, 'gallery');
  const fontsReady = prepareFonts(atlas);

  const update = (time) => {
    for (const entry of animated) {
      const angle = Math.sin(time * 0.85 + entry.phase) * 0.05;
      entry.mesh.quaternion.copy(entry.baseQuaternion).multiply(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(angle, 0, 0)),
      );
    }
  };

  return {
    group: root,
    update,
    items: labelItems,
    itemsCount: items.length,
    meshes,
    materials,
    atlas,
    ready: Promise.resolve(true),
    fontsReady,
    info: () => ({ gallery: items.map((item) => item.key) }),
  };
}

// 供工具/文档使用的额外导出
export const BEIJING_DISTRICTS = DISTRICT_SPECS;
export const BEIJING_CELLS = CELLS;


// ---------------------------------------------------------------------------
// 单体资产（工具页逐件检查用）
// ---------------------------------------------------------------------------
export const ASSET_BUILDERS = {
  courtyard: (b) => buildCourtyard(b, { lions: true }),
  courtyard2: (b) => buildCourtyard(b, { width: 4.2, depth: 3.4 }),
  paifang: (b) => buildPaifang(b),
  sign: (b) => buildHutongSign(b),
  shop: (b) => buildShop(b),
  breakfast: (b) => buildBreakfast(b),
  mailbox: (b) => buildMailbox(b),
  bike: (b) => buildBike(b),
  lion: (b) => buildLion(b),
  tree: (b) => buildTree(b, { scale: 1.2 }),
  laundry: (b) => buildLaundry(b),
  gulou: (b) => buildDrumTower(b),
  temple: (b) => buildTempleOfHeaven(b),
  citic: (b) => buildCiticTower(b),
  cctv: (b) => buildCCTV(b),
  nest: (b) => buildBirdNest(b),
  factory: (b) => buildFactory798(b),
  lanterns: (b) => {
    const temp = new Batch();
    for (let i = 0; i < 3; i += 1) temp.lantern(i * 0.8 - 0.8, 1.6, 0, 0.24);
    b.paint.push(...temp.paint);
    b.glow.push(...temp.glow);
  },
};

/** Build one asset on a flat plinth (tools/beijing/test.html?mode=single). */
export function buildBeijingSingleAsset({ key = 'courtyard', group } = {}) {
  const root = group || new THREE.Group();
  root.name = `beijing-single-${key}`;
  const atlas = createAtlas();
  const materials = {
    paint: createToonMaterial({ color: '#ffffff', vertexColors: true, flatShading: true, surfaceId: 0.17 }),
    decal: createToonMaterial({ color: '#ffffff', map: atlas.texture, flatShading: false, surfaceId: 0.31 }),
    glow: createToonMaterial({ color: '#ffffff', vertexColors: true, flatShading: true, emissive: '#2c1008', surfaceId: 0.19 }),
  };
  const batch = new Batch();
  batch.box(7.0, 0.2, 6.0, C.stoneDark, { x: 0, y: 0, z: 0 });
  const builder = ASSET_BUILDERS[key] || ASSET_BUILDERS.courtyard;
  const temp = new Batch();
  builder(temp);
  const world = new THREE.Matrix4().makeTranslation(0, 0.2, 0);
  for (const part of temp.paint) { part.geometry.applyMatrix4(world); batch.paint.push(part); }
  for (const entry of temp.decals) { entry.geometry.applyMatrix4(world.clone().multiply(entry.matrix)); batch.decals.push({ geometry: entry.geometry }); }
  for (const part of temp.glow) { part.geometry.applyMatrix4(world); batch.glow.push(part); }
  const meshes = batch.mergeInto(root, materials, key);
  const fontsReady = prepareFonts(atlas);
  return {
    group: root,
    key,
    options: Object.keys(ASSET_BUILDERS),
    materials,
    atlas,
    meshes,
    ready: Promise.resolve(true),
    fontsReady,
    update() {},
    info: () => ({ key, meshes: Object.keys(meshes) }),
  };
}
