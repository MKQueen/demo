/**
 * waterMaterial.js
 * ---------------------------------------------------------------------------
 * 水面「兼容方案」：Cesium.Material fabric 版本。
 *
 * 主方案（默认）是 PostProcessStage 屏幕空间水面（WaterRenderer.js），
 * 因为它能读场景深度/颜色，从而实现折射、深度吸收、焦散、岸边泡沫。
 * 本文件提供等价的 Material 版本，用于：
 *   1) 降级演示 / 对照（没有深度纹理时的兜底）；
 *   2) 文档里「CustomShader / Material 版本」的完整可运行代码；
 *   3) 想在 3D Tiles 或其它 primitive 上复用同一套 Seascape 波浪算法时。
 *
 * 局限（有意为之）：
 *   - 没有场景深度 → 不能做屏幕空间折射 / 深度吸收 / 焦散 / 岸边泡沫；
 *   - 水底可见性用「fresnel → alpha」近似，浅水看不出真实水底；
 *   - 波场用矩形的 st 坐标驱动（st × u_stScale → 波场单位），
 *     所以波浪纹理随矩形拉伸，适合平面矩形水面。
 *
 * 算法来源："Seascape" by Alexander Alekseev aka TDM (CC BY-NC-SA 3.0)，
 *           https://www.shadertoy.com/view/Ms2SD1
 * ---------------------------------------------------------------------------
 */

import * as Cesium from 'cesium';
import { SEASCAPE_COMMON_GLSL, SEASCAPE_ATTRIBUTION } from './waterPostProcess.glsl.js';

/**
 * Material 版 fragment 源码（fabric.source 形式，实现 czm_getMaterial）。
 * 与后处理版共用 SEASCAPE_COMMON_GLSL，所以 noise / sea_octave / map_detailed /
 * getNormal / getSkyColor 等函数与 ShaderToy 原版一一对应。
 */
export const WATER_MATERIAL_GLSL = /* glsl */ `
${SEASCAPE_ATTRIBUTION}

#define ITER_FRAGMENT 3

uniform float u_time;
uniform float u_waveHeight;
uniform float u_waveSpeed;
uniform float u_seaFreq;
uniform float u_choppy;
uniform float u_waterLevel;
uniform float u_foam;
uniform vec2  u_stScale;      // st(0..1) → 波场单位
uniform vec3  u_sunColor;
uniform vec3  u_shallowColor;
uniform vec3  u_deepColor;
uniform vec3  u_scatterColor;
uniform vec3  u_foamColor;
uniform float u_debug;      // 0=正常；1=diffuse；2=emission；3=alpha；4=法线；5=fresnel
uniform float u_diffMul;    // diffuse 系数（调参用）
uniform float u_emisMul;    // emission 系数（调参用）
uniform float u_alphaBase;  // 基础不透明度（调参用）
uniform float u_specMul;   // 高光缩放（调参用）
uniform vec3  u_eastWC;
uniform vec3  u_northWC;
uniform vec3  u_upWC;

// 太阳方向（ENU）——与后处理版一致，供 getSkyColor 使用
vec3 sunDirENU() {
    vec3 s = czm_sunDirectionWC;
    vec3 d = vec3(dot(s, u_eastWC), dot(s, u_northWC), dot(s, u_upWC));
    float l = length(d);
    return l > 1e-5 ? d / l : normalize(vec3(0.25, 0.55, 0.15));
}

${SEASCAPE_COMMON_GLSL}

czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);

    // ---- 1. Seascape 波浪法线 ----
    // 注意：Cesium 的 MaterialAppearance（BASIC 支持）**不提供 tangentToEyeMatrix**，
    // 直接把法线乘 tangentToEyeMatrix 会得到未初始化的零矩阵 → NaN → fresnel=1、
    // 反射方向朝下（湖面变成灰白色）。这里改为在 ENU 里构造：
    //   st(0..1) → 波场单位 p（工程里的矩形是 ENU 对齐的，st.x≈东、st.y≈北），
    //   getNormal 返回 (东, 上, 北) 分量 → 用 u_eastWC/u_northWC/u_upWC 转世界。
    vec2 p = materialInput.st * u_stScale;
    vec3 nSea = getNormal(vec3(p.x, 0.0, p.y), 0.02);
    // 法线横向放大 1.55：Material 版没有屏幕空间折射，远看时波纹是唯一能让
    // 湖面"不是一块色板"的特征，因此把起伏做得比后处理版更明显一点。
    vec3 nENU = normalize(vec3(nSea.x * 1.85, nSea.y, nSea.z * 1.85));
    vec3 nWC = normalize(u_eastWC * nENU.x + u_northWC * nENU.z + u_upWC * nENU.y);
    // 交给 Cesium 光照的法线（eye 空间）；法线只做方向旋转，用 viewRotation
    material.normal = normalize(czm_viewRotation * nWC);

    // ---- 2. 视线 / 反射 ----
    // positionToEyeEC：fragment → eye（eye 空间）；转成世界方向得到真实天空反射
    vec3 viewDirWC = normalize((czm_inverseView * vec4(materialInput.positionToEyeEC, 0.0)).xyz);
    float ndv = clamp(dot(nWC, viewDirWC), 0.0, 1.0);
    float fresnel = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);

    vec3 incidentWC = -viewDirWC;                       // eye → fragment
    vec3 reflWC = reflect(incidentWC, nWC);             // 世界空间反射方向
    vec3 reflENU = vec3(dot(reflWC, u_eastWC), dot(reflWC, u_northWC), dot(reflWC, u_upWC));
    vec3 skyColor = getSkyColor(reflENU);

    // ---- 3. 水色（无深度信息，用视角做浅水/深水的简化近似）----
    float shallowMix = smoothstep(0.0, 0.35, 1.0 - ndv);   // 掠射角偏浅水色
    vec3 waterBody = mix(u_deepColor, u_shallowColor, shallowMix * 0.65);
    // 往深水蓝里偏一点：青绿→"海蓝"，避免水库看起来像一池青色（与全局水面一致）
    waterBody = mix(waterBody, u_deepColor * 1.45, 0.28);
    // 太阳次表面 + 高光
    vec3 sunENU = sunDirENU();
    vec3 light = normalize(u_sunColor);
    float sss = pow(max(dot(nWC, sunENU), 0.0) * 0.4 + 0.6, 8.0);

    // 天光环境色：即使背光/阴面也给水体一层冷色底光，避免"深色板子"
    vec3 skyAmbient = getSkyColor(normalize(vec3(0.0, 1.0, 0.35)));
    // 水体自亮：diffuse 提高基底，远看（2.5km）也能一眼认出是湖面
    material.diffuse = (waterBody * (0.95 + 0.55 * sss) + skyAmbient * u_scatterColor * 0.65) * u_diffMul;
    // 反射天空（黄昏暖色高光）+ 掠射角更明显
    material.emission = (skyColor * (0.10 + 0.90 * fresnel) * 1.15 + u_sunColor * 0.02) * u_emisMul;
    material.specular = 0.90 * u_specMul;
    material.shininess = 90.0;
    // 水体更实一些（远看是"湖面"而不是透明色片）；掠射角接近镜面
    material.alpha = clamp(u_alphaBase + 0.40 * fresnel, u_alphaBase, 0.98);

    // ---- 调试模式（运行时只改 uniform，不重建材质）----
    if (u_debug > 0.5) {
        material.diffuse = vec3(0.0);
        material.emission = vec3(0.0);
        material.specular = 0.0;
        material.alpha = 1.0;
        if (u_debug < 1.5) material.diffuse = vec3(1.0, 0.0, 0.0);
        else if (u_debug < 2.5) material.diffuse = vec3(0.0, 1.0, 0.0);
        else if (u_debug < 3.5) material.diffuse = vec3(0.0, 0.0, 1.0);
        else if (u_debug < 4.5) material.diffuse = waterBody / 0.6;
        else if (u_debug < 5.5) material.diffuse = nENU * 0.5 + 0.5;
        else if (u_debug < 6.5) material.diffuse = vec3(fresnel);
        else if (u_debug < 7.5) { material.emission = vec3(1.0, 0.0, 0.0); }
        else if (u_debug < 8.5) { material.diffuse = vec3(1.0); }
        else if (u_debug < 9.5) { material.emission = skyColor; }
        else if (u_debug < 10.5) { material.emission = reflENU * 0.5 + 0.5; }
        else if (u_debug < 11.5) { material.emission = nWC * 0.5 + 0.5; }
        else { material.emission = vec3(fresnel); }
        return material;
    }
    return material;
}
`;

/**
 * 创建 Material 版水面材质。
 *
 * @param {object} [options]
 * @param {Cesium.Cartesian2} [options.stScale] 矩形的 st(0..1) 映射到多少「波场单位」
 * @returns {Cesium.Material}
 */
export function createWaterMaterial(options = {}) {
  const stScale = options.stScale ?? new Cesium.Cartesian2(1400, 1200);
  return new Cesium.Material({
    fabric: {
      type: 'FloodWater',
      uniforms: {
        u_time: 0,
        u_waveHeight: 0.08,
        u_waveSpeed: 0.9,
        u_seaFreq: 0.45,
        u_choppy: 4.0,
        u_waterLevel: 2.5,
        u_foam: 0.8,
        u_stScale: Cesium.Cartesian2.clone(stScale),
        u_sunColor: new Cesium.Cartesian3(1.0, 0.7, 0.38),
        u_shallowColor: new Cesium.Cartesian3(0.10, 0.34, 0.38),
        u_deepColor: new Cesium.Cartesian3(0.030, 0.110, 0.180),
        u_scatterColor: new Cesium.Cartesian3(0.075, 0.25, 0.30),
        u_foamColor: new Cesium.Cartesian3(0.96, 0.98, 0.98),
        u_debug: 0.0,
        // 远看（2.5km）蓄水区要能一眼认出是湖面：diffuse ×1.8、天空反射 ×1.0、
        // 不透明度 0.85；实测湖面像素约 RGB(71,116,120)，与灰白山体明显区分。
        u_diffMul: 1.8,
        u_emisMul: 1.0,
        u_alphaBase: 0.85,
        u_specMul: 1.0,
        u_eastWC: new Cesium.Cartesian3(0, 0, 0),
        u_northWC: new Cesium.Cartesian3(0, 0, 0),
        u_upWC: new Cesium.Cartesian3(0, 0, 1),
      },
      source: WATER_MATERIAL_GLSL,
    },
    // 注意：Cesium 1.147 里 translucent 是 Material 构造参数（不是 fabric 字段）
    translucent: true,
  });
}

export default createWaterMaterial;
