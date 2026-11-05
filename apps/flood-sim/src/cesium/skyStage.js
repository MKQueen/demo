/**
 * skyStage.js —— 自定义黄昏天空（Cesium PostProcessStage）。
 *
 * 为什么不用 Cesium 自带 SkyAtmosphere/SkyBox：
 *   1. 本项目的视觉基调是「金色黄昏 + 低角度侧光」，需要完全可控的配色；
 *   2. 在 headless Chromium（ANGLE Metal）环境下 Cesium 的 SkyAtmosphere 会渲染成纯黑，
 *      导致自动截图/审计不可用；
 *   3. 水面 Shader 的天空反射需要和真实天空严格一致，自定义天空更容易对齐。
 *
 * 做法：后处理阶段判断「深度 == 远平面」的像素（Cesium 场景里没有天空几何，
 * 天空像素就是 depth==1 的像素），用相机射线方向重建出方向向量 → 按仰角画渐变 +
 * 太阳辉光/日盘。地形像素原样输出，因此不会影响地形/建筑/水面的颜色。
 */
import * as Cesium from 'cesium';

const SKY_FRAGMENT = /* glsl */ `
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;

uniform vec3 u_zenith;    // 天顶色
uniform vec3 u_mid;       // 中段天空色
uniform vec3 u_horizon;   // 地平线暖色
uniform vec3 u_ground;    // 地平线以下雾霭色
uniform vec3 u_sunColor;  // 太阳色
uniform vec3 u_cloudColor;
uniform float u_sunIntensity;
uniform float u_debug;

in vec2 v_textureCoordinates;

float skyHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float skyNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(skyHash(i), skyHash(i + vec2(1.0, 0.0)), u.x),
               mix(skyHash(i + vec2(0.0, 1.0)), skyHash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
    vec4 sceneColor = texture(colorTexture, v_textureCoordinates);
    // 直接读深度缓冲原始值：天空像素是 clear 值 1.0，几何体在 log-depth 下都 < 1.0。
    // 不能用 czm_readDepth 反算后的窗口深度做阈值（log depth 在近景也会接近 1）。
    float rawDepth = texture(depthTexture, v_textureCoordinates).r;

    if (rawDepth < 0.9999999) {
        // 有几何体的像素：原样输出
        out_FragColor = sceneColor;
        return;
    }

    // 相机射线（世界方向）
    vec2 ndc = v_textureCoordinates * 2.0 - 1.0;
    vec4 farClip = czm_inverseProjection * vec4(ndc, 1.0, 1.0);
    vec3 rayEye = normalize(farClip.xyz / farClip.w);
    vec3 rayWC = normalize(mat3(czm_inverseView) * rayEye);

    vec3 camWC = (czm_inverseView * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 up = normalize(camWC);
    float elevation = dot(rayWC, up); // sin(仰角)

    float t = clamp(elevation, 0.0, 1.0);
    vec3 color = mix(u_horizon, u_mid, smoothstep(0.0, 0.22, t));
    color = mix(color, u_zenith, smoothstep(0.16, 0.82, t));
    // 地平线以下（一般被地形挡住，偶尔在缺口露出）→ 雾霭色
    color = mix(u_ground, color, smoothstep(-0.008, 0.012, elevation));

    // 低空云带：用射线方向做低频噪声，贴着地平线更浓
    float az = atan(rayWC.z, rayWC.x);
    float cloudBand = skyNoise(vec2(az * 3.0 + 1.7, elevation * 9.0)) *
                      skyNoise(vec2(az * 8.0 - 2.3, elevation * 21.0));
    float cloudMask = smoothstep(0.16, 0.02, elevation) * smoothstep(0.02, 0.16, elevation);
    color = mix(color, u_cloudColor, clamp(cloudBand * 0.55, 0.0, 0.5) * cloudMask);

    // 太阳方向（Cesium 自动 uniform），辉光 + 日盘
    vec3 sunDir = normalize(czm_sunDirectionWC);
    float mu = max(dot(rayWC, sunDir), 0.0);
    float glow = pow(mu, 8.0) * 0.35 + pow(mu, 48.0) * 0.55 + pow(mu, 512.0) * 0.9;
    color += u_sunColor * glow * u_sunIntensity;
    color += u_sunColor * smoothstep(0.99955, 0.99985, mu) * 2.2 * u_sunIntensity;

    if (u_debug > 0.5) {
        out_FragColor = vec4(clamp(elevation, 0.0, 1.0), clamp(-elevation, 0.0, 1.0), 0.0, 1.0);
        return;
    }
    out_FragColor = vec4(color, 1.0);
}
`;

export function createSkyStage(options = {}) {
  return new Cesium.PostProcessStage({
    name: 'TIDELINE_SKY',
    fragmentShader: SKY_FRAGMENT,
    uniforms: {
      u_zenith: new Cesium.Cartesian3(0.078, 0.129, 0.216),
      u_mid: new Cesium.Cartesian3(0.29, 0.373, 0.478),
      u_horizon: new Cesium.Cartesian3(0.86, 0.635, 0.451),
      u_ground: new Cesium.Cartesian3(0.62, 0.596, 0.565),
      u_sunColor: new Cesium.Cartesian3(1.0, 0.847, 0.659),
      u_cloudColor: new Cesium.Cartesian3(0.93, 0.78, 0.63),
      u_sunIntensity: 1.0,
      u_debug: options.debug ? 1.0 : 0.0,
    },
  });
}
