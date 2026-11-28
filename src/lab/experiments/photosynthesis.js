import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { Lamp, beaker, boilingTube, stand, Thermometer, Bubbles, testTube, mesh, mat, M } from '../apparatus.js';
import { canvasTex, clamp, tweens } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const CO2 = { 0: 'none', 0.5: 'low', 1: 'medium', 2: 'high' };
const GRAPH_T = 25; // °C: the light/CO₂ graph only compares counts made at this temperature
const tFactor = (T) => (T >= 45 ? 0.08 : T <= 30 ? Math.exp(-(((T - 30) / 14) ** 2)) : Math.exp(-(((T - 30) / 8) ** 2)));

export default class Photosynthesis extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Ravi’s greenhouse tomatoes are pale and slow. Pondweed gives off bubbles of oxygen as it photosynthesises — use them to find what limits growth.';
    this.view = { pos: [0.02, 1.52, 1.28], target: [0.02, 1.0, 0] };
    this.d = 15; this.C = 1; this.T = 25; this.trials = []; this.counting = null;
  }
  /** Bubble rate for a set of conditions (defaults to the current control settings). */
  rate({ d = this.d, C = this.C, T = this.T } = {}) {
    const L = (10 / d) ** 2;
    const lightLim = 70 * L, co2Lim = 8 + 40 * C;
    return { r: tFactor(T) * Math.min(lightLim, co2Lim), limit: tFactor(T) < 0.55 ? 'temperature' : lightLim < co2Lim ? 'light intensity' : 'CO₂ concentration', L };
  }
  build() {
    const Y = this.Y;
    this.bk = beaker({ r: 0.07, h: 0.16, color: '#dbeafe', level: 0.75, opacity: 0.3 }); this.lab.add(this.bk, 0, Y, 0);
    this.lab.label(this.bk, 'Water bath beaker', { y: 0.2, cls: 'dimlab' });
    const st = stand(0.42); this.lab.add(st, 0.07, Y, -0.03); st.clamp(0.25, 0.1);
    this.tube = boilingTube({ r: 0.018, h: 0.2, color: '#d9f99d', level: 0.85, opacity: 0.35 }); this.lab.add(this.tube, 0, Y + 0.02, 0);
    // pondweed
    const weed = new THREE.Group(); weed.position.set(0, 0.012, 0); this.tube.add(weed);
    const green = mat('#16a34a', 0, 0.6);
    weed.add(mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.11, 6), green, 0, 0.055, 0));
    for (let k = 0; k < 7; k++) for (let j = 0; j < 4; j++) { const lf = mesh(new THREE.SphereGeometry(0.006, 6, 4), green); lf.scale.set(1.6, 0.25, 0.6); const a = (j / 4) * Math.PI * 2 + k; lf.position.set(Math.cos(a) * 0.006, 0.015 + k * 0.013, Math.sin(a) * 0.006); lf.rotation.y = -a; weed.add(lf); }
    this.bub = new Bubbles({ r: 0.002, y0: 0.122, y1: 0.16, size: 0.0022, rate: 0, sound: true }); this.bub.source = [0, 0]; this.tube.add(this.bub);
    this.bub.position.y = 0;
    this.th = new Thermometer(0.2); this.lab.add(this.th, -0.045, Y + 0.01, 0.02); this.th.rotation.z = -0.15;
    this.lamp = new Lamp(); this.lamp.rotation.y = -Math.PI / 2; this.lab.add(this.lamp, -this.d * 0.008 - 0.02, Y, 0);
    this.lab.draggable(this.lamp, { axis: 'x', min: -0.42, max: -0.1, tip: 'Drag the lamp closer or further away', enabled: () => !this.counting, onMove: (p) => { this.d = clamp(Math.round((-p.x - 0.02) / 0.008), 10, 50); this.dS.set(this.d); this.applyLight(); } });
    this.lab.label(this.lamp, 'Lamp (drag me)', { y: 0.3 });
    // indicator tubes
    this.ind = [['Light', 'light'], ['Dark', 'dark'], ['No plant', 'control']].map(([name, kind], i) => {
      const t = testTube({ color: '#dc2626', level: 0.7, opacity: 0.85 }); this.lab.add(t, 0.16 + i * 0.045, Y, 0.1);
      if (kind !== 'control') { const w = mesh(new THREE.CylinderGeometry(0.001, 0.001, 0.07, 4), green, 0, 0.04, 0); t.add(w); }
      if (kind === 'dark') { const foil = mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.11, 14, 1, true), mat('#cbd5e1', 0.9, 0.2)); foil.position.y = 0.06; t.add(foil); }
      this.lab.label(t, name, { y: 0.16 + (i % 2) * 0.025, cls: 'dimlab' });
      return { t, kind };
    });
    // leaves for starch test
    this.leaves = ['variegated', 'foil', 'noCO2'].map((kind, i) => {
      const ct = canvasTex(256, 160);
      const m = mesh(new THREE.PlaneGeometry(0.08, 0.05), new THREE.MeshStandardMaterial({ map: ct.tex, transparent: true, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; this.lab.add(m, -0.28 + i * 0.09, Y + 0.004, 0.14);
      const lf = { m, ct, kind, stage: 'fresh' }; this.drawLeaf(lf); return lf;
    });
    this.lab.label(this.leaves[1].m, 'Leaves: variegated · foil strip · no CO₂', { y: 0.05 });
    const ui = this.ui;
    this.st = ui.steps(['Count bubbles with the lamp **close** to the pondweed', 'Count at **four or more** lamp distances (same CO₂, 25 °C)', 'Change only the **CO₂** (sodium hydrogencarbonate): count again at the **same lamp distance and temperature**', 'Run the **hydrogencarbonate indicator** test', 'Do the **leaf starch** test', 'Answer the analysis questions']);
    const sec = ui.section('Limiting factors');
    // changes made while a count runs apply to the next count; the controls are locked meanwhile
    this.dS = ui.slider({ label: 'Lamp distance', min: 10, max: 50, step: 1, value: this.d, unit: 'cm', parent: sec, onInput: (v) => { this.d = v; this.lamp.position.x = -v * 0.008 - 0.02; this.applyLight(); } });
    this.co2Seg = ui.seg({ label: 'CO₂ (sodium hydrogencarbonate)', options: [[0, 'None'], [0.5, 'Low'], [1, 'Medium'], [2, 'High']], value: 1, parent: sec, onChange: (v) => { this.C = +v; } });
    this.tS = ui.slider({ label: 'Water temperature', min: 10, max: 45, step: 5, value: this.T, unit: '°C', parent: sec, onInput: (v) => { this.T = v; this.th.set(v); } });
    [this.countBtn] = ui.buttons([{ label: '⏱ Count bubbles for 1 minute', kind: 'primary', onClick: () => this.count() }], sec);
    this.ro = ui.readouts([{ id: 'L', label: 'Light (rel.)' }, { id: 'r', label: 'Bubbles/min' }, { id: 'lim', label: 'Limiting' }], sec);
    const res = ui.section('Results');
    this.tbl = ui.table(['d /cm', 'Light 1/d²', 'CO₂', 'T °C', 'Bubbles/min'], res);
    this.graph = ui.graph({ x: { label: 'Light intensity (relative, 1/d²)', min: 0, max: 1.05 }, y: { label: `Bubbles per minute at ${GRAPH_T} °C`, min: 0, max: 80 }, series: [{ name: 'none', color: '#94a3b8', line: true }, { name: 'low', color: '#60a5fa', line: true }, { name: 'medium', color: '#4ade80', line: true }, { name: 'high', color: '#facc15', line: true }] }, res);
    const other = ui.section('Gas exchange & starch');
    ui.buttons([{ label: '🧪 Leave indicator tubes 1 hour', onClick: () => this.runIndicator() }, { label: '🍃 Test leaves for starch', onClick: () => this.leafTest() }], other);
    ui.text('Hydrogencarbonate indicator: **yellow** = more CO₂, **red** = normal, **purple** = less CO₂.', other);
    ui.notes();
    ui.questions([
      { q: 'Moving the lamp closer raised the bubble rate — until it levelled off. Why did it level off?', opts: ['Another factor, such as CO₂ concentration, became limiting', 'The pondweed ran out of chlorophyll', 'Light stopped reaching the plant', 'The bubbles became too big to count'], e: 'When light is plentiful, the factor in shortest supply (CO₂ or temperature) limits the rate.', o: [9], sub: 'B6.1' },
      { q: 'Light intensity ∝ 1/d². Moving the lamp from 10 cm to 20 cm changes the light intensity to what **fraction** of its value?', ans: 0.25, tol: 0.01, e: '(10/20)² = 1/4 = 0.25.', o: [9], sub: 'B6.1' },
      { q: 'Why did the indicator around the pondweed **in the dark** turn yellow?', opts: ['Only respiration happened, releasing CO₂', 'The foil reacted with the indicator', 'Photosynthesis removed CO₂', 'The plant died immediately'], e: 'In the dark, plants respire but cannot photosynthesise, so CO₂ builds up.', o: [10], sub: 'B6.1' },
      { q: 'The white parts of the variegated leaf stayed orange-brown with iodine because…', opts: ['they have no chlorophyll, so no photosynthesis made starch there', 'they had too much light', 'iodine cannot reach them', 'they store sugar instead'], e: 'This shows chlorophyll is needed for photosynthesis.', o: [3, 4], sub: 'B6.1' },
      { q: 'The bubbles given off by the pondweed are mostly…', opts: ['oxygen', 'carbon dioxide', 'nitrogen', 'water vapour'], e: 'Oxygen is a product of photosynthesis.', o: [1, 2], sub: 'B6.1' },
    ], { sub: 'B6.1', onDone: () => { this.st.done(5); this.check(); } });
    this.applyLight();
  }
  applyLight() { const L = (10 / this.d) ** 2; this.lamp.set(clamp(0.3 + L * 0.7, 0.3, 1.0)); }
  lockControls(on) { this.dS.disable(on); this.co2Seg.disable(on); this.tS.disable(on); this.countBtn.disabled = on; }
  /** One trial: its conditions are fixed when the count starts, and its row, plot point and steps use them. */
  count() {
    if (this.counting) return;
    const trial = { d: this.d, C: this.C, T: this.T };
    Object.assign(trial, this.rate(trial));
    this.counting = trial;
    this.lockControls(true);
    const n = Math.max(0, Math.round(trial.r + (Math.random() - 0.5) * 2));
    let shown = 0;
    this.ui.hint(`⏱ Counting bubbles for one minute at ${trial.d} cm, ${CO2[trial.C]} CO₂, ${trial.T} °C…`);
    tweens.tween(5, (e) => { const k = Math.floor(n * e); if (k > shown) { shown = k; this.ro.set('r', k); } }).promise.then(() => {
      if (this.counting !== trial) return; // the experiment was reset or closed meanwhile
      this.counting = null; this.lockControls(false); this.ui.hint('');
      this.ro.set('r', n);
      this.tbl.add([trial.d, trial.L.toFixed(3), CO2[trial.C], trial.T, n]);
      // the graph compares counts under matching conditions: one line per CO₂ level, all at the same temperature
      if (trial.T === GRAPH_T) {
        this.graph.add({ 0: 0, 0.5: 1, 1: 2, 2: 3 }[trial.C], trial.L, n);
        this.graph.series.forEach((s) => s.data.sort((a, b) => a[0] - b[0])); this.graph.draw();
      }
      this.ui.note(`d = ${trial.d} cm, CO₂ ${CO2[trial.C]}, ${trial.T} °C → **${n} bubbles/min** (limited by ${trial.limit}).${trial.T === GRAPH_T ? '' : ` Not plotted: the graph compares counts at ${GRAPH_T} °C.`}`);
      trial.n = n;
      this.trials.push(trial);
      this.compare(trial);
    });
  }
  /**
   * Comparisons use only counts that differ in the one variable being investigated. Lamp distances are compared
   * at one CO₂ level, at the graph temperature; CO₂ levels are compared at one lamp distance and temperature.
   */
  compare(trial) {
    if (trial.d <= 12) this.st.done(0);
    const atGraphT = this.trials.filter((t) => t.T === GRAPH_T && t.C === trial.C);
    if (new Set(atGraphT.map((t) => t.d)).size >= 4) this.st.done(1);
    const pair = this.trials.find((t) => t !== trial && t.d === trial.d && t.T === trial.T && t.C !== trial.C);
    if (pair && !this.st.isDone(2)) {
      const [lo, hi] = [pair, trial].sort((a, b) => a.C - b.C);
      this.st.done(2);
      this.ui.note(`Fair CO₂ comparison at ${trial.d} cm and ${trial.T} °C: ${CO2[lo.C]} CO₂ → ${lo.n}, ${CO2[hi.C]} CO₂ → ${hi.n} bubbles/min.${trial.limit === 'light intensity' ? ' Light was the limiting factor here, so extra CO₂ made little difference.' : ''}`, 'gold');
    } else if (!this.st.isDone(2) && this.trials.some((t) => t !== trial && t.C !== trial.C)) {
      this.ui.note('Not a fair CO₂ comparison yet: the lamp distance or temperature changed too. Count again at the **same lamp distance and temperature** as an earlier count, changing only the CO₂.', 'warn');
    }
  }
  runIndicator() {
    const target = { light: '#7e22ce', dark: '#facc15', control: '#dc2626' };
    this.ind.forEach(({ t, kind }) => t.setColor(target[kind], 2.5));
    audio.discover();
    this.ui.note('After an hour: light + pondweed → **purple** (CO₂ used up), dark → **yellow** (CO₂ from respiration), no plant → **red** (no change).', 'gold');
    this.st.done(3); this.check();
  }
  async leafTest() {
    const stages = [['boil', 'Boil in water to kill the cells and soften the leaf…'], ['ethanol', 'Warm in ethanol (in a water bath — no flames!) to remove the chlorophyll…'], ['iodine', 'Rinse and add iodine solution…']];
    for (const [s, msg] of stages) { this.ui.hint(msg); audio.bubble(); this.leaves.forEach((lf) => { lf.stage = s; this.drawLeaf(lf); }); await tweens.tween(1.4, () => {}).promise; }
    this.ui.hint('');
    this.ui.note('Variegated leaf: only the **green** parts turned blue-black. The foil-covered strip and the leaf without CO₂ stayed **orange-brown** — no starch was made.', 'gold');
    this.st.done(4); this.check();
  }
  drawLeaf(lf) {
    lf.ct.redraw((ctx, w, h) => {
      ctx.save(); ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.46, h * 0.42, 0, 0, Math.PI * 2); ctx.clip();
      const stage = lf.stage;
      const base = stage === 'fresh' ? '#22c55e' : stage === 'boil' ? '#15803d' : '#fef3c7';
      ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
      if (lf.kind === 'variegated' && (stage === 'fresh' || stage === 'boil')) { ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.46, h * 0.42, 0, 0, Math.PI * 2); ctx.ellipse(w / 2, h / 2, w * 0.33, h * 0.28, 0, 0, Math.PI * 2, true); ctx.fill('evenodd'); }
      if (lf.kind === 'foil' && stage === 'fresh') { ctx.fillStyle = '#cbd5e1'; ctx.fillRect(w * 0.4, 0, w * 0.2, h); }
      if (stage === 'iodine') {
        const blue = '#1e1b4b', brown = '#c2410c';
        ctx.fillStyle = lf.kind === 'noCO2' ? brown : blue; ctx.fillRect(0, 0, w, h);
        if (lf.kind === 'variegated') { ctx.fillStyle = brown; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.46, h * 0.42, 0, 0, Math.PI * 2); ctx.ellipse(w / 2, h / 2, w * 0.33, h * 0.28, 0, 0, Math.PI * 2, true); ctx.fill('evenodd'); }
        if (lf.kind === 'foil') { ctx.fillStyle = brown; ctx.fillRect(w * 0.4, 0, w * 0.2, h); }
      }
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w * 0.06, h / 2); ctx.lineTo(w * 0.94, h / 2); ctx.stroke();
      ctx.restore();
    });
  }
  check() { this.st.check(); }
  update(dt) {
    const { r, limit, L } = this.rate();
    this.bub.setRate(r / 60 * 6);
    this.bub.update(dt, this.tube.surfaceY());
    this.tube.update(dt); this.bk.update(dt); this.ind.forEach(({ t }) => t.update(dt));
    if (!this.counting) { this.ro.set('L', L.toFixed(2)); this.ro.set('lim', limit); }
  }
}
void M;
