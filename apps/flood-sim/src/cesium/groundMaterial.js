/**
 * groundMaterial.js —— 用「地表贴图 + 自定义 Globe Material」给 Cesium 地形上色。
 *
 * 为什么不用 ImageryLayer：
 *   SingleTileImageryProvider 的贴图一旦遇到「超出矩形范围的地形瓦片」，纹理坐标
 *   会被 clamp 到边缘，在场景边界外产生明显的拉伸条纹；而地形本身是无限延伸的。
 *   改成 Globe Material 后，我们在着色器里自己计算 ENU 局部坐标并判断是否落在
 *   场景矩形内：矩形内采样地表贴图，矩形外走程序化配色，绝不会出现边缘涂抹。
 *
 * 额外收益：方案对贴图分辨率不敏感——近景的高频细节（田垄/林间/碎石）在 shader
 * 里程序化补足，2048px 的贴图在 14km 范围（约 7m/px）已经足够。
 */
import * as Cesium from 'cesium';
import { SCENE, HALF_W, HALF_H } from '../geo/terrainModel.js';

/** 从地形中心构造 ECEF / ENU 基向量，供 shader 计算局部坐标 */
export function createSceneFrame() {
  const center = Cesium.Cartesian3.fromDegrees(SCENE.lon0, SCENE.lat0, 0);
  const enu = Cesium.Transforms.eastNorthUpToFixedFrame(center);
  const east = Cesium.Matrix4.getColumn(enu, 0, new Cesium.Cartesian4());
  const north = Cesium.Matrix4.getColumn(enu, 1, new Cesium.Cartesian4());
  const up = Cesium.Matrix4.getColumn(enu, 2, new Cesium.Cartesian4());
  return {
    center,
    east: new Cesium.Cartesian3(east.x, east.y, east.z),
    north: new Cesium.Cartesian3(north.x, north.y, north.z),
    up: new Cesium.Cartesian3(up.x, up.y, up.z),
  };
}

const GROUND_MATERIAL_SOURCE = /* glsl */ `
uniform sampler2D u_groundTex;
uniform vec3 u_centerWC;
uniform vec3 u_eastWC;
uniform vec3 u_northWC;
uniform vec2 u_halfSize;
uniform float u_heightMax;
uniform vec3 u_hazeColor;

// 便宜的值噪声（高频细节用，避免贴图在近景发糊）
float gHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float gNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x),
               mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x), u.y);
}

czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec3 color;

    // 世界坐标 → 场景 ENU 局部米
    vec3 positionWC = (czm_inverseView * vec4(-materialInput.positionToEyeEC, 1.0)).xyz;
    vec3 rel = positionWC - u_centerWC;
    float x = dot(rel, u_eastWC);
    float y = dot(rel, u_northWC);

    float u = (x + u_halfSize.x) / (2.0 * u_halfSize.x);
    float v = (u_halfSize.y - y) / (2.0 * u_halfSize.y);
    float h = materialInput.height;
    float dist = length(materialInput.positionToEyeEC);

    bool outside = (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0);

    if (outside) {
        // 场景外：镜像平铺地表贴图，延续田野/林地观感，避免缩小地图时出现矩形“贴图岛”。
        vec2 mirrorUV = abs(fract(vec2(u, v) * 0.5) * 2.0 - 1.0);
        vec3 tex = texture(u_groundTex, mirrorUV).rgb;
        float pat = gNoise(vec2(x, y) * 0.02) * 0.5 + gNoise(vec2(x, y) * 0.11) * 0.25;
        color = tex * (0.86 + pat * 0.28);
        // 高处逐渐变成岩石/林地色
        vec3 rock = mix(vec3(0.16, 0.20, 0.15), vec3(0.34, 0.33, 0.30), smoothstep(120.0, 500.0, h));
        color = mix(color, rock, smoothstep(30.0, 260.0, h) * 0.85);
        if (h < 0.2) {
            color = mix(vec3(0.045, 0.10, 0.125), color, smoothstep(-8.0, 0.5, h));
        }
        float hazeOut = smoothstep(4200.0, 24000.0, dist) * 0.72;
        vec3 hazeCol = mix(u_hazeColor, vec3(0.80, 0.73, 0.64), 0.45);
        color = mix(color, hazeCol, hazeOut);
    } else {
        color = texture(u_groundTex, vec2(u, v)).rgb;
        // 近景程序化细节：贴图约 7m/px，补 1~12m 的高频颗粒
        float micro = gNoise(vec2(x, y) * 0.55) - 0.5;
        float meadow = gNoise(vec2(x, y) * 0.12) - 0.5;
        float landMask = smoothstep(4.0, 0.5, h);
        color *= 1.0 + (micro * 0.16 + meadow * 0.12) * landMask;

        // 大气透视
        float haze = smoothstep(5000.0, 30000.0, dist) * 0.72;
        vec3 hazeCol = mix(u_hazeColor, vec3(0.80, 0.73, 0.64), 0.45);
        color = mix(color, hazeCol, haze);
    }

    material.diffuse = color;
    material.alpha = 1.0;
    return material;
}
`;

/**
 * 创建 Globe Material。贴图传 blob URL，Cesium Material 会自动加载为纹理。
 * @param {string} groundTextureUrl
 */
export function createGroundMaterial(groundTextureUrl) {
  const frame = createSceneFrame();
  return new Cesium.Material({
    fabric: {
      type: 'FloodGroundMaterial',
      uniforms: {
        u_groundTex: groundTextureUrl,
        u_centerWC: frame.center,
        u_eastWC: frame.east,
        u_northWC: frame.north,
        u_halfSize: new Cesium.Cartesian2(HALF_W, HALF_H),
        u_heightMax: 700.0,
        u_hazeColor: new Cesium.Cartesian3(0.68, 0.62, 0.55),
      },
      source: GROUND_MATERIAL_SOURCE,
    },
  });
}
