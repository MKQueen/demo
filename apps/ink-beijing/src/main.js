/**
 * main.js —— 「水墨北京」的起笔与收笔。
 *
 * 流程：建场景 → 生成程序化纹理与材质 → 拼装世界 → 挂上相机/标签/界面
 *      → 每帧：相机动 → 世界动（水、鸟、雾、灯）→ 水墨后期 → 上屏。
 *
 * 真源坐标与文案都在 layout.js；各 world 模块只负责把地画出来。
 */
import * as THREE from 'three';
import * as P from './lib/palette.js';
import { createTextureSet } from './lib/textures.js';
import { makeMaterials } from './lib/materials.js';
import { InkPost } from './lib/ink.js';
import { buildWorld } from './world/index.js';
import { CameraRig } from './camera-rig.js';
import { Labels } from './labels.js';
import { UI } from './ui.js';
import { createWeather } from './weather.js';
import { HOME_VIEW, SCENIC_VIEW, COUNTRYSIDE_VIEW, LANDMARKS, LANDMARK_BY_ID, COPY, u, h } from './layout.js';

const isMobile = window.matchMedia('(max-width: 720px), (pointer: coarse)').matches;
const PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.85);

/* -------------------------------------------------------------------------- */
/*  基础三件套                                                                  */
/* -------------------------------------------------------------------------- */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(PIXEL_RATIO);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(P.PAPER);
scene.fog = new THREE.FogExp2(P.MIST, P.SKY.dawn.fogDensity);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.4, 4200);

/* -------------------------------------------------------------------------- */
/*  光：一盏天光、一轮低日                                                        */
/* -------------------------------------------------------------------------- */

const hemi = new THREE.HemisphereLight(P.SKY.dawn.hemiSky, P.SKY.dawn.hemiGround, P.SKY.dawn.hemiIntensity);
scene.add(hemi);

const sun = new THREE.DirectionalLight(P.SKY.dawn.sunColor, P.SKY.dawn.sunIntensity);
sun.position.set(240, 110, 320);
scene.add(sun);

const fill = new THREE.DirectionalLight(0xcfd8d2, 1.1);
fill.position.set(-260, 90, -240);
scene.add(fill);

const ambient = new THREE.AmbientLight(0xfff3e2, 0.55);
scene.add(ambient);

/* -------------------------------------------------------------------------- */
/*  程序化纹理 / 材质 / 后期                                                     */
/* -------------------------------------------------------------------------- */

const tex = createTextureSet();
const mats = makeMaterials(tex);
const post = new InkPost({ renderer, paperTexture: tex.paper });
post.setSize(window.innerWidth, window.innerHeight, PIXEL_RATIO);

/* -------------------------------------------------------------------------- */
/*  世界                                                                        */
/* -------------------------------------------------------------------------- */

const ticks = [];
const state = { time: 'dawn', ink: 1, weather: 'clear' };
const ctx = {
  tex,
  mats,
  scene,
  camera,
  renderer,
  state,
  quality: isMobile ? 'low' : 'high',
  onTick(fn) {
    if (typeof fn === 'function') ticks.push(fn);
  },
};

let world = null;
try {
  world = buildWorld(ctx);
  scene.add(world);
  canvas.dataset.landscape = JSON.stringify(world.getObjectByName('outskirts')?.userData.landscape || {});
} catch (error) {
  console.error('[ink-beijing] 世界构建失败：', error);
}

// 雪 + 炊烟
const weather = createWeather({ scene, camera, world, tex });

/* -------------------------------------------------------------------------- */
/*  相机                                                                        */
/* -------------------------------------------------------------------------- */

const rig = new CameraRig(camera, canvas);
rig.setHome(HOME_VIEW);

// 开场：从城南高空缓缓推入中轴，而不是从头顶垂直俯冲
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const START_VIEW = { ...SCENIC_VIEW, dist: isMobile ? 94 : 68, elevation: 0.28 };
rig.setView(START_VIEW, { instant: true });

/* -------------------------------------------------------------------------- */
/*  地标标签 / 界面                                                              */
/* -------------------------------------------------------------------------- */

let ui = null;
const labels = new Labels({
  container: document.getElementById('labels'),
  camera,
  landmarks: LANDMARKS,
  onPick: (landmark) => {
    labels.setActive(landmark.id);
    ui?.showCard(landmark);
  },
});

ui = new UI({
  end: () => {},
  onStart: () => {
    rig.setView({ ...SCENIC_VIEW, dist: isMobile ? 86 : SCENIC_VIEW.dist }, { duration: reducedMotion ? 0.01 : 4.2 });
    labels.setEnabled(true);
  },
  onCenter: () => {
    rig.reset(1.8);
    labels.setActive(null);
    ui.hideCard();
  },
  onScenic: () => {
    rig.setView({ ...SCENIC_VIEW, dist: isMobile ? 86 : SCENIC_VIEW.dist }, { duration: reducedMotion ? 0.01 : 2.4 });
    labels.setActive(null);
    ui.hideCard();
  },
  onCountry: () => {
    rig.setView(COUNTRYSIDE_VIEW, { duration: reducedMotion ? 0.01 : 2.4 });
    labels.setActive(null);
    ui.hideCard();
  },
  onLabels: () => {
    const hidden = document.body.classList.toggle('hide-labels');
    document.getElementById('btn-labels').setAttribute('aria-pressed', String(hidden));
    document.getElementById('btn-labels').textContent = hidden ? '显签' : '藏签';
  },
  onTime: () => {
    state.time = state.time === 'dawn' ? 'dusk' : 'dawn';
    ui.setTime(state.time === 'dusk');
  },
  onSnow: () => {
    state.weather = state.weather === 'clear' ? 'snow' : 'clear';
    ui.setWeather(state.weather === 'snow');
  },
  onInk: (v) => {
    state.ink = v;
    post.ink = v;
  },
  onCloseCard: () => {
    ui.hideCard();
    labels.setActive(null);
  },
  onGo: (landmark) => {
    labels.setActive(landmark.id);
    rig.focusLandmark(landmark);
    ui.hideCard();
  },
});

document.body.dataset.time = 'dawn';

/* -------------------------------------------------------------------------- */
/*  晨暮过渡                                                                    */
/* -------------------------------------------------------------------------- */

const skyA = {
  paper: new THREE.Color(P.SKY.dawn.paper),
  fog: new THREE.Color(P.SKY.dawn.fog),
  sun: new THREE.Color(P.SKY.dawn.sunColor),
  hemiSky: new THREE.Color(P.SKY.dawn.hemiSky),
  hemiGround: new THREE.Color(P.SKY.dawn.hemiGround),
};
const skyB = {
  paper: new THREE.Color(P.SKY.dusk.paper),
  fog: new THREE.Color(P.SKY.dusk.fog),
  sun: new THREE.Color(P.SKY.dusk.sunColor),
  hemiSky: new THREE.Color(P.SKY.dusk.hemiSky),
  hemiGround: new THREE.Color(P.SKY.dusk.hemiGround),
};
const SUN_A = new THREE.Vector3(240, 110, 320);
const SUN_B = new THREE.Vector3(-280, 46, 150);
let skyT = 0;
let snowT = 0;

const _c = new THREE.Color();
function updateSky(dt) {
  const target = state.time === 'dusk' ? 1 : 0;
  skyT += (target - skyT) * (1 - Math.exp(-dt * 3.2));
  if (Math.abs(target - skyT) < 0.001) skyT = target;

  scene.background.copy(_c.lerpColors(skyA.paper, skyB.paper, skyT));
  scene.fog.color.copy(_c.lerpColors(skyA.fog, skyB.fog, skyT));
  scene.fog.density = P.SKY.dawn.fogDensity + (P.SKY.dusk.fogDensity - P.SKY.dawn.fogDensity) * skyT;
  hemi.color.copy(_c.lerpColors(skyA.hemiSky, skyB.hemiSky, skyT));
  hemi.groundColor.copy(_c.lerpColors(skyA.hemiGround, skyB.hemiGround, skyT));
  hemi.intensity = P.SKY.dawn.hemiIntensity + (P.SKY.dusk.hemiIntensity - P.SKY.dawn.hemiIntensity) * skyT;
  ambient.intensity = 0.55 + (0.34 - 0.55) * skyT;
  fill.intensity = 1.1 + (0.5 - 1.1) * skyT;
  sun.color.copy(_c.lerpColors(skyA.sun, skyB.sun, skyT));
  sun.intensity = P.SKY.dawn.sunIntensity + (P.SKY.dusk.sunIntensity - P.SKY.dawn.sunIntensity) * skyT;
  sun.position.lerpVectors(SUN_A, SUN_B, skyT).normalize().multiplyScalar(420);
  post.dusk = skyT * (1.0 - snowT * 0.92);

  // —— 雪：在晨/暮天色上再压一层冷白 ——
  const snowTarget = state.weather === 'snow' ? 1 : 0;
  snowT += (snowTarget - snowT) * (1 - Math.exp(-dt * 2.2));
  if (Math.abs(snowTarget - snowT) < 0.002) snowT = snowTarget;
  if (snowT > 0.002) {
    const sn = P.SNOW;
    scene.background.lerp(_c.set(sn.paper), snowT * 0.9);
    scene.fog.color.lerp(_c.set(sn.fog), snowT * 0.9);
    scene.fog.density = scene.fog.density * (1 - snowT * 0.25) + sn.fogDensity * snowT * 0.25;
    hemi.color.lerp(_c.set(sn.hemiSky), snowT * 0.8);
    hemi.groundColor.lerp(_c.set(sn.hemiGround), snowT * 0.8);
    hemi.intensity = hemi.intensity * (1 - snowT) + sn.hemiIntensity * snowT;
    ambient.intensity = ambient.intensity * (1 - snowT) + sn.ambient * snowT;
    fill.intensity = fill.intensity * (1 - snowT) + sn.fill * snowT;
    sun.color.lerp(_c.set(sn.sunColor), snowT * 0.9);
    sun.intensity = sun.intensity * (1 - snowT) + sn.sunIntensity * snowT;
  }
  post.snow = snowT;
  weather.update(elapsed, dt, { snow: snowT, dusk: skyT });
  document.body.dataset.weather = state.weather;
  if (skyT > 0.5 && document.body.dataset.time !== 'dusk') document.body.dataset.time = 'dusk';
  if (skyT <= 0.5 && document.body.dataset.time !== 'dawn') document.body.dataset.time = 'dawn';
}

/* -------------------------------------------------------------------------- */
/*  主循环                                                                      */
/* -------------------------------------------------------------------------- */

const clock = new THREE.Clock();
let elapsed = 0;
let firstFrame = true;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.06);
  elapsed += dt;

  rig.update(dt);
  updateSky(dt);
  labels.update(rig.dist);

  for (let i = 0; i < ticks.length; i++) {
    try {
      ticks[i](elapsed, dt);
    } catch (error) {
      console.error('[ink-beijing] tick 失败：', error);
      ticks.splice(i, 1);
      i--;
    }
  }

  post.render(scene, camera, elapsed);

  if (firstFrame) {
    firstFrame = false;
    ui.ready();
    document.body.classList.add('is-loaded');
  }
}

/* -------------------------------------------------------------------------- */
/*  尺寸                                                                        */
/* -------------------------------------------------------------------------- */

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(PIXEL_RATIO);
  renderer.setSize(w, h);
  post.setSize(w, h, PIXEL_RATIO);
}
window.addEventListener('resize', onResize);

/* -------------------------------------------------------------------------- */
/*  调试接口：给截图脚本和模块作者用                                              */
/* -------------------------------------------------------------------------- */

window.__ink = {
  THREE,
  scene,
  camera,
  renderer,
  rig,
  labels,
  ui,
  post,
  state,
  get world() {
    return world;
  },
  focus(id, { card = true } = {}) {
    const landmark = LANDMARK_BY_ID[id];
    if (!landmark) return false;
    labels.setActive(id);
    rig.focusLandmark(landmark);
    if (card) ui.showCard(landmark);
    return true;
  },
  setView(view) {
    rig.setView(view, { duration: 0.8 });
  },
  setWeather(w) {
    state.weather = w === 'snow' ? 'snow' : 'clear';
    ui.setWeather(state.weather === 'snow');
  },
  setTime(time) {
    if (time !== 'dawn' && time !== 'dusk') return;
    state.time = time;
    ui.setTime(time === 'dusk');
    skyT = time === 'dusk' ? 1 : 0;
    updateSky(0.016);
  },
  ink(v) {
    state.ink = v;
    post.ink = v;
  },
  stats() {
    // 直接渲一遍场景（不经过后期），统计真实 draw call / 三角形
    const r = renderer;
    r.setRenderTarget(null);
    r.info.reset();
    r.render(scene, camera);
    return {
      calls: r.info.render.calls,
      triangles: r.info.render.triangles,
      points: r.info.render.points,
      lines: r.info.render.lines,
      programs: r.info.programs.length,
      geometries: r.info.memory.geometries,
      textures: r.info.memory.textures,
    };
  },
  copy: COPY,
  weather,
};

frame();
