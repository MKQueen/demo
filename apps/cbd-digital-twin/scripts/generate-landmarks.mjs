#!/usr/bin/env node
/**
 * generate-landmarks.mjs
 * ---------------------------------------------------------------------------
 * 程序化生成国贸 CBD 四座地标的「示意体量」glTF / GLB：
 *   - 中国尊 CITIC Tower（528 m，收腰轮廓 + 发光环带）
 *   - 国贸三期 A 座（330 m，分级退台 + 竖向翼板）
 *   - 国贸三期 B 座（296 m，板式塔楼 + 冠部）
 *   - 中央电视台总部大楼（234 m，倾斜双塔 + 顶部连桥 + 斜向网格）
 *
 * 说明：公开渠道几乎不存在可直接商用/再分发的「高精度国贸模型」。
 * 本脚本用参数化几何做演示级体量，不宣称测绘精度；生产环境请替换为
 * 有授权的 BIM / 倾斜摄影 / 3D Tiles 模型。
 *
 * 坐标约定：
 *   glTF: +X = 东, +Y = 上, +Z = 南（与 Cesium glTF Y-up 规则一致）
 *   所有尺寸单位：米；模型底面位于 y = 0。
 *
 * 用法：node scripts/generate-landmarks.mjs
 * 依赖：@gltf-transform/core
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'models');
fs.mkdirSync(OUT_DIR, { recursive: true });

/* -------------------------------------------------------------------------- */
/* 向量 / 几何工具                                                             */
/* -------------------------------------------------------------------------- */
const V = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};

/**
 * 一个材质对应一个 Part；最后每个 Part 导出为一个 glTF primitive。
 * 顶点按面拆分（flat shading），保证玻璃/金属体块轮廓清晰。
 */
class Part {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.indices = [];
  }

  addQuad(a, b, c, d, outwardHint) {
    // 计算面法线，并保证顶点绕序与 outwardHint 一致（避免背面剔除造成缺面）
    let n = V.norm(V.cross(V.sub(b, a), V.sub(c, a)));
    if (!Number.isFinite(n[0]) || (n[0] === 0 && n[1] === 0 && n[2] === 0)) return;
    if (outwardHint && V.dot(n, outwardHint) < 0) {
      [b, d] = [d, b];
      n = V.mul(n, -1);
    }
    const base = this.positions.length / 3;
    for (const p of [a, b, c, d]) {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(n[0], n[1], n[2]);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  addTri(a, b, c, outwardHint) {
    let n = V.norm(V.cross(V.sub(b, a), V.sub(c, a)));
    if (outwardHint && V.dot(n, outwardHint) < 0) {
      [b, c] = [c, b];
      n = V.mul(n, -1);
    }
    const base = this.positions.length / 3;
    for (const p of [a, b, c]) {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(n[0], n[1], n[2]);
    }
    this.indices.push(base, base + 1, base + 2);
  }

  get triangles() {
    return this.indices.length / 3;
  }
}

function createPartMap() {
  const map = new Map();
  return {
    get(name) {
      if (!map.has(name)) map.set(name, new Part());
      return map.get(name);
    },
    entries: () => [...map.entries()].filter(([, p]) => p.indices.length > 0),
  };
}

/* -------------------------------------------------------------------------- */
/* 基础体块                                                                   */
/* -------------------------------------------------------------------------- */
function rotateY(p, center, angle) {
  const [x, y, z] = V.sub(p, center);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [center[0] + x * c + z * s, center[1] + y, center[2] - x * s + z * c];
}

function addBox(parts, material, cx, cy, cz, sx, sy, sz, rotY = 0) {
  const part = parts.get(material);
  const center = [cx, cy, cz];
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const raw = {
    x0: [cx - hx, cy - hy, cz - hz],
    x1: [cx + hx, cy - hy, cz - hz],
    x2: [cx + hx, cy - hy, cz + hz],
    x3: [cx - hx, cy - hy, cz + hz],
    t0: [cx - hx, cy + hy, cz - hz],
    t1: [cx + hx, cy + hy, cz - hz],
    t2: [cx + hx, cy + hy, cz + hz],
    t3: [cx - hx, cy + hy, cz + hz],
  };
  const p = {};
  for (const [k, v] of Object.entries(raw)) p[k] = rotY ? rotateY(v, center, rotY) : v;
  // 底面（法线 -Y）
  part.addQuad(p.x3, p.x2, p.x1, p.x0, [0, -1, 0]);
  // 顶面（+Y）
  part.addQuad(p.t0, p.t1, p.t2, p.t3, [0, 1, 0]);
  // 南 / 北 / 东 / 西
  part.addQuad(p.x0, p.x1, p.t1, p.t0, [0, 0, -1]);
  part.addQuad(p.x2, p.x3, p.t3, p.t2, [0, 0, 1]);
  part.addQuad(p.x1, p.x2, p.t2, p.t1, [1, 0, 0]);
  part.addQuad(p.x3, p.x0, p.t0, p.t3, [-1, 0, 0]);
}

/**
 * 矩形截面棱台（可带顶部水平偏移，用于倾斜塔楼 / 退台）。
 */
function addFrustum(
  parts,
  material,
  { cx = 0, cz = 0, y0, y1, sx0, sz0, sx1 = sx0, sz1 = sz0, dx = 0, dz = 0, rotY = 0, capTop = true, capBottom = false },
) {
  const part = parts.get(material);
  const center = [cx, (y0 + y1) / 2, cz];
  const b = [
    [cx - sx0 / 2, y0, cz - sz0 / 2],
    [cx + sx0 / 2, y0, cz - sz0 / 2],
    [cx + sx0 / 2, y0, cz + sz0 / 2],
    [cx - sx0 / 2, y0, cz + sz0 / 2],
  ].map((v) => rotateY(v, center, rotY));
  const tx = cx + dx;
  const tz = cz + dz;
  const t = [
    [tx - sx1 / 2, y1, tz - sz1 / 2],
    [tx + sx1 / 2, y1, tz - sz1 / 2],
    [tx + sx1 / 2, y1, tz + sz1 / 2],
    [tx - sx1 / 2, y1, tz + sz1 / 2],
  ].map((v) => rotateY(v, center, rotY));

  const mid = (a, c) => [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
  const hint = (i) => {
    const faceMid = mid(mid(b[i], b[(i + 1) % 4]), mid(t[i], t[(i + 1) % 4]));
    return V.norm([faceMid[0] - cx, 0, faceMid[2] - cz]);
  };
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    part.addQuad(b[i], b[j], t[j], t[i], hint(i));
  }
  if (capTop) part.addQuad(t[3], t[2], t[1], t[0], [0, 1, 0]);
  if (capBottom) part.addQuad(b[0], b[1], b[2], b[3], [0, -1, 0]);
}

/** 竖直圆柱 / 圆台（天线、桅杆） */
function addCylinder(parts, material, cx, cz, y0, y1, r0, r1 = r0, segments = 12) {
  const part = parts.get(material);
  const ring = (y, r) =>
    Array.from({ length: segments }, (_, i) => {
      const a = (i / segments) * Math.PI * 2;
      return [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
    });
  const b = ring(y0, r0);
  const t = ring(y1, r1);
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    const outward = V.norm([
      (b[i][0] + b[j][0]) / 2 - cx,
      0,
      (b[i][2] + b[j][2]) / 2 - cz,
    ]);
    part.addQuad(b[i], b[j], t[j], t[i], outward);
  }
  if (r1 > 0.01) {
    for (let i = 0; i < segments; i++) {
      const j = (i + 1) % segments;
      part.addTri([cx, y1, cz], t[i], t[j], [0, 1, 0]);
    }
  }
}

/** 斜梁：任意方向的长方体，用于央视总部斜向网格 */
function addBeam(parts, material, p0, p1, width, depth) {
  const part = parts.get(material);
  const dir = V.norm(V.sub(p1, p0));
  const ref = Math.abs(dir[1]) > 0.94 ? [1, 0, 0] : [0, 1, 0];
  const right = V.norm(V.cross(dir, ref));
  const up = V.norm(V.cross(right, dir));
  const hw = width / 2;
  const hd = depth / 2;
  const corners = (p) => [
    V.add(p, V.add(V.mul(right, -hw), V.mul(up, -hd))),
    V.add(p, V.add(V.mul(right, hw), V.mul(up, -hd))),
    V.add(p, V.add(V.mul(right, hw), V.mul(up, hd))),
    V.add(p, V.add(V.mul(right, -hw), V.mul(up, hd))),
  ];
  const a = corners(p0);
  const b = corners(p1);
  const outward = (mid) => V.norm(V.sub(mid, V.lerp(p0, p1, 0.5)));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    part.addQuad(a[i], a[j], b[j], b[i], outward(V.lerp(a[i], a[j], 0.5)));
  }
  part.addQuad(a[3], a[2], a[1], a[0], V.mul(dir, -1));
  part.addQuad(b[0], b[1], b[2], b[3], dir);
}

/** 超椭圆环（中国尊的「尊」形平面） */
function superRing(rx, rz, y, segments, exponent = 4.2, rot = 0) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2 + rot;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = Math.sign(c) * Math.pow(Math.abs(c), 2 / exponent) * rx;
    const z = Math.sign(s) * Math.pow(Math.abs(s), 2 / exponent) * rz;
    pts.push([x, y, z]);
  }
  return pts;
}

/* -------------------------------------------------------------------------- */
/* 材质                                                                       */
/* -------------------------------------------------------------------------- */
function hexToLinear(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const srgb = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  return srgb.map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
}

const MATERIALS = {
  glassBlue: {
    base: '#5f9bc4',
    metallic: 0.55,
    roughness: 0.18,
    emissive: '#0b1a26',
    alpha: 1,
  },
  glassDeep: {
    base: '#2f5d7a',
    metallic: 0.7,
    roughness: 0.2,
    emissive: '#07131c',
  },
  frame: {
    base: '#c9d8e4',
    metallic: 0.75,
    roughness: 0.32,
    emissive: '#05090d',
  },
  concrete: {
    base: '#7f8c98',
    metallic: 0.05,
    roughness: 0.88,
    emissive: '#000000',
  },
  lightCyan: {
    base: '#14252c',
    metallic: 0.2,
    roughness: 0.5,
    emissive: '#58dcff',
  },
  lightWarm: {
    base: '#2a1d11',
    metallic: 0.15,
    roughness: 0.5,
    emissive: '#ffb45c',
  },
  crown: {
    base: '#81a9c2',
    metallic: 0.65,
    roughness: 0.24,
    emissive: '#1e4c62',
  },
};

function makeMaterials(doc) {
  const materials = {};
  for (const [name, def] of Object.entries(MATERIALS)) {
    const base = hexToLinear(def.base);
    const emissive = hexToLinear(def.emissive || '#000000');
    materials[name] = doc
      .createMaterial(name)
      .setBaseColorFactor([...base, def.alpha ?? 1])
      .setMetallicFactor(def.metallic ?? 0)
      .setRoughnessFactor(def.roughness ?? 0.6)
      .setEmissiveFactor(emissive);
  }
  return materials;
}

function exportDocument(parts, doc, name, extra = {}) {
  const buffer = doc.createBuffer();
  const scene = doc.createScene(name);
  const materials = makeMaterials(doc);
  const root = doc.getRoot();
  scene.setExtras({ name, generated: new Date().toISOString(), ...extra });

  for (const [materialName, part] of parts.entries()) {
    const positions = Float32Array.from(part.positions);
    const normals = Float32Array.from(part.normals);
    const indices = Uint32Array.from(part.indices);
    const posAccessor = doc
      .createAccessor(`${materialName}-POSITION`)
      .setType('VEC3')
      .setArray(positions)
      .setBuffer(buffer);
    const normAccessor = doc
      .createAccessor(`${materialName}-NORMAL`)
      .setType('VEC3')
      .setArray(normals)
      .setBuffer(buffer);
    const idxAccessor = doc
      .createAccessor(`${materialName}-INDEX`)
      .setType('SCALAR')
      .setArray(indices)
      .setBuffer(buffer);
    const primitive = doc
      .createPrimitive()
      .setAttribute('POSITION', posAccessor)
      .setAttribute('NORMAL', normAccessor)
      .setIndices(idxAccessor)
      .setMaterial(materials[materialName]);
    const mesh = doc.createMesh(`${name}-${materialName}`).addPrimitive(primitive);
    scene.addChild(doc.createNode(`${name}-${materialName}`).setMesh(mesh));
  }
  return scene;
}

async function writeModel(doc, fileName, triangleCount) {
  const io = new NodeIO();
  const file = path.join(OUT_DIR, fileName);
  await io.write(file, doc);
  const size = fs.statSync(file).size;
  console.log(
    `✓ ${fileName.padEnd(20)} ${String(triangleCount).padStart(6)} tris   ${(size / 1024).toFixed(0).padStart(5)} KB`,
  );
}

/* -------------------------------------------------------------------------- */
/* 中国尊 CITIC Tower（528 m）                                                 */
/* -------------------------------------------------------------------------- */
function buildCiticTower() {
  const parts = createPartMap();
  const doc = new Document();

  // 裙房
  addFrustum(parts, 'glassDeep', { y0: 0, y1: 18, sx0: 112, sz0: 104, sx1: 106, sz1: 98 });
  addFrustum(parts, 'frame', { y0: 18, y1: 21, sx0: 108, sz0: 100, sx1: 100, sz1: 94 });
  addBox(parts, 'lightCyan', 0, 19.7, 49, 106, 0.8, 2.2);
  // 裙房入口雨棚
  addBox(parts, 'frame', 0, 9, -54, 64, 1.2, 14);
  addBox(parts, 'glassBlue', 0, 14, -46, 56, 8, 2);

  // 主塔「尊」形收腰轮廓：y → 半宽
  const profile = [
    [18, 42],
    [80, 39],
    [170, 36.5],
    [260, 34],
    [340, 31.5],
    [410, 29.5],
    [450, 28.2],
    [480, 28.8],
    [505, 30.4],
    [514, 30.8],
    [524, 24],
    [528, 13],
  ];
  const widthAt = (y) => {
    if (y <= profile[0][0]) return profile[0][1];
    for (let i = 0; i < profile.length - 1; i++) {
      const [y0, w0] = profile[i];
      const [y1, w1] = profile[i + 1];
      if (y >= y0 && y <= y1) return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0);
    }
    return profile[profile.length - 1][1];
  };

  const segments = 40;
  const levels = [];
  for (let y = 18; y < 514; y += 8) levels.push(y);
  levels.push(514, 520, 524, 528);
  const rings = levels.map((y) => superRing(widthAt(y), widthAt(y) * 0.97, y, segments, 4.6, (y - 18) * 0.0006));

  const towerPart = parts.get('glassBlue');
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    for (let j = 0; j < segments; j++) {
      const k = (j + 1) % segments;
      const mid = [
        (a[j][0] + a[k][0] + b[j][0] + b[k][0]) / 4,
        (a[j][1] + a[k][1] + b[j][1] + b[k][1]) / 4,
        (a[j][2] + a[k][2] + b[j][2] + b[k][2]) / 4,
      ];
      towerPart.addQuad(a[j], a[k], b[k], b[j], [mid[0], 0, mid[2]]);
    }
  }
  // 塔顶封口
  const topRing = rings[rings.length - 1];
  const topCap = parts.get('crown');
  for (let j = 0; j < segments; j++) {
    const k = (j + 1) % segments;
    topCap.addTri([0, 528, 0], topRing[j], topRing[k], [0, 1, 0]);
  }
  // 顶部冠部竖向构件
  const crownRing = superRing(31.2, 30.2, 514, segments, 4.6);
  for (let j = 0; j < segments; j += 4) {
    const p = crownRing[j];
    addBeam(parts, 'frame', [p[0], 514, p[2]], [p[0] * 0.82, 528, p[2] * 0.82], 0.9, 0.9);
  }

  // 发光环带：贴在塔身外轮廓上
  const bandYs = [58, 102, 148, 196, 244, 292, 340, 388, 432, 472, 505];
  for (const y of bandYs) {
    const r0 = widthAt(y) + 0.55;
    const r1 = widthAt(y + 1.1) + 0.55;
    const inner0 = widthAt(y);
    const inner1 = widthAt(y + 1.1);
    const a = superRing(r0, r0 * 0.97, y, segments, 4.6, (y - 18) * 0.0006);
    const b = superRing(r1, r1 * 0.97, y + 1.1, segments, 4.6, (y - 16.9) * 0.0006);
    const ia = superRing(inner0, inner0 * 0.97, y, segments, 4.6, (y - 18) * 0.0006);
    const ib = superRing(inner1, inner1 * 0.97, y + 1.1, segments, 4.6, (y - 16.9) * 0.0006);
    const band = parts.get(y > 430 ? 'lightWarm' : 'lightCyan');
    for (let j = 0; j < segments; j++) {
      const k = (j + 1) % segments;
      band.addQuad(a[j], a[k], b[k], b[j], [a[j][0], 0, a[j][2]]);
      band.addQuad(ia[k], ia[j], ib[j], ib[k], [0, 1, 0]);
      band.addQuad(a[j], ia[j], ia[k], a[k], [0, -1, 0]);
    }
  }

  // 四条竖向幕墙肋
  const ribs = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
  for (const angle of ribs) {
    for (let y = 26; y < 500; y += 32) {
      const p0 = superRing(widthAt(y) + 0.5, (widthAt(y) + 0.5) * 0.97, y, 64, 4.6, 0)[Math.round((angle / (Math.PI * 2)) * 64) % 64];
      const p1 = superRing(widthAt(y + 32) + 0.5, (widthAt(y + 32) + 0.5) * 0.97, y + 32, 64, 4.6, 0)[
        Math.round((angle / (Math.PI * 2)) * 64) % 64
      ];
      addBeam(parts, 'frame', p0, p1, 0.7, 0.7);
    }
  }

  // 底座广场环
  addFrustum(parts, 'frame', { y0: 0, y1: 0.6, sx0: 132, sz0: 124, sx1: 132, sz1: 124 });
  exportDocument(parts, doc, 'citic-tower', { height: 528, kind: 'landmark' });
  return { doc, triangles: [...parts.entries()].reduce((sum, [, p]) => sum + p.triangles, 0) };
}

/* -------------------------------------------------------------------------- */
/* 国贸三期 A 座（330 m）                                                      */
/* -------------------------------------------------------------------------- */
function buildCwtc3A() {
  const parts = createPartMap();
  const doc = new Document();

  // 裙房 + 平台
  addFrustum(parts, 'glassDeep', { y0: 0, y1: 26, sx0: 104, sz0: 92, sx1: 96, sz1: 84 });
  addFrustum(parts, 'frame', { y0: 26, y1: 28.5, sx0: 100, sz0: 88, sx1: 88, sz1: 76 });
  for (let y = 4; y < 26; y += 6) {
    addBox(parts, 'lightCyan', 0, y, 0, 100, 0.55, 88);
  }
  addBox(parts, 'lightWarm', 0, 12, 46.6, 86, 0.5, 0.7);

  // 主塔：三段退台
  addFrustum(parts, 'glassBlue', { cx: 0, cz: 0, y0: 28, y1: 244, sx0: 56, sz0: 54, sx1: 47, sz1: 45 });
  addFrustum(parts, 'glassBlue', { y0: 244, y1: 296, sx0: 48, sz0: 46, sx1: 38, sz1: 36 });
  addFrustum(parts, 'crown', { y0: 296, y1: 320, sx0: 38, sz0: 36, sx1: 24, sz1: 22 });
  addFrustum(parts, 'crown', { y0: 320, y1: 330, sx0: 22, sz0: 20, sx1: 10, sz1: 9 });

  // 四角竖向翼板
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    addBox(parts, 'frame', sx * 26.5, 150, sz * 25.5, 1.7, 248, 1.7);
    addBox(parts, 'frame', sx * 22, 300, sz * 21, 1.2, 12, 1.2);
  }
  // 水平结构带
  for (let y = 42; y < 300; y += 24) {
    const w = y < 244 ? 52 : 43;
    addBox(parts, 'frame', 0, y, 0, w, 0.9, w * 0.96);
    addBox(parts, y > 270 ? 'lightWarm' : 'lightCyan', 0, y + 0.8, 0, w * 0.97, 0.55, w * 0.94);
  }
  // 冠部开口格栅
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    addBeam(parts, 'frame', [Math.cos(a) * 20, 320, Math.sin(a) * 19], [Math.cos(a) * 9, 330, Math.sin(a) * 8.5], 0.8, 0.8);
  }
  addCylinder(parts, 'frame', 0, 0, 320, 330, 1.1, 0.35, 8);

  addFrustum(parts, 'frame', { y0: 0, y1: 0.6, sx0: 122, sz0: 110, sx1: 122, sz1: 110 });
  exportDocument(parts, doc, 'cwtc-3a', { height: 330, kind: 'landmark' });
  return { doc, triangles: [...parts.entries()].reduce((sum, [, p]) => sum + p.triangles, 0) };
}

/* -------------------------------------------------------------------------- */
/* 国贸三期 B 座（296 m）                                                      */
/* -------------------------------------------------------------------------- */
function buildCwtc3B() {
  const parts = createPartMap();
  const doc = new Document();

  addFrustum(parts, 'glassDeep', { y0: 0, y1: 20, sx0: 78, sz0: 56, sx1: 74, sz1: 52 });
  addFrustum(parts, 'frame', { y0: 20, y1: 22.5, sx0: 80, sz0: 58, sx1: 70, sz1: 48 });
  // 板式塔楼，轻微收分
  addFrustum(parts, 'glassBlue', { y0: 22, y1: 250, sx0: 48, sz0: 34, sx1: 43, sz1: 31 });
  addFrustum(parts, 'glassBlue', { y0: 250, y1: 278, sx0: 43, sz0: 31, sx1: 37, sz1: 27 });
  addFrustum(parts, 'crown', { y0: 278, y1: 296, sx0: 37, sz0: 27, sx1: 24, sz1: 18 });

  // 竖向翼板（东西立面）
  for (const x of [-24.5, -12, 0, 12, 24.5]) {
    addBox(parts, 'frame', x, 136, 0, 0.9, 228, 34.6);
  }
  // 水平环带
  for (let y = 34; y < 290; y += 26) {
    const w = y < 250 ? 47 : 40;
    addBox(parts, 'lightCyan', 0, y, 0, w, 0.6, w * 0.7);
  }
  // 顶部出挑
  addBox(parts, 'frame', 0, 285, 0, 40, 1.2, 30);
  addBox(parts, 'lightWarm', 0, 290, 0, 38, 0.6, 28);

  addFrustum(parts, 'frame', { y0: 0, y1: 0.6, sx0: 96, sz0: 72, sx1: 96, sz1: 72 });
  exportDocument(parts, doc, 'cwtc-3b', { height: 296, kind: 'landmark' });
  return { doc, triangles: [...parts.entries()].reduce((sum, [, p]) => sum + p.triangles, 0) };
}

/* -------------------------------------------------------------------------- */
/* 中央电视台总部大楼（234 m，程序化环形体量）                                  */
/* -------------------------------------------------------------------------- */
function buildCctv() {
  const parts = createPartMap();
  const doc = new Document();
  const H = 234;
  const westX = -74;
  const eastX = 74;
  const lean = 26;
  const towerBaseY = 18;

  // 两座侧翼裙房；中间前庭留空，让「环」的负空间一眼可辨
  addFrustum(parts, 'glassDeep', { cx: westX, cz: 0, y0: 0, y1: 34, sx0: 76, sz0: 74, sx1: 72, sz1: 70 });
  addFrustum(parts, 'glassDeep', { cx: eastX, cz: 0, y0: 0, y1: 30, sx0: 68, sz0: 68, sx1: 64, sz1: 64 });
  addBox(parts, 'glassDeep', 0, 14, 34, 142, 28, 26);
  addBox(parts, 'frame', westX, 34.5, 0, 78, 1.2, 72);
  addBox(parts, 'frame', eastX, 30.5, 0, 70, 1.2, 66);
  addBox(parts, 'lightCyan', 0, 28.5, 46.8, 140, 0.6, 0.8);

  // 倾斜双塔：下宽上窄，向中间收拢
  addFrustum(parts, 'glassBlue', {
    cx: westX,
    cz: 0,
    y0: towerBaseY,
    y1: 178,
    sx0: 38,
    sz0: 52,
    sx1: 30,
    sz1: 42,
    dx: lean,
    dz: 0,
  });
  addFrustum(parts, 'glassBlue', {
    cx: eastX,
    cz: 0,
    y0: towerBaseY,
    y1: 172,
    sx0: 36,
    sz0: 50,
    sx1: 28,
    sz1: 40,
    dx: -lean,
    dz: 0,
  });
  // 顶部环廊：横跨两塔，形成 CCTV 标志性的「门洞」
  addBox(parts, 'glassDeep', 0, 194, 0, 156, 32, 56);
  addBox(parts, 'frame', 0, 210.5, 0, 160, 1.8, 60);
  addBox(parts, 'crown', 0, 222, 0, 128, 23, 46);
  addBox(parts, 'frame', 0, 234, 0, 120, 1.4, 42);
  addBox(parts, 'lightCyan', 0, 211.5, -30.2, 156, 0.6, 0.9);
  addBox(parts, 'lightWarm', 0, 193.5, 28.5, 150, 0.5, 0.8);

  // 斜向结构网格：让立面在远处也有可读的肌理
  for (const [centerX, topX, topY, zFace, halfW] of [
    [westX, westX + lean, 178, -27.5, 15],
    [eastX, eastX - lean, 172, -26, 14],
  ]) {
    for (let k = -2; k <= 2; k++) {
      const basePoint = [centerX + k * 7.2, towerBaseY + 2, zFace];
      const topPoint = [topX + k * 6.2, topY - 3, zFace];
      addBeam(parts, 'frame', basePoint, [topPoint[0] + 3.5, topPoint[1], topPoint[2]], 0.8, 0.55);
      addBeam(parts, 'frame', [basePoint[0] + 3.5, basePoint[1], basePoint[2]], topPoint, 0.8, 0.55);
    }
    // 水平环带
    for (let y = 48; y < topY; y += 28) {
      const t = (y - towerBaseY) / (topY - towerBaseY);
      const w = 38 - 8 * t;
      addBox(parts, 'lightCyan', centerX + (topX - centerX) * t, y, 0, w, 0.5, 44 - 4 * t);
    }
  }

  // 顶部连桥的“腰部”结构，暗示内部桁架
  for (let x = -68; x <= 68; x += 17) {
    addBox(parts, 'frame', x, 209, 0, 0.7, 30, 56.5);
  }

  // 北侧庭院连接体与设备层
  addBox(parts, 'glassDeep', 0, 8, 28, 130, 16, 22);
  addBox(parts, 'lightWarm', westX, 35.5, 0, 70, 0.5, 66);
  addBox(parts, 'lightWarm', eastX, 31.5, 0, 62, 0.5, 60);

  // 地面广场
  addFrustum(parts, 'frame', { y0: 0, y1: 0.6, sx0: 220, sz0: 116, sx1: 220, sz1: 116 });
  exportDocument(parts, doc, 'cctv-hq', { height: H, kind: 'landmark' });
  return { doc, triangles: [...parts.entries()].reduce((sum, [, p]) => sum + p.triangles, 0) };
}

/* -------------------------------------------------------------------------- */
/* 主流程                                                                     */
/* -------------------------------------------------------------------------- */
async function main() {
  console.log('\nCBD landmarks → glTF (procedural massing, not survey-grade)\n');
  const jobs = [
    ['citic-tower.glb', buildCiticTower],
    ['cwtc-3a.glb', buildCwtc3A],
    ['cwtc-3b.glb', buildCwtc3B],
    ['cctv-hq.glb', buildCctv],
  ];
  for (const [file, builder] of jobs) {
    const { doc, triangles } = builder();
    await writeModel(doc, file, triangles);
  }
  console.log('\n✓ 地标模型生成完成 →', path.relative(ROOT, OUT_DIR));
}

main().catch((error) => {
  console.error('\n✗ 地标模型生成失败：', error);
  process.exit(1);
});
