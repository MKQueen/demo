# CBD 数字孪生数据管线 · OSM → 3D Tiles 白模 / GeoJSON / 暗色底图

> 一条命令把 OpenStreetMap（BBBike 北京 extract）变成 Cesium 1.147 可直接静态加载的
> **3D Tiles 1.1 白模**、**可通车路网**、**水系/绿地/landuse**、**暗色栅格底图** 和一份
> 描述全部内容的 `meta.json`。全流程无第三方 GIS 依赖（不依赖 Cesium / pyproj / GDAL）。

---

## 1. 产物清单

输出目录：`apps/cbd-digital-twin/public/data/`（可 `--out` 覆盖）

| 文件 | 大小 | 内容 | 几何 |
| --- | --- | --- | --- |
| `meta.json` | 9.9 KB | 数据源/ODbL、bbox、原点、统计、height 模型、basemap 矩形、排除地标、自检结果 | — |
| `roads.geojson` | 356 KB | 1398 条可通车道路（RDP 0.5 m 抽稀，6768 → 5085 点） | LineString |
| `context.geojson` | 172 KB | 398 个面：park 196 / block 193 / water 9 | Polygon |
| `railways.geojson` | 100 KB | 314 条铁路/地铁（rail 295 / subway 19） | LineString |
| `buildings-fallback.geojson` | 228 KB | core 内 700 栋建筑面（按高度×面积优选，3D Tiles 失败时兜底） | Polygon |
| `basemap.jpg` | 449 KB | 2560×1772 暗色栅格底图（默认范围 bbox，q82） | 栅格 |
| `tiles/white-models/tileset.json` | 797 B | 3D Tiles 1.1 根 tileset（ENU→ECEF transform + box） | — |
| `tiles/white-models/white-models.glb` | **2.62 MB** | 4320 栋白模：71,187 顶点 / 62,546 三角形（单文件 <4 MB） | glTF 2.0 |

合计约 **3.9 MB**。全部为静态文件，不需要后端，`public/` 下即可被 Vite 直接托管。

默认常量（`build-city-data.py` 顶部集中定义，改这里即可换区域）：

```
BBOX      = 116.430, 39.885, 116.495, 39.930   # west, south, east, north
CORE_BBOX = 116.448, 39.900, 116.478, 39.918   # core（fallback 用）
ORIGIN    = 116.4610, 39.9080, 0.0             # 白模 ENU 原点
```

---

## 2. 快速开始

### 依赖

- **Python 3.10+**（标准库即可；`Pillow` 仅用于生成 `basemap.jpg`，缺失时自动跳过并 warning）
- 可选：Node 18+（跑 `tools/verify-glb.mjs` 结构校验）
- 无需 Cesium、GDAL、pyproj、shapely、numpy（`numpy` 仅在生成底图暗角时可选使用）

macOS 自带 `python3` 可能没有 Pillow，可以用 bundled 运行时（含 Pillow/numpy）：

```bash
/Users/one/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3 -V
# 或自行安装： python3 -m pip install pillow
```

### 三种输入模式（产物逐字节一致）

```bash
cd apps/cbd-digital-twin

# A. 已有预处理的 bbox 内 GeoJSON（秒级，最常用）
python3 tools/build-city-data.py --input /tmp/cbd-data/osm-filtered.geojson

# B. 从 BBBike 原始 .osm.gz 流式解析（可复现全流程，48MB，约 15s）
python3 tools/build-city-data.py --osm-gz /tmp/Beijing.osm.gz

# C. 自动下载 BBBike extract 再解析（首次需要网络，约 48MB）
python3 tools/build-city-data.py --download
```

省略数据源参数时，脚本会依次尝试 `/tmp/cbd-data/osm-filtered.geojson`、
`tools/source/osm-filtered.geojson`、`tools/source/Beijing.osm.gz`。

> 想把中间数据固定到仓库里，可把 2.5 MB 的过滤结果复制到 `tools/source/osm-filtered.geojson`
> （脚本会自动发现；**不要**把原始全量 geojson 放进 `public/data`，那是最终静态产物目录）。

### 校验（不重新生成数据）

```bash
python3 tools/build-city-data.py --verify-only     # GLB / tileset / GeoJSON / meta 自洽
node tools/verify-glb.mjs                          # 零依赖 GLB + tileset 结构校验
```

### 常用参数

| 参数 | 说明 |
| --- | --- |
| `--input GEOJSON` / `--osm-gz OSM.GZ` / `--download` | 数据源三选一 |
| `--out DIR` | 输出目录，默认 `<app>/public/data` |
| `--origin LON,LAT` | 白模 ENU 原点，默认 `116.4610,39.9080` |
| `--skip-basemap` | 跳过底图（无 Pillow 环境） |
| `--skip-verify` | 跳过生成后的自检 |
| `--verify-only` | 只校验已有产物 |

---

## 3. 处理流程

```
 BBBike Beijing.osm.gz (≈48 MB)
        │  gzip + ElementTree.iterparse 流式解析（不用第三方库）
        ▼
 ① bbox 过滤      node/way 过滤：building / highway / landuse / leisure / natural / waterway / railway
        │          closed way → Polygon，其余 → LineString
        ▼
 ② 分类           building → 白模/兜底；highway → roads；landuse/leisure/natural → context；
        │          railway → railways；waterway 线不进入 context（面状才是合法图层）
        ▼
 ③ 几何处理       环清理（去重复/共线点）→ bbox 裁剪（Sutherland–Hodgman / Liang–Barsky）
        │          → RDP 抽稀 0.5 m（道路）
        ▼
 ④ 高度模型       height → building:levels×3.2+1.2 → 类型默认；面积/退化/地标半径过滤
        │
        ├── ⑤ 白模几何   耳切三角化 footprint → 挤出（墙 2n 顶点 + 屋顶 n 顶点）
        │                  → glTF 2.0 Y-up 顶点 (east, up, −north) + 顶点色
        │                  → .glb（JSON+BIN chunk，4 字节对齐）
        ├── ⑥ tileset     root.transform = ENU→ECEF（列主序）+ box（tile 坐标）+ content.uri
        ├── ⑦ GeoJSON 图层 roads / context / railways / buildings-fallback
        ├── ⑧ basemap     Pillow 经纬度线性映射绘制暗色栅格（2× 超采样 + 暗角）
        └── ⑨ meta.json   统计 / 原点 / transform / basemap 矩形 / ODbL / 自检结果
```

一次完整构建（模式 A，含底图）约 **3 秒**；模式 B 解析 48 MB extract 约 **15 秒**。

---

## 4. 坐标系与 3D Tiles 约定（重要）

### 4.1 三套坐标

| 坐标 | 定义 | 用在哪里 |
| --- | --- | --- |
| WGS84 经纬度 | EPSG:4326，`lon/lat` 度 | 全部 GeoJSON 图层、`meta.bbox`、`basemap.rectangle` |
| 局部 ENU（米） | `x=east, y=north, z=up`，原点 `ORIGIN` | 白模 tile 坐标、`boundingVolume.box` |
| ECEF（米） | WGS84 地心直角坐标 | `root.transform` 平移列 |

转换全程使用 WGS84 椭球公式（`a=6378137, f=1/298.257223563`）自行实现：

```
geodetic(lon,lat,h) → ECEF → 减去原点 ECEF → 投影到 ENU 基向量（east/north/up）
```

ENU 基向量与 Cesium `Transforms.eastNorthUpToFixedFrame` 的定义完全一致：

```
east  = (-sinλ,            cosλ,            0     )
north = (-sinφ·cosλ, -sinφ·sinλ,  cosφ  )
up    = ( cosφ·cosλ,  cosφ·sinλ,  sinφ  )
```

### 4.2 `root.transform`（列主序，16 个数）

```
[east.x, east.y, east.z, 0,
 north.x, north.y, north.z, 0,
 up.x,    up.y,    up.z,    0,
 originEcef.x, originEcef.y, originEcef.z, 1]
```

本数据集实测值（原点 `116.4610, 39.9080, 0`，ECEF `(-2183057.4692, 4386009.7705, 4070155.0796)`）：

```json
"transform": [
  -0.8952378715, -0.4455885473,  0.0, 0.0,
   0.2858703366, -0.5743458919,  0.7670755811, 0.0,
  -0.3418000938,  0.6867151105,  0.6415567418, 0.0,
  -2183057.4692456084, 4386009.770548782, 4070155.079607176, 1.0
]
```

> 校验：用 Cesium 1.147 的 `Matrix4.multiplyByPoint(transform, (0,0,0))` 反算
> 经纬高 = `116.461000, 39.908000, 0.000`，与 `meta.origin` 差 **1.1e-9 m**。

### 4.3 glTF 内容为什么是 Y-up

3D Tiles 1.1 规定 glTF content 为 **Y-up**，运行时自动做 `Y_UP_TO_Z_UP`：
`(x, y, z) → (x, −z, y)`。因此本管线把顶点存成：

```
glTF 顶点 = (east, up, -north)
   ↓ Cesium 自动 Y-up→Z-up
tile 坐标 = (east, north, up)
```

- 三角化/绕序全部在 **tile 坐标 (east, north, up)** 下按右手系构造（逆时针 = 朝外/朝上），
  再经一次纯旋转映射到 glTF，绕序不变。
- `boundingVolume.box` 用 **tile 坐标**：`[cx, cy, cz, hx,0,0, 0,hy,0, 0,0,hz]`，本数据集为
  `[130.411, -53.999, 132.5, 2778.714, 0, 0, 0, 2499.193, 0, 0, 0, 134.5]`。
- `asset.version = "1.1"`，`root.content.uri = "white-models.glb"`，**不需要 b3dm**。

**实测证据**（Cesium 1.147.0 + headless Chromium WebGL2，临时静态服务器）：

| 项目 | 结果 |
| --- | --- |
| `Cesium3DTileset.fromUrl(tileset.json)` | 成功，`tilesLoaded=true` |
| 渲染三角形 | 62,546（= GLB 全部三角形，root content 已加载） |
| transform 原点 vs `meta.origin` | 偏差 1.1e-9 m |
| 页面错误 / 控制台错误 | 无 |
| 视觉 | 白模竖直站立、与 `basemap.jpg` 路网/街区严格对齐（俯视/斜视截图核对） |

> 如果换到**不做 Y-up→Z-up 转换**的引擎，需要给 glTF 根节点补一个绕 X 轴 +90° 的四元数
> `rotation: [0.7071068, 0, 0, 0.7071068]`，此时内容与 `boundingVolume.box` 的 Z-up 语义一致。
> Cesium 会自动转换，**不要**加这个节点旋转。

### 4.4 垂直基准

所有高度为 **WGS84 椭球高**，地面按 `h = 0` 处理，**未做大地水准面改正**（北京地区
EGM96 geoid 约 −9 m 量级）。这样白模、底图、前端程序化地标处在同一基准，相互之间不会错层；
与真实正高相比整体平移同一常数，不影响视觉与相对关系。

---

## 5. 高度模型

优先级（`meta.heightModel.priority`）：

1. **`height` tag**：解析米（支持 `35`、`35 m`、`35.5米`、`120,5`），有效区间 `2 m ~ 800 m`；
2. **`building:levels` × 3.2 + 1.2**（每层 3.2 m，底层/女儿墙附加 1.2 m，与常见 OSM 3D 渲染口径一致），层数有效区间 `1 ~ 200`；
3. **按 `building` 类型的默认值**（见下表，`[lo, hi]` 用 building id 的 MD5 哈希在区间内确定性取值，
   保证同一份数据的重跑结果逐字节一致）。

| building 类型 | 默认高度 (m) | 类型 | 默认高度 (m) |
| --- | --- | --- | --- |
| `office` / `commercial` | [24, 40] | `retail` | 14 |
| `apartments` / `residential` | [18, 22] | `yes` | [10.8, 13.2] |
| `hotel` | [28, 40] | `house` / `detached` / `terrace` | 8 / 9 / 10 |
| `dormitory` | [16, 24] | `shed` / `hut` / `kiosk` | 4 / 3 / 3 |
| `school` / `university` | 12 / 16 | `garage(s)` / `parking` | 8 |
| `hospital` | 25 | `industrial` / `warehouse` / `factory` | 10 / 9 / 11 |
| `government` / `public` | 18 / 16 | `train_station` / `transportation` | 15 / 12 |
| `church` / `temple` / `mosque` | 15 / 12 / 14 | 其他（缺省） | [10.8, 13.2] |

过滤规则：

| 规则 | 阈值 | 说明 |
| --- | --- | --- |
| 最小 footprint 面积 | < 15 m² | 丢弃杂项/退化面（本次 2 个） |
| `building=roof` 且无有效 `height` | — | 雨棚/连廊等丢弃（本次 0 个） |
| 地标排除半径 | 80 m | 中国尊 / 国贸三期A / 国贸三期B / 央视总部 附近体块挖空，避免与前端程序化地标重叠（本次排除 9 个） |

本次统计（4320 栋白模）：

| 高度来源 | 数量 | 高度分布 | 数量 |
| --- | --- | --- | --- |
| `height` | 31 | < 15 m | 3218 |
| `building:levels` | 1996 | 15–30 m | 841 |
| 类型默认 | 2293 | 30–60 m | 171 |
| — | — | 60–100 m | 62 |
| — | — | 100–200 m | 21 |
| — | — | ≥ 200 m | 7 |

> 高点（≥200 m）来自 OSM `height`/层数：最高为 `财富金融中心 265 m`、`三星大厦 260 m`、
> `银泰中心主楼 249.9 m` 等；四个地标体块已在白模中挖空。

### 地标挖空清单（`meta.landmarksExcluded`）

| 地标 | 经纬度 | 半径 | 挖空建筑 id |
| --- | --- | --- | --- |
| 中国尊 CITIC Tower | 116.46014, 39.91157 | 80 m | way/599547918, way/1022407217 |
| 国贸三期A | 116.45230, 39.91092 | 80 m | way/116944490, way/660651177 |
| 国贸三期B | 116.45451, 39.91157 | 80 m | way/660651176, way/916885302 |
| 央视总部 | 116.46470, 39.91470 | 80 m | way/764431834, way/764431835, way/764431836 |

> 注：央视总部主楼在 OSM 中为**未命名 footprint**（无 `name`/`height`/`levels`），
> 因此排除规则按**坐标半径**执行而不是按名称匹配；半径内的 3 个 footprints 被挖空。

---

## 6. 字段字典

> `meta.json` 顶层字段：`source`（字符串）/ `attribution`（字符串）/ `sourceInfo`（结构化来源与 ODbL）/
> `basemap.file`（相对 public 的路径）/ `buildingCount` / `roadCount`，并保留完整的
> `tiles`、`layers`、`stats`、`heightModel`、`landmarksExcluded` 分组——前端只依赖其中一小部分，
> 用 `src/data/meta.ts` 的 `summarizeMeta()` 做容错读取。

所有 GeoJSON 均为 `FeatureCollection`，`CRS = WGS84 (EPSG:4326)`，坐标为 `[lon, lat]`；
顶层带 `bbox: [west, south, east, north]`。**未出现的属性会省略**（减小体积），前端读取时请给默认值。

### `roads.geojson`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | OSM way id（`way/5135897`）；被 bbox 切分的折线会加 `#0/#1` 后缀 |
| `class` | string | `motorway` `trunk` `primary` `secondary` `tertiary` `residential` `unclassified` `living_street` 及其 `_link` 变体 |
| `name` | string? | 中文路名（如 `东三环中路`） |
| `ref` | string? | 道路编号（如 `G102`） |
| `oneway` | string? | `yes` / `-1`（`-1` = 几何方向与通行方向相反） |
| `lanes` | number? | 车道数（取 `lanes` tag 首个整数） |
| `bridge` | string? | 桥梁/立交，值为 `"yes"`（有该 tag 时出现） |
| `tunnel` | string? | 隧道，值为 `"yes"`（有该 tag 时出现） |

只保留可通车等级，`footway/steps/cycleway/path/service/pedestrian` 等全部剔除；
几何经 RDP 0.5 m 抽稀（6768 → 5085 点）。

### `context.geojson`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | OSM way id |
| `kind` | string | `water` \| `park` \| `block` |
| `class` | string | 原始 tag 值：水 `water/park/swimming_pool`…，绿地 `park/garden/grass/wood/pitch/stadium…`，地块 `residential/commercial/retail/industrial/construction/railway…` |
| `name` | string? | 名称（如 `日坛公园`） |

分类规则（顺序判定）：
`natural=water` / `waterway=riverbank|dock|canal` / `leisure=swimming_pool` / `landuse=basin|reservoir` → `water`；
绿地类 `natural`/`leisure`/`landuse` → `park`；其余 `landuse` → `block`。只收面状要素。

### `railways.geojson`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | OSM way id |
| `kind` | string | `rail` \| `subway`（保留 `light_rail/tram/narrow_gauge/monorail/funicular`） |
| `name` | string? | 线路名 |
| `tunnel` / `bridge` | string? | 隧道/桥梁，值为 `"yes"` |

### `buildings-fallback.geojson`

core bbox 内 700 栋（按 `height × √area` 排序取前 700），3D Tiles 加载失败时用
`Cesium.Entity` + `polygon.extrudedHeight` 兜底绘制。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | OSM way id |
| `height` | number | 估算高度（米，与白模同一套算法，已保留 1 位小数） |
| `levels` | number? | `building:levels` 原始层数 |
| `name` | string? | 建筑名 |
| `kind` | string | `building` tag 值（`yes/commercial/office/residential…`） |
| `area` | number | footprint 面积（m²） |

---

## 7. 白模 GLB 内部结构

- **一个 mesh、一个 primitive**（整个城市一次 draw call），`mode = TRIANGLES(4)`；
- 顶点布局（每个 footprint 点 `n` → 3n 顶点）：

| 顶点段 | 数量 | 法线 | 用途 |
| --- | --- | --- | --- |
| 墙底 `b_i` | n | 相邻两墙外法线平均（水平） | 竖向渐变暗色 |
| 墙顶 `t_i` | n | 同上 | 亮色 |
| 屋顶 `r_i` | n | `(0,0,1)` | 屋顶色 |

- 三角化：**耳切法**（自实现，无第三方库）。环先规范化为 CCW，去掉重复/共线点；
  凸耳判定 + 点在三角形内测试，退化/自交时先删零面积顶点、最后回退扇形三角化兜底。
  墙面绕序 `(b_i, b_j, t_j)` / `(b_i, t_j, t_i)` 保证外法线朝外；屋顶继承 CCW → 法线朝上。
- 属性：`POSITION`(float32 VEC3，带 min/max) / `NORMAL`(float32 VEC3) /
  `COLOR_0`(normalized ubyte VEC4) / `indices`(UNSIGNED_INT，71k 顶点超 16-bit 上限)；
- 颜色：按高度三档（<24 m / 24–80 m / ≥80 m）的近白偏冷灰，叠加 building id 哈希微调 ±0.028、
  竖向明度渐变（墙底 ×0.88）、屋顶 ×1.02；共 229 种顶点色；
- 材质：`metallicFactor=0.05`、`roughnessFactor=0.72`、`emissiveFactor=[0.02,0.026,0.045]`、
  `doubleSided=true`（防绕序瑕疵导致面片消失，白模无室内代价可忽略）；
- 体积：`2.62 MB`（<4 MB 上限），若超限脚本会按 `height×√area` 升序确定性裁剪后再写。

---

## 8. basemap 绘制与对齐

- 尺寸 `2560 × 1772`：`height = width × (north−south)/(east−west) = 2560 × 0.045/0.065 ≈ 1772`，
  即**经纬度等比例线性映射**（不是等米制），这样 PNG/JPEG 像素与经纬度严格线性对应；
- 像素映射：`x = (lon−west)/(east−west) × width`，`y = (north−lat)/(north−south) × height`；
- 绘制顺序：背景 `#05080e` → landuse 暗蓝块 → 公园暗绿 → 水系暗蓝 → 建筑脚印 `#141d27`
  → 道路按等级 `#1a2938` / `#27465a` / `#3b657c`；
- 2× 超采样后 Lanczos 降采样（得到抗锯齿边缘），再叠加椭圆暗角，JPEG q82 progressive；
- 体积 449 KB < 1.5 MB 上限；`meta.basemap.rectangle = [116.430, 39.885, 116.495, 39.930]`。

前端对齐方式（`Cesium.Rectangle` 与影像矩形完全一致，经纬度线性映射 ⇒ 无需重投影）：

```ts
const bm = meta.basemap!;
viewer.imageryLayers.addImageryProvider(new Cesium.SingleTileImageryProvider({
  url: `${base}${bm.path}`,                              // data/basemap.jpg
  rectangle: Cesium.Rectangle.fromDegrees(...bm.rectangle), // [w, s, e, n]
}));
```

---

## 9. 精度声明与已知局限

| 项目 | 说明 |
| --- | --- |
| OSM 数据质量 | footprint 由社区绘制，存在简化、偏移、缺失；建筑高度绝大多数为估算（本次 4320 栋中仅 31 栋有真实 `height`） |
| 垂直基准 | WGS84 椭球高、地面 0 m，**无大地水准面改正**（北京 geoid 约 −9 m 量级，整体平移，不影响相对关系） |
| 无地形 | 平原区域，未引入 DEM；ground 为椭球面 |
| 道路抽稀 | RDP 0.5 m，几何误差 ≤ 0.5 m，仅影响长直线段中间的冗余点 |
| 底图分辨率 | 2560 px / 0.065° ≈ **2.17 m/px**，适合中远视角底图，近景会有像素感 |
| 白模覆盖 | **全 bbox**（4320 栋），不是只做 core：单文件仍 2.62 MB < 4 MB，且避免 core 边界出现"半截城市" |
| 地标挖空 | 4 地标 80 m 半径内 9 个体块被挖空；如果前端地标模型缺失，会出现空洞（可用 fallback/程序化模型补） |
| 单 tile 无 LOD | 只有 root + 一个 content，全量常驻显存；62.5k 三角形对现代 GPU 可忽略（实测 Cesium 一帧全渲染无压力） |
| 时相 | BBBike extract 日期 `2026-10-31`（`meta.sourceInfo.extractDate`） |

---

## 10. ODbL 归属（必须保留）

本目录数据由 OpenStreetMap 数据加工而来：

> © OpenStreetMap contributors, **ODbL 1.0**
> - 版权页：<https://www.openstreetmap.org/copyright>
> - 许可证全文：<https://opendatacommons.org/licenses/odbl/1-0/>
> - extract 来源：<https://download.bbbike.org/osm/bbbike/Beijing/>

`meta.json` 中已写入 `sourceInfo.license / licenseUrl / attribution / attributionHtml`，
顶层另有 `source`（可展示的源字符串）与 `attribution`（一行署名），
`basemap` 也带 `attribution`。按 ODbL 要求，前端展示时需保留「© OpenStreetMap contributors」
署名（Cesium 的 credit 容器即可），衍生数据（本目录产物）需以 ODbL 兼容方式提供。

---

## 11. 校验方法

```bash
# 1) 生成后自检（脚本默认执行）
python3 tools/build-city-data.py --verify-only
#   - GLB: magic/version/length、chunk 4 字节对齐、JSON 可解析、buffer 长度、
#          bufferView 对齐/越界、accessor count、POSITION min/max 实测覆盖、索引范围、NORMAL 单位性
#   - tileset: asset.version=1.1、transform 16 数且正交归一(det=+1)、box 覆盖 GLB 顶点（Y-up→Z-up）、content.uri 存在
#   - GeoJSON: 顶层类型/几何类型/可解析
#   - meta: transform 与 origin 自洽（本次偏差 4.06e-11）

# 2) 零依赖 Node 校验
node tools/verify-glb.mjs
node tools/verify-glb.mjs --data public/data

# 3) 真实引擎冒烟（已在本机验证）
#    Cesium 1.147.0 + headless Chromium WebGL2，Cesium3DTileset.fromUrl(tileset.json) →
#    tilesLoaded=true、62,546 三角形渲染、无页面错误、与 basemap 对齐
```

可复现性：分别用 `--input osm-filtered.geojson` 与 `--osm-gz Beijing.osm.gz` 构建，
除 `meta.json`（含时间戳）以外的 **7 个产物逐字节一致**（sha256 相同）。

---

## 12. 换区域 / 调参

改脚本顶部常量即可：

| 常量 | 作用 |
| --- | --- |
| `BBOX` / `CORE_BBOX` | 数据范围 / core 范围 |
| `ORIGIN` | ENU 原点（建议取场景中心，减小 float32 精度损失：±3 km 内约 0.4 mm） |
| `LANDMARKS` | 需要挖空的地标（坐标 + 半径） |
| `DEFAULT_HEIGHTS` | 各 `building` 类型默认高度 |
| `LEVEL_HEIGHT_M` / `GROUND_EXTRA_M` | 层高模型参数 |
| `DRIVABLE_CLASSES` / `ROAD_SIMPLIFY_TOL_M` | 道路等级过滤 / 抽稀容差 |
| `TIER_COLORS` / `WHITE_MODEL_MATERIAL` | 白模配色 / 材质 |
| `BASEMAP_*` | 底图尺寸、配色、线宽、JPEG 质量 |

换城市时同步改 `BBBike_URL` 与 `EXTRACT_LABEL`（BBBike 覆盖 200+ 城市）。
