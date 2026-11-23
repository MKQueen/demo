// 京城来信 · 原创程序化背景音乐（C 宫五声音阶 · Lo-fi 民乐循环）
// ---------------------------------------------------------------------------
// 这个文件里没有一行采样/音频文件：旋律、和声、拨弦、pad、木鱼、沙锤、混响 IR
// 全部由代码生成。它只被 audio.js 调用，不依赖 three.js / DOM。
//
// 设计概要
//   · 调式：C 宫五声（宫 C / 商 D / 角 E / 徵 G / 羽 A），无 4、7 级，听感"中式"
//   · 速度：80 BPM，4/4，12 小节 = 36s 循环；尾音额外渲染 5s 后回卷（wrap），
//     使循环点正好落在第 1 小节强拍的拨弦上，无缝且听不出接缝
//   · 和声：每小节一个"根音 + 五度 + 五声内九度"的空弦式和声：
//       C（宫）→ Am（羽）→ D（商）→ G（徵）→ … 十二小节
//   · 配器：Karplus-Strong 仿古筝拨弦（主旋律/低音）+ 正弦三角波柔和 pad
//       + 预生成木鱼/沙锤/软底鼓 one-shot + 卷积混响 + 附点八分延迟
//   · 黑胶噪声与爆点不放进循环 buffer，而是由 audio.js 实时铺一层"永不重复"的
//     底噪 —— 循环本身更干净，长听也不会听出 loop 边界
//   · 所有随机量都来自固定种子的 mulberry32：同一个版本每次渲染结果完全一致
//
// 对外 API
//   MUSIC / MELODY / BEAT_SECONDS / BAR_SECONDS / mulberry32 / midiToFrequency
//   renderMusic(realCtx, opts) -> Promise<{ buffer: AudioBuffer, meta }>
//   createRealtimeMusic(ctx, destination) -> { start(), stop(), graph }
//     （OfflineAudioContext 不可用时的兜底：同一套乐谱用实时调度器循环演奏）
// ---------------------------------------------------------------------------

export const MUSIC = Object.freeze({
  title: '小行星邮差（原创）',
  bpm: 80,
  beatsPerBar: 4,
  bars: 12,
  loopSeconds: 36,
  tailSeconds: 5,
  seed: 0x5eed2024,
  key: 'C 宫',
  scale: Object.freeze({
    name: 'C 宫五声',
    degrees: Object.freeze(['宫', '商', '角', '徵', '羽']),
    notes: Object.freeze(['C', 'D', 'E', 'G', 'A']),
    semitones: Object.freeze([0, 2, 4, 7, 9]),
  }),
  progression: Object.freeze(['C', 'Am', 'D', 'G', 'C', 'Am', 'D', 'G', 'Am', 'C', 'G', 'C']),
});

export const BEAT_SECONDS = 60 / MUSIC.bpm; // 0.75s
export const BAR_SECONDS = BEAT_SECONDS * MUSIC.beatsPerBar; // 3s

// ------------------------------------------------------------------ 小工具

/** 固定种子伪随机：保证每次渲染的 humanize / 噪声完全一致。 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

/** 'A4' / 'C#5' -> midi。 */
export function midiOf(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(String(name));
  if (!m) throw new Error('bad note: ' + name);
  return NOTE_INDEX[m[1]] + (Number(m[2]) + 1) * 12;
}

export function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// ------------------------------------------------------------------ 和声

// root/fifth：低音拨弦用；pad：三声部空弦和声（只使用五声音阶内的音）。
const CHORDS = {
  C: { label: '宫', root: midiOf('C2'), fifth: midiOf('G2'), pad: [midiOf('C3'), midiOf('G3'), midiOf('D4')] },
  Am: { label: '羽', root: midiOf('A1'), fifth: midiOf('E2'), pad: [midiOf('A2'), midiOf('E3'), midiOf('C4')] },
  D: { label: '商', root: midiOf('D2'), fifth: midiOf('A2'), pad: [midiOf('D3'), midiOf('A3'), midiOf('E4')] },
  G: { label: '徵', root: midiOf('G1'), fifth: midiOf('D2'), pad: [midiOf('G2'), midiOf('D3'), midiOf('A3')] },
};

// ------------------------------------------------------------------ 旋律

// 原创旋律（起承转合）：
//   A  段 1-4 小节：主题，落音在 D5
//   A' 段 5-8 小节：同和声、换高八度走向，落音回 C5（宫）
//   B  段 9-12 小节：冲到 D6 后逐级下行，第 12 小节回到宫音，接回开头
// 记法：M(小节, 拍, 音名, 时值拍, 力度, 倚音?)
const M = (bar, beat, note, beats, velocity) => ({ bar, beat, note, beats, velocity });

/* prettier-ignore */
export const MELODY = [
  // ── A 段（第 1–4 小节）
  M(0, 0, 'E5', 1, 0.9),
  M(0, 1, 'G5', 0.5, 0.7),
  M(0, 1.5, 'A5', 0.5, 0.75),
  M(0, 2, 'G5', 1, 0.8),
  M(0, 3, 'E5', 1, 0.72),
  M(1, 0, 'A5', 1.5, 0.9),
  M(1, 1.5, 'G5', 0.5, 0.65),
  M(1, 2, 'E5', 1, 0.8),
  M(1, 3, 'D5', 1, 0.72),
  M(2, 0, 'E5', 0.5, 0.78),
  M(2, 0.5, 'G5', 0.5, 0.68),
  M(2, 1, 'A5', 1, 0.85),
  M(2, 2, 'C6', 1, 0.95),
  M(2, 3, 'A5', 1, 0.75),
  M(3, 0, 'G5', 1.5, 0.88),
  M(3, 1.5, 'A5', 0.5, 0.62),
  M(3, 2, 'G5', 1, 0.78),
  M(3, 3, 'D5', 1, 0.7),
  // ── A' 段（第 5–8 小节）
  M(4, 0, 'C6', 1, 0.92),
  M(4, 1, 'A5', 0.5, 0.7),
  M(4, 1.5, 'G5', 0.5, 0.67),
  M(4, 2, 'E5', 1, 0.8),
  M(4, 3, 'D5', 1, 0.72),
  M(5, 0, 'E5', 1, 0.82),
  M(5, 1, 'G5', 0.5, 0.7),
  M(5, 1.5, 'A5', 0.5, 0.75),
  M(5, 2, 'C6', 1, 0.9),
  M(5, 3, 'A5', 1, 0.75),
  M(6, 0, 'D5', 0.5, 0.75),
  M(6, 0.5, 'E5', 0.5, 0.7),
  M(6, 1, 'G5', 1, 0.85),
  M(6, 2, 'A5', 1, 0.85),
  M(6, 3, 'G5', 1, 0.72),
  M(7, 0, 'E5', 1.5, 0.85),
  M(7, 1.5, 'D5', 0.5, 0.62),
  M(7, 2, 'C5', 2, 0.8),
  // ── B 段（第 9–12 小节）
  M(8, 0, 'A5', 1, 0.9),
  M(8, 1, 'C6', 1, 0.92),
  { ...M(8, 2, 'D6', 1, 0.98), grace: 'C6' },
  M(8, 3, 'C6', 1, 0.8),
  M(9, 0, 'A5', 1, 0.88),
  M(9, 1, 'G5', 1, 0.8),
  M(9, 2, 'E5', 1, 0.8),
  M(9, 3, 'G5', 0.5, 0.7),
  M(9, 3.5, 'A5', 0.5, 0.75),
  M(10, 0, 'G5', 1.5, 0.88),
  M(10, 1.5, 'E5', 0.5, 0.65),
  M(10, 2, 'D5', 1, 0.8),
  M(10, 3, 'E5', 1, 0.78),
  M(11, 0, 'G5', 1, 0.85),
  M(11, 1, 'E5', 1, 0.8),
  M(11, 2, 'D5', 1, 0.78),
  M(11, 3, 'C5', 1, 0.85),
];

/** 每个小节的和声标签，供 README / 测试页展示。 */
export function progressionTable() {
  return MUSIC.progression.map((name, bar) => ({
    bar: bar + 1,
    chord: name,
    degree: CHORDS[name].label,
    root: CHORDS[name].root,
    pad: CHORDS[name].pad.slice(),
  }));
}

// ------------------------------------------------------------------ 音频基建

// 柔和削波：tanh 归一化，±1 输入时仍回到 ±1，避免把整体音量吃掉。
function softClipCurve(amount = 1.35) {
  const n = 2048;
  const curve = new Float32Array(n);
  const norm = Math.tanh(amount);
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / norm;
  }
  return curve;
}

/** Karplus-Strong 拨弦：古筝/琵琶式的"噪声激励 + 延迟线 + 阻尼"。 */
function makePluckBuffer(ctx, freq, t60, rand, { brightness = 0.78 } = {}) {
  const sr = ctx.sampleRate;
  const period = Math.max(2, Math.round(sr / freq));
  const seconds = Math.min(3.8, Math.max(0.12, t60 * 1.18));
  const length = Math.max(64, Math.floor(seconds * sr));
  const out = new Float32Array(length);

  // 激励：低通白噪声（brightness 越高越"亮"，越低越"木"）
  const delay = new Float32Array(period);
  let lp = 0;
  for (let i = 0; i < period; i += 1) {
    const white = rand() * 2 - 1;
    lp += brightness * (white - lp);
    delay[i] = lp;
  }
  // 归一化激励，让不同音高的拨弦响度接近
  let energy = 0;
  for (let i = 0; i < period; i += 1) energy += delay[i] * delay[i];
  const norm = Math.min(4, 1.2 / Math.sqrt(Math.max(1e-6, energy / period)));

  const decay = Math.pow(0.001, 1 / (t60 * sr)); // t60 秒后 -60dB
  let idx = 0;
  let peak = 1e-6;
  for (let i = 0; i < length; i += 1) {
    const cur = delay[idx];
    const next = delay[(idx + 1) % period];
    // 一阶平均滤波让高次谐波衰减更快 —— 拨弦的"阻尼"
    delay[idx] = 0.5 * (cur + next) * decay;
    const v = cur * norm;
    out[i] = v;
    const abs = Math.abs(v);
    if (abs > peak) peak = abs;
    idx = (idx + 1) % period;
  }
  // 统一峰值 + 尾部淡出，避免缓冲区截断产生 click
  const scale = Math.min(6, 0.9 / peak);
  const fade = Math.min(length, Math.floor(sr * 0.06));
  for (let i = 0; i < length; i += 1) {
    let v = out[i] * scale;
    if (i >= length - fade) v *= (length - 1 - i) / fade;
    out[i] = v;
  }
  const buffer = ctx.createBuffer(1, length, sr);
  buffer.copyToChannel(out, 0);
  return buffer;
}

/** 卷积混响 IR：指数衰减噪声 + 一阶低通（暗一点的厅堂感），带 28ms 预延迟。 */
function makeImpulseResponse(ctx, seconds, rand) {
  const sr = ctx.sampleRate;
  const length = Math.floor(seconds * sr);
  const buffer = ctx.createBuffer(2, length, sr);
  const preDelay = Math.floor(0.028 * sr);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i += 1) {
      if (i < preDelay) {
        data[i] = 0;
        continue;
      }
      const t = (i - preDelay) / sr;
      const env = Math.exp(-t * 2.55) * Math.max(0, 1 - t / seconds);
      const white = rand() * 2 - 1;
      lp += 0.42 * (white - lp); // 越往后越暗
      data[i] = lp * env * 0.55;
    }
  }
  return buffer;
}

function makeBuffer(ctx, seconds) {
  return ctx.createBuffer(1, Math.max(1, Math.floor(seconds * ctx.sampleRate)), ctx.sampleRate);
}

/** 软底鼓 one-shot。 */
function makeKickBuffer(ctx, rand) {
  const sr = ctx.sampleRate;
  const length = Math.floor(0.45 * sr);
  const buffer = makeBuffer(ctx, length / sr);
  const data = buffer.getChannelData(0);
  let phase = 0;
  for (let i = 0; i < length; i += 1) {
    const t = i / sr;
    const freq = 34 + 78 * Math.exp(-t * 26);
    phase += (Math.PI * 2 * freq) / sr;
    const body = Math.sin(phase) * Math.exp(-t * 8.5) * 0.9;
    const click = i < 220 ? (rand() * 2 - 1) * 0.18 * Math.exp(-t * 320) : 0;
    data[i] = body + click;
  }
  return buffer;
}

/** 木鱼/梆子 one-shot（短促、带一点木质噪声）。 */
function makeWoodBuffer(ctx, rand) {
  const sr = ctx.sampleRate;
  const length = Math.floor(0.2 * sr);
  const buffer = makeBuffer(ctx, length / sr);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    const t = i / sr;
    const body = Math.sin(Math.PI * 2 * 640 * t) * Math.exp(-t * 52) * 0.55;
    const body2 = Math.sin(Math.PI * 2 * 1730 * t) * Math.exp(-t * 90) * 0.18;
    const click = i < 90 ? (rand() * 2 - 1) * 0.35 * Math.exp(-t * 900) : 0;
    data[i] = body + body2 + click;
  }
  return buffer;
}

/** 沙锤 one-shot（高通噪声 + 快速衰减）。 */
function makeShakerBuffer(ctx, rand) {
  const sr = ctx.sampleRate;
  const length = Math.floor(0.1 * sr);
  const buffer = makeBuffer(ctx, length / sr);
  const data = buffer.getChannelData(0);
  let prev = 0;
  for (let i = 0; i < length; i += 1) {
    const t = i / sr;
    const white = rand() * 2 - 1;
    const hp = white - prev * 0.72; // 简易高通
    prev = white;
    const env = Math.min(1, t / 0.004) * Math.exp(-t * 58);
    data[i] = hp * env * 0.4;
  }
  return buffer;
}

// ------------------------------------------------------------------ 音频图

/**
 * 建立整首 BGM 的常驻音频图（总线 / 混响 / 延迟 / 鼓组缓冲）。
 * offline 渲染与实时兜底共用，保证两种模式音色一致。
 */
function buildMusicGraph(ctx, destination, rand) {
  const sr = ctx.sampleRate;

  const master = ctx.createGain();
  master.gain.value = 0.82;
  const lofi = ctx.createBiquadFilter();
  lofi.type = 'lowpass';
  lofi.frequency.value = 7200; // Lo-fi：把"数码感"的高频压掉
  lofi.Q.value = 0.6;
  const subCut = ctx.createBiquadFilter();
  subCut.type = 'highpass';
  subCut.frequency.value = 38;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.knee.value = 14;
  comp.ratio.value = 2.6;
  comp.attack.value = 0.009;
  comp.release.value = 0.3;
  const clip = ctx.createWaveShaper();
  clip.curve = softClipCurve();
  clip.oversample = '2x';

  master.connect(lofi);
  lofi.connect(subCut);
  subCut.connect(comp);
  comp.connect(clip);
  clip.connect(destination);

  // 混响（卷积，IR 由代码生成）
  const convolver = ctx.createConvolver();
  convolver.buffer = makeImpulseResponse(ctx, 2.6, rand);
  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.55;
  convolver.connect(reverbReturn);
  reverbReturn.connect(master);

  // 附点八分延迟（80BPM → 0.5625s），只给旋律一层山谷回声
  const delay = ctx.createDelay(2);
  delay.delayTime.value = BEAT_SECONDS * 0.75;
  const echoDelayIn = ctx.createGain();
  echoDelayIn.gain.value = 0.85;
  echoDelayIn.connect(delay);
  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = 'lowpass';
  delayFilter.frequency.value = 1650;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.24;
  delay.connect(delayFilter);
  delayFilter.connect(feedback);
  feedback.connect(delay);
  const delayReturn = ctx.createGain();
  delayReturn.gain.value = 0.2;
  delayFilter.connect(delayReturn);
  delayReturn.connect(master);

  // 分轨
  const melodyIn = ctx.createGain();
  melodyIn.gain.value = 0.62;
  const melodyHp = ctx.createBiquadFilter();
  melodyHp.type = 'highpass';
  melodyHp.frequency.value = 190;
  melodyIn.connect(melodyHp);
  melodyHp.connect(master);

  const melodySend = ctx.createGain();
  melodySend.gain.value = 0.5;
  melodyHp.connect(melodySend);
  melodySend.connect(convolver);

  const delaySend = ctx.createGain();
  delaySend.gain.value = 0.34;
  melodyHp.connect(delaySend);
  delaySend.connect(delay);

  const bassIn = ctx.createGain();
  bassIn.gain.value = 0.55;
  const bassLp = ctx.createBiquadFilter();
  bassLp.type = 'lowpass';
  bassLp.frequency.value = 720;
  bassLp.Q.value = 0.4;
  bassIn.connect(bassLp);
  bassLp.connect(master);
  const bassSend = ctx.createGain();
  bassSend.gain.value = 0.12;
  bassLp.connect(bassSend);
  bassSend.connect(convolver);

  const padIn = ctx.createGain();
  padIn.gain.value = 0.5;
  const padLp = ctx.createBiquadFilter();
  padLp.type = 'lowpass';
  padLp.frequency.value = 1350;
  padLp.Q.value = 0.5;
  padIn.connect(padLp);
  padLp.connect(master);
  const padSend = ctx.createGain();
  padSend.gain.value = 0.65;
  padLp.connect(padSend);
  padSend.connect(convolver);

  const drumIn = ctx.createGain();
  drumIn.gain.value = 0.9;
  drumIn.connect(master);
  const drumSend = ctx.createGain();
  drumSend.gain.value = 0.1;
  drumIn.connect(drumSend);
  drumSend.connect(convolver);

  // pad 的慢速合唱 / 滤波呼吸（一个 LFO 同时驱动所有 pad 声部）
  const padVibrato = ctx.createOscillator();
  padVibrato.frequency.value = 0.14;
  const padVibratoDepth = ctx.createGain();
  padVibratoDepth.gain.value = 5.5; // cents
  padVibrato.connect(padVibratoDepth);
  padVibrato.start(0);

  const padFilterLfo = ctx.createOscillator();
  padFilterLfo.frequency.value = 0.07;
  const padFilterDepth = ctx.createGain();
  padFilterDepth.gain.value = 160;
  padFilterLfo.connect(padFilterDepth);
  padFilterDepth.connect(padLp.frequency);
  padFilterLfo.start(0);

  return {
    sr,
    master,
    melodyIn,
    bassIn,
    padIn,
    drumIn,
    reverb: convolver,
    delay,
    echoDelayIn,
    padVibratoDepth,
    kick: makeKickBuffer(ctx, rand),
    wood: makeWoodBuffer(ctx, rand),
    shaker: makeShakerBuffer(ctx, rand),
    pluckCache: new Map(),
    sources: [],
  };
}

// ------------------------------------------------------------------ 演奏

/** 拨弦一个音（含 Karplus-Strong buffer 缓存）。 */
function schedulePluck(ctx, graph, t, midi, velocity, { t60 = 2.6, pan = 0, rate = 1, destination = null, brightness } = {}) {
  const freq = midiToFrequency(midi);
  const key = freq.toFixed(2) + '|' + t60.toFixed(2);
  let buffer = graph.pluckCache.get(key);
  if (!buffer) {
    const rand = mulberry32((graph.pluckCache.size + 1) * 2654435761);
    buffer = makePluckBuffer(ctx, freq, t60, rand, { brightness });
    graph.pluckCache.set(key, buffer);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const gain = ctx.createGain();
  gain.gain.value = velocity;
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  src.connect(gain);
  gain.connect(panner);
  panner.connect(destination || graph.melodyIn);
  src.start(Math.max(0, t));
  graph.sources.push(src);
}

function scheduleBass(ctx, graph, t, midi, velocity, rand) {
  schedulePluck(ctx, graph, t + (rand() - 0.5) * 0.012, midi, velocity, {
    t60: 3.4,
    pan: (rand() - 0.5) * 0.12,
    rate: 1 + (rand() - 0.5) * 0.004,
    destination: graph.bassIn,
    brightness: 0.55,
  });
}

function scheduleMelodyNote(ctx, graph, t, note, velocity, rand) {
  const midi = midiOf(note);
  const pan = clamp((midi - 74) / 36, -0.32, 0.32) + (rand() - 0.5) * 0.08;
  const t60 = midi >= 84 ? 1.7 : midi >= 79 ? 2.1 : 2.6;
  const when = t + (rand() - 0.5) * 0.02; // 轻微 humanize，像真人手速
  const rate = 1 + (rand() - 0.5) * 0.006;
  schedulePluck(ctx, graph, when, midi, velocity, { t60, pan, rate });
  // 山谷回声：只给力度的音，附点八分后出现，反向声场（走延迟线，不再上干声）
  if (velocity >= 0.8) {
    const buffer = graph.pluckCache.get(midiToFrequency(midi).toFixed(2) + '|' + t60.toFixed(2));
    if (buffer) {
      const echoGain = ctx.createGain();
      const echoPan = ctx.createStereoPanner();
      echoGain.gain.value = 0.24 * velocity;
      echoPan.pan.value = -pan * 0.9;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      src.connect(echoGain);
      echoGain.connect(echoPan);
      echoPan.connect(graph.echoDelayIn);
      src.start(Math.max(0, when + BEAT_SECONDS * 0.75));
      graph.sources.push(src);
    }
  }
}

function schedulePad(ctx, graph, t, chordName, barDuration) {
  const chord = CHORDS[chordName];
  const pans = [-0.36, 0.04, 0.36];
  const levels = [0.075, 0.062, 0.05];
  chord.pad.forEach((midi, index) => {
    const freq = midiToFrequency(midi);
    const dur = barDuration;
    const detunes = [-5, 5];
    detunes.forEach((detune, layer) => {
      const osc = ctx.createOscillator();
      osc.type = layer === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      graph.padVibratoDepth.connect(osc.detune);
      const gain = ctx.createGain();
      const peak = levels[index] * (layer === 0 ? 1 : 0.34);
      const t0 = t + (layer === 0 ? 0 : 0.02);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.85);
      gain.gain.setValueAtTime(peak * 0.86, t0 + dur - 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 1.15);
      const panner = ctx.createStereoPanner();
      panner.pan.value = pans[index];
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(graph.padIn);
      osc.start(t0);
      osc.stop(t0 + dur + 1.3);
    });
  });
}

function scheduleDrum(ctx, graph, buffer, t, { gain = 1, rate = 1, pan = 0 } = {}) {
  if (!buffer) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  src.connect(g);
  g.connect(p);
  p.connect(graph.drumIn);
  src.start(Math.max(0, t));
  graph.sources.push(src);
}

/**
 * 排一个完整循环（12 小时小节）的小节内容。
 * offline 渲染从 t0=0 开始排一次；实时兜底每隔 loopSeconds 排一次。
 */
export function scheduleCycle(ctx, graph, t0, rand) {
  for (let bar = 0; bar < MUSIC.bars; bar += 1) {
    const barStart = t0 + bar * BAR_SECONDS;
    const chordName = MUSIC.progression[bar];
    const chord = CHORDS[chordName];

    // pad：整小节铺底
    schedulePad(ctx, graph, barStart, chordName, BAR_SECONDS);

    // 低音拨弦：强拍根音 + 三拍五度，句尾偶尔加八度
    scheduleBass(ctx, graph, barStart, chord.root, 0.92, rand);
    scheduleBass(ctx, graph, barStart + 2 * BEAT_SECONDS, chord.fifth, 0.56, rand);
    if (bar % 4 === 3) scheduleBass(ctx, graph, barStart + 3.5 * BEAT_SECONDS, chord.root + 12, 0.32, rand);

    // 鼓组：80BPM 的半拍感 —— 底鼓 1 拍、木鱼 3 拍、沙锤八分（带 swing）
    scheduleDrum(ctx, graph, graph.kick, barStart + (rand() - 0.5) * 0.006, { gain: 0.62, rate: 0.98 + rand() * 0.04 });
    scheduleDrum(ctx, graph, graph.wood, barStart + 2 * BEAT_SECONDS + (rand() - 0.5) * 0.012, {
      gain: 0.3 + rand() * 0.07,
      rate: 0.96 + rand() * 0.07,
      pan: 0.14,
    });
    if (bar % 4 === 3) {
      scheduleDrum(ctx, graph, graph.wood, barStart + 3.5 * BEAT_SECONDS, { gain: 0.17, rate: 1.08, pan: -0.2 });
    }
    for (let eighth = 0; eighth < 8; eighth += 1) {
      const swing = eighth % 2 === 1 ? 0.055 * BEAT_SECONDS : 0;
      const accent = eighth % 2 === 0 ? 0.11 : 0.055;
      scheduleDrum(ctx, graph, graph.shaker, barStart + eighth * 0.5 * BEAT_SECONDS + swing + (rand() - 0.5) * 0.01, {
        gain: accent * (0.8 + rand() * 0.4),
        rate: 0.9 + rand() * 0.2,
        pan: -0.28 + rand() * 0.16,
      });
    }

    // 旋律（含倚音）
    for (const note of MELODY) {
      if (note.bar !== bar) continue;
      const t = barStart + note.beat * BEAT_SECONDS;
      if (note.grace) {
        const graceMidi = midiOf(note.grace);
        schedulePluck(ctx, graph, t - 0.075, graceMidi, note.velocity * 0.32, {
          t60: 1.1,
          pan: -0.1,
          rate: 1.02,
        });
      }
      scheduleMelodyNote(ctx, graph, t, note.note, note.velocity, rand);
    }
  }
}

// ------------------------------------------------------------------ 离线渲染

/**
 * 把整首 BGM 离线渲染成一条可无缝 loop 的 AudioBuffer。
 * 做法：渲染 loopSeconds + tailSeconds，再把超出部分"回卷"叠加到开头，
 * 这样上一遍的尾音（拨弦余韵 + 混响）会自然延续进下一遍。
 *
 * @param {BaseAudioContext} realCtx 用来创建返回 AudioBuffer 的实时上下文
 * @param {{ sampleRate?: number, loopSeconds?: number, tailSeconds?: number }} [options]
 * @returns {Promise<{ buffer: AudioBuffer, meta: object }>}
 */
export async function renderMusic(realCtx, options = {}) {
  const Offline =
    typeof OfflineAudioContext !== 'undefined'
      ? OfflineAudioContext
      : typeof window !== 'undefined'
        ? window.OfflineAudioContext || window.webkitOfflineAudioContext
        : null;
  if (!Offline) throw new Error('OfflineAudioContext 不可用');

  const sr = options.sampleRate || realCtx.sampleRate;
  const loopSeconds = options.loopSeconds || MUSIC.loopSeconds;
  const tailSeconds = options.tailSeconds || MUSIC.tailSeconds;
  const totalSamples = Math.ceil((loopSeconds + tailSeconds) * sr);

  const offline = new Offline(2, totalSamples, sr);
  const rand = mulberry32(MUSIC.seed);
  const graph = buildMusicGraph(offline, offline.destination, rand);

  const startedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  scheduleCycle(offline, graph, 0, rand);
  const rendered = await offline.startRendering();
  const renderMs = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - startedAt;

  const loopSamples = Math.round(loopSeconds * sr);
  const available = rendered.length;
  const tailSamples = Math.max(0, available - loopSamples);
  const out = realCtx.createBuffer(2, loopSamples, sr);
  let peak = 0;
  let sumSq = 0;
  for (let ch = 0; ch < 2; ch += 1) {
    const src = rendered.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let i = 0; i < loopSamples; i += 1) {
      const v = src[i] + (i < tailSamples ? src[loopSamples + i] : 0);
      dst[i] = v;
      const abs = Math.abs(v);
      if (abs > peak) peak = abs;
      sumSq += v * v;
    }
  }
  const rawPeak = Math.max(1e-6, peak);
  const targetPeak = 0.72; // 给后续总线 / 压缩留 headroom
  const scale = rawPeak > targetPeak ? targetPeak / rawPeak : 1;
  if (scale !== 1) {
    for (let ch = 0; ch < 2; ch += 1) {
      const dst = out.getChannelData(ch);
      for (let i = 0; i < loopSamples; i += 1) dst[i] *= scale;
    }
  }
  const peakOut = rawPeak * scale;
  const rms = Math.sqrt(sumSq / (loopSamples * 2)) * scale;
  const seamDelta = Math.abs(out.getChannelData(0)[0] - out.getChannelData(0)[loopSamples - 1]);

  return {
    buffer: out,
    meta: {
      title: MUSIC.title,
      bpm: MUSIC.bpm,
      bars: MUSIC.bars,
      beatsPerBar: MUSIC.beatsPerBar,
      loopSeconds: loopSamples / sr,
      tailSeconds,
      sampleRate: sr,
      key: MUSIC.key,
      scale: MUSIC.scale.name,
      progression: MUSIC.progression.slice(),
      melodyNotes: MELODY.length,
      renderMs: Math.round(renderMs),
      peak: Number(peakOut.toFixed(4)),
      rms: Number(rms.toFixed(5)),
      peakBeforeNormalize: Number(rawPeak.toFixed(4)),
      normalizeScale: Number(scale.toFixed(4)),
      seamDelta: Number(seamDelta.toFixed(5)),
      renderer: 'OfflineAudioContext',
    },
  };
}

// ------------------------------------------------------------------ 实时兜底

/**
 * 没有 OfflineAudioContext 时的兜底：同一份乐谱，实时循环调度。
 * 每 loopSeconds 提前 ~2s 排下一遍；常驻的混响/压缩/延迟让接缝自然过渡。
 */
export function createRealtimeMusic(ctx, destination) {
  const rand = mulberry32(MUSIC.seed);
  const graph = buildMusicGraph(ctx, destination, rand);
  let timer = null;
  let nextCycleAt = 0;
  let stopped = false;
  let muteGain = 1;

  function tick() {
    if (stopped || !ctx || ctx.state === 'closed') return;
    const horizon = ctx.currentTime + 2.5;
    while (nextCycleAt < horizon) {
      scheduleCycle(ctx, graph, nextCycleAt, rand);
      nextCycleAt += MUSIC.loopSeconds;
    }
    // 清掉已经结束的 source 引用，避免数组无限增长
    if (graph.sources.length > 1500) graph.sources.splice(0, graph.sources.length - 500);
  }

  return {
    graph,
    start() {
      if (stopped) return;
      nextCycleAt = ctx.currentTime + 0.12;
      tick();
      timer = setInterval(tick, 500);
    },
    stop(fadeSeconds = 0.8) {
      if (stopped) return;
      stopped = true;
      if (timer) clearInterval(timer);
      const t = ctx.currentTime;
      const g = graph.master.gain;
      try {
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(0.0001, t + fadeSeconds);
      } catch {
        g.value = 0;
      }
      setTimeout(() => {
        try {
          graph.master.disconnect();
        } catch {
          /* ignore */
        }
      }, (fadeSeconds + 0.3) * 1000);
    },
    setVolume(v) {
      muteGain = clamp(v, 0, 1);
      if (graph.master && !stopped) {
        try {
          graph.master.gain.setTargetAtTime(0.82 * muteGain, ctx.currentTime, 0.05);
        } catch {
          graph.master.gain.value = 0.82 * muteGain;
        }
      }
    },
  };
}
