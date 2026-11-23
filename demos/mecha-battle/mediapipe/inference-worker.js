/* Classic worker: MediaPipe's WASM loader uses importScripts. Keep inference off the renderer. */
importScripts('./vision_bundle.js');
let pose, detector, frame;
const detectionCanvas = new OffscreenCanvas(512, 512);
const cropCanvas = new OffscreenCanvas(640, 640);
self.onmessage = async ({ data: { id, type, payload } }) => {
  try {
    let result;
    if (type === 'init') {
      const variant=payload.poseModel==='lite'?'lite':'full';
      const vision = await Vision.FilesetResolver.forVisionTasks(new URL('./wasm', self.location.href).href);
      // CPU in a worker works without depending on worker WebGL support on Safari.
      pose = await Vision.PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: new URL(`./pose_landmarker_${variant}.task`, self.location.href).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: .4,
        minPosePresenceConfidence: .4, minTrackingConfidence: .35, outputSegmentationMasks: false,
      });
      detector = await Vision.ObjectDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: new URL('./person_detector.tflite', self.location.href).href, delegate: 'CPU' },
        runningMode: 'VIDEO', categoryAllowlist: ['person'], scoreThreshold: .5, maxResults: 5,
      });
      result = { delegate: 'CPU · Worker', poseModel:variant };
    } else if (type === 'detect') {
      frame?.close(); frame = payload.bitmap;
      if (payload.detect) {
        detectionCanvas.height = Math.max(1, Math.round(512 * frame.height / frame.width));
        detectionCanvas.getContext('2d').drawImage(frame, 0, 0, 512, detectionCanvas.height);
        result = { detections: detector.detectForVideo(detectionCanvas, payload.now), width: 512, height: detectionCanvas.height };
      }
    } else if (type === 'pose') {
      try {
        if (payload.crop && frame) {
          const c = payload.crop, w = frame.width, h = frame.height;
          cropCanvas.width = Math.max(1, Math.min(640, Math.round(c.width * w)));
          cropCanvas.height = Math.max(1, Math.round(cropCanvas.width * c.height * h / (c.width * w)));
          cropCanvas.getContext('2d').drawImage(frame, c.x*w, c.y*h, c.width*w, c.height*h, 0, 0, cropCanvas.width, cropCanvas.height);
          const r = pose.detectForVideo(cropCanvas, payload.now);
          result = { landmarks: r.landmarks, worldLandmarks: r.worldLandmarks };
        }
      } finally { frame?.close(); frame = null; }
    }
    self.postMessage({ id, result });
  } catch (error) {
    frame?.close(); frame = null;
    self.postMessage({ id, error: error.message || String(error) });
  }
};
