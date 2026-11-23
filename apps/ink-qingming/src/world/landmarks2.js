/**
 * landmarks2.js —— 东京城（汴京）的地标群：铁塔 / 繁塔 / 太庙 / 景灵宫 / 上清宫 / 金明池·琼林苑。
 *
 * 坐标：1 世界单位 = 1 米，全部取 layout.js 的 CITY_LANDMARKS（上清宫按空地补位）。
 * 契约：export function buildLandmarks2(ctx) → THREE.Group(name='landmarks2')
 *
 * 性能策略：
 *   · 所有静态几何按「材质 + 顶点属性布局」合并成 ~20 个 Mesh；
 *   · 树走 flora 共享实例批次；人只 push ctx.people，由 people.js 统一画；
 *   · 塔身用低分段圆柱 / 方盒 + 逐层檐板，不做雕花。
 */
import * as THREE from 'three';
import { mergeGeometries } from '../lib/merge-safe.js';
import { GROUND_Y, CITY_LANDMARKS } from '../layout.js';
import { hipRoofGeometry, gableRoofGeometry, roundRoofGeometry } from '../lib/roof.js';
import { buildTrees } from '../lib/flora.js';
import { inkMat, setInkWeight } from '../lib/materials.js';
import * as P from '../lib/palette.js';
import { makeRng } from '../lib/rand.js';

const Y = GROUND_Y;
const TAU = Math.PI * 2;
const LM = Object.fromEntries(CITY_LANDMARKS.map((l) => [l.id, l]));

/* -------------------------------------------------------------------------- */
/*  合并器：材质 + 顶点属性布局 → 一个 Mesh                                      */
/* -------------------------------------------------------------------------- */

function tfGeo(geo, x, y, z, ry = 0) {
  if (ry) geo.rotateY(ry);
  geo.translate(x, y, z);
  return geo;
}

class Kit {
  constructor(ctx) {
    this.ctx = ctx;
    this.mats = ctx.mats;
    this.batches = new Map();
    this.treeSpecs = [];
    this.people = Array.isArray(ctx.people) ? ctx.people : [];
    this.rng = makeRng(20261106);
    // 局部点缀材质（铁色琉璃 / 砖色 / 池水）
    this.iron = setInkWeight(inkMat(0x6e5238, { flatShading: true }), 0.35);
    this.ironDark = setInkWeight(inkMat(0x4d3928, { flatShading: true }), 0.4);
    this.brick = setInkWeight(inkMat(0xa08668, { flatShading: true }), 0.3);
    this.brickDark = setInkWeight(inkMat(0x7d674e, { flatShading: true }), 0.35);
    this.pond = new THREE.MeshBasicMaterial({ color: 0x8fa79e, transparent: true, opacity: 0.9, toneMapped: false });
    this.pondEdge = new THREE.MeshBasicMaterial({ color: 0x596963, transparent: true, opacity: 0.85, toneMapped: false });
    this.path = new THREE.MeshBasicMaterial({ color: 0xe4d7ba, toneMapped: false });
  }

  key(mat, geo) {
    const a = Object.keys(geo.attributes).sort().join(',');
    return `${mat.uuid}|${a}|${geo.index ? 'i' : 'n'}`;
  }
  put(mat, geo) {
    if (!geo) return;
    const k = this.key(mat, geo);
    let rec = this.batches.get(k);
    if (!rec) {
      rec = { mat, geos: [] };
      this.batches.set(k, rec);
    }
    rec.geos.push(geo);
  }
  box(mat, w, h, d, x, y, z, ry = 0) {
    this.put(mat, tfGeo(new THREE.BoxGeometry(w, h, d), x, y, z, ry));
  }
  cyl(mat, rt, rb, h, seg, x, y, z, ry = 0) {
    this.put(mat, tfGeo(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, ry));
  }
  sphere(mat, r, x, y, z, sx = 1, sy = 1, sz = 1) {
    const g = new THREE.SphereGeometry(r, 10, 8);
    g.scale(sx, sy, sz);
    g.translate(x, y, z);
    this.put(mat, g);
  }
  /** 庑殿顶（返回顶高）。 */
  hip({ x, y, z, ry = 0, w, d, h, mat, eave, overhang = 1.4, lift = 0.32, curve = 1.6, segU = 6, segV = 3, ridge = true, ridgeMat }) {
    const { roof, fascia } = hipRoofGeometry({ width: w, depth: d, height: h, overhang, lift, curve, segU, segV });
    this.put(mat, tfGeo(roof, x, y, z, ry));
    this.put(eave || this.mats.eave, tfGeo(fascia, x, y, z, ry));
    if (ridge && w > d + 0.5) {
      this.box(ridgeMat || this.mats.inkDark, w - d + overhang * 1.2, Math.max(0.35, h * 0.1), Math.max(0.35, h * 0.1), x, y + h, z, ry);
    }
    return y + h;
  }
  gable({ x, y, z, ry = 0, w, d, h, mat, eave, overhang = 1.2, lift = 0.28, curve = 1.5, segU = 6, segV = 2 }) {
    const { roof, fascia } = gableRoofGeometry({ width: w, depth: d, height: h, overhang, lift, curve, segU, segV });
    this.put(mat, tfGeo(roof, x, y, z, ry));
    this.put(eave || this.mats.eave, tfGeo(fascia, x, y, z, ry));
    this.box(this.mats.inkDark, w + overhang * 2, Math.max(0.3, h * 0.09), Math.max(0.3, h * 0.09), x, y + h, z, ry);
    return y + h;
  }
  /** 圆形攒尖顶（亭子）。 */
  round({ x, y, z, radius, h, mat, segments = 16, overhang = 1.2 }) {
    const { roof } = roundRoofGeometry({ radius, height: h, overhang, fascia: 0.08, segments });
    this.put(mat, tfGeo(roof.geometry.clone(), x, y, z));
    this.sphere(this.mats.gold, Math.max(0.5, radius * 0.1), x, y + h + 0.4, z);
    this.cyl(this.mats.gold, 0.18, 0.36, 1.4, 8, x, y + h + 1.2, z);
  }
  /** 重檐：下檐 + 上层屋身 + 上檐。 */
  doubleEave({ x, y, z, ry = 0, w, d, h, mat, eave, bodyMat, overhang = 1.4 }) {
    const lowerH = h * 0.55;
    const lowerTop = this.hip({ x, y, z, ry, w, d, h: lowerH, mat, eave, overhang });
    const upperY = y + lowerH + h * 0.18;
    this.box(bodyMat || this.mats.wallRed, w * 0.82, h * 0.22, d * 0.82, x, upperY + h * 0.11, z, ry);
    this.hip({ x, y: upperY + h * 0.22, z, ry, w: w * 0.86, d: d * 0.86, h: h * 0.45, mat, eave, overhang: overhang * 0.85 });
    return upperY + h * 0.22 + h * 0.45;
  }
  tree(kind, x, z, hh, y = Y) {
    this.treeSpecs.push({ kind, x, z, y, h: hh });
  }
  person(kind, x, z, extra = {}) {
    this.people.push({ kind, x, z, y: Y, ...extra });
  }
  flush(group) {
    for (const { mat, geos } of this.batches.values()) {
      const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    if (this.treeSpecs.length) group.add(buildTrees(this.treeSpecs, this.ctx));
  }
}

/* -------------------------------------------------------------------------- */
/*  通用：院墙（带瓦顶压边）                                                     */
/* -------------------------------------------------------------------------- */

function wallRect(k, { x0, x1, z0, z1, h = 5, t = 1.6, mat, capMat, gates = [] }) {
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const ys = Y + h / 2;
  const cap = capMat || k.mats.inkDark;
  const seg = (ax, az, bx, bz) => {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 0.2) return;
    const ry = Math.atan2(-dz, dx);
    k.box(mat, len, h, t, (ax + bx) / 2, ys, (az + bz) / 2, ry);
    k.box(cap, len + 0.4, 0.4, t + 0.8, (ax + bx) / 2, Y + h + 0.2, (az + bz) / 2, ry);
  };
  // 南北墙（中间可留门）
  const gateOf = (side) => gates.filter((g) => g.side === side);
  for (const side of ['s', 'n']) {
    const z = side === 's' ? z1 : z0;
    const gs = gateOf(side).sort((a, b) => a.x - b.x);
    let cur = x0;
    for (const g of gs) {
      seg(cur, z, g.x - g.w / 2, z);
      cur = g.x + g.w / 2;
    }
    seg(cur, z, x1, z);
  }
  for (const side of ['e', 'w']) {
    const x = side === 'e' ? x1 : x0;
    const gs = gateOf(side).sort((a, b) => a.z - b.z);
    let cur = z0;
    for (const g of gs) {
      seg(x, cur, x, g.z - g.w / 2);
      cur = g.z + g.w / 2;
    }
    seg(x, cur, x, z1);
  }
  // 四角压角
  for (const [x, z] of [[x0, z0], [x0, z1], [x1, z0], [x1, z1]]) {
    k.box(mat, t * 2.2, h * 1.05, t * 2.2, x, Y + h * 0.525, z);
    k.box(cap, t * 2.5, 0.5, t * 2.5, x, Y + h + 0.25, z);
  }
}

/* -------------------------------------------------------------------------- */
/*  1. 开宝寺 · 铁塔（十三层八角铁色琉璃塔）                                    */
/* -------------------------------------------------------------------------- */

function buildTieTa(k) {
  const M = k.mats;
  const L = LM.tiemota;
  const X = L.x;
  const Z = L.z;
  const rng = makeRng(6001);

  // 注：铁塔所在的城外街区已被城市肌理填满，不再另砌院墙（会把民宅圈进院里）；
  // 用山门 + 大殿 + 配殿 + 松柏围出塔院的意象即可。
  // 山门
  k.box(M.stone, 20, 1.2, 9, X, Y + 0.6, Z + 53);
  k.box(M.wallRed, 17, 6.4, 6.5, X, Y + 1.2 + 3.2, Z + 53);
  k.hip({ x: X, y: Y + 7.6, z: Z + 53, w: 21, d: 10, h: 5.2, mat: M.roofTile, segU: 6, segV: 3 });
  k.box(M.door, 5.4, 5.0, 0.5, X, Y + 3.6, Z + 56.2);
  // 大殿（塔前）
  k.box(M.stone, 40, 2.0, 26, X, Y + 1.0, Z + 26);
  k.box(M.wallRed, 32, 8.2, 18, X, Y + 2.0 + 4.1, Z + 26);
  k.hip({ x: X, y: Y + 10.2, z: Z + 26, w: 38, d: 24, h: 8.2, mat: M.roofTile });
  // 东西配殿
  for (const s of [-1, 1]) {
    k.box(M.wallPlaster, 8, 5.2, 20, X + s * 36, Y + 2.6, Z + 22);
    k.gable({ x: X + s * 36, y: Y + 5.2, z: Z + 22, w: 20, d: 9, h: 3.4, mat: M.roofTile, ry: Math.PI / 2 });
  }

  // 铁塔：八角须弥座 + 十三层
  const tX = X;
  const tZ = Z - 10;
  k.cyl(M.stone, 13, 14.5, 2.4, 8, tX, Y + 1.2, tZ); // 台基
  k.cyl(M.marble, 11.5, 12.4, 1.8, 8, tX, Y + 3.3, tZ);
  let y = Y + 4.2;
  let r = 8.6;
  // 一层塔身较高，往上收分
  for (let i = 0; i < 13; i++) {
    const hh = i === 0 ? 5.4 : 3.5 - i * 0.07;
    const bodyR = r * 0.86;
    // 塔身（八角）
    k.cyl(k.iron, bodyR * 0.99, bodyR, hh, 8, tX, y + hh / 2, tZ, Math.PI / 8);
    // 每层四正面开小窗（深墨）
    for (let f = 0; f < 4; f++) {
      const a = (f / 4) * TAU;
      k.box(k.ironDark, 1.5, hh * 0.42, 0.5, tX + Math.cos(a) * bodyR * 0.96, y + hh * 0.52, tZ + Math.sin(a) * bodyR * 0.96, -a - Math.PI / 2);
    }
    // 檐：八角挑出的深色瓦檐（下宽上窄）+ 檐口压边
    k.cyl(k.ironDark, r * 0.98, r * 1.16, 0.6, 8, tX, y + hh + 0.3, tZ, Math.PI / 8);
    k.cyl(k.iron, r * 1.16, r * 1.12, 0.2, 8, tX, y + hh + 0.7, tZ, Math.PI / 8);
    // 平座栏杆（细）
    k.cyl(k.ironDark, r * 0.9, r * 0.94, 0.28, 8, tX, y + hh + 0.94, tZ, Math.PI / 8);
    y += hh + 1.02;
    r *= 0.925;
  }
  // 塔刹：覆钵 + 相轮 + 宝珠
  k.cyl(k.ironDark, 2.6, 3.2, 1.2, 8, tX, y + 0.2, tZ);
  k.sphere(k.ironDark, 2.3, tX, y + 1.4, tZ, 1, 1.25, 1);
  for (let i = 0; i < 7; i++) k.cyl(M.gold, 2.2 - i * 0.22, 2.2 - i * 0.22, 0.32, 8, tX, y + 2.8 + i * 0.5, tZ);
  k.sphere(M.gold, 0.9, tX, y + 6.6, tZ);
  k.cyl(M.gold, 0.12, 0.5, 3.2, 6, tX, y + 7.8, tZ);

  // 院中松柏 + 香客
  const spots = [
    [-40, 20], [-34, 36], [-22, 40], [24, 38], [34, 34], [42, 18],
    [-44, -4], [44, -6], [-40, -34], [40, -36], [-26, -44], [26, -44],
    [-12, 44], [12, 46], [-46, 30], [46, 30], [-46, -20], [46, -20],
  ];
  for (const [dx, dz] of spots) k.tree(rng() < 0.8 ? 'pine' : 'locust', X + dx, Z + dz, 8 + rng() * 5);
  for (let i = 0; i < 16; i++) {
    const a = rng() * TAU;
    const rr = 14 + rng() * 30;
    k.person(rng() < 0.7 ? 'monk' : 'walker', X + Math.cos(a) * rr, Z + 20 + Math.sin(a) * rr, { dir: [1, 0], span: 2 + rng() * 4 });
  }
}

/* -------------------------------------------------------------------------- */
/*  2. 繁塔 · 天清寺（三层大塔，平顶，砖雕感）                                   */
/* -------------------------------------------------------------------------- */

function buildFanTa(k) {
  const M = k.mats;
  const L = LM.fanpagoda;
  const X = L.x;
  const Z = L.z + 8; // 塔身略南移，避开蔡河水面
  const rng = makeRng(6002);

  // 注：城外街区已有连片民宅，天清寺只保留山门/大殿/塔，不砌一圈院墙。
  // 山门
  k.box(M.stone, 16, 1.0, 8, X, Y + 0.5, Z + 55);
  k.box(M.wallRed, 14, 5.2, 5.4, X, Y + 1.0 + 2.6, Z + 55);
  k.gable({ x: X, y: Y + 6.2, z: Z + 55, w: 17, d: 8, h: 3.6, mat: M.roofTile });
  k.box(M.door, 4.2, 4.0, 0.5, X, Y + 3.1, Z + 58);

  // 繁塔：方形三层，收分 + 层层出檐，平顶
  const tX = X;
  const tZ = Z - 4;
  k.box(M.stone, 26, 2.4, 26, tX, Y + 1.2, tZ);
  let y = Y + 2.4;
  const tiers = [
    { w: 20, h: 11 },
    { w: 16.4, h: 8.4 },
    { w: 13, h: 6.2 },
  ];
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const hw = t.w / 2;
    // 砖砌塔身
    k.box(k.brick, t.w, t.h, t.w, tX, y + t.h / 2, tZ);
    // 砖雕感：四面竖向壁柱 + 横向砖缝（不做雕花，只做节奏）
    for (let f = 0; f < 4; f++) {
      const a = (f / 4) * TAU;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      const span = t.w;
      for (let s = -2; s <= 2; s++) {
        const px = tX + nx * (hw + 0.35) + Math.cos(a + Math.PI / 2) * (span / 7) * s;
        const pz = tZ + nz * (hw + 0.35) + Math.sin(a + Math.PI / 2) * (span / 7) * s;
        k.box(k.brickDark, 1.1, t.h * 0.9, 0.6, px, y + t.h * 0.5, pz, -a);
      }
      for (let b = 1; b < 4; b++) {
        k.box(k.brickDark, t.w + 0.2, 0.28, 0.5, tX + nx * (hw + 0.3), y + (t.h * b) / 4, tZ + nz * (hw + 0.3), -a);
      }
      // 每面一扇小窗
      k.box(k.ironDark, 2.0, 3.0, 0.5, tX + nx * (hw + 0.15), y + t.h * 0.55, tZ + nz * (hw + 0.15), -a);
    }
    // 出檐（砖叠涩，压深色瓦檐）
    k.box(k.brickDark, t.w + 3.2, 0.7, t.w + 3.2, tX, y + t.h + 0.35, tZ);
    k.box(M.roofTileDark, t.w + 4.0, 0.6, t.w + 4.0, tX, y + t.h + 0.9, tZ);
    y += t.h + 1.3;
  }
  // 平顶：矮栏 + 小塔刹
  const topY = y;
  k.box(k.brickDark, 13.6, 1.6, 13.6, tX, topY + 0.8, tZ);
  k.box(k.brick, 11.6, 0.5, 11.6, tX, topY + 1.7, tZ);
  k.cyl(k.ironDark, 1.0, 1.6, 2.2, 8, tX, topY + 2.9, tZ);
  k.sphere(M.gold, 0.8, tX, topY + 4.0, tZ);

  // 大殿 / 罗汉殿
  k.box(M.stone, 34, 1.6, 20, X, Y + 0.8, Z + 40);
  k.box(M.wallRed, 27, 7.4, 14, X, Y + 1.6 + 3.7, Z + 40);
  k.hip({ x: X, y: Y + 9.0, z: Z + 40, w: 33, d: 20, h: 7.4, mat: M.roofTile });
  for (const s of [-1, 1]) {
    k.box(M.wallPlaster, 7, 4.6, 16, X + s * 32, Y + 2.3, Z + 36);
    k.gable({ x: X + s * 32, y: Y + 4.6, z: Z + 36, w: 16, d: 8, h: 3.0, mat: M.roofTile, ry: Math.PI / 2 });
  }
  // 院中柏树 + 香客
  for (const [dx, dz] of [[-36, 10], [-28, 26], [30, 24], [40, 12], [-42, 40], [42, 42], [-18, 50], [18, 50]]) {
    k.tree(rng() < 0.85 ? 'pine' : 'locust', X + dx, Z + dz, 7 + rng() * 5);
  }
  for (let i = 0; i < 12; i++) {
    const a = rng() * TAU;
    const rr = 10 + rng() * 26;
    k.person(rng() < 0.75 ? 'monk' : 'walker', X + Math.cos(a) * rr, Z + 22 + Math.sin(a) * rr, { dir: [1, 0], span: 2 + rng() * 4 });
  }
}

/* -------------------------------------------------------------------------- */
/*  3. 太庙（围墙 + 山门 + 三重殿 + 松柏）                                       */
/* -------------------------------------------------------------------------- */

function buildTaiMiao(k) {
  const M = k.mats;
  const L = LM.taimiao;
  const CX = 136; // 稍微西移，避开大内西墙
  const CZ = L.z;
  const rng = makeRng(6003);
  const x0 = CX - 27;
  const x1 = CX + 27;
  const z0 = CZ - 46;
  const z1 = CZ + 46;

  // 里城街坊很密，院墙会切进民宅；只保留山门与三重殿的轴线。
  // 山门（三开间）
  k.box(M.stone, 20, 1.2, 9, CX, Y + 0.6, z1 - 3);
  k.box(M.wallRed, 17, 6.6, 7, CX, Y + 1.2 + 3.3, z1 - 3);
  k.hip({ x: CX, y: Y + 7.8, z: z1 - 3, w: 21, d: 11, h: 5.4, mat: M.roofTile });
  for (const s of [-1, 1]) k.box(M.door, 3.2, 4.6, 0.5, CX + s * 5.2, Y + 3.5, z1 - 0.2);

  // 前殿（重檐）
  const frontZ = CZ + 20;
  k.box(M.stone, 32, 2.2, 20, CX, Y + 1.1, frontZ);
  k.box(M.wallRed, 26, 7.4, 14, CX, Y + 2.2 + 3.7, frontZ);
  k.doubleEave({ x: CX, y: Y + 9.6, z: frontZ, w: 31, d: 19, h: 10, mat: M.roofTile, bodyMat: M.wallRed });
  for (const s of [-1, 1]) k.box(M.door, 4.0, 5.2, 0.5, CX + s * 7, Y + 4.9, frontZ + 7.2);

  // 中殿
  const midZ = CZ - 6;
  k.box(M.stone, 28, 1.8, 17, CX, Y + 0.9, midZ);
  k.box(M.wallRed, 22, 6.4, 12, CX, Y + 1.8 + 3.2, midZ);
  k.hip({ x: CX, y: Y + 8.2, z: midZ, w: 27, d: 17, h: 6.6, mat: M.roofTile });

  // 后殿
  const backZ = CZ - 30;
  k.box(M.stone, 24, 1.6, 15, CX, Y + 0.8, backZ);
  k.box(M.wallRed, 18, 5.4, 10, CX, Y + 1.6 + 2.7, backZ);
  k.gable({ x: CX, y: Y + 7.0, z: backZ, w: 24, d: 14, h: 4.6, mat: M.roofTile });

  // 东西配殿 / 廊
  for (const s of [-1, 1]) {
    k.box(M.wallPlaster, 6, 4.2, 34, CX + s * 22, Y + 2.1, CZ - 2);
    k.gable({ x: CX + s * 22, y: Y + 4.2, z: CZ - 2, w: 34, d: 7, h: 2.8, mat: M.roofTile, ry: Math.PI / 2 });
  }
  // 松柏
  const spots = [
    [-22, 36], [22, 36], [-23, 14], [23, 14], [-22, -12], [22, -12],
    [-20, -32], [20, -32], [-8, 34], [8, 34], [-16, 42], [16, 42],
  ];
  for (const [dx, dz] of spots) k.tree(rng() < 0.9 ? 'pine' : 'locust', CX + dx, CZ + dz, 9 + rng() * 5);
  for (let i = 0; i < 12; i++) {
    const a = rng() * TAU;
    const rr = 6 + rng() * 18;
    k.person(rng() < 0.5 ? 'walker' : 'scholar', CX + Math.cos(a) * rr, CZ + 20 + Math.sin(a) * rr, { dir: [1, 0], span: 2 + rng() * 4 });
  }
}

/* -------------------------------------------------------------------------- */
/*  4. 景灵宫（宋式宫观：宫墙 + 门 + 大殿 + 后院）                               */
/* -------------------------------------------------------------------------- */

function buildJingLing(k) {
  const M = k.mats;
  const L = LM.jingling;
  const CX = 120;
  const CZ = -440;
  const rng = makeRng(6004);
  const x0 = CX - 42;
  const x1 = CX + 42;
  const z0 = CZ - 50;
  const z1 = CZ + 50;

  // 同上：不砌宫墙，保留宫门 + 前中后三殿 + 两庑的宫观格局。
  // 大宫门（三开间，重檐）
  k.box(M.stone, 26, 1.3, 11, CX, Y + 0.65, z1 - 4);
  k.box(M.wallRed, 23, 8.0, 8.5, CX, Y + 1.3 + 4.0, z1 - 4);
  k.doubleEave({ x: CX, y: Y + 9.3, z: z1 - 4, w: 27, d: 12, h: 9, mat: M.roofGold, bodyMat: M.wallRed });
  for (const s of [-1, 1]) k.box(M.door, 3.6, 5.4, 0.5, CX + s * 6.6, Y + 4.3, z1 - 0.2);

  // 前殿
  const fz = CZ + 26;
  k.box(M.stone, 40, 2.4, 24, CX, Y + 1.2, fz);
  k.box(M.wallRed, 34, 8.0, 17, CX, Y + 2.4 + 4.0, fz);
  k.doubleEave({ x: CX, y: Y + 10.4, z: fz, w: 39, d: 23, h: 11, mat: M.roofGold, bodyMat: M.wallRed });

  // 中殿
  const mz = CZ - 4;
  k.box(M.stone, 34, 2.0, 20, CX, Y + 1.0, mz);
  k.box(M.wallRed, 28, 7.0, 14, CX, Y + 2.0 + 3.5, mz);
  k.hip({ x: CX, y: Y + 9.0, z: mz, w: 33, d: 20, h: 7.6, mat: M.roofGold });

  // 后殿（后院）
  const bz = CZ - 34;
  k.box(M.stone, 26, 1.7, 16, CX, Y + 0.85, bz);
  k.box(M.wallRed, 20, 5.6, 11, CX, Y + 1.7 + 2.8, bz);
  k.hip({ x: CX, y: Y + 7.3, z: bz, w: 25, d: 15, h: 5.6, mat: M.roofTile });

  // 两庑（东西回廊）
  for (const s of [-1, 1]) {
    k.box(M.wallPlaster, 7, 4.8, 72, CX + s * 36, Y + 2.4, CZ - 2);
    k.gable({ x: CX + s * 36, y: Y + 4.8, z: CZ - 2, w: 72, d: 8.4, h: 3.0, mat: M.roofTile, ry: Math.PI / 2 });
    for (let i = 0; i < 9; i++) k.cyl(M.column, 0.28, 0.3, 4.8, 6, CX + s * 39.6, Y + 2.4, CZ - 36 + i * 8);
  }
  // 后院小亭
  k.box(M.stone, 12, 0.8, 12, CX, Y + 0.4, CZ - 46);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    k.cyl(M.column, 0.26, 0.28, 4.6, 6, CX + Math.cos(a) * 4.6, Y + 2.3, CZ - 46 + Math.sin(a) * 4.6);
  }
  k.round({ x: CX, y: Y + 4.6, z: CZ - 46, radius: 6.0, h: 4.0, mat: M.roofGold });

  // 松柏 + 守卫
  const spots = [
    [-30, 34], [30, 34], [-31, 10], [31, 10], [-31, -14], [31, -14], [-30, -40], [30, -40],
    [-12, 44], [12, 44], [-36, 26], [36, 26], [-36, -26], [36, -26],
  ];
  for (const [dx, dz] of spots) k.tree(rng() < 0.85 ? 'pine' : 'locust', CX + dx, CZ + dz, 9 + rng() * 5);
  for (let i = 0; i < 10; i++) {
    const a = rng() * TAU;
    const rr = 8 + rng() * 20;
    k.person(rng() < 0.4 ? 'scholar' : 'walker', CX + Math.cos(a) * rr, CZ + 24 + Math.sin(a) * rr, { dir: [1, 0], span: 2 + rng() * 4 });
  }
}

/* -------------------------------------------------------------------------- */
/*  5. 上清宫 / 五岳观（道观）                                                   */
/* -------------------------------------------------------------------------- */

function buildShangQing(k) {
  const M = k.mats;
  const CX = 98;
  const CZ = -346;
  const rng = makeRng(6005);
  const x0 = CX - 26;
  const x1 = CX + 26;
  const z0 = CZ - 30;
  const z1 = CZ + 30;

  // 同上：只留山门 + 正殿 + 配殿 + 香炉幡杆。
  // 山门
  k.box(M.stone, 16, 1.0, 8, CX, Y + 0.5, z1 - 3);
  k.box(M.wallRed, 13, 5.6, 5.6, CX, Y + 1.0 + 2.8, z1 - 3);
  k.gable({ x: CX, y: Y + 6.6, z: z1 - 3, w: 16, d: 8, h: 3.8, mat: M.roofGlaze });
  k.box(M.door, 3.8, 4.2, 0.5, CX, Y + 3.4, z1 - 0.2);

  // 正殿（绿琉璃）
  const dz = CZ + 6;
  k.box(M.stone, 28, 1.8, 18, CX, Y + 0.9, dz);
  k.box(M.wallRed, 22, 7.0, 12, CX, Y + 1.8 + 3.5, dz);
  k.hip({ x: CX, y: Y + 8.8, z: dz, w: 27, d: 17, h: 7.2, mat: M.roofGlaze });
  // 后殿
  k.box(M.wallRed, 14, 4.8, 8, CX, Y + 2.4, CZ - 18);
  k.gable({ x: CX, y: Y + 4.8, z: CZ - 18, w: 17, d: 9, h: 3.4, mat: M.roofTile });
  // 东西配殿
  for (const s of [-1, 1]) {
    k.box(M.wallPlaster, 6, 4.0, 20, CX + s * 18, Y + 2.0, CZ - 2);
    k.gable({ x: CX + s * 18, y: Y + 4.0, z: CZ - 2, w: 20, d: 7, h: 2.6, mat: M.roofTile, ry: Math.PI / 2 });
  }
  // 香炉 + 幡杆
  k.cyl(k.ironDark, 1.6, 2.2, 2.6, 8, CX, Y + 1.3, z1 - 12);
  k.cyl(M.inkDark, 1.9, 2.4, 0.5, 8, CX, Y + 2.8, z1 - 12);
  for (const s of [-1, 1]) {
    k.cyl(M.inkDark, 0.18, 0.24, 12, 6, CX + s * 10, Y + 6, z1 - 13);
    k.box(M.banner, 2.4, 5.6, 0.2, CX + s * 10 + 1.4, Y + 8.6, z1 - 13);
  }
  // 松柏 + 香客/道士
  for (const [dx, dz2, hh] of [[-20, 20, 10], [20, 20, 11], [-21, 2, 9], [21, 2, 10], [-20, -20, 9], [20, -20, 11], [0, 26, 12], [-12, -24, 8], [12, -24, 9]]) {
    k.tree(rng() < 0.8 ? 'pine' : 'locust', CX + dx, CZ + dz2, hh);
  }
  for (let i = 0; i < 12; i++) {
    const a = rng() * TAU;
    const rr = 5 + rng() * 16;
    k.person(rng() < 0.45 ? 'monk' : 'walker', CX + Math.cos(a) * rr, CZ + 12 + Math.sin(a) * rr, { dir: [1, 0], span: 2 + rng() * 3 });
  }
}

/* -------------------------------------------------------------------------- */
/*  6a. 金明池（水中殿 + 拱桥 + 廊桥 + 临水殿 + 苑墙 + 柳松）                      */
/* -------------------------------------------------------------------------- */

function pondPolygon(cx, cz, rx, rz, seed = 41, n = 28, wobble = 0.07) {
  const rng = makeRng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const w = 1 + (rng() - 0.5) * 2 * wobble;
    pts.push([cx + Math.cos(a) * rx * w, cz + Math.sin(a) * rz * w]);
  }
  return pts;
}

function shapeFromPoints(points, y) {
  const s = new THREE.Shape();
  points.forEach(([x, z], i) => {
    if (i === 0) s.moveTo(x, -z);
    else s.lineTo(x, -z);
  });
  s.closePath();
  return s;
}

function buildJinMingChi(k) {
  const M = k.mats;
  const L = LM.jinmingchi;
  const CX = L.x;
  const CZ = L.z;
  const rng = makeRng(6006);
  const waterY = Y + 0.05;

  // 水面（金明池：近方圆形，河模块目前没铺这里，这里补一块写意水面）
  const poly = pondPolygon(CX, CZ, 62, 50, 41, 28, 0.06);
  const waterGeo = new THREE.ShapeGeometry(shapeFromPoints(poly, waterY));
  waterGeo.rotateX(-Math.PI / 2);
  waterGeo.translate(0, waterY, 0);
  k.put(k.pond, waterGeo);
  // 水线：略大的暗色边
  const edgePoly = pondPolygon(CX, CZ, 64.5, 52.5, 42, 28, 0.06);
  const edgeGeo = new THREE.ShapeGeometry(shapeFromPoints(edgePoly, waterY - 0.02));
  edgeGeo.rotateX(-Math.PI / 2);
  edgeGeo.translate(0, waterY - 0.02, 0);
  k.put(k.pondEdge, edgeGeo);

  // 距水岸不远的低石岸（只在南北两岸做几段，避免一整圈呆板）
  for (const zz of [CZ + 50, CZ - 50]) {
    k.box(M.stone, 74, 0.9, 3.2, CX, Y + 0.45, zz, 0);
    k.box(M.stoneShade, 74, 0.22, 3.6, CX, Y + 0.9, zz, 0);
  }

  // 水心岛 + 水心殿
  const islR = 15;
  k.cyl(M.stoneShade, islR * 0.94, islR, 1.5, 18, CX, Y + 0.75, CZ);
  k.cyl(M.grass, islR * 0.92, islR * 0.92, 0.25, 18, CX, Y + 1.6, CZ);
  // 台基 + 殿身 + 重檐
  k.box(M.stone, 30, 1.6, 22, CX, Y + 2.4, CZ);
  k.box(M.wallRed, 24, 7.0, 15, CX, Y + 3.2 + 3.5, CZ);
  k.doubleEave({ x: CX, y: Y + 10.2, z: CZ, w: 29, d: 21, h: 9.5, mat: M.roofTile, bodyMat: M.wallRed });
  // 岛上松柳
  k.tree('pine', CX - 9, CZ + 6, 7.5);
  k.tree('pine', CX + 9, CZ - 5, 8.5);
  k.tree('willow', CX - 8, CZ - 8, 6.5);
  // 环岛栏杆
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    k.cyl(M.stone, 0.28, 0.3, 1.0, 5, CX + Math.cos(a) * islR * 0.92, Y + 1.9, CZ + Math.sin(a) * islR * 0.92);
  }

  // 南拱桥：南岸 → 水心岛
  const bridgeS = (zFrom, zTo, covered) => {
    const len = Math.abs(zTo - zFrom);
    const mid = (zFrom + zTo) / 2;
    const deckY = Y + 2.6;
    k.box(M.stone, 9, 0.7, len, CX, deckY, mid);
    k.box(M.stoneShade, 9, 0.25, len + 1.2, CX, deckY + 0.45, mid);
    // 拱洞（用深墨色挖出观感：两侧各一个半圆拱影）
    for (const s of [-1, 1]) {
      k.cyl(k.pondEdge, len * 0.18, len * 0.18, 0.3, 10, CX, deckY - 1.2, mid + s * len * 0.22);
    }
    // 栏杆
    for (const s of [-1, 1]) {
      k.box(M.marble, 0.5, 1.2, len, CX + s * 4.5, deckY + 1.2, mid);
      for (let i = 0; i <= 8; i++) {
        k.box(M.marble, 0.7, 1.6, 0.7, CX + s * 4.5, deckY + 1.6, mid - len / 2 + (len * i) / 8);
      }
    }
    // 桥墩（伸进水里）
    for (const s of [-1, 1]) k.box(M.stoneShade, 8.5, 2.2, 3, CX, Y + 1.1, mid + s * len * 0.3);
    if (covered) {
      for (let i = 0; i <= 4; i++) {
        const z = mid - len / 2 + (len * i) / 4;
        for (const s of [-1, 1]) k.cyl(M.column, 0.3, 0.34, 4.4, 6, CX + s * 4.1, deckY + 2.2, z);
      }
      k.gable({ x: CX, y: deckY + 4.4, z: mid, w: 11, d: len + 2, h: 3.2, mat: M.roofTile });
    }
  };
  bridgeS(CZ + 50, CZ + islR + 1, false);
  // 东廊桥：东岸 → 水心岛
  const bx0 = CX + islR + 1;
  const bx1 = CX + 64;
  k.box(M.stone, Math.abs(bx1 - bx0), 0.7, 8, (bx0 + bx1) / 2, Y + 2.2, CZ);
  k.box(M.stoneShade, Math.abs(bx1 - bx0), 0.22, 9, (bx0 + bx1) / 2, Y + 2.55, CZ);
  for (let i = 0; i <= 8; i++) {
    const x = bx0 + ((bx1 - bx0) * i) / 8;
    for (const s of [-1, 1]) k.cyl(M.column, 0.3, 0.34, 4.6, 6, x, Y + 4.6, CZ + s * 3.6);
  }
  k.gable({ x: (bx0 + bx1) / 2, y: Y + 6.9, z: CZ, w: Math.abs(bx1 - bx0) + 2, d: 9.5, h: 3.4, mat: M.roofTile });

  // 临水殿（南岸，面向池水）
  const lz = CZ + 62;
  k.box(M.stone, 48, 2.2, 20, CX, Y + 1.1, lz);
  k.box(M.wallRed, 40, 8.0, 15, CX, Y + 2.2 + 4.0, lz);
  k.doubleEave({ x: CX, y: Y + 10.2, z: lz, w: 46, d: 20, h: 10, mat: M.roofTile, bodyMat: M.wallRed });
  // 临水台阶
  for (let i = 0; i < 3; i++) k.box(M.stone, 30, 0.5, 1.6, CX, Y + 0.25 + i * 0.5, lz + 11 + i * 1.2);

  // 岸边亭台两座
  for (const [px, pz] of [[CX - 52, CZ + 42], [CX + 48, CZ - 38]]) {
    k.box(M.stone, 11, 0.9, 11, px, Y + 0.45, pz);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      k.cyl(M.column, 0.28, 0.3, 4.4, 6, px + Math.cos(a) * 4.2, Y + 2.2, pz + Math.sin(a) * 4.2);
    }
    k.round({ x: px, y: Y + 4.4, z: pz, radius: 5.4, h: 3.8, mat: M.roofTile });
  }

  // 苑墙（南、东、北、西，南面开大门）
  wallRect(k, {
    x0: CX - 76, x1: CX + 76, z0: CZ - 78, z1: CZ + 86,
    h: 4.6, t: 1.8, mat: M.wallPlaster, capMat: M.roofTileDark,
    gates: [{ side: 's', x: CX, w: 18 }],
  });
  // 苑门楼
  k.box(M.stone, 22, 1.2, 9, CX, Y + 0.6, CZ + 86);
  k.box(M.wallRed, 19, 5.6, 6.6, CX, Y + 1.2 + 2.8, CZ + 86);
  k.hip({ x: CX, y: Y + 6.8, z: CZ + 86, w: 23, d: 10, h: 4.6, mat: M.roofTile });

  // 柳树 + 松树 + 游人
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU + 0.15;
    const x = CX + Math.cos(a) * (66 + rng() * 6);
    const z = CZ + Math.sin(a) * (56 + rng() * 6);
    if (Math.abs(x - CX) > 73 || Math.abs(z - CZ) > 83) continue;
    k.tree(i % 3 === 0 ? 'locust' : 'willow', x, z, 7.5 + rng() * 3.5);
  }
  for (const [dx, dz, hh] of [[-74, 52, 9], [72, 50, 10], [-70, -50, 10], [70, -46, 9], [-40, 60, 8], [36, 60, 9]]) {
    k.tree('pine', CX + dx, CZ + dz, hh);
  }
  for (let i = 0; i < 26; i++) {
    const a = rng() * TAU;
    const rr = 18 + rng() * 60;
    const x = CX + Math.cos(a) * rr;
    const z = CZ + Math.sin(a) * rr * 0.82;
    k.person(rng() < 0.5 ? 'lady' : rng() < 0.6 ? 'scholar' : 'walker', x, z, { dir: [1, 0], span: 2 + rng() * 5 });
  }
}

/* -------------------------------------------------------------------------- */
/*  6b. 琼林苑（苑墙 + 亭台 + 花木，疏朗留白）                                    */
/* -------------------------------------------------------------------------- */

function buildQiongLin(k) {
  const M = k.mats;
  const L = LM.qionglin;
  const CX = L.x;
  const CZ = L.z;
  const rng = makeRng(6007);
  const x0 = CX - 55;
  const x1 = CX + 55;
  const z0 = CZ - 46;
  const z1 = CZ + 46;

  wallRect(k, {
    x0, x1, z0, z1,
    h: 4.0, t: 1.5, mat: M.wallPlaster, capMat: M.roofTileDark,
    gates: [{ side: 's', x: CX, w: 14 }],
  });
  // 苑门
  k.box(M.stone, 18, 1.0, 8, CX, Y + 0.5, z1 - 2);
  k.box(M.wallRed, 15, 4.6, 5.6, CX, Y + 1.0 + 2.3, z1 - 2);
  k.gable({ x: CX, y: Y + 5.6, z: z1 - 2, w: 18, d: 8, h: 3.0, mat: M.roofTile });
  k.box(M.door, 4.2, 3.8, 0.5, CX, Y + 3.0, z1 + 0.6);

  // 苑中小殿
  const hz = CZ - 16;
  k.box(M.stone, 22, 1.2, 14, CX, Y + 0.6, hz);
  k.box(M.wallRed, 17, 5.4, 10, CX, Y + 1.2 + 2.7, hz);
  k.hip({ x: CX, y: Y + 6.6, z: hz, w: 21, d: 13, h: 4.8, mat: M.roofTile });

  // 两座亭（东西各一）
  for (const [px, pz] of [[CX - 32, CZ + 14], [CX + 30, CZ - 26]]) {
    k.box(M.stone, 10, 0.8, 10, px, Y + 0.4, pz);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      k.cyl(M.column, 0.26, 0.28, 3.8, 6, px + Math.cos(a) * 3.8, Y + 1.9, pz + Math.sin(a) * 3.8);
    }
    k.round({ x: px, y: Y + 3.8, z: pz, radius: 4.8, h: 3.2, mat: M.roofTile });
  }

  // 石径（两条交叉小路）
  k.box(k.path, 6, 0.08, 60, CX - 4, Y + 0.04, CZ + 12);
  k.box(k.path, 56, 0.08, 5, CX + 4, Y + 0.04, CZ + 6);

  // 花木：疏朗，留白
  const spots = [
    [-42, 30], [-30, 34], [-16, 30], [8, 32], [24, 30], [40, 26],
    [-44, 6], [42, 4], [-40, -22], [40, -20], [-24, -30], [24, -32],
    [-8, -30], [10, -26], [-46, -8], [44, -6], [-14, 8], [16, -6],
  ];
  for (const [dx, dz] of spots) {
    const kind = rng() < 0.3 ? 'blossom' : rng() < 0.55 ? 'willow' : 'locust';
    k.tree(kind, CX + dx, CZ + dz, 6 + rng() * 4);
  }
  // 几块景石
  for (const [dx, dz] of [[-18, 18], [22, 12], [-6, -14]]) {
    k.box(M.stoneShade, 3.2, 2.6, 2.4, CX + dx, Y + 1.3, CZ + dz, rng() * TAU);
  }
  for (let i = 0; i < 10; i++) {
    const a = rng() * TAU;
    const rr = 8 + rng() * 34;
    k.person(rng() < 0.5 ? 'lady' : 'scholar', CX + Math.cos(a) * rr, CZ + 10 + Math.sin(a) * rr, { dir: [1, 0], span: 2 + rng() * 4 });
  }
}

/* -------------------------------------------------------------------------- */
/*  入口                                                                        */
/* -------------------------------------------------------------------------- */

export function buildLandmarks2(ctx) {
  const group = new THREE.Group();
  group.name = 'landmarks2';
  const k = new Kit(ctx);

  buildTieTa(k);
  buildFanTa(k);
  buildTaiMiao(k);
  buildJingLing(k);
  buildShangQing(k);
  buildJinMingChi(k);
  buildQiongLin(k);

  k.flush(group);
  group.userData.people = k.people.length;
  group.userData.trees = k.treeSpecs.length;
  return group;
}
