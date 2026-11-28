import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { Vessel, Balance, measuringCylinder, mesh, mat, M } from '../apparatus.js';
import { h, clamp, tweens } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const OBJ = [
  { id: 'wood', name: 'Wooden block', kind: 'regular', dims: [5, 4, 3], rho: 0.6, col: '#b45309' },
  { id: 'al', name: 'Aluminium block', kind: 'regular', dims: [4, 2, 2], rho: 2.7, col: '#cbd5e1', metal: 0.85 },
  { id: 'stone', name: 'Beach stone', kind: 'irregular', vol: 20, rho: 2.6, col: '#78716c' },
  { id: 'ice', name: 'Ice cube', kind: 'regular', dims: [3, 3, 3], rho: 0.92, col: '#e0f2fe', glassy: true },
  { id: 'cork', name: 'Cork', kind: 'irregular', vol: 15, rho: 0.24, col: '#d6a76c' },
  { id: 'toy', name: 'Plastic toy', kind: 'irregular', vol: 25, rho: 1.1, col: '#ef4444' },
];
const LIQ = [
  { id: 'oil', name: 'Cooking oil', rho: 0.92, col: '#facc15' },
  { id: 'sea', name: 'Sea water', rho: 1.03, col: '#7dd3fc' },
  { id: 'honey', name: 'Honey', rho: 1.42, col: '#d97706' },
];
const FACES = [{ id: 'big', name: '20 cm × 10 cm', A: 0.02 }, { id: 'side', name: '20 cm × 5 cm', A: 0.01 }, { id: 'end', name: '10 cm × 5 cm', A: 0.005 }];

export default class Density extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Will the festival raft float? Why do snowshoes stop you sinking? Kai at the harbour needs densities and pressures — measured properly.';
    this.tabLabels = [['density', '🧱 Density'], ['pressure', '🏖️ Pressure']];
    this.tabObjectives = { density: ['P1.4', 'P1.1'], pressure: ['P1.7'] };
    this.tabViews = { density: { pos: [0, 1.42, 1.0], target: [0, 1.02, 0] }, pressure: { pos: [0, 1.36, 0.85], target: [0, 1.0, 0] } };
    this.view = this.tabViews.density;
  }

  // ======================================================== density
  tab_density() {
    const Y = this.Y;
    this.dn = { cur: OBJ[0], measured: {}, solved: new Set(), predicted: {}, tested: new Set(), liq: null };
    this.bal = new Balance(); this.lab.add(this.bal, -0.25, Y, 0.02); this.lab.label(this.bal, 'Balance', { y: 0.08, cls: 'dimlab' });
    this.cyl = measuringCylinder({ r: 0.022, h: 0.24, level: 0.42, color: '#bfdbfe', opacity: 0.5 }); this.lab.add(this.cyl, -0.05, Y, 0.02);
    this.lab.label(this.cyl, 'Measuring cylinder (cm³)', { y: 0.28 });
    this.tank = new Vessel([[0, 0.003], [0.1, 0.003], [0.1, 0.12]], { color: '#38bdf8', level: 0.65, opacity: 0.4 }); this.lab.add(this.tank, 0.22, Y, 0.0);
    this.tankLbl = this.lab.label(this.tank, 'Tank of water (1.00 g/cm³)', { y: 0.15 });
    this.objMesh = null; this.place(OBJ[0], 'bal');
    const ui = this.ui;
    this.st = ui.steps(['Find the density of a **regular solid** (measure its sides)', 'Find the density of an **irregular solid** (displacement)', 'Find the density of a **liquid**', 'Predict, then test, **float or sink** for four objects', 'Answer the analysis questions']);
    const sec = ui.section('Object');
    ui.select({ label: 'Choose an object', options: OBJ.map((o) => [o.id, `${o.name} (${o.kind})`]), value: 'wood', parent: sec, onChange: (v) => { this.dn.cur = OBJ.find((o) => o.id === v); this.place(this.dn.cur, 'bal'); } });
    ui.buttons([{ label: '⚖️ Weigh', onClick: () => this.weigh() }, { label: '📏 Measure sides', onClick: () => this.measureSides() }, { label: '💧 Displacement', onClick: () => this.displace() }], sec);
    this.ro = ui.readouts([{ id: 'm', label: 'Mass', unit: 'g' }, { id: 'V', label: 'Volume', unit: 'cm³' }, { id: 'rho', label: 'Your density' }], sec);
    const calc = h('div', { class: 'num', style: { display: 'flex', gap: '6px', margin: '6px 0' } });
    const inp = h('input', { type: 'text', placeholder: 'density = m ÷ V', inputmode: 'decimal' });
    const fb = h('div', { class: 'faint', style: { fontSize: '.85em' } });
    calc.append(inp, h('span', { class: 'faint', style: { alignSelf: 'center' } }, 'g/cm³'), h('button', { class: 'btn small primary', onClick: () => this.checkDensity(+inp.value, fb) }, 'Check'));
    sec.append(calc, fb);
    this.tbl = ui.table(['Object', 'm / g', 'V / cm³', 'ρ / g/cm³'], sec);
    const fl = ui.section('Float or sink in water?');
    this.predBox = h('div'); fl.append(this.predBox); this.drawPred();
    const lq = ui.section('Liquids');
    ui.select({ label: 'Liquid', options: [['', '— choose —'], ...LIQ.map((l) => [l.id, l.name])], value: '', parent: lq, onChange: (v) => this.liquid(v) });
    ui.notes();
    ui.questions([
      { q: 'A block has mass 540 g and volume 200 cm³. Its density is…', ans: 2.7, tol: 0.01, unit: 'g/cm³', e: 'ρ = m ÷ V = 540 ÷ 200 = {ans} g/cm³ — aluminium!', o: [1] },
      { q: 'How do you find the volume of an irregular stone?', opts: ['Lower it into water in a measuring cylinder and find the rise in level', 'Measure its length with a ruler', 'Weigh it', 'Divide its mass by 1000'], e: 'The displaced water has the same volume as the stone.', o: [2] },
      { q: 'Ice (0.92 g/cm³) is put into cooking oil (0.92 g/cm³) and sea water (1.03 g/cm³). It…', opts: ['floats in sea water; neither floats nor sinks well in oil', 'sinks in both', 'floats in both easily', 'sinks in sea water'], e: 'Objects less dense than a liquid float in it.', o: [3] },
      { q: 'When reading a measuring cylinder you should…', opts: ['read the bottom of the meniscus at eye level', 'read the top of the meniscus from above', 'tilt the cylinder', 'read it from below'], e: 'Avoid parallax error.', o: [1], sub: 'P1.1' },
    ], { sub: 'P1.4', onDone: () => { this.st.done(4); this.checkTab('density', this.st, 5); } });
    this.every((dt) => { this.cyl.update(dt); this.tank.update(dt); if (this.bob) { this.bob.t += dt; const o = this.bob; o.mesh.position.y = o.base + Math.sin(o.t * 2) * 0.002; } });
  }
  volOf(o) { return o.kind === 'regular' ? o.dims[0] * o.dims[1] * o.dims[2] : o.vol; }
  place(o, where) {
    if (this.objMesh) { this.objMesh.parent?.remove(this.objMesh); this.objMesh = null; }
    this.bob = null;
    const s = 0.008; let m;
    if (o.kind === 'regular') m = mesh(new THREE.BoxGeometry(o.dims[0] * s, o.dims[2] * s, o.dims[1] * s), new THREE.MeshPhysicalMaterial({ color: o.col, roughness: o.glassy ? 0.05 : 0.6, metalness: o.metal || 0, transparent: !!o.glassy, opacity: o.glassy ? 0.75 : 1 }));
    else m = mesh(new THREE.DodecahedronGeometry(Math.cbrt(o.vol) * s * 0.62, 0), mat(o.col, 0, 0.8));
    m.userData.h = o.kind === 'regular' ? o.dims[2] * s : Math.cbrt(o.vol) * s;
    this.objMesh = m;
    if (where === 'bal') this.lab.add(m, -0.25, this.Y + this.bal.top + m.userData.h / 2, 0);
    this.cyl.setLevel(0.42); this.bal.set(0);
    this.ro?.set('m', '—'); this.ro?.set('V', '—'); this.ro?.set('rho', '—');
  }
  weigh() { const o = this.dn.cur; const m = o.rho * this.volOf(o); this.bal.set(m); this.ro.set('m', m.toFixed(1)); (this.dn.measured[o.id] = this.dn.measured[o.id] || {}).m = m; audio.clink(); this.addRow(o); }
  measureSides() {
    const o = this.dn.cur;
    if (o.kind !== 'regular') { this.ui.hint('This object is irregular — a ruler can’t give its volume. Use displacement.', 3000); return; }
    const V = this.volOf(o); (this.dn.measured[o.id] = this.dn.measured[o.id] || {}).V = V;
    this.ro.set('V', `${V.toFixed(0)}`); this.ui.note(`Ruler: ${o.dims.join(' cm × ')} cm → V = l × w × h = **${V} cm³**.`); audio.blip(); this.addRow(o);
  }
  async displace() {
    const o = this.dn.cur; if (this.busy) return; this.busy = true;
    const V = this.volOf(o), m = this.objMesh;
    if (o.rho < 1) { this.ui.note(`The ${o.name.toLowerCase()} **floats**, so it doesn’t sink fully — push it under with a thin pin to measure its whole volume.`); }
    const top = new THREE.Vector3(-0.05, this.Y + 0.3, 0.02);
    await tweens.to(m.position, { x: top.x, y: top.y, z: top.z }, 0.6).promise;
    await tweens.to(m.position, { y: this.Y + 0.03 }, 0.7).promise;
    const L0 = 0.42, cap = 100; // 50 cm³ of water in a 100 cm³ cylinder ≈ level 0.42 → mark 50
    this.cyl.setLevel(L0 * (50 + V) / 50);
    (this.dn.measured[o.id] = this.dn.measured[o.id] || {}).V = V; void cap;
    this.ro.set('V', V.toFixed(0)); audio.splash?.(0.3);
    this.ui.note(`Water level rose from **50 cm³** to **${50 + V} cm³** → volume of the ${o.name.toLowerCase()} = **${V} cm³**.`);
    this.busy = false; this.addRow(o);
  }
  addRow(o) {
    const r = this.dn.measured[o.id];
    this.ro.set('m', r.m != null ? r.m.toFixed(1) : '—'); this.ro.set('V', r.V != null ? r.V.toFixed(0) : '—');
  }
  checkDensity(v, fb) {
    const o = this.dn.cur, r = this.dn.measured[o.id] || {};
    if (r.m == null || r.V == null) { fb.textContent = 'Measure the mass and the volume first.'; return; }
    const rho = r.m / r.V;
    if (Math.abs(v - rho) <= rho * 0.03 + 0.005) {
      fb.textContent = `✅ ρ = ${r.m.toFixed(1)} ÷ ${r.V.toFixed(0)} = ${rho.toFixed(2)} g/cm³`; audio.success(); this.ro.set('rho', `${rho.toFixed(2)} g/cm³`);
      if (!this.dn.solved.has(o.id)) { this.dn.solved.add(o.id); this.tbl.add([o.name, r.m.toFixed(1), r.V.toFixed(0), `<b>${rho.toFixed(2)}</b>`]); }
      if (o.kind === 'regular') this.st.done(0); else this.st.done(1);
      this.checkTab('density', this.st, 5);
    } else { fb.textContent = '❌ Density = mass ÷ volume.'; audio.fail(); }
  }
  drawPred() {
    const box = this.predBox; while (box.firstChild) box.removeChild(box.firstChild);
    for (const o of OBJ) {
      const p = this.dn.predicted[o.id], tested = this.dn.tested.has(o.id), sinks = o.rho > 1;
      box.append(h('div', { class: 'row', style: { justifyContent: 'space-between', margin: '3px 0' } }, h('span', { style: { fontSize: '.86em' } }, `${tested ? (p === (sinks ? 'sink' : 'float') ? '✅' : '❌') : '•'} ${o.name}`),
        h('span', { class: 'row', style: { gap: '4px' } }, ...['float', 'sink'].map((k) => h('button', { class: `btn tiny ${p === k ? 'good' : ''}`, onClick: () => { if (tested) return; this.dn.predicted[o.id] = k; this.drawPred(); } }, k)), h('button', { class: 'btn tiny primary', onClick: () => this.dropIn(o) }, '🌊 test'))));
    }
  }
  async dropIn(o) {
    if (!this.dn.predicted[o.id]) { this.ui.hint('Make a prediction first!', 2000); return; }
    if (this.busy) return; this.busy = true;
    this.dn.cur = o; this.place(o, 'bal');
    const m = this.objMesh, surf = this.Y + this.tank.surfaceY();
    await tweens.to(m.position, { x: 0.22, y: this.Y + 0.25, z: 0 }, 0.6).promise;
    const hgt = m.userData.h;
    const target = o.rho < 1 ? surf - hgt * (o.rho - 0.5) : this.Y + 0.003 + hgt / 2;
    await tweens.to(m.position, { y: target }, o.rho > 1 ? 1.2 : 0.8, { ease: (t) => 1 - Math.pow(1 - t, 2) }).promise;
    audio.splash?.(0.4);
    if (o.rho < 1) this.bob = { mesh: m, base: target, t: 0 };
    this.dn.tested.add(o.id); this.busy = false;
    this.ui.note(`${o.name} (ρ = ${o.rho} g/cm³) **${o.rho < 1 ? 'floats' : 'sinks'}** — it is ${o.rho < 1 ? 'less' : 'more'} dense than water.`);
    this.drawPred();
    if (this.dn.tested.size >= 4 && !this.st.isDone(3)) { this.st.done(3); this.ui.note('Rule: an object **floats** if its density is **less** than the liquid’s, and **sinks** if it is greater.', 'gold'); }
    this.checkTab('density', this.st, 5);
  }
  liquid(id) {
    const l = LIQ.find((x) => x.id === id); if (!l) return;
    const empty = 112.4, m = l.rho * 50;
    this.cyl.setColor(l.col); this.cyl.setLevel(0.42); audio.pour();
    this.ui.note(`${l.name}: empty cylinder **${empty.toFixed(1)} g**; with 50.0 cm³ of liquid **${(empty + m).toFixed(1)} g** → mass of liquid ${m.toFixed(1)} g → ρ = ${m.toFixed(1)} ÷ 50.0 = **${l.rho.toFixed(2)} g/cm³**.`, 'gold');
    this.tbl.add([l.name, m.toFixed(1), '50', `<b>${l.rho.toFixed(2)}</b>`]);
    this.st.done(2); this.checkTab('density', this.st, 5);
  }

  // ======================================================== pressure
  tab_pressure() {
    const Y = this.Y;
    this.pr = { face: 'big', F: 20, tried: new Set(), forces: new Set() };
    const tray = new THREE.Group(); this.lab.add(tray, -0.05, Y, 0);
    tray.add(mesh(new THREE.BoxGeometry(0.36, 0.06, 0.24), mat('#78350f', 0, 0.8), 0, 0.03, 0));
    const W = 96, D = 64; this.sandGeo = new THREE.PlaneGeometry(0.34, 0.22, W, D); this.sandGeo.rotateX(-Math.PI / 2);
    this.sand = mesh(this.sandGeo, mat('#e7c48a', 0, 1)); this.sand.position.y = 0.06; tray.add(this.sand);
    this.sand0 = Float32Array.from(this.sandGeo.attributes.position.array);
    this.brick = mesh(new THREE.BoxGeometry(0.2, 0.05, 0.1), mat('#b91c1c', 0, 0.85)); tray.add(this.brick);
    this.extra = new THREE.Group(); this.brick.add(this.extra);
    this.lab.label(tray, 'Sand tray', { y: 0.12, x: -0.15, cls: 'dimlab' });
    this.tray = tray;
    const ui = this.ui;
    this.stP = ui.steps(['Stand the brick on **all three faces**', 'Double the **force** on one face', { t: 'Calculate a **pressure** (p = F ÷ A)', q: true }, 'Answer the analysis questions']);
    const sec = ui.section('Brick on sand');
    ui.seg({ label: 'Face in contact', options: FACES.map((f) => [f.id, f.name]), value: 'big', parent: sec, onChange: (v) => { this.pr.face = v; this.setBrick(); } });
    ui.seg({ label: 'Force (brick + extra weights)', options: [[20, '20 N'], [40, '40 N'], [60, '60 N']], value: 20, parent: sec, onChange: (v) => { this.pr.F = +v; this.setBrick(); } });
    this.roP = ui.readouts([{ id: 'A', label: 'Area', unit: 'm²' }, { id: 'p', label: 'Pressure', unit: 'Pa' }, { id: 'd', label: 'Dent depth', unit: 'mm' }], sec);
    ui.notes();
    ui.questions([
      { q: 'A 600 N person stands on snowshoes with a total area of 0.30 m². What pressure do they exert?', ans: 2000, tol: 0.01, unit: 'Pa', e: 'p = F ÷ A = 600 ÷ 0.30 = {ans} Pa.', o: [2] },
      { q: 'Why do sharp knives cut more easily than blunt ones?', opts: ['The small area of the edge gives a large pressure', 'They are heavier', 'They have a larger area', 'They are made of a denser metal'], e: 'Same force, smaller area → bigger pressure.', o: [1] },
      { q: 'Tractors have wide tyres so that…', opts: ['the pressure on the soft ground is lower and they don’t sink', 'they go faster', 'they weigh less', 'they grip less'], e: 'A larger area spreads the force.', o: [1] },
    ], { sub: 'P1.7', onDone: () => { this.stP.done(3); this.checkTab('pressure', this.stP, 4); } });
    this.setBrick();
  }
  setBrick() {
    const f = FACES.find((x) => x.id === this.pr.face), F = this.pr.F, p = F / f.A;
    const dims = { big: [0.2, 0.05, 0.1], side: [0.2, 0.1, 0.05], end: [0.05, 0.2, 0.1] }[f.id];
    this.brick.geometry.dispose(); this.brick.geometry = new THREE.BoxGeometry(...dims);
    const depth = clamp(p / 12000 * 0.03, 0.001, 0.035);
    // deform sand
    const pos = this.sandGeo.attributes.position, a = this.sand0;
    for (let i = 0; i < pos.count; i++) {
      const x = a[i * 3], z = a[i * 3 + 2]; const inside = Math.abs(x) < dims[0] / 2 && Math.abs(z) < dims[2] / 2;
      const edge = Math.max(0, 1 - Math.max((Math.abs(x) - dims[0] / 2) / 0.015, (Math.abs(z) - dims[2] / 2) / 0.015));
      pos.setY(i, a[i * 3 + 1] - (inside ? depth : depth * 0.4 * Math.max(0, edge)) + (inside ? 0 : Math.max(0, edge) * 0.002));
    }
    pos.needsUpdate = true; this.sandGeo.computeVertexNormals();
    this.brick.position.set(0, 0.06 - depth + dims[1] / 2, 0);
    while (this.extra.children.length) this.extra.remove(this.extra.children[0]);
    for (let i = 0; i < F / 20 - 1; i++) this.extra.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 20), M.steel, 0, dims[1] / 2 + 0.01 + i * 0.021, 0));
    this.roP.set('A', f.A.toFixed(3)); this.roP.set('p', p.toFixed(0)); this.roP.set('d', (depth * 1000 / 3).toFixed(1));
    audio.clink();
    this.pr.tried.add(f.id); this.pr.forces.add(`${f.id}${F}`);
    if (this.pr.tried.size === 3 && !this.stP.isDone(0)) { this.stP.done(0); this.ui.note('Same weight, smaller area → **bigger pressure** → deeper dent.', 'gold'); }
    const sameFace = FACES.some((fc) => this.pr.forces.has(`${fc.id}20`) && this.pr.forces.has(`${fc.id}40`));
    if (sameFace && !this.stP.isDone(1)) { this.stP.done(1); this.ui.note('Doubling the force on the same area **doubles the pressure**: p = F ÷ A.', 'gold'); }
    const k = this.ui.body.querySelector('.aq'); if (k?.classList.contains('solved')) this.stP.done(2);
    this.checkTab('pressure', this.stP, 4);
  }
  update(dt, t) {
    super.update(dt, t);
    if (this.tab === 'pressure' && this.stP && !this.stP.isDone(2)) { const k = this.ui.body?.querySelector('.aq'); if (k?.classList.contains('solved')) { this.stP.done(2); this.checkTab('pressure', this.stP, 4); } }
  }
  checkTab(id, st) { st.check(); }
}
