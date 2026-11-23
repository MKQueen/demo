# 京城来信 · UI / 剧情 / 音频模块

> task-2 交付。纯 DOM + CSS，不依赖 three.js、不碰 `<canvas id="world">`、不改 `index.html` / `main.js`。
> 视觉对齐参考站 <https://messenger.abeto.co>：手绘黑描边、米白纸、青绿天、暖黄按钮、蓝色名牌、手写字体。
> 参考截图在 `docs/messenger-reference/`，验收截图在 `screenshots/ui/`。
>
> **当前集成入口：`src/ui/dom.js`**（main.js 已 `import { createUI } from './ui/dom.js'`）。
> `src/ui/index.js` 只是可选的额外门面（提供 `showDialogue(lines,{onDone})` 等简写），Lead 不需要可以无视。

## 文件一览

```
src/ui/
  dom.js        ★ 当前集成入口：createUI() 编排全部 UI（main.js 用这个）
  index.js      （可选）额外门面：简写 API + story/audio 再导出；不用可无视
  intro.js      开场标题 + BEGIN + LOADING 屏
  hud.js        右侧图标按钮 / 对话气泡 / 任务目标 / 互动提示 / toast / 区域标题 / 表情轮盘
  overlays.js   清单 CHECKLIST / 换装 OUTFIT + OUTFIT_CATALOG
  touch.js      触屏摇杆 / 跳跃 / 交互按钮
  icons.js      全部手绘 SVG 图标（无外部资源）
  style.css     全部 UI 样式 + @font-face（字体在 public/fonts/）
  README.md     本文件
src/game/
  story.js      5 段中文投递任务 / NPC / 区域 / 开场收尾文案（纯数据 + 小工具函数）
  dialogue.js   对话状态机（队列/打字机/advance/NPC 说话事件）
  audio.js      BGM / 区域环境音 crossfade / 音效 / 静音持久化
public/fonts/   Patrick Hand / Ma Shan Zheng / Zhi Mang Xing / ZCOOL KuaiLe（全部 OFL，离线自托管）
tools/ui/       test.html + test.js 静态验收台、shot.mjs 截图脚本、compare.py 对照图
screenshots/ui/ 验收截图
```

## 集成方式（当前 main.js 的用法）

```js
import './style.css';                                  // Lead 的全局基础样式
import { createUI } from './ui/dom.js';                // 唯一 UI 入口（自带 ui/style.css）
const ui = createUI({
  root: document.getElementById('ui-root'),
  audio,                                               // createAudio(assets)
  touch: 'auto',
  onBegin: () => startGame(),
  onTalk: (npcId, talking) => setTalking(npcId, talking),
});

ui.setPhase('intro'); ui.setSound(muted); ui.setChecklist(checklistItems(states));
ui.setOutfit(ui.OUTFIT_CATALOG, outfit, (category, id) => avatar.setOutfit({ [category]: id }));
ui.bindInput({ onMove: (x, y) => {}, onJump: () => {}, onInteract: () => {} });
// 每帧：ui.update(dt) —— 打字机 / audio.update 都在里面
```

对话 / 清单 / 换装 / 互动 / 区域 / toast 全部由 `ui` 一个对象暴露，签名见下方表格。
需要更细粒度控制时，也可以单独组合 `intro.js / hud.js / overlays.js / touch.js`（本 README 后半部分有各自的 API）。

### 对话 / 任务 / 开场怎么接（最容易踩的点）

```js
const dialogue = createDialogue({
  charsPerSecond: 26,
  onLineStart: ({ line }) => { hud.setSideVisible(false); hud.openDialogue(line); },
  onType: ({ visibleText }) => hud.setDialogueText(visibleText, true),
  onLineEnd: ({ line }) => hud.setDialogueText(line.text, false),
  onTalk: (npc, talking) => npcActors[npc]?.setTalking(talking),
  onDone: () => { hud.closeDialogue(); hud.setSideVisible(true); },
});
hud.onNextClick(() => dialogue.advance());

// 播一段
dialogue.start(scriptFor('harbour-recipe', 'ask'));   // 或 ui.showDialogue(...)（门面）
// 每帧
dialogue.update(dt);
```

- `hud.openDialogue()`/`closeDialogue()` 只负责气泡，**右侧图标显隐要自己管**（参考站对话时隐藏）。
- 清单打开时**不要**隐藏右侧按钮（参考图 09-ui-list.png 里两者同屏）。
- 新任务出现时 `hud.setChecklistDot(true)`；点开清单后 `setChecklistDot(false)`。
- 清单：`overlays.checklist.toggle(checklistItems({ [letterId]: 'pending'|'carrying'|'done' }))`。
- 换装：`overlays.outfit.open({ outfits: OUTFIT_CATALOG, current, onPick: (category, id) => avatar.setOutfit({ [category]: id }) })`；
  打开时把右侧按钮藏起来（`hud.setSideVisible(false)`），关闭时恢复。
- 互动：`hud.showInteract('和潜水员阿海说话', cb)` / `hud.hideInteract()`；键盘/触屏 E 用 `hud.triggerInteract()`。
- 区域：`hud.showZone(REGIONS.beach.name, REGIONS.beach.latin)` + `audio.setRegion(REGIONS.beach.ambience)`；
  或 `ui.setRegion('beach')`（可选门面会自动查表 + 调 audio）。
- 静音：`hud.setSoundMuted(audio.isMuted())`；点击右侧声音按钮时 `audio.toggleMute()` 再同步图标。
- 开场：`intro.show()` → 点 BEGIN（`onBegin` 里 `audio.unlock()` + `intro.hide()` + `intro.showLoading()`）→
  资源就绪后 `intro.hideLoading()` + `hud.show()` + `touch.setVisible(true)`。
- `#ui-root` 本身是 `pointer-events:none`，所有交互元素已自行设为 `auto`，不用改。

### 可选门面（不强制）

`src/ui/index.js` 提供 `createUI(opts)`，内部自动完成上面的接线，并额外提供简写
`showDialogue(lines, {onDone})` / `onInteract(cb)` / `onBegin(cb)` / `onToggleSound(cb)` /
`openOutfit(current, catalog, onPick)` / `bindTouch(controller)` / `setMuted(bool)`。

---

## createIntro(options) → intro

| 参数 | 说明 |
| --- | --- |
| `root` | 挂载点（默认 `document.getElementById('ui-root')`） |
| `title` | 大标题，默认 `京城来信`（4 字，2×2 方块字） |
| `latin` | 副标，默认 `BEIJING COURIER` |
| `eyebrow` / `cnLine` / `note` / `edition` | 开场小字、手写便签、右下版号 |
| `beginLabel` / `beginSub` | 按钮两行字，默认 `BEGIN` / `开始送信` |
| `onBegin` | BEGIN 点击（建议在这里 `audio.unlock()` + 显示 loading） |
| `onMuteClick` | 若传了，右上角小邮票变成静音按钮 |

返回：

| 方法 | 说明 |
| --- | --- |
| `el` / `loadingEl` / `beginButton` | DOM 引用 |
| `show()` / `hide()` | 显示/淡出开场（隐藏后不可点） |
| `showLoading()` / `hideLoading()` / `setLoadingVisible(bool)` | 白底 LOADING 屏 |
| `setBeginEnabled(bool)` / `setBeginLabel(text)` | 按钮禁用/改字 |
| `visible` | 开场是否可见 |
| `destroy()` | 移除 DOM |

## createHud({ root, callbacks, audio }) → hud

`callbacks`：`onChecklist()` `onOutfit()` `onSound()` `onEmote(index)` `onEmojiToggle(open)`。

| 方法 | 说明 |
| --- | --- |
| `show()` / `hide()` | HUD 整体淡入淡出 |
| `setSideVisible(bool)` | 右侧四个图标按钮显示/隐藏（对话时隐藏） |
| `setChecklistDot(bool)` | 清单按钮红点（有新信时） |
| `setSoundMuted(bool)` | 切换静音图标（音乐符 ↔ 带斜杠） |
| `openDialogue({ name, color, text, visibleText })` | 显示气泡：名字标签（颜色可变）+ 文本 |
| `setDialogueText(text, typing)` | 更新打字机文本 |
| `closeDialogue()` | 收起气泡 |
| `setDialogueNextEnabled(bool)` | 右下蓝色箭头是否可点 |
| `onNextClick(fn)` | 点击气泡/箭头时触发（通常 `() => dialogue.advance()`） |
| `isDialogueOpen()` | 气泡是否显示 |
| `setObjective(text, { kicker })` / `clearObjective()` | 左上角任务目标纸片 |
| `showInteract(label, cb)` / `hideInteract()` / `triggerInteract()` | 底部互动提示（E / 触屏） |
| `setTouchInteract(bool)` | 触屏样式（隐藏 E 键帽） |
| `toast(text, ms=2600)` | 手绘纸片 toast |
| `showZone(cn, latin, ms=2600)` | 区域标题（大写手写 + 拉丁副标） |
| `openEmoji()` / `closeEmoji()` / `toggleEmoji()` / `isEmojiOpen()` | 10 个手绘表情的轮盘 |
| `setSideVisible` 与 `elements` | `elements.interactEl / dialogEl / sidesEl / emojiEl / faces` |
| `destroy()` | 移除 DOM |

## createOverlays({ root, callbacks, audio }) → overlays

`callbacks`：`onChecklistOpen/Close`、`onOutfitOpen/Close`、`onOutfitPick(category, id, index)`。

| 方法 | 说明 |
| --- | --- |
| `checklist.open(items)` / `close()` / `toggle(items)` / `setItems(items)` / `isOpen` | 清单；items 结构见 `story.checklistItems(states)` |
| `outfit.open({ outfits, current, onPick })` / `close()` / `toggle(state)` / `setState(state)` / `isOpen` / `current` | 换装 |
| `closeAll()` / `isAnyOpen()` / `destroy()` | |
| `OUTFIT_CATALOG` | 默认目录：`hair1..7 / top1..9 / bottom1..7 / shoes1..7`，带中文标签 |

`current` 形如 `{ hair:'hair3', top:'top2', bottom:'bottom4', shoes:'shoes5' }`，
换装点击回调 `onPick(category, id, index)` 直接喂给 `avatar.setOutfit({ [category]: id })`。

## createTouch({ root, callbacks }) → touch

`callbacks`：`onMove(x, y)`（-1..1，y 向上为正）、`onJump()`、`onInteract()`。

| 方法 | 说明 |
| --- | --- |
| `show()` / `hide()` / `setVisible(bool)` | 显示整套触屏控件 |
| `setInteractVisible(bool)` | 只显示/隐藏右侧交互按钮 |
| `visible` / `destroy()` | |

> 触屏控件默认仅在 `pointer: coarse` 或窄屏显示；桌面截图里用 `setVisible(true)` 可强制显示。

## createDialogue(options) → dialogue（src/game/dialogue.js）

| 参数 | 说明 |
| --- | --- |
| `charsPerSecond=26` | 打字速度（中文建议 22–30） |
| `onLineStart({line,index,total})` | 一句开始（line 含 `name/text/color/npc/voice`） |
| `onType({line,visibleText,index})` | 每打出一段文本（驱动气泡） |
| `onLineEnd({line,index,total})` | 一句打完（含“点击跳字”） |
| `onTalk(npc, talking)` | NPC 说话开始/结束（给口型） |
| `onDone({lines,lastIndex})` | 队列播完 |
| `onEmpty()` | 空队列 |

| 方法/属性 | 说明 |
| --- | --- |
| `start(lines)` | lines 可以是 `['一句话', ...]` 或 `[{name,text,color,npc,voice}, ...]` |
| `enqueue(line)` | 追加一句（对话中也能用） |
| `update(dt)` | 每帧推进打字机（Lead 主循环调用） |
| `advance()` | 正在打字→立刻全显；已全显→下一句/结束。返回是否被消费 |
| `skipAll()` / `stop()` | 跳过整段 / 硬停止 |
| `setSpeed(cps)` | 动态改打字速度 |
| `active` / `typing` / `current` / `visibleText` / `index` / `total` | 状态 |
| `on(event, fn)` | `lineStart/lineEnd/type/talk/done/stop` 事件 |

标点（，。！？…）会自动多停 1–2 帧，读起来更像手写。

## createAudio(assets, options) → audio（src/game/audio.js）

| 方法 | 说明 |
| --- | --- |
| `unlock()` | 用户手势后恢复 AudioContext，开始 BGM + 当前环境音（必须调用一次） |
| `setRegion(name)` | `beach/city/forest/factory/temple/waterfalls/base`，环境音 crossfade 1.6s |
| `playFootstep(opts?)` / `playFootstepWater()` / `playJump()` / `playLand()` | 角色音 |
| `playCue(name)` | `click/hover/buttons/open/checklist/paper/quest/questStart/title/clothes/customize/bubbleStart/bubbleEnd/emoteStart/emoteEnd/emoji/letter/turn/out/whoosh/zoomIn/zoomOut` |
| `setMuted(bool)` / `toggleMute()` / `isMuted()` | 静音，持久化 `localStorage['bjcourier.audio.muted']` |
| `setBusVolume(bus, v)` / `getBusVolume(bus)` | `music|ambience|sfx|master` |
| `preload()` / `update(dt)` / `dispose()` | |
| `region` / `muted` / `unlocked` | |

音频全部由 `src/game/audio.js` + `src/game/music.js` 程序化合成（原创五声音阶
BGM、8 个区域环境音、25 个 cue），不再加载任何外部 ogg 文件。UI 只需要调用
`audio.playCue(name)` / `setMuted()` 等接口。

## story.js 数据

- `COURIER` 主角标签；`NPC_INFO` 每个 NPC 的 `name/short/color/voice`；
  `REGIONS` 区域中文名 + `ambience`。
- `INTRO_LINES`（开场三句）、`ENDING_LINES`（五封送完）、`LETTERS`（5 份投递）。
- 每封信：`id/order/title/checklistTitle/item/itemModel/giver*/target*/pickupSpot/objective/ask[]/reply[]/doneText/doneToast`。
- 工具：`getLetter(id)`、`lettersForNpc(model)`、`checklistItems(states)`、
  `scriptFor(letterId, 'ask'|'reply'|'done')`、`regionOf(spotId)`、`SPOT_REGION`。
- `checklistItems(states)`：`states` 形如 `{ 'harbour-recipe': 'done', 'village-postcard': 'carrying' }`，
  status ∈ `pending | carrying | done`；返回 `{ id, order, title, item, place, target, status, done }`。
- 锚点 id（给 Lead 布点）：`spot_diver / spot_chef / spot_flowerlady / spot_scout /
  spot_worker / spot_fox / spot_oldwoman / spot_mountainman / spot_musician`，
  拾取点 `pickup_letter / pickup_postcard / pickup_note / pickup_offering / pickup_record`。

---

## 字体（全部自托管，无 CDN）

放在 `public/fonts/`，`src/ui/style.css` 用 `@font-face` 引入：
URL 为 `/fonts/xxx.woff2`（需要站点部署在根路径；dev server 5190 满足）。

| 文件 | 字体 | 用途 | 来源（OFL） |
| --- | --- | --- | --- |
| `patrick-hand-latin-400-normal.woff2` | Patrick Hand | 拉丁正文/按钮/BEGIN | @fontsource/patrick-hand 5.2.8 |
| `gochi-hand-latin-400-normal.woff2` | Gochi Hand | 备用拉丁手写（已下载，当前未引用） | @fontsource/gochi-hand 5.2.8 |
| `ma-shan-zheng-chinese-simplified-400-normal.woff2` | Ma Shan Zheng | 中文手写正文/对话 | @fontsource/ma-shan-zheng 5.3.1 |
| `zhi-mang-xing-chinese-simplified-400-normal.woff2` | Zhi Mang Xing | 角落手写便签/小字 | @fontsource/zhi-mang-xing 5.2.8 |
| `zcool-kuaile-chinese-simplified-400-normal.woff2` | ZCOOL KuaiLe | 方块感标题字（近似原站 UglyDave 的厚重手绘块字） | @fontsource/zcool-kuaile 5.2.8 |

中文长正文若不用手写体，可回退系统 `Kaiti SC / STKaiti / KaiTi`（`--f-hand` 里已包含）。
原站使用的自定义 UglyDave `.font` 是 slug 字形几何格式，无法在 DOM 里直接使用，故以手写体近似。

---

## 验收状态（task-2 收尾自检）

- `node --check`：`src/ui/*.js`、`src/game/story.js`、`src/game/dialogue.js`、`src/game/audio.js` 全部通过。
- `node tools/ui/smoke.mjs`：199 项检查通过（story 完整性 / dialogue 状态机 / audio 无 AudioContext 降级 / 模块可 import / 10 个表情 / 换装目录）。
- 浏览器 console：静态五屏、手机屏、集成后的真实游戏页（`http://127.0.0.1:5190/`）均 **0 报错**；
  之前 `icons.js` 里 t-shirt 的非法 SVG path（`…1-2.6 1.1-3.8.2.`）已修复。
- 真实游戏页回归（`/tmp/game-final.mjs` 脚本，截图见 `30~33-integration-*.png`）：
  BEGIN → loading → 开场 3 句对话（点击右下蓝色箭头推进）→ 对话结束 HUD 出现（目标纸片 + 右侧图标）→
  清单开合（打开时临时藏起目标、右侧按钮保留）/ 换装开合（C 键，藏起右侧按钮和目标）→ 关闭后全部恢复。
  全流程 **0 console 报错**。
- 清单/换装 overlay 打开时会临时藏起左上任务目标，关闭后恢复（更贴近参考截图里干净的界面）。

## 验收截图

```bash
cd apps/beijing-courier
# 逻辑冒烟（不需要浏览器）：story 数据 / dialogue 状态机 / audio 降级 / 模块可 import
node tools/ui/smoke.mjs

# 前提：Lead 的 dev server 已在 127.0.0.1:5190 运行
node tools/ui/shot.mjs       # 五屏 + 手机 + 1920 截图
python3 tools/ui/compare.py  # 参考截图 vs 我们的截图（screenshots/ui/compare-*.png）
```

手动看五屏：<http://127.0.0.1:5190/tools/ui/test.html>，也可直接
`?clean=1&screen=intro|loading|dialogue|checklist|outfit|emoji|hud`（clean=1 隐藏调试条）。

| 截图 | 参考 |
| --- | --- |
| `screenshots/ui/01-intro.png` | `docs/messenger-reference/01-intro-title.png` |
| `screenshots/ui/02-loading.png` | `docs/messenger-reference/02-dialogue.png`（白底 LOADING） |
| `screenshots/ui/03-dialogue.png` | `docs/messenger-reference/04-gameplay.png` |
| `screenshots/ui/04-checklist.png` | `docs/messenger-reference/09-ui-list.png` |
| `screenshots/ui/05-outfit.png` | 原站换装屏（`screenshots/ui/reference-outfit.png`，从原站 2× 截图缩放） |
| `screenshots/ui/06-emoji.png` / `07-hud.png` | 原站表情轮盘 / 游戏内 HUD（无直接参考图） |
| `screenshots/ui/10~13-mobile-*.png` | 390×844 手机竖屏（intro / dialogue / checklist / touch） |
| `screenshots/ui/20~21-1920-*.png` | 1920×1080 缩放检查 |
| `screenshots/ui/30~33-integration-*.png` | **真实游戏页回归**（http://127.0.0.1:5190/）intro / dialogue / checklist / outfit，验证与 Lead 的 3D 场景、角色、任务系统联调后的效果 |
| `screenshots/ui/compare-*.png` | 5 张「参考 vs 我们」上下对照图（`tools/ui/compare.py` 生成） |
| `screenshots/ui/reference-checklist.png` / `reference-outfit.png` | 原站清单 / 换装屏的参考截图副本（从原站实时抓取后缩放，供对照） |

---

## 与参考图的差距（诚实说明）

1. **原站 UI 是 3D 场景里的 slug 字形 + 顶点抖动**，本质是 WebGL 绘制（`sideButtons/checkList/dialogBox` 都是 mesh）；
   我们用 DOM/CSS 复刻：描边是 CSS border，手绘抖动靠不规则圆角 + 每块小幅旋转，近看比原站“规整”。
2. **标题**：原站是真正的 3D 方块字（有光照和透视，鼠标可感）；我们用 SVG 叠字模拟侧面色阶 + 描边，
   整体轮廓和奶油/灰绿配色接近，但透视/光照是假的。中文用 ZCOOL KuaiLe，与原站 UglyDave 字形不同。
3. **字体**：见上表；对话中文为 Ma Shan Zheng，拉丁为 Patrick Hand，字形只能是“相似的手写气质”。
4. **图标**：list / 音符 / T 恤 / 便便 / 蓝色箭头 / 红叉 / 手绘信封全部重画为 SVG，形状对齐原站，
   但曲线细节（尤其便便的螺旋）不完全一致。
5. **换装**：原站是 3D 角色实时换装 + 环绕箭头；我们只做 DOM 箭头层，角色由 Lead 的 canvas 渲染。
   截图里没有角色，所以看起来空。
6. **清单**：原站正文是英文大写，我们中文 + 小号英文混排；已完成项在原站是灰色删除线（已复刻）。
7. **音频**：模块已完整接入原站 ogg，但静态 harness 没有 3D/资源上下文，截图无法体现声音。
8. **表情轮盘**：原站是 3D 表情脸；我们用 10 个手绘 SVG 脸近似，交互一致（选完发一个表情）。
9. 参考截图（1440×900）本身是从原站抓的；我们按 1440×900 量了对话气泡、名牌、按钮、清单的
   位置和尺寸（误差约 ±6px），其他分辨率按 `min(vw/1440, vh/900)` 等比缩放。
10. 开场标题的中文 2×2 方块字比原站 3 行英文 MESSENGER 更“方”，侧面色阶是 SVG 叠层而非真 3D；
    远景氛围接近，近看能看出描边是重复叠出来的。
11. 换装屏的 4 组分类标签（头发/上衣/裤子/鞋子 + 序号）是我们加的可用性提示，参考站原图没有文字标签。
12. 清单文字是中文 + 小号英文混排，原站是纯英文大写；行高、编号、灰掉删除线的行为一致。

## 已知限制 / 待办

- `style.css` 里字体 URL 用根路径 `/fonts/...`；若以后部署在子路径，需要改成 Vite 的 `base` 相对路径。
- 触屏“视角拖动”不在 UI 层做（交给 Lead 的 controller）。
- 键盘处理：`Escape` 关闭 overlay、`Enter/Space/E` 推进对话、`B/C/M/Q` 清单/换装/静音/表情。
  若 Lead 自己绑定了 E 交互，建议直接调用 `hud.triggerInteract()`，或在 `createUI` 时传 `keys:false`（仅门面支持）。
- `story.js` 的 NPC 模型名与锚点 id 是约定值，world 布点时保持 `spot_*`/`pickup_*` 命名即可。
