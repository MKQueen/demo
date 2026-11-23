// The playable courier avatar.
//
// Assets (all decoded by src/assets.js):
//   geometries/avatar/avatar-bones.drc           22-bone point cloud (see skeleton.js)
//   geometries/avatar/<clip>.drc                 idle/run/sprint/air/afk1..3 point clouds
//   geometries/avatar/accessories/<piece>.drc    base + 7 hair + 9 tops + 7 bottoms + 7 shoes
//
// Convention: the character stands with its feet on y = 0 and faces local +Z.
// `root` is the object the game controller positions/orients on the planet; the
// skeleton and the (single, merged) SkinnedMesh live under it.
//
// Outfits: every accessory is preloaded at startup (the original site does the
// same), so `setOutfit()` is synchronous — it only re-merges the geometries into
// one BufferGeometry. One character = one draw call.
import * as THREE from 'three';
import { readBoneData, buildSkeleton, attachBones } from './skeleton.js';
import { buildAnimationClip } from './clip.js';
import { mergeSkinnedGeometries, createSkinnedMesh, setSkinnedGeometry } from './skin.js';
import { resolveActorMaterial, setUniform } from './material-utils.js';

const AVATAR_DIR = 'geometries/avatar';
const BONES_PATH = `${AVATAR_DIR}/avatar-bones.drc`;
const BASE_PIECE = 'base';

/** Rendered height of the default outfit (bind pose, feet at y = 0). */
export const AVATAR_HEIGHT = 1.64;

/** Selectable accessory pieces (names as shipped in the .drc files). */
export const ACCESSORIES = Object.freeze({
  hair: Object.freeze(['hair1', 'hair2', 'hair3', 'hair4', 'hair5', 'hair6', 'hair7']),
  top: Object.freeze(['top1', 'top2', 'top3', 'top4', 'top5', 'top6', 'top7', 'top8', 'top9']),
  bottom: Object.freeze(['bottom1', 'bottom2', 'bottom3', 'bottom4', 'bottom5', 'bottom6', 'bottom7']),
  shoes: Object.freeze(['shoes1', 'shoes2', 'shoes3', 'shoes4', 'shoes5', 'shoes6', 'shoes7']),
});

/** Default look: dark bob, orange hoodie, rust skirt, dark shoes (reference shot). */
export const DEFAULT_OUTFIT = Object.freeze({
  hair: 'hair3',
  top: 'top2',
  bottom: 'bottom4',
  shoes: 'shoes5',
});

/** Clips and their playback speed (matches the original site's animationOptions). */
export const ANIMATIONS = Object.freeze({
  idle: Object.freeze({ file: 'avatar-idle', speed: 1 }),
  run: Object.freeze({ file: 'avatar-run', speed: 1.1 }),
  sprint: Object.freeze({ file: 'avatar-sprint', speed: 1.1 }),
  air: Object.freeze({ file: 'avatar-air', speed: 1 }),
  afk1: Object.freeze({ file: 'avatar-afk1', speed: 1 }),
  afk2: Object.freeze({ file: 'avatar-afk2', speed: 1 }),
  afk3: Object.freeze({ file: 'avatar-afk3', speed: 1 }),
});

const DEFAULT_FADE = 0.2;
const OUTFIT_CACHE_LIMIT = 24;
const SLOTS = Object.keys(ACCESSORIES);

function accessoryPath(piece) {
  return `${AVATAR_DIR}/accessories/${piece}.drc`;
}

function normalizeOutfit(outfit, fallback = DEFAULT_OUTFIT) {
  const next = {};
  for (const slot of SLOTS) {
    const value = outfit && outfit[slot] !== undefined ? outfit[slot] : fallback[slot];
    if (value === null || value === '') {
      next[slot] = null;
      continue;
    }
    if (!ACCESSORIES[slot].includes(value)) {
      throw new Error(`setOutfit: unknown ${slot} "${value}" (expected one of ${ACCESSORIES[slot].join(', ')})`);
    }
    next[slot] = value;
  }
  return next;
}

function outfitKey(outfit) {
  return SLOTS.map((slot) => outfit[slot] || '-').join('|');
}

/**
 * Create the playable avatar.
 *
 * @param {object} options
 * @param {object} options.assets      asset loader from src/assets.js
 * @param {object} [options.materials] render-layer materials ({ character() })
 * @param {object} [options.outfit]    initial outfit, e.g. { hair: 'hair1', top: 'top4' }
 * @returns avatar api: { root, ready, update, play, setOutfit, setTalking, ... }
 */
export function createAvatar({ assets, materials, outfit } = {}) {
  if (!assets) throw new Error('createAvatar: assets is required');

  const root = new THREE.Group();
  root.name = 'avatar';
  // Bones + mesh live under `rig`; `rig` itself is never transformed. The
  // controller moves `root`, so the character can be dropped onto any planet
  // surface without touching the actor internals.
  const rig = new THREE.Group();
  rig.name = 'avatar-rig';
  root.add(rig);

  const state = {
    ready: false,
    disposed: false,
    pose: null,
    pendingPose: 'idle',
    outfit: normalizeOutfit(outfit || DEFAULT_OUTFIT),
    talking: false,
    visible: true,
  };

  let skeletonData = null;
  let skeleton = null;
  let mesh = null;
  let material = null;
  let mixer = null;
  const actions = new Map();
  const clips = new Map();
  const accessoryGeometries = new Map();
  const outfitGeometryCache = new Map();

  function buildOutfitGeometry(nextOutfit) {
    const key = outfitKey(nextOutfit);
    const cached = outfitGeometryCache.get(key);
    if (cached) return cached;
    const pieces = [BASE_PIECE, ...SLOTS.map((slot) => nextOutfit[slot]).filter(Boolean)];
    const geometries = pieces.map((piece) => {
      const geometry = accessoryGeometries.get(piece);
      if (!geometry) throw new Error(`avatar: accessory "${piece}" was not loaded`);
      return geometry;
    });
    const merged = mergeSkinnedGeometries(geometries);
    merged.name = `avatar-outfit-${key}`;
    outfitGeometryCache.set(key, merged);
    if (outfitGeometryCache.size > OUTFIT_CACHE_LIMIT) {
      const [oldKey, oldGeometry] = outfitGeometryCache.entries().next().value;
      outfitGeometryCache.delete(oldKey);
      oldGeometry.dispose();
    }
    return merged;
  }

  function configureAction(name, action) {
    action.enabled = false;
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.setEffectiveTimeScale(ANIMATIONS[name].speed);
    action.setEffectiveWeight(0);
    action.clampWhenFinished = false;
  }

  /** Crossfade to a locomotion clip: 'idle' | 'run' | 'sprint' | 'air' | 'afk1..3'. */
  function play(name, fade = DEFAULT_FADE) {
    if (!ANIMATIONS[name]) {
      console.warn(`avatar.play: unknown animation "${name}"`);
      return false;
    }
    if (!state.ready) {
      state.pendingPose = name;
      return true;
    }
    const next = actions.get(name);
    if (!next) return false;
    const previous = state.pose ? actions.get(state.pose) : null;
    if (previous === next && next.isRunning()) return true;

    next.reset();
    next.enabled = true;
    next.setEffectiveTimeScale(ANIMATIONS[name].speed);
    next.setEffectiveWeight(1);
    next.play();
    if (previous && previous !== next && fade > 0) {
      next.crossFadeFrom(previous, fade, false);
    } else if (previous && previous !== next) {
      previous.stop();
    }
    state.pose = name;
    return true;
  }

  /** Advance the animation mixer. Call once per frame with the frame delta. */
  function update(dt) {
    if (!state.ready || state.disposed) return;
    const step = Math.min(Math.max(dt, 0), 0.1);
    mixer.update(step);
  }

  /**
   * Swap outfit pieces. Accepts a partial outfit ({ hair: 'hair3' }), drives the
   * wardrobe UI. Pass null for a slot to hide that piece (e.g. { hair: null }).
   */
  function setOutfit(partial = {}) {
    const next = normalizeOutfit({ ...state.outfit, ...partial }, state.outfit);
    state.outfit = next;
    if (mesh) setSkinnedGeometry(mesh, buildOutfitGeometry(next));
    return { ...next };
  }

  /** Talking state: the avatar shader has no mouth, this only forwards the flag. */
  function setTalking(talking) {
    state.talking = Boolean(talking);
    if (material) setUniform(material, 'uIsTalking', state.talking ? 1 : 0);
  }

  function setVisible(visible) {
    state.visible = Boolean(visible);
    root.visible = state.visible;
  }

  /**
   * Blinking is shader-driven in the original game: the IS_CHARACTER fragment
   * branch computes the blink from `time` (+ a per-character batch id that the
   * render layer pins to 0 for the single local player). There is no actor-side
   * animation to trigger, so this hook only drives an explicit uniform should
   * the render layer ever expose one.
   */
  function blink() {
    return material ? setUniform(material, 'uBlink', 1) : false;
  }

  function setMaterial(nextMaterial) {
    material = nextMaterial;
    if (mesh) mesh.material = material;
  }

  function dispose() {
    if (state.disposed) return;
    state.disposed = true;
    root.removeFromParent();
    mixer?.stopAllAction();
    for (const geometry of outfitGeometryCache.values()) geometry.dispose();
    outfitGeometryCache.clear();
    if (mesh) mesh.geometry = null;
    if (material) material.dispose?.();
  }

  const ready = (async () => {
    const pieces = [BASE_PIECE, ...SLOTS.flatMap((slot) => ACCESSORIES[slot])];
    const names = Object.keys(ANIMATIONS);
    const [boneGeometry, animationGeometries, accessoryResults, resolvedMaterial] = await Promise.all([
      assets.loadGeometry(BONES_PATH),
      Promise.all(names.map((name) => assets.loadGeometry(`${AVATAR_DIR}/${ANIMATIONS[name].file}.drc`))),
      Promise.all(pieces.map((piece) => assets.loadGeometry(accessoryPath(piece)))),
      resolveActorMaterial(materials, 'character', assets),
    ]);
    if (state.disposed) return avatar;

    skeletonData = buildSkeleton(readBoneData(boneGeometry));
    skeleton = skeletonData.skeleton;
    attachBones(skeletonData, rig);

    pieces.forEach((piece, index) => accessoryGeometries.set(piece, accessoryResults[index]));

    material = resolvedMaterial;
    mesh = createSkinnedMesh(buildOutfitGeometry(state.outfit), material, skeleton);
    rig.add(mesh);

    mixer = new THREE.AnimationMixer(rig);
    names.forEach((name, index) => {
      const clip = buildAnimationClip(name, animationGeometries[index], skeletonData.count);
      clips.set(name, clip);
      const action = mixer.clipAction(clip);
      configureAction(name, action);
      actions.set(name, action);
    });

    state.ready = true;
    if (state.talking) setUniform(material, 'uIsTalking', 1);
    const initialPose = ANIMATIONS[state.pendingPose] ? state.pendingPose : 'idle';
    play(initialPose, 0);
    mixer.update(0);
    return avatar;
  })();

  const avatar = {
    type: 'avatar',
    root,
    rig,
    ready,
    height: AVATAR_HEIGHT,
    get outfit() {
      return { ...state.outfit };
    },
    get pose() {
      return state.pose;
    },
    get clips() {
      return Object.keys(ANIMATIONS);
    },
    get talking() {
      return state.talking;
    },
    get visible() {
      return state.visible;
    },
    get skeleton() {
      return skeleton;
    },
    get mesh() {
      return mesh;
    },
    get material() {
      return material;
    },
    get mixer() {
      return mixer;
    },
    play,
    update,
    setOutfit,
    setTalking,
    setVisible,
    blink,
    setMaterial,
    dispose,
  };
  return avatar;
}
