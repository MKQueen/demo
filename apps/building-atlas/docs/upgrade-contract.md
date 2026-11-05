# 富华大厦升级 · 模块契约 v1（Lead 维护，改动须先在团队里同步）

目标：把「孤岛式建筑模型」升级为「建筑 + 东四十条街区语境」的数字档案：
周边 OSM 白模、路网、绿地、地标 POI、车流/树/路灯/喷泉、昼夜氛围与后处理，
同时保留并强化原有「楼层分层」功能。全部纯前端、可静态托管、离线可用。

---

## 0. 现有工程事实（不要破坏）

- Three.js 0.170 + Vite 6，`base: './'`；所有资源用 `import.meta.env.BASE_URL` 拼相对路径。
- 英雄模型 `public/models/fuhua-mansion.glb`：48 mesh / 202,728 三角面；站点范围
  `x ∈ [-47, 47]，z ∈ [-53, 53]，y ∈ [-1.35, 67.6]`；GLB 轴向 **+X = 东，+Z = 南**（北 = -Z）。
- 六座塔楼数据在 `src/floors.js`（`TOWERS`，A–F 平面中心/尺寸/高度）。
- 现有整体模式、楼层分层、昼夜、视图、影像档案都必须继续可用。
- 新增代码尽量拆成独立模块，避免多人同时改 `src/main.js` / `index.html` / `src/style.css`（Lead 独占）。

## 1. 坐标、单位、朝向（全员统一）

- 场景坐标：单位米；**+X = 东，+Y = 上，+Z = 南**（即北 = -Z）。
- 英雄建筑 GLB 已放在场景原点，朝向与上一致，**不要旋转/缩放它**。
- OSM 数据原点 `ORIGIN`（富华大厦地块 bbox 中心，WGS84）：
  - `lon = 116.429613`，`lat = 39.929566`（以生成产物 `meta.origin` 为准，前端从 meta 读取，勿硬编码）。
- 经纬度 → 局部米（前端唯一转换口径）：

  ```
  x = (lon - origin.lon) * 111320 * cos(origin.lat * π/180)
  z = -(lat - origin.lat) * 110540
  ```

- 白模 glTF 顶点约定：**(x=east, y=up, z=-north)**。
  Three.js 加载后不做任何旋转即为「+X 东、+Z 南」，与英雄模型一致；不要额外 `rotation.y`。
- 地块层级（用于挖空/高亮/小地图）：真实富华大厦地块约 125 m × 130 m，
  `x ∈ [-64, 64]，z ∈ [-65, 65]`；英雄模型比真实地块略小（模型 94 × 106 m），
  多出来的边缘由 site-dressing 的广场/绿化补齐，**不要缩放英雄模型**。

## 2. 数据产物（负责人：osm-data）

输出目录：`apps/building-atlas/public/data/site/`

| 文件 | 内容 |
| --- | --- |
| `meta.json` | 唯一事实来源：原点、范围、统计、图层路径、署名、高度模型 |
| `white-models.glb` | 周边建筑白模，单 mesh（或少量 primitive），顶点色，Y-up |
| `roads.geojson` | 车行/步行路网 LineString（lon/lat） |
| `landuse.geojson` | 公园/绿地/水系/地块/广场面（lon/lat） |
| `poi.json` | 精简 POI（含局部米坐标与直线距离），供 UI/标签/小地图用 |
| `site-footprint.geojson` | 富华大厦地块与塔楼足迹（挖空、高亮、小地图） |

### 2.1 meta.json（字段契约）

```jsonc
{
  "name": "东四十条 · 街区语境数据",
  "generatedAt": "ISO8601",
  "source": "OpenStreetMap · BBBike Beijing extract",
  "attribution": "© OpenStreetMap contributors (ODbL 1.0)",
  "license": "ODbL 1.0",
  "origin": { "lon": 116.429613, "lat": 39.929566, "label": "富华大厦" },
  "bbox": [116.41, 39.918, 116.45, 39.942],          // west,south,east,north（WGS84）
  "radiusM": 1500,
  "localExtent": { "minX": -1560, "maxX": 1560, "minZ": -1520, "maxZ": 1520 },
  "layers": {
    "whiteModels": { "path": "data/site/white-models.glb", "count": 2345, "triangles": 95000 },
    "roads":       { "path": "data/site/roads.geojson", "count": 520 },
    "landuse":     { "path": "data/site/landuse.geojson", "count": 180 },
    "poi":         { "path": "data/site/poi.json", "count": 24 },
    "siteFootprint": { "path": "data/site/site-footprint.geojson" }
  },
  "stats": {
    "buildings": 2345, "roads": 520, "landuse": 180, "poi": 24,
    "carvedBuildings": 6, "heightSources": { "height": 12, "levels": 800, "override": 20, "default": 1500 }
  },
  "heightModel": {
    "levelHeight": 3.2, "groundExtra": 1.2,
    "priority": ["height tag", "building:levels", "name override", "type default"],
    "note": "高度为 OSM/估算示意，非测绘"
  }
}
```

### 2.2 white-models.glb 规格

- 范围：以原点为中心约 **±1500 m**（2026-11-04 决策：内城 OSM 建筑密度有限，1200m 内约 950 栋，扩到 1500m 约 1740 栋，几何量仍很小）；只保留 `building=*` 且 footprint 面积 ≥ 15 m² 的面。
- **挖空英雄地块**：footprint 与 `x ∈ [-72, 72] ∧ z ∈ [-78, 78]` 相交，
  或质心距原点 < 95 m 的建筑一律不生成（数量写进 `stats.carvedBuildings`）。
- 高度优先级：`height`（米）→ `building:levels × 3.2 + 1.2` → 名称 override 表 → 类型默认值；
  有效范围 3–180 m，超范围夹取。名称 override 表针对 30–40 个可识别地标（见 §2.5）。
- 近白偏冷灰顶点色，按高度 3 档（低 / 中 / 高）+ 微小确定性抖动；墙底略暗、屋顶略亮。
- 单 mesh / 少量 primitive，总三角面 **< 120k**，文件 **< 5 MB**；耳切三角化 + 挤出。
- 材质建议：`metallic 0.02, roughness 0.85, doubleSided true`，顶点色 `COLOR_0`。
- **不要**包含富华大厦自身的六栋楼，避免与英雄 GLB 重叠。

### 2.3 roads.geojson

- Feature：`{ id, class, name?, ref?, oneway?, bridge?, tunnel?, geometry: LineString }`
- 保留 `motorway/trunk/primary/secondary/tertiary/residential/unclassified/living_street` 及 `_link`、
  以及站点周边的 `pedestrian/footway`（用于人行连廊，可选；前端按 class 淡化）。
- 对 `东四十条 / 东中街 / 朝阳门北大街 / 东二环 / 工人体育场北路 / 东直门南大街 / 东直门内大街 / 朝阳门内大街 / 朝阳门外大街` 等干路必须保留 `name`。
- 折线 RDP 抽稀 ≤ 0.8 m；裁剪到 bbox。

### 2.4 landuse.geojson

- Feature：`{ id, kind: "park"|"forest"|"water"|"block"|"plaza"|"sports", class, name?, geometry: Polygon }`
- 小面积杂项（< 200 m²）可丢弃；水系/公园全部保留。

### 2.5 poi.json

`{ "pois": [ { "id","name","kind","lon","lat","x","z","distanceM","note","weight" } ] }`

- `kind` 取值：`metro` / `landmark` / `office` / `hotel` / `culture` / `park` / `stadium` / `education` / `government`。
- `x/z` 为局部米（§1 公式），`distanceM = hypot(x,z)`，`weight` 1–5（越大越重要）。
- 至少覆盖：东四十条地铁站、东直门站、朝阳门站、保利大厦、保利剧院、港澳中心、首创大厦、
  亚洲大酒店、新中大厦、阳光国际大厦、中国移动、东环广场、新保利大厦、五矿广场、天辰大厦、
  工人体育馆、北京喜剧院、外交部新闻中心、簋街、悠唐/丰联广场（视 OSM 命中情况取舍）。
- 坐标从 OSM 节点/建筑质心取；名字以 OSM `name` 优先，可人工补充 `note`（如「2 号线」）。
- 附近地标建筑建议提供 `footprintBBox: [minX,minZ,maxX,maxZ]`（局部米），用于前端高亮。

### 2.6 site-footprint.geojson

- `kind: "site"`：富华大厦地块/landuse 面（OSM way 78743408）；
- `kind: "tower"`：模型六座塔楼真实位置（可用 `TOWERS` 的 x/z 与尺寸生成 23×25 / 19×31 矩形）；
- `kind: "courtyard"`：中央庭院矩形（便于小地图示意图）。
- 前端用 site 面做地面高亮、小地图填充。

### 2.7 数据管线脚本

- `apps/building-atlas/tools/build-site-context.py`，仅用 Python 标准库（Python 3.12 便捷运行时：
  `/Users/one/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3`）。
- 支持：
  - `--osm-gz /tmp/Beijing.osm.gz`（已下载好的 BBBike 北京 extract，gzip 完整）；
  - `--out apps/building-atlas/public/data/site`；
  - `--verify-only`（校验产物 meta/GLB/GeoJSON 自洽，不重新生成）；
  - `--origin lon,lat`、`--radius 1500` 可覆盖默认值。
- 生成结果需可复现（排序确定、无时间戳参与统计之外的随机性）。
- 另写 `apps/building-atlas/docs/site-context-data.md`：数据来源、OSM 坐标/朝向/高度模型、
  挖空规则、文件字段、体积、ODbL 署名、精度声明。
- **不要修改** `src/`、`index.html`、`src/style.css`、`README.md`、`hub/` 下任何文件；
  只新增 `tools/build-site-context.py`、`public/data/site/**`、`docs/site-context-data.md`。

## 3. `src/city.js` 契约（负责人：city-renderer）

自包含 ES module，import three 直接用，`BASE_URL = import.meta.env.BASE_URL`。

```js
export async function createCityContext({ scene, camera, renderer, labelHost, onProgress, onPoiClick } = {}) {
  // 返回 Promise<city>。data 加载失败时 buildProceduralFallback()，不得 console.error、不得阻塞页面。
}

// city 对象（名义 API，全部要实现，主工程会消费）：
city.group                  // THREE.Group，已 add 到 scene；楼宇/路网/绿地都在里面
city.loaded                 // boolean
city.meta                   // meta.json 原始对象（或 fallback 元数据）
city.data                   // { roads: Feature[], landuse: Feature[], poi: [], site: Feature[], byName: Map }
city.layers                 // { whiteModels: true, roads: true, landuse: true, poi: true, site: true, rings: false }
city.setLayer(name, on)     // 切换图层可见性，返回 boolean
city.toggleLayer(name)
city.setAllVisible(on)      // 楼层模式用：整组显示/隐藏
city.setNight(mode)         // 'day' | 'dusk' | 'night'：白模色调/自发光、路网亮度、POI 亮灯
city.setHighlightSite(on)   // 地块高亮/描边
city.update(dt, now)        // 每帧：DOM POI 标签投影定位、显隐、必要动画
city.setView(viewName)      // 可选：'city' | 'ring' 预设机位（相机由 main 控制时可不实现）
city.minimapSvg({ width = 240, height = 240, rangeM = 1200 } = {}) // 返回 SVG 字符串（含道路/绿地/水系/地块/地铁/POI/地块高亮/指北针）
city.poisWithin(rangeM)     // 返回按 weight、距离排序的 POI 数组
city.stats                  // { buildings, roads, landuse, poi, triangles, drawCalls }
city.dispose()
```

要求：

- 白模：**合并/实例化**，draw call ≤ 4；整个 city group 的 draw call 目标 ≤ 12（白模 1 + 路网 4 档 + 绿地水系地块 ≤ 5 + 环/描边 ≤ 2，实测 11，可接受）；与英雄模型不重叠（数据已挖空）；默认 `MeshStandardMaterial`
  + 顶点色 + `flatShading=false`；dusk/night 时降低明度并给近处楼宇轻微窗光（可选）。
- 路网：按 class 分 3–4 档颜色/宽度（可以合并成每档一个 LineSegments 或 ribbon mesh）；
  干路发光感：日景低亮度、夜景略亮；道路贴地 y ≈ 0.05–0.2，不与地面 z-fight。
- 绿地/水系/地块：多边形平铺 y ≈ 0.02–0.12，颜色低饱和；水系略带反光。
- 地块：`site` 图层绘制地块填充 + 金色描边（与现有 --gold #c7b58f / #f4b35b 设计语言一致）。
- 距离环 `rings`：200 / 500 / 1000 m 虚线圆环 + 距离标注（可选 DOM/Sprite），默认关闭。
- POI：DOM 标签（放在 `labelHost`，由 main 传入 `#city-labels`），最多 12–16 个；
  近处/高 weight 优先；`city.setLayer('poi', false)` 全部隐藏；点击标签回调 `onPoiClick(poi)`。
  小地图 SVG 同时点出地铁站与主要地标。
- 性能：整组三角面 < 200k；更新循环只做 DOM 投影，不重建 geometry；不产生每帧分配的大对象。
- 降级：`fetch` 失败 / GLB 解析失败 → 用程序化 9 个低模街区（现有观感）+ `console.warn`，
  `city.loaded = true`、`stats.fallback = true`，页面不报错。验证脚本会对 fallback 做降级断言。
- 代码放在 `src/city.js`（可加 `src/city/` 子目录，但入口必须是 `src/city.js`）；不要改其他 src 文件。

## 4. `src/atmosphere.js` + `src/site-dressing.js` 契约（负责人：scene-art）

### 4.1 atmosphere.js

```js
export function createAtmosphere({ scene, camera, renderer, lights, controls } = {}) {
  // lights: { sun, ambient, fill } —— main.js 已创建的灯，由本模块接管颜色/强度
}
atmo.preset                 // 'day' | 'dusk' | 'night'
atmo.setPreset(name)        // 平滑过渡（~0.9s）；改天空/雾/日光/曝光/自发光；返回 preset
atmo.cyclePreset()          // day → dusk → night → day
atmo.setModel(model)        // 英雄 GLB 加载完成后调用；用于夜景窗光 shader 注入/材质增强
atmo.setShadows(on)
atmo.update(dt, now)        // 天空/星光/楼顶航空灯/窗光 uniform 平滑
atmo.render()               // 有 composer 时 composer.render()，否则 renderer.render(scene,camera)
atmo.resize(w, h)
atmo.sun, atmo.sky, atmo.composer  // 供调试
```

要求：

- **天空**：自定义 ShaderMaterial 穹顶（BackSide 大球），日/黄昏/夜三套渐变 + 太阳/月亮盘 +
  夜间星星（微弱、可关闭）；与 `scene.fog`、`scene.background` 同步过渡。
- **光照**：日景现有暖阳；黄昏低角度金色斜阳（阴影更长）；夜景月光冷蓝 + 环境低强度。
  阴影相机范围保持覆盖英雄建筑（约 ±100 m），城市白模不投/不接收阴影以免开销。
- **夜景窗光**：对英雄模型玻璃材质（`material.name` 含 `glass`，大小写不敏感）注入
  `onBeforeCompile`：按世界坐标 + 法线方向生成窗格，hash 决定亮/暗，暖黄自发光；
  `uNight` 平滑 0–1。实现需健壮（材质可能被 clone、可能没有 uv），失败时仅告警。
- **后处理**：EffectComposer + RenderPass + UnrealBloomPass + OutputPass；
  bloom 夜间 strength ≈ 0.5–0.7、日间 ≈ 0.12；半分辨率；构建失败自动回退 renderer.render。
- **楼顶航空障碍灯**：六座塔顶红色小灯，夜晚闪烁（Sprite/Points 均可）。
- 不改 main.js / index.html / style.css；不新增外部依赖；three addons 只用官方 examples/jsm。

### 4.2 site-dressing.js

```js
export function createSiteDressing({ scene, renderer, camera, city } = {}) {}
dressing.group              // THREE.Group
dressing.update(dt, now)
dressing.setNight(mode)     // 'day' | 'dusk' | 'night'
dressing.setLayer(name, on) // 'trees' | 'lamps' | 'cars' | 'water' | 'flags' | 'people'
dressing.layers
dressing.stats
```

要求：

- **地块景观**（真实地块 125×130 m，英雄模型 94×106 m，中间环带用铺装/草地/绿篱补齐）：
  广场铺装分格、入口前庭（西/南侧）、路缘石、花池/绿篱、行道树、旗杆、挡车石等；
  用 InstancedMesh / merged geometry，整组 draw call ≤ 30。
- **树**：程序化低模树（树干 + 2–3 层椭球/锥形树冠），沿地块边缘与道路种 80–150 棵；
  夜间树冠变暗即可。
- **路灯**：沿地块周边 + 东中街布置，细杆 + 暖色灯头 Sprite；夜间地面光斑用贴地发光面片
  （避免大量 PointLight）。
- **喷泉/水景**：中央庭院水景动画（环形水面 shader：波纹 + 反光，或至少 animated normal/opacity），
  夜间蓝色/暖白 LED 效果。
- **车流**（可选但推荐）：东中街 / 东四十条 / 东二环方向几条车道上 instanced 低模车，
  匀速循环 + 夜间车灯发光点；不与英雄模型/地块穿插；可在 `city` 不可见时自动隐藏。
- **旗帜/标识**：入口旗杆 + 小幅旗帜动画（顶点摆动），夜间入口门廊暖光。
- 楼层模式时 `dressing.group.visible = false`（Lead 负责切），无其他副作用。
- 性能：不新增每帧 geometry 重建；整组三角面 < 80k。
- 代码放在 `src/site-dressing.js`（+ 可选子模块）；不改其他 src 文件。

## 5. main.js / index.html / style.css 集成（负责人：Lead）

- 新增 `#city-labels` DOM 容器、图层控制、时间三态按钮、街区视角、小地图、地标列表、OSM 署名。
- 初始化顺序：先建场景/灯光/相机 → `createAtmosphere` → hero GLB 加载（`atmo.setModel`）
  → 并行 `createCityContext` / `createSiteDressing`；loading 覆盖层显示进度，city 失败不阻塞。
- 渲染循环：`atmo.update / city.update / dressing.update` → `atmo.render()`。
- 楼层模式：隐藏 city/dressing、关闭 bloom 阴影等（按性能），退出恢复。
- 暴露调试 API：`window.__fuhuaCity`、`window.__cityStats`、`window.__atmo`、`window.__dressing`。
- 新时间 API 与旧 `window.__fuhua.night` 兼容（night 时 preset='night'）。

## 6. 验收口径（负责人：verifier + Lead）

- `cd apps/building-atlas && npm run build` 成功；dist 中无绝对 `/` 资源引用。
- 本地静态服务（`node scripts/serve-app.mjs apps/building-atlas/dist /demos/building-atlas 5282`）
  - 无 pageerror / console.error / 404；
  - `window.__cityStats.buildings > 1500`（真实数据）且 roads/landuse/poi 数量 > 0；
  - day / dusk / night 三态切换、图层开关、街区视角、POI 点击飞行、楼层模式进出均正常；
  - 1600×1000 与 390×844 截图无明显破图/横向溢出；
  - 帧率：Chrome + GPU 下整体模式 ≥ 45fps（可用 renderer.info 与 rAF 计时采样）。
- README / docs / hub 数据更新由 Lead 负责；署名 `© OpenStreetMap contributors (ODbL 1.0)`
  必须出现在页面 footer 与 README。

## 7. 协作约定

- 开发服务器已运行：`http://127.0.0.1:5173/`（Vite HMR，building-atlas）。
- 各模块自测可建临时预览页；**不要**改 `src/main.js`、`index.html`、`src/style.css`（Lead 正在改）。
- 完成的标志：文件落盘 + 自测通过 + 给 Lead 发一条消息（模块名、入口、API 实际签名、已知限制）。
- 共享任务板：认领任务后先 `team_task_get` 拿 revision，再 `team_task_update` claim；
  完成时 `complete` 并留一句交接说明。
