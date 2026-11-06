# 雨夜便利店 · 独立 QA 验收报告

- 验收人：verifier（只读验收，未修改任何源码）
- 对象：`apps/konbini-rain`（Vite + Three.js r170 / 三渲二 / 自由轨道 / 无 UI）
- 地址：http://127.0.0.1:5210/（未重启、未改配置）
- **源码冻结版：2026-11-06 11:51（最后一版）；最终验证运行 11:56–12:02，期间源码 hash 全程未变**
- 方法：Playwright headless Chromium（Apple M1 Max / ANGLE Metal / WebGL2 / 1600×1000 DPR1）+ `tools/shot.mjs` + 6 个只读临时脚本（/tmp，未入仓库）；截图均 `read_image` 人工复核。

## 一、总体结论

| 项目 | 结果 |
| --- | --- |
| 用户 10 条需求 | **9 PASS / 1 PARTIAL / 0 FAIL** |
| SPEC §7 七条 | **6 PASS / 1 PARTIAL / 0 FAIL** |
| 阻断问题 | 无 |
| 待处理 | 1 个中等交互问题：相机最近距离可进入旧楼体内部→全黑（BUG-1） |
| 可交付性 | **可交付**；若要达到 SPEC §7.2「冷柜/收银台/热食一眼认出」，建议做下方建议 2 |

一句话：画面完成度高、三渲二统一、细节与动效克制在线，是可直接当封面的微缩模型；主要短板是室内光比偏平削弱"透过玻璃的便利店招牌性内容"，另有一个低成本可修的相机穿帮。

## 二、逐项 PASS / FAIL（用户 10 条）

| # | 需求 | 结论 | 证据 |
| --- | --- | --- | --- |
| 1 | 正方形完整底座、元素都在底座上、第三视角看全场景 | **PASS** | `qa-overview.png` `qa-top.png` `qa-hero.png`；底座 11.64m 方形；bbox 审计：1500+ 实体仅底座黄铜包角（±5.89，设计件，+0.07）与 fx 路灯雾锥（加色光锥，+0.23，等同雨/电线例外）越界，其余全部在 ±5.82 内 |
| 2 | 自由拖拽/旋转/缩放、触控、不可平移出戏 | **PASS**（附 BUG-1） | 左键拖拽 az 0.5→−0.401、polar 1.05→0.927；滚轮 22.2→18.0；最近 5.5 / 最远 32 精确夹紧；右键拖拽 target 完全不动（enablePan:false）；触控单指 az 0.5→0.043、双指捏合 29.16→10.31；全程 scrollY=0 |
| 3 | 页面没有任何 UI 界面元素（DOM 只有 canvas） | **PASS** | body 仅 `canvas#scene` + `script`；全页 14 元素；可见文本 0；交互元素 0；外链 0；无 loading/水印；canvas 仅有一个屏幕阅读器 `aria-label`（不渲染可见 UI）；overflow:hidden 无滚动条 |
| 4 | 三渲二：描边、卡通明暗、材质干净、霓虹层次 | **PASS** | 材质：MeshToonMaterial 784 / ShaderMaterial 554 / MeshBasic 235 / Sprite 34，**0 个 Standard/Physical**；描边网格 **539** 个；`qa-canopy-close.png` `qa-cat-close.png` `qa-mood-lamp.png` |
| 5 | 街角元素齐全（19 项逐项） | **PASS** | 19/19 见 §4.1；`qa-front` `qa-corner` `qa-mood-street` `qa-vending-close` `qa-alley-entry` `qa-back` 等 |
| 6 | 店内部透过玻璃清楚可见（14 项） | **PARTIAL** | 实体 14/14 全部存在（interior 583 mesh + details 156 mesh，清单 §4.2）；但街面默认视角下冷柜本体、便当柜正面、咖啡机/关东煮/热食、杂志架、后场储物柜仅部分/需特定角度可见 → 见 NOTE-2 / 建议 2 |
| 7 | 动效 8 项且"微妙安静" | **PASS** | 数据 §4.3：雨 2900 条 uTime 0→53.28；滴水 13；涟漪 463；玻璃雨双层；招牌微闪实测最大下探 ≤13.4%；自动门 30s 周期实测 23.4–29.6s 开（开度到 1，t≈24.1s 截到自动开门）；信号灯 t=0 车绿/行人红 ↔ t=27 车红/行人绿；湿路反射可见 |
| 8 | 无人物；有猫；氛围安静治愈 | **PASS** | 命名检索无人物；猫可见（bbox≈[1.82,0.65,−0.33]→[2.15,1.10,0.00]，蹲贩卖机旁纸箱上，有呼吸/尾/耳微动）：`qa-cat-close.png` `qa-vending-close.png`；`qa-mood-street.png` `qa-alley.png` |
| 9 | console 0；桌面 1600×1000 ≥45fps；resize/mobile 正常；无穿模/出底座/雨穿屋顶 | **PASS**（附注） | console **0 error / 0 warning**（约 14 次加载）；桌面实测 **48.6–64 fps**（默认首屏 55）；移动端 390×844 清晰完整、DPR1.25、49.9–55.2fps、无滚动；实体无出底座、无可见穿模；雨 shader 在店顶 3.84m/雨棚 2.46m 截断（uniform 实测），店内无雨 |
| 10 | 视觉质量独立评价 + 3–5 条建议 | 见 §6 / §7 | — |

**FAIL 项：0。** 唯一非 PASS 为第 6 项（室内透过玻璃的"清楚可见"部分不达标）。

## 三、SPEC §7 映射

| SPEC §7 | 结论 |
| --- | --- |
| 1 结构/不穿模/不出底座 | PASS（相机边界见 BUG-1） |
| 2 店内从街上看明亮、层次丰富、一眼认出（货架/冷柜/收银台/热食） | **PARTIAL**（货架+氛围 OK；冷柜/收银/热食可读性不足） |
| 3 街角元素齐全 | PASS |
| 4 三渲二统一 | PASS |
| 5 动态自然克制 | PASS |
| 6 console=0；60fps 左右 | PASS（48.6–64，略低于"60 左右"但 ≥45） |
| 7 无 UI | PASS |

## 四、关键数据

### 4.1 街角 19 项
招牌（门头+pylon+24H 灯箱）、玻璃橱窗（含 自動ドア/ATM/24時間営業 贴纸）、自动门、雨棚+檐下灯带、门口地垫、贩卖机×2（发光商品窗/投币口/取物口）、自行车×2、伞架、三色垃圾桶、路灯（暖光/光锥）、电线杆×3（变压器/绝缘/黄黑警示）、电线（catenary 下垂）、路牌（月見町二丁目/止まれ/禁止停车/P）、街角护栏（白+黄反光）、停车位（划线+轻卡）、排水沟（路缘沟条）、积水+湿路镜面反射、反光斑马线×2、小巷入口/纵深/暖壁灯、空调外机（后墙2+屋顶+旧楼）、公告栏+墙面灯箱广告、信号灯（横三灯+行人两灯）、猫 —— **全部可见**。

### 4.2 店内 14 项
全部存在：floor/ceiling（灯箱+吊旗）、gondola（3 排×4 层+LED 灯条+价格牌）、cooler（后墙 3 门玻璃冷柜+COLD DRINKS 灯箱）、bento-fridge、magazine-rack+magazines、front-display、counter（register+客显/扫码/刷卡/小票）、oden、hot-snack、coffee、ice-freezer、atm、copier、staff-area/staff-lockers/后场门（details）。
**清楚可读**：货架+彩色商品、店内灯箱/吊旗、海报（おでん/月見だんご）、地面导视（レジ箭头）、ATM（左窗斜角）、收银台区（门洞斜角）、COLD DRINKS 灯箱（右窗斜角）。
**仅部分可见**：冷柜玻璃门+瓶罐（被 1.4m 货架正遮）、便当柜正面（朝店内）、咖啡机/关东煮/热食（柜台顶被货架+门框挡）、杂志架（自行车/角度挡）、后场储物柜。
证据：`qa-inside.png` `qa-interior-through-glass.png`（街面）vs `qa-interior-dooropen-view.png` `qa-interior-leftwindow.png`（特殊角度）。原因+修法见 NOTE-2 / 建议 2。

### 4.3 动效实测
| 项 | 实测 |
| --- | --- |
| 降雨 | 2900 条（移动 1300）；uTime 0→53.28；uIntensity 呼吸 0.92；受 6 处灯光染色 |
| 雨不穿屋顶/雨棚 | storeBox roofY=3.84、canopyY=2.46 shader 截断；店内截图无雨 → PASS |
| 屋檐滴水 | 13 个 |
| 积水涟漪 | 463（移动 307），本轮已调低密度/亮度 |
| 招牌微闪 | 4 材质+4 灯光；34s 采样最大下探 0.866/0.874（≤13.4%，克制） |
| 玻璃雨水 | 窗+门双层 uTime；开门门玻璃雨痕 0.24→0.019 |
| 自动门 | 周期 30s；实测开门窗口 23.4–29.6s、开度 max=1、t≈24.1s 自动开门；地面暖光 0→0.26 |
| 信号灯 | t=0 车绿/行人红；t=27 车红/行人绿（wide 截图肉眼可辨） |
| 湿路反射 | 店招/霓虹/路灯倒影清晰（反射贴图 384） |
| 蒸汽（额外） | 2 源 / 14 sprite |

### 4.4 交互（桌面 + 触控）
左键拖拽旋转 OK；滚轮缩放 22.2→18.0；**min 5.5 / max 32 精确夹紧**；右键平移 target 不动（enablePan:false）；触控单指旋转、双指捏合 29.16→10.31；scrollY 恒 0；闲置 14s 后 autoRotate=true（加分项）。
**BUG-1**：最近距离 5.5 时把方位角转到左后方（az≈−1.4…−2.7）→ 相机进入旧楼体内部，画面全黑（`qa-camera-minleft.png` `qa-camera-minleft-high.png`）。

### 4.5 性能 / DOM / 响应式
- GPU：ANGLE Metal / Apple M1 Max / WebGL2；桌面 1600×1000 DPR1 **48.6–64 fps**（默认首屏 55）。
- draw calls ≈**3458/帧**（含反射+bloom，约 16 次 render()/帧）、triangles≈246.6k、programs 227、textures 125、geometries 623；Mesh 1551 + Instanced 22 + 描边 539 + Sprite 34。首屏 ready≈2.4s、淡入 1.9s。
- DOM：body 仅 canvas+script；可见文本 0、交互元素 0、外链 0；canvas 铺满视口、无滚动。
- 移动端 390×844（DPR2→buffer 487×1055，pixelRatio 1.25，shadows off）：**初始画面完整包含整个方形底座**（新自适应：radius 28.92、fov 48、target y=1.6，`qa-mobile-default.png`）；fps **49.9–55.2**；无滚动。1600×1000↔390×844 resize canvas 精确铺满、恢复正确。
- 穿模/出界：见 §二-1；y<0 仅底座/绒垫（设计）与两片完全藏于店内地面以下的隐藏墙（不可见）；雨不穿顶 PASS；猫在底座内。

## 五、发现的问题

- **BUG-1（中等，交互）相机最近距离进入旧楼体 → 全黑**。原因：target 在店内、minDistance 5.5 → 相机水平半径≈5.45，旧楼占 x∈[−5.5,−4.0]、z∈[−4.8,1.0]、高 6.2m。修法：`src/main.js:276` minDistance→6.6（1 行），或每帧对旧楼/店体 AABB 做相机推出（约 10 行）。验收：最近距离 360° 旋转无黑屏。
- **NOTE-1（轻微）resize 横竖屏不重新取景**：手机首次竖屏自适应已生效且完整（q a-mobile-default.png）；但桌面窗口 resize 到 390×844 或手机横竖切换不重算 hero 取景（`qa-mobile-resize.png` 有裁切）。resize 本身正常。
- **NOTE-2（美术/规格）室内光比偏平**：5 盏暖点光+灯箱导致整体亮度均匀，玻璃反射叠加后发白、纵深弱；1.4m 高货架正挡后墙冷柜/收银/热食；便当柜朝店内。= 需求 6 PARTIAL 主因。
- **NOTE-3（轻微）近景雨丝偏白偏长、方向统一**（特写像划痕，`qa-alley.png`）；玻璃水珠偏圆点，缺滑落水痕方向感。路灯雾锥边缘硬、发灰（`qa-mood-lamp.png`）。
- **NOTE-4（轻微）角落逻辑/构图**：信号灯在右后角与斑马线不连通；hero 左半旧楼近乎死黑；俯视屋顶大片深灰；竖屏模型偏上、下方留白多。
- **NOTE-5（性能余量）** draw calls ≈3458/帧偏高（仍 48.6–64fps），可合并静态网格留余量。

## 六、美术评审（主观）

**优点**：① 收藏模型感强（胡桃木方座+黄铜包边/包角+正面铜牌刻字+绒垫+3/4 hero 构图）；② 色彩叙事成功（暖白店内↔钠灯橙↔粉紫スナック霓虹↔冷蓝雨夜，克制不脏）；③ 三渲二统一（toon+539 描边+干净色块，无写实材质打架）；④ 生活感密度高（分类垃圾/伞架/咖啡立牌/车筐自行车/吊旗/价格牌/レジ箭头/纸箱上的猫）；⑤ 雨夜氛围成立（雨幕/滴水/涟漪/湿路镜面倒影/玻璃水痕/路灯雨雾，动态克制：微闪≤13.4%、门 30s、灯 46s）；⑥ 交互完成度（8 视角+自由轨道+无 UI+闲置慢旋+竖屏自适应）。
**还差什么**：室内光比/纵深太平，冷柜/收银/热食招牌性内容不够一眼可读（最大差距）；近景雨丝"白线感"、玻璃水珠不够"水痕"；路灯雾锥硬边灰纸感；hero 左半旧楼死黑、俯视屋顶空、前景高光偶尔过曝；信号灯与路口逻辑不连通；相机最近距离穿楼。

## 七、改进建议（按优先级，5 条）

1. **P0 修相机穿楼（BUG-1，`src/main.js:276`）**：`minDistance 5.5 → 6.6`（1 行），或主循环对旧楼/店体 AABB 推出相机。验收：最近距离 360° 旋转无黑屏。
2. **P1 室内可读性 + 光比（对应唯一 PARTIAL）**：① 室内 5 盏点光再降 15–20%（或 distance −0.5m），亮度让给灯箱/LED 条；② 玻璃反射叠加不透明度 −30%；③ 岛式货架 1.4m→1.15–1.2m（或第 3 排 z −2.9→−2.6），让后墙冷柜门/瓶罐在 front/inside 越过货架可见；冷柜 header +15% 并加高亮 "COLD DRINKS" 横带；④ 收银台加亮「レジ・お会計」吊牌灯箱；⑤ 便当柜转 45° 面向玻璃、杂志架前移 0.25m、门口自行车左移 0.3m。验收：front/inside/开门特写各能第一眼认出冷柜、收银台、热食/关东煮、杂志架。
3. **P1 雨/玻璃质感（`fx.js`）**：近场（camDist<5m）雨丝 alpha ×0.65、长度分布缩短 ~25%、风斜随机放宽；灯光染色 gain +20%（近暖远冷）；玻璃雨把白圆点改成长水痕（v 拉长 1.5–2×、圆点密度 −30%、加低透明蜿蜒亮线）。
4. **P2 地面与路灯雾锥**：涟漪再 −20~30%、半径 0.05–0.35m/透明度 0.2–0.7 随机、混 15% 环境暖色；路灯雾锥改 additive 软边（径向+底部淡出）、opacity ×0.6。
5. **P3 构图与收藏感**：竖屏 target.y 再降 0.2–0.3（模型偏上、下方留白多）并在 resize/横竖屏时重算取景；顶视屋顶加分缝/检修口/小积水反光；底座铜牌刻字对比度提高；旧楼侧补极弱冷轮廓光；信号灯移到右侧路口（z≈2.2–2.6）或补停止线。
   可选微调：exposure 0.98→0.95 / bloom 0.26→0.22（门头轻微过曝）；静态网格合并降 draw calls。

## 八、截图证据索引（均在 `screenshots/dev/`）

- 视角全集：`qa-hero` `qa-front` `qa-corner` `qa-top` `qa-inside` `qa-alley` `qa-back` `qa-side` `qa-overview`
- 首屏：`qa-default` `qa-default-idle` `qa-mobile-default`（真机模拟竖屏，完整底座）
- 自动门：`qa-t0-front`（关）`qa-t26-front`（开）`qa-door-closed-close` `qa-door-open-close` `qa-door-auto-open`（live 自动开）
- 信号灯：`qa-corner-t0` `qa-corner-t27` `qa-traffic-green` `qa-traffic-red` `qa-traffic-wide-t0` `qa-traffic-wide-t27`
- 店内：`qa-inside` `qa-interior-through-glass` `qa-interior-inside-a` `qa-interior-inside-b` `qa-interior-counter` `qa-interior-counter2` `qa-interior-leftwindow` `qa-interior-dooropen-view` `qa-interior-from-street-angle` `qa-interior-cooler-from-street` `qa-interior-magazine` `qa-details-off-inside`
- 氛围/细节：`qa-mood-street` `qa-mood-lamp` `qa-canopy-close` `qa-road-wet` `qa-ripple-close` `qa-glass-rain-close` `qa-cat-close` `qa-vending-close` `qa-alley-entry` `qa-parking` `qa-ground-right` `qa-road-front`
- 响应式：`qa-mobile` `qa-mobile-resize` `qa-desktop-restored`
- 问题证据：`qa-camera-minleft.png` `qa-camera-minleft-high.png`

## 九、冻结版本

- 冻结版本：2026-11-06 11:51（Lead 通知 11:56 后截图即最终版）；最终验证 11:56–12:02，运行前后源码 sha256 完全一致（`SOURCE STABLE`）。
- 关键文件 sha256：
  - `src/main.js` `f190e50b9e6dd176b863fa9574448421c9a66d022bc0503bde5f36b30249b2c3`
  - `src/config.js` `e4d269218fedc0a625b77b605383d18d2eab6c8c5e770a18ee9c28103d560854`
  - `src/world/fx.js` `33064fad03e410e1dd9dc3ef905ca8deae03721ad7f07aac33df86dd9c3ecfee`
  - `src/world/store.js` `ea3a2ebf935fdd882c49ffebb65e1e003f86b0c26733f1d4ca92385a6590381b`
  - `src/world/ground.js` `86be35e5b5ea703abd9a480c66f8e7dc070a94228468c84a4afc129dcb643c4d`
  - `src/world/interior.js` `70d311f2b5fb6f28aaf76ce21f60611c2d5927b42c0383986282c2870f1aca1f`
  - `src/world/street.js` `a6cfd42a2ae68d3783bed6cdefc71cd3bcaea91d543ff7ea128b692e6863661b`
  - `src/world/props.js` `873f3ae11974b3ab2d0ba262fc593b22e60edabcd70773c3df8bf01d0fca7008`
  - `index.html` `008ad7ee4326600d967b153e08dcf204ba0e65331f53d7406cc0ca8ed817b992`
  - 完整清单：`/tmp/qa-src-hash-frozen.txt`
- 复跑：`node tools/shot.mjs --url "http://127.0.0.1:5210/?view=hero&still=1" --out screenshots/dev/qa-hero.png --w 1600 --h 1000 --wait 2600`；自动门 `?view=front&still=1&t=0` vs `?t=26`；信号灯 `?view=corner&still=1&t=0` vs `?t=27`；竖屏用移动上下文（390×844、DPR2、isMobile+hasTouch）。
- 局限：fps 为 headless Metal 实测，与真机有差异；视觉评审为主观；只读验收（未改源码/未重启服务/未碰 hub/site）。若冻结后再改 `config/main/store/ground/fx/interior`，请复验需求 4/5/6/7/9。

---

## 八、Lead 收尾补记（验收后修复）

verifier 报告基于 11:51 冻结版；以下为之后的收尾改动，供存档：

1. **BUG-1 已修复**：`src/main.js` 增加相机 AABB 碰撞（便利店体块 / 左侧旧楼 / 路边轻卡），每帧把相机沿轨道半径推出建筑体外；`minDistance` 保持 5.5，最近距离 360° 旋转不再进入建筑内部。同时在旧楼西/背面加了小壁灯与方向补光，贴墙时不再纯黑。
2. **零 UI 收尾**：合集站部署时注入的「作品集」返回按钮在本 demo 内用 CSS 隐藏（DOM 保留，合集站返回入口校验仍通过）；production 页面实测「可见 UI 元素 = 0」。
3. **需求 6（店内可读性）低风险改善**：调亮「レジ」吊牌灯箱、便当柜灯箱；货架 LED 灯条保留。未改货架高度/朝向（会破坏 interior-details 层的价格槽/吊牌对位），以“街面可读 + 特殊角度完整”为准。
4. **最终复验**：production 页面 console **0 error / 0 warning**；桌面 1600×1000 默认首屏约 55–60fps（headless 无并发时）；移动端 390×844 完整底座、触控可旋转/缩放；`__back-home` display:none；`controls.minDistance=5.5`。
