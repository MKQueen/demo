/**
 * geometry.js —— 低多边形建筑零件。
 *
 * 这里的每个函数都只依赖 three + 传入的材质，方便各个模块自由组合。
 * 「中国古建」的基本语法：台基 → 屋身（柱/墙）→ 屋顶（庑殿/歇山/攒尖/硬山）。
 * 屋顶在 lib/roof.js，本文件负责台基、栏杆、台阶、城墙、桥这类更基础的零件。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** 把一组几何的属性对齐（缺 uv/normal/color 的补零），避免 merge 失败。 */
function normalizeForMerge(g) {
  if (!g) return g;
  const count = g.attributes.position.count;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2));
  }
  if (!g.attributes.color) {
    const arr = new Float32Array(count * 3);
    arr.fill(1);
    g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
  }
  return g;
}

/** 合并一组几何（自动忽略空值），返回单个 BufferGeometry。 */
export function mergeGeoms(list) {
  let geoms = list.filter(Boolean);
  if (!geoms.length) return new THREE.BufferGeometry();
  if (geoms.length === 1) return geoms[0];
  // 索引状态必须一致
  const anyIndexed = geoms.some((g) => g.index);
  const anyPlain = geoms.some((g) => !g.index);
  if (anyIndexed && anyPlain) geoms = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
  geoms = geoms.map(normalizeForMerge);
  const merged = mergeGeometries(geoms, false);
  return merged || new THREE.BufferGeometry();
}

/** 方盒：以中心为原点。 */
export function box(w, h, d, mat, { x = 0, y = 0, z = 0, rotY = 0 } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  return mesh;
}

/** 两点之间的一根梁 / 柱（BoxGeometry 沿 X 拉长再旋转对齐）。 */
export function beamBetween(a, b, w, h, mat, { yOffset = 0 } = {}) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 1e-6) return null;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, h, w), mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.position.y += yOffset;
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
  return mesh;
}

/** 竖直柱子（细圆柱，八边形即可，低多边形更「笔墨」）。 */
export function column({ x = 0, y = 0, z = 0, radius = 0.08, height = 1, mat, segments = 8 }) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.06, height, segments), mat);
  mesh.position.set(x, y + height / 2, z);
  return mesh;
}

/**
 * 台基（须弥座）：一层层向内收的白色石台。
 * levels: [{ h, inset }]，第一层在最下面、最大。
 */
export function buildTerrace({ width, depth, levels = [{ h: 0.18, inset: 0 }], mat, topMat = null } = {}) {
  const group = new THREE.Group();
  let y = 0;
  const sorted = levels;
  for (let i = 0; i < sorted.length; i++) {
    const { h, inset } = sorted[i];
    const w = width - inset * 2;
    const d = depth - inset * 2;
    const useMat = i === sorted.length - 1 && topMat ? topMat : mat;
    const m = box(w, h, d, useMat, { y: y + h / 2 });
    group.add(m);
    y += h;
  }
  group.userData.topY = y;
  return group;
}

/**
 * 汉白玉栏杆：沿矩形四边，按间距摆小望柱 + 压面石。
 * 只用来看轮廓，不追求雕花。
 */
export function buildBalustrade({
  width,
  depth,
  y = 0,
  spacing = 0.5,
  postW = 0.09,
  postH = 0.16,
  railH = 0.05,
  mat,
  railMat = null,
} = {}) {
  const group = new THREE.Group();
  const halfW = width / 2;
  const halfD = depth / 2;
  const edges = [
    { len: width, from: V(-halfW, y, halfD), to: V(halfW, y, halfD) },
    { len: width, from: V(halfW, y, -halfD), to: V(-halfW, y, -halfD) },
    { len: depth, from: V(halfW, y, halfD), to: V(halfW, y, -halfD) },
    { len: depth, from: V(-halfW, y, -halfD), to: V(-halfW, y, halfD) },
  ];
  const postGeo = new THREE.BoxGeometry(postW, postH, postW);
  const railGeo = new THREE.BoxGeometry(1, railH, postW * 0.8);
  for (const e of edges) {
    const count = Math.max(2, Math.round(e.len / spacing));
    const inst = new THREE.InstancedMesh(postGeo, mat, count);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const p = new THREE.Vector3().lerpVectors(e.from, e.to, t);
      m4.makeTranslation(p.x, p.y + postH / 2, p.z);
      inst.setMatrixAt(i, m4);
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);

    const rail = new THREE.Mesh(railGeo, railMat || mat);
    const mid = new THREE.Vector3().lerpVectors(e.from, e.to, 0.5);
    rail.position.set(mid.x, y + postH * 0.72, mid.z);
    rail.scale.x = e.len;
    const dir = new THREE.Vector3().subVectors(e.to, e.from).normalize();
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
    group.add(rail);
  }
  return group;
}

/**
 * 台阶（踏步）：从 z 正方向往北升。
 */
export function buildStairs({ width, depth, height, steps = 6, mat } = {}) {
  const group = new THREE.Group();
  const stepH = height / steps;
  const stepD = depth / steps;
  for (let i = 0; i < steps; i++) {
    const h = stepH * (i + 1);
    group.add(box(width, h, stepD, mat, { y: h / 2, z: -depth / 2 + stepD * (i + 0.5) }));
  }
  return group;
}

/**
 * 带垛口的城墙 / 长城的直线段：from → to 两点，墙顶有女墙和垛口。
 * 用于内城城墙与燕山长城（尺度不同，但同一套语法）。
 */
export function buildCrenellatedWall({
  from,
  to,
  height = 0.5,
  thickness = 0.24,
  crenel = true,
  crenelH = 0.12,
  crenelW = 0.16,
  crenelGap = 0.16,
  mat,
  crenelMat = null,
  topMat = null,
} = {}) {
  const group = new THREE.Group();
  const a = new THREE.Vector3(from[0], from[1] ?? 0, from[2]);
  const b = new THREE.Vector3(to[0], to[1] ?? 0, to[2]);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 1e-6) return group;
  const angle = Math.atan2(dir.x, dir.z) - Math.PI / 2;

  // 墙体本身：上窄下宽（收分）
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, height, thickness), mat);
  body.position.set((a.x + b.x) / 2, a.y + height / 2, (a.z + b.z) / 2);
  body.rotation.y = angle;
  group.add(body);

  if (topMat) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(len, height * 0.05, thickness * 1.18), topMat);
    cap.position.set(body.position.x, a.y + height + height * 0.02, body.position.z);
    cap.rotation.y = angle;
    group.add(cap);
  }

  if (crenel) {
    const n = Math.max(2, Math.floor(len / (crenelW + crenelGap)));
    const geo = new THREE.BoxGeometry(crenelW, crenelH, thickness * 0.62);
    const inst = new THREE.InstancedMesh(geo, crenelMat || mat, n);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    const base = new THREE.Vector3().copy(a);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      m4.compose(
        new THREE.Vector3(p.x, a.y + height + crenelH / 2, p.z),
        q,
        new THREE.Vector3(1, 1, 1),
      );
      inst.setMatrixAt(i, m4);
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
    // 垛口之间的小缺口：用一排横向短墙的上沿表现（这里省掉，靠后期墨线出层次）
    base.set(0, 0, 0);
  }
  return group;
}

/** 一圈城墙（矩形），自动按四条边生成，便于内城。 */
export function buildWallRing({ width, depth, y = 0, height, thickness, mat, crenelMat = null, topMat = null, gateGaps = [] } = {}) {
  const group = new THREE.Group();
  const hw = width / 2;
  const hd = depth / 2;
  const corners = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    // gateGaps: [{ x, z, r }] 在墙上留出门洞（简化：门楼会盖住）
    group.add(
      buildCrenellatedWall({
        from: [a[0], y, a[1]],
        to: [b[0], y, b[1]],
        height,
        thickness,
        mat,
        crenelMat,
        topMat,
      }),
    );
  }
  // 四角角台
  for (const [x, z] of corners) {
    group.add(box(thickness * 2.6, height * 1.15, thickness * 2.6, mat, { x, y: y + height * 0.575, z }));
  }
  return group;
}

/**
 * 四合院 / 一般房屋：屋身盒 + 屋顶（由调用方给屋顶 Group，或直接用硬山顶）。
 * 这里只提供屋身，屋顶交给 lib/roof.js，保持建筑语法统一。
 */
export function buildHouseBody({ width, depth, height, mat, y = 0, x = 0, z = 0, rotY = 0 } = {}) {
  const g = new THREE.Group();
  g.add(box(width, height, depth, mat, { y: height / 2 }));
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  return g;
}

/**
 * 城墙门楼 / 一般城台：一个厚重的梯形台身（下宽上窄）。
 */
export function buildGateBase({ width, depth, height, mat, y = 0 } = {}) {
  const shape = new THREE.Shape();
  const taper = Math.min(width, depth) * 0.02;
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2 - taper, height);
  shape.lineTo(-width / 2 + taper, height);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = y;
  return mesh;
}

/**
 * 桥：沿 X 方向的一段桥面 + 栏杆柱。拱券由调用方补。
 */
export function buildBridgeDeck({ length, width, y = 0, thickness = 0.05, mat, posts = true, postMat = null, spacing = 0.5 } = {}) {
  const g = new THREE.Group();
  g.add(box(length, thickness, width, mat, { y }));
  if (posts) {
    const railGeo = new THREE.BoxGeometry(spacing * 0.16, 0.12, spacing * 0.16);
    const count = Math.max(2, Math.floor(length / spacing));
    for (const side of [-1, 1]) {
      const inst = new THREE.InstancedMesh(railGeo, postMat || mat, count);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < count; i++) {
        const x = -length / 2 + (i + 0.5) * (length / count);
        m4.makeTranslation(x, y + 0.06, (side * width) / 2);
        inst.setMatrixAt(i, m4);
      }
      inst.instanceMatrix.needsUpdate = true;
      g.add(inst);
    }
  }
  return g;
}

/** 圆柱阵列（柱廊 / 栏杆柱用）。 */
export function buildColumnRow({ count, spacing, radius, height, mat, axis = 'x', y = 0 } = {}) {
  const geo = new THREE.CylinderGeometry(radius, radius * 1.05, height, 8);
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const t = (i - (count - 1) / 2) * spacing;
    m4.makeTranslation(axis === 'x' ? t : 0, y + height / 2, axis === 'z' ? t : 0);
    inst.setMatrixAt(i, m4);
  }
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

/** 简单的小亭子：柱 + 攒尖顶（屋顶由 roof.js 生成后塞进来）。 */
export function buildPavilionFrame({ size = 1, height = 1, mat } = {}) {
  const g = new THREE.Group();
  const r = size * 0.035;
  const corners = [
    [-size / 2, -size / 2],
    [size / 2, -size / 2],
    [size / 2, size / 2],
    [-size / 2, size / 2],
  ];
  for (const [x, z] of corners) g.add(column({ x, z, radius: r, height, mat }));
  return g;
}
