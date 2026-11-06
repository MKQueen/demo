# 雨夜便利店 · 微缩模型 — 团队协作 SPEC

> 目标：一个可用鼠标拖拽 / 滚轮缩放 / 自由旋转观看的 **日式便利店雨夜街角微缩模型**。
> 三渲二卡通渲染、清晰描边、暖色店内 vs 冷色雨夜、可收藏模型感、无任何 UI 覆层。
> 技术栈：Vite + Three.js（r170），全部程序化生成，不依赖外部图片/模型。

---

## 1. 运行与截图（所有成员统一）

开发服务器已经在跑（**不要自己起服务器、不要改 vite 配置**）：

```
http://127.0.0.1:5210/
```

工作目录：`/Users/one/AI/demo/apps/konbini-rain`

截图自检（会打印 console error / pageerror；截图要用 `read_image` 真的看）：

```bash
node tools/shot.mjs --url "http://127.0.0.1:5210/?view=inside&still=1" \
  --out screenshots/dev/interior-1.png --w 1400 --h 900 --wait 2600
```

可用视角：`?view=hero|front|corner|top|inside|alley|back|side`（定义在 `src/config.js` 的 `VIEWS`）。
`?still=1` 关闭自动缓慢旋转、`?freeze=1` 冻结动画时间（截图稳定用）。
每完成一轮就截图看效果，至少迭代 2–3 轮，别只写代码不看画面。

---

## 2. 文件所有权（严格不越界）

| 文件 | 负责人 |
| --- | --- |
| `src/config.js`, `src/main.js`, `src/lib/*`, `src/world/base.js`, `src/world/ground.js`, `src/world/store.js` | Lead（不要改） |
| `src/world/interior.js` | interior-artist |
| `src/world/street.js` | street-artist |
| `src/world/props.js` | props-artist |
| `src/world/fx.js` | fx-artist |

每个人只改自己的文件。需要共享 API 改动时给 lead 发消息，不要自己动共享文件。
`index.html` / `style.css` / `tools/` 也不要动。

---

## 3. 坐标系与尺寸（以 `src/config.js` 为准，先读它）

- 1 单位 = 1 米；+X 右、+Y 上、+Z 朝街道/观众。模型底座顶 11×11（x,z ∈ [-5.5, 5.5]）。
- 马路顶面 `y = 0`；`L.lot` 地块（人行道/店铺地坪）顶面 `y = 0.12`。
- 便利店外壳 `L.store`：x ∈ [-2.9, 1.7]，z ∈ [-4.6, 1.0]；墙面顶 y=3.52。
- 店内净空间 `L.store.interior`：x ∈ [-2.72, 1.52]，z ∈ [-4.42, 0.82]，
  地面 y=0.14、天花板 y=2.52。**绝大多数店内物件都要在里面，从正面玻璃/自动门能看清。**
- 正面玻璃窗 x ∈ [-2.72, 0.54]（y 0.45–2.5），自动门 x ∈ [0.62, 1.5]。
- 左侧小巷 `L.alley` x ∈ [-4.0, -2.9]；旧楼 `L.neighbor` x ∈ [-5.5, -4.0], z ∈ [-4.8, 1.0]。
- 便利店右侧外墙 x=1.7，外面是人行道 x ∈ [1.7, 3.2]；自动贩卖机贴墙、面朝 +X。
- 左侧旧楼/小巷、道路、电线杆、红绿灯、远侧人行道等位置见 config 中的 `L.poleMain`、
  `L.poleFront`、`L.poleBack`、`L.trafficLight`、`L.pylon`、`L.parking`、`L.farWalk` 等。

---

## 4. 美术风格约定（非常重要）

- **三渲二**：所有实体表面用 `toon()`（MeshToonMaterial + 分段明暗），不要用 Standard/Physical
  材质（除非特殊效果）。颜色偏低饱和、夜里偏冷，局部暖光靠灯光与自发光。
- **描边**：给组内主要实体 `addOutline(group, { width: 0.0011, color: '#080b14' })`。
  玻璃、雨、发光小灯、贴纸、薄片不要描边（材质 transparent 会自动跳过）。
- **发光**：招牌 / 灯箱 / 霓虹 / 屏幕用 `lightbox(tex, 1.1~1.6)`、`flat()` 或 `glow()`；
  灯周围可加 `glowSprite(color, size, 0.08~0.2)` 的柔和光晕，**不要新增真实 PointLight**。
- **材质与零件库**（先读源码）：
  - `src/lib/toon.js`: `toon flat lightbox glow glowSprite addOutline`
  - `src/lib/kit.js`: `box roundedBox plane cyl sphere torus tube catenary group mesh instanced shadow trs DEG`
  - `src/lib/textures.js`: `canvasTexture makeCanvas roundRect star moonLogo labelTex decalMaterial TEX BASE_TEX`
  - 需要新贴图就在自己模块内用 `canvasTexture(...)` 画，不要往共享文件加。
- **字体**：`JP_FONT`（`lib/textures.js` 导出）用于所有日文；不要依赖外部 webfont。
- 店内必须 **明亮、温暖、充实**；店外雨夜 **冷、湿、暗**，形成强对比。
- 不要出现人物；可以有一只猫。
- 所有元素都必须落在底座范围内（x/z ∈ [-5.5, 5.5]），不要悬空出界（雨/电线除外）。

---

## 5. 模块接口（统一）

```js
// src/world/xxx.js
export function buildXxx(ctx) {
  // ctx = { root, scene, handles, quality, params }
  const g = group('xxx');
  // ... 搭东西，全部 parent: g 或 g.add(...)
  ctx.root.add(g);
  return {
    group: g,
    update(t, dt) { /* 可选，每帧动画 */ },
  };
}
```

- `ctx.root` 是 diorama 根 Group；`ctx.handles` 是共享句柄对象（见下）。
- `update(t, dt)`：`t` 是累计秒数，`dt` 帧间隔。不要在每帧 new 对象/材质。
- 现有 handles（Lead 负责填）：
  - `handles.time.value`：共享时间
  - `handles.pointLights`：已创建的灯光（不要修改强度，除非是 fx 的闪烁需求）
  - `handles.door`：`{ left, right, closedX: [..], openX: [..] }` 自动门两扇（Lead 的 store.js 填）
  - `handles.glass`：`{ uniforms }` 玻璃雨纹材质的 uniform 集合（Lead 填）
  - `handles.dripPoints`：`THREE.Vector3[]` 屋檐滴水点，模块 push 进去，fx 读取
  - `handles.steamSources`：`THREE.Vector3[]` 蒸汽源，interior push，fx 读取
  - `handles.flickerMats`：`{ mat, base }[]` 需要轻微闪烁的灯箱材质（Lead 填）
  - `handles.flickerLights`：`{ light, base }[]`
- 自建动画状态放在模块闭包里，`update` 里只改变换/材质 uniform。

---

## 6. 各模块任务

### interior-artist → `src/world/interior.js`
便利店内部（透过正面玻璃窗 & 自动门完全可见）：
- 天花板：白色顶板 + 暖白长条灯箱（自发光）沿纵深若干条；吊挂的蓝色 aisle 指示牌
  （`TEX.aisleSign` 可作底图，自己写"お菓子 / 飲み物 / 日用品 / レジ"等，日文）。
- 地面：浅灰暖色地砖 + 门口到收银台的彩色地面导视（黄色/蓝色引导线、箭头、"レジ"字）。
- 货架：3–4 排白色便利店里脊货架（岛式），每排 4–5 层，摆满彩色商品
  （饮料瓶/罐、零食袋、泡面、日用品）——用 InstancedMesh 或共享几何批量摆，
  商品颜色要干净鲜艳，价格标签条用细长色块。
- 靠窗：杂志架 / 窗边小台（面向玻璃，封面彩色，可用 canvas 画封面）。
- 后墙：整排发光的玻璃门饮料冷柜（门内白亮、瓶罐成排），冷柜玻璃反光。
- 左墙：便当 / 饭团开放式冷藏货架（暖亮），三角饭团、便当盒陈列。
- 收银台：L 形柜台（右后方），收银机、客显、扫码枪、刷卡机、小票机；
  热食柜（炸鸡）玻璃罩、关东煮锅（分格、汤面、丸子/萝卜/竹轮）、咖啡机（屏幕/出水口/杯塔）。
- 后场门（STAFF ONLY）+ 员工储物柜、小走廊；ATM / 多功能复印机角落。
- 宣传海报/店内灯箱/吊旗/价签、天花板监控球机与喇叭。
- `handles.steamSources` push 关东煮/咖啡机的热气位置（fx 会接蒸汽）。
- 视角：`?view=inside` 贴近玻璃看，`?view=front` 看整体；从外面看要层次丰富、明亮温暖。

### street-artist → `src/world/street.js`
街道与街角结构（不含地面铺装/标线，那些 ground.js 已有）：
- 3 根电线杆（位置用 `L.poleMain/poleFront/poleBack`）：混凝土杆、横担、绝缘子、变压器、
  爬梯、黄黑警示贴、脚下防撞条；杆与杆之间用 `catenary()` + `tube()` 拉电线，
  自然下垂，横跨画面上方（夜间剪影感）；可留一点微风轻摆。
- 主杆上装一盏路灯（灯臂伸向路口，暖色灯头 + 发光面 + glowSprite），
  再挂蓝底白字路牌（"月見町 二丁目"）、"止まれ" 倒三角停字牌、禁止停车牌等。
- 远处路口（`L.trafficLight`，底座前端右下角）立一根信号灯杆：
  车辆信号灯横排三灯 + 下方行人信号灯（红/绿小人）；update 里让绿灯/红灯缓慢切换
  （变化要"微弱、慢"，远处看得到颜色呼吸即可）。
- 近侧路缘的白色金属护栏（街角护栏）：路口附近几段，立柱 + 双横杆，白色带反光条；
  可有一根轻微弯曲/倾斜。`L.parking` 附近可加停车标志。
- 左侧旧楼 + 小巷（重要！）：
  - 旧楼 x∈[-5.5,-4.0], z∈[-4.8,1.0]，两层 6.2m，底层卷帘门（关着）、旧瓷砖、
    二楼一扇暖光窗（自发光 + 窗帘剪影）、空调外机、排水立管、屋顶水箱。
  - 竖排霓虹灯牌 "スナック"（或 "たばこ"）挂在旧楼临街面，**粉红霓虹**，
    lightbox / glow + glowSprite，是画面左侧唯一一块粉色光源。
  - 小巷 x∈[-4.0,-2.9]：湿地面、墙角水管、电表箱、啤酒筐/牛奶筐、拖把桶、
    一盏暖黄小壁灯（照亮小巷入口）、堆叠的纸箱、旧自行车（简化）、排水沟。
    巷子要有纵深，别一堵死墙贴脸；尽头可放矮墙/铁门。
- 氛围：这一块负责"街角的转折与纵深"，让模型不像一个盒子摆在地上。

### props-artist → `src/world/props.js`
便利店门口与沿街的可动小道具（高细节，撑起"生活感"）：
- 自动贩卖机 2 台贴右侧外墙（x=1.7，朝 +X，z 用 `L.vending`）：
  白/青冷饮机 + 珊瑚红热饮机；正面商品窗发光（canvas 贴图，一排排饮料罐），
  投币口、按钮、取物口、机顶灯，机身周围 glowSprite，投币口附近小灯；
  机器在湿地上有存在感（底部反光贴片统一由 fx 水面反射负责，不必自己画）。
- 自行车 1–2 辆（妈妈车）：车架管、前后轮、辐条、挡泥板、车筐、车座、车铃、脚撑；
  一辆靠在店前玻璃窗边，一辆可以停在小巷/贩卖机旁。低多边形但要准确可爱。
- 门口：自动伞架（金属圆筒 + 半透明伞/红伞/藏青伞各一把）、三色分类垃圾桶
  （透明/蓝/绿，日文标签）、门口地垫（`TEX.doorMat` 贴图，放在自动门前）、
  A 字咖啡立牌（`TEX.aFrame`）。
- 墙面附件：右侧外墙的灯箱广告（用 `TEX.wallAd`，竖版发光灯箱 + 边框）、
  小型公告栏/海报栏（`TEX.noticePosters`，木框 + 软木板 + 图钉，挂在人行道侧）、
  空调外机 2 台（后墙/巷侧，风扇格栅、铜管、滴水痕迹）、
  PVC 排水管、电表箱、水龙头/拖把池等。
- 屋顶：空调外机、排风管、天线（从高视角可见的剪影）——位置见 `L.roof`。
- 一只淋雨的小猫：可以蹲在贩卖机顶/纸箱/店铺檐下（暖光里），低多边形，
  尾巴有细微呼吸摆动（update）。这只猫是点睛之笔，要做得简洁可爱，别抢戏。
- 所有物件都要有描边、卡通材质、干净色块；小物件不要太多三角面。

### fx-artist → `src/world/fx.js`
让静止模型"活过来"的微妙动态（雨夜核心氛围）：
- **持续降雨**：GPU 实例化雨丝（几千条细长 billboard 条），覆盖底座+边缘上空，
  斜向、速度随机、循环下落；近处稀疏大雨点、远处细密雨幕；冷色、半透明、加一点
  被灯光照亮的感觉。再加地面溅落的小水花/涟漪（实例化）。
- **屋檐滴水**：沿雨棚外缘/招牌底/屋顶边缘，按 `handles.dripPoints`（没有就自行按
  L.store.canopy 计算）生成偶发水滴下落 + 落地小涟漪；节奏自然（不是机械等间隔）。
- **地面积水波纹**：在 ground.js 预留的 puddle 上（可用坐标或自己找 `userData.isPuddle`）
  叠加扩散消失的同心圆涟漪层（透明 additive shader 或实例化环），雨点随机落点。
- **玻璃雨水**：在便利店正面玻璃前叠一层透明 shader 平面：雨珠沿玻璃蜿蜒滑落、
  汇聚、留下水痕（2D 程序化即可）；倾斜/间隔自然，不要像瀑布。
  需要自发光一点点，夜里能看见。
- **招牌/灯箱轻微闪烁**：通过 `handles.flickerMats` / `handles.flickerLights`
  （Lead 会填）做极偶尔的偶发微闪——安静、克制，像老灯管；不要整片跳闪。
- **自动门偶尔开合**：通过 `handles.door`（Lead 的 store.js 提供两扇门和坐标）
  做 20–40 秒一次的开合循环（开 2s、停 3s、关 2s），开门时门口暖光溢出稍强；
  如果 `handles.door` 还不存在就跳过，别报错。
- 如果还有余力：店内关东煮/咖啡机的蒸汽（handles.steamSources）、
  路灯下的雨雾光锥、雨量强弱极其缓慢的呼吸。
- 性能：雨/水花必须 GPU 或实例化，禁止几千个 Mesh 每帧改矩阵；每帧不 new 对象。

---

## 7. 验收标准（Lead 会按这个检查）

1. 结构正确、坐标对、不穿模、不出底座；从任何角度都没有明显空洞/错误。
2. 店内从街上看：明亮、层次丰富、一眼能认出是便利店（货架、冷柜、收银台、热食）。
3. 街角元素齐全：招牌、雨棚、自动门、贩卖机、自行车、伞架、垃圾桶、路灯、电线杆、
   电线、路牌、护栏、停车位、排水沟、积水、斑马线、小巷、空调外机、公告栏。
4. 三渲二质感统一：色块干净、阴影分层、描边清晰、霓虹有辉光但不过曝。
5. 动态自然克制：雨、滴水、涟漪、招牌微闪、自动门偶开、远处信号灯变化、玻璃雨痕。
6. 无 console error / warning；桌面 60fps 左右（1600×1000，DPR1）。
7. 无任何 UI 元素（不要 DOM 按钮/文字/提示；所有叙事都在模型里）。

---

## 8. 汇报

完成或遇到阻塞给 lead 发 `send_message`：
- 做了什么 / 截图路径（例如 `screenshots/dev/interior-final.png`）
- 用了哪些 handles、是否有遗留问题、性能情况（draw calls / fps 可从 shot 工具输出看）
- 把共享任务标记 `completed`（先 `team_task_get` 拿最新 revision 再 update）。
