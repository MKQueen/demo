/**
 * bridge.js —— 虹桥（无柱木拱）与州桥（御街石拱桥）。
 *
 * 契约：export function buildBridge(ctx) → THREE.Group（name = 'bridge'）。
 *
 * 第二轮：虹桥放大到 span=58 / width=13 / deckY=9.6，默认镜头从东侧 3/4 看
 * （az≈0.95），所以东侧立面必须读得出「拱」：
 *   - 7 道加粗的弧形木拱肋（两层错缝叠梁，像画里的贯木拱）+ 节点木块；
 *   - 拱与桥面之间留出大块负形，只靠短柱和斜撑连着，能透过拱架看见水；
 *   - 桥头四根朱幡华表、桥心高望柱、6 个桥面小摊；
 *   - 桥上 120 人。
 * 州桥：御街跨汴河的石拱桥，台阶式桥面 + 石栏板望柱 + 桥下石拱圈，桥上 30 人。
 *
 * 颜色：结构仍是木/石的本色；幡、布棚、灯笼用 ctx.mats 的 banner / clothOchre /
 * clothBlue / lantern 单独合并成 4 张网，给画面加淡赭、花青、朱砂的点缀。
 */
import * as THREE from 'three';
import { mergeGeometries } from '../lib/merge-safe.js';
import * as P from '../lib/palette.js';
import { BRIDGE, ZHOUQIAO, GROUND_Y, WATER_Y, riverZ, southBankZ, northBankZ } from '../layout.js';
import { makeRng } from '../lib/rand.js';

/* -------------------------------------------------------------------------- */
/*  虹桥参数                                                                    */
/* -------------------------------------------------------------------------- */

const BX = BRIDGE.x;
const HALF_W = BRIDGE.width / 2; // 6.5
const BZ = riverZ(BX); // 桥心 z（≈6.27）
const SPAN = BRIDGE.span; // 58
const Z_S = BZ + SPAN / 2;
const Z_N = BZ - SPAN / 2;
const DECK_Y = BRIDGE.deckY; // 9.6
const RISE = DECK_Y - GROUND_Y; // 8.4
const DECK_T = 0.5;
const RAIL_H = BRIDGE.railing;
const WATER_S = southBankZ(BX);
const WATER_N = northBankZ(BX);
const ARCH_SPRING = WATER_Y + 0.1;
const ARCH_CROWN = WATER_Y + BRIDGE.rise * 0.545; // ≈8.8，正好贴桥板底
const MAT_BRIDGE = 0;

/* -------------------------------------------------------------------------- */
/*  州桥参数                                                                    */
/* -------------------------------------------------------------------------- */

const QX = ZHOUQIAO.x;
const QZ = ZHOUQIAO.z;
const QSPAN = ZHOUQIAO.span;
const QW = ZHOUQIAO.width;
const Q_ZS = QZ + QSPAN / 2;
const Q_ZN = QZ - QSPAN / 2;
const Q_RISE = ZHOUQIAO.rise;
const Q_WATER_S = southBankZ(QX);
const Q_WATER_N = northBankZ(QX);
const Q_ARCH_SPRING = WATER_Y + 0.05;
const Q_ARCH_CROWN = GROUND_Y + Q_RISE - 0.72;
const Q_STEP = 0.2;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** z → 虹桥桥面高。 */
export function deckY(z) {
  const u = clamp01((Z_S - z) / SPAN);
  return GROUND_Y + RISE * Math.sin(Math.PI * u);
}

/** z → 虹桥拱肋高（只在跨水的 42 米里拱起，拱脚落在水边）。 */
function archY(z) {
  const u = clamp01((WATER_S - z) / (WATER_S - WATER_N));
  return ARCH_SPRING + (ARCH_CROWN - ARCH_SPRING) * Math.pow(Math.sin(Math.PI * u), 0.92);
}

/** z → 州桥桥面平滑高。 */
function qDeckY(z) {
  const u = clamp01((Q_ZS - z) / QSPAN);
  return GROUND_Y + Q_RISE * Math.sin(Math.PI * u);
}

/** z → 州桥台阶高（量化成一级一级的石阶）。 */
function qStepY(z) {
  return Math.round(qDeckY(z) / Q_STEP) * Q_STEP;
}

/** z → 州桥石拱圈高。 */
function qArchY(z) {
  const u = clamp01((Q_WATER_S - z) / (Q_WATER_S - Q_WATER_N));
  return Q_ARCH_SPRING + (Q_ARCH_CROWN - Q_ARCH_SPRING) * Math.pow(Math.sin(Math.PI * u), 0.8);
}

/* -------------------------------------------------------------------------- */
/*  颜色与几何小工具                                                            */
/* -------------------------------------------------------------------------- */

const C = {
  deck: 0x6c5837,
  deckDark: 0x513f27,
  beam: 0x45361f,
  beamDark: 0x2f2416,
  post: 0x4d3c24,
  rail: 0x3b2d1a,
  wood: 0x755c36,
  stone: 0x8f8471,
  stoneDark: 0x776d5b,
  stoneLight: 0xa2977f,
  brick: 0x8b7f6c,
  brickDark: 0x746a59,
  mat: 0x4e4128,
  goods: 0x5e5034,
  goodsDark: 0x493d28,
  ink: 0x2f3a34,
  tile: 0x4f5854,
  tileDark: 0x3e4643,
};

const _euler = new THREE.Euler();
const _m4 = new THREE.Matrix4();

function place(geo, o = {}) {
  if (o.rx || o.ry || o.rz) {
    _euler.set(o.rx || 0, o.ry || 0, o.rz || 0, 'XYZ');
    _m4.makeRotationFromEuler(_euler);
    _m4.setPosition(o.x || 0, o.y || 0, o.z || 0);
  } else {
    _m4.identity().setPosition(o.x || 0, o.y || 0, o.z || 0);
  }
  geo.applyMatrix4(_m4);
  return geo;
}

function colorize(geo, color) {
  const c = color instanceof THREE.Color ? color : new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!geo.attributes.normal) geo.computeVertexNormals();
  return geo;
}

function boxGeo(w, h, d, color, o = {}) {
  return colorize(place(new THREE.BoxGeometry(w, h, d), o), color);
}
function cylGeo(rTop, rBot, h, seg, color, o = {}) {
  return colorize(place(new THREE.CylinderGeometry(rTop, rBot, h, seg), o), color);
}
function coneGeo(r, h, seg, color, o = {}) {
  return colorize(place(new THREE.ConeGeometry(r, h, seg), o), color);
}
function sphereGeo(r, wSeg, hSeg, color, o = {}) {
  return colorize(place(new THREE.SphereGeometry(r, wSeg, hSeg), o), color);
}

function beamGeo(a, b, w, h, color) {
  const A = new THREE.Vector3(a[0], a[1], a[2]);
  const B = new THREE.Vector3(b[0], b[1], b[2]);
  const dir = new THREE.Vector3().subVectors(B, A);
  const len = dir.length();
  if (len < 1e-4) return null;
  const geo = new THREE.BoxGeometry(len, h || 0.08, w || 0.08);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5),
    q,
    new THREE.Vector3(1, 1, 1),
  );
  geo.applyMatrix4(m);
  return colorize(geo, color);
}

/** 两条边线之间的带子。 */
function stripGeo(rows, color) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i < rows.length; i++) {
    const [a, b] = rows[i];
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    uv.push(i / rows.length, 0, i / rows.length, 1);
  }
  for (let i = 0; i < rows.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return colorize(geo, color);
}

function mergeParts(parts) {
  const list = parts.filter(Boolean);
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  return mergeGeometries(list, false);
}

/** 一张从横杆垂下来的布幡（原点在上缘中点，略微弯一点）。 */
function clothBannerGeo(w, h) {
  const geo = new THREE.PlaneGeometry(w, h, 2, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = (h / 2 - y) / h;
    pos.setZ(i, Math.sin(t * Math.PI) * 0.12 + Math.sin(x * 2.6) * 0.03);
    pos.setX(i, x + t * 0.05);
  }
  geo.translate(0, -h / 2, 0);
  geo.computeVertexNormals();
  return colorize(geo, 0xffffff);
}

/* -------------------------------------------------------------------------- */
/*  虹桥：桥面 / 拱肋 / 栏杆 / 华表 / 摊                                        */
/* -------------------------------------------------------------------------- */

function stations(step = 1.0) {
  const rows = [];
  const n = Math.max(2, Math.round(SPAN / step));
  for (let i = 0; i <= n; i++) rows.push(Z_N + (SPAN * i) / n);
  return rows;
}

function buildDeck(parts, accents) {
  const zs = stations(1.0);
  const top = [];
  const bot = [];
  const left = [];
  const right = [];
  for (const z of zs) {
    const y = deckY(z);
    top.push([[BX - HALF_W, y, z], [BX + HALF_W, y, z]]);
    bot.push([[BX - HALF_W, y - DECK_T, z], [BX + HALF_W, y - DECK_T, z]]);
    left.push([[BX - HALF_W, y, z], [BX - HALF_W, y - DECK_T, z]]);
    right.push([[BX + HALF_W, y, z], [BX + HALF_W, y - DECK_T, z]]);
  }
  parts.push(stripGeo(top, C.deck));
  parts.push(stripGeo(bot, C.beamDark));
  parts.push(stripGeo(left, C.deckDark));
  parts.push(stripGeo(right, C.deckDark));
  // 横木 + 板缝
  for (let z = Z_N + 0.9; z < Z_S - 0.7; z += 1.9) {
    parts.push(beamGeo([BX - HALF_W + 0.12, deckY(z) + 0.04, z], [BX + HALF_W - 0.12, deckY(z) + 0.04, z], 0.18, 0.1, C.deckDark));
  }
  for (const off of [-3.4, 0, 3.4]) {
    for (let i = 0; i < zs.length - 1; i++) {
      const z0 = zs[i];
      const z1 = zs[i + 1];
      parts.push(beamGeo([BX + off, deckY(z0) + 0.035, z0], [BX + off, deckY(z1) + 0.035, z1], 0.07, 0.035, C.beamDark));
    }
  }
  // 桥心一个方胜纹装饰（俯视时的一点图案）
  const cz = BZ;
  const cy = deckY(cz) + 0.05;
  for (const [dx, dz, w, d] of [
    [0, 0, 3.2, 0.12],
    [0, 0, 0.12, 3.2],
    [1.5, 1.5, 0.1, 2.0],
    [-1.5, -1.5, 0.1, 2.0],
  ]) {
    parts.push(boxGeo(w, 0.03, d, C.deckDark, { x: BX + dx, y: cy, z: cz + dz, ry: dz && dx ? Math.PI / 4 : 0 }));
  }
  void accents;
}

function buildArches(parts) {
  // 7 道拱肋：单数用第二层错缝拱，形成「贯木拱」的交叠感
  const ribX = [-6.95, -3.95, -2.0, 0, 2.0, 3.95, 6.95];
  const N = 12;
  const spanZ = WATER_S - WATER_N;

  const nodeA = [];
  for (let i = 0; i <= N; i++) {
    const z = WATER_S - (spanZ * i) / N;
    nodeA.push([z, archY(z)]);
  }
  const nodeB = [];
  for (let i = 0; i <= N; i++) {
    const z = WATER_S - (spanZ * (i + 0.5)) / (N + 1);
    nodeB.push([z, archY(z) + 0.3]);
  }

  ribX.forEach((dx, idx) => {
    const x = BX + dx;
    const layerB = idx % 2 === 1;
    const nodes = layerB ? nodeB : nodeA;
    for (let i = 0; i < nodes.length - 1; i++) {
      const [z0, y0] = nodes[i];
      const [z1, y1] = nodes[i + 1];
      parts.push(beamGeo([x, y0, z0], [x, y1, z1], layerB ? 0.5 : 0.66, layerB ? 0.7 : 0.92, layerB ? C.beam : C.beamDark));
    }
    for (const [z, y] of nodes) {
      parts.push(boxGeo(layerB ? 0.6 : 0.82, layerB ? 0.82 : 1.05, layerB ? 0.8 : 1.0, C.beamDark, { x, y, z }));
      parts.push(boxGeo(layerB ? 0.9 : 1.1, 0.34, 0.5, C.beam, { x: x + Math.sign(dx || 1) * 0.12, y: y + 0.12, z }));
      // 最外侧拱肋：梁头再探出去一截，从 3/4 侧看是明显的一排木楔
      if (Math.abs(dx) > 6) {
        parts.push(boxGeo(0.55, 0.46, 0.56, C.wood, { x: x + Math.sign(dx) * 0.32, y: y + 0.06, z }));
      }
    }
  });

  // 横梁：把 7 道拱肋连起来
  for (const [z, y] of nodeA) {
    parts.push(boxGeo(HALF_W * 2 - 0.9, 0.38, 0.46, C.beamDark, { x: BX, y: y + 0.42, z }));
  }
  for (const [z, y] of nodeB) {
    parts.push(boxGeo(HALF_W * 2 - 1.6, 0.3, 0.4, C.beam, { x: BX, y: y + 0.36, z }));
  }

  // 拱 → 桥板底的短柱（留出大块负形，从侧面能透过去看见水）
  for (const [z, y] of nodeA) {
    const gap = deckY(z) - DECK_T - y - 0.28;
    if (gap > 0.16) {
      parts.push(boxGeo(0.34, gap, 0.34, C.beamDark, { x: BX, y: y + 0.28 + gap / 2, z }));
      for (const sx of [-1, 1]) {
        parts.push(boxGeo(0.26, gap * 0.92, 0.28, C.beam, { x: BX + sx * 4.6, y: y + 0.28 + gap * 0.46, z }));
      }
    }
  }
  // 两道顺桥长的承重梁
  for (const sx of [-1, 1]) {
    const x = BX + sx * (HALF_W - 0.5);
    for (let i = 0; i < nodeA.length - 1; i++) {
      const [z0] = nodeA[i];
      const [z1] = nodeA[i + 1];
      parts.push(beamGeo(
        [x, deckY(z0) - DECK_T - 0.2, z0],
        [x, deckY(z1) - DECK_T - 0.2, z1],
        0.34, 0.5, C.beam,
      ));
    }
  }
  // 斜撑：只在最外侧两道拱肋上做，远看是斜线
  for (const sx of [-1, 1]) {
    const x = BX + sx * 6.95;
    for (let i = 0; i < nodeA.length - 1; i++) {
      const [z0, y0] = nodeA[i];
      const [z1, y1] = nodeA[i + 1];
      parts.push(beamGeo([x, y0 + 0.3, z0], [x, Math.min(y1 + 0.55, deckY(z1) - DECK_T), z1], 0.24, 0.26, C.beam));
    }
  }
}

function buildRailings(parts) {
  const zs = [];
  const n = 28;
  for (let i = 0; i <= n; i++) zs.push(Z_N + 0.55 + ((SPAN - 1.1) * i) / n);
  const postTop = (z) => deckY(z) + RAIL_H;
  for (const side of [-1, 1]) {
    const x = BX + side * (HALF_W - 0.14);
    for (const z of zs) {
      const y = deckY(z);
      parts.push(boxGeo(0.19, RAIL_H + 0.1, 0.19, C.post, { x, y: y + (RAIL_H + 0.1) / 2, z }));
      parts.push(boxGeo(0.3, 0.1, 0.3, C.deckDark, { x, y: postTop(z) + 0.05, z }));
    }
    for (let i = 0; i < zs.length - 1; i++) {
      const z0 = zs[i];
      const z1 = zs[i + 1];
      parts.push(beamGeo([x, postTop(z0), z0], [x, postTop(z1), z1], 0.2, 0.16, C.rail));
      parts.push(beamGeo([x, deckY(z0) + 0.62, z0], [x, deckY(z1) + 0.62, z1], 0.12, 0.1, C.rail));
      parts.push(beamGeo([x, deckY(z0) + 0.2, z0], [x, deckY(z1) + 0.2, z1], 0.12, 0.12, C.deckDark));
    }
    // 桥心 + 四分点的高望柱
    for (const [z, h] of [[BZ, 2.3], [BZ + SPAN * 0.22, 1.8], [BZ - SPAN * 0.22, 1.8]]) {
      const y = deckY(z);
      parts.push(boxGeo(0.36, h, 0.36, C.post, { x, y: y + h / 2, z }));
      parts.push(boxGeo(0.55, 0.16, 0.55, C.deckDark, { x, y: y + h + 0.08, z }));
      parts.push(sphereGeo(0.23, 6, 4, C.beam, { x, y: y + h + 0.32, z }));
    }
  }
}

/** 桥头四根华表：柱 + 横杆 + 朱幡。 */
function buildHuabiao(parts, accents) {
  const spots = [
    [BX - HALF_W - 1.6, Z_S + 1.6],
    [BX + HALF_W + 1.6, Z_S + 1.6],
    [BX - HALF_W - 1.6, Z_N - 1.6],
    [BX + HALF_W + 1.6, Z_N - 1.6],
  ];
  for (const [x, z] of spots) {
    const base = GROUND_Y;
    const h = 13.5;
    parts.push(boxGeo(1.5, 0.7, 1.5, C.stone, { x, y: base + 0.35, z }));
    parts.push(boxGeo(1.05, 0.5, 1.05, C.stoneDark, { x, y: base + 0.9, z }));
    parts.push(cylGeo(0.22, 0.32, h, 7, C.wood, { x, y: base + 0.9 + h / 2, z }));
    // 横杆
    const armY = base + 0.9 + h * 0.84;
    parts.push(boxGeo(3.0, 0.2, 0.2, C.wood, { x: x + 1.1, y: armY, z }));
    parts.push(boxGeo(0.5, 0.16, 0.5, C.deckDark, { x, y: base + 0.9 + h + 0.08, z }));
    // 朱幡
    accents.banner.push(place(clothBannerGeo(1.3, 4.2), { x: x + 2.35, y: armY - 0.15, z }));
    // 灯
    accents.lantern.push(sphereGeo(0.3, 7, 5, 0xffffff, { x: x + 1.9, y: armY - 0.5, z }));
  }
}

function buildAbutments(parts) {
  // 桥台：用石阶把两端桥面下的空当塞住（水边 → 岸边）
  for (const [zWater, dir, zEnd] of [[WATER_S, 1, Z_S], [WATER_N, -1, Z_N]]) {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const z0 = zWater + dir * (zEnd - zWater) * t0;
      const z1 = zWater + dir * (zEnd - zWater) * t1;
      const zc = (z0 + z1) / 2;
      const top = Math.max(deckY(zc) - DECK_T - 0.25, GROUND_Y - 0.2);
      if (top <= 0.5) continue;
      parts.push(boxGeo(HALF_W * 2 + 1.2, top - 0.1, Math.abs(z1 - z0) + 0.12, i % 2 ? C.stone : C.stoneDark, { x: BX, y: (top - 0.1) / 2 + 0.1, z: zc }));
    }
    // 水里的拱脚石
    parts.push(boxGeo(HALF_W * 2 + 1.0, 1.1, 1.4, C.stoneDark, { x: BX, y: WATER_Y + 0.35, z: zWater + dir * 0.5 }));
    // 翼墙
    for (const sx of [-1, 1]) {
      parts.push(boxGeo(2.2, 1.5, 2.0, C.stone, { x: BX + sx * (HALF_W + 1.2), y: GROUND_Y - 0.55, z: zEnd - dir * 0.4 }));
    }
  }
}

function stall(parts, accents, { x, z, style, cloth = 'ochre' }) {
  const y = deckY(z);
  const dyed = cloth === 'blue' ? accents.blue : accents.ochre;
  if (style === 'umbrella') {
    parts.push(cylGeo(0.06, 0.07, 3.1, 5, C.wood, { x, y: y + 1.55, z }));
    dyed.push(coneGeo(1.75, 0.62, 8, 0xffffff, { x, y: y + 3.15, z }));
    parts.push(coneGeo(1.82, 0.1, 8, C.beamDark, { x, y: y + 2.88, z }));
    accents.lantern.push(sphereGeo(0.24, 6, 4, 0xffffff, { x, y: y + 3.5, z }));
  } else {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(cylGeo(0.055, 0.06, 2.55, 4, C.wood, { x: x + sx * 1.05, y: y + 1.28, z: z + sz * 0.8 }));
      }
    }
    dyed.push(boxGeo(2.5, 0.1, 2.1, 0xffffff, { x, y: y + 2.62, z, rx: 0.05 }));
    dyed.push(boxGeo(2.5, 0.6, 0.04, 0xffffff, { x, y: y + 2.3, z: z - 1.0, rx: -0.1 }));
    parts.push(boxGeo(0.16, 0.16, 2.0, C.beamDark, { x: x + 1.05, y: y + 2.5, z }));
    parts.push(boxGeo(0.16, 0.16, 2.0, C.beamDark, { x: x - 1.05, y: y + 2.5, z }));
  }
  // 案板 + 货
  parts.push(boxGeo(1.9, 0.1, 0.82, C.wood, { x, y: y + 0.82, z }));
  parts.push(boxGeo(0.1, 0.82, 0.1, C.beamDark, { x: x - 0.78, y: y + 0.41, z }));
  parts.push(boxGeo(0.1, 0.82, 0.1, C.beamDark, { x: x + 0.78, y: y + 0.41, z }));
  for (let i = 0; i < 3; i++) {
    parts.push(boxGeo(0.32, 0.24, 0.32, i % 2 ? C.goods : C.goodsDark, { x: x - 0.6 + i * 0.6, y: y + 1.0, z: z + (i % 2 ? 0.16 : -0.14) }));
  }
  accents.lantern.push(sphereGeo(0.2, 6, 4, 0xffffff, { x: x + 1.1, y: y + 1.7, z: z + 0.5 }));
}

/* -------------------------------------------------------------------------- */
/*  州桥                                                                       */
/* -------------------------------------------------------------------------- */

function buildZhouqiao(stone, accents) {
  // 台阶式桥面：一级一级石阶（踏面 0.9、踢面 0.2）
  const n = Math.round(QSPAN / 0.9);
  const dz = QSPAN / n;
  for (let i = 0; i < n; i++) {
    const z = Q_ZN + dz * (i + 0.5);
    const h = qStepY(z);
    stone.push(boxGeo(QW, 0.42, dz + 0.03, i % 2 ? C.stone : C.stoneLight, { x: QX, y: h - 0.21, z }));
    // 水外的两段：台阶下面填实到地面，像真正的石桥
    if (z > Q_WATER_S || z < Q_WATER_N) {
      const fillH = h - 0.42 - 0.15;
      if (fillH > 0.2) {
        stone.push(boxGeo(QW, fillH, dz + 0.03, i % 2 ? C.stoneDark : C.stone, { x: QX, y: 0.15 + fillH / 2, z }));
      }
    }
  }

  // 拱圈（两侧）+ 拱腹
  const NS = 16;
  const spanZ = Q_WATER_S - Q_WATER_N;
  const nodes = [];
  for (let i = 0; i <= NS; i++) {
    const z = Q_WATER_S - (spanZ * i) / NS;
    nodes.push([z, qArchY(z)]);
  }
  for (const sx of [-1, 1]) {
    const xRing = QX + sx * (QW / 2 - 0.05); // 拱圈探到桥身外面
    const x = QX + sx * (QW / 2 - 0.85); // 侧墙略微内收
    // 拱圈石：一圈明显的券石
    for (let i = 0; i < nodes.length - 1; i++) {
      const [z0, y0] = nodes[i];
      const [z1, y1] = nodes[i + 1];
      stone.push(beamGeo([xRing, y0, z0], [xRing, y1, z1], 0.75, 0.92, i % 2 ? C.stoneLight : C.stone));
      stone.push(beamGeo([xRing, y0 - 0.5, z0], [xRing, y1 - 0.5, z1], 0.5, 0.3, C.stoneDark));
    }
    // 侧墙：拱圈以上到桥板底（实心石墙，留出下面的拱洞）
    const rows = [];
    for (let i = 0; i <= 24; i++) {
      const z = Q_ZS - (QSPAN * i) / 24;
      if (z > Q_WATER_S + 0.2 || z < Q_WATER_N - 0.2) {
        rows.push([[x, qStepY(z) - 0.42, z], [x, 0.1, z]]);
      } else {
        const top = qStepY(z) - 0.42;
        const bot = qArchY(z);
        if (top - bot < 0.1) continue;
        rows.push([[x, top, z], [x, bot, z]]);
      }
    }
    stone.push(stripGeo(rows, C.stone));
    // 桥墩/拱脚
    stone.push(boxGeo(1.8, 1.7, 1.9, C.stoneDark, { x: xRing, y: WATER_Y + 0.45, z: Q_WATER_S + 0.4 }));
    stone.push(boxGeo(1.8, 1.7, 1.9, C.stoneDark, { x: xRing, y: WATER_Y + 0.45, z: Q_WATER_N - 0.4 }));
  }
  // 拱腹：拱圈底下的筒券面
  const soffit = [];
  for (let i = 0; i <= 12; i++) {
    const z = Q_WATER_S - (spanZ * i) / 12;
    const y = qArchY(z) - 0.62;
    soffit.push([[QX - QW / 2 + 0.5, y, z], [QX + QW / 2 - 0.5, y, z]]);
  }
  stone.push(stripGeo(soffit, C.stoneDark));

  // 桥台：水边到桥头
  for (const [zW, dir, zE] of [[Q_WATER_S, 1, Q_ZS], [Q_WATER_N, -1, Q_ZN]]) {
    const zc = (zW + zE) / 2;
    const top = (qStepY(zW) + qStepY(zE)) / 2 - 0.3;
    stone.push(boxGeo(QW + 1.2, top, Math.abs(zE - zW) + 0.4, C.stone, { x: QX, y: top / 2, z: zc }));
  }

  // 石栏板 + 望柱
  const nPost = 22;
  for (const sx of [-1, 1]) {
    const x = QX + sx * (QW / 2 - 0.55);
    const posts = [];
    for (let i = 0; i <= nPost; i++) {
      const z = Q_ZN + 0.6 + ((QSPAN - 1.2) * i) / nPost;
      const y = qStepY(z);
      posts.push([z, y]);
      const h = i === 0 || i === nPost || i === nPost / 2 ? 1.7 : 1.25;
      stone.push(boxGeo(0.34, h, 0.34, C.stoneLight, { x, y: y + h / 2, z }));
      if (h > 1.5) stone.push(sphereGeo(0.22, 6, 4, C.stoneDark, { x, y: y + h + 0.24, z }));
    }
    for (let i = 0; i < posts.length - 1; i++) {
      const [z0, y0] = posts[i];
      const [z1, y1] = posts[i + 1];
      // 压面石 + 实心栏板（视线以下是一块整石）
      stone.push(beamGeo([x, y0 + 1.06, z0], [x, y1 + 1.06, z1], 0.3, 0.2, C.stoneLight));
      stone.push(beamGeo([x, y0 + 0.5, z0], [x, y1 + 0.5, z1], 0.24, 0.72, C.stone));
      stone.push(beamGeo([x, y0 + 0.14, z0], [x, y1 + 0.14, z1], 0.3, 0.22, C.stoneDark));
    }
    // 桥心两对红灯笼
    if (sx === 1) {
      const z = QZ;
      accents.lantern.push(sphereGeo(0.34, 7, 5, 0xffffff, { x: QX + sx * (QW / 2 - 1.2), y: qStepY(z) + 2.5, z: z + 3 }));
      accents.lantern.push(sphereGeo(0.34, 7, 5, 0xffffff, { x: QX + sx * (QW / 2 - 1.2), y: qStepY(z) + 2.5, z: z - 3 }));
    }
  }
  // 桥头彩幡
  for (const [z, sx] of [[Q_ZS + 0.8, 1], [Q_ZN - 0.8, -1]]) {
    const x = QX + sx * (QW / 2 + 1.6);
    accents.banner.push(place(clothBannerGeo(1.5, 5.0), { x, y: GROUND_Y + 10.5, z }));
    stone.push(cylGeo(0.16, 0.2, 10.8, 6, C.wood, { x, y: GROUND_Y + 5.4, z }));
    stone.push(boxGeo(1.3, 0.5, 1.3, C.stoneDark, { x, y: GROUND_Y + 0.25, z }));
  }
}

/* -------------------------------------------------------------------------- */
/*  桥下阴翳                                                                    */
/* -------------------------------------------------------------------------- */

function buildShadow() {
  const pos = [];
  const col = [];
  const ink = new THREE.Color(0x3a463f);
  const pools = [
    { x0: BX - HALF_W - 3, x1: BX + HALF_W + 3, z0: WATER_N + 1.2, z1: WATER_S - 1.2, a: 0.28 },
    { x0: QX - QW / 2 - 3, x1: QX + QW / 2 + 3, z0: Q_WATER_N + 1.0, z1: Q_WATER_S - 1.0, a: 0.24 },
  ];
  for (const p of pools) {
    const rows = [
      [p.x0 - 4, 0],
      [p.x0, p.a],
      [p.x1, p.a],
      [p.x1 + 4, 0],
    ];
    for (let i = 0; i < rows.length - 1; i++) {
      const [x0, a0] = rows[i];
      const [x1, a1] = rows[i + 1];
      const tris = [
        [x0, a0, p.z0, x1, a1, p.z0, x1, a1, p.z1],
        [x0, a0, p.z0, x1, a1, p.z1, x0, a0, p.z1],
      ];
      for (const t of tris) {
        for (let k = 0; k < 3; k++) {
          pos.push(t[k * 3], WATER_Y + 0.105, t[k * 3 + 2]);
          const a = t[k * 3 + 1];
          col.push(ink.r, ink.g, ink.b, a);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.computeBoundingSphere();
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'bridge-shadow';
  mesh.renderOrder = 13;
  mesh.frustumCulled = false;
  return mesh;
}

/* -------------------------------------------------------------------------- */
/*  人                                                                          */
/* -------------------------------------------------------------------------- */

const RB_KINDS = [
  'walker', 'walker', 'walker', 'walker', 'porter', 'porter', 'scholar', 'lady',
  'vendor', 'monk', 'child', 'rider', 'donkey', 'palanquin',
];

function pushPeople(ctx) {
  const people = ctx.people;
  if (!Array.isArray(people)) return;
  const rng = makeRng(20261108);

  // —— 虹桥 120 人 ——
  // 桥心一带最挤，两头渐疏
  for (let i = 0; i < 112; i++) {
    const t = rng();
    const u = t < 0.45 ? 0.34 + t * 0.66 : t; // 往桥心压一点
    const z = Z_N + 2.2 + (SPAN - 4.4) * u;
    const x = BX + (rng() * 2 - 1) * (HALF_W - 1.2);
    const kind = RB_KINDS[Math.floor(rng() * RB_KINDS.length)];
    const moving = rng() < 0.45;
    people.push({
      kind,
      x,
      z,
      y: deckY(z) + 0.03,
      dir: rng() < 0.5 ? [1, 0] : [-1, 0],
      span: moving ? 1.6 + rng() * 2.2 : 0,
    });
  }
  // 桥东栏杆看船的人（镜头就在东侧，这排人最出效果）
  for (let i = 0; i < 8; i++) {
    const z = BZ - 9 + i * 2.6;
    people.push({ kind: i % 3 === 0 ? 'scholar' : i % 3 === 1 ? 'walker' : 'lady', x: BX + HALF_W - 0.9, z, y: deckY(z) + 0.03, dir: [0, 1] });
  }
  // 六个摊子的摊主
  for (const [x, z] of [
    [BX - 3.4, 29], [BX + 3.6, 23], [BX - 3.6, 15], [BX + 3.6, 7], [BX - 3.4, -2], [BX + 3.6, -11],
  ]) {
    people.push({ kind: 'vendor', x, z, y: deckY(z) + 0.03, dir: [1, 0] });
  }
  // 桥头地面的人
  for (const [z, x, kind] of [
    [Z_S + 3.4, BX - 8, 'walker'], [Z_S + 2.8, BX + 7.5, 'porter'], [Z_S + 4.4, BX + 1, 'lady'],
    [Z_N - 3.2, BX - 7, 'monk'], [Z_N - 3.8, BX + 8, 'donkey'],
  ]) {
    people.push({ kind, x, z, y: GROUND_Y, dir: [1, 0], span: 3 });
  }

  // —— 州桥 30 人 ——
  for (let i = 0; i < 28; i++) {
    const z = Q_ZN + 2 + (QSPAN - 4) * rng();
    const x = QX + (rng() * 2 - 1) * (QW / 2 - 1.4);
    const kind = RB_KINDS[Math.floor(rng() * RB_KINDS.length)];
    people.push({
      kind,
      x,
      z,
      y: qStepY(z) + 0.03,
      dir: rng() < 0.5 ? [1, 0] : [-1, 0],
      span: rng() < 0.4 ? 1.4 + rng() * 2 : 0,
    });
  }
  people.push({ kind: 'vendor', x: QX - QW / 2 + 1.2, z: QZ + 2, y: qStepY(QZ + 2) + 0.03, dir: [0, 1] });
  people.push({ kind: 'monk', x: QX + QW / 2 - 1.2, z: QZ - 2, y: qStepY(QZ - 2) + 0.03 });
}

/* -------------------------------------------------------------------------- */
/*  主入口                                                                      */
/* -------------------------------------------------------------------------- */

export function buildBridge(ctx) {
  const group = new THREE.Group();
  group.name = 'bridge';
  const mats = ctx.mats || {};

  const structMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const parts = [];
  const accents = { banner: [], ochre: [], blue: [], lantern: [] };

  // —— 虹桥 ——
  buildDeck(parts, accents);
  buildArches(parts);
  buildRailings(parts);
  buildHuabiao(parts, accents);
  buildAbutments(parts);
  stall(parts, accents, { x: BX - 3.4, z: 29, style: 'umbrella', cloth: 'ochre' });
  stall(parts, accents, { x: BX + 3.6, z: 23, style: 'awning', cloth: 'blue' });
  stall(parts, accents, { x: BX - 3.6, z: 15, style: 'awning', cloth: 'ochre' });
  stall(parts, accents, { x: BX + 3.6, z: 7, style: 'umbrella', cloth: 'blue' });
  stall(parts, accents, { x: BX - 3.4, z: -2, style: 'umbrella', cloth: 'ochre' });
  stall(parts, accents, { x: BX + 3.6, z: -11, style: 'awning', cloth: 'blue' });

  const structGeo = mergeParts(parts);
  if (structGeo) {
    const mesh = new THREE.Mesh(structGeo, structMat);
    mesh.name = 'rainbow-bridge';
    group.add(mesh);
  }

  // —— 州桥 ——
  const stone = [];
  buildZhouqiao(stone, accents);
  const stoneGeo = mergeParts(stone);
  if (stoneGeo) {
    const mesh = new THREE.Mesh(stoneGeo, structMat);
    mesh.name = 'zhouqiao';
    group.add(mesh);
  }

  // —— 设色点缀：幡 / 赭布 / 青布 / 灯笼 ——
  const accentDefs = [
    ['banner', mats.banner || new THREE.MeshLambertMaterial({ color: P.VERMILION, side: THREE.DoubleSide }), 'bridge-banners'],
    ['ochre', mats.clothOchre || new THREE.MeshLambertMaterial({ color: 0xa9803f, side: THREE.DoubleSide }), 'bridge-ochre'],
    ['blue', mats.clothBlue || new THREE.MeshLambertMaterial({ color: 0x5f7278, side: THREE.DoubleSide }), 'bridge-blue'],
    ['lantern', mats.lantern || new THREE.MeshBasicMaterial({ color: 0xc23a24, toneMapped: false }), 'bridge-lanterns'],
  ];
  for (const [key, mat, name] of accentDefs) {
    const geo = mergeParts(accents[key]);
    if (!geo) continue;
    mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    group.add(mesh);
  }

  // —— 桥下阴翳 ——
  group.add(buildShadow());

  // —— 人 ——
  pushPeople(ctx);

  group.userData.deckY = deckY;
  group.userData.zhouqiao = { deckY: qStepY, x: QX, z: QZ };
  return group;
}
