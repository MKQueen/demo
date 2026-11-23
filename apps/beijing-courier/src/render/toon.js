// 自研卡通材质（用于我们自己的北京资产）
//
// 和 `materials.js` 里移植自参考站的 baseMaterial 一样，它也向 MRT 的两张附件写数据：
//   location 0: 颜色 + alpha 面 id
//   location 1: 打包深度 / 球面编码法线 / 描边权重
// 因此所有自建模型都会自动获得同一条描边 + LUT 调色管线，风格与角色/场景一致。
//
// 光照采用和参考站一致的「调色板 + HSV 阴影色」卡通做法，而不是 PBR：
//   lit   = 固有色
//   shadow= HSV(h-0.02, s, v*0.5)
//   最终 = mix(shadow, lit, smoothstep(...灯光 * 阴影贴图...)) + 轻微环境光
// 支持：纯色 / 顶点色 / map 贴图 / flatShading（低多边形硬边）/ 双面 / 透明。

import * as THREE from 'three';
import { ShaderChunk } from 'three';
import { fog, encoding, fit } from '../shaders/chunks.js';

const VERTEX = /* glsl */ `
    uniform float time;
    uniform float dtRatio;

    attribute vec4 color;
    varying vec2 vUv;
    varying vec4 vColor;
    varying vec3 wPos;
    varying vec2 vHighPrecisionZW;

    #include <common>
    #include <normal_pars_vertex>
    #include <shadowmap_pars_vertex>

    void main() {
        vUv = uv;
        vColor = color;

        #include <beginnormal_vertex>
        vec3 transformedNormal = normalMatrix * objectNormal;
        #ifdef FLIP_SIDED
            transformedNormal = -transformedNormal;
        #endif

        #include <begin_vertex>
        vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
        vec4 viewPosition = viewMatrix * worldPosition;
        gl_Position = projectionMatrix * viewPosition;

        wPos = worldPosition.xyz;
        vNormal = transformedNormal;
        vHighPrecisionZW = gl_Position.zw;

        #include <shadowmap_vertex>
    }
`;

const FRAGMENT = /* glsl */ `
    layout(location = 1) out highp vec4 gInfo;

    uniform float time;
    uniform float dtRatio;
    uniform vec3 diffuse;
    uniform float opacity;
    uniform vec3 uEmissive;
    uniform vec3 uAmbient;
    uniform float uSurfaceId;
    uniform sampler2D map;
    uniform bool hasMap;
    uniform bool useVertexColor;
    uniform bool flatShading;
    uniform vec3 uColor;
    uniform vec3 uFogColorNear;
    uniform vec3 uFogColorFar;
    uniform float uFogDistance;
    uniform float uFogDensity;
    uniform float uOutlineMultiplier;

    ${fit}
    ${encoding}

    varying vec2 vUv;
    varying vec4 vColor;
    varying vec3 wPos;
    varying vec3 vNormal;
    varying vec2 vHighPrecisionZW;

    #include <common>
    #include <packing>
    #include <bsdfs>
    #include <lights_pars_begin>
    #include <shadowmap_pars_fragment>

    vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }
    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    void main() {
        vec3 baseColor = uColor;
        if (hasMap) baseColor *= texture2D(map, vUv).rgb;
        if (useVertexColor) baseColor *= vColor.rgb;

        vec3 N;
        if (flatShading) {
            N = normalize(cross(dFdx(wPos), dFdy(wPos)));
        } else {
            N = normalize(vNormal);
        }
        // make sure the normal faces the camera for double-sided leaves-ish props
        if (!gl_FrontFacing) N = -N;

        vec3 L = vec3(0.0, 1.0, 0.0);
        vec3 lightColor = vec3(1.0);
        float shadow = 1.0;
        #if NUM_DIR_LIGHTS > 0
            DirectionalLight dirLight = directionalLights[0];
            lightColor = dirLight.color;
            L = normalize(dirLight.direction);
        #endif
        #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
            DirectionalLightShadow dls;
            dls = directionalLightShadows[0];
            shadow = getShadow(
                directionalShadowMap[0], dls.shadowMapSize, dls.shadowIntensity,
                dls.shadowBias, dls.shadowRadius, vDirectionalShadowCoord[0]
            );
        #endif

        float NdotL = max(dot(normalize(N), normalize(L)), 0.0);
        float lit = NdotL * shadow * lightColor.r;

        vec3 hsv = rgb2hsv(baseColor);
        vec3 shadowColor = hsv2rgb(vec3(hsv.x - 0.015, hsv.y, hsv.z * 0.52));
        vec3 color = mix(shadowColor, baseColor, smoothstep(0.05, 0.32, lit));
        color += uAmbient * 0.16 * baseColor;
        color += uEmissive;

        // fog, same constants as the reference-derived materials
        float lenCam = length(wPos - cameraPosition);
        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * lenCam * lenCam);
        float range1 = smoothstep(0.0, uFogDistance, fogFactor);
        vec3 fogColor = uFogColorNear * (1.0 - range1) + uFogColorFar * range1;
        color = mix(color, fogColor, fogFactor);

        gl_FragColor = vec4(color, uSurfaceId);
        gInfo = vec4(1.0 - (0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5), encodeNormalSpheremap(normalize(vNormal)), uOutlineMultiplier);
    }
`;

const cache = new Map();

function keyOf(opts) {
  return [
    !!opts.map, !!opts.vertexColors, !!opts.flatShading, opts.side,
    opts.transparent ? 1 : 0, opts.outlineMultiplier ?? 1,
  ].join('|');
}

export function createToonMaterial(options = {}) {
  const {
    color = '#ffffff',
    map = null,
    vertexColors = false,
    flatShading = true,
    side = THREE.FrontSide,
    transparent = false,
    opacity = 1,
    emissive = '#000000',
    ambient = '#5f7a8c',
    surfaceId = 0.13,
    outlineMultiplier = 1,
    fog = true,
    depthWrite = true,
  } = options;

  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights,
      {
        time: { value: 0 },
        dtRatio: { value: 1 },
        diffuse: { value: new THREE.Color(color) },
        uColor: { value: new THREE.Color(color) },
        uEmissive: { value: new THREE.Color(emissive) },
        uAmbient: { value: new THREE.Color(ambient) },
        uSurfaceId: { value: surfaceId },
        uOutlineMultiplier: { value: outlineMultiplier },
        uFogColorNear: { value: new THREE.Color('#93a2bf') },
        uFogColorFar: { value: new THREE.Color('#9ea7b8') },
        uFogDistance: { value: 0.8 },
        uFogDensity: { value: fog ? 0.011 : 0 },
        map: { value: map },
        hasMap: { value: !!map },
        useVertexColor: { value: !!vertexColors },
        flatShading: { value: !!flatShading },
        opacity: { value: opacity },
      },
    ]),
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    lights: true,
    side,
    transparent,
    opacity,
    depthWrite,
  });

  material.userData.toonMaterial = true;
  return material;
}

/** Utility shared by the Beijing asset pack. */
export function makeCanvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Polygonal helper: build a box with slightly irregular vertices (hand-made look). */
export function box(w, h, d, jitter = 0) {
  const geometry = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  if (jitter > 0) {
    const pos = geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i += 1) {
      pos.setXYZ(i,
        pos.getX(i) + (Math.random() - 0.5) * jitter,
        pos.getY(i) + (Math.random() - 0.5) * jitter,
        pos.getZ(i) + (Math.random() - 0.5) * jitter);
    }
    pos.needsUpdate = true;
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Merge helper without adding another dependency surface for callers. */
export function merge(geometries) {
  const attributeNames = ['position', 'normal', 'uv'];
  const merged = new THREE.BufferGeometry();
  for (const name of attributeNames) {
    const arrays = geometries.map((g) => g.getAttribute(name)?.array).filter(Boolean);
    if (!arrays.length) continue;
    const total = arrays.reduce((sum, a) => sum + a.length, 0);
    const ArrayType = arrays[0].constructor;
    const data = new ArrayType(total);
    let offset = 0;
    for (const array of arrays) { data.set(array, offset); offset += array.length; }
    merged.setAttribute(name, new THREE.BufferAttribute(data, name === 'uv' ? 2 : 3));
  }
  const indexArrays = geometries.map((g) => g.getIndex()?.array).filter(Boolean);
  if (indexArrays.length === geometries.length) {
    const total = indexArrays.reduce((sum, a) => sum + a.length, 0);
    const data = new Uint32Array(total);
    let offset = 0;
    let base = 0;
    for (let i = 0; i < geometries.length; i += 1) {
      const geometry = geometries[i];
      const count = geometry.getAttribute('position').count;
      const indices = geometry.getIndex().array;
      for (let k = 0; k < indices.length; k += 1) data[offset + k] = indices[k] + base;
      offset += indices.length;
      base += count;
    }
    merged.setIndex(new THREE.BufferAttribute(data, 1));
  }
  merged.computeBoundingSphere();
  return merged;
}
