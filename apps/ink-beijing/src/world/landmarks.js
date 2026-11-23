/**
 * landmarks.js —— 外围地标（负责：地标模块）。
 *
 * 契约：export function buildLandmarks(ctx) → THREE.Group。
 *
 * 内容：天坛（祈年殿/圜丘/皇穹宇/丹陛桥/柏树林）、北海（琼华岛白塔/永安寺/
 * 堆云积翠桥）、颐和园（万寿山台地/佛香阁/排云殿/长廊/十七孔桥/南湖岛）、
 * 长城（沿山脊的城墙 + 烽火台）、卢沟桥（11 孔石桥 + 石狮/华表 + 宛平城）。
 *
 * 做法：
 *   1. 所有坐标都来自 layout.js（anchor / 湖面多边形 / 河道折线 / terrainHeight）；
 *   2. 屋顶一律用 lib/roof.js 的生成器，绝不自己拼瓦面；
 *   3. 材质只取 ctx.mats；
 *   4. 为了压 draw call：所有静态小几何按「材质 + 顶点属性布局」合并成单个 mesh，
 *      栏杆柱/垛口等重复构件走 InstancedMesh；
 *   5. 树全部交给 lib/flora.js（全场景统一笔触，不在这里自己画圆锥）。
 */
import * as THREE from 'three';
import {
  u,
  h,
  LAKES,
  CANALS,
  RIVERS,
  GREAT_WALL,
  LANDMARK_BY_ID,
  terrainHeight,
  WATER_Y,
  blobPolygon,
} from '../layout.js';
import { buildHipRoof, buildGableRoof, buildRoundRoof, buildDoubleEave } from '../lib/roof.js';
import { mergeGeoms, buildCrenellatedWall } from '../lib/geometry.js';
import { buildTrees } from '../lib/flora.js';
import { makeRng } from '../lib/rand.js';

const TAU = Math.PI * 2;
const _Q = new THREE.Quaternion();
const _E = new THREE.Euler();
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** 共享的单位几何：InstancedMesh 用，靠矩阵缩放成实际尺寸。 */
const UNIT = {
  box: new THREE.BoxGeometry(1, 1, 1),
};

function composeMatrix(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  _E.set(rx, ry, rz);
  _Q.setFromEuler(_E);
  return new THREE.Matrix4().compose(V(x, y, z), _Q, V(sx, sy, sz));
}

/* -------------------------------------------------------------------------- */
/*  批处理器：静态几何按材质合并，重复构件实例化                                  */
/* -------------------------------------------------------------------------- */

function makeKit() {
  /** @type {Map<string,{mat:THREE.Material,geos:THREE.BufferGeometry[]}>} */
  const batches = new Map();
  /** @type {Map<string,{geo:THREE.BufferGeometry,mat:THREE.Material,ms:THREE.Matrix4[]}>} */
  const insts = new Map();

  const attrKey = (g) => {
    const k = Object.keys(g.attributes).sort();
    return k.join(',') + '|' + (g.index ? 'i' : 'n');
  };

  function addGeo(geo, mat) {
    if (!geo || !mat) return;
    const key = mat.uuid + '|' + attrKey(geo);
    let b = batches.get(key);
    if (!b) {
      b = { mat, geos: [] };
      batches.set(key, b);
    }
    b.geos.push(geo);
  }

  function addInst(key, geo, mat, m) {
    if (!geo || !mat) return;
    let it = insts.get(key);
    if (!it) {
      it = { geo, mat, ms: [] };
      insts.set(key, it);
    }
    it.ms.push(m.clone());
  }

  function put(geo, mat, m) {
    if (m) geo.applyMatrix4(m);
    addGeo(geo, mat);
    return geo;
  }

  const kit = {
    addGeo,
    addInst,
    put,
    composeMatrix,

    box(w, hh, d, mat, x = 0, y = 0, z = 0, ry = 0) {
      return put(new THREE.BoxGeometry(w, hh, d), mat, composeMatrix(x, y, z, ry));
    },
    cyl(rTop, rBot, hh, seg, mat, x = 0, y = 0, z = 0, ry = 0, open = false) {
      return put(new THREE.CylinderGeometry(rTop, rBot, hh, seg, 1, open), mat, composeMatrix(x, y, z, ry));
    },
    ring(r, hh, seg, mat, x = 0, y = 0, z = 0) {
      return put(new THREE.CylinderGeometry(r, r, hh, seg, 1, true), mat, composeMatrix(x, y, z));
    },
    sphere(r, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
      return put(new THREE.SphereGeometry(r, 10, 8), mat, composeMatrix(x, y, z, 0, sx, sy, sz));
    },
    /** 半球穹顶（覆钵 / 宝顶用）：底圆半径 r，高度由 sy 拉伸。 */
    dome(r, mat, x = 0, y = 0, z = 0, sy = 1) {
      const geo = new THREE.SphereGeometry(r, 14, 8, 0, TAU, 0, Math.PI / 2);
      return put(geo, mat, composeMatrix(x, y, z, 0, 1, sy, 1));
    },
    cone(r, hh, seg, mat, x = 0, y = 0, z = 0, ry = 0) {
      return put(new THREE.ConeGeometry(r, hh, seg), mat, composeMatrix(x, y, z, ry));
    },
    inst(key, geo, mat, m) {
      addInst(key, geo, mat, m);
    },

    /**
     * 把一个现成的 Group（屋顶、桥、城墙段…）里的网格按世界坐标烘进批处理。
     * 这样屋顶生成器里那一堆小梁、檐口板也能被合并掉。
     */
    bake(obj, t = {}) {
      obj.position.set(t.x || 0, t.y || 0, t.z || 0);
      obj.rotation.set(t.rx || 0, t.ry || 0, 0);
      obj.updateMatrixWorld(true);
      const tmp = new THREE.Matrix4();
      obj.traverse((o) => {
        if (!o.isMesh) return;
        if (o.isInstancedMesh) {
          const key = `inst|${o.material.uuid}|${o.geometry.type}|${JSON.stringify(o.geometry.parameters || {})}`;
          for (let i = 0; i < o.count; i++) {
            o.getMatrixAt(i, tmp);
            tmp.premultiply(o.matrixWorld);
            addInst(key, o.geometry, o.material, tmp);
          }
          return;
        }
        const g = o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);
        addGeo(g, o.material);
      });
      return obj;
    },

    flush(parent) {
      for (const b of batches.values()) {
        const geo = b.geos.length === 1 ? b.geos[0] : mergeGeoms(b.geos);
        if (!geo || !geo.attributes || !geo.attributes.position) continue;
        const mesh = new THREE.Mesh(geo, b.mat);
        mesh.frustumCulled = false;
        parent.add(mesh);
      }
      for (const it of insts.values()) {
        if (!it.ms.length) continue;
        const im = new THREE.InstancedMesh(it.geo, it.mat, it.ms.length);
        for (let i = 0; i < it.ms.length; i++) im.setMatrixAt(i, it.ms[i]);
        im.instanceMatrix.needsUpdate = true;
        im.frustumCulled = false;
        parent.add(im);
      }
    },
  };
  return kit;
}

/* -------------------------------------------------------------------------- */
/*  通用零件                                                                    */
/* -------------------------------------------------------------------------- */

/** 台阶：原点在内侧（高的一端），局部 +z 朝外（下坡）。 */
function addStairs(kit, { x, z, y0 = 0, ry = 0, width, height, depth, steps = 5, mat }) {
  const stepH = height / steps;
  const stepD = depth / steps;
  const sin = Math.sin(ry);
  const cos = Math.cos(ry);
  for (let i = 0; i < steps; i++) {
    const hh = height - stepH * i;
    const zd = stepD * (i + 0.5);
    kit.box(width, hh, stepD, mat, x + sin * zd, y0 + hh / 2, z + cos * zd, ry);
  }
}

/** 圆形栏杆：一圈压面石 + 一圈望柱。 */
function circularRail(kit, { x, z, r, y, count = 24, mat }) {
  kit.ring(r, 0.045, Math.max(18, count), mat, x, y + 0.022, z);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    kit.inst(
      'rail-post',
      UNIT.box,
      mat,
      composeMatrix(x + Math.cos(a) * r, y + 0.055, z + Math.sin(a) * r, 0, 0.028, 0.11, 0.028),
    );
  }
}

/** 圆形三级台（祈谷坛 / 圜丘坛）：每层压面 + 栏杆，四面台阶。 */
function circularTerrace(kit, { x, z, y0 = 0, levels, mat, railMat, stairs = true, stairSteps = 6 }) {
  let y = y0;
  const tiers = [];
  for (const lv of levels) {
    kit.cyl(lv.r, lv.r + 0.03, lv.h, 24, mat, x, y + lv.h / 2, z);
    y += lv.h;
    tiers.push({ r: lv.r, y });
  }
  for (const t of tiers) {
    circularRail(kit, { x, z, r: t.r - 0.05, y: t.y, count: Math.max(18, Math.round(t.r * 36)), mat: railMat || mat });
  }
  if (stairs) {
    const H = y - y0;
    const r0 = levels[0].r + 0.02;
    for (const [dx, dz, ry] of [
      [0, 1, 0],
      [0, -1, Math.PI],
      [1, 0, Math.PI / 2],
      [-1, 0, -Math.PI / 2],
    ]) {
      addStairs(kit, {
        x: x + dx * r0,
        z: z + dz * r0,
        y0,
        ry,
        width: Math.min(0.6, r0 * 0.72),
        height: H,
        depth: 0.66,
        steps: stairSteps,
        mat,
      });
    }
  }
  return y;
}

/** 矩形栏杆（殿前台基）。 */
function rectRail(kit, { x, z, w, d, y, mat, spacing = 0.34 }) {
  const edges = [
    [-w / 2, -d / 2, w / 2, -d / 2],
    [w / 2, -d / 2, w / 2, d / 2],
    [w / 2, d / 2, -w / 2, d / 2],
    [-w / 2, d / 2, -w / 2, -d / 2],
  ];
  for (const [x1, z1, x2, z2] of edges) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const n = Math.max(2, Math.round(len / spacing));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      kit.inst(
        'rail-post',
        UNIT.box,
        mat,
        composeMatrix(x + x1 + dx * t, y + 0.055, z + z1 + dz * t, 0, 0.028, 0.11, 0.028),
      );
    }
    const ry = Math.atan2(-dz, dx);
    kit.box(len, 0.04, 0.05, mat, x + (x1 + x2) / 2, y + 0.045, z + (z1 + z2) / 2, ry);
  }
}

/** 多边形 → Shape（局部坐标，绕中心）。 */
function shapeFromPolygon(points, cx, cz, scale = 1) {
  const s = new THREE.Shape();
  const pts = points.map(([px, pz]) => new THREE.Vector2((px - cx) * scale, -(pz - cz) * scale));
  s.moveTo(pts[0].x, pts[0].y);
  // 用样条把折点连成圆滑的岸线（不要生硬的直角）
  s.splineThru(pts.slice(1).concat([pts[0]]));
  s.closePath();
  return s;
}

/** 一个平铺在地面的多边形面片（岛顶草地）。 */
function flatPolygon(kit, points, cx, cz, y, mat, scale = 1) {
  const geo = new THREE.ShapeGeometry(shapeFromPolygon(points, cx, cz, scale));
  geo.rotateX(-Math.PI / 2);
  geo.translate(cx, y, cz);
  kit.addGeo(geo, mat);
}

/** 圆角小岛：圆柱台 + 草地顶。 */
function moundIsland(kit, M, { x, z, r, topY, mat }) {
  kit.cyl(r * 0.94, r, topY - (WATER_Y - 0.5), 20, mat, x, (topY + WATER_Y - 0.5) / 2, z);
  kit.cyl(r * 0.92, r * 0.92, 0.02, 20, M.grass, x, topY + 0.005, z);
}

/** 多边形岛：挤出体 + 草地顶。 */
function polygonIsland(kit, M, { points, cx, cz, topY, mat }) {
  const depth = 0.95;
  const geo = new THREE.ExtrudeGeometry(shapeFromPolygon(points, cx, cz, 1), {
    depth,
    bevelEnabled: false,
    curveSegments: 4,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(cx, topY - depth, cz);
  kit.addGeo(geo, mat);
  flatPolygon(kit, points, cx, cz, topY + 0.006, M.grass, 0.965);
}

/**
 * 石拱桥：局部坐标里桥沿 x 轴、y=0 是水面、桥宽沿 z。
 * 返回 Group，调用方用 kit.bake(group, {x, y: WATER_Y, z, ry}) 落到世界。
 */
function archBridgeGroup(o) {
  const {
    length,
    width,
    height,
    arches,
    archR,
    mat,
    railMat,
    ringMat = null,
    deckMat = null,
    lion = false,
    lionMat = null,
    lionEvery = 1,
    inkRing = true,
  } = o;
  const g = new THREE.Group();
  const L = length;
  const W = width;
  const H = height;
  const shape = new THREE.Shape();
  shape.moveTo(-L / 2, -0.4);
  shape.lineTo(L / 2, -0.4);
  shape.lineTo(L / 2, H);
  shape.lineTo(-L / 2, H);
  shape.closePath();

  const pitch = L / arches;
  for (let i = 0; i < arches; i++) {
    const cx = -L / 2 + pitch * (i + 0.5);
    const r = Math.min(archR, pitch * 0.43);
    const hole = new THREE.Path();
    hole.moveTo(cx - r, 0);
    hole.absarc(cx, 0, r, Math.PI, 0, true);
    hole.lineTo(cx - r, 0);
    shape.holes.push(hole);
    if (inkRing) {
      const rm = ringMat || mat;
      for (const side of [-1, 1]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.013, 3, 9, Math.PI), rm);
        ring.position.set(cx, 0, (side * W) / 2);
        g.add(ring);
      }
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: false, curveSegments: 5 });
  geo.translate(0, 0, -W / 2);
  g.add(new THREE.Mesh(geo, mat));

  if (deckMat) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(L, 0.035, W * 1.02), deckMat);
    deck.position.y = H + 0.018;
    g.add(deck);
  }

  if (railMat) {
    const postGeo = new THREE.BoxGeometry(0.045, 0.15, 0.045);
    const n = Math.max(2, Math.round(L / 0.34));
    const im = new THREE.InstancedMesh(postGeo, railMat, n * 2);
    const mm = new THREE.Matrix4();
    let k = 0;
    for (const side of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        const px = -L / 2 + (i + 0.5) * (L / n);
        mm.makeTranslation(px, H + 0.095, side * (W / 2 - 0.035));
        im.setMatrixAt(k++, mm);
      }
    }
    g.add(im);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.035, 0.05), railMat);
      rail.position.set(0, H + 0.155, side * (W / 2 - 0.035));
      g.add(rail);
    }
    if (lion) {
      const lg = new THREE.SphereGeometry(0.055, 6, 5);
      const step = Math.max(1, Math.round(lionEvery));
      const count = Math.floor(n / step);
      const lim = new THREE.InstancedMesh(lg, lionMat || railMat, count * 2);
      let lk = 0;
      for (const side of [-1, 1]) {
        for (let i = 0; i < n; i += step) {
          const px = -L / 2 + (i + 0.5) * (L / n);
          mm.makeTranslation(px, H + 0.235, side * (W / 2 - 0.035));
          lim.setMatrixAt(lk++, mm);
        }
      }
      g.add(lim);
    }
  }

  // 桥头缓坡：两侧各三步，把桥面落回岸边
  const rampSteps = 3;
  for (const end of [-1, 1]) {
    for (let i = 0; i < rampSteps; i++) {
      const hh = (H * (rampSteps - i)) / (rampSteps + 1);
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.24, hh, W * 0.96), mat);
      step.position.set(end * (L / 2 + 0.12 + i * 0.24), hh / 2 - 0.06, 0);
      g.add(step);
    }
  }
  return g;
}

/** 烘一层屋顶（自动带上瓦/檐/脊材质）。 */
function bakeHip(kit, M, opts, t) {
  const g = buildHipRoof({ ...opts, tileMat: opts.tileMat || M.roofTile, eaveMat: M.eave, ridgeMat: M.ridge }, M);
  kit.bake(g, t);
}

function bakeGable(kit, M, opts, t) {
  const g = buildGableRoof({ ...opts, tileMat: opts.tileMat || M.roofTile, eaveMat: M.eave, ridgeMat: M.ridge }, M);
  kit.bake(g, t);
}

/** 圆形/八角攒尖顶 + 一圈深色檐口线。 */
function bakeRound(kit, M, opts, t, { finial = false, eaveLine = true } = {}) {
  const g = buildRoundRoof({ ...opts, tileMat: opts.tileMat || M.roofGlaze }, M, { finial });
  kit.bake(g, t);
  if (eaveLine) {
    const R = (opts.radius || 0.5) + (opts.overhang ?? 0.08) + 0.006;
    kit.ring(R, 0.03, opts.segments || 20, M.eave, t.x || 0, (t.y || 0) - 0.012, t.z || 0);
  }
}

/** 金色宝顶（比 buildRoundRoof 自带的大一点，远看有光点）。 */
function addFinial(kit, M, x, y, z, s = 1) {
  kit.sphere(0.085 * s, M.gold, x, y + 0.05 * s, z);
  kit.cyl(0.02 * s, 0.055 * s, 0.16 * s, 8, M.gold, x, y + 0.16 * s, z);
  kit.sphere(0.045 * s, M.goldLight, x, y + 0.25 * s, z);
}

/** 收集树的 spec（统一交给 flora.buildTrees）。 */
function pushTree(list, kind, x, z, y, hh, extra = {}) {
  list.push({ kind, x, z, y, h: hh, ...extra });
}

/* -------------------------------------------------------------------------- */
/*  湖岸几何工具（新湖形都是有机多边形，用交点求岸线）                            */
/* -------------------------------------------------------------------------- */

/** 竖线 x=const 与多边形的交点 z（升序）。 */
function polyCrossZ(points, x) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if ((a[0] - x) * (b[0] - x) > 0) continue;
    if (Math.abs(b[0] - a[0]) < 1e-9) continue;
    const t = (x - a[0]) / (b[0] - a[0]);
    if (t < 0 || t > 1) continue;
    out.push(a[1] + (b[1] - a[1]) * t);
  }
  return out.sort((m, n) => m - n);
}

/** 水平线 z=const 与多边形的交点 x（升序）。 */
function polyCrossX(points, z) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if ((a[1] - z) * (b[1] - z) > 0) continue;
    if (Math.abs(b[1] - a[1]) < 1e-9) continue;
    const t = (z - a[1]) / (b[1] - a[1]);
    if (t < 0 || t > 1) continue;
    out.push(a[0] + (b[0] - a[0]) * t);
  }
  return out.sort((m, n) => m - n);
}

/** 给定 z，取湖东岸 x；给定 x，取湖北岸 z（找不到时返回 null）。 */
function shoreEastX(points, z) {
  const xs = polyCrossX(points, z);
  return xs.length ? xs[xs.length - 1] : null;
}
function shoreNorthZ(points, x) {
  const zs = polyCrossZ(points, x);
  return zs.length ? zs[0] : null;
}

/** 点是否在湖面多边形内。 */
function inLake(points, x, z) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0];
    const zi = points[i][1];
    const xj = points[j][0];
    const zj = points[j][1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/* -------------------------------------------------------------------------- */
/*  一、天坛                                                                    */
/* -------------------------------------------------------------------------- */

function buildTiantan(kit, M, quality, trees) {
  const anchor = LANDMARK_BY_ID.tiantan.anchor;
  const CX = anchor[0];
  const CZ = anchor[2];
  const PARK = u(1650) / 2; // 天坛公园半径（约 825m）

  const zQinian = CZ - u(400); // 祈年殿（北）
  const zHuang = CZ + u(100); // 皇穹宇（中）
  const zHuanqiu = CZ + u(425); // 圜丘坛（南）

  /* ---------- 1.1 祈谷坛 + 祈年殿（三重圆攒尖，拔高） ---------- */
  const terraceTop = circularTerrace(kit, {
    x: CX,
    z: zQinian,
    levels: [
      { r: 1.66, h: 0.13 },
      { r: 1.44, h: 0.13 },
      { r: 1.21, h: 0.13 },
    ],
    mat: M.marble,
    railMat: M.stone,
    stairSteps: 8,
  });

  const base = terraceTop;
  // 下层殿身（朱红圆柱）
  kit.cyl(0.67, 0.71, 0.68, 24, M.wallRed, CX, base + 0.34, zQinian);
  // 外圈 12 根檐柱
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    kit.cyl(0.045, 0.05, 0.68, 6, M.column, CX + Math.cos(a) * 0.71, base + 0.34, zQinian + Math.sin(a) * 0.71);
  }
  // 四门（深色）
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    kit.box(0.26, 0.46, 0.04, M.door, CX + Math.cos(a) * 0.685, base + 0.26, zQinian + Math.sin(a) * 0.685, -a - Math.PI / 2);
  }
  // 檐下金线
  kit.cyl(0.725, 0.725, 0.035, 24, M.gold, CX, base + 0.645, zQinian);

  // 三重圆攒尖顶：越往上收得越快，整体拔高
  bakeRound(
    kit,
    M,
    { radius: 0.95, height: 0.34, segments: 24, overhang: 0.075, curve: 1.5, fascia: 0.05, tileMat: M.roofGreen },
    { x: CX, y: base + 0.66, z: zQinian },
  );
  kit.cyl(0.5, 0.54, 0.34, 24, M.wallRed, CX, base + 0.99, zQinian);
  kit.ring(0.52, 0.028, 24, M.gold, CX, base + 1.14, zQinian);
  bakeRound(
    kit,
    M,
    { radius: 0.72, height: 0.32, segments: 24, overhang: 0.07, curve: 1.5, fascia: 0.05, tileMat: M.roofGreen },
    { x: CX, y: base + 1.16, z: zQinian },
  );
  kit.cyl(0.34, 0.38, 0.28, 24, M.wallRed, CX, base + 1.42, zQinian);
  bakeRound(
    kit,
    M,
    { radius: 0.53, height: 0.52, segments: 24, overhang: 0.07, curve: 1.62, fascia: 0.06, tileMat: M.roofGreen },
    { x: CX, y: base + 1.55, z: zQinian },
  );
  addFinial(kit, M, CX, base + 2.12, zQinian, 1.05);

  /* ---------- 1.2 皇穹宇 + 回音壁 ---------- */
  const hqTop = circularTerrace(kit, {
    x: CX,
    z: zHuang,
    levels: [
      { r: 0.98, h: 0.09 },
      { r: 0.82, h: 0.09 },
    ],
    mat: M.marble,
    railMat: M.stone,
    stairSteps: 4,
  });
  // 回音壁：圆形围墙
  kit.ring(1.48, 0.32, 30, M.wallGray, CX, 0.16, zHuang);
  kit.ring(1.5, 0.04, 30, M.inkMid, CX, 0.325, zHuang);
  kit.box(0.34, 0.34, 0.1, M.wallRed, CX, 0.17, zHuang + 1.5, 0); // 南门
  // 殿身 + 蓝绿琉璃圆顶
  kit.cyl(0.35, 0.38, 0.46, 20, M.wallRed, CX, hqTop + 0.23, zHuang);
  kit.cyl(0.4, 0.4, 0.035, 20, M.gold, CX, hqTop + 0.445, zHuang);
  bakeRound(
    kit,
    M,
    { radius: 0.54, height: 0.4, segments: 20, overhang: 0.07, curve: 1.55, fascia: 0.05, tileMat: M.roofGlaze },
    { x: CX, y: hqTop + 0.5, z: zHuang },
  );
  addFinial(kit, M, CX, hqTop + 0.9, zHuang, 0.72);

  /* ---------- 1.3 圜丘坛（三层圆台，无顶） ---------- */
  const hq = circularTerrace(kit, {
    x: CX,
    z: zHuanqiu,
    levels: [
      { r: 1.52, h: 0.1 },
      { r: 1.27, h: 0.1 },
      { r: 1.02, h: 0.1 },
    ],
    mat: M.marble,
    railMat: M.stone,
    stairSteps: 5,
  });
  // 天心石
  kit.cyl(0.17, 0.17, 0.03, 16, M.stoneShade, CX, hq + 0.015, zHuanqiu);
  // 四座棂星门
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const gx = CX + dx * 1.02;
    const gz = zHuanqiu + dz * 1.02;
    const ry = -a - Math.PI / 2;
    for (const side of [-1, 1]) {
      kit.box(0.045, 0.3, 0.045, M.stone, gx + Math.cos(a + Math.PI / 2) * 0.16 * side, hq + 0.15, gz + Math.sin(a + Math.PI / 2) * 0.16 * side, ry);
    }
    kit.box(0.4, 0.05, 0.06, M.stone, gx, hq + 0.32, gz, ry);
    kit.box(0.04, 0.09, 0.04, M.stoneShade, gx, hq + 0.38, gz, ry);
  }

  /* ---------- 1.4 丹陛桥（长高甬道） ---------- */
  const zBridgeA = zQinian + 2.9;
  const zBridgeB = zHuang - 1.95;
  const bridgeLen = zBridgeB - zBridgeA;
  const bridgeMid = (zBridgeA + zBridgeB) / 2;
  kit.box(0.85, 0.18, bridgeLen, M.marble, CX, 0.09, bridgeMid);
  kit.box(0.85, 0.02, bridgeLen, M.stoneShade, CX, 0.19, bridgeMid);
  for (const side of [-1, 1]) {
    kit.box(0.06, 0.13, bridgeLen, M.stone, CX + side * 0.42, 0.25, bridgeMid);
  }
  addStairs(kit, { x: CX, z: zBridgeA, y0: 0, ry: Math.PI, width: 0.8, height: 0.2, depth: 0.4, steps: 3, mat: M.marble });

  /* ---------- 1.5 神道（纸色带） ---------- */
  const path = (z1, z2, w = 1.15) => {
    kit.box(w, 0.012, Math.abs(z2 - z1), M.paperShade, CX, 0.006, (z1 + z2) / 2);
  };
  path(zHuanqiu + 1.6, CZ + PARK - 0.4, 1.05);
  path(zHuang + 1.9, zHuanqiu - 1.6, 1.0);
  path(zQinian - 2.1, CZ - PARK + 0.4, 1.0);

  /* ---------- 1.6 公园围墙 + 南北门 ---------- */
  const wallH = 0.24;
  const wallT = 0.12;
  const gate = 1.25;
  const half = PARK;
  kit.box(half - gate, wallH, wallT, M.wallGray, CX - (half + gate) / 2, wallH / 2, CZ + half);
  kit.box(half - gate, wallH, wallT, M.wallGray, CX + (half + gate) / 2, wallH / 2, CZ + half);
  kit.box(half - gate, wallH, wallT, M.wallGray, CX - (half + gate) / 2, wallH / 2, CZ - half);
  kit.box(half - gate, wallH, wallT, M.wallGray, CX + (half + gate) / 2, wallH / 2, CZ - half);
  kit.box(wallT, wallH, half * 2, M.wallGray, CX - half, wallH / 2, CZ);
  kit.box(wallT, wallH, half * 2, M.wallGray, CX + half, wallH / 2, CZ);
  for (const [x, z, w, d] of [
    [CX - (half + gate) / 2, CZ + half, half - gate, wallT],
    [CX + (half + gate) / 2, CZ + half, half - gate, wallT],
    [CX - (half + gate) / 2, CZ - half, half - gate, wallT],
    [CX + (half + gate) / 2, CZ - half, half - gate, wallT],
    [CX - half, CZ, wallT, half * 2],
    [CX + half, CZ, wallT, half * 2],
  ]) {
    kit.box(w + 0.04, 0.03, d + 0.04, M.inkMid, x, wallH + 0.015, z);
  }
  for (const [gx, gz, ry] of [
    [CX, CZ + half, 0],
    [CX, CZ - half, Math.PI],
  ]) {
    const gbase = buildHipRoof({ width: 1.9, depth: 0.85, height: 0.34, tileMat: M.roofTile, eaveMat: M.eave, ridgeMat: M.ridge }, M);
    kit.bake(gbase, { x: gx, y: 0.4, z: gz });
    kit.box(1.5, 0.4, 0.5, M.wallRed, gx, 0.2, gz);
    kit.box(0.3, 0.3, 0.06, M.inkDeep, gx, 0.15, gz + (ry === 0 ? 0.26 : -0.26));
  }

  /* ---------- 1.7 柏树林（flora pine：成簇、疏密不均） ---------- */
  const rng = makeRng(2024);
  // 先定「簇心」：轴线两侧密、外围疏
  const clusters = [];
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const z = zQinian + 1.8 + t * (CZ + PARK - 4.2 - zQinian);
    const side = i % 2 === 0 ? -1 : 1;
    clusters.push({
      x: CX + side * (2.6 + rng() * 1.7),
      z,
      r: 1.4 + rng() * 0.9,
      n: 9 + Math.floor(rng() * 10),
    });
  }
  let guard = 0;
  const clusterTarget = quality === 'low' ? 16 : 30;
  while (clusters.length < clusterTarget && guard++ < 600) {
    const a = rng() * TAU;
    const rr = 4.4 + Math.sqrt(rng()) * (PARK - 6.6);
    const x = CX + Math.cos(a) * rr;
    const z = CZ + Math.sin(a) * rr;
    if (Math.hypot(x - CX, z - zQinian) < 4.6) continue;
    if (Math.hypot(x - CX, z - zHuang) < 3.8) continue;
    if (Math.hypot(x - CX, z - zHuanqiu) < 3.6) continue;
    clusters.push({ x, z, r: 1.8 + rng() * 1.5, n: 8 + Math.floor(rng() * 13) });
  }
  // 按簇撒树
  for (const c of clusters) {
    let placed = 0;
    for (let k = 0; k < c.n * 5 && placed < c.n; k++) {
      const a = rng() * TAU;
      const rr = Math.sqrt(rng()) * c.r;
      const x = c.x + Math.cos(a) * rr;
      const z = c.z + Math.sin(a) * rr;
      if (Math.hypot(x - CX, z - zQinian) < 3.0) continue;
      if (Math.hypot(x - CX, z - zHuang) < 2.6) continue;
      if (Math.hypot(x - CX, z - zHuanqiu) < 2.6) continue;
      if (Math.abs(x - CX) < 1.5) continue; // 神道中线
      if (Math.hypot(x - CX, z - CZ) > PARK - 1.7) continue;
      placed++;
      pushTree(trees, 'pine', x, z, 0, 0.55 + rng() * 0.55);
    }
  }
  // 公园围墙内侧补一圈稀疏的，撑住轮廓
  const edgeN = quality === 'low' ? 14 : 24;
  for (let i = 0; i < edgeN; i++) {
    const a = (i / edgeN) * TAU + 0.17;
    const rr = PARK - 2.0 - rng() * 0.8;
    pushTree(trees, 'pine', CX + Math.cos(a) * rr, CZ + Math.sin(a) * rr, 0, 0.62 + rng() * 0.38);
  }
}

/* -------------------------------------------------------------------------- */
/*  二、北海（琼华岛白塔）                                                       */
/* -------------------------------------------------------------------------- */

function buildBeihai(kit, M, quality, trees) {
  const lake = LAKES.beihai;
  const LCX = lake.cx;
  const LCZ = lake.cz;
  const islandTop = WATER_Y + 0.4; // 岛面在水面之上

  // 琼华岛：落在湖心，半径约湖半径的 0.32（跟新湖形走），轮廓用 30 点小扰动多边形（圆滑）
  const islRX = lake.rx * 0.32;
  const islRZ = lake.rz * 0.32;
  const poly = blobPolygon(LCX, LCZ, islRX, islRZ, 23, 30, 0.035);
  polygonIsland(kit, M, { points: poly, cx: LCX, cz: LCZ, topY: islandTop, mat: M.inkSoft });

  // 石岸：贴水一圈深色石边（比岛略大，压住水线）
  const shorePoly = poly.map(([x, z]) => [LCX + (x - LCX) * 1.05, LCZ + (z - LCZ) * 1.05]);
  const shoreGeo = new THREE.ExtrudeGeometry(shapeFromPolygon(shorePoly, LCX, LCZ, 1), {
    depth: 0.36,
    bevelEnabled: false,
    curveSegments: 6,
  });
  shoreGeo.rotateX(-Math.PI / 2);
  shoreGeo.translate(LCX, WATER_Y + 0.11 - 0.36, LCZ);
  kit.addGeo(shoreGeo, M.inkSoft);
  // 水线上一道深墨岸线（宣纸洇水的感觉）
  const inkPoly = poly.map(([x, z]) => [LCX + (x - LCX) * 1.075, LCZ + (z - LCZ) * 1.075]);
  const inkGeo = new THREE.ExtrudeGeometry(shapeFromPolygon(inkPoly, LCX, LCZ, 1), {
    depth: 0.05,
    bevelEnabled: false,
    curveSegments: 6,
  });
  inkGeo.rotateX(-Math.PI / 2);
  inkGeo.translate(LCX, WATER_Y - 0.01, LCZ);
  kit.addGeo(inkGeo, M.inkDeep);

  /* ---------- 2.1 低矮缓坡土山（白塔台座，土/石色，2~3 层） ---------- */
  const hillProfile = [
    [3.0, 0.0],
    [2.88, 0.12],
    [2.66, 0.28],
    [2.4, 0.44],
    [2.1, 0.58],
    [1.8, 0.7],
    [1.5, 0.8],
    [1.1, 0.86],
  ];
  const hillGeo = new THREE.LatheGeometry(
    hillProfile.map(([r, y]) => new THREE.Vector2(r, y)),
    18,
  );
  hillGeo.translate(LCX, islandTop, LCZ);
  kit.addGeo(hillGeo, M.inkSoft);
  // 半坡两圈深色石带（2~3 层坡面）+ 山顶草台
  kit.ring(2.55, 0.05, 20, M.stoneDark, LCX, islandTop + 0.345, LCZ);
  kit.ring(1.75, 0.045, 18, M.stoneDark, LCX, islandTop + 0.715, LCZ);
  kit.cyl(1.0, 1.08, 0.05, 14, M.grass, LCX, islandTop + 0.86, LCZ);
  const hillTop = islandTop + 0.86;
  const hillSurface = (rr) => {
    if (rr >= 3.0) return islandTop;
    if (rr <= 1.05) return hillTop;
    for (let i = 0; i < hillProfile.length - 1; i++) {
      const r0 = hillProfile[i][0];
      const y0 = hillProfile[i][1];
      const r1 = hillProfile[i + 1][0];
      const y1 = hillProfile[i + 1][1];
      if (rr <= r0 && rr >= r1) return islandTop + y0 + ((r0 - rr) / (r0 - r1)) * (y1 - y0);
    }
    return islandTop;
  };

  // 坡面岩石 + 草斑，做出土/石质感
  const rng = makeRng(77);
  for (let i = 0; i < 10; i++) {
    const a = rng() * TAU;
    const rr = 2.15 + rng() * 0.75;
    const rw = 0.12 + rng() * 0.22;
    kit.sphere(rw, i % 3 === 0 ? M.stoneShade : M.stoneDark, LCX + Math.cos(a) * rr, hillSurface(rr) - rw * 0.35, LCZ + Math.sin(a) * rr, 1.1, 0.5, 1);
  }
  for (let i = 0; i < 9; i++) {
    const a = rng() * TAU;
    const rr = 1.45 + rng() * 1.3;
    kit.cyl(0.16 + rng() * 0.2, 0.24 + rng() * 0.2, 0.03, 7, M.grass, LCX + Math.cos(a) * rr, hillSurface(rr) + 0.005, LCZ + Math.sin(a) * rr);
  }
  // 岸边几块半埋的石头
  for (let i = 0; i < 5; i++) {
    const a = rng() * TAU;
    const rr = islRX * (0.93 + rng() * 0.04);
    const rw = 0.16 + rng() * 0.2;
    kit.sphere(rw, M.stoneShade, LCX + Math.cos(a) * rr, islandTop - rw * 0.35, LCZ + Math.sin(a) * rr, 1.2, 0.55, 1);
  }

  /* ---------- 2.2 白塔（小台座 + 白石覆钵 + 细长金塔刹） ---------- */
  const tx = LCX + 0.08;
  const tz = LCZ - 0.26;
  // 小台座：八边形两层 + 一圈石栏
  kit.cyl(0.82, 0.92, 0.09, 8, M.marble, tx, hillTop + 0.045, tz);
  kit.cyl(0.7, 0.78, 0.08, 8, M.marble, tx, hillTop + 0.13, tz);
  kit.cyl(0.84, 0.84, 0.02, 8, M.stone, tx, hillTop + 0.09, tz);
  circularRail(kit, { x: tx, z: tz, r: 0.74, y: hillTop + 0.09, count: 14, mat: M.stone });
  // 金刚圈 + 覆钵（窄而高，拉长）
  const domeBase = hillTop + 0.17;
  kit.cyl(0.5, 0.54, 0.06, 16, M.marble, tx, domeBase + 0.03, tz);
  kit.dome(0.46, M.marble, tx, domeBase + 0.06, tz, 2.4);
  // 眼光门（南面小龛）
  kit.box(0.15, 0.26, 0.05, M.door, tx, domeBase + 0.52, tz + 0.34);
  // 细塔刹：塔脖子 + 十三层相轮 + 宝盖 + 宝珠 + 细长金尖
  const domeTop = domeBase + 0.06 + 0.46 * 2.4;
  kit.cyl(0.1, 0.13, 0.16, 10, M.marble, tx, domeTop + 0.08, tz);
  for (let i = 0; i < 13; i++) {
    const r = 0.155 - i * 0.0085;
    kit.cyl(r, r, 0.015, 10, M.gold, tx, domeTop + 0.2 + i * 0.037, tz);
  }
  kit.cyl(0.12, 0.12, 0.028, 10, M.gold, tx, domeTop + 0.69, tz);
  kit.sphere(0.06, M.gold, tx, domeTop + 0.75, tz);
  kit.cyl(0.01, 0.04, 0.36, 8, M.gold, tx, domeTop + 0.93, tz);

  /* ---------- 2.3 永安寺（几进殿宇，岛南平坡） ---------- */
  const halls = [
    { dz: 3.28, w: 0.94, d: 0.5, hh: 0.29, roofH: 0.25 },
    { dz: 3.78, w: 0.78, d: 0.42, hh: 0.24, roofH: 0.21 },
  ];
  for (const hl of halls) {
    const z = LCZ + hl.dz;
    kit.box(hl.w + 0.22, 0.1, hl.d + 0.2, M.marble, LCX, islandTop + 0.05, z);
    kit.box(hl.w, hl.hh, hl.d, M.wallRed, LCX, islandTop + 0.1 + hl.hh / 2, z);
    bakeGable(
      kit,
      M,
      { width: hl.w + 0.14, depth: hl.d + 0.14, height: hl.roofH, tileMat: M.roofTile },
      { x: LCX, y: islandTop + 0.1 + hl.hh, z },
    );
  }
  // 山门（岛南缘）
  kit.box(0.66, 0.28, 0.32, M.wallRed, LCX, islandTop + 0.14, LCZ + 3.98);
  bakeHip(kit, M, { width: 0.86, depth: 0.48, height: 0.2, tileMat: M.roofTile }, { x: LCX, y: islandTop + 0.28, z: LCZ + 3.98 });

  /* ---------- 2.4 岸边柳树 + 山坡树（flora） ---------- */
  const ringTarget = quality === 'low' ? 12 : 20;
  let ringPlaced = 0;
  for (let i = 0; i < ringTarget * 6 && ringPlaced < ringTarget; i++) {
    const a = rng() * TAU;
    const rr = islRX * (0.82 + rng() * 0.1);
    const x = LCX + Math.cos(a) * rr;
    const z = LCZ + Math.sin(a) * rr * (islRZ / islRX);
    if (z > LCZ + 2.6) continue; // 南岸让给永安寺与桥
    pushTree(trees, ringPlaced % 3 === 0 ? 'willow' : 'locust', x, z, islandTop, 0.6 + rng() * 0.42);
    ringPlaced++;
  }
  const slopeTarget = quality === 'low' ? 20 : 48;
  for (let i = 0; i < slopeTarget; i++) {
    const a = rng() * TAU;
    const rr = 1.15 + rng() * 1.75;
    const x = LCX + Math.cos(a) * rr;
    const z = LCZ + Math.sin(a) * rr;
    if (z > LCZ + 2.4) continue; // 南坡留给殿宇
    pushTree(trees, rr > 1.9 ? 'locust' : 'pine', x, z, hillSurface(rr) - 0.02, 0.42 + rng() * 0.3);
  }

  /* ---------- 2.5 堆云积翠桥（东岸） ----------
   * 真实桥身只有约 80m（≈1.6 世界单位）；但琼华岛在湖心，到东岸有 ~9 个单位，
   * 所以这里做「2.5 单位短石拱桥 + 低石堤接岸」，避免长桥抢了十七孔桥的量级。
   */
  const bx0 = LCX + islRX - 0.25;
  const bridgeLen = 2.5;
  const bx1 = bx0 + bridgeLen;
  const shoreX = (shoreEastX(lake.points, LCZ - 0.3) ?? LCX + 14.5) + 0.2;
  const bridge = archBridgeGroup({
    length: bridgeLen,
    width: 0.5,
    height: 0.4,
    arches: 3,
    archR: 0.28,
    mat: M.marble,
    railMat: M.marble,
    ringMat: M.stoneDark,
    deckMat: M.stoneShade,
  });
  kit.bake(bridge, { x: (bx0 + bx1) / 2, y: WATER_Y, z: LCZ - 0.3, ry: 0 });
  // 低石堤：贴着水面接到东岸
  const dikeLen = shoreX - bx1;
  if (dikeLen > 0.3) {
    const dikeMid = (bx1 + shoreX) / 2;
    kit.box(dikeLen, 0.1, 0.36, M.stone, dikeMid, WATER_Y + 0.06, LCZ - 0.3);
    kit.box(dikeLen, 0.02, 0.4, M.stoneShade, dikeMid, WATER_Y + 0.12, LCZ - 0.3);
    const postN = Math.max(2, Math.round(dikeLen / 0.55));
    for (let i = 0; i < postN; i++) {
      const x = bx1 + (i + 0.5) * (dikeLen / postN);
      for (const side of [-1, 1]) {
        kit.inst(
          'rail-post',
          UNIT.box,
          M.stone,
          composeMatrix(x, WATER_Y + 0.19, LCZ - 0.3 + side * 0.18, 0, 0.04, 0.11, 0.04),
        );
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  三、颐和园                                                                  */
/* -------------------------------------------------------------------------- */

function buildSummer(kit, M, quality, trees) {
  const lake = LAKES.kunming;
  const LCX = lake.cx;
  const LCZ = lake.cz;
  const HX = -u(11800); // 万寿山中心（与 layout 的万寿山高斯一致）
  const HZ = -u(11200);

  /* ---------- 3.1 自建万寿山：几层低多边形台地 ---------- */
  const tiers = [
    { rb: 6.8, rt: 5.9, yb: -0.25, yt: 2.7 },
    { rb: 5.35, rt: 5.0, yb: 2.7, yt: 3.7 },
    { rb: 4.45, rt: 4.1, yb: 3.7, yt: 4.6 },
    { rb: 3.55, rt: 3.2, yb: 4.6, yt: 5.4 },
    { rb: 2.75, rt: 2.4, yb: 5.4, yt: 5.9 },
  ];
  for (const t of tiers) {
    const idx = tiers.indexOf(t);
    kit.cyl(t.rt, t.rb, t.yt - t.yb, 12, M.stoneShade, HX, (t.yb + t.yt) / 2, HZ, (idx % 2) * (Math.PI / 12));
    kit.cyl(t.rt * 0.99, t.rt * 0.99, 0.05, 12, M.grass, HX, t.yt + 0.005, HZ, (idx % 2) * (Math.PI / 12));
    kit.ring(t.rt + 0.01, 0.055, 12, M.inkMid, HX, t.yt - 0.01, HZ);
  }
  const tierY = (rr) => {
    for (const t of tiers) {
      if (rr <= t.rb && rr >= t.rt) {
        return t.yt - ((rr - t.rt) / (t.rb - t.rt)) * (t.yt - t.yb);
      }
    }
    return rr < 2.4 ? 5.9 : -99;
  };

  /* ---------- 3.2 佛香阁（八角三重檐，放大） ---------- */
  const topY = 5.9;
  const fx = HX;
  const fz = HZ + 0.5;
  kit.cyl(1.5, 1.66, 0.22, 8, M.marble, fx, topY + 0.11, fz);
  kit.cyl(1.44, 1.44, 0.04, 8, M.stoneShade, fx, topY + 0.235, fz);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    kit.inst('rail-post', UNIT.box, M.stone, composeMatrix(fx + Math.cos(a) * 1.4, topY + 0.28, fz + Math.sin(a) * 1.4, -a, 0.03, 0.12, 0.03));
  }
  const fb = topY + 0.24;
  // 一层
  kit.cyl(1.02, 1.12, 0.62, 8, M.wallRed, fx, fb + 0.31, fz, Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    kit.cyl(0.045, 0.05, 0.62, 6, M.column, fx + Math.cos(a) * 1.13, fb + 0.31, fz + Math.sin(a) * 1.13);
  }
  kit.cyl(1.12, 1.12, 0.035, 8, M.gold, fx, fb + 0.605, fz, Math.PI / 8);
  bakeRound(
    kit,
    M,
    { radius: 1.42, height: 0.38, segments: 8, overhang: 0.09, curve: 1.5, fascia: 0.05, tileMat: M.roofGold },
    { x: fx, y: fb + 0.62, z: fz },
  );
  // 二层
  kit.cyl(0.74, 0.8, 0.36, 8, M.wallRed, fx, fb + 0.96, fz, Math.PI / 8);
  kit.cyl(0.8, 0.8, 0.03, 8, M.gold, fx, fb + 1.12, fz, Math.PI / 8);
  bakeRound(
    kit,
    M,
    { radius: 1.12, height: 0.36, segments: 8, overhang: 0.08, curve: 1.5, fascia: 0.05, tileMat: M.roofGold },
    { x: fx, y: fb + 1.14, z: fz },
  );
  // 三层
  kit.cyl(0.5, 0.56, 0.3, 8, M.wallRed, fx, fb + 1.44, fz, Math.PI / 8);
  bakeRound(
    kit,
    M,
    { radius: 0.82, height: 0.5, segments: 8, overhang: 0.08, curve: 1.6, fascia: 0.06, tileMat: M.roofGold },
    { x: fx, y: fb + 1.56, z: fz },
  );
  addFinial(kit, M, fx, fb + 2.08, fz, 1.1);

  /* ---------- 3.3 排云殿（半山的大台基 + 重檐大殿） ---------- */
  const py = 3.7;
  const pz = HZ + 5.0;
  // 大台基（南面露出石壁）
  kit.box(5.8, 3.4, 3.0, M.stoneShade, HX, 0.3 + 1.7, pz);
  kit.box(6.0, 0.14, 3.2, M.marble, HX, py + 0.07, pz);
  // 台基两侧加石壁与横墨缝，别让它成为一整块死白
  for (const side of [-1, 1]) {
    kit.box(0.24, 3.4, 3.0, M.stone, HX + side * 2.92, 0.3 + 1.7, pz);
    kit.box(0.26, 0.06, 3.02, M.inkMid, HX + side * 2.92, 3.68, pz);
    kit.box(0.26, 0.06, 3.02, M.inkMid, HX + side * 2.92, 2.2, pz);
  }
  for (const yy of [2.2, 3.0]) kit.box(5.82, 0.05, 0.05, M.inkMid, HX, yy, pz + 1.53);
  rectRail(kit, { x: HX, z: pz, w: 5.5, d: 2.8, y: py + 0.14, mat: M.stone, spacing: 0.42 });
  // 排云殿本体
  kit.box(3.1, 0.66, 1.2, M.wallRed, HX, py + 0.14 + 0.33, pz);
  const dbl = buildDoubleEave({ width: 3.4, depth: 1.5, height: 1.2, eaveGap: 0.22, tileMat: M.roofGold }, M);
  kit.bake(dbl, { x: HX, y: py + 0.8, z: pz });
  // 从湖岸登上排云殿的大台阶（新湖形岸线更靠北，台阶收短贴岸）
  addStairs(kit, { x: HX, z: pz + 1.5, y0: 0.55, ry: 0, width: 3.0, height: 3.3, depth: 1.35, steps: 12, mat: M.marble });
  // 排云殿 → 佛香阁 的中轴踏跺
  addStairs(kit, { x: HX, z: fz + 1.5, y0: py + 0.14, ry: 0, width: 2.4, height: topY + 0.22 - (py + 0.14), depth: 2.8, steps: 11, mat: M.marble });

  /* ---------- 3.4 长廊（带顶柱廊，沿湖北岸，中轴处断开给踏跺） ---------- */
  const KUN_PTS = lake.points;
  // 逐段贴着新湖岸走：取该 x 处的北岸 z，往岸内退 1.15
  const shoreZFor = (x, off = 1.15) => {
    const nz = shoreNorthZ(KUN_PTS, x);
    return (nz == null ? -u(10800) : nz) - off;
  };
  const runCorridor = (x0, x1) => {
    const segs = Math.max(2, Math.round((x1 - x0) / 2.6));
    const segW = (x1 - x0) / segs;
    for (let i = 0; i < segs; i++) {
      const cxx = x0 + segW * (i + 0.5);
      const czz = shoreZFor(cxx);
      const cyy = terrainHeight(cxx, czz);
      kit.box(segW, 0.08, 0.86, M.stoneShade, cxx, cyy + 0.04, czz);
      for (let k = 0; k < 5; k++) {
        const px = cxx - segW / 2 + (k / 4) * segW;
        for (const side of [-1, 1]) {
          kit.cyl(0.028, 0.032, 0.44, 6, M.column, px, cyy + 0.3, czz + side * 0.33);
        }
      }
      kit.box(segW, 0.16, 0.04, M.stone, cxx, cyy + 0.14, czz - 0.4);
      bakeGable(
        kit,
        M,
        { width: segW + 0.12, depth: 0.95, height: 0.26, tileMat: M.roofTile, overhang: 0.06 },
        { x: cxx, y: cyy + 0.52, z: czz },
      );
    }
  };
  runCorridor(-u(12300), -u(11900)); // 西段
  runCorridor(-u(11620), -u(11360)); // 东段（佛香阁正前留出踏跺）
  // 湖边柳树（沿新北岸）
  const wrng = makeRng(3141);
  const willowXs = [-u(12350), -u(12200), -u(12050), -u(11850), -u(11600), -u(11450), -u(11300)];
  for (const x of willowXs) {
    const z = shoreZFor(x, 1.55) + (wrng() - 0.5) * 0.5;
    pushTree(trees, 'willow', x, z, terrainHeight(x, z), 0.95 + wrng() * 0.35);
  }
  // 东岸柳树（按东岸 x 落）
  for (let i = 0; i < 5; i++) {
    const z = -u(10250) + i * u(240);
    const ex = shoreEastX(KUN_PTS, z);
    if (ex == null) continue;
    const x = ex + 0.75;
    pushTree(trees, 'willow', x, z, terrainHeight(x, z), 0.9 + wrng() * 0.3);
  }

  /* ---------- 3.5 十七孔桥 + 南湖岛 + 湖东亭 ---------- */
  const islZ = LCZ - 6.4;
  const eastShore = (shoreEastX(KUN_PTS, islZ) ?? LCX + 19.3) + 0.15; // 岸上一点点
  const bridgeLen17 = 14.2;
  const islC = { x: eastShore - bridgeLen17 - 2.35, z: islZ };
  moundIsland(kit, M, { x: islC.x, z: islC.z, r: 2.45, topY: 0.22, mat: M.stoneShade });
  // 十七孔桥：南湖岛东缘 → 东岸（约 14 世界单位）
  const bx0 = islC.x + 2.3;
  const bx1 = eastShore;
  const bridge = archBridgeGroup({
    length: bx1 - bx0,
    width: 0.85,
    height: 0.55,
    arches: 11,
    archR: 0.42,
    mat: M.marble,
    railMat: M.marble,
    ringMat: M.stoneDark,
    deckMat: M.stoneShade,
  });
  kit.bake(bridge, { x: (bx0 + bx1) / 2, y: WATER_Y, z: islC.z, ry: 0 });
  // 南湖岛上的涵虚堂
  kit.box(1.7, 0.4, 1.1, M.wallRed, islC.x, 0.22 + 0.2, islC.z + 0.15);
  bakeHip(kit, M, { width: 2.0, depth: 1.35, height: 0.42, tileMat: M.roofGlaze }, { x: islC.x, y: 0.22 + 0.4, z: islC.z + 0.15 });
  pushTree(trees, 'willow', islC.x - 1.2, islC.z + 1.1, 0.22, 0.85);
  pushTree(trees, 'willow', islC.x + 1.3, islC.z + 1.2, 0.22, 0.8);
  pushTree(trees, 'pine', islC.x - 0.4, islC.z - 1.2, 0.22, 0.6);
  // 湖东岸小亭（八角攒尖）
  const pavZ = LCZ - 2.6;
  const pavX = (shoreEastX(KUN_PTS, pavZ) ?? LCX + 21.4) + 1.05;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    kit.cyl(0.026, 0.03, 0.42, 6, M.column, pavX + Math.cos(a) * 0.55, 0.22, pavZ + Math.sin(a) * 0.55);
  }
  kit.cyl(0.7, 0.7, 0.07, 8, M.marble, pavX, 0.035, pavZ);
  bakeRound(
    kit,
    M,
    { radius: 0.66, height: 0.42, segments: 8, overhang: 0.06, curve: 1.5, fascia: 0.05, tileMat: M.roofGlaze },
    { x: pavX, y: 0.66, z: pavZ },
  );
  addFinial(kit, M, pavX, 1.12, pavZ, 0.7);

  /* ---------- 3.6 万寿山松林（flora pine：成簇成林） ---------- */
  const rng = makeRng(1895);
  const surfaceY = (rr) => {
    for (const t of tiers) {
      if (rr <= t.rb && rr >= t.rt) return t.yt - ((rr - t.rt) / (t.rb - t.rt)) * (t.yt - t.yb);
    }
    return rr < 2.4 ? 5.9 : null;
  };
  // 山腰：十几簇松林，簇间留空
  const clusterN = quality === 'low' ? 8 : 15;
  const hillClusters = [];
  for (let c = 0; c < clusterN; c++) {
    const tier = tiers[Math.floor(rng() * tiers.length)];
    const a = rng() * TAU;
    if (Math.abs(a - Math.PI / 2) < 0.58) continue; // 南面正坡留给踏跺、排云殿
    const rr = tier.rt + rng() * Math.max(0.05, tier.rb - tier.rt) * 0.9;
    hillClusters.push({ a, rr, n: 8 + Math.floor(rng() * 8), spread: 0.7 + rng() * 0.8 });
  }
  for (const c of hillClusters) {
    for (let k = 0; k < c.n; k++) {
      const a = c.a + (rng() - 0.5) * 0.2;
      const rr = Math.max(2.55, c.rr + (rng() - 0.5) * c.spread * 1.7);
      if (rr > 6.7) continue;
      const y = surfaceY(rr);
      if (y == null) continue;
      const x = HX + Math.cos(a) * rr;
      const z = HZ + Math.sin(a) * rr;
      pushTree(trees, 'pine', x, z, y - 0.04, 0.52 + rng() * 0.4);
    }
  }
  // 山脚再点几簇，和自然山坡接上
  for (let c = 0; c < 5; c++) {
    const a = rng() * TAU;
    if (Math.abs(a - Math.PI / 2) < 0.62) continue;
    const rr = 7.2 + rng() * 4.6;
    const cx = HX + Math.cos(a) * rr;
    const cz = HZ + Math.sin(a) * rr;
    const n = 5 + Math.floor(rng() * 5);
    for (let k = 0; k < n; k++) {
      const x = cx + (rng() - 0.5) * 2.4;
      const z = cz + (rng() - 0.5) * 2.4;
      const y = terrainHeight(x, z);
      if (y < 0.3) continue;
      pushTree(trees, 'pine', x, z, y - 0.03, 0.5 + rng() * 0.35);
    }
  }
  // 长廊后侧几棵杂树
  for (let i = 0; i < 8; i++) {
    const x = -u(12350) + (i / 7) * u(950);
    const zz = shoreZFor(x, -1.4) + rng() * 0.8;
    const y = terrainHeight(x, zz);
    if (y < 0.2) continue;
    pushTree(trees, 'locust', x + (rng() - 0.5), zz, y, 0.6 + rng() * 0.3);
  }
}

/* -------------------------------------------------------------------------- */
/*  四、长城                                                                    */
/* -------------------------------------------------------------------------- */

const WALL_H = h(20); // 原 h(8)，按 Lead 要求加高
const WALL_T = 0.38; // 加厚

function towerArch(kit, M, x, y, z, ry, s = 1) {
  const shape = new THREE.Shape();
  const w = 0.14 * s;
  const h0 = 0.2 * s;
  shape.moveTo(-w, 0);
  shape.lineTo(w, 0);
  shape.lineTo(w, h0);
  shape.absarc(0, h0, w, 0, Math.PI, false);
  shape.lineTo(-w, 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1 * s, bevelEnabled: false, curveSegments: 5 });
  geo.translate(0, 0, -0.05 * s);
  kit.put(geo, M.inkDeep, composeMatrix(x, y, z, ry));
}

function buildWatchTower(kit, M, x, z, size = 1) {
  const baseY = terrainHeight(x, z) - 0.32;
  const w = 1.15 * size;
  const bh = 0.62 * size;
  kit.box(w * 1.28, 0.26 * size, w * 1.28, M.stoneShade, x, baseY + 0.13 * size, z);
  kit.box(w, bh, w, M.stoneDark, x, baseY + 0.26 * size + bh / 2, z);
  // 垛口一圈
  const n = 3;
  for (let side = 0; side < 4; side++) {
    const ry = (side * Math.PI) / 2;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const local = t * w * 0.9;
      const cx = x + Math.cos(ry) * local - Math.sin(ry) * (w / 2);
      const cz = z - Math.sin(ry) * local - Math.cos(ry) * (w / 2);
      kit.box(0.34 * size, 0.24 * size, 0.16 * size, M.inkDeep, cx, baseY + 0.26 * size + bh + 0.12 * size, cz, ry);
    }
  }
  // 四面券门
  towerArch(kit, M, x, baseY + 0.34 * size, z + w / 2 + 0.03, 0, size);
  towerArch(kit, M, x, baseY + 0.34 * size, z - w / 2 - 0.03, Math.PI, size);
  towerArch(kit, M, x + w / 2 + 0.03, baseY + 0.34 * size, z, Math.PI / 2, size);
  towerArch(kit, M, x - w / 2 - 0.03, baseY + 0.34 * size, z, -Math.PI / 2, size);
  // 顶部平台
  kit.box(w * 0.99, 0.04, w * 0.99, M.stone, x, baseY + 0.26 * size + bh, z);
}

function buildGreatWall(kit, M) {
  const pts = GREAT_WALL.points;
  const records = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const sub = Math.max(6, Math.round(len / u(170))); // 每 ~170m 一小段，贴地形
    for (let s = 0; s < sub; s++) {
      const t0 = s / sub;
      const t1 = (s + 1) / sub;
      const x0 = ax + (bx - ax) * t0;
      const z0 = az + (bz - az) * t0;
      const x1 = ax + (bx - ax) * t1;
      const z1 = az + (bz - az) * t1;
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      // 墙身从这一段的最低地形一直砌到最高地形 + 墙高：山坡上不会露空
      const yA = terrainHeight(x0, z0);
      const yB = terrainHeight(x1, z1);
      const yM = terrainHeight(mx, mz);
      const yLow = Math.min(yA, yB, yM) - 0.18;
      const yTop = Math.max(yA, yB, yM) + WALL_H;
      const angle = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
      const len2 = Math.hypot(x1 - x0, z1 - z0);
      records.push({ x0, z0, x1, z1, mx, mz, yLow, yTop, angle, len: len2 });
    }
  }
  for (const r of records) {
    const bh = r.yTop - r.yLow;
    kit.box(r.len, bh, WALL_T, M.inkMid, (r.x0 + r.x1) / 2, r.yLow + bh / 2, (r.z0 + r.z1) / 2, r.angle);
    // 墙顶压条
    kit.box(r.len + 0.02, 0.05, WALL_T * 1.22, M.inkMid, (r.x0 + r.x1) / 2, r.yTop + 0.025, (r.z0 + r.z1) / 2, r.angle);
    // 垛口
    const cn = Math.max(2, Math.floor(r.len / 0.72));
    for (let c = 0; c < cn; c++) {
      const tt = (c + 0.5) / cn;
      kit.box(
        0.32,
        0.2,
        WALL_T * 0.58,
        M.inkDeep,
        r.x0 + (r.x1 - r.x0) * tt,
        r.yTop + 0.12,
        r.z0 + (r.z1 - r.z0) * tt,
        r.angle,
      );
    }
  }
  // 台阶状连接块：相邻两段高差处补一段竖墙，远看是连续的一条线
  for (let i = 1; i < records.length; i++) {
    const a = records[i - 1];
    const b = records[i];
    const yMin = Math.min(a.yTop, b.yTop);
    const yMax = Math.max(a.yTop, b.yTop);
    if (yMax - yMin < 0.05) continue;
    const hh = yMax - yMin + WALL_H * 0.9;
    const yb = yMin - WALL_H * 0.9;
    kit.box(0.4, hh, WALL_T, M.inkMid, b.x0, yb + hh / 2, b.z0, b.angle);
    kit.box(0.42, 0.05, WALL_T * 1.2, M.inkMid, b.x0, yMax + 0.02, b.z0, b.angle);
  }

  // 烽火台：起终点 + 每隔 4 段（每个折点都放，大小交替）
  const sizes = [1.85, 1.4, 1.65, 1.4, 1.85, 1.4, 1.65, 1.4];
  for (let idx = 0; idx < pts.length; idx++) {
    const [x, z] = pts[idx];
    buildWatchTower(kit, M, x, z, sizes[idx] || 1.4);
  }
}

/* -------------------------------------------------------------------------- */
/*  五、卢沟桥 + 宛平城                                                          */
/* -------------------------------------------------------------------------- */

/** 求折线上离 (x,z) 最近的点与方向。 */
function nearestOnPolyline(points, x, z) {
  let best = null;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const vx = bx - ax;
    const vz = bz - az;
    const l2 = vx * vx + vz * vz || 1;
    let t = ((x - ax) * vx + (z - az) * vz) / l2;
    t = clamp(t, 0, 1);
    const px = ax + vx * t;
    const pz = az + vz * t;
    const d = Math.hypot(x - px, z - pz);
    if (!best || d < best.d) {
      const len = Math.hypot(vx, vz);
      best = { d, x: px, z: pz, dx: vx / len, dz: vz / len, t, i };
    }
  }
  return best;
}

function buildLugou(kit, M, quality, trees) {
  const anchor = LANDMARK_BY_ID.lugou.anchor;
  const CX = anchor[0];
  const CZ = anchor[2];
  const river = RIVERS[0];
  const near = nearestOnPolyline(river.points, CX, CZ);
  // 桥沿河道法线方向横跨
  const nx = -near.dz;
  const nz = near.dx;
  const ry = Math.atan2(-nz, nx);

  const BL = u(560);
  const bridge = archBridgeGroup({
    length: BL,
    width: u(28),
    height: 0.52,
    arches: 11,
    archR: 0.26,
    mat: M.stone,
    railMat: M.marble,
    ringMat: M.inkDeep,
    deckMat: M.stoneShade,
    lion: true,
    lionMat: M.stoneShade,
    lionEvery: 3,
  });
  kit.bake(bridge, { x: near.x, y: WATER_Y, z: near.z, ry });

  // 桥头华表（桥两端各一对；落在水面上的跳过，避免「泡在河里」）
  for (const end of [-1, 1]) {
    for (const side of [-1, 1]) {
      const lx = end * (BL / 2 + 0.85);
      const lz = side * 0.95;
      const wx = near.x + Math.cos(ry) * lx - Math.sin(ry) * lz;
      const wz = near.z + Math.sin(ry) * lx + Math.cos(ry) * lz;
      if (nearestOnPolyline(river.points, wx, wz).d < river.width * 0.62) continue;
      kit.box(0.18, 0.08, 0.18, M.marble, wx, WATER_Y + 0.04, wz);
      kit.cyl(0.04, 0.048, 0.46, 8, M.marble, wx, WATER_Y + 0.31, wz);
      kit.box(0.16, 0.028, 0.04, M.stoneShade, wx, WATER_Y + 0.47, wz, ry);
      kit.cyl(0.075, 0.075, 0.035, 8, M.marble, wx, WATER_Y + 0.505, wz);
      kit.sphere(0.05, M.stoneShade, wx, WATER_Y + 0.55, wz);
    }
  }

  /* ---------- 5.1 宛平城（小方城 + 城门楼，用 buildCrenellatedWall 语法） ---------- */
  // 落在东岸、卢沟桥桥头北侧（-n 方向是东岸）
  const townX = near.x - nx * (BL / 2 + u(340));
  const townZ = near.z - nz * (BL / 2 + u(340));
  const tw = u(620);
  const td = u(460);
  const wallH = 0.5;
  const wallT = 0.16;
  const baseY = terrainHeight(townX, townZ);
  const hw = tw / 2;
  const hd = td / 2;
  const seg = (x0, z0, x1, z1, crenel) =>
    kit.bake(
      buildCrenellatedWall({
        from: [x0, baseY, z0],
        to: [x1, baseY, z1],
        height: wallH,
        thickness: wallT,
        crenel,
        crenelH: 0.14,
        crenelW: 0.2,
        crenelGap: 0.18,
        mat: M.stoneShade,
        crenelMat: M.inkMid,
        topMat: M.inkMid,
      }),
    );
  seg(townX - hw, townZ - hd, townX + hw, townZ - hd, true); // 北墙
  seg(townX - hw, townZ + hd, townX + hw, townZ + hd, true); // 南墙
  seg(townX - hw, townZ - hd, townX - hw, townZ + hd, true); // 西墙
  seg(townX + hw, townZ - hd, townX + hw, townZ + hd, true); // 东墙
  // 城门楼（北门，朝向卢沟桥）
  kit.box(1.6, 0.62, 0.7, M.stoneShade, townX, baseY + 0.31, townZ - hd);
  bakeHip(kit, M, { width: 2.0, depth: 1.0, height: 0.42, tileMat: M.roofTile }, { x: townX, y: baseY + 0.62, z: townZ - hd });
  kit.box(0.42, 0.38, 0.06, M.inkDeep, townX, baseY + 0.2, townZ - hd - 0.36);
  // 主街
  kit.box(tw - 0.6, 0.012, 0.8, M.paperShade, townX, baseY + 0.03, townZ);
  kit.box(0.8, 0.012, td - 0.6, M.paperShade, townX, baseY + 0.03, townZ);
  // 城内小院
  const rng = makeRng(404);
  for (let i = 0; i < 18; i++) {
    const hx = townX + (rng() - 0.5) * (tw - 1.2);
    const hz = townZ + (rng() - 0.5) * (td - 1.0);
    if (Math.abs(hx - townX) < 0.6 || Math.abs(hz - townZ) < 0.6) continue;
    const w = 0.42 + rng() * 0.3;
    const d = 0.32 + rng() * 0.26;
    kit.box(w + 0.1, 0.06, d + 0.1, M.paperShade, hx, baseY + 0.03, hz);
    kit.box(w, 0.16, d, M.wallPlaster, hx, baseY + 0.06 + 0.08, hz);
    bakeGable(kit, M, { width: w + 0.12, depth: d + 0.12, height: 0.14, tileMat: M.roofTile }, { x: hx, y: baseY + 0.22, z: hz });
  }
  // 城外几棵树（flora locust）
  for (let i = 0; i < 10; i++) {
    const a = rng() * TAU;
    const rr = Math.max(tw, td) * (0.7 + rng() * 0.5);
    const x = townX + Math.cos(a) * rr;
    const z = townZ + Math.sin(a) * rr;
    const y = terrainHeight(x, z);
    if (y > 0.5) continue;
    pushTree(trees, 'locust', x, z, y, 0.6 + rng() * 0.35);
  }
}

/* -------------------------------------------------------------------------- */
/*  六、圆明园（福海 + 西洋楼大水法遗址 + 中式院落）                              */
/* -------------------------------------------------------------------------- */

/** 断柱：白色石柱 + 深浅不一的断口。 */
function brokenColumn(kit, M, x, y, z, hh, r = 0.1, mat = null) {
  const m = mat || M.marble;
  kit.cyl(r * 0.9, r, hh, 8, m, x, y + hh / 2, z);
  kit.box(r * 2.2, 0.05, r * 2.2, M.stoneShade, x, y + hh + 0.02, z);
  kit.box(r * 1.7, 0.035, r * 1.7, m, x, y + hh + 0.065, z);
}

function buildYuanmingyuan(kit, M, quality, trees) {
  const lake = LAKES.fuhai;
  const CX = lake.cx;
  const CZ = lake.cz;
  const pts = lake.points;
  const rng = makeRng(1860);

  /* ---------- 6.1 西洋楼「大水法」残柱剪影（福海东北岸） ---------- */
  const RX = CX + 11.0; // ≈ -165
  const RZ = CZ - 11.5; // ≈ -163.5（长河北岸，避开河道）
  // 台基（两层，第二层略小）
  kit.box(5.0, 0.12, 2.6, M.stoneShade, RX, 0.06, RZ);
  kit.box(4.4, 0.07, 2.1, M.marble, RX, 0.155, RZ);
  // 水法水池（深墨，压住台心）
  kit.box(2.9, 0.03, 1.1, M.inkDeep, RX, 0.19, RZ + 0.15);
  kit.box(3.2, 0.05, 1.35, M.stoneShade, RX, 0.17, RZ + 0.15);
  // 中央拱门：两根残柱 + 半圆拱
  const archH = 0.62;
  const archR = 0.58;
  for (const dx of [-archR, archR]) {
    brokenColumn(kit, M, RX + dx, 0.19, RZ - 0.15, archH, 0.11);
  }
  kit.put(new THREE.TorusGeometry(archR, 0.06, 4, 12, Math.PI), M.marble, composeMatrix(RX, 0.19 + archH, RZ - 0.15));
  // 两侧断柱（高低错落）
  const cols = [
    [-2.15, 1.25, 0.1],
    [-1.55, 0.7, 0.095],
    [1.55, 0.95, 0.1],
    [2.15, 0.42, 0.095],
    [-2.6, 0.35, 0.09],
    [2.6, 0.62, 0.09],
  ];
  for (const [dx, hh, r] of cols) brokenColumn(kit, M, RX + dx, 0.19, RZ - 0.15, hh, r);
  // 倒在台基上的半根柱子
  kit.put(
    new THREE.CylinderGeometry(0.09, 0.1, 1.15, 8),
    M.marble,
    composeMatrix(RX + 1.1, 0.26, RZ + 0.75, 0, 1, 1, 1, 0, Math.PI / 2),
  );
  // 残墙（断续的断垣，高低不齐）
  const wallBits = [
    [-2.2, 0.5, 0.22], [-1.35, 0.3, 0.18], [-0.6, 0.62, 0.22],
    [0.25, 0.24, 0.16], [0.95, 0.55, 0.2], [1.8, 0.34, 0.18], [2.5, 0.46, 0.2],
  ];
  for (const [dx, hh, rw] of wallBits) {
    kit.box(0.62, hh, 0.16, M.stoneShade, RX + dx, 0.19 + hh / 2, RZ - 1.05);
    kit.box(0.66, 0.04, 0.2, M.stone, RX + dx, 0.19 + hh + 0.02, RZ - 1.05);
  }
  // 散落的碎石
  for (let i = 0; i < 7; i++) {
    const rx = RX + (rng() - 0.5) * 5.4;
    const rz = RZ + (rng() - 0.5) * 2.6;
    const rw = 0.1 + rng() * 0.18;
    kit.box(rw, rw * 0.6, rw * 0.8, i % 2 ? M.stoneShade : M.stone, rx, 0.13 + rw * 0.2, rz, rng() * TAU);
  }
  // 大水法两侧的残柱小径
  for (const [dx, dz, hh] of [[-4.6, -0.6, 0.85], [-4.0, 0.7, 0.5], [4.4, -0.2, 0.7], [4.9, 0.9, 0.4]]) {
    brokenColumn(kit, M, RX + dx, 0, RZ + dz, hh, 0.09);
  }

  /* ---------- 6.2 中式院落（福海南岸：正大光明一区） ---------- */
  const YX = CX - 0.5;
  const YZ = CZ + 14.6; // 湖南岸外侧
  const baseY = terrainHeight(YX, YZ);
  // 院墙（北面留门）
  const gw = 6.2;
  const gd = 4.4;
  const wallH = 0.3;
  const wallT = 0.13;
  kit.box(gw - 1.3, wallH, wallT, M.wallGray, YX - (gw + 1.3) / 4, baseY + wallH / 2, YZ - gd / 2);
  kit.box(gw - 1.3, wallH, wallT, M.wallGray, YX + (gw + 1.3) / 4, baseY + wallH / 2, YZ - gd / 2);
  kit.box(gw, wallH, wallT, M.wallGray, YX, baseY + wallH / 2, YZ + gd / 2);
  kit.box(wallT, wallH, gd, M.wallGray, YX - gw / 2, baseY + wallH / 2, YZ);
  kit.box(wallT, wallH, gd, M.wallGray, YX + gw / 2, baseY + wallH / 2, YZ);
  for (const [x, z, w, d] of [
    [YX - (gw + 1.3) / 4, YZ - gd / 2, gw - 1.3, wallT],
    [YX + (gw + 1.3) / 4, YZ - gd / 2, gw - 1.3, wallT],
    [YX, YZ + gd / 2, gw, wallT],
    [YX - gw / 2, YZ, wallT, gd],
    [YX + gw / 2, YZ, wallT, gd],
  ]) kit.box(w + 0.04, 0.03, d + 0.04, M.inkMid, x, baseY + wallH + 0.015, z);
  // 正殿（歇山/庑殿灰瓦）
  kit.box(2.6, 0.14, 1.4, M.marble, YX, baseY + 0.07, YZ + 0.2);
  kit.box(2.2, 0.5, 0.95, M.wallRed, YX, baseY + 0.14 + 0.25, YZ + 0.2);
  bakeHip(kit, M, { width: 2.55, depth: 1.15, height: 0.55, tileMat: M.roofTile }, { x: YX, y: baseY + 0.64, z: YZ + 0.2 });
  // 后殿（硬山）
  kit.box(1.6, 0.38, 0.72, M.wallPlaster, YX, baseY + 0.19, YZ - 1.3);
  bakeGable(kit, M, { width: 1.75, depth: 0.82, height: 0.3, tileMat: M.roofTile }, { x: YX, y: baseY + 0.38, z: YZ - 1.3 });
  // 东西配殿
  for (const side of [-1, 1]) {
    kit.box(0.6, 0.26, 1.0, M.wallPlaster, YX + side * 2.15, baseY + 0.13, YZ + 0.3);
    bakeGable(kit, M, { width: 0.7, depth: 1.15, height: 0.22, tileMat: M.roofTile }, { x: YX + side * 2.15, y: baseY + 0.26, z: YZ + 0.3 });
  }
  // 院中石板路
  kit.box(0.8, 0.012, gd - 0.4, M.paperShade, YX, baseY + 0.006, YZ);

  /* ---------- 6.3 福海三岛（蓬岛瑶台） + 环湖柳树 ---------- */
  const islands = [
    { x: CX + 0.5, z: CZ + 1.8, r: 0.95 },
    { x: CX + 4.0, z: CZ + 4.4, r: 0.72 },
    { x: CX - 3.6, z: CZ + 5.0, r: 0.62 },
  ];
  for (const isl of islands) {
    if (inLake(pts, isl.x, isl.z)) {
      moundIsland(kit, M, { x: isl.x, z: isl.z, r: isl.r, topY: 0.16, mat: M.stoneShade });
      // 小亭
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        kit.cyl(0.022, 0.025, 0.34, 6, M.column, isl.x + Math.cos(a) * isl.r * 0.42, 0.2, isl.z + Math.sin(a) * isl.r * 0.42);
      }
      bakeRound(
        kit,
        M,
        { radius: isl.r * 0.62, height: 0.3, segments: 8, overhang: 0.05, curve: 1.5, fascia: 0.05, tileMat: M.roofGlaze },
        { x: isl.x, y: 0.54, z: isl.z },
      );
      addFinial(kit, M, isl.x, 0.86, isl.z, 0.5);
      pushTree(trees, 'willow', isl.x - isl.r * 0.5, isl.z + isl.r * 0.4, 0.16, 0.7);
      pushTree(trees, 'locust', isl.x + isl.r * 0.45, isl.z - isl.r * 0.35, 0.16, 0.55);
    }
  }
  // 环湖柳树/杂树/杏花（在岸上）
  const shoreN = quality === 'low' ? 16 : 34;
  let shorePlaced = 0;
  for (let i = 0; i < shoreN * 8 && shorePlaced < shoreN; i++) {
    const a = rng() * TAU;
    const fx = lake.rx * (1.12 + rng() * 0.12);
    const fz = lake.rz * (1.12 + rng() * 0.12);
    const x = CX + Math.cos(a) * fx;
    const z = CZ + Math.sin(a) * fz;
    if (inLake(pts, x, z)) continue;
    if (nearestOnPolyline(CANALS[0].points, x, z).d < 1.7) continue; // 别长在长河里
    const y = terrainHeight(x, z);
    if (y > 0.5) continue;
    const kind = rng() < 0.42 ? 'willow' : rng() < 0.6 ? 'locust' : 'blossom';
    pushTree(trees, kind, x, z, y, 0.75 + rng() * 0.4);
    shorePlaced++;
  }
}

/* -------------------------------------------------------------------------- */
/*  七、玉泉山（小丘 + 玉峰塔）                                                   */
/* -------------------------------------------------------------------------- */

/** 瘦高的八角塔（白石塔身 + 淡墨/琉璃檐），返回塔顶高度。 */
function octaPagoda(kit, M, { x, z, y, tiers = 7, r0 = 0.46, tierH = 0.3, shrink = 0.9, bodyMat, eaveMat, finial = true }) {
  let yy = y;
  let r = r0;
  for (let i = 0; i < tiers; i++) {
    const hh = tierH * (1 - i * 0.03);
    kit.cyl(r * 0.93, r, hh, 8, bodyMat, x, yy + hh / 2, z, Math.PI / 8);
    kit.cyl(r * 1.24, r * 1.24, 0.032, 8, eaveMat, x, yy + hh + 0.012, z, Math.PI / 8);
    yy += hh + 0.055;
    r *= shrink;
  }
  if (finial) addFinial(kit, M, x, yy + 0.02, z, 0.75);
  return yy;
}

function buildYuquan(kit, M, quality, trees) {
  const X = -u(14500);
  const Z = -u(11000);
  const baseY = terrainHeight(X, Z);
  // 小丘（三层，土/石色）
  const hill = [
    { rb: 5.4, rt: 4.2, yb: baseY - 0.25, yt: baseY + 0.95 },
    { rb: 4.2, rt: 3.0, yb: baseY + 0.95, yt: baseY + 1.75 },
    { rb: 3.0, rt: 1.85, yb: baseY + 1.75, yt: baseY + 2.4 },
  ];
  for (let i = 0; i < hill.length; i++) {
    const t = hill[i];
    kit.cyl(t.rt, t.rb, t.yt - t.yb, 12, M.inkSoft, X, (t.yb + t.yt) / 2, Z, (i % 2) * (Math.PI / 12));
    kit.cyl(t.rt * 0.985, t.rt * 0.985, 0.05, 12, M.grass, X, t.yt + 0.005, Z, (i % 2) * (Math.PI / 12));
    kit.ring(t.rt + 0.01, 0.045, 12, M.stoneShade, X, t.yt - 0.01, Z);
  }
  const hillTop = baseY + 2.4;
  const hillSurface = (rr) => {
    for (const t of hill) {
      if (rr <= t.rb && rr >= t.rt) {
        return t.yt - ((rr - t.rt) / (t.rb - t.rt)) * (t.yt - t.yb);
      }
    }
    return rr < 1.85 ? hillTop : baseY;
  };

  // 坡面石块 + 草斑
  const rngH = makeRng(733);
  for (let i = 0; i < 12; i++) {
    const a = rngH() * TAU;
    const rr = 2.2 + rngH() * 2.8;
    const rw = 0.14 + rngH() * 0.28;
    kit.box(rw, rw * 0.6, rw * 0.8, i % 3 ? M.stoneShade : M.stoneDark,
      X + Math.cos(a) * rr, hillSurface(rr) - rw * 0.15, Z + Math.sin(a) * rr, rngH() * TAU);
  }
  for (let i = 0; i < 8; i++) {
    const a = rngH() * TAU;
    const rr = 1.4 + rngH() * 3.0;
    kit.cyl(0.2 + rngH() * 0.22, 0.3 + rngH() * 0.2, 0.03, 7, M.grass, X + Math.cos(a) * rr, hillSurface(rr) + 0.01, Z + Math.sin(a) * rr);
  }

  // 山顶玉峰塔：瘦高八角白石塔，淡墨檐
  kit.cyl(0.78, 0.9, 0.12, 8, M.marble, X, hillTop + 0.06, Z);
  circularRail(kit, { x: X, z: Z, r: 0.78, y: hillTop + 0.11, count: 12, mat: M.stone });
  octaPagoda(kit, M, {
    x: X, z: Z, y: hillTop + 0.12,
    tiers: 7, r0: 0.48, tierH: 0.31, shrink: 0.89,
    bodyMat: M.marble, eaveMat: M.eave, finial: true,
  });

  // 山脚小寺（一进）
  const hallX = X + 0.5;
  const hallZ = Z + 6.2;
  const hy = terrainHeight(hallX, hallZ);
  kit.box(2.0, 0.12, 1.1, M.marble, hallX, hy + 0.06, hallZ);
  kit.box(1.6, 0.4, 0.8, M.wallRed, hallX, hy + 0.12 + 0.2, hallZ);
  bakeHip(kit, M, { width: 1.9, depth: 0.95, height: 0.42, tileMat: M.roofTile }, { x: hallX, y: hy + 0.52, z: hallZ });

  // 松树（坡面 + 山脚）
  const rng = makeRng(521);
  const n = quality === 'low' ? 12 : 30;
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU;
    const rr = 1.2 + rng() * 3.9;
    const x = X + Math.cos(a) * rr;
    const z = Z + Math.sin(a) * rr;
    const y = hillSurface(rr);
    pushTree(trees, 'pine', x, z, y - 0.03, 0.45 + rng() * 0.3);
  }
  for (let i = 0; i < 8; i++) {
    const a = rng() * TAU;
    const rr = 4.6 + rng() * 1.6;
    const x = X + Math.cos(a) * rr;
    const z = Z + Math.sin(a) * rr;
    pushTree(trees, 'locust', x, z, terrainHeight(x, z), 0.5 + rng() * 0.28);
  }
}

/* -------------------------------------------------------------------------- */
/*  八、香山（香山寺 + 琉璃塔，极简轮廓）                                        */
/* -------------------------------------------------------------------------- */

function buildXiangshan(kit, M, quality, trees) {
  const X = -u(20000);
  const Z = -u(13000);
  const base = terrainHeight(X, Z);
  // nature 的西山在这一带的起伏最高到 base+3 左右，所以香山寺坐的「山肩」要略高，
  // 用一座低多边形岩台把寺和塔顶出来（下缘埋进山体里）。
  const tiers = [
    { rb: 7.4, rt: 6.0, yb: base - 1.9, yt: base + 2.0 },
    { rb: 5.6, rt: 3.8, yb: base + 2.0, yt: base + 4.0 },
    { rb: 2.4, rt: 1.5, yb: base + 4.0, yt: base + 5.2 },
  ];
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    kit.cyl(t.rt, t.rb, t.yt - t.yb, 12, M.inkSoft, X, (t.yb + t.yt) / 2, Z, (i % 2) * (Math.PI / 12));
    kit.cyl(t.rt * 0.985, t.rt * 0.985, 0.06, 12, M.grass, X, t.yt + 0.01, Z, (i % 2) * (Math.PI / 12));
    kit.ring(t.rt + 0.01, 0.04, 12, M.stoneShade, X, t.yt - 0.01, Z);
  }
  // 岩台的散石
  {
    const rr0 = makeRng(1207);
    for (let i = 0; i < 10; i++) {
      const a = rr0() * TAU;
      const rr = 2.8 + rr0() * 3.2;
      const rw = 0.15 + rr0() * 0.3;
      kit.box(rw, rw * 0.75, rw * 0.9, i % 2 ? M.stoneShade : M.stoneDark,
        X + Math.cos(a) * rr, base + 2.2 + rr0() * 1.6, Z + Math.sin(a) * rr, rr0() * TAU);
    }
  }
  const tierY = (rr) => {
    for (const t of tiers) {
      if (rr <= t.rb && rr >= t.rt) {
        return t.yt - ((rr - t.rt) / (t.rb - t.rt)) * (t.yt - t.yb);
      }
    }
    return rr < 1.5 ? base + 5.2 : base + 2;
  };
  const midY = base + 4.0;
  // 香山寺主殿（坐北朝南，压在第二层山肩上）
  const hz = Z + 3.05;
  kit.box(2.6, 0.16, 1.4, M.marble, X, midY + 0.08, hz);
  kit.box(2.2, 0.5, 1.1, M.wallRed, X, midY + 0.16 + 0.25, hz);
  bakeHip(kit, M, { width: 2.6, depth: 1.3, height: 0.5, tileMat: M.roofTile }, { x: X, y: midY + 0.66, z: hz });
  // 两侧小配殿
  for (const side of [-1, 1]) {
    const px = X + side * 3.05;
    const pz = Z + 1.0;
    kit.box(0.8, 0.3, 0.6, M.wallPlaster, px, midY + 0.15, pz);
    bakeGable(kit, M, { width: 0.92, depth: 0.72, height: 0.26, tileMat: M.roofTile }, { x: px, y: midY + 0.3, z: pz });
  }
  // 琉璃塔（第三层山肩顶，八角五层，绿琉璃檐 + 金顶）
  const py = base + 5.2;
  kit.cyl(1.25, 1.4, 0.16, 8, M.marble, X, py + 0.08, Z);
  kit.cyl(1.15, 1.15, 0.04, 8, M.stoneShade, X, py + 0.18, Z);
  octaPagoda(kit, M, {
    x: X, z: Z, y: py + 0.2,
    tiers: 6, r0: 0.68, tierH: 0.36, shrink: 0.86,
    bodyMat: M.stoneShade, eaveMat: M.roofGlaze, finial: true,
  });
  // 山肩石台上的几棵松，和山坡松林
  const rng = makeRng(911);
  const nTop = quality === 'low' ? 10 : 20;
  for (let i = 0; i < nTop; i++) {
    const a = rng() * TAU;
    const rr = 1.9 + rng() * 3.5;
    const y = tierY(rr);
    pushTree(trees, 'pine', X + Math.cos(a) * rr, Z + Math.sin(a) * rr, y - 0.04, 0.4 + rng() * 0.28);
  }
  const nSlope = quality === 'low' ? 10 : 22;
  for (let i = 0; i < nSlope; i++) {
    const a = rng() * TAU;
    const rr = 4.2 + rng() * 3.0;
    pushTree(trees, 'pine', X + Math.cos(a) * rr, Z + Math.sin(a) * rr, base + 1.6 + rng() * 1.2, 0.45 + rng() * 0.3);
  }
  // 山下几棵杂树（在真地形上）
  for (let i = 0; i < 6; i++) {
    const x = X + (rng() - 0.5) * 16;
    const z = Z + 10 + (rng() - 0.5) * 6;
    pushTree(trees, 'locust', x, z, terrainHeight(x, z), 0.55 + rng() * 0.25);
  }
}

/* -------------------------------------------------------------------------- */
/*  入口                                                                        */
/* -------------------------------------------------------------------------- */

export function buildLandmarks(ctx) {
  const group = new THREE.Group();
  group.name = 'landmarks';

  const M = (ctx && ctx.mats) || {};
  const quality = (ctx && ctx.quality) || 'high';
  const kit = makeKit();
  const trees = [];

  buildTiantan(kit, M, quality, trees);
  buildBeihai(kit, M, quality, trees);
  buildSummer(kit, M, quality, trees);
  buildYuanmingyuan(kit, M, quality, trees);
  buildYuquan(kit, M, quality, trees);
  buildXiangshan(kit, M, quality, trees);
  buildGreatWall(kit, M);
  buildLugou(kit, M, quality, trees);

  kit.flush(group);
  if (trees.length) group.add(buildTrees(trees, ctx));

  group.userData.quality = quality;
  group.userData.trees = trees.length;
  return group;
}
