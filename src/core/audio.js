/**
 * Fully synthesised audio (no asset files): UI sounds, lab foley, ambience and
 * a gentle generative soundtrack. Everything is created lazily on first gesture.
 */
class AudioSys {
  constructor() {
    this.ctx = null;
    this.vol = { sfx: 0.7, music: 0.45 };
    this.mood = 'title';
    this._musicOn = false;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
    this.comp = ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 4; this.comp.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.comp);
    this.music = ctx.createGain(); this.music.gain.value = this.vol.music * 0.5; this.music.connect(this.comp);
    this.amb = ctx.createGain(); this.amb.gain.value = this.vol.music * 0.6; this.amb.connect(this.comp);
    // reverb
    this.verb = ctx.createConvolver(); this.verb.buffer = this._impulse(2.8, 2.2);
    this.verbOut = ctx.createGain(); this.verbOut.gain.value = 0.5; this.verb.connect(this.verbOut); this.verbOut.connect(this.comp);
    this.noise = this._noiseBuffer(2);
    this._startAmbience();
    if (this._wantMusic) this.startMusic();
  }

  setVolumes({ sfx, music }) {
    if (sfx != null) this.vol.sfx = sfx;
    if (music != null) this.vol.music = music;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfx.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.music.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.2);
    this.amb.gain.setTargetAtTime(this.vol.music * 0.6, t, 0.2);
  }

  _impulse(seconds, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  _noiseBuffer(seconds) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Oscillator note with envelope. */
  tone(freq, dur = 0.2, { type = 'sine', gain = 0.2, attack = 0.005, slide = null, delay = 0, dest = null, verb = 0.15, detune = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx);
    if (verb) { const s = ctx.createGain(); s.gain.value = verb; g.connect(s); s.connect(this.verb); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  noiseBurst(dur = 0.2, { gain = 0.2, freq = 1200, q = 1, type = 'bandpass', slide = null, delay = 0, attack = 0.005, dest = null } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfx);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  // ---------- UI ----------
  click() { this.tone(880, 0.06, { type: 'triangle', gain: 0.08, verb: 0 }); }
  hover() { this.tone(1500, 0.03, { type: 'sine', gain: 0.025, verb: 0 }); }
  open() { this.tone(520, 0.12, { type: 'sine', gain: 0.1, slide: 780 }); }
  close() { this.tone(700, 0.1, { type: 'sine', gain: 0.08, slide: 420 }); }
  blip() { this.tone(1200 + Math.random() * 200, 0.025, { type: 'square', gain: 0.012, verb: 0 }); }
  success() { [0, 4, 7, 12].forEach((s, i) => this.tone(523.25 * Math.pow(2, s / 12), 0.35, { type: 'triangle', gain: 0.09, delay: i * 0.07, verb: 0.3 })); }
  fail() { this.tone(220, 0.25, { type: 'sawtooth', gain: 0.05, slide: 150, verb: 0.05 }); }
  discover() { [12, 16, 19, 24].forEach((s, i) => this.tone(659.25 * Math.pow(2, (s - 12) / 12), 0.5, { type: 'sine', gain: 0.07, delay: i * 0.05, verb: 0.5 })); }
  connect() { [0, 7, 12, 19, 24].forEach((s, i) => this.tone(392 * Math.pow(2, s / 12), 0.9, { type: 'sine', gain: 0.06, delay: i * 0.09, verb: 0.7 })); }
  complete() {
    const seq = [0, 4, 7, 12, 7, 12, 16, 19];
    seq.forEach((s, i) => this.tone(392 * Math.pow(2, s / 12), 0.45, { type: i % 2 ? 'triangle' : 'sine', gain: 0.09, delay: i * 0.09, verb: 0.5 }));
    [0, 4, 7].forEach((s) => this.tone(196 * Math.pow(2, s / 12), 1.6, { type: 'sine', gain: 0.06, delay: 0.72, attack: 0.05, verb: 0.6 }));
  }
  levelUp() { [0, 5, 9, 12, 17, 21, 24].forEach((s, i) => this.tone(349.23 * Math.pow(2, s / 12), 0.6, { type: 'triangle', gain: 0.08, delay: i * 0.06, verb: 0.6 })); }
  scan() { this.tone(300, 1.0, { type: 'sine', gain: 0.07, slide: 1800, attack: 0.05, verb: 0.2 }); this.tone(305, 1.0, { type: 'triangle', gain: 0.03, slide: 1810, attack: 0.05 }); }
  step() { this.noiseBurst(0.07, { gain: 0.035, freq: 380 + Math.random() * 200, q: 0.7, type: 'lowpass' }); }

  // ---------- lab foley ----------
  bubble() { this.tone(300 + Math.random() * 500, 0.06, { type: 'sine', gain: 0.05, slide: 900 + Math.random() * 600, verb: 0.05 }); }
  fizz(d = 0.5) { this.noiseBurst(d, { gain: 0.06, freq: 5000, q: 0.5, type: 'highpass' }); }
  pop() { this.tone(900, 0.12, { type: 'square', gain: 0.07, slide: 300 }); this.noiseBurst(0.08, { gain: 0.12, freq: 1500, q: 0.8 }); }
  splash() { this.noiseBurst(0.5, { gain: 0.12, freq: 1600, slide: 300, q: 0.6 }); }
  pour() { this.noiseBurst(0.8, { gain: 0.05, freq: 900, slide: 1400, q: 2 }); }
  whoosh() { this.noiseBurst(0.6, { gain: 0.12, freq: 300, slide: 2400, q: 0.8, attack: 0.15 }); }
  clink() { this.tone(2400, 0.25, { type: 'sine', gain: 0.05, verb: 0.2 }); this.tone(3300, 0.2, { type: 'sine', gain: 0.03 }); }
  geiger() { this.noiseBurst(0.012, { gain: 0.35, freq: 3000, q: 0.4, type: 'highpass', attack: 0.001 }); }
  heartbeat() { this.tone(70, 0.12, { type: 'sine', gain: 0.25, verb: 0 }); this.tone(60, 0.14, { type: 'sine', gain: 0.18, delay: 0.16, verb: 0 }); }
  zap() { this.tone(120, 0.2, { type: 'sawtooth', gain: 0.06, slide: 60 }); this.noiseBurst(0.15, { gain: 0.08, freq: 4000, q: 1 }); }
  bang() { this.noiseBurst(0.8, { gain: 0.3, freq: 200, slide: 60, q: 0.5, type: 'lowpass' }); this.noiseBurst(0.3, { gain: 0.1, freq: 3000, q: 0.5 }); }
  crackle() { for (let i = 0; i < 8; i++) this.noiseBurst(0.03, { gain: 0.08, freq: 3000 + Math.random() * 3000, delay: Math.random() * 0.6 }); }

  /** Continuous sound loops for lab apparatus. */
  loop(kind) {
    if (!this.ctx) return { set() {}, stop() {} };
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(this.sfx);
    let nodes = [];
    if (kind === 'flame' || kind === 'wind' || kind === 'fizz' || kind === 'boil') {
      const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const f = ctx.createBiquadFilter();
      if (kind === 'flame') { f.type = 'lowpass'; f.frequency.value = 600; }
      if (kind === 'wind') { f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6; }
      if (kind === 'fizz') { f.type = 'highpass'; f.frequency.value = 4500; }
      if (kind === 'boil') { f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2; }
      src.connect(f); f.connect(g); src.start(); nodes = [src];
    } else if (kind === 'hum') {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 50;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
      o.connect(f); f.connect(g); o.start(); nodes = [o];
    } else if (kind === 'motor') {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 90;
      o.connect(g); o.start(); nodes = [o];
      return { set(l, f) { g.gain.setTargetAtTime(0.06 * l, ctx.currentTime, 0.05); if (f) o.frequency.setTargetAtTime(f, ctx.currentTime, 0.05); }, stop() { g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); setTimeout(() => o.stop(), 300); } };
    }
    const base = { flame: 0.22, wind: 0.2, fizz: 0.05, boil: 0.08, hum: 0.04 }[kind] || 0.1;
    return {
      set(level) { g.gain.setTargetAtTime(Math.max(0.0001, base * level), ctx.currentTime, 0.08); },
      stop() { g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08); setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch { /* */ } }), 400); },
    };
  }

  /** A continuous sine tone used by the sound experiment. */
  signal() {
    if (!this.ctx) return { set() {}, stop() {} };
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 440;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    o.connect(g); g.connect(this.sfx); o.start();
    return {
      set(freq, amp) { o.frequency.setTargetAtTime(freq, ctx.currentTime, 0.02); g.gain.setTargetAtTime(Math.max(0.0001, amp * 0.25), ctx.currentTime, 0.03); },
      stop() { g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03); setTimeout(() => { try { o.stop(); } catch { /* */ } }, 200); },
    };
  }

  // ---------- ambience ----------
  _startAmbience() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; const lg = ctx.createGain(); lg.gain.value = 0.035;
    lfo.connect(lg); lg.connect(g.gain); lfo.start();
    src.connect(f); f.connect(g); g.connect(this.amb); src.start();
    this.oceanGain = g;
    this._birdTimer = setInterval(() => {
      if (!this.ctx || this.mood !== 'world' || this._night) return;
      if (Math.random() < 0.45) {
        const base = 2200 + Math.random() * 1800;
        const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) this.tone(base, 0.09, { type: 'sine', gain: 0.018, slide: base * (1.2 + Math.random() * 0.4), delay: i * 0.12, dest: this.amb, verb: 0.3 });
      }
    }, 2600);
  }
  setAmbience({ ocean = 1, night = false } = {}) {
    this._night = night;
    if (this.oceanGain && this.ctx) this.oceanGain.gain.setTargetAtTime(0.05 * ocean, this.ctx.currentTime, 0.5);
  }

  // ---------- generative music ----------
  startMusic() {
    this._wantMusic = true;
    if (!this.ctx || this._musicOn) return;
    this._musicOn = true;
    const ctx = this.ctx;
    const prog = [ // F major-ish dreamy progression (MIDI)
      [53, 60, 64, 69], [50, 57, 60, 65], [46, 53, 57, 62], [48, 55, 60, 64],
      [53, 57, 60, 67], [50, 57, 62, 65], [46, 50, 57, 62], [48, 52, 55, 62],
    ];
    const scale = [0, 2, 4, 7, 9];
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    let bar = 0, next = ctx.currentTime + 0.2;
    const schedule = () => {
      if (!this._musicOn) return;
      const bpm = this.mood === 'lab' ? 84 : this.mood === 'night' ? 60 : 70;
      const barLen = (60 / bpm) * 4;
      while (next < ctx.currentTime + 1.2) {
        const chord = prog[bar % prog.length];
        // pad
        for (const m of chord) {
          const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
          o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = (Math.random() - 0.5) * 12;
          f.type = 'lowpass'; f.frequency.value = this.mood === 'night' ? 700 : 1100;
          g.gain.setValueAtTime(0.0001, next); g.gain.exponentialRampToValueAtTime(0.028, next + barLen * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, next + barLen * 1.05);
          o.connect(f); f.connect(g); g.connect(this.music); const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(this.verb);
          o.start(next); o.stop(next + barLen * 1.1);
        }
        // bass
        { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = mtof(chord[0] - 12);
          g.gain.setValueAtTime(0.0001, next); g.gain.exponentialRampToValueAtTime(0.05, next + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, next + barLen * 0.9);
          o.connect(g); g.connect(this.music); o.start(next); o.stop(next + barLen); }
        // sparkly arpeggio
        const steps = 8, sl = barLen / steps;
        for (let i = 0; i < steps; i++) {
          if (Math.random() < (this.mood === 'lab' ? 0.5 : 0.36)) {
            const root = chord[0] + 12 + (Math.random() < 0.5 ? 12 : 0);
            const m = root + scale[Math.floor(Math.random() * scale.length)];
            const t = next + i * sl;
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.type = 'sine'; o.frequency.value = mtof(m);
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.022, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + sl * 3);
            o.connect(g); g.connect(this.music); const s = ctx.createGain(); s.gain.value = 0.8; g.connect(s); s.connect(this.verb);
            o.start(t); o.stop(t + sl * 3.2);
          }
        }
        next += barLen; bar++;
      }
      this._musicTimer = setTimeout(schedule, 300);
    };
    schedule();
  }
  stopMusic() { this._wantMusic = false; this._musicOn = false; clearTimeout(this._musicTimer); }
  setMood(m) { this.mood = m; }
}

export const audio = new AudioSys();
