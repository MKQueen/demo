# 音频系统 · 原创程序化 WebAudio

> 目标：把「照搬参考站」的音频资产换成**完全原创、零外部音频文件**的程序化声音。
> 本目录下所有声音（BGM / 8 个区域环境音 / 25 个音效 / 脚步 / 跳跃 / 落地）
> 都由 WebAudio 节点实时合成，BGM 由 `OfflineAudioContext` 预渲染成一条
> 36 秒无缝循环的 `AudioBuffer`。**不再读取 `public/assets-messenger/audio` 下的任何 `.ogg`。**

| 文件 | 职责 |
| --- | --- |
| `src/game/audio.js` | 音频控制器：总线 / 静音 / 持久化 / 区域环境音 / 音效 / 脚步 / 调度器 / 降级。对外 API 与旧版完全兼容。 |
| `src/game/music.js` | 原创 BGM：五声音阶乐谱数据 + Karplus-Strong 拨弦 / pad / 鼓组 / 混响 IR 合成 + `OfflineAudioContext` 渲染 + 实时兜底。 |
| `tools/audio/test.html` | 纯 WebAudio 验收台：解锁、区域、cue 列表、实时波形/电平、BGM 波形、离线 RMS 自检表。 |
| `tools/audio/verify.mjs` | Playwright 自动验收：验收台 + 真实游戏页 + 离线统计，输出 `screenshots/audio/report.json`。 |
| `screenshots/audio/` | 验收截图与报告。 |

依赖：只有 `src/game/music.js` 被 `audio.js` import，二者都不依赖 three.js / DOM 之外的任何东西
（`music.js` 顶层甚至可以在 Node 里 import，做乐谱数据检查）。

---

## 1. 快速听 / 快速验收

```bash
cd apps/beijing-courier
# 前提：Lead 的 dev server 已在 127.0.0.1:5190 运行（不要另起）
open http://127.0.0.1:5190/tools/audio/test.html

# 自动验收 + 截图（测试页、离线 RMS、真实游戏页 BEGIN→unlock→BGM）
node tools/audio/verify.mjs
# → screenshots/audio/01..08-*.png + screenshots/audio/report.json
```

页面里点 **「解锁 WebAudio · 开始播放」**：AudioContext 从 suspended 恢复，
随即在后台离线渲染 36s BGM（约 3–4 秒），完成后 2.6s 淡入，同时铺开黑胶底噪（本机渲染耗时 2.4–3.4s，随 CPU 波动）。
之后可以切 8 个区域、点 25 个 cue、走/跑/跳/落地、拖三路总线音量。

验收数据（`screenshots/audio/report.json` 实测，日期 2026-11-06，headless Chromium）：

| 项目 | 结果 |
| --- | --- |
| AudioContext（测试页 / 真实游戏页点 BEGIN 后） | `running` |
| BGM | 12 小节 · 36s · 48kHz 立体声 · 峰值 0.72 · RMS 0.132 · 离线渲染 ~2.4s（多次实测 2.4–3.4s） |
| 循环接缝 | `seamDelta 0.0027`（≈ 峰值的 0.37%，听不出接缝） |
| 区域环境音 | 8/8 离线渲染非静音（RMS 0.042–0.103） |
| 音效 cue | 25/25 离线渲染非静音（峰值 0.015–0.082） |
| 真实游戏页 | BEGIN 后 `AudioContext.state === 'running'`，BGM 播放，区域切换 / cue / 脚步正常 |
| 音频文件网络请求 | **0**（测试页与游戏页都没有 `.ogg/.mp3` 请求） |
| console error | 0（音频相关） |

---

## 2. 信号链

```
                       ┌── musicBus ──── BGM loop（AudioBuffer / 实时兜底）
                       │       └──────── 黑胶底噪 + 随机爆点（实时合成，永不重复）
 AudioContext.destination ── master ──┤
                       │── ambienceBus ─ 当前区域环境音（分层噪声 + 持续音 + 偶发事件）
                       │── sfxBus ────── cue / 脚步 / 跳 / 落地（一次性节点）
                       └── analyser tap（测试页可视化，零音量旁路）
```

- 三路总线各自有 `music / ambience / sfx` 音量，写 `localStorage`（键名与旧版一致）。
- `master` 负责静音（0/1 平滑 ramp），静音状态持久化。
- 没有 AudioContext 的环境（Node 冒烟测试 / 极老浏览器）返回**同形状的静默实现**，
  所有方法都存在、静音状态仍然持久化；`ctx === null`、`ready === false`。

---

## 3. 原创 BGM：五声音阶 Lo-fi 民乐循环

### 3.1 调式

C 宫五声（宫商角徵羽），不用 4、7 级音，旋律天然带中式五声色彩：

| 五声 | 宫 | 商 | 角 | 徵 | 羽 |
| --- | --- | --- | --- | --- | --- |
| 简谱 | 1 | 2 | 3 | 5 | 6 |
| 音名 | C | D | E | G | A |

80 BPM，4/4，**12 小节 = 36.0s** 一个循环。和声只用五声音阶内的音，
采用「根音 + 五度 + 九度（或六度）」的空弦式 voicing，避免三和弦的西洋味。

### 3.2 和声进行（每小节一个和弦）

| 小节 | 和弦 | 五声级数 | 低音拨弦 root / fifth | pad voicing（midi） |
| --- | --- | --- | --- | --- |
| 1 | C | 宫 | C2 / G2 | C3 G3 D4 |
| 2 | Am | 羽 | A1 / E2 | A2 E3 C4 |
| 3 | D | 商 | D2 / A2 | D3 A3 E4 |
| 4 | G | 徵 | G1 / D2 | G2 D3 A3 |
| 5 | C | 宫 | C2 / G2 | C3 G3 D4 |
| 6 | Am | 羽 | A1 / E2 | A2 E3 C4 |
| 7 | D | 商 | D2 / A2 | D3 A3 E4 |
| 8 | G | 徵 | G1 / D2 | G2 D3 A3 |
| 9 | Am | 羽 | A1 / E2 | A2 E3 C4 |
| 10 | C | 宫 | C2 / G2 | C3 G3 D4 |
| 11 | G | 徵 | G1 / D2 | G2 D3 A3 |
| 12 | C | 宫 | C2 / G2 | C3 G3 D4 |

进行可以读成「宫 → 羽 → 商 → 徵」的反复（两次），第三段改成「羽 → 宫 → 徵 → 宫」
收束回宫音，正好接回第 1 小节。

### 3.3 旋律构思（原创，设计为「起承转合」）

旋律全部写在五声音阶内，按中国器乐曲的句法处理：

- **A 段（1–4 小节）**：主题从角音 E5 起，第 2 小节落到羽音 A5（1.5 拍长音），
  第 3 小节冲到 C6（宫音高八度）后回落，第 4 小节收在商音 D5 —— 半终止。
- **A' 段（5–8 小节）**：同和声，但改从 C6 起，整体高一个乐句位置，
  第 8 小节 E5 → D5 → **C5 长音（宫音）**，落在主音上形成「承」。
- **B 段（9–12 小节）**：情绪推到最高，第 9 小节 A5 → C6 → **D6**（倚音 C6）→ C6，
  之后 A5 → G5 → E5 逐级下行，第 12 小节 G5 → E5 → D5 → **C5** 完全终止，
  然后循环回第 1 小节。

每个音的具体拍点（0.5 拍 = 八分音符；第 9 小节 D6 前面有 C6 倚音）：

| 小节 | 和声 | 旋律 |
| --- | --- | --- |
| 1 | C | E5(1拍) G5(0.5) A5(0.5) G5(1) E5(1) |
| 2 | Am | A5(1.5) G5(0.5) E5(1) D5(1) |
| 3 | D | E5(0.5) G5(0.5) A5(1) C6(1) A5(1) |
| 4 | G | G5(1.5) A5(0.5) G5(1) D5(1) |
| 5 | C | C6(1) A5(0.5) G5(0.5) E5(1) D5(1) |
| 6 | Am | E5(1) G5(0.5) A5(0.5) C6(1) A5(1) |
| 7 | D | D5(0.5) E5(0.5) G5(1) A5(1) G5(1) |
| 8 | G | E5(1.5) D5(0.5) C5(2) |
| 9 | Am | A5(1) C6(1) D6(1, 倚音 C6) C6(1) |
| 10 | C | A5(1) G5(1) E5(1) G5(0.5) A5(0.5) |
| 11 | G | G5(1.5) E5(0.5) D5(1) E5(1) |
| 12 | C | G5(1) E5(1) D5(1) C5(1) |

乐谱数据就在 `music.js` 的 `MELODY`（导出的纯数据），共 **53 个旋律音**；
每个音带力度、可带倚音；`scheduleCycle()` 负责把它排进小节网格。

### 3.4 音色与合成方法

| 声部 | 合成方法 |
| --- | --- |
| 主旋律 / 低音拨弦 | **Karplus-Strong** 数字拨弦：白噪声激励 + 延迟线（周期 = 1/频率）+ 平均滤波器（弦阻尼）+ `t60` 指数衰减。低音用更长的 `t60`、更低的 brightness；输出峰值归一化后按力度缩放，听感接近古筝/琵琶的拨弦。 |
| 和声 pad | 每个音两条振荡器（sine + triangle）±5 音分失谐，慢起音 0.85s、1.15s 释放，过一个 1.35kHz 低通；一个 0.14Hz LFO 给所有 pad 声部加 5.5 音分合唱，一个 0.07Hz LFO 让滤波器缓慢呼吸。 |
| 软底鼓 | JS 生成 one-shot：正弦 34→112Hz 快速下滑 + 8.5/s 指数包络 + 前 5ms 噪声 click。 |
| 木鱼 / 梆子 | JS 生成 one-shot：640Hz 正弦（52/s 衰减）+ 1730Hz 泛音 + 900/s 噪声 click。 |
| 沙锤 | JS 生成 one-shot：高通噪声 + 4ms 起音 + 58/s 衰减。八分音符位置带 **swing**（反拍 +0.055 拍）。 |
| 卷积混响 | IR 由代码生成：28ms 预延迟 + 指数衰减噪声（2.6s）+ 一阶低通变暗，立体声双声道去相关。 |
| 山谷回声 | 附点八分延迟（0.5625s），反馈 0.24 + 低通 1.65kHz，只给力度 ≥ 0.8 的旋律音（反向声场的回声副本）。 |
| Lo-fi 处理 | 主链路：低通 7.2kHz → 高通 38Hz → 压缩器（threshold −18dB / ratio 2.6 / release 0.3s）→ `tanh` 软削波（2× oversample）→ 总线。 |
| 黑胶底噪 | **不放进 BGM buffer**：由 `audio.js` 实时铺一层 8s 循环噪声（低通 2.6k + 高通 170 + 0.06Hz 呼吸）+ 每隔 0.14–1.1s 随机触发黑胶爆点，左右声像随机。因此长听不会有周期性 loop 痕迹。 |
| 随机 | 全部 random 来自固定种子 `mulberry32(0x5eed2024)`：humanize、swing、鼓的力度都确定，同一版本每次渲染结果一致（便于截图/验收回放）。 |

### 3.5 无缝循环的实现

1. 渲染 `loopSeconds + tailSeconds = 36 + 5 = 41s`；
2. 把 `[36s, 41s)` 的尾音**回卷叠加**到 `[0s, 5s)`，让上一遍最后的拨弦余韵、混响尾音自然延续到下一遍开头；
3. 归一化到峰值 0.72，并计算 RMS。
4. 循环点正好落在第 1 小节强拍的拨弦上，相当于「节拍器不会停」，接缝差值只有峰值的 0.37%。

第 1 小节第一拍拨弦从 0 起音、pad 从 0 慢起、没有持续噪声源，因此回卷后接缝处不会有 click。
实测 `seamDelta = 0.0027`。

### 3.6 为什么仍然满足「CPU 低」

- 循环播放时 BGM 只是**一个** `AudioBufferSourceNode` + 一个 GainNode，CPU 几乎为 0。
- 渲染只在首次 `unlock`（或 `preload()`）时离线做一次，约 2.4–3.4s，藏在 loading 阶段后面。
- 环境音是 4–6 个长循环噪声源 + 若干 LFO（常驻 ~10 个节点），偶发事件用一次性节点。
- 音效全部是一次性短节点，播完自动回收，没有常驻开销。
- 内存：BGM buffer ≈ 13.8MB（36s × 48kHz × 立体声 float32）；环境音共享一条 8s 立体声噪声 buffer ≈ 3.1MB。
- 若浏览器没有 `OfflineAudioContext`（老环境），`music.js` 提供 `createRealtimeMusic()`：
  用同一份乐谱和同一套音色做实时循环调度兜底。

---

## 4. 区域环境音（全部合成）

`setRegion(name)` 做 1.4s 淡出旧区域 / 1.8s 淡入新区域；同时兼容旧别名
（`harbour→beach`、`village→city`、`mountain→temple`、`falls→waterfalls`、`start/intro→base` 等）。
底噪 RMS 统一经过 `REGION_LEVEL` 校准，避免换区域时音量忽大忽小。

| key | 中文 | 常驻分层（滤波噪声 / 持续音） | 偶发事件（min–max 秒） |
| --- | --- | --- | --- |
| `base` | 微风 | 420Hz 低通风 + 1.35kHz 带通空气层 + 95Hz 低频，三个不同速率 LFO | 阵风（9–18）/ 远处鸟鸣（18–34） |
| `beach` | 海边码头 | 380Hz 海床 + 1.15kHz 浪涌（增益 + 滤波双 LFO）+ 2.6kHz 浪花 + 118Hz 低鸣 | 海浪拍岸（5–10）/ 海鸥（7–14） |
| `village` | 村子 | 360Hz 低柔风 + 1.9kHz 叶隙 + 430Hz 远处生活底噪 + 196Hz 轻持续音 | 鸟鸣（3–7）/ 风铃（8–18）/ 远处人声（16–30） |
| `city` | 城市街巷 | 150Hz 车流轰鸣 + 520Hz 中频车流 + 1.6kHz 城市空气 + 50/100Hz 电网嗡鸣 | 汽车驶过（4–9）/ 喇叭（11–24）/ 自行车铃（18–34）/ 远处人声（20–38） |
| `forest` | 森林 | 480Hz 树梢风 + 2.6kHz 叶隙 + 4.3kHz 虫鸣床（Q=6 的窄带） | 蟋蟀（1.2–2.6）/ 鸟鸣（3–7）/ 阵风（9–17） |
| `factory` | 工厂 | 48Hz 锯齿机械低鸣（0.5Hz 调制）+ 96/144Hz 谐波 + 240Hz 轰鸣 + 3.5kHz 蒸汽底噪 | 金属撞击（2.5–6）/ 蒸汽泄压（7–15） |
| `temple` | 山寺 | 300Hz 山风 + 2.3kHz 高空 + C2 持续音（0.031Hz 慢呼吸）+ G2 五度 | 钟声（13–26）/ 磬声（6–12）/ 山风阵（9–16） |
| `waterfalls` | 瀑布边 | 1.6kHz 水声轰鸣 + 2.8kHz 中频水雾 + 100Hz 水压 + 5.2kHz 水花 | 水花飞溅（2.2–5）/ 水滴（2–5.5）/ 水雾涌动（5–10） |

事件合成举例：

- **海鸥**：锯齿波 820→1420→700Hz 的三段滑音 + 1.4kHz 带通（Q=2.2），1–2 声一组，随机声像。
- **城市喇叭**：两个锯齿波（基频 ×1 / ×1.25）+ 1.2kHz 低通 + 28ms 起音，远处感。
- **汽车驶过**：带通噪声 320→760→300Hz 扫频 + 声像 −0.75→+0.75 + 低频胎噪，时长 2.4–4.2s。
- **山寺钟声**：非谐分音 `[1, 2.0, 2.42, 3.0, 4.2, 5.33]`，2–5.2s 长衰减 + 900Hz 带通撞击噪声。
- **虫鸣**：2–4 组、每组 3 个 4.0–4.7kHz 的 26ms 短脉冲。
- **瀑布水滴**：900–1800Hz 快速上滑正弦 + 160ms 衰减。
- **环境音调度**：`update(dt)`（UI 每帧调用）和 250ms 内部定时器双驱动，事件按随机 min–max 重排；
  静音时跳过合成。跨区域切换时旧区域的一次性节点会随淡出一起消失。

工厂 `factory` 不在任务最初列表里，但 `story.js` 的 `REGIONS.factory.ambience === 'factory'`
会真实传到 `setRegion()`，所以补了一套机械工厂环境音，而不是静默回退。

---

## 5. 音效 cue 映射（25 个 + 未知兜底）

`playCue(name)`：`CUES[name]` 存在则合成；否则若像文件路径，按关键词映射（`footstep/jump/land/quest/paper/click/…`）；
再否则播放**柔和的双音提示**兜底 —— 永远不会 throw，也不会发网络请求。
`playFile(path, opts)` 保留 API，但把旧资产路径映射到合成 cue（同样不 fetch）。

| cue | 中文 / 用途 | 合成配方 |
| --- | --- | --- |
| `click` | 通用点击 | 3kHz 带通 32ms 噪声 + 1.7→1.2kHz 正弦 |
| `hover` | 悬停 | 2.3→2.52kHz 轻正弦 |
| `buttons` | 大按钮 | 640Hz 木鱼 + 1.32kHz 轻泛音 |
| `open` | 开箱 / 打开面板 | 900→2100Hz 噪声 + 300→480Hz 上扬 + 纸声 |
| `checklist` | 打开清单 | 两层翻纸 + 1046Hz 小风铃 |
| `paper` | 翻信纸 | 两层 2.3k/3.4kHz 带通噪声错开 55ms |
| `quest` | 任务完成 | C5-E5-G5-A5-C6 上行琶音（拨弦 + 风铃叠层 + 高频闪光） |
| `questStart` | 接任务 | 392→523Hz 两声拨弦 + 196Hz 底音 |
| `title` | 标题 / 开场 | 130.8Hz 钟 + 196Hz 磬 + 65.4Hz 低音 + 空气噪声 |
| `clothes` | 换衣 | 两层布料噪声 + 392Hz 拨弦 |
| `customize` | 换装 | 660/990Hz 马林巴式双音 |
| `bubbleStart` | 对话气泡出现 | 520→880Hz 短滑音 |
| `bubbleEnd` | 对话气泡消失 | 880→520Hz 短滑音 |
| `emoteStart` | 表情盘打开 | C5-E5-A5 三连风铃（上行） |
| `emoteEnd` | 表情盘关闭 | A5-E5-C5 三连风铃（下行） |
| `emoji` | 选表情 | 260→1050Hz pop + 高频 tick + 1568Hz 闪光 |
| `letter` | 信件 / 邮差风铃 | A5-C6-E6 三连风铃（1.7s 长衰减）+ 高频空气 |
| `turn` | 翻页 / BEGIN 按钮 | 1.2→2.8kHz 噪声扫频 + 纸声 |
| `out` | 退出 / 关闭 | 1.8→0.32kHz 下落 whoosh + 低频 thud |
| `whoosh` | 相机掠过 | 420→2600Hz、2400→620Hz 两段噪声扫频，反向声像 |
| `zoomIn` | 镜头推进 | 180→720Hz 上扬 + 3kHz whoosh + 高音闪光 |
| `zoomOut` | 镜头拉远 | 720→180Hz 下坠 + 反向 whoosh |
| `note` | 对话提示音 | 880Hz + 1318.5Hz 两声轻拨弦 |
| `error` | 错误提示（扩展） | 220/164.8Hz 低通双音 |
| `toggle` | 开关（扩展） | 880Hz 木鱼轻击 |
| *(未知道具)* | 兜底 | 660→990Hz 柔和双音 |

### 角色音

| API | 合成 |
| --- | --- |
| `playFootstep({ run })` | 干地：1.25–1.67kHz 带通短噪声（跑步更亮更重）+ 92/112Hz 低频 thud（跑步下沉到 46Hz）；`beach` 上自动变沙地低通，`factory` 变金属高频。 |
| `playFootstepWater()` | 1.9–2.6kHz 水花噪声 + 3 个 700–2100Hz 气泡短音 + 低频落水 thud；`waterfalls` 区域自动按水声处理。 |
| `playJump()` | 900→2300Hz 气流噪声 + 180→380Hz 上扬正弦 + 五声拨弦装饰音。 |
| `playLand()` | 132→52Hz 低频 thud + 760Hz 带通噪声 + 196Hz 木质感共振。 |

两层随机（音高/时长/滤波/声像）让连续脚步不会像机关枪；80ms 内重复调用直接忽略。

---

## 6. 静音 / 音量 / 持久化

| 行为 | 细节 |
| --- | --- |
| `setMuted(bool)` | master gain 0.25s 平滑到 0 / 原音量；持久化 `localStorage['bjcourier.audio.muted']`。静音时新音效不再创建节点（省 CPU）。 |
| `toggleMute()` / `isMuted()` | 同上。 |
| `setBusVolume('music'\|'ambience'\|'sfx'\|'master', v)` | 0–1 clamp，写 `localStorage['bjcourier.audio.music' / .ambience / .sfx]`。 |
| `getBusVolume(bus)` | 返回当前值（默认 music 0.5 / ambience 0.4 / sfx 0.65）。 |
| `storagePrefix` | `createAudio(assets, { storagePrefix })` 会在上述 key 前加前缀（验收台用 `bjcourier.audioTest.` 隔离游戏设置）。 |
| `unlock()` | 用户手势后 `ctx.resume()`、重新应用静音值、开始 BGM/环境音；重复调用安全。 |
| `dispose()` | 停 loop / 环境音 / 黑胶，清定时器，断开总线并 `ctx.close()`。 |

没有 AudioContext 时（Node / 极老浏览器）：
`createAudio(null)` 返回静默同形状对象，`region/muted/unlocked/ready` 等 getter 都在，
`setMuted`/`setBusVolume` 仍然持久化；`tools/ui/smoke.mjs` 依赖这一点。

---

## 7. 验收台与截图

`tools/audio/test.html`（Vite dev server 下打开）：

- **① 解锁 & 播放**：一键 `unlock()`，显示 BGM 就绪状态与 meta（调式/和声/渲染耗时/峰值/RMS/接缝）。
- **② 实时波形 / 电平**：`createAnalyser()` 旁路分析 master，画实时波形（显示增益 ×3）、
  RMS/峰值 dB 表、以及 BGM 预渲染 buffer 的 36s 波形（12 根小节线）。
- **③ 区域环境音**：8 个区域切换，显示分层与偶发事件名。
- **④ 合成音效 cues**：25 个按钮 + 「连播全部 cue」。
- **⑤ 角色音 & 总线**：走路/跑步/涉水/跳跃/落地 + 三路音量滑杆。
- **⑥ 离线自检**：用 `OfflineAudioContext` 逐个渲染 8 个区域（3s）与 25 个 cue（1.6s），
  统计 RMS/峰值并给出「✓ 非静音」结论（共 34 项），结果同时挂到 `window.__audioCheckResults` 供 Playwright 读取。

`node tools/audio/verify.mjs` 会产出：

| 截图 | 内容 |
| --- | --- |
| `01-testpage-idle.png` | 验收台初始页 |
| `02-testpage-unlocked.png` | 解锁 + BGM 就绪 + beach 区域 + cue 试听 |
| `03-testpage-selfcheck.png` | 离线自检表（34 项全部非静音） |
| `04-testpage-visual.png` | 波形 / 电平 / BGM 波形特写 |
| `05-bgm-waveform.png` | BGM 36s 预渲染波形 |
| `06-testpage-mobile.png` | 390×844 手机尺寸 |
| `07-game-intro.png` | 真实游戏页 intro |
| `08-game-playing.png` | 点 BEGIN 后真实游戏页（BGM/环境音运行中） |
| `report.json` | 全部机器可读结果 |

真实游戏页检查项：点 `.bc-begin` 后 `audio.ctx.state === 'running'`、`audio.unlocked === true`、
BGM `musicMode === 'buffer'` 且 `RMS > 0.05`、默认区域环境音已启动、`setRegion('beach')` 生效、
静音写 `localStorage['bjcourier.audio.muted']`、console 无音频相关 error、
所有请求里没有 `.ogg/.mp3`。

---

## 8. 调参手册

| 想改什么 | 改哪里 |
| --- | --- |
| 速度 / 小节数 / 循环长度 | `music.js` → `MUSIC.bpm / bars / loopSeconds / tailSeconds`（`tailSeconds` 要 ≥ 混响尾音 2.6s + 最后拨弦衰减）。 |
| 换调式 / 和声 | `music.js` → `MUSIC.progression`（必须用 `CHORDS` 里的名字）与 `CHORDS` 的 `root/fifth/pad`。 |
| 改旋律 | `music.js` → `MELODY`（`M()` 记法：小节、拍、音名、时值、力度；可加 `grace` 倚音）。 |
| 拨弦音色 | `karplusStrong` 的 `brightness`（越亮越"筝"）与各声部 `t60`；`makePluckBuffer` 里的平均滤波系数。 |
| pad 情绪 | `schedulePad()` 的 `levels/detune/attack/release`、`padLp.frequency`、`padVibrato` 深度。 |
| 鼓组律动 | `scheduleCycle()` 里 kick/wood/shaker 的 beat 位置、`swing` 系数、`makeKickBuffer/makeWoodBuffer/makeShakerBuffer`。 |
| Lo-fi 质感 | `buildMusicGraph()` 的 `lofi.frequency`(7.2k)、`comp` 参数、`softClipCurve(amount)`；黑胶在 `audio.js` 的 `startVinylBed()`（增益 0.011、lowpass 2600）与 `playCrackle()`。 |
| 区域响度平衡 | `audio.js` → `REGION_LEVEL`（整体）与 `buildAmbience` 里各 `noiseLayer({ gain })`（分层）。 |
| 区域事件频率 | `audio.js` → `AMBIENT_EVENTS` 的 `min/max`（秒），事件合成在 `ev*` 函数里。 |
| 某个 cue 的音色 | `audio.js` → 对应 `cueXxx(s)` 函数与 `sfxTone/sfxNoise/sfxWood/sfxPaper/sfxChime/sfxWhoosh` 参数。 |
| 总线默认音量 | `audio.js` → `DEFAULT_VOLUMES`（仅首次无 localStorage 时生效）。 |
| 实时可视化 | `tools/audio/test.html` 里 `drawScope/drawMeters/drawBgmWave`。 |

调试时最方便的方式：开 `tools/audio/test.html`，点解锁后反复点 cue/切区域，
看 ② 的波形和 ⑥ 的离线表；也可以 `audio.diagnostics()`（返回 ctx 状态、区域、
排程事件、总线、BGM meta 等）在 console 里查看。

---

## 9. 已知差距 / 留给 Lead 的收尾项

1. **旧文档/测试仍引用 ogg**（不在本次写文件范围内）：
   - `ARCHITECTURE.md` 的「资产要点 / 音频」与「已复刻的原站系统」仍写 `audio/*.ogg`；
   - `src/game/story.js:44` 注释「ambience 是 audio/ambiences/<ambience>.ogg 的文件名」已不准确
     （现在 ambience 是区域 key：beach/village/city/forest/factory/temple/waterfalls）；
   - `story.js` 的 `REGIONS.village.ambience` 仍是旧资产时代的 `'city'`，而音频侧现在已有独立的
     `'village'` 环境音（风+鸟+风铃）。建议 ui-dev/Lead 把它改成 `ambience: 'village'`
     （同时 `tools/ui/smoke.mjs` 的 `OK_AMBIENCE` 白名单要加上 `village`）；
   - `src/ui/README.md` 的 createAudio 段落仍写 `assets.loadAudio` + ogg 文件名；
   - `test/story.test.mjs` 的 “key reverse-engineered assets are present” 仍断言
     `audio/music/bgmusic-highq.ogg` 与 `audio/character/footsteps4.ogg` 存在。
     Lead 清理 `public/assets-messenger/audio` 时需要同步删掉这两项断言，否则 `npm test` 会失败。
2. **BGM 首播延迟**：`unlock()` 后离线渲染约 2.4–3.4s（本机），期间只有 unlock 的 cue 与环境音；
   真实游戏里被 loading 盖住，但如果以后希望一进游戏就有 BGM，可在 main.js 里提前调用
   `audio.preload()`（本实现支持，且不依赖用户手势）。
3. **无空间音频**：环境音与脚步目前是整体立体声/简单声像，没有按世界坐标做 3D Panner。
   `audio.setRegion` 只有区域粒度；如需要可后续在 `playFootstep` 增加位置参数。
4. **`playFile(path)` 语义变化**：从「加载 ogg 播放」改为「按路径关键词映射到合成 cue」，
   未知路径播放通用柔和提示音。现有代码没有直接调用它，不影响游戏。
5. **实时兜底路径**（无 `OfflineAudioContext` 的浏览器）已在代码里实现并做静态检查，
   但当前验收环境（Chromium）走的是离线 buffer 路径，兜底路径未在真实老浏览器上实测。
6. **音色主观**：所有参数都是在 macOS + headless Chromium 上试听/统计调的，
   不同扬声器/耳机下平衡可能还要微调（按第 8 节改即可）。

---

## 10. 对外 API 兼容清单（main.js / ui 依赖的部分）

```js
const audio = createAudio(assets);            // 兼容旧签名（assets 只用于复用其 AudioContext）
audio.unlock();                               // 用户手势后调用一次
audio.preload();                              // 可选：预渲染 BGM（不依赖手势）
audio.setRegion('beach');                     // base|beach|village|city|forest|factory|temple|waterfalls（+旧别名）
audio.playFootstep({ run });                  // 也可传 { water:true }
audio.playFootstepWater();
audio.playJump();
audio.playLand();
audio.playCue('click');                       // 25 个 cue + 未知兜底
audio.playFile(path, opts);                   // 旧路径 -> 合成 cue（不 fetch）
audio.setMuted(true); audio.toggleMute(); audio.isMuted();
audio.setBusVolume('music', 0.5); audio.getBusVolume('ambience');
audio.update(dt);                             // 环境音事件 / 黑胶爆点调度（UI 每帧已调用）
audio.dispose();
audio.ready / audio.unlocked / audio.region / audio.muted / audio.ctx
```

额外**非契约**诊断（不改变上述 API，供测试页/自动化使用）：
`musicPlaying` / `musicBuffer` / `musicMeta` / `musicMode` / `diagnostics()` / `createAnalyser()`。
模块额外导出：`CUES`（保持旧版 `Object.keys(CUES).length >= 15` 的冒烟兼容）、`AMBIENCE_KEYS`、
`AMBIENT_META`、`AMBIENT_EVENT_NAMES`、`buildAmbience`、`createNoiseBuffer`、`makeSfxSession`、`MUSIC`。
