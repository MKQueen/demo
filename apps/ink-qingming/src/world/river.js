/**
 * river.js —— 汴河：水面、岸线湿墨、船、码头、苇草、柳树。
 *
 * 契约：export function buildRiver(ctx) → THREE.Group（name = 'river'）。
 *
 * 做法：
 *   1. 水面：按 layout.RIVER.path 生成一条沿河心的条带 BufferGeometry
 *      （不是矩形），y = WATER_Y；自定义 ShaderMaterial——绢本淡青灰、
 *      两层线描水纹沿 x 缓慢流动、极缓起伏、三圈岸线湿墨，手写 fog。
 *   2. 岸线：水内侧三道淡墨圈 + 岸上一道湿边 + 一道垂直的岸壁墨（遮住
 *      terrain 岸顶到水面之间的缝），共用一张顶点色 / 顶点 alpha 的透明网。
 *   3. 船：3 条漕船 / 货船、1 条客船、1 条乌篷小舟，都停在岸边缓慢起伏；
 *      第 6 条是大货船，从西往东缓缓过虹桥——桅杆放倒、船工撑篙。
 *   4. 码头：北岸两处木栈桥（系缆桩、货堆、苇席棚），南岸一处小埠头+茶棚。
 *   5. 苇草与柳树：细线苇丛 + flora 的 lineOfTrees 柳树（南岸近景多）。
 *   6. 人：船上 8 人、码头/岸边 25 人（含拉纤的纤夫），push 给 people.js。
 *
 * 所有动画走 ctx.onTick；截图脚本可以调用 group.userData.setBoatPhase(v)
 * 把大船固定在某个过桥相位。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as P from '../lib/palette.js';
import {
  RIVER, BRIDGE, ZHOUQIAO, EAST_WATER_GATE, YUJIE, OUTER_CITY, MOAT, CANALS, CITY_LANDMARKS,
  riverZ, northBankZ, southBankZ, WATER_Y, GROUND_Y,
} from '../layout.js';
import { makeRng } from '../lib/rand.js';
import { buildTrees, lineOfTrees } from '../lib/flora.js';

const X0 = -420;
const X1 = 900;
const WATER_STEP = 2;
const BIG_CYCLE = 96;
/** 蔡河/护城河/金明池没有地形开槽，水面抬到绢面之上一点（靠湿墨边读成低下去的水）。 */
const NEW_WATER_Y = GROUND_Y + 0.06; // 大船过桥一轮的秒数

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};

/* -------------------------------------------------------------------------- */
/*  颜色与几何小工具                                                            */
/* -------------------------------------------------------------------------- */

/** 船 / 码头的木色：都比 palette 里的木色更沉一点，像旧绢上的赭墨。 */
const C = {
  keel: 0x241d14,
  hull: 0x392e1f,
  hullLit: 0x473a26,
  gunwale: 0x544226,
  deck: 0x655335,
  deckDark: 0x4f4029,
  timber: 0x554226,
  timberDark: 0x3b2f1d,
  wood: 0x4a3c26,
  mat: 0x4e4128,
  matDark: 0x3a301f,
  cloth: 0x9a8c6f,
  clothBlue: 0x45555b,
  clothOchre: 0x6e5327,
  red: 0x7c2f1e,
  rope: 0x453b29,
  cargo: 0x4d412b,
  cargoDark: 0x3b311f,
  stone: 0x938875,
  stoneDark: 0x7d7361,
  stoneLight: 0xa79c88,
  brick: 0x7c7060,
  brickDark: 0x625849,
  tile: 0x4e5854,
  tileDark: 0x3c4542,
  sack: 0x7a6848,
  reed: 0x4c5742,
  reedTip: 0x76805c,
  ink: 0x3b463f,
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

/** 两点之间的一根梁（BoxGeometry 沿 X 拉长再转到 a→b）。 */
function beamGeo(a, b, w, h, color) {
  const A = Array.isArray(a) ? new THREE.Vector3(a[0], a[1], a[2]) : a;
  const B = Array.isArray(b) ? new THREE.Vector3(b[0], b[1], b[2]) : b;
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

function mergeParts(parts) {
  const list = parts.filter(Boolean);
  if (!list.length) return new THREE.BufferGeometry();
  if (list.length === 1) return list[0];
  return mergeGeometries(list, false);
}

/* -------------------------------------------------------------------------- */
/*  水面几何 + shader                                                           */
/* -------------------------------------------------------------------------- */

function buildWaterSurface(tex) {
  const pos = [];
  const aT = [];
  const idx = [];
  const v = (x, z, t, y = WATER_Y) => {
    pos.push(x, y, z);
    aT.push(t);
    return pos.length / 3 - 1;
  };
  const tri = (a, b, c) => {
    // a/b/c: [x, z, aT]（新水系：抬到地面之上）
    const ia = v(a[0], a[1], a[2], NEW_WATER_Y);
    const ib = v(b[0], b[1], b[2], NEW_WATER_Y);
    const ic = v(c[0], c[1], c[2], NEW_WATER_Y);
    idx.push(ia, ib, ic);
  };

  /* —— 1. 汴河主河道（一直延到 x=900，穿过东水门出城） —— */
  const cols = [-1, -0.62, -0.1, 0.62, 1];
  const rows = [];
  for (let x = X0; x <= X1 + 1e-6; x += WATER_STEP) rows.push(x);
  for (let i = 0; i < rows.length; i++) {
    const x = rows[i];
    const zc = riverZ(x);
    for (let j = 0; j < cols.length; j++) {
      const c = cols[j];
      pos.push(x, WATER_Y, zc + c * RIVER.halfWidth);
      aT.push(Math.abs(c));
    }
  }
  const stride = cols.length;
  for (let i = 0; i < rows.length - 1; i++) {
    for (let j = 0; j < stride - 1; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }

  /* —— 2. 蔡河 / 五丈河 / 金水河：折线带状水面（中间一列压暗） —— */
  for (const key of ['caihe', 'wuzhanghe', 'jinshuihe']) {
    const canal = CANALS[key];
    if (!canal || !canal.path) continue;
    const pts = canal.path;
    const hw = canal.width / 2;
    const nrm = [];
    for (let i = 0; i < pts.length; i++) {
      let dx;
      let dz;
      if (i === 0) {
        dx = pts[1][0] - pts[0][0];
        dz = pts[1][1] - pts[0][1];
      } else if (i === pts.length - 1) {
        dx = pts[i][0] - pts[i - 1][0];
        dz = pts[i][1] - pts[i - 1][1];
      } else {
        dx = pts[i + 1][0] - pts[i - 1][0];
        dz = pts[i + 1][1] - pts[i - 1][1];
      }
      const len = Math.hypot(dx, dz) || 1;
      nrm.push([-dz / len, dx / len]);
    }
    const rowsC = [];
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      const [nx, nz] = nrm[i];
      rowsC.push([
        [x - nx * hw, z - nz * hw, 1],
        [x - nx * hw * 0.45, z - nz * hw * 0.45, 0.6],
        [x, z, 0.5],
        [x + nx * hw * 0.45, z + nz * hw * 0.45, 0.6],
        [x + nx * hw, z + nz * hw, 1],
      ]);
    }
    for (let i = 0; i < rowsC.length - 1; i++) {
      const A = rowsC[i];
      const B = rowsC[i + 1];
      for (let j = 0; j < 4; j++) {
        tri(A[j], B[j], A[j + 1]);
        tri(A[j + 1], B[j], B[j + 1]);
      }
    }
  }

  /* —— 3. 外城护城河：四段水带（汴河穿口处断开） —— */
  {
    const off = MOAT.offset;
    const W = MOAT.width;
    const xA = OUTER_CITY.x0 - off; // 护城河内边
    const xB = OUTER_CITY.x1 + off;
    const zA = OUTER_CITY.z0 - off;
    const zB = OUTER_CITY.z1 + off;
    const riverZWest = riverZ(OUTER_CITY.x0);
    const riverZEest = riverZ(OUTER_CITY.x1);
    const holesE = [[riverZEest - 28, riverZEest + 28]];
    const holesW = [[riverZWest - 28, riverZWest + 28]];
    // 一条直水带：沿 axis 方向铺 rows，across 为两条边线
    const straightBand = (p0, p1, n0, n1, holes, alongIsZ) => {
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const step = 9;
      const n = Math.max(2, Math.round(len / step));
      let run = [];
      const flush = () => {
        for (let i = 0; i < run.length - 1; i++) {
          const A = run[i];
          const B = run[i + 1];
          for (let j = 0; j < 2; j++) {
            tri(A[j], B[j], A[j + 1]);
            tri(A[j + 1], B[j], B[j + 1]);
          }
        }
        run = [];
      };
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const px = p0[0] + (p1[0] - p0[0]) * t;
        const pz = p0[1] + (p1[1] - p0[1]) * t;
        const along = alongIsZ ? pz : px;
        const inHole = holes.some(([a, b]) => along > a && along < b);
        if (inHole) {
          flush();
          continue;
        }
        run.push([
          [px + n0[0], pz + n0[1], 0.95],
          [px + n0[0] * 0.55 + n1[0] * 0.45, pz + n0[1] * 0.55 + n1[1] * 0.45, 0.55],
          [px + n1[0], pz + n1[1], 0.95],
        ]);
      }
      flush();
    };
    // 西带（x 方向的两条边线沿 z）
    straightBand(
      [xA - W * 0.5, zA - W], [xA - W * 0.5, zB + W],
      [-W * 0.5, 0], [W * 0.5, 0], holesW, true,
    );
    // 东带
    straightBand(
      [xB + W * 0.5, zA - W], [xB + W * 0.5, zB + W],
      [-W * 0.5, 0], [W * 0.5, 0], holesE, true,
    );
    // 北带（x 方向，避开两角与西/东带重叠）
    straightBand(
      [xA, zA - W * 0.5], [xB, zA - W * 0.5],
      [0, -W * 0.5], [0, W * 0.5], [], false,
    );
    // 南带
    straightBand(
      [xA, zB + W * 0.5], [xB, zB + W * 0.5],
      [0, -W * 0.5], [0, W * 0.5], [], false,
    );
  }

  /* —— 4. 金明池：不规则圆湖 —— */
  {
    const lm = CITY_LANDMARKS.find((l) => l.id === 'jinmingchi');
    const cx = lm ? lm.x : -190;
    const cz = lm ? lm.z : -270;
    const R = 118;
    const N = 56;
    const rAt = (a) => R * (1 + 0.07 * Math.sin(a * 3 + 1.3) + 0.045 * Math.sin(a * 7 + 0.4) + 0.03 * Math.cos(a * 5 - 0.8));
    const rings = [0, 0.4, 0.72, 1];
    const ringT = [0.5, 0.62, 0.8, 1];
    const ringPts = rings.map((f) => {
      const arr = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const r = rAt(a) * f;
        arr.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, ringT[rings.indexOf(f)] ?? f]);
      }
      return arr;
    });
    // 中心扇面
    const c0 = [cx, cz, 0];
    for (let i = 0; i < N; i++) {
      tri(c0, ringPts[0][i], ringPts[0][(i + 1) % N]);
    }
    for (let k = 0; k < rings.length - 1; k++) {
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        tri(ringPts[k][i], ringPts[k + 1][i], ringPts[k][j]);
        tri(ringPts[k][j], ringPts[k + 1][i], ringPts[k + 1][j]);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aT', new THREE.Float32BufferAttribute(aT, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uLines: { value: null },
      uWash: { value: null },
      uDeep: { value: new THREE.Color(0x2b3733) },
      uShallow: { value: new THREE.Color(0x45534c) },
      uLine: { value: new THREE.Color(0x44524b) },
      uShore: { value: new THREE.Color(0x5d6a61) },
    },
  ]);
  uniforms.uLines.value = tex.waterLine || null;
  uniforms.uWash.value = tex.wash || null;

  const material = new THREE.ShaderMaterial({
    uniforms,
    fog: false,
    transparent: false,
    depthWrite: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute float aT;
      uniform float uTime;
      varying float vT;
      varying vec2 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vT = aT;
        vWorld = position.xz;
        vec3 p = position;
        // 极缓的呼吸：三层不同波长，慢到几乎看不出在动
        p.y += sin(position.x * 0.055 + uTime * 0.36) * 0.026
             + sin(position.z * 0.081 - uTime * 0.27) * 0.018
             + sin((position.x + position.z) * 0.023 + uTime * 0.14) * 0.012;
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uLines;
      uniform sampler2D uWash;
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uLine;
      uniform vec3 uShore;
      varying float vT;
      varying vec2 vWorld;
      #include <fog_pars_fragment>

      void main() {
        float t = clamp(vT, 0.0, 1.0);
        vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 0.88, t));
        float cloud = sin(vWorld.x * 0.028 + vWorld.y * 0.024) * 0.5 + 0.5;
        cloud = cloud * 0.62 + (sin(vWorld.x * 0.0105 - vWorld.y * 0.017) * 0.5 + 0.5) * 0.38;
        col *= 0.965 + cloud * 0.07;
        vec4 wash = texture2D(uWash, vWorld * 0.011 + vec2(0.13, 0.07));
        col = mix(col, uShore, wash.a * 0.14);

        vec2 w1 = vec2(sin(vWorld.y * 0.21 + uTime * 0.14), cos(vWorld.x * 0.16 - uTime * 0.1)) * 0.012;
        float a1 = texture2D(uLines, vec2(vWorld.x * 0.0155 + uTime * 0.0042, vWorld.y * 0.031) + w1).r;
        vec2 rp = vec2(vWorld.x * 0.99 - vWorld.y * 0.12, vWorld.x * 0.12 + vWorld.y * 0.99);
        vec2 w2 = vec2(cos(vWorld.y * 0.11 - uTime * 0.07), sin(vWorld.x * 0.09 + uTime * 0.05)) * 0.014;
        float a2 = texture2D(uLines, vec2(rp.x * 0.0092 - uTime * 0.0021, rp.y * 0.0165) + w2).r;
        // 远处水纹淡出，避免全城视角里线纹摩尔纹闪烁
        float dcam = length(vec3(vWorld.x, 0.0, vWorld.y) - cameraPosition);
        float lineFade = 1.0 - smoothstep(160.0, 600.0, dcam);
        float line = max(a1 * 0.92, a2 * 0.42) * mix(0.25, 1.0, lineFade);
        float mask = smoothstep(0.025, 0.28, line);
        col = mix(col, uLine, mask * 0.52);

        col = mix(col, uShore, smoothstep(0.55, 0.99, t) * 0.2);
        col = mix(col, uShore, (smoothstep(0.90, 0.945, t) - smoothstep(0.955, 0.985, t)) * 0.30);
        col = mix(col, uShore, (smoothstep(0.80, 0.84, t) - smoothstep(0.855, 0.90, t)) * 0.20);
        col = mix(col, uShore, (smoothstep(0.66, 0.69, t) - smoothstep(0.70, 0.74, t)) * 0.13);
        col = mix(col, uShore, smoothstep(0.972, 0.998, t) * 0.32);
        col += line * line * 0.045;

        gl_FragColor = vec4(col, mix(0.82, 0.92, lineFade));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'river-surface';
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

/* -------------------------------------------------------------------------- */
/*  岸线湿墨 / 船影：一张顶点色 + 顶点 alpha 的透明网                             */
/* -------------------------------------------------------------------------- */

function makeWashBuilder() {
  const pos = [];
  const col = [];
  const ink = new THREE.Color(C.ink);
  const _c = new THREE.Color();

  function tri(a, b, c, color, alphas) {
    const cc = color instanceof THREE.Color ? color : _c.set(color);
    const base = pos.length / 3;
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) col.push(cc.r, cc.g, cc.b, alphas[i]);
    return base;
  }

  /**
   * 沿河岸的一条带子。
   * d0/d1 是「离岸线的距离」，正数往水里、负数往岸上（米）。
   * a0/a1 对应 d0/d1 处的 alpha。
   */
  function band(side, { d0, d1, y0 = WATER_Y + 0.1, y1 = null, a0 = 0.2, a1 = 0, color = C.ink, step = 4 }) {
    const yy1 = y1 == null ? y0 : y1;
    const rows = [];
    for (let x = X0; x <= X1 + 1e-6; x += step) rows.push(x);
    const zAt = (x, d) => riverZ(x) + side * (RIVER.halfWidth - d);
    for (let i = 0; i < rows.length - 1; i++) {
      const x0 = rows[i];
      const x1 = rows[i + 1];
      const p00 = [x0, y0, zAt(x0, d0)];
      const p01 = [x0, yy1, zAt(x0, d1)];
      const p10 = [x1, y0, zAt(x1, d0)];
      const p11 = [x1, yy1, zAt(x1, d1)];
      tri(p00, p10, p01, color, [a0, a0, a1]);
      tri(p10, p11, p01, color, [a0, a1, a1]);
    }
  }

  /** 岸壁：从水面到岸顶的一小段竖直墨面（遮住岸与水面之间的缝）。 */
  function bankFace(side, { aTop = 0.12, aBot = 0.42, color = C.ink, step = 4 } = {}) {
    const rows = [];
    for (let x = X0; x <= X1 + 1e-6; x += step) rows.push(x);
    const zAt = (x) => riverZ(x) + side * RIVER.halfWidth;
    for (let i = 0; i < rows.length - 1; i++) {
      const x0 = rows[i];
      const x1 = rows[i + 1];
      const z0 = zAt(x0);
      const z1 = zAt(x1);
      const bot0 = [x0, WATER_Y - 0.02, z0];
      const bot1 = [x1, WATER_Y - 0.02, z1];
      const top0 = [x0, GROUND_Y + 0.05, z0];
      const top1 = [x1, GROUND_Y + 0.05, z1];
      tri(bot0, bot1, top0, color, [aBot, aBot, aTop]);
      tri(bot1, top1, top0, color, [aBot, aTop, aTop]);
    }
  }

  /** 水面上的椭圆墨影（船底 / 桥下）。 */
  function pool(cx, cz, rx, rz, alpha = 0.18, color = C.ink, y = WATER_Y + 0.09, ry = 0) {
    const n = 10;
    const rot = ry;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const ex = Math.cos(a) * rx;
      const ez = Math.sin(a) * rz;
      pts.push([cx + ex * Math.cos(rot) - ez * Math.sin(rot), y, cz + ex * Math.sin(rot) + ez * Math.cos(rot)]);
    }
    for (let i = 1; i < n - 1; i++) {
      tri(pts[0], pts[i], pts[i + 1], color, [alpha * 0.55, alpha, alpha]);
    }
  }

  /** 任意折线 + 逐点法线：两条偏移线之间铺一条带（d 为沿法线的米数）。 */
  function pairBand(pts, nrm, d0, d1, y0, y1, a0, a1, color = C.ink) {
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const n0 = nrm[i];
      const n1 = nrm[i + 1];
      const A0 = [p0[0] + n0[0] * d0, y0, p0[1] + n0[1] * d0];
      const A1 = [p0[0] + n0[0] * d1, y1, p0[1] + n0[1] * d1];
      const B0 = [p1[0] + n1[0] * d0, y0, p1[1] + n1[1] * d0];
      const B1 = [p1[0] + n1[0] * d1, y1, p1[1] + n1[1] * d1];
      tri(A0, B0, A1, color, [a0, a0, a1]);
      tri(B0, B1, A1, color, [a0, a1, a1]);
    }
  }

  /** 任意折线的竖直岸壁。 */
  function pairFace(pts, nrm, d, aBot = 0.42, aTop = 0.12, color = C.ink) {
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const n0 = nrm[i];
      const n1 = nrm[i + 1];
      const b0 = [p0[0] + n0[0] * d, WATER_Y - 0.02, p0[1] + n0[1] * d];
      const b1 = [p1[0] + n1[0] * d, WATER_Y - 0.02, p1[1] + n1[1] * d];
      const t0 = [p0[0] + n0[0] * d, GROUND_Y + 0.05, p0[1] + n0[1] * d];
      const t1 = [p1[0] + n1[0] * d, GROUND_Y + 0.05, p1[1] + n1[1] * d];
      tri(b0, b1, t0, color, [aBot, aBot, aTop]);
      tri(b1, t1, t0, color, [aBot, aTop, aTop]);
    }
  }

  function build() {
    if (!pos.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    geo.computeBoundingSphere();
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: true, fog: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'river-shore-wash';
    mesh.renderOrder = 12;
    mesh.frustumCulled = false;
    return mesh;
  }

  return { tri, band, bankFace, pairBand, pairFace, pool, build, ink };
}

/**
 * 给一条运河（CANALS 的一支）铺岸线湿墨：水内侧三圈 + 岸上一圈 + 岸壁。
 */
function canalWash(wash, canal) {
  const pts = canal.path;
  const hw = canal.width / 2;
  const nrm = [];
  const step = 6;
  // 沿折线重采样，控制三角形数量
  const sampled = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) {
      if (i > 0 && k === 0) continue;
      const t = k / n;
      sampled.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]);
    }
  }
  sampled.push(pts[pts.length - 1].slice());
  for (let i = 0; i < sampled.length; i++) {
    const p = sampled[i];
    const q = sampled[Math.min(i + 1, sampled.length - 1)];
    const r = sampled[Math.max(i - 1, 0)];
    const dx = q[0] - r[0];
    const dz = q[1] - r[1];
    const len = Math.hypot(dx, dz) || 1;
    nrm.push([-dz / len, dx / len]);
  }
  const NW = NEW_WATER_Y + 0.03;
  for (const s of [-1, 1]) {
    const off = (d) => s * (hw - d);
    wash.pairBand(sampled, nrm, off(-2.4), off(-0.2), GROUND_Y + 0.03, NW, 0.0, 0.5);
    wash.pairBand(sampled, nrm, off(0), off(0.7), NW, NW, 0.48, 0.0);
    wash.pairBand(sampled, nrm, off(1.3), off(2.8), NW, NW, 0.16, 0.0);
    wash.pairBand(sampled, nrm, off(3.4), off(5.0), NW, NW, 0.08, 0.0);
  }
}

/** 外城护城河的岸线湿墨（四条直水带）。 */
function moatWash(wash) {
  const off = MOAT.offset;
  const W = MOAT.width;
  const xA = OUTER_CITY.x0 - off;
  const xB = OUTER_CITY.x1 + off;
  const zA = OUTER_CITY.z0 - off;
  const zB = OUTER_CITY.z1 + off;
  const bands = [
    { p0: [xA - W * 0.5, zA - W], p1: [xA - W * 0.5, zB + W], n: [0, 1] },
    { p0: [xB + W * 0.5, zA - W], p1: [xB + W * 0.5, zB + W], n: [0, 1] },
    { p0: [xA, zA - W * 0.5], p1: [xB, zA - W * 0.5], n: [1, 0] },
    { p0: [xA, zB + W * 0.5], p1: [xB, zB + W * 0.5], n: [1, 0] },
  ];
  for (const b of bands) {
    const pts = [];
    const len = Math.hypot(b.p1[0] - b.p0[0], b.p1[1] - b.p0[1]);
    const n = Math.max(2, Math.round(len / 18));
    for (let i = 0; i <= n; i++) {
      pts.push([
        b.p0[0] + (b.p1[0] - b.p0[0]) * (i / n),
        b.p0[1] + (b.p1[1] - b.p0[1]) * (i / n),
      ]);
    }
    const nrm = pts.map(() => b.n.slice());
    const hw = W / 2;
    const NW = NEW_WATER_Y + 0.03;
    for (const s of [-1, 1]) {
      const offD = (d) => s * (hw - d);
      wash.pairBand(pts, nrm, offD(-2.6), offD(-0.2), GROUND_Y + 0.03, NW, 0.0, 0.4);
      wash.pairBand(pts, nrm, offD(0), offD(1.2), NW, NW, 0.42, 0.0);
      wash.pairBand(pts, nrm, offD(2.6), offD(4.8), NW, NW, 0.1, 0.0);
    }
  }
}

/** 金明池的岸线湿墨。 */
function lakeWash(wash) {
  const lm = CITY_LANDMARKS.find((l) => l.id === 'jinmingchi');
  const cx = lm ? lm.x : -190;
  const cz = lm ? lm.z : -270;
  const R = 118;
  const N = 56;
  const rAt = (a) => R * (1 + 0.07 * Math.sin(a * 3 + 1.3) + 0.045 * Math.sin(a * 7 + 0.4) + 0.03 * Math.cos(a * 5 - 0.8));
  const ring = (f) => {
    const arr = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = rAt(a) * f;
      arr.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
    return arr;
  };
  const r1 = ring(0.955);
  const r0 = ring(1.0);
  const rOut = ring(1.09);
  const rFar = ring(1.24);
  const ink = C.ink;
  const quad = (A0, A1, B0, B1, alphas) => {
    wash.tri([A0[0], A0[2], A0[1]], [B0[0], B0[2], B0[1]], [A1[0], A1[2], A1[1]], ink, [alphas[0], alphas[0], alphas[1]]);
    wash.tri([B0[0], B0[2], B0[1]], [B1[0], B1[2], B1[1]], [A1[0], A1[2], A1[1]], ink, [alphas[0], alphas[1], alphas[1]]);
  };
  void quad;
  const NW = NEW_WATER_Y + 0.03;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    // 水内侧一圈
    wash.tri(
      [r0[i][0], NW, r0[i][1]], [r0[j][0], NW, r0[j][1]], [r1[i][0], NW, r1[i][1]],
      ink, [0.46, 0.46, 0.0],
    );
    wash.tri(
      [r1[i][0], NW, r1[i][1]], [r0[j][0], NW, r0[j][1]], [r1[j][0], NW, r1[j][1]],
      ink, [0.0, 0.46, 0.0],
    );
    // 岸上一圈
    wash.tri(
      [r0[i][0], GROUND_Y + 0.018, r0[i][1]], [r0[j][0], GROUND_Y + 0.018, r0[j][1]], [rOut[i][0], GROUND_Y + 0.018, rOut[i][1]],
      ink, [0.24, 0.24, 0.0],
    );
    wash.tri(
      [rOut[i][0], GROUND_Y + 0.018, rOut[i][1]], [r0[j][0], GROUND_Y + 0.018, r0[j][1]], [rOut[j][0], GROUND_Y + 0.018, rOut[j][1]],
      ink, [0.0, 0.24, 0.0],
    );
    // 更外一圈淡墨
    wash.tri(
      [rOut[i][0], GROUND_Y + 0.018, rOut[i][1]], [rOut[j][0], GROUND_Y + 0.018, rOut[j][1]], [rFar[i][0], GROUND_Y + 0.018, rFar[i][1]],
      ink, [0.08, 0.08, 0.0],
    );
    wash.tri(
      [rFar[i][0], GROUND_Y + 0.018, rFar[i][1]], [rOut[j][0], GROUND_Y + 0.018, rOut[j][1]], [rFar[j][0], GROUND_Y + 0.018, rFar[j][1]],
      ink, [0.0, 0.08, 0.0],
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  船                                                                          */
/* -------------------------------------------------------------------------- */

/** 船身：沿 x 的 U 形壳（龙骨、舷墙、甲板），两头收尖并起翘。 */
function hullGeo({ len, beam, depth = 0.55, keel = 0.45, tipRise = 0.42, N = 11 }) {
  const pos = [];
  const col = [];
  const uv = [];
  const idx = [];
  const cKeel = new THREE.Color(C.keel);
  const cSide = new THREE.Color(C.hull);
  const cGun = new THREE.Color(C.gunwale);
  const cDeck = new THREE.Color(C.deck);
  const decks = [];
  const stations = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = -len / 2 + len * t;
    const tip = Math.abs(2 * t - 1);
    const w = Math.pow(Math.sin(Math.PI * t), 0.55) * (beam / 2);
    const sheer = depth + tipRise * Math.pow(tip, 3.1);
    const keelY = -keel + keel * 0.92 * Math.pow(tip, 2.4);
    stations.push({ x, w, sheer, keelY });
  }
  for (const s of stations) {
    const base = pos.length / 3;
    // 0 龙骨 / 1 左舷顶 / 2 右舷顶 / 3 左甲板边 / 4 右甲板边
    const push = (x, y, z, c) => {
      pos.push(x, y, z);
      col.push(c.r, c.g, c.b);
      uv.push(0, 0);
    };
    push(s.x, s.keelY, 0, cKeel);
    push(s.x, s.sheer, -s.w, cSide);
    push(s.x, s.sheer, s.w, cSide);
    push(s.x, s.sheer - 0.055, -s.w * 0.96, cGun);
    push(s.x, s.sheer - 0.055, s.w * 0.96, cGun);
    decks.push(base);
  }
  for (let i = 0; i < N; i++) {
    const a = decks[i];
    const b = decks[i + 1];
    const quad = (p0, p1, p2, p3) => idx.push(p0, p1, p2, p0, p2, p3);
    quad(a + 0, a + 1, b + 1, b + 0); // 左舷外板
    quad(a + 0, b + 0, b + 2, a + 2); // 右舷外板
    quad(a + 1, a + 3, b + 3, b + 1); // 左舷墙
    quad(a + 2, b + 2, b + 4, a + 4); // 右舷墙
    // 甲板用浅色
    const di = pos.length / 3;
    const l = stations[i];
    const r = stations[i + 1];
    pos.push(l.x, l.sheer - 0.055, -l.w * 0.96, l.x, l.sheer - 0.055, l.w * 0.96,
      r.x, r.sheer - 0.055, r.w * 0.96, r.x, r.sheer - 0.055, -r.w * 0.96);
    for (let k = 0; k < 4; k++) {
      col.push(cDeck.r, cDeck.g, cDeck.b);
      uv.push(0, 0);
    }
    idx.push(di, di + 1, di + 2, di, di + 2, di + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** 拱形篷顶（半椭圆柱 + 两端封头），木船 / 货船的席篷。 */
function archRoofGeo({ len, ry, rz, y0, x0 = 0, segX = 6, segA = 8, color = C.mat, color2 = null, capColor = C.matDark }) {
  const pos = [];
  const col = [];
  const uv = [];
  const idx = [];
  const c1 = new THREE.Color(color);
  const c2 = color2 != null ? new THREE.Color(color2) : c1;
  const cc = new THREE.Color(capColor);
  const ringStart = [];
  for (let i = 0; i <= segX; i++) {
    const x = x0 - len / 2 + (len * i) / segX;
    ringStart.push(pos.length / 3);
    // 席子是一段一段铺的：奇数段用深一号的席色
    const c = i % 2 === 0 ? c1 : c2;
    for (let j = 0; j <= segA; j++) {
      const a = (j / segA) * Math.PI;
      pos.push(x, y0 + Math.sin(a) * ry, Math.cos(a) * rz);
      // 顶部受光、檐口（a 接近 0 / PI）压暗
      const shade = 0.8 + Math.sin(a) * 0.2;
      col.push(c.r * shade, c.g * shade, c.b * shade);
      uv.push(j / segA, i / segX);
    }
  }
  const stride = segA + 1;
  for (let i = 0; i < segX; i++) {
    for (let j = 0; j < segA; j++) {
      const a = ringStart[i] + j;
      const b = a + 1;
      const cIdx = ringStart[i + 1] + j;
      const d = cIdx + 1;
      idx.push(a, cIdx, b, b, cIdx, d);
    }
  }
  // 前后封头（半圆帘）
  for (const end of [0, segX]) {
    const cx = x0 - len / 2 + (len * end) / segX;
    const center = pos.length / 3;
    pos.push(cx, y0, 0);
    col.push(cc.r, cc.g, cc.b);
    uv.push(0, 0);
    const ring = ringStart[end];
    for (let j = 0; j < segA; j++) {
      idx.push(center, ring + j, ring + j + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** 船工：几块方木拼出一个撑篙 / 掌舵的人。 */
function crewParts({ x, y, z, robe = 0x8d8571, hat = 0x776a52, lean = 0, poleTo = null, oarTo = null }) {
  const parts = [];
  const dy = 0;
  parts.push(boxGeo(0.24, 0.56, 0.2, 0x5c5344, { x, y: y + 0.28 + dy, z, rz: lean }));
  parts.push(boxGeo(0.42, 0.62, 0.26, robe, { x: x + Math.sin(lean) * 0.1, y: y + 0.86 + dy, z, rz: lean }));
  parts.push(boxGeo(0.2, 0.22, 0.2, 0xc4ad8c, { x: x + Math.sin(lean) * 0.18, y: y + 1.29 + dy, z, rz: lean }));
  parts.push(coneGeo(0.3, 0.16, 6, hat, { x: x + Math.sin(lean) * 0.18, y: y + 1.46 + dy, z }));
  if (poleTo) parts.push(beamGeo([x + 0.2, y + 0.95, z], poleTo, 0.055, 0.055, C.timber));
  if (oarTo) parts.push(beamGeo([x, y + 0.7, z], oarTo, 0.07, 0.07, C.timberDark));
  return parts;
}

/** 一条船的所有几何（local：x 沿船长、原点在水线、y 向上）。 */
function boatParts(kind, { len, beam }, rng) {
  const parts = [];
  const half = len / 2;

  if (kind === 'sampan') {
    parts.push(hullGeo({ len, beam, depth: 0.38, keel: 0.32, tipRise: 0.3, N: 8 }));
    parts.push(archRoofGeo({ len: len * 0.5, ry: 0.42, rz: beam * 0.5, y0: 0.38, x0: -0.2, segX: 4, segA: 5, color: C.matDark, color2: C.mat }));
    parts.push(boxGeo(0.16, 0.1, beam * 0.5, C.timberDark, { x: half - 0.5, y: 0.42, z: 0 }));
    parts.push(...crewParts({ x: -half * 0.35, y: 0.34, z: 0, robe: 0x7d8470, oarTo: [-half - 1.4, -0.35, 0.2] }));
    parts.push(beamGeo([-half - 0.2, 0.4, 0.2], [half + 0.2, 0.5, -0.2], 0.035, 0.035, C.rope));
    return parts;
  }

  if (kind === 'passenger') {
    parts.push(hullGeo({ len, beam, depth: 0.55, keel: 0.42, tipRise: 0.5, N: 11 }));
    // 客舱：板壁 + 微微出檐的顶
    const cabinL = len * 0.44;
    const cabinH = 1.35;
    const cabinZ = beam * 0.36;
    parts.push(boxGeo(cabinL, cabinH, cabinZ * 2, C.hullLit, { x: -len * 0.02, y: 0.55 + cabinH / 2, z: 0 }));
    parts.push(boxGeo(cabinL + 1.0, 0.14, cabinZ * 2 + 0.8, C.timberDark, { x: -len * 0.02, y: 0.55 + cabinH + 0.06, z: 0 }));
    parts.push(boxGeo(cabinL * 0.86, 0.12, cabinZ * 2 + 0.3, C.matDark, { x: -len * 0.02, y: 0.55 + cabinH + 0.18, z: 0 }));
    parts.push(boxGeo(cabinL + 0.9, 0.1, cabinZ * 2 + 0.9, C.timber, { x: -len * 0.02, y: 0.55 + cabinH - 0.1, z: 0 }));
    // 窗（黑洞 + 窗棂）
    for (let i = 0; i < 3; i++) {
      const wx = -len * 0.02 - cabinL * 0.3 + i * cabinL * 0.3;
      for (const sz of [-1, 1]) {
        parts.push(boxGeo(0.7, 0.5, 0.06, 0x2a2822, { x: wx, y: 0.55 + cabinH * 0.62, z: sz * (cabinZ + 0.01) }));
        parts.push(boxGeo(0.05, 0.5, 0.08, C.timberDark, { x: wx, y: 0.55 + cabinH * 0.62, z: sz * (cabinZ + 0.02) }));
      }
    }
    // 船头船尾栏杆
    for (const sx of [-1, 1]) {
      const cx = sx * (half - 1.0);
      for (const sz of [-1, 1]) {
        parts.push(boxGeo(0.07, 0.6, 0.07, C.timber, { x: cx - sx * 1.2, y: 0.55 + 0.3, z: sz * beam * 0.34 }));
        parts.push(boxGeo(0.07, 0.6, 0.07, C.timber, { x: cx, y: 0.55 + 0.3, z: sz * beam * 0.3 }));
      }
      parts.push(beamGeo([cx - sx * 1.2, 0.55 + 0.6, -beam * 0.33], [cx, 0.55 + 0.6, -beam * 0.3], 0.05, 0.05, C.timberDark));
      parts.push(beamGeo([cx - sx * 1.2, 0.55 + 0.6, beam * 0.33], [cx, 0.55 + 0.6, beam * 0.3], 0.05, 0.05, C.timberDark));
    }
    // 桅 + 小旗
    parts.push(cylGeo(0.075, 0.1, 5.2, 6, C.timber, { x: len * 0.24, y: 0.55 + 2.6 }));
    parts.push(boxGeo(0.03, 0.7, 0.8, C.red, { x: len * 0.24 + 0.02, y: 0.55 + 4.8, z: 0.42 }));
    // 红灯笼两盏
    for (const sz of [-1, 1]) parts.push(sphereGeo(0.2, 6, 4, 0xb8442c, { x: len * 0.17, y: 0.55 + 1.03, z: sz * (cabinZ + 0.06) }));
    // 橹
    parts.push(beamGeo([-len * 0.3, 0.78, -beam * 0.5], [half + 1.0, 0.1, -beam * 0.55], 0.06, 0.06, C.timberDark));
    parts.push(beamGeo([-len * 0.3, 0.78, beam * 0.5], [half + 1.0, 0.1, beam * 0.55], 0.06, 0.06, C.timberDark));
    parts.push(boxGeo(0.24, 0.9, 0.5, C.timberDark, { x: -half + 0.4, y: -0.06, z: 0, rx: 0.12 }));
    return parts;
  }

  // —— 货船 / 漕船 ——
  parts.push(hullGeo({ len, beam, depth: 0.62, keel: 0.5, tipRise: 0.55, N: 12 }));
  // 舷边压条 + 舱板横梁：让船身从上方看也有结构
  for (const sz of [-1, 1]) {
    parts.push(boxGeo(len * 0.72, 0.1, 0.16, C.gunwale, { x: 0, y: 0.6, z: sz * beam * 0.43 }));
  }
  for (let i = 0; i < 4; i++) {
    const x = -len * 0.28 + i * (len * 0.18);
    parts.push(boxGeo(0.2, 0.09, beam * 0.8, C.deckDark, { x, y: 0.57, z: 0 }));
  }
  // 拱形席篷（比船身收窄一点，前后留出甲板）
  const cabinLen = len * 0.44;
  const cabinRy = beam * 0.27;
  const cabinRz = beam * 0.35;
  parts.push(archRoofGeo({
    len: cabinLen,
    ry: cabinRy,
    rz: cabinRz,
    y0: 0.6,
    x0: -len * 0.04,
    segX: 8,
    segA: 8,
    color: C.mat,
    color2: C.matDark,
    capColor: C.matDark,
  }));
  // 篷檐的两道深色压条
  for (const sz of [-1, 1]) {
    parts.push(boxGeo(cabinLen, 0.09, 0.12, C.matDark, { x: -len * 0.04, y: 0.64, z: sz * cabinRz * 0.99 }));
  }
  // 篷前舱门（黑）
  parts.push(boxGeo(0.95, 0.78, 0.12, 0x1f1d18, { x: -len * 0.04 + cabinLen / 2 + 0.02, y: 0.99, z: 0 }));
  // 船尾小舱（艄棚）
  const sternX = -len * 0.34;
  parts.push(boxGeo(2.5, 0.95, beam * 0.5, C.hullLit, { x: sternX, y: 0.6 + 0.48, z: 0 }));
  parts.push(boxGeo(2.9, 0.14, beam * 0.62, C.matDark, { x: sternX, y: 0.6 + 1.0, z: 0 }));
  parts.push(boxGeo(0.7, 0.6, 0.1, 0x1f1d18, { x: sternX + 1.28, y: 0.98, z: 0 }));
  // 桅杆 + 缆绳
  const mastX = len * 0.2;
  const mastH = len * 0.38;
  parts.push(cylGeo(0.09, 0.13, mastH, 6, C.timberDark, { x: mastX, y: 0.62 + mastH / 2 }));
  parts.push(boxGeo(0.1, 0.1, len * 0.34, C.timber, { x: mastX, y: 0.62 + mastH * 0.82 }));
  parts.push(beamGeo([mastX, 0.62 + mastH * 0.82, 0], [half - 0.6, 0.72, 0], 0.035, 0.035, C.rope));
  parts.push(beamGeo([mastX, 0.62 + mastH * 0.82, 0], [-half + 0.6, 0.72, 0], 0.035, 0.035, C.rope));
  // 船头货堆
  for (let i = 0; i < 4; i++) {
    const cx = len * 0.26 + (i % 2) * 1.3;
    const cz = (i % 3) * 0.8 - 0.8;
    parts.push(boxGeo(1.15, 0.8, 0.9, i % 2 ? C.cargo : C.cargoDark, { x: cx, y: 0.62 + 0.4 + (i > 1 ? 0.8 : 0), z: cz }));
  }
  parts.push(sphereGeo(0.55, 7, 5, C.sack, { x: len * 0.42, y: 0.62 + 0.4, z: 0.8 }));
  parts.push(sphereGeo(0.5, 7, 5, C.sack, { x: len * 0.4, y: 0.62 + 0.35, z: -0.7 }));
  // 船尾舵与橹
  parts.push(boxGeo(0.2, 1.15, 0.7, C.timberDark, { x: -half + 0.5, y: -0.12, z: 0, rx: 0.1 }));
  parts.push(beamGeo([-len * 0.38, 0.75, 0], [-half - 1.6, -0.15, 0.35], 0.09, 0.09, C.timberDark));
  // 两侧长桨（收着）
  parts.push(beamGeo([-len * 0.18, 0.75, -beam * 0.48], [half - 0.8, 0.72, -beam * 0.52], 0.06, 0.06, C.timber));
  parts.push(beamGeo([-len * 0.18, 0.75, beam * 0.48], [half - 0.8, 0.72, beam * 0.52], 0.06, 0.06, C.timber));
  // 船尾一根小旗杆
  parts.push(cylGeo(0.04, 0.05, 2.2, 5, C.timber, { x: -half + 0.9, y: 0.62 + 1.1 }));
  parts.push(boxGeo(0.02, 0.5, 0.6, C.red, { x: -half + 0.9, y: 0.62 + 1.9, z: 0.35 }));
  return parts;
}

/** 大货船：船身与桅杆分开（桅杆要放倒）。 */
function bigBoatParts() {
  const len = 26;
  const beam = 5.4;
  const half = len / 2;
  const parts = [];
  parts.push(hullGeo({ len, beam, depth: 0.85, keel: 0.55, tipRise: 0.75, N: 14 }));
  // 舷边压条 + 舱板横梁
  for (const sz of [-1, 1]) {
    parts.push(boxGeo(19, 0.16, 0.24, C.gunwale, { x: 0, y: 0.86, z: sz * beam * 0.43 }));
  }
  for (let i = 0; i < 5; i++) {
    const x = -9.5 + i * 4.6;
    parts.push(boxGeo(0.28, 0.14, beam * 0.82, C.deckDark, { x, y: 0.8, z: 0 }));
  }
  // 大席篷（比船身收窄，前后留出甲板）
  parts.push(archRoofGeo({ len: 13.4, ry: 1.75, rz: 2.15, y0: 0.88, x0: -1.2, segX: 9, segA: 9, color: C.mat, color2: C.matDark, capColor: C.matDark }));
  for (const sz of [-1, 1]) {
    parts.push(boxGeo(13.4, 0.11, 0.16, C.matDark, { x: -1.2, y: 0.94, z: sz * 2.12 }));
  }
  // 篷两端黑门洞
  parts.push(boxGeo(1.2, 0.9, 0.14, 0x1f1d18, { x: -1.2 + 6.72, y: 1.3, z: 0 }));
  parts.push(boxGeo(1.2, 0.9, 0.14, 0x1f1d18, { x: -1.2 - 6.72, y: 1.3, z: 0 }));
  // 前舱门
  parts.push(boxGeo(1.1, 0.95, 0.12, 0x2a2823, { x: -1.4 + 7.0, y: 1.35, z: 0 }));
  // 船头甲板与货堆
  for (let i = 0; i < 6; i++) {
    const cx = 7.4 + (i % 3) * 1.6;
    const cz = ((i % 2) * 2 - 1) * 1.0;
    parts.push(boxGeo(1.45, 0.95, 1.0, i % 2 ? C.cargo : C.cargoDark, { x: cx, y: 0.9 + 0.48 + (i > 2 ? 0.95 : 0), z: cz }));
  }
  parts.push(sphereGeo(0.7, 8, 5, C.sack, { x: 9.8, y: 0.9 + 0.5, z: 1.4 }));
  parts.push(sphereGeo(0.6, 8, 5, C.sack, { x: 10.2, y: 0.9 + 0.45, z: -1.2 }));
  parts.push(boxGeo(2.4, 0.12, 3.0, C.cloth, { x: 9.6, y: 1.9, z: 0, rz: 0.04 }));
  // 船尾甲板
  parts.push(boxGeo(3.4, 0.35, 4.2, C.deckDark, { x: -10.4, y: 0.92, z: 0 }));
  parts.push(boxGeo(1.2, 0.7, 1.0, C.cargo, { x: -10.2, y: 1.4, z: 1.1 }));
  parts.push(boxGeo(1.0, 0.55, 0.8, C.cargoDark, { x: -10.6, y: 1.3, z: -1.2 }));
  // 舵 / 尾橹
  parts.push(boxGeo(0.24, 1.7, 0.9, C.timberDark, { x: -half + 0.5, y: -0.2, z: 0, rx: 0.08 }));
  parts.push(beamGeo([-8.4, 0.95, 1.2], [-half - 2.6, -0.4, 2.4], 0.1, 0.1, C.timberDark));
  parts.push(beamGeo([-8.4, 0.95, -1.2], [-half - 2.6, -0.4, -2.4], 0.1, 0.1, C.timberDark));
  // 船工 4 人：船头撑篙、篷顶收帆、船尾掌舵
  parts.push(...crewParts({ x: 9.5, y: 0.92, z: 0.4, robe: 0x6c705d, poleTo: [14.2, -0.42, 0.9] }));
  parts.push(...crewParts({ x: 11.2, y: 0.92, z: -0.9, robe: 0x7d7a66 }));
  parts.push(...crewParts({ x: -9.6, y: 0.95, z: 0.2, robe: 0x616b5c, oarTo: [-14.2, -0.45, 1.6] }));
  // 爬上席篷顶收帆的人
  parts.push(...crewParts({ x: -3.2, y: 0.88 + 1.55, z: -1.2, robe: 0x7a7562, lean: -0.25 }));
  // 船头两根引缆（系到桅杆的缆在桅杆几何里）+ 两盏红灯笼
  parts.push(beamGeo([11.4, 1.0, 0], [12.9, 0.62, 0], 0.05, 0.05, C.rope));
  for (const sz of [-1, 1]) {
    parts.push(cylGeo(0.045, 0.045, 0.7, 4, C.timberDark, { x: 11.9, y: 1.5, z: sz * 1.7 }));
    parts.push(sphereGeo(0.3, 7, 5, 0x9c3a22, { x: 11.9, y: 1.15, z: sz * 1.7 }));
  }
  // 船头一点红布
  parts.push(boxGeo(0.05, 0.8, 0.9, C.red, { x: 12.6, y: 2.0, z: 0 }));
  return { parts, mast: { x: 6.9, y: 0.9, z: 0 } };
}

/** 大船的桅杆（局部原点在桅座，向上是杆身）。 */
function bigMastParts() {
  const parts = [];
  const H = 11.0;
  parts.push(cylGeo(0.26, 0.38, H, 7, 0x2a2118, { y: H / 2 }));
  // 横桁
  parts.push(boxGeo(0.32, 0.32, 7.0, 0x30261b, { y: H * 0.84 }));
  // 卷起的帆
  parts.push(boxGeo(0.72, 0.72, 6.4, 0x8a7d63, { y: H * 0.78, z: 0 }));
  parts.push(boxGeo(0.26, 0.26, 6.8, 0x2a2118, { y: H * 0.8, z: 0 }));
  // 四根张索
  parts.push(beamGeo([0, H * 0.82, 0], [7.6, -0.3, 0.4], 0.07, 0.07, C.rope));
  parts.push(beamGeo([0, H * 0.82, 0], [-8.2, -0.3, -0.4], 0.07, 0.07, C.rope));
  parts.push(beamGeo([0, H * 0.54, 0], [8.0, 0.2, -1.8], 0.06, 0.06, C.rope));
  parts.push(beamGeo([0, H * 0.54, 0], [-8.0, 0.2, 1.8], 0.06, 0.06, C.rope));
  // 顶上小旗
  parts.push(boxGeo(0.05, 0.9, 1.2, C.red, { y: H * 0.95 + 0.4, z: 0.6 }));
  return parts;
}

/* -------------------------------------------------------------------------- */
/*  码头                                                                        */
/* -------------------------------------------------------------------------- */

/** 木栈桥 + 台阶 + 桩 + 系缆桩 + 货堆 + 苇席棚（全部世界坐标）。 */
function dockParts(rng) {
  const parts = [];
  const DECK_Y = 0.74;

  /**
   * 伸进水里的一段木栈桥。
   * side = -1 北岸 / +1 南岸；from = 岸上留的长，reach = 伸进水里的长。
   */
  function platform({ x, side, from = 0.7, reach = 6.2, width = 4.2, rails = true }) {
    const bankZ = side < 0 ? northBankZ(x) : southBankZ(x);
    // 北岸：陆地是更小的 z；南岸：陆地是更大的 z
    const zLand = bankZ + side * from;
    const zWater = bankZ - side * reach;
    const zMid = (zLand + zWater) / 2;
    const len = Math.abs(zWater - zLand);
    // 桥面 + 板缝
    parts.push(boxGeo(width, 0.15, len, C.deckDark, { x, y: DECK_Y, z: zMid }));
    for (let i = 0; i < 8; i++) {
      const z = zLand + (zWater - zLand) * ((i + 0.5) / 8);
      parts.push(boxGeo(width - 0.16, 0.03, 0.08, C.keel, { x, y: DECK_Y + 0.09, z }));
    }
    // 水里的木桩
    for (const sx of [-1, 1]) {
      for (const t of [0.3, 0.62, 0.94]) {
        const z = zLand + (zWater - zLand) * t;
        parts.push(cylGeo(0.11, 0.14, 1.8, 5, C.timberDark, { x: x + sx * (width / 2 - 0.18), y: DECK_Y - 0.9, z }));
      }
    }
    // 两侧矮栏杆
    if (rails) {
      for (const sx of [-1, 1]) {
        const px = x + sx * (width / 2 - 0.08);
        for (let t = 0.12; t < 0.96; t += 0.19) {
          const z = zLand + (zWater - zLand) * t;
          parts.push(boxGeo(0.1, 0.78, 0.1, C.timber, { x: px, y: DECK_Y + 0.45, z }));
        }
        parts.push(beamGeo(
          [px, DECK_Y + 0.84, zLand + (zWater - zLand) * 0.08],
          [px, DECK_Y + 0.84, zWater - (zWater - zLand) * 0.08],
          0.06, 0.06, C.timberDark,
        ));
      }
    }
    // 台阶：从岸顶 (1.2) 下到桥面 (0.74)
    for (let i = 0; i < 3; i++) {
      const h = (GROUND_Y - DECK_Y) * ((3 - i) / 3);
      const z = zLand + side * (0.25 + i * 0.42);
      parts.push(boxGeo(width * 0.78, h, 0.46, C.timber, { x, y: h / 2, z }));
    }
    // 栈桥头两根高桩 + 横担（挂灯）
    for (const sx of [-1, 1]) {
      const px = x + sx * (width / 2 - 0.14);
      parts.push(cylGeo(0.1, 0.13, 2.7, 5, C.timberDark, { x: px, y: DECK_Y + 1.2, z: zWater + side * 0.35 }));
    }
    parts.push(boxGeo(width + 0.3, 0.1, 0.13, C.timberDark, { x, y: DECK_Y + 2.32, z: zWater + side * 0.35 }));
    parts.push(sphereGeo(0.2, 6, 4, 0x8d3c26, { x, y: DECK_Y + 2.0, z: zWater + side * 0.35 }));
    // 系缆桩
    for (const sx of [-1, 1]) {
      parts.push(cylGeo(0.15, 0.17, 0.62, 6, C.timberDark, { x: x + sx * (width / 2 - 0.5), y: DECK_Y + 0.37, z: zWater + side * 1.0 }));
      parts.push(cylGeo(0.2, 0.2, 0.08, 6, C.keel, { x: x + sx * (width / 2 - 0.5), y: DECK_Y + 0.72, z: zWater + side * 1.0 }));
    }
    return { x, side, zWater, zLand, deckY: DECK_Y, width };
  }

  /** 往栈桥上堆货（世界坐标，zTowardLand 表示离水端往岸上偏移的米数）。 */
  function cargoOnDock(d, items) {
    for (const [dx, dLand, h, w, color] of items) {
      parts.push(boxGeo(w, h, w * 0.82, color, { x: d.x + dx, y: d.deckY + h / 2, z: d.zWater + d.side * dLand }));
    }
  }

  // —— 北岸西栈桥 ——
  const dA = platform({ x: -33, side: -1, from: 0.7, reach: 6.4, width: 4.4 });
  cargoOnDock(dA, [
    [-1.2, 1.5, 0.8, 1.1, C.cargo],
    [0.0, 1.6, 0.75, 1.0, C.cargoDark],
    [1.2, 1.4, 0.8, 1.1, C.cargo],
    [-1.0, 2.6, 0.7, 1.0, C.cargoDark],
    [0.1, 2.7, 1.5, 1.0, C.cargo],
    [1.3, 3.9, 0.85, 1.1, C.cargoDark],
  ]);
  parts.push(sphereGeo(0.55, 7, 5, C.sack, { x: -31.6, y: dA.deckY + 0.4, z: dA.zWater + dA.side * 4.3 }));
  parts.push(sphereGeo(0.5, 7, 5, C.sack, { x: -32.5, y: dA.deckY + 0.38, z: dA.zWater + dA.side * 5.0 }));
  parts.push(cylGeo(0.32, 0.36, 0.7, 7, C.timber, { x: -34.2, y: dA.deckY + 0.35, z: dA.zWater + dA.side * 4.6 }));
  parts.push(cylGeo(0.32, 0.36, 0.7, 7, C.timber, { x: -35.0, y: dA.deckY + 0.35, z: dA.zWater + dA.side * 3.3 }));
  parts.push(cylGeo(0.3, 0.34, 0.5, 7, C.matDark, { x: -31.0, y: dA.deckY + 0.6, z: dA.zWater + dA.side * 3.6 }));

  // 岸上的苇席棚（A），就在栈桥头
  {
    const x = -37.6;
    const z = northBankZ(x) - 3.4;
    const y = GROUND_Y;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(cylGeo(0.09, 0.1, 2.6, 5, C.timberDark, { x: x + sx * 1.55, y: y + 1.3, z: z + sz * 1.25 }));
      }
    }
    parts.push(boxGeo(3.7, 0.16, 3.0, C.mat, { x, y: y + 2.5, z, rx: 0.1 }));
    parts.push(boxGeo(3.7, 0.1, 3.0, C.matDark, { x, y: y + 2.66, z: z + 0.4, rx: 0.12 }));
    parts.push(boxGeo(3.2, 0.8, 0.16, C.matDark, { x, y: y + 0.4, z: z - 1.3 }));
    parts.push(boxGeo(2.4, 0.75, 0.9, C.timber, { x, y: y + 0.75, z: z + 0.5 }));
    for (let i = 0; i < 3; i++) {
      parts.push(cylGeo(0.09, 0.11, 0.1, 6, 0xcfc3a4, { x: x - 0.6 + i * 0.6, y: y + 1.17, z: z + 0.5 }));
    }
  }

  // —— 北岸东栈桥 ——
  const dB = platform({ x: 24, side: -1, from: 0.6, reach: 5.8, width: 4.0 });
  cargoOnDock(dB, [
    [-1.0, 1.4, 0.8, 1.05, C.cargoDark],
    [0.2, 1.5, 0.75, 1.0, C.cargo],
    [1.1, 2.7, 0.8, 1.0, C.cargoDark],
    [-0.4, 3.2, 0.7, 0.95, C.cargo],
  ]);
  parts.push(sphereGeo(0.5, 6, 5, C.sack, { x: 25.7, y: dB.deckY + 0.36, z: dB.zWater + dB.side * 3.8 }));
  parts.push(cylGeo(0.3, 0.34, 0.5, 7, C.matDark, { x: 22.6, y: dB.deckY + 0.6, z: dB.zWater + dB.side * 2.6 }));

  // —— 南岸小埠头（近景，桥西） ——
  const dC = platform({ x: -30, side: 1, from: 0.6, reach: 5.2, width: 3.6, rails: false });
  cargoOnDock(dC, [
    [-0.9, 1.2, 0.7, 1.0, C.cargo],
    [0.5, 1.4, 0.65, 0.9, C.cargoDark],
    [0.0, 2.5, 0.7, 1.0, C.cargo],
  ]);
  parts.push(cylGeo(0.32, 0.36, 0.7, 7, C.timber, { x: -31.3, y: dC.deckY + 0.35, z: dC.zWater + dC.side * 3.2 }));

  // —— 南岸茶棚（近景） ——
  {
    const x = -33.0;
    const z = southBankZ(x) + 3.8;
    const y = GROUND_Y;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(cylGeo(0.085, 0.095, 2.5, 5, C.timber, { x: x + sx * 1.9, y: y + 1.25, z: z + sz * 1.5 }));
      }
    }
    parts.push(boxGeo(4.3, 0.15, 3.5, C.cloth, { x, y: y + 2.55, z, rx: 0.08 }));
    parts.push(boxGeo(4.3, 0.1, 0.5, C.clothBlue, { x, y: y + 2.72, z: z - 1.5, rx: 0.1 }));
    parts.push(boxGeo(2.8, 0.7, 1.0, C.timber, { x, y: y + 0.62, z: z + 0.7 }));
    for (let i = 0; i < 4; i++) {
      parts.push(cylGeo(0.1, 0.12, 0.09, 6, 0xcfc3a4, { x: x - 0.9 + i * 0.6, y: y + 1.0, z: z + 0.7 }));
    }
  }

  // —— 岸边的桩、水缸、竹竿 ——
  for (const p of [
    { x: -27.2, z: northBankZ(-27.2) - 2.0 },
    { x: -13.5, z: southBankZ(-13.5) + 2.4 },
    { x: 27.5, z: southBankZ(27.5) + 2.6 },
  ]) {
    parts.push(cylGeo(0.09, 0.11, 0.9, 5, C.timberDark, { x: p.x, y: GROUND_Y + 0.45, z: p.z }));
    parts.push(sphereGeo(0.36, 7, 5, 0x8f8874, { x: p.x + 0.9, y: GROUND_Y + 0.3, z: p.z - 0.6 }));
    parts.push(beamGeo([p.x + 1.6, GROUND_Y, p.z + 0.4], [p.x + 0.7, GROUND_Y + 2.4, p.z + 0.2], 0.05, 0.05, C.timber));
  }

  // —— 泊船缆绳（把静船系在栈桥的桩上） ——
  const ropes = [
    [[-36.0, 1.02, -8.6], [-34.6, 0.95, -6.0]],
    [[-41.0, 1.0, -8.6], [-33.2, 0.95, -10.8]],
    [[-76.0, 1.0, -8.2], [-37.0, 1.05, -13.2]],
    [[28.6, 1.0, -8.9], [25.0, 0.95, -6.2]],
    [[-27.4, 1.0, 25.0], [-28.6, 0.9, 27.2]],
    [[-13.2, 1.0, 24.9], [-8.6, 1.2, 28.6]],
  ];
  for (const [a, b] of ropes) parts.push(beamGeo(a, b, 0.04, 0.04, C.rope));

  // —— 纤绳：从货船船头拉到北岸纤夫手里 ——
  parts.push(beamGeo([-60.0, 5.6, -9.0], [-47.0, 2.2, -15.4], 0.045, 0.045, C.rope));
  parts.push(beamGeo([-47.0, 2.2, -15.4], [-43.6, 1.85, -15.2], 0.045, 0.045, C.rope));

  return parts;
}

/* -------------------------------------------------------------------------- */
/*  苇草                                                                        */
/* -------------------------------------------------------------------------- */

function buildReeds(rng) {
  const pos = [];
  const col = [];
  const cBot = new THREE.Color(C.reed);
  const cTop = new THREE.Color(C.reedTip);
  const tmp = new THREE.Color();

  function blade(x, z, y0, h, dx, dz, halfW, tone) {
    // 两个交叉的窄三角，俯视也有体积
    for (let k = 0; k < 2; k++) {
      const px = k === 0 ? -dz * halfW : dx * halfW;
      const pz = k === 0 ? dx * halfW : dz * halfW;
      const sway = 0.22 + rng() * 0.2;
      const tx = x + dx * h * sway + (rng() - 0.5) * 0.12;
      const tz = z + dz * h * sway + (rng() - 0.5) * 0.12;
      const base = pos.length / 3;
      pos.push(x - px, y0, z - pz, x + px, y0, z + pz, tx, y0 + h, tz);
      tmp.copy(cBot).lerp(cTop, tone);
      col.push(tmp.r, tmp.g, tmp.b, tmp.r, tmp.g, tmp.b);
      tmp.copy(cTop);
      col.push(tmp.r, tmp.g, tmp.b);
      void base;
    }
  }

  function clump(x, z, baseY, scale, lean) {
    const n = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const ox = Math.cos(a) * 0.3 * scale;
      const oz = Math.sin(a) * 0.3 * scale;
      blade(
        x + ox,
        z + oz,
        baseY,
        (1.9 + rng() * 1.8) * scale,
        lean,
        0,
        0.05 + rng() * 0.04,
        rng() > 0.45 ? 1 : 0.35,
      );
    }
  }

  // 南岸（近景）密一些
  for (let x = -292; x < 196; x += 4.6) {
    if (rng() < 0.22) continue;
    const bank = southBankZ(x);
    const inWater = rng() < 0.45;
    clump(x + (rng() - 0.5) * 3, bank + (inWater ? 0.4 + rng() * 1.4 : -0.5 - rng() * 1.6), inWater ? WATER_Y - 0.05 : GROUND_Y, 0.9 + rng() * 0.8, -1);
  }
  // 北岸疏一些
  for (let x = -292; x < 196; x += 6.2) {
    if (rng() < 0.32) continue;
    const bank = northBankZ(x);
    clump(x + (rng() - 0.5) * 4, bank - (rng() < 0.4 ? -0.5 - rng() * 1.2 : 0.5 + rng() * 1.2), rng() < 0.4 ? GROUND_Y : WATER_Y - 0.05, 0.85 + rng() * 0.6, 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'river-reeds';
  mesh.renderOrder = 14;
  mesh.frustumCulled = false;
  return mesh;
}

/** 沿运河折线取一点（t: 0~1 按路径长度）。 */
function canalPoint(canal, t) {
  const pts = canal.path;
  let total = 0;
  const lens = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    lens.push(l);
    total += l;
  }
  let d = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const k = lens[i] ? d / lens[i] : 0;
      const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k;
      const z = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k;
      const dx = pts[i + 1][0] - pts[i][0];
      const dz = pts[i + 1][1] - pts[i][1];
      const l = Math.hypot(dx, dz) || 1;
      return { x, z, dx: dx / l, dz: dz / l };
    }
    d -= lens[i];
  }
  return { x: pts[0][0], z: pts[0][1], dx: 1, dz: 0 };
}

/** 运河小桥：横跨运河，桥轴垂直于河。style: stone | wood */
function canalBridgeParts(parts, { x, z, dx, dz, span, width, style = 'stone' }) {
  const ux = -dz;
  const uz = dx;
  const yaw = Math.atan2(-uz, ux);
  const rise = style === 'stone' ? 2.6 : 1.5;
  const base = GROUND_Y + 0.12;
  const N = 7;
  const at = (u, v) => [x + ux * u - uz * v, z + uz * u + ux * v];
  const yAt = (u) => base + rise * (1 - Math.pow((2 * u) / span, 2));
  for (let i = 0; i < N; i++) {
    const u0 = -span / 2 + (span * i) / N;
    const u1 = -span / 2 + (span * (i + 1)) / N;
    const um = (u0 + u1) / 2;
    const [cx, cz] = at(um, 0);
    const slope = (yAt(u1) - yAt(u0)) / (u1 - u0);
    const segLen = Math.hypot(u1 - u0, yAt(u1) - yAt(u0)) + 0.08;
    parts.push(boxGeo(segLen, 0.34, width, style === 'stone' ? C.stoneLight : C.deck, {
      x: cx, y: (yAt(u0) + yAt(u1)) / 2, z: cz, ry: yaw, rz: Math.atan(slope),
    }));
    for (const s of [-1, 1]) {
      const [sx2, sz2] = at(um, s * (width / 2 - 0.16));
      parts.push(boxGeo(segLen, 0.5, 0.24, style === 'stone' ? C.stone : C.timberDark, {
        x: sx2, y: (yAt(u0) + yAt(u1)) / 2 - 0.12, z: sz2, ry: yaw, rz: Math.atan(slope),
      }));
      parts.push(boxGeo(segLen, 0.55, 0.16, style === 'stone' ? C.stone : C.rail, {
        x: sx2, y: (yAt(u0) + yAt(u1)) / 2 + 0.75, z: sz2, ry: yaw, rz: Math.atan(slope),
      }));
    }
  }
  for (const u of [-span / 2, 0, span / 2]) {
    for (const s of [-1, 1]) {
      const [px, pz] = at(u, s * (width / 2 - 0.14));
      parts.push(boxGeo(0.36, 1.5, 0.36, style === 'stone' ? C.stoneLight : C.post, { x: px, y: yAt(u) + 0.6, z: pz, ry: yaw }));
      if (style === 'stone') parts.push(boxGeo(0.46, 0.16, 0.46, C.stoneDark, { x: px, y: yAt(u) + 1.4, z: pz, ry: yaw }));
    }
  }
  for (const s of [-1, 1]) {
    const [ax, az2] = at(s * (span / 2 + 0.6), 0);
    if (style === 'stone') {
      parts.push(boxGeo(1.7, 1.6, width + 1.2, C.stoneDark, { x: ax, y: GROUND_Y - 0.3, z: az2, ry: yaw }));
    } else {
      for (const ss of [-1, 1]) {
        parts.push(cylGeo(0.16, 0.19, 1.5, 5, C.timberDark, { x: ax, y: GROUND_Y - 0.65, z: az2 + ss * (width / 2 - 0.3) }));
      }
    }
  }
  if (style === 'stone') {
    for (const s of [-1, 1]) {
      const n2 = 6;
      const yy = (u) => GROUND_Y - 0.15 - 1.5 * (1 - Math.pow((2 * u) / span, 2));
      for (let i = 0; i < n2; i++) {
        const u0 = -span / 2 + (span * i) / n2;
        const u1 = -span / 2 + (span * (i + 1)) / n2;
        const [x0, z0] = at(u0, s * (width / 2 - 0.5));
        const [x1, z1] = at(u1, s * (width / 2 - 0.5));
        parts.push(beamGeo([x0, yy(u0), z0], [x1, yy(u1), z1], 0.5, 0.7, i % 2 ? C.stone : C.stoneDark));
      }
    }
  }
}

/** 龙舟：细长船身 + 龙头 + 鼓 + 桨 */
function dragonBoatParts(len = 17) {
  const parts = [];
  const beam = 2.8;
  parts.push(hullGeo({ len, beam, depth: 0.5, keel: 0.3, tipRise: 0.65, N: 10 }));
  const bx = len / 2 - 0.4;
  parts.push(boxGeo(1.6, 0.7, 0.7, C.timberDark, { x: bx + 0.9, y: 1.5, z: 0 }));
  parts.push(boxGeo(0.9, 0.7, 0.55, C.red, { x: bx + 1.9, y: 1.75, z: 0 }));
  parts.push(coneGeo(0.3, 0.9, 5, C.timber, { x: bx + 2.3, y: 1.9, z: 0.18, rz: -1.1 }));
  parts.push(coneGeo(0.3, 0.9, 5, C.timber, { x: bx + 2.3, y: 1.9, z: -0.18, rz: -1.1 }));
  parts.push(sphereGeo(0.16, 6, 4, 0xd8c07a, { x: bx + 1.75, y: 2.05, z: 0.22 }));
  parts.push(sphereGeo(0.16, 6, 4, 0xd8c07a, { x: bx + 1.75, y: 2.05, z: -0.22 }));
  parts.push(beamGeo([-len / 2 + 0.3, 0.8, 0], [-len / 2 - 2.2, 2.2, 0], 0.3, 0.3, C.timberDark));
  parts.push(cylGeo(0.7, 0.7, 0.75, 10, C.red, { x: 0, y: 1.05, z: 0, rz: Math.PI / 2 }));
  for (let i = 0; i < 6; i++) {
    const x = -len * 0.32 + i * (len * 0.13);
    for (const sz of [-1, 1]) {
      parts.push(beamGeo([x, 0.75, sz * beam * 0.42], [x - 0.9, 0.15, sz * (beam * 0.42 + 1.4)], 0.09, 0.09, C.timber));
    }
  }
  parts.push(cylGeo(0.06, 0.07, 2.6, 4, C.timber, { x: -1.2, y: 1.6 }));
  parts.push(boxGeo(0.04, 0.8, 1.0, C.red, { x: -1.2, y: 2.7, z: 0.55 }));
  return parts;
}

/** 画舫：客船加彩棚 + 幡 + 灯 */
function paintedBoatParts(accents, len = 13) {
  const parts = boatParts('passenger', { len, beam: 3.4 }, makeRng(7788));
  parts.push(boxGeo(len * 0.34, 0.12, 3.4, C.cloth, { x: -1.2, y: 2.2, z: 0 }));
  for (const sz of [-1, 1]) {
    parts.push(cylGeo(0.06, 0.06, 1.1, 4, C.timber, { x: -1.2, y: 1.75, z: sz * 1.5 }));
  }
  accents.banner.push(place(clothBannerGeo(1.0, 2.2), { x: -1.0, y: 4.0, z: 0.8 }));
  accents.banner.push(place(clothBannerGeo(1.0, 2.2), { x: -1.4, y: 4.0, z: -0.8 }));
  for (const [x, z] of [[1.6, 1.1], [1.6, -1.1], [-3.6, 1.1], [-3.6, -1.1]]) {
    accents.lantern.push(sphereGeo(0.26, 6, 4, 0xffffff, { x, y: 1.9, z }));
  }
  return parts;
}

/** 新水系岸边的人（船工/挑水/纤夫/游人）。 */
function pushWaterwayPeople(ctx) {
  const people = ctx.people;
  if (!Array.isArray(people)) return;
  const kinds = ['walker', 'porter', 'boatman', 'lady', 'child', 'scholar', 'vendor'];
  const shore = (canal, t, side, off, kind, span = 0) => {
    const p = canalPoint(canal, t);
    people.push({
      kind,
      x: p.x - p.dz * side * off,
      z: p.z + p.dx * side * off,
      y: GROUND_Y,
      dir: [p.dx, p.dz],
      span,
    });
  };
  for (let i = 0; i < 10; i++) {
    shore(CANALS.caihe, (i + 0.5) / 10, i % 2 ? 1 : -1, CANALS.caihe.width / 2 + 2.6, kinds[i % kinds.length], i % 3 === 0 ? 3 : 0);
  }
  for (let i = 0; i < 4; i++) {
    shore(CANALS.wuzhanghe, (i + 0.5) / 4, i % 2 ? 1 : -1, CANALS.wuzhanghe.width / 2 + 2.2, kinds[(i + 2) % kinds.length]);
    shore(CANALS.jinshuihe, (i + 0.5) / 4, i % 2 ? 1 : -1, CANALS.jinshuihe.width / 2 + 2.0, kinds[(i + 4) % kinds.length]);
  }
  const lm = CITY_LANDMARKS.find((l) => l.id === 'jinmingchi') || { x: -190, z: -270 };
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    people.push({
      kind: kinds[(i + 1) % kinds.length],
      x: lm.x + Math.cos(a) * 128,
      z: lm.z + Math.sin(a) * 128,
      y: GROUND_Y,
      dir: [Math.sin(a), -Math.cos(a)],
      span: i % 2 ? 2.4 : 0,
    });
  }
  for (let i = 0; i < 6; i++) {
    people.push({
      kind: i % 2 ? 'lady' : 'porter',
      x: -100 + i * 160,
      z: OUTER_CITY.z1 + MOAT.offset + MOAT.width + 2.5,
      y: GROUND_Y,
      dir: [1, 0],
    });
  }
}

/* -------------------------------------------------------------------------- */
/*  船的位置                                                                    */
/* -------------------------------------------------------------------------- */

/** 静船：3 货船 + 1 客船 + 1 乌篷小舟。z 由岸线推到水里。 */
function mooredSpecs() {
  const list = [
    { id: 'cargoA', kind: 'cargo', x: -46, len: 20, beam: 4.4, phase: 0.4, side: -1, off: 3.4 },
    { id: 'cargoB', kind: 'cargo', x: -68, len: 17, beam: 3.9, phase: 2.3, side: -1, off: 3.1 },
    { id: 'cargoC', kind: 'cargo', x: 38, len: 19, beam: 4.2, phase: 4.4, side: -1, off: 3.5 },
    { id: 'passenger', kind: 'passenger', x: -20, len: 15, beam: 3.7, phase: 1.3, side: 1, off: 3.6 },
    { id: 'sampan', kind: 'sampan', x: -74, len: 6.6, beam: 1.8, phase: 5.2, side: -1, off: 13.0 },
    // —— 东段（进城后的汴河） ——
    { id: 'eastA', kind: 'cargo', x: 330, len: 18, beam: 4.0, phase: 1.1, side: -1, off: 3.4 },
    { id: 'eastB', kind: 'passenger', x: 470, len: 14, beam: 3.5, phase: 3.6, side: 1, off: 3.6 },
    { id: 'eastC', kind: 'cargo', x: 384, len: 16, beam: 3.8, phase: 5.0, side: -1, off: 3.2 },
    { id: 'eastD', kind: 'cargo', x: 492, len: 15, beam: 3.6, phase: 2.7, side: -1, off: 3.1 },
  ];
  for (const b of list) {
    const bank = b.side < 0 ? northBankZ(b.x) : southBankZ(b.x);
    b.wz = bank - b.side * b.off; // 往水里推 off 米
    b.wx = b.x;
    b.yaw = 0;
    b.deckY = WATER_Y + (b.kind === 'sampan' ? 0.36 : 0.62);
  }
  return list;
}

/* -------------------------------------------------------------------------- */
/*  人                                                                          */
/* -------------------------------------------------------------------------- */

function pushPeople(ctx, boats, rng) {
  const people = ctx.people;
  if (!Array.isArray(people)) return;

  const byId = Object.fromEntries(boats.map((b) => [b.id, b]));
  const deck = (id, lx, lz, extra = {}) => {
    const b = byId[id];
    people.push({
      kind: 'boatman',
      x: b.wx + lx,
      z: b.wz + lz,
      y: b.deckY,
      ...extra,
    });
  };

  // —— 船上 8 人 ——
  deck('cargoA', -8.6, 0, { dir: [1, 0] });
  deck('cargoA', 6.8, -0.6, { dir: [-1, 0] });
  deck('cargoA', 1.6, 0.8, { kind: 'porter', dir: [1, 0] });
  deck('cargoB', -6.4, 0.2, { dir: [1, 0] });
  deck('cargoB', 5.2, -0.4, { kind: 'porter', dir: [-1, 0] });
  deck('cargoC', 7.2, 0.3, { dir: [-1, 0] });
  deck('passenger', -4.6, 0, { kind: 'scholar', dir: [1, 0] });
  deck('passenger', 4.4, 0.4, { kind: 'lady', dir: [-1, 0] });
  // 东段静船上的人
  deck('eastA', -6.0, 0.3, { dir: [1, 0] });
  deck('eastA', 5.4, -0.5, { kind: 'porter', dir: [-1, 0] });
  deck('eastB', 3.6, 0.2, { kind: 'scholar', dir: [-1, 0] });
  deck('eastC', 5.8, 0.4, { dir: [-1, 0] });
  deck('eastD', -4.8, 0.2, { dir: [1, 0] });

  // —— 北岸西码头的人 ——
  const nA = northBankZ(-33);
  const nB = northBankZ(24);
  people.push({ kind: 'porter', x: -36.5, z: nA - 2.2, dir: [1, 0] });
  people.push({ kind: 'porter', x: -34.8, z: nA - 1.4, dir: [1, 0], mirror: true });
  people.push({ kind: 'boatman', x: -33.2, z: nA + 2.2, y: 0.76, dir: [0, 1] });
  people.push({ kind: 'vendor', x: -30.6, z: nA - 2.6, dir: [-1, 0] });
  people.push({ kind: 'monk', x: -28.6, z: nA - 4.4 });
  people.push({ kind: 'walker', x: -39.2, z: nA - 3.4, dir: [1, 0], span: 5 });
  people.push({ kind: 'donkey', x: -26.4, z: nA - 5.2, dir: [1, 0] });
  people.push({ kind: 'porter', x: -42.4, z: nA - 2.6, dir: [-1, 0] });

  // —— 北岸东码头 ——
  people.push({ kind: 'boatman', x: 23.2, z: nB + 1.6, y: 0.76, dir: [0, -1] });
  people.push({ kind: 'porter', x: 25.8, z: nB - 2.0, dir: [1, 0] });
  people.push({ kind: 'vendor', x: 28.0, z: nB - 3.2, dir: [-1, 0] });
  people.push({ kind: 'child', x: 22.2, z: nB - 3.4 });

  // —— 南岸近景（埠头 / 茶棚 / 柳下） ——
  const sC = southBankZ(20);
  people.push({ kind: 'vendor', x: 16.6, z: sC + 3.2, dir: [1, 0] });
  people.push({ kind: 'lady', x: 12.4, z: sC + 3.8, dir: [-1, 0] });
  people.push({ kind: 'child', x: 13.2, z: sC + 4.6 });
  people.push({ kind: 'walker', x: 19.6, z: sC + 2.4, dir: [1, 0], span: 5 });
  people.push({ kind: 'scholar', x: 8.2, z: sC + 2.0, dir: [-1, 0] });
  people.push({ kind: 'donkey', x: 24.2, z: sC + 5.4, dir: [1, 0] });
  people.push({ kind: 'walker', x: -14.0, z: southBankZ(-14) + 3.4, dir: [1, 0], span: 6 });
  people.push({ kind: 'lady', x: -10.4, z: southBankZ(-10) + 4.4 });
  people.push({ kind: 'rider', x: -20.2, z: southBankZ(-20) + 5.2, dir: [1, 0] });

  // —— 南岸土路上的人：从近景走过去 ——
  const roadPpl = [
    [-38.2, 5.6, 'walker', { dir: [1, 0], span: 5 }],
    [-34.6, 6.4, 'porter', { dir: [1, 0] }],
    [-28.4, 7.2, 'walker', { dir: [-1, 0], span: 4 }],
    [-24.6, 5.2, 'lady', { dir: [1, 0] }],
    [-17.5, 6.8, 'donkey', { dir: [1, 0] }],
    [-11.2, 7.6, 'walker', { dir: [-1, 0], span: 5 }],
    [-5.2, 6.2, 'porter', { dir: [1, 0], mirror: true }],
    [2.6, 7.4, 'rider', { dir: [-1, 0] }],
    [-31.0, 9.0, 'child', {}],
    [-26.2, 8.6, 'scholar', { dir: [1, 0] }],
  ];
  for (const [x, dz, kind, extra] of roadPpl) {
    people.push({ kind, x, z: southBankZ(x) + dz, ...extra });
  }

  // —— 纤夫：北岸五个，弓着身子往东拉 ——
  for (let i = 0; i < 5; i++) {
    const x = -47.4 + i * 3.1;
    people.push({ kind: 'boatman', x, z: northBankZ(x) - 2.0, dir: [1, 0], mirror: false });
  }
  void rng;
}

/* -------------------------------------------------------------------------- */
/*  设色：幡 / 赭布 / 灯笼的合并小件                                             */
/* -------------------------------------------------------------------------- */

/** 一张从横杆垂下的布幡（原点在上缘中点）。 */
function clothBannerGeo(w, h) {
  const geo = new THREE.PlaneGeometry(w, h, 2, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = (h / 2 - y) / h;
    pos.setZ(i, Math.sin(t * Math.PI) * 0.13 + Math.sin(x * 2.6) * 0.03);
    pos.setX(i, x + t * 0.06);
  }
  geo.translate(0, -h / 2, 0);
  geo.computeVertexNormals();
  return colorize(geo, 0xffffff);
}

/* -------------------------------------------------------------------------- */
/*  东水门：汴河出东城墙的水门                                                   */
/* -------------------------------------------------------------------------- */

function eastWaterGateParts(accents) {
  const parts = [];
  // 东水门跟着外城的东门走（外墙/城楼由 outer-city 模块负责，这里只收水门洞的水上部分）
  const gateDef = (OUTER_CITY.gates || []).find((g) => g.id === 'dongshuimen') || EAST_WATER_GATE;
  const GX = gateDef.x;
  const GZ = riverZ(GX);
  const OPEN = RIVER.halfWidth * 2; // 门洞顺着河宽 42m
  const zA = GZ - OPEN / 2;
  const zB = GZ + OPEN / 2;
  const T = 9;
  const PIER_TOP = 10.6;
  const ARCH_H = 1.6;

  // 门墩：立在两岸水边（外墙会盖在上面）
  for (const z of [zA, zB]) {
    parts.push(boxGeo(T + 2.2, PIER_TOP + 1.4, 2.6, C.stoneDark, { x: GX, y: (PIER_TOP + 1.4) / 2, z }));
    parts.push(boxGeo(T + 2.8, 0.6, 3.0, C.stone, { x: GX, y: PIER_TOP + 1.7, z }));
    parts.push(boxGeo(T + 1.2, 1.3, 2.0, C.stone, { x: GX, y: WATER_Y + 0.45, z }));
    // 闸槽木柱
    parts.push(cylGeo(0.24, 0.28, 10.8, 6, C.timberDark, { x: GX - T / 2 - 1.0, y: 5.4, z }));
    parts.push(cylGeo(0.24, 0.28, 10.8, 6, C.timberDark, { x: GX + T / 2 + 1.0, y: 5.4, z }));
    // 角石
    for (let k = 0; k < 4; k++) {
      parts.push(boxGeo(T + 2.4, 0.8, 0.7, k % 2 ? C.stoneLight : C.stone, { x: GX, y: 1.2 + k * 2.4, z }));
    }
  }

  // 门额石拱：两道券石，跨过整个河宽
  for (const sx of [-1, 1]) {
    const x = GX + sx * (T / 2 + 0.2);
    const n = 16;
    for (let i = 0; i < n; i++) {
      const u0 = i / n;
      const u1 = (i + 1) / n;
      const z0 = zA + OPEN * u0;
      const z1 = zA + OPEN * u1;
      const y0 = PIER_TOP + Math.sin(Math.PI * u0) * ARCH_H;
      const y1 = PIER_TOP + Math.sin(Math.PI * u1) * ARCH_H;
      parts.push(beamGeo([x, y0, z0], [x, y1, z1], 0.65, 0.9, i % 2 ? C.stone : C.stoneLight));
      parts.push(beamGeo([x, y0 - 0.55, z0], [x, y1 - 0.55, z1], 0.4, 0.3, C.stoneDark));
    }
  }
  // 门额下沿的横梁 + 券顶
  parts.push(boxGeo(T + 0.8, 0.9, OPEN + 1.2, C.stone, { x: GX, y: PIER_TOP + 0.1, z: GZ }));
  {
    const n2 = 18;
    for (let i = 0; i < n2; i++) {
      const z0 = zA + (OPEN * i) / n2;
      const z1 = zA + (OPEN * (i + 1)) / n2;
      const zc = (z0 + z1) / 2;
      const y = PIER_TOP + Math.sin(Math.PI * (i + 0.5) / n2) * 1.3;
      parts.push(boxGeo(T - 0.4, 0.5, Math.abs(z1 - z0) + 0.12, C.stoneDark, { x: GX, y: y - 0.28, z: zc }));
    }
    // 门洞深处的暗
    parts.push(boxGeo(T - 2.4, 1.4, OPEN - 6, 0x25211b, { x: GX + 1.0, y: PIER_TOP - 0.9, z: GZ }));
  }

  // 开着的两扇木门（贴在内侧门洞边）
  for (const [zp, dir] of [[zA + 0.6, 1], [zB - 0.6, -1]]) {
    parts.push(boxGeo(0.34, 9.2, 7.0, C.wood, { x: GX - T / 2 - 0.25, y: 4.9, z: zp + dir * 3.3, ry: dir * 0.5 }));
    parts.push(boxGeo(0.36, 0.5, 7.2, C.timberDark, { x: GX - T / 2 - 0.28, y: 9.0, z: zp + dir * 3.3, ry: dir * 0.5 }));
  }

  // 水门旁的朱幡 + 红灯笼
  for (const z of [zA - 2.5, zB + 2.5]) {
    const bx = GX - T / 2 - 1.4;
    parts.push(cylGeo(0.1, 0.13, 7.4, 5, C.timberDark, { x: bx, y: PIER_TOP + 3.3, z }));
    accents.banner.push(place(clothBannerGeo(1.5, 5.2), { x: bx + 0.85, y: PIER_TOP + 6.9, z }));
    accents.lantern.push(sphereGeo(0.36, 7, 5, 0xffffff, { x: bx, y: PIER_TOP + 7.1, z }));
  }
  // 水门前的木栈埠（北岸）
  {
    const z0 = northBankZ(GX);
    parts.push(boxGeo(9, 0.16, 5.2, C.deckDark, { x: GX - 16, y: 0.82, z: z0 + 2.6 }));
    parts.push(boxGeo(0.3, 0.16, 5.4, C.keel, { x: GX - 16, y: 0.93, z: z0 + 2.6 }));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(cylGeo(0.13, 0.16, 1.9, 5, C.timberDark, { x: GX - 16 + sx * 4.2, y: 0.1, z: z0 + 2.6 + sz * 2.4 }));
      }
    }
    accents.lantern.push(sphereGeo(0.3, 6, 4, 0xffffff, { x: GX - 16, y: 1.5, z: z0 + 2.2 }));
  }
  return parts;
}

/* -------------------------------------------------------------------------- */
/*  东段过桥船（桅杆一直放倒的漕船）                                             */
/* -------------------------------------------------------------------------- */

function loweredMastParts(len) {
  const parts = [];
  const H = len * 0.4;
  const bx = len * 0.16;
  // 倒向船尾的桅杆
  parts.push(beamGeo([bx, 0.72, 0], [bx - H * 0.94, 1.15, 0], 0.24, 0.24, C.timberDark));
  // 桅顶的储物架 / 卷帆
  parts.push(beamGeo([bx - H * 0.94, 1.15, -1.9], [bx - H * 0.94, 1.15, 1.9], 0.16, 0.16, C.timber));
  parts.push(boxGeo(1.5, 0.32, 0.32, C.cloth, { x: bx - H * 0.86, y: 1.3, z: 0, ry: 0.12 }));
  // 倒桅的支垫
  parts.push(boxGeo(0.5, 0.5, 0.9, C.timberDark, { x: bx - H * 0.55, y: 1.0, z: 0 }));
  return parts;
}

function eastMover({ id, kind, len, beam, x0, x1, cycle, phase, rng }) {
  const parts = boatParts(kind, { len, beam }, rng);
  parts.push(...loweredMastParts(len));
  parts.push(...crewParts({ x: len * 0.3, y: 0.6, z: 0.3, robe: 0x6c705d, poleTo: [len * 0.46, -0.42, 0.6] }));
  parts.push(...crewParts({ x: -len * 0.3, y: 0.62, z: -0.3, robe: 0x7d7a66, oarTo: [-len * 0.46, -0.45, -0.6] }));
  const geo = mergeParts(parts);
  return { id, geo, x0, x1, cycle, phase, kind };
}

/** 新水系上的静船（蔡河 2 / 五丈河 1 / 金水河 1 / 金明池 2 / 东门外 2）。 */
function waterwayBoatSpecs(accents) {
  const yawOf = (dx, dz) => Math.atan2(-dz, dx);
  const list = [];
  const c1 = canalPoint(CANALS.caihe, 0.16);
  list.push({ kind: 'cargo', x: c1.x + 1.5, z: c1.z + 1.0, y: NEW_WATER_Y, yaw: yawOf(c1.dx, c1.dz), len: 12, beam: 3.0, seed: 11 });
  const c2 = canalPoint(CANALS.caihe, 0.74);
  list.push({ kind: 'sampan', x: c2.x - 1.0, z: c2.z - 0.8, y: NEW_WATER_Y, yaw: yawOf(c2.dx, c2.dz) + 0.4, len: 6.6, beam: 1.8, seed: 12 });
  const w1 = canalPoint(CANALS.wuzhanghe, 0.62);
  list.push({ kind: 'sampan', x: w1.x, z: w1.z, y: NEW_WATER_Y, yaw: yawOf(w1.dx, w1.dz), len: 6.6, beam: 1.8, seed: 13 });
  const j1 = canalPoint(CANALS.jinshuihe, 0.55);
  list.push({ kind: 'sampan', x: j1.x, z: j1.z, y: NEW_WATER_Y, yaw: yawOf(j1.dx, j1.dz), len: 6.4, beam: 1.7, seed: 14 });
  const lm = CITY_LANDMARKS.find((l) => l.id === 'jinmingchi') || { x: -190, z: -270 };
  list.push({ kind: 'painted', x: lm.x - 45, z: lm.z + 25, y: NEW_WATER_Y, yaw: 0.5, len: 13 });
  list.push({ kind: 'dragon', x: lm.x - 10, z: lm.z + 65, y: NEW_WATER_Y, yaw: -0.2, len: 16 });
  // 东水门外
  list.push({ kind: 'cargo', x: 858, z: 12.5, y: WATER_Y, yaw: 0.05, len: 14, beam: 3.4, seed: 15 });
  list.push({ kind: 'sampan', x: 836, z: 6.0, y: WATER_Y, yaw: 0.1, len: 6.4, beam: 1.7, seed: 16 });
  void accents;
  return list;
}

/* 东段两条例行船：一条过州桥，一条出水门 */
function eastMovers() {
  const rng = makeRng(20261109);
  return [
    eastMover({ id: 'zhou-boat', kind: 'cargo', len: 20, beam: 4.2, x0: 176, x1: 326, cycle: 84, phase: 0.32, rng }),
    eastMover({ id: 'gate-boat', kind: 'cargo', len: 16, beam: 3.6, x0: 448, x1: 592, cycle: 96, phase: 0.55, rng }),
  ];
}

/* -------------------------------------------------------------------------- */
/*  东水门 / 码头两岸的人                                                       */
/* -------------------------------------------------------------------------- */

function pushEastPeople(ctx, rng) {
  const people = ctx.people;
  const GX = ((OUTER_CITY.gates || []).find((g) => g.id === 'dongshuimen') || EAST_WATER_GATE).x;
  const kinds = ['walker', 'porter', 'vendor', 'scholar', 'lady', 'monk', 'child', 'walker'];
  // 北岸（城里一侧）水门码头
  for (let i = 0; i < 9; i++) {
    const x = GX - 26 + i * 3.4;
    const z = northBankZ(x) - 2.0 - (i % 2) * 1.1;
    people.push({ kind: kinds[i % kinds.length], x, z, y: GROUND_Y, dir: i % 2 ? [1, 0] : [-1, 0], span: i % 3 === 0 ? 3 : 0 });
  }
  // 南岸
  for (let i = 0; i < 7; i++) {
    const x = GX - 20 + i * 5.2;
    const z = southBankZ(x) + 2.2 + (i % 2) * 1.0;
    people.push({ kind: kinds[(i + 3) % kinds.length], x, z, y: GROUND_Y, dir: [1, 0], span: i % 2 ? 2.4 : 0 });
  }
  // 水门楼上 / 栈埠上的人
  people.push({ kind: 'walker', x: GX - 14, z: northBankZ(GX) - 4.6, y: GROUND_Y, dir: [1, 0] });
  people.push({ kind: 'child', x: GX - 11.6, z: northBankZ(GX) - 5.0, y: GROUND_Y });
  people.push({ kind: 'porter', x: GX - 12.8, z: northBankZ(GX) - 3.6, y: 0.9, dir: [1, 0] });
  people.push({ kind: 'boatman', x: GX - 16, z: northBankZ(GX) + 2.0, y: 0.9, dir: [0, 1] });
  people.push({ kind: 'vendor', x: GX - 20.5, z: northBankZ(GX) - 2.6, y: GROUND_Y, dir: [1, 0] });
  people.push({ kind: 'monk', x: GX - 24.0, z: northBankZ(GX) - 4.2, y: GROUND_Y });
  people.push({ kind: 'donkey', x: GX - 8.0, z: southBankZ(GX) + 3.0, y: GROUND_Y, dir: [-1, 0] });
  people.push({ kind: 'walker', x: GX - 30.0, z: southBankZ(GX) + 2.6, y: GROUND_Y, dir: [1, 0], span: 4 });
  void rng;
}

/* -------------------------------------------------------------------------- */
/*  主入口                                                                      */
/* -------------------------------------------------------------------------- */

export function buildRiver(ctx) {
  const group = new THREE.Group();
  group.name = 'river';
  const tex = ctx.tex || {};
  const rng = makeRng(20261106);

  // —— 1. 水面 ——
  const water = buildWaterSurface(tex);
  group.add(water.mesh);

  // —— 2. 船 ——
  const boardMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const boats = mooredSpecs();
  const wash = makeWashBuilder();
  const bob = [];
  const accents = { banner: [], ochre: [], lantern: [] };
  const staticBoatParts = [];

  // 静泊船全部烘进一张网（省 draw call）；起伏留给大船和东段巡航船
  for (const spec of boats) {
    const geo = mergeParts(boatParts(spec.kind, { len: spec.len, beam: spec.beam }, rng));
    geo.rotateY(spec.yaw || 0);
    geo.translate(spec.wx, WATER_Y, spec.wz);
    staticBoatParts.push(geo);
    // 船底墨影
    wash.pool(spec.wx, spec.wz, spec.len * 0.5, spec.beam * 0.78, 0.24, C.ink, WATER_Y + 0.085);
  }
  // 新水系上的船（蔡河 / 五丈河 / 金水河 / 金明池 / 东门外汴河）
  const waterBoats = waterwayBoatSpecs(accents);
  for (const spec of waterBoats) {
    let parts;
    if (spec.kind === 'dragon') parts = dragonBoatParts(spec.len || 17);
    else if (spec.kind === 'painted') parts = paintedBoatParts(accents, spec.len || 13);
    else parts = boatParts(spec.kind, { len: spec.len, beam: spec.beam }, makeRng(spec.seed || 4242));
    const geo = mergeParts(parts);
    if (!geo) continue;
    geo.rotateY(spec.yaw || 0);
    geo.translate(spec.x, spec.y, spec.z);
    staticBoatParts.push(geo);
    wash.pool(spec.x, spec.z, (spec.len || 12) * 0.45, (spec.beam || 3) * 0.8, 0.2, C.ink, spec.y + 0.06);
  }
  {
    const merged = mergeParts(staticBoatParts);
    if (merged) {
      const mesh = new THREE.Mesh(merged, boardMat);
      mesh.name = 'river-static-boats';
      group.add(mesh);
    }
  }
  void bob;

  // —— 3. 大货船（过桥名场面） ——
  const big = bigBoatParts();
  const bigGroup = new THREE.Group();
  bigGroup.name = 'big-boat';
  const bigHull = new THREE.Mesh(mergeParts(big.parts), boardMat);
  bigGroup.add(bigHull);
  const mastMesh = new THREE.Mesh(mergeParts(bigMastParts()), boardMat);
  mastMesh.position.set(big.mast.x, big.mast.y, big.mast.z);
  bigGroup.add(mastMesh);
  bigGroup.position.set(-78, WATER_Y, riverZ(-78) + 0.6);
  group.add(bigGroup);

  // —— 4. 码头 + 东水门（同一张顶点色网） ——
  const structParts = dockParts(rng);
  structParts.push(...eastWaterGateParts(accents));
  // —— 运河上的桥：蔡河 3 座、五丈河 1 座、金水河 2 座 ——
  {
    const addBridge = (canal, t, span, width, style) => {
      const p = canalPoint(canal, t);
      canalBridgeParts(structParts, { x: p.x, z: p.z, dx: p.dx, dz: p.dz, span, width, style });
    };
    for (const t of [0.12, 0.42, 0.78]) addBridge(CANALS.caihe, t, CANALS.caihe.width + 7, 6.6, 'stone');
    addBridge(CANALS.wuzhanghe, 0.78, CANALS.wuzhanghe.width + 6, 5.6, 'wood');
    for (const t of [0.34, 0.7]) addBridge(CANALS.jinshuihe, t, CANALS.jinshuihe.width + 6, 5.2, 'stone');
  }
  // 码头 / 栈桥上的朱幡 + 灯
  for (const [x, z] of [[-37.2, northBankZ(-37.2) - 3.4], [24.6, northBankZ(24.6) - 2.2]]) {
    structParts.push(cylGeo(0.09, 0.12, 6.0, 5, C.timberDark, { x, y: GROUND_Y + 3.0, z }));
    accents.banner.push(place(clothBannerGeo(1.25, 4.2), { x: x + 0.7, y: GROUND_Y + 5.9, z }));
    accents.lantern.push(sphereGeo(0.28, 6, 4, 0xffffff, { x, y: GROUND_Y + 6.2, z }));
  }
  // 客船、茶棚上的赭布幡
  accents.ochre.push(place(clothBannerGeo(1.1, 2.6), { x: -20.0, y: WATER_Y + 3.9, z: 24.4 }));
  structParts.push(cylGeo(0.05, 0.06, 3.4, 4, C.timber, { x: -20.0, y: WATER_Y + 2.2, z: 24.4 }));
  const dockGeo = mergeParts(structParts);
  const dockMesh = new THREE.Mesh(dockGeo, boardMat);
  dockMesh.name = 'river-structures';
  group.add(dockMesh);

  // —— 4.5 东段两条例行船 ——
  const movers = eastMovers();
  for (const m of movers) {
    const mesh = new THREE.Mesh(m.geo, boardMat);
    const holder = new THREE.Group();
    holder.name = `boat-${m.id}`;
    holder.add(mesh);
    group.add(holder);
    m.holder = holder;
  }

  // —— 5. 岸线湿墨（水内两圈 + 岸上两道 + 岸壁） ——
  for (const side of [-1, 1]) {
    wash.bankFace(side, { step: 9 });
    for (const [d0, d1, a0, a1, y] of [
      [-0.05, 0.55, 0.5, 0.0, WATER_Y + 0.1],
      [1.15, 2.9, 0.16, 0.0, WATER_Y + 0.1],
      [-0.1, -1.6, 0.24, 0.0, GROUND_Y + 0.018],
      [-2.0, -4.0, 0.09, 0.0, GROUND_Y + 0.018],
    ]) {
      wash.band(side, { d0, d1, a0, a1, y0: y, step: 9 });
    }
  }
  // 新水系（蔡河 / 五丈河 / 金水河 / 外城护城河 / 金明池）的岸线湿墨
  for (const key of ['caihe', 'wuzhanghe', 'jinshuihe']) {
    if (CANALS[key]) canalWash(wash, CANALS[key]);
  }
  moatWash(wash);
  lakeWash(wash);
  const washMesh = wash.build();
  if (washMesh) group.add(washMesh);

  // —— 6. 苇草 ——
  group.add(buildReeds(rng));

  // —— 7. 柳树（南岸近景多，北岸几棵） ——
  const treeSpecs = [];
  treeSpecs.push(
    ...lineOfTrees({
      from: [-62, southBankZ(-62) + 3.6],
      to: [-42, southBankZ(-42) + 3.6],
      count: 3,
      kind: 'willow',
      h: 7.2,
      jitter: 1.2,
      seed: 21,
      y: GROUND_Y,
    }),
  );
  treeSpecs.push(
    ...lineOfTrees({
      from: [12, southBankZ(12) + 3.6],
      to: [38, southBankZ(38) + 3.6],
      count: 3,
      kind: 'willow',
      h: 7.6,
      jitter: 1.2,
      seed: 29,
      y: GROUND_Y,
    }),
  );
  treeSpecs.push(
    ...lineOfTrees({
      from: [44, southBankZ(44) + 4.2],
      to: [86, southBankZ(86) + 4.2],
      count: 3,
      kind: 'willow',
      h: 7.4,
      jitter: 1.5,
      seed: 37,
      y: GROUND_Y,
    }),
  );
  treeSpecs.push(
    ...lineOfTrees({
      from: [-74, northBankZ(-74) - 3.6],
      to: [-30, northBankZ(-30) - 3.6],
      count: 4,
      kind: 'willow',
      h: 7.0,
      jitter: 1.6,
      seed: 53,
      y: GROUND_Y,
    }),
  );
  treeSpecs.push(
    ...lineOfTrees({
      from: [-14, northBankZ(-14) - 4.4],
      to: [12, northBankZ(12) - 4.4],
      count: 2,
      kind: 'locust',
      h: 7.8,
      jitter: 1.2,
      seed: 71,
      y: GROUND_Y,
    }),
  );
  treeSpecs.push(
    ...lineOfTrees({
      from: [-88, southBankZ(-88) + 6.0],
      to: [-70, southBankZ(-70) + 6.0],
      count: 2,
      kind: 'locust',
      h: 7.6,
      jitter: 1.4,
      seed: 91,
      y: GROUND_Y,
    }),
  );
  // 南岸近景的几棵杂树，把空白的绢面撑起来
  treeSpecs.push(
    ...lineOfTrees({
      from: [-6, southBankZ(-6) + 7.6],
      to: [26, southBankZ(26) + 7.6],
      count: 3,
      kind: 'locust',
      h: 6.8,
      jitter: 1.5,
      seed: 97,
      y: GROUND_Y,
    }),
  );
  // 更靠前的两棵，把近景的留白收一收
  treeSpecs.push(
    ...lineOfTrees({
      from: [-46, southBankZ(-46) + 14],
      to: [8, southBankZ(8) + 15],
      count: 3,
      kind: 'locust',
      h: 7.4,
      jitter: 2.2,
      seed: 111,
      y: GROUND_Y,
    }),
  );
  // —— 新水系岸柳 ——
  {
    const lm = CITY_LANDMARKS.find((l) => l.id === 'jinmingchi') || { x: -190, z: -270 };
    const addRow = (canal, n, off, h) => {
      for (let i = 0; i < n; i++) {
        const p = canalPoint(canal, (i + 0.5) / n);
        const side = i % 2 ? 1 : -1;
        treeSpecs.push({
          kind: 'willow',
          x: p.x - p.dz * side * off,
          z: p.z + p.dx * side * off,
          y: GROUND_Y,
          h: h + (i % 3) * 0.7,
        });
      }
    };
    addRow(CANALS.caihe, 9, CANALS.caihe.width / 2 + 5.0, 6.6);
    addRow(CANALS.wuzhanghe, 3, CANALS.wuzhanghe.width / 2 + 4.5, 6.2);
    addRow(CANALS.jinshuihe, 3, CANALS.jinshuihe.width / 2 + 4.0, 6.2);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      treeSpecs.push({ kind: 'willow', x: lm.x + Math.cos(a) * 137, z: lm.z + Math.sin(a) * 137, y: GROUND_Y, h: 6.2 + (i % 3) * 0.8 });
    }
    for (let i = 0; i < 6; i++) {
      treeSpecs.push({
        kind: 'willow',
        x: -240 + i * 180,
        z: OUTER_CITY.z1 + MOAT.offset + MOAT.width + 6,
        y: GROUND_Y,
        h: 6.8,
      });
    }
  }
  try {
    buildTrees(treeSpecs, ctx);
  } catch (error) {
    console.warn('[ink-qingming] river 柳树构建失败：', error);
  }

  // —— 7.5 设色点缀：朱幡 / 赭布 / 灯笼（各自合并成一张网） ——
  const accentDefs = [
    ['banner', ctx.mats?.banner || new THREE.MeshLambertMaterial({ color: P.VERMILION, side: THREE.DoubleSide }), 'river-banners'],
    ['ochre', ctx.mats?.clothOchre || new THREE.MeshLambertMaterial({ color: 0xa9803f, side: THREE.DoubleSide }), 'river-ochre'],
    ['lantern', ctx.mats?.lantern || new THREE.MeshBasicMaterial({ color: 0xc23a24, toneMapped: false }), 'river-lanterns'],
  ];
  for (const [key, mat, name] of accentDefs) {
    const geo = mergeParts(accents[key]);
    if (!geo) continue;
    mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    group.add(mesh);
  }

  // —— 8. 人 ——
  pushPeople(ctx, boats, rng);
  pushEastPeople(ctx, rng);
  pushWaterwayPeople(ctx);

  // —— 9. 动效 ——
  let clock = 0;
  let boatPhase = 0; // 截图脚本可以覆盖
  const tick = (time, dt) => {
    const step = typeof dt === 'number' && dt > 0 && dt < 0.4 ? dt : 0.016;
    clock += step;
    water.uniforms.uTime.value = clock;

    // 静船：极缓的起伏 + 一点点侧倾
    for (const b of bob) {
      const p = b.phase;
      const y = Math.sin(clock * 0.52 + p) * b.amp + Math.sin(clock * 0.29 + p * 1.7) * b.amp * 0.55;
      b.holder.position.y = WATER_Y + y;
      b.holder.rotation.z = Math.sin(clock * 0.4 + p) * 0.007;
      b.holder.rotation.x = Math.sin(clock * 0.33 + p * 2.1) * 0.009;
    }

    // 大船：从西往东缓缓过桥（一轮 96 秒，循环）
    const p = (((clock / BIG_CYCLE) % 1) + 1) % 1;
    const x = -78 + 150 * p;
    const z = riverZ(x) + 0.6;
    const slope = (riverZ(x + 1) - riverZ(x - 1)) / 2;
    const bobY = Math.sin(clock * 0.44) * 0.04 + Math.sin(clock * 0.7 + 1.2) * 0.018;
    bigGroup.position.set(x, WATER_Y + bobY, z);
    bigGroup.rotation.y = Math.atan2(-slope, 1);
    bigGroup.rotation.z = Math.sin(clock * 0.37) * 0.008;
    bigGroup.rotation.x = Math.sin(clock * 0.31 + 0.7) * 0.006;
    // 桅杆：来船时放倒——先倒一半，钻进桥洞时压到最低，过桥后再竖起来
    const mastAngle = 0.12 + 1.06 * smoothstep(-30, -8, x) - 1.06 * smoothstep(10, 34, x);
    mastMesh.rotation.z = mastAngle;
    mastMesh.rotation.x = Math.sin(clock * 0.5) * 0.012;

    // 东段两条例行船（州桥 / 东水门）：桅杆一直放倒
    for (const m of movers) {
      const p = (((clock / m.cycle) % 1) + 1 + m.phase) % 1;
      const mx = m.x0 + (m.x1 - m.x0) * p;
      const mz = riverZ(mx) + 0.9;
      const mslope = (riverZ(mx + 1) - riverZ(mx - 1)) / 2;
      m.holder.position.set(mx, WATER_Y + Math.sin(clock * 0.5 + m.phase * 6) * 0.03, mz);
      m.holder.rotation.y = Math.atan2(-mslope, 1);
      m.holder.rotation.z = Math.sin(clock * 0.36 + m.phase * 4) * 0.008;
    }
    void boatPhase;
  };
  ctx.onTick?.(tick);
  tick(0, 0.016);

  group.userData.setBoatPhase = (v) => {
    clock = v * BIG_CYCLE;
    boatPhase = v;
    tick(0, 0.016);
  };
  group.userData.setClock = (v) => {
    clock = v;
    tick(0, 0.016);
  };
  group.userData.boats = boats;
  group.userData.bigBoat = bigGroup;
  return group;
}

