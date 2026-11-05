#!/usr/bin/env node
/**
 * audit-site.mjs —— 全站验收：启动站点与真实 Agent 后端，逐个打开首页与六个 demo，
 * 检查 404 / pageerror / console.error / 返回入口 / 封面加载，并输出截图。
 *
 * 注意：mini-opencode 现在是「真 Agent」，验收时也会把它的本地后端拉起来，
 * /api/* 走真实响应（不会真的调用模型，除非你在页面里发消息）。
 *
 * 用法：
 *   node scripts/audit-site.mjs                # 验收 site/（先 npm run build）
 *   node scripts/audit-site.mjs --shots        # 额外把每个 demo 截图存到 screenshots/audit/
 *   node scripts/audit-site.mjs --port 5290
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startStaticServer } from './static-server.mjs';
import { startAgentBackend } from './agent-backend.mjs';
import { loadLlmProxyConfig } from './llm-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const HUB = path.join(ROOT, 'hub');
const argv = process.argv.slice(2);
const wantShots = argv.includes('--shots');
const port = Number(argv[argv.indexOf('--port') + 1]) || 5290;
const SHOT_DIR = path.join(ROOT, 'screenshots', 'audit');

if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  console.error('✗ 未找到 site/index.html，请先运行：npm run build');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(HUB, 'demos.json'), 'utf8'));
const demos = manifest.demos || [];

let agent = null;
const auditWorkspace = path.join(os.tmpdir(), 'mini-opencode-audit-workspace');
try {
  fs.rmSync(auditWorkspace, { recursive: true, force: true });
  // 用临时工作区：验收不应该往演示沙盒里写会话/文件
  agent = await startAgentBackend({ quiet: true, workspace: auditWorkspace });
} catch (error) {
  console.error(`⚠ 真实 Agent 后端没起来，agent-lab 会被判为离线：${error.message}`);
}

const proxies = agent ? [{ prefix: '/api', target: agent.url }] : [];
// RAG 观测台的模型转发：验收页面健康状态 / 连接提示时用（不会主动发消息，不烧 token）
const llm = loadLlmProxyConfig({ root: ROOT });
const { url: base, close } = await startStaticServer({
  root: SITE,
  prefix: '/',
  port,
  host: '127.0.0.1',
  quiet: true,
  proxies,
  llm,
});
console.log(`\n站点：${base}`);
if (agent) console.log(`真实 Agent 后端：${agent.url}（模型：${agent.modelLine}）`);
console.log(
  llm.configured
    ? `RAG 真实模型转发：${llm.model}（${llm.baseUrl}）\n`
    : 'RAG 真实模型：未配置 Key，rag-lab 页会显示「未连接真实模型」\n',
);

// 3D / Cesium demo 在 SwiftShader 下会非常慢，验收时启用真实 GPU（macOS ANGLE Metal）
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });

const results = [];
const failures = [];

function attachDiagnostics(page, bag) {
  bag.okUrls = new Set();
  bag.aborted = [];
  page.on('pageerror', (err) => bag.pageErrors.push(String(err && err.message ? err.message : err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') bag.consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => {
    const errorText = req.failure()?.errorText || 'failed';
    const entry = { url: req.url(), method: req.method(), errorText };
    // 无头浏览器里，同一资源并发加载 / 页面 teardown 时会出现 ERR_ABORTED；
    // 若该 URL 同时拿到过 2xx 响应，视为警告而不是失败。
    if (errorText.includes('ERR_ABORTED')) bag.aborted.push(entry);
    else bag.failedRequests.push(`${entry.method} ${entry.url} — ${errorText}`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) bag.httpErrors.push(`${res.status()} ${res.url()}`);
    else bag.okUrls.add(res.url());
  });
}

/** 把「同 URL 已有 2xx 但又被标记 abort」的请求降级为警告 */
function finalizeDiagnostics(bag) {
  const warnings = [];
  for (const item of bag.aborted) {
    if (bag.okUrls.has(item.url)) warnings.push(`已成功加载但请求被取消（无头浏览器竞态）：${item.url}`);
    else bag.failedRequests.push(`${item.method} ${item.url} — ${item.errorText}`);
  }
  bag.warnings = warnings;
  bag.aborted = undefined;
  bag.okUrls = undefined;
  return bag;
}

async function auditPage(name, targetUrl, waitMs, shotName) {
  const bag = { pageErrors: [], consoleErrors: [], failedRequests: [], httpErrors: [] };
  const page = await context.newPage();
  attachDiagnostics(page, bag);
  let title = '';
  let bodyText = '';
  let backHome = null;
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(waitMs);
    title = await page.title();
    bodyText = (await page.evaluate(() => document.body.innerText || '')).slice(0, 120);
    backHome = await page
      .evaluate(() => {
        const node = document.querySelector('.__back-home');
        return node ? { href: node.getAttribute('href'), text: node.textContent.trim() } : null;
      })
      .catch(() => null);

    if (wantShots) {
      fs.mkdirSync(SHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(SHOT_DIR, `${shotName}.jpg`), type: 'jpeg', quality: 88 });
    }
  } catch (error) {
    bag.pageErrors.push(`导航/等待失败：${error.message}`);
  }

  finalizeDiagnostics(bag);
  const entry = { name, url: targetUrl, title, bodyPreview: bodyText, backHome, ...bag };
  results.push(entry);
  if (bag.pageErrors.length) failures.push(`${name}: pageerror ${bag.pageErrors.length}`);
  if (bag.httpErrors.length) failures.push(`${name}: ${bag.httpErrors.length} 个 HTTP >=400`);
  if (bag.consoleErrors.length) failures.push(`${name}: ${bag.consoleErrors.length} 个 console.error`);
  if (bag.failedRequests.length) failures.push(`${name}: ${bag.failedRequests.length} 个失败请求`);
  await page.close();
  return entry;
}

// ---------------------------------------------------------------------------
// 1. 首页
// ---------------------------------------------------------------------------
console.log('▸ 首页');
const { url: hubUrl } = { url: base };
const hubBag = { pageErrors: [], consoleErrors: [], failedRequests: [], httpErrors: [] };
const hubPage = await context.newPage();
attachDiagnostics(hubPage, hubBag);
const hubReport = { cards: [], thumbs: [], navOk: false };
try {
  await hubPage.goto(hubUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await hubPage.waitForSelector('.demo-card', { timeout: 15000 });
  await hubPage.waitForTimeout(1200);
  // 封面是 loading=lazy：先滚到底把它们都触发加载，避免误报「封面未加载」
  await hubPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await hubPage.waitForTimeout(1200);
  hubReport.cards = await hubPage.$$eval('.demo-card', (nodes) =>
    nodes.map((node) => ({
      title: node.querySelector('h3')?.textContent || '',
      href: node.querySelector('.demo-cover')?.getAttribute('href') || '',
      cover: node.querySelector('.demo-cover img')?.getAttribute('src') || '',
    })),
  );
  hubReport.thumbs = await hubPage.$$eval('.demo-cover img', (imgs) =>
    imgs.map((img) => ({ src: img.getAttribute('src'), loaded: img.complete && img.naturalWidth > 0 })),
  );
  hubReport.navOk = (await hubPage.$$('.deck-item a')).length === demos.length;
  if (wantShots) {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await hubPage.screenshot({ path: path.join(SHOT_DIR, 'hub-hero.jpg'), type: 'jpeg', quality: 88 });
  }
} catch (error) {
  hubBag.pageErrors.push(`首页渲染失败：${error.message}`);
}
finalizeDiagnostics(hubBag);
const hubEntry = { name: 'hub', url: hubUrl, ...hubReport, ...hubBag };
results.push(hubEntry);
if (hubBag.pageErrors.length) failures.push(`hub: ${hubBag.pageErrors.length} 个 pageerror`);
if (hubReport.cards.length !== demos.length) failures.push(`hub: 卡片数 ${hubReport.cards.length} ≠ ${demos.length}`);
for (const thumb of hubReport.thumbs) {
  // 封面缺失时前端会回退为渐变占位，这不算致命错误，但记录警告
  if (!thumb.loaded) console.log(`  ⚠ 封面未加载：${thumb.src}`);
}
await hubPage.close();

// ---------------------------------------------------------------------------
// 2. 逐个 demo
// ---------------------------------------------------------------------------
const WAIT = {
  'mecha-battle': 18000,
  'building-atlas': 14000,
  'cbd-digital-twin': 24000,
  'flood-sim': 16000,
  'rag-lab': 6000,
  'agent-lab': 7000,
};

for (const demo of demos) {
  console.log(`▸ ${demo.id}`);
  const target = new URL(demo.href, base).href;
  const entry = await auditPage(demo.id, target, WAIT[demo.id] || 6000, demo.id);
  console.log(`  标题：${entry.title}`);
  if (entry.backHome) console.log(`  返回入口：${entry.backHome.href}`);
  else failures.push(`${demo.id}: 缺少 __back-home 返回入口`);
}

await browser.close();
await close();
if (agent) await agent.stop();
fs.rmSync(auditWorkspace, { recursive: true, force: true });

// ---------------------------------------------------------------------------
// 3. 报告
// ---------------------------------------------------------------------------
console.log('\n================ 验收报告 ================');
for (const item of results) {
  const issues = item.pageErrors.length + item.consoleErrors.length + item.httpErrors.length + item.failedRequests.length;
  const mark = issues ? '✗' : '✓';
  const warnings = item.warnings || [];
  console.log(
    `${mark} ${item.name.padEnd(16)} HTTP≥400:${String(item.httpErrors.length).padStart(2)}  pageerror:${String(
      item.pageErrors.length,
    ).padStart(2)}  console:${String(item.consoleErrors.length).padStart(2)}  reqfail:${String(
      item.failedRequests.length,
    ).padStart(2)}  warn:${String(warnings.length).padStart(2)}`,
  );
  for (const w of warnings.slice(0, 3)) console.log(`    warn: ${w}`);
  for (const e of item.pageErrors.slice(0, 4)) console.log(`    pageerror: ${String(e).slice(0, 300)}`);
  for (const e of item.httpErrors.slice(0, 6)) console.log(`    http: ${e}`);
  for (const e of item.consoleErrors.slice(0, 4)) console.log(`    console: ${String(e).slice(0, 300)}`);
  for (const e of item.failedRequests.slice(0, 4)) console.log(`    reqfail: ${String(e).slice(0, 300)}`);
}

if (wantShots) console.log(`\n截图目录：${path.relative(ROOT, SHOT_DIR)}/`);

if (failures.length) {
  console.log(`\n✗ 验收未通过（${failures.length} 项）：`);
  failures.forEach((f) => console.log(`  · ${f}`));
  process.exit(1);
}
console.log('\n✓ 全站验收通过');
