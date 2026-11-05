/**
 * GestureAnalyzer — 纯逻辑体感识别器。
 * 输入 MediaPipe Pose 的 normalized/world landmarks，输出机甲可用的连续状态与离散事件。
 * 不依赖 DOM / Three.js，方便单元测试与回放。
 */

export const LM = {
  NOSE: 0,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
};

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const angleAt = (a, b, c) => {
  const v1x = a.x - b.x, v1y = a.y - b.y, v1z = (a.z ?? 0) - (b.z ?? 0);
  const v2x = c.x - b.x, v2y = c.y - b.y, v2z = (c.z ?? 0) - (b.z ?? 0);
  const l1 = Math.hypot(v1x, v1y, v1z) || 1e-6;
  const l2 = Math.hypot(v2x, v2y, v2z) || 1e-6;
  const d = clamp((v1x * v2x + v1y * v2y + v1z * v2z) / (l1 * l2), -1, 1);
  return Math.acos(d);
};

export function emptyState() {
  return {
    visible: false,
    quality: 0,
    fullBody: false,
    upperBody: false,
    halfBody: false,
    calibration: 0,
    move: 0,
    moving: false,
    running: false,
    speed: 0,
    stepRate: 0,
    stepping: false,
    lean: 0,
    strafe: 0,
    blocking: false,
    ultimateCharge: 0,
    punchArm: null,
    gesture: 'idle',
    activeParts: { left: false, right: false, both: false, guard: false, overhead: false, wide: false, high: false },
    arms: {
      left: { lift: 0, out: 0, forward: 0, straight: 0, bend: 0, wristY: 0.5 },
      right: { lift: 0, out: 0, forward: 0, straight: 0, bend: 0, wristY: 0.5 },
    },
    shoulderTilt: 0,
    headX: 0,
    missileCooldown: 0,
    bladeCooldown: 0,
    eventFlash: '',
  };
}

export class GestureAnalyzer {
  constructor(options = {}) {
    this.options = options;
    this.state = emptyState();
    this.events = [];
    this.smoothed = null;
    this.prevLandmarks = null;
    this.lastTime = 0;
    this.initialized = false;
    this.stepTimes = [];
    this.lastStepAt = -10;
    this.legBaseline = [0, 0];
    this.legBaselineInit = false;
    this.legUp = [false, false];
    this.lastStepSideAt = [-10, -10];
    this.footLift = [0, 0];
    this.lastPunchAt = { left: -10, right: -10 };
    this.punchArmed = { left: true, right: true };
    this.lastPunchArm = null;
    this.blastCooldown = 0;
    this.suppressPunchUntil = 0;
    this.blastHeld = 0;
    this.blastFired = false;
    this.suppressPunchUntil = 0;
    this.dodgeCooldown = 0;
    this.lastLean = 0;
    this.leanVelocity = 0;
    this.guardHold = 0;
    this.ultimateHold = 0;
    this.ultimateFired = false;
    this.prevWristWorld = { left: null, right: null };
    this.prevWristAt = 0;
    this.calibrationTime = 0;
    this.lostTime = 0;
    this.shoulderBaseline = null;
    this.baselineSamples = 0;
    this.missileHold = 0;
    this.missileCooldown = 0;
    this.missileFired = false;
    this.bladeHold = 0;
    this.bladeCooldown = 0;
    this.bladeFired = false;
    this.lastEventAt = 0;
    this.gestureFlashUntil = 0;
    this.fps = 30;
    this.lastVisibleAt = 0;
  }

  reset() {
    this.state = emptyState();
    this.events = [];
    this.prevLandmarks = null;
    this.smoothed = null;
    this.initialized = false;
    this.stepTimes = [];
    this.lastStepAt = -10;
    this.legBaseline = [0, 0];
    this.legBaselineInit = false;
    this.legUp = [false, false];
    this.lastStepSideAt = [-10, -10];
    this.lastPunchAt = { left: -10, right: -10 };
    this.punchArmed = { left: true, right: true };
    this.lastLean = 0;
    this.leanVelocity = 0;
    this.blastHeld = 0;
    this.blastFired = false;
    this.suppressPunchUntil = 0;
    this.dodgeCooldown = 0;
    this.leanVelocity = 0;
    this.guardHold = 0;
    this.ultimateHold = 0;
    this.ultimateFired = false;
    this.prevWristWorld = { left: null, right: null };
    this.calibrationTime = 0;
    this.lostTime = 0;
    this.shoulderBaseline = null;
    this.baselineSamples = 0;
    this.missileHold = 0;
    this.missileCooldown = 0;
    this.missileFired = false;
    this.bladeHold = 0;
    this.bladeCooldown = 0;
    this.bladeFired = false;
  }

  takeEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  emit(type, payload = {}) {
    this.events.push({ type, at: this.lastTime, ...payload });
    this.gestureFlashUntil = this.lastTime + 0.45;
    if (type === 'punch') this.lastPunchArm = payload.side;
  }

  update(landmarks, worldLandmarks, nowMs, video = null) {
    const now = nowMs / 1000;
    let dt = this.lastTime ? clamp(now - this.lastTime, 0.001, 0.2) : 1 / 30;
    this.lastTime = now;
    this.fps = lerp(this.fps, 1 / Math.max(0.001, dt), 0.04);

    if (!landmarks || !landmarks.length) {
      return this.loseTracking(dt);
    }

    // MediaPipe 的 x 是原始画面坐标；镜像后更符合玩家自我感知。
    const lm = landmarks.map((p, i) => ({
      x: 1 - p.x,
      y: p.y,
      z: p.z ?? 0,
      visibility: p.visibility ?? 1,
      i,
    }));
    const wl = worldLandmarks && worldLandmarks.length ? worldLandmarks : null;

    const nose = lm[LM.NOSE];
    const lShoulder = lm[LM.L_SHOULDER];
    const rShoulder = lm[LM.R_SHOULDER];
    const lElbow = lm[LM.L_ELBOW];
    const rElbow = lm[LM.R_ELBOW];
    const lWrist = lm[LM.L_WRIST];
    const rWrist = lm[LM.R_WRIST];
    const lHip = lm[LM.L_HIP];
    const rHip = lm[LM.R_HIP];
    const lKnee = lm[LM.L_KNEE];
    const rKnee = lm[LM.R_KNEE];
    const lAnkle = lm[LM.L_ANKLE];
    const rAnkle = lm[LM.R_ANKLE];

    const keyPoints = [lShoulder, rShoulder, lElbow, rElbow, lWrist, rWrist, nose];
    const avgVis = keyPoints.reduce((sum, p) => sum + (p.visibility ?? 0), 0) / keyPoints.length;
    const shoulderVis = ((lShoulder.visibility ?? 0) + (rShoulder.visibility ?? 0)) / 2;
    const hipVis = ((lHip.visibility ?? 0) + (rHip.visibility ?? 0)) / 2;
    const ankleVis = ((lAnkle.visibility ?? 0) + (rAnkle.visibility ?? 0)) / 2;
    const wristsVis = ((lWrist.visibility ?? 0) + (rWrist.visibility ?? 0)) / 2;
    const elbowVis = ((lElbow.visibility ?? 0) + (rElbow.visibility ?? 0)) / 2;
    const noseVis = nose.visibility ?? 0;
    const fullBody = ankleVis > 0.28 && shoulderVis > 0.35 && hipVis > 0.3;
    // 半身模式只要求头肩和双手；髋/腿不可见时用肩宽虚拟躯干长度。
    const upperBody = shoulderVis > 0.26 && wristsVis > 0.12 && (noseVis > 0.12 || hipVis > 0.12);
    const visible = upperBody;
    if (!visible) return this.loseTracking(dt);

    this.lostTime = 0;
    this.lastVisibleAt = now;
    this.calibrationTime += dt;

    const shoulderMid = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2, z: (lShoulder.z + rShoulder.z) / 2 };
    const shoulderW = Math.max(0.05, dist2(lShoulder, rShoulder));
    const hipVisible = hipVis > 0.22;
    const hipMid = hipVisible
      ? { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2, z: (lHip.z + rHip.z) / 2 }
      : { x: shoulderMid.x, y: shoulderMid.y + shoulderW * 1.15, z: shoulderMid.z };
    const torsoLen = hipVisible ? Math.max(0.05, dist2(shoulderMid, hipMid)) : shoulderW * 1.15;
    const hipW = Math.max(0.04, dist2(lHip, rHip));
    const ankleMid = { x: (lAnkle.x + rAnkle.x) / 2, y: (lAnkle.y + rAnkle.y) / 2 };
    const bodyH = ankleVis > 0.12 ? Math.max(0.2, dist2(nose, ankleMid)) : Math.max(0.2, shoulderW * 2.6);

    // 平滑骨架（仅用于姿态，不用于速度）
    if (!this.smoothed) {
      this.smoothed = lm.map((p) => ({ ...p }));
    } else {
      // Same response time at 15/22/30 Hz; do not add lag when inference slows.
      const alpha = 1-Math.exp(-16.35*dt);
      for (let i = 0; i < lm.length; i++) {
        this.smoothed[i].x = lerp(this.smoothed[i].x, lm[i].x, alpha);
        this.smoothed[i].y = lerp(this.smoothed[i].y, lm[i].y, alpha);
        this.smoothed[i].z = lerp(this.smoothed[i].z, lm[i].z, alpha);
        this.smoothed[i].visibility = lm[i].visibility;
      }
    }
    const s = this.smoothed;
    const sShoulderMid = { x: (s[LM.L_SHOULDER].x + s[LM.R_SHOULDER].x) / 2, y: (s[LM.L_SHOULDER].y + s[LM.R_SHOULDER].y) / 2 };
    const sHipVis = ((s[LM.L_HIP].visibility ?? 0) + (s[LM.R_HIP].visibility ?? 0)) / 2;
    const sHipVisible = sHipVis > 0.22;
    const sHipMid = sHipVisible
      ? { x: (s[LM.L_HIP].x + s[LM.R_HIP].x) / 2, y: (s[LM.L_HIP].y + s[LM.R_HIP].y) / 2 }
      : { x: sShoulderMid.x, y: sShoulderMid.y + shoulderW * 1.15 };

    // 半身模式没有可靠的髋部参照，用站定时的肩部中点作为左右倾身基线。
    if (shoulderVis > 0.3) {
      if (this.shoulderBaseline === null) {
        this.shoulderBaseline = sShoulderMid.x;
        this.baselineSamples = 1;
      } else if (this.baselineSamples < 30) {
        this.baselineSamples++;
        this.shoulderBaseline = lerp(this.shoulderBaseline, sShoulderMid.x, 1 / this.baselineSamples);
      }
    }
    const quality = clamp(shoulderVis * 0.35 + wristsVis * 0.28 + elbowVis * 0.2 + noseVis * 0.1 + hipVis * 0.07);
    const shoulderOffsetLean = this.shoulderBaseline !== null
      ? (sShoulderMid.x - this.shoulderBaseline) / Math.max(0.08, shoulderW * 0.9)
      : 0;
    const hipLean = (sShoulderMid.x - sHipMid.x) / torsoLen;
    const leanRaw = sHipVisible ? hipLean : shoulderOffsetLean * 1.35;
    const lean = lerp(this.state.lean, clamp(leanRaw, -1, 1), 0.38);
    const leanVelRaw = (lean - this.lastLean) / Math.max(0.001, dt);
    this.leanVelocity = lerp(this.leanVelocity, leanVelRaw, 0.35);
    this.lastLean = lean;

    // 步态：把脚踝相对髋部的距离按躯干长度归一化，迈步抬膝会缩短距离
    const legRatioL = Math.abs(lAnkle.y - lHip.y) / torsoLen;
    const legRatioR = Math.abs(rAnkle.y - rHip.y) / torsoLen;
    if (!this.legBaselineInit || this.legBaseline[0] < 0.4) {
      this.legBaseline = [legRatioL, legRatioR];
      this.legBaselineInit = true;
    } else {
      for (let i = 0; i < 2; i++) {
        const ratio = i === 0 ? legRatioL : legRatioR;
        // 越快、越大的腿长会被视为站立基线；缓慢下降，以便适应玩家移动
        if (ratio > this.legBaseline[i]) this.legBaseline[i] = lerp(this.legBaseline[i], ratio, 0.35);
        else this.legBaseline[i] = Math.max(0.6, this.legBaseline[i] - dt * 0.035);
      }
    }
    const liftL = clamp((this.legBaseline[0] - legRatioL) / Math.max(0.1, this.legBaseline[0] * 0.22));
    const liftR = clamp((this.legBaseline[1] - legRatioR) / Math.max(0.1, this.legBaseline[1] * 0.22));
    this.footLift = [liftL, liftR];
    const kneeLiftL = clamp((lHip.y - lKnee.y) / torsoLen * 0.1 + (lKnee.y - lAnkle.y) / torsoLen * 0.02, 0, 1);
    const canStep = this.calibrationTime > 0.65 && fullBody && quality > 0.3;
    let newStep = false;
    if (canStep) {
      for (let i = 0; i < 2; i++) {
        const lift = i === 0 ? liftL : liftR;
        const thresholdUp = 0.42;
        const thresholdDown = 0.16;
        if (!this.legUp[i] && lift > thresholdUp && now - this.lastStepSideAt[i] > 0.18) {
          this.legUp[i] = true;
          this.lastStepSideAt[i] = now;
          this.stepTimes.push(now);
          this.lastStepAt = now;
          newStep = true;
        } else if (this.legUp[i] && lift < thresholdDown) {
          this.legUp[i] = false;
        }
      }
    }
    this.stepTimes = this.stepTimes.filter((t) => now - t < 1.35);
    const stepRate = this.stepTimes.length / 1.35;
    const stepRecent = now - this.lastStepAt < 0.78;
    let moveTarget = 0;
    if (stepRecent && canStep) {
      moveTarget = clamp(0.36 + stepRate * 0.36, 0.36, 1);
    }
    const move = lerp(this.state.move, moveTarget, stepRecent ? 0.24 : 0.08);
    const running = stepRate >= 1.95 && move > 0.55;
    const moving = move > 0.06;

    // 手臂角度与向前伸展
    const armInfo = (lShoulderP, rShoulderP, lElbowP, rElbowP, lWristP, rWristP, side) => {
      const isLeft = side === 'left';
      const sh = isLeft ? lShoulderP : rShoulderP;
      const el = isLeft ? lElbowP : rElbowP;
      const wr = isLeft ? lWristP : rWristP;
      const angle = angleAt(sh, el, wr);
      const upperLen = dist3(sh, el);
      const foreLen = dist3(el, wr);
      const span = dist3(sh, wr);
      const reach = clamp(span / Math.max(0.15, upperLen + foreLen), 0, 1.3);
      let forward = 0;
      let wristSpeed = 0;
      let worldAngle = null;
      if (wl) {
        const indexShoulder = isLeft ? LM.L_SHOULDER : LM.R_SHOULDER;
        const indexElbow = isLeft ? LM.L_ELBOW : LM.R_ELBOW;
        const indexWrist = isLeft ? LM.L_WRIST : LM.R_WRIST;
        const wsh = wl[indexShoulder];
        const wel = wl[indexElbow];
        const wwr = wl[indexWrist];
        if (wsh && wwr) {
          if (wel) worldAngle = angleAt(wsh, wel, wwr);
          forward = clamp((wsh.z - wwr.z) / 0.26, 0, 1);
          const prev = this.prevWristWorld[side];
          if (prev) {
            const speed = Math.hypot(wwr.x - prev.x, wwr.y - prev.y, wwr.z - prev.z) / Math.max(0.016, dt);
            wristSpeed = clamp(speed, 0, 20);
          }
          this.prevWristWorld[side] = { x: wwr.x, y: wwr.y, z: wwr.z };
        }
      } else {
        forward = clamp((sh.z - wr.z) / 0.22, 0, 1);
        const prev = this.prevWristWorld[side];
        if (prev) {
          const speed = Math.hypot(sh.x - wr.x - (prev.x ?? 0), sh.y - wr.y - (prev.y ?? 0)) / Math.max(0.016, dt);
          wristSpeed = clamp(speed, 0, 20);
        }
        this.prevWristWorld[side] = { x: sh.x - wr.x, y: sh.y - wr.y, z: wr.z };
      }
      const jointAngle = worldAngle ?? angle;
      const straight = clamp((jointAngle - 1.62) / (Math.PI - 1.62), 0, 1);
      const outward = isLeft ? (wr.x - sh.x) / shoulderW : (sh.x - wr.x) / shoulderW;
      const lift = (sh.y - wr.y) / shoulderW;
      return {
        straight, reach, forward, wristSpeed, angle: jointAngle, elbow: el, wrist: wr, shoulder: sh,
        out: clamp(outward, -0.5, 2.2), lift: clamp(lift, -1.4, 2.2),
      };
    };

    const L = armInfo(s[LM.L_SHOULDER], s[LM.R_SHOULDER], s[LM.L_ELBOW], s[LM.R_ELBOW], s[LM.L_WRIST], s[LM.R_WRIST], 'left');
    const R = armInfo(s[LM.L_SHOULDER], s[LM.R_SHOULDER], s[LM.L_ELBOW], s[LM.R_ELBOW], s[LM.L_WRIST], s[LM.R_WRIST], 'right');

    // 站立/行走时手臂自然下垂，靠前臂伸展 + 速度 + 前伸量识别直拳
    const bothExtended = L.straight > 0.55 && R.straight > 0.55 && L.forward > 0.17 && R.forward > 0.17 && !this.state.blocking;
    const punchScoreL = L.straight * 0.36 + L.forward * 0.34 + clamp(L.wristSpeed / 5.5, 0, 1) * 0.5;
    const punchScoreR = R.straight * 0.36 + R.forward * 0.34 + clamp(R.wristSpeed / 5.5, 0, 1) * 0.5;

    // 双手抬高时不再判定直拳，避免抬手动作误触
    const bothRaised = L.wrist.y < sShoulderMid.y - 0.015 && R.wrist.y < sShoulderMid.y - 0.015;

    // 双手高举：必杀蓄力
    const overhead = L.wrist.y < s[LM.NOSE].y - 0.02 && R.wrist.y < s[LM.NOSE].y - 0.02 &&
      L.straight > 0.25 && R.straight > 0.25 && Math.abs(L.wrist.y - R.wrist.y) < 0.16;
    if (overhead) {
      this.ultimateHold += dt;
      if (this.ultimateHold >= 0.86 && !this.ultimateFired) {
        this.ultimateFired = true;
        this.suppressPunchUntil = now + 0.55;
        this.emit('ultimate');
      }
    } else {
      this.ultimateHold = Math.max(0, this.ultimateHold - dt * 2.2);
      if (!overhead && this.ultimateHold < 0.12) this.ultimateFired = false;
    }

    // 双臂交叉护胸：两手靠近身体中线、肘部弯曲
    const wristYm = (L.wrist.y + R.wrist.y) / 2;
    const wristsNarrow = Math.abs(L.wrist.x - R.wrist.x) < shoulderW * 0.82;
    const wristsCentered = Math.abs((L.wrist.x + R.wrist.x) / 2 - sShoulderMid.x) < shoulderW * 0.42;
    const chestHeight = wristYm > sShoulderMid.y + 0.015 && wristYm < sHipMid.y + torsoLen * 0.22;
    const elbowsBent = L.angle < 2.5 && R.angle < 2.5;
    const guardPose = wristsNarrow && wristsCentered && chestHeight && elbowsBent && !overhead;
    if (guardPose) this.guardHold += dt;
    else this.guardHold = Math.max(0, this.guardHold - dt * 1.6);
    const blocking = this.guardHold > 0.16;

    // 双掌前推 -> 等离子炮
    this.blastCooldown = Math.max(0, this.blastCooldown - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    // A held fist is one action. Rearm only after a visible retraction below,
    // never on a timer while the player's arm is still extended.
    if (bothExtended) this.blastHeld += dt;
    else {
      this.blastHeld = Math.max(0, this.blastHeld - dt * 3);
      if (this.blastHeld < 0.05) this.blastFired = false;
    }
    let blast = false;
    if (bothExtended && this.blastHeld > 0.055 && this.blastCooldown <= 0 && !this.blastFired) {
      this.blastFired = true;
      this.blastCooldown = 1.65;
      this.suppressPunchUntil = now + 0.6;
      blast = true;
      this.emit('blast');
      this.state.gesture = '双掌冲击';
    }

    // 半身新增技能：双臂横向张开 -> 肩部导弹齐射；单臂高举 -> 光刃。
    this.missileCooldown = Math.max(0, this.missileCooldown - dt);
    this.bladeCooldown = Math.max(0, this.bladeCooldown - dt);
    const armsWide = L.lift > -0.32 && R.lift > -0.32 &&
      L.out > 0.72 && R.out > 0.72 &&
      L.forward < 0.45 && R.forward < 0.45 &&
      L.straight > 0.25 && R.straight > 0.25;
    if (armsWide && !guardPose && !overhead) this.missileHold += dt;
    else {
      this.missileHold = Math.max(0, this.missileHold - dt * 2.6);
      if (this.missileHold < 0.05) this.missileFired = false;
    }
    let missile = false;
    if (armsWide && this.missileHold > 0.28 && this.missileCooldown <= 0 && !this.missileFired) {
      this.missileFired = true;
      this.missileCooldown = 4.6;
      this.suppressPunchUntil = now + 0.55;
      missile = true;
      this.emit('missile');
      this.state.gesture = '导弹齐射';
    }

    const leftAboveHead = L.wrist.y < s[LM.NOSE].y - 0.02;
    const rightAboveHead = R.wrist.y < s[LM.NOSE].y - 0.02;
    const oneHigh = leftAboveHead !== rightAboveHead && !overhead &&
      (leftAboveHead ? R.wrist.y > sShoulderMid.y : L.wrist.y > sShoulderMid.y);
    if (oneHigh && !blocking) this.bladeHold += dt;
    else {
      this.bladeHold = Math.max(0, this.bladeHold - dt * 2.4);
      if (this.bladeHold < 0.05) this.bladeFired = false;
    }
    let blade = false;
    if (oneHigh && this.bladeHold > 0.36 && this.bladeCooldown <= 0 && !this.bladeFired) {
      this.bladeFired = true;
      this.bladeCooldown = 4.6;
      this.suppressPunchUntil = now + 0.65;
      blade = true;
      this.emit('blade', { side: leftAboveHead ? 'left' : 'right' });
      this.state.gesture = '光刃出鞘';
    }

    // 出拳：必须同时满足向前伸展 + 手臂伸直，并且处于已收回状态。
    // 双手抬高、正在蓄力必杀、刚触发双掌炮或防御时，一律不判定直拳。
    const suppressPunch = now < this.suppressPunchUntil || blocking || overhead || bothRaised || armsWide || oneHigh;
    if (!suppressPunch) {
      for (const side of ['left', 'right']) {
        const info = side === 'left' ? L : R;
        const score = side === 'left' ? punchScoreL : punchScoreR;
        const canPunch = this.punchArmed[side] &&
          now - this.lastPunchAt[side] > 0.24 &&
          !bothExtended &&
          !this.state.blocking &&
          info.straight > 0.6 &&
          info.forward > 0.18 &&
          (info.wristSpeed > 0.45 || info.forward > 0.32);
        if (canPunch) {
          this.emit('punch', { side, power: clamp(score), speed: info.wristSpeed });
          this.lastPunchAt[side] = now;
          this.punchArmed[side] = false;
          this.state.gesture = side === 'left' ? '左拳' : '右拳';
        }
        // 收回后重新武装
        if (!this.punchArmed[side] && (info.straight < 0.5 || info.forward < 0.08) && now - this.lastPunchAt[side] > 0.35) {
          this.punchArmed[side] = true;
        }
      }
    } else {
      if (blocking || bothRaised || overhead) {
        this.punchArmed.left = L.straight < 0.45 && L.forward < 0.08;
        this.punchArmed.right = R.straight < 0.45 && R.forward < 0.08;
      }
    }

    // 快速侧倾 -> 闪避
    const fastLean = Math.abs(this.leanVelocity) > 2.4 && Math.abs(lean) > 0.3;
    if (fastLean && this.dodgeCooldown <= 0 && !blocking) {
      this.dodgeCooldown = 1.25;
      const dir = lean > 0 ? 'right' : 'left';
      this.emit('dodge', { side: dir, power: clamp(Math.abs(this.leanVelocity) / 5) });
      this.state.gesture = dir === 'right' ? '右闪' : '左闪';
    }

    const strafe = Math.abs(lean) > 0.075 ? clamp(lean * 2.6, -1, 1) : 0;
    const ultimateCharge = clamp(this.ultimateHold / 0.86);
    let gesture = '待机';
    if (visible) {
      if (blocking) gesture = '装甲防御';
      else if (overhead) gesture = ultimateCharge >= 1 ? '必杀就绪' : `双手高举 ${Math.round(ultimateCharge * 100)}%`;
      else if (blast) gesture = '等离子炮';
      else if (missile) gesture = '导弹齐射';
      else if (blade) gesture = '光刃出鞘';
      else if (move > 0.05) gesture = running ? '奔跑' : '行军';
      else if (Math.abs(lean) > 0.16) gesture = lean > 0 ? '右倾' : '左倾';
      else if (now < this.gestureFlashUntil) gesture = this.state.gesture;
      else gesture = '待机';
    }

    this.state = {
      visible: true,
      quality,
      fullBody,
      upperBody,
      halfBody: visible && !fullBody,
      calibration: clamp(this.calibrationTime / 1.2),
      move,
      moving,
      running,
      speed: running ? 26 : 12,
      stepRate,
      stepping: newStep,
      lean,
      strafe,
      blocking,
      ultimateCharge,
      punchArm: now - this.lastPunchAt.left < 0.3 ? 'left' : now - this.lastPunchAt.right < 0.3 ? 'right' : null,
      gesture,
      arms: {
        left: { lift: L.lift, out: L.out, forward: L.forward, straight: L.straight, bend: L.angle, wristY: L.wrist.y },
        right: { lift: R.lift, out: R.out, forward: R.forward, straight: R.straight, bend: R.angle, wristY: R.wrist.y },
      },
      shoulderTilt: clamp((s[LM.L_SHOULDER].y - s[LM.R_SHOULDER].y) / shoulderW, -1.5, 1.5),
      headX: clamp((s[LM.NOSE].x - sShoulderMid.x) / shoulderW, -1.5, 1.5),
      missileCooldown: this.missileCooldown,
      bladeCooldown: this.bladeCooldown,
      activeParts: {
        left: L.forward > 0.15 || L.straight > 0.7,
        right: R.forward > 0.15 || R.straight > 0.7,
        both: bothExtended,
        guard: blocking,
        overhead,
        wide: armsWide,
        high: oneHigh,
      },
      eventFlash: now < this.gestureFlashUntil ? this.state.eventFlash : '',
      leanVelocity: this.leanVelocity,
      footLift: [liftL, liftR],
    };
    // 把事件写入状态用于 UI 闪现
    if (this.events.length) {
      const last = this.events[this.events.length - 1];
      this.state.eventFlash = last.type;
      this.state.gesture = last.type === 'punch' ? (last.side === 'left' ? '左拳' : '右拳')
        : last.type === 'blast' ? '双掌冲击'
          : last.type === 'missile' ? '导弹齐射'
            : last.type === 'blade' ? '光刃出鞘'
              : last.type === 'dodge' ? (last.side === 'right' ? '右闪' : '左闪')
                : last.type === 'ultimate' ? '必杀输入'
                  : this.state.gesture;
    }
    return this.state;
  }

  loseTracking(dt) {
    this.lostTime += dt;
    this.prevLandmarks = null;
    this.blastHeld = 0;
    this.guardHold = 0;
    this.ultimateHold = Math.max(0, this.ultimateHold - dt * 3);
    this.prevWristWorld.left = null;
    this.prevWristWorld.right = null;
    this.stepTimes = [];
    if (this.lostTime > 0.35) {
      this.shoulderBaseline = null;
      this.baselineSamples = 0;
      this.state = {
        ...this.state,
        visible: false,
        quality: 0,
        fullBody: false,
        upperBody: false,
        halfBody: false,
        move: 0,
        moving: false,
        running: false,
        blocking: false,
        ultimateCharge: 0,
        strafe: 0,
        lean: 0,
        gesture: '未检测到上半身',
        arms: {
          left: { lift: 0, out: 0, forward: 0, straight: 0, bend: 0, wristY: 0.5 },
          right: { lift: 0, out: 0, forward: 0, straight: 0, bend: 0, wristY: 0.5 },
        },
        activeParts: { left: false, right: false, both: false, guard: false, overhead: false, wide: false, high: false },
      };
    }
    return this.state;
  }
}

/**
 * 给界面/调参用的合成姿态生成器。测试时可直接喂进 analyzer。
 */
export function makeSyntheticPose(overrides = {}) {
  const base = [];
  for (let i = 0; i < 33; i++) base.push({ x: 0.5, y: 0.5, z: 0, visibility: 0.98 });
  const set = (i, x, y, z = 0) => { base[i] = { x, y, z, visibility: 0.98 }; };
  set(LM.NOSE, 0.5, 0.16, 0);
  set(LM.L_SHOULDER, 0.36, 0.3, 0);
  set(LM.R_SHOULDER, 0.64, 0.3, 0);
  set(LM.L_ELBOW, 0.32, 0.45, 0);
  set(LM.R_ELBOW, 0.68, 0.45, 0);
  set(LM.L_WRIST, 0.3, 0.58, 0);
  set(LM.R_WRIST, 0.7, 0.58, 0);
  set(LM.L_HIP, 0.42, 0.52, 0);
  set(LM.R_HIP, 0.58, 0.52, 0);
  set(LM.L_KNEE, 0.41, 0.7, 0);
  set(LM.R_KNEE, 0.59, 0.7, 0);
  set(LM.L_ANKLE, 0.4, 0.88, 0);
  set(LM.R_ANKLE, 0.6, 0.88, 0);
  const world = base.map((p) => ({ x: (0.5 - p.x) * 0.8, y: (p.y - 0.5) * 1.8, z: 0, visibility: p.visibility }));
  Object.assign(base, overrides.normalized || {});
  if (overrides.world) Object.assign(world, overrides.world);
  return { normalized: base, world };
}
