// Skinned mesh assembly for the Messenger character assets.
//
// Avatar accessories (`base`, `hairN`, `topN`, `bottomN`, `shoesN`) and the NPC
// bodies are Draco *triangle meshes* that already carry the skinning attributes
// produced by the site's exporter:
//
//   position   float32 x3
//   normal     float32 x3
//   uv         float32 x2   (samples the 16x16 palette atlas; >1 = eyes, <0 = mouth)
//   skinIndex  uint16  x4   bone indices
//   skinWeight float32 x4   bone weights (sum to 1)
//   surfaceId  float32 x1   outline/face id used by the outline pass
//
// All accessories of the avatar share the same 22-bone skeleton and the same
// attribute layout, so an outfit is merged into a single BufferGeometry and
// rendered as one SkinnedMesh (one draw call per character).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const IDENTITY = new THREE.Matrix4();

export const REQUIRED_ATTRIBUTES = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight', 'surfaceId'];

/**
 * Make every vertex' bone weights sum to 1.
 *
 * The shipped accessory meshes contain a handful of vertices whose weights are
 * authored as [1, 1] (e.g. one vertex each in bottom2/bottom3). The skinning
 * shader accumulates boneMatrix * position * weight without normalising, so an
 * unnormalised vertex is displaced twice as far and produces a long triangle
 * spike as soon as the leg swings. The site's own geometry worker normalises
 * them; we do the same here.
 */
export function normalizeSkinWeights(geometry) {
  const attribute = geometry.getAttribute('skinWeight');
  if (!attribute) return false;
  const array = attribute.array;
  let changed = false;
  for (let i = 0; i < array.length; i += 4) {
    const sum = array[i] + array[i + 1] + array[i + 2] + array[i + 3];
    if (sum > 0 && Math.abs(sum - 1) > 1e-4) {
      const inverse = 1 / sum;
      array[i] *= inverse;
      array[i + 1] *= inverse;
      array[i + 2] *= inverse;
      array[i + 3] *= inverse;
      changed = true;
    }
  }
  if (changed) attribute.needsUpdate = true;
  return changed;
}

/** Throw if a decoded character geometry is missing a required attribute. */
export function assertSkinnedGeometry(geometry, label = 'character mesh') {
  for (const name of REQUIRED_ATTRIBUTES) {
    if (!geometry.getAttribute(name)) throw new Error(`${label}: missing "${name}" attribute`);
  }
  const skinIndex = geometry.getAttribute('skinIndex');
  const skinWeight = geometry.getAttribute('skinWeight');
  if (skinIndex.itemSize !== 4 || skinWeight.itemSize !== 4) {
    throw new Error(`${label}: skinIndex/skinWeight must have 4 components`);
  }
  return geometry;
}

/**
 * Merge several accessory geometries into one. Inputs are guaranteed by the
 * exporter to share the same attribute set/types, so a plain merge works.
 */
export function mergeSkinnedGeometries(geometries) {
  const valid = geometries.filter(Boolean);
  if (valid.length === 0) throw new Error('mergeSkinnedGeometries: nothing to merge');
  for (const geometry of valid) assertSkinnedGeometry(geometry);
  if (valid.length === 1) {
    valid[0].computeBoundingBox();
    valid[0].computeBoundingSphere();
    return valid[0];
  }
  const merged = mergeGeometries(valid, false);
  if (!merged) throw new Error('mergeSkinnedGeometries: incompatible attribute sets');
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Create the character SkinnedMesh for a geometry + material + skeleton.
 *
 * The mesh must live in the same parent group as the skeleton's root bone and
 * be bound while that group is at the bind pose (identity local transform).
 * `bindMatrix` is identity: the geometry is authored in character space, and
 * three's AttachedBindMode handles the root/pivot transform cancellation.
 */
export function createSkinnedMesh(geometry, material, skeleton, name = 'character-skin') {
  normalizeSkinWeights(geometry);
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = name;
  // Skeleton deformation means the static bounding volume is useless; the
  // character is always on screen anyway, so skip per-frame culling math.
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.bind(skeleton, IDENTITY);
  return mesh;
}

/** Replace the geometry of an existing SkinnedMesh (used by outfit switching). */
export function setSkinnedGeometry(mesh, geometry) {
  mesh.geometry = geometry;
  if (!mesh.bindMatrix.equals(IDENTITY)) mesh.bindMatrix.identity();
  mesh.bindMatrixInverse.identity();
  mesh.updateMatrixWorld(true);
}
