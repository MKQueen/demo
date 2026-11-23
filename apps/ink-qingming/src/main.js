/**
 * main.js —— 「清明上河图 · 汴京长卷」的起笔与收笔。
 *
 * 流程：绢底 → 汴河虹桥 → 郊野 → 城门街市 → 远树雾带 → 人
 *      → 展卷相机 → 每帧：镜头沿卷面走、人走、水动、雾移 → 水墨后期 → 上屏。
 */
import * as THREE from 'three';
import * as P from './lib/palette.js';
import { createTextureSet } from './lib/textures.js';
import { makeMaterials } from './lib/materials.js';
import { InkPost } from './lib/ink.js';
import { buildWorld } from './world/index.js';
import { CameraScroll } from './camera-scroll.js';
import { CameraOverview } from './camera-overview.js';
import { CityLabels } from './labels-city.js';
import { SceneLabels } from './labels.js';
import { UI } from './ui.js';
import { SCENES, SCENE_BY_ID, CAMERA, CITY_LANDMARKS, OVERVIEW } from './layout.js';

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
scene.fog = new THREE.FogExp2(0xf7f5f0, 0.0019);
const FOG = { scroll: 0.0019, city: 0.00032 };

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 1.6, 3600);

/* -------------------------------------------------------------------------- */
/*  光                                                                          */
/* -------------------------------------------------------------------------- */

const hemi = new THREE.HemisphereLight(0xfff8ec, 0x77776a, 2.6);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffffff, 4.2);
sun.position.set(120, 90, 60);
scene.add(sun);

const fill = new THREE.DirectionalLight(0xdfe6da, 0.55);
fill.position.set(-140, 60, 80);
scene.add(fill);

const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

/* -------------------------------------------------------------------------- */
/*  纹理 / 材质 / 后期                                                          */
/* -------------------------------------------------------------------------- */

const tex = createTextureSet();
const mats = makeMaterials(tex);
const post = new InkPost({ renderer, paperTexture: tex.paper });
post.setSize(window.innerWidth, window.innerHeight, PIXEL_RATIO);
post.ink = 1.0;

/* -------------------------------------------------------------------------- */
/*  世界                                                                        */
/* -------------------------------------------------------------------------- */

const ticks = [];
const state = { ink: 1.0, playing: true, mode: 'scroll' };
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
} catch (error) {
  console.error('[ink-qingming] 世界构建失败：', error);
}

/* -------------------------------------------------------------------------- */
/*  展卷相机                                                                    */
/* -------------------------------------------------------------------------- */

const rig = new CameraScroll(camera, canvas);
const overview = new CameraOverview(camera, canvas);
rig.setT(0.02, { instant: true });
rig.setAuto(false); // 开场先停住，点了「起卷」再自动展
rig.targetDist = 150; // 起卷时由远及近
rig.dist = 150;

/* -------------------------------------------------------------------------- */
/*  标签 / 界面                                                                 */
/* -------------------------------------------------------------------------- */

const labels = new SceneLabels({
  container: document.getElementById('labels'),
  camera,
  scenes: SCENES,
  onPick: (sceneDef) => {
    ui.showCard(sceneDef);
    rig.setT(sceneDef.t);
    labels.setActive(sceneDef.id);
  },
});

const cityLabels = new CityLabels({
  container: document.getElementById('labels'),
  camera,
  landmarks: CITY_LANDMARKS,
  onPick: (lm) => {
    overview.focusAt(lm.x, lm.z, lm.id === 'huangcheng' ? 260 : 190);
  },
});

const ui = new UI({
  scenes: SCENES,
  onStart: () => {
    rig.targetDist = 96;
    rig.setAuto(true);
    labels.setEnabled(true);
  },
  onPlay: () => {
    state.playing = !state.playing;
    rig.setAuto(state.playing);
    ui.setPlaying(state.playing);
  },
  onScene: (id) => {
    const s = SCENE_BY_ID[id];
    if (!s) return;
    rig.setT(s.t);
    labels.setActive(id);
    ui.showCard(s);
  },
  onCloseCard: () => {
    ui.hideCard();
    labels.setActive(null);
  },
  onGo: (sceneDef) => {
    if (!sceneDef) return;
    rig.setT(sceneDef.t);
    ui.hideCard();
    labels.setActive(sceneDef.id);
  },
  onCenter: () => {
    rig.setT(0.5);
    ui.hideCard();
    labels.setActive(null);
  },
  onInk: (v) => {
    state.ink = v;
    post.ink = v;
  },
  onRuler: (t) => {
    rig.setAuto(false);
    state.playing = false;
    ui.setPlaying(false);
    rig.setT(t);
  },
  onLabels: (on) => labels.setEnabled(on),
  onMode: () => {
    const city = state.mode !== 'city';
    state.mode = city ? 'city' : 'scroll';
    ui.setMode(city);
    rig.enabled = !city;
    overview.enabled = city;
    labels.setEnabled(!city);
    cityLabels.setEnabled(city);
    if (city) {
      overview.reset();
    } else {
      rig.setT(rig.t);
    }
  },
}, SCENES);


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

  if (state.mode === 'city') {
    if (camera.near !== 14) { camera.near = 14; camera.updateProjectionMatrix(); }
    scene.fog.density += (FOG.city - scene.fog.density) * (1 - Math.exp(-dt * 2.2));
    overview.update(dt);
    cityLabels.update();
  } else {
    if (camera.near !== 1.6) { camera.near = 1.6; camera.updateProjectionMatrix(); }
    scene.fog.density += (FOG.scroll - scene.fog.density) * (1 - Math.exp(-dt * 2.2));
    rig.update(dt);
    labels.update(rig);
    ui.setProgress(rig.t);
  }

  for (let i = 0; i < ticks.length; i++) {
    try {
      ticks[i](elapsed, dt);
    } catch (error) {
      console.error('[ink-qingming] tick 失败：', error);
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
/*  调试接口                                                                    */
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
  setT(t) {
    rig.setT(t);
  },
  jumpTo(sceneId) {
    const s = SCENE_BY_ID[sceneId];
    if (s) rig.setT(s.t, { instant: true });
  },
  setView(v) {
    if (v.dist != null) rig.targetDist = v.dist;
    if (v.elevation != null) rig.targetElevation = v.elevation;
    if (v.azimuth != null) rig.targetAzimuth = v.azimuth;
    if (v.t != null) rig.setT(v.t);
  },
  setMode(m) {
    if ((m === 'city') !== (state.mode === 'city')) {
      state.mode = m === 'city' ? 'city' : 'scroll';
      ui.setMode(m === 'city');
      rig.enabled = m !== 'city';
      overview.enabled = m === 'city';
      labels.setEnabled(m !== 'city');
      cityLabels.setEnabled(m === 'city');
      if (m === 'city') overview.reset();
    }
  },
  overview,
  setPlaying(v) {
    state.playing = !!v;
    rig.setAuto(state.playing);
    ui.setPlaying(state.playing);
  },
  ink(v) {
    state.ink = v;
    post.ink = v;
  },
  stats() {
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
};

frame();
