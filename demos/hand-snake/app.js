import { SnakeGame } from './game.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const WORKER_URL = './mp/hand.worker.js';
const MODEL_URL = new URL('./mp/hand_landmarker.task', document.baseURI).href;
const BEST_KEY = 'hand-snake-best';
const SOUND_KEY = 'hand-snake-sound';

const dom = {
  stage: $('#stage'),
  cam: $('#cam'),
  game: $('#game'),
  start: $('#start-screen'),
  btnCamera: $('#btn-camera'),
  btnMouse: $('#btn-mouse'),
  btnHelp: $('#btn-help'),
  btnSound: $('#btn-sound'),
  btnPause: $('#btn-pause'),
  btnReset: $('#btn-reset'),
  helpDialog: $('#help-dialog'),
  helpClose: $('#help-close'),
  loading: $('#loading'),
  loadingText: $('#loading-text'),
  countdown: $('#countdown'),
  pauseOverlay: $('#pause-overlay'),
  pauseText: $('#pause-text'),
  score: $('#score'),
  best: $('#best'),
  length: $('#length'),
  lenFill: $('#len-fill'),
  handState: $('#hand-state'),
  fps: $('#fps'),
  latency: $('#latency'),
  toast: $('#toast'),
  gesture: $('#gesture-hint'),
  privacy: $('#start-privacy'),
};

let game = null;
let worker = null;
let engineReady = false;
let cameraStream = null;
let videoFrameId = 0;
let fallbackTimer = 0;
let toastTimer = 0;
let audioContext = null;
let lastFrameSent = 0;
let countdownTimer = 0;

const state = {
  mode: 'idle', // idle | camera | mouse
  phase: 'start', // start | loading | countdown | playing | paused
  pending: false,
  requestSeq: 0,
  latency: 0,
  resultTimes: [],
  hand: null,
  handSeenAt: 0,
  handMissingToastAt: 0,
  gesture: 'none',
  fistSince: 0,
  openSince: 0,
  lastGestureAction: 0,
  smoothTarget: { x: 0.5, y: 0.55 },
  sound: true,
  best: 0,
  pausedByGesture: false,
  mouse: { x: 0.5, y: 0.55 },
  bootAt: performance.now(),
  framesSent: 0,
  results: 0,
  workerError: '',
};

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

function toast(message, duration = 3000) {
  dom.toast.textContent = message;
  dom.toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => dom.toast.classList.remove('is-visible'), duration);
}

function setPhase(phase) {
  state.phase = phase;
  dom.stage.dataset.phase = phase;
  const paused = phase === 'paused';
  dom.pauseOverlay.hidden = !paused;
  dom.btnPause.disabled = !(phase === 'playing' || phase === 'paused');
  dom.btnPause.textContent = paused ? '继续' : '暂停';
}

function formatScore(score) {
  return String(score).padStart(2, '0');
}

function updateHud() {
  dom.score.textContent = formatScore(game.score);
  dom.best.textContent = `BEST ${formatScore(state.best)}`;
  dom.length.textContent = `长度 ${game.length}`;
  dom.lenFill.style.width = `${Math.min(100, (game.length / 28) * 100)}%`;
}

function updateStats() {
  const now = performance.now();
  while (state.resultTimes.length && now - state.resultTimes[0] > 1500) state.resultTimes.shift();
  const fps = state.resultTimes.length / 1.5;
  if (dom.fps) dom.fps.textContent = fps ? `${fps.toFixed(0)} FPS` : '-- FPS';
  if (dom.latency) dom.latency.textContent = state.latency ? `${Math.round(state.latency)} ms` : '-- ms';
}

function setHandState(text, kind = '') {
  dom.handState.textContent = text;
  dom.handState.dataset.kind = kind;
}

/* ------------------------------------------------------------------ */
/* 声音                                                               */
/* ------------------------------------------------------------------ */

function ensureAudio() {
  if (audioContext) return audioContext;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    audioContext = null;
  }
  return audioContext;
}

function beep(frequency, duration = 0.08, type = 'sine', gain = 0.045, delay = 0) {
  if (!state.sound) return;
  const context = ensureAudio();
  if (!context) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const amp = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(amp);
  amp.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playEat() {
  beep(720, 0.07, 'triangle', 0.05);
  beep(1040, 0.07, 'triangle', 0.04, 0.06);
}

function playBonus() {
  [660, 880, 1180].forEach((frequency, index) => beep(frequency, 0.09, 'sine', 0.05, index * 0.07));
}

function playPause(paused) {
  beep(paused ? 400 : 620, 0.08, 'sine', 0.035);
}

/* ------------------------------------------------------------------ */
/* 摄像头 & 手部模型                                                   */
/* ------------------------------------------------------------------ */

function showLoading(text) {
  dom.loading.hidden = false;
  dom.loadingText.textContent = text;
  dom.start?.classList.add('is-loading');
  dom.btnCamera.disabled = true;
  dom.btnMouse.disabled = true;
}

function hideLoading() {
  dom.loading.hidden = true;
  dom.start?.classList.remove('is-loading');
  dom.btnCamera.disabled = false;
  dom.btnMouse.disabled = false;
}

function ensureWorker() {
  if (worker && engineReady) return Promise.resolve(worker);
  return new Promise((resolve, reject) => {
    const instance = new Worker(WORKER_URL);
    let settled = false;
    instance.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'ready') {
        settled = true;
        worker = instance;
        engineReady = true;
        resolve(instance);
        return;
      }
      if (data.type === 'result') {
        state.results += 1;
        handleHandResult(data);
        return;
      }
      if (data.type === 'error') {
        if (data.requestId) {
          state.pending = false;
          if (data.message) toast(`手部识别出错：${data.message}`);
        } else if (!settled) {
          settled = true;
          reject(new Error(data.message));
        } else {
          state.workerError = String(data.message || 'worker error');
          // 初始化之后的错误也要让人看到，而不是静默失败
          console.error('[hand-snake worker]', data.phase, data.message);
          toast(`手部识别出错：${data.message}`, 4200);
        }
      }
    };
    instance.onerror = (event) => {
      if (!settled) {
        settled = true;
        reject(new Error(event.message || '手部识别 Worker 加载失败'));
      }
    };
    const delegate = new URLSearchParams(window.location.search).get('delegate') || 'GPU';
    instance.postMessage({ type: 'init', modelUrl: MODEL_URL, delegate });
  });
}

async function startCamera() {
  if (state.phase === 'loading' || state.mode === 'camera') return;
  ensureAudio();
  setPhase('loading');
  showLoading('正在请求摄像头权限…');
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前浏览器不支持摄像头：请用 HTTPS 或 localhost 打开');
    }
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
  } catch (error) {
    hideLoading();
    setPhase('start');
    const name = error?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      toast('摄像头权限被拒绝。可以允许权限后刷新，或先用「鼠标模式」试玩。', 5200);
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      toast('没有找到可用摄像头，可以先用「鼠标模式」试玩。', 5200);
    } else {
      toast(`摄像头打开失败：${error?.message || error}`, 5200);
    }
    return;
  }

  dom.cam.srcObject = cameraStream;
  dom.cam.hidden = false;
  await dom.cam.play().catch(() => {});
  state.mode = 'camera';
  game.setArena(false);
  showLoading('正在加载手部 21 关键点模型…');
  try {
    await ensureWorker();
  } catch (error) {
    hideLoading();
    setPhase('start');
    toast(`手部模型加载失败：${error.message}。可以先用鼠标模式试玩。`, 5200);
    return;
  }
  hideLoading();
  startFramePump();
  beginCountdown();
}

function startMouseMode() {
  ensureAudio();
  stopCamera();
  state.mode = 'mouse';
  dom.start.hidden = true;
  dom.cam.hidden = true;
  game.setArena(true);
  game.clearHand();
  setHandState('鼠标模式', 'mouse');
  game.reset();
  updateHud();
  setPhase('playing');
  toast('鼠标模式：移动鼠标控制蛇头，吃光点变长');
  ensureGameLoop();
}

function stopCamera() {
  if (cameraStream) {
    for (const track of cameraStream.getTracks()) track.stop();
    cameraStream = null;
  }
  dom.cam.srcObject = null;
  cameraFrameStop();
}

function cameraFrameStop() {
  if (videoFrameId && dom.cam.requestVideoFrameCallback) {
    dom.cam.cancelVideoFrameCallback?.(videoFrameId);
  }
  videoFrameId = 0;
  if (fallbackTimer) {
    window.clearInterval(fallbackTimer);
    fallbackTimer = 0;
  }
}

function startFramePump() {
  cameraFrameStop();
  if (dom.cam.requestVideoFrameCallback) {
    const tick = () => {
      if (state.mode !== 'camera') return;
      const now = performance.now();
      if (!state.pending && dom.cam.readyState >= 2 && now - lastFrameSent > 45) {
        lastFrameSent = now;
        void sendHandFrame();
      }
      videoFrameId = dom.cam.requestVideoFrameCallback(tick);
    };
    videoFrameId = dom.cam.requestVideoFrameCallback(tick);
  } else {
    fallbackTimer = window.setInterval(() => {
      if (state.mode === 'camera' && !state.pending && dom.cam.readyState >= 2) void sendHandFrame();
    }, 50);
  }
}

async function sendHandFrame() {
  if (state.pending || !engineReady) return;
  state.pending = true;
  try {
    state.framesSent += 1;
    const bitmap = await createImageBitmap(dom.cam);
    worker.postMessage(
      {
        type: 'detect',
        requestId: ++state.requestSeq,
        bitmap,
        timestamp: performance.now(),
      },
      [bitmap],
    );
  } catch {
    state.pending = false;
  }
}

/* ------------------------------------------------------------------ */
/* 手部结果 → 游戏控制                                                 */
/* ------------------------------------------------------------------ */

function extendedFingers(landmarks) {
  // 图片坐标 y 轴向下：指尖 y 明显小于 PIP 关节视为伸直
  const fingers = [];
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  for (let i = 0; i < tips.length; i += 1) {
    const tip = landmarks[tips[i]];
    const pip = landmarks[pips[i]];
    const wrist = landmarks[0];
    const tipDistance = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    const pipDistance = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    if (tip.y < pip.y - 0.015 && tipDistance > pipDistance * 0.94) fingers.push(tips[i]);
  }
  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const thumbFar = Math.hypot(thumbTip.x - landmarks[0].x, thumbTip.y - landmarks[0].y);
  if (thumbFar > Math.hypot(thumbIp.x - landmarks[0].x, thumbIp.y - landmarks[0].y) * 1.1) {
    fingers.push(4);
  }
  return fingers;
}

function gestureOf(landmarks) {
  const extended = extendedFingers(landmarks);
  const pinch = Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y) < 0.055;
  if (pinch) return { name: 'pinch', count: extended.length };
  if (extended.length >= 3) return { name: 'open', count: extended.length };
  if (extended.length <= 1) return { name: 'fist', count: extended.length };
  return { name: 'half', count: extended.length };
}

/** 视频以 object-fit: cover 铺满舞台，这里把视频坐标转成舞台归一化坐标 */
function mapHandToStage(landmarks) {
  const videoWidth = dom.cam.videoWidth || 16;
  const videoHeight = dom.cam.videoHeight || 9;
  const rect = dom.stage.getBoundingClientRect();
  const stageWidth = rect.width || 1;
  const stageHeight = rect.height || 1;
  const scale = Math.max(stageWidth / videoWidth, stageHeight / videoHeight);
  const displayWidth = videoWidth * scale;
  const displayHeight = videoHeight * scale;
  const offsetX = (stageWidth - displayWidth) / 2;
  const offsetY = (stageHeight - displayHeight) / 2;
  return landmarks.map((point) => ({
    x: (offsetX + (1 - point.x) * displayWidth) / stageWidth,
    y: (offsetY + point.y * displayHeight) / stageHeight,
    z: point.z || 0,
  }));
}

function handleHandResult(data) {
  state.pending = false;
  state.resultTimes.push(performance.now());
  state.latency = Math.round(data.latency || 0);
  updateStats();

  const hand = data.hands?.[0];
  const now = performance.now();
  if (!hand) {
    if (state.phase === 'playing' && now - state.handSeenAt > 1500) {
      game.clearHand();
      setHandState('等待手部入镜…', 'waiting');
      if (now - state.handMissingToastAt > 9000) {
        state.handMissingToastAt = now;
        toast('把一只手掌放进画面，让食指指尖控制蛇头');
      }
    }
    return;
  }

  state.handSeenAt = now;
  state.hand = hand;
  // 摄像头预览是镜像 + cover 裁剪的，坐标要换算到舞台；识别仍用原始坐标
  const display = mapHandToStage(hand.landmarks);
  const fingertip = display[8];
  const smoothing = 0.62;
  state.smoothTarget.x = state.smoothTarget.x * (1 - smoothing) + fingertip.x * smoothing;
  state.smoothTarget.y = state.smoothTarget.y * (1 - smoothing) + fingertip.y * smoothing;
  game.setTarget(state.smoothTarget.x, state.smoothTarget.y);
  game.setHand(display, hand.handedness);

  const gesture = gestureOf(hand.landmarks);
  state.gesture = gesture.name;
  if (gesture.name === 'open') {
    if (!state.openSince) state.openSince = now;
    state.fistSince = 0;
  } else if (gesture.name === 'fist') {
    if (!state.fistSince) state.fistSince = now;
    state.openSince = 0;
  } else {
    state.openSince = 0;
    state.fistSince = 0;
  }

  const label = gesture.name === 'open' ? '手部已锁定 · 控制中' : gesture.name === 'fist' ? '握拳 · 暂停' : '手部已锁定';
  setHandState(label, gesture.name === 'open' ? 'open' : 'hand');

  // 握拳 0.45s 暂停；张开 0.6s 恢复
  if (state.phase === 'playing' && state.fistSince && now - state.fistSince > 450 && now - state.lastGestureAction > 1200) {
    state.lastGestureAction = now;
    state.pausedByGesture = true;
    togglePause();
  } else if (
    state.phase === 'paused' &&
    state.pausedByGesture &&
    gesture.name === 'open' &&
    now - state.openSince > 500 &&
    now - state.lastGestureAction > 1200
  ) {
    state.lastGestureAction = now;
    state.pausedByGesture = false;
    togglePause();
  }
}

/* ------------------------------------------------------------------ */
/* 游戏流程                                                           */
/* ------------------------------------------------------------------ */

function ensureGameLoop() {
  if (game.__loopStarted) return;
  game.__loopStarted = true;
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.phase === 'playing') game.update(dt);
    else if (state.phase === 'paused') {
      // 暂停时仍然更新粒子和轻微动效
      game.update(0);
    }
    game.render(now / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function beginCountdown() {
  hideStartScreen();
  setPhase('countdown');
  if (countdownTimer) window.clearInterval(countdownTimer);
  let value = 3;
  dom.countdown.hidden = false;
  dom.countdown.textContent = String(value);
  dom.countdown.animate(
    [
      { transform: 'scale(1.4)', opacity: 0 },
      { transform: 'scale(1)', opacity: 1, offset: 0.3 },
      { transform: 'scale(0.9)', opacity: 0 },
    ],
    { duration: 900, easing: 'ease-out' },
  );
  countdownTimer = window.setInterval(() => {
    value -= 1;
    if (value <= 0) {
      window.clearInterval(countdownTimer);
      countdownTimer = 0;
      dom.countdown.hidden = true;
      startPlaying();
      return;
    }
    dom.countdown.textContent = String(value);
    dom.countdown.animate(
      [
        { transform: 'scale(1.4)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1, offset: 0.3 },
        { transform: 'scale(0.9)', opacity: 0 },
      ],
      { duration: 900, easing: 'ease-out' },
    );
  }, 900);
}

function hideStartScreen() {
  dom.start.classList.add('is-hidden');
}

function startPlaying() {
  if (countdownTimer) {
    window.clearInterval(countdownTimer);
    countdownTimer = 0;
  }
  dom.countdown.hidden = true;
  game.setPaused(false);
  game.reset();
  state.smoothTarget = { x: game.segments[0].x, y: game.segments[0].y };
  updateHud();
  setPhase('playing');
  setHandState(state.mode === 'camera' ? '把手掌放进画面' : '鼠标模式', 'waiting');
  ensureGameLoop();
  if (state.mode === 'camera') toast('伸出食指，指尖就是蛇头；握拳可以暂停');
}

function togglePause() {
  if (state.phase === 'playing') {
    setPhase('paused');
    game.setPaused(true);
    playPause(true);
    dom.pauseText.textContent = state.pausedByGesture ? '握拳已暂停' : '已暂停';
  } else if (state.phase === 'paused') {
    setPhase('playing');
    game.setPaused(false);
    playPause(false);
    state.pausedByGesture = false;
  }
}

function restartGame() {
  state.pausedByGesture = false;
  game.reset();
  state.smoothTarget = { x: game.segments[0].x, y: game.segments[0].y };
  updateHud();
  setPhase('playing');
  game.setPaused(false);
  ensureGameLoop();
}

/* ------------------------------------------------------------------ */
/* 鼠标模式 & 事件                                                     */
/* ------------------------------------------------------------------ */

function onPointerMove(event) {
  if (state.mode !== 'mouse') return;
  const rect = dom.stage.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  state.mouse.x = x;
  state.mouse.y = y;
  game.setTarget(x, y);
}

function bindEvents() {
  dom.btnCamera.addEventListener('click', () => void startCamera());
  dom.btnMouse.addEventListener('click', () => startMouseMode());
  dom.btnHelp.addEventListener('click', () => dom.helpDialog.showModal());
  dom.helpClose.addEventListener('click', () => dom.helpDialog.close());
  dom.helpDialog.addEventListener('click', (event) => {
    if (event.target === dom.helpDialog) dom.helpDialog.close();
  });
  dom.btnPause.addEventListener('click', () => togglePause());
  dom.btnReset.addEventListener('click', () => restartGame());
  $('#pause-resume')?.addEventListener('click', () => togglePause());
  $('#pause-restart')?.addEventListener('click', () => restartGame());
  dom.btnSound.addEventListener('click', () => {
    state.sound = !state.sound;
    dom.btnSound.textContent = state.sound ? '声音 开' : '声音 关';
    dom.btnSound.dataset.on = state.sound ? 'true' : 'false';
    try {
      window.localStorage.setItem(SOUND_KEY, state.sound ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (state.sound) beep(700, 0.06);
  });

  dom.stage.addEventListener('pointermove', onPointerMove);
  dom.stage.addEventListener('pointerdown', () => {
    ensureAudio();
    if (state.mode === 'mouse' && state.phase === 'paused') togglePause();
  });

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'KeyP') {
      event.preventDefault();
      if (state.phase === 'playing' || state.phase === 'paused') togglePause();
    }
    if (event.code === 'KeyR') restartGame();
    if (event.code === 'KeyM') dom.btnSound.click();
    if (event.code === 'Escape' && dom.helpDialog.open) dom.helpDialog.close();
  });

  window.addEventListener('resize', () => game.resize());
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => game.resize()).observe(dom.stage);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.phase === 'playing') togglePause();
  });
}

/* ------------------------------------------------------------------ */
/* 启动                                                               */
/* ------------------------------------------------------------------ */

function readSettings() {
  try {
    const best = Number(window.localStorage.getItem(BEST_KEY) || '0');
    if (Number.isFinite(best) && best > 0) state.best = best;
  } catch {
    /* ignore */
  }
  try {
    const sound = window.localStorage.getItem(SOUND_KEY);
    if (sound === '0') state.sound = false;
  } catch {
    /* ignore */
  }
  dom.btnSound.textContent = state.sound ? '声音 开' : '声音 关';
  dom.btnSound.dataset.on = state.sound ? 'true' : 'false';
}

function extendBest() {
  if (game.score > state.best) {
    state.best = game.score;
    try {
      window.localStorage.setItem(BEST_KEY, String(state.best));
    } catch {
      /* ignore */
    }
  }
}

function boot() {
  game = new SnakeGame(dom.game, {
    onEat: () => {
      if (state.phase !== 'playing') return;
      playEat();
      extendBest();
      updateHud();
    },
    onBonus: () => {
      if (state.phase !== 'playing') return;
      playBonus();
      extendBest();
      updateHud();
    },
  });
  game.resize();
  readSettings();
  updateHud();
  bindEvents();
  setPhase('start');
  setHandState('摄像头未启动', 'idle');
  dom.countdown.hidden = true;
  ensureGameLoop();

  // 测试钩子：只在 ?test=1 时暴露，方便自动截图/回归，不影响正常使用
  if (new URLSearchParams(window.location.search).has('test')) {
    window.__snakeTest = {
      startMouse: () => startMouseMode(),
      startCamera: () => startCamera(),
      skipCountdown: () => {
        if (countdownTimer) {
          window.clearInterval(countdownTimer);
          countdownTimer = 0;
        }
        hideStartScreen();
        startPlaying();
      },
      startPlaying: () => startPlaying(),
      setTarget: (x, y) => game.setTarget(x, y),
      setHand: (landmarks, handedness = 'Right') => {
        const display = landmarks.map((point) => ({ x: point.x, y: point.y }));
        game.setHand(display, handedness);
        game.setTarget(display[8].x, display[8].y);
      },
      setSnake: (points) => {
        game.segments = points.map((point) => ({ x: point.x, y: point.y }));
        updateHud();
      },
      setFood: (x, y, bonus = false) => {
        game.food = { x, y, bonus, bornAt: performance.now(), radius: bonus ? 0.026 : 0.018 };
      },
      head: () => ({ ...game.segments[0] }),
      food: () => ({ ...game.food }),
      setScore: (score, foodsEaten = undefined) => {
        game.score = score;
        if (Number.isFinite(foodsEaten)) game.foodsEaten = foodsEaten;
        extendBest();
        updateHud();
      },
      addBurst: (x, y, color = '#9dffb0', count = 18) => {
        game.addParticles({ x, y }, color, count);
        game.addPopup({ x, y }, '+1', color);
      },
      state: () => ({
        mode: state.mode,
        phase: state.phase,
        score: game.score,
        length: game.length,
        handActive: game.handActive,
        target: { ...state.smoothTarget },
      }),
      debug: () => ({
        mode: state.mode,
        phase: state.phase,
        pending: state.pending,
        engineReady,
        framesSent: state.framesSent,
        results: state.results,
        latency: state.latency,
        workerError: state.workerError,
        videoReady: dom.cam.readyState,
        videoSize: [dom.cam.videoWidth, dom.cam.videoHeight],
      }),
    };
  }
}

boot();
