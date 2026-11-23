// Spherical-ground collision helper.
//
// The original site ships dedicated low-poly collision meshes
// (`hitmesh_0..4.drc`). Ray-casting ~148k triangles per frame is too slow, so
// we bin triangles by the spherical direction of their vertices. A downward
// ray only needs to test the triangles in its own bin (roughly 100-300).

import * as THREE from 'three';

const LAT_BINS = 32;
const LON_BINS = 64;

function dirToBin(n) {
  const lat = Math.asin(THREE.MathUtils.clamp(n.y, -1, 1));
  let lon = Math.atan2(n.z, n.x);
  if (lon < 0) lon += Math.PI * 2;
  const latBin = THREE.MathUtils.clamp(Math.floor(((lat + Math.PI / 2) / Math.PI) * LAT_BINS), 0, LAT_BINS - 1);
  const lonBin = THREE.MathUtils.clamp(Math.floor((lon / (Math.PI * 2)) * LON_BINS), 0, LON_BINS - 1);
  return latBin * LON_BINS + lonBin;
}

const GRID_MIN = -46;
const GRID_MAX = 46;
const CELL = 4.0;
const GRID_N = Math.ceil((GRID_MAX - GRID_MIN) / CELL);

function cellIndex(x, y, z) {
  const cx = Math.floor((x - GRID_MIN) / CELL);
  const cy = Math.floor((y - GRID_MIN) / CELL);
  const cz = Math.floor((z - GRID_MIN) / CELL);
  if (cx < 0 || cy < 0 || cz < 0 || cx >= GRID_N || cy >= GRID_N || cz >= GRID_N) return -1;
  return (cx * GRID_N + cy) * GRID_N + cz;
}

// Fast enough ray casting over the original hitmesh: triangles are bucketed
// into a uniform 3D grid, then a ray is marched cell by cell (3D DDA).
export class GroundCollision {
  constructor(geometry) {
    this.geometry = geometry;
    const pos = geometry.getAttribute('position');
    const index = geometry.getIndex();
    const triCount = index ? index.count / 3 : pos.count / 3;
    this.positions = pos.array;
    this.index = index ? index.array : null;
    this.triCount = triCount;
    this.cells = new Map();

    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let t = 0; t < triCount; t++) {
      const i0 = (this.index ? this.index[t * 3] : t * 3) * 3;
      const i1 = (this.index ? this.index[t * 3 + 1] : t * 3 + 1) * 3;
      const i2 = (this.index ? this.index[t * 3 + 2] : t * 3 + 2) * 3;
      a.fromArray(this.positions, i0);
      b.fromArray(this.positions, i1);
      c.fromArray(this.positions, i2);
      min.set(Math.min(a.x, b.x, c.x), Math.min(a.y, b.y, c.y), Math.min(a.z, b.z, c.z));
      max.set(Math.max(a.x, b.x, c.x), Math.max(a.y, b.y, c.y), Math.max(a.z, b.z, c.z));
      const x0 = Math.floor((min.x - GRID_MIN) / CELL);
      const x1 = Math.floor((max.x - GRID_MIN) / CELL);
      const y0 = Math.floor((min.y - GRID_MIN) / CELL);
      const y1 = Math.floor((max.y - GRID_MIN) / CELL);
      const z0 = Math.floor((min.z - GRID_MIN) / CELL);
      const z1 = Math.floor((max.z - GRID_MIN) / CELL);
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          for (let z = z0; z <= z1; z++) {
            if (x < 0 || y < 0 || z < 0 || x >= GRID_N || y >= GRID_N || z >= GRID_N) continue;
            const key = (x * GRID_N + y) * GRID_N + z;
            let list = this.cells.get(key);
            if (!list) { list = []; this.cells.set(key, list); }
            if (list[list.length - 1] !== t) list.push(t);
          }
        }
      }
    }
    this.extra = [];
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._c = new THREE.Vector3();
    this._edge1 = new THREE.Vector3();
    this._edge2 = new THREE.Vector3();
    this._h = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._q = new THREE.Vector3();
    this._normal = new THREE.Vector3();
  }

  _tri(t, origin, direction, best) {
    const i0 = (this.index ? this.index[t * 3] : t * 3) * 3;
    const i1 = (this.index ? this.index[t * 3 + 1] : t * 3 + 1) * 3;
    const i2 = (this.index ? this.index[t * 3 + 2] : t * 3 + 2) * 3;
    const a = this._a.fromArray(this.positions, i0);
    const b = this._b.fromArray(this.positions, i1);
    const c = this._c.fromArray(this.positions, i2);
    this._edge1.subVectors(b, a);
    this._edge2.subVectors(c, a);
    this._h.crossVectors(direction, this._edge2);
    const det = this._edge1.dot(this._h);
    if (det > -1e-9 && det < 1e-9) return null;
    const inv = 1 / det;
    this._s.subVectors(origin, a);
    const u = inv * this._s.dot(this._h);
    if (u < 0 || u > 1) return null;
    this._q.crossVectors(this._s, this._edge1);
    const v = inv * direction.dot(this._q);
    if (v < 0 || u + v > 1) return null;
    const dist = inv * this._edge2.dot(this._q);
    if (dist <= 1e-5 || dist >= best) return null;
    return { dist, t };
  }

  /** Clone the acceleration structure so callers can add extra colliders
   *  (e.g. the camera-only collision of self-built Beijing buildings) without
   *  touching the gameplay ground. */
  clone() {
    const copy = Object.create(GroundCollision.prototype);
    copy.positions = this.positions;
    copy.index = this.index;
    copy.triCount = this.triCount;
    copy.extra = [];
    copy.cells = new Map();
    for (const [key, list] of this.cells) copy.cells.set(key, list.slice());
    copy._a = new THREE.Vector3();
    copy._b = new THREE.Vector3();
    copy._c = new THREE.Vector3();
    copy._edge1 = new THREE.Vector3();
    copy._edge2 = new THREE.Vector3();
    copy._normal = new THREE.Vector3();
    copy._h = new THREE.Vector3();
    copy._s = new THREE.Vector3();
    copy._q = new THREE.Vector3();
    return copy;
  }

  /** Append triangles from a mesh geometry (already in world space, or via the
   *  supplied matrix) to this collision set. Used for our procedural Beijing
   *  terraces (walkable) and for camera-only collision. */
  appendGeometry(geometry, matrixWorld = null) {
    const pos = geometry.getAttribute('position');
    if (!pos) return 0;
    const index = geometry.getIndex();
    const triCount = index ? index.count / 3 : pos.count / 3;
    const mat = matrixWorld || null;
    const v = new THREE.Vector3();
    const min = new THREE.Vector3();
    const max = new THREE.Vector3();
    let added = 0;
    for (let t = 0; t < triCount; t += 1) {
      const tri = [];
      for (let k = 0; k < 3; k += 1) {
        const vertexIndex = index ? index.getX(t * 3 + k) : t * 3 + k;
        v.fromBufferAttribute(pos, vertexIndex);
        if (mat) v.applyMatrix4(mat);
        tri.push(v.clone());
      }
      const [a, b, c] = tri;
      const extraIndex = this.extra.length;
      this.extra.push(tri);
      min.set(Math.min(a.x, b.x, c.x), Math.min(a.y, b.y, c.y), Math.min(a.z, b.z, c.z));
      max.set(Math.max(a.x, b.x, c.x), Math.max(a.y, b.y, c.y), Math.max(a.z, b.z, c.z));
      const x0 = Math.floor((min.x - GRID_MIN) / CELL);
      const x1 = Math.floor((max.x - GRID_MIN) / CELL);
      const y0 = Math.floor((min.y - GRID_MIN) / CELL);
      const y1 = Math.floor((max.y - GRID_MIN) / CELL);
      const z0 = Math.floor((min.z - GRID_MIN) / CELL);
      const z1 = Math.floor((max.z - GRID_MIN) / CELL);
      for (let x = x0; x <= x1; x += 1) {
        for (let y = y0; y <= y1; y += 1) {
          for (let z = z0; z <= z1; z += 1) {
            if (x < 0 || y < 0 || z < 0 || x >= GRID_N || y >= GRID_N || z >= GRID_N) continue;
            const key = (x * GRID_N + y) * GRID_N + z;
            let list = this.cells.get(key);
            if (!list) { list = []; this.cells.set(key, list); }
            list.push(-(extraIndex + 1));
          }
        }
      }
      added += 1;
    }
    return added;
  }

  /** Append every mesh in the given list (already in world space). */
  appendMeshes(meshes) {
    let added = 0;
    for (const mesh of meshes) {
      if (!mesh?.isMesh || !mesh.geometry) continue;
      mesh.updateWorldMatrix(true, false);
      added += this.appendGeometry(mesh.geometry, mesh.matrixWorld);
    }
    return added;
  }

  _triExtra(extraIndex, origin, direction, best) {
    const tri = this.extra[extraIndex];
    const a = tri[0];
    const b = tri[1];
    const c = tri[2];
    this._edge1.subVectors(b, a);
    this._edge2.subVectors(c, a);
    this._h.crossVectors(direction, this._edge2);
    const det = this._edge1.dot(this._h);
    if (det > -1e-9 && det < 1e-9) return null;
    const inv = 1 / det;
    this._s.subVectors(origin, a);
    const u = inv * this._s.dot(this._h);
    if (u < 0 || u > 1) return null;
    this._q.crossVectors(this._s, this._edge1);
    const v = inv * direction.dot(this._q);
    if (v < 0 || u + v > 1) return null;
    const dist = inv * this._edge2.dot(this._q);
    if (dist <= 1e-5 || dist >= best) return null;
    return { dist, t: extraIndex };
  }

  raycast(origin, direction, maxDist = 120) {
    const o = origin;
    const d = direction.clone().normalize();
    let t = 0;
    let best = maxDist;
    let bestTri = -1;
    // 3D DDA
    let cx = Math.floor((o.x - GRID_MIN) / CELL);
    let cy = Math.floor((o.y - GRID_MIN) / CELL);
    let cz = Math.floor((o.z - GRID_MIN) / CELL);
    const stepX = d.x > 0 ? 1 : -1;
    const stepY = d.y > 0 ? 1 : -1;
    const stepZ = d.z > 0 ? 1 : -1;
    const tDeltaX = d.x !== 0 ? Math.abs(CELL / d.x) : Infinity;
    const tDeltaY = d.y !== 0 ? Math.abs(CELL / d.y) : Infinity;
    const tDeltaZ = d.z !== 0 ? Math.abs(CELL / d.z) : Infinity;
    const nextBoundary = (c, step) => GRID_MIN + (c + (step > 0 ? 1 : 0)) * CELL;
    let tMaxX = d.x !== 0 ? (nextBoundary(cx, stepX) - o.x) / d.x : Infinity;
    let tMaxY = d.y !== 0 ? (nextBoundary(cy, stepY) - o.y) / d.y : Infinity;
    let tMaxZ = d.z !== 0 ? (nextBoundary(cz, stepZ) - o.z) / d.z : Infinity;

    for (let guard = 0; guard < GRID_N * 4; guard++) {
      if (cx >= 0 && cy >= 0 && cz >= 0 && cx < GRID_N && cy < GRID_N && cz < GRID_N) {
        const list = this.cells.get((cx * GRID_N + cy) * GRID_N + cz);
        if (list) {
          for (let i = 0; i < list.length; i++) {
            const entry = list[i];
            const hit = entry >= 0 ? this._tri(entry, o, d, best) : this._triExtra(-entry - 1, o, d, best);
            if (hit) { best = hit.dist; bestTri = hit.t; }
          }
        }
      }
      if (best <= t) break;
      if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
        cx += stepX; t = tMaxX; tMaxX += tDeltaX;
      } else if (tMaxY <= tMaxZ) {
        cy += stepY; t = tMaxY; tMaxY += tDeltaY;
      } else {
        cz += stepZ; t = tMaxZ; tMaxZ += tDeltaZ;
      }
      if (t > best || (tMaxX === Infinity && tMaxY === Infinity && tMaxZ === Infinity)) break;
    }

    if (bestTri < 0) return null;
    const point = o.clone().addScaledVector(d, best);
    if (bestTri >= 0) {
      const i0 = (this.index ? this.index[bestTri * 3] : bestTri * 3) * 3;
      const i1 = (this.index ? this.index[bestTri * 3 + 1] : bestTri * 3 + 1) * 3;
      const i2 = (this.index ? this.index[bestTri * 3 + 2] : bestTri * 3 + 2) * 3;
      this._a.fromArray(this.positions, i0);
      this._b.fromArray(this.positions, i1);
      this._c.fromArray(this.positions, i2);
    } else {
      const tri = this.extra[bestTri];
      this._a.copy(tri[0]);
      this._b.copy(tri[1]);
      this._c.copy(tri[2]);
    }
    this._edge1.subVectors(this._b, this._a);
    this._edge2.subVectors(this._c, this._a);
    this._normal.crossVectors(this._edge1, this._edge2).normalize();
    if (this._normal.dot(o) < 0) this._normal.negate();
    return { point, normal: this._normal.clone(), distance: best };
  }

  groundAt(point, height = 80) {
    const n = new THREE.Vector3().copy(point).normalize();
    if (n.lengthSq() < 1e-6) return null;
    return this.raycast(n.clone().multiplyScalar(height), n.clone().negate(), height + 40);
  }

  groundAtDirection(n, height = 80) {
    const dir = new THREE.Vector3().copy(n).normalize();
    return this.raycast(dir.clone().multiplyScalar(height), dir.clone().negate(), height + 40);
  }
}
