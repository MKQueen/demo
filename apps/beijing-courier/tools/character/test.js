// Character harness page. Renders the avatar/NPC modules in isolation so the
// skeleton, animation, outfit and facing work can be verified without the game
// loop, and produces the screenshots in screenshots/character/.
//
// Query parameters:
//   mode   = lineup | single | catalog | npc | npcs | compare   (default: lineup)
//   render = auto | basic | pipeline                          (default: auto)
//   pose   = idle | run | sprint | air | afk1..3              (single mode)
//   time   = clip time in seconds, default 0.4                (single mode)
//   view   = front | side | back | head                       (single mode)
//   outfit = hair3,top2,bottom4,shoes5                        (single/catalog base)
//   base   = same format, base outfit for catalog mode
//   type   = chef | oldwoman | ...                            (npc mode)
//   talk   = 1                                                (npc mode)
//
// window.__app exposes the actors + helpers used by tools/character/shots.mjs.
import * as THREE from 'three';
import { createAssets } from '/src/assets.js';
import { createAvatar, ACCESSORIES, DEFAULT_OUTFIT } from '/src/actor/avatar.js';
import { createNPC } from '/src/actor/npc.js';
import referenceUrl from '../../docs/messenger-reference/12-game.png';

const params = new URLSearchParams(location.search);
const MODE = params.get('mode') || 'lineup';
const RENDER = params.get('render') || 'auto';
const BG = new THREE.Color('#a7dcd4');

/** NPC types used by the game world (see the original createNPCS() data). */
const WORLD_NPC_TYPES = [
  'chef', 'oldwoman', 'musician', 'office-worker', 'young-lady',
  'scout', 'mountainman', 'diver', 'fox',
];

const canvas = document.getElementById('view');
const statusEl = document.getElementById('status');
const subtitleEl = document.getElementById('subtitle');
const overlay = document.getElementById('overlay');
const gridWrap = document.getElementById('grid');
const gridCanvas = document.getElementById('grid-canvas');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const assets = createAssets(renderer);

const scene = new THREE.Scene();
scene.background = BG.clone();
const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.05, 80);

const hemi = new THREE.HemisphereLight('#e7f6ff', '#6d8a64', 1.25);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff4e2', 3);
sun.position.set(4.5, 7.5, 5.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -6;
sun.shadow.camera.right = 6;
sun.shadow.camera.top = 6;
sun.shadow.camera.bottom = -6;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 30;
sun.shadow.normalBias = 0.02;
sun.shadow.bias = -0.0005;
scene.add(sun);

let ground = null;
function addGround() {
  if (ground) return;
  ground = new THREE.Mesh(
    new THREE.CircleGeometry(9, 64),
    new THREE.MeshLambertMaterial({ color: '#8cbf83' }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.05, 1.12, 48),
    new THREE.MeshBasicMaterial({ color: '#6f9a6a', side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  scene.add(ring);
}

let materialsLayer = null;
let pipeline = null;
let renderMode = 'basic';

async function setupRender() {
  addGround();
  if (RENDER === 'basic') return 'basic';
  try {
    const [{ createMaterials }, { createPipeline }] = await Promise.all([
      import('/src/render/materials.js'),
      import('/src/render/pipeline.js'),
    ]);
    const mats = createMaterials({ assets });
    await mats.ready();
    const pipe = createPipeline(renderer);
    const lut = await assets.loadLUT();
    if (lut) pipe.setLUT(lut);
    pipe.setSize(window.innerWidth, window.innerHeight, renderer.getPixelRatio());
    materialsLayer = mats;
    pipeline = pipe;
    // The ported shader expects the game's sun-only lighting; the ground mesh
    // cannot feed the MRT info buffer, so it is hidden for the outline pass.
    renderer.shadowMap.enabled = false;
    sun.castShadow = false;
    // Match the reference screenshot's key light: sun from the character's
    // front-left, no strong ambient (the shader does its own hard-cut shading).
    sun.position.set(-5, 7.5, 6);
    hemi.intensity = 0.15;
    if (ground) ground.visible = false;
    return 'pipeline';
  } catch (error) {
    console.warn('[character-test] pipeline unavailable, using basic renderer:', error);
    return 'basic';
  }
}

function actorMaterials() {
  return materialsLayer;
}

const avatars = [];
const npcs = [];
const labels = [];

function addLabel(text, worldPos) {
  const el = document.createElement('div');
  el.className = 'label';
  el.textContent = text;
  overlay.appendChild(el);
  labels.push({ el, world: worldPos.clone() });
  return el;
}

/** DOM dot pinned to a world position (built-in 3D materials are not visible
 * through the MRT pipeline, so debug markers are drawn in the DOM instead). */
function addDot(worldPos, text = 'look target') {
  const dot = document.createElement('div');
  dot.className = 'dot';
  overlay.appendChild(dot);
  labels.push({ el: dot, world: worldPos.clone() });
  const caption = document.createElement('div');
  caption.className = 'dot-label';
  caption.textContent = text;
  overlay.appendChild(caption);
  labels.push({ el: caption, world: worldPos.clone(), offsetY: 16 });
  return dot;
}

function projectLabels() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  for (const entry of labels) {
    const { el, world } = entry;
    const p = world.clone().project(camera);
    if (p.z > 1) {
      el.style.display = 'none';
      continue;
    }
    el.style.display = '';
    el.style.left = `${((p.x * 0.5 + 0.5) * width).toFixed(1)}px`;
    el.style.top = `${((-p.y * 0.5 + 0.5) * height + 10 + (entry.offsetY || 0)).toFixed(1)}px`;
  }
}

function setCamera(view) {
  switch (view) {
    case 'side':
      camera.position.set(2.9, 1.0, 0.35);
      camera.lookAt(0, 0.88, 0);
      break;
    case 'back':
      camera.position.set(0, 1.05, -3.2);
      camera.lookAt(0, 0.9, 0);
      break;
    case 'head':
      camera.position.set(0, 1.45, 0.95);
      camera.lookAt(0, 1.44, 0);
      break;
    case 'front':
    case 'single':
      camera.position.set(0, 0.95, 3.25);
      camera.lookAt(0, 0.9, 0);
      break;
    default:
      camera.position.set(0, 1.32, 6.3);
      camera.lookAt(0, 0.9, 0);
  }
  camera.updateProjectionMatrix();
}

function parseOutfit(text, fallback = DEFAULT_OUTFIT) {
  const outfit = { ...fallback };
  if (!text) return outfit;
  for (const part of text.split(',')) {
    const piece = part.trim();
    for (const slot of Object.keys(ACCESSORIES)) {
      if (ACCESSORIES[slot].includes(piece)) outfit[slot] = piece;
    }
  }
  return outfit;
}

function outfitLabel(outfit) {
  return Object.values(outfit).filter(Boolean).join(' / ');
}

/** Freeze an avatar on a deterministic clip time (seconds). */
function poseAvatar(avatar, name, time = 0.4) {
  avatar.play(name, 0);
  avatar.mixer.setTime(time);
  avatar.update(0);
}

async function createLineup() {
  const setups = [
    { pose: 'idle', time: 0.4, outfit: { hair: 'hair3', top: 'top2', bottom: 'bottom4', shoes: 'shoes5' }, x: -2.75, label: 'idle · default' },
    { pose: 'run', time: 0.24, outfit: { hair: 'hair6', top: 'top2', bottom: 'bottom3', shoes: 'shoes2' }, x: -0.92, label: 'run · hoodie+boots' },
    { pose: 'air', time: 0.5, outfit: { hair: 'hair1', top: 'top9', bottom: 'bottom6', shoes: 'shoes6' }, x: 0.92, label: 'air · tee+shorts' },
    { pose: 'sprint', time: 0.2, outfit: { hair: 'hair4', top: 'top6', bottom: 'bottom2', shoes: 'shoes1' }, x: 2.75, label: 'sprint · shirt+skirt' },
  ];
  for (const setup of setups) {
    const avatar = createAvatar({ assets, materials: actorMaterials(), outfit: setup.outfit });
    avatar.root.position.x = setup.x;
    scene.add(avatar.root);
    await avatar.ready;
    poseAvatar(avatar, setup.pose, setup.time);
    avatars.push(avatar);
    addLabel(setup.label, new THREE.Vector3(setup.x, 2.05, 0));
  }
  setCamera('lineup');
}

async function createSingle() {
  const outfit = parseOutfit(params.get('outfit'));
  const pose = params.get('pose') || 'idle';
  const time = Number(params.get('time') || 0.45);
  const avatar = createAvatar({ assets, materials: actorMaterials(), outfit });
  scene.add(avatar.root);
  await avatar.ready;
  poseAvatar(avatar, pose, time);
  avatars.push(avatar);
  addLabel(`${pose} · ${outfitLabel(avatar.outfit)}`, new THREE.Vector3(0, 2.02, 0));
  setCamera(params.get('view') || 'front');
  subtitleEl.textContent = `${pose} · ${outfitLabel(outfit)}`;
}

async function createNpc() {
  const type = params.get('type') || 'chef';
  const talking = params.get('talk') === '1';
  const npc = createNPC({ assets, materials: actorMaterials(), type });
  scene.add(npc.root);
  await npc.ready;
  const target = new THREE.Vector3(0.85, 0.95, 1.15);
  npc.setLookAt(target);
  npc.setTalking(talking);
  npc.mixer.setTime(0.6);
  for (let i = 0; i < 90; i++) npc.update(1 / 60);
  npcs.push(npc);
  addLabel(`${npc.npcType} · ${talking ? 'talk' : 'idle'}`, new THREE.Vector3(0, Math.max(2.1, npc.height + 0.3), 0));
  addDot(target, 'look target');
  camera.position.set(0.15, 1.25, 4.2);
  camera.lookAt(0, 0.95, 0);
  camera.updateProjectionMatrix();
  subtitleEl.textContent = `npc · ${npc.npcType} · ${talking ? 'talking' : 'idle'}`;
}

/** All NPC types used by the world, side by side (facing the camera). */
async function createNpcRow() {
  const spacing = 1.35;
  const offset = ((WORLD_NPC_TYPES.length - 1) * spacing) / 2;
  for (let i = 0; i < WORLD_NPC_TYPES.length; i++) {
    const type = WORLD_NPC_TYPES[i];
    const npc = createNPC({ assets, materials: actorMaterials(), type });
    npc.root.position.x = i * spacing - offset;
    scene.add(npc.root);
    await npc.ready;
    npc.mixer.setTime(0.6);
    npc.update(0);
    npcs.push(npc);
    addLabel(type, new THREE.Vector3(npc.root.position.x, Math.max(2.15, npc.height + 0.2), 0));
  }
  camera.position.set(0, 2.0, 14.5);
  camera.lookAt(0, 1.02, 0);
  camera.updateProjectionMatrix();
  subtitleEl.textContent = `world npcs · ${WORLD_NPC_TYPES.length} types`;
}

const CATALOG_BASE = parseOutfit(params.get('base'));
const CATALOG_ROWS = ['hair', 'top', 'bottom', 'shoes'].map((slot) => ({ slot }));

/** Render every accessory variant as a contact sheet (used to pick the default look). */
async function createCatalog() {
  const avatar = createAvatar({ assets, materials: actorMaterials(), outfit: CATALOG_BASE });
  scene.add(avatar.root);
  await avatar.ready;
  avatars.push(avatar);
  addGround();
  setCamera('front');

  const cellWidth = 168;
  const cellHeight = 224;
  const labelHeight = 26;
  const pad = 6;
  const maxColumns = Math.max(...CATALOG_ROWS.map((row) => ACCESSORIES[row.slot].length));
  gridCanvas.width = maxColumns * (cellWidth + pad) + pad;
  gridCanvas.height = CATALOG_ROWS.length * (cellHeight + labelHeight + pad) + pad;
  const ctx = gridCanvas.getContext('2d');
  ctx.fillStyle = '#a7dcd4';
  ctx.fillRect(0, 0, gridCanvas.width, gridCanvas.height);

  const previousSize = new THREE.Vector2();
  renderer.getSize(previousSize);
  const previousRatio = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(cellWidth, cellHeight);
  camera.aspect = cellWidth / cellHeight;
  camera.position.set(0, 0.95, 3.05);
  camera.lookAt(0, 0.92, 0);
  camera.updateProjectionMatrix();

  CATALOG_ROWS.forEach((row, rowIndex) => {
    ACCESSORIES[row.slot].forEach((variant, columnIndex) => {
      avatar.setOutfit({ ...CATALOG_BASE, [row.slot]: variant });
      poseAvatar(avatar, 'idle', 0.4);
      renderer.setRenderTarget(null);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      const x = pad + columnIndex * (cellWidth + pad);
      const y = pad + rowIndex * (cellHeight + labelHeight + pad);
      ctx.drawImage(renderer.domElement, x, y, cellWidth, cellHeight);
      ctx.fillStyle = '#123a37';
      ctx.font = 'bold 14px Menlo, monospace';
      ctx.fillText(variant, x + 4, y + cellHeight + 17);
    });
  });

  avatar.setOutfit(CATALOG_BASE);
  renderer.setPixelRatio(previousRatio);
  renderer.setSize(previousSize.x, previousSize.y);
  canvas.style.display = 'none';
  gridWrap.style.display = 'block';
  overlay.style.display = 'none';
  subtitleEl.textContent = `catalog · base ${outfitLabel(CATALOG_BASE)}`;
  window.__catalog = { width: gridCanvas.width, height: gridCanvas.height };
}

/**
 * Side-by-side "reference vs our render" sheet: crops the original game
 * screenshot next to a pipeline render of the same character at a similar framing.
 */
async function createCompare() {
  const avatar = createAvatar({ assets, materials: actorMaterials(), outfit: DEFAULT_OUTFIT });
  scene.add(avatar.root);
  await avatar.ready;
  poseAvatar(avatar, 'idle', 0.4);
  avatars.push(avatar);
  setCamera('front');

  const width = 1280;
  const height = 720;
  const half = width / 2;
  gridCanvas.width = width;
  gridCanvas.height = height;
  const ctx = gridCanvas.getContext('2d');
  ctx.fillStyle = '#a7dcd4';
  ctx.fillRect(0, 0, width, height);

  // left: crop of the original screenshot around the player character
  const reference = new Image();
  await new Promise((resolve, reject) => {
    reference.onload = resolve;
    reference.onerror = reject;
    reference.src = referenceUrl;
  });
  ctx.drawImage(reference, 560, 180, 340, 720, 0, 0, half, height);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(12, 12, 250, 30);
  ctx.fillStyle = '#123a37';
  ctx.font = 'bold 18px Menlo, monospace';
  ctx.fillText('messenger.abeto.co (reference)', 22, 33);

  // right: our character rendered with the ported pipeline + shader
  const previousSize = new THREE.Vector2();
  renderer.getSize(previousSize);
  const previousRatio = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(half, height);
  camera.aspect = half / height;
  camera.position.set(0, 0.92, 2.72);
  camera.lookAt(0, 0.86, 0);
  camera.updateProjectionMatrix();
  if (pipeline) pipeline.setSize(half, height, 1);
  renderer.setRenderTarget(null);
  renderer.clear(true, true, true);
  if (pipeline) pipeline.render(scene, camera);
  else renderer.render(scene, camera);
  ctx.drawImage(renderer.domElement, half, 0, half, height);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(half + 12, 12, 230, 30);
  ctx.fillStyle = '#123a37';
  ctx.font = 'bold 18px Menlo, monospace';
  ctx.fillText('our port (' + renderMode + ')', half + 22, 33);

  renderer.setPixelRatio(previousRatio);
  renderer.setSize(previousSize.x, previousSize.y);
  canvas.style.display = 'none';
  gridWrap.style.display = 'block';
  overlay.style.display = 'none';
  subtitleEl.textContent = 'compare';
  window.__catalog = { width, height };
}

let frozen = false;
let last = performance.now();

function draw() {
  if (pipeline) pipeline.render(scene, camera);
  else renderer.render(scene, camera);
  projectLabels();
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (!frozen) {
    for (const avatar of avatars) avatar.update(dt);
    for (const npc of npcs) npc.update(dt);
  }
  draw();
  requestAnimationFrame(frame);
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  if (pipeline) pipeline.setSize(width, height, renderer.getPixelRatio());
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

function setStatus(text) {
  statusEl.textContent = text;
}

async function boot() {
  try {
    renderMode = await setupRender();
    setStatus(`mode: ${MODE}\nrender: ${renderMode}`);
    if (MODE === 'lineup') await createLineup();
    else if (MODE === 'catalog') await createCatalog();
    else if (MODE === 'npc') await createNpc();
    else if (MODE === 'npcs') await createNpcRow();
    else if (MODE === 'compare') await createCompare();
    else await createSingle();

    onResize();
    draw();
    requestAnimationFrame(frame);
    window.__app = {
      mode: MODE,
      renderMode,
      avatars,
      npcs,
      camera,
      scene,
      renderer,
      pipeline,
      materials: materialsLayer,
      assets,
      THREE,
      WORLD_NPC_TYPES,
      freeze(value = true) {
        frozen = Boolean(value);
        last = performance.now();
      },
      renderOnce: draw,
      setCamera(view) {
        setCamera(view);
        draw();
      },
      pose(index, name, time = 0.4) {
        poseAvatar(avatars[index], name, time);
        draw();
      },
      setOutfit(index, outfit) {
        avatars[index].setOutfit(outfit);
        poseAvatar(avatars[index], avatars[index].pose || 'idle', 0.4);
        draw();
      },
      play(index, name) {
        avatars[index].play(name);
        draw();
      },
      setTalking(index, value) {
        npcs[index].setTalking(value);
        npcs[index].update(0);
        draw();
      },
      setLookAt(index, x, y, z) {
        npcs[index].setLookAt(new THREE.Vector3(x, y, z));
        for (let i = 0; i < 90; i++) npcs[index].update(1 / 60);
        draw();
      },
      info() {
        const box = new THREE.Box3();
        return {
          renderMode,
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          avatars: avatars.map((avatar) => {
            box.setFromObject(avatar.root);
            return {
              pose: avatar.pose,
              clips: avatar.clips,
              outfit: avatar.outfit,
              height: +(box.max.y - box.min.y).toFixed(3),
              materials: avatar.material ? avatar.material.name || avatar.material.type : null,
              skinned: Boolean(avatar.mesh && avatar.mesh.isSkinnedMesh),
            };
          }),
          npcs: npcs.map((npc) => ({
            type: npc.npcType,
            pose: npc.pose,
            poses: npc.availablePoses,
            talking: npc.talking,
            height: +npc.height.toFixed(3),
            yaw: +npc.yaw.toFixed(4),
            targetYaw: +npc.targetYaw.toFixed(4),
          })),
        };
      },
    };
    window.__ready = true;
  } catch (error) {
    console.error('[character-test] boot failed', error);
    setStatus(`ERROR: ${error && error.stack ? error.stack : error}`);
    window.__error = String((error && error.stack) || error);
  }
}

boot();
