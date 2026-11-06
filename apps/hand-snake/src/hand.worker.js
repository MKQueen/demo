/* global Vision */
/**
 * hand.worker.js —— MediaPipe HandLandmarker 推理 Worker。
 *
 * 主线程只负责传摄像头帧、绘制游戏与手部骨架；这里做 21 个手部关键点检测，
 * 避免同步 WASM 计算阻塞 60fps 的游戏循环。
 *
 * 消息：
 *   main → worker: { type:'init', modelUrl }
 *                  { type:'detect', requestId, bitmap, timestamp }
 *   worker → main: { type:'ready', delegate }
 *                  { type:'result', requestId, hands, latency }
 *                  { type:'error', requestId?, message }
 */
importScripts('./vision_bundle.js');

let landmarker = null;
let vision = null;

function post(payload) {
  self.postMessage(payload);
}

async function createLandmarker(modelUrl, preferredDelegate = 'GPU') {
  vision = await Vision.FilesetResolver.forVisionTasks(new URL('./wasm', self.location.href).href);
  let lastError = null;
  const delegates = preferredDelegate === 'CPU' ? ['CPU', 'GPU'] : ['GPU', 'CPU'];
  for (const delegate of delegates) {
    try {
      const instance = await Vision.HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelUrl, delegate },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.45,
        minHandPresenceConfidence: 0.45,
        minTrackingConfidence: 0.4,
      });
      return { landmarker: instance, delegate };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('手部模型初始化失败');
}

async function handleInit(data) {
  if (landmarker) {
    post({ type: 'ready', delegate: 'ready' });
    return;
  }
  const result = await createLandmarker(String(data.modelUrl), data.delegate === 'CPU' ? 'CPU' : 'GPU');
  landmarker = result.landmarker;
  post({ type: 'ready', delegate: result.delegate });
}

async function handleDetect(data) {
  const { requestId, bitmap, timestamp } = data;
  if (!landmarker) throw new Error('手部模型尚未初始化');
  try {
    const startedAt = performance.now();
    const result = landmarker.detectForVideo(bitmap, timestamp);
    const latency = performance.now() - startedAt;
    const hands = (result.landmarks || []).map((points, index) => ({
      landmarks: points.map((point) => ({
        x: point.x,
        y: point.y,
        z: point.z || 0,
      })),
      handedness: result.handedness?.[index]?.[0]?.categoryName || '',
      score: result.handedness?.[index]?.[0]?.score || 0,
    }));
    post({ type: 'result', requestId, hands, latency });
  } finally {
    bitmap.close();
  }
}

self.addEventListener('message', async (event) => {
  const data = event.data || {};
  try {
    if (data.type === 'init') await handleInit(data);
    else if (data.type === 'detect') await handleDetect(data);
  } catch (error) {
    post({
      type: 'error',
      requestId: data.requestId,
      phase: data.type,
      message: String((error && error.message) || error),
    });
  }
});
