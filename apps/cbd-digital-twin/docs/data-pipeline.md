# 数据管线说明（data-pipeline）

本 Demo 的所有「真实数据」由 `tools/build-city-data.py` 从 OpenStreetMap 生成，
静态落在 `public/data/` 下，前端按 URL 直接加载。**运行时不依赖任何后端/瓦片服务/第三方地理数据。**

- 数据生产与算法细节（高度模型、坐标系、字段字典、精度声明）：见 [`../tools/README.md`](../tools/README.md)
- 本文件面向**前端接入**：数据流、加载方式、性能预算、失败回退与更新流程。

---

## 1. 数据流

```
 BBBike Beijing extract (.osm.gz, ODbL)
        └─ tools/build-city-data.py
             ├─ public/data/meta.json                     ← 唯一事实来源（尺寸/统计/原点/矩形）
             ├─ public/data/basemap.jpg                   ← 暗色底图（rectangle=[w,s,e,n]）
             ├─ public/data/roads.geojson                 ← 可通车道路（LineString，发光路网）
             ├─ public/data/context.geojson               ← 水/绿地/地块（Polygon）
             ├─ public/data/railways.geojson              ← 铁路/地铁（LineString）
             ├─ public/data/buildings-fallback.geojson    ← 3D Tiles 失败时兜底（core ≤700）
             └─ public/data/tiles/white-models/
                  ├─ tileset.json                         ← 3D Tiles 1.1（ENU→ECEF transform）
                  └─ white-models.glb                     ← 4320 栋白模（62.5k 三角形）
```

`meta.json` 是前端唯一需要硬编码的入口，其它资源的路径、尺寸、矩形、原点都从它读取。

---

## 2. 前端加载（Cesium 1.147）

坐标全部是 WGS84 经纬度 / 由 `meta` 给出的 ENU 原点，**无需任何重投影**。
注意 Vite `base: './'`：静态资源 URL 用 `import.meta.env.BASE_URL` 拼相对路径。

### 2.1 一次性读 meta

```ts
const base = import.meta.env.BASE_URL;                       // './' 或 '/demos/cbd-digital-twin/'
const meta = await (await fetch(`${base}data/meta.json`)).json();
const D = (p: string) => `${base}${p}`;                      // meta 中的 path 形如 'data/xxx'
```

### 2.2 底图（暗色栅格，贴椭球面）

```ts
const bm = meta.basemap;
viewer.imageryLayers.addImageryProvider(new Cesium.SingleTileImageryProvider({
  url: D(bm.path),
  rectangle: Cesium.Rectangle.fromDegrees(...bm.rectangle),   // [west, south, east, north]
}));
viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#05080e');
```

### 2.3 白模（核心 3D Tiles 1.1）

```ts
const tileset = await Cesium.Cesium3DTileset.fromUrl(D(meta.tiles.whiteModels.tileset), {
  maximumScreenSpaceError: 8,
  showOutline: false,
});
viewer.scene.primitives.add(tileset);
await viewer.zoomTo(tileset);          // 或自行 flyTo 到 core 区域
```

- 白模是**全 bbox（≈6.5 × 5 km）**的 4320 栋，`zoomTo(tileset)` 会框到整个数据范围；
  若希望开场更聚焦 CBD core，可改用 `viewer.camera.flyTo` 到
  `meta.coreBbox` 附近（飞行结束点建议 `lon=116.452, lat=39.899, height=1500` 一带，俯角约 −30°）。
- 需要更"暗色数字孪生"的观感时，可用 `Cesium3DTileStyle` 压暗颜色，
  或调整 `scene.light`（`DirectionalLight`）强度。白模本身已是近白偏冷灰 + 轻微自发光。
- 白模中没有中国尊/国贸三期A/B/央视总部（80 m 半径挖空，见 `meta.landmarksExcluded`），
  这四个位置由程序化地标模型填充。

### 2.4 路网（发光线条）

```ts
const ds = await Cesium.GeoJsonDataSource.load(D(meta.layers.roads.path));
viewer.dataSources.add(ds);
// 按 class 分色/分宽：motorway/trunk/primary 亮、secondary/tertiary 中、residential 暗
```

建议用 `viewer.entities` 的 `polyline` + `clampToGround`（或 `heightReference`）贴合椭球面；
`bridge/tunnel` 属性（值为字符串 `"yes"`）可用来做抬升/压暗。可参考 `basemap.jpg` 的配色保持一致：
`#3b657c`（快速路/主干）、`#27465a`（次干/支路）、`#1a2938`（街坊路）。

### 2.5 水系 / 绿地 / 地块（context）

```ts
const ctx = await Cesium.GeoJsonDataSource.load(D(meta.layers.context.path));
// polygon.material：water=#0a2740、park=#0d2418、block=#0b1420（可加透明度叠在底图上）
```

### 2.6 铁路 / 地铁（可选）

```ts
await Cesium.GeoJsonDataSource.load(D(meta.layers.railways.path));
```

### 2.7 3D Tiles 失败回退（重要）

白模加载失败（`fromUrl` reject 或 `tileset.readyPromise` 超时）时，用
`buildings-fallback.geojson` + `extrudedHeight` 兜底，至少保留 CBD 天际线：

```ts
try {
  const tileset = await Cesium.Cesium3DTileset.fromUrl(D(meta.tiles.whiteModels.tileset));
  viewer.scene.primitives.add(tileset);
} catch (e) {
  console.warn('[cbd] 3D Tiles 加载失败，回退 buildings-fallback.geojson', e);
  const fb = await Cesium.GeoJsonDataSource.load(D(meta.layers.buildingsFallback.path));
  for (const ent of fb.entities.values) {
    const h = ent.properties?.height?.getValue() ?? 12;
    ent.polygon = new Cesium.PolygonGraphics({
      hierarchy: ent.polygon?.hierarchy,
      extrudedHeight: h,
      height: 0,
      material: Cesium.Color.fromCssColorString('#e6e9ee'),
      outline: false,
    });
  }
  viewer.dataSources.add(fb);
}
```

`meta.layers.buildingsFallback` 同样给出 `bbox`（core）与 `count`。

---

## 3. 性能预算

| 资源 | 体积 | 说明 |
| --- | --- | --- |
| 白模 GLB | 2.62 MB | 单 tile，62,546 三角形，首次进入一次性下载；`maximumScreenSpaceError` 8 时全量常驻 |
| 底图 JPEG | 449 KB | 2560×1772，单张，Cesium 一次贴图 |
| roads.geojson | 356 KB | 1398 条线 / 5085 点，`GeoJsonDataSource` 加载 <100 ms |
| context.geojson | 172 KB | 398 个多边形 |
| railways.geojson | 100 KB | 314 条线 |
| buildings-fallback.geojson | 228 KB | 仅在回退时加载（建议懒加载） |
| 合计（不含回退） | **≈ 3.7 MB** | 本地 dev 无感；静态托管也足够轻 |

- 白模为**单 primitive**，一次 draw call，GPU 开销可忽略（实测全量渲染无压力）。
- 路网若用 `GeoJsonDataSource` 生成上千个 `Entity`，建议合批（custom primitive / `PolylineCollection`），
  或在低性能设备上按 `class` 只渲染主干。
- 底图为 2.17 m/px，建议相机高度 < 5 km 时不要过度放大底图（会糊）；近景以白模+路网为主。

---

## 4. 已知风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| glTF Y-up 语义 | 若引擎不做 Y-up→Z-up，白模会"躺平" | 数据按 Cesium 规范生产（`glb=(east,up,−north)`），Cesium 1.147 实测正确；换引擎需给根节点补 +90° X 旋转（见 tools/README §4.3） |
| 3D Tiles 加载失败 | 城市空白 | ①`buildings-fallback.geojson` 兜底；②若还失败，用 `context.geojson` 地块 + 程序化地标至少保留轮廓 |
| 底图与矢量错位 | 视觉错位 | 全部图层共用同一 `bbox` 与经纬度线性映射；底图 `rectangle` 必须用 `meta.basemap.rectangle`，不要在 Cesium 里再改 |
| 地标空洞 | 4 个地标位置缺体块 | 前端必须放置程序化地标模型；坐标系用 `meta.origin`/`transform` 同一 ENU 基准，勿用经纬度硬编码高度 |
| 高度为估算 | 个别楼高失真（如 `building=yes` 统一 ~12 m） | 属预期；`meta.heightModel` 记录规则，`heightSourceCounts` 可查询 |
| ODbL 合规 | 版权风险 | 保留 `© OpenStreetMap contributors` 署名（Cesium credit 容器 / 页面 footer） |

---

## 5. 更新数据的流程

```bash
# 1) （可选）下载最新 BBBike 北京 extract
curl -L -o /tmp/Beijing.osm.gz https://download.bbbike.org/osm/bbbike/Beijing/Beijing.osm.gz

# 2) 重新生成全部产物（约 15s；含内置自检）
cd apps/cbd-digital-twin
python3 tools/build-city-data.py --osm-gz /tmp/Beijing.osm.gz --extract-date 2026-10-31

# 3) 独立校验
python3 tools/build-city-data.py --verify-only
node tools/verify-glb.mjs
```

产物写入 `public/data/`，Vite dev server 会热更新静态资源；刷新页面即可看到新数据。
无需改动 `src/`（前端只依赖 `meta.json` 的路径约定与字段）。

---

## 6. 与主工程的分工

| 归属 | 内容 |
| --- | --- |
| 本数据管线（本目录 + `tools/`） | `public/data/**`、`tools/**`、`docs/data-pipeline.md` |
| 主工程（Lead） | `src/**`、`index.html`、`package.json`、`vite.config.ts`、程序化地标模型（`public/models / public/tiles`） |

约定：前端**不硬编码**数据尺寸/坐标，全部从 `meta.json` 读取；
若需要新增数据图层（如 POI），优先扩展 `build-city-data.py` 并同步更新 `meta.layers`。
