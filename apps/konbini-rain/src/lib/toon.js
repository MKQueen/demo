/**
 * lib/toon.js —— 三渲二（卡通渲染）材质与描边。
 *
 * 核心思路：
 *   1. MeshToonMaterial + 4 阶 gradientMap 得到干净的光影分层；
 *   2. onBeforeCompile 注入一层「菲涅尔轮廓光」，夜景下的湿冷边缘更二次元；
 *   3. addOutline() 用背面外扩的 ShaderMaterial 给主要物体加屏幕宽度近似恒定的描边，
 *      得到清晰的动画赛璐璐轮廓线。
 */
import * as THREE from 'three';

/* -------------------------------------------------------------------------- */
/*  分层渐变贴图                                                               */
/* -------------------------------------------------------------------------- */

function makeGradient(stops) {
  const data = new Uint8Array(stops.length * 4);
  stops.forEach((v, i) => {
    const c = Math.round(Math.min(1, Math.max(0, v)) * 255);
    data[i * 4 + 0] = c;
    data[i * 4 + 1] = c;
    data[i * 4 + 2] = c;
    data[i * 4 + 3] = 255;
  });
  const tex = new THREE.DataTexture(data, stops.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export const GRADIENT = {
  // 室外夜景：更硬的明暗分层
  hard: makeGradient([0.3, 0.55, 0.82, 1.0]),
  // 室内：柔和一点，保留一点层次的丰富度
  soft: makeGradient([0.52, 0.74, 0.9, 1.0]),
  // 极简两阶（适合小物件）
  tiny: makeGradient([0.55, 0.85, 1.0]),
};

/* -------------------------------------------------------------------------- */
/*  轮廓光（rim light）——赛璐璐动画里的边缘高光                                  */
/* -------------------------------------------------------------------------- */

const RIM_VERT_HEAD = '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uRimPower;';
const RIM_FRAG_HEAD = '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;\nuniform float uRimPower;';
const RIM_FRAG_TAIL = `#include <opaque_fragment>
  {
    float rimDot = 1.0 - clamp( dot( normalize( vNormal ), normalize( vViewPosition ) ), 0.0, 1.0 );
    float rim = pow( rimDot, uRimPower );
    // 只在受光一侧的掠射边缘出光，避免整圈发光
    gl_FragColor.rgb += uRimColor * ( uRimStrength * rim );
  }`;

function attachRim(material, { rim = 0.16, rimColor = '#8dc8ff', rimPower = 3.2 } = {}) {
  if (rim <= 0) return material;
  material.userData.rim = { rim, rimColor, rimPower };
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    const color = new THREE.Color(rimColor);
    shader.uniforms.uRimColor = { value: color };
    shader.uniforms.uRimStrength = { value: rim };
    shader.uniforms.uRimPower = { value: rimPower };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', RIM_VERT_HEAD);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', RIM_FRAG_HEAD);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', RIM_FRAG_TAIL);
  };
  material.customProgramCacheKey = () => `rim:${rim}:${rimColor}:${rimPower}`;
  return material;
}

/* -------------------------------------------------------------------------- */
/*  卡通材质                                                                   */
/* -------------------------------------------------------------------------- */

const MAT_CACHE = new Map();

/**
 * 标准卡通材质。
 * @param {THREE.ColorRepresentation} color
 * @param {object} opts { gradient:'hard'|'soft'|'tiny', rim, rimColor, rimPower, emissive,
 *                        emissiveIntensity, transparent, opacity, side, flatShading, map, vertexColors }
 */
export function toon(color, opts = {}) {
  const key = JSON.stringify({ color, ...opts, __map: opts.map ? opts.map.uuid : '' });
  if (MAT_CACHE.has(key)) return MAT_CACHE.get(key);
  const material = new THREE.MeshToonMaterial({
    color,
    gradientMap: GRADIENT[opts.gradient || 'hard'],
    map: opts.map || null,
    emissive: opts.emissive || '#000000',
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    vertexColors: opts.vertexColors ?? false,
    depthWrite: opts.depthWrite ?? true,
    alphaTest: opts.alphaTest ?? 0,
  });
  if (opts.map) material.map.colorSpace = THREE.SRGBColorSpace;
  attachRim(material, opts);
  MAT_CACHE.set(key, material);
  return material;
}

/** 不受光材质：灯箱、贴纸、发光物件。color 可 >1 让 bloom 亮起来。 */
export function flat(color, opts = {}) {
  const material = new THREE.MeshBasicMaterial({
    color,
    map: opts.map || null,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    depthWrite: opts.depthWrite ?? true,
    alphaTest: opts.alphaTest ?? 0,
    toneMapped: opts.toneMapped ?? true,
    fog: opts.fog ?? true,
    blending: opts.blending ?? THREE.NormalBlending,
  });
  if (opts.map) material.map.colorSpace = THREE.SRGBColorSpace;
  return material;
}

/**
 * 灯箱 / 招牌：unlit + 贴图 + 亮度倍率。
 * intensity > 1 时进入 HDR，配合 bloom 会出现霓虹辉光。
 */
export function lightbox(map, intensity = 1.4, opts = {}) {
  const material = flat('#ffffff', {
    map,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    alphaTest: opts.alphaTest ?? 0,
    fog: false,
  });
  material.color.setScalar(intensity);
  return material;
}

/** 自发光纯色（霓虹管、小灯珠）。 */
export function glow(color, intensity = 2) {
  const material = new THREE.MeshBasicMaterial({ color, fog: false });
  material.color.multiplyScalar(intensity);
  return material;
}

/* -------------------------------------------------------------------------- */
/*  描边                                                                       */
/* -------------------------------------------------------------------------- */

const OUTLINE_VERT = /* glsl */ `
  uniform float uWidth;
  void main() {
    vec3 n = normalize( normalMatrix * normal );
    vec4 mv = modelViewMatrix * vec4( position, 1.0 );
    // 屏幕空间近似恒定宽度：偏移量随视距线性增长
    mv.xyz += n * uWidth * ( -mv.z );
    gl_Position = projectionMatrix * mv;
  }
`;

const OUTLINE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4( uColor, 1.0 );
  }
`;

const outlineMats = new Map();
function outlineMaterial(width = 0.00115, color = '#080b13') {
  const key = `${width}:${color}`;
  if (outlineMats.has(key)) return outlineMats.get(key);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uWidth: { value: width },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: OUTLINE_VERT,
    fragmentShader: OUTLINE_FRAG,
    side: THREE.BackSide,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    fog: false,
  });
  outlineMats.set(key, material);
  return material;
}

/**
 * 给一个物体（及其子 Mesh）描边。
 * 不支持 InstancedMesh（那种物件视觉上也不需要描边）。
 * @param {THREE.Object3D} root
 * @param {object} opts { width, color, onlyVisible }
 */
export function addOutline(root, opts = {}) {
  const width = opts.width ?? 0.00115;
  const color = opts.color ?? '#080b13';
  const material = outlineMaterial(width, color);
  const targets = [];
  root.traverse((obj) => {
    if (!obj.isMesh || obj.isInstancedMesh || obj.isLine || obj.isPoints) return;
    if (obj.userData.noOutline || obj.userData.isOutline) return;
    if (Array.isArray(obj.material)) return;
    const m = obj.material;
    if (!m || m.transparent || m.opacity < 0.99) return;
    if (m.isShaderMaterial) return;
    targets.push(obj);
  });
  for (const mesh of targets) {
    // 线框/极薄面不描边，避免翻面噪声
    if (mesh.userData.skipOutline) continue;
    const outline = new THREE.Mesh(mesh.geometry, material);
    outline.userData.isOutline = true;
    outline.castShadow = false;
    outline.receiveShadow = false;
    outline.matrixAutoUpdate = true;
    outline.position.set(0, 0, 0);
    outline.rotation.set(0, 0, 0);
    outline.scale.set(1, 1, 1);
    outline.renderOrder = (mesh.renderOrder || 0) + 1;
    mesh.add(outline);
  }
  return root;
}

/* -------------------------------------------------------------------------- */
/*  湿面高光条纹（给路面 / 玻璃补一层手绘感反光）                                 */
/* -------------------------------------------------------------------------- */

/** 生成一张柔和径向渐变纹理（灯光辉光 sprite 用） */
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTex = new THREE.CanvasTexture(canvas);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** 一盏灯光周围的软辉光 sprite（纯视觉，不加真实光源） */
export function glowSprite(color, size = 2.4, opacity = 0.5) {
  const material = new THREE.SpriteMaterial({
    map: glowTexture(),
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  sprite.userData.isGlowSprite = true;
  return sprite;
}
