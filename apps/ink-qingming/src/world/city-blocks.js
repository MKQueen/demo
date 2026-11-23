/**
 * city-blocks.js —— 东京城的街巷铺装、坊巷街区、马行街夜市与灯火。
 *
 * 契约：export function buildCityBlocks(ctx) → THREE.Group（name = 'city-blocks'）
 *
 * 分工：城墙/宫城/相国寺/樊楼/州桥等由 city-inner、outer-city、landmarks2 负责；
 * 这里只铺「城里的街与坊」：
 *   1. STREETS 七条主街的土色街面（车辙 + 墨边 + 排水沟），避开水面；
 *   2. 里城与外城的坊巷：成排的宋代四合院/店铺（InstancedMesh 合批），
 *      里城灰瓦，外城多茅草顶，少量二层；
 *   3. 马行街 / 瓦舍勾栏：夜市棚子、灯笼、招牌、布幌与人群；
 *   4. 灯笼与幌子：主街沿街挂灯，白天也读得出市井气；
 *   5. 人：街巷、瓦舍、桥头 push 到 ctx.people（400+）。
 *
 * 性能：街区全部走 InstancedMesh（一种材质一个 draw），街面合成一个顶点色 Mesh；
 * 全模块 < 100k tris / < 30 draws。
 */
import * as THREE from 'three';
import { makeRng } from '../lib/rand.js';
import {
  GROUND_Y, OUTER_CITY, INNER_CITY, STREETS, CITY_LANDMARKS,
  RIVER, CANALS, PALACE, XIANGOU, FANLOU, YUJIE, MARKET, CITY, riverZ,
} from '../layout.js';

const Y = GROUND_Y + 0.02;
const HALF_PI = Math.PI / 2;
const rng = makeRng(20260720);

/* ========================================================================== */
/*  0. 空间查询                                                                */
/* ========================================================================== */

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 1e-6 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function polyDist(x, z, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    d = Math.min(d, segDist(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  }
  return d;
}

/** 水面：汴河 + 蔡河/五丈河/金水河。 */
function nearWater(x, z, pad = 6) {
  if (x > -240 && x < 545 && Math.abs(z - riverZ(x)) < RIVER.halfWidth + pad) return true;
  for (const c of Object.values(CANALS)) {
    if (polyDist(x, z, c.path) < c.width / 2 + pad) return true;
  }
  return false;
}

/** 与街心的距离（已扣掉街宽）。 */
function streetClearance(x, z) {
  let m = Infinity;
  for (const st of STREETS) {
    const d = polyDist(x, z, st.pts) - st.width / 2;
    if (d < m) m = d;
  }
  return m;
}

/* ---- 保留区：宫城、大寺、名楼、园林、城门、城墙、长卷段 ---- */
const KEEP_RECTS = [
  // 大内（含宫墙外一圈）
  { x0: PALACE.x0 - 14, x1: PALACE.x1 + 14, z0: PALACE.z0 - 14, z1: PALACE.z1 + 12 },
  // 相国寺
  { x0: XIANGOU.cx - XIANGOU.w / 2 - 8, x1: XIANGOU.cx + XIANGOU.w / 2 + 8, z0: XIANGOU.cz - XIANGOU.d / 2 - 8, z1: XIANGOU.cz + XIANGOU.d / 2 + 8 },
  // 樊楼（含酒楼前广场）
  { x0: FANLOU.x - 26, x1: FANLOU.x + 26, z0: FANLOU.z - 24, z1: FANLOU.z + 22 },
  // 长卷段落：河市 / 虹桥 / 城门街市 / 近岸郊野，留给长卷模块
  { x0: -252, x1: 246, z0: -72, z1: 92 },
  // 御街（含御廊铺席）
  { x0: YUJIE.x - YUJIE.halfWidth - 10, x1: YUJIE.x + YUJIE.halfWidth + 10, z0: YUJIE.southZ - 12, z1: YUJIE.northZ - 8 },
  // 里城 / 外城城墙带
  { x0: INNER_CITY.x0 - 9, x1: INNER_CITY.x0 + 9, z0: INNER_CITY.z0 - 9, z1: INNER_CITY.z1 + 9 },
  { x0: INNER_CITY.x1 - 9, x1: INNER_CITY.x1 + 9, z0: INNER_CITY.z0 - 9, z1: INNER_CITY.z1 + 9 },
  { x0: INNER_CITY.x0 - 9, x1: INNER_CITY.x1 + 9, z0: INNER_CITY.z0 - 9, z1: INNER_CITY.z0 + 9 },
  { x0: INNER_CITY.x0 - 9, x1: INNER_CITY.x1 + 9, z0: INNER_CITY.z1 - 9, z1: INNER_CITY.z1 + 9 },
  { x0: OUTER_CITY.x0 - 12, x1: OUTER_CITY.x0 + 12, z0: OUTER_CITY.z0 - 12, z1: OUTER_CITY.z1 + 12 },
  { x0: OUTER_CITY.x1 - 12, x1: OUTER_CITY.x1 + 12, z0: OUTER_CITY.z0 - 12, z1: OUTER_CITY.z1 + 12 },
  { x0: OUTER_CITY.x0 - 12, x1: OUTER_CITY.x1 + 12, z0: OUTER_CITY.z0 - 12, z1: OUTER_CITY.z0 + 12 },
  { x0: OUTER_CITY.x0 - 12, x1: OUTER_CITY.x1 + 12, z0: OUTER_CITY.z1 - 12, z1: OUTER_CITY.z1 + 12 },
];

const KEEP_CIRCLES = [
  // 太庙、景灵宫、金明池、琼林苑、开宝寺塔、繁塔、东水门、州桥、瓦舍自建区
  { x: 160, z: -250, r: 40 },
  { x: 110, z: -430, r: 46 },
  { x: -190, z: -270, r: 86 },
  { x: -60, z: -180, r: 58 },
  { x: 540, z: -430, r: 30 },
  { x: 600, z: 190, r: 30 },
  { x: 800, z: 10, r: 36 },
  { x: YUJIE.x, z: 8, r: 34 },
  { x: 380, z: -60, r: 34 }, // 瓦舍（本模块自建）
];

function inKeep(x, z) {
  for (const r of KEEP_RECTS) {
    if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return true;
  }
  for (const c of KEEP_CIRCLES) {
    const dx = x - c.x;
    const dz = z - c.z;
    if (dx * dx + dz * dz < c.r * c.r) return true;
  }
  for (const g of [...OUTER_CITY.gates, ...INNER_CITY.gates]) {
    if (Math.hypot(x - g.x, z - g.z) < 20) return true;
  }
  // 长卷城门 + 街市（town.js 已建）
  if (z > CITY.wallZ - 9 && z < CITY.wallZ + 9 && x > CITY.wallX0 - 8 && x < CITY.wallX1 + 8) return true;
  if (z > MARKET.streetZ - 16 && z < MARKET.streetZ + 16 && x > MARKET.x0 - 6 && x < MARKET.x1 + 6) return true;
  return false;
}

/** 可建地块：在城圈内、不在水面/保留区/街上。 */
function siteOk(x, z, pad = 6) {
  if (x < OUTER_CITY.x0 + 16 || x > OUTER_CITY.x1 - 16) return false;
  if (z < OUTER_CITY.z0 + 16 || z > OUTER_CITY.z1 - 16) return false;
  if (nearWater(x, z, pad)) return false;
  if (inKeep(x, z)) return false;
  if (streetClearance(x, z) < 3.2) return false;
  return true;
}

/* ========================================================================== */
/*  1. 几何工具                                                                */
/* ========================================================================== */

/** 山墙屋顶：两坡 + 两端三角（8 tri），带出檐。 */
function gableRoofGeo(w, d, rh, ov = 0.9) {
  const hw = w / 2 + ov;
  const hd = d / 2 + ov;
  const y0 = 0;
  const y1 = rh;
  const pos = [];
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  // 前后两坡（各 2 tri）
  const feL = [-hw, y0, hd];
  const feR = [hw, y0, hd];
  const beR = [hw, y0, -hd];
  const beL = [-hw, y0, -hd];
  const rL = [-hw, y1, 0];
  const rR = [hw, y1, 0];
  tri(feL, feR, rR);
  tri(feL, rR, rL);
  tri(beR, beL, rL);
  tri(beR, rL, rR);
  // 两端山墙
  tri(feL, rL, beL);
  tri(beR, rR, feR);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** 平房：墙身 9×4×7 + 灰瓦硬山。 */
function makeHouseGeo() {
  const walls = new THREE.BoxGeometry(9, 4, 7);
  walls.translate(0, 2, 0);
  const roof = gableRoofGeo(9, 7, 2.1);
  roof.translate(0, 4, 0);
  return { walls, roof };
}

/** 沿街二层店楼：进深 7、开间 8，前檐搭布棚。 */
function makeShopGeo() {
  const walls = new THREE.BoxGeometry(8, 6.4, 7);
  walls.translate(0, 3.2, 0);
  const roof = gableRoofGeo(8, 7, 2.0, 0.85);
  roof.translate(0, 6.4, 0);
  // 前檐布棚（向街面 +z 出挑）
  const aw = new THREE.PlaneGeometry(8.4, 2.2);
  aw.rotateX(-Math.PI / 2 + 0.22);
  aw.translate(0, 4.4, 4.6);
  return { walls, roof, awning: aw };
}

/** 夜市棚子：四根木柱 + 布顶。 */
function makeStallGeo() {
  const top = new THREE.ConeGeometry(2.6, 1.1, 4, 1, true);
  top.rotateY(Math.PI / 4);
  top.translate(0, 2.7, 0);
  const poles = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const p = new THREE.BoxGeometry(0.16, 2.6, 0.16);
      p.translate(sx * 1.9, 1.3, sz * 1.9);
      poles.push(p);
    }
  }
  return { top, poles: mergeSimple(poles) };
}

/** 灯笼：八角小灯笼 + 挑杆。 */
function makeLanternGeo() {
  const body = new THREE.IcosahedronGeometry(0.52, 0);
  body.scale(1, 1.28, 1);
  body.translate(0, 2.62, 0);
  const pole = new THREE.BoxGeometry(0.14, 3.3, 0.14);
  pole.translate(0.7, 1.65, 0);
  const arm = new THREE.BoxGeometry(1.6, 0.12, 0.12);
  arm.translate(0.1, 3.28, 0);
  const g = mergeSimple([body, pole, arm]);
  return g;
}

function mergeSimple(geos) {
  let pos = [];
  let idx = [];
  let base = 0;
  for (const g of geos) {
    const ng = g.index ? g.toNonIndexed() : g;
    const p = ng.getAttribute('position');
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    if (g.index) base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.computeVertexNormals();
  return out;
}

/* ========================================================================== */
/*  2. 街面（顶点色合成一个 Mesh）                                              */
/* ========================================================================== */

function sampleLine(pts, step = 6) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0];
    const az = pts[i][1];
    const bx = pts[i + 1][0];
    const bz = pts[i + 1][1];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      // 切线 → 法线
      const dx = (bx - ax) / (len || 1);
      const dz = (bz - az) / (len || 1);
      out.push({ x, z, nx: -dz, nz: dx, dx, dz });
    }
  }
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const len = Math.hypot(last[0] - prev[0], last[1] - prev[1]) || 1;
  out.push({ x: last[0], z: last[1], nx: -(last[1] - prev[1]) / len, nz: (last[0] - prev[0]) / len, dx: (last[0] - prev[0]) / len, dz: (last[1] - prev[1]) / len });
  return out;
}

function buildStreetMesh() {
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  const quad = (ax, az, bx, bz, cx, cz, dx, dz, y, color) => {
    c.setHex(color);
    const push = (px, pz) => {
      pos.push(px, y, pz);
      col.push(c.r, c.g, c.b);
    };
    push(ax, az); push(bx, bz); push(cx, cz);
    push(ax, az); push(cx, cz); push(dx, dz);
  };
  const bands = (width) => [
    { off: 0, w: width, c: 0xe8dabb, y: 0 },
    { off: 0, w: width * 0.86, c: 0xeee2c6, y: 0.006 },
    { off: -width * 0.19, w: 0.9, c: 0xc7b795, y: 0.012 },
    { off: width * 0.19, w: 0.9, c: 0xc7b795, y: 0.012 },
    { off: -(width / 2 + 0.55), w: 1.1, c: 0xb7b8a2, y: 0.004 },
    { off: width / 2 + 0.55, w: 1.1, c: 0xb7b8a2, y: 0.004 },
    { off: -(width / 2 + 0.12), w: 0.32, c: 0x8d8878, y: 0.016 },
    { off: width / 2 + 0.12, w: 0.32, c: 0x8d8878, y: 0.016 },
  ];
  for (const st of STREETS) {
    const samples = sampleLine(st.pts, 6);
    for (const band of bands(st.width)) {
      for (let i = 0; i < samples.length - 1; i++) {
        const a = samples[i];
        const b = samples[i + 1];
        const mx = (a.x + b.x) / 2;
        const mz = (a.z + b.z) / 2;
        if (nearWater(mx, mz, 0.5)) continue;
        const ao0 = band.off - band.w / 2;
        const ao1 = band.off + band.w / 2;
        quad(
          a.x + a.nx * ao0, a.z + a.nz * ao0,
          a.x + a.nx * ao1, a.z + a.nz * ao1,
          b.x + b.nx * ao1, b.z + b.nz * ao1,
          b.x + b.nx * ao0, b.z + b.nz * ao0,
          Y + band.y, band.c,
        );
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }));
  mesh.name = 'city-blocks-streets';
  mesh.frustumCulled = false;
  return mesh;
}

/* ========================================================================== */
/*  3. 坊巷：四合院 / 店铺 / 二层楼                                             */
/* ========================================================================== */

function addHouse(list, x, z, ry, sx = 1) {
  list.push({ x, y: Y, z, ry, s: sx });
}

function buildFangxiang() {
  const houses = [];
  const shops = [];
  const low = false;
  const target = 3050;
  // 分片：里城先铺，再铺外城四片（东、西、南、北）
  const districts = [
    { x0: INNER_CITY.x0 + 18, x1: INNER_CITY.x1 - 18, z0: INNER_CITY.z0 + 18, z1: INNER_CITY.z1 - 18, p: 0.92, tiles: true, rows: 24 },
    { x0: OUTER_CITY.x0 + 26, x1: INNER_CITY.x0 - 16, z0: OUTER_CITY.z0 + 26, z1: OUTER_CITY.z1 - 26, p: 0.72, tiles: false, rows: 26 },
    { x0: INNER_CITY.x1 + 16, x1: OUTER_CITY.x1 - 26, z0: OUTER_CITY.z0 + 26, z1: OUTER_CITY.z1 - 26, p: 0.72, tiles: false, rows: 26 },
    { x0: INNER_CITY.x0 - 16, x1: INNER_CITY.x1 + 16, z0: OUTER_CITY.z1 + 18, z1: OUTER_CITY.z1 - 26, p: 0.78, tiles: false, rows: 10 },
    { x0: INNER_CITY.x0 - 16, x1: INNER_CITY.x1 + 16, z0: OUTER_CITY.z0 + 26, z1: INNER_CITY.z0 - 18, p: 0.78, tiles: false, rows: 10 },
  ];
  const candidates = [];
  for (const d of districts) {
    const px = 10.6;
    const pz = 12.4;
    for (let z = d.z0 + 8; z < d.z1 - 8; z += pz) {
      for (let x = d.x0 + 8; x < d.x1 - 8; x += px) {
        if (rng() > d.p) continue;
        const jx = x + (rng() - 0.5) * 1.6;
        const jz = z + (rng() - 0.5) * 1.6;
        if (!siteOk(jx, jz, 5)) continue;
        // 靠街的一排做成二层店楼
        const clear = streetClearance(jx, jz);
        const nearStreet = clear < 9;
        candidates.push({ x: jx, z: jz, tiles: d.tiles, nearStreet });
      }
    }
  }
  // 打散后取前 target 个（城内各处均匀）
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = t;
  }
  const take = Math.min(target, candidates.length);
  for (let i = 0; i < take; i++) {
    const c = candidates[i];
    const ry = rng() < 0.5 ? 0 : Math.PI;
    if (c.nearStreet && rng() < 0.35) {
      shops.push({ x: c.x, y: Y, z: c.z, ry: ry + (rng() < 0.5 ? 0 : Math.PI), s: 1 });
    } else {
      addHouse(houses, c.x, c.z, ry + (rng() < 0.12 ? HALF_PI : 0), 0.92 + rng() * 0.16);
    }
  }
  return { houses, shops, tiles: candidates };
}

/** 沿主街的店楼排：贴街两侧，正对街面。 */
function buildStreetShops() {
  const shops = [];
  for (const st of STREETS) {
    if (st.id === 'yujie') continue; // 御街两侧御廊由 city-inner 负责
    const samples = sampleLine(st.pts, 13);
    for (let i = 1; i < samples.length - 1; i += 1) {
      const sm = samples[i];
      for (const side of [-1, 1]) {
        if (rng() < 0.3) continue;
        const off = st.width / 2 + 6.2;
        const x = sm.x + sm.nx * off * side;
        const z = sm.z + sm.nz * off * side;
        if (!siteOk(x, z, 4)) continue;
        // 面向街心
        const fx = -sm.nx * side;
        const fz = -sm.nz * side;
        const ry = Math.atan2(fx, fz);
        shops.push({ x, y: Y, z, ry, s: 1 });
      }
    }
  }
  return shops;
}

/* ========================================================================== */
/*  4. 马行街 / 瓦舍勾栏夜市                                                    */
/* ========================================================================== */

/** 夜市摊位允许贴着街边，所以只避水面与宫城。 */
function marketOk(x, z) {
  if (x < OUTER_CITY.x0 + 20 || x > OUTER_CITY.x1 - 20) return false;
  if (z < OUTER_CITY.z0 + 20 || z > OUTER_CITY.z1 - 20) return false;
  if (nearWater(x, z, 2)) return false;
  if (x > PALACE.x0 - 16 && x < PALACE.x1 + 16 && z > PALACE.z0 - 16 && z < PALACE.z1 + 14) return false;
  return true;
}

function buildNightMarket() {
  const stalls = [];
  const lanterns = [];
  const signs = [];
  const banners = [];
  const people = [];
  const cx = 380;
  const cz0 = -46;
  const cz1 = -150;
  // 棚子两排，沿马行街两侧
  for (let z = cz0; z > cz1; z -= 7.4) {
    for (const side of [-1, 1]) {
      if (rng() < 0.18) continue;
      const x = cx + side * (11 + rng() * 3);
      if (!marketOk(x, z)) continue;
      stalls.push({ x, y: Y, z, ry: rng() * 0.5 - 0.25, s: 0.9 + rng() * 0.25 });
      // 灯笼挂在棚角
      lanterns.push({ x: x + side * 1.6, y: Y, z: z + 1.7, ry: 0, s: 1.0 });
      if (rng() < 0.5) signs.push({ x: x - side * 0.4, y: Y + 3.4, z: z + 2.6, ry: side > 0 ? -HALF_PI : HALF_PI, s: 0.9 + rng() * 0.4 });
      if (rng() < 0.4) banners.push({ x: x + side * 2.2, y: Y + 2.6, z: z - 0.6, ry: 0, s: 0.8 + rng() * 0.3 });
    }
  }
  // 瓦舍勾栏（x=380,z=-60）：一圈棚子 + 彩门 + 密集灯笼
  const washe = { x: cx, z: -60 };
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const r = 15 + rng() * 4;
    const x = washe.x + Math.cos(a) * r;
    const z = washe.z + Math.sin(a) * r;
    if (!marketOk(x, z)) continue;
    stalls.push({ x, y: Y, z, ry: -a, s: 0.85 + rng() * 0.2 });
    lanterns.push({ x, y: Y, z: z + 1.2, ry: 0, s: 1.15 });
  }
  // 街口彩门（两根高杆 + 横布）
  lanterns.push({ x: cx - 6, y: Y + 0.9, z: -58, ry: 0, s: 1.5 });
  lanterns.push({ x: cx + 6, y: Y + 0.9, z: -58, ry: 0, s: 2.2 });
  // 人群：勾栏前 + 街上
  const kinds = ['walker', 'walker', 'vendor', 'scholar', 'lady', 'child', 'porter', 'monk', 'rider', 'donkey', 'palanquin'];
  for (let i = 0; i < 84; i++) {
    const z = washe.z + (rng() - 0.5) * 80;
    const x = cx + (rng() - 0.5) * 26;
    people.push({
      kind: kinds[Math.floor(rng() * kinds.length)],
      x,
      z,
      dir: rng() < 0.5 ? [1, 0] : [0, 1],
      speed: 0.4 + rng() * 0.5,
      span: 6 + rng() * 14,
    });
  }
  return { stalls, lanterns, signs, banners, people };
}

/* ========================================================================== */
/*  5. 街灯与幌子                                                              */
/* ========================================================================== */

function buildStreetLights() {
  const lanterns = [];
  const signs = [];
  const banners = [];
  for (const st of STREETS) {
    const samples = sampleLine(st.pts, 17);
    let flip = 0;
    for (const sm of samples) {
      flip += 1;
      const side = flip % 2 === 0 ? 1 : -1;
      const off = st.width / 2 + 1.4;
      const x = sm.x + sm.nx * off * side;
      const z = sm.z + sm.nz * off * side;
      if (nearWater(x, z, 2)) continue;
      if (inKeep(x, z) && st.id !== 'yujie') {
        // 保留区里不挂
        if (!(st.id === 'maxing')) continue;
      }
      lanterns.push({ x, y: Y, z, ry: Math.atan2(sm.dx, sm.dz), s: 0.85 + rng() * 0.25 });
      if (rng() < 0.34) {
        signs.push({ x, y: Y + 3.2, z: z - 0.3, ry: Math.atan2(sm.dx, sm.dz) + HALF_PI, s: 0.8 + rng() * 0.5 });
      }
      if (rng() < 0.16) banners.push({ x, y: Y + 3.0, z: z + 0.5, ry: Math.atan2(sm.dx, sm.dz), s: 0.9 + rng() * 0.4 });
    }
  }
  return { lanterns, signs, banners };
}

/* ========================================================================== */
/*  6. 人                                                                      */
/* ========================================================================== */

function buildPeople() {
  const out = [];
  const kinds = ['walker', 'walker', 'walker', 'porter', 'porter', 'vendor', 'vendor', 'scholar', 'lady', 'monk', 'child', 'rider', 'donkey', 'palanquin'];
  const push = (kind, x, z, dir, span = 20, speed = 0.6) => {
    out.push({ kind, x, z, dir, speed, span });
  };
  for (const st of STREETS) {
    const samples = sampleLine(st.pts, 19);
    for (const sm of samples) {
      const n = st.id === 'maxing' ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const lat = (rng() - 0.5) * st.width * 0.7;
        const x = sm.x + sm.nx * lat;
        const z = sm.z + sm.nz * lat;
        if (nearWater(x, z, 1)) continue;
        const kind = kinds[Math.floor(rng() * kinds.length)];
        push(kind, x, z, [sm.dx, sm.dz], 14 + rng() * 26, 0.5 + rng() * 0.6);
      }
    }
  }
  // 坊巷里走的人
  for (let i = 0; i < 150; i++) {
    const x = OUTER_CITY.x0 + 30 + rng() * (OUTER_CITY.x1 - OUTER_CITY.x0 - 60);
    const z = OUTER_CITY.z0 + 30 + rng() * (OUTER_CITY.z1 - OUTER_CITY.z0 - 60);
    if (!siteOk(x, z, 3)) continue;
    push(kinds[Math.floor(rng() * kinds.length)], x, z, rng() < 0.5 ? [0, 1] : [1, 0], 10 + rng() * 26, 0.4 + rng() * 0.5);
  }
  // 桥头（州桥 / 虹桥）
  for (const b of [[250, 8, 40], [-6, 4, 26]]) {
    for (let i = 0; i < 18; i++) {
      const x = b[0] + (rng() - 0.5) * b[2];
      const z = b[1] + (rng() - 0.5) * b[2] * 0.7;
      if (nearWater(x, z, 0)) continue;
      push(kinds[Math.floor(rng() * kinds.length)], x, z, rng() < 0.5 ? [1, 0] : [0, 1], 6 + rng() * 14, 0.4 + rng() * 0.5);
    }
  }
  return out;
}

/* ========================================================================== */
/*  7. 实例化装配                                                              */
/* ========================================================================== */

function instanced(geo, mat, list, name, extraY = 0) {
  if (!list.length) return null;
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    q.setFromAxisAngle(up, it.ry || 0);
    v.set(it.x, (it.y ?? Y) + extraY, it.z);
    s.set(it.s || 1, it.s || 1, it.s || 1);
    m.compose(v, q, s);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.name = name;
  mesh.frustumCulled = false;
  return mesh;
}

/* ========================================================================== */
/*  8. 入口                                                                    */
/* ========================================================================== */

export function buildCityBlocks(ctx) {
  const group = new THREE.Group();
  group.name = 'city-blocks';
  const mats = ctx.mats;
  const low = ctx.quality === 'low';

  /* ---- 街面 ---- */
  group.add(buildStreetMesh());

  /* ---- 坊巷 ---- */
  const fang = buildFangxiang();
  const streetShops = buildStreetShops();
  const allShops = fang.shops.concat(streetShops);
  const houseGeo = makeHouseGeo();
  const shopGeo = makeShopGeo();

  const tileRoofs = [];
  const thatchRoofs = [];
  for (const h of fang.houses) {
    // 里城灰瓦、外城多茅草（按位置判断）
    const inner = h.x > INNER_CITY.x0 - 20 && h.x < INNER_CITY.x1 + 20 && h.z > INNER_CITY.z0 - 20 && h.z < INNER_CITY.z1 + 20;
    if (inner || rng() < 0.35) tileRoofs.push(h);
    else thatchRoofs.push(h);
  }

  const houseWall = instanced(houseGeo.walls, mats.wallPlaster, fang.houses, 'house-walls');
  if (houseWall) group.add(houseWall);
  const roofTileMesh = instanced(houseGeo.roof, mats.roofTile, tileRoofs, 'house-roof-tile');
  if (roofTileMesh) group.add(roofTileMesh);
  const roofThatchMesh = instanced(houseGeo.roof, mats.thatch, thatchRoofs, 'house-roof-thatch');
  if (roofThatchMesh) group.add(roofThatchMesh);

  const shopWallMesh = instanced(shopGeo.walls, mats.paperShade, allShops, 'shop-walls');
  if (shopWallMesh) group.add(shopWallMesh);
  const shopRoofMesh = instanced(shopGeo.roof, mats.roofTileDark, allShops, 'shop-roofs');
  if (shopRoofMesh) group.add(shopRoofMesh);
  const shopAwningMesh = instanced(shopGeo.awning, mats.cloth, allShops, 'shop-awnings');
  if (shopAwningMesh) group.add(shopAwningMesh);

  /* ---- 夜市 / 瓦舍 ---- */
  const market = buildNightMarket();
  const stallGeo = makeStallGeo();
  const stallTop = instanced(stallGeo.top, mats.cloth, market.stalls, 'stall-tops');
  if (stallTop) group.add(stallTop);
  const stallPoles = instanced(stallGeo.poles, mats.wood, market.stalls, 'stall-poles');
  if (stallPoles) group.add(stallPoles);

  /* ---- 灯笼 / 招牌 / 布幌 ---- */
  const lights = buildStreetLights();
  const lanterns = market.lanterns.concat(lights.lanterns);
  const signs = market.signs.concat(lights.signs);
  const banners = market.banners.concat(lights.banners);

  const maxLanterns = low ? 200 : 420;
  const lanternList = lanterns.slice(0, maxLanterns);
  const lanternMesh = instanced(makeLanternGeo(), mats.lantern, lanternList, 'lanterns');
  if (lanternMesh) group.add(lanternMesh);

  const signGeo = new THREE.PlaneGeometry(2.2, 1.1);
  const signMat = new THREE.MeshBasicMaterial({ color: 0xe9dcc0, side: THREE.DoubleSide, toneMapped: false });
  const signMesh = instanced(signGeo, signMat, signs.slice(0, low ? 100 : 240), 'signs');
  if (signMesh) group.add(signMesh);

  const bannerGeo = new THREE.PlaneGeometry(1.2, 3.2);
  const bannerMat = new THREE.MeshBasicMaterial({ color: 0xb64f34, side: THREE.DoubleSide, toneMapped: false });
  const bannerMesh = instanced(bannerGeo, bannerMat, banners.slice(0, low ? 60 : 150), 'banners');
  if (bannerMesh) group.add(bannerMesh);

  /* ---- 人 ---- */
  if (Array.isArray(ctx.people)) {
    const streetPeople = buildPeople();
    const all = market.people.concat(streetPeople);
    for (const p of all) ctx.people.push(p);
    group.userData.peopleCount = all.length;
  }

  /* ---- 统计 ---- */
  let tris = 0;
  let draws = 0;
  group.traverse((o) => {
    if (!o.isMesh) return;
    draws += 1;
    const g = o.geometry;
    const t = g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
    tris += t * (o.isInstancedMesh ? o.count : 1);
  });
  group.userData.houseCount = fang.houses.length;
  group.userData.shopCount = allShops.length;
  group.userData.lanternCount = lanternList.length;
  group.userData.tris = Math.round(tris);
  group.userData.draws = draws;

  return group;
}
