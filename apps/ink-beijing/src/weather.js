/**
 * weather.js —— 天气与「烟火气」。
 *
 * 两件事：
 *   1. 雪：围着相机飘的雪点（点云 + 顶点着色器下落/横飘，不占多少性能）；
 *   2. 炊烟：从城里胡同的屋顶一缕缕升起来的淡墨烟，白天很淡，暮色和雪天更明显。
 *
 * 雪本身的「红墙白瓦」主要靠 InkPost 的 uSnow 分级完成（灰面覆雪、朱红与金顶保留），
 * 这里只负责空中的雪与烟。
 *
 * 用法（由 main.js 组装）：
 *   const weather = createWeather({ scene, camera, world, tex });
 *   weather.update(time, dt, { snow, dusk });
 */
import * as THREE from 'three';
import { makeRng } from './lib/rand.js';
import { INNER_CITY, OUTER_CITY, PALACE, LAKES, GATES } from './layout.js';

/* -------------------------------------------------------------------------- */
/*  小纹理                                                                      */
/* -------------------------------------------------------------------------- */

function softDotTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  return t;
}

function smokeTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const rng = makeRng(9911);
  // 一团不规则的淡墨
  for (let i = 0; i < 14; i++) {
    const x = size * (0.5 + (rng() - 0.5) * 0.3);
    const y = size * (0.5 + (rng() - 0.5) * 0.3);
    const r = size * (0.18 + rng() * 0.2);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.26 + rng() * 0.22;
    g.addColorStop(0, `rgba(236,236,230,${a})`);
    g.addColorStop(0.55, `rgba(230,230,224,${a * 0.55})`);
    g.addColorStop(1, 'rgba(228,228,222,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  return t;
}

/* -------------------------------------------------------------------------- */
/*  炊烟                                                                        */
/* -------------------------------------------------------------------------- */

function collectSmokeAnchors(world) {
  // city 模块会挂在 userData.smokeAnchors 上；没有就用城市范围自己撒
  const city = world?.getObjectByName?.('city');
  const anchors = city?.userData?.smokeAnchors;
  if (Array.isArray(anchors) && anchors.length) return anchors.slice(0, 320);

  const rng = makeRng(445566);
  const out = [];
  const palaceHalfW = (PALACE?.w || 20) / 2 + 1;
  const palaceN = (PALACE?.north ?? -8) - 1;
  const palaceS = (PALACE?.south ?? 7) + 1;
  let guard = 0;
  while (out.length < 280 && guard < 4000) {
    guard += 1;
    // 内外城随机
    const inInner = rng() < 0.68;
    const x = (rng() - 0.5) * 2 * (inInner ? INNER_CITY.halfX : OUTER_CITY.halfX) * 0.92;
    const z = inInner
      ? INNER_CITY.north + rng() * (INNER_CITY.south - INNER_CITY.north)
      : INNER_CITY.south + rng() * (OUTER_CITY.south - INNER_CITY.south);
    if (Math.abs(x) < palaceHalfW + 1 && z > palaceN - 1 && z < palaceS + 1) continue;
    // 避开湖面
    let onWater = false;
    for (const key of Object.keys(LAKES)) {
      const l = LAKES[key];
      const d = Math.hypot((x - l.cx) / (l.rx * 1.15), (z - l.cz) / (l.rz * 1.15));
      if (d < 1) {
        onWater = true;
        break;
      }
    }
    if (onWater) continue;
    // 避开城门/大街中线（不然烟从路上冒出来）
    let nearGate = false;
    for (const g of GATES) {
      if (Math.hypot(x - g.x, z - g.z) < 4) {
        nearGate = true;
        break;
      }
    }
    if (nearGate) continue;
    out.push([x, 0.32 + rng() * 0.2, z]);
  }
  return out;
}

function buildSmoke(anchors, tex) {
  const group = new THREE.Group();
  group.name = 'smoke';
  const n = anchors.length;
  if (!n) return { group, uniforms: null, material: null };

  // 每个烟囱 1~2 缕，总实例数控制在 ~420
  const per = 2;
  const count = Math.min(520, n * per);
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.attributes.position = base.attributes.position;
  geo.attributes.uv = base.attributes.uv;

  const origin = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const speed = new Float32Array(count);
  const scale = new Float32Array(count);
  const seed = new Float32Array(count);
  const rng = makeRng(77);
  for (let i = 0; i < count; i++) {
    const a = anchors[i % n];
    origin[i * 3] = a[0] + (rng() - 0.5) * 0.25;
    origin[i * 3 + 1] = a[1];
    origin[i * 3 + 2] = a[2] + (rng() - 0.5) * 0.25;
    phase[i] = rng();
    speed[i] = 0.02 + rng() * 0.02;
    scale[i] = 0.5 + rng() * 0.7;
    seed[i] = rng();
  }
  geo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(origin, 3));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  geo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speed, 1));
  geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scale, 1));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  geo.instanceCount = count;

  const uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0.5 },
    uTexture: { value: tex },
    uCamRight: { value: new THREE.Vector3(1, 0, 0) },
    uCamUp: { value: new THREE.Vector3(0, 1, 0) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute vec3 aOrigin;
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aScale;
      attribute float aSeed;
      uniform float uTime;
      uniform vec3 uCamRight;
      uniform vec3 uCamUp;
      varying vec2 vUv;
      varying float vLife;
      varying float vDist;
      void main() {
        float life = fract(uTime * aSpeed + aPhase);
        vec3 center = aOrigin;
        center.y += life * (4.2 + aSeed * 3.6);
        center.x += sin(life * 6.283 + aSeed * 6.283) * (0.35 + life * 1.5);
        center.z += cos(life * 5.1 + aSeed * 3.14) * (0.3 + life * 1.2);
        float s = aScale * (0.8 + life * 2.4);
        vec3 p = center + uCamRight * position.x * s * 0.85 + uCamUp * position.y * s * 1.5;
        vUv = uv;
        vLife = life;
        vDist = length(center - cameraPosition);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTexture;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vLife;
      varying float vDist;
      void main() {
        vec4 t = texture2D(uTexture, vUv);
        float fade = smoothstep(0.0, 0.1, vLife) * (1.0 - smoothstep(0.55, 1.0, vLife));
        // 远看只剩一点点烟，免得变成一片灰团
        float farFade = 1.0 - smoothstep(55.0, 170.0, vDist);
        float a = t.a * fade * uOpacity * farFade;
        if (a < 0.008) discard;
        gl_FragColor = vec4(0.42, 0.45, 0.44, a);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  group.add(mesh);
  return { group, uniforms, material, mesh };
}

/* -------------------------------------------------------------------------- */
/*  飘雪                                                                        */
/* -------------------------------------------------------------------------- */

function buildSnow(camera) {
  const group = new THREE.Group();
  group.name = 'snowfall';
  const COUNT = 3600;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(COUNT * 3);
  const speed = new Float32Array(COUNT);
  const scale = new Float32Array(COUNT);
  const seed = new Float32Array(COUNT);
  const rng = makeRng(31337);
  const BOX = 220;
  const HEIGHT = 90;
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (rng() - 0.5) * BOX;
    pos[i * 3 + 1] = rng() * HEIGHT;
    pos[i * 3 + 2] = (rng() - 0.5) * BOX;
    speed[i] = 6 + rng() * 10;
    scale[i] = 0.55 + rng() * 0.8;
    seed[i] = rng();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uHeight: { value: HEIGHT },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.85) },
    uTexture: { value: softDotTexture() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
    vertexShader: /* glsl */ `
      attribute float aSpeed;
      attribute float aScale;
      attribute float aSeed;
      uniform float uTime;
      uniform float uHeight;
      uniform float uPixelRatio;
      varying float vA;
      void main() {
        vec3 p = position;
        float fall = mod(uTime * aSpeed + aSeed * 100.0, uHeight);
        p.y = uHeight - fall;
        p.x += sin(uTime * 0.7 + aSeed * 6.283) * 3.0;
        p.z += cos(uTime * 0.55 + aSeed * 3.14) * 2.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aScale * uPixelRatio * (520.0 / max(1.0, -mv.z));
        vA = smoothstep(0.0, 8.0, p.y) * smoothstep(uHeight, uHeight * 0.6, p.y);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTexture;
      uniform float uOpacity;
      varying float vA;
      void main() {
        vec4 t = texture2D(uTexture, gl_PointCoord);
        float a = t.a * vA * uOpacity;
        if (a < 0.01) discard;
        gl_FragColor = vec4(0.72, 0.78, 0.83, a);
      }
    `,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 7;
  group.add(points);
  group.visible = false;
  return { group, uniforms, material, points };
}

/* -------------------------------------------------------------------------- */

export function createWeather({ scene, camera, world, tex }) {
  const smoke = buildSmoke(collectSmokeAnchors(world), smokeTexture());
  scene.add(smoke.group);
  const snow = buildSnow(camera);
  scene.add(snow.group);

  let snowAmount = 0;
  let smokeBoost = 0;

  return {
    group: smoke.group,
    get snowAmount() {
      return snowAmount;
    },
    update(time, dt, { snow: snowTarget = 0, dusk = 0 } = {}) {
      const k = 1 - Math.exp(-dt * 2.6);
      snowAmount += (snowTarget - snowAmount) * k;
      if (Math.abs(snowTarget - snowAmount) < 0.002) snowAmount = snowTarget;

      if (smoke.uniforms) {
        smoke.uniforms.uTime.value = time;
        smoke.uniforms.uOpacity.value = 0.7 + dusk * 0.15 + snowAmount * 0.1;
        // billboard 的相机右/上向量（每帧更新）
        const e = camera.matrixWorld.elements;
        smoke.uniforms.uCamRight.value.set(e[0], e[1], e[2]);
        smoke.uniforms.uCamUp.value.set(e[4], e[5], e[6]);
      }
      snow.group.visible = snowAmount > 0.01;
      if (snow.group.visible) {
        // 雪云跟着相机走，永远在镜头周围飘
        snow.group.position.set(camera.position.x, camera.position.y - 30, camera.position.z);
        snow.uniforms.uTime.value = time;
        snow.uniforms.uOpacity.value = Math.min(1, snowAmount) * 1.0;
        snow.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 1.85);
      }
      return snowAmount;
    },
  };
}
