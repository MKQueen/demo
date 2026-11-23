# 自建程序化北京资产包 · `src/world/beijing.js`

> 「京城来信」v2 的北京元素全部由 Three.js 基础几何 + canvas 贴图**程序化生成**，
> 不加载任何外部模型 / 不复制参考站资产。所有材质都走 `src/render/toon.js` 的
> `createToonMaterial`，因此自动继承游戏的 MRT 描边 + LUT 调色管线，风格与星球/角色一致。

## 文件

| 文件 | 说明 |
| --- | --- |
| `src/world/beijing.js` | 全部资产 builder + 四个片区布置 + 出生点/NPC 站位/地标数据 |
| `src/world/README-beijing.md` | 本文件 |
| `tools/beijing/test.html` | 独立验证页：`?mode=gallery`（资产陈列）/ `?mode=scene&district=hutong\|axis\|cbd\|wall&view=...`（片区）/ `?mode=single&key=...`（单体）/ `?mode=probe`（地形采样） |
| `tools/beijing/shots.mjs` | Playwright 批量截图 → `screenshots/beijing/` |
| `tools/beijing/realpage.mjs` | 真实游戏页（127.0.0.1:5190）出生点 / 相机 / 行走验证 → `screenshots/beijing/real-*.png` |
| `tools/beijing/items.mjs` | 逐件资产渲染（调比例/颜色用） |
| `tools/beijing/{recon,probe,maps,plots,findland,survey,mapall,picks,inspect}.mjs` | 选址用的地形侦察脚本（保留备查） |

## 集成接口

```js
import { buildBeijing } from './world/beijing.js';
const beijing = buildBeijing({
  scene: gameScene,        // 可选：传入则自动 scene.add(group)
  collision: world.collision, // 必需：用 groundAtDirection 采样地面
  spots: world.spots,      // 可选：用于检查是否压到现有任务点（会写进 warnings）
  group: world.group,      // 可选：所有 mesh 加到这个 group
});
await beijing.ready;
await beijing.fontsReady;  // 中文招牌字体加载完成后会重绘图集
```

返回：

```js
{
  group,                    // THREE.Group（新增的 4 个片区 mesh 都在里面）
  update(time, dt),         // 灯笼串摆动（每帧调用一次即可）
  spawn,                    // 推荐出生点：{ point, normal, facing, heading, cameraDirection }
  npcSpots,                 // 推荐 NPC 站位：[{ id, name, district, point, normal, facing, description }]
  wallColliders,            // 建筑水平 OBB 碰撞盒（17 个，见下文「碰撞体」）
  landmarks,                // 全部地标：[{ id, name, district, point, normal, facing, description }]
  districts,                // 片区元数据（含 terrace 尺寸/terraceTop/up/right/forward/views）
  ready, fontsReady,
  materials, atlas,         // 共享的 3 个 toon 材质 + 招牌图集（调试用）
  warnings,                 // 与现有交互点过近等警告（正常应为空数组）
  info(),                   // { districts, draws, triangles, warnings, landmarks }
}
```

**Draw call**：新增 11 个 mesh（合并批：胡同 paint/decal/glow、中轴 paint/decal/glow、CBD paint/decal 共 8 个；动态灯笼串 3 条），
合并几何约 **+1.5 万三角面**；材质只有 3 个（顶点色主体 / 招牌图集 / 灯笼发光），
全部 `castShadow`，与现有场景合计 54 个 draw call、48.8 万三角面。

## 坐标系（重要）

世界 = 球面坐标，Y 轴向上。每个片区在自己的**切平面坐标系**里布置：

```
world = origin + right * x + up * y + forward * z
```

- `up` = 片区中心的球面径向（= 该处地面法线的稳定近似）。
- `origin` = 片区中心沿 `up` 打到地面的点（用 `collision.groundAtDirection` 取）。
- 台地（terrace）是**水平面**：顶面高度 = `terraceTop`（相对 `origin` 沿 `up`）。
  片区里所有建筑/道具都站在 `y = terraceTop` 上，不会因为地形起伏而穿模/悬空。

片区数据（当前值，来自 `beijing.districts`）：

| id | 名称 | origin（世界） | up | terrace 尺寸 | terraceTop |
| --- | --- | --- | --- | --- | --- |
| `hutong` | 春风胡同 | `[-3.232, 8.058, 25.831]` | `[-0.1186, 0.2957, 0.9479]` | 13.0 × 9.4 | 2.620 |
| `axis` | 中轴（鼓楼+天坛） | `[-1.074, 31.818, -1.421]` | `[-0.0337, 0.9984, -0.0446]` | 8.4 × 6.6 | 1.592 |
| `cbd` | 国贸 CBD | `[26.267, 9.713, 1.399]` | `[0.9368, 0.3464, 0.0499]` | 9.0 × 6.8 | 11.269 |
| `wall` | 城墙片段 | 与 hutong 同坐标系（取其台地南沿） | 同 hutong | — | 2.620 |

`districts[i]` 里同时暴露 `terrace: { x, z, w, d }`（台面中心相对片区原点的局部 x/z、宽、深），
**主程序请直接读这个字段来生成可行走面**，不要再在 main.js 里镜像常量。

## 资产清单（全部局部坐标：脚底中心为原点，+Y 上，+Z 正面）

| 资产 | builder | 关键尺寸 | 说明 |
| --- | --- | --- | --- |
| 四合院 | `buildCourtyard` | 5.2×4.2×3.6（高到屋脊） | 灰瓦坡顶正房/厢房/倒座房、院墙、红门金钉、门墩、台阶、门楼灯笼、可选石狮 |
| 胡同牌楼 | `buildPaifang` | 宽 4.5、高 4.2 | 红柱 + 双额枋 + 灰瓦顶 + 双面绿匾「春风胡同」+ 4 只灯笼 |
| 胡同路牌 | `buildHutongSign` | 高 2.4 | 绿色双面路牌（春风胡同/南锣鼓巷/烟袋斜街，canvas 白字） |
| 绿色邮筒 | `buildMailbox` | 高 1.4 | 中国邮政绿圆柱邮筒 + 「邮」徽 + 开箱时间牌 |
| 二八自行车 | `buildBike` | 长 1.15、高 1.0 | 低模自行车（双轮/车架/车把/车座/后架/车铃） |
| 石狮子 | `buildLion` | 高 1.2 | 须弥座 + 鬃毛 + 绣球 |
| 老槐树 | `buildTree` | 高 ~4.3 | 低模树冠（6~8 个 Icosahedron 团块）+ 树干 |
| 小卖部 | `buildShop` | 2.7×2.0×3.0 | 奶油墙 + 灰瓦 + 红雨棚 + canvas 招牌 |
| 早点铺 | `buildBreakfast` | 2.8×2.0×2.9 | 棚子 + 操作台 + 蒸笼 + 长凳 + 「老张早点」招牌 |
| 晾衣绳 | `buildLaundry` | 2.7×2.1 | 两根木杆 + 铁丝 + 4 块彩色布 |
| 灯笼串 | `District.addLanternString` | 跨街 2.7 宽、高 3.7（相对台面） | 横杆 + 3 只红灯笼，`update()` 里整体轻微摆动 |
| 鼓楼 | `buildDrumTower` | 3.6×2.5×7.0 | 灰砖台基 + 拱门 + 红墙带 + 重檐灰瓦木楼 + 匾额 |
| 天坛祈年殿 | `buildTempleOfHeaven` | 直径 5.4、高 ~6.4 | 三层汉白玉圆台 + 红墙 + 三重蓝琉璃檐 + 金宝顶 |
| 中国尊 | `buildCiticTower` | 高 9.6 | LatheGeometry 收腰曲线 + 楼层横带 + 金冠 |
| 央视大楼 | `buildCCTV` | 4.0×1.4×5.5 | 拐角门形 + 玻璃幕墙横带 + 悬挑 |
| 鸟巢 | `buildBirdNest` | 4.4×3.4×2.3 | 椭圆柱面编织钢架（3 层交叉斜梁）+ 碗形看台 + 火炬塔 |
| 798 厂房 | `buildFactory798` | 3.0×2.1×6.4（含烟囱） | 红砖厂房 + 锯齿屋顶 + 红砖烟囱白箍 |
| 城墙片段 | `buildHutongWall` | 8.5 长、墙高 2.15、烽火台高 2.9 | 垛口 + 两座烽火台 + 红旗，建在胡同台地南沿 |

## 片区内容

- **胡同区（春风胡同）**：13.0×9.4 台地，沿 local x 的街面；西端牌楼、两座四合院（北侧）、
  小卖部/早点铺/小院（南侧）、邮筒、2 辆自行车、2 块路牌、晾衣绳、3 棵老槐树、
  2 条跨街灯笼串、台地南沿城墙片段（2 烽火台）。相邻就是参考站原来的村子建筑，
  所以起步就能看到「胡同 + 村落」混在一起。
- **中轴区**：8.4×6.6 台地（星球北面高地草坪，原「山寺」附近）。西侧天坛祈年殿（含华表一对），
  东侧鼓楼（含石狮一对），中间石板广场，灯笼串 1 条。
- **CBD 区**：9.0×6.8 台地（原「国贸街」中央广场）。中国尊、央视大楼、鸟巢、798 厂房烟囱
  围合小广场 + 花坛/路灯/「国贸 CBD」标识。东侧紧邻原城市建筑。
- **城墙片段**：见上。原参考站星球四周都被既有村落/城市建筑占满（`screenshots/beijing/recon`），
  独立山脊无法避免穿插，所以改成胡同台地外沿的城墙，百分百不会与既有建筑穿模。

## 地标 / NPC 推荐位置

世界坐标（`landmarks` / `npcSpots` 直接给出，可直接放任务点 / NPC）：

### 出生点（推荐）

```js
beijing.spawn = {
  point:  [-1.754, 9.080, 28.460],
  normal: [-0.1186, 0.2957, 0.9479],
  facing: [0.9929, 0.0311, 0.1145],   // 面向牌楼
  heading: -0.00439,                  // 与 player.js 的 heading 约定一致
}
```

站在胡同街心、面朝牌楼（西）：左侧早点铺/小卖部，右侧四合院红门/石狮/灯笼，
正前方是「春风胡同」牌楼。身后 5u 沿街无遮挡（相机不会穿墙）；最近的建筑立面在两侧 1.4~1.6u。
真实页验证截图：`screenshots/beijing/real-01-recommended-spawn.png`。

### 地标（可用于任务点 / 参观视角）

| id | 名称 | 世界坐标 | 建议朝向 | 说明 |
| --- | --- | --- | --- | --- |
| `hutong-street` | 春风胡同 · 街心 | `[-1.766, 9.109, 28.555]` | 沿 +facing（朝牌楼） | 出生点/「逛胡同」任务点 |
| `hutong-paifang` | 春风胡同牌楼 | `[1.907, 9.996, 30.954]` | 面向 -right（胡同里） | 拍照点，牌匾「春风胡同」 |
| `hutong-courtyard` | 四合院 | `[-0.572, 8.241, 30.663]` | +z（街上） | 红门/福字/石狮/灯笼，NPC 门口对话 |
| `hutong-mailbox` | 绿色邮筒 | `[-4.734, 7.985, 29.273]` | +x（街东） | 拾取点/邮差 NPC |
| `hutong-shop` | 胡同小卖部 | `[0.245, 11.077, 29.354]` | -z（街心） | 小卖部老板 NPC |
| `hutong-breakfast` | 老张早点 | `[-4.83, 10.995, 28.849]` | -z（街心） | 摊主 NPC |
| `hutong-tree` | 老槐树 | `[2.023, 13.127, 30.413]` | +x | 聊天/回忆点 |
| `wall-ridge` | 山脊长城（城墙片段） | `[-1.878, 13.771, 29.566]` | +z（俯瞰） | 台地南沿，可俯瞰山坡 |
| `wall-tower-1` | 长城烽火台 1 | `[0.414, 14.023, 30.408]` | +z | — |
| `wall-tower-2` | 长城烽火台 2 | `[-4.312, 13.874, 29.862]` | +z | — |
| `qiniandian` | 天坛祈年殿 | `[1.128, 30.326, -0.45]` | 沿 -z | 中轴区拍照点 |
| `gulou` | 鼓楼 | `[-3.645, 36.851, -1.95]` | 沿 -z | 中轴区拍照点 |
| `axis-plaza` | 中轴广场 | `[-1.134, 33.598, -1.701]` | +right | 鼓楼/天坛之间的广场 |
| `axis-street` | 中轴街头 | `[-1.532, 33.531, -2.9]` | -z | 中轴区 NPC 站位参考点 |
| `citic` | 中国尊 | `[40.637, 17.099, -0.618]` | 面向广场 | CBD 拍照点 |
| `cctv` | 央视大楼 | `[38.337, 16.718, 3.116]` | 面向广场 | CBD |
| `birdnest` | 鸟巢 | `[38.431, 11.602, 4.803]` | 面向广场 | CBD |
| `factory-798` | 798 烟囱 | `[40.415, 13.068, -0.542]` | 面向广场 | CBD |
| `cbd-plaza` | 国贸 CBD 广场 | `[37.407, 12.775, 1.84]` | 面向广场 | CBD 任务点 |

### NPC 站位（`beijing.npcSpots`，已避开门/道具/灯笼）

| id | 建议 NPC | 世界坐标 | 朝向 | 说明 |
| --- | --- | --- | --- | --- |
| `npc-hutong-daye` | 遛鸟大爷 | `[1.474, 9.515, 28.729]` | 朝东（-right） | 牌楼里侧街边 |
| `npc-hutong-dama` | 广场舞大妈 | `[-3.884, 10.111, 27.872]` | 朝西（+right） | 早点铺前 |
| `npc-hutong-xuesheng` | 红领巾小学生 | `[-6.077, 8.228, 28.185]` | 朝西偏街心 | 邮筒旁 |
| `npc-hutong-laoshi` | 老街坊 | `[-7.856, 9.986, 27.414]` | 朝西（牌楼） | 胡同东口 |
| `npc-axis-daye` | 中轴遛鸟大爷 | `[-1.675, 33.333, -2.741]` | 朝北（鼓楼/天坛） | 中轴广场南侧 |
| `npc-cbd-worker` | 国贸上班族 | `[37.086, 12.971, 1.515]` | 朝中国尊 | CBD 广场中心 |

> 注意：`point` 已经是**台面高度的世界坐标**（可直接 `root.position.copy(point)`），
> `facing` 是切平面内的单位朝向（可直接 `placeActor(root, point, normal, facing)`）。

## 碰撞体（`wallColliders`，供 PlayerController 做水平 OBB 阻挡）

`buildBeijing()` 额外返回 `wallColliders`（**附加字段，不影响旧接口**）。每个条目：

```js
{
  id: 'hutong-courtyard-1',        // 唯一 id（hutong-/axis-/cbd- 前缀）
  name: '四合院（带石狮）',          // 中文名（调试用）
  district: 'hutong',              // 所属片区
  // ---- 推荐用法：水平 OBB（玩家贴地，只做水平阻挡）----
  centerGround: [x, y, z],         // 建筑底面中心（世界坐标）
  up:      [x, y, z],              // 球面法线（片区 up）
  right:   [x, y, z],              // 建筑局部 +X（已含 rotY）
  forward: [x, y, z],              // 建筑局部 +Z（已含 rotY）
  half:  [hw, hd],                 // 水平半宽/半深（局部 right / forward 方向）
  height: 3.2,                     // 高度（从底面往上；屋顶形状不做进碰撞）
  // ---- 完整 OBB（备选）----
  obb: {
    center: [x, y, z],             // OBB 中心（= centerGround + up*height/2）
    axes: [[right], [up], [forward]],
    half: [hw, height/2, hd],
  }
}
```

水平阻挡判定（把玩家位置投影到建筑局部水平面）：

```js
const rel = playerPos.clone().sub(new THREE.Vector3(...c.centerGround));
const dx = rel.dot(new THREE.Vector3(...c.right));
const dz = rel.dot(new THREE.Vector3(...c.forward));
const dy = rel.dot(new THREE.Vector3(...c.up));      // 0 表示站在底面高度
const r = 0.35;                                       // 角色半径
const blocked =
  Math.abs(dx) <= c.half[0] + r &&
  Math.abs(dz) <= c.half[1] + r &&
  dy >= -0.35 && dy <= c.height + 0.35;               // 高出屋顶上方可以跳过（可选）
```

常规用法：算出下一帧水平位置 → 若落在任一 OBB 内，就按法向滑出（或直接不移动）。
同一 `wallColliders` 也可给 FollowCamera 用（替代全部 beijing mesh 的 raycast，更便宜）。

当前 17 个碰撞体（都贴住模型，街心/牌楼下保持可通行，已验证）：

| id | 面积（half） | 高 | 说明 |
| --- | --- | --- | --- |
| `hutong-courtyard-1/2/3` | 2.2×1.7 / 2.2×1.7 / 1.8×1.4 | 3.2 / 3.2 / 2.7 | 三座四合院整体（院墙+房屋，不含门前台阶） |
| `hutong-shop` | 1.35×1.0 | 3.0 | 小卖部 |
| `hutong-breakfast` | 1.2×0.45 | 1.05 | 早点铺操作台（棚子/桌凳可穿，避免封街） |
| `hutong-paifang-pillar-1/2` | 0.31×0.31 | 3.6 | 牌楼两根柱子（柱间 0.2u 街心可走） |
| `hutong-wall` | 4.25×0.41 | 2.15 | 城墙片段 |
| `hutong-wall-tower-1/2` | 1.0×1.0 | 3.45 | 两座烽火台 |
| `axis-temple` | 2.7×2.7 | 6.4 | 天坛（含三层圆台） |
| `axis-gulou` | 2.2×1.7 | 7.2 | 鼓楼（含石台） |
| `cbd-citic` | 1.25×1.25 | 9.6 | 中国尊 |
| `cbd-cctv` | 2.0×0.85 | 5.5 | 央视大楼 |
| `cbd-birdnest` | 2.2×1.7 | 2.3 | 鸟巢 |
| `cbd-factory` | 1.28×0.89 | 2.1 | 798 厂房 |
| `cbd-chimney` | 0.4×0.4 | 4.8 | 798 烟囱 |

> 注意：四合院 OBB 是**整个院落的外包围**（玩家不能进院子，符合四合院关着门的设定）；
> 早点铺只挡操作台；牌楼只挡两根柱子，牌楼下方可以穿过。树/邮筒/自行车/石狮/灯笼/晾衣绳
> 不提供碰撞（小件，穿过去也不影响观感；需要时可以自己按同样格式补）。

调整方法：在对应 `layoutXxx()` 里改 `district.addCollider(id, { x, z, y, w, d, h, rotY })` 的
`x/z`（局部坐标）、`w/d/h`（宽深高）、`rotY`（与资产同一旋转）。`y` 传资产底面局部高度
（台地上的建筑一般是 `topY + 0.05`）。删掉某个 collider 传 `null` 即可（或直接注释掉）。

验证：`tools/beijing/shots.mjs` 的 report.json 里没有 collider 数据，
可用 DevTools 里 `__courier.beijing.wallColliders` 或 `tools/beijing/test.html?mode=scene`
页面的 `__app.beijing.wallColliders` 查看（当前 17 个、`warnings=[]`）。

## 怎么调

### 改片区位置

编辑 `beijing.js` 末尾 `DISTRICT_SPECS`：

```js
{
  id: 'hutong', name: '春风胡同',
  center: [-0.1186, 0.2957, 0.9479],   // 球面方向（会被归一化），用 collision 落到地面
  forwardHint: [0.0, 0.965, -0.2623],  // 切平面 +z 朝向（会被投影到切平面）
  layout: layoutHutong,
  views: [...],                        // 工具页相机：[x, y, z] 是片区局部坐标
}
```

`center` 挪动后整块片区会跟着走；如果地形起伏导致台地太高，只需减小台地 `w/d`
（`layoutHutong` 里 `addTerrace` 的第一个调用）或把 `center` 挪到更平的地方。

### 改台地高度/大小

`district.addTerrace({ x, z, w, d, color, sink })` 会自动采样足迹 5×5 的碰撞高度，
取最高点 +0.06 作为台面，向下延伸到最低点 -sink。返回值是台面局部高度（`terraceTop`），
台地上所有资产都以它为 `y` 基准。

### 改资产造型/配色

- 配色集中在文件顶部 `C` 对象（灰瓦/奶油墙/砖红/邮政绿/天坛蓝）；
- 单件资产都是 `buildXxx(batch, {...})` 形式，改参数即可（尺寸、颜色、灯笼数量等）；
- 招牌文字在 `CELLS` + `drawAtlas()` 里改（canvas 1024² 图集，所有招牌共用一个材质）；
- 字体用 UI 同一套 woff2（`public/fonts/`，ZCOOL KuaiLe / Ma Shan Zheng），
  `fontsReady` 完成会重绘图集。

### 改片区布置

每个片区的 `layoutXxx(district)` 里按局部坐标摆资产：

```js
district.addAsset((b) => buildCourtyard(b, { gate: true }), {
  x: -3.2, y: baseY, z: -2.95, rotY: 0,
});
```

- `x/z` 沿台面（局部），`y` 一般是 `baseY = terraceTop + 0.05`；
- `rotY` 绕片区 up 轴旋转（`+Z` 正面朝向）；
- `district.localPoint(x, y, z)` 可换算成世界坐标；
- 新增地标用 `district.landmark(id, name, [x, y, z], { description, facing })`，
  新增 NPC 站位用 `district.npcSpot(id, name, [x, y, z], [facingLocalX, facingLocalZ], desc)`。

### 改工具页相机

`DISTRICT_SPECS[i].views`：`position/target` 是**片区局部坐标**（`applyView` 会自动加
`terraceTop`；给视角加 `flat: true` 表示不加）。`up: 'forward'` 用于俯视图。

## 验证方式

```bash
# 0) 共享 dev server 已在 127.0.0.1:5190 运行（不要另起）
# 1) 资产陈列 + 四片区截图（写到 /tmp 再拷贝，避免 Vite HMR 重载页面）
node tools/beijing/shots.mjs
# 2) 真实游戏页：出生点/相机/行走验证
node tools/beijing/realpage.mjs
# 3) 逐件资产
node tools/beijing/items.mjs
```

输出：

- `screenshots/beijing/00-asset-gallery.png` — 17 件自建资产陈列；
- `screenshots/beijing/01-hutong-street.png` — 胡同街景（出生点视角）；
- `screenshots/beijing/02-hutong-paifang.png`、`03-hutong-gate.png`、`04-hutong-aerial.png`；
- `screenshots/beijing/05-axis-street.png`、`06-axis-temple.png`、`07-axis-gulou.png`、`08-axis-aerial.png`；
- `screenshots/beijing/09-cbd-street.png`、`10-cbd-tower.png`、`11-cbd-aerial.png`；
- `screenshots/beijing/12-great-wall-ridge.png`、`13-great-wall-aerial.png`；
- `screenshots/beijing/14-hutong-hill-overview.png` — 胡同台地 + 周围原村落/山丘；
- `screenshots/beijing/real-00-lead-spawn.png`、`real-01-recommended-spawn.png`、`real-02-walk-forward.png`、`real-03-turn-around.png`
  — 真实游戏页（含 HUD/角色）验证：出生点无遮挡、往前走进胡同、台地行走碰撞 OK；
- `screenshots/beijing/report.json` / `realpage-report.json` — 地标坐标、draw call、三角面、warnings。

Playwright 需要 `--use-gl=angle --enable-unsafe-swiftshader --ignore-gpu-blocklist`（脚本已带）。

## 已知限制 / 集成注意

1. **碰撞**：
   - 可行走面：由 main.js 用 `beijing.districts[i].terrace` + `terraceTop` 生成四边形后
     `collision.appendGeometry` 追加（BEIJING_TERRACES 常量已过时：hutong 13.0×9.4、
     cbd 9.0×6.8、axis 8.4×6.6 不变）。
   - 建筑阻挡：使用附加导出的 `beijing.wallColliders`（17 个水平 OBB，格式见上文「碰撞体」），
     街心与牌楼下方已验证可通行；树/邮筒/自行车等小件不含碰撞。
2. **台地高度**：胡同台地在山坡上，下坡一侧有约 1.8~2.6u 的石砌台壁（视觉上是石头护坡），
   上坡一侧基本与地面齐平；没有台阶/坡道（台阶会与既有地形冲突，故省略）。
3. **相机**：巷子是 2.5~2.8u 宽，最近的建筑立面在两侧 1.4~1.6u；出生点朝向沿街，
   相机后方 5u 无遮挡。若玩家在牌楼下 180° 转身，跟随相机可能穿过牌楼横梁，
   这是 FollowCamera 自身行为（它已对 `cameraColliders`（beijing 全部 mesh）做 raycast，
   大部分情况会拉近）。
4. **长城**：参考站星球已被既有村落/城市占满，独立山脊难以避免穿模，故改为胡同台地
   南沿的城墙片段（垛口 + 2 座烽火台 + 红旗），俯瞰山坡，视觉上仍是「长城」元素。
5. **霓虹/发光**：灯笼用 `emissive` 恒定暖色，没有点光源（避免额外光照开销）。
6. **字体**：招牌字体首次会在 `fontsReady` 后重绘图集；游戏 intro 阶段字体已加载完，
   所以真实页无闪烁。
