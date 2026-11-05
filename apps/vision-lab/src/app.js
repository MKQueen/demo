import { colorFor, positionHint, resolveCategoryName, zhLabel } from './labels.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const WORKER_URL = './mp/detector.worker.js';
const MODEL_URL = new URL('./mp/person_detector.tflite', document.baseURI).href;

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
  hudRes: $('#hud-res'),
  hudStatus: $('#hud-status'),
  hudSource: $('#hud-source'),
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
  aiNote: $('#ai-note'),
  aiAsk: $('#ai-ask'),
  aiAnswer: $('#ai-answer'),
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
  selectedEn: '',
  threshold: 0.35,
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
    setEngine('loading', '引擎加载中…');
    showLoading(true, '正在加载视觉模型…', '首次加载约 40 MB（模型 + WASM），之后走浏览器缓存');

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
        finish(true, data.delegate === 'GPU' ? 'GPU · Worker' : 'CPU · Worker');
        worker.postMessage({ type: 'config', scoreThreshold: state.threshold, maxResults: state.maxObjects });
        return;
      }
      if (data.type === 'result') {
        handleResult(data);
        return;
      }
      if (data.type === 'error') {
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

    worker.postMessage({ type: 'init', modelUrl: MODEL_URL });
  });
  enginePromise.catch(() => {
    // 允许用户重试：清空缓存的 promise，下一次输入时重新初始化
    enginePromise = null;
  });
  return enginePromise;
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
  state.selectedEn = '';
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

  state.detections = (data.detections || []).map((item, index) => {
    const en = resolveCategoryName(item.name, item.index);
    return {
      key: `${en || 'object'}-${index}`,
      en: en || 'object',
      zh: zhLabel(en),
      color: colorFor(en),
      score: item.score,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    };
  });

  // 选中类别如果不在新结果里，自动取消
  if (state.selectedEn && !state.detections.some((item) => item.en === state.selectedEn)) {
    state.selectedEn = '';
  }

  paintOverlay();
  renderList();
  updateHud();
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
  const selected = detection.en === state.selectedEn;
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
    const text = `${detection.zh} ${detection.en}`;
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
    item.dataset.en = detection.en;
    if (detection.en === state.selectedEn) item.classList.add('is-selected');

    const dot = document.createElement('span');
    dot.className = 'dot';

    const name = document.createElement('span');
    name.className = 'name';
    const zh = document.createElement('b');
    zh.textContent = detection.zh;
    const en = document.createElement('em');
    en.textContent = detection.en;
    name.append(zh, en);

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
      state.selectedEn = state.selectedEn === detection.en ? '' : detection.en;
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
  dom.hudRes.textContent = state.sourceWidth && state.sourceHeight ? `${state.sourceWidth}×${state.sourceHeight}` : '—';
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
    dom.aiNote.textContent = `本地模型：${health.model || '已连接'} · 只发送识别标签，不上传画面`;
    return true;
  } catch {
    dom.aiNote.textContent = '静态部署模式：AI 解读需要本地 npm run serve + 模型 Key；上面的物体检测不受影响。';
    return false;
  }
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
    dom.aiAsk.textContent = '生成场景解读';
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
    '本地运行 npm run serve 并配置模型 Key 后可启用；点击下方按钮会检测本地服务。只发送识别标签，不上传画面。';
  dom.aiAsk.disabled = false;
  paintOverlay();
  updateHud(true);
}

boot();
