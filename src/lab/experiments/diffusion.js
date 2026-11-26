import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { beaker, Stopwatch, Thermometer, mesh, mat, M } from '../apparatus.js';
import { clamp } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const SIZES = [0.5, 1, 2]; // cm
const S = 0.022; // metres per cm (scaled up for visibility)

export default class Diffusion extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Why are cells so small? Pink agar cubes (alkali + indicator) turn colourless as acid diffuses in. Which size wins the race?';
    this.view = { pos: [0.03, 1.56, 1.3], target: [0.03, 0.99, 0] };
    this.T = 20; this.c = 1; this.running = false; this.clock = 0; this.runs = 0; this.pumps = true;
  }

  build() {
    const Y = this.Y;
    this.bk = beaker({ r: 0.1, h: 0.12, color: '#dbeafe', level: 0.7, opacity: 0.35 });
    this.lab.add(this.bk, -0.2, Y, 0);
    this.lab.label(this.bk, 'Hydrochloric acid', { y: 0.16 });
    const tile = mesh(new THREE.BoxGeometry(0.24, 0.01, 0.1), M.ceramic); this.lab.add(tile, 0.05, Y, 0.06);
    this.lab.label(tile, 'Agar cubes (with indicator)', { y: 0.08 });
    this.cubes = SIZES.map((s, i) => {
      const size = s * S;
      const g = new THREE.Group();
      const outer = mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshPhysicalMaterial({ color: '#fdf2f8', transparent: true, opacity: 0.38, roughness: 0.15 }));
      const core = mesh(new THREE.BoxGeometry(size * 0.97, size * 0.97, size * 0.97), new THREE.MeshStandardMaterial({ color: '#ec4899', roughness: 0.35, emissive: '#9d174d', emissiveIntensity: 0.25 }));
      g.add(core, outer);
      g.userData = { s, size, core, home: new THREE.Vector3(-0.03 + i * 0.07, Y + 0.01 + size / 2, 0.06), tank: new THREE.Vector3(-0.25 + i * 0.05, Y + 0.004 + size / 2, -0.02 + (i % 2) * 0.03), t: 0, done: false };
      g.position.copy(g.userData.home);
      (this.lab.tabRoot || this.root).add(g);
      this.lab.label(g, `${s} cm`, { y: size / 2 + 0.02, cls: 'dimlab' });
      return g;
    });
    this.sw = new Stopwatch(); this.lab.add(this.sw, 0.06, Y, 0.17); this.sw.rotation.x = 0;
    this.th = new Thermometer(0.18); this.lab.add(this.th, -0.15, Y + 0.02, -0.06); this.th.rotation.z = 0.25; this.th.set(this.T);
    this._buildMembrane();

    const ui = this.ui;
    this.st = ui.steps(['Drop the three cubes into the acid and start the stop-watch', 'Record the time for **each** cube to turn colourless', 'Repeat at a different **temperature** or **acid concentration**', 'In the membrane model, switch **respiration off** and watch the ion pumps', 'Answer the analysis questions']);
    const sec = ui.section('Conditions');
    this.tS = ui.slider({ label: 'Acid temperature', min: 10, max: 50, step: 5, value: 20, unit: '°C', parent: sec, onInput: (v) => { this.T = v; this.th.set(v); } });
    this.cS = ui.slider({ label: 'Acid concentration', min: 0.5, max: 2, step: 0.5, value: 1, unit: 'mol/dm³', parent: sec, onInput: (v) => { this.c = v; } });
    ui.buttons([{ label: '▶ Start run', kind: 'primary', onClick: () => this.start() }, { label: '⏩ Speed ×4', onClick: () => { this.fast = !this.fast; } }, { label: '⟲ New cubes', onClick: () => this.resetCubes() }], sec);
    this.ro = ui.readouts([{ id: 't', label: 'Time', unit: 'min' }, { id: 'T', label: 'Temperature', unit: '°C' }, { id: 'c', label: 'Acid', unit: 'M' }], sec);
    const dsec = ui.section('Results');
    this.tbl = ui.table(['Cube', 'SA cm²', 'Vol cm³', 'SA:V', 'Time /min', 'T °C', 'Acid M'], dsec);
    this.graph = ui.graph({ x: { label: 'Surface area : volume ratio', min: 0, max: 13 }, y: { label: 'Time to go colourless / min', min: 0, max: 40 }, series: [{ name: 'runs', color: '#f472b6', points: true }] }, dsec);
    const msec = ui.section('Membrane model — diffusion & active transport');
    ui.text('Blue = oxygen (diffuses freely). Orange = mineral ions, pumped **into** the cell by carrier proteins even though the cell already has more — that needs energy from respiration.', msec);
    ui.seg({ label: 'Respiration in the cell', options: [['on', 'Respiring (ATP made)'], ['off', 'Poisoned — no ATP']], value: 'on', parent: msec, onChange: (v) => { this.pumps = v === 'on'; if (!this.pumps) { this.st.done(3); this.ui.note('With no energy from respiration the carriers stop: ions can no longer move against their concentration gradient.', 'gold'); } } });
    this.mro = ui.readouts([{ id: 'o', label: 'O₂ out : in' }, { id: 'i', label: 'Ions out : in' }], msec);
    ui.notes();
    ui.questions([
      { q: 'Which cube turned colourless first, and why?', opts: ['The smallest — it has the largest surface area to volume ratio and the shortest distance to its centre', 'The largest — it has the most surface area', 'They all took the same time', 'The middle one — it was the most pink'], e: 'Small objects have a large SA:V, so diffusion can reach every part quickly. Cells stay small for the same reason.', o: [3, 4], sub: 'B3.1' },
      { q: 'Calculate the surface area : volume ratio of the **2 cm** cube (give the number x in x : 1).', ans: 3, tol: 0.01, e: 'SA = 6 × 2² = 24 cm², V = 2³ = 8 cm³, so SA:V = 24 ÷ 8 = 3 : 1.', o: [4], sub: 'B3.1' },
      { q: 'Warmer acid decolourised the cubes faster because…', opts: ['particles have more kinetic energy, so they diffuse faster', 'acid gets stronger when hot', 'the agar melts', 'the indicator works better when hot'], e: 'Temperature increases the speed of random particle movement.', o: [4], sub: 'B3.1' },
      { q: 'When respiration was blocked, ions stopped entering the cell. This shows active transport…', opts: ['needs energy from respiration to move particles against a concentration gradient', 'is the same as diffusion', 'only works for oxygen', 'happens faster without energy'], e: 'Active transport moves particles from low to high concentration using carrier proteins and energy.', o: [1, 2], sub: 'B3.3' },
    ], { sub: 'B3.1', onDone: () => { this.st.done(4); this.check(); } });
    this.ro.set('T', this.T); this.ro.set('c', this.c); this.ro.set('t', 0);
  }

  _buildMembrane() {
    const g = new THREE.Group(); this.lab.add(g, 0.25, this.Y + 0.02, -0.12); this.mem = g;
    const W = 0.24, H = 0.16, D = 0.05;
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)), new THREE.LineBasicMaterial({ color: '#94a3b8' })); box.position.y = H / 2; g.add(box);
    const memM = new THREE.MeshStandardMaterial({ color: '#fbbf24', transparent: true, opacity: 0.55, roughness: 0.5 });
    g.add(mesh(new THREE.BoxGeometry(0.008, H, D), memM, 0, H / 2, 0));
    this.pumpMeshes = [0.04, 0.1].map((y) => { const p = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.016, 12), mat('#a855f7', 0.1, 0.4)); p.rotation.z = Math.PI / 2; p.position.set(0, y, 0); g.add(p); return p; });
    this.lab.label(g, 'Outside cell  |  Inside cell', { y: H + 0.03 });
    const geo = new THREE.SphereGeometry(0.0045, 8, 6);
    const oM = new THREE.MeshStandardMaterial({ color: '#60a5fa', emissive: '#1d4ed8', emissiveIntensity: 0.4 }), iM = new THREE.MeshStandardMaterial({ color: '#fb923c', emissive: '#9a3412', emissiveIntensity: 0.4 });
    this.parts = [];
    const add = (type, side, n) => { for (let k = 0; k < n; k++) { const m = new THREE.Mesh(geo, type === 'o' ? oM : iM); const x = side < 0 ? -W / 2 + 0.01 + Math.random() * (W / 2 - 0.02) : 0.01 + Math.random() * (W / 2 - 0.02); m.position.set(x, 0.01 + Math.random() * (H - 0.02), (Math.random() - 0.5) * (D - 0.01)); m.userData = { type, v: new THREE.Vector3() }; g.add(m); this.parts.push(m); } };
    add('o', -1, 34); add('o', 1, 8); add('i', -1, 12); add('i', 1, 20);
    this.memDim = { W, H, D };
  }

  start() {
    if (this.running) return;
    this.resetCubes(true);
    this.running = true; this.clock = 0; this.runT = this.T; this.runC = this.c;
    audio.splash();
    this.cubes.forEach((g) => { g.position.copy(g.userData.tank); });
    this.st.done(0);
    this.ui.note(`Run ${this.runs + 1}: ${this.T} °C, ${this.c} M acid. Watch the pink cores shrink from the outside in.`);
  }
  resetCubes(silent) {
    this.running = false; this.clock = 0;
    this.cubes.forEach((g) => { const u = g.userData; u.done = false; u.core.visible = true; u.core.scale.setScalar(1); g.position.copy(u.home); });
    if (!silent) this.ro.set('t', 0);
  }
  totalTime(s) { return (8 * s * s) / (Math.pow(this.runC, 0.7) * Math.pow(1.035, this.runT - 20)); }

  check() { if ([0, 1, 2, 3, 4].every((i) => this.st.isDone(i))) this.lab.complete(); }

  update(dt, t) {
    this.bk.update(dt);
    if (this.running) {
      this.clock += dt * (this.fast ? 5.2 : 1.3); // simulated minutes
      this.ro.set('t', +this.clock.toFixed(1));
      this.sw.set(this.clock * 60);
      let all = true;
      for (const g of this.cubes) {
        const u = g.userData; if (u.done) continue;
        const T = this.totalTime(u.s);
        const f = clamp(Math.sqrt(this.clock / T), 0, 1);
        u.core.scale.setScalar(Math.max(0.001, 1 - f));
        if (f >= 1) {
          u.done = true; u.core.visible = false; audio.discover();
          const sa = 6 * u.s * u.s, v = u.s ** 3;
          this.tbl.add([`${u.s} cm`, sa.toFixed(1), v.toFixed(3), (sa / v).toFixed(1), T.toFixed(1), this.runT, this.runC]);
          this.graph.add(0, sa / v, T);
          this.ui.note(`The ${u.s} cm cube went colourless after **${T.toFixed(1)} min**.`);
        } else all = false;
      }
      if (all) {
        this.running = false; this.runs++;
        this.st.done(1);
        if (this.runs >= 2 && (this._lastCond && (this._lastCond[0] !== this.runT || this._lastCond[1] !== this.runC))) { this.st.done(2); this.ui.note('Changing the conditions changed every time — compare the rows in your table.', 'gold'); }
        this._lastCond = [this.runT, this.runC];
        this.check();
      }
    }
    // membrane model
    const { W, H, D } = this.memDim; const r = 0.0045;
    let oL = 0, oR = 0, iL = 0, iR = 0;
    for (const p of this.parts) {
      const u = p.userData, pos = p.position;
      u.v.x += (Math.random() - 0.5) * 0.25 * dt * 10; u.v.y += (Math.random() - 0.5) * 0.25 * dt * 10; u.v.z += (Math.random() - 0.5) * 0.1 * dt * 10;
      u.v.clampLength(0, 0.06);
      const ox = pos.x;
      pos.addScaledVector(u.v, dt);
      if (pos.x < -W / 2 + r) { pos.x = -W / 2 + r; u.v.x *= -1; } if (pos.x > W / 2 - r) { pos.x = W / 2 - r; u.v.x *= -1; }
      if (pos.y < r) { pos.y = r; u.v.y *= -1; } if (pos.y > H - r) { pos.y = H - r; u.v.y *= -1; }
      if (Math.abs(pos.z) > D / 2 - r) { pos.z = Math.sign(pos.z) * (D / 2 - r); u.v.z *= -1; }
      const crossed = Math.sign(ox) !== Math.sign(pos.x);
      if (crossed && u.type === 'i') {
        const atPump = this.pumpMeshes.some((m) => Math.abs(pos.y - m.position.y) < 0.012);
        if (this.pumps && atPump && ox < 0) { pos.x = 0.012; u.v.x = 0.03; this._flash = 0.15; }
        else { pos.x = ox; u.v.x *= -1; }
      }
      if (u.type === 'o') { if (pos.x < 0) oL++; else oR++; } else { if (pos.x < 0) iL++; else iR++; }
    }
    // keep pumping occasionally from the outside pool
    if (this.pumps && Math.random() < dt * 0.6) { const c = this.parts.find((p) => p.userData.type === 'i' && p.position.x < -0.01); if (c) { c.position.set(0.012, this.pumpMeshes[Math.random() < 0.5 ? 0 : 1].position.y, 0); c.userData.v.set(0.03, 0, 0); this._flash = 0.15; } }
    this._flash = Math.max(0, (this._flash || 0) - dt);
    for (const m of this.pumpMeshes) m.material.emissive.setRGB(this._flash > 0 && this.pumps ? 1.2 : 0.1, 0.05, this._flash > 0 && this.pumps ? 1.5 : 0.12);
    this.mro.set('o', `${oL} : ${oR}`); this.mro.set('i', `${iL} : ${iR}`);
    void t;
  }
}
