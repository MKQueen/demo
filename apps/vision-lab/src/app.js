import { colorFor, positionHint, resolveCategoryName, zhLabel } from './labels.js';
import { Tracker, nms } from './tracker.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const WORKER_URL = './mp/detector.worker.js';

const MODELS = {
  accurate: {
    key: 'accurate',
    label: '高精度',
    short: 'Lite2',
    url: new URL('./mp/efficientdet_lite2.tflite', document.baseURI).href,
    note: 'EfficientDet-Lite2 · 448 输入 · 小目标更准，推理稍慢',
  },
  fast: {
    key: 'fast',
    label: '快速',
    short: 'Lite0',
    url: new URL('./mp/person_detector.tflite', document.baseURI).href,
    note: 'EfficientDet-Lite0 · 320 输入 · 更快，适合低配设备',
  },
};
const MODEL_PREF_KEY = 'vision-lab-model';

function modelFromUrl(url) {
  return String(url || '').includes('lite2') ? 'accurate' : 'fast';
}

function modelShort(key) {
  return MODELS[key] ? MODELS[key].short : 'Lite';
}

const dom = {
  video: $('#video'),
  image: $('#image'),
  overlay: $('#overlay'),
  viewport: $('#viewport'),
  empty: $('#empty'),
  loading: $('#loading'),
  loadingTitle: $('#loading-title'),
  loadingSub: $('#loading-sub'),
  engineBadge: $('#engine-badge'),
  engineText: $('#engine-text'),
  sourceLabel: $('#source-label'),
  hudFps: $('#hud-fps'),
  hudLatency: $('#hud-latency'),
  hudCount: $('#hud-count'),
  hudTotal: $('#hud-total'),
  hudRes: $('#hud-res'),
  hudStatus: $('#hud-status'),
  hudSource: $('#hud-source'),
  modelCaption: $('#model-caption'),
  liveDot: $('#live-dot'),
  detectionList: $('#detection-list'),
  detectionsCount: $('#detections-count'),
  threshold: $('#threshold'),
  thresholdValue: $('#threshold-value'),
  maxObjects: $('#max-objects'),
  maxValue: $('#max-value'),
  mirror: $('#mirror'),
  showLabels: $('#show-labels'),
  btnPause: $('#btn-pause'),
  btnStop: $('#btn-stop'),
  btnSnapshot: $('#btn-snapshot'),
  fileImage: $('#file-image'),
  fileVideo: $('#file-video'),
  videoControls: $('#video-controls'),
  btnVideoPlay: $('#btn-video-play'),
  videoSeek: $('#video-seek'),
  videoTime: $('#video-time'),
  modelNote: $('#model-note'),
  aiNote: $('#ai-note'),
  aiAsk: $('#ai-ask'),
  aiVision: $('#ai-vision'),
  aiAuto: $('#ai-auto'),
  aiAnswer: $('#ai-answer'),
  aiLog: $('#ai-log'),
  aiCaption: $('#ai-caption'),
  aiCaptionText: $('#ai-caption-text'),
  trackSummary: $('#track-summary'),
  eventList: $('#event-list'),
  eventsClear: $('#events-clear'),
  toast: $('#toast'),
  helpDialog: $('#help-dialog'),
  helpOpen: $('#help-open'),
  helpClose: $('#help-close'),
};

const state = {
  engine: 'idle', // idle | loading | ready | error
  source: 'none', // none | camera | video | image
  sourceName: '',
  running: false,
  pending: false,
  requestSeq: 0,
  sourceToken: 0,
  imageWarmupToken: 0,
  detections: [],
  selectedTrackId: 0,
  tracker: new Tracker(),
  totalTracks: 0,
  events: [],
  aiAutoTimer: 0,
  aiLog: [],
  model: 'accurate',
  modelBeforeSwitch: 'accurate',
  threshold: 0.45,
  maxObjects: 15,
  mirror: true,
  showLabels: true,
  sourceWidth: 0,
  sourceHeight: 0,
  latency: 0,
  resultTimes: [],
  lastDrawAt: 0,
  lastListAt: 0,
  lastHudAt: 0,
  videoRaf: 0,
  fallbackTimer: 0,
  objectUrl: '',
  cameraStream: null,
  ai: { configured: false, model: '', busy: false, checked: false },
  detectedCount: 0,
};

let worker = null;
let enginePromise = null;
let toastTimer = 0;
let seekDragging = false;

/* ------------------------------------------------------------------ */
/* 小工具                                                             */
/* ------------------------------------------------------------------ */

function toast(message, duration = 3200) {
  dom.toast.textContent = message;
  dom.toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => dom.toast.classList.remove('is-visible'), duration);
}

function setEngine(stateName, text) {
  state.engine = stateName;
  dom.engineBadge.dataset.state = stateName;
  dom.engineText.textContent = text;
}

function showLoading(visible, title = '', sub = '') {
  dom.loading.hidden = !visible;
  if (title) dom.loadingTitle.textContent = title;
  if (sub) dom.loadingSub.textContent = sub;
}

function showEmpty(visible) {
  dom.empty.hidden = !visible;
}

function setHudStatus(text, live = false) {
  dom.hudStatus.textContent = text;
  dom.liveDot.classList.toggle('is-live', live);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function mediaAspect() {
  if (!state.sourceWidth || !state.sourceHeight) return 16 / 9;
  return state.sourceWidth / state.sourceHeight;
}

/* ------------------------------------------------------------------ */
/* 引擎（Worker 内 MediaPipe）                                        */
/* ------------------------------------------------------------------ */

function ensureEngine() {
  if (enginePromise) return enginePromise;
  enginePromise = new Promise((resolve, reject) => {
    const activeModel = MODELS[state.model] || MODELS.accurate;
    setEngine('loading', `加载${activeModel.label}模型…`);
    showLoading(
      true,
      `正在加载${activeModel.label}检测模型…`,
      state.model === 'accurate'
        ? '首次加载约 50 MB（Lite2 模型 + WASM），之后走浏览器缓存'
        : '首次加载约 40 MB（Lite0 模型 + WASM），之后走浏览器缓存',
    );

    let settled = false;
    const finish = (ok, detail) => {
      if (settled) return;
      settled = true;
      showLoading(false);
      if (ok) {
        setEngine('ready', `引擎就绪 · ${detail}`);
        resolve(true);
      } else {
        setEngine('error', '引擎加载失败');
        reject(new Error(detail || '引擎初始化失败'));
      }
    };

    try {
      worker = new Worker(WORKER_URL);
    } catch (error) {
      finish(false, `无法创建检测 Worker：${error.message}`);
      return;
    }

    worker.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'ready') {
        const usedModel = modelFromUrl(data.url);
        state.model = usedModel;
        applyModelUi();
        if (data.fallbackUsed) toast(`高精度模型加载失败，已回退到快速模型：${data.fallbackReason || ''}`, 5200);
        finish(
          true,
          `${modelShort(usedModel)} · ${data.delegate === 'GPU' ? 'GPU' : 'CPU'} · Worker`,
        );
        worker.postMessage({ type: 'config', scoreThreshold: state.threshold, maxResults: state.maxObjects });
        return;
      }
      if (data.type === 'modelReady') {
        showLoading(false);
        const usedModel = modelFromUrl(data.url);
        state.model = usedModel;
        state.pending = false;
        applyModelUi();
        setEngine('ready', `引擎就绪 · ${modelShort(usedModel)} · ${data.delegate === 'GPU' ? 'GPU' : 'CPU'}`);
        if (data.fallbackUsed) toast(`高精度模型加载失败，已回退快速模型：${data.fallbackReason || ''}`, 5200);
        else toast(`检测模型已切换：${MODELS[usedModel].label}（${MODELS[usedModel].short}）`);
        if (state.source === 'image') detectImage();
        return;
      }
      if (data.type === 'result') {
        handleResult(data);
        return;
      }
      if (data.type === 'error') {
        if (data.phase === 'model') {
          showLoading(false);
          state.model = state.modelBeforeSwitch;
          applyModelUi();
          toast(`模型切换失败（继续使用原模型）：${data.message}`, 5200);
          return;
        }
        if (data.requestId) {
          state.pending = false;
          if (data.message && !/模型尚未初始化/.test(data.message)) toast(`检测出错：${data.message}`);
        } else {
          finish(false, data.message);
        }
      }
    };

    worker.onerror = (event) => {
      if (!settled) finish(false, event.message || '检测 Worker 加载失败');
    };

    worker.postMessage({
      type: 'init',
      modelUrl: MODELS[state.model].url,
      fallbackUrl: MODELS.fast.url,
    });
  });
  enginePromise.catch(() => {
    // 允许用户重试：清空缓存的 promise，下一次输入时重新初始化
    enginePromise = null;
  });
  return enginePromise;
}

function applyModelUi() {
  const model = MODELS[state.model] || MODELS.accurate;
  dom.modelNote.textContent = model.note;
  if (dom.modelCaption) {
    dom.modelCaption.textContent = `MODEL / EfficientDet-${model.short} · ${model.short === 'Lite2' ? '448×448' : '320×320'} · COCO 80`;
  }
  $$('[data-model]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.model === state.model);
  });
  try {
    window.localStorage.setItem(MODEL_PREF_KEY, state.model);
  } catch {
    /* 隐私模式下忽略 */
  }
}

function switchModel(key) {
  const next = MODELS[key];
  if (!next || key === state.model) return;
  state.modelBeforeSwitch = state.model;
  state.model = key;
  applyModelUi();
  if (state.engine === 'ready' && worker) {
    state.pending = false;
    state.sourceToken += 1;
    showLoading(true, `正在切换${next.label}检测模型…`, '模型文件已缓存时切换会很快');
    worker.postMessage({ type: 'model', modelUrl: next.url, fallbackUrl: MODELS.fast.url });
  } else {
    enginePromise = null;
    if (state.engine === 'error') setEngine('idle', '引擎待命');
    toast(`下次启用时使用${next.label}模型`);
  }
}

function sendConfig() {
  if (worker && state.engine === 'ready') {
    worker.postMessage({
      type: 'config',
      scoreThreshold: state.threshold,
      maxResults: state.maxObjects,
    });
  }
}

/* ------------------------------------------------------------------ */
/* 数据源：摄像头 / 视频 / 图片                                        */
/* ------------------------------------------------------------------ */

function stopSource() {
  state.sourceToken += 1;
  state.running = false;
  if (state.videoRaf && dom.video.requestVideoFrameCallback) {
    dom.video.cancelVideoFrameCallback?.(state.videoRaf);
  }
  state.videoRaf = 0;
  if (state.fallbackTimer) {
    window.clearInterval(state.fallbackTimer);
    state.fallbackTimer = 0;
  }
  if (state.cameraStream) {
    for (const track of state.cameraStream.getTracks()) track.stop();
    state.cameraStream = null;
  }
  dom.video.pause();
  dom.video.srcObject = null;
  dom.video.removeAttribute('src');
  dom.video.load();
  dom.video.hidden = true;
  dom.video.classList.remove('mirror');
  dom.image.hidden = true;
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = '';
  }
  state.source = 'none';
  state.sourceName = '';
  state.pending = false;
  state.detections = [];
  state.detectedCount = 0;
  state.selectedTrackId = 0;
  resetAnalyzer();
  dom.btnPause.hidden = true;
  dom.btnStop.hidden = true;
  dom.videoControls.hidden = true;
  dom.btnSnapshot.disabled = true;
  dom.sourceLabel.textContent = '未连接';
  dom.hudSource.textContent = '未连接输入';
  dom.hudRes.textContent = '—';
  dom.hudFps.textContent = '—';
  dom.hudLatency.textContent = '—';
  setHudStatus('待机', false);
  paintOverlay();
  renderList(true);
  $$('.source-btn').forEach((button) => button.classList.remove('is-active'));
  showEmpty(true);
}

async function startCamera() {
  await startSourceWithGuard(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前环境不支持摄像头：需要 HTTPS 或 localhost 才能调用 getUserMedia');
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
    } catch (error) {
      const name = error?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        throw new Error('摄像头权限被拒绝：请在浏览器地址栏允许摄像头权限后重试');
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        throw new Error('没有找到可用摄像头：可以改用「上传视频 / 图片」体验');
      }
      throw new Error(`无法打开摄像头：${error?.message || error}`);
    }
    stopSource();
    state.cameraStream = stream;
    dom.video.srcObject = stream;
    dom.video.classList.toggle('mirror', state.mirror);
    dom.video.hidden = false;
    await dom.video.play();
    bindSource('camera', '摄像头 LIVE CAMERA');
    dom.btnStop.hidden = false;
    startFramePump();
    toast('摄像头已开启 · 把物体放进画面试试');
  });
}

async function startVideoFile(file) {
  await startSourceWithGuard(async () => {
    if (!file) return;
    stopSource();
    state.objectUrl = URL.createObjectURL(file);
    dom.video.src = state.objectUrl;
    dom.video.loop = true;
    dom.video.muted = true;
    dom.video.hidden = false;
    await dom.video.play();
    bindSource('video', `视频 ${file.name}`);
    dom.btnPause.hidden = false;
    dom.btnStop.hidden = false;
    dom.videoControls.hidden = false;
    dom.btnSnapshot.disabled = false;
    startFramePump();
    updateVideoMeta();
    toast(`正在识别视频：${file.name}`);
  });
}

async function startImageSource(src, label = '图片') {
  await startSourceWithGuard(async () => {
    stopSource();
    const url = new URL(src, document.baseURI).href;
    if (url.startsWith('blob:')) state.objectUrl = url;
    dom.image.src = url;
    await dom.image.decode();
    dom.image.hidden = false;
    bindSource('image', label);
    dom.btnStop.hidden = false;
    dom.btnSnapshot.disabled = false;
    state.sourceWidth = dom.image.naturalWidth;
    state.sourceHeight = dom.image.naturalHeight;
    updateHud(true);
    detectImage();
    toast(`正在识别：${label}`);
  });
}

/** 统一处理「加载引擎 → 打开数据源」的错误与 loading 状态 */
async function startSourceWithGuard(action) {
  try {
    await ensureEngine();
  } catch (error) {
    toast(`模型加载失败：${error.message}`);
    return;
  }
  try {
    await action();
  } catch (error) {
    toast(String(error?.message || error));
    stopSource();
  }
}

function bindSource(source, name) {
  state.sourceToken += 1;
  state.source = source;
  state.sourceName = name;
  showEmpty(false);
  dom.sourceLabel.textContent = source === 'camera' ? '摄像头' : source === 'video' ? '视频' : '图片';
  dom.hudSource.textContent = name;
  state.detectedCount = 0;
  setHudStatus(source === 'image' ? '单帧识别' : '实时检测中', source !== 'image');
  $$('.source-btn').forEach((button) => button.classList.toggle('is-active', button.dataset.source === source));
}

/* ------------------------------------------------------------------ */
/* 检测循环                                                           */
/* ------------------------------------------------------------------ */

function startFramePump() {
  if (!state.running) state.running = true;

  if (dom.video.requestVideoFrameCallback) {
    const onFrame = (now) => {
      if (!state.running) return;
      maybeDetect(now);
      state.videoRaf = dom.video.requestVideoFrameCallback(onFrame);
    };
    state.videoRaf = dom.video.requestVideoFrameCallback(onFrame);
  } else {
    state.fallbackTimer = window.setInterval(() => {
      if (!state.running) return;
      maybeDetect(performance.now());
    }, 70);
  }
}

function maybeDetect(now) {
  if (state.engine !== 'ready' || state.pending) return;
  if (now - (state.lastSentAt || 0) < 55) return;
  if (!dom.video.videoWidth || dom.video.readyState < 2) return;
  state.lastSentAt = now;
  void sendVideoFrame();
}

async function sendVideoFrame() {
  if (state.pending) return;
  state.pending = true;
  try {
    const bitmap = await createImageBitmap(dom.video);
    state.sourceWidth = bitmap.width;
    state.sourceHeight = bitmap.height;
    worker.postMessage(
      {
        type: 'detect',
        requestId: ++state.requestSeq,
        token: state.sourceToken,
        bitmap,
        timestamp: performance.now(),
        mode: 'video',
      },
      [bitmap],
    );
  } catch (error) {
    state.pending = false;
  }
}

async function detectImage() {
  if (!worker || state.pending) return;
  state.pending = true;
  try {
    const bitmap = await createImageBitmap(dom.image);
    state.sourceWidth = bitmap.width;
    state.sourceHeight = bitmap.height;
    worker.postMessage(
      {
        type: 'detect',
        requestId: ++state.requestSeq,
        token: state.sourceToken,
        bitmap,
        timestamp: performance.now(),
        mode: 'image',
      },
      [bitmap],
    );
  } catch (error) {
    state.pending = false;
    toast(`图片识别失败：${error.message}`);
  }
}

function handleResult(data) {
  if (data.token !== state.sourceToken) {
    state.pending = false;
    return;
  }
  state.pending = false;
  const now = performance.now();
  state.resultTimes.push(now);
  while (state.resultTimes.length && now - state.resultTimes[0] > 2000) state.resultTimes.shift();
  // 图片模式只检测一帧；首帧推理包含 shader 编译，自动补跑一帧让耗时显示为真实稳态值
  if (state.source === 'image' && state.imageWarmupToken !== state.sourceToken) {
    state.imageWarmupToken = state.sourceToken;
    window.setTimeout(() => {
      if (state.source === 'image' && !state.pending) detectImage();
    }, 60);
  }
  state.latency = Math.round(data.latency || 0);
  state.detectedCount = (data.detections || []).length;

  // 同类别 NMS 去掉重复框，再用 IoU 跟踪串成稳定 #ID
  const clean = nms(
    (data.detections || []).map((item) => {
      const en = resolveCategoryName(item.name, item.index);
      return {
        en: en || 'object',
        zh: zhLabel(en),
        score: item.score,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      };
    }),
  );
  const tracked = state.tracker.update(clean);
  state.totalTracks = tracked.total;
  for (const track of tracked.entered) {
    pushEvent({ type: 'enter', id: track.id, zh: track.zh, en: track.en, at: track.firstSeen, duration: 0 });
  }
  for (const track of tracked.exited) {
    pushEvent({
      type: 'exit',
      id: track.id,
      zh: track.zh,
      en: track.en,
      at: track.lastSeen,
      duration: track.durationMs,
    });
  }

  state.detections = tracked.tracks.map((track) => ({
    id: track.id,
    en: track.en,
    zh: track.zh,
    color: colorFor(track.en),
    score: track.score,
    x: track.x,
    y: track.y,
    w: track.w,
    h: track.h,
    durationMs: track.durationMs,
    trail: track.trail,
  }));

  if (state.selectedTrackId && !state.detections.some((item) => item.id === state.selectedTrackId)) {
    state.selectedTrackId = 0;
  }

  paintOverlay();
  renderList();
  updateHud();
  updateSummary();
}

/* ------------------------------------------------------------------ */
/* 画布标注                                                           */
/* ------------------------------------------------------------------ */

function paintOverlay() {
  const rect = dom.viewport.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = dom.overlay;
  const targetWidth = Math.round(rect.width * dpr);
  const targetHeight = Math.round(rect.height * dpr);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  if (!state.sourceWidth || !state.sourceHeight || !state.detections.length) return;

  const aspect = mediaAspect();
  let drawWidth = rect.width;
  let drawHeight = drawWidth / aspect;
  if (drawHeight > rect.height) {
    drawHeight = rect.height;
    drawWidth = drawHeight * aspect;
  }
  const offsetX = (rect.width - drawWidth) / 2;
  const offsetY = (rect.height - drawHeight) / 2;
  const mirrored = state.source === 'camera' && state.mirror;

  // 运动轨迹：把每个目标最近的中心点连成渐隐折线，视频/摄像头才有
  if (state.source !== 'image') {
    for (const detection of state.detections) {
      const trail = detection.trail || [];
      if (trail.length < 3) continue;
      ctx.save();
      ctx.strokeStyle = detection.color;
      ctx.lineWidth = detection.id === state.selectedTrackId ? 2 : 1.2;
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      trail.forEach((point, index) => {
        const px = offsetX + (mirrored ? 1 - point.x : point.x) * drawWidth;
        const py = offsetY + point.y * drawHeight;
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.restore();
    }
  }

  for (const detection of state.detections) {
    let x = detection.x;
    if (mirrored) x = 1 - detection.x - detection.w;
    const px = offsetX + x * drawWidth;
    const py = offsetY + detection.y * drawHeight;
    const pw = detection.w * drawWidth;
    const ph = detection.h * drawHeight;
    drawBox(ctx, detection, px, py, pw, ph, rect.width);
  }
  state.lastDrawAt = performance.now();
}

function drawBox(ctx, detection, x, y, width, height, maxWidth = 0) {
  const selected = detection.id === state.selectedTrackId;
  const color = detection.color;
  const line = selected ? 2.4 : 1.4;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = line;
  ctx.shadowColor = color;
  ctx.shadowBlur = selected ? 14 : 6;
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, width - 1), Math.max(1, height - 1));

  // 四角加粗，形成取景框质感
  ctx.shadowBlur = 0;
  ctx.lineWidth = selected ? 3.4 : 2.4;
  const corner = Math.min(16, Math.max(8, Math.min(width, height) * 0.18));
  const segments = [
    [x, y, x + corner, y],
    [x, y, x, y + corner],
    [x + width, y, x + width - corner, y],
    [x + width, y, x + width, y + corner],
    [x, y + height, x + corner, y + height],
    [x, y + height, x, y + height - corner],
    [x + width, y + height, x + width - corner, y + height],
    [x + width, y + height, x + width, y + height - corner],
  ];
  for (const [x1, y1, x2, y2] of segments) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  if (state.showLabels) {
    const text = `#${String(detection.id).padStart(2, '0')} ${detection.zh} ${detection.en}`;
    const scoreText = `${Math.round(detection.score * 100)}%`;
    ctx.font = '600 11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    const textWidth = ctx.measureText(text).width;
    ctx.font = '500 10px "SF Mono", ui-monospace, Menlo, monospace';
    const scoreWidth = ctx.measureText(scoreText).width;
    const chipWidth = textWidth + scoreWidth + 20;
    const chipHeight = 20;
    let chipX = x;
    let chipY = y - chipHeight - 4;
    if (chipY < 2) chipY = y + 4;
    const clampWidth = maxWidth || ctx.canvas.width;
    if (chipX + chipWidth > clampWidth) chipX = Math.max(2, x + width - chipWidth);

    ctx.fillStyle = 'rgba(3, 9, 11, 0.82)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    roundedRect(ctx, chipX, chipY, chipWidth, chipHeight, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = '600 11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, chipX + 7, chipY + chipHeight / 2 + 0.5);
    ctx.fillStyle = 'rgba(230, 244, 238, 0.72)';
    ctx.font = '500 10px "SF Mono", ui-monospace, Menlo, monospace';
    ctx.fillText(scoreText, chipX + chipWidth - scoreWidth - 7, chipY + chipHeight / 2 + 0.5);

    if (selected) {
      const cx = x + width / 2;
      const cy = y + height / 2;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.moveTo(cx - 11, cy);
      ctx.lineTo(cx - 8, cy);
      ctx.moveTo(cx + 8, cy);
      ctx.lineTo(cx + 11, cy);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* 结果列表 / HUD                                                     */
/* ------------------------------------------------------------------ */

function renderList(force = false) {
  const now = performance.now();
  if (!force && now - state.lastListAt < 160) return;
  state.lastListAt = now;

  dom.detectionsCount.textContent = String(state.detections.length);
  const host = dom.detectionList;
  host.textContent = '';

  if (!state.detections.length) {
    const row = document.createElement('li');
    row.className = 'empty-row';
    row.textContent = state.source === 'none' ? '等待画面…' : '暂未检测到物体';
    host.appendChild(row);
    return;
  }

  for (const detection of state.detections) {
    const item = document.createElement('li');
    item.className = 'detection-item';
    item.style.setProperty('--dot-color', detection.color);
    item.dataset.trackId = String(detection.id);
    if (detection.id === state.selectedTrackId) item.classList.add('is-selected');

    const dot = document.createElement('span');
    dot.className = 'dot';

    const name = document.createElement('span');
    name.className = 'name';
    const idTag = document.createElement('i');
    idTag.className = 'track-id';
    idTag.textContent = `#${String(detection.id).padStart(2, '0')}`;
    const zh = document.createElement('b');
    zh.textContent = detection.zh;
    const en = document.createElement('em');
    en.textContent = detection.en;
    name.append(idTag, zh, en);

    const bar = document.createElement('span');
    bar.className = 'score-bar';
    const fill = document.createElement('i');
    fill.style.width = `${Math.max(4, Math.round(detection.score * 100))}%`;
    bar.appendChild(fill);

    const score = document.createElement('span');
    score.className = 'score-num';
    score.textContent = `${Math.round(detection.score * 100)}%`;

    item.append(dot, name, bar, score);
    item.addEventListener('click', () => {
      state.selectedTrackId = state.selectedTrackId === detection.id ? 0 : detection.id;
      renderList(true);
      paintOverlay();
    });
    host.appendChild(item);
  }
}

function updateHud(force = false) {
  const now = performance.now();
  if (!force && now - state.lastHudAt < 220) return;
  state.lastHudAt = now;

  const fps = state.resultTimes.length / 2;
  // 图片是单帧识别，FPS 没有意义；实时流才显示检测帧率
  dom.hudFps.textContent = state.source === 'image' ? '—' : fps ? fps.toFixed(0) : '—';
  dom.hudLatency.textContent = state.latency ? `${state.latency}ms` : '—';
  dom.hudCount.textContent = String(state.detections.length);
  dom.hudTotal.textContent = String(state.totalTracks || 0);
  dom.hudRes.textContent = state.sourceWidth && state.sourceHeight ? `${state.sourceWidth}×${state.sourceHeight}` : '—';
}

function pushEvent(event) {
  const now = new Date();
  const time = now.toLocaleTimeString('zh-CN', { hour12: false });
  state.events.unshift({
    ...event,
    time,
    duration: event.duration || 0,
  });
  if (state.events.length > 40) state.events.length = 40;
  renderEvents();
}

function renderEvents() {
  const host = dom.eventList;
  if (!host) return;
  host.textContent = '';
  if (!state.events.length) {
    const row = document.createElement('li');
    row.className = 'empty-row';
    row.textContent = '暂无事件 · 目标进入/离开画面时记录';
    host.appendChild(row);
    return;
  }
  for (const event of state.events.slice(0, 10)) {
    const row = document.createElement('li');
    row.className = `event-item is-${event.type}`;
    const time = document.createElement('span');
    time.className = 'event-time';
    time.textContent = event.time;
    const id = document.createElement('span');
    id.className = 'event-id';
    id.textContent = `#${String(event.id).padStart(2, '0')}`;
    const body = document.createElement('span');
    body.className = 'event-body';
    const detail =
      event.type === 'enter'
        ? `进入画面 · ${event.zh}`
        : `离开画面 · ${event.zh} · 停留 ${(event.duration / 1000).toFixed(1)}s`;
    body.textContent = detail;
    row.append(time, id, body);
    host.appendChild(row);
  }
}

function updateSummary() {
  if (!dom.trackSummary) return;
  const counts = new Map();
  for (const detection of state.detections) {
    counts.set(detection.zh, (counts.get(detection.zh) || 0) + 1);
  }
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name} ×${count}`)
    .join(' · ');
  dom.trackSummary.textContent = `当前 ${state.detections.length} 个目标 · 累计 ${state.totalTracks || 0}${top ? ' · ' + top : ''}`;
}

function resetAnalyzer() {
  state.tracker.reset();
  state.totalTracks = 0;
  state.events = [];
  renderEvents();
  updateSummary();
}

/* ------------------------------------------------------------------ */
/* 视频播放控制                                                       */
/* ------------------------------------------------------------------ */

function updateVideoMeta() {
  const duration = dom.video.duration;
  dom.videoTime.textContent = `${formatTime(dom.video.currentTime)} / ${formatTime(duration)}`;
  if (!seekDragging) {
    dom.videoSeek.value = String(duration ? Math.round((dom.video.currentTime / duration) * 1000) : 0);
  }
}

/* ------------------------------------------------------------------ */
/* 快照                                                               */
/* ------------------------------------------------------------------ */

function saveSnapshot() {
  if (state.source === 'none') return;
  const media = state.source === 'image' ? dom.image : dom.video;
  const width = state.sourceWidth || media.naturalWidth || media.videoWidth;
  const height = state.sourceHeight || media.naturalHeight || media.videoHeight;
  if (!width || !height) return;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const mirrored = state.source === 'camera' && state.mirror;
  if (mirrored) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(media, 0, 0, width, height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  for (const detection of state.detections) {
    let x = detection.x;
    if (mirrored) x = 1 - detection.x - detection.w;
    drawBox(ctx, detection, x * width, detection.y * height, detection.w * width, detection.h * height, width);
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vision-lab-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    toast('标注图已保存');
  }, 'image/png');
}

/* ------------------------------------------------------------------ */
/* AI 场景解读（可选，本地预览服务器提供模型转发）                     */
/* ------------------------------------------------------------------ */

async function checkAi() {
  if (state.ai.checked) return false;
  state.ai.checked = true;
  try {
    const response = await fetch('/api/llm/health', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const health = await response.json();
    if (!health.configured) {
      dom.aiNote.textContent = '本地服务已连接，但未配置模型 Key（apps/rag-lab/.env 或 apps/agent-lab/.env）；配置后重启 npm run serve 即可用。';
      return false;
    }
    state.ai.configured = true;
    state.ai.model = health.model || '';
    dom.aiNote.textContent = `本地模型：${health.model || '已连接'} · 标签解读只发标签，AI 精读会上传当前帧`;
    return true;
  } catch {
    dom.aiNote.textContent = '静态部署模式：AI 解读需要本地 npm run serve + 模型 Key；上面的物体检测不受影响。';
    return false;
  }
}

function captureFrameJpeg(maxSize = 720, quality = 0.82) {
  const media = state.source === 'image' ? dom.image : dom.video;
  const width = state.sourceWidth || media.naturalWidth || media.videoWidth;
  const height = state.sourceHeight || media.naturalHeight || media.videoHeight;
  if (!width || !height) return null;
  if (state.source === 'video' && dom.video.readyState < 2) return null;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const outWidth = Math.max(1, Math.round(width * scale));
  const outHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext('2d');
  const mirrored = state.source === 'camera' && state.mirror;
  if (mirrored) {
    ctx.translate(outWidth, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(media, 0, 0, outWidth, outHeight);
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), width: outWidth, height: outHeight };
}

function detectionSummary() {
  if (!state.detections.length) return '（当前没有检测到明确的物体）';
  return state.detections
    .slice(0, 12)
    .map((item, index) => `${index + 1}. ${item.zh}（${item.en}），置信度 ${Math.round(item.score * 100)}%，画面${positionHint(item)}`)
    .join('\n');
}

async function askAi() {
  if (state.ai.busy) return;
  if (!state.ai.checked) {
    const available = await checkAi();
    if (!available) {
      dom.aiAnswer.hidden = false;
      dom.aiAnswer.textContent = dom.aiNote.textContent;
      return;
    }
  }
  if (!state.ai.configured) return;
  state.ai.busy = true;
  dom.aiAsk.disabled = true;
  dom.aiVision.disabled = true;
  dom.aiAsk.textContent = '生成中…';
  dom.aiAnswer.hidden = false;
  dom.aiAnswer.textContent = '正在让本地模型解读画面……';

  try {
    const prompt = [
      '下面是一个浏览器端物体检测器对当前画面的识别结果（摄像头/视频/图片），按置信度排序：',
      detectionSummary(),
      '',
      '请用 2-3 句中文客观描述画面可能是什么场景、有哪些主要物体。',
      '要求：不要编造看不清的细节；不要提“检测框 / 坐标 / 置信度百分比”；如果只有一两个物体，就简洁说明。',
    ].join('\n');

    const response = await fetch('/api/llm/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: state.ai.model || undefined,
        messages: [
          { role: 'system', content: '你是简洁、客观的视觉场景解说助手，用中文回答。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        stream: false,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || `模型服务返回 HTTP ${response.status}`);
    }
    const text = data?.choices?.[0]?.message?.content;
    dom.aiAnswer.textContent = String(text || '').trim() || '模型没有返回内容。';
  } catch (error) {
    dom.aiAnswer.textContent = `AI 解读失败：${error?.message || error}\n\n提示：确认已运行 npm run serve，并在 apps/rag-lab/.env 或 apps/agent-lab/.env 配置模型 Key。`;
  } finally {
    state.ai.busy = false;
    dom.aiAsk.disabled = false;
    dom.aiVision.disabled = false;
    dom.aiAsk.textContent = '标签解读（不上传画面）';
  }
}

function stopAiAuto() {
  if (state.aiAutoTimer) {
    window.clearInterval(state.aiAutoTimer);
    state.aiAutoTimer = 0;
  }
}

async function startAiAuto() {
  stopAiAuto();
  const available = await checkAi();
  if (!available) {
    dom.aiAuto.checked = false;
    toast('AI 自动观察需要本地 npm run serve + 模型 Key');
    return;
  }
  if (state.source === 'none') {
    toast('先打开摄像头 / 视频 / 图片，再开启自动观察');
    dom.aiAuto.checked = false;
    return;
  }
  toast('已开启 AI 自动观察：每 8 秒把当前帧发给本地模型，描述一句话');
  state.aiAutoTimer = window.setInterval(() => void observeOnce(), 8000);
  void observeOnce();
}

async function observeOnce() {
  if (state.ai.busy || state.ai.observing) return;
  if (!state.ai.configured || state.source === 'none') return;
  const frame = captureFrameJpeg(560, 0.7);
  if (!frame) return;
  state.ai.observing = true;
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  try {
    const response = await fetch('/api/llm/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: state.ai.model || undefined,
        messages: [
          {
            role: 'system',
            content: '你是实时视觉观察助手，用一句简短中文描述画面里正在发生什么，不超过 40 字，不要列清单。',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: '一句话描述这张画面。' },
              { type: 'image_url', image_url: { url: frame.dataUrl } },
            ],
          },
        ],
        temperature: 0.4,
        max_tokens: 120,
        stream: false,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `HTTP ${response.status}`);
    const text = String(data?.choices?.[0]?.message?.content || '').trim();
    if (!text) return;
    state.aiLog.unshift({ time, text });
    if (state.aiLog.length > 6) state.aiLog.length = 6;
    renderAiLog();
  } catch (error) {
    state.aiLog.unshift({ time, text: `观察失败：${error.message}`, error: true });
    if (state.aiLog.length > 6) state.aiLog.length = 6;
    renderAiLog();
    stopAiAuto();
    dom.aiAuto.checked = false;
  } finally {
    state.ai.observing = false;
  }
}

function renderAiLog() {
  if (dom.aiCaption) {
    const latest = state.aiLog.find((item) => !item.error);
    if (latest) {
      dom.aiCaption.hidden = false;
      dom.aiCaptionText.textContent = latest.text;
    } else {
      dom.aiCaption.hidden = true;
    }
  }
  if (!dom.aiLog) return;
  dom.aiLog.textContent = '';
  for (const item of state.aiLog) {
    const row = document.createElement('li');
    row.className = `ai-log-item${item.error ? ' is-error' : ''}`;
    const time = document.createElement('span');
    time.className = 'ai-log-time';
    time.textContent = item.time;
    const text = document.createElement('span');
    text.textContent = item.text;
    row.append(time, text);
    dom.aiLog.appendChild(row);
  }
}

async function askVisionAi() {
  if (state.ai.busy) return;
  if (state.source === 'none') {
    toast('先打开摄像头 / 视频 / 图片，再让 AI 精读画面');
    return;
  }
  if (!state.ai.checked) {
    const available = await checkAi();
    if (!available) {
      dom.aiAnswer.hidden = false;
      dom.aiAnswer.textContent = dom.aiNote.textContent;
      return;
    }
  }
  if (!state.ai.configured) return;

  const frame = captureFrameJpeg(720, 0.82);
  if (!frame) {
    toast('当前没有可读取的画面帧，请等视频加载后再试');
    return;
  }

  state.ai.busy = true;
  dom.aiAsk.disabled = true;
  dom.aiVision.disabled = true;
  dom.aiVision.textContent = 'AI 精读中…';
  dom.aiAnswer.hidden = false;
  dom.aiAnswer.textContent = '已把当前帧（' + frame.width + '×' + frame.height + '）发给本地模型网关，等待识别……';

  try {
    const response = await fetch('/api/llm/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: state.ai.model || undefined,
        messages: [
          {
            role: 'system',
            content:
              '你是视觉识别助手。请用简洁、客观的中文描述图片内容；不确定的细节不要编造。只输出最终结果。',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  '请识别这张图片：先列出主要物体名称与大致数量（按重要性排序），再用 1-2 句描述场景。' +
                  '如果画面里有人，请说明人数。不要输出坐标或置信度。',
              },
              { type: 'image_url', image_url: { url: frame.dataUrl } },
            ],
          },
        ],
        temperature: 0.3,
        stream: false,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || `模型服务返回 HTTP ${response.status}`);
    }
    const text = data?.choices?.[0]?.message?.content;
    dom.aiAnswer.textContent = String(text || '').trim() || '模型没有返回内容。';
  } catch (error) {
    dom.aiAnswer.textContent =
      `AI 精读失败：${error?.message || error}\n\n提示：确认已运行 npm run serve，模型网关需要支持图片输入（OpenAI 兼容 image_url）。`;
  } finally {
    state.ai.busy = false;
    dom.aiAsk.disabled = false;
    dom.aiVision.disabled = false;
    dom.aiVision.textContent = 'AI 精读画面（上传当前帧）';
  }
}

/* ------------------------------------------------------------------ */
/* 事件绑定                                                           */
/* ------------------------------------------------------------------ */

function chooseFile(kind) {
  if (kind === 'image') dom.fileImage.click();
  else dom.fileVideo.click();
}

function bindEvents() {
  $$('[data-source]').forEach((button) => {
    button.addEventListener('click', () => {
      const source = button.dataset.source;
      if (source === 'camera') void startCamera();
      else if (source === 'video') chooseFile('video');
      else if (source === 'image') chooseFile('image');
    });
  });

  $$('[data-sample]').forEach((button) => {
    button.addEventListener('click', () => {
      const src = button.dataset.sample;
      void startImageSource(src, `示例图 · ${button.textContent.trim()}`);
    });
  });

  $$('[data-video-sample]').forEach((button) => {
    button.addEventListener('click', async () => {
      const url = new URL(button.dataset.videoSample, document.baseURI).href;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const file = new File([blob], 'street-pan.webm', { type: blob.type || 'video/webm' });
        await startVideoFile(file);
      } catch (error) {
        toast(`示例视频加载失败：${error.message}`);
      }
    });
  });

  dom.fileImage.addEventListener('change', () => {
    const file = dom.fileImage.files?.[0];
    dom.fileImage.value = '';
    if (file) void startImageSource(URL.createObjectURL(file), `图片 · ${file.name}`);
  });

  dom.fileVideo.addEventListener('change', () => {
    const file = dom.fileVideo.files?.[0];
    dom.fileVideo.value = '';
    if (file) void startVideoFile(file);
  });

  $$('[data-model]').forEach((button) => {
    button.addEventListener('click', () => switchModel(button.dataset.model));
  });

  dom.threshold.addEventListener('input', () => {
    state.threshold = Number(dom.threshold.value);
    dom.thresholdValue.textContent = state.threshold.toFixed(2);
    sendConfig();
    if (state.source === 'image') detectImage();
  });

  dom.maxObjects.addEventListener('input', () => {
    state.maxObjects = Number(dom.maxObjects.value);
    dom.maxValue.textContent = String(state.maxObjects);
    sendConfig();
    if (state.source === 'image') detectImage();
  });

  dom.mirror.addEventListener('change', () => {
    state.mirror = dom.mirror.checked;
    dom.video.classList.toggle('mirror', state.mirror && state.source === 'camera');
    paintOverlay();
  });

  dom.showLabels.addEventListener('change', () => {
    state.showLabels = dom.showLabels.checked;
    paintOverlay();
  });

  dom.btnStop.addEventListener('click', () => {
    stopSource();
    toast('输入已关闭');
  });

  dom.btnPause.addEventListener('click', () => {
    if (state.source !== 'video') return;
    if (dom.video.paused) {
      void dom.video.play();
      dom.btnPause.textContent = '暂停';
    } else {
      dom.video.pause();
      dom.btnPause.textContent = '继续';
    }
  });

  dom.btnSnapshot.addEventListener('click', saveSnapshot);
  dom.btnVideoPlay.addEventListener('click', () => {
    if (dom.video.paused) void dom.video.play();
    else dom.video.pause();
  });

  dom.video.addEventListener('play', () => {
    dom.btnVideoPlay.textContent = 'Ⅱ';
    dom.btnPause.textContent = '暂停';
  });
  dom.video.addEventListener('pause', () => {
    dom.btnVideoPlay.textContent = '▶';
    dom.btnPause.textContent = '继续';
  });
  dom.video.addEventListener('timeupdate', updateVideoMeta);
  dom.video.addEventListener('durationchange', updateVideoMeta);
  dom.videoSeek.addEventListener('pointerdown', () => {
    seekDragging = true;
  });
  dom.videoSeek.addEventListener('pointerup', () => {
    seekDragging = false;
  });
  dom.videoSeek.addEventListener('input', () => {
    if (!Number.isFinite(dom.video.duration)) return;
    dom.video.currentTime = (Number(dom.videoSeek.value) / 1000) * dom.video.duration;
  });

  dom.aiAsk.addEventListener('click', () => void askAi());
  dom.aiVision.addEventListener('click', () => void askVisionAi());
  dom.eventsClear?.addEventListener('click', () => {
    state.events = [];
    renderEvents();
  });
  dom.aiAuto?.addEventListener('change', () => {
    if (dom.aiAuto.checked) startAiAuto();
    else stopAiAuto();
  });

  dom.helpOpen.addEventListener('click', () => dom.helpDialog.showModal());
  dom.helpClose.addEventListener('click', () => dom.helpDialog.close());
  dom.helpDialog.addEventListener('click', (event) => {
    if (event.target === dom.helpDialog) dom.helpDialog.close();
  });

  window.addEventListener('resize', () => paintOverlay());
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => paintOverlay()).observe(dom.viewport);
  }
}

/* ------------------------------------------------------------------ */
/* 启动                                                               */
/* ------------------------------------------------------------------ */

function boot() {
  bindEvents();
  dom.aiNote.textContent =
    '本地运行 npm run serve 并配置模型 Key 后可启用；首次点击会检测本地服务。标签解读不上传画面，AI 精读会上传当前帧。';
  dom.aiAsk.disabled = false;
  dom.aiVision.disabled = false;
  try {
    const saved = window.localStorage.getItem(MODEL_PREF_KEY);
    if (saved && MODELS[saved]) state.model = saved;
  } catch {
    /* ignore */
  }
  applyModelUi();
  dom.threshold.value = String(state.threshold);
  dom.thresholdValue.textContent = state.threshold.toFixed(2);
  renderEvents();
  updateSummary();
  paintOverlay();
  updateHud(true);
}

boot();
