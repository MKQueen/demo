/**
 * atmosphere.js —— 富华大厦 · 昼夜氛围模块
 *
 * 契约见 docs/upgrade-contract.md §4.1。职责：
 *   1) 天空穹顶 ShaderMaterial（日 / 黄昏 / 夜三套渐变 + 日月光盘 + 夜空星星）；
 *   2) 接管主工程传入的 sun / ambient / fill 三盏灯与雾、背景、曝光，约 0.9s 平滑过渡；
 *   3) 英雄建筑玻璃材质夜景窗光（onBeforeCompile 注入，按世界坐标生成窗格 + hash 亮灯）；
 *   4) 六座塔顶红色航空障碍灯（Sprite，夜间闪烁）；
 *   5) EffectComposer + RenderPass + UnrealBloomPass(半分辨率) + OutputPass 后处理；
 *      构建失败时自动降级为 renderer.render(scene, camera)。
 *
 * 不新增依赖、不重复添加场景灯、不修改 main.js / index.html / style.css。
 * 失败路径只 console.warn，不 console.error（页面验收要求）。
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const ATMOSPHERE_PRESETS = ['day', 'dusk', 'night'];

const TRANSITION_MS = 900;      // 三态切换过渡时长（≈0.9s）
const SKY_RADIUS = 900;         // 天空穹顶半径（depthWrite=false，1.2km 城市不会被裁剪）
const WINDOW_SWEEP_MS = 1500;   // 模型材质被外部 clone 后的补注入扫描间隔（毫秒）
const NEXT_PRESET = { day: 'dusk', dusk: 'night', night: 'day' };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ------------------------------ 预设定义 ------------------------------ */
/**
 * 数值口径：
 *  - sky.*      天空 shader 颜色（sRGB 十六进制，THREE.Color 内部转 linear）
 *  - sunDir / moonDir  天上日/月盘方向（从场景原点指向光源）
 *  - lights.sun 复用主工程 DirectionalLight（位置 = 光照方向，day 保持现有暖阳）
 *  - fog        颜色 + 密度；主工程 camera.far 已到 4200，密度控制在 0.0006–0.0011
 *  - night      窗光 uNight 目标值（day=0，dusk≈0.35，night=1）
 */
function getPresetConfig(name) {
  const PRESETS = {
    day: {
      // 日景：蓝天 + 暖阳，雾更蓝更淡，让白模城市与天空拉开层次
      sky: { zenith: 0x3f77b3, horizon: 0xcfe2ec, ground: 0x8fa3ab, haze: 0.24 },
      sunDir: [-80, 128, 62], sunDiskColor: 0xfff3da, sunDisk: 0.9,
      moonDir: [-90, 110, -70], moonDiskColor: 0xdfe8ff, moonDisk: 0.0,
      stars: 0.0,
      fog: { color: 0x8fb4c9, density: 0.00080 },
      background: 0x8fb4c9,
      exposure: 0.99,
      environment: 0.46,
      bloom: { strength: 0.06, threshold: 1.08, radius: 0.32 },
      night: 0.0,
      lights: {
        sun: { color: 0xffe9cf, intensity: 2.05, pos: [-80, 128, 62] },
        ambient: { sky: 0xc6e2f6, ground: 0x8a8371, intensity: 0.78 },
        fill: { color: 0xbcd8ef, intensity: 0.62, pos: [80, 70, -70] },
      },
    },
    dusk: {
      // 黄昏：暗前景 + 金橙天空的通透对比；低角度斜阳拉长阴影，避免整体奶油色
      sky: { zenith: 0x1f2747, horizon: 0xf08a4a, ground: 0x2e2521, haze: 0.55 },
      sunDir: [-168, 26, 110], sunDiskColor: 0xff9440, sunDisk: 1.9,
      moonDir: [-70, 120, -90], moonDiskColor: 0xcfdcff, moonDisk: 0.05,
      stars: 0.22,
      fog: { color: 0x5d4438, density: 0.0014 },
      background: 0x5d4438,
      exposure: 0.84,
      environment: 0.20,
      bloom: { strength: 0.13, threshold: 0.78, radius: 0.42 },
      night: 0.42,
      lights: {
        sun: { color: 0xff8f42, intensity: 1.22, pos: [-168, 26, 110] },
        ambient: { sky: 0x6d7b95, ground: 0x241f1c, intensity: 0.40 },
        fill: { color: 0x4d6a9a, intensity: 0.22, pos: [95, 60, -55] },
      },
    },
    night: {
      // 夜景：冷蓝月光 + 极弱环境，窗光/路灯/车灯是唯一亮点；bloom 只作用于高亮
      sky: { zenith: 0x03080f, horizon: 0x0b1a2b, ground: 0x010305, haze: 0.18 },
      sunDir: [-90, 110, -70], sunDiskColor: 0x9db6ff, sunDisk: 0.0,
      moonDir: [-90, 110, -70], moonDiskColor: 0xdbe6ff, moonDisk: 1.3,
      stars: 1.0,
      fog: { color: 0x081420, density: 0.00105 },
      background: 0x081420,
      exposure: 0.85,
      environment: 0.14,
      bloom: { strength: 0.26, threshold: 0.70, radius: 0.40 },
      night: 1.0,
      lights: {
        sun: { color: 0x86aaff, intensity: 0.38, pos: [-90, 110, -70] },
        ambient: { sky: 0x273d55, ground: 0x070b0f, intensity: 0.28 },
        fill: { color: 0x3d5f8a, intensity: 0.12, pos: [70, 50, 80] },
      },
    },
  };
  return PRESETS[name] || PRESETS.day;
}

/* --------------------------- 可插值状态模型 --------------------------- */
function makeState() {
  return {
    skyZenith: new THREE.Color(), skyHorizon: new THREE.Color(), skyGround: new THREE.Color(),
    skyHaze: 0,
    sunDir: new THREE.Vector3(), sunDiskColor: new THREE.Color(), sunDisk: 0,
    moonDir: new THREE.Vector3(), moonDiskColor: new THREE.Color(), moonDisk: 0,
    stars: 0,
    fogColor: new THREE.Color(), fogDensity: 0,
    background: new THREE.Color(),
    exposure: 1,
    environment: 0.65,
    bloomStrength: 0, bloomThreshold: 0.9, bloomRadius: 0.4,
    night: 0,
    sunColor: new THREE.Color(), sunIntensity: 0, sunPos: new THREE.Vector3(),
    ambientSky: new THREE.Color(), ambientGround: new THREE.Color(), ambientIntensity: 0,
    fillColor: new THREE.Color(), fillIntensity: 0, fillPos: new THREE.Vector3(),
  };
}

function writeStateFromPreset(name, out) {
  const cfg = getPresetConfig(name);
  out.skyZenith.setHex(cfg.sky.zenith);
  out.skyHorizon.setHex(cfg.sky.horizon);
  out.skyGround.setHex(cfg.sky.ground);
  out.skyHaze = cfg.sky.haze;
  out.sunDir.set(...cfg.sunDir).normalize();
  out.sunDiskColor.setHex(cfg.sunDiskColor);
  out.sunDisk = cfg.sunDisk;
  out.moonDir.set(...cfg.moonDir).normalize();
  out.moonDiskColor.setHex(cfg.moonDiskColor);
  out.moonDisk = cfg.moonDisk;
  out.stars = cfg.stars;
  out.fogColor.setHex(cfg.fog.color);
  out.fogDensity = cfg.fog.density;
  out.background.setHex(cfg.background);
  out.exposure = cfg.exposure;
  out.environment = cfg.environment;
  out.bloomStrength = cfg.bloom.strength;
  out.bloomThreshold = cfg.bloom.threshold;
  out.bloomRadius = cfg.bloom.radius;
  out.night = cfg.night;
  out.sunColor.setHex(cfg.lights.sun.color);
  out.sunIntensity = cfg.lights.sun.intensity;
  out.sunPos.set(...cfg.lights.sun.pos);
  out.ambientSky.setHex(cfg.lights.ambient.sky);
  out.ambientGround.setHex(cfg.lights.ambient.ground);
  out.ambientIntensity = cfg.lights.ambient.intensity;
  out.fillColor.setHex(cfg.lights.fill.color);
  out.fillIntensity = cfg.lights.fill.intensity;
  out.fillPos.set(...cfg.lights.fill.pos);
  return out;
}

/** 把当前插值结果写回 from（用于切换目标时从「当前实际状态」继续过渡，不跳变）。 */
function cacheCurrentInto(from, to, e) {
  const lc = (out, a, b) => out.lerpColors(a, b, e);
  const ln = (a, b) => THREE.MathUtils.lerp(a, b, e);
  const lv = (out, a, b) => out.lerpVectors(a, b, e);
  lc(from.skyZenith, from.skyZenith, to.skyZenith);
  lc(from.skyHorizon, from.skyHorizon, to.skyHorizon);
  lc(from.skyGround, from.skyGround, to.skyGround);
  from.skyHaze = ln(from.skyHaze, to.skyHaze);
  lv(from.sunDir, from.sunDir, to.sunDir);
  lc(from.sunDiskColor, from.sunDiskColor, to.sunDiskColor);
  from.sunDisk = ln(from.sunDisk, to.sunDisk);
  lv(from.moonDir, from.moonDir, to.moonDir);
  lc(from.moonDiskColor, from.moonDiskColor, to.moonDiskColor);
  from.moonDisk = ln(from.moonDisk, to.moonDisk);
  from.stars = ln(from.stars, to.stars);
  lc(from.fogColor, from.fogColor, to.fogColor);
  from.fogDensity = ln(from.fogDensity, to.fogDensity);
  lc(from.background, from.background, to.background);
  from.exposure = ln(from.exposure, to.exposure);
  from.environment = ln(from.environment, to.environment);
  from.bloomStrength = ln(from.bloomStrength, to.bloomStrength);
  from.bloomThreshold = ln(from.bloomThreshold, to.bloomThreshold);
  from.bloomRadius = ln(from.bloomRadius, to.bloomRadius);
  from.night = ln(from.night, to.night);
  lc(from.sunColor, from.sunColor, to.sunColor);
  from.sunIntensity = ln(from.sunIntensity, to.sunIntensity);
  lv(from.sunPos, from.sunPos, to.sunPos);
  lc(from.ambientSky, from.ambientSky, to.ambientSky);
  lc(from.ambientGround, from.ambientGround, to.ambientGround);
  from.ambientIntensity = ln(from.ambientIntensity, to.ambientIntensity);
  lc(from.fillColor, from.fillColor, to.fillColor);
  from.fillIntensity = ln(from.fillIntensity, to.fillIntensity);
  lv(from.fillPos, from.fillPos, to.fillPos);
}

/* --------------------------- 天空 ShaderMaterial --------------------------- */
const SKY_VERTEX = /* glsl */`
varying vec3 vAtmoDir;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vAtmoDir = worldPosition.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const SKY_FRAGMENT = /* glsl */`
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform float uHaze;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunI;
uniform vec3 uMoonDir;
uniform vec3 uMoonColor;
uniform float uMoonI;
uniform float uStars;
uniform float uNight;
uniform float uTime;
varying vec3 vAtmoDir;

float atmoHash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec3 dir = normalize(vAtmoDir);
  float h = dir.y;

  // 天顶 → 地平线渐变；地平线以下压到地面色
  vec3 col = mix(uHorizon, uZenith, smoothstep(-0.02, 0.58, h));
  col = mix(col, uGround, smoothstep(0.0, 0.22, -h));

  // 地平线薄雾（黄昏更重，营造金橙带）
  float haze = exp(-abs(h) * 15.0) * uHaze;
  col = mix(col, uHorizon * 1.1, haze * 0.6);

  // 太阳（日景淡日晕 / 黄昏低垂金盘）
  float sd = clamp(dot(dir, uSunDir), 0.0, 1.0);
  float sunDisk = smoothstep(0.99930, 0.99972, sd);
  float sunGlow = pow(sd, 26.0) * 0.40 + pow(sd, 5.0) * 0.085;
  col += uSunColor * (sunDisk * 2.6 + sunGlow) * uSunI;

  // 月亮
  float md = clamp(dot(dir, uMoonDir), 0.0, 1.0);
  float moonDisk = smoothstep(0.99952, 0.99980, md);
  float moonHalo = pow(md, 90.0) * 0.30 + pow(md, 10.0) * 0.05;
  float moonTex = 0.84 + 0.16 * sin(dir.x * 80.0 + dir.y * 60.0);
  col += uMoonColor * (moonDisk * 2.0 * moonTex + moonHalo) * uMoonI;

  // 星空（hash 星点 + 轻微闪烁），只在地平线以上出现
  if (uStars > 0.002) {
    vec3 sp = dir * 240.0;
    vec3 id = floor(sp);
    vec3 f = fract(sp) - 0.5;
    float hs = atmoHash31(id);
    float star = smoothstep(0.9982, 0.99995, hs) * smoothstep(0.34, 0.02, length(f));
    float twinkle = 0.55 + 0.45 * sin(uTime * 1.7 + hs * 120.0);
    col += vec3(0.82, 0.88, 1.0) * star * twinkle * uStars * smoothstep(0.0, 0.16, h) * 2.3;
  }

  // 极细颗粒，避免大面积渐变出现色带
  col += (atmoHash31(vec3(gl_FragCoord.xy, uTime)) - 0.5) * 0.0035;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
  #ifdef ATMO_TONE_MAP
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  #endif
}
`;

/* ------------------------ 玻璃材质：夜景窗光注入 ------------------------ */
const WINDOW_VERT_HEAD = /* glsl */`
varying vec3 vAtmoWorld;
varying vec3 vAtmoNormal;
`;

const WINDOW_FRAG_HEAD = /* glsl */`
uniform float uNight;
uniform vec3 uWinGlow;
uniform float uWinPaneW;
uniform float uWinPaneH;
uniform float uWinIntensity;
varying vec3 vAtmoWorld;
varying vec3 vAtmoNormal;

float atmoWinHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// 按世界坐标切窗格：水平 ~2.25m / 垂直 ~3.35m，hash 决定某扇窗夜间是否亮灯。
vec3 atmoWindowGlow() {
  if (uNight <= 0.001) return vec3(0.0);
  vec3 n = normalize(vAtmoNormal);
  float facing = smoothstep(0.55, 0.88, abs(n.y));          // 朝上的玻璃面不点灯
  if (facing > 0.999) return vec3(0.0);

  float along = abs(n.x) > abs(n.z) ? vAtmoWorld.z : vAtmoWorld.x;
  vec2 cell = vec2(floor(along / uWinPaneW), floor(vAtmoWorld.y / uWinPaneH));
  vec2 f = vec2(fract(along / uWinPaneW), fract(vAtmoWorld.y / uWinPaneH));

  // 窗洞内缩 + 边缘柔化，留出窗框
  float mx = smoothstep(0.10, 0.20, f.x) * (1.0 - smoothstep(0.80, 0.90, f.x));
  float my = smoothstep(0.16, 0.27, f.y) * (1.0 - smoothstep(0.76, 0.86, f.y));
  float mask = mx * my;

  float seed = atmoWinHash(cell + 13.7);
  float highBias = smoothstep(0.0, 30.0, vAtmoWorld.y) * 0.10;   // 高层亮灯略少
  float lit = step(0.615 + highBias * 0.8, seed);
  float warm = 0.55 + 0.45 * atmoWinHash(cell * 1.31 + 4.1);      // 每扇窗亮度差异
  float groundFade = smoothstep(0.9, 3.0, vAtmoWorld.y);          // 首层入口不做窗格阵列

  return uWinGlow * (uWinIntensity * lit * warm * mask * groundFade) * uNight;
}
`;

/**
 * 给单个玻璃材质注入窗光 shader。幂等；失败只 warn。
 * @returns {boolean} 是否本次新注入
 */
function injectWindowMaterial(material, winUniforms, usedSet) {
  if (!material || !material.isMaterial) return false;
  if (material.userData && material.userData.__atmoWindow) return false;
  if (usedSet && usedSet.has(material)) return false;
  // 只处理能承载自发光的标准材质（玻璃 = MeshStandardMaterial / MeshPhysicalMaterial）
  if (!material.isMeshStandardMaterial && !material.isMeshPhysicalMaterial) {
    if (usedSet) usedSet.add(material);
    return false;
  }
  try {
    const previousCompile = material.onBeforeCompile;
    material.onBeforeCompile = function onBeforeCompileAtmosphere(shader, renderer) {
      if (typeof previousCompile === 'function') previousCompile.call(this, shader, renderer);
      try {
        shader.uniforms.uNight = winUniforms.uNight;
        shader.uniforms.uWinGlow = winUniforms.uWinGlow;
        shader.uniforms.uWinPaneW = winUniforms.uWinPaneW;
        shader.uniforms.uWinPaneH = winUniforms.uWinPaneH;
        shader.uniforms.uWinIntensity = winUniforms.uWinIntensity;

        shader.vertexShader = `${WINDOW_VERT_HEAD}\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <fog_vertex>',
          `#include <fog_vertex>
  vAtmoWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vAtmoNormal = normalize(mat3(modelMatrix) * objectNormal);`,
        );

        shader.fragmentShader = `${WINDOW_FRAG_HEAD}\n${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n  totalEmissiveRadiance += atmoWindowGlow();',
        );
      } catch (error) {
        console.warn('[atmosphere] 窗光 shader 注入失败：', error && error.message ? error.message : error);
      }
    };
    material.customProgramCacheKey = () => 'atmosphere-window-v1';
    material.userData = material.userData || {};
    material.userData.__atmoWindow = true;
    material.needsUpdate = true;
    if (usedSet) usedSet.add(material);
    return true;
  } catch (error) {
    console.warn('[atmosphere] 玻璃材质接管失败：', error && error.message ? error.message : error);
    if (usedSet) usedSet.add(material);
    return false;
  }
}

function isGlassName(name) {
  return typeof name === 'string' && /glass/i.test(name);
}

/** 遍历模型，对名称含 glass 的材质注入窗光（材质可能被外部 clone，故可重复扫描补注入）。 */
function sweepGlassMaterials(model, winUniforms) {
  if (!model || typeof model.traverse !== 'function') return { injected: 0, handled: 0 };
  const used = new Set();
  let injected = 0;
  let handled = 0;
  model.traverse((object) => {
    if (!object || !object.isMesh || !object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material || used.has(material)) continue;
      if (!isGlassName(material.name)) continue;
      handled += 1;
      if (injectWindowMaterial(material, winUniforms, used)) injected += 1;
    }
  });
  return { injected, handled };
}

/* ------------------------------- 主入口 ------------------------------- */
export function createAtmosphere({ scene, camera, renderer, lights, controls } = {}) {
  const warnings = [];
  const warn = (message, error) => {
    warnings.push(message);
    console.warn(`[atmosphere] ${message}`, error && error.message ? error.message : error ?? '');
  };

  const lightList = lights || {};
  const sun = lightList.sun || null;
  const ambient = lightList.ambient || null;
  const fill = lightList.fill || null;

  /* ------------------ 后处理（失败回退 renderer.render） ------------------ */
  let composer = null;
  let bloomPass = null;
  try {
    if (renderer && scene && camera) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.12, 0.42, 0.9);
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    } else {
      warn('缺少 renderer / scene / camera，跳过后期处理');
    }
  } catch (error) {
    composer = null;
    bloomPass = null;
    warn('后处理构建失败，已回退 renderer.render()', error);
  }

  /* ------------------------------ 天空穹顶 ------------------------------ */
  const skyUniforms = {
    uZenith: { value: new THREE.Color(0x4f8bc4) },
    uHorizon: { value: new THREE.Color(0xcfe2ec) },
    uGround: { value: new THREE.Color(0x90a0a6) },
    uHaze: { value: 0.3 },
    uSunDir: { value: new THREE.Vector3(-0.45, 0.8, 0.4) },
    uSunColor: { value: new THREE.Color(0xfff2d6) },
    uSunI: { value: 1 },
    uMoonDir: { value: new THREE.Vector3(0.5, 0.6, -0.6) },
    uMoonColor: { value: new THREE.Color(0xdfe8ff) },
    uMoonI: { value: 0 },
    uStars: { value: 0 },
    uNight: { value: 0 },
    uTime: { value: 0 },
  };

  let sky = null;
  if (scene) {
    const skyMaterial = new THREE.ShaderMaterial({
      name: 'AtmosphereSky',
      uniforms: skyUniforms,
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: true,
      defines: composer ? {} : { ATMO_TONE_MAP: 1 },
    });
    sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 40, 24), skyMaterial);
    sky.name = 'AtmosphereSkyDome';
    sky.frustumCulled = false;
    sky.renderOrder = -1000;
    sky.matrixAutoUpdate = true;
    scene.add(sky);
  } else {
    warn('缺少 scene，天空穹顶未创建');
  }

  /* ------------------------- 窗光 uniform（共享） ------------------------- */
  const winUniforms = {
    uNight: { value: 0 },
    uWinGlow: { value: new THREE.Color(0xffc987) },
    uWinPaneW: { value: 2.25 },
    uWinPaneH: { value: 3.35 },
    uWinIntensity: { value: 0.95 },
  };

  /* ---------------------------- 航空障碍灯 ---------------------------- */
  const aerialGroup = new THREE.Group();
  aerialGroup.name = 'AtmosphereAerialLights';
  aerialGroup.frustumCulled = false;
  const aerialLights = [];
  const towerMeshes = [];
  if (scene) scene.add(aerialGroup);

  const glowTexture = (() => {
    try {
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.28, 'rgba(255,170,140,0.85)');
      gradient.addColorStop(1, 'rgba(255,40,20,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      return texture;
    } catch (error) {
      warn('航空灯贴图生成失败', error);
      return null;
    }
  })();

  function disposeAerialLights() {
    for (const entry of aerialLights) {
      aerialGroup.remove(entry.sprite);
      entry.sprite.material.dispose();
    }
    aerialLights.length = 0;
  }

  /** 按 GLB 中六座塔楼 mesh（userData.building A–F）的世界 bbox 找塔顶放红灯。 */
  function buildAerialLights(model) {
    if (!model || typeof model.traverse !== 'function' || !glowTexture) return 0;
    disposeAerialLights();
    towerMeshes.length = 0;
    try {
      model.updateMatrixWorld(true);
    } catch { /* 忽略 */ }
    const boxes = new Map();
    model.traverse((object) => {
      if (!object || !object.isMesh || !object.geometry) return;
      const building = object.userData && object.userData.building;
      if (!building || !/^[A-F]$/.test(String(building))) return;
      towerMeshes.push(object);
      const box = new THREE.Box3().setFromObject(object);
      if (!Number.isFinite(box.min.x) || box.isEmpty()) return;
      const current = boxes.get(building);
      if (current) current.union(box);
      else boxes.set(building, box.clone());
    });
    const center = new THREE.Vector3();
    for (const [building, box] of boxes) {
      box.getCenter(center);
      const spriteMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xff4636,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.name = `AerialLight-${building}`;
      sprite.position.set(center.x, box.max.y + 1.6, center.z);
      sprite.scale.set(2.6, 2.6, 1);
      sprite.userData.building = building;
      sprite.userData.phase = (aerialLights.length * 0.37) % 1;
      sprite.userData.period = 1.2 + (aerialLights.length % 4) * 0.16; // 1.2–1.68s
      aerialGroup.add(sprite);
      aerialLights.push({ sprite, building });
    }
    return aerialLights.length;
  }

  /* ---------------------------- 状态与过渡 ---------------------------- */
  const fromState = makeState();
  const toState = makeState();
  let preset = 'day';
  let transition = null;         // { startMs, duration }
  let model = null;
  let shadowsEnabled = false;
  let sweepAccum = 0;
  let aerialVisAccum = 0;
  let stats = { glassMaterials: 0, aerialLights: 0 };

  writeStateFromPreset('day', toState);
  cacheCurrentInto(fromState, toState, 1);

  function applyEffective(e) {
    const t = clamp01(e);
    const lc = (out, a, b) => out.lerpColors(a, b, t);
    const ln = (a, b) => THREE.MathUtils.lerp(a, b, t);
    const lv = (out, a, b) => out.lerpVectors(a, b, t);

    // 天空
    lc(skyUniforms.uZenith.value, fromState.skyZenith, toState.skyZenith);
    lc(skyUniforms.uHorizon.value, fromState.skyHorizon, toState.skyHorizon);
    lc(skyUniforms.uGround.value, fromState.skyGround, toState.skyGround);
    skyUniforms.uHaze.value = ln(fromState.skyHaze, toState.skyHaze);
    lv(skyUniforms.uSunDir.value, fromState.sunDir, toState.sunDir);
    if (skyUniforms.uSunDir.value.lengthSq() < 1e-6) skyUniforms.uSunDir.value.set(0, 1, 0);
    else skyUniforms.uSunDir.value.normalize();
    lc(skyUniforms.uSunColor.value, fromState.sunDiskColor, toState.sunDiskColor);
    skyUniforms.uSunI.value = ln(fromState.sunDisk, toState.sunDisk);
    lv(skyUniforms.uMoonDir.value, fromState.moonDir, toState.moonDir);
    if (skyUniforms.uMoonDir.value.lengthSq() < 1e-6) skyUniforms.uMoonDir.value.set(0, 1, 0);
    else skyUniforms.uMoonDir.value.normalize();
    lc(skyUniforms.uMoonColor.value, fromState.moonDiskColor, toState.moonDiskColor);
    skyUniforms.uMoonI.value = ln(fromState.moonDisk, toState.moonDisk);
    skyUniforms.uStars.value = ln(fromState.stars, toState.stars);

    // 雾 / 背景 / 曝光
    if (scene) {
      if (!scene.background || scene.background.isColor) {
        if (!scene.background) scene.background = new THREE.Color();
        scene.background.lerpColors(fromState.background, toState.background, t);
      }
      if (scene.fog) {
        scene.fog.color.lerpColors(fromState.fogColor, toState.fogColor, t);
        if (scene.fog.isFogExp2) scene.fog.density = ln(fromState.fogDensity, toState.fogDensity);
      } else {
        scene.fog = new THREE.FogExp2(0x0a1826, toState.fogDensity);
        scene.fog.color.lerpColors(fromState.fogColor, toState.fogColor, t);
      }
    }
    if (renderer) renderer.toneMappingExposure = ln(fromState.exposure, toState.exposure);
    if (scene && typeof scene.environmentIntensity === 'number') {
      scene.environmentIntensity = ln(fromState.environment, toState.environment);
    }

    // 灯光接管（只改已有灯，不 add 新灯）
    if (sun) {
      sun.color.lerpColors(fromState.sunColor, toState.sunColor, t);
      sun.intensity = ln(fromState.sunIntensity, toState.sunIntensity);
      sun.position.lerpVectors(fromState.sunPos, toState.sunPos, t);
      if (sun.target && sun.target.isObject3D) sun.target.updateMatrixWorld();
    }
    if (ambient) {
      if (ambient.color) ambient.color.lerpColors(fromState.ambientSky, toState.ambientSky, t);
      if (ambient.groundColor) ambient.groundColor.lerpColors(fromState.ambientGround, toState.ambientGround, t);
      ambient.intensity = ln(fromState.ambientIntensity, toState.ambientIntensity);
    }
    if (fill) {
      if (fill.color) fill.color.lerpColors(fromState.fillColor, toState.fillColor, t);
      fill.intensity = ln(fromState.fillIntensity, toState.fillIntensity);
      if (fill.position) fill.position.lerpVectors(fromState.fillPos, toState.fillPos, t);
    }

    // 后处理 bloom
    if (bloomPass) {
      bloomPass.strength = ln(fromState.bloomStrength, toState.bloomStrength);
      bloomPass.threshold = ln(fromState.bloomThreshold, toState.bloomThreshold);
      bloomPass.radius = ln(fromState.bloomRadius, toState.bloomRadius);
      bloomPass.enabled = bloomPass.strength > 0.02;
    }

    // 窗光 + 天空夜间系数
    const night = ln(fromState.night, toState.night);
    winUniforms.uNight.value = night;
    skyUniforms.uNight.value = night;
    windowNight = night;
  }

  let windowNight = 0;

  const atmo = {
    get preset() { return preset; },
    get transitioning() { return Boolean(transition); },
    get warnings() { return warnings.slice(); },
    get stats() { return { ...stats }; },
    get model() { return model; },
    sun,
    ambient,
    fill,
    sky,
    composer,
    bloom: bloomPass,
    skyUniforms,
    windowUniforms: winUniforms,
    aerialGroup,

    setPreset(name) {
      const next = ATMOSPHERE_PRESETS.includes(name) ? name : 'day';
      if (!ATMOSPHERE_PRESETS.includes(name)) warn(`未知预设 ${name}，回退 day`);
      if (next === preset && !transition) {
        return preset;
      }
      // 从「当前实际状态」继续过渡，避免快速连点时跳变
      const currentE = transition ? clamp01((nowMs() - transition.startMs) / transition.duration) : 1;
      cacheCurrentInto(fromState, toState, easeInOutCubic(currentE));
      writeStateFromPreset(next, toState);
      transition = { startMs: nowMs(), duration: TRANSITION_MS };
      preset = next;
      return preset;
    },

    cyclePreset() {
      return atmo.setPreset(NEXT_PRESET[preset] || 'day');
    },

    /** 英雄 GLB 加载完成后调用；可重复调用（幂等）。 */
    setModel(nextModel) {
      if (!nextModel || typeof nextModel.traverse !== 'function') {
        warn('setModel 收到无效模型，已忽略');
        return stats;
      }
      model = nextModel;
      const sweep = sweepGlassMaterials(model, winUniforms);
      const aerial = buildAerialLights(model);
      // 幂等：重复 setModel 时 glassMaterials 仍报「已接管」总数，而非本次新注入数
      stats = { glassMaterials: sweep.handled, aerialLights: aerial };
      return stats;
    },

    /** 单独补注玻璃材质（调试 / 材质被外部 clone 后手动刷新）。 */
    refreshWindows() {
      if (!model) return 0;
      const sweep = sweepGlassMaterials(model, winUniforms);
      if (sweep.injected > 0) stats = { ...stats, glassMaterials: sweep.handled };
      return sweep.injected;
    },

    setShadows(on) {
      shadowsEnabled = Boolean(on);
      if (sun) sun.castShadow = shadowsEnabled;
      return shadowsEnabled;
    },

    update(dt, now) {
      const delta = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.25) : 0;
      const nowValue = Number.isFinite(now) ? now : nowMs();
      if (transition) {
        const raw = clamp01((nowValue - transition.startMs) / transition.duration);
        applyEffective(easeInOutCubic(raw));
        if (raw >= 1) transition = null;
      }
      if (sky) {
        skyUniforms.uTime.value += delta;
        if (camera) sky.position.copy(camera.position);
      }
      // 塔顶航空灯闪烁（只在夜间/黄昏可见）
      if (aerialLights.length && nowValue >= 0) {
        const seconds = nowValue / 1000;
        for (const entry of aerialLights) {
          const phase = entry.sprite.userData.phase || 0;
          const period = entry.sprite.userData.period || 1.4;
          const f = ((seconds / period) + phase) % 1;
          const pulse = Math.exp(-Math.pow((f - 0.16) / 0.10, 2)); // 短促闪亮
          const opacity = windowNight * (0.10 + 0.90 * pulse);
          entry.sprite.material.opacity = opacity;
          entry.sprite.visible = opacity > 0.02;
        }
      }
      // 楼层模式主工程会逐 mesh 隐藏 A–F 塔楼：此时航空灯一并隐藏，退出后恢复
      if (aerialLights.length && towerMeshes.length) {
        aerialVisAccum += delta;
        if (aerialVisAccum >= 0.4) {
          aerialVisAccum = 0;
          let anyTowerVisible = false;
          for (const mesh of towerMeshes) {
            if (mesh && mesh.visible) { anyTowerVisible = true; break; }
          }
          aerialGroup.visible = anyTowerVisible;
        }
      }
      // 材质被外部 clone 后补注入（低频扫描，成本可忽略）
      if (model) {
        sweepAccum += delta * 1000;
        if (sweepAccum >= WINDOW_SWEEP_MS) {
          sweepAccum = 0;
          const sweep = sweepGlassMaterials(model, winUniforms);
          if (sweep.injected > 0) stats = { ...stats, glassMaterials: sweep.handled };
        }
      }
    },

    render() {
      if (!renderer) return;
      if (composer) composer.render();
      else renderer.render(scene, camera);
    },

    resize(width, height) {
      if (!composer) return;
      if (width > 0 && height > 0 && renderer) {
        composer.setPixelRatio(renderer.getPixelRatio ? renderer.getPixelRatio() : 1);
        composer.setSize(width, height);
      }
    },

    dispose() {
      disposeAerialLights();
      if (sky && scene) {
        scene.remove(sky);
        sky.geometry.dispose();
        sky.material.dispose();
      }
      if (bloomPass && bloomPass.dispose) bloomPass.dispose();
      if (composer && composer.dispose) composer.dispose();
      if (glowTexture) glowTexture.dispose();
    },
  };

  // 初始状态立即生效（setPreset('day') 之前也可安全使用）
  applyEffective(1);
  if (sun) {
    sun.castShadow = Boolean(sun.castShadow);
    shadowsEnabled = Boolean(sun.castShadow);
  }
  return atmo;
}

function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

export default createAtmosphere;
