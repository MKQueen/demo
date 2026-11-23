/**
 * outer-city.js —— 三重城的墙门与护城河堤岸。
 *
 * 只画「城」的骨架，不画城里的街坊（city-blocks / city-inner / town 各管一块）：
 *   1. 外城（罗城）：-320~800 × -640~300，夯土墙高 12 厚 8，收分、条石基、版筑竖缝、
 *      垛口、马面、四角角楼；12 座城门（含东水门/东北水门两座水门），每座门洞 +
 *      门楼（重檐 / 单檐 / 单檐歇山三种型制交替，别都一个样）+ 门外的石桥台；
 *   2. 里城（旧城）：70~450 × -540~120，墙高 10 厚 6，灰墙、局部残破，5 座城门；
 *      墙线在遇到汴河 / 金水河 / 五丈河与已有街市的地方留出水门洞与缺口，不与
 *      town / city-inner 的建筑穿模；
 *   3. 护城河：外城四周的堤岸 / 驳岸（条石、湿墨边、柳树），水面留给 river 模块；
 *   4. 各城门外的小关厢：茶棚、脚店、拴马桩、旗杆，少量点缀；
 *   5. 城门内外的人物锚点（每门 10~15）交给 people.js。
 *
 * 性能：所有静物按材质合并（Collector），一种材质 1 draw call；树走 flora 共享批次。
 * 目标 < 90k tris / < 35 draws。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GROUND_Y, WATER_Y, OUTER_CITY, INNER_CITY, MOAT, riverZ } from '../layout.js';
import { hipRoofGeometry, gableRoofGeometry } from '../lib/roof.js';
import { inkMat, setInkWeight } from '../lib/materials.js';
import { makeRng, range } from '../lib/rand.js';
import { buildTrees } from '../lib/flora.js';

/* ========================================================================== */
/*  0. 工具                                                                    */
/* ========================================================================== */

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const qY = (a) => new THREE.Quaternion().setFromAxisAngle(Y_AXIS, a);
const M4 = (x = 0, y = 0, z = 0, rotY = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(V3(x, y, z), qY(rotY), V3(sx, sy, sz));

const G = GROUND_Y;
const PI2 = Math.PI / 2;

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

  addCylinder(mat, rTop, rBot, h, x, baseY, z, seg = 6) {
    this.push(mat, new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, false), M4(x, baseY + h / 2, z));
  }

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

  addObject(obj, x = 0, y = 0, z = 0, rotY = 0) {
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      if (o.isMesh && !o.isInstancedMesh) this.push(o.material, o.geometry, o.matrixWorld);
    });
  }

  build(name = 'outer-city-static') {
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

/* ---------------------------- 屋顶 / 小构件 ---------------------------- */

function addHipRoof(coll, mats, o) {
  const {
    x = 0, z = 0, y = 0, rotY = 0, width, depth, height,
    tileMat = mats.roofTile, ridgeMat = mats.inkDark,
    overhang = 1.0, segU = 5, segV = 2, ornaments = true,
  } = o;
  const { roof, fascia, ridgeHalf } = hipRoofGeometry({
    width, depth, height, overhang, lift: 0.22, curve: 1.95, swell: 0.4, segU, segV,
  });
  const m = M4(x, y, z, rotY);
  coll.push(tileMat, roof, m);
  coll.push(mats.eave, fascia, m);
  if (ridgeHalf > 0.05) {
    const t = Math.max(0.12, height * 0.1);
    coll.addBox(ridgeMat, ridgeHalf * 2, t, t * 0.9, x, y + height + t * 0.28, z, rotY);
    if (ornaments) {
      const orn = Math.max(0.18, height * 0.17);
      for (const s of [-1, 1]) {
        const c = Math.cos(rotY);
        const sn = Math.sin(rotY);
        const lx = s * (ridgeHalf - orn * 0.3);
        coll.addBox(ridgeMat, orn, orn * 1.7, orn * 0.85, x + c * lx, y + height + orn * 0.95, z - sn * lx, rotY);
      }
    }
  }
}

function addGableRoof(coll, mats, o) {
  const {
    x = 0, z = 0, y = 0, rotY = 0, width, depth, height,
    tileMat = mats.roofTile, ridgeMat = mats.inkDark, overhang = 0.6,
  } = o;
  const { roof, fascia } = gableRoofGeometry({
    width, depth, height, overhang, lift: 0.16, curve: 1.9, swell: 0.35, segU: 3, segV: 1,
  });
  const m = M4(x, y, z, rotY);
  coll.push(tileMat, roof, m);
  coll.push(mats.eave, fascia, m);
  const t = Math.max(0.1, height * 0.1);
  coll.addBox(ridgeMat, width + overhang * 2, t, t, x, y + height + t * 0.3, z, rotY);
}

/** 灯笼（挂在城门 / 门楼两侧）。 */
function addLantern(coll, mats, x, y, z, r = 0.35) {
  coll.addBox(mats.woodDark, 0.06, r * 2.4, 0.06, x, y + r * 1.2, z);
  coll.push(mats.lantern, new THREE.SphereGeometry(r, 6, 5), M4(x, y, z));
  coll.addCylinder(mats.woodDark, r * 0.36, r * 0.42, 0.1, x, y + r * 0.82, z, 5);
}

/** 纸匾 + 墨字痕（支持朝向 rotY：0 = 面朝 +z）。 */
function addPlaque(coll, mats, o) {
  const { x, y, z, w = 3.2, h = 0.9, chars = 3, gold = true, rotY = 0 } = o;
  const c = Math.cos(rotY);
  const sn = Math.sin(rotY);
  const L = (lx, lz) => [x + c * lx + sn * lz, z - sn * lx + c * lz];
  const [ax, az] = L(-w / 2, 0.02);
  const [bx, bz] = L(w / 2, 0.02);
  coll.addQuad(mats.paperSign, V3(ax, y + h / 2, az), V3(bx, y + h / 2, bz), V3(bx, y - h / 2, bz), V3(ax, y - h / 2, az), V3(sn, 0, c));
  const edge = gold ? mats.gold : mats.inkDark;
  const [cx0, cz0] = L(0, 0.03);
  const [lx1, lz1] = L(-w / 2, 0.03);
  const [rx1, rz1] = L(w / 2, 0.03);
  coll.addBox(edge, w + 0.12, 0.09, 0.08, cx0, y + h / 2, cz0, rotY);
  coll.addBox(edge, w + 0.12, 0.09, 0.08, cx0, y - h / 2, cz0, rotY);
  coll.addBox(edge, 0.09, h + 0.16, 0.08, lx1, y, lz1, rotY);
  coll.addBox(edge, 0.09, h + 0.16, 0.08, rx1, y, rz1, rotY);
  for (let i = 0; i < chars; i++) {
    const [gx, gz] = L((i - (chars - 1) / 2) * (w * 0.26), 0.045);
    coll.addBox(mats.inkDark, Math.max(0.06, w * 0.12), h * 0.4, 0.045, gx, y, gz, rotY);
  }
}

/* ========================================================================== */
/*  1. 城墙：一段墙 / 马面 / 角楼                                               */
/* ========================================================================== */

/**
 * 一段夯土城墙（沿 x 或沿 z），带收分、条石基、腰线、垛口。
 * axis 'x'：墙沿 x 从 a 到 b，z=c，s 是外法线方向（+1 南 / -1 北）
 * axis 'z'：墙沿 z 从 a 到 b，x=c，s 是外法线方向（+1 东 / -1 西）
 */
function addWallSegment(coll, mats, o) {
  const {
    axis, c, s, a, b, h = OUTER_CITY.wallH, t = OUTER_CITY.wallT,
    bodyMat = mats.wallHuang, crenel = true, stoneBase = true, waist = true,
    broken = false, brokenHeight = 0,
  } = o;
  const yb = G;
  const ht = broken && brokenHeight > 0 ? brokenHeight : h;
  const yt = yb + ht;
  const inset = 0.32 * (ht / 12);
  const P = (u, y, v) => (axis === 'x' ? V3(u, y, c + v) : V3(c + v, y, u));
  const out = axis === 'x' ? V3(0, 0, s) : V3(s, 0, 0);
  const inw = axis === 'x' ? V3(0, 0, -s) : V3(-s, 0, 0);
  const up = V3(0, 1, 0);
  const hb = t / 2;
  const htp = t / 2 - inset;
  // 外皮 / 内皮 / 墙顶
  coll.addQuad(bodyMat, P(a, yb, s * hb), P(b, yb, s * hb), P(b, yt, s * htp), P(a, yt, s * htp), out);
  coll.addQuad(bodyMat, P(b, yb, -s * hb), P(a, yb, -s * hb), P(a, yt, -s * htp), P(b, yt, -s * htp), inw);
  coll.addQuad(mats.inkWash, P(a, yt, s * htp), P(b, yt, s * htp), P(b, yt, -s * htp), P(a, yt, -s * htp), up);
  // 两端封口
  coll.addQuad(bodyMat, P(a, yb, -s * hb), P(a, yb, s * hb), P(a, yt, s * htp), P(a, yt, -s * htp), axis === 'x' ? V3(-1, 0, 0) : V3(0, 0, -1));
  coll.addQuad(bodyMat, P(b, yb, s * hb), P(b, yb, -s * hb), P(b, yt, -s * htp), P(b, yt, s * htp), axis === 'x' ? V3(1, 0, 0) : V3(0, 0, 1));

  if (stoneBase) {
    // 条石墙基（外皮贴一条）
    const mid = (a + b) / 2;
    const len = b - a;
    if (axis === 'x') coll.addBox(mats.stone, len, 0.85, 0.5, mid, yb + 0.42, c + s * (hb + 0.05));
    else coll.addBox(mats.stone, 0.5, 0.85, len, c + s * (hb + 0.05), yb + 0.42, mid);
  }
  if (waist) {
    // 淡墨腰线
    const wy = yb + ht * 0.42;
    const wv = s * (hb - inset * 0.42) + s * 0.02;
    coll.addQuad(mats.inkSoft, P(a, wy, wv), P(b, wy, wv), P(b, wy + 0.24, wv), P(a, wy + 0.24, wv), out);
    // 版筑竖缝
    for (let u = a + 14; u < b - 6; u += 28) {
      coll.addQuad(mats.inkWash, P(u - 0.07, yb + 1.4, wv), P(u + 0.07, yb + 1.4, wv), P(u + 0.07, yt - 1.2, wv + 0.02), P(u - 0.07, yt - 1.2, wv + 0.02), out);
    }
  }
  if (crenel && !broken) {
    const pitch = 5.2;
    const cw = 1.15;
    const ch = 1.35;
    const cd = 0.7;
    const n = Math.floor((b - a) / pitch);
    const cv = s * (hb - inset - cd / 2 + 0.05);
    for (let i = 0; i < n; i++) {
      const u = a + pitch * (i + 0.5);
      if (axis === 'x') coll.addBox(mats.inkMid, cw, ch, cd, u, yt + ch / 2, c + cv);
      else coll.addBox(mats.inkMid, cd, ch, cw, c + cv, yt + ch / 2, u);
    }
  }
}

/** 马面（敌台）：从城墙外皮鼓出的墩台。 */
function addButtress(coll, mats, o) {
  const { axis, c, s, u, h = OUTER_CITY.wallH, t = OUTER_CITY.wallT, w = 15, d = 7 } = o;
  const yb = G;
  const ht = h + 0.4;
  const mid = axis === 'x' ? c + s * (t / 2 + d / 2 - 0.1) : c + s * (t / 2 + d / 2 - 0.1);
  if (axis === 'x') {
    coll.addBox(mats.wallHuang, w, ht, d + 1, u, yb + ht / 2, mid);
    coll.addBox(mats.inkWash, w + 0.5, 0.32, d + 1.5, u, yb + ht + 0.16, mid);
    for (let i = -2; i <= 2; i++) coll.addBox(mats.inkSoft, 1.1, 1.3, 0.7, u + i * 2.8, yb + ht + 0.32 + 0.65, mid + s * (d / 2 - 0.1));
  } else {
    coll.addBox(mats.wallHuang, d + 1, ht, w, mid, yb + ht / 2, u);
    coll.addBox(mats.inkWash, d + 1.5, 0.32, w + 0.5, mid, yb + ht + 0.16, u);
    for (let i = -2; i <= 2; i++) coll.addBox(mats.inkSoft, 0.7, 1.3, 1.1, mid + s * (d / 2 - 0.1), yb + ht + 0.32 + 0.65, u + i * 2.8);
  }
}

/** 角楼：城角墩台 + 两层小楼。 */
function addCornerTower(coll, mats, o) {
  const { x, z, ox, oz, h, t, big = true } = o;
  const yb = G;
  const w = big ? 30 : 22;
  coll.addBox(mats.wallHuang, w, h + 2.2, w, x, yb + (h + 2.2) / 2, z);
  coll.addBox(mats.stone, w + 0.6, 1.0, w + 0.6, x, yb + 0.5, z);
  coll.addBox(mats.inkWash, w + 1.0, 0.4, w + 1.0, x, yb + h + 2.4, z);
  // 四面垛口
  for (let i = -3; i <= 3; i++) {
    coll.addBox(mats.inkSoft, 1.5, 1.5, 0.8, x + i * 3.6, yb + h + 2.8, z + (w / 2 - 0.6));
    coll.addBox(mats.inkSoft, 1.5, 1.5, 0.8, x + i * 3.6, yb + h + 2.8, z - (w / 2 - 0.6));
    coll.addBox(mats.inkSoft, 0.8, 1.5, 1.5, x + (w / 2 - 0.6), yb + h + 2.8, z + i * 3.6);
    coll.addBox(mats.inkSoft, 0.8, 1.5, 1.5, x - (w / 2 - 0.6), yb + h + 2.8, z + i * 3.6);
  }
  // 角楼（两层）
  const by = yb + h + 2.4;
  coll.addBox(mats.stone, 17, 0.6, 17, x, by + 0.3, z);
  coll.addBox(mats.wallPlaster, 15, 4.6, 15, x, by + 0.6 + 2.3, z);
  for (const dx of [-6.6, 6.6]) for (const dz of [-6.6, 6.6]) coll.addBox(mats.column, 0.5, 4.6, 0.5, x + dx, by + 0.6 + 2.3, z + dz);
  // 二层
  const upY = by + 0.6 + 4.6 + 1.8;
  coll.addBox(mats.wallPlaster, 11, 3.0, 11, x, upY + 1.5, z);
  for (const dx of [-4.8, 4.8]) for (const dz of [-4.8, 4.8]) coll.addBox(mats.column, 0.4, 3.0, 0.4, x + dx, upY + 1.5, z + dz);
  addHipRoof(coll, mats, {
    x, y: upY + 3.0, z, width: 15.5, depth: 15.5, height: 4.2,
    tileMat: mats.roofTileDark, overhang: 1.6, segU: 6, segV: 3,
  });
  // 下层腰檐
  addHipRoof(coll, mats, {
    x, y: by + 0.6 + 4.6 + 0.1, z, width: 19.5, depth: 19.5, height: 2.0,
    tileMat: mats.roofTile, overhang: 1.2, segU: 4, segV: 2, ornaments: false,
  });
  // 旗与灯笼
  for (const sx of [-1, 1]) {
    coll.addCylinder(mats.woodDark, 0.1, 0.16, 8, x + sx * 7.6, by + 0.6, z + 7.6, 5);
  }
}

/* ========================================================================== */
/*  2. 城门（门洞 + 门楼 + 桥台）                                                */
/* ========================================================================== */

/** 门洞：城台挤出 + 梯形拱洞。返回门洞局部坐标（沿街心为 +z）几何。 */
function gatePlatformGeo(width, depth, height, openW, openH, archSpring) {
  const hw = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, height);
  shape.lineTo(-hw, height);
  shape.closePath();
  const ow = openW / 2;
  const spring = archSpring ?? Math.min(openH * 0.62, openH - 2.2);
  const arc = ow - 0.9;
  const hole = new THREE.Path();
  hole.moveTo(-ow + 0.01, 0);
  hole.lineTo(ow - 0.01, 0);
  hole.lineTo(arc, spring);
  hole.quadraticCurveTo(arc, openH, 0, openH);
  hole.quadraticCurveTo(-arc, openH, -arc, spring);
  hole.lineTo(-ow + 0.01, 0);
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** 一种门楼：'double' 重檐 / 'hip' 单檐庑殿 / 'gable' 单檐歇山。 */
function addGateTower(coll, mats, o) {
  const {
    x, z, rotY = 0, baseY, style = 'hip', width = 30, depth = 13,
    accent = false, lanterns = 2, flagPoles = 2,
  } = o;
  const c = Math.cos(rotY);
  const sn = Math.sin(rotY);
  // 局部 (lx 沿墙, lz 向外) → 世界
  const L = (lx, lz) => [x + c * lx + sn * lz, z - sn * lx + c * lz];
  const y0 = baseY + 0.55;
  const bodyH = style === 'double' ? 5.0 : 4.4;
  const bodyW = width * 0.82;
  const bodyD = depth * 0.76;
  const yMid = y0 + bodyH / 2;
  // 台明
  coll.addBox(mats.stone, width + 1.6, 0.55, depth + 1.6, x, baseY + 0.28, z, rotY);
  // 屋身
  coll.addBox(mats.wallPlaster, bodyW, bodyH, bodyD, x, yMid, z, rotY);
  // 朱柱：前后两面，每面 cols 根
  const cols = style === 'double' ? 4 : 3;
  for (let i = 0; i < cols; i++) {
    const lx = -bodyW / 2 + 1.0 + (i * (bodyW - 2.0)) / (cols - 1);
    for (const s of [-1, 1]) {
      const [px, pz] = L(lx, s * (bodyD / 2 - 0.2));
      coll.addBox(mats.column, 0.55, bodyH, 0.55, px, yMid, pz, rotY);
    }
  }
  // 门（朝外一面）
  {
    const [dx, dz] = L(0, bodyD / 2 + 0.08);
    coll.addBox(mats.door, bodyW * 0.2, bodyH * 0.62, 0.24, dx, y0 + bodyH * 0.31, dz, rotY);
    for (const s of [-1, 1]) {
      const [px, pz] = L(s * bodyW * 0.3, bodyD / 2 + 0.07);
      coll.addBox(mats.inkDark, bodyW * 0.17, bodyH * 0.3, 0.16, px, y0 + bodyH * 0.66, pz, rotY);
      for (let i = -1; i <= 1; i++) {
        const [qx, qz] = L(s * bodyW * 0.3 + i * 0.42, bodyD / 2 + 0.12);
        coll.addBox(accent ? mats.jade : mats.wood, 0.07, bodyH * 0.28, 0.07, qx, y0 + bodyH * 0.66, qz, rotY);
      }
    }
    // 额枋 / 斗拱 / 檐下暗带
    const [ax, az] = L(0, bodyD / 2 + 0.12);
    coll.addBox(mats.woodDark, bodyW + 0.4, 0.5, 0.5, ax, y0 + bodyH - 0.25, az, rotY);
    for (let i = 0; i < 7; i++) {
      const lx = -bodyW / 2 + 1.2 + (i * (bodyW - 2.4)) / 6;
      const [qx, qz] = L(lx, bodyD / 2 + 0.16);
      coll.addBox(mats.wood, 0.34, 0.34, 0.6, qx, y0 + bodyH + 0.16, qz, rotY);
    }
    const [ex, ez] = L(0, bodyD / 2 + 0.14);
    coll.addBox(mats.eave, bodyW + 0.8, 0.3, 0.4, ex, y0 + bodyH + 0.38, ez, rotY);
    // 匾额
    addPlaque(coll, mats, {
      x: ex, y: y0 + bodyH * 0.58, z: ez + 0.08, w: Math.min(6.2, bodyW * 0.34), h: 1.1, rotY,
    });
  }

  // 屋顶
  if (style === 'double') {
    const lowY = y0 + bodyH + 0.2;
    addHipRoof(coll, mats, { x, y: lowY, z, rotY, width: width * 1.02, depth: depth * 1.22, height: 2.6, tileMat: mats.roofTile, overhang: 1.0, segU: 5, segV: 2, ornaments: false });
    const upY = lowY + 2.6 + 0.5;
    coll.addBox(mats.wallPlaster, bodyW * 0.72, 2.6, bodyD * 0.66, x, upY + 1.3, z, rotY);
    for (const s of [-1, 1]) {
      const [qx, qz] = L(0, s * (bodyD * 0.33 + 0.06));
      coll.addBox(mats.inkDark, bodyW * 0.3, 1.1, 0.14, qx, upY + 1.4, qz, rotY);
    }
    addHipRoof(coll, mats, { x, y: upY + 2.6, z, rotY, width: width * 0.88, depth: depth * 1.02, height: 3.4, tileMat: mats.roofTileDark, overhang: 1.1, segU: 5, segV: 2 });
  } else if (style === 'hip') {
    addHipRoof(coll, mats, { x, y: y0 + bodyH + 0.45, z, rotY, width: width * 0.98, depth: depth * 1.1, height: 3.6, tileMat: mats.roofTile, overhang: 1.2, segU: 5, segV: 2 });
  } else {
    addGableRoof(coll, mats, { x, y: y0 + bodyH + 0.45, z, rotY: rotY + PI2, width: depth * 1.12, depth: width * 0.95, height: 3.0, tileMat: mats.roofTileDark, overhang: 0.9 });
  }

  // 灯笼 + 旗杆
  for (let i = 0; i < lanterns; i++) {
    const s = i % 2 === 0 ? -1 : 1;
    const [lx, lz] = L(s * (bodyW / 2 + 0.4), bodyD / 2 + 0.4);
    coll.addBox(mats.woodDark, 0.7, 0.08, 0.08, lx, y0 + bodyH - 0.5, lz, rotY);
    addLantern(coll, mats, lx, y0 + bodyH - 1.15, lz, 0.32);
  }
  for (let i = 0; i < flagPoles; i++) {
    const s = i % 2 === 0 ? -1 : 1;
    const [fx, fz] = L(s * (width / 2 - 0.8), bodyD / 2 + 0.6);
    coll.addCylinder(mats.woodDark, 0.1, 0.16, 7.5, fx, baseY + 0.6, fz, 5);
    const [bx, bz] = L(s * (width / 2 - 0.8) + (s > 0 ? 0.9 : -0.9), bodyD / 2 + 0.6);
    coll.addBox(mats.banner, 1.5, 3.0, 0.08, bx, baseY + 0.6 + 6.0, bz, rotY);
  }
}

/**
 * 一座城门：城台 + 门洞 + 门楼 + 桥台 + 关厢小景。
 * side: 'w'|'e'|'n'|'s'；门洞沿局部 +z 向外。
 */
function addGate(coll, mats, o) {
  const {
    x, z, side, style = 'hip', gateW = 34, openW = 16, openH = 9.5,
    wallH = OUTER_CITY.wallH, wallT = OUTER_CITY.wallT,
    bridge = true, accent = false, water = false,
  } = o;
  const rotY = side === 's' ? 0 : side === 'n' ? Math.PI : side === 'e' ? PI2 : -PI2;
  const c = Math.cos(rotY);
  const sn = Math.sin(rotY);
  const L = (lx, lz) => [x + c * lx + sn * lz, z - sn * lx + c * lz];
  const depth = wallT + 6;
  const baseY = G;
  const ph = wallH + (water ? 1.2 : 0.8);
  const geo = gatePlatformGeo(gateW, depth, ph, openW, openH + (water ? 0.6 : 0));
  coll.push(mats.wallHuang, geo, M4(x, baseY, z, rotY));
  // 条石基与台顶压沿
  coll.addBox(mats.stone, gateW + 0.8, 1.1, depth + 0.8, x, baseY + 0.55, z, rotY);
  coll.addBox(mats.inkWash, gateW + 1.0, 0.35, depth + 1.0, x, baseY + ph + 0.16, z, rotY);
  // 门框：朱红门柱 + 木梁（朝外一侧）
  for (const s2 of [-1, 1]) {
    const [px, pz] = L(s2 * (openW / 2 + 0.25), depth / 2 - 0.1);
    coll.addBox(mats.column, 0.7, openH * 0.72, 0.7, px, baseY + openH * 0.36, pz, rotY);
  }
  {
    const [bx, bz] = L(0, depth / 2 - 0.2);
    coll.addBox(mats.timber, openW + 1.2, 0.45, 0.45, bx, baseY + openH * 0.76, bz, rotY);
    // 门钉（朱漆大门）
    const [dx, dz] = L(0, depth / 2 - 1.6);
    coll.addBox(mats.door, openW * 0.82, openH * 0.66, 0.25, dx, baseY + openH * 0.33, dz, rotY);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
      const [gx, gz] = L(-openW * 0.3 + i * openW * 0.15, depth / 2 - 1.46);
      coll.addBox(mats.gold, 0.16, 0.16, 0.08, gx, baseY + 1.4 + j * 1.9, gz, rotY);
    }
  }
  // 门洞里贴地的暗影
  coll.addBox(mats.inkMid, openW - 0.6, 0.06, depth - 1.4, x, baseY + 0.05, z, rotY);
  // 门楼
  addGateTower(coll, mats, {
    x, z, rotY, baseY: baseY + ph - 0.1,
    style: water ? 'hip' : style,
    width: water ? gateW * 0.7 : gateW * 0.92,
    depth: depth * 1.1 + (water ? 1.0 : 2.2),
    accent, lanterns: 2, flagPoles: 2,
  });
  // 桥台（护城河上的桥留给 river 模块，这里只放石台与桥墩）
  if (bridge && !water) {
    const abut = (v, w, d, hh) => {
      const [wx, wz] = L(0, v);
      coll.addBox(mats.stone, w, hh, d, wx, G + hh / 2, wz, rotY);
      coll.addBox(mats.stoneShade, w + 0.4, 0.2, d + 0.4, wx, G + hh + 0.1, wz, rotY);
    };
    abut(depth / 2 + 10, 26, 6, 1.5);   // 城门这一头
    abut(MOAT.offset + MOAT.width + 6, 28, 7, 1.4); // 外岸那一头
    for (const v of [MOAT.offset + 12, MOAT.offset + MOAT.width - 4]) {
      const [wx, wz] = L(0, v);
      coll.addBox(mats.stone, 5, WATER_Y + 1.4, 3.2, wx, (WATER_Y + 1.4) / 2, wz, rotY);
    }
  }
  return { rootX: x, rootZ: z, rotY, depth, openW };
}

/* ========================================================================== */
/*  3. 护城河堤岸                                                              */
/* ========================================================================== */

function buildMoat(coll, mats, treeSpecs, rng) {
  const { x0, x1, z0, z1 } = OUTER_CITY;
  const d1 = MOAT.offset; // 内岸（靠城墙）
  const d2 = MOAT.offset + MOAT.width; // 外岸
  const wIn = 8; // 内岸坡宽
  const wOut = 8; // 外岸坡宽
  const waterY = WATER_Y - 0.05;
  const bedMat = inkMat(0xb8b2a0, { side: THREE.DoubleSide });
  setInkWeight(bedMat, 0.1);
  const stoneMat = mats.stone;
  const lineMat = mats.inkSoft;

  // 一条岸：从 (x0,z0)+(nx,nz) 的边线到 …… 用 4 条独立边（角上不重叠）
  const sides = [
    { axis: 'x', c: z0, s: -1, a: x0 - d2, b: x1 + d2 }, // 北
    { axis: 'x', c: z1, s: 1, a: x0 - d2, b: x1 + d2 }, // 南
    { axis: 'z', c: x0, s: -1, a: z0 - d2, b: z1 + d2 }, // 西
    { axis: 'z', c: x1, s: 1, a: z0 - d2, b: z1 + d2 }, // 东
  ];
  for (const sd of sides) {
    const { axis, c, s } = sd;
    let a = sd.a;
    let b = sd.b;
    if (axis === 'z') {
      // 南北两条已经包住角，东西两条缩进避免重叠
      a = z0 + d2 - 1;
      b = z1 - d2 + 1;
    }
    const P = (u, y, v) => (axis === 'x' ? V3(u, y, c + s * v) : V3(c + s * v, y, u));
    const up = V3(0, 1, 0);
    // 内岸坡 + 外岸坡 + 槽底
    coll.addQuad(mats.wallHuang, P(a, G, s * d1), P(b, G, s * d1), P(b, waterY, s * (d1 + wIn)), P(a, waterY, s * (d1 + wIn)), up);
    coll.addQuad(mats.wallHuang, P(b, G, s * d2), P(a, G, s * d2), P(a, waterY, s * (d2 - wOut)), P(b, waterY, s * (d2 - wOut)), up);
    coll.addQuad(bedMat, P(a, waterY - 0.35, s * (d1 + wIn)), P(b, waterY - 0.35, s * (d1 + wIn)), P(b, waterY - 0.35, s * (d2 - wOut)), P(a, waterY - 0.35, s * (d2 - wOut)), up);
    // 湿墨边（水线）
    coll.addQuad(lineMat, P(a, waterY + 0.01, s * (d1 + wIn + 0.3)), P(b, waterY + 0.01, s * (d1 + wIn + 0.3)), P(b, waterY + 0.14, s * (d1 + wIn + 0.3)), P(a, waterY + 0.14, s * (d1 + wIn + 0.3)), up);
    // 岸顶条石 + 柳树
    for (let u = a + 6; u < b - 4; u += 22) {
      if (axis === 'x') {
        coll.addBox(stoneMat, 1.4, 0.5, 0.9, u, G + 0.25, c + s * (d1 - 0.3));
        coll.addBox(stoneMat, 1.4, 0.5, 0.9, u + 4, G + 0.25, c + s * (d2 + 0.3));
      } else {
        coll.addBox(stoneMat, 0.9, 0.5, 1.4, c + s * (d1 - 0.3), G + 0.25, u);
        coll.addBox(stoneMat, 0.9, 0.5, 1.4, c + s * (d2 + 0.3), G + 0.25, u + 4);
      }
      // 外岸柳树
      if (rng() < 0.24) {
        const uu = u + 5;
        const vv = d2 + 4.5 + rng() * 2;
        const [wx, wz] = axis === 'x' ? [uu, c + s * vv] : [c + s * vv, uu];
        treeSpecs.push({ kind: rng() < 0.25 ? 'locust' : 'willow', x: wx, z: wz, y: G, h: 6.4 + rng() * 2.6 });
      }
    }
  }
}

/* ========================================================================== */
/*  4. 门外小关厢                                                              */
/* ========================================================================== */

function addGateOutskirt(coll, mats, rng, o) {
  const { x, z, side, rotY, spread = 1 } = o;
  const c = Math.cos(rotY);
  const sn = Math.sin(rotY);
  const F = (u, v) => [x + c * u + sn * v, z - sn * u + c * v]; // u 沿墙，v 向外
  // 茶棚 / 脚店（只放一两间）
  const houses = spread > 0 ? 2 : 1;
  for (let i = 0; i < houses; i++) {
    const s = i === 0 ? -1 : 1;
    const [hx, hz] = F(s * range(rng, 15, 24), range(rng, 18, 30));
    const w = range(rng, 6.5, 8);
    const d = range(rng, 5.5, 6.5);
    coll.addBox(mats.stone, w + 0.4, 0.35, d + 0.4, hx, G + 0.17, hz, rotY);
    coll.addBox(mats.wallPlaster, w, 3.2, d, hx, G + 0.35 + 1.6, hz, rotY);
    // 门面板
    coll.addBox(mats.woodDark, w * 0.7, 2.3, 0.14, hx, G + 1.5, hz + Math.cos(rotY) * (d / 2 + 0.04), rotY);
    addGableRoof(coll, mats, { x: hx, y: G + 3.55, z: hz, rotY: rotY + PI2, width: d + 1.2, depth: w + 1.2, height: rng() < 0.5 ? 2.0 : 1.5, tileMat: rng() < 0.45 ? mats.thatch : mats.roofTile, overhang: 0.5 });
    // 幌子
    if (rng() < 0.7) {
      const [sx, sz] = F(s * range(rng, 6, 11), range(rng, 12, 18));
      coll.addCylinder(mats.woodDark, 0.06, 0.08, 4.2, sx, G, sz, 4);
      coll.addBox(rng() < 0.5 ? mats.clothOchre : mats.banner, 0.06, 1.3, 1.4, sx + Math.cos(rotY) * 0.7, G + 3.4, sz - Math.sin(rotY) * 0.7, rotY);
    }
  }
  // 茶棚（四柱 + 草顶）
  if (rng() < 0.8) {
    const [tx, tz] = F(range(rng, -12, 12), range(rng, 10, 16));
    for (const [ox, oz] of [[-2.4, -1.6], [2.4, -1.6], [-2.4, 1.6], [2.4, 1.6]]) {
      coll.addBox(mats.woodDark, 0.14, 2.3, 0.14, tx + ox, G + 1.15, tz + oz);
    }
    addGableRoof(coll, mats, { x: tx, y: G + 2.3, z: tz, width: 6.2, depth: 4.6, height: 1.3, tileMat: mats.thatch, overhang: 0.4 });
    coll.addBox(mats.wood, 3.0, 0.1, 1.0, tx, G + 0.85, tz);
    for (const s of [-1, 1]) coll.addBox(mats.woodDark, 0.7, 0.5, 0.9, tx + s * 1.2, G + 0.4, tz);
  }
  // 拴马桩 + 旗杆 + 草垛
  for (let i = 0; i < 2; i++) {
    const [hx, hz] = F((i - 0.5) * 12, range(rng, 7, 13));
    coll.addBox(mats.stone, 0.5, 0.3, 0.5, hx, G + 0.15, hz);
    coll.addCylinder(mats.stone, 0.12, 0.15, 1.6, hx, G + 0.3, hz, 5);
  }
  const [fx, fz] = F(range(rng, -8, 8), range(rng, 8, 14));
  coll.addCylinder(mats.woodDark, 0.12, 0.2, 9.5, fx, G, fz, 5);
  coll.addBox(mats.banner, 0.1, 2.6, 1.6, fx + 0.85, G + 7.6, fz, rotY);
}

/* ========================================================================== */
/*  5. 人物                                                                    */
/* ========================================================================== */

const GATE_PEOPLE = {
  w: ['porter', 'camel', 'rider', 'walker', 'scholar', 'donkey', 'child', 'lady'],
  e: ['porter', 'rider', 'walker', 'vendor', 'scholar', 'camel', 'monk', 'lady'],
  n: ['porter', 'walker', 'donkey', 'scholar', 'child', 'rider', 'monk', 'lady'],
  s: ['walker', 'porter', 'palanquin', 'lady', 'scholar', 'child', 'donkey', 'monk'],
};

function addGatePeople(ctx, gates) {
  const P = ctx.people;
  if (!Array.isArray(P)) return 0;
  const rng = makeRng(778899);
  let n = 0;
  for (const g of gates) {
    const { x, z, side, count = 12, water = false, inner = false } = g;
    const kinds = water ? ['boatman', 'porter', 'walker', 'monk', 'scholar'] : GATE_PEOPLE[side] || GATE_PEOPLE.s;
    const rotY = side === 's' ? 0 : side === 'n' ? Math.PI : side === 'e' ? PI2 : -PI2;
    const c = Math.cos(rotY);
    const sn = Math.sin(rotY);
    for (let i = 0; i < count; i++) {
      const kind = kinds[Math.floor(rng() * kinds.length) % kinds.length];
      const along = (rng() - 0.5) * (inner ? 26 : 40);
      const outward = (rng() - 0.5) * (inner ? 26 : 46); // 负 = 城内，正 = 城外
      const px = x + c * along + sn * outward;
      const pz = z - sn * along + c * outward;
      const moving = rng() < 0.7;
      const dir = moving ? (rng() < 0.5 ? [sn, c] : [-sn, -c]) : undefined;
      const span = moving ? 6 + rng() * 10 : 0;
      P.push({ kind, x: px, z: pz, ...(moving ? { dir, span, speed: 0.35 + rng() * 0.4 } : {}) });
      n += 1;
    }
  }
  return n;
}

/* ========================================================================== */
/*  6. 构建入口                                                                */
/* ========================================================================== */

export function buildOuterCity(ctx) {
  const baseMats = ctx?.mats || {};
  const group = new THREE.Group();
  group.name = 'outer-city';
  const coll = new Collector();
  const rng = makeRng(20250501);
  const treeSpecs = [];

  /* ---------------- 城外大地（补到外城 + 护城河范围） ---------------- */
  const groundMat = inkMat(0xefe3c9, { side: THREE.DoubleSide });
  setInkWeight(groundMat, 0.1);
  const wallMat = inkMat(0xbfb49e);
  setInkWeight(wallMat, 0.28);
  const mats = { ...baseMats, wallHuang: wallMat };
  const gx0 = OUTER_CITY.x0 - MOAT.offset - MOAT.width - 140;
  const gx1 = OUTER_CITY.x1 + MOAT.offset + MOAT.width + 140;
  const gz0 = OUTER_CITY.z0 - MOAT.offset - MOAT.width - 140;
  const gz1 = OUTER_CITY.z1 + MOAT.offset + MOAT.width + 140;
  coll.addQuad(groundMat, V3(gx0, G - 0.03, gz0), V3(gx1, G - 0.03, gz0), V3(gx1, G - 0.03, gz1), V3(gx0, G - 0.03, gz1), V3(0, 1, 0));

  /* ---------------- 外城：12 门 ---------------- */
  const O = OUTER_CITY;
  const gateStyles = {
    xinzheng: { style: 'double', gateW: 38, openW: 18 },
    wansheng: { style: 'hip', gateW: 32, openW: 15 },
    guzi: { style: 'gable', gateW: 30, openW: 14 },
    chenqiao: { style: 'double', gateW: 38, openW: 18 },
    suanzao: { style: 'hip', gateW: 32, openW: 15 },
    dongbei: { style: 'hip', gateW: 40, openW: 24, water: true },
    xincao: { style: 'hip', gateW: 32, openW: 15 },
    xinsongmen: { style: 'double', gateW: 26, openW: 13 },
    dongshuimen: { style: 'hip', gateW: 50, openW: 42, water: true },
    xinnan: { style: 'double', gateW: 38, openW: 18 },
    chenzhou: { style: 'hip', gateW: 32, openW: 15 },
    xinmen: { style: 'gable', gateW: 30, openW: 14 },
  };
  const gateInfos = [];
  for (const g of O.gates) {
    const cfg = gateStyles[g.id] || { style: 'hip', gateW: 32, openW: 15 };
    addGate(coll, mats, {
      x: g.x, z: g.z, side: g.side,
      style: cfg.style, gateW: cfg.gateW, openW: cfg.openW, openH: g.id === 'dongshuimen' ? 10.5 : 9.5,
      wallH: O.wallH, wallT: O.wallT, water: !!cfg.water,
      bridge: !cfg.water, outskirt: true,
      accent: g.id === 'xinzheng' || g.id === 'xinsongmen' || g.id === 'xinnan' || g.id === 'chenqiao',
    });
    gateInfos.push({ ...g, ...cfg, count: 12 + Math.floor(rng() * 4) });
    // 门外小关厢
    const rotY = g.side === 's' ? 0 : g.side === 'n' ? Math.PI : g.side === 'e' ? PI2 : -PI2;
    addGateOutskirt(coll, mats, rng, {
      x: g.x + (g.side === 'e' ? 22 : g.side === 'w' ? -22 : 0),
      z: g.z + (g.side === 's' ? 22 : g.side === 'n' ? -22 : 0),
      side: g.side, rotY, spread: rng() < 0.5 ? 1 : 0,
    });
  }

  /* ---------------- 外城墙体 ---------------- */
  const wH = O.wallH;
  const wT = O.wallT;
  const gapHalf = (side, g, cfg) => (cfg.gateW || 34) / 2 + 1.2;
  const gapList = (side) => O.gates.filter((g) => g.side === side).map((g) => {
    const cfg = gateStyles[g.id] || { gateW: 32 };
    const gh = (cfg.gateW || 32) / 2 + 2.5;
    return side === 'n' || side === 's' ? [g.x - gh, g.x + gh] : [g.z - gh, g.z + gh];
  });
  const buildSide = (side) => {
    const gaps = gapList(side).sort((p, q) => p[0] - q[0]);
    if (side === 's' || side === 'n') {
      const c = side === 's' ? O.z1 : O.z0;
      const s = side === 's' ? 1 : -1;
      let a = O.x0 - 16;
      const bEnd = O.x1 + 16;
      for (const [ga, gb] of gaps) {
        if (ga > a) addWallSegment(coll, mats, { axis: 'x', c, s, a, b: ga, h: wH, t: wT });
        a = Math.max(a, gb);
      }
      if (a < bEnd) addWallSegment(coll, mats, { axis: 'x', c, s, a, b: bEnd, h: wH, t: wT });
      // 马面
      for (let u = O.x0 + 66; u < O.x1 - 40; u += 122) {
        if (gaps.some(([ga, gb]) => u > ga - 18 && u < gb + 18)) continue;
        addButtress(coll, mats, { axis: 'x', c, s, u, h: wH, t: wT });
      }
    } else {
      const c = side === 'e' ? O.x1 : O.x0;
      const s = side === 'e' ? 1 : -1;
      let a = O.z0 - 16;
      const bEnd = O.z1 + 16;
      for (const [ga, gb] of gaps) {
        if (ga > a) addWallSegment(coll, mats, { axis: 'z', c, s, a, b: ga, h: wH, t: wT });
        a = Math.max(a, gb);
      }
      if (a < bEnd) addWallSegment(coll, mats, { axis: 'z', c, s, a, b: bEnd, h: wH, t: wT });
      for (let u = O.z0 + 90; u < O.z1 - 50; u += 128) {
        if (gaps.some(([ga, gb]) => u > ga - 18 && u < gb + 18)) continue;
        addButtress(coll, mats, { axis: 'z', c, s, u, h: wH, t: wT });
      }
    }
  };
  for (const side of ['n', 's', 'w', 'e']) buildSide(side);
  // 四角角楼
  addCornerTower(coll, mats, { x: O.x0, z: O.z0, h: wH, t: wT });
  addCornerTower(coll, mats, { x: O.x1, z: O.z0, h: wH, t: wT });
  addCornerTower(coll, mats, { x: O.x0, z: O.z1, h: wH, t: wT });
  addCornerTower(coll, mats, { x: O.x1, z: O.z1, h: wH, t: wT });

  /* ---------------- 里城：5 门 ---------------- */
  const I = INNER_CITY;
  const innerGateCfg = {
    zhengmen: { style: 'double', gateW: 30, openW: 15 },
    songmen: { style: 'hip', gateW: 26, openW: 13 },
    chenqiao2: { style: 'hip', gateW: 24, openW: 12 },
    xinmen2: { style: 'double', gateW: 30, openW: 15 },
    caomen: { style: 'gable', gateW: 24, openW: 12 },
  };
  const innerInfos = [];
  for (const g of I.gates) {
    const cfg = innerGateCfg[g.id] || { style: 'hip', gateW: 26, openW: 13 };
    addGate(coll, mats, {
      x: g.x, z: g.z, side: g.side, style: cfg.style, gateW: cfg.gateW, openW: cfg.openW, openH: 8.4,
      wallH: I.wallH, wallT: I.wallT, bridge: false, outskirt: true, accent: false,
    });
    innerInfos.push({ ...g, ...cfg, count: 8 + Math.floor(rng() * 4), inner: true });
    addGateOutskirt(coll, mats, rng, { x: g.x, z: g.z, side: g.side, rotY: 0, spread: 0 });
  }
  // 里城墙（含汴河 / 金水河 / 五丈河的避让与残破）
  const innerGaps = new Map([['w', []], ['e', []], ['n', []], ['s', []]]);
  for (const g of I.gates) {
    const cfg = innerGateCfg[g.id] || { gateW: 26 };
    const gh = cfg.gateW / 2 + 2.2;
    innerGaps.get(g.side).push(g.side === 'n' || g.side === 's' ? [g.x - gh, g.x + gh] : [g.z - gh, g.z + gh]);
  }
  // 汴河 / 金水河 / 五丈河穿墙的水门洞
  const waterHole = (side, at, half) => innerGaps.get(side).push([at - half, at + half]);
  waterHole('w', riverZ(70) + 2, 26); // 汴河穿西墙
  waterHole('e', riverZ(450) + 2, 26); // 汴河穿东墙
  waterHole('w', -287, 11); // 金水河
  waterHole('e', -308, 11); // 五丈河
  // 里城西墙在长卷街市那一段断开（让 town 的城墙/街市露出来）
  innerGaps.get('w').push([-52, -2]);
  const innerSide = (side) => {
    const gaps = innerGaps.get(side).sort((p, q) => p[0] - q[0]);
    const h = I.wallH;
    const t = I.wallT;
    const brokenChance = 0.34;
    if (side === 's' || side === 'n') {
      const c = side === 's' ? I.z1 : I.z0;
      const s = side === 's' ? 1 : -1;
      let a = I.x0 - 10;
      const bEnd = I.x1 + 10;
      for (const [ga, gb] of gaps) {
        if (ga > a + 4) {
          const broken = a > I.x0 + 30 && rng() < brokenChance;
          addWallSegment(coll, mats, { axis: 'x', c, s, a, b: ga, h, t, bodyMat: mats.wallHuang, crenel: !broken, broken, brokenHeight: broken ? h * 0.55 : 0 });
        }
        a = Math.max(a, gb);
      }
      if (a < bEnd) addWallSegment(coll, mats, { axis: 'x', c, s, a, b: bEnd, h, t });
    } else {
      const c = side === 'e' ? I.x1 : I.x0;
      const s = side === 'e' ? 1 : -1;
      let a = I.z0 - 10;
      const bEnd = I.z1 + 10;
      for (const [ga, gb] of gaps) {
        if (ga > a + 4) {
          const broken = a > I.z0 + 40 && rng() < brokenChance;
          addWallSegment(coll, mats, { axis: 'z', c, s, a, b: ga, h, t, bodyMat: mats.wallHuang, crenel: !broken, broken, brokenHeight: broken ? h * 0.5 : 0 });
        }
        a = Math.max(a, gb);
      }
      if (a < bEnd) addWallSegment(coll, mats, { axis: 'z', c, s, a, b: bEnd, h, t });
    }
    // 里城马面少一些
    const n = side === 'n' || side === 's' ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const u = side === 'n' || side === 's'
        ? I.x0 + 70 + i * ((I.x1 - I.x0 - 140) / Math.max(1, n - 1))
        : I.z0 + 110 + i * ((I.z1 - I.z0 - 200) / Math.max(1, n - 1));
      if (gaps.some(([ga, gb]) => u > ga - 18 && u < gb + 18)) continue;
      addButtress(coll, mats, { axis: side === 'n' || side === 's' ? 'x' : 'z', c: side === 'n' ? I.z0 : side === 's' ? I.z1 : side === 'e' ? I.x1 : I.x0, s: side === 'n' ? -1 : side === 's' ? 1 : side === 'e' ? 1 : -1, u, h, t, w: 11, d: 5.5 });
    }
  };
  for (const side of ['n', 's', 'w', 'e']) innerSide(side);
  addCornerTower(coll, mats, { x: I.x0, z: I.z0, h: I.wallH, t: I.wallT, big: false });
  addCornerTower(coll, mats, { x: I.x1, z: I.z0, h: I.wallH, t: I.wallT, big: false });
  addCornerTower(coll, mats, { x: I.x0, z: I.z1, h: I.wallH, t: I.wallT, big: false });
  addCornerTower(coll, mats, { x: I.x1, z: I.z1, h: I.wallH, t: I.wallT, big: false });

  /* ---------------- 护城河堤岸 ---------------- */
  buildMoat(coll, mats, treeSpecs, rng);

  /* ---------------- 城门外的树 ---------------- */
  for (const g of [...gateInfos, ...innerInfos]) {
    const r = makeRng(1000 + (g.x | 0) + (g.z | 0));
    for (let i = 0; i < 2; i++) {
      treeSpecs.push({
        kind: r() < 0.5 ? 'willow' : r() < 0.6 ? 'locust' : 'pine',
        x: g.x + (r() - 0.5) * 60,
        z: g.z + (r() - 0.5) * 40,
        y: G, h: 5.5 + r() * 3,
      });
    }
  }

  /* ---------------- 人物 ---------------- */
  const peopleCount = addGatePeople(ctx, [...gateInfos, ...innerInfos]);

  /* ---------------- 合并出图 ---------------- */
  const staticGroup = coll.build('outer-city-static');
  group.add(staticGroup);
  if (treeSpecs.length) group.add(buildTrees(treeSpecs, ctx));

  group.userData.triangles = staticGroup.userData.triangles;
  group.userData.batches = staticGroup.userData.batches;
  group.userData.gates = O.gates.length + I.gates.length;
  group.userData.people = peopleCount;
  group.userData.trees = treeSpecs.length;
  return group;
}
