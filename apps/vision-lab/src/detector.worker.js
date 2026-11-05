/* global Vision */
/**
 * detector.worker.js —— 在 Worker 里跑 MediaPipe EfficientDet-Lite0。
 *
 * 为什么放在 Worker：
 *   目标检测是同步的 WASM 计算（CPU 上单帧 ~40-80ms），放在主线程会阻塞
 *   视频渲染和 UI；放到 Worker 后主线程只负责把视频帧 transfer 过来，
 *   视频与界面保持流畅，检测结果异步回来再画框。
 *
 * 消息协议：
 *   main → worker: { type:'init', wasmBase, modelUrl }
 *                  { type:'config', scoreThreshold, maxResults }
 *                  { type:'detect', requestId, bitmap, timestamp, mode:'video'|'image' }
 *   worker → main: { type:'ready', delegate, maxResults }
 *                  { type:'config', ... }
 *                  { type:'result', requestId, detections, latency, width, height }
 *                  { type:'error', requestId?, message }
 */
importScripts('./vision_bundle.js');

let detector = null;
let currentMode = '';
let frameCanvas = null;
let frameContext = null;
const config = { scoreThreshold: 0.35, maxResults: 15 };

function post(payload) {
  self.postMessage(payload);
}

async function createDetector(modelUrl) {
  const vision = await Vision.FilesetResolver.forVisionTasks(new URL('./wasm', self.location.href).href);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: modelUrl, delegate },
    runningMode: 'VIDEO',
    scoreThreshold: config.scoreThreshold,
    maxResults: config.maxResults,
  });

  // 优先 GPU（部分浏览器不给 Worker 提供 WebGL，会自动回退 CPU）
  try {
    const candidate = await Vision.ObjectDetector.createFromOptions(vision, options('GPU'));
    return { detector: candidate, delegate: 'GPU' };
  } catch (error) {
    const candidate = await Vision.ObjectDetector.createFromOptions(vision, options('CPU'));
    return { detector: candidate, delegate: 'CPU' };
  }
}

async function handleInit(data) {
  if (detector) {
    post({ type: 'ready', delegate: data.delegate || 'ready', maxResults: config.maxResults });
    return;
  }
  const { detector: instance, delegate } = await createDetector(String(data.modelUrl));
  detector = instance;
  currentMode = 'VIDEO';
  post({ type: 'ready', delegate, maxResults: config.maxResults });
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
    else if (data.type === 'config') await handleConfig(data);
    else if (data.type === 'detect') await handleDetect(data);
  } catch (error) {
    post({
      type: 'error',
      requestId: data.requestId,
      token: data.token,
      message: String((error && error.message) || error),
    });
  }
});
