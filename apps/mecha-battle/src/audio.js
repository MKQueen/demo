/**
 * 全程序化音频：不依赖任何外部音频素材。
 * 城市底噪、警报、巨兽咆哮、机甲冲击、天基炮与战斗音乐全部由 WebAudio 实时合成。
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.userVolume = .8;
    this.userMusic = .5;
    this.master = null;
    this.sfx = null;
    this.music = null;
    this.ambience = null;
    this.reverb = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.ready = false;
    this.musicTimer = null;
    this.step = 0;
    this.nextStepTime = 0;
    this.intensity = 0;
    this.musicOn = false;
    this.paused = false;
    this.stepDur = 60 / 88 / 4;
    this.ambienceNodes = [];
  }

  async init() {
    if (this.ready) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    try {
      await Promise.race([this.ctx.resume(), new Promise((resolve) => setTimeout(resolve, 700))]);
    } catch (err) {
      console.warn('[STEEL DAWN] AudioContext resume blocked:', err);
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.62 * this.userVolume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 15;
    comp.ratio.value = 5;
    comp.attack.value = 0.005;
    comp.release.value = 0.22;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.85;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = 0.0;
    this.musicLevel = ctx.createGain();
    this.musicLevel.gain.value = this.userMusic;
    this.music.connect(this.musicLevel);
    this.musicLevel.connect(this.master);
    this.ambience = ctx.createGain();
    this.ambience.gain.value = 0.55;
    this.ambience.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.createImpulse(2.6, 2.8);
    const revGain = ctx.createGain();
    revGain.gain.value = 0.22;
    this.reverb.connect(revGain);
    revGain.connect(this.master);

    this.noiseBuffer = this.createNoiseBuffer(2.5);
    this.ready = true;
    this.startAmbience();
    return true;
  }

  createNoiseBuffer(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2 + white * 0.18;
    }
    return buffer;
  }

  createImpulse(seconds, decay) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const impulse = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return impulse;
  }

  startAmbience() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = 0.028;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambience);
    src.start();
    this.ambienceNodes.push(src, filter, gain);

    // low city drone
    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 41;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.025;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 9;
    lfo.connect(lfoGain);
    lfoGain.connect(drone.frequency);
    drone.connect(droneGain);
    droneGain.connect(this.ambience);
    drone.start();
    lfo.start();
    this.ambienceNodes.push(drone, lfo, droneGain, lfoGain);
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.62 * this.userVolume, t + 0.15);
  }

  setLevels(volume, music) {
    this.userVolume = volume;this.userMusic = music;
    if(this.master)this.master.gain.setTargetAtTime(this.muted?0:.62*volume,this.ctx.currentTime,.05);
    if(this.musicLevel)this.musicLevel.gain.setTargetAtTime(music,this.ctx.currentTime,.05);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  startMusic(intensity = 1) {
    if (!this.ready) return;
    this.intensity = intensity;
    this.musicOn = true;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.linearRampToValueAtTime(0.33 + intensity * 0.08, t + 1.2);
    if (!this.musicTimer) {
      this.nextStepTime = t + 0.08;
      this.step = 0;
      this.musicTimer = setInterval(() => this.scheduleMusic(), 90);
    }
  }

  setIntensity(intensity) {
    this.intensity = intensity;
    if (this.ready && this.musicOn) {
      const t = this.ctx.currentTime;
      this.music.gain.cancelScheduledValues(t);
      this.music.gain.linearRampToValueAtTime(this.paused ? 0.06 : 0.33 + intensity * 0.08, t + 0.8);
    }
  }

  stopMusic(fade = 1.2) {
    this.musicOn = false;
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.linearRampToValueAtTime(0, t + fade);
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  setPaused(paused) {
    this.paused = paused;
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : paused ? 0.14 : 0.62, t + 0.3);
  }

  scheduleMusic() {
    if (!this.ctx || !this.musicOn) return;
    const ahead = this.ctx.currentTime + 0.22;
    while (this.nextStepTime < ahead) {
      this.playStep(this.step, this.nextStepTime);
      this.step = (this.step + 1) % 64;
      this.nextStepTime += this.stepDur;
    }
  }

  playStep(step, when) {
    const bar = Math.floor(step / 16);
    const inBar = step % 16;
    const roots = [55, 43.65, 65.41, 82.41];
    const chords = [
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
      [261.63, 329.63, 392],
      [164.81, 207.65, 246.94],
    ];
    const root = roots[bar];
    const chord = chords[bar];
    const intensity = this.intensity;
    if (inBar === 0 || inBar === 6 || inBar === 8 || inBar === 14) {
      this.kick(when, 0.5 + intensity * 0.12);
    }
    if (inBar === 4 || inBar === 12) {
      this.snare(when, 0.11 + intensity * 0.03);
    }
    if (step % 2 === 0) {
      this.hat(when, inBar % 4 === 0 ? 0.035 : 0.018, 0.035);
    }
    if ([0, 3, 6, 10, 12, 15].includes(inBar)) {
      this.bassNote(root, when, inBar === 0 ? 0.5 : 0.24, 0.085 + intensity * 0.03);
    }
    if (inBar === 0) {
      for (const n of chord) this.pad(n, when, 4 * this.stepDur * 2, 0.014 + intensity * 0.006);
    }
    if (intensity >= 1 && (inBar === 2 || inBar === 7 || inBar === 10 || inBar === 13)) {
      const n = chord[(step + bar) % chord.length] * 2;
      this.arp(n, when, 0.16, 0.017 + intensity * 0.01);
    }
    if (intensity >= 2 && inBar === 15) {
      this.riser(when, 0.3);
    }
  }

  kick(when, gain = 0.5) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(105, when);
    osc.frequency.exponentialRampToValueAtTime(38, when + 0.17);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.32);
    osc.connect(g);
    g.connect(this.music);
    osc.start(when);
    osc.stop(when + 0.35);
  }

  snare(when, gain = 0.12) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.music);
    src.start(when);
    src.stop(when + 0.22);
  }

  hat(when, gain = 0.02, decay = 0.04) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.music);
    src.start(when);
    src.stop(when + decay + 0.02);
  }

  bassNote(freq, when, dur, gain) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    sub.type = 'sine';
    osc.frequency.value = freq;
    sub.frequency.value = freq / 2;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500 + this.intensity * 200, when);
    filter.frequency.exponentialRampToValueAtTime(140, when + dur);
    filter.Q.value = 3;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(g);
    g.connect(this.music);
    osc.start(when);
    sub.start(when);
    osc.stop(when + dur + 0.05);
    sub.stop(when + dur + 0.05);
  }

  pad(freq, when, dur, gain) {
    const ctx = this.ctx;
    for (const detune of [-7, 0, 7]) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      filter.Q.value = 0.8;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(gain, when + 0.6);
      g.gain.linearRampToValueAtTime(0.0001, when + dur);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.music);
      osc.start(when);
      osc.stop(when + dur + 0.1);
    }
  }

  arp(freq, when, dur, gain) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g);
    g.connect(this.music);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  riser(when, gain = 0.02) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.5;
    filter.frequency.setValueAtTime(400, when);
    filter.frequency.exponentialRampToValueAtTime(5000, when + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.34);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.music);
    src.start(when);
    src.stop(when + 0.35);
  }

  // ---------- SFX ----------
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  noiseBurst(opts = {}) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const dur = opts.duration ?? 0.2;
    const when = opts.when ?? ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filter ?? 'lowpass';
    filter.frequency.setValueAtTime(opts.freqStart ?? 2000, when);
    if (opts.freqEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), when + dur);
    filter.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(opts.gain ?? 0.2, when + (opts.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfx);
    if (opts.reverb) {
      const send = ctx.createGain();
      send.gain.value = opts.reverb;
      g.connect(send);
      send.connect(this.reverb);
    }
    src.start(when);
    src.stop(when + dur + 0.05);
  }

  tone(opts = {}) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const when = opts.when ?? ctx.currentTime + (opts.delay ?? 0);
    const dur = opts.duration ?? 0.2;
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freq ?? 200, when);
    if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(10, opts.freqEnd), when + dur);
    if (opts.detune) osc.detune.value = opts.detune;
    let node = osc;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filter;
      f.frequency.value = opts.filterFreq ?? 800;
      f.Q.value = opts.q ?? 1;
      osc.connect(f);
      node = f;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(opts.gain ?? 0.2, when + (opts.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    node.connect(g);
    g.connect(this.sfx);
    if (opts.reverb) {
      const send = ctx.createGain();
      send.gain.value = opts.reverb;
      g.connect(send);
      send.connect(this.reverb);
    }
    osc.start(when);
    osc.stop(when + dur + 0.05);
    if (opts.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = opts.vibratoRate ?? 8;
      lg.gain.value = opts.vibrato;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(when);
      lfo.stop(when + dur + 0.05);
    }
  }

  ui() {
    if (!this.ready) return;
    this.tone({ freq: 900, freqEnd: 1300, duration: 0.06, gain: 0.035, type: 'square' });
  }

  uiDeny() {
    if (!this.ready) return;
    this.tone({ freq: 180, freqEnd: 110, duration: 0.16, gain: 0.08, type: 'square', filter: 'lowpass', filterFreq: 700 });
  }

  siren(duration = 2.4) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 540;
    lfo.type = 'sine';
    lfo.frequency.value = 0.62;
    lg.gain.value = 180;
    lfo.connect(lg);
    lg.connect(osc.frequency);
    osc.connect(g);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.055, t + 0.4);
    g.gain.setValueAtTime(0.055, t + duration - 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    g.connect(this.sfx);
    const send = ctx.createGain();
    send.gain.value = 0.4;
    g.connect(send);
    send.connect(this.reverb);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + duration);
    lfo.stop(t + duration);
  }

  roar(power = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dur = 1.9 + power * 0.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.36 * power, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.16 * power, t + 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.linearRampToValueAtTime(1500, t + 0.4);
    filter.frequency.exponentialRampToValueAtTime(220, t + dur);
    filter.Q.value = 4;
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.distortionCurve(28);
    shaper.oversample = '2x';
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(54 + i * 13 + power * 4, t);
      osc.frequency.exponentialRampToValueAtTime(34 + i * 7, t + dur);
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 7 + i * 2.7;
      lg.gain.value = 8 + i * 4;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      osc.connect(filter);
      lfo.start(t);
      lfo.stop(t + dur);
      osc.start(t);
      osc.stop(t + dur);
    }
    filter.connect(shaper);
    shaper.connect(g);
    g.connect(this.sfx);
    const send = ctx.createGain();
    send.gain.value = 0.5;
    g.connect(send);
    send.connect(this.reverb);
    this.noiseBurst({ duration: dur * 0.8, gain: 0.11, filter: 'bandpass', freqStart: 260, freqEnd: 900, q: 2, reverb: 0.4 });
    this.rumble(power);
  }

  rumble(power = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dur = 1.5;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 90;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.28 * power, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfx);
    src.start(t); src.stop(t + dur);
  }

  distortionCurve(k) {
    const n = 44100;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  punch(heavy = false) {
    if (!this.ready) return;
    this.noiseBurst({ duration: heavy ? 0.24 : 0.13, gain: heavy ? 0.3 : 0.18, filter: 'bandpass', freqStart: 900, freqEnd: 240, q: 1.4 });
    this.tone({ freq: heavy ? 76 : 95, freqEnd: 38, duration: heavy ? 0.3 : 0.18, gain: heavy ? 0.26 : 0.14, type: 'sine' });
    if (heavy) this.tone({ freq: 220, freqEnd: 70, duration: 0.32, gain: 0.08, type: 'triangle', reverb: 0.2 });
  }

  whoosh() {
    if (!this.ready) return;
    this.noiseBurst({ duration: 0.2, gain: 0.06, filter: 'bandpass', freqStart: 300, freqEnd: 1600, q: 2.2 });
  }

  metalStep(heavy = false) {
    if (!this.ready) return;
    // Sub weight + short pavement grit + chassis resonance; a beast gets a
    // softer, lower impact, without the mechanical upper harmonics.
    this.tone({freq:heavy?48:68,freqEnd:heavy?22:30,duration:heavy?.42:.28,gain:heavy?.2:.14,type:'sine',reverb:.12});
    this.noiseBurst({duration:heavy?.2:.13,gain:heavy?.07:.045,filter:'lowpass',freqStart:heavy?650:1200,freqEnd:180});
    if(!heavy){
      this.tone({freq:138,freqEnd:91,duration:.18,gain:.025,type:'triangle',reverb:.18});
      this.noiseBurst({duration:.045,gain:.018,filter:'highpass',freqStart:2100});
    }
  }

  impact(power = 1, heavy = false) {
    if (!this.ready) return;
    this.tone({ freq: 120 * power, freqEnd: 30, duration: 0.35 * power, gain: 0.22 * power, type: 'sine', reverb: 0.2 });
    this.noiseBurst({ duration: 0.25, gain: 0.13 * power, filter: 'lowpass', freqStart: 3000, freqEnd: 300 });
    if (heavy) this.metalClang();
  }

  metalClang() {
    if (!this.ready) return;
    [180, 311, 487, 733].forEach((f, i) => {
      this.tone({ freq: f, freqEnd: f * 0.7, duration: 0.55 - i * 0.07, gain: 0.035, type: 'triangle', reverb: 0.35 });
    });
  }

  explosion(power = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.tone({ freq: 58 + power * 10, freqEnd: 24, duration: 0.9 + power * 0.5, gain: 0.32 * power, type: 'sine', reverb: 0.4 });
    this.noiseBurst({ duration: 1.1 + power * 0.5, gain: 0.24 * power, filter: 'lowpass', freqStart: 4500, freqEnd: 160, q: 0.7, reverb: 0.5 });
    this.noiseBurst({ duration: 0.3, gain: 0.16 * power, filter: 'highpass', freqStart: 500, freqEnd: 6000 });
    // debris crackle
    for (let i = 0; i < 5; i++) {
      this.noiseBurst({ duration: 0.08, gain: 0.03 * power, filter: 'bandpass', freqStart: 600 + i * 400, freqEnd: 300, delay: 0.1 + i * 0.11 });
    }
  }

  megaExplosion() {
    if (!this.ready) return;
    this.explosion(2.2);
    this.tone({ freq: 45, freqEnd: 18, duration: 2.2, gain: 0.25, type: 'sine', reverb: 0.7 });
  }

  laserCharge(duration = 1.1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(680, t + duration);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + duration);
    f.Q.value = 5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + duration * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.1);
    osc.connect(f); f.connect(g); g.connect(this.sfx);
    osc.start(t); osc.stop(t + duration + 0.15);
  }

  laserFire() {
    if (!this.ready) return;
    this.tone({ freq: 1600, freqEnd: 70, duration: 0.7, gain: 0.2, type: 'sawtooth', filter: 'lowpass', filterFreq: 2200, reverb: 0.3 });
    this.noiseBurst({ duration: 0.55, gain: 0.15, filter: 'bandpass', freqStart: 3400, freqEnd: 360, q: 1.2 });
    this.tone({ freq: 70, freqEnd: 32, duration: 0.6, gain: 0.2, type: 'sine' });
  }

  plasmaBlast() {
    if (!this.ready) return;
    this.laserCharge(0.35);
    setTimeout(() => this.laserFire(), 250);
  }

  orbitalStrike() {
    if (!this.ready) return;
    this.laserCharge(1.6);
    const ctx = this.ctx;
    const t = ctx.currentTime + 1.55;
    this.tone({ freq: 1400, freqEnd: 45, duration: 1.8, gain: 0.32, type: 'sawtooth', when: t, reverb: 0.8 });
    this.noiseBurst({ duration: 2.2, gain: 0.32, filter: 'lowpass', freqStart: 8000, freqEnd: 90, q: 1.2, when: t, reverb: 0.8 });
    this.tone({ freq: 42, freqEnd: 18, duration: 2.5, gain: 0.4, type: 'sine', when: t, reverb: 0.7 });
    setTimeout(() => this.megaExplosion(), 1550);
  }

  monsterBreath() {
    if (!this.ready) return;
    this.noiseBurst({ duration: 1.4, gain: 0.28, filter: 'bandpass', freqStart: 800, freqEnd: 200, q: 0.8, reverb: 0.5 });
    this.tone({ freq: 160, freqEnd: 55, duration: 1.5, gain: 0.16, type: 'sawtooth', filter: 'lowpass', filterFreq: 900, reverb: 0.5 });
  }

  hurt() {
    if (!this.ready) return;
    this.metalClang();
    this.noiseBurst({ duration: 0.3, gain: 0.2, filter: 'lowpass', freqStart: 1600, freqEnd: 200 });
    this.tone({ freq: 90, freqEnd: 40, duration: 0.4, gain: 0.18, type: 'sine' });
  }

  warnBeep() {
    if (!this.ready) return;
    this.tone({ freq: 740, duration: 0.09, gain: 0.06, type: 'square', filter: 'lowpass', filterFreq: 1800 });
    this.tone({ freq: 740, duration: 0.09, gain: 0.06, type: 'square', filter: 'lowpass', filterFreq: 1800, delay: 0.16 });
    this.tone({ freq: 520, duration: 0.12, gain: 0.05, type: 'square', filter: 'lowpass', filterFreq: 1400, delay: 0.34 });
  }

  dodge() {
    if (!this.ready) return;
    this.noiseBurst({ duration: 0.28, gain: 0.1, filter: 'bandpass', freqStart: 500, freqEnd: 2400, q: 3 });
    this.tone({ freq: 300, freqEnd: 110, duration: 0.2, gain: 0.06, type: 'triangle' });
  }

  setThrust(level = 0) {
    if (!this.ready || (!this.thrustNoise && level <= 0)) return;
    if (!this.thrustNoise) {
      const source = this.ctx.createBufferSource(); source.buffer = this.noiseBuffer; source.loop = true;
      const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1200;
      const gain = this.ctx.createGain(); gain.gain.value = 0;
      source.connect(filter); filter.connect(gain); gain.connect(this.sfx); source.start();
      this.thrustNoise = { source, filter, gain };
    }
    if (this.thrustLevel === level) return;
    this.thrustLevel = level;
    this.thrustNoise.gain.gain.setTargetAtTime(level * .12, this.ctx.currentTime, .06);
    this.thrustNoise.filter.frequency.setTargetAtTime(600 + level * 1700, this.ctx.currentTime, .06);
  }

  shieldUp() {
    if (!this.ready) return;
    this.tone({ freq: 420, freqEnd: 720, duration: 0.24, gain: 0.06, type: 'sine', filter: 'lowpass', filterFreq: 1300, reverb: 0.25 });
  }

  victory() {
    if (!this.ready) return;
    const notes = [220, 277.18, 329.63, 440, 554.37];
    notes.forEach((n, i) => this.tone({ freq: n, duration: 1.3 - i * 0.1, gain: 0.09, type: 'triangle', delay: i * 0.22, reverb: 0.5 }));
    this.noiseBurst({ duration: 1.8, gain: 0.05, filter: 'highpass', freqStart: 2000, delay: 0.2 });
  }

  defeat() {
    if (!this.ready) return;
    const notes = [110, 98, 82.41, 55];
    notes.forEach((n, i) => this.tone({ freq: n, freqEnd: n * 0.94, duration: 1.8, gain: 0.12, type: 'sawtooth', filter: 'lowpass', filterFreq: 400, delay: i * 0.5, reverb: 0.5 }));
  }

  mechLand() {
    if (!this.ready) return;
    this.tone({ freq: 90, freqEnd: 28, duration: 1.3, gain: 0.35, type: 'sine', reverb: 0.4 });
    this.noiseBurst({ duration: 0.9, gain: 0.24, filter: 'lowpass', freqStart: 4000, freqEnd: 100, reverb: 0.4 });
    this.metalClang();
  }

  horn() {
    if (!this.ready) return;
    this.tone({ freq: 420, duration: 0.18, gain: 0.025, type: 'square', filter: 'lowpass', filterFreq: 1000 });
    this.tone({ freq: 520, duration: 0.18, gain: 0.02, type: 'square', filter: 'lowpass', filterFreq: 1200, delay: 0.02 });
  }
}
