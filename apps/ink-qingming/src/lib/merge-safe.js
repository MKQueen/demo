/**
 * merge-safe.js —— 对 BufferGeometryUtils.mergeGeometries 的容错包装。
 * 各模块的几何属性（uv / color / normal / 自定义属性）经常不一致，
 * 直接 merge 会报错并丢掉整块建筑；这里先把属性对齐再合并。
 */
import * as THREE from 'three';
import { mergeGeometries as baseMerge } from 'three/addons/utils/BufferGeometryUtils.js';

export function mergeGeometries(list, useGroups = false) {
  let geoms = list.filter(Boolean);
  if (!geoms.length) return new THREE.BufferGeometry();
  if (geoms.length === 1) return geoms[0];

  const anyIndexed = geoms.some((g) => g.index);
  const anyPlain = geoms.some((g) => !g.index);
  if (anyIndexed && anyPlain) geoms = geoms.map((g) => (g.index ? g.toNonIndexed() : g));

  const sizes = {};
  for (const g of geoms) {
    for (const [name, attr] of Object.entries(g.attributes)) {
      if (!sizes[name]) sizes[name] = attr.itemSize;
    }
  }
  if (!sizes.position) return new THREE.BufferGeometry();

  for (const g of geoms) {
    const count = g.attributes.position.count;
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const [name, size] of Object.entries(sizes)) {
      if (g.attributes[name]) continue;
      const arr = new Float32Array(count * size);
      if (name === 'color' || name === 'normal') arr.fill(1);
      g.setAttribute(name, new THREE.Float32BufferAttribute(arr, size));
    }
  }
  const merged = baseMerge(geoms, useGroups);
  return merged || new THREE.BufferGeometry();
}
