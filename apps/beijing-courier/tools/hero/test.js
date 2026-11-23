// 原创资产验收台：
//   - 渲染我们自己用 Three.js 几何搭的北京邮差 + 北京 NPC
//   - 走真实 MRT pipeline（描边 + LUT），和游戏内一致
//   - 可选并排对比参考站 avatar（只做“同框对比”，原创角色本身不加载任何参考模型）
//
// 查询参数：
//   mode  = single | lineup | back | head | outfits | npcs | npc | compare | scene
//   pose  = idle | run | sprint | air | talk
//   time  = 秒（默认按姿态给一个好看的时间点）
//   view  = front | back | side | head | tq      （single 模式）
//   type  = beijing-daye | beijing-dama | xiaoxuesheng （npc 模式）
//   render= auto | basic | pipeline
//
// window.__app 暴露 actors / helpers，供 tools/hero/shots.mjs 截图使用。
import * as THREE from 'three';
import { createAssets } from '/src/assets.js';
import { createOriginalCourier, COURIER_OUTFITS } from '/src/actor/originalCourier.js';
import { createOriginalNPC, ORIGINAL_NPC_TYPES } from '/src/actor/originalNpc.js';

const params = new URLSearchParams(location.search);
const MODE = params.get('mode') || 'single';
const RENDER = params.get('render') || 'auto';
const BG = new THREE.Color('#a7dcd4');

const canvas = document.getElementById('view');
const statusEl = document.getElementById('status');
const subtitleEl = document.getElementById('subtitle');
const overlay = document.getElementById('overlay');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = BG.clone();
const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.05, 120);
camera.position.set(0, 0.95, 3.3);
camera.lookAt(0, 0.9, 0);

const sun = new THREE.DirectionalLight('#fff4e2', 3);
sun.position.set(-4.6, 7.5, 5.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -7;
sun.shadow.camera.right = 7;
sun.shadow.camera.top = 7;
sun.shadow.camera.bottom = -7;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 40;
sun.shadow.normalBias = 0.03;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(new THREE.HemisphereLight('#e7f6ff', '#6d8a64', 0.3));

const assets = createAssets(renderer);
let pipeline = null;
let materialsLayer = null;
let renderMode = 'basic';
let ground = null;

function addGround(color = '#c9bda1') {
  if (ground) return;
  // 地面也用 toon 材质，才能被 MRT 描边 / LUT 一起处理
  const { createToonMaterialSafe } = window.__kit;
  const material = createToonMaterialSafe({ color, flatShading: false, surfaceId: 0.6 });
  ground = new THREE.Mesh(new THREE.CircleGeometry(9, 48), material);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'harness-ground';
  scene.add(ground);
}

async function setupRender() {
  const kit = await import('/src/actor/originalCourier.js');
  window.__kit = kit;
  if (RENDER === 'basic') return 'basic';
  try {
    const [{ createMaterials }, { createPipeline }] = await Promise.all([
      import('/src/render/materials.js'),
      import('/src/render/pipeline.js'),
    ]);
    materialsLayer = createMaterials({ assets });
    await materialsLayer.ready();
    pipeline = createPipeline(renderer);
    const lut = await assets.loadLUT();
    if (lut) pipeline.setLUT(lut);
    pipeline.uniforms.uLUTIntensity.value = lut ? 1 : 0;
    pipeline.setSize(window.innerWidth, window.innerHeight, renderer.getPixelRatio());
    renderer.shadowMap.enabled = true;
    return 'pipeline';
  } catch (error) {
    console.warn('[hero-test] pipeline unavailable, using basic renderer:', error);
    return 'basic';
  }
}

// ---------------------------------------------------------------- labels
const labels = [];
function addLabel(text, worldPos) {
  const el = document.createElement('div');
  el.className = 'label';
  el.textContent = text;
  overlay.appendChild(el);
  labels.push({ el, world: worldPos.clone() });
  return el;
}
function projectLabels() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  for (const entry of labels) {
    const p = entry.world.clone().project(camera);
    if (p.z > 1) { entry.el.style.display = 'none'; continue; }
    entry.el.style.display = '';
    entry.el.style.left = `${((p.x * 0.5 + 0.5) * width).toFixed(1)}px`;
    entry.el.style.top = `${((-p.y * 0.5 + 0.5) * height).toFixed(1)}px`;
  }
}

function setCamera(view) {
  switch (view) {
    case 'back':
      camera.position.set(0, 1.0, -3.3);
      camera.lookAt(0, 0.9, 0);
      break;
    case 'side':
      camera.position.set(3.25, 1.0, 0.25);
      camera.lookAt(0, 0.88, 0);
      break;
    case 'head':
      camera.position.set(0.35, 1.5, 1.15);
      camera.lookAt(0, 1.47, 0);
      break;
    case 'tq':
      camera.position.set(2.0, 1.35, 2.35);
      camera.lookAt(0, 0.85, 0);
      break;
    case 'front':
    case 'single':
    default:
      camera.position.set(0, 1.06, 3.3);
      camera.lookAt(0, 0.92, 0);
      break;
  }
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- actors
const couriers = [];
const npcs = [];
let referenceAvatar = null;

const DEFAULT_TIME = { idle: 0.9, run: 0.19, sprint: 0.16, air: 0.36, talk: 1.1 };

function poseActor(actor, pose, time) {
  actor.play(pose, 0);
  actor.update(0.0001);
  const dt = 1 / 60;
  const steps = Math.max(0, Math.round(time / dt));
  for (let i = 0; i < steps; i += 1) actor.update(dt);
  actor.update(0.0001);
}

async function createSingle() {
  const pose = params.get('pose') || 'idle';
  const time = Number(params.get('time') || DEFAULT_TIME[pose] || 0.8);
  const outfit = {};
  for (const slot of Object.keys(COURIER_OUTFITS)) {
    const value = params.get(slot);
    if (value && COURIER_OUTFITS[slot][value]) outfit[slot] = value;
  }
  const courier = createOriginalCourier({ outfit });
  scene.add(courier.root);
  await courier.ready;
  poseActor(courier, pose, time);
  couriers.push(courier);
  const label = `原创邮差 · ${pose}${Object.keys(outfit).length ? ' · ' + Object.values(outfit).join('/') : ''}`;
  addLabel(label, new THREE.Vector3(0, courier.height + 0.22, 0));
  setCamera(params.get('view') || 'front');
  subtitleEl.textContent = `${pose} · ${courier.height.toFixed(2)}m · 原创`;
  return courier;
}

async function createLineup() {
  const setups = [
    { pose: 'idle', time: 0.9, x: -2.5, label: 'idle · 邮差' },
    { pose: 'run', time: 0.19, x: -0.83, label: 'run · 送信中' },
    { pose: 'air', time: 0.36, x: 0.83, label: 'air · 起跳' },
    { pose: 'sprint', time: 0.16, x: 2.5, label: 'sprint · 冲刺' },
  ];
  for (const setup of setups) {
    const courier = createOriginalCourier();
    courier.root.position.x = setup.x;
    courier.root.position.y = setup.pose === 'air' ? 0.3 : 0;
    courier.root.rotation.y = 0;
    scene.add(courier.root);
    await courier.ready;
    poseActor(courier, setup.pose, setup.time);
    couriers.push(courier);
    addLabel(setup.label, new THREE.Vector3(setup.x, setup.pose === 'air' ? 2.35 : 2.05, 0));
  }
  camera.position.set(0, 1.62, 9.2);
  camera.lookAt(0, 0.95, 0);
  camera.updateProjectionMatrix();
  subtitleEl.textContent = '4 poses · 原创北京邮差';
}

async function createOutfits() {
  const variants = [
    { outfit: { hat: 'postal-green', bag: 'canvas-brown', scarf: 'scarlet' }, label: 'default · 墨绿/帆布棕/砖红' },
    { outfit: { hat: 'navy', bag: 'navy', scarf: 'mustard' }, label: 'navy · 藏青/芥黄' },
    { outfit: { hat: 'red', bag: 'red', scarf: 'cream' }, label: 'festive · 中国红' },
  ];
  const spacing = 1.7;
  const offset = ((variants.length - 1) * spacing) / 2;
  for (let i = 0; i < variants.length; i += 1) {
    const courier = createOriginalCourier({ outfit: variants[i].outfit });
    courier.root.position.x = i * spacing - offset;
    scene.add(courier.root);
    await courier.ready;
    poseActor(courier, 'idle', 1.0);
    couriers.push(courier);
    addLabel(variants[i].label, new THREE.Vector3(courier.root.position.x, 2.0, 0));
  }
  camera.position.set(0, 1.35, 6.3);
  camera.lookAt(0, 0.92, 0);
  camera.updateProjectionMatrix();
  subtitleEl.textContent = 'setOutfit · 邮包/帽子/围巾颜色变体';
}

async function createNpc() {
  const type = params.get('type') || 'beijing-daye';
  const npc = createOriginalNPC({ type });
  scene.add(npc.root);
  await npc.ready;
  npc.setLookAt(new THREE.Vector3(0.4, npc.height * 0.7, 3.0));
  for (let i = 0; i < 90; i += 1) npc.update(1 / 60);
  npc.play(params.get('pose') || 'idle', 0);
  npc.setTalking(params.get('talk') === '1');
  npc.update(1 / 60);
  npcs.push(npc);
  addLabel(`${type} · 原创北京 NPC`, new THREE.Vector3(0, npc.height + 0.22, 0));
  camera.position.set(0.2, 1.05, 3.4);
  camera.lookAt(0, 0.86, 0);
  camera.updateProjectionMatrix();
  subtitleEl.textContent = `npc · ${type}`;
}

async function createNpcRow() {
  const types = ORIGINAL_NPC_TYPES;
  const spacing = 1.75;
  const offset = ((types.length - 1) * spacing) / 2;
  for (let i = 0; i < types.length; i += 1) {
    const npc = createOriginalNPC({ type: types[i] });
    npc.root.position.x = i * spacing - offset;
    scene.add(npc.root);
    await npc.ready;
    for (let f = 0; f < 30; f += 1) npc.update(1 / 60);
    npcs.push(npc);
    addLabel(types[i], new THREE.Vector3(npc.root.position.x, npc.height + 0.2, 0));
  }
  camera.position.set(0, 1.5, 8.6);
  camera.lookAt(0, 0.82, 0);
  camera.updateProjectionMatrix();
  subtitleEl.textContent = `原创北京 NPC · ${types.length} 种`;
}

/** 与参考站 avatar 同框对比（只做对比，不参与原创角色构建）。 */
async function createCompare() {
  const { createAvatar, DEFAULT_OUTFIT } = await import('/src/actor/avatar.js');
  const courier = createOriginalCourier();
  courier.root.position.x = -0.95;
  scene.add(courier.root);
  await courier.ready;
  poseActor(courier, 'idle', 0.9);
  couriers.push(courier);

  const avatar = createAvatar({ assets, materials: materialsLayer, outfit: DEFAULT_OUTFIT });
  scene.add(avatar.root);
  await avatar.ready;
  avatar.root.position.x = 0.95;
  avatar.play('idle', 0);
  avatar.mixer.setTime(0.6);
  avatar.update(0);
  referenceAvatar = avatar;

  addLabel('原创邮差（自建几何）', new THREE.Vector3(-0.95, 1.95, 0));
  addLabel('参考站 avatar（仅对比）', new THREE.Vector3(0.95, 1.95, 0));
  camera.position.set(0, 1.05, 3.6);
  camera.lookAt(0, 0.92, 0);
  camera.updateProjectionMatrix();
  subtitleEl.textContent = '原创 vs 参考站 avatar · 同框';
}

/** 简化的胡同场景：自建 toon 几何拼的灰砖墙 + 树 + 石墩，用来看角色在场景里的感觉。 */
async function createScene() {
  const { createToonMaterialSafe, box, blob } = window.__kit.originalActorKit;
  const sceneMats = {
    stone: createToonMaterialSafe({ color: '#c9bda1', flatShading: false, surfaceId: 0.6 }),
    road: createToonMaterialSafe({ color: '#b7b2a4', flatShading: false, surfaceId: 0.61 }),
    brick: createToonMaterialSafe({ color: '#9aa1a0', flatShading: true, surfaceId: 0.62 }),
    brickDark: createToonMaterialSafe({ color: '#7f8988', flatShading: true, surfaceId: 0.63 }),
    wood: createToonMaterialSafe({ color: '#7a5a40', flatShading: true, surfaceId: 0.64 }),
    leaf: createToonMaterialSafe({ color: '#5b9f7b', flatShading: false, surfaceId: 0.65 }),
    leafDark: createToonMaterialSafe({ color: '#4e8c6d', flatShading: false, surfaceId: 0.66 }),
    lantern: createToonMaterialSafe({ color: '#b8503f', flatShading: false, surfaceId: 0.67 }),
    gold: createToonMaterialSafe({ color: '#d9a63f', flatShading: true, surfaceId: 0.68 }),
  };
  addGround('#c9bda1');
  const road = new THREE.Mesh(new THREE.CircleGeometry(3.2, 40), sceneMats.road);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.004, 1.4);
  road.receiveShadow = true;
  scene.add(road);

  // 灰砖墙（背景）
  const wall = new THREE.Mesh(box(9, 2.6, 0.35, 0.02), sceneMats.brick);
  wall.position.set(0, 1.3, -2.6);
  wall.castShadow = wall.receiveShadow = true;
  scene.add(wall);
  const wallCap = new THREE.Mesh(box(9.2, 0.22, 0.5, 0.01), sceneMats.brickDark);
  wallCap.position.set(0, 2.6, -2.6);
  wallCap.castShadow = true;
  scene.add(wallCap);
  // 砖缝（几条深色横线）
  for (let i = 0; i < 4; i += 1) {
    const line = new THREE.Mesh(box(8.9, 0.035, 0.02, 0), sceneMats.brickDark);
    line.position.set(0, 0.5 + i * 0.55, -2.42);
    scene.add(line);
  }
  // 树
  for (const [x, z, s] of [[-2.6, -2.2, 1.0], [2.7, -2.1, 1.15]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 1.9 * s, 7), sceneMats.wood);
    trunk.position.set(x, 0.95 * s, z);
    trunk.castShadow = true;
    scene.add(trunk);
    for (const [ox, oy, oz, r] of [[0, 1.05, 0, 0.78], [-0.42, 0.7, 0.1, 0.5], [0.45, 0.75, -0.12, 0.48]]) {
      const crown = new THREE.Mesh(blob(r * s, 10, 8), (ox + oz) > 0 ? sceneMats.leaf : sceneMats.leafDark);
      crown.position.set(x + ox * s, (1.9 + oy) * s, z + oz * s);
      crown.scale.set(1.15, 0.9, 1.0);
      crown.castShadow = true;
      scene.add(crown);
    }
  }
  // 红灯笼
  for (const [x, y] of [[-1.9, 2.1], [1.9, 2.1]]) {
    const lantern = new THREE.Mesh(blob(0.16, 10, 8), sceneMats.lantern);
    lantern.scale.set(1, 0.85, 1);
    lantern.position.set(x, y, -2.36);
    lantern.castShadow = true;
    scene.add(lantern);
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.05, 8), sceneMats.gold);
    capTop.position.set(x, y + 0.15, -2.36);
    scene.add(capTop);
    const capBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.05, 8), sceneMats.gold);
    capBottom.position.set(x, y - 0.15, -2.36);
    scene.add(capBottom);
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.02, 0.16, 5), sceneMats.lantern);
    tassel.position.set(x, y - 0.25, -2.36);
    scene.add(tassel);
  }
  // 石墩
  for (const x of [-3.6, 3.6]) {
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.45, 9), sceneMats.stone);
    seat.position.set(x, 0.225, -1.7);
    seat.castShadow = seat.receiveShadow = true;
    scene.add(seat);
  }

  const courier = createOriginalCourier();
  courier.root.position.set(-1.15, 0, 0.55);
  courier.root.rotation.y = 0.3;
  scene.add(courier.root);
  await courier.ready;
  poseActor(courier, 'idle', 0.9);
  couriers.push(courier);

  const npc = createOriginalNPC({ type: 'beijing-daye' });
  npc.root.position.set(1.45, 0, 0.25);
  npc.root.rotation.y = -0.25;
  scene.add(npc.root);
  await npc.ready;
  npc.setLookAt(new THREE.Vector3(-1.0, 1.0, 1.2));
  for (let i = 0; i < 90; i += 1) npc.update(1 / 60);
  npcs.push(npc);

  addLabel('原创邮差', new THREE.Vector3(-1.0, 2.0, 0.4));
  addLabel('遛鸟大爷', new THREE.Vector3(1.35, 1.85, 0.1));
  camera.position.set(0.35, 1.62, 7.0);
  camera.lookAt(0, 0.98, 0);
  camera.updateProjectionMatrix();
  subtitleEl.textContent = '自建胡同场景 · 原创角色同框';
}

// ---------------------------------------------------------------- loop
let frozen = false;
let last = performance.now();
let elapsed = 0;
function draw() {
  if (materialsLayer) materialsLayer.update(elapsed);
  if (pipeline) pipeline.render(scene, camera);
  else renderer.render(scene, camera);
  projectLabels();
}
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (!frozen) {
    elapsed += dt;
    for (const courier of couriers) courier.update(dt);
    for (const npc of npcs) npc.update(dt);
    if (referenceAvatar) referenceAvatar.update(dt);
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
  draw();
}
window.addEventListener('resize', onResize);

function setStatus(text) { statusEl.textContent = text; }

async function boot() {
  try {
    renderMode = await setupRender();
    setStatus(`mode: ${MODE}\nrender: ${renderMode}`);
    if (MODE === 'lineup') await createLineup();
    else if (MODE === 'outfits') await createOutfits();
    else if (MODE === 'npc') await createNpc();
    else if (MODE === 'npcs') await createNpcRow();
    else if (MODE === 'compare') await createCompare();
    else if (MODE === 'scene') await createScene();
    else await createSingle();

    onResize();
    draw();
    window.__app = {
      mode: MODE,
      renderMode,
      couriers,
      npcs,
      referenceAvatar,
      camera,
      scene,
      renderer,
      pipeline,
      assets,
      THREE,
      ORIGINAL_NPC_TYPES,
      freeze(value = true) { frozen = Boolean(value); last = performance.now(); },
      renderOnce: draw,
      setCamera(view) { setCamera(view); draw(); },
      pose(index, name, time) {
        poseActor(couriers[index], name, time);
        draw();
      },
      setOutfit(index, outfit) {
        couriers[index].setOutfit(outfit);
        poseActor(couriers[index], couriers[index].pose, 0.9);
        draw();
      },
      info() {
        return {
          renderMode,
          couriers: couriers.map((courier) => {
            const bounds = new THREE.Box3().setFromObject(courier.root);
            return {
              pose: courier.pose,
              height: +courier.height.toFixed(3),
              bbox: +((bounds.max.y - bounds.min.y)).toFixed(3),
              bones: Object.keys(courier.bones).length,
              meshes: courier.meshes.length,
              materials: courier.materials.length,
              outfit: courier.outfit,
            };
          }),
          npcs: npcs.map((npc) => ({
            type: npc.npcType,
            height: +npc.height.toFixed(3),
            pose: npc.pose,
            meshes: npc.meshes.length,
          })),
          triangles: renderer.info.render.triangles,
          calls: renderer.info.render.calls,
        };
      },
    };
    window.__ready = true;
  } catch (error) {
    console.error('[hero-test] boot failed', error);
    setStatus(`ERROR: ${error && error.stack ? error.stack : error}`);
    window.__error = String((error && error.stack) || error);
  }
}

boot();
