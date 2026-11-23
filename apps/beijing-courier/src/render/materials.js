// Ported core material of messenger.abeto.co.
//
// The original `baseMaterial()` is one ShaderMaterial with compile-time defines:
//   IS_TERRAIN    -> planet chunks (palette UV lookup + triplanar terrain noise,
//                    int surfaceId/elementId attributes, flat face ids in alpha)
//   IS_CHARACTER  -> the playable avatar (eyes rendered from UV>1 region)
//   IS_NPC        -> NPC meshes (eyes + animated mouth)
//   IS_GIVE       -> delivery objects
//
// It writes two render targets:
//   location 0: outgoingLight + surfaceId in alpha
//   location 1: packed depth, spheremap normal, outline weight
//
// We keep the original shading logic 1:1 (HSV shadow color, hard cut shadow for
// characters, fog, outline weighting) but use three's standard skinning chunks
// instead of the site's batched bone-texture skinning, and feed explicit
// uniforms instead of their global UBO.

import * as THREE from 'three';
import { ShaderChunk } from 'three';
import {
  fit, encoding, linearstep, colorutils, sinenoise, aastep, triplanar, fog,
} from '../shaders/chunks.js';

const LIGHTS_BEGIN = (() => {
  let src = ShaderChunk.lights_fragment_begin;
  src = src.replace(
    'DirectionalLight directionalLight;',
    'DirectionalLight directionalLight;\n\t\tfloat _dirShadow = 1.0;'
  );
  src = src.replace(
    /directLight\.color \*= \( directLight\.visible && receiveShadow \) \? getShadow\( directionalShadowMap\[ i \], directionalLightShadow\.shadowMapSize, directionalLightShadow\.shadowIntensity, directionalLightShadow\.shadowBias, directionalLightShadow\.shadowRadius, vDirectionalShadowCoord\[ i \] \) : 1\.0;/,
    `
        float shadow = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
        _dirShadow *= shadow;
        directLight.color *= shadow;
        `
  );
  return src;
})();

const VERTEX = /* glsl */ `
    uniform float time;
    uniform float dtRatio;

    #ifdef IS_TERRAIN
        attribute int surfaceId;
        attribute int elementId;
        flat varying int vElementId;
        varying vec3 vLocalNormal;
    #else
        attribute float surfaceId;
    #endif

    #if defined (IS_CHARACTER) || defined(IS_NPC)
        varying vec3 lPos;
    #endif

    #ifdef IS_CHARACTER
        flat varying int vIsLocal;
        flat varying float vBatchID;
    #endif

    varying vec3 vViewPosition;
    varying vec2 vUv;
    varying vec3 wPos;
    varying vec3 wNormal;
    varying vec3 vReflect;
    varying vec2 vHighPrecisionZW;
    flat varying float vSurfaceId;

    #include <common>
    #include <normal_pars_vertex>
    #include <skinning_pars_vertex>
    #include <shadowmap_pars_vertex>

    void main() {
        #ifdef IS_TERRAIN
            vElementId = elementId;
            vLocalNormal = normal;
            vSurfaceId = fract(float(surfaceId) / 10e5);
        #else
            vSurfaceId = surfaceId;
        #endif

        #include <uv_vertex>

        #if defined (IS_CHARACTER) || defined(IS_NPC)
            lPos = position;
        #endif

        #include <beginnormal_vertex>
        #include <skinbase_vertex>

        #ifdef USE_SKINNING
            #include <skinnormal_vertex>
        #endif

        vec3 transformedNormal = objectNormal;
        #ifdef USE_INSTANCING
            mat3 im = mat3( instanceMatrix );
            transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
            transformedNormal = im * transformedNormal;
        #endif
        transformedNormal = normalMatrix * transformedNormal;
        #ifdef FLIP_SIDED
            transformedNormal = - transformedNormal;
        #endif

        #include <normal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>

        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
            mvPosition = instanceMatrix * mvPosition;
        #endif

        vec4 worldPosition = modelMatrix * mvPosition;

        wPos = worldPosition.xyz;
        vec4 viewPosition = viewMatrix * worldPosition;
        gl_Position = projectionMatrix * viewPosition;

        vViewPosition = -viewPosition.xyz;

        #include <shadowmap_vertex>

        wNormal = inverseTransformDirection(transformedNormal, viewMatrix);
        vReflect = reflect(wNormal, normalize(worldPosition.xyz - cameraPosition.xyz));
        vHighPrecisionZW = gl_Position.zw;

        #ifdef IS_CHARACTER
            vIsLocal = int(1);
            vBatchID = 0.0;
        #endif
    }
`;

const FRAGMENT = /* glsl */ `
    layout(location = 1) out highp vec4 gInfo;

    uniform float time;
    uniform float dtRatio;

    ${fit}
    ${encoding}
    ${linearstep}
    ${sinenoise}
    ${colorutils}
    ${aastep}

    uniform sampler2D tColors;
    uniform sampler2D tNoise;
    uniform sampler2D tNoiseTerrain;

    #ifdef IS_TERRAIN
        flat varying int vElementId;
        varying vec3 vLocalNormal;

        ${triplanar}

        vec3 applyTerrainColor(vec3 norm, vec3 pos, vec3 color) {
            vec4 triplanarGrass = triplanar(tNoiseTerrain, norm, pos.xyz, 0.035);
            color = rgb2hsv(color);
            color.b -= step(0.7, triplanarGrass.r) * 0.03;
            float grassLight = step(triplanarGrass.g, 0.8);
            color.b += grassLight * 0.05;
            color = hsv2rgb(color);
            return color;
        }
    #endif

    varying vec3 wPos;
    varying vec3 wNormal;
    varying vec3 vReflect;
    varying vec2 vHighPrecisionZW;
    flat varying float vSurfaceId;

    ${fog}

    uniform float uFadeDistance;

    #if defined (IS_CHARACTER) || defined (IS_NPC)
        varying vec3 lPos;

        uniform sampler2D tEye;
        uniform vec3 uSkinColor;

        float hash11(float p) {
            p = fract(p * .1031);
            p *= p + 33.33;
            p *= p + p;
            return fract(p);
        }
    #endif

    #ifdef IS_CHARACTER
        uniform float uShowChars;
        uniform float uWetHeight;
        flat varying int vIsLocal;
        flat varying float vBatchID;
    #endif

    #ifdef IS_NPC
        uniform sampler2D tMouth;
        uniform vec3 uMouthColor;
        uniform float uIsTalking;
        uniform float uNPCSeed;
    #endif

    float lineFade(vec3 p, float size, float amount) {
        float h = size * 0.5;
        return 1.0 - step(amount * 1.01, (abs(mod(p.y, size) - h) / h));
    }

    float sphereFade(vec3 p, float size, float amount) {
        float h = size * 0.5;
        return clamp(1.0 - step(amount * 1.85, length(mod(p, size) - h) / h), 0.0, 1.0);
    }

    uniform vec3 diffuse;
    uniform vec3 emissive;
    uniform vec3 specular;
    uniform float shininess;
    uniform float opacity;

    #include <common>
    #include <packing>

    varying vec2 vUv;

    #include <bsdfs>
    #include <lights_pars_begin>
    #include <normal_pars_fragment>
    #include <lights_phong_pars_fragment>
    #include <shadowmap_pars_fragment>

    void main() {
        #ifdef IS_TERRAIN
            vec4 triplanarNoise = triplanar(tNoise, wNormal, wPos.xyz * 0.4, 1.0);
            float height = length(wPos);
            float grassMask = 0.0;
            float wetMask = 0.0;

            if (vElementId == 1) {
                grassMask = step(0.15, max(0.0, -triplanarNoise.r * 1.5 + dot(wNormal, normalize(wPos))) - triplanarNoise.g * 0.35 + 0.1 - triplanarNoise.b * 0.05);
                wetMask = 1.0 - step(0.334, height * 0.015 + triplanarNoise.g * 0.006);
            }
        #endif

        float showAmount = 1.0;
        float dist = length(wPos - cameraPosition);

        #ifndef IS_CHARACTER
            showAmount = lineFade(wPos, 0.015, linearstep(0.1, 0.5, dist));
        #else
            if (uShowChars < 1.0) showAmount *= sphereFade(wPos, 0.15, uShowChars);
        #endif

        #ifdef FADE_AWAY
            showAmount *= sphereFade(wPos, 0.3, smoothstep(uFadeDistance, uFadeDistance - 3.0, dist));
        #endif

        if (showAmount < 0.001) discard;

        vec4 diffuseColor = vec4(diffuse, opacity);
        ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
        vec3 totalEmissiveRadiance = emissive;
        float specularStrength = 1.0;

        #include <normal_fragment_begin>
        vec3 wNorm = normalize(wNormal);

        #include <lights_phong_fragment>
        ${LIGHTS_BEGIN}
        #include <lights_fragment_end>

        vec3 diffuseSpecular = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular;
        vec3 outgoingLight = diffuseSpecular + totalEmissiveRadiance;

        float shadowContribution = 1.0;
        float outlineContribution = 1.0;

        #if NUM_DIR_LIGHTS > 0
            float specularAmount = 0.075;

            #if defined(IS_CHARACTER) || defined(IS_NPC)
                specularAmount = 0.0;
            #endif

            #if defined(IS_DISABLED)
                outlineContribution = 0.0;
            #endif

            vec3 baseColor = diffuseColor.rgb;

            #ifdef IS_TERRAIN
                if (vElementId == 1) {
                    vec2 colorUV = vUv;
                    if (grassMask > 0.5) colorUV = vec2(0.15, 0.95);
                    if (wetMask > 0.5) colorUV = vec2(0.21, 0.54);
                    baseColor = applyTerrainColor(wNorm, wPos, texture2D(tColors, colorUV).rgb);
                } else {
                    baseColor = texture2D(tColors, vUv).rgb;
                }
            #elif defined(IS_CHARACTER) || defined(IS_NPC)
                baseColor = texture2D(tColors, vUv).rgb;

                if (vUv.y > 1.0) {
                    vec2 eyeUv = vUv;

                    #ifdef IS_CHARACTER
                        float blinkTimeOffset = vBatchID;
                    #else
                        float blinkTimeOffset = uNPCSeed;
                    #endif

                    float eyeTime = time * 3.0 + blinkTimeOffset * 23.73464;
                    float interval1 = 22.0;
                    float interval2 = 34.0;
                    float interval3 = 57.0;
                    float line1 = fract(eyeTime * (1.0 / interval1)) * interval1 - interval1 + 1.0;
                    float line2 = fract(eyeTime * (1.0 / interval2)) * interval2 - interval2 + 1.0;
                    float line3 = fract(eyeTime * (1.0 / interval3)) * interval3 - interval3 + 1.0;
                    float eyeProgress = max(0.0, max(max(line1, line2), line3));

                    float spriteWidth = 0.25;
                    eyeUv.x *= spriteWidth;

                    float offset = floor(eyeProgress * 3.0);
                    eyeUv.x += offset * spriteWidth;

                    float mask = texture2D(tEye, eyeUv).r;
                    mask = aastep(0.5, mask);

                    baseColor = vec3(0.0);
                    baseColor += uSkinColor * (1.0 - mask);
                }

                #ifdef IS_NPC
                    if (vUv.y < 0.0) {
                        float spriteWidth = 0.25;
                        vec2 mouthUv = vUv;
                        mouthUv.x *= spriteWidth;

                        float offset = 0.0;
                        if (uIsTalking > 0.5) {
                            offset = floor(hash11(floor(time * 8.0)) * 3.0);
                        }

                        mouthUv.x += offset * spriteWidth;
                        vec3 mask = texture2D(tMouth, mouthUv).rgb;
                        mask.r = aastep(0.5, mask.r);
                        mask.g = aastep(0.5, mask.g);
                        mask.b = aastep(0.5, mask.b);
                        float mouthMask = min(1.0, mask.r + mask.g + mask.b);
                        float skinMask = 1.0 - mouthMask;

                        vec3 teethColor = vec3(1.0);
                        vec3 skinColor = uSkinColor;
                        vec3 mouthColor = uMouthColor;

                        baseColor = vec3(0.0);
                        baseColor += teethColor * mask.g;
                        baseColor += mouthColor * mask.r;
                        baseColor += mix(mouthColor, skinColor, 0.1) * mask.b;
                        baseColor += skinColor * skinMask;
                    }
                #endif
            #elif defined(IS_GIVE)
                baseColor = texture2D(tColors, vUv).rgb;
            #endif

            vec3 colorhsv = rgb2hsv(baseColor);
            vec3 colorShadow = colorhsv;
            colorShadow.r -= 0.02;
            colorShadow.b *= 0.5;
            colorShadow = hsv2rgb(colorShadow);

            float totalShadow = reflectedLight.directDiffuse.r * _dirShadow * shadowContribution;

            #ifdef HARD_CUT_SHADOW
                float shadowCut = smoothstep(0.1, 0.15, totalShadow);
            #else
                float shadowCut = smoothstep(0.2, 0.4, totalShadow);
            #endif

            outgoingLight = mix(colorShadow, baseColor, shadowCut);

            outgoingLight += smoothstep(0.01, 0.011, reflectedLight.directSpecular) * specularAmount * fit(dot(wNorm, vec3(0.0, 1.0, 0.0)), 0.95, 0.9, 0.0, 1.0);

            outgoingLight += reflectedLight.indirectDiffuse;
        #endif

        float surfaceId = vSurfaceId;

        #ifdef IS_TERRAIN
            if (vElementId == 1) {
                float n1 = sin(height * 0.1 + (vLocalNormal.x + vLocalNormal.y + vLocalNormal.z) * 0.5 + (wPos.x + wPos.y + wPos.z) * 2.0);
                float striations = texture2D(tNoise, vec2(n1 * 0.01, height * 0.07 - n1 * 0.02)).g;
                striations = step(0.47, striations + triplanarNoise.r * 0.2 + triplanarNoise.g * 0.05);
                outlineContribution *= step(0.3, triplanarNoise.r);

                surfaceId += striations * (1.0 - grassMask);
                surfaceId += grassMask * 0.1;
                surfaceId += wetMask * 0.12;
            }

            outlineContribution *= step(0.13, triplanarNoise.g * triplanarNoise.b);
        #endif

        #if defined (IS_CHARACTER) || defined (IS_NPC)
            float outlineNoise = sinenoise1(lPos * 12.0 + vec3(3.324, 34.2, 56.343) * surfaceId) * 0.5 + 0.5;
            outlineContribution = step(0.3, outlineNoise);

            #ifdef IS_CHARACTER
                if (vIsLocal == 1) {
                    vec3 colorwet = rgb2hsv(outgoingLight);
                    colorwet.b = max(colorwet.b - 0.1, colorwet.b * 0.75);
                    colorwet = hsv2rgb(colorwet);
                    outgoingLight = mix(outgoingLight, colorwet, step(lPos.y, uWetHeight + (sin(lPos.x * 30.0) - 1.0) * 0.012));
                }
            #endif
        #endif

        #ifndef NO_FOG
            addFog(outgoingLight, vViewPosition.z);
        #endif

        gl_FragColor = vec4(outgoingLight, surfaceId);
        gInfo = vec4(1.0 - (0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5), encodeNormalSpheremap(geometryNormal), outlineContribution);
    }
`;

export function createMaterials({ assets }) {
  const shared = {
    time: { value: 0 },
    dtRatio: { value: 1 },
    tColors: { value: null },
    tNoise: { value: null },
    tNoiseTerrain: { value: null },
  };

  const textureReady = Promise.all([
    assets.loadTexture('images/atlas.png', 'srgb-nearest'),
    assets.loadTexture('images/noise-simplex-layered-pixellated-highq.ktx2', 'linearfilter-repeat'),
    assets.loadTexture('images/noises-terrain.ktx2', 'linearfilter-repeat'),
  ]).then(([colors, noise, terrain]) => {
    shared.tColors.value = colors;
    shared.tNoise.value = noise;
    shared.tNoiseTerrain.value = terrain;
  });

  const fogUniforms = {
    uFogColorNear: { value: new THREE.Color('#93a2bf') },
    uFogColorFar: { value: new THREE.Color('#9ea7b8') },
    uFogDistance: { value: 0.8 },
    uFogDensity: { value: 0.011 },
  };

  function baseMaterial(defines, extraUniforms = {}) {
    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.common,
      THREE.UniformsLib.lights,
      {
        emissive: { value: new THREE.Color(0) },
        specular: { value: new THREE.Color(1118481) },
        shininess: { value: 1 },
        uShowChars: { value: 1 },
        uFadeDistance: { value: 120 },
        diffuse: { value: new THREE.Color(0xffffff) },
      },
      fogUniforms,
    ]);
    uniforms.time = { value: 0 };
    uniforms.dtRatio = { value: 1 };
    uniforms.tColors = { value: shared.tColors.value };
    uniforms.tNoise = { value: shared.tNoise.value };
    uniforms.tNoiseTerrain = { value: shared.tNoiseTerrain.value };
    Object.assign(uniforms, extraUniforms);

    const material = new THREE.ShaderMaterial({
      name: 'messenger-base',
      defines: { USE_UV: 1, ...defines },
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      lights: true,
      side: THREE.FrontSide,
    });
    material.extensions = { derivatives: true };
    return material;
  }

  const all = [];

  function planet() {
    const m = baseMaterial({ IS_TERRAIN: 1 }, {
      uFadeDistance: { value: 170 },
    });
    m.receiveShadow = true;
    m.castShadow = false;
    all.push(m);
    return m;
  }

  function character() {
    const eye = { value: null };
    assets.loadTexture('images/mainchar-eye-highq.ktx2', 'repeat').then((t) => { eye.value = t; });
    const m = baseMaterial({ IS_CHARACTER: 1, HARD_CUT_SHADOW: 1 }, {
      uWetHeight: { value: 0 },
      tEye: eye,
      uSkinColor: { value: new THREE.Color('#ebced0') },
    });
    m.receiveShadow = true;
    m.castShadow = true;
    all.push(m);
    return m;
  }

  function npc() {
    const eye = { value: null };
    const mouth = { value: null };
    assets.loadTexture('images/eye-highq.ktx2', 'repeat').then((t) => { eye.value = t; });
    assets.loadTexture('images/mouth-highq.ktx2', 'repeat').then((t) => { mouth.value = t; });
    const m = baseMaterial({ IS_NPC: 1, HARD_CUT_SHADOW: 1 }, {
      uNPCSeed: { value: Math.random() },
      tEye: eye,
      tMouth: mouth,
      uMouthColor: { value: new THREE.Color('#2f1013') },
      uIsTalking: { value: 0 },
      uSkinColor: { value: new THREE.Color('#ebced0') },
    });
    m.receiveShadow = true;
    m.castShadow = true;
    all.push(m);
    return m;
  }

  function give() {
    const m = baseMaterial({ IS_GIVE: 1 });
    m.receiveShadow = true;
    m.castShadow = true;
    all.push(m);
    return m;
  }

  async function ready() { await textureReady; }

  function update(time) {
    for (const m of all) {
      if (m.uniforms.time) m.uniforms.time.value = time;
    }
  }

  return { ready, planet, character, npc, give, update, shared };
}
