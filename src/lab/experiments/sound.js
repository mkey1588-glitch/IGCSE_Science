import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { Stopwatch, mesh, mat, M, glassMaterial } from '../apparatus.js';
import { h, clamp, canvasTex } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const WALL = 85; // metres to the wall for the echo method

export default class Sound extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Tomas is tuning the festival stage speakers, and the clinic’s new ultrasound scanner has arrived. See sound on an oscilloscope, prove it needs a medium, and time an echo to measure its speed.';
    this.view = { pos: [0, 1.38, 1.0], target: [0, 1.08, 0] };
    this.logF = Math.log10(440); this.amp = 0.5; this.on = false; this.air = 1; this.seen = new Set(); this.claps = null;
  }
  get f() { return Math.round(10 ** this.logF); }
  build() {
    const Y = this.Y;
    // speaker
    const spk = new THREE.Group(); this.lab.add(spk, -0.3, Y, 0);
    spk.add(mesh(new THREE.BoxGeometry(0.12, 0.18, 0.1), mat('#1f2937', 0.2, 0.6), 0, 0.09, 0));
    this.cone = mesh(new THREE.ConeGeometry(0.04, 0.03, 24, 1, true), mat('#475569', 0.2, 0.6, { side: THREE.DoubleSide }), 0.062, 0.11, 0); this.cone.rotation.z = -Math.PI / 2; spk.add(this.cone);
    this.lab.label(spk, 'Loudspeaker + signal generator', { y: 0.22 });
    // air particles (longitudinal wave)
    const N = 22 * 6; this.parts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.004, 8, 6), mat('#93c5fd', 0, 0.4), N); this.parts.frustumCulled = false; this.lab.add(this.parts, -0.22, Y + 0.11, 0);
    this.pp = []; for (let i = 0; i < 22; i++) for (let j = 0; j < 6; j++) this.pp.push({ x0: i * 0.012, y: (j - 2.5) * 0.014, z: (Math.random() - 0.5) * 0.03 });
    this._o = new THREE.Object3D();
    this.lab.label(this.parts, 'Air particles: compressions & rarefactions', { y: 0.07, x: 0.13, cls: 'dimlab' });
    // oscilloscope
    const cro = new THREE.Group(); this.lab.add(cro, 0.22, Y, -0.05);
    cro.add(mesh(new THREE.BoxGeometry(0.26, 0.17, 0.12), mat('#334155', 0.3, 0.5), 0, 0.085, 0));
    this.scr = canvasTex(512, 320); this.screen = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.125), new THREE.MeshBasicMaterial({ map: this.scr.tex, toneMapped: false })); this.screen.position.set(0, 0.095, 0.0605); cro.add(this.screen);
    this.lab.label(cro, 'Oscilloscope (microphone input)', { y: 0.2 });
    const mic = mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.05, 12), M.dark); mic.rotation.z = Math.PI / 2; this.lab.add(mic, 0.02, Y + 0.11, 0);
    // bell jar
    const jar = new THREE.Group(); this.lab.add(jar, 0.05, Y, 0.2);
    jar.add(mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.01, 24), M.dark, 0, 0.005, 0), mesh(new THREE.SphereGeometry(0.06, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), glassMaterial('#e6f4ff', 0.06, 0.6), 0, 0.09, 0), mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 24, 1, true), glassMaterial('#e6f4ff', 0.06, 0.6), 0, 0.05, 0));
    this.bell = mesh(new THREE.SphereGeometry(0.018, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.brass, 0, 0.05, 0); this.bell.rotation.x = Math.PI; jar.add(this.bell);
    this.hammer = mesh(new THREE.SphereGeometry(0.005, 10, 8), M.steel, 0.022, 0.04, 0); jar.add(this.hammer);
    this.lab.label(jar, 'Electric bell in a bell jar', { y: 0.15, cls: 'dimlab' });
    this.sw = new Stopwatch(); this.lab.add(this.sw, -0.12, Y, 0.2);
    const ui = this.ui;
    this.st = ui.steps(['Change the **pitch** and **loudness** and watch the trace', 'Find the limits of human hearing — and **ultrasound**', 'Pump the air out of the bell jar', 'Time echoes from the sea wall to measure the **speed of sound**', 'Answer the analysis questions']);
    const sec = ui.section('Signal generator');
    ui.slider({ label: 'Frequency (pitch)', min: 1, max: 4.7, step: 0.01, value: this.logF, fmt: (v) => { const f = Math.round(10 ** v); return f >= 1000 ? `${(f / 1000).toFixed(1)} k` : String(f); }, unit: 'Hz', parent: sec, onInput: (v) => { this.logF = v; this.track(); } });
    ui.slider({ label: 'Amplitude (loudness)', min: 0.1, max: 1, step: 0.05, value: this.amp, parent: sec, onInput: (v) => { this.amp = v; this.track(); } });
    ui.buttons([{ label: '🔊 Sound on / off', kind: 'primary', onClick: () => this.toggle() }], sec);
    this.ro = ui.readouts([{ id: 'f', label: 'Frequency', unit: 'Hz' }, { id: 'hear', label: 'Can humans hear it?' }, { id: 'T', label: 'Period', unit: 'ms' }], sec);
    const bj = ui.section('Bell jar');
    ui.slider({ label: 'Air left in the jar', min: 0, max: 100, step: 5, value: 100, unit: '%', parent: bj, onInput: (v) => { this.air = v / 100; if (this.air <= 0.05 && !this.st.isDone(2)) { this.st.done(2); this.ui.note('With the air removed you can still **see** the hammer striking the bell, but you **cannot hear** it: sound needs a **medium** to travel through. (Light still crosses the vacuum.)', 'gold'); this.check(); } } });
    ui.buttons([{ label: '🔔 Ring the bell', onClick: () => { this.ringing = 2; } }], bj);
    const ec = ui.section(`Echo method (sea wall ${WALL} m away)`);
    ui.text('Clap in time with the echoes: each echo arrives just as you clap again. Time **20 claps**.', ec);
    ui.buttons([{ label: '👏 Start clapping', kind: 'primary', onClick: () => this.clap() }], ec);
    this.ro2 = ui.readouts([{ id: 'n', label: 'Claps' }, { id: 't', label: 'Time for 20 claps', unit: 's' }], ec);
    const sp = ui.section('(S) Speed of sound in different materials');
    ui.table(['Material', 'Speed / m/s'], sp).rows.length;
    sp.querySelector('tbody').append(...[['Air', '≈ 340'], ['Water', '≈ 1500'], ['Steel', '≈ 5000']].map(([a, b]) => h('tr', null, h('td', null, a), h('td', null, b))));
    ui.notes();
    this.qs = ui.questions([
      { q: 'Use your echo timing: in 20 claps the sound travels to the wall and back 20 times. Speed = (2 × 85 m × 20) ÷ time. What is it?', ans: () => (this.echoT ? (2 * WALL * 20) / this.echoT : null), tol: 0.03, unit: 'm/s', e: 'v = distance ÷ time = {ans} m/s.', o: [4, 6] },
      { q: 'Making the trace **taller** without changing its spacing makes the sound…', opts: ['louder (bigger amplitude)', 'higher pitched', 'lower pitched', 'faster'], e: 'Amplitude ↔ loudness; frequency ↔ pitch.', o: [5] },
      { q: 'The range of human hearing is about…', opts: ['20 Hz to 20 000 Hz', '2 Hz to 2000 Hz', '200 Hz to 200 000 Hz', '20 kHz to 200 kHz'], e: 'Above 20 kHz is ultrasound — used for scanning unborn babies.', o: [2, 7] },
      { q: '(S) In a sound wave, a **compression** is a region where…', opts: ['the air particles are close together and the pressure is higher', 'the particles are far apart', 'there are no particles', 'the wave is transverse'], e: 'Rarefactions are low-pressure regions where particles are spread out.', o: [8, 9] },
      { q: '(S) Sound travels fastest in…', opts: ['solids', 'liquids', 'gases', 'a vacuum'], e: 'Particles are closest and most strongly linked in solids. It cannot travel in a vacuum at all.', o: [10] },
    ], { sub: 'P3.4', onDone: () => { this.st.done(4); this.check(); } });
    this.track();
    this.every((dt, t) => this.sim(dt, t));
  }
  toggle() {
    this.on = !this.on;
    if (this.on) { this.sig = this.sig || audio.signal(); this.track(); } else this.sig?.set(this.f, 0);
  }
  track() {
    const f = this.f; this.ro.set('f', f); this.ro.set('T', (1000 / f).toFixed(f > 1000 ? 3 : 1));
    const hear = f < 20 ? 'No — infrasound' : f > 20000 ? 'No — ultrasound' : 'Yes';
    this.ro.set('hear', hear);
    if (this.on) this.sig?.set(Math.min(f, 18000), f > 20000 || f < 20 ? 0 : this.amp * 0.6);
    this.seen.add(`f${Math.round(this.logF * 2)}`); this.seen.add(`a${Math.round(this.amp * 4)}`);
    if (this.seen.size > 6 && !this.st.isDone(0)) { this.st.done(0); this.ui.note('**Higher frequency** → waves closer together on the screen → **higher pitch**. **Bigger amplitude** → taller trace → **louder**.', 'gold'); }
    if (f > 20000) { this.ult = true; } if (f < 25) this.low = true;
    if (this.ult && this.low && !this.st.isDone(1)) { this.st.done(1); this.ui.note('Humans hear roughly **20 Hz to 20 kHz**. Above 20 kHz is **ultrasound** — bats, dolphins and medical scanners use it.', 'gold'); }
    this.check();
  }
  clap() {
    if (this.claps) return;
    this.claps = { n: 0, t: 0, next: 0, period: (2 * WALL) / 340 };
    audio.click();
  }
  sim(dt, t) {
    const f = this.f, A = this.amp;
    // cone + particles
    const visF = Math.min(f, 6) * 0.5 + 0.8, k = 2 * Math.PI / 0.09;
    this.cone.position.x = 0.062 + Math.sin(t * visF * Math.PI * 2) * 0.003 * A;
    this.pp.forEach((p, i) => { const dx = Math.sin(k * p.x0 - t * visF * Math.PI * 2) * 0.005 * A; this._o.position.set(p.x0 + dx, p.y, p.z); this._o.updateMatrix(); this.parts.setMatrixAt(i, this._o.matrix); });
    this.parts.instanceMatrix.needsUpdate = true;
    // scope trace
    this.scr.redraw((ctx, W, H) => {
      ctx.fillStyle = '#04130c'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(74,222,128,.18)'; ctx.lineWidth = 1; for (let x = 0; x <= W; x += W / 10) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y <= H; y += H / 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 3; ctx.beginPath();
      const cycles = clamp(1.5 * Math.log10(f / 5), 0.6, 14);
      for (let x = 0; x <= W; x += 2) { const y = H / 2 - Math.sin((x / W) * cycles * Math.PI * 2 + t * 3) * A * H * 0.4 * (this.on || true ? 1 : 0); if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke(); ctx.fillStyle = '#86efac'; ctx.font = '600 20px monospace'; ctx.fillText(`${f >= 1000 ? (f / 1000).toFixed(1) + ' kHz' : f + ' Hz'}`, 12, 26);
    });
    // bell
    if (this.ringing > 0) { this.ringing -= dt; this.hammer.position.x = 0.022 + Math.abs(Math.sin(t * 60)) * 0.004; this._rt = (this._rt || 0) + dt; if (this._rt > 0.07) { this._rt = 0; if (this.air > 0.05) audio.tone(1800 + Math.random() * 60, 0.05, { type: 'triangle', gain: 0.04 * this.air * this.air }); } }
    // echoes
    const c = this.claps;
    if (c) {
      c.t += dt; this.sw.set(c.t);
      if (c.t >= c.next) { c.n++; c.next += c.period; audio.tone(220, 0.05, { type: 'square', gain: 0.05 }); audio.tone(220, 0.05, { type: 'square', gain: 0.015, delay: Math.min(0.45, c.period * 0.98) }); this.ro2.set('n', c.n); }
      if (c.n >= 21) { this.echoT = +(c.period * 20 * (1 + (Math.random() - 0.5) * 0.02)).toFixed(2); this.ro2.set('t', this.echoT.toFixed(2)); this.claps = null; this.st.done(3); this.ui.note(`20 claps took **${this.echoT.toFixed(2)} s**. Each interval the sound went to the wall and back: 2 × ${WALL} m.`, 'gold'); this.check(); }
    }
  }
  check() { this.st.check(); }
  dispose() { this.sig?.stop(); super.dispose(); }
}
