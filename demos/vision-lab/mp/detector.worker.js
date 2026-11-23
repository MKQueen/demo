/* global Vision */
/**
 * detector.worker.js —— 在 Worker 里跑 MediaPipe 物体检测。
 *
 * 支持两个模型：
 *   - person_detector.tflite / EfficientDet-Lite0 —— 快速模式
 *   - efficientdet_lite2.tflite / EfficientDet-Lite2 —— 高精度模式
 *
 * 为什么放在 Worker：
 *   检测是同步的 WASM 计算，放在主线程会阻塞视频渲染与 UI；放到 Worker 后
 *   主线程只负责传帧和画框，检测结果异步回来。
 *
 * 消息协议：
 *   main → worker: { type:'init', modelUrl, fallbackUrl }
 *                  { type:'model', modelUrl, fallbackUrl }
 *                  { type:'config', scoreThreshold, maxResults }
 *                  { type:'detect', requestId, token, bitmap, timestamp, mode }
 *   worker → main: { type:'ready', delegate, url, fallbackUsed, maxResults }
 *                  { type:'modelReady', delegate, url, fallbackUsed }
 *                  { type:'config', ... }
 *                  { type:'result', requestId, token, detections, latency, width, height }
 *                  { type:'error', requestId?, token?, message }
 */
importScripts('./vision_bundle.js');

let detector = null;
let currentMode = '';
let visionInstance = null;
let frameCanvas = null;
let frameContext = null;
const config = { scoreThreshold: 0.4, maxResults: 15 };

function post(payload) {
  self.postMessage(payload);
}

async function getVision() {
  if (!visionInstance) {
    visionInstance = await Vision.FilesetResolver.forVisionTasks(new URL('./wasm', self.location.href).href);
  }
  return visionInstance;
}

async function createDetectorFor(modelUrl) {
  const vision = await getVision();
  let lastError = null;
  for (const delegate of ['GPU', 'CPU']) {
    try {
      const instance = await Vision.ObjectDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelUrl, delegate },
        runningMode: 'VIDEO',
        scoreThreshold: config.scoreThreshold,
        maxResults: config.maxResults,
      });
      return { detector: instance, delegate, url: modelUrl };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('模型初始化失败');
}

async function createWithFallback(primaryUrl, fallbackUrl) {
  try {
    return await createDetectorFor(primaryUrl);
  } catch (error) {
    if (!fallbackUrl || fallbackUrl === primaryUrl) throw error;
    const result = await createDetectorFor(fallbackUrl);
    return { ...result, fallbackUsed: true, error: String(error && error.message ? error.message : error) };
  }
}

async function handleInit(data) {
  if (detector) {
    post({ type: 'ready', delegate: 'ready', url: data.modelUrl, maxResults: config.maxResults });
    return;
  }
  const result = await createWithFallback(String(data.modelUrl), data.fallbackUrl ? String(data.fallbackUrl) : '');
  detector = result.detector;
  currentMode = 'VIDEO';
  post({
    type: 'ready',
    delegate: result.delegate,
    url: result.url,
    fallbackUsed: Boolean(result.fallbackUsed),
    fallbackReason: result.error || '',
    maxResults: config.maxResults,
  });
}

async function handleModel(data) {
  const next = await createWithFallback(String(data.modelUrl), data.fallbackUrl ? String(data.fallbackUrl) : '');
  const previous = detector;
  detector = next.detector;
  currentMode = 'VIDEO';
  try {
    previous?.close?.();
  } catch {
    /* 旧模型关闭失败不影响新模型 */
  }
  post({
    type: 'modelReady',
    delegate: next.delegate,
    url: next.url,
    fallbackUsed: Boolean(next.fallbackUsed),
    fallbackReason: next.error || '',
  });
}

async function handleConfig(data) {
  if (typeof data.scoreThreshold === 'number') config.scoreThreshold = data.scoreThreshold;
  if (Number.isInteger(data.maxResults)) config.maxResults = data.maxResults;
  if (detector) {
    await detector.setOptions({ scoreThreshold: config.scoreThreshold, maxResults: config.maxResults });
  }
  post({ type: 'config', scoreThreshold: config.scoreThreshold, maxResults: config.maxResults });
}

async function handleDetect(data) {
  const { requestId, token, bitmap, timestamp, mode } = data;
  if (!detector) throw new Error('模型尚未初始化');
  try {
    const runningMode = mode === 'image' ? 'IMAGE' : 'VIDEO';
    if (runningMode !== currentMode) {
      await detector.setOptions({ runningMode });
      currentMode = runningMode;
    }

    const width = bitmap.width;
    const height = bitmap.height;
    if (!frameCanvas) {
      frameCanvas = new OffscreenCanvas(width, height);
      frameContext = frameCanvas.getContext('2d', { willReadFrequently: false });
    } else if (frameCanvas.width !== width || frameCanvas.height !== height) {
      frameCanvas.width = width;
      frameCanvas.height = height;
    }
    frameContext.drawImage(bitmap, 0, 0);

    const startedAt = performance.now();
    const result = runningMode === 'IMAGE' ? detector.detect(frameCanvas) : detector.detectForVideo(frameCanvas, timestamp);
    const latency = performance.now() - startedAt;

    const detections = (result.detections || [])
      .map((detection) => {
        const category = detection.categories?.[0] || {};
        const box = detection.boundingBox || {};
        return {
          name: category.categoryName || category.displayName || '',
          index: Number.isInteger(category.index) ? category.index : -1,
          score: Number(category.score) || 0,
          x: width ? box.originX / width : 0,
          y: height ? box.originY / height : 0,
          w: width ? box.width / width : 0,
          h: height ? box.height / height : 0,
        };
      })
      .filter((item) => item.w > 0 && item.h > 0)
      .sort((a, b) => b.score - a.score);

    post({ type: 'result', requestId, token, detections, latency, width, height });
  } finally {
    bitmap.close();
  }
}

self.addEventListener('message', async (event) => {
  const data = event.data || {};
  try {
    if (data.type === 'init') await handleInit(data);
    else if (data.type === 'model') await handleModel(data);
    else if (data.type === 'config') await handleConfig(data);
    else if (data.type === 'detect') await handleDetect(data);
  } catch (error) {
    post({
      type: 'error',
      requestId: data.requestId,
      token: data.token,
      phase: data.type,
      message: String((error && error.message) || error),
    });
  }
});
