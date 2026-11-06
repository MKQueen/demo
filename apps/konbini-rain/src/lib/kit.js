/**
 * lib/kit.js —— 「模型零件」工具：几何体缓存 + 快速摆件 + 阴影标记。
 * 所有 world 模块都用它来搭场景，保持一致的尺度与材质习惯。
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const DEG = Math.PI / 180;

const geoCache = new Map();

export function cachedGeo(key, factory) {
  if (!geoCache.has(key)) geoCache.set(key, factory());
  return geoCache.get(key);
}

export function boxGeo(w, h, d) {
  return cachedGeo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
}

export function roundedBoxGeo(w, h, d, r = 0.04, seg = 2) {
  return cachedGeo(
    `rbox:${w}:${h}:${d}:${r}:${seg}`,
    () => new RoundedBoxGeometry(w, h, d, seg, r),
  );
}

export function planeGeo(w, h) {
  return cachedGeo(`plane:${w}:${h}`, () => new THREE.PlaneGeometry(w, h));
}

export function circleGeo(r, seg = 24) {
  return cachedGeo(`circle:${r}:${seg}`, () => new THREE.CircleGeometry(r, seg));
}

export function cylGeo(rt, rb, h, seg = 16, open = false) {
  return cachedGeo(`cyl:${rt}:${rb}:${h}:${seg}:${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
}

export function sphereGeo(r, ws = 16, hs = 12) {
  return cachedGeo(`sph:${r}:${ws}:${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
}

export function torusGeo(r, tube, rs = 8, ts = 24, arc = Math.PI * 2) {
  return cachedGeo(`tor:${r}:${tube}:${rs}:${ts}:${arc}`, () => new THREE.TorusGeometry(r, tube, rs, ts, arc));
}

/**
 * 摆一个 mesh。
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Material} material
 * @param {object} opts { x,y,z, rx,ry,rz, sx,sy,sz, cast, receive, parent, name, renderOrder }
 */
export function mesh(geometry, material, opts = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(opts.x ?? 0, opts.y ?? 0, opts.z ?? 0);
  m.rotation.set(opts.rx ?? 0, opts.ry ?? 0, opts.rz ?? 0);
  m.scale.set(opts.sx ?? 1, opts.sy ?? 1, opts.sz ?? 1);
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = opts.receive ?? true;
  if (opts.name) m.name = opts.name;
  if (opts.renderOrder !== undefined) m.renderOrder = opts.renderOrder;
  if (opts.parent) opts.parent.add(m);
  return m;
}

export function box(w, h, d, material, opts = {}) {
  return mesh(boxGeo(w, h, d), material, opts);
}

export function roundedBox(w, h, d, r, material, opts = {}) {
  return mesh(roundedBoxGeo(w, h, d, r, opts.seg ?? 2), material, opts);
}

export function plane(w, h, material, opts = {}) {
  return mesh(planeGeo(w, h), material, { cast: false, receive: false, ...opts });
}

export function cyl(rt, rb, h, segments, material, opts = {}) {
  return mesh(cylGeo(rt, rb, h, segments, opts.open ?? false), material, opts);
}

export function sphere(r, material, opts = {}) {
  return mesh(sphereGeo(r, opts.ws ?? 16, opts.hs ?? 12), material, opts);
}

export function torus(r, tube, rs, ts, material, opts = {}) {
  return mesh(torusGeo(r, tube, rs, ts, opts.arc ?? Math.PI * 2), material, opts);
}

/** 用一串点做一段管子（电线、水管、线缆） */
export function tube(points, radius, material, opts = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
  const geo = new THREE.TubeGeometry(curve, opts.segments ?? 24, radius, opts.radialSegments ?? 4, false);
  const m = mesh(geo, material, { ...opts, cast: opts.cast ?? false, receive: opts.receive ?? false });
  return m;
}

/** 悬链线（电线自然下垂） */
export function catenary(a, b, sag = 0.6, extra = []) {
  const A = a.isVector3 ? a : new THREE.Vector3(...a);
  const B = b.isVector3 ? b : new THREE.Vector3(...b);
  const pts = [];
  const n = 18;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const p = A.clone().lerp(B, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    for (const ex of extra) p.add(ex.clone().multiplyScalar(Math.sin(t * Math.PI)));
    pts.push(p);
  }
  return pts;
}

/** 快速 group */
export function group(name = '') {
  const g = new THREE.Group();
  g.name = name;
  return g;
}

/** 递归设置阴影标记 */
export function shadow(root, cast = true, receive = true) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.userData.isOutline) return;
    obj.castShadow = cast;
    obj.receiveShadow = receive;
  });
  return root;
}

/** 把一组 mesh 合并成 InstancedMesh（按给定矩阵数组） */
export function instanced(geometry, material, matrices, opts = {}) {
  const im = new THREE.InstancedMesh(geometry, material, matrices.length);
  const m = new THREE.Matrix4();
  matrices.forEach((mat4, i) => {
    if (mat4.isMatrix4) im.setMatrixAt(i, mat4);
    else {
      m.compose(
        new THREE.Vector3(mat4.x || 0, mat4.y || 0, mat4.z || 0),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(mat4.rx || 0, mat4.ry || 0, mat4.rz || 0)),
        new THREE.Vector3(mat4.sx ?? 1, mat4.sy ?? 1, mat4.sz ?? 1),
      );
      im.setMatrixAt(i, m);
    }
  });
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = opts.cast ?? false;
  im.receiveShadow = opts.receive ?? true;
  if (opts.parent) opts.parent.add(im);
  return im;
}

/** 组合矩阵工具（给 instanced 用） */
export function trs(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return { x, y, z, rx, ry, rz, sx, sy, sz };
}

export { THREE };
