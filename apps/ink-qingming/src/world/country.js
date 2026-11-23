/**
 * country.js —— 郊野：长卷的卷首（清明时节、疏林薄雾、农舍田畴）。
 *
 * 长卷从西头起笔。汴河北岸（画面中段）是一片缓缓升高的坡地：
 * 五间茅草顶农舍聚成一个小村，篱笆院、柴垛、鸡窝、水井散落其间；
 * 村外的田畴用淡色田块 + 细墨线田垄画成，田埂上点几棵树；
 * 驮炭的驴队正从西边树林里出来，拐上沿河土路。
 * 南岸（画面下缘，离镜头最近）是一条土路，扫墓归来的人沿着它回城，
 * 几株垂柳从画面下缘伸进来，给近景压住脚。
 * 卷首最西端用树丛与雾收口，别让房子在画边上突然截断。
 *
 * 坐标：1 世界单位 = 1 米。岸顶 GROUND_Y = 1.2。
 * 北岸 z≈-60..-15（画面中段），南岸 z≈+26..+90（画面下缘 / 更近）。
 *
 * 契约：export function buildCountry(ctx) → THREE.Group（group.name='country'）
 * 人物通过 ctx.people.push({ kind, x, z, dir, span, speed, ... }) 交给 people.js。
 *
 * 性能：所有建筑/田块/篱笆按材质合并成 10 来个 Mesh；
 * 树走 flora.js 的全场景共享实例批次；人物只 push 数据、不建几何。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng } from '../lib/rand.js';
import { gableRoofGeometry } from '../lib/roof.js';
import { buildTrees } from '../lib/flora.js';
import { inkMat, planeMat, setInkWeight } from '../lib/materials.js';
import { GROUND_Y, ROAD } from '../layout.js';

const Y = GROUND_Y;
const TAU = Math.PI * 2;

/* -------------------------------------------------------------------------- */
/*  小工具                                                                      */
/* -------------------------------------------------------------------------- */

/** 沿折线取 z（这些折线的 x 单调）。 */
function pathZ(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, z0] = points[i - 1];
    const [x1, z1] = points[i];
    if (x <= x1) return z0 + ((z1 - z0) * (x - x0)) / (x1 - x0 || 1);
  }
  return points[points.length - 1][1];
}

/** 绕 y 轴旋转（与 three 的 rotateY 一致）后，把局部点变到世界坐标。 */
function toWorld(cx, cz, rot, lx, lz) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [cx + lx * c + lz * s, cz - lx * s + lz * c];
}

/** 往某个批次里塞一个盒子（会先旋再平移）。 */
function addBox(list, w, h, d, x, y, z, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  list.push(g);
}

/** 往某个批次里塞一段圆柱。 */
function addCyl(list, rTop, rBot, h, seg, x, y, z) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
  g.translate(x, y, z);
  list.push(g);
}

/** 折线 → 平面带状路（与 terrain.js 的 ribbon 同一做法，y 固定）。 */
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

/** 把折线两侧的边线压进线段数组（田埂、水沟边用）。 */
function pushOffsetLines(arr, points, offset, y) {
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * offset;
    const nz = (dx / len) * offset;
    arr.push(ax + nx, y, az + nz, bx + nx, y, bz + nz);
    arr.push(ax - nx, y, az - nz, bx - nx, y, bz - nz);
  }
}

/* -------------------------------------------------------------------------- */
/*  郊野                                                                        */
/* -------------------------------------------------------------------------- */

export function buildCountry(ctx) {
  const group = new THREE.Group();
  group.name = 'country';
  const low = ctx.quality === 'low';
  const rng = makeRng(20250404);
  const mats = ctx.mats;

  /* ---- 材质（尽量复用 ctx.mats，只给田、土墙、土路做几份新墨面） ---- */
  const earthMat = setInkWeight(inkMat(0xd5c39e), 0.22); // 夯土墙 / 坟土
  const roofMat = setInkWeight(mats.thatch.clone(), 0.3); // 茅草顶：压暗一点，屋顶该是画面里最重的一块
  roofMat.color.setHex(0x71583a);
  const eaveMat = setInkWeight(mats.thatchDark.clone(), 0.42);
  eaveMat.color.setHex(0x4c3a26);
  const strawMat = setInkWeight(
    new THREE.MeshLambertMaterial({ color: 0xb99a66, flatShading: true }),
    0.2,
  );
  const fieldMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    toneMapped: false,
  });
  const laneMat = setInkWeight(
    new THREE.MeshBasicMaterial({ color: 0xd9cbaa, toneMapped: false }),
    0.1,
  );
  const ditchMat = new THREE.MeshBasicMaterial({ color: 0xacb9a8, toneMapped: false });
  const ridgeMat = new THREE.LineBasicMaterial({
    color: 0x6d6f5a,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    toneMapped: false,
  });
  const borderMat = new THREE.LineBasicMaterial({
    color: 0x69684f,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    toneMapped: false,
  });

  /* ---- 按材质分的几何批次 ---- */
  const B = { earth: [], plaster: [], roof: [], eave: [], straw: [], wood: [], dark: [], stone: [], lane: [] };
  const treeSpecs = [];
  const fieldPos = [];
  const fieldCol = [];
  const fieldIdx = [];
  const ridgePos = [];
  const borderPos = [];
  const mists = [];
  const counters = { houses: 0, fields: 0, people: 0 };

  const person = (spec) => {
    if (Array.isArray(ctx.people)) {
      ctx.people.push(spec);
      counters.people += 1;
    }
  };
  const tree = (kind, x, z, h) => treeSpecs.push({ kind, x, z, y: Y, h });

  /* ======================================================================== */
  /*  一、农舍（土墙 + 茅草顶 + 篱笆院 + 柴垛 + 鸡窝 + 水井）                    */
  /* ======================================================================== */

  /** 一间农舍：薄石脚 → 土墙 → 门 / 窗 → 茅草顶。 */
  function addHouse({ x, z, w = 8, d = 5.6, h = 2.9, rot = 0, plaster = false, ruin = false }) {
    const base = Y + 0.16;
    if (ruin) {
      addRuin(x, z, rot);
      return;
    }
    counters.houses += 1;
    addBox(B.stone, w + 0.6, 0.16, d + 0.6, x, Y + 0.08, z, rot);

    const body = new THREE.BoxGeometry(w, h, d);
    body.rotateY(rot);
    body.translate(x, base + h / 2, z);
    (plaster ? B.plaster : B.earth).push(body);

    // 门开在南面（朝镜头），窗各偏一侧
    const [dx, dz] = toWorld(x, z, rot, 0, d / 2 + 0.06);
    addBox(B.dark, 1.0, 1.72, 0.14, dx, base + 0.86, dz, rot);
    for (const sx of [-1, 1]) {
      const [wx, wz] = toWorld(x, z, rot, sx * w * 0.29, d / 2 + 0.05);
      addBox(B.dark, 0.6, 0.68, 0.12, wx, base + h - 0.95, wz, rot);
    }

    // 茅草顶：茅草没有翼角起翘，举折也缓
    const rh = Math.min(w, d) * 0.42 + 0.35;
    const { roof, fascia } = gableRoofGeometry({
      width: w * 1.02,
      depth: d * 1.06,
      height: rh,
      overhang: 0.62,
      lift: 0.05,
      curve: 1.45,
      segU: 5,
      segV: 3,
      fascia: 0.1,
    });
    roof.rotateY(rot);
    roof.translate(x, base + h, z);
    B.roof.push(roof);
    fascia.rotateY(rot);
    fascia.translate(x, base + h, z);
    B.eave.push(fascia);
  }

  /** 半塌的土墙：两段高低不齐的夯土墙 + 倒下的梁 + 土堆。 */
  function addRuin(x, z, rot = 0) {
    const base = Y + 0.04;
    const wall = (lx, lz, wl, hh, extraRot) => {
      const [wx, wz] = toWorld(x, z, rot, lx, lz);
      addBox(B.earth, wl, hh, 0.42, wx, base + hh / 2, wz, rot + extraRot);
    };
    wall(-2.4, -1.3, 3.4, 1.9, 0);
    wall(1.5, -1.4, 2.6, 1.1, 0.05);
    wall(0.3, 1.9, 3.6, 0.65, 0.02);

    const [bx, bz] = toWorld(x, z, rot, 0.3, 0.3);
    addBox(B.dark, 3.4, 0.14, 0.16, bx, base + 0.1, bz, rot + 0.5);
    const [bx2, bz2] = toWorld(x, z, rot, -1.2, 1.5);
    addBox(B.dark, 2.2, 0.12, 0.14, bx2, base + 0.08, bz2, rot - 0.35);

    const pile = new THREE.SphereGeometry(1, 8, 4, 0, TAU, 0, Math.PI / 2);
    pile.scale(1.7, 0.5, 1.25);
    pile.rotateY(rot);
    const [px, pz] = toWorld(x, z, rot, 2.0, 0.5);
    pile.translate(px, Y, pz);
    B.earth.push(pile);
  }

  /** 一段篱笆：柱子按 ~1.6 米一根，两道横杆。 */
  function addFence(x0, z0, x1, z1) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.3) return;
    const ang = Math.atan2(-dz, dx);
    const n = Math.max(1, Math.round(len / 1.6));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      addBox(B.wood, 0.1, 1.12, 0.1, x0 + dx * t, Y + 0.56, z0 + dz * t);
    }
    for (const yy of [0.5, 0.96]) {
      addBox(B.wood, len, 0.06, 0.05, x0 + dx / 2, Y + yy, z0 + dz / 2, ang);
    }
  }

  /** 一圈篱笆院，南面留一个门。 */
  function addYard(x, z, w, d, rot = 0, gate = 1.7) {
    const hw = w / 2;
    const hd = d / 2;
    const run = (lx0, lz0, lx1, lz1) => {
      const [ax, az] = toWorld(x, z, rot, lx0, lz0);
      const [bx, bz] = toWorld(x, z, rot, lx1, lz1);
      addFence(ax, az, bx, bz);
    };
    run(-hw, -hd, hw, -hd);
    run(-hw, hd, -hw, -hd);
    run(hw, hd, hw, -hd);
    run(-hw, hd, -gate / 2, hd);
    run(gate / 2, hd, hw, hd);
  }

  function addWell(x, z) {
    addCyl(B.stone, 0.82, 0.94, 0.78, 10, x, Y + 0.39, z);
    addCyl(B.dark, 0.62, 0.62, 0.04, 10, x, Y + 0.79, z);
    addBox(B.wood, 0.12, 1.72, 0.12, x - 0.95, Y + 0.86, z);
    addBox(B.wood, 0.12, 1.72, 0.12, x + 0.95, Y + 0.86, z);
    addBox(B.wood, 2.1, 0.1, 0.1, x, Y + 1.68, z);
    addCyl(B.dark, 0.17, 0.15, 0.26, 8, x + 0.18, Y + 1.14, z);
  }

  /** 柴垛：圆锥茅草堆 + 一根木杆。 */
  function addHaystack(x, z, r = 1.05, h = 1.7, rot = 0) {
    const g = new THREE.CylinderGeometry(r * 0.16, r, h, 9);
    g.translate(x, Y + h / 2, z);
    B.straw.push(g);
    addBox(B.wood, 0.06, h * 0.6, 0.06, x, Y + h * 0.75, z, rot);
  }

  function addCoop(x, z, rot = 0) {
    addBox(B.wood, 1.5, 0.9, 1.1, x, Y + 0.45, z, rot);
    const { roof, fascia } = gableRoofGeometry({
      width: 1.9,
      depth: 1.5,
      height: 0.6,
      overhang: 0.16,
      lift: 0,
      curve: 1.2,
      segU: 2,
      segV: 2,
      fascia: 0.08,
    });
    roof.rotateY(rot);
    roof.translate(x, Y + 0.9, z);
    B.roof.push(roof);
    fascia.rotateY(rot);
    fascia.translate(x, Y + 0.9, z);
    B.eave.push(fascia);
  }

  /** 几捆靠在墙根的柴。 */
  function addWoodBundle(x, z, rot = 0, n = 4) {
    for (let i = 0; i < n; i++) {
      const [bx, bz] = toWorld(x, z, rot, 0, (i - (n - 1) / 2) * 0.3);
      const g = new THREE.CylinderGeometry(0.15, 0.15, 1.4, 6);
      g.rotateZ(Math.PI / 2);
      g.rotateY(rot);
      g.translate(bx, Y + 0.16 + (i % 2) * 0.24, bz);
      B.dark.push(g);
    }
  }

  /** 路边茶棚：四根木柱撑一片茅草顶，棚下一条矮桌。 */
  function addRoadStall(x, z, rot = 0) {
    const w = 4.2;
    const d = 3.2;
    const h = 2.15;
    for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) {
      const [px, pz] = toWorld(x, z, rot, lx, lz);
      addBox(B.wood, 0.12, h, 0.12, px, Y + h / 2, pz);
    }
    const { roof, fascia } = gableRoofGeometry({
      width: w + 1.0,
      depth: d + 1.0,
      height: 1.15,
      overhang: 0.28,
      lift: 0.02,
      curve: 1.25,
      segU: 3,
      segV: 2,
      fascia: 0.08,
    });
    roof.rotateY(rot);
    roof.translate(x, Y + h, z);
    B.roof.push(roof);
    fascia.rotateY(rot);
    fascia.translate(x, Y + h, z);
    B.eave.push(fascia);
    const [tx, tz] = toWorld(x, z, rot, 0, 0.1);
    addBox(B.wood, 2.0, 0.1, 0.7, tx, Y + 0.72, tz, rot);
    for (const s2 of [-1, 1]) {
      const [lx2, lz2] = toWorld(x, z, rot, s2 * 0.8, 0.1);
      addBox(B.wood, 0.1, 0.72, 0.1, lx2, Y + 0.36, lz2, rot);
    }
    addBox(B.wood, 1.6, 0.08, 0.4, tx, Y + 0.42, tz + 0.9, rot); // 条凳
  }

  /** 坟茔：土堆 + 石碑 + 供台 + 清明挂的白纸幡。 */
  function addGrave(x, z, rot = 0) {
    const mound = new THREE.SphereGeometry(1, 10, 5, 0, TAU, 0, Math.PI * 0.5);
    mound.scale(1.35, 0.52, 1.05);
    mound.rotateY(rot);
    mound.translate(x, Y + 0.02, z);
    B.earth.push(mound);

    const [sx, sz] = toWorld(x, z, rot, 0, 1.28);
    addBox(B.stone, 0.42, 0.66, 0.12, sx, Y + 0.35, sz, rot);
    const [tx, tz] = toWorld(x, z, rot, 0, 1.55);
    addBox(B.stone, 0.56, 0.2, 0.32, tx, Y + 0.16, tz, rot);

    const [px, pz] = toWorld(x, z, rot, 0.95, 0.85);
    addBox(B.wood, 0.05, 1.35, 0.05, px, Y + 0.68, pz);
    addBox(B.plaster, 0.3, 0.5, 0.02, px + 0.14, Y + 1.16, pz, rot + 0.22);
    addBox(B.plaster, 0.22, 0.34, 0.02, px + 0.22, Y + 0.88, pz, rot - 0.16);
  }

  /** 一座小木桥（跨田边水沟）：桥面 + 桥板 + 桥头石 + 简易栏杆。 */
  function addBridge(x, z, rot = Math.PI / 2, len = 4.4, wid = 2.4) {
    const deck = new THREE.BoxGeometry(len, 0.16, wid);
    deck.rotateY(rot);
    deck.translate(x, Y + 0.32, z);
    B.wood.push(deck);

    for (let i = -2; i <= 2; i++) {
      const [bx, bz] = toWorld(x, z, rot, (i * len) / 5, 0);
      addBox(B.dark, len / 5 - 0.1, 0.05, wid * 0.97, bx, Y + 0.41, bz, rot);
    }
    for (const s of [-1, 1]) {
      const [px, pz] = toWorld(x, z, rot, (s * len) / 2, 0);
      addBox(B.stone, 0.9, 0.4, wid + 0.4, px, Y + 0.16, pz, rot);
      for (const t of [-0.4, 0, 0.4]) {
        const [rx, rz] = toWorld(x, z, rot, (t * len) / 2, (s * wid) / 2);
        addBox(B.wood, 0.08, 0.7, 0.08, rx, Y + 0.72, rz);
      }
      const [lx, lz] = toWorld(x, z, rot, 0, (s * wid) / 2);
      addBox(B.wood, len * 0.92, 0.07, 0.06, lx, Y + 1.02, lz, rot);
    }
  }

  /* ======================================================================== */
  /*  二、田畴（淡色小田块 + 细墨线田垄 + 田埂树）                              */
  /* ======================================================================== */

  const FIELD_COLORS = ['#d6cdb2', '#d0c9ae', '#dad2b8', '#cdc8ac', '#d4cbab', '#d0ccb3'];

  /**
   * 一块田：四角略歪的淡色四边形（2 个三角面），四周压一条边界线，
   * 中间按 ~2 米间距拉细墨线作田垄。田块都不大，像画里一小格一小格的田。
   */
  function addField({ x, z, w, d, rot = 0, color, ridges = true, ridgeAlongX = false }) {
    counters.fields += 1;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const local = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const W = w / 2;
    const D = d / 2;
    const jitter = () => (rng() - 0.5) * 0.5;
    const corners = [
      [-W + jitter(), -D + jitter()],
      [W + jitter(), -D + jitter()],
      [W + jitter(), D + jitter()],
      [-W + jitter(), D + jitter()],
    ].map(([lx, lz]) => local(lx, lz));

    const base = new THREE.Color(color);
    const tone = 0.96 + rng() * 0.08;
    const y = Y + 0.022;
    const i0 = fieldPos.length / 3;
    for (const [px, pz] of corners) {
      const vt = tone * (0.955 + rng() * 0.09); // 每个角明度略不同，田块才不是一块死色
      fieldPos.push(px, y, pz);
      fieldCol.push(base.r * vt, base.g * vt, base.b * vt);
    }
    fieldIdx.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2);

    // 田埂：四边的细线
    const yb = Y + 0.032;
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      borderPos.push(a[0], yb, a[1], b[0], yb, b[1]);
    }

    if (!ridges) return;
    // 田垄：沿田块长边方向拉细墨线，带一点手画的弯；相邻田垄方向交错才像耕地
    const yl = Y + 0.029;
    const step = 2.0;
    const span = (ridgeAlongX ? W : D) - 0.7;
    const across = (ridgeAlongX ? D : W) - 0.9;
    const segs = Math.max(2, Math.round((span * 2) / 4.5));
    for (let a = -across; a <= across; a += step) {
      for (let k = 0; k < segs; k++) {
        const t0 = k / segs;
        const t1 = (k + 1) / segs;
        const u0 = -span + span * 2 * t0;
        const u1 = -span + span * 2 * t1;
        const o0 = Math.sin(a * 1.7 + t0 * 5.4) * 0.18;
        const o1 = Math.sin(a * 1.7 + t1 * 5.4) * 0.18;
        const [ax, az] = ridgeAlongX ? local(u0, a + o0) : local(a + o0, u0);
        const [bx, bz] = ridgeAlongX ? local(u1, a + o1) : local(a + o1, u1);
        ridgePos.push(ax, yl, az, bx, yl, bz);
      }
    }
  }

  /* ======================================================================== */
  /*  三、雾带（ctx.tex.mist + planeMat，ctx.onTick 缓慢漂移）                    */
  /* ======================================================================== */

  /**
   * 雾贴图：ctx.tex.mist 是「墨色雾」，RGB 很暗，直接当雾会发黑。
   * 这里把它当遮罩，染成绢色再叠两遍压浓，变成一层能盖在树上的淡雾。
   */
  function mistMap(repeat) {
    const src = ctx.tex.mist.image;
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d');
    g.fillStyle = '#f6eeda';
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.8;
    g.drawImage(c, 0, 0);
    g.drawImage(c, 0, 0);
    g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, 1);
    return tex;
  }

  function addMist({ x, y, z, w, h, opacity, repeat = 2.6, rot = 0, phase = 0, amp = 8, color = 0xfff7e6 }) {
    const map = mistMap(repeat);
    const mat = planeMat({ map, color, opacity });
    // 雾是「加光」：盖在树、田、房子上把它们提亮化进纸里，落在纸面上则几乎看不出
    mat.blending = THREE.AdditiveBlending;
    mat.fog = false;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.scale.set(w, h, 1);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rot;
    mesh.renderOrder = 22;
    group.add(mesh);
    mists.push({ mesh, map, baseX: x, baseZ: z, phase, amp });
  }

  /** 一条田间小路（比土路窄，贴着绢面）。 */
  function addLane(points, width = 2.4) {
    B.lane.push(ribbon(points, width / 2, Y + 0.045));
  }

  /* ======================================================================== */
  /*  四、摆场                                                                    */
  /* ======================================================================== */

  // —— 4.1 北岸村落（画面中段；z≈-36..-48，x≈-170..-131） ——
  addHouse({ x: -167, z: -40, w: 9.4, d: 6.2, h: 3.0, rot: 0.05 });
  addHouse({ x: -157, z: -45, w: 8.2, d: 5.6, h: 2.8, rot: -0.12 });
  addHouse({ x: -147, z: -37.5, w: 7.6, d: 5.2, h: 2.7, rot: 0.2, plaster: true });
  addHouse({ x: -138, z: -44.5, w: 8.6, d: 5.8, h: 2.9, rot: -0.05 });
  addHouse({ x: -131, z: -36.5, w: 4.4, d: 3.6, h: 2.2, rot: 0.28 });
  addHouse({ x: -154, z: -34, rot: 0.15, ruin: true });

  addYard(-167, -40, 13.0, 9.6, 0.05);
  addYard(-147, -37.5, 8.6, 7.4, 0.2, 1.5);
  addYard(-138, -44.5, 9.8, 7.8, -0.05);
  addYard(-131, -36.5, 5.6, 5.0, 0.28, 1.3);

  addWell(-162.2, -41.4);
  addCoop(-170.6, -42.6, 0.24);
  addHaystack(-164.6, -47.2, 1.15, 1.85);
  addHaystack(-153.4, -47.6, 1.0, 1.55, 0.4);
  addHaystack(-143.6, -41.4, 0.95, 1.45);
  addHaystack(-134.2, -42.4, 0.9, 1.3, 0.8);
  addWoodBundle(-169.4, -37.6, 0.1, 5);
  addWoodBundle(-145.2, -42.6, -0.35, 4);
  addRoadStall(-121.6, -23.6, 0.12);

  // 远处几间草屋（雾里只看一个屋顶轮廓）
  addHouse({ x: -181, z: -99, w: 5.4, d: 4.0, h: 2.3, rot: 0.16 });
  addHouse({ x: -151, z: -113, w: 5.0, d: 4.2, h: 2.2, rot: -0.1 });
  addHouse({ x: -121, z: -90, w: 4.2, d: 3.4, h: 2.0, rot: 0.3 });

  // 村口的土路（从沿河土路拐进村里）+ 田间小路
  addLane([[-155.4, -18.6], [-155.0, -22.0], [-154.8, -25.6], [-155.4, -29.0], [-156.2, -33.0], [-156.8, -36.0]], 2.5);
  addLane([[-156.0, -31.0], [-147.0, -32.2], [-139.0, -33.6]], 1.9);
  addLane([[-118.0, -20.6], [-116.0, -27.0], [-114.0, -35.0]], 1.9);
  addLane([[-181.0, -19.4], [-181.6, -26.0], [-182.4, -33.0]], 1.7);

  // 田边水沟 + 小木桥
  const ditchPts = [
    [-168, -26.8],
    [-150, -27.2],
    [-132, -27.6],
    [-124, -27.8],
  ];
  const ditch = new THREE.Mesh(ribbon(ditchPts, 0.62, Y + 0.016), ditchMat);
  ditch.name = 'country-ditch';
  group.add(ditch);
  pushOffsetLines(borderPos, ditchPts, 0.66, Y + 0.02);
  addBridge(-155.2, -27.2, Math.PI / 2, 4.4, 2.4);

  // —— 4.2 田畴：北岸坡上拼成一片小田块，田埂一线压一线 ——
  let fieldTone = 0;
  const nextFieldColor = () => FIELD_COLORS[fieldTone++ % FIELD_COLORS.length];
  const fieldRows = [
    { z: -62, d: 17 },
    { z: -80, d: 19 },
    { z: -99, d: 18 },
    { z: -119, d: 20 },
  ];
  for (const row of fieldRows) {
    let fx = -192;
    while (fx < -104) {
      const w = 5.5 + rng() * 4;
      addField({
        x: fx + w / 2,
        z: row.z + (rng() - 0.5) * 2.6,
        w,
        d: row.d + (rng() - 0.5) * 3.2,
        rot: (rng() - 0.5) * 0.07,
        color: nextFieldColor(),
        ridges: !low || fieldTone % 2 === 0,
        ridgeAlongX: fieldTone % 3 === 0,
      });
      fx += w + 0.15;
    }
  }
  // 村东的两块田（离镜头近一点，让人看清田垄）
  addField({ x: -110, z: -44.5, w: 11.5, d: 13.5, rot: 0.12, color: nextFieldColor() });
  addField({ x: -104.5, z: -60, w: 8, d: 14, rot: -0.14, color: nextFieldColor() });
  // 屋后的菜畦（小、密，村里的一点绿）
  addField({ x: -160.6, z: -35.4, w: 4.6, d: 6.2, rot: 0.1, color: '#c8c8a4' });
  addField({ x: -152.2, z: -33.8, w: 3.8, d: 5.2, rot: -0.16, color: '#c5c6a2' });
  // 南岸的田（镜头更近，俯得低时才看得到）
  const southFields = [
    { x: -172, z: 50, w: 12, d: 18, rot: 0.1 },
    { x: -150, z: 58, w: 14, d: 20, rot: -0.06 },
    { x: -128, z: 52, w: 11, d: 18, rot: 0.14 },
    { x: -106, z: 62, w: 10, d: 18, rot: -0.1 },
  ];
  for (const f of southFields) addField({ ...f, color: nextFieldColor(), ridges: !low });

  // —— 4.3 树（疏林薄雾：行道柳、村口大槐、坡地疏林、坟前松） ——
  // 沿河土路边的行道柳（略退到路北，不挡路）
  for (let x = -186; x <= -100; x += 8.8) {
    const z = pathZ(ROAD.main, x) - 2.6 - rng() * 1.8;
    tree(rng() < 0.74 ? 'willow' : 'locust', x + (rng() - 0.5) * 1.6, z, 6.4 + rng() * 2.2);
  }
  // 村中与村外（大槐树是村口的主角，杏花给清明一点颜色）
  tree('locust', -157.4, -30.9, 9.2);
  tree('blossom', -172.6, -36.4, 5.4);
  tree('locust', -152.4, -41.6, 7.4);
  tree('blossom', -163.8, -48.4, 5.0);
  tree('locust', -142.6, -35.2, 6.8);
  tree('pine', -176.4, -43.8, 7.6);
  tree('blossom', -135.2, -39.6, 4.8);
  tree('locust', -146.6, -49.4, 6.6);
  // 田埂上的树
  const fieldTrees = [
    ['locust', -184, -55, 6.8],
    ['blossom', -175, -61, 5.2],
    ['locust', -164, -64, 7.1],
    ['pine', -157, -76, 7.4],
    ['locust', -145, -57, 6.5],
    ['pine', -139, -83, 7.8],
    ['locust', -127, -68, 7.0],
    ['blossom', -119, -56, 5.4],
    ['locust', -111, -73, 6.6],
    ['pine', -186, -88, 7.2],
    ['locust', -128, -104, 6.4],
    ['blossom', -101, -63, 5.0],
  ];
  for (const [k, x, z, h] of fieldTrees) tree(k, x, z, h);

  // 坟前的松柏
  tree('pine', -127.2, -55.4, 7.8);
  tree('pine', -121.6, -58.2, 7.0);
  tree('pine', -130.4, -58.8, 6.4);

  // 西边收口的树丛：三五棵一丛，越往西越密，把卷首化进纸里
  const westClumps = low ? 7 : 12;
  for (let c = 0; c < westClumps; c++) {
    const cx = -198 - rng() * 36;
    const cz = -26 - rng() * 118;
    const n = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const x = cx + (rng() - 0.5) * 13;
      const z = cz + (rng() - 0.5) * 13;
      tree(rng() < 0.66 ? 'pine' : 'locust', x, z, 5.4 + rng() * 4.2);
    }
  }
  // 村后与东侧的疏林
  const grove = [
    [-196, -54, 'locust'],
    [-192, -62, 'pine'],
    [-188, -71, 'locust'],
    [-194, -79, 'pine'],
    [-184, -60, 'blossom'],
    [-133, -60, 'locust'],
    [-127, -55, 'pine'],
    [-123, -63, 'locust'],
    [-116, -70, 'pine'],
    [-109, -57, 'blossom'],
    [-103, -66, 'locust'],
    [-98, -77, 'pine'],
  ];
  for (const [x, z, kind] of grove) tree(kind, x, z, 5.4 + rng() * 2.6);
  // 田里的草垛（春耕前后堆在田头）
  addHaystack(-178.6, -74.4, 1.2, 1.9);
  addHaystack(-158.2, -88.6, 1.05, 1.6, 0.5);
  addHaystack(-136.8, -73.2, 0.95, 1.5);
  addHaystack(-121.4, -101.2, 1.1, 1.7, 0.3);

  // 东边（往河市去的方向）用几棵树收住边界
  tree('willow', -99.2, -24.6, 7.6);
  tree('locust', -97.4, -37.2, 7.0);
  tree('pine', -100.4, -57.8, 7.4);
  tree('blossom', -96.6, -46.3, 5.2);

  // 几棵高过屋脊的老树，给村子的天际线一点起伏
  tree('locust', -128.6, -63.4, 10.2);
  tree('pine', -112.4, -48.6, 9.6);
  tree('locust', -158.8, -54.2, 9.8);
  tree('locust', -178.2, -70.2, 10.4);

  // 远处北坡的树（雾里一排排树影，成片才像远林）
  const farClumps = low ? 5 : 9;
  for (let c = 0; c < farClumps; c++) {
    const cx = -206 + rng() * 108;
    const cz = -128 - rng() * 58;
    for (let i = 0; i < 3; i++) {
      tree(rng() < 0.72 ? 'pine' : 'locust', cx + (rng() - 0.5) * 16, cz + (rng() - 0.5) * 14, 5.0 + rng() * 3.0);
    }
  }
  // 卷首往东（河市那侧）的远远一带树影，把画面右上角也收一收
  for (let i = 0; i < (low ? 3 : 5); i++) {
    tree(rng() < 0.62 ? 'pine' : 'locust', -118 + rng() * 26, -146 - rng() * 42, 5.0 + rng() * 2.6);
  }

  // —— 4.4 南岸（画面下缘；扫墓归来的队伍沿土路往东回城） ——
  // 临河小径：贴着南岸走的一条土路，扫墓的队伍沿它回城（相机压得低时正好在画面下缘）
  const southPath = [
    [-190, 26.9],
    [-160, 28.0],
    [-130, 29.1],
    [-98, 30.3],
  ];
  addLane(southPath, 1.8);
  // 下缘的垂柳：从画面底边伸进来，压住近景（在小径外侧）
  tree('willow', -173.8, 29.6, 8.8);
  tree('willow', -160.6, 29.3, 8.0);
  tree('willow', -114.0, 30.0, 7.8);
  tree('willow', -101.4, 31.0, 8.6);
  tree('locust', -129.0, 32.6, 5.6);
  tree('blossom', -99.0, 34.6, 4.8);

  // 南岸的草屋（大部分在画面外，展卷俯看时才露出来）
  addHouse({ x: -158, z: 46.5, w: 7.2, d: 5.2, h: 2.7, rot: 0.1 });
  addHouse({ x: -136, z: 52.5, w: 8.0, d: 5.6, h: 2.8, rot: -0.08 });
  addHouse({ x: -121, z: 43.5, w: 4.2, d: 3.4, h: 2.0, rot: 0.3 });
  addHouse({ x: -147, z: 57.0, rot: 0.2, ruin: true });
  addYard(-136, 52.5, 9.2, 7.2, -0.08);
  addHaystack(-152.2, 49.8, 1.1, 1.7);
  addHaystack(-128.6, 49.2, 0.9, 1.35, 0.5);
  addLane([[-146.0, 36.0], [-149.0, 41.6], [-151.4, 47.4], [-153.2, 52.6]], 2.2);
  addLane([[-129.8, 35.2], [-131.6, 41.8], [-133.6, 48.6]], 2.0);
  tree('locust', -163.4, 43.2, 6.4);
  tree('blossom', -143.8, 49.6, 4.8);
  tree('locust', -127.0, 46.2, 6.0);
  tree('pine', -117.6, 56.4, 6.6);
  tree('blossom', -107.2, 42.0, 5.0);

  // 坟茔：村外坡上两座，松柏围着，清明挂了白纸
  addGrave(-126.0, -51.6, 0.12);
  addGrave(-121.2, -54.2, -0.1);

  // —— 4.5 人物（交给 people.js 动画） ——
  // 扫墓归来的队伍：一顶轿子、一匹马、五个人，沿南岸土路往东走
  const southZ = (x) => pathZ(southPath, x) + 0.3; // 沿临河小径走，画面下缘才看得见
  person({ kind: 'palanquin', x: -149, z: southZ(-149), dir: [1, 0.03], speed: 0.3, span: 28 });
  person({ kind: 'rider', x: -143.4, z: southZ(-143.4), dir: [1, 0.02], speed: 0.34, span: 26 });
  person({ kind: 'walker', x: -153.2, z: southZ(-153.2), dir: [1, 0.05], speed: 0.4, span: 30 });
  person({ kind: 'walker', x: -156.6, z: southZ(-156.6), dir: [1, 0.05], speed: 0.38, span: 30 });
  person({ kind: 'child', x: -146.8, z: southZ(-146.8) + 0.6, dir: [1, 0.03], speed: 0.5, span: 22 });
  person({ kind: 'lady', x: -140.6, z: southZ(-140.6), dir: [1, 0.02], speed: 0.36, span: 24 });
  person({ kind: 'walker', x: -136.9, z: southZ(-136.9), dir: [1, 0.02], speed: 0.42, span: 32 });
  // 临河小径上的行人（画面最下缘的一点动静）
  person({ kind: 'walker', x: -167.2, z: southZ(-167.2) + 2.6, dir: [1, 0.06], speed: 0.4, span: 7 });
  person({ kind: 'porter', x: -119.4, z: southZ(-119.4) - 2.2, dir: [-1, 0.06], speed: 0.42, span: 8 });
  person({ kind: 'child', x: -106.2, z: southZ(-106.2) + 2.0, dir: [1, 0.1], speed: 0.6, span: 5 });

  // 驮炭的驴队：七头驴 + 两个赶驴人，从西边树林拐上沿河土路往东
  const caravan = [
    ['donkey', -186.2, -43.4, [1, 0.62]],
    ['donkey', -181.4, -38.6, [1, 0.58]],
    ['donkey', -176.0, -33.8, [1, 0.5]],
    ['donkey', -170.4, -28.8, [1, 0.42]],
    ['donkey', -164.6, -24.8, [1, 0.28]],
    ['donkey', -158.2, -22.0, [1, 0.14]],
    ['donkey', -150.2, -20.4, [1, 0.05]],
    ['walker', -190.0, -46.8, [1, 0.64]],
    ['walker', -144.6, -19.9, [1, 0.03]],
  ];
  for (let i = 0; i < caravan.length; i++) {
    const [kind, x, z, dir] = caravan[i];
    person({ kind, x, z, dir, speed: 0.32 + (i % 3) * 0.04, span: 10 + (i % 4) * 2 });
  }

  // 田里、村口的农夫
  person({ kind: 'walker', x: -163.2, z: -58.2, dir: [1, 0.2], speed: 0.26, span: 5 });
  person({ kind: 'walker', x: -149.4, z: -66.4, dir: [-1, 0.3], speed: 0.24, span: 6 });
  person({ kind: 'porter', x: -138.6, z: -57.4, dir: [1, 0], speed: 0.3, span: 8 });
  person({ kind: 'walker', x: -171.6, z: -64.2, dir: [1, 0.1], speed: 0.22, span: 5 });
  person({ kind: 'child', x: -166.8, z: -38.6, dir: [1, 0.2], speed: 0.6, span: 3.4 });
  person({ kind: 'scholar', x: -155.0, z: -40.2, dir: [1, 0], speed: 0.2, span: 0 });

  // 沿河土路上的行人
  person({ kind: 'walker', x: -184.4, z: -17.4, dir: [1, 0], speed: 0.5, span: 12 });
  person({ kind: 'porter', x: -174.2, z: -17.9, dir: [1, 0], speed: 0.46, span: 14 });
  person({ kind: 'monk', x: -166.0, z: -18.2, dir: [1, 0], speed: 0.38, span: 10 });
  person({ kind: 'walker', x: -155.4, z: -18.7, dir: [-1, 0], speed: 0.44, span: 9 });
  person({ kind: 'porter', x: -145.2, z: -19.1, dir: [1, 0], speed: 0.5, span: 12 });
  person({ kind: 'child', x: -160.4, z: -24.6, dir: [1, 0.3], speed: 0.62, span: 4 });
  person({ kind: 'vendor', x: -118.2, z: -21.4, dir: [1, 0], speed: 0.2, span: 0 });
  person({ kind: 'scholar', x: -112.2, z: -20.7, dir: [1, 0], speed: 0.36, span: 8 });
  person({ kind: 'lady', x: -136.2, z: -19.4, dir: [-1, 0], speed: 0.36, span: 7 });
  person({ kind: 'walker', x: -105.4, z: -20.9, dir: [1, 0], speed: 0.48, span: 10 });

  // —— 4.6 薄雾：三层横雾 + 西头一片雾墙，把树和房子化进纸里 ——
  addMist({ x: -152, y: 3.6, z: -96, w: 330, h: 20, opacity: 0.5, repeat: 3.0, phase: 0.0, amp: 13 });
  addMist({ x: -162, y: 6.5, z: -142, w: 400, h: 30, opacity: 0.42, repeat: 2.4, phase: 1.9, amp: 18 });
  addMist({ x: -206, y: 9, z: -50, w: 78, h: 28, opacity: 0.34, repeat: 1.5, phase: 3.4, amp: 4 });

  /* ======================================================================== */
  /*  五、合并 & 上屏                                                             */
  /* ======================================================================== */

  function addMerged(name, geos, mat) {
    if (!geos.length) return;
    const merged = mergeGeometries(geos, false);
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = name;
    group.add(mesh);
    for (const g of geos) g.dispose();
  }

  addMerged('country-earth', B.earth, earthMat);
  addMerged('country-plaster', B.plaster, mats.wallPlaster);
  addMerged('country-roofs', B.roof, roofMat);
  addMerged('country-straw', B.straw, strawMat);
  addMerged('country-eaves', B.eave, eaveMat);
  addMerged('country-wood', B.wood, mats.wood);
  addMerged('country-wood-dark', B.dark, mats.woodDark);
  addMerged('country-stone', B.stone, mats.stoneShade);
  addMerged('country-lanes', B.lane, laneMat);

  if (fieldPos.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(fieldPos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(fieldCol, 3));
    geo.setIndex(fieldIdx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, fieldMat);
    mesh.name = 'country-fields';
    group.add(mesh);
  }
  if (ridgePos.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(ridgePos, 3));
    const lines = new THREE.LineSegments(geo, ridgeMat);
    lines.name = 'country-ridges';
    group.add(lines);
  }
  if (borderPos.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(borderPos, 3));
    const lines = new THREE.LineSegments(geo, borderMat);
    lines.name = 'country-borders';
    group.add(lines);
  }

  // 树：走 flora 的全场景共享实例批次（挂到 scene 上，不占本模块 draw call）
  if (treeSpecs.length) group.add(buildTrees(treeSpecs, ctx));

  // 雾：慢慢漂
  ctx.onTick?.((time) => {
    for (const m of mists) {
      m.mesh.position.x = m.baseX + Math.sin(time * 0.016 + m.phase) * m.amp;
      m.mesh.position.z = m.baseZ + Math.sin(time * 0.009 + m.phase * 1.7) * m.amp * 0.3;
      m.map.offset.x = time * 0.0035 + m.phase;
    }
  });

  group.userData.country = {
    houses: counters.houses,
    fields: counters.fields,
    trees: treeSpecs.length,
    people: counters.people,
  };
  return group;
}
