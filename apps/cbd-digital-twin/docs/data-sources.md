# 北京朝阳 CBD 数字孪生 · 数据获取指南

> 面向有 Vue 3 / CesiumJS 经验的 WebGIS 前端工程师：国贸/中国尊模型去哪找、朝阳区白模怎么来、道路 GeoJSON 怎么下、地形影像与 token 怎么配、生产化有哪些坑，以及每个来源的许可边界。
>
> 外链于 **2026-11-03** 用本机网络实测。状态：✅ 实测可访问（200）｜⚠️ 本机直连超时/不稳定，链接为官方地址，国内访问可能需代理｜🔑 需账号/Key/token｜📄 需逐模型/逐服务核实许可。价格/配额/政策随时变化，**商用前以官方页面为准**。
>
> 配套：[数据管线说明](./data-pipeline.md)、[`../tools/build-city-data.py`](../tools/build-city-data.py)、[`../tools/README.md`](../tools/README.md)。

## 目录

- [0. 决策速查](#0-决策速查这个-demo-到底用了什么)
- [1. 国贸三期 / 中国尊 / 央视总部模型去哪找](#1-国贸三期--中国尊--央视总部模型去哪找)
- [2. 朝阳区白模：从 OSM 数据到 3D Tiles](#2-朝阳区白模从-osm-数据到-3d-tiles)
- [3. 道路 GeoJSON 与矢量瓦片](#3-道路-geojson-与矢量瓦片)
- [4. 地形、影像底图与 Cesium ion token](#4-地形影像底图与-cesium-ion-token)
- [5. 生产化与常见坑](#5-生产化与常见坑)
- [6. 许可与合规检查表](#6-许可与合规检查表)
- [7. 参考链接与验证状态](#7-参考链接与验证状态)
- [8. 本项目的实际数据选择](#8-本项目的实际数据选择)

## 0. 决策速查：这个 Demo 到底用了什么

| 需求 | 本 Demo 的选择 | 免费/离线 | 对外商用 |
|---|---|---|---|
| 国贸三期 A/B、中国尊、央视总部 | 前端程序化体量白模（`public/models/*.glb`），**仅示意体量** | ✅ 自建 | 体量模型风险最低，建筑形象使用仍建议法务确认 |
| 朝阳区建筑白模 | OSM（BBBike Beijing extract）→ 自研管线 → glTF + 3D Tiles 1.1 | ✅ ODbL | 保留 ODbL 署名；高精度重建需另购授权 |
| 道路/水系/绿地 | OSM → GeoJSON（RDP 抽稀） | ✅ ODbL | 同 ODbL；在线瓦片另受其 ToS |
| 底图 | 本地 `basemap.jpg`（暗色栅格，OSM 数据绘制） | ✅ 离线 | ODbL Produced Work，署名 © OSM contributors |
| 地形 | `EllipsoidTerrainProvider`（椭球面） | ✅ 无 token | 生产建议接真实地形 |
| Cesium ion token | **不使用** | ✅ 无 key | 接入 ion/Google/Bing 后须守其条款 |

一句话：**本项目不依赖任何在线 key，静态站点可完全离线展示**；代价是没有航测精度、全球地形与在线影像。

## 1. 国贸三期 / 中国尊 / 央视总部模型去哪找

### 1.1 先说现实：免费的高精度官方模型基本不存在

- 地标建筑的官方 BIM/精模不公开发布；公开可得的基本只有 OSM footprint+近似高度、众包/游戏资产、商业航测成果。
- 2026-11-03 实测 Sketchfab 搜索 API：`CCTV headquarters` 且可下载 → **0 条**；`CITIC Tower` 有 24 条可下载结果，但绝大多数是 `tower` 关键词命中的无关模型或游戏资产。**关键词命中 ≠ 目标建筑**，必须人工核对高度、屋顶特征、地址。
- 即便标了 CC0/CC-BY 仍涉及**建筑外观设计著作权、物权、商标（如央视 logo）**：「模型许可」≠「建筑形象使用许可」；**演示用程序化体量/OSM 白模替代**，商用必须取得授权或购买带商用许可的数据。

### 1.2 Cesium ion：现成 3D Tiles 与自定义上传

[Cesium ion](https://ion.cesium.com/) ✅🔑 是 Cesium 官方内容托管/切片平台，注册免费账号获得 token 与免费额度（**额度与商用条款以 [ion 定价页](https://cesium.com/platform/cesium-ion/pricing/) 为准，本文不列价格**）。获取步骤：注册 → 创建 token（只开 `assets:read`、限制域名）→ 在 Assets 面板添加资产 → 前端用 `fromIonAssetId` 加载。

| 资产 | 内容 | 许可/限制 |
|---|---|---|
| [Cesium OSM Buildings](https://cesium.com/platform/cesium-ion/content/cesium-osm-buildings/) ✅🔑 | 全球 3.5 亿+ 建筑、OSM 衍生、季度更新、逐建筑属性 | OSM ODbL，需署名；体块精度取决于 OSM；需联网/ion |
| [Google Photorealistic 3D Tiles](https://cesium.com/learn/cesiumjs-learn/cesiumjs-photorealistic-3d-tiles/) ✅🔑 | Google 摄影测量 3D Tiles（经 ion 代理） | 受 [Google 条款](https://cesium.com/legal/terms-for-google/) 约束；**不得与非 Google 地图/影像混用**；中国大陆覆盖与网络可达性需自行核实（本机无法访问 Google 文档页验证） |
| [Cesium World Terrain](https://cesium.com/platform/cesium-ion/content/cesium-world-terrain/) ✅🔑 | 全球 quantized-mesh 地形 | 需 ion 账号；北京城区地形近似平坦 |
| 自定义上传 | glTF/GLB、OBJ、FBX、CityGML、KML+COLLADA、LAS → 3D Tiles | 上传内容归你；需在 ion 的 location editor 里定位 |

支持格式见 [Tiler Data Types and Formats](https://cesium.com/learn/3d-tiling/tiler-data-formats/) ✅。CesiumJS 接入：

```js
import * as Cesium from 'cesium'
Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN // 勿提交到 git

const osmBuildings = await Cesium.createOsmBuildingsAsync()  // 现成白模
viewer.scene.primitives.add(osmBuildings)

const tileset = await Cesium.Cesium3DTileset.fromIonAssetId(96188) // asset id 以控制台为准
viewer.scene.primitives.add(tileset)

const google3d = await Cesium.createGooglePhotorealistic3DTileset() // 不可与本地底图混用
viewer.scene.primitives.add(google3d)
```

### 1.3 Sketchfab：CC 许可与 glTF 下载

[Sketchfab](https://sketchfab.com/) ✅🔑，规则见 [Downloading 3D models](https://help.sketchfab.com/en/articles/16152217-downloading-3d-models) ✅：

- 只有作者开启下载的模型可下载；搜索时勾选 **Downloadable**。
- 下载内容：作者原始文件、转码 glTF、多个贴图精度的 GLB、USDZ。
- 许可：CC0（免署名）、CC-BY（须署名）、CC-BY-NC（不可商用）、CC-BY-ND（不可修改）、CC-BY-SA（派生同协议）、Standard License；**Sketchfab Store 的付费模型**按所购许可使用（价格/条款以页面为准）。作者可事后改许可，但你下载时获得的许可继续有效——**保留下载记录/截图**。

| 目标 | 建议搜索词 |
|---|---|
| 国贸三期 | `China World Trade Center`、`Guomao Beijing`、`China World Tower` |
| 中国尊 | `CITIC Tower`、`China Zun`、`Beijing CBD` |
| 央视总部 | `CCTV Headquarters`、`CCTV building`、`OMA CCTV` |
| 城市群像 | `Beijing CBD skyline`、`Beijing skyscraper` |

下载的 `glb` 不是 3D Tiles，单栋可直接按 ENU 矩阵定位；多栋再转 Cesium ion/自研 3D Tiles：

```js
const origin = Cesium.Cartesian3.fromDegrees(116.46014, 39.91157, 0)
const model = await Cesium.Model.fromGltfAsync({
  url: '/models/citic-tower.glb',
  modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(origin), // 轴向不一致时再左乘校正矩阵
})
viewer.scene.primitives.add(model)
```

### 1.4 SketchUp 3D Warehouse

[3D Warehouse](https://3dwarehouse.sketchup.com/) ✅🔑📄，Trimble/SketchUp 模型库，用户上传为主：搜索 `CCTV Headquarters`、`China World Trade Center` 等能找到零散模型，但**精度、比例、地理配准、许可因作者而异**，需逐个核对（[Terms](https://3dwarehouse.sketchup.com/terms.html) ✅）。下载 `.skp` 需 Trimble 账号 + SketchUp 打开/导出（FBX/OBJ/DAE 等，以你的版本为准），再转 glTF；多数模型没有真实坐标，需按 OSM footprint 手动对齐。

### 1.5 Blender / 程序化重建（演示首选）

1. **程序化体量**：按公开高度建简单棱柱（中国尊约 528 m、国贸三期 A 约 330 m、B 约 296 m、央视总部主楼约 234 m，以官方资料为准），加收分/切角，纯色或顶点色 PBR。
2. **OSM 白模**：[BlenderGIS](https://github.com/domlysz/BlenderGIS) ✅ 或 [blender-osm](https://github.com/vvoovv/blender-osm) ✅ 导入 OSM 并挤出；也可经 [OSM2World](https://osm2world.org/) ✅ 生成带屋顶结构的模型再导出 glTF/OBJ；或用脚本直接生成 glTF（本项目做法，见第 2、8 节）。

规范：单位用**米**；glTF 为 **Y-up**、3D Tiles 瓦片为 **Z-up**（Cesium 自动转换）；所有模型与 3D Tiles 共用**同一个 ENU 原点**；城市白模优先顶点色、少用大贴图。

### 1.6 商业航测 / 倾斜摄影供应商

需要厘米级实景三维/可量测数据时只能走商业数据或政府测绘成果。以下按公开官网列出，**报价、交付范围、是否含北京 CBD 现成成果均需商务询价，本文不编造价格**：

| 供应商 | 定位 | 官网 |
|---|---|---|
| 超图软件 SuperMap | GIS 平台 + 三维数据处理/发布 | <https://www.supermap.com/> ✅（无头请求可能 403） |
| 吉奥时空（原武大吉奥，GeoStar） | GIS 平台、实景三维、政务信息化 | <https://www.geostar.com.cn/> ✅ |
| 大势智慧 DASPATIAL | 实景三维建模软件与服务 | <https://www.daspatial.com/> ✅ |
| 瞰景 Smart3D | 实景三维建模软件 | <https://www.smart3d.cn/> ✅ |
| Bentley ContextCapture | 摄影测量/实景建模 | <https://www.bentley.com/software/contextcapture/> ✅ |
| DJI Terra（大疆智图） | 无人机航测建模 | <https://www.dji.com/cn/dji-terra> ✅ |
| 天地图·北京（北京市地理信息公共服务平台） | 官方地理信息公共服务 | <https://beijing.tianditu.gov.cn/> ✅ |

合规：境内测绘活动、涉密测绘成果有**测绘资质与保密**要求，航拍需空域审批。采购合同要明确「版权、二次分发权、渲染/展示权、审图号」。

### 1.7 地标模型选型建议

| 场景 | 建议 | 成本 | 风险 |
|---|---|---|---|
| 内部演示/汇报 | 程序化体量 + OSM 白模 | 极低 | 低（注明示意） |
| 对外展示要真实感 | 商业倾斜摄影/精模授权，或 Sketchfab 合规模型 | 中～高 | 中（许可/建筑形象） |
| 可量测/工程用途 | 商业航测 + 正射/点云/实景三维，签授权 | 高 | 需资质与法务审查 |

## 2. 朝阳区白模：从 OSM 数据到 3D Tiles

### 2.1 OSM 数据源对比

| 源 | 更新/覆盖 | 格式 | 免费 | Key | 许可 | 2026-11 可访问性 |
|---|---|---|---|---|---|---|
| [BBBike extracts](https://extract.bbbike.org/) | 自定义 bbox，每日更新；有 Beijing extract | PBF、OSM XML、**GeoJSON**、GeoPackage、Shapefile、MBTiles/PMTiles 等 | ✅ | 否（填邮箱生成链接） | ODbL 1.0 | ✅ |
| [Geofabrik China](https://download.geofabrik.de/asia/china.html) | 中国全境，每日 | `.osm.pbf`、`.shp.zip` | ✅ | 否 | ODbL 1.0 | ⚠️ 本机直连超时，常需代理 |
| [OSM 官方导出](https://www.openstreetmap.org/export) | 小 bbox | OSM XML | ✅ | 否 | ODbL 1.0 | ⚠️ 本机直连超时，有面积限制 |
| [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) | 按 tag 实时查询 | JSON/XML | ✅ | 否 | ODbL 1.0 | ⚠️ 测试时 502、镜像不可直连，用前先测 |
| [overpass turbo](https://overpass-turbo.eu/) | Overpass 网页前端，可导出 GeoJSON | GeoJSON/GPX/KML | ✅ | 否 | ODbL 1.0 | ✅ |
| [Cesium OSM Buildings](https://cesium.com/platform/cesium-ion/content/cesium-osm-buildings/) | 全球，季度 | 3D Tiles（托管） | 免费额度 | 🔑 ion | ODbL（OSM 衍生） | ✅ 需登录 |

> 国内经验：**BBBike 的 Beijing extract 最稳**（本项目用它）；Geofabrik 适合全国数据但常需代理；OSM/Overpass 主站国内时好时坏，脚本要做重试与镜像切换。

### 2.2 Overpass QL：按 bbox 取建筑

bbox 顺序是 **(south, west, north, east)**：

```overpassql
[out:json][timeout:180];
(
  way["building"](39.885,116.430,39.930,116.495);
  relation["building"](39.885,116.430,39.930,116.495);
);
out geom;
```

`out geom;` 直接带坐标，适合小范围导出；完整 OSM 结构用 `out body; >; out skel qt;`。只要带高度的：加 `["height"]`；要层数加 `["building:levels"]`。命令行写法：

```bash
curl -sS --retry 3 -X POST https://overpass-api.de/api/interpreter \
  --data-urlencode 'data=[out:json][timeout:180];
    (way["building"](39.885,116.430,39.930,116.495);
     relation["building"](39.885,116.430,39.930,116.495););
    out geom;' -o /tmp/cbd-buildings.json
```

白模关心的 tag：`building`、`height`、`building:levels`、`min_height`、`building:part`、`name`、`addr:*`。

### 2.3 height / levels 缺失时怎么估算

OSM 高度是众包数据，**大部分建筑没有 `height`**。本项目实测（`public/data/meta.json`）：4331 栋源建筑中，有 `height` 的仅 **31 栋**、用 `building:levels` 推算的 **1996 栋**、其余 **2293 栋**按类型默认值——这组数字很能说明问题。估算优先级：

1. `height` 标签 → 解析米（兼容 `120 m` / `120'` / `120 ft`）；
2. `building:levels × 层高`（办公 3.5、住宅 3.0；本项目取 3.2 m + 底层附加 1.2 m）；
3. `min_height` / `roof:height` 处理架空与屋顶；`building:part` 与主建筑分开算；
4. 按 `building` 类型默认值：office/commercial 24~40 m、residential 18~22 m、house 8 m……；
5. 同类型按 id 哈希取确定值，避免整片同高且保证每次构建可复现。

> 精度声明：白模只能表达体量关系，不能用于限高、日照、消防等工程分析；OSM footprint 也可能滞后于实际建设。对外输出必须写明「示意/近似」。

### 2.4 路线 A：GeoJSON 挤出 → glTF → 3D Tiles 1.1（本项目）

零依赖、可离线、可控性最高，核心 5 步：**取数**（BBBike → GeoJSON，留原始 tags）→ **清洗**（只留 Polygon/MultiPolygon、面积过滤、排除地标 80 m 半径）→ **挤出**（经纬度转 ENU 米制坐标，按估算高度生成三角网）→ **写 glTF**（顶点转 Y-up：`x=east, y=up, z=-north`，顶点色分高度层级）→ **写 tileset.json**（1.1 规范，`content.uri` 指 glb，`transform` 为 ENU→ECEF，`boundingVolume.box` 用 ENU 包围盒）。

3D Tiles 1.1 的关键好处：**内容可以直接是 glTF（.glb），不再需要 b3dm**，少一层封装和工具链，自研简单、加载快。规范见 [3D Tiles](https://github.com/CesiumGS/3d-tiles) ✅。最小 tileset.json 骨架：

```json
{
  "asset": { "version": "1.1" },
  "geometricError": 256,
  "root": {
    "refine": "ADD",
    "geometricError": 0,
    "content": { "uri": "white-models.glb" },
    "transform": [
      -0.8952378715, -0.4455885473, 0.0, 0.0,
       0.2858703366, -0.5743458919, 0.7670755811, 0.0,
      -0.3418000938,  0.6867151105, 0.6415567418, 0.0,
      -2183057.4692, 4386009.7705, 4070155.0796, 1.0
    ],
    "boundingVolume": {
      "box": [130.411, -53.999, 132.5, 2778.714, 0, 0, 0, 2499.193, 0, 0, 0, 134.5]
    }
  }
}
```

ENU→ECEF 不要手推，直接用 CesiumJS 生成（列主序正好是 3D Tiles 要求）：

```js
const m = Cesium.Transforms.eastNorthUpToFixedFrame(
  Cesium.Cartesian3.fromDegrees(116.4610, 39.9080, 0)
)
const transform = Cesium.Matrix4.toArray(m) // 抄进 tileset.json 的 root.transform
```

### 2.5 路线 B：py3dtiles / 3d-tiles-tools / Cesium ion / QGIS

| 工具 | 实际能力 | 适合 | 不适合 |
|---|---|---|---|
| [py3dtiles](https://py3dtiles.org/) ✅（v11.1.0，2025-10） | 点云（LAS/LAZ/PLY/XYZ）→ 3D Tiles；WKB/PostGIS 几何导出；`info/convert/export/merge/view` | 倾斜摄影点云、激光点云、已有 WKB 几何 | **不能把 GeoJSON 建筑面直接挤出**，需自己先做几何 |
| [3d-tiles-tools](https://github.com/CesiumGS/3d-tiles-tools) ✅ | `gzip`、`upgrade --targetVersion 1.1`、`createTilesetJson`、`convert`（3TZ/3DTILES）、`merge`/`combine`、`optimizeB3dm`（Draco） | 已有 3D Tiles/glb 的校验、升级、压缩、打包 | 不是建模工具，不负责挤出 |
| [Cesium ion](https://ion.cesium.com/) ✅🔑 | 上传 glTF/OBJ/FBX/CityGML/KML+COLLADA → 3D Tiles | 不想自己切片/托管 | **3D Buildings 通道只收 CityGML 或 KML+COLLADA**，GeoJSON 不能直接挤出；需联网 |
| [QGIS](https://qgis.org/download/) + [QuickOSM](https://plugins.qgis.org/plugins/QuickOSM/) ✅ | 下载/清洗 OSM、坐标检查、裁剪、导出 GeoJSON/GPKG、3D 预览 | 数据准备与人工质检 | 不负责生产 3D Tiles（导出 glTF 的插件生态需自行核实） |
| [FME](https://cesium.com/learn/ion/integrations-learn/integrations-fme/) ✅（商业） | 商业 ETL，可做 GIS/CAD → glTF/3D Tiles 转换，并提供 Cesium ion 集成 | 已有 FME 授权的团队 | 需商业许可；具体写出格式以所购版本为准 |

```bash
# py3dtiles：点云 → 3D Tiles（需额外依赖）
pip install "py3dtiles[las]"
py3dtiles convert pointcloud.las --out ./tiles/

# 3d-tiles-tools（Node 22+）：升级 3D Tiles 1.1 + gzip
npx 3d-tiles-tools upgrade -i ./tiles/tileset.json -o ./tiles-v11/ --targetVersion 1.1
npx 3d-tiles-tools gzip -i ./tiles-v11/ -o ./tiles-v11-gz/

# 已有 glb 生成 tileset.json（指定经纬度）
npx 3d-tiles-tools createTilesetJson -i ./model.glb -o ./tileset.json \
  --cartographicPositionDegrees 116.4610 39.9080 0
```

### 2.6 坐标、ENU 原点、LOD 与批量属性

- **原点**：取场景几何中心（本项目 116.4610, 39.9080, 0）。ENU 是局部米制，离原点越远 float32 精度越差；城市级几公里到十几公里没问题，更大范围要分块、每块一套原点。
- **链路**：WGS84 → ECEF → ENU；批量转换在构建脚本里用椭球公式实现，不依赖 Cesium（本项目 `build-city-data.py` 自实现）。
- **高度基准**：OSM 没有可靠高程，本项目按椭球高 0 m 统一处理（北京城区海拔约 40 m，但场景是平的）；接真实地形时必须逐栋贴地（见 5.4）。
- **LOD**：几万三角面的白模单 tile 即可（`geometricError=0`、`refine=ADD`）；到十亿级面片才需要格网分块 + 递减 LOD，别为「像 3D Tiles」硬套多层。
- **批量属性**：逐栋点选/高亮可用 glTF 的 `EXT_mesh_features` / `EXT_structural_metadata`；本 Demo 为保证体积与兼容性，未做逐栋白模点选，仅保留 `buildings-fallback.geojson` 作为 3D Tiles 失败时的兜底渲染。
- **可复现**：高度默认值用「类型 + id 哈希」而非随机数（本项目如此）。

本项目白模在 [`../public/data/tiles/white-models/tileset.json`](../public/data/tiles/white-models/tileset.json)：约 4320 栋、7.1 万顶点、6.25 万三角面、2.6 MB，单 tile 直接加载。

## 3. 道路 GeoJSON 与矢量瓦片

### 3.1 Overpass QL：按 highway 分类取道路

```overpassql
[out:json][timeout:180];
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street)(_link)?$"]
  (39.885,116.430,39.930,116.495);
out geom;
```

- 只要主干道：`^(motorway|trunk|primary)$`；人行/自行车加 `footway|cycleway|path|pedestrian`；铁路/地铁：`way["railway"~"rail|subway|light_rail"]`；要属性用 `out tags geom;` 或 `out body; >; out skel qt;` 本地组装。

### 3.2 下载与转换渠道

| 方式 | 步骤 | 注意 |
|---|---|---|
| BBBike extract | 选 bbox → 格式选 GeoJSON（Osmium GeoJSON）→ 填邮箱下载 | 需等生成；大 bbox 文件大 |
| Geofabrik `.osm.pbf` | 下载 → osmium/GDAL 按 `highway` 过滤 → 导出 GeoJSON | 国内常需代理；过滤要自己写 |
| OSM 官方导出 | 页面框选 → OSM XML → 转 GeoJSON | bbox 面积受限，不适整区 |
| Overpass / overpass turbo | 跑 3.1 查询 → Export → GeoJSON | 公共实例限流，礼貌使用 |
| QGIS | QuickOSM 或加载本地 PBF → 过滤 → 裁剪 → Export GeoJSON | CRS=EPSG:4326，勾选保留字段 |

```bash
ogr2ogr -f GeoJSON roads.geojson china-latest.osm.pbf lines \
  -where "highway IS NOT NULL" -t_srs EPSG:4326
```

### 3.3 在线矢量瓦片服务对比

| 服务 | 类型 | 免费/额度 | Key | 坐标系 | 许可/条款 | 2026-11 |
|---|---|---|---|---|---|---|
| [MapTiler](https://www.maptiler.com/) | 矢量瓦片+样式+栅格 | 有免费额度，商用付费 | 🔑 | WGS84 WebMercator | MapTiler ToS + OSM 署名 | ✅ |
| [Mapbox](https://www.mapbox.com/) | 矢量瓦片+样式 | 有免费额度，商用计费 | 🔑 | WGS84 WebMercator | Mapbox ToS（离线缓存受限） | ✅ |
| 天地图 | WMTS 栅格（影像/矢量/注记） | 公益服务，有配额 | 🔑 tk | CGCS2000（≈WGS84） | 天地图条款，需署名/审图号 | ✅ |
| 高德 | 栅格/矢量（官方 JS API 为主） | 有免费额度 | 🔑 key | **GCJ-02** | 高德开放平台条款 | ✅ 官方站；第三方瓦片地址非官方承诺 |
| OSM 标准瓦片 | 栅格 PNG | 免费但严格限流 | 否 | WGS84 | ODbL + [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) ✅ | ⚠️ 本机直连超时 |
| CARTO Basemaps | 栅格（dark/light 等） | 有免费/署名要求 | 部分需 | WGS84 | CARTO 条款 + OSM 署名 | ✅ `basemaps.cartocdn.com` 实测 200，商用条款需核实 |

要点：**天地图**是 OGC WMTS，示例 `https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=YOUR_TK`（完整参数以官方文档为准，`s` 取 0-7）；**高德/腾讯是 GCJ-02**，直接叠 WGS84 数据会偏移数百米；**OSM 瓦片**禁止批量下载/离线预取，必须署名、缓存 ≥7 天、带可识别 UA/Referer——离线演示必须自建或选允许离线的服务。

### 3.4 Cesium 加载 MVT 的三种方案（2026-11 现状）

先纠正旧结论：**「Cesium 原生不支持 MVT」在 2026 年已不完全成立**。CesiumJS 1.142（2026-06）新增实验性 `MVTDataProvider`，运行时把 MVT 转成 3D Tiles；1.145（2026-09）加 `heightReference` 支持贴地/贴 3D Tiles。见 [MVTDataProvider 文档](https://cesium.com/learn/cesiumjs/ref-doc/MVTDataProvider.html) ✅ 与 [官方教程](https://cesium.com/learn/cesiumjs-learn/load-mapbox-vector-tiles-in-cesiumjs/) ✅。

```js
// 方案 1（新项目，Cesium ≥1.145）：MVT 直接转 3D Tiles（Experimental）
const provider = await Cesium.MVTDataProvider.fromUrl('https://your-tiles/{z}/{x}/{y}.pbf', {
  minZoom: 8, maxZoom: 16,
  heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
  scene: viewer.scene,
})
viewer.scene.primitives.add(provider.tileset)
```

- **方案 2（老版本）**：第三方 ImageryProvider，如 [`mvt-imagery-provider`](https://github.com/nonlinearthink/MVTImageryProvider) ✅（`npm i mvt-imagery-provider`，即社区常说的 CesiumMVTImageryProvider 一类方案；接收 Mapbox Style JSON 渲成 canvas 作为 imagery layer），适合把矢量底图当栅格贴球、拾取能力有限；也可用 Mapbox GL JS 叠加并与 Cesium 相机同步（社区方案，需自行处理同步与 Mapbox 许可）。
- **方案 3（最稳/离线）**：服务端把 MVT 转 GeoJSON（`@mapbox/vector-tile` + `pbf`；`vt2geojson` 类工具的包名/版本需自行确认），前端按普通 GeoJSON 加载；反向可用 tippecanoe 把 GeoJSON 打成 MVT 自建瓦片。

### 3.5 本项目的 roads.geojson

[`../public/data/roads.geojson`](../public/data/roads.geojson)：1398 条 LineString、约 360 KB，字段 `id/class/name/ref/oneway/lanes/bridge/tunnel`，在 OSM 基础上做 RDP 0.5 m 抽稀。加载示例：

```js
const roads = await Cesium.GeoJsonDataSource.load('/data/roads.geojson', {
  clampToGround: true,
  stroke: Cesium.Color.fromCssColorString('#7fc4ff'),
  strokeWidth: 2,
})
viewer.dataSources.add(roads)
```

几万条以上时改用 `GeoJsonPrimitive` / `BufferPolylineCollection`，避免 Entity 层卡顿；纯贴地线可用 `GroundPolylinePrimitive`。

## 4. 地形、影像底图与 Cesium ion token

### 4.1 地形：World Terrain 与无 token 降级

| 方案 | 条件 | 代码 | 适用 |
|---|---|---|---|
| Cesium World Terrain | 🔑 ion、联网 | `await Cesium.createWorldTerrainAsync()` | 真实地形（山地/河谷） |
| 自建 quantized-mesh | 自有 DEM + 切片服务 | `Cesium.CesiumTerrainProvider.fromUrl(url)` | 内网/工程数据 |
| **椭球面（本项目）** | 无 token、可离线 | `new Cesium.EllipsoidTerrainProvider()` | 城市核心区平坦地形、演示 |

北京 CBD 起伏很小，椭球面够用且保证白模/底图/地标严格对齐；接真实地形后所有贴地要素都要重算高程（见 5.4）。

### 4.2 影像底图接入注意事项

| 底图 | 接入方式 | 坐标系 | Key | 注意 |
|---|---|---|---|---|
| 天地图（影像/矢量/注记） | `WebMapTileServiceImageryProvider`（WMTS） | CGCS2000≈WGS84 | 🔑 tk | 需署名，部分服务要求审图号；有配额 |
| 高德 | `UrlTemplateImageryProvider`（官方 API 优先） | **GCJ-02** | 🔑 key | 与 WGS84 叠加必须纠偏 |
| Bing（经 ion） | `createWorldImageryAsync` / IonImageryProvider | WGS84 | 🔑 ion | Bing 退役中（官方称至少提供到 2026-09），长期不可靠 |
| Google Photorealistic 3D Tiles | ion 代理 | WGS84 | 🔑 ion | **禁止与非 Google 地图混用** |
| OSM 标准瓦片 | `OpenStreetMapImageryProvider` | WGS84 | 否 | 严格限流，禁离线/批量 |
| 本地栅格（本项目） | `SingleTileImageryProvider` | WGS84 | 否 | 一个 bbox 一张图，离线可用 |

```js
// 天地图 WMTS（tk 换成自己的）
const tianditu = new Cesium.WebMapTileServiceImageryProvider({
  url: 'https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=YOUR_TK',
  layer: 'img', style: 'default', tileMatrixSetID: 'w',
  subdomains: ['0','1','2','3','4','5','6','7'],
  tilingScheme: new Cesium.WebMercatorTilingScheme(),
  maximumLevel: 18,
})
viewer.imageryLayers.addImageryProvider(tianditu)
```

### 4.3 本项目的无 token 降级实现

项目在 `src/cesium/CbdScene.ts` 中做了三件事：① `terrainProvider: new Cesium.EllipsoidTerrainProvider()`，不请求 ion；② 用 `meta.json` 的 `basemap.rectangle` 创建 `SingleTileImageryProvider` 贴 `basemap.jpg`；③ 全部数据走相对路径 `data/*`、`models/*`，静态站点即可运行（需 HTTP 服务，不能 `file://` 直开）。

```js
const provider = new Cesium.SingleTileImageryProvider({
  url: '/data/basemap.jpg',
  rectangle: Cesium.Rectangle.fromDegrees(116.430, 39.885, 116.495, 39.930),
})
viewer.imageryLayers.addImageryProvider(provider)
```

底图必须与矢量图层使用**同一 bbox、同一经纬度线性映射**（本项目 `build-city-data.py` 按经纬度直接绘制），否则边缘会错开。

### 4.4 版权与署名

- **CesiumJS**：Apache-2.0，[License](https://github.com/CesiumGS/cesium/blob/main/LICENSE.md) ✅；默认 credit 容器不要用 CSS 隐藏（其中承载 Cesium 与第三方数据署名）。
- **Cesium ion 内容**：必须显眼展示 ion logo；Asset Depot 资产必须展示数据 attribution；Google 数据还要展示 Google Maps logo。见 [Content Usage and Attribution Guide](https://cesium.com/learn/ion/content-usage-and-attribution-guide/) ✅。
- **OSM**：ODbL 1.0，必须署名 **© OpenStreetMap contributors**（链接 <https://www.openstreetmap.org/copyright>）；瓦片另受 Tile Usage Policy 约束。
- **天地图/高德/Bing/Google**：各自 ToS、署名、审图号/logo 要求，不能只写「数据来自网络」；本项目在 `meta.json` 与页面保留 `© OpenStreetMap contributors (ODbL 1.0)` 署名。

## 5. 生产化与常见坑

### 5.1 坐标系统：GCJ-02、BD-09、CGCS2000

| 坐标系 | 谁在用 | 与 WGS84 关系 | 处理 |
|---|---|---|---|
| WGS84 | GPS、Cesium、OSM、GeoJSON 标准 | 基准 | 统一入口 |
| GCJ-02（火星坐标） | 高德、腾讯、国内多数在线地图 | 非线性偏移，北京城区约几百米 | 用 `gcoord`/`coordtransform` 纠偏后再给 Cesium |
| BD-09 | 百度 | GCJ-02 再偏移 | 先转 GCJ-02 再转 WGS84 |
| CGCS2000 | 天地图、国内测绘成果 | 与 WGS84 差厘米~米级 | 通常近似当 WGS84；高精度做七参数/格网改正 |
| 1985 国家高程基准 | 国内高程成果 | 与 WGS84 椭球高差米级~十余米 | 需高程异常改正；演示可忽略但须声明 |

**铁律：所有数据进 Cesium 前统一转 WGS84（EPSG:4326）**，并写进 `meta.json`。

```js
import gcoord from 'gcoord' // https://github.com/hujiulong/gcoord ✅
// 或 coordtransform：https://github.com/wandergis/coordtransform ✅
const [lng, lat] = gcoord.transform([116.46014, 39.91157], gcoord.GCJ02, gcoord.WGS84)
```

正算（WGS84→GCJ-02）是确定公式，反算常用迭代逼近；要求厘米级就不要用前端纠偏，直接拿 WGS84 原始成果。

### 5.2 CORS、缓存、CDN 与静态托管

- 3D Tiles/glTF 走 `fetch`，**必须 HTTP(S) 且允许跨域**；静态站点同源部署最省事。
- MIME：`.glb` 建议 `model/gltf-binary`（多数服务器给 `application/octet-stream` 也能用），`.json` 用 `application/json`；gzip 内容须正确返回 `Content-Encoding: gzip`。
- 缓存/CDN：内容哈希资源用 `immutable` 长缓存，`tileset.json`/`meta.json`/`roads.geojson` 用短缓存或 ETag 并把数据版本写进文件名/query；3D Tiles 是大量小请求，注意 HTTP/2、并发上限（Cesium `RequestScheduler` 默认每服务器 18）与 CDN 对 range/压缩的处理。
- 离线包：打包 `public/` 用 `npx serve public` 或 nginx 托管；Cesium Workers/WASM 走相对路径，别漏。

### 5.3 3D Tiles / glTF 压缩

| 手段 | 工具 | 说明 |
|---|---|---|
| gzip | `npx 3d-tiles-tools gzip -i in/ -o out/` | 3D Tiles 标准压缩，服务器需正确设置 Content-Encoding |
| Draco | [gltf-pipeline](https://github.com/CesiumGS/gltf-pipeline) ✅、gltf-transform、`3d-tiles-tools optimizeB3dm` | 压缩几何；CesiumJS 内置 Draco 解码，自研渲染器需自带解码器 |
| Meshopt | [gltf-transform](https://gltf-transform.dev/) ✅ 的 `meshopt`/`optimize --compress meshopt` | CesiumJS 1.143 起支持 `KHR_meshopt_compression`，其他引擎需解码器 |
| 量化/简化 | `gltf-transform quantize` / `simplify` | 降精度换体积，白模别过头导致 z-fighting |

```bash
npm i -g @gltf-transform/cli
gltf-transform optimize in.glb out.glb --compress draco --texture-compress webp
gltf-transform meshopt in.glb out-meshopt.glb
```

压缩后**务必在目标 CesiumJS 版本回归验证**，别只看体积。

### 5.4 地形贴合、depthTestAgainstTerrain 与性能预算

- 白模/地标按椭球高 0 m 建、底图贴球面时三者天然对齐；接真实地形后建筑会悬空/埋地。
- 贴地手段：实体/模型用 `heightReference: Cesium.HeightReference.CLAMP_TO_GROUND`（1.114 起也会贴 3D Tiles，可用 `CLAMP_TO_TERRAIN` 只贴地形）；3D Tiles 白模没有自动贴地开关，正确做法是构建阶段用 `sampleTerrainMostDetailed` 或 DEM 采样把每栋基面高度写进几何；只做遮挡判断可开 `viewer.scene.globe.depthTestAgainstTerrain = true`（高程错误会立刻暴露成穿模）。
- 性能预算（经验值，按目标设备调）：

| 指标 | 建议值 | 说明 |
|---|---|---|
| 单帧 draw call | < 200 | 白模合批、道路合并、少用 Entity |
| 白模三角面 | 10 万级以内单 tile 可接受 | 本项目 6.25 万 |
| `maximumScreenSpaceError` | 16（默认），性能优先 24~32 | 3D Tiles LOD 阈值 |
| 纹理 | 顶点色/小图集 | 城市白模不需要大贴图 |
| 首屏数据量 | 核心区 < 3~5 MB | 本项目白模 2.6 MB + 矢量 ~0.9 MB + 底图 0.45 MB |
| 移动端 | 降 `resolutionScale`、关阴影/抗锯齿 | 限制 LOD 与像素比 |

## 6. 许可与合规检查表

| 数据/服务 | 许可 | 演示可用 | 对外商用必须做什么 |
|---|---|---|---|
| OSM 数据（BBBike/Geofabrik 导出） | ODbL 1.0 | ✅ | 署名 © OpenStreetMap contributors；分发衍生数据库同样以 ODbL 提供 |
| 本项目自建白模/底图 | 继承 OSM ODbL | ✅ | 保留署名；作为独立数据产品销售前确认 ODbL 义务 |
| Cesium ion / Google 3D Tiles | ion 条款 + 第三方条款 | ✅（有 token） | 账号有效、显示 logo/attribution、遵守第三方条款（含不得混图） |
| Sketchfab 模型 | CC0/CC-BY/NC/ND/SA 或 Standard | ✅ 视许可 | CC-BY 署名；NC 不可商用；ND 不可改；核对建筑形象权利 |
| 3D Warehouse 模型 | 逐模型条款 📄 | 需核对 | 逐模型取得商用许可 |
| 天地图/高德 | 官方服务条款 | ✅ 有 key | 申请 key、配额、署名、审图号，禁批量抓取/再分发 |
| 商业倾斜摄影/实景三维 | 商业合同 | ❌ 未购买不可用 | 合同明确版权、二次分发、渲染展示、审图号 |
| Bing/Google 在线影像 | Microsoft/Google 条款 | ⚠️ 不建议 | 遵守条款，注意退役/配额/地域限制 |

**本 Demo 可用的离线/免费数据**：OSM（ODbL）+ 自建白模/底图 + 程序化地标，全部可离线，保留 OSM 署名即可。**对外商用必须确认授权**：航测/倾斜摄影成果、Sketchfab/3D Warehouse 模型、ion/Google/Bing 在线服务、天地图/高德瓦片再分发。

## 7. 参考链接与验证状态

以下为 2026-11-03 本机实测记录（✅ / ⚠️ / 🔑 / 📄 含义见文首）：

- **Cesium/ion**：<https://ion.cesium.com/> ✅🔑 ｜ [OSM Buildings](https://cesium.com/platform/cesium-ion/content/cesium-osm-buildings/) ✅ ｜ [World Terrain](https://cesium.com/platform/cesium-ion/content/cesium-world-terrain/) ✅ ｜ [Photorealistic 3D Tiles](https://cesium.com/learn/cesiumjs-learn/cesiumjs-photorealistic-3d-tiles/) ✅ ｜ [Tiler Data Formats](https://cesium.com/learn/3d-tiling/tiler-data-formats/) ✅ ｜ [3D Buildings 切片](https://cesium.com/learn/3d-tiling/ion-tile-3d-buildings/) ✅ ｜ [MVTDataProvider](https://cesium.com/learn/cesiumjs/ref-doc/MVTDataProvider.html) ✅ ｜ [MVT 教程](https://cesium.com/learn/cesiumjs-learn/load-mapbox-vector-tiles-in-cesiumjs/) ✅ ｜ [Token 指南](https://cesium.com/learn/ion/cesium-ion-access-tokens/) ✅ ｜ [署名指南](https://cesium.com/learn/ion/content-usage-and-attribution-guide/) ✅ ｜ [ToS](https://cesium.com/legal/terms-of-service/) ✅ ｜ [3D Tiles 规范](https://github.com/CesiumGS/3d-tiles) ✅ ｜ [3d-tiles-tools](https://github.com/CesiumGS/3d-tiles-tools) ✅ ｜ [gltf-pipeline](https://github.com/CesiumGS/gltf-pipeline) ✅ ｜ [Cesium License](https://github.com/CesiumGS/cesium/blob/main/LICENSE.md) ✅ ｜ [FME 集成](https://cesium.com/learn/ion/integrations-learn/integrations-fme/) ✅（商业）
- **OSM**：[BBBike](https://extract.bbbike.org/) ✅ ｜ [BBBike 下载站](https://download.bbbike.org/osm/extract/) ✅ ｜ [Geofabrik China](https://download.geofabrik.de/asia/china.html) ⚠️ ｜ [OSM 导出](https://www.openstreetmap.org/export) ⚠️ ｜ [OSM 版权](https://www.openstreetmap.org/copyright) ⚠️ ｜ [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) ⚠️ ｜ [overpass turbo](https://overpass-turbo.eu/) ✅ ｜ [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) ✅ ｜ [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) ✅ ｜ [QGIS](https://qgis.org/download/) ✅ ｜ [QuickOSM](https://plugins.qgis.org/plugins/QuickOSM/) ✅ ｜ [py3dtiles](https://py3dtiles.org/) ✅ ｜ [PyPI](https://pypi.org/project/py3dtiles/) ✅ ｜ [gcoord](https://github.com/hujiulong/gcoord) ✅ ｜ [coordtransform](https://github.com/wandergis/coordtransform) ✅
- **模型/建模**：[Sketchfab](https://sketchfab.com/) ✅ ｜ [Sketchfab 下载规则](https://help.sketchfab.com/en/articles/16152217-downloading-3d-models) ✅ ｜ [3D Warehouse](https://3dwarehouse.sketchup.com/) ✅ ｜ [3D Warehouse Terms](https://3dwarehouse.sketchup.com/terms.html) ✅ ｜ [BlenderGIS](https://github.com/domlysz/BlenderGIS) ✅ ｜ [blender-osm](https://github.com/vvoovv/blender-osm) ✅ ｜ [OSM2World](https://osm2world.org/) ✅ ｜ [gltf-transform](https://gltf-transform.dev/) ✅ ｜ [超图](https://www.supermap.com/) ✅ ｜ [吉奥时空](https://www.geostar.com.cn/) ✅ ｜ [大势智慧](https://www.daspatial.com/) ✅ ｜ [瞰景 Smart3D](https://www.smart3d.cn/) ✅ ｜ [ContextCapture](https://www.bentley.com/software/contextcapture/) ✅ ｜ [DJI Terra](https://www.dji.com/cn/dji-terra) ✅ ｜ [Agisoft](https://www.agisoft.com/) ✅
- **底图**：[天地图](https://www.tianditu.gov.cn/) ✅ ｜ [天地图 API](https://lbs.tianditu.gov.cn/server/MapService.html) ✅ ｜ [天地图·北京](https://beijing.tianditu.gov.cn/) ✅ ｜ [高德](https://lbs.amap.com/) ✅ ｜ [高德开放平台](https://developer.amap.com/) ✅ ｜ [MapTiler](https://www.maptiler.com/) ✅ ｜ [Mapbox](https://www.mapbox.com/) ✅ ｜ CARTO：<https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png> ✅（商用条款需核实）｜ Google 3D Tiles 文档：<https://developers.google.com/maps/documentation/tile/3d-tiles> ⚠️（本机无法访问，覆盖/政策需自行核实）

## 8. 本项目的实际数据选择

本项目（`apps/cbd-digital-twin/`）刻意做成**零在线依赖**的静态 Demo：

```text
BBBike Beijing extract (OSM, 2026-10-31, ODbL 1.0)
  └─ tools/build-city-data.py（--osm-gz / --input / --download）
       ├─ public/data/tiles/white-models/{tileset.json, white-models.glb}  3D Tiles 1.1 白模
       ├─ public/data/roads.geojson / context.geojson / railways.geojson   矢量图层
       ├─ public/data/buildings-fallback.geojson                           兜底建筑面（core 700 栋）
       └─ public/data/basemap.jpg + meta.json                              暗色底图（同 bbox）/ 元数据与署名
```

关键事实（可在 [`../public/data/meta.json`](../public/data/meta.json) 核对）：

| 项目 | 值 |
|---|---|
| 数据源 | BBBike Beijing extract，2026-10-31，ODbL 1.0，© OpenStreetMap contributors |
| bbox | `116.430, 39.885, 116.495, 39.930`（WGS84） |
| 白模 ENU 原点 | `116.4610, 39.9080, 0 m` |
| 白模 | 4320 栋 / 71,187 顶点 / 62,546 三角面 / 2.6 MB，单 tile，3D Tiles 1.1（glTF 内容） |
| 道路 | 1398 条 LineString / 约 360 KB（`class/name/oneway/lanes/bridge/tunnel`） |
| 底图 | `basemap.jpg` 约 452 KB，Rectangle `116.430,39.885,116.495,39.930` |
| 地标 | `public/models/{citic-tower,cctv-hq,cwtc-3a,cwtc-3b}.glb`，**程序化体量，仅示意** |
| 在线 Key | **无**（不接 ion/Bing/天地图/高德） |

对外展示时请保留声明：

- 白模高度是 OSM `height`/`building:levels`/类型默认值的估算结果，**不是测绘成果**，不能用于规划、工程、导航、限高等用途；
- 程序化地标只表达体量与位置关系，不是国贸三期/中国尊/央视总部的真实建筑模型；
- 底图由 OSM 数据绘制，属 ODbL Produced Work，保留 © OpenStreetMap contributors 署名；
- 复现：`python3 tools/build-city-data.py --osm-gz /path/Beijing.osm.gz`（详见 [`../tools/README.md`](../tools/README.md) 与 [`../tools/build-city-data.py`](../tools/build-city-data.py)）。

要升级成「真实感」版本，推荐顺序：商业倾斜摄影成果（含授权）→ 再接 ion/在线底图（注意条款与网络）→ 最后才是全网找免费精模（基本不成立）。
