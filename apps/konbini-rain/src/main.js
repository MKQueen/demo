/**
 * main.js —— 雨夜便利店 · 微缩模型的搭台与上灯。
 *
 * 流程：建渲染器 / 相机 / 控制器 → 天光与雾 → 搭底座、地面、便利店、街景、
 *      雨与动态 → 三渲二后期 → 每帧更新动画。
 *
 * 所有尺寸/颜色来自 config.js；各 world 模块只负责把东西摆进来。
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';
import { C, E, L, VIEWS } from './config.js';
import { createPost } from './lib/post.js';
import { glowTexture, glowSprite } from './lib/toon.js';
import { buildBase } from './world/base.js';
import { buildGround } from './world/ground.js';
import { buildStore } from './world/store.js';
import { buildInterior } from './world/interior.js';
import { buildInteriorDetails } from './world/interior-details.js';
import { buildTown } from './world/town.js';
import { buildFx } from './world/fx.js';

/* -------------------------------------------------------------------------- */
/*  参数 & 渲染器                                                              */
/* -------------------------------------------------------------------------- */

const params = new URLSearchParams(location.search);
const isMobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const STILL = params.has('still');
let FREEZE = params.has('freeze');
const FORCED_TIME = params.has('t') ? Number(params.get('t')) : null;
const QUALITY = {
  isMobile,
  dpr: Math.min(devicePixelRatio || 1, isMobile ? 1.25 : 2),
  shadows: !isMobile,
  bloom: !isMobile ? 1 : 0.72,
};

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
  stencil: false,
});
renderer.setPixelRatio(QUALITY.dpr);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = QUALITY.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(C.fog, 0.0125);

const camera = new THREE.PerspectiveCamera(VIEWS.hero.fov, innerWidth / innerHeight, 0.08, 220);
// layer 1 = 底座/地块这些「地面以下」的几何，平面反射相机（仅 layer 0）会跳过它们
camera.layers.enable(1);

/* -------------------------------------------------------------------------- */
/*  天幕：深蓝渐变 + 地平线一点城市暖光                                         */
/* -------------------------------------------------------------------------- */

const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    uTop: { value: new THREE.Color(C.bgTop) },
    uHorizon: { value: new THREE.Color(C.bgHorizon) },
    uBottom: { value: new THREE.Color(C.bgBottom) },
    uGlow: { value: new THREE.Color('#3a2b2a') },
  },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize( position );
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uTop;
    uniform vec3 uHorizon;
    uniform vec3 uBottom;
    uniform vec3 uGlow;
    varying vec3 vDir;
    void main() {
      float h = vDir.y;
      vec3 col = mix( uBottom, uHorizon, smoothstep( -0.25, 0.03, h ) );
      col = mix( col, uTop, smoothstep( 0.02, 0.6, h ) );
      // 地平线处的一团城市暖光（南侧偏右）
      float glow = smoothstep( 0.45, 1.0, -vDir.z * 0.5 + 0.5 ) * smoothstep( 0.22, -0.05, h ) * smoothstep( -0.35, 0.02, h );
      col += uGlow * glow * 0.5;
      gl_FragColor = vec4( col, 1.0 );
    }
  `,
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 24), skyMat);
sky.renderOrder = -10;
scene.add(sky);

// 底座下方的一团柔和投影，让模型「落在」暗色摄影棚里
const blobTex = glowTexture();
const blob = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 22),
  new THREE.MeshBasicMaterial({
    map: blobTex,
    color: '#01030a',
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.NormalBlending,
  }),
);
blob.rotation.x = -Math.PI / 2;
blob.position.y = -1.2;
scene.add(blob);

/* -------------------------------------------------------------------------- */
/*  灯光                                                                       */
/* -------------------------------------------------------------------------- */

const hemi = new THREE.HemisphereLight(C.hemiSky, C.hemiGround, 0.38);
scene.add(hemi);

const moonLight = new THREE.DirectionalLight(C.moon, 0.72);
moonLight.position.set(-5, 14, 10);
moonLight.castShadow = QUALITY.shadows;
moonLight.shadow.mapSize.set(2048, 2048);
moonLight.shadow.camera.left = -12;
moonLight.shadow.camera.right = 12;
moonLight.shadow.camera.top = 12;
moonLight.shadow.camera.bottom = -12;
moonLight.shadow.camera.near = 1;
moonLight.shadow.camera.far = 60;
moonLight.shadow.bias = -0.0005;
moonLight.shadow.normalBias = 0.025;
scene.add(moonLight);
scene.add(moonLight.target);
moonLight.target.position.set(0, 0, 0.2);

// 一点点从地底反上来的冷光，避免阴影死黑
const bounce = new THREE.DirectionalLight('#365072', 0.18);
bounce.position.set(3, -4, -6);
scene.add(bounce);

// 来自镜头方向的极淡冷色补光：让夜景暗部也有层次（三渲二动画常见的 ambient 做法）
const fill = new THREE.DirectionalLight('#5c7cae', 0.3);
fill.position.set(9, 6, 12);
scene.add(fill);

// 来自旧楼背面/西侧的冷色补光：绕到模型后方时不至于只看到一堵死黑的墙
const backFill = new THREE.DirectionalLight('#6b8fc4', 0.5);
backFill.position.set(-9, 5.5, -4);
scene.add(backFill);

const pointLights = [];
const lightMap = { interior: [] };
function addPoint(cfg, name = '') {
  const color = C[cfg.color] || cfg.color;
  const light = new THREE.PointLight(color, cfg.intensity, cfg.distance, cfg.decay ?? 2);
  light.position.set(cfg.x, cfg.y, cfg.z);
  light.castShadow = false;
  scene.add(light);
  pointLights.push(light);
  if (name) lightMap[name] = light;
  return light;
}
const SO = E.storeOffset;
for (const cfg of L.lights.interior) lightMap.interior.push(addPoint({ ...cfg, x: cfg.x + SO.dx, z: cfg.z + SO.dz }));
addPoint(L.lights.canopy, 'canopy');
addPoint(L.lights.sign, 'sign');
addPoint({ ...L.lights.vending, x: L.lights.vending.x + SO.dx, z: L.lights.vending.z + SO.dz });
for (const cfg of E.townLights) addPoint(cfg);

// 店门口雨棚下的暖光聚光：在湿人行道上打出一片温暖的「动画光池」
const canopySpot = new THREE.SpotLight('#ffcf9a', 7.5, 7.5, 0.95, 0.8, 1.7);
canopySpot.position.set(0.45 + E.storeOffset.dx, 2.55, 1.35 + E.storeOffset.dz);
canopySpot.target.position.set(0.45 + E.storeOffset.dx, 0, 2.7 + E.storeOffset.dz);
scene.add(canopySpot);
scene.add(canopySpot.target);

// 路灯下的暖光聚光：让街角路面更亮，倒影更有层次
const lampSpot = new THREE.SpotLight('#ffb45e', 12, 12, 0.85, 0.72, 1.7);
lampSpot.position.set(2.0, 4.3, 2.2);
lampSpot.target.position.set(2.0, 0, 1.6);
scene.add(lampSpot);
scene.add(lampSpot.target);

/* -------------------------------------------------------------------------- */
/*  共享 handles / 世界搭建                                                    */
/* -------------------------------------------------------------------------- */

const handles = {
  pointLights,
  lightMap,
  moonLight,
  door: null,
  glass: null,
  flickerMats: [],
  flickerLights: [],
  dripPoints: [],
  steamSources: [],
  update: [],
  quality: QUALITY,
  time: { value: 0 },
  debug: {},
};

const root = new THREE.Group();
root.name = 'diorama';
scene.add(root);

const mods = [];
function build(name, fn) {
  const mod = fn({ root, scene, handles, quality: QUALITY, params }) || {};
  mods.push(mod);
  if (mod.group) root.add(mod.group);
  return mod;
}

build('base', buildBase);
build('ground', buildGround);
const storeMod = build('store', buildStore);
const interiorMod = build('interior', buildInterior);
const detailsMod = params.get('details') !== '0' ? build('interior-details', buildInteriorDetails) : null;
// 旧便利店整体平移到小镇东北角；店内所有内景模块保持同样的平移
for (const mod of [storeMod, interiorMod, detailsMod]) {
  if (mod && mod.group) mod.group.position.set(E.storeOffset.dx, 0, E.storeOffset.dz);
}
build('town', buildTown);
build('fx', buildFx);

// 旧楼背面/西面的小壁灯：从模型后方观看时提供一点可读的暖光
function addBackLamp(x, y, z, ry) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.1), new THREE.MeshBasicMaterial({ color: '#2b2f36' }));
  housing.position.set(0, 0.16, 0.02);
  g.add(housing);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.08, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd9a0', side: THREE.DoubleSide }));
  shade.position.set(0, 0.1, 0.08);
  g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe0aa').multiplyScalar(1.6) }));
  bulb.position.set(0, 0.08, 0.09);
  g.add(bulb);
  const sp = glowSprite('#ffd9a0', 1.4, 0.22);
  sp.position.set(0, 0.08, 0.2);
  g.add(sp);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.16), new THREE.MeshBasicMaterial({ color: '#3a3f48' }));
  bracket.position.set(0, 0.2, 0.0);
  g.add(bracket);
  root.add(g);
}
addBackLamp(-5.52, 2.45, -1.9, -Math.PI / 2);
addBackLamp(-5.52, 2.45, 0.55, -Math.PI / 2);
addBackLamp(-1.1, 2.55, -4.52, Math.PI);
addBackLamp(1.4, 2.4, -4.52, Math.PI);

// 让 fx 可以让几盏灯也参与非常克制的偶发闪烁
handles.flickerLights = handles.flickerLights || [];
for (const name of ['sign', 'canopy', 'neonPink', 'streetLamp']) {
  const light = lightMap[name];
  if (light) handles.flickerLights.push({ light, base: light.intensity });
}


/* -------------------------------------------------------------------------- */
/*  相机 / 控制器                                                              */
/* -------------------------------------------------------------------------- */

const views = structuredClone(VIEWS);
/**
 * 竖屏 / 窄屏时相机自适应：把视距和 FOV 调大，保证整个正方形底座能入镜。
 * 桌面端维持「模型感」的较长焦视角，手机端则是完整模型 + 大黑边。
 */
function frameFor(v) {
  const aspect = innerWidth / innerHeight;
  let radius = v.radius;
  let fov = v.fov;
  let target = v.target;
  if (aspect < 1.05) {
    fov = Math.max(fov, 48);
    const targetWidth = 11.9;
    const need = targetWidth / (2 * Math.tan((fov * Math.PI) / 360) * aspect);
    radius = Math.max(radius * 1.02, need);
    // 竖屏时把视觉重心往下放一点，别让模型顶在画面 1/3 处
    target = [v.target[0], v.target[1] + 0.75, v.target[2]];
  }
  return { radius, fov, target, az: v.az, el: v.el };
}

function applyView(name, instant = true) {
  const v = frameFor(views[name] || views.hero);
  camera.fov = v.fov;
  camera.updateProjectionMatrix();
  camera.position.setFromSphericalCoords(v.radius, v.el, v.az).add(new THREE.Vector3(...v.target));
  controls.target.set(...v.target);
  if (instant) {
    controls.update();
    resolveCameraCollision();
  }
}
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.85;
controls.minDistance = 5.5;
controls.maxDistance = 32;
controls.minPolarAngle = 0.16;
controls.maxPolarAngle = 1.43;
controls.autoRotate = false;
controls.autoRotateSpeed = 0.32;
const initial = frameFor(views.hero);
controls.target.set(...initial.target);
camera.fov = initial.fov;
camera.updateProjectionMatrix();
camera.position.setFromSphericalCoords(initial.radius, initial.el, initial.az).add(
  new THREE.Vector3(...initial.target),
);
controls.update();

/* ---- 相机碰撞：避免最近距离旋转时钻进旧楼 / 便利店 / 轻卡内部（QA BUG-1）---- */
const CAM_BLOCKERS = [
  new THREE.Box3(new THREE.Vector3(-2.9, 0.12, -4.6), new THREE.Vector3(1.72, 3.76, 1.02)), // 便利店体块
  new THREE.Box3(new THREE.Vector3(-5.5, 0.12, -4.8), new THREE.Vector3(-4.0, 6.3, 1.02)), // 左侧旧楼
  new THREE.Box3(new THREE.Vector3(3.32, 0.0, -4.85), new THREE.Vector3(4.92, 1.95, -1.45)), // 路边轻卡
];
const _camDir = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
function rayBox(origin, dir, box) {
  let tmin = -Infinity;
  let tmax = Infinity;
  for (const axis of ['x', 'y', 'z']) {
    if (Math.abs(dir[axis]) < 1e-6) {
      if (origin[axis] < box.min[axis] || origin[axis] > box.max[axis]) return null;
    } else {
      let t1 = (box.min[axis] - origin[axis]) / dir[axis];
      let t2 = (box.max[axis] - origin[axis]) / dir[axis];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return { tmin, tmax };
}
function resolveCameraCollision() {
  _camTarget.copy(controls.target);
  _camDir.copy(camera.position).sub(_camTarget);
  let R = _camDir.length();
  if (R < 0.001) return;
  _camDir.divideScalar(R);
  for (let iter = 0; iter < 3; iter += 1) {
    let pushed = false;
    for (const box of CAM_BLOCKERS) {
      const hit = rayBox(_camTarget, _camDir, box);
      if (!hit) continue;
      if (R > hit.tmin - 0.06 && R < hit.tmax + 0.32) {
        R = hit.tmax + 0.32;
        pushed = true;
      }
    }
    if (!pushed) break;
  }
  camera.position.copy(_camTarget).addScaledVector(_camDir, R);
}

let lastInteraction = performance.now();
controls.addEventListener('start', () => {
  lastInteraction = performance.now();
  controls.autoRotate = false;
});
controls.addEventListener('end', () => {
  lastInteraction = performance.now();
});

const startView = params.get('view');
if (startView) applyView(startView);
else if (params.has('cam')) {
  const [x, y, z] = params.get('cam').split(',').map(Number);
  camera.position.set(x, y, z);
  controls.update();
  resolveCameraCollision();
}

/* -------------------------------------------------------------------------- */
/*  后期                                                                       */
/* -------------------------------------------------------------------------- */

const post = createPost(renderer, scene, camera, {
  exposure: 0.98,
  bloomStrength: 0.26 * QUALITY.bloom,
  bloomRadius: 0.46,
  bloomThreshold: 1.18,
  samples: QUALITY.isMobile ? 0 : 4,
  fadeMs: STILL ? 0 : 1900,
});
post.uniforms.uTilt.value = QUALITY.isMobile ? 0.3 : 0.55;

/* -------------------------------------------------------------------------- */
/*  窗口自适应                                                                 */
/* -------------------------------------------------------------------------- */

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, QUALITY.isMobile ? 1.25 : 2));
  renderer.setSize(innerWidth, innerHeight);
  post.resize();
}
addEventListener('resize', resize);

/* -------------------------------------------------------------------------- */
/*  主循环                                                                     */
/* -------------------------------------------------------------------------- */

const clock = new THREE.Clock();
let elapsed = 0;
let frames = 0;
let fpsAcc = 0;
let fps = 0;
const debug = { frame: 0 };

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  elapsed = FORCED_TIME !== null ? FORCED_TIME : elapsed + (FREEZE ? 0 : dt);
  if (!FREEZE) handles.time.value = elapsed;

  // 闲置时非常缓慢地绕模型旋转，观察「收藏品」
  if (!STILL && !FREEZE) {
    const idle = performance.now() - lastInteraction > 14000;
    if (idle && !controls.autoRotate) controls.autoRotate = true;
    if (!idle && controls.autoRotate) controls.autoRotate = false;
  }
  controls.update(Math.min(dt, 0.05));
  resolveCameraCollision();

  for (const mod of mods) {
    if (mod.update) mod.update(elapsed, dt);
  }
  for (const fn of handles.update) fn(elapsed, dt);

  post.uniforms.uTime.value = elapsed;
  post.render(dt, elapsed);

  frames += 1;
  fpsAcc += dt;
  if (fpsAcc >= 0.5) {
    fps = Math.round(frames / fpsAcc);
    frames = 0;
    fpsAcc = 0;
  }
  debug.frame += 1;

  if (!window.__KONBINI__ || !window.__KONBINI__.ready) {
    window.__KONBINI__ = window.__KONBINI__ || {};
    window.__KONBINI__.ready = true;
  }
});

window.__KONBINI__ = {
  ready: window.__KONBINI__?.ready || false,
  THREE,
  renderer,
  scene,
  camera,
  controls,
  handles,
  post,
  get fps() {
    return fps;
  },
  debug,
  setView: (name) => applyView(name),
  freeze: (v = true) => {
    // eslint-disable-next-line no-func-assign
    FREEZE = v;
  },
  get time() {
    return elapsed;
  },
};

// 首帧后标记就绪（截图工具依赖这个标记）
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    window.__KONBINI__.ready = true;
  });
});
