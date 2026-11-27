import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { Bunsen, Puffs, mesh, mat, M } from '../apparatus.js';
import { TubeRack } from '../tubes.js';
import { h, clear, tweens } from '../../core/util.js';
import { audio } from '../../core/audio.js';

// ---------------------------------------------------------------- flame tests
const FLAME = {
  Li: { name: 'Lithium chloride', ion: 'Li⁺', col: '#ff1f3d', word: 'red' },
  Na: { name: 'Sodium chloride', ion: 'Na⁺', col: '#ffb000', word: 'yellow' },
  K: { name: 'Potassium chloride', ion: 'K⁺', col: '#c084fc', word: 'lilac' },
  Ca: { name: 'Calcium chloride', ion: 'Ca²⁺', col: '#ff5a1f', word: 'orange-red' },
  Cu: { name: 'Copper(II) chloride', ion: 'Cu²⁺', col: '#14d9a0', word: 'blue-green' },
};
const STARS = [{ id: 'X', ion: 'Cu' }, { id: 'Y', ion: 'Li' }, { id: 'Z', ion: 'Ca' }];

// ---------------------------------------------------------------- ions
const UNK = [
  { id: 'CuSO4', name: 'Copper(II) sulfate', col: '#38bdf8', cat: 'Cu', an: 'SO4' },
  { id: 'FeSO4', name: 'Iron(II) sulfate', col: '#bbf7d0', cat: 'Fe2', an: 'SO4' },
  { id: 'FeCl3', name: 'Iron(III) chloride', col: '#fcd34d', cat: 'Fe3', an: 'Cl' },
  { id: 'ZnI2', name: 'Zinc iodide', col: '#f8fafc', cat: 'Zn', an: 'I' },
  { id: 'CaBr2', name: 'Calcium bromide', col: '#f8fafc', cat: 'Ca', an: 'Br' },
  { id: 'NH4Cl', name: 'Ammonium chloride', col: '#f8fafc', cat: 'NH4', an: 'Cl' },
  { id: 'Na2CO3', name: 'Sodium carbonate', col: '#f8fafc', cat: 'Na', an: 'CO3' },
];
const NONE = ['no precipitate', null];
const CAT = {
  Cu: { naoh: ['light blue precipitate', '#60a5fa'], naohX: ['light blue precipitate, insoluble in excess', '#60a5fa'], nh3: ['light blue precipitate', '#60a5fa'], nh3X: ['precipitate dissolves → dark blue solution', null, '#1e40af'] },
  Fe2: { naoh: ['green precipitate', '#4d7c0f'], naohX: ['green precipitate, insoluble in excess', '#4d7c0f'], nh3: ['green precipitate', '#4d7c0f'], nh3X: ['green precipitate, insoluble in excess', '#4d7c0f'] },
  Fe3: { naoh: ['red-brown precipitate', '#9a3412'], naohX: ['red-brown precipitate, insoluble in excess', '#9a3412'], nh3: ['red-brown precipitate', '#9a3412'], nh3X: ['red-brown precipitate, insoluble in excess', '#9a3412'] },
  Zn: { naoh: ['white precipitate', '#ffffff'], naohX: ['white precipitate dissolves → colourless solution', null, '#f8fafc'], nh3: ['white precipitate', '#ffffff'], nh3X: ['white precipitate dissolves → colourless solution', null, '#f8fafc'] },
  Ca: { naoh: ['white precipitate', '#ffffff'], naohX: ['white precipitate, insoluble in excess', '#ffffff'], nh3: ['no precipitate (or very slight)', null], nh3X: NONE },
  NH4: { naoh: NONE, naohX: NONE, nh3: NONE, nh3X: NONE, warm: true },
  Na: { naoh: NONE, naohX: NONE, nh3: NONE, nh3X: NONE },
};
const AN = {
  SO4: { ag: NONE, ba: ['white precipitate', '#ffffff'], acid: ['no fizzing', null] },
  Cl: { ag: ['white precipitate', '#ffffff'], ba: NONE, acid: ['no fizzing', null] },
  Br: { ag: ['cream precipitate', '#fef3c7'], ba: NONE, acid: ['no fizzing', null] },
  I: { ag: ['yellow precipitate', '#fde047'], ba: NONE, acid: ['no fizzing', null] },
  CO3: { ag: ['fizzes (carbonate reacts with the nitric acid); no precipitate', null], ba: ['fizzes; no precipitate', null], acid: ['fizzes — the gas turns limewater milky: CO₂', null], fizz: true },
};
const TESTS = [
  ['naoh', 'NaOH(aq), few drops', 'cat'], ['naohX', 'NaOH(aq), excess', 'cat'], ['nh3', 'NH₃(aq), few drops', 'cat'], ['nh3X', 'NH₃(aq), excess', 'cat'],
  ['warm', 'Warm with NaOH + damp red litmus', 'cat'], ['ag', 'Nitric acid + silver nitrate', 'an'], ['ba', 'Nitric acid + barium nitrate', 'an'], ['acid', 'Dilute acid (+ limewater)', 'an'],
];

// ---------------------------------------------------------------- gases
const GASES = [
  { id: 'H2', name: 'Hydrogen', tint: null }, { id: 'O2', name: 'Oxygen', tint: null }, { id: 'CO2', name: 'Carbon dioxide', tint: null },
  { id: 'Cl2', name: 'Chlorine', tint: '#d9f99d' }, { id: 'NH3', name: 'Ammonia', tint: null },
];
const GTESTS = [['lit', '🔥 Lighted splint'], ['glow', '✨ Glowing splint'], ['lime', '🥛 Limewater'], ['blue', '🟦 Damp blue litmus'], ['red', '🟥 Damp red litmus']];
const GRES = {
  H2: { lit: 'burns with a **squeaky pop**', glow: 'goes out', lime: 'no change', blue: 'no change', red: 'no change' },
  O2: { lit: 'burns more brightly', glow: '**relights**', lime: 'no change', blue: 'no change', red: 'no change' },
  CO2: { lit: 'goes out', glow: 'goes out', lime: 'turns **milky**', blue: 'turns slightly red (acidic gas)', red: 'no change' },
  Cl2: { lit: 'goes out', glow: 'goes out', lime: 'no change', blue: 'turns red, then **bleached** white', red: '**bleached** white' },
  NH3: { lit: 'goes out', glow: 'goes out', lime: 'no change', blue: 'no change', red: 'turns **blue** (alkaline gas)' },
};

const rich = (t) => t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

export default class Analysis extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Teo’s firework stars lost their labels, and a rain-soaked delivery left Omar with jars of unknown chemicals. Use flame tests, precipitates and gas tests to identify every one.';
    this.tabLabels = [['flame', '🔥 Flame tests'], ['ions', '🧪 Ion tests'], ['gases', '💨 Gas tests']];
    this.tabObjectives = { flame: ['C12.5'], ions: ['C12.5', 'C8.4'], gases: ['C12.5'] };
    this.tabViews = { flame: { pos: [0, 1.45, 1.0], target: [0, 1.05, 0] }, ions: { pos: [-0.02, 1.45, 1.0], target: [-0.02, 1.0, 0] }, gases: { pos: [0, 1.42, 0.95], target: [0, 1.0, 0] } };
    this.view = this.tabViews.flame;
  }

  // ======================================================== flame
  tab_flame() {
    const Y = this.Y;
    this.fl = { known: new Set(), dirty: null, busy: false, ids: {} };
    this.burner = new Bunsen(); this.lab.add(this.burner, 0.05, Y, 0); this.burner.set('roaring');
    this.wire = new THREE.Group(); this.lab.add(this.wire, -0.12, Y + 0.12, 0.05);
    this.wire.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 10), M.wood, -0.06, 0, 0).rotateZ(Math.PI / 2), mesh(new THREE.CylinderGeometry(0.0009, 0.0009, 0.09, 6), M.steel, 0.025, 0, 0).rotateZ(Math.PI / 2), mesh(new THREE.TorusGeometry(0.004, 0.0009, 6, 12), M.steel, 0.074, 0, 0));
    this.lab.label(this.wire, 'Nichrome wire loop', { y: 0.03, x: -0.04 });
    const sample = (x, z, label, color, onClick) => { const g = new THREE.Group(); this.lab.add(g, x, Y, z); g.add(mesh(new THREE.CylinderGeometry(0.028, 0.02, 0.008, 18), mat('#e2e8f0', 0, 0.3), 0, 0.004, 0), mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 14), mat(color, 0, 0.9), 0, 0.009, 0)); this.lab.label(g, label, { y: 0.035, cls: 'dimlab' }); this.lab.interactive(g, { tip: `${label} — click to dip the wire and flame-test it`, onClick }); return g; };
    Object.entries(FLAME).forEach(([k, d], i) => sample(-0.3 + i * 0.075, 0.17, d.name.replace(' chloride', ''), k === 'Cu' ? '#5eead4' : '#f8fafc', () => this.flameTest(k)));
    STARS.forEach((s, i) => sample(0.2 + i * 0.075, 0.13, `Star ${s.id}`, '#a8a29e', () => this.flameTest(s.ion, s.id)));
    const acid = sample(-0.32, -0.04, 'Conc. HCl (clean)', '#e0f2fe', () => this.cleanWire());
    void acid;
    const ui = this.ui;
    this.stF = ui.steps(['Flame-test all **five known** metal chlorides', 'Clean the wire between tests (dip in acid, then heat)', 'Identify the metal ion in firework stars **X, Y and Z**', 'Answer the analysis questions']);
    const sec = ui.section('Flame tests');
    ui.buttons(Object.entries(FLAME).map(([k, d]) => ({ label: d.ion, onClick: () => this.flameTest(k) })), sec);
    ui.buttons([...STARS.map((s) => ({ label: `⭐ Star ${s.id}`, onClick: () => this.flameTest(s.ion, s.id) })), { label: '🧼 Clean wire', kind: 'primary', onClick: () => this.cleanWire() }], sec);
    this.ftab = ui.table(['Sample', 'Flame colour', 'Ion'], sec);
    const id = ui.section('Identify the firework stars');
    this.starSel = STARS.map((s) => ui.select({ label: `Star ${s.id}`, options: [['', '— choose —'], ...Object.entries(FLAME).map(([k, d]) => [k, `${d.ion} (${d.word})`])], value: '', parent: id }));
    ui.buttons([{ label: '✔ Check identities', kind: 'primary', onClick: () => this.checkStars() }], id);
    ui.notes();
    ui.questions([
      { q: 'A firework burns with a **lilac** flame. Which ion does it contain?', opts: ['K⁺', 'Na⁺', 'Li⁺', 'Cu²⁺'], e: 'Potassium: lilac. Sodium: yellow. Lithium: red. Copper(II): blue-green.', o: [4] },
      { q: 'Why must the wire be cleaned between flame tests?', opts: ['Traces of the last sample would mix colours and give a false result', 'To cool it down', 'To make it conduct', 'To sharpen the loop'], e: 'Sodium contamination is the classic problem — its yellow masks other colours.', o: [4] },
      { q: 'Which ion gives an **orange-red** flame?', opts: ['Ca²⁺', 'Cu²⁺', 'K⁺', 'Na⁺'], e: 'Calcium: orange-red (brick red).', o: [4] },
    ], { sub: 'C12.5', onDone: () => { this.stF.done(3); this.checkTab('flame', this.stF, 4); } });
    this.every((dt, t) => this.burner?.update(dt, t));
    this.onTabDispose(() => { this.burner?.dispose(); this.burner = null; });
  }
  async flameTest(k, starId = null) {
    if (this.fl.busy) return;
    const d = FLAME[k];
    if (this.fl.dirty && this.fl.dirty !== k) {
      this.fl.busy = true; this.burner.set('roaring', '#ffb000'); audio.crackle?.(0.4);
      this.ui.note(`⚠️ Contaminated wire! Traces of the last sample turned the flame **yellow-orange** — this result can’t be trusted. **Clean the wire** first.`, 'warn');
      await tweens.tween(1.6, () => {}).promise; this.burner?.set('roaring'); this.fl.busy = false; return;
    }
    this.fl.busy = true; audio.whoosh?.();
    const p0 = this.wire.position.clone();
    await tweens.to(this.wire.position, { x: 0.05 - 0.074, y: this.Y + 0.17, z: 0 }, 0.6).promise;
    this.burner.set('roaring', d.col); audio.crackle?.(0.5);
    await tweens.tween(1.8, () => {}).promise;
    this.burner?.set('roaring');
    await tweens.to(this.wire.position, { x: p0.x, y: p0.y, z: p0.z }, 0.5).promise;
    this.fl.busy = false; this.fl.dirty = k;
    const label = starId ? `Firework star ${starId}` : d.name;
    this.ftab.add([label, `<b style="color:${d.col}">${d.word}</b>`, starId ? '?' : d.ion]);
    if (!starId) { this.fl.known.add(k); if (this.fl.known.size === 5) { this.stF.done(0); this.ui.note('All five reference colours recorded. Now test the firework stars.', 'gold'); } }
    else this.ui.note(`Firework star ${starId}: a **${d.word}** flame.`);
    this.checkTab('flame', this.stF, 4);
  }
  cleanWire() {
    if (this.fl.busy) return;
    audio.fizz?.(0.3);
    if (this.fl.dirty) { this.fl.cleaned = (this.fl.cleaned || 0) + 1; if (this.fl.cleaned >= 2) this.stF.done(1); }
    this.fl.dirty = null;
    this.ui.note('Wire dipped in concentrated hydrochloric acid and held in the flame until it gives no colour — clean.');
    this.checkTab('flame', this.stF, 4);
  }
  checkStars() {
    const ok = STARS.every((s, i) => this.starSel[i].get() === s.ion);
    if (ok) { audio.success(); this.stF.done(2); this.ui.note('Correct! **X = copper(II)** (blue-green), **Y = lithium** (red), **Z = calcium** (orange-red). Teo can label his firework stars.', 'gold'); }
    else { audio.fail(); this.ui.note('Not all correct — compare each star’s flame with your reference colours.', 'warn'); }
    this.checkTab('flame', this.stF, 4);
  }

  // ======================================================== ions
  tab_ions() {
    const Y = this.Y;
    this.io = { cat: new Set(), an: new Set(), nh4: false };
    this.order = UNK.slice().sort(() => Math.random() - 0.5);
    this.tr = new TubeRack(this, { n: 7, x: -0.06, z: 0.03, spacing: 0.052, label: 'Unknown solutions 1–7' });
    this.tr.tubes.forEach((t, i) => { const u = this.order[i]; t.u = u; this.tr.fill(t, u.col, 0.3, u.col === '#f8fafc' ? 0.45 : 0.75); });
    this.litmus = mesh(new THREE.BoxGeometry(0.004, 0.03, 0.012), mat('#ef4444', 0, 0.9)); this.litmus.visible = false; this.lab.add(this.litmus, 0, Y + 0.2, 0);
    const ui = this.ui;
    this.stI = ui.steps(['Test the **cations** with aqueous NaOH and NH₃ (at least 5 tubes)', 'Test the **anions** with the silver nitrate, barium nitrate and acid tests (at least 5 tubes)', 'Find the **ammonium** ion: warm with NaOH and test the gas', 'Identify **all seven** unknowns', 'Answer the analysis questions']);
    const sec = ui.section('Tests on the selected tube');
    ui.text('Click a tube to select it. Each button adds a fresh portion of that sample to a clean tube.', sec);
    ui.buttons(TESTS.slice(0, 5).map(([k, l]) => ({ label: l, onClick: () => this.ionTest(k) })), sec);
    ui.buttons(TESTS.slice(5).map(([k, l]) => ({ label: l, onClick: () => this.ionTest(k) })), sec);
    this.itab = ui.table(['Tube', 'Test', 'Observation'], sec);
    const id = ui.section('Identify the unknowns');
    this.idSel = this.order.map((u, i) => ui.select({ label: `Tube ${i + 1}`, options: [['', '— choose —'], ...UNK.map((x) => [x.id, x.name])], value: '', parent: id }));
    ui.buttons([{ label: '✔ Check identities', kind: 'primary', onClick: () => this.checkIons() }], id);
    ui.notes();
    ui.questions([
      { q: 'A solution gives a **white** precipitate with NaOH(aq) that **dissolves in excess**. The cation is…', opts: ['Zn²⁺', 'Ca²⁺', 'Cu²⁺', 'Fe³⁺'], e: 'Zinc hydroxide is amphoteric — it dissolves in excess alkali; calcium hydroxide does not.', o: [2], sub: 'C12.5' },
      { q: 'Acidified silver nitrate gives a **cream** precipitate. The anion is…', opts: ['bromide', 'chloride', 'iodide', 'sulfate'], e: 'Chloride white, bromide cream, iodide yellow.', o: [1], sub: 'C12.5' },
      { q: 'Why is the sample acidified with nitric acid before adding silver nitrate?', opts: ['To remove carbonate ions, which would also give a precipitate', 'To make the precipitate dissolve', 'To speed up the reaction', 'To colour the solution'], e: 'Carbonates would give a false positive.', o: [1], sub: 'C12.5' },
      { q: 'Copper and iron compounds are coloured. This is typical of…', opts: ['transition elements', 'Group I metals', 'noble gases', 'halogens'], e: 'Transition elements form coloured compounds, have high densities and act as catalysts.', o: [1], sub: 'C8.4' },
    ], { sub: 'C12.5', onDone: () => { this.stI.done(4); this.checkTab('ions', this.stI, 5); } });
    this.every((dt) => this.tr.update(dt));
  }
  ionTest(k) {
    const t = this.tr.current, u = t.u, kind = TESTS.find((x) => x[0] === k)[2];
    let res;
    if (k === 'warm') res = CAT[u.cat].warm ? ['gas given off turns damp red litmus **blue** — ammonia, so NH₄⁺ is present', null] : ['no gas; litmus stays red', null];
    else res = kind === 'cat' ? CAT[u.cat][k] : AN[u.an][k];
    const [obs, ppt, sol] = res;
    this.tr.clearTube(t); t.content = 'test';
    this.tr.fill(t, sol || (u.cat === 'Cu' && kind === 'cat' && !ppt ? '#38bdf8' : u.col), 0.4, 0.65, 0.4);
    if (ppt) { this.tr.precipitate(t, ppt, 1); this.tr.fill(t, new THREE.Color(ppt).lerp(new THREE.Color('#ffffff'), 0.35).getStyle(), 0.4, 0.85, 1); }
    if (k === 'acid' && AN[u.an].fizz) { t.bub.setRate(30); setTimeout(() => t.bub.setRate(0), 2500); audio.fizz(0.6); }
    if (k === 'warm') { this.litmus.visible = true; this.litmus.position.set(t.holder.getWorldPosition(new THREE.Vector3()).x, this.Y + 0.18, 0.03); this.litmus.material.color.set(CAT[u.cat].warm ? '#2563eb' : '#ef4444'); }
    audio.blip();
    this.itab.add([t.i + 1, TESTS.find((x) => x[0] === k)[1], rich(obs)]);
    if (kind === 'cat' && k !== 'warm') this.io.cat.add(t.i);
    if (kind === 'an') this.io.an.add(t.i);
    if (k === 'warm' && CAT[u.cat].warm) { this.io.nh4 = true; this.stI.done(2); this.ui.note(`Tube ${t.i + 1} contains **ammonium** ions: NH₄⁺ + OH⁻ → NH₃ + H₂O on warming.`, 'gold'); }
    if (this.io.cat.size >= 5) this.stI.done(0);
    if (this.io.an.size >= 5) this.stI.done(1);
    this.checkTab('ions', this.stI, 5);
  }
  checkIons() {
    const wrong = this.order.filter((u, i) => this.idSel[i].get() !== u.id).length;
    if (!wrong) { audio.success(); this.stI.done(3); this.ui.note('All seven identified! Each label = cation test + anion test.', 'gold'); }
    else { audio.fail(); this.ui.note(`${wrong} identification${wrong > 1 ? 's are' : ' is'} wrong. Combine a cation result and an anion result for each tube.`, 'warn'); }
    this.checkTab('ions', this.stI, 5);
  }

  // ======================================================== gases
  tab_gases() {
    const Y = this.Y;
    this.gs = { tested: {}, };
    this.gorder = GASES.slice().sort(() => Math.random() - 0.5);
    this.tr = new TubeRack(this, { n: 5, x: -0.04, z: 0.02, spacing: 0.07, label: 'Gases A–E (stoppered)', r: 0.015, h: 0.15 });
    this.tr.tubes.forEach((t, i) => { const g = this.gorder[i]; t.g = g; if (g.tint) this.tr.fill(t, g.tint, 0.95, 0.25); t.lbl.userData.set('ABCDE'[i]); t.v.add(mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.02, 14), M.rubber, 0, 0.158, 0)); });
    this.splint = new THREE.Group(); this.lab.add(this.splint, 0.3, Y + 0.05, 0.1);
    this.splint.add(mesh(new THREE.BoxGeometry(0.004, 0.12, 0.004), mat('#d6a76c', 0, 0.9), 0, 0.06, 0));
    this.tipFlame = mesh(new THREE.ConeGeometry(0.006, 0.022, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.4), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0.13, 0); this.splint.add(this.tipFlame); this.tipFlame.visible = false;
    this.glow = mesh(new THREE.SphereGeometry(0.003, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.8, 0.2) }), 0, 0.121, 0); this.splint.add(this.glow); this.glow.visible = false;
    this.puff = new Puffs({ color: '#fef3c7', size: 0.03, rise: 0.04, life: 0.9, opacity: 0.5 }); this.lab.tabRoot.add(this.puff);
    const ui = this.ui;
    this.stG = ui.steps(['Use **every test** at least once', 'Identify gases **A–E**', 'Answer the analysis questions']);
    const sec = ui.section('Test the selected gas');
    ui.buttons(GTESTS.map(([k, l]) => ({ label: l, onClick: () => this.gasTest(k) })), sec);
    this.gtab = ui.table(['Gas', 'Test', 'Result'], sec);
    const id = ui.section('Identify the gases');
    this.gSel = this.gorder.map((g, i) => ui.select({ label: `Gas ${'ABCDE'[i]}`, options: [['', '— choose —'], ...GASES.map((x) => [x.id, x.name])], value: '', parent: id }));
    ui.buttons([{ label: '✔ Check identities', kind: 'primary', onClick: () => this.checkGases() }], id);
    ui.notes();
    ui.questions([
      { q: 'The test for **carbon dioxide** is…', opts: ['it turns limewater milky', 'it relights a glowing splint', 'a squeaky pop with a lighted splint', 'it bleaches damp litmus'], e: 'CO₂ + Ca(OH)₂ → CaCO₃ (white precipitate) + H₂O.', o: [3] },
      { q: 'A gas **bleaches damp litmus paper**. It is…', opts: ['chlorine', 'ammonia', 'oxygen', 'hydrogen'], e: 'Chlorine is used to bleach and to disinfect water.', o: [3] },
      { q: 'Which gas turns damp **red** litmus **blue**?', opts: ['Ammonia', 'Carbon dioxide', 'Chlorine', 'Hydrogen'], e: 'Ammonia is the only common alkaline gas.', o: [3] },
    ], { sub: 'C12.5', onDone: () => { this.stG.done(2); this.checkTab('gases', this.stG, 3); } });
    this.every((dt) => { this.tr.update(dt); this.puff.update(dt); });
  }
  async gasTest(k) {
    const t = this.tr.current, g = t.g, r = GRES[g.id][k];
    if (this._gbusy) return; this._gbusy = true;
    const wp = t.holder.getWorldPosition(new THREE.Vector3());
    if (k === 'lit' || k === 'glow') {
      this.tipFlame.visible = k === 'lit'; this.glow.visible = k === 'glow';
      const p0 = this.splint.position.clone();
      await tweens.to(this.splint.position, { x: wp.x, y: this.Y + 0.11, z: wp.z }, 0.5).promise;
      if (g.id === 'H2' && k === 'lit') { audio.pop(); this.puff.position.set(wp.x, this.Y + 0.25, wp.z); this.puff.setRate(30); setTimeout(() => this.puff.setRate(0), 150); this.tipFlame.visible = false; }
      else if (g.id === 'O2') { audio.whoosh?.(); this.tipFlame.visible = true; this.tipFlame.scale.setScalar(1.6); this.glow.visible = false; }
      else { this.tipFlame.visible = false; this.glow.visible = false; }
      await tweens.tween(1.0, () => {}).promise;
      await tweens.to(this.splint.position, { x: p0.x, y: p0.y, z: p0.z }, 0.5).promise;
      this.tipFlame.visible = false; this.tipFlame.scale.setScalar(1); this.glow.visible = false;
    } else if (k === 'lime') { audio.bubble(); this.tr.fill(t, g.id === 'CO2' ? '#f8fafc' : '#e0f2fe', 0.3, g.id === 'CO2' ? 0.95 : 0.5, 1.2); }
    else { audio.blip(); }
    this._gbusy = false;
    this.gtab.add(['ABCDE'[t.i], GTESTS.find((x) => x[0] === k)[1], rich(r)]);
    (this.gs.tested[k] = true);
    if (GTESTS.every(([kk]) => this.gs.tested[kk])) this.stG.done(0);
    this.checkTab('gases', this.stG, 3);
  }
  checkGases() {
    const wrong = this.gorder.filter((g, i) => this.gSel[i].get() !== g.id).length;
    if (!wrong) { audio.success(); this.stG.done(1); this.ui.note('All five gases identified!', 'gold'); }
    else { audio.fail(); this.ui.note(`${wrong} wrong — each gas has one test that is uniquely positive.`, 'warn'); }
    this.checkTab('gases', this.stG, 3);
  }

  checkTab(id, st) { st.check(); }
}
void h; void clear;
