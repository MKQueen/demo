/**
 * roof.js —— 中国古建屋顶的生成器。
 *
 * 屋顶是这幅画的主角。三种基本型制：
 *   - 庑殿（hip）：五脊四坡，最高等级，太和殿、城门楼；
 *   - 歇山 / 硬山（gable）：两坡带山墙，胡同四合院、钟鼓楼；
 *   - 攒尖（pyramid / round）：四角或圆形收于一点，亭子、祈年殿、白塔宝顶。
 *
 * 三条曲线让它像“中国屋顶”:
 *   1. 举折：屋面不是直线，越往上越陡（y = h * t^curve）；
 *   2. 起翘：檐口靠近翼角处上翘（lift）；
 *   3. 出翘：檐口平面在翼角处向外鼓出（swell）。
 *
 * 坐标约定：width 沿 x，depth 沿 z，height 沿 y；底部在 y=0。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { beamBetween } from './geometry.js';

const DEFAULTS = {
  overhang: null, // 未指定时按尺寸自动取（约 8% 的短边）
  lift: 0.13, // 翼角起翘：占屋顶高度的比例（只在角上作用）
  curve: 2.05, // 举折：屋面曲率指数（越大越凹）
  swell: 0.5, // 出翘：檐口在角部外鼓
  segU: 16,
  segV: 9,
  fascia: 0.12, // 檐口板厚度（相对屋顶高度）
};

function outwardOk(pos, idx, outward) {
  // 取第一个三角形的法线，与期望的外法线比较
  const a = new THREE.Vector3().fromArray(pos, idx[0] * 3);
  const b = new THREE.Vector3().fromArray(pos, idx[1] * 3);
  const c = new THREE.Vector3().fromArray(pos, idx[2] * 3);
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  return n.dot(outward) > 0;
}

/**
 * 一片屋面：从檐口 (A→B) 到脊线 (CA→CB)，中间按举折曲线隆起。
 * 翼角的上翘 / 外鼓只沿檐口方向作用，所以屋面看起来是「凹曲」的。
 */
function makeFace({ A, B, CA, CB, outward, o }) {
  const { segU, segV, liftH, swellD, curve } = o;
  const pos = [];
  const uv = [];
  const idx = [];
  const dir = new THREE.Vector3().subVectors(B, A);
  const dirN = dir.clone().normalize();

  for (let iv = 0; iv <= segV; iv++) {
    const sv = iv / segV;
    // 举折：檐口处先有一段缓坡，越靠近正脊越陡
    const t = 0.42 * sv + 0.58 * Math.pow(sv, curve);
    for (let iu = 0; iu <= segU; iu++) {
      const su = iu / segU;
      const ex = A.x + (B.x - A.x) * su;
      const ey = A.y + (B.y - A.y) * su;
      const ez = A.z + (B.z - A.z) * su;

      // 出翘：檐口两端向外鼓
      const s = su * 2 - 1;
      const sa = Math.abs(s);
      const swellF = Math.pow(sa, 4) * Math.sign(su - 0.5);
      const px = ex + dirN.x * swellD * swellF;
      const pz = ez + dirN.z * swellD * swellF;

      // 起翘：只在翼角附近抬，檐口中段保持平直
      const lift = liftH * (Math.pow(sa, 6) * 0.82 + sa * sa * 0.18) * Math.pow(1 - sv, 2.6);

      const tx = CA.x + (CB.x - CA.x) * su;
      const ty = CA.y + (CB.y - CA.y) * su;
      const tz = CA.z + (CB.z - CA.z) * su;

      pos.push(px + (tx - px) * sv, ey + lift + (ty - ey) * t, pz + (tz - pz) * sv);
      uv.push(su, sv);
    }
  }

  const stride = segU + 1;
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * stride + iu;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }

  if (!outwardOk(pos, idx, outward)) {
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** 沿一片檐口做一条竖直的檐口板（a thin vertical band），用来压住屋面边缘。 */
function makeFascia({ A, B, outward, o }) {
  const { segU, liftH, swellD, fasciaH } = o;
  const dir = new THREE.Vector3().subVectors(B, A);
  const dirN = dir.clone().normalize();
  const pos = [];
  const idx = [];
  for (let iu = 0; iu <= segU; iu++) {
    const su = iu / segU;
    const s = su * 2 - 1;
    const sa = Math.abs(s);
    const swellF = Math.pow(sa, 4) * Math.sign(su - 0.5);
    const ex = A.x + (B.x - A.x) * su + dirN.x * swellD * swellF;
    const ey = A.y + (B.y - A.y) * su + liftH * (Math.pow(sa, 6) * 0.82 + sa * sa * 0.18);
    const ez = A.z + (B.z - A.z) * su + dirN.z * swellD * swellF;
    pos.push(ex, ey, ez);
    pos.push(ex, ey - fasciaH, ez);
  }
  for (let iu = 0; iu < segU; iu++) {
    const a = iu * 2;
    const b = a + 2;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  if (!outwardOk(pos, idx, outward)) {
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
  }
  return geo;
}

/**
 * 庑殿顶 / 攒尖顶通用几何。
 * width > depth → 有正脊；width === depth → 收成一点（攒尖）。
 * 返回 { roof, fascia, corners, ridgeHalf }。
 */
export function hipRoofGeometry(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const { width, depth, height } = o;
  if (o.overhang == null) o.overhang = Math.min(width, depth) * 0.09;
  const W = width + o.overhang * 2;
  const D = depth + o.overhang * 2;
  const ridgeHalf = Math.max(0, (width - depth) / 2);
  const liftH = height * o.lift;
  const swellD = Math.min(width, depth) * o.swell * 0.1;
  const fasciaH = Math.max(0.015, height * o.fascia);
  const oo = { ...o, liftH, swellD, fasciaH };

  const y = 0;
  const SW = new THREE.Vector3(-W / 2, y, D / 2);
  const SE = new THREE.Vector3(W / 2, y, D / 2);
  const NE = new THREE.Vector3(W / 2, y, -D / 2);
  const NW = new THREE.Vector3(-W / 2, y, -D / 2);
  const L = new THREE.Vector3(-ridgeHalf, height, 0);
  const R = new THREE.Vector3(ridgeHalf, height, 0);

  const faces = [
    { A: SW, B: SE, CA: L, CB: R, outward: new THREE.Vector3(0, 0, 1) },
    { A: NE, B: NW, CA: R, CB: L, outward: new THREE.Vector3(0, 0, -1) },
    { A: SE, B: NE, CA: R, CB: R, outward: new THREE.Vector3(1, 0, 0) },
    { A: NW, B: SW, CA: L, CB: L, outward: new THREE.Vector3(-1, 0, 0) },
  ];

  const roofGeos = [];
  const fasciaGeos = [];
  for (const f of faces) {
    roofGeos.push(makeFace({ ...f, o: oo }));
    fasciaGeos.push(makeFascia({ A: f.A, B: f.B, outward: f.outward, o: oo }));
  }

  // 四个翼角（檐口端点，含起翘与出翘后的真实位置），给垂脊 / 装饰用
  const corners = [
    { point: new THREE.Vector3().copy(SW), to: L, dir: new THREE.Vector3(1, 0, 1).normalize() },
    { point: new THREE.Vector3().copy(SE), to: R, dir: new THREE.Vector3(-1, 0, 1).normalize() },
    { point: new THREE.Vector3().copy(NE), to: R, dir: new THREE.Vector3(-1, 0, -1).normalize() },
    { point: new THREE.Vector3().copy(NW), to: L, dir: new THREE.Vector3(1, 0, -1).normalize() },
  ];
  for (const c of corners) {
    const d = { x: c.dir.x, z: c.dir.z };
    c.point.x += d.x * swellD * 0.5;
    c.point.z += d.z * swellD * 0.5;
    c.point.y += liftH;
  }

  return {
    roof: mergeGeometries(roofGeos, false),
    fascia: mergeGeometries(fasciaGeos, false),
    corners,
    ridgeHalf,
    ridgeY: height,
  };
}

/**
 * 硬山 / 悬山顶几何：两坡，正脊通长。
 * 返回 { roof, fascia, ridgeHalf }。
 */
export function gableRoofGeometry(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const { width, depth, height } = o;
  if (o.overhang == null) o.overhang = Math.min(width, depth) * 0.09;
  const W = width + o.overhang * 2;
  const D = depth + o.overhang * 2;
  const liftH = height * o.lift;
  const swellD = Math.min(width, depth) * o.swell * 0.1;
  const fasciaH = Math.max(0.015, height * o.fascia);
  const oo = { ...o, liftH, swellD, fasciaH };

  const SW = new THREE.Vector3(-W / 2, 0, D / 2);
  const SE = new THREE.Vector3(W / 2, 0, D / 2);
  const NE = new THREE.Vector3(W / 2, 0, -D / 2);
  const NW = new THREE.Vector3(-W / 2, 0, -D / 2);
  const L = new THREE.Vector3(-W / 2, height, 0);
  const R = new THREE.Vector3(W / 2, height, 0);

  const faces = [
    { A: SW, B: SE, CA: L, CB: R, outward: new THREE.Vector3(0, 0, 1) },
    { A: NE, B: NW, CA: R, CB: L, outward: new THREE.Vector3(0, 0, -1) },
  ];
  const roofGeos = [];
  const fasciaGeos = [];
  for (const f of faces) {
    roofGeos.push(makeFace({ ...f, o: oo }));
    fasciaGeos.push(makeFascia({ A: f.A, B: f.B, outward: f.outward, o: oo }));
  }
  return {
    roof: mergeGeometries(roofGeos, false),
    fascia: mergeGeometries(fasciaGeos, false),
    ridgeHalf: W / 2,
    ridgeY: height,
  };
}

/**
 * 圆形屋顶（攒尖圆顶 / 重檐圆顶）：祈年殿、亭子、塔。
 * 用 LatheGeometry 旋转一条「举折 + 檐口反翘」的剖面线。
 */
export function roundRoofGeometry({
  radius = 1,
  height = 1,
  overhang = null,
  curve = 1.6,
  fascia = 0.03,
  segments = 40,
  ring = 0.0,
} = {}) {
  if (overhang == null) overhang = radius * 0.16;
  const R = radius + overhang;
  const fasciaH = Math.max(0.01, height * fascia);
  const pts = [];
  // 檐口竖板
  pts.push(new THREE.Vector2(R, -fasciaH));
  pts.push(new THREE.Vector2(R, 0));
  // 檐口反翘 + 举折
  const steps = 22;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const rr = Math.max(1e-4, R * (1 - t));
    const yy = height * Math.pow(t, curve);
    pts.push(new THREE.Vector2(rr, yy));
  }
  // 顶部小圆台，给宝顶留位置
  const geo = new THREE.LatheGeometry(pts, segments);
  const group = new THREE.Group();
  const roof = new THREE.Mesh(geo, null);
  return { roof, ring, radius: R, height };
}

/* -------------------------------------------------------------------------- */
/*  高层封装：直接生成可放进场景的 Group（含屋顶、檐口板、正脊、垂脊）           */
/* -------------------------------------------------------------------------- */

function addMainRidge(group, { width, ridgeHalf, ridgeY }, mat, scale = 1) {
  const len = ridgeHalf * 2;
  if (len <= 0.001) return;
  const t = Math.max(0.03, ridgeY * 0.11 * scale);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(len, t, t * 0.85), mat);
  beam.position.set(0, ridgeY + t * 0.25, 0);
  group.add(beam);
  // 两端小兽 / 吻：两个略高的方块，远看是深色的点缀
  const orn = new THREE.Mesh(new THREE.BoxGeometry(t * 1.25, t * 1.55, t * 0.9), mat);
  orn.position.set(-len / 2 + t * 0.35, ridgeY + t * 0.7, 0);
  group.add(orn);
  const orn2 = orn.clone();
  orn2.position.x = len / 2 - t * 0.35;
  group.add(orn2);
}

/** 垂脊：沿翼角到脊端的曲线上铺一串小段木梁。 */
function addHipRidges(group, corners, mat, { liftH = 0, curve = 1.5 } = {}) {
  const t = 0.035;
  for (const c of corners) {
    const from = c.point;
    const to = c.to;
    const segs = 6;
    let prev = from.clone();
    for (let i = 1; i <= segs; i++) {
      const sv = i / segs;
      const p = new THREE.Vector3().lerpVectors(from, to, sv);
      // 与屋面同样的凹曲 + 起翘衰减
      p.y = from.y + (to.y - from.y) * Math.pow(sv, curve);
      const beam = beamBetween(prev, p, t, t, mat);
      if (beam) group.add(beam);
      prev = p.clone();
    }
  }
}

/**
 * 庑殿 / 攒尖屋顶（含檐口板与脊）。
 * opts.width/depth/height 都已是世界单位。
 */
export function buildHipRoof(opts = {}, mats = {}, { ridges = true } = {}) {
  const { roof: roofGeo, fascia, corners, ridgeHalf, ridgeY } = hipRoofGeometry(opts);
  const group = new THREE.Group();
  const tileMat = opts.tileMat || mats.roof || mats.roofTile;
  const eaveMat = opts.eaveMat || mats.eave || tileMat;
  const ridgeMat = opts.ridgeMat || mats.ridge || eaveMat;

  const roof = new THREE.Mesh(roofGeo, tileMat);
  roof.castShadow = true;
  group.add(roof);
  const f = new THREE.Mesh(fascia, eaveMat);
  group.add(f);

  if (ridges) {
    addMainRidge(group, { width: opts.width, ridgeHalf, ridgeY }, ridgeMat);
    addHipRidges(group, corners, ridgeMat, {
      liftH: (opts.height || 1) * (opts.lift ?? DEFAULTS.lift),
      curve: opts.curve ?? DEFAULTS.curve,
    });
  }
  group.userData.roofHeight = opts.height || 0;
  group.userData.ridgeHalf = ridgeHalf;
  return group;
}

/** 硬山屋顶（含檐口板与正脊），胡同与配殿最常用。 */
export function buildGableRoof(opts = {}, mats = {}, { ridges = true } = {}) {
  const { roof: roofGeo, fascia, ridgeY, ridgeHalf } = gableRoofGeometry(opts);
  const group = new THREE.Group();
  const tileMat = opts.tileMat || mats.roof || mats.roofTile;
  const eaveMat = opts.eaveMat || mats.eave || tileMat;
  const ridgeMat = opts.ridgeMat || mats.ridge || eaveMat;

  group.add(new THREE.Mesh(roofGeo, tileMat));
  group.add(new THREE.Mesh(fascia, eaveMat));
  if (ridges) addMainRidge(group, { ridgeHalf, ridgeY }, ridgeMat);
  group.userData.roofHeight = opts.height || 0;
  return group;
}

/**
 * 圆形攒尖屋顶（含宝顶），返回 Group。屋顶本体高度为 opts.height。
 * 宝顶（金色）可选，祈年殿 / 白塔 / 亭子用。
 */
export function buildRoundRoof(opts = {}, mats = {}, { finial = true } = {}) {
  const { roof, radius, height } = roundRoofGeometry(opts);
  const tileMat = opts.tileMat || mats.roofJade || mats.roofTile;
  roof.material = tileMat;
  const group = new THREE.Group();
  group.add(roof);

  if (finial) {
    const r = Math.max(0.04, radius * 0.06);
    const goldMat = mats.gold || tileMat;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), goldMat);
    ball.position.y = height + r * 0.6;
    group.add(ball);
    const spike = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.5, r * 2.2, 8), goldMat);
    spike.position.y = height + r * 1.8;
    group.add(spike);
  }
  group.userData.roofHeight = height;
  return group;
}

/**
 * 重檐：给一座殿宇叠两层屋顶。
 * 返回 { group, upperY }，upperY 是上层屋身应放的高度。
 */
export function buildDoubleEave(opts = {}, mats = {}) {
  const { width, depth, height, eaveGap = 0.5 } = opts;
  const group = new THREE.Group();
  const lower = buildHipRoof(
    {
      ...opts,
      width,
      depth,
      height: height * 0.62,
    },
    mats,
  );
  group.add(lower);

  const upperY = height * 0.62 + eaveGap;
  const upper = buildHipRoof(
    {
      ...opts,
      width: width * 0.86,
      depth: depth * 0.86,
      height: height * 0.72,
      overhang: (opts.overhang ?? DEFAULTS.overhang) * 0.9,
    },
    mats,
  );
  upper.position.y = upperY;
  group.add(upper);
  group.userData.upperY = upperY;
  group.userData.upperRoofTop = upperY + height * 0.72;
  group.userData.lowerRoofHeight = height * 0.62;
  return group;
}
