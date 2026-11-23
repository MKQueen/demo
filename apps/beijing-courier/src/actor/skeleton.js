// Skeleton decoding for the Messenger character assets.
//
// Both the player avatar and every NPC ship their bones as a Draco *point cloud*
// (`<name>-bones.drc`) with four custom attributes:
//
//   position   float32 x3   local translation (relative to the parent bone)
//   quaternion float32 x4   local rotation, three.js order (x, y, z, w)
//   scale      float32 x3   local scale (constant 1 in every shipped asset)
//   hierarchy  uint16  x1   parent index **+ 1**; 0 means "no parent / root"
//
// The original site's worker stores `hierarchy = parent + 1` instead of the usual
// -1 sentinel so the whole column can stay unsigned. A skeleton is therefore a
// plain forest: usually one root (the hips at y ~= 0.826 for the avatar), then
// spine/arms/legs chains.
import * as THREE from 'three';

/** Playback rate of every point-cloud clip in the asset set. */
export const ANIMATION_FPS = 30;

/** Read the custom point-cloud attributes of a bones `.drc` into plain arrays. */
export function readBoneData(geometry) {
  const position = geometry.getAttribute('position');
  const quaternion = geometry.getAttribute('quaternion');
  if (!position || !quaternion) {
    throw new Error('character bones: missing position/quaternion attribute');
  }
  const count = position.count;
  const hierarchy = geometry.getAttribute('hierarchy');
  if (!hierarchy) throw new Error('character bones: missing hierarchy attribute');

  const parents = new Int32Array(count);
  for (let i = 0; i < count; i++) parents[i] = hierarchy.array[i] - 1;

  const scales = geometry.getAttribute('scale');
  return {
    count,
    parents,
    positions: position.array,
    quaternions: quaternion.array,
    scales: scales ? scales.array : null,
  };
}

/**
 * Build a THREE.Skeleton (and the matching THREE.Bone hierarchy) from bone data.
 *
 * Returns the bones plus the inverse bind matrices, both expressed in the
 * character's local space (root at the character origin, feet at y = 0).
 * The caller is responsible for adding `roots` to a node that shares a parent
 * with the SkinnedMesh (see skin.js for the bind-matrix contract).
 */
export function buildSkeleton(boneData) {
  const { count, parents, positions, quaternions, scales } = boneData;
  const bones = new Array(count);
  const roots = [];
  for (let i = 0; i < count; i++) {
    const bone = new THREE.Bone();
    bone.name = boneName(i);
    bone.position.fromArray(positions, i * 3);
    bone.quaternion.fromArray(quaternions, i * 4);
    if (scales) bone.scale.fromArray(scales, i * 3);
    bones[i] = bone;
  }

  // Resolve parents in topological order (parents always precede children in
  // the shipped assets, but stay safe and sort explicitly).
  const order = new Array(count);
  const state = new Uint8Array(count); // 0 = unvisited, 1 = visiting, 2 = done
  let cursor = 0;
  const visit = (i) => {
    if (state[i] === 2) return;
    if (state[i] === 1) throw new Error('character bones: cyclic hierarchy');
    state[i] = 1;
    const parent = parents[i];
    if (parent >= 0) {
      if (parent >= count) throw new Error(`character bones: parent ${parent} out of range`);
      visit(parent);
      bones[parent].add(bones[i]);
    } else {
      roots.push(bones[i]);
    }
    state[i] = 2;
    order[cursor++] = i;
  };
  for (let i = 0; i < count; i++) visit(i);

  // Bind-pose world matrices (relative to the character root) -> inverse binds.
  const world = new Array(count);
  const local = new THREE.Matrix4();
  for (let k = 0; k < count; k++) {
    const i = order[k];
    const bone = bones[i];
    bone.updateMatrix();
    const parent = parents[i];
    if (parent >= 0) world[i] = new THREE.Matrix4().multiplyMatrices(world[parent], bone.matrix);
    else world[i] = bone.matrix.clone();
    local.identity();
  }
  const boneInverses = world.map((m) => m.clone().invert());

  const skeleton = new THREE.Skeleton(bones, boneInverses);
  return { skeleton, bones, roots, count };
}

/** Bone names are only used by the AnimationMixer to bind tracks. */
export function boneName(index) {
  return `bone${index}`;
}

/**
 * Add the skeleton's root bones to `parent` (usually the character root group).
 * Kept separate so callers can decide where the bones live in the hierarchy.
 */
export function attachBones(skeletonData, parent) {
  for (const root of skeletonData.roots) parent.add(root);
}
