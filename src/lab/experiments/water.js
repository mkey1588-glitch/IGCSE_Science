import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { Vessel, beaker, conicalFlask, Bunsen, tripod, Thermometer, Puffs, wire, mesh, mat, M, glassMaterial } from '../apparatus.js';
import { h, clear, clamp } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const STAGES = {
  screen: { name: 'Screening', short: 'Screen', icon: '🪤', what: 'A metal mesh removes large debris — sticks, leaves, plastic.' },
  sediment: { name: 'Sedimentation', short: 'Settle', icon: '🪨', what: 'Water stands still; heavy particles (silt, sand) sink to the bottom.' },
  filter: { name: 'Filtration (sand & gravel)', short: 'Sand', icon: '⏳', what: 'Layers of sand and gravel trap the remaining small insoluble particles.' },
  carbon: { name: 'Carbon (activated charcoal)', short: 'Carbon', icon: '⚫', what: 'Carbon adsorbs substances that cause tastes and odours.' },
  chlorine: { name: 'Chlorination', short: 'Cl₂', icon: '🧴', what: 'Chlorine kills bacteria and other pathogens.' },
};
const CORRECT = ['screen', 'sediment', 'filter', 'carbon', 'chlorine'];

export default class Water extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'The desalination plant has failed and Dr. Chen fears cholera. Run the island’s water treatment works safely — then make fresh water from the sea.';
    this.view = { pos: [-0.08, 1.5, 1.3], target: [-0.08, 1.06, 0] };
    this.order = ['chlorine', 'filter', 'screen', 'carbon', 'sediment'];
    this.dose = 0; this.flow = false; this.out = null;
    this.ds = { heat: false, T: 20, dist: 0, salt: 0, tests: new Set() };
  }
  quality() {
    let turb = 120, bact = 5000, debris = true, taste = 'earthy, unpleasant', notes = [];
    for (const s of this.order) {
      if (s === 'screen') { debris = false; turb *= 0.9; }
      if (s === 'sediment') { if (debris) notes.push('Debris is clogging the sedimentation tank.'); turb *= debris ? 0.6 : 0.3; bact *= 0.6; }
      if (s === 'filter') { if (turb > 60) { notes.push('The sand filter clogs fast — too much mud is reaching it.'); turb *= 0.35; } else turb *= 0.03; bact *= 0.3; }
      if (s === 'carbon') { taste = 'clean'; turb *= 0.8; }
      if (s === 'chlorine') { const shield = turb > 5 ? 0.25 : 0; bact *= Math.max(shield, this.dose >= 0.5 ? 0 : 1 - this.dose / 0.5); if (turb > 5) notes.push('Mud particles shield bacteria from the chlorine.'); }
    }
    if (this.dose > 3) taste = 'strong chlorine taste — overdosed';
    return { turb, bact: Math.round(bact), debris, taste, cl: this.dose, notes, safe: turb < 1 && bact < 1 && taste === 'clean' && this.dose >= 0.5 && this.dose <= 2 && !debris };
  }
  build() {
    const Y = this.Y;
    // ---- treatment plant model
    const xs = [-0.44, -0.36, -0.28, -0.2, -0.12];
    this.tanks = xs.map((x, i) => { const v = new Vessel([[0, 0.003], [0.032, 0.003], [0.032, 0.08]], { color: '#92400e', level: 0.7, opacity: 0.7 }); this.lab.add(v, x, Y, 0); return v; });
    this.tankLbl = xs.map((x, i) => this.lab.label(this.tanks[i], '', { y: 0.11, cls: 'dimlab' }));
    for (let i = 0; i < xs.length - 1; i++) this.lab.add(wire([[xs[i] + 0.03, Y + 0.07, 0], [xs[i] + 0.04, Y + 0.09, 0], [xs[i + 1] - 0.03, Y + 0.07, 0]], '#64748b', 0.004));
    this.lab.add(wire([[-0.09, Y + 0.07, 0], [-0.07, Y + 0.09, 0.0], [-0.05, Y + 0.09, 0.06], [-0.05, Y + 0.07, 0.1]], '#64748b', 0.004));
    this.glass = beaker({ r: 0.022, h: 0.06, color: '#92400e', level: 0, opacity: 0.6 }); this.lab.add(this.glass, -0.05, Y, 0.12);
    this.lab.label(this.glass, 'Tap water', { y: 0.09 });
    const intake = this.lab.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), mat('#334155', 0.2, 0.6)), -0.52, Y + 0.025, 0);
    this.lab.label(intake, 'River intake', { y: 0.06, cls: 'dimlab' });
    // flow particles
    const N = 70; this.fp = new THREE.InstancedMesh(new THREE.SphereGeometry(0.004, 6, 5), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }), N); this.fp.frustumCulled = false; this.lab.add(this.fp, 0, 0, 0);
    this.fpU = Array.from({ length: N }, (_, i) => i / N); this._o = new THREE.Object3D(); this._c = new THREE.Color();
    this.path = new THREE.CatmullRomCurve3([[-0.52, 0.075, 0], ...xs.map((x) => [x, 0.06, 0]), [-0.07, 0.085, 0.02], [-0.05, 0.07, 0.1]].map(([x, y, z]) => new THREE.Vector3(x, Y + y, z)));
    // ---- distillation (desalination)
    this.burner = new Bunsen(); this.lab.add(this.burner, 0.08, Y, -0.02); this.lab.add(tripod(), 0.08, Y, -0.02);
    this.fl = conicalFlask({ rb: 0.05, rn: 0.014, h: 0.13, color: '#bae6fd', level: 0.55, opacity: 0.55 }); this.lab.add(this.fl, 0.08, Y + 0.205, -0.02);
    this.lab.label(this.fl, 'Sea water', { y: 0.17, x: -0.06 });
    this.salt = mesh(new THREE.CylinderGeometry(0.044, 0.048, 0.006, 20), mat('#f8fafc', 0, 0.9), 0, 0.006, 0); this.salt.scale.y = 0.01; this.fl.add(this.salt);
    this.th = new Thermometer(0.12, 0, 110); this.lab.add(this.th, 0.08, Y + 0.31, -0.02);
    const cond = new THREE.Group(); this.lab.add(cond, 0.19, Y + 0.3, -0.02); cond.rotation.z = -1.0;
    cond.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.3, 10, 1, true), glassMaterial(), 0, -0.02, 0), mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 18, 1, true), glassMaterial('#bfdbfe', 0.08, 0.6), 0, -0.02, 0));
    this.coolW = mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.2, 16), new THREE.MeshStandardMaterial({ color: '#60a5fa', transparent: true, opacity: 0.25, depthWrite: false }), 0, -0.02, 0); cond.add(this.coolW);
    this.lab.label(cond, 'Condenser (cold water in at the bottom)', { y: 0.06 });
    this.lab.add(wire([[0.08, Y + 0.34, -0.02], [0.1, Y + 0.38, -0.02], [0.12, Y + 0.38, -0.02], [0.155, Y + 0.355, -0.02]], '#e2e8f0', 0.004));
    this.bk = beaker({ r: 0.03, h: 0.07, color: '#e0f2fe', level: 0, opacity: 0.45 }); this.lab.add(this.bk, 0.32, Y, -0.02); this.lab.label(this.bk, 'Distillate', { y: 0.1 });
    this.drip = mesh(new THREE.SphereGeometry(0.003, 8, 6), new THREE.MeshStandardMaterial({ color: '#bfdbfe' })); this.lab.add(this.drip, 0.315, Y + 0.12, -0.02);
    this.steam = new Puffs({ color: '#ffffff', size: 0.018, rise: 0.03, life: 1.0, opacity: 0.16 }); this.lab.add(this.steam, 0.08, Y + 0.33, -0.02);

    const ui = this.ui;
    this.st = ui.steps(['Put the treatment stages in the **correct order**', 'Set a **chlorine dose** that makes the water safe without spoiling the taste', 'Desalinate sea water by **simple distillation**', 'Prove the distillate is **pure water**', 'Answer the analysis questions']);
    const sec = ui.section('Treatment works');
    this.orderBox = h('div'); sec.append(this.orderBox); this.drawOrder();
    ui.slider({ label: 'Chlorine dose', min: 0, max: 5, step: 0.25, value: 0, unit: 'mg/dm³', parent: sec, onInput: (v) => { this.dose = v; this.refresh(); } });
    ui.buttons([{ label: '▶ Run the works', kind: 'primary', onClick: () => { this.flow = true; this.refresh(); audio.pour(); } }, { label: '⏹ Stop', onClick: () => { this.flow = false; } }], sec);
    this.ro = ui.readouts([{ id: 'tu', label: 'Cloudiness', unit: 'NTU' }, { id: 'b', label: 'Bacteria /100 cm³' }, { id: 'ta', label: 'Taste & smell' }, { id: 's', label: 'Safe to drink?' }], sec);
    const ds = ui.section('Desalination: simple distillation');
    ui.buttons([{ label: '🔥 Heat sea water', kind: 'primary', onClick: () => { this.ds.heat = true; this.burner.set('roaring'); } }, { label: '⏹ Stop', onClick: () => { this.ds.heat = false; this.burner.set('off'); } }], ds);
    ui.buttons([{ label: '🧪 Anhydrous CuSO₄ test', onClick: () => this.testDist('cu') }, { label: '🌡️ Boiling point of distillate', onClick: () => this.testDist('bp') }, { label: '🌡️ Boiling point of sea water', onClick: () => this.testDist('sea') }], ds);
    this.ro2 = ui.readouts([{ id: 'T', label: 'Vapour temperature', unit: '°C' }, { id: 'd', label: 'Distillate', unit: 'cm³' }], ds);
    ui.notes();
    ui.questions([
      { q: 'What does **filtration** through sand remove from the water?', opts: ['Small insoluble particles', 'Dissolved salts', 'Bacteria only', 'Chlorine'], e: 'Dissolved substances pass through filters — that is why sea water needs distillation.', o: [4], sub: 'C10.1' },
      { q: 'Why is chlorine added at the **end** of treatment?', opts: ['To kill pathogens such as the bacteria that cause cholera', 'To remove mud', 'To make the water soft', 'To remove salt'], e: 'Clean drinking water is one of the best ways to stop the spread of disease.', o: [5], sub: 'B10.1' },
      { q: 'Simple distillation separates…', opts: ['a solvent from a solution (e.g. water from salt water)', 'two liquids with similar boiling points', 'an insoluble solid from a liquid', 'coloured dyes'], e: 'The water boils off and condenses; the salt stays behind.', o: [1, 2], sub: 'C12.4' },
      { q: 'Sea water boils at about **100.6 °C**. This shows it is…', opts: ['impure — dissolved salts raise the boiling point', 'pure water', 'denser than steam', 'acidic'], e: 'Pure water boils at exactly 100 °C (at sea-level pressure).', o: [3], sub: 'C12.4' },
      { q: 'Why does the **carbon** stage come before chlorination?', opts: ['Carbon removes tastes and odours; chlorine must stay in the water to keep it safe in the pipes', 'Carbon kills bacteria', 'Carbon adds minerals', 'It doesn’t matter'], e: 'Carbon would also remove chlorine if it came afterwards.', o: [4], sub: 'C10.1' },
      { q: 'Why is **distilled** water used in the laboratory instead of tap water?', opts: ['It contains no dissolved ions that could interfere with experiments', 'It is colder', 'It is acidic', 'It has added chlorine'], e: 'Tap water contains dissolved salts and chlorine.', o: [3], sub: 'C10.1' },
    ], { sub: 'C10.1', onDone: () => { this.st.done(4); this.check(); } });
    this.refresh();
    this.every((dt, t) => this.sim(dt, t));
  }
  drawOrder() {
    clear(this.orderBox);
    this.order.forEach((k, i) => {
      const s = STAGES[k];
      this.orderBox.append(h('div', { class: 'row', style: { justifyContent: 'space-between', margin: '3px 0', padding: '4px 8px', background: 'rgba(255,255,255,.04)', borderRadius: '8px' }, title: s.what },
        h('span', { style: { fontSize: '.9em' } }, `${i + 1}. ${s.icon} ${s.name}`),
        h('span', { class: 'row', style: { gap: '4px' } }, h('button', { class: 'btn tiny', onClick: () => this.move(i, -1) }, '▲'), h('button', { class: 'btn tiny', onClick: () => this.move(i, 1) }, '▼'))));
    });
  }
  move(i, d) { const j = i + d; if (j < 0 || j >= this.order.length) return; [this.order[i], this.order[j]] = [this.order[j], this.order[i]]; audio.click(); this.drawOrder(); this.refresh(); }
  refresh() {
    const q = this.quality(); this.out = q;
    this.order.forEach((k, i) => this.tankLbl[i].userData.set(STAGES[k].short));
    this.ro.set('tu', q.turb.toFixed(1)); this.ro.set('b', q.bact); this.ro.set('ta', q.taste); this.ro.set('s', q.safe ? '✅ yes' : '❌ no');
    // tank colours along the chain
    let turb = 120;
    this.order.forEach((k, i) => {
      if (k === 'screen') turb *= 0.9; if (k === 'sediment') turb *= 0.35; if (k === 'filter') turb *= turb > 60 ? 0.35 : 0.03; if (k === 'carbon') turb *= 0.8;
      this.tanks[i].setColor(new THREE.Color('#e0f2fe').lerp(new THREE.Color('#92400e'), clamp(turb / 120, 0, 1)).getStyle(), 0.6);
    });
    if (!this.flow) return;
    const orderOK = this.order.every((k, i) => k === CORRECT[i]);
    if (orderOK && !this.st.isDone(0)) { this.st.done(0); this.ui.note('Correct order: **screening → sedimentation → filtration → carbon → chlorination**. Big things first, microbes last.', 'gold'); }
    if (!orderOK && !this._orderWarn) { this._orderWarn = true; this.ui.note(q.notes[0] || 'The water is not clean yet — think about which stage should come first.', 'warn'); }
    if (orderOK && q.safe && !this.st.isDone(1)) { this.st.done(1); audio.success(); this.ui.note(`Safe, clear water with a little residual chlorine (${this.dose} mg/dm³) to keep it safe in the pipes.`, 'gold'); }
    if (orderOK && this.dose > 3 && !this._over) { this._over = true; this.ui.note('Too much chlorine: the water tastes bad and could be harmful. Turn it down.', 'warn'); }
    if (orderOK && this.dose < 0.5 && !this._under) { this._under = true; this.ui.note('Bacteria survive — not enough chlorine. Cholera risk!', 'warn'); }
    this.check();
  }
  testDist(k) {
    const d = this.ds;
    if (k === 'sea') { this.ui.note('Sea water boils at **100.6 °C** — dissolved salts raise the boiling point, so it is **impure**.'); d.tests.add('sea'); return; }
    if (d.dist < 2) { this.ui.hint('Collect some distillate first.', 2400); return; }
    audio.blip(); d.tests.add(k);
    if (k === 'cu') this.ui.note('Anhydrous copper(II) sulfate turns **white → blue**: the distillate is water.', 'gold');
    if (k === 'bp') this.ui.note('The distillate boils at exactly **100.0 °C** — it is **pure water**.', 'gold');
    if (d.tests.has('cu') && d.tests.has('bp')) this.st.done(3);
    this.check();
  }
  sim(dt, t) {
    const d = this.ds;
    this.burner.update(dt, t); this.fl.update(dt); this.bk.update(dt); this.glass.update(dt); this.tanks.forEach((v) => v.update(dt));
    // treatment flow
    const q = this.out;
    this.fp.visible = this.flow;
    if (this.flow) {
      for (let i = 0; i < this.fpU.length; i++) {
        this.fpU[i] = (this.fpU[i] + dt * 0.06) % 1;
        const u = this.fpU[i]; const p = this.path.getPointAt(u);
        this._o.position.copy(p); this._o.updateMatrix(); this.fp.setMatrixAt(i, this._o.matrix);
        const stage = Math.min(this.order.length - 1, Math.floor(u * 6) - 1);
        const mud = stage < 0 ? 1 : clamp(1 - (stage + 1) / 5, 0, 1) * (this.order.every((k, j) => k === CORRECT[j]) ? 1 : 1.4);
        this.fp.setColorAt(i, this._c.set('#e0f2fe').lerp(new THREE.Color('#92400e'), clamp(mud, 0, 1)));
      }
      this.fp.instanceMatrix.needsUpdate = true; if (this.fp.instanceColor) this.fp.instanceColor.needsUpdate = true;
      this.glass.setLevel(Math.min(0.8, this.glass.level + dt * 0.04));
      if (q) this.glass.setColor(new THREE.Color('#e0f2fe').lerp(new THREE.Color('#92400e'), clamp(q.turb / 60, 0, 1)).getStyle());
    }
    // distillation
    d.T = clamp(d.T + (d.heat ? 14 : -6) * dt, 20, d.heat ? 100 : 100);
    this.th.set(d.T); this.ro2.set('T', d.T.toFixed(0));
    const boiling = d.heat && d.T >= 99.5;
    this.steam.setRate(boiling ? 1.5 : 0); this.steam.update(dt);
    if (boiling) { d.dist = Math.min(40, d.dist + dt * 2.5); d.salt = d.dist / 40; this.fl.setLevel(0.55 - 0.35 * d.salt); this.bk.setLevel(d.dist / 50); this.salt.scale.y = 0.01 + d.salt * 1.5; }
    this.drip.visible = boiling; if (boiling) { this.drip.position.y -= dt * 0.15; if (this.drip.position.y < this.Y + 0.03) this.drip.position.y = this.Y + 0.12; }
    this.ro2.set('d', d.dist.toFixed(1));
    if (d.dist >= 10 && !this.st.isDone(2)) { this.st.done(2); this.ui.note('Water vapour condenses in the cold condenser and drips into the beaker. The **salt stays behind** in the flask.', 'gold'); this.check(); }
  }
  check() { if ([0, 1, 2, 3, 4].every((i) => this.st.isDone(i))) this.lab.complete(); }
  dispose() { this.burner?.dispose(); super.dispose(); }
}
void M;
