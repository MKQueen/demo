# ShaderToy Ms2SD1 (Seascape) → CesiumJS 水面移植文档

> 本文档对应 `apps/flood-sim` 的「潮线 TIDELINE · 3D 动态水淹模拟」水面模块。
> 代码位置：`src/water/waterPostProcess.glsl.js`（post-process shader 字符串）、
> `src/water/WaterRenderer.js`（渲染器 / Cesium 集成）、`src/water/waterMaterial.js`（Material 兼容版）。
>
> **算法来源（必须保留署名）**
> - "Seascape" by Alexander Alekseev aka TDM — 2014，<https://www.shadertoy.com/view/Ms2SD1>
>   License: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported
>   (CC BY-NC-SA 3.0)
> - 焦散函数：Dave Hoskins, "Caustic" — <https://www.shadertoy.com/view/MdlXz8>
>   (CC BY-NC-SA 3.0)
>
> 本项目是 **非商业 demo**，按 CC BY-NC-SA 3.0 要求保留署名并以相同协议分享 shader 部分。

---

## 1. 原始 shader 分析（Seascape / Ms2SD1）

原始 Seascape 是**纯屏幕空间 raymarch**：数学上没有"水面几何"，整屏每个像素都从
相机原点出发，沿屏幕射线用 `heightMapTracing()` 二分求交一个程序化浪高场
`map()`，再对交点取法线、算反射/折射/高光，最后与解析天空 `getSkyColor()`
按 `dir.y` 混合。

| 原始组成部分 | 作用 | 原实现 |
| --- | --- | --- |
| `hash` / `noise` | 2D value noise（正弦 hash + 双线性 smoothstep） | 屏幕空间 |
| `sea_octave` | 单层波形：`uv += noise(uv)` 后取 `1-|sin|` 与 `|cos|` 混合再 `pow(...,choppy)` | 屏幕空间 |
| `map(p)` | 3 层 octave 的浪高场，返回 `p.y - h` | 相机在 `(0,3.5,time*5)` 移动 |
| `map_detailed(p)` | 5 层 octave（法线用高精度版本） | 同上 |
| `getNormal(p, eps)` | 有限差分求浪面法线 | `eps = dist² / 屏幕宽` |
| `heightMapTracing(ori,dir,p)` | 8 次二分求射线-浪面交点 | 需要 raymarch |
| `diffuse` / `specular` | 0.4/0.6 抬底兰伯特 + Blinn 高光 | 解析光照 |
| `getSkyColor(e)` | 方向 → 黄昏渐变色 | 纯解析 |
| `getSeaColor(p,n,l,eye,dist)` | 菲涅尔混合反射/折射 + 距离衰减 + 高光 | 解析 |
| `main()` | 相机射线、raymarch、混合天空 | iMouse/TIME/RENDERSIZE |
| `SEA_FREQ/CHOPPY/HEIGHT/SPEED/BASE/WATER_COLOR` | 波浪常量 | 编译期常量 |

**关键判断**：demo 的水面是「海拔 = `waterLevel` 的近似水平面」，不是无穷起伏的
海面。若照搬 raymarch，每像素要做 8 次 `map()`（每次 3 octave × 2 × noise ≈ 48 次
hash），1600×1000 下代价过高，而且水面高度还要随 UI 实时变化。因此移植时做了
**架构级替换**：

- 用「屏幕像素 → 场景深度重建 → 世界射线 → 与曲面水位解析求交」取代 raymarch；
- Seascape 的 `map/map_detailed/getNormal/getSeaColor/...` 只保留 **着色用途**；
- `heightMapTracing` 被 `waterSurfaceDistance()` 取代（见 §3）。

---

## 2. 函数对照表

| Seascape 原函数 | 移植后 | 说明 |
| --- | --- | --- |
| `hash`, `noise` | 同名，原样保留 | `SEASCAPE_COMMON_GLSL` 导出，post-process 与 Material 两版共用 |
| `sea_octave` | 同名 | 原样（`choppy` 改为 uniform） |
| `map(p)` | 同名 | 保留 3 层 octave；只用于浪高 `crest`（`ITER_GEOMETRY=3`） |
| `map_detailed(p)` | 同名 | 迭代数改为画质宏 `ITER_FRAGMENT`（高 5 / 中 3 / 低 2） |
| `getNormal(p,eps)` | 同名 | `eps` 改为「按像素足迹 + 距离」动态计算（§4.4） |
| `diffuse`, `specular` | 同名 | 原样；高光强度在 `getSeaColor` 里按黄昏场景放大 |
| `getSkyColor(e)` | 同名，**重写配色** | 与 Lead 的 `skyStage.js` 色板/分段严格对齐（§6） |
| `getSeaColor(...)` | 同名，**签名扩展** | `reflected/refracted` 由屏幕空间采样结果传入（原版内部解析计算） |
| `heightMapTracing` | **删除** → `waterSurfaceDistance` | 平面 + 球面曲率修正的解析求交（§3.2） |
| `main()` | 重写 | 深度重建、早退、折射/焦散/泡沫、雾化、调试分支 |

---

## 3. 屏幕空间适配（核心）

### 3.1 每像素输入

Cesium `PostProcessStage` 自动提供：

| GLSL 名字 | 来源 | 说明 |
| --- | --- | --- |
| `colorTexture` | stage 输入颜色纹理 | 上一后处理 stage 的输出（本项目先跑天空 stage） |
| `depthTexture` | 场景深度纹理 | WebGL2 下是 `DEPTH24_STENCIL8`，用 `.r` 采样 |
| `v_textureCoordinates` | 全屏 quad 的 [0,1] UV | 与纹理一一对应 |
| `czm_readDepth(depthTexture, uv)` | Cesium builtin | `LOG_DEPTH` 时自动做反 log 编码，返回 **窗口深度** |
| `czm_currentFrustum` | 自动 uniform | 当前渲染 frustum 的 `(near, far)`（注意：可能是 multi-frustum 的某一档） |
| `czm_sunDirectionWC` | 自动 uniform | 指向太阳的世界方向（由 scene clock 驱动） |
| `gl_FragCoord` | 内建 | stage 输出的像素坐标（受 `textureScale` 影响） |

> ⚠️ Post-process 的 `depthTexture` 语义：**原始深度**是 log 编码的（场景默认开
> 对数深度），而 `czm_readDepth()` 已经把它转成常规窗口深度 [0,1]。二选一，不能
> 混用：本项目用 `czm_readDepth` + 自己反投影，这样与 `LOG_DEPTH` 是否开启无关。

### 3.2 深度 → 场景距离（`sceneDistanceAt`）

```glsl
float sceneDistanceAt(vec2 uv, out float winDepth) {
    winDepth = czm_readDepth(depthTexture, uv);
    if (winDepth > 0.999999) return 1.0e9;              // 天空
    float near = czm_currentFrustum.x, far = czm_currentFrustum.y;
    float zNdc = winDepth * 2.0 - 1.0;
    // 透视投影反解 eye-space 深度（沿 -z 轴的距离）
    float eyeDepth = (2.0 * near * far) / (far + near - zNdc * (far - near));
    vec2 ndc = uv * 2.0 - 1.0;
    vec3 eyeDir = vec3(ndc.x * u_tanHalfFov.x, ndc.y * u_tanHalfFov.y, -1.0);
    return eyeDepth * length(eyeDir);                   // 沿射线长度（米）
}
```

- `u_tanHalfFov` 由 JS 从投影矩阵取：`tanX = 1/P00`、`tanY = 1/P11`。
- 相机位置与相机朝向**不在这里算**：JS 每帧把 `u_camENU`、`u_eyeToENU0/1/2`
  传进来（eye 空间三轴在 ENU 中的方向），shader 里只做一次 mat3 变换即可得到
  ENU 方向，避免在 GLSL 里处理 ECEF 大数精度。
- 如果 `czm_currentFrustum` 与写入深度时的 frustum 不一致（极端情况），重建会
  整体偏移——本项目在 Lead 的 floodApp 里验证过：`tScene` 与 `scene.globe.pick`
  的距离误差 < 0.5%，可直接使用。

### 3.3 水面求交（`waterSurfaceDistance`）

水面是「海拔 = `waterLevel` 的球面」，在 ENU 局部坐标（原点 = 场景中心地表点）
下近似为：

```
z(x,y) = waterLevel - (x² + y²) / (2R)        R ≈ 6 371 000 m
```

（推导：ECEF 中 `|center + x·E + y·N + z·U| ≈ R + z + (x²+y²)/(2R)`，令其等于
`R + waterLevel` 即得。）

求交用 3 次不动点迭代（先与平面求交，再用命中点的水平距离修正 sag）：

```glsl
float t = (level - ori.z) / dir.z;
for (int i = 0; i < 3; i++) {
    vec3 p = ori + dir * t;
    float sag = dot(p.xy, p.xy) / (2.0 * u_earthRadius);
    t = (level - sag - ori.z) / dir.z;
    if (t <= 0.0 || t > 1.5e6) return -1.0;   // 背向 / 掠射到地平线之外
}
```

效果：近处与平面几乎一致；远处水面随地球曲率"掉下去"，**地平线自然收敛**，
不出现无限远的水面（这与 Cesium 的 globe 地平线一致）。

### 3.4 水面像素判定与早退

```glsl
float gap = tScene - tWater;                     // >0 表示水面在场景之前
float aa  = clamp(tWater * u_pixelFootprint * 1.5, 0.02, 6.0);  // 水线抗锯齿带宽（米）
if (gap < -aa) { out_FragColor = vec4(sceneColor, 1.0); return; }  // 陆地：立刻返回
float coverage = smoothstep(0.0, 1.0, (gap + aa) / (2.0 * aa));
```

- **非水面像素只做「1 次深度采样 + 反投影 + 一次求交」**，不进入噪声/反射/折射，
  这是本项目能跑满帧的关键（见 §7）。
- 水线与陆地交界用 `coverage` 混合，配合 `gap` 的米制带宽，远处也能拿到
  1~2px 的软边，避免锯齿。
- 天空像素（`winDepth >= 1`）不跳过：水面可以延伸到地平线，此时 `tScene = 1e9`。

### 3.5 世界 → 波场坐标

水面交点 `waterENU` 的 `(x, y)` 是 ENU 米；波场（Seascape 的 `p.xz`）使用
「1 单位 = 10 m」：

```glsl
vec3 pUnits = vec3(waterENU.x, 0.0, waterENU.y) / u_waveUnit;  // u_waveUnit = 10
```

`u_seaFreq = 0.52 - 0.16*intensity`（波长约 100~400m 的涌浪 + 各 octave 细节），
实际浪高由 `u_waveHeight = 0.04 + 0.115*intensity` 波场单位 = **0.4~1.5 m**（v3 提亮时略加大，让水面特征更可读）。

### 3.6 法线细节抗闪烁

```glsl
float epsUnits = clamp(tWater * u_pixelFootprint / u_waveUnit, 0.05, 0.7);
vec3 nSea = getNormal(pUnits, epsUnits);
float flatFade = smoothstep(600.0, 6000.0, tWater);
nENU = normalize(mix(nENU, vec3(0,0,1), flatFade * 0.90));
```

- `eps` 随距离增长：远处高频 octave 的差分被"模糊"掉，不会在像素间闪烁；
- 600m 之后法线逐渐压平到正上方（最多 90%），远处水面变得安静，符合真实海面观感。

---

## 4. 扩展效果（本项目新增）

### 4.1 屏幕空间反射（SSR）

```glsl
vec3 reflDir = reflect(viewDirENU, nENU);                 // ENU
vec3 reflENU = waterENU + reflDir * reflDist;             // 反射射线上取点
// ENU → eye → 投影回屏幕（eyeToENU 正交，用转置变换）
vec3 eyeD = vec3(dot(d,u_eyeToENU0), dot(d,u_eyeToENU1), dot(d,u_eyeToENU2));
vec2 ruv = vec2(eyeD.x/(tanX*zEye), eyeD.y/(tanY*zEye)) * 0.5 + 0.5;
vec3 ssrColor = texture(colorTexture, ruv).rgb;           // 真实天空/山体/建筑
```

- **遮挡测试**：采样 `ruv` 处的场景距离 `occluder`，只有
  `occluder > 反射点相机距离` 才认为反射点可见（否则回退解析天空）。
- **两个降权**（避免"脏反射"，见 §8 踩坑）：
  - 远距离水面（`tWater > 6~12km`）：反射射线几乎贴地平线，SSR 会采到地平线附近
    的地形条带 → 改用解析天空；
  - 反射仰角 < ~9°：同样贴地平线，解析天空本来就是准确值。
- 反射方向用**低通法线**（`nENU` 向正上方收拢 45%，相机运动时最多 85%），
  避免高频波法线让反射采样 UV 抖动（缩放/飞行时的 shimmer，见 §8.11）。
- 菲涅尔（v3 提亮）：`fresnel = 0.08 + 0.92·pow(1-ndv,5)`，掠射再向 1.0 混 50%。
  基底反射从 0.025 提到 0.08 → 俯视也有天空色，是"一眼看出是水"的关键之一。
- 本项目**天空 stage 在水面 stage 之前执行**，所以 `colorTexture` 里已经是
  Lead 的自定义黄昏天空，SSR 采样到的天空与画面完全一致。

### 4.2 折射 + 深度吸收

```glsl
float depthBelow = hasScene ? max(u_waterLevel - sceneENU.z, 0.0) : 200.0;
float opticalPath = clamp(depthBelow * 2.0 + 1.0, 0.0, 160.0);   // 垂直水深为主
vec3 transmittance = exp(-u_absorb * opticalPath);               // 红光先衰减
vec3 refracted = under * transmittance + u_deepColor * scatter;
// v3 提亮：不再完全依赖天空反射/阳光，水体本身有一层环境亮度
refracted += u_deepColor * 0.38 + u_scatterColor * 0.10;
refracted += u_shallowColor * (1.0 - smoothstep(0.0, 4.5, depthBelow)) * 0.09;
```

- 折射：用波面法线扰动屏幕 UV 采样 `colorTexture`，浅水处偏移更大
  （`nENU.xy * (7 + 22/(1+depthBelow*0.55)) * u_texel`，上限 18 像素）。
- 吸收用**垂直水深**而不是视线长度：这样"浅滩无论从多掠的视角看都能透出地面"，
  深水快速变成青蓝，符合 demo 的"淹没感"需求（纯物理的视线长度在掠射角下会让
  整片浅滩都变黑）。
- 参数（v3 提亮后）：`u_absorb = (0.18, 0.055, 0.034) /m`（原 0.26/0.075/0.046 太强，
  深水发黑），`u_deepColor = (0.028,0.105,0.175)`，`u_shallowColor = (0.05,0.235,0.29)`，
  `u_scatterColor = (0.075,0.25,0.30)`。
- 天光环境补光：`skyAmbient = mix(getSkyColor(up), getSkyColor(掠射), 0.45)`，
  `color += skyAmbient * u_scatterColor * 1.10`；最后再叠一点黄昏暖色偏移
  `mix(color, color*vec3(1.08,0.985,0.89), 0.65)`，让"冷色水体 + 暖色天光"协调。
- 实测水面像素（overview 15m 水面区域均值）：提亮前 **RGB(41,67,79)**（近黑蓝），
  提亮后 **RGB(71,120,131)**（清晰青蓝）；同时陆地像素几乎不变（(103,106,90)），
  水面-陆地亮度/色相区分明显。

### 4.3 焦散（v2 起改为自研 `causticWeb`，近景限定）

早期移植了 Dave Hoskins 的 `caustic`（Shadertoy MdlXz8, CC BY-NC-SA 3.0），但它的
`mod(uv*TAU, TAU) - 250` 平铺结构在大面积浅水斜视时会产生明显摩尔纹/同心圆，
已替换为两层 `sea_octave` 相乘的 `causticWeb`（原因与 A/B 见 §8.10），并只保留在
**近景 < 220m**：

```glsl
float caust = causticWeb(sceneENU.xz * 0.85, u_time * 0.37);
caust += 0.40 * causticWeb(sceneENU.xz * 1.35 + 31.7, u_time * 0.31);
float nearFade = 1.0 - smoothstep(60.0, 220.0, tWater);
float caustMask = exp(-depthBelow * 0.26) * (1.0 - smoothstep(6.0, 32.0, pathLen)) * nearFade;
under += vec3(1.0, 0.93, 0.78) * caust * caustMask * u_caustics * patchy * 0.55;
```

- 以「场景点 ENU 坐标」为 UV 投影到浅水水底（`sceneENU` 是深度重建出来的水下地形位置）。
- `patchy = 0.60 + 0.40*noise(...)` 让焦散成片而不是均匀铺满。
- 远处像素足迹 >> 焦散特征尺寸，必然摩尔纹，所以只在 < 220m 出现。

### 4.4 岸边泡沫

```glsl
float shoreFade = 1.0 - smoothstep(0.03, 0.55, depthBelow);        // 浅滩（v3 收窄，避免整片白噪点）
float surfEdge  = 1.0 - smoothstep(0.0, max(aa*1.15, 0.55), gap); // 水线
float n01 = 0.5 + 0.5 * (两层流动噪声);
float gate = smoothstep(0.40, 0.78, n01);                          // 打碎成团
float foamFade = 1.0 - smoothstep(400.0, 1400.0, tWater);          // 远处泡沫淡化
foam = clamp((shoreFade*0.35 + surfEdge*1.0) * gate * (0.45+0.55*n01) * u_foam * foamFade, 0, 0.92);
```

- 两层不同频率/流向的 noise 相加，再用**阈值门限**把连续白带打碎成翻卷的泡沫团；
- `foamAmt *= coverage` 让泡沫只出现在水线内侧，不会溢到岸上。

### 4.5 黄昏天空对齐（与 `src/cesium/skyStage.js` 同色板）

```glsl
zenith  = #16243a (0.086,0.141,0.227)
mid     = #4a5f7c (0.290,0.373,0.486)
horizon = #d8a273 (0.847,0.635,0.451)
sun     = #ffd9a8 (1.000,0.851,0.659)
haze    = #a9a49c (0.663,0.643,0.612)
```

- `getSkyColor()` 的分段/幂次与 skyStage 完全一致（含太阳辉光/日盘）；
- 远处水面雾化到 `mix(#a9a49c, #cbb39f, 0.45) ≈ (0.723,0.670,0.617)`，
  随 `tWater` 8km→36km 渐入，与 Globe Material 的远景雾霭衔接；
- 反射颜色额外做了一点"暖色镜面"艺术偏置（`* (1.18,0.98,0.80)`），
  让黄昏海面有金色感。

---

## 5. Uniform 映射表

### 5.1 原始 Seascape → 移植版

| 原始 | 移植后 | 类型 | 写入频率 | 说明 |
| --- | --- | --- | --- | --- |
| `TIME` | `u_time` | float | 每帧 | demo 时间（秒） |
| `iMouse` | — | — | — | 相机由 Cesium 控制，不需要鼠标 |
| `RENDERSIZE` | `u_texel` / `u_pixelFootprint` | vec2 / float | 每帧（resize 时变） | stage 纹理分辨率、每像素世界角尺寸 |
| 相机 | `u_camENU` + `u_eyeToENU0/1/2` + `u_tanHalfFov` | vec3×4 / vec2 | 每帧 | JS 由 `camera.positionWC` / `inverseViewMatrix` / `projectionMatrix` 换算 |
| `SEA_FREQ` | `u_seaFreq` | float | UI 变化时 | 0.52 - 0.16×intensity |
| `SEA_CHOPPY` | `u_choppy` | float | UI 变化时 | 3.2 + 1.6×intensity |
| `SEA_HEIGHT` | `u_waveHeight` | float | UI 变化时 | 0.04 + 0.115×intensity（波场单位） |
| `SEA_SPEED` | `u_waveSpeed` | float | UI 变化时 | 0.30 + 0.85×speed |
| `SEA_BASE` | `u_deepColor` | vec3 | 固定 | 深水底色 |
| `SEA_WATER_COLOR` | `u_scatterColor` / `u_shallowColor` | vec3 | 固定 | 次表面散射 / 浅水色 |
| — | `u_waterLevel` | float | UI 变化时 | 水位海拔（米） |
| — | `u_waveUnit` | float | 固定 = 10 | 1 波场单位 = 多少米 |
| — | `u_earthRadius` | float | 固定 6371000 | 曲率修正 |
| — | `u_caustics` / `u_foam` / `u_refraction` / `u_ssr` | float | UI/画质 | 扩展效果强度 |
| — | `u_absorb` | vec3 | 固定 | 水体吸收系数（1/米） |
| — | `u_foamColor` / `u_sunColor` | vec3 | 固定 | 泡沫 / 太阳色 |
| — | `u_eastWC` / `u_northWC` / `u_upWC` | vec3 | 构造时一次 | ENU 基向量（把 `czm_sunDirectionWC` 转到 ENU） |
| — | `u_debug` | float | 调试 | 调试可视化模式 |
| — | `u_normalScale` | float | 调参 | 法线强度（0=平面，A/B 排查摩尔纹用） |
| — | `u_motion` | float | 每帧 | 相机运动强度 0..1（JS 由位置/朝向变化估算）：缩放/飞行时抑制 SSR 与锐利波光，静止时自动回 0 |
| — | `u_specScale` | float | 调参 | 高光强度缩放（0=关闭，A/B 用） |

### 5.2 画质宏（编译期）

| 宏 | high | medium | low |
| --- | --- | --- | --- |
| `ITER_FRAGMENT`（法线 octave 数） | 5 | 3 | 2 |
| `WATER_SSR`（屏幕空间反射） | 1 | 1 | 0 |
| `WATER_CAUSTICS`（焦散） | 1 | 1 | 0 |
| `WATER_FOAM`（泡沫） | 1 | 1 | 1 |
| `textureScale` | 1.0 | 0.75 | 0.5 |

> `textureScale` 在 `PostProcessStage` 创建后只读，所以 `setQuality()` 会
> **销毁并重建 stage**（宏也在编译期展开）。

---

## 6. Cesium 集成要点（`WaterRenderer.js`）

```js
const water = new WaterRenderer(viewer, {
  store,                   // 可选：存在时每帧自动同步 UI 参数（幂等）
  centerLon: 120.05,
  centerLat: 26.98,
  sceneRadius: 9000,       // 仅 Material 兼容模式用
  useTerrainDepth: true,   // 默认 true：强制 globe.depthTestAgainstTerrain
});
water.setWaterLevel(15);       // 只写 uniform，不重建
water.setQuality('medium');    // 重建 stage（textureScale 只读）
water.setWaveOptions({ intensity, speed, caustics });
water.setEnabled(true);
water.update(seconds);         // 每帧：更新相机 uniform + 同步 store
water.setMaterialMode('postprocess' | 'material');
water.destroy();
```

- **主方案**：`PostProcessStage`，`sampleMode = LINEAR`，`textureScale` 按画质；
- **兼容方案**：`Cesium.Material` fabric（`waterMaterial.js`）+ `Primitive` +
  `MaterialAppearance`（Entity.rectangle 只接受 MaterialProperty，不能直接塞自定义
  fabric Material）。Material 版没有场景深度，因此没有折射/吸收/焦散/泡沫，
  仅作为降级/文档对照；
- **相机 uniform**：`u_camENU = basisᵀ · (camera.positionWC − centerECEF)`；
  `u_eyeToENU_i = basisᵀ · inverseViewMatrix 第 i 列`；`u_tanHalfFov = (1/P00, 1/P11)`；
  `u_pixelFootprint = 2·tanY / (drawingBufferHeight · textureScale)`。

---

## 7. 性能取舍（实测数据）

测试环境：headless Chromium（Playwright）+ ANGLE/Metal 真实 GPU，1600×1000。

| 配置 | 实测 FPS（Lead 的真实场景，overview 视角） |
| --- | --- |
| high（ITER 5 + SSR + 焦散，scale 1.0） | 62–120（随视角/水面占比变化） |
| medium（ITER 3 + SSR，scale 0.75） | ~79–106 |
| low（ITER 2，无 SSR/焦散，scale 0.5） | ~96–120 |

主要优化手段（按收益排序）：

1. **非水面像素早退**：陆地/建筑像素只做深度重建 + 一次水面求交就返回，
   不进入任何噪声/反射计算。真实场景里水面通常只占屏幕的 20%~60%，
   这项把 GPU 负载几乎减半。
2. **用解析求交取代 raymarch**：原版 `heightMapTracing` 每像素 8 次
   `map()`（≈ 48 hash/octave 计算）；现在每像素只有一次平面+曲率迭代（3 次
   乘加），且只在真正的水面像素上才算法线（3 次 `map_detailed`）。
3. **按像素足迹动态 eps + 远处法线压平**：既抗闪烁又让远处 `map_detailed` 的
   高频 octave"实际上被浪费得值得"（视觉上没差别）。
4. **SSR 只在水面像素、且做了遮挡测试前的 cheap 降权**；远距离水面直接跳过 SSR。
5. **画质三档**：`textureScale` 直接减少后处理分辨率（0.75/0.5），UIT 纹理
   放大由 LINEAR 采样兜底；同时降 `ITER_FRAGMENT`、关 SSR/焦散。
6. 每帧只上传标量/小向量（无纹理、无矩阵上传）；`u_eastWC` 等在构造时一次上传。

---

## 8. 踩坑记录（真实踩过的，按严重程度）

### 8.1 `PostProcessStage` 的 uniforms 是"拷贝"，直接改传入对象无效 ⚠️最坑

`new Cesium.PostProcessStage({ uniforms })` 会在**第一次 update** 时把 uniforms 的
值复制到内部 `_actualUniforms`，并通过 `defineProperties` 把 `stage._uniforms`
换成一层 getter/setter 代理。之后：

- ❌ 修改我们传进去的那个普通对象 → GPU 永远收不到新值（水面看起来"卡住"）；
- ✅ 必须 `stage.uniforms.xxx = value`（走 setter 才会同步 `_actualUniforms`）。

更坑的是**代理对象是在第一次渲染时才创建的**，所以不能在构造后缓存
`stage.uniforms`。本项目做法：

```js
_refreshUniforms() {
  this._uniforms = this._stage ? this._stage.uniforms : this._baseUniforms;
}
// update() / setWaterLevel() / setQuality() ... 开头都先 _refreshUniforms()
```

诊断过程中曾出现"水位/相机 uniform 全是默认值，整屏按 0 水位渲染"的现象，
根因就是这一条。

### 8.2 `postProcessStages.remove()` 会顺带 destroy stage

Cesium 1.147 的 `PostProcessStageCollection.remove(stage)` 内部最后调用
`stage.destroy()`。如果再手动 `stage.destroy()` 会抛
`DeveloperError: This object was destroyed`，并且这个异常发生在 Vue watcher
回调里会打断 scheduler flush（UI 上表现为 FPS/画质文案冻结）。
**正确做法**：只调 `remove()`，不要再 `destroy()`；重建时用唯一 name 重新 `add()`。

### 8.3 `globe.depthTestAgainstTerrain` 必须为 true，否则 terrain 深度会被清掉

`Scene.updateEnvironment()`：
```js
clearGlobeDepth = globe.show && (!globe.depthTestAgainstTerrain || mode === 2D)
```
当它为 true 时，Cesium 在 globe pass 之后**清空深度缓冲**（为了 3D Tiles 不跟地形
做 depth test），PostProcessStage 拿到的 `depthTexture` 里只剩非地形物件 →
水面无法和地形比较 → 整屏被判定成水面（早期表现为"水淹没整个世界"）。
本项目在 `WaterRenderer` 构造时强制 `globe.depthTestAgainstTerrain = true`
（`useTerrainDepth:false` 可关闭）；Lead 的 `floodApp.js` 也显式设置过。

### 8.4 `czm_readDepth` 已经反 log，不能再把它当 log 深度用

- `LOG_DEPTH` 宏由 `PostProcessStage` 自动注入（场景默认开对数深度）；
- `czm_readDepth(depthTexture, uv)` = `czm_reverseLogDepth(texture(...).r)`，
  返回**常规窗口深度 [0,1]**；
- `czm_windowToEyeCoordinates(gl_FragCoord.xy, rawDepth)` 的第二个参数在
  `LOG_DEPTH` 下期望的是**原始 log 深度**。两者不能混用。
- 本项目直接用 `czm_readDepth` + 自己反投影（§3.2），与 `LOG_DEPTH` 状态解耦。

### 8.5 post-process 时刻的 `czm_currentFrustum` 是"当前 frustum 档位"，不是相机全程

Cesium 3D 场景按 multi-frustum 分档渲染，post-process 执行时 `czm_currentFrustum`
是最后一档（本项目的真实场景里是 `near≈3325m, far≈239km`，而相机 `frustum.near/far`
是 `0.1 / 1e10`）。好消息是：写深度和读深度用的是同一档，所以**直接用
`czm_currentFrustum` 反投影是自洽的**，不需要相机全程 frustum。这曾导致误判
（用相机 frustum 算出来整屏水深不对）。

### 8.6 SSR 在地平线附近会采到"脏"内容

反射射线贴近地平线时，反射点投影回屏幕会落在天空/地形交界的错误位置
（尤其远处水面），表现为黑色/绿色条纹。解决：按「反射仰角」和「水面距离」
对 SSR 加权，近距离 + 高仰角才用 SSR，其余回退到与 skyStage 同公式的解析天空。

### 8.7 集成排查：地形 provider 的弧度/角度 bug（非 shader 问题，但会伪装成"水面不生效"）

Lead 的 `src/cesium/terrainProvider.js` 曾把 `tilingScheme.tileXYToRectangle()`
返回的**弧度**直接传给 `heightAtLonLat()`（期望**度数**），地形被拍平在
~24.4m，水位 2.5/15 都低于地形 → 水面"完全不出现"。排查方法（可复用）：

1. `scene.globe.getHeight(Cartographic)` 在不同点全部返回同一个值 → 地形数据问题；
2. 把弧度当度数调用 `heightAtLonLat(2.0955, 0.4708)` 得到 24.42，与 getHeight 一致 → 定位成功。

### 8.8 `textureScale < 1` 时 gl_FragCoord / czm_viewport 是缩放后的

想手动算 UV/像素尺寸时不要用 `gl_FragCoord / czm_viewport` 再假设它是全屏；
直接用 `v_textureCoordinates`。本项目只把 `textureScale` 用在 `u_texel` /
`u_pixelFootprint` 的换算里，其余全部用 UV。

### 8.9 stage 顺序

后处理 stage 按 `add()` 顺序执行：
`skyStage`（天空）→ `flood-water`（水面）→ `fxaa`（Cesium 内建，最后）。
因此水面 shader 的 `colorTexture` 里**已经包含天空**，SSR 才能采到真实天空；
如果把水面加到天空之前，反射会采到黑色背景。

### 8.10 摩尔纹 / 同心圆 / 雷达波纹（v2 重点修复）

现象：浅水与中远景水面出现成片规则斜纹、同心圆、织布状干涉，像雷达波纹。
用 A/B 逐效果关闭（`u_refraction/u_caustics/u_foam/u_ssr/u_normalScale/u_specScale`
全部可以在运行时通过 `stage.uniforms` 改，无需重建）定位出**三个独立来源**，
A/B 截图保存在 `screenshots/wip/water-ab-*.png` / `water-ab6-*.png`：

1. **Dave Hoskins caustic 的平铺结构**（最大来源）
   原版 `caustic()` 用 `mod(uv * TAU, TAU) - 250.0`，图案是**周期平铺**的；在
   大面积浅水斜视时平铺边界 + 内部高频产生明显网格/同心圆。
   → 换成自研 `causticWeb()`：两层不同尺度/流向的 `sea_octave` 相乘。
2. **value-noise hash 的晶格方向性**
   第一版 `causticWeb` 用 `1 - abs(noise(...))` 的零等值线做亮线，但 Seascape 的
   `hash()`（`fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5)`）有固定的对角
   晶格相关性，直接当焦散用会出现**长直平行条纹**。
   → 改用 `sea_octave`（|sin|/|cos| 折叠 + 噪声扰动）生成网状图案。
3. **泡沫噪声在整片浅滩上的欠采样**
   早期 foam 覆盖所有水深 < 1.4m 的区域（8m 水位时是整片村庄），噪声频率
   0.45~1.35/m 在几百米距离的像素足迹下严重欠采样 → 大片规则斜纹。
   → 泡沫只保留「水深 < 0.55m 的极浅滩 + 水线附近」的窄带；噪声频率降到
   0.18/0.42；`tWater > 1.3km` 完全关闭。
4. 附带修复：
   - `map_detailed()` 增加 **octave LOD**：当前 octave 波长 < 2×像素足迹时直接
     `break`（远处不再采样高频 octave）；
   - 远处法线更早压平（`flatFade = smoothstep(350, 4200, tWater) * 0.96`）；
   - 太阳镜面高光随距离衰减（`exp(-tWater*0.00055)`），避免远处波光闪烁；
   - 折射 UV 偏移收敛（4 + 10/(1+depth*0.7) texel，上限 9px），避免大位移采样
     地面纹理时放大出假图案；
   - 焦散只保留在 **< 220m** 的近景（远处像素足迹 >> 焦散特征尺寸，必然摩尔纹）；
   - 法线/高光强度暴露为 `u_normalScale` / `u_specScale`，便于验收时快速 A/B。

验收标准：5 个机位 × 5 档水位截图（`screenshots/wip/water-level-*.png` 与
`water-fixed-*.png`）中，水面只保留自然的长周期涌浪/涟漪，无规则干涉纹；
headless FPS 62–120（high 档，1600×1000）。

### 8.11 缩放/飞行时水面"一直闪烁"（post-process uniform 更新时机）

现象：用户滚轮缩放/飞行相机时，水面持续闪烁、水线与场景边缘错位。
根因**不在 shader，而在 uniform 的更新时机**：

- 早期实现里 `water.update()` 放在页面自己的 `requestAnimationFrame` 循环中，
  与 Cesium 的渲染循环（`CesiumWidget.render` → `Scene.render`）**没有顺序保证**；
- 相机矩阵是在 `Scene.render()` 内部更新的（`prePassesUpdate` 里的
  `camera.update()`），如果水面 uniform 在本帧渲染之后才写入，shader 用的
  相机位置/朝向就比场景深度**晚一帧** → 水面求交与深度重建错位 → 闪烁。

正确做法（Lead 已在 `floodApp.js` 修复，本项目验证通过）：

```js
// ✅ uniform 必须在 scene.preRender 更新（此时 camera.update() 已经执行完、
//    本帧 render 还没开始）；Cesium 源码顺序：
//    Scene.render: preUpdate → prePassesUpdate(camera.update) → preRender → render
scene.preRender.addEventListener(() => {
  water.setWaterLevel(store.waterLevel);       // 水位也在这里兜底同步
  water.update(performance.now() / 1000);      // 相机 uniform + u_motion
});
// 同时从自建 rAF 循环里移除 water.update()
```

验证方法（`dev/stress-zoom2.mjs`，生产构建 headless 1600×1000）：

1. 把水面 stage 切到 `u_debug=4`（红=水面像素 / 灰=水线 AA 带 / 其余=场景），
   这样「红色像素占比」就是水面覆盖率；
2. 页面内用 rAF 循环做**每帧小步长连续缩放**（zoom-in 22 帧 + zoom-out 22 帧），
   每 140ms 截一帧；对相邻帧的水面 mask 做 XOR：
   - 平滑相机运动 → 只有水线边缘变化，XOR 很小且均匀；
   - 若 uniform 滞后一帧 → 水面/陆地成片翻转，XOR 出现尖峰；
3. 实测（修复后）：zoom-in 22 帧 XOR **mean 0.71% / max 1.11%**，zoom-out
   **mean 0.67% / max 1.04%**，水面覆盖率随缩放单调变化（45.5%→48.9%→45.3%）；
   相机静止时 XOR = **0.00%**；全程 console error = 0。修复前同一测试的
   flyTo 段 XOR 尖峰可达 35%（整屏水/陆翻转），静止段也偶发跳变。

附带的**运动稳定化**（纯 uniform，不重建任何资源，静止时无副作用）：

- `WaterRenderer._updateMotionUniform()` 每帧由相机位移速度 + 角速度估算
  `u_motion ∈ [0,1]`（attack 快、release 慢），静止 ~0.3s 内回 0；
- shader 里用 `u_motion` 做三件事：
  1. 反射方向改用**低通法线**（`nENU` 向 up 收拢 45%，运动时最多 85%）——
     SSR 采样 UV 对高频波法线极其敏感，这是缩放 shimmer 的主要来源；
  2. SSR 权重 × `(1 - 0.75·u_motion)`（快速运动时更多用解析天空，稳定）；
  3. 锐利太阳高光 × `(1 - 0.6·u_motion)`，法线额外压平 `0.45·u_motion`。
- A/B 实测（`dev/stress-shimmer2.mjs`，静止 6 帧 vs 缓慢连续缩放 8 帧的相邻帧
  平均像素差之比）：SSR/高光都开 = 1.22×；只开其一或都关 ≈ 1.1× →
  加稳定化后运动 shimmer 明显下降，且静止画面不受影响（`u_motion=0`）。

剩余现象（可接受）：一次性大幅 `flyTo`（相机一帧内移动数公里）时水面 mask
帧间差变大，这是相机大位移导致的正常透视变化，不是闪烁；相机停稳后 XOR=0。

---

### 8.12 水面"太深，不仔细看看不出是水"（v3 提亮）

现象：黄昏低照度 + 深色水体，远看水面像深色地面（overview 15m 水面均值 RGB(41,67,79)，
陆地 RGB(103,106,90)，水面比陆地还暗）。

修复思路与关键参数：

| 项 | 旧值 | 新值 | 作用 |
| --- | --- | --- | --- |
| `u_absorb` | (0.26, 0.075, 0.046) | **(0.18, 0.055, 0.034)** | 深水不再发黑 |
| `u_deepColor` | (0.020,0.075,0.108) | **(0.028,0.105,0.175)** | 深水是清晰的蓝 |
| `u_shallowColor` | (0.045,0.24,0.26) | **(0.05,0.235,0.29)** | 浅水通透偏青 |
| `u_scatterColor` | (0.06,0.26,0.28) | **(0.075,0.25,0.30)** | 天光散射补光 |
| fresnel | 0.025 + 0.975·pow5，掠射 +0.35 | **0.08 + 0.92·pow5，掠射 +0.50** | 俯视也带天空色/镜面感 |
| 太阳高光 | 220 次方 ×6 / 28 次方 ×0.35 | **120 次方 ×5.5 / 28 次方 ×0.5** | 波光更亮但不过曝 |
| 水体自亮 | 无 | `refracted += u_deepColor*0.38 + u_scatterColor*0.10` | 不依赖光照也亮 |
| 泡沫 | 水深<0.8m、权重 0.30、400–1300m | 水深<0.55m、权重 0.35、400–1400m，颜色更白 | 水线更清楚（又避免浅滩白噪点） |
| 远景雾 | `smoothstep(8000,36000)*0.88` | `smoothstep(9000,40000)*0.72` | 远处不灰 |
| 波浪 | `0.03+0.10i` | **`0.04+0.115i`** | 水面特征更明显 |

结果（同一生产构建、同机位、UI 隐藏）：overview 水面 **RGB(41,67,79) → RGB(71,120,131)**，
village 水面 **RGB(39,73,76) → RGB(67,123,124)**；陆地像素基本不变 → 水面既亮又是
明确的青蓝色，"一眼是水"。同时保留黄昏感：底色是冷青蓝，掠射角有暖色天空反射/
太阳波光，最后整体叠一层 6~8% 的暖色偏移（`mix(color, color*vec3(1.08,0.985,0.89), 0.65)`）。

配合的材质版（蓄水区）修复见 §9 的 `tangentToEyeMatrix` 踩坑 + 提亮参数；
调试可运行时改 `u_diffMul/u_emisMul/u_alphaBase/u_specMul`（无需重建材质）。

验证截图：`screenshots/wip/water-bright-before-*.png`（旧）与
`water-bright-after-{overview15,village15,sea5,zone,zone-far}.png`（新）。

---

## 9. Material 兼容版（`waterMaterial.js`）

```js
const material = createWaterMaterial({ stScale: new Cesium.Cartesian2(...) });
// 直接贴到 Primitive 的 MaterialAppearance 上（Entity.rectangle.material 只接受
// MaterialProperty，不能直接塞自定义 fabric Material）
```

- fabric 的 `source` 复用 `SEASCAPE_COMMON_GLSL`（同样的 noise/sea_octave/
  map_detailed/getNormal），所以波浪算法与 post-process 版逐函数一致；
- 直接用 `materialInput.st` 驱动波场（`st * u_stScale`）；
- 反射在 `material.emission` 里用解析天空实现，菲涅尔控制亮度/alpha；
- **v3 提亮后的着色公式**（`u_diffMul/u_emisMul/u_alphaBase` 是调参 uniform）：

  ```glsl
  vec3 waterBody = mix(u_deepColor, u_shallowColor, shallowMix*0.65);
  waterBody = mix(waterBody, u_deepColor*1.45, 0.28);        // 青绿 → 海蓝
  material.diffuse  = (waterBody*(0.95+0.55*sss) + skyAmbient*u_scatterColor*0.65) * u_diffMul;
  material.emission = (skyColor*(0.10+0.90*fresnel)*1.15 + u_sunColor*0.02) * u_emisMul;
  material.specular = 0.90 * u_specMul;  material.shininess = 90.0;
  material.alpha    = clamp(u_alphaBase + 0.40*fresnel, u_alphaBase, 0.98);
  ```

  默认 `u_diffMul=1.8, u_emisMul=1.0, u_alphaBase=0.85, u_specMul=1.0`；
  实测 2.5km 视距的蓄水区湖面像素约 **RGB(70~75, 110~120, 118~125)**，
  与灰白山体（~RGB(150,150,140)）对比明显，一眼能认出是湖面。
- **⚠ 重要踩坑（v3 修复）**：`MaterialAppearance` 默认用 BASIC 材质支持，
  它**不提供 `materialInput.tangentToEyeMatrix`**（该字段是未初始化的零矩阵）。
  早期 shader 直接乘它 → 法线变 NaN → `ndv=0` → `fresnel=1` → 反射采样到地平线
  以下的雾霭色，蓄水区整片渲染成灰白色"板子"。正解：用 `st` 波场法线
  `nSea=(东,上,北)`，再用 `u_eastWC/u_northWC/u_upWC` 组合成世界法线：

  ```glsl
  vec3 nENU = normalize(vec3(nSea.x*1.85, nSea.y, nSea.z*1.85));
  vec3 nWC  = normalize(u_eastWC*nENU.x + u_northWC*nENU.z + u_upWC*nENU.y);
  material.normal = normalize(czm_viewRotation * nWC);   // 交给 Cesium 光照
  vec3 viewDirWC  = normalize((czm_inverseView * vec4(materialInput.positionToEyeEC, 0.0)).xyz);
  ```

  调试时可把 `u_debug` 设为 1/2/3（diffuse/emission/baseline）、9（skyColor）、
  10（反射方向）、11（法线）、12（fresnel）逐个分量可视化，快速定位是哪个分量异常。
- **局限**：没有场景深度 → 无折射/吸收/焦散/泡沫；浅水不能透出地面；
  波浪随矩形 st 拉伸。因此只作为降级/对照/蓄水区方案，demo 默认用 post-process 版。

---

## 10. 验收清单

- [x] 水面 shader 在 Cesium 1.147 WebGL2 下编译通过、无 console.error；
- [x] 1600×1000 headless（ANGLE Metal）下 high 档 ≥ 60fps（实测 92–120）；
- [x] 水位 0 / 2.5 / 8 / 15 / 24m 五档截图（`screenshots/wip/water-level-*.png`）；
- [x] 2.5m 时海面/河口有水；15m 时村庄大片被淹、建筑露出水面；
- [x] 岸边泡沫、浅水透底/折射、太阳波光、焦散、远景雾霭；
- [x] 画质三档来回切换无异常（生产构建验证 0 console error，6 次切换）；
- [x] 摩尔纹 A/B 排查与修复（见 §8.10，A/B 截图 `screenshots/wip/water-ab*.png`）；
- [x] 最终验收截图 `water-fixed-overview/village-8/village-15/river-8/sea-5.png`；
- [x] v3 提亮：水面从近黑蓝变清晰青蓝（§8.12），蓄水区远看可辨（§9）；
      截图 `water-bright-after-{overview15,village15,sea5,zone,zone-far}.png`（含 before 对照）；
- [x] Material 兼容版可用且已修复 `tangentToEyeMatrix` NaN（§9）、蓄水区已提亮；
- [x] 保留 Seascape / TDM 与 Dave Hoskins 的署名与 CC BY-NC-SA 3.0 声明。
