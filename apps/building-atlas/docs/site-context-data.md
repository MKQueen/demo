# 东四十条 · 街区语境数据（building-atlas）

富华大厦升级项目的**周边街区数据管线与静态数据资产**说明。

> 一句话：`tools/build-site-context.py` 把 BBBike 的北京 OSM extract 加工成
> `public/data/site/` 下的 6 个静态文件（白模 GLB / 路网 / 面要素 / POI / 地块足迹 / meta），
> 供前端 `src/city.js` 直接按需加载，**纯前端、离线可用、无外部依赖**。

- 数据来源：**© OpenStreetMap contributors, ODbL 1.0**（BBBike Beijing extract）
- 生成脚本：`apps/building-atlas/tools/build-site-context.py`（仅 Python 标准库）
- 数据目录：`apps/building-atlas/public/data/site/`
- 坐标原点：富华大厦地块 bbox 中心（WGS84 `116.429613, 39.929566`）
- 覆盖半径：**1500 m**（2026-11-04 由 1200 m 调整；见 §10 变更记录）
- 白模：**1766 栋 / 27,542 三角面 / 1.15 MB**（单 mesh、顶点色、Y-up）

---

## 1. 数据来源与许可

| 项目 | 内容 |
| --- | --- |
| 原始数据 | OpenStreetMap（OSM XML 0.6） |
| extract | BBBike Beijing extract，本地文件 `/tmp/Beijing.osm.gz`（49,514,048 B） |
| 下载地址 | <https://download.bbbike.org/osm/bbbike/Beijing/> |
| 解析统计 | 2,086,268 个 node / 322,013 个 way；原点周边缓存 71,739 node、13,666 个相关 way |
| 许可 | **ODbL 1.0**（Open Database License） |
| 署名 | **© OpenStreetMap contributors (ODbL 1.0)** |
| 版权页 | <https://www.openstreetmap.org/copyright> |
| 许可全文 | <https://opendatacommons.org/licenses/odbl/1-0/> |

本目录产物是 OSM 数据的**衍生数据**，以 ODbL 1.0 兼容方式提供。按 ODbL 要求，
前端页面（页脚 / 数据说明 / 小地图）与 README **必须保留**「© OpenStreetMap contributors」署名；
修改本目录数据后再分发时，也须保留署名与许可信息。

**处理口径**：只读原始 extract，不改动 `/tmp/Beijing.osm.gz`；relation（多面体建筑 / 边界）
未参与白模构建（本区域 relation 建筑极少，extract 中 building relation 共 600 个但基本在远郊），
在 `meta.sourceInfo.relationBuildingTags` 中记录数量。

---

## 2. 产物清单

输出目录：`apps/building-atlas/public/data/site/`

| 文件 | 体积 | 内容 |
| --- | ---: | --- |
| `meta.json` | 4.5 KB | 唯一事实来源：原点 / bbox / localExtent / 图层路径 / 统计 / 高度模型 / 挖空清单 / 署名 |
| `white-models.glb` | 1.15 MB | 周边建筑白模：**单 mesh / 单 primitive**、顶点色、glTF 2.0 Y-up |
| `roads.geojson` | 130 KB | 路网 LineString（534 条，lon/lat，RDP 0.8 m） |
| `landuse.geojson` | 74 KB | 公园 / 绿地 / 水系 / 地块 / 体育场面（193 个 Polygon） |
| `poi.json` | 14 KB | 精简 POI（40 个，含局部米坐标 / 距离 / 权重 / footprintBBox） |
| `site-footprint.geojson` | 6.5 KB | 富华大厦地块 + 六座塔楼矩形 + 中央庭院（8 个面） |
| **合计** | **约 1.37 MB** | 全部静态文件，`public/` 下随构建复制 |

### 关键统计（`meta.stats`）

| 指标 | 数值 |
| --- | --- |
| 白模建筑 | **1766** 栋（footprint 面积 ≥ 15 m²，且与 ±1500 m 方形范围相交） |
| 三角面 | **27,542**（预算 < 120,000） |
| 顶点 | 31,074 |
| 挖空建筑 | **4** 栋（富华大厦自身 OSM 楼栋） |
| 道路 | **534** 条（命名道路 93 条；抽稀前 2627 点 → 1742 点） |
| 面要素 | **193** 个（block 80 / park 68 / sports 29 / forest 11 / water 5） |
| POI | **40** 个（35 个带 footprintBBox） |
| 高度来源 | levels 530 / default 1202 / override 25 / height 9 |
| 白模高度范围 | 0–170 m（有效夹取区间 3–180 m，本次无需夹取） |

---

## 3. 坐标系、原点与朝向

### 3.1 局部米坐标（与契约 §1、前端唯一转换口径完全一致）

```
x = (lon - origin.lon) * 111320 * cos(origin.lat * π/180)     // +X = 东
z = -(lat - origin.lat) * 110540                              // +Z = 南（北 = -Z）
```

- 原点 `ORIGIN`：富华大厦地块（OSM way 78743408）bbox 中心
  `lon = 116.429613`，`lat = 39.929566`，`label = 富华大厦`。
- 前端**从 `meta.origin` 读取**，不要硬编码；`meta.bbox` 与 `meta.localExtent` 预计算好范围。
- 场景坐标单位米，+X = 东、+Y = 上、+Z = 南。

### 3.2 范围

| 字段 | 值 |
| --- | --- |
| `radiusM` | `1500` |
| `bbox`（west, south, east, north） | `[116.4120412, 39.9159963, 116.4471848, 39.9431357]` |
| `localExtent` | `{ "minX": -1650, "maxX": 1650, "minZ": -1650, "maxZ": 1650 }` |

说明：道路 / 面要素严格裁剪到 `±1499.5 m`（留 0.5 m 余量避免圆整越界）；
白模按「footprint 与 ±1500 m 方形范围相交」筛选，跨边界建筑的顶点最远可到约 ±1618 m，
因此 `localExtent` 取实际范围并向上取整到 50 m = **±1650 m**（仍以 `radiusM = 1500` 作为数据半径口径）。

### 3.3 glTF / Three.js 朝向（关键，验收点）

白模 GLB 顶点约定为 **Y-up：`(x = east, y = up, z = -north)`**：

```
glTF 顶点 = (east, up, -north)  →  Three.js 场景 = (x=east, z=south)
```

- Three.js 加载后**不需要任何旋转 / 缩放**，即与英雄模型 `fuhua-mansion.glb` 的
  「+X 东、+Z 南」一致；**不要**加 `rotation.y`。
- 朝向自检（生成时自动打印，`--verify-only` 也会抽检 POI footprint 与白模顶点对齐）：
  - 东中街：最近点 `x = +70.9 m`（**东**）✓
  - 朝阳门北大街：最近点 `x = -113.8 m`（**西**）✓；东二环 trunk 主线最近点 `x = -129.8 m`（**西**）✓
  - 东四十条：最近点 `z = -281.7 m`（**北**）✓
  - 保利大厦：`z = -373.6 m`（**北**）、`x = +33.5 m` ✓
  - 首创大厦 `z = -110.1`（北）、港澳中心 `z = -206.9`（北）、工人体育馆 `x = +546.5`（东）✓
  - 朝阳门站 `z = +718.7`（南）、东直门站 `z = -1120.6`（北）✓

### 3.4 垂直基准

所有高度为「地面 0 m 起算」的示意高度，未引入 DEM / 大地水准面改正；北京地区 geoid
约 −9 m 量级，属整体平移，不影响相对关系与视觉。

---

## 4. 高度模型（展示估算，非测绘）

优先级（`meta.heightModel.priority`，与契约 §2.2 一致）：

1. **`height` tag**：解析米（支持 `35`、`35 m`、`35.5米`、`120,5`）；
2. **`building:levels` × 3.2 + 1.2**（`levelHeight = 3.2 m`，`groundExtra = 1.2 m`）；
3. **名称 override 表**（`build-site-context.py` 顶部 `HEIGHT_OVERRIDES`，37 项可识别地标）；
4. **`building` 类型默认值**（office/commercial 24–40 m、residential 18–22 m、
   hotel 28–40 m、retail 12–18 m、yes 10.8–13.2 m 等；同一 building id 的 MD5 哈希在区间内
   确定性取值，保证重跑结果一致）。

最终高度**夹取到 3–180 m**。本次 1766 栋中：

| 来源 | 数量 | 说明 |
| --- | ---: | --- |
| `height`（OSM tag） | 9 | 最高 170 m（未命名 OSM 楼）、三里屯 SOHO 150 m、新保利大厦 105.2 m 等 |
| `levels`（层数推算） | 530 | e.g. 30 层公寓 → 30×3.2+1.2 = 97.2 m |
| `override`（名称估算表） | 25 | 无 height / levels 的可识别地标，如首创大厦 95 m、港澳中心 50 m |
| `default`（类型默认） | 1202 | 其余住宅 / 商业 / 办公楼 |

> ### ⚠️ 精度声明
> **高度全部为展示用估算，不是实测、不是测绘、不是 BIM。** 只有 9 栋建筑带 OSM `height`，
> 其余为层数推算或名称 / 类型估算；与真实竣工高度可能差别较大。白模整体只用于
> 视觉语境与距离参照，不能用于日照、限高、结构等任何工程判断。

名称 override 表（脚本内常量，按 OSM `name` 精确匹配；**仅当 height / levels 都缺失时生效**）：
首创大厦 95 / 港澳中心 50 / 保利大厦酒店·保利大厦 70 / 中国保利集团 70 / 新保利大厦 105.2 /
五矿广场 65 / 中国移动 40 / 阳光国际大厦 80 / 新中大厦 60 / 东环广场 A·B 55 / 天辰大厦 75 /
亚洲大酒店 60 / 工人体育馆 30 / 北京喜剧院 20 / 合生国际大厦 40 / 东方文华大厦 40 /
文化和旅游部 30 / 外交部新闻中心 40 / 悠唐生活广场 40 / 丰联广场 80 / 中国人寿大厦 60 /
国华投资大厦 80 / 居然大厦 70 / CYTS Plaza 60 / 天恒大厦 70 / 泛利大厦 40 / 中纺大厦 40 /
中海油大厦 90 / 中国人保办公楼 60 / 北京电信大楼 80 / 新闻出版大厦 65 / 东直门交通枢纽 30 /
南新仓商务大厦 70 / 凯恒中心 80（单位 m）。

> 注意：由于契约优先级是 `height → levels → override → default`，**带 `building:levels`
> 的地标会用层数推算值**（如悠唐生活广场 levels=5 → 17.2 m），override 只对无层数地标生效。

### 本次白模最高 10 栋（供人工核对 OSM 误标 / 夹取情况）

| 高度 m | 来源 | 名称 / OSM id | 备注 |
| ---: | --- | --- | --- |
| 170.0 | height | (未命名) `way/347403607` | 工体东侧，OSM 标 170 m，未超 180 未夹取 |
| 150.0 | height | (未命名) `way/191693421` | 三里屯 SOHO 片区，位于东侧边缘 |
| 150.0 | height | (未命名) `way/191693423` | 同上 |
| 150.0 | height | Sanlitun SOHO-A `way/191693428` | 同上 |
| 105.2 | height | 新保利大厦 `way/262855442` | OSM height 自带 |
| 97.2 | levels | (未命名) `way/355262179` | levels=30 |
| 97.2 | levels | (未命名) `way/355262182` | levels=30 |
| 97.2 | levels | (未命名) `way/355262184` | levels=30 |
| 97.2 | levels | 九龙商务中心 `way/556201918` | levels=30 |
| 97.2 | levels | (未命名) `way/637225755` | levels=30 |

> 结论：本次没有 height > 180 m 的误标（最高 170 m），**无需触发 180 m 上限夹取**；
> 若未来数据里出现超大 height，脚本会自动夹取到 180 m 并在生成统计里体现。

---

## 5. 挖空规则（与英雄模型不重叠）

契约 §2.2：**富华大厦自身楼栋不进入白模**，避免与 `public/models/fuhua-mansion.glb` 重叠。

判定规则（命中任一即剔除，`meta.carved.rule`）：

1. footprint 与局部矩形 **x ∈ [-72, 72] ∧ z ∈ [-78, 78]** 相交（多边形-矩形相交，含边界）；
2. footprint **质心距原点 < 95 m**。

本次挖空 **4 栋**（均为 OSM 中富华大厦自身的未命名 `building=yes` footprint）：

| OSM id | 质心距原点 | 挖空原因 |
| --- | ---: | --- |
| `way/1509812626` | 48.9 m | 质心距原点 < 95 m |
| `way/1509812627` | 50.2 m | 质心距原点 < 95 m |
| `way/1509812628` | 40.6 m | 质心距原点 < 95 m |
| `way/1509812629` | 41.9 m | 质心距原点 < 95 m |

说明：OSM 中富华大厦地块（way 78743408，`landuse=commercial`）本身不参与白模；
地块内另有若干**未命名** `building=yes` footprint（1509812626–1509812629），按上述规则
全部挖空。附近 `way/1509812625`（质心 125 m 北）不属于地块内楼栋，正常保留。
`--verify-only` 会断言「挖空框内白模顶点数 = 0」。

---

## 6. 字段字典

所有 GeoJSON 为 `FeatureCollection`，`CRS = WGS84 (EPSG:4326)`，坐标 `[lon, lat]`（7 位小数 ≈ 1 cm），
顶层带 `bbox: [west, south, east, north]`。**未出现的可选属性会省略**，前端读取时请给默认值。

### 6.1 `meta.json`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` / `generator` / `generatedAt` | string | 数据集名称 / 生成器 / ISO8601 生成时间（+08:00） |
| `source` / `sourceInfo` | string / object | 数据源可展示字符串；文件、字节数、extract URL、node/way 统计 |
| `attribution` / `license` / `licenseUrl` / `copyrightUrl` | string | ODbL 署名与许可链接（**页面必须展示 attribution**） |
| `origin` | object | `{ lon, lat, label }`，经纬度 → 局部米的唯一原点 |
| `bbox` | number[4] | `[west, south, east, north]`（WGS84） |
| `radiusM` | number | 数据半径 **1500** |
| `localExtent` | object | `{ minX, maxX, minZ, maxZ }` 场景局部米范围（±1650） |
| `coordConvention` | object | 局部坐标 / 经纬度转换 / glTF 朝向说明 |
| `layers` | object | 图层路径与数量：`whiteModels`（path/count/triangles）、`roads`、`landuse`、`poi`、`siteFootprint` |
| `stats` | object | buildings / roads / landuse / poi / carvedBuildings / prunedBuildings / triangles / vertices / glbBytes / roadsPoints / heightSources |
| `heightModel` | object | `levelHeight` / `groundExtra` / `priority` / `validRangeM` / `overrideCount` / `note` |
| `carved` | object | 挖空数量、规则、被挖空建筑清单（id / name / distanceM / reason） |
| `landuseKinds` / `poiKinds` / `roadNames` | object | 分类计数与关键干路名清单 |
| `limitations` | string[] | 精度与已知限制 |

### 6.2 `roads.geojson`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | `way/<OSM id>`；被裁剪 / 断开的折线加 `#0`、`#1` 后缀 |
| `class` | string | `motorway/trunk/primary/secondary/tertiary/residential/unclassified/living_street` 及 `_link`；站点周边 `pedestrian/footway` |
| `name` | string? | 中文路名（关键干路必须保留，见下） |
| `ref` | string? | 道路编号（如 `G102`） |
| `oneway` | string? | `"yes"` / `"-1"`（`-1` = 几何方向与通行方向相反） |
| `lanes` | number? | 车道数（`lanes` tag 首个整数） |
| `bridge` / `tunnel` | string? | 桥梁 / 隧道，值为 `"yes"` |

- 保留等级：车行等级 + 站点周边 600 m 内的 `pedestrian/footway`（用于人行连廊与近景细节）。
  不收 `service/cycleway/steps/path/track/construction`。
- 折线 **RDP 抽稀 ≤ 0.8 m**，裁剪到 `±1499.5 m` 方形范围。
- 关键干路 `name` 全部保留：**东四十条 / 东中街 / 朝阳门北大街 / 东二环 / 工人体育场北路 /
  东直门南大街 / 东直门内大街 / 朝阳门内大街 / 朝阳门外大街**（共 93 条命名道路）。

### 6.3 `landuse.geojson`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | `way/<OSM id>` |
| `kind` | string | `park` / `forest` / `water` / `block` / `plaza` / `sports` |
| `class` | string | 原始 tag 值（如 `park`、`commercial`、`pitch`、`water`） |
| `name` | string? | 名称（如 `日坛公园`、`富华大厦`、`北京工人体育场`） |

- 面积 < 200 m² 的杂项丢弃；**水系 / 公园 / 森林全部保留**（本次共 193 个面）。
- `kind` 分类：`natural=water / waterway=riverbank|dock|canal / landuse=basin|reservoir` → `water`；
  `natural=wood / landuse=forest` → `forest`；`leisure=park|garden|common|playground…`、
  `landuse=grass|meadow|flowerbed…` → `park`；`leisure=pitch|track|stadium|sports_centre…` → `sports`；
  `place=square` / 成面 `highway=pedestrian` → `plaza`；其余 `landuse/leisure` → `block`。
- 本区域 OSM 没有成面的 `highway=pedestrian + area=yes` 广场，故 `plaza` 数量为 0（枚举仍保留）。

### 6.4 `poi.json`

```jsonc
{
  "pois": [
    {
      "id": "poi/10",              // 稳定编号（按 distanceM 升序）
      "name": "东四十条站",
      "kind": "metro",             // metro/landmark/office/hotel/culture/park/stadium/education/government
      "lon": 116.4281,             // WGS84
      "lat": 39.9323,
      "x": -137.1,                 // 局部米 +X 东
      "z": -300.8,                 // 局部米 +Z 南（北 = -Z）
      "distanceM": 330.6,          // hypot(x, z)
      "note": "地铁 2 号线",
      "weight": 5,                 // 1–5，越大越重要
      "footprintBBox": [-163.9, -317.9, -110.3, -283.7]  // 可选：[minX, minZ, maxX, maxZ] 局部米
    }
  ],
  "attribution": "© OpenStreetMap contributors (ODbL 1.0)",
  "origin": { "lon": 116.429613, "lat": 39.929566, "label": "富华大厦" },
  "note": "x/z 为局部米（+X 东 / +Z 南）…"
}
```

- 坐标从 OSM 节点（地铁站）或建筑 footprint 面积加权质心取；`name` 以 OSM `name` 优先，
  `note` 为人工补充说明（如线路、别名）。
- `footprintBBox` 供前端高亮楼栋 / 小地图使用（35 个 POI 带该字段）。
- 距离为**直线距离**（不受挖空 / 几何半径限制），4 个地铁站全部收录（工人体育场站 1283 m
  略超 1500 m 半径的数据范围，但作为 POI 保留，前端 `poisWithin(rangeM)` 自行过滤）。

### 6.5 `site-footprint.geojson`

| `kind` | 数量 | 说明 |
| --- | ---: | --- |
| `site` | 1 | 富华大厦地块面（OSM way 78743408，`landuse=commercial`），实测 **15,750 m²**（约 126×125 m），`areaM2` 字段 |
| `tower` | 6 | 六座塔楼矩形：A/B/C 西侧（x=-27），D/E/F 东侧（x=+27）；A/C/D/F 23×25 m、B/E 19×31 m；含 `towerId/x/z/widthM/depthM` |
| `courtyard` | 1 | 中央庭院示意矩形（x±15.5、z±40.5，31×81 m），`schematic: true`；与 `src/floors.js` 的 TOWERS 对应 |

前端用 `site` 面做地面高亮 / 小地图填充，`tower` 用于楼层模式与小地图示意。
塔楼矩形为**模型真实位置**（场景局部米），不是 OSM 测绘 footprint。

### 6.6 `white-models.glb` 内部结构

- **单 mesh / 单 primitive**，`mode = TRIANGLES (4)`，一次 draw call；
- 顶点布局（每个 footprint 点 n → 3n 个顶点，共 31,074 顶点 / 27,542 三角面）：

| 顶点段 | 数量 | 法线 | 用途 |
| --- | ---: | --- | --- |
| 墙底 `b_i` | n | 相邻两墙外法线归一化平均（水平） | 竖向渐变暗色 |
| 墙顶 `t_i` | n | 同上 | 亮色 |
| 屋顶 `r_i` | n | `(0, 1, 0)`（glTF Y-up 朝上） | 屋顶色 |

- 三角化：**耳切法**（自实现），环先规范化为逆时针、去重 / 去共线；退化环回退扇形三角化；
- 属性：`POSITION`（float32 VEC3，带 min/max）、`NORMAL`（float32 VEC3）、
  `COLOR_0`（normalized ubyte VEC4）、`indices`（UNSIGNED_INT）；
- 颜色：近白偏冷灰，按高度三档（< 24 m / 24–80 m / ≥ 80 m），叠加 building id 哈希微调 ±0.028、
  墙底 ×0.88、屋顶 ×1.02；
- 材质：`metallicFactor = 0.02`、`roughnessFactor = 0.85`、`doubleSided = true`、顶点色；
  **无贴图 / 无外部依赖**；
- 三角面预算 < 120k、体积上限 5 MB；若超限脚本会按 `height×√area` 升序**确定性裁剪**
  （`stats.prunedBuildings`），本次未触发（27.5k 面 / 1.15 MB）。

---

## 7. POI 名单（40 个）

按距离升序（`distanceM = hypot(x, z)`，局部米；`+X` 东、`+Z` 南）：

| # | 名称 | kind | 局部坐标 x/z (m) | 距离 (m) | weight | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 首创大厦 | `landmark` | -7.7, -110.1 | 110.4 | 4 | 首创大厦（东四十条桥东北角） |
| 2 | 中国移动 | `office` | 148.4, 88.8 | 172.9 | 3 | 中国移动（东中街） |
| 3 | 文化和旅游部 | `government` | -20.1, 181.5 | 182.6 | 4 | 中华人民共和国文化和旅游部 |
| 4 | 港澳中心 | `hotel` | -11.9, -206.9 | 207.2 | 4 | 港澳中心 · 酒店 / 写字楼 |
| 5 | 阳光国际大厦 | `office` | 241.0, 30.4 | 242.9 | 3 | 写字楼 |
| 6 | 北京喜剧院 | `culture` | -256.5, 83.4 | 269.8 | 4 | 剧场 |
| 7 | 五矿广场 | `office` | -256.4, -102.0 | 276.0 | 4 | 五矿广场（多栋） |
| 8 | 天辰大厦 | `office` | 3.9, 309.7 | 309.7 | 3 | 写字楼 |
| 9 | 新中大厦 | `office` | 192.7, -242.8 | 310.0 | 3 | 写字楼 |
| 10 | 东四十条站 | `metro` | -137.1, -300.8 | 330.6 | 5 | 地铁 2 号线 |
| 11 | 亚洲大酒店 | `hotel` | 286.3, -172.3 | 334.2 | 3 | 酒店 |
| 12 | 新保利大厦 | `landmark` | -276.4, -203.2 | 343.0 | 5 | 105.2 m · OSM 自带 height |
| 13 | 保利大厦 | `hotel` | 33.5, -373.6 | 375.1 | 5 | 保利大厦 · 酒店 / 写字楼 |
| 14 | 东四奥林匹克社区公园 | `park` | -210.6, 323.0 | 385.6 | 3 | 社区公园 |
| 15 | 北京保利剧院 | `culture` | 0.7, -400.2 | 400.2 | 4 | 保利剧院 |
| 16 | 中国保利集团 | `landmark` | -25.4, -433.1 | 433.9 | 4 | 保利集团总部 |
| 17 | 新中街城市森林公园 | `park` | 412.9, -203.5 | 460.3 | 3 | 城市森林公园 |
| 18 | 中国人保办公楼 | `office` | -212.8, 416.1 | 467.4 | 3 | 写字楼 |
| 19 | 工人体育馆 | `stadium` | 546.5, -137.1 | 563.4 | 4 | 体育馆 |
| 20 | 北京电信大楼 | `office` | -267.2, 504.3 | 570.7 | 3 | 写字楼 |
| 21 | 东环广场B座 | `office` | 21.8, -596.1 | 596.5 | 3 | 东环广场 B 座 |
| 22 | 中海油大厦 | `office` | -248.1, 626.9 | 674.2 | 3 | 写字楼 |
| 23 | 朝阳门站 | `metro` | -141.9, 718.7 | 732.5 | 5 | 地铁 2 号线 / 6 号线 |
| 24 | 东环广场A座 | `office` | 12.3, -793.1 | 793.2 | 3 | 东环广场 A 座 |
| 25 | CYTS Plaza | `office` | -259.9, -764.8 | 807.7 | 3 | 中青旅大厦 |
| 26 | 中纺大厦 | `office` | -76.0, -808.4 | 812.0 | 3 | 写字楼 |
| 27 | 丰联广场 | `landmark` | 236.9, 806.9 | 841.0 | 3 | 购物中心 / 写字楼 |
| 28 | 居然大厦 | `office` | -281.6, -820.7 | 867.7 | 3 | 写字楼 |
| 29 | 中国人寿大厦 | `office` | 347.2, 806.1 | 877.7 | 3 | 写字楼 |
| 30 | 国华投资大厦 | `office` | -295.1, -893.0 | 940.5 | 3 | 写字楼 |
| 31 | 泛利大厦 | `office` | 354.2, 895.2 | 962.7 | 3 | 写字楼 |
| 32 | 北京工人体育场 | `stadium` | 972.1, 8.6 | 972.1 | 5 | 工人体育场（足球场） |
| 33 | 外交部新闻中心 | `government` | 1.9, 1022.8 | 1022.8 | 4 | 外交部新闻中心 |
| 34 | 天恒大厦 | `office` | 108.7, -1025.9 | 1031.7 | 3 | 写字楼 |
| 35 | 悠唐生活广场 | `landmark` | 338.1, 1014.7 | 1069.5 | 3 | 购物中心 |
| 36 | 簋街 | `landmark` | -225.9, -1093.2 | 1116.3 | 4 | 东直门内大街 · 餐饮街（取道路点） |
| 37 | 东岳文化广场 | `park` | 683.2, 884.7 | 1117.8 | 3 | 文化广场 |
| 38 | 东直门站 | `metro` | -165.2, -1120.6 | 1132.7 | 5 | 地铁 2 号线 / 13 号线 / 首都机场线 |
| 39 | 东直门交通枢纽 | `landmark` | 62.3, -1255.5 | 1257.1 | 4 | 交通枢纽 / 商业综合体 |
| 40 | 工人体育场站 | `metro` | 1245.5, -308.3 | 1283.1 | 4 | 地铁 3 号线 / 17 号线（2023 年底开通） |

说明：

- 契约 §2.5 要求覆盖的地标全部在列：东四十条站、东直门站、朝阳门站、保利大厦、保利剧院、
  港澳中心、首创大厦、亚洲大酒店、新中大厦、阳光国际大厦、中国移动、东环广场（A/B 两座）、
  新保利大厦、五矿广场、天辰大厦、工人体育馆、北京喜剧院、外交部新闻中心、簋街、悠唐 / 丰联广场。
- **簋街**在 OSM 无同名要素，取「东直门内大街」道路上的点（note 已注明）。
- 地铁线路备注为人工补充（OSM 站点 node 不带线路信息）。
- 名称以 OSM `name` 优先，个别做了展示名归并（如「保利大厦酒店」→「保利大厦」、
  「中华人民共和国文化和旅游部」→「文化和旅游部」），`note` 保留 OSM 原名信息。

---

## 8. 生成与校验

### 8.1 生成（可确定性重跑）

```bash
cd apps/building-atlas
PY=/Users/one/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3

# 默认：读取 /tmp/Beijing.osm.gz，输出 public/data/site/，半径 1500 m
$PY tools/build-site-context.py --osm-gz /tmp/Beijing.osm.gz

# 只校验已有产物（不解析 OSM）
$PY tools/build-site-context.py --verify-only

# 换范围 / 原点
$PY tools/build-site-context.py --radius 1200 --origin 116.429613,39.929566
```

- 仅标准库（`gzip` / `xml.etree.ElementTree` / `json` / `struct` / `array` / `hashlib` / `math`），
  无 GDAL / pyproj / shapely / numpy 依赖；
- 一次完整生成约 **11 s**（解析 49.5 MB gzip 占 10 s）；
- 结果可复现：除 `meta.json` 的 `generatedAt` 外，**其余 5 个产物逐字节一致**（已用 sha256 验证）；
- `--radius` / `--origin` 覆盖默认值；输出目录 `--out` 可换。

### 8.2 自动校验（56 项，生成后默认执行 / 可 `--verify-only` 单独跑）

| 类别 | 校验内容 |
| --- | --- |
| meta | 必填字段、署名 ODbL、origin、bbox 顺序、localExtent、heightModel、图层路径、数量与文件一致 |
| GLB | magic/version/length、chunk 4 字节对齐、JSON 可解析、bufferView 边界、accessor 类型（POSITION float32 / COLOR_0 ubyte normalized / indices uint32）、索引范围、三角面 < 120k、文件 < 5 MB、POSITION min/max 与实测一致、Y-up（墙底 y≈0、上限 ≤180）、**挖空框内 0 顶点**、**POI footprint 与白模顶点方位对齐**（朝向自检）、法线朝向 |
| roads | LineString、关键干路 name、class 白名单、坐标在 bbox 内 |
| landuse | kind 白名单、Polygon、环闭合、含公园 / 水系 / 地块 |
| poi | ≥ 20 个、schema、kind/weight、x/z 与 lon/lat 公式自洽、distanceM 自洽、契约关键清单、关键距离抽查（东四十条站 ≈331 m、保利大厦 ≈375 m、首创大厦 ≈110 m、港澳中心 ≈207 m） |
| site-footprint | site/tower/courtyard 齐全、地块面积 ≈125×130 m、塔楼尺寸 23×25 / 19×31 |
| 体积 | 各文件体积、合计 < 8 MB |

另外已验证：

- 用真实 **Three.js 0.170 `GLTFLoader`**（Node 24）加载 `white-models.glb`：
  1 mesh / 27,542 三角面 / 31,074 顶点，`MeshStandardMaterial`（metallic 0.02、roughness 0.85、
  DoubleSide、`vertexColors = true`），bbox 与 meta 一致；
- 按 `meta.origin` + 契约公式把 `roads.geojson` / `poi.json` 投影到局部米后作图核对：
  东中街在东（x≈+71）、二环/朝阳门北大街在西（x≈-110）、东四十条与保利大厦在北（z≈-300/-374）、
  朝阳门站与外交部新闻中心在南（z≈+719/+1023）。

---

## 9. 精度声明与已知限制

> **本数据集是展示用街区语境数据，不是测绘成果、不是 GIS 数据产品、不是 BIM，不能用于任何
> 工程、规划、权属或安全判断。**

| 项目 | 说明 |
| --- | --- |
| OSM 数据质量 | footprint 由社区绘制，存在简化、偏移、缺失；本区域大量小院 / 胡同未单独成面 |
| 建筑高度 | 1766 栋中仅 9 栋有 OSM `height`，530 栋由层数推算，25 栋按名称估算，1202 栋按类型默认；**误差可能达数十米** |
| 缺失建筑 | OSM 只映射了部分建筑（±1500 m 内 1766 栋），非完整城市模型；仅统计「面积 ≥ 15 m²」的面 |
| 道路 | 只保留契约规定等级 + 站点周边步道；`service/cycleway/steps` 未收录；RDP 0.8 m 抽稀，几何误差 ≤ 0.8 m |
| 地形 | 未引入 DEM，地面按 0 m；无高差 |
| 白模 | 挤出体块，不含屋顶细节 / 材质纹理；跨 ±1500 m 边界的建筑可能伸出到 ±1618 m |
| 地块 / 塔楼 | `site` 面来自 OSM way 78743408；`tower` / `courtyard` 为模型坐标生成的**示意矩形**，不是 OSM 测绘 footprint |
| 时相 | 以本地 BBBike extract 为准（2026-11 下载）；OSM 数据本身随时间变化 |
| relation | 未处理多面体建筑 relation（本区域极少） |

---

## 10. 变更记录

- **2026-11-04**：数据半径由 **1200 m 调整到 1500 m**（Lead 决定）。
  原因：北京内城 OSM 建筑密度有限，±1200 m 仅约 950 栋，视觉偏稀；±1500 m 得到 1766 栋
  （acceptance `buildings > 1500`），三角面仍仅 27.5k、GLB 1.15 MB。
  随之 `meta.radiusM = 1500`、`bbox` 扩大、`localExtent = ±1650`、`poi.json` 覆盖更多地标；
  契约与 UI 文案同步为「1.5 km 街区语境」。
- 首版脚本同时支持 `--radius` 参数，后续如需回到 ±1200 m 可直接重跑（无需改代码）。

---

## 11. 目录与脚本结构

```
apps/building-atlas/
├── tools/
│   └── build-site-context.py         # 本管线（仅标准库，生成 + --verify-only）
├── public/data/site/                 # 本目录产物（随构建复制到 dist/data/site/）
│   ├── meta.json
│   ├── white-models.glb
│   ├── roads.geojson
│   ├── landuse.geojson
│   ├── poi.json
│   └── site-footprint.geojson
└── docs/
    └── site-context-data.md          # 本文档
```

脚本顶部集中定义所有可调参数：`ORIGIN_*` / `DEFAULT_RADIUS_M` / `SITE_WAY_ID` /
`CARVE_BOX_LOCAL` / `HEIGHT_OVERRIDES` / `DEFAULT_HEIGHTS` / `TOWERS` / `TIER_COLORS` /
`ROAD_SIMPLIFY_TOL_M` / `MIN_LANDUSE_AREA_M2` 等；改这里即可换区域 / 调参。

---

## 12. ODbL 署名（必须保留）

> 本目录数据由 OpenStreetMap 数据加工而来：
> **© OpenStreetMap contributors, ODbL 1.0**
>
> - 版权页：<https://www.openstreetmap.org/copyright>
> - 许可证全文：<https://opendatacommons.org/licenses/odbl/1-0/>
> - extract 来源：<https://download.bbbike.org/osm/bbbike/Beijing/>

页面 footer、数据说明、小地图与 README 必须展示「© OpenStreetMap contributors (ODbL 1.0)」；
衍生数据须以 ODbL 兼容方式提供。
