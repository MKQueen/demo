# Credits & Licenses

本目录是「钢铁黎明 · STEEL DAWN」网页版（环太平洋风格机甲 Boss 战）的纯静态移植。
源项目同时包含一个基于 EVA Battlefields 私有素材的网页版本；**本移植已整体剔除 EVA 版代码、
模型、音频与导入工具**，构建产物中不包含任何 EVA 派生资源，也不含后台推理服务。

## 角色模型：Jaeger / Kaiju（许可未核实，重要）

- **来源项目**：https://github.com/hihicode-weeee/pacific-rim-larp
- Jaeger 原始文件：https://raw.githubusercontent.com/hihicode-weeee/pacific-rim-larp/main/src/assets/jaeger_combat.glb
- Kaiju 原始文件：https://raw.githubusercontent.com/hihicode-weeee/pacific-rim-larp/main/src/assets/kaiju_combat.glb
- **本仓库只随包分发运行时派生模型**：
  - `public/models/pacific/JaegerMotion.glb`
  - `public/models/pacific/KaijuMotion.glb`
  - 两份基础模型 `Jaeger.glb` / `Kaiju.glb` 未随本移植分发（运行时未引用）。
- 两个 GLB 均含 41 关节骨骼、贴图以及待机 / 行走 / 奔跑 / 挥砍 / 受击等动画；本作在其上
  重新 baked 了拳击、防御、受击、失衡、倒地、喷气与怪兽爪击 / 扫尾 / 吐息等动作，并做了
  朝向、20m / 25m 缩放、PBR 材质、脚底贴地等适配（见 `src/world/combatAnimations.js`、
  `importedCharacters.js`、`locomotion.js`）。
- 模型内的材质元数据带有 Tripo 标识；上游仓库并未单独声明模型许可证。
  **公开下载不代表获得自由使用授权。本作不对其许可证作任何扩张声明，也不声称是电影官方素材。**
  对外公开发布（尤其商用）前，请自行联系原作者 / 核实授权，或替换为自有许可模型。
- 机甲的三套装备改装（先锋 / 堡垒 / 游雉）共用同一具 Jaeger 底盘，不是三台独立来源的模型，
  更不是 Gipsy Danger / Striker Eureka / Crimson Typhoon；肩甲、发射管、稳定翼、加速环与
  硬光武器均为本项目在 `src/world/mechLoadout.js` / `combatVFX.js` 中生成的原创造型。

## MediaPipe Tasks Vision（体感输入）

- **Package / License**：`@mediapipe/tasks-vision` 1.1.1，Apache License 2.0 —
  https://github.com/google-ai-edge/mediapipe
- **随包分发的本地运行时**（无需联网，画面不上传）：
  - `public/mediapipe/vision_bundle.js`（经典浏览器 bundle，由
    `scripts/sync-vision-worker.mjs` 从 npm 包同步）
  - `public/mediapipe/wasm/vision_wasm_internal.{js,wasm}`（SIMD）
  - `public/mediapipe/wasm/vision_wasm_nosimd_internal.{js,wasm}`（无 SIMD 回退）
  - `public/mediapipe/pose_landmarker_full.task`（Full 姿态模型，33 landmarks）
  - `public/mediapipe/person_detector.tflite`（EfficientDet Lite0 float32，人物锁定）
- `public/mediapipe/inference-worker.js` 是本项目编写的 worker 外壳；推理在浏览器 Web
  Worker 内以 CPU delegate 运行，摄像头帧仅在本地内存中处理，不上传、不落盘。
- 未随包分发：`pose_landmarker_lite.task`（仅源项目 benchmark 脚本使用）、
  `vision_wasm_module_internal.*`（仅 ESM 引入方式使用，本作走经典 worker，不加载）。

## 图形与特效依赖

- **three.js**：MIT — https://github.com/mrdoob/three.js
- **three.quarks 0.17.1 / quarks.core 0.17.1**：MIT（Forrest Sun）—
  https://github.com/Alchemist0823/three.quarks
  运行时许可文本随包分发于 `public/licenses/three.quarks-MIT.txt`、
  `public/licenses/quarks.core-MIT.txt`；用于 `src/world/quarksImpacts.js` 的接触火花 /
  碎屑 / 尘土批次。
- **Kenney Particle Pack 1.1**：CC0 — https://kenney.nl/assets/particle-pack
  许可文本保留在 `public/textures/kenney-particles/License.txt`；本作使用 `spark_05.png`、
  `smoke_05.png`（`dirt_01.png` 保留备用）。均为通用可复用贴图，不是特摄 / 电影官方素材。
- **Vite 7**：MIT — https://github.com/vitejs/vite（开发服务器与构建）

## 场景贴图与植被（Poly Haven，CC0）

- Concrete Wall 006 — https://polyhaven.com/a/concrete_wall_006
  `concrete-neutral.jpg` 为其 diffuse 的去饱和 / 调亮派生，用于楼体外立面。
- Asphalt 02 — https://polyhaven.com/a/asphalt_02
  1K diffuse + OpenGL normal，用于道路地面。
- Tree Small 02 — https://polyhaven.com/a/tree_small_02
  1K glTF 降面派生为 `public/models/environment/tree.glb`（城市行道树实例）。
- Kloppenheim 06 Pure Sky — https://polyhaven.com/a/kloppenheim_06_puresky
  1K HDR 存于 `public/textures/polyhaven/daylight.hdr`，启动时转为户外反射环境。
- 许可：CC0 — https://polyhaven.com/license

## 音频

**本移植不包含任何外部音频素材。** 城市底噪、警报、巨兽咆哮、机甲脚步、冲击、等离子炮、
天基炮与战斗音乐全部由 `src/audio.js` 用 Web Audio 实时合成。
源项目中从 EVA Battlefields APK 提取的音效 / BGM 已随 EVA 版一并删除。

## 场景、特效与动画

- 城市、行人、车流、UI、喷流、硬光刃、攻击轨迹等均由 `src/` 程序化生成或本项目原创。
- 环境反射优先使用上面的 Poly Haven HDR；失败时回退 three.js `RoomEnvironment`（MIT）。
- 可编辑 Blender 动画工程（`assets/animation/*.blend`）与原生工程、旧版本归档保留在源项目，
  本移植仅分发运行所需的 GLB 派生资产与静态站点。
- `docs/` 保留 STEEL DAWN 的历史开发记录（版本演进、动作与战斗验收说明），其中的脚本路径
  与截图引用属于源项目资料，本移植未随包分发这些开发脚本与截图。

## 已剔除 / 未随包分发的内容

- **EVA Battlefields 私有素材**：`public/models/eva/`、EVA 版音频、`src/eva/`、
  `tools/eva-import/`、相关输出截图。原项目明确写明这些派生资源权利受限、不可公开发布，
  因此本移植完全移除，构建产物中不含任何 EVA 资产。
- **未被代码引用的旧参考模型**：`Xbot.glb`、`Godzilla.glb`、`RobotExpressive.glb`、
  `Demon.gltf`，以及未被运行时引用的 `Jaeger.glb` / `Kaiju.glb` 基础模型。
- 源项目的 `native/`、`archive/`、`output/`、`assets/animation/`、开发截图与浏览器 smoke 脚本
  均不参与本静态站点构建。
