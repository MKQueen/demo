// Animation clip decoding for the Messenger character assets.
//
// Every clip (avatar-idle.drc, chef-idle.drc, ...) is a Draco point cloud whose
// points are `frame * boneCount + bone`, i.e. frame-major:
//
//   position   float32 x3   local bone translation for that frame
//   quaternion float32 x4   local bone rotation, three.js order (x, y, z, w)
//   scale      float32 x3   local bone scale (constant 1, omitted from tracks)
//
// The amount of points is therefore `frames * boneCount` (avatar idle: 90 * 22).
// Playback rate is 30 fps for every clip.
//
// Loop handling: a few clips duplicate the first frame as their last frame
// (run/sprint/afk3, and air duplicates frame 1 as the last frame). For those we
// drop the duplicate so the wrap is seamless; other clips are stored without an
// explicit duplicate and simply loop with duration = frames / 30.
import * as THREE from 'three';
import { ANIMATION_FPS, boneName } from './skeleton.js';

const DUPLICATE_EPSILON = 5e-4;

function frameAttributeBuffer(attribute, frames, boneCount, bone, itemSize) {
  const out = new Float32Array(frames * itemSize);
  const src = attribute.array;
  const stride = boneCount * itemSize;
  for (let f = 0; f < frames; f++) {
    const srcOffset = f * stride + bone * itemSize;
    out.set(src.subarray(srcOffset, srcOffset + itemSize), f * itemSize);
  }
  return out;
}

/** Largest absolute component difference between frames `a` and `b`. */
function frameDifference(geometry, boneCount, a, b) {
  let worst = 0;
  for (const name of ['position', 'quaternion']) {
    const attribute = geometry.getAttribute(name);
    if (!attribute) continue;
    const itemSize = attribute.itemSize;
    const src = attribute.array;
    const stride = boneCount * itemSize;
    for (let bone = 0; bone < boneCount; bone++) {
      for (let c = 0; c < itemSize; c++) {
        const d = Math.abs(src[a * stride + bone * itemSize + c] - src[b * stride + bone * itemSize + c]);
        if (d > worst) worst = d;
      }
    }
  }
  return worst;
}

/**
 * Decide the number of frames that form one loop.
 * Returns { frames, loopDuration, loop } where `frames` is the number of keys
 * to write (duplicates already removed).
 */
function resolveLoop(geometry, boneCount, pointFrames) {
  if (pointFrames < 3) return { frames: pointFrames, duration: pointFrames / ANIMATION_FPS, loop: true };
  const last = pointFrames - 1;
  // Standard "the last frame repeats the first one" export.
  if (frameDifference(geometry, boneCount, 0, last) < DUPLICATE_EPSILON) {
    return { frames: last, duration: last / ANIMATION_FPS, loop: true };
  }
  // Air ships an extra trailing frame that duplicates frame 1 while frame
  // `frames - 2` duplicates frame 0; treat the trailing frame as redundant too.
  if (frameDifference(geometry, boneCount, 1, last) < DUPLICATE_EPSILON &&
      frameDifference(geometry, boneCount, 0, last - 1) < DUPLICATE_EPSILON) {
    return { frames: last, duration: last / ANIMATION_FPS, loop: true };
  }
  return { frames: pointFrames, duration: pointFrames / ANIMATION_FPS, loop: true };
}

/**
 * Build a THREE.AnimationClip from a decoded animation point cloud.
 *
 * Track names target `boneN.position` / `boneN.quaternion`, matching the names
 * assigned in skeleton.js, so any AnimationMixer rooted at the character root
 * can play it.
 */
export function buildAnimationClip(name, geometry, boneCount) {
  const position = geometry.getAttribute('position');
  const quaternion = geometry.getAttribute('quaternion');
  if (!position || !quaternion) {
    throw new Error(`animation "${name}": missing position/quaternion attribute`);
  }
  const pointFrames = position.count / boneCount;
  if (!Number.isInteger(pointFrames)) {
    throw new Error(`animation "${name}": ${position.count} points is not a multiple of ${boneCount} bones`);
  }
  if (quaternion.count !== boneCount * pointFrames) {
    throw new Error(`animation "${name}": position/quaternion frame count mismatch`);
  }

  const loop = resolveLoop(geometry, boneCount, pointFrames);
  const { frames, duration } = loop;

  const times = new Float32Array(frames);
  for (let f = 0; f < frames; f++) times[f] = f / ANIMATION_FPS;

  const tracks = [];
  for (let bone = 0; bone < boneCount; bone++) {
    tracks.push(new THREE.VectorKeyframeTrack(
      `${boneName(bone)}.position`,
      times,
      frameAttributeBuffer(position, frames, boneCount, bone, 3),
    ));
    tracks.push(new THREE.QuaternionKeyframeTrack(
      `${boneName(bone)}.quaternion`,
      times,
      frameAttributeBuffer(quaternion, frames, boneCount, bone, 4),
    ));
  }

  const clip = new THREE.AnimationClip(name, duration, tracks);
  clip.userData = {
    frames,
    sourceFrames: pointFrames,
    fps: ANIMATION_FPS,
    boneCount,
    loop: loop.loop,
  };
  return clip;
}
