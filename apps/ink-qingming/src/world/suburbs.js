/**
 * suburbs.js —— 东京城外四郊：东郊 · 南郊 · 西郊 · 北郊。
 *
 * 外城墙（OUTER_CITY）外是宋朝东京的城郊：
 *   东郊：驿路、田畴、农舍、驮炭驴队；还有宋四园苑之一的「宜春苑」。
 *   南郊：菜地、桑林、村落，三条驿路从新南门/陈州门/新门放射出去；「玉津园」。
 *   西郊：金明池、琼林苑外围的田园、别院与树林（水系归 river，建置归 landmarks）。
 *   北郊：清明时节的坟茔、松林、驿路；「瑞圣园」。
 *
 * 约束：只画城墙外 90m 以外的地界，不碰外城墙 / 护城河 / 城内已有内容；
 * 城外大片绢底由本模块补一圈「郊野地面」把纸续出去。
 * 人物只 push ctx.people；树走 flora 共享批次；按材质合并，控制 draw call。
 *
 * 契约：export function buildSuburbs(ctx) → THREE.Group(name='suburbs')
 */
import * as THREE from 'three';
import { mergeGeometries } from '../lib/merge-safe.js';
import { makeRng } from '../lib/rand.js';
import { gableRoofGeometry, hipRoofGeometry } from '../lib/roof.js';
import { buildTrees } from '../lib/flora.js';
import { setInkWeight } from '../lib/materials.js';
import { GROUND_Y } from '../layout.js';

const Y = GROUND_Y;
const TAU = Math.PI * 2;

/* 外城范围（layout.js OUTER_CITY，墙外 90m 内不摆东西） */
const CITY = { x0: -320, x1: 800, z0: -640, z1: 300 };
const CLEAR = 90;

/* 四郊的地界（都在城墙 + 护城河 + 留空之外） */
const EAST = { x0: 890, x1: 1500, z0: -840, z1: 200 };
const SOUTH = { x0: -360, x1: 1060, z0: 390, z1: 1260 };
const WEST = { x0: -1500, x1: -410, z0: -800, z1: 340 };
const NORTH = { x0: -400, x1: 1080, z0: -1420, z1: -740 };

/* -------------------------------------------------------------------------- */
/*  几何小工具                                                                  */
/* -------------------------------------------------------------------------- */

const tf = (geo, x, y, z, ry = 0) => {
  if (ry) geo.rotateY(ry);
  geo.translate(x, y, z);
  return geo;
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/** 两点之间的一根梁（沿 X 拉伸再旋转） */
function beamGeo(ax, az, bx, bz, w, h, y) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const g = new THREE.BoxGeometry(len, h, w);
  g.rotateY(Math.atan2(-dz, dx));
  g.translate((ax + bx) / 2, y, (az + bz) / 2);
  return g;
}

/** 折线 → 平面带状路（y 固定） */
function ribbon(points, halfWidth, y) {
  const pos = [];
  const idx = [];
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    let dx;
    let dz;
    if (i === 0) {
      dx = points[1][0] - x;
      dz = points[1][1] - z;
    } else if (i === points.length - 1) {
      dx = x - points[i - 1][0];
      dz = z - points[i - 1][1];
    } else {
      dx = points[i + 1][0] - points[i - 1][0];
      dz = points[i + 1][1] - points[i - 1][1];
    }
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * halfWidth;
    const nz = (dx / len) * halfWidth;
    pos.push(x + nx, y, z + nz, x - nx, y, z - nz);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 折线采样：t∈[0,1] 取点与切向 */
function samplePath(points, t) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const len = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    segs.push(len);
    total += len;
  }
  let d = t * total;
  let i = 0;
  while (i < segs.length - 1 && d > segs[i]) {
    d -= segs[i];
    i++;
  }
  const a = points[i];
  const b = points[i + 1];
  const k = segs[i] ? d / segs[i] : 0;
  const x = a[0] + (b[0] - a[0]) * k;
  const z = a[1] + (b[1] - a[1]) * k;
  const len = segs[i] || 1;
  return { x, z, tx: (b[0] - a[0]) / len, tz: (b[1] - a[1]) / len, len: total };
}

/* -------------------------------------------------------------------------- */
/*  郊野                                                                        */
/* -------------------------------------------------------------------------- */

export function buildSuburbs(ctx) {
  const group = new THREE.Group();
  group.name = 'suburbs';
  const low = ctx.quality === 'low';
  const rng = makeRng(20261103);
  const mats = ctx.mats;

  /* ---- 材质 ---- */
  const groundMat = new THREE.MeshLambertMaterial({ color: 0xefe3c9, flatShading: true });
  const parkWallMat = setInkWeight(mats.wallPlaster.clone(), 0.22);
  parkWallMat.color.setHex(0xe4d5b4);
  const earthMat = setInkWeight(mats.wallPlaster.clone(), 0.2);
  earthMat.color.setHex(0xd8c7a2);
  const roofMat = setInkWeight(mats.thatch.clone(), 0.3);
  roofMat.color.setHex(0x7a6242);
  const tileMat = setInkWeight(mats.roofTile.clone(), 0.4);
  tileMat.color.setHex(0x7a827c);
  const fieldMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const ridgeMat = new THREE.LineBasicMaterial({ color: 0x6d6f5a, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false });
  const borderMat = new THREE.LineBasicMaterial({ color: 0x69684f, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false });
  const roadMat = new THREE.MeshBasicMaterial({ color: 0xe2d5b8, toneMapped: false });
  const ditchMat = new THREE.MeshBasicMaterial({ color: 0xaab7a8, toneMapped: false });
  const laneMat = new THREE.MeshBasicMaterial({ color: 0xd9cbaa, toneMapped: false });

  /* ---- 批次 ---- */
  const B = new Map();
  const push = (mat, geo) => {
    if (!geo) return;
    let list = B.get(mat);
    if (!list) B.set(mat, (list = []));
    list.push(geo);
  };
  const BX = (mat, w, h, d, x, y, z, ry = 0) => push(mat, tf(box(w, h, d), x, y, z, ry));
  const BC = (mat, rt, rb, h, seg, x, y, z) => push(mat, tf(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z));

  /* ---- 树 / 人 / 场记 ---- */
  const treeSpecs = [];
  const tree = (kind, x, z, h) => treeSpecs.push({ kind, x, z, y: Y, h });
  let peopleCount = 0;
  const person = (spec) => {
    if (Array.isArray(ctx.people)) {
      ctx.people.push(spec);
      peopleCount += 1;
    }
  };

  /* ---- 屋顶 ---- */
  function addGable({ x, y, z, ry = 0, w, d, h, mat = roofMat, overhang = 0.55, segU = 4, segV = 2 }) {
    const { roof, fascia } = gableRoofGeometry({ width: w, depth: d, height: h, overhang, lift: 0.06, curve: 1.45, segU, segV, fascia: 0.1 });
    push(mat, tf(roof, x, y, z, ry));
    push(mats.thatchDark, tf(fascia, x, y, z, ry));
    return y + h;
  }
  function addHip({ x, y, z, ry = 0, w, d, h, mat = tileMat, overhang = 0.8, segU = 5, segV = 3 }) {
    const { roof, fascia } = hipRoofGeometry({ width: w, depth: d, height: h, overhang, lift: 0.3, curve: 1.55, segU, segV });
    push(mat, tf(roof, x, y, z, ry));
    push(mats.eave, tf(fascia, x, y, z, ry));
    return y + h;
  }

  /* ======================================================================== */
  /*  〇、郊野绢底：把纸续到城郊之外（城墙外原 terrain 只铺到 x -420..900 / z -760..800） */
  /* ======================================================================== */

  function groundQuad(x0, x1, z0, z1) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, Y - 0.005, (z0 + z1) / 2);
    push(groundMat, g);
  }
  // 北 / 南 / 西 / 东 四条外圈
  groundQuad(-2200, 2200, -2200, -760);
  groundQuad(-2200, 2200, 800, 1500);
  groundQuad(-2200, -420, -760, 800);
  groundQuad(900, 2200, -760, 800);

  /* ======================================================================== */
  /*  一、驿路：从各城门放射出去的土路（只画城墙+护城河之外那段）               */
  /* ======================================================================== */

  const ROADS = [
    // 东郊：新宋门驿路（主）、新曹门路
    { id: 'e1', w: 8, pts: [[880, -22], [1010, -46], [1180, -56], [1370, -36], [1520, -18]] },
    { id: 'e2', w: 5.5, pts: [[880, -300], [1040, -322], [1220, -310], [1420, -296]] },
    // 南郊：新南门（主驿路）、陈州门、新门
    { id: 's1', w: 8, pts: [[320, 380], [326, 560], [318, 760], [334, 980], [330, 1260]] },
    { id: 's2', w: 6, pts: [[620, 380], [636, 580], [648, 820], [660, 1080], [672, 1260]] },
    { id: 's3', w: 5.5, pts: [[-60, 380], [-44, 580], [-54, 820], [-38, 1060], [-30, 1260]] },
    // 西郊：新郑门、万胜门
    { id: 'w1', w: 6.5, pts: [[-400, -182], [-620, -194], [-880, -176], [-1180, -164], [-1500, -160]] },
    { id: 'w2', w: 6, pts: [[-400, 42], [-640, 28], [-900, 44], [-1200, 34], [-1500, 40]] },
    // 北郊：陈桥门（驿路）、固子门、新酸枣门
    { id: 'n1', w: 7, pts: [[60, -720], [78, -920], [64, -1140], [86, -1360], [80, -1420]] },
    { id: 'n2', w: 5, pts: [[-170, -720], [-186, -930], [-206, -1160], [-196, -1400]] },
    { id: 'n3', w: 5, pts: [[300, -720], [330, -940], [316, -1180], [336, -1400]] },
  ];

  const roadSegs = [];
  for (const r of ROADS) {
    push(roadMat, ribbon(r.pts, r.w / 2, Y + 0.045));
    for (let i = 1; i < r.pts.length; i++) {
      roadSegs.push([r.pts[i - 1][0], r.pts[i - 1][1], r.pts[i][0], r.pts[i][1], r.w / 2]);
    }
    // 行道树：约 55m 一棵，左右交替
    const sp = samplePath(r.pts, 0.5);
    const steps = Math.max(2, Math.floor(sp.len / (low ? 110 : 72)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const p = samplePath(r.pts, t);
      const side = i % 2 ? 1 : -1;
      const off = r.w / 2 + 3.5 + rng() * 2.5;
      const tx = p.x + -p.tz * off * side;
      const tz = p.z + p.tx * off * side;
      tree(rng() < 0.72 ? 'locust' : (rng() < 0.5 ? 'willow' : 'pine'), tx, tz, 5.5 + rng() * 2.6);
    }
  }

  // 避让判定：离路、离城、离公园、离村舍都留空
  function distToRoad(x, z) {
    let best = Infinity;
    for (const [ax, az, bx, bz, hw] of roadSegs) {
      const dx = bx - ax;
      const dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t) - hw);
    }
    return best;
  }
  const outOfCity = (x, z, pad = 0) => !(x > CITY.x0 - pad && x < CITY.x1 + pad && z > CITY.z0 - pad && z < CITY.z1 + pad);
  const inRect = (r, x, z, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

  /* ======================================================================== */
  /*  二、村舍（四郊各 6~10 间）+ 篱笆 + 柴垛                                    */
  /* ======================================================================== */

  const hamlets = [];
  function addHouse(x, z, rot = 0, small = false) {
    const w = small ? 5.8 : 8.2 + rng() * 1.8;
    const d = small ? 4.4 : 5.6 + rng() * 1.2;
    const h = small ? 2.3 : 2.7 + rng() * 0.3;
    BX(mats.stoneShade, w + 0.4, 0.16, d + 0.4, x, Y + 0.08, z, rot);
    BX(earthMat, w, h, d, x, Y + 0.16 + h / 2, z, rot);
    const [dx, dz] = [x + Math.sin(rot) * (d / 2 + 0.05), z + Math.cos(rot) * (d / 2 + 0.05)];
    BX(mats.woodDark, 0.95, 1.6, 0.12, dx, Y + 0.96, dz, rot);
    addGable({ x, y: Y + 0.16 + h, z, ry: rot, w: w * 1.04, d: d * 1.08, h: Math.min(w, d) * 0.4 + 0.3, segU: 4, segV: 2 });
    // 篱笆院（约一半有）
    if (rng() < 0.55) {
      const hw = w / 2 + 2.4;
      const hd = d / 2 + 2.4;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const L = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
      const fenceRun = (ax, az, bx, bz) => {
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.max(2, Math.round(len / 2.2));
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          BX(mats.wood, 0.09, 0.95, 0.09, ax + (bx - ax) * t, Y + 0.48, az + (bz - az) * t);
        }
        push(mats.wood, beamGeo(ax, az, bx, bz, 0.05, 0.05, Y + 0.82));
      };
      const c00 = L(-hw, hd);
      const c10 = L(hw * 0.35, hd);
      const c11 = L(hw, hd);
      const c01 = L(-hw, -hd);
      const c02 = L(hw, -hd);
      fenceRun(c00[0], c00[1], c10[0], c10[1]);
      fenceRun(c11[0], c11[1], L(hw * 0.55, hd)[0], L(hw * 0.55, hd)[1]);
      fenceRun(c01[0], c01[1], L(-hw, hd)[0], L(-hw, hd)[1]);
      fenceRun(c02[0], c02[1], L(hw, hd)[0], L(hw, hd)[1]);
      fenceRun(c01[0], c01[1], c02[0], c02[1]);
    }
    if (rng() < 0.4) {
      // 柴垛
      const hx = x + (rng() - 0.5) * 8;
      const hz = z + (rng() - 0.5) * 8;
      push(roofMat, tf(new THREE.CylinderGeometry(0.12, 1.0, 1.5, 8), hx, Y + 0.75, hz));
      tree('locust', x + (rng() < 0.5 ? -1 : 1) * (w / 2 + 4 + rng() * 4), z + (rng() - 0.5) * 6, 5.5 + rng() * 2.5);
    }
  }

  function addHamlet(cx, cz, n = 4, rot = 0) {
    hamlets.push([cx, cz, 34]);
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * TAU + (rng() - 0.5) * 0.5;
      const r = 11 + rng() * 8;
      addHouse(cx + Math.cos(a) * r, cz + Math.sin(a) * r, rng() * TAU, i === n - 1 && rng() < 0.4);
    }
    // 打谷场（村边一块浅色圆场）+ 水井
    const thx = cx + (rng() - 0.5) * 18;
    const thz = cz + (rng() - 0.5) * 18;
    const th = new THREE.CircleGeometry(6.5 + rng() * 3, 12);
    th.rotateX(-Math.PI / 2);
    th.translate(thx, Y + 0.03, thz);
    push(roadMat, th);
    BX(mats.stoneShade, 1.7, 0.75, 1.7, cx + (rng() - 0.5) * 22, Y + 0.38, cz + (rng() - 0.5) * 22);
    // 村口树
    for (let i = 0; i < 2; i++) {
      tree(rng() < 0.5 ? 'blossom' : rng() < 0.5 ? 'locust' : 'pine', cx + (rng() - 0.5) * 30, cz + (rng() - 0.5) * 30, 5.5 + rng() * 2.8);
    }
  }
  const nearHamlet = (x, z, pad = 20) => hamlets.some(([hx, hz, r]) => Math.hypot(x - hx, z - hz) < r + pad);

  // 东郊
  addHamlet(960, 60, 3, 0.4);
  addHamlet(1330, -180, 3, 1.6);
  addHamlet(1010, -650, 3, 2.4);
  // 南郊
  addHamlet(150, 500, 3, 0.2);
  addHamlet(520, 980, 3, 1.2);
  addHamlet(910, 470, 3, 2.2);
  addHamlet(-160, 820, 3, 0.8);
  // 西郊
  addHamlet(-680, -70, 3, 0.6);
  addHamlet(-1060, -430, 3, 1.8);
  addHamlet(-1250, 170, 3, 2.6);
  // 北郊
  addHamlet(-290, -930, 3, 0.3);
  addHamlet(170, -820, 3, 1.4);
  addHamlet(760, -1220, 3, 2.8);

  /* ======================================================================== */
  /*  三、田畴 + 桑林                                                            */
  /* ======================================================================== */

  const FIELD_COLORS = ['#c9c09e', '#c3bc98', '#cec6a4', '#beb993', '#c5c09c', '#cbc19b'];
  const fieldPos = [];
  const fieldCol = [];
  const fieldIdx = [];
  const ridgePos = [];
  const borderPos = [];
  let fieldTone = 0;

  function addField(x, z, w, d, rot = 0, color) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const local = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const W = w / 2;
    const D = d / 2;
    const jit = () => (rng() - 0.5) * 0.5;
    const corners = [
      [-W + jit(), -D + jit()],
      [W + jit(), -D + jit()],
      [W + jit(), D + jit()],
      [-W + jit(), D + jit()],
    ].map(([lx, lz]) => local(lx, lz));
    const base = new THREE.Color(color);
    const tone = 0.96 + rng() * 0.08;
    const y = Y + 0.02;
    const i0 = fieldPos.length / 3;
    for (const [px, pz] of corners) {
      fieldPos.push(px, y, pz);
      fieldCol.push(base.r * tone, base.g * tone, base.b * tone);
    }
    fieldIdx.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2);
    const yb = Y + 0.03;
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      borderPos.push(a[0], yb, a[1], b[0], yb, b[1]);
    }
    // 田垄（细墨线，比田块本身淡）
    const yl = Y + 0.026;
    const step = 2.2;
    const segs = Math.max(2, Math.round(d / 6));
    for (let lx = -W + 1.0; lx <= W - 1.0; lx += step) {
      for (let k = 0; k < segs; k++) {
        const za = -D + 0.5 + ((D * 2 - 1) * k) / segs;
        const zb = -D + 0.5 + ((D * 2 - 1) * (k + 1)) / segs;
        const oa = Math.sin(lx * 1.7 + k * 0.9) * 0.16;
        const [ax, az] = local(lx + oa, za);
        const [bx, bz] = local(lx - oa, zb);
        ridgePos.push(ax, yl, az, bx, yl, bz);
      }
    }
  }

  // 每个片区一片田：一簇一簇地挨着排（像画里的田畈），避开路 / 村舍 / 公园
  const parkRects = [];
  function fillFields(zone, count, sizeMin = 14, sizeMax = 28) {
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < count * 22) {
      // 先选一片田畈的中心，再在中心旁边挨着排 2~4 块田
      const gx = zone.x0 + 20 + rng() * (zone.x1 - zone.x0 - 40);
      const gz = zone.z0 + 20 + rng() * (zone.z1 - zone.z0 - 40);
      if (!outOfCity(gx, gz, 120)) continue;
      const cluster = 2 + Math.floor(rng() * 3);
      let ox = gx;
      const oz = gz;
      const rot = (rng() - 0.5) * 0.24;
      for (let k = 0; k < cluster && placed < count; k++) {
        const w = sizeMin + rng() * (sizeMax - sizeMin);
        const d = sizeMin + 6 + rng() * (sizeMax - sizeMin);
        const x = ox + w / 2;
        const z = oz + (rng() - 0.5) * 3;
        if (!outOfCity(x, z, 120)) { ox += w + 1.2; continue; }
        if (distToRoad(x, z) < Math.max(w, d) * 0.55 + 5) { ox += w + 1.2; continue; }
        if (nearHamlet(x, z, Math.max(w, d) * 0.5 + 3)) { ox += w + 1.2; continue; }
        if (parkRects.some((r) => inRect(r, x, z, Math.max(w, d) * 0.55 + 8))) { ox += w + 1.2; continue; }
        addField(x, z, w, d, rot + (rng() - 0.5) * 0.05, FIELD_COLORS[fieldTone++ % FIELD_COLORS.length]);
        placed++;
        ox += w + 0.4;
        // 田埂树
        if (rng() < 0.35) tree(rng() < 0.6 ? 'locust' : 'blossom', x + (rng() < 0.5 ? -1 : 1) * (w / 2 + 3), z + (rng() - 0.5) * d * 0.5, 5.0 + rng() * 2.4);
      }
    }
  }
  // 南郊桑林：一排排小树（桑树矮，用 locust 压低高度）
  for (const [ox, oz, rows, cols] of [[260, 700, 4, 6], [800, 1000, 3, 7]]) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = ox + c * 6.5 + (rng() - 0.5) * 1.6;
        const z = oz + r * 7 + (rng() - 0.5) * 1.6;
        if (distToRoad(x, z) < 12) continue;
        tree(rng() < 0.75 ? 'locust' : 'willow', x, z, 3.6 + rng() * 1.2);
      }
    }
  }

  /* ======================================================================== */
  /*  四、三座园苑：宜春苑 / 玉津园 / 瑞圣园                                     */
  /* ======================================================================== */

  function addPark({ cx, cz, w, d, gate = 'w', treeKind = 'blossom' }) {
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const z0 = cz - d / 2;
    const z1 = cz + d / 2;
    parkRects.push({ x0, x1, z0, z1 });
    const wallH = 4.6;
    const t = 1.1;
    const seg = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az);
      const ry = Math.atan2(-(bz - az), bx - ax);
      BX(parkWallMat, len, wallH, t, (ax + bx) / 2, Y + wallH / 2, (az + bz) / 2, ry);
      BX(mats.inkDark, len, 0.3, t + 0.7, (ax + bx) / 2, Y + wallH + 0.1, (az + bz) / 2, ry);
    };
    const gateW = 10;
    // 四边，留门
    if (gate === 'w') {
      seg(x0, z0, x1, z0);
      seg(x1, z0, x1, z1);
      seg(x1, z1, x0, z1);
      seg(x0, z1, x0, cz + gateW / 2);
      seg(x0, cz - gateW / 2, x0, z0);
    } else if (gate === 's') {
      seg(x0, z0, x1, z0);
      seg(x1, z0, x1, z1);
      seg(x1, z1, cx + gateW / 2, z1);
      seg(cx - gateW / 2, z1, x0, z1);
      seg(x0, z1, x0, z0);
    } else {
      seg(x0, z0, cx - gateW / 2, z0);
      seg(cx + gateW / 2, z0, x1, z0);
      seg(x1, z0, x1, z1);
      seg(x1, z1, x0, z1);
      seg(x0, z1, x0, z0);
    }
    // 园门（小门楼，灰瓦）
    const [gx, gz] = gate === 'w' ? [x0, cz] : gate === 's' ? [cx, z1] : [cx, z0];
    const gry = gate === 'w' ? Math.PI / 2 : 0;
    BX(mats.stone, 12, 0.8, 8, gx, Y + 0.4, gz, gry);
    BX(mats.wallRed, 9, 4.4, 5, gx, gry === Math.PI / 2 ? Y + 4.2 : Y + 2.4, gz, gry);
    BX(mats.inkDeep, 3.4, 3.2, 0.4, gx + (gate === 'w' ? 0 : 0), Y + 1.6, gz + (gate === 'w' ? 2.6 : gate === 's' ? 2.6 : -2.6), gry);
    addHip({ x: gx, y: Y + 5.2, z: gz, ry: gry, w: 12, d: 7.5, h: 2.6, mat: tileMat, segU: 4, segV: 2, overhang: 1.0 });
    // 园中甬道（十字）
    push(laneMat, ribbon([[x0 + 8, cz], [cx, cz], [x1 - 8, cz]], 2.2, Y + 0.05));
    push(laneMat, ribbon([[cx, z0 + 8], [cx, cz], [cx, z1 - 8]], 2.2, Y + 0.05));
    // 亭子
    function pavilion(px, pz) {
      BX(mats.stone, 8, 0.5, 8, px, Y + 0.25, pz);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        BC(mats.wallRedDeep, 0.22, 0.24, 3.4, 6, px + sx * 3, Y + 2.0, pz + sz * 3);
      }
      addHip({ x: px, y: Y + 3.7, z: pz, w: 8.4, d: 8.4, h: 2.6, mat: tileMat, segU: 4, segV: 2, overhang: 0.9 });
      BX(mats.gold, 0.7, 1.1, 0.7, px, Y + 6.6, pz);
    }
    pavilion(cx, cz);
    pavilion(cx + w * 0.26, cz - d * 0.24);
    pavilion(cx - w * 0.26, cz + d * 0.22);
    // 花木：园里点树，别太密
    const tn = low ? 10 : 18;
    for (let i = 0; i < tn; i++) {
      const px = x0 + 10 + rng() * (w - 20);
      const pz = z0 + 10 + rng() * (d - 20);
      if (Math.hypot(px - cx, pz - cz) < 7 || Math.abs(px - cx) < 5 || Math.abs(pz - cz) < 5) continue;
      tree(rng() < 0.5 ? treeKind : rng() < 0.5 ? 'locust' : 'pine', px, pz, 5.0 + rng() * 3.0);
    }
    // 园里游人
    for (let i = 0; i < (low ? 5 : 9); i++) {
      person({
        kind: rng() < 0.5 ? 'scholar' : rng() < 0.5 ? 'lady' : 'child',
        x: x0 + 12 + rng() * (w - 24),
        z: z0 + 12 + rng() * (d - 24),
        dir: [rng() < 0.5 ? -1 : 1, rng() < 0.5 ? -0.4 : 0.4],
        speed: 0.2 + rng() * 0.2,
        span: 3 + rng() * 8,
      });
    }
  }

  addPark({ cx: 1210, cz: -500, w: 300, d: 220, gate: 'w', treeKind: 'blossom' }); // 宜春苑
  addPark({ cx: 860, cz: 700, w: 320, d: 240, gate: 's', treeKind: 'blossom' }); // 玉津园
  addPark({ cx: 560, cz: -1030, w: 280, d: 240, gate: 's', treeKind: 'pine' }); // 瑞圣园

  // —— 田畴最后撒：避让苑墙 / 村舍 / 驿路 ——
  fillFields(EAST, low ? 13 : 20);
  fillFields(SOUTH, low ? 14 : 22);
  fillFields(WEST, low ? 11 : 17);
  fillFields(NORTH, low ? 8 : 12);

  /* ======================================================================== */
  /*  五、西郊别院 + 驿站                                                        */
  /* ======================================================================== */

  function addCompound({ cx, cz, w = 70, d = 60, rot = 0, name = '' }) {
    const wallH = 3.2;
    const t = 1.0;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const L = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
    const hw = w / 2;
    const hd = d / 2;
    const seg = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az);
      BX(parkWallMat, len, wallH, t, (ax + bx) / 2, Y + wallH / 2, (az + bz) / 2, Math.atan2(-(bz - az), bx - ax));
    };
    const g0 = 6;
    const c1 = L(g0, hd);
    const c2 = L(hw, hd);
    const c3 = L(hw, -hd);
    seg(...L(-hw, hd), ...c1);
    seg(...c2, ...L(-hw, hd));
    seg(...c3, ...c2);
    seg(...L(-hw, -hd), ...c3);
    seg(...L(-hw, hd), ...L(-hw, -hd));
    // 正房 + 厢房
    addHouse(cx, cz - 6, rot, true);
    addHouse(...L(-16, 8), rot + 0.1, false);
    addHouse(...L(17, 6), rot - 0.1, true);
    // 院中亭
    const [px, pz] = L(0, 12);
    BX(mats.stone, 6, 0.4, 6, px, Y + 0.2, pz);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) BC(mats.wallRedDeep, 0.2, 0.22, 3.0, 6, px + sx * 2.2, Y + 1.7, pz + sz * 2.2);
    addHip({ x: px, y: Y + 3.3, z: pz, w: 6.2, d: 6.2, h: 2.0, mat: tileMat, segU: 3, segV: 2, overhang: 0.7 });
    // 门
    const [gx, gz] = L(0, hd);
    BX(mats.woodDark, 3.2, 3.0, 0.3, gx, Y + 1.5, gz, rot);
    // 院中树
    tree(rng() < 0.6 ? 'blossom' : 'pine', ...L(-hw + 8, -hd + 8), 5.5 + rng() * 2);
    tree(rng() < 0.6 ? 'blossom' : 'locust', ...L(hw - 8, hd - 10), 5.0 + rng() * 2);
    tree('locust', ...L(-hw + 10, hd - 8), 6.5 + rng() * 2);
  }

  addCompound({ cx: -800, cz: -350, w: 80, d: 66, rot: 0.2 }); // 西郊别院
  addCompound({ cx: -1120, cz: 120, w: 64, d: 54, rot: -0.3 }); // 另一处小别院
  addCompound({ cx: 990, cz: -150, w: 72, d: 58, rot: 0.1 }); // 东郊驿站
  addCompound({ cx: 560, cz: 1080, w: 66, d: 52, rot: -0.15 }); // 南郊驿站

  /* ======================================================================== */
  /*  六、北郊坟茔（清明） + 松林                                                */
  /* ======================================================================== */

  function addGrave(x, z, rot = 0) {
    const mound = new THREE.SphereGeometry(1, 8, 4, 0, TAU, 0, Math.PI * 0.5);
    mound.scale(1.4, 0.5, 1.1);
    mound.rotateY(rot);
    mound.translate(x, Y + 0.01, z);
    push(earthMat, mound);
    BX(mats.stoneShade, 0.4, 0.62, 0.1, x + Math.sin(rot) * 1.3, Y + 0.33, z + Math.cos(rot) * 1.3, rot);
    BX(mats.stoneShade, 0.54, 0.18, 0.3, x + Math.sin(rot) * 1.6, Y + 0.14, z + Math.cos(rot) * 1.6, rot);
    // 清明挂白纸
    const px = x + Math.cos(rot) * 0.9;
    const pz = z - Math.sin(rot) * 0.9;
    BX(mats.wood, 0.05, 1.2, 0.05, px, Y + 0.6, pz);
    BX(mats.wallPlaster, 0.26, 0.4, 0.02, px + 0.1, Y + 1.0, pz, rot + 0.2);
  }
  // 北郊坟地：一片，十来座
  for (let i = 0; i < (low ? 7 : 12); i++) {
    const gx = -60 + (rng() - 0.5) * 240;
    const gz = -880 - rng() * 220;
    if (distToRoad(gx, gz) < 14) continue;
    addGrave(gx, gz, (rng() - 0.5) * 0.8);
    if (i % 3 === 0) tree('pine', gx + (rng() - 0.5) * 14, gz + (rng() - 0.5) * 14, 6.0 + rng() * 3.0);
  }
  // 北郊松林
  for (let c = 0; c < (low ? 4 : 8); c++) {
    const cx = NORTH.x0 + 60 + rng() * (NORTH.x1 - NORTH.x0 - 120);
    const cz = NORTH.z0 + 40 + rng() * (NORTH.z1 - NORTH.z0 - 80);
    if (nearHamlet(cx, cz, 30) || distToRoad(cx, cz) < 30) continue;
    for (let i = 0; i < 4; i++) tree(rng() < 0.8 ? 'pine' : 'locust', cx + (rng() - 0.5) * 22, cz + (rng() - 0.5) * 22, 5.5 + rng() * 3.4);
  }

  /* ======================================================================== */
  /*  七、小桥 / 水沟（乡间驿路上的小木桥）                                       */
  /* ======================================================================== */

  function addDitchBridge(cx, cz, alongX = true, span = 4.6, wid = 4.0) {
    // 干沟：一条浅色的沟槽带（水系另归 river，这里只是乡间排水沟）
    const g = new THREE.PlaneGeometry(alongX ? 2.4 : 30, alongX ? 30 : 2.4);
    g.rotateX(-Math.PI / 2);
    g.translate(cx, Y + 0.018, cz);
    push(ditchMat, g);
    // 小木桥
    const rot = alongX ? Math.PI / 2 : 0;
    BX(mats.wood, alongX ? span : wid, 0.14, alongX ? wid : span, cx, Y + 0.34, cz, rot);
    for (const s of [-1, 1]) {
      const ox = alongX ? s * span * 0.42 : s * (wid / 2 - 0.2);
      const oz = alongX ? s * (wid / 2 - 0.2) : s * span * 0.42;
      BX(mats.wood, 0.1, 1.0, 0.1, cx + ox, Y + 0.62, cz + oz);
      BX(mats.wood, 0.1, 1.0, 0.1, cx + (alongX ? -ox : ox), Y + 0.62, cz + (alongX ? -oz : oz));
    }
    BX(mats.wood, alongX ? 0.1 : wid * 0.9, 0.07, alongX ? wid * 0.9 : 0.1, cx, Y + 1.1, cz, rot);
    BX(mats.stoneShade, alongX ? 0.8 : wid + 0.6, 0.3, alongX ? wid + 0.6 : 0.8, cx, Y + 0.14, cz);
  }
  addDitchBridge(1150, -50, true, 5.0, 4.2); // 东郊驿路上
  addDitchBridge(324, 700, false, 5.0, 4.2); // 南郊驿路上
  addDitchBridge(-740, -180, true, 5.0, 4.0); // 西郊路上

  /* ======================================================================== */
  /*  八、树林 / 桑园 / 村树：四郊各自成片，别铺满                               */
  /* ======================================================================== */

  // 西郊：金明池/琼林苑外的树林（成片，留白）
  for (let c = 0; c < (low ? 6 : 12); c++) {
    const cx = WEST.x0 + 80 + rng() * (WEST.x1 - WEST.x0 - 160);
    const cz = WEST.z0 + 60 + rng() * (WEST.z1 - WEST.z0 - 120);
    if (nearHamlet(cx, cz, 26) || distToRoad(cx, cz) < 26) continue;
    if (parkRects.some((r) => inRect(r, cx, cz, 30))) continue;
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) tree(rng() < 0.6 ? 'pine' : rng() < 0.5 ? 'locust' : 'blossom', cx + (rng() - 0.5) * 20, cz + (rng() - 0.5) * 20, 5.0 + rng() * 3.2);
  }
  // 东郊：田边树林
  for (let c = 0; c < (low ? 4 : 8); c++) {
    const cx = EAST.x0 + 60 + rng() * (EAST.x1 - EAST.x0 - 120);
    const cz = EAST.z0 + 60 + rng() * (EAST.z1 - EAST.z0 - 120);
    if (nearHamlet(cx, cz, 26) || distToRoad(cx, cz) < 26) continue;
    if (parkRects.some((r) => inRect(r, cx, cz, 30))) continue;
    for (let i = 0; i < 3; i++) tree(rng() < 0.5 ? 'locust' : 'blossom', cx + (rng() - 0.5) * 16, cz + (rng() - 0.5) * 16, 5.0 + rng() * 2.8);
  }

  /* ======================================================================== */
  /*  九、人物：驿路 / 村舍 / 田间 / 坟地                                       */
  /* ======================================================================== */

  const roadKinds = ['walker', 'walker', 'porter', 'porter', 'scholar', 'monk', 'child', 'vendor', 'donkey', 'rider', 'lady'];
  const pickRoadKind = () => roadKinds[Math.floor(rng() * roadKinds.length) % roadKinds.length];
  for (const r of ROADS) {
    const sp = samplePath(r.pts, 0.5);
    const n = Math.max(4, Math.floor(sp.len / 70));
    for (let i = 0; i < n; i++) {
      const t = 0.06 + (rng() * 0.88);
      const p = samplePath(r.pts, t);
      const off = (rng() - 0.5) * r.w * 0.8;
      person({
        kind: pickRoadKind(),
        x: p.x + -p.tz * off,
        z: p.z + p.tx * off,
        dir: rng() < 0.5 ? [p.tx, p.tz] : [-p.tx, -p.tz],
        speed: 0.22 + rng() * 0.28,
        span: 6 + rng() * 16,
      });
    }
    // 赶驴的人 + 驴队（驿路上）
    if (r.id === 'e1' || r.id === 's1' || r.id === 'n1') {
      const p = samplePath(r.pts, 0.45 + rng() * 0.2);
      for (let i = 0; i < 4; i++) {
        person({ kind: 'donkey', x: p.x + p.tx * i * 3.4, z: p.z + p.tz * i * 3.4, dir: [p.tx, p.tz], speed: 0.28, span: 8 });
      }
      person({ kind: 'walker', x: p.x - p.tx * 6, z: p.z - p.tz * 6, dir: [p.tx, p.tz], speed: 0.3, span: 8 });
    }
  }
  // 村舍 / 田间
  for (const [hx, hz, r] of hamlets) {
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      person({
        kind: rng() < 0.5 ? 'walker' : rng() < 0.5 ? 'porter' : 'child',
        x: hx + (rng() - 0.5) * 60,
        z: hz + (rng() - 0.5) * 60,
        dir: [rng() < 0.5 ? -1 : 1, rng() < 0.5 ? -0.3 : 0.3],
        speed: 0.2 + rng() * 0.2,
        span: 3 + rng() * 8,
      });
    }
  }
  // 北郊扫墓的人（清明）
  for (let i = 0; i < (low ? 8 : 16); i++) {
    person({
      kind: rng() < 0.4 ? 'lady' : rng() < 0.5 ? 'scholar' : rng() < 0.6 ? 'child' : 'walker',
      x: -80 + (rng() - 0.5) * 260,
      z: -860 - rng() * 200,
      dir: [rng() < 0.5 ? -1 : 1, rng() < 0.5 ? -0.5 : 0.5],
      speed: 0.18 + rng() * 0.2,
      span: 4 + rng() * 10,
    });
  }

  /* ======================================================================== */
  /*  十、合并上屏                                                               */
  /* ======================================================================== */

  let draws = 0;
  let tris = 0;
  for (const [mat, geos] of B) {
    if (!geos.length) continue;
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = `suburb-${draws}`;
    mesh.frustumCulled = false;
    group.add(mesh);
    for (const g of geos) g.dispose();
    draws += 1;
    tris += merged.index ? merged.index.count / 3 : merged.attributes.position.count / 3;
  }

  // 田块（顶点色一张） + 田垄 / 田埂线
  if (fieldPos.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(fieldPos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(fieldCol, 3));
    geo.setIndex(fieldIdx);
    geo.computeBoundingSphere();
    group.add(new THREE.Mesh(geo, fieldMat));
    draws += 1;
  }
  if (ridgePos.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(ridgePos, 3));
    group.add(new THREE.LineSegments(geo, ridgeMat));
    draws += 1;
  }
  if (borderPos.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(borderPos, 3));
    group.add(new THREE.LineSegments(geo, borderMat));
    draws += 1;
  }

  if (treeSpecs.length) group.add(buildTrees(treeSpecs, ctx));

  group.userData.suburbs = {
    trees: treeSpecs.length,
    people: peopleCount,
    draws,
    tris: Math.round(tris),
  };
  return group;
}
