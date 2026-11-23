# 原创北京资产 —— 自建邮差主角 + 北京 NPC

> 用户反馈：「很多资产都是照搬参考站的，能不能有点自己的资产；模型可以自己建。」
> 这里就是答案：**主角和 3 个 NPC 全部由 Three.js 基本几何现场拼出来**，
> 没有加载任何参考站的 `.drc` 模型，也没有外部动画文件；材质统一走
> `src/render/toon.js`，和场景共用同一条 MRT 描边 + LUT 调色管线。

| 文件 | 内容 |
| --- | --- |
| `src/actor/originalCourier.js` | 原创北京邮差主角 + 共享建模工具（`originalActorKit`） |
| `src/actor/originalNpc.js` | 3 个原创北京 NPC：遛鸟大爷 / 广场舞大妈 / 红领巾小学生 |
| `tools/hero/test.html` + `test.js` | 验收台（单姿态/四姿态/换装/NPC/同框对比/自建胡同场景） |
| `tools/hero/shots.mjs` | Playwright 截图脚本（含真实游戏页注入验证） |
| `screenshots/hero/01..17-*.png` | 验收截图（含 `report.json`） |

主角造型记忆点：**墨绿邮差制服（铜扣/肩章/口袋/铜制邮徽）+ 平顶邮差帽（红五星铜章）+
斜挎帆布邮包（「邮」字印戳 + 露出的信）+ 砖红围巾（会飘）+ 白袜黑布鞋 + 手不离信**；
Q 版比例（约 4.3 头身），`height = 1.64`，和参考站 avatar 同高。

---

## 1. 坐标与接口约定（与 `avatar.js` 完全一致）

- `root` 是 `THREE.Group`，由游戏控制器摆放（球面位置 + 切空间朝向）；
- 角色**脚底 y = 0**，**面朝 local +Z**；
- 内部 `root → rig → bones → meshes`，`rig` 不参与位移；
- 构建完成后自动把脚底对齐到 y=0，并等比缩放到 `height = 1.64`（raw 高度约 1.72）。

### 主角 API

```js
export function createOriginalCourier({ materials, outfit } = {}) → {
  type: 'original-courier',
  root,                // THREE.Group，交给 controller 摆位
  rig,                 // 内部骨架根
  ready,               // Promise（构建是同步的，resolve(this)，和 avatar.ready 用法一致）
  height,              // 1.64
  clips,               // ['idle','run','sprint','air','talk']
  play(name, fade=0.2),// 交叉淡入到动作；未知名字 console.warn + false
  update(dt),          // 每帧调用；内部 clamp dt ≤ 0.1
  setTalking(bool),    // 说话叠加层：口型 + 点头（不切换 locomotion）
  setOutfit(partial),  // { hat, bag, scarf } 颜色变体；返回完整 outfit
  setVisible(bool),
  getBone(name),       // 13 骨之一或挂点
  get outfit(), get pose(), get bones(), get meshes(), get materials(),
  setActionTime(name, seconds), // 调试：直接设某动作的本地时间（截图用）
  dispose(),           // 移除 root、释放几何/材质/贴图
}
```

`materials` 参数保留是为了和 `createAvatar({ materials })` 的调用签名对齐，**会被忽略**：
原创角色的外观来自自己的调色板 + `toon.js` 材质，不需要参考站的调色板贴图。

### NPC API（与 `npc.js` 一致）

```js
export function createOriginalNPC({ type, materials } = {}) → {
  type: 'original-npc',
  npcType,             // 'beijing-daye' | 'beijing-dama' | 'xiaoxuesheng'
  label,               // 中文名（大爷/大妈/小学生）
  root, pivot, rig,
  ready, height,
  clips,               // ['idle','talk']
  play(name, fade=0.25),  // 'idle' | 'talk'；'idleTalk'→talk，'walk'→idle（兼容旧槽位）
  update(dt),
  setTalking(bool),    // 内部切到 talk / idle
  setLookAt(vec3|null),// root 朝向由世界定，pivot 负责朝目标 yaw 插值（TURN_SPEED=6.5）
  setVisible(bool),
  getBone(name), dispose(),
}
```

未知 `type` **会 throw**（避免把 fox/owl 之类动物错换成人类）；参考站 kind →
原创类型的映射用导出表：

```js
import { resolveOriginalNpcType, ORIGINAL_NPC_KIND_MAP } from './actor/originalNpc.js';
resolveOriginalNpcType('oldwoman');   // → 'beijing-dama'
resolveOriginalNpcType('scout');      // → 'xiaoxuesheng'
resolveOriginalNpcType('fox');        // → null（继续用参考站模型）
```

---

## 2. 建模尺寸

### 主角（13 骨，单位：米，静止姿态 local 坐标）

| 骨骼 | 父骨 | 局部位置 | 备注 |
| --- | --- | --- | --- |
| `hips` | root | (0, **0.78**, 0) | 髋；邮包/短裤挂在它下面 |
| `spine` | hips | (0, 0.09, 0) | 脊柱（下段制服） |
| `chest` | spine | (0, 0.19, 0) | 胸（上段制服/肩章/领子/背带） |
| `neck` | chest | (0, 0.155, 0) | 围巾 + 脖子 |
| `head` | neck | (0, 0.06, 0) | 头中心再 +0.17；帽顶总高 ≈ head+0.39 |
| `armL/R` | chest | (±0.172, 0.12, 0)，rest 旋转 z=±0.13 | 肩 |
| `foreArmL/R` | arm | (0, -0.235, 0) | 肘；袖子/袖口/手 |
| `thighL/R` | hips | (±0.09, -0.045, 0) | 短裤 + 大腿 |
| `shinL/R` | thigh | (0, -0.315, 0) | 小腿 + 白袜 |

挂点（不是骨骼，方便加道具）：`handL/handR = foreArm` 下端 (0,-0.205,0)；
`footL/footR = shin` 下端 (0,-0.3,0)，鞋网格挂在这里。`getBone('handL')` 可取。

主要外形尺寸：

- 头：球体 r=0.18（x 1.0 / y 1.02 / z 0.965），头顶 y≈1.64；
- 帽：帽箍 r≈0.188、帽墙 r 0.186→0.168 高 0.082、圆顶压扁球、帽檐半径 0.205 前伸半圆盘；
- 躯干：腰宽 0.34 → 肩宽 0.40，深度 0.23；
- 腿：大腿长 0.315、小腿长 0.315；白袜 0.115、鞋高 ≈0.12；
- 邮包：0.22 × 0.20 × 0.10，位于左胯（+X 侧）略靠后，背带从右肩斜跨前后胸。

### NPC

| 类型 | 高度 | 特征 |
| --- | --- | --- |
| `beijing-daye` 遛鸟大爷 | **1.59** | 微驼背、灰蓝短袖衬衫 + 白背心 V 领、深蓝长裤、蓝灰鸭舌帽、圆框花镜、白八字胡/山羊胡；右手提竹制鸟笼（8 根笼条 + 圆顶 + 站杆 + 黄鸟 + 红穗），左手自然下垂 |
| `beijing-dama` 广场舞大妈 | **1.47** | 碎花布上衣（canvas 程序贴图）、深色长裤、花头巾（球体后移，只盖头顶/后脑 + 脑后打结）、珍珠耳环；右手叉腰，左手举大红折扇（扇面 + 金扇骨），idle 带广场舞摆胯/扇子摆动 |
| `xiaoxuesheng` 红领巾小学生 | **1.23** | 白衬衫 + 大三角红领巾 + 蓝短裤 + 白袜黑鞋 + 黄小帽 + 双肩书包（背带在前胸、包在背后），idle 有蹦跳感 |

NPC 骨架与主角同构（13 骨 + hand/foot 挂点），照抄了 `buildHumanRig(cfg)` 的比例参数。

---

## 3. 动画（完全自写，无 AnimationMixer / 无动画文件）

`createPoseAnimator({ bones, rest, actions, defaultAction, fade })`：

- 每个 action = `{ loop: 秒, pose(timeSeconds, pose) }`；
- `pose.rot[bone] = [rx, ry, rz]` 是**相对静止姿态的 euler 偏移**，`pose.hipsY` 是髋部垂直位移；
- 每个 action 有独立本地时间，权重线性交叉淡入淡出，最后**归一化混合**（支持新旧动作重叠）；
- 混合结果写回骨骼：`bone.rotation = rest.rot + blended`，`hips.position.y = rest.y + blended.hipsY`。

主角动作参数（`COURIER_ACTIONS`）：

| 动作 | 循环 | 关键参数 |
| --- | --- | --- |
| `idle` | 3.2s | 呼吸 ±0.012 rad、`hipsY ±0.006`、头缓慢左右看 0.05 rad、手臂 0.03 rad 摆动 |
| `run` | 0.76s | 大腿 ±0.78 rad、膝盖 0.12→1.07 rad、手臂 ±0.60 rad、前倾 0.17 rad、`hipsY` 双频 ±0.022、髋/胸反向扭 0.10/0.11 rad |
| `sprint` | 0.62s | 大腿 ±1.0、手臂 ±0.82、前倾 0.27、肘更弯、`hipsY` ±0.03 |
| `air` | 1.3s | 一腿收一腿蹬（-0.95 / +0.38 + 膝 1.15 / 0.62）、双臂张开抬起（x≈-1.1, z=±0.5）、围巾上扬、`hipsY +0.035` |
| `talk` | 5.0s | idle 底子 + 头 0.07 rad 点头 + 右臂小幅度手势 + `mouth` 0..1 |

附加细节（`update()` 里，不属于骨骼混合）：

- **眨眼**：2.2–4.6s 随机，0.16s 闭眼，眼白高光同步隐藏；
- **说话叠加**：`setTalking(true)` 时嘴部 mesh `scale.y` 0.35..1.9 开合、下巴轻微点头（locomotion 不切换）；
- **围巾**：两条尾巴随速度/跳跃飘动，idle 时轻摆；
- **邮包**：随步伐弹跳 + 起跳上扬，挂点在 `hips`；
- **帽子/配件**：都挂在 `head`，随机头动画一起动。

NPC 动作：`idle`（大爷 4.6s / 大妈 3.6s / 小学生 2.6s）+ `talk`（点头/手势，4.6 / 4.0 / 3.2s）；
额外动画在 `built.extras(t, weights)` 里：大爷鸟笼摆动 + 小鸟蹦跳、大妈扇子摇、小学生书包弹跳。

切换方式：主程序继续调用 `avatar.play('idle'|'run'|'sprint'|'air')` 即可（默认 fade 0.2s）。

---

## 4. 材质 / 渲染

所有网格都使用 `src/render/toon.js` 的 `createToonMaterial`：

- 它是 `ShaderMaterial`，向 MRT 两个 attachment 写数据 → 自动获得**全局描边 + LUT**；
- 每个材质有独立的 `surfaceId`（0.22–0.56 区间按部件分配），相邻不同色块交界会由 face-id 差异生成内部描边，和场景手绘线条一致；
- 分层配色：`lit = 固有色`，`shadow = HSV(h-0.015, s, v*0.52)`，柔和硬切 + `uAmbient*0.16`；
- 主角/NPC 的网格 `castShadow = receiveShadow = true`，用场景同一个 DirectionalLight 阴影。

> ⚠️ `toon.js` 当前和 three r170 有一个兼容问题：它的 VERTEX 里显式声明的
> `varying vec3 vNormal;` 与 `#include <normal_pars_vertex>` 重复声明，导致
> `ERROR: 'vNormal' : redefinition`、材质 program 无效（黑屏）。
> 本模块用 `createToonMaterialSafe()` 在拿到材质后把**那一行重复声明**去掉
> （保留 chunk 的声明 + toon.js 自己的 `vNormal = transformedNormal;`），语义不变。
> Lead 修好 `toon.js` 之后这个 patch 会自动变成 no-op（`includes` 判断）。
> **建议 Lead 直接删掉 toon.js VERTEX 里的那一行**，否则 world-dev 等其它直接
> 用 `createToonMaterial` 的资产也会黑屏。

另：不要用 `MeshToonMaterial`/`MeshLambertMaterial` 替代 toon 材质 —— 它们不写 MRT
信息，在 pipeline 里会没有描边、也不参与 LUT。

调色板（`COURIER_PALETTE`，全部低饱和，和场景手绘色板同一档）：

| key | 值 | 用途 |
| --- | --- | --- |
| `jacket` / `jacketDark` / `jacketLight` | `#3f6f52` / `#2e5440` / `#4d8161` | 制服、滚边、口袋 |
| `pants` | `#33483e` | 短裤 |
| `scarf` / `scarfDark` | `#b8503f` / `#94402f` | 围巾/围巾结 |
| `bag` / `bagFlap` / `strap` | `#9c6b45` / `#7d5235` / `#5f4430` | 帆布邮包 / 翻盖 / 背带 |
| `brass` / `brassDark` | `#d9a63f` / `#8a6423` | 铜扣、邮徽 |
| `skin` / `skinShade` / `blush` | `#e9bd94` / `#ddae86` / `#e7b096` | 皮肤/阴影/腮红 |
| `hair` / `hairDark` | `#4a3a2e` / `#382c24` | 头发/眉毛 |
| `sock` / `shoe` / `shoeSole` | `#efe6d6` / `#2b2b30` / `#1a1b1e` | 白袜 / 黑布鞋 / 鞋底 |
| `envelope` / `stamp` | `#f4efe2` / `#b8503f` | 信 / 邮票 |
| 帽子默认 | `#38654c` | 可换 `navy #2c3b52` / `red #a8443e` / `brown #6d5136` |

程序化贴图（`makeCanvasTexture`，无外部图片）：
- 帽徽：黄铜圆 + 红五星 + 小信封（`createBadgeTexture`）；
- 邮包印戳：白「邮」字 + 信封轮廓 + 红胶带（`createPostStampTexture`）；
- 大妈碎花上衣 / 花头巾：canvas 圆点花纹。

---

## 5. 换装（setOutfit）

只支持 3 个颜色槽（对应需求里的「邮包/帽子颜色变体」）：

```js
const COURIER_OUTFITS = {
  hat:   { 'postal-green': '#38654c', navy: '#2c3b52', red: '#a8443e', brown: '#6d5136' },
  bag:   { 'canvas-brown': '#9c6b45', 'postal-green': '#3e6b52', navy: '#33445c', red: '#94443b' },
  scarf: { scarlet: '#b8503f', mustard: '#c9a24a', cream: '#e8ddc8', teal: '#3f7f78' },
};
const DEFAULTS = { hat: 'postal-green', bag: 'canvas-brown', scarf: 'scarlet' };

avatar.setOutfit({ hat: 'navy', bag: 'red', scarf: 'mustard' }); // 返回完整 outfit
avatar.setOutfit({ hat: 'nope' });  // 未知变体 → warn 并保持原值（不会崩）
```

实现：换装槽位的部件在合批时使用独立材质 key（`hat:navy`、`bag:red`、`scarf:mustard`），
`setOutfit` 只做 `mesh.material = store.get(key)`，零重建几何。

> 注意：现有 `main.js` 的衣柜 UI 仍然是参考站的 `{hair, top, bottom, shoes}` 分类。
> 传给 `createOriginalCourier({ outfit })` / `setOutfit()` 时**未知 key 会被安全忽略**，
> 所以不会崩，但也不会变装。Lead 集成时建议二选一：
> 1) 把衣柜 UI 改成 hat/bag/scarf 三个颜色槽（推荐，`src/ui/dom.js` 的 setOutfit 数据结构）；
> 2) 或者只在回退使用参考站 avatar 时显示旧衣柜。

---

## 6. 集成方式（Lead 已在 `src/main.js` 接入）

> 当前状态：Lead 已接入 —— `main.js` 优先 `createOriginalCourier({ outfit })`，失败回退
> `createAvatar`；衣柜 UI 已改成 hat/bag/scarf 三个颜色槽；`spawnAmbientNpcs()` 在自建
> 北京街区里用 `createOriginalNPC` 生成了大爷/大妈/小学生。下面的代码保留作为参考。

建议接入方式：

```js
import { createOriginalCourier } from './actor/originalCourier.js';
import { createOriginalNPC, resolveOriginalNpcType } from './actor/originalNpc.js';

// --- 主角（优先原创，失败回退参考站 avatar）
try {
  avatar = createOriginalCourier({ outfit: state.outfit });
} catch (err) {
  console.warn('[avatar] original courier failed, falling back to reference avatar', err);
  avatar = createAvatar({ assets, materials, outfit: state.outfit });
}
await avatar.ready;

// --- NPC（只替换适合的 kind；fox/owl 等继续用参考站模型）
async function spawnOneNPC(anchor) {
  const originalType = resolveOriginalNpcType(anchor.kind);
  let npc;
  try {
    npc = originalType
      ? createOriginalNPC({ type: originalType })
      : createNPC({ assets, materials, type: anchor.kind });
  } catch (err) {
    console.warn('[npc] original failed, fallback', anchor.kind, err);
    npc = createNPC({ assets, materials, type: anchor.kind });
  }
  await npc.ready;
  placeActor(npc.root, anchor.point, anchor.normal, anchor.facing);
  gameScene.add(npc.root);
  return npc;
}
```

其余调用完全不用改：`avatar.root`、`avatar.ready`、`avatar.play('idle'|'run'|'sprint'|'air')`、
`avatar.update(dt)`、`avatar.setTalking()`、`avatar.setOutfit()`、`npc.setLookAt()`、`npc.setTalking()`、
`npc.update(dt)`、`npc.root` 全部同签名同语义。

现有 world 的 NPC kind → 原创类型建议（`ORIGINAL_NPC_KIND_MAP` 已包含）：
`office-worker/chef/mountainman/diver → beijing-daye`，`oldwoman/young-lady/musician → beijing-dama`，
`scout → xiaoxuesheng`，`fox/owl/… → null`（保留参考站模型）。

---

## 7. 性能

- 主角：13 骨、**56 个 mesh、29 个材质**（默认 outfit）；NPC：38–40 mesh。
  这不是最优，但单角色 draw call 可接受；角色都是低多边形（全部几何合计约 3–4k 三角形）。
- 合批策略：按 `(骨骼, 材质)` 合并，`merge()` 后一个骨头上的同色部件只有 1 个 draw call；
  脸/口/眼/围巾/鸟笼等需要单独动画的部件单独 mesh。
- 如果同屏多个原创 NPC 顶不住，可以：复用材质（把 `createMaterialStore` 换成全局共享）、
  进一步合并（把不动的材质合到同一 key）。共享材质后 `dispose()` 需要改成引用计数。
- 全部网格 castShadow；阴影开销和参考站角色同量级（游戏 sun shadow 已是 2048 map）。

---

## 8. 验收 / 截图

```bash
# 前提：共享 dev server 已在 apps/beijing-courier 运行（127.0.0.1:5190）
cd apps/beijing-courier
node tools/hero/shots.mjs          # 生成 screenshots/hero/*.png + report.json（约 4~6 分钟）
```

`shots.mjs` 对真实游戏页的注入是**自适配**的：`main.js` 已接入原创主角时
（`window.__courier.avatar.type === 'original-courier'`）直接拍游戏主角；
未接入时动态 import 注入（不改 main.js），两种模式脚本都可用。

截图一览（`screenshots/hero/`，全部走真实 MRT pipeline）：

| 文件 | 内容 |
| --- | --- |
| `01-hero-front.png` / `02-hero-back.png` | 主角正/背面（背包带、邮包、围巾后摆） |
| `03-hero-run.png` / `04-hero-sprint.png` / `05-hero-air.png` | run 侧面 / sprint 3/4 / 跳跃 |
| `06-hero-head.png` | 头部特写（帽徽、领子、五官、刘海） |
| `07-hero-poses.png` | idle/run/air/sprint 四姿态 |
| `08-hero-outfits.png` | setOutfit 三套颜色变体 |
| `09-npcs.png` | 3 个原创北京 NPC 并排 |
| `10-npc-daye.png` / `11-npc-dama.png` / `12-npc-kid.png` | NPC 单体（大爷 talking） |
| `13-compare-avatar.png` | 原创主角 vs 参考站 avatar 同框（只用于对比比例/画风） |
| `14-hutong-scene.png` | 自建 toon 胡同场景（灰砖墙/树/红灯笼/石墩）同框 |
| `15-game-duo.png` / `16-game-hero.png` / `17-game-back.png` | **真实游戏页** 5190 中注入原创主角 + 大爷，验证与场景/UI/光影一致 |
| `18-game-run.png` / `19-game-jump.png` | **真实操作验证**：WASD 跑动 + 空格跳跃，主角被真实 controller 摆到球面、跟随相机、run/air 动画与 `grounded/speed` 联动 |

`report.json` 里有每次截图的 renderMode、mesh/材质/骨骼数量、真实场景注入信息。

---

## 9. 已知限制 / 后续可改

- 角色是 **刚体部件绑骨骼**（不是蒙皮），关节处靠几何重叠遮挡，低多边形风格下没有破绽；
  但没有弯折的软过渡，特写镜头下肩/膝是分段圆柱。
- `talk` 的动作是程序化点头 + 口型缩放，没有真正的口型音素。
- NPC `setLookAt` 只有 yaw 插值（和 `npc.js` 一致），没有眼睛跟随。
- 换装只有 3 个颜色槽，没有参考站的 7 头发/9 上衣/7 裤子/7 鞋的衣橱规模。
- 自行车/邮筒等可交互道具不在本任务范围（当前主角 + NPC）。

---

## 10. 共享建模工具（`originalActorKit`）

`originalCourier.js` 除了主角，还导出 `originalActorKit`（NPC 复用）：

```js
const {
  createToonMaterialSafe, taperBox, limb, blob, box, merge, makeCanvasTexture,
  createMaterialStore,   // 每实例材质仓库，dispose() 只销毁自己的
  createPartCollector,   // collector.add(bone, geo, key, matDef) 按 (骨,材质) 合批；addMesh() 单独 mesh
  buildBoneRig,          // [{ name, parent, position, rotation }] → { bones, rest }
  createPose, createPoseAnimator, BONE_NAMES,
} = originalActorKit;
```

新增部件的最短路径：

```js
const geo = taperBox(0.12, 0.12, 0.09, 0.09, 0.2, 0.004); // 上宽下宽+手绘 jitter
geo.translate(0, -0.1, 0);                                 // 先摆到骨头局部坐标
collector.add(bones.armL, geo, 'jacket', baseDefs.jacket); // 自动合批
// 需要贴图/单独动画的用 collector.addMesh(bones.head, geo, 'badge', defs.badge)
```

注意 `merge()` 只搬运 `position/normal/uv` 和 index，所以合并的几何必须带 uv（
`BoxGeometry`/`CylinderGeometry`/`SphereGeometry`/`TorusGeometry` 都有），
自定义 BufferGeometry 记得补 uv；所有部件在用 `translate/rotateX/scale` 摆好之后再 add。
