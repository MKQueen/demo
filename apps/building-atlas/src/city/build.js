/**
 * city/build.js —— 把归一化街区数据构造成 THREE 对象
 *
 * 设计要点（契约 §3）：
 *  - 白模全部合并成 1 个 mesh（极端情况下最多 4 个），draw call 1–4；
 *  - 路网按 4 档 class 各合并成 1 个 ribbon mesh（贴地、不 z-fight）；
 *  - 绿地 / 水系 / 地块底色各合并成 1 个 mesh；
 *  - 地块 site 图层 = 半透明填充 + 金色描边（#c7b58f / #f4b35b 视觉语言）；
 *  - 距离环 rings 用自绘虚线 LineSegments；
 *  - 不每帧重建 geometry。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** 贴地高度：从下到上依次 landuse < site < roads，彼此留出 ~1cm 以上高差避免 z-fight */
export const Y = {
  landuseBuilt: 0.02,
  landuseGreen: 0.032,
  landuseWater: 0.044,
  // 地块高亮层：主工程 site-dressing 的环带铺装标高 0.16、路缘石顶 0.36，
  // 若贴近地面会被完全遮住；因此地块填充/描边浮在铺装之上（对无 dressing 的 preview / fallback 也无副作用）。
  siteFill: 0.37,
  siteLine: 0.41,
  rings: 0.24,
  roads: [0.2, 0.17, 0.14, 0.11],
};

const MAX_BUILDING_DRAWS = 4;

function makeMesh(geometry, material, name) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

function makeGroup(name) {
  const group = new THREE.Group();
  group.name = name;
  return group;
}

/* ------------------------------- 白模 ---------------------------------- */

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 近白偏冷灰顶点色：按高度 3 档，墙底略暗、屋顶略亮（契约 §2.2） */
function writeHeightColors(positions, normals, colors, offset, jitter = 1) {
  for (let i = 0, n = positions.count; i < n; i += 1) {
    const y = positions.getY(i);
    const roof = normals ? normals.getY(i) > 0.55 : false;
    let r;
    let g;
    let b;
    if (y > 60) { r = 0.9; g = 0.925; b = 0.95; } else if (y > 26) { r = 0.845; g = 0.875; b = 0.905; } else { r = 0.78; g = 0.82; b = 0.855; }
    const wall = (0.8 + 0.2 * clamp01(y / 55)) * jitter;
    const k = roof ? wall * 1.07 : wall;
    const o = (offset + i) * 3;
    colors[o] = r * k;
    colors[o + 1] = g * k;
    colors[o + 2] = b * k;
  }
}

function ensureFloatColor(geometry) {
  const existing = geometry.attributes.color;
  if (!existing) {
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    writeHeightColors(geometry.attributes.position, geometry.attributes.normal, colors, 0);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return;
  }
  if (existing.array instanceof Float32Array && !existing.normalized) return;
  const count = existing.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = existing.getX(i);
    colors[i * 3 + 1] = existing.getY(i);
    colors[i * 3 + 2] = existing.getZ(i);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function stripToBuildingAttributes(geometry) {
  const keep = new Set(['position', 'normal', 'color']);
  for (const name of Object.keys(geometry.attributes)) {
    if (!keep.has(name)) geometry.deleteAttribute(name);
  }
  if (geometry.morphAttributes) geometry.morphAttributes = {};
  geometry.groups = [];
}

/** 合并（拼接）若干非索引 geometry 为一个 position/normal/color 单 mesh 几何 */
function concatBuildingGeometries(geometries) {
  let total = 0;
  for (const g of geometries) total += g.attributes.position.count;
  const positions = new Float32Array(total * 3);
  const normals = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  let offset = 0;
  for (const g of geometries) {
    const p = g.attributes.position;
    positions.set(p.array, offset * 3);
    const n = g.attributes.normal;
    if (n) normals.set(n.array, offset * 3);
    else normals.fill(1, offset * 3, (offset + p.count) * 3);
    const c = g.attributes.color;
    if (c) colors.set(c.array, offset * 3);
    else colors.fill(0.8, offset * 3, (offset + p.count) * 3);
    offset += p.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/**
 * 载入的 GLB 白模 → 合并 mesh。顶点已是 x=east / y=up / z=-north，
 * 这里只烘焙节点矩阵，不添加任何旋转/缩放（契约 §1）。
 * @returns {{object: THREE.Object3D, triangles: number, merged: boolean}|null}
 */
export function buildGlbWhiteModels(root, material) {
  if (!root) return null;
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse((object) => {
    if (object.isMesh && object.geometry && object.geometry.attributes && object.geometry.attributes.position) {
      meshes.push(object);
    }
  });
  if (!meshes.length) return null;
  const geometries = [];
  for (const mesh of meshes) {
    if (!mesh.geometry.attributes.position.count) continue;
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    stripToBuildingAttributes(geometry);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    ensureFloatColor(geometry);
    geometries.push(geometry);
  }
  if (!geometries.length) return null;

  const group = makeGroup('city-white-models');
  let triangles = 0;
  if (geometries.length === 1) {
    // 数据产物通常已是单 mesh：直接使用，零拷贝
    const geometry = geometries[0];
    geometry.computeBoundingSphere();
    triangles = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
    group.add(makeMesh(geometry, material, 'city-buildings'));
    return { object: group, triangles, merged: true };
  }

  const nonIndexed = geometries.map((geometry) => {
    if (geometry.index) {
      const g = geometry.toNonIndexed();
      geometry.dispose();
      return g;
    }
    return geometry;
  });

  if (nonIndexed.length <= MAX_BUILDING_DRAWS) {
    // 少量 primitive：直接使用，避免一次大合并的开销
    for (let i = 0; i < nonIndexed.length; i += 1) {
      const geometry = nonIndexed[i];
      geometry.computeBoundingSphere();
      triangles += geometry.attributes.position.count / 3;
      group.add(makeMesh(geometry, material, `city-buildings-${i}`));
    }
    return { object: group, triangles, merged: false };
  }

  const mergedGeometry = concatBuildingGeometries(nonIndexed);
  for (const geometry of nonIndexed) geometry.dispose();
  triangles = mergedGeometry.attributes.position.count / 3;
  group.add(makeMesh(mergedGeometry, material, 'city-buildings'));
  return { object: group, triangles, merged: true };
}

/** fallback：9 个低模街区（主楼 + 顶部小体量），近白冷灰顶点色，单 mesh */
export function buildFallbackWhiteModels(masses, material) {
  const group = makeGroup('city-white-models');
  if (!Array.isArray(masses) || !masses.length) return { object: group, triangles: 0, merged: true };
  const geometries = [];
  masses.forEach((mass, index) => {
    const height = Math.max(2, mass.h || 12);
    const baseY = Number.isFinite(mass.baseY) ? mass.baseY : 0;
    const geometry = new THREE.BoxGeometry(Math.max(2, mass.w), height, Math.max(2, mass.d));
    geometry.translate(mass.x, baseY + height / 2, mass.z);
    ensureFloatColor(geometry);
    // 每栋楼轻微确定性色差，避免完全一样
    const jitter = 0.96 + ((index * 37) % 7) * 0.011;
    const colors = geometry.attributes.color.array;
    for (let i = 0; i < colors.length; i += 1) colors[i] *= jitter;
    if (geometry.index) {
      const nonIndexed = geometry.toNonIndexed();
      geometry.dispose();
      geometries.push(nonIndexed);
    } else {
      geometries.push(geometry);
    }
  });
  const merged = concatBuildingGeometries(geometries);
  for (const geometry of geometries) geometry.dispose();
  const mesh = makeMesh(merged, material, 'city-buildings-fallback');
  group.add(mesh);
  return { object: group, triangles: merged.attributes.position.count / 3, merged: true };
}

export function makeBuildingMaterial() {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    metalness: 0.02,
    roughness: 0.85,
    flatShading: false,
    side: THREE.FrontSide,
    envMapIntensity: 0.7,
  });
  material.name = 'city-buildings';
  return material;
}

/* ------------------------------- 路网 ---------------------------------- */

/** 折线 → 带宽度的 ribbon（三角化到单个 position buffer），带 miter 修正 */
function appendRibbon(out, points, width, y) {
  const n = points.length;
  if (n < 2) return 0;
  const half = Math.max(0.5, width) / 2;
  const dirs = new Array(n - 1);
  for (let i = 0; i < n - 1; i += 1) {
    const dx = points[i + 1][0] - points[i][0];
    const dz = points[i + 1][1] - points[i][1];
    const len = Math.hypot(dx, dz);
    dirs[i] = len > 1e-4 ? [dx / len, dz / len] : null;
  }
  const offsets = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const prev = i > 0 ? dirs[i - 1] : null;
    const next = i < n - 1 ? dirs[i] : null;
    let nx;
    let nz;
    let scale = half;
    const p1 = prev ? [-prev[1], prev[0]] : null;
    const p2 = next ? [-next[1], next[0]] : null;
    if (p1 && p2) {
      nx = p1[0] + p2[0];
      nz = p1[1] + p2[1];
      const len = Math.hypot(nx, nz);
      if (len > 1e-3) {
        nx /= len;
        nz /= len;
        const denom = Math.max(0.4, nx * p1[0] + nz * p1[1]);
        scale = Math.min(half / denom, half * 2.6);
      } else {
        nx = p1[0];
        nz = p1[1];
      }
    } else if (p1 || p2) {
      const p = p1 || p2;
      nx = p[0];
      nz = p[1];
    } else {
      offsets[i] = null;
      continue;
    }
    offsets[i] = [nx * scale, nz * scale];
  }
  let triangles = 0;
  for (let i = 0; i < n - 1; i += 1) {
    const a = offsets[i];
    const b = offsets[i + 1];
    if (!a || !b) continue;
    const [x0, z0] = points[i];
    const [x1, z1] = points[i + 1];
    const l0x = x0 + a[0]; const l0z = z0 + a[1];
    const r0x = x0 - a[0]; const r0z = z0 - a[1];
    const l1x = x1 + b[0]; const l1z = z1 + b[1];
    const r1x = x1 - b[0]; const r1z = z1 - b[1];
    out.push(
      l0x, y, l0z, r0x, y, r0z, r1x, y, r1z,
      l0x, y, l0z, r1x, y, r1z, l1x, y, l1z,
    );
    triangles += 2;
  }
  return triangles;
}

/**
 * 路网：按 4 档 class 合并为 4 个 ribbon mesh（干路最宽最亮）。
 * @returns {{group, materials: THREE.Material[], triangles: number, counts: number[]}}
 */
export function buildRoads(roads) {
  const group = makeGroup('city-roads');
  const materials = [];
  const counts = [0, 0, 0, 0];
  let triangles = 0;
  for (let tier = 0; tier < 4; tier += 1) {
    const positions = [];
    for (const road of roads) {
      if (road.tier !== tier) continue;
      const tri = appendRibbon(positions, road.points, road.width, Y.roads[tier]);
      if (tri > 0) {
        triangles += tri;
        counts[tier] += 1;
      }
    }
    if (!positions.length) { materials.push(null); continue; }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
    const material = new THREE.MeshBasicMaterial({
      color: 0x808d98,
      side: THREE.DoubleSide,
      fog: true,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -(tier + 2),
      polygonOffsetUnits: -(tier + 2) * 2,
    });
    material.name = `city-roads-${tier}`;
    group.add(makeMesh(geometry, material, `city-roads-${tier}`));
    materials.push(material);
  }
  return { group, materials, triangles, counts };
}

/* ------------------------------ 绿地水系 ------------------------------- */

/** 多边形 rings（外层 + 洞）→ XZ 平面 ShapeGeometry */
function polygonGeometry(rings) {
  if (!Array.isArray(rings) || !rings.length || !Array.isArray(rings[0]) || rings[0].length < 3) return null;
  try {
    const outer = rings[0].map(([x, z]) => new THREE.Vector2(x, -z));
    if (outer.length < 3) return null;
    const shape = new THREE.Shape(outer);
    for (let i = 1; i < rings.length; i += 1) {
      const ring = rings[i];
      if (!Array.isArray(ring) || ring.length < 3) continue;
      shape.holes.push(new THREE.Path(ring.map(([x, z]) => new THREE.Vector2(x, -z))));
    }
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    geometry.deleteAttribute('uv');
    return geometry;
  } catch {
    return null;
  }
}

/**
 * 绿地 / 水系 / 地块底色：每类合并成一个贴地 mesh（共 3 个 draw call）。
 */
export function buildLanduse(landuse) {
  const group = makeGroup('city-landuse');
  const buckets = { built: [], green: [], water: [] };
  for (const area of landuse) {
    if (!area || !area.rings) continue;
    const key = area.kind === 'water' ? 'water' : area.kind === 'green' ? 'green' : 'built';
    const geometry = polygonGeometry(area.rings);
    if (geometry) buckets[key].push(geometry);
  }
  const defs = [
    {
      key: 'built', color: 0x22333d, roughness: 1, metalness: 0, y: Y.landuseBuilt, offset: -1,
    },
    {
      key: 'green', color: 0x33493d, roughness: 1, metalness: 0, y: Y.landuseGreen, offset: -2,
    },
    {
      key: 'water', color: 0x1e3d4a, roughness: 0.22, metalness: 0.4, y: Y.landuseWater, offset: -3,
    },
  ];
  const materials = {};
  let triangles = 0;
  for (const def of defs) {
    const geometries = buckets[def.key];
    if (!geometries.length) { materials[def.key] = null; continue; }
    let geometry = geometries.length === 1 ? geometries[0] : null;
    if (!geometry) {
      try {
        geometry = mergeGeometries(geometries, false);
      } catch {
        geometry = null;
      }
    }
    for (const g of geometries) {
      if (g !== geometry) g.dispose();
    }
    if (!geometry) { materials[def.key] = null; continue; }
    geometry.translate(0, def.y, 0);
    geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({
      color: def.color,
      roughness: def.roughness,
      metalness: def.metalness,
      transparent: def.key === 'water',
      opacity: def.key === 'water' ? 0.94 : 1,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: def.offset,
      polygonOffsetUnits: def.offset,
    });
    material.name = `city-landuse-${def.key}`;
    const mesh = makeMesh(geometry, material, `city-landuse-${def.key}`);
    mesh.renderOrder = 1;
    group.add(mesh);
    materials[def.key] = material;
    triangles += geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
  }
  return { group, materials, triangles };
}

/* ------------------------------- 地块 ---------------------------------- */

function ringSegments(positions, ring, y, scale = 1) {
  if (!Array.isArray(ring) || ring.length < 3) return;
  const n = ring.length;
  if (scale !== 1) {
    let cx = 0;
    let cz = 0;
    for (const [x, z] of ring) { cx += x; cz += z; }
    cx /= n; cz /= n;
    ring = ring.map(([x, z]) => [cx + (x - cx) * scale, cz + (z - cz) * scale]);
  }
  for (let i = 0; i < n; i += 1) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[(i + 1) % n];
    positions.push(x1, y, z1, x2, y, z2);
  }
}

/**
 * 地块图层：半透明金色填充 + 金色描边（site 亮金、tower 暗金、courtyard 灰绿）。
 */
export function buildSite(site) {
  const group = makeGroup('city-site');
  const fillGeometries = [];
  const glowPositions = [];
  const linePositions = [];
  const lineColors = [];
  const towerColor = new THREE.Color(0xc7b58f);
  const siteColor = new THREE.Color(0xf4b35b);
  const courtyardColor = new THREE.Color(0x9fae9a);
  const pushLineColor = (color, dim = 1) => {
    lineColors.push(color.r * dim, color.g * dim, color.b * dim);
  };
  for (const feature of site) {
    if (!feature || !feature.rings) continue;
    const color = feature.kind === 'tower' ? towerColor : feature.kind === 'courtyard' ? courtyardColor : siteColor;
    const geometry = polygonGeometry(feature.rings);
    if (geometry) fillGeometries.push(geometry);
    for (const ring of feature.rings) {
      // 主描边
      const before = linePositions.length;
      ringSegments(linePositions, ring, Y.siteLine);
      const added = (linePositions.length - before) / 2;
      for (let i = 0; i < added; i += 1) pushLineColor(color, 1);
      // 外扩一点点的光晕描边（site 专属）
      if (feature.kind === 'site') {
        const beforeHalo = linePositions.length;
        ringSegments(linePositions, ring, Y.siteLine - 0.004, 1.02);
        const addedHalo = (linePositions.length - beforeHalo) / 2;
        for (let i = 0; i < addedHalo; i += 1) pushLineColor(color, 0.32);
        // 贴地发光带：1px 线在远处太细，用约 3m 宽的半透明金色 ribbon 补足「发光感」
        appendRibbon(glowPositions, ring.concat([ring[0]]), 3.2, Y.siteLine - 0.008);
      }
    }
  }
  let fillMaterial = null;
  let lineMaterial = null;
  let glowMaterial = null;
  let triangles = 0;
  if (fillGeometries.length) {
    let geometry = null;
    try {
      geometry = fillGeometries.length === 1 ? fillGeometries[0] : mergeGeometries(fillGeometries, false);
    } catch {
      geometry = null;
    }
    for (const g of fillGeometries) {
      if (g !== geometry) g.dispose();
    }
    if (geometry) {
      geometry.translate(0, Y.siteFill, 0);
      geometry.computeBoundingSphere();
      fillMaterial = new THREE.MeshBasicMaterial({
        color: 0xc7b58f,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -5,
      });
      fillMaterial.name = 'city-site-fill';
      const mesh = makeMesh(geometry, fillMaterial, 'city-site-fill');
      mesh.renderOrder = 2;
      group.add(mesh);
      triangles += geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
    }
  }
  if (linePositions.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
    geometry.computeBoundingSphere();
    lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -8,
    });
    lineMaterial.name = 'city-site-line';
    const lines = new THREE.LineSegments(geometry, lineMaterial);
    lines.name = 'city-site-line';
    lines.renderOrder = 3;
    group.add(lines);
  }
  if (glowPositions.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(glowPositions, 3));
    geometry.computeBoundingSphere();
    glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xc7b58f,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -7,
    });
    glowMaterial.name = 'city-site-glow';
    const mesh = makeMesh(geometry, glowMaterial, 'city-site-glow');
    mesh.renderOrder = 2;
    group.add(mesh);
    triangles += geometry.attributes.position.count / 3;
  }
  return {
    group, fillMaterial, lineMaterial, glowMaterial, triangles,
  };
}

/* ------------------------------ 距离环 --------------------------------- */

export function buildRings(radii = [200, 500, 1000]) {
  const group = makeGroup('city-rings');
  const positions = [];
  const width = 2.8;
  const half = width / 2;
  for (const radius of radii) {
    const circumference = Math.PI * 2 * radius;
    const dashes = Math.max(24, Math.round(circumference / 22));
    const step = (Math.PI * 2) / dashes;
    const dashFraction = 0.55;
    const segmentsPerDash = radius >= 600 ? 4 : 3;
    const point = (angle, r) => [Math.cos(angle) * r, Y.rings, -Math.sin(angle) * r];
    for (let d = 0; d < dashes; d += 1) {
      const start = d * step;
      const end = start + step * dashFraction;
      for (let s = 0; s < segmentsPerDash; s += 1) {
        const a0 = start + ((end - start) * s) / segmentsPerDash;
        const a1 = start + ((end - start) * (s + 1)) / segmentsPerDash;
        const inner0 = point(a0, radius - half);
        const outer0 = point(a0, radius + half);
        const inner1 = point(a1, radius - half);
        const outer1 = point(a1, radius + half);
        positions.push(
          ...inner0, ...outer0, ...outer1,
          ...inner0, ...outer1, ...inner1,
        );
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  const material = new THREE.MeshBasicMaterial({
    color: 0xc7b58f,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -8,
    polygonOffsetUnits: -10,
  });
  material.name = 'city-rings';
  const mesh = makeMesh(geometry, material, 'city-rings');
  mesh.renderOrder = 1;
  group.add(mesh);
  return { group, material };
}

/* ------------------------------ 工具函数 ------------------------------- */

export function countTriangles(root) {
  let triangles = 0;
  root.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    const geometry = object.geometry;
    const index = geometry.index;
    if (index) triangles += index.count / 3;
    else if (geometry.attributes.position) triangles += geometry.attributes.position.count / 3;
  });
  return Math.round(triangles);
}

/** 统计可见 draw call（Mesh / Line / Points / Sprite 各算一次，跳过隐藏子树） */
export function countDrawCalls(root) {
  let calls = 0;
  const visit = (object) => {
    if (!object || !object.visible) return;
    if (object.isMesh || object.isLine || object.isPoints || object.isSprite) calls += 1;
    for (const child of object.children) visit(child);
  };
  visit(root);
  return calls;
}

export function disposeObject3D(root) {
  if (!root) return;
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    const material = object.material;
    if (Array.isArray(material)) material.forEach((m) => materials.add(m));
    else if (material) materials.add(material);
  });
  for (const material of materials) {
    for (const key of Object.keys(material)) {
      const value = material[key];
      if (value && value.isTexture) value.dispose();
    }
    material.dispose();
  }
}
