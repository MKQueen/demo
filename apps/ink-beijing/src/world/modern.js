/**
 * modern.js —— 现代北京：国贸 CBD / 鸟巢 / 水立方 / 国家大剧院。
 *
 * 契约：export function buildModern(ctx) → THREE.Group。
 *
 * 美术定位（与古都的对照）：
 *   宫城是金红重彩、压在中轴上；现代北京是纸上另起的一层**冷灰蓝淡墨**：
 *   低多边形、强剪影、冷灰 → 浅青灰的竖向渐变，少量亮面（中国尊的冠、
 *   大剧院的银蛋、水立方的气泡）。墨线交给后期 Sobel，所以这里只负责
 *   「块面明暗 + 前后关系」，不做贴图写实。
 *
 * 做法：
 *   1. 所有不透明建筑（塔楼 / 鸟巢 / 水池岸 / 基座）烘进一个
 *      `MeshLambertMaterial({ vertexColors, flatShading })` 的合并 mesh，
 *      颜色在顶点上做「底暗顶亮」的淡墨渐变 —— 整片 CBD 只 1 个 draw call；
 *   2. 配角塔楼 / 低层街块走 InstancedMesh（每个几何 1 个 draw call），
 *      实例色做浓淡变化，让远处像「一片城」；
 *   3. 需要材质的几块（街区底盘、奥体公园、水立方气泡、大剧院水池与倒影）
 *      各用一张程序化 canvas 纹理，独立 mesh；
 *   4. 坐标/尺寸全部取自 layout.MODERN（1 世界单位 = 50m，h() 已含竖向夸张）。
 *
 * 性能：实测 9 draws / 约 1.05 万 tris（远低于 60k tris / 40 draws 的预算）。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MODERN, INNER_CITY } from '../layout.js';
import { WATER } from '../lib/palette.js';
import { makeRng } from '../lib/rand.js';
import { buildTrees } from '../lib/flora.js';

const TAU = Math.PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const fract = (v) => v - Math.floor(v);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();

/** 平移 + 绕轴旋转 + 缩放的矩阵。 */
function M(x = 0, y = 0, z = 0, o = {}) {
  _euler.set(o.rx || 0, o.ry || 0, o.rz || 0);
  _quat.setFromEuler(_euler);
  return new THREE.Matrix4().compose(V3(x, y, z), _quat, V3(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
}

/* ========================================================================== */
/*  一、冷灰蓝色阶                                                              */
/* ========================================================================== */

/**
 * 冷灰蓝的「墨分五色」：深 → 浅。
 * 竖向渐变（底深顶浅）让每栋楼自带一层淡墨，和宫城的重彩拉开距离。
 */
const C = {
  deepest: new THREE.Color(0x1c252b),
  deep: new THREE.Color(0x26333a),
  dark: new THREE.Color(0x32414a),
  mid: new THREE.Color(0x42535c),
  soft: new THREE.Color(0x556873),
  pale: new THREE.Color(0x6d818b),
  paper: new THREE.Color(0x8e9fa5),
  silver: new THREE.Color(0xc4cccd),
  dome: new THREE.Color(0x97a8ab),
  steel: new THREE.Color(0x374650),
  nest: new THREE.Color(0x46565e),
  seat: new THREE.Color(0x7e8b87),
  field: new THREE.Color(0x5f6b60),
};

/**
 * 纸上的「假想光」：比真实太阳再压一档，专门把背光面烘焙进顶点色。
 * 后期墨线从明暗里长出来，块面之间必须先有差。
 */
const BAKE_LIGHT = new THREE.Vector3(0.16, 0.58, 0.74).normalize();

function defaultShade(nx, ny, nz) {
  const d = nx * BAKE_LIGHT.x + ny * BAKE_LIGHT.y + nz * BAKE_LIGHT.z;
  return 0.68 + 0.36 * Math.max(0, d);
}

/** 平面剖分的常用截面（归一化到半边宽）；绕 y 排布，近似圆角方塔。 */
const SHAPES = {
  square: [[1, 1], [-1, 1], [-1, -1], [1, -1]],
  chamfer: [[1, 0.55], [0.55, 1], [-0.55, 1], [-1, 0.55], [-1, -0.55], [-0.55, -1], [0.55, -1], [1, -0.55]],
  oct: [[1, 0.42], [0.42, 1], [-0.42, 1], [-1, 0.42], [-1, -0.42], [-0.42, -1], [0.42, -1], [1, -0.42]],
};

/* ========================================================================== */
/*  一·五、奥体公园的地理（全部由 layout 推出，别处不要写死）                       */
/* ========================================================================== */

/** 奥体公园的矩形底盘：把鸟巢、水立方、奥林匹克塔都圈进来，南北留出林带。 */
const OLYMPIC = {
  x0: -26,
  x1: 30,
  z0: -196,
  z1: -140,
  get cx() {
    return (this.x0 + this.x1) / 2;
  },
  get cz() {
    return (this.z0 + this.z1) / 2;
  },
  get w() {
    return this.x1 - this.x0;
  },
  get d() {
    return this.z1 - this.z0;
  },
};

/** 中轴北延的林荫大道：从奥体公园南缘一路压到北城墙关厢（z ≈ -68）。 */
const OLYMPIC_AXIS = { z0: OLYMPIC.z1, z1: -68, halfW: 1.15 };

/* ========================================================================== */
/*  二、顶点着色合批器                                                          */
/* ========================================================================== */

/**
 * 把一堆几何烘成「一份 position/normal/color」，最后按材质合成一个 mesh。
 * 颜色在【世界坐标】上按 y 做渐变：y0 处为 c0，y1 处为 c1。
 */
class InkBatch {
  constructor() {
    this.geos = [];
  }

  /**
   * @param {THREE.BufferGeometry} geo  局部坐标几何
   * @param {THREE.Matrix4|null} matrix 世界矩阵（在着色前应用）
   * @param {THREE.Color|number} c0     底部颜色
   * @param {THREE.Color|number} c1     顶部颜色（缺省同 c0）
   * @param {{y0?:number,y1?:number,gamma?:number,shadeFn?:Function}} opts
   */
  add(geo, matrix, c0, c1 = c0, opts = {}) {
    if (!geo || !geo.attributes || !geo.attributes.position) return this;
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const key of Object.keys(g.attributes)) {
      if (key !== 'position' && key !== 'normal') g.deleteAttribute(key);
    }
    if (matrix) g.applyMatrix4(matrix);
    g.computeVertexNormals();
    g.computeBoundingBox();

    const bb = g.boundingBox;
    const lo = opts.y0 ?? bb.min.y;
    const hi = opts.y1 ?? bb.max.y;
    const span = Math.max(1e-5, hi - lo);
    const gamma = opts.gamma ?? 0.9;
    const shadeFn = opts.shadeFn === null ? null : opts.shadeFn || defaultShade;

    const ca = c0 && c0.isColor ? c0 : new THREE.Color(c0);
    const cb = c1 && c1.isColor ? c1 : new THREE.Color(c1 ?? c0);

    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    const n = pos.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = Math.pow(clamp01((pos.getY(i) - lo) / span), gamma);
      let r = ca.r + (cb.r - ca.r) * t;
      let gg = ca.g + (cb.g - ca.g) * t;
      let b = ca.b + (cb.b - ca.b) * t;
      if (shadeFn) {
        const k = shadeFn(nrm.getX(i), nrm.getY(i), nrm.getZ(i), pos.getX(i), pos.getY(i), pos.getZ(i));
        r *= k;
        gg *= k;
        b *= k;
      }
      colors[i * 3] = r;
      colors[i * 3 + 1] = gg;
      colors[i * 3 + 2] = b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.geos.push(g);
    return this;
  }

  flush(parent, mat, name = 'modern-ink') {
    if (!this.geos.length) return null;
    const geo = mergeGeometries(this.geos, false);
    if (!geo) return null;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    mesh.frustumCulled = false;
    parent.add(mesh);
    return mesh;
  }
}

/* ---------------------------- 几何小工具 ---------------------------------- */

/** 折线截面沿 y 挤出：sections = [{ y, sx, sz, ox?, oz? }]，首尾自动封口。 */
function prismGeometry(shape, sections) {
  const ring = (s) => shape.map(([nx, nz]) => [(s.ox || 0) + nx * s.sx, s.y, (s.oz || 0) + nz * s.sz]);
  const pos = [];
  const push = (p) => pos.push(p[0], p[1], p[2]);
  for (let k = 0; k < sections.length - 1; k++) {
    const A = ring(sections[k]);
    const B = ring(sections[k + 1]);
    for (let i = 0; i < shape.length; i++) {
      const j = (i + 1) % shape.length;
      push(A[i]); push(B[i]); push(A[j]);
      push(A[j]); push(B[i]); push(B[j]);
    }
  }
  const top = ring(sections[sections.length - 1]);
  const bot = ring(sections[0]);
  const sTop = sections[sections.length - 1];
  const sBot = sections[0];
  const topC = [sTop.ox || 0, sTop.y, sTop.oz || 0];
  const botC = [sBot.ox || 0, sBot.y, sBot.oz || 0];
  for (let i = 0; i < shape.length; i++) {
    const j = (i + 1) % shape.length;
    // 截面点序在俯视图里是顺时针，所以封盖要反着绕，法线才朝外
    pos.push(topC[0], topC[1], topC[2], top[j][0], top[j][1], top[j][2], top[i][0], top[i][1], top[i][2]);
    pos.push(botC[0], botC[1], botC[2], bot[i][0], bot[i][1], bot[i][2], bot[j][0], bot[j][1], bot[j][2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** 塔身：把 (t, scale) 剖面列表变成一圈圈方形截面。 */
function addTower(batch, o) {
  const {
    x = 0, z = 0, y = 0, H,
    halfW, halfD = halfW,
    shape = SHAPES.square,
    profile = [[0, 1], [1, 1]],
    rotY = 0, bottom = C.dark, top = C.pale, gamma,
  } = o;
  const sections = profile.map(([t, s]) => ({ y: t * H, sx: s * halfW, sz: s * halfD, ox: 0, oz: 0 }));
  const geo = prismGeometry(shape, sections);
  batch.add(geo, M(x, y, z, { ry: rotY }), bottom, top, { y0: y, y1: y + H, gamma });
}

/** 一圈薄薄的「腰带」：略大于塔身，压一道重墨 / 亮光。 */
function addBand(batch, o) {
  const { x = 0, z = 0, y0, y1, halfW, halfD = halfW, shape = SHAPES.square, color = C.deep, rotY = 0 } = o;
  const geo = prismGeometry(shape, [
    { y: y0, sx: halfW, sz: halfD },
    { y: y1, sx: halfW, sz: halfD },
  ]);
  batch.add(geo, M(x, 0, z, { ry: rotY }), color, color);
}

/** 方盒（盒底落在 y 上）。 */
function addBox(batch, w, hh, d, x, y, z, ry = 0, bottom = C.dark, top = bottom, opts = {}) {
  const geo = new THREE.BoxGeometry(w, hh, d);
  batch.add(geo, M(x, y + hh / 2, z, { ry }), bottom, top, opts);
}

/** 剖面插值：给定剖面，取 t 处的缩放。 */
function profileAt(profile, t) {
  if (t <= profile[0][0]) return profile[0][1];
  for (let i = 0; i < profile.length - 1; i++) {
    const [t0, s0] = profile[i];
    const [t1, s1] = profile[i + 1];
    if (t >= t0 && t <= t1) {
      const k = (t - t0) / Math.max(1e-6, t1 - t0);
      return s0 + (s1 - s0) * k;
    }
  }
  return profile[profile.length - 1][1];
}

/** 手搓四边形累加器（鸟巢的编织条带用，省 BufferGeometry 开销）。 */
function quadBuilder() {
  const pos = [];
  return {
    quad(p0, p1, p2, p3) {
      pos.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
      pos.push(p0[0], p0[1], p0[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2]);
    },
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      return g;
    },
  };
}

/* ========================================================================== */
/*  三、程序化纹理（canvas，无外部图片）                                          */
/* ========================================================================== */

const _texCache = {};

function canvas2d(w, hh) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = hh;
  return c;
}

function toTex(canvas, { srgb = true, repeat = null } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * CBD 街区底盘：透明底上只画「浅灰纸色的地块 + 淡淡的道路」，不铺一整块灰板；
 * 边缘再径向淡出，像纸上的一层淡墨皴染，和城郊的田畴肌理接上。
 */
function getDistrictTexture() {
  if (_texCache.district) return _texCache.district;
  const W = 512;
  const H = 384;
  const c = canvas2d(W, H);
  const g = c.getContext('2d');
  const rng = makeRng(5800);

  const cols = 22;
  const rows = 17;
  const cw = W / cols;
  const ch = H / rows;

  // 道路：先铺一层很淡的纸色路网（比纸稍暖、稍亮）
  g.strokeStyle = 'rgba(240,234,220,0.32)';
  g.lineWidth = 1.1;
  for (let col = 1; col < cols; col++) {
    g.beginPath();
    g.moveTo(col * cw, 0);
    g.lineTo(col * cw, H);
    g.stroke();
  }
  for (let r = 1; r < rows; r++) {
    g.beginPath();
    g.moveTo(0, r * ch);
    g.lineTo(W, r * ch);
    g.stroke();
  }

  // 地块：浅冷灰，浓淡略不同；块与块之间留出纸色街道
  const tones = [
    [150, 164, 167, 0.34],
    [158, 171, 172, 0.28],
    [140, 156, 160, 0.32],
    [166, 178, 177, 0.3],
    [146, 162, 164, 0.34],
  ];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const pad = 1.6 + rng() * 1.2;
      const px = col * cw + pad;
      const py = r * ch + pad;
      const pw = cw - pad * 2;
      const ph = ch - pad * 2;
      const t = tones[Math.floor(rng() * tones.length)];
      g.fillStyle = `rgba(${t[0]},${t[1]},${t[2]},${t[3]})`;
      g.fillRect(px, py, pw, ph);
      // 地块里再点几笔更淡的小块，像一堆低层楼
      const n = 2 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        g.fillStyle = rng() > 0.5 ? 'rgba(196,205,205,0.26)' : 'rgba(126,143,147,0.24)';
        const bw = pw * (0.2 + rng() * 0.32);
        const bh = ph * (0.16 + rng() * 0.32);
        g.fillRect(px + rng() * (pw - bw), py + rng() * (ph - bh), bw, bh);
      }
    }
  }

  // 斜街（CBD 斜轴线）：把路网切开
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(242,236,222,0.55)';
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(-20, H * 0.78);
  g.lineTo(W * 0.55, H * 0.3);
  g.lineTo(W + 20, H * 0.16);
  g.stroke();

  // 几块绿地
  for (let i = 0; i < 12; i++) {
    g.fillStyle = 'rgba(176,189,177,0.35)';
    const bw = 10 + rng() * 22;
    const bh = 8 + rng() * 16;
    g.fillRect(rng() * (W - bw), rng() * (H - bh), bw, bh);
  }

  // 边缘淡出：让底盘化进纸里
  g.globalCompositeOperation = 'destination-in';
  const grd = g.createRadialGradient(W * 0.5, H * 0.5, W * 0.1, W * 0.5, H * 0.5, W * 0.54);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.58, 'rgba(255,255,255,0.82)');
  grd.addColorStop(0.82, 'rgba(255,255,255,0.28)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';

  _texCache.district = toTex(c);
  return _texCache.district;
}

/**
 * 水立方的 ETFE 气泡表皮：淡青底 + 一格一格的「气枕」——
 * 每格一个偏心的径向高光（气泡鼓起来），格子之间压一道深色细边。
 */
function getBubbleTexture() {
  if (_texCache.bubble) return _texCache.bubble;
  const S = 256;
  const c = canvas2d(S, S);
  const g = c.getContext('2d');
  const rng = makeRng(20081);
  const CELLS = 4;
  const cell = S / CELLS;

  g.fillStyle = '#3f6470';
  g.fillRect(0, 0, S, S);

  for (let cy = 0; cy < CELLS; cy++) {
    for (let cx = 0; cx < CELLS; cx++) {
      const x = cx * cell;
      const y = cy * cell;
      const inset = 2.5;
      const w = cell - inset * 2;
      const h = cell - inset * 2;
      // 气枕：左上亮、右下暗的径向渐变
      const grd = g.createRadialGradient(
        x + inset + w * 0.34,
        y + inset + h * 0.3,
        2,
        x + inset + w * 0.5,
        y + inset + h * 0.55,
        w * 0.82,
      );
      grd.addColorStop(0, 'rgba(205,234,239,1)');
      grd.addColorStop(0.36, 'rgba(150,199,210,0.98)');
      grd.addColorStop(0.78, 'rgba(80,134,150,0.98)');
      grd.addColorStop(1, 'rgba(44,84,98,1)');
      g.fillStyle = grd;
      g.fillRect(x + inset, y + inset, w, h);
      // 边：细白线 + 外侧深边（气枕之间的缝，深一点才看得出是一格一格）
      g.strokeStyle = 'rgba(206,236,240,0.7)';
      g.lineWidth = 1.4;
      g.strokeRect(x + inset, y + inset, w, h);
      g.strokeStyle = 'rgba(16,38,46,0.82)';
      g.lineWidth = 2.2;
      g.strokeRect(x + inset - 1.4, y + inset - 1.4, w + 2.8, h + 2.8);
      // 气泡的反光弧
      g.strokeStyle = 'rgba(240,251,252,0.6)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(x + cell * 0.5, y + cell * 0.5, cell * 0.31, Math.PI * 1.04, Math.PI * 1.76);
      g.stroke();
      // 一点点随机杂色，避免太规整
      if (rng() > 0.55) {
        g.fillStyle = 'rgba(198,231,237,0.3)';
        g.beginPath();
        g.ellipse(x + cell * (0.3 + rng() * 0.4), y + cell * (0.3 + rng() * 0.4), cell * 0.13, cell * 0.09, rng() * 3, 0, TAU);
        g.fill();
      }
    }
  }

  _texCache.bubble = toTex(c, { repeat: [2, 2] });
  return _texCache.bubble;
}

/**
 * 大剧院水池：深青灰的水 + 几笔横向水波线（与 water.js 的线描水纹同一路数）。
 */
function getPoolTexture() {
  if (_texCache.pool) return _texCache.pool;
  const S = 256;
  const c = canvas2d(S, S);
  const g = c.getContext('2d');
  const rng = makeRng(1050);

  g.fillStyle = '#4a5b63';
  g.fillRect(0, 0, S, S);

  // 水色深浅
  const grd = g.createRadialGradient(S * 0.5, S * 0.5, S * 0.08, S * 0.5, S * 0.5, S * 0.55);
  grd.addColorStop(0, 'rgba(58,72,79,0.55)');
  grd.addColorStop(0.7, 'rgba(64,78,84,0.2)');
  grd.addColorStop(1, 'rgba(40,52,58,0.55)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);

  // 横向断笔水纹
  for (let r = 0; r < 22; r++) {
    const y0 = (r / 22) * S + rng() * 4;
    const amp = 1.2 + rng() * 3;
    const alpha = 0.06 + rng() * 0.16;
    g.strokeStyle = `rgba(206,219,209,${alpha})`;
    g.lineWidth = 0.8 + rng() * 0.9;
    g.beginPath();
    let started = false;
    for (let x = 0; x <= S; x += 5) {
      if (rng() < 0.12) {
        started = false;
        continue;
      }
      const y = y0 + Math.sin((x / S) * 7 + r * 1.7) * amp + Math.sin((x / S) * 17 + r) * amp * 0.3;
      if (!started) {
        g.moveTo(x, y);
        started = true;
      } else {
        g.lineTo(x, y);
      }
    }
    g.stroke();
  }

  _texCache.pool = toTex(c);
  return _texCache.pool;
}

/**
 * 水中倒影：竖向的亮条 + 几笔暗墨，越远越淡（大剧院的银蛋倒影）。
 */
function getReflectionTexture() {
  if (_texCache.reflection) return _texCache.reflection;
  const W = 128;
  const H = 256;
  const c = canvas2d(W, H);
  const g = c.getContext('2d');
  const rng = makeRng(20011);

  for (let i = 0; i < 26; i++) {
    const x = 16 + rng() * (W - 32);
    const w = 2 + rng() * 7;
    const y0 = rng() * 30;
    const y1 = 90 + rng() * 150;
    const a = 0.12 + rng() * 0.24;
    const grd = g.createLinearGradient(0, y0, 0, y1);
    grd.addColorStop(0, `rgba(228,235,232,${a})`);
    grd.addColorStop(0.55, `rgba(214,224,220,${a * 0.55})`);
    grd.addColorStop(1, 'rgba(200,214,208,0)');
    g.fillStyle = grd;
    g.fillRect(x, y0, w, y1 - y0);
  }
  // 几笔暗墨，倒影才不是一片死白
  for (let i = 0; i < 8; i++) {
    const x = 16 + rng() * (W - 32);
    const w = 2 + rng() * 6;
    const y0 = 8 + rng() * 40;
    const y1 = 70 + rng() * 110;
    const grd = g.createLinearGradient(0, y0, 0, y1);
    grd.addColorStop(0, 'rgba(30,40,44,0.22)');
    grd.addColorStop(1, 'rgba(30,40,44,0)');
    g.fillStyle = grd;
    g.fillRect(x, y0, w, y1 - y0);
  }

  // 上下淡出
  g.globalCompositeOperation = 'destination-in';
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.8, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';

  _texCache.reflection = toTex(c);
  return _texCache.reflection;
}

/**
 * 奥体公园底盘：把鸟巢、水立方、奥林匹克塔圈在一片林带里。
 * 只画「公园的内容」——草坪、林带、场馆前广场、中轴景观道；
 * 树是真的树（lib/flora.js 的笔触树），沿中轴一行行排下去。
 */
function getParkTexture() {
  if (_texCache.park) return _texCache.park;
  const S = 512;
  const c = canvas2d(S, S);
  const g = c.getContext('2d');
  const rng = makeRng(9000);
  const px = (x) => ((x - OLYMPIC.x0) / OLYMPIC.w) * S;
  const py = (z) => ((z - OLYMPIC.z0) / OLYMPIC.d) * S;
  const rect = (x0, z0, x1, z1) => [px(x0), py(z0), px(x1) - px(x0), py(z1) - py(z0)];

  // 不铺整块底色：只在有内容的地方落笔（草坪 / 广场 / 道路），
  // 免得公园变成纸上一块方方正正的色板。
  const lawn = (cxW, czW, rxW, rzW, alpha) => {
    g.fillStyle = `rgba(194,204,184,${alpha})`;
    g.beginPath();
    g.ellipse(px(cxW), py(czW), (rxW / OLYMPIC.w) * S, (rzW / OLYMPIC.d) * S, 0, 0, TAU);
    g.fill();
  };
  // 中央大草坪、北侧森林公园、东西两片疏林草地
  lawn(2, -174, 28, 16, 0.5);
  lawn(-2, -193, 30, 8, 0.62);
  lawn(-20, -180, 11, 12, 0.4);
  lawn(24, -180, 10, 12, 0.38);
  lawn(4, -158, 14, 10, 0.34);
  // 草坪里再点一些更深的色斑，免得一片死色
  for (let i = 0; i < 26; i++) {
    g.fillStyle = rng() > 0.5 ? 'rgba(180,193,172,0.22)' : 'rgba(205,214,198,0.28)';
    const rw = 12 + rng() * 40;
    const rh = 8 + rng() * 26;
    g.beginPath();
    g.ellipse(rng() * S, rng() * S, rw, rh, rng() * 3, 0, TAU);
    g.fill();
  }

  // 中轴景观道（穿过公园，南北向）
  const ax = rect(-1.3, OLYMPIC.z0, 1.3, OLYMPIC.z1);
  g.fillStyle = 'rgba(229,224,210,0.8)';
  g.fillRect(...ax);
  g.fillStyle = 'rgba(180,190,180,0.4)';
  g.fillRect(px(-0.22), ax[1], px(0.22) - px(-0.22), ax[3]);

  // 鸟巢前广场：一圈椭圆铺装 + 外圈墨线
  const ncx = MODERN.nest.x;
  const ncz = MODERN.nest.z;
  g.beginPath();
  g.ellipse(px(ncx), py(ncz), px(ncx + 4.6) - px(ncx), py(ncz + 4.2) - py(ncz), 0, 0, TAU);
  g.fillStyle = 'rgba(222,217,203,0.7)';
  g.fill();
  g.strokeStyle = 'rgba(152,162,154,0.32)';
  g.lineWidth = 1.4;
  g.stroke();
  g.beginPath();
  g.ellipse(px(ncx), py(ncz), px(ncx + 3.6) - px(ncx), py(ncz + 3.3) - py(ncz), 0, 0, TAU);
  g.strokeStyle = 'rgba(160,170,162,0.35)';
  g.lineWidth = 1.2;
  g.stroke();

  // 水立方前广场：方格铺装，南侧接中轴
  const plaza = rect(MODERN.waterCube.x - 6.4, MODERN.waterCube.z - 3.4, MODERN.waterCube.x + 6.4, MODERN.waterCube.z + 6.6);
  g.fillStyle = 'rgba(230,225,211,0.62)';
  g.fillRect(...plaza);
  g.strokeStyle = 'rgba(172,182,174,0.22)';
  g.lineWidth = 0.9;
  const step = px(0.9) - px(0);
  for (let x = px(MODERN.waterCube.x - 6.4); x <= px(MODERN.waterCube.x + 6.4); x += step) {
    g.beginPath();
    g.moveTo(x, plaza[1]);
    g.lineTo(x, plaza[1] + plaza[3]);
    g.stroke();
  }
  for (let y = plaza[1]; y <= plaza[1] + plaza[3]; y += step) {
    g.beginPath();
    g.moveTo(plaza[0], y);
    g.lineTo(plaza[0] + plaza[2], y);
    g.stroke();
  }

  // 两馆之间的林荫连接道
  const link = rect(MODERN.waterCube.x - 9.6, -179.6, MODERN.waterCube.x - 1.2, -177.4);
  g.fillStyle = 'rgba(228,223,209,0.7)';
  g.fillRect(...link);

  // 奥林匹克塔前广场：圆形
  const t = MODERN.olympicTower;
  g.beginPath();
  g.ellipse(px(t.x), py(t.z), px(t.x + 3.6) - px(t.x), py(t.z + 3.6) - py(t.z), 0, 0, TAU);
  g.fillStyle = 'rgba(222,217,203,0.72)';
  g.fill();
  g.strokeStyle = 'rgba(152,162,154,0.36)';
  g.lineWidth = 1.5;
  g.stroke();
  g.beginPath();
  g.ellipse(px(t.x), py(t.z), px(t.x + 2.6) - px(t.x), py(t.z + 2.6) - py(t.z), 0, 0, TAU);
  g.strokeStyle = 'rgba(165,175,166,0.4)';
  g.lineWidth = 1.2;
  g.stroke();
  // 塔到场馆的步道
  const spine = rect(-2.4, t.z - 0.4, 2.4, OLYMPIC.z0 + 6);
  g.fillStyle = 'rgba(229,224,210,0.75)';
  g.fillRect(...spine);
  g.fillStyle = 'rgba(178,188,178,0.35)';
  g.fillRect(px(-0.22), spine[1], px(0.22) - px(-0.22), spine[3]);

  // 边缘淡出
  g.globalCompositeOperation = 'destination-in';
  const grd = g.createRadialGradient(S * 0.5, S * 0.5, S * 0.16, S * 0.5, S * 0.5, S * 0.54);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.52, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.8, 'rgba(255,255,255,0.28)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-over';

  _texCache.park = toTex(c);
  return _texCache.park;
}

/* ========================================================================== */
/*  八、奥体公园：底盘 / 中轴林荫大道 / 奥林匹克塔 / 树                          */
/* ========================================================================== */

function addParkPad(group) {
  const tex = getParkTexture();
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(OLYMPIC.w, OLYMPIC.d),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(OLYMPIC.cx, 0.004, OLYMPIC.cz);
  pad.renderOrder = 1;
  pad.name = 'olympic-park';
  group.add(pad);
}

/** 中轴北延：纸色林荫大道 + 中央绿化带 + 两道墨边，一直压到北城墙关厢。 */
function addOlympicAvenue(batch) {
  const a = OLYMPIC_AXIS;
  const len = a.z0 - a.z1;
  const cz = (a.z0 + a.z1) / 2;
  addBox(batch, a.halfW * 2, 0.012, len, 0, 0.006, cz, 0, C.paper, C.paper, { shadeFn: null });
  // 中央绿化带
  addBox(batch, 0.44, 0.02, len - 3, 0, 0.009, cz, 0, C.field, C.field, { shadeFn: null });
  // 两道墨边
  for (const s of [-1, 1]) {
    addBox(batch, 0.05, 0.016, len, s * (a.halfW - 0.04), 0.01, cz, 0, C.steel, C.steel, { shadeFn: null });
  }
  // 路口收口：靠近城墙那一端收一个浅色小广场
  addBox(batch, a.halfW * 2 + 1.6, 0.01, 2.4, 0, 0.005, a.z1 - 1.6, 0, C.paper, C.paper, { shadeFn: null });
}

/** 圆柱段（台座 / 塔身 / 五环盘都用它）。 */
function addCylPart(batch, o) {
  const { rTop, rBot, hh, seg = 14, x, y, z, c0, c1 = c0, opts = {} } = o;
  const geo = new THREE.CylinderGeometry(rTop, rBot, hh, seg, 1, false);
  batch.add(geo, M(x, y + hh / 2, z), c0, c1, opts);
}

/**
 * 奥林匹克塔（246m）：圆台塔座 + 收分塔身 + 塔顶五层「环」观景台 + 塔尖。
 * 五层环是它的身份标识——从远处看就是塔顶一摞摊开的圆盘。
 */
function buildOlympicTower(batch, o) {
  const { x, z, h: H } = o;
  const yY = (t) => t * H;
  const opts = { y0: 0, y1: H };

  // 塔座：三级收分的圆台 + 一圈台阶
  addCylPart(batch, { rTop: 0.86, rBot: 1.04, hh: 0.055, seg: 22, x, y: 0, z, c0: C.pale, c1: C.paper, opts });
  addCylPart(batch, { rTop: 0.7, rBot: 0.82, hh: 0.06, seg: 22, x, y: 0.055, z, c0: C.pale, c1: C.paper, opts });
  addCylPart(batch, { rTop: 0.52, rBot: 0.66, hh: 0.07, seg: 18, x, y: 0.115, z, c0: C.soft, c1: C.pale, opts });

  // 塔身：细长收分（12 边），一直收到塔顶
  addCylPart(batch, {
    rTop: 0.11, rBot: 0.4, hh: yY(0.95) - 0.18, seg: 12, x, y: 0.18, z,
    c0: C.deep, c1: C.soft, opts,
  });
  // 塔身竖棱（6 条，让高塔在光里有竖向层次）
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const r0 = 0.385;
    const r1 = 0.115;
    for (let k = 0; k < 4; k++) {
      const t0 = k / 4;
      const t1 = (k + 1) / 4;
      const y0 = 0.18 + (yY(0.95) - 0.18) * t0;
      const y1 = 0.18 + (yY(0.95) - 0.18) * t1;
      const ra = r0 + (r1 - r0) * t0;
      const rb = r0 + (r1 - r0) * t1;
      const len = Math.hypot(rb - ra, y1 - y0);
      const tilt = Math.atan2(ra - rb, y1 - y0);
      const geo = new THREE.BoxGeometry(0.024, len, 0.024);
      batch.add(
        geo,
        M(x + Math.cos(a) * (ra + rb) * 0.5, (y0 + y1) / 2, z + Math.sin(a) * (ra + rb) * 0.5, { rz: tilt, ry: -a }),
        C.soft,
        C.pale,
        { y0: 0, y1: H },
      );
    }
  }

  // 塔顶五层「环」：五枚圆盘托着栏杆，一层比一层小，像一朵摊开的花
  const rings = [
    { t: 0.7, r: 0.47 },
    { t: 0.762, r: 0.43 },
    { t: 0.82, r: 0.39 },
    { t: 0.874, r: 0.345 },
    { t: 0.924, r: 0.3 },
  ];
  for (let i = 0; i < rings.length; i++) {
    const d = rings[i];
    const yy = yY(d.t);
    // 盘面
    addCylPart(batch, { rTop: d.r, rBot: d.r * 0.94, hh: 0.016, seg: 24, x, y: yy, z, c0: C.pale, c1: C.silver, opts });
    // 盘底的暗墨
    addCylPart(batch, { rTop: d.r * 0.99, rBot: d.r * 0.99, hh: 0.008, seg: 24, x, y: yy - 0.008, z, c0: C.deep, c1: C.deep, opts });
    // 外沿的环（托住盘面，剪影更清楚）
    const torus = new THREE.TorusGeometry(d.r, 0.014, 6, 26);
    torus.rotateX(Math.PI / 2);
    batch.add(torus, M(x, yy + 0.006, z), C.steel, C.silver, { y0: 0, y1: H });
    // 很矮的一圈玻璃栏杆
    const rail = new THREE.CylinderGeometry(d.r * 0.985, d.r * 0.985, 0.028, 24, 1, true);
    batch.add(rail, M(x, yy + 0.016 + 0.014, z), C.soft, C.pale, { y0: 0, y1: H });
  }

  // 塔尖：一根细针 + 一点亮
  addCylPart(batch, { rTop: 0.01, rBot: 0.05, hh: yY(0.985) - yY(0.95), seg: 8, x, y: yY(0.95), z, c0: C.paper, c1: C.paper, opts });
  addCylPart(batch, { rTop: 0.018, rBot: 0.018, hh: yY(1.0) - yY(0.985), seg: 8, x, y: yY(0.985), z, c0: C.silver, c1: C.silver, opts });
}

/**
 * 奥体公园的树：中轴两侧行道树 + 外侧松林 + 森林公园带 + 场馆周边林。
 * 全部交给 lib/flora.js 的笔触树，按 kind/variant 自动 InstancedMesh 合批。
 */
function olympicTreeSpecs(quality) {
  const out = [];
  const rng = makeRng(20260711);
  const nest = MODERN.nest;
  const cube = MODERN.waterCube;
  const tower = MODERN.olympicTower;
  const lowK = quality === 'low' ? 0.55 : 1;

  const blocked = (x, z) => {
    const ex = (x - nest.x) / 5.2;
    const ez = (z - nest.z) / 4.6;
    if (ex * ex + ez * ez < 1) return true;
    if (Math.abs(x - cube.x) < 3.4 && Math.abs(z - cube.z) < 3.2) return true;
    if (Math.hypot(x - tower.x, z - tower.z) < 3.8) return true;
    if (Math.abs(x) < 1.55) return true; // 中轴路面 / 中央绿化带
    return false;
  };
  const add = (kind, x, z, h) => {
    if (blocked(x, z)) return;
    out.push({ kind, x, z, y: 0, h, rot: rng() * TAU });
  };

  // 1) 中轴北延：两侧一排行道树，一直排到北城墙关厢
  for (let z = -192; z <= -70; z += 2.4) {
    if (rng() > 0.94 * lowK) continue;
    add('locust', -2.6 + (rng() - 0.5) * 0.5, z + (rng() - 0.5) * 0.5, 0.6 + rng() * 0.24);
    add('locust', 2.6 + (rng() - 0.5) * 0.5, z + (rng() - 0.5) * 0.5, 0.6 + rng() * 0.24);
  }
  // 2) 外侧一列松（间距大一点，成林荫的层次）
  for (let z = -190; z <= -72; z += 5.2) {
    add('pine', -4.9 + (rng() - 0.5) * 0.9, z + (rng() - 0.5) * 0.9, 0.48 + rng() * 0.2);
    add('pine', 4.9 + (rng() - 0.5) * 0.9, z + (rng() - 0.5) * 0.9, 0.48 + rng() * 0.2);
  }
  // 3) 中央绿化带的列树（只在公园外那段大道上）
  for (let z = OLYMPIC_AXIS.z1 + 5; z <= OLYMPIC.z1 - 2; z += 4.6) {
    if (Math.abs(z - tower.z) < 5) continue;
    out.push({ kind: 'locust', x: 0, z, y: 0, h: 0.46 + rng() * 0.14, rot: rng() * TAU });
  }
  // 4) 北侧森林公园带
  for (let i = 0; i < Math.round(40 * lowK); i++) {
    add(rng() > 0.38 ? 'pine' : 'locust', -24 + rng() * 52, OLYMPIC.z0 + 1 + rng() * 7, 0.5 + rng() * 0.34);
  }
  // 5) 场馆周边的成片林
  for (let i = 0; i < Math.round(26 * lowK); i++) add('locust', -25 + rng() * 9, -191 + rng() * 19, 0.55 + rng() * 0.3);
  for (let i = 0; i < Math.round(24 * lowK); i++) add('locust', 18 + rng() * 11, -191 + rng() * 19, 0.55 + rng() * 0.3);
  // 鸟巢与中轴之间的小林
  for (let i = 0; i < Math.round(14 * lowK); i++) add(rng() > 0.5 ? 'pine' : 'locust', -17 + rng() * 6, -190 + rng() * 20, 0.5 + rng() * 0.26);
  // 6) 场馆与广场之间的点树（带几棵花树，别太多）
  for (let i = 0; i < Math.round(12 * lowK); i++) add(i % 5 === 0 ? 'blossom' : 'locust', -7 + rng() * 7, -174 + rng() * 4.5, 0.45 + rng() * 0.24);
  for (let i = 0; i < Math.round(10 * lowK); i++) add('locust', 6 + rng() * 15, -170 + rng() * 4.5, 0.5 + rng() * 0.22);
  // 7) 奥林匹克塔广场一圈树
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.2;
    add('pine', tower.x + Math.cos(a) * 4.6, tower.z + Math.sin(a) * 4.6, 0.5 + rng() * 0.18);
  }
  return out;
}

/* ========================================================================== */
/*  四、国贸 CBD                                                               */
/* ========================================================================== */

/** 街区底盘（软边淡墨方块 + 道路纹理）。 */
function addDistrictPad(group) {
  const tex = getDistrictTexture();
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(66, 50),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(MODERN.cbd.x, 0.004, MODERN.cbd.z);
  pad.renderOrder = 1;
  pad.name = 'cbd-district';
  group.add(pad);
}

/** 中国尊：鼓腹收腰、顶部外扩的曲形塔（528m）。 */
function addCiticTower(batch, x, z, w, H) {
  const half = w / 2;
  // 「尊」的剖面：底略收 → 鼓腹 → 收腰 → 顶部外扩；用关键点插值成 20 段，
  // 低多边形也能读出那条曲线。
  const keys = [
    [0.0, 0.76],
    [0.08, 0.865],
    [0.33, 1.0],
    [0.55, 0.885],
    [0.72, 0.775],
    [0.82, 0.7],
    [0.9, 0.78],
    [0.965, 0.94],
    [1.0, 0.88],
  ];
  const profile = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    let k = 0;
    while (k < keys.length - 2 && t > keys[k + 1][0]) k++;
    const [t0, s0] = keys[k];
    const [t1, s1] = keys[k + 1];
    const u = Math.min(1, Math.max(0, (t - t0) / Math.max(1e-6, t1 - t0)));
    const e = u * u * (3 - 2 * u);
    profile.push([t, s0 + (s1 - s0) * e]);
  }
  addTower(batch, {
    x, z, H,
    halfW: half,
    halfD: half,
    shape: SHAPES.oct,
    profile,
    bottom: C.dark,
    top: C.pale,
  });

  // 腰部收一笔重墨：曲形塔的「束腰」全靠这一道读出来
  const waistT = 0.82;
  const waistS = profileAt(profile, waistT) * 1.07;
  addBand(batch, {
    x, z, shape: SHAPES.oct,
    y0: (waistT - 0.022) * H, y1: (waistT + 0.022) * H,
    halfW: half * waistS, halfD: half * waistS, color: C.deepest,
  });

  // 鼓腹最宽处压一道亮边：曲线两头有交代，收腰才立得住
  const bellyT = 0.33;
  const bellyS = profileAt(profile, bellyT) * 1.016;
  addBand(batch, {
    x, z, shape: SHAPES.oct,
    y0: (bellyT - 0.007) * H, y1: (bellyT + 0.007) * H,
    halfW: half * bellyS, halfD: half * bellyS, color: C.soft,
  });

  // 顶部外扩的冠：一圈亮边 + 淡纸色顶
  const crownT = 0.945;
  const crownS = profileAt(profile, crownT) * 1.05;
  addBand(batch, {
    x, z, shape: SHAPES.oct,
    y0: (crownT - 0.01) * H, y1: (crownT + 0.014) * H,
    halfW: half * crownS, halfD: half * crownS, color: C.paper,
  });
  addBox(batch, half * 1.52, 0.035, half * 1.52, x, H - 0.02, z, 0, C.paper, C.silver);

  // 四条竖棱：低多边形版「凹槽立面」，让塔身在光里有竖向层次
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4;
    const rx = Math.cos(a);
    const rz = Math.sin(a);
    for (let s = 0; s < 3; s++) {
      const t0 = 0.18 + s * 0.27;
      const t1 = t0 + 0.2;
      const s0 = profileAt(profile, t0) * half;
      const s1 = profileAt(profile, t1) * half;
      const y0 = t0 * H;
      const y1 = t1 * H;
      const len = Math.hypot(s1 - s0, y1 - y0);
      const tilt = Math.atan2(s0 - s1, y1 - y0);
      const geo = new THREE.BoxGeometry(0.035, len, 0.05);
      batch.add(
        geo,
        M(x + rx * (s0 + s1) * 0.5, (y0 + y1) / 2, z + rz * (s0 + s1) * 0.5, { ry: -a, rz: tilt }),
        C.soft,
        C.paper,
        { y0, y1 },
      );
    }
  }
}

/** 国贸三期：方塔 + 顶部收分（330m）。 */
function addGuomao3Tower(batch, x, z, w, d, H) {
  const hw = w / 2;
  const hd = d / 2;
  // 裙房
  addBox(batch, hw * 3.0, H * 0.045, hd * 3.0, x, 0, z, 0, C.dark, C.mid, { y0: 0, y1: H });
  // 塔身：几乎直上，顶上一点点收
  addTower(batch, {
    x, z, H,
    halfW: hw,
    halfD: hd,
    shape: SHAPES.chamfer,
    profile: [[0, 1], [0.06, 1.015], [0.8, 0.985], [0.86, 0.955]],
    bottom: C.deep,
    top: C.soft,
  });
  // 冠部三级台阶
  const steps = [
    { t0: 0.86, t1: 0.905, s: 0.95 },
    { t0: 0.905, t1: 0.945, s: 0.87 },
    { t0: 0.945, t1: 0.975, s: 0.77 },
  ];
  for (const st of steps) {
    addBox(
      batch,
      hw * 2 * st.s,
      (st.t1 - st.t0) * H,
      hd * 2 * st.s,
      x, st.t0 * H, z, 0,
      C.mid, C.pale, { y0: 0, y1: H },
    );
  }
  // 塔尖
  addBox(batch, 0.06, H * 0.03, 0.06, x, H * 0.975, z, 0, C.paper, C.paper);
  // 立面横带（三层，远看是几道淡淡的横墨）
  for (const t of [0.28, 0.52, 0.74]) {
    addBox(batch, hw * 2.02, H * 0.007, hd * 2.02, x, t * H, z, 0, C.dark, C.dark, { y0: 0, y1: H });
  }
}

/** 央视大楼（大裤衩）：两条斜腿 + 顶部横楼 + 悬挑。 */
function addCCTVTower(batch, x, z, W, D, H) {
  const hw = W / 2;
  const hd = D / 2;
  const legW = hw * 0.26;
  const legD = hd * 0.32;
  const bridgeBottom = 0.69 * H;
  const bridgeTop = 0.865 * H;
  const bridgeH = bridgeTop - bridgeBottom;

  // 两条腿都往东斜：像一笔撇、一笔捺，顶部再用横楼连成一个「口」
  const legs = [
    { bx: -hw * 0.66, bz: -hd * 0.06, tx: -hw * 0.54, tz: -hd * 0.05, top: 0.86 },
    { bx: hw * 0.5, bz: hd * 0.06, tx: hw * 0.38, tz: hd * 0.05, top: 0.8 },
  ];
  for (const leg of legs) {
    const topY = leg.top * H;
    batch.add(
      prismGeometry(SHAPES.square, [
        { y: 0, sx: legW * 1.12, sz: legD * 1.1, ox: leg.bx, oz: leg.bz },
        { y: topY, sx: legW, sz: legD, ox: leg.tx, oz: leg.tz },
      ]),
      M(x, 0, z),
      C.deep,
      C.mid,
      { y0: 0, y1: H },
    );
    // 楼层横带：远看是几道淡横墨，腿才立得住
    for (let i = 0; i < 7; i++) {
      const t = 0.06 + i * 0.125;
      const bx = leg.bx + (leg.tx - leg.bx) * t;
      const bz = leg.bz + (leg.tz - leg.bz) * t;
      addBox(batch, legW * 2.04, H * 0.006, legD * 2.04, x + bx, t * topY, z + bz, 0, C.steel, C.steel, { y0: 0, y1: H });
    }
    // 斜网格：两笔交叉的深墨线（央视标志性的 diagrid）
    for (const dir of [1, -1]) {
      for (const t of [0.32, 0.6]) {
        const bar = new THREE.BoxGeometry(0.022, topY * 0.2, 0.016);
        const bx = leg.bx + (leg.tx - leg.bx) * t;
        batch.add(bar, M(x + bx, topY * t, z + legD * 1.04, { rz: dir * 0.42 }), C.dark, C.dark, { y0: 0, y1: H });
      }
    }
  }

  // 顶部横楼：往东挑出，是整个「大裤衩」的腰
  const barLen = hw * 2.52;
  const barCx = x + hw * 0.2;
  const bar = new THREE.BoxGeometry(barLen, bridgeH, hd * 0.82);
  batch.add(bar, M(barCx, bridgeBottom + bridgeH / 2, z), C.dark, C.soft, { y0: 0, y1: H });
  // 横楼底面的深墨（悬挑的阴影，剪影更狠）
  addBox(batch, barLen * 0.95, bridgeH * 0.16, hd * 0.76, barCx, bridgeBottom - bridgeH * 0.015, z, 0, C.deepest, C.deepest, { y0: 0, y1: H });
  // 横楼的几条横向玻璃带（细线，别做成梳子）
  for (let i = 0; i < 3; i++) {
    addBox(batch, barLen * 1.004, bridgeH * 0.055, hd * 0.824, barCx, bridgeBottom + bridgeH * (0.22 + i * 0.27), z, 0, C.mid, C.mid, { y0: 0, y1: H });
  }
  // 横楼南立面的斜网格（央视的 diagrid）——从南边看就是「裤衩」上的一排人字纹
  for (let i = 0; i < 6; i++) {
    const bx = barCx - barLen / 2 + ((i + 0.5) / 6) * barLen;
    for (const dir of [1, -1]) {
      const bar2 = new THREE.BoxGeometry(0.024, bridgeH * 1.06, 0.016);
      batch.add(bar2, M(bx, bridgeBottom + bridgeH / 2, z + hd * 0.412, { rz: dir * 0.5 }), C.deepest, C.deepest, { y0: 0, y1: H });
    }
  }
}

/** 银泰中心：一座 249m 主塔 + 两座配塔，顶部是标志性的「灯笼」方冠。 */
function addYintaiTowers(batch, x, z, w, H) {
  const hw = w / 2;
  const specs = [
    { ox: 0, oz: 0, s: 1.0, h: H },
    { ox: 0, oz: -1.9, s: 0.84, h: H * 0.74 },
    { ox: 0, oz: 1.9, s: 0.84, h: H * 0.74 },
  ];
  // 裙房
  addBox(batch, hw * 3.1, H * 0.035, 4.4, x, 0, z, 0, C.dark, C.mid, { y0: 0, y1: H });
  for (const sp of specs) {
    const tx = x + sp.ox;
    const tz = z + sp.oz;
    const tw = hw * sp.s;
    addTower(batch, {
      x: tx, z: tz, H: sp.h,
      halfW: tw, halfD: tw,
      shape: SHAPES.chamfer,
      profile: [[0, 1], [0.62, 0.99], [0.86, 0.935], [0.9, 0.9], [0.95, 0.955], [1, 0.93]],
      bottom: C.dark,
      top: C.soft,
    });
    // 灯笼冠：一圈更宽更亮的方框
    addBox(batch, tw * 2.1, sp.h * 0.055, tw * 2.1, tx, sp.h * 0.9, tz, 0, C.pale, C.paper, { y0: 0, y1: H });
    addBox(batch, tw * 1.55, sp.h * 0.035, tw * 1.55, tx, sp.h * 0.955, tz, 0, C.paper, C.silver, { y0: 0, y1: H });
    // 竖向亮棱
    for (const sx of [-1, 1]) {
      addBox(batch, 0.03, sp.h * 0.8, tw * 1.01, tx + sx * tw * 0.99, sp.h * 0.05, tz, 0, C.soft, C.paper, { y0: 0, y1: H });
    }
  }
}

/** 京广中心：瘦高的方塔 + 尖顶。 */
function addJingguang(batch, x, z, w, H) {
  const hw = w / 2;
  addBox(batch, hw * 2.6, H * 0.03, hw * 2.6, x, 0, z, 0, C.dark, C.mid, { y0: 0, y1: H });
  addTower(batch, {
    x, z, H,
    halfW: hw, halfD: hw,
    shape: SHAPES.chamfer,
    profile: [[0, 1], [0.88, 0.97], [0.93, 0.87], [1, 0.82]],
    bottom: C.deep,
    top: C.mid,
  });
  addBox(batch, hw * 0.34, H * 0.075, hw * 0.34, x, H * 0.93, z, 0, C.paper, C.silver);
  for (const t of [0.34, 0.62]) {
    addBox(batch, hw * 2.04, H * 0.006, hw * 2.04, x, t * H, z, 0, C.dark, C.dark, { y0: 0, y1: H });
  }
}

/** 建外 SOHO：一片低层的白塔群（4 列 × 2 排，微微错动）。 */
function addSohoBlock(batch, x, z, W, D, H) {
  const rng = makeRng(200512);
  const cols = 4;
  const rows = 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = (c - (cols - 1) / 2) * W * 0.225;
      const oz = (r - (rows - 1) / 2) * D * 0.52;
      const bh = H * (0.58 + rng() * 0.34);
      const bw = W * 0.19;
      const bd = D * 0.22;
      const ry = (rng() - 0.5) * 0.14 + (r % 2 ? 0.12 : -0.08);
      // 每两栋共用一个小裙房
      if (c % 2 === 0) {
        addBox(batch, W * 0.46, H * 0.18, D * 0.3, x + ox + W * 0.1, 0, z + oz, ry, C.soft, C.pale, { y0: 0, y1: H });
      }
      addBox(batch, bw, bh, bd, x + ox, 0, z + oz, ry, C.pale, C.paper, { y0: 0, y1: H });
      // 楼顶一条细墨线（白块才不会飘）
      addBox(batch, bw * 1.02, 0.022, bd * 1.02, x + ox, bh, z + oz, ry, C.soft, C.soft);
      // 立面竖线：两道浅浅的分格
      addBox(batch, bw * 0.02, bh * 0.9, bd * 1.01, x + ox - bw * 0.25, 0, z + oz, ry, C.steel, C.steel);
      addBox(batch, bw * 0.02, bh * 0.9, bd * 1.01, x + ox + bw * 0.25, 0, z + oz, ry, C.steel, C.steel);
    }
  }
  // 两片低层沿街板楼
  addBox(batch, W * 0.82, H * 0.26, D * 0.14, x, 0, z + D * 0.46, 0, C.soft, C.pale, { y0: 0, y1: H });
  addBox(batch, W * 0.18, H * 0.34, D * 0.7, x - W * 0.42, 0, z, 0, C.soft, C.pale, { y0: 0, y1: H });
}

/**
 * 街区里的主干道：建国路（东西）+ 东三环（南北），纸色路身 + 两道细墨边。
 * 一路往西伸出去，接上城东的驿路，古今两个城才像长在同一张纸上。
 */
function addDistrictRoads(batch, cx, cz) {
  const y = 0.008;
  const road = (x0, z0, x1, z1, w) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(-(z1 - z0), x1 - x0);
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    addBox(batch, len, 0.012, w, mx, y, mz, ang, C.paper, C.paper);
    for (const s of [-1, 1]) {
      addBox(
        batch, len, 0.016, 0.03,
        mx + Math.sin(ang) * s * (w / 2 - 0.02),
        y,
        mz + Math.cos(ang) * s * (w / 2 - 0.02),
        ang, C.steel, C.steel,
      );
    }
  };
  // 建国路：东西横穿 CBD
  road(cx - 33, cz + 14.5, cx + 33, cz + 14.5, 1.5);
  // 往西的延伸段（接城东驿路）
  road(cx - 44, cz + 14.5, cx - 33, cz + 14.5, 1.1);
  // 东三环：南北
  road(cx - 20, cz - 21, cx - 20, cz + 25, 1.3);
  // 一条斜街（CBD 的斜轴）
  road(cx - 33, cz - 14, cx + 12, cz - 2, 0.9);
}

/* -------------------------------------------------------------------------- */
/*  配角塔楼（InstancedMesh，带竖向窗线与腰线的冷蓝灰玻璃）                      */
/* -------------------------------------------------------------------------- */

/** 给单位几何烘一层「底暗顶亮」的冷灰蓝；local y 从 0（地）到 1（楼顶）。 */
function paintUnit(geo, c0, c1) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const key of Object.keys(g.attributes)) {
    if (key !== 'position' && key !== 'normal') g.deleteAttribute(key);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const a = new THREE.Color(c0);
  const b = new THREE.Color(c1);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.pow(clamp01(pos.getY(i)), 0.8);
    colors[i * 3] = a.r + (b.r - a.r) * t;
    colors[i * 3 + 1] = a.g + (b.g - a.g) * t;
    colors[i * 3 + 2] = a.b + (b.b - a.b) * t;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** 单位塔楼：核心筒 + 顶部挑檐 + 四条立面的竖向窗线 + 两道腰线。 */
function unitTowerGeometry(variant = 0) {
  const dark = variant === 0 ? 0x22313b : 0x28343c;
  const light = variant === 0 ? 0x7e96a4 : 0x6c8492;
  const parts = [];
  if (variant === 0) {
    parts.push(paintUnit(
      prismGeometry(SHAPES.chamfer, [
        { y: 0, sx: 0.5, sz: 0.5 },
        { y: 0.86, sx: 0.495, sz: 0.495 },
        { y: 0.885, sx: 0.53, sz: 0.53 },
        { y: 0.955, sx: 0.455, sz: 0.455 },
        { y: 1, sx: 0.43, sz: 0.43 },
      ]),
      dark, light,
    ));
  } else {
    parts.push(paintUnit(
      mergeGeometries([
        prismGeometry(SHAPES.chamfer, [
          { y: 0, sx: 0.5, sz: 0.5 },
          { y: 0.74, sx: 0.49, sz: 0.49 },
        ]),
        prismGeometry(SHAPES.chamfer, [
          { y: 0.74, sx: 0.4, sz: 0.4 },
          { y: 0.93, sx: 0.375, sz: 0.375 },
        ]),
        prismGeometry(SHAPES.chamfer, [
          { y: 0.93, sx: 0.29, sz: 0.29 },
          { y: 1, sx: 0.27, sz: 0.27 },
        ]),
      ], false),
      dark, light,
    ));
  }
  // 竖向窗线：四个立面各 3 条
  const ribW = 0.035;
  const ribTop = variant === 0 ? 0.84 : 0.7;
  for (const face of [0, 1, 2, 3]) {
    for (let i = -1; i <= 1; i++) {
      const geo = face % 2 === 0
        ? new THREE.BoxGeometry(ribW, ribTop - 0.04, 0.026)
        : new THREE.BoxGeometry(0.026, ribTop - 0.04, ribW);
      const o = i * 0.22;
      const pos = face % 2 === 0
        ? M(o, 0.02 + (ribTop - 0.04) / 2, (face === 0 ? 1 : -1) * 0.503)
        : M((face === 1 ? 1 : -1) * 0.503, 0.02 + (ribTop - 0.04) / 2, o);
      geo.applyMatrix4(pos);
      parts.push(paintUnit(geo, 0x3a4d58, 0xa2b6c0));
    }
  }
  // 腰线
  for (const y of variant === 0 ? [0.42, 0.72] : [0.36, 0.68]) {
    parts.push(paintUnit(
      prismGeometry(SHAPES.chamfer, [
        { y: y - 0.006, sx: 0.512, sz: 0.512 },
        { y: y + 0.006, sx: 0.512, sz: 0.512 },
      ]),
      0x1c262d, 0x34434c,
    ));
  }
  return mergeGeometries(parts, false);
}

/** 低层街块：一个盒子 + 楼顶女儿墙，同样带一点竖向渐变。 */
function unitLowGeometry() {
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  const wall = new THREE.BoxGeometry(1.02, 0.06, 1.02);
  wall.translate(0, 1.02, 0);
  const parts = [paintUnit(box, 0x2a363d, 0x7c909a), paintUnit(wall, 0x39474f, 0x8a9ba4)];
  return mergeGeometries(parts, false);
}

/**
 * 配角塔楼：用 InstancedMesh 合批，让 CBD 变成「一片城」而不是几根筷子。
 * 两种几何交替：平顶带挑檐的板楼 / 三级收分的塔楼；再做一片低层街块。
 */
function buildCbdFill(group, cx, cz) {
  const rng = makeRng(20261105);

  const towerGeoA = unitTowerGeometry(0);
  const towerGeoB = unitTowerGeometry(1);
  const lowGeo = unitLowGeometry();

  const fillMat = () => new THREE.MeshLambertMaterial({ flatShading: true, side: THREE.DoubleSide, vertexColors: true });
  const towerMatA = fillMat();
  const towerMatB = fillMat();
  const lowMat = fillMat();

  // 主塔占位（避免配角塔楼穿模）
  const occupied = [
    { x: 0, z: 0, r: 2.6 },
    { x: -11.2, z: -3.6, r: 2.4 },
    { x: 14.4, z: 5.2, r: 3.6 },
    { x: -17.6, z: 4.4, r: 2.6 },
    { x: -15.2, z: -14, r: 2.0 },
    { x: 6, z: -9.2, r: 2.8 },
  ];
  const blocked = (x, z, pad = 1.4) =>
    occupied.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + pad);

  // 配角塔楼：近圈 6.4~16 / 远圈 18~31
  const specsA = [];
  const specsB = [];
  let guard = 0;
  const total = 16;
  while (specsA.length + specsB.length < total && guard++ < 4000) {
    const n = specsA.length + specsB.length;
    const far = n >= 9;
    const a = rng() * TAU;
    const r = far ? 18 + rng() * 13 : 6.4 + Math.sqrt(rng()) * 10;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.82;
    if (blocked(x, z, far ? 1.0 : 1.8)) continue;
    if (Math.hypot(x, z) < 5.4) continue;
    const w = (far ? 1.9 : 1.2) + rng() * (far ? 1.4 : 0.9);
    const d = w * (0.55 + rng() * 0.6);
    const hh = far ? 1.5 + rng() * 2.8 : 4.0 + rng() * 4.8;
    const spec = { x, z, w, d, h: hh, ry: rng() * 0.8, tone: 0.3 + rng() * 0.38, blue: rng() > 0.45 };
    if (rng() > 0.42) specsA.push(spec);
    else specsB.push(spec);
  }

  // 西侧「门户塔楼」：CBD 往城里那一侧的几栋中高层，
  // 让 HOME 视角的右缘能看到一段完整的天际线，而不是只有几根筷子尖。
  const westGate = [
    { x: -23.5, z: 7.5, w: 1.9, d: 2.4, h: 5.4, ry: 0.2, tone: 0.36, blue: true },
    { x: -26.5, z: 17.5, w: 1.7, d: 2.0, h: 6.2, ry: -0.15, tone: 0.3, blue: true },
    { x: -20.5, z: 23.0, w: 2.1, d: 2.2, h: 4.2, ry: 0.35, tone: 0.44, blue: false },
    { x: -29.5, z: 1.5, w: 1.6, d: 2.6, h: 4.8, ry: 0.5, tone: 0.4, blue: false },
    { x: -25.0, z: -4.0, w: 2.0, d: 1.8, h: 5.8, ry: 0.1, tone: 0.34, blue: true },
  ];

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sv = new THREE.Vector3();
  const pv = new THREE.Vector3();
  const col = new THREE.Color();

  const pushInstanced = (geo, mat, specs, name) => {
    const mesh = new THREE.InstancedMesh(geo, mat, specs.length);
    mesh.name = name;
    mesh.frustumCulled = false;
    specs.forEach((sp, i) => {
      q.setFromAxisAngle(Y_AXIS, sp.ry);
      pv.set(cx + sp.x, 0, cz + sp.z);
      sv.set(sp.w, sp.h, sp.d);
      m4.compose(pv, q, sv);
      mesh.setMatrixAt(i, m4);
      // 实例色只做「深浅两档」的整体偏移，冷蓝 / 暖灰各一半
      const smog = smoothstep(10, 34, Math.hypot(sp.x, sp.z));
      const base = 0.82 + sp.tone * 0.34 + smog * 0.22;
      if (sp.blue) col.setRGB(base * 0.86, base * 0.98, base * 1.1);
      else col.setRGB(base * 1.06, base * 1.02, base * 0.96);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    return mesh;
  };
  pushInstanced(towerGeoA, towerMatA, specsA.concat(westGate.slice(0, 3)), 'cbd-fill-towers-a');
  pushInstanced(towerGeoB, towerMatB, specsB.concat(westGate.slice(3)), 'cbd-fill-towers-b');

  // 低层街块：铺满底盘，压出「城」的厚度
  const lows = [];
  guard = 0;
  while (lows.length < 52 && guard++ < 5000) {
    const x = (rng() - 0.5) * 58;
    const z = (rng() - 0.5) * 44;
    if (blocked(x, z, 0.9)) continue;
    if (Math.hypot(x, z) < 4.4) continue;
    const near = Math.hypot(x / 29, z / 22);
    if (near > 0.94) continue;
    const w = 0.9 + rng() * 2.0;
    const d = 0.7 + rng() * 1.7;
    const hh = 0.26 + rng() * 0.85;
    lows.push({ x, z, w, d, h: hh, ry: (rng() - 0.5) * 0.5, tone: 0.45 + rng() * 0.4 });
  }
  const lowMesh = new THREE.InstancedMesh(lowGeo, lowMat, lows.length);
  lowMesh.name = 'cbd-fill-low';
  lowMesh.frustumCulled = false;
  lows.forEach((sp, i) => {
    q.setFromAxisAngle(Y_AXIS, sp.ry);
    pv.set(cx + sp.x, 0, cz + sp.z);
    sv.set(sp.w, sp.h, sp.d);
    m4.compose(pv, q, sv);
    lowMesh.setMatrixAt(i, m4);
    const smog = smoothstep(14, 36, Math.hypot(sp.x, sp.z));
    const base = 0.8 + sp.tone * 0.3 + smog * 0.2;
    col.setRGB(base * 0.94, base * 0.99, base * 1.02);
    lowMesh.setColorAt(i, col);
  });
  lowMesh.instanceMatrix.needsUpdate = true;
  if (lowMesh.instanceColor) lowMesh.instanceColor.needsUpdate = true;
  group.add(lowMesh);
}

function buildCBD(batch, group) {
  const CBD = MODERN.cbd;
  const cx = CBD.x;
  const cz = CBD.z;
  const byId = Object.fromEntries(CBD.towers.map((t) => [t.id, t]));
  const at = (id) => [cx + byId[id].dx, cz + byId[id].dz];

  addDistrictPad(group);

  const [citicX, citicZ] = at('citic');
  addCiticTower(batch, citicX, citicZ, byId.citic.w, byId.citic.h);

  const [g3X, g3Z] = at('guomao3');
  addGuomao3Tower(batch, g3X, g3Z, byId.guomao3.w, byId.guomao3.d, byId.guomao3.h);

  const [cctvX, cctvZ] = at('cctv');
  addCCTVTower(batch, cctvX, cctvZ, byId.cctv.w, byId.cctv.d, byId.cctv.h);

  const [ytX, ytZ] = at('yintai');
  addYintaiTowers(batch, ytX, ytZ, byId.yintai.w, byId.yintai.h);

  const [jgX, jgZ] = at('jingguang');
  addJingguang(batch, jgX, jgZ, byId.jingguang.w, byId.jingguang.h);

  const [shX, shZ] = at('soho');
  addSohoBlock(batch, shX, shZ, byId.soho.w, byId.soho.d, byId.soho.h);

  addDistrictRoads(batch, cx, cz);
  buildCbdFill(group, cx, cz);
}

/* ========================================================================== */
/*  五、鸟巢（国家体育场）                                                       */
/* ========================================================================== */

function buildNest(batch, o, quality) {
  const { x, z, w, d, h: H } = o;
  const a = w / 2;
  const b = d / 2;
  const low = quality === 'low';
  const SEG = low ? 22 : 34;
  const STRIPS = low ? 10 : 16;

  // 编织条的绕向不统一，明暗改用「径向」烘焙：光从南边来，椭圆四壁自己分面
  const nestShade = (nx, ny, nz, px, py, pz) => {
    const dx = px - x;
    const dz = pz - z;
    const len = Math.hypot(dx, dz) || 1;
    const d = (dx / len) * 0.26 + (dz / len) * 0.62 + ny * 0.38;
    return 0.64 + 0.37 * Math.max(0, d);
  };

  // 巢体外表面：略微内收的椭圆筒，上沿是马鞍形的起伏
  const rimY = (phi) => H * (1.0 + 0.055 * Math.cos(phi * 2));
  const srf = (uu, v) => {
    const phi = uu * TAU;
    const shrink = 1 - 0.085 * smoothstep(0.45, 1, v);
    const y = 0.12 + (rimY(phi) - 0.12) * v;
    return [Math.cos(phi) * a * shrink, y, Math.sin(phi) * b * shrink];
  };

  const lattice = quadBuilder();

  // 1) 两个方向的螺旋条带，交叉成「编织」
  for (const dir of [1, -1]) {
    for (let k = 0; k < STRIPS; k++) {
      const base = fract(k / STRIPS + (dir < 0 ? 0.5 / STRIPS : 0));
      for (let i = 0; i < SEG; i++) {
        const u0 = i / SEG;
        const u1 = (i + 1) / SEG;
        const v0 = fract(base + dir * 0.78 * u0);
        let v1 = fract(base + dir * 0.78 * u1);
        if (dir > 0 && v1 < v0) v1 += 1;
        if (dir < 0) {
          if (v1 > v0) v1 -= 1;
          if (v1 >= v0) continue;
        }
        if (v1 > 1.0) continue;
        const half = 0.014;
        const p0 = srf(u0, clamp01(v0 - half));
        const p1 = srf(u1, clamp01(v1 - half));
        const p2 = srf(u1, clamp01(v1 + half));
        const p3 = srf(u0, clamp01(v0 + half));
        lattice.quad(p0, p1, p2, p3);
      }
    }
  }
  // 2) 几道环向箍
  const ringVs = [0.12, 0.3, 0.48, 0.64, 0.79, 0.9];
  for (const v of ringVs) {
    for (let i = 0; i < SEG; i++) {
      const u0 = i / SEG;
      const u1 = (i + 1) / SEG;
      lattice.quad(srf(u0, v - 0.008), srf(u1, v - 0.008), srf(u1, v + 0.008), srf(u0, v + 0.008));
    }
  }
  batch.add(lattice.geometry(), M(x, 0, z), C.dark, C.soft, { y0: 0, y1: H, shadeFn: nestShade });

  // 3) 顶部压边：一圈更厚更深的「巢口」
  const rim = quadBuilder();
  for (let i = 0; i < SEG; i++) {
    const u0 = i / SEG;
    const u1 = (i + 1) / SEG;
    const p0 = srf(u0, 0.955);
    const p1 = srf(u1, 0.955);
    const p2 = srf(u1, 1.0);
    const p3 = srf(u0, 1.0);
    const push = (p) => [p[0] * 1.015, p[1], p[2] * 1.015];
    rim.quad(push(p0), push(p1), push(p2), push(p3));
  }
  batch.add(rim.geometry(), M(x, 0, z), C.deepest, C.steel, { y0: 0, y1: H, shadeFn: nestShade });

  // 4) 内碗看台：一圈圈台阶状的座席（riser 暗、tread 亮），中间是场地
  const tiers = [
    { r: 0.97, y: H * 0.93 },
    { r: 0.875, y: H * 0.79 },
    { r: 0.79, y: H * 0.65 },
    { r: 0.71, y: H * 0.52 },
    { r: 0.64, y: H * 0.4 },
    { r: 0.58, y: H * 0.29 },
    { r: 0.53, y: H * 0.19 },
  ];
  const ringPt = (uu, r, y) => [Math.cos(uu * TAU) * a * r, y, Math.sin(uu * TAU) * b * r];
  for (let r = 0; r < tiers.length - 1; r++) {
    const hi = tiers[r];
    const lo = tiers[r + 1];
    const qb = quadBuilder();
    for (let i = 0; i < SEG; i++) {
      const u0 = i / SEG;
      const u1 = (i + 1) / SEG;
      // 立面（riser）：暗
      qb.quad(ringPt(u0, hi.r, lo.y), ringPt(u1, hi.r, lo.y), ringPt(u1, hi.r, hi.y), ringPt(u0, hi.r, hi.y));
      // 踏面（tread）：亮
      qb.quad(ringPt(u0, lo.r, hi.y), ringPt(u1, lo.r, hi.y), ringPt(u1, hi.r, hi.y), ringPt(u0, hi.r, hi.y));
    }
    const c = r < 2 ? C.mid : r % 2 === 0 ? C.steel : C.dark;
    batch.add(qb.geometry(), M(x, 0, z), c, C.mid, { y0: 0, y1: H, shadeFn: nestShade });
    // 座席前沿的一道细墨线
    const edge = quadBuilder();
    for (let i = 0; i < SEG; i++) {
      const u0 = i / SEG;
      const u1 = (i + 1) / SEG;
      edge.quad(
        ringPt(u0, hi.r * 0.995, hi.y - 0.004), ringPt(u1, hi.r * 0.995, hi.y - 0.004),
        ringPt(u1, hi.r * 0.995, hi.y + 0.012), ringPt(u0, hi.r * 0.995, hi.y + 0.012),
      );
    }
    batch.add(edge.geometry(), M(x, 0, z), C.deepest, C.deepest, { y0: 0, y1: H, shadeFn: null });
  }
  // 巢口内沿的亮边：一圈更亮的「唇」，把内碗的深度托出来
  const lip = quadBuilder();
  for (let i = 0; i < SEG; i++) {
    const u0 = i / SEG;
    const u1 = (i + 1) / SEG;
    lip.quad(
      ringPt(u0, 0.962, tiers[0].y - 0.004), ringPt(u1, 0.962, tiers[0].y - 0.004),
      ringPt(u1, 0.962, tiers[0].y + 0.045), ringPt(u0, 0.962, tiers[0].y + 0.045),
    );
  }
  batch.add(lip.geometry(), M(x, 0, z), C.silver, C.paper, { y0: 0, y1: H, shadeFn: null });

  // 最后一圈内壁：落到场地
  const innerWall = quadBuilder();
  for (let i = 0; i < SEG; i++) {
    const u0 = i / SEG;
    const u1 = (i + 1) / SEG;
    innerWall.quad(
      ringPt(u0, 0.53, 0.14), ringPt(u1, 0.53, 0.14),
      ringPt(u1, 0.53, tiers[tiers.length - 1].y), ringPt(u0, 0.53, tiers[tiers.length - 1].y),
    );
  }
  batch.add(innerWall.geometry(), M(x, 0, z), C.deep, C.deep, { y0: 0, y1: H, shadeFn: nestShade });

  // 场地 + 跑道 + 草坪
  const fieldGeo = new THREE.CircleGeometry(1, SEG);
  fieldGeo.rotateX(-Math.PI / 2);
  fieldGeo.scale(a * 0.53, 1, b * 0.53);
  batch.add(fieldGeo, M(x, 0.145, z), C.field, C.field, { shadeFn: null });
  const trackGeo = new THREE.RingGeometry(0.84, 0.985, SEG);
  trackGeo.rotateX(-Math.PI / 2);
  trackGeo.scale(a * 0.53, 1, b * 0.53);
  batch.add(trackGeo, M(x, 0.152, z), C.steel, C.steel, { shadeFn: null });
  const pitchGeo = new THREE.PlaneGeometry(a * 0.66, b * 0.6);
  pitchGeo.rotateX(-Math.PI / 2);
  batch.add(pitchGeo, M(x, 0.158, z), C.seat, C.seat, { shadeFn: null });
}

/* ========================================================================== */
/*  六、水立方                                                                  */
/* ========================================================================== */

function buildWaterCube(batch, group, o) {
  const { x, z, w, d, h: H } = o;
  const tex = getBubbleTexture();
  const mat = new THREE.MeshLambertMaterial({
    map: tex,
    color: 0xffffff,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const cube = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), mat);
  cube.position.set(x, H / 2, z);
  cube.name = 'water-cube';
  group.add(cube);

  // 基座与顶部压边（走合批，压住方盒的硬边）
  addBox(batch, w * 1.06, 0.06, d * 1.06, x, 0, z, 0, C.dark, C.mid);
  addBox(batch, w * 1.02, 0.04, d * 1.02, x, H - 0.012, z, 0, C.paper, C.paper);
  // 四角竖棱
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(batch, 0.05, H, 0.05, x + sx * w * 0.5, 0, z + sz * d * 0.5, 0, C.pale, C.paper);
    }
  }
}

/* ========================================================================== */
/*  七、国家大剧院（水中的银蛋）                                                 */
/* ========================================================================== */

function buildNCPA(batch, group, o) {
  const { x, z, w, d, h: H } = o;
  const rx = w * 0.46;
  const rz = d * 0.43;
  const poolRx = rx * 1.62;
  const poolRz = rz * 1.7;

  // 一圈水面（自带水，不依赖 water.js）
  const poolTex = getPoolTexture();
  const poolGeo = new THREE.CircleGeometry(1, 64);
  poolGeo.rotateX(-Math.PI / 2);
  const pool = new THREE.Mesh(
    poolGeo,
    new THREE.MeshBasicMaterial({
      map: poolTex,
      color: new THREE.Color(WATER).lerp(new THREE.Color(0xffffff), 0.18),
      toneMapped: false,
    }),
  );
  pool.scale.set(poolRx, 1, poolRz);
  pool.position.set(x, 0.014, z);
  pool.renderOrder = 2;
  pool.name = 'ncpa-pool';
  group.add(pool);

  // 淡墨驳岸：贴水一圈更深的墨，像宣纸洇水（北边不压，和湖连成一片）
  const revet = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.004, 64, 1),
    new THREE.MeshBasicMaterial({
      color: 0x2a353a,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  revet.rotation.x = -Math.PI / 2;
  revet.scale.set(poolRx, poolRz, 1);
  revet.position.set(x, 0.022, z);
  revet.renderOrder = 3;
  revet.name = 'ncpa-revetment';
  group.add(revet);

  // 池岸：一圈很淡的石边。北边不压边——那一侧直接和中南海的水连成一片
  const rim = quadBuilder();
  const RIM_SEG = 64;
  for (let i = 0; i < RIM_SEG; i++) {
    const a0 = (i / RIM_SEG) * TAU;
    const a1 = ((i + 1) / RIM_SEG) * TAU;
    if (Math.sin(a0) < -0.3) continue;
    const p = (ang, k, yy) => [Math.cos(ang) * poolRx * k, yy, Math.sin(ang) * poolRz * k];
    rim.quad(p(a0, 0.99, 0.018), p(a1, 0.99, 0.018), p(a1, 1.028, 0.018), p(a0, 1.028, 0.018));
    rim.quad(p(a0, 1.028, 0.018), p(a1, 1.028, 0.018), p(a1, 1.04, 0.042), p(a0, 1.04, 0.042));
  }
  batch.add(rim.geometry(), M(x, 0, z), C.pale, C.paper, { y0: 0, y1: H });

  // 银蛋：半沉在水里的扁椭球（只做上半球，下半截没入水中）
  const domeGeo = new THREE.SphereGeometry(1, 30, 12, 0, TAU, 0, Math.PI / 2);
  domeGeo.scale(rx, H * 0.98, rz);
  batch.add(domeGeo, M(x, -H * 0.06, z), C.mid, C.dome, { y0: -H * 0.06, y1: H * 0.98, gamma: 0.55 });

  // 蛋身上的一圈淡墨接缝（钛板分缝的暗示）
  const seam = quadBuilder();
  const seamSeg = 40;
  for (let i = 0; i < seamSeg; i++) {
    const a0 = (i / seamSeg) * TAU;
    const a1 = ((i + 1) / seamSeg) * TAU;
    const v = 0.42;
    const rr = Math.sqrt(1 - v * v);
    const yy = H * 0.98 * v - H * 0.06;
    const p = (ang, k) => [x + Math.cos(ang) * rx * rr * k, yy, z + Math.sin(ang) * rz * rr * k];
    seam.quad(p(a0, 0.997), p(a1, 0.997), p(a1, 1.006), p(a0, 1.006));
  }
  batch.add(seam.geometry(), null, C.mid, C.mid);

  // 水里的倒影：竖向淡墨条
  const refl = new THREE.Mesh(
    new THREE.PlaneGeometry(poolRx * 1.28, poolRz * 1.5),
    new THREE.MeshBasicMaterial({
      map: getReflectionTexture(),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      toneMapped: false,
      color: 0xffffff,
    }),
  );
  refl.rotation.x = -Math.PI / 2;
  refl.position.set(x, 0.028, z + poolRz * 0.52);
  refl.renderOrder = 4;
  refl.name = 'ncpa-reflection';
  group.add(refl);

  // 南岸一道很淡的石桥线：把「沉在水里的蛋」和长安街接上
  addBox(batch, rx * 1.05, 0.03, 0.9, x, 0, z + poolRz * 1.02, 0, C.pale, C.paper, { y0: 0, y1: H });
  addBox(batch, rx * 1.06, 0.02, 0.06, x, 0.03, z + poolRz * 1.02 + 0.44, 0, C.soft, C.soft);
}

/* ========================================================================== */
/*  主入口                                                                      */
/* ========================================================================== */

export function buildModern(ctx) {
  const group = new THREE.Group();
  group.name = 'modern';
  const quality = ctx.quality === 'low' ? 'low' : 'high';

  const batch = new InkBatch();
  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  /* —— 现代北京的三处：东边的 CBD、北边的奥体、长安街边的大剧院 —— */
  buildCBD(batch, group);

  addParkPad(group);
  addOlympicAvenue(batch);
  buildOlympicTower(batch, MODERN.olympicTower);
  buildNest(batch, MODERN.nest, quality);
  buildWaterCube(batch, group, MODERN.waterCube);
  const parkTrees = buildTrees(olympicTreeSpecs(quality), ctx);
  if (parkTrees.children.length) group.add(parkTrees);

  buildNCPA(batch, group, MODERN.ncpac);

  batch.flush(group, mat, 'modern-ink');

  return group;
}
