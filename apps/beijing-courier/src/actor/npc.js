// Talking NPCs (chef, oldwoman, musician, ...).
//
// Every NPC ships the same three-file layout under geometries/npcs/present/<type>/:
//   <type>-bones.drc   point-cloud skeleton (same format as the avatar, 9..32 bones)
//   <type>.drc         skinned triangle mesh (palette-atlas UVs, eyes/mouth sprites)
//   <type>-idle.drc    plus optional -talk / -talk-idle / -walk clips
//
// The slot table below is taken 1:1 from the original site's `createNPCS()` data:
// every NPC declares four animation slots [idle, talk, idleTalk, walk]; types
// without a real clip repeat their idle file (the original does the same), and a
// couple of types tweak the playback speed (boss/threekid 0.9, flower lady 0.75).
//
// Conventions match the avatar: feet on y = 0, local +Z is the facing direction.
// `root` is placed/oriented by the world on the planet surface; an inner `pivot`
// group yaws toward `setLookAt()` so the root orientation (surface normal) is
// never destroyed by the NPC's own turning.
import * as THREE from 'three';
import { readBoneData, buildSkeleton, attachBones } from './skeleton.js';
import { buildAnimationClip } from './clip.js';
import { createSkinnedMesh } from './skin.js';
import { resolveActorMaterial, setUniform } from './material-utils.js';

const NPC_DIR = 'geometries/npcs/present';

/** Animation slots, in the same order the original site declares them. */
export const ANIMATION_SLOTS = Object.freeze(['idle', 'talk', 'idleTalk', 'walk']);

function idleOnly(stem) {
  return { idle: stem, talk: stem, idleTalk: stem, walk: stem };
}

/**
 * Animation slot -> clip file stem per shipped NPC type.
 * Mirrors the original game's NPC configuration exactly (including the
 * "no talk clip -> reuse idle" cases).
 */
export const NPC_ANIMATIONS = Object.freeze({
  alien: Object.freeze(idleOnly('alien-idle')),
  boss: Object.freeze(idleOnly('boss-idle')),
  caveman: Object.freeze(idleOnly('caveman-idle')),
  chef: Object.freeze(idleOnly('chef-idle')),
  diver: Object.freeze({ idle: 'diver-idle', talk: 'diver-talk', idleTalk: 'diver-talk-idle', walk: 'diver-idle' }),
  'factory-worker-a': Object.freeze(idleOnly('factory-worker-a-idle')),
  'factory-worker-b': Object.freeze({
    idle: 'factory-worker-b-walk',
    talk: 'factory-worker-b-talk',
    idleTalk: 'factory-worker-b-walk',
    walk: 'factory-worker-b-walk',
  }),
  'factory-worker-c': Object.freeze(idleOnly('factory-worker-c-idle')),
  'female-scientist': Object.freeze(idleOnly('female-scientist-idle')),
  fox: Object.freeze(idleOnly('fox-idle')),
  'male-scientist': Object.freeze(idleOnly('male-scientist-idle')),
  mountainman: Object.freeze(idleOnly('mountainman-idle')),
  musician: Object.freeze({ idle: 'musician-idle', talk: 'musician-talk', idleTalk: 'musician-idle', walk: 'musician-idle' }),
  'office-worker': Object.freeze({
    idle: 'office-worker-idle',
    talk: 'office-worker-talk',
    idleTalk: 'office-worker-idle-talk',
    walk: 'office-worker-walk',
  }),
  oldwoman: Object.freeze(idleOnly('oldwoman-idle')),
  owl: Object.freeze(idleOnly('owl-idle')),
  scout: Object.freeze(idleOnly('scout-idle')),
  threekid: Object.freeze(idleOnly('threekid-idle')),
  'young-lady': Object.freeze({
    idle: 'young-lady-idle',
    talk: 'young-lady-talk',
    idleTalk: 'young-lady-talk-idle',
    walk: 'young-lady-idle',
  }),
});

/** Per-slot playback speed overrides (from the original NPC configuration). */
export const NPC_ANIMATION_SPEEDS = Object.freeze({
  boss: Object.freeze({ idle: 0.9, talk: 0.9, idleTalk: 0.9, walk: 0.9 }),
  threekid: Object.freeze({ idle: 0.9, talk: 0.9, idleTalk: 0.9, walk: 0.9 }),
  'young-lady': Object.freeze({ idle: 0.75, talk: 1.1, idleTalk: 1, walk: 1 }),
});

/** Friendly aliases used by the game code / story data. */
export const NPC_ALIASES = Object.freeze({
  kids: 'threekid',
  mountains: 'mountainman',
  mountain: 'mountainman',
  'flower-lady': 'young-lady',
});

export const NPC_TYPES = Object.freeze(Object.keys(NPC_ANIMATIONS));

const DEFAULT_FADE = 0.25;
const TURN_SPEED = 7.5; // yaw responsiveness, exponentially damped per second

const _target = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();

function shortestAngle(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function resolveType(type) {
  const key = String(type || '').toLowerCase();
  return NPC_ALIASES[key] || key;
}

function animationConfig(type) {
  const slots = NPC_ANIMATIONS[type] || idleOnly(`${type}-idle`);
  const speeds = NPC_ANIMATION_SPEEDS[type] || {};
  return { slots, speeds };
}

/**
 * Create an NPC.
 *
 * @param {object} options
 * @param {object} options.assets      asset loader from src/assets.js
 * @param {object} [options.materials] render-layer materials ({ npc() })
 * @param {string} options.type        e.g. 'chef', 'oldwoman', 'young-lady'
 * @returns npc api (see ARCHITECTURE.md)
 */
export function createNPC({ assets, materials, type } = {}) {
  if (!assets) throw new Error('createNPC: assets is required');
  const npcType = resolveType(type);
  if (!npcType) throw new Error('createNPC: type is required');

  const { slots, speeds } = animationConfig(npcType);
  const dir = `${NPC_DIR}/${npcType}`;

  const root = new THREE.Group();
  root.name = `npc-${npcType}`;
  const pivot = new THREE.Group();
  pivot.name = 'npc-pivot';
  root.add(pivot);

  const state = {
    ready: false,
    disposed: false,
    type: npcType,
    pose: null,
    pendingPose: 'idle',
    talking: false,
    visible: true,
    lookAt: null,
    yaw: 0,
    targetYaw: 0,
    height: 1.6,
  };

  let skeletonData = null;
  let skeleton = null;
  let mesh = null;
  let material = null;
  let mixer = null;
  const actions = new Map(); // slot -> AnimationAction
  const slotClips = new Map(); // slot -> AnimationClip (for introspection)

  function actionFor(slot) {
    return actions.get(slot) || null;
  }

  function play(name, fade = DEFAULT_FADE) {
    if (!ANIMATION_SLOTS.includes(name)) {
      console.warn(`npc(${npcType}).play: unknown animation slot "${name}"`);
      return false;
    }
    if (!state.ready) {
      state.pendingPose = name;
      return true;
    }
    const next = actionFor(name);
    if (!next) return false;
    const previous = state.pose ? actionFor(state.pose) : null;
    if (previous === next) {
      state.pose = name;
      return true;
    }
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.play();
    if (previous && fade > 0) next.crossFadeFrom(previous, fade, false);
    else if (previous) previous.stop();
    state.pose = name;
    return true;
  }

  function setTalking(talking) {
    state.talking = Boolean(talking);
    if (material) setUniform(material, 'uIsTalking', state.talking ? 1 : 0);
    if (!state.ready) return;
    play(state.talking ? 'talk' : 'idle');
  }

  /** Aim the NPC at a world-space point (or null to return to its default yaw). */
  function setLookAt(target) {
    if (!target) {
      state.lookAt = null;
      state.targetYaw = 0;
      return;
    }
    state.lookAt = state.lookAt || new THREE.Vector3();
    state.lookAt.copy(target);
    updateTargetYaw();
  }

  function updateTargetYaw() {
    if (!state.lookAt) {
      state.targetYaw = 0;
      return;
    }
    // Bring the target into the root's local space. The root orientation is
    // owned by the world (planet surface tangent frame), so a world-space yaw
    // would be wrong as soon as the NPC stands on a different part of the planet.
    _target.copy(state.lookAt);
    if (root.parent) root.parent.worldToLocal(_target);
    _dir.copy(_target).sub(root.position);
    _quat.copy(root.quaternion).invert();
    _dir.applyQuaternion(_quat);
    state.targetYaw = Math.atan2(_dir.x, _dir.z);
  }

  function update(dt) {
    if (!state.ready || state.disposed) return;
    const step = Math.min(Math.max(dt, 0), 0.1);
    mixer.update(step);
    if (state.lookAt) updateTargetYaw();
    const delta = shortestAngle(state.yaw, state.targetYaw);
    if (Math.abs(delta) > 1e-5) {
      state.yaw += delta * (1 - Math.exp(-TURN_SPEED * step));
      pivot.rotation.y = state.yaw;
    }
  }

  function setVisible(visible) {
    state.visible = Boolean(visible);
    root.visible = state.visible;
  }

  function dispose() {
    if (state.disposed) return;
    state.disposed = true;
    root.removeFromParent();
    mixer?.stopAllAction();
    if (mesh) mesh.geometry = null;
    if (material && !material.userData?.shared) material.dispose?.();
  }

  const ready = (async () => {
    const clipFiles = [...new Set(ANIMATION_SLOTS.map((slot) => slots[slot]))];
    const [boneGeometry, meshGeometry, clipGeometries, resolvedMaterial] = await Promise.all([
      assets.loadGeometry(`${dir}/${npcType}-bones.drc`),
      assets.loadGeometry(`${dir}/${npcType}.drc`),
      Promise.all(clipFiles.map((file) => assets.loadGeometry(`${dir}/${file}.drc`))),
      resolveActorMaterial(materials, 'npc', assets),
    ]);
    if (state.disposed) return;

    skeletonData = buildSkeleton(readBoneData(boneGeometry));
    skeleton = skeletonData.skeleton;
    attachBones(skeletonData, pivot);

    material = resolvedMaterial;
    mesh = createSkinnedMesh(meshGeometry, material, skeleton, `npc-${npcType}-skin`);
    pivot.add(mesh);

    const bounds = meshGeometry.boundingBox;
    state.height = Math.max(0.1, bounds.max.y - bounds.min.y);

    mixer = new THREE.AnimationMixer(pivot);
    const clipByFile = new Map();
    clipFiles.forEach((file, index) => {
      clipByFile.set(file, buildAnimationClip(file, clipGeometries[index], skeletonData.count));
    });
    // One action per (clip, speed) pair: the original reuses the same clip across
    // slots (e.g. every chef slot plays chef-idle), so identical slots share an
    // action and only speed variants get a cloned clip.
    const actionByKey = new Map();
    const fileHasAction = new Set();
    for (const slot of ANIMATION_SLOTS) {
      const file = slots[slot];
      const speed = speeds[slot] ?? 1;
      const key = `${file}@${speed}`;
      let action = actionByKey.get(key);
      if (!action) {
        let clip = clipByFile.get(file);
        if (fileHasAction.has(file)) clip = clip.clone();
        fileHasAction.add(file);
        action = mixer.clipAction(clip);
        action.enabled = false;
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.setEffectiveTimeScale(speed);
        action.setEffectiveWeight(0);
        actionByKey.set(key, action);
      }
      actions.set(slot, action);
      slotClips.set(slot, action.getClip());
    }

    state.ready = true;
    state.pose = null;
    play(ANIMATION_SLOTS.includes(state.pendingPose) ? state.pendingPose : 'idle', 0);
    if (state.talking) {
      setUniform(material, 'uIsTalking', 1);
      play('talk', 0);
    }
    mixer.update(0);
    return npc;
  })();

  const npc = {
    type: 'npc',
    npcType,
    root,
    pivot,
    ready,
    get height() {
      return state.height;
    },
    get pose() {
      return state.pose;
    },
    get clips() {
      return Object.fromEntries(ANIMATION_SLOTS.filter((slot) => slotClips.has(slot)).map((slot) => [slot, slots[slot]]));
    },
    get availablePoses() {
      return ANIMATION_SLOTS.filter((slot) => actions.has(slot));
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
    get talking() {
      return state.talking;
    },
    get yaw() {
      return state.yaw;
    },
    get targetYaw() {
      return state.targetYaw;
    },
    play,
    update,
    setTalking,
    setLookAt,
    setVisible,
    dispose,
  };
  return npc;
}
