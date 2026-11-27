import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { Vessel, Bunsen, boilingTube, testTube, beaker, Bubbles, stand, wire, mesh, mat, M, glassMaterial } from '../apparatus.js';
import { h, clear, clamp, tweens, canvasTex } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const FRAC = [
  { id: 'gas', name: 'Refinery gas', c: 'C1–C4', bp: 'below 25 °C', use: 'heating and cooking (bottled gas)', col: '#e0f2fe', visc: 1 },
  { id: 'petrol', name: 'Gasoline / petrol', c: 'C5–C10', bp: '40–100 °C', use: 'fuel for cars', col: '#fef9c3', visc: 1.5 },
  { id: 'naphtha', name: 'Naphtha', c: 'C7–C12', bp: '100–150 °C', use: 'feedstock for making chemicals and plastics', col: '#fde68a', visc: 2 },
  { id: 'kero', name: 'Kerosene / paraffin', c: 'C10–C16', bp: '150–250 °C', use: 'jet fuel', col: '#fcd34d', visc: 3 },
  { id: 'diesel', name: 'Diesel oil / gas oil', c: 'C15–C20', bp: '250–300 °C', use: 'fuel for diesel engines (lorries, buses)', col: '#f59e0b', visc: 4 },
  { id: 'fuel', name: 'Fuel oil', c: 'C20–C30', bp: '300–350 °C', use: 'fuel for ships and home heating', col: '#b45309', visc: 6 },
  { id: 'lube', name: 'Lubricating oil', c: 'C30–C40', bp: '350–450 °C', use: 'lubricants, waxes and polishes', col: '#78350f', visc: 8 },
  { id: 'bitumen', name: 'Bitumen', c: 'C40+', bp: 'above 450 °C', use: 'surfacing roads and roofs', col: '#1c1917', visc: 10 },
];
const COLH = 0.62; // column height

export default class Refinery extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Dr. Priya is turning the old refinery into a museum. Visitors will ask: how does one black sludge become petrol, jet fuel, plastics and tarmac?';
    this.tabLabels = [['distil', '🛢️ Fractional distillation'], ['crack', '💥 Cracking']];
    this.tabObjectives = { distil: ['C11.3', 'C11.4'], crack: ['C11.5', 'C11.4'] };
    this.tabViews = { distil: { pos: [-0.06, 1.48, 1.78], target: [-0.06, 1.26, 0] }, crack: { pos: [0, 1.46, 1.0], target: [0, 1.04, 0] } };
    this.view = this.tabViews.distil;
  }

  // ======================================================== distillation column
  tab_distil() {
    const Y = this.Y;
    this.d = { on: false, got: new Set(), match: {}, parts: [] };
    const col = new THREE.Group(); this.lab.add(col, -0.1, Y, -0.02); this.col = col;
    // temperature gradient texture
    const { tex } = canvasTex(64, 512, (ctx, w, hh) => { const g = ctx.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, '#3b82f6'); g.addColorStop(0.5, '#f59e0b'); g.addColorStop(1, '#dc2626'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh); });
    this.gradM = new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 0.18, depthWrite: false, emissive: '#000000' });
    col.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, COLH, 28, 1, true), this.gradM, 0, 0.12 + COLH / 2, 0));
    col.add(mesh(new THREE.CylinderGeometry(0.061, 0.071, COLH, 28, 1, true), glassMaterial('#dbeafe', 0.05, 0.6), 0, 0.12 + COLH / 2, 0));
    col.add(mesh(new THREE.SphereGeometry(0.061, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.steel, 0, 0.12 + COLH, 0));
    for (let i = 0; i < 8; i++) col.add(mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.004, 24), mat('#94a3b8', 0.6, 0.4, { transparent: true, opacity: 0.5 }), 0, this.trayY(i), 0));
    const furnace = mesh(new THREE.BoxGeometry(0.2, 0.1, 0.14), mat('#475569', 0.4, 0.5), -0.18, 0.05, 0.02); col.add(furnace);
    this.glow = mesh(new THREE.BoxGeometry(0.12, 0.02, 0.005), new THREE.MeshBasicMaterial({ color: '#330000' }), -0.18, 0.05, 0.091); col.add(this.glow);
    this.lab.label(furnace, 'Furnace (crude oil heated to ~400 °C)', { y: 0.1 });
    col.add(wire([[-0.12, 0.08, 0.02], [-0.06, 0.1, 0.0], [-0.03, 0.14, 0]], '#334155', 0.008));
    this.lab.label(col, 'Fractionating column', { y: COLH + 0.25 });
    const hot = new THREE.Object3D(); hot.position.set(-0.11, 0.2, 0); col.add(hot); this.lab.label(hot, 'hot ≈ 350 °C', { y: 0, cls: 'dimlab' });
    const cool = new THREE.Object3D(); cool.position.set(-0.11, 0.12 + COLH - 0.05, 0); col.add(cool); this.lab.label(cool, 'cool ≈ 25 °C', { y: 0, cls: 'dimlab' });
    // side pipes + drums
    this.drums = FRAC.map((f, i) => {
      const y = this.trayY(7 - i) + (i === 0 ? 0.03 : 0), x0 = 0.06, len = 0.12;
      const pipe = mesh(new THREE.CylinderGeometry(0.006, 0.006, len, 8), M.steel, x0 + len / 2, y, 0); pipe.rotation.z = Math.PI / 2; col.add(pipe);
      const drum = new Vessel([[0, 0.002], [0.022, 0.002], [0.022, 0.045]], { color: f.col, level: 0, opacity: 0.92 });
      drum.position.set(x0 + len + 0.03, y - 0.05, 0); col.add(drum);
      drum.add(mesh(new THREE.CylinderGeometry(0.0235, 0.0235, 0.003, 18), mat('#cbd5e1', 0.6, 0.4), 0, 0.046, 0));
      const lbl = this.lab.label(drum, '?', { y: 0.065, x: 0.07, cls: 'dimlab' });
      this.lab.interactive(drum, { tip: `Fraction ${i + 1} — click to collect and inspect`, onClick: () => this.collect(i) });
      return { f, drum, lbl, y, level: 0 };
    });
    // vapour particles
    const N = 120;
    this.vap = new THREE.InstancedMesh(new THREE.SphereGeometry(0.004, 6, 5), new THREE.MeshBasicMaterial({ color: '#fde68a', transparent: true, opacity: 0.85 }), N);
    this.vap.frustumCulled = false; col.add(this.vap); this.vap.count = 0;
    this.vp = Array.from({ length: N }, () => this.newVap());
    this._o = new THREE.Object3D();
    const ui = this.ui;
    this.stD = ui.steps(['**Heat** the crude oil in the furnace', 'Collect and inspect **all eight fractions**', 'Match each fraction to its **use**', { t: '(S) Describe the **trends** up the column', o: ['C11.3.7'] }, 'Answer the analysis questions']);
    const sec = ui.section('Refinery');
    ui.buttons([{ label: '🔥 Heat crude oil', kind: 'primary', onClick: () => { this.d.on = true; audio.loop && (this.hum = this.hum || audio.loop('boil')); this.hum?.set(0.4); } }, { label: '⏹ Stop', onClick: () => { this.d.on = false; this.hum?.set(0); } }], sec);
    this.info = h('div', { class: 'muted', style: { fontSize: '.88em', lineHeight: 1.55, minHeight: '64px' } }, 'Each fraction condenses where the column temperature falls below its boiling point. Click a drum to inspect it.');
    sec.append(this.info);
    const ms = ui.section('Match fractions to uses');
    const uses = FRAC.map((f) => f.use).sort();
    this.useSel = FRAC.map((f) => ui.select({ label: f.name, options: [['', '— use —'], ...uses.map((u) => [u, u])], value: '', parent: ms }));
    ui.buttons([{ label: '✔ Check uses', kind: 'primary', onClick: () => this.checkUses() }], ms);
    const tr = ui.section('(S) Trends from bottom to top');
    ui.questions([
      { q: 'Going **up** the column, the chain length and boiling point…', opts: ['both decrease', 'both increase', 'chain length increases, boiling point decreases', 'stay the same'], e: 'Small molecules have weaker forces between them, so they boil at lower temperatures.', o: [7], sub: 'C11.3' },
      { q: 'Compared with bitumen, refinery gas is…', opts: ['less viscous, paler and more flammable', 'more viscous and darker', 'less flammable', 'solid at room temperature'], e: 'Trends: viscosity, colour and boiling point increase down the column; flammability decreases.', o: [7], sub: 'C11.3' },
    ], { sub: 'C11.3', title: 'Trends', parent: tr, onDone: () => { this.stD.done(3); this.checkTab('distil', this.stD, 5); } });
    ui.notes();
    ui.questions([
      { q: 'Petroleum is separated by fractional distillation because its hydrocarbons have different…', opts: ['boiling points', 'colours', 'densities only', 'numbers of oxygen atoms'], e: 'Each fraction is a mixture with a similar range of boiling points.', o: [5], sub: 'C11.3' },
      { q: 'Hydrocarbons are compounds of…', opts: ['hydrogen and carbon only', 'hydrogen, carbon and oxygen', 'carbon only', 'hydrogen and oxygen'], e: 'Petroleum is a mixture of hydrocarbons.', o: [3, 4], sub: 'C11.3' },
      { q: 'The main constituent of natural gas is…', opts: ['methane', 'ethene', 'propane', 'hydrogen'], e: 'Methane, CH₄ — the simplest alkane.', o: [2], sub: 'C11.3' },
      { q: 'Alkanes such as those in petrol are generally unreactive, except in…', opts: ['combustion', 'neutralisation', 'electrolysis', 'precipitation'], e: 'They burn well — that is why they are fuels.', o: [2], sub: 'C11.4' },
    ], { sub: 'C11.3', onDone: () => { this.stD.done(4); this.checkTab('distil', this.stD, 5); } });
    this.every((dt, t) => this.simDistil(dt, t));
    this.onTabDispose(() => { this.hum?.stop(); this.hum = null; });
  }
  trayY(i) { return 0.12 + 0.04 + i * (COLH - 0.1) / 7; }
  newVap() { const k = Math.floor(Math.random() * 8); return { k, y: 0.12 + Math.random() * 0.05, x: (Math.random() - 0.5) * 0.08, z: (Math.random() - 0.5) * 0.08, v: 0.08 + Math.random() * 0.06, out: 0 }; }
  simDistil(dt, t) {
    const on = this.d.on;
    this.glow.material.color.setRGB(on ? 2.2 + Math.sin(t * 9) * 0.2 : 0.2, on ? 0.6 : 0, on ? 0.1 : 0);
    this.gradM.opacity = on ? 0.32 : 0.18;
    let n = 0;
    if (on) for (const p of this.vp) {
      const target = this.drums[p.k].y;
      if (p.out > 0) { p.out += dt * 0.6; p.x = 0.06 + p.out * 0.18; if (p.out > 0.7) { this.drums[p.k].level = Math.min(1, this.drums[p.k].level + 0.004); Object.assign(p, this.newVap()); continue; } }
      else if (p.k === 7) { p.y = 0.13 + Math.abs(Math.sin(t + p.x * 50)) * 0.02; if (Math.random() < dt * 0.6) p.out = 0.01; }
      else { p.y += p.v * dt; p.x += (Math.random() - 0.5) * 0.004; if (p.y >= target) { p.y = target; p.out = 0.01; } }
      this._o.position.set(p.x, p.y, p.z); this._o.updateMatrix(); this.vap.setMatrixAt(n++, this._o.matrix);
    }
    this.vap.count = n; this.vap.instanceMatrix.needsUpdate = true;
    this.vap.material.color.setHSL(0.12, 0.9, 0.7);
    for (const dr of this.drums) { dr.drum.setLevel(dr.level * 0.85); dr.drum.update(dt); }
    if (on && !this.stD.isDone(0) && this.drums.some((d) => d.level > 0.05)) { this.stD.done(0); this.ui.note('Crude oil vapour rises up the column, cooling as it goes. Each fraction **condenses** at the level where the temperature falls below its boiling point.', 'gold'); }
  }
  collect(i) {
    const dr = this.drums[i];
    if (dr.level < 0.1) { this.ui.hint(this.d.on ? 'Wait for some liquid to collect.' : 'Heat the crude oil first.', 2200); return; }
    const f = dr.f; audio.clink();
    dr.lbl.userData.set(f.name); this.d.got.add(f.id);
    this.info.innerHTML = `<b style="color:#fff">${f.name}</b> · ${f.c} · boils ${f.bp}<br>Used for: <b>${f.use}</b><br><span class="faint">Viscosity: ${'▮'.repeat(f.visc)}${'▯'.repeat(10 - f.visc)}</span>`;
    if (this.d.got.size === 8 && !this.stD.isDone(1)) { this.stD.done(1); this.ui.note('All eight fractions collected — from refinery gas at the top to bitumen at the bottom.', 'gold'); }
    this.checkTab('distil', this.stD, 5);
  }
  checkUses() {
    const wrong = FRAC.filter((f, i) => this.useSel[i].get() !== f.use).length;
    if (!wrong) { audio.success(); this.stD.done(2); this.ui.note('All uses matched! Every fraction of crude oil is useful — that is why so little is wasted.', 'gold'); }
    else { audio.fail(); this.ui.note(`${wrong} use${wrong > 1 ? 's are' : ' is'} wrong. Think: which fractions are gases, light liquids, thick oils or solids?`, 'warn'); }
    this.checkTab('distil', this.stD, 5);
  }

  // ======================================================== cracking
  tab_crack() {
    const Y = this.Y;
    this.c = { heat: 0, on: false, inWater: true, gas: [0, 0], testedAlkene: false, testedAlkane: false, eq: false, suck: false, collecting: 0 };
    const stn = stand(0.3); this.lab.add(stn, -0.33, Y, -0.06);
    this.bt = boilingTube({ level: 0 }); this.bt.rotation.z = Math.PI / 2 - 0.08; this.lab.add(this.bt, -0.3, Y + 0.17, 0); this.bt.rotation.z = -Math.PI / 2 + 0.08;
    this.lab.label(this.bt, 'Mineral wool + liquid paraffin (C₁₂H₂₆)', { y: 0.02, x: -0.03 });
    this.bt.add(mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.04, 12), mat('#f5f5f4', 0, 1), 0, 0.025, 0));
    for (let i = 0; i < 6; i++) this.bt.add(mesh(new THREE.DodecahedronGeometry(0.005), mat('#fafaf9', 0, 0.4), (Math.random() - 0.5) * 0.012, 0.085 + i * 0.008, (Math.random() - 0.5) * 0.01));
    const cat = new THREE.Object3D(); cat.position.set(0, 0.095, 0); this.bt.add(cat); this.lab.label(cat, 'Porcelain chips (catalyst)', { y: 0.035, cls: 'dimlab' });
    this.burner = new Bunsen(); this.lab.add(this.burner, -0.19, Y, 0);
    this.lab.add(wire([[-0.135, Y + 0.172, 0], [-0.05, Y + 0.175, 0], [0.02, Y + 0.12, 0], [0.06, Y + 0.035, 0]], '#cbd5e1', 0.003));
    this.trough = new Vessel([[0, 0.003], [0.08, 0.003], [0.08, 0.06]], { color: '#bfdbfe', level: 0.75, opacity: 0.45 }); this.lab.add(this.trough, 0.09, Y, 0);
    this.lab.label(this.trough, 'Gas collected over water', { y: 0.12 });
    this.colT = [0, 1].map((i) => { const t = testTube({ level: 0 }); t.rotation.z = Math.PI; this.lab.add(t, 0.07 + i * 0.045, Y + 0.165, 0); t.water = mesh(new THREE.CylinderGeometry(0.0104, 0.0104, 1, 12), new THREE.MeshStandardMaterial({ color: '#bfdbfe', transparent: true, opacity: 0.5, depthWrite: false })); t.add(t.water); return t; });
    this.bub = new Bubbles({ r: 0.006, y0: 0.01, y1: 0.05, size: 0.0025 }); this.bub.position.set(-0.02, 0, 0); this.trough.add(this.bub);
    this.brT = [0, 1].map((i) => { const t = testTube({ level: 0.35, color: '#f97316', opacity: 0.85 }); this.lab.add(t, 0.28 + i * 0.05, Y, 0.08); return t; });
    this.lab.label(this.brT[0], 'Bromine water', { y: 0.17 });
    const ui = this.ui;
    this.stC = ui.steps(['**Heat** the porcelain catalyst strongly, then the paraffin', 'Collect **two tubes** of gas (discard the first bubbles — air)', 'Lift the delivery tube **out of the water** before you stop heating', 'Test the gas and the paraffin with **bromine water**', 'Balance the **cracking equation**', 'Answer the analysis questions']);
    const sec = ui.section('Cracking');
    ui.buttons([{ label: '🔥 Heat', kind: 'primary', onClick: () => { this.burner.set('roaring'); this.c.on = true; } }, { label: '⬆ Lift delivery tube out', onClick: () => this.lift() }, { label: '⏹ Stop heating', onClick: () => this.stopHeat() }], sec);
    ui.buttons([{ label: '🟠 Bromine water + gas', onClick: () => this.brTest('gas') }, { label: '🟠 Bromine water + paraffin', onClick: () => this.brTest('paraffin') }], sec);
    this.ro = ui.readouts([{ id: 'T', label: 'Catalyst temperature', unit: '°C' }, { id: 'g', label: 'Gas tubes full' }], sec);
    const es = ui.section('Balance the equation');
    es.append(h('div', { style: { fontFamily: 'var(--display)', fontSize: '1.05em', margin: '6px 0' } }, 'C₁₂H₂₆ → C₈H₁₈ + ?'));
    this.eqSeg = ui.seg({ options: [['a', 'C₂H₄'], ['b', '2 C₂H₄'], ['c', 'C₄H₁₀'], ['d', '2 CH₄']], value: null, parent: es, onChange: (v) => this.checkEq(v) });
    ui.notes();
    ui.questions([
      { q: 'Bromine water turned from **orange to colourless** with the gas. This shows the gas is…', opts: ['unsaturated — an alkene with a C=C bond', 'saturated — an alkane', 'hydrogen', 'carbon dioxide'], e: 'Alkenes decolorise bromine water; alkanes do not.', o: [2], sub: 'C11.5' },
      { q: 'Why do refineries crack long-chain alkanes?', opts: ['To make more useful short-chain fuels (like petrol) and alkenes for plastics', 'To make bitumen', 'To remove sulfur', 'To make the oil thicker'], e: 'Demand for petrol and alkenes is greater than supply from distillation.', o: [3], sub: 'C11.5' },
      { q: '(S) Cracking needs…', opts: ['a high temperature and a catalyst', 'a low temperature and water', 'bromine water', 'electricity'], e: 'Thermal decomposition at ~600 °C over a catalyst; it can also produce hydrogen.', o: [3], sub: 'C11.5' },
      { q: '(S) Ethene + steam (with a catalyst) gives…', opts: ['ethanol', 'ethane', 'dibromoethane', 'poly(ethene)'], e: 'Addition reactions: + Br₂ → dibromoethane; + H₂ → ethane; + H₂O → ethanol.', o: [4], sub: 'C11.5' },
      { q: 'Why must the delivery tube be lifted out of the water before heating stops?', opts: ['To stop cold water being sucked back into the hot tube (suck-back), which could crack it', 'To save gas', 'To let air in', 'So the bromine water does not boil'], e: 'As the tube cools, the gas inside contracts and pulls water back.', o: [3], sub: 'C11.5' },
    ], { sub: 'C11.5', onDone: () => { this.stC.done(5); this.checkTab('crack', this.stC, 6); } });
    this.every((dt, t) => this.simCrack(dt, t));
    this.onTabDispose(() => { this.burner?.dispose(); this.burner = null; });
  }
  lift() { if (!this.c.inWater) return; this.c.inWater = false; audio.click(); this.ui.note('Delivery tube lifted out of the water.'); if (this.c.on && this.c.gas[1] >= 1) { this.stC.done(2); this.checkTab('crack', this.stC, 6); } }
  stopHeat() {
    if (!this.c.on) return;
    this.burner.set('off'); this.c.on = false;
    if (this.c.inWater) { this.c.suck = true; audio.fail(); this.ui.note('⚠️ **Suck-back!** As the hot tube cooled, cold water was pulled back into it and the glass cracked. Always lift the delivery tube out first. Reset the tab to try again.', 'warn'); }
  }
  brTest(k) {
    if (k === 'gas') {
      if (this.c.gas[0] < 1) { this.ui.hint('Collect a full tube of gas first.', 2400); return; }
      if (this.c.testedAlkene) return;
      this.c.testedAlkene = true; audio.bubble(); this.brT[0].setColor('#f8fafc', 1.5); this.brT[0].setOpacity(0.4);
      this.ui.note('Gas + bromine water: **orange → colourless**. The gas contains an **alkene** (e.g. ethene) — unsaturated.', 'gold');
    } else {
      if (this.c.testedAlkane) return;
      this.c.testedAlkane = true; audio.bubble();
      this.ui.note('Liquid paraffin + bromine water: **stays orange**. The paraffin is an alkane — saturated.');
    }
    if (this.c.testedAlkene && this.c.testedAlkane) this.stC.done(3);
    this.checkTab('crack', this.stC, 6);
  }
  checkEq(v) {
    if (v === 'b') { audio.success(); this.stC.done(4); this.ui.note('Balanced: **C₁₂H₂₆ → C₈H₁₈ + 2C₂H₄**. 12 C and 26 H on each side. Octane is a petrol; ethene makes plastics.', 'gold'); }
    else { audio.fail(); this.ui.note('Count atoms: 12 − 8 = 4 carbons and 26 − 18 = 8 hydrogens are left over.', 'warn'); }
    this.checkTab('crack', this.stC, 6);
  }
  simCrack(dt, t) {
    const c = this.c; if (!this.burner) return;
    this.burner.update(dt, t);
    c.heat = clamp(c.heat + (c.on ? 60 : -40) * dt, 20, 650);
    this.ro.set('T', c.heat.toFixed(0));
    const producing = c.on && c.heat > 450 && !c.suck;
    this.bub.setRate(producing && c.inWater ? 16 : 0); this.bub.update(dt, this.trough.surfaceY());
    if (producing && c.inWater) {
      c.collecting += dt;
      if (c.collecting > 1.5) { const i = c.gas[0] < 1 ? 0 : 1; c.gas[i] = Math.min(1, c.gas[i] + dt * 0.18); }
      if (c.gas[1] >= 1 && !this.stC.isDone(1)) { this.stC.done(0); this.stC.done(1); this.ui.note('Two tubes of gas collected. Now lift the delivery tube out of the water **before** you stop heating.', 'gold'); }
    }
    this.ro.set('g', `${c.gas.filter((g) => g >= 1).length} / 2`);
    this.colT.forEach((tt, i) => { const g = c.gas[i] * 0.85; tt.water.scale.y = Math.max(0.001, 0.13 * (1 - g)); tt.water.position.y = 0.13 - (0.13 * (1 - g)) / 2; }); this.brT.forEach((tt) => tt.update(dt));
  }
  reset() { const t = this.tab; this.tab = null; this.setTab(t); }

  checkTab(id, st) { st.check(); }
}
void clear; void tweens; void beaker;
