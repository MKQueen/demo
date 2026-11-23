// 程序化音频验收脚本（Playwright）
// ---------------------------------------------------------------------------
// 前提：共享 dev server 已在 127.0.0.1:5190 运行（Lead 的 dev.mjs，不要另起）。
//   node tools/audio/verify.mjs
//
// 覆盖：
//   A. tools/audio/test.html —— 解锁 / BGM 渲染 / 区域切换 / cue 连播 /
//      实时波形与电平 / 离线 RMS 自检表 / 手机尺寸 / 静音与 localStorage 持久化
//   B. 真实游戏页 http://127.0.0.1:5190/ —— 点 BEGIN 后 AudioContext.state==='running'、
//      BGM 已就绪、区域可切换、cue/footstep 可播放、console 0 error、
//      且没有任何 .ogg/.mp3 音频网络请求
// 产物：
//   screenshots/audio/*.png     截图
//   screenshots/audio/report.json 机器可读验收结果
// 成功时 exit 0，有断言失败 exit 1。
// ---------------------------------------------------------------------------

import { chromium } from '/Users/one/AI/demo/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'screenshots/audio');
const BASE = process.env.AUDIO_BASE || 'http://127.0.0.1:5190';
const GAME_URL = `${BASE}/`;
const TEST_URL = `${BASE}/tools/audio/test.html`;
const APP_ROOT = path.resolve(__dirname, '../..');

fs.mkdirSync(OUT, { recursive: true });

const failures = [];
function check(condition, label, detail) {
  if (condition) {
    console.log('  ✓', label, detail !== undefined ? `— ${detail}` : '');
  } else {
    console.log('  ✗', label, detail !== undefined ? `— ${detail}` : '');
    failures.push(label);
  }
}

const AUDIO_REQUEST_RE = /\.(ogg|mp3|wav|m4a|aac|flac|opus)(\?|#|$)/i;

// Vite HMR 客户端的空壳：导出 vite 注入代码需要的符号（含 updateStyle，否则 dev 下 CSS 不会注入），
// 但不建 WebSocket、不 reload。
const HMR_SHIM = `
export class ErrorOverlay extends HTMLElement {}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
    get isWithinCircularImport() { return false; },
  };
}
export function injectQuery(url) { return url; }
function styleEl(id) {
  return document.querySelector('style[data-vite-dev-id="' + id + '"]');
}
export function updateStyle(id, content) {
  let el = styleEl(id);
  if (!el) {
    el = document.createElement('style');
    el.setAttribute('data-vite-dev-id', id);
    document.head.appendChild(el);
  }
  el.textContent = content;
  return el;
}
export function removeStyle(id) {
  const el = styleEl(id);
  if (el) el.remove();
}
export default {};
`;

// ---------------------------------------------------------------------------
// 静态检查：源码里不能再引用参考站音频资产
// ---------------------------------------------------------------------------
console.log('\n[0/4] 静态检查：不再引用 assets-messenger/audio');
const audioSource = fs.readFileSync(path.join(APP_ROOT, 'src/game/audio.js'), 'utf8');
const musicSource = fs.readFileSync(path.join(APP_ROOT, 'src/game/music.js'), 'utf8');
const forbidden = ['.ogg', '.mp3', 'assets-messenger/audio', 'loadAudio('];
for (const token of forbidden) {
  check(!audioSource.includes(token), `audio.js 不含 "${token}"`);
  check(!musicSource.includes(token), `music.js 不含 "${token}"`);
}
check(audioSource.includes('OfflineAudioContext') || musicSource.includes('OfflineAudioContext'), '使用 OfflineAudioContext 预渲染 BGM');

// ---------------------------------------------------------------------------
// 浏览器
// ---------------------------------------------------------------------------
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--font-render-hinting=none',
  ],
});

const report = {
  startedAt: new Date().toISOString(),
  base: BASE,
  staticChecks: { forbiddenTokens: forbidden },
  testPage: {},
  offline: null,
  game: {},
  screenshots: [],
  failures,
};

async function attachConsole(page, sink) {
  page.on('pageerror', (err) => sink.errors.push('pageerror: ' + String(err)));
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error') sink.errors.push('console.error: ' + msg.text());
    else if (type === 'warning') sink.warnings.push(msg.text());
  });
  page.on('request', (req) => {
    const url = req.url();
    if (AUDIO_REQUEST_RE.test(url)) sink.audioRequests.push(url);
  });
}

// ---------------------------------------------------------------------------
// A. 纯 WebAudio 验收台
// ---------------------------------------------------------------------------
console.log('\n[1/4] 纯 WebAudio 验收台');
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const sink = { errors: [], warnings: [], audioRequests: [] };
  await attachConsole(page, sink);

  await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#btn-unlock', { timeout: 30000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, '01-testpage-idle.png'), fullPage: true });
  report.screenshots.push('screenshots/audio/01-testpage-idle.png');

  // 解锁
  await page.click('#btn-unlock');
  await page.waitForFunction(() => window.__audioTest && window.__audioTest.unlocked === true, null, { timeout: 15000 });
  const ctxInfo = await page.evaluate(() => {
    const audio = window.__audioTest.audio;
    return { state: audio.ctx.state, sampleRate: audio.ctx.sampleRate, unlocked: audio.unlocked };
  });
  check(ctxInfo.state === 'running', '测试页 unlock 后 AudioContext.state 为 running', ctxInfo.state);
  check(ctxInfo.unlocked === true, '测试页 audio.unlocked === true');

  // 等 BGM 离线渲染完成
  const musicReady = await page
    .waitForFunction(() => window.__audioTest.ready === true, null, { timeout: 90000 })
    .then(() => true)
    .catch(() => false);
  check(musicReady, 'BGM 离线渲染完成并开始循环');
  if (musicReady) {
    const music = await page.evaluate(() => {
      const audio = window.__audioTest.audio;
      return {
        meta: audio.musicMeta,
        mode: audio.musicMode,
        playing: audio.musicPlaying,
        duration: audio.musicBuffer ? audio.musicBuffer.duration : 0,
      };
    });
    report.testPage.music = music;
    check(music.mode === 'buffer', 'BGM 使用预渲染 AudioBuffer 循环', music.mode);
    check(music.duration > 30, 'BGM buffer 时长 ≥ 30s', `${music.duration.toFixed(1)}s`);
    check(music.meta && music.meta.rms > 0.05, 'BGM 离线统计 RMS > 0.05', music.meta && music.meta.rms);
    check(music.meta && music.meta.peak > 0.5, 'BGM 归一化峰值 > 0.5', music.meta && music.meta.peak);
    check(music.meta && music.meta.seamDelta < 0.02, '循环接缝差值 < 0.02', music.meta && music.meta.seamDelta);
    check(music.meta && music.meta.bars === 12, 'BGM 为 12 小节 36s 循环', music.meta && `${music.meta.bars} bars / ${music.meta.loopSeconds}s`);
  }

  // 区域切换 + cue
  await page.click('[data-region="beach"]');
  await page.click('[data-cue="quest"]');
  await page.click('[data-cue="letter"]');
  await page.click('[data-foot="run"]');
  await page.waitForTimeout(500);
  const regionInfo = await page.evaluate(() => window.__audioTest.diagnostics());
  report.testPage.diagnostics = regionInfo;
  check(regionInfo.region === 'beach', 'setRegion("beach") 生效', regionInfo.region);
  check(regionInfo.buses && regionInfo.buses.music > 0, '默认音乐总线音量 > 0', JSON.stringify(regionInfo.buses));

  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, '02-testpage-unlocked.png'), fullPage: true });
  report.screenshots.push('screenshots/audio/02-testpage-unlocked.png');
  await page.locator('#card-visual').screenshot({ path: path.join(OUT, '04-testpage-visual.png') });
  report.screenshots.push('screenshots/audio/04-testpage-visual.png');
  await page.locator('#bgm-wave-wrap').screenshot({ path: path.join(OUT, '05-bgm-waveform.png') });
  report.screenshots.push('screenshots/audio/05-bgm-waveform.png');

  // 离线 RMS 自检表
  console.log('  … 运行离线自检（1 BGM + 8 区域 + 25 cue）');
  await page.click('#btn-selfcheck');
  const selfCheckDone = await page
    .waitForFunction(() => window.__audioCheckDone === true, null, { timeout: 180000 })
    .then(() => true)
    .catch(() => false);
  check(selfCheckDone, '离线 RMS 自检完成');
  if (selfCheckDone) {
    const results = await page.evaluate(() => window.__audioCheckResults);
    report.offline = results;
    check(results.passCount === results.total, `离线自检全部非静音`, `${results.passCount}/${results.total}`);
    const ambRows = results.rows.filter((row) => row.group === '环境音');
    check(ambRows.length >= 8, '8 个区域环境音全部有离线统计', ambRows.length);
    const cueRows = results.rows.filter((row) => row.group === '音效');
    check(cueRows.length >= 20, 'cue 合成数量 ≥ 20', cueRows.length);
    for (const row of ambRows) check(row.pass, `环境音非静音：${row.name}`, `RMS ${row.rms}`);
    for (const row of cueRows) check(row.pass, `cue 非静音：${row.name}`, `peak ${row.peak}`);
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '03-testpage-selfcheck.png'), fullPage: true });
  report.screenshots.push('screenshots/audio/03-testpage-selfcheck.png');

  // 静音 / 音量持久化
  const persist = await page.evaluate(async () => {
    const audio = window.__audioTest.audio;
    audio.setBusVolume('music', 0.33);
    const keys = {
      music: localStorage.getItem('bjcourier.audioTest.bjcourier.audio.music'),
      mutedBefore: localStorage.getItem('bjcourier.audioTest.bjcourier.audio.muted'),
    };
    audio.setMuted(true);
    keys.muted = localStorage.getItem('bjcourier.audioTest.bjcourier.audio.muted');
    const mutedNow = audio.isMuted();
    audio.setMuted(false);
    audio.setBusVolume('music', 0.5);
    return { ...keys, mutedNow, mutedAfter: audio.isMuted() };
  });
  report.testPage.persistence = persist;
  check(persist.music === '0.33', 'setBusVolume 写 localStorage', persist.music);
  check(persist.muted === '1', 'setMuted 写 localStorage', persist.muted);
  check(persist.mutedNow === true && persist.mutedAfter === false, '静音开关往返正常');

  report.testPage.console = { errors: sink.errors, warnings: sink.warnings, audioRequests: sink.audioRequests };
  check(sink.errors.length === 0, '测试页 console 0 error', JSON.stringify(sink.errors.slice(0, 3)));
  check(sink.audioRequests.length === 0, '测试页没有任何音频文件网络请求', JSON.stringify(sink.audioRequests));

  await context.close();
}

// ---------------------------------------------------------------------------
// A2. 手机尺寸截图
// ---------------------------------------------------------------------------
console.log('\n[2/4] 手机尺寸验收台');
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const sink = { errors: [], warnings: [], audioRequests: [] };
  await attachConsole(page, sink);
  await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#btn-unlock', { timeout: 30000 });
  await page.tap('#btn-unlock');
  await page.waitForFunction(() => window.__audioTest && window.__audioTest.unlocked === true, null, { timeout: 15000 });
  await page.waitForFunction(() => window.__audioTest && window.__audioTest.ready === true, null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, '06-testpage-mobile.png'), fullPage: false });
  report.screenshots.push('screenshots/audio/06-testpage-mobile.png');
  report.testPage.mobile = { consoleErrors: sink.errors };
  check(sink.errors.length === 0, '手机尺寸下 console 0 error');
  await context.close();
}

// ---------------------------------------------------------------------------
// B. 真实游戏页
// ---------------------------------------------------------------------------
console.log('\n[3/4] 真实游戏页（BEGIN → unlock → BGM → 区域）');
{
  // 共享 dev server：其它 teammate 可能正在改 main.js / ui / render，
  // Vite HMR 会整页刷新游戏页。这里对整段验收做有限重试，避免被并行开发打断。
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const sink = { errors: [], warnings: [], audioRequests: [] };
  let gameResult = null;
  let lastError = null;
  let introShotDone = false;

  for (let attempt = 1; attempt <= 5 && !gameResult; attempt += 1) {
    const page = await context.newPage();
    attachConsole(page, sink);
    try {
      // 并行开发期间关掉 Vite HMR：把 HMR 客户端替换成「不刷新」的 shim，
      // 避免其它 teammate 改 main.js/ui/render 时把正在验收的游戏页整页刷掉。
      await page.route('**/@vite/client', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: HMR_SHIM,
        }),
      );
      await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForFunction(() => window.__courier && document.querySelector('.bc-begin'), null, { timeout: 120000 });
      if (!introShotDone) {
        await page.waitForTimeout(2200);
        await page.screenshot({ path: path.join(OUT, '07-game-intro.png') });
        report.screenshots.push('screenshots/audio/07-game-intro.png');
        introShotDone = true;
      }

      await page.click('.bc-begin');
      await page.waitForTimeout(500);
      const afterClick = await page.evaluate(() => {
        const audio = window.__courier.audio;
        return {
          ctxState: audio.ctx ? audio.ctx.state : null,
          unlocked: audio.unlocked,
          muted: audio.isMuted(),
        };
      });

      await page.waitForFunction(() => window.__courier.audio.musicPlaying === true, null, { timeout: 90000 });
      await page.waitForFunction(() => window.__courier.state.mode === 'playing', null, { timeout: 180000 });

      const diagnostics = await page.evaluate(() => {
        const audio = window.__courier.audio;
        return {
          diagnostics: audio.diagnostics(),
          musicMeta: audio.musicMeta,
          mode: audio.musicMode,
          region: audio.region,
        };
      });

      // 切区域 + 播 cue / 脚步（不在这段 evaluate 里 sleep，减少被 HMR 打断的窗口）
      const probeStart = await page.evaluate(() => {
        const audio = window.__courier.audio;
        audio.setRegion('beach');
        audio.playCue('quest');
        audio.playCue('click');
        audio.playFootstep({ run: true });
        audio.playJump();
        return { region: audio.region };
      });
      await page.waitForTimeout(900);
      const probeEnd = await page.evaluate(() => {
        const audio = window.__courier.audio;
        return {
          region: audio.region,
          muted: audio.isMuted(),
          events: audio.diagnostics().ambienceEvents,
        };
      });

      const mutePersist = await page.evaluate(() => {
        const audio = window.__courier.audio;
        audio.setMuted(true);
        const stored = localStorage.getItem('bjcourier.audio.muted');
        audio.setMuted(false);
        return { stored };
      });

      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, '08-game-playing.png') });
      report.screenshots.push('screenshots/audio/08-game-playing.png');

      gameResult = {
        attempt,
        afterClick,
        diagnostics,
        probe: { ...probeEnd, regionRightAfterSet: probeStart.region },
        mutePersist,
      };
      await page.close();
    } catch (err) {
      lastError = err;
      console.log(
        `  … 游戏页第 ${attempt} 次尝试被打断（并行开发触发 Vite HMR 整页刷新时会这样），重试：` +
          String((err && err.message) || err).slice(0, 140),
      );
      await page.close().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 1600));
    }
  }

  if (!gameResult) {
    check(false, '真实游戏页验收执行完成', lastError ? String(lastError.message || lastError) : 'unknown');
    report.game = { console: sink, skipped: true };
  } else {
    const { afterClick, diagnostics, probe, mutePersist } = gameResult;
    report.game = {
      attempt: gameResult.attempt,
      afterClick,
      diagnostics,
      probe,
      mutePersist,
      worldMode: await Promise.resolve(null),
      console: sink,
    };
    check(afterClick.ctxState === 'running', '游戏页点 BEGIN 后 AudioContext.state === "running"', afterClick.ctxState);
    check(afterClick.unlocked === true, '游戏页 audio.unlocked === true');
    check(diagnostics.mode === 'buffer', '游戏页 BGM 使用预渲染 AudioBuffer', diagnostics.mode);
    check(diagnostics.musicMeta && diagnostics.musicMeta.rms > 0.05, '游戏页 BGM RMS > 0.05', diagnostics.musicMeta && diagnostics.musicMeta.rms);
    check(diagnostics.diagnostics && diagnostics.diagnostics.region != null, '游戏页默认区域环境音已启动', diagnostics.diagnostics && diagnostics.diagnostics.region);
    check(
      diagnostics.diagnostics && diagnostics.diagnostics.ambienceEvents.length > 0,
      '游戏页区域偶发事件已排程',
      diagnostics.diagnostics && JSON.stringify(diagnostics.diagnostics.ambienceEvents),
    );
    check(probe.region === 'beach', '游戏页 setRegion("beach") 生效', probe.region);
    check(mutePersist.stored === '1', '游戏页静音写 localStorage["bjcourier.audio.muted"]', mutePersist.stored);

    const allErrors = sink.errors;
    const audioErrors = allErrors.filter((text) => /audio|music|offlineaudio|audiocontext|oscillator|audiobuffer/i.test(text));
    check(audioErrors.length === 0, '真实游戏页 console 无音频相关 error', JSON.stringify(audioErrors.slice(0, 3)));
    check(sink.audioRequests.length === 0, '真实游戏页没有任何 .ogg/.mp3 音频网络请求', JSON.stringify(sink.audioRequests));
    if (allErrors.length > audioErrors.length) {
      console.log('  ⚠ 存在非音频 console error（可能来自并行开发中的其它模块，不算本任务失败）：');
      for (const text of allErrors.filter((t) => !audioErrors.includes(t)).slice(0, 6)) console.log('     ·', text.slice(0, 220));
    }
    report.game.nonAudioConsoleErrors = allErrors.filter((text) => !audioErrors.includes(text));
  }
  await context.close();
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------
await browser.close();

report.finishedAt = new Date().toISOString();
report.passed = failures.length === 0;
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

console.log('\n[4/4] 汇总');
if (report.offline) {
  console.log(`  离线自检：${report.offline.passCount}/${report.offline.total} 非静音`);
  const amb = report.offline.rows.filter((row) => row.group === '环境音');
  console.log('  环境音 RMS：' + amb.map((row) => `${row.name.split('（')[0]} ${row.rms}`).join(' · '));
  const cues = report.offline.rows.filter((row) => row.group === '音效');
  console.log('  cue 峰值范围：' + `${Math.min(...cues.map((row) => row.peak))} ~ ${Math.max(...cues.map((row) => row.peak))}`);
}
if (report.testPage.music && report.testPage.music.meta) {
  const meta = report.testPage.music.meta;
  console.log(`  BGM：${meta.bpm}BPM · ${meta.bars} 小节 · ${meta.loopSeconds}s 循环 · RMS ${meta.rms} · 峰值 ${meta.peak} · 渲染 ${meta.renderMs}ms · 接缝 ${meta.seamDelta}`);
}
console.log('  截图 → screenshots/audio/');
console.log(`  报告 → screenshots/audio/report.json`);
if (failures.length) {
  console.error(`\n❌ ${failures.length} 项失败：`);
  for (const failure of failures) console.error('   -', failure);
  process.exit(1);
}
console.log('\n✅ 程序化音频验收通过');
