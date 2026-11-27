import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { beaker, PowerSupply, Meter, Bunsen, tripod, Bubbles, Puffs, wire, mesh, mat, M } from '../apparatus.js';
import { clamp } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const EL = {
  pbbr2: { name: 'Molten lead(II) bromide', color: '#f5e6c8', molten: true, cat: { ion: 'Pb²⁺', col: '#94a3b8', product: 'lead (silvery beads)', solid: '#cbd5e1' }, an: { ion: 'Br⁻', col: '#b45309', product: 'bromine (red-brown vapour)', gas: '#9a3412' }, half: ['Pb²⁺ + 2e⁻ → Pb', '2Br⁻ → Br₂ + 2e⁻'], electrodes: 'C' },
  brine: { name: 'Concentrated sodium chloride solution', color: '#e0f2fe', cat: { ion: 'Na⁺, H⁺', col: '#a855f7', product: 'hydrogen gas', bub: true, test: 'H2' }, an: { ion: 'Cl⁻, OH⁻', col: '#22c55e', product: 'chlorine gas (pale yellow-green)', bub: true, gas: '#bef264', test: 'Cl2' }, half: ['2H⁺ + 2e⁻ → H₂', '2Cl⁻ → Cl₂ + 2e⁻'], electrodes: 'C' },
  h2so4: { name: 'Dilute sulfuric acid', color: '#f1f5f9', cat: { ion: 'H⁺', col: '#f8fafc', product: 'hydrogen gas', bub: true, test: 'H2', rate: 2 }, an: { ion: 'OH⁻, SO₄²⁻', col: '#fde047', product: 'oxygen gas', bub: true, test: 'O2', rate: 1 }, half: ['2H⁺ + 2e⁻ → H₂', '4OH⁻ → O₂ + 2H₂O + 4e⁻'], electrodes: 'C' },
  cuso4c: { name: 'Copper(II) sulfate, carbon electrodes (S)', color: '#38bdf8', cat: { ion: 'Cu²⁺', col: '#0ea5e9', product: 'copper (pink coating)', coat: '#c8743c' }, an: { ion: 'OH⁻, SO₄²⁻', col: '#fde047', product: 'oxygen gas', bub: true, test: 'O2' }, half: ['Cu²⁺ + 2e⁻ → Cu', '4OH⁻ → O₂ + 2H₂O + 4e⁻'], electrodes: 'C', fades: true },
  cuso4cu: { name: 'Copper(II) sulfate, copper electrodes (S)', color: '#38bdf8', cat: { ion: 'Cu²⁺', col: '#0ea5e9', product: 'copper deposited (cathode grows)', coat: '#c8743c' }, an: { ion: '—', col: '#0ea5e9', product: 'copper anode dissolves (gets thinner)' }, half: ['Cu²⁺ + 2e⁻ → Cu', 'Cu → Cu²⁺ + 2e⁻'], electrodes: 'Cu' },
};

export default class Electrolysis extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Aluminium for the island bus and chrome for the festival stage are both made with electricity. Split compounds by electrolysis — then run the hydrogen bus’s fuel cell.';
    this.tabLabels = [['cell', '⚡ Electrolysis'], ['fuelcell', '🚌 Fuel cell']];
    this.tabObjectives = { cell: ['C4.1', 'C9.6', 'C6.3'], fuelcell: ['C4.2'] };
    this.tabViews = { cell: { pos: [0, 1.5, 1.15], target: [0, 1.04, 0] }, fuelcell: { pos: [0, 1.5, 1.2], target: [0, 1.05, 0] } };
    this.view = this.tabViews.cell;
  }
  tab_cell() {
    const Y = this.Y;
    this.key = 'brine'; this.V = 6; this.on = false; this.time = 0; this.done = new Set(); this.tested = new Set();
    this.burner = new Bunsen(); this.lab.add(this.burner, -0.1, Y, 0);
    const tp = tripod(); this.lab.add(tp, -0.1, Y, 0);
    this.bk = beaker({ r: 0.06, h: 0.1, color: '#e0f2fe', level: 0.75, opacity: 0.7 }); this.lab.add(this.bk, -0.1, Y + 0.205, 0);
    this.cath = mesh(new THREE.BoxGeometry(0.012, 0.16, 0.025), mat('#334155', 0.3, 0.6)); this.lab.add(this.cath, -0.13, Y + 0.23, 0);
    this.anod = mesh(new THREE.BoxGeometry(0.012, 0.16, 0.025), mat('#334155', 0.3, 0.6)); this.lab.add(this.anod, -0.07, Y + 0.23, 0);
    this.lab.label(this.cath, 'Cathode (−)', { y: 0.11, x: -0.045 }); this.lab.label(this.anod, 'Anode (+)', { y: 0.11, x: 0.045 });
    this.ps = new PowerSupply(); this.lab.add(this.ps, 0.2, Y, -0.05);
    this.am = new Meter('A'); this.lab.add(this.am, 0.18, Y, 0.12);
    this.lab.add(wire([[-0.13, Y + 0.31, 0], [-0.12, Y + 0.38, 0.02], [0.1, Y + 0.3, 0.05], [0.17, Y + 0.025, 0.02]], '#111827'));
    this.lab.add(wire([[-0.07, Y + 0.31, 0], [-0.04, Y + 0.36, -0.03], [0.15, Y + 0.25, -0.05], [0.23, Y + 0.025, -0.01]], '#dc2626'));
    this.cb = new Bubbles({ r: 0.006, y0: 0.0, y1: 0.08, size: 0.002 }); this.cath.add(this.cb); this.cb.position.y = -0.07;
    this.ab = new Bubbles({ r: 0.006, y0: 0.0, y1: 0.08, size: 0.002 }); this.anod.add(this.ab); this.ab.position.y = -0.07;
    this.vap = new Puffs({ color: '#9a3412', size: 0.04, rise: 0.06, opacity: 0.55, life: 2.6, spread: 0.02 }); this.vap.position.set(-0.07, Y + 0.32, 0); this.lab.tabRoot.add(this.vap);
    this.beads = new THREE.Group(); this.lab.add(this.beads, -0.13, Y + 0.21, 0);
    // ions
    this.ions = []; const ig = new THREE.SphereGeometry(0.0045, 8, 6);
    for (let i = 0; i < 36; i++) { const cat = i % 2 === 0; const m = new THREE.Mesh(ig, new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#000', emissiveIntensity: 0.4 })); m.userData = { cat, x: (Math.random() - 0.5) * 0.09, y: 0.02 + Math.random() * 0.05, z: (Math.random() - 0.5) * 0.06 }; this.bk.add(m); this.ions.push(m); }
    const ui = this.ui;
    this.st = ui.steps(['Electrolyse **molten lead(II) bromide** (heat it first!)', 'Electrolyse **concentrated brine** and test both gases', 'Electrolyse **dilute sulfuric acid**', { t: '(S) Electrolyse **copper(II) sulfate** with copper electrodes', o: ['C4.1.5'] }, 'Answer the analysis questions']);
    const sec = ui.section('Cell');
    ui.select({ label: 'Electrolyte', options: Object.entries(EL).map(([k, v]) => [k, v.name]), value: this.key, parent: sec, onChange: (v) => this.setEl(v) });
    ui.slider({ label: 'Supply voltage', min: 0, max: 12, step: 1, value: this.V, unit: 'V', parent: sec, onInput: (v) => { this.V = v; this.ps.set(v); } });
    ui.buttons([{ label: '⚡ Switch on', kind: 'primary', onClick: () => this.power(true) }, { label: '⏹ Off', onClick: () => this.power(false) }, { label: '🔥 Bunsen', onClick: () => this.burner.set(this.burner.state === 'off' ? 'roaring' : 'off') }], sec);
    ui.buttons([{ label: '🧪 Test gas at cathode', onClick: () => this.testGas('cat') }, { label: '🧪 Test gas at anode', onClick: () => this.testGas('an') }], sec);
    this.ro = ui.readouts([{ id: 'I', label: 'Current', unit: 'A' }, { id: 'c', label: 'At cathode (−)' }, { id: 'a', label: 'At anode (+)' }], sec);
    this.halfEl = ui.text('', sec);
    ui.notes();
    ui.questions([
      { q: 'Electrolysis of **molten lead(II) bromide** produces…', opts: ['lead at the cathode and bromine at the anode', 'bromine at the cathode and lead at the anode', 'hydrogen and oxygen', 'nothing — it is a covalent compound'], e: 'Positive Pb²⁺ ions go to the negative cathode.', o: [3], sub: 'C4.1' },
      { q: 'Why does solid lead(II) bromide **not** conduct?', opts: ['Its ions are fixed in the lattice and cannot move', 'It has no ions', 'It contains free electrons', 'It is too cold to react'], e: 'Ionic compounds conduct only when molten or dissolved.', o: [1], sub: 'C4.1' },
      { q: 'At the cathode in brine electrolysis, hydrogen forms instead of sodium because…', opts: ['sodium is more reactive than hydrogen, so H⁺ is discharged', 'sodium ions go to the anode', 'sodium is a gas', 'the cathode is positive'], e: 'Metals or hydrogen form at the cathode; the less reactive is discharged.', o: [6], sub: 'C4.1' },
      { q: 'The half-equation Cu²⁺ + 2e⁻ → Cu at the cathode is…', opts: ['reduction — gain of electrons', 'oxidation — loss of electrons', 'neutralisation', 'decomposition'], e: 'OIL RIG: reduction is gain of electrons.', o: [8], sub: 'C4.1' },
      { q: 'Aluminium is extracted from bauxite by electrolysis because…', opts: ['it is more reactive than carbon, so carbon cannot reduce it', 'electrolysis is cheaper than heating', 'aluminium is a liquid', 'bauxite contains no oxygen'], e: 'Position in the reactivity series decides the extraction method.', o: [1, 3], sub: 'C9.6' },
    ], { sub: 'C4.1', onDone: () => { this.st.done(4); this.checkTab(); } });
    this.setEl('brine'); this.ps.set(this.V);
    this.every((dt, t) => this.sim(dt, t));
    this.onTabDispose(() => { this.burner?.dispose?.(); this.burner = null; });
  }
  setEl(k) {
    this.key = k; const d = EL[k]; this.power(false); this.time = 0;
    this.bk.setColor(d.color); this.bk.setOpacity(d.molten ? 0.95 : 0.6);
    const cu = d.electrodes === 'Cu';
    this.cath.material.color.set(cu ? '#c8743c' : '#334155'); this.anod.material.color.set(cu ? '#c8743c' : '#334155');
    this.cath.scale.set(1, 1, 1); this.anod.scale.set(1, 1, 1);
    while (this.beads.children.length) this.beads.remove(this.beads.children[0]);
    this.ions.forEach((m) => { m.material.color.set(m.userData.cat ? d.cat.col : d.an.col); });
    this.ro.set('c', '—'); this.ro.set('a', '—'); this.halfEl.innerHTML = '';
    if (d.molten) { this.ui.hint('Lead(II) bromide must be **molten** to conduct — light the Bunsen.', 4000); }
  }
  power(on) { this.on = on; if (on) audio.zap(); }
  conducting() { const d = EL[this.key]; return this.on && this.V > 0 && (!d.molten || this.burner.state !== 'off'); }
  testGas(side) {
    const d = EL[this.key]; const p = side === 'cat' ? d.cat : d.an;
    if (!this.conducting() || this.time < 2 || !p.test) { this.ui.note(p.test ? 'No gas collected yet — run the electrolysis first.' : 'No gas is produced at this electrode.', 'warn'); return; }
    const res = { H2: ['lighted splint → **squeaky pop**: hydrogen', () => audio.pop()], O2: ['glowing splint **relights**: oxygen', () => audio.whoosh()], Cl2: ['damp litmus paper is **bleached**: chlorine', () => audio.fizz(0.4)] }[p.test];
    res[1](); this.ui.note(`Test at the ${side === 'cat' ? 'cathode' : 'anode'}: ${res[0]}.`, 'gold');
    this.tested.add(`${this.key}-${side}`);
    if (this.tested.has('brine-cat') && this.tested.has('brine-an')) this.st.done(1);
    this.checkTab();
  }
  sim(dt, t) {
    const d = EL[this.key]; const go = this.conducting();
    const I = go ? (this.V * 0.12) : 0;
    this.am.set(I);
    this.ro.set('I', I.toFixed(2));
    this.burner.update(dt, t); this.bk.update(dt);
    if (go) this.time += dt;
    const g = clamp(I * 3, 0, 8);
    this.cb.setRate(go && d.cat.bub ? g * (d.cat.rate || 1) : 0); this.ab.setRate(go && d.an.bub ? g * (d.an.rate || 1) : 0);
    this.cb.update(dt); this.ab.update(dt);
    this.vap.setColor(d.an.gas || '#ffffff'); this.vap.setRate(go && d.an.gas ? 2.5 : 0); this.vap.update(dt);
    // ion migration
    for (const m of this.ions) {
      const u = m.userData;
      const tx = u.cat ? -0.03 : 0.03;
      if (go) u.x += (tx - u.x) * dt * 0.6 + (Math.random() - 0.5) * 0.004; else u.x += (Math.random() - 0.5) * 0.004;
      u.x = clamp(u.x, -0.05, 0.05); u.y += (Math.random() - 0.5) * 0.003; u.y = clamp(u.y, 0.01, 0.07); u.z = clamp(u.z + (Math.random() - 0.5) * 0.003, -0.04, 0.04);
      if (go && Math.abs(u.x - tx) < 0.006) { u.x = (Math.random() - 0.5) * 0.09 * (u.cat ? -1 : 1) * -1; }
      m.position.set(u.x, u.y, u.z);
    }
    if (go && this.time > 1.5) {
      this.ro.set('c', d.cat.product); this.ro.set('a', d.an.product);
      if (!this.halfEl.innerHTML) this.halfEl.innerHTML = `<b>Cathode (reduction):</b> ${d.half[0]}<br><b>Anode (oxidation):</b> ${d.half[1]}`;
      if (d.cat.solid && this.beads.children.length < 12 && Math.random() < dt * 2) { const b = mesh(new THREE.SphereGeometry(0.004 + Math.random() * 0.003, 8, 6), mat('#cbd5e1', 0.9, 0.2)); b.position.set((Math.random() - 0.5) * 0.02, -0.003 - Math.random() * 0.01, (Math.random() - 0.5) * 0.02); this.beads.add(b); }
      if (d.cat.coat) { this.cath.material.color.lerp(new THREE.Color(d.cat.coat), dt * 0.3); this.cath.scale.x = Math.min(1.6, this.cath.scale.x + dt * 0.03); }
      if (this.key === 'cuso4cu') this.anod.scale.x = Math.max(0.4, this.anod.scale.x - dt * 0.03);
      if (d.fades) this.bk.liqMat.color.lerp(new THREE.Color('#e0f2fe'), dt * 0.05);
      if (this.time > 4 && !this.done.has(this.key)) {
        this.done.add(this.key); audio.discover();
        this.ui.note(`${d.name}: cathode → **${d.cat.product}**; anode → **${d.an.product}**.`, 'gold');
        if (this.key === 'pbbr2') this.st.done(0);
        if (this.key === 'h2so4') this.st.done(2);
        if (this.key === 'cuso4cu') this.st.done(3);
        this.checkTab();
      }
    } else if (this.on && EL[this.key].molten && this.burner.state === 'off' && !this._warned) { this._warned = true; this.ui.note('No current: solid lead(II) bromide does not conduct — its ions cannot move.', 'warn'); }
  }
  checkTab() { this.st.check(); }

  tab_fuelcell() {
    const Y = this.Y;
    this.h2 = 0.6; this.o2 = 0.6; this.water = 0; this.tested2 = false;
    const tank = (x, col, name) => { const g = new THREE.Group(); this.lab.add(g, x, Y, -0.05); g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 20), mat(col, 0.4, 0.3), 0, 0.15, 0), mesh(new THREE.SphereGeometry(0.04, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(col, 0.4, 0.3), 0, 0.3, 0)); this.lab.label(g, name, { y: 0.4 }); return g; };
    tank(-0.3, '#e2e8f0', 'Hydrogen'); tank(0.3, '#60a5fa', 'Oxygen');
    const cell = new THREE.Group(); this.lab.add(cell, 0, Y + 0.05, -0.05);
    cell.add(mesh(new THREE.BoxGeometry(0.16, 0.12, 0.1), mat('#475569', 0.3, 0.4), 0, 0.06, 0), mesh(new THREE.BoxGeometry(0.01, 0.11, 0.09), mat('#facc15', 0, 0.5), 0, 0.06, 0));
    this.lab.label(cell, 'Hydrogen–oxygen fuel cell', { y: 0.16 });
    this.lab.add(wire([[-0.26, Y + 0.2, -0.05], [-0.15, Y + 0.18, -0.05], [-0.08, Y + 0.12, -0.05]], '#94a3b8', 0.005));
    this.lab.add(wire([[0.26, Y + 0.2, -0.05], [0.15, Y + 0.18, -0.05], [0.08, Y + 0.12, -0.05]], '#94a3b8', 0.005));
    this.fan = new THREE.Group(); this.lab.add(this.fan, 0, Y + 0.32, -0.05);
    for (let i = 0; i < 3; i++) { const b = mesh(new THREE.BoxGeometry(0.06, 0.012, 0.003), mat('#38bdf8')); b.geometry.translate(0.03, 0, 0); b.rotation.z = (i / 3) * Math.PI * 2; this.fan.add(b); }
    this.lab.add(wire([[-0.04, Y + 0.17, -0.05], [-0.04, Y + 0.3, -0.05]], '#111827', 0.002)); this.lab.add(wire([[0.04, Y + 0.17, -0.05], [0.04, Y + 0.3, -0.05]], '#dc2626', 0.002));
    this.cup = beaker({ r: 0.035, h: 0.06, color: '#bfdbfe', level: 0, opacity: 0.7 }); this.lab.add(this.cup, 0, Y, 0.1);
    this.drop = mesh(new THREE.SphereGeometry(0.005, 8, 6), new THREE.MeshStandardMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.8 })); this.lab.add(this.drop, 0, Y + 0.1, 0.1);
    const ui = this.ui;
    this.st2 = ui.steps(['Run the fuel cell and power the fan', 'Collect the product and **test it**', 'Answer the analysis questions']);
    const sec = ui.section('Gas supply');
    ui.slider({ label: 'Hydrogen flow', min: 0, max: 1, step: 0.05, value: this.h2, parent: sec, onInput: (v) => { this.h2 = v; } });
    ui.slider({ label: 'Oxygen flow', min: 0, max: 1, step: 0.05, value: this.o2, parent: sec, onInput: (v) => { this.o2 = v; } });
    ui.buttons([{ label: '🧪 Test liquid with anhydrous copper(II) sulfate', onClick: () => { if (this.water < 0.1) { this.ui.hint('Collect some product first.', 2500); return; } this.ui.note('White anhydrous copper(II) sulfate turned **blue**: the product is **water**.', 'gold'); this.st2.done(1); this.check2(); } }], sec);
    this.ro2 = ui.readouts([{ id: 'p', label: 'Electrical power', unit: 'W' }, { id: 'w', label: 'Water made', unit: 'cm³' }], sec);
    const cmp = ui.section('Fuel cell vs petrol engine');
    ui.table(['', 'Fuel cell', 'Petrol engine'], cmp).add(['Exhaust', 'Water only', 'CO₂, CO, NOₓ, particulates']);
    ui.notes();
    ui.questions([
      { q: 'What is the only product of a hydrogen–oxygen fuel cell?', opts: ['Water', 'Carbon dioxide', 'Methane', 'Nitrogen oxides'], e: '2H₂ + O₂ → 2H₂O, releasing electrical energy.', o: [1], sub: 'C4.2' },
      { q: 'A disadvantage of hydrogen fuel cells compared with petrol engines is…', opts: ['hydrogen is hard to store and is often made using fossil fuels', 'they produce CO₂ in the exhaust', 'they are less efficient', 'they are noisy'], e: 'Hydrogen needs high-pressure tanks, and making it can cause emissions elsewhere.', o: [2], sub: 'C4.2' },
    ], { sub: 'C4.2', onDone: () => { this.st2.done(2); this.check2(); } });
    this.every((dt) => {
      const P = Math.min(this.h2, this.o2 * 2) * 6;
      this.fan.rotation.z += dt * P * 4;
      this.ro2.set('p', P.toFixed(1));
      this.water = Math.min(1, this.water + dt * P * 0.009);
      this.cup.setLevel(this.water * 0.6); this.ro2.set('w', (this.water * 20).toFixed(1));
      this.drop.position.y -= dt * 0.25; if (this.drop.position.y < this.Y + 0.02) this.drop.position.y = this.Y + 0.1; this.drop.visible = P > 0.2;
      if (P > 2 && !this.st2.isDone(0)) { this.st2.done(0); this.ui.note('Hydrogen and oxygen combine in the cell: chemical energy → electrical energy. The fan spins!', 'gold'); }
    });
  }
  check2() { this.st2.check(); }
  dispose() { super.dispose(); }
}
void M;
