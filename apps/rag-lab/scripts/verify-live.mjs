#!/usr/bin/env node
/**
 * ============================================================================
 * verify-live.mjs —— 验收「RAG 观测台 = 浏览器本地检索 + 真实大模型生成」
 * ============================================================================
 *
 * 以前它是静态离线版（抽取式答案/预录回放），验收只要看渲染；
 * 现在必须确认：
 *   1. 页面连上了本地预览服务器的真实模型转发（/api/llm），顶栏显示「真实模型」；
 *   2. 知识库与检索管线仍然完全在浏览器里跑（chunks > 0、有 5 段检索步骤）；
 *   3. 推荐问题发出去，能等到真实模型流式回答（不是离线兜底），且带引用角标；
 *   4. 页面/代码里不应再出现「离线演示 / 录制回放 / 预录」这类假数据文案；
 *   5. 断开模型转发时（--expect disconnected），页面明确显示「未连接真实模型」，
 *      不会伪造答案。
 *
 * 前提：先在项目根目录 `npm run serve`（会同时启动 Agent 后端与 /api/llm 转发）。
 *
 * 用法：
 *   node apps/rag-lab/scripts/verify-live.mjs                    # 默认 5180 站点
 *   node apps/rag-lab/scripts/verify-live.mjs --url http://127.0.0.1:5283/demos/rag-lab/
 *   node apps/rag-lab/scripts/verify-live.mjs --shot             # 额外截图
 *   node apps/rag-lab/scripts/verify-live.mjs --expect disconnected --url <无 /api/llm 的静态预览>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHOT_DIR = path.join(ROOT, 'screenshots', 'audit');

const argv = process.argv.slice(2);
const wantShot = argv.includes('--shot');
const urlArgIndex = argv.indexOf('--url');
const target =
  (urlArgIndex >= 0 ? argv[urlArgIndex + 1] : '') || 'http://127.0.0.1:5180/demos/rag-lab/';
const expectArgIndex = argv.indexOf('--expect');
const expect = (expectArgIndex >= 0 ? argv[expectArgIndex + 1] : '') || 'llm';

const failures = [];
const consoleErrors = [];
const note = (msg) => console.log(`  · ${msg}`);

function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? `：${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? `：${detail}` : ''}`);
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (error) => consoleErrors.push('pageerror: ' + error.message));
page.on('requestfailed', (req) => {
  const errorText = req.failure()?.errorText || 'failed';
  if (!errorText.includes('ERR_ABORTED')) consoleErrors.push(`requestfailed: ${req.url()} ${errorText}`);
});

/** 读取页面调试状态（app.js 暴露的 __RAG_DEMO__） */
const demoState = () =>
  page.evaluate(() => {
    const demo = globalThis.__RAG_DEMO__;
    if (!demo) return null;
    const state = demo.state;
    return {
      backend: state.backend?.status,
      health: state.backend?.health || null,
      kbReady: Boolean(state.kb),
      kbChunks: state.kb?.stats?.chunks ?? 0,
      retrievalHits: state.retrieval?.hits?.length ?? 0,
      retrievalSteps: state.retrieval?.steps?.length ?? 0,
      promptMessages: state.prompt?.messages?.length ?? 0,
      done: state.done || null,
      streaming: Boolean(state.session?.streaming),
      lastAnswer: (() => {
        const messages = state.session?.messages || [];
        const last = [...messages].reverse().find((m) => m.role === 'assistant');
        return last ? String(last.content || '') : '';
      })(),
    };
  });

try {
  console.log(`\n▸ 打开 ${target}（期望：${expect}）`);
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60_000 });

  if (expect === 'disconnected') {
    // ---- 断开模式：明确提示未连接，不伪造答案 ----
    await page
      .waitForFunction(
        () => {
          const pill = document.querySelector('#pill-llm-text');
          const banner = document.querySelector('#conn-banner');
          return (
            (pill && /未连接/.test(pill.textContent || '')) ||
            (banner && !banner.hidden)
          );
        },
        null,
        { timeout: 20_000 },
      )
      .catch(() => {});

    const pillText = (await page.textContent('#pill-llm-text').catch(() => '')) || '';
    const bannerVisible = await page.evaluate(() => {
      const banner = document.querySelector('#conn-banner');
      return Boolean(banner && !banner.hidden);
    });
    const sendDisabled = await page.evaluate(() => {
      const btn = document.querySelector('#send-btn');
      return Boolean(btn && btn.disabled);
    });
    const bodyText = await page.evaluate(() => document.body.innerText || '');
    check('顶栏显示「未连接」', /未连接/.test(pillText), `实际：${pillText.trim()}`);
    check('页面出现连接提示条', bannerVisible);
    check('发送按钮被禁用（不会伪造回答）', sendDisabled);
    check('知识库仍在浏览器本地可用', (await demoState())?.kbChunks > 0);
    check('页面不含「离线演示/录制回放」文案', !/离线演示|录制回放|预录/.test(bodyText));
  } else {
    // ---- 真实模型模式 ----
    await page.waitForFunction(
      () => {
        const pill = document.querySelector('#pill-llm-text');
        return pill && /真实模型|未连接/.test(pill.textContent || '');
      },
      null,
      { timeout: 30_000 },
    );
    const pillText = ((await page.textContent('#pill-llm-text')) || '').trim();
    check('顶栏显示「真实模型」', pillText === '真实模型', `实际：${pillText}`);
    if (pillText !== '真实模型') {
      const health = (await demoState())?.health;
      note(`llm health：${JSON.stringify(health?.llm || null)}`);
      throw new Error('未连接真实模型，无法继续验收（请确认 npm run serve 已启动且配置了模型 Key）');
    }

    const modelName = ((await page.textContent('#pill-model-v')) || '').trim();
    check('顶栏展示真实模型名', Boolean(modelName) && modelName !== '—', `实际：${modelName}`);

    const bannerVisible = await page.evaluate(() => {
      const banner = document.querySelector('#conn-banner');
      return Boolean(banner && !banner.hidden);
    });
    check('没有「未连接」提示条', !bannerVisible);

    // 知识库在浏览器本地构建完成
    await page
      .waitForFunction(
        () => {
          const demo = globalThis.__RAG_DEMO__;
          return demo && demo.state.kb && (demo.state.kb.stats?.chunks || 0) > 0;
        },
        null,
        { timeout: 30_000 },
      )
      .catch(() => {});
    const kbState = await demoState();
    check('浏览器本地知识库已就绪', (kbState?.kbChunks || 0) > 0, `chunks=${kbState?.kbChunks}`);
    check('本地检索块数符合规模（≥40）', (kbState?.kbChunks || 0) >= 40, `chunks=${kbState?.kbChunks}`);

    const bodyText = await page.evaluate(() => document.body.innerText || '');
    check('页面不含「离线演示/录制回放/预录」文案', !/离线演示|录制回放|预录/.test(bodyText));

    // 发一条推荐问题，等真实模型回答
    const suggestCount = await page.locator('.suggest[data-q]').count();
    check('推荐问题存在', suggestCount > 0, `count=${suggestCount}`);
    const question = ((await page.locator('.suggest[data-q]').first().textContent()) || '').trim();
    note(`提问：${question}`);
    await page.locator('.suggest[data-q]').first().click();

    await page
      .waitForFunction(
        () => {
          const demo = globalThis.__RAG_DEMO__;
          if (!demo) return false;
          const state = demo.state;
          const messages = state.session?.messages || [];
          const last = [...messages].reverse().find((m) => m.role === 'assistant');
          return !state.session?.streaming && last && String(last.content || '').length > 20;
        },
        null,
        { timeout: 240_000, polling: 500 },
      )
      .catch(() => {});

    const after = await demoState();
    check('模型回答已生成（非空）', (after?.lastAnswer || '').length > 20, `长度=${(after?.lastAnswer || '').length}`);
    check('检索管线在浏览器内跑完 5 段', (after?.retrievalSteps || 0) >= 5, `steps=${after?.retrievalSteps}`);
    check('召回命中非空', (after?.retrievalHits || 0) > 0, `hits=${after?.retrievalHits}`);
    check('Prompt 已拼装（system + user）', (after?.promptMessages || 0) >= 2, `messages=${after?.promptMessages}`);
    check('回答来自真实模型（done.mode=llm）', after?.done?.mode === 'llm', `mode=${after?.done?.mode}`);
    check('返回真实 token 用量', (after?.done?.usage?.total_tokens || 0) > 0, `usage=${JSON.stringify(after?.done?.usage || null)}`);
    check('引用列表非空', (after?.done?.citations?.length || 0) > 0, `citations=${after?.done?.citations?.length || 0}`);
    const citeCount = await page.locator('#messages .msg--assistant .cite').count();
    check('回答里有 [n] 引用角标', citeCount > 0, `cite=${citeCount}`);

    // 其它页签是否拿到真实数据
    await page.click('.tab[data-tab="recall"]');
    const recallCards = await page.locator('#recall-list .recall-card, #recall-list > *').count();
    check('召回页签渲染结果', recallCards > 0, `cards=${recallCards}`);
    await page.click('.tab[data-tab="pipeline"]');

    if (wantShot) {
      fs.mkdirSync(SHOT_DIR, { recursive: true });
      const out = path.join(SHOT_DIR, 'rag-live.jpg');
      await page.waitForTimeout(800);
      await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
      console.log(`  ✓ 截图：${path.relative(ROOT, out)}`);
    }
  }
} catch (error) {
  failures.push(String(error && error.message ? error.message : error));
} finally {
  await browser.close();
}

// 断开态下浏览器必然会对 /api/llm/health 的 404 打一条网络错误日志，这是预期行为，不算前端错误
const relevantErrors =
  expect === 'disconnected'
    ? consoleErrors.filter(
        (item) => !/\/api\/llm\/health/.test(item) && !/Failed to load resource/.test(item),
      )
    : consoleErrors;
if (relevantErrors.length) {
  console.log('\n前端错误：');
  relevantErrors.slice(0, 10).forEach((item) => console.log('  ·', item));
  failures.push(`${relevantErrors.length} 个 console / page error`);
}

if (failures.length) {
  console.error(`\n✗ RAG 真实模式验收失败（expect=${expect}）：`);
  failures.forEach((item) => console.error('  ·', item));
  process.exit(1);
}
console.log(`\n✓ 通过：RAG 观测台 = 浏览器本地知识库 + 本地检索管线 + 真实大模型生成（expect=${expect}）`);
