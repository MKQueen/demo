// 京城来信 · 程序化 WebAudio 引擎（100% 原创 · 零外部音频文件）
// ===========================================================================
// 这个文件不 fetch 任何音频采样，也不调用 assets 的音频加载接口。
// BGM、7 个区域环境音、脚步/跳跃/落地、全部 UI cue 都由 WebAudio 节点实时合成；
// BGM 由 music.js 用 OfflineAudioContext 预渲染成一条无缝 loop 的 AudioBuffer。
//
// 对外 API 与旧版 `createAudio(assets)` 完全兼容：
//   unlock() / preload() / setRegion(name) /
//   playFootstep({run}) / playFootstepWater() / playJump() / playLand() /
//   playCue(name) / playFile(path, opts) /
//   setMuted(b) / toggleMute() / isMuted() / setBusVolume(bus,v) / getBusVolume(bus) /
//   update() / dispose() / ready / unlocked / region / muted / ctx
// 额外诊断（非契约，测试页 / Playwright 用）：
//   musicPlaying / musicBuffer / musicMeta / musicMode / diagnostics()
//
// 额外可测试导出（不属于游戏运行时 API）：
//   CUES                  cue 名 -> 合成函数（参数 session：{ctx,dest,now,rand,noise}）
//   AMBIENCE_KEYS         区域环境音 key 列表
//   AMBIENT_META          区域中文说明 / 层级描述
//   AMBIENT_EVENT_NAMES   各区域偶发事件名（海鸥/钟声/喇叭……）
//   buildAmbience(ctx,key,dest,opts)  在任意 BaseAudioContext（含 Offline）里搭区域环境音
//   createNoiseBuffer(ctx,...)        程序化噪声缓冲
//   makeSfxSession(ctx,dest,opts)     构造 CUES 需要的 session
//
// 兼容性：没有 AudioContext（Node / 极老浏览器）时静默降级，但保留静音状态与
// localStorage 持久化；静音 / 音量会写入与旧版相同的 key（可带 storagePrefix）。
// ===========================================================================

import { MUSIC, mulberry32, renderMusic, createRealtimeMusic } from './music.js';

export { MUSIC };

// ---------------------------------------------------------------------------
// 常量 / 持久化
// ---------------------------------------------------------------------------

const LS_MUTED = 'bjcourier.audio.muted';
const LS_MUSIC = 'bjcourier.audio.music';
const LS_AMBIENCE = 'bjcourier.audio.ambience';
const LS_SFX = 'bjcourier.audio.sfx';

const DEFAULT_VOLUMES = { master: 1, music: 0.5, ambience: 0.4, sfx: 0.65 };

const NOISE_SEED = 0x51ee7;

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function readNumber(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function writeNumber(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* 隐身模式 / Node：忽略 */
  }
}

// 区域别名：兼容 story/UI 里出现过的旧名字。
const REGION_ALIASES = {
  harbor: 'beach',
  harbour: 'beach',
  sea: 'beach',
  dock: 'beach',
  town: 'city',
  mountain: 'temple',
  falls: 'waterfalls',
  waterfall: 'waterfalls',
  start: 'base',
  intro: 'base',
  home: 'base',
  woods: 'forest',
  workshop: 'factory',
};

const DEFAULT_REGION = 'base';

// ---------------------------------------------------------------------------
// 程序化噪声缓冲
// ---------------------------------------------------------------------------

/**
 * 生成一段（默认立体声、两声道去相关的）白噪声 AudioBuffer。
 * 区域环境音把它送进不同的滤波器 / LFO；音效拿它做短促噪声层。
 */
export function createNoiseBuffer(ctx, seconds = 8, channels = 2, seed = NOISE_SEED) {
  const sr = ctx.sampleRate;
  const length = Math.max(1, Math.floor(seconds * sr));
  const buffer = ctx.createBuffer(channels, length, sr);
  const rand = mulberry32(seed);
  for (let ch = 0; ch < channels; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) data[i] = rand() * 2 - 1;
  }
  return buffer;
}

const noiseCache = new WeakMap();
function getNoiseBuffer(ctx) {
  let buffer = noiseCache.get(ctx);
  if (!buffer) {
    buffer = createNoiseBuffer(ctx, 8, 2, NOISE_SEED);
    noiseCache.set(ctx, buffer);
  }
  return buffer;
}

/** 黑胶"爆点"one-shot：极短、带随机极性的噪声脉冲。 */
const crackleCache = new WeakMap();
function getCrackleBuffer(ctx) {
  let buffer = crackleCache.get(ctx);
  if (buffer) return buffer;
  const sr = ctx.sampleRate;
  const length = Math.max(16, Math.floor(0.035 * sr));
  buffer = ctx.createBuffer(1, length, sr);
  const data = buffer.getChannelData(0);
  const rand = mulberry32(0xc4ac1e);
  for (let i = 0; i < length; i += 1) {
    const t = i / sr;
    const env = Math.exp(-t * 150);
    data[i] = (rand() * 2 - 1) * env * (rand() > 0.5 ? 1 : -1);
  }
  crackleCache.set(ctx, buffer);
  return buffer;
}

// ---------------------------------------------------------------------------
// 环境音：区域描述 + 实时分层合成
// ---------------------------------------------------------------------------

export const AMBIENCE_KEYS = ['base', 'beach', 'village', 'city', 'forest', 'factory', 'temple', 'waterfalls'];

export const AMBIENT_META = {
  base: {
    name: '微风',
    latin: 'BREEZE',
    layers: '低频风声 + 空气层 + 缓慢阵风 LFO',
    events: '远处阵风',
  },
  beach: {
    name: '海边码头',
    latin: 'HARBOUR',
    layers: '海床低频 + 浪涌带通噪声（双 LFO）+ 浪花高频',
    events: '海浪拍岸 / 海鸥',
  },
  village: {
    name: '村子',
    latin: 'VILLAGE',
    layers: '低柔风声 + 叶隙声 + 远处生活底噪',
    events: '鸟鸣 / 风铃 / 远处人声',
  },
  city: {
    name: '城市街巷',
    latin: 'CITY',
    layers: '车流低频轰鸣 + 中频车流 + 50Hz 电网嗡鸣',
    events: '汽车驶过 / 喇叭 / 自行车铃',
  },
  forest: {
    name: '森林',
    latin: 'FOREST',
    layers: '树梢风声 + 叶隙声 + 高频虫鸣床',
    events: '蟋蟀 / 鸟鸣 / 阵风',
  },
  factory: {
    name: '工厂',
    latin: 'FACTORY',
    layers: '机械低鸣（50/100/150Hz 谐波）+ 金属轰鸣 + 蒸汽嘶声',
    events: '金属撞击 / 蒸汽泄压',
  },
  temple: {
    name: '山寺',
    latin: 'TEMPLE',
    layers: '山风 + 高空气层 + 极低音持续音',
    events: '钟声 / 磬声 / 山风阵',
  },
  waterfalls: {
    name: '瀑布边',
    latin: 'FALLS',
    layers: '宽带水声轰鸣 + 中频水雾 + 低频水压 + 高频水花',
    events: '水花飞溅 / 水滴',
  },
};

// 各区域底噪的整体增益（合成出来 RMS 不同，统一到相近的听感响度）
const REGION_LEVEL = {
  base: 2.0,
  beach: 1.8,
  village: 2.2,
  city: 2.6,
  forest: 2.4,
  factory: 3.0,
  temple: 3.0,
  waterfalls: 1.6,
};

/** 环境音的分层构造器：返回 { out, sources, lfos, stop(at) }。 */
export function buildAmbience(ctx, key, destination, opts = {}) {
  const startAt = opts.startAt != null ? opts.startAt : ctx.currentTime;
  const rand = opts.rand || Math.random;
  const noise = opts.noise || createNoiseBuffer(ctx, 8, 2, NOISE_SEED + (key ? key.length : 0));

  const out = ctx.createGain();
  out.gain.value = (opts.gain != null ? opts.gain : 1) * (REGION_LEVEL[key] || 1);
  out.connect(destination);

  const sources = [];
  const lfos = [];
  let stopped = false;

  function lfo(freq, depth, type = 'sine') {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = depth;
    osc.connect(gain);
    osc.start(startAt);
    lfos.push(osc);
    return gain;
  }

  // 一个滤波噪声层：noise -> filter -> gain -> panner -> out
  function noiseLayer(cfg = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = cfg.type || 'lowpass';
    filter.frequency.value = cfg.freq != null ? cfg.freq : 500;
    filter.Q.value = cfg.q != null ? cfg.q : 0.7;
    const gain = ctx.createGain();
    const base = cfg.gain != null ? cfg.gain : 0.2;
    gain.gain.value = cfg.swell ? base * 0.62 : base;
    const pan = ctx.createStereoPanner();
    pan.pan.value = cfg.pan || 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(out);
    if (cfg.swell) {
      const depth = lfo(cfg.swell.freq || 0.08, base * (cfg.swell.depth != null ? cfg.swell.depth : 0.32), cfg.swell.type || 'sine');
      depth.connect(gain.gain);
    }
    if (cfg.filterSwell) {
      const depth = lfo(cfg.filterSwell.freq || 0.05, cfg.filterSwell.depth != null ? cfg.filterSwell.depth : filter.frequency.value * 0.3);
      depth.connect(filter.frequency);
    }
    src.start(startAt, cfg.offset || 0);
    sources.push(src);
    return { src, filter, gain, pan };
  }

  // 一个持续音（电网嗡鸣 / 钟体低鸣 / 机械底噪）
  function droneLayer(freq, gainValue, cfg = {}) {
    const osc = ctx.createOscillator();
    osc.type = cfg.type || 'sine';
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    const pan = ctx.createStereoPanner();
    pan.pan.value = cfg.pan || 0;
    let head = osc;
    if (cfg.filterFreq) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cfg.filterFreq;
      filter.Q.value = 0.5;
      osc.connect(filter);
      head = filter;
    }
    head.connect(gain);
    gain.connect(pan);
    pan.connect(out);
    if (cfg.lfoFreq) {
      const depth = lfo(cfg.lfoFreq, gainValue * (cfg.lfoDepth != null ? cfg.lfoDepth : 0.5));
      depth.connect(gain.gain);
    }
    osc.start(startAt);
    sources.push(osc);
    return { osc, gain, pan };
  }

  switch (key) {
    case 'beach': {
      noiseLayer({ type: 'lowpass', freq: 380, q: 0.55, gain: 0.42, offset: 0, swell: { freq: 0.073, depth: 0.45 } });
      noiseLayer({
        type: 'bandpass',
        freq: 1150,
        q: 0.8,
        gain: 0.17,
        offset: 2.3,
        swell: { freq: 0.104, depth: 0.55 },
        filterSwell: { freq: 0.047, depth: 420 },
      });
      noiseLayer({ type: 'highpass', freq: 2600, q: 0.6, gain: 0.035, offset: 4.7, pan: 0.28, swell: { freq: 0.091, depth: 0.5 } });
      noiseLayer({ type: 'lowpass', freq: 118, q: 0.5, gain: 0.22, offset: 5.9, pan: -0.2, swell: { freq: 0.05, depth: 0.3 } });
      break;
    }
    case 'village': {
      noiseLayer({ type: 'lowpass', freq: 360, q: 0.5, gain: 0.2, offset: 0, pan: -0.12, swell: { freq: 0.06, depth: 0.4 } });
      noiseLayer({ type: 'bandpass', freq: 1900, q: 0.55, gain: 0.05, offset: 2.3, pan: 0.24, swell: { freq: 0.15, depth: 0.45 } });
      noiseLayer({ type: 'bandpass', freq: 430, q: 0.9, gain: 0.045, offset: 4.7, pan: -0.2, swell: { freq: 0.043, depth: 0.35 } });
      droneLayer(196, 0.006, { type: 'sine' });
      break;
    }
    case 'city': {
      noiseLayer({ type: 'lowpass', freq: 150, q: 0.6, gain: 0.34, offset: 0, pan: -0.2, swell: { freq: 0.043, depth: 0.3 } });
      noiseLayer({ type: 'bandpass', freq: 520, q: 0.5, gain: 0.1, offset: 2.3, pan: 0.15, swell: { freq: 0.093, depth: 0.5 } });
      noiseLayer({ type: 'bandpass', freq: 1600, q: 0.55, gain: 0.028, offset: 4.7, swell: { freq: 0.13, depth: 0.4 } });
      droneLayer(50, 0.012, { type: 'sine', filterFreq: 180 }); // 中国市电 50Hz 嗡鸣
      droneLayer(100, 0.007, { type: 'sine', filterFreq: 240 });
      break;
    }
    case 'forest': {
      noiseLayer({ type: 'lowpass', freq: 480, q: 0.5, gain: 0.25, offset: 0, swell: { freq: 0.058, depth: 0.35 } });
      noiseLayer({ type: 'bandpass', freq: 2600, q: 0.5, gain: 0.05, offset: 2.3, pan: 0.25, swell: { freq: 0.17, depth: 0.5 } });
      noiseLayer({ type: 'bandpass', freq: 4300, q: 6, gain: 0.03, offset: 4.7, pan: -0.28, swell: { freq: 0.55, depth: 0.7 } });
      break;
    }
    case 'factory': {
      droneLayer(48, 0.03, { type: 'sawtooth', filterFreq: 260, lfoFreq: 0.5, lfoDepth: 0.35 });
      droneLayer(96, 0.012, { type: 'sine', filterFreq: 380 });
      droneLayer(144, 0.005, { type: 'sine' });
      noiseLayer({ type: 'lowpass', freq: 240, q: 0.5, gain: 0.18, offset: 0, swell: { freq: 0.37, depth: 0.3 } });
      noiseLayer({ type: 'highpass', freq: 3500, q: 0.6, gain: 0.02, offset: 4.7, swell: { freq: 0.21, depth: 0.5 } });
      break;
    }
    case 'temple': {
      noiseLayer({ type: 'lowpass', freq: 300, q: 0.6, gain: 0.2, offset: 0, swell: { freq: 0.045, depth: 0.4 } });
      noiseLayer({ type: 'bandpass', freq: 2300, q: 0.7, gain: 0.028, offset: 2.3, pan: 0.2, swell: { freq: 0.08, depth: 0.4 } });
      droneLayer(65.41, 0.02, { type: 'sine', lfoFreq: 0.031, lfoDepth: 0.5 }); // C2 持续音
      droneLayer(98, 0.008, { type: 'sine' }); // G2 五度
      break;
    }
    case 'waterfalls': {
      noiseLayer({ type: 'lowpass', freq: 1600, q: 0.4, gain: 0.3, offset: 0, swell: { freq: 0.11, depth: 0.3 } });
      noiseLayer({ type: 'bandpass', freq: 2800, q: 0.45, gain: 0.14, offset: 2.3, swell: { freq: 0.17, depth: 0.4 } });
      noiseLayer({ type: 'lowpass', freq: 100, q: 0.5, gain: 0.3, offset: 4.7, swell: { freq: 0.07, depth: 0.25 } });
      noiseLayer({ type: 'highpass', freq: 5200, q: 0.6, gain: 0.035, offset: 6.1, pan: -0.3, swell: { freq: 0.23, depth: 0.5 } });
      break;
    }
    case 'base':
    default: {
      noiseLayer({ type: 'lowpass', freq: 420, q: 0.6, gain: 0.34, offset: 0, pan: -0.12, swell: { freq: 0.052, depth: 0.4 } });
      noiseLayer({ type: 'bandpass', freq: 1350, q: 0.5, gain: 0.05, offset: 2.7, pan: 0.2, swell: { freq: 0.083, depth: 0.5 } });
      noiseLayer({ type: 'lowpass', freq: 95, q: 0.5, gain: 0.3, offset: 5.1, swell: { freq: 0.031, depth: 0.3 } });
      break;
    }
  }

  return {
    key,
    out,
    startAt,
    get stopped() {
      return stopped;
    },
    stop(at = ctx.currentTime) {
      if (stopped) return;
      stopped = true;
      for (const src of sources) {
        try {
          src.stop(at);
        } catch {
          /* ignore */
        }
      }
      for (const osc of lfos) {
        try {
          osc.stop(at);
        } catch {
          /* ignore */
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 环境音偶发事件（海鸥 / 钟声 / 喇叭 / 虫鸣……）
// session: { ctx, dest, when, rand, noise }
// ---------------------------------------------------------------------------

function evNoiseSwell(s, cfg = {}) {
  const ctx = s.ctx;
  const t = s.when;
  const attack = cfg.attack != null ? cfg.attack : 0.9;
  const decay = cfg.decay != null ? cfg.decay : 2.4;
  const peak = cfg.gain != null ? cfg.gain : 0.16;
  const src = ctx.createBufferSource();
  src.buffer = s.noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = cfg.type || 'lowpass';
  filter.frequency.setValueAtTime(cfg.freq || 800, t);
  if (cfg.freqEnd) filter.frequency.exponentialRampToValueAtTime(cfg.freqEnd, t + attack + decay);
  filter.Q.value = cfg.q != null ? cfg.q : 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  const pan = ctx.createStereoPanner();
  pan.pan.value = cfg.pan || 0;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(pan);
  pan.connect(s.dest);
  src.start(t, (cfg.offset || 0) % Math.max(0.1, s.noise.duration - 0.1));
  src.stop(t + attack + decay + 0.08);
}

function evGull(s) {
  const ctx = s.ctx;
  const t0 = s.when;
  const pan = ctx.createStereoPanner();
  pan.pan.value = s.rand() * 1.4 - 0.7;
  pan.connect(s.dest);
  const calls = 1 + Math.floor(s.rand() * 2);
  for (let n = 0; n < calls; n += 1) {
    const t = t0 + n * (0.3 + s.rand() * 0.14);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(820 + s.rand() * 180, t);
    osc.frequency.exponentialRampToValueAtTime(1420, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.34);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    filter.Q.value = 2.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    osc.start(t);
    osc.stop(t + 0.4);
  }
}

function evBird(s) {
  const ctx = s.ctx;
  const t0 = s.when;
  const pan = ctx.createStereoPanner();
  pan.pan.value = s.rand() * 1.6 - 0.8;
  pan.connect(s.dest);
  const count = 2 + Math.floor(s.rand() * 3);
  for (let n = 0; n < count; n += 1) {
    const t = t0 + n * (0.07 + s.rand() * 0.07);
    const base = 2600 + s.rand() * 1600;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.03);
    osc.frequency.exponentialRampToValueAtTime(base * 0.85, t + 0.09);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.03, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(gain);
    gain.connect(pan);
    osc.start(t);
    osc.stop(t + 0.12);
  }
}

function evChime(s) {
  const ctx = s.ctx;
  const t0 = s.when;
  const freqs = [880, 1046.5, 1318.5, 1568, 1760];
  const noteCount = 2 + Math.floor(s.rand() * 3);
  for (let n = 0; n < noteCount; n += 1) {
    const freq = freqs[Math.floor(s.rand() * freqs.length)];
    const t = t0 + n * (0.12 + s.rand() * 0.15);
    const pan = s.rand() * 1.4 - 0.7;
    const partials = [1, 2.76, 5.4];
    partials.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * ratio * (1 + (s.rand() - 0.5) * 0.003);
      const gain = ctx.createGain();
      const peak = 0.022 / (1 + i * 1.6);
      const decay = 1.5 / (1 + i * 0.8);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(s.dest);
      osc.start(t);
      osc.stop(t + decay + 0.05);
    });
  }
}

function evDistantChatter(s) {
  const ctx = s.ctx;
  const t = s.when;
  const dur = 1.6 + s.rand() * 1.2;
  const src = ctx.createBufferSource();
  src.buffer = s.noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 380 + s.rand() * 260;
  filter.Q.value = 1.4;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.016, t + 0.3);
  gain.gain.setValueAtTime(0.016, t + dur - 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  // 4Hz 左右的"说话"振幅起伏
  const am = ctx.createOscillator();
  am.frequency.value = 3.4 + s.rand() * 1.8;
  const amDepth = ctx.createGain();
  amDepth.gain.value = 0.008;
  am.connect(amDepth);
  amDepth.connect(gain.gain);
  const pan = ctx.createStereoPanner();
  pan.pan.value = s.rand() * 1.4 - 0.7;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(pan);
  pan.connect(s.dest);
  am.start(t);
  am.stop(t + dur + 0.05);
  src.start(t, s.rand() * 5);
  src.stop(t + dur + 0.05);
}

function evCarPass(s) {
  const ctx = s.ctx;
  const t = s.when;
  const dur = 2.4 + s.rand() * 1.8;
  const src = ctx.createBufferSource();
  src.buffer = s.noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(320, t);
  filter.frequency.linearRampToValueAtTime(760, t + dur * 0.5);
  filter.frequency.linearRampToValueAtTime(300, t + dur);
  filter.Q.value = 0.9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.09, t + dur * 0.42);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const pan = ctx.createStereoPanner();
  const dir = s.rand() > 0.5 ? 1 : -1;
  pan.pan.setValueAtTime(-0.75 * dir, t);
  pan.pan.linearRampToValueAtTime(0.75 * dir, t + dur);
  // 低频胎噪
  const lowSrc = ctx.createBufferSource();
  lowSrc.buffer = s.noise;
  lowSrc.loop = true;
  const lowFilter = ctx.createBiquadFilter();
  lowFilter.type = 'lowpass';
  lowFilter.frequency.value = 110;
  const lowGain = ctx.createGain();
  lowGain.gain.setValueAtTime(0.0001, t);
  lowGain.gain.linearRampToValueAtTime(0.09, t + dur * 0.45);
  lowGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(pan);
  pan.connect(s.dest);
  lowSrc.connect(lowFilter);
  lowFilter.connect(lowGain);
  lowGain.connect(s.dest);
  src.start(t, s.rand() * 5);
  src.stop(t + dur + 0.05);
  lowSrc.start(t, s.rand() * 5);
  lowSrc.stop(t + dur + 0.05);
}

function evHorn(s) {
  const ctx = s.ctx;
  const t = s.when;
  const dur = 0.28 + s.rand() * 0.3;
  const freq = 300 + s.rand() * 140;
  const pan = ctx.createStereoPanner();
  pan.pan.value = s.rand() * 1.4 - 0.7;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  filter.Q.value = 0.6;
  filter.connect(pan);
  pan.connect(s.dest);
  [1, 1.25].forEach((ratio) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq * ratio;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.028, t + 0.02);
    gain.gain.setValueAtTime(0.028, t + dur - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(filter);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  });
}

function evBikeBell(s) {
  const ctx = s.ctx;
  const t0 = s.when;
  const pan = ctx.createStereoPanner();
  pan.pan.value = s.rand() * 1.2 - 0.6;
  pan.connect(s.dest);
  for (let n = 0; n < 2; n += 1) {
    const t = t0 + n * 0.16;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 2650;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 3970;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.018, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    const gain2 = ctx.createGain();
    gain2.gain.value = 0.35;
    osc.connect(gain);
    osc2.connect(gain2);
    gain2.connect(gain);
    gain.connect(pan);
    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.34);
    osc2.stop(t + 0.34);
  }
}

function evCricket(s) {
  const ctx = s.ctx;
  const t0 = s.when;
  const freq = 4000 + s.rand() * 700;
  const pan = ctx.createStereoPanner();
  pan.pan.value = s.rand() * 1.6 - 0.8;
  pan.connect(s.dest);
  const groups = 2 + Math.floor(s.rand() * 3);
  for (let g = 0; g < groups; g += 1) {
    const groupT = t0 + g * (0.22 + s.rand() * 0.16);
    for (let p = 0; p < 3; p += 1) {
      const t = groupT + p * 0.032;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.012, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.026);
      osc.connect(gain);
      gain.connect(pan);
      osc.start(t);
      osc.stop(t + 0.04);
    }
  }
}

function evTempleBell(s) {
  const ctx = s.ctx;
  const t = s.when;
  const base = s.rand() > 0.5 ? 130.8 : 196; // C3 / G3
  const pan = ctx.createStereoPanner();
  pan.pan.value = s.rand() * 0.6 - 0.3;
  pan.connect(s.dest);
  // 钟体非谐分音
  const partials = [
    [1, 0.09, 5.2],
    [2.0, 0.045, 4.2],
    [2.42, 0.03, 3.4],
    [3.0, 0.02, 2.8],
    [4.2, 0.012, 2.1],
    [5.33, 0.008, 1.6],
  ];
  for (const [ratio, peak, decay] of partials) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = base * ratio;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(gain);
    gain.connect(pan);
    osc.start(t);
    osc.stop(t + decay + 0.1);
  }
  // 撞钟的木质/金属噪声
  const strike = ctx.createBufferSource();
  strike.buffer = s.noise;
  const strikeFilter = ctx.createBiquadFilter();
  strikeFilter.type = 'bandpass';
  strikeFilter.frequency.value = 900;
  strikeFilter.Q.value = 0.8;
  const strikeGain = ctx.createGain();
  strikeGain.gain.setValueAtTime(0.0001, t);
  strikeGain.gain.linearRampToValueAtTime(0.05, t + 0.006);
  strikeGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  strike.connect(strikeFilter);
  strikeFilter.connect(strikeGain);
  strikeGain.connect(pan);
  strike.start(t, s.rand() * 5);
  strike.stop(t + 0.35);
}

function evBowl(s) {
  const ctx = s.ctx;
  const t = s.when;
  const base = 880 + s.rand() * 180;
  const pan = ctx.createStereoPanner();
  pan.pan.value = s.rand() * 1.2 - 0.6;
  pan.connect(s.dest);
  [1, 2.76, 5.4].forEach((ratio, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = base * ratio;
    const gain = ctx.createGain();
    const peak = 0.03 / (1 + i * 1.8);
    const decay = 2.2 / (1 + i * 0.7);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(gain);
    gain.connect(pan);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  });
}

function evClank(s) {
  const ctx = s.ctx;
  const t0 = s.when;
  const count = 1 + Math.floor(s.rand() * 3);
  for (let n = 0; n < count; n += 1) {
    const t = t0 + n * (0.09 + s.rand() * 0.16);
    const base = 180 + s.rand() * 260;
    const pan = ctx.createStereoPanner();
    pan.pan.value = s.rand() * 1.4 - 0.7;
    pan.connect(s.dest);
    [1, 2.37, 3.71, 5.13].forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      const gain = ctx.createGain();
      const peak = 0.028 / (1 + i);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34 / (1 + i * 0.5));
      osc.connect(gain);
      gain.connect(pan);
      osc.start(t);
      osc.stop(t + 0.5);
    });
    const hit = ctx.createBufferSource();
    hit.buffer = s.noise;
    const hitFilter = ctx.createBiquadFilter();
    hitFilter.type = 'highpass';
    hitFilter.frequency.value = 2200;
    const hitGain = ctx.createGain();
    hitGain.gain.setValueAtTime(0.0001, t);
    hitGain.gain.linearRampToValueAtTime(0.04, t + 0.002);
    hitGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    hit.connect(hitFilter);
    hitFilter.connect(hitGain);
    hitGain.connect(pan);
    hit.start(t, s.rand() * 5);
    hit.stop(t + 0.1);
  }
}

function evSteam(s) {
  const ctx = s.ctx;
  const t = s.when;
  const dur = 0.9 + s.rand() * 1.4;
  const src = ctx.createBufferSource();
  src.buffer = s.noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3200;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.05, t + 0.18);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const pan = ctx.createStereoPanner();
  pan.pan.value = s.rand() * 1.2 - 0.6;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(pan);
  pan.connect(s.dest);
  src.start(t, s.rand() * 5);
  src.stop(t + dur + 0.05);
}

function evGust(s) {
  evNoiseSwell(s, {
    type: 'lowpass',
    freq: 300,
    freqEnd: 900,
    attack: 0.9 + s.rand() * 0.9,
    decay: 1.6 + s.rand() * 1.2,
    gain: 0.11,
    pan: s.rand() * 1.2 - 0.6,
  });
}

function evSplash(s) {
  evNoiseSwell(s, {
    type: 'bandpass',
    freq: 1500,
    freqEnd: 700,
    q: 0.8,
    attack: 0.05,
    decay: 0.5 + s.rand() * 0.5,
    gain: 0.1,
    pan: s.rand() * 1.4 - 0.7,
  });
}

function evDrip(s) {
  const ctx = s.ctx;
  const t0 = s.when;
  const count = 1 + Math.floor(s.rand() * 3);
  for (let n = 0; n < count; n += 1) {
    const t = t0 + n * (0.12 + s.rand() * 0.2);
    const base = 900 + s.rand() * 900;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.9, t + 0.035);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.02, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    const pan = ctx.createStereoPanner();
    pan.pan.value = s.rand() * 1.4 - 0.7;
    osc.connect(gain);
    gain.connect(pan);
    pan.connect(s.dest);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}

function evFoam(s) {
  evNoiseSwell(s, {
    type: 'bandpass',
    freq: 900,
    freqEnd: 1600,
    q: 0.6,
    attack: 1.1,
    decay: 2.2,
    gain: 0.12,
    pan: s.rand() * 1.2 - 0.6,
  });
}

/** 每个区域的偶发事件：{ name, min, max, fire }，min/max 是秒。 */
const AMBIENT_EVENTS = {
  base: [
    { name: '阵风', min: 9, max: 18, fire: evGust },
    { name: '远处鸟鸣', min: 18, max: 34, fire: evBird },
  ],
  beach: [
    { name: '海浪拍岸', min: 5, max: 10, fire: evFoam },
    { name: '海鸥', min: 7, max: 14, fire: evGull },
  ],
  village: [
    { name: '鸟鸣', min: 3, max: 7, fire: evBird },
    { name: '风铃', min: 8, max: 18, fire: evChime },
    { name: '远处人声', min: 16, max: 30, fire: evDistantChatter },
  ],
  city: [
    { name: '汽车驶过', min: 4, max: 9, fire: evCarPass },
    { name: '喇叭', min: 11, max: 24, fire: evHorn },
    { name: '自行车铃', min: 18, max: 34, fire: evBikeBell },
    { name: '远处人声', min: 20, max: 38, fire: evDistantChatter },
  ],
  forest: [
    { name: '蟋蟀', min: 1.2, max: 2.6, fire: evCricket },
    { name: '鸟鸣', min: 3, max: 7, fire: evBird },
    { name: '阵风', min: 9, max: 17, fire: evGust },
  ],
  factory: [
    { name: '金属撞击', min: 2.5, max: 6, fire: evClank },
    { name: '蒸汽泄压', min: 7, max: 15, fire: evSteam },
    { name: '机械阵响', min: 4, max: 9, fire: evClank },
  ],
  temple: [
    { name: '钟声', min: 13, max: 26, fire: evTempleBell },
    { name: '磬声', min: 6, max: 12, fire: evBowl },
    { name: '山风阵', min: 9, max: 16, fire: evGust },
  ],
  waterfalls: [
    { name: '水花飞溅', min: 2.2, max: 5, fire: evSplash },
    { name: '水滴', min: 2, max: 5.5, fire: evDrip },
    { name: '水雾涌动', min: 5, max: 10, fire: evFoam },
  ],
};

export const AMBIENT_EVENT_NAMES = Object.fromEntries(
  Object.entries(AMBIENT_EVENTS).map(([key, list]) => [key, list.map((ev) => ev.name)]),
);

// ---------------------------------------------------------------------------
// 音效合成器
// session = { ctx: BaseAudioContext, dest: AudioNode, now: 起始时间, rand: ()=>0..1, noise: AudioBuffer }
// ---------------------------------------------------------------------------

function sfxTone(s, cfg = {}) {
  const ctx = s.ctx;
  const t = s.now + (cfg.start || 0);
  const attack = cfg.attack != null ? cfg.attack : 0.006;
  const decay = cfg.decay != null ? cfg.decay : 0.15;
  const peak = Math.max(0.0001, cfg.gain != null ? cfg.gain : 0.08);
  const osc = ctx.createOscillator();
  osc.type = cfg.type || 'sine';
  osc.frequency.setValueAtTime(Math.max(20, cfg.freq || 440), t);
  if (cfg.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, cfg.freqEnd), t + attack + decay);
  if (cfg.detune) osc.detune.value = cfg.detune;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  if (cfg.hold) gain.gain.setValueAtTime(peak, t + attack + cfg.hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + (cfg.hold || 0) + decay);
  const pan = ctx.createStereoPanner();
  pan.pan.value = cfg.pan || 0;
  let head = osc;
  if (cfg.filter) {
    const filter = ctx.createBiquadFilter();
    filter.type = cfg.filter;
    filter.frequency.value = cfg.filterFreq || 2000;
    filter.Q.value = cfg.filterQ || 0.8;
    osc.connect(filter);
    head = filter;
  }
  head.connect(gain);
  gain.connect(pan);
  pan.connect(s.dest);
  osc.start(t);
  osc.stop(t + attack + (cfg.hold || 0) + decay + 0.05);
  return osc;
}

function sfxNoise(s, cfg = {}) {
  const ctx = s.ctx;
  const t = s.now + (cfg.start || 0);
  const attack = cfg.attack != null ? cfg.attack : 0.002;
  const decay = cfg.decay != null ? cfg.decay : 0.08;
  const peak = Math.max(0.0001, cfg.gain != null ? cfg.gain : 0.08);
  const src = ctx.createBufferSource();
  src.buffer = s.noise;
  src.loop = true;
  src.playbackRate.value = cfg.rate || 1;
  const filter = ctx.createBiquadFilter();
  filter.type = cfg.type || 'bandpass';
  filter.frequency.setValueAtTime(Math.max(20, cfg.freq || 1800), t);
  if (cfg.freqEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(20, cfg.freqEnd), t + attack + decay);
  filter.Q.value = cfg.q != null ? cfg.q : 1;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  const pan = ctx.createStereoPanner();
  pan.pan.value = cfg.pan || 0;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(pan);
  pan.connect(s.dest);
  const maxOffset = Math.max(0.1, s.noise.duration - 0.2);
  src.start(t, (cfg.offset != null ? cfg.offset : (s.rand ? s.rand() * 5 : 0)) % maxOffset);
  src.stop(t + attack + decay + 0.06);
}

/** 钟/磬/风铃：非谐分音 + 长衰减。 */
function sfxChime(s, freq, cfg = {}) {
  const gain = cfg.gain != null ? cfg.gain : 0.05;
  const decay = cfg.decay != null ? cfg.decay : 1.2;
  const pan = cfg.pan || 0;
  const start = cfg.start || 0;
  const partials = [1, 2.0, 2.76, 5.4, 8.93];
  partials.forEach((ratio, i) => {
    sfxTone(s, {
      type: 'sine',
      freq: freq * ratio * (1 + (s.rand() - 0.5) * 0.004),
      gain: gain / (1 + i * 1.5),
      decay: decay / (1 + i * 0.8),
      attack: 0.004,
      pan: pan + (i - 2) * 0.05,
      start,
    });
  });
}

/** 拨弦（三角波 + 二次谐波），用于任务/换装/提示音。 */
function sfxPluck(s, cfg = {}) {
  const freq = cfg.freq || 440;
  const gain = cfg.gain != null ? cfg.gain : 0.07;
  const decay = cfg.decay != null ? cfg.decay : 0.35;
  const pan = cfg.pan || 0;
  const start = cfg.start || 0;
  sfxTone(s, { type: 'triangle', freq, gain, decay, attack: 0.004, pan, start });
  sfxTone(s, { type: 'sine', freq: freq * 2, gain: gain * 0.22, decay: decay * 0.55, attack: 0.004, pan, start });
}

/** 纸声：两层带通噪声，像翻信纸。 */
function sfxPaper(s, cfg = {}) {
  const gain = cfg.gain != null ? cfg.gain : 0.05;
  const pan = cfg.pan || 0;
  const start = cfg.start || 0;
  sfxNoise(s, { type: 'bandpass', freq: 2300, q: 0.7, attack: 0.014, decay: 0.13, gain, pan, start });
  sfxNoise(s, { type: 'bandpass', freq: 3400, q: 0.9, attack: 0.01, decay: 0.17, gain: gain * 0.7, pan: pan + 0.1, start: start + 0.055 });
}

/** 木质敲击（木鱼/按钮）。 */
function sfxWood(s, cfg = {}) {
  const freq = cfg.freq || 660;
  const gain = cfg.gain != null ? cfg.gain : 0.08;
  const decay = cfg.decay != null ? cfg.decay : 0.07;
  const pan = cfg.pan || 0;
  const start = cfg.start || 0;
  sfxTone(s, { type: 'sine', freq, gain, decay, attack: 0.002, pan, start });
  sfxTone(s, { type: 'sine', freq: freq * 2.6, gain: gain * 0.32, decay: decay * 0.6, attack: 0.002, pan, start });
  sfxNoise(s, { type: 'highpass', freq: 2400, attack: 0.001, decay: 0.03, gain: gain * 0.35, pan, start });
}

/** 声像扫过的 whoosh（翻页 / 相机 / 缩放）。 */
function sfxWhoosh(s, cfg = {}) {
  const ctx = s.ctx;
  const t = s.now + (cfg.start || 0);
  const dur = cfg.duration != null ? cfg.duration : 0.3;
  const peak = cfg.gain != null ? cfg.gain : 0.06;
  const src = ctx.createBufferSource();
  src.buffer = s.noise;
  src.loop = true;
  src.playbackRate.value = cfg.rate || 1;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(cfg.from || 500, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(60, cfg.to || 2600), t + dur);
  filter.Q.value = cfg.q != null ? cfg.q : 0.8;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + dur * 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const pan = ctx.createStereoPanner();
  pan.pan.setValueAtTime(cfg.panStart != null ? cfg.panStart : -0.4, t);
  pan.pan.linearRampToValueAtTime(cfg.panEnd != null ? cfg.panEnd : 0.4, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(pan);
  pan.connect(s.dest);
  src.start(t, (s.rand ? s.rand() * 5 : 0) % Math.max(0.1, s.noise.duration - 0.2));
  src.stop(t + dur + 0.06);
}

// ---- cue 合成表 -----------------------------------------------------------

const cueClick = (s) => {
  sfxNoise(s, { type: 'bandpass', freq: 3000, q: 1.3, attack: 0.001, decay: 0.032, gain: 0.085 });
  sfxTone(s, { freq: 1720, freqEnd: 1180, attack: 0.001, decay: 0.04, gain: 0.04 });
};

const cueHover = (s) => {
  sfxTone(s, { freq: 2300, freqEnd: 2520, attack: 0.012, decay: 0.05, gain: 0.026, pan: -0.08 });
};

const cueButtons = (s) => {
  sfxWood(s, { freq: 640, gain: 0.09, decay: 0.08, pan: 0.05 });
  sfxTone(s, { freq: 1320, decay: 0.06, gain: 0.02, start: 0.01 });
};

const cueOpen = (s) => {
  sfxNoise(s, { type: 'bandpass', freq: 900, freqEnd: 2100, q: 0.8, attack: 0.008, decay: 0.16, gain: 0.05 });
  sfxTone(s, { freq: 300, freqEnd: 480, attack: 0.01, decay: 0.2, gain: 0.035 });
  sfxPaper(s, { gain: 0.035, start: 0.03 });
};

const cueChecklist = (s) => {
  sfxPaper(s, { gain: 0.05 });
  sfxChime(s, 1046.5, { gain: 0.025, decay: 0.6, pan: 0.1, start: 0.09 });
  sfxPaper(s, { gain: 0.03, start: 0.2, pan: 0.2 });
};

const cueQuest = (s) => {
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  notes.forEach((freq, i) => {
    sfxPluck(s, { freq, gain: 0.075, decay: 0.38, pan: -0.15 + i * 0.08, start: i * 0.075 });
    sfxChime(s, freq, { gain: 0.018, decay: 0.7, pan: -0.15 + i * 0.08, start: i * 0.075 + 0.01 });
  });
  sfxNoise(s, { type: 'highpass', freq: 5200, attack: 0.03, decay: 0.5, gain: 0.02, start: 0.3 });
};

const cueQuestStart = (s) => {
  sfxPluck(s, { freq: 392, gain: 0.085, decay: 0.5 });
  sfxPluck(s, { freq: 523.25, gain: 0.075, decay: 0.7, start: 0.13 });
  sfxTone(s, { freq: 196, attack: 0.05, decay: 0.5, gain: 0.025 });
};

const cueTitle = (s) => {
  sfxChime(s, 130.81, { gain: 0.06, decay: 2.6, pan: -0.05 });
  sfxChime(s, 196, { gain: 0.035, decay: 2.0, pan: 0.15, start: 0.18 });
  sfxTone(s, { freq: 65.41, attack: 0.08, decay: 1.6, gain: 0.06 });
  sfxNoise(s, { type: 'bandpass', freq: 1400, q: 0.6, attack: 0.02, decay: 0.6, gain: 0.02 });
};

const cueClothes = (s) => {
  sfxNoise(s, { type: 'bandpass', freq: 1500, q: 0.6, attack: 0.02, decay: 0.22, gain: 0.055 });
  sfxNoise(s, { type: 'bandpass', freq: 3000, q: 0.8, attack: 0.012, decay: 0.18, gain: 0.038, start: 0.12 });
  sfxPluck(s, { freq: 392, gain: 0.045, decay: 0.35, start: 0.2 });
};

const cueCustomize = (s) => {
  sfxTone(s, { type: 'sine', freq: 660, decay: 0.16, gain: 0.05, pan: -0.1 });
  sfxTone(s, { type: 'sine', freq: 990, decay: 0.2, gain: 0.035, pan: 0.15, start: 0.08 });
};

const cueBubbleStart = (s) => {
  sfxTone(s, { freq: 520, freqEnd: 880, attack: 0.008, decay: 0.08, gain: 0.04, pan: -0.12 });
};

const cueBubbleEnd = (s) => {
  sfxTone(s, { freq: 880, freqEnd: 520, attack: 0.006, decay: 0.08, gain: 0.04, pan: 0.12 });
};

const cueEmoteStart = (s) => {
  [523.25, 659.25, 880].forEach((freq, i) => {
    sfxChime(s, freq, { gain: 0.022, decay: 0.5, pan: -0.2 + i * 0.2, start: i * 0.055 });
  });
};

const cueEmoteEnd = (s) => {
  [880, 659.25, 523.25].forEach((freq, i) => {
    sfxChime(s, freq, { gain: 0.022, decay: 0.5, pan: 0.2 - i * 0.2, start: i * 0.055 });
  });
};

const cueEmoji = (s) => {
  sfxTone(s, { freq: 260, freqEnd: 1050, attack: 0.004, decay: 0.09, gain: 0.065 });
  sfxNoise(s, { type: 'highpass', freq: 3200, attack: 0.001, decay: 0.04, gain: 0.03 });
  sfxChime(s, 1568, { gain: 0.016, decay: 0.3, pan: 0.2, start: 0.04 });
};

const cueLetter = (s) => {
  sfxNoise(s, { type: 'highpass', freq: 3000, attack: 0.12, decay: 0.55, gain: 0.018, pan: -0.2 });
  [880, 1046.5, 1318.5].forEach((freq, i) => {
    sfxChime(s, freq, { gain: 0.042, decay: 1.7, pan: -0.25 + i * 0.24, start: 0.05 + i * 0.13 });
  });
  sfxTone(s, { freq: 440, attack: 0.02, decay: 0.9, gain: 0.02 });
};

const cueTurn = (s) => {
  sfxNoise(s, { type: 'bandpass', freq: 1200, freqEnd: 2800, q: 0.7, attack: 0.02, decay: 0.2, gain: 0.055 });
  sfxPaper(s, { gain: 0.028, start: 0.055, pan: -0.15 });
};

const cueOut = (s) => {
  sfxWhoosh(s, { from: 1800, to: 320, duration: 0.38, gain: 0.055, panStart: 0.3, panEnd: -0.35 });
  sfxTone(s, { freq: 110, freqEnd: 60, attack: 0.01, decay: 0.22, gain: 0.05 });
};

const cueWhoosh = (s) => {
  sfxWhoosh(s, { from: 420, to: 2600, duration: 0.32, gain: 0.055, panStart: -0.55, panEnd: 0.5 });
  sfxWhoosh(s, { from: 2400, to: 620, duration: 0.4, gain: 0.035, panStart: 0.2, panEnd: -0.2, start: 0.18 });
};

const cueZoomIn = (s) => {
  sfxTone(s, { freq: 180, freqEnd: 720, attack: 0.03, decay: 0.3, gain: 0.045 });
  sfxWhoosh(s, { from: 300, to: 3000, duration: 0.4, gain: 0.035, panStart: 0, panEnd: 0.2 });
  sfxChime(s, 1568, { gain: 0.014, decay: 0.5, start: 0.28 });
};

const cueZoomOut = (s) => {
  sfxTone(s, { freq: 720, freqEnd: 180, attack: 0.01, decay: 0.32, gain: 0.045 });
  sfxWhoosh(s, { from: 2800, to: 380, duration: 0.4, gain: 0.035, panStart: 0.2, panEnd: 0 });
};

const cueNote = (s) => {
  sfxPluck(s, { freq: 880, gain: 0.06, decay: 0.5 });
  sfxPluck(s, { freq: 1318.5, gain: 0.025, decay: 0.35, start: 0.05 });
};

const cueError = (s) => {
  sfxTone(s, { type: 'sine', freq: 220, attack: 0.01, decay: 0.13, gain: 0.055, filter: 'lowpass', filterFreq: 900 });
  sfxTone(s, { type: 'sine', freq: 164.81, attack: 0.01, decay: 0.18, gain: 0.045, start: 0.11, filter: 'lowpass', filterFreq: 900 });
};

const cueToggle = (s) => {
  sfxWood(s, { freq: 880, gain: 0.045, decay: 0.05 });
};

const cueFallback = (s) => {
  sfxTone(s, { freq: 660, freqEnd: 990, attack: 0.012, decay: 0.16, gain: 0.03 });
  sfxTone(s, { freq: 990, attack: 0.01, decay: 0.22, gain: 0.02, start: 0.1 });
};

/** cue 名 -> 合成函数（函数的参数是 session，见文件头说明）。 */
export const CUES = {
  click: cueClick,
  hover: cueHover,
  buttons: cueButtons,
  open: cueOpen,
  checklist: cueChecklist,
  paper: cuePaper2,
  quest: cueQuest,
  questStart: cueQuestStart,
  title: cueTitle,
  clothes: cueClothes,
  customize: cueCustomize,
  bubbleStart: cueBubbleStart,
  bubbleEnd: cueBubbleEnd,
  emoteStart: cueEmoteStart,
  emoteEnd: cueEmoteEnd,
  emoji: cueEmoji,
  letter: cueLetter,
  turn: cueTurn,
  out: cueOut,
  whoosh: cueWhoosh,
  zoomIn: cueZoomIn,
  zoomOut: cueZoomOut,
  note: cueNote,
  error: cueError,
  toggle: cueToggle,
};

// paper 的独立别名（CUES.paper 指向它，保持 cue 表可读）
function cuePaper2(s) {
  sfxPaper(s, { gain: 0.06 });
}

// ---------------------------------------------------------------------------
// 离线/实时通用：构造一个音效 session
// ---------------------------------------------------------------------------

export function makeSfxSession(ctx, dest, opts = {}) {
  const volume = opts.volume == null ? 1 : Math.max(0, Number(opts.volume) || 0);
  let out = dest;
  if (volume !== 1) {
    out = ctx.createGain();
    out.gain.value = volume;
    out.connect(dest);
  }
  return {
    ctx,
    dest: out,
    now: (opts.now != null ? opts.now : ctx.currentTime) + 0.005,
    rand: opts.rand || Math.random,
    noise: opts.noise || getNoiseBuffer(ctx),
  };
}

// ---------------------------------------------------------------------------
// 无 AudioContext 时的静默降级实现（Node 冒烟测试 / 极老浏览器）
// ---------------------------------------------------------------------------

function createSilentAudio(storagePrefix) {
  const noop = () => {};
  const persistedMuted = (() => {
    try {
      return localStorage.getItem(storagePrefix + LS_MUTED) === '1';
    } catch {
      return false;
    }
  })();
  const volumes = {
    master: 1,
    music: readNumber(storagePrefix + LS_MUSIC, DEFAULT_VOLUMES.music),
    ambience: readNumber(storagePrefix + LS_AMBIENCE, DEFAULT_VOLUMES.ambience),
    sfx: readNumber(storagePrefix + LS_SFX, DEFAULT_VOLUMES.sfx),
  };
  let silentMuted = persistedMuted;
  const silent = {
    unlock: noop,
    preload: () => Promise.resolve(),
    setRegion: noop,
    playFootstep: noop,
    playFootstepWater: noop,
    playJump: noop,
    playLand: noop,
    playCue: noop,
    playFile: noop,
    setMuted(muted) {
      silentMuted = !!muted;
      try {
        localStorage.setItem(storagePrefix + LS_MUTED, silentMuted ? '1' : '0');
      } catch {
        /* ignore */
      }
      return silentMuted;
    },
    toggleMute() {
      return silent.setMuted(!silentMuted);
    },
    isMuted: () => silentMuted,
    setBusVolume(bus, value) {
      const v = clamp01(value);
      if (bus === 'music' || bus === 'ambience' || bus === 'sfx' || bus === 'master') {
        volumes[bus] = v;
        writeNumber(storagePrefix + (bus === 'music' ? LS_MUSIC : bus === 'ambience' ? LS_AMBIENCE : bus === 'sfx' ? LS_SFX : 'bjcourier.audio.master'), v);
      }
    },
    getBusVolume(bus) {
      return volumes[bus] != null ? volumes[bus] : volumes.master;
    },
    update: noop,
    createAnalyser: () => null,
    dispose: noop,
    ctx: null,
    diagnostics: () => ({ contextState: 'unavailable', unlocked: false, muted: silentMuted, region: null, musicPlaying: false, musicMode: null }),
    get ready() {
      return false;
    },
    get unlocked() {
      return false;
    },
    get region() {
      return null;
    },
    get muted() {
      return silentMuted;
    },
    get musicPlaying() {
      return false;
    },
    get musicBuffer() {
      return null;
    },
    get musicMeta() {
      return null;
    },
    get musicMode() {
      return null;
    },
  };
  return silent;
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

export function createAudio(assets, options = {}) {
  const storagePrefix = options.storagePrefix || '';

  // 与旧版一致：优先复用 assets.audioContext()（Lead 的 createAssets 提供），否则自建。
  const ctx = (() => {
    try {
      if (assets && typeof assets.audioContext === 'function') {
        const shared = assets.audioContext();
        if (shared) return shared;
      }
    } catch {
      /* fall through */
    }
    try {
      if (typeof window !== 'undefined') {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (Ctor) return new Ctor();
      }
    } catch {
      /* fall through */
    }
    return null;
  })();

  if (!ctx) return createSilentAudio(storagePrefix);

  // ---- 状态 ---------------------------------------------------------------
  const state = {
    disposed: false,
    unlocked: false,
    muted: false,
    ready: false,
    region: null,
    pendingRegion: null,
    contextRunning: false,
    musicStarted: false,
    musicPlaying: false,
    musicMode: null,
    musicBuffer: null,
    musicMeta: null,
    musicPromise: null,
    musicError: null,
    music: null,
    vinyl: null,
    ambience: null,
    lastTickAt: 0,
    lastFootAt: 0,
    nextCrackleAt: 0,
  };

  // ---- 总线 ---------------------------------------------------------------
  const master = ctx.createGain();
  const musicBus = ctx.createGain();
  const ambienceBus = ctx.createGain();
  const sfxBus = ctx.createGain();
  musicBus.connect(master);
  ambienceBus.connect(master);
  sfxBus.connect(master);
  master.connect(ctx.destination);

  const volumes = {
    master: 1,
    music: readNumber(storagePrefix + LS_MUSIC, DEFAULT_VOLUMES.music),
    ambience: readNumber(storagePrefix + LS_AMBIENCE, DEFAULT_VOLUMES.ambience),
    sfx: readNumber(storagePrefix + LS_SFX, DEFAULT_VOLUMES.sfx),
  };
  musicBus.gain.value = volumes.music;
  ambienceBus.gain.value = volumes.ambience;
  sfxBus.gain.value = volumes.sfx;

  // ---- 静音（持久化） ------------------------------------------------------
  function readMuted() {
    try {
      return localStorage.getItem(storagePrefix + LS_MUTED) === '1';
    } catch {
      return false;
    }
  }
  state.muted = readMuted();
  master.gain.value = state.muted ? 0 : volumes.master;

  // ---- 小工具 --------------------------------------------------------------
  function rampTo(param, to, seconds) {
    const t = ctx.currentTime;
    try {
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
      param.linearRampToValueAtTime(to, t + Math.max(0.01, seconds));
    } catch {
      try {
        param.value = to;
      } catch {
        /* ignore */
      }
    }
  }

  function normalizeRegion(name) {
    if (name == null) return null;
    const raw = String(name).trim().toLowerCase();
    if (!raw) return null;
    const key = REGION_ALIASES[raw] || raw;
    return AMBIENCE_KEYS.includes(key) ? key : DEFAULT_REGION;
  }

  function session(volume) {
    return makeSfxSession(ctx, sfxBus, { volume: volume == null ? 1 : volume });
  }

  // ---- 环境音 --------------------------------------------------------------
  let eventQueue = [];

  function buildEventQueue(key) {
    const now = ctx.currentTime;
    return (AMBIENT_EVENTS[key] || []).map((ev) => ({
      name: ev.name,
      fire: ev.fire,
      min: ev.min,
      max: ev.max,
      nextAt: now + ev.min * 0.5 + Math.random() * (ev.max - ev.min) * 0.5,
    }));
  }

  function stopAmbienceNode(node) {
    if (!node) return;
    rampTo(node.gain.gain, 0, 1.4);
    const at = ctx.currentTime + 1.6;
    try {
      node.handle.stop(at);
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      try {
        node.gain.disconnect();
      } catch {
        /* ignore */
      }
    }, 1800);
  }

  function switchAmbience(name) {
    const key = normalizeRegion(name);
    if (!key) return;
    state.region = key;
    if (state.disposed) return;
    if (!state.unlocked) {
      state.pendingRegion = key;
      return;
    }
    if (state.ambience && state.ambience.key === key) return;

    const previous = state.ambience;
    state.ambience = null;
    if (previous) stopAmbienceNode(previous);

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ambienceBus);
    let handle;
    try {
      handle = buildAmbience(ctx, key, gain, { startAt: ctx.currentTime + 0.03, noise: getNoiseBuffer(ctx) });
    } catch {
      // 环境音合成失败不能拖垮游戏
      try {
        gain.disconnect();
      } catch {
        /* ignore */
      }
      return;
    }
    state.ambience = { key, gain, handle };
    rampTo(gain.gain, 1, 1.8);
    eventQueue = buildEventQueue(key);
  }

  // ---- 程序化黑胶底噪（不放进 BGM loop，长听不会重复） ----------------------
  function startVinylBed() {
    if (state.vinyl || state.disposed) return;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    src.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2600;
    lowpass.Q.value = 0.5;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 170;
    const gain = ctx.createGain();
    gain.gain.value = 0.011;
    src.connect(lowpass);
    lowpass.connect(highpass);
    highpass.connect(gain);
    gain.connect(musicBus);
    // 极慢的底噪呼吸，避免死板
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.061;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.0026;
    lfo.connect(lfoDepth);
    lfoDepth.connect(gain.gain);
    src.start();
    lfo.start();
    state.vinyl = { src, gain, lfo };
    state.nextCrackleAt = ctx.currentTime + 0.6;
  }

  function playCrackle() {
    if (state.disposed || !state.vinyl) return;
    const buffer = getCrackleBuffer(ctx);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = 0.7 + Math.random() * 1.4;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1700 + Math.random() * 3600;
    filter.Q.value = 1.1;
    const gain = ctx.createGain();
    gain.gain.value = 0.018 + Math.random() * 0.05;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.7 - 0.85;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(musicBus);
    const t = ctx.currentTime;
    src.start(t);
    src.stop(t + 0.05);
  }

  // ---- BGM ----------------------------------------------------------------
  function ensureMusicBuffer() {
    if (state.musicBuffer) return Promise.resolve({ buffer: state.musicBuffer, meta: state.musicMeta });
    if (state.musicPromise) return state.musicPromise;
    state.musicPromise = (async () => {
      try {
        const result = await renderMusic(ctx);
        if (state.disposed || !result) return null;
        state.musicBuffer = result.buffer;
        state.musicMeta = result.meta;
        return result;
      } catch (err) {
        state.musicError = err && err.message ? err.message : String(err);
        return null;
      }
    })();
    return state.musicPromise;
  }

  async function startMusic() {
    if (state.musicStarted || state.disposed) return;
    state.musicStarted = true;
    const result = await ensureMusicBuffer();
    if (state.disposed) return;
    if (result && result.buffer) {
      const source = ctx.createBufferSource();
      source.buffer = result.buffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(musicBus);
      source.start();
      state.music = { mode: 'buffer', source, gain };
      state.musicMode = 'buffer';
      state.musicPlaying = true;
      state.ready = true;
      rampTo(gain.gain, 1, 2.6);
    } else {
      // OfflineAudioContext 不可用 / 渲染失败：同一份乐谱实时循环兜底
      try {
        const player = createRealtimeMusic(ctx, musicBus);
        player.start();
        state.music = { mode: 'realtime', player };
        state.musicMode = 'realtime';
        state.musicPlaying = true;
        state.ready = true;
      } catch (err) {
        state.musicError = err && err.message ? err.message : String(err);
        state.musicMode = 'failed';
      }
    }
    startVinylBed();
  }

  // ---- 音效 ----------------------------------------------------------------
  function dispatchCue(name, opts = {}) {
    if (state.disposed || !state.unlocked || state.muted) return;
    const fn = CUES[name];
    if (typeof fn !== 'function') return false;
    try {
      fn(session(opts.volume));
    } catch (err) {
      // 单个音效合成失败不影响游戏
    }
    return true;
  }

  function playCue(name, opts = {}) {
    if (state.disposed || !state.unlocked || state.muted) return;
    if (typeof name !== 'string' || !name) return;
    const direct = CUES[name];
    if (direct) {
      dispatchCue(name, opts);
      return;
    }
    // 兼容旧版直接传 asset path 的调用
    const mapped = cueFromPath(name);
    if (mapped === 'footstep') return playFootstep(opts);
    if (mapped === 'water') return playFootstep({ ...opts, water: true });
    if (mapped === 'jump') return playJump();
    if (mapped === 'land') return playLand();
    if (mapped && CUES[mapped]) {
      dispatchCue(mapped, opts);
      return;
    }
    // 未知 cue 的柔和兜底：轻轻的两声提示音，不吓人
    try {
      cueFallback(session(opts.volume));
    } catch {
      /* ignore */
    }
  }

  function cueFromPath(path) {
    const p = String(path).toLowerCase();
    if (!p) return null;
    if (p.includes('footstep') && p.includes('water')) return 'water';
    if (p.includes('footstep')) return 'footstep';
    if (p.includes('land')) return 'land';
    if (p.includes('jump')) return 'jump';
    if (p.includes('quest')) return 'quest';
    if (p.includes('whoosh') || p.includes('zoom')) return 'whoosh';
    if (p.includes('paper') || p.includes('letter')) return 'paper';
    if (p.includes('click')) return 'click';
    if (p.includes('hover')) return 'hover';
    if (p.includes('open')) return 'open';
    if (p.includes('emoji') || p.includes('emote')) return 'emoji';
    if (p.includes('bell') || p.includes('chime')) return 'letter';
    if (p.includes('button')) return 'buttons';
    return null;
  }

  function playFootstep(opts = {}) {
    if (state.disposed || !state.unlocked || state.muted) return;
    const now = ctx.currentTime;
    if (now - state.lastFootAt < 0.07) return; // 同一帧内去重
    state.lastFootAt = now;
    const s = session(1);
    const run = !!opts.run;
    const water = !!opts.water;
    const region = state.ambience ? state.ambience.key : state.region;
    const onSand = region === 'beach';
    const onMetal = region === 'factory';
    const wet = water || region === 'waterfalls';
    const rand = s.rand;
    try {
      if (wet) {
        // 水花：宽带噪声 + 几个气泡音
        sfxNoise(s, { type: 'bandpass', freq: 1900 + rand() * 700, q: 0.7, attack: 0.004, decay: 0.13 + rand() * 0.07, gain: 0.11, pan: (rand() - 0.5) * 0.4 });
        sfxNoise(s, { type: 'highpass', freq: 3600, attack: 0.002, decay: 0.06, gain: 0.045 });
        for (let i = 0; i < 3; i += 1) {
          sfxTone(s, {
            type: 'sine',
            freq: 700 + rand() * 900,
            freqEnd: 1200 + rand() * 900,
            attack: 0.004,
            decay: 0.03 + rand() * 0.03,
            gain: 0.018,
            start: rand() * 0.05,
          });
        }
        sfxTone(s, { type: 'sine', freq: 120, freqEnd: 60, attack: 0.004, decay: 0.1, gain: 0.03 });
      } else {
        // 干地：高频擦地噪声 + 低频 thud；跑步更重、更闷
        const thudFreq = run ? 92 : 112;
        sfxNoise(s, {
          type: onSand ? 'lowpass' : 'bandpass',
          freq: onSand ? 900 : onMetal ? 2100 : 1250 + rand() * 420,
          q: onMetal ? 1.6 : 0.9,
          attack: 0.002,
          decay: run ? 0.075 : 0.06,
          gain: run ? 0.14 : 0.1,
          pan: (rand() - 0.5) * 0.32,
        });
        if (run) sfxNoise(s, { type: 'highpass', freq: 3200, attack: 0.001, decay: 0.045, gain: 0.04 });
        sfxTone(s, {
          type: 'sine',
          freq: thudFreq + rand() * 14,
          freqEnd: run ? 46 : 58,
          attack: 0.003,
          decay: run ? 0.11 : 0.085,
          gain: run ? 0.078 : 0.052,
        });
      }
    } catch (err) {
      /* ignore */
    }
  }

  function playJump() {
    if (state.disposed || !state.unlocked || state.muted) return;
    const s = session(1);
    try {
      // 起跳的布料/气流声 + 轻轻上扬的"咻"
      sfxNoise(s, { type: 'bandpass', freq: 900, freqEnd: 2300, q: 0.7, attack: 0.008, decay: 0.2, gain: 0.055, pan: -0.1 });
      sfxTone(s, { type: 'sine', freq: 180, freqEnd: 380, attack: 0.008, decay: 0.16, gain: 0.045 });
      sfxTone(s, { type: 'triangle', freq: 392, freqEnd: 523.25, attack: 0.01, decay: 0.18, gain: 0.02, start: 0.05 });
    } catch (err) {
      /* ignore */
    }
  }

  function playLand() {
    if (state.disposed || !state.unlocked || state.muted) return;
    const s = session(1);
    try {
      sfxTone(s, { type: 'sine', freq: 132, freqEnd: 52, attack: 0.003, decay: 0.16, gain: 0.16 });
      sfxNoise(s, { type: 'bandpass', freq: 760, q: 0.8, attack: 0.002, decay: 0.11, gain: 0.075 });
      sfxTone(s, { type: 'triangle', freq: 196, attack: 0.004, decay: 0.1, gain: 0.03, start: 0.01 });
    } catch (err) {
      /* ignore */
    }
  }

  function playFile(path, opts = {}) {
    if (state.disposed || !state.unlocked || state.muted) return;
    const mapped = cueFromPath(path);
    if (mapped === 'footstep') return playFootstep(opts);
    if (mapped === 'water') return playFootstep({ ...opts, water: true });
    if (mapped === 'jump') return playJump();
    if (mapped === 'land') return playLand();
    if (mapped && CUES[mapped]) return dispatchCue(mapped, opts);
    // 没有对应合成音时用通用提示音，绝不发网络请求
    try {
      cueFallback(session(opts.volume));
    } catch {
      /* ignore */
    }
  }

  // ---- 调度器（环境音偶发事件 / 黑胶爆点） --------------------------------
  function tick(force = false) {
    if (state.disposed) return;
    const now = ctx.currentTime;
    if (!force && now - state.lastTickAt < 0.05) return;
    state.lastTickAt = now;

    const ambience = state.ambience;
    if (ambience && eventQueue.length && ctx.state === 'running') {
      for (const ev of eventQueue) {
        if (now < ev.nextAt) continue;
        ev.nextAt = now + ev.min + Math.random() * (ev.max - ev.min);
        if (state.muted) continue;
        try {
          ev.fire({ ctx, dest: ambience.gain, when: now + 0.05, rand: Math.random, noise: getNoiseBuffer(ctx) });
        } catch (err) {
          /* 单个环境事件失败忽略 */
        }
      }
    }

    if (state.vinyl && state.musicPlaying && !state.muted && now >= state.nextCrackleAt) {
      state.nextCrackleAt = now + 0.14 + Math.random() * 0.95;
      try {
        playCrackle();
      } catch (err) {
        /* ignore */
      }
    }
  }

  let tickTimer = 0;
  function startTicker() {
    if (tickTimer) return;
    tickTimer = window.setInterval(() => {
      try {
        tick();
      } catch (err) {
        /* ignore */
      }
    }, 250);
  }

  // ---- 解锁 / 预加载 -------------------------------------------------------
  async function unlock() {
    if (state.disposed) return;
    state.unlocked = true;
    startTicker();
    try {
      if (ctx.state !== 'running') await ctx.resume();
    } catch {
      /* 部分浏览器需要下一次手势 */
    }
    state.contextRunning = ctx.state === 'running';
    try {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(state.muted ? 0 : volumes.master, ctx.currentTime);
    } catch {
      /* ignore */
    }
    startMusic();
    const region = state.pendingRegion || state.region || DEFAULT_REGION;
    state.pendingRegion = null;
    switchAmbience(region);
  }

  async function preload() {
    if (state.disposed) return;
    getNoiseBuffer(ctx);
    getCrackleBuffer(ctx);
    try {
      await ensureMusicBuffer();
    } catch {
      /* ignore */
    }
    state.ready = true;
  }

  // ---- 静音 / 音量 ----------------------------------------------------------
  function setMuted(muted) {
    const next = !!muted;
    if (next === state.muted) return state.muted;
    state.muted = next;
    try {
      localStorage.setItem(storagePrefix + LS_MUTED, next ? '1' : '0');
    } catch {
      /* ignore */
    }
    rampTo(master.gain, next ? 0 : volumes.master, 0.25);
    return state.muted;
  }

  function setBusVolume(bus, value) {
    const v = clamp01(value);
    if (bus === 'music') {
      volumes.music = v;
      musicBus.gain.value = v;
      writeNumber(storagePrefix + LS_MUSIC, v);
    } else if (bus === 'ambience') {
      volumes.ambience = v;
      ambienceBus.gain.value = v;
      writeNumber(storagePrefix + LS_AMBIENCE, v);
    } else if (bus === 'sfx') {
      volumes.sfx = v;
      sfxBus.gain.value = v;
      writeNumber(storagePrefix + LS_SFX, v);
    } else {
      volumes.master = v;
      if (!state.muted) master.gain.value = v;
    }
  }

  function getBusVolume(bus) {
    if (bus === 'music') return volumes.music;
    if (bus === 'ambience') return volumes.ambience;
    if (bus === 'sfx') return volumes.sfx;
    return volumes.master;
  }

  // ---- 可视化用的分析节点（诊断 API，不属于游戏运行时契约） ---------------
  function createAnalyser(fftSize = 2048) {
    if (state.disposed) return null;
    const analyser = ctx.createAnalyser();
    try {
      analyser.fftSize = Math.max(32, Math.min(32768, fftSize));
    } catch {
      /* ignore */
    }
    analyser.smoothingTimeConstant = 0.82;
    // 静音旁路：master -> analyser -> gain(0) -> destination，
    // 保证分析节点处在到 destination 的路径上（否则某些浏览器不处理输入），又不会重复出声。
    const sink = ctx.createGain();
    sink.gain.value = 0;
    try {
      master.connect(analyser);
      analyser.connect(sink);
      sink.connect(ctx.destination);
    } catch {
      return null;
    }
    return analyser;
  }

  // ---- 清理 ----------------------------------------------------------------
  function dispose() {
    if (state.disposed) return;
    state.disposed = true;
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = 0;
    }
    eventQueue = [];
    try {
      if (state.music && state.music.mode === 'buffer') {
        state.music.source.stop();
      } else if (state.music && state.music.mode === 'realtime') {
        state.music.player.stop();
      }
    } catch {
      /* ignore */
    }
    try {
      state.vinyl?.src.stop();
      state.vinyl?.lfo.stop();
    } catch {
      /* ignore */
    }
    try {
      if (state.ambience) state.ambience.handle.stop(ctx.currentTime);
    } catch {
      /* ignore */
    }
    try {
      musicBus.disconnect();
      ambienceBus.disconnect();
      sfxBus.disconnect();
      master.disconnect();
    } catch {
      /* ignore */
    }
    try {
      ctx.close();
    } catch {
      /* ignore */
    }
  }

  // ---- 返回对象（getter 保持与旧版语义一致） --------------------------------
  return {
    unlock,
    preload,
    setRegion(name) {
      if (name == null) return;
      switchAmbience(name);
    },
    playFootstep,
    playFootstepWater: (opts) => playFootstep({ ...opts, water: true }),
    playJump,
    playLand,
    playCue,
    playFile,
    setMuted,
    toggleMute: () => setMuted(!state.muted),
    isMuted: () => state.muted,
    setBusVolume,
    getBusVolume,
    update(dt) {
      void dt;
      tick();
    },
    createAnalyser,
    dispose,
    diagnostics() {
      return {
        contextState: ctx.state,
        sampleRate: ctx.sampleRate,
        unlocked: state.unlocked,
        muted: state.muted,
        region: state.region,
        ambience: state.ambience ? state.ambience.key : null,
        ambienceEvents: eventQueue.map((ev) => ev.name),
        buses: { ...volumes },
        musicPlaying: state.musicPlaying,
        musicMode: state.musicMode,
        musicError: state.musicError,
        musicMeta: state.musicMeta,
        vinyl: !!state.vinyl,
      };
    },
    get ready() {
      return state.ready;
    },
    get unlocked() {
      return state.unlocked;
    },
    get region() {
      return state.region;
    },
    get muted() {
      return state.muted;
    },
    get musicPlaying() {
      return state.musicPlaying;
    },
    get musicBuffer() {
      return state.musicBuffer;
    },
    get musicMeta() {
      return state.musicMeta;
    },
    get musicMode() {
      return state.musicMode;
    },
    ctx,
  };
}

export default createAudio;
