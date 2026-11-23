/**
 * city.js —— 中轴线、宫城、城墙九门、胡同街区、景山与钟鼓楼。
 *
 * 契约：export function buildCity(ctx) → THREE.Group
 *   坐标全部取自 layout.js（世界单位：1 = 50m，y=0 是纸面）。
 *   所有材质来自 ctx.mats，屋顶全部由 lib/roof.js 生成。
 *
 * 结构：
 *   1. 宫城：宫墙 + 四角角楼 + 午门 + 太和门 + 三台（太和/中和/保和）+ 乾清宫
 *      坤宁宫 + 神武门 + 内金水河五桥 + 东西六宫 / 廊庑；
 *   2. 中轴：天安门（含外金水桥、华表）、正阳门（城楼/箭楼/瓮城）、永定门，
 *      轴线御道与两侧细墨线；
 *   3. 城墙九门：内城矩形墙（灰砖 + 垛口 + 角台）、外城南墙，九座门楼；
 *   4. 胡同：6 片街区，程序化四合院，按材质 InstancedMesh 合批（~1000 组）；
 *   5. 景山（低多边形土山 + 五亭）、钟鼓楼；
 *   6. 道路：长安街 / 朝阳门街 / 东直门街 / 崇文门宣武门内大街，纸色带 + 双墨线。
 *
 * 性能策略：所有静态建筑按「材质」合并成一个大 BufferGeometry（Collector），
 * 胡同按「材质 × 变体」走 InstancedMesh，全模块 draw call 控制在 ~35。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { u, h } from '../lib/units.js';
import {
  PALACE, INNER_CITY, OUTER_CITY, GATES, LAKES, MODERN,
  HUANGCHENG, TAMIAO, SHEJITAN, OUTER_GATES, ALTARS, YUHE,
} from '../layout.js';
import { buildDoubleEave, hipRoofGeometry, gableRoofGeometry } from '../lib/roof.js';
import { buildGateBase, buildStairs } from '../lib/geometry.js';
import { inkMat } from '../lib/materials.js';
import { buildTrees } from '../lib/flora.js';
import { makeRng, hash2 } from '../lib/rand.js';

/* ========================================================================== */
/*  0. 基础工具                                                                */
/* ========================================================================== */

const Y_AXIS = new THREE.Vector3(0, 1, 0);

const qY = (a) => new THREE.Quaternion().setFromAxisAngle(Y_AXIS, a);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** 平移 + 绕 y 旋转 + 缩放的矩阵。 */
function M4(x = 0, y = 0, z = 0, rotY = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(V3(x, y, z), qY(rotY), V3(sx, sy, sz));
}

/** 统一几何体的属性（position / normal / uv、非索引），再施加矩阵。 */
function normalizeGeo(geo, matrix) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) {
    const n = g.attributes.position.count;
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  }
  if (matrix) g.applyMatrix4(matrix);
  return g;
}

/**
 * 按材质归并几何。所有静态（非 instanced）建筑都走这里，
 * 最终一个材质只会产出一个 draw call。
 */
class Collector {
  constructor() {
    this.buckets = new Map();
  }

  push(mat, geo, matrix) {
    if (!mat || !geo || !geo.attributes || !geo.attributes.position) return;
    const key = mat.uuid;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { mat, geos: [] };
      this.buckets.set(key, bucket);
    }
    bucket.geos.push(normalizeGeo(geo, matrix));
  }

  addBox(mat, w, hh, d, x, y, z, rotY = 0) {
    this.push(mat, new THREE.BoxGeometry(w, hh, d), M4(x, y, z, rotY));
  }

  addCylinder(mat, r, hh, x, y, z, seg = 8) {
    this.push(mat, new THREE.CylinderGeometry(r, r * 1.03, hh, seg, 1, true), M4(x, y + hh / 2, z));
  }

  /** 把一个 Mesh / Group（含屋顶 Group）整体收进来。 */
  addObject(obj, x = 0, y = 0, z = 0, rotY = 0, sy = 1) {
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    if (sy !== 1) obj.scale.y = sy;
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      if (o.isMesh && !o.isInstancedMesh) this.push(o.material, o.geometry, o.matrixWorld);
    });
    return obj;
  }

  build(name = 'city-static') {
    const group = new THREE.Group();
    group.name = name;
    for (const { mat, geos } of this.buckets.values()) {
      if (!geos.length) continue;
      const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!geo) continue;
      geo.computeBoundingSphere();
      group.add(new THREE.Mesh(geo, mat));
    }
    return group;
  }
}

/* ---------------------------- 手搓多边形（城墙 / 垛口 / 院墙） -------------- */

function makeBuilder() {
  return { pos: [], uv: [] };
}

/** 按 4 个角点添加一个四边形；out 是期望的外法线，方向不对就翻面。 */
function bQuad(b, p0, p1, p2, p3, out) {
  const e1 = V3().subVectors(p1, p0);
  const e2 = V3().subVectors(p2, p0);
  const n = V3().crossVectors(e1, e2);
  if (n.dot(out) < 0) {
    const tmp = p1;
    p1 = p3;
    p3 = tmp;
  }
  b.pos.push(
    p0.x, p0.y, p0.z,
    p1.x, p1.y, p1.z,
    p2.x, p2.y, p2.z,
    p0.x, p0.y, p0.z,
    p2.x, p2.y, p2.z,
    p3.x, p3.y, p3.z,
  );
  b.uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
}

function builderGeo(b) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.computeVertexNormals();
  return g;
}

/** 一段墙：外皮、内皮、墙顶，共 3 个面（6 三角形）。 */
function pushWallQuads(b, ax, az, bx, bz, y0, height, thickness, ox, oz) {
  const hx = (ox * thickness) / 2;
  const hz = (oz * thickness) / 2;
  const P = (x, y, z) => V3(x, y, z);
  const ao = P(ax + hx, y0, az + hz);
  const bo = P(bx + hx, y0, bz + hz);
  const ai = P(ax - hx, y0, az - hz);
  const bi = P(bx - hx, y0, bz - hz);
  const up = (p) => V3(p.x, p.y + height, p.z);
  bQuad(b, ao, bo, up(bo), up(ao), P(ox, 0, oz));
  bQuad(b, bi, ai, up(ai), up(bi), P(-ox, 0, -oz));
  bQuad(b, up(ao), up(bo), up(bi), up(ai), P(0, 1, 0));
}

/** 墙顶压顶（一条比墙略宽的窄面）。 */
function pushWallCap(b, ax, az, bx, bz, y, thickness, ox, oz) {
  const half = thickness * 0.62;
  const P = (x, yy, z) => V3(x, yy, z);
  bQuad(
    b,
    P(ax + ox * half, y + 0.004, az + oz * half),
    P(bx + ox * half, y + 0.004, bz + oz * half),
    P(bx - ox * half, y + 0.004, bz - oz * half),
    P(ax - ox * half, y + 0.004, az - oz * half),
    P(0, 1, 0),
  );
}

/* ========================================================================== */
/*  1. 屋顶封装（全部基于 lib/roof.js）                                        */
/* ========================================================================== */

/**
 * 一片庑殿 / 攒尖屋顶：只加「主脊」一根（垂脊由后期墨线表现），
 * 用于城楼、亭子、配殿这类数量多的建筑，省三角形。
 */
function pushHipRoof(coll, mats, o) {
  const {
    x = 0, y = 0, z = 0, rotY = 0,
    width, depth, height,
    tileMat = mats.roofTile,
    ridgeMat = mats.inkDark,
    eaveMat = mats.eave,
    overhang = 0.12,
    lift = 0.24,
    curve = 1.62,
    swell = 0.5,
    segU = 6,
    segV = 3,
    ridge = true,
  } = o;
  const { roof, fascia, ridgeHalf } = hipRoofGeometry({
    width, depth, height, overhang, lift, curve, swell, segU, segV,
  });
  const m = M4(x, y, z, rotY);
  coll.push(tileMat, roof, m);
  coll.push(eaveMat, fascia, m);
  if (ridge && ridgeHalf > 0.015) {
    const t = Math.max(0.022, height * 0.1);
    coll.addBox(ridgeMat, ridgeHalf * 2, t, t, x, y + height + t * 0.25, z, rotY);
    // 两端吻兽，远看是两个更深的点
    const orn = Math.max(0.03, height * 0.14);
    for (const s of [-1, 1]) {
      coll.addBox(
        ridgeMat,
        orn * 1.4,
        orn * 1.9,
        orn,
        x + Math.cos(rotY) * s * (ridgeHalf - orn * 0.4),
        y + height + orn * 1.1,
        z - Math.sin(rotY) * s * (ridgeHalf - orn * 0.4),
        rotY,
      );
    }
  }
}

/** 重檐（庑殿）：下层 + 上层，各带主脊；返回建筑总高（用于装饰定位）。 */
function pushDoubleHipRoof(coll, mats, o) {
  const { y = 0, height, eaveGap = 0.12, ...rest } = o;
  const lowerH = height * 0.62;
  const upperH = height * 0.72;
  pushHipRoof(coll, mats, { ...rest, y, height: lowerH });
  pushHipRoof(coll, mats, {
    ...rest,
    y: y + lowerH + eaveGap,
    width: (rest.width ?? 1) * 0.86,
    depth: (rest.depth ?? 1) * 0.86,
    height: upperH,
  });
  return lowerH + eaveGap + upperH;
}

/**
 * 硬山屋顶（屋面 + 檐口板 + 正脊），廊庑 / 配殿用。
 * 胡同院子的硬山在 buildCompoundVariant 里另有更省的写法。
 */
function pushGableRoofColl(coll, mats, o) {
  const {
    x = 0, y = 0, z = 0, rotY = 0,
    width, depth, height,
    tileMat = mats.roofTile,
    ridgeMat = mats.inkDark,
    eaveMat = mats.eave,
    overhang = 0.08,
    lift = 0.24,
    curve = 1.55,
    segU = 6,
    segV = 2,
  } = o;
  const { roof, fascia } = gableRoofGeometry({ width, depth, height, overhang, lift, curve, segU, segV });
  const m = M4(x, y, z, rotY);
  coll.push(tileMat, roof, m);
  coll.push(eaveMat, fascia, m);
  const t = Math.max(0.028, height * 0.12);
  const len = width + overhang * 2;
  coll.addBox(ridgeMat, len, t, t, x, y + height + t * 0.25, z, rotY);
}

/** 攒尖小亭：四角柱 + 攒尖顶 + 宝顶。 */
function addPavilion(coll, mats, o) {
  const {
    x = 0, y = 0, z = 0, size = 0.9, height = 0.5,
    tileMat = mats.roofGold, postMat = mats.wallRedDeep, finial = true,
  } = o;
  const postH = height * 0.34;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    coll.addCylinder(postMat, size * 0.022, postH, x + sx * size * 0.4, y, z + sz * size * 0.4, 6);
  }
  coll.addBox(mats.marble, size * 1.06, 0.05, size * 1.06, x, y + 0.012, z);
  pushHipRoof(coll, mats, {
    x, y: y + postH, z,
    width: size, depth: size, height: height - postH,
    tileMat, ridgeMat: tilesRidge(mats, tileMat), overhang: size * 0.08,
    lift: 0.3, curve: 1.5, segU: 4, segV: 2,
  });
  if (finial) addFinial(coll, mats, x, y + height, z, size * 0.05);
}

/** 金 / 灰瓦对应的脊色。 */
function tilesRidge(mats, tileMat) {
  // 金瓦也压深色正脊：远看是一道墨线，屋顶立刻立起来
  if (tileMat === mats.roofGold || tileMat === mats.gold || tileMat === mats.goldLight) return mats.inkDark;
  if (tileMat === mats.roofGreen) return mats.jade;
  return mats.inkDark;
}

/** 宝顶 / 金球。 */
function addFinial(coll, mats, x, y, z, r) {
  coll.push(mats.gold, new THREE.SphereGeometry(r, 8, 6), M4(x, y + r * 0.9, z));
  coll.addCylinder(mats.gold, r * 0.32, r * 2.2, x, y + r * 1.1, z, 6);
}

/* ========================================================================== */
/*  2. 台基 / 栏杆 / 小构件                                                     */
/* ========================================================================== */

function addStackTerrace(coll, mats, { x = 0, z = 0, levels, mat = mats.marble }) {
  let y = 0;
  for (const lv of levels) {
    coll.addBox(mat, lv.w, lv.h, lv.d, x, y + lv.h / 2, z);
    y += lv.h;
  }
  return y;
}

/** 汉白玉栏杆：望柱 + 压面石（数量控制得住，只给主体建筑用）。 */
function addBalustrade(coll, mat, o) {
  const {
    x = 0, z = 0, y = 0, w, d,
    spacing = 0.32, postW = 0.04, postH = 0.1, railH = 0.028,
  } = o;
  const hw = w / 2;
  const hd = d / 2;
  const edges = [
    [-hw, -hd, hw, -hd],
    [hw, -hd, hw, hd],
    [hw, hd, -hw, hd],
    [-hw, hd, -hw, -hd],
  ];
  for (const [ax, az, bx, bz] of edges) {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(2, Math.round(len / spacing));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      coll.addBox(mat, postW, postH, postW, x + ax + (bx - ax) * t, y + postH / 2, z + az + (bz - az) * t);
    }
    const rot = Math.atan2(-(bz - az), bx - ax);
    const mx = x + (ax + bx) / 2;
    const mz = z + (az + bz) / 2;
    coll.addBox(mat, len, railH, postW * 0.8, mx, y + postH * 0.82, mz, rot);
  }
}

/** 局部坐标里的方盒（城门 / 门洞用），rotY 与城台一致。 */
function addLocalBox(coll, mat, w, hh, d, lx, ly, lz, x, z, rotY) {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  coll.addBox(mat, w, hh, d, x + lx * c + lz * s, ly, z - lx * s + lz * c, rotY);
}

/* ========================================================================== */
/*  3. 宫城                                                                    */
/* ========================================================================== */

const PAL_HALF_W = PALACE.w / 2; // 9.61
const PAL_S = PALACE.south; //  7
const PAL_N = PALACE.north; // -8

/** 宫墙（朱红）+ 黄瓦压顶。 */
function addPalaceWalls(coll, mats) {
  const t = 0.26;
  const height = 0.5;
  const runs = [
    { ax: -PAL_HALF_W, az: PAL_S, bx: PAL_HALF_W, bz: PAL_S, ox: 0, oz: 1 },
    { ax: PAL_HALF_W, az: PAL_N, bx: -PAL_HALF_W, bz: PAL_N, ox: 0, oz: -1 },
    { ax: PAL_HALF_W, az: PAL_S, bx: PAL_HALF_W, bz: PAL_N, ox: 1, oz: 0 },
    { ax: -PAL_HALF_W, az: PAL_N, bx: -PAL_HALF_W, bz: PAL_S, ox: -1, oz: 0 },
  ];
  for (const r of runs) {
    const b = makeBuilder();
    pushWallQuads(b, r.ax, r.az, r.bx, r.bz, 0, height, t, r.ox, r.oz);
    coll.push(mats.wallRed, builderGeo(b));
    const len = Math.hypot(r.bx - r.ax, r.bz - r.az);
    const rot = Math.atan2(-(r.bz - r.az), r.bx - r.ax);
    coll.addBox(mats.roofGold, len + 0.2, 0.075, t + 0.17, (r.ax + r.bx) / 2, height + 0.037, (r.az + r.bz) / 2, rot);
  }
}

/** 四角角楼：多重屋顶叠出十字脊。 */
function addCornerTower(coll, mats, x, z) {
  const y0 = 0.5;
  coll.addBox(mats.wallRed, 1.3, 0.36, 1.3, x, y0 + 0.18, z);
  coll.addBox(mats.gold, 1.36, 0.035, 1.36, x, y0 + 0.36, z);
  const levels = [
    { w: 1.75, d: 0.72, h: 0.36, y: y0 + 0.36 },
    { w: 1.18, d: 0.5, h: 0.28, y: y0 + 0.72 },
    { w: 0.72, d: 0.72, h: 0.24, y: y0 + 1.0 },
  ];
  for (const lv of levels) {
    // 交叉的两片屋顶 = 十字脊
    pushHipRoof(coll, mats, {
      width: lv.w, depth: lv.d, height: lv.h, x, y: lv.y, z, rotY: 0,
      tileMat: mats.roofGold, ridgeMat: mats.gold, overhang: 0.06,
      lift: 0.3, curve: 1.5, segU: 4, segV: 2,
    });
    pushHipRoof(coll, mats, {
      width: lv.w, depth: lv.d, height: lv.h, x, y: lv.y, z, rotY: Math.PI / 2,
      tileMat: mats.roofGold, ridgeMat: mats.gold, overhang: 0.06,
      lift: 0.3, curve: 1.5, segU: 4, segV: 2,
    });
  }
  addFinial(coll, mats, x, y0 + 1.26, z, 0.06);
}

/** 午门：U 形门阙 + 重檐庑殿 + 四座阙亭。 */
function addMeridianGate(coll, mats) {
  const z = PAL_S;
  const baseH = h(16); // 0.576
  const baseW = 5.7;
  const baseD = 1.15;
  // 主城台
  coll.addBox(mats.wallRed, baseW, baseH, baseD, 0, baseH / 2, z);
  coll.addBox(mats.vermillionCap || mats.wallRedDeep, baseW + 0.06, 0.04, baseD + 0.06, 0, baseH - 0.02, z);
  // 两翼（往南伸出，形成 U 形门阙）
  for (const sx of [-1, 1]) {
    coll.addBox(mats.wallRed, 0.9, baseH * 0.92, 2.5, sx * 2.35, (baseH * 0.92) / 2, z + 1.15);
    coll.addBox(mats.wallRedDeep, 0.96, 0.05, 2.56, sx * 2.35, baseH * 0.92 + 0.02, z + 1.15);
  }
  // 门洞（三个）
  for (const dx of [-1.05, 0, 1.05]) {
    addLocalBox(coll, mats.inkDeep, 0.52, baseH * 0.56, 0.06, dx, baseH * 0.28, baseD / 2 + 0.01, 0, z, 0);
  }
  // 主楼（重檐庑殿，金瓦）
  coll.addObject(
    buildDoubleEave({
      width: 4.3, depth: 1.8, height: 0.9, eaveGap: 0.17, overhang: 0.18,
      lift: 0.26, curve: 1.6, swell: 0.5, segU: 8, segV: 4,
      tileMat: mats.roofGold, eaveMat: mats.eave, ridgeMat: mats.gold,
    }, mats),
    0, baseH, z, 0,
  );
  // 四座阙亭
  const spots = [[-2.35, z + 0.1], [2.35, z + 0.1], [-2.35, z + 1.9], [2.35, z + 1.9]];
  for (const [px, pz] of spots) {
    coll.addBox(mats.wallRed, 0.8, 0.32, 0.8, px, baseH * 0.92 + 0.16, pz);
    pushHipRoof(coll, mats, {
      width: 0.98, depth: 0.98, height: 0.42, x: px, y: baseH * 0.92 + 0.32, z: pz,
      tileMat: mats.roofGold, ridgeMat: mats.gold, overhang: 0.07, lift: 0.3, curve: 1.5, segU: 4, segV: 2,
    });
    addFinial(coll, mats, px, baseH * 0.92 + 0.76, pz, 0.045);
  }
}

/** 神武门（宫城北门）。 */
function addShenwuGate(coll, mats) {
  const z = PAL_N;
  const baseH = h(15);
  coll.addBox(mats.wallRed, 3.9, baseH, 1.05, 0, baseH / 2, z);
  addLocalBox(coll, mats.inkDeep, 0.7, baseH * 0.5, 0.06, 0, baseH * 0.25, 0.53, 0, z, Math.PI);
  coll.addObject(
    buildDoubleEave({
      width: 3.0, depth: 1.25, height: 0.68, eaveGap: 0.13, overhang: 0.15,
      lift: 0.26, curve: 1.6, swell: 0.5, segU: 7, segV: 4,
      tileMat: mats.roofGold, eaveMat: mats.eave, ridgeMat: mats.gold,
    }, mats),
    0, baseH, z, 0,
  );
}

/** 东华门 / 西华门（宫城东西门，简化）。 */
function addSideGate(coll, mats, sx) {
  const x = sx * PAL_HALF_W;
  const z = u(1850) * 0 + 2.4;
  coll.addBox(mats.wallRed, 0.85, 0.4, 1.7, x, 0.2, z);
  addLocalBox(coll, mats.inkDeep, 0.06, 0.18, 0.55, sx * 0.39, 0.11, 0, x, z, -sx * Math.PI / 2);
  pushHipRoof(coll, mats, {
    width: 0.85, depth: 1.9, height: 0.42, x, y: 0.4, z,
    tileMat: mats.roofGold, ridgeMat: mats.gold, overhang: 0.08, lift: 0.26, curve: 1.5, segU: 4, segV: 2,
  });
}

/**
 * 一般殿宇：台基 + 屋身 + 屋顶 + 柱列 + 门窗。
 * gold=true 用金瓦，double=true 用重檐。
 */
function addPalaceHall(coll, mats, o) {
  const {
    x = 0, z = 0, y0 = 0,
    w, d, bodyH, roofH,
    terrace = null, // [{h,w,d}]
    gold = true,
    double = false,
    tileMat = null,
    roofW = null,
    roofD = null,
    columns = 0,
    doors = true,
    segU = 8,
    segV = 4,
    eaveGap = 0.1,
    overhang = 0.14,
    finial = false,
    bodyMat = mats.wallRed,
  } = o;
  let y = y0;
  if (terrace) y = y0 + addStackTerrace(coll, mats, { x, z, levels: terrace });
  if (terrace && o.stairs) {
    coll.addObject(
      buildStairs({ width: o.stairs.width ?? w * 0.24, depth: 0.72, height: y - y0, steps: 5, mat: mats.marble }),
      x, y0, z + (terrace[terrace.length - 1].d / 2 + 0.36), Math.PI,
    );
  }
  // 屋身
  coll.addBox(bodyMat, w, bodyH, d, x, y + bodyH / 2, z);
  // 檐下柱列（正面）
  if (columns > 0) {
    const span = w * 0.88;
    for (let i = 0; i < columns; i++) {
      const cx = x - span / 2 + (span / (columns - 1)) * i;
      coll.addCylinder(mats.wallRedDeep, 0.03, bodyH * 0.96, cx, y, z + d / 2 + 0.015, 6);
    }
  }
  // 门窗（深色横带）
  if (doors) {
    coll.addBox(mats.door, w * 0.66, bodyH * 0.56, 0.03, x, y + bodyH * 0.36, z + d / 2 + 0.02);
  }
  // 屋顶
  const rw = roofW ?? w + 0.24;
  const rd = roofD ?? d + 0.18;
  const tile = tileMat || (gold ? mats.roofGold : mats.roofTile);
  const ridgeMat = tilesRidge(mats, tile);
  if (double) {
    coll.addObject(
      buildDoubleEave({
        width: rw, depth: rd, height: roofH, eaveGap, overhang,
        lift: 0.26, curve: 1.6, swell: 0.5, segU, segV,
        tileMat: tile, eaveMat: mats.eave, ridgeMat,
      }, mats),
      x, y + bodyH, z, 0,
    );
  } else {
    pushHipRoof(coll, mats, {
      x, y: y + bodyH, z,
      width: rw, depth: rd, height: roofH,
      tileMat: tile, ridgeMat, overhang, lift: 0.26, curve: 1.6, swell: 0.5,
      segU, segV,
    });
    if (finial) addFinial(coll, mats, x, y + bodyH + roofH, z, Math.min(rw, rd) * 0.06);
  }
  return y + bodyH + roofH;
}

/** 内金水河 + 五座汉白玉桥。 */
function addGoldenWaterBridges(coll, mats) {
  const z = 5.35;
  const totalW = 8.2;
  const riverW = 0.5;
  coll.addBox(mats.inkMid, totalW, 0.006, riverW, 0, 0.004, z);
  coll.addBox(mats.inkWash, totalW, 0.006, riverW + 0.32, 0, 0.002, z);
  const xs = [-3.0, -1.5, 0, 1.5, 3.0];
  for (const bx of xs) {
    const bw = bx === 0 ? 0.62 : 0.4;
    coll.addBox(mats.marble, bw, 0.055, riverW + 0.34, bx, 0.03, z);
    for (const s of [-1, 1]) {
      coll.addBox(mats.marble, bw, 0.07, 0.022, bx, 0.075, z + s * (riverW / 2 + 0.14));
      for (const e of [-1, 1]) {
        coll.addBox(mats.marble, 0.045, 0.12, 0.045, bx + e * (bw / 2 - 0.02), 0.06, z + s * (riverW / 2 + 0.14));
      }
    }
  }
}

/** 筒子河（宫城护城河）：一圈深色水带，把金瓦红墙从灰瓦城里框出来。 */
function addPalaceMoat(coll, mats) {
  const w = 1.05; // 河宽
  const cx = PAL_HALF_W + 0.45 + w / 2; // 河道中心线
  const zS = PAL_S + 0.45 + w / 2;
  const zN = PAL_N - 0.45 - w / 2;
  const y = 0.004;
  // 东西两侧（z 向，夹在南北两段之间）
  for (const sx of [-1, 1]) {
    coll.addBox(mats.inkMid, w, 0.006, PAL_S - PAL_N - 0.9, sx * cx, y, (PAL_S + PAL_N) / 2);
    coll.addBox(mats.inkWash, w, 0.005, 0.04, sx * cx, y + 0.002, PAL_S - 0.45 + 0.0);
    coll.addBox(mats.inkWash, w, 0.005, 0.04, sx * cx, y + 0.002, PAL_N + 0.45 - 0.0);
  }
  // 南北两端（x 向，压住四角）
  for (const [sz, zc] of [[1, zS], [-1, zN]]) {
    coll.addBox(mats.inkMid, cx * 2 + w, 0.006, w, 0, y, zc);
    coll.addBox(mats.inkWash, cx * 2 + w + 0.5, 0.005, 0.04, 0, y + 0.002, zc + (sz * (w / 2 - 0.02)));
  }
  // 午门 / 神武门前的桥
  for (const [zc, depth] of [[PAL_S + 0.45 + w / 2, 1.25], [PAL_N - 0.45 - w / 2, 1.25]]) {
    coll.addBox(mats.marble, 1.5, 0.05, depth, 0, 0.028, zc);
    for (const s of [-1, 1]) coll.addBox(mats.marble, 0.03, 0.09, depth, s * 0.72, 0.06, zc);
  }
}

/** 宫城内的御道（中轴 + 两侧墨线）。 */
function addPalaceAxisRoad(coll, mats, roadMat) {
  const zMid = (PAL_S + PAL_N) / 2;
  const len = PAL_S - PAL_N - 0.6;
  if (roadMat) coll.addBox(roadMat, 0.5, 0.005, len, 0, 0.006, zMid);
  for (const s of [-1, 1]) {
    coll.addBox(mats.inkWash, 0.016, 0.006, len, s * 0.26, 0.01, zMid);
  }
}

function buildPalace(coll, mats, roadMat) {
  // ---- 宫墙与角楼 ----
  addPalaceWalls(coll, mats);
  for (const x of [-PAL_HALF_W, PAL_HALF_W]) {
    for (const z of [PAL_S, PAL_N]) addCornerTower(coll, mats, x, z);
  }
  // ---- 门 ----
  addMeridianGate(coll, mats);
  addShenwuGate(coll, mats);
  addSideGate(coll, mats, 1);
  addSideGate(coll, mats, -1);
  addPalaceAxisRoad(coll, mats, roadMat);
  // ---- 筒子河 + 内金水河 ----
  addPalaceMoat(coll, mats);
  addGoldenWaterBridges(coll, mats);
  // ---- 太和门 ----
  addPalaceHall(coll, mats, {
    x: 0, z: 3.65, w: 2.6, d: 1.05, bodyH: 0.44, roofH: 0.64,
    terrace: [{ h: 0.13, w: 3.5, d: 1.75 }, { h: 0.09, w: 3.15, d: 1.45 }],
    double: true, columns: 6, segU: 7, segV: 3, stairs: { width: 0.7 }, eaveGap: 0.14,
  });
  // ---- 三台（太和 / 中和 / 保和）----
  const terraceY = addStackTerrace(coll, mats, {
    x: 0, z: -1.45, levels: [
      { h: 0.16, w: 7.2, d: 6.8 },
      { h: 0.14, w: 6.5, d: 6.2 },
      { h: 0.12, w: 5.9, d: 5.6 },
    ],
  });
  addBalustrade(coll, mats.marble, { x: 0, z: -1.45, y: terraceY, w: 5.8, d: 5.5, spacing: 0.42, postH: 0.13 });
  // 三台南面大台阶（御路）
  coll.addObject(
    buildStairs({ width: 1.1, depth: 1.6, height: terraceY, steps: 7, mat: mats.marble }),
    0, 0, -1.45 + 2.75 + 0.8, Math.PI,
  );
  // 太和殿
  addPalaceHall(coll, mats, {
    x: 0, z: -0.3, y0: terraceY,
    w: 4.05, d: 2.6, bodyH: 0.58, roofH: 1.04,
    double: true, roofW: 5.1, roofD: 3.5, columns: 8, segU: 10, segV: 5, eaveGap: 0.21,
  });
  // 中和殿（攒尖）
  addPalaceHall(coll, mats, {
    x: 0, z: -2.0, y0: terraceY,
    w: 1.95, d: 1.95, bodyH: 0.48, roofH: 1.02,
    roofW: 2.35, roofD: 2.35, segU: 5, segV: 3, overhang: 0.1, finial: true,
  });
  // 保和殿
  addPalaceHall(coll, mats, {
    x: 0, z: -3.1, y0: terraceY,
    w: 3.4, d: 2.05, bodyH: 0.5, roofH: 0.94,
    double: true, roofW: 4.15, roofD: 2.65, columns: 6, segU: 8, segV: 4, eaveGap: 0.19,
  });
  // ---- 乾清门 ----
  addPalaceHall(coll, mats, {
    x: 0, z: -4.3, w: 1.85, d: 0.8, bodyH: 0.34, roofH: 0.44,
    terrace: [{ h: 0.1, w: 2.35, d: 1.1 }], columns: 4, segU: 6, segV: 3,
  });
  // ---- 乾清宫 ----
  addPalaceHall(coll, mats, {
    x: 0, z: -5.2, w: 2.45, d: 1.3, bodyH: 0.42, roofH: 0.64,
    terrace: [{ h: 0.13, w: 3.15, d: 1.8 }],
    double: true, roofW: 3.0, roofD: 1.8, columns: 6, segU: 7, segV: 3, eaveGap: 0.13,
  });
  // ---- 交泰殿 ----
  addPalaceHall(coll, mats, {
    x: 0, z: -6.0, w: 1.12, d: 1.12, bodyH: 0.32, roofH: 0.58,
    terrace: [{ h: 0.09, w: 1.5, d: 1.5 }],
    roofW: 1.38, roofD: 1.38, segU: 4, segV: 2, finial: true,
  });
  // ---- 坤宁宫 ----
  addPalaceHall(coll, mats, {
    x: 0, z: -6.7, w: 2.0, d: 1.08, bodyH: 0.36, roofH: 0.52,
    terrace: [{ h: 0.09, w: 2.45, d: 1.4 }],
    roofW: 2.45, roofD: 1.45, columns: 4, segU: 6, segV: 3,
  });
  // ---- 御花园 ----
  for (const [px, pz, s] of [[-1.05, -7.2, 0.55], [0, -7.2, 0.72], [1.05, -7.2, 0.55]]) {
    addPavilion(coll, mats, {
      x: px, z: pz, size: s, height: 0.8, tileMat: mats.roofGreen, postMat: mats.wallRedDeep,
    });
  }
  // ---- 广场廊庑（东西）----
  for (const sx of [-1, 1]) {
    const x = sx * 6.9;
    for (let i = 0; i < 5; i++) {
      const z = 1.5 - i * 1.25;
      coll.addBox(mats.wallRed, 0.62, 0.24, 1.02, x, 0.12, z);
      pushGableRoofColl(coll, mats, {
        width: 1.02, depth: 0.78, height: 0.28, x, y: 0.24, z, rotY: Math.PI / 2,
        tileMat: mats.roofGold, ridgeMat: mats.gold, overhang: 0.07, segU: 3, segV: 2,
      });
    }
  }
  // ---- 文华殿 / 武英殿 ----
  for (const sx of [-1, 1]) {
    addPalaceHall(coll, mats, {
      x: sx * 7.7, z: 2.9, w: 1.5, d: 0.95, bodyH: 0.32, roofH: 0.42,
      terrace: [{ h: 0.08, w: 1.95, d: 1.25 }],
      gold: true, columns: 4, segU: 5, segV: 3,
    });
  }
  // ---- 东西六宫（小院小殿，填宫城肌理）----
  for (const sx of [-1, 1]) {
    for (const gx of [4.5, 7.1]) {
      for (const gz of [-4.35, -5.55, -6.75]) {
        addPalaceHall(coll, mats, {
          x: sx * gx, z: gz, w: 1.05, d: 0.8, bodyH: 0.26, roofH: 0.3,
          terrace: [{ h: 0.06, w: 1.35, d: 1.05 }],
          gold: true, segU: 4, segV: 2, doors: true,
        });
      }
    }
  }
}

/* ========================================================================== */
/*  4. 中轴：天安门 / 正阳门 / 永定门                                           */
/* ========================================================================== */

const Z_TIANANMEN = u(1050); // 21
const Z_ZHENGYANG = u(2550); // 51
const Z_YONGDING = u(5250); // 105

const SIDE_ROT = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };

/** 一般城门：城台 + 门洞 + 重檐城楼。 */
function addGateTower(coll, mats, gate) {
  const rotY = SIDE_ROT[gate.side] ?? 0;
  const big = gate.main || gate.id === 'yongding';
  const baseW = big ? 3.9 : 3.0;
  const baseD = big ? 1.65 : 1.3;
  const baseH = h(big ? 16 : 14);
  const tileMat = mats.roofTile;
  const bodyW = baseW * 0.78;
  const bodyD = baseD * 0.7;
  const bodyH = big ? 0.42 : 0.36;
  const roofH = big ? 0.7 : 0.58;

  coll.addObject(buildGateBase({ width: baseW, depth: baseD, height: baseH, mat: mats.wallGray }), gate.x, 0, gate.z, rotY);
  // 城台压顶
  coll.addBox(mats.inkSoft, baseW + 0.1, 0.05, baseD + 0.1, gate.x, baseH + 0.02, gate.z, rotY);
  // 门洞（朝外）
  addLocalBox(coll, mats.inkDeep, baseW * 0.2, baseH * 0.52, 0.07, 0, baseH * 0.26, baseD / 2 + 0.01, gate.x, gate.z, rotY);
  // 城楼
  addLocalBox(coll, mats.wallRed, bodyW, bodyH, bodyD, 0, baseH + bodyH / 2, 0, gate.x, gate.z, rotY);
  addLocalBox(coll, mats.door, bodyW * 0.8, bodyH * 0.42, 0.03, 0, baseH + bodyH * 0.52, bodyD / 2 + 0.01, gate.x, gate.z, rotY);
  // 重檐城楼
  pushDoubleHipRoof(coll, mats, {
    x: gate.x, y: baseH + bodyH, z: gate.z, rotY,
    width: bodyW * 1.3, depth: bodyD * 1.45, height: roofH, eaveGap: big ? 0.15 : 0.13,
    tileMat, ridgeMat: mats.inkDark, overhang: 0.16, lift: 0.26, segU: 7, segV: 3,
  });
  // 角台 / 垛口由城墙统一处理
}

/** 箭楼：砖台 + 密排箭窗 + 小庑殿顶。 */
function addArrowTower(coll, mats, o) {
  const { x, z, rotY = 0, w = 2.0, d = 0.9, baseH = 0.62 } = o;
  coll.addBox(mats.wallGray, w, baseH, d, x, baseH / 2, z, rotY);
  coll.addBox(mats.inkSoft, w + 0.08, 0.05, d + 0.08, x, baseH + 0.02, z, rotY);
  addLocalBox(coll, mats.wallGray, w * 0.86, 0.42, d * 0.64, 0, baseH + 0.21, 0, x, z, rotY);
  for (let r = 0; r < 3; r++) {
    addLocalBox(coll, mats.inkDeep, w * 0.7, 0.035, 0.03, 0, baseH + 0.1 + r * 0.1, d * 0.32, x, z, rotY);
  }
  pushHipRoof(coll, mats, {
    x, y: baseH + 0.42, z, rotY,
    width: w * 0.94, depth: d * 0.78, height: 0.36,
    tileMat: mats.roofTileDark, ridgeMat: mats.inkDark, overhang: 0.1, lift: 0.24, segU: 5, segV: 2,
  });
}

/** 瓮城：两侧砖墙。 */
function addWengcheng(coll, mats, { x = 0, z0, z1, halfW, height = h(10) }) {
  for (const sx of [-1, 1]) {
    coll.addBox(mats.wallGray, 0.34, height, z1 - z0, x + sx * halfW, height / 2, (z0 + z1) / 2);
    coll.addBox(mats.inkSoft, 0.42, 0.05, z1 - z0 + 0.1, x + sx * halfW, height + 0.02, (z0 + z1) / 2);
  }
}

/** 天安门：城台 + 五门洞 + 重檐金顶 + 华表 + 外金水桥。 */
function addTiananmen(coll, mats) {
  const z = Z_TIANANMEN;
  const baseH = h(15); // 0.54
  const baseW = 5.2;
  const baseD = 1.3;
  coll.addBox(mats.wallRed, baseW, baseH, baseD, 0, baseH / 2, z);
  for (const dx of [-1.5, -0.75, 0, 0.75, 1.5]) {
    addLocalBox(coll, mats.inkDeep, 0.44, baseH * 0.5, 0.08, dx, baseH * 0.25, baseD / 2 + 0.01, 0, z, 0);
  }
  // 城楼
  coll.addBox(mats.wallRed, 3.7, 0.36, 0.92, 0, baseH + 0.18, z);
  coll.addBox(mats.door, 3.2, 0.13, 0.03, 0, baseH + 0.2, z + 0.47);
  coll.addObject(
    buildDoubleEave({
      width: 4.65, depth: 1.45, height: 0.78, eaveGap: 0.16, overhang: 0.19,
      lift: 0.27, curve: 1.6, swell: 0.5, segU: 9, segV: 4,
      tileMat: mats.roofGold, eaveMat: mats.eave, ridgeMat: mats.gold,
    }, mats),
    0, baseH + 0.36, z, 0,
  );
  // 华表（两座）
  for (const sx of [-1, 1]) {
    const px = sx * 2.9;
    const pz = z + 1.25;
    coll.addBox(mats.marble, 0.18, 0.1, 0.18, px, 0.05, pz);
    coll.addCylinder(mats.marble, 0.055, 0.62, px, 0.1, pz, 8);
    coll.addBox(mats.marble, 0.3, 0.045, 0.06, px, 0.52, pz);
    coll.addBox(mats.marble, 0.06, 0.045, 0.3, px, 0.52, pz);
    coll.addBox(mats.marble, 0.1, 0.09, 0.1, px, 0.75, pz);
  }
  // 外金水河 + 五桥
  const rz = z + 1.75;
  coll.addBox(mats.inkMid, 5.4, 0.006, 0.42, 0, 0.004, rz);
  for (const bx of [-1.9, -0.95, 0, 0.95, 1.9]) {
    const bw = bx === 0 ? 0.34 : 0.24;
    coll.addBox(mats.marble, bw, 0.045, 0.62, bx, 0.025, rz);
    for (const s of [-1, 1]) {
      coll.addBox(mats.marble, bw, 0.06, 0.02, bx, 0.065, rz + s * 0.3);
    }
  }
  // 皇城墙两翼
  for (const sx of [-1, 1]) {
    const wx = sx * (baseW / 2 + 1.5);
    coll.addBox(mats.wallRed, 3.0, h(9), 0.32, wx, h(9) / 2, z);
    coll.addBox(mats.roofGold, 3.08, 0.06, 0.42, wx, h(9) + 0.02, z);
  }
}

/** 正阳门：城楼 + 箭楼 + 瓮城。 */
function addZhengyangmen(coll, mats) {
  const z = Z_ZHENGYANG;
  addGateTower(coll, mats, { id: 'zhengyang', x: 0, z, side: 's', main: true });
  const arrowZ = z + 3.6;
  addArrowTower(coll, mats, { x: 0, z: arrowZ, rotY: 0, w: 2.6, d: 1.05, baseH: 0.64 });
  addWengcheng(coll, mats, { x: 0, z0: z + 0.95, z1: arrowZ - 0.55, halfW: 1.75, height: h(12) });
}

/** 永定门：外城正门 + 箭楼 + 瓮城。 */
function addYongdingmen(coll, mats) {
  const z = Z_YONGDING;
  addGateTower(coll, mats, { id: 'yongding', x: 0, z, side: 's', main: true, outer: true });
  const arrowZ = z + 3.4;
  addArrowTower(coll, mats, { x: 0, z: arrowZ, rotY: 0, w: 2.4, d: 1.0, baseH: 0.6 });
  addWengcheng(coll, mats, { x: 0, z0: z + 0.9, z1: arrowZ - 0.5, halfW: 1.6, height: h(11) });
}

/* ========================================================================== */
/*  5. 城墙与九门                                                              */
/* ========================================================================== */

function addCityWallRun(coll, mats, o) {
  const {
    ax, az, bx, bz, height, thickness, ox, oz, crenel = false,
  } = o;
  const body = makeBuilder();
  pushWallQuads(body, ax, az, bx, bz, 0, height, thickness, ox, oz);
  coll.push(mats.wallGray, builderGeo(body));

  const cap = makeBuilder();
  pushWallCap(cap, ax, az, bx, bz, height, thickness * 1.15, ox, oz);
  coll.push(mats.inkWash, builderGeo(cap));

  if (crenel) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len > 0.5) {
      const ux = dx / len;
      const uz = dz / len;
      const pitch = 0.55;
      const mw = 0.24;
      const mh = Math.min(0.11, height * 0.24);
      const n = Math.floor(len / pitch);
      const cb = makeBuilder();
      const half = mw / 2;
      const outN = V3(ox, 0, oz);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const cx = ax + dx * t;
        const cz = az + dz * t;
        const P = (lx, ly, lz) => V3(cx + ux * lx + ox * lz, ly, cz + uz * lx + oz * lz);
        const off = thickness * 0.42;
        bQuad(cb, P(-half, height, off), P(half, height, off), P(half, height + mh, off), P(-half, height + mh, off), outN);
        bQuad(
          cb,
          P(-half, height + mh, off),
          P(half, height + mh, off),
          P(half, height + mh, -off),
          P(-half, height + mh, -off),
          V3(0, 1, 0),
        );
      }
      coll.push(mats.inkSoft, builderGeo(cb));
    }
  }
}

function buildCityWalls(coll, mats, ctx) {
  const ih = h(15);
  const it = 0.36;
  const hx = INNER_CITY.halfX;
  const zs = INNER_CITY.south;
  const zn = INNER_CITY.north;
  const lowQuality = ctx.quality === 'low';
  // 内城四墙（灰砖 + 垛口）
  addCityWallRun(coll, mats, { ax: -hx, az: zs, bx: hx, bz: zs, height: ih, thickness: it, ox: 0, oz: 1, crenel: !lowQuality });
  addCityWallRun(coll, mats, { ax: hx, az: zn, bx: -hx, bz: zn, height: ih, thickness: it, ox: 0, oz: -1, crenel: !lowQuality });
  addCityWallRun(coll, mats, { ax: hx, az: zs, bx: hx, bz: zn, height: ih, thickness: it, ox: 1, oz: 0, crenel: !lowQuality });
  addCityWallRun(coll, mats, { ax: -hx, az: zn, bx: -hx, bz: zs, height: ih, thickness: it, ox: -1, oz: 0, crenel: !lowQuality });
  // 四座角台
  for (const [cx, cz] of [[-hx, zs], [hx, zs], [hx, zn], [-hx, zn]]) {
    coll.addBox(mats.wallGray, 1.6, ih * 1.28, 1.6, cx, (ih * 1.28) / 2, cz);
    coll.addBox(mats.inkWash, 1.7, 0.055, 1.7, cx, ih * 1.28 + 0.025, cz);
    // 角楼
    coll.addBox(mats.wallGray, 0.85, 0.34, 0.85, cx, ih * 1.28 + 0.17, cz);
    coll.addBox(mats.inkSoft, 0.9, 0.04, 0.9, cx, ih * 1.28 + 0.34, cz);
    pushHipRoof(coll, mats, {
      x: cx, y: ih * 1.28 + 0.34, z: cz, width: 1.2, depth: 1.2, height: 0.42,
      tileMat: mats.roofTileDark, ridgeMat: mats.inkDark, overhang: 0.09, lift: 0.26, segU: 4, segV: 2,
    });
  }
  // 外城：南墙 + 两侧短墙 + 与内城相接的两段
  const oh = h(13);
  const ot = 0.34;
  const ohx = OUTER_CITY.halfX;
  const os = OUTER_CITY.south;
  addCityWallRun(coll, mats, { ax: -ohx, az: os, bx: ohx, bz: os, height: oh, thickness: ot, ox: 0, oz: 1, crenel: !lowQuality });
  addCityWallRun(coll, mats, { ax: ohx, az: zs, bx: ohx, bz: os, height: oh, thickness: ot, ox: 1, oz: 0, crenel: !lowQuality });
  addCityWallRun(coll, mats, { ax: -ohx, az: os, bx: -ohx, bz: zs, height: oh, thickness: ot, ox: -1, oz: 0, crenel: !lowQuality });
  addCityWallRun(coll, mats, { ax: hx, az: zs, bx: ohx, bz: zs, height: oh, thickness: ot, ox: 0, oz: 1, crenel: false });
  addCityWallRun(coll, mats, { ax: -ohx, az: zs, bx: -hx, bz: zs, height: oh, thickness: ot, ox: 0, oz: 1, crenel: false });

  // 九门（正阳门与永定门另做细部）
  for (const gate of GATES) {
    if (gate.id === 'zhengyang') {
      addZhengyangmen(coll, mats);
      continue;
    }
    if (gate.id === 'yongding') {
      addYongdingmen(coll, mats);
      continue;
    }
    addGateTower(coll, mats, gate);
  }
  addTiananmen(coll, mats);
}

/* ========================================================================== */
/*  6. 道路                                                                    */
/* ========================================================================== */

const ROAD_DEFS = [
  // 中轴（南 → 北）。只给长安街 / 中轴压双墨线，其余只用浅纸色
  { axis: 'z', x: 0, z0: u(2550), z1: u(5250), w: 0.55, main: false }, // 前门大街
  { axis: 'z', x: 0, z0: u(1050), z1: u(2550), w: 0.68, main: true }, // 正阳门—天安门
  { axis: 'z', x: 0, z0: u(350), z1: u(1050), w: 0.75, main: true }, // 天安门—午门
  { axis: 'z', x: 0, z0: -u(2650), z1: -u(1250), w: 0.32, main: false }, // 鼓楼—景山北
  // 东西主干
  { axis: 'x', z: u(1200), x0: -INNER_CITY.halfX, x1: INNER_CITY.halfX, w: 0.6, main: true }, // 长安街
  { axis: 'x', z: u(900), x0: -INNER_CITY.halfX, x1: INNER_CITY.halfX, w: 0.4, main: false },
  { axis: 'x', z: -u(900), x0: -INNER_CITY.halfX, x1: INNER_CITY.halfX, w: 0.8, main: false },
  { axis: 'x', z: u(2350), x0: -u(2300), x1: u(2300), w: 0.36, main: false }, // 前三门大街
  // 南北次干
  { axis: 'z', x: u(1800), z0: -u(900), z1: u(2550), w: 0.36, main: false },
  { axis: 'z', x: -u(1800), z0: -u(900), z1: u(2550), w: 0.36, main: false },
  { axis: 'x', z: -u(2900), x0: -u(1500), x1: u(1500), w: 0.32, main: false }, // 鼓楼东西街
  { axis: 'z', x: -u(900), z0: INNER_CITY.north + 1.2, z1: -u(1200), w: 0.5, main: false }, // 德胜门内大街
  { axis: 'z', x: u(900), z0: INNER_CITY.north + 1.2, z1: -u(1200), w: 0.5, main: false }, // 安定门内大街
  // —— 城门外的关厢大街（纸色，不压墨边）——
  { axis: 'x', z: u(900), x0: INNER_CITY.halfX + u(120), x1: INNER_CITY.halfX + u(1500), w: 0.5, main: false },
  { axis: 'x', z: -u(900), x0: INNER_CITY.halfX + u(120), x1: INNER_CITY.halfX + u(1500), w: 0.5, main: false },
  { axis: 'x', z: u(900), x0: -INNER_CITY.halfX - u(1500), x1: -INNER_CITY.halfX - u(120), w: 0.5, main: false },
  { axis: 'x', z: -u(900), x0: -INNER_CITY.halfX - u(1500), x1: -INNER_CITY.halfX - u(120), w: 0.5, main: false },
  { axis: 'z', x: -u(900), z0: INNER_CITY.north - u(1500), z1: INNER_CITY.north - u(120), w: 0.5, main: false },
  { axis: 'z', x: u(900), z0: INNER_CITY.north - u(1500), z1: INNER_CITY.north - u(120), w: 0.5, main: false },
  { axis: 'z', x: 0, z0: OUTER_CITY.south + u(120), z1: OUTER_CITY.south + u(1400), w: 0.55, main: false },
  // 长安街延长线
  { axis: 'x', z: u(1200), x0: INNER_CITY.halfX + u(100), x1: INNER_CITY.halfX + u(2000), w: 0.5, main: false },
  { axis: 'x', z: u(1200), x0: -INNER_CITY.halfX - u(2000), x1: -INNER_CITY.halfX - u(100), w: 0.5, main: false },
  // 外城街巷
  { axis: 'x', z: u(3100), x0: -u(2400), x1: u(2400), w: 0.34, main: false },
  { axis: 'z', x: -u(2200), z0: u(2650), z1: u(5000), w: 0.32, main: false },
  { axis: 'z', x: u(2200), z0: u(2650), z1: u(5000), w: 0.32, main: false },
];

function addRoad(coll, mats, roadMat, road, idx) {
  const y = 0.005 + (idx % 5) * 0.0006;
  const lineY = y + 0.0035;
  const lineMat = mats.inkWash;
  if (road.axis === 'x') {
    const len = Math.abs(road.x1 - road.x0);
    const cx = (road.x0 + road.x1) / 2;
    coll.addBox(roadMat, len, 0.006, road.w, cx, y, road.z);
    if (road.main) {
      for (const s of [-1, 1]) {
        coll.addBox(lineMat, len, 0.005, 0.014, cx, lineY, road.z + s * (road.w / 2 - 0.025));
      }
    }
  } else {
    const len = Math.abs(road.z1 - road.z0);
    const cz = (road.z0 + road.z1) / 2;
    coll.addBox(roadMat, road.w, 0.006, len, road.x, y, cz);
    if (road.main) {
      for (const s of [-1, 1]) {
        coll.addBox(lineMat, 0.014, 0.005, len, road.x + s * (road.w / 2 - 0.025), lineY, cz);
      }
    }
  }
}

/* ========================================================================== */
/*  7. 景山 / 钟鼓楼                                                           */
/* ========================================================================== */

/** 景山高度（给树和亭子落位用）。 */
function hillHeightAt(x, z) {
  const cz = -u(650);
  const baseR = 3.8;
  const topR = 1.3;
  const height = h(46);
  const r = Math.hypot(x, z - cz);
  if (r >= baseR) return 0;
  const t = Math.min(1, Math.max(0, (baseR - r) / (baseR - topR)));
  return height * Math.pow(t, 1.45);
}

/** 低多边形土山：径向网格 + 顶点扰动，远看是纸灰里的一坨墨。 */
function hillGeometry({ rings = 5, segs = 15, baseR = 3.8, topR = 1.3, height = h(46), seed = 77 } = {}) {
  const rng = makeRng(seed);
  const rows = [];
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const rad = baseR * (1 - t) + topR * t;
    const y = height * Math.pow(t, 1.45);
    const row = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const jit = r === 0 || r === rings ? 1 : 1 + (rng() - 0.5) * 0.32;
      const yy = r === rings ? height : Math.max(0.02, y + (rng() - 0.5) * 0.13);
      row.push(V3(Math.cos(a) * rad * jit, yy, Math.sin(a) * rad * jit));
    }
    rows.push(row);
  }
  const pos = [];
  const put = (v) => pos.push(v.x, v.y, v.z);
  for (let r = 0; r < rings; r++) {
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % segs;
      const a = rows[r][i];
      const b = rows[r][j];
      const c = rows[r + 1][j];
      const d = rows[r + 1][i];
      put(a); put(c); put(b);
      put(a); put(d); put(c);
    }
  }
  const center = V3(0, height, 0);
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % segs;
    put(center); put(rows[rings][j]); put(rows[rings][i]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.computeVertexNormals();
  return g;
}

function buildJingshan(coll, mats, trees) {
  const cx = 0;
  const cz = -u(650); // -13
  const hillH = h(46);
  const baseR = 3.8;
  const topR = 1.3;
  // 土黄的山脚 → 灰绿的坡顶（两段材质叠出渐变感）
  coll.push(mats.stoneShade, new THREE.CylinderGeometry(baseR * 0.99, baseR * 1.03, 0.09, 15, 1, true), M4(cx, 0.045, cz));
  coll.push(mats.grass, hillGeometry({ rings: 5, segs: 15, baseR, topR, height: hillH, seed: 77 }), M4(cx, 0, cz));
  // 几块山石，压住轮廓
  for (const [rx, rz, s, hh] of [[-2.6, 1.6, 0.9, 0.5], [2.2, 1.9, 0.7, 0.42], [-1.5, -2.2, 0.8, 0.4], [2.9, -1.1, 0.65, 0.36]]) {
    coll.push(mats.inkWash, new THREE.ConeGeometry(s, hh, 6), M4(cx + rx, hillHeightAt(rx, cz + rz) * 0.6 + hh * 0.3, cz + rz));
  }
  // 登山石阶：从南坡上一路收到山顶
  const steps = 11;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const z = cz + (3.55 - t * 2.3);
    const y = hillHeightAt(0, z);
    coll.addBox(mats.marble, 0.34, 0.06, 0.24, cx, Math.max(0.03, y - 0.02), z);
  }
  // 山顶万春亭（三重檐、金顶）
  const topY = hillH;
  coll.addBox(mats.marble, 1.75, 0.1, 1.75, cx, topY + 0.05, cz);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    coll.addCylinder(mats.wallRedDeep, 0.038, 0.48, cx + sx * 0.54, topY + 0.1, cz + sz * 0.54, 6);
  }
  coll.addBox(mats.wallRed, 1.08, 0.13, 1.08, cx, topY + 0.61, cz);
  const eaves = [
    { w: 1.72, y: topY + 0.74, h: 0.4 },
    { w: 1.34, y: topY + 0.95, h: 0.34 },
    { w: 0.98, y: topY + 1.14, h: 0.3 },
  ];
  for (const e of eaves) {
    pushHipRoof(coll, mats, {
      x: cx, y: e.y, z: cz, width: e.w, depth: e.w, height: e.h,
      tileMat: mats.roofGold, ridgeMat: mats.gold, overhang: 0.08, lift: 0.34, curve: 1.45, segU: 5, segV: 2,
    });
  }
  addFinial(coll, mats, cx, topY + 1.14 + 0.3 + 0.1, cz, 0.075);
  // 四座配亭沿东西山脊
  for (const [ox, size] of [[-2.0, 0.62], [2.0, 0.62], [-3.1, 0.5], [3.1, 0.5]]) {
    const py = hillHeightAt(ox, cz);
    addPavilion(coll, mats, {
      x: cx + ox, y: py, z: cz, size, height: size * 1.35, tileMat: mats.roofGreen,
    });
  }
  // 景山南门（绮望楼）
  addPalaceHall(coll, mats, {
    x: 0, z: cz + 3.95, w: 1.2, d: 0.6, bodyH: 0.22, roofH: 0.3,
    terrace: [{ h: 0.07, w: 1.6, d: 0.95 }], columns: 4, segU: 5, segV: 3,
  });
}

function buildDrumBell(coll, mats) {
  const zDrum = -u(2820); // -56.4
  const zBell = -u(2990); // -59.8
  // 鼓楼：砖台 + 朱红楼身 + 重檐绿琉璃
  const bH = h(16); // 0.576
  coll.addBox(mats.wallGray, 2.9, bH, 1.9, 0, bH / 2, zDrum);
  coll.addBox(mats.inkSoft, 2.98, 0.05, 1.98, 0, bH + 0.02, zDrum);
  addLocalBox(coll, mats.inkDeep, 0.5, bH * 0.5, 0.06, 0, bH * 0.25, 0.96, 0, zDrum, 0);
  coll.addBox(mats.wallRed, 2.4, 0.34, 1.5, 0, bH + 0.17, zDrum);
  coll.addBox(mats.door, 2.0, 0.12, 0.04, 0, bH + 0.18, zDrum + 0.76);
  coll.addObject(
    buildDoubleEave({
      width: 2.9, depth: 2.0, height: 0.66, eaveGap: 0.14, overhang: 0.17,
      lift: 0.26, curve: 1.6, swell: 0.5, segU: 7, segV: 3,
      tileMat: mats.roofGreen, eaveMat: mats.eave, ridgeMat: mats.jade,
    }, mats),
    0, bH + 0.34, zDrum, 0,
  );
  // 钟楼：更高的砖台 + 灰瓦庑殿
  const tH = h(20); // 0.72
  coll.addBox(mats.stoneShade, 2.4, tH, 1.7, 0, tH / 2, zBell);
  coll.addBox(mats.inkSoft, 2.48, 0.05, 1.78, 0, tH + 0.02, zBell);
  addLocalBox(coll, mats.inkDeep, 0.46, tH * 0.46, 0.06, 0, tH * 0.23, 0.86, 0, zBell, 0);
  coll.addBox(mats.wallGray, 1.9, 0.3, 1.25, 0, tH + 0.15, zBell);
  pushHipRoof(coll, mats, {
    x: 0, y: tH + 0.3, z: zBell,
    width: 2.35, depth: 1.65, height: 0.5,
    tileMat: mats.roofTileDark, ridgeMat: mats.inkDark, overhang: 0.15, lift: 0.26, segU: 6, segV: 3,
  });
}

/* ========================================================================== */
/*  8. 胡同街区（InstancedMesh）                                               */
/* ========================================================================== */

/** 四合院的标准件尺寸（每座院子 = 一整套，实例化）。 */
const HUTONG = {
  pitchX: 1.64,
  pitchZ: 2.04,
};

/** 用四边形手搓一个「无底盒子」（5 个面 = 10 三角形），比 BoxGeometry 省 2 个面。 */
function pushBodyQuads(b, w, hh, d, cx, cy, cz, rotY = 0) {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const P = (lx, ly, lz) => V3(cx + lx * c + lz * s, cy + ly, cz - lx * s + lz * c);
  const hw = w / 2;
  const hd = d / 2;
  const hh2 = hh / 2;
  bQuad(b, P(-hw, -hh2, hd), P(hw, -hh2, hd), P(hw, hh2, hd), P(-hw, hh2, hd), P(0, 0, 1));
  bQuad(b, P(hw, -hh2, -hd), P(-hw, -hh2, -hd), P(-hw, hh2, -hd), P(hw, hh2, -hd), P(0, 0, -1));
  bQuad(b, P(hw, -hh2, hd), P(hw, -hh2, -hd), P(hw, hh2, -hd), P(hw, hh2, hd), P(1, 0, 0));
  bQuad(b, P(-hw, -hh2, -hd), P(-hw, -hh2, hd), P(-hw, hh2, hd), P(-hw, hh2, -hd), P(-1, 0, 0));
  bQuad(b, P(-hw, hh2, hd), P(hw, hh2, hd), P(hw, hh2, -hd), P(-hw, hh2, -hd), P(0, 1, 0));
}

/** 山墙屋脊：两根瘦四棱柱（正面 + 顶面），4 三角形。 */
function pushRidgeQuads(b, o) {
  const { cx, cy, cz, len, t, hh, rotY = 0 } = o;
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const P = (lx, ly, lz) => V3(cx + lx * c + lz * s, cy + ly, cz - lx * s + lz * c);
  const out = V3(s, 0, c);
  bQuad(b, P(-len / 2, 0, t / 2), P(len / 2, 0, t / 2), P(len / 2, hh, t / 2), P(-len / 2, hh, t / 2), out);
  bQuad(
    b,
    P(-len / 2, hh, t / 2),
    P(len / 2, hh, t / 2),
    P(len / 2, hh, -t / 2),
    P(-len / 2, hh, -t / 2),
    V3(0, 1, 0),
  );
}

/** 三角形（山墙用），按外法线自动翻面。 */
function bTri(b, p0, p1, p2, out) {
  const e1 = V3().subVectors(p1, p0);
  const e2 = V3().subVectors(p2, p0);
  const n = V3().crossVectors(e1, e2);
  if (n.dot(out) < 0) {
    const tmp = p1;
    p1 = p2;
    p2 = tmp;
  }
  b.pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
  b.uv.push(0, 0, 1, 0, 1, 1);
}

/** 硬山两端的三角山墙（纸白墙，撑住屋顶剪影）。 */
function pushGableEnd(b, cx, baseY, cz, w, d, roofH) {
  const hw = w / 2;
  for (const side of [-1, 1]) {
    const z = cz + side * (d / 2);
    bTri(b, V3(cx - hw, baseY, z), V3(cx + hw, baseY, z), V3(cx, baseY + roofH, z), V3(0, 0, side));
  }
}

/** 深色门窗（贴在某个立面上）。 */
function pushFacadeQuad(b, o) {
  const { cx, cy, cz, w, hh, rotY = 0, side = 1 } = o;
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const P = (lx, ly, lz) => V3(cx + lx * c + lz * s, cy + ly, cz - lx * s + lz * c);
  const out = V3(s * side, 0, c * side);
  bQuad(b, P(-w / 2, -hh / 2, 0), P(w / 2, -hh / 2, 0), P(w / 2, hh / 2, 0), P(-w / 2, hh / 2, 0), out);
}

/** 把 lib/roof.js 的几何塞进手搓 builder。 */
function pushGeoInto(builder, geo, matrix) {
  const g = normalizeGeo(geo, matrix);
  const pos = g.attributes.position.array;
  for (let i = 0; i < pos.length; i++) builder.pos.push(pos[i]);
  const uv = g.attributes.uv.array;
  for (let i = 0; i < uv.length; i++) builder.uv.push(uv[i]);
}

/** 一片硬山顶（只留屋面，檐口由后期墨线压住；胡同尺度不需要檐口板）。 */
function pushGableRoof(builder, o) {
  const {
    width, depth, height, x = 0, y = 0, z = 0, rotY = 0,
    overhang = 0.055, lift = 0.22, curve = 1.55, segU = 2, segV = 1,
  } = o;
  const geo = gableRoofGeometry({ width, depth, height, overhang, lift, curve, segU, segV });
  pushGeoInto(builder, geo.roof, M4(x, y, z, rotY));
}

/**
 * 生成一种四合院的几何（三个材质：屋顶、墙体、深色门窗）。
 * 院子尺寸约 1.15 × 1.5 世界单位（≈58m × 75m，带一点艺术夸张）。
 */
function buildCompoundVariant(seed) {
  const rng = makeRng(seed);
  const W = 1.16 + rng() * 0.08;
  const D = 1.5 + rng() * 0.08;
  const wallH = 0.15 + rng() * 0.02;
  const t = 0.05;
  const roofB = makeBuilder();
  const wallB = makeBuilder();
  const darkB = makeBuilder();

  // ---- 院墙 + 灰瓦压顶 ----
  const hw = W / 2 - t / 2;
  const hd = D / 2 - t / 2;
  pushWallQuads(wallB, -hw, -hd, hw, -hd, 0, wallH, t, 0, -1);
  pushWallQuads(wallB, hw, -hd, hw, hd, 0, wallH, t, 1, 0);
  pushWallQuads(wallB, hw, hd, -hw, hd, 0, wallH, t, 0, 1);
  pushWallQuads(wallB, -hw, hd, -hw, -hd, 0, wallH, t, -1, 0);
  pushWallCap(roofB, -hw, -hd, hw, -hd, wallH, t * 1.7, 0, -1);
  pushWallCap(roofB, hw, -hd, hw, hd, wallH, t * 1.7, 1, 0);
  pushWallCap(roofB, hw, hd, -hw, hd, wallH, t * 1.7, 0, 1);
  pushWallCap(roofB, -hw, hd, -hw, -hd, wallH, t * 1.7, -1, 0);

  // ---- 正房（北，三开间，硬山）----
  const mainZ = -D / 2 + 0.33;
  const mainW = 0.76 + rng() * 0.07;
  const mainD = 0.34;
  const mainH = 0.16 + rng() * 0.02;
  const mainRoofH = 0.26;
  pushBodyQuads(wallB, mainW, mainH, mainD, 0, mainH / 2, mainZ);
  pushGableRoof(roofB, {
    width: mainW + 0.06, depth: mainD + 0.1, height: mainRoofH, x: 0, y: mainH, z: mainZ,
    segU: 3, segV: 1, overhang: 0.06,
  });
  pushRidgeQuads(roofB, { cx: 0, cy: mainH + mainRoofH, cz: mainZ, len: mainW + 0.18, t: 0.045, hh: 0.05 });
  pushGableEnd(wallB, 0, mainH, mainZ, mainW, mainD, mainRoofH);
  pushFacadeQuad(darkB, { cx: -mainW * 0.1, cy: mainH * 0.45, cz: mainZ + mainD / 2 + 0.004, w: mainW * 0.52, hh: mainH * 0.55, side: 1 });
  pushFacadeQuad(darkB, { cx: mainW * 0.33, cy: mainH * 0.45, cz: mainZ + mainD / 2 + 0.004, w: mainW * 0.16, hh: mainH * 0.42, side: 1 });

  // ---- 倒座房（南，临街）----
  const southZ = D / 2 - 0.3;
  const southW = 0.74 + rng() * 0.07;
  const southD = 0.24;
  const southH = 0.12;
  const southRoofH = 0.2;
  pushBodyQuads(wallB, southW, southH, southD, 0, southH / 2, southZ);
  pushGableRoof(roofB, {
    width: southW + 0.06, depth: southD + 0.1, height: southRoofH, x: 0, y: southH, z: southZ,
    segU: 2, segV: 1, overhang: 0.06,
  });
  pushRidgeQuads(roofB, { cx: 0, cy: southH + southRoofH, cz: southZ, len: southW + 0.16, t: 0.04, hh: 0.045 });
  pushGableEnd(wallB, 0, southH, southZ, southW, southD, southRoofH);
  pushFacadeQuad(darkB, { cx: 0, cy: southH * 0.45, cz: southZ + southD / 2 + 0.004, w: southW * 0.5, hh: southH * 0.5, side: 1 });

  // ---- 东西厢房（屋身被院墙遮住，只保留屋顶）----
  for (const sx of [-1, 1]) {
    pushGableRoof(roofB, {
      width: 0.44, depth: 0.24, height: 0.17, x: sx * 0.44, y: 0.13, z: -0.01,
      rotY: Math.PI / 2, segU: 1, segV: 1, overhang: 0.04,
    });
    pushRidgeQuads(roofB, { cx: sx * 0.44, cy: 0.13 + 0.17, cz: -0.01, len: 0.44, t: 0.03, hh: 0.035, rotY: Math.PI / 2 });
  }

  // ---- 门楼（南墙偏东，高出墙头）----
  const gateX = 0.28;
  pushGableRoof(roofB, {
    width: 0.26, depth: 0.18, height: 0.13, x: gateX, y: 0.16, z: D / 2 - 0.04,
    segU: 1, segV: 1, overhang: 0.035,
  });
  pushRidgeQuads(roofB, { cx: gateX, cy: 0.16 + 0.13, cz: D / 2 - 0.04, len: 0.26, t: 0.028, hh: 0.028 });
  pushFacadeQuad(darkB, { cx: gateX, cy: 0.07, cz: D / 2 + 0.004, w: 0.14, hh: 0.11, side: 1 });

  // ---- 影壁（进门一道短墙）+ 水井（西南角的小石圈）----
  pushBodyQuads(wallB, 0.2, 0.11, 0.035, gateX - 0.18, 0.055, D / 2 - 0.24);
  pushBodyQuads(wallB, 0.07, 0.05, 0.07, -0.3, 0.025, D / 2 - 0.32);

  return {
    W,
    D,
    roofGeo: builderGeo(roofB),
    wallGeo: builderGeo(wallB),
    darkGeo: builderGeo(darkB),
  };
}

/** L2：一个「胡同街区」= 两排六座房 + 院墙，用于大面积填城（64 三角形/块）。 */
function pushWallLight(wallB, roofB, ax, az, bx, bz, y, height, thickness, ox, oz) {
  const hx = (ox * thickness) / 2;
  const hz = (oz * thickness) / 2;
  const P = (x, yy, z) => V3(x, yy, z);
  bQuad(
    wallB,
    P(ax + hx, y, az + hz),
    P(bx + hx, y, bz + hz),
    P(bx + hx, y + height, bz + hz),
    P(ax + hx, y + height, az + hz),
    P(ox, 0, oz),
  );
  const hw = thickness * 0.55;
  bQuad(
    roofB,
    P(ax + ox * hw, y + height + 0.004, az + oz * hw),
    P(bx + ox * hw, y + height + 0.004, bz + oz * hw),
    P(bx - ox * hw, y + height + 0.004, bz - oz * hw),
    P(ax - ox * hw, y + height + 0.004, az - oz * hw),
    V3(0, 1, 0),
  );
}

function makeBlockVariant(seed) {
  const rng = makeRng(seed);
  const W = 2.92;
  const D = 2.16;
  const wallH = 0.16;
  const t = 0.07;
  const roofB = makeBuilder();
  const wallB = makeBuilder();
  const hw = W / 2 - t / 2;
  const hd = D / 2 - t / 2;
  pushWallLight(wallB, roofB, -hw, -hd, hw, -hd, 0, wallH, t, 0, -1);
  pushWallLight(wallB, roofB, hw, -hd, hw, hd, 0, wallH, t, 1, 0);
  pushWallLight(wallB, roofB, hw, hd, -hw, hd, 0, wallH, t, 0, 1);
  pushWallLight(wallB, roofB, -hw, hd, -hw, -hd, 0, wallH, t, -1, 0);
  const rowZ = [-0.56, 0.56];
  const colX = [-0.95, 0, 0.95];
  for (const cz of rowZ) {
    for (const cx of colX) {
      const rw = 0.72 + rng() * 0.08;
      const rd = 0.6 + rng() * 0.06;
      const rh = 0.18 + rng() * 0.09;
      pushGableRoof(roofB, {
        width: rw, depth: rd, height: rh, x: cx, y: wallH, z: cz,
        segU: 1, segV: 1, overhang: 0.05,
      });
      pushRidgeQuads(roofB, { cx, cy: wallH + rh, cz, len: rw + 0.08, t: 0.035, hh: 0.04 });
    }
  }
  return { roofGeo: builderGeo(roofB), wallGeo: builderGeo(wallB) };
}

/** 在整座城（内城 + 外城）里按街区网格铺 L2，给胡同填出连片肌理。 */
function generateBlockPlacements(ctx, details) {
  const blocked = makeHutongBlockTest();
  const rng = makeRng(60607);
  const target = ctx.quality === 'low' ? 980 : 1650;
  const out = [];
  const PX = 3.55;
  const PZ = 2.78;
  const bounds = [
    // 内城
    {
      x0: -INNER_CITY.halfX + 1.4,
      x1: INNER_CITY.halfX - 1.4,
      z0: INNER_CITY.north + 1.8,
      z1: INNER_CITY.south - 1.8,
      fill: 0.97,
    },
    // 外城（避开内城护城河）
    {
      x0: -OUTER_CITY.halfX + 1.6,
      x1: OUTER_CITY.halfX - 1.6,
      z0: INNER_CITY.south + u(160),
      z1: OUTER_CITY.south - 1.8,
      fill: 0.94,
    },
    // 九门关厢 + 城郊市镇
    ...OUTSKIRT_ZONES,
  ];
  const sampleX = [-1.5, 0, 1.5];
  const sampleZ = [-1.1, 0, 1.1];
  for (const b of bounds) {
    const cols = Math.max(1, Math.floor((b.x1 - b.x0) / PX));
    const rows = Math.max(1, Math.floor((b.z1 - b.z0) / PZ));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = b.x0 + (i + 0.5) * PX + (rng() - 0.5) * 0.14;
        const z = b.z0 + (j + 0.5) * PZ + (rng() - 0.5) * 0.14;
        // 九点采样：不要把街区铺到路/湖/宫城上
        let ok = true;
        for (const ox of sampleX) {
          for (const oz of sampleZ) {
            if (blocked(x + ox, z + oz)) {
              ok = false;
              break;
            }
          }
          if (!ok) break;
        }
        if (!ok) continue;
        // 别压到精细院落（L1）
        let near = false;
        for (const d of details) {
          if (Math.abs(d.x - x) < 2.4 && Math.abs(d.z - z) < 1.9) {
            near = true;
            break;
          }
        }
        if (near) continue;
        // 少量空场（仓场 / 庙宇 / 空地），别把城填成铁板
        if (hash2(Math.floor(i / 3), Math.floor(j / 3), 77) < 0.07) continue;
        // 天坛公园边界外留一圈窄空
        const tdx = x - u(1700);
        const tdz = z - u(3550);
        const td = Math.hypot(tdx, tdz);
        if (td > u(940) && td < u(1120) && rng() > 0.5) continue;
        if (rng() > (b.fill ?? 0.95)) continue;
        out.push({
          x,
          z,
          rotY: (b.id && b.id.indexOf('men') >= 0 ? -0.04 : 0) + (rng() - 0.5) * 0.09,
          sx: 0.84 + rng() * 0.16,
          sy: 0.84 + rng() * 0.3,
          sz: 0.84 + rng() * 0.16,
          v: rng() < 0.58 ? 0 : 1,
          color: 0.88 + rng() * 0.18,
        });
      }
    }
  }
  if (out.length > target) {
    const stride = out.length / target;
    const trimmed = [];
    for (let i = 0; i < target; i++) trimmed.push(out[Math.floor(i * stride)]);
    return trimmed;
  }
  return out;
}

/** L2 街区实例化（只有屋顶与院墙两个材质）。 */
function buildBlocks(ctx, mats, placements) {
  const group = new THREE.Group();
  group.name = 'hutong-blocks';
  const variant = makeBlockVariant(22001);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  const layers = [
    { geo: variant.roofGeo, mat: mats.roofTile, tint: 0.72 },
    { geo: variant.wallGeo, mat: mats.wallPlaster, tint: 1.0 },
  ];
  for (const layer of layers) {
    const inst = new THREE.InstancedMesh(layer.geo, layer.mat, placements.length);
    inst.frustumCulled = false;
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      m4.compose(V3(p.x, 0, p.z), qY(p.rotY), V3(p.sx, p.sy, p.sz));
      inst.setMatrixAt(i, m4);
      const lum = Math.max(0.62, Math.min(1.18, p.color * layer.tint));
      col.setRGB(lum, lum, lum);
      inst.setColorAt(i, col);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
  }
  group.userData.count = placements.length;
  return group;
}

/** 6 片胡同街区（精细院落 L1）。 */
const HUTONG_DISTRICTS = [
  // 东四 / 朝阳门内
  { id: 'dongsi', x0: u(220), x1: u(1220), z0: -u(1050), z1: u(1650), angle: 0, seed: 5101, fill: 0.8 },
  // 西四 / 阜成门内（避开北海、中南海）
  { id: 'xisi', x0: -u(1320), x1: -u(240), z0: -u(950), z1: u(1650), angle: 0, seed: 6103, fill: 0.72 },
  // 南锣鼓巷
  { id: 'nanluo', x0: -u(460), x1: u(460), z0: -u(2380), z1: -u(1360), angle: 0, seed: 7107, fill: 0.74 },
  // 鼓楼 / 什刹海东（斜街）
  { id: 'gulou', x0: -u(1650), x1: u(1650), z0: -u(3080), z1: -u(2420), angle: 0.17, seed: 8111, fill: 0.62 },
  // 前门 / 外城（斜街）
  { id: 'qianmen', x0: -u(1650), x1: u(1650), z0: u(2680), z1: u(3900), angle: -0.07, seed: 9111, fill: 0.55 },
  // 崇文门内
  { id: 'chongwen', x0: u(1900), x1: u(3100), z0: u(750), z1: u(2300), angle: 0, seed: 10111, fill: 0.6 },
];

/** 城郊关厢 / 沿街市镇（护城河外约 2 单位起，沿城门大道铺开）。 */
const OUTSKIRT_ZONES = [
  { id: 'chaoyang-men', x0: INNER_CITY.halfX + u(220), x1: INNER_CITY.halfX + u(1750), z0: u(280), z1: u(1520), fill: 0.92 },
  { id: 'dongzhi-men', x0: INNER_CITY.halfX + u(220), x1: INNER_CITY.halfX + u(1750), z0: -u(1520), z1: -u(280), fill: 0.92 },
  { id: 'fucheng-men', x0: -INNER_CITY.halfX - u(1750), x1: -INNER_CITY.halfX - u(220), z0: u(280), z1: u(1520), fill: 0.92 },
  { id: 'xizhi-men', x0: -INNER_CITY.halfX - u(1750), x1: -INNER_CITY.halfX - u(220), z0: -u(1520), z1: -u(280), fill: 0.92 },
  { id: 'desheng-men', x0: -u(1500), x1: -u(160), z0: INNER_CITY.north - u(1750), z1: INNER_CITY.north - u(220), fill: 0.85 },
  { id: 'anding-men', x0: u(160), x1: u(1500), z0: INNER_CITY.north - u(1750), z1: INNER_CITY.north - u(220), fill: 0.85 },
  { id: 'yongding-men', x0: -u(1400), x1: u(1400), z0: OUTER_CITY.south + u(220), z1: OUTER_CITY.south + u(1700), fill: 0.88 },
  { id: 'chongwen-men', x0: OUTER_CITY.halfX + u(180), x1: OUTER_CITY.halfX + u(1500), z0: u(2500), z1: u(4300), fill: 0.85 },
  { id: 'xuanwu-men', x0: -OUTER_CITY.halfX - u(1500), x1: -OUTER_CITY.halfX - u(180), z0: u(2500), z1: u(4300), fill: 0.85 },
  { id: 'changan-e', x0: INNER_CITY.halfX + u(220), x1: INNER_CITY.halfX + u(2200), z0: u(1000), z1: u(1480), fill: 0.82 },
  { id: 'changan-w', x0: -INNER_CITY.halfX - u(2200), x1: -INNER_CITY.halfX - u(220), z0: u(1000), z1: u(1480), fill: 0.82 },
];

/** 庙宇（简化）：东岳庙 / 白云观 / 都城隍庙 + 几座会馆小院。 */
const TEMPLES = [
  { id: 'dongyue', x: INNER_CITY.halfX + u(300), z: u(220), scale: 1.0 },
  { id: 'baiyun', x: -u(3500), z: u(4850), scale: 1.0 },
  { id: 'chenghuang', x: -u(950), z: u(2300), scale: 0.95 },
  { id: 'huiguan1', x: -u(700), z: u(3300), scale: 0.72 },
  { id: 'huiguan2', x: -u(1900), z: u(4200), scale: 0.72 },
];

/** 仓场（皇城根的大院仓房）。 */
const WAREHOUSES = [
  { id: 'cang1', x: u(1150), z: -u(700) },
  { id: 'cang2', x: -u(1150), z: -u(1500) },
];

/** 皇城墙内侧的一圈街巷（纸色路面 + 细墨边），让皇城内部有「街」的骨架。 */
function addHuangchengStreets(coll, mats, roadMat) {
  if (!roadMat) return;
  const eX = HUANGCHENG.halfX;
  const nZ = HUANGCHENG.north;
  const sZ = HUANGCHENG.south;
  const off = 1.35;
  const w = 0.52;
  // 东、北、南三条内环街
  coll.addBox(roadMat, w, 0.006, sZ - nZ - 2.0, eX - off, 0.006, (nZ + sZ) / 2);
  coll.addBox(roadMat, w, 0.006, sZ - nZ - 2.0, eX - off - 3.6, 0.006, (nZ + sZ) / 2);
  coll.addBox(roadMat, eX * 2 - 3.2, 0.006, w, 0, 0.006, nZ + off);
  coll.addBox(roadMat, eX * 2 - 3.2, 0.006, w, 0, 0.006, nZ + off + 3.3);
  coll.addBox(roadMat, eX * 2 - 3.2, 0.006, w, 0, 0.006, sZ - off);
  // 宫城外的御道（护城河外一圈）
  coll.addBox(mats.paperShade, 0.34, 0.005, PAL_S - PAL_N + 5.0, 0, 0.007, (PAL_S + PAL_N) / 2);
  coll.addBox(mats.paperShade, PAL_HALF_W * 2 + 4.2, 0.005, 0.34, 0, 0.007, PAL_S + 2.0);
  coll.addBox(mats.paperShade, PAL_HALF_W * 2 + 4.2, 0.005, 0.34, 0, 0.007, PAL_N - 2.0);
}

/** 皇城内的官署院（也是皇城院落排布时要避开的点）。 */
const HUANGCHENG_OFFICES = [
  { x: u(850), z: -u(350) },
  { x: u(850), z: -u(850) },
  { x: -u(800), z: -u(950) },
  { x: u(650), z: -u(1050) },
];

/** 牌楼：东四 / 西四 / 前门大街 / 长安街东单。 */
const PAIFANG = [
  // 东四 / 西四（朝阳门内大街与东四、西四南北大街交叉口）
  { x: u(1600), z: u(900), rotY: 0, w: 2.6, gold: false },
  { x: -u(1600), z: u(900), rotY: 0, w: 2.6, gold: false },
  // 东单 / 西单（长安街与崇文门内、宣武门内大街交叉口）
  { x: u(1300), z: u(1200), rotY: Math.PI / 2, w: 2.4, gold: false },
  { x: -u(1300), z: u(1200), rotY: Math.PI / 2, w: 2.4, gold: false },
  // 前门大街 / 鼓楼大街
  { x: 0, z: u(3050), rotY: 0, w: 2.8, gold: true },
  { x: 0, z: -u(1500), rotY: 0, w: 2.4, gold: false },
];

/** 商铺街：前门大栅栏 / 鼓楼大街 / 东四 / 西四。 */
const SHOP_STREETS = [
  { axis: 'z', x: 0, z0: OUTER_CITY.halfX * 0 + u(2600), z1: u(5000), w: 0.9 }, // 前门大街
  { axis: 'z', x: 0, z0: -u(2600), z1: -u(1300), w: 0.85 }, // 鼓楼大街
  { axis: 'x', z: u(900), x0: u(1250), x1: u(2150), w: 0.85 }, // 东四
  { axis: 'x', z: u(900), x0: -u(2150), x1: -u(1250), w: 0.85 }, // 西四
  { axis: 'x', z: u(3250), x0: -u(1250), x1: -u(150), w: 0.7 }, // 大栅栏
];

/** 外城新增的四个侧门（永定门/左安门/右安门已由 GATES 建过）。 */
const EXTRA_OUTER_GATES = OUTER_GATES.filter((g) => !GATES.some((x) => x.id === g.id));

/** 四郊坛庙位置的合理性修正：日坛/月坛别压到内城墙和护城河上。 */
function altarPosition(altar) {
  let x = altar.x;
  let z = altar.z;
  const r = altar.r;
  if (x > INNER_CITY.halfX) x = Math.max(x, INNER_CITY.halfX + r + u(170));
  if (x < -INNER_CITY.halfX) x = Math.min(x, -INNER_CITY.halfX - r - u(170));
  if (z < INNER_CITY.north) z = Math.min(z, INNER_CITY.north - r - u(170));
  if (z > OUTER_CITY.south) z = Math.max(z, OUTER_CITY.south + r + u(170));
  return { x, z, r };
}

/** 某条湖在给定 z 高度上的 x 区间。 */
function lakeXRangeAt(lake, z, scale = 1.02) {
  const dz = (z - lake.cz) / (lake.rz * scale);
  if (Math.abs(dz) >= 1) return null;
  const half = lake.rx * scale * Math.sqrt(1 - dz * dz);
  return [lake.cx - half, lake.cx + half];
}

/** 皇城西墙：沿北海 / 中南海西岸走，不让墙压在太液池上。 */
function huangchengWestX(z) {
  let x = -HUANGCHENG.halfX;
  for (const key of ['beihai', 'zhongnanhai']) {
    const range = lakeXRangeAt(LAKES[key], z);
    if (range) x = Math.min(x, range[0] - 0.9);
  }
  return x;
}

/** 社稷坛别压在中南海上：按「湖东岸 → 宫城护城河」之间的可用宽度缩放并居中。 */
function shejitanLayout() {
  const cz = SHEJITAN.z;
  const eastLimit = -(PAL_HALF_W + 1.75);
  let westLimit = -HUANGCHENG.halfX;
  for (const l of Object.values(LAKES)) {
    const dz = (cz - l.cz) / (l.rz * 1.08);
    if (Math.abs(dz) < 1) {
      westLimit = Math.min(westLimit, l.cx + l.rx * 1.08 * Math.sqrt(1 - dz * dz));
    }
  }
  const gap = eastLimit - westLimit;
  const w = Math.max(4.2, Math.min(SHEJITAN.w, gap - 0.9));
  const d = Math.min(SHEJITAN.d, 6.4);
  return { x: (eastLimit + westLimit) / 2, z: cz, w, d };
}

/** 是否在皇城范围内（宫城 / 坛庙 / 官署 / 三海，不再铺四合院）。 */
function isInsideHuangcheng(x, z) {
  if (z < HUANGCHENG.north + 0.6 || z > HUANGCHENG.south - 0.6) return false;
  const xw = huangchengWestX(z);
  return x > xw + 0.6 && x < HUANGCHENG.halfX - 0.6;
}

/** 折线与水平线 z=zc 的交点。 */
function polylineCrossZ(pts, zc) {
  for (let i = 0; i < pts.length - 1; i++) {
    const az = pts[i][1];
    const bz = pts[i + 1][1];
    if ((az - zc) * (bz - zc) > 0 || az === bz) continue;
    const t = (zc - az) / (bz - az);
    return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, z: zc };
  }
  return null;
}

/** 折线与竖直线 x=xc 的交点。 */
function polylineCrossX(pts, xc) {
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0];
    const bx = pts[i + 1][0];
    if ((ax - xc) * (bx - xc) > 0 || ax === bx) continue;
    const t = (xc - ax) / (bx - ax);
    return { x: xc, z: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t };
  }
  return null;
}

/** 点到折线的最近距离（玉河 / 城墙带用）。 */
function distToPolyline(px, pz, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0];
    const az = pts[i][1];
    const bx = pts[i + 1][0];
    const bz = pts[i + 1][1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 > 1e-9 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + dx * t;
    const qz = az + dz * t;
    best = Math.min(best, Math.hypot(px - qx, pz - qz));
  }
  return best;
}

/** 外城七门里东便门/西便门的历史位置在内城南墙一线，数据里的 z 偏北，收回来。 */
function outerSideGateZ(gate) {
  const zMin = OUTER_CITY.north + u(120);
  const zMax = OUTER_CITY.south - u(120);
  return Math.max(zMin, Math.min(zMax, gate.z));
}

/** 避让：湖面、宫城、景山、钟鼓楼、天坛、城墙、道路。 */
function makeHutongBlockTest() {
  // 湖面按最新 layout（什刹海已经移到北城外、新增福海）
  const lakeEllipses = Object.values(LAKES).map((l) => ({
    x: l.cx,
    z: l.cz,
    rx: (l.rx || 1) * 1.04,
    rz: (l.rz || 1) * 1.04,
  }));
  const ihx = INNER_CITY.halfX;
  const izs = INNER_CITY.south;
  const izn = INNER_CITY.north;
  const ohx = OUTER_CITY.halfX;
  const os = OUTER_CITY.south;
  const zt = Z_TIANANMEN;
  const tiantan = { x: u(1700), z: u(3550), r: u(940) };
  const ncpac = { x: MODERN.ncpac.x, z: MODERN.ncpac.z, r: u(290) };
  const templeCircles = TEMPLES.map((t) => ({ x: t.x, z: t.z, r: u(300) * (t.scale || 1) }));
  const warehouseBoxes = WAREHOUSES.map((w) => ({ x: w.x, z: w.z, hx: u(460), hz: u(330) }));
  const altarCircles = Object.values(ALTARS).map((a) => {
    const pos = altarPosition(a);
    return { x: pos.x, z: pos.z, r: pos.r + 1.3 };
  });
  const outerGateCircles = OUTER_GATES.map((g) => ({
    x: g.x,
    z: g.side === 'e' || g.side === 'w' ? outerSideGateZ(g) : g.z,
    r: 2.5,
  }));

  return function blocked(x, z) {
    // 道路
    for (const r of ROAD_DEFS) {
      if (r.axis === 'x') {
        if (Math.abs(z - r.z) < r.w / 2 + 0.4 && x > r.x0 - 0.4 && x < r.x1 + 0.4) return true;
      } else {
        if (Math.abs(x - r.x) < r.w / 2 + 0.4 && z > r.z0 - 0.4 && z < r.z1 + 0.4) return true;
      }
    }
    // 宫城 + 筒子河：外面留约 3 单位
    if (Math.abs(x) < PAL_HALF_W + u(165) && z > PAL_N - u(210) && z < PAL_S + u(210)) return true;
    // 景山
    if (Math.abs(x) < u(400) && z > -u(900) && z < -u(450)) return true;
    // 钟鼓楼
    if (Math.abs(x) < u(180) && z > -u(3100) && z < -u(2750)) return true;
    // 天安门 / 正阳门 / 永定门前的广场
    if (Math.abs(x) < u(260) && z > zt - 3.4 && z < zt + 3.6) return true;
    // 棋盘街（正阳门内的一块铺装广场）
    if (Math.abs(x) < 3.2 && Math.abs(z - u(1600)) < 2.2) return true;
    if (Math.abs(x) < u(200) && z > Z_ZHENGYANG - 2 && z < Z_ZHENGYANG + 5.5) return true;
    if (Math.abs(x) < u(190) && z > Z_YONGDING - 2 && z < Z_YONGDING + 5.2) return true;
    // 湖（含新什刹海 / 福海）
    for (const l of lakeEllipses) {
      const dx = (x - l.x) / l.rx;
      const dz = (z - l.z) / l.rz;
      if (dx * dx + dz * dz < 1) return true;
    }
    // 天坛
    const tdx = x - tiantan.x;
    const tdz = z - tiantan.z;
    if (tdx * tdx + tdz * tdz < tiantan.r * tiantan.r) return true;
    // 皇城：南/北/东三段 + 沿太液池的西墙
    if (Math.abs(z - HUANGCHENG.south) < 1.3 && Math.abs(x) < HUANGCHENG.halfX + 2) return true;
    if (Math.abs(z - HUANGCHENG.north) < 1.3 && Math.abs(x) < HUANGCHENG.halfX + 2) return true;
    if (Math.abs(x - HUANGCHENG.halfX) < 1.4 && z > HUANGCHENG.north - 1 && z < HUANGCHENG.south + 1) return true;
    if (z > HUANGCHENG.north - 2 && z < HUANGCHENG.south + 2 && Math.abs(x - huangchengWestX(z)) < 1.6) return true;
    // 皇城之内是宫城、坛庙、官署与三海，不铺四合院
    if (isInsideHuangcheng(x, z)) return true;
    // 太庙 / 社稷坛 / 四郊坛庙
    if (Math.abs(x - TAMIAO.x) < TAMIAO.w / 2 + 0.7 && Math.abs(z - TAMIAO.z) < TAMIAO.d / 2 + 0.7) return true;
    const sjt = shejitanLayout();
    if (Math.abs(x - sjt.x) < sjt.w / 2 + 0.7 && Math.abs(z - sjt.z) < sjt.d / 2 + 0.7) return true;
    for (const c of altarCircles) {
      const dx = x - c.x;
      const dz = z - c.z;
      if (dx * dx + dz * dz < c.r * c.r) return true;
    }
    // 玉河故道（河岸两侧再留一点）
    if (distToPolyline(x, z, YUHE.points) < YUHE.width / 2 + 1.0) return true;
    // 商铺街：留出两侧铺面与走道
    for (const r of SHOP_STREETS) {
      if (r.axis === 'x') {
        if (Math.abs(z - r.z) < r.w / 2 + 1.7 && x > r.x0 - 1.7 && x < r.x1 + 1.7) return true;
      } else {
        if (Math.abs(x - r.x) < r.w / 2 + 1.7 && z > r.z0 - 1.7 && z < r.z1 + 1.7) return true;
      }
    }
    // 外城七门
    for (const g of outerGateCircles) {
      const dx = x - g.x;
      const dz = z - g.z;
      if (dx * dx + dz * dz < g.r * g.r) return true;
    }
    // 外城护城河（南 + 东西）
    if (z > os && z < os + u(200) && Math.abs(x) < ohx + 2.2) return true;
    if (z > izs - 1 && z < os && Math.abs(Math.abs(x) - ohx) < u(240) + 1.0) return true;
    // 现代地标（大剧院 / CBD / 奥体）
    const ndx = (x - ncpac.x) / ncpac.r;
    const ndz = (z - ncpac.z) / ncpac.r;
    if (ndx * ndx + ndz * ndz < 1) return true;
    if (x > MODERN.cbd.x - u(1100) && x < MODERN.cbd.x + u(2000) && Math.abs(z - MODERN.cbd.z) < u(1300)) return true;
    if (Math.abs(x - MODERN.nest.x) < u(1500) && Math.abs(z - MODERN.nest.z) < u(1100)) return true;
    // 庙宇 / 仓场
    for (const c of templeCircles) {
      const dx = x - c.x;
      const dz = z - c.z;
      if (dx * dx + dz * dz < c.r * c.r) return true;
    }
    for (const w of warehouseBoxes) {
      if (Math.abs(x - w.x) < w.hx && Math.abs(z - w.z) < w.hz) return true;
    }
    // 城墙带 + 护城河带（内城）
    const moatSpan = u(120) + 0.5;
    if (Math.abs(z - izs) < 1.8) return true;
    if (Math.abs(z - izn) < 1.8) return true;
    if (Math.abs(Math.abs(x) - ihx) < 1.9) return true;
    if (Math.abs(z - izs) < moatSpan + 0.4 && Math.abs(x) < ihx + moatSpan) return true;
    if (Math.abs(z - izn) < moatSpan + 0.4 && Math.abs(x) < ihx + moatSpan) return true;
    if (Math.abs(Math.abs(x) - ihx) < moatSpan + 0.4 && z > izn - moatSpan && z < izs + moatSpan) return true;
    // 外城墙
    if (Math.abs(z - os) < 2.0 && Math.abs(x) < ohx) return true;
    if (z > izs && z < os && Math.abs(Math.abs(x) - ohx) < 2.0) return true;
    return false;
  };
}

/**
 * 皇城内的院落户：衙署 / 库房 / 局厂 / 内官监，尺度比胡同四合院小、
 * 沿皇城墙内侧成行排布；宫城外留「墙—河—路—房」的层次。
 */
function generateHuangchengPlacements(ctx) {
  const rng = makeRng(7712);
  const eX = HUANGCHENG.halfX;
  const nZ = HUANGCHENG.north;
  const sZ = HUANGCHENG.south;
  const sjt = shejitanLayout();
  const palaceHx = PAL_HALF_W + 2.3;
  const palaceN = PAL_N - 2.3;
  const palaceS = PAL_S + 2.3;
  const cellOk = (x, z) => {
    if (x < huangchengWestX(z) + 1.0) return false;
    if (Math.abs(x) < palaceHx && z > palaceN && z < palaceS) return false;
    if (Math.abs(x - TAMIAO.x) < TAMIAO.w / 2 + 0.7 && Math.abs(z - TAMIAO.z) < TAMIAO.d / 2 + 0.7) return false;
    if (Math.abs(x - sjt.x) < sjt.w / 2 + 0.7 && Math.abs(z - sjt.z) < sjt.d / 2 + 0.7) return false;
    for (const o of HUANGCHENG_OFFICES) {
      if (Math.abs(x - o.x) < 3.2 && Math.abs(z - o.z) < 2.6) return false;
    }
    for (const w of WAREHOUSES) {
      if (Math.abs(x - w.x) < 2.8 && Math.abs(z - w.z) < 2.2) return false;
    }
    for (const l of Object.values(LAKES)) {
      const dx = (x - l.cx) / (l.rx * 1.05);
      const dz = (z - l.cz) / (l.rz * 1.05);
      if (dx * dx + dz * dz < 1) return false;
    }
    if (distToPolyline(x, z, YUHE.points) < YUHE.width / 2 + 1.3) return false;
    if (Math.abs(x) < u(400) && z > -u(900) && z < -u(450)) return false;
    if (Math.abs(x) < 5.0 && z > PAL_S - 0.5) return false;
    if (Math.abs(x) < 2.0 && Math.abs(z - nZ) < 2.0) return false;
    if (Math.abs(x - eX) < 2.2 && Math.abs(z - u(700)) < 2.0) return false;
    return true;
  };
  // 皇城内的可建空地：东侧衙署带、北侧、南侧、三海东岸
  const cellSet = new Set();
  const cells = [];
  const addCell = (x, z) => {
    const key = `${x.toFixed(2)}|${z.toFixed(2)}`;
    if (cellSet.has(key)) return;
    cellSet.add(key);
    cells.push([x, z]);
  };
  const PX = 1.62;
  const PZ = 1.78;
  for (let z = nZ + 1.5; z < sZ - 1.2; z += PZ) {
    // 东侧带（宫城东墙外 → 东安门内）
    for (let x = palaceHx + 0.5; x < eX - 1.2; x += PX) {
      if (cellOk(x, z)) addCell(x, z);
    }
    // 三海东岸窄带
    const wx = huangchengWestX(z) + 1.1;
    if (Math.abs(wx) > PAL_HALF_W + 2.0 && cellOk(wx, z)) addCell(wx, z);
  }
  // 北侧带（地安门内）
  for (let z = nZ + 1.5; z < palaceN - 0.3; z += PZ) {
    for (let x = -27; x < eX - 1.2; x += PX) {
      if (cellOk(x, z)) addCell(x, z);
    }
  }
  // 南侧带（太庙/社稷坛两侧）
  for (let z = palaceS + 0.3; z < sZ - 1.2; z += PZ) {
    for (let x = -27; x < eX - 1.2; x += PX) {
      if (cellOk(x, z)) addCell(x, z);
    }
  }
  const target = ctx.quality === 'low' ? 110 : 168;
  const picked = [];
  if (cells.length <= target) {
    picked.push(...cells);
  } else {
    const stride = cells.length / target;
    for (let i = 0; i < target; i++) picked.push(cells[Math.floor(i * stride + stride * 0.42) % cells.length]);
  }
  const out = [];
  for (const [x, z] of picked) {
    out.push({
      x,
      z,
      rotY: (rng() - 0.5) * 0.03,
      sx: 0.78 + rng() * 0.14,
      sy: 0.84 + rng() * 0.22,
      sz: 0.78 + rng() * 0.14,
      v: rng() < 0.6 ? 0 : 1,
      color: 0.9 + rng() * 0.14,
    });
  }
  return out;
}

/** 在街区里撒院子。 */
function generateHutongPlacements(ctx) {
  const blocked = makeHutongBlockTest();
  const rng = makeRng(20241105);
  const target = ctx.quality === 'low' ? 520 : 820;
  const out = [];
  const px = HUTONG.pitchX;
  const pz = HUTONG.pitchZ;
  for (const dist of HUTONG_DISTRICTS) {
    const cx = (dist.x0 + dist.x1) / 2;
    const cz = (dist.z0 + dist.z1) / 2;
    const cols = Math.max(1, Math.floor((dist.x1 - dist.x0) / px));
    const rows = Math.max(1, Math.floor((dist.z1 - dist.z0) / pz));
    const ca = Math.cos(dist.angle);
    const sa = Math.sin(dist.angle);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        // 主胡同：留出更宽的巷道，形成清晰的格网
        if (j % 8 === 3) continue;
        if (i % 13 === 6) continue;
        if (rng() > dist.fill) continue;
        const lx = (i - (cols - 1) / 2) * px + (rng() - 0.5) * 0.06;
        const lz = (j - (rows - 1) / 2) * pz + (rng() - 0.5) * 0.06;
        const wx = cx + lx * ca + lz * sa;
        const wz = cz - lx * sa + lz * ca;
        if (blocked(wx, wz)) continue;
        out.push({
          x: wx,
          z: wz,
          rotY: dist.angle + (rng() - 0.5) * 0.05 + (rng() < 0.05 ? Math.PI : 0),
          sx: 0.8 + rng() * 0.16,
          sy: 0.84 + rng() * 0.3,
          sz: 0.82 + rng() * 0.16,
          v: rng() < 0.58 ? 0 : 1,
          color: 0.88 + rng() * 0.18,
        });
      }
    }
  }
  // 目标数量控制：均匀抽稀，保持分布
  if (out.length > target) {
    const stride = out.length / target;
    const trimmed = [];
    for (let i = 0; i < target; i++) trimmed.push(out[Math.floor(i * stride)]);
    return trimmed;
  }
  return out;
}

/** 用实例化把院子摆进场景。 */
function buildHutongs(ctx, mats, placements) {
  const group = new THREE.Group();
  group.name = 'hutongs';
  const variants = [buildCompoundVariant(9001), buildCompoundVariant(9013)];
  const vData = variants.map((v, i) => ({
    roofGeo: v.roofGeo,
    wallGeo: v.wallGeo,
    darkGeo: v.darkGeo,
    roofMat: i === 0 ? mats.roofTile : mats.roofTileDark,
    wallMat: mats.wallPlaster,
    darkMat: mats.door,
  }));

  const byVariant = [[], []];
  for (const p of placements) byVariant[p.v].push(p);

  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  for (let v = 0; v < 2; v++) {
    const list = byVariant[v];
    if (!list.length) continue;
    const layers = [
      { geo: vData[v].roofGeo, mat: vData[v].roofMat, tint: 0.96 },
      { geo: vData[v].wallGeo, mat: vData[v].wallMat, tint: 1.0 },
      { geo: vData[v].darkGeo, mat: vData[v].darkMat, tint: 1.0 },
    ];
    for (const layer of layers) {
      const inst = new THREE.InstancedMesh(layer.geo, layer.mat, list.length);
      inst.frustumCulled = false;
      inst.name = `hutong-${v}-${layer.mat.uuid.slice(0, 4)}`;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        m4.compose(V3(p.x, 0, p.z), qY(p.rotY), V3(p.sx, p.sy, p.sz));
        inst.setMatrixAt(i, m4);
        const lum = Math.max(0.7, Math.min(1.08, p.color * layer.tint));
        col.setRGB(lum, lum, lum);
        inst.setColorAt(i, col);
      }
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      group.add(inst);
    }
  }
  group.userData.count = placements.length;
  return group;
}

/**
 * 城市里该由 city 负责的那点树：城墙根、胡同口、御花园。
 * 全部交给 lib/flora.js 的笔触树，保持和整幅画同一支笔。
 */
function collectCityTrees(trees, placements, blocks, hamlets) {
  const rng = makeRng(31415);
  // ---- 皇城墙内：街巷槐树 + 三海岸边柳/槐 ----
  const hrng = makeRng(5521);
  for (let i = 0; i < 42; i++) {
    let x;
    let z;
    if (i % 2 === 0) {
      x = HUANGCHENG.halfX - 0.9 - hrng() * 1.2;
      z = HUANGCHENG.north + 2 + hrng() * (HUANGCHENG.south - HUANGCHENG.north - 4);
    } else {
      z = HUANGCHENG.north + 1.0 + hrng() * 1.4;
      x = -HUANGCHENG.halfX + 2 + hrng() * (HUANGCHENG.halfX * 2 - 4);
    }
    if (Math.abs(x) < PAL_HALF_W + 2.6) continue;
    if (x < huangchengWestX(z) + 1.4) continue;
    const a = hrng() * Math.PI * 2;
    trees.push({ kind: 'locust', x: x + Math.cos(a) * 0.15, z: z + Math.sin(a) * 0.15, y: 0, h: 0.55 + hrng() * 0.3 });
  }
  for (const key of ['beihai', 'zhongnanhai']) {
    const l = LAKES[key];
    const pts = l.points || [];
    for (let i = 2; i < pts.length - 2; i += 3) {
      const [px, pz] = pts[i];
      const ox = px - l.cx;
      const oz = pz - l.cz;
      const d = Math.hypot(ox, oz) || 1;
      const x = px + (ox / d) * 0.7;
      const z = pz + (oz / d) * 0.7;
      if (!isInsideHuangcheng(x, z)) continue;
      if (Math.abs(x) < PAL_HALF_W + 2.8) continue;
      trees.push({ kind: hrng() < 0.3 ? 'willow' : 'locust', x, z, y: 0, h: 0.5 + hrng() * 0.3 });
    }
  }
  const all = [...(placements || []), ...(blocks || [])];
  if (!all.length) return;
  // ---- 胡同口的槐树（天坛 / 北海 / 景山的树由 landmarks / nature 负责）----
  let placed = 0;
  let guard = 0;
  while (placed < 128 && guard < 1400) {
    guard += 1;
    const p = all[Math.floor(rng() * all.length)];
    const a = rng() * Math.PI * 2;
    const r = 1.35 + rng() * 1.5;
    const x = p.x + Math.cos(a) * r;
    const z = p.z + Math.sin(a) * r * 0.85;
    let tooClose = false;
    for (const q of all) {
      if (Math.abs(q.x - x) < 0.95 && Math.abs(q.z - z) < 1.1) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    // 大部分槐树，少量花树
    trees.push({
      kind: rng() < 0.06 ? 'blossom' : 'locust',
      x,
      z,
      y: 0,
      h: 0.58 + rng() * 0.32,
    });
    placed += 1;
  }
  // ---- 城郊散树：田埂 / 村口的槐树，把城外空纸点活 ----
  const field = makeHutongBlockTest();
  const outMo = u(120) + 1.6;
  let fPlaced = 0;
  let fGuard = 0;
  while (fPlaced < (blocks && blocks.length > 1200 ? 250 : 130) && fGuard < 8000) {
    fGuard += 1;
    const x = (rng() - 0.5) * 2 * (INNER_CITY.halfX + u(2600));
    const z = INNER_CITY.north - u(2200) + rng() * (OUTER_CITY.south + u(2200) - (INNER_CITY.north - u(2200)));
    if (Math.abs(x) < INNER_CITY.halfX + outMo && z > INNER_CITY.north - outMo && z < INNER_CITY.south + outMo) continue;
    if (z > INNER_CITY.south && z < OUTER_CITY.south + 2 && Math.abs(x) < OUTER_CITY.halfX + 2) continue;
    if (field(x, z)) continue;
    trees.push({ kind: rng() < 0.05 ? 'blossom' : 'locust', x, z, y: 0, h: 0.52 + rng() * 0.34 });
    fPlaced += 1;
  }

  // ---- 城郊小村：每村一两棵树，让村口读得出来 ----
  if (hamlets && hamlets.length) {
    for (const h of hamlets) {
      if (rng() > 0.85) continue;
      trees.push({
        kind: rng() < 0.08 ? 'blossom' : 'locust',
        x: h.x + (rng() - 0.5) * 2.2,
        z: h.z + (rng() - 0.5) * 1.8,
        y: 0,
        h: 0.5 + rng() * 0.3,
      });
    }
  }
}

/* ========================================================================== */
/*  8.4 规划层：皇城 / 太庙 / 社稷坛 / 坛庙 / 外城 / 玉河 / 市街                 */
/* ========================================================================== */

/** 矩形院墙（红墙 + 瓦顶），坛庙 / 官署通用。 */
function addEnclosure(coll, mats, o) {
  const {
    x, z,
    w, d,
    hh = 0.28,
    t = 0.16,
    wallMat = mats.wallRed,
    capMat = mats.roofGold,
  } = o;
  coll.addBox(wallMat, w, hh, t, x, hh / 2, z - d / 2);
  coll.addBox(wallMat, w, hh, t, x, hh / 2, z + d / 2);
  coll.addBox(wallMat, t, hh, d, x - w / 2, hh / 2, z);
  coll.addBox(wallMat, t, hh, d, x + w / 2, hh / 2, z);
  if (capMat) {
    const ct = t + 0.08;
    coll.addBox(capMat, w + 0.1, 0.05, ct, x, hh + 0.025, z - d / 2);
    coll.addBox(capMat, w + 0.1, 0.05, ct, x, hh + 0.025, z + d / 2);
    coll.addBox(capMat, ct, 0.05, d, x - w / 2, hh + 0.025, z);
    coll.addBox(capMat, ct, 0.05, d, x + w / 2, hh + 0.025, z);
  }
}

/** 皇城小门：红城台 + 金瓦小殿。 */
function addHuangchengGate(coll, mats, o) {
  const { x, z, rotY = 0, w = 2.2, d = 0.7, big = false } = o;
  const baseH = big ? 0.36 : 0.3;
  const bodyH = 0.2;
  coll.addBox(mats.wallRed, w, baseH, d, x, baseH / 2, z, rotY);
  coll.addBox(mats.inkWash, w + 0.06, 0.03, d + 0.06, x, baseH - 0.01, z, rotY);
  addLocalBox(coll, mats.inkDeep, 0.34, baseH * 0.48, 0.06, 0, baseH * 0.24, d / 2 + 0.01, x, z, rotY);
  coll.addBox(mats.wallRed, w * 0.82, bodyH, d * 0.72, x, baseH + bodyH / 2, z, rotY);
  pushHipRoof(coll, mats, {
    x, y: baseH + bodyH, z, rotY,
    width: w * 0.98, depth: d * 1.2, height: big ? 0.3 : 0.26,
    tileMat: mats.roofGold, ridgeMat: mats.gold, overhang: 0.08, lift: 0.28, segU: 4, segV: 2,
  });
}

/** 皇城墙：红墙黄瓦，南天安门 / 北地安门 / 东西安门 / 长安左右门。 */
function addHuangcheng(coll, mats) {
  const hgt = h(12);
  const th = u(15);
  const capH = 0.06;
  const run = (ax, az, bx, bz, ox, oz) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) return;
    const b = makeBuilder();
    pushWallQuads(b, ax, az, bx, bz, 0, hgt, th, ox, oz);
    coll.push(mats.wallRed, builderGeo(b));
    const rot = Math.atan2(-(bz - az), bx - ax);
    coll.addBox(mats.roofGold, len + 0.1, capH, th + 0.03, (ax + bx) / 2, hgt + capH / 2, (az + bz) / 2, rot);
  };
  const sZ = HUANGCHENG.south;
  const nZ = HUANGCHENG.north;
  const eX = HUANGCHENG.halfX;
  const xwS = huangchengWestX(sZ);
  // 南墙：西端 → 长安右门 → 天安门 → 长安左门 → 东端
  const southRuns = [
    [xwS, -30.4],
    [-23.6, -8.9],
    [-7.1, -5.6],
    [5.6, 7.1],
    [8.9, eX],
  ];
  for (const [a, b2] of southRuns) run(a, sZ, b2, sZ, 0, 1);
  // 北墙：地安门居中，西段被太液池占掉
  for (const [a, b2] of [[-14.8, -1.2], [1.2, eX]]) run(a, nZ, b2, nZ, 0, -1);
  // 东墙：东安门
  const dongAnmenZ = u(700);
  run(eX, nZ, eX, dongAnmenZ - 1.1, 1, 0);
  run(eX, dongAnmenZ + 1.1, eX, sZ, 1, 0);
  // 西墙：沿北海 / 中南海西岸的折线
  const xianmenZ = u(500);
  let prevX = huangchengWestX(nZ);
  let prevZ = nZ;
  for (let z = nZ + 0.7; z <= sZ + 0.001; z += 0.7) {
    const xx = huangchengWestX(z);
    if (Math.abs(z - xianmenZ) > 1.1) run(prevX, prevZ, xx, z, -1, 0);
    prevX = xx;
    prevZ = z;
  }
  // 门：地安门 / 东安门 / 西安门 / 长安左门 / 长安右门（天安门已有）
  addHuangchengGate(coll, mats, { x: 0, z: nZ, rotY: Math.PI, w: 2.6, big: true });
  addHuangchengGate(coll, mats, { x: eX, z: dongAnmenZ, rotY: Math.PI / 2, w: 2.4, big: true });
  addHuangchengGate(coll, mats, { x: huangchengWestX(xianmenZ), z: xianmenZ, rotY: -Math.PI / 2, w: 2.4, big: true });
  addHuangchengGate(coll, mats, { x: u(400), z: sZ, rotY: 0, w: 1.8 });
  addHuangchengGate(coll, mats, { x: -u(400), z: sZ, rotY: 0, w: 1.8 });
}

/** 太庙：围墙 + 山门 + 三重殿 + 松柏。 */
function addTamiao(coll, mats, trees) {
  const { x, z, w, d } = TAMIAO;
  addEnclosure(coll, mats, { x, z, w, d, hh: 0.34, t: 0.18 });
  addHuangchengGate(coll, mats, { x, z: z + d / 2, rotY: 0, w: 2.6, big: true });
  const halls = [
    { z: z + 2.7, w: w * 0.62, d: d * 0.2, bodyH: 0.36, roofH: 0.46, double: true },
    { z: z + 0.2, w: w * 0.5, d: d * 0.16, bodyH: 0.3, roofH: 0.36, double: false },
    { z: z - 2.4, w: w * 0.42, d: d * 0.14, bodyH: 0.26, roofH: 0.3, double: false },
  ];
  for (const h of halls) {
    addPalaceHall(coll, mats, {
      x, z: h.z, w: h.w, d: h.d, bodyH: h.bodyH, roofH: h.roofH,
      terrace: [{ h: 0.08, w: h.w + 0.5, d: h.d + 0.4 }],
      double: h.double, columns: 4, segU: 6, segV: 3, eaveGap: 0.1,
    });
  }
  const rng = makeRng(4401);
  for (let i = 0; i < 22; i++) {
    const lx = (rng() - 0.5) * (w - 1.2);
    const lz = (rng() - 0.5) * (d - 1.2);
    trees.push({ kind: 'pine', x: x + lx, z: z + lz, y: 0, h: 0.5 + rng() * 0.35 });
  }
}

/** 社稷坛：五色土方台 + 坛墙 + 拜殿 + 松柏。 */
function addShejitan(coll, mats, trees) {
  const sjt = shejitanLayout();
  const x = sjt.x;
  const z = sjt.z;
  const w = sjt.w;
  const d = sjt.d;
  addEnclosure(coll, mats, { x, z, w, d, hh: 0.28, t: 0.16 });
  addHuangchengGate(coll, mats, { x, z: z + d / 2, rotY: 0, w: 2.4, big: true });
  // 方台（两层）
  const altarY = addStackTerrace(coll, mats, {
    x, z: z - 0.2,
    levels: [
      { h: 0.1, w: 2.6, d: 2.6 },
      { h: 0.08, w: 2.2, d: 2.2 },
      { h: 0.07, w: 1.9, d: 1.9 },
    ],
  });
  // 五色土：中黄、东青、南赤、西白、北黑
  const soil = [
    { mat: mats.roofGold, cx: 0, cz: 0 },
    { mat: mats.jade, cx: 0.46, cz: 0 },
    { mat: mats.wallRed, cx: 0, cz: 0.46 },
    { mat: mats.paperShade, cx: -0.46, cz: 0 },
    { mat: mats.inkDeep, cx: 0, cz: -0.46 },
  ];
  for (const s of soil) {
    addFlatQuad(coll, s.mat, x + s.cx, z - 0.2 + s.cz, 0.3, 0.3, 0, altarY + 0.008);
  }
  // 拜殿（北侧）
  addPalaceHall(coll, mats, {
    x, z: z - 2.0, w: w * 0.52, d: d * 0.18, bodyH: 0.3, roofH: 0.4,
    terrace: [{ h: 0.07, w: w * 0.52 + 0.5, d: d * 0.18 + 0.4 }],
    gold: false, columns: 4, segU: 5, segV: 3,
  });
  const rng = makeRng(4402);
  for (let i = 0; i < 20; i++) {
    const lx = (rng() - 0.5) * (w - 1.2);
    const lz = (rng() - 0.5) * (d - 1.2);
    if (Math.abs(lx) < 1.4 && Math.abs(lz + 0.2) < 1.4) continue;
    trees.push({ kind: 'pine', x: x + lx, z: z + lz, y: 0, h: 0.5 + rng() * 0.32 });
  }
}

/** 四郊坛庙：日坛 / 月坛 / 地坛 / 先农坛（简化）。 */
function addAltarComplex(coll, mats, trees, o) {
  const { x, z, r } = o;
  const wallSpan = r * 1.55;
  const wallH = 0.26;
  addEnclosure(coll, mats, {
    x, z, w: wallSpan, d: wallSpan, hh: wallH, t: 0.14,
    wallMat: mats.wallRed, capMat: mats.roofTileDark,
  });
  addHuangchengGate(coll, mats, { x, z: z + wallSpan / 2, rotY: 0, w: 2.2 });
  // 坛台：方形三层
  const terraces = [
    { h: 0.1, w: r * 0.62, d: r * 0.62 },
    { h: 0.08, w: r * 0.52, d: r * 0.52 },
    { h: 0.07, w: r * 0.42, d: r * 0.42 },
  ];
  const ty = addStackTerrace(coll, mats, { x, z: z - r * 0.05, levels: terraces });
  addFlatQuad(coll, mats.roofGold, x, z - r * 0.05, r * 0.2, r * 0.2, 0, ty + 0.008);
  // 殿宇（坛北）
  addPalaceHall(coll, mats, {
    x, z: z - r * 0.52, w: r * 0.56, d: r * 0.26, bodyH: 0.26, roofH: 0.34,
    terrace: [{ h: 0.06, w: r * 0.6, d: r * 0.3 }],
    gold: false, columns: 4, segU: 4, segV: 2,
  });
  const rng = makeRng(Math.floor(Math.abs(x) * 13 + Math.abs(z) * 7 + 5));
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2;
    const rr = r * (0.35 + rng() * 0.34);
    const px = x + Math.cos(a) * rr;
    const pz = z + Math.sin(a) * rr;
    // 别落在坛台上
    if (Math.abs(px - x) < r * 0.34 && Math.abs(pz - z + r * 0.05) < r * 0.34) continue;
    trees.push({ kind: 'pine', x: px, z: pz, y: 0, h: 0.45 + rng() * 0.3 });
  }
}

/** 皇城内的官署 / 衙门口：一进院 + 灰瓦正堂。 */
function addOffice(coll, mats, o) {
  const { x, z, w = 4.6, d = 3.6 } = o;
  addEnclosure(coll, mats, { x, z, w, d, hh: 0.3, t: 0.16, capMat: mats.roofTileDark });
  addHuangchengGate(coll, mats, { x, z: z + d / 2, rotY: 0, w: 2.0 });
  addPalaceHall(coll, mats, {
    x, z: z - d * 0.12, w: w * 0.58, d: d * 0.26, bodyH: 0.3, roofH: 0.36,
    terrace: [{ h: 0.07, w: w * 0.62, d: d * 0.3 }],
    gold: false, columns: 4, segU: 5, segV: 3,
  });
  for (const sx of [-1, 1]) {
    coll.addBox(mats.wallRed, 0.5, 0.22, d * 0.36, x + sx * (w * 0.36), 0.11, z - d * 0.02);
    pushHipRoof(coll, mats, {
      x: x + sx * (w * 0.36), y: 0.22, z: z - d * 0.02,
      width: 0.55, depth: d * 0.4, height: 0.2,
      tileMat: mats.roofTile, ridgeMat: mats.inkDark, overhang: 0.05, lift: 0.2, segU: 3, segV: 2,
    });
  }
}

/** 皇城内补官署 / 仓场院落。 */
function addHuangchengOffices(coll, mats) {
  for (const o of HUANGCHENG_OFFICES) addOffice(coll, mats, o);
}

/** 外城：侧门 / 角楼 / 护城河。 */
function addOuterCityExtras(coll, mats) {
  const ohx = OUTER_CITY.halfX;
  const os = OUTER_CITY.south;
  const izs = INNER_CITY.south;
  for (const g of EXTRA_OUTER_GATES) {
    const z = g.side === 'e' || g.side === 'w' ? outerSideGateZ(g) : g.z;
    addGateTower(coll, mats, { ...g, z, main: false });
    addMoatBridge(coll, mats, { ...g, z });
  }
  // 外城角楼
  for (const cx of [-ohx, ohx]) {
    for (const cz of [os]) {
      coll.addBox(mats.wallGray, 1.2, h(13) * 1.2, 1.2, cx, (h(13) * 1.2) / 2, cz);
      coll.addBox(mats.inkWash, 1.3, 0.05, 1.3, cx, h(13) * 1.2 + 0.025, cz);
      coll.addBox(mats.wallGray, 0.72, 0.3, 0.72, cx, h(13) * 1.2 + 0.15, cz);
      pushHipRoof(coll, mats, {
        x: cx, y: h(13) * 1.2 + 0.3, z: cz, width: 1.05, depth: 1.05, height: 0.36,
        tileMat: mats.roofTileDark, ridgeMat: mats.inkDark, overhang: 0.08, segU: 4, segV: 2,
      });
    }
  }
  // 外城护城河（南 + 东西）
  const mw = u(55);
  coll.addBox(mats.inkMid, ohx * 2 + 1.6, 0.006, mw, 0, 0.004, os + mw / 2 + 0.5);
  for (const sx of [-1, 1]) {
    coll.addBox(mats.inkMid, mw, 0.006, os - izs + 1.0, sx * (ohx + mw / 2 + 0.5), 0.004, (izs + os) / 2);
  }
  // 河岸淡墨线
  coll.addBox(mats.inkWash, ohx * 2 + 2.2, 0.005, 0.03, 0, 0.008, os + 0.4);
}

/** 水关：玉河穿过城墙 / 皇城处的石券水门。 */
function addWaterGate(coll, mats, o) {
  const { x, z, rotY = 0 } = o;
  const w = 2.4;
  const h = 0.52;
  const cs = Math.cos(rotY);
  const sn = Math.sin(rotY);
  for (const s of [-1, 1]) {
    const lx = s * (w / 2);
    coll.addBox(mats.stone, 0.42, h, 0.66, x + lx * cs, h / 2, z - lx * sn, rotY);
  }
  coll.addBox(mats.stone, w + 0.4, 0.14, 0.56, x, h + 0.07, z, rotY);
  pushHipRoof(coll, mats, {
    x, y: h + 0.14, z, rotY,
    width: w + 0.7, depth: 0.76, height: 0.2,
    tileMat: mats.roofTileDark, ridgeMat: mats.inkDark, overhang: 0.06, segU: 3, segV: 1,
  });
}

/** 玉河：河岸 / 石桥 / 柳（水面交给 nature / water）。 */
function addYuhe(coll, mats, trees) {
  const pts = YUHE.points;
  const halfW = YUHE.width / 2;
  const rng = makeRng(6601);
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0];
    const az = pts[i][1];
    const bx = pts[i + 1][0];
    const bz = pts[i + 1][1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.01) continue;
    const nx = -(bz - az) / len;
    const nz = (bx - ax) / len;
    const ang = Math.atan2(-(bz - az), bx - ax);
    const mx = (ax + bx) / 2;
    const mz = (az + bz) / 2;
    for (const s of [-1, 1]) {
      coll.addBox(mats.stone, len, 0.028, 0.1, mx + nx * halfW * s, 0.014, mz + nz * halfW * s, ang);
      // 岸边柳树
      const t = 0.2 + rng() * 0.6;
      trees.push({
        kind: 'willow',
        x: ax + (bx - ax) * t + nx * (halfW + 0.45) * s,
        z: az + (bz - az) * t + nz * (halfW + 0.45) * s,
        y: 0,
        h: 0.5 + rng() * 0.25,
      });
    }
  }
  // 水关：玉河穿过内城北墙、内城南墙、皇城北墙、皇城东墙
  for (const g of [
    { axis: 'z', v: INNER_CITY.north, rotY: 0 },
    { axis: 'z', v: INNER_CITY.south, rotY: 0 },
    { axis: 'z', v: HUANGCHENG.north, rotY: 0 },
    { axis: 'x', v: HUANGCHENG.halfX, rotY: Math.PI / 2 },
  ]) {
    const c = g.axis === 'z' ? polylineCrossZ(pts, g.v) : polylineCrossX(pts, g.v);
    if (c) addWaterGate(coll, mats, { x: c.x, z: c.z, rotY: g.rotY });
  }
  // 跨河石桥（主要在长安街 / 朝阳门街 / 前三门大街附近）
  for (const zc of [u(900), u(1200), u(2350)]) {
    for (let i = 0; i < pts.length - 1; i++) {
      const az = pts[i][1];
      const bz = pts[i + 1][1];
      if ((az - zc) * (bz - zc) > 0) continue;
      const t = (zc - az) / (bz - az || 1e-6);
      const bx = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t;
      const bxz = zc;
      const ang = Math.atan2(-(bz - az), pts[i + 1][0] - pts[i][0]);
      coll.addBox(mats.marble, 1.05, 0.045, halfW * 2 + 0.9, bx, 0.03, bxz, ang + Math.PI / 2);
      for (const s of [-1, 1]) {
        const px = bx + Math.cos(ang) * s * 0.46;
        const pz = bxz - Math.sin(ang) * s * 0.46;
        coll.addBox(mats.marble, 0.03, 0.09, halfW * 2 + 0.9, px, 0.06, pz, ang + Math.PI / 2);
      }
      break;
    }
  }
}

/** 商铺街：低层铺面 + 招牌 + 灯笼（前门 / 鼓楼 / 东四 / 西四 / 大栅栏）。 */
function addShopStreet(coll, mats, street) {
  const rng = makeRng(Math.floor(Math.abs(street.x || street.z) * 31 + 7));
  const step = 1.55;
  const off = street.w / 2 + 0.58;
  const place = (px, pz, rotY, idx) => {
    // 铺面
    coll.addBox(mats.wallPlaster, 0.72, 0.3, 0.62, px, 0.15, pz, rotY);
    pushGableRoofColl(coll, mats, {
      x: px, y: 0.3, z: pz, rotY: rotY + Math.PI / 2,
      width: 0.62, depth: 0.8, height: 0.24,
      tileMat: idx % 3 === 0 ? mats.roofTileDark : mats.roofTile,
      ridgeMat: mats.inkDark, overhang: 0.05, segU: 2, segV: 1,
    });
    // 门面 + 招牌 + 灯笼
    const cs = Math.cos(rotY);
    const sn = Math.sin(rotY);
    const front = (lx, ly, lz) => [px + lx * cs + lz * sn, ly, pz - lx * sn + lz * cs];
    const [dxp, dyp, dzp] = front(0, 0.14, 0.32);
    coll.addBox(mats.door, 0.34, 0.17, 0.02, dxp, dyp, dzp, rotY);
    const [sxp, syp, szp] = front(0, 0.27, 0.34);
    coll.addBox(mats.door, 0.36, 0.1, 0.03, sxp, syp, szp, rotY);
    if (idx % 2 === 0) {
      const [lxp, lyp, lzp] = front(0.3, 0.26, 0.34);
      coll.push(mats.lantern, new THREE.SphereGeometry(0.055, 6, 5), M4(lxp, lyp, lzp));
    }
  };
  if (street.axis === 'x') {
    let idx = 0;
    for (let x = street.x0 + 0.8; x < street.x1 - 0.4; x += step) {
      place(x, street.z - off, Math.PI, idx++);
      place(x, street.z + off, 0, idx++);
    }
  } else {
    let idx = 0;
    for (let z = street.z0 + 0.8; z < street.z1 - 0.4; z += step) {
      place(street.x - off, z, Math.PI / 2, idx++);
      place(street.x + off, z, -Math.PI / 2, idx++);
    }
  }
}

/** 规划层总装。 */
function buildPlanningLayer(coll, mats, roadMat, trees) {
  addHuangcheng(coll, mats);
  addHuangchengStreets(coll, mats, roadMat);
  addHuangchengOffices(coll, mats);
  addTamiao(coll, mats, trees);
  addShejitan(coll, mats, trees);
  for (const key of ['ridan', 'yuetan', 'ditan', 'xiannongtan']) {
    addAltarComplex(coll, mats, trees, altarPosition(ALTARS[key]));
  }
  addOuterCityExtras(coll, mats);
  addYuhe(coll, mats, trees);
  for (const street of SHOP_STREETS) addShopStreet(coll, mats, street);
}

/* ========================================================================== */
/*  8.5 城市细节：牌楼 / 石桥 / 棋盘街 / 庙宇 / 仓场                            */
/* ========================================================================== */

/** 一张贴在纸面上的薄四边形（农田 / 场地线用，只 2 三角形）。 */
function addFlatQuad(coll, mat, cx, cz, len, wid, rotY, y = 0.008) {
  const b = makeBuilder();
  const c = Math.cos(rotY);
  const sn = Math.sin(rotY);
  const P = (lx, lz) => V3(cx + lx * c + lz * sn, y, cz - lx * sn + lz * c);
  bQuad(
    b,
    P(-len / 2, -wid / 2),
    P(len / 2, -wid / 2),
    P(len / 2, wid / 2),
    P(-len / 2, wid / 2),
    V3(0, 1, 0),
  );
  coll.push(mat, builderGeo(b));
}

/** 城郊农田：淡墨的平行垄线，把城外大片空纸填成「有田有人家」的郊野。 */
function addFields(coll, mats) {
  const blocked = makeHutongBlockTest();
  const rng = makeRng(7447);
  const outMo = u(120) + 2.2;
  let placed = 0;
  let guard = 0;
  while (placed < 240 && guard < 8000) {
    guard += 1;
    const cx = (rng() - 0.5) * 2 * (INNER_CITY.halfX + u(3000));
    const cz = INNER_CITY.north - u(2600) + rng() * (OUTER_CITY.south + u(2600) - (INNER_CITY.north - u(2600)));
    if (Math.abs(cx) < INNER_CITY.halfX + outMo && cz > INNER_CITY.north - outMo && cz < INNER_CITY.south + outMo) continue;
    if (cz > INNER_CITY.south && cz < OUTER_CITY.south + 2 && Math.abs(cx) < OUTER_CITY.halfX + 2) continue;
    if (blocked(cx, cz)) continue;
    const ang = (rng() < 0.55 ? 0 : Math.PI / 2) + (rng() - 0.5) * 0.35;
    const rows = 3 + Math.floor(rng() * 3);
    const len = 1.3 + rng() * 1.8;
    const gap = 0.2 + rng() * 0.12;
    for (let i = 0; i < rows; i++) {
      const off = (i - (rows - 1) / 2) * gap;
      const lx = cx + off * Math.sin(ang);
      const lz = cz + off * Math.cos(ang);
      addFlatQuad(coll, mats.inkWash, lx, lz, len, 0.014, ang, 0.0075);
    }
    placed += 1;
  }
}

/** 牌楼：两对柱子 + 横枋 + 三间小屋顶。 */
function addPaifang(coll, mats, o) {
  const { x, z, rotY = 0, w = 2.4, gold = false } = o;
  const postH = 0.52;
  const cs = Math.cos(rotY);
  const sn = Math.sin(rotY);
  for (const sx of [-1, 1]) {
    for (const sz of [-0.16, 0.16]) {
      const lx = sx * (w / 2);
      coll.addCylinder(mats.wallRedDeep, 0.038, postH, x + lx * cs + sz * sn, 0, z - lx * sn + sz * cs, 6);
    }
  }
  coll.addBox(mats.wallRed, w + 0.16, 0.05, 0.1, x, postH * 0.76, z, rotY);
  coll.addBox(mats.wallRed, w + 0.34, 0.045, 0.12, x, postH * 0.94, z, rotY);
  const tileMat = gold ? mats.roofGold : mats.roofTile;
  for (const [ox, sw] of [[0, w * 0.46], [-w * 0.43, w * 0.3], [w * 0.43, w * 0.3]]) {
    pushHipRoof(coll, mats, {
      x: x + ox * cs, y: postH, z: z - ox * sn, rotY,
      width: sw, depth: 0.46, height: 0.22,
      tileMat, ridgeMat: mats.inkDark, overhang: 0.05, lift: 0.32, curve: 1.5, segU: 2, segV: 1,
    });
  }
}

/** 城门外的石桥（跨护城河）。 */
function addMoatBridge(coll, mats, gate) {
  const rotY = SIDE_ROT[gate.side] ?? 0;
  const off = u(95);
  const bx = gate.x + Math.sin(rotY) * off;
  const bz = gate.z + Math.cos(rotY) * off;
  const len = u(210);
  coll.addBox(mats.marble, 0.95, 0.035, len, bx, 0.022, bz, rotY);
  for (const s of [-1, 1]) {
    const px = bx + s * 0.44 * Math.cos(rotY);
    const pz = bz - s * 0.44 * Math.sin(rotY);
    coll.addBox(mats.marble, 0.03, 0.085, len, px, 0.055, pz, rotY);
    for (const e of [-0.3, 0, 0.3]) {
      const ex = px + e * len * Math.sin(rotY);
      const ez = pz + e * len * Math.cos(rotY);
      coll.addBox(mats.marble, 0.055, 0.13, 0.055, ex, 0.065, ez, rotY);
    }
  }
}

/** 棋盘街：正阳门内的一块方格铺装。 */
function addQipanjie(coll, mats, roadMat) {
  const z = u(1600); // 32
  coll.addBox(roadMat, 5.4, 0.005, 3.4, 0, 0.006, z);
  for (let i = -2; i <= 2; i++) {
    coll.addBox(mats.inkWash, 0.014, 0.005, 3.4, i * 1.06, 0.0095, z);
  }
  for (let i = -1; i <= 1; i++) {
    coll.addBox(mats.inkWash, 5.4, 0.005, 0.014, 0, 0.0095, z + i * 1.12);
  }
}

/** 简化庙宇：红墙院 + 山门 + 正殿 + 两配殿。 */
function addTemple(coll, mats, o) {
  const { x, z, scale = 1, rotY = 0 } = o;
  const s = scale;
  const cs = Math.cos(rotY);
  const sn = Math.sin(rotY);
  const local = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  const W = 3.4 * s;
  const D = 4.2 * s;
  const wallH = 0.22 * s;
  for (const [lx, lz, ww, dd] of [
    [0, -D / 2, W, 0.16],
    [0, D / 2, W, 0.16],
    [-W / 2, 0, 0.16, D],
    [W / 2, 0, 0.16, D],
  ]) {
    const [px, pz] = local(lx, lz);
    coll.addBox(mats.wallRed, ww, wallH, dd, px, wallH / 2, pz, rotY);
    coll.addBox(mats.roofTileDark, ww + 0.05, 0.03, dd + 0.05, px, wallH + 0.015, pz, rotY);
  }
  // 山门
  const [gx, gz] = local(0, D / 2 - 0.35 * s);
  coll.addBox(mats.wallRed, 1.0 * s, 0.3 * s, 0.5 * s, gx, 0.15 * s, gz, rotY);
  pushHipRoof(coll, mats, {
    x: gx, y: 0.3 * s, z: gz, rotY, width: 1.15 * s, depth: 0.65 * s, height: 0.3 * s,
    tileMat: mats.roofTile, ridgeMat: mats.inkDark, overhang: 0.08, lift: 0.28, segU: 3, segV: 2,
  });
  // 正殿
  const [mx, mz] = local(0, -0.7 * s);
  coll.addBox(mats.wallRed, 1.9 * s, 0.34 * s, 1.15 * s, mx, 0.17 * s, mz, rotY);
  coll.addBox(mats.door, 1.0 * s, 0.16 * s, 0.03, mx, 0.14 * s, mz + 0.58 * s, rotY);
  pushHipRoof(coll, mats, {
    x: mx, y: 0.34 * s, z: mz, rotY, width: 2.2 * s, depth: 1.4 * s, height: 0.42 * s,
    tileMat: mats.roofTile, ridgeMat: mats.inkDark, overhang: 0.12, lift: 0.28, segU: 6, segV: 3,
  });
  // 配殿
  for (const sx of [-1, 1]) {
    const [px, pz] = local(sx * 1.15 * s, -0.35 * s);
    coll.addBox(mats.wallRed, 0.6 * s, 0.26 * s, 1.05 * s, px, 0.13 * s, pz, rotY);
    pushGableRoofColl(coll, mats, {
      x: px, y: 0.26 * s, z: pz, rotY: rotY + Math.PI / 2,
      width: 1.05 * s, depth: 0.72 * s, height: 0.3 * s,
      tileMat: mats.roofTile, ridgeMat: mats.inkDark, overhang: 0.07, segU: 3, segV: 2,
    });
  }
}

/** 仓场：一进大院 + 三座长条仓房。 */
function addWarehouse(coll, mats, o) {
  const { x, z, rotY = 0 } = o;
  const W = 3.8;
  const D = 2.8;
  for (const [lx, lz, ww, dd] of [
    [0, -D / 2, W, 0.16],
    [0, D / 2, W, 0.16],
    [-W / 2, 0, 0.16, D],
    [W / 2, 0, 0.16, D],
  ]) {
    coll.addBox(mats.stoneShade, ww, 0.18, dd, x + lx * Math.cos(rotY) + lz * Math.sin(rotY), 0.09, z - lx * Math.sin(rotY) + lz * Math.cos(rotY), rotY);
  }
  for (const dz of [-0.85, 0, 0.85]) {
    coll.addBox(mats.wallPlaster, 1.7, 0.26, 0.55, x, 0.13, z + dz, rotY);
    pushGableRoofColl(coll, mats, {
      x, y: 0.26, z: z + dz, rotY,
      width: 1.8, depth: 0.66, height: 0.26,
      tileMat: mats.roofTileDark, ridgeMat: mats.inkDark, overhang: 0.07, segU: 3, segV: 2,
    });
  }
}

/** 把牌楼、桥、棋盘街、庙宇、仓场一股脑塞进静态合并层。 */
function buildCityDetails(coll, mats, roadMat, trees) {
  buildPlanningLayer(coll, mats, roadMat, trees);
  for (const p of PAIFANG) addPaifang(coll, mats, p);
  for (const g of GATES) {
    if (!g.outer) addMoatBridge(coll, mats, g);
  }
  addQipanjie(coll, mats, roadMat);
  for (const t of TEMPLES) {
    addTemple(coll, mats, t);
    const seed = Math.floor(Math.abs(t.x) * 17 + Math.abs(t.z) * 9 + 3);
    const rng = makeRng(seed);
    for (let i = 0; i < 3; i++) {
      const r = (3.0 + rng() * 1.6) * (t.scale || 1);
      const a = rng() * Math.PI * 2;
      trees.push({
        kind: i === 0 ? 'blossom' : 'locust',
        x: t.x + Math.cos(a) * r,
        z: t.z + Math.sin(a) * r,
        y: 0,
        h: 0.5 + rng() * 0.3,
      });
    }
  }
  for (const w of WAREHOUSES) addWarehouse(coll, mats, w);
  // 天坛西侧 / 先农坛周边的柏树林，让坛庙边界更清楚
  const trng = makeRng(8811);
  for (let i = 0; i < 30; i++) {
    const a = trng() * Math.PI * 2;
    const rr = u(940) + u(120) + trng() * u(130);
    const px = u(1700) + Math.cos(a) * rr;
    const pz = u(3550) + Math.sin(a) * rr;
    if (px > u(1700)) continue;
    trees.push({ kind: 'pine', x: px, z: pz, y: 0, h: 0.5 + trng() * 0.3 });
  }
  for (let i = 0; i < 18; i++) {
    const a = trng() * Math.PI * 2;
    const rr = u(1100) + trng() * u(260);
    trees.push({ kind: 'pine', x: -u(2900) + Math.cos(a) * rr, z: u(4200) + Math.sin(a) * rr, y: 0, h: 0.5 + trng() * 0.3 });
  }
  // 城外田畴交给 outskirts.js 的纸纹（几何线会变成一地的碎方块）
}

/* ========================================================================== */
/*  8.6 城郊小村（填城外空地的低层聚落）                                       */
/* ========================================================================== */

function makeHamletVariant(seed) {
  const rng = makeRng(seed);
  const roofB = makeBuilder();
  const wallB = makeBuilder();
  const W = 2.4;
  const D = 1.3;
  const hw = W / 2 - 0.03;
  const hd = D / 2 - 0.03;
  pushWallLight(wallB, roofB, -hw, -hd, hw, -hd, 0, 0.12, 0.06, 0, -1);
  pushWallLight(wallB, roofB, hw, -hd, hw, hd, 0, 0.12, 0.06, 1, 0);
  pushWallLight(wallB, roofB, hw, hd, -hw, hd, 0, 0.12, 0.06, 0, 1);
  pushWallLight(wallB, roofB, -hw, hd, -hw, -hd, 0, 0.12, 0.06, -1, 0);
  for (const cx of [-0.78, 0, 0.78]) {
    const rw = 0.6 + rng() * 0.1;
    const rd = 0.54 + rng() * 0.08;
    const rh = 0.16 + rng() * 0.06;
    const cz = -0.1;
    pushGableRoof(roofB, {
      width: rw, depth: rd, height: rh, x: cx, y: 0.12, z: cz,
      segU: 1, segV: 1, overhang: 0.04,
    });
    pushRidgeQuads(roofB, { cx, cy: 0.12 + rh, cz, len: rw + 0.06, t: 0.03, hh: 0.035 });
  }
  return { roofGeo: builderGeo(roofB), wallGeo: builderGeo(wallB) };
}

/** 在城市外围撒低层小村，把城墙外的空纸填掉。 */
function generateHamletPlacements(ctx) {
  const blocked = makeHutongBlockTest();
  const rng = makeRng(8377);
  const target = ctx.quality === 'low' ? 190 : 510;
  const out = [];
  const mo = u(120) + 1.6;
  const minX = -(INNER_CITY.halfX + u(2900));
  const maxX = INNER_CITY.halfX + u(2900);
  const minZ = INNER_CITY.north - u(2600);
  const maxZ = OUTER_CITY.south + u(2200);
  let guard = 0;
  while (out.length < target && guard < 5000) {
    guard += 1;
    const x = minX + rng() * (maxX - minX);
    const z = minZ + rng() * (maxZ - minZ);
    // 城内不摆
    if (Math.abs(x) < INNER_CITY.halfX + mo + 1.2 && z > INNER_CITY.north - mo - 1.2 && z < INNER_CITY.south + mo + 1.2) continue;
    if (z > INNER_CITY.south - 2 && z < OUTER_CITY.south + 2 && Math.abs(x) < OUTER_CITY.halfX + 2) continue;
    if (blocked(x, z)) continue;
    out.push({
      x,
      z,
      rotY: (rng() < 0.5 ? 0 : Math.PI / 2) + (rng() - 0.5) * 0.18,
      sx: 0.85 + rng() * 0.3,
      sy: 0.85 + rng() * 0.25,
      sz: 0.85 + rng() * 0.3,
      v: rng() < 0.5 ? 0 : 1,
      color: 0.88 + rng() * 0.18,
    });
  }
  return out;
}

function buildHamlets(ctx, mats, placements) {
  const group = new THREE.Group();
  group.name = 'hamlets';
  const variant = makeHamletVariant(33001);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  for (const layer of [
    { geo: variant.roofGeo, mat: mats.roofTile, tint: 0.8 },
    { geo: variant.wallGeo, mat: mats.wallPlaster, tint: 1.0 },
  ]) {
    const inst = new THREE.InstancedMesh(layer.geo, layer.mat, placements.length);
    inst.frustumCulled = false;
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      m4.compose(V3(p.x, 0, p.z), qY(p.rotY), V3(p.sx, p.sy, p.sz));
      inst.setMatrixAt(i, m4);
      const lum = Math.max(0.7, Math.min(1.12, p.color * layer.tint));
      col.setRGB(lum, lum, lum);
      inst.setColorAt(i, col);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
  }
  group.userData.count = placements.length;
  return group;
}

/* ========================================================================== */
/*  9. 构建入口                                                                */
/* ========================================================================== */

export function buildCity(ctx) {
  const mats = ctx.mats;
  const group = new THREE.Group();
  group.name = 'city';

  /* ---- 道路（浅纸色，只有主干压细墨线；单独一个材质，方便后期微调）---- */
  const coll = new Collector();
  const roadMat = inkMat(0xece2cc);
  ROAD_DEFS.forEach((road, i) => addRoad(coll, mats, roadMat, road, i));

  /* ---- 静态建筑（按材质合并）---- */
  const trees = [];
  buildCityWalls(coll, mats, ctx);
  buildPalace(coll, mats, roadMat);
  buildJingshan(coll, mats, trees);
  buildDrumBell(coll, mats);
  buildCityDetails(coll, mats, roadMat, trees);
  const staticGroup = coll.build('city-static');
  group.add(staticGroup);

  /* ---- 胡同（InstancedMesh）---- */
  const placements = generateHutongPlacements(ctx);
  // 皇城内的衙署/库房院落也走同一套 InstancedMesh（不加 draw call）
  const hcPlacements = generateHuangchengPlacements(ctx);
  placements.push(...hcPlacements);
  group.add(buildHutongs(ctx, mats, placements));
  // L2：整城铺街区，填出连片的灰瓦肌理
  const blocks = generateBlockPlacements(ctx, placements);
  group.add(buildBlocks(ctx, mats, blocks));
  // 城外小村改由 outskirts.js 立体的村舍负责；这里不再生成院墙小方块
  const hamlets = [];
  collectCityTrees(trees, placements, blocks, hamlets);

  /* ---- 树：统一用 flora 的笔触树（胡同口 / 城墙根 / 景山）---- */
  group.add(buildTrees(trees, ctx));

  // ---- 炊烟锚点：胡同院落 / 铺面屋顶上方 0.3~0.6 ----
  const smokeAnchors = [];
  const srng = makeRng(90210);
  for (let i = 0; i < placements.length && smokeAnchors.length < 200; i++) {
    const p = placements[i];
    if (srng() < 0.28) continue;
    smokeAnchors.push([
      p.x + (srng() - 0.5) * 0.6,
      0.5 + srng() * 0.24,
      p.z + (srng() - 0.5) * 0.6,
    ]);
  }
  for (let i = 0; i < blocks.length && smokeAnchors.length < 200; i++) {
    const p = blocks[i];
    if (srng() < 0.45) continue;
    smokeAnchors.push([
      p.x + (srng() - 0.5) * 1.2,
      0.45 + srng() * 0.22,
      p.z + (srng() - 0.5) * 1.2,
    ]);
  }

  group.userData.smokeAnchors = smokeAnchors;
  group.userData.hutongCount = placements.length;
  group.userData.blockCount = blocks.length;
  group.userData.hamletCount = hamlets.length;
  group.userData.staticMeshes = staticGroup.children.length;
  group.userData.treeCount = trees.length;
  return group;
}
