import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { conicalFlask, GasSyringe, Stopwatch, Balance, WaterBath, boilingTube, Bubbles, Puffs, ParticleBox, stand, wire, mesh, mat, M } from '../apparatus.js';
import { h, clamp } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const SIZES = { large: { name: 'large chips', sa: 1, n: 5, s: 0.019 }, small: { name: 'small chips', sa: 2.2, n: 14, s: 0.011 }, powder: { name: 'powder', sa: 6, n: 0, s: 0 } };
const COLORS = ['#f97316', '#22d3ee', '#a3e635', '#f472b6', '#facc15', '#a78bfa', '#fb7185', '#34d399'];
const VARS = { size: 'surface area', conc: 'concentration', T: 'temperature', cat: 'catalyst' };

export default class Rates extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Omar’s customers say his indigestion tablets fizz too slowly. Powder or tablet? Warm water or cold? Marble chips and acid make the same gas — time them.';
    this.view = { pos: [-0.1, 1.5, 1.16], target: [-0.1, 1.08, 0] };
    this.rx = 'marble'; this.method = 'syringe'; this.size = 'large'; this.conc = 1; this.T = 20; this.cat = false; this.warp = 10;
    this.runs = []; this.run = null; this.weighed = false; this.catPair = false; this.hits = 0; this.succ = 0; this._acc = 0;
  }

  // ------------------------------------------------------------------ model
  params(p) {
    const tf = Math.pow(2, (p.T - 20) / 10);
    if (p.rx === 'marble') return { Vmax: 96, r0: 0.9 * SIZES[p.size].sa * p.conc * tf, gas: 'CO₂', gPerCm3: 44 / 24000 };
    const catF = p.cat ? 2.4 * (p.size === 'powder' ? 2 : p.size === 'small' ? 1.4 : 1) : 0.045;
    return { Vmax: 48 * p.conc, r0: catF * p.conc * tf, gas: 'O₂', gPerCm3: 32 / 24000 };
  }
  vol(r, t) { return r.Vmax * (1 - Math.exp(-(r.r0 * t) / r.Vmax)); }

  build() {
    const Y = this.Y;
    this.bench = new THREE.Group(); this.lab.add(this.bench, 0, 0, 0);
    // flask + contents
    this.flask = conicalFlask({ rb: 0.06, rn: 0.016, h: 0.15, level: 0.34, color: '#e0f2fe', opacity: 0.55 });
    this.lab.add(this.flask, -0.25, Y, 0.02);
    this.lab.label(this.flask, 'Conical flask', { y: 0.2, cls: 'dimlab' });
    this.bung = mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.022, 16), M.rubber, 0, 0.158, 0); this.flask.add(this.bung);
    this.wool = mesh(new THREE.SphereGeometry(0.016, 12, 10), mat('#f8fafc', 0, 0.95), 0, 0.158, 0); this.wool.scale.set(1, 1.4, 1); this.flask.add(this.wool);
    this.chips = new THREE.Group(); this.flask.add(this.chips);
    this.powder = mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.006, 24), mat('#f1f5f9', 0, 0.95), 0, 0.007, 0); this.flask.add(this.powder);
    this.bub = new Bubbles({ r: 0.045, y0: 0.012, y1: 0.06, size: 0.0024, max: 140 }); this.flask.add(this.bub);
    this.puff = new Puffs({ color: '#ffffff', size: 0.025, rise: 0.05, life: 1.8, opacity: 0.25 }); this.puff.position.y = 0.17; this.flask.add(this.puff);
    // gas syringe on a stand
    this.syrGroup = new THREE.Group(); this.lab.add(this.syrGroup, 0, 0, 0);
    this.syr = new GasSyringe(100); this.syr.position.set(0.09, Y + 0.24, 0.02); this.syrGroup.add(this.syr);
    this.lab.label(this.syr, 'Gas syringe (cm³)', { y: 0.05 });
    const st = stand(0.36); st.position.set(0.3, Y, -0.08); this.syrGroup.add(st);
    const clampArm = mesh(new THREE.BoxGeometry(0.014, 0.014, 0.1), M.steel, 0.2, Y + 0.24, -0.03); this.syrGroup.add(clampArm);
    this.syrGroup.add(wire([[-0.25, Y + 0.165, 0.02], [-0.25, Y + 0.215, 0.02], [-0.23, Y + 0.24, 0.02], [-0.083, Y + 0.24, 0.02]], '#94a3b8', 0.0032));
    // balance (mass-loss method)
    this.bal = new Balance(); this.lab.add(this.bal, -0.25, Y, 0.04);
    this.lab.label(this.bal, 'Balance', { y: 0.075, x: 0.12, cls: 'dimlab' });
    // stop-watch, water bath, collision model
    this.sw = new Stopwatch(); this.lab.add(this.sw, 0.06, Y, 0.18); this.lab.label(this.sw, 'Stop-watch', { y: 0.05, cls: 'dimlab' });
    this.bath = new WaterBath(); this.lab.add(this.bath, -0.52, Y, -0.12); this.bath.set(this.T);
    const acidTube = boilingTube({ color: '#e0f2fe', level: 0.6, opacity: 0.5 }); acidTube.position.set(0.04, 0.06, 0); this.bath.add(acidTube);
    this.lab.label(this.bath, 'Acid warmed in water bath', { y: 0.2, cls: 'dimlab' });
    this.pbHolder = new THREE.Group(); this.lab.add(this.pbHolder, -0.08, Y + 0.33, -0.26);
    this.surface = mesh(new THREE.BoxGeometry(0.008, 0.13, 0.08), new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.9, emissive: '#000000' }), -0.104, 0.068, 0); this.pbHolder.add(this.surface);
    this.lab.label(this.pbHolder, 'Collision model: acid particles hitting the marble surface', { y: 0.17 });
    this.pbBox = new THREE.Group(); this.pbHolder.add(this.pbBox);
    this.lab.interactive(this.flask, { tip: 'Conical flask — press ▶ Start run to add the reactants' });
    this.lab.interactive(this.bath, { tip: 'Water bath — sets the starting temperature of the acid' });

    // ---------------------------------------------------------------- panel
    const ui = this.ui;
    this.st = ui.steps([
      'Do a **baseline run** (e.g. large chips, 1.0 mol/dm³ acid, 20 °C)',
      'Fair test: change only the **surface area** (chip size)',
      'Fair test: change only the **acid concentration**',
      'Fair test: change only the **temperature**',
      'Hydrogen peroxide: compare runs **with and without MnO₂**, then weigh the catalyst',
      'Follow a reaction by **mass loss** on a balance',
      'Answer the analysis questions',
    ]);
    const sec = ui.section('Set up the next run');
    this.rxSeg = ui.seg({ label: 'Reaction', options: [['marble', 'Marble + hydrochloric acid'], ['peroxide', 'Hydrogen peroxide']], value: this.rx, parent: sec, onChange: (v) => { this.rx = v; this.refreshControls(); this.prepFlask(); } });
    this.methodSeg = ui.seg({ label: 'Measure', options: [['syringe', 'Gas volume (syringe)'], ['mass', 'Mass loss (balance)']], value: this.method, parent: sec, onChange: (v) => { this.method = v; this.setMethod(); } });
    this.sizeSeg = ui.seg({ label: 'Particle size', options: [['large', 'Large'], ['small', 'Small'], ['powder', 'Powder']], value: this.size, parent: sec, onChange: (v) => { this.size = v; this.prepFlask(); } });
    this.concSeg = ui.seg({ label: 'Acid concentration (mol/dm³)', options: [[0.5, '0.5'], [1, '1.0'], [2, '2.0']], value: this.conc, parent: sec, onChange: (v) => { this.conc = +v; this.buildModel(); } });
    ui.slider({ label: 'Starting temperature', min: 20, max: 50, step: 5, value: this.T, unit: '°C', parent: sec, onInput: (v) => { this.T = v; this.bath.set(v); this.buildModel(); } });
    this.catSeg = ui.seg({ label: 'Catalyst', options: [[false, 'None'], [true, 'Manganese(IV) oxide, MnO₂']], value: false, parent: sec, onChange: (v) => { this.cat = v === true || v === 'true'; this.prepFlask(); this.buildModel(); } });
    ui.seg({ label: 'Time speed', options: [[1, '1×'], [10, '10×'], [30, '30×']], value: this.warp, parent: sec, onChange: (v) => { this.warp = +v; } });
    ui.buttons([{ label: '▶ Start run', kind: 'primary', onClick: () => this.startRun() }, { label: '⏹ Stop', onClick: () => this.stopRun(true) }, { label: '🗑 Clear graph', onClick: () => this.clearGraph() }], sec);
    this.weighBtn = ui.buttons([{ label: '⚖️ Filter, dry and weigh the MnO₂', onClick: () => this.weighCatalyst() }], sec)[0];
    this.ro = ui.readouts([{ id: 't', label: 'Time', unit: 's' }, { id: 'v', label: 'Gas collected' }, { id: 'r', label: 'Rate now' }, { id: 'c', label: 'Collisions / s' }, { id: 's', label: 'Successful / s' }, { id: 'e', label: 'Particles moving fast enough' }], sec);
    const gsec = ui.section('Results graph');
    this.graph = ui.graph({ x: { label: 'Time / s', min: 0, max: 120 }, y: { label: 'Volume of gas / cm³', min: 0, max: 100 }, series: [], auto: true, height: 200 }, gsec);
    this.table = ui.table(['Run', 'Conditions', 'At 60 s', 'Initial rate', 'Finish / s'], gsec);
    const why = ui.section('Why? Collision theory');
    this.whyBox = h('div', { class: 'muted', style: { fontSize: '.88em', lineHeight: 1.55 } }, 'Reactions happen when particles **collide** with at least the **activation energy**. Watch the model as you change each factor.');
    why.append(this.whyBox);
    const cs = ui.section('How a catalyst works (S)');
    this.pd = h('canvas', { width: 680, height: 280, class: 'graph', style: { height: '150px' } }); cs.append(this.pd); this.drawPathway();
    ui.notes();
    ui.questions([
      { q: 'On a volume–time graph, the **steepest** curve at the start shows…', opts: ['the fastest initial rate of reaction', 'the slowest rate', 'the largest final volume', 'the lowest temperature'], e: 'Rate = gradient. Steeper means more gas per second.', o: [4] },
      { q: 'Why do all your marble-chip curves level off at the **same** volume of gas?', opts: ['The same mass of marble (the limiting reactant) was used, so the same amount of CO₂ forms', 'The syringe was full every time', 'The acid always ran out first', 'A catalyst was added each time'], e: 'Changing conditions changes how fast, not how much — unless the amount of limiting reactant changes.', o: [4] },
      { q: 'From your **first marble run** (gas syringe): average rate over the first 60 s = volume at 60 s ÷ 60 s. Calculate it.', ans: () => this.firstV60 != null ? this.firstV60 / 60 : null, tol: 0.06, abs: 0.02, unit: 'cm³/s', e: 'Read the volume at 60 s from your table and divide by 60: {ans} cm³/s.', o: [4] },
      { q: 'Using collision theory: why does a **higher temperature** increase the rate?', opts: ['Particles move faster, collide more often, and more collisions have at least the activation energy', 'The activation energy gets larger', 'There are more particles in the flask', 'The particles become bigger'], e: 'Both collision frequency and the fraction of successful collisions rise.', o: [5, 7] },
      { q: 'Why does **higher concentration** increase the rate?', opts: ['More particles per unit volume, so collisions are more frequent', 'Each particle has more energy', 'The activation energy is lower', 'The particles move faster'], e: 'Same energy, more crowded particles → more collisions per second.', o: [5, 7] },
      { q: 'After the reaction, the MnO₂ was filtered, dried and weighed. Its mass…', opts: ['was unchanged — a catalyst is not used up', 'had fallen to zero', 'had increased', 'had halved'], e: 'Catalysts speed up reactions and are chemically unchanged at the end.', o: [2] },
      { q: 'A catalyst increases the rate because it…', opts: ['provides a pathway with a lower activation energy', 'gives particles more kinetic energy', 'increases the concentration', 'increases the amount of product'], e: 'With a lower Ea, a larger fraction of collisions are successful.', o: [6] },
      { q: 'Flour dust in a mill can explode, yet a bag of flour only smoulders. Why?', opts: ['Dust has a huge surface area, so it reacts with oxygen extremely fast', 'Dust contains a catalyst', 'Dust is hotter', 'A bag of flour contains no fuel'], e: 'Smaller particles → larger surface area → more collisions per second.', o: [1] },
      { q: 'Which apparatus measures the **volume of gas** given off most precisely?', opts: ['Gas syringe', 'Beaker', 'Thermometer', 'Stop-watch'], e: 'Gas syringes are graduated in cm³; the stop-watch times the run.', sub: 'C12.1', o: [1] },
    ], { sub: 'C6.2', onDone: () => { this.st.done(6); this.check(); } });

    this.fz = null;
    this.refreshControls(); this.setMethod(); this.prepFlask(); this.buildModel();
    this.every((dt, t) => this.sim(dt, t));
    this.ui.hint('Choose the conditions, then press **▶ Start run**. Change **one** variable at a time for a fair test.', 6000);
  }

  // ------------------------------------------------------------------ set-up
  refreshControls() {
    const marble = this.rx === 'marble';
    this.catSeg.el.style.display = marble ? 'none' : '';
    this.concSeg.el.querySelector('.lbl span').textContent = marble ? 'Acid concentration (mol/dm³)' : 'Hydrogen peroxide concentration (mol/dm³)';
    this.sizeSeg.el.querySelector('.lbl span').textContent = marble ? 'Marble chip size' : 'Catalyst particle size';
    this.flask.setColor(marble ? '#e0f2fe' : '#f0f9ff');
  }
  setMethod() {
    const mass = this.method === 'mass';
    this.stopRun(false);
    this.syrGroup.visible = !mass; this.bal.visible = mass; this.bung.visible = !mass; this.wool.visible = mass;
    this.flask.position.y = this.Y + (mass ? this.bal.top : 0);
    this.clearGraph();
    this.graph.o.y.label = mass ? 'Mass lost / g' : 'Volume of gas / cm³';
    this.graph.o.y.max = mass ? 0.2 : 100; this.graph.draw();
    this.syr.set(0); this.bal.set(152.4);
  }
  prepFlask() {
    if (this.run?.active) this.stopRun(false);
    while (this.chips.children.length) { const c = this.chips.children[0]; this.chips.remove(c); c.geometry?.dispose(); }
    const marble = this.rx === 'marble';
    const sz = SIZES[this.size];
    this.powder.visible = (marble && this.size === 'powder') || (!marble && this.cat);
    this.powder.material.color.set(marble ? '#f1f5f9' : '#1f2937');
    this.powder.scale.set(1, 1, 1);
    if (marble && sz.n) {
      const geo = new THREE.DodecahedronGeometry(sz.s, 0);
      for (let i = 0; i < sz.n; i++) {
        const a = i * 2.39, rr = 0.012 + (i % 5) * 0.008;
        const c = mesh(geo, mat(i % 3 ? '#e7e5e4' : '#f5f5f4', 0, 0.85), Math.cos(a) * rr, 0.004 + sz.s * 0.8 + (i > 8 ? sz.s * 1.2 : 0), Math.sin(a) * rr);
        c.rotation.set(i, i * 1.3, i * 0.7); this.chips.add(c);
      }
    }
    this.chips.scale.setScalar(1);
  }
  buildModel() {
    this.lab.clearRoot(this.pbBox);
    const n = Math.round(14 * this.conc);
    const pb = new ParticleBox({ w: 0.2, h: 0.13, d: 0.08, n, r: 0.0065, color: '#38bdf8' });
    pb.mode = 'gas'; pb.speed = 0.55 + (this.T - 20) / 22;
    this.pEff = clamp(0.07 * Math.pow(2, (this.T - 20) / 10) * (this.rx === 'peroxide' && this.cat ? 5 : 1), 0, 0.9);
    pb.onHit = () => { this.hits++; if (Math.random() < this.pEff) { this.succ++; this.flash = 1; } };
    this.pbBox.add(pb); this.pb = pb;
    this.hits = 0; this.succ = 0; this._acc = 0;
    this.ro?.set('e', `${Math.round(this.pEff * 100)}%`);
    this.explain();
  }
  explain() {
    const parts = [];
    parts.push(`**Concentration ${this.conc} mol/dm³** → ${Math.round(14 * this.conc)} acid particles in the box: ${this.conc > 1 ? 'more crowded, so **more frequent collisions**' : this.conc < 1 ? 'fewer per unit volume, so fewer collisions' : 'baseline crowding'}.`);
    parts.push(`**Temperature ${this.T} °C** → particles move ${this.T > 20 ? '**faster**: more collisions per second *and* more of them have energy ≥ Ea' : 'at baseline speed'}.`);
    if (this.rx === 'marble') parts.push(`**${SIZES[this.size].name}** → ${this.size === 'large' ? 'only the outside of each chip can be hit' : 'more surface exposed, so **more particles can collide at once**'}.`);
    else parts.push(this.cat ? '**MnO₂ catalyst** → an alternative pathway with a **lower activation energy**, so far more collisions succeed.' : 'No catalyst → very few collisions have enough energy; the peroxide barely decomposes.');
    this.whyBox.innerHTML = parts.map((p) => `• ${p.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>')}`).join('<br>');
  }

  // ------------------------------------------------------------------ runs
  startRun() {
    if (this.run?.active) { this.ui.hint('A run is already in progress — stop it first.', 2500); return; }
    const p = { rx: this.rx, method: this.method, size: this.size, conc: this.conc, T: this.T, cat: this.rx === 'peroxide' ? this.cat : false };
    const par = this.params(p);
    const idx = this.runs.length;
    const series = { name: `R${idx + 1}`, color: COLORS[idx % COLORS.length], points: false, line: true, data: [[0, 0]] };
    this.graph.series.push(series); if (this.graph.series.length > 6) this.graph.series.shift();
    this.prepFlask();
    this.run = { ...p, ...par, t: 0, V: 0, series, active: true, idx, sample: 0 };
    this.flask.setLevel(0.34);
    audio.pour(); setTimeout(() => audio.fizz(0.6), 400);
    if (!this.fz) this.fz = audio.loop('fizz');
    this.buildModel();
    this.ui.hint(`Run R${idx + 1} started: ${this.desc(p)}`, 3000);
  }
  desc(p) { return p.rx === 'marble' ? `${SIZES[p.size].name}, ${p.conc} M acid, ${p.T} °C` : `H₂O₂ ${p.conc} M, ${p.cat ? `MnO₂ (${SIZES[p.size].name.replace(' chips', '')})` : 'no catalyst'}, ${p.T} °C`; }
  stopRun(manual) {
    if (!this.run?.active) return;
    this.run.active = false; this.fz?.set(0);
    if (manual) this.ui.note(`Run R${this.run.idx + 1} stopped early — it is not recorded in the results table.`, 'warn');
  }
  clearGraph() { this.graph.series.length = 0; this.graph.o.x.max = 120; this.graph.draw(); }
  finishRun() {
    const r = this.run; r.active = false; this.fz?.set(0);
    const scale = r.method === 'mass' ? r.gPerCm3 : 1;
    const unit = r.method === 'mass' ? 'g' : 'cm³';
    const at60 = this.vol(r, 60) * scale, init = (this.vol(r, 10) / 10) * scale, t95 = (3 * r.Vmax) / r.r0;
    const fmtv = (v) => (r.method === 'mass' ? v.toFixed(3) : v.toFixed(1));
    this.table.add([`<b style="color:${r.series.color}">R${r.idx + 1}</b>`, this.desc(r) + (r.method === 'mass' ? ' (mass)' : ''), `${fmtv(at60)} ${unit}`, `${r.method === 'mass' ? init.toFixed(4) : init.toFixed(2)} ${unit}/s`, t95 > 900 ? '> 900' : t95.toFixed(0)]);
    const rec = { ...r, at60, init, t95 };
    if (r.rx === 'marble' && r.method === 'syringe' && this.firstV60 == null) this.firstV60 = at60;
    // fair-test detection
    const found = new Set();
    let unfair = false, same = false;
    for (const prev of this.runs) {
      if (prev.rx !== r.rx || prev.method !== r.method) continue;
      const diff = Object.keys(VARS).filter((k) => prev[k] !== r[k]);
      if (diff.length === 1) found.add(diff[0]); else if (diff.length > 1) unfair = true; else same = true;
    }
    this.runs.push(rec);
    audio.discover();
    if (r.rx === 'marble') this.st.done(0);
    if (r.method === 'mass') { this.st.done(5); this.ui.note(`Mass-loss method: the balance fell by **${(r.Vmax * r.gPerCm3).toFixed(3)} g** as ${r.gas} escaped through the cotton wool. Same shape of curve — just a different measurement.`, 'gold'); }
    if (found.size) {
      for (const k of found) {
        this.ui.note(`✅ Fair test: only the **${VARS[k]}** changed between runs, so any difference in rate is caused by ${VARS[k]}.`, 'gold');
        if (r.rx === 'marble') { if (k === 'size') this.st.done(1); if (k === 'conc') this.st.done(2); if (k === 'T') this.st.done(3); }
        if (r.rx === 'peroxide' && k === 'cat') { this.catPair = true; this.ui.note('MnO₂ made the oxygen pour out — without it, almost nothing happened. Now **weigh the catalyst**.', 'gold'); }
      }
    } else if (unfair) this.ui.note('⚠️ This run changed **more than one variable** compared with every earlier run — you cannot tell which change affected the rate.', 'warn');
    else if (same) this.ui.note(`Run R${r.idx + 1} repeated identical conditions — repeats improve reliability.`);
    if (r.rx === 'peroxide' && r.cat) this.catRunDone = true;
    this.ui.note(`R${r.idx + 1}: initial rate ${r.method === 'mass' ? init.toFixed(4) : init.toFixed(2)} ${unit}/s; ${r.gas} collected at 60 s: ${fmtv(at60)} ${unit}.`);
    this.check();
  }
  weighCatalyst() {
    if (!this.catRunDone) { this.ui.hint('First do a hydrogen peroxide run **with** MnO₂.', 3000); return; }
    audio.clink();
    this.weighed = true;
    this.ui.note('⚖️ MnO₂ before: **0.50 g** · after filtering, washing and drying: **0.50 g**. The catalyst is **unchanged** — it can be used again.', 'gold');
    this.check();
  }
  check() {
    if (this.catPair && this.weighed) this.st.done(4);
    this.st.check();
  }

  // ------------------------------------------------------------------ loop
  sim(dt, t) {
    const r = this.run;
    this.flask.update(dt);
    let rate = 0;
    if (r?.active) {
      r.t += dt * this.warp;
      r.V = this.vol(r, r.t);
      rate = r.r0 * Math.exp(-(r.r0 * r.t) / r.Vmax);
      r.sample += dt;
      if (r.sample > 0.08) { r.sample = 0; r.series.data.push([r.t, r.method === 'mass' ? r.V * r.gPerCm3 : r.V]); this.graph.autoscale(); this.graph.draw(); }
      if (r.V >= r.Vmax * 0.995 || r.t > 900) { r.series.data.push([r.t, r.method === 'mass' ? r.V * r.gPerCm3 : r.V]); this.graph.draw(); this.finishRun(); }
    }
    const V = r ? r.V : 0;
    const frac = r ? clamp(V / r.Vmax, 0, 1) : 0;
    if (this.method === 'syringe') this.syr.set(V); else this.bal.set(152.4 - V * (r?.gPerCm3 || 0));
    this.sw.set(r ? r.t : 0);
    // reactant used up
    if (r && r.rx === 'marble') { const s = Math.cbrt(Math.max(0.02, 1 - frac)); this.chips.scale.setScalar(s); if (r.size === 'powder') this.powder.scale.set(Math.max(0.05, 1 - frac), Math.max(0.1, 1 - frac), Math.max(0.05, 1 - frac)); }
    const visRate = r?.active ? clamp(rate * (this.warp / 10) * 7, 0, 70) : 0;
    this.bub.setRate(visRate); this.bub.update(dt, this.flask.surfaceY());
    this.puff.setRate(this.method === 'mass' && r?.active ? clamp(visRate / 10, 0, 4) : 0); this.puff.update(dt);
    this.fz?.set(r?.active ? clamp(visRate / 70, 0.05, 0.8) : 0);
    // collision model
    if (this.pb) {
      this.pb.update(dt);
      this.flash = Math.max(0, (this.flash || 0) - dt * 3);
      this.surface.material.emissive.setRGB(this.flash * 1.2, this.flash * 0.9, this.flash * 0.2);
      this._acc += dt;
      if (this._acc > 1) { this.ro.set('c', Math.round(this.hits / this._acc)); this.ro.set('s', Math.round(this.succ / this._acc)); this.hits = 0; this.succ = 0; this._acc = 0; }
    }
    const unit = this.method === 'mass' ? 'g' : 'cm³';
    this.ro.set('t', r ? r.t.toFixed(0) : '0');
    this.ro.set('v', this.method === 'mass' ? `${(V * (r?.gPerCm3 || 0)).toFixed(3)} g` : `${V.toFixed(1)} cm³`);
    this.ro.set('r', `${(this.method === 'mass' ? rate * (r?.gPerCm3 || 0) : rate).toFixed(this.method === 'mass' ? 4 : 2)} ${unit}/s`);
  }

  drawPathway() {
    const c = this.pd, ctx = c.getContext('2d'), W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(60, 16); ctx.lineTo(60, H - 30); ctx.lineTo(W - 20, H - 30); ctx.stroke();
    ctx.fillStyle = '#cbd5e1'; ctx.font = '600 17px Inter'; ctx.save(); ctx.translate(30, H / 2 + 30); ctx.rotate(-Math.PI / 2); ctx.fillText('Energy', 0, 0); ctx.restore(); ctx.fillText('Progress of reaction', W / 2 - 80, H - 6);
    const yR = 150, yP = 200;
    const hump = (top, col, dash) => { ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(80, yR); ctx.lineTo(200, yR); ctx.bezierCurveTo(280, yR, 280, top, 340, top); ctx.bezierCurveTo(400, top, 400, yP, 480, yP); ctx.lineTo(W - 40, yP); ctx.stroke(); ctx.setLineDash([]); };
    hump(36, '#f87171', [8, 6]); hump(104, '#34d399', []);
    ctx.font = '700 16px Inter'; ctx.fillStyle = '#e2e8f0'; ctx.fillText('Reactants', 86, yR - 10); ctx.fillText('Products', W - 140, yP - 10);
    ctx.fillStyle = '#f87171'; ctx.fillText('without catalyst', 360, 36); ctx.fillStyle = '#34d399'; ctx.fillText('with catalyst (lower Ea)', 400, 100);
    ctx.strokeStyle = '#5eead4'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(230, yR); ctx.lineTo(230, 104); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#5eead4'; ctx.fillText('Ea', 238, 134);
  }
  dispose() { this.fz?.stop(); this.fz = null; super.dispose(); }
}
