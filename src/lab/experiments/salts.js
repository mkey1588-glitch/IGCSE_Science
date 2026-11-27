import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { Vessel, beaker, boilingTube, testTube, conicalFlask, Bunsen, tripod, Thermometer, Puffs, stand, mesh, mat, M, glassMaterial } from '../apparatus.js';
import { TubeRack, reagentShelf } from '../tubes.js';
import { clamp, tweens, ease, h, clear } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const basinProfile = [[0, 0.003], [0.028, 0.006], [0.044, 0.018], [0.05, 0.032]];
function basin() {
  const v = new Vessel(basinProfile, { name: 'Evaporating basin', color: '#38bdf8', level: 0, opacity: 0.85 });
  v.glass.material = M.ceramic; v.glass.renderOrder = 0;
  return v;
}
function funnel() {
  const g = new THREE.Group(); g.name = 'Filter funnel';
  g.add(mesh(new THREE.CylinderGeometry(0.045, 0.006, 0.06, 24, 1, true), glassMaterial(), 0, 0.07, 0), mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.05, 10, 1, true), glassMaterial(), 0, 0.015, 0));
  g.paper = mesh(new THREE.ConeGeometry(0.04, 0.05, 24, 1, true), mat('#f8fafc', 0, 0.95, { side: THREE.DoubleSide }), 0, 0.075, 0); g.paper.rotation.x = Math.PI; g.add(g.paper);
  g.residue = mesh(new THREE.SphereGeometry(0.012, 12, 8), mat('#111827', 0, 0.9), 0, 0.058, 0); g.residue.scale.set(1, 0.4, 1); g.residue.visible = false; g.add(g.residue);
  return g;
}
function crystal(color, s) {
  const m = mesh(new THREE.BoxGeometry(s * 1.6, s * 0.7, s), new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, metalness: 0, transmission: 0.2, thickness: 0.01, clearcoat: 1, emissive: new THREE.Color(color).multiplyScalar(0.2) }));
  m.geometry.translate(0, s * 0.35, 0);
  return m;
}

// ---- precipitation chemistry
const SOL = [
  { id: 'BaCl2', name: 'Barium chloride', color: '#f8fafc' },
  { id: 'Na2SO4', name: 'Sodium sulfate', color: '#f8fafc' },
  { id: 'AgNO3', name: 'Silver nitrate', color: '#f8fafc', glass: '#3f2a1a' },
  { id: 'NaCl', name: 'Sodium chloride', color: '#f8fafc' },
  { id: 'Na2CO3', name: 'Sodium carbonate', color: '#f8fafc' },
  { id: 'CaCl2', name: 'Calcium chloride', color: '#f8fafc' },
  { id: 'CuSO4', name: 'Copper(II) sulfate', color: '#38bdf8' },
];
const PPT = {
  'BaCl2+Na2SO4': ['barium sulfate', '#ffffff', 'Ba²⁺ + SO₄²⁻ → BaSO₄'],
  'AgNO3+NaCl': ['silver chloride', '#f1f5f9', 'Ag⁺ + Cl⁻ → AgCl'],
  'AgNO3+BaCl2': ['silver chloride', '#f1f5f9', 'Ag⁺ + Cl⁻ → AgCl'],
  'AgNO3+CaCl2': ['silver chloride', '#f1f5f9', 'Ag⁺ + Cl⁻ → AgCl'],
  'AgNO3+Na2CO3': ['silver carbonate', '#fef3c7', '2Ag⁺ + CO₃²⁻ → Ag₂CO₃'],
  'BaCl2+Na2CO3': ['barium carbonate', '#ffffff', 'Ba²⁺ + CO₃²⁻ → BaCO₃'],
  'CaCl2+Na2CO3': ['calcium carbonate', '#ffffff', 'Ca²⁺ + CO₃²⁻ → CaCO₃'],
  'CuSO4+Na2CO3': ['copper(II) carbonate', '#5eead4', 'Cu²⁺ + CO₃²⁻ → CuCO₃'],
  'BaCl2+CuSO4': ['barium sulfate', '#ffffff', 'Ba²⁺ + SO₄²⁻ → BaSO₄'],
};
const pairKey = (a, b) => [a, b].sort().join('+');

export default class Salts extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Iris wants sparkling blue crystals for festival jewellery — and the clinic needs pure barium sulfate for X-ray “barium meals”. Make soluble and insoluble salts properly.';
    this.tabLabels = [['soluble', '💎 Grow crystals'], ['hydrate', '💧 Water of crystallisation'], ['precip', '🌫️ Precipitation (S)']];
    this.tabObjectives = { soluble: ['C7.3', 'C7.2', 'C12.4', 'C12.1'], hydrate: ['C7.3', 'C10.1', 'C3.2'], precip: ['C7.3', 'C12.4'] };
    this.tabViews = { soluble: { pos: [-0.05, 1.5, 1.15], target: [-0.05, 1.07, 0] }, hydrate: { pos: [0, 1.48, 1.08], target: [0, 1.06, 0] }, precip: { pos: [-0.04, 1.45, 1.05], target: [-0.04, 1.0, 0] } };
    this.view = this.tabViews.soluble;
  }

  // ======================================================== soluble salt
  tab_soluble() {
    const Y = this.Y;
    this.s = { phase: 'acid', T: 20, cuo: 0, need: 5, level: 0, cryst: false, over: false };
    this.burner = new Bunsen(); this.lab.add(this.burner, -0.22, Y, 0);
    this.lab.add(tripod(), -0.22, Y, 0);
    this.bk = beaker({ r: 0.045, h: 0.09, color: '#e0f2fe', level: 0.55, opacity: 0.55 }); this.lab.add(this.bk, -0.22, Y + 0.205, 0);
    this.lab.label(this.bk, 'Dilute sulfuric acid', { y: 0.13 });
    this.sed = mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.008, 20), mat('#111827', 0, 0.9), 0, 0.007, 0); this.sed.visible = false; this.bk.add(this.sed);
    this.rod = mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.16, 8), M.glass, 0.02, 0.08, 0); this.rod.rotation.z = -0.25; this.bk.add(this.rod);
    this.th = new Thermometer(0.2, 0, 110); this.th.position.set(-0.025, 0.01, 0.01); this.th.rotation.z = 0.15; this.bk.add(this.th);
    const jar = new THREE.Group(); this.lab.add(jar, -0.42, Y, 0.06);
    jar.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 18), glassMaterial('#e6f4ff', 0.12, 0.6), 0, 0.035, 0), mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.04, 18), mat('#111827', 0, 0.95), 0, 0.022, 0), mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.012, 18), mat('#1f2937'), 0, 0.076, 0));
    this.lab.label(jar, 'Copper(II) oxide (black powder)', { y: 0.12 });
    this.lab.interactive(jar, { tip: 'Copper(II) oxide — click to add a spatula to the warm acid', onClick: () => this.addCuO() });
    // filter station
    const stn = stand(0.32); this.lab.add(stn, 0.14, Y, -0.05);
    this.fun = funnel(); this.lab.add(this.fun, 0.09, Y + 0.075, 0); this.lab.label(this.fun, 'Filter funnel + paper', { y: 0.13 });
    this.bas = basin(); this.lab.add(this.bas, 0.09, Y, 0); this.lab.label(this.bas, 'Evaporating basin', { y: 0.06, cls: 'dimlab' });
    this.crys = new THREE.Group(); this.bas.add(this.crys);
    this.steam = new Puffs({ color: '#ffffff', size: 0.05, rise: 0.08, life: 2.2, opacity: 0.3, spread: 0.04 }); this.lab.tabRoot.add(this.steam);
    const ui = this.ui;
    this.st = ui.steps(['**Warm** the dilute sulfuric acid', 'Add copper(II) oxide until it is **in excess**', '**Filter** off the excess copper(II) oxide', '**Evaporate** to the crystallisation point (test with a glass rod)', 'Leave to **cool and crystallise**, then pat dry', 'Answer the analysis questions']);
    const sec = ui.section('Method');
    ui.buttons([{ label: '🔥 Warm acid', kind: 'primary', onClick: () => this.warm() }, { label: '➕ Add a spatula of CuO', onClick: () => this.addCuO() }], sec);
    ui.buttons([{ label: '🫗 Filter', onClick: () => this.filter() }, { label: '♨️ Evaporate', onClick: () => this.evaporate() }, { label: '🥢 Glass-rod test', onClick: () => this.rodTest() }], sec);
    ui.buttons([{ label: '⏹ Stop heating', onClick: () => this.stopHeat() }, { label: '❄️ Cool & crystallise', kind: 'primary', onClick: () => this.crystallise() }], sec);
    this.ro = ui.readouts([{ id: 'T', label: 'Temperature', unit: '°C' }, { id: 'p', label: 'pH (indicator paper)' }, { id: 'c', label: 'Solution' }], sec);
    ui.notes();
    ui.questions([
      { q: 'Why is copper(II) oxide added **until some is left over** (in excess)?', opts: ['To make sure all the acid has reacted', 'To make the crystals bigger', 'Because copper(II) oxide is a catalyst', 'To keep the solution cool'], e: 'Excess base guarantees no acid remains in the salt solution; the extra solid is filtered off.', o: [1], sub: 'C7.3' },
      { q: 'The black solid left on the filter paper is called the…', opts: ['residue', 'filtrate', 'solute', 'solvent'], e: 'The liquid that passes through is the filtrate.', o: [2], sub: 'C12.1' },
      { q: 'Copper(II) oxide neutralises the acid because it is a…', opts: ['basic oxide', 'acidic oxide', 'catalyst', 'non-metal oxide'], e: 'Metal oxides such as CuO and CaO are basic.', o: [1], sub: 'C7.2' },
      { q: 'Why stop heating at the **crystallisation point** instead of boiling to dryness?', opts: ['Crystals need to form slowly and keep their water of crystallisation', 'Boiling to dryness makes more crystals', 'The basin might melt', 'Copper sulfate is flammable'], e: 'Heating to dryness drives off the water of crystallisation and gives a white powder.', o: [1], sub: 'C12.4' },
      { q: 'copper(II) oxide + sulfuric acid → ?', opts: ['copper(II) sulfate + water', 'copper(II) sulfate + hydrogen', 'copper + sulfur dioxide', 'copper(II) sulfate + carbon dioxide'], e: 'Base + acid → salt + water.', o: [1], sub: 'C7.3' },
    ], { sub: 'C7.3', onDone: () => { this.st.done(5); this.checkTab('soluble', this.st, 6); } });
    this.every((dt, t) => this.simSoluble(dt, t));
    this.onTabDispose(() => { this.burner?.dispose(); this.burner = null; });
    this.ui.hint('Click **🔥 Warm acid**, then add copper(II) oxide one spatula at a time.', 5000);
  }
  warm() { if (this.s.phase !== 'acid') return; this.burner.set('roaring'); this.s.heating = true; audio.click(); }
  addCuO() {
    const s = this.s;
    if (s.phase !== 'acid') { this.ui.hint('The acid has already been neutralised and filtered.', 2500); return; }
    if (s.T < 45) { this.ui.hint('Warm the acid first — the reaction is very slow when cold.', 2800); return; }
    s.cuo++; audio.pour?.();
    if (s.cuo <= s.need) {
      this.bk.setColor(new THREE.Color('#e0f2fe').lerp(new THREE.Color('#0284c7'), s.cuo / s.need).getStyle(), 1.2);
      this.bk.setOpacity(0.55 + 0.3 * (s.cuo / s.need));
      this.ui.note(`Spatula ${s.cuo}: the black powder dissolves and the solution turns ${s.cuo < s.need ? 'bluer' : '**blue**'}.`);
    } else {
      this.sed.visible = true; this.sed.scale.y = Math.min(3, s.cuo - s.need);
      if (!this.st.isDone(1)) { this.st.done(1); this.ui.note('Black solid now stays at the bottom — copper(II) oxide is **in excess**, so all the acid has reacted. CuO + H₂SO₄ → CuSO₄ + H₂O', 'gold'); }
    }
  }
  async filter() {
    const s = this.s;
    if (!this.st.isDone(1)) { this.ui.hint('Add copper(II) oxide until it is in excess first.', 2800); return; }
    if (s.phase !== 'acid' || this.busy) return;
    this.busy = true; this.burner.set('off'); s.heating = false; audio.pour();
    const p0 = this.bk.position.clone();
    await tweens.to(this.bk.position, { x: 0.035, y: this.Y + 0.2 }, 0.8).promise;
    await tweens.to(this.bk.rotation, { z: -1.1 }, 0.6).promise;
    await tweens.tween(1.6, (e) => { this.bk.setLevel(0.55 * (1 - e)); this.bas.setLevel(0.75 * e); }).promise;
    this.bas.setColor('#0284c7'); this.fun.residue.visible = true; this.sed.visible = false;
    await tweens.to(this.bk.rotation, { z: 0 }, 0.5).promise;
    await tweens.to(this.bk.position, { x: -0.36, y: this.Y, z: -0.14 }, 0.8).promise; void p0;
    s.phase = 'filtrate'; s.level = 0.75; this.busy = false;
    this.st.done(2);
    this.ui.note('Blue **filtrate** (copper(II) sulfate solution) in the basin; black **residue** (excess CuO) on the paper.', 'gold');
  }
  async evaporate() {
    const s = this.s;
    if (s.phase !== 'filtrate' || this.busy) { if (s.phase === 'acid') this.ui.hint('Filter the mixture first.', 2500); return; }
    this.busy = true;
    this.fun.visible = false;
    await tweens.to(this.bas.position, { x: -0.22, y: this.Y + 0.205 }, 1.0).promise;
    this.busy = false; s.phase = 'evap'; this.burner.set('roaring'); s.heating = true;
    this.ui.note('Heating the basin: water evaporates and the solution becomes more concentrated.');
  }
  rodTest() {
    const s = this.s;
    if (s.phase !== 'evap') { this.ui.hint('Evaporate the filtrate first.', 2500); return; }
    audio.clink();
    if (s.level > 0.38) this.ui.note('No crystals on the rod yet — keep heating.');
    else { s.cryst = true; this.ui.note('Small crystals form on the cool glass rod — this is the **crystallisation point**. Stop heating now!', 'gold'); }
  }
  stopHeat() { this.burner?.set('off'); if (this.s) this.s.heating = false; }
  async crystallise() {
    const s = this.s;
    if (s.phase !== 'evap' || this.busy) { this.ui.hint('Evaporate to the crystallisation point first.', 2500); return; }
    if (!s.cryst) { this.ui.hint('Use the **glass-rod test** to check for the crystallisation point first.', 3000); return; }
    this.stopHeat(); this.busy = true; this.st.done(3);
    await tweens.to(this.bas.position, { x: 0.2, y: this.Y }, 1.0).promise;
    const col = s.over ? '#bae6fd' : '#1d8fe0';
    for (let i = 0; i < 9; i++) { const c = crystal(col, 0.009 + Math.random() * 0.006); c.position.set((Math.random() - 0.5) * 0.05, 0.004 + Math.random() * 0.004, (Math.random() - 0.5) * 0.05); c.rotation.y = Math.random() * 3; c.scale.setScalar(0.01); this.crys.add(c); }
    await tweens.tween(3.0, (e) => { this.crys.children.forEach((c) => c.scale.setScalar(0.01 + e)); this.bas.setLevel(s.level * (1 - 0.8 * e)); }).promise;
    this.busy = false; s.phase = 'done'; this.st.done(4); audio.complete?.();
    this.ui.note(s.over ? 'You overheated: some crystals lost their water and look pale and powdery. Stop at the crystallisation point next time.' : 'Beautiful blue crystals of **hydrated copper(II) sulfate**, CuSO₄·5H₂O. Pat dry with filter paper.', s.over ? 'warn' : 'gold');
    this.checkTab('soluble', this.st, 6);
  }
  simSoluble(dt, t) {
    const s = this.s; if (!this.burner) return;
    this.burner.update(dt, t); this.bk.update(dt); this.bas.update(dt);
    if (s.phase === 'acid') { s.T = clamp(s.T + (s.heating ? 6 : -1.5) * dt, 20, 62); this.th.set(s.T); if (s.T >= 45 && !this.st.isDone(0)) { this.st.done(0); this.ui.note('The acid is warm (about 50 °C) — warm acid reacts faster with the base.'); } }
    if (s.phase === 'evap' && s.heating) {
      s.level = Math.max(0.08, s.level - dt * 0.035); this.bas.setLevel(s.level);
      if (s.level < 0.2 && !s.over) { s.over = true; this.ui.note('⚠️ Too far! The solution is spitting — you are heating towards dryness.', 'warn'); }
      if (s.level <= 0.08) this.stopHeat();
    }
    this.steam.position.copy(this.bas.position).y += 0.06;
    this.steam.setRate(s.phase === 'evap' && s.heating ? 3 : 0); this.steam.update(dt);
    const pH = s.phase === 'acid' ? (s.cuo >= s.need ? 4.5 : 1 + 3 * (s.cuo / s.need)) : 4.5;
    this.ro.set('T', s.phase === 'acid' ? s.T.toFixed(0) : '—'); this.ro.set('p', pH.toFixed(1)); this.ro.set('c', s.phase === 'acid' ? (s.cuo ? 'blue CuSO₄(aq)' : 'colourless acid') : s.phase === 'done' ? 'crystals' : 'CuSO₄(aq)');
  }

  // ======================================================== hydrated / anhydrous
  tab_hydrate() {
    const Y = this.Y;
    this.w = { heat: 0, on: false, water: 0, tested: new Set(), bp: false, rehyd: false };
    this.burner = new Bunsen(); this.lab.add(this.burner, -0.16, Y, 0);
    const stn = stand(0.3); this.lab.add(stn, -0.27, Y, -0.06);
    this.bt = boilingTube({ level: 0 }); this.bt.rotation.z = -1.25; this.lab.add(this.bt, -0.2, Y + 0.17, 0); this.bt.rotation.z = -1.25;
    this.cr = new THREE.Group(); this.bt.add(this.cr);
    for (let i = 0; i < 10; i++) { const c = crystal('#1d8fe0', 0.006); c.position.set((Math.random() - 0.5) * 0.016, 0.005 + Math.random() * 0.03, (Math.random() - 0.5) * 0.012); c.rotation.set(Math.random(), Math.random(), Math.random()); this.cr.add(c); }
    this.lab.label(this.bt, 'Blue copper(II) sulfate crystals', { y: 0.05, x: 0.02 });
    this.lab.add(mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.2, 8), M.glass), -0.02, Y + 0.19, 0).rotation.z = Math.PI / 2 - 0.15;
    const ice = beaker({ r: 0.04, h: 0.08, color: '#e0f2fe', level: 0.7, opacity: 0.45 }); this.lab.add(ice, 0.1, Y, 0);
    this.lab.label(ice, 'Collecting tube in ice', { y: 0.2 });
    this.ct = testTube({ level: 0, color: '#dbeafe', opacity: 0.55 }); this.lab.add(this.ct, 0.1, Y + 0.02, 0);
    this.drop = mesh(new THREE.SphereGeometry(0.003, 8, 6), new THREE.MeshStandardMaterial({ color: '#bfdbfe', transparent: true, opacity: 0.8 })); this.lab.add(this.drop, 0.08, Y + 0.17, 0);
    this.paper = mesh(new THREE.BoxGeometry(0.05, 0.002, 0.02), mat('#2563eb', 0, 0.9)); this.lab.add(this.paper, 0.27, Y + 0.002, 0.08); this.lab.label(this.paper, 'Cobalt(II) chloride paper', { y: 0.03, cls: 'dimlab' });
    this.dish = basin(); this.dish.setColor('#f8fafc'); this.lab.add(this.dish, 0.28, Y, -0.06); this.lab.label(this.dish, 'Anhydrous CuSO₄', { y: 0.06, cls: 'dimlab' });
    this.pow = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 20), mat('#f8fafc', 0, 0.95), 0, 0.008, 0); this.dish.add(this.pow);
    const ui = this.ui;
    this.st2 = ui.steps(['**Heat** the blue hydrated crystals and collect the liquid', 'Test the liquid with **cobalt(II) chloride paper** and **anhydrous copper(II) sulfate**', 'Check the liquid is **pure water** by its boiling point', 'Add the water back to the **white powder**', 'Answer the analysis questions']);
    const sec = ui.section('Method');
    ui.buttons([{ label: '🔥 Heat crystals', kind: 'primary', onClick: () => { this.burner.set('roaring'); this.w.on = true; } }, { label: '⏹ Stop', onClick: () => { this.burner.set('off'); this.w.on = false; } }], sec);
    ui.buttons([{ label: '🧪 Cobalt chloride paper', onClick: () => this.testLiquid('co') }, { label: '🧪 Anhydrous CuSO₄', onClick: () => this.testLiquid('cu') }], sec);
    this.liqSeg = ui.seg({ label: 'Measure boiling point of…', options: [['coll', 'Collected liquid'], ['sea', 'Sea water'], ['tap', 'Tap water']], value: 'coll', parent: sec });
    ui.buttons([{ label: '🌡️ Boiling point', onClick: () => this.boilPoint() }, { label: '💧 Add water to white powder', onClick: () => this.rehydrate() }], sec);
    this.ro2 = ui.readouts([{ id: 'm', label: 'Mass of crystals', unit: 'g' }, { id: 'w', label: 'Liquid collected', unit: 'cm³' }, { id: 'b', label: 'Boiling point', unit: '°C' }], sec);
    ui.notes();
    ui.questions([
      { q: 'Blue copper(II) sulfate crystals turn **white** when heated because…', opts: ['their water of crystallisation is driven off, leaving anhydrous copper(II) sulfate', 'the copper burns', 'they melt', 'they react with oxygen'], e: 'CuSO₄·5H₂O ⇌ CuSO₄ + 5H₂O — adding water reverses it.', o: [2], sub: 'C7.3' },
      { q: 'Cobalt(II) chloride paper is a test for water. Its colour change is…', opts: ['blue → pink', 'pink → blue', 'white → blue', 'colourless → milky'], e: 'Anhydrous copper(II) sulfate gives white → blue.', o: [1], sub: 'C10.1' },
      { q: 'A liquid boils at **exactly 100 °C** (at standard pressure). This shows it is…', opts: ['pure water', 'sea water', 'a mixture', 'ethanol'], e: 'Impurities raise the boiling point (and lower the melting point).', o: [2], sub: 'C10.1' },
      { q: '2.50 g of hydrated crystals left 1.60 g of white powder. What mass of water was lost?', ans: 0.9, tol: 0.02, unit: 'g', e: '2.50 − 1.60 = {ans} g of water of crystallisation.', o: [2], sub: 'C7.3' },
      { q: 'Why is **distilled** water, not tap water, used in practical chemistry?', opts: ['Tap water contains dissolved ions that could interfere with results', 'Distilled water is colder', 'Tap water is acidic', 'Distilled water dissolves more'], e: 'Distillation removes dissolved salts.', o: [3], sub: 'C10.1' },
      { q: 'Using Ar values Cu = 64, S = 32, O = 16: what is the **Mr** of anhydrous CuSO₄?', ans: 160, tol: 0, abs: 0.5, unit: '', e: '64 + 32 + 4 × 16 = {ans}. (Hydrated CuSO₄·5H₂O adds 5 × 18 = 90, giving 250.)', o: [2], sub: 'C3.2' },
      { q: 'Mr(CuSO₄·5H₂O) = 250 and Mr(CuSO₄) = 160. What mass of anhydrous solid comes from 5.00 g of crystals?', ans: 3.2, tol: 0.01, unit: 'g', e: '5.00 × 160 ÷ 250 = {ans} g — reacting masses in simple proportion.', o: [3], sub: 'C3.2' },
      { q: 'The **relative atomic mass** (Ar) of an element is…', opts: ['the average mass of its atoms (including isotopes) compared with 1/12 of a carbon-12 atom', 'its number of protons', 'the mass of one proton', 'its number of neutrons'], e: 'Ar is why chlorine is 35.5, not a whole number.', o: [1], sub: 'C3.2' },
    ], { sub: 'C10.1', onDone: () => { this.st2.done(4); this.checkTab('hydrate', this.st2, 5); } });
    this.every((dt, t) => this.simHydrate(dt, t));
    this.onTabDispose(() => { this.burner?.dispose(); this.burner = null; });
  }
  testLiquid(k) {
    if (this.w.water < 0.25) { this.ui.hint('Collect some liquid first.', 2500); return; }
    if (this.w.tested.has(k)) return;
    this.w.tested.add(k); audio.blip();
    if (k === 'co') { tweens.tween(1.2, (e) => this.paper.material.color.set('#2563eb').lerp(new THREE.Color('#f472b6'), e)); this.ui.note('Cobalt(II) chloride paper: **blue → pink**. The liquid contains water.', 'gold'); }
    else { this.ui.note('A pinch of anhydrous copper(II) sulfate: **white → blue**. Water again!', 'gold'); }
    if (this.w.tested.size === 2) this.st2.done(1);
    this.checkTab('hydrate', this.st2, 5);
  }
  boilPoint() {
    const k = this.liqSeg.get();
    if (k === 'coll' && this.w.water < 0.25) { this.ui.hint('Collect some liquid first.', 2500); return; }
    const bp = { coll: 100.0, sea: 100.6, tap: 100.1 }[k];
    this.ro2.set('b', bp.toFixed(1)); audio.blip();
    this.ui.note(k === 'coll' ? 'Collected liquid boils at **100.0 °C** — it is **pure water**.' : `${k === 'sea' ? 'Sea' : 'Tap'} water boils at ${bp.toFixed(1)} °C — the dissolved salts raise the boiling point, so it is **not pure**.`, k === 'coll' ? 'gold' : '');
    if (k === 'coll') { this.w.bp = true; this.st2.done(2); }
    this.checkTab('hydrate', this.st2, 5);
  }
  rehydrate() {
    if (this.w.heat < 1) { this.ui.hint('First turn the blue crystals white by heating them.', 2500); return; }
    if (this.w.rehyd) return;
    this.w.rehyd = true; audio.fizz?.(0.3);
    tweens.tween(1.5, (e) => { this.pow.material.color.set('#f8fafc').lerp(new THREE.Color('#1d8fe0'), e); });
    this.ui.note('Water added to white anhydrous copper(II) sulfate: it turns **blue** again and gets **hot** — the reaction is reversible (and exothermic this way).', 'gold');
    this.st2.done(3); this.checkTab('hydrate', this.st2, 5);
  }
  simHydrate(dt, t) {
    const w = this.w; if (!this.burner) return;
    this.burner.update(dt, t);
    if (w.on) { w.heat = Math.min(1, w.heat + dt / 9); w.water = Math.min(1, w.water + (w.heat > 0.15 ? dt / 9 : 0)); }
    const col = new THREE.Color('#1d8fe0').lerp(new THREE.Color('#f1f5f9'), w.heat);
    this.cr.children.forEach((c) => { c.material.color.copy(col); c.material.emissive.copy(col).multiplyScalar(0.2); });
    this.ct.setLevel(w.water * 0.3); this.ct.update(dt);
    this.drop.visible = w.on && w.heat > 0.15 && w.water < 1;
    if (this.drop.visible) { this.drop.position.y -= dt * 0.12; if (this.drop.position.y < this.Y + 0.08) this.drop.position.y = this.Y + 0.17; }
    this.ro2.set('m', (2.5 - 0.9 * w.heat).toFixed(2)); this.ro2.set('w', (w.water * 0.9).toFixed(2));
    if (w.heat >= 1 && w.water > 0.25 && !this.st2.isDone(0)) { this.st2.done(0); this.ui.note('The crystals are now **white** (anhydrous) and a clear liquid has condensed in the cold tube.', 'gold'); this.checkTab('hydrate', this.st2, 5); }
  }

  // ======================================================== precipitation
  tab_precip() {
    const Y = this.Y;
    this.pp = { found: new Set(), none: false, made: false };
    this.tr = new TubeRack(this, { n: 6, x: -0.1, z: 0.02, label: 'Test tubes' });
    reagentShelf(this, SOL, { x: -0.31, z: -0.16, spacing: 0.072 }, (i) => this.addSol(SOL[i]));
    this.fun2 = funnel(); this.lab.add(this.fun2, 0.25, Y + 0.075, 0.02); this.lab.label(this.fun2, 'Filter, wash, dry', { y: 0.13 });
    this.fl = conicalFlask({ level: 0, color: '#f1f5f9', opacity: 0.4 }); this.lab.add(this.fl, 0.25, Y, 0.02); this.fl.scale.setScalar(0.6);
    const ui = this.ui;
    this.st3 = ui.steps(['Find **three** pairs of solutions that form a **precipitate**', 'Find a pair that gives **no** precipitate', 'Make **barium sulfate**, then filter, wash and dry it', 'Answer the analysis questions']);
    const sec = ui.section('Mix two solutions');
    ui.text('Select a tube, then click two reagent bottles. Every salt here is soluble on its own — watch what happens when the ions meet.', sec);
    const empty = (t) => { this.tr.clearTube(t); t.ppt = null; };
    ui.buttons([{ label: '🧽 Empty selected tube', onClick: () => empty(this.tr.current) }, { label: '🧽 Wash all', onClick: () => this.tr.tubes.forEach(empty) }, { label: '🧻 Filter, wash & dry', kind: 'primary', onClick: () => this.filterPpt() }], sec);
    this.tbl = ui.table(['Mixture', 'Result'], sec);
    const rules = ui.section('Solubility rules');
    rules.append(h('div', { class: 'muted', style: { fontSize: '.86em', lineHeight: 1.55 }, html: '• All <b>sodium, potassium and ammonium</b> salts are soluble.<br>• All <b>nitrates</b> are soluble.<br>• <b>Chlorides</b> are soluble, except silver chloride (and lead chloride).<br>• <b>Sulfates</b> are soluble, except barium sulfate (and lead sulfate; calcium sulfate is only slightly soluble).<br>• <b>Carbonates</b> are insoluble, except sodium, potassium and ammonium carbonates.' }));
    ui.notes();
    ui.questions([
      { q: 'How is insoluble **barium sulfate** prepared for an X-ray barium meal?', opts: ['Mix solutions of a soluble barium salt and a soluble sulfate, then filter, wash and dry the precipitate', 'React barium metal with sulfuric acid and crystallise', 'Evaporate barium sulfate solution to dryness', 'Titrate barium hydroxide with sulfuric acid and crystallise'], e: 'Insoluble salts are made by precipitation.', o: [3], sub: 'C7.3' },
      { q: 'Why is the precipitate **washed with distilled water** on the filter paper?', opts: ['To remove the soluble ions left from the other product', 'To dissolve the precipitate', 'To make it react faster', 'To change its colour'], e: 'Washing removes spectator-ion solution such as sodium chloride.', o: [3], sub: 'C7.3' },
      { q: 'Which pair of solutions gives a precipitate?', opts: ['Calcium chloride + sodium carbonate', 'Sodium chloride + sodium sulfate', 'Copper(II) sulfate + sodium chloride', 'Sodium carbonate + sodium chloride'], e: 'Calcium carbonate is insoluble — it is the limescale in kettles.', o: [3], sub: 'C7.3' },
      { q: 'Which separation method removes an insoluble solid from a liquid?', opts: ['Filtration', 'Crystallisation', 'Distillation', 'Chromatography'], e: 'Filtration: the solid stays as the residue.', o: [1, 2], sub: 'C12.4' },
    ], { sub: 'C7.3', onDone: () => { this.st3.done(3); this.checkTab('precip', this.st3, 4); } });
    this.every((dt) => this.tr.update(dt));
  }
  addSol(r) {
    const t = this.tr.current;
    t.content = t.content || [];
    if (t.content.length >= 2) { this.ui.hint('This tube already holds two solutions — empty it or pick another tube.', 2600); audio.fail(); return; }
    if (t.content.includes(r.id)) { this.ui.hint('Add a **different** solution.', 2000); return; }
    t.content.push(r.id); audio.pour();
    if (t.content.length === 1) { this.tr.fill(t, r.color, 0.3, r.id === 'CuSO4' ? 0.8 : 0.45); this.ui.note(`Tube ${t.i + 1}: ${r.name} solution.`); return; }
    const [a, b] = t.content; const nA = SOL.find((x) => x.id === a).name, nB = r.name;
    this.tr.fill(t, t.content.includes('CuSO4') ? '#38bdf8' : '#f8fafc', 0.58, 0.5, 0.3);
    const res = PPT[pairKey(a, b)];
    if (res) {
      this.tr.precipitate(t, res[1], 1); this.tr.fill(t, new THREE.Color(res[1]).lerp(new THREE.Color('#ffffff'), 0.3).getStyle(), 0.58, 0.85, 1.2);
      this.tbl.add([`${nA} + ${nB}`, `<b>Precipitate:</b> ${res[0]}`]);
      this.ui.note(`A **${res[0]}** precipitate forms instantly. Ionic equation: ${res[2]}.`, 'gold'); audio.discover();
      this.pp.found.add(res[0]); t.ppt = res[0];
      if (this.pp.found.size >= 3) this.st3.done(0);
    } else {
      this.tbl.add([`${nA} + ${nB}`, 'No precipitate — both possible products are soluble']);
      this.ui.note('No change: every possible combination of these ions is **soluble**, so they all stay dissolved.');
      this.pp.none = true; this.st3.done(1);
    }
    this.checkTab('precip', this.st3, 4);
  }
  async filterPpt() {
    const t = this.tr.current;
    if (!t.ppt) { this.ui.hint('Select a tube that contains a precipitate.', 2500); return; }
    if (this.busy) return; this.busy = true;
    const what = t.ppt;
    const target = new THREE.Vector3(); this.fun2.getWorldPosition(target); target.y += 0.12;
    await this.tr.moveTo(t, target, 0.7);
    await tweens.to(t.holder.rotation, { z: -2.0 }, 0.5).promise;
    this.fun2.residue.visible = true; this.fun2.residue.material.color.set(t.sed.material.color);
    await tweens.tween(1.2, (e) => { this.fl.setLevel(0.35 * e); t.v.setLevel(0.58 * (1 - e)); }).promise;
    t.sed.visible = false;
    await tweens.to(t.holder.rotation, { z: 0 }, 0.4).promise;
    await this.tr.back(t, 0.6);
    this.tr.clearTube(t); t.ppt = null; this.busy = false;
    this.ui.note('Filtered: the solid stays on the paper. **Washed** with distilled water to remove soluble ions, then **dried** in a warm oven.', 'gold');
    if (what === 'barium sulfate') { this.st3.done(2); this.ui.note('Pure, dry **barium sulfate** — ready for the clinic’s X-ray barium meal.', 'gold'); }
    this.checkTab('precip', this.st3, 4);
  }

  checkTab(id, st) { st.check(); }
  dispose() { super.dispose(); }
}
