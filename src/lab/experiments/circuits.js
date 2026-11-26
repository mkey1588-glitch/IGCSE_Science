import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { Bulb, Meter, wire, mesh, mat, M } from '../apparatus.js';
import { h, clear, clamp, tweens } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const APPLIANCES = [
  { id: 'lamp', name: 'Table lamp', P: 60, fuse: 3 },
  { id: 'tv', name: 'Television', P: 120, fuse: 3 },
  { id: 'hair', name: 'Hair-dryer', P: 1150, fuse: 13 },
  { id: 'kettle', name: 'Kettle', P: 2300, fuse: 13 },
  { id: 'fridge', name: 'Fridge', P: 800, fuse: 5 },
];
const HAZARDS = [
  { id: 'fray', name: 'Frayed kettle cable', pos: [-0.2, 0.05, 0.02], text: '**Damaged insulation** exposes the live wire — touching it can cause a fatal shock or start a fire.' },
  { id: 'adaptor', name: 'Overloaded adaptor', pos: [0.02, 0.12, -0.1], text: 'Too many high-power appliances on one socket draw an **excessive current**: the cables overheat and can start a fire.' },
  { id: 'water', name: 'Hair-dryer by the sink', pos: [0.2, 0.08, 0.0], text: '**Damp conditions**: water conducts, so current could flow through the user. Keep mains appliances away from water.' },
  { id: 'fuse', name: '13 A fuse in a lamp plug', pos: [-0.05, 0.03, 0.12], text: 'The lamp needs only about 0.26 A — a **13 A fuse would not blow** if a fault happened. It should be a **3 A** fuse.' },
  { id: 'earth', name: 'Unearthed metal toaster', pos: [0.15, 0.06, -0.12], text: 'A metal-cased appliance must be **earthed** (or double insulated). If the live wire touched the case, it would become live.' },
];

export default class Circuits extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'The festival lights went out and Lucia’s food stall keeps tripping its fuse. Build circuits, measure them properly, and make the island’s wiring safe.';
    this.tabLabels = [['build', '💡 Build circuits'], ['static', '🎈 Static'], ['home', '🏠 Home safety']];
    this.tabObjectives = { build: ['P4.2.2', 'P4.2.3', 'P4.2.4', 'P4.2.5', 'P4.3.1', 'P4.3.2'], static: ['P4.2.1'], home: ['P4.4', 'P4.2.5'] };
    this.tabViews = { build: { pos: [0, 1.42, 0.68], target: [0, 0.94, 0.0] }, static: { pos: [0, 1.32, 0.85], target: [0, 1.05, 0] }, home: { pos: [0, 1.34, 0.8], target: [0, 1.0, 0] } };
    this.view = this.tabViews.build;
  }
  checkTab(id, st, n) { if (Array.from({ length: n }, (_, i) => i).every((i) => st.isDone(i))) this.lab.goal(id); }

  // ======================================================== build
  tab_build() {
    const Y = this.Y;
    this.c = { mode: 'series', V: 6, R1: 6, R2: 6, sw: true, out1: false, comp: 'resistor', Vt: 0, iv: [], seen: new Set() };
    this.board = mesh(new THREE.BoxGeometry(0.62, 0.01, 0.4), mat('#f1f5f9', 0, 0.8)); this.lab.add(this.board, 0, Y + 0.005, 0);
    this.cg = new THREE.Group(); this.lab.add(this.cg, 0, Y + 0.012, 0);
    this.electrons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0028, 6, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.4, 2.4) }), 400); this.electrons.frustumCulled = false; this.lab.add(this.electrons, 0, Y + 0.016, 0); this.electrons.count = 0;
    this._o = new THREE.Object3D(); this.flows = [];
    const ui = this.ui;
    this.stB = ui.steps(['**Series:** measure the current at two places and the voltage across each lamp', '**Parallel:** show the branch currents add up to the total', 'Unscrew a lamp in each circuit — which keeps working?', 'Plot an **I–V graph** for a resistor and find its resistance', '(S) Plot I–V graphs for a **filament lamp** and a **diode**', 'Answer the analysis questions']);
    const sec = ui.section('Circuit');
    ui.seg({ label: 'Layout', options: [['series', 'Series'], ['parallel', 'Parallel'], ['iv', 'I–V tester']], value: 'series', parent: sec, onChange: (v) => { this.c.mode = v; this.c.out1 = false; this.layout(); } });
    this.vSl = ui.slider({ label: 'Battery (e.m.f.)', min: 1.5, max: 12, step: 1.5, value: this.c.V, unit: 'V', parent: sec, onInput: (v) => { this.c.V = v; this.solve(); } });
    ui.slider({ label: 'Lamp 1 resistance', min: 2, max: 12, step: 1, value: this.c.R1, unit: 'Ω', parent: sec, onInput: (v) => { this.c.R1 = v; this.solve(); } });
    ui.slider({ label: 'Lamp 2 resistance', min: 2, max: 12, step: 1, value: this.c.R2, unit: 'Ω', parent: sec, onInput: (v) => { this.c.R2 = v; this.solve(); } });
    ui.buttons([{ label: '🔘 Switch', onClick: () => { this.c.sw = !this.c.sw; audio.click(); this.solve(); } }, { label: '🔧 Unscrew lamp 1', onClick: () => { this.c.out1 = !this.c.out1; audio.click(); this.layout(); } }], sec);
    this.ro = ui.readouts([{ id: 'A', label: 'Total current', unit: 'A' }, { id: 'A1', label: 'Lamp 1 current', unit: 'A' }, { id: 'A2', label: 'Lamp 2 current', unit: 'A' }, { id: 'V1', label: 'p.d. lamp 1', unit: 'V' }, { id: 'V2', label: 'p.d. lamp 2', unit: 'V' }, { id: 'R', label: 'Total resistance', unit: 'Ω' }], sec);
    const iv = ui.section('I–V tester');
    ui.seg({ label: 'Component', options: [['resistor', 'Resistor'], ['lamp', 'Filament lamp'], ['diode', 'Diode (S)']], value: 'resistor', parent: iv, onChange: (v) => { this.c.comp = v; this.c.iv = []; this.ivG.clear(); this.layout(); } });
    this.vtSl = ui.slider({ label: 'Applied p.d.', min: -6, max: 6, step: 0.5, value: 0, unit: 'V', parent: iv, onInput: (v) => { this.c.Vt = v; this.solve(); } });
    ui.buttons([{ label: '📍 Record point', kind: 'primary', onClick: () => this.recIV() }, { label: '⚡ Sweep −6 V → +6 V', onClick: () => this.sweep() }], iv);
    this.ivG = ui.graph({ x: { label: 'p.d. / V', min: -6, max: 6 }, y: { label: 'Current / A', min: -0.7, max: 0.7 }, series: [{ name: 'I–V', color: '#f472b6', points: true, line: true }], height: 160 }, iv);
    ui.notes();
    this.qsB = ui.questions([
      { q: 'From your resistor I–V graph: R = V ÷ I. What is the resistance?', ans: () => (this.c.ivDone ? 10 : null), tol: 0.05, unit: 'Ω', e: 'A straight line through the origin: R = {ans} Ω (constant).', o: [1, 2], sub: 'P4.2.4' },
      { q: 'Why are the lights in a house wired in **parallel**?', opts: ['Each lamp gets the full voltage and can be switched on and off independently', 'It uses less wire', 'The current is the same everywhere', 'Series is more dangerous'], e: 'If one lamp fails, the others stay on.', o: [4], sub: 'P4.3.2' },
      { q: '(S) Two resistors of 6 Ω and 3 Ω in **parallel** have a combined resistance of…', ans: 2, tol: 0.01, unit: 'Ω', e: '1/R = 1/6 + 1/3 → R = {ans} Ω — less than either.', o: [6, 8], sub: 'P4.3.2' },
      { q: 'A 12 V battery drives 2.0 A through a heater. What is the power?', ans: 24, tol: 0.01, unit: 'W', e: 'P = I × V = {ans} W.', o: [2], sub: 'P4.2.5' },
      { q: '(S) Current in a metal wire is a flow of…', opts: ['free (delocalised) electrons', 'protons', 'positive ions', 'atoms'], e: 'Conventional current is shown from + to −; electrons actually drift from − to +.', o: [2, 6, 7], sub: 'P4.2.2' },
      { q: '(S) In 10 s, 3.0 C of charge flows through a lamp. The current is…', ans: 0.3, tol: 0.01, unit: 'A', e: 'I = Q ÷ t = {ans} A.', o: [5], sub: 'P4.2.2' },
    ], { sub: 'P4.3.2', onDone: () => { this.stB.done(5); this.checkTab('build', this.stB, 6); } });
    this.layout();
    this.every((dt) => this.flow(dt));
  }
  layout() {
    this.lab.clearRoot(this.cg); this.flows = [];
    const c = this.c, Y0 = 0;
    const P = (x, z) => new THREE.Vector3(x, Y0, z);
    const add = (o, x, z, ry = 0) => { o.position.set(x, Y0, z); o.rotation.y = ry; this.cg.add(o); return o; };
    const W = (pts, col = '#334155') => { const w = wire(pts.map((p) => p.clone().setY(0.006)), col, 0.0022); this.cg.add(w); return w; };
    const cell = new THREE.Group(); cell.add(mesh(new THREE.BoxGeometry(0.09, 0.03, 0.04), mat('#111827', 0.2, 0.5), 0, 0.015, 0), mesh(new THREE.BoxGeometry(0.015, 0.032, 0.041), mat('#dc2626', 0.2, 0.5), 0.038, 0.016, 0));
    this.bulbs = []; this.meters = {};
    if (c.mode === 'iv') {
      add(cell, -0.2, 0, Math.PI / 2); this.lab.label(cell, 'Variable supply', { y: 0.05, cls: 'dimlab' });
      const comp = new THREE.Group();
      if (c.comp === 'resistor') { comp.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 12), mat('#d6c29a', 0, 0.6))); [-0.012, -0.002, 0.008].forEach((y, i) => comp.add(mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.004, 12), mat(['#a16207', '#111827', '#111827'][i]), 0, y, 0))); comp.children.forEach((m) => { m.rotation.z = Math.PI / 2; m.position.set(m.position.y, 0.008, 0); }); }
      else if (c.comp === 'lamp') { const b = new Bulb(); comp.add(b); this.bulbs.push(b); }
      else { comp.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.03, 12), mat('#111827'), 0, 0.006, 0).rotateZ(Math.PI / 2), mesh(new THREE.CylinderGeometry(0.0052, 0.0052, 0.004, 12), mat('#e5e7eb'), 0.011, 0.006, 0).rotateZ(Math.PI / 2)); }
      add(comp, 0.05, -0.1); this.lab.label(comp, { resistor: 'Resistor', lamp: 'Filament lamp', diode: 'Diode' }[c.comp], { y: 0.06 });
      const A = new Meter('A'); add(A, 0.2, 0.02, -Math.PI / 2); this.meters.A = A;
      const V = new Meter('V'); add(V, 0.05, -0.18); this.meters.V = V;
      const loop = [P(-0.2, 0.05), P(-0.2, 0.12), P(0.2, 0.12), P(0.2, -0.1), P(0.08, -0.1), P(0.02, -0.1), P(-0.2, -0.1), P(-0.2, -0.05)];
      W(loop.slice(0, 5)); W(loop.slice(5));
      W([P(0.02, -0.1), P(0.02, -0.16), P(0.03, -0.18)], '#dc2626'); W([P(0.08, -0.1), P(0.08, -0.16), P(0.07, -0.18)], '#dc2626');
      this.flows.push({ path: new THREE.CatmullRomCurve3(loop, true, 'catmullrom', 0), key: 'I' });
    } else if (c.mode === 'series') {
      add(cell, -0.22, 0, Math.PI / 2); this.lab.label(cell, 'Battery', { y: 0.05, cls: 'dimlab' });
      const sw = mesh(new THREE.BoxGeometry(0.04, 0.006, 0.01), mat(c.sw ? '#22c55e' : '#ef4444')); add(sw, -0.1, 0.12); sw.rotation.z = c.sw ? 0 : 0.5; this.lab.label(sw, c.sw ? 'Switch (closed)' : 'Switch (open)', { y: 0.03, cls: 'dimlab' });
      const b1 = new Bulb(); add(b1, -0.06, -0.12); const b2 = new Bulb(); add(b2, 0.1, -0.12); this.bulbs = [b1, b2];
      b1.visible = !c.out1; this.lab.label(b1, c.out1 ? 'Lamp 1 (removed)' : 'Lamp 1', { y: 0.08, cls: 'dimlab' }); this.lab.label(b2, 'Lamp 2', { y: 0.08, cls: 'dimlab' });
      const A = new Meter('A'); add(A, 0.22, 0, -Math.PI / 2); this.meters.A = A; const A2 = new Meter('A'); add(A2, 0.02, 0.12, Math.PI); this.meters.A1 = A2;
      const loop = [P(-0.22, 0.05), P(-0.22, 0.12), P(0.22, 0.12), P(0.22, -0.12), P(-0.22, -0.12), P(-0.22, -0.05)];
      W(loop);
      this.flows.push({ path: new THREE.CatmullRomCurve3(loop, true, 'catmullrom', 0), key: 'I' });
    } else {
      add(cell, -0.22, 0, Math.PI / 2); this.lab.label(cell, 'Battery', { y: 0.05, cls: 'dimlab' });
      const b1 = new Bulb(); add(b1, 0.02, -0.14); const b2 = new Bulb(); add(b2, 0.02, 0.0); this.bulbs = [b1, b2]; b1.visible = !c.out1;
      this.lab.label(b1, c.out1 ? 'Lamp 1 (removed)' : 'Lamp 1', { y: 0.08, cls: 'dimlab' }); this.lab.label(b2, 'Lamp 2', { y: 0.08, cls: 'dimlab' });
      const A = new Meter('A'); add(A, -0.1, 0.13, Math.PI); this.meters.A = A; const A1 = new Meter('A'); add(A1, 0.16, -0.14, Math.PI); this.meters.A1 = A1; const A2 = new Meter('A'); add(A2, 0.16, 0.0, Math.PI); this.meters.A2 = A2;
      const trunk = [P(-0.22, 0.05), P(-0.22, 0.13), P(0.26, 0.13), P(0.26, -0.14), P(-0.12, -0.14), P(-0.12, 0.0), P(-0.22, 0.0), P(-0.22, -0.05)];
      W([P(-0.22, 0.05), P(-0.22, 0.13), P(0.26, 0.13), P(0.26, -0.14), P(-0.12, -0.14), P(-0.12, -0.05), P(-0.22, -0.05)]);
      W([P(0.26, 0.0), P(-0.12, 0.0)]);
      this.flows.push({ path: new THREE.CatmullRomCurve3([P(-0.22, 0.05), P(-0.22, 0.13), P(0.26, 0.13), P(0.26, 0.0)], false, 'catmullrom', 0), key: 'I' });
      this.flows.push({ path: new THREE.CatmullRomCurve3([P(0.26, 0.0), P(0.26, -0.14), P(-0.12, -0.14), P(-0.12, -0.05)], false, 'catmullrom', 0), key: 'I1' });
      this.flows.push({ path: new THREE.CatmullRomCurve3([P(0.26, 0.0), P(-0.12, 0.0), P(-0.12, -0.05)], false, 'catmullrom', 0), key: 'I2' });
      this.flows.push({ path: new THREE.CatmullRomCurve3([P(-0.12, -0.05), P(-0.22, -0.05)], false, 'catmullrom', 0), key: 'I' });
      void trunk;
    }
    this.flows.forEach((f) => { f.len = f.path.getLength(); const n = Math.max(4, Math.round(f.len / 0.02)); f.u = Array.from({ length: n }, (_, i) => i / n); });
    this.solve();
  }
  ivI(V) {
    if (this.c.comp === 'resistor') return V / 10;
    if (this.c.comp === 'lamp') return V / (5 * (1 + 0.25 * Math.abs(V)));
    return V > 0.6 ? (V - 0.6) / 8 : 0;
  }
  solve() {
    const c = this.c; let I = 0, I1 = 0, I2 = 0, V1 = 0, V2 = 0, R = 0;
    if (c.mode === 'iv') { I = this.ivI(c.Vt); this.meters.A?.set(I); this.meters.V?.set(c.Vt); if (this.bulbs[0]) this.bulbs[0].set(Math.abs(I) / 0.5); this.cur = { I }; this.ro.set('A', I.toFixed(3)); this.ro.set('V1', c.Vt.toFixed(1)); return; }
    if (c.mode === 'series') { R = c.R1 + c.R2; I = c.sw && !c.out1 ? c.V / R : 0; I1 = I2 = I; V1 = I * c.R1; V2 = I * c.R2; }
    else { I1 = c.out1 ? 0 : c.V / c.R1; I2 = c.V / c.R2; I = I1 + I2; V1 = c.out1 ? 0 : c.V; V2 = c.V; R = c.out1 ? c.R2 : (c.R1 * c.R2) / (c.R1 + c.R2); }
    this.cur = { I, I1, I2 };
    const pRef = 6;
    if (this.bulbs[0]) this.bulbs[0].set((I1 * I1 * c.R1) / pRef); if (this.bulbs[1]) this.bulbs[1].set((I2 * I2 * c.R2) / pRef);
    this.meters.A?.set(I); this.meters.A1?.set(I1); this.meters.A2?.set(I2);
    this.ro.set('A', I.toFixed(2)); this.ro.set('A1', I1.toFixed(2)); this.ro.set('A2', I2.toFixed(2)); this.ro.set('V1', V1.toFixed(2)); this.ro.set('V2', V2.toFixed(2)); this.ro.set('R', R.toFixed(2));
    // progress
    if (c.mode === 'series' && I > 0 && !this.stB.isDone(0)) { this.stB.done(0); this.ui.note(`Series: the current is the **same everywhere** (${I.toFixed(2)} A at both ammeters) and the battery voltage is **shared**: ${V1.toFixed(1)} V + ${V2.toFixed(1)} V = ${c.V} V.`, 'gold'); }
    if (c.mode === 'parallel' && !c.out1 && !this.stB.isDone(1)) { this.stB.done(1); this.ui.note(`Parallel: ${I1.toFixed(2)} A + ${I2.toFixed(2)} A = **${I.toFixed(2)} A** — branch currents add up to the total. Each lamp gets the full ${c.V} V.`, 'gold'); }
    if (c.out1) { c.seen.add(c.mode); if (c.mode === 'series') this.ui.hint('Series: one lamp out → the circuit is broken → **both** go out.', 3000); else this.ui.hint('Parallel: lamp 2 stays on — its branch is still complete.', 3000); }
    if (c.seen.has('series') && c.seen.has('parallel') && !this.stB.isDone(2)) { this.stB.done(2); this.ui.note('That is why homes and festival lights are wired in **parallel**: one failure doesn’t black out the rest.', 'gold'); }
    this.checkTab('build', this.stB, 6);
  }
  recIV() {
    const c = this.c; if (c.mode !== 'iv') { this.ui.hint('Choose the **I–V tester** layout first.', 2200); return; }
    if (c.iv.some((p) => p[0] === c.Vt)) return;
    c.iv.push([c.Vt, this.ivI(c.Vt)]); c.iv.sort((a, b) => a[0] - b[0]); this.ivG.set(0, c.iv); audio.blip();
    this.ivProgress();
  }
  async sweep() {
    if (this.c.mode !== 'iv') { this.ui.hint('Choose the **I–V tester** layout first.', 2200); return; }
    for (let v = -6; v <= 6; v += 1) { this.c.Vt = v; this.vtSl.set(v); this.solve(); this.recIV(); await tweens.tween(0.12, () => {}).promise; }
  }
  ivProgress() {
    const c = this.c; if (c.iv.length < 6) return;
    c.ivSeen = c.ivSeen || new Set(); c.ivSeen.add(c.comp);
    if (c.comp === 'resistor' && !this.stB.isDone(3)) { c.ivDone = true; this.stB.done(3); this.ui.note('A **straight line through the origin**: current ∝ p.d., so the resistance is constant (Ohm’s law).', 'gold'); }
    if (c.comp === 'lamp' && !this._lampNote) { this._lampNote = true; this.ui.note('Filament lamp: the line **curves** — as the filament heats up, its resistance increases.'); }
    if (c.comp === 'diode' && !this._diodeNote) { this._diodeNote = true; this.ui.note('Diode: current flows in **one direction only** (above about 0.6 V); in reverse almost no current flows.'); }
    if (c.ivSeen.has('lamp') && c.ivSeen.has('diode') && !this.stB.isDone(4)) this.stB.done(4);
    this.checkTab('build', this.stB, 6);
  }
  flow(dt) {
    const cur = this.cur || {}; let n = 0;
    for (const f of this.flows) {
      const I = Math.abs(cur[f.key] || 0), sp = I * 0.05 * Math.sign(cur[f.key] || 1);
      f.u = f.u.map((u) => (((u + (sp * dt) / f.len) % 1) + 1) % 1);
      if (I < 1e-4) continue;
      for (const u of f.u) { if (n >= 400) break; this._o.position.copy(f.path.getPointAt(u)); this._o.position.y = 0.006; this._o.updateMatrix(); this.electrons.setMatrixAt(n++, this._o.matrix); }
    }
    this.electrons.count = n; this.electrons.instanceMatrix.needsUpdate = true;
  }

  // ======================================================== static
  tab_static() {
    const Y = this.Y;
    this.sc = { charged: {}, done: new Set(), touched: new Set() };
    this.stand2 = new THREE.Group(); this.lab.add(this.stand2, 0, Y, -0.05);
    this.stand2.add(mesh(new THREE.BoxGeometry(0.12, 0.01, 0.08), M.dark, 0, 0.005, 0), mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.3, 8), M.steel, -0.05, 0.15, 0), mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.06, 8), M.steel, -0.02, 0.3, 0).rotateZ(Math.PI / 2));
    this.hang = new THREE.Group(); this.hang.position.set(0.01, 0.3, 0); this.stand2.add(this.hang);
    this.hang.add(mesh(new THREE.CylinderGeometry(0.0005, 0.0005, 0.12, 4), mat('#e5e7eb'), 0, -0.06, 0));
    this.hRod = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 12), mat('#1f2937', 0.1, 0.3)); this.hRod.rotation.z = Math.PI / 2; this.hRod.position.y = -0.125; this.hang.add(this.hRod);
    this.hChg = this.lab.label(this.hRod, '', { y: 0.0, x: 0, cls: 'val' });
    this.lab.label(this.stand2, 'Suspended rod (charged polythene, −)', { y: 0.36 });
    this.rod = new THREE.Group(); this.lab.add(this.rod, 0.25, Y + 0.12, 0.12); this.rod.rotation.z = Math.PI / 2 - 0.3;
    this.rodM = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 12), mat('#1f2937', 0.1, 0.3)); this.rod.add(this.rodM);
    this.rodLbl = this.lab.label(this.rod, 'Polythene rod', { y: 0.12 });
    this.cloth = mesh(new THREE.BoxGeometry(0.08, 0.004, 0.06), mat('#7c3aed', 0, 1)); this.lab.add(this.cloth, 0.25, Y + 0.002, 0.2);
    this.lab.label(this.cloth, 'Cloth', { y: 0.02, cls: 'dimlab' });
    this.sphere = mesh(new THREE.SphereGeometry(0.03, 20, 14), M.steel); this.lab.add(this.sphere, -0.25, Y + 0.12, 0.08);
    this.lab.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.09, 8), mat('#e5e7eb', 0, 0.3)), -0.25, Y + 0.045, 0.08);
    this.sphLbl = this.lab.label(this.sphere, 'Metal sphere on insulating stand: −−−', { y: 0.05 });
    this.hCharge = -1; this.hChg.userData.set('− − −');
    const ui = this.ui;
    this.stS = ui.steps(['Rub the **polythene** and the **acetate** rods with the cloth', 'Bring each rod near the suspended (negative) rod', 'Touch the charged sphere with a **metal** rod and a **plastic** rod', 'Answer the analysis questions']);
    const sec = ui.section('Rods');
    this.rodSeg = ui.seg({ label: 'Rod in your hand', options: [['poly', 'Polythene'], ['acetate', 'Acetate']], value: 'poly', parent: sec, onChange: (v) => { this.sc.rod = v; this.rodM.material.color.set(v === 'poly' ? '#1f2937' : '#e0f2fe'); this.rodLbl.userData.set(`${v === 'poly' ? 'Polythene' : 'Acetate'} rod ${this.sc.charged[v] ? (v === 'poly' ? '(−)' : '(+)') : '(uncharged)'}`); } });
    this.sc.rod = 'poly';
    ui.buttons([{ label: '🧽 Rub with cloth', kind: 'primary', onClick: () => this.rub() }, { label: '↔ Bring near the suspended rod', onClick: () => this.bringNear() }], sec);
    const ss = ui.section('Conductors and insulators');
    ui.buttons([{ label: '🔩 Touch sphere with a metal rod (held in your hand)', onClick: () => this.touch('metal') }, { label: '📏 Touch sphere with a plastic rod', onClick: () => this.touch('plastic') }], ss);
    ui.notes();
    ui.questions([
      { q: 'When polythene is rubbed with a cloth it becomes **negative** because…', opts: ['electrons move from the cloth onto the polythene', 'protons move from the polythene to the cloth', 'positive charge is created', 'the rod gets hot'], e: 'Only electrons move when charging by friction.', o: [3, 4] },
      { q: 'A positive acetate rod and the negative polythene rod will…', opts: ['attract', 'repel', 'do nothing', 'swap charges instantly'], e: 'Unlike charges attract; like charges repel.', o: [2] },
      { q: 'Why does the metal rod discharge the sphere but the plastic rod doesn’t?', opts: ['Metals are conductors — charge flows through them (and you) to earth; plastic is an insulator', 'Plastic is negatively charged', 'Metals block electrons', 'Plastic is a conductor'], e: 'Conductors: metals. Insulators: plastic, glass, rubber, dry wood.', o: [5] },
      { q: '(S) Electric charge is measured in…', opts: ['coulombs (C)', 'amperes (A)', 'volts (V)', 'ohms (Ω)'], e: '(S) An electric field is the region where a charge feels a force; its direction is the force on a positive charge.', o: [6, 7, 8] },
    ], { sub: 'P4.2.1', onDone: () => { this.stS.done(3); this.checkTab('static', this.stS, 4); } });
  }
  rub() {
    const r = this.sc.rod; this.sc.charged[r] = true; audio.fizz?.(0.2);
    tweens.tween(0.8, (e) => { this.rod.position.x = 0.25 + Math.sin(e * 20) * 0.02; });
    this.rodLbl.userData.set(`${r === 'poly' ? 'Polythene rod (− − −)' : 'Acetate rod (+ + +)'}`);
    this.ui.note(r === 'poly' ? 'Polythene gained electrons from the cloth → **negative**. The cloth is left **positive**.' : 'Electrons moved **from** the acetate onto the cloth → acetate is **positive**.');
    if (this.sc.charged.poly && this.sc.charged.acetate) this.stS.done(0);
    this.checkTab('static', this.stS, 4);
  }
  bringNear() {
    const r = this.sc.rod; if (!this.sc.charged[r]) { this.ui.hint('Charge the rod first by rubbing it.', 2000); return; }
    const like = r === 'poly';
    tweens.to(this.rod.position, { x: 0.18 }, 0.5).promise.then(() => {
      tweens.to(this.hang.rotation, { y: like ? -0.7 : 0.5 }, 0.8);
      this.ui.note(like ? 'The suspended negative rod **swings away** — like charges **repel**.' : 'The suspended negative rod **swings towards** the positive acetate — unlike charges **attract**.', 'gold');
      this.sc.done.add(r); audio.whoosh?.();
      if (this.sc.done.size === 2) this.stS.done(1);
      this.checkTab('static', this.stS, 4);
      setTimeout(() => { if (this.hang) tweens.to(this.hang.rotation, { y: 0 }, 1.2); if (this.rod) tweens.to(this.rod.position, { x: 0.25 }, 0.5); }, 1800);
    });
  }
  touch(k) {
    this.sc.touched.add(k); audio.click();
    if (k === 'metal') { this.sphLbl.userData.set('Metal sphere: uncharged'); this.ui.note('Touching with a metal rod: electrons flowed through the metal and your body to **earth** — the sphere is discharged. Metals are **conductors**.', 'gold'); setTimeout(() => this.sphLbl?.userData.set('Metal sphere on insulating stand: −−−'), 2500); }
    else this.ui.note('Touching with plastic: nothing happens — the charge can’t flow through an **insulator**.');
    if (this.sc.touched.size === 2) this.stS.done(2);
    this.checkTab('static', this.stS, 4);
  }

  // ======================================================== home
  tab_home() {
    const Y = this.Y;
    this.hm = { found: new Set(), fuses: {}, fault: new Set() };
    const room = new THREE.Group(); this.lab.add(room, 0, Y, 0); this.room = room;
    room.add(mesh(new THREE.BoxGeometry(0.6, 0.004, 0.36), mat('#d6c29a', 0, 0.8), 0, 0.002, 0), mesh(new THREE.BoxGeometry(0.6, 0.26, 0.01), mat('#e2e8f0', 0, 0.9), 0, 0.13, -0.18));
    room.add(mesh(new THREE.BoxGeometry(0.2, 0.08, 0.12), mat('#94a3b8', 0.2, 0.6), 0.18, 0.04, -0.1), mesh(new THREE.BoxGeometry(0.06, 0.03, 0.05), mat('#f1f5f9'), 0.2, 0.08, 0.02));
    room.add(mesh(new THREE.BoxGeometry(0.03, 0.02, 0.005), mat('#f8fafc'), 0.02, 0.12, -0.172));
    const kettle = mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.05, 16), mat('#e5e7eb', 0.6, 0.3)); room.add(kettle); kettle.position.set(-0.2, 0.025, -0.02);
    room.add(mesh(new THREE.BoxGeometry(0.05, 0.03, 0.03), mat('#cbd5e1', 0.8, 0.3), 0.15, 0.1, -0.12));
    const lamp = mesh(new THREE.ConeGeometry(0.03, 0.04, 16, 1, true), mat('#fde68a', 0, 0.6, { side: THREE.DoubleSide })); room.add(lamp); lamp.position.set(-0.05, 0.08, 0.1);
    room.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.06, 6), M.steel, -0.05, 0.03, 0.1));
    this.spots = HAZARDS.map((hz) => { const s = mesh(new THREE.SphereGeometry(0.012, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.6, 0.3), transparent: true, opacity: 0.7 })); s.position.set(...hz.pos); room.add(s); this.lab.interactive(s, { tip: `Inspect: ${hz.name}`, onClick: () => this.findHazard(hz, s) }); return s; });
    this.lab.label(room, 'Lucia’s food-stall kitchen — find 5 hazards', { y: 0.3 });
    const ui = this.ui;
    this.stH = ui.steps(['Find all **five hazards** (click the glowing spots)', 'Choose the right **fuse** for each appliance', 'Simulate a **fault** with and without the earth wire', 'Answer the analysis questions']);
    const hs = ui.section('Hazards found');
    this.hzBox = h('div', { class: 'muted', style: { fontSize: '.88em' } }, '0 / 5'); hs.append(this.hzBox);
    const fs = ui.section('Fuse selection (mains = 230 V)');
    this.fuseRows = APPLIANCES.map((a) => { const I = a.P / 230; const row = h('div', { class: 'row', style: { justifyContent: 'space-between', margin: '3px 0' } }, h('span', { style: { fontSize: '.86em' } }, `${a.name} · ${a.P} W · I = ${I.toFixed(2)} A`), h('span', { class: 'row', style: { gap: '4px' } }, ...[3, 5, 13].map((f) => h('button', { class: 'btn tiny', onClick: (e) => this.pickFuse(a, f, e.target) }, `${f} A`)))); fs.append(row); return row; });
    const fl = ui.section('Earth-wire fault test');
    ui.buttons([{ label: '⚡ Live wire touches the metal case — earthed', onClick: () => this.fault(true) }, { label: '⚡ Same fault — NOT earthed', onClick: () => this.fault(false) }], fl);
    ui.notes();
    ui.questions([
      { q: 'A fuse protects an appliance because…', opts: ['if the current is too large, the fuse wire heats up, melts and breaks the circuit', 'it stores extra charge', 'it lowers the voltage', 'it earths the case'], e: 'The heating effect of a current. A trip switch (circuit breaker) does the same job and can be reset.', o: [1, 3], sub: 'P4.4' },
      { q: 'A 2.0 kW heater is used for 3 hours. Electricity costs 30 cents per kWh. What does it cost (in cents)?', ans: 180, tol: 0.01, unit: 'cents', e: 'Energy = 2.0 kW × 3 h = 6 kWh; cost = 6 × 30 = {ans} cents.', o: [4], sub: 'P4.2.5' },
      { q: 'Why does a **double-insulated** hair-dryer not need an earth wire?', opts: ['Its case is plastic, so it can never become live', 'It uses d.c.', 'It has no fuse', 'It uses a lower voltage'], e: 'Appliances must be earthed or double insulated.', o: [4], sub: 'P4.4' },
    ], { sub: 'P4.4', onDone: () => { this.stH.done(3); this.checkTab('home', this.stH, 4); } });
    this.every((dt, t) => { this.spots.forEach((s, i) => { if (s.visible) s.scale.setScalar(1 + Math.sin(t * 4 + i) * 0.15); }); });
  }
  findHazard(hz, s) {
    if (this.hm.found.has(hz.id)) return;
    this.hm.found.add(hz.id); s.material.color.setRGB(0.3, 2.2, 0.6); audio.discover();
    this.ui.note(`⚠️ **${hz.name}:** ${hz.text}`, 'gold');
    this.hzBox.textContent = `${this.hm.found.size} / 5 — ${[...this.hm.found].map((id) => HAZARDS.find((x) => x.id === id).name).join(', ')}`;
    if (this.hm.found.size === 5) this.stH.done(0);
    this.checkTab('home', this.stH, 4);
  }
  pickFuse(a, f, btn) {
    const ok = f === a.fuse; btn.classList.add(ok ? 'good' : 'danger'); audio[ok ? 'success' : 'fail']();
    this.ui.note(ok ? `${a.name}: ${f} A ✓ — just above the normal current of ${(a.P / 230).toFixed(2)} A.` : `${a.name}: ${f} A ✗ — ${f < a.P / 230 ? 'it would blow in normal use' : 'too high to protect it'}.`, ok ? '' : 'warn');
    if (ok) this.hm.fuses[a.id] = true;
    if (APPLIANCES.every((x) => this.hm.fuses[x.id])) this.stH.done(1);
    this.checkTab('home', this.stH, 4);
  }
  fault(earthed) {
    this.hm.fault.add(earthed); audio.zap();
    this.ui.note(earthed ? 'Earthed: a **large current** flows from the live wire through the case to earth — the **fuse melts** (or the trip switch opens) and the toaster is made safe.' : 'Not earthed: the metal case is now **live at 230 V**. Anyone touching it becomes the path to earth — a potentially fatal shock.', earthed ? 'gold' : 'warn');
    if (this.hm.fault.size === 2) this.stH.done(2);
    this.checkTab('home', this.stH, 4);
  }
}
void clear; void clamp;
