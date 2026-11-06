/**
 * world/fx.js —— 雨夜动态氛围（fx-artist 负责）
 *
 * 1) 持续降雨：1 个 InstancedMesh + 顶点着色器循环下落（几千条细长 billboard 雨丝），
 *    斜落 / 速度随机 / 近疏远密 / 冷色半透明，经过店前暖光、路灯、贩卖机、霓虹时被染亮。
 * 2) 地面溅落涟漪 + 积水涟漪 + 屋檐滴水落点：合成 1 个 InstancedMesh（缩放扩散的圆环）。
 * 3) 屋檐滴水：handles.dripPoints（没有就按 L.store.canopy 外缘自己算），偶发下落 + 落地涟漪。
 * 4) 玻璃雨水：正面玻璃 / 自动门前各叠一片程序化 shader（水珠蜿蜒滑落 + 静态水珠 + 水膜），
 *    自动门打开时门片淡出。
 * 5) 招牌 / 灯箱偶发微闪（handles.flickerMats / flickerLights，没有就从 main-sign 兜底找）。
 * 6) 自动门 20~40s 一次开合（handles.door），开门时门口暖光略强 + 地面暖光溢出。
 * 7) 可选：关东煮 / 咖啡机蒸汽（handles.steamSources）、路灯下雨雾光锥、雨量缓慢呼吸。
 *
 * 性能约定：雨 / 水花 / 涟漪全部靠实例属性 + GPU 顶点着色器动画，update 里不 new 对象、
 *           不逐帧上传矩阵；整个模块 7~8 个 draw call。
 */
import * as THREE from 'three';
import { E, L, rng } from '../config.js';
import { group } from '../lib/kit.js';
import { glowTexture } from '../lib/toon.js';

const TAU = Math.PI * 2;
const SO = E.storeOffset;
const STORE = {
  ...L.store,
  minX: L.store.minX + SO.dx,
  maxX: L.store.maxX + SO.dx,
  minZ: L.store.minZ + SO.dz,
  maxZ: L.store.maxZ + SO.dz,
  canopy: { ...L.store.canopy, x0: L.store.canopy.x0 + SO.dx, x1: L.store.canopy.x1 + SO.dx, z0: L.store.canopy.z0 + SO.dz, z1: L.store.canopy.z1 + SO.dz },
};

/* ========================================================================== */
/*  小工具                                                                     */
/* ========================================================================== */

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smooth01(v) {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
}

/** 地面标高：地块 / 远侧人行道 0.12，马路 0 */
function groundYAt(x, z) {
  if (z > E.river.minZ && z < E.river.maxZ) return E.river.y;
  const onEW = z > E.road.ew.minZ && z < E.road.ew.maxZ;
  const onNS = x > E.road.ns.minX && x < E.road.ns.maxX;
  if (onEW || onNS) return 0.0;
  return 0.12;
}

function inStore(x, z) {
  const S = STORE;
  return x > S.minX && x < S.maxX && z > S.minZ && z < S.maxZ;
}

function inCanopy(x, z) {
  const c = STORE.canopy;
  return x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1;
}

/**
 * 1×1 面片 + 自定义实例属性。所有粒子都用同一套几何，动画全在顶点着色器里算，
 * 每帧只更新 uniform（时间 / 强度），不碰 instanceMatrix。
 */
function instancedQuad(count, attributes) {
  const src = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = src.index;
  geo.setAttribute('position', src.getAttribute('position'));
  geo.setAttribute('uv', src.getAttribute('uv'));
  for (const key of Object.keys(attributes)) {
    const spec = attributes[key];
    geo.setAttribute(key, new THREE.InstancedBufferAttribute(spec.data, spec.size));
  }
  geo.instanceCount = count;
  return geo;
}

function fxMesh(geometry, material, renderOrder) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = renderOrder;
  mesh.userData.isFx = true;
  return mesh;
}

/* ========================================================================== */
/*  1. 降雨                                                                    */
/* ========================================================================== */

const RAIN_TOP = 10.0;

const RAIN_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uTop;
  uniform float uBottom;
  uniform vec2  uWind;
  uniform vec4  uStoreBox;
  uniform vec4  uBlockBox0;
  uniform float uBlockY0;
  uniform vec4  uBlockBox1;
  uniform float uBlockY1;
  uniform vec4  uBlockBox2;
  uniform float uBlockY2;
  uniform vec2  uAreaMin;
  uniform vec2  uAreaMax;
  uniform float uStoreRoofY;
  uniform vec4  uCanopyBox;
  uniform float uCanopyY;
  uniform vec3  uBaseColor;
  uniform vec3  uLightPos[6];
  uniform vec3  uLightColor[6];
  uniform float uLightRadius[6];

  attribute vec4 aA;   // x, z, 每秒下落圈数, 相位
  attribute vec4 aB;   // 长度, 宽度, 亮度, 受灯光影响的增益
  attribute vec2 aC;   // 每根雨丝自己的风斜倍率 x/z（让每根雨丝倾斜略有差别）

  varying vec3  vColor;
  varying float vAlpha;
  varying vec2  vUv;

  void main() {
    vUv = uv;
    float x = aA.x;
    float z = aA.y;

    // 落到屋顶 / 雨棚上的雨丝到此为止：不会穿过屋顶掉进店里
    float floorY = uBottom;
    if ( x > uStoreBox.x && x < uStoreBox.y && z > uStoreBox.z && z < uStoreBox.w ) {
      floorY = uStoreRoofY;
    } else if ( x > uCanopyBox.x && x < uCanopyBox.y && z > uCanopyBox.z && z < uCanopyBox.w ) {
      floorY = uCanopyY;
    }
    if ( x > uBlockBox0.x && x < uBlockBox0.y && z > uBlockBox0.z && z < uBlockBox0.w ) floorY = max( floorY, uBlockY0 );
    if ( x > uBlockBox1.x && x < uBlockBox1.y && z > uBlockBox1.z && z < uBlockBox1.w ) floorY = max( floorY, uBlockY1 );
    if ( x > uBlockBox2.x && x < uBlockBox2.y && z > uBlockBox2.z && z < uBlockBox2.w ) floorY = max( floorY, uBlockY2 );
    float span = max( uTop - floorY, 0.001 );
    float cyc = fract( aA.w + uTime * aA.z );
    vec3 base = vec3( x, uTop - cyc * span, z );

    // 斜向雨丝（整体风斜 + 每根自己的倍率）；宽度方向 = 下落方向 × 视线方向
    vec3 fallDir = normalize( vec3( uWind.x * aC.x, -1.0, uWind.y * aC.y ) );
    vec3 toCam = cameraPosition - base;
    float camDist = length( toCam );
    vec3 side = normalize( cross( fallDir, toCam / max( camDist, 0.001 ) ) + vec3( 0.0001, 0.0, 0.0 ) );

    // 远处雨丝更细、更短（细密雨幕），近处略粗但更淡（不抢戏）
    float nearness = 1.0 - smoothstep( 5.0, 19.0, camDist );
    float lenScale = mix( 0.82, 1.1, nearness );
    float widScale = mix( 0.85, 1.1, nearness );

    vec3 wp = base + side * ( position.x * aB.y * widScale ) + fallDir * ( position.y * aB.x * lenScale );
    gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );

    // 太贴脸的、刚好在循环端点的、雨幕边缘的雨丝淡出
    float fadeNear = smoothstep( 0.9, 4.5, camDist );
    float fadeEnds = smoothstep( 0.0, 0.06, cyc ) * ( 1.0 - smoothstep( 0.93, 1.0, cyc ) );
    float fadeFar = exp( -camDist * 0.012 );
    float edge = min( min( aA.x - uAreaMin.x, uAreaMax.x - aA.x ), min( aA.y - uAreaMin.y, uAreaMax.y - aA.y ) );
    float fadeRim = smoothstep( 0.0, 0.55, edge );
    float alphaDist = mix( 1.0, 0.55, nearness );
    vAlpha = aB.z * fadeNear * fadeEnds * fadeFar * fadeRim * alphaDist * uIntensity;

    // 被店前暖光 / 雨棚灯 / 路灯 / 贩卖机 / 霓虹染亮 —— 雨丝的"层次"
    vec3 lit = vec3( 0.0 );
    for ( int i = 0; i < 6; i ++ ) {
      float d = length( base - uLightPos[ i ] );
      float f = 1.0 - smoothstep( uLightRadius[ i ] * 0.2, uLightRadius[ i ], d );
      lit += uLightColor[ i ] * f;
    }
    vColor = uBaseColor + lit * ( aB.w * 1.35 );
  }
`;

const RAIN_FRAG = /* glsl */ `
  varying vec3  vColor;
  varying float vAlpha;
  varying vec2  vUv;

  void main() {
    // 条带横向柔边 + 沿长度收细（雨滴头部更亮、尾部渐隐）
    float edge = smoothstep( 0.0, 0.42, vUv.x ) * ( 1.0 - smoothstep( 0.58, 1.0, vUv.x ) );
    float taper = 1.0 - 0.6 * vUv.y;
    float a = vAlpha * edge * taper;
    if ( a < 0.0025 ) discard;
    gl_FragColor = vec4( vColor, a );
  }
`;

/** 会被雨丝"照亮"的光球（纯着色计算，不加真实光源） */
const RAIN_LIGHTS = [
  { p: [SO.dx + 0.3, 2.6, SO.dz + 3.0], r: 4.0, color: '#ffcf94', gain: 0.8 },
  { p: [4.4, 2.4, 2.8], r: 3.0, color: '#ff8a5c', gain: 0.75 },
  { p: [8.0, 2.4, 2.8], r: 3.0, color: '#ffb45e', gain: 0.7 },
  { p: [-9.5, 2.6, 6.0], r: 3.2, color: '#ff6f5c', gain: 0.55 },
  { p: [-6.7, 2.6, -2.9], r: 3.2, color: '#ffcf94', gain: 0.5 },
  { p: [10.0, 2.6, 5.6], r: 2.8, color: '#9fd8ff', gain: 0.45 },
];

function buildRain(quality) {
  const count = quality.isMobile ? 1300 : 2900;
  const rand = rng(202601);
  const aA = new Float32Array(count * 4);
  const aB = new Float32Array(count * 4);
  const aC = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    const i4 = i * 4;
    const i2 = i * 2;
    aA[i4] = E.bounds.minX + rand() * (E.bounds.maxX - E.bounds.minX);
    aA[i4 + 1] = E.bounds.minZ + rand() * (E.bounds.maxZ - E.bounds.minZ);
    aA[i4 + 2] = 0.85 + rand() * 1.35; // 下落速度差别大一点
    aA[i4 + 3] = rand();
    aB[i4] = 0.2 + Math.pow(rand(), 1.4) * 0.9; // 长度：多短丝 + 少量长丝
    aB[i4 + 1] = 0.017 + rand() * 0.013;
    aB[i4 + 2] = 0.078 + rand() * 0.17; // 只有原来一半左右的亮度
    aB[i4 + 3] = 0.3 + rand() * 0.55;
    aC[i2] = 0.55 + rand() * 0.9; // 每根雨丝的风斜差异
    aC[i2 + 1] = 0.5 + rand() * 1.0;
  }

  const lightPos = [];
  const lightColor = [];
  const lightRadius = new Float32Array(RAIN_LIGHTS.length);
  RAIN_LIGHTS.forEach((cfg, i) => {
    lightPos.push(new THREE.Vector3(cfg.p[0], cfg.p[1], cfg.p[2]));
    const c = new THREE.Color(cfg.color).multiplyScalar(cfg.gain);
    lightColor.push(new THREE.Vector3(c.r, c.g, c.b));
    lightRadius[i] = cfg.r;
  });

  const S = STORE;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uTop: { value: RAIN_TOP },
      uBottom: { value: 0.0 },
      uWind: { value: new THREE.Vector2(0.5, 0.16) },
      uStoreBox: { value: new THREE.Vector4(S.minX, S.maxX, S.minZ, S.maxZ) },
      uStoreRoofY: { value: S.parapetY + 0.1 },
      uCanopyBox: { value: new THREE.Vector4(S.canopy.x0, S.canopy.x1, S.canopy.z0, S.canopy.z1) },
      uCanopyY: { value: S.canopy.y + 0.06 },
      uBlockBox0: { value: new THREE.Vector4(2.8, 10.4, 2.8, 6.2) },
      uBlockY0: { value: 3.4 },
      uBlockBox1: { value: new THREE.Vector4(E.bounds.minX, -2.6, E.bounds.minZ, -2.6) },
      uBlockY1: { value: 4.2 },
      uBlockBox2: { value: new THREE.Vector4(E.bounds.minX, -2.6, 2.8, E.river.minZ) },
      uBlockY2: { value: 4.6 },
      uAreaMin: { value: new THREE.Vector2(E.bounds.minX, E.bounds.minZ) },
      uAreaMax: { value: new THREE.Vector2(E.bounds.maxX, E.bounds.maxZ) },
      uBaseColor: { value: new THREE.Vector3(0.45, 0.57, 0.82) },
      uLightPos: { value: lightPos },
      uLightColor: { value: lightColor },
      uLightRadius: { value: lightRadius },
    },
    vertexShader: RAIN_VERT,
    fragmentShader: RAIN_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    fog: false,
  });

  const mesh = fxMesh(
    instancedQuad(count, { aA: { data: aA, size: 4 }, aB: { data: aB, size: 4 }, aC: { data: aC, size: 2 } }),
    material,
    30,
  );
  mesh.name = 'fx-rain';
  mesh.update = (t) => {
    material.uniforms.uTime.value = t;
    // 雨量极缓慢的呼吸
    material.uniforms.uIntensity.value = 1.0 + 0.12 * Math.sin(t * 0.055 + 1.2) * Math.sin(t * 0.017);
  };
  return { mesh, count };
}

/* ========================================================================== */
/*  2/3. 地面溅落 + 积水 + 屋檐落点 —— 统一实例化涟漪                            */
/* ========================================================================== */

const RIPPLE_MAX = 660;

const RIPPLE_VERT = /* glsl */ `
  uniform float uTime;

  attribute vec3 aC;   // 落点
  attribute vec4 aP;   // 起始(0~1), 频率(圈/秒), 持续(0~1), 相位
  attribute vec4 aQ;   // 最大半径, 强度, 环宽, 内圈比例

  varying vec2  vUv;
  varying float vProg;
  varying float vAlpha;
  varying float vWidth;
  varying float vInner;

  void main() {
    vUv = uv;
    float q = fract( aP.w + uTime * aP.y );
    float p = ( q - aP.x ) / max( aP.z, 0.0001 );
    float prog = clamp( p, 0.0, 1.0 );
    float alive = step( 0.0, p ) * step( p, 1.0 );
    vProg = prog;
    vAlpha = aQ.y * alive * pow( 1.0 - prog, 1.5 );
    vWidth = aQ.z;
    vInner = aQ.w;

    vec3 wp = aC + vec3( position.x, 0.0, position.y ) * aQ.x * 2.0;
    gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
  }
`;

const RIPPLE_FRAG = /* glsl */ `
  varying vec2  vUv;
  varying float vProg;
  varying float vAlpha;
  varying float vWidth;
  varying float vInner;

  void main() {
    float d = length( ( vUv - 0.5 ) * 2.0 );
    float ring = 1.0 - smoothstep( 0.0, vWidth, abs( d - vProg ) );
    float ring2 = 1.0 - smoothstep( 0.0, vWidth * 0.7, abs( d - vProg * vInner ) );
    float a = ( ring + ring2 * 0.5 ) * vAlpha * 0.55;
    if ( a < 0.003 ) discard;
    gl_FragColor = vec4( vec3( 0.35, 0.5, 0.85 ), a );
  }
`;

function buildRipples(ctx, quality, dripLandings) {
  const rand = rng(7731);
  const aC = new Float32Array(RIPPLE_MAX * 3);
  const aP = new Float32Array(RIPPLE_MAX * 4);
  const aQ = new Float32Array(RIPPLE_MAX * 4);
  let n = 0;

  const push = (x, y, z, start, rate, duration, phase, maxR, alpha, width, inner) => {
    if (n >= RIPPLE_MAX) return;
    const i3 = n * 3;
    const i4 = n * 4;
    aC[i3] = x;
    aC[i3 + 1] = y;
    aC[i3 + 2] = z;
    aP[i4] = start;
    aP[i4 + 1] = rate;
    aP[i4 + 2] = duration;
    aP[i4 + 3] = phase;
    aQ[i4] = maxR;
    aQ[i4 + 1] = alpha;
    aQ[i4 + 2] = width;
    aQ[i4 + 3] = inner;
    n += 1;
  };

  // ---- 雨点砸地的小涟漪 ----
  const splashes = quality.isMobile ? 170 : 340;
  for (let i = 0; i < splashes; i += 1) {
    let x = 0;
    let z = 0;
    for (let k = 0; k < 10; k += 1) {
      x = -5.3 + rand() * 10.6;
      z = -5.3 + rand() * 10.6;
      if (!inStore(x, z) && !inCanopy(x, z)) break;
    }
    push(
      x,
      groundYAt(x, z) + 0.007,
      z,
      0,
      1.1 + rand() * 1.6,
      1,
      rand(),
      0.06 + rand() * 0.1,
      0.16 + rand() * 0.2,
      0.1,
      0.55,
    );
  }

  // ---- 地面积水上的同心圆 ----
  const puddles = [];
  ctx.scene.traverse((o) => {
    if (o.userData && o.userData.isPuddle) puddles.push(o);
  });
  const v = new THREE.Vector3();
  for (const puddle of puddles) {
    puddle.updateWorldMatrix(true, false);
    const rings = 12 + Math.floor(rand() * 8);
    for (let i = 0; i < rings; i += 1) {
      const rr = Math.sqrt(rand()) * 0.36;
      const th = rand() * TAU;
      v.set(Math.cos(th) * rr, Math.sin(th) * rr, 0).applyMatrix4(puddle.matrixWorld);
      push(
        v.x,
        v.y + 0.004,
        v.z,
        0,
        0.55 + rand() * 0.85,
        1,
        rand(),
        0.09 + rand() * 0.13,
        0.24 + rand() * 0.2,
        0.08,
        0.62,
      );
    }
  }

  // ---- 屋檐滴水落点 ----
  for (const d of dripLandings) {
    push(
      d.landX,
      d.landY + 0.006,
      d.landZ,
      d.fallFrac,
      1 / d.period,
      d.rippleFrac,
      d.phase,
      0.09 + rand() * 0.09,
      0.3,
      0.1,
      0.55,
    );
  }

  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: RIPPLE_VERT,
    fragmentShader: RIPPLE_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });

  const mesh = fxMesh(
    instancedQuad(n, { aC: { data: aC, size: 3 }, aP: { data: aP, size: 4 }, aQ: { data: aQ, size: 4 } }),
    material,
    10,
  );
  mesh.name = 'fx-ripples';
  mesh.update = (t) => {
    material.uniforms.uTime.value = t;
  };
  return { mesh, count: n };
}

/* ========================================================================== */
/*  4. 屋檐滴水                                                                */
/* ========================================================================== */

const DRIP_VERT = /* glsl */ `
  uniform float uTime;

  attribute vec3 aC;   // 起点
  attribute vec4 aP;   // 周期(s), 相位, 下落占周期比例, 水滴大小
  attribute vec2 aQ;   // 下落距离, 横向摆动

  varying vec2  vUv;
  varying float vAlpha;

  void main() {
    vUv = uv;
    float period = max( aP.x, 0.2 );
    float q = fract( ( uTime + aP.y ) / period );
    float k = clamp( q / max( aP.z, 0.05 ), 0.0, 1.0 );
    float alive = step( q, aP.z + 0.0001 );

    vec3 wp = aC + vec3( sin( q * 21.0 + aP.y * 3.0 ) * aQ.y, -k * aQ.x, 0.0 );

    vec4 mv = modelViewMatrix * vec4( wp, 1.0 );
    mv.xy += position.xy * vec2( aP.w, aP.w * 2.6 );
    gl_Position = projectionMatrix * mv;

    vAlpha = alive * smoothstep( 0.0, 0.045, k ) * ( 1.0 - smoothstep( 0.9, 1.0, k ) );
  }
`;

const DRIP_FRAG = /* glsl */ `
  varying vec2  vUv;
  varying float vAlpha;

  void main() {
    float d = length( vUv - 0.5 ) * 2.0;
    float a = ( 1.0 - smoothstep( 0.28, 1.0, d ) ) * vAlpha;
    if ( a < 0.004 ) discard;
    gl_FragColor = vec4( vec3( 0.76, 0.87, 1.0 ) * 1.1, a );
  }
`;

function buildDrips(handles) {
  const rand = rng(451);
  const points = [];
  const hp = handles.dripPoints;
  if (Array.isArray(hp) && hp.length) {
    for (const raw of hp) {
      if (points.length >= 26) break;
      if (!raw) continue;
      const v = raw.isVector3 ? raw : new THREE.Vector3(raw.x, raw.y, raw.z);
      if (Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)) {
        points.push(new THREE.Vector3(v.x, v.y, v.z));
      }
    }
  }
  if (!points.length) {
    // handles 还没填：按雨棚外缘自己算一排滴水点
    const c = STORE.canopy;
    const num = 8;
    for (let i = 0; i < num; i += 1) {
      const x = c.x0 + 0.1 + (c.x1 - c.x0 - 0.2) * (i / (num - 1)) + (rand() - 0.5) * 0.09;
      points.push(new THREE.Vector3(x, c.y - 0.05, c.z1 + 0.004));
    }
  }

  const count = points.length;
  const drips = [];
  for (const p of points) {
    const period = 1.4 + rand() * 3.0;
    const fallFrac = 0.14 + rand() * 0.16;
    // 落点：屋顶 / 雨棚 / 地面（不能让水珠穿过雨棚）
    const canopy = STORE.canopy;
    let landY;
    if (inStore(p.x, p.z) && p.y > STORE.parapetY) landY = STORE.parapetY + 0.04;
    else if (inCanopy(p.x, p.z) && p.y > canopy.y + 0.05) landY = canopy.y + 0.05;
    else landY = groundYAt(p.x, p.z) + 0.004;
    const fallDist = Math.max(0.25, p.y - landY);
    drips.push({
      startX: p.x,
      startY: p.y,
      startZ: p.z,
      period,
      phase: rand(),
      fallFrac,
      size: 0.015 + rand() * 0.01,
      fallDist,
      wobble: (rand() - 0.5) * 0.02,
      landX: p.x,
      landY,
      landZ: p.z,
      rippleFrac: Math.min(0.42, 0.45 / period),
    });
  }

  const aC = new Float32Array(count * 3);
  const aP = new Float32Array(count * 4);
  const aQ = new Float32Array(count * 2);
  drips.forEach((d, i) => {
    const i3 = i * 3;
    const i4 = i * 4;
    aC[i3] = d.startX;
    aC[i3 + 1] = d.startY;
    aC[i3 + 2] = d.startZ;
    aP[i4] = d.period;
    aP[i4 + 1] = d.phase;
    aP[i4 + 2] = d.fallFrac;
    aP[i4 + 3] = d.size;
    aQ[i * 2] = d.fallDist;
    aQ[i * 2 + 1] = d.wobble;
  });

  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: DRIP_VERT,
    fragmentShader: DRIP_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const mesh = fxMesh(instancedQuad(count, { aC: { data: aC, size: 3 }, aP: { data: aP, size: 4 }, aQ: { data: aQ, size: 2 } }), material, 22);
  mesh.name = 'fx-drips';
  mesh.update = (t) => {
    material.uniforms.uTime.value = t;
  };
  return { mesh, drips, count };
}

/* ========================================================================== */
/*  5. 玻璃雨水 shader                                                          */
/* ========================================================================== */

const GLASS_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`;

const GLASS_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uAspect;

  varying vec2 vUv;

  float hash21( vec2 p ) {
    p = fract( p * vec2( 123.34, 456.21 ) );
    p += dot( p, p + 45.32 );
    return fract( p.x * p.y );
  }

  float hash11( float p ) {
    p = fract( p * 0.1031 );
    p *= p + 33.33;
    p *= p + p;
    return fract( p );
  }

  void main() {
    vec2 uv = vUv;
    // 水痕是"暗"的（折射了外面的夜色），水珠高光是"亮"的，两种分开累计
    vec3 darkCol = vec3( 0.09, 0.13, 0.2 );
    vec3 brightCol = vec3( 0.78, 0.9, 1.05 );
    float darkA = 0.0;
    float brightA = 0.0;

    // ---- 缓慢下滑的水珠 + 身后拖出的水痕（两层，速度不同） ----
    for ( int i = 0; i < 2; i ++ ) {
      float fi = float( i );
      float cols = 8.0 + fi * 6.0;
      float cid = floor( uv.x * cols );
      float cw = 1.0 / cols;
      float h1 = hash21( vec2( cid, fi * 7.31 + 1.7 ) );
      float h2 = hash21( vec2( cid + 3.1, fi * 3.7 + 2.3 ) );
      float speed = ( 0.012 + h1 * 0.024 ) * ( 1.0 + fi * 0.85 );
      float headY = 1.0 - fract( h2 + uTime * speed );
      float cx = ( cid + 0.5 ) * cw + ( h1 - 0.5 ) * cw * 0.55;

      // 蜿蜒：路径随高度左右摇摆
      float pathX = cx + sin( uv.y * 15.0 + h1 * 9.0 + uTime * 0.55 ) * ( 0.0018 + h2 * 0.0024 );
      float dx = abs( uv.x - pathX );
      float line = 1.0 - smoothstep( 0.0008, 0.0030 + fi * 0.0012, dx );

      float trailLen = 0.09 + h2 * 0.2;
      float ty = ( uv.y - headY ) / trailLen;
      float inTrail = step( 0.0, ty ) * step( ty, 1.0 );

      float lw = 0.48 - fi * 0.14;
      // 水痕主体（暗）
      darkA += line * inTrail * pow( clamp( 1.0 - ty, 0.0, 1.0 ), 1.7 ) * lw * 1.0;

      // 水珠头部（亮）
      vec2 hp = vec2( ( uv.x - cx ) * uAspect, uv.y - headY );
      float head = 1.0 - smoothstep( 0.010, 0.023, length( hp ) );
      brightA += head * lw * 0.85;
      // 头部下方一小截也更亮
      brightA += line * inTrail * ( 1.0 - smoothstep( 0.0, 0.28, ty ) ) * lw * 0.3;
    }

    // ---- 静止的细小水珠（凝结，稀疏/错位摆放，别像雪花） ----
    vec2 cell = uv * vec2( 34.0, 18.0 );
    vec2 gid = floor( cell );
    vec2 jitter = vec2( hash21( gid + 3.1 ), hash21( gid + 9.7 ) ) - 0.5;
    vec2 gf = fract( cell ) - 0.5 - jitter * 0.55;
    float hb = hash21( gid + 17.7 );
    float beadRadius = 0.04 + 0.07 * hash21( gid + 4.1 );
    float bead = ( 1.0 - smoothstep( beadRadius * 0.5, beadRadius, length( vec2( gf.x * uAspect * 0.5, gf.y ) ) ) ) * step( 0.91, hb );
    brightA += bead * 0.035;

    // ---- 整体水膜 / 竖向水痕（暗） ----
    float cols3 = 34.0;
    float c3 = floor( uv.x * cols3 );
    float h3 = hash11( c3 * 1.7 + 3.0 );
    float film = smoothstep( 0.6, 0.98, h3 ) * ( 0.55 + 0.45 * sin( uv.y * 9.0 + h3 * 30.0 ) );
    darkA += film * 0.055;

    // ---- 玻璃内侧透出的暖光让水珠偏暖 ----
    vec3 warm = vec3( 1.0, 0.82, 0.52 );
    brightCol = mix( brightCol, warm, ( 1.0 - smoothstep( 0.1, 0.95, uv.y ) ) * 0.35 );

    float aTotal = darkA + brightA;
    if ( aTotal < 0.004 ) discard;
    vec3 c = ( darkCol * darkA + brightCol * brightA ) / aTotal;
    gl_FragColor = vec4( c, min( aTotal, 1.0 ) * uOpacity );
  }
`;

function buildGlassRain() {
  const S = STORE;
  const g = group('glass-rain');
  const width = S.windowX1 - S.windowX0;
  const height = S.glassY1 - S.glassY0;
  const z = S.maxZ + 0.014;

  const makeMat = (w, opacity) =>
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: opacity },
        uAspect: { value: w / height },
      },
      vertexShader: GLASS_VERT,
      fragmentShader: GLASS_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      fog: false,
    });

  const winMat = makeMat(width, 0.28);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(width, height), winMat);
  win.position.set((S.windowX0 + S.windowX1) / 2, (S.glassY0 + S.glassY1) / 2, z);
  win.renderOrder = 20;
  win.userData.isFx = true;
  win.name = 'fx-glass-rain-window';
  g.add(win);

  const doorWidth = S.doorX1 - S.doorX0;
  const doorMat = makeMat(doorWidth, 0.24);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(doorWidth, height), doorMat);
  door.position.set((S.doorX0 + S.doorX1) / 2, (S.glassY0 + S.glassY1) / 2, z);
  door.renderOrder = 21;
  door.userData.isFx = true;
  door.name = 'fx-glass-rain-door';
  g.add(door);

  return { group: g, winMat, doorMat, baseDoorOpacity: 0.24 };
}

/* ========================================================================== */
/*  6. 招牌 / 灯箱微闪                                                          */
/* ========================================================================== */

function buildFlicker(handles, scene) {
  const rand = rng(7719);
  const items = [];
  const seen = new Set();

  const addMat = (mat, base) => {
    if (!mat || !mat.color || seen.has(mat.uuid)) return;
    seen.add(mat.uuid);
    const baseColor = base && base.isColor ? base.clone() : mat.color.clone();
    const baseScalar = typeof base === 'number' ? base : null;
    items.push({
      kind: 'mat',
      mat,
      baseColor,
      baseScalar,
      next: 6 + rand() * 14,
      t0: -1,
      dur: 0.6,
      depth: 0.08,
      pulses: 2,
    });
  };
  const addLight = (light, base) => {
    if (!light || seen.has(light.uuid)) return;
    seen.add(light.uuid);
    items.push({
      kind: 'light',
      light,
      base: typeof base === 'number' ? base : light.intensity,
      next: 10 + rand() * 22,
      t0: -1,
      dur: 0.6,
      depth: 0.07,
      pulses: 2,
    });
  };

  const scan = () => {
    for (const f of handles.flickerMats || []) if (f && f.mat) addMat(f.mat, f.base);
    for (const f of handles.flickerLights || []) if (f && f.light) addLight(f.light, f.base);
    // 兜底：Lead 还没填 handles 时，至少让主招牌极偶尔闪一下
    if (!items.length) {
      let found = null;
      scene.traverse((o) => {
        if (!found && o.isMesh && o.name === 'main-sign' && o.material && o.material.color) found = o;
      });
      if (found) addMat(found.material, found.material.color.r);
    }
  };
  scan();

  const apply = (it, mult) => {
    if (it.kind === 'mat') {
      if (it.baseScalar !== null) it.mat.color.setScalar(it.baseScalar * mult);
      else it.mat.color.copy(it.baseColor).multiplyScalar(mult);
    } else {
      it.light.intensity = it.base * mult;
    }
  };

  const update = (t) => {
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      if (it.t0 < 0) {
        if (t < it.next) continue;
        // 开始一次极短暂、极轻微的闪动
        it.t0 = t;
        it.dur = 0.35 + rand() * 0.85;
        it.depth = 0.05 + rand() * 0.09;
        it.pulses = 2 + Math.floor(rand() * 3);
      }
      const s = (t - it.t0) / it.dur;
      if (s >= 1) {
        apply(it, 1);
        it.t0 = -1;
        it.next = t + 10 + rand() * 24;
      } else {
        const m = 1 - it.depth * Math.abs(Math.sin(s * Math.PI * it.pulses));
        apply(it, m);
      }
    }
  };

  return { items, update, scan };
}

/* ========================================================================== */
/*  7. 自动门开合 + 门口暖光溢出                                                 */
/* ========================================================================== */

function buildDoor(handles) {
  const d = handles.door;
  if (!d || !d.left || !d.right) return null;

  const xOf = (val, fallback) => {
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (val && typeof val.x === 'number') return val.x;
    if (Array.isArray(val) && typeof val[0] === 'number') return val[0];
    return fallback;
  };
  const splitX = (val) => {
    if (Array.isArray(val)) {
      if (val.length >= 2 && (typeof val[0] === 'number' || (val[0] && typeof val[0].x === 'number'))) {
        return [xOf(val[0], null), xOf(val[1], null)];
      }
      const single = xOf(val, null);
      return [single, single];
    }
    const single = xOf(val, null);
    return [single, single];
  };

  const curLeft = d.left.position ? d.left.position.x : 0;
  const curRight = d.right.position ? d.right.position.x : 0;
  const closedRaw = splitX(d.closedX);
  const openRaw = splitX(d.openX);
  const closed = [closedRaw[0] ?? curLeft, closedRaw[1] ?? curRight];
  const open = [openRaw[0] ?? closed[0], openRaw[1] ?? closed[1]];
  if (Math.abs(open[0] - closed[0]) < 1e-4 && Math.abs(open[1] - closed[1]) < 1e-4) return null;

  const state = {
    open: 0,
    light: null,
    lightBase: 1,
    lightFound: false,
  };
  // 门口内侧的暖光（开门时稍微变亮）；刻意不选 canopy / sign 灯，避免和招牌微闪打架
  const lightTarget = new THREE.Vector3(
    (L.store.doorX0 + L.store.doorX1) / 2 + SO.dx,
    1.6,
    L.store.maxZ - 0.6 + SO.dz,
  );

  // 门口的暖光溢到湿地面上（开门时浮现）
  const S = STORE;
  const spillMat = new THREE.MeshBasicMaterial({
    map: glowTexture(),
    color: new THREE.Color('#ffb877'),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: true,
    fog: false,
  });
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), spillMat);
  spill.rotation.x = -Math.PI / 2;
  spill.position.set((S.doorX0 + S.doorX1) / 2, 0.131, S.maxZ + 0.72);
  spill.scale.set(3.6, 2.3, 1);
  spill.renderOrder = 7;
  spill.userData.isFx = true;
  spill.name = 'fx-door-spill';

  // 20~40s 一次：大多数时间关着，开 2s / 停 3s / 关 2s
  const period = 30;
  const update = (t) => {
    const ph = t % period;
    let k;
    if (ph < 23) k = 0;
    else if (ph < 25) k = smooth01((ph - 23) / 2);
    else if (ph < 28) k = 1;
    else k = 1 - smooth01((ph - 28) / 2);
    state.open = k;

    if (d.left.position) d.left.position.x = closed[0] + (open[0] - closed[0]) * k;
    if (d.right.position) d.right.position.x = closed[1] + (open[1] - closed[1]) * k;
    spillMat.opacity = k * 0.26;

    // 找到门口那盏 PointLight，开门时稍微变亮
    if (!state.lightFound) {
      state.lightFound = true;
      let best = null;
      let bestD = Infinity;
      const lights = handles.pointLights || [];
      for (let i = 0; i < lights.length; i += 1) {
        const dist = lights[i].position.distanceToSquared(lightTarget);
        if (dist < bestD) {
          bestD = dist;
          best = lights[i];
        }
      }
      if (best && bestD < 4.0) {
        state.light = best;
        state.lightBase = best.intensity;
      }
    }
    if (state.light) state.light.intensity = state.lightBase * (1 + 0.5 * k);
  };

  return { spill, update, state };
}

/* ========================================================================== */
/*  8. 店内蒸汽（关东煮 / 咖啡机）                                               */
/* ========================================================================== */

const STEAM_VERT = /* glsl */ `
  uniform float uTime;

  attribute vec3 aC;   // 源点
  attribute vec4 aP;   // 相位, 频率, 基础大小, 不透明度
  attribute vec3 aD;   // 漂移方向

  varying vec2  vUv;
  varying float vAlpha;

  void main() {
    vUv = uv;
    float q = fract( aP.x + uTime * aP.y );
    float grow = 0.45 + q * 2.8;
    vec3 wp = aC + aD * q
      + vec3( sin( q * 6.0 + aP.x * 9.0 ) * 0.05 * q, q * 0.6, cos( q * 5.0 + aP.x * 7.0 ) * 0.05 * q );
    vec4 mv = modelViewMatrix * vec4( wp, 1.0 );
    float sz = aP.z * grow;
    mv.xy += position.xy * vec2( sz, sz );
    gl_Position = projectionMatrix * mv;
    vAlpha = aP.w * sin( q * 3.14159 ) * ( 1.0 - q * 0.35 );
  }
`;

const STEAM_FRAG = /* glsl */ `
  varying vec2  vUv;
  varying float vAlpha;
  void main() {
    float d = length( vUv - 0.5 ) * 2.0;
    float a = pow( max( 1.0 - d, 0.0 ), 1.6 ) * vAlpha;
    if ( a < 0.004 ) discard;
    gl_FragColor = vec4( vec3( 0.9, 0.92, 0.95 ), a );
  }
`;

function buildSteam(handles, quality) {
  const sources = Array.isArray(handles.steamSources) ? handles.steamSources.filter(Boolean) : [];
  if (!sources.length) return null;
  const list = sources.slice(0, 4);
  const per = quality.isMobile ? 4 : 7;
  const count = list.length * per;
  const rand = rng(3119);
  const aC = new Float32Array(count * 3);
  const aP = new Float32Array(count * 4);
  const aD = new Float32Array(count * 3);
  let i = 0;
  for (const src of list) {
    const sx = src.x ?? 0;
    const sy = src.y ?? 1;
    const sz = src.z ?? 0;
    for (let k = 0; k < per; k += 1) {
      const i3 = i * 3;
      const i4 = i * 4;
      aC[i3] = sx + (rand() - 0.5) * 0.1;
      aC[i3 + 1] = sy;
      aC[i3 + 2] = sz + (rand() - 0.5) * 0.1;
      aP[i4] = rand();
      aP[i4 + 1] = 0.16 + rand() * 0.16;
      aP[i4 + 2] = 0.05 + rand() * 0.05;
      aP[i4 + 3] = 0.05 + rand() * 0.05;
      aD[i3] = (rand() - 0.5) * 0.12;
      aD[i3 + 1] = 0;
      aD[i3 + 2] = (rand() - 0.5) * 0.12;
      i += 1;
    }
  }
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: STEAM_VERT,
    fragmentShader: STEAM_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const mesh = fxMesh(instancedQuad(count, { aC: { data: aC, size: 3 }, aP: { data: aP, size: 4 }, aD: { data: aD, size: 3 } }), material, 25);
  mesh.name = 'fx-steam';
  mesh.update = (t) => {
    material.uniforms.uTime.value = t;
  };
  return { mesh, count };
}

/* ========================================================================== */
/*  9. 路灯下的雨雾光锥（极淡）                                                  */
/* ========================================================================== */

const CONE_VERT = /* glsl */ `
  uniform float uTime;
  varying vec2  vUv;
  varying float vH;

  void main() {
    vUv = uv;
    vH = position.y + 0.5;
    vec3 p = position;
    p.x += sin( uTime * 0.35 + vH * 5.0 ) * 0.02 * vH;
    p.z += cos( uTime * 0.29 + vH * 4.0 ) * 0.02 * vH;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
  }
`;

const CONE_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2  vUv;
  varying float vH;

  void main() {
    float n = 0.78 + 0.22 * sin( vUv.x * 26.0 + uTime * 0.5 ) * sin( vH * 9.0 - uTime * 0.33 );
    float a = pow( clamp( vH, 0.0, 1.0 ), 1.7 ) * n * 0.05;
    if ( a < 0.002 ) discard;
    gl_FragColor = vec4( vec3( 1.0, 0.82, 0.58 ), a );
  }
`;

function buildFogCone(quality) {
  if (quality.isMobile) return null;
  const lamp = { x: 2.2, y: 4.5, z: 2.2 };
  const apexY = lamp.y - 0.05;
  const height = apexY - 0.1;
  const geo = new THREE.ConeGeometry(1, 1, 24, 3, true);
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: CONE_VERT,
    fragmentShader: CONE_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.scale.set(1.9, height, 1.9);
  mesh.position.set(lamp.x, apexY - height / 2, lamp.z);
  mesh.renderOrder = 6;
  mesh.userData.isFx = true;
  mesh.name = 'fx-lamp-mist';
  mesh.update = (t) => {
    material.uniforms.uTime.value = t;
  };
  return { mesh };
}

/* ========================================================================== */
/*  主入口                                                                     */
/* ========================================================================== */

export function buildFx(ctx) {
  const g = group('fx');
  const { handles, scene, quality } = ctx;
  const updateFns = [];

  // ---- 雨 ----
  const rain = buildRain(quality);
  g.add(rain.mesh);
  updateFns.push((t) => rain.mesh.update(t));

  // ---- 屋檐滴水（先算落点，涟漪里要用）----
  const drips = buildDrips(handles);
  g.add(drips.mesh);
  updateFns.push((t) => drips.mesh.update(t));

  // ---- 地面 / 积水 / 滴水落点涟漪 ----
  const ripples = buildRipples(ctx, quality, drips.drips);
  g.add(ripples.mesh);
  updateFns.push((t) => ripples.mesh.update(t));

  // ---- 玻璃雨水 ----
  const glass = buildGlassRain();
  g.add(glass.group);
  const glassTimeUniforms = [];
  const refreshGlassHandle = () => {
    glassTimeUniforms.length = 0;
    const glassHandle = handles.glass;
    if (glassHandle && glassHandle.uniforms) {
      const keys = Object.keys(glassHandle.uniforms);
      for (let i = 0; i < keys.length; i += 1) {
        const u = glassHandle.uniforms[keys[i]];
        if (u && typeof u.value === 'number' && /time/i.test(keys[i])) glassTimeUniforms.push(u);
      }
    }
  };
  refreshGlassHandle();

  // ---- 招牌微闪 ----
  const flicker = buildFlicker(handles, scene);
  // main.js 在建完 fx 之后才填 handles.flickerLights，首帧补扫一次
  let flickerScanned = false;
  updateFns.push(() => {
    if (!flickerScanned) {
      flickerScanned = true;
      flicker.scan();
      if (handles.debug && handles.debug.fx) handles.debug.fx.flicker = flicker.items.length;
    }
  });
  updateFns.push((t) => flicker.update(t));

  // ---- 自动门 ----
  const door = buildDoor(handles);
  if (door) {
    g.add(door.spill);
    updateFns.push((t) => door.update(t));
  }

  // ---- 玻璃更新放在自动门之后（门片要随开门淡出）----
  updateFns.push((t) => {
    glass.winMat.uniforms.uTime.value = t;
    glass.doorMat.uniforms.uTime.value = t;
    const open = door ? door.state.open : 0;
    glass.doorMat.uniforms.uOpacity.value = glass.baseDoorOpacity * (1 - open * 0.92);
    // 顺手驱动 Lead 玻璃材质里带 time 的 uniform（有就带，没有就跳过）
    for (let i = 0; i < glassTimeUniforms.length; i += 1) glassTimeUniforms[i].value = t;
  });

  // ---- 蒸汽 ----
  const steam = buildSteam(handles, quality);
  if (steam) {
    g.add(steam.mesh);
    updateFns.push((t) => steam.mesh.update(t));
  }

  // ---- 路灯雨雾光锥 ----
  const cone = buildFogCone(quality);
  if (cone) {
    g.add(cone.mesh);
    updateFns.push((t) => cone.mesh.update(t));
  }

  // 给 lead 的调试信息
  if (handles.debug) {
    handles.debug.fx = {
      rain: rain.count,
      ripples: ripples.count,
      drips: drips.count,
      steam: steam ? steam.count : 0,
      flicker: flicker.items.length,
      door: !!door,
      mist: !!cone,
    };
  }

  return {
    group: g,
    update(t, dt) {
      for (let i = 0; i < updateFns.length; i += 1) updateFns[i](t, dt);
    },
  };
}
