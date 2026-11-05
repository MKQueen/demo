/**
 * waterPostProcess.glsl.js
 * ---------------------------------------------------------------------------
 * 「潮线 TIDELINE · 3D 动态水淹模拟」水面后处理 Fragment Shader
 *
 * 算法来源（必须保留署名，见文件头）：
 *   "Seascape" by Alexander Alekseev aka TDM — 2014
 *   https://www.shadertoy.com/view/Ms2SD1
 *   License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0
 *            Unported (CC BY-NC-SA 3.0)
 *
 *   本项目把 Seascape 的**屏幕空间 raymarch 海面**移植为 Cesium 的
 *   PostProcessStage：用场景深度纹理重建每像素的世界坐标，再做
 *   「射线 × 带曲率修正的水面」解析求交，得到水面像素后复用 Seascape 的
 *   noise / sea_octave / map / map_detailed / getNormal / diffuse /
 *   specular / getSkyColor / getSeaColor 着色；并扩展了屏幕空间折射、
 *   深度吸收、焦散、岸边泡沫、SSR 反射等效果。
 *
 *   原版的「相机 / iMouse / RENDERSIZE / TIME」全部换成 Cesium 自动 uniform
 *   与本模块每帧写入的 uniform；水位变化只更新 uniform，不重建 shader。
 *
 * 焦散函数来源：
 *   Dave Hoskins, "Caustic" — https://www.shadertoy.com/view/MdlXz8
 *   (CC BY-NC-SA 3.0)
 *
 * 详细移植笔记 / 函数对照 / uniform 映射见 docs/shader-port.md。
 * ---------------------------------------------------------------------------
 */

/** Seascape 原作者的版权声明（会被注入到 shader 头部；构建产物里也保留） */
export const SEASCAPE_ATTRIBUTION = `
// "Seascape" by Alexander Alekseev aka TDM - 2014
// https://www.shadertoy.com/view/Ms2SD1
// License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported
// This is a CesiumJS PostProcessStage port for the flood-sim demo.
// Caustic function by Dave Hoskins (https://www.shadertoy.com/view/MdlXz8),
// CC BY-NC-SA 3.0.
`;

/**
 * 画质档位 → shader 宏 & 后处理纹理缩放。
 * textureScale 在 PostProcessStage 创建后只读，因此 setQuality 需要重建 stage。
 */
export const WATER_QUALITY = {
  high: {
    textureScale: 1.0,
    iterFragment: 5, // 原版 ITER_FRAGMENT
    ssr: 1, // 屏幕空间反射
    caustics: 1, // 焦散
    foam: 1, // 岸边泡沫
  },
  medium: {
    textureScale: 0.75,
    iterFragment: 3,
    ssr: 1,
    caustics: 1,
    foam: 1,
  },
  low: {
    textureScale: 0.5,
    iterFragment: 2,
    ssr: 0,
    caustics: 0,
    foam: 1,
  },
};

/**
 * Seascape 核心 GLSL（函数名与原作者保持一致）。
 * 后处理版与 Material 版共用这段代码，区别只在 main / czm_getMaterial。
 */
export const SEASCAPE_COMMON_GLSL = /* glsl */ `
// ===========================================================================
// Seascape (TDM) 原始算法函数 —— 函数名保持与原作者一致
// 原版依赖全局常量 SEA_* / SEA_TIME；这里全部改读 uniform，
// 方便 UI 实时调参（波高 / 速度 / 频率 / choppy）。
// ===========================================================================

const int   ITER_GEOMETRY = 3;      // 原版：几何层 octave 数（本项目不做 raymarch，仅用于浪高）
const float PI            = 3.1415926;

mat2 octave_m = mat2(1.6, 1.2, -1.2, 1.6);   // 原版 octave 旋转/缩放矩阵

// 原版：float SEA_TIME = TIME * SEA_SPEED;
float seaTime() {
    return u_time * u_waveSpeed;
}

// ---------- math ----------
float hash(vec2 p) {
    float h = dot(p, vec2(127.1, 311.7));
    return fract(sin(h) * 43758.5453123);
}

float noise(in vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return -1.0 + 2.0 * mix(
        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// ---------- sea ----------
// 原版 sea_octave：波形函数，输出 [0,1] 的尖峰状起伏
float sea_octave(vec2 uv, float choppy) {
    uv += noise(uv);
    vec2 wv  = 1.0 - abs(sin(uv));
    vec2 swv = abs(cos(uv));
    wv = mix(wv, swv, wv);
    return pow(1.0 - pow(wv.x * wv.y, 0.65), choppy);
}

// 原版 map()：低精度高度场 h(p.xz)，返回 p.y - h。
// 本项目不做 heightMapTracing（水面近似水平面，解析求交即可），
// 只保留它来计算浪高/泡沫/浪尖色。
float map(vec3 p) {
    float freq   = u_seaFreq;
    float amp    = u_waveHeight;
    float choppy = u_choppy;
    float t      = seaTime();
    vec2 uv = p.xz; uv.x *= 0.75;

    float d, h = 0.0;
    for (int i = 0; i < ITER_GEOMETRY; i++) {
        d  = sea_octave((uv + t) * freq, choppy);
        d += sea_octave((uv - t) * freq, choppy);
        h += d * amp;
        uv *= octave_m; freq *= 1.9; amp *= 0.22;
        choppy = mix(choppy, 1.0, 0.2);
    }
    return p.y - h;
}

// 原版 map_detailed()：法线用的高精度高度场（迭代次数由画质宏控制）。
// 移植版增加了「按像素足迹做 octave LOD」：当某一层的波长已经小于 2 个像素
// 的世界尺寸时直接 break。这是消除远处水面摩尔纹/同心圆的关键——否则高频
// octave 在像素间距下会产生规则化的拍频条纹（类似布料/雷达波纹）。
float map_detailed(vec3 p, float fpUnits) {
    float freq   = u_seaFreq;
    float amp    = u_waveHeight;
    float choppy = u_choppy;
    float t      = seaTime();
    vec2 uv = p.xz; uv.x *= 0.75;

    float d, h = 0.0;
    for (int i = 0; i < ITER_FRAGMENT; i++) {
        // 当前 octave 的波长（波场单位）；第 0 层（主涌浪）始终保留
        float waveLen = 6.28318 / max(freq, 1e-4);
        if (i > 0 && waveLen < 2.0 * fpUnits) break;
        d  = sea_octave((uv + t) * freq, choppy);
        d += sea_octave((uv - t) * freq, choppy);
        h += d * amp;
        uv *= octave_m; freq *= 1.9; amp *= 0.22;
        choppy = mix(choppy, 1.0, 0.2);
    }
    return p.y - h;
}

// 原版 getNormal：用 map_detailed 的有限差分求海浪法线。
// eps 单位 = 波场单位；后处理版按像素足迹动态计算 eps（远处自动变宽）。
vec3 getNormal(vec3 p, float eps) {
    vec3 n;
    n.y = map_detailed(p, eps);
    n.x = map_detailed(vec3(p.x + eps, p.y, p.z), eps) - n.y;
    n.z = map_detailed(vec3(p.x, p.y, p.z + eps), eps) - n.y;
    n.y = eps;
    return normalize(n);
}

// ---------- lighting ----------
// 原版 diffuse：用 0.4/0.6 抬底的兰伯特项，海水次表面感
float diffuse(vec3 n, vec3 l, float p) {
    return pow(dot(n, l) * 0.4 + 0.6, p);
}

// 原版 specular：Blinn-ish 高光，乘 nrm 归一化
float specular(vec3 n, vec3 l, vec3 e, float s) {
    float nrm = (s + 8.0) / (3.1415 * 8.0);
    return pow(max(dot(reflect(e, n), l), 0.0), s) * nrm;
}

// ---------- sky ----------
// 原版 getSkyColor 是「青蓝→橙黄」的解析黄昏渐变。本项目场景的天空由
// Lead 的自定义后处理（src/cesium/skyStage.js）绘制，这里把解析天空的
// 配色/分段函数与它严格对齐，保证：
//   1) 水面反射的天空与真实天空一致（SSR 采样失败时的兜底也一致）；
//   2) 远处水面雾化颜色 = 天空 haze 色，水天接缝不突兀。
// 色板：天顶 #16243a / 中段 #4a5f7c / 地平线 #d8a273 / 太阳 #ffd9a8 / 雾霭 #a9a49c
vec3 getSkyColor(vec3 e) {
    vec3 sd = sunDirENU();
    vec3 ed = normalize(e);
    const vec3 zenith  = vec3(0.086, 0.141, 0.227);  // #16243a
    const vec3 mid     = vec3(0.290, 0.373, 0.486);  // #4a5f7c
    const vec3 horizon = vec3(0.847, 0.635, 0.451);  // #d8a273
    const vec3 sunCol  = vec3(1.000, 0.851, 0.659);  // #ffd9a8
    const vec3 haze    = vec3(0.663, 0.643, 0.612);  // #a9a49c（远景雾霭）

    float up = max(ed.y, 0.0);
    vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, up));
    col = mix(col, zenith, smoothstep(0.16, 0.82, up));
    // 地平线以下 ← 雾霭（和 skyStage 的 u_ground 一致）
    col = mix(haze, col, smoothstep(-0.008, 0.012, ed.y));

    // 太阳辉光 + 日盘（与 skyStage 同一组幂次/权重）
    float mu = max(dot(ed, sd), 0.0);
    float glow = pow(mu, 8.0) * 0.35 + pow(mu, 48.0) * 0.55 + pow(mu, 512.0) * 0.9;
    col += sunCol * glow;
    col += sunCol * smoothstep(0.99955, 0.99985, mu) * 2.2;
    return col;
}

// ---------- 焦散 ----------
// 早期版本直接移植了 Dave Hoskins 的 "Caustic"（Shadertoy MdlXz8, CC BY-NC-SA 3.0）。
// 但它的图案来自 mod(uv*TAU, TAU) - 250 的"平铺"结构：在大面积浅水上斜视时，
// 平铺边界 + 内部高频会产生明显的摩尔纹/同心圆干涉（demo 实测非常明显）。
// 这里改成"两层域扭曲 noise 的零等值线"方案：无平铺接缝、频率连续、成本更低
// （原版每像素 4 次三角函数迭代 ×2，新方案 8 次 hash 级 noise，且不含 tiling）。
float causticWeb(vec2 p, float t) {
    // 用 Seascape 自己的 sea_octave 做焦散：它的 |sin|/|cos| 折叠本身是平滑的，
    // 没有 value-noise hash 那种「对角晶格方向性」；再叠两层不同尺度/流向即可
    // 得到自然的网状亮纹，而不会出现长直条纹（踩坑见 docs/shader-port.md §8.10）。
    float a = sea_octave(p * 0.55 + vec2(t * 0.30, -t * 0.19), 2.2);
    float b = sea_octave(p * 1.05 - vec2(t * 0.24, t * 0.27) + 13.7, 3.0);
    float c = a * b;
    return pow(clamp(c, 0.0, 1.0), 3.0);
}
`;

/**
 * 生成水面后处理 fragment shader。
 *
 * 与 Cesium 的约定（见 engine Source/Scene/PostProcessStage.js）：
 *  - colorTexture / depthTexture 由 Cesium 自动绑定，需自行声明 sampler2D；
 *  - v_textureCoordinates 是全屏 [0,1] UV；
 *  - post-process 会自动注入 LOG_DEPTH 宏（若场景开启对数深度，Cesium 默认开）；
 *  - czm_readDepth(depthTexture, uv) 内部会按 LOG_DEPTH 做反编码，返回 [0,1] 窗口深度；
 *  - czm_currentFrustum = (near, far)，czm_sunDirectionWC 等 automatic uniform
 *    只要在源码里以 czm_ 前缀出现就会被自动声明，不需要手写 declaration。
 *
 * @param {'high'|'medium'|'low'} quality
 * @returns {string} fragment shader 源码
 */
export function createWaterFragmentShader(quality = 'high') {
  const q = WATER_QUALITY[quality] ?? WATER_QUALITY.high;

  return /* glsl */ `
${SEASCAPE_ATTRIBUTION}

// ---------------------------------------------------------------------------
// 画质宏（由 JS 按档位注入；换档位会重建 stage，因为 textureScale 只读）
// ---------------------------------------------------------------------------
#define ITER_FRAGMENT ${q.iterFragment}
#define WATER_SSR    ${q.ssr}
#define WATER_CAUSTICS ${q.caustics}
#define WATER_FOAM   ${q.foam}

// Cesium 自动绑定
uniform sampler2D colorTexture;   // 场景颜色（上一阶段输出）
uniform sampler2D depthTexture;   // 场景深度（LOG_DEPTH 时是 log 深度）
in vec2 v_textureCoordinates;     // 全屏 UV

// ---------------------------------------------------------------------------
// 每帧相机 uniform —— 全部是 ENU 局部米坐标（原点 = 场景中心的地表点）
// JS 每帧用 viewer.camera 的逆视图矩阵换算，避免 shader 里做 ECEF 运算。
// ---------------------------------------------------------------------------
uniform vec3  u_camENU;       // 相机位置（ENU 米）
uniform vec3  u_eyeToENU0;    // eye 空间 +X 轴在 ENU 中的方向
uniform vec3  u_eyeToENU1;    // eye 空间 +Y 轴在 ENU 中的方向
uniform vec3  u_eyeToENU2;    // eye 空间 +Z 轴在 ENU 中的方向
uniform vec2  u_tanHalfFov;   // (tan(fovX/2), tan(fovY/2))，取自投影矩阵
uniform float u_pixelFootprint;// 每 stage 像素在 1 米处的世界尺寸（米/米）
uniform float u_time;         // 秒（demo 世界时间）
uniform vec2  u_texel;        // 1 / stage 纹理分辨率

// ---------------------------------------------------------------------------
// 场景常量（构造时设置一次）
// ---------------------------------------------------------------------------
uniform vec3  u_eastWC;       // ENU 基向量（世界空间）
uniform vec3  u_northWC;
uniform vec3  u_upWC;
uniform float u_earthRadius;  // 曲率修正用（米）

// ---------------------------------------------------------------------------
// 水体 / 波浪参数（UI 驱动，只改 uniform）
// ---------------------------------------------------------------------------
uniform float u_waterLevel;   // 水面海拔（米）
uniform float u_waveHeight;   // 原版 SEA_HEIGHT（波场单位；0.02~0.16）
uniform float u_waveSpeed;    // 原版 SEA_SPEED
uniform float u_seaFreq;      // 原版 SEA_FREQ
uniform float u_choppy;       // 原版 SEA_CHOPPY
uniform float u_waveUnit;     // 1 波场单位 = 多少米（默认 10）
uniform float u_ssr;          // SSR 开关（0/1，画质宏之外的运行时开关）
uniform float u_caustics;     // 焦散强度 0..1
uniform float u_foam;         // 泡沫强度 0..1
uniform float u_refraction;   // 折射强度 0..1
uniform vec3  u_absorb;       // 水体吸收系数（1/米，RGB 分别吸收）
uniform vec3  u_shallowColor; // 浅水散射色
uniform vec3  u_deepColor;    // 深水散射色
uniform vec3  u_scatterColor; // 次表面散射色
uniform vec3  u_foamColor;    // 泡沫颜色
uniform vec3  u_sunColor;     // 太阳直射色
uniform float u_debug;        // 调试模式（0=最终画面）
uniform float u_normalScale;  // 法线强度（0=完全平面，A/B 排查用；默认 1）
uniform float u_specScale;    // 高光强度缩放（0=关闭；默认 1）
uniform float u_motion;       // 相机运动强度 0..1（JS 每帧算；用于缩放/飞行时抑制反射与波光闪烁）

// 指向太阳的单位向量（ENU）。czm_sunDirectionWC 是 automatic uniform，
// 由 Cesium 根据 clock/scene.light 每帧更新，保证水面高光与真实光照一致。
// 注意：必须在 SEASCAPE_COMMON_GLSL 之前定义，因为移植版 getSkyColor 会调用它。
vec3 sunDirENU() {
    vec3 s = czm_sunDirectionWC;
    vec3 d = vec3(dot(s, u_eastWC), dot(s, u_northWC), dot(s, u_upWC));
    float l = length(d);
    return l > 1e-5 ? d / l : normalize(vec3(0.25, 0.55, 0.15));
}

${SEASCAPE_COMMON_GLSL}

// ===========================================================================
// 以下为水域相关的移植 / 扩展
// ===========================================================================

// 相机位置（ENU），与 u_camENU 一致；抽成函数只是为了可读性
vec3 camENU() { return u_camENU; }

// 射线 → 带曲率修正的水面「海拔 = level」交点距离（米）。
// 水面不是严格平面：海拔 z = level 的球面在 ENU 局部坐标下近似为
//     z = level - (x²+y²) / (2R)
// 用 3 次不动点迭代把平面交点修正到球面上，远处地平线自然收敛。
float waterSurfaceDistance(vec3 ori, vec3 dir, float level) {
    if (abs(dir.z) < 1e-6) return -1.0;
    float t = (level - ori.z) / dir.z;
    if (t <= 0.0) return -1.0;
    for (int i = 0; i < 3; i++) {
        vec3 p = ori + dir * t;
        float sag = dot(p.xy, p.xy) / (2.0 * u_earthRadius);
        float targetZ = level - sag;
        t = (targetZ - ori.z) / dir.z;
        if (t <= 0.0) return -1.0;
        // 接近地平线的掠射：球面「掉下去」比视线下降快，永远不会再相交
        if (t > 1.5e6) return -1.0;
    }
    return t;
}

// 由窗口深度（czm_readDepth 之后，[0,1]）反推该像素场景点相对相机的距离（米）。
// 透视投影： eyeZ = 2nf / (f + n - zNdc*(f - n))，再乘上归一化射线的长度系数。
float sceneDistanceAt(vec2 uv, out float winDepth) {
    winDepth = czm_readDepth(depthTexture, uv);
    if (winDepth > 0.999999) return 1.0e9;    // 天空 / 无几何
    float near = czm_currentFrustum.x;
    float far  = czm_currentFrustum.y;
    float zNdc = winDepth * 2.0 - 1.0;
    float eyeDepth = (2.0 * near * far) / (far + near - zNdc * (far - near));
    vec2 ndc = uv * 2.0 - 1.0;
    vec3 eyeDir = vec3(ndc.x * u_tanHalfFov.x, ndc.y * u_tanHalfFov.y, -1.0);
    return eyeDepth * length(eyeDir);
}

// 移植版 getSeaColor。
// 与原版差异：原版内部自己算 reflected（解析天空）与 refracted（水色），
// 这里改由调用方传入（屏幕空间 SSR 反射 / 折射采样结果），其余保持一致。
vec3 getSeaColor(vec3 p, vec3 n, vec3 l, vec3 eye, vec3 dist,
                 vec3 reflected, vec3 refracted) {
    // Seascape 原版 fresnel = pow(1 - dot(n,-eye), 3) * 0.65（反射被压得比较低）；
    // 本项目天色偏暗、海面需要明显的"镜面感 + 通亮感"，改用 Schlick 近似并提高
    // 基底反射：0.06 的基底让俯视时也带一点天空色，不至于是一块深色地面。
    float ndv = clamp(dot(n, -eye), 0.0, 1.0);
    float fresnel = 0.08 + 0.92 * pow(1.0 - ndv, 5.0);
    // 掠射角额外提亮：让远处海面强反射天空（与 skyStage 的天空严格同色）
    fresnel = mix(fresnel, 1.0, smoothstep(0.70, 0.97, 1.0 - ndv) * 0.50);

    vec3 color = mix(refracted, reflected, clamp(fresnel, 0.0, 1.0));

    // 天光环境补光：黄昏天空整体给水体一层冷色环境光，让深水呈清晰的蓝
    // （而不是近黑的墨绿）；这是"一眼看出是水"的关键项之一。
    vec3 skyUp = getSkyColor(vec3(0.0, 1.0, 0.0));
    vec3 skyLow = getSkyColor(normalize(vec3(0.35, 0.10, 1.0)));
    vec3 skyAmbient = mix(skyUp, skyLow, 0.45);
    color += skyAmbient * u_scatterColor * 1.10;
    color += u_shallowColor * 0.06;
    // 黄昏暖调偏移：把纯青蓝压一点，贴近"暖色天空下的冷色水体"
    color = mix(color, color * vec3(1.08, 0.985, 0.89) + vec3(0.010, 0.007, 0.003), 0.65);

    // 原版：float atten = max(1.0 - dot(dist,dist) * 0.001, 0.0);
    float atten = 1.0 / (1.0 + dot(dist, dist) * 0.0016);
    color += u_scatterColor * (p.y - u_waveHeight) * 0.18 * atten;

    // 太阳镜面高光（Seascape specular）；低角度黄昏下要更亮更集中。
    // 距离衰减：远处像素足迹变宽，锐利高光会变成高频噪点/闪烁，这里让它
    // 随距离快速变宽变弱（真实海面的太阳波光同样会被相机像素积分掉）。
    float tDist = dist.z * u_waveUnit;                 // 米
    float specFade = exp(-tDist * 0.00085);
    // 相机运动时压低锐利波光（避免缩放/飞行时高光在像素间跳动）
    float specMotion = 1.0 - 0.6 * clamp(u_motion, 0.0, 1.0);
    color += u_sunColor * specular(n, l, eye, 120.0) * 5.5 * specFade * u_specScale * specMotion;
    color += u_sunColor * specular(n, l, eye, 28.0) * 0.50 * (0.30 + 0.70 * specFade) * u_specScale * specMotion;
    return color;
}

void main() {
    vec2 uv = v_textureCoordinates;

    // 0) 原始场景颜色：陆地早退、水岸抗锯齿混合、折射采样都要用
    vec3 sceneColor = texture(colorTexture, uv).rgb;
    float rawDepth = texture(depthTexture, uv).r;   // LOG_DEPTH 下是 log 深度（调试用）

    // 0.5) 深度纹理专项调试（绕过早退，整屏输出；u_debug 90+）
    if (u_debug > 90.0) {
        vec3 dbg2;
        if (u_debug < 91.5) {
            dbg2 = czm_packDepth(rawDepth).rgb;                       // 后处理 depthTexture
        } else if (u_debug < 92.5) {
            dbg2 = vec3(czm_currentFrustum.y / 100000.0, czm_currentFrustum.x, 0.0);
        } else if (u_debug < 93.5) {
            dbg2 = czm_packDepth(czm_readDepth(depthTexture, uv)).rgb;  // 解码后的窗口深度
        } else if (u_debug < 94.5) {
            vec2 sz = vec2(textureSize(depthTexture, 0));
            dbg2 = vec3(sz.x / 4096.0, sz.y / 4096.0, 0.0);          // 深度纹理尺寸
        } else {
            // 96+ 在早退之前输出关键中间量（整屏可见，不受早退影响）
            float winD;
            float tS = sceneDistanceAt(uv, winD);
            vec2 ndc2 = uv * 2.0 - 1.0;
            vec3 eDir = vec3(ndc2.x * u_tanHalfFov.x, ndc2.y * u_tanHalfFov.y, -1.0);
            vec3 eDirN = normalize(eDir);
            vec3 dENU = normalize(u_eyeToENU0 * eDirN.x + u_eyeToENU1 * eDirN.y + u_eyeToENU2 * eDirN.z);
            float tW = waterSurfaceDistance(u_camENU, dENU, u_waterLevel);
            if (u_debug < 96.5) {
                dbg2 = czm_packDepth(min(tW / 100000.0, 1.0)).rgb;
            } else if (u_debug < 97.5) {
                dbg2 = czm_packDepth(min(tS / 100000.0, 1.0)).rgb;
            } else if (u_debug < 98.5) {
                dbg2 = czm_packDepth(u_waterLevel / 100.0).rgb;
            } else if (u_debug < 99.5) {
                dbg2 = czm_packDepth(clamp(u_camENU.z / 1000.0, 0.0, 1.0)).rgb;
            } else {
                dbg2 = czm_packDepth(clamp(dENU.z * 0.5 + 0.5, 0.0, 1.0)).rgb;
            }
        }
        out_FragColor = vec4(dbg2, 1.0);
        return;
    }

    // 1) 场景深度 → 场景距离（米）。天空像素给 1e9（但仍可被水面覆盖到地平线）
    float winDepth;
    float tScene = sceneDistanceAt(uv, winDepth);
    bool hasScene = tScene < 1.0e8;

    // 2) 屏幕射线（eye → ENU）
    vec2 ndc = uv * 2.0 - 1.0;
    vec3 eyeDir = vec3(ndc.x * u_tanHalfFov.x, ndc.y * u_tanHalfFov.y, -1.0);
    vec3 eyeDirN = normalize(eyeDir);
    vec3 dirENU = normalize(u_eyeToENU0 * eyeDirN.x +
                           u_eyeToENU1 * eyeDirN.y +
                           u_eyeToENU2 * eyeDirN.z);

    // 相机在水面以下 / 视线朝上（不可能打到水面）→ 直接返回场景色
    if (u_camENU.z <= u_waterLevel + 0.05 || dirENU.z >= -1e-4) {
        out_FragColor = vec4(sceneColor, 1.0);
        return;
    }

    // 3) 射线 × 水面（球面近似）解析求交
    float tWater = waterSurfaceDistance(u_camENU, dirENU, u_waterLevel);
    if (tWater <= 0.0) {
        out_FragColor = vec4(sceneColor, 1.0);
        return;
    }

    // 4) 早期剔除：水面在场景几何之后 → 陆地像素，立刻返回（不做任何噪声）。
    //    aa = 水线抗锯齿带宽（米），按像素足迹随距离缩放。
    float aa = clamp(tWater * u_pixelFootprint * 1.5, 0.02, 6.0);
    float gap = tScene - tWater;                 // >0: 水面在场景前方 → 水像素
    if (gap < -aa) {
        out_FragColor = vec4(sceneColor, 1.0);
        return;
    }
    float coverage = smoothstep(0.0, 1.0, (gap + aa) / (2.0 * aa));

    vec3 waterENU = u_camENU + dirENU * tWater;
    vec3 sceneENU = hasScene ? (u_camENU + dirENU * tScene) : waterENU;

    // -----------------------------------------------------------------------
    // 5) 波浪法线：把 ENU 米坐标换算到 Seascape 波场单位（1 单位 = u_waveUnit 米）
    //    水平方向 (x,y) → 波场 (x,z)，波场 y 轴 = 竖直高度。
    //    eps 用像素足迹换算，远处自动变宽 → 天然抗闪烁。
    // -----------------------------------------------------------------------
    vec3 pUnits = vec3(waterENU.x, 0.0, waterENU.y) / u_waveUnit;
    // eps 下限 0.02 波场单位（0.2m）：避免远处 octave 高频在像素足迹下变成噪点
    float epsUnits = clamp(tWater * u_pixelFootprint / u_waveUnit, 0.05, 0.7);
    vec3 nSea = getNormal(pUnits, epsUnits);       // nSea.y=up, nSea.x/z=东/北
    vec3 nENU = vec3(nSea.x, nSea.z, nSea.y);

    // 远处法线压平：高频细节在像素足迹下会产生噪点/闪烁
    float flatFade = smoothstep(600.0, 6000.0, tWater);
    nENU = normalize(mix(nENU, vec3(0.0, 0.0, 1.0), flatFade * 0.90));
    // 法线强度（调试/风格化用；1.0=正常，0=近似镜面平面）
    nENU = normalize(vec3(nENU.x * u_normalScale, nENU.y * u_normalScale, nENU.z));
    // 相机运动时进一步压平法线：减少高频波法线在缩放/飞行时的闪烁
    nENU = normalize(mix(nENU, vec3(0.0, 0.0, 1.0), clamp(u_motion, 0.0, 1.0) * 0.45));

    // 浪尖高度（波场单位，用于浪尖泡沫/次表面）
    float crest = -map(vec3(waterENU.x, 0.0, waterENU.y) / u_waveUnit);

    vec3 viewDirENU = normalize(waterENU - u_camENU);   // 相机 → 水面
    vec3 sunENU = sunDirENU();

    // -----------------------------------------------------------------------
    // 6) 反射：解析天空 + 屏幕空间反射（SSR，采样真实场景颜色，含 Cesium 天空）
    // -----------------------------------------------------------------------
    // 反射用"低通法线"：水面反射/SSR 采样的屏幕 UV 对波法线的高频分量极其敏感，
    // 若直接用 nENU，缩放/飞行时反射内容会在像素间抖动（shimmer）。
    // 这里把法线朝"上"收拢一部分（静止 45%、运动时最多 85%），反射更稳定；
    // 视觉上只是反射略"柔"，换来缩放时不闪。
    vec3 nReflENU = normalize(mix(nENU, vec3(0.0, 0.0, 1.0),
                                  0.45 + 0.40 * clamp(u_motion, 0.0, 1.0)));
    vec3 reflDirENU = reflect(viewDirENU, nReflENU);
    vec3 skyRefl = getSkyColor(reflDirENU);
    vec3 reflected = skyRefl;

#if WATER_SSR
    if (u_ssr > 0.5) {
        // 反射射线上取一个点，投回屏幕，采样 colorTexture（真实场景颜色，
        // 包含 Lead 的自定义黄昏天空 / 山体 / 建筑）。
        // 两个降权条件：
        //   a) 远距离水面（> 6km）：反射方向几乎贴着地平线，SSR 采样会落在
        //      地平线附近的地形条带上，产生"脏反射"；此时用解析天空更稳；
        //   b) 反射方向仰角 < ~9°：同理贴近地平线，解析天空（与 skyStage 同公式）
        //      本来就是准确值。
        float reflUp = max(reflDirENU.y, 0.0);
        float reflDist = clamp(tWater * 0.75 + 600.0, 600.0, 9000.0);
        vec3 reflENU = waterENU + reflDirENU * reflDist;
        vec3 d = reflENU - u_camENU;
        vec3 eyeD = vec3(dot(d, u_eyeToENU0), dot(d, u_eyeToENU1), dot(d, u_eyeToENU2));
        float zEye = -eyeD.z;
        if (zEye > 1.0) {
            vec2 ruv = vec2(eyeD.x / (u_tanHalfFov.x * zEye),
                            eyeD.y / (u_tanHalfFov.y * zEye)) * 0.5 + 0.5;
            vec2 edge = min(ruv, 1.0 - ruv);
            float edgeFade = smoothstep(0.0, 0.05, min(edge.x, edge.y));
            float ssrWeight = edgeFade * 0.92
                            * smoothstep(0.03, 0.16, reflUp)
                            * (1.0 - smoothstep(6000.0, 12000.0, tWater))
                            * (1.0 - 0.75 * clamp(u_motion, 0.0, 1.0));
            if (ssrWeight > 0.001 && ruv.x > 0.0 && ruv.y > 0.0 && ruv.x < 1.0 && ruv.y < 1.0) {
                // 遮挡测试：反射点前方不能有更近的场景几何
                float occluder = sceneDistanceAt(ruv, winDepth);
                float reflCamDist = length(d);
                if (occluder > reflCamDist * 0.995) {
                    vec3 ssrColor = texture(colorTexture, ruv).rgb;
                    reflected = mix(skyRefl, ssrColor, ssrWeight);
                }
            }
        }
    }
#endif

    // 黄昏海面的"暖色镜面"艺术处理：把反射压向金色/暖白（比纯物理反射更贴合
    // demo 需要的金色黄昏观感），同时保留 SSR 采样到的真实天空/山体结构。
    reflected = mix(reflected, reflected * vec3(1.18, 0.98, 0.80), 0.65);
    reflected += u_sunColor * 0.02;

    // -----------------------------------------------------------------------
    // 7) 折射 / 水下：屏幕空间折射偏移 + 深度吸收 + 焦散
    // -----------------------------------------------------------------------
    float pathLen = hasScene ? max(tScene - tWater, 0.0) : 200.0;   // 视线在水中的长度（米）
    float depthBelow = hasScene ? max(u_waterLevel - sceneENU.z, 0.0) : 200.0;

    // 折射偏移：水面法线扰动屏幕采样 UV。浅水处偏移更大（水下地形畸变更明显）
    vec2 refrUV = uv;
    {
        float shallowAmt = 1.0 / (1.0 + depthBelow * 0.7);
        vec2 offs = nENU.xy * u_refraction * u_texel * (4.0 + 10.0 * shallowAmt);
        float maxOffs = 9.0 * length(u_texel);
        float len = length(offs);
        if (len > maxOffs) offs *= maxOffs / len;
        refrUV = clamp(uv + offs, vec2(0.001), vec2(0.999));
    }
    vec3 under = hasScene ? texture(colorTexture, refrUV).rgb : u_deepColor;

    // 光学路径：直接用「垂直水深」做主吸收（比视线长度更符合观感：
    // 浅滩无论从多掠的角度看都能透出地面，深水则快速变暗）。
    float opticalPath = clamp(depthBelow * 2.0 + 1.0, 0.0, 160.0);

#if WATER_CAUSTICS
    {
        // 焦散只出现在浅水底部、且只在**近距离**可见：
        //   - 远处像素足迹 >> 焦散特征尺寸，任何规则图案都会退化成摩尔纹；
        //   - demo 的村庄 8m/全景视角下，焦散本来就应该几乎看不见，
        //     真正需要它的近岸特写（< 400m）才渲染。
        // 另外用一层低频噪声给焦散"打补丁"，避免规则网格感。
        float caustMask = exp(-depthBelow * 0.26)
                        * (1.0 - smoothstep(6.0, 32.0, pathLen))
                        * (1.0 - smoothstep(60.0, 220.0, tWater));
        float caust = causticWeb(sceneENU.xz * 0.85, u_time * 0.55);
        caust += 0.40 * causticWeb(sceneENU.xz * 1.35 + 31.7, u_time * 0.37);
        float patchy = 0.60 + 0.40 * noise(sceneENU.xz * 0.045 + vec2(u_time * 0.07, -u_time * 0.05));
        under += vec3(1.0, 0.93, 0.78) * caust * caustMask * u_caustics * patchy * 0.55;
    }
#endif

    // 水体吸收（Beer-Lambert）：红光衰减最快，浅水透出暖色地面，深水转青蓝
    vec3 transmittance = exp(-u_absorb * opticalPath);
    float scatter = 1.0 - exp(-depthBelow * 0.20);
    vec3 refracted = under * transmittance + u_deepColor * scatter;

    // 水体本身的环境亮度（不完全依赖天空反射/阳光）：即使黄昏逆光，
    // 深水也保持"海蓝"而不是近黑，远看能一眼认出是水。
    refracted += u_deepColor * 0.38 + u_scatterColor * 0.10;

    // 浅水散射色：让岸边水体偏青绿（能透出水底泥沙/地面）
    refracted += u_shallowColor * (1.0 - smoothstep(0.0, 4.5, depthBelow)) * 0.09;

    // -----------------------------------------------------------------------
    // 8) 水面着色（Seascape getSeaColor + 本项目扩展）
    // -----------------------------------------------------------------------
    vec3 pColor = vec3(waterENU.x, u_waveHeight + crest, waterENU.y) / u_waveUnit;
    vec3 distUnits = vec3(0.0, 0.0, tWater / u_waveUnit);
    vec3 color = getSeaColor(pColor, nENU, sunENU, viewDirENU, distUnits, reflected, refracted);

    // 水体底色：让深水有稳定的青蓝基调（反射/高光之外的部分）
    color = mix(color, mix(color, u_deepColor, 0.22), 1.0 - smoothstep(0.0, 300.0, tWater));

#if WATER_FOAM
    {
        // 岸边泡沫：只保留「水线附近 + 极浅滩」的窄带，并且**随距离快速淡出**。
        //
        // 踩坑记录：早期把 foam 铺满整片水深<1.4m 的浅滩（8m 水位时是整片村庄），
        // 噪声频率 ~0.45/m、0.75m 特征在远处像素足迹下严重欠采样，会变成大片
        // 规则斜纹/同心圆的摩尔纹（demo 里像"雷达波纹"）。现在：
        //   1) 泡沫带只出现水深 < 0.8m 的极浅滩 + 水线附近；
        //   2) 噪声频率降下来（特征 ~5m / 2m），并加噪声门限；
        //   3) 距离 > 1.2km 完全关闭（任何高频图案在远处都会 alias）。
        vec2 foamPos = hasScene ? sceneENU.xz : waterENU.xz;
        float shoreFade = 1.0 - smoothstep(0.03, 0.55, depthBelow);
        float surfEdge = 1.0 - smoothstep(0.0, max(aa * 1.35, 0.8), gap);
        float fn = 0.60 * noise(foamPos * 0.18 + vec2(u_time * 0.22, -u_time * 0.15))
                 + 0.40 * noise(foamPos * 0.42 - vec2(u_time * 0.3, u_time * 0.11));
        float n01 = 0.5 + 0.5 * fn;                 // 0..1
        float gate = smoothstep(0.40, 0.78, n01);
        float foamFade = 1.0 - smoothstep(400.0, 1400.0, tWater);
        float foamAmt = clamp((shoreFade * 0.35 + surfEdge * 1.0) * gate *
                              (0.45 + 0.55 * n01) * u_foam * foamFade, 0.0, 0.92);
        foamAmt *= coverage;
        vec3 foamLit = u_foamColor * (0.90 + 0.20 * max(sunENU.y, 0.0));
        color = mix(color, foamLit, foamAmt);
    }
#endif

    // -----------------------------------------------------------------------
    // 9) 远处雾化：海天线与水天一色，避免出现硬边
    // -----------------------------------------------------------------------
    {
        // 与 Lead 的 Globe Material 远景雾霭对齐：
        //   haze ≈ mix(#a9a49c, #cbb39f, 0.45)，随距离 5km → 30km 渐入，
        //   避免水面与天空/远山之间出现硬边界。
        vec3 haze = vec3(0.723, 0.670, 0.617);
        float fogAmt = smoothstep(9000.0, 40000.0, tWater) * 0.72;
        color = mix(color, haze, fogAmt);
    }

    // -----------------------------------------------------------------------
    // 10) 调试可视化（Playwright 截图排查用；u_debug=0 时零开销）
    // -----------------------------------------------------------------------
    if (u_debug > 0.5) {
        vec3 dbg = vec3(0.0);
        if (u_debug < 1.5) {
            dbg = vec3(winDepth);                                  // 窗口深度
        } else if (u_debug < 2.5) {
            dbg = vec3(fract(tWater / 1000.0), 0.2, 0.0);          // 水面距离
        } else if (u_debug < 3.5) {
            float z = sceneENU.z;                                  // 场景高度（绿:0~9m 红:>60m）
            dbg = vec3(clamp(z / 60.0, 0.0, 1.0),
                      clamp(z / 9.0, 0.0, 1.0),
                      hasScene ? 0.35 : 0.0);
        } else if (u_debug < 4.5) {
            dbg = hasScene ? vec3(0.35) : vec3(0.0, 0.15, 0.5);     // 水像素红 / 陆地灰 / 天空蓝
            if (gap > 0.0) dbg = vec3(1.0, 0.1, 0.1);
        } else if (u_debug < 5.5) {
            dbg = nENU * 0.5 + 0.5;                                // 波浪法线
        } else if (u_debug < 6.5) {
            dbg = vec3(tScene < 1.0e8 ? fract(tScene / 200.0) : 0.0,
                       tScene < 1.0e8 ? fract(tScene / 2000.0) : 0.0, 0.0); // 场景距离
        } else if (u_debug < 7.5) {
            dbg = vec3(rawDepth, winDepth, hasScene ? 1.0 : 0.0);  // 原始/解码深度 + 是否有几何
        } else if (u_debug < 8.5) {
            dbg = vec3(tScene / 20000.0, tWater / 20000.0, 0.0);   // 场景距离 vs 水面距离（20km 归一）
        } else if (u_debug < 9.5) {
            dbg = vec3(clamp((sceneENU.z + 50.0) / 250.0, 0.0, 1.0),
                       clamp((sceneENU.z + 5.0) / 15.0, 0.0, 1.0),
                       hasScene ? 1.0 : 0.0);                     // 场景点 ENU 高度
        } else if (u_debug < 10.5) {
            dbg = vec3(log2(czm_currentFrustum.x + 1.0) / 32.0,
                       log2(czm_currentFrustum.y + 1.0) / 40.0, 0.0);  // 当前 frustum near/far
        } else if (u_debug < 11.5) {
            vec4 dt = texture(depthTexture, uv);
            dbg = dt.rgb;                                             // 深度纹理 RGB 原始值
        } else if (u_debug < 12.5) {
            dbg = czm_packDepth(rawDepth).rgb;                        // 原始深度（RGBA 打包，高精度）
        } else if (u_debug < 13.5) {
            dbg = czm_packDepth(winDepth).rgb;                        // 解码后窗口深度（高精度）
        } else if (u_debug < 14.5) {
            dbg = czm_packDepth(tScene / 100000.0).rgb;               // 场景距离（高精度，×100000）
        } else if (u_debug < 15.5) {
            dbg = czm_packDepth(tWater / 100000.0).rgb;               // 水面距离（高精度）
        } else if (u_debug < 16.5) {
            dbg = czm_packDepth(czm_readDepth(depthTexture, uv)).rgb;  // czm_readDepth 单独调用
        } else if (u_debug < 17.5) {
            float n = czm_currentFrustum.x;
            dbg = czm_packDepth(clamp(n, 0.0, 0.01) / 0.01).rgb;       // near（截断到 0.01）
        } else if (u_debug < 18.5) {
            float f = czm_currentFrustum.y;
            dbg = czm_packDepth(f / 1000000.0).rgb;                    // far（×1e6）
        } else if (u_debug < 19.5) {
            float l2 = czm_log2FarDepthFromNearPlusOne;
            dbg = czm_packDepth(l2 / 40.0).rgb;                        // log2(far-near+1)（×40）
        } else if (u_debug < 20.5) {
            float raw = texture(depthTexture, uv).r;
            float d = exp2(raw * czm_log2FarDepthFromNearPlusOne) - 1.0 + czm_currentFrustum.x;
            dbg = czm_packDepth(min(d / 100000.0, 1.0)).rgb;            // 自解码 eyeDepth（×1e5）
        } else {
            dbg = vec3(coverage, 0.0, 1.0 - coverage);             // 水线 coverage
        }
        out_FragColor = vec4(dbg, 1.0);
        return;
    }

    // -----------------------------------------------------------------------
    // 11) 输出：与原始场景在水线处做 coverage 混合（抗锯齿）
    // -----------------------------------------------------------------------
    out_FragColor = vec4(mix(sceneColor, color, coverage), 1.0);
}
`;
}
