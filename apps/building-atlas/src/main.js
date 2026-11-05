/**
 * main.js —— 富华大厦 · 建筑数字档案
 * Three.js 场景 + 整体浏览交互 + 楼层分层模式（楼带切分 / 炸开 / 聚焦 / 2D 平面布局）
 */
import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  TOWERS,
  TOWER_IDS,
  EXPLODE_GAP,
  FLOOR_HEIGHT,
  buildFloors,
  buildFloorPlan,
  renderFloorPlanSvg,
  renderFloorLegend,
  buildFloorStack,
  resolveBuildingId,
  floorOverviewCamera,
  floorFocusCamera,
  easeInOutCubic,
  levelShortName,
} from './floors.js';
import { createPoiFocus } from './poi-focus.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
// 子路径静态部署：所有资源使用 import.meta.env.BASE_URL（vite base './'）拼相对路径
const BASE_URL = import.meta.env.BASE_URL;
const asset = (p) => `${BASE_URL}${p}`;

/* ----------------------------- 三维基础场景 ------------------------------ */
const host = $('#viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#14232e');
scene.fog = new THREE.FogExp2('#14232e', 0.00085);

const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 4200);
camera.position.set(-140, 112, 153);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
} catch (error) {
  $('#loading strong').textContent = '此浏览器无法启动三维场景';
  $('#load-progress').textContent = '请启用硬件加速后刷新页面';
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
host.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = env.texture;
scene.environmentIntensity = 0.65;
pmrem.dispose();

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 24, 0);
controls.enableDamping = true;
controls.minDistance = 35;
controls.maxDistance = 1600;
controls.maxPolarAngle = Math.PI * 0.49;
controls.autoRotateSpeed = 0.45;

const ambient = new THREE.HemisphereLight(0xc4e0f4, 0x77715e, 1.15);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffead0, 2.1);
sun.position.set(-75, 130, 65);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 1, far: 350 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.15;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xaccde5, 0.8);
fill.position.set(80, 70, -70);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2000, 2000),
  new THREE.MeshStandardMaterial({ color: 0x192e3a, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.6;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(600, 75, 0x36505c, 0x263d49);
grid.position.y = -1.5;
grid.material.transparent = true;
grid.material.opacity = 0.34;
scene.add(grid);

// 周围街廓为示意体块，非地理配准地图
const context = new THREE.Group();
scene.add(context);
function block(x, z, w, d, h) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: 0x223541, roughness: 0.95, transparent: true, opacity: 0.6 }),
  );
  mesh.position.set(x, h / 2 - 1.5, z);
  context.add(mesh);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: 0x47606e, transparent: true, opacity: 0.23 }),
  );
  edges.position.copy(mesh.position);
  context.add(edges);
}
[[-95, -70, 36, 35, 18], [-105, -12, 33, 47, 24], [-92, 61, 45, 30, 15], [91, -62, 29, 37, 28], [100, 0, 43, 36, 20], [98, 63, 35, 30, 13], [-30, -100, 47, 32, 15], [35, -100, 40, 30, 21], [10, 106, 73, 31, 16]].forEach((a) => block(...a));
// 道路标线
for (const x of [-57, 57]) {
  for (let z = -100; z < 100; z += 10) {
    const paint = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 4), new THREE.MeshBasicMaterial({ color: 0x526674 }));
    paint.rotation.x = -Math.PI / 2;
    paint.position.set(x, -1.42, z);
    context.add(paint);
  }
}

/* ------------------------------- 建筑数据 ------------------------------- */
const state = {
  model: null,
  loaded: false,
  night: false,
  time: 'day',
  selected: null,
  flight: null,
};

/* 升级模块（街区语境 / 昼夜氛围 / 场地景观）：动态加载，任一模块失败不影响基础展示 */
const upgrade = {
  atmo: null,
  city: null,
  dressing: null,
  modulesReady: false,
  cityDone: false,
  timedOut: false,
  started: false,
};

/* 街区地标聚焦标记（光柱 + 地面光环 + 目标建筑体量框） */
let poiFocus = null;

const originalMaterials = new Map();
const contextMeshes = []; // Site / Podium 网格：楼层模式下压暗
const labelNodes = {};

for (const id of TOWER_IDS) {
  const tower = TOWERS[id];
  const btn = document.createElement('button');
  btn.innerHTML = `${id}<span>座</span>`;
  btn.dataset.building = id;
  btn.setAttribute('aria-label', `定位 ${id} 座`);
  $('#building-grid').append(btn);
  const label = document.createElement('button');
  label.className = 'building-label';
  label.textContent = `${id} 座`;
  label.dataset.building = id;
  $('#labels').append(label);
  labelNodes[id] = label;
  tower._floors = buildFloors(tower);
}

/* ------------------------------- 模型加载 ------------------------------- */
new GLTFLoader().load(
  asset('models/fuhua-mansion.glb'),
  (gltf) => {
    state.model = gltf.scene;
    scene.add(state.model);
    let triangles = 0;
    state.model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.material = object.material.clone();
      originalMaterials.set(object, object.material);
      triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
      const building = object.userData.building;
      if (building === 'Site' || building === 'Podium') {
        contextMeshes.push({
          mesh: object,
          opacity: object.material.opacity,
          transparent: object.material.transparent,
        });
      }
    });
    enhanceHeroMaterials();
    createFloorMaterialPools();
    state.loaded = true;
    if (upgrade.atmo && upgrade.atmo.setModel) {
      try { upgrade.atmo.setModel(state.model); } catch (error) { console.warn('[building-atlas] 夜景窗光接入失败', error); }
    }
    const progressText = $('#load-progress');
    if (progressText) progressText.textContent = '建筑模型加载完成';
    window.__sceneStats = { loaded: true, triangles: Math.round(triangles), meshes: originalMaterials.size };
    checkLoadingDone();
    resize();
  },
  (event) => {
    $('#load-progress').textContent = event.total
      ? `模型加载 ${Math.round((event.loaded / event.total) * 100)}%`
      : `已加载 ${(event.loaded / 1024 / 1024).toFixed(1)} MB`;
  },
  (error) => {
    $('#loading strong').textContent = '模型加载失败';
    $('#load-progress').textContent = '请检查服务是否启动，然后刷新页面';
    console.error(error);
  },
);

function resize() {
  const w = host.clientWidth;
  const h = host.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w / h < 1 ? 52 : 36;
  camera.zoom = w / h < 0.7 ? 0.78 : 1;
  camera.updateProjectionMatrix();
  if (upgrade.atmo && upgrade.atmo.resize) upgrade.atmo.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

/* ------------------------------ 相机飞行 ------------------------------- */
function fly(pos, target, duration = 1100) {
  state.flight = {
    start: performance.now(),
    duration,
    from: camera.position.clone(),
    to: new THREE.Vector3(...pos),
    tfrom: controls.target.clone(),
    tto: new THREE.Vector3(...target),
  };
}

const views = {
  perspective: { pos: [-140, 112, 153], target: [0, 24, 0], label: '西南视角' },
  front: { pos: [-185, 45, 0], target: [0, 29, 0], label: '西侧立面' },
  top: { pos: [0, 220, 0.01], target: [0, 0, 0], label: '总平布局' },
  courtyard: { pos: [0, 24, 40], target: [0, 28, -20], label: '中庭视角' },
  city: { pos: [-340, 300, 430], target: [4, 10, -30], label: '街区鸟瞰' },
};

function setView(name) {
  if (floorState.active) exitFloorMode();
  clearSelection();
  clearPoiFocus();
  const view = views[name] || views.perspective;
  if (upgrade.city && upgrade.city.setHighlightSite) upgrade.city.setHighlightSite(name === 'city');
  if (name === 'city') {
    if (upgrade.city) {
      if (!upgrade.city.group.visible) upgrade.city.setAllVisible(true);
      upgrade.city.setLayer('whiteModels', true);
      upgrade.city.setLayer('roads', true);
      syncLayerButtons();
    }
    setNav('context');
  } else {
    setNav('overview');
  }
  fly(view.pos, view.target);
  $('#view-name').textContent = view.label;
  $$('[data-view]').forEach((el) => el.classList.toggle('active', el.dataset.view === name));
}

/* ---------------------------- 整体模式交互 ----------------------------- */
function selectBuilding(id) {
  if (!state.loaded || floorState.active) return;
  clearPoiFocus();
  state.selected = id;
  const tower = TOWERS[id];
  $$('[data-building]').forEach((el) => el.classList.toggle('active', el.dataset.building === id));
  $('#detail-location').textContent = tower.loc;
  $('#detail-name').textContent = `富华大厦 · ${id} 座`;
  $('#detail-description').textContent = tower.desc;
  updateMaterials();
  fly([tower.x + (tower.x < 0 ? -64 : 64), 64, tower.z + 83], [tower.x, 29, tower.z]);
  $('#view-name').textContent = `${id} 座观察`;
  $$('[data-view]').forEach((el) => el.classList.remove('active'));
}

function updateMaterials() {
  if (!state.model) return;
  // atmo 启用时夜景窗光交给它的 shader 逐窗控制；否则沿用整面玻璃自发光
  const shaderWindows = Boolean(upgrade.atmo);
  state.model.traverse((object) => {
    if (!object.isMesh) return;
    const glass = String(object.material.name || '').toLowerCase().includes('glass');
    const own = state.selected && resolveBuildingId(object, TOWERS) === state.selected;
    const glassNight = glass && state.night && !shaderWindows;
    object.material.emissive.set(glassNight ? 0xf4b35b : own ? 0x96764a : 0);
    object.material.emissiveIntensity = glassNight ? 0.55 : own ? 0.17 : 0;
  });
}

function clearSelection() {
  state.selected = null;
  $$('[data-building]').forEach((el) => el.classList.remove('active'));
  updateMaterials();
  $('#detail-location').textContent = '整体建筑群';
  $('#detail-name').textContent = '富华大厦';
  $('#detail-description').textContent = '双列塔楼与低层连廊围合中央庭院，浅色石材与连续拱券构成立面韵律。';
}

/**
 * 英雄模型的材质微调：提升玻璃/铜框的环境反射与石材的哑光质感。
 * 只改 PBR 参数，不替换材质，楼层切分与夜景窗光 shader 仍可正常工作。
 */
function enhanceHeroMaterials() {
  if (!state.model) return;
  state.model.traverse((object) => {
    if (!object.isMesh || !object.material) return;
    const material = object.material;
    const name = String(material.name || '');
    if (/glass/i.test(name)) {
      material.metalness = Math.max(material.metalness ?? 0, 0.62);
      material.roughness = Math.min(material.roughness ?? 0.24, 0.14);
      material.envMapIntensity = 1.55;
    } else if (/bronze|frame/i.test(name)) {
      material.metalness = Math.max(material.metalness ?? 0, 0.72);
      material.roughness = Math.min(material.roughness ?? 0.35, 0.3);
      material.envMapIntensity = 1.25;
    } else if (/stone|limestone|paving|pale|ivory/i.test(name)) {
      material.roughness = Math.max(material.roughness ?? 0.6, 0.72);
      material.metalness = Math.min(material.metalness ?? 0, 0.04);
      material.envMapIntensity = 0.85;
    } else if (/roof|graphite/i.test(name)) {
      material.roughness = Math.max(material.roughness ?? 0.6, 0.68);
      material.envMapIntensity = 0.7;
    }
    if ('envMapIntensity' in material) material.needsUpdate = true;
  });
}

$$('[data-building]').forEach((btn) => btn.addEventListener('click', () => selectBuilding(btn.dataset.building)));
$$('[data-view]').forEach((btn) => btn.addEventListener('click', () => setView(btn.dataset.view)));
$('#show-all').onclick = () => setView('perspective');
$('#reset').onclick = () => {
  controls.autoRotate = false;
  $('#rotate').setAttribute('aria-pressed', 'false');
  setView('perspective');
};
$('#rotate').onclick = () => {
  controls.autoRotate = !controls.autoRotate;
  $('#rotate').setAttribute('aria-pressed', String(controls.autoRotate));
};
$('#night').onclick = () => {
  const order = ['day', 'dusk', 'night'];
  const next = order[(order.indexOf(state.time) + 1) % order.length];
  applyTimePreset(next);
  toast(`时间：${TIME_META[next].label}`);
};
$('#fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast('当前窗口不支持全屏，可使用浏览器全屏模式');
  }
};

let toastTimer = 0;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ========================================================================== *
 * 街区语境 / 昼夜氛围 / 场地景观 —— 模块编排（模块本身可独立失败）
 * ========================================================================== */
const KIND_LABELS = {
  metro: '地铁', landmark: '地标', office: '办公', hotel: '酒店', culture: '文化',
  park: '公园', stadium: '体育', education: '学校', government: '机构', retail: '商业',
};
const TIME_META = {
  day: { icon: '☀', label: '日景' },
  dusk: { icon: '◐', label: '黄昏' },
  night: { icon: '☾', label: '夜景' },
};

function fmtDistance(meters) {
  const m = Number(meters) || 0;
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}
function fmtCount(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v >= 10000 ? `${(v / 10000).toFixed(1)} 万` : v.toLocaleString('zh-CN');
}

function clampNumber(value, min, max) {
  const v = Number(value);
  if (!Number.isFinite(v)) return min;
  return v < min ? min : v > max ? max : v;
}

function ensurePoiFocus() {
  if (!poiFocus) {
    poiFocus = createPoiFocus({ scene, getCity: () => upgrade.city });
  }
  return poiFocus;
}

function clearPoiFocus() {
  if (poiFocus) poiFocus.clear();
  setCityGhost(false, 'focus');
  const tag = $('#poi-focus-tag');
  if (tag) tag.hidden = true;
  $$('#city-labels .city-poi').forEach((el) => el.classList.remove('active'));
}

const ghostState = { layer: false, focus: false };

/**
 * 周边白模「透视」：半透明 + 关闭深度写入，让被街区挡住的富华/地标重新可见。
 * source='layer' 来自图层开关（常驻），source='focus' 来自地标聚焦（自动）。
 */
function setCityGhost(on, source = 'focus') {
  if (source === 'layer') ghostState.layer = Boolean(on);
  else ghostState.focus = Boolean(on);
  const active = ghostState.layer || ghostState.focus;
  const city = upgrade.city;
  if (!city || !city.group) return active;
  const mesh = city.group.getObjectByName('city-buildings');
  const material = mesh && mesh.material;
  if (!material) return active;
  if (active) {
    if (material.userData.__ghostSaved) return true;
    material.userData.__ghostSaved = {
      transparent: material.transparent,
      opacity: material.opacity,
      depthWrite: material.depthWrite,
    };
    material.transparent = true;
    material.opacity = 0.28;
    material.depthWrite = false;
    material.needsUpdate = true;
  } else if (material.userData.__ghostSaved) {
    const saved = material.userData.__ghostSaved;
    material.transparent = saved.transparent;
    material.opacity = saved.opacity;
    material.depthWrite = saved.depthWrite;
    material.needsUpdate = true;
    delete material.userData.__ghostSaved;
  }
  return active;
}

function setNav(panel) {
  $$('.nav[data-panel]').forEach((el) => el.classList.toggle('active', el.dataset.panel === panel));
}

function cityProgress(payload) {
  const el = $('#load-progress-city');
  if (!el) return;
  if (typeof payload === 'string') {
    el.textContent = `街区语境 · ${payload}`;
    return;
  }
  if (!payload) return;
  const percent = payload.percent != null ? ` ${Math.round(payload.percent)}%` : '';
  const phase = payload.phase ? payload.phase : '';
  const text = payload.text || `${phase}${percent}`;
  if (text) el.textContent = `街区语境 · ${text}`;
}

function checkLoadingDone() {
  if (!state.loaded) return;
  if (!upgrade.cityDone && !upgrade.timedOut) return;
  const overlay = $('#loading');
  if (overlay) overlay.classList.add('hidden');
}

function applyLegacyNight(night) {
  ambient.intensity = night ? 0.5 : 1.15;
  sun.intensity = night ? 0.25 : 2.1;
  fill.intensity = night ? 0.65 : 0.8;
  renderer.toneMappingExposure = night ? 0.85 : 1.05;
  scene.background.set(night ? 0x091723 : 0x14232e);
  scene.fog.color.copy(scene.background);
}

function applyTimePreset(preset) {
  const next = TIME_META[preset] ? preset : 'day';
  state.time = next;
  state.night = next === 'night';
  document.body.classList.toggle('is-night', state.night);
  const button = $('#night');
  if (button) {
    const meta = TIME_META[next];
    button.innerHTML = `${meta.icon} <span>${meta.label}</span>`;
    button.dataset.time = next;
    button.setAttribute('aria-pressed', String(state.night));
    button.setAttribute('aria-label', `切换时间（当前：${meta.label}）`);
  }
  if (upgrade.atmo) upgrade.atmo.setPreset(next);
  else applyLegacyNight(state.night);
  if (upgrade.city) upgrade.city.setNight(next);
  if (upgrade.dressing) upgrade.dressing.setNight(next);
  updateMaterials();
  applyNightToFloors();
  return next;
}

const CITY_LAYER_BUTTONS = new Set(['whiteModels', 'roads', 'landuse', 'poi', 'site', 'rings']);
const DRESSING_LAYER_BUTTONS = new Set(['trees', 'lamps']);

function layerEnabled(name) {
  if (CITY_LAYER_BUTTONS.has(name) && upgrade.city && upgrade.city.layers) return Boolean(upgrade.city.layers[name]);
  if (name === 'trees' && upgrade.dressing && upgrade.dressing.layers) return Boolean(upgrade.dressing.layers.trees);
  if (name === 'lamps' && upgrade.dressing && upgrade.dressing.layers) return Boolean(upgrade.dressing.layers.lamps);
  if (name === 'ghost') return ghostState.layer;
  return true;
}

function syncLayerButtons() {
  $$('[data-layer]').forEach((button) => {
    const name = button.dataset.layer;
    button.setAttribute('aria-pressed', String(layerEnabled(name)));
  });
}

function setLayer(name, on) {
  let applied = false;
  if (CITY_LAYER_BUTTONS.has(name) && upgrade.city) {
    applied = Boolean(upgrade.city.setLayer(name, on));
  } else if (name === 'trees' && upgrade.dressing) {
    applied = Boolean(upgrade.dressing.setLayer('trees', on));
  } else if (name === 'lamps' && upgrade.dressing) {
    upgrade.dressing.setLayer('lamps', on);
    upgrade.dressing.setLayer('cars', on);
    applied = true;
  } else if (name === 'ghost') {
    applied = true;
    setCityGhost(on, 'layer');
  }
  if (applied) {
    syncLayerButtons();
    if (name === 'whiteModels' || name === 'roads') {
      toast(on ? '已显示周边街区图层' : '已隐藏周边街区图层');
    }
  }
  return applied;
}

function renderCityFallback(message) {
  upgrade.cityDone = true;
  const mapHost = $('#context-map');
  if (mapHost) mapHost.innerHTML = `<span class="map-loading">${message}</span>`;
  const list = $('#landmark-list');
  if (list) list.innerHTML = '<li class="landmark-empty">街区语境数据不可用</li>';
  const detail = $('#poi-detail');
  if (detail) detail.textContent = '街区语境数据未加载，可在本地重新生成后查看。';
  for (const id of ['stat-buildings', 'stat-roads', 'stat-transit']) {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  }
  const status = $('#status-text');
  if (status) status.textContent = '三维场景已连接';
  checkLoadingDone();
}

function onCityReady(city) {
  upgrade.city = city;
  upgrade.cityDone = true;
  window.__fuhuaCity = city;
  window.__cityStats = city.stats || null;
  renderCityUI();
  syncLayerButtons();
  const status = $('#status-text');
  const fallback = Boolean(city.stats && city.stats.fallback);
  if (status) status.textContent = fallback ? '三维场景已连接 · 街区示意' : '三维场景 · 街区语境已连接';
  if (upgrade.atmo) {
    try { city.setNight(state.time); } catch (error) { console.warn('[building-atlas] 街区昼夜同步失败', error); }
  }
  checkLoadingDone();
}

function renderCityUI() {
  const city = upgrade.city;
  if (!city) {
    renderCityFallback('街区数据不可用');
    return;
  }
  const mapHost = $('#context-map');
  if (mapHost) {
    try {
      mapHost.innerHTML = city.minimapSvg({ width: 272, height: 224, rangeM: 1500 });
    } catch (error) {
      console.warn('[building-atlas] 小地图生成失败', error);
      mapHost.innerHTML = '<span class="map-loading">街区地图生成失败</span>';
    }
  }
  const pois = (city.poisWithin ? city.poisWithin(1800) : (city.data && city.data.poi) || []).slice(0, 12);
  const list = $('#landmark-list');
  if (list) {
    list.innerHTML = pois.length ? pois.map((poi, index) => {
      const kindClass = poi.kind === 'metro' ? 'metro' : poi.kind === 'landmark' ? 'landmark' : '';
      return `<li><button class="${kindClass}" data-poi-id="${poi.id}"><span class="lm-idx">${String(index + 1).padStart(2, '0')}</span><span class="lm-name">${poi.name}<em>${KIND_LABELS[poi.kind] || '地点'}</em></span><span class="lm-dist">${fmtDistance(poi.distanceM)}</span></button></li>`;
    }).join('') : '<li class="landmark-empty">暂无地标数据</li>';
  }
  const stats = city.stats || {};
  const statBuildings = $('#stat-buildings');
  const statRoads = $('#stat-roads');
  const statTransit = $('#stat-transit');
  if (statBuildings) statBuildings.textContent = stats.buildings != null ? fmtCount(stats.buildings) : '—';
  if (statRoads) statRoads.textContent = stats.roads != null ? fmtCount(stats.roads) : '—';
  const nearestMetro = pois.filter((p) => p.kind === 'metro').sort((a, b) => a.distanceM - b.distanceM)[0];
  if (statTransit) statTransit.textContent = nearestMetro ? String(Math.round(nearestMetro.distanceM)) : '—';
  const range = $('#context-range');
  if (range) {
    const radiusM = (city.meta && city.meta.radiusM) || 1500;
    range.textContent = `覆盖半径 ${(radiusM / 1000).toFixed(1)} km · ${stats.buildings != null ? fmtCount(stats.buildings) : '—'} 栋白模`;
  }
  if (list) {
    list.onclick = (event) => {
      const button = event.target.closest('[data-poi-id]');
      if (!button) return;
      const poi = findPoi(button.dataset.poiId);
      if (poi) focusPoi(poi);
    };
  }
  if (mapHost) {
    mapHost.onclick = (event) => {
      const node = event.target.closest('[data-poi-id]');
      if (!node) return;
      const poi = findPoi(node.dataset.poiId);
      if (poi) focusPoi(poi);
    };
  }
}

function findPoi(id) {
  const city = upgrade.city;
  if (!city || !city.data || !Array.isArray(city.data.poi)) return null;
  return city.data.poi.find((poi) => String(poi.id) === String(id)) || null;
}

function focusPoi(poi) {
  if (!poi) return;
  if (floorState.active) exitFloorMode();
  if (upgrade.city) {
    if (!upgrade.city.group.visible) upgrade.city.setAllVisible(true);
    upgrade.city.setLayer('poi', true);
    if (upgrade.city.setHighlightSite) upgrade.city.setHighlightSite(true);
  }
  clearSelection();
  const px = Number(poi.x) || 0;
  const pz = Number(poi.z) || 0;
  const distance = Math.max(30, Number(poi.distanceM) || Math.hypot(px, pz) || 120);
  const length = Math.hypot(px, pz) || 1;
  const ux = px / length;
  const uz = pz / length;
  const marker = ensurePoiFocus();
  marker.focus(poi);
  setCityGhost(true, 'focus');
  const targetHeight = Math.max(12, marker.height || 16);
  // 从「远离地块一侧」斜俯看回目标：目标在近景、富华在远景；距离随目标体量放大，避免整屏被白模糊住
  const back = clampNumber(Math.max(distance * 0.85, targetHeight * 2.6, 130), 130, 520);
  const height = clampNumber(Math.max(targetHeight * 1.05 + 70, distance * 0.3 + 70), 100, 400);
  fly([px + ux * back, height, pz + uz * back], [px, Math.max(8, targetHeight * 0.32), pz], 1500);
  $$('#city-labels .city-poi').forEach((el) => {
    el.classList.toggle('active', String(el.dataset.poiId) === String(poi.id));
  });
  const focusTag = $('#poi-focus-tag');
  if (focusTag) {
    focusTag.hidden = false;
    focusTag.innerHTML = `<span class="dot"></span> 地标聚焦 · ${poi.name} <b>距富华大厦 ${fmtDistance(poi.distanceM)}</b>`;
  }
  const viewName = $('#view-name');
  if (viewName) viewName.textContent = `${poi.name} · 周边地标`;
  setNav('context');
  $$('#landmark-list button').forEach((button) => {
    button.classList.toggle('active', String(button.dataset.poiId) === String(poi.id));
  });
  const detail = $('#poi-detail');
  if (detail) {
    detail.innerHTML = `<b>${poi.name}</b>　<em>${KIND_LABELS[poi.kind] || '地点'} · 距富华大厦 ${fmtDistance(poi.distanceM)}</em>${poi.note ? `<br><span>${poi.note}</span>` : ''}`;
  }
}

async function initUpgradeModules() {
  if (upgrade.started) return;
  upgrade.started = true;
  cityProgress('载入街区数据…');
  const [atmoModule, cityModule, dressingModule] = await Promise.all([
    import('./atmosphere.js').catch(() => null),
    import('./city.js').catch(() => null),
    import('./site-dressing.js').catch(() => null),
  ]);

  if (atmoModule && typeof atmoModule.createAtmosphere === 'function') {
    try {
      upgrade.atmo = atmoModule.createAtmosphere({ scene, camera, renderer, lights: { sun, ambient, fill }, controls });
      upgrade.atmo.setShadows(true);
      upgrade.atmo.resize(host.clientWidth, host.clientHeight);
      if (state.model && upgrade.atmo.setModel) upgrade.atmo.setModel(state.model);
      window.__atmo = upgrade.atmo;
    } catch (error) {
      console.warn('[building-atlas] 氛围模块初始化失败，使用基础光照', error);
      upgrade.atmo = null;
    }
  } else {
    console.warn('[building-atlas] 未找到 atmosphere.js，使用基础光照');
  }

  if (cityModule && typeof cityModule.createCityContext === 'function') {
    try {
      const city = await cityModule.createCityContext({
        scene,
        camera,
        renderer,
        labelHost: $('#city-labels'),
        onProgress: cityProgress,
        onPoiClick: focusPoi,
      });
      if (city) onCityReady(city);
      else renderCityFallback('街区模块未返回数据');
    } catch (error) {
      console.warn('[building-atlas] 街区语境加载失败', error);
      renderCityFallback('街区语境加载失败');
    }
  } else {
    renderCityFallback('街区语境模块不可用');
  }

  if (dressingModule && typeof dressingModule.createSiteDressing === 'function') {
    try {
      upgrade.dressing = dressingModule.createSiteDressing({ scene, renderer, camera, city: upgrade.city });
      window.__dressing = upgrade.dressing;
    } catch (error) {
      console.warn('[building-atlas] 场地景置初始化失败', error);
      upgrade.dressing = null;
    }
  }

  upgrade.modulesReady = true;
  syncLayerButtons();
  applyTimePreset(state.time);
  checkLoadingDone();
}

/* ------------------------------ 影像档案 -------------------------------- */
const referenceTitles = [
  '正立面 · 西侧双塔', '入口 · 旋转门与拱券', '大堂 · 柱式与室内尺度', '入口 · 石材柱廊',
  '斜侧全景 · 体量关系', '西侧街景 · 黄昏立面', '首层街景 · 连廊与塔楼', '侧向街景 · 窗列与纵深',
  '卫星图 · 屋顶与庭院', '平面地图 · A–F 座布局',
];
referenceTitles.forEach((title, i) => {
  const num = String(i + 1).padStart(2, '0');
  const figure = document.createElement('figure');
  figure.innerHTML = `<a href="${asset(`references/${num}.jpg`)}" target="_blank" rel="noopener"><img loading="lazy" src="${asset(`references/${num}.jpg`)}" alt="${title}" /></a><figcaption>${num} / ${title}</figcaption>`;
  $('#gallery-grid').append(figure);
});

function openModal(selector) {
  $(selector).showModal();
  controls.autoRotate = false;
  $('#rotate').setAttribute('aria-pressed', 'false');
}
$('#reference-open').onclick = () => openModal('#gallery');
$$('[data-panel]').forEach((btn) => {
  btn.onclick = () => {
    const panel = btn.dataset.panel;
    if (panel === 'floors') {
      if (floorState.active) exitFloorMode();
      else enterFloorMode();
      return;
    }
    if (floorState.active) exitFloorMode();
    if (panel === 'atlas') openModal('#gallery');
    else if (panel === 'about') openModal('#about');
    else if (panel === 'context') setView('city');
    else setView('perspective');
    if (panel === 'context') toast('街区语境：东四十条周边 OSM 白模与地标');
  };
});

/* 图层控制面板 */
function setLayersPanelOpen(open) {
  const panel = $('#layers-panel');
  const toggle = $('#layers-toggle');
  if (!panel) return;
  panel.hidden = !open;
  if (toggle) toggle.setAttribute('aria-expanded', String(open));
}
$('#layers-toggle').onclick = () => {
  const panel = $('#layers-panel');
  setLayersPanelOpen(Boolean(panel && panel.hidden));
};
$('#layers-close').onclick = () => setLayersPanelOpen(false);
$('#poi-focus-tag').onclick = () => {
  setView('perspective');
  toast('已回到建筑整体视角');
};
$$('[data-layer]').forEach((button) => {
  button.addEventListener('click', () => {
    const name = button.dataset.layer;
    const next = button.getAttribute('aria-pressed') !== 'true';
    const applied = setLayer(name, next);
    if (!applied) toast('该图层暂不可用');
    else if (name === 'rings') toast(next ? '已显示 200 / 500 / 1000 m 距离环' : '已隐藏距离环');
  });
});
document.addEventListener('pointerdown', (event) => {
  const panel = $('#layers-panel');
  if (!panel || panel.hidden) return;
  if (panel.contains(event.target) || $('#layers-toggle').contains(event.target)) return;
  setLayersPanelOpen(false);
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const panel = $('#layers-panel');
    if (panel && !panel.hidden) setLayersPanelOpen(false);
  }
});
$$('.close-modal').forEach((btn) => { btn.onclick = () => btn.closest('dialog').close(); });
$$('dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }
  });
});

/* ============================ 楼层分层模式 ============================== */
const floorState = {
  active: false,
  built: false,
  building: false,
  towerId: 'F',
  levelIndex: 0,
  levels: [],
  levelsByTower: new Map(),
  explode: 0,
  explodeTarget: 0,
  tween: null,
  stack: null,
  currentPlan: null,
  selectedUnitId: null,
};
for (const id of TOWER_IDS) floorState.levelsByTower.set(id, TOWERS[id]._floors);
floorState.levels = floorState.levelsByTower.get(floorState.towerId);
floorState.levelIndex = Math.floor(floorState.levels.length / 2);

let floorPools = null;
let slabPools = null;

function createFloorMaterialPools() {
  const sources = new Map();
  state.model.traverse((object) => {
    if (object.isMesh && object.material && object.material.name && !sources.has(object.material.name)) {
      sources.set(object.material.name, object.material);
    }
  });
  floorPools = {};
  const make = (source, overrides) => {
    const material = source.clone();
    material.emissive = new THREE.Color(0x000000);
    material.emissiveIntensity = 1;
    material.transparent = false;
    material.opacity = 1;
    material.depthWrite = true;
    Object.assign(material, overrides);
    return material;
  };
  for (const [name, source] of sources) {
    if (name === 'Courtyard paving' || name === 'Garden foliage') continue;
    const dimColor = source.color.clone().multiplyScalar(0.62);
    floorPools[name] = {
      normal: make(source, {}),
      dim: make(source, { color: dimColor, transparent: true, opacity: 0.6, depthWrite: true }),
      focus: make(source, { emissive: new THREE.Color(0xf4b35b), emissiveIntensity: 0.9 }),
    };
  }
  const slabMaterial = (color, opacity, emissive = null) => new THREE.MeshStandardMaterial({
    color, emissive: emissive ? new THREE.Color(emissive) : new THREE.Color(0x000000),
    emissiveIntensity: emissive ? 0.55 : 1,
    roughness: 0.5, metalness: 0.15, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
  });
  slabPools = {
    dim: slabMaterial(0x8fa8b6, 0.1),
    focus: slabMaterial(0xf4b35b, 0.72, 0xf4b35b),
    edgeDim: new THREE.LineBasicMaterial({ color: 0x8ba1ad, transparent: true, opacity: 0.45 }),
    edgeFocus: new THREE.LineBasicMaterial({ color: 0xf4b35b, transparent: true, opacity: 0.95 }),
  };
}

function applyNightToFloors() {
  if (!floorPools) return;
  for (const [name, pool] of Object.entries(floorPools)) {
    const glass = /glass/i.test(name);
    pool.normal.emissive.set(glass && state.night ? 0xf4b35b : 0x000000);
    pool.normal.emissiveIntensity = glass && state.night ? 0.5 : 1;
    pool.focus.emissive.set(0xf4b35b);
    pool.focus.emissiveIntensity = glass && state.night ? 0.65 : 0.32;
    pool.dim.emissive.set(glass && state.night ? 0xf4b35b : 0x000000);
    pool.dim.emissiveIntensity = glass && state.night ? 0.22 : 1;
  }
}

function buildFloorLayers() {
  if (floorState.built || !state.model || !floorPools) return;
  const started = performance.now();
  const result = buildFloorStack(state.model, TOWERS, floorState.levelsByTower, floorPools, {
    dim: slabPools.dim,
    focus: slabPools.focus,
    edgeDim: slabPools.edgeDim,
    edgeFocus: slabPools.edgeFocus,
  });
  result.root.visible = false;
  scene.add(result.root);
  floorState.stack = result;
  floorState.built = true;
  window.__floorStats = {
    ...result.stats,
    wallMs: Math.round(performance.now() - started),
    levels: Object.fromEntries(TOWER_IDS.map((id) => [id, floorState.levelsByTower.get(id).length])),
  };
}

function setTowerMeshesVisible(visible) {
  if (!state.model) return;
  state.model.traverse((object) => {
    if (!object.isMesh) return;
    if (resolveBuildingId(object, TOWERS)) object.visible = visible;
  });
}

function applyContextDim(active) {
  for (const entry of contextMeshes) {
    const material = entry.mesh.material;
    if (active) {
      material.transparent = true;
      material.opacity = Math.min(entry.opacity, 0.5) * 0.5;
    } else {
      material.transparent = entry.transparent;
      material.opacity = entry.opacity;
    }
  }
}

function renderFloorTowerTabs() {
  $('#floor-tower-tabs').innerHTML = TOWER_IDS.map((id) => {
    const tower = TOWERS[id];
    const levels = floorState.levelsByTower.get(id);
    return `<button data-tower="${id}" class="${id === floorState.towerId ? 'active' : ''}" aria-label="${tower.label} · ${levels.length} 层">
      <b>${id}</b><span>${levels.length} 层</span><em>${tower.H} m</em>
    </button>`;
  }).join('');
}

function renderFloorList() {
  const levels = floorState.levels;
  const reversed = [...levels].reverse();
  $('#floor-list').innerHTML = reversed.map((level) => `
    <li>
      <button data-level="${level.index}" class="${level.index === floorState.levelIndex ? 'active' : ''}" aria-current="${level.index === floorState.levelIndex ? 'true' : 'false'}">
        <b>${level.label}</b>
        <span class="fl-name">${levelShortName(level)}</span>
        <em>${level.y0.toFixed(2)}–${level.y1.toFixed(2)} m</em>
      </button>
    </li>`).join('');
}

function updateFloorListActive() {
  const buttons = $$('#floor-list button[data-level]');
  buttons.forEach((btn) => {
    const active = Number(btn.dataset.level) === floorState.levelIndex;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', active ? 'true' : 'false');
  });
  const activeBtn = $(`#floor-list button[data-level="${floorState.levelIndex}"]`);
  if (activeBtn && activeBtn.scrollIntoView && floorState.active) {
    activeBtn.scrollIntoView({ block: 'nearest' });
  }
}

function setLayoutInfoDefault(plan) {
  if (!plan) return;
  $('#layout-unit').innerHTML = `<span class="unit-summary">${plan.summary.line}</span><em class="unit-hint">悬停 / 点击平面分区查看单元说明</em>`;
}

function showPlanUnit(unitId) {
  const plan = floorState.currentPlan;
  if (!plan) return;
  const unit = plan.units.find((u) => u.id === unitId);
  if (!unit) return;
  floorState.selectedUnitId = unitId;
  $$('#layout-svg .plan-unit').forEach((g) => g.classList.toggle('is-active', g.dataset.unit === unitId));
  const sideText = unit.side ? ` · ${unit.side}向` : '';
  $('#layout-unit').innerHTML = `<span class="unit-id">${unit.id}</span>
    <span class="unit-meta">${unit.use}${sideText} · 估算 ${unit.area} m²</span>
    <p class="unit-note">${unit.note}</p>`;
}

function updateFloorPanels() {
  const tower = TOWERS[floorState.towerId];
  const levels = floorState.levels;
  const level = levels[floorState.levelIndex];
  if (!level) return;

  $('#floor-meta').innerHTML = `<b>${tower.label}</b> · ${levels.length} 层 · 结构楼高 ${tower.H} m · 标准层高 ${FLOOR_HEIGHT} m`;
  $('#floor-card').innerHTML = `
    <span class="floor-card-kicker">${tower.label} · ${level.label} / ${levels.length}</span>
    <strong class="floor-card-name">${level.name}</strong>
    <dl class="floor-card-rows">
      <div><dt>估算标高</dt><dd>${level.y0.toFixed(2)}–${level.y1.toFixed(2)} m</dd></div>
      <div><dt>层高</dt><dd>${level.height.toFixed(2)} m</dd></div>
      <div><dt>建筑面积</dt><dd>≈ ${level.grossArea} m²</dd></div>
      <div><dt>用途</dt><dd>${level.usage}</dd></div>
    </dl>
    <p class="floor-card-note">${level.note}<br /><em>按模型楼高 ${tower.H} m 与 ${FLOOR_HEIGHT} m 标准层高推算</em></p>`;

  const plan = buildFloorPlan(tower, level);
  floorState.currentPlan = plan;
  $('#layout-title').textContent = `${tower.label} · ${level.label}`;
  $('#layout-type').textContent = level.name;
  $('#layout-svg').innerHTML = renderFloorPlanSvg(plan);
  $('#layout-legend').innerHTML = renderFloorLegend(plan);
  setLayoutInfoDefault(plan);

  $('#floor-current').textContent = level.label;
  $('#floor-total').textContent = `/ ${levels.length}`;
  $('#floor-prev').disabled = floorState.levelIndex === 0;
  $('#floor-next').disabled = floorState.levelIndex === levels.length - 1;
  $('#floor-mode-tag-sub').textContent = `${tower.label} · ${level.label} ${levelShortName(level)} · ${level.y0.toFixed(2)}–${level.y1.toFixed(2)} m`;
  const tag = $('#floor-tag-3d');
  tag.textContent = `${tower.label} · ${level.label} · ${levelShortName(level)}`;
}

function applyFloorMaterials() {
  const stack = floorState.stack;
  if (!stack) return;
  for (const [id, towerGroup] of stack.towers) {
    const isFocus = id === floorState.towerId;
    // 楼层模式只保留当前楼座，其它楼座隐藏：减少透明层绘制与 draw call
    towerGroup.group.visible = isFocus;
    towerGroup.bands.forEach((band, index) => {
      const selected = isFocus && index === floorState.levelIndex;
      const meshState = isFocus ? (selected ? 'focus' : 'dim') : 'normal';
      band.meshes.forEach(({ mesh, matName }) => {
        const pool = floorPools[matName];
        if (pool) mesh.material = pool[meshState];
      });
      band.slab.visible = isFocus;
      band.edge.visible = isFocus;
      if (band.frame) band.frame.visible = selected;
      if (isFocus) {
        band.slab.material = selected ? slabPools.focus : slabPools.dim;
        band.edge.material = selected ? slabPools.edgeFocus : slabPools.edgeDim;
      }
    });
  }
}

function applyFloorOffsets() {
  const stack = floorState.stack;
  if (!stack) return;
  for (const [id, towerGroup] of stack.towers) {
    const isFocus = id === floorState.towerId;
    towerGroup.bands.forEach((band, index) => {
      band.group.position.y = isFocus ? index * EXPLODE_GAP * floorState.explode : 0;
    });
  }
}

function tweenExplode(target, { duration = 1000, reframe = false } = {}) {
  floorState.explodeTarget = target;
  floorState.tween = { from: floorState.explode, to: target, start: performance.now(), duration, reframe };
  const button = $('#floor-explode');
  button.innerHTML = target === 1 ? '⇕ <span>合拢</span>' : '⇕ <span>炸开</span>';
  button.setAttribute('aria-pressed', target === 1 ? 'true' : 'false');
}

function flyToFloor(overview = false) {
  const tower = TOWERS[floorState.towerId];
  const levels = floorState.levels;
  const explode = Math.max(floorState.explode, floorState.explodeTarget);
  const cam = overview
    ? floorOverviewCamera(tower, levels, explode, camera.aspect, camera.fov)
    : floorFocusCamera(tower, levels, floorState.levelIndex, explode, camera.aspect, camera.fov);
  fly(cam.position.toArray(), cam.target.toArray(), 1250);
}

function renderFloorUIAll() {
  renderFloorTowerTabs();
  renderFloorList();
  updateFloorPanels();
}

function selectFloorTower(id, { fly: doFly = true, keepLevel = true } = {}) {
  if (!TOWERS[id] || !floorState.levelsByTower.get(id)) return;
  const previous = floorState.levelIndex;
  floorState.towerId = id;
  floorState.levels = floorState.levelsByTower.get(id);
  floorState.levelIndex = keepLevel ? Math.min(previous, floorState.levels.length - 1) : Math.floor(floorState.levels.length / 2);
  floorState.selectedUnitId = null;
  renderFloorTowerTabs();
  renderFloorList();
  updateFloorPanels();
  applyFloorMaterials();
  applyFloorOffsets();
  if (doFly) flyToFloor();
}

function selectFloorLevel(index, { fly: doFly = true } = {}) {
  const count = floorState.levels.length;
  const next = Math.max(0, Math.min(count - 1, index));
  floorState.levelIndex = next;
  floorState.selectedUnitId = null;
  updateFloorListActive();
  updateFloorPanels();
  applyFloorMaterials();
  if (doFly) flyToFloor();
}

async function enterFloorMode({ towerId = null } = {}) {
  if (!state.loaded) {
    toast('三维模型加载中，请稍候…');
    return;
  }
  if (floorState.building || floorState.active) return;
  clearPoiFocus();
  if (!floorState.built) {
    floorState.building = true;
    toast('正在按楼层切分建筑几何…');
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 80)));
    buildFloorLayers();
    floorState.building = false;
  }
  floorState.active = true;
  document.body.classList.add('floor-mode');
  $('.floor-panel').hidden = false;
  $('#layout-panel').hidden = false;
  $('#floor-controls').hidden = false;
  $('#floor-mode-tag').hidden = false;
  $('#nav-floors').classList.add('active');
  $$('.view-controls [data-view]').forEach((el) => el.classList.remove('active'));
  setTowerMeshesVisible(false);
  applyContextDim(true);
  context.visible = false;
  sun.castShadow = false;
  if (upgrade.city) upgrade.city.setAllVisible(false);
  if (upgrade.dressing && upgrade.dressing.group) upgrade.dressing.group.visible = false;
  const floorCityLabels = $('#city-labels');
  if (floorCityLabels) floorCityLabels.style.display = 'none';
  if (upgrade.atmo) upgrade.atmo.setShadows(false);
  floorState.stack.root.visible = true;
  if (towerId && TOWERS[towerId]) floorState.towerId = towerId;
  selectFloorTower(floorState.towerId, { fly: false, keepLevel: true });
  selectFloorLevel(Math.floor(floorState.levels.length / 2), { fly: false });
  floorState.explode = 0;
  floorState.explodeTarget = 0;
  applyFloorOffsets();
  tweenExplode(1, { duration: 1100 });
  applyFloorMaterials();
  flyToFloor(true);
  controls.autoRotate = false;
  $('#rotate').setAttribute('aria-pressed', 'false');
  $('#view-name').textContent = '楼层分层';
}

function exitFloorMode() {
  if (!floorState.active) return;
  floorState.active = false;
  document.body.classList.remove('floor-mode');
  $('.floor-panel').hidden = true;
  $('#layout-panel').hidden = true;
  $('#floor-controls').hidden = true;
  $('#floor-mode-tag').hidden = true;
  $('#floor-tag-3d').hidden = true;
  $('#nav-floors').classList.remove('active');
  floorState.tween = null;
  floorState.explode = 0;
  floorState.explodeTarget = 0;
  if (floorState.stack) {
    floorState.stack.root.visible = false;
    applyFloorOffsets();
  }
  setTowerMeshesVisible(true);
  applyContextDim(false);
  context.visible = true;
  sun.castShadow = true;
  if (upgrade.city) upgrade.city.setAllVisible(true);
  if (upgrade.dressing && upgrade.dressing.group) upgrade.dressing.group.visible = true;
  const exitCityLabels = $('#city-labels');
  if (exitCityLabels) exitCityLabels.style.display = '';
  if (upgrade.atmo) upgrade.atmo.setShadows(true);
  $('#floor-plan-toggle').classList.remove('active');
  $('#layout-panel').classList.remove('open');
  document.body.classList.remove('floor-plan-open');
  $('#floor-explode').innerHTML = '⇕ <span>合拢</span>';
  setView('perspective');
}

/* ------------------------------- 楼层 UI 事件 --------------------------- */
$('#floor-tower-tabs').addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-tower]');
  if (btn) selectFloorTower(btn.dataset.tower);
});
$('#floor-list').addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-level]');
  if (btn) selectFloorLevel(Number(btn.dataset.level));
});
$('#floor-prev').addEventListener('click', () => selectFloorLevel(floorState.levelIndex - 1));
$('#floor-next').addEventListener('click', () => selectFloorLevel(floorState.levelIndex + 1));
$('#floor-exit').addEventListener('click', () => exitFloorMode());
$('#floor-explode').addEventListener('click', () => {
  const target = floorState.explodeTarget === 1 ? 0 : 1;
  tweenExplode(target, { reframe: true });
});
$('#floor-plan-toggle').addEventListener('click', () => {
  const panel = $('#layout-panel');
  const open = !panel.classList.contains('open');
  panel.classList.toggle('open', open);
  document.body.classList.toggle('floor-plan-open', open);
  $('#floor-plan-toggle').classList.toggle('active', open);
  if (open) updateFloorPanels();
});

const layoutSvgHost = $('#layout-svg');
layoutSvgHost.addEventListener('mouseover', (event) => {
  const g = event.target.closest && event.target.closest('.plan-unit');
  if (g) showPlanUnit(g.dataset.unit);
});
layoutSvgHost.addEventListener('mouseleave', () => setLayoutInfoDefault(floorState.currentPlan));
layoutSvgHost.addEventListener('click', (event) => {
  const g = event.target.closest && event.target.closest('.plan-unit');
  if (g) showPlanUnit(g.dataset.unit);
});

window.addEventListener('keydown', (event) => {
  if (!floorState.active) return;
  if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
    event.preventDefault();
    selectFloorLevel(floorState.levelIndex + 1);
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
    event.preventDefault();
    selectFloorLevel(floorState.levelIndex - 1);
  } else if (event.key === 'Escape') {
    exitFloorMode();
  }
});

/* ------------------------------ 指针拾取 -------------------------------- */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = null;
renderer.domElement.addEventListener('pointerdown', (event) => {
  pointerDown = [event.clientX, event.clientY];
  state.flight = null;
});
renderer.domElement.addEventListener('pointerup', (event) => {
  if (!state.model || !pointerDown || Math.hypot(event.clientX - pointerDown[0], event.clientY - pointerDown[1]) > 5) return;
  const rect = host.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (floorState.active && floorState.stack) {
    const hits = raycaster.intersectObject(floorState.stack.root, true);
    const hit = hits.find((h) => h.object.userData && h.object.userData.building === floorState.towerId);
    if (hit) selectFloorLevel(hit.object.userData.levelIndex);
    return;
  }
  const hit = raycaster.intersectObject(state.model, true).find((h) => TOWERS[h.object.userData.building]);
  if (hit) selectBuilding(hit.object.userData.building);
});

/* ------------------------------- 时间显示 ------------------------------- */
function updateClock() {
  $('#clock').textContent = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date());
}
updateClock();
setInterval(updateClock, 1000);

/* -------------------------------- 主循环 -------------------------------- */
const projected = new THREE.Vector3();
let frameCount = 0;
let lastFrameAt = performance.now();
let fpsFrames = 0;
let fpsClock = performance.now();

function updateFloorTag3d() {
  const tag = $('#floor-tag-3d');
  if (!floorState.active || !floorState.levels.length) {
    tag.hidden = true;
    return;
  }
  const tower = TOWERS[floorState.towerId];
  const level = floorState.levels[floorState.levelIndex];
  const y = (level.y0 + level.y1) / 2 + floorState.levelIndex * EXPLODE_GAP * floorState.explode;
  projected.set(tower.x + tower.w * 0.62, y, tower.z + tower.d * 0.1).project(camera);
  const width = host.clientWidth;
  const height = host.clientHeight;
  const x = (projected.x * 0.5 + 0.5) * width;
  const sy = (-projected.y * 0.5 + 0.5) * height;
  const visible = projected.z < 1 && x > 10 && x < width - 10 && sy > 20 && sy < height - 80;
  tag.hidden = !visible;
  if (visible) {
    tag.style.left = `${x}px`;
    tag.style.top = `${sy}px`;
  }
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.06, Math.max(0.0001, (now - lastFrameAt) / 1000));
  lastFrameAt = now;

  if (state.flight) {
    const t = Math.min(1, (now - state.flight.start) / state.flight.duration);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(state.flight.from, state.flight.to, ease);
    controls.target.lerpVectors(state.flight.tfrom, state.flight.tto, ease);
    if (t === 1) state.flight = null;
  }

  if (floorState.tween) {
    const tween = floorState.tween;
    const t = Math.min(1, (now - tween.start) / tween.duration);
    floorState.explode = tween.from + (tween.to - tween.from) * easeInOutCubic(t);
    applyFloorOffsets();
    if (t >= 1) {
      floorState.explode = tween.to;
      floorState.tween = null;
      if (tween.reframe && floorState.active) flyToFloor();
    }
  }

  controls.update();

  for (const id of TOWER_IDS) {
    const tower = TOWERS[id];
    const label = labelNodes[id];
    projected.set(tower.x, tower.top + 3.2, tower.z).project(camera);
    const x = (projected.x * 0.5 + 0.5) * host.clientWidth;
    const y = (-projected.y * 0.5 + 0.5) * host.clientHeight;
    const visible = state.loaded
      && !floorState.active
      && projected.z < 1
      && x > 10 && x < host.clientWidth - 10 && y > 0 && y < host.clientHeight - 90;
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    label.style.display = visible ? 'block' : 'none';
  }

  updateFloorTag3d();
  if (upgrade.atmo && upgrade.atmo.update) upgrade.atmo.update(dt, now);
  if (upgrade.city && upgrade.city.update) upgrade.city.update(dt, now);
  if (upgrade.dressing && upgrade.dressing.update) upgrade.dressing.update(dt, now);
  if (poiFocus) poiFocus.update(dt);
  if (upgrade.atmo && upgrade.atmo.render) upgrade.atmo.render();
  else renderer.render(scene, camera);

  frameCount += 1;
  fpsFrames += 1;
  if (now - fpsClock > 1000) {
    window.__fps = Math.round((fpsFrames * 1000) / (now - fpsClock));
    fpsFrames = 0;
    fpsClock = now;
  }
  if (frameCount % 30 === 0) {
    window.__renderInfo = {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      fps: window.__fps || null,
    };
  }
}
requestAnimationFrame(animate);

/* --------------------------- 升级模块启动 ------------------------------ */
applyTimePreset('day');
initUpgradeModules();
setTimeout(() => {
  upgrade.timedOut = true;
  checkLoadingDone();
}, 20000);

/* -------------------------------- 对外 API ------------------------------ */
window.__fuhua = {
  setView,
  selectBuilding,
  applyTimePreset,
  setLayer,
  focusPoi,
  get selected() { return state.selected; },
  get night() { return state.night; },
  get time() { return state.time; },
  get autoRotate() { return controls.autoRotate; },
  get loaded() { return state.loaded; },
};
window.__upgrade = {
  get ready() { return upgrade.modulesReady; },
  get city() { return upgrade.city; },
  get atmo() { return upgrade.atmo; },
  get dressing() { return upgrade.dressing; },
  get time() { return state.time; },
  get layers() { return upgrade.city ? upgrade.city.layers : null; },
  setTime: applyTimePreset,
  cycleTime: () => {
    const order = ['day', 'dusk', 'night'];
    return applyTimePreset(order[(order.indexOf(state.time) + 1) % order.length]);
  },
  setLayer,
  focusPoi,
  clearPoiFocus,
  get focusedPoi() {
    return poiFocus && poiFocus.poi ? poiFocus.poi : null;
  },
  get stats() {
    return {
      city: upgrade.city ? upgrade.city.stats : null,
      atmo: state.time,
      dressing: upgrade.dressing ? upgrade.dressing.stats : null,
      render: window.__renderInfo || null,
      fps: window.__fps || null,
    };
  },
};
window.__fuhuaFloor = {
  enter: (towerId) => enterFloorMode({ towerId }),
  exit: () => exitFloorMode(),
  selectTower: async (id) => {
    if (!floorState.active) await enterFloorMode({ towerId: id });
    selectFloorTower(id);
  },
  selectLevel: (index) => selectFloorLevel(index),
  explode: (on) => tweenExplode(on ? 1 : 0, { reframe: true }),
  get state() {
    return {
      active: floorState.active,
      tower: floorState.towerId,
      level: floorState.levelIndex,
      levelLabel: floorState.levels[floorState.levelIndex]?.label,
      levels: floorState.levels.length,
      explode: Number(floorState.explode.toFixed(3)),
      exploded: floorState.explodeTarget === 1,
      planUnits: floorState.currentPlan ? floorState.currentPlan.units.length : 0,
    };
  },
  get busy() { return Boolean(state.flight || floorState.tween || floorState.building); },
  get stats() { return window.__floorStats || null; },
};
