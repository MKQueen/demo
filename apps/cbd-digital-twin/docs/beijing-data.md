# 北京市全域低模数据（public/data/beijing）

> 为「CBD 数字孪生」扩展「整个北京市」总览视角而生成的静态数据资产。
> 与现有 `public/data/`（CBD 精细白模）和 `public/data/district/`（朝阳区全域）**叠加使用，互不重复**。
> 全部文件由 `tools/build-beijing-data.py` 可复现生成；生成时间与校验结果见 `meta.json.generatedAt` / `meta.json.verification`。

---

## 1. 产物清单

| 文件 | 体积 | 说明 |
| --- | ---: | --- |
| `boundary.geojson` | 34.2 KB | 北京市行政边界（MultiPolygon，WGS84，1 环 / 1,379 点，面积 16,432 km²） |
| `districts.geojson` | 110.8 KB | 北京 16 区边界（WGS84，16 feature / 18 环，含 name/name:en/center/centroid/areaKm2） |
| `basemap.jpg` | 2.53 MB | 北京市域卫星底图（EOX z11，3,072×2,408 px，经纬度线性映射） |
| `basemap-context.jpg` | 2.54 MB | 北京周边上下文卫星底图（EOX z10，3,072×2,422 px，远视距最底层） |
| `roads.geojson` | 4.43 MB | 中心城区干路 18,062 条（剔除朝阳区 + CBD 精细 bbox，RDP 3 m） |
| `tiles/massing/tileset.json` | 484 B | 3D Tiles 1.1，root.transform = ENU→ECEF（列主序） |
| `tiles/massing/massing.glb` | 3.31 MB | 86,706 个 OBB box 实例（EXT_mesh_gpu_instancing，1,040,472 三角形） |
| `meta.json` | ≈13 KB | 前端唯一入口：路径 / 坐标 / 统计 / 来源 / 许可 / 校验结果 |
| **合计** | **≈13.0 MB** | 其中 3D 体块 3.31 MB、卫星底图 5.07 MB、道路 4.43 MB |

数据规模：**86,706 个实例 / 1,040,472 三角形 / GPU 侧 3 个 draw call**（按高度 3 档材质）。
`meta.counts` 给出所有计数；`meta.verification` 记录 Python 自检、独立审计与 Cesium 1.147 headless 实测结果。

原子性校验（本次生成，`--verify-only` 可复跑）：

```
boundaryAreaKm2        = 16432.13   （官方 16410.54，误差 +0.13%）
instances              = 86706
triangles              = 1040472
glbBytes               = 3473012
instancesInsideChaoyang= 0
basemap                = 3072×2408（z11）
basemapContext         = 3072×2422（z10，完整覆盖 z11 并外扩 ≥0.5°）
```

---

## 2. 数据源与许可

| 图层 | 来源 | 许可 / 署名 | 说明 |
| --- | --- | --- | --- |
| 行政边界 / 16 区 | [DataV.GeoAtlas](https://geo.datav.aliyun.com/areas_v3/bound/110000.json)（`110000.json` + `110000_full.json`） | DataV.GeoAtlas 服务条款；**仅供演示参考，非官方测绘成果**，不得用于测绘出版/边界争议 | 原始 **GCJ-02**，本管线转换为 WGS84 |
| 卫星底图（z11 + z10） | [EOX Sentinel-2 cloudless 2020](https://cloudless.eox.at/) | **CC BY 4.0**，必须保留署名：`Sentinel-2 cloudless by EOX IT Services GmbH (CC BY 4.0)` | WMTS `s2cloudless-2020_3857`，影像时相约 2020 年 |
| 建筑体块 / 道路 | OpenStreetMap · BBBike Beijing extract（`/tmp/Beijing.osm.gz`，bbox 39.68–40.18 / 116.08–116.77） | **ODbL 1.0**，署名 `© OpenStreetMap contributors` | 建筑高度多为估算；OBB 为 footprint 近似 |

`meta.json` 中已写全：
- `meta.sources[]`（每源的 URL / license / attribution / caveat）；
- `meta.attribution`（纯文本，可直接放进数据来源面板）；
- `meta.attributionHtml`（带链接版本）；
- `meta.basemap.source` / `meta.basemapContext.source`（EOX 署名、许可、瓦片范围）。

**前端展示时必须保留**：

```
行政边界：DataV.GeoAtlas（GCJ-02→WGS84，仅供参考）
卫星底图：Sentinel-2 cloudless by EOX IT Services GmbH (CC BY 4.0)
建筑/道路：© OpenStreetMap contributors (ODbL 1.0)
```

---

## 3. 坐标系、投影与轴向

### 3.1 经纬度：WGS84（EPSG:4326）

所有 GeoJSON / 底图 rectangle / 3D 实例位置均为 **WGS84**，可直接用于 Cesium。

**DataV 边界是 GCJ-02**，直接使用会与 OSM/卫星底图差 300–500 m。本管线用标准
`transformLat/transformLon` 正向公式 + 固定点迭代反解（`gcj02_to_wgs84()`，60 次迭代，
残差 < 1e-9°）转成 WGS84。转换正确性验证：

- 朝阳区 DataV 边界转换后质心 = **116.50927, 39.95227**；
- 现有 `public/data/district/boundary.geojson`（OSM，朝阳区 1,203 点）质心 = 116.50939, 39.95240；
- 两者差 **18.0 m**（阈值 1 km），面积 465.51 vs 465.61 km²。→ GCJ→WGS84 与 DataV 几何可信。

北京市边界转换后 bbox = `[115.416848, 39.441454, 117.508067, 41.059225]`。

### 3.2 3D Tiles：ENU 原点与轴向（与 CBD / district 数据完全一致）

```
ORIGIN = (116.4610, 39.9080, 0)          # ENU 原点，三套 3D 数据同一基准
originEcef = (-2183057.4692, 4386009.7705, 4070155.0796)
```

`tileset.root.transform` 为 **ENU→ECEF 4×4 列主序**（列 0=east，列 1=north，列 2=up，
列 3=原点 ECEF），与 `Cesium.Transforms.eastNorthUpToFixedFrame(originCartesian)` 完全一致
（Cesium 实测最大元素差 9.3e-10）。

glTF content 是 **Y-up**：

```
glTF:  x = east, y = up, z = -north        （Cesium 自动做 Y_UP_TO_Z_UP）
实例:  world(glTF) = TRANSLATION * ROTATION * SCALE * unitBox
       TRANSLATION = (east, up_ground, -north)
       ROTATION    = 绕 glTF +Y 的航向四元数 (0, sin(θ/2), 0, cos(θ/2))
       SCALE       = (footprint 长, 高度, footprint 宽)
unitBox: x∈[-0.5,0.5], y∈[0,1], z∈[-0.5,0.5]（底面 y=0）
```

`up_ground` 是该点 WGS84 椭球高 0 地面在 ENU 中的 up 分量（含地球曲率，约 −d²/2R；
20 km 处约 −31 m）——所以远处体块不会悬空。前端**不需要任何额外设置**，Cesium 1.147
直接执行上述语义。

### 3.3 卫星底图：Web Mercator → 等经纬度（Plate Carrée）

EOX WMTS 瓦片是 **Web Mercator（EPSG:3857）**；本管线拼接后**双线性重采样为等经纬度
（EPSG:4326）**，使图片像素与经纬度成**线性映射**：

```
x = (lon - west) / (east - west) * width
y = (north - lat) / (north - south) * height
```

这正好匹配 Cesium `SingleTileImageryProvider`（文档明确：单张图按 Geographic/
EPSG:4326 渲染于 `rectangle`），可直接与 GeoJSON / 3D Tiles 严格对齐。两层的
`rectangle`、`width`、`height` 均写入 meta。

---

## 4. 行政边界（boundary.geojson / districts.geojson）

- 北京市：1 个 MultiPolygon / 1 环 / 1,379 点，**面积 16,432.13 km²**（官方 16,410.54 km²，误差 **+0.13%**，远小于 5% 阈值）；
- 16 区：MultiPolygon（其中朝阳区、顺义区各含 1 个飞地环，共 18 环）；
- 面积按各环平均纬度做等距近似计算（与 district 数据同一算法），**不是** DataV 属性值；
- `center` = DataV 中心点经 GCJ-02→WGS84（与阿里地图标注习惯一致，适合做区名标签锚点）；
  `centroid` = 本脚本按边界几何面积加权质心（也提供，供需要“几何中心”的场合）；
- `district/110000_full.json` 各环面积之和 16,427.97 km²，与市界面积差 0.03%。

16 区计算面积（km²）：

| 区 | 面积 | 区 | 面积 | 区 | 面积 |
| --- | ---: | --- | ---: | --- | ---: |
| 东城区 | 41.87 | 西城区 | 50.20 | 朝阳区 | 465.51 |
| 丰台区 | 304.66 | 石景山区 | 84.59 | 海淀区 | 431.39 |
| 门头沟区 | 1,449.84 | 房山区 | 2,001.88 | 通州区 | 906.47 |
| 顺义区 | 1,010.50 | 昌平区 | 1,344.35 | 大兴区 | 1,035.12 |
| 怀柔区 | 2,125.00 | 平谷区 | 949.52 | 密云区 | 2,229.52 |
| 延庆区 | 1,997.55 | | | | |

> ⚠️ DataV 边界为**展示用近似边界**（圆滑/简化），与官方勘界成果存在百米级差异；
> 面积与官方公布值相差 1–2% 属正常。仅用于数字孪生演示，**不得作为测绘成果或边界争议依据**。

前端用法：`Cesium.GeoJsonDataSource.load('data/beijing/districts.geojson')` 画区界；
用 `properties.center`（或 `centroid`）加 `LabelCollection` 做 16 区区名。

---

## 5. 卫星底图（basemap.jpg / basemap-context.jpg）

### 5.1 市域底图 `basemap.jpg`（z11）

| 项 | 值 |
| --- | --- |
| 瓦片 | EOX z11，`x∈[1680,1692] y∈[767,779]`，13×13=169 张 256px |
| 拼图 | 3,328×3,328 Web Mercator → 重采样 |
| 输出 | **3,072×2,408 px JPEG**，quality 90，2.53 MB |
| rectangle | `[115.3668483, 39.3914539, 117.5580672, 41.1092255]`（市界 bbox 四周 +0.05°） |
| 分辨率 | ≈60 m/px（z11 原生约 57 m/px），适合总览 |
| 平均亮度 | 54.9（原始卫星影像偏暗偏绿，前端可 `layer.brightness = 1.2~1.5` 提亮） |

### 5.2 周边上下文底图 `basemap-context.jpg`（z10，远视距最底层）

z11 市域底图只覆盖北京 bbox + 5 km；在 290 km 总览视距下可见范围约
**4.0°×(横)**，市域底图左右会露出背景/边缘拉伸条纹。为此新增 z10 上下文底图：

| 项 | 值 |
| --- | --- |
| 瓦片 | EOX z10，`x∈[835,850] y∈[379,394]`，16×16=256 张 256px |
| 输出 | **3,072×2,422 px JPEG**，quality 90，**2.54 MB（<3 MB）** |
| rectangle | `[113.8, 38.1, 119.0, 42.2]`（≈5.2°×4.1°，覆盖京津/冀中北部，含渤海湾一角） |
| 分辨率 | ≈150 m/px（z10 原生约 118 m/px），仅作远视距背景 |
| 平均亮度 | 61.2 |
| 覆盖保证 | 完整包住 z11 rectangle 且每侧外扩 ≥0.5°；Cesium 实测 290 km 视高时可见矩形 `[114.39,39.03,118.41,40.93]` 被完整覆盖 |

**加载顺序（重要）**：

```js
// 1) 最底层：上下文卫星底图（z10，覆盖北京周边）
const ctx = meta.basemapContext;
viewer.imageryLayers.addImageryProvider(
  await Cesium.SingleTileImageryProvider.fromUrl(assetUrl(ctx.file), {
    rectangle: Cesium.Rectangle.fromDegrees(...ctx.rectangle),
    credit: ctx.source.attribution,
  }),
);
// 2) 其上是市域 z11 底图（细节层）
const bm = meta.basemap;
viewer.imageryLayers.addImageryProvider(
  await Cesium.SingleTileImageryProvider.fromUrl(assetUrl(bm.file), {
    rectangle: Cesium.Rectangle.fromDegrees(...bm.rectangle),
    credit: bm.source.attribution,
  }),
);
```

`imageryLayers.addImageryProvider()` 依次叠加（后加在上层），不用手工设 index。
如后续仍需要更大范围（>350 km 视距 / 更宽视口），把脚本里的 `BASEMAP_CONTEXT_BBOX`
再外扩并**重跑全量构建**（`--cache /tmp/district/parsed.pkl`；EOX 瓦片已缓存时约 15 s；
新范围会按需下载新瓦片，EOX 覆盖全球）。

---

## 6. 中心城区建筑 massing（tiles/massing）

### 6.1 输入与筛选

输入：`/tmp/Beijing.osm.gz`（BBBike Beijing extract，中心城区 bbox `116.08,39.68,116.77,40.18`），
共 **112,218** 条 building way。筛选/排除顺序（与 `meta.stats.massing` 对应）：

| 步骤 | 数量 | 说明 |
| --- | ---: | --- |
| OSM building ways | 112,218 | 输入 |
| 中心城区 bbox 外 | 41 | 质心不在 extract bbox |
| CBD 精细 bbox 内 | 4,388 | `[116.430,39.885,116.495,39.930]`，由现有精细白模负责（含 OBB 中心二次判定） |
| 朝阳区边界内 | 20,161 | 由 `public/data/district/` 数据负责（OSM 朝阳区边界，点在多边形） |
| 朝阳区外候选 | 87,629 | — |
| footprint < 20 m² | 742 | 丢弃 |
| `building=roof` 且无有效高度 | 180 | 丢弃 |
| **最终实例** | **86,706** | 87,626 候选中 920 个被面积/roof 规则过滤 |

> 与朝阳区/District 数据**无重叠**：86,706 个实例逐个做点在多边形校验，落在朝阳区内的 = **0**；
> 落在 CBD 精细 bbox 内的实例中心 = **0**。道路同理（见 §7）。

### 6.2 几何与高度

- **OBB**：对 footprint 的局部 ENU 投影求最小面积包围矩形，box 的 `w/d/angle` 即该矩形；
  不是完整墙面/屋顶三角化（`meta.axis.instance` 有完整语义）。
- **高度模型**（与 CBD / district 完全一致）：
  1. `height` tag（米）——本次 1,575 栋；
  2. `building:levels × 3.2 + 1.2`——13,951 栋；
  3. 按 `building` 类型默认值（office 24–40 m、apartments 18–22 m 等）——72,103 栋。
  最终 clamp 到 `[2, 700] m`。
- 高度统计：min 2.0 / mean 13.5 / max 633.0 m（最大为超高层塔楼类 footprint）。
- 颜色分 3 档材质（与 district 数据同一套色板）：
  - `massing-low`（<24 m）：83,537 实例，≈RGB(0.80,0.83,0.88)
  - `massing-mid`（24–80 m）：3,035 实例，≈RGB(0.87,0.90,0.94)
  - `massing-high`（≥80 m）：134 实例，≈RGB(0.92,0.94,0.97)

### 6.3 GLB / tileset 结构

- 单 tileset、单 root tile、`refine: ADD`，`geometricError = 800`；root `geometricError = 0`；
- `asset.version = 1.1`，`extensionsUsed = ["EXT_mesh_gpu_instancing"]`；
- 共享几何：24 顶点 / 36 索引单位 box（flat normals，底面 y=0）；
- 3 个 node（按档位）挂 `EXT_mesh_gpu_instancing.attributes = {TRANSLATION, ROTATION, SCALE}`，
  accessor 均带 min/max、bufferView 4 字节对齐；
- 材质：`metallicFactor 0.04`、`roughnessFactor 0.78`、`emissiveFactor ≈ (0.018,0.024,0.038)`；
- root `boundingVolume.box` 覆盖全部实例的 ENU AABB：
  `min=[-32795.19,-25364.70,-130.75] / max=[26485.51,30229.12,570.53]`（tile 坐标米）。

### 6.4 校验抽样（meta.verification.samples）

`meta.verification.samples` 存了 10 个代表性大体量建筑的
`{id, lon, lat, east, north, up, height, w, d}`（WGS84 + ENU 两套坐标），
供前端/测试做“点定位到建筑”或 picking 自检。Cesium headless 实测用这 10 个点：
**10/10 命中，`scene.pickPosition` 反算位置与期望屋顶中心距离 0.91–0.92 m**。

---

## 7. 道路（roads.geojson）

- 只保留中心城区干路：`motorway / trunk / primary / secondary` 及对应 `_link`
  （不含 tertiary —— 朝阳区数据已含 tertiary，避免重复）；
- **精确裁剪**：先按朝阳区边界把每条 way 裁剪成“区外”折线片段（在 ENU 坐标系里求与
  1,203 点边界线的交点，再切分；不是简单按质心取舍），再 `subtract_bbox_from_line` 剔除
  CBD 精细 bbox 内的片段（与现有精细道路不重叠）；
- RDP 抽稀 3 m，坐标保留 7 位小数（≈1 cm）；
- 属性：`id`（`way/<osm id>#<序号>`）、`class`、`name`（可选）、`ref`（可选）。

统计：

| 项 | 值 |
| --- | ---: |
| 候选 way（8 类） | 23,038 |
| 完全在朝阳区内丢弃 | 4,872 |
| 输出 LineString | **18,062**（有名字 12,785 / 有 ref 4,891） |
| 顶点 | 125,358 → 59,980（RDP 3 m） |
| 体积 | 4.43 MB（<5 MB） |
| 分类计数 | motorway 2,010 / motorway_link 1,873 / trunk 1,848 / trunk_link 1,295 / primary 4,478 / primary_link 758 / secondary 5,201 / secondary_link 599 |

裁剪正确性（独立审计）：59,980 个顶点中，落在朝阳区边界内且**深入 >5 m** 的 = **0**
（83 个“在边界内”的顶点都是裁剪交点，最大偏移 0.12 m，四舍五入误差级）；
落在 CBD bbox 内且深入 >0.1 m 的顶点 = **0**。

> 说明：district 数据的道路是“只要该 way 有一点在朝阳区就保留整条”（未裁剪到边界）。
> 因此紧贴朝阳区边界外侧的少数片段会在两套数据中各画一次（同一几何，宽度/材质可能不同）。
> 这是为了不改动现有只读数据；如需彻底去重，前端可按范围隐藏其中一层，或后续统一重生成。

---

## 8. meta.json 与前端接入

`meta.json` 主要字段：

```
name / nameEn / level / adcode            # 北京市
areaKm2 (16432.13) / officialAreaKm2 / areaErrorPct
boundaryBbox / center                     # [west,south,east,north] / [lon,lat]
origin / originEcef / transform           # ENU 原点、ECEF、4×4 列主序
transformLayout / axis                    # 轴向语义说明（含 unitBox、前端提示）
basemap {file, rectangle, width, height, bytes, zoom, jpegQuality, meanLuma,
         pixelMapping, projection, tileRange, source{...}}
basemapContext {file, rectangle, width, height, bytes, ..., role:"context", layerOrder}
tiles.massing {tileset, glb, instances, triangles, glbBytes, tilesetBytes,
               tierCounts, tierColors, boundsEnu, instancing}
roads {file, count, bytes, classes, simplifyToleranceM, bbox, stats{...}}
boundary {file, points, rings, areaKm2, bytes, coordinateSystem}
districts {file, count, names, areaKm2{}, sumAreaKm2, bytes, coordinateSystem}
counts / exclusions / sources / attribution / attributionHtml
heightModel / stats / verification / notes / generatedAt / generator
```

前端接入骨架（Cesium 1.147）：

```ts
const assetUrl = (p: string) => new URL(p.replace(/^\/+/, ''), document.baseURI).toString();
const meta = await (await fetch(assetUrl('data/beijing/meta.json'))).json();

// 1) 卫星底图：先 context（最底层）再市域 z11
const ctx = meta.basemapContext;
viewer.imageryLayers.addImageryProvider(
  await Cesium.SingleTileImageryProvider.fromUrl(assetUrl(ctx.file), {
    rectangle: Cesium.Rectangle.fromDegrees(...ctx.rectangle),
    credit: ctx.source.attribution,
  }),
);
const bm = meta.basemap;
viewer.imageryLayers.addImageryProvider(
  await Cesium.SingleTileImageryProvider.fromUrl(assetUrl(bm.file), {
    rectangle: Cesium.Rectangle.fromDegrees(...bm.rectangle),
    credit: bm.source.attribution,
  }),
);

// 2) 中心城区 3D 体块
const massing = await Cesium.Cesium3DTileset.fromUrl(
  assetUrl(meta.tiles.massing.tileset),
  { maximumScreenSpaceError: 16, shadows: Cesium.ShadowMode.DISABLED },
);
viewer.scene.primitives.add(massing);

// 3) 行政边界 / 16 区（线 + 区名标签）
const districts = await Cesium.GeoJsonDataSource.load(assetUrl(meta.districts.file), {
  clampToGround: false, stroke: Cesium.Color.fromCssColorString('#4fa8d8'), strokeWidth: 1.5,
  fill: Cesium.Color.TRANSPARENT,
});
viewer.dataSources.add(districts);
for (const f of (await (await fetch(assetUrl(meta.districts.file))).json()).features) {
  const [lon, lat] = f.properties.centroid || f.properties.center;
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    label: {
      text: f.properties.name, font: '13px sans-serif',
      fillColor: Cesium.Color.fromCssColorString('#9fd8ff'),
      showBackground: true, backgroundColor: Cesium.Color.fromCssColorString('#06121ecc'),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 4.0e5),
    },
  });
}

// 4) 干路（可选：地形非必需，贴地 0 m 即可）
const roads = await Cesium.GeoJsonDataSource.load(assetUrl(meta.roads.file), {
  clampToGround: false, stroke: Cesium.Color.fromCssColorString('#ffb36b').withAlpha(0.5),
  strokeWidth: 1.2,
});
viewer.dataSources.add(roads);
```

### 8.1 Cesium 单 root tileset 的加载特性（实测记录）

Cesium 1.147 对“单 root tile”的 tileset 有一条裁剪逻辑：当 `root.getScreenSpaceError(frameState, true)`
（root 用 tileset 级 `geometricError` 计算）**小于等于** `tileset.memoryAdjustedScreenSpaceError`
（默认 = `maximumScreenSpaceError`，默认 16）时，会直接跳过 root 内容选择，不发起 glb 请求。
对应到本数据：`tileset.geometricError = 800`，在 1080p 级视口下**视距超过约 45 km** 且相机
尚未近距离加载过时，可能表现为“tileset 在但体块不显示”。

规避方式（任选其一，前端目前实际使用第一种）：

1. **先近后远**：城市近景（< 40 km）时加载 tileset，再拉远——内容一旦加载就会持续渲染；
2. `tileset.maximumScreenSpaceError = 1~4`（单 root tileset 无 LOD，不影响画质，只影响加载判定）；
3. `viewer.zoomTo(tileset)` 后再进入总览（本质同 1）。

headless 验证脚本即采用方式 1，tilesetLoaded = true、1 tile / 4.5 MB 显存、10/10 picking 命中。

---

## 9. 复现方式

依赖：Python 3.10+、numpy、Pillow（本机 bundled：
`/Users/one/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3`）；
脚本复用同级 `tools/build-district-data.py` 的 `LocalFrame` / OSM 解析 / OBB / GLB /
tileset / 校验逻辑（importlib 动态加载，不修改原文件）。

```bash
cd apps/cbd-digital-twin

# 全量生成（首次会下载 DataV JSON + EOX 瓦片，缓存到 /tmp/beijing-data-cache/）
python3 tools/build-beijing-data.py \
  --cache /tmp/district/parsed.pkl      # 可选：复用 OSM 解析缓存（77 MB，省 ~2 分钟）

# 只跑部分步骤
python3 tools/build-beijing-data.py --only boundary,basemap,context
python3 tools/build-beijing-data.py --only massing,roads --cache /tmp/district/parsed.pkl
python3 tools/build-beijing-data.py --only meta --skip-verify   # 注意：meta 需要 4 个中间信息文件

# 只校验已有产物
python3 tools/build-beijing-data.py --verify-only
# 校验并回填 headless Cesium 验证报告（报告格式见 §10.3）
python3 tools/build-beijing-data.py --verify-only --cesium-report /tmp/bjverify/report.json
```

- `--osm-gz /tmp/Beijing.osm.gz`（默认）、`--district-boundary public/data/district/boundary.geojson`（默认）、
  `--out public/data/beijing`（默认）；
- `--datav-cache /tmp/beijing-data-cache/datav`、`--eox-cache /tmp/beijing-data-cache/eox`；
- `--basemap-width 3072`、`--basemap-context-width 3072`、`--jobs 6`；
- `--skip-basemap`（不联网，保留旧底图）、`--skip-massing`、`--skip-roads`、`--skip-verify`。

耗时（本机实测，OSM 解析缓存 + EOX 瓦片缓存已就绪）：全量 **≈30 s**；
冷启动额外 OSM 解析 ≈2–3 min、DataV/EOX 下载 ≈1.5 min。
步骤顺序：`boundary → basemap(z11) → context(z10) → massing → roads → meta → verify`。

---

## 10. 校验记录（本次生成）

### 10.1 Python 内置自检（`--verify-only`）

```
boundary: 1 feature / 34,988 B            → 可解析 ✅
districts: 16 features                     → 数量正确 ✅
roads: 18,062 features / 4,650,016 B      → <5 MB ✅
boundaryAreaKm2: 16,432.13                → 与官方偏差 +0.13% ✅
basemap: 3,072×2,408 / 2,657,222 B        → 存在、尺寸正确 ✅
basemapContext: 3,072×2,422 / 2,665,744 B → <3 MB、覆盖 z11 rectangle ✅
GLB: magic/version/length、chunk、buffer/bufferView/accessor、索引范围、实例数一致 ✅
tileset: asset.version=1.1、transform 正交归一 det=+1 且与 ENU 原点一致、box 覆盖实例、content.uri 存在 ✅
重叠: 86,706 个实例落在朝阳区内的 = 0 ✅
meta: 可解析、实例数与 GLB 一致 ✅
```

### 10.2 独立审计（脱离生成脚本，用另一套 GLB/坐标解码 + 几何计算复核）

| 检查 | 结果 |
| --- | --- |
| 北京市面积 vs 官方 16,410.54 | 16,432.13（+0.13%）✅ |
| 16 区面积和 vs 市界面积 | 16,427.97 vs 16,432.13（0.03%）✅ |
| 朝阳区质心 vs OSM 朝阳区边界 | 差 18.0 m ✅ |
| 实例中心落在朝阳区内 | 0 ✅ |
| 实例中心落在 CBD bbox 内 | 0 ✅ |
| 道路顶点深入朝阳区 >5 m | 0（最大 0.12 m，裁剪交点舍入误差）✅ |
| 道路顶点深入 CBD bbox >0.1 m | 0 ✅ |
| 抽样实例 ENU→WGS84 反算 vs `meta.samples` | 最大 0.005 m ✅ |
| tileset transform 正交性误差 | 6e-11 ✅ |
| 底图宽高比 vs rectangle 经纬度比 | 偏差 0.01%（线性映射正确）✅ |

### 10.3 Cesium 1.147 headless 实测（Playwright Chromium，WebGL2）

环境：项目 `node_modules/cesium@1.147.0` + 仓库根 `playwright@1.59.1` 的 Chromium，
视口 1600×1000，`--use-angle=metal --enable-unsafe-swiftshader`。

| 项 | 结果 |
| --- | --- |
| `Cesium3DTileset.fromUrl('.../massing/tileset.json')` | ✅ `tilesLoaded = true`，root contentReady |
| 加载方式 | 城市近景加载后移动相机（见 §8.1） |
| 实例/三角形/显存 | 86,706 / 1,040,472 / 4,509,360 B |
| `tileset.root.transform` vs `Cesium.Transforms.eastNorthUpToFixedFrame` | 最大元素差 **9.3e-10** ✅ |
| `meta.transform` vs Cesium ENU | 最大元素差 **9.3e-10** ✅ |
| 抽样 picking（10 个大体量建筑） | **10/10 命中**；`scene.pickPosition` 距离期望屋顶中心 **0.91–0.92 m** ✅ |
| pageerror / console.error / requestfailed / HTTP≥400 | **0 / 0 / 0 / 0** ✅ |
| 帧率（overview 168 km / wide 290 km / city 30 km） | 120 / 120 / 120 fps（headless 上限） |
| 与 district/white-models tileset 同场景共存 | 三个 tileset 均加载成功、0 报错 ✅ |
| 290 km 视距画面覆盖 | 上下文底图完整覆盖可见矩形 `[114.39,39.03,118.41,40.93]` ✅ 无黑边/拉伸条纹 |
| 视觉抽查 | 海淀/中关村近景体块清晰、天安门-东城/西城体块与底图对齐、CBD 由精细白模负责 ✅ |

验证截图（本次，临时目录）：`/tmp/bjverify/shots/` 共 12 张（wide/overview/oblique/city/
city-close/tiananmen/chaoyang-before-after/CBD）。`meta.verification.cesium` 内已回填摘要。

复现验证（本仓库不含验证脚本，按下面最小页面即可复跑）：

```html
<!-- /tmp/bjverify/www/verify.html：静态服务器同时映射 /cesium 与 /data 两个目录 -->
<script src="/cesium/Cesium.js"></script>
<script>
  window.CESIUM_BASE_URL = '/cesium/';
  const viewer = new Cesium.Viewer('c', { baseLayer: false, skyBox: false,
    skyAtmosphere: false, terrainProvider: new Cesium.EllipsoidTerrainProvider() });
  const meta = await (await fetch('/data/beijing/meta.json')).json();
  // 先近景（30 km）加载，再拉远（见 §8.1）
  viewer.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(116.412, 39.925, 30000),
                          orientation: { heading: 0, pitch: -1.5, roll: 0 } });
  const ts = await Cesium.Cesium3DTileset.fromUrl('/data/beijing/tiles/massing/tileset.json');
  viewer.scene.primitives.add(ts);
  // 轮询 ts.tilesLoaded && ts.root.contentReady 后对比 transform / picking
</script>
```

```bash
# Playwright 侧（仓库根目录执行，可 import 'playwright'）
node -e "import('playwright').then(async ({chromium}) => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('http://127.0.0.1:5288/verify.html'); await p.waitForTimeout(8000);
  const r = await p.evaluate(() => ({ loaded: window.__ts && window.__ts.tilesLoaded }));
  console.log(r); await b.close(); })"
```

### 10.4 已知局限 / 精度声明

| 项 | 说明 |
| --- | --- |
| 行政边界 | DataV 展示用近似边界，**非官方测绘成果**；与 OSM 朝阳区边界质心差 18 m、面积差 ±1–2%；不得用于测绘出版/边界争议 |
| 建筑表达 | footprint 的**最小面积包围矩形（OBB）** 挤出 box，不是真实轮廓/屋顶；朝向与尺寸为近似 |
| 建筑高度 | 93% 为类型默认值估算；**仅用于视觉体量，不可用于测绘/规划/工程量** |
| OSM 覆盖 | extract 内约 11.2 万 building way，远少于实际建筑密度；空地在渲染中即无体块 |
| 覆盖范围 | massing/roads 只覆盖 BBBike extract bbox（39.68–40.18 / 116.08–116.77）；北京外围区县（延庆/密云/怀柔/平谷/门头沟山区等）只有边界 + 卫星底图，没有 3D 体块 |
| 无地形 | 平原按 WGS84 椭球面处理（ENU 曲率项）；未引入 DEM，山地体块仅出现在 extract 内且按 0 m 地面放置 |
| 垂直基准 | WGS84 椭球高、地面 0 m；未做大地水准面改正（北京 geoid ≈ −9 m 量级，整体平移） |
| 卫星底图 | 时相约 2020 年（Sentinel-2 无云合成），**非实时**；z11 ≈60 m/px、z10 ≈150 m/px（重采样后） |
| 道路 | 仅干路（无 tertiary/街坊路）；RDP 3 m 误差；不含车道/高架分级 |
| 朝阳区重叠 | 朝阳区（含 CBD）由现有 district/精细数据负责，本数据集不覆盖；道路在边界外侧有少量同几何重复绘制（见 §7） |
| 底图亮度 | EOX 原始影像平均亮度 55–61，偏暗偏绿；前端可调 `brightness/contrast/saturation`，不建议压成纯黑 |

---

## 11. 许可与署名（必须保留）

本目录数据由三个来源加工而成：

**行政边界**（`boundary.geojson` / `districts.geojson`）

> 来源：DataV.GeoAtlas <https://geo.datav.aliyun.com/areas_v3/bound/110000.json>
> 原始坐标系 GCJ-02，已转换为 WGS84；仅供演示参考，非官方测绘成果。

**卫星底图**（`basemap.jpg` / `basemap-context.jpg`）

> **Sentinel-2 cloudless by EOX IT Services GmbH (CC BY 4.0)**
> <https://cloudless.eox.at/>

**建筑体块 / 道路**（`tiles/massing/*` / `roads.geojson`）

> **© OpenStreetMap contributors, ODbL 1.0**
> <https://www.openstreetmap.org/copyright> · <https://opendatacommons.org/licenses/odbl/1-0/>
> extract：<https://download.bbbike.org/osm/bbbike/Beijing/>

前端展示时保留以上三行署名（可并入数据说明面板/地图 credit）。
`meta.attribution` / `meta.attributionHtml` 已给出可直接渲染的文本与 HTML 版本。
