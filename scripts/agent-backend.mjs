#!/usr/bin/env node
/**
 * ============================================================================
 * agent-backend.mjs —— 启动 mini-opencode 的「真实 Agent 后端」
 * ============================================================================
 *
 * 背景：mini-opencode 不是一堆假数据，它真的会调用模型、真的读写文件、真的执行
 * 命令。这样的 demo 必须有一个本地 Node 进程，纯静态托管做不了。
 *
 * 这个模块负责把它拉起来：
 *   1. 准备一个**演示沙盒工作区**（apps/agent-lab/.demo-workspace），
 *      Agent 只在这里读写文件 / 执行命令，不会碰项目源码；
 *   2. 找一个空闲端口（默认从 8787 往后找）；
 *   3. 用 `node src/main.ts web --port <port> --workspace <沙盒>` 启动后端；
 *   4. 等 /api/meta 就绪后返回句柄（端口、地址、停止方法）。
 *
 * 谁在用：
 *   - scripts/serve-site.mjs   本地预览合集时，站点把 /api/* 代理到它
 *   - scripts/audit-site.mjs   全站验收时，agent-lab 用真实后端跑
 *   - scripts/capture-covers.mjs 抓封面时同理
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const AGENT_APP_DIR = path.join(ROOT, 'apps', 'agent-lab');
export const DEMO_WORKSPACE = path.join(AGENT_APP_DIR, '.demo-workspace');

// ---------------------------------------------------------------------------
// 演示沙盒的种子文件
// ---------------------------------------------------------------------------
/**
 * 为什么把种子内容写在代码里，而不是放一个模板目录？
 *   种子文件少（4 个）、内容短，写在这里一眼能看全；而且「只补缺失文件」的
 *   逻辑需要用代码表达，放模板目录还得再写一套复制规则。
 *
 * 这些文件只在缺失时创建：用户在演示里让 Agent 改过的内容不会被覆盖。
 */
const SEED_FILES = {
  'README.md': `# demo-sandbox · mini-opencode 演示沙盒

这是 mini-opencode 网页面板的**真实工作区**。你在这里输入的任务会交给一个
真的 AI Agent：它会调用真实模型思考，然后用工具读文件、改文件、执行命令。

> 也就是说：**这个目录里的文件会被真的修改，命令会被真的执行。**
> 演示完想恢复原样，删掉 \`apps/agent-lab/.demo-workspace/\` 再刷新页面即可，
> 下次启动会自动重新生成种子文件。

## 里面有什么

| 文件 | 用途 |
| --- | --- |
| \`bug.js\` | 一个算错订单金额的小脚本，适合演示「读 → 改 → 跑测试」 |
| \`notes.md\` | 一份会议纪要，适合演示「总结 / 提取行动项」 |
| \`data/expenses.csv\` | 一份支出明细，适合演示「数据统计」 |
| \`AGENTS.md\` | 给 Agent 看的沙盒规则（会进系统提示词） |

## 可以试试

- 「看看 bug.js 哪里算错了，修好它，然后运行验证」
- 「总结 notes.md，把行动项整理成 TODO.md」
- 「统计 data/expenses.csv 里每个分类的支出，写个脚本算给我看」
- 「列出这个目录的文件，挑一个文件解释它是干什么的」

## 安全边界

- 工具被限制在**当前工作区**内（这是 mini-opencode 的路径安全规则）；
- 写文件 / 执行命令默认需要在右侧弹窗里点「允许」（面板顶部的权限档可调）；
- 后端只监听 127.0.0.1，不对局域网/公网开放。
`,

  'AGENTS.md': `# 沙盒规则（给 Agent 看）

这里是 mini-opencode 的演示沙盒，不是正式项目。

- 可以放心读写这里的文件；改完请用 \`node <脚本>\` 运行验证，别只说"已修复"。
- 不要安装任何第三方依赖（没有网络依赖的演示才可复现），只用 Node 内置模块。
- 回复和代码注释用中文。
- 做完一件事后用一两句话总结"改了什么、怎么验证的"。
`,

  'bug.js': `// 订单金额计算器。
// 运行方式：node bug.js
//
// 现状：最后一行会报「算错了」——因为会员折扣没有生效。
// 目标：修好 totalPrice，让脚本输出「✓ 订单金额正确」。

const orders = [
  { name: '机械键盘', price: 399, qty: 2 },
  { name: '无线鼠标', price: 129, qty: 1 },
  { name: '显示器支架', price: 259, qty: 1 },
];

const VIP_DISCOUNT = 0.85; // 会员 85 折

function totalPrice(items) {
  // TODO: 这里少算了一步，先自己手算一遍再改。
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

const subtotal = 399 * 2 + 129 + 259;
const expected = subtotal * VIP_DISCOUNT;
const actual = totalPrice(orders);

console.log('小计:', subtotal);
console.log('实际:', actual);
console.log('期望:', expected);

if (Math.abs(actual - expected) > 0.001) {
  console.error('✗ 算错了：会员折扣没生效？');
  process.exit(1);
}
console.log('✓ 订单金额正确');
`,

  'notes.md': `# 产品周会纪要 · 2026-11-04

## 结论

1. 移动端首屏加载还是太慢（3.8s），本周必须降到 2s 以内；
2. 搜索框的「无结果」状态文案要改，用户反馈太冷淡；
3. 下周三前完成新用户引导的埋点。

## 行动项

- [ ] 张伟：拆分首屏 bundle，给出体积报告（截止周五）
- [ ] 李娜：改搜索无结果文案，出 3 个版本（截止周二）
- [ ] 王强：新用户引导埋点方案 + 事件表（截止下周三）
- [ ] 全体：下周一把首页性能数据同步到周报

## 风险

- 埋点依赖数据组排期，可能顺延；
- 首屏优化涉及图片 CDN 切换，需要运维配合。
`,

  'data/expenses.csv': `日期,分类,金额,备注
2026-10-01,餐饮,86.5,团队午餐
2026-10-02,交通,24,地铁充值
2026-10-03,办公,199,机械键盘清洁套装
2026-10-05,餐饮,132,加班晚餐
2026-10-08,软件,68,图床订阅
2026-10-11,交通,58,打车去客户现场
2026-10-12,办公,45.9,白板笔和便利贴
2026-10-15,餐饮,210,部门聚餐
2026-10-18,软件,128,设计素材会员
2026-10-21,交通,36,高铁接驳
2026-10-24,办公,399,外接显示器
2026-10-28,餐饮,76,下午茶
`,

  'package.json': JSON.stringify(
    {
      name: 'mini-opencode-demo-sandbox',
      version: '1.0.0',
      private: true,
      description: 'mini-opencode 演示沙盒（被 Agent 真实读写）',
      scripts: {
        start: 'node bug.js',
        test: 'node bug.js',
      },
    },
    null,
    2,
  ),
};

/**
 * 创建 / 补全演示沙盒。
 * 只补缺失文件：用户在演示过程中改过的内容不会被覆盖。
 */
export function ensureDemoWorkspace(dir = DEMO_WORKSPACE) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(SEED_FILES)) {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, content, 'utf8');
  }
  return dir;
}

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 让系统分配一个空闲端口（listen 0 再关掉）。 */
async function findFreePort(host) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, host, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitUntilReady(url, child, logs, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Agent 后端启动失败（退出码 ${child.exitCode}）\n${logs.join('').trim()}`);
    }
    try {
      const res = await fetch(`${url}/api/meta`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.tools)) return data;
      }
    } catch {
      /* 还没起来，继续等 */
    }
    await sleep(250);
  }
  throw new Error(`Agent 后端 ${timeoutMs}ms 内没有就绪\n${logs.join('').trim()}`);
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------
/**
 * @param {{
 *   host?: string,
 *   port?: number,
 *   workspace?: string,
 *   quiet?: boolean,
 * }} options
 * @returns {Promise<{
 *   host: string, port: number, url: string,
 *   workspace: string, child: import('node:child_process').ChildProcess,
 *   meta: Record<string, unknown>, modelLine: string,
 *   stop: () => Promise<void>,
 * }>}
 */
export async function startAgentBackend(options = {}) {
  const host = options.host || '127.0.0.1';
  const workspace = ensureDemoWorkspace(options.workspace || DEMO_WORKSPACE);
  const port = options.port || (await findFreePort(host));
  const quiet = Boolean(options.quiet);

  fs.mkdirSync(AGENT_APP_DIR, { recursive: true });

  // 启动目录 = apps/agent-lab：.env、会话记录都在这边；
  // 工作区 = 沙盒：Agent 的文件/命令工具只在这里活动。
  const child = spawn(
    process.execPath,
    ['src/main.ts', 'web', '--host', host, '--port', String(port), '--workspace', workspace],
    {
      cwd: AGENT_APP_DIR,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  const logs = [];
  const collect = (chunk) => {
    logs.push(String(chunk));
    if (logs.length > 40) logs.shift();
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', (chunk) => {
    collect(chunk);
    if (!quiet) process.stderr.write(`[agent] ${chunk}`);
  });

  const url = `http://${host}:${port}`;
  let meta;
  try {
    meta = await waitUntilReady(url, child, logs, 45000);
  } catch (error) {
    child.kill('SIGKILL');
    throw error;
  }

  // 就绪后读一次运行状态，用来在终端里如实显示"模型 / 工作区 / key 是否配好"
  let modelLine = '(未知)';
  let configWarning = null;
  try {
    const res = await fetch(`${url}/api/state`, { signal: AbortSignal.timeout(3000) });
    const payload = await res.json();
    const config = (payload && payload.state && payload.state.config) || {};
    modelLine = config.mock ? 'mock 假模型（离线）' : `${config.model}（真实模型）`;
    if (!config.mock && !config.hasApiKey) {
      configWarning =
        '还没有配置 API key：在 apps/agent-lab/.env 里填 MINI_API_KEY / OPENAI_BASE_URL / MINI_MODEL，' +
        '或直接在面板「模型配置」里填。';
    } else if (config.providerError) {
      configWarning = `模型配置有问题：${config.providerError}`;
    }
  } catch {
    /* 状态读不到不影响启动，页面自己会显示 */
  }

  let stopped = false;
  async function stop() {
    if (stopped) return;
    stopped = true;
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      const timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* ignore */
        }
        resolve();
      }, 4000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      try {
        child.kill('SIGTERM');
      } catch {
        clearTimeout(timer);
        resolve();
      }
    });
  }

  return { host, port, url, workspace, child, meta, modelLine, configWarning, stop };
}
