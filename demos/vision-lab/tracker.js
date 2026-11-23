/**
 * tracker.js —— 轻量多目标跟踪 + 同类别 NMS（无第三方依赖）。
 *
 * 检测器每帧只告诉我们「这一刻有哪些框」，没有「这是不是刚才那个目标」。
 * 这里用带速度预测的 IoU 贪心匹配把跨帧目标串起来：
 *   - 每个确认目标拿到稳定 #ID，画面里不会一闪一闪地换框；
 *   - 记录首次出现 / 最近出现时间，可统计当前目标数、累计目标数、停留时长；
 *   - 生成“进入 / 离开画面”事件，供右侧事件流展示；
 *   - 对框做指数平滑，减少抖动（跟踪不能提升识别率，但能明显改善观感）。
 *
 * 不是生产级 MOT（没有卡尔曼滤波、没有 ReID），只适合检测 Demo 的展示场景。
 */

export function iou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (!inter) return 0;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

/** 同类别 NMS：去掉同一物体被重复框出的情况（不同类别保留，避免误杀“人 + 背包”） */
export function nms(detections, threshold = 0.55) {
  const sorted = [...detections].sort((a, b) => b.score - a.score);
  const kept = [];
  for (const detection of sorted) {
    let keep = true;
    for (const other of kept) {
      if (other.en !== detection.en) continue;
      if (iou(detection, other) > threshold) {
        keep = false;
        break;
      }
    }
    if (keep) kept.push(detection);
  }
  return kept;
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const center = (box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

export class Tracker {
  constructor({
    maxAge = 18,
    iouGate = 0.12,
    centerGate = 0.11,
    smoothing = 0.45,
    trailLength = 24,
    confirmHits = 2,
  } = {}) {
    this.maxAge = maxAge;
    this.iouGate = iouGate;
    this.centerGate = centerGate;
    this.smoothing = smoothing;
    this.trailLength = trailLength;
    this.confirmHits = confirmHits;
    this.reset();
  }

  reset() {
    this.tracks = [];
    this.nextId = 1;
    this.total = 0;
    this.frame = 0;
  }

  /** 用速度预测目标在当前时刻的位置，摄影机平移时也能对得上 */
  predictedBox(track, dtSeconds) {
    return {
      x: clamp01(track.x + track.vx * dtSeconds),
      y: clamp01(track.y + track.vy * dtSeconds),
      w: track.w,
      h: track.h,
    };
  }

  /**
   * @param {Array<{en:string,zh:string,score:number,x:number,y:number,w:number,h:number}>} detections
   * @returns {{tracks:Array, entered:Array, exited:Array, total:number, frame:number}}
   */
  update(detections = []) {
    const now = performance.now();
    this.frame += 1;

    const existing = this.tracks;
    const usedTracks = new Set();
    const usedDetections = new Set();
    const entered = [];
    const exited = [];

    // 1) 速度预测 + IoU / 中心距双门限匹配
    const pairs = [];
    existing.forEach((track, trackIndex) => {
      const dtSeconds = Math.max(0.016, (now - track.lastSeen) / 1000);
      const predicted = this.predictedBox(track, dtSeconds);
      const predictedCenter = center(predicted);
      detections.forEach((detection, detectionIndex) => {
        if (detection.en !== track.en) return;
        const overlap = iou(predicted, detection);
        const detectionCenter = center(detection);
        const distance = Math.hypot(
          predictedCenter.x - detectionCenter.x,
          predictedCenter.y - detectionCenter.y,
        );
        if (overlap < this.iouGate && distance > this.centerGate) return;
        pairs.push({
          trackIndex,
          detectionIndex,
          score: overlap + (1 - Math.min(1, distance / this.centerGate)) * 0.05,
        });
      });
    });
    pairs.sort((a, b) => b.score - a.score);

    for (const pair of pairs) {
      if (usedTracks.has(pair.trackIndex) || usedDetections.has(pair.detectionIndex)) continue;
      usedTracks.add(pair.trackIndex);
      usedDetections.add(pair.detectionIndex);
      const track = existing[pair.trackIndex];
      const detection = detections[pair.detectionIndex];
      const dtSeconds = Math.max(0.016, (now - track.lastSeen) / 1000);
      const previousCenter = center(track);
      const nextCenter = center(detection);

      // 速度用指数平滑估计（归一化坐标/秒）；限制异常跳变
      const rawVx = (nextCenter.x - previousCenter.x) / dtSeconds;
      const rawVy = (nextCenter.y - previousCenter.y) / dtSeconds;
      track.vx = clampV(track.vx * 0.55 + rawVx * 0.45);
      track.vy = clampV(track.vy * 0.55 + rawVy * 0.45);

      const k = this.smoothing;
      track.score = track.score * (1 - k) + detection.score * k;
      track.x = track.x * (1 - k) + detection.x * k;
      track.y = track.y * (1 - k) + detection.y * k;
      track.w = track.w * (1 - k) + detection.w * k;
      track.h = track.h * (1 - k) + detection.h * k;
      track.zh = detection.zh;
      track.age = 0;
      track.hits += 1;
      track.lastSeen = now;
      track.durationMs = now - track.firstSeen;
      track.trail.push({ x: clamp01(track.x + track.w / 2), y: clamp01(track.y + track.h / 2) });
      if (track.trail.length > this.trailLength) track.trail.shift();

      // 连续命中后才算“确认目标”，避免单帧误检把累计数刷爆
      if (!track.confirmed && track.hits >= this.confirmHits) {
        track.confirmed = true;
        this.total += 1;
        entered.push({ ...track });
      }
    }

    // 2) 连续多帧没匹配到的老目标 → 计为离开画面
    const alive = [];
    existing.forEach((track, index) => {
      if (usedTracks.has(index)) {
        alive.push(track);
        return;
      }
      track.age += 1;
      track.vx *= 0.85;
      track.vy *= 0.85;
      track.durationMs = now - track.firstSeen;
      if (track.age >= this.maxAge) {
        if (track.confirmed) exited.push({ ...track });
      } else {
        alive.push(track);
      }
    });
    this.tracks = alive;

    // 3) 没匹配到的检测 → 新目标（先作为 tentative，确认后才进入统计）
    detections.forEach((detection, index) => {
      if (usedDetections.has(index)) return;
      if (detection.score < 0.4) return;
      const isFirst = this.tracks.every((track) => track.en !== detection.en || iou(track, detection) < 0.1);
      if (!isFirst) return;
      const track = {
        id: this.nextId++,
        en: detection.en,
        zh: detection.zh,
        score: detection.score,
        x: detection.x,
        y: detection.y,
        w: detection.w,
        h: detection.h,
        firstSeen: now,
        lastSeen: now,
        durationMs: 0,
        age: 0,
        hits: 1,
        confirmed: false,
        vx: 0,
        vy: 0,
        trail: [{ x: clamp01(detection.x + detection.w / 2), y: clamp01(detection.y + detection.h / 2) }],
      };
      this.tracks.push(track);
    });

    const tracks = [...this.tracks].sort((a, b) => b.score - a.score);
    return { tracks, entered, exited, total: this.total, frame: this.frame };
  }
}

function clampV(value) {
  const limit = 1.6; // 归一化坐标 / 秒，约等于一秒横穿 1.6 个画面
  return Math.min(limit, Math.max(-limit, value));
}
