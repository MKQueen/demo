# 富华大厦 · 建筑数字档案（building-atlas）

影像驱动的「北京富华大厦」三维建筑档案，从 `~/Web/demo/3ddemo` 迁移为可嵌套部署的纯静态站点。
现包含三层内容：**建筑本体（Blender GLB）→ 楼层分层 / 逐层平面 → 东四十条街区语境（OSM 白模）**。

- 纯前端、零后端：Three.js 直接读取 Blender 导出的 GLB 模型
- 六座塔楼 A–F（西侧 A/B/C，东侧 F/E/D）+ 南北裙房 + 中央庭院
- 48 个网格 / 202,728 个三角面 / 10 MB GLB
- 街区语境：东四十条周边 **1,766 栋 OSM 建筑白模 / 534 条道路 / 40 个地标 POI**（半径 1.5 km，ODbL 数据，离线可跑）
- 昼夜三态（日景 / 黄昏 / 夜景）+ 窗光 shader + bloom 后处理 + 场地景观（树 / 路灯 / 车流 / 喷泉）
- 构建产物可放在任意子路径（例如 `/demos/building-atlas/`）下运行

---

## 一、功能

### 整体浏览（原有）

- 建筑 A–F 选择：点选楼座或三维模型，镜头飞行定位并高亮
- 视角切换：整体鸟瞰 / 西侧立面 / 总平布局 / 中庭视角
- 自动环绕、昼夜切换、全屏、指北针 / 比例尺 / 楼座标签
- 影像档案：10 张参考图灯箱
- 重建说明：依据、已建元素与精度声明
- 视角：整体鸟瞰 / 西侧立面 / 总平布局 / 中庭视角 / **街区鸟瞰**

### 街区语境（新增）

- **周边白模**：以富华大厦地块中心为原点，把 OpenStreetMap 中 1.5 km 半径的 1,766 栋建筑按 footprint 挤出为
  近白冷灰体块；高度按 OSM `height` → `building:levels × 3.2 m` → 名称估算 → 类型默认值推算。
  富华大厦自身地块内的 OSM 建筑已挖空，避免与精细 GLB 模型重叠。
- **路网 / 绿地水系 / 地块**：534 条道路（东四十条、东中街、东二环、朝阳门北大街等保留真实名称）、
  193 个公园 / 绿地 / 水系 / 地块面；地块边界以金色描边高亮。
- **地标 POI / 小地图**：40 个地标（4 个地铁站、保利大厦、港澳中心、首创大厦、工人体育馆、簋街等），
  右侧面板实时绘制基于真实路网的小地图；点选地标列表或地图圆点，镜头飞往对应位置。
- **地标聚焦（新增）**：点选地标后，以金色光柱 + 地面光环 + 目标建筑体量框（X 光透视、被任何楼挡住也能看见）
  标出目标，顶部出现「地标聚焦 / 回到整体」提示；镜头自动以「目标近景 + 富华远景」构图。
- **图层控制**：白模 / 路网 / 绿地水系 / 地标标注 / 地块边界 / 距离环 / 树木 / 路灯车流 / **白模透视**，可独立开关；
  「白模透视」把所有周边白模变半透明，被街坊挡住的主体与地标可直接看到。
- **场地景观**：地块广场铺装、行道树、路灯、旗杆、中央庭院水景、道路车流；夜间灯效与车灯。
- **昼夜氛围**：日景 / 黄昏 / 夜景三态平滑过渡；夜景窗光 shader 逐窗点灯、楼顶航空障碍灯、
  UnrealBloom 后处理（构建失败自动回退直接渲染）。
- 所有街区数据静态托管在 `public/data/site/`，**无在线瓦片 / 无后端 / 无 key**。
- **自适应面板**：窗口较矮（≤ 960px 高）时两侧面板自动切紧凑模式并支持内部滚动，
  地标列表按整行显示（6 行 / 四行，薄滚动条提示更多）、POI 标签自动避开标题与底部控制条，
  内容不会再被页脚或视口边缘盖住。

### 楼层分层 / 每层布局（新增）

点击顶部导航 **「楼层分层 FLOORS」** 进入，随时可「退出楼层」回到整体视角。

1. **真实几何分层**
   - 加载 GLB 后，按每栋楼的高度与推定层高，把该楼座的三角面在 Y 轴上切分成「楼层带」；
     切分时对跨层三角形做平面裁剪（不是简单按重心归层），因此楼身、线脚、窗框都会正确落在对应楼层。
   - 每个楼层带保留原始材质（石材 / 玻璃 / 铜窗框 / 屋面等），并生成半透明楼板与楼板轮廓线。
   - 切片只做一次并缓存，进入楼层模式不会重复构建；楼层「炸开 / 合拢」只改变各楼层组的位置，不是每帧重建几何。
   - 楼层模式只保留当前楼座、关闭阴影，以保证浏览器渲染性能。

2. **炸开 / 合拢**
   - 进入楼层模式时楼层沿 Y 轴均匀「炸开」排列（每层间距 1.9 m），使用 `easeInOutCubic` 缓动（约 1.1 s），底部按钮可随时合拢 / 再炸开。

3. **楼层聚焦**
   - 左侧楼层列表（顶层在前，可滚动）点选任意楼层；底部「上一层 / 下一层」逐层切换；支持键盘 ↑↓。
   - 选中楼层高亮并带金色自发光 + 金色轮廓框，其余楼层降低不透明度并压暗；相机平滑飞行到该层，三维视口中出现楼层标签。
   - 楼层信息卡：楼座、层号、估算标高（起止）、层高、建筑面积、用途、推算依据。

4. **2D 平面布局（逐层示意）**
   - 右侧面板按楼座真实平面尺寸（A/C/D/F 23×25 m，B/E 19×31 m）绘制 SVG 平面：
     楼座外轮廓、核心筒（4 部客梯 + 2 部楼梯 + 卫生间）、环形 / 检修走廊、办公单元或设备机房，
     并标注单元编号、估算面积、朝向、尺寸标注、指北针与比例尺。
   - 按楼层类型切换布局与配色：
     - **首层大堂**：双层通高大堂、营业厅 / 商务中心、前台、核心筒、主入口拱券门厅标记
     - **标准办公层**：中央核心筒 + 环形走廊 + 6 个（A/C/D/F）或 8 个（B/E）办公单元
     - **设备 / 避难层**：空调机房、变配电室、水泵房、弱电机房 + 检修走廊
     - **屋顶机房层**：冠部屋顶机房、电梯机房、水箱间、冷却塔（带屋面排线填充）
   - 悬停 / 点击平面单元，信息区显示单元编号、用途、朝向、估算面积与说明；被选单元金色描边。
   - 面板明确标注：**「示意分区 · 非测绘数据，依据立面与层高估算」**。

5. **移动端**
   - 楼层列表横向滚动、楼层信息卡折叠隐藏；
   - 平面布局面板变为可收起的底部抽屉（默认收起，由底部「平面」按钮开合），不遮挡整个 3D 视口；
   - 底部控制条可横向滚动。

---

## 二、楼层数据推算（重要）

> **层数、层高、标高、面积、平面分区全部为「按模型楼高 + 层高估算的示意数据」，
> 不是测绘 / BIM / 竣工图数据。**

### 推算规则

数据来自模型构建脚本 `scripts/build_model.py`（Blender 导出 GLB）：

- 立面窗列自 **11.20 m** 起、间距 **3.35 m** → 取 **标准层高 = 3.35 m**
- 首层拱券与 **7.50 m** 线脚 → 取 **基座大堂层 = 0–7.50 m**
- 结构楼高 H、几何顶标高（含屋顶机房 / 女儿墙 / 栏杆）取自模型

计算方式：

```
nBody    = floor((H − 7.50) / 3.35)        // 基座以上可容纳的层数（含设备层）
标准层数 = nBody − 1                        // 最后一层留给设备 / 避难层
标准层   = 7.50 + i × 3.35  (i = 0 … 标准层数−1)
设备层   = 7.50 + 标准层数 × 3.35 → min(H, +3.35)
屋顶层   = 设备层顶 → 几何顶（结构楼高以上为屋顶机房 / 冠部 / 栏杆）
```

### 各楼座楼层表

| 楼座 | 平面尺寸 (m) | 结构楼高 H (m) | 几何顶 (m) | 基座大堂 | 标准层 | 设备 / 避难层 | 屋顶层 | 总层数 |
| ---- | ------------ | -------------- | ---------- | -------- | ------ | -------------- | ------ | ------ |
| A | 23 × 25 | 57 | 64.60 | L1 · 0–7.50 | L2–L14 · 7.50–51.05 | L15 · 51.05–54.40 | L16 · 54.40–64.60 | **16** |
| B | 19 × 31 | 41 | 42.71 | L1 · 0–7.50 | L2–L10 · 7.50–37.65 | L11 · 37.65–41.00 | L12 · 41.00–42.71 | **12** |
| C | 23 × 25 | 57 | 64.60 | L1 · 0–7.50 | L2–L14 · 7.50–51.05 | L15 · 51.05–54.40 | L16 · 54.40–64.60 | **16** |
| D | 23 × 25 | 60 | 67.60 | L1 · 0–7.50 | L2–L15 · 7.50–54.40 | L16 · 54.40–57.75 | L17 · 57.75–67.60 | **17** |
| E | 19 × 31 | 43 | 44.71 | L1 · 0–7.50 | L2–L10 · 7.50–37.65 | L11 · 37.65–41.00 | L12 · 41.00–44.71 | **12** |
| F | 23 × 25 | 60 | 67.60 | L1 · 0–7.50 | L2–L15 · 7.50–54.40 | L16 · 54.40–57.75 | L17 · 57.75–67.60 | **17** |

合计 **90 个楼层带**。平面布局中的单元面积按轮廓矩形估算：

- A/C/D/F 标准层：建筑面积 ≈ 575 m²，6 个办公单元（约 60–73 m²，按 9 m²/工位示意）
- B/E 标准层：建筑面积 ≈ 589 m²，8 个办公单元
- 核心筒（含电梯 / 楼梯 / 卫生间）、走廊为示意分区，面积按图形估算

---

## 三、数据精度声明

1. 本模型是**建筑外观展示模型**，不是测绘、BIM 或竣工图成果。楼高、层高、窗位与背立面依据参考影像估算，未复刻室内。
2. 楼层数由模型楼高与 3.35 m 标准层高推算，**不是实测楼层数**；楼层平面、功能分区、单元面积、机房用途均为示意。
3. 平面布局只表达「核心筒 + 走廊 + 单元」的空间关系，不包含真实墙体、柱网、门窗洞口与测绘尺寸。
4. 街区语境白模 / 路网 / POI 来自 OpenStreetMap（© OpenStreetMap contributors，ODbL 1.0）：
   footprint 由社区绘制，存在简化 / 偏移 / 缺失；高度多数为层数或类型估算（1,766 栋中仅 9 栋带 OSM `height`），
   个别地标按公开形象取整；坐标系以富华地块中心做局部 ENU 配准，**不是测绘 / BIM / 地理配准成果**。
5. 未引入 DEM，地面按 0 m 处理；道路几何经 RDP 0.8 m 抽稀；无地形起伏与真实地形高程。
6. 中央喷泉、绿化、铺装、车辆与路灯均为示意景观；使用时请保留页面与 README 中的「示意分区 · 非测绘数据」
   与 `© OpenStreetMap contributors (ODbL 1.0)` 声明。

---

## 四、静态化改造（相对源项目）

| 项目 | 源项目 | 本版本 |
| ---- | ------ | ------ |
| 构建 base | `/`（绝对路径） | `vite.config.js` → `base: './'` |
| GLB | `/models/fuhua-mansion.glb` | `import.meta.env.BASE_URL` + `models/fuhua-mansion.glb` |
| 参考图 | `/references/01.png…10.png`（20 MB） | `references/01.jpg…10.jpg`（`sips` 转 JPEG，宽 ≤1800 px，质量 82，共 4.7 MB） |
| 建筑渲染图 | `/models/architectural-render.png`（2.3 MB） | `models/architectural-render.jpg`（0.36 MB） |
| favicon | `/favicon.svg` | `./favicon.svg` |
| Blender 源文件 | `public/*.blend`（10 MB × 2，会进构建） | 移出 public，本地保留在 `source-assets/`（已 gitignore，不随站点分发），页面下载链接同步移除并在「重建说明」中注明 |
| 字体 | Google Fonts `@import`（外网依赖） | 改为系统中文字体栈（PingFang SC / Songti SC 等），离线可用、无外部请求 |
| 品牌返回链接 | `/` | `../../index.html`（合集站点 `/demos/<id>/` 下可回到首页） |
| 街区语境数据（新增） | — | `public/data/site/`：`tools/build-site-context.py` 从 OSM 生成的静态白模 / 路网 / 绿地 / POI / 地块，共 **1.37 MiB / 1.44 MB** |
| 3D 模块（新增） | — | `src/city.js`（白模 / 路网 / POI / 小地图）、`src/atmosphere.js`（昼夜 / 天空 / 窗光 / bloom）、`src/site-dressing.js`（广场 / 树 / 路灯 / 车流 / 水景） |

构建校验：`dist/index.html` 中不再出现以 `/` 开头的资源引用；`public/` 从 52 MB 降到约 15 MB + 街区数据 1.44 MB。

### 体积（升级后，`npm run build` 实测）

| 项 | 体积 |
| -- | ---- |
| `public/` 合计 | **15.99 MiB / 16.77 MB** |
| ├ `models/fuhua-mansion.glb` | 9.61 MiB / 10.07 MB |
| ├ `references/*.jpg`（10 张） | 4.89 MB |
| ├ `models/architectural-render.jpg` | 0.36 MiB / 0.37 MB |
| └ `data/site/*`（OSM 街区语境） | **1.37 MiB / 1.44 MB**（白模 GLB 1.15 MB + 路网 130 KB + 绿地 74 KB + POI 14 KB + meta/footprint 11 KB） |
| `dist/` 合计 | **16.78 MiB / 17.60 MB**（含 public 资源 + 应用 JS/CSS） |
| JS gzip（4 个 chunk） | 约 219 kB（index 182.3 + city 17.8 + atmosphere 11.2 + site-dressing 7.4） |
| CSS gzip | 6.9 kB |

---

## 五、目录结构

```
apps/building-atlas/
├── index.html               # 页面骨架（相对路径引用）
├── vite.config.js           # base: './'
├── package.json
├── src/
│   ├── main.js              # 三维场景、整体交互、楼层模式、街区语境 UI 编排
│   ├── floors.js            # 楼层推算 / GLB 楼带切分 / 2D 平面 SVG 生成
│   ├── city.js              # 街区语境：OSM 白模 / 路网 / 绿地 / 地块 / POI 标签 / 小地图（+ src/city/ 子模块）
│   ├── atmosphere.js        # 昼夜三态天空 / 光照 / 窗光 shader / 塔顶灯 / bloom 后处理
│   ├── site-dressing.js     # 地块广场 / 行道树 / 路灯 / 旗杆 / 水景 / 车流
│   └── style.css            # 深色石材 + 金色 #f4b35b 设计语言；楼层 / 街区 UI 样式
├── public/                  # 随构建复制到 dist 根目录
│   ├── models/fuhua-mansion.glb
│   ├── models/architectural-render.jpg
│   ├── references/01.jpg … 10.jpg
│   ├── data/site/           # OSM 街区语境产物（meta / white-models.glb / roads / landuse / poi / site-footprint）
│   └── favicon.svg
├── tools/
│   ├── build-site-context.py     # OSM → 白模 / 路网 / 绿地 / POI / meta（仅标准库，含 --verify-only）
│   └── verify-upgrade.mjs        # Playwright 端到端验收脚本（需先启动本地服务）
├── docs/
│   ├── site-context-data.md      # 街区数据来源 / 字段 / 高度模型 / 精度说明
│   └── upgrade-contract.md       # 升级模块契约（坐标 / 数据 schema / 模块 API）
├── screenshots/
│   ├── cover.jpg            # 首页封面
│   ├── upgrade-day.jpg / upgrade-dusk.jpg / upgrade-night.jpg
│   ├── upgrade-city.jpg     # 街区鸟瞰
│   ├── upgrade-floors.jpg   # 楼层模式
│   └── upgrade-mobile.jpg   # 移动端
├── scripts/
│   └── capture-screenshots.mjs   # 截图 / 冒烟检查脚本（需先启动静态服务）
├── source-assets/           # 本地源文件（gitignore，不打包）
│   ├── fuhua-mansion.blend
│   ├── fuhua-mansion.blend1
│   └── ...                  # 调试脚本
└── README.md
```

---

## 六、开发 / 构建 / 验证

### 开发

```bash
cd apps/building-atlas
npm install          # 或从源项目复制 node_modules
npm run dev          # http://localhost:5173/
```

### 构建

```bash
cd apps/building-atlas
npm run build        # 产物在 dist/，资源全部相对路径
```

### 子路径预览（模拟合集的部署方式）

```bash
# 在仓库根目录
node scripts/serve-app.mjs apps/building-atlas/dist /demos/building-atlas 5282
# → http://127.0.0.1:5282/demos/building-atlas/
```

### 街区数据重新生成（可选）

街区数据已随仓库提交（`public/data/site/`，约 1.4 MB），日常构建不需要重跑。需要更新时：

```bash
cd apps/building-atlas
# 1) 下载 BBBike 北京 OSM extract（约 50 MB，ODbL）
curl -L -o /tmp/Beijing.osm.gz https://download.bbbike.org/osm/bbbike/Beijing/Beijing.osm.gz
# 2) 生成（半径 1.5 km；Python 3.10+，仅标准库；macOS 可用 DSH 便捷运行时）
PY=/Users/one/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3
$PY tools/build-site-context.py --osm-gz /tmp/Beijing.osm.gz
# 3) 校验（56 项自检）
$PY tools/build-site-context.py --verify-only
```

坐标 / 高度模型 / 字段字典见 `docs/site-context-data.md`；升级模块接口见 `docs/upgrade-contract.md`。

### 截图 / 冒烟检查

需要先启动上面的静态服务，然后：

```bash
cd apps/building-atlas
node scripts/capture-screenshots.mjs
# 生成 screenshots/*.jpg，并输出 console.error / pageerror / 失败请求报告
```

也可以用仓库统一脚本（Playwright）：

```bash
node scripts/shot.mjs "http://127.0.0.1:5282/demos/building-atlas/" apps/building-atlas/screenshots/cover.jpg \
  --wait 12000 --strict --actions <动作 JSON>
```

---

## 七、验证记录

### 升级版端到端验收（Playwright，`tools/verify-upgrade.mjs`）

- **dev（Vite 5173，最终版）**：107 断言 → **106 通过 / 0 失败 / 1 warning**（warning 为小地图严格 `path>20` 口径，
  实现按档合并路径，按「图形元素合计 > 20」放宽口径 PASS）；运行时 pageerror 0 / console.error 0 / 失败请求 0。
- **dist（`/demos/building-atlas/` 子路径静态托管，5282）**：108 断言 → **107 通过 / 0 失败 / 1 warning**；
  `dist` 无绝对根路径资源引用；全部响应 HTTP 200，无 404 / 5xx；桌面 1600×1000 与移动 390×844
  均 0 pageerror / 0 console.error / 0 失败请求；移动端无横向溢出。
- 数据与交互（实测）：`buildings=1766 / roads=534 / landuse=192 / poi=40`，city draw calls **11**、
  三角面 **31,125**、POI 标签 14；白模 GLB **27,542 tri / 1.15 MB / 单 mesh / COLOR_0**；
  场地景观 draw calls 23 / 27,027 tri（100 树 / 39 路灯 / 38 车 / 4 旗）。
- 朝向 / 距离自检：东中街在东（avgX +97.5）、东四十条在北（avgZ −299.1）、东二环在西（avgX −137.8）；
  东四十条站 330.6 m / 保利大厦 375.1 m / 首创大厦 110.4 m；40 个 POI 的 `distanceM` 与 `hypot(x,z)` 完全一致。
- 三态时间 / 9 个图层开关 / 街区鸟瞰 / 地标列表与 3D 标签及小地图三种点击飞行 / 楼层模式 F 座 L9 进出恢复 /
  loading 覆盖层 / 小地图 SVG 均通过。
- 响应式面板回归：在 1600×1000 / 1440×900 / 1418×870 / 1366×768 / 1280×800 等窗口高度下，
  左右面板底边均高于页脚（无内容被裁切），地标列表按整行显示、POI 标签不覆盖标题与底部控制条。
- 地标聚焦回归（新增）：列表中带 footprint 的地标（首创大厦 110 m 等）聚焦后，金色光柱 / 光环 / 体量框可见，
  白模自动进入 X 光透视，顶部「地标聚焦」标签可一键回到整体视角；清除聚焦后白模材质透明度恢复。
- 降级链路单独验证：拦截 `data/site/**` 404 时，城市语境回退为程序化 9 街区，`console.warn` 而非
  `console.error`，页面不阻塞、loading 正常收起。
- 性能：Chrome + GPU 无头环境 rAF 实测 **119–121 fps**（1600×1000）；`window.__renderInfo` 因使用
  EffectComposer 后处理只反映最后一个全屏 pass（calls=1），整帧口径以 fps 与各模块 stats 为准。
- 复跑：
  ```bash
  cd /Users/one/AI/demo
  node apps/building-atlas/tools/verify-upgrade.mjs                    # dev
  node apps/building-atlas/tools/verify-upgrade.mjs \
    --url http://127.0.0.1:5282/demos/building-atlas/ --no-shots       # dist
  ```

### 楼层分层（原有能力，保持通过）

- 楼层切分统计（实测，Chromium 无头）：输入 182,746 个楼座三角面，切分输出 294,222 个三角面，
  90 个楼层带 / 369 个楼带网格 / 90 块楼板，切片耗时约 80 ms（一次完成并缓存）
- 楼层模式只显示当前楼座并关闭阴影；退出后恢复六座、阴影与街区语境
- F 座 L9 选中后 6 个办公单元平面 / 楼层列表 17 项 / 单元悬停信息联动；切换 A 座 → 16 层、
  L1 大堂层 3 个分区；四类平面布局（标准办公 / 基座大堂 / 设备避难 / 屋顶机房）均无控制台报错

### 构建与部署

- `npm run build` 成功（Vite 6）；`dist/` 实测 **17.60 MB**（16.78 MiB，含 1.44 MB 街区语境数据）
- 合集仓库 `npm run build` / `npm run zip` 通过；`site/demos/building-atlas/` 在
  `http://127.0.0.1:5180/` 静态托管下页面、模型、参考图、街区数据均正常加载

### 交付截图

`screenshots/upgrade-day.jpg`、`upgrade-dusk.jpg`、`upgrade-night.jpg`、`upgrade-city.jpg`、
`upgrade-floors.jpg`、`upgrade-mobile.jpg`、`upgrade-cover.jpg`、`upgrade-poi-focus.jpg`、`upgrade-layout-1440x900.jpg`。

---

## 八、素材说明

- 建筑模型与渲染图由 `scripts/build_model.py` 依据用户提供的参考影像在 Blender 中重建并导出；
  原始参考影像见 `public/references/`（10 张，已压缩）。
- 楼层数据、平面分区与面积为本项目按立面与层高推算的**示意数据**。
- 街区语境数据来自 OpenStreetMap（BBBike Beijing extract），遵循 **ODbL 1.0**，
  页面 footer、重建说明、`public/data/site/meta.json` 与本文档均保留
  `© OpenStreetMap contributors` 署名与许可证链接。若公开发布，需按 ODbL 要求继续署名；
  衍生数据（`public/data/site/`）再分发时同样需遵守 ODbL。
- 页面仅用于建筑展示与交互演示，不代表真实建筑的测绘或设计成果。
