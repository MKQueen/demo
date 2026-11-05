import { InferenceClient } from './inferenceClient.js';
import { LM } from './gesture.js';
import { MotionSession } from './motionSession.js';
import { personBoxes, cropForPerson, mapCropLandmarks } from './playerTracker.js';

const CONNECTIONS = [
  [LM.L_SHOULDER, LM.R_SHOULDER],
  [LM.L_SHOULDER, LM.L_ELBOW], [LM.L_ELBOW, LM.L_WRIST],
  [LM.R_SHOULDER, LM.R_ELBOW], [LM.R_ELBOW, LM.R_WRIST],
  [LM.L_SHOULDER, LM.L_HIP], [LM.R_SHOULDER, LM.R_HIP], [LM.L_HIP, LM.R_HIP],
  [LM.L_HIP, LM.L_KNEE], [LM.L_KNEE, LM.L_ANKLE],
  [LM.R_HIP, LM.R_KNEE], [LM.R_KNEE, LM.R_ANKLE],
  [LM.L_SHOULDER, LM.R_HIP], [LM.R_SHOULDER, LM.L_HIP],
];

function baseUrl(path) {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${path}`.replace(/([^:]\/)\/+/g, '$1');
}

export class PoseCamera {
  constructor(options = {}) {
    this.video = options.video;
    this.gameVideo = options.gameVideo;
    this.canvases = [options.setupCanvas, options.gameCanvas].filter(Boolean);
    this.session = new MotionSession();
    this.poseModel=options.poseModel==='lite'?'lite':'full';
    this.analyzer = this.session.analyzer;
    this.inference = null;
    this.inFlight = false;
    this.generation = 0;
    this.lastPersonDetect = -Infinity;
    this.lastFrameAt = 0;
    this.inferenceMs = 0;
    this.timingSamples=[];
    this.stream = null;
    this.ready = false;
    this.running = false;
    this.starting = false;
    this.delegate = null;
    this.error = null;
    this.events = [];
    this.lastDetect = 0;
    this.lastVideoTime = -1;
    this.lastQualityAt = 0;
    this.results = null;
    this.quality = 0;
    this.fullBody = false;
    this.trackingLost = false;
    this.readyTime = 0;
    this.frameCount = 0;
    this.detectFps = 0;
    this.lastDetectAt = 0;
    this.lastLoopAt = 0;
    this.onReady = options.onReady || (() => {});
    this.onStatus = options.onStatus || (() => {});
    this.onError = options.onError || (() => {});
    this.onQuality = options.onQuality || (() => {});
    this.onPose = options.onPose || (() => {});
    this.loop = this.loop.bind(this);
    this.lastStatusText = '';
  }

  async init() {
    if (this.ready) return true;
    if (this.starting) return false;
    this.starting = true;
    this.clearError();
    try {
      if (!window.isSecureContext) {
        throw new Error('INSECURE_CONTEXT');
      }
      this.status('正在请求摄像头权限…');
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('NO_MEDIA_API');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });
      this.stream = stream;
      this.video.srcObject = stream;
      if (this.gameVideo) {
        this.gameVideo.srcObject = stream;
        this.gameVideo.muted = true;
        this.gameVideo.playsInline = true;
      }
      await this.video.play();
      if (this.gameVideo) {
        try { await this.gameVideo.play(); } catch (e) { /* 在 HUD 显示后再次尝试 */ }
      }
      this.status('正在加载姿态追踪模型…');
      if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
        throw new Error('当前浏览器缺少后台推理支持，请使用新版 Chrome / Edge / Safari，或选择键盘模式');
      }
      this.inference = new InferenceClient(baseUrl('mediapipe/inference-worker.js'));
      const workerInfo = await this.inference.request('init', {poseModel:this.poseModel}, [], 60000);
      this.delegate = workerInfo.delegate;
      this.detectorDelegate = 'CPU';
      this.video.srcObject?.getVideoTracks().forEach(track=>{
        track.addEventListener('ended',()=>this.invalidate('camera-ended'));
        track.addEventListener('mute',()=>this.invalidate('camera-muted'));
      });
      this.ready = true;
      this.readyTime = performance.now();
      this.starting = false;
      this.status(`体感链路已就绪 · ${this.delegate}`);
      this.startLoop();
      this.onReady({ delegate: this.delegate });
      return true;
    } catch (err) {
      this.starting = false;
      this.error = this.describeError(err);
      this.inference?.close(); this.inference = null;
      this.status('链路建立失败');
      try { this.stopStream(); } catch (e) {}
      console.error('[STEEL DAWN] Pose init failed:', err);
      this.onError(this.error);
      return false;
    }
  }

  startLoop() {
    if (this.running) return;
    this.running = true;
    this.lastLoopAt = performance.now();
    requestAnimationFrame(this.loop);
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.1, Math.max(0.001, (now - this.lastLoopAt) / 1000));
    this.lastLoopAt = now;
    if (this.ready && this.video.readyState >= 2) {
      const interval = this.delegate === 'GPU' ? 1000 / 30 : 1000 / 22;
      if (!this.inFlight && now - this.lastDetect >= interval && this.video.currentTime !== this.lastVideoTime) {
        this.lastDetect = now;
        this.lastVideoTime = this.video.currentTime;
        this.processVideoFrame(now).catch(err => {
          this.invalidate('inference-error');
          if (this.inference?.closed) {
            this.ready = false; this.stopStream();
            this.onError(this.describeError(err));
          }
        });
      }
    }
    const safeState=this.session.watchdog(now);
    if(safeState!==this.currentState)this.publish(safeState);
    if(now-this.lastFrameAt>500&&this.results){this.results=null;this.invalidate('stale');}
    this.draw();
    // 空闲时也给 UI 一个心跳
    if (now - this.lastQualityAt > 120) {
      this.lastQualityAt = now;
      this.onQuality({
        quality: this.quality,
        fullBody: this.fullBody,
        visible: this.currentState?.visible===true,
        state: this.currentState,
        tracking: this.currentState?.tracking,
        controlReady: this.currentState?.controlReady===true,
        inferenceMs:this.inferenceMs,
        delegate: this.delegate,
      });
    }
    requestAnimationFrame(this.loop);
  }

  async processVideoFrame(now) {
    if (this.inFlight || !this.inference || !this.video.videoWidth) return;
    this.inFlight = true;
    const generation = this.generation, started = performance.now();
    const w = this.video.videoWidth, h = this.video.videoHeight;
    let bitmap;
    try {
      bitmap = await createImageBitmap(this.video);
      const capturedAt=performance.now();
      if (!this.running || generation !== this.generation) return;
      const detect = now - this.lastPersonDetect >= 250;
      const pending = this.inference.request('detect', { bitmap, detect, now }, [bitmap]);
      bitmap = null; // ownership transferred
      const found = await pending;
      const detectedAt=performance.now();
      if (generation !== this.generation) {
        await this.inference.request('pose', { crop: null, now }); return;
      }
      if (detect) {
        this.lastPersonDetect = now;
        this.session.tracker.update(personBoxes(found.detections, found.width, found.height), now);
      }
      const tracking = this.session.tracking(now);
      const crop = tracking.phase === 'tracked' ? cropForPerson(tracking.box, w, h) : null;
      const result = await this.inference.request('pose', { crop, now });
      if (generation !== this.generation || !this.running) return;
      this.inferenceMs = performance.now() - started;
      this.timingSamples.push({captureMs:capturedAt-started,
        detectorRoundTripMs:detectedAt-capturedAt,poseRoundTripMs:performance.now()-detectedAt,
        frameAgeAtResultMs:performance.now()-now,personDetection:detect,poseRequested:!!crop});
      if(this.timingSamples.length>120)this.timingSamples.shift();
      // Acquisition time, not completion time: slow results must never revive stale controls.
      if (performance.now() - now > 500) { this.invalidate('stale'); return; }
      this.lastFrameAt = now;
      if (!crop) { this.results = null; this.publish(this.session.invalidate(now, tracking.phase)); }
      else {
        this.results = { landmarks: (result.landmarks || []).map(l => mapCropLandmarks(l, crop)), worldLandmarks: result.worldLandmarks };
        this.processResults(this.results, now);
      }
    } finally { bitmap?.close(); this.inFlight = false; }
  }

  publish(state){
    this.currentState=state;this.quality=state.quality;this.fullBody=state.fullBody;
    this.trackingLost=!state.controlReady;this.onPose(state);
  }

  invalidate(reason){
    if (reason === 'camera-ended' || reason === 'camera-muted') this.generation++;
    this.results=null;this.publish(this.session.invalidate(performance.now(),reason));
  }

  processResults(res, now) {
    const landmarks = res?.landmarks?.[0];
    const world = res?.worldLandmarks?.[0];
    this.publish(this.session.update(landmarks,world,now,{width:this.video.videoWidth,height:this.video.videoHeight}));
  }

  resumeVideoFeed() {
    if (!this.stream) return;
    if (this.gameVideo) {
      if (this.gameVideo.srcObject !== this.stream) this.gameVideo.srcObject = this.stream;
      this.gameVideo.muted = true;
      this.gameVideo.play().catch(() => {});
    }
    if (this.video && this.video.paused) this.video.play().catch(() => {});
  }

  takeEvents() {
    return this.getInputFrame().events;
  }

  clearEvents() {
    this.events = [];
    this.session.events=[];
    this.analyzer.takeEvents();
  }

  getState() {
    return this.session.watchdog(performance.now());
  }

  getDiagnostics() {
    const stages={};
    for(const key of ['captureMs','detectorRoundTripMs','poseRoundTripMs','frameAgeAtResultMs']){
      const values=this.timingSamples.filter(s=>s.poseRequested).map(s=>s[key]).sort((a,b)=>a-b);
      stages[key]=values.length?{median:values[Math.floor((values.length-1)*.5)],p95:values[Math.ceil((values.length-1)*.95)]}:null;
    }
    return {delegate:this.delegate,poseModel:this.poseModel,videoSize:[this.video.videoWidth,this.video.videoHeight],
      samples:this.timingSamples.length,poseSamples:this.timingSamples.filter(s=>s.poseRequested).length,
      detectionSamples:this.timingSamples.filter(s=>s.personDetection).length,
      tracking:this.getState().tracking?.phase,stages};
  }

  getInputFrame(){return this.session.frame(performance.now());}

  resetTracking(){
    this.generation++;
    this.results=null;this.lastPersonDetect=-Infinity;
    this.publish(this.session.reset(performance.now()));
  }

  describeError(err) {
    const name = err?.name || '';
    const msg = err?.message || String(err);
    if (msg === 'INSECURE_CONTEXT') return '当前页面不是安全上下文。请通过 http://127.0.0.1:5190 打开游戏，浏览器才会允许摄像头。';
    if (msg === 'NO_MEDIA_API') return '当前浏览器不支持 getUserMedia。请使用最新版 Chrome / Edge / Safari。';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return '摄像头权限被拒绝。请点击地址栏的摄像头图标允许访问，然后重试。';
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return '没有检测到可用摄像头。请连接摄像头，或使用键盘模式。';
    if (name === 'NotReadableError' || name === 'TrackStartError') return '摄像头被其他程序占用。关闭其他视频会议/相机应用后再试。';
    if (name === 'OverconstrainedError') return '摄像头不支持请求的分辨率。请关闭其他摄像头应用后重试。';
    if (msg.includes('Failed to fetch') || msg.includes('model') || msg.includes('wasm')) return '姿态模型加载失败。请确认 public/mediapipe 资源完整，或刷新页面重试。';
    return `体感初始化失败：${msg}`;
  }

  draw() {
    for (const canvas of this.canvases) {
      if (!canvas) continue;
      const ctx = canvas.getContext('2d');
      const vw = this.video.videoWidth || 640;
      const vh = this.video.videoHeight || 480;
      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
      }
      ctx.clearRect(0, 0, vw, vh);
      this.drawTracking(ctx,vw,vh);
      const landmarks = this.results?.landmarks?.[0];
      if (!landmarks) {
        this.drawScanline(ctx, vw, vh);
        continue;
      }
      const color = this.quality > 0.55 ? '#74f7ff' : this.quality > 0.3 ? '#ffcf72' : '#ff7b5a';
      ctx.save();
      ctx.lineWidth = Math.max(2, vw * 0.0035);
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = vw * 0.015;
      ctx.globalAlpha = 0.9;
      for (const [a, b] of CONNECTIONS) {
        const pa = landmarks[a];
        const pb = landmarks[b];
        if (!pa || !pb) continue;
        if ((pa.visibility ?? 0) < 0.2 || (pb.visibility ?? 0) < 0.2) continue;
        ctx.beginPath();
        ctx.moveTo((1 - pa.x) * vw, pa.y * vh);
        ctx.lineTo((1 - pb.x) * vw, pb.y * vh);
        ctx.stroke();
      }
      // face ring + spine accent
      const nose = landmarks[LM.NOSE];
      if (nose) {
        ctx.beginPath();
        ctx.arc((1 - nose.x) * vw, nose.y * vh, vw * 0.025, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.7;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      for (let i = 0; i < landmarks.length; i++) {
        const p = landmarks[i];
        if ((p.visibility ?? 0) < 0.25) continue;
        const isHand = i === LM.L_WRIST || i === LM.R_WRIST;
        const isFoot = i === LM.L_ANKLE || i === LM.R_ANKLE;
        const active = (isHand && (this.currentState?.activeParts.left || this.currentState?.activeParts.right)) ||
          (isFoot && this.currentState?.moving);
        ctx.fillStyle = active ? '#ffffff' : color;
        ctx.globalAlpha = active ? 1 : 0.7;
        ctx.beginPath();
        ctx.arc((1 - p.x) * vw, p.y * vh, active ? vw * 0.009 : vw * 0.005, 0, Math.PI * 2);
        ctx.fill();
      }
      // bounding brackets
      let minX = 1, maxX = 0, minY = 1, maxY = 0, count = 0;
      for (const p of landmarks) {
        if ((p.visibility ?? 0) < 0.3) continue;
        minX = Math.min(minX, 1 - p.x); maxX = Math.max(maxX, 1 - p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        count++;
      }
      if (count > 4) {
        const x = minX * vw, y = minY * vh, w = (maxX - minX) * vw, h = (maxY - minY) * vh;
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        const pad = vw * 0.02;
        const cs = vw * 0.03;
        for (const [cx, cy, sx, sy] of [[x - pad, y - pad, 1, 1], [x + w + pad, y - pad, -1, 1], [x - pad, y + h + pad, 1, -1], [x + w + pad, y + h + pad, -1, -1]]) {
          ctx.beginPath();
          ctx.moveTo(cx, cy + sy * cs);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + sx * cs, cy);
          ctx.stroke();
        }
      }
      // scan sweep
      const t = performance.now() / 1000;
      const sy = ((t * 0.23) % 1) * vh;
      ctx.globalAlpha = 0.08;
      const g = ctx.createLinearGradient(0, sy - 30, 0, sy + 30);
      g.addColorStop(0, 'rgba(120,245,255,0)');
      g.addColorStop(0.5, 'rgba(120,245,255,1)');
      g.addColorStop(1, 'rgba(120,245,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, sy - 30, vw, 60);
      ctx.restore();
    }
  }

  drawScanline(ctx, w, h) {
    const t = performance.now() / 1000;
    ctx.save();
    ctx.strokeStyle = 'rgba(99,245,255,.18)';
    ctx.lineWidth = 1;
    const y = ((t * 0.3) % 1) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.restore();
  }

  drawTracking(ctx,w,h){
    const tracking=this.session.tracking(performance.now()),state=this.currentState;
    ctx.save();ctx.lineWidth=Math.max(2,w*.003);ctx.font=`600 ${Math.max(14,w*.022)}px sans-serif`;
    ctx.strokeStyle='rgba(200,210,220,.35)';ctx.setLineDash([8,8]);
    for(const b of tracking.people)ctx.strokeRect((1-b.x-b.width)*w,b.y*h,b.width*w,b.height*h);
    const b=tracking.box;
    if(b){
      ctx.setLineDash(tracking.phase==='tracked'?[]:[10,6]);
      ctx.strokeStyle=state?.controlReady?'#72f5ce':'#ffce76';
      ctx.strokeRect((1-b.x-b.width)*w,b.y*h,b.width*w,b.height*h);
    }
    const labels={searching:'请站到画面中央',acquiring:'发现人物 · 正在锁定',tracked:'人物已锁定',calibrating:'骨骼已识别 · 请站定校准',active:'玩家已锁定 · 体感已接入',lost:'玩家丢失 · 请回到原位置','skeleton-lost':'人物已锁定 · 请露出头肩和双手',stale:'画面中断 · 体感输入已停止','inference-error':'识别暂时中断','camera-ended':'摄像头已断开','camera-muted':'摄像头暂停'};
    const label=labels[state?.tracking?.phase||tracking.phase]||'正在恢复追踪';
    ctx.fillStyle='rgba(3,13,21,.8)';ctx.fillRect(0,0,w,w*.055);
    ctx.fillStyle='#e0f4fa';ctx.fillText(label,w*.015,w*.036);
    ctx.restore();
  }

  status(text) {
    if (text === this.lastStatusText) return;
    this.lastStatusText = text;
    this.onStatus(text);
  }

  clearError() {
    this.error = null;
  }

  stopStream() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    if (this.video) this.video.srcObject = null;
    if (this.gameVideo) this.gameVideo.srcObject = null;
  }

  dispose() {
    this.running = false;
    this.ready = false;
    this.generation++;
    this.inference?.close();
    this.invalidate('camera-ended');
    this.stopStream();
  }
}
