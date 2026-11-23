// Environment materials ported from messenger.abeto.co:
//   sky      — animated painterly cloud dome
//   leaves   — instanced leafy-tree cards (attributes: centr/centr_tree/rand/detail/leavescolor)
//   cables   — screen-space fat lines
//   water    — stylised animated water (simplified from the depth-aware original)
//   intro    — intro planet material
//   cloud    — intro cloud puffs

import * as THREE from 'three';
import {
  fit, encoding, linearstep, colorutils, sinenoise, triplanar, fog,
  matrixutils, rotate,
} from '../shaders/chunks.js';

// ---------------------------------------------------------------- sky
const SKY_VERT = /* glsl */ `
    varying vec2 vHighPrecisionZW;
    varying vec2 vUv;
    void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vHighPrecisionZW = gl_Position.zw;
        vUv = uv;
    }
`;

const SKY_FRAG = /* glsl */ `
    uniform vec2 resolution;
    uniform float time;

    layout(location = 1) out highp vec4 gInfo;

    varying vec2 vHighPrecisionZW;
    varying vec2 vUv;
    uniform sampler2D tCloudNoise;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;

    void main() {
        vec2 screenUv = gl_FragCoord.xy / resolution;

        float t = time * 0.0005;

        vec2 uv = vUv * 1.0;

        float noise = texture2D(tCloudNoise, uv * vec2(1.0, 2.0) + vec2(t)).r;
        noise *= texture2D(tCloudNoise, uv * vec2(1.0, 2.0)).r;

        noise *= smoothstep(0.1, 0.2, 1.0 - abs(vUv.y - 0.5) * 2.0);

        float blend = smoothstep(0.23, 0.31, noise);
        float id = mix(0.01, 1.0, blend);
        vec3 cloudColor = mix(uColor3, uColor2, screenUv.y);
        vec3 color = mix(uColor1, cloudColor, blend);

        gl_FragColor = vec4(color, id);
        gInfo = vec4(1.0 - (0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5), vec2(0.0), 1.0);
    }
`;

// ---------------------------------------------------------------- tree leaves
const LEAVES_VERT = /* glsl */ `
    #define PI2 6.283185307179586

    struct DirectionalLight {
        vec3 direction;
        vec3 color;
    };
    uniform DirectionalLight directionalLights[ 1 ];

    #include <shadowmap_pars_vertex>
    vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
        return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
    }

    uniform vec2 resolution;
    uniform float time;
    uniform float dtRatio;

    ${matrixutils}
    ${fit}
    ${rotate}
    ${sinenoise}

    attribute vec3 centr;
    attribute vec3 centr_tree;
    attribute vec4 rand;
    attribute int detail;
    attribute int leavescolor;

    varying vec2 vUv;
    varying vec4 vRand;
    varying vec4 vPos;
    varying vec2 vHighPrecisionZW;
    flat varying vec3 vCentrTree;

    flat varying vec3 vNormal;
    flat varying vec3 vLightDir;
    flat varying int vDetail;
    flat varying float vColor;

    uniform float uLeavesShake;
    uniform float uShakeSpeed;
    uniform float uScale;

    uniform vec3 charPos;
    uniform float charSpeed;

    void main() {
        vUv = mix(uv, vec2(1.0 - uv.x, uv.y), step(0.5, rand.x));
        vRand = rand;
        vDetail = detail;
        vCentrTree = centr_tree;
        vLightDir = vec3(0.0);
        vColor = float(leavescolor);

        #if NUM_DIR_LIGHTS > 0
            vLightDir = normalize(directionalLights[0].direction);
        #endif

        float scale = mix(0.5, 1.0, vRand.w) * uScale;
        float shake = sinenoise1(vec3(centr * 2.0) + vec3(-time * 0.1 * uShakeSpeed, 0.0, time * 0.15 * uShakeSpeed)) * PI2 * uLeavesShake * mix(0.25, 1.0, vRand.y);

        mat3 rot = mat3(1.0);

        if (detail == 1) {
            vec2 aspectVec = vec2(resolution.x / resolution.y, 1.0);

            vec4 quadPos = projectionMatrix * modelViewMatrix * vec4(centr, 1.0);
            vec4 bushPos = projectionMatrix * modelViewMatrix * vec4(centr_tree, 1.0);
            vec2 quad2D = quadPos.xy / quadPos.w * aspectVec;
            vec2 bush2D = bushPos.xy / bushPos.w * aspectVec;

            vec2 dir = normalize(quad2D - bush2D);
            float angle = atan(dir.y, dir.x);
            rot = rotateZ(angle - PI2 * 0.25);
        } else {
            rot = rotateZ(fit(vRand.z, 0.0, 1.0, -PI2, PI2) + shake);
        }

        float distToPlayer = length(charPos - centr);
        float disp = fit(distToPlayer, 0.0, fit(charSpeed, 0.0, 0.001, 0.0, 0.85), 1.0, 0.0) * fit(charSpeed, 0.0, 0.15, 0.0, 10.0);
        if (length(disp) > 0.001) rot = rotateZ(sin(disp) * 0.15 * sign(rand.w - 0.5)) * rot;

        vec3 posLeaf = rot * vec3(uv * 2.0 - 1.0, 0.0) * scale;

        vec3 pos = centr;
        vec3 right = getViewRight();
        vec3 up = getViewUp();
        vec3 back = getViewBack();
        pos += right * posLeaf.x;
        pos += up * posLeaf.y;
        pos += back * posLeaf.z;

        float shakePosMult = 2.0;
        float shakeDisp = 0.025;
        float shakeSpeed = 1.1;
        vec3 shakeX = right * sin((centr.x + centr.y) * shakePosMult + 534.35 + time * shakeSpeed) * shakeDisp;
        vec3 shakeZ = back * sin((centr.z + centr.y) * shakePosMult + 543.55 + time * shakeSpeed * 0.5) * shakeDisp;
        pos -= centr;
        pos += shakeX + shakeZ;
        pos += centr;

        vNormal = normalize(normalMatrix * normal);

        vec3 transformedNormal = vNormal;
        vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
        #include <shadowmap_vertex>

        vPos = viewMatrix * worldPosition;

        gl_Position = projectionMatrix * vPos;

        vec4 centrPos = projectionMatrix * modelViewMatrix * vec4(centr_tree, 1.0);
        vHighPrecisionZW = centrPos.zw;
    }
`;

const LEAVES_FRAG = /* glsl */ `
    layout(location = 1) out highp vec4 gInfo;

    #include <packing>
    #include <shadowmap_pars_fragment>

    uniform float time;
    uniform float dtRatio;

    ${encoding}
    ${sinenoise}
    ${colorutils}
    ${fog}

    varying vec2 vUv;
    varying vec4 vPos;
    varying vec4 vRand;
    varying vec2 vHighPrecisionZW;
    flat varying vec3 vCentrTree;
    flat varying int vDetail;
    flat varying vec3 vNormal;
    flat varying vec3 vLightDir;
    flat varying float vColor;

    uniform sampler2D tTrees;
    uniform sampler2D tTreeDetail;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform vec2 uNearFar;

    void main() {
        float surfaceId = fract((vCentrTree.x + vCentrTree.y + vCentrTree.z) * 3.424);
        float negativeDistance = perspectiveDepthToViewZ(gl_FragCoord.z, uNearFar.x, uNearFar.y);

        if (vDetail == 1) {
            float shapes = 5.0;
            float shapesStep = 1.0 / shapes;
            float offset = floor(mod((vRand.z * 4.35 + vRand.w * 43.5) * shapes, shapes));
            vec2 uv = vec2(vUv.x * shapesStep + offset * shapesStep, vUv.y);
            float shape = texture2D(tTreeDetail, uv).r;
            if (shape > 0.9) discard;

            surfaceId = fract(vRand.x * 32.234);

            gl_FragDepth = viewZToPerspectiveDepth(negativeDistance + 0.2, uNearFar.x, uNearFar.y);
        } else {
            float shape = texture2D(tTrees, vUv).r;
            if (shape > 0.9) discard;

            float noise = sinenoise1(vec3(vUv * mix(0.8, 1.0, vRand.z) * 5.0, time * 0.1));
            gl_FragDepth = viewZToPerspectiveDepth(negativeDistance + noise * 0.025, uNearFar.x, uNearFar.y);
        }

        float outlineContribution = step(sinenoise1(vec3(vUv * 2.0, vRand.x + vRand.w * 34.32)), 0.35);

        vec3 geometryNormal = normalize(vNormal);
        float light = dot(geometryNormal, normalize(vLightDir));

        float shadow = 0.0;
        #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHTS > 0 && NUM_DIR_LIGHT_SHADOWS > 0
            DirectionalLightShadow directionalLightShadow;
            directionalLightShadow = directionalLightShadows[0];
            shadow = getShadow(
                directionalShadowMap[0],
                directionalLightShadow.shadowMapSize,
                directionalLightShadow.shadowIntensity,
                directionalLightShadow.shadowBias,
                directionalLightShadow.shadowRadius,
                vDirectionalShadowCoord[0]
            );
        #endif

        light = min(light, shadow);

        vec3 grassColor = mix(uColor1, uColor2, clamp(vColor, 0.0, 1.0));
        grassColor = mix(grassColor, uColor3, clamp(vColor - 1.0, 0.0, 1.0));

        vec3 colorhsv = rgb2hsv(grassColor);
        vec3 colorShadow = colorhsv;
        colorShadow.r -= 0.02;
        colorShadow.b *= 0.5;
        colorShadow = hsv2rgb(colorShadow);

        vec3 color = mix(colorShadow, grassColor, smoothstep(0.0, 0.1, light));

        addFog(color, vPos.z);

        gl_FragColor = vec4(color, surfaceId);
        gInfo = vec4(1.0 - (0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5), vec2(0.0), outlineContribution);
    }
`;

// ---------------------------------------------------------------- cables
const CABLES_VERT = /* glsl */ `
    attribute float randomm;
    attribute vec3 nextpos;
    attribute vec3 prevpos;
    attribute vec3 curvepos;

    uniform vec2 resolution;
    uniform float time;
    uniform float dtRatio;

    ${fit}

    uniform float uWidth;
    uniform sampler2D tNoise;

    varying vec2 vHighPrecisionZW;
    varying vec2 vUv;
    varying vec4 vPos;
    varying float vRandom;

    void main() {
        vUv = uv;
        vRandom = randomm;

        vec4 worldPos = modelMatrix * vec4(curvepos, 1.0);
        vec4 worldPrevPos = modelMatrix * vec4(prevpos, 1.0);
        vec4 worldNextPos = modelMatrix * vec4(nextpos, 1.0);

        vec4 viewPos = viewMatrix * worldPos;
        vPos = viewPos;

        mat4 projView = projectionMatrix * viewMatrix;
        vec4 finalPos = projView * worldPos;
        vec4 finalPrevPos = projView * worldPrevPos;
        vec4 finalNextPos = projView * worldNextPos;

        float aspect = resolution.x / resolution.y;
        vec2 aspectVec = vec2(aspect, 1.0);
        vec2 posScreen = finalPos.xy / finalPos.w * aspectVec;
        vec2 prevPosScreen = finalPrevPos.xy / finalPrevPos.w * aspectVec;
        vec2 nextPosScreen = finalNextPos.xy / finalNextPos.w * aspectVec;

        vec2 dirA = normalize((posScreen - prevPosScreen));
        vec2 dirB = normalize((nextPosScreen - posScreen));
        vec2 tangent = normalize(dirA + dirB);
        vec2 normal = normalize(vec2(-tangent.y, tangent.x));

        if (uv.x > 0.5) {
            normal = -normal;
        }
        normal.x /= aspect;

        float width = viewPos.z * 0.0009 * aspect;
        normal *= width;
        vec4 thicknessOffset = vec4(normal.xy, 0.0, 0.0);

        gl_Position = finalPos + thicknessOffset;
        vHighPrecisionZW = gl_Position.zw;
    }
`;

const CABLES_FRAG = /* glsl */ `
    layout(location = 1) out highp vec4 gInfo;

    uniform float time;
    uniform float dtRatio;

    ${fog}

    uniform vec3 uColor;
    uniform sampler2D tNoise;

    varying float vRandom;
    varying vec2 vUv;
    varying vec4 vPos;
    varying vec2 vHighPrecisionZW;

    void main() {
        float n = texture2D(tNoise, vec2(0.5 + vRandom, vUv.y * 0.02)).r;
        if (n < 0.4) discard;

        vec3 color = uColor;
        addFog(color, vPos.z);
        gl_FragColor = vec4(color, 1.0);
        gInfo = vec4(1.0, vec2(0.0), 0.0);
    }
`;

// ---------------------------------------------------------------- water (simplified)
const WATER_VERT = /* glsl */ `
    varying vec2 vUv;
    varying vec4 vPos;
    varying vec2 vHighPrecisionZW;
    void main() {
        vUv = uv;
        vPos = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * vPos;
        vHighPrecisionZW = gl_Position.zw;
    }
`;

const WATER_FRAG = /* glsl */ `
    layout(location = 1) out highp vec4 gInfo;

    uniform float time;
    uniform float dtRatio;
    uniform vec2 resolution;

    ${fit}
    ${sinenoise}
    ${colorutils}
    ${fog}

    uniform sampler2D tNoise;

    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColorWaves1;
    uniform vec3 uColorWaves2;

    varying vec2 vUv;
    varying vec4 vPos;
    varying vec2 vHighPrecisionZW;

    void main() {
        vec2 meshUV = vUv * 1.25;
        float timeOffset = sinenoise1(vec3(meshUV * 50.0, 0.0)) * 0.5 + 0.5;
        float seaTime = time + timeOffset * 10.0;

        vec2 offsetSea1 = vec2(cos(seaTime * 1.0 + 3.432), sin(seaTime * 2.0 + 3.234)) * 0.01;
        float noiseSea1 = texture2D(tNoise, meshUV * 8.0 - seaTime * 0.01 + offsetSea1).r;
        vec2 offsetSea2 = vec2(sin(seaTime * 1.5 + 6.54353), cos(seaTime * 0.5 + 43.342)) * 0.0085;
        float noiseSea2 = texture2D(tNoise, meshUV * 10.0 + 34.54 + seaTime * 0.015 + offsetSea2).r;
        float noiseSea = noiseSea1 * noiseSea2;

        float wavesN = step(0.1, pow(noiseSea, 2.0));
        vec3 seaColor = mix(uColorWaves1, uColor2, wavesN);

        vec2 offsetSea3 = vec2(sin(seaTime * 2.0 + 12.435), cos(seaTime * 2.75 + 34.3)) * 0.011;
        float noiseSea3 = texture2D(tNoise, meshUV * 20.0 - seaTime * 0.01 + offsetSea3 - 3.525).r;
        vec2 offsetSea4 = vec2(cos(seaTime * 1.25 + 3.345), sin(seaTime * 2.5 + 97.798)) * 0.0095;
        float noiseSea4 = texture2D(tNoise, meshUV * 10.0 + 4.5434 + seaTime * 0.02 + offsetSea4 + 2.34).r;
        float additionaNoiseSea = noiseSea3 * noiseSea4;

        float wavesN2 = step(0.45, additionaNoiseSea);
        seaColor = mix(seaColor, uColorWaves2, wavesN2);

        vec3 colorWater = mix(uColor1, seaColor, 0.6);

        addFog(colorWater, vPos.z);
        gl_FragColor = vec4(colorWater, 0.9);
        // no outline contribution: avoids visible triangle seams across the surface
        gInfo = vec4(1.0 - (0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5), vec2(0.0), 0.0);
    }
`;


// ---------------------------------------------------------------- grass
const GRASS_VERT = /* glsl */ `
    uniform float time;
    uniform float dtRatio;
    uniform vec2 resolution;

    attribute vec3 aPos;
    attribute vec3 aUp;
    attribute vec4 aRandom;

    varying vec2 vUv;
    varying vec4 vRand;
    varying vec4 vPos;
    varying vec2 vHighPrecisionZW;
    varying float vRandom;

    mat3 rotateY(float angle) {
        float c = cos(angle);
        float s = sin(angle);
        return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
    }

    void main() {
        vec3 up = normalize(aUp);
        // stable tangent frame around the surface normal
        vec3 ref = abs(up.x) > 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
        vec3 right = normalize(cross(up, ref));
        vec3 back = normalize(cross(up, right));

        float yaw = aRandom.x * 6.2831853;
        mat3 rot = rotateY(yaw);
        vec3 local = rot * position;

        float scale = mix(0.55, 1.12, aRandom.w);
        float sway = sin(time * 1.6 + aRandom.y * 12.0 + aPos.x * 0.6) * 0.09 * position.y;
        vec3 offset = right * local.x * scale + up * position.y * scale + back * (local.z * scale + sway);

        vec3 worldPosition = aPos + offset;

        vUv = uv;
        vRand = aRandom;
        vRandom = fract(aRandom.y * 7.13 + aRandom.z * 3.7);
        vPos = viewMatrix * vec4(worldPosition, 1.0);
        gl_Position = projectionMatrix * vPos;
        vHighPrecisionZW = gl_Position.zw;
    }
`;

const GRASS_FRAG = /* glsl */ `
    layout(location = 1) out highp vec4 gInfo;

    uniform float time;
    uniform float dtRatio;
    ${fog}

    uniform sampler2D tGrass;
    uniform sampler2D tColors;

    varying vec2 vUv;
    varying vec4 vRand;
    varying vec4 vPos;
    varying vec2 vHighPrecisionZW;
    varying float vRandom;

    void main() {
        float grassUVAmount = 10.0;
        float grassUVX = mix(vUv.x, 1.0 - vUv.x, step(0.5, vRand.w));
        vec2 grassUV = vec2(
            fract(grassUVX / grassUVAmount + 1.0 / grassUVAmount * floor(vRand.y * grassUVAmount)),
            vUv.y * 0.5 + 0.5 * floor(mod(vRand.z * 2.0 + vRand.x * 3.32, 2.0))
        );
        float shape = texture2D(tGrass, grassUV).r;
        if (shape > 0.1) discard;

        vec3 baseColor = vec3(0.30, 0.48, 0.28);
        vec3 lightColor = vec3(0.52, 0.68, 0.40);
        vec3 color = mix(baseColor, lightColor, clamp(vRandom * 0.85 + 0.15, 0.0, 1.0));

        addFog(color, vPos.z);

        gl_FragColor = vec4(color, 1.0);
        gInfo = vec4(1.0 - (0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5), vec2(0.0), 0.0);
    }
`;


// ---------------------------------------------------------------- birds
const BIRD_VERT = /* glsl */ `
    varying vec2 vZW;
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vZW = gl_Position.zw;
    }
`;
const BIRD_FRAG = /* glsl */ `
    layout(location = 1) out highp vec4 gInfo;
    uniform vec3 uColor;
    varying vec2 vZW;
    void main() {
        gl_FragColor = vec4(uColor, 1.0);
        gInfo = vec4(1.0 - (0.5 * vZW[0] / vZW[1] + 0.5), vec2(0.0), 0.0);
    }
`;

// ---------------------------------------------------------------- intro planet
const INTRO_VERT = /* glsl */ `
    attribute float surfaceId;
    attribute int elementId;

    varying vec2 vUv;
    varying vec2 vHighPrecisionZW;
    varying vec3 wNormal;
    varying vec3 wPos;
    varying vec4 vPos;
    varying vec3 vNormal;
    varying float vSurfaceId;
    flat varying int vElementId;

    #include <shadowmap_pars_vertex>

    void main() {
        vUv = uv;
        vElementId = elementId;
        vSurfaceId = surfaceId;

        vec4 worldPosition = modelMatrix * vec4(position, 1.0);

        wNormal = normal;
        wPos = position.xyz;
        vNormal = normalize(normalMatrix * normal);

        vec3 transformedNormal = vNormal;
        #include <shadowmap_vertex>

        vPos = viewMatrix * worldPosition;

        gl_Position = projectionMatrix * vPos;
        vHighPrecisionZW = gl_Position.zw;
    }
`;

const INTRO_FRAG = /* glsl */ `
    layout(location = 1) out highp vec4 gInfo;

    uniform float time;
    uniform float dtRatio;
    uniform vec2 resolution;

    ${fit}
    ${encoding}
    ${linearstep}
    ${colorutils}
    ${triplanar}

    varying vec3 wPos;
    varying vec3 wNormal;
    varying vec3 vNormal;
    varying vec4 vPos;
    varying float vSurfaceId;
    flat varying int vElementId;

    uniform sampler2D tColors;
    uniform sampler2D tNoiseTerrain;
    uniform sampler2D tNoise;

    varying vec2 vUv;
    varying vec2 vHighPrecisionZW;

    #include <packing>
    #include <shadowmap_pars_fragment>

    void main() {
        float outlineContribution = 1.0;
        float surfaceId = vSurfaceId;

        vec4 triplanarNoise = triplanar(tNoise, wNormal, wPos.xyz * 0.07, 1.0);
        float height = length(wPos);
        float grassMask = 0.0;

        if (vElementId == 1) {
            grassMask = step(0.15, max(0.0, -triplanarNoise.r * 1.5 + dot(wNormal, normalize(wPos))) - triplanarNoise.g * 0.35 + 0.1 - triplanarNoise.b * 0.05);

            float n1 = sin(height * 0.025 + (wNormal.x + wNormal.y + wNormal.z) * 0.05 + (wPos.x + wPos.y + wPos.z) * 1.5);
            float striations = texture2D(tNoise, vec2(n1 * 0.01, height * 0.07 - n1 * 0.02)).g;
            striations = step(0.47, striations + triplanarNoise.r * 0.2 + triplanarNoise.g * 0.05);

            surfaceId += striations * (1.0 - grassMask) * step(0.25, triplanarNoise.r);
        }

        vec2 colorUV = vUv;
        if (grassMask > 0.5) colorUV = vec2(0.15, 0.95);

        vec3 color = texture2D(tColors, colorUV).rgb;

        #if NUM_DIR_LIGHTS > 0 && defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
            DirectionalLightShadow directionalLightShadow;
            directionalLightShadow = directionalLightShadows[0];
            float shadow = getShadow(
                directionalShadowMap[0],
                directionalLightShadow.shadowMapSize,
                directionalLightShadow.shadowIntensity,
                directionalLightShadow.shadowBias,
                directionalLightShadow.shadowRadius,
                vDirectionalShadowCoord[0]
            );
            vec3 colorShadow = rgb2hsv(color);
            colorShadow.r -= 0.02;
            colorShadow.b *= 0.5;
            colorShadow = hsv2rgb(colorShadow);
            color = mix(colorShadow, color, smoothstep(0.2, 0.4, shadow));
        #endif

        outlineContribution *= step(0.17, triplanarNoise.g * triplanarNoise.b);
        outlineContribution = step(0.5, outlineContribution);
        surfaceId += grassMask * 0.1;

        gl_FragColor = vec4(color, surfaceId);
        gInfo = vec4(1.0 - (0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5), vec2(0.0), outlineContribution);
    }
`;

export function createEnvironmentMaterials({ assets }) {
  const all = [];
  const textures = {};
  const ready = Promise.all([
    assets.loadTexture('images/clouds_noise_512.ktx2', 'srgb-repeat'),
    assets.loadTexture('images/tree-leaves.ktx2', 'linearfilter'),
    assets.loadTexture('images/tree-leaves-detail.ktx2', 'linearfilter'),
    assets.loadTexture('images/water-noises-highq.ktx2', 'linearfilter-repeat'),
    assets.loadTexture('images/noise-simplex-layered-pixellated-highq.ktx2', 'linearfilter-repeat'),
    assets.loadTexture('images/noises-terrain.ktx2', 'linearfilter-repeat'),
    assets.loadTexture('images/atlas.png', 'srgb-nearest'),
    assets.loadTexture('images/grass-blades-highq.ktx2', 'linearfilter'),
  ]).then(([clouds, trees, treeDetail, waterNoise, noise, noiseTerrain, colors, grassBlades]) => {
    Object.assign(textures, { clouds, trees, treeDetail, waterNoise, noise, noiseTerrain, colors, grassBlades });
  });

  const fogUniforms = {
    uFogColorNear: { value: new THREE.Color('#93a2bf') },
    uFogColorFar: { value: new THREE.Color('#9ea7b8') },
    uFogDistance: { value: 0.8 },
    uFogDensity: { value: 0.011 },
  };

  function register(material) {
    all.push(material);
    return material;
  }

  function sky() {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        resolution: { value: new THREE.Vector2(innerWidth, innerHeight) },
        time: { value: 0 },
        tCloudNoise: { value: textures.clouds },
        uColor1: { value: new THREE.Color('#75bdc3') },
        uColor2: { value: new THREE.Color('#9fe2e0') },
        uColor3: { value: new THREE.Color('#b9ebea') },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(55, 32, 32), material);
    mesh.name = 'sky';
    mesh.rotation.x = 1;
    mesh.frustumCulled = false;
    register(material);
    return { mesh, material };
  }

  function leaves({ near = 0.2, far = 175 } = {}) {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.common, THREE.UniformsLib.lights, {
      uScale: { value: 0.28 },
      uLeavesShake: { value: 0.25 },
      uShakeSpeed: { value: 0.75 },
      uNearFar: { value: new THREE.Vector2(near, far) },
      tTrees: { value: null },
      tTreeDetail: { value: null },
      uColor1: { value: new THREE.Color('#5b9f7b') },
      uColor2: { value: new THREE.Color('#649c75') },
      uColor3: { value: new THREE.Color('#4e8c6d') },
      charPos: { value: new THREE.Vector3() },
      charSpeed: { value: 0 },
      resolution: { value: new THREE.Vector2(innerWidth, innerHeight) },
      time: { value: 0 },
      dtRatio: { value: 1 },
    }]);
    uniforms.tTrees.value = textures.trees;
    uniforms.tTreeDetail.value = textures.treeDetail;
    Object.assign(uniforms, fogUniforms);
    const material = new THREE.ShaderMaterial({
      name: 'trees-leaves',
      uniforms,
      vertexShader: LEAVES_VERT,
      fragmentShader: LEAVES_FRAG,
      lights: true,
      shadowSide: THREE.FrontSide,
      side: THREE.DoubleSide,
    });
    material.receiveShadow = true;
    material.castShadow = true;
    return register(material);
  }

  function cables() {
    const uniforms = THREE.UniformsUtils.merge([{
      tNoise: { value: null },
      uColor: { value: new THREE.Color('#4d5457') },
      uWidth: { value: 1 },
      resolution: { value: new THREE.Vector2(innerWidth, innerHeight) },
      time: { value: 0 },
      dtRatio: { value: 1 },
    }]);
    uniforms.tNoise.value = textures.clouds;
    Object.assign(uniforms, fogUniforms);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: CABLES_VERT,
      fragmentShader: CABLES_FRAG,
      side: THREE.DoubleSide,
    });
    return register(material);
  }

  function water() {
    const uniforms = THREE.UniformsUtils.merge([{
      tNoise: { value: null },
      resolution: { value: new THREE.Vector2(innerWidth, innerHeight) },
      time: { value: 0 },
      dtRatio: { value: 1 },
      uColor1: { value: new THREE.Color('#4c868c') },
      uColor2: { value: new THREE.Color('#437a7f') },
      uColorWaves1: { value: new THREE.Color('#366a6f') },
      uColorWaves2: { value: new THREE.Color('#6facb2') },
    }]);
    uniforms.tNoise.value = textures.waterNoise;
    Object.assign(uniforms, fogUniforms);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    return register(material);
  }

  function grass() {
    const uniforms = THREE.UniformsUtils.merge([{
      resolution: { value: new THREE.Vector2(innerWidth, innerHeight) },
      time: { value: 0 },
      dtRatio: { value: 1 },
      tGrass: { value: null },
      tColors: { value: null },
      uCharPos: { value: new THREE.Vector3() },
    }]);
    uniforms.tGrass.value = textures.grassBlades;
    uniforms.tColors.value = textures.colors;
    Object.assign(uniforms, fogUniforms);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: GRASS_VERT,
      fragmentShader: GRASS_FRAG,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    return register(material);
  }

  function bird() {
    const material = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#3a4548') } },
      vertexShader: BIRD_VERT,
      fragmentShader: BIRD_FRAG,
      side: THREE.DoubleSide,
    });
    return register(material);
  }

  function intro() {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.common, THREE.UniformsLib.lights, {
      tColors: { value: null },
      tNoiseTerrain: { value: null },
      tNoise: { value: null },
      time: { value: 0 },
      dtRatio: { value: 1 },
      resolution: { value: new THREE.Vector2(innerWidth, innerHeight) },
    }]);
    uniforms.tColors.value = textures.colors;
    uniforms.tNoiseTerrain.value = textures.noiseTerrain;
    uniforms.tNoise.value = textures.noise;
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: INTRO_VERT,
      fragmentShader: INTRO_FRAG,
      lights: true,
      side: THREE.FrontSide,
    });
    material.receiveShadow = true;
    material.castShadow = true;
    return register(material);
  }

  function update(time, { charPos, charSpeed } = {}) {
    for (const material of all) {
      if (material.uniforms.time) material.uniforms.time.value = time;
      if (charPos && material.uniforms.charPos) material.uniforms.charPos.value.copy(charPos);
      if (charSpeed !== undefined && material.uniforms.charSpeed) material.uniforms.charSpeed.value = charSpeed;
    }
  }

  function setSize(width, height, pixelRatio = 1) {
    const w = width * pixelRatio;
    const h = height * pixelRatio;
    for (const material of all) {
      if (material.uniforms.resolution) material.uniforms.resolution.value.set(w, h);
    }
  }

  return { ready, sky, leaves, cables, water, grass, bird, intro, update, setSize, textures };
}
