/**
 * capture-screenshots.mjs —— apps/building-atlas 截图 + 冒烟检查脚本
 *
 * 前置：先启动子路径静态服务（在仓库根目录执行）
 *   node scripts/serve-app.mjs apps/building-atlas/dist /demos/building-atlas 5282
 *
 * 运行：cd apps/building-atlas && node scripts/capture-screenshots.mjs
 * 输出：screenshots/cover.jpg（1600×1000 楼层炸开 + 平面布局）、exterior.jpg、
 *       floors-lobby.jpg、floors-mobile.jpg、floors-mobile-plan.jpg
 *       以及 console.error / pageerror / 失败请求报告（有问题时退出码 1）
 */
import { chromium } from 'playwright';

const URL_APP = 'http://127.0.0.1:5282/demos/building-atlas/';
const OUT = 'screenshots';
const t0 = Date.now();
const log = (...args) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...args);

function watch(page, bag) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') bag.console.push(msg.text().slice(0, 500));
  });
  page.on('pageerror', (err) => bag.pageerror.push(String(err.message || err).slice(0, 500)));
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText || 'failed';
    if (!failure.includes('ERR_ABORTED')) bag.failed.push(`${req.url()} — ${failure}`);
  });
}

const browser = await chromium.launch({ headless: true });
const desktop = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const desktopBag = { console: [], pageerror: [], failed: [] };
watch(desktop, desktopBag);

await desktop.goto(URL_APP, { waitUntil: 'domcontentloaded', timeout: 120000 });
await desktop.waitForFunction(() => window.__fuhua && window.__fuhua.loaded, null, { timeout: 180000 });
log('模型加载完成', await desktop.evaluate(() => JSON.stringify(window.__sceneStats)));
await desktop.waitForTimeout(3000);
await desktop.screenshot({ path: `${OUT}/exterior.jpg`, type: 'jpeg', quality: 88 });
log('整体外观截图完成');

await desktop.click('#nav-floors', { timeout: 120000 });
await desktop.waitForFunction(
  () => window.__fuhuaFloor && window.__fuhuaFloor.state.active && window.__fuhuaFloor.stats,
  null,
  { timeout: 180000 },
);
log('楼层模式已进入', await desktop.evaluate(() => JSON.stringify(window.__floorStats)));
await desktop.waitForFunction(() => !window.__fuhuaFloor.busy, null, { timeout: 240000, polling: 250 });

await desktop.click('#floor-tower-tabs button[data-tower="F"]', { timeout: 120000 });
await desktop.waitForFunction(() => !window.__fuhuaFloor.busy, null, { timeout: 240000, polling: 250 });
log('已选择 F 座');

await desktop.click('#floor-list button[data-level="8"]', { timeout: 120000 });
await desktop.waitForFunction(
  () => !window.__fuhuaFloor.busy && window.__fuhuaFloor.state.explode > 0.99,
  null,
  { timeout: 240000, polling: 250 },
);
await desktop.waitForTimeout(2200);
await desktop.screenshot({ path: `${OUT}/cover.jpg`, type: 'jpeg', quality: 88 });
log('封面截图完成');

const info = await desktop.evaluate(() => {
  const rect = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const box = el.getBoundingClientRect();
    return { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height), hidden: el.hidden };
  };
  return {
    floorState: window.__fuhuaFloor.state,
    floorStats: window.__floorStats,
    sceneStats: window.__sceneStats,
    renderInfo: window.__renderInfo,
    layoutTitle: document.querySelector('#layout-title')?.textContent,
    layoutType: document.querySelector('#layout-type')?.textContent,
    planSvg: Boolean(document.querySelector('#layout-svg svg')),
    planUnits: document.querySelectorAll('#layout-svg .plan-unit').length,
    planNote: document.querySelector('.layout-note')?.textContent,
    floorListItems: document.querySelectorAll('#floor-list li').length,
    panelRects: {
      floorPanel: rect('#floor-panel'),
      layoutPanel: rect('#layout-panel'),
      floorControls: rect('#floor-controls'),
      viewport: rect('#viewport'),
    },
    docOverflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    floorTagVisible: !document.querySelector('#floor-tag-3d').hidden,
  };
});
log('桌面端状态', JSON.stringify(info, null, 1));

// 悬停平面单元：信息联动
await desktop.hover('#layout-svg .plan-unit', { timeout: 60000, force: true }).catch(() => {});
await desktop.waitForTimeout(900);
log('平面单元悬停', JSON.stringify(await desktop.evaluate(() => ({
  text: document.querySelector('#layout-unit')?.textContent?.trim().slice(0, 200),
  active: document.querySelectorAll('#layout-svg .plan-unit.is-active').length,
}))));

// 首层大堂（另一种平面布局）
await desktop.click('#floor-list button[data-level="0"]', { timeout: 120000 });
await desktop.waitForFunction(() => !window.__fuhuaFloor.busy, null, { timeout: 240000, polling: 250 });
await desktop.waitForTimeout(1800);
await desktop.screenshot({ path: `${OUT}/floors-lobby.jpg`, type: 'jpeg', quality: 88 });
log('大堂层截图完成');

// 切换楼座 A：验证楼层数 / 平面 / 信息卡联动
await desktop.click('#floor-tower-tabs button[data-tower="A"]', { timeout: 120000 });
await desktop.waitForFunction(() => !window.__fuhuaFloor.busy, null, { timeout: 240000, polling: 250 });
log('切换 A 座', JSON.stringify(await desktop.evaluate(() => ({
  state: window.__fuhuaFloor.state,
  title: document.querySelector('#layout-title')?.textContent,
  type: document.querySelector('#layout-type')?.textContent,
  listItems: document.querySelectorAll('#floor-list li').length,
  card: document.querySelector('#floor-card-name')?.textContent,
}))));

// 退出楼层模式：恢复整体模型
await desktop.click('#floor-exit', { timeout: 120000 });
await desktop.waitForFunction(() => !window.__fuhuaFloor.state.active, null, { timeout: 120000 });
await desktop.waitForTimeout(1500);
log('退出楼层模式', JSON.stringify(await desktop.evaluate(() => ({
  active: window.__fuhuaFloor.state.active,
  floorPanelHidden: document.querySelector('#floor-panel')?.hidden,
  layoutPanelHidden: document.querySelector('#layout-panel')?.hidden,
  sceneHeadingVisible: getComputedStyle(document.querySelector('.scene-heading')).visibility,
  canvas: document.querySelectorAll('#viewport canvas').length,
}))));

/* ------------------------------ 移动端检查 ------------------------------ */
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const mobileBag = { console: [], pageerror: [], failed: [] };
watch(mobile, mobileBag);
await mobile.goto(URL_APP, { waitUntil: 'domcontentloaded', timeout: 120000 });
await mobile.waitForFunction(() => window.__fuhua && window.__fuhua.loaded, null, { timeout: 180000 });
await mobile.waitForTimeout(1500);
await mobile.click('#nav-floors', { timeout: 120000 });
await mobile.waitForFunction(
  () => window.__fuhuaFloor && window.__fuhuaFloor.state.active && window.__fuhuaFloor.stats,
  null,
  { timeout: 180000 },
);
await mobile.waitForFunction(() => !window.__fuhuaFloor.busy, null, { timeout: 240000, polling: 250 });
await mobile.waitForTimeout(1200);
const mobileInfo = await mobile.evaluate(() => {
  const rect = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const box = el.getBoundingClientRect();
    return { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height), hidden: el.hidden };
  };
  return {
    docOverflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    viewport: rect('#viewport'),
    floorPanel: rect('#floor-panel'),
    layoutPanel: rect('#layout-panel'),
    floorControls: rect('#floor-controls'),
  };
});
log('移动端布局（平面抽屉收起）', JSON.stringify(mobileInfo));
await mobile.screenshot({ path: `${OUT}/floors-mobile.jpg`, type: 'jpeg', quality: 86 });

await mobile.click('#floor-plan-toggle', { timeout: 60000 }).catch(() => {});
await mobile.waitForTimeout(1500);
const mobilePlan = await mobile.evaluate(() => {
  const el = document.querySelector('#layout-panel');
  const box = el.getBoundingClientRect();
  return {
    open: el.classList.contains('open'),
    visible: getComputedStyle(el).display !== 'none',
    rect: { y: Math.round(box.y), h: Math.round(box.height) },
    planSvg: Boolean(document.querySelector('#layout-svg svg')),
    floorPanelHidden: document.querySelector('#floor-panel')?.hidden,
    floorPanelDisplay: getComputedStyle(document.querySelector('#floor-panel')).display,
  };
});
log('移动端平面抽屉展开', JSON.stringify(mobilePlan));
await mobile.screenshot({ path: `${OUT}/floors-mobile-plan.jpg`, type: 'jpeg', quality: 86 });

/* ------------------------------- 检查报告 ------------------------------- */
const report = {
  desktopConsoleErrors: [...new Set(desktopBag.console)],
  desktopPageErrors: desktopBag.pageerror,
  desktopFailedRequests: [...new Set(desktopBag.failed)],
  mobileConsoleErrors: [...new Set(mobileBag.console)],
  mobilePageErrors: mobileBag.pageerror,
  mobileFailedRequests: [...new Set(mobileBag.failed)],
};
console.log('\n=== 检查报告 ===');
console.log(JSON.stringify(report, null, 1));

await browser.close();
if (report.desktopPageErrors.length || report.desktopConsoleErrors.length) process.exitCode = 1;
