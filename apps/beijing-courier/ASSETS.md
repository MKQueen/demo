# 素材来源清单 · Asset Provenance

本 Demo 是**技术学习/风格复刻**性质的非商业项目。参考站
[Messenger](https://messenger.abeto.co)（作者 Abeto）的版权归原作者所有。
为回答「减少照搬、增加自有资产」，v3 把角色、北京街区、投递道具、音频、UI 全部改成原创自建，
只在「渲染语言 / 小行星场景基底」上保留参考站素材用于对照学习。

## 原创（本项目自建）

| 资产 | 文件 | 说明 |
| --- | --- | --- |
| 北京邮差主角 | `src/actor/originalCourier.js` | Three.js 几何组合，13 骨程序化动画，零外部模型/动画文件 |
| 北京 NPC ×3 | `src/actor/originalNpc.js` | 遛鸟大爷 / 广场舞大妈 / 红领巾小学生 |
| 北京街区 17 件资产 | `src/world/beijing.js` | 四合院、牌楼、路牌、邮筒、二八车、石狮、老槐树、小卖部、早点铺、晾衣绳、鼓楼、天坛、中国尊、央视、鸟巢、798、城墙烽火台 |
| 北京街区 canvas 招牌 | `src/world/beijing.js` | 中文店招/路牌（使用 OFL 字体绘制） |
| 投递道具 ×5 | `src/world/items.js` | 信 / 明信片（手绘天际线）/ 便签 / 点心匣 / 黑胶 |
| BGM | `src/game/music.js` | 原创 C 宫五声 Lo-fi，53 个自写旋律音，程序化音色 |
| 环境音 + 音效 | `src/game/audio.js` | 8 区域环境音 + 25 个合成 cue，全部 WebAudio 合成 |
| 剧情 / 对话 / 清单 | `src/game/story.js`、`dialogue.js` | 原创中文五封信 |
| UI 视觉 + 图标 | `src/ui/` | DOM/CSS 手绘 UI、SVG 图标 |
| 卡通材质 / MRT 管线实现 | `src/render/toon.js`、`pipeline.js`、`materials.js` | 按参考站思路重写的代码（非拷贝） |
| 字体 | `public/fonts/` | OFL 授权：Patrick Hand、Gochi Hand、Ma Shan Zheng、Zhi Mang Xing、ZCOOL KuaiLe |

## 参考站素材（仅用于渲染对照/场景基底，版权归 Abeto）

| 资产 | 位置 | 用途 |
| --- | --- | --- |
| 小行星地形 chunk 几何 + 调色板/噪声/水面/云/叶簇 KTX2 | `public/assets-messenger/geometries`、`textures` | 星球基底与参考站渲染语言对照 |
| 碰撞网格 `hitmesh_0..4` | 同上 | 球面行走/跳跃/相机避墙 |
| 3D LUT | `textures/luts` | 调色 |
| 9 个任务 NPC 模型 | `geometries/npcs` | 五封信的任务 NPC（潜水员/厨师/花店姑娘…） |
| 开场小行星 | `geometries/intro` | 开场太阳系星球 |
| Draco/Basis 解码库 | `public/assets-messenger/{dracoworker.js,libs}` | 解码上述资产 |

已移除的参考站素材：全部音频 `.ogg`（改为原创合成）、投递道具模型（改为自建）、
角色 avatar 仅在原创主角加载失败时作为回退（默认不加载）、旧项目遗留截图与未用 LOD。

## 使用声明

- 本项目不用于商业用途；参考站素材请勿再分发/商用。
- 若需公开发布，建议替换 `public/assets-messenger/` 中参考站素材（北京街区/主角/音频已可独立使用），
  或先联系原作者取得授权。
