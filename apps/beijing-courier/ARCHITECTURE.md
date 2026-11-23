# 京城来信 v3 · 自建北京资产 + 参考站渲染语言 — 架构说明

> v2 目标：把 `apps/beijing-courier` 复刻成接近 <https://messenger.abeto.co> 的小行星递送游戏。
> v3 起：保留参考站的**渲染语言**（卡通描边 + LUT + 手绘小行星基底），
> 把「北京元素」和大部分可见内容改成**原创自建**：
> 原创北京邮差主角、原创北京 NPC、程序化北京街区（胡同/中轴/CBD/城墙）、
> 自建投递道具、原创程序化音频、原创 UI/剧情。
> 素材来源与版权清单见 `ASSETS.md`；北京资产定价见 `src/world/README-beijing.md`。

## 参考资料

- 参考截图：`docs/messenger-reference/`（intro、游戏内、UI、角色、天空等）
- 原站完整 JS bundle（含全部自定义 shader 与游戏代码）：
  `/tmp/messenger-probe/app3d-full.js`（可用 grep 查找 `function xxxMaterial`、`class sky` 等）
- 已抽取的 shader 片段：`/tmp/messenger-shaders/`（base-vertex.js / base-fragment.js / *.glsl）
- 原始资产清单：`/tmp/messenger-probe/asset-manifest.json`
- 资产目录：`public/assets-messenger/`（geometries / images / fonts / audio / libs，来自原站）
  服务方式：Vite 静态目录，URL 前缀 `./assets-messenger/`。

## 资产要点

- 星球：`geometries/planets/present/full_0..9.drc`（游戏用），半径约 36 单位；`intro/planet.drc + water.drc + trees.drc + clouds.drc` 是开场小星球。
- 碰撞：`geometries/planets/present/hitmesh_0..4.drc`，用于地面高度/碰撞（比渲染网格低模）。
- 角色：`geometries/avatar/{avatar-bones,avatar-idle,avatar-run,avatar-sprint,avatar-air,avatar-afk1..3}.drc`
  + `avatar/accessories/{base,hair1..7,top1..9,bottom1..7,shoes1..7}.drc`。角色高约 1.64。
- NPC：`geometries/npcs/present/<name>/{<name>,<name>-bones,<name>-idle,...}.drc`，已有 skinIndex/skinWeight。
- 可交互物：v3 起改为**自建** `src/world/items.js`（信/明信片/便签/点心匣/黑胶），不再加载参考站 deliveries。
- 原创主角：`src/actor/originalCourier.js`（几何 + 程序化动画）；参考站 avatar 仅作加载失败回退。
- 原创 NPC：`src/actor/originalNpc.js`（大爷/大妈/小学生）用于胡同里的 ambient NPC。
- 北京街区：`src/world/beijing.js`，由 `buildBeijing({scene, collision, spots, group})` 生成，
  返回 `{ group, update, spawn, npcSpots, landmarks, districts, wallColliders?, ... }`。
- 贴图：`images/*.ktx2`；`atlas.png`(16x16 调色板)；`lut.ktx2`(32³ 3D LUT)。
- 音频：**已全部改为原创程序化合成**（`src/game/audio.js` + `music.js`，五声音阶 BGM / 区域环境音 / 音效），不再使用参考站 ogg。
- 几何属性（Draco metadata 里的 `info` 已由 `src/assets.js` 的 worker 自动命名）：
  - 星球块：position / normal / uv / surfaceId(int32) / batchId(int32) / elementId(int32)
  - 角色/NPC：skinIndex(uint16x4) / skinWeight(float32x4) / position / normal / uv / surfaceId(float)
  - 骨骼：point cloud，每点 position(3) + quaternion(4) + scale(3) + hierarchy(1)
  - 动画：point cloud，点数 = 帧数 × 骨骼数，按帧优先（frame-major），30fps 播放
- 单位与坐标：Y 轴向上；角色站在 y=0；星球是完整球面，世界坐标即球面切空间坐标（原站就是这么渲染的）。

## 技术栈

- Vite 6 + three r170，纯前端。`npm run dev`（127.0.0.1:5190） / `npm run build` / `npm test`。
- 渲染：自建 MRT pipeline —— 场景渲染到 `WebGLRenderTarget(count:2, type:HalfFloat)`，
  target0=颜色(alpha 存 surfaceId)，target1=深度/法线/描边权重，然后全屏 outline+LUT pass 上屏。
- UI：DOM + CSS（手绘风字体），不走 3D。移动端触屏支持。
- 音频：WebAudio 全程序化合成（原创 BGM + 区域环境音 + cue），无任何外部音频文件/CDN。
- 着色：参考站 shader 移植（`render/materials.js`）+ 自建资产统一材质（`render/toon.js`），
  两者都向 MRT 写颜色/面 id/深度/法线/描边权重。
- 稳定性：1.4× 超采样（桌面）降低描边闪烁；静止时冻结碰撞采样；相机 up/避墙距离阻尼；
  动画状态滞后阈值。

## 目录与归属（写文件范围）

```
src/
  main.js                 Lead       启动、主循环、集成
  assets.js               Lead       资产加载（Draco worker / KTX2 / LUT / 音频）
  config.js               Lead       常量、配色
  render/pipeline.js      Lead       MRT + 描边 + LUT 合成
  render/materials.js     Lead       场景/角色/NPC/道具材质（移植原站 shader）
  render/sky.js           Lead       天空 & 云
  game/controller.js      Lead       球面角色控制 + 相机
  world/planet.js         world-dev  星球/植被/水体/天空/碰撞/锚点
  actor/avatar.js         char-dev   角色骨骼/动画/换装
  actor/npc.js            char-dev   NPC 骨骼/动画/朝向
  ui/dom.js               ui-dev     开场、对话、侧边按钮、checklist、触屏
  ui/style.css            ui-dev     全部 UI 样式
  game/story.js           ui-dev     中文剧情 / 任务数据
  game/dialogue.js        ui-dev     对话状态机（打字机、翻页、NPC 说话动效）
  game/audio.js           ui-dev     音频管理
index.html                Lead       只由 Lead 修改
public/fonts/             ui-dev     下载的手写体 woff2
```

**只改自己归属的文件。** 需要别人接口变更时先发消息。

## 模块接口（约定后保持稳定）

### `createAssets(renderer)` → assets
- `assets.loadGeometry(path)` → `Promise<THREE.BufferGeometry>` 路径相对 `assets-messenger/`，如
  `'geometries/planets/present/full_0.drc'`；包含全部自定义属性。
- `assets.loadTexture(path, mode)`：mode ∈ `srgb-nearest|repeat|srgb-repeat|linearfilter|linearfilter-repeat`。
- `assets.loadLUT()` → `Promise<THREE.Data3DTexture|null>`。
- 音频不再走 `assets.loadAudio`（保留接口但已无引用）。

### `createPipeline(renderer)` → pipeline
- `pipeline.setSize(w,h)`
- `pipeline.render(scene, camera)` 自动做 MRT + 描边 + LUT 上屏。

### `createMaterials({ assets, pipeline })` → materials（Lead 提供）
- `materials.planet` 星球/建筑主材（IS_TERRAIN）
- `materials.character` 玩家（IS_CHARACTER + skinning）
- `materials.npc` NPC（IS_NPC + skinning）
- `materials.give` 道具（IS_GIVE）
- `materials.water` / `materials.leaves` / `materials.cloud` / `materials.sky` …（逐步补齐）
- 共用 uniforms 由 materials 内部统一 update：`materials.update(time, camera, sun)`（每帧调用一次）

### `buildWorld({ assets, materials, scene })` → world（world-dev）
```
{
  group,                          // 加入 scene 的根节点
  sky,                            // 天空 mesh（含背景）
  update(time, dt),               // 水体/云/植被动效
  groundAt(normal) → { height, normal },   // 给定球面方向，返回半径/高度（用于角色贴地）
  raycast(origin, dir) → hit|null,
  anchors: {
    spawn: { normal: Vector3, heading: Vector3 },   // 出生点（参考截图：海边码头）
    npcSpots: [{ id, normal, heading }],            // NPC 站位（5 个以上）
    pickupSpots: [{ normal }],                      // 交付物拾取点
    regions: [...]                                  // 区域名（用于环境音/BGM）
  }
}
```
世界根节点要在 `scene` 里直接可见；天空 sphere 半径 >= 200。

### `createAvatar({ assets, materials })` → avatar（char-dev）
```
{
  root,               // THREE.Group，位置/朝向由 controller 设置（root.position = normal * radius）
  update(dt),         // 动画混合、眨眼
  play(name),         // 'idle'|'run'|'sprint'|'air'
  setOutfit({hair,top,bottom,shoes}),  // 'hair3' 等
  setTalking(bool),   // 对话时口型
  setVisible(bool),
  height: 1.64,
  ready,
  outfit                    // 当前 outfit
}
```
朝向约定：`root` 的 +Z 朝向角色面朝方向，角色站立在 root 原点（脚在 y=0）。

### `createNPC({ assets, materials, type })` → npc（char-dev）
```
{ root, update(dt), setTalking(bool), setLookAt(vec3|null), play(name), ready }
```
`type` ∈ `chef | oldwoman | musician | office-worker | young-lady | scout | mountains | kids | fox | owl | alien | ...`
（见 `assets-messenger/geometries/npcs/present/` 目录）

### `createUI({...})` → ui（ui-dev）
详见 ui-dev 自己写 `src/ui/README.md`。主入口至少要提供：
```
{
  showIntro(), hideIntro(), showLoading(), hideLoading(),
  showDialogue({name, lines, onDone}), hideDialogue(), advanceDialogue(),
  setObjective(text), setChecklist(items), openChecklist(), closeChecklist(),
  showInteract(label, cb), hideInteract(),
  setSound(muted), toast(text),
  setOutfit(outfits, current, onPick),
  bindInput({ onMove, onLook, onJump, onInteract }),  // 触屏/键盘统一
  update(dt),
}
```

## 测试与截图

- Playwright 在 `/Users/one/AI/demo/node_modules/playwright`（用 `import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs'`）。
- 截图保存到各自 `screenshots/` 或 `/tmp/`，必要时在任务里回复截图路径。
- 视觉对照：`docs/messenger-reference/`。重点看：手绘描边、调色、角色比例、UI 手写体。
- 注意 macOS 上 Playwright 需要 `--use-gl=angle --enable-unsafe-swiftshader` 才能稳定跑 WebGL。

## 已复刻的原站系统（Lead 负责）

- `baseMaterial`（原站核心材质，含 IS_TERRAIN / IS_CHARACTER / IS_NPC / IS_GIVE 分支、法线描边贡献、表情贴图）
- 后期 `outlines`：双 RT、法线/面 id/深度三因子描边 + 3D LUT 调色
- `sky`（球体 sky shader + 云噪声 + 视差）
- 环境音/风声/脚步等音频复用
