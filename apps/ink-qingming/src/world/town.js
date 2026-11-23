/**
 * town.js —— 城墙、城门楼与街市。
 *
 * 契约：export function buildTown(ctx) → THREE.Group（group.name = 'town'）
 *
 * 画面结构（1 世界单位 = 1 米，坐标全部取自 src/layout.js）：
 *   1. 城墙：x = 18~205、z = -44，高 9、厚 4 的夯土墙；顶部垛口、淡墨腰线、
 *      条石墙基；城门处留 16 米宽的洞，两端以角台 + 松柏收头，不突然截断；
 *   2. 城门楼：城台（拱形门洞 + 木排叉柱 + 门额 + 两尊石狮）+ 重檐门楼
 *      （腰檐 + 上层屋身 + 庑殿顶），是整幅长卷的最高点；
 *   3. 街市：城门以东 x = 58~196、街心 z = -24 的土色长街。两侧三十余家铺面
 *      （两层/单层、灰瓦/茅草、排门/柜台/檐下布棚），酒楼搭彩楼欢门、
 *      茶坊支大伞摆桌凳、香药铺立冲天招牌，另有脚店、算命摊、饼摊、
 *      货担、酒瓮、拴马桩——招牌、幌子、灯笼一路挂过去；
 *   4. 关厢：城门西侧 x = 18~44 的沿街小店、草棚、茶摊、拴马桩与草垛；
 *   5. 人：街市 90+、城门口 15、关厢 10、城墙走道上 4 个，全部 push 到
 *      ctx.people，由 people.js 统一画成小人并动画。
 *
 * 性能策略：所有静态几何按材质归并（Collector），一种材质一个 draw call；
 * 彩楼布条 / 旗幡共用一个 InstancedMesh，在 onTick 里轻轻摆。全模块 < 30 draws。
 */
import * as THREE from 'three';
import { mergeGeometries } from '../lib/merge-safe.js';
import { GROUND_Y, CITY, MARKET, northBankZ } from '../layout.js';
import { hipRoofGeometry, gableRoofGeometry } from '../lib/roof.js';
import { inkMat, setInkWeight } from '../lib/materials.js';
import { makeRng, range } from '../lib/rand.js';
import { buildTrees } from '../lib/flora.js';

/* ========================================================================== */
/*  0. 基础工具                                                                */
/* ========================================================================== */

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const qY = (a) => new THREE.Quaternion().setFromAxisAngle(Y_AXIS, a);
const M4 = (x = 0, y = 0, z = 0, rotY = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(V3(x, y, z), qY(rotY), V3(sx, sy, sz));

const G = GROUND_Y; // 1.2，岸顶地面
const WALL_Z = CITY.wallZ; // -44
const WALL_FRONT = WALL_Z + CITY.wallT / 2; // -42（南面，朝镜头）
const WALL_BACK = WALL_Z - CITY.wallT / 2; // -46
const WALL_H = CITY.wallH; // 9
const GATE_X = CITY.gateX; // 52

const STREET_Z = MARKET.streetZ; // -24
const STREET_N = STREET_Z - MARKET.halfWidth; // -31（北侧铺面线）
const STREET_S = STREET_Z + MARKET.halfWidth; // -17（南侧铺面线）
const STREET_Y = G + 0.045;
/** 街市东头：再往东就是御街（YUJIE.x - halfWidth = 233）。 */
const MARKET_EAST = 233;
const JUNCTION_X = 229;

/** 统一几何体属性（position / normal / uv、非索引），再施加矩阵。 */
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
 * 按材质归并几何：整座城 / 市的所有静态零件，每种材质最后只剩一个 mesh。
 * 这是 draw call 预算的关键。
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

  addBox(mat, w, h, d, x, y, z, rotY = 0) {
    this.push(mat, new THREE.BoxGeometry(w, h, d), M4(x, y, z, rotY));
  }

  /** 圆柱：y 是底面高度。 */
  addCylinder(mat, rTop, rBot, h, x, baseY, z, seg = 8) {
    this.push(mat, new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, false), M4(x, baseY + h / 2, z));
  }

  /** 圆锥（无底）：树冠 / 草垛。 */
  addCone(mat, r, h, x, baseY, z, seg = 7) {
    this.push(mat, new THREE.CylinderGeometry(0.02, r, h, seg, 1, true), M4(x, baseY + h / 2, z));
  }

  addSphere(mat, r, x, y, z, sw = 6, sh = 4) {
    this.push(mat, new THREE.SphereGeometry(r, sw, sh), M4(x, y, z));
  }

  /** 四点四边形（法线朝 out）。屋面、布棚、招牌、路面都用它。 */
  addQuad(mat, a, b, c, d, out) {
    const n = V3().subVectors(b, a).cross(V3().subVectors(c, a));
    let p1 = b;
    let p2 = c;
    let p3 = d;
    if (n.dot(out) < 0) {
      p1 = d;
      p2 = c;
      p3 = b;
    }
    const pos = [
      a.x, a.y, a.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z,
      a.x, a.y, a.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z,
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(12), 2));
    geo.computeVertexNormals();
    this.push(mat, geo);
  }

  build(name = 'town-static') {
    const group = new THREE.Group();
    group.name = name;
    let tris = 0;
    for (const { mat, geos } of this.buckets.values()) {
      if (!geos.length) continue;
      const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!geo) continue;
      geo.computeBoundingSphere();
      tris += geo.attributes.position.count / 3;
      group.add(new THREE.Mesh(geo, mat));
    }
    group.userData.triangles = tris;
    group.userData.batches = group.children.length;
    return group;
  }
}

/* ========================================================================== */
/*  1. 屋顶 / 梁柱 / 小构件                                                    */
/* ========================================================================== */

/** 硬山（两坡）屋顶 + 正脊。 */
function addGableRoof(coll, mats, o) {
  const {
    x = 0, z = 0, y = 0, rotY = 0,
    width, depth, height,
    tileMat = mats.roofTile,
    ridgeMat = mats.inkDark,
    overhang = 0.55, lift = 0.16,
    segU = 4, segV = 2,
    ridge = true,
  } = o;
  const { roof, fascia } = gableRoofGeometry({
    width, depth, height, overhang, lift, curve: 1.9, swell: 0.35, segU, segV,
  });
  const m = M4(x, y, z, rotY);
  coll.push(tileMat, roof, m);
  coll.push(mats.eave, fascia, m);
  if (ridge) {
    const len = width + overhang * 2;
    const t = Math.max(0.1, height * 0.1);
    coll.addBox(ridgeMat, len, t, t, x, y + height + t * 0.3, z, rotY);
  }
}

/** 庑殿顶 + 正脊 + 两端吻兽。 */
function addHipRoof(coll, mats, o) {
  const {
    x = 0, z = 0, y = 0, rotY = 0,
    width, depth, height,
    tileMat = mats.roofTile,
    ridgeMat = mats.inkDark,
    overhang = 1.0, lift = 0.2,
    segU = 6, segV = 3,
    ornaments = true,
  } = o;
  const { roof, fascia, ridgeHalf } = hipRoofGeometry({
    width, depth, height, overhang, lift, curve: 1.94, swell: 0.4, segU, segV,
  });
  const m = M4(x, y, z, rotY);
  coll.push(tileMat, roof, m);
  coll.push(mats.eave, fascia, m);
  if (ridgeHalf > 0.05) {
    const t = Math.max(0.12, height * 0.1);
    coll.addBox(ridgeMat, ridgeHalf * 2, t, t * 0.9, x, y + height + t * 0.28, z, rotY);
    if (ornaments) {
      const orn = Math.max(0.16, height * 0.16);
      for (const s of [-1, 1]) {
        const c = Math.cos(rotY);
        const sn = Math.sin(rotY);
        const lx = s * (ridgeHalf - orn * 0.3);
        coll.addBox(
          ridgeMat,
          orn * 0.9,
          orn * 1.6,
          orn * 0.8,
          x + c * lx,
          y + height + orn * 0.9,
          z - sn * lx,
          rotY,
        );
      }
    }
  }
}

/** 两点之间的一根方梁（彩楼 / 斜撑用）。 */
function addBeam(coll, mat, ax, ay, az, bx, by, bz, w = 0.18, h = 0.18) {
  const a = V3(ax, ay, az);
  const b = V3(bx, by, bz);
  const dir = V3().subVectors(b, a);
  const len = dir.length();
  if (len < 1e-4) return;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
  const mid = V3().addVectors(a, b).multiplyScalar(0.5);
  coll.push(mat, new THREE.BoxGeometry(len, h, w), new THREE.Matrix4().compose(mid, q, V3(1, 1, 1)));
}

/** 灯笼：木钩 + 球身 + 上下木盖。 */
function addLantern(coll, mats, x, y, z, r = 0.24) {
  coll.addBox(mats.woodDark, 0.05, 0.62, 0.05, x, y + r + 0.31, z);
  coll.addCylinder(mats.woodDark, r * 0.36, r * 0.42, 0.1, x, y + r * 0.82, z, 5);
  coll.addSphere(mats.lantern, r, x, y, z, 6, 5);
  coll.addCylinder(mats.woodDark, r * 0.3, r * 0.36, 0.08, x, y - r * 1.02, z, 5);
  coll.addBox(mats.banner, 0.05, 0.18, 0.05, x, y - r * 1.16, z);
}

/** 竖幌：横杆伸出 + 纸色布面 + 墨边 + 墨字痕。法线朝 +z（镜头在南侧）。 */
function addHangingBanner(coll, mats, o) {
  const { x, yTop, z, wallZ, w = 0.56, h = 2.05, mat = mats.paperSign } = o;
  const sign = 0.28;
  const zz = z + 0.01;
  coll.addBox(mats.woodDark, 0.07, 0.07, Math.abs(z - wallZ) + 0.2, x, yTop + 0.1, (z + wallZ) / 2);
  coll.addQuad(
    mat,
    V3(x - w / 2, yTop, zz),
    V3(x + w / 2, yTop, zz),
    V3(x + w / 2, yTop - h, zz),
    V3(x - w / 2, yTop - h, zz),
    V3(0, 0, 1),
  );
  coll.addBox(mats.inkDark, w + 0.08, 0.07, 0.05, x, yTop, zz + 0.02);
  coll.addBox(mats.inkDark, 0.05, h, 0.05, x - w / 2, yTop - h / 2, zz + 0.02);
  coll.addBox(mats.inkDark, 0.05, h, 0.05, x + w / 2, yTop - h / 2, zz + 0.02);
  for (let i = 0; i < 3; i++) {
    coll.addBox(mats.inkDark, sign * (0.5 + (i % 2) * 0.25), 0.16, 0.03, x, yTop - h * (0.2 + i * 0.27), zz + 0.03);
  }
  coll.addBox(mat, w * 0.9, 0.06, 0.03, x, yTop - h + 0.04, zz + 0.02);
}

/** 横匾：纸色板 + 墨边 + 三四个墨字。 */
function addPlaque(coll, mats, o) {
  const { x, y, z, w = 2.2, h = 0.62, chars = 3, gold = false } = o;
  const edgeMat = gold ? mats.gold : mats.inkDark;
  const zz = z + 0.015;
  coll.addQuad(
    mats.paperSign,
    V3(x - w / 2, y + h / 2, zz),
    V3(x + w / 2, y + h / 2, zz),
    V3(x + w / 2, y - h / 2, zz),
    V3(x - w / 2, y - h / 2, zz),
    V3(0, 0, 1),
  );
  coll.addBox(edgeMat, w + 0.09, 0.07, 0.05, x, y + h / 2, zz + 0.01);
  coll.addBox(edgeMat, w + 0.09, 0.07, 0.05, x, y - h / 2, zz + 0.01);
  coll.addBox(edgeMat, 0.07, h + 0.1, 0.05, x - w / 2, y, zz + 0.01);
  coll.addBox(edgeMat, 0.07, h + 0.1, 0.05, x + w / 2, y, zz + 0.01);
  for (let i = 0; i < chars; i++) {
    const cx = x + (i - (chars - 1) / 2) * (w * 0.27);
    coll.addBox(mats.inkDark, w * 0.13, h * 0.4, 0.03, cx, y, zz + 0.025);
    coll.addBox(mats.inkDark, w * 0.17, 0.035, 0.03, cx, y - h * 0.24, zz + 0.025);
  }
}

/** 冲天招牌（立在店前的高竖牌）。 */
function addStandingSign(coll, mats, o) {
  const { x, z, h = 3.4, w = 0.95, base = 0.9 } = o;
  coll.addBox(mats.stone, 1.15, 0.28, 1.15, x, G + 0.14, z);
  coll.addCylinder(mats.woodDark, 0.09, 0.11, h, x, G + 0.28, z, 5);
  const zz = z + 0.09;
  const y0 = G + 0.28;
  coll.addQuad(
    mats.paperSign,
    V3(x - w / 2, y0 + h, zz),
    V3(x + w / 2, y0 + h, zz),
    V3(x + w / 2, y0 + base, zz),
    V3(x - w / 2, y0 + base, zz),
    V3(0, 0, 1),
  );
  coll.addBox(mats.inkDark, w + 0.1, 0.07, 0.05, x, y0 + h, zz + 0.02);
  coll.addBox(mats.inkDark, w + 0.1, 0.07, 0.05, x, y0 + base, zz + 0.02);
  coll.addBox(mats.inkDark, 0.06, h - base, 0.05, x - w / 2, y0 + (h + base) / 2, zz + 0.02);
  coll.addBox(mats.inkDark, 0.06, h - base, 0.05, x + w / 2, y0 + (h + base) / 2, zz + 0.02);
  for (let i = 0; i < 4; i++) {
    coll.addBox(mats.inkDark, w * 0.34, 0.2, 0.035, x, y0 + h - 0.55 - i * 0.52, zz + 0.03);
  }
}

/** 大遮阳伞（茶坊 / 算命摊）。 */
function addParasol(coll, mats, x, z, r = 2.3, h = 2.9, mat = mats.cloth) {
  coll.addBox(mats.wood, 0.1, h, 0.1, x, G + h / 2, z);
  coll.push(mat, new THREE.CylinderGeometry(0.06, r, 0.62, 10, 1, true), M4(x, G + h - 0.24, z));
  coll.addCylinder(mats.woodDark, 0.05, 0.06, 0.3, x, G + h + 0.02, z, 5);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    coll.addBox(mats.wood, 0.035, 0.035, r * 0.9, x + Math.cos(a) * r * 0.45, G + h - 0.5, z + Math.sin(a) * r * 0.45, a);
  }
}

/** 小桌 + 条凳（茶坊 / 摊前）。 */
function addTableSet(coll, mats, x, z) {
  coll.addBox(mats.wood, 1.0, 0.08, 0.85, x, G + 0.76, z);
  for (const [sx, sz] of [[-0.38, -0.3], [0.38, -0.3], [-0.38, 0.3], [0.38, 0.3]]) {
    coll.addBox(mats.woodDark, 0.08, 0.74, 0.08, x + sx, G + 0.37, z + sz);
  }
  for (const sx of [-0.95, 0.95]) {
    coll.addBox(mats.wood, 0.62, 0.06, 0.3, x + sx, G + 0.42, z);
    coll.addBox(mats.woodDark, 0.06, 0.4, 0.24, x + sx, G + 0.21, z);
  }
  // 茶碗
  coll.addCylinder(mats.wood, 0.12, 0.1, 0.14, x - 0.2, G + 0.8, z, 5);
  coll.addCylinder(mats.wood, 0.1, 0.09, 0.12, x + 0.24, G + 0.8, z + 0.12, 5);
}

/** 酒瓮（肚子 + 口）。 */
function addJar(coll, mats, x, z, s = 1) {
  coll.push(mats.woodDark, new THREE.SphereGeometry(0.32 * s, 7, 5), M4(x, G + 0.34 * s, z, 0, 1, 1.1, 1));
  coll.addCylinder(mats.woodDark, 0.14 * s, 0.19 * s, 0.16 * s, x, G + 0.62 * s, z, 6);
  coll.addCylinder(mats.thatch, 0.13 * s, 0.13 * s, 0.06 * s, x, G + 0.78 * s, z, 6);
}

/** 拴马桩：石座 + 石柱 + 铁环。 */
function addHitchPost(coll, mats, x, z, rotY = 0) {
  coll.addBox(mats.stone, 0.52, 0.3, 0.52, x, G + 0.15, z, rotY);
  coll.addCylinder(mats.stone, 0.12, 0.15, 1.5, x, G + 0.3, z, 6);
  coll.push(mats.inkDark, new THREE.TorusGeometry(0.17, 0.035, 4, 8), M4(x, G + 1.58, z));
}

/** 货担：扁担 + 两只筐。 */
function addLoadPole(coll, mats, x, z, rotY = 0) {
  coll.addBox(mats.woodDark, 2.3, 0.07, 0.07, x, G + 0.92, z, rotY);
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  for (const k of [-1, 1]) {
    const bx = x + c * k * 1.0;
    const bz = z - s * k * 1.0;
    coll.addCylinder(mats.thatch, 0.3, 0.24, 0.42, bx, G, bz, 7);
    coll.addBox(mats.wood, 0.05, 0.42, 0.42, bx, G + 0.92, bz, rotY);
  }
}

/** 板车：车斗 + 两只车轮 + 车辕。 */
function addCart(coll, mats, x, z, rotY = 0) {
  const c = Math.cos(rotY);
  const sn = Math.sin(rotY);
  const at = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
  coll.addBox(mats.wood, 2.1, 0.16, 1.15, x, G + 0.72, z, rotY);
  const [fx, fz] = at(0, 0.6);
  coll.addBox(mats.woodDark, 2.0, 0.55, 0.1, x, G + 1.05, fz, rotY);
  for (const s2 of [-1, 1]) {
    const [wx, wz] = at(s2 * 0.95, 0);
    coll.push(mats.woodDark, new THREE.TorusGeometry(0.36, 0.06, 4, 10), M4(wx, G + 0.38, wz, Math.PI / 2));
    const [ax, az] = at(s2 * 0.35, -1.35);
    coll.addBox(mats.woodDark, 0.08, 0.08, 1.5, ax, G + 0.72, az, rotY);
  }
  // 车上的货
  for (let i = 0; i < 3; i++) {
    const [gx, gz] = at(-0.5 + i * 0.5, 0);
    coll.addBox(mats.thatch, 0.42, 0.34, 0.4, gx, G + 0.95, gz, rotY);
  }
}

/** 草垛。 */
function addHaystack(coll, mats, x, z, r = 1.1, h = 1.7) {
  coll.addCylinder(mats.thatch, r * 0.72, r, h * 0.55, x, G, z, 7);
  coll.addCone(mats.thatch, r * 0.74, h * 0.62, x, G + h * 0.5, z, 7);
  coll.addCylinder(mats.thatchDark, r * 0.1, r * 0.16, 0.5, x, G + h * 1.05, z, 5);
}

/* ========================================================================== */
/*  2. 街面：土色铺装 + 车辙 + 排水沟                                          */
/* ========================================================================== */

function buildStreet(coll, mats) {
  const streetMat = inkMat(0xdccdb0, { side: THREE.DoubleSide });
  setInkWeight(streetMat, 0.16);
  const lineMat = mats.inkWash;
  const rutMat = mats.inkSoft;

  // —— 主街（城门东，一路铺到御街口）——
  coll.addQuad(streetMat, V3(43, STREET_Y, STREET_N), V3(MARKET_EAST, STREET_Y, STREET_N), V3(MARKET_EAST, STREET_Y, STREET_S), V3(43, STREET_Y, STREET_S), V3(0, 1, 0));
  // —— 街东头的河沿平台（南排铺面到此收住，留一段看河的岸台）——
  coll.addQuad(streetMat, V3(221, STREET_Y, STREET_S), V3(MARKET_EAST, STREET_Y, STREET_S), V3(MARKET_EAST, STREET_Y, -14.2), V3(221, STREET_Y, -14.2), V3(0, 1, 0));
  // —— 城门甬道（城台前到街口）——
  coll.addQuad(streetMat, V3(43, STREET_Y, -42), V3(61, STREET_Y, -42), V3(61, STREET_Y, STREET_N), V3(43, STREET_Y, STREET_N), V3(0, 1, 0));
  // —— 关厢土街（城西）——
  coll.addQuad(streetMat, V3(18, STREET_Y, STREET_N), V3(43, STREET_Y, STREET_N), V3(43, STREET_Y, STREET_S), V3(18, STREET_Y, STREET_S), V3(0, 1, 0));

  const lineY = STREET_Y + 0.02;
  // —— 两道车辙墨线 ——
  for (const z of [-22.7, -21.1]) {
    coll.addQuad(rutMat, V3(58, lineY, z - 0.09), V3(230, lineY, z - 0.09), V3(230, lineY, z + 0.09), V3(58, lineY, z + 0.09), V3(0, 1, 0));
  }
  // —— 街边排水沟细线 + 沟沿条石 ——
  for (const z of [STREET_N + 0.75, STREET_S - 0.75]) {
    coll.addQuad(lineMat, V3(46, lineY, z - 0.07), V3(231, lineY, z - 0.07), V3(231, lineY, z + 0.07), V3(46, lineY, z + 0.07), V3(0, 1, 0));
    for (let x = 52; x < 231; x += 7) coll.addBox(mats.stone, 0.7, 0.08, 0.5, x, STREET_Y + 0.04, z);
  }
  // —— 横向铺装缝 ——
  for (let x = 56; x < 231; x += 9.5) {
    coll.addQuad(lineMat, V3(x - 0.05, lineY, STREET_N + 0.9), V3(x + 0.05, lineY, STREET_N + 0.9), V3(x + 0.05, lineY, STREET_S - 0.9), V3(x - 0.05, lineY, STREET_S - 0.9), V3(0, 1, 0));
  }
  // —— 城门前的一段横街墨边 ——
  coll.addQuad(lineMat, V3(43, lineY, -41.9), V3(61, lineY, -41.9), V3(61, lineY, -41.7), V3(43, lineY, -41.7), V3(0, 1, 0));

  // —— 御街口：街东头的横向收边 + 河沿平台栏杆 ——
  coll.addQuad(lineMat, V3(231.9, lineY, STREET_N), V3(232.1, lineY, STREET_N), V3(232.1, lineY, STREET_S), V3(231.9, lineY, STREET_S), V3(0, 1, 0));
  coll.addQuad(lineMat, V3(221, lineY, -14.3), V3(MARKET_EAST, lineY, -14.3), V3(MARKET_EAST, lineY, -14.1), V3(221, lineY, -14.1), V3(0, 1, 0));
  // 岸台的石栏杆
  for (let x = 222; x < MARKET_EAST; x += 2.1) {
    coll.addBox(mats.stone, 0.16, 0.86, 0.16, x, G + 0.43, -14.5);
  }
  coll.addBox(mats.stone, MARKET_EAST - 221, 0.12, 0.12, (221 + MARKET_EAST) / 2, G + 0.82, -14.5);
  // 街东延的灯笼杆（一路挂到御街口）
  for (const lx of [200.5, 208.5, 216.5, 228.6]) {
    coll.addBox(mats.woodDark, 0.1, 3.8, 0.1, lx, G + 1.9, STREET_N + 0.9);
    coll.addBox(mats.woodDark, 0.08, 0.08, 0.9, lx, G + 3.72, STREET_N + 1.28);
    addLantern(coll, mats, lx, G + 3.2, STREET_N + 1.62, 0.24);
  }
  // 御街口的两个石墩 + 灯笼杆
  for (const [px, pz] of [[227.4, -17.5], [231.2, -17.3]]) {
    coll.addBox(mats.stone, 0.7, 1.0, 0.7, px, G + 0.5, pz);
    coll.addCylinder(mats.woodDark, 0.09, 0.12, 4.6, px, G + 1.0, pz, 6);
  }
}

/* ========================================================================== */
/*  3. 城墙与两端收头                                                          */
/* ========================================================================== */

/** 一段夯土城墙（南面、北面、墙顶、两端封口），带收分、腰线、垛口与条石墙基。 */
function addWallRun(coll, mats, x0, x1, crenelFrom = -Infinity, crenelTo = Infinity) {
  const yb = G;
  const yt = yb + WALL_H;
  const fz0 = WALL_FRONT; // -42
  const bz0 = WALL_BACK; // -46
  const fz1 = WALL_FRONT - 0.16; // 顶部略内收
  const bz1 = WALL_BACK + 0.16;
  const wallMat = mats.wallGray;
  // 南面（朝镜头）/ 北面 / 墙顶 / 两端封口
  coll.addQuad(wallMat, V3(x0, yb, fz0), V3(x1, yb, fz0), V3(x1, yt, fz1), V3(x0, yt, fz1), V3(0, 0, 1));
  coll.addQuad(wallMat, V3(x1, yb, bz0), V3(x0, yb, bz0), V3(x0, yt, bz1), V3(x1, yt, bz1), V3(0, 0, -1));
  coll.addQuad(mats.inkWash, V3(x0, yt, fz1), V3(x1, yt, fz1), V3(x1, yt, bz1), V3(x0, yt, bz1), V3(0, 1, 0));
  coll.addQuad(wallMat, V3(x0, yb, bz0), V3(x0, yb, fz0), V3(x0, yt, fz1), V3(x0, yt, bz1), V3(-1, 0, 0));
  coll.addQuad(wallMat, V3(x1, yb, fz0), V3(x1, yb, bz0), V3(x1, yt, bz1), V3(x1, yt, fz1), V3(1, 0, 0));

  // 条石墙基
  coll.addBox(mats.stone, x1 - x0, 0.62, 0.24, (x0 + x1) / 2, yb + 0.31, fz0 + 0.11);

  // 淡墨腰线（顺收分坡度贴在南面）
  const wy = yb + WALL_H * 0.43;
  const wz = fz0 + (fz1 - fz0) * 0.43 + 0.014;
  coll.addQuad(mats.inkSoft, V3(x0, wy, wz), V3(x1, wy, wz), V3(x1, wy + 0.17, wz), V3(x0, wy + 0.17, wz), V3(0, 0, 1));
  // 墙顶下沿再压一道极淡的线
  const wy2 = yt - 0.5;
  const wz2 = fz0 + (fz1 - fz0) * (1 - 0.5 / WALL_H);
  coll.addQuad(mats.inkSoft, V3(x0, wy2, wz2), V3(x1, wy2, wz2), V3(x1, wy2 + 0.1, wz2), V3(x0, wy2 + 0.1, wz2), V3(0, 0, 1));

  // 版筑的竖向接缝：隔 7 米一道极淡的竖线，夯土墙才不像一张纸
  const seamMat = mats.inkWash;
  for (let sx = x0 + 5; sx < x1 - 3; sx += 7) {
    const zb = fz0 + (fz1 - fz0) * (0.6 / WALL_H) + 0.01;
    const zt = fz0 + (fz1 - fz0) * (1 - 0.7 / WALL_H) + 0.01;
    coll.addQuad(seamMat, V3(sx - 0.06, yb + 0.9, zb), V3(sx + 0.06, yb + 0.9, zb), V3(sx + 0.06, yt - 0.7, zt), V3(sx - 0.06, yt - 0.7, zt), V3(0, 0, 1));
  }

  // 垛口（墙顶靠外沿）
  const pitch = 2.0;
  const crenW = 1.0;
  const crenH = 1.15;
  const crenD = 0.62;
  const n = Math.floor((x1 - x0 - 1.2) / pitch);
  const zc = fz1 - crenD / 2 + 0.02;
  for (let i = 0; i < n; i++) {
    const cx = x0 + 0.6 + pitch * i + crenW / 2;
    if (cx < crenelFrom || cx > crenelTo) continue;
    coll.addBox(mats.inkSoft, crenW, crenH, crenD, cx, yt + crenH / 2, zc);
  }
}

/** 角台：城墙收头处的墩台 + 垛口。 */
function addBastion(coll, mats, x, z = WALL_Z) {
  const w = 6.4;
  const d = 6.8;
  const h = WALL_H + 0.75;
  coll.addBox(mats.wallGray, w, h, d, x, G + h / 2, z);
  coll.addBox(mats.inkWash, w + 0.5, 0.32, d + 0.5, x, G + h + 0.16, z);
  for (let i = -1; i <= 1; i++) {
    coll.addBox(mats.inkSoft, 1.05, 1.15, 0.6, x + i * 1.9, G + h + 0.32 + 0.575, z + d / 2 - 0.4);
  }
  coll.addBox(mats.stone, w + 0.15, 0.62, 0.24, x, G + 0.31, z + d / 2 + 0.06);
}

/** 马面（敌台）：从城墙面向南鼓出的墩台，给长长一道墙一点节奏。 */
function addButtress(coll, mats, x) {
  const w = 7.0;
  const d = 2.6;
  const h = WALL_H + 0.35;
  const zc = WALL_FRONT + d / 2 - 0.1;
  coll.addBox(mats.wallGray, w, h, d, x, G + h / 2, zc);
  coll.addBox(mats.inkWash, w + 0.35, 0.3, d + 0.35, x, G + h + 0.15, zc);
  for (let i = -1; i <= 1; i++) {
    coll.addBox(mats.inkSoft, 1.0, 1.1, 0.55, x + i * 2.2, G + h + 0.3 + 0.55, zc + d / 2 - 0.3);
  }
  // 腰线接到马面上
  coll.addQuad(mats.inkSoft, V3(x - w / 2, G + WALL_H * 0.43, zc + d / 2 + 0.02), V3(x + w / 2, G + WALL_H * 0.43, zc + d / 2 + 0.02), V3(x + w / 2, G + WALL_H * 0.43 + 0.17, zc + d / 2 + 0.02), V3(x - w / 2, G + WALL_H * 0.43 + 0.17, zc + d / 2 + 0.02), V3(0, 0, 1));
}

/**
 * 东角台：城墙东端的收头——大墩台 + 角楼 + 向北折去的一段残墙。
 * 再往东就是御街/大内，墙不能断得太硬，所以让它「转角」隐进树里去。
 */
function addEastCornerTower(coll, mats, swing) {
  const x = 205;
  const zc = WALL_Z - 0.7;
  const w = 12;
  const d = 9.4;
  const h = WALL_H + 1.0;
  coll.addBox(mats.wallGray, w, h, d, x, G + h / 2, zc);
  coll.addBox(mats.stone, w + 0.4, 0.75, d + 0.4, x, G + 0.375, zc);
  coll.addBox(mats.inkWash, w + 0.6, 0.34, d + 0.6, x, G + h + 0.17, zc);
  // 南沿垛口
  for (let i = -2; i <= 2; i++) {
    coll.addBox(mats.inkSoft, 1.05, 1.15, 0.6, x + i * 2.25, G + h + 0.34 + 0.575, zc + d / 2 - 0.4);
  }
  // 墩台腰线 / 竖缝 / 东沿垛口
  coll.addBox(mats.stone, w + 0.2, 0.5, 0.24, x, G + 0.25, zc + d / 2 + 0.12);
  for (const zf of [zc + d / 2 + 0.02, zc - d / 2 - 0.02]) {
    coll.addQuad(mats.inkSoft, V3(x - w / 2, G + 4.6, zf), V3(x + w / 2, G + 4.6, zf), V3(x + w / 2, G + 4.78, zf), V3(x - w / 2, G + 4.78, zf), V3(0, 0, zf > zc ? 1 : -1));
  }
  for (const xf of [x - w / 2 - 0.02, x + w / 2 + 0.02]) {
    coll.addQuad(mats.inkSoft, V3(xf, G + 4.6, zc - d / 2), V3(xf, G + 4.6, zc + d / 2), V3(xf, G + 4.78, zc + d / 2), V3(xf, G + 4.78, zc - d / 2), V3(xf > x ? 1 : -1, 0, 0));
  }
  for (let i = -2; i <= 2; i++) {
    coll.addBox(mats.inkSoft, 0.6, 1.1, 1.05, x + w / 2 - 0.4, G + h + 0.34 + 0.55, zc + i * 2.1);
  }
  for (let k = 0; k < 5; k++) {
    const px = x - w / 2 + 1.2 + k * 2.4;
    coll.addQuad(mats.inkWash, V3(px - 0.05, G + 1.0, zc + d / 2 + 0.02), V3(px + 0.05, G + 1.0, zc + d / 2 + 0.02), V3(px + 0.05, G + h - 0.9, zc + d / 2 + 0.02), V3(px - 0.05, G + h - 0.9, zc + d / 2 + 0.02), V3(0, 0, 1));
  }

  // 角楼：一开间小木楼 + 庑殿顶
  const by = G + h;
  coll.addBox(mats.stone, 7.6, 0.45, 6.0, x, by + 0.22, zc);
  coll.addBox(mats.wallPlaster, 6.6, 3.2, 5.0, x, by + 0.45 + 1.6, zc);
  for (const dx of [-3.1, 3.1]) for (const dz of [-2.2, 2.2]) {
    coll.addBox(mats.column, 0.4, 3.2, 0.4, x + dx, by + 0.45 + 1.6, zc + dz);
  }
  for (const dx of [-1.7, 1.7]) {
    coll.addBox(mats.inkDark, 1.6, 1.2, 0.12, x + dx, by + 2.6, zc + 2.52);
    for (let i = -1; i <= 1; i++) coll.addBox(mats.jade, 0.06, 1.15, 0.06, x + dx + i * 0.5, by + 2.6, zc + 2.58);
  }
  coll.addBox(mats.woodDark, 7.0, 0.4, 0.4, x, by + 3.6, zc + 2.5);
  addHipRoof(coll, mats, {
    x, y: by + 3.75, z: zc, width: 8.6, depth: 6.6, height: 2.7,
    tileMat: mats.roofTileDark, ridgeMat: mats.inkDark, overhang: 1.0, lift: 0.24, segU: 6, segV: 3,
  });
  // 角楼两盏灯笼 + 两面旗
  for (const s2 of [-1, 1]) {
    addLantern(coll, mats, x + s2 * 3.6, by + 3.1, zc + 2.35, 0.26);
    coll.addCylinder(mats.woodDark, 0.06, 0.09, 4.2, x + s2 * 5.6, by, zc + 1.6, 5);
    swing.push({ x: x + s2 * 5.6, y: by + 4.1, z: zc + 1.75, w: 0.85, h: 1.9, color: 0xb64f34, amp: 0.2, sp: 0.9, ph: s2 * 2.0 });
  }
  // 向北折去的一段残墙（收头，隐进树里）
  coll.addBox(mats.wallGray, 4.2, WALL_H - 0.6, 15, x + 0.4, G + (WALL_H - 0.6) / 2, zc - d / 2 - 7.2);
  coll.addBox(mats.inkWash, 4.6, 0.3, 15.3, x + 0.4, G + WALL_H - 0.45, zc - d / 2 - 7.2);
  for (let i = 0; i < 5; i++) {
    coll.addBox(mats.inkSoft, 0.6, 1.05, 1.0, x + 0.4, G + WALL_H - 0.45 + 0.52, zc - d / 2 - 1.6 - i * 2.9);
  }
}

function buildWall(coll, mats, rng, swing) {
  // 主墙两段（城台 x 38~66 处盖住中间），城门范围内不出垛口
  addWallRun(coll, mats, 18, 40.2, -Infinity, 38);
  addWallRun(coll, mats, 63.8, 205, 66, Infinity);
  // 马面（避开城门与铺面后檐）
  for (const x of [84, 116, 148, 182]) addButtress(coll, mats, x);
  // 西端角台；东端是角台 + 角楼 + 折向北的残墙收头
  addBastion(coll, mats, 18);
  addEastCornerTower(coll, mats, swing);
  // 城墙背后的城内屋脊：镜头一抬高，墙后就有一层城，而不是一张白纸
  buildBehindWall(coll, mats, rng);
}

/** 城墙内侧的城：三进错落的灰瓦屋顶，从北往南一层比一层低。 */
function buildBehindWall(coll, mats, rng) {
  const rows = [
    { z: -53.0, step: 12.5 },
    { z: -61.5, step: 15.0 },
    { z: -70.5, step: 18.0 },
  ];
  for (const row of rows) {
    let x = 24 + rng() * 6;
    while (x < 217) {
      const w = 6.5 + rng() * 4.5;
      const d = 5.0 + rng() * 2.6;
      const two = rng() < 0.3;
      const bodyH = two ? 5.8 : 3.0;
      const zc = row.z + (rng() - 0.5) * 1.2;
      coll.addBox(mats.wallGray, w, bodyH, d, x + w / 2, G + bodyH / 2, zc);
      addGableRoof(coll, mats, {
        x: x + w / 2, z: zc, y: G + bodyH, width: w, depth: d,
        height: 1.7 + rng() * 0.6,
        tileMat: rng() < 0.45 ? mats.roofTileDark : mats.roofTile,
        ridgeMat: mats.inkDark, overhang: 0.45, lift: 0.12, segU: 3, segV: 1,
      });
      x += w + 1.4 + rng() * 3.2;
    }
  }
  // 御街口东侧的一排城内屋顶（让街市东头有城市肌理接着）
  const eastRows = [-52.5, -60.5];
  for (const zc0 of eastRows) {
    let x = 206;
    while (x < 217) {
      const w = 5.5 + rng() * 4;
      const d = 4.5 + rng() * 2;
      coll.addBox(mats.wallGray, w, 3.0, d, x + w / 2, G + 1.5, zc0);
      addGableRoof(coll, mats, {
        x: x + w / 2, z: zc0, y: G + 3.0, width: w, depth: d, height: 1.8,
        tileMat: rng() < 0.4 ? mats.roofTileDark : mats.roofTile,
        ridgeMat: mats.inkDark, overhang: 0.4, lift: 0.12, segU: 3, segV: 1,
      });
      x += w + 1.6 + rng() * 2.4;
    }
  }
}

/* ========================================================================== */
/*  4. 城门：城台 + 门洞 + 门楼 + 石狮                                          */
/* ========================================================================== */

const PLATFORM_W = 28;
const PLATFORM_D = 9;
const PLATFORM_H = 9.6; // 城台高（地面以上）
const OPEN_W = 16; // 门洞净宽（契约 gateW）
const OPEN_TOP = 7.0; // 门洞最高处
const OPEN_SPRING = 4.7; // 拱脚高
const PLATFORM_TOP = G + PLATFORM_H; // 10.8

/** 城台：矩形挤出 + 梯形拱门洞。 */
function addGatePlatform(coll, mats) {
  const hw = PLATFORM_W / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, PLATFORM_H);
  shape.lineTo(-hw, PLATFORM_H);
  shape.closePath();

  const ow = OPEN_W / 2;
  const arc = ow - 0.7;
  const hole = new THREE.Path();
  hole.moveTo(-ow + 0.01, 0);
  hole.lineTo(ow - 0.01, 0);
  hole.lineTo(arc, OPEN_SPRING);
  hole.quadraticCurveTo(arc, OPEN_TOP, 0, OPEN_TOP);
  hole.quadraticCurveTo(-arc, OPEN_TOP, -arc, OPEN_SPRING);
  hole.lineTo(-ow + 0.01, 0);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, { depth: PLATFORM_D, bevelEnabled: false, curveSegments: 10 });
  geo.translate(0, 0, -PLATFORM_D / 2);
  coll.push(mats.wallPlaster, geo, M4(GATE_X, G, WALL_Z));

  const fz = WALL_Z + PLATFORM_D / 2; // -39.5 南面
  const bz = WALL_Z - PLATFORM_D / 2; // -48.5 北面
  // 条石基座（南 / 北 / 两侧）与台顶压沿
  coll.addBox(mats.stone, PLATFORM_W + 0.5, 0.55, PLATFORM_D + 0.5, GATE_X, G + 0.275, WALL_Z);
  coll.addBox(mats.stone, PLATFORM_W + 0.1, 1.25, 0.18, GATE_X, G + 1.0, fz + 0.05);
  coll.addBox(mats.stone, PLATFORM_W + 0.1, 1.25, 0.18, GATE_X, G + 1.0, bz - 0.05);
  for (const s of [-1, 1]) {
    coll.addBox(mats.stone, 0.18, 1.25, PLATFORM_D + 0.1, GATE_X + s * (PLATFORM_W / 2 + 0.05), G + 1.0, WALL_Z);
  }
  coll.addBox(mats.inkWash, PLATFORM_W + 0.4, 0.28, PLATFORM_D + 0.4, GATE_X, PLATFORM_TOP + 0.14, WALL_Z);
  // 城台面上的淡墨腰线与版筑竖缝
  coll.addQuad(mats.inkSoft, V3(GATE_X - 14, G + 5.4, fz + 0.03), V3(GATE_X + 14, G + 5.4, fz + 0.03), V3(GATE_X + 14, G + 5.58, fz + 0.03), V3(GATE_X - 14, G + 5.58, fz + 0.03), V3(0, 0, 1));
  for (let i = -4; i <= 4; i++) {
    const px = GATE_X + i * 3.2;
    if (Math.abs(px - GATE_X) < 8.6) continue; // 避开拱门
    coll.addQuad(mats.inkWash, V3(px - 0.05, G + 1.4, fz + 0.03), V3(px + 0.05, G + 1.4, fz + 0.03), V3(px + 0.05, PLATFORM_TOP - 0.9, fz + 0.03), V3(px - 0.05, PLATFORM_TOP - 0.9, fz + 0.03), V3(0, 0, 1));
  }
  // 台顶南沿女墙
  for (let i = 0; i < 8; i++) {
    coll.addBox(mats.inkSoft, 1.5, 0.72, 0.55, GATE_X - 12.6 + i * 3.6, PLATFORM_TOP + 0.64, fz - 0.35);
  }

  // —— 门洞内部：暗侧墙 / 地面 / 尽头的暗影 ——
  const yIn = G + 0.05;
  coll.addQuad(mats.inkDark, V3(GATE_X - 7.1, yIn, fz + 0.2), V3(GATE_X - 7.1, yIn, bz - 0.2), V3(GATE_X - 7.1, G + 6.7, bz - 0.2), V3(GATE_X - 7.1, G + 6.7, fz + 0.2), V3(1, 0, 0));
  coll.addQuad(mats.inkDark, V3(GATE_X + 7.1, yIn, bz - 0.2), V3(GATE_X + 7.1, yIn, fz + 0.2), V3(GATE_X + 7.1, G + 6.7, fz + 0.2), V3(GATE_X + 7.1, G + 6.7, bz - 0.2), V3(-1, 0, 0));
  coll.addQuad(mats.inkSoft, V3(GATE_X - 7.1, G + 0.06, fz + 0.1), V3(GATE_X + 7.1, G + 0.06, fz + 0.1), V3(GATE_X + 7.1, G + 0.06, bz - 0.1), V3(GATE_X - 7.1, G + 0.06, bz - 0.1), V3(0, 1, 0));
  coll.addQuad(mats.inkDark, V3(GATE_X - 7.2, yIn, bz + 0.15), V3(GATE_X + 7.2, yIn, bz + 0.15), V3(GATE_X + 7.2, G + 6.8, bz + 0.15), V3(GATE_X - 7.2, G + 6.8, bz + 0.15), V3(0, 0, 1));

  // —— 排叉柱（门洞里的木构）——
  for (const sx of [-1, 1]) {
    for (const zz of [fz - 0.9, WALL_Z, bz + 0.9]) {
      coll.addBox(mats.timber, 0.34, 6.5, 0.34, GATE_X + sx * 7.05, G + 3.25, zz);
    }
    coll.addBox(mats.timber, 0.3, 0.3, PLATFORM_D - 1.2, GATE_X + sx * 7.05, G + 6.45, WALL_Z);
  }
  // 门上横梁（两重）
  for (const yy of [G + 4.95, G + 6.42]) {
    coll.addBox(mats.timber, OPEN_W + 0.8, 0.34, 0.34, GATE_X, yy, fz - 0.35);
  }
  // 门框的朱红门柱 + 柱头
  for (const sx of [-1, 1]) {
    coll.addBox(mats.column, 0.6, 4.9, 0.6, GATE_X + sx * (OPEN_W / 2 + 0.15), G + 2.45, fz - 0.25);
    coll.addBox(mats.woodDark, 0.9, 0.5, 0.9, GATE_X + sx * (OPEN_W / 2 + 0.15), G + 4.95, fz - 0.25);
  }
  // 两扇朱漆大门（向内敞开，贴着门洞两侧）
  coll.addBox(mats.door, 0.22, 5.2, 5.6, GATE_X - 6.9, G + 2.6, WALL_Z + 1.4);
  coll.addBox(mats.door, 0.22, 5.2, 5.6, GATE_X + 6.9, G + 2.6, WALL_Z + 1.4);
  for (const sy of [G + 1.0, G + 2.6, G + 4.2]) {
    coll.addBox(mats.inkDark, 0.26, 0.12, 5.4, GATE_X - 6.9, sy, WALL_Z + 1.4);
    coll.addBox(mats.inkDark, 0.26, 0.12, 5.4, GATE_X + 6.9, sy, WALL_Z + 1.4);
  }
  // 门额（纸色匾 + 墨字痕）
  addPlaque(coll, mats, { x: GATE_X, y: G + 8.4, z: fz + 0.06, w: 5.0, h: 1.3, chars: 4 });
  // 城台面上的两块告示
  for (const dx of [-4.8, 4.4]) {
    coll.addQuad(mats.paperSign, V3(GATE_X + dx - 0.55, G + 4.4, fz + 0.02), V3(GATE_X + dx + 0.55, G + 4.4, fz + 0.02), V3(GATE_X + dx + 0.55, G + 3.3, fz + 0.02), V3(GATE_X + dx - 0.55, G + 3.3, fz + 0.02), V3(0, 0, 1));
    coll.addBox(mats.inkDark, 0.9, 0.06, 0.03, GATE_X + dx, G + 4.0, fz + 0.04);
    coll.addBox(mats.inkDark, 0.7, 0.06, 0.03, GATE_X + dx, G + 3.7, fz + 0.04);
  }
}

/** 城门楼：重檐（下层屋身 + 腰檐 + 上层屋身 + 庑殿顶）。 */
function addGateTower(coll, mats) {
  const base = PLATFORM_TOP; // 10.8
  const cx = GATE_X;
  const cz = WALL_Z;

  // 台明
  coll.addBox(mats.stone, 23.6, 0.5, 9.6, cx, base + 0.25, cz);
  // 下层屋身
  coll.addBox(mats.wallPlaster, 22, 5.2, 7.8, cx, base + 0.5 + 2.6, cz);
  // 下层檐柱（朱红）
  for (const dx of [-10.7, -6.4, -2.1, 2.1, 6.4, 10.7]) {
    coll.addBox(mats.column, 0.44, 5.2, 0.44, cx + dx, base + 0.5 + 2.6, cz + 3.95);
  }
  // 下层门 + 直棂窗
  coll.addBox(mats.door, 4.6, 3.6, 0.18, cx, base + 2.3, cz + 3.92);
  for (const dx of [-6.4, 6.4]) {
    coll.addBox(mats.inkDark, 2.9, 1.9, 0.12, cx + dx, base + 3.3, cz + 3.93);
    for (let i = -2; i <= 2; i++) {
      coll.addBox(mats.wood, 0.06, 1.8, 0.06, cx + dx + i * 0.5, base + 3.3, cz + 3.99);
    }
  }
  // 额枋 + 斗拱 + 檐下暗带
  coll.addBox(mats.woodDark, 22.6, 0.5, 0.5, cx, base + 5.55, cz + 3.92);
  for (let i = 0; i < 11; i++) {
    coll.addBox(mats.wood, 0.3, 0.3, 0.55, cx - 10.4 + i * 2.08, base + 5.95, cz + 3.88);
  }
  coll.addBox(mats.eave, 23.2, 0.28, 0.35, cx, base + 6.16, cz + 3.84);
  // 门楼匾额（在下层檐下）
  addPlaque(coll, mats, { x: cx, y: base + 4.62, z: cz + 3.9, w: 6.0, h: 1.3, chars: 4 });

  // 腰檐（下层屋顶）
  addHipRoof(coll, mats, {
    x: cx, y: base + 6.2, z: cz,
    width: 27, depth: 11.2, height: 2.9,
    tileMat: mats.roofTile, ridgeMat: mats.inkDark,
    overhang: 1.2, lift: 0.22, segU: 7, segV: 3, ornaments: false,
  });

  // 上层屋身（从腰檐里长出来）
  const upY = base + 6.7; // 17.5
  coll.addBox(mats.wallPlaster, 18.2, 3.5, 7.0, cx, upY + 1.75, cz);
  for (const dx of [-8.8, -4.4, 0, 4.4, 8.8]) {
    coll.addBox(mats.column, 0.38, 3.5, 0.38, cx + dx, upY + 1.75, cz + 3.56);
  }
  for (const dx of [-6.6, 6.6]) {
    coll.addBox(mats.inkDark, 2.4, 1.5, 0.1, cx + dx, upY + 2.0, cz + 3.53);
    for (let i = -2; i <= 2; i++) {
      coll.addBox(mats.wood, 0.05, 1.4, 0.05, cx + dx + i * 0.42, upY + 2.0, cz + 3.59);
    }
  }
  coll.addBox(mats.woodDark, 18.8, 0.4, 0.42, cx, upY + 3.28, cz + 3.54);
  for (let i = 0; i < 9; i++) {
    coll.addBox(mats.wood, 0.26, 0.26, 0.46, cx - 8.4 + i * 2.1, upY + 3.52, cz + 3.5);
  }
  coll.addBox(mats.eave, 19.4, 0.26, 0.3, cx, upY + 3.66, cz + 3.46);
  // 背面的窗（省细节）
  coll.addBox(mats.inkDark, 12, 1.4, 0.1, cx, upY + 2.0, cz - 3.53);

  // 上层屋顶（庑殿）
  addHipRoof(coll, mats, {
    x: cx, y: upY + 3.85, z: cz,
    width: 22.5, depth: 10.6, height: 3.6,
    tileMat: mats.roofTileDark, ridgeMat: mats.inkDark,
    overhang: 1.2, lift: 0.24, segU: 7, segV: 3,
  });

  // 门楼前挂两只大红灯笼
  for (const dx of [-9.4, 9.4]) addLantern(coll, mats, cx + dx, base + 5.35, cz + 3.35, 0.34);
}

/** 小石狮（蹲坐，低多边形）。 */
function addStoneLion(coll, mats, x, z, dir = 1) {
  coll.addBox(mats.stone, 1.5, 0.7, 1.9, x, G + 0.35, z);
  coll.addBox(mats.stone, 1.25, 0.22, 1.65, x, G + 0.81, z);
  coll.addBox(mats.stone, 0.8, 1.0, 1.05, x, G + 1.42, z + dir * 0.18);
  coll.addSphere(mats.stone, 0.42, x, G + 2.12, z + dir * 0.6, 7, 5);
  for (const s of [-1, 1]) {
    coll.addBox(mats.stone, 0.16, 0.22, 0.14, x + s * 0.34, G + 2.34, z + dir * 0.56);
    coll.addBox(mats.stone, 0.22, 0.9, 0.32, x + s * 0.26, G + 1.12, z + dir * 0.52);
  }
  coll.addBox(mats.stone, 0.22, 0.75, 0.22, x, G + 1.4, z - dir * 0.55);
  coll.addBox(mats.inkSoft, 1.32, 0.04, 1.72, x, G + 0.93, z);
}

/** 门前的两根旗杆（旗幡交给摆动系统）。 */
function addGateFlagPoles(coll, mats, swing) {
  for (const [fx, fz] of [[GATE_X - 12.6, WALL_Z + 8.4], [GATE_X + 12.6, WALL_Z + 8.4]]) {
    coll.addBox(mats.stone, 0.7, 0.32, 0.7, fx, G + 0.16, fz);
    coll.addCylinder(mats.woodDark, 0.08, 0.13, 9.4, fx, G + 0.3, fz, 6);
    coll.addBox(mats.woodDark, 0.06, 0.06, 0.9, fx, G + 9.4, fz + 0.42);
    swing.push({ x: fx, y: G + 9.35, z: fz + 0.83, w: 1.05, h: 2.5, color: 0xb64f34, amp: 0.24, sp: 0.8, ph: fx * 0.3 });
  }
}

function buildGate(coll, mats, swing) {
  addGatePlatform(coll, mats);
  addGateTower(coll, mats);
  // 门洞两侧的石狮
  addStoneLion(coll, mats, GATE_X - 9.0, WALL_Z + PLATFORM_D / 2 + 2.4);
  addStoneLion(coll, mats, GATE_X + 9.0, WALL_Z + PLATFORM_D / 2 + 2.4);
  // 城台前的拴马桩
  addHitchPost(coll, mats, GATE_X - 7.4, WALL_Z + PLATFORM_D / 2 + 5.6, 0.3);
  addHitchPost(coll, mats, GATE_X + 7.8, WALL_Z + PLATFORM_D / 2 + 5.2, -0.2);
  addGateFlagPoles(coll, mats, swing);

  // —— 城门前的广场：告示牌、茶摊、草棚、货摊，别让门前的空地空着 ——
  // 告示牌（木架 + 纸榜）
  const bx = GATE_X - 5.6;
  const bz = WALL_Z + 9.6;
  for (const s2 of [-1, 1]) coll.addBox(mats.woodDark, 0.12, 2.5, 0.12, bx + s2 * 1.05, G + 1.25, bz);
  coll.addQuad(mats.paperSign, V3(bx - 1.0, G + 2.4, bz + 0.08), V3(bx + 1.0, G + 2.4, bz + 0.08), V3(bx + 1.0, G + 1.0, bz + 0.08), V3(bx - 1.0, G + 1.0, bz + 0.08), V3(0, 0, 1));
  coll.addBox(mats.inkDark, 2.1, 0.08, 0.06, bx, G + 2.4, bz + 0.1);
  coll.addBox(mats.inkDark, 2.1, 0.08, 0.06, bx, G + 1.0, bz + 0.1);
  for (let i = 0; i < 3; i++) coll.addBox(mats.inkDark, 1.5, 0.07, 0.05, bx, G + 2.1 - i * 0.36, bz + 0.1);
  // 门前的茶棚（大伞 + 条桌）
  addParasol(coll, mats, GATE_X + 6.6, WALL_Z + 10.6, 2.1, 2.8, mats.clothOchre);
  addTableSet(coll, mats, GATE_X + 6.4, WALL_Z + 10.6);
  addTableSet(coll, mats, GATE_X + 9.0, WALL_Z + 9.4);
  // 两杆小旗（挂在门楼两侧的墙头）
  for (const s2 of [-1, 1]) {
    const fx = GATE_X + s2 * 15.6;
    coll.addCylinder(mats.woodDark, 0.06, 0.09, 5.2, fx, PLATFORM_TOP, WALL_Z + 0.4, 5);
    swing.push({ x: fx, y: PLATFORM_TOP + 5.1, z: WALL_Z + 0.55, w: 0.8, h: 1.7, color: 0xb64f34, amp: 0.2, sp: 0.9, ph: s2 * 2.2 });
  }
}

/* ========================================================================== */
/*  5. 铺面                                                                    */
/* ========================================================================== */

/**
 * 一间铺面。dir=+1：立面朝 +z（街北侧铺面）；dir=-1：立面朝 -z（街南侧）。
 * 所有招牌 / 幌子 / 匾额的法线都朝 +z（镜头永远在南侧）。
 */
function addShop(coll, mats, rng, o) {
  const {
    x0, zFront, dir = 1,
    w, d: dIn, stories = 1, roof = 'tile',
    special = null,
    autoDepth = false,
    banner = false,
    bannerMat = null,
    plaque = false,
    plaqueText = 3,
    lanterns = 0,
    awning = false,
    balcony = false,
    roofSign = false,
    openFront = false,
    rear = false,
    low = false,
    accent = false,      // 青绿窗棂 / 朱漆栏杆 / 布帘这类小设色
    glazeRoof = false,   // 青绿琉璃（只给一两家正店点题）
    plaqueGold = false,
  } = o;

  const cx = x0 + w / 2;
  let d = dIn;
  if (autoDepth) d = Math.min(d, Math.max(2.9, northBankZ(cx) + 17 - 0.6));
  const zc = zFront - dir * d / 2;
  const lowJitter = low ? rng() * 0.34 : 0;
  const bodyH = stories === 2 ? 6.3 : low ? 3.0 + lowJitter : 3.5;
  const roofH = roof === 'thatch' ? (low ? 1.3 : 1.75) : low ? 1.5 + lowJitter * 0.5 : 2.05;
  const tileMat = roof === 'thatch'
    ? mats.thatch
    : glazeRoof
      ? mats.roofGlaze
      : rng() < 0.38 ? mats.roofTileDark : mats.roofTile;
  const ridgeMat = roof === 'thatch' ? mats.thatch : glazeRoof ? mats.gold : mats.inkDark;
  const latticeMat = accent ? mats.jade : mats.wood;
  const frontZ = zFront + dir * 0.04;
  const y0 = G + 0.3;

  // 台基与台阶
  coll.addBox(mats.stone, w + 0.3, 0.3, d + 0.3, cx, G + 0.15, zc);
  coll.addBox(mats.stone, w * 0.5, 0.16, 0.7, cx, G + 0.08, zFront + dir * 0.55);
  // 屋身
  coll.addBox(mats.wallPlaster, w, bodyH, d, cx, y0 + bodyH / 2, zc);
  // 山墙分界墨线
  coll.addBox(mats.inkDark, 0.13, bodyH, 0.1, x0 + 0.04, y0 + bodyH / 2, frontZ + dir * 0.06);
  // 檐下暗带
  coll.addBox(mats.eave, w + 0.1, 0.2, 0.3, cx, y0 + bodyH - 0.1, frontZ + dir * 0.04);

  // —— 屋顶 ——
  if (roof === 'hip') {
    addHipRoof(coll, mats, {
      x: cx, z: zc, y: y0 + bodyH, width: w, depth: d, height: 2.6,
      tileMat, ridgeMat: mats.inkDark, overhang: 0.8, lift: 0.2, segU: 5, segV: 3,
    });
  } else {
    addGableRoof(coll, mats, {
      x: cx, z: zc, y: y0 + bodyH, width: w, depth: d, height: roofH,
      tileMat, ridgeMat, overhang: 0.55, lift: 0.14, segU: 4, segV: 2,
    });
  }

  // —— 一层门面 ——
  if (!openFront) {
    coll.addBox(mats.woodDark, w * 0.84, 2.55, 0.14, cx, y0 + 1.28, frontZ + dir * 0.03);
    const strips = Math.max(3, Math.round(w * 0.7));
    for (let i = 0; i < strips; i++) {
      const sx = cx - (w * 0.8) / 2 + (i + 0.5) * ((w * 0.8) / strips);
      coll.addBox(mats.wood, 0.07, 2.45, 0.17, sx, y0 + 1.25, frontZ + dir * 0.06);
    }
    if (special) {
      coll.addBox(mats.door, 1.25, 2.35, 0.1, cx + w * 0.02, y0 + 1.2, frontZ + dir * 0.1);
      // 朱漆门框
      coll.addBox(mats.column, 0.16, 2.5, 0.16, cx - 0.72, y0 + 1.25, frontZ + dir * 0.12);
      coll.addBox(mats.column, 0.16, 2.5, 0.16, cx + 0.76, y0 + 1.25, frontZ + dir * 0.12);
      coll.addBox(mats.column, 1.7, 0.16, 0.18, cx + w * 0.02, y0 + 2.52, frontZ + dir * 0.12);
    }
    // 设色布帘：门两侧垂下来的花青 / 赭色帘子
    if (accent) {
      const curtainMat = rng() < 0.5 ? mats.clothBlue : mats.clothOchre;
      for (const s2 of [-1, 1]) {
        const px = cx + s2 * Math.min(w * 0.3, 1.9);
        coll.addBox(mats.woodDark, 0.9, 0.06, 0.08, px, y0 + 2.42, frontZ + dir * 0.16);
        coll.addQuad(
          curtainMat,
          V3(px - 0.42, y0 + 2.4, frontZ + dir * 0.19),
          V3(px + 0.42, y0 + 2.4, frontZ + dir * 0.19),
          V3(px + 0.36, y0 + 1.5, frontZ + dir * 0.19),
          V3(px - 0.36, y0 + 1.5, frontZ + dir * 0.19),
          V3(0, 0, 1),
        );
      }
    }
    // 柜台
    if (rng() < 0.55) {
      coll.addBox(mats.wood, Math.min(2.0, w * 0.34), 0.95, 0.55, cx - w * 0.24, G + 0.62, zFront + dir * 0.42);
      coll.addBox(mats.wood, Math.min(2.05, w * 0.35), 0.09, 0.62, cx - w * 0.24, G + 1.12, zFront + dir * 0.42);
    }
  } else {
    for (const s of [-1, 1]) {
      coll.addBox(mats.timber, 0.22, 2.9, 0.22, cx + s * (w / 2 - 0.3), y0 + 1.45, frontZ + dir * 0.1);
    }
    coll.addBox(mats.wood, w * 0.7, 0.95, 0.6, cx, G + 0.62, zFront + dir * 0.55);
    coll.addBox(mats.wood, w * 0.72, 0.09, 0.68, cx, G + 1.13, zFront + dir * 0.55);
  }

  // —— 二层：窗 + 栏杆 + 平坐 ——
  if (stories === 2) {
    const upY = y0 + 3.35;
    coll.addBox(mats.inkDark, w * 0.82, 0.18, 0.16, cx, upY - 0.16, frontZ + dir * 0.08);
    for (const dx of [-w * 0.24, w * 0.24]) {
      coll.addBox(mats.inkDark, w * 0.26, 1.15, 0.12, cx + dx, upY + 1.35, frontZ + dir * 0.07);
      for (let i = -2; i <= 2; i++) {
        coll.addBox(latticeMat, 0.05, 1.1, 0.06, cx + dx + i * (w * 0.05), upY + 1.35, frontZ + dir * 0.12);
      }
      // 窗下的青绿栏板
      if (accent) coll.addBox(mats.jade, w * 0.26, 0.16, 0.14, cx + dx, upY + 0.62, frontZ + dir * 0.09);
    }
    // 朱漆阑额：一条红线压在楼层之间
    if (accent) {
      coll.addBox(mats.column, w * 0.9, 0.12, 0.12, cx, upY + 0.36, frontZ + dir * 0.1);
      // 檐下挂的设色布条（朱砂 / 花青 / 赭）
      for (let i = 0; i < 3; i++) {
        const px = cx - w * 0.3 + i * w * 0.3;
        const clothMat = i % 3 === 0 ? mats.banner : i % 3 === 1 ? mats.clothBlue : mats.clothOchre;
        coll.addBox(mats.woodDark, 0.07, 0.07, 0.4, px, upY + 2.94, frontZ + dir * 0.22);
        coll.addQuad(
          clothMat,
          V3(px - 0.16, upY + 2.9, frontZ + dir * 0.36),
          V3(px + 0.16, upY + 2.9, frontZ + dir * 0.36),
          V3(px + 0.16, upY + 1.9, frontZ + dir * 0.36),
          V3(px - 0.16, upY + 1.9, frontZ + dir * 0.36),
          V3(0, 0, 1),
        );
      }
    }
    if (balcony) {
      const railMat = accent ? mats.column : mats.woodDark;
      coll.addBox(mats.woodDark, w * 0.92, 0.14, 0.85, cx, y0 + 3.32, zFront + dir * 0.42);
      coll.addBox(railMat, w * 0.92, 0.08, 0.08, cx, y0 + 3.98, zFront + dir * 0.82);
      for (let i = 0; i < 8; i++) {
        coll.addBox(railMat, 0.05, 0.62, 0.05, cx - w * 0.44 + i * (w * 0.88 / 7), y0 + 3.62, zFront + dir * 0.82);
      }
    }
  }

  // —— 檐下布棚 ——
  if (awning) {
    const zA = zFront + dir * 0.05;
    const zB = zFront + dir * 2.15;
    const yIn = y0 + 2.95;
    const yOut = y0 + 2.35;
    const aw = rng();
    const awningMat = aw < 0.42 ? mats.clothOchre : aw < 0.66 ? mats.clothBlue : mats.cloth;
    coll.addQuad(
      awningMat,
      V3(cx - w * 0.45, yIn, zA),
      V3(cx + w * 0.45, yIn, zA),
      V3(cx + w * 0.45, yOut, zB),
      V3(cx - w * 0.45, yOut, zB),
      V3(0, 1, 0),
    );
    // 棚沿条一条朱砂边
    coll.addBox(mats.banner, w * 0.9, 0.05, 0.05, cx, yOut - 0.01, zB - dir * 0.03);
    for (const s of [-1, 1]) coll.addBox(mats.wood, 0.07, 2.3, 0.07, cx + s * w * 0.42, G + 1.15, zB - dir * 0.06);
  }

  // —— 招牌 / 匾 / 灯笼 ——
  if (banner) {
    addHangingBanner(coll, mats, {
      x: cx + w * 0.27,
      yTop: y0 + bodyH - 0.35,
      z: zFront + dir * 1.15,
      wallZ: zFront + dir * 0.05,
      mat: bannerMat || (rng() < 0.5 ? mats.paperSign : rng() < 0.5 ? mats.cloth : mats.clothOchre),
      w: 0.58,
      h: stories === 2 ? 2.1 : 2.35,
    });
  }
  if (plaque) {
    addPlaque(coll, mats, {
      x: cx,
      y: y0 + bodyH - 0.72,
      z: frontZ + dir * 0.1,
      w: Math.min(2.6, w * 0.46),
      h: 0.62,
      chars: plaqueText,
      gold: plaqueGold || special != null,
    });
  }
  for (let i = 0; i < lanterns; i++) {
    addLantern(coll, mats, cx + (i - (lanterns - 1) / 2) * w * 0.5, y0 + bodyH - 0.62, zFront + dir * 0.72, 0.22);
  }
  if (roofSign) {
    const sy = y0 + bodyH + roofH;
    coll.addBox(mats.woodDark, 0.1, 2.4, 0.1, cx + w * 0.3, sy + 1.2, zc);
    coll.addQuad(mats.paperSign, V3(cx + w * 0.3 - 0.42, sy + 2.4, zc + 0.1), V3(cx + w * 0.3 + 0.42, sy + 2.4, zc + 0.1), V3(cx + w * 0.3 + 0.42, sy + 0.9, zc + 0.1), V3(cx + w * 0.3 - 0.42, sy + 0.9, zc + 0.1), V3(0, 0, 1));
    coll.addBox(mats.inkDark, 0.9, 0.06, 0.05, cx + w * 0.3, sy + 2.4, zc + 0.12);
    coll.addBox(mats.inkDark, 0.9, 0.06, 0.05, cx + w * 0.3, sy + 0.9, zc + 0.12);
    for (let i = 0; i < 3; i++) coll.addBox(mats.inkDark, 0.4, 0.18, 0.03, cx + w * 0.3, sy + 2.0 - i * 0.45, zc + 0.13);
  }
  // —— 临河的后檐面（南排铺面背街的那一面正对镜头，别让它是一张白纸）——
  if (rear) addRearDetail(coll, mats, rng, { cx, w, d, zc, dir, y0, bodyH });
}

/**
 * 南排铺面临河的后檐面：两扇直棂窗 + 一扇后门 + 晾衣杆 + 墙根的坛罐。
 * 这些东西全都朝 +z（镜头方向），是长街上“有人住”的证据。
 */
function addRearDetail(coll, mats, rng, { cx, w, d, zc, dir, y0, bodyH }) {
  const bz = zc - dir * d / 2; // 背街那一面
  const zz = bz + 0.04;
  // 两扇窗：临河的一面用青绿窗棂（绢本设色的那一点绿）
  for (const dx of [-w * 0.23, w * 0.23]) {
    coll.addBox(mats.inkDark, Math.min(1.7, w * 0.24), 0.95, 0.1, cx + dx, y0 + bodyH * 0.62, zz);
    for (let i = -2; i <= 2; i++) {
      coll.addBox(mats.jade, 0.05, 0.9, 0.05, cx + dx + i * Math.min(0.32, w * 0.048), y0 + bodyH * 0.62, zz + 0.05);
    }
    coll.addBox(mats.jade, Math.min(1.75, w * 0.25), 0.07, 0.1, cx + dx, y0 + bodyH * 0.62, zz + 0.05);
  }
  // 后门（有的朱漆、有的就是旧木板；一半加个小雨搭）
  const redDoor = rng() < 0.4;
  coll.addBox(redDoor ? mats.door : mats.woodDark, 1.0, 2.05, 0.09, cx - w * 0.02, y0 + 1.05, zz + 0.01);
  coll.addBox(mats.woodDark, 1.2, 0.12, 0.16, cx - w * 0.02, y0 + 2.14, zz + 0.02);
  if (redDoor) {
    coll.addBox(mats.inkDark, 0.16, 0.16, 0.06, cx - w * 0.02 - 0.22, y0 + 1.55, zz + 0.07);
    coll.addBox(mats.inkDark, 0.16, 0.16, 0.06, cx - w * 0.02 + 0.22, y0 + 1.55, zz + 0.07);
  }
  // 后门边垂一条花青布帘
  {
    const px = cx + w * 0.2;
    coll.addBox(mats.woodDark, 0.7, 0.05, 0.07, px, y0 + 2.28, zz + 0.1);
    coll.addQuad(
      rng() < 0.5 ? mats.clothBlue : mats.clothOchre,
      V3(px - 0.3, y0 + 2.26, zz + 0.13),
      V3(px + 0.3, y0 + 2.26, zz + 0.13),
      V3(px + 0.26, y0 + 1.5, zz + 0.13),
      V3(px - 0.26, y0 + 1.5, zz + 0.13),
      V3(0, 0, 1),
    );
  }
  if (rng() < 0.45) {
    const yy = y0 + 2.35;
    coll.addQuad(
      mats.thatch,
      V3(cx - w * 0.13, yy + 0.18, zz + 0.02),
      V3(cx + w * 0.13, yy + 0.18, zz + 0.02),
      V3(cx + w * 0.13, yy - 0.18, zz + 0.85),
      V3(cx - w * 0.13, yy - 0.18, zz + 0.85),
      V3(0, 1, 0),
    );
    for (const s2 of [-1, 1]) coll.addBox(mats.wood, 0.05, 0.42, 0.05, cx + s2 * w * 0.11, yy - 0.35, zz + 0.78);
  }
  // 墙根坛罐与货箱
  if (rng() < 0.7) {
    addJar(coll, mats, cx + w * 0.34, bz + 0.45, 0.62);
    coll.addBox(mats.wood, 0.55, 0.45, 0.5, cx + w * 0.14, G + 0.22, bz + 0.5, rng() * 0.5);
  }
  // 晾衣杆
  if (rng() < 0.5) {
    const yy = y0 + 2.2;
    coll.addBox(mats.woodDark, w * 0.55, 0.05, 0.05, cx + w * 0.1, yy, bz + 0.55);
    for (let i = 0; i < 3; i++) {
      const px = cx - w * 0.14 + i * w * 0.16;
      coll.addQuad(
        i % 2 === 0 ? mats.cloth : mats.clothBlue,
        V3(px - 0.16, yy - 0.03, bz + 0.58),
        V3(px + 0.16, yy - 0.03, bz + 0.58),
        V3(px + 0.16, yy - 0.55, bz + 0.58),
        V3(px - 0.16, yy - 0.55, bz + 0.58),
        V3(0, 0, 1),
      );
    }
  }
}

/** 望子：立在铺面后檐的高杆招牌，幌子高过屋顶，从街上看是一面旗。 */
function addWangzi(coll, mats, { x, z, h = 7.6, mat = mats.paperSign, w = 1.0, hh = 2.2 }) {
  coll.addCylinder(mats.woodDark, 0.08, 0.12, h, x, G, z, 6);
  coll.addBox(mats.woodDark, 0.08, 0.08, 1.0, x, G + h - 0.1, z + 0.45);
  coll.addQuad(
    mat,
    V3(x - w / 2, G + h - 0.2, z + 1.0),
    V3(x + w / 2, G + h - 0.2, z + 1.0),
    V3(x + w / 2, G + h - 0.2 - hh, z + 1.0),
    V3(x - w / 2, G + h - 0.2 - hh, z + 1.0),
    V3(0, 0, 1),
  );
  coll.addBox(mats.inkDark, w + 0.08, 0.06, 0.05, x, G + h - 0.2, z + 1.02);
  coll.addBox(mats.inkDark, 0.05, hh, 0.05, x - w / 2, G + h - 0.2 - hh / 2, z + 1.02);
  coll.addBox(mats.inkDark, 0.05, hh, 0.05, x + w / 2, G + h - 0.2 - hh / 2, z + 1.02);
  for (let i = 0; i < 3; i++) coll.addBox(mats.inkDark, w * 0.36, 0.16, 0.03, x, G + h - 0.7 - i * 0.55, z + 1.03);
}

/* ---------------------------- 彩楼欢门 ---------------------------- */

/**
 * 彩楼欢门：酒楼门前用竹木扎的彩架 + 旗幡 + 垂下的彩帛。
 * dir 指街心方向（北侧铺面 +1，南侧铺面 -1）。swing 收集摆动的布条。
 */
function addCaiLou(coll, mats, o, swing) {
  const { x, zFront, width = 15, height = 10, small = false, dir = 1 } = o;
  const rel = small
    ? [-width / 2 + 0.7, width / 2 - 0.7]
    : [-width / 2 + 0.9, -width / 6, width / 6, width / 2 - 0.9];
  const xs = rel.map((d) => x + d);
  const zF = zFront + dir * 2.55; // 靠街心的那排
  const zB = zFront + dir * 0.1; // 贴着立面的那排
  const top = G + height;

  // 前后两排立柱
  for (const zz of [zF, zB]) {
    for (const px of xs) {
      coll.addCylinder(mats.timber, 0.15, 0.18, height, px, G, zz, 6);
      coll.addBox(mats.timber, 0.42, 0.12, 0.42, px, G + 0.06, zz);
    }
  }
  // 横梁（上下两道）
  for (const yy of [top - 0.25, top - 1.35]) {
    coll.addBox(mats.timber, width - 1.2, 0.16, 0.16, x, yy, zF);
    coll.addBox(mats.timber, width - 1.2, 0.16, 0.16, x, yy, zB);
  }
  // 前后拉结
  for (const px of xs) coll.addBox(mats.timber, 0.14, 0.14, Math.abs(zF - zB), px, top - 0.25, (zF + zB) / 2);
  // 两端斜撑
  for (const px of [xs[0], xs[xs.length - 1]]) {
    addBeam(coll, mats.timber, px, G + 5.6, zF, px, top - 0.3, zB, 0.13, 0.13);
    addBeam(coll, mats.timber, px, G + 5.6, zB, px, top - 0.3, zF, 0.13, 0.13);
  }
  // 顶上的小彩头
  coll.addBox(mats.timber, 0.16, 1.1, 0.16, x, top + 0.35, zF);
  coll.addBox(mats.timber, 0.16, 1.1, 0.16, x - 0.7, top - 0.1, zF);
  coll.addBox(mats.timber, 0.16, 1.1, 0.16, x + 0.7, top - 0.1, zF);
  addHipRoof(coll, mats, {
    x, y: top + 0.2, z: zF, width: 2.6, depth: 1.4, height: 0.75,
    tileMat: mats.clothOchre, ridgeMat: mats.banner, overhang: 0.2, lift: 0.2, segU: 3, segV: 2, ornaments: false,
  });

  // 彩帛 / 旗幡
  const colors = [0xb64f34, 0xa9803f, 0x5f7278, 0xd6c9b0, 0xefe4cb];
  const rng = makeRng(91031 + Math.round(x * 7));
  const stripCount = small ? 6 : 13;
  for (let i = 0; i < stripCount; i++) {
    const px = xs[0] + (xs[xs.length - 1] - xs[0]) * ((i + 0.5) / stripCount) + (rng() - 0.5) * 0.6;
    const pz = rng() < 0.5 ? zF : zB;
    swing.push({
      x: px,
      y: top - (rng() < 0.4 ? 1.35 : 0.45),
      z: pz + (rng() - 0.5) * 0.15,
      w: 0.26 + rng() * 0.16,
      h: 0.9 + rng() * 1.5,
      color: colors[Math.floor(rng() * colors.length)],
      amp: 0.1 + rng() * 0.1,
      sp: 0.7 + rng() * 0.9,
      ph: rng() * Math.PI * 2,
    });
  }
  // 顶上的旗
  for (let i = 0; i < (small ? 1 : 3); i++) {
    const fx = x + (i - 1) * (small ? 0 : 2.4);
    swing.push({ x: fx, y: top + 1.5, z: zF + dir * 0.1, w: 0.95, h: 2.3, color: 0xb64f34, amp: 0.22, sp: 0.9 + i * 0.15, ph: i * 1.7 });
    coll.addBox(mats.woodDark, 0.09, 1.7, 0.09, fx, top + 0.8, zF + dir * 0.1);
  }
  // 彩楼两盏灯笼
  if (!small) {
    for (const s of [-1, 1]) addLantern(coll, mats, x + s * 5.4, top - 1.5, zF, 0.3);
  }
}

/** 街尾牌楼：四柱三间，横跨街心，给卷尾一个收束。 */
function addPaifang(coll, mats, swing, o) {
  const { x, z0, z1, h = 8.4 } = o;
  const span = z1 - z0;
  const posts = [z0, z0 + span * 0.3, z0 + span * 0.7, z1];
  const beamMat = mats.timber;
  for (const pz of posts) {
    coll.addBox(mats.stone, 1.0, 0.45, 1.0, x, G + 0.22, pz);
    coll.addBox(mats.woodDark, 0.46, h, 0.46, x, G + 0.45 + h / 2, pz);
    // 柱头的朱红箍
    coll.addBox(mats.column, 0.56, 0.42, 0.56, x, G + h * 0.62, pz);
  }
  // 三道横枋
  for (const f of [0.72, 0.85, 0.97]) {
    coll.addBox(beamMat, 0.24, 0.2, span + 1.4, x, G + h * f, (z0 + z1) / 2);
  }
  // 三间小屋顶（中间高、两边低）
  const segs = [
    { a: z0, b: posts[1], hi: 0, w: span * 0.3 },
    { a: posts[1], b: posts[2], hi: 0.55, w: span * 0.4 },
    { a: posts[2], b: z1, hi: 0, w: span * 0.3 },
  ];
  for (const sg of segs) {
    addGableRoof(coll, mats, {
      x, z: (sg.a + sg.b) / 2, y: G + h * 0.97 + sg.hi, rotY: Math.PI / 2,
      width: sg.w + 0.9, depth: 1.5, height: 0.95 + sg.hi * 0.5,
      tileMat: mats.roofTileDark, ridgeMat: mats.inkDark,
      overhang: 0.32, lift: 0.16, segU: 3, segV: 1,
    });
  }
  // 中间匾额（朝着街的两头，索性两面都挂，镜头在南侧看的是侧面，但抬高点也好看）
  addPlaque(coll, mats, { x, y: G + h * 0.8, z: (z0 + z1) / 2 + 0.3, w: 2.4, h: 0.7, chars: 3 });
  // 两盏灯笼
  for (const pz of [z0 + span * 0.3, z0 + span * 0.7]) addLantern(coll, mats, x, G + h * 0.7, pz + 0.5, 0.26);
  // 两条垂下的红绸
  swing.push({ x: x + 0.3, y: G + h * 0.95, z: z0 + span * 0.3 + 0.2, w: 0.42, h: 2.0, color: 0xb64f34, amp: 0.14, sp: 0.8, ph: 1.1 });
  swing.push({ x: x + 0.3, y: G + h * 0.95, z: z0 + span * 0.7 - 0.2, w: 0.42, h: 2.0, color: 0xb64f34, amp: 0.14, sp: 0.8, ph: 3.4 });
}

/* ---------------------------- 摊位 ---------------------------- */

function addGoodsStall(coll, mats, x, z, w = 2.0) {
  coll.addBox(mats.wood, w, 0.1, 0.95, x, G + 0.82, z);
  for (const [sx, sz] of [[-w * 0.42, -0.36], [w * 0.42, -0.36], [-w * 0.42, 0.36], [w * 0.42, 0.36]]) {
    coll.addBox(mats.woodDark, 0.07, 0.8, 0.07, x + sx, G + 0.4, z + sz);
  }
  coll.addBox(mats.clothOchre, w * 0.9, 0.06, 0.7, x, G + 0.9, z);
  for (let i = 0; i < 4; i++) {
    coll.addBox(mats.thatch, 0.28, 0.2, 0.28, x - w * 0.3 + i * (w * 0.2), G + 0.95, z - 0.15 + (i % 2) * 0.25);
  }
  coll.addBox(mats.wood, 0.06, 2.1, 0.06, x - w * 0.46, G + 1.05, z + 0.5);
  coll.addBox(mats.wood, 0.06, 2.1, 0.06, x + w * 0.46, G + 1.05, z + 0.5);
  coll.addQuad(mats.cloth, V3(x - w * 0.55, G + 2.25, z - 0.6), V3(x + w * 0.55, G + 2.25, z - 0.6), V3(x + w * 0.55, G + 2.0, z + 0.7), V3(x - w * 0.55, G + 2.0, z + 0.7), V3(0, 1, 0));
}

function addPieStall(coll, mats, x, z) {
  coll.addBox(mats.wood, 2.2, 0.1, 1.0, x, G + 0.84, z);
  for (const [sx, sz] of [[-0.9, -0.38], [0.9, -0.38], [-0.9, 0.38], [0.9, 0.38]]) {
    coll.addBox(mats.woodDark, 0.08, 0.82, 0.08, x + sx, G + 0.41, z + sz);
  }
  coll.addCylinder(mats.inkSoft, 0.42, 0.5, 0.7, x + 0.6, G, z + 0.15, 8);
  coll.addCylinder(mats.inkDark, 0.3, 0.34, 0.1, x + 0.6, G + 0.7, z + 0.15, 8);
  for (let i = 0; i < 5; i++) {
    coll.addCylinder(mats.thatch, 0.19, 0.19, 0.07, x - 0.75 + (i % 3) * 0.28, G + 0.92, z - 0.2 + Math.floor(i / 3) * 0.34, 7);
  }
  for (const s of [-1, 1]) coll.addBox(mats.wood, 0.07, 2.0, 0.07, x + s * 1.05, G + 1.0, z + 0.55);
  coll.addQuad(mats.clothOchre, V3(x - 1.2, G + 2.2, z - 0.55), V3(x + 1.2, G + 2.2, z - 0.55), V3(x + 1.2, G + 1.95, z + 0.75), V3(x - 1.2, G + 1.95, z + 0.75), V3(0, 1, 0));
}

function addFortuneStall(coll, mats, x, z, swing) {
  coll.addBox(mats.wood, 1.5, 0.1, 0.85, x, G + 0.8, z);
  for (const [sx, sz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) {
    coll.addBox(mats.woodDark, 0.07, 0.78, 0.07, x + sx, G + 0.39, z + sz);
  }
  coll.addCylinder(mats.woodDark, 0.05, 0.06, 2.9, x + 0.95, G, z + 0.35, 5);
  coll.addBox(mats.woodDark, 0.9, 0.05, 0.05, x + 0.55, G + 2.75, z + 0.35);
  swing.push({ x: x + 0.5, y: G + 2.7, z: z + 0.38, w: 0.42, h: 1.5, color: 0xefe4cb, amp: 0.09, sp: 1.1, ph: 1.2 });
  coll.addCylinder(mats.woodDark, 0.09, 0.09, 0.3, x - 0.2, G + 0.85, z, 6);
  coll.addCylinder(mats.woodDark, 0.09, 0.09, 0.3, x + 0.15, G + 0.85, z - 0.1, 6);
  addParasol(coll, mats, x + 0.2, z + 0.9, 1.25, 2.45, mats.clothOchre);
}

/* ---------------------------- 街市总装 ---------------------------- */

/**
 * 街北侧铺面（立面正对镜头，是画面里“看得见脸”的那一排）：
 * 两层 / 单层混排，酒楼（第 5 间）、香药铺（第 9 间）、茶坊（第 10 间）嵌在中间。
 */
const NORTH_SHOPS = [
  { w: 8.5, d: 7.2, stories: 2, roof: 'tile', banner: true, balcony: true },
  { w: 7.0, d: 6.4, stories: 1, roof: 'thatch', awning: true },
  { w: 8.6, d: 7.6, stories: 2, roof: 'tile', banner: true, balcony: true },
  { w: 3.0, d: 6.0, stories: 1, roof: 'thatch' },
  { w: 16.0, d: 8.0, stories: 2, roof: 'hip', special: 'wine', plaque: true, lanterns: 2, balcony: true },
  { w: 7.8, d: 6.8, stories: 1, roof: 'tile', banner: true, awning: true },
  { w: 9.6, d: 7.2, stories: 1, roof: 'tile', special: 'inn', plaque: true, lanterns: 1, awning: true },
  { w: 5.8, d: 6.4, stories: 1, roof: 'thatch', awning: true },
  { w: 9.8, d: 7.8, stories: 2, roof: 'tile', special: 'herb', plaque: true, banner: true, lanterns: 2, balcony: true },
  { w: 12.0, d: 6.6, stories: 1, roof: 'tile', special: 'tea', plaque: true, openFront: true, lanterns: 1 },
  { w: 7.6, d: 6.8, stories: 1, roof: 'tile', banner: true, awning: true },
  { w: 6.8, d: 6.2, stories: 1, roof: 'thatch', awning: true },
  { w: 7.2, d: 7.0, stories: 2, roof: 'tile', banner: true, balcony: true },
  { w: 6.6, d: 7.4, stories: 2, roof: 'tile', banner: true },
  { w: 6.6, d: 6.6, stories: 1, roof: 'thatch', banner: true, roofSign: true },
  // ↓ 街市东延：接御街口（北排收在御廊以西 x≈220）
  { w: 8.0, d: 6.8, stories: 2, roof: 'tile', banner: true, balcony: true, accent: true, lanterns: 1 },
  { w: 8.4, d: 6.4, stories: 1, roof: 'thatch', awning: true, accent: true },
  { w: 9.0, d: 8.0, stories: 2, roof: 'hip', special: 'corner', plaque: true, plaqueText: 4, lanterns: 4, balcony: true, accent: true, glazeRoof: true, banner: true },
];

/**
 * 街南侧（镜头这一侧）铺面：以单层为主，屋顶压得很低，
 * 好让镜头越过屋面看见街心和北侧的铺面。中间留三个巷口看河。
 */
const SOUTH_SHOPS = [
  { w: 8.0, d: 6.0, stories: 1, roof: 'tile', rear: true, low: true },
  { w: 7.0, d: 6.2, stories: 1, roof: 'thatch', rear: true, low: true },
  { w: 7.0, d: 6.2, stories: 1, roof: 'tile', roofSign: true, rear: true, low: true },
  // 巷口
  { w: 8.0, d: 6.4, stories: 1, roof: 'tile', rear: true, low: true },
  { w: 7.0, d: 6.4, stories: 2, roof: 'tile', rear: true, balcony: true },
  { w: 8.0, d: 6.6, stories: 1, roof: 'tile', rear: true, low: true },
  { w: 7.0, d: 6.4, stories: 1, roof: 'thatch', rear: true, low: true },
  // 巷口
  { w: 8.0, d: 6.2, stories: 2, roof: 'tile', banner: true, rear: true },
  { w: 7.0, d: 6.0, stories: 1, roof: 'thatch', rear: true, low: true },
  { w: 8.0, d: 6.0, stories: 1, roof: 'tile', rear: true, low: true },
  { w: 7.0, d: 5.8, stories: 1, roof: 'thatch', rear: true, low: true },
  { w: 8.0, d: 5.6, stories: 1, roof: 'tile', rear: true, low: true },
  // 巷口
  { w: 7.0, d: 5.4, stories: 1, roof: 'thatch', rear: true, low: true },
  { w: 8.0, d: 5.2, stories: 1, roof: 'tile', roofSign: true, rear: true, low: true },
  { w: 7.0, d: 5.0, stories: 1, roof: 'thatch', rear: true, low: true },
  { w: 10.0, d: 4.8, stories: 2, roof: 'tile', banner: true, balcony: true, rear: true },
  { w: 5.0, d: 4.6, stories: 1, roof: 'tile', roofSign: true, rear: true, low: true },
  // ↓ 街市东延的南排：河岸收得更紧，做成一间间临河小铺
  { w: 8.0, d: 6.0, stories: 1, roof: 'tile', rear: true, low: true, accent: true },
  { w: 7.0, d: 5.6, stories: 1, roof: 'thatch', rear: true, low: true, accent: true },
  { w: 8.0, d: 5.2, stories: 1, roof: 'tile', rear: true, low: true, roofSign: true },
];

/** 南侧三个巷口的起点（相对南排第一间的 x）。 */
const SOUTH_GAPS_AT = [2, 7, 12];

function buildMarket(coll, mats, rng, swing) {
  // —— 街北侧 ——（立面 z = -31，朝 +z）
  const north = [];
  let cursor = 68;
  for (const cfg of NORTH_SHOPS) {
    north.push({ cfg, x0: cursor });
    addShop(coll, mats, rng, { ...cfg, x0: cursor, zFront: STREET_N, dir: 1 });
    cursor += cfg.w + 0.22;
  }
  // —— 街南侧 ——（立面 z = -17，朝 -z；进深跟着河岸收；中间留三个巷口）
  const south = [];
  cursor = 58;
  for (let i = 0; i < SOUTH_SHOPS.length; i++) {
    const cfg = SOUTH_SHOPS[i];
    south.push({ cfg, x0: cursor });
    addShop(coll, mats, rng, { ...cfg, x0: cursor, zFront: STREET_S, dir: -1, autoDepth: true });
    cursor += cfg.w + 0.22;
    if (SOUTH_GAPS_AT.includes(i)) {
      // 巷口：一条能看进街心的小缺口
      cursor += 3.4;
      addAlleyMouth(coll, mats, rng, cursor - 1.7);
    }
  }

  // —— 酒楼（北侧第 5 间）与彩楼欢门 ——
  const wine = north[4];
  const wineCx = wine.x0 + wine.cfg.w / 2;
  addCaiLou(coll, mats, { x: wineCx, zFront: STREET_N, width: 15.2, height: 10.2, dir: 1 }, swing);
  for (let i = 0; i < 5; i++) addJar(coll, mats, wine.x0 + 1.4 + i * 0.82, STREET_N + 1.3, 0.85 + (i % 2) * 0.15);
  addStandingSign(coll, mats, { x: wine.x0 + 1.1, z: STREET_N + 1.7, h: 3.8, w: 1.0, base: 1.0 });

  // —— 香药铺（正店）的冲天招牌 ——
  const herb = north[8];
  addStandingSign(coll, mats, { x: herb.x0 + 0.9, z: STREET_N + 1.5, h: 4.2, w: 1.05, base: 1.1 });
  for (let i = 0; i < 3; i++) addJar(coll, mats, herb.x0 + 2.2 + i * 0.72, STREET_N + 1.2, 0.7);

  // —— 茶坊（北侧第 10 间）：大伞 + 桌凳 ——
  const tea = north[9];
  const teaCx = tea.x0 + tea.cfg.w / 2;
  addParasol(coll, mats, tea.x0 + 2.6, STREET_N + 2.7, 2.45, 2.95, mats.cloth);
  addParasol(coll, mats, tea.x0 + 7.4, STREET_N + 2.4, 2.1, 2.75, mats.clothOchre);
  addParasol(coll, mats, tea.x0 + 10.4, STREET_N + 1.7, 1.5, 2.4, mats.clothBlue);
  for (const [tx, tz] of [[tea.x0 + 2.4, STREET_N + 2.4], [tea.x0 + 4.3, STREET_N + 1.7], [tea.x0 + 7.5, STREET_N + 2.2]]) {
    addTableSet(coll, mats, tx, tz);
  }

  // —— 摊案：饼摊 + 算命摊 + 杂货摊（都摆在街北半边，镜头才看得见）——
  addPieStall(coll, mats, 168, STREET_N + 1.6);
  addFortuneStall(coll, mats, 122, STREET_N + 1.9, swing);
  addGoodsStall(coll, mats, 99, STREET_N + 1.8);
  addGoodsStall(coll, mats, 75, STREET_N + 1.7);
  addGoodsStall(coll, mats, 44.6, -32.8);

  // 北排街前两杆高望子（立在街边，比屋檐还高）
  addWangzi(coll, mats, { x: 81.6, z: STREET_N + 1.0, h: 7.9, mat: mats.paperSign, w: 1.02, hh: 2.3 });
  addWangzi(coll, mats, { x: 159.2, z: STREET_N + 1.0, h: 8.4, mat: mats.clothOchre, w: 1.02, hh: 2.4 });

  // 街上两辆板车
  addCart(coll, mats, 118.2, -21.0, 0.25);
  addCart(coll, mats, 176.4, -22.4, -0.2);

  // 街心偏南的一排摊案（抬高镜头时看得见）
  addGoodsStall(coll, mats, 108.4, -21.4);
  addGoodsStall(coll, mats, 143.8, -21.2);
  addParasol(coll, mats, 128.6, -21.0, 1.6, 2.5, mats.cloth);
  addTableSet(coll, mats, 128.4, -21.0);
  addLoadPole(coll, mats, 161.2, -21.6, 0.15);
  addHitchPost(coll, mats, 117.6, -20.6, 0.1);

  // —— 货担 / 酒瓮 / 拴马桩 / 街口伞棚 ——
  for (const [x, z, r] of [[78.5, -29.2, 0.4], [130, -29.2, -0.3], [186, -29.4, 0.2]]) {
    addLoadPole(coll, mats, x, z, r);
  }
  addJar(coll, mats, 156.4, STREET_N + 1.2, 0.9);
  addJar(coll, mats, 157.1, STREET_N + 1.05, 0.75);
  addJar(coll, mats, 103.4, STREET_N + 1.5, 0.8);
  for (const [x, z] of [[95.4, STREET_N + 1.1], [145.2, STREET_N + 1.2], [183.5, STREET_N + 1.4], [59.4, STREET_N + 1.4]]) {
    addHitchPost(coll, mats, x, z, 0.2);
  }
  for (const [x, z] of [[191.5, STREET_N + 1.5], [66.5, STREET_N + 1.6]]) {
    addParasol(coll, mats, x, z, 1.4, 2.3, mats.clothOchre);
  }

  // —— 南排后檐的高杆望子：幌子高过屋顶，从街上一眼能认出来 ——
  const wangziAt = (idx, h, mat) => {
    const s = south[idx];
    if (!s) return;
    const cx = s.x0 + s.cfg.w / 2;
    const dEff = Math.min(s.cfg.d, Math.max(2.9, northBankZ(cx) + 17 - 0.6));
    addWangzi(coll, mats, { x: cx, z: STREET_S + dEff + 0.15, h, mat, w: 1.0, hh: 2.2 });
  };
  wangziAt(0, 7.7, mats.paperSign);
  wangziAt(4, 8.1, mats.cloth);
  wangziAt(9, 8.3, mats.clothOchre);
  wangziAt(11, 7.6, mats.paperSign);
  wangziAt(13, 7.9, mats.clothBlue);

  // —— 卷尾牌楼：横跨街心，把长街收住 ——
  addPaifang(coll, mats, swing, { x: 188.2, z0: -29.6, z1: -18.4, h: 8.4 });

  // —— 卷尾南侧脚店的小欢门 ——
  const mini = south[14];
  addCaiLou(coll, mats, { x: mini.x0 + mini.cfg.w / 2, zFront: STREET_S, width: 6.2, height: 7.2, small: true, dir: -1 }, swing);

  /* ====================================================================== */
  /*  御街口：街市东头与御街（x=250）交接的那一小片                              */
  /* ====================================================================== */
  const corner = north[north.length - 1];
  const cornerCx = corner.x0 + corner.cfg.w / 2;

  // 御街口牌楼（比街尾那座高一点，跨街收口）
  addPaifang(coll, mats, swing, { x: 223.4, z0: -29.8, z1: -18.2, h: 8.8 });
  // 转角正店的彩楼欢门（朝街的这一面）
  addCaiLou(coll, mats, { x: cornerCx - 1.4, zFront: STREET_N, width: 8.4, height: 8.8, small: true, dir: 1 }, swing);
  // 正店门前的大酒瓮、酒旗与灯笼
  for (let i = 0; i < 6; i++) addJar(coll, mats, corner.x0 + 1.2 + i * 0.78, STREET_N + 1.5, 0.9 + (i % 2) * 0.18);
  addStandingSign(coll, mats, { x: corner.x0 + 1.0, z: STREET_N + 2.1, h: 4.6, w: 1.1, base: 1.2 });
  addWangzi(coll, mats, { x: cornerCx + 3.4, z: STREET_N + 1.1, h: 9.2, mat: mats.banner, w: 1.1, hh: 2.6 });
  // 御街口另一侧的望子（挂在南排的临河小铺前）
  addWangzi(coll, mats, { x: 226.0, z: -16.8, h: 8.6, mat: mats.clothOchre, w: 1.05, hh: 2.4 });
  addWangzi(coll, mats, { x: 211.6, z: STREET_N + 1.0, h: 8.0, mat: mats.paperSign, w: 1.02, hh: 2.3 });

  // 御街口的两座石墩上挂灯笼（接御街的灯火）
  for (const [px, pz] of [[227.4, -17.5], [231.2, -17.3]]) {
    addLantern(coll, mats, px, G + 4.3, pz + 0.1, 0.34);
    coll.addBox(mats.woodDark, 0.7, 0.07, 0.07, px, G + 4.72, pz);
  }
  // 河沿平台：茶棚 + 桌凳 + 货担 + 柳荫
  addParasol(coll, mats, 225.0, -15.7, 2.15, 2.85, mats.clothBlue);
  addParasol(coll, mats, 229.6, -15.5, 1.7, 2.55, mats.clothOchre);
  addTableSet(coll, mats, 224.8, -15.6);
  addTableSet(coll, mats, 229.4, -15.5);
  addLoadPole(coll, mats, 222.4, -15.6, 0.3);
  addHitchPost(coll, mats, 232.0, -16.4, 0.1);
  for (let i = 0; i < 3; i++) addJar(coll, mats, 231.2 + i * 0.55, -15.2, 0.62);

  // 御街口的两个摊案
  addGoodsStall(coll, mats, 218.6, -29.2);
  addGoodsStall(coll, mats, 222.8, -18.4);
  addPieStall(coll, mats, 214.0, -29.4);

  return { north, south, corner };
}

/** 南排铺面之间的巷口：一段矮墙 + 一株树，透一点街心进来。 */
function addAlleyMouth(coll, mats, rng, x) {
  coll.addBox(mats.wallGray, 2.6, 1.15, 0.3, x, G + 0.58, STREET_S + 0.1);
  coll.addBox(mats.inkWash, 2.7, 0.12, 0.4, x, G + 1.2, STREET_S + 0.1);
  addJar(coll, mats, x + 0.6, STREET_S + 0.75, 0.6);
  coll.addBox(mats.wood, 0.7, 0.5, 0.5, x - 0.7, G + 0.25, STREET_S + 0.8, 0.4);

}

/* ========================================================================== */
/*  6. 关厢（城门西侧的沿街小店）                                              */
/* ========================================================================== */

const OUTSKIRT_SHOPS = [
  { w: 6.2, d: 6.2, stories: 1, roof: 'thatch', banner: true, awning: true },
  { w: 7.0, d: 6.6, stories: 1, roof: 'tile', plaque: true, lanterns: 1, awning: true },
  { w: 6.6, d: 6.0, stories: 1, roof: 'tile', banner: true },
];

function buildOutskirts(coll, mats, rng, swing) {
  let cursor = 20;
  for (const cfg of OUTSKIRT_SHOPS) {
    addShop(coll, mats, rng, { ...cfg, x0: cursor, zFront: STREET_N, dir: 1 });
    cursor += cfg.w + 0.25;
  }
  // 草棚（四面透风的草顶棚子）
  const sx = 41.4;
  const sz = -26.6;
  for (const [px, pz] of [[-1.6, -1.4], [1.6, -1.4], [-1.6, 1.4], [1.6, 1.4]]) {
    coll.addBox(mats.woodDark, 0.14, 2.15, 0.14, sx + px, G + 1.07, sz + pz);
  }
  addGableRoof(coll, mats, {
    x: sx, z: sz, y: G + 2.15, width: 4.2, depth: 3.8, height: 1.0,
    tileMat: mats.thatch, ridgeMat: mats.thatch, overhang: 0.35, lift: 0.1, segU: 3, segV: 1,
  });
  coll.addBox(mats.thatch, 3.6, 1.3, 0.1, sx, G + 1.55, sz - 1.9);
  coll.addBox(mats.wood, 3.2, 0.1, 0.7, sx, G + 0.8, sz + 0.3);
  for (const s of [-1, 1]) coll.addBox(mats.woodDark, 0.07, 0.75, 0.07, sx + s * 1.3, G + 0.38, sz + 0.3);
  // 茶摊
  addParasol(coll, mats, 29.4, -25.6, 2.0, 2.7, mats.clothOchre);
  addTableSet(coll, mats, 29.2, -25.4);
  addTableSet(coll, mats, 31.8, -24.6);
  // 拴马桩
  addHitchPost(coll, mats, 21.6, -19.6, 0.3);
  addHitchPost(coll, mats, 43.2, -20.8, -0.2);
  // 草垛
  addHaystack(coll, mats, 22.4, -15.2, 1.15, 1.8);
  addHaystack(coll, mats, 36.4, -15.4, 0.95, 1.5);
  // 河沿的柳（树走 flora，见 addTownTrees）
  // 草棚前的一辆板车
  coll.addBox(mats.wood, 2.0, 0.18, 1.1, 41.6, G + 0.72, -23.0, 0.2);
  for (const s of [-1, 1]) {
    coll.push(mats.woodDark, new THREE.TorusGeometry(0.34, 0.06, 4, 10), M4(41.0 + s * 0.9, G + 0.4, -23.2, Math.PI / 2));
  }
  coll.addBox(mats.woodDark, 0.08, 0.08, 1.9, 41.2, G + 0.95, -22.0, 0.2);
  // 关厢小店的幌子（先立杆、再挂布，别让布条悬在半空）
  for (const [wx, wy, wz, col] of [[27.6, 4.4, -28.3, 0xb64f34], [36.9, 4.5, -28.4, 0xd6c9b0]]) {
    coll.addCylinder(mats.woodDark, 0.07, 0.1, wy, wx, G, -29.0, 5);
    coll.addBox(mats.woodDark, 0.06, 0.06, 1.05, wx, G + wy - 0.05, -28.5);
    swing.push({ x: wx, y: G + wy - 0.1, z: wz, w: 0.52, h: 1.85, color: col, amp: 0.15, sp: 1.0, ph: wx });
  }
  // 门前的草料车与货箱堆
  coll.addBox(mats.wood, 1.5, 0.55, 0.9, 45.6, G + 0.28, -34.4, 0.3);
  coll.addBox(mats.thatch, 1.3, 0.4, 0.8, 45.6, G + 0.75, -34.4, 0.3);
  for (let i = 0; i < 3; i++) coll.addBox(mats.wood, 0.6, 0.5, 0.6, 47.4 + (i % 2) * 0.35, G + 0.25 + Math.floor(i / 2) * 0.52, -34.2, i * 0.2);
}

/* ========================================================================== */
/*  7. 人                                                                      */
/* ========================================================================== */

/** 酒楼前围人的锚点。 */
const WINE_CROWD_X = 68 + 8.5 + 7 + 8.6 + 3 + 16 / 2 + 0.22 * 4;

function rentKind(rng) {
  const r = rng();
  return r < 0.2 ? 'scholar' : r < 0.38 ? 'walker' : r < 0.5 ? 'lady' : 'walker';
}

function addPeople(ctx) {
  const P = ctx.people;
  if (!Array.isArray(P)) return;
  const from = P.length;
  const rng = makeRng(20250404);
  const put = (kind, x, z, extra) => P.push(extra ? { kind, x, z, ...extra } : { kind, x, z });
  const jitter = (r) => (rng() - 0.5) * 2 * r;

  /* —— 街市：沿街走的人（多半走在街北半边，镜头才看得见）—— */
  for (let i = 0; i < 62; i++) {
    const x = range(rng, 64, 228);
    const z = STREET_N + 0.9 + Math.pow(rng(), 2.6) * 9.2;
    const right = rng() < 0.5;
    const span = Math.max(8, Math.min(range(rng, 16, 42), 2 * Math.min(x - 60, 230 - x)));
    const roll = rng();
    const kind = roll < 0.15 ? 'porter' : roll < 0.3 ? 'lady' : roll < 0.42 ? 'child' : roll < 0.53 ? 'scholar' : 'walker';
    put(kind, x, z, { dir: right ? [1, 0] : [-1, 0], span, speed: range(rng, 0.5, 1.0) });
  }
  /* —— 摊前围的人 —— */
  const crowds = [
    [99, -28.6], [122, -28.8], [168, -29.0], [75, -29.0], [44.8, -33.2], [138, -29.2],
    [WINE_CROWD_X, -28.4], [WINE_CROWD_X + 5, -29.6], [152.4, -28.6], [156.6, -29.4],
    // 三个南排巷口（十字街口的人流）
    [80.8, -20.6], [131.4, -21.2], [178.4, -20.8],
    // 御街口
    [214.2, -28.8], [218.8, -29.2], [222.6, -18.6], [226.8, -19.4], [229.6, -16.6],
    // 东延街段
    [199.6, -28.6], [206.2, -28.4], [211.8, -20.4],
  ];
  for (const [ccx, ccz] of crowds) {
    const n = 4 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const x = ccx + jitter(2.6);
      const z = ccz + jitter(1.5);
      const roll = rng();
      const kind = roll < 0.2 ? 'child' : roll < 0.45 ? 'lady' : roll < 0.6 ? 'scholar' : 'walker';
      put(kind, x, z, { speed: 0.3 + rng() * 0.3 });
    }
  }
  /* —— 挑夫 —— */
  for (const [x, z, dir] of [
    [70.5, -29.2, 1], [83, -28.4, -1], [97, -29.4, 1], [122, -27.2, -1],
    [147, -29.0, 1], [163, -28.4, -1], [180, -28.6, 1], [190, -27.2, -1], [92, -20.6, 1],
    [104, -20.2, 1], [115, -28.8, -1], [128, -23.4, 1], [141, -19.6, -1],
    [172, -20.2, 1], [196, -20.6, -1], [204, -27.8, 1], [210, -23.6, -1],
    [216, -28.4, 1], [223, -21.2, -1], [228.4, -27.2, 1], [231.2, -19.4, -1],
  ]) {
    put('porter', x, z, { dir: [dir, 0], span: 10 + rng() * 12, speed: 0.55 + rng() * 0.35 });
  }
  /* —— 骑马 / 轿子 / 驴 —— */
  put('rider', 72, -27.2, { dir: [1, 0], span: 16, speed: 0.8 });
  put('rider', 120, -26.6, { dir: [-1, 0], span: 18, speed: 0.75 });
  put('rider', 175, -27.4, { dir: [1, 0], span: 12, speed: 0.7 });
  put('rider', 143, -20.4, { dir: [1, 0], span: 14, speed: 0.7 });
  put('rider', 197, -23.2, { dir: [-1, 0], span: 16, speed: 0.72 });
  put('rider', 212, -26.2, { dir: [1, 0], span: 12, speed: 0.74 });
  put('rider', 227, -22.0, { dir: [-1, 0], span: 8, speed: 0.7 });
  put('palanquin', 85, -26.6, { dir: [1, 0], span: 20, speed: 0.5 });
  put('palanquin', 131, -28.0, { dir: [-1, 0], span: 16, speed: 0.45 });
  put('palanquin', 171, -26.8, { dir: [1, 0], span: 14, speed: 0.5 });
  put('palanquin', 197, -20.6, { dir: [1, 0], span: 18, speed: 0.48 });
  put('palanquin', 209, -27.0, { dir: [-1, 0], span: 14, speed: 0.46 });
  put('palanquin', 219.2, -20.8, { dir: [-1, 0], span: 10, speed: 0.45 });
  put('palanquin', 228.6, -28.2, { dir: [1, 0], span: 8, speed: 0.5 });
  for (const [x, z, dir] of [
    [78, -27.6, 1], [110, -28.4, -1], [155, -27.8, 1], [185, -27.4, -1], [95.6, -20.8, 0],
    [99.4, -26.6, 1], [101.2, -27.4, 1], [103.0, -28.2, 1],          // 一列驴队
    [199, -27.8, 1], [206, -19.8, -1], [216, -20.6, 1], [224, -28.6, -1],
  ]) {
    put('donkey', x, z, dir ? { dir: [dir, 0], span: 8, speed: 0.5 } : {});
  }
  // 拴马桩旁拴着的马与驴（做个静止的锚点，读作“拴着的”）
  put('donkey', 96.6, -29.1);
  put('donkey', 146.4, -28.9);
  put('rider', 184.6, -28.5);
  put('rider', 60.4, -28.8);
  /* —— 街心中段南半边的人（俯视时把街填满）—— */
  for (let i = 0; i < 28; i++) {
    const x = range(rng, 64, 230);
    const z = -25.2 + rng() * 6.4;
    const roll = rng();
    const kind = roll < 0.16 ? 'porter' : roll < 0.32 ? 'lady' : roll < 0.46 ? 'child' : roll < 0.58 ? 'scholar' : roll < 0.66 ? 'donkey' : 'walker';
    put(kind, x, z, kind === 'donkey' ? {} : { dir: rng() < 0.5 ? [1, 0] : [-1, 0], span: 6 + rng() * 10, speed: 0.45 + rng() * 0.4 });
  }

  /* —— 街心的人：挑担的、赶路的、跟着大人的孩子 —— */
  for (let i = 0; i < 22; i++) {
    const x = range(rng, 66, 230);
    const z = -27.6 + rng() * 5.4;
    const roll = rng();
    const kind = roll < 0.2 ? 'porter' : roll < 0.36 ? 'child' : roll < 0.52 ? 'donkey' : roll < 0.7 ? 'lady' : 'walker';
    put(kind, x, z, kind === 'donkey' ? {} : { dir: rng() < 0.5 ? [1, 0] : [-1, 0], span: 7 + rng() * 9, speed: 0.5 + rng() * 0.4 });
  }

  /* —— 贴着北排铺面走的人（从镜头上越过南排屋面能看见的一条人带）—— */
  for (let i = 0; i < 26; i++) {
    const x = range(rng, 66, 230);
    const z = STREET_N + 0.7 + rng() * 3.4;
    const right = rng() < 0.5;
    const roll = rng();
    const kind = roll < 0.18 ? 'porter' : roll < 0.36 ? 'lady' : roll < 0.5 ? 'child' : roll < 0.62 ? 'scholar' : 'walker';
    put(kind, x, z, { dir: right ? [1, 0] : [-1, 0], span: 6 + rng() * 10, speed: 0.4 + rng() * 0.35 });
  }

  /* —— 摊主 / 香客 / 孩童 —— */
  put('vendor', 99, -28.2);
  put('vendor', 168, -28.4);
  put('vendor', 122, -27.9);
  put('vendor', 75, -28.4);
  put('vendor', 29.2, -25.1);
  put('vendor', 44.9, -32.6);
  for (const [x, z] of [[138, -28.6], [139.4, -28.0], [96.5, -29.0], [166.2, -28.2], [58.6, -20.4], [188.4, -28.2]]) {
    put(rng() < 0.5 ? 'scholar' : 'walker', x, z);
  }
  for (const [x, z] of [[150.4, -28.0], [153.6, -27.4], [102, -28.6], [126, -28.4], [179, -20.4], [193, -28.6]]) put('lady', x, z);
  for (const [x, z] of [[149, -28.8], [113, -28.8], [124, -27.8], [151.8, -28.4], [170, -28.4], [181, -28.4]]) put('child', x, z);
  for (const [x, z] of [[62.4, -20.6], [176, -27.6], [145.6, -28.8], [212.4, -19.2], [228.4, -18.4], [206.6, -28.2]]) put('monk', x, z);
  // 东延街段 / 御街口的摊主、香客、孩子
  put('vendor', 214.2, -28.6);
  put('vendor', 222.6, -18.8);
  put('vendor', 206.2, -28.4);
  put('vendor', 229.2, -15.8);
  for (const [x, z] of [[200.4, -28.6], [207.6, -20.2], [215.8, -19.4], [221.2, -27.8], [227.4, -21.8], [230.4, -27.0]]) {
    put(rng() < 0.5 ? 'scholar' : 'walker', x, z);
  }
  for (const [x, z] of [[202.8, -20.4], [210.6, -27.6], [218.4, -18.8], [224.6, -28.6], [228.8, -16.4]]) put('lady', x, z);
  for (const [x, z] of [[198.6, -28.8], [205.4, -19.6], [213.2, -20.4], [226.2, -27.4], [230.2, -18.8]]) put('child', x, z);
  /* —— 卷尾人流再密 + 街市东延段 —— */
  for (let i = 0; i < 46; i++) {
    const x = range(rng, 176, 232);
    const z = STREET_N + 1.0 + Math.pow(rng(), 2.2) * 8.2;
    const roll = rng();
    const kind = roll < 0.25 ? 'porter' : roll < 0.45 ? 'lady' : roll < 0.6 ? 'child' : rentKind(rng);
    put(kind, x, z, { dir: rng() < 0.5 ? [1, 0] : [-1, 0], span: 6 + rng() * 8, speed: 0.6 + rng() * 0.4 });
  }
  // 御街口一带的过街人流（南北向穿过街心）
  for (let i = 0; i < 16; i++) {
    const x = 222 + rng() * 9;
    const z = -31 + rng() * 15;
    const kind = rng() < 0.18 ? 'porter' : rng() < 0.3 ? 'lady' : rng() < 0.42 ? 'child' : rng() < 0.55 ? 'scholar' : 'walker';
    put(kind, x, z, { dir: rng() < 0.5 ? [0, 1] : [0, -1], span: 6 + rng() * 8, speed: 0.4 + rng() * 0.4 });
  }

  /* —— 城门口 15 人：骆驼队从门洞进出 —— */
  put('camel', 49.0, -40.4, { dir: [0.12, -1], span: 9, speed: 0.42 });
  put('camel', 51.2, -42.2, { dir: [0.12, -1], span: 9, speed: 0.4 });
  put('camel', 53.6, -44.0, { dir: [0.12, -1], span: 9, speed: 0.38 });
  put('rider', 46.2, -36.6, { dir: [0.2, -1], span: 8, speed: 0.5 });
  put('rider', 58.2, -37.4, { dir: [-0.2, -1], span: 8, speed: 0.55 });
  put('porter', 50.4, -34.6, { dir: [0, -1], span: 6, speed: 0.6 });
  put('porter', 55.2, -33.4, { dir: [0, -1], span: 6, speed: 0.55 });
  put('walker', 45.4, -34.2);
  put('walker', 59.2, -33.6);
  put('walker', 47.2, -32.4);
  put('scholar', 52.4, -32.8);
  put('scholar', 56.8, -33.2);
  put('monk', 44.4, -35.4);
  put('lady', 61.2, -34.4);
  put('child', 53.2, -31.8);
  // 再加一队骆驼、一队驴、几个脚夫与守门禁军
  put('camel', 47.2, -38.6, { dir: [0.08, -1], span: 8, speed: 0.36 });
  put('camel', 54.8, -39.8, { dir: [0.08, -1], span: 8, speed: 0.34 });
  put('camel', 45.6, -34.8, { dir: [0.16, -1], span: 7, speed: 0.4 });
  put('donkey', 44.6, -33.6, { dir: [0, -1], span: 5, speed: 0.45 });
  put('donkey', 46.2, -34.8, { dir: [0, -1], span: 5, speed: 0.45 });
  put('donkey', 47.8, -36.0, { dir: [0, -1], span: 5, speed: 0.45 });
  put('rider', 42.6, -32.6, { dir: [0.3, -1], span: 7, speed: 0.5 });
  put('rider', 61.6, -32.2, { dir: [-0.3, -1], span: 7, speed: 0.5 });
  put('porter', 42.4, -30.8, { dir: [1, 0], span: 8, speed: 0.55 });
  put('porter', 62.4, -30.4, { dir: [-1, 0], span: 8, speed: 0.55 });
  put('walker', 50.2, -30.6);
  put('scholar', 49.6, -29.6);

  /* —— 关厢 10 人 —— */
  put('walker', 24, -22.4, { dir: [1, 0], span: 12, speed: 0.6 });
  put('walker', 31, -20.6, { dir: [-1, 0], span: 10, speed: 0.55 });
  put('porter', 27, -24.2, { dir: [1, 0], span: 12, speed: 0.5 });
  put('porter', 38, -22.8, { dir: [-1, 0], span: 8, speed: 0.5 });
  put('monk', 34.4, -21.4);
  put('child', 23.6, -19.2);
  put('lady', 30.6, -23.6);
  put('scholar', 36.2, -20.4);
  put('donkey', 22.8, -20.6);
  put('vendor', 40.8, -24.6);

  /* —— 城墙走道上 4 个守卒（y 直接给墙顶）—— */
  const wallTopY = G + WALL_H + 0.01;
  for (const [x, dir] of [[33.4, 1], [37.2, -1], [67.6, 1], [71.4, -1]]) {
    put('walker', x, WALL_Z - 0.6, { y: wallTopY, dir: [dir, 0], span: 4.2, speed: 0.35 });
  }
  // 分区计数（给验收用）
  const counts = { market: 0, gate: 0, outer: 0, other: 0 };
  for (let i = from; i < P.length; i++) {
    const p = P[i];
    if (p.y != null) counts.other += 1;
    else if (p.x >= 66 && p.x <= 233) counts.market += 1;
    else if (p.x >= 43 && p.x <= 63 && p.z <= -30) counts.gate += 1;
    else if (p.x >= 18 && p.x < 43 && p.z <= -17) counts.outer += 1;
    else counts.other += 1;
  }
  return counts;
}

/* ========================================================================== */
/*  8. 摆动的布条（彩楼彩帛 / 旗幡 / 卦幡）                                      */
/* ========================================================================== */

function buildSwingingCloth(ctx, specs) {
  if (!specs.length) return null;
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, -0.5, 0); // 以顶边为转轴
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, flatShading: true });
  setInkWeight(mat, 0.42);
  const inst = new THREE.InstancedMesh(geo, mat, specs.length);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst.frustumCulled = false;
  inst.name = 'town-cloth';
  const color = new THREE.Color();
  for (let i = 0; i < specs.length; i++) {
    color.setHex(specs[i].color);
    inst.setColorAt(i, color);
  }
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, 'XYZ');
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const update = (t) => {
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      e.set(Math.sin(t * s.sp + s.ph) * s.amp * 0.45, 0, Math.sin(t * s.sp + s.ph + 1.2) * s.amp);
      q.setFromEuler(e);
      pos.set(s.x, s.y, s.z);
      scl.set(s.w, s.h, 1);
      m4.compose(pos, q, scl);
      inst.setMatrixAt(i, m4);
    }
    inst.instanceMatrix.needsUpdate = true;
  };
  update(0);
  if (ctx && typeof ctx.onTick === 'function') ctx.onTick(update);
  return inst;
}

/* ========================================================================== */
/*  9. 树（走 flora 的全场景共享实例批次）                                      */
/* ========================================================================== */

function addTownTrees(specs) {
  const T = (kind, x, z, h) => specs.push({ kind, x, z, y: G, h });
  // 城墙两端 / 墙后（从墙头探出来的那一层绿）
  T('pine', 13.0, -40.0, 8.0);
  T('cypress', 11.5, -44.5, 9.5);
  T('willow', 16.5, -38.5, 6.5);
  T('blossom', 22.5, -39.8, 5.6);
  T('pine', 199.0, -39.8, 7.6);
  T('blossom', 202.6, -38.6, 5.8);
  T('pine', 213.5, -39.0, 7.2);
  T('cypress', 209.5, -52.0, 9.6);
  T('pine', 204.0, -58.0, 8.2);
  T('cypress', 212.5, -60.0, 9.8);
  T('pine', 88.0, -51.0, 9.5);
  T('cypress', 123.0, -50.0, 8.6);
  T('pine', 158.0, -51.5, 10.0);
  T('cypress', 192.0, -49.5, 8.2);
  // 街边：巷口 / 街心 / 御街口
  T('willow', 62.6, -19.0, 5.6);
  T('blossom', 111.2, -18.8, 5.8);
  T('willow', 194.9, -19.2, 6.4);
  T('willow', 80.7, -15.4, 6.2);
  T('willow', 131.4, -15.4, 6.4);
  T('willow', 178.2, -15.4, 6.0);
  T('willow', 221.0, -14.6, 5.4);
  T('willow', 226.6, -14.8, 6.2);
  T('blossom', 231.4, -15.2, 5.6);
  T('blossom', 231.2, -20.4, 5.8);
  T('blossom', 44.6, -15.9, 5.8);
  // 关厢河沿
  T('willow', 19.2, -15.6, 6.4);
  T('willow', 39.6, -13.8, 5.6);
  T('willow', 28.4, -14.6, 5.2);
  T('blossom', 34.0, -16.2, 5.0);
}

/* ========================================================================== */
/*  10. 构建入口                                                               */
/* ========================================================================== */

export function buildTown(ctx) {
  const mats = ctx?.mats || {};
  const group = new THREE.Group();
  group.name = 'town';

  const coll = new Collector();
  const swing = [];
  const rng = makeRng(1897);
  const treeSpecs = [];

  buildStreet(coll, mats);
  buildWall(coll, mats, rng, swing);
  buildGate(coll, mats, swing);
  buildMarket(coll, mats, rng, swing);
  buildOutskirts(coll, mats, rng, swing);
  addTownTrees(treeSpecs);
  const peopleCounts = addPeople(ctx);

  const staticGroup = coll.build('town-static');
  group.add(staticGroup);

  const cloth = buildSwingingCloth(ctx, swing);
  if (cloth) group.add(cloth);

  // 树：flora 的全场景共享批次（country / river 已经建过，这里只追加实例）
  if (treeSpecs.length) group.add(buildTrees(treeSpecs, ctx));

  group.userData.shopCount = NORTH_SHOPS.length + SOUTH_SHOPS.length + OUTSKIRT_SHOPS.length;
  group.userData.people = Array.isArray(ctx?.people) ? ctx.people.length : 0;
  group.userData.peopleCounts = peopleCounts;
  group.userData.triangles = staticGroup.userData.triangles;
  group.userData.batches = staticGroup.userData.batches;
  group.userData.cloth = swing.length;
  group.userData.trees = treeSpecs.length;
  group.userData.marketEast = MARKET_EAST;
  return group;
}
