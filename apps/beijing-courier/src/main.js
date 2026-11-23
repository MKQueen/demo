// 京城来信 · Beijing Courier
// ---------------------------------------------------------------------------
// A high-fidelity re-creation of the look & feel of https://messenger.abeto.co,
// rebuilt on the site's extracted character / planet / environment assets.
//
// Integration layer: boot, intro, planet traversal, NPCs, delivery quests,
// dialogue & UI wiring, audio, and the frame loop.

import * as THREE from 'three';
import './style.css';

import { CONFIG } from './config.js';
import { createAssets } from './assets.js';
import { createMaterials } from './render/materials.js';
import { createEnvironmentMaterials } from './render/environment.js';
import { createPipeline } from './render/pipeline.js';
import { buildPlanet, buildIntroPlanet } from './world/planet.js';
import { createDeliveryItem } from './world/items.js';
import { createAvatar, DEFAULT_OUTFIT } from './actor/avatar.js';
import { createNPC } from './actor/npc.js';
import { createOriginalCourier, COURIER_OUTFITS, DEFAULT_COURIER_OUTFIT } from './actor/originalCourier.js';
import { createOriginalNPC, ORIGINAL_NPC_LABELS } from './actor/originalNpc.js';
import { buildBeijing } from './world/beijing.js';
import { createInput, PlayerController, FollowCamera } from './game/player.js';
import { createAudio } from './game/audio.js';
import * as story from './game/story.js';
import { createUI } from './ui/dom.js';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#world');
const uiRoot = $('#ui-root');

const debug = { paused: false, freezeFrame: false, freeCamera: null };
const STORAGE_KEY = CONFIG.STORAGE_KEY;
const REGION_TO_STORY = {
  harbor: 'beach',
  village: 'village',
  city: 'city',
  countryside: 'forest',
  mountain: 'temple',
};

// ---------------------------------------------------------------- renderer
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
} catch (err) {
  $('#fatal').hidden = false;
  throw err;
}
const BASE_PIXEL_RATIO = Math.min(devicePixelRatio || 1, 1.5);
const isCoarsePointer = matchMedia('(pointer: coarse)').matches;
const RENDER_SCALE = isCoarsePointer ? 1.0 : (devicePixelRatio >= 2 ? 1.0 : 1.4);
renderer.setPixelRatio(BASE_PIXEL_RATIO);
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.2, 175);

// ---------------------------------------------------------------- scenes & lights
const gameScene = new THREE.Scene();
gameScene.background = new THREE.Color('#000000');

const gameSun = new THREE.DirectionalLight('#ffffff', 3);
gameSun.castShadow = true;
gameSun.shadow.mapSize.set(2048, 2048);
gameSun.shadow.camera.left = -12;
gameSun.shadow.camera.right = 12;
gameSun.shadow.camera.top = 12;
gameSun.shadow.camera.bottom = -12;
gameSun.shadow.camera.near = 20;
gameSun.shadow.camera.far = 210;
gameSun.shadow.bias = -0.0001;
gameSun.shadow.normalBias = 0.07;
const sunDir = new THREE.Vector3(-0.416, 0.809, 0.416).normalize();
gameSun.position.copy(sunDir).multiplyScalar(100);
gameScene.add(gameSun);
gameScene.add(gameSun.target);
gameScene.add(new THREE.HemisphereLight('#25577c', '#2f2f2f', 0.7));

const introScene = new THREE.Scene();
introScene.background = new THREE.Color('#66bde6');
const introSun = new THREE.DirectionalLight('#ffffff', 2.4);
introSun.position.set(-60, 90, 50);
introScene.add(introSun);
introScene.add(new THREE.HemisphereLight('#9fe2e0', '#3f4c4a', 1.05));

// ---------------------------------------------------------------- assets / render layers
const assets = createAssets(renderer);
const materials = createMaterials({ assets });
const env = createEnvironmentMaterials({ assets });
const pipeline = createPipeline(renderer, { renderScale: RENDER_SCALE });
const audio = createAudio(assets);
const input = createInput(canvas);
// procedural BGM renders in an OfflineAudioContext; start it while the player
// is still reading the intro so the loop is ready by the time they press BEGIN
audio.preload?.();

// ---------------------------------------------------------------- runtime state
const state = {
  mode: 'boot', // boot | intro | loading | playing
  letterIndex: 0,
  letterStates: {},
  stage: 'ask',
  outfit: { ...DEFAULT_COURIER_OUTFIT },
  muted: false,
};
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  if (Number.isFinite(saved.letterIndex) && saved.letterIndex >= 0) state.letterIndex = Math.min(saved.letterIndex, story.LETTERS.length - 1);
  if (saved.letterStates && typeof saved.letterStates === 'object') state.letterStates = saved.letterStates;
  if (saved.outfit && typeof saved.outfit === 'object') {
    // migrate the old reference-site outfit slots to the original courier's
    // own hat/bag/scarf colour variants
    if ('hat' in saved.outfit || 'bag' in saved.outfit || 'scarf' in saved.outfit) {
      state.outfit = { ...DEFAULT_COURIER_OUTFIT, ...saved.outfit };
    }
  }
  if (typeof saved.muted === 'boolean') state.muted = saved.muted;
} catch { /* ignore */ }

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      letterIndex: state.letterIndex,
      letterStates: state.letterStates,
      outfit: state.outfit,
      muted: state.muted,
    }));
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------- world refs
let world = null;
let avatar = null;
let controller = null;
let followCamera = null;
let introPlanet = null;
let introSky = null;
let marker = null;
let beijing = null;
let playerKind = 'original';
const ambientNpcs = [];
const npcByAnchor = new Map();
const npcsByKind = new Map();
const pendingItemObjects = {};
const ITEM_KIND = {
  letterwet: 'letter',
  postcard: 'postcard',
  note: 'note',
  offering: 'offering',
  samplebox: 'samplebox',
  record: 'record',
};
let activeItemMesh = null;

// ---------------------------------------------------------------- outfit catalog
function currentOutfitCatalog() {
  if (playerKind === 'original') {
    const row = (label, latin, table) => ({ label, latin, ids: Object.keys(table) });
    return {
      hat: row('邮差帽', 'HAT', COURIER_OUTFITS.hat),
      bag: row('邮包', 'BAG', COURIER_OUTFITS.bag),
      scarf: row('围巾', 'SCARF', COURIER_OUTFITS.scarf),
    };
  }
  return ui.OUTFIT_CATALOG;
}

// ---------------------------------------------------------------- UI
const ui = createUI({
  root: uiRoot,
  audio,
  touch: 'auto',
  onBegin: () => startGame(),
  onTalk: (npc, talking) => setTalking(npc, talking),
});

function updateUiScale() {
  const s = Math.min(1.34, Math.max(0.52, Math.min(innerWidth / 1440, innerHeight / 900)));
  ui.container.style.setProperty('--s', String(s));
}
updateUiScale();

ui.setPhase('intro');
ui.setSound(state.muted);
ui.setChecklist(story.checklistItems(state.letterStates));
function applyOutfitCatalog() {
  ui.setOutfit(
    currentOutfitCatalog(),
    state.outfit,
    (category, nextId) => {
      state.outfit = { ...state.outfit, [category]: nextId };
      avatar?.setOutfit(state.outfit);
      audio?.playCue?.('customize');
      save();
    },
  );
}
applyOutfitCatalog();

ui.bindInput({
  onMove: (x, y) => { input.joystick.x = x; input.joystick.y = y; },
  onJump: () => { input.jumpRequested = true; },
  onInteract: () => { input.interactRequested = true; },
});

// ---------------------------------------------------------------- talking
function setTalking(npcId, talking) {
  for (const list of npcsByKind.values()) for (const npc of list) npc.setTalking?.(false);
  if (!npcId) return;
  const list = npcsByKind.get(npcId);
  if (list) for (const npc of list) npc.setTalking?.(!!talking);
}

// ---------------------------------------------------------------- resize
function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
  const ratio = renderer.getPixelRatio();
  pipeline.setSize(innerWidth, innerHeight, ratio, RENDER_SCALE);
  env.setSize(innerWidth, innerHeight, ratio);
  updateUiScale();
}
addEventListener('resize', onResize);

// ---------------------------------------------------------------- markers / items
function createMarker() {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#f5d76e';
  ctx.strokeStyle = '#1d1d1b';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(20, 20, 88, 88, 20);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1d1d1b';
  ctx.font = 'bold 64px "Ma Shan Zheng", "Kaiti SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('信', 64, 70);
  const texture = new THREE.CanvasTexture(cv);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tMap: { value: texture },
      uScale: { value: 0.9 },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uScale;
      varying vec2 vUv;
      varying vec2 vZW;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        mv.xy += position.xy * uScale;
        gl_Position = projectionMatrix * mv;
        vZW = gl_Position.zw;
      }
    `,
    fragmentShader: /* glsl */ `
      layout(location = 1) out highp vec4 gInfo;
      uniform sampler2D tMap;
      varying vec2 vUv;
      varying vec2 vZW;
      void main() {
        vec4 c = texture2D(tMap, vUv);
        if (c.a < 0.4) discard;
        gl_FragColor = vec4(c.rgb, 1.0);
        gInfo = vec4(1.0 - (0.5 * vZW[0] / vZW[1] + 0.5), vec2(0.0), 0.0);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.renderOrder = 999;
  mesh.onBeforeRender = () => {
    // keep it facing the camera and bobbing
    mesh.material.uniforms.uTime.value = performance.now() / 1000;
    mesh.scale.setScalar(1);
  };
  return mesh;
}

function positionMarker(target) {
  if (!marker) marker = createMarker();
  if (!target) { marker.visible = false; marker.userData.wanted = false; return; }
  if (!marker.parent) gameScene.add(marker);
  marker.visible = true;
  marker.userData.wanted = true;
  marker.position.copy(target.point).addScaledVector(target.normal, 2.15);
}

function showItem(letter) {
  if (activeItemMesh) {
    activeItemMesh.visible = false;
    activeItemMesh.removeFromParent();
    activeItemMesh = null;
  }
  if (!letter) return;
  const item = pendingItemObjects[letter.id];
  const spot = world?.spots?.[letter.pickupSpot];
  if (!item || !spot) return;
  item.position.copy(spot.point);
  item.userData.normal = spot.normal.clone();
  item.userData.baseRadius = spot.point.length();
  item.rotation.y = 0.6;
  gameScene.add(item);
  activeItemMesh = item;
}

// ---------------------------------------------------------------- quests
function currentLetter() {
  return story.LETTERS[state.letterIndex] || null;
}

function syncChecklist() {
  ui.setChecklist(story.checklistItems(state.letterStates));
}

// The original game has no persistent quest card: we show the objective for a
// few seconds when a delivery stage changes, then let the marker + checklist do
// the navigation (closer to the reference UI).
let objectiveTimer = 0;
function flashObjective(text, kicker) {
  if (!text) { ui.clearObjective(); return; }
  ui.setObjective(text, { kicker });
  window.clearTimeout(objectiveTimer);
  objectiveTimer = window.setTimeout(() => {
    if (state.mode === 'playing') ui.clearObjective();
  }, 7000);
}

function setStage(stage) {
  state.stage = stage;
  const letter = currentLetter();
  if (!letter) return;
  if (stage === 'carry' || stage === 'deliver') state.letterStates[letter.id] = 'carrying';
  if (stage === 'done') state.letterStates[letter.id] = 'done';
  syncChecklist();
  if (stage === 'ask') {
    flashObjective(letter.objective, '今天的投递 · NEXT UP');
    positionMarker(world?.spots?.[letter.giverSpot]);
    showItem(null);
  } else if (stage === 'carry') {
    flashObjective(`捡起${letter.item}`, '捡起 · PICK UP');
    positionMarker(world?.spots?.[letter.pickupSpot]);
    showItem(letter);
  } else if (stage === 'deliver') {
    flashObjective(letter.objective, '送往 · DELIVER');
    positionMarker(world?.spots?.[letter.targetSpot]);
    showItem(null);
  } else if (stage === 'done') {
    ui.clearObjective();
    positionMarker(null);
    showItem(null);
  }
  save();
}

function completeLetter() {
  const letter = currentLetter();
  if (!letter) return;
  state.letterStates[letter.id] = 'done';
  syncChecklist();
  ui.toast(letter.doneToast || `送达 · ${letter.title}`);
  audio?.playCue?.('quest');
  const next = state.letterIndex + 1;
  if (next >= story.LETTERS.length) {
    window.setTimeout(async () => {
      await ui.showDialogue({ lines: story.ENDING_LINES });
      ui.clearObjective();
      ui.toast('五封信都送到了 · 明天见', 4200);
    }, 900);
  } else {
    state.letterIndex = next;
    save();
    window.setTimeout(() => {
      setStage('ask');
      ui.toast(`新的投递 · ${currentLetter().checklistTitle}`, 2400);
      ui.markChecklistNew();
    }, 1100);
  }
}

function npcSpotActor(spotId) {
  const spot = world?.spots?.[spotId];
  if (!spot) return null;
  return npcByAnchor.get(spot.npcId) || null;
}

function firstUnfinishedLetter() {
  for (let i = 0; i < story.LETTERS.length; i += 1) {
    if (state.letterStates[story.LETTERS[i].id] !== 'done') return i;
  }
  return -1;
}

function startLetter() {
  const idx = state.letterStates[currentLetter()?.id] === 'done' ? firstUnfinishedLetter() : state.letterIndex;
  if (idx < 0) return;
  state.letterIndex = idx;
  setStage('ask');
}

async function talkToQuestGiver() {
  const letter = currentLetter();
  const npc = npcSpotActor(letter.giverSpot);
  if (npc) npc.setLookAt(controller.position);
  const lines = story.scriptFor(letter.id, 'ask').map((line) => ({ ...line, npc: letter.giverModel }));
  await ui.showDialogue({ lines, onTalk: (id, talking) => setTalking(id, talking) });
  if (npc) npc.setLookAt(null);
  setStage('carry');
}

function pickupActiveItem() {
  const letter = currentLetter();
  audio?.playCue?.('letter');
  activeItemMesh?.removeFromParent();
  activeItemMesh = null;
  setStage('deliver');
  ui.toast(`拿到${letter.item}`, 1800);
}

async function deliverToTarget() {
  const letter = currentLetter();
  const npc = npcSpotActor(letter.targetSpot);
  if (npc) npc.setLookAt(controller.position);
  const lines = story.scriptFor(letter.id, 'reply').map((line) => ({ ...line, npc: letter.targetModel }));
  await ui.showDialogue({ lines, onTalk: (id, talking) => setTalking(id, talking) });
  if (npc) npc.setLookAt(null);
  completeLetter();
}

let currentInteract = null;
function findInteractable() {
  if (!world || !controller) return null;
  const letter = currentLetter();
  if (!letter) return null;
  const pos = controller.position;
  const distTo = (spotId) => {
    const spot = world.spots[spotId];
    return spot ? pos.distanceTo(spot.point) : Infinity;
  };
  if (state.stage === 'ask') {
    if (distTo(letter.giverSpot) < 3.4) return { label: '交谈', action: talkToQuestGiver };
  } else if (state.stage === 'carry') {
    if (activeItemMesh && pos.distanceTo(activeItemMesh.position) < 3.4) {
      return { label: '捡起', action: pickupActiveItem };
    }
  } else if (state.stage === 'deliver') {
    if (distTo(letter.targetSpot) < 3.4) return { label: '交付', action: deliverToTarget };
  }
  return null;
}

// ---------------------------------------------------------------- intro / start
function rotateIntro(dt) {
  if (!introPlanet) return;
  introPlanet.group.rotation.y += dt * 0.07;
  introPlanet.group.rotation.x = 0.08;
}

async function boot() {
  pipeline.setSize(innerWidth, innerHeight, renderer.getPixelRatio(), RENDER_SCALE);
  env.setSize(innerWidth, innerHeight, renderer.getPixelRatio());

  await Promise.all([materials.ready, env.ready]);
  const lut = await assets.loadLUT();
  if (lut) pipeline.setLUT(lut);
  pipeline.uniforms.uLUTIntensity.value = lut ? 1 : 0;

  introPlanet = await buildIntroPlanet({ assets, env });
  introScene.add(introPlanet.group);
  introSky = env.sky();
  introSky.mesh.scale.setScalar(4);
  introScene.add(introSky.mesh);

  camera.position.set(0.5, 8, 152);
  camera.lookAt(0, 1, 0);

  ui.showIntro();
  ui.intro.setBeginEnabled(true);
  function updateUiScale() {
  const s = Math.min(1.34, Math.max(0.52, Math.min(innerWidth / 1440, innerHeight / 900)));
  ui.container.style.setProperty('--s', String(s));
}
updateUiScale();

ui.setPhase('intro');
  state.mode = 'intro';
  $('#boot')?.classList.add('done');
  requestAnimationFrame(frame);
  window.__courier = debugApi();
}

function headingAlong(point, normal, tangent) {
  const up = normal.clone().normalize();
  const base = new THREE.Vector3(1, 0, 0).addScaledVector(up, -up.x);
  if (base.lengthSq() < 1e-6) base.set(0, 0, 1).addScaledVector(up, -up.z);
  base.normalize();
  const right = new THREE.Vector3().crossVectors(up, base).normalize();
  const dir = tangent.clone().addScaledVector(up, -tangent.dot(up)).normalize();
  return Math.atan2(dir.dot(right), dir.dot(base));
}

/** Add flat walkable quads for the self-built Beijing terraces (main.js cannot
 *  know the merged geometry internals of world/beijing.js, but the district
 *  transform and terrace size are exposed in its districts array). */
function addBeijingWalkable(collision, beijingInstance) {
  let count = 0;
  for (const district of beijingInstance.districts || []) {
    const spec = district.terrace;
    if (!spec || !spec.w || !spec.d) continue;
    const up = new THREE.Vector3(...district.up);
    const right = new THREE.Vector3(...district.right);
    const forward = new THREE.Vector3(...district.forward);
    // sit the walkable plane a few centimetres above the rendered stone
    // terrace so the original terrain can never poke through the collision
    const center = new THREE.Vector3(...district.origin)
      .addScaledVector(right, spec.x || 0)
      .addScaledVector(up, (district.terraceTop || 0) + 0.1)
      .addScaledVector(forward, spec.z || 0);
    const hw = spec.w / 2;
    const hd = spec.d / 2;
    const corners = [
      center.clone().addScaledVector(right, -hw).addScaledVector(forward, -hd),
      center.clone().addScaledVector(right, hw).addScaledVector(forward, -hd),
      center.clone().addScaledVector(right, hw).addScaledVector(forward, hd),
      center.clone().addScaledVector(right, -hw).addScaledVector(forward, hd),
    ];
    const positions = new Float32Array([
      ...corners[0].toArray(), ...corners[1].toArray(), ...corners[2].toArray(),
      ...corners[0].toArray(), ...corners[2].toArray(), ...corners[3].toArray(),
    ]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    count += collision.appendGeometry(geometry);

    // the hutong terrace has two stone steps at its west end (see
    // layoutHutong in world/beijing.js) — add matching walkable quads so the
    // player can walk down to the village instead of falling off the edge
    if (district.id === 'hutong') {
      const top = district.terraceTop || 0;
      for (let i = 0; i < 2; i += 1) {
        const stepX = -6.55 - i * 0.36;
        const stepY = top - (i + 1) * 0.24;
        const centerStep = new THREE.Vector3(...district.origin)
          .addScaledVector(right, stepX)
          .addScaledVector(up, stepY + 0.06)
          .addScaledVector(forward, 0.2);
        const hw = 0.18;
        const hd = 1.5;
        const sc = [
          centerStep.clone().addScaledVector(right, -hw).addScaledVector(forward, -hd),
          centerStep.clone().addScaledVector(right, hw).addScaledVector(forward, -hd),
          centerStep.clone().addScaledVector(right, hw).addScaledVector(forward, hd),
          centerStep.clone().addScaledVector(right, -hw).addScaledVector(forward, hd),
        ];
        const sp = new Float32Array([
          ...sc[0].toArray(), ...sc[1].toArray(), ...sc[2].toArray(),
          ...sc[0].toArray(), ...sc[2].toArray(), ...sc[3].toArray(),
        ]);
        const stepGeometry = new THREE.BufferGeometry();
        stepGeometry.setAttribute('position', new THREE.BufferAttribute(sp, 3));
        collision.appendGeometry(stepGeometry);
      }
    }
  }
  return count;
}

/** Build one BufferGeometry containing boxes for all Beijing wallColliders. */
function beijingColliderGeometry(colliders) {
  const positions = [];
  const v = new THREE.Vector3();
  const corners = (collider) => {
    const obb = collider.obb;
    const center = new THREE.Vector3(...obb.center);
    const axes = obb.axes.map((axis) => new THREE.Vector3(...axis));
    const half = obb.half;
    const out = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const p = center.clone()
            .addScaledVector(axes[0], sx * half[0])
            .addScaledVector(axes[1], sy * half[1])
            .addScaledVector(axes[2], sz * half[2]);
          out.push(p.toArray());
        }
      }
    }
    // index order: (sx,sy,sz) -> ((sx+1)/2)*4 + ((sy+1)/2)*2 + ((sz+1)/2)
    return out;
  };
  // box faces: 6 quads = 12 triangles
  const faces = [
    [0, 1, 3, 2], [4, 6, 7, 5], // x-
    [0, 4, 5, 1], [2, 3, 7, 6], // y-
    [0, 2, 6, 4], [1, 5, 7, 3], // z-
  ];
  for (const collider of colliders) {
    const c = corners(collider);
    for (const [a, b, cc, d] of faces) {
      positions.push(...c[a], ...c[b], ...c[cc]);
      positions.push(...c[a], ...c[cc], ...c[d]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

async function startGame() {
  if (state.mode !== 'intro') return;
  state.mode = 'loading';
  audio.unlock();
  audio.playCue('turn');
  ui.showLoading();
  ui.hideIntro();

  try {
    world = await buildPlanet({ assets, materials, env, scene: gameScene });

    // 自建的北京资产（胡同/中轴/CBD/长城），全部程序化生成
    let cameraColliders = [];
    try {
      const childrenBefore = new Set(world.group.children);
      beijing = buildBeijing({ scene: gameScene, collision: world.collision, spots: world.spots, group: world.group });
      await beijing.ready;
      await beijing.fontsReady;
      cameraColliders = world.group.children.filter((child) => !childrenBefore.has(child));

      // 让玩家能站到自建的台地上：把台面（以及入口踏步）加进地面碰撞
      addBeijingWalkable(world.collision, beijing);

      // spawn on the 春风胡同 street centre, facing the paifang, using the
      // spawn metadata exported by the Beijing asset pack
      if (beijing.spawn) {
        const spawn = beijing.spawn;
        const point = new THREE.Vector3(...spawn.point);
        const normal = new THREE.Vector3(...spawn.normal).normalize();
        world.spawn.point.copy(point).addScaledVector(normal, 0.14);
        world.spawn.normal.copy(normal);
        world.spawn.radius = world.spawn.point.length();
        world.spawn.heading = spawn.heading ?? 0;
        world.spawn.facing = spawn.facing ? new THREE.Vector3(...spawn.facing) : null;
        // scripted opening shot: stand east of the courier and look west along
        // the hutong toward the paifang / grey-tile roofs / lanterns
        const facing = world.spawn.facing || normal.clone();
        world.introCamera = {
          position: point.clone()
            .addScaledVector(facing, -4.4)
            .addScaledVector(normal, 1.55),
          target: point.clone()
            .addScaledVector(facing, 2.2)
            .addScaledVector(normal, 1.05),
          up: normal.clone(),
        };
      }
    } catch (err) {
      console.warn('[beijing] failed to build own district', err);
    }

    // 主角：优先使用完全自建的原创北京邮差；参考站角色仅作失败回退
    try {
      avatar = createOriginalCourier({ outfit: state.outfit });
      await avatar.ready;
      playerKind = 'original';
      applyOutfitCatalog();
    } catch (err) {
      console.warn('[hero] original courier failed, falling back to reference avatar', err);
      avatar = createAvatar({ assets, materials, outfit: state.outfit });
      await avatar.ready;
      playerKind = 'messenger';
      state.outfit = { ...DEFAULT_OUTFIT };
      applyOutfitCatalog();
    }
    gameScene.add(avatar.root);
    avatar.play('idle');

    const spawn = world.spawn;
    // camera-only collision: the original ground plus OBB boxes around the
    // self-built Beijing buildings (not every prop mesh: lanterns/trees would
    // otherwise squeeze the camera for no reason)
    let cameraCollision = world.collision;
    if (beijing?.wallColliders?.length) {
      cameraCollision = world.collision.clone();
      cameraCollision.appendGeometry(beijingColliderGeometry(beijing.wallColliders));
    }
    controller = new PlayerController({
      collision: world.collision,
      spawn: { point: spawn.point, normal: spawn.normal, radius: spawn.radius, heading: spawn.heading },
      scene: gameScene,
      avatar,
    });
    if (beijing?.wallColliders?.length) controller.setColliders(beijing.wallColliders);
    followCamera = new FollowCamera({ camera, controller, collision: cameraCollision });

    await Promise.all([
      spawnNPCs(),
      spawnAmbientNpcs(),
      ...story.LETTERS.map(async (letter) => {
        const base = letter.itemModel.split('/').pop().replace('.drc', '');
        pendingItemObjects[letter.id] = createDeliveryItem(ITEM_KIND[base] || 'letter');
      }),
    ]);

    ui.hideLoading();
    ui.setPhase('game');
    state.mode = 'playing';

    const introLines = story.INTRO_LINES.map((line) => ({ ...line, npc: 'avatar' }));
    if (world.introCamera) {
      cinematic = world.introCamera;
      camera.position.copy(cinematic.position);
      camera.up.copy(cinematic.up);
      camera.lookAt(cinematic.target);
    }
    window.setTimeout(async () => {
      await ui.showDialogue({ lines: introLines });
      // hand the camera back to the follow rig from the cinematic position
      if (cinematic && followCamera) {
        followCamera.currentPos.copy(camera.position);
        followCamera.currentTarget.copy(cinematic.target);
        followCamera.collisionDist = camera.position.distanceTo(cinematic.target);
      }
      cinematic = null;
      startLetter();
    }, 500);
  } catch (err) {
    console.error(err);
    ui.hideLoading();
    ui.showIntro();
    ui.intro.setBeginEnabled(true);
    state.mode = 'intro';
    ui.toast('加载失败：' + (err?.message || err));
  }
}

async function spawnNPCs() {
  await Promise.all(world.npcAnchors.map(async (anchor) => {
    try {
      const npc = createNPC({ assets, materials, type: anchor.kind });
      await npc.ready;
      placeActor(npc.root, anchor.point, anchor.normal, anchor.facing);
      gameScene.add(npc.root);
      npcByAnchor.set(anchor.id, npc);
      if (!npcsByKind.has(anchor.kind)) npcsByKind.set(anchor.kind, []);
      npcsByKind.get(anchor.kind).push(npc);
    } catch (err) {
      console.warn('[npc] failed', anchor.kind, err);
    }
  }));
}

async function spawnAmbientNpcs() {
  if (!beijing) return;
  // the Beijing pack exports hand-placed NPC spots (flat ground, clear of
  // props, designed facing) — use them instead of guessing tangent offsets
  const specs = [
    { id: 'npc-hutong-daye', type: 'beijing-daye' },
    { id: 'npc-hutong-dama', type: 'beijing-dama' },
    { id: 'npc-hutong-xuesheng', type: 'xiaoxuesheng' },
    { id: 'npc-axis-daye', type: 'beijing-daye' },
  ];
  const spots = beijing.npcSpots || [];
  for (const spec of specs) {
    const spot = spots.find((entry) => entry.id === spec.id);
    if (!spot) continue;
    try {
      const up = new THREE.Vector3(...spot.normal).normalize();
      const point = new THREE.Vector3(...spot.point);
      const facing = spot.facing ? new THREE.Vector3(...spot.facing) : new THREE.Vector3(1, 0, 0);
      facing.addScaledVector(up, -facing.dot(up));
      if (facing.lengthSq() < 1e-5) facing.set(1, 0, 0).addScaledVector(up, -up.x);
      facing.normalize();
      const npc = createOriginalNPC({ type: spec.type });
      await npc.ready;
      placeActor(npc.root, point.clone().addScaledVector(up, 0.02), up, facing);
      gameScene.add(npc.root);
      ambientNpcs.push(npc);
    } catch (err) {
      console.warn('[ambient npc] failed', spec.type, err);
    }
  }
}

function placeActor(root, point, normal, facing) {
  const up = normal.clone().normalize();
  let forward = facing ? facing.clone() : new THREE.Vector3(1, 0, 0);
  forward.addScaledVector(up, -forward.dot(up));
  if (forward.lengthSq() < 1e-5) forward.set(1, 0, 0).addScaledVector(up, -up.x);
  forward.normalize();
  const right = new THREE.Vector3().crossVectors(up, forward).normalize();
  const basis = new THREE.Matrix4().makeBasis(right, up, forward);
  root.position.copy(point);
  root.quaternion.setFromRotationMatrix(basis);
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let elapsed = 0;
let footstepAccum = 0;
let wasGrounded = true;
let lastRegion = null;
let cinematic = null; // { position, target } for the opening shot
let locomotion = 'idle';
let locomotionCandidate = 'idle';
let locomotionCandidateTime = 0;

function updateLocomotion() {
  let next;
  if (!controller.grounded) next = 'air';
  else if (controller.speed > (locomotion === 'sprint' ? 4.0 : 4.35)) next = 'sprint';
  else if (controller.speed > (locomotion === 'run' ? 0.22 : 0.55)) next = 'run';
  else next = 'idle';
  if (next === locomotion) {
    locomotionCandidate = next;
    locomotionCandidateTime = 0;
    return;
  }
  // require the new state to hold for a couple frames before switching
  if (next !== locomotionCandidate) {
    locomotionCandidate = next;
    locomotionCandidateTime = 0;
    return;
  }
  locomotionCandidateTime += 1;
  if (locomotionCandidateTime >= 2) {
    locomotion = next;
    avatar.play(next);
  }
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  if (state.mode === 'intro' || state.mode === 'loading') {
    rotateIntro(dt);
    materials.update(elapsed);
    env.update(elapsed, {});
    ui.update(dt);
    pipeline.render(introScene, camera);
    requestAnimationFrame(frame);
    return;
  }

  if (state.mode === 'playing') {
    updateGame(dt);
    requestAnimationFrame(frame);
  }
}

function updateGame(dt) {
  if (debug.freezeFrame) {
    pipeline.render(gameScene, camera);
    return;
  }
  const blocked = ui.dialogueActive || ui.isChecklistOpen() || ui.isOutfitOpen();

  if (blocked) {
    input.keys.clear();
    input.joystick.x = 0;
    input.joystick.y = 0;
    input.jumpRequested = false;
  }

  followCamera.setFocus(ui.dialogueActive);
  const camForward = followCamera ? followCamera.getForward() : new THREE.Vector3(0, 0, 1);
  controller.update(dt, blocked ? { keys: new Set(), joystick: { x: 0, y: 0 } } : input, camForward);
  if (debug.freeCamera) {
    camera.position.copy(debug.freeCamera.position);
    camera.up.copy(controller.normal);
    if (debug.freeCamera.fov && camera.fov !== debug.freeCamera.fov) {
      camera.fov = debug.freeCamera.fov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(debug.freeCamera.target);
  } else if (cinematic) {
    // scripted opening camera (still gets the LUT/outline pipeline)
    camera.position.lerp(cinematic.position, 1 - Math.exp(-6 * dt));
    camera.up.copy(cinematic.up);
    camera.lookAt(cinematic.target);
  } else {
    followCamera.update(dt, blocked ? { drag: false, wheel: 0 } : input);
  }

  // avatar locomotion with hysteresis (prevents idle/run flicker when the
  // damped speed sits exactly on the threshold)
  updateLocomotion();
  avatar.update(dt);

  for (const npc of npcByAnchor.values()) npc.update?.(dt);
  for (const npc of ambientNpcs) npc.update?.(dt);

  beijing?.update?.(elapsed, dt);
  world.update(elapsed, dt, controller);
  materials.update(elapsed);

  gameSun.position.copy(controller.position).addScaledVector(sunDir, 100);
  gameSun.target.position.copy(controller.position);
  gameSun.target.updateMatrixWorld();

  if (activeItemMesh) {
    const n = activeItemMesh.userData.normal || controller.normal;
    const base = activeItemMesh.userData.baseRadius;
    activeItemMesh.rotation.y += dt * 1.6;
    activeItemMesh.position.copy(n).multiplyScalar(base + Math.sin(elapsed * 2.4) * 0.06);
  }

  if (controller.grounded && controller.speed > 0.4) {
    footstepAccum += controller.speed * dt;
    if (footstepAccum > 1.65) {
      footstepAccum = 0;
      audio.playFootstep({ run: controller.speed > 4.1 });
    }
  } else {
    footstepAccum = 0;
  }
  if (!wasGrounded && controller.grounded) audio.playLand();
  wasGrounded = controller.grounded;

  // hide the floating letter marker while a dialogue / overlay is open
  if (marker) marker.visible = !blocked && marker.userData.wanted === true;

  // interaction prompt
  if (!blocked) {
    const next = findInteractable();
    if (next !== currentInteract) {
      currentInteract = next;
      if (next) ui.showInteract(next.label, () => next.action());
      else ui.hideInteract();
    }
  } else if (currentInteract) {
    currentInteract = null;
    ui.hideInteract();
  }

  updateRegion();
  ui.update(dt);

  pipeline.render(gameScene, camera);
}

function updateRegion() {
  let best = null;
  let bestDist = Infinity;
  for (const r of world.regions) {
    const d = controller.position.distanceTo(r.point);
    if (d < bestDist) { bestDist = d; best = r; }
  }
  if (!best || bestDist > 12 || lastRegion === best.id) return;
  lastRegion = best.id;
  ui.setRegion(REGION_TO_STORY[best.id] || 'village');
}

// ---------------------------------------------------------------- debug hooks
function debugApi() {
  return {
    THREE,
    debug,
    state,
    ui,
    audio,
    camera,
    renderer,
    pipeline,
    materials,
    env,
    assets,
    get world() { return world; },
    get avatar() { return avatar; },
    get controller() { return controller; },
    get followCamera() { return followCamera; },
    get npcByAnchor() { return npcByAnchor; },
    get beijing() { return beijing; },
    get ambientNpcs() { return ambientNpcs; },
    get scene() { return gameScene; },
    startGame,
    startLetter,
    setStage,
    teleport(normalArray, heading = 0) {
      if (!controller) return;
      const n = new THREE.Vector3(...normalArray).normalize();
      const ground = world.collision.groundAtDirection(n);
      controller.position.copy(ground ? ground.point : n.clone().multiplyScalar(27));
      controller.normal.copy(n);
      controller.heading = heading;
      followCamera.yaw = heading;
      followCamera.currentPos.copy(controller.position).addScaledVector(n, 3);
    },
    setFreeCamera(position, target, fov) {
      debug.freeCamera = {
        position: new THREE.Vector3(...position),
        target: new THREE.Vector3(...target),
        fov,
      };
    },
    clearFreeCamera() {
      debug.freeCamera = null;
      camera.fov = 50;
      camera.updateProjectionMatrix();
    },
    beijingViews() {
      if (!beijing) return [];
      const out = [];
      for (const district of beijing.districts) {
        const origin = new THREE.Vector3(...district.origin);
        const up = new THREE.Vector3(...district.up);
        const right = new THREE.Vector3(...district.right);
        const forward = new THREE.Vector3(...district.forward);
        const toWorld = (value) => origin.clone()
          .addScaledVector(up, value[1])
          .addScaledVector(right, value[0])
          .addScaledVector(forward, value[2]);
        const top = district.terraceTop || 0;
        for (const view of district.views || []) {
          const local = (value) => toWorld([value[0], value[1] + top, value[2]]);
          out.push({
            district: district.id,
            id: view.id,
            title: view.title,
            position: local(view.position).toArray(),
            target: local(view.target).toArray(),
            fov: view.fov,
          });
        }
      }
      return out;
    },
    placeAtSpot(spotId, approach = 1.8) {
      const spot = world?.spots?.[spotId];
      if (!spot || !controller) return;
      // stand a few steps away from the NPC / pickup point, facing it
      const toPlayer = spot.facing ? spot.facing.clone().negate() : new THREE.Vector3(1, 0, 0);
      toPlayer.addScaledVector(spot.normal, -toPlayer.dot(spot.normal));
      if (toPlayer.lengthSq() < 1e-5) toPlayer.set(1, 0, 0);
      toPlayer.normalize();
      const dir = spot.normal.clone().addScaledVector(toPlayer, approach / 27).normalize();
      const ground = world.collision.groundAtDirection(dir);
      const point = ground ? ground.point : dir.clone().multiplyScalar(27);
      controller.position.copy(point);
      controller.normal.copy(spot.normal);
      // face the spot
      const base = new THREE.Vector3(1, 0, 0).addScaledVector(spot.normal, -spot.normal.x);
      if (base.lengthSq() < 1e-5) base.set(0, 0, 1).addScaledVector(spot.normal, -spot.normal.z);
      base.normalize();
      const right = new THREE.Vector3().crossVectors(spot.normal, base).normalize();
      const face = spot.point.clone().sub(point);
      face.addScaledVector(spot.normal, -face.dot(spot.normal)).normalize();
      controller.heading = Math.atan2(face.dot(right), face.dot(base));
      followCamera.yaw = controller.heading;
      followCamera.currentPos.copy(controller.position).addScaledVector(spot.normal, 3);
      followCamera.setFocus(false);
    },
    renderOnce() {
      if (state.mode === 'playing') updateGame(0.016);
      else pipeline.render(introScene, camera);
    },
    debugInteract() {
      const next = findInteractable();
      return {
        stage: state.stage,
        activeItem: !!activeItemMesh,
        distance: activeItemMesh ? controller.position.distanceTo(activeItemMesh.position) : null,
        next: next ? next.label : null,
        blocked: ui.dialogueActive || ui.isChecklistOpen() || ui.isOutfitOpen(),
        current: currentInteract ? currentInteract.label : null,
      };
    },
  };
}

boot().catch((err) => {
  console.error(err);
  const fatal = $('#fatal');
  fatal.hidden = false;
  fatal.textContent = '三维场景加载失败：' + (err?.message || err);
});
