#!/usr/bin/env node
/**
 * capture-covers.mjs —— 从已构建的 site/ 重新抓取每个 demo 的首页封面图。
 *
 * 用途：demo 更新后重新生成 hub 卡片封面。
 * 前提：先 npm run build，site/ 已存在。输出：apps/<id>/screenshots/cover.jpg，
 *       然后重新 npm run build 才会进入 site/thumbs/。
 *
 * 用法：
 *   node scripts/capture-covers.mjs                    # 全部
 *   node scripts/capture-covers.mjs agent-lab          # 指定 demo
 *
 * 注意：
 *   - mini-opencode 是真 Agent：抓封面时会把真实后端拉起来，并**真的发一条
 *     只读任务**，等模型回答出来再截图（否则封面只有空白面板）。
 *   - RAG 观测台也是真模型：会通过本地 /api/llm 转发真的问一条推荐问题，
 *     等流式回答结束再截图（没配 Key 时退化为只截检索界面）。
 *   - 其他 demo 只做「打开页面等待稳定」的通用抓图。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startStaticServer } from './static-server.mjs';
import { startAgentBackend } from './agent-backend.mjs';
import { loadLlmProxyConfig } from './llm-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const HUB = path.join(ROOT, 'hub');
const port = 5291;

if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  console.error('✗ 未找到 site/index.html，请先运行：npm run build');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(HUB, 'demos.json'), 'utf8'));
const only = process.argv[2];
const demos = (manifest.demos || []).filter((d) => !only || d.id === only);

const WAIT = {
  'mecha-battle': 16000,
  'building-atlas': 12000,
  'cbd-digital-twin': 24000,
  'flood-sim': 14000,
  'rag-lab': 6000,
  'agent-lab': 7000,
};

// agent-lab 需要真实后端；其他 demo 用不到，但一起起来也没坏处
let agent = null;
try {
  agent = await startAgentBackend({ quiet: true });
  console.log(`mini-opencode 真实后端：${agent.url}（${agent.modelLine}）`);
} catch (error) {
  console.error(`⚠ Agent 后端没起来，agent-lab 封面会退化为空白面板：${error.message}`);
}

const proxies = agent ? [{ prefix: '/api', target: agent.url }] : [];
// RAG 观测台的封面要截「真实模型回答」，需要 /api/llm 转发
const llm = loadLlmProxyConfig({ root: ROOT });
if (llm.configured) {
  console.log(`RAG 真实模型：${llm.model}（${llm.baseUrl}）`);
} else {
  console.warn('⚠ RAG 未配置模型 Key，封面只能截检索界面（无真实回答）');
}
const { url: base, close } = await startStaticServer({
  root: SITE,
  prefix: '/',
  port,
  host: '127.0.0.1',
  quiet: true,
  proxies,
  llm,
});
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });

/**
 * agent-lab 专用：真的发一条只读任务，等真实模型跑完再截图。
 * 返回 true 表示成功拿到真实回答。
 */
async function captureAgentLab(page, demo) {
  const prompt = '先用 read 工具读 notes.md，再用 glob 列出这个沙盒目录里的文件，然后用三句话总结这份会议纪要。只读，不要修改任何文件。';
  // 封面抓图不需要卡审批：临时把权限档设为「全自动」（只影响本次进程内存）
  if (agent) {
    try {
      await fetch(`${agent.url}/api/permission`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ level: 'auto' }),
      });
    } catch {
      /* ignore */
    }
  }
  await page.waitForSelector('#input', { timeout: 15000 });
  await page.fill('#input', prompt);
  await page.click('#send-btn');

  if (!agent) return false;
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${agent.url}/api/state`, { signal: AbortSignal.timeout(3000) });
      const { state } = await res.json();
      const assistant = (state.messages || []).filter((m) => m.role === 'assistant' && m.content);
      if (!state.busy && assistant.length > 0) {
        // 等界面把最后一段流式文字画完
        await page.waitForTimeout(2500);
        return true;
      }
    } catch {
      /* 后端状态读不到就继续等 */
    }
    await page.waitForTimeout(1500);
  }
  console.warn('  ⚠ agent-lab 真实回答超时，按当前界面截图');
  return false;
}

/**
 * rag-lab 专用：等页面连上真实模型转发，点一条推荐问题，等流式回答结束再截图。
 * 返回 true 表示成功拿到真实模型回答。
 */
async function captureRagLab(page) {
  try {
    await page.waitForFunction(
      () => {
        const pill = document.querySelector('#pill-llm-text');
        return pill && /真实模型/.test(pill.textContent || '');
      },
      null,
      { timeout: 20000 },
    );
  } catch {
    console.warn('  ⚠ rag-lab 未连上真实模型，按当前界面截图');
    return false;
  }
  await page
    .waitForFunction(
      () => {
        const demo = globalThis.__RAG_DEMO__;
        return demo && demo.state.kb && (demo.state.kb.stats?.chunks || 0) > 0;
      },
      null,
      { timeout: 20000 },
    )
    .catch(() => {});
  const suggest = page.locator('.suggest[data-q]').first();
  if ((await suggest.count()) === 0) return false;
  await suggest.click();
  try {
    await page.waitForFunction(
      () => {
        const demo = globalThis.__RAG_DEMO__;
        if (!demo) return false;
        const state = demo.state;
        const messages = state.session?.messages || [];
        const last = [...messages].reverse().find((m) => m.role === 'assistant');
        return !state.session?.streaming && last && String(last.content || '').length > 20;
      },
      null,
      { timeout: 180000, polling: 500 },
    );
    await page.waitForTimeout(1200);
    return true;
  } catch {
    console.warn('  ⚠ rag-lab 真实回答超时，按当前界面截图');
    return false;
  }
}

for (const demo of demos) {
  const page = await context.newPage();
  const url = new URL(demo.href, base).href;
  console.log(`▸ ${demo.id}  ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(WAIT[demo.id] || 6000);

  if (demo.id === 'agent-lab') {
    const ok = await captureAgentLab(page, demo);
    console.log(ok ? '  ✓ 真实模型回答已生成，开始截图' : '  ⚠ 未拿到真实回答');
  } else if (demo.id === 'rag-lab') {
    const ok = await captureRagLab(page);
    console.log(ok ? '  ✓ 真实模型回答已生成，开始截图' : '  ⚠ 未拿到真实回答');
  }

  const dir = path.join(ROOT, 'apps', demo.id, 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'cover.jpg');
  await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
  console.log(`  ✓ ${path.relative(ROOT, out)}`);
  await page.close();
}

await browser.close();
await close();
if (agent) await agent.stop();
console.log('\n提示：重新运行 npm run build 后封面会进入 site/thumbs/。');
