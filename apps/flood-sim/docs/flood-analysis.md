# 淹没分析说明 · 潮线 TIDELINE

> 本文展开 [`README.md`](../README.md) §5.7–§5.8 的算法、误差与升级路径。
> 对应源码：[`src/analysis/floodAnalysis.js`](../src/analysis/floodAnalysis.js)、[`src/geo/terrainModel.js`](../src/geo/terrainModel.js)。
> **先记住一句话**：这是「给定全局水位，判断哪些建筑/多少陆地在水平面以下」的**静态几何统计**，不是洪水演进模拟。

---

## 1. 输入

| 输入 | 来源 | 规模 / 说明 |
| --- | --- | --- |
| 建筑清单 | `public/generated/village/buildings.json` | **1067 栋**（老城 233 + 西城 320 + 北城 200 + 滨海新区 263 + 滨海 CBD 46 + 滨水公共带 5）；每栋有 `minGround`（占地四角 + 中心的最低地基海拔）、`height`、`floors`、`footprintArea`、`type`、`kind`、`district`、`name`；顶层 `town` 段记录六分区与计数 |
| 地形高程函数 | `src/geo/terrainModel.js` `heightAtLocal(x, y)` | 纯函数，米；海平面 0，海床可负 |
| 场景范围 | `SCENE.widthMeters/heightMeters` | 14 km × 12 km，局部 ENU 米（原点 120.05°E / 26.98°N） |
| 水位 | `store.waterLevel`（0–30 m，海拔） | 由渲染循环平滑后的实际值 |

> 建筑清单与 3D Tiles（10 个 b3dm：119/114/196/124/200/127/71/65/41/10 栋）是**同一份布局数据**导出的两个产物（`generate-village-tiles.mjs`），所以「看到的建筑」与「统计的建筑」严格一致。

---

## 2. 建筑判定

```js
for (const b of buildings) {
  const depth = level - b.minGround;      // 淹没深度（m）
  if (depth > 0.15) {                     // 被淹阈值
    floodedBuildings += 1;
    sumDepth += depth;
    maxDepth = Math.max(maxDepth, depth);
    if (depth > 2) dangerBuildings += 1;  // 危险阈值
    flooded.push({ id, name, type, depth, height, minGround });
  }
}
flooded.sort((a, b) => b.depth - a.depth);  // 按深度降序，UI 取 Top3
```

| 参数 | 值 | 理由 |
| --- | --- | --- |
| 被淹阈值 | `depth > 0.15 m` | 15 cm 以内的"擦边"不算被淹（避免水位刚过最低地基 2.65 m 时码头"刚好被淹"的抖动） |
| 危险阈值 | `depth > 2 m` | 一层层高约 3 m，2 m 水深已接近"整层进水"；对应 UI 的"危险建筑"数 |
| 判定依据 | `minGround`（占地四角 + 中心最低点） | 坡地建筑只要一角落水就算被淹，**偏保守**；比用中心点 `groundHeight` 更不容易漏判 |
| 复杂度 | O(n)，n=1067 | 实测单次 `compute()` ≈ 0.22 ms（Node 0.218 ms / headless 浏览器 0.05–0.2 ms） |

**为什么不看建筑高度来做"淹没比例"**：本 demo 的语义是"是否进水/水深"，不是"淹没体积"；建筑高度用于详情卡与兜底方块尺寸。要算"淹没到几层"可以用 `depth / 层高`，但层高数据在清单里没有逐栋保存（只有总高与层数），属于后续增强项。

---

## 3. 淹没面积（高程网格）

### 3.1 网格

```js
const NX = 168;
const NY = Math.round((NX * SCENE.heightMeters) / SCENE.widthMeters);  // 144
const dx = SCENE.widthMeters / (NX - 1);   // 83.83 m
const dy = SCENE.heightMeters / (NY - 1);  // 83.92 m
const cellArea = dx * dy;                  // ≈ 7,036 m²
```

启动时预采样一次 `168 × 144 = 24,192` 个高程点（`heightAtLocal`），之后每个水位只做比较：

```js
for (let i = 0; i < heights.length; i++) {
  const h = heights[i];
  if (h >= 0 && h < level) area += cellArea;   // 只统计“原本是陆地、现在在水下”
}
```

三个口径必须分清：

| 量 | 定义 | 实测（水位 2.5 m） |
| --- | --- | --- |
| `inundatedAreaM2` | **被淹陆地面积**：`0 ≤ h < level` 的格子 | 13.41 km² |
| `landAreaM2` | 陆地总面积：`h ≥ 0` 的格子 | 116.49 km² |
| `sceneAreaM2` | 网格覆盖总面积：所有格子 × `cellArea` | 170.19 km²（`168×144×7036 ≈ 170.2 km²`，比 14×12=168 km² 多 1.3%，是网格单元按 `dx·dy` 计的正常偏差） |

> 注意 `inundatedAreaM2` **不含海面与河床**（`h < 0` 的格子被跳过）：所以水位 2.5 m 时"13.41 km² 被淹"指的是**原本露出的滩涂、河道两岸、低洼农田**，不是整片海。这与"水面总面积"是两个口径，UI 上写的是"淹没面积"。

### 3.2 面积误差来源

1. **离散化**：83.8 m 网格对窄地物（河道、田埂、道路、海堤）会"抹平"。误差量级是"边界格子数 × `cellArea`"：细长区域（如 100 m 宽的河岸带）可能有几十 % 的相对误差；大面积区域（如整片平原）误差 < 1%。
2. **采样点 vs 格子中心**：每个格子只用中心点的高程判断，不做面积加权（如 25% 格子在水下的情况）。改进可用"角点插值 + 三角形裁切"精确求交。
3. **高程基准**：`heightAtLocal` 是椭球高近似，未接大地水准面；真实 DEM 要统一基准（见 §8）。
4. **水位语义**：水位是**全局水平面**（球面曲率修正只影响渲染，不影响统计）；真实洪水有比降、风增水、波浪爬高。

---

## 4. 直方图（预计算）

启动时对 16 个水位档（`0, 2, 4, …, 30 m`，`WATER.histogramStep = 2`）各算一次：

```js
const histogram = levels.map((level) => {
  let flooded = 0, danger = 0;
  for (const b of buildings) {
    const depth = level - minGround(b);
    if (depth > 0.15) { flooded += 1; if (depth > 2) danger += 1; }
  }
  return { level, flooded, danger, area: inundatedLandArea(level) };
});
```

- 复杂度：16 × (1067 + 24,192) ≈ 40.5 万次比较，实测 `buildAnalyzer` 整体 **~12 ms**（Node；含 24,192 次高程采样 + 16 档 × 1067 栋统计，另有冷启动 38 ms 的首测）/ 纳入加载遮罩后无感；
- UI（`StatsPanel`）直接读这份数组画 SVG 柱状图，当前水位左侧的柱子高亮为"已经发生"，右侧灰显；再叠一条当前水位竖线；
- 直方图**不随水位重算**，所以拖动滑块时图表是"静态参考 + 游标移动"，零成本。

---

## 5. 蓄水区分析（Reservoir）

> 与全局淹没**完全独立**的一套假设分析：在地形上框选一个矩形（ENU 轴对齐），给定"蓄水水位"，估算库区面积、实际水面、蓄水量与受影响建筑。实现见 [`src/cesium/floodApp.js`](../src/cesium/floodApp.js) §6.6（`computeZoneStats` / `buildZoneWater`）、UI 见 [`src/components/ZonePanel.vue`](../src/components/ZonePanel.vue)。

### 5.1 输入与输出

| 输入 | 说明 |
| --- | --- |
| 矩形 `{minX,maxX,minY,maxY}` | 场景 ENU 米（由 `pickPosition`/`pickEllipsoid` → `lonLatToLocal` 得到） |
| `zoneLevel` | 蓄水水位（米，海拔）；框选完成时自动给默认值，之后由 UI 滑块调整 |
| `buildings` | 与全局淹没同一份清单（1067 栋） |
| `heightAtLocal()` | 与地形/贴图/全局统计同一份地形真值 |

```js
// store.zone.stats
{
  areaKm2,          // 矩形面积 = w·h / 1e6
  waterAreaKm2,     // 实际水面面积 = 地形低于水位的格数 × cellArea / 1e6
  maxDepth,         // 框内最大水深（米）
  meanDepth,        // 被水覆盖格子的平均水深（米）
  volumeWanM3,      // 蓄水量（万 m³）
  buildingsTotal,   // 中心点落在矩形内的建筑数
  buildingsFlooded, // 其中 zoneLevel − minGround > 0.15 的栋数
  terrainMin, terrainMax,
}
```

### 5.2 地形采样（64×64）

```js
const N = 64;
const cellArea = (w * h) / (N * N);          // 矩形均分
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const h = heightAtLocal(x, y);             // 格子中心
  if (h < level) {
    waterCells += 1;
    volume += (level - h) * cellArea;        // m³
    depthSum += (level - h);
    maxDepth = Math.max(maxDepth, level - h);
  }
}
```

- **蓄水量**：`volume = Σ (level − 地形高) × cellArea`，再 `/1e4` 换算成**万 m³**；它是"矩形内水平面以下的体积"，不是水库真实库容（没有坝体/库岸约束）。
- **实际水面面积**：只统计地形低于水位的格子（`waterCells × cellArea`），所以 `waterAreaKm2 < areaKm2`（高地/山体露出）。
- **复杂度**：4,096 次 `heightAtLocal`，只在"框选完成"和"拖动蓄水水位"时重算；比全局淹没的 24,192 次预采样轻一个量级。

### 5.3 默认水位与滑块范围

框选松手后用 **24×24** 粗采样求框内 `minH/maxH`：

```js
const level = minH + Math.min(80, Math.max(5, (maxH - minH) * 0.35));
store.zoneLevelRange = [Math.floor(minH - 1), Math.ceil(maxH + 40)];
```

这样"框住一个山谷"时默认水位约在山谷高差的 35%（至少抬 5 m、最多 80 m），滑块范围覆盖"刚好没水"到"高过山头 40 m"。

### 5.4 建筑判定

```js
const bx = VILLAGE.centerX + b.localX;   // 场景 ENU（与 3D Tiles 根中心一致）
const by = VILLAGE.centerY + b.localY;
if (bx >= minX && bx <= maxX && by >= minY && by <= maxY) {
  buildingsTotal += 1;
  if (level - b.minGround > 0.15) buildingsFlooded += 1;
}
```

- 用**建筑中心点是否落在矩形内**判定归属（不按 footprint 相交），比全局淹没（逐栋 minGround 判定）更粗略；
- 被淹阈值仍为 `depth > 0.15 m`，与全局统计一致。

### 5.5 精度与局限

| 局限 | 说明 |
| --- | --- |
| 水平面假设 | 水面是恒定椭球高平面；不模拟坝体、入库流量、蒸发/渗漏、库岸侵蚀 |
| 采样分辨率 | 64×64 格；矩形越大，单格越粗（如 2 km × 2 km → 31 m/格），窄沟谷会漏算 |
| 体积口径 | `volume` 是"矩形 × 水平面以下的体积"，未扣除非库区部分；不能当真实库容 |
| 建筑归属 | 中心点在矩形内才算；不按 footprint 相交，不判断建筑是否阻水 |
| 与全局水位无关 | 蓄水区不写 `store.stats`，不参与直方图/面积统计；两套水位可以同时存在、互不影响 |
| 渲染 | Material 版水面没有场景深度 → 无折射/吸收/焦散/岸边泡沫；矩形只能 ENU 轴对齐，不能任意多边形/多区 |

### 5.6 实测

生产验收脚本的 `draw reservoir zone` 用例（1600×1000 headless）本轮实测：矩形 **0.20 km²**、实际水面 **0.17 km²**、默认蓄水水位 8.7 m；`clear reservoir zone` 后 `store.zone === null`。这些数值取决于拖拽位置与当前相机视角（矩形越小/越高，面积与蓄水量越小），验收只断言 `areaKm2>0 && waterAreaKm2>0`，不锁定具体值。

---

## 6. 输出契约

`compute(level)` 返回（字段与 `src/analysis/floodAnalysis.js` 一致）：

```js
{
  // 建筑
  totalBuildings, floodedBuildings, dangerBuildings,
  floodedRatio,                  // 0..1
  // 面积（m²）
  inundatedAreaM2, totalAreaM2,  // totalAreaM2 = 陆地面积
  sceneAreaM2,
  inundatedRatio,                // 被淹陆地 / 陆地总面积
  // 深度
  maxDepth, meanDepth,           // 仅统计被淹建筑
  waterLevel,
  // 图表 / 列表
  histogram: [{ level, flooded, danger, area }],
  floodedList: [{ id, name, type, depth, height, minGround }]   // 按深度降序，前 4 条
}
```

UI 消费方式：

| UI 位置 | 字段 |
| --- | --- |
| `StatsPanel` 四项主指标 | `floodedBuildings / totalBuildings`、`inundatedAreaM2`、`maxDepth`、`dangerBuildings` |
| `StatsPanel` 直方图 | `histogram` + `waterLevel`（画游标） |
| `StatsPanel` Top3 | `floodedList.slice(0, 3)` |
| `TopBar` 风险等级 | `waterLevel`（<6 安全 / 6–15 警戒 / 15–24 危险 / ≥24 极端） |
| `BuildingCard` | `selectedBuilding`（pick 时由 `floodApp` 写入；`depth = waterLevel - minGround`） |

---

## 7. 阈值语义（容易被问到的点）

UI 的风险刻度 **6 / 15 / 24 m** 是场景设计值（`WATER.safe/warn/danger`），而澜屿市 1067 栋的地基是 **2.65–23.36 m**（当前生成数据，seed=20261104；换种子会变），且六组团差别很大：滨海新区 2.65–6.78 m、滨水带 2.65–3.48 m、CBD 2.72–4.36 m、老城 6.47–12.33 m、西城 8.96–23.36 m、北城 9.61–18.86 m。两者的关系：

| 水位 | 建筑（1067 栋，`depth>0.15`） | 面积 | 语义 |
| --- | --- | --- | --- |
| 2.5 m（初始/常水位） | 0 / 1067 | 13.41 km² | 河道、滩涂、低洼农田在水下，城市安全（最低地基 2.65 m，仍在初始水位之上） |
| **6 m（"安全/警戒"分界）** | **256 / 1067** | 31.88 km² | **滨海新区 205 / 263 + CBD 46 / 46 + 滨水带 5 / 5 进水**（最大水深 3.35 m），老城/西城/北城安全 |
| 7 m | 319 / 1067 | 35.84 km² | **老城开始进水**（5 栋，最低地基 6.47 m），滨海带继续加深 |
| **8 m** | **338 / 1067** | 39.21 km² | **老城成片进水**（24 栋），全城 31.7% 被淹 |
| 9 m | 401 / 1067 | 42.52 km² | 老城/滨海带大范围进水 |
| 10 m | 566 / 1067 | 45.73 km² | 西城 45 / 北城 10 也开始进水（53.0%） |
| 12 m | 861 / 1067 | 49.24 km² | 老城 227、西城 224、北城 96（80.7%） |
| 15 m（"危险"分界） | 989 / 1067 | 50.83 km² | 绝大部分城市沉入水下（92.7%），最大水深 12.35 m |
| 24 m（"极端"分界） | 1067 / 1067 | 53.39 km² | 全城被淹，最大水深 21.35 m |
| 30 m（上限） | 1067 / 1067 | 54.62 km² | 最大水深 27.35 m |

> 结论：**6/15/24 是"通用风险叙事刻度"，不是按城市地基定的**。在澜屿市，"6 m 滨海带大部分进水、7 m 老城开始进水、8 m 老城成片、15 m 绝大部分城市沉没、24 m 全城"才是关键阈值；15/24 m 更多是"水深 + 海面抬升"的演示意义。README 与 UI 都如实标注，不夸大成"15 m 才危险"。

**口径说明（重要）**：本文与 README、`floodAnalysis.js`/UI 统一用 **`depth > 0.15 m`** 判定被淹；若按 `depth > 0` 的"占位面积"口径（tiles-dev 报告曾用过），同样水位为 **6 m → 269 / 10 m → 603 / 15 m → 992**，比正文分别多 13 / 37 / 3 栋。两个口径都不算错，但**同一份文档/同一张表里不能混用**。

**分类型 / 分区的 `minGround`**（决定淹没顺序，seed=20261104）：

| 分类 | 栋数 | `minGround` 中位数 | 范围 |
| --- | --- | --- | --- |
| `house` 民居 | 621 | 10.06 m | 2.89–23.36 m |
| `shop` 商住 | 319 | 9.78 m | 2.81–20.39 m |
| `apartment` 公寓/酒店 | 66 | 4.73 m | 2.75–6.67 m |
| `tower` CBD 塔楼 | 40 | 3.48 m | 2.84–4.36 m |
| `landmark` 地标 | 9 | 3.17 m | 2.72–4.30 m |
| `public` 公共建筑 | 6 | 3.13 m | 2.72–8.66 m |
| `pier` 码头/栈桥 | 6 | 2.70 m | 2.65–9.57 m |
| 老城（district old） | 233 | 9.13 m | 6.47–12.33 m |
| 西城（district west） | 320 | 10.62 m | 8.96–23.36 m |
| 北城（district north） | 200 | 12.05 m | 9.61–18.86 m |
| 滨海新区（district harbor） | 263 | 4.83 m | 2.65–6.78 m |
| 滨海 CBD（district cbd） | 46 | 3.52 m | 2.72–4.36 m |
| 滨水公共带（district waterfront） | 5 | 2.73 m | 2.65–3.48 m |

实测数据表（`minGround ∈ [2.65, 23.36]`，判定 `depth > 0.15`，危险 `depth > 2`）：

| 水位 | 被淹建筑 | 危险建筑 | 被淹陆地 | 占陆地 | 最大水深 | 平均水深 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 m | 0 | 0 | 0 km² | 0% | 0 | 0 |
| 2.5 m | 0 | 0 | 13.41 km² | 11.5% | 0 | 0 |
| 6 m | 256 | 103 | 31.88 km² | 27.4% | 3.35 m | 1.79 m |
| 7 m | 319 | 201 | 35.84 km² | 30.8% | 4.35 m | 2.38 m |
| 8 m | 338 | 269 | 39.21 km² | 33.7% | 5.35 m | 3.23 m |
| 9 m | 401 | 321 | 42.52 km² | 36.5% | 6.35 m | 3.66 m |
| 10 m | 566 | 344 | 45.73 km² | 39.3% | 7.35 m | 3.47 m |
| 12 m | 861 | 603 | 49.24 km² | 42.3% | 9.35 m | 4.07 m |
| 15 m | 989 | 928 | 50.83 km² | 43.6% | 12.35 m | 6.41 m |
| 24 m | 1067 | 1065 | 53.39 km² | 45.8% | 21.35 m | 14.77 m |
| 30 m | 1067 | 1067 | 54.62 km² | 46.9% | 27.35 m | 20.77 m |

## 8. 精度与局限

| 局限 | 影响 | 改进方向 |
| --- | --- | --- |
| **静态几何比较** | 没有流速/流量/到达时间/溃坝过程；水位到哪就"瞬间"淹到哪 | 接 HEC-RAS 2D / LISFLOOD-FP 离线演进结果（§10） |
| **`minGround` 偏保守** | 坡地建筑一角落水即整栋算被淹 | 用室内地坪/台基高程、或逐面片求交 |
| **83.8 m 网格** | 窄地物被抹平，薄区域相对误差大 | 提高网格密度（`NX` 翻倍 → 计算量 ×4，启动时一次）或直接读 DEM 栅格 |
| **不含海面/河床** | "被淹面积"与"水面总面积"口径不同 | 视需求输出两套口径 |
| **水位是水平面** | 浪高（0.3–1.3 m）不计入；无风增水/爬高 | 把水位当作"含增水的等效水位"，或加水文模型 |
| **建筑不阻水** | 水可"穿过"建筑，无绕流 | 3D 体块 + 流场耦合（成本高） |
| **数据是程序化虚构** | 不能用于真实决策 | 换真实 DEM + 真实建筑清单（README §七） |
| **蓄水区水平面假设** | 库区是矩形 + 恒定水平面；无坝体/来水/渗漏 | 真实库容需 DEM 填洼 + 坝址垭口线（§10 第 5 条后） |
| **高程基准** | 椭球高近似，未接大地水准面 | 真实 DEM 统一基准 |

> 面积网格的误差可以粗略量化：水线穿过的边界格子数 × `cellArea` 就是离散误差上界。14×12 km、83.8 m 格子，水线总长几十 km 时，误差量级是 **0.1–0.5 km²**（相对 50 km² 约 1–3%）；窄河道/海堤这类细长地物的相对误差会明显更大。
>
> 蓄水区的误差另算：矩形内 **64×64** 采样（如 2 km × 2 km → 31 m/格），`volumeWanM3` 与 `waterAreaKm2` 都是离散估算；建筑只用中心点归属，不按 footprint 相交（详见 §5.5）。

---

## 9. 复杂度与性能

| 操作 | 复杂度 | 实测（Apple M1 Max / headless Chromium） |
| --- | --- | --- |
| `buildAnalyzer(buildings)` | O(NX·NY + L·B) ≈ 24,192 + 16×1067 | **~12 ms**（Node；冷启动首测 ~38 ms）/ 一次性，加载遮罩内 |
| `compute(level)` | O(B)，B=1067 | **~0.22 ms/次**（Node 0.218 / 浏览器 0.05–0.2） |
| 网格预采样 | O(NX·NY) 次 `heightAtLocal` | 含在 `buildAnalyzer` 里 |
| 蓄水区 `computeZoneStats` | O(64×64) = 4,096 次 `heightAtLocal` | 框选完成/拖动水位时触发，<1 ms 量级 |
| UI 刷新 | 5.5 Hz（180 ms） | Vue diff + SVG 重绘，低频 |

`compute()` 便宜到"每帧算都行"，但**写 `store.stats` 会触发 Vue 深层响应式 diff + DOM 重排**，所以限频的是写 UI，不是计算（见 README §6.8）。

---

## 10. 换成真实数据后的升级路径

1. **DEM 栅格洪水（最低成本）**：用真实 DEM 原始分辨率栅格做 `h < level` 掩膜，`cellArea` 改用 DEM 像元面积；`floodAnalysis.js` 的结构不变，只换 `heights[]` 来源。
2. **建筑-水体多边形求交**：对每栋 footprint 采样淹没掩膜，得到"被淹面积占比"；用一层地坪高程替代 `minGround`。适合有真实建筑轮廓（OSM/CityGML）的场景。
3. **3D Tiles 要素级判定**：遍历 `tileset.tileVisible` 的 `Cesium3DTileFeature` 逐要素采样地形高度；建议**离线预计算**进 `buildings.json`，运行时只读（在线遍历会拖垮帧率）。
4. **水文模型耦合**：HEC-RAS 2D / LISFLOOD-FP / TELEMAC 离线跑水位-时间序列 → 每个时间步导出淹没栅格（GeoTIFF）或等值面 → 前端加时间轴，按步切换掩膜并聚合统计；"水位滑块"保留为"设计水位"模式。
5. **水量守恒**：从"给定水位"改为"给定来水过程"，用 DEM 做洼地蓄水演算（填洼 + 体积-水位曲线），得到更真实的上涨曲线。
6. **蓄水区做真**：用坝址/垭口线 + DEM 填洼演算"蓄水位 → 库容"曲线，替换当前的"矩形 × 水平面"估算；支持任意多边形库区、坝高/泄洪，并把库区与下游淹没联动。

---

## 11. 自测方法（无需跑浏览器）

`floodAnalysis.js` 与 `terrainModel.js` 都是纯 JS，可以在 Node 里直接验证：

```bash
cd apps/flood-sim
node --input-type=module -e "
import fs from 'node:fs';
import { buildAnalyzer } from './src/analysis/floodAnalysis.js';
const { buildings } = JSON.parse(fs.readFileSync('public/generated/village/buildings.json', 'utf8'));
const a = buildAnalyzer(buildings);
// 1) 单调性：水位升高，被淹建筑数与面积不应减少
for (let l = 0.5; l <= 30; l += 0.5) {
  const s = a.compute(l);
  // 2) 阈值语义：depth > 0.15 才算被淹
  // 3) 面积口径：0 ≤ h < level
}
console.log(a.compute(15));
"
```

建议断言（可加进 CI）：

- `compute(level).floodedBuildings` 与 `inundatedAreaM2` 对 `level` **单调不减**；
- `compute(0).floodedBuildings === 0`；
- `compute(30).floodedBuildings === totalBuildings === 1067`（本场景全部建筑地基 < 30 m）；
- `floodedList` 按 `depth` 降序，且 `depth === level - minGround`；
- `histogram.length === 16`，且每项 `flooded ≤ totalBuildings`；
- 蓄水区：`computeZoneStats` 的 `waterAreaKm2 ≤ areaKm2`、`volumeWanM3 ≥ 0`、`maxDepth ≤ zoneLevel − terrainMin`（可用 floodApp 暴露的 `getZoneStats` 或直接在浏览器里读 `store.zone.stats` 做冒烟检查）。
