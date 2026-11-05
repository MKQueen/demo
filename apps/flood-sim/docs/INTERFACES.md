# flood-sim 内部接口契约（Lead 维护）

> 本文件是团队成员之间的接口约定。改动接口先在此记录，再通知 Lead。
> 目录：`apps/flood-sim/`（下称 APP）。CesiumJS **1.147.0**（已安装，运行时从 `node_modules/@cesium/engine` 解析）。

## 0. 分工与写入边界（写文件前先看这里）

| 区域 | Owner | 说明 |
| --- | --- | --- |
| `src/cesium/**`、`src/geo/terrainModel.js`、`src/analysis/**`、`src/store.js`、`src/main.js`、`index.html`、`vite.config.js`、`package.json`、`scripts/copy-cesium-assets.mjs` | **lead** | 场景/地形/分析/集成 |
| `src/water/**`、`docs/shader-port.md`、`docs/research/**` | **shader-dev** | 水面 Shader 移植（后处理 + Material 两套） |
| `src/components/**`、`src/App.vue`、`src/styles.css` | **ui-dev** | UI 组件与布局、样式 |
| `scripts/generate-village-tiles.mjs`、`src/geo/villageLayout.js`、`public/generated/**` | **tiles-dev** | 村庄数据 + b3dm 3D Tiles 生成 |
| `README.md`、`docs/*.md`（除 `docs/shader-port.md`、`docs/research/**`） | **docs-dev** | 文档 |
| `hub/demos.json`、根 `README.md` | **lead** | 合集集成 |

不要修改别人 owner 的文件；需要改就发消息给 owner。

## 1. 场景世界观（地形数据模型，Lead 提供）

- 地点：闽东海岸「澜屿湾」，中心 `SCENE.lon0 = 120.05`, `SCENE.lat0 = 26.98`。
- 范围：约 14 km（东西）× 12 km（南北），局部坐标系：`x` 向东、`y` 向北，原点在中心，单位米。
- 地势：西侧大山（最高约 620 m），山脚河谷向东流入海，海岸线在东侧，村庄在河口北岸的冲积平原（地面 3~14 m）。
- 水位：`WATER.min = 0`，`WATER.max = 30`，`WATER.initial = 2.5`（米，海拔）。水位 0 m 时只剩河道/海面；>8 m 开始淹村庄低洼处；>18 m 大部分村庄被淹。
- 地形是**纯函数**，同一份 JS 同时用于：Cesium 地形 Provider、地表贴图、淹没面积统计、3D Tiles 建筑落位。

### `src/geo/terrainModel.js`（纯 JS，无 Cesium 依赖，浏览器/Node 通用）

```js
export const SCENE = {
  name: '澜屿湾',
  lon0: 120.05, lat0: 26.98,
  widthMeters: 14000, heightMeters: 12000,
  centerLon, centerLat, // = lon0/lat0
};
export const WATER = { min: 0, max: 30, initial: 2.5, safe: 6, danger: 15 };
export const VILLAGE = {
  centerX: -350, centerY: -250,          // 局部米
  centerLon, centerLat,
  radiusMeters: 900,
};
export const ELEVATION = { min, max, seaLevel: 0 };

// 局部米 <-> 经纬度
export function lonLatToLocal(lon, lat) -> { x, y }   // 米
export function localToLonLat(x, y) -> { lon, lat }

// 核心高程（米，海拔；可能 < 0 表示海床）
export function heightAtLocal(x, y) -> number
export function heightAtLonLat(lon, lat) -> number

// 河流中心线（可视化/道路/建筑避让用），点按上游→下游排列
export const RIVER_PATH = [{ x, y, bedHeight, elevation }, ...];
export const COASTLINE = [{ x, y }, ...];       // 海岸线采样点
export const ROADS = [{ points: [{x,y}], width }]; // 可选

// 辅助
export function sampleHeights(x0, y0, dx, dy, nx, ny) -> Float32Array; // row-major, 供统计/贴图
export function localRectToDegrees(x0, y0, x1, y1) -> { west, south, east, north }; // 度
```

## 2. 共享状态 `src/store.js`（Lead 提供）

```js
import { reactive } from 'vue';
export const store = reactive({
  // 水位
  waterLevel: 2.5,        // 实际水位（m，由渲染循环平滑写回，UI 只读显示）
  targetLevel: 2.5,       // 滑块目标水位（UI 写）
  autoRise: false,        // 自动上涨（UI 写）
  riseSpeed: 0.6,         // m/s（UI 写）
  // 水体
  waterEnabled: true,
  waveIntensity: 0.65,    // 0..1
  waveSpeed: 0.8,         // 0..2
  caustics: 0.8,          // 0..1
  quality: 'high',        // 'high' | 'medium' | 'low'
  // 场景
  showBuildings: true,
  showLabels: false,
  cameraPreset: 'overview',
  // 状态/统计
  loading: { visible: true, progress: 0, label: '正在生成地形…' },
  fps: 0,
  stats: { /* 见 §4 */ },
  showInfo: false,
  error: null,
});
export const CAMERA_PRESETS = [
  { key: 'overview', label: '全景' },
  { key: 'village',  label: '村庄' },
  { key: 'river',    label: '河口' },
  { key: 'sea',      label: '海岸' },
  { key: 'compare',  label: '对比' },
];
```

**规则**：UI 只写 `targetLevel / autoRise / riseSpeed / waveIntensity / caustics / quality / showBuildings / cameraPreset / showInfo`；`waterLevel / fps / stats / loading` 由渲染循环写。UI 不要直接操作 Cesium。

## 3. 渲染入口 `src/cesium/floodApp.js`（Lead 提供）

```js
// 只暴露一个入口，UI 不 import Cesium
export async function createFloodApp({ container, store, onStats, onError })
  -> Promise<{
       flyTo(presetKey: string): void,
       dispose(): void,
       viewer,               // 调试用
       setWaterMaterialMode(mode): void, // 'postprocess' | 'material'（可选兼容模式）
       getDebugStats(): object,
     }>
```

- `createFloodApp` 内部：`new Cesium.Viewer(container, {...})`、程序化地形 Provider、地表贴图、村庄 3D Tiles 加载、水面（`src/water`）、淹没分析、每帧循环。
- 每帧把 `store.waterLevel` 平滑到 `targetLevel`，写 `store.fps`、`store.stats`（限频 5Hz）。
- 加载失败不能抛到 UI 白屏：写 `store.error` + 降级（无 3D Tiles 用实体方块兜底）。

## 4. 淹没分析 `src/analysis/floodAnalysis.js`（Lead 提供）

```js
export async function loadBuildingManifest() -> { buildings: [...] }  // 读 public/generated/village/buildings.json
export function buildAnalyzer({ buildings, terrain }) -> {
  compute(waterLevel) -> {
    // 建筑
    totalBuildings, floodedBuildings, dangerBuildings,   // 淹没深度 > 0.5m / > 2m
    floodedRatio,                                        // 0..1
    // 面积（网格采样地形，m²）
    inundatedAreaM2, totalAreaM2, inundatedRatio,
    // 深度
    maxDepth, meanDepth,
    // 直方图：每 2m 水位对应的被淹建筑数（0..WATER.max）
    histogram: [{ level, flooded }...],
    // 单体明细（前 N 个被淹建筑，UI 可用）
    floodedList: [{ name, depth, height }],
  };
}
```

**建筑清单 schema**（`public/generated/village/buildings.json`）：

```json
{
  "generatedAt": "ISO",
  "tileset": "generated/village/tileset.json",
  "villageCenter": { "lon": 120.05, "lat": 26.98 },
  "buildings": [
    {
      "id": "v-01", "name": "临江民居 01", "type": "house|shop|public|pier",
      "lon": 120.047, "lat": 26.982,
      "localX": -320.5, "localY": 210.2,          // 相对 villageCenter 的 ENU 米（3D Tiles 根变换用）
      "groundHeight": 9.2,                         // 地面海拔 m
      "height": 8.4,                               // 建筑高度 m
      "floors": 2,
      "footprintArea": 86.5,                       // m²
      "rotation": 0.35,                            // 弧度，绕 up 轴
      "minGround": 8.9                             // 地基最低点海拔（判定淹没用）
    }
  ]
}
```

- `groundHeight` 必须用 `heightAtLocal` 计算；建筑必须避开河流与海面（`groundHeight > 1.5`）。
- 生成脚本运行：`node scripts/generate-village-tiles.mjs`，产物进 `public/generated/village/`（gitignore 已忽略 `public/generated/`，但脚本必须提交，构建前自动跑，见 §6）。
- 3D Tiles：tileset.json（asset.version 1.1 或 1.0+b3dm 均可，推荐 b3dm + batch table 属性 `id/name/height/floors`），根 transform = villageCenter 的 `eastNorthUpToFixedFrame`，建筑坐标用相对中心 ENU 米；单体需可被 pick 到并带属性。

## 5. 水面模块 `src/water/**`（shader-dev 提供）

```js
// src/water/WaterRenderer.js
export class WaterRenderer {
  constructor(viewer, { store, centerLon, centerLat, sceneRadius }) {}
  setWaterLevel(meters) {}              // 只更新 uniform，必须廉价
  setQuality('high'|'medium'|'low') {}
  setWaveOptions({ intensity, speed, caustics }) {}
  setEnabled(bool) {}
  update(timeSeconds) {}                // 每帧调用
  setMaterialMode('postprocess'|'material') {} // 可选
  destroy() {}
}
```

- 主方案：`Cesium.PostProcessStage` 屏幕空间水面（Seascape Ms2SD1 移植），深度纹理重建 + 水面板求交，含折射/焦散/泡沫。**水色、可见性、透明度由 shader 自行处理，不依赖场景几何。**
- 兼容方案（可选）：`Cesium.Material` 水面矩形（Entity Rectangle + fabric material），供文档/降级演示。
- 自动 uniform 可用：`czm_inverseProjection`、`czm_inverseView`、`czm_viewerPositionWC`、`czm_sunDirectionWC`、`czm_viewport`、`czm_currentFrustum`；深度用 `czm_readDepth(depthTexture, uv)` / `czm_windowToEyeCoordinates(gl_FragCoord.xy, rawDepth)`（post-process 会自动注入 `LOG_DEPTH` define）。
- Seascape 原始源码在 `docs/research/raw/isf-frag.glsl`（已由调研取得，作者 TDM / Alexander Alekseev，CC BY-NC-SA 3.0，必须保留署名）。

## 6. 构建/运行（Lead 负责）

- `npm install`（已装好，postinstall 会复制 `public/cesium`）
- `npm run dev` → http://127.0.0.1:5182
- `npm run build` → `dist/`（base './'，可嵌进 `site/demos/flood-sim/`）
- 无 Cesium Ion Token；地形/贴图/建筑全部本地程序化生成。**不允许出现运行期网络请求**（审计脚本会把 4xx 当错误），也不许有 console.error。
- 页面在 1600×1000 headless Chromium（Playwright，WebGL2）下必须能出图、无报错。

## 7. UI 规范（ui-dev）

- 深色玻璃拟态 + 克制的青蓝色（水体）/琥珀色（警示）点缀，参考合集现有 demo 的审美。
- 左上：标题「潮线 TIDELINE · 3D 动态水淹模拟」，副标题 + 当前水位大数字。
- 右侧：控制面板（水位滑块 0–30 m + 自动上涨 + 速度 + 波浪/焦散 + 画质 + 建筑/水面开关 + 视角预设）。
- 左下：淹没统计卡（被淹建筑/总数、淹没面积、最大水深、危险建筑、水位-淹没直方图 SVG 即可）。
- 底部中间：水位刻度尺/图例（水面/陆地/危险线）。
- 首次进入：加载遮罩（进度文案），完成后 1.2s 淡出；右上角 FPS/画质小字。
- 必须响应式：≥1280 宽完整；<900 宽面板收起为底部抽屉（至少不重叠到不可用）。
- 组件：`App.vue`（布局）、`components/ControlPanel.vue`、`components/StatsPanel.vue`、`components/TopBar.vue`、`components/LegendBar.vue`、`components/LoadingOverlay.vue`、`components/CameraDock.vue`、`components/InfoModal.vue`、`components/FpsBadge.vue`；样式集中在 `src/styles.css`（CSS 变量 + 组件内 scoped 可少量）。
- 所有中文文案由 ui-dev 定；不要引入 UI 框架/图标库，纯 CSS + 内联 SVG。

## 8. 文档（docs-dev）

`README.md` 必须覆盖用户提出的 5 个部分（中文，可直接当技术方案交付）：
1. 场景初始化 + 地形/3D Tiles 加载代码（含真实数据源开关说明）。
2. **核心**：ShaderToy Ms2SD1 → Cesium 的完整转换（原始分析、函数映射、uniform 映射表、后处理版本完整代码、CustomShader/Material 版本、踩坑）。
3. 动态水位控制（滑块、平滑动画、分析联动）。
4. 性能优化 2–3 条（要有本项目的实测/取舍，不要空话）。
5. 数据准备指南（DEM / 3D Tiles 免费数据源、处理流程）。
另：架构图/目录说明/运行方式/验收清单。代码引用以最终文件为准，写完后核对行号/文件名。
