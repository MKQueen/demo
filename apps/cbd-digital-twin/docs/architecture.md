# 架构方案 · 北京数字孪生

本文记录 `apps/cbd-digital-twin` 的工程架构、关键决策、状态机与扩展方式。阅读顺序建议：
`README.md`（功能/启动）→ 本文（设计）→ `docs/data-sources.md`（数据来源）。

---

## 1. 目标与非目标

### 目标

| 编号 | 需求 | 本项目的实现 |
| --- | --- | --- |
| G1 | 初始化 Cesium，隐藏默认 UI，定位整个北京市 | 自定义 Viewer options + 隐藏 credit 容器 + 北京全域 HPR 初始视角 |
| G2 | 防止模型穿模 | `globe.depthTestAgainstTerrain = true`；道路按高度分层 |
| G3 | 标志性建筑高精度模型 | 4 个程序化 glTF 体量（演示级；替换路径已预留） |
| G4 | 北京中心城区 + 朝阳 + CBD 建筑体块 | 中心城区 86,706 实例 + 朝阳 20,059 实例 + CBD 4,320 栋精细 3D Tiles |
| G5 | 道路 GeoJSON + 发光/流光 | 全部道路 PolylineCollection 合批；主干道 3 层霓虹 + 112 个流光 Billboard |
| G6 | POI + 自定义图标 + 点击弹窗 | BillboardCollection + canvas 图钉 + HTML InfoWindow |
| G7 | 侧栏点位 → flyTo → 环绕 | `flyToBoundingSphere` + `lookAtTransform` 轨道 |
| G8 | 纯前端、可静态部署 | 本地数据、无 token、`base: './'`、子路径验证 |
| G10 | 16 区逐区探索 | 顶栏「行政区」打开 16 区网格；选中后相机飞入区界，只显示该区 POI/地标；「北京全境」恢复总览 |
| G11 | 北京 / 朝阳 / CBD 快速视角 | 「国贸 CBD」直接进入朝阳区核心；相机高度阈值切换体块/标签 |
| G9 | 性能 | 合批、GPU 实例化、两层 LOD、自适应分辨率 |

### 非目标

- 不做真实测绘/BIM 精度；
- 不做在线地图服务代理；
- 不做服务端与数据库；
- 不做完整城市规划分析工具（容积率、日照、交通仿真等）。

---

## 2. 模块与职责

```text
src/
├── App.vue
│   ├─ 持有 selectedPoi / anchor / layers / stats / orbitActive / loading
│   ├─ onMounted 创建 CbdScene，onBeforeUnmount destroy
│   ├─ 管理键盘快捷键（Esc / R / L）与窗口 resize
│   └─ 只把纯数据传给组件，不把 Cesium 对象放入响应式系统
├── components/
│   ├─ TopBar.vue            品牌、行政区入口、北京/朝阳/CBD 视角、图层/画质/说明
│   ├─ PoiSidebar.vue        当前行政区 + 分类筛选 + 点位列表 + 移动端抽屉
│   ├─ DistrictPanel.vue     16 区网格选择器
│   ├─ PoiInfoWindow.vue     锚定屏幕坐标的 HTML 卡片；环绕/聚焦/关闭
│   ├─ LayerPanel.vue        10 个图层开关 + 市域/朝阳/CBD 数据统计
│   ├─ SceneHud.vue          高度/经纬度/航向/FPS/环绕状态
│   ├─ AboutDialog.vue       数据来源、精度边界、技术栈、许可
│   └─ LoadingOverlay.vue    启动进度 / 致命错误兜底
├── cesium/
│   ├─ CbdScene.ts           唯一命令式门面：Viewer、图层、相机、拾取、轨道、事件
│   └── utils/
│       ├─ canvas.ts         Canvas 生成 POI 图钉/脉冲环/流光点（无图片请求）
│       └─ geo.ts            assetUrl / fetch / 距离 / 折线采样 / 屏幕投影 / 相机 HUD
├── data/
│   ├─ poi.ts                57 个 POI、8 个地标配置、北京/朝阳/CBD 视角、图层面板定义
│   ├─ districts.ts          16 区目录（区名/英文名/面积/代表地标）
│   ├─ meta.ts               读取数据管线 meta.json 的容错适配
│   └─ types.ts              UI 与 CbdScene 共享的类型
└── styles/main.css          HUD/面板/InfoWindow/加载页/响应式
```

### 为什么用「门面类 + 回调」而不是全部放进 Vue？

1. Cesium 的 `Viewer / Primitive / Billboard / Model` 是重对象，进入 Vue `reactive` 会被 Proxy 包装，Cesium 内部的 `===`、`instanceof`、WeakMap 判等可能失效；
2. 相机、轨道、逐帧流光动画是命令式循环，放在 composable 里会与组件生命周期耦合；
3. `CbdScene` 可以单独实例化、调试和替换，Vue 只处理 UI 状态；
4. 所有跨层数据都走 `callbacks`（pure data），便于测试。

---

## 3. 数据契约

### 3.1 `public/data/meta.json`（由数据管线生成）

前端真正依赖的字段（其余字段保留供审计）：

```jsonc
{
  "bbox": [116.43, 39.885, 116.495, 39.93],       // west,south,east,north
  "coreBbox": [116.448, 39.9, 116.478, 39.918],
  "origin": { "lon": 116.461, "lat": 39.908, "height": 0 },
  "source": "OpenStreetMap ...",
  "attribution": "© OpenStreetMap contributors",
  "generatedAt": "2026-11-03T16:15:27+08:00",
  "buildingCount": 4320,
  "roadCount": 1398,
  "basemap": {
    "file": "data/basemap.jpg",
    "rectangle": [116.43, 39.885, 116.495, 39.93],
    "width": 2560,
    "height": 1772
  }
}
```

`src/data/meta.ts` 做容错：同时兼容顶层 `buildingCount`、`stats.whiteModelBuildings`、`layers.roads.count` 等不同层级；底图路径兼容 `file / path / url`。如果数据管线重跑导致字段变化，只改这里。

### 3.2 北京全域数据（`public/data/beijing/`）

北京边界/16 区（DataV GCJ→WGS84）、z11 卫星 + z10 上下文底图、中心城区 86,706 实例、18,062 条干路；详细契约见 [`docs/beijing-data.md`](./beijing-data.md)。

### 3.3 朝阳 district 数据（`public/data/district/`）

```jsonc
// meta.json
{
  "areaKm2": 465.5,
  "boundaryBbox": [116.3447, 39.8090, 116.6393, 40.1101],
  "center": { "lon": 116.5094, "lat": 39.9524 },
  "basemap": { "file": "data/district/basemap.jpg", "rectangle": [...], "width": 3072, "height": 3137 },
  "counts": { "buildings": 24145, "instances": 20059, "roads": 7632, "triangles": 240708 },
  "tiles": { "massing": { "tileset": "data/district/tiles/district-massing/tileset.json" } }
}
```

- `boundary.geojson`：MultiPolygon（含首都机场飞地）；
- `roads.geojson`：7,632 条朝阳干路（剔除 CBD 精细 bbox）；
- `tiles/district-massing/`：20,059 个 box 的 `EXT_mesh_gpu_instancing` 单 tileset（0.8 MB）；
- `basemap.jpg`：3072px 暗色底图，线性经纬度映射；
- 轴向：box 顶点在 glTF 中 Y-up；实例 `TRANSLATION` 的 y 含椭球曲率修正，Cesium 1.147 直接加载验证通过。


### 3.4 白模 tileset

```jsonc
{
  "asset": { "version": "1.1" },
  "geometricError": 200,
  "root": {
    "refine": "ADD",
    "boundingVolume": { "box": [cx, cy, cz, hx,0,0, 0,hy,0, 0,0,hz] },
    "geometricError": 0,
    "transform": [16 个列主序数：ENU→ECEF],
    "content": { "uri": "white-models.glb" }
  }
}
```

- **tile 坐标**：x=east、y=north、z=up；
- **glTF content**：glTF 为 Y-up，顶点 `x=east, y=up, z=-north`；Cesium 3D Tiles 默认 `modelUpAxis=Y`、`modelForwardAxis=X`，自动完成 Y-up→Z-up；
- **独立 glTF 模型**：默认 `forwardAxis=Z`，会额外绕 Y 轴转 90°。因此 `buildLandmarks()` 显式传 `forwardAxis: Cesium.Axis.X`。这是本项目踩过并修复的关键坑。

### 3.5 POI 与地标配置

`src/data/poi.ts`：

- `POIS`：57 个业务点位（覆盖 16 区；`district` 决定行政区筛选，`scope` 决定视角层级）；
- `LANDMARKS`：8 个 glb（2 个程序化 + 6 个 3D Warehouse 免费模型）的路径、经纬度、高度、yaw、POI id；
- `INITIAL_VIEW` / `DISTRICT_VIEW` / `CBD_VIEW`：北京 / 朝阳 / CBD 三种相机参数；
- `DISTRICT_LABELS`：望京 / 798 / 三里屯 / 朝阳公园 / 首都机场等全域标签；
- `LAYERS`：图层面板的 8 个图层 key。

新增 POI：在 `POIS` 加对象即可，侧栏、地图图钉、标签、信息窗会自动出现；若需要新的 3D 模型，在 `LANDMARKS` 加一项并放入 `public/models/`。

---

## 4. 相机与交互状态机

### 4.1 状态

| 状态 | 触发 | 行为 |
| --- | --- | --- |
| `initial` | 页面加载 / resetView | HPR 2100m 俯视国贸 |
| `flying` | 侧栏点击 / 重新聚焦 / orbitSelected | `flyToBoundingSphere` 平滑飞行 |
| `idle` | 飞行完成 | 用户自由拖拽/缩放 |
| `orbit` | 信息窗「环绕浏览」 | 每帧递增 heading，固定 target/range/pitch |
| `popup` | 点击 marker / 侧栏 | 锚点每帧更新，显示 HTML 卡片 |

### 4.2 事件流

```text
用户点击 marker
  → ScreenSpaceEventHandler.LEFT_CLICK
  → scene.pick(position).id（就是 POI 对象）
  → CbdScene.selectPoi(poi)
      → 更新图钉样式、脉冲环
      → callbacks.onPoiSelect(poi)      // Vue 更新侧栏高亮 + 渲染 InfoWindow
      → callbacks.onAnchor(...)          // postRender 每帧投影

用户点击侧栏
  → App.handleSelectPoi(poi)
  → CbdScene.focusPoi(poi)
      → stopOrbit()
      → selectPoi(poi)
      → camera.flyToBoundingSphere(...)
      → 完成后可选 startOrbit(poi)

用户关闭信息窗
  → App.handleCloseInfo()
  → CbdScene.clearSelection()
      → stopOrbit()
      → 清除脉冲环 / 清空 anchor
      → callbacks.onPoiSelect(null)
```

### 4.3 屏幕锚定

`InfoWindow` 不是 Cesium `infoBox`，而是一个普通的 Vue 组件：

1. 世界坐标 → `scene.cartesianToCanvasCoordinates`；
2. 判断相机前方 + 视口边界 → `{x,y,visible}`；
3. 把数值写入 Vue；卡片根据 `viewportWidth/Height`：
   - 桌面：上方/下方翻转 + 横向 clamp；
   - 移动端（`<760px`）：固定底部抽屉，不再跟随锚点；
4. 相机移动或环绕时 `postRender` 持续更新，卡片看起来「钉」在建筑上。

---

## 5. 图层策略与性能

> **白模几何**：CBD 4,320 栋是 footprint 拉伸棱柱，合并为 1 个 GLB；北京中心城区 86,706 栋 + 朝阳 20,059 栋是 OSM footprint 的 OBB box，使用 `EXT_mesh_gpu_instancing` 合为高度分档 node。不是逐栋独立模型，也不是逐栋 draw call。

| 图层 | 技术 | 数量 | 开关方式 |
| --- | --- | --- | --- |
| 北京中心城区体块 | 3D Tiles 1.1 + EXT_mesh_gpu_instancing | 1 tileset / 86,706 实例 / 1.04M tris / 3.3MB | `tileset.show` |
| CBD 白模 | 3D Tiles 1.1 单 GLB | 1 tileset / 4,320 栋 / 62.5k tris | `tileset.show` |
| 朝阳体块 | 3D Tiles 1.1 + EXT_mesh_gpu_instancing | 1 tileset / 20,059 实例 / 241k tris / 0.8MB | `tileset.show` |
| 全域区界 | MultiPolygon + Polyline + LabelCollection | 2 环 / 7 标签 | datasource/collection.show |
| 北京中心城区干路 | 2 个 PolylineCollection | 18,062 条 | collection.show |
| 朝阳干路 | 2 个 PolylineCollection | 7,632 条 | collection.show |
| 总览 CBD 路网 | 1 个 PolylineCollection | 1,398 条 | 相机高度 >15km 时启用 |
| 地标 | 独立 Model + 标签 + 地面环 | 8（6 个 3D Warehouse 免费模型 + 2 程序化） | Model.show / LabelCollection.show |
| 主干道 | 3 个 `PolylineCollection`（halo / glow / core） | 445 条合批 | collection.show |
| 次级/支路 | `PolylineCollection` | 953 条合批 | collection.show |
| 道路名 | `LabelCollection` | ≤18 | collection.show |
| 流光 | `BillboardCollection` | 112 | collection.show + preRender 位置更新 |
| CBD 城市地块 | `CustomDataSource` | 398 | datasource.show |
| 铁路 | `PolylineCollection` | 314 | collection.show |
| POI | Billboard + Label | 21 + 21 | collection.show；总览/小屏隐藏文字 |

**原则**：数量少、样式复杂 → Entity（例如地标地面环）；数量大、样式统一 → Primitive / 3D Tiles；道路全部 Primitive 合批，主干道叠 3 层（宽淡光晕 / PolylineGlow / 窄亮芯）形成霓虹效果。

其他性能决策：

- MSAA 1 + FXAA；自动画质档按实测 FPS 调节 `resolutionScale`（0.55–1.0）；
- 关闭阴影/大气/雾，保留星空与方向光；
- 总览模式（相机 >15km）隐藏 CBD 精细道路/流光/地标标签，启用全域暗色路网，避免 CBD 过曝；
- 移动端隐藏 POI 文字标签、全域仅保留区名；
- 白模 style alpha 固定为 1.0（透明 alpha 会让整块 mesh 进入透明通道，产生自遮挡 ghosting）；
- 实例化数据不逐栋建 Entity；道路/POI 均合批。

---

## 6. 响应式与可访问性

- **断点**：1260 / 1100 / 760 / 400px；
- 桌面：固定侧栏 + 浮动信息窗；移动端：侧栏抽屉 + 底部信息卡 + 浮动「点位」按钮；
- 键盘：`Esc` 依次关闭弹窗/侧栏/信息窗，`R` 复位视角，`L` 开合图层面板；
- 所有按钮可 Tab 聚焦，`:focus-visible` 有高亮；
- Toast 用 `role=status aria-live=polite`；加载页有错误兜底与重试；
- `prefers-reduced-motion` 下压缩动画时长。

---

## 7. 扩展点

1. **替换高精度模型**：保持 `public/models/*.glb` 路径与 `LANDMARKS` 配置即可；如模型轴向不同，改 `forwardAxis`/`yaw`。
2. **接入真实地形**：`terrainProvider` 换成 `Cesium.createWorldTerrainAsync()`；道路/POI 改 `clampToGround` 或地面折线；白模需挖除或抬高。
3. **接入 Cesium ion / 在线影像**：申请 token，使用 `createOsmBuildingsAsync()` 或 `UrlTemplateImageryProvider`；注意 token 安全与影像 ToS。
4. **真实 POI 接口**：把 `POIS` 改为异步 store，`CbdScene.buildPois()` 在数据返回后增量 add；增加聚合与搜索。
5. **更多业务图层**：按 `LayerKey` 增加 `CustomDataSource`，在 `LAYERS` 与 `applyLayerState()` 中注册。
6. **海量道路**：MVTDataProvider（Cesium 1.142+）或预切 3D Tiles；本 Demo 的 GeoJSON 方案在数千条仍可接受。
7. **更大范围 LOD**：当前全域 box 单 tile 适合区县级总览；市域级建议按空间格网切 3D Tiles LOD，并保持实例化。

---

## 8. 测试清单

开发 / CI 建议执行：

- [ ] `npm run typecheck`（vue-tsc 无错误）；
- [ ] `npm run build` 成功，`dist/index.html` 无绝对路径资源；
- [ ] 子路径预览 `node scripts/serve-app.mjs apps/cbd-digital-twin/dist /demos/cbd-digital-twin 5285`，页面无 404 / pageerror / console.error；
- [ ] 首页加载完成后无加载遮罩残留；
- [ ] 点击地图 marker → 信息窗出现在对应位置；关闭后消失；
- [ ] 侧栏切换每个分类、每个 POI，相机飞行正常；
- [ ] 「环绕浏览」启动/停止；拖拽/滚轮会自动停止；
- [ ] 左键拖拽相机经纬度变化、右键拖拽俯仰角变化、滚轮高度变化；右键不弹原生菜单；
- [ ] 10 个图层逐个开关，无残留 primitive；
- [ ] 16 区选择器逐区切换；每区 POI/免费地标正确过滤；北京全境/国贸 CBD 按钮；
- [ ] 免费地标在首屏后逐步加载且不阻塞 loading；
- [ ] 移动端（390×844）：全域总览、抽屉、底部信息卡、FAB 正常；
- [ ] 顶栏「国贸 CBD」/「全域视角」切换，相机高度 15km 阈值处路网/标签正确切换；
- [ ] `Esc` 关闭信息窗/图层面板/数据说明；`R` 复位；`L` 图层面板；
- [ ] 浏览器控制台无 Cesium 警告（WebGL 性能警告除外）。

---

## 9. 部署

- 构建：`vite build`，`base: './'`；
- Cesium 运行时资源由自定义插件 `cbd-cesium-runtime` 在 build 结束后复制到 `dist/cesium/`；开发时 middleware 直接读 `node_modules/cesium/Build/Cesium`；
- `index.html` 内联脚本计算 `CESIUM_BASE_URL = new URL('./cesium/', document.baseURI)`，因此 `/demos/cbd-digital-twin/` 等任意子路径都能工作；
- 数据文件（`public/data/`）与模型（`public/models/`）原样进入 `dist/`，不需要服务端；
- 建议服务器为 `.glb` 设置 `model/gltf-binary`、`.json` 设置 `application/json`、`.wasm` 设置 `application/wasm`；开启 gzip/brotli 后 Cesium chunk 约 1.38 MB。
