/**
 * city-inner.js —— 东京城的里城：御街 · 州桥两岸 · 相国寺 · 樊楼 · 大内。
 *
 * 长卷从州桥跨过汴河，沿御街一路往北，直抵大内宣德门：
 *   州桥南北是河市，桥东北是三层酒楼樊楼（彩楼欢门、灯笼、车马）；
 *   御街宽三十四米，中央御道两侧是朱漆杈子与御沟，再往外是御廊铺席；
 *   街西是大相国寺（山门、重檐大殿、三层资圣阁、八角塔，院里松柏香客）；
 *   街北头是朱红宫墙围起来的大内，宣德门五门洞、门楼黄瓦，
 *   门内大庆殿重檐庑殿，两庑回廊，松柏森森。
 *
 * 坐标：1 世界单位 = 1 米，坐标一律取自 layout.js。
 * 契约：export function buildCityInner(ctx) → THREE.Group(name='city-inner')
 * 人物只 push ctx.people；树走 flora 共享批次；不做州桥桥体（归 bridge 模块）。
 *
 * 性能：所有建筑按材质合并成 ~20 个 Mesh，屋顶用低分段几何；
 * 树走 flora 共享实例批次，人物交给 people.js 的一个 InstancedMesh。
 */
import * as THREE from 'three';
import { mergeGeometries } from '../lib/merge-safe.js';
import { makeRng } from '../lib/rand.js';
import { hipRoofGeometry, gableRoofGeometry, roundRoofGeometry } from '../lib/roof.js';
import { buildTrees } from '../lib/flora.js';
import { setInkWeight } from '../lib/materials.js';
import { GROUND_Y, YUJIE, FANLOU, XIANGOU, PALACE } from '../layout.js';

const Y = GROUND_Y;
const TAU = Math.PI * 2;
const X = YUJIE.x;

/* -------------------------------------------------------------------------- */
/*  小工具                                                                      */
/* -------------------------------------------------------------------------- */

function tf(geo, x, y, z, ry = 0) {
  if (ry) geo.rotateY(ry);
  geo.translate(x, y, z);
  return geo;
}

function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

function cyl(rTop, rBot, h, seg = 8) {
  return new THREE.CylinderGeometry(rTop, rBot, h, seg);
}

/** 两点之间的一根梁（沿 X 拉伸再旋转）。 */
function beamGeo(ax, az, bx, bz, w, h, y) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const g = new THREE.BoxGeometry(len, h, w);
  g.rotateY(Math.atan2(-dz, dx));
  g.translate((ax + bx) / 2, y, (az + bz) / 2);
  return g;
}

/* -------------------------------------------------------------------------- */
/*  建场                                                                        */
/* -------------------------------------------------------------------------- */

export function buildCityInner(ctx) {
  const group = new THREE.Group();
  group.name = 'city-inner';
  const low = ctx.quality === 'low';
  const rng = makeRng(20260712);
  const mats = ctx.mats;

  /* ---- 材质 ---- */
  const pavingMat = setInkWeight(new THREE.MeshBasicMaterial({ color: 0xdbd0b6, toneMapped: false }), 0.12);
  const roadMat = new THREE.MeshBasicMaterial({ color: 0xeaddc2, toneMapped: false });
  const sideMat = new THREE.MeshBasicMaterial({ color: 0xd2c7ad, toneMapped: false });
  const gutterMat = new THREE.MeshBasicMaterial({ color: 0x9aab9e, toneMapped: false });
  const waterMat = new THREE.MeshBasicMaterial({ color: 0xa2b3a5, toneMapped: false });
  // 黄瓦压暗：mats.roofGold 在强光下会泛白，这里用自调过的金；店铺灰瓦也提亮一档，免得太死
  const goldRoof = setInkWeight(mats.roofGold.clone(), 0.5);
  goldRoof.color.setHex(0x7c5a24);
  const shopTile = setInkWeight(mats.roofTile.clone(), 0.4);
  shopTile.color.setHex(0x767e78);
  const glazeRoof = setInkWeight(mats.roofGlaze.clone(), 0.5);

  /* ---- 批次：一个材质一个合并 Mesh ---- */
  const B = new Map();
  const push = (mat, geo) => {
    if (!geo) return;
    let list = B.get(mat);
    if (!list) B.set(mat, (list = []));
    list.push(geo);
  };
  const BX = (mat, w, h, d, x, y, z, ry = 0) => push(mat, tf(box(w, h, d), x, y, z, ry));
  const BC = (mat, rt, rb, h, seg, x, y, z) => push(mat, tf(cyl(rt, rb, h, seg), x, y, z));

  /* ---- 树 / 人 ---- */
  const treeSpecs = [];
  const tree = (kind, x, z, h) => treeSpecs.push({ kind, x, z, y: Y, h });
  let peopleCount = 0;
  const person = (spec) => {
    if (Array.isArray(ctx.people)) {
      ctx.people.push(spec);
      peopleCount += 1;
    }
  };
  const KINDS_STREET = ['walker', 'walker', 'porter', 'porter', 'scholar', 'lady', 'monk', 'child', 'vendor', 'rider', 'donkey', 'palanquin'];
  const KINDS_CROWD = ['walker', 'walker', 'porter', 'scholar', 'lady', 'child', 'vendor', 'monk'];
  const pickKind = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];

  /* ---- 屋顶 ---- */
  function addHip({ x, y, z, ry = 0, w, d, h, mat = mats.roofTile, overhang = 1.1, lift = 0.3, curve = 1.6, segU = 6, segV = 3, ridge = true }) {
    const { roof, fascia } = hipRoofGeometry({ width: w, depth: d, height: h, overhang, lift, curve, segU, segV });
    push(mat, tf(roof, x, y, z, ry));
    push(mats.eave, tf(fascia, x, y, z, ry));
    if (ridge && w > d + 0.5) {
      BX(mats.inkDark, w - d + overhang * 1.4, h * 0.1, h * 0.1, x, y + h, z, ry);
    }
    return y + h;
  }
  function addGable({ x, y, z, ry = 0, w, d, h, mat = mats.roofTile, overhang = 0.9, lift = 0.26, curve = 1.5, segU = 5, segV = 2, ridge = true }) {
    const { roof, fascia } = gableRoofGeometry({ width: w, depth: d, height: h, overhang, lift, curve, segU, segV });
    push(mat, tf(roof, x, y, z, ry));
    push(mats.eave, tf(fascia, x, y, z, ry));
    if (ridge) BX(mats.inkDark, w + overhang * 2, h * 0.1, h * 0.1, x, y + h, z, ry);
    return y + h;
  }

  /* ======================================================================== */
  /*  一、御街铺装（御道 / 御沟 / 朱漆杈子 / 广场）                              */
  /* ======================================================================== */

  const street = (x0, x1, z0, z1, y, mat) => {
    push(mat, tf(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), (x0 + x1) / 2, y, (z0 + z1) / 2));
  };

  // 御街路面（河两岸各一段，中间留给州桥）
  street(X - 17, X + 17, -296, -20, Y + 0.05, pavingMat);
  street(X - 17, X + 17, 30, 54, Y + 0.05, pavingMat);
  // 中央御道（略高的纸色条带）
  street(X - 5, X + 5, -296, -20, Y + 0.075, roadMat);
  street(X - 5, X + 5, 30, 54, Y + 0.075, roadMat);
  // 两侧御沟（窄水带）
  for (const sx of [-1, 1]) {
    street(X + sx * 6.6 - 0.8, X + sx * 6.6 + 0.8, -294, -22, Y + 0.085, gutterMat);
    street(X + sx * 6.6 - 0.8, X + sx * 6.6 + 0.8, 32, 54, Y + 0.085, gutterMat);
  }
  // 相国寺前街（东向）、樊楼前街（东向）、宣德门广场（北端）
  street(XIANGOU.gateX - 16, X - 17, -139, -125, Y + 0.06, sideMat);
  street(X + 17, 340, -78, -54, Y + 0.06, sideMat);
  street(X - 32, X + 32, -302, -294, Y + 0.06, pavingMat);
  // 樊楼前小广场
  street(277, 336, -54, -34, Y + 0.055, sideMat);
  // 相国寺内甬道
  street(XIANGOU.cx - 4, XIANGOU.gateX, XIANGOU.cz - 4, XIANGOU.cz + 4, Y + 0.06, sideMat);

  // 御街铺装的横缝（细墨线，一条条压出石板的感觉）
  for (let z = -292; z <= -24; z += 11) {
    BX(mats.inkSoft, 31, 0.02, 0.09, X, Y + 0.09, z);
  }
  // 侧道比御道略深一点
  street(X - 17, X - 10.8, -296, -20, Y + 0.062, pavingMat);
  street(X + 10.8, X + 17, -296, -20, Y + 0.062, pavingMat);

  // 朱漆杈子：御道两侧的红栏杆
  function railRun(x, z0, z1) {
    const step = 3.6;
    for (let z = z0; z <= z1; z += step) {
      BX(mats.wallRed, 0.09, 1.15, 0.09, x, Y + 0.58, z);
    }
    const len = z1 - z0;
    BX(mats.wallRed, 0.07, 0.08, len, x, Y + 1.02, (z0 + z1) / 2);
    BX(mats.wallRed, 0.06, 0.06, len, x, Y + 0.6, (z0 + z1) / 2);
  }
  railRun(X - 5.4, -292, -24);
  railRun(X + 5.4, -292, -24);
  railRun(X - 5.4, 32, 52);
  railRun(X + 5.4, 32, 52);

  // 街心灯笼杆（御道两侧，隔一段一根）
  const lanternSpots = [];
  for (let z = -26; z >= -288; z -= 13.5) {
    lanternSpots.push([X - 4.9, z]);
    lanternSpots.push([X + 4.9, z]);
  }
  for (const [lx, lz] of lanternSpots) {
    BX(mats.wood, 0.14, 4.6, 0.14, lx, Y + 2.3, lz);
    BX(mats.woodDark, 1.1, 0.1, 0.1, lx + (lx < X ? 0.5 : -0.5), Y + 4.5, lz);
    BC(mats.lantern, 0.24, 0.24, 0.5, 8, lx + (lx < X ? 1.0 : -1.0), Y + 4.15, lz);
  }

  /* ======================================================================== */
  /*  二、御廊 + 铺席（御街两侧连廊，朝街开铺）                                  */
  /* ======================================================================== */

  const shopSigns = [];
  function colonnadeRow(side, z0, z1, gateGaps = []) {
    // side: -1 = 西侧（x < X），+1 = 东侧；御廊贴着街边（17m）向外 13m
    const xRoof = X + side * 23.0; // 廊顶中心
    const xBody = X + side * 24.6; // 铺面屋身中心
    const xCol = X + side * 16.5; // 檐柱（贴街边）
    const zA = Math.min(z0, z1);
    const zB = Math.max(z0, z1);
    const segLen = 13;
    const inGap = (zc) => gateGaps.some(([a, b]) => zc > a && zc < b);
    for (let z = zA; z < zB - 2; z += segLen) {
      const w = Math.min(segLen, zB - z);
      const zc = z + w / 2;
      if (inGap(zc) || inGap(z)) continue;
      // 铺面：后墙 + 深色铺板 + 布幌子
      BX(mats.wallPlaster, 7.0, 4.2, w - 0.5, xBody, Y + 2.1, zc);
      BX(mats.woodDark, 0.16, 2.6, w - 1.5, X + side * 20.6, Y + 1.3, zc);
      push(rng() < 0.5 ? mats.clothOchre : mats.clothBlue, tf(box(0.07, 1.5, 0.9), X + side * 19.6, Y + 3.0, z + w * (0.3 + rng() * 0.4)));
      // 屋顶：脊沿 z（gable 转 90°），一段一段错开，别连成一条黑坡
      addGable({
        x: xRoof, y: Y + 4.05, z: zc, ry: Math.PI / 2,
        w: w - 1.6, d: 10.4, h: 2.0, segU: 3, segV: 2, overhang: 0.55,
        mat: shopTile,
      });
      // 檐下红柱（朝街）
      for (let k = 0; k < 4; k++) {
        BC(mats.wallRed, 0.15, 0.17, 4.3, 6, xCol, Y + 2.15, z + 1.4 + (k * (w - 2.8)) / 3);
      }
      // 铺席布棚：从廊下挑出来的一长条彩色遮阳布
      if (rng() < 0.55) {
        const awn = rng() < 0.5 ? mats.clothOchre : mats.clothBlue;
        push(awn, tf(box(2.8, 0.09, w - 2.4), X + side * 19.2, Y + 3.35, zc));
        BX(mats.wood, 0.08, 2.9, 0.08, X + side * 18.0, Y + 1.45, z + 1.2);
        BX(mats.wood, 0.08, 2.9, 0.08, X + side * 18.0, Y + 1.45, z + w - 1.2);
      }
      if (rng() < 0.4) shopSigns.push([X + side * 19.9, zc]);
    }
  }
  colonnadeRow(-1, -288, -30, [[-146, -118]]);
  colonnadeRow(1, -288, -30, [[-80, -50]]);
  colonnadeRow(-1, 32, 52, []);
  colonnadeRow(1, 32, 52, []);
  // 铺面招牌（细木牌挂出来）
  for (const [sx, sz] of shopSigns) {
    BX(mats.woodDark, 0.08, 1.2, 0.7, sx, Y + 3.9, sz);
    BX(mats.paperSign, 0.03, 0.8, 0.5, sx + (sx < X ? 0.06 : -0.06), Y + 3.9, sz);
  }

  /* ======================================================================== */
  /*  三、大内宫城：宫墙 + 角楼 + 宣德门 + 大庆殿 + 廊庑                          */
  /* ======================================================================== */

  const P = PALACE;
  const wallH = P.wallH;
  const wallT = 4;
  const gold = goldRoof;

  // 宫墙：南墙在宣德门两侧各留 13 米门洞
  const gateHalf = P.gateW / 2;
  function palaceWallRun(ax, az, bx, bz) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    const ry = Math.atan2(-dz, dx);
    BX(mats.wallRed, len, wallH, wallT, (ax + bx) / 2, Y + wallH / 2, (az + bz) / 2, ry);
    // 墙顶小瓦檐
    BX(mats.inkDark, len, 0.5, wallT + 1.2, (ax + bx) / 2, Y + wallH + 0.2, (az + bz) / 2, ry);
  }
  palaceWallRun(P.x0, P.z1, X - gateHalf, P.z1);
  palaceWallRun(X + gateHalf, P.z1, P.x1, P.z1);
  palaceWallRun(P.x0, P.z1, P.x0, P.z0);
  palaceWallRun(P.x1, P.z1, P.x1, P.z0);
  palaceWallRun(P.x0, P.z0, P.x1, P.z0);

  // 角楼
  function cornerTower(x, z) {
    BX(mats.wallRed, 15, wallH + 3, 15, x, Y + (wallH + 3) / 2, z);
    addHip({ x, y: Y + wallH + 3, z, w: 20, d: 20, h: 5.5, mat: gold, segU: 5, segV: 3, overhang: 1.3 });
    addHip({ x, y: Y + wallH + 7.5, z, w: 14, d: 14, h: 4.6, mat: gold, segU: 5, segV: 3, overhang: 1.1 });
    BX(mats.gold, 1.2, 1.6, 1.2, x, Y + wallH + 13.2, z);
  }
  for (const [cx, cz] of [
    [P.x0, P.z1],
    [P.x1, P.z1],
    [P.x0, P.z0],
    [P.x1, P.z0],
  ]) cornerTower(cx, cz);

  // —— 宣德门：城台 + 五门洞 + 重檐门楼 + 朵楼 + 石狮 ——
  {
    const gz = P.z1; // -302
    const baseW = 52;
    const baseD = 18;
    const baseH = wallH + 1.5; // 14.5
    BX(mats.wallRed, baseW, baseH, baseD, X, Y + baseH / 2, gz);
    BX(mats.inkDark, baseW + 1.4, 0.7, baseD + 1.4, X, Y + baseH + 0.1, gz);
    // 五门洞（中间三门高、两侧低）
    const doors = [
      [-15, 5.4, 8.4],
      [-7.6, 6.0, 9.2],
      [0, 6.8, 10.2],
      [7.6, 6.0, 9.2],
      [15, 5.4, 8.4],
    ];
    for (const [dx, dw, dh] of doors) {
      BX(mats.inkDeep, dw, dh, 0.7, X + dx, Y + dh / 2, gz + baseD / 2 + 0.01);
      BX(mats.inkDeep, dw, dh, 0.7, X + dx, Y + dh / 2, gz - baseD / 2 - 0.01);
    }
    // 门楼屋身（九间）
    BX(mats.wallRed, 38, 6.2, 12, X, Y + baseH + 3.1, gz);
    for (let i = 0; i < 11; i++) {
      BC(mats.wallRedDeep, 0.32, 0.34, 6.0, 6, X - 17 + i * 3.4, Y + baseH + 3.0, gz + 6.1);
    }
    // 重檐庑殿黄瓦
    addHip({ x: X, y: Y + baseH + 6.2, z: gz, w: 46, d: 17, h: 5.6, mat: gold, segU: 8, segV: 4, overhang: 1.9, lift: 0.34 });
    addHip({ x: X, y: Y + baseH + 11.2, z: gz, w: 36, d: 13, h: 5.4, mat: gold, segU: 7, segV: 4, overhang: 1.5, lift: 0.34 });
    BX(mats.inkDark, 20, 0.8, 0.9, X, Y + baseH + 16.9, gz);
    BX(mats.gold, 1.6, 2.4, 1.6, X, Y + baseH + 18.4, gz);
    // 两侧朵楼
    for (const sx of [-1, 1]) {
      const dx = sx * 30;
      BX(mats.wallRed, 10, 5.5, 10, X + dx, Y + baseH - 1, gz - 1);
      addHip({ x: X + dx, y: Y + baseH + 4.5, z: gz - 1, w: 14, d: 14, h: 4.6, mat: gold, segU: 5, segV: 3, overhang: 1.2 });
    }
    // 门前石狮
    for (const sx of [-1, 1]) {
      const px = X + sx * 16.5;
      const pz = gz + baseD / 2 + 4.2;
      BX(mats.marble, 2.0, 1.0, 2.0, px, Y + 0.5, pz);
      BX(mats.stoneDark, 1.0, 1.3, 1.7, px, Y + 1.6, pz);
      BX(mats.stoneDark, 0.8, 0.9, 0.8, px, Y + 2.5, pz - 0.3);
    }
    // 门前广场御道收口
    street(X - 13, X + 13, gz + baseD / 2, gz + baseD / 2 + 6, Y + 0.07, roadMat);
  }

  // —— 大庆殿：台基 + 殿身 + 重檐庑殿 ——
  {
    const cx = X;
    const cz = -404;
    // 三层台基
    BX(mats.marble, 76, 1.2, 48, cx, Y + 0.6, cz);
    BX(mats.marble, 68, 1.2, 42, cx, Y + 1.8, cz);
    BX(mats.marble, 60, 1.2, 36, cx, Y + 3.0, cz);
    const yb = Y + 3.6;
    // 殿身
    BX(mats.wallRed, P.hallW, 9.5, P.hallD, cx, yb + 4.75, cz);
    BX(mats.inkDark, P.hallW + 1.2, 0.7, P.hallD + 1.2, cx, yb + 9.6, cz);
    // 前廊柱列
    for (let i = 0; i < 11; i++) {
      BC(mats.wallRedDeep, 0.45, 0.5, 8.6, 8, cx - 22 + i * 4.4, yb + 4.3, cz + P.hallD / 2 + 1.2);
    }
    // 门窗（深色横带）
    BX(mats.door, 34, 5.0, 0.4, cx, yb + 3.0, cz + P.hallD / 2 + 0.05);
    // 重檐庑殿（黄瓦）
    addHip({ x: cx, y: yb + 10, z: cz, w: 62, d: 38, h: 7.2, mat: goldRoof, segU: 9, segV: 4, overhang: 2.4, lift: 0.34 });
    addHip({ x: cx, y: yb + 16, z: cz, w: 50, d: 30, h: 7.6, mat: goldRoof, segU: 8, segV: 4, overhang: 2.0, lift: 0.34 });
    BX(mats.inkDark, 24, 1.0, 1.1, cx, yb + 22.6, cz);
    BX(mats.gold, 1.8, 2.8, 1.8, cx, yb + 24.3, cz);
  }

  // —— 宫城内廊庑（东西两庑 + 北庑） ——
  function palaceColonnade(cx, cz, w, d) {
    // 台基 + 灰瓦坡顶 + 一列红柱；w 沿 x、d 沿 z
    BX(mats.stone, w, 0.7, d, cx, Y + 0.35, cz);
    BX(mats.wallPlaster, w, 4.0, d, cx, Y + 2.0, cz);
    BX(mats.inkDark, w + 1.0, 0.4, d + 1.0, cx, Y + 4.1, cz);
    const alongX = w > d;
    const len = alongX ? w : d;
    const n = Math.max(2, Math.round(len / 4.6));
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      if (alongX) {
        BC(mats.wallRed, 0.26, 0.28, 3.8, 6, cx - w / 2 + 1 + (w - 2) * t, Y + 2.1, cz + d / 2 - 0.6);
      } else {
        BC(mats.wallRed, 0.26, 0.28, 3.8, 6, cx + (cx > X ? -w / 2 + 0.6 : w / 2 - 0.6), Y + 2.1, cz - d / 2 + 1 + (d - 2) * t);
      }
    }
    addGable({
      x: cx, y: Y + 4.2, z: cz,
      w: alongX ? w + 1.2 : d + 1.2,
      d: alongX ? d + 1.2 : w + 1.2,
      h: 2.0, segU: 4, segV: 2, overhang: 0.7, ry: alongX ? 0 : Math.PI / 2,
    });
  }
  // 东西廊庑（沿 z 向长条），北庑（沿 x 向）
  palaceColonnade(P.x0 + 14, -400, 9, 104);
  palaceColonnade(P.x1 - 14, -400, 9, 104);
  palaceColonnade(X, -438, 104, 9);

  // 宫城御道
  street(X - 6, X + 6, P.z1 - 20, -330, Y + 0.07, roadMat);
  street(X - 6, X + 6, -420, -404, Y + 0.07, roadMat);

  // 宫墙里的松柏
  for (let i = 0; i < (low ? 8 : 16); i++) {
    tree(rng() < 0.75 ? 'pine' : 'locust', P.x0 + 12 + rng() * 20, -320 - rng() * 130, 5.5 + rng() * 3.5);
    tree(rng() < 0.75 ? 'pine' : 'locust', P.x1 - 12 - rng() * 20, -320 - rng() * 130, 5.5 + rng() * 3.5);
  }
  // 宣德门前宫墙外的行道槐
  for (let i = 0; i < 6; i++) {
    tree('locust', X - 40 + i * 16, P.z1 + 8 + (i % 2) * 4, 6.5 + rng() * 2.5);
  }

  /* ======================================================================== */
  /*  四、大相国寺：山门 + 围墙 + 重檐大殿 + 资圣阁 + 塔 + 松柏                  */
  /* ======================================================================== */

  const T = XIANGOU;
  const tWallH = 6.5;
  const tWallT = 1.4;
  // 围墙（东墙在 gateX 留山门洞）
  function templeWallRun(ax, az, bx, bz) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    const ry = Math.atan2(-dz, dx);
    BX(mats.wallRedDeep, len, tWallH, tWallT, (ax + bx) / 2, Y + tWallH / 2, (az + bz) / 2, ry);
    BX(mats.inkDark, len, 0.4, tWallT + 0.9, (ax + bx) / 2, Y + tWallH + 0.15, (az + bz) / 2, ry);
  }
  const tw = T.w / 2;
  const td = T.d / 2;
  const tx0 = T.cx - tw;
  const tx1 = T.cx + tw;
  const tz0 = T.cz - td;
  const tz1 = T.cz + td;
  const tGateHalf = 8;
  templeWallRun(tx0, tz1, tx1, tz1);
  templeWallRun(tx0, tz0, tx1, tz0);
  templeWallRun(tx0, tz0, tx0, tz1);
  templeWallRun(tx1, tz1, tx1, T.cz + tGateHalf);
  templeWallRun(tx1, T.cz - tGateHalf, tx1, tz0);

  // 山门（朝东，单檐歇山）
  {
    const gx = T.gateX - 5;
    BX(mats.stone, 14, 1.0, 20, gx, Y + 0.5, T.cz);
    BX(mats.wallRed, 10, 6.4, 17, gx, Y + 4.2, T.cz);
    BX(mats.inkDeep, 6.5, 5.4, 0.4, gx, Y + 2.7, T.cz + 8.7);
    BX(mats.inkDeep, 6.5, 5.4, 0.4, gx, Y + 2.7, T.cz - 8.7);
    addGable({ x: gx, y: Y + 7.4, z: T.cz, ry: Math.PI / 2, w: 22, d: 14, h: 4.4, wMats: null, segU: 5, segV: 3, overhang: 1.4 });
    for (const sz of [-1, 1]) {
      BC(mats.wallRedDeep, 0.3, 0.32, 6.2, 6, gx + 4.9, Y + 4.2, T.cz + sz * 7.2);
    }
  }

  // 大殿（重檐庑殿，灰瓦）
  {
    const cx = T.cx - 22;
    const cz = T.cz - 8;
    BX(mats.marble, 46, 1.4, 32, cx, Y + 0.7, cz);
    BX(mats.marble, 40, 1.2, 27, cx, Y + 2.0, cz);
    const yb = Y + 2.6;
    BX(mats.wallRed, 34, 8.0, 22, cx, yb + 4.0, cz);
    BX(mats.inkDark, 35, 0.6, 23, cx, yb + 8.3, cz);
    for (let i = 0; i < 9; i++) {
      BC(mats.wallRedDeep, 0.4, 0.44, 7.6, 8, cx - 15 + i * 3.75, yb + 3.8, cz + 11.8);
    }
    BX(mats.door, 22, 4.4, 0.35, cx, yb + 2.8, cz + 11.1);
    addHip({ x: cx, y: yb + 9, z: cz, w: 42, d: 29, h: 5.8, mat: shopTile, segU: 8, segV: 4, overhang: 1.9 });
    addHip({ x: cx, y: yb + 13.8, z: cz, w: 33, d: 23, h: 5.4, mat: shopTile, segU: 7, segV: 4, overhang: 1.5 });
    BX(mats.inkDark, 12, 0.7, 0.8, cx, yb + 19.1, cz);
  }

  // 资圣阁（三层，青绿琉璃顶，花青点缀）
  {
    const cx = T.cx - 30;
    const cz = T.cz + 30;
    BX(mats.stone, 22, 1.4, 22, cx, Y + 0.7, cz);
    let yy = Y + 1.4;
    const sizes = [
      [18, 18, 4.0, 2.6],
      [14, 14, 3.6, 2.4],
      [10.5, 10.5, 3.2, 2.2],
    ];
    for (let i = 0; i < sizes.length; i++) {
      const [w, d, bh, rh] = sizes[i];
      BX(i === 0 ? mats.wallRed : mats.wallPlaster, w, bh, d, cx, yy + bh / 2, cz);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        BC(mats.wallRedDeep, 0.22, 0.24, bh, 6, cx + sx * (w / 2 - 0.3), yy + bh / 2, cz + sz * (d / 2 - 0.3));
      }
      yy += bh;
      // 每层腰檐（青绿）
      addHip({ x: cx, y: yy, z: cz, w: w + 4.4, d: d + 4.4, h: rh, mat: glazeRoof, segU: 6, segV: 3, overhang: 1.0, lift: 0.3 });
      yy += rh * 0.55;
    }
    // 顶层攒尖
    const top = roundRoofGeometry({ radius: 7.5, height: 5.2, overhang: 1.0, curve: 1.5, fascia: 0.03, segments: 10 });
    push(glazeRoof, tf(top.roof.geometry, cx, yy, cz));
    BX(mats.gold, 1.2, 2.2, 1.2, cx, yy + 5.6, cz);
  }

  // 八角塔（七级）
  {
    const px = tx0 + 20;
    const pz = tz0 + 26;
    BX(mats.marble, 14, 1.6, 14, px, Y + 0.8, pz);
    let yy = Y + 1.6;
    for (let i = 0; i < 7; i++) {
      const r = 4.6 - i * 0.44;
      const bh = 3.0;
      BC(i === 0 ? mats.wallRed : mats.wallPlaster, r * 0.92, r, bh, 8, px, yy + bh / 2, pz);
      yy += bh;
      const eave = roundRoofGeometry({ radius: r + 1.5, height: 1.5, overhang: 0.3, curve: 1.5, fascia: 0.03, segments: 8 });
      push(shopTile, tf(eave.roof.geometry, px, yy, pz));
      yy += 0.4;
    }
    BX(mats.gold, 1.0, 2.4, 1.0, px, yy + 1.1, pz);
  }

  // 相国寺院内松柏 + 香客
  for (let i = 0; i < (low ? 10 : 22); i++) {
    tree(rng() < 0.72 ? 'pine' : 'locust', tx0 + 6 + rng() * (T.w - 12), tz0 + 8 + rng() * (T.d - 16), 5.0 + rng() * 3.4);
  }

  /* ======================================================================== */
  /*  五、樊楼：三层酒楼 + 彩楼欢门 + 灯笼 + 车马摊贩                            */
  /* ======================================================================== */

  {
    const cx = FANLOU.x;
    const cz = FANLOU.z;
    const w = FANLOU.w;
    const d = FANLOU.d;
    // 台基
    BX(mats.stone, w + 8, 1.0, d + 8, cx, Y + 0.5, cz);
    BX(mats.marble, w + 3, 0.5, d + 3, cx, Y + 1.25, cz);
    let yy = Y + 1.5;
    const floors = [
      [w, d, 4.6, 3.6],
      [w - 6, d - 6, 4.2, 3.2],
      [w - 11, d - 10, 3.8, 3.0],
    ];
    for (let i = 0; i < floors.length; i++) {
      const [fw, fd, bh, rh] = floors[i];
      BX(i === 0 ? mats.wallPlaster : mats.timber, fw, bh, fd, cx, yy + bh / 2, cz);
      // 木构腰檐下的一圈朱柱 + 门窗铺板
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        BC(mats.wallRed, 0.3, 0.32, bh, 6, cx + sx * (fw / 2 - 0.5), yy + bh / 2, cz + sz * (fd / 2 - 0.5));
      }
      for (let k = 0; k < Math.round(fw / 4); k++) {
        BC(mats.wallRed, 0.2, 0.22, bh * 0.92, 6, cx - fw / 2 + 1.4 + (k * (fw - 2.8)) / Math.max(1, Math.round(fw / 4) - 1), yy + bh / 2, cz + fd / 2 + 0.1);
      }
      BX(mats.woodDark, fw - 1.4, bh * 0.62, 0.18, cx, yy + bh * 0.36, cz + fd / 2 + 0.12);
      BX(mats.inkDark, fw + 1.6, 0.35, fd + 1.6, cx, yy + 1.0, cz);
      // 檐下灯笼
      for (let k = 0; k < 4; k++) BC(mats.lantern, 0.2, 0.2, 0.42, 8, cx - fw / 2 + 2 + k * (fw - 4) / 3, yy + bh - 0.5, cz + fd / 2 + 0.6);
      if (i > 0) {
        // 回廊栏杆
        for (let k = 0; k < 7; k++) {
          BX(mats.wood, 0.1, 1.0, 0.1, cx - fw / 2 + 1 + k * (fw - 2) / 6, yy + 0.5, cz + fd / 2 + 1.4);
        }
        BX(mats.wood, fw - 1, 0.12, 0.1, cx, yy + 1.05, cz + fd / 2 + 1.4);
      }
      yy += bh;
      addHip({ x: cx, y: yy, z: cz, w: fw + 4.6, d: fd + 4.6, h: rh + 0.8, mat: shopTile, segU: 6, segV: 3, overhang: 1.2, lift: 0.32 });
      yy += rh * 0.5;
    }
    // 楼匾「樊楼」
    BX(mats.inkDark, 5.6, 1.5, 0.14, cx, Y + 9.2, cz + d / 2 + 1.9);
    BX(mats.paperSign, 5.0, 1.1, 0.08, cx, Y + 9.2, cz + d / 2 + 1.98);
    // 顶层旗杆
    BX(mats.woodDark, 0.2, 5.5, 0.2, cx + w / 2 - 3, yy + 2.4, cz);
    push(mats.banner, tf(box(0.06, 3.6, 1.4), cx + w / 2 - 3 + 0.7, yy + 3.4, cz));

    // 彩楼欢门（门前竹木彩架 + 旗幡 + 灯笼）
    const fz = cz + d / 2 + 7;
    const fw = 22;
    const fh = 11;
    for (const sx of [-1, 1]) {
      BX(mats.woodDark, 0.35, fh, 0.35, cx + sx * fw / 2, Y + fh / 2, fz);
      BX(mats.woodDark, 0.35, fh * 0.8, 0.35, cx + sx * (fw / 2 - 2.4), Y + fh * 0.4, fz + 2.6);
    }
    BX(mats.woodDark, fw, 0.4, 0.4, cx, Y + fh, fz);
    BX(mats.woodDark, fw * 0.9, 0.35, 0.35, cx, Y + fh * 0.72, fz);
    BX(mats.woodDark, fw * 0.72, 0.3, 0.3, cx, Y + fh * 0.45, fz + 1.4);
    // 斜撑（竹木交叉）
    for (let i = 0; i < 6; i++) {
      const ax = cx - fw / 2 + 1.6 + i * (fw - 3.2) / 5;
      push(mats.woodDark, beamGeo(ax, fz + 0.4, ax + 1.2, fz + 2.4, 0.16, 0.16, Y + fh * 0.8));
      push(mats.woodDark, beamGeo(ax, fz + 2.4, ax - 1.1, fz + 0.5, 0.14, 0.14, Y + fh * 0.62));
    }
    // 彩帛旗幡（红 / 赭 / 蓝，少量重彩）
    const clothMats = [mats.banner, mats.clothOchre, mats.clothBlue, mats.cloth];
    for (let i = 0; i < 9; i++) {
      const ax = cx - fw / 2 + 1.4 + (i * (fw - 2.8)) / 8;
      const len = 3.0 + (i % 3) * 1.2;
      push(clothMats[i % clothMats.length], tf(box(0.06, len, 1.1 + (i % 2) * 0.5), ax, Y + fh * 0.66 - len / 2, fz - 0.5));
    }
    // 欢门上的灯笼串
    for (let i = 0; i < 7; i++) {
      BC(mats.lantern, 0.26, 0.26, 0.55, 8, cx - fw / 2 + 1.6 + i * 2.9, Y + fh * 0.74 - 0.4, fz + 1.2);
    }
    // 门前灯笼杆
    for (const sx of [-1, 1]) {
      BX(mats.wood, 0.16, 6.5, 0.16, cx + sx * 13, Y + 3.2, fz + 5);
      BC(mats.lantern, 0.3, 0.3, 0.7, 8, cx + sx * 13, Y + 6.3, fz + 5);
    }
    // 楼前酒旗
    BX(mats.woodDark, 0.16, 8, 0.16, cx - 10, Y + 4, fz + 8);
    push(mats.banner, tf(box(0.06, 2.6, 1.2), cx - 10 + 0.6, Y + 7.4, fz + 8));
    // 门前停车位（车马摊贩用人物表现，另加几个货摊）
    for (let i = 0; i < 4; i++) {
      const sx = cx - 14 + i * 9;
      BC(mats.thatch, 0.1, 1.1, 1.6, 6, sx, Y + 0.55, fz + 9.5);
      push(mats.thatch, tf(new THREE.ConeGeometry(1.5, 1.2, 6), sx, Y + 2.1, fz + 9.5));
    }
  }

  /* ======================================================================== */
  /*  六、州桥两岸：桥头铺面 + 河岸 + 摊贩                                      */
  /* ======================================================================== */

  // 桥头两岸的铺面（沿街东西向）
  function riverShops(side) {
    // 只在西侧放两间铺面，东侧留给州桥视线
    const x0 = X - 32;
    const x1 = X - 19;
    for (let i = 0; i < 2; i++) {
      const bx = x0 + (x1 - x0) * (i + 0.5) / 2;
      const bw = (x1 - x0) / 2 - 2;
      BX(mats.wallPlaster, bw, 4.0, 7, bx, Y + 2.0, 41);
      BX(mats.woodDark, bw - 1, 2.4, 0.16, bx, Y + 1.2, 37.5);
      addGable({ x: bx, y: Y + 4.0, z: 41, ry: 0, w: bw + 1.6, d: 9, h: 2.4, segU: 3, segV: 2, overhang: 0.8 });
    }
  }
  riverShops(-1);

  // 桥头柳树
  for (const [wx, wz] of [[X - 20, 31], [X + 22, 32], [X - 20, -18], [X + 24, -17]]) {
    tree('willow', wx, wz, 7.5 + rng() * 1.8);
  }
  // 河岸边的摊棚（州桥下拉的市）
  const stalls = [
    [X - 24, 36], [X - 27, 42], [X + 20, 38], [X + 26, 45], [X - 22, -16], [X + 24, -15],
  ];
  for (const [sx, sz] of stalls) {
    for (const s2 of [-1, 1]) {
      BX(mats.wood, 0.1, 2.1, 0.1, sx + s2 * 2, Y + 1.05, sz);
    }
    addGable({ x: sx, y: Y + 2.1, z: sz, ry: Math.PI / 2, w: 4.4, d: 4, h: 0.9, mat: mats.thatch, segU: 2, segV: 2, overhang: 0.4 });
    BX(mats.wood, 3.4, 0.5, 1.4, sx, Y + 0.8, sz);
  }

  /* ======================================================================== */
  /*  七、御街行道树 / 街边细节                                                   */
  /* ======================================================================== */

  // 御廊前的行道槐（东西两列）
  for (let z = -30; z >= -290; z -= 15) {
    tree(rng() < 0.8 ? 'locust' : 'willow', X - 15.2 + (rng() - 0.5) * 1.2, z + (rng() - 0.5) * 3, 7.2 + rng() * 2.8);
    tree(rng() < 0.8 ? 'locust' : 'willow', X + 15.2 + (rng() - 0.5) * 1.2, z + (rng() - 0.5) * 3, 7.2 + rng() * 2.8);
  }
  // 州桥南岸的行道树
  for (let i = 0; i < 6; i++) {
    tree(i % 2 ? 'locust' : 'willow', X - 15 + i * 6, 36 + (i % 2) * 6, 6.0 + rng() * 2.0);
  }

  // 御街侧道分界线（细墨线，像画里的界石）
  for (const sx of [-1, 1]) {
    BX(mats.inkSoft, 0.1, 0.02, 264, X + sx * 10.6, Y + 0.09, -157);
  }

  // 御街的灯笼串：横跨街面的几道灯线（节日/夜市的气口）
  for (let i = 0; i < 7; i++) {
    const lz = -52 - i * 33 - (rng() - 0.5) * 6;
    BX(mats.inkDark, 27, 0.06, 0.06, X, Y + 7.4, lz);
    for (let k = 0; k < 5; k++) {
      BC(mats.lantern, 0.23, 0.23, 0.46, 8, X - 10.8 + k * 5.4, Y + 6.9, lz);
    }
  }
  // 街边旗幡：酒旗、香药、茶坊的幌子，一竖条一竖条地挑出去
  const flagMats = [mats.banner, mats.clothOchre, mats.clothBlue, mats.cloth];
  for (let i = 0; i < 22; i++) {
    const side = i % 2 ? 1 : -1;
    const fz = -46 - i * 11.2 + (rng() - 0.5) * 3;
    const fx = X + side * (18.2 + rng() * 0.8);
    const fh = 6.4 + rng() * 2.6;
    BX(mats.woodDark, 0.1, fh, 0.1, fx, Y + fh / 2, fz);
    push(flagMats[i % flagMats.length], tf(box(0.06, 2.2 + rng(), 1.0), fx + side * 0.65, Y + fh - 1.5, fz));
  }
  // 御街上的两座彩楼欢门（竹木彩架 + 旗帛），给长街立两个标点
  function streetColorArch(zc, side) {
    const ax = X + side * 15.5;
    const h = 12;
    for (let i = 0; i < 4; i++) {
      BX(mats.woodDark, 0.3, h, 0.3, ax + (i - 1.5) * 2.4, Y + h / 2, zc + (i % 2 ? 2.2 : -2.2) * 0);
    }
    for (let i = 0; i < 3; i++) {
      BX(mats.woodDark, 8.6, 0.3, 0.3, ax, Y + h * (0.35 + i * 0.28), zc + (i - 1) * 1.6);
    }
    for (let i = 0; i < 5; i++) {
      const cm = flagMats[i % flagMats.length];
      push(cm, tf(box(0.06, 3.0 + (i % 2), 1.1), ax - 3.6 + i * 1.8, Y + h * 0.55, zc + 1.1));
    }
    for (let i = 0; i < 4; i++) BC(mats.lantern, 0.26, 0.26, 0.52, 8, ax - 3.2 + i * 2.2, Y + h * 0.78, zc + 0.8);
    // 斜撑
    for (const sx of [-1, 1]) {
      push(mats.woodDark, beamGeo(ax + sx * 3.4, zc - 1.8, ax + sx * 1.2, zc + 1.4, 0.14, 0.14, Y + h * 0.5));
    }
  }
  streetColorArch(-104, -1);
  streetColorArch(-206, 1);

  // 宣德门前的三间牌楼（把御街北端收住，抬头就是宫门）
  {
    const pz = -284;
    const cols = [-13, -4.5, 4.5, 13];
    for (const dx of cols) {
      BC(mats.wallRedDeep, 0.42, 0.48, 10.5, 8, X + dx, Y + 5.25, pz);
      BX(mats.stone, 1.4, 0.7, 1.4, X + dx, Y + 0.35, pz);
    }
    for (const yTop of [8.2, 9.8]) {
      BX(mats.wallRed, 30, 0.9, 1.1, X, Y + yTop, pz);
    }
    BX(mats.inkDark, 33, 0.7, 3.2, X, Y + 10.6, pz);
    addHip({ x: X, y: Y + 10.9, z: pz, w: 34, d: 5.6, h: 2.4, mat: shopTile, segU: 5, segV: 2, overhang: 1.0, lift: 0.3 });
    BX(mats.paperSign, 3.2, 1.4, 0.12, X, Y + 9.0, pz + 0.62);
    BX(mats.inkDark, 3.5, 1.7, 0.08, X, Y + 9.0, pz + 0.56);
    for (const dx of [-13, 13]) {
      BC(mats.lantern, 0.3, 0.3, 0.7, 8, X + dx, Y + 7.2, pz + 0.9);
    }
  }

  // 御街两旁的摊席（茶摊 / 香药摊 / 行商），给长街添点烟火
  for (let i = 0; i < (low ? 4 : 9); i++) {
    const side = i % 2 ? 1 : -1;
    const sz = -50 - i * 26 + (rng() - 0.5) * 6;
    const sx = X + side * (10.5 + rng() * 2.6);
    BC(mats.wood, 0.08, 1.9, 0.08, 6, sx - 1.6, Y + 0.95, sz);
    BC(mats.wood, 0.08, 1.9, 0.08, 6, sx + 1.6, Y + 0.95, sz);
    addGable({ x: sx, y: Y + 1.9, z: sz, w: 4.6, d: 3.4, h: 0.85, mat: mats.thatch, segU: 2, segV: 2, overhang: 0.4 });
    BX(mats.wood, 3.0, 0.08, 1.0, sx, Y + 0.8, sz);
    BX(mats.wood, 0.1, 0.8, 0.1, sx - 1.2, Y + 0.4, sz);
    BX(mats.wood, 0.1, 0.8, 0.1, sx + 1.2, Y + 0.4, sz);
  }

  /* ======================================================================== */
  /*  八、人物                                                                    */
  /* ======================================================================== */

  // 御街 150+：沿街南北向人流
  for (let i = 0; i < (low ? 120 : 320); i++) {
    const z = -24 - rng() * 264;
    const side = rng() < 0.5 ? -1 : 1;
    const x = X + side * (5 + rng() * 10.5);
    person({
      kind: pickKind(KINDS_STREET),
      x,
      z,
      dir: [rng() < 0.5 ? -0.03 : 0.03, rng() < 0.5 ? -1 : 1],
      speed: 0.28 + rng() * 0.3,
      span: 8 + rng() * 22,
    });
  }
  // 州桥两岸 50
  for (let i = 0; i < (low ? 26 : 50); i++) {
    const south = rng() < 0.5;
    const z = south ? 31 + rng() * 20 : -17 - rng() * 22;
    const x = X - 26 + rng() * 52;
    person({
      kind: pickKind(KINDS_CROWD),
      x,
      z,
      dir: [rng() < 0.5 ? -1 : 1, 0],
      speed: 0.25 + rng() * 0.3,
      span: 6 + rng() * 14,
    });
  }
  // 相国寺 40（山门前街 + 院内 + 寺前街）
  for (let i = 0; i < (low ? 20 : 40); i++) {
    const gateSide = rng() < 0.55;
    const x = gateSide ? XIANGOU.gateX - 2 - rng() * 12 : XIANGOU.cx - T.w / 2 + 6 + rng() * (T.w - 12);
    const z = gateSide ? T.cz - 8 + rng() * 16 : T.cz - T.d / 2 + 8 + rng() * (T.d - 16);
    person({
      kind: rng() < 0.3 ? 'monk' : pickKind(KINDS_CROWD),
      x,
      z,
      dir: [rng() < 0.5 ? -1 : 1, rng() < 0.5 ? -0.3 : 0.3],
      speed: 0.2 + rng() * 0.25,
      span: 4 + rng() * 10,
    });
  }
  // 樊楼 30
  for (let i = 0; i < (low ? 16 : 30); i++) {
    const x = FANLOU.x - 17 + rng() * 34;
    const z = FANLOU.z + 15 + rng() * 22;
    person({
      kind: pickKind(KINDS_STREET),
      x,
      z,
      dir: [rng() < 0.5 ? -1 : 1, rng() < 0.5 ? -0.4 : 0.2],
      speed: 0.2 + rng() * 0.3,
      span: 5 + rng() * 12,
    });
  }
  // 宣德门外 30
  for (let i = 0; i < (low ? 16 : 30); i++) {
    const x = X - 30 + rng() * 60;
    const z = P.z1 + 4 + rng() * 14;
    person({
      kind: pickKind(KINDS_CROWD.concat(['rider', 'palanquin', 'monk'])),
      x,
      z,
      dir: [rng() < 0.5 ? -1 : 1, rng() < 0.5 ? -0.3 : 0.3],
      speed: 0.2 + rng() * 0.25,
      span: 4 + rng() * 12,
    });
  }

  /* ======================================================================== */
  /*  九、合并上屏                                                               */
  /* ======================================================================== */

  let draws = 0;
  let tris = 0;
  for (const [mat, geos] of B) {
    if (!geos.length) continue;
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = `inner-${draws}`;
    mesh.frustumCulled = false;
    group.add(mesh);
    for (const g of geos) g.dispose();
    draws += 1;
    tris += merged.index ? merged.index.count / 3 : merged.attributes.position.count / 3;
  }
  // 地面铺装（basic 材质单独一组，仍在上面的 Map 里）
  if (treeSpecs.length) group.add(buildTrees(treeSpecs, ctx));

  group.userData.cityInner = {
    people: peopleCount,
    trees: treeSpecs.length,
    draws,
    tris: Math.round(tris),
  };
  return group;
}
