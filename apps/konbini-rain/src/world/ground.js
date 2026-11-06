/**
 * world/ground.js —— 雨夜小镇的十字街地面。
 *
 * 15×15 方形地块，中心十字路口 + 四条街；湿地反射使用 Reflector。
 * 南侧切开一条小河，东侧边缘是一条被「切」到模型外的铁道。
 * 所有尺寸来自 config.js 的 E。
 */
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { C, E, L, rng } from '../config.js';
import { toon, flat } from '../lib/toon.js';
import { canvasTexture } from '../lib/textures.js';
import { box, plane, group } from '../lib/kit.js';

/* ---------------- 程序化纹理 ---------------- */

function asphaltTexture() {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#232833';
    ctx.fillRect(0, 0, w, h);
    const rand = rng(77);
    for (let i = 0; i < 26000; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      const g = 22 + rand() * 48;
      ctx.fillStyle = `rgba(${g + 6},${g + 8},${g + 16},${0.16 + rand() * 0.4})`;
      const s = rand() * 2.2 + 0.4;
      ctx.fillRect(x, y, s, s);
    }
    for (let i = 0; i < 26; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 30 + rand() * 160;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(10,13,20,${0.12 + rand() * 0.2})`);
      grd.addColorStop(1, 'rgba(10,13,20,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(10,13,20,0.4)';
    for (let i = 0; i < 36; i += 1) {
      let x = rand() * w;
      let y = rand() * h;
      ctx.lineWidth = 0.6 + rand() * 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k += 1) {
        x += (rand() - 0.5) * 48;
        y += (rand() - 0.5) * 48;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

function wetMaskTexture() {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    const rand = rng(1234);
    for (let i = 0; i < 70; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 36 + rand() * 190;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      const v = 105 + Math.floor(rand() * 95);
      grd.addColorStop(0, `rgba(${v},${v},${v},${0.1 + rand() * 0.16})`);
      grd.addColorStop(1, 'rgba(128,128,128,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 12; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      const prx = 40 + rand() * 90;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, prx);
      grd.addColorStop(0, 'rgba(255,255,255,0.9)');
      grd.addColorStop(0.6, 'rgba(225,225,225,0.55)');
      grd.addColorStop(1, 'rgba(160,160,160,0)');
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.5 + rand() * 0.4);
      ctx.translate(-x, -y);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, prx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, { srgb: false, anisotropy: 4 });
}

function lotTexture() {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#3b3b43';
    ctx.fillRect(0, 0, w, h);
    const rand = rng(31);
    const tile = w / 8;
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const v = 46 + Math.floor(rand() * 12);
        ctx.fillStyle = `rgb(${v + 5},${v + 5},${v + 10})`;
        ctx.fillRect(x * tile + 2, y * tile + 2, tile - 4, tile - 4);
        for (let i = 0; i < 60; i += 1) {
          const px = x * tile + rand() * tile;
          const py = y * tile + rand() * tile;
          ctx.fillStyle = `rgba(20,22,28,${0.05 + rand() * 0.08})`;
          ctx.fillRect(px, py, 1.5, 1.5);
        }
      }
    }
  });
}

/* ---------------- 湿路 shader ---------------- */

const WetRoadShader = {
  name: 'WetRoadShader',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uAsphalt: { value: null },
    uWet: { value: null },
    uTime: { value: 0 },
    uReflectBoost: { value: 1 },
    uRain: { value: 1 },
    uAreaMin: { value: new THREE.Vector2(E.bounds.minX, E.bounds.minZ) },
    uAreaSize: { value: new THREE.Vector2(E.bounds.maxX - E.bounds.minX, E.bounds.maxZ - E.bounds.minZ) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUvProj;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;
    void main() {
      vec4 worldPos = modelMatrix * vec4( position, 1.0 );
      vWorldPos = worldPos.xyz;
      vViewDir = cameraPosition - worldPos.xyz;
      vUvProj = textureMatrix * vec4( position, 1.0 );
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform sampler2D uAsphalt;
    uniform sampler2D uWet;
    uniform float uTime;
    uniform float uReflectBoost;
    uniform float uRain;
    uniform vec2 uAreaMin;
    uniform vec2 uAreaSize;
    varying vec4 vUvProj;
    varying vec3 vWorldPos;
    varying vec3 vViewDir;
    float hash21( vec2 p ) {
      p = fract( p * vec2( 234.34, 435.345 ) );
      p += dot( p, p + 34.23 );
      return fract( p.x * p.y );
    }
    void main() {
      vec2 uv = ( vWorldPos.xz - uAreaMin ) / uAreaSize;
      vec3 asphalt = texture2D( uAsphalt, uv ).rgb;
      float wet = texture2D( uWet, uv ).r;
      wet = clamp( wet * 1.25 - 0.15, 0.0, 1.0 );
      vec2 proj = vUvProj.xy / vUvProj.w;
      vec2 distort = vec2(
        sin( vWorldPos.z * 7.0 + uTime * 1.4 ),
        cos( vWorldPos.x * 6.0 - uTime * 1.1 )
      ) * ( 0.0011 + 0.0018 * wet ) * uRain;
      vec3 refl = vec3( 0.0 );
      float total = 0.0;
      for ( int i = 0; i < 5; i ++ ) {
        float fi = float( i ) - 2.0;
        vec2 off = proj + distort + vec2( fi * 0.0016, fi * 0.0065 * ( 0.35 + wet ) );
        float w = 1.0 - abs( fi ) * 0.16;
        refl += texture2D( tDiffuse, off ).rgb * w;
        total += w;
      }
      refl /= total;
      vec3 V = normalize( vViewDir );
      float fres = pow( 1.0 - clamp( V.y, 0.0, 1.0 ), 1.7 );
      float strength = mix( 0.13, 1.0, wet ) * ( 0.34 + fres * 1.15 ) * uReflectBoost;
      vec3 base = asphalt * color;
      base *= mix( 1.0, 0.52, wet );
      base += vec3( 0.012, 0.018, 0.035 ) * ( 1.0 - wet );
      float spark = step( 0.996, hash21( floor( vWorldPos.xz * 70.0 ) + floor( uTime * 20.0 ) ) );
      vec3 col = base + refl * strength + spark * wet * vec3( 0.10, 0.13, 0.16 );
      float stain = smoothstep( 0.35, 1.0, texture2D( uWet, uv * 2.3 + 0.37 ).r );
      col *= mix( 0.86, 1.0, stain );
      gl_FragColor = vec4( col, 1.0 );
    }
  `,
};

/* ---------------- 水位 shader ---------------- */

const WATER_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const WATER_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec2 uv = vWorld.xz * vec2(1.6, 2.4);
    float w1 = sin(uv.x * 2.0 + uTime * 0.8) * 0.5 + 0.5;
    float w2 = sin(uv.y * 3.0 - uTime * 0.6 + w1 * 2.0) * 0.5 + 0.5;
    float ripple = smoothstep(0.86, 1.0, w1 * 0.6 + w2 * 0.4);
    vec3 deep = vec3(0.012, 0.03, 0.045);
    vec3 shallow = vec3(0.03, 0.075, 0.09);
    vec3 col = mix(deep, shallow, w2 * 0.7 + ripple * 0.25);
    // 远处灯光的细碎倒影
    float glow = smoothstep(0.55, 1.0, sin(uv.x * 1.3 - uTime * 0.2) * 0.5 + 0.5) * 0.12;
    col += vec3(1.0, 0.7, 0.45) * glow * 0.55;
    gl_FragColor = vec4(col, 0.94);
  }
`;

function markingMat() {
  return toon('#e4eaf2', { rim: 0.2, rimColor: '#9fbfe0', gradient: 'tiny' });
}

function addMarking(parent, w, d, x, z, ry = 0, mat = null) {
  const m = plane(w, d, mat || markingMat(), {
    x, y: 0.008, z, rx: -Math.PI / 2, rz: ry, cast: false, receive: true, parent,
  });
  m.userData.roadMark = true;
  return m;
}

function platform(parent, x0, x1, z0, z1, topMat, sideMat, top = 0.12, height = 0.12) {
  const w = x1 - x0;
  const d = z1 - z0;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const slab = box(w, height, d, sideMat, { x: cx, y: top - height / 2, z: cz, cast: false, receive: true, parent });
  slab.layers.set(1);
  plane(w, d, topMat, { x: cx, y: top + 0.0006, z: cz, rx: -Math.PI / 2, cast: false, receive: true, parent });
}

export function buildGround(ctx) {
  const g = group('ground');
  const asphaltMap = asphaltTexture();
  const wetMap = wetMaskTexture();
  const lotMap = lotTexture();
  const B = E.bounds;
  const width = B.maxX - B.minX;
  const depth = B.maxZ - B.minZ;
  const cx = (B.minX + B.maxX) / 2;
  const cz = (B.minZ + B.maxZ) / 2;

  // 湿路面（整块平面反射，其余地块会盖在上面）
  const reflector = new Reflector(new THREE.PlaneGeometry(width, depth), {
    clipBias: 0.002,
    textureWidth: ctx.quality?.isMobile ? 512 : 1024,
    textureHeight: ctx.quality?.isMobile ? 512 : 1024,
    multisample: 0,
    shader: WetRoadShader,
    color: '#8f98aa',
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.set(cx, 0.002, cz);
  reflector.name = 'wet-road';
  const ru = reflector.material.uniforms;
  ru.uAsphalt.value = asphaltMap;
  ru.uWet.value = wetMap;
  ru.uAreaMin.value.set(B.minX, B.minZ);
  ru.uAreaSize.value.set(width, depth);
  if (ctx.quality?.isMobile) ru.uReflectBoost.value = 1.4;
  g.add(reflector);
  asphaltMap.colorSpace = THREE.SRGBColorSpace;
  wetMap.colorSpace = THREE.NoColorSpace;

  // 地块
  const lotMat = toon('#9a9aa2', { map: lotMap, rim: 0.14, rimColor: '#7f9cc0', gradient: 'soft' });
  lotMap.colorSpace = THREE.SRGBColorSpace;
  const lotSide = toon('#3a3a42', { rim: 0.12, rimColor: '#6f8fb4', gradient: 'soft' });
  // 四个街区（含人行道），中间留出十字路
  const blocks = [
    [B.minX, E.walk.west.maxX + 0.0, B.minZ, E.walk.north.maxZ], // NW
    [E.walk.east.minX + 0.0, E.rail.minX, B.minZ, E.walk.north.maxZ], // NE（便利店）
    [B.minX, E.walk.west.maxX + 0.0, E.walk.south.minZ, E.river.minZ], // SW
    [E.walk.east.minX + 0.0, E.rail.minX, E.walk.south.minZ, E.river.minZ], // SE
  ];
  // 注意：road.ns 是 x∈[-1.1,1.1]，两侧人行道 x∈[-2.1,-1.1]/[1.1,2.1]
  for (const [x0, x1, z0, z1] of blocks) {
    platform(g, x0, x1, z0, z1, lotMat, lotSide);
  }
  // 南岸窄条
  platform(g, B.minX, E.rail.minX, E.river.maxZ, B.maxZ, lotMat, lotSide);
  // 东侧铁道地块（低一点，铺碎石）
  platform(g, E.rail.minX, B.maxX, B.minZ, E.river.minZ, toon('#4a4742', { rim: 0.1, rimColor: '#8a8f96', gradient: 'soft' }), lotSide, 0.1, 0.1);

  // 路缘石：四个街角
  const curbMat = toon(C.curb, { rim: 0.18, rimColor: '#a8c4e4', gradient: 'soft' });
  const curbTopMat = toon(C.curbTop, { rim: 0.16, rimColor: '#b8d4f0', gradient: 'soft' });
  const curbX = (x0, x1, z) => {
    box(x1 - x0, 0.13, 0.09, lotMat, { x: (x0 + x1) / 2, y: 0.065, z, cast: false, receive: true, parent: g });
    box(x1 - x0, 0.025, 0.11, curbTopMat, { x: (x0 + x1) / 2, y: 0.1325, z, cast: false, receive: true, parent: g });
  };
  const curbZ = (z0, z1, x) => {
    box(0.09, 0.13, z1 - z0, lotMat, { x, y: 0.065, z: (z0 + z1) / 2, cast: false, receive: true, parent: g });
    box(0.11, 0.025, z1 - z0, curbTopMat, { x, y: 0.1325, z: (z0 + z1) / 2, cast: false, receive: true, parent: g });
  };
  // 东西路两侧路缘
  curbX(B.minX, E.walk.west.maxX, E.walk.north.maxZ);
  curbX(E.walk.east.minX, E.rail.minX, E.walk.north.maxZ);
  curbX(B.minX, E.walk.west.maxX, E.walk.south.minZ);
  curbX(E.walk.east.minX, E.rail.minX, E.walk.south.minZ);
  // 南北路两侧路缘
  curbZ(B.minZ, E.walk.north.maxZ, E.walk.west.maxX);
  curbZ(B.minZ, E.walk.north.maxZ, E.walk.east.minX);
  curbZ(E.walk.south.minZ, E.river.minZ, E.walk.west.maxX);
  curbZ(E.walk.south.minZ, E.river.minZ, E.walk.east.minX);

  // 排水沟
  const gutterMat = toon('#1d2129', { rim: 0.1, rimColor: '#48607f', gradient: 'soft' });
  for (const [x0, x1, z] of [
    [B.minX, E.walk.west.maxX, E.road.ew.minZ + 0.2],
    [E.walk.east.minX, E.rail.minX, E.road.ew.minZ + 0.2],
    [B.minX, E.walk.west.maxX, E.road.ew.maxZ - 0.2],
    [E.walk.east.minX, E.rail.minX, E.road.ew.maxZ - 0.2],
  ]) {
    plane(x1 - x0 - 0.2, 0.2, gutterMat, { x: (x0 + x1) / 2, y: 0.006, z, rx: -Math.PI / 2, cast: false, receive: true, parent: g });
  }

  // 斑马线：四个方向
  const zebra = markingMat();
  const stripesAcross = (axis, center, span, count) => {
    const stripe = span / (count * 2 - 1);
    for (let i = 0; i < count; i += 1) {
      const p = center - span / 2 + (i * 2 + 0.5) * stripe;
      if (axis === 'x') addMarking(g, stripe, E.road.ew.maxZ - E.road.ew.minZ - 0.1, p, (E.road.ew.minZ + E.road.ew.maxZ) / 2, 0, zebra);
      else addMarking(g, E.road.ns.maxX - E.road.ns.minX - 0.1, stripe, (E.road.ns.minX + E.road.ns.maxX) / 2, p, 0, zebra);
    }
  };
  stripesAcross('x', (E.walk.west.minX + E.walk.west.maxX) / 2, 1.0, 4);
  stripesAcross('x', (E.walk.east.minX + E.walk.east.maxX) / 2, 1.0, 4);
  stripesAcross('y', (E.walk.north.minZ + E.walk.north.maxZ) / 2, 1.0, 4);
  stripesAcross('y', (E.walk.south.minZ + E.walk.south.maxZ) / 2, 1.0, 4);

  // 中心虚线
  const lane = toon('#e7edf5', { rim: 0.1, rimColor: '#9fb6cf', gradient: 'tiny' });
  for (let x = B.minX + 0.9; x < B.maxX - 0.7; x += 1.3) {
    if (x > -2.4 && x < 2.4) continue;
    addMarking(g, 0.6, 0.05, x, (E.road.ew.minZ + E.road.ew.maxZ) / 2, 0, lane);
  }
  for (let z = B.minZ + 0.9; z < E.river.minZ - 0.6; z += 1.3) {
    if (z > -2.3 && z < 3.7) continue;
    addMarking(g, 0.05, 0.6, (E.road.ns.minX + E.road.ns.maxX) / 2, z, 0, lane);
  }

  // 盲道
  const tactTex = canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#bca052';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#8d7433';
    for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) { c.beginPath(); c.arc(x, y, 4.2, 0, Math.PI * 2); c.fill(); }
  });
  const tactMat = toon('#ffffff', { map: tactTex, rim: 0.1, rimColor: '#d8b870', gradient: 'tiny' });
  for (const [x, z, w, d] of [
    [-1.6, -1.0, 0.9, 0.28],
    [1.6, -1.0, 0.9, 0.28],
    [-1.6, 2.2, 0.9, 0.28],
    [1.6, 2.2, 0.9, 0.28],
    [3.9, -1.0, 2.4, 0.28],
    [-4.2, 2.2, 2.4, 0.28],
  ]) {
    plane(w, d, tactMat, { x, y: 0.1225, z, rx: -Math.PI / 2, cast: false, receive: true, parent: g });
  }

  // 井盖 / 雨水篦子
  const manholeTex = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#3c414c';
    c.beginPath(); c.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#1b1e25'; c.lineWidth = 5;
    for (let r = 28; r < w * 0.44; r += 26) { c.beginPath(); c.arc(w / 2, h / 2, r, 0, Math.PI * 2); c.stroke(); }
  });
  const manholeMat = toon('#ffffff', { map: manholeTex, rim: 0.15, rimColor: '#8fa8c8', gradient: 'soft' });
  for (const [x, z] of [[-0.5, 0.9], [4.4, 0.4], [-3.8, 0.2], [0.4, 4.8]]) {
    plane(0.65, 0.65, manholeMat, { x, y: 0.011, z, rx: -Math.PI / 2, cast: false, receive: true, parent: g });
  }

  // 河道 + 水面
  const riverMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const river = plane(E.rail.minX - B.minX, E.river.maxZ - E.river.minZ, riverMat, {
    x: (B.minX + E.rail.minX) / 2,
    y: E.river.y,
    z: (E.river.minZ + E.river.maxZ) / 2,
    rx: -Math.PI / 2,
    cast: false,
    receive: false,
    parent: g,
  });
  river.userData.noOutline = true;
  // 河岸石墙
  const bankMat = toon('#6b6f72', { rim: 0.12, rimColor: '#9fb8d8', gradient: 'soft' });
  for (const z of [E.river.minZ - 0.04, E.river.maxZ + 0.04]) {
    box(E.rail.minX - B.minX, 0.4, 0.12, bankMat, { x: (B.minX + E.rail.minX) / 2, y: 0.02, z, cast: false, receive: true, parent: g });
    box(E.rail.minX - B.minX, 0.04, 0.2, toon('#8a8d84', { rim: 0.12 }), { x: (B.minX + E.rail.minX) / 2, y: 0.24, z, cast: false, receive: true, parent: g });
  }
  // 河底
  plane(E.rail.minX - B.minX, E.river.maxZ - E.river.minZ, toon('#0d1a20', { rim: 0 }), {
    x: (B.minX + E.rail.minX) / 2, y: -0.1, z: (E.river.minZ + E.river.maxZ) / 2,
    rx: -Math.PI / 2, cast: false, receive: false, parent: g,
  });

  // 铁道：道砟 + 枕木 + 双轨
  const ballast = box(E.rail.maxX - E.rail.minX, 0.06, E.river.minZ - B.minZ, toon('#3f3b36', { rim: 0.1 }), {
    x: (E.rail.minX + E.rail.maxX) / 2, y: 0.09, z: (B.minZ + E.river.minZ) / 2, cast: false, receive: true, parent: g,
  });
  ballast.layers.set(1);
  const sleeperMat = toon('#4a3a2c', { rim: 0.1 });
  for (let z = B.minZ + 0.2; z < E.river.minZ - 0.1; z += 0.36) {
    box(0.72, 0.045, 0.14, sleeperMat, { x: E.rail.minX + 0.34, y: 0.125, z, cast: false, receive: true, parent: g });
  }
  const railMat = toon('#9aa2ab', { rim: 0.3, rimColor: '#e6f2ff', gradient: 'soft' });
  for (const dx of [-0.16, 0.16]) {
    box(0.045, 0.05, E.river.minZ - B.minZ - 0.2, railMat, { x: E.rail.minX + 0.34 + dx, y: 0.16, z: (B.minZ + E.river.minZ) / 2, cast: true, receive: true, parent: g });
  }

  // 人行道积水
  const puddleTex = canvasTexture(256, 256, (c, w, h) => {
    const grd = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(150,190,255,0.55)');
    grd.addColorStop(0.5, 'rgba(90,130,210,0.3)');
    grd.addColorStop(1, 'rgba(20,30,60,0)');
    c.fillStyle = grd; c.beginPath(); c.ellipse(w / 2, h / 2, w * 0.47, h * 0.4, 0, 0, Math.PI * 2); c.fill();
  });
  const puddleMat = new THREE.MeshBasicMaterial({ map: puddleTex, transparent: true, opacity: 0.55, depthWrite: false, color: '#7d9cc4', fog: false });
  const puddles = [
    [-4.7, 2.2, 0.9, 0.36, 0.8], [-2.9, 1.9, 0.7, 0.3, 1.6], [2.6, 2.3, 0.8, 0.34, 0.2],
    [5.4, 2.1, 0.9, 0.32, 1.2], [3.0, -1.1, 1.0, 0.34, 0.6], [-3.4, -1.0, 0.8, 0.3, 1.4],
    [-6.7, -1.0, 0.7, 0.28, 0.4], [6.1, -1.1, 0.8, 0.3, 1.8], [-0.4, 1.0, 1.4, 0.55, 0.3],
    [0.5, 4.3, 1.0, 0.4, 1.1], [-4.9, 4.9, 0.8, 0.32, 0.9],
  ];
  for (const [x, z, sx, sz, rot] of puddles) {
    const p = plane(1, 1, puddleMat.clone(), { x, y: 0.123, z, rx: -Math.PI / 2, rz: rot, cast: false, receive: false, parent: g });
    p.scale.set(sx, sz, 1);
    p.userData.noOutline = true;
  }

  // 店铺暖光在湿地上的拉长倒影
  const warmTex = canvasTexture(512, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const rand = rng(88);
    for (let i = 0; i < 26; i += 1) {
      const x = rand() * w;
      const ww = 6 + rand() * 34;
      const hh = 40 + rand() * 200;
      const grd = c.createLinearGradient(0, h, 0, h - hh);
      grd.addColorStop(0, `rgba(255,206,140,${0.12 + rand() * 0.2})`);
      grd.addColorStop(0.6, `rgba(255,220,170,${0.08 + rand() * 0.12})`);
      grd.addColorStop(1, 'rgba(255,220,170,0)');
      c.fillStyle = grd;
      c.fillRect(x, h - hh, ww, hh);
    }
  });
  const warmMat = new THREE.MeshBasicMaterial({ map: warmTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const warmPatches = [
    [3.9, -0.2, 3.6, 1.3, 0.55], // 便利店门前
    [-1.85, 3.85, 0.9, 1.9, 0.42], // 居酒屋门前
    [-1.85, 5.8, 0.9, 1.8, 0.38], // 拉面店门前
    [-5.9, 2.4, 2.6, 1.0, 0.26],
    [3.0, 6.0, 2.4, 1.0, 0.22],
    [5.6, 6.1, 2.0, 1.0, 0.28],
  ];
  for (const [x, z, w, h, opacity] of warmPatches) {
    const patch = plane(w, h, warmMat.clone(), { x, y: 0.1228, z, rx: -Math.PI / 2, cast: false, receive: false, parent: g });
    patch.material.opacity = opacity;
    patch.userData.noOutline = true;
  }

  const wetUniforms = reflector.material.uniforms;
  ctx.handles.ground = { reflector };
  return {
    group: g,
    reflector,
    update(t) {
      wetUniforms.uTime.value = t;
      riverMat.uniforms.uTime.value = t;
    },
  };
}
