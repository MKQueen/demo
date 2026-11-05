# 朝阳区全域低模数据（district）

把「国贸 CBD Demo」从 CBD 精细范围扩展为「整个朝阳区」所需的数据资产。
与现有 `public/data/`（CBD 精细白模 / 道路 / POI）**并行叠加使用**，互不覆盖：

- 原有 CBD 精细数据保持不动（`public/data/*`、`public/data/tiles/white-models/`）；
- 新增数据全部在 `public/data/district/`，覆盖朝阳区行政边界（465.5 km²）；
- 两套数据的 ENU 原点、垂直基准、经纬度约定完全一致，可直接叠在同一个 `Viewer` 里。

```
public/data/district/
├── boundary.geojson                         # 朝阳区行政边界（MultiPolygon，2 环 / 1203 点）
├── basemap.jpg                              # 3072×3137 暗色底图（经纬度线性映射）
├── roads.geojson                            # 全域干路（扣除 CBD 精细 bbox）
├── context.geojson                          # 大公园 / 水系
├── meta.json                                # 前端唯一入口（Lead 指定 schema）
└── tiles/district-massing/
    ├── tileset.json                         # 3D Tiles 1.1，root.transform = ENU→ECEF
    └── district-massing.glb                 # EXT_mesh_gpu_instancing 低模 box（20,059 实例）
```

| 文件 | 大小 | 内容 |
| --- | --- | --- |
| `district-massing.glb` | 788 KB | **20,059 实例** / 240,708 三角形（每实例 12 三角的单位 box） |
| `tileset.json` | 491 B | 3D Tiles 1.1，`asset.version="1.1"`，content 指向 glb |
| `basemap.jpg` | 852 KB | 3072×3137，q82，覆盖边界 bbox + 0.008° padding |
| `roads.geojson` | 1.75 MB | 7,632 条干路（RDP 2.5 m，扣除 CBD 精细 bbox） |
| `context.geojson` | 376 KB | 629 个面（公园 ≥5 万 m² / 水系 ≥1000 m²） |
| `boundary.geojson` | 29 KB | 朝阳区 MultiPolygon（1029 + 174 点） |
| `meta.json` | 4 KB | 统计 / 原点 / 轴向 / basemap 矩形 / ODbL |

全量新增约 **3.8 MB**（预算 15 MB，glb 预算 8 MB）。

---

## 1. 复现命令

```bash
cd apps/cbd-digital-twin

# 完整重跑（解析 48MB OSM extract ≈ 25s，全流程 ≈ 1 分钟）
python3 tools/build-district-data.py \
  --osm-gz /tmp/Beijing.osm.gz \
  --boundary /tmp/chaoyang-boundary.geojson

# 参数
#   --out DIR             输出目录（默认 <app>/public/data/district）
#   --cache FILE.pkl      解析缓存（开发期加速，可选；不影响产物一致性）
#   --skip-basemap        无 Pillow 环境时跳过底图
#   --verify-only         只校验已有产物，不重新生成
```

无 Pillow 时脚本会跳过 basemap 并 warning（其余产物不受影响）；无 numpy 时点在多边形自动降级为纯 Python（慢一些，结果一致）。
macOS 自带 python3 可能没有 Pillow，推荐使用 bundled Python：

```bash
/Users/one/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3 \
  tools/build-district-data.py --cache /tmp/district-parse.pkl
```

数据源：

- OSM：`https://download.bbbike.org/osm/bbbike/Beijing/Beijing.osm.gz`（BBBike Beijing extract，本产物基于其 2026-10 版本解析）
- 行政边界：OSM relation 2988933（朝阳区，MultiPolygon 2 环：主体 + 首都机场飞地）

---

## 2. 坐标系与轴向（前端接入重点）

### 2.1 ENU 原点与 transform

- 原点沿用 CBD：`lon=116.4610, lat=39.9080, h=0`，ECEF `(-2183057.4692, 4386009.7705, 4070155.0796)`；
- `tileset.root.transform` 为 **ENU→ECEF 4×4 列主序 16 数**，与 Cesium `Transforms.eastNorthUpToFixedFrame` 完全一致：

```
transform = [
  east.x, east.y, east.z, 0,
  north.x, north.y, north.z, 0,
  up.x, up.y, up.z, 0,
  originEcef.x, originEcef.y, originEcef.z, 1
]
```

- tile 坐标：`x=east, y=north, z=up`（米）；`root.boundingVolume.box` 用 tile 坐标：

```json
[2466.354, 4772.800, 96.959, 11834.183, 0, 0, 0, 15234.408, 0, 0, 0, 139.375]
```

### 2.2 glTF content 轴向（Y-up）

3D Tiles 1.1 的 glTF content 为 **Y-up**，Cesium 加载时自动做 `Y_UP_TO_Z_UP： (x,y,z) → (x,-z,y)`。
本数据的单位 box 直接按 glTF 坐标存储：

```
glTF:  x = east, y = up, z = -north        （Cesium 自动转换后 tile = east/north/up）
unitBox: x∈[-0.5,0.5], y∈[0,1], z∈[-0.5,0.5]   （底面在 y=0，高 1）
```

### 2.3 EXT_mesh_gpu_instancing 实例语义

每个实例的变换在 **glTF 节点空间** 中应用，语义与 glTF node 的 TRS 相同：

```
vertex_world(gltf) = TRANSLATION * ROTATION * SCALE * unitBoxVertex
```

| 属性 | 类型 | 本数据含义 |
| --- | --- | --- |
| `TRANSLATION` | VEC3 float | `(east, up_ground, -north)`：建筑 OBB 中心的 ENU 坐标（glTF 轴序） |
| `ROTATION` | VEC4 float | 绕 glTF **+Y（即 up）** 的航向四元数 `(0, sin(θ/2), 0, cos(θ/2))`，θ = footprint 长轴相对东向的逆时针角 |
| `SCALE` | VEC3 float | `(footprint 长, 高度, footprint 宽)`，即 `x→长、y→高、z→宽` |

> **前端不需要任何额外设置**：Cesium 1.147 直接执行上述语义（内部用
> `Matrix4.fromTranslationQuaternionRotationScale` 构造实例矩阵，再乘含 Y-up→Z-up 的 modelMatrix）。

**up_ground 含地球曲率**：`TRANSLATION.y` 不是常数 0，而是「该点 WGS84 椭球高 0」的 ENU up 分量。
ENU 是切平面，距原点 d 米处的地面会下沉约 `d²/(2R)`：d=10 km 约 −7.8 m，d=20 km 约 −31.4 m。
本数据逐建筑计算该值（取 footprint 顶点 up 均值），因此远处体块的**底面正好贴着椭球面/底图**，不会悬空。

- 若前端自行把实例重新放到 `Cesium.Cartesian3.fromDegrees(lon, lat, 0)`（例如做点击定位），
  用经纬度即可，不需要加曲率修正（Cesium 的 fromDegrees 已按椭球面计算）；
- 只有当你手动用 ENU `(east, north, 0)` 去算位置时，才需要补 `u_ground ≈ -(e²+n²)/(2R)`。

**旋转**：box 是 footprint 的最小面积包围矩形（OBB，长宽比通常 ≠1），rotation 决定朝向；
如果某个引擎忽略 ROTATION，长条形建筑会退化成东西/南北走向（视觉上街区走向错乱），
Cesium 1.147 实测旋转正常（望京斜向街区可验证）。

### 2.4 垂直基准

全部数据按 **WGS84 椭球高**、地面 `h=0` 处理，未做大地水准面改正；
与 CBD 精细白模、程序化地标同一基准，叠加时不会错层。

---

## 3. 前端接入（Cesium 1.147）

```ts
const base = import.meta.env.BASE_URL;
const meta = await (await fetch(`${base}data/district/meta.json`)).json();
const D = (p: string) => `${base}${p}`;

// 1) 底图（含 0.008° padding 的 rectangle）
viewer.imageryLayers.addImageryProvider(new Cesium.SingleTileImageryProvider({
  url: D(meta.basemap.file),                                  // data/district/basemap.jpg
  rectangle: Cesium.Rectangle.fromDegrees(...meta.basemap.rectangle),
}));

// 2) 实例化低模体块
const massing = await Cesium.Cesium3DTileset.fromUrl(
  D(meta.tiles.massing.tileset),
  { maximumScreenSpaceError: 16, dynamicScreenSpaceError: true },
);
viewer.scene.primitives.add(massing);
// 可选：统一提亮/染色（不透明色最稳，见下方接入注意点 1）
massing.style = new Cesium.Cesium3DTileStyle({ color: "color('#e8f4ff')" });

// 3) 边界（可选：描边 / 相机范围）
const boundary = await Cesium.GeoJsonDataSource.load(D(meta.boundary.file));

// 4) 干路（与 CBD 精细 roads.geojson 叠加；CBD bbox 内已剔除，不重复）
const roads = await Cesium.GeoJsonDataSource.load(D(meta.roads.file));

// 5) 大公园/水系
const context = await Cesium.GeoJsonDataSource.load(D(meta.context.file));
```

**接入注意点**

1. **透明度**：`Cesium3DTileStyle` 的 `color` 若带 alpha < 1，整块内容会进入半透明渲染通道。
   - 实测：district massing（instanced，0.96 alpha）在 1.4k–26k m 视距下**未见明显伪影**，与不透明差异很小；
   - 但现有 CBD `white-models`（合并 mesh，0.96 alpha）在近景会出现内部排序伪影（ghosting）；
   - 建议两套数据统一用 **alpha=1 的不透明色**，稳定性最好；需要通透感时用 `layer.brightness`、
     场景雾或材质 emissive 替代。
2. **单瓦片无 LOD**：整个区只有 1 个 tile（240,708 三角形 / 20,059 实例 / 3 个 draw call：低/中/高三档材质），
   加载即全量常驻显存；对现代 GPU 可忽略，移动端可按需 `massing.show = false`。
3. **与 CBD 精细白模的分工**：massing 已扣除 CBD 精细 bbox `[116.430, 39.885, 116.495, 39.930]`，
   CBD 内由原有 `white-models` 精细白模呈现，二者不重叠；切换视图时无需隐藏小范围白模。
4. **Cesium 统计口径**：`tileset.statistics.numberOfTrianglesSelected` 对 instanced content
   只统计基础几何（= 36 = 3 档 × 12 三角），**不是** 240,708；真实三角形数请看
   `meta.tiles.massing.triangles`（= instances × 12）。用 `numberOfTilesWithContentReady`
   判断内容是否就绪。
5. **相机范围**：朝阳区南北约 33.5 km、东西约 25.1 km；`meta.center` 为边界面积加权质心
   （116.5094, 39.9524），`meta.boundaryBbox` 为外接矩形，适合做总览/复位视角。
6. **底图对齐**：底图按经纬度线性映射绘制（`x=(lon-west)/(east-west)*width`，
   `y=(north-lat)/(north-south)*height`），与矢量/3D 使用同一个 `rectangle`，无需重投影。

---

## 4. 数据过滤规则

### 4.1 建筑（massing 实例）

| 步骤 | 规则 | 本次结果 |
| --- | --- | --- |
| 1 | 解析 extract 中所有 `building` way，坐标齐备且 ≥3 点 | 112,218 → 112,218 |
| 2 | footprint 质心落在朝阳区边界内（MultiPolygon 点在多边形，含机场飞地） | **24,251** |
| 3 | footprint 面积 ≥ 20 m² | 24,145（-52 面积过小，-54 roof 无高度） |
| 4 | 高度有效（height → levels → 类型默认，≥2 m） | 同上 |
| 5 | 质心不在 CBD 精细 bbox 内 | **20,059** ← massing 实例数 |

> **注意数据量**：任务背景里「扩展 bbox 内 112,218 条 building way」是**整个 extract** 的数量；
> 实际落在朝阳区边界内的建筑只有 24,251 条（OSM 在北京的覆盖不完整），扣除 CBD bbox 后
> massing 实例为 20,059 —— 少于预期的 7–12 万，这是 OSM 数据现状，不是过滤过度。
> 如果后续要提升密度，需要换更完整的建筑数据源（如官方测绘/高德/百度等有授权数据），
> 或引入 `building:part` / 街区级补充，单纯从这份 extract 中榨不出更多。

**高度模型**（与 CBD 精细白模完全一致）：

1. `height` tag（米；支持 `35`、`35 m`、`35.5米`、`120,5`），有效 2–800 m；
2. `building:levels × 3.2 + 1.2`，层数 1–200；
3. 按 `building` 类型默认值（`office/commercial` 24–40、`apartments/residential` 18–22、
   `retail` 14、`yes` 10.8–13.2、`hotel` 28–40 等；区间值用 building id MD5 哈希确定性取值）。

本次高度来源：`height` 180 / `levels` 4,228 / 类型默认 19,843。
高度分档（材质）：低 <24 m 18,605 栋、中 24–80 m 1,327 栋、高 ≥80 m 127 栋。

### 4.2 道路（roads.geojson）

- 等级：`motorway/trunk/primary/secondary/tertiary` 及 `_link`；
- 保留条件：任一顶点在朝阳区边界内；
- **剔除**与 CBD 精细 bbox 相交的片段（按线段裁剪，避免与现有 `data/roads.geojson` 重复）；
- RDP 抽稀 2.5 m；
- 属性：`id / class / name / ref`（可选字段缺省省略）。

### 4.3 面要素（context.geojson）

- 只保留 `kind=park|water` 且面积达标的**面**：
  - 公园/绿地 ≥ 50,000 m²（353 → 本次合计 629 面含水系）；
  - 水系 ≥ 1,000 m²；
- 属性：`id / kind / class / name`（可选）；
- RDP 5 m。

### 4.4 底图

- 背景 `#05080e`，区界内 `#070d16`；
- landuse 暗蓝块 `#0b1420`、公园暗绿 `#0d2418`、水系暗蓝 `#0a2740`；
- 建筑脚印 `#1b2632`（≥30 m 的用 `#27363f` 略亮）；
- 道路分三级：`#3b657c`（快速路/主干）/ `#27465a`（次干/支路）/ `#1a2938`（街坊路）；
- 区界描边 `#2c7894`；2× 超采样抗锯齿 + 椭圆暗角；JPEG q82 progressive（852 KB < 3 MB）。

---

## 5. 字段字典

### `meta.json`（前端唯一入口）

| 字段 | 说明 |
| --- | --- |
| `name` / `nameEn` | `朝阳区` / `Chaoyang District` |
| `areaKm2` | 465.5（OSM relation 标注；脚本实测 465.61） |
| `boundaryBbox` | `[west, south, east, north] = [116.3447169, 39.8089821, 116.6392727, 40.1101399]` |
| `center` | 边界面积加权质心 `{lon: 116.509395, lat: 39.952399}` |
| `origin` | ENU 原点 `{lon: 116.461, lat: 39.908, height: 0}`，另附 `originEcef` |
| `transform` / `transformLayout` | ENU→ECEF 列主序 16 数 + 布局说明 |
| `axis` | 轴向/实例语义说明（tile / glTF / instance / unitBox / 前端提示） |
| `basemap` | `{file, rectangle, width: 3072, height: 3137, bytes, pixelMapping}` |
| `counts` | `{buildings: 24145, instances: 20059, roads: 7632, triangles: 240708, buildingsRaw: 24251, buildingsInCbdBbox: 4086, context: 629}` |
| `tiles.massing` | `{tileset, glb, instances, triangles, bytes, tiesetBytes, instancing, tiers[], boundsEnu}` |
| `roads` / `boundary` / `context` | 各图层 `{file, count/points, bytes, ...}` |
| `generatedAt` / `source` / `attribution` / `license` | ISO 时间、`OpenStreetMap · BBBike Beijing extract`、`© OpenStreetMap contributors`、`ODbL 1.0` |
| `cbdExclusionBbox` | 被扣除的 CBD 精细范围 |
| `heightModel` / `stats` / `notes` / `verification` | 高度规则、解析统计、说明、自检结果（errors=0） |

### `boundary.geojson`

FeatureCollection（1 个 MultiPolygon，2 环）：
`properties = {name, name:en, ref: "110105", areaKm2: 465.5, source: "OpenStreetMap relation 2988933", attribution, license}`
顶层 `bbox`。

### `roads.geojson`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | `way/<id>`；被 CBD bbox 切成多段时加 `#0/#1` 后缀 |
| `class` | string | `motorway` … `tertiary`、`*_link` |
| `name` | string? | 路名 |
| `ref` | string? | 道路编号 |

### `context.geojson`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | OSM way id |
| `kind` | string | `park` \| `water` |
| `class` | string | 原始 tag：`park/garden/grass/wood/water/…` |
| `name` | string? | 名称（如「奥林匹克森林公园」） |

### `district-massing.glb`

无业务属性（instancing 不支持逐实例任意属性；如需按建筑拾取/分级，可后续加
`EXT_mesh_features` 或在前端用 `roads/boundary` 近似）。结构见下节。

---

## 6. 实例化 GLB 内部结构

- 1 个 glTF scene、**3 个 node**（按高度三档材质），共享同一份单位 box 几何：
  - `massing-low`（<24 m）18,605 实例，`baseColorFactor ≈ (0.80, 0.83, 0.88)`
  - `massing-mid`（24–80 m）1,327 实例，`≈ (0.87, 0.90, 0.94)`
  - `massing-high`（≥80 m）127 实例，`≈ (0.92, 0.94, 0.97)`
- 每个 node 挂 `extensions.EXT_mesh_gpu_instancing.attributes = {TRANSLATION, ROTATION, SCALE}`，
  且 `extensionsUsed = ["EXT_mesh_gpu_instancing"]`；
- 共享几何 accessors（24 顶点 / 36 索引，flat normals，底面 y=0）；
  实例 accessor：`TRANSLATION` VEC3 float、`ROTATION` VEC4 float、`SCALE` VEC3 float，
  均带 min/max，bufferView 4 字节对齐；
- 材质：`metallicFactor 0.04`、`roughnessFactor 0.78`、`emissiveFactor ≈ (0.018,0.024,0.038)`、
  `doubleSided: false`（box 绕序朝外，已校验）；
- 结构校验：magic/version/length、chunk 4B 对齐、JSON/BIN 可解析、buffer.byteLength、
  bufferView 对齐/越界、accessor 数量与 min/max、索引范围、实例数 == 期望值（脚本内置）。

---

## 7. 校验方式

```bash
# 1) 脚本内置自检（生成后自动执行，也可单独跑）
python3 tools/build-district-data.py --verify-only
#   GLB：magic/version/length、chunk 对齐、JSON 解析、buffer/bufferView/accessor 自洽、
#        EXT_mesh_gpu_instancing 存在、三档实例数一致、索引范围
#   tileset：asset.version=1.1、transform 正交归一 det=+1 且与 ORIGIN 一致、
#            box 覆盖全部实例（含 up 曲率范围）、content.uri 存在
#   GeoJSON：可解析 / FeatureCollection / features 为数组
#   meta：可解析、实例数与 GLB 一致

# 2) 真实引擎冒烟（本机已执行）
#    Cesium 1.147.0 + headless Chromium WebGL2（SwiftShader）：
#      - Cesium3DTileset.fromUrl(district-massing/tileset.json) → tilesLoaded=true
#      - numberOfTilesWithContentReady=1、numberOfTilesSelected=1、numberOfCommands=3
#      - 无 pageerror / console.error
#      - 19 个抽样实例「屋顶中心投影 + scene.pickPosition 反算 ENU」→ 15/19 严格通过，
#        位置误差 ≤1.9 m、高度误差 ≤0.21 m；4 个未通过的是奥林匹克塔同位置嵌套体块
#        （186/201/216/231/246.8 m 五个体块同址，矮的被高的遮挡导致 pick 打到更高屋顶），
#        属 OSM 多层 footprint 数据特性，非轴向/位置问题
#      - 截图：整区总览 / 斜视 / 望京 / 奥林匹克 / CBD / 机场飞地 / 俯视
```

---

## 8. 精度声明与已知局限

| 项目 | 说明 |
| --- | --- |
| 建筑表达 | footprint 的**最小面积包围矩形（OBB）** 挤出 box，不是真实轮廓；面积/朝向为近似 |
| 高度 | 绝大多数为估算（本次仅 180 栋有 `height` tag），仅用于视觉体量；**不可用于测绘/规划/工程量** |
| OSM 覆盖 | 朝阳区内 OSM 建筑 24,251 栋，远少于实际建筑密度；空地不代表真实空地 |
| 多层 footprint | 个别建筑（如奥林匹克塔）在 OSM 中有多层/嵌套 footprint，会生成嵌套 box（视觉上仍是一根塔） |
| 垂直基准 | WGS84 椭球高、地面 0 m，未做大地水准面改正（北京 geoid 约 −9 m 量级，整体平移） |
| 无地形 | 平原区按椭球面处理（含 ENU 曲率项），未引入 DEM |
| 道路 | RDP 2.5 m 误差；仅干路，不含街坊路（底图里画了 minor 道路用于纹理） |
| 底图分辨率 | 3072 px / 0.3126° ≈ **11.3 m/px**，适合总览，近景以 3D 体块/精细 CBD 数据为主 |
| 时相 | BBBike extract 2026-10 版本（`meta.generatedAt` 为脚本生成时间） |
| CBD 空洞 | CBD 精细 bbox 内 massing 为空，由原有精细白模填充；若只加载 district 数据，CBD 处会空缺 |

---

## 9. ODbL 归属（必须保留）

本目录数据由 OpenStreetMap 数据加工而来：

> © OpenStreetMap contributors, **ODbL 1.0**
> - <https://www.openstreetmap.org/copyright>
> - <https://opendatacommons.org/licenses/odbl/1-0/>
> - extract：<https://download.bbbike.org/osm/bbbike/Beijing/>
> - 边界：OSM relation 2988933

`meta.json` 已写入 `source / attribution / license / licenseUrl`；前端展示时保留
「© OpenStreetMap contributors」署名（可并入 CBD Demo 的数据说明面板）。

---

## 10. 性能预算

| 资源 | 体积 | 说明 |
| --- | --- | --- |
| massing glb | 788 KB | 20,059 实例 / 240,708 三角形 / 3 draw call（按档位） |
| basemap.jpg | 852 KB | 3072×3137 单张贴图（Cesium 单张影像，一次上传） |
| roads.geojson | 1.75 MB | 7,632 条线，`GeoJsonDataSource` 加载约 100–200 ms |
| context.geojson | 376 KB | 629 个多边形 |
| boundary.geojson | 29 KB | 1 个 MultiPolygon |
| **合计** | **≈ 3.8 MB** | 远低于 15 MB 预算 |

- 实例化后 GPU 侧只有 3 个 draw call（3 档材质），CPU 侧无逐建筑 Entity，总览视角帧率稳定；
- 若在低端设备仍卡顿，优先降级顺序：`context` → `basemap` 降采样 → `massing.show=false`。
