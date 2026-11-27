import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { beaker, Thermometer, Bubbles, mesh, mat, dropperBottle } from '../apparatus.js';
import { h, clear } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const RX = [
  { id: 'neut', name: 'Sodium hydroxide + hydrochloric acid', dT: 6.8, tau: 3, color: '#f1f5f9', exo: true, eq: 'NaOH + HCl → NaCl + H₂O' },
  { id: 'mg', name: 'Magnesium ribbon + hydrochloric acid', dT: 14, tau: 8, color: '#f1f5f9', exo: true, fizz: true, eq: 'Mg + 2HCl → MgCl₂ + H₂' },
  { id: 'disp', name: 'Zinc powder + copper(II) sulfate', dT: 9, tau: 6, color: '#38bdf8', to: '#e2e8f0', exo: true, eq: 'Zn + CuSO₄ → ZnSO₄ + Cu' },
  { id: 'warm', name: 'Hand warmer (iron powder + salt + air)', dT: 22, tau: 25, color: '#57534e', exo: true, eq: 'iron + oxygen → iron oxide' },
  { id: 'nh4', name: 'Ammonium nitrate dissolving in water', dT: -7.5, tau: 4, color: '#f8fafc', exo: false, eq: 'NH₄NO₃(s) → NH₄NO₃(aq)' },
  { id: 'citric', name: 'Citric acid + sodium hydrogencarbonate', dT: -4.5, tau: 5, color: '#fef9c3', exo: false, fizz: true, eq: 'acid + hydrogencarbonate → salt + water + CO₂' },
];
const CHANGES = [['Melting chocolate', 'physical'], ['Burning wood', 'chemical'], ['Dissolving sugar in tea', 'physical'], ['Iron rusting', 'chemical'], ['Boiling water', 'physical'], ['Frying an egg', 'chemical']];

export default class Energetics extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Sam wants self-heating coffee cans and Dr. Chen wants instant cold packs. Measure which reactions release energy and which take it in.';
    this.view = { pos: [0, 1.48, 1.05], target: [0, 1.04, 0] };
    this.rx = RX[0]; this.T0 = 21; this.T = 21; this.running = false; this.t = 0; this.exoDone = false; this.endoDone = false; this.sorted = {};
  }
  build() {
    const Y = this.Y;
    const outer = beaker({ r: 0.06, h: 0.12, color: '#ffffff', level: 0 }); this.lab.add(outer, -0.05, Y, 0);
    this.cup = mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.11, 24, 1, true), mat('#f8fafc', 0, 0.9)); this.cup.material.side = THREE.DoubleSide; this.lab.add(this.cup, -0.05, Y + 0.062, 0);
    this.liq = beaker({ r: 0.043, h: 0.1, color: this.rx.color, level: 0.55, opacity: 0.9 }); this.liq.glass.visible = false; this.lab.add(this.liq, -0.05, Y + 0.01, 0);
    this.lab.label(this.cup, 'Polystyrene cup (insulated)', { y: 0.1 });
    this.th = new Thermometer(0.25, -10, 50); this.lab.add(this.th, -0.03, Y + 0.02, 0.01); this.th.rotation.z = -0.12;
    this.bub = new Bubbles({ r: 0.03, y0: 0.01, y1: 0.05, size: 0.002 }); this.liq.add(this.bub);
    this.tempLabel = this.lab.label(this.cup, '21.0 °C', { y: 0.2, cls: 'big val' });
    ['Acid', 'Alkali', 'Salt', 'Metal'].forEach((n, i) => this.lab.add(dropperBottle(n, ['#fde68a', '#bfdbfe', '#f8fafc', '#94a3b8'][i]), 0.12 + i * 0.07, Y, -0.08));
    const ui = this.ui;
    this.st = ui.steps(['Run an **exothermic** reaction', 'Run an **endothermic** reaction', 'Read the **reaction pathway diagram**', 'Sort changes into **physical** and **chemical**', 'Answer the analysis questions']);
    const sec = ui.section('Reaction');
    ui.select({ label: 'Mix', options: RX.map((r) => [r.id, r.name]), value: this.rx.id, parent: sec, onChange: (v) => { this.rx = RX.find((r) => r.id === v); this.reset(); } });
    ui.buttons([{ label: '▶ Mix and stir', kind: 'primary', onClick: () => this.start() }, { label: '⟲ Fresh cup', onClick: () => this.reset() }], sec);
    this.ro = ui.readouts([{ id: 'T', label: 'Temperature', unit: '°C' }, { id: 'dT', label: 'Change ΔT', unit: '°C' }, { id: 'k', label: 'Type' }], sec);
    this.graph = ui.graph({ x: { label: 'Time / s', min: 0, max: 60 }, y: { label: 'Temperature / °C', min: 5, max: 50 }, series: [{ name: 'temperature', color: '#f97316', line: true, points: false }] }, sec);
    const ps = ui.section('Reaction pathway diagram');
    this.pdCanvas = h('canvas', { width: 680, height: 300, class: 'graph', style: { height: '160px' } }); ps.append(this.pdCanvas);
    const ss = ui.section('Physical or chemical change?');
    this.sortBox = h('div'); ss.append(this.sortBox); this.drawSort();
    ui.notes();
    ui.questions([
      { q: 'Which type of reaction makes the temperature of the surroundings **rise**?', opts: ['Exothermic', 'Endothermic', 'Neither', 'Only physical changes'], e: 'Exothermic reactions transfer thermal energy to the surroundings.', o: [1], sub: 'C5.1' },
      { q: 'Dissolving ammonium nitrate has ΔH that is…', opts: ['positive (endothermic)', 'negative (exothermic)', 'zero', 'impossible to know'], e: 'Energy is taken in, so the solution cools: ΔH > 0.', o: [4], sub: 'C5.1' },
      { q: 'Breaking chemical bonds is…', opts: ['endothermic — it needs energy', 'exothermic — it releases energy', 'neither', 'only possible with a catalyst'], e: 'Bond breaking takes in energy; bond making releases it. The balance gives ΔH.', o: [7], sub: 'C5.1' },
      { q: 'On a pathway diagram, the activation energy is…', opts: ['the energy from reactants up to the top of the hump', 'the gap between reactants and products', 'the energy of the products', 'the total energy released'], e: 'Ea is the minimum energy colliding particles need to react.', o: [3, 5], sub: 'C5.1' },
      { q: 'Your hand warmer started at 21.0 °C and peaked at 43.0 °C. What was ΔT?', ans: 22, tol: 0.01, unit: '°C', e: '43.0 − 21.0 = 22.0 °C.', o: [1], sub: 'C5.1' },
    ], { sub: 'C5.1', onDone: () => { this.st.done(4); this.check(); } });
    this.drawPathway(null);
  }
  reset() { this.running = false; this.t = 0; this.T = this.T0; this.graph.clear(); this.liq.setColor(this.rx.color); this.bub.setRate(0); this.th.set(this.T); this.tempLabel.userData.set(`${this.T.toFixed(1)} °C`); this.ro.set('T', this.T.toFixed(1)); this.ro.set('dT', '0.0'); this.ro.set('k', '—'); }
  start() { this.reset(); this.running = true; audio.pour(); if (this.rx.to) this.liq.setColor(this.rx.to, 5); if (this.rx.fizz) audio.fizz(1); }
  update(dt) {
    this.liq.update(dt); this.bub.update(dt);
    if (!this.running) return;
    const k = 3; this.t += dt * k;
    const rx = this.rx;
    const target = this.T0 + rx.dT * (1 - Math.exp(-this.t / rx.tau)) - (rx.dT * 0.012 * Math.max(0, this.t - rx.tau * 2));
    this.T = target; this.th.set(this.T);
    this.bub.setRate(rx.fizz ? Math.max(0, 25 * Math.exp(-this.t / rx.tau)) : 0);
    this.tempLabel.userData.set(`${this.T.toFixed(1)} °C`);
    this.ro.set('T', this.T.toFixed(1)); this.ro.set('dT', (this.T - this.T0 >= 0 ? '+' : '') + (this.T - this.T0).toFixed(1)); this.ro.set('k', rx.exo ? 'exothermic' : 'endothermic');
    this._g = (this._g || 0) + dt; if (this._g > 0.1) { this._g = 0; this.graph.add(0, this.t, this.T); }
    if (this.t > 60) {
      this.running = false; this.bub.setRate(0);
      const peak = this.T0 + rx.dT;
      this.ui.note(`${rx.name}: ${rx.exo ? 'temperature rose' : 'temperature fell'} by about **${Math.abs(rx.dT).toFixed(1)} °C** — **${rx.exo ? 'exothermic' : 'endothermic'}**. ${rx.eq}`, 'gold');
      if (rx.exo) this.exoDone = true; else this.endoDone = true;
      if (rx.exo) this.st.done(0); else this.st.done(1);
      this.drawPathway(rx);
      if (this.exoDone && this.endoDone) this.st.done(2);
      this.check(); void peak;
    }
  }
  drawPathway(rx) {
    const c = this.pdCanvas, ctx = c.getContext('2d'), W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(60, 20); ctx.lineTo(60, H - 30); ctx.lineTo(W - 20, H - 30); ctx.stroke();
    ctx.fillStyle = '#cbd5e1'; ctx.font = '600 18px Inter'; ctx.save(); ctx.translate(30, H / 2 + 30); ctx.rotate(-Math.PI / 2); ctx.fillText('Energy', 0, 0); ctx.restore(); ctx.fillText('Progress of reaction', W / 2 - 80, H - 6);
    if (!rx) { ctx.fillText('Run a reaction to draw its diagram', W / 2 - 150, H / 2); return; }
    const exo = rx.exo; const yR = exo ? 110 : 190, yP = exo ? 200 : 110, top = 50;
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(80, yR); ctx.lineTo(220, yR); ctx.bezierCurveTo(300, yR, 300, top, 360, top); ctx.bezierCurveTo(420, top, 420, yP, 500, yP); ctx.lineTo(W - 40, yP); ctx.stroke();
    ctx.fillStyle = '#e2e8f0'; ctx.font = '700 18px Inter'; ctx.fillText('Reactants', 90, yR - 10); ctx.fillText('Products', W - 150, yP - 10);
    ctx.strokeStyle = '#5eead4'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(240, yR); ctx.lineTo(240, top); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#5eead4'; ctx.fillText('Ea', 250, (yR + top) / 2);
    ctx.strokeStyle = exo ? '#f87171' : '#60a5fa'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(560, yR); ctx.lineTo(560, yP); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(552, yP + (exo ? -10 : 10)); ctx.lineTo(560, yP); ctx.lineTo(568, yP + (exo ? -10 : 10)); ctx.stroke();
    ctx.fillStyle = exo ? '#f87171' : '#60a5fa'; ctx.fillText(`ΔH ${exo ? '< 0 (exothermic)' : '> 0 (endothermic)'}`, 575, (yR + yP) / 2);
  }
  drawSort() {
    clear(this.sortBox);
    for (const [name, ans] of CHANGES) {
      const cur = this.sorted[name];
      const row = h('div', { class: 'row', style: { margin: '4px 0', justifyContent: 'space-between' } }, h('span', { style: { fontSize: '.88em' } }, `${cur ? (cur === ans ? '✅' : '❌') : '•'} ${name}`),
        h('div', { class: 'row', style: { gap: '4px' } }, ...['physical', 'chemical'].map((k) => h('button', { class: `btn tiny ${cur === k ? (k === ans ? 'good' : 'danger') : ''}`, onClick: () => { this.sorted[name] = k; audio.click(); this.drawSort(); if (CHANGES.every(([n, a]) => this.sorted[n] === a)) { this.st.done(3); this.ui.note('Physical changes are easily reversed and make no new substance; chemical changes make new substances.', 'gold'); this.check(); } } }, k))));
      this.sortBox.append(row);
    }
  }
  check() { this.st.check(); }
}
