# 地标模型（免费 3D Warehouse 资产）

本 Demo 的近景地标使用 6 个从 **Trimble 3D Warehouse** 下载的免费 glTF 模型，
放在 `public/models/free/`，通过 `src/data/poi.ts` 的 `LANDMARKS` 配置在 Cesium 中按经纬度定位。
本文件记录：模型清单、尺寸/归一化/轴向、逐个作者与 entityId、许可与合规边界、获取方式风险、发布建议、页面 attribution 写法与复核方法。

> 一句话结论：这 6 个模型**不是 CC 授权**，而是 Trimble《3D Warehouse General Model License (GML, 2015-03-18)》。
> 可整合进「Combined Work」做演示，但**不得单独分发模型文件、不得用于未授权的 mapping/geographic 服务**；
> 当前形态**仅建议本地/内部演示**，公开部署前必须取得 Trimble 书面许可或替换为 CC 授权模型。

- 相关文件：`public/models/free/manifest.json`（模型元数据清单）、`public/models/README.md`（程序化模型说明）
- 加载代码：`src/cesium/CbdScene.ts` → `buildLandmarks()`；配置：`src/data/poi.ts` → `LANDMARKS`
- 许可原文：<https://3dwarehouse.sketchup.com/tou#license>（GML）、<https://3dwarehouse.sketchup.com/tou>（ToU v2.0, 2026-09-30）
- 条款 FAQ：<https://help.sketchup.com/en/3d-warehouse/3d-warehouse-terms-use-faq>

---

## 1. 文件清单（2026-11-04 实测）

`public/models/free/` 下共 6 个自包含 GLB（无外部 `.bin` / 贴图文件，无动画/骨骼，无 Draco/meshopt 等强制扩展），
合计 **11.41 MiB / 136,990 三角面**：

| id | 模型 | 文件 | 大小 | 三角面 | 材质 / 贴图 | 包围盒 X×Y×Z（m） | 真实高度 Y（m） |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: |
| `cctv` | 中央电视台总部大楼 | `cctv.glb` | 3.31 MiB | 9,107 | 52 / 43 | 206.04 × 234.00 × 206.04 | 234 |
| `citic` | 中国尊 / 中信大厦 | `citic.glb` | 0.69 MiB | 12,350 | 11 / 5 | 100.33 × 528.00 × 100.33 | 528 |
| `forbidden-city` | 故宫 / 紫禁城 | `forbidden-city.glb` | 5.27 MiB | 109,337 | 71 / 8 | 805.35 × 30.00 × 918.29 | 30 |
| `temple-of-heaven` | 天坛祈年殿 | `temple-of-heaven.glb` | 1.53 MiB | 2,743 | 118 / 25 | 77.50 × 38.00 × 80.28 | 38 |
| `birds-nest` | 国家体育场 · 鸟巢 | `birds-nest.glb` | 0.36 MiB | 1,021 | 17 / 7 | 354.74 × 69.00 × 639.64 | 69 |
| `tiananmen` | 天安门 | `tiananmen.glb` | 0.26 MiB | 2,432 | 11 / 8 | 117.17 × 35.00 × 44.05 | 35 |
| **合计** | 6 个 | — | **11.41 MiB** | **136,990** | — | — | — |

说明：

- 全部为 **GLB v2**，已校验 `magic=glTF`、JSON/BIN chunk 对齐、accessor `min/max` 完整；可直接被 Cesium 1.147 `Model.fromGltfAsync` 加载。
- 纹理总量约 4.73 MiB（占总体积 ~41%），全部内嵌在 GLB 内；`cctv.glb` 43 张、`temple-of-heaven.glb` 25 张贴图是体积主要来源。
- `forbidden-city.glb` 109,337 三角面，略超「<100k 面」预算；当前远景可随 `landmarks` 图层关闭整层，若后续要压到 100k 以内可用 `@gltf-transform/cli simplify` 离线减面（本次未改动）。
- `forbidden-city` / `temple-of-heaven` / `tiananmen` 在定稿时对模型范围做过收紧（比初版更紧凑），最终水平包围盒与 `manifest.json` 的 `footprint` 一致（[805,918]、[78,80]、[117,44]）。
- 6 个模型替代了 `LANDMARKS` 中原来的程序化模型；`国贸三期 A/B` 仍保留程序化 glTF（`public/models/cwtc-3a.glb`、`cwtc-3b.glb`）。

---

## 2. 来源、作者与 entityId（逐模型）

来源页统一格式：`https://3dwarehouse.sketchup.com/model/<entityId>`。
下表的「3D Warehouse 标题 / 作者」来自 3D Warehouse entity 元数据接口实测（2026-11-04），可直接用于页面署名：

| id | 3D Warehouse 标题 | 作者（creator） | entityId | 地理标记 | Google 来源 |
| --- | --- | --- | --- | --- | --- |
| `cctv` | CCTV HEADQUARTERS | Jabhnko R. | `86c01b70-f21b-4ec1-b51e-8eefc1a8c29c` | 无 | 否（`source` 空） |
| `citic` | China Zun | Lonnie F. | `3e1f3afc-dba0-4b6c-94e3-091fa5c5128d` | 无 | 否（`source` 空） |
| `forbidden-city` | Forbidden City of Beijing (紫禁城) - China | hongquan C. | `9e17d918-c41e-46e0-8e43-40edef4e357c` | 无 | 否（`source` 空） |
| `temple-of-heaven` | 北京天坛祈年殿 The Hall of Prayer for Good Harvests(The Temple of Heaven ) | 杨健宁 | `a752828ffe368d75e9ecd6a7ac7f3acf` | 北京市崇文区永定门内大街 | 否（`source=SKETCHUP`） |
| `birds-nest` | 北京国家体育场 - Beijing National Stadium | anonymous | `84d183bdc61408cf603eef2511b7237e` | Beijing | 否（`source=SKETCHUP`） |
| `tiananmen` | 天安门 Tiananmen Gate (the Gate of Heavenly Peace) | Li J. | `117a01a30f6b48df4df1932f12d5247b` | Beijing, China | 否（`source=SKETCHUP`） |

逐模型来源 URL：

- CCTV：<https://3dwarehouse.sketchup.com/model/86c01b70-f21b-4ec1-b51e-8eefc1a8c29c>
- 中国尊：<https://3dwarehouse.sketchup.com/model/3e1f3afc-dba0-4b6c-94e3-091fa5c5128d>
- 故宫：<https://3dwarehouse.sketchup.com/model/9e17d918-c41e-46e0-8e43-40edef4e357c>
- 天坛：<https://3dwarehouse.sketchup.com/model/a752828ffe368d75e9ecd6a7ac7f3acf>
- 鸟巢：<https://3dwarehouse.sketchup.com/model/84d183bdc61408cf603eef2511b7237e>
- 天安门：<https://3dwarehouse.sketchup.com/model/117a01a30f6b48df4df1932f12d5247b>

> 3D Warehouse entity 元数据接口（只读，用于复核作者/来源/地理标记）：
> `https://3dwarehouse.sketchup.com/warehouse/v1.0/entities/<entityId>?showAttributes=true&showBinaryAttributes=true&showBinaryMetadata=true`
> 关键字段：`title`、`creator.displayName`、`copyright`、`source`、`attributes.geo.address`、`attributes.skp.isGeoreferenced`。
> 本次 6 个模型 `copyright` 均为空、`source` 为 `SKETCHUP` 或空，**均非 Google 分发**（见 §4 GML §3）。

---

## 3. 归一化、坐标轴与 Cesium 定位

### 3.1 归一化结果（glTF-Transform v4.5.1 处理）

6 个 GLB 均已统一为「**米制 + Y-up + 底面 y=0 + 水平中心在原点**」：

- 单位：米（m）；glTF 2.0 标准 **Y 轴向上**；
- 水平（X/Z）包围盒中心 = 原点 `(0, 0)`，即**地点锚点 = footprint 水平中心**；
- 竖直方向 `minY = 0`、`maxY = 真实高度`，即**锚点在地面（模型基面）**；
- 根节点命名统一为 `<Name> normalized`（如 `CCTV Headquarters normalized`）；根节点上承载**等比 scale + 平移**
  （平移用于把包围盒中心对齐到原点、底面落到 y=0）；GLB 里原始 geometry 的 accessor 坐标仍保留原模型单位，
  因此复核尺寸时必须遍历场景图应用节点变换（见 §8.1）；
- 缩放只改尺寸、不改朝向：各模型按「真实高度 / rawHeight」整体等比缩放（rawHeight 为定稿前原始包围盒高度），实测根节点 scale 如下：

| id | 原始高度 rawHeight（m） | 目标真实高度（m） | 根节点等比 scale（实测） | 归一化后包围盒高度（m） | 水平中心 | 根节点 |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `cctv` | 250.1 | 234 | 0.935509 | 234.00 | ≈ (0, 0) | `CCTV Headquarters normalized` |
| `citic` | 529 | 528 | 0.998110 | 528.00 | (0, 0) | `CITIC Tower normalized` |
| `forbidden-city` | 36.6 | 30 | 0.819944 | 30.00 | ≈ (0, 0) | `Forbidden City normalized` |
| `temple-of-heaven` | 48.3 | 38 | 0.787469 | 38.00 | ≈ (0, 0) | `Temple of Heaven normalized` |
| `birds-nest` | 73 | 69 | 0.945040 | 69.00 | ≈ (0, 0) | `National Stadium normalized` |
| `tiananmen` | 36.7 | 35 | 0.953429 | 35.00 | (0, 0) | `Tiananmen normalized` |

> 根节点 scale 为实测值；与 `height / rawHeight` 的比值有 ≤0.2% 的取整误差（`rawHeight` 只记录到 0.1 m）。
> 因缩放按高度等比进行，长宽方向也随之缩放；各模型最终 X×Z 尺寸见 §1。
> `LANDMARKS[].scale` 缺省为 1，即**加载时不需要再缩放**。

### 3.2 轴向约定

- glTF 文件本身是标准 Y-up；Cesium 加载时由 `forwardAxis` 完成 Y-up → Cesium Z-up 的换算。
- 本项目的约定（与 `CbdScene.buildLandmarks()` 一致）：
  - `forwardAxis: Cesium.Axis.X` → 模型局部 **+X = 东、+Y = 上、+Z = 南**；
  - 模型放入 `eastNorthUpToFixedFrame(lon, lat, 0)` 的 ENU 局部系；
  - `LANDMARKS[].yaw`（度）绕 ENU 的上轴（局部 Z）旋转：**正值 = 从东转向北（俯视逆时针）**。
- **朝向未做归一化**：各上传者建模时的正面方向不一致，当前 6 个模型 `yaw = 0`（沿用原始朝向）。
  若发现长轴/正立面方向不对，只需在 `src/data/poi.ts` 的对应条目上调 `yaw`（0/90/180/270 粗调，再细调），**不需要改 glb**。

### 3.3 Cesium 定位参数（当前值）

| id | 文件 | 经度 lon | 纬度 lat | 真实高度（m） | yaw（°） | poiId |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `citic-tower` | `models/free/citic.glb` | 116.46014 | 39.91157 | 528 | 0 | `citic-tower` |
| `cctv-hq` | `models/free/cctv.glb` | 116.46470 | 39.91470 | 234 | 0 | `cctv-hq` |
| `tiananmen` | `models/free/tiananmen.glb` | 116.39750 | 39.90870 | 35 | 0 | `tiananmen` |
| `forbidden-city` | `models/free/forbidden-city.glb` | 116.39720 | 39.91630 | 30 | 0 | `forbidden-city` |
| `temple-of-heaven` | `models/free/temple-of-heaven.glb` | 116.41080 | 39.88220 | 38 | 0 | `temple-of-heaven` |
| `birds-nest` | `models/free/birds-nest.glb` | 116.39750 | 39.99290 | 69 | 0 | `birds-nest` |

加载方式（摘自现有实现，仅作说明）：

```ts
const enu = Cesium.Transforms.eastNorthUpToFixedFrame(
  Cesium.Cartesian3.fromDegrees(landmark.lon, landmark.lat, 0), // 基面放在 0 高度（椭球面）
);
const yawMatrix = Cesium.Matrix4.fromRotationTranslation(
  Cesium.Matrix3.fromRotationZ(Cesium.Math.toRadians(landmark.yaw ?? 0)),
  Cesium.Cartesian3.ZERO,
);
const modelMatrix = Cesium.Matrix4.multiply(enu, yawMatrix, new Cesium.Matrix4());
const model = await Cesium.Model.fromGltfAsync({
  url: assetUrl(landmark.glb),
  modelMatrix,
  forwardAxis: Cesium.Axis.X,   // 关键：只保留 Y-up→Z-up 换算，避免默认 forwardAxis=Z 额外转 90°
  scale: landmark.scale ?? 1,
  shadows: Cesium.ShadowMode.DISABLED,
  cull: true,
});
```

注意事项：

- 当前 Viewer 使用 `Cesium.EllipsoidTerrainProvider()`（无地形，地面 = 椭球面），所以模型 `y=0` 与世界底图/白模原点一致；
- **若将来启用真实地形**（Cesium World Terrain 等），北京城区地表高程约 40–50 m，需给模型增加高程偏移或改用 `heightReference: CLAMP_TO_GROUND`，否则会被埋入地下；
- 经纬度取自公开资料 / OSM 近似值（WGS84），**不是测绘坐标**；模型为第三方上传的「示意模型」，非官方 BIM / 倾斜摄影，不能用于测绘、规划审批、日照或工程量计算（GML §7 声明模型不适用于核设施、生命维持、航空导航、技术性建筑/结构设计等用途）。

---

## 4. 许可与合规（必须读）

### 4.1 许可链路

| 项目 | 内容 |
| --- | --- |
| 许可名称 | **3D Warehouse General Model License (GML)**，最后更新 2015-03-18 |
| licenseUrl | <https://3dwarehouse.sketchup.com/tou#license> |
| 上位条款 | 3D Warehouse Terms of Use v2.0（最后更新 2026-09-30）<https://3dwarehouse.sketchup.com/tou> |
| 条款 FAQ | <https://help.sketchup.com/en/3d-warehouse/3d-warehouse-terms-use-faq> |
| 版权归属 | 各模型版权归上传作者（Contributor/Developer）所有，Trimble/本项目不拥有 |

### 4.2 GML 允许的用途（§1 Authorized Uses）

- 制作衍生作品（Creations）；
- 把模型整合进更大的作品 / 交付物（“Combined Work”），**前提：Combined Work 包含大量额外内容（substantial additional content）**；
- 为自己业务需要（含商业目的）向第三方分发 Models / Creations / Combined Works；
- 制作合理数量的副本。
- FAQ 举例：用于「施工场景填充」「付费交付物（Combined Work）」均被允许。

### 4.3 GML 禁止 / 高风险（§2 License Restrictions、§3）

- **不得以 standalone 方式出售或分发单个 Model**（除非你是作者或获授权）；
- **不得聚合 3D Warehouse 内容用于再分发**，不得做成同类在线模型仓库 / 与 3D Warehouse 竞争的服务；
- **不得把内容用于「mapping or geographic application or service」，或向其分发，除非 GML 明确授权**；
- 不得移除/遮盖/修改模型内的产品标识、版权、商标等声明；不得声称拥有非自己创建的模型；
- **GML §3 Google Geolocated Models：由 Google（或 Trimble 代 Google）分发、带地理位置标签的建筑/物体模型，绝对禁止放入任何 application / product / service / database / repository。**
- **GML 未明确授权的用途，必须先发邮件给 `3dwarehouse-tou@sketchup.com` 取得 Trimble 书面同意。**

### 4.4 FAQ 中与本项目直接相关的两条

- 问：能否把 3D Warehouse 模型放进我的网站供成员使用？→ **否，这属于 impermissible aggregation。**
- 问：能否放进公开发表的研究项目？→ **否，同样属于 impermissible aggregation；需要逐个开发者的批准。**

### 4.5 本项目 6 个模型的核验结果

- 已逐个检查 entity 元数据：作者均为个人账号（Jabhnko R. / Lonnie F. / hongquan C. / 杨健宁 / anonymous / Li J.），
  `source` 为 `SKETCHUP` 或空，**没有任何一个由 Google 分发** → GML §3「Google Geolocated Models」**不触发**；
- `temple-of-heaven` / `birds-nest` / `tiananmen` 的 `attributes.skp.isGeoreferenced = true`（上传时打了地址），
  这只表示「带地理标记」，不等于 Google Geolocated；但若将来换模型，必须重新核验作者/来源。
- `copyright` 字段均为空（模型内无额外版权声明需要保留），但仍不得声称模型为自己制作或 Trimble 官方发布。

### 4.6 结论（务必同步给发布决策）

| 使用阶段 | 合规判断 | 建议 |
| --- | --- | --- |
| 本地 / 内网 / 内部演示 | 低风险，可用 | 保留 `manifest.json` 的 `useNotice`、页面署名与免责声明 |
| 对外公开的静态站点 / 公网 Demo | **高风险**：可能同时落入 GML「mapping or geographic application」与 FAQ「网站 impermissible aggregation」 | 先取 Trimble 书面许可，或替换为 CC0/CC-BY 模型 |
| 商用交付 / 对外获客 | 不建议直接使用 | 按 GML 要求联系 Trimble 取得书面授权，或换授权资产 |

---

## 5. 获取方式风险（未登录 API 下载）

本次 6 个模型的获取路径是：通过公开的 3D Warehouse warehouse API 读取模型实体元数据，再从 `binaries.glb.contentUrl` 直接下载 GLB（**未登录**）。需要如实记录以下风险：

- **ToU §3.1**：访问/使用 3D Warehouse 必须创建并维持账号 → 未登录访问在条款层面不合规；
- **ToU §2.6(c)**：禁止使用 scraper / crawler / robot / 其它自动设备或流程访问 Trimble IP 或 Models，包括监控、复制、提取内容 → 脚本化下载属于该条禁止行为；
- GML §1 规定「下载即视为接受 GML」，因此**模型的使用仍受 GML 约束**，但**获取过程本身可能违反 ToU**；
- 若后续要公开发布或长期使用，建议：
  1. 用免费的 Trimble ID 登录后，在浏览器里**手动**逐个下载模型（避免自动抓取）；
  2. 保留模型页 / 许可页快照、下载日期（`manifest.retrievedAt`）与作者信息，作为授权来源记录；
  3. 不要批量抓取、不要镜像 3D Warehouse 内容；
  4. 如对具体用途不确定，直接邮件 `3dwarehouse-tou@sketchup.com` 询问并取得书面答复。

---

## 6. 发布建议（公开部署前必做）

1. **首选：替换为 CC0 / CC-BY 模型**（或在 Cesium ion / 自建资产中换取授权模型），从根上绕开 GML 的 mapping/geographic 与 aggregation 限制。
2. **次选：向 Trimble 申请书面许可**。GML 明确规定「未明确授权的用途需书面同意」，申请邮箱：`3dwarehouse-tou@sketchup.com`。
   邮件建议写明：非商业/科研演示用途、公开网页地址、是否允许访问者下载模型文件、模型清单（title/author/entityId/URL）、使用期限。
3. **若仍要公开演示，降低风险的做法**：
   - 把 6 个模型**合并进更大的场景资产**（例如并入一个合并 GLB / 3D Tiles 瓦片包，与白模、道路、POI 等「大量额外内容」一起交付），使交付物整体构成 Combined Work；
   - **不要把单个 `models/free/*.glb` 作为独立下载项**暴露在页面/文档/API 中（避免 standalone 分发与「模型库」定性）；
   - 页面与文档保留作者、来源、许可链接与免责声明；不声称自制、不声称 Trimble 官方合作；
   - 不聚合、不镜像其它 3D Warehouse 内容。
4. **永远不要**：移除模型内版权/商标声明；把模型作为独立资产出售/分发；把模型放进另一个在线模型仓库；使用 Google 来源的 geolocated 模型。
5. 性能：6 个模型合计 11.41 MiB / 136,990 三角面，属于近景资产；远景建议随 `landmarks` 图层关闭（当前 `cull: true` 已开启视锥剔除）。若压缩，可在部署层启用 gzip/brotli，或对 `forbidden-city.glb` 做离线减面。

---

## 7. 页面 attribution 建议

GML/ToU 中**没有强制 attribution 条款**（全文检索无 “must credit / attribution” 要求），但要求不得移除模型内版权声明、不得声称拥有；
FAQ 也要求保留商标/Logo。为了避免「未署名 / 冒充官方」风险，建议在 **AboutDialog.vue §05「技术栈与署名」** 或页脚增加以下内容（只改 UI 文案，不需要改模型）：

中文（推荐直接加入 `about-credit`）：

> 地标三维模型来自 Trimble 3D Warehouse（模型版权归原作者所有），依《3D Warehouse General Model License》使用：
> 中央电视台总部大楼（Jabhnko R.）、中国尊（Lonnie F.）、故宫（hongquan C.）、天坛祈年殿（杨健宁）、
> 国家体育场·鸟巢（匿名）、天安门（Li J.）。本项目与 Trimble Inc. 无关联，模型非官方发布，仅用于演示。

English（可选）：

> Landmark 3D models are provided by their authors via Trimble 3D Warehouse and used under the
> 3D Warehouse General Model License. Authors: CCTV Headquarters — Jabhnko R.; China Zun — Lonnie F.;
> Forbidden City — hongquan C.; Temple of Heaven — 杨健宁; National Stadium — anonymous; Tiananmen — Li J.
> This project is not affiliated with or endorsed by Trimble Inc.

逐模型署名（可直接渲染为关于页 / 信息窗的列表，链接来自 `sourceUrl`）：

| 模型 | 署名文案 | 链接 |
| --- | --- | --- |
| CCTV | CCTV Headquarters by Jabhnko R., 3D Warehouse (Trimble) | <https://3dwarehouse.sketchup.com/model/86c01b70-f21b-4ec1-b51e-8eefc1a8c29c> |
| 中国尊 | China Zun by Lonnie F., 3D Warehouse (Trimble) | <https://3dwarehouse.sketchup.com/model/3e1f3afc-dba0-4b6c-94e3-091fa5c5128d> |
| 故宫 | Forbidden City of Beijing by hongquan C., 3D Warehouse (Trimble) | <https://3dwarehouse.sketchup.com/model/9e17d918-c41e-46e0-8e43-40edef4e357c> |
| 天坛 | 北京天坛祈年殿 by 杨健宁, 3D Warehouse (Trimble) | <https://3dwarehouse.sketchup.com/model/a752828ffe368d75e9ecd6a7ac7f3acf> |
| 鸟巢 | 北京国家体育场 by anonymous contributor, 3D Warehouse (Trimble) | <https://3dwarehouse.sketchup.com/model/84d183bdc61408cf603eef2511b7237e> |
| 天安门 | 天安门 Tiananmen Gate by Li J., 3D Warehouse (Trimble) | <https://3dwarehouse.sketchup.com/model/117a01a30f6b48df4df1932f12d5247b> |

同时建议：

- 在 `manifest.json` / 页面中统一写**许可全称**：`3D Warehouse General Model License (GML, 2015-03-18)` + `licenseUrl`；
- 不要把「3D Warehouse Terms of Use」当成模型许可（它只是平台服务条款，模型许可是 GML）；
- 若未来替换模型，`manifest` 里的 `license/author/sourceUrl/attribution/entityId/retrievedAt/useNotice` 必须同步更新；
- `AboutDialog.vue` §02「数据从哪里来」已同步改为「6 座地标来自 3D Warehouse（GML）+ 国贸三期 A/B 为程序化示意体量」。
- 公开部署前在页面上说明「模型版权归原作者，本项目与 Trimble 无关联」。

---

## 8. 复核 / 验证方法

### 8.1 GLB 结构与几何自检（Python 3，只读）

> 注意：GLB 的 accessor `min/max` 是**节点变换前**的局部坐标；归一化时在根节点/子节点上应用了
> 等比 scale 与平移，因此必须遍历场景图应用节点 TRS，才能得到 §1/§3 表中的米制包围盒。

```python
import json, struct, glob, os

def parse(path):
    data = open(path, 'rb').read()
    magic, ver, length = struct.unpack_from('<III', data, 0)
    assert magic == 0x46546C67 and ver == 2, 'not a GLB v2'
    off, js = 12, None
    while off < length:
        clen, ctype = struct.unpack_from('<II', data, off); off += 8
        if ctype == 0x4E4F534A: js = json.loads(data[off:off+clen])
        off += clen
    return js

def tri_count(g):
    n = 0
    for m in g.get('meshes', []):
        for p in m.get('primitives', []):
            mode = p.get('mode', 4)  # 4=TRIANGLES, 5=TRIANGLE_STRIP；其它模式按 0 计
            c = g['accessors'][p['indices']]['count'] if 'indices' in p \
                else g['accessors'][p['attributes']['POSITION']]['count']
            n += c // 3 if mode == 4 else (c - 2 if mode == 5 else 0)
    return n

def trs_matrix(node):
    if 'matrix' in node: return node['matrix']
    t = node.get('translation', [0, 0, 0]); r = node.get('rotation', [0, 0, 0, 1]); s = node.get('scale', [1, 1, 1])
    x, y, z, w = r; xx, yy, zz = x*x, y*y, z*z; xy, xz, yz = x*y, x*z, y*z; wx, wy, wz = w*x, w*y, w*z
    return [ (1-2*(yy+zz))*s[0], 2*(xy+wz)*s[0], 2*(xz-wy)*s[0], 0,
             2*(xy-wz)*s[1], (1-2*(xx+zz))*s[1], 2*(yz+wx)*s[1], 0,
             2*(xz+wy)*s[2], 2*(yz-wx)*s[2], (1-2*(xx+yy))*s[2], 0,
             t[0], t[1], t[2], 1 ]

def mul(a, b):  # 列主序 4x4：a * b
    return [sum(a[k*4+r] * b[c*4+k] for k in range(4)) for c in range(4) for r in range(4)]

def apply(m, v):
    return (m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12],
            m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13],
            m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+m[14])

def world_bbox(g):
    lo = [1e30]*3; hi = [-1e30]*3
    def walk(i, parent):
        n = g['nodes'][i]; m = mul(parent, trs_matrix(n))
        if 'mesh' in n:
            for p in g['meshes'][n['mesh']].get('primitives', []):
                a = g['accessors'][p['attributes']['POSITION']]
                for vx in (a['min'][0], a['max'][0]):
                    for vy in (a['min'][1], a['max'][1]):
                        for vz in (a['min'][2], a['max'][2]):
                            w = apply(m, (vx, vy, vz))
                            for k in range(3):
                                lo[k] = min(lo[k], w[k]); hi[k] = max(hi[k], w[k])
        for c in n.get('children', []):
            walk(c, m)
    ident = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
    for i in g['scenes'][g.get('scene', 0)]['nodes']:
        walk(i, ident)
    return lo, hi

for p in sorted(glob.glob('public/models/free/*.glb')):
    g = parse(p); lo, hi = world_bbox(g)
    print(os.path.basename(p), 'tris=', tri_count(g),
          'XZsize=', (round(hi[0]-lo[0], 2), round(hi[2]-lo[2], 2)),
          'minY=', round(lo[1], 3), 'maxY=', round(hi[1], 2),
          'centerXZ=', (round((lo[0]+hi[0])/2, 2), round((lo[2]+hi[2])/2, 2)),
          'ext=', g.get('extensionsRequired', []))
```

期望输出与 §1/§3 一致：`minY = 0`、`maxY` 等于对应真实高度（234 / 528 / 30 / 38 / 69 / 35）、
`centerXZ ≈ (0, 0)`、`extensionsRequired = []`；6 个模型三角面合计 **136,990**。
（注：`cctv.glb` / `citic.glb` / `birds-nest.glb` 还含有少量 `mode=1` 的线图元，不计入三角面。）

### 8.2 3D Warehouse 元数据复核

```text
https://3dwarehouse.sketchup.com/warehouse/v1.0/entities/<entityId>?showAttributes=true&showBinaryAttributes=true&showBinaryMetadata=true
```

检查 `title` / `creator.displayName` / `copyright` / `source` / `attributes.geo.address`；
若 `creator` 或 `source` 指向 Google → **禁止使用**（GML §3 Google Geolocated Models）。

### 8.3 manifest 字段（建议保持一致）

`id / name / en / file / height / rawHeight / footprint / author / license / licenseUrl / sourceUrl / attribution / entityId / retrievedAt / useNotice`

---

## 9. 变更记录

- **2026-11-04**：初版。6 个模型由 Lead 从 Trimble 3D Warehouse 下载并用 glTF-Transform v4.5.1 归一化（米制 / Y-up / 底面 y=0 / 水平中心在原点 / 按真实高度缩放）；本文档汇总清单、来源、许可边界、发布建议与 attribution 写法。
