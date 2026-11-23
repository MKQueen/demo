# src/actor — 角色 / NPC 骨骼动画层

负责玩家角色（avatar）与 NPC 的骨架、蒙皮网格、动画、换装、朝向。
资产全部来自原站 `public/assets-messenger/geometries/`，由 `src/assets.js` 的
Draco worker 解码（所有自定义属性都会被解出来）。

文件：

| 文件 | 职责 |
| --- | --- |
| `skeleton.js` | 解码 bones point cloud → `THREE.Bone` 层级 + `THREE.Skeleton`（含 inverse bind matrices） |
| `clip.js` | 解码动画 point cloud → `THREE.AnimationClip`（position + quaternion tracks） |
| `skin.js` | 合并 accessory 几何、构建 `SkinnedMesh`、蒙皮权重归一化 |
| `material-utils.js` | 从渲染层取材质（`materials.character()` / `materials.npc()`），无渲染层时用调色板贴图 fallback |
| `avatar.js` | `createAvatar({ assets, materials })`：idle/run/sprint/air/afk 播放与交叉淡入、换装、说话状态、显隐 |
| `npc.js` | `createNPC({ assets, materials, type })`：19 种 NPC、idle/talk/idleTalk/walk、朝向目标 |

---

## 1. 数据格式结论（已逐项验证）

### 1.1 骨骼 `geometries/avatar/avatar-bones.drc` / `npcs/present/<type>/<type>-bones.drc`

Draco **point cloud**，每点一根骨头，属性：

| 属性 | 类型 | 含义 |
| --- | --- | --- |
| `position` | float32 ×3 | 相对**父骨**的局部平移 |
| `quaternion` | float32 ×4 | 相对父骨的局部旋转，**three 顺序 (x, y, z, w)** |
| `scale` | float32 ×3 | 局部缩放（所有资产都是 1） |
| `hierarchy` | **uint16 ×1** | 父骨索引 **+ 1**；`0` 表示没有父骨（root） |

关键结论：`parent = hierarchy[i] - 1`（不是常见的 -1 哨兵，因为该列是无符号的）。
按此规则：

- avatar 22 骨、1 个 root（髋骨，bind 姿态 y = 0.826），结构为
  `0 髋 → 1..5 脊柱/颈/头`，`3 → 6..9 / 10..13` 双臂，`0 → 14..17 / 18..21` 双腿；
- NPC 9..32 骨（owl 9、fox 18、chef 28、boss 32…），同样是单 root。

`Skeleton` 的 inverse bind matrices 由骨骼局部变换按层级累乘出的**角色局部空间**
世界矩阵取逆得到；`SkinnedMesh.bind(skeleton, IdentityMatrix)`，用 three 默认的
`AttachedBindMode`（`root` 移动/旋转时 `bindMatrixInverse` 自动取当前矩阵的逆，
因此角色跟随 `root`）。

### 1.2 动画 `avatar/avatar-*.drc` / `npcs/present/<type>/<type>-*.drc`

也是 Draco point cloud，**点数 = 帧数 × 骨骼数**，point index = `frame * boneCount + bone`
（frame-major，帧内骨骼顺序与 bones 文件一致）：

| 属性 | 类型 | 含义 |
| --- | --- | --- |
| `position` | float32 ×3 | 该帧该骨的局部平移 |
| `quaternion` | float32 ×4 | 该帧该骨的局部旋转 (x,y,z,w) |
| `scale` | float32 ×3 | 恒为 1，构建 clip 时省略 |

- 播放帧率 **30 fps**（`clip.js: ANIMATION_FPS`）。
- avatar 各 clip 实测：

| clip | 源帧数 | 写入 keys | 时长 | 备注 |
| --- | --- | --- | --- | --- |
| idle | 90 | 90 | 3.000 s | 无重复帧，直接循环 |
| run | 23 | 22 | 0.733 s | 最后一帧是第 0 帧的副本，丢弃 |
| sprint | 23 | 23 | 0.767 s | 无精确重复帧，保留 |
| air | 40 | 39 | 1.300 s | 尾部多一帧重复第 1 帧（第 38 帧重复第 0 帧），丢弃尾部 |
| afk1 | 444 | 444 | 14.800 s | |
| afk2 | 180 | 180 | 6.000 s | |
| afk3 | 140 | 139 | 4.633 s | 最后一帧重复第 0 帧，丢弃 |

  `clip.js` 自动检测这两种"重复收尾"模式并去掉，保证 loop 接缝处是一帧的正常步进
  （实测 run 接缝差值 0.125 ≈ 普通相邻帧差；idle/sprint/afk1 接缝 ≤ 0.007）。
- 播放速度沿用原站配置：run/sprint 1.1×；NPC 中 boss/threekid 0.9×、
  young-lady（flower lady）idle 0.75× / talk 1.1×。
- 每个 clip 44 条 track（22 骨 × position + quaternion）。

### 1.3 网格 `avatar/accessories/*.drc`、`npcs/present/<type>/<type>.drc`

Draco triangle mesh，属性（全部由 assets.js 解出，直接可喂给 `SkinnedMesh`）：

| 属性 | 类型 | 含义 |
| --- | --- | --- |
| `position` / `normal` | float32 | 绑定姿态顶点 |
| `uv` | float32 ×2 | **直接采样 16×16 调色板图集**（见下） |
| `skinIndex` | **uint16 ×4** | 骨骼索引 |
| `skinWeight` | float32 ×4 | 骨骼权重 |
| `surfaceId` | float32 ×1 | 描边 pass 用来区分面/降噪 |

UV 约定（原站着色器的语义）：`uv.y > 1` 是**眼睛**区域（用 `tEye` 贴图 + 闪烁算法），
`uv.y < 0` 是 **NPC 嘴巴**区域（用 `tMouth` 贴图 + `uIsTalking`）；其余 UV 直接
`texture2D(tColors, uv)` 采样调色板图集。因此 actor 层只需要把 mesh 和贴图语义交给
渲染层，表情/眨眼/口型都由材质 shader 完成。

**数据洁癖（已处理）**：`bottom2` / `bottom3` 各有一个顶点的 skinWeight 被导出成
`[1,1]`（和为 2）。three 的 skinning 不做归一化，这种顶点在摆腿时会被位移两倍、
产生一条长三角形尖刺。`skin.js: normalizeSkinWeights()` 在合并后把权重归一到 1，
尖刺消失（这是我在 run/sprint 姿态截图里实际观察到并修掉的 bug）。

**合并**：同一套装备的多个 accessory 几何共享同一套属性/骨骼，用
`BufferGeometryUtils.mergeGeometries` 合成一个 `BufferGeometry`，整个角色只有
**1 个 SkinnedMesh、1 个 draw call**。默认套装（hair3 + top2 + bottom4 + shoes5）：
2836 顶点 / 5085 三角形。

### 1.4 尺寸 / 朝向约定

- 角色脚底 y ≈ 0（默认套装 bind pose bbox：y = 0.0027 … 1.6430），身高 **1.64**。
- 面朝 local **+Z**，`root` 的 +Y 是角色自身向上。
- NPC 原站资产本身比玩家高：chef 1.92、young-lady 1.91、oldwoman 1.23、fox 0.99…
  （原站也是直接 1:1 使用这些模型，没有缩放）；`npc.height` 会返回实测值。

---

## 2. API

### 2.1 `createAvatar({ assets, materials, outfit? }) → avatar`

同步返回对象，资产加载在 `avatar.ready`（Promise）里完成；`ready` 之前调用
`play/update` 是安全的（play 会记下最后一次请求，加载完应用）。

```js
import { createAvatar } from './src/actor/avatar.js';
const avatar = createAvatar({ assets, materials });
scene.add(avatar.root);
await avatar.ready;
avatar.play('idle', 0);          // 立即切换到 idle，不淡入
```

| 字段 / 方法 | 说明 |
| --- | --- |
| `root` | `THREE.Group`。世界/controller 设置 `position`、`quaternion`（+Z 面朝前，+Y 贴球面法线）。角色脚在 `root` 原点 |
| `rig` | 内部 Group（骨骼 + mesh 都在这里，永不自己做变换） |
| `ready` | `Promise<avatar>`，首次加载完成 |
| `height` | `1.64` |
| `outfit` | 当前换装（getter，返回副本），如 `{ hair:'hair3', top:'top2', bottom:'bottom4', shoes:'shoes5' }` |
| `play(name, fade = 0.2)` | 交叉淡入到 `'idle'\|'run'\|'sprint'\|'air'\|'afk1'\|'afk2'\|'afk3'`。同名重复调用是 no-op（可以每帧按速度调）。`fade` 单位秒，0 = 硬切 |
| `update(dt)` | **每帧调用一次**，`dt` 秒。内部 clamp 到 ≤0.1s，混音器推进 |
| `setOutfit(partial)` | 部分换装，如 `setOutfit({ hair:'hair1' })`；传 `null` 隐藏某个部件（如 `{ hair: null }`）。所有部件启动时已预解码，调用是同步的（只重新合并几何） |
| `setTalking(bool)` | 玩家没有嘴部动画；只把状态转发给材质 `uIsTalking`（若存在），保留 API 对称性 |
| `setVisible(bool)` | 显隐 |
| `blink()` | 原站眨眼在 shader 里按 `time` 自动播放（玩家 `vBatchID` 固定 0），actor 无动画可驱动；此方法只在材质暴露 `uBlink` uniform 时返回 true |
| `clips` | `['idle','run','sprint','air','afk1','afk2','afk3']` |
| `pose` / `talking` / `visible` | 当前状态 |
| `skeleton` / `mesh` / `material` / `mixer` | 底层对象（调试/换材质用） |
| `setMaterial(m)` | 运行时替换材质（会挂到 SkinnedMesh 上） |
| `dispose()` | 停止 mixer、释放合并几何与材质 |

附带导出：`ACCESSORIES`（7 hair / 9 top / 7 bottom / 7 shoes 名称表，给换装 UI 用）、
`DEFAULT_OUTFIT`、`ANIMATIONS`、`AVATAR_HEIGHT`。

### 2.2 `createNPC({ assets, materials, type }) → npc`

```js
const npc = createNPC({ assets, materials, type: 'young-lady' });
scene.add(npc.root);
await npc.ready;
npc.setLookAt(playerWorldPosition);
npc.update(dt);
npc.setTalking(true);            // 对话开始：切 talk clip + uIsTalking=1
```

| 字段 / 方法 | 说明 |
| --- | --- |
| `root` | `THREE.Group`，世界负责摆位/朝向（通常摆到球面切空间：+Y = 法线） |
| `pivot` | 内部 yaw 节点：NPC 朝向目标只转这个节点，不破坏 `root` 的球面朝向 |
| `ready` / `height` | 加载 Promise / 实测身高（和原站一致，1.0~2.0 不等） |
| `play(name, fade=0.25)` | `'idle'\|'talk'\|'idleTalk'\|'walk'`，没有的槽位回退到 idle（见下表） |
| `update(dt)` | **每帧调用一次**；推进动画 + 朝向阻尼（≈7.5/s 指数趋近） |
| `setTalking(bool)` | 设置材质 `uIsTalking`；true 时播放 talk（无 talk clip 的 NPC 保持 idle 动画，嘴巴仍由材质动） |
| `setLookAt(vec3 \| null)` | 世界坐标目标点；内部换算到 root 局部空间算 yaw（球面上任意位置都正确）。`null` = 回到 root 默认朝向 |
| `setVisible(bool)` / `dispose()` | 同上 |
| `type` / `npcType` / `pose` / `talking` / `yaw` / `targetYaw` | 状态 |
| `availablePoses` / `clips` | 可用槽位 / 槽位→clip 文件名 |
| `skeleton` / `mesh` / `material` / `mixer` | 底层对象 |

`type` 支持（19 种 + 别名）：

```
alien boss caveman chef diver factory-worker-a factory-worker-b factory-worker-c
female-scientist fox male-scientist mountainman musician office-worker oldwoman
owl scout threekid young-lady
```

别名：`kids → threekid`、`mountains/mountain → mountainman`、`flower-lady → young-lady`。
世界侧要用的 9 种 `chef / oldwoman / musician / office-worker / young-lady / scout /
mountainman / diver / fox` 全部验证可加载（见 `08-npcs-world.png`）。

动画槽位表取自原站 `createNPCS()` 配置（没有 talk/idleTalk/walk 的 NPC 复用 idle，
`factory-worker-b` 没有 idle 时 idle 槽用 walk），速度也按原站：
boss/threekid 0.9×、young-lady idle 0.75× / talk 1.1×。

---

## 3. 与渲染层（Lead 的 materials/pipeline）的接线

- `materials.character()` / `materials.npc()` 每次调用返回**新的 ShaderMaterial**，
  actor 层直接使用返回实例（NPC 各自独立，`uNPCSeed` / `uIsTalking` per-instance）。
  创建 actor 前请先 `await materials.ready()`（调色板/噪声贴图就绪），否则材质构造时
  `tColors` 等共享贴图还是 null。
- 材质时间 uniform（`time`）由 `materials.update(time)` 统一更新，actor 不写 `time`。
- actor 只负责：几何、骨骼、动画、`uIsTalking`（NPC）。眼睛/眨眼/口型/描边全部在材质。
- 如果 `materials` 缺失或没有对应工厂，`material-utils.js` 会退回
  `MeshToonMaterial` + 调色板 atlas 贴图（颜色正确，但没有眼睛/嘴巴 sprite），
  用于 tools/测试环境。
- **注意（给 Lead）**：`materials` 的 shader `defines` 里不要再写 `USE_SKINNING`
  （three 对 SkinnedMesh 自动添加，重复会报 `macro redefined` 编译失败）。
  当前 `material-utils.js: normalizeActorMaterial()` 会删掉这个重复 define 作为兜底，
  渲染层修掉后这段是 no-op，可以保留。
- **已知问题（Lead 的 pipeline，不在 actor 范围）**：在 MRT pipeline 下，
  使用 three 内置材质（`MeshBasicMaterial` / `MeshLambertMaterial` / `MeshToonMaterial`）
  的物体不会出现在最终画面里（只渲染自定义 shader 材质）。
  actor 的测试页因此把地面/标记点改用 DOM/自定义材质规避。
  复现：`tools/character/test.html?mode=npcs&render=pipeline` 里加一个内置材质球不可见。
  现在 test.html 已不再依赖内置材质。

---

## 4. 验证与截图

### 4.1 工具

```bash
# 1) 起共享 dev server（端口 5190）
cd apps/beijing-courier && npm run dev
# 2) 截图（tools/character/test.html 的自动化版本，可以单独运行）
node tools/character/shots.mjs
# 可选：指定别的 server
node tools/character/shots.mjs http://127.0.0.1:5190
```

脚本会把截图写到 `screenshots/character/`，并把渲染模式/尺寸/骨架统计写到
`screenshots/character/report.json`。测试页会自动优先用真实 pipeline+材质渲染，
pipeline 不可用时退回 basic 渲染并在 report 里注明。

手动调试：直接打开
`http://127.0.0.1:5190/tools/character/test.html?mode=single&pose=run&view=side&time=0.28`
（参数见 `tools/character/test.js` 顶部注释；`window.__app` 暴露了所有 actor 与调试方法）。

### 4.2 截图（`screenshots/character/`）

| 文件 | 内容 |
| --- | --- |
| `01-lineup.png` | 4 姿态（idle / run / air / sprint）+ 4 套换装并排，真实 pipeline + shader |
| `02-pose-idle.png` / `06-pose-back.png` | idle 正面 / 背面 |
| `03-pose-run.png` / `04-pose-sprint.png` / `05-pose-air.png` | run / sprint / air 侧面姿态（含腿部蒙皮） |
| `07-head-detail.png` | 头部特写：眼睛/眉毛/嘴（tEye shader 渲染）、发际、兜帽绳 |
| `08-npcs-world.png` | 世界用到的 9 种 NPC 全部加载 |
| `09-npc-talking.png` | young-lady 说话 + 朝向 look target（DOM 红点） |
| `10-catalog-accessories.png` | 全部 30 个可选部件（7 hair / 9 top / 7 bottom / 7 shoes）contact sheet |
| `11-compare-reference.png` | 左：原站 12-game.png 裁切；右：本复刻 pipeline 渲染，角色外观对照 |

（`10/11` 是 2D canvas 合成图，直接截 `#grid-canvas`。）

### 4.3 其他验证结论

- **骨架**：avatar 22 骨、1 root、parent 全部合法（无环/无越界）；19 种 NPC 同样验证。
- **动画**：7 个 avatar clip 帧数 = points/22，全部整除；44 tracks/clip；loop 接缝已验证
  （见 1.2 表格）；交叉淡入实测在 0.2s 淡入中点两条 action 权重各 0.5。
- **换装**：30 个部件的权重和/骨骼索引全部检查；合并后 1 个 SkinnedMesh。
- **性能**：默认套装 2836 顶点 / 5085 三角形 / 1 draw call；4 个角色同屏 draw call = 6
  （= 4 角色 + 地面 + 圆环，basic 渲染器实测）。几何缓存命中后二次 `await ready` 约
  4 ms、NPC 约 9 ms。
- **肤色/配色**：网格 UV 直接采样原站 16×16 调色板图集，颜色与参考截图一致
  （见 `11-compare-reference.png`，差异主要来自渲染层 LUT/光照）。

---

## 5. 已知限制 / 后续可做

- **曲线行走未实现**：原站 `office-worker(alt)`、`factory-worker-b` 沿
  `curve-1.drc`/`tall-man-curve.drc` 曲线行走；`npc.play('walk')` 现在原地播放 walk 循环。
  若世界需要"走路 NPC"，可再补一个 `setPath(curvePoints)`；曲线 .drc 的解析格式尚未确认。
- **afk 动画**：`afk1..3` 已加载并可 `play()`，但"空闲 30s 后轮播"的状态机留给 controller。
- **眨眼**：由材质 shader 自动完成（原站行为，玩家 `vBatchID=0`）；actor 不驱动。
- **MRT 下内置材质不可见**：见第 3 节，属于渲染层问题，已在测试页规避。
- **SkinnedMesh `frustumCulled = false`**：蒙皮变形后静态包围盒不可靠，角色数量少，直接关掉
  视锥剔除；如果同屏角色非常多，可在 controller 里自行做距离剔除再 `setVisible`。
- **`dispose()` 会 dispose 传入的材质**：目前只有一个本地玩家/NPC 各自持有独立材质实例，安全；
  若将来多个 NPC 共享一个材质实例，需要去掉这行。
