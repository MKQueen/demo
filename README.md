# DEMO LAB · 交互实验室

六个可直接上手玩的 Demo 合集：统一构建进一个站点，**六个 Demo 的构建产物都是纯静态资源**，
可上传到任意静态托管。其中 **RAG 观测台的回答由真实大模型实时生成**（知识库与检索管线全部在
浏览器里跑，本地预览服务器只做一层模型转发），**mini-opencode 是连接本机后端的真实 Agent**
（模型真的回复、工具真的读写文件 / 执行命令）。由 `npm run serve` 一键同时拉起站点、
Agent 后端与 RAG 的模型转发。

| Demo | 内容 | 技术 | 入口 |
| --- | --- | --- | --- |
| **钢铁黎明** STEEL DAWN | 环太平洋风格 3D 机甲 Boss 战，键盘 / 摄像头体感双操作 | Three.js · Rapier3D · MediaPipe | `apps/mecha-battle` |
| **富华大厦** 建筑数字档案 | 六座一庭的建筑外观重建 + 楼层分层 / 逐层平面 + 东四十条街区语境（OSM 周边白模 / 路网 / 地标 / 昼夜三态） | Three.js · GLB · OSM | `apps/building-atlas` |
| **北京数字孪生** BEIJING DIGITAL TWIN | 16 个行政区逐区探索：每区独立边界 / 相机 / 地标 / POI；中心城区 86,706 实例化体块 + 国贸 CBD + 6 个免费地标 | CesiumJS · Vue 3 · TypeScript | `apps/cbd-digital-twin` |
| **潮线 TIDELINE** 3D 动态水淹模拟 | 程序化 DEM 河谷 + 1067 栋本地 3D Tiles 滨海城市（老城/西城/北城/滨海新区/CBD）+ 地形框选蓄水区 + ShaderToy「Seascape」移植的屏幕空间水面；滑块实时调节水位并统计淹没建筑 / 面积 | CesiumJS · Vue 3 · WebGL Shader | `apps/flood-sim` |
| **RAG 观测台** | 检索 → 融合 → Prompt → 流式回答全链路可视化：8 篇知识库、48 块切块、哈希向量 + BM25 + RRF、PCA、引用解析全在浏览器内运行，回答由**真实大模型**流式生成（本地服务器只做 CORS 绕行 + Key 注入） | 原生 JS · 哈希向量 + BM25 + RRF · 真实模型转发 | `apps/rag-lab` |
| **mini-opencode** Agent 面板 | **真实 AI Agent**：真模型、真工具、真权限审批、真会话轨迹；安静克制的中性浅色界面，实时可观察每一步 | Node 24 TS（原项目后端）· 原生 JS 前端 · SSE | `apps/agent-lab` |

首页：`hub/`（纯静态，无构建依赖）。

---

## 怎么打开（先看这里）

六个 demo 的**构建产物都是纯静态的**（`site/` 里的资源不依赖 Node）；但其中 **RAG 观测台的
回答生成需要本地模型转发**（检索、切块、Prompt 拼装仍然全在浏览器内），`mini-opencode` 则需要
**本地真实 Agent 后端**。这两层服务都由 `npm run serve` / `START.command` 一并拉起。
无论哪种，都**不能直接双击 `site/index.html` 或 `apps/*/index.html`**：浏览器会以 `file://` 协议
拦截 ES Module 和模型加载，表现为页面空白。正确打开方式：

1. **双击项目根目录的 `START.command`（推荐）**：自动启动本地服务、**同时拉起 mini-opencode 的真实
   Agent 后端与 RAG 观测台的模型转发**，并打开浏览器，地址 `http://127.0.0.1:5180/`；关闭弹出的
   终端窗口即停止预览。
2. 或终端执行 `npm run serve`，然后浏览器打开 `http://127.0.0.1:5180/`。
3. 正式对外展示：把 `site/` 上传到任意静态托管即可 —— 其中前四个 demo 完全照常运行；RAG 观测台
   的检索可视化照常可看，但回答生成会显示「未连接」（要展示真实生成请在本机用 `npm run serve`）；
   `mini-opencode` 需要本机后端（详见下文「部署」里的两个「真实性边界」）。

> 打开是空白页时先排查：① 是不是直接双击了 html 文件（需换成本地服务）；② 本地预览服务是否在运行；③ `site/` 是否完整（执行 `npm run build`，构建输出应包含 6 个 demo）。

---

## 快速开始

```bash
# 0) 根目录：安装构建/验收脚本依赖（Playwright）
npm install

# 1) 每个 demo 安装依赖（首次；已有 node_modules 的会跳过）
npm run install:all

# 2) 构建全部 demo 并拼装 site/
npm run build

# 3) 本地预览（静态站 + 真实 Agent 后端 + RAG 真实模型转发）
npm run serve          # → http://127.0.0.1:5180/（自动启动 mini-opencode 后端并代理 /api，
                       #    同时为 RAG 观测台提供 /api/llm 模型转发）
#    只想看纯静态站：npm run serve -- --static（Agent / RAG 都会显示未连接）
#    只关闭 RAG 模型转发：npm run serve -- --no-llm

# 4) 打包上传
npm run zip            # → site.zip
```

> mini-opencode 的真实后端由 `npm run serve` 自动启动（本机随机空闲端口，只监听 127.0.0.1），
> Agent 只在演示沙盒 `apps/agent-lab/.demo-workspace/` 里读写文件 / 执行命令。
> 模型 key 配置见 `apps/agent-lab/.env`（或面板右上角「模型配置」）。
>
> RAG 观测台的真实模型配置见 `apps/rag-lab/.env`（`DEEPSEEK_API_KEY` / `OPENAI_BASE_URL` /
> `RAG_MODEL`），也可直接复用 `apps/agent-lab/.env` 的同一份网关配置；key 只在本地 Node 进程里，
> 不进入 `site/` 产物，也不会发给浏览器。
>
> 只重跑拼装、不重新构建 demo：`npm run build:fast`
> 只构建部分 demo：`node scripts/build-all.mjs --only rag-lab,agent-lab`
> 全站自动验收（404 / console error / 返回入口 / 封面，含真实 Agent 后端）：`npm run audit`
> 真实 Agent 专项验收（连后端 → 发任务 → 等真实模型回答）：先 `npm run serve`，另一个终端 `npm run verify:agent`
> RAG 真实模型专项验收（检索管线 → 真实模型流式回答 → 引用）：先 `npm run serve`，另一个终端 `npm run verify:rag`

## 预览

`npm run serve` 后打开 <http://127.0.0.1:5180/>。六个 demo 的实机截图在
`screenshots/preview/`（合集：`00-collage.jpg`，首页：`01-hub-hero.jpg`、`02-hub-work.jpg`）。

当前构建产物大小以 `npm run build` 末尾输出为准（新增的 CBD 数字孪生约 19 MB，其中 8.8 MB 是 Cesium 运行时资源）。
如果托管平台限制体积，可参考 `apps/mecha-battle/README.md` 中「体感模型」一节按需精简钢铁黎明的体感模型后重新构建。

## 目录结构

```
.
├── hub/                    # 合集首页（纯静态：index.html / css / js / demos.json / favicon）
├── apps/                   # 六个独立 demo（各自 package.json，互不干扰）
│   ├── mecha-battle/       #   钢铁黎明：Vite + Three.js
│   ├── building-atlas/     #   富华大厦：Vite + Three.js，楼层分层 + 东四十条街区语境（OSM 白模）
│   ├── cbd-digital-twin/   #   北京数字孪生：Vite + Vue 3 + CesiumJS（16,432 km² + 中心城区 + CBD）
│   ├── rag-lab/            #   RAG 观测台：浏览器内检索管线 + 真实模型转发（零 npm 依赖）
│   └── agent-lab/          #   mini-opencode：真实 Agent 后端 + 可观测面板（本地真跑）
├── scripts/
│   ├── build-all.mjs       #   构建 + 拼装 site/（注入返回入口、复制封面）
│   ├── serve-site.mjs      #   site/ 本地预览（Agent 后端 + /api 代理 + /api/llm 模型转发）
│   ├── llm-config.mjs      #   RAG 模型转发配置（读取 .env、注入 Key，绝不下发前端）
│   ├── agent-backend.mjs   #   mini-opencode 真实后端的启动/沙盒/健康检查
│   ├── serve-app.mjs       #   单 demo 子路径预览（--llm 启用 RAG 模型转发）
│   ├── audit-site.mjs      #   全站 headless 验收（连真实后端）
│   ├── capture-covers.mjs  #   重新抓取首页封面
│   ├── zip-site.mjs        #   打包 site.zip
│   └── static-server.mjs   #   零依赖静态服务（支持 /api 反向代理与 /api/llm 转发，SSE 不缓冲）
├── screenshots/
│   ├── preview/            #   合集 / 各 demo 实机截图（对外展示可用）
│   └── audit/              #   audit-site.mjs / verify:rag 生成的验收截图
├── site/                   # 构建产物（gitignore，一次上传的目录）
└── site.zip                # 打包产物（gitignore）
```

站点最终结构：

```
site/
├── index.html              # 合集首页
├── demos/<id>/             # 六个 demo，各自独立、相对路径资源
├── thumbs/<id>.jpg         # 首页封面
└── build-info.json
```

本地 `npm run serve` 时，静态服务还会把同源的 `/api/*` 反向代理到真实 Agent 后端
（SSE 流式透传），所以 `/demos/agent-lab/` 页面里看到的一切都是真的；同一进程还会把
`/api/llm/*` 转发给真实模型网关（只注入 Key、绕开模型网关的 CORS 限制、原样透传 SSE），
`/demos/rag-lab/` 的回答因此是真实模型实时生成的。

## 子路径部署说明

每个 demo 都按 `base: './'`（或等价相对路径）构建，因此可以放在**任意子目录**：

```
https://your-domain.com/                  ← 部署 site/ 内容
https://your-domain.com/demos/mecha-battle/
```

本地提前验证嵌套路径：

```bash
node scripts/serve-app.mjs apps/mecha-battle/dist /demos/mecha-battle 5281
# → http://127.0.0.1:5281/demos/mecha-battle/

# RAG 观测台：加 --llm 才启用 /api/llm 真实模型转发（不加则页面显示「未连接」）
node scripts/serve-app.mjs apps/rag-lab/dist /demos/rag-lab 5283 --llm
# → http://127.0.0.1:5283/demos/rag-lab/
```

## 部署

`npm run build` 后把 `site/` 整个目录上传即可。**六个 demo 的构建产物都是纯静态资源，不需要 Node、
数据库或任何重写规则**；但有两个 Demo 要完整跑起来依赖本机服务，对外展示时请如实说明：

- **RAG 观测台**：知识库、检索管线、向量空间、召回、Prompt、评测全部在浏览器内，纯静态托管照常可看；
  但回答生成依赖本地预览服务器的 `/api/llm` 转发，纯静态托管时顶栏显示「未连接」、聊天发送被禁用，
  **不会用假答案糊弄**（见下面「RAG 观测台的真实性边界」）；
- **mini-opencode**：需要本机真实 Agent 后端（见下面「mini-opencode 的真实性边界」）。

托管方式（把 `site/` 内容作为静态站点根目录即可）：

- **对象存储 / OSS / S3**：把 `site/` 内容作为静态网站根目录；
- **Nginx / Apache**：`root` 指向 `site/`；
- **Netlify / Vercel / Cloudflare Pages**：发布目录填 `site`，无需构建命令（已构建好）；
- **GitHub Pages**：见下一节，仓库已内置自动部署工作流。

### 部署到 GitHub Pages（推荐，已内置工作流）

仓库已经包含 `.github/workflows/deploy-pages.yml`：推送到 `main` 后，GitHub Actions 会自动构建
6 个 demo、拼装 `site/` 并发布到 GitHub Pages，**不需要提交 `site/` 或 `node_modules`**。

首次部署步骤：

1. 在 GitHub 创建仓库（**Public**；私有仓库使用 Pages 需要 GitHub Pro）。本仓库的 origin 已配置为
   `https://github.com/MKQueen/demo.git`，如果仓库名/用户名不同，用
   `git remote set-url origin <你的仓库地址>` 改一下。
2. 首次推送（HTTPS 会要求输入 GitHub 用户名，密码位置填 **Personal Access Token**；
   也可以改用 SSH remote）：
   ```bash
   git push -u origin main
   ```
3. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**（只需设置一次）。
4. 到 **Actions** 页签，等待 `Deploy static site to GitHub Pages` 跑完（首次要安装依赖 + 构建，约 5–8 分钟），
   然后访问：`https://<你的用户名>.github.io/<仓库名>/`。
5. 之后每次 `git push` 都会自动重新构建部署。

> **备用方案（不用 Actions / 想用分支部署）**：
> ```bash
> npm run deploy:gh-pages            # 构建后把 site/ 强推到 gh-pages 分支（单提交，不累积历史）
> ```
> 然后在 Settings → Pages → Source 选择 `Deploy from a branch` → `gh-pages / (root)`。
> 这条命令会推送约 160MB 的构建产物，首次推送需要 GitHub 认证。

> **注意**：仓库体积主要来自 3D 模型与体感推理模型（约 150MB），首次 `git push` 会稍慢；
> 构建产物 `site/`、`node_modules`、`.env` 都已在 `.gitignore` 中，不会被提交。

注意事项：

1. 摄像头体感（钢铁黎明）需要 **HTTPS 或 localhost**，这是浏览器安全策略要求；静态托管默认 HTTPS，正常可用。
2. 建议服务器开启 `.glb` / `.wasm` / `.ogg` 的 MIME 类型（`model/gltf-binary`、`application/wasm`、`audio/ogg`），多数现代静态托管已内置。
3. 大文件较多，上传前可看 `npm run build` 末尾的体积汇总；如果托管平台有单文件/总大小限制，可先剔除钢铁黎明的体感模型或建筑参考图后重新构建。

### RAG 观测台的真实性边界（务必如实说明）

RAG 观测台**不是录播**：8 篇客服知识库、切块（48 块）、哈希向量、BM25、RRF、PCA、Prompt 拼装、
引用解析全部在浏览器内真实运行，回答由真实大模型流式生成。之所以还需要本地服务，是这两个原因：

- 模型网关（OpenAI 兼容接口）通常不允许浏览器跨域直连：`OPTIONS` 预检被拒、没有
  `Access-Control-Allow-Origin`；
- API Key 不能进入前端产物，更不能发给浏览器。

所以本地预览服务器（`scripts/serve-site.mjs`）提供一层**极薄的转发**
`POST /api/llm/chat/completions`：只注入 `Authorization`、绕开 CORS、原样透传 SSE；
它**不是 RAG 后端**——检索与 Prompt 都不在服务端。具体表现：

- **本地演示（推荐）**：`npm run serve` 自动启用模型转发，页面顶栏显示「真实模型」与模型名，
  回答是本次实时生成的真实回答，带 `[n]` 引用角标与真实 token 用量；
- **纯静态托管（只上传 site/）**：知识库、检索、向量空间、召回、Prompt、评测这些本地功能照常可用，
  但顶栏显示「未连接」、聊天发送被禁用并提示在项目根目录运行 `npm run serve`——**不会生成假答案**；
- **模型配置**：`apps/rag-lab/.env`（`DEEPSEEK_API_KEY` / `OPENAI_BASE_URL` / `RAG_MODEL`），
  或直接复用 `apps/agent-lab/.env` 的同一份网关配置；key 只在本地 Node 进程里，不进入 `site/` 产物；
- **检索是真实算法，但不是语义 embedding**：哈希向量 + BM25 + RRF（演示环境没有可用的 embedding
  API），口语化、同义词主要靠 BM25 兜底；评测数字只代表内置评测集上的方向性回归。

### mini-opencode 的真实性边界（务必如实说明）

mini-opencode 面板不是回放：它真的会调用模型、读写文件、执行命令。这些能力只能发生在本机
Node 进程里，纯静态托管做不到。所以：

- **本地演示（推荐）**：`npm run serve` 会同时启动站点和真实 Agent 后端，并把 `/api/*`
  同源代理到后端，页面里的一切（模型回复、工具执行、权限审批、会话落盘）都是真的；
- **只上传 site/ 到静态托管（含 GitHub Pages）**：前四个 demo（机甲 / 建筑 / 北京数字孪生 / 潮线水淹）
  完全照常运行，RAG 观测台的检索可视化也能看（但没有模型生成）；
  `mini-opencode` 页面会显示「未连接到真实 Agent 后端」，并提示在本地执行 `npm run serve` —— 不会用假数据冒充；
- **公网部署 mini-opencode**：后端默认只监听 `127.0.0.1` 且没有鉴权，**不要直接暴露到公网**；
  如确需公网演示，请自行加反向代理 + 鉴权 + 沙箱，并明确告知访客命令会在后端真实执行。

真实后端的模型配置在 `apps/agent-lab/.env`（`OPENAI_BASE_URL` / `MINI_API_KEY` / `MINI_MODEL`，
已被 gitignore 忽略，不会进 `site.zip`）。Agent 的工作区默认是隔离的演示沙盒
`apps/agent-lab/.demo-workspace/`，删掉即可重置。

## 各 demo 独立开发

每个 demo 都是普通前端项目，可单独开发、单独构建：

```bash
cd apps/mecha-battle   && npm run dev      # Vite 开发服务器
cd apps/building-atlas && npm run dev
cd apps/cbd-digital-twin && npm run dev    # → http://127.0.0.1:5185/
cd apps/rag-lab        && npm start        # 服务器模式（真实模型；未配置 Key 时明确提示未连接）
cd apps/agent-lab      && npm run web      # 真实 Agent 网页面板（默认 8787，直连模型）
```

各 demo 的构建方式、功能边界与已知限制写在各自 `apps/<id>/README.md`。

## 关于真实性与精度的边界（请对外展示时如实说明）

- **钢铁黎明**：全部本地运行；体感推理使用 MediaPipe，在浏览器内完成，摄像头画面不上传。
- **富华大厦**：建筑外观为影像估算重建；楼层分层与平面布局是按楼高/窗列推算的**示意数据**，非测绘/BIM。周边街区白模、路网与地标来自 OpenStreetMap（ODbL），高度按 OSM `height` / 层数 / 类型默认值估算，富华地块内建筑已挖空；街区语境仅表达空间关系，非地理配准测绘成果。
- **北京数字孪生**：北京边界/区界来自 DataV（近似边界），中心城区体块与道路来自 OpenStreetMap（ODbL），卫星底图来自 EOX Sentinel-2（CC BY 4.0）；6 个免费地标来自 3D Warehouse（GML，仅建议本地/内部演示）。高度多为估算，非测绘/BIM/官方模型。
- **RAG 观测台**：检索是浏览器内真实可复现的算法（哈希向量 + BM25 + RRF，**不是语义 embedding**，
  演示环境没有可用的 embedding API）；生成是真实大模型实时流式生成。纯静态托管时没有模型生成，
  页面明确显示「未连接」，不会用假答案糊弄。
- **mini-opencode**：**不是回放**。面板连接本机真实后端：真实模型（OpenAI 兼容接口）+ 真实工具执行
  （read/write/edit/bash…）+ 真实权限审批 + 真实会话落盘/导出。静态托管无法执行 Node 工具，
  因此单独部署 dist 时面板会明确显示「未连接到真实 Agent 后端」并给出启动方法，不会伪造数据。

## 素材与内容权利（对外公开发布前务必确认）

- **钢铁黎明**：机甲/巨兽模型来自开源项目 `pacific-rim-larp` 的模型转换，许可证未核实，且与《环太平洋》IP 相关；本项目**不主张可公开再分发**，对外展示前请自行确认素材权利或替换为自有素材。EVA 私有素材已从合集中剔除，未包含任何商业游戏提取资源。
- **富华大厦**：模型依据用户提供的 10 张参考图重建；参考图含第三方水印，公开发布前请确认图片使用权。街区数据来自 OpenStreetMap，遵循 ODbL 1.0，页面 footer、重建说明与 README 均保留 `© OpenStreetMap contributors` 署名。
- **北京数字孪生**：OSM 数据遵循 ODbL 1.0，需保留 `© OpenStreetMap contributors` 署名；卫星底图需保留 EOX/Sentinel-2 署名；3D Warehouse 模型受 GML 限制，公开部署前需替换或取得 Trimble 许可，详见 `apps/cbd-digital-twin/docs/landmark-models.md`。
- **RAG 观测台 / mini-opencode**：演示数据与知识库为虚构或教学用途，无真实客户信息。

## 常见问题

**Q：`npm run build` 报找不到 node_modules？**
先执行 `npm run install:all`（需要网络）；或进入对应 `apps/<id>` 单独 `npm install`。

**Q：首页封面不显示？**
`apps/<id>/screenshots/cover.jpg` 缺失时首页会用渐变占位。重新跑 `node scripts/audit-site.mjs` 检查，或用 `node scripts/capture-covers.mjs` 重新抓图后 `npm run build`。

**Q：Playwright 报浏览器未安装？**
本项目锁定 `playwright@1.59.1` 以复用本机浏览器缓存；换机器后如缺失，执行 `npx playwright install chromium`。

**Q：RAG 观测台顶栏显示「未连接」、聊天发不出去？**
说明当前没有可用的真实模型转发：确认是在项目根目录用 `npm run serve`（或 `START.command`）打开的，
而不是直接打开静态托管的 `site/`；然后在 `apps/rag-lab/.env` 填 `DEEPSEEK_API_KEY` /
`OPENAI_BASE_URL` / `RAG_MODEL`（或复用 `apps/agent-lab/.env`），重启预览即可。用
`npm run serve -- --static` 或 `--no-llm` 启动时是刻意断开模型转发，页面显示「未连接」属预期，
用于验收「没有模型时不会伪造回答」。

**Q：把 site/ 传到静态托管后，RAG 观测台还能用吗？**
知识库、检索、向量空间、召回、Prompt、评测都能看；但回答生成依赖本地模型转发，静态托管下会显示
「未连接」且不生成答案。要对外展示真实生成，请在本机用 `npm run serve` 演示。

**Q：北京数字孪生看着有点卡？**
该 demo 已内置自适应画质：顶栏「画质」默认 `自动`，会按实测帧率自动降低渲染分辨率（0.55–1.0），也可以在 `自动 / 高 / 中 / 低` 间手动切换（快捷键 `Q`），选择会记住。仍卡就切「中」或「低」；另外建议用 Chrome/Safari 等支持硬件加速的浏览器，远程桌面/软件渲染下 Cesium 场景会明显变慢。

**Q：我想再加一个 demo？**
1. 源码放到 `apps/<新 id>/`，保证 `npm run build` 输出 `dist/index.html` 且资源为相对路径；
2. 在 `hub/demos.json` 的 `demos` 数组加一项（`id / name / en / kicker / tagline / description / tags / highlights / accent / cover / href / cta`）；
3. 可选：放一张 `apps/<id>/screenshots/cover.jpg`；
4. `npm run build`。
