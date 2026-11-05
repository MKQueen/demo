/**
 * water-test.js —— 水面 Shader 独立测试页控制逻辑（dev only）。
 *
 * 目的：在不依赖 Lead 的 src/cesium/floodApp.js 的情况下，搭一个真实的
 * Cesium 场景（程序化地形 + 村庄 box 建筑 + 黄昏天空），用 Playwright
 * 截图迭代水面 PostProcessStage。
 *
 * URL 参数（都可以用 window.__waterTest 在运行时改）：
 *   level=2.5  quality=high  cam=overview  debug=0  enabled=1  mode=postprocess
 *   waveI=0.65 waveS=0.8 caustics=0.8  clock=2026-11-03T08:50:00Z
 */

import * as Cesium from 'cesium';
import { WaterRenderer } from '../src/water/WaterRenderer.js';
import {
  CENTER,
  applyCameraPreset,
  addVillage,
  createGroundMaterial,
  createTerrainProvider,
} from './testTerrain.js';

const params = new URLSearchParams(location.search);
const num = (key, fallback) => {
  const v = parseFloat(params.get(key));
  return Number.isFinite(v) ? v : fallback;
};
const str = (key, fallback) => params.get(key) ?? fallback;

// ---------------------------------------------------------------------------
// 1. Viewer：无网络（baseLayer:false + 本地 Assets），开启 Cesium 自带天空
// ---------------------------------------------------------------------------
const viewer = new Cesium.Viewer('cesiumContainer', {
  baseLayer: false,
  baseLayerPicker: false,
  geocoder: false,
  homeButton: false,
  sceneModePicker: false,
  navigationHelpButton: false,
  animation: false,
  timeline: false,
  fullscreenButton: false,
  infoBox: false,
  selectionIndicator: false,
  shouldAnimate: true,
  terrainProvider: createTerrainProvider(Cesium, { width: 32, height: 32 }),
  contextOptions: {
    webgl: { alpha: false, antialias: true },
  },
});

const scene = viewer.scene;
// 调试开关：?msaa=1 关闭 MSAA（验证 MSAA 深度 resolve 是否影响深度重建）
const msaaParam = params.get('msaa');
if (msaaParam !== null) scene.msaaSamples = Math.max(1, parseInt(msaaParam, 10) || 1);
scene.globe.baseColor = Cesium.Color.fromCssColorString('#2b3524');
scene.globe.material = createGroundMaterial(Cesium);
scene.globe.enableLighting = false;
scene.globe.showGroundAtmosphere = true;
scene.highDynamicRange = false;
scene.skyAtmosphere.show = true;
scene.fog.enabled = true;
scene.fog.density = 0.00008;

// 黄昏光照：太阳低角度，天空金色 → 与水面 getSkyColor 的配色对齐
const clockIso = str('clock', '2026-11-03T08:45:00Z'); // 北京时间 16:45
viewer.clock.currentTime = Cesium.JulianDate.fromIso8601(clockIso);
viewer.clock.shouldAnimate = false;
scene.light = new Cesium.DirectionalLight({
  direction: Cesium.Cartesian3.normalize(
    new Cesium.Cartesian3(-0.42, 0.34, 0.18),
    new Cesium.Cartesian3(),
  ),
  intensity: 2.2,
});

// 村庄建筑
addVillage(viewer, Cesium);

// ---------------------------------------------------------------------------
// 2. 水面渲染器
// ---------------------------------------------------------------------------
const water = new WaterRenderer(viewer, {
  store: null,
  centerLon: CENTER.lon,
  centerLat: CENTER.lat,
  sceneRadius: 9000,
});

water.setQuality(str('quality', 'high'));
water.setWaterLevel(num('level', 2.5));
water.setWaveOptions({
  intensity: num('waveI', 0.65),
  speed: num('waveS', 0.8),
  caustics: num('caustics', 0.8),
});
water.setDebugMode(num('debug', 0));
water.setEnabled(num('enabled', 1) > 0.5);
water.setMaterialMode(str('mode', 'postprocess'));

const camKey = str('cam', 'overview');
applyCameraPreset(viewer, Cesium, camKey);

// ---------------------------------------------------------------------------
// 3. 每帧驱动 + FPS 统计
// ---------------------------------------------------------------------------
const startMs = performance.now();
let lastT = 0;
let frameCount = 0;
let fps = 0;
let lastFpsMs = performance.now();
let frameTimeSum = 0;
let frameTimeCount = 0;
let maxFrameTime = 0;

const hud = document.getElementById('hud');

scene.preUpdate.addEventListener(() => {
  const t = (performance.now() - startMs) / 1000;
  lastT = t;
  water.update(t);
});

scene.postRender.addEventListener(() => {
  const now = performance.now();
  frameCount++;
  const dt = now - lastFpsMs;
  if (dt > 500) {
    fps = (frameCount * 1000) / dt;
    frameCount = 0;
    lastFpsMs = now;
  }
  if (hud) {
    hud.innerHTML =
      `水位 <b>${water.getWaterLevel().toFixed(2)} m</b>  画质 <b>${water.getQuality()}</b>  ` +
      `模式 <b>${document.body.dataset.materialMode ?? 'postprocess'}</b>\n` +
      `FPS <b>${fps.toFixed(1)}</b>  视角 <b>${camKey}</b>  clock ${clockIso}`;
  }
});

// 逐帧耗时（配合 Playwright 测帧时间）
let timingSamples = null;
function startFrameTiming(count = 90) {
  timingSamples = [];
  let prev = performance.now();
  const handler = () => {
    const now = performance.now();
    timingSamples.push(now - prev);
    prev = now;
    if (timingSamples.length >= count) {
      scene.postRender.removeEventListener(handler);
      const sorted = timingSamples.slice().sort((a, b) => a - b);
      const avg = timingSamples.reduce((a, b) => a + b, 0) / timingSamples.length;
      timingSamples = {
        avg,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        max: sorted[sorted.length - 1],
        fps: 1000 / avg,
      };
    }
  };
  scene.postRender.addEventListener(handler);
}

// ---------------------------------------------------------------------------
// 4. 给 Playwright / 人工调试用的全局句柄
// ---------------------------------------------------------------------------
window.__waterTest = {
  viewer,
  water,
  scene,
  ready: true,
  setLevel(v) {
    water.setWaterLevel(v);
  },
  setQuality(q) {
    water.setQuality(q);
  },
  setDebug(d) {
    water.setDebugMode(d);
  },
  setEnabled(b) {
    water.setEnabled(b);
  },
  setMode(mode) {
    document.body.dataset.materialMode = mode;
    water.setMaterialMode(mode);
  },
  setWave(opts) {
    water.setWaveOptions(opts);
  },
  setCam(key) {
    applyCameraPreset(viewer, Cesium, key);
  },
  setClock(iso) {
    viewer.clock.currentTime = Cesium.JulianDate.fromIso8601(iso);
  },
  stats() {
    return {
      fps,
      waterLevel: water.getWaterLevel(),
      quality: water.getQuality(),
      materialMode: document.body.dataset.materialMode ?? 'postprocess',
      drawingBufferWidth: scene.drawingBufferWidth,
      drawingBufferHeight: scene.drawingBufferHeight,
    };
  },
  startFrameTiming,
  getFrameTiming() {
    return timingSamples && !Array.isArray(timingSamples) ? timingSamples : null;
  },
};

document.body.dataset.materialMode = str('mode', 'postprocess');

// 等首帧渲染完成再置 ready（Playwright 用它判断可以截图）
Cesium.when
  ? Cesium.when(viewer.scene.postRender)
  : new Promise((resolve) => {
      const off = scene.postRender.addEventListener(() => {
        off();
        resolve();
      });
    }).then(() => {
      window.__waterReady = true;
    });

// 兜底：即使上面的 when 分支无效，2s 后也置位
setTimeout(() => {
  window.__waterReady = true;
}, 2000);
