// 原创资产截图脚本：tools/hero/test.html + 真实游戏页注入验收
//
//   node tools/hero/shots.mjs [baseUrl]
//
// 依赖共享 dev server（apps/beijing-courier: npm run dev → 127.0.0.1:5190）。
// 截图写入 screenshots/hero/，并生成 report.json。
//
// 除 harness 各视角外，还会打开真实游戏页：
//   1) startGame() 进入游戏、等世界加载完
//   2) 通过 window.__courier.debug API 把原创邮差 / 遛鸟大爷动态 import 进真实场景
//      （不改 main.js；Lead 正式接入后这一步就只是验证，不再需要注入）
//   3) 用游戏自己的 pipeline 渲染并截图，检查描边 / LUT / 光影是否一致
import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:5190').replace(/\/$/, '');
const APP_DIR = new URL('../..', import.meta.url).pathname;
const OUT_DIR = path.join(APP_DIR, 'screenshots/hero');
const HARNESS = `${BASE}/tools/hero/test.html`;

if (!fs.existsSync(path.join(APP_DIR, 'package.json'))) {
  console.error(`could not locate apps/beijing-courier from ${import.meta.url}`);
  process.exit(1);
}
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (error) => console.log('  [pageerror]', error.message.slice(0, 500)));
page.on('console', (message) => {
  if (message.type() === 'error') console.log('  [console]', message.text().slice(0, 500));
});

const report = {
  baseUrl: BASE,
  startedAt: new Date().toISOString(),
  screenshots: [],
  renders: {},
  info: {},
  game: {},
};

const viewport = (width, height) => page.setViewportSize({ width, height });

/** 传送到稳定的老场景（海边码头老出生点）取景，避免拍到其他 teammate 正在施工的新片区。 */
async function teleportToScenicSpot() {
  await page.evaluate(() => {
    const d = window.__courier;
    const THREE = d.THREE;
    // 老出生点（原 harbor 出生点方向），场景稳定、构图好
    const normal = new THREE.Vector3(5.81, 5.81, 25.8).normalize();
    d.teleport(normal.toArray(), 0);
    d.renderOnce(); // 走一帧 updateGame，让 controller/avatar root/相机同步
    if (d.ui?.hideDialogue) d.ui.hideDialogue();
    if (d.ui?.hideInteract) d.ui.hideInteract();
    window.__hideGameBillboards?.();
  });
  await page.waitForTimeout(700);
}

async function openHarnessOnce(mode, params = {}, options = {}) {
  const query = new URLSearchParams({ mode, ...params }).toString();
  await page.goto(`${HARNESS}?${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready || window.__error, { timeout: 180000 });
  const error = await page.evaluate(() => window.__error);
  if (error) throw new Error(`harness failed (${mode}): ${error.slice(0, 1500)}`);
  await page.evaluate(() => window.__app.freeze(true));
  await page.waitForTimeout(options.settle ?? 380);
  await page.evaluate(() => window.__app.renderOnce());
  await page.waitForTimeout(80);
  return page.evaluate(() => window.__app.renderMode);
}

// 团队成员可能正在改源码触发 Vite HMR 整页刷新，openHarness 偶尔会被
// “Execution context was destroyed” 打断 —— 这里重试一两次即可。
async function openHarness(mode, params = {}, options = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await openHarnessOnce(mode, params, options);
    } catch (error) {
      lastError = error;
      console.log(`  [retry ${attempt}/3] harness ${mode}: ${String(error.message || error).slice(0, 120)}`);
      await page.waitForTimeout(900);
    }
  }
  throw lastError;
}

async function capture(name, options = {}) {
  const target = options.selector ? page.locator(options.selector) : page;
  const file = path.join(OUT_DIR, name);
  await target.screenshot({ path: file });
  report.screenshots.push({ file: path.relative(APP_DIR, file), mode: options.mode });
  console.log('  saved', path.relative(APP_DIR, file));
}

// ---------------------------------------------------------------- harness shots
async function harnessShots() {
  console.log('[1/4] 主角单视角（front/back/run/sprint/air/head）');
  const singles = [
    ['01-hero-front.png', { pose: 'idle', view: 'front', time: '1.05' }, [900, 1000]],
    ['02-hero-back.png', { pose: 'idle', view: 'back', time: '1.05' }, [900, 1000]],
    ['03-hero-run.png', { pose: 'run', view: 'side', time: '0.19' }, [900, 1000]],
    ['04-hero-sprint.png', { pose: 'sprint', view: 'tq', time: '0.16' }, [900, 1000]],
    ['05-hero-air.png', { pose: 'air', view: 'front', time: '0.36' }, [900, 1000]],
    ['06-hero-head.png', { pose: 'idle', view: 'head', time: '1.05' }, [900, 900]],
  ];
  for (const [name, params, size] of singles) {
    await viewport(...size);
    report.renders[name] = await openHarness('single', params);
    await capture(name, { mode: `single:${params.pose}` });
    if (name === '01-hero-front.png') report.info.hero = await page.evaluate(() => window.__app.info());
  }

  console.log('[2/4] 四姿态 lineup + setOutfit 颜色变体');
  await viewport(1440, 900);
  report.renders.lineup = await openHarness('lineup');
  await capture('07-hero-poses.png', { mode: 'lineup' });
  report.info.lineup = await page.evaluate(() => window.__app.info());

  report.renders.outfits = await openHarness('outfits');
  await capture('08-hero-outfits.png', { mode: 'outfits' });
  report.info.outfits = await page.evaluate(() => window.__app.info());

  console.log('[3/4] 原创 NPC 三种 + talking');
  report.renders.npcs = await openHarness('npcs');
  await capture('09-npcs.png', { mode: 'npcs' });
  report.info.npcs = await page.evaluate(() => window.__app.info());

  const npcSingles = [
    ['10-npc-daye.png', 'beijing-daye', '1'],
    ['11-npc-dama.png', 'beijing-dama', '0'],
    ['12-npc-kid.png', 'xiaoxuesheng', '0'],
  ];
  for (const [name, type, talk] of npcSingles) {
    await viewport(900, 1000);
    report.renders[name] = await openHarness('npc', { type, talk, pose: 'idle' });
    await capture(name, { mode: `npc:${type}` });
  }

  console.log('[4/4] 与参考站 avatar 同框 + 自建胡同场景');
  await viewport(1440, 900);
  report.renders.compare = await openHarness('compare');
  await capture('13-compare-avatar.png', { mode: 'compare' });
  report.info.compare = await page.evaluate(() => window.__app.info());

  report.renders.scene = await openHarness('scene');
  await capture('14-hutong-scene.png', { mode: 'scene' });
  report.info.scene = await page.evaluate(() => window.__app.info());
}

// ---------------------------------------------------------------- real game shot
// 把原创角色放进真实游戏场景验证画风。两种模式都支持：
//   - main.js 还没接入 → 动态 import + 注入 hero / daye（不改任何业务文件）
//   - main.js 已接入（avatar.type === 'original-courier'）→ 直接用游戏里的主角
async function injectGameActors(page) {
  return page.evaluate(async () => {
    const debug = window.__gameDebug;
    const { courier: courierMod, npc: npcMod } = window.__originalModules;
    const integrated = debug.avatar?.type === 'original-courier';
    if (debug.ui?.hideDialogue) debug.ui.hideDialogue();
    // 暂停游戏主循环，自己控制相机（只影响截图，不改任何业务逻辑）
    debug.state.mode = 'frozen';
    const { scene, controller, camera, pipeline, materials } = debug;
    const THREE = debug.THREE;
    // 隐藏漂浮的「信」任务 billboard（截图时太抢镜；不改业务逻辑）
    window.__hideGameBillboards = () => scene.traverse((o) => {
      if (o.isMesh && o.material?.uniforms?.uScale && o.material?.uniforms?.tMap) {
        o.visible = false;
        o.userData.wanted = false;
      }
    });
    window.__hideGameBillboards();

    let hero = debug.avatar;
    if (!integrated) {
      hero = courierMod.createOriginalCourier();
      scene.add(hero.root);
      debug.avatar.root.visible = false;
      hero.root.position.copy(debug.avatar.root.position);
      hero.root.quaternion.copy(debug.avatar.root.quaternion);
      hero.play('idle');
      for (let i = 0; i < 40; i += 1) hero.update(1 / 60);
    }

    const up = controller.normal.clone().normalize();
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(hero.root.quaternion);
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();

    // 原创 NPC：遛鸟大爷站在邮差旁边
    const daye = npcMod.createOriginalNPC({ type: 'beijing-daye' });
    scene.add(daye.root);
    daye.root.position.copy(hero.root.position).addScaledVector(right, 1.35).addScaledVector(forward, 0.2);
    daye.root.quaternion.copy(hero.root.quaternion);
    daye.setLookAt(hero.root.position.clone().addScaledVector(up, 0.9));
    for (let i = 0; i < 50; i += 1) daye.update(1 / 60);

    function frameCamera(offset, lookHeight) {
      const center = hero.root.position.clone();
      camera.position.copy(center)
        .addScaledVector(up, offset[0])
        .addScaledVector(forward, offset[1])
        .addScaledVector(right, offset[2]);
      camera.lookAt(center.clone().addScaledVector(up, lookHeight));
      camera.updateProjectionMatrix();
      materials.update(5.0);
      window.__hideGameBillboards();
      pipeline.render(scene, camera);
    }
    frameCamera([1.6, 3.4, 2.2], 0.92);

    window.__gameActors = { hero, daye, scene, camera, pipeline, materials, up, forward, right, frameCamera };
    return {
      integrated,
      heroHeight: hero.height,
      dayeHeight: daye.height,
      sceneChildren: scene.children.length,
      position: hero.root.position.toArray().map((v) => +v.toFixed(2)),
    };
  });
}

async function gameShots() {
  console.log('[game] 打开真实游戏页（共享 dev server 5190），进入游戏场景…');
  await viewport(1440, 900);
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__courier && window.__courier.state.mode === 'intro', { timeout: 240000 });
  await page.evaluate(() => window.__courier.startGame());
  await page.waitForFunction(() => window.__courier.state.mode === 'playing', { timeout: 300000 });
  await page.waitForTimeout(1200);
  await teleportToScenicSpot();

  // 动态 import 原创模块（Lead 正式接入 main.js 后这步可省略）
  await page.evaluate(async () => {
    window.__gameDebug = window.__courier;
    window.__originalModules = {
      courier: await import('/src/actor/originalCourier.js'),
      npc: await import('/src/actor/originalNpc.js'),
    };
  });

  report.game.injected = await injectGameActors(page);
  console.log(`  hero source: ${report.game.injected.integrated ? 'main.js 已接入（直接用游戏主角）' : '动态注入（main.js 未接入）'}`);

  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT_DIR, '15-game-duo.png') });
  report.screenshots.push({ file: 'screenshots/hero/15-game-duo.png', mode: 'game:duo' });
  console.log('  saved screenshots/hero/15-game-duo.png');

  // 单人近景（真实场景 + 真实 UI，看和场景风格是否一致）
  await page.evaluate(() => {
    const g = window.__gameActors;
    g.daye.root.visible = false;
    g.frameCamera([1.3, 2.6, 1.2], 0.92);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT_DIR, '16-game-hero.png') });
  report.screenshots.push({ file: 'screenshots/hero/16-game-hero.png', mode: 'game:hero' });
  console.log('  saved screenshots/hero/16-game-hero.png');

  // 后侧 3/4 视角看斜挎邮包 / 帽檐（真实场景；daye 先隐藏免得挡镜头）
  await page.evaluate(() => {
    const g = window.__gameActors;
    g.daye.root.visible = false;
    const center = g.hero.root.position.clone();
    g.camera.position.copy(center)
      .addScaledVector(g.up, 2.1)
      .addScaledVector(g.forward, -3.4)
      .addScaledVector(g.right, -2.4);
    g.camera.lookAt(center.clone().addScaledVector(g.up, 1.0));
    g.camera.updateProjectionMatrix();
    g.materials.update(5.0);
    g.pipeline.render(g.scene, g.camera);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT_DIR, '17-game-back.png') });
  report.screenshots.push({ file: 'screenshots/hero/17-game-back.png', mode: 'game:back' });
  console.log('  saved screenshots/hero/17-game-back.png');

  // ---------------------------------------------------------------- 真实操作验证
  console.log('[game] 动态操作验证：进入游戏 → WASD 跑动 / 跳跃，截图 hero 跟控制器联动');
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__courier && window.__courier.state.mode === 'intro', { timeout: 240000 });
  await page.evaluate(() => window.__courier.startGame());
  await page.waitForFunction(() => window.__courier.state.mode === 'playing', { timeout: 300000 });
  await page.waitForTimeout(2000);
  await teleportToScenicSpot();
  const play = await page.evaluate(async () => {
    const debug = window.__courier;
    if (debug.ui?.hideDialogue) debug.ui.hideDialogue();
    const integrated = debug.avatar?.type === 'original-courier';
    let hero = debug.avatar;
    if (!integrated) {
      const { createOriginalCourier } = await import('/src/actor/originalCourier.js');
      hero = createOriginalCourier();
      await hero.ready;
      debug.scene.add(hero.root);
      debug.avatar.root.visible = false;
      debug.controller.avatar = hero;
    }
    window.__hero = hero;
    window.__heroPose = hero.pose;
    window.__heroSpeed = 0;
    window.__heroGrounded = true;
    if (!integrated) {
      let last = performance.now();
      function loop(now) {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const c = debug.controller;
        let pose = 'idle';
        if (!c.grounded) pose = 'air';
        else if (c.speed > 4.1) pose = 'sprint';
        else if (c.speed > 0.4) pose = 'run';
        hero.play(pose);
        hero.update(dt);
        window.__heroPose = pose;
        window.__heroSpeed = c.speed;
        window.__heroGrounded = c.grounded;
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    } else {
      setInterval(() => {
        window.__heroPose = hero.pose;
        window.__heroSpeed = debug.controller.speed;
        window.__heroGrounded = debug.controller.grounded;
      }, 100);
    }
    return { integrated };
  });
  report.game.live = { ...play };
  await page.waitForTimeout(600);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  report.game.live.runState = await page.evaluate(() => ({
    pose: window.__heroPose, speed: +window.__heroSpeed.toFixed(2), grounded: window.__heroGrounded,
  }));
  await page.screenshot({ path: path.join(OUT_DIR, '18-game-run.png') });
  report.screenshots.push({ file: 'screenshots/hero/18-game-run.png', mode: 'game:run' });
  console.log('  saved screenshots/hero/18-game-run.png', JSON.stringify(report.game.live.runState));

  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  report.game.live.jumpState = await page.evaluate(() => ({
    pose: window.__heroPose, speed: +window.__heroSpeed.toFixed(2), grounded: window.__heroGrounded,
  }));
  await page.screenshot({ path: path.join(OUT_DIR, '19-game-jump.png') });
  report.screenshots.push({ file: 'screenshots/hero/19-game-jump.png', mode: 'game:jump' });
  console.log('  saved screenshots/hero/19-game-jump.png', JSON.stringify(report.game.live.jumpState));
  await page.keyboard.up('KeyW');

  report.game.renderMode = 'pipeline (real game scene)';
}

const SKIP_HARNESS = process.env.SHOTS_SKIP_HARNESS === '1';

try {
  if (SKIP_HARNESS) console.log('[harness] skipped (SHOTS_SKIP_HARNESS=1)');
  else await harnessShots();
  // 其他 teammate 可能正在改 main.js / HMR，真实游戏页这步允许整段重试一次
  let gameError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await gameShots();
      gameError = null;
      break;
    } catch (error) {
      gameError = error;
      console.log(`  [retry ${attempt}/3] game shots: ${String(error.message || error).slice(0, 160)}`);
      await page.waitForTimeout(2500);
    }
  }
  if (gameError) throw gameError;
  report.finishedAt = new Date().toISOString();
  const reportFile = path.join(OUT_DIR, 'report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log('\nrender modes:', JSON.stringify(report.renders));
  console.log('report:', path.relative(APP_DIR, reportFile));
} catch (error) {
  console.error('\nSHOTS FAILED:', error);
  report.error = String(error && error.stack || error);
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
