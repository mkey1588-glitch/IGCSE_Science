import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { Vessel, Bubbles, Puffs, Sparks, spottingTile, testTube, mesh, mat, M, glassMaterial } from '../apparatus.js';
import { TubeRack } from '../tubes.js';
import { h, clear, clamp, tweens } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const G1 = {
  Li: { name: 'Lithium', speed: 0.02, fizz: 10, life: 9, color: '#cbd5e1', note: 'Lithium **floats** and **fizzes steadily** as it slowly disappears.' },
  Na: { name: 'Sodium', speed: 0.09, fizz: 26, life: 6, color: '#e2e8f0', melt: true, note: 'Sodium **melts into a silvery ball**, **whizzes** across the surface and fizzes rapidly.' },
  K: { name: 'Potassium', speed: 0.16, fizz: 45, life: 4, color: '#e2e8f0', melt: true, flame: '#c084fc', note: 'Potassium **bursts into a lilac flame**, crackles and races around — the most reactive of the three.' },
};
const ACIDM = {
  Mg: { name: 'Magnesium', rate: 40, col: '#d1d5db', note: 'Magnesium fizzes **vigorously** and the tube gets warm.' },
  Zn: { name: 'Zinc', rate: 12, col: '#9ca3af', note: 'Zinc fizzes **steadily**.' },
  Fe: { name: 'Iron', rate: 3, col: '#57534e', note: 'Iron gives just **a few slow bubbles**.' },
  Cu: { name: 'Copper', rate: 0, col: '#c8743c', note: 'Copper: **no reaction** with dilute acid — it is below hydrogen in the reactivity series.' },
};
const ORDER = ['K', 'Na', 'Li', 'Ca', 'Mg', 'Al', 'C', 'Zn', 'Fe', 'H', 'Cu', 'Ag', 'Au'];
const RANK = ['K', 'Na', 'Li', 'Mg', 'Zn', 'Fe', 'Cu'];
const NAMES = { K: 'Potassium', Na: 'Sodium', Li: 'Lithium', Mg: 'Magnesium', Zn: 'Zinc', Fe: 'Iron', Cu: 'Copper' };
const DISP_M = ['Mg', 'Zn', 'Fe', 'Cu'];
const SALT = { Mg: ['Magnesium sulfate', '#f8fafc'], Zn: ['Zinc sulfate', '#f8fafc'], Fe: ['Iron(II) sulfate', '#bbf7d0'], Cu: ['Copper(II) sulfate', '#38bdf8'] };
const COAT = { Mg: '#9ca3af', Zn: '#6b7280', Fe: '#3f3f46', Cu: '#a0522d' };
const HAL = {
  Cl: { name: 'Chlorine water', col: '#ecfccb', ion: 'KCl', ionName: 'Potassium chloride' },
  Br: { name: 'Bromine water', col: '#f59e0b', ion: 'KBr', ionName: 'Potassium bromide' },
  I: { name: 'Iodine solution', col: '#7c2d12', ion: 'KI', ionName: 'Potassium iodide' },
};
const HORDER = ['Cl', 'Br', 'I'];

export default class Reactivity extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Teo’s fireworks need the right metals, the harbour’s rusting crane needs a metal that sacrifices itself, and the water plant runs on chlorine. Rank the metals and halogens by reactivity.';
    this.tabLabels = [['water', '💥 Metals + water & acid'], ['displacement', '🔁 Displacement'], ['halogens', '🟠 Halogens']];
    this.tabObjectives = { water: ['C8.2', 'C9.4', 'C9.1', 'C9.2'], displacement: ['C9.4', 'C6.3'], halogens: ['C8.3', 'C6.3'] };
    this.tabViews = { water: { pos: [-0.02, 1.52, 1.12], target: [-0.02, 1.02, 0] }, displacement: { pos: [0, 1.3, 0.46], target: [0, 0.91, 0] }, halogens: { pos: [0, 1.46, 1.0], target: [0, 1.0, 0] } };
    this.view = this.tabViews.water;
  }

  // ======================================================== Group I + acids
  tab_water() {
    const Y = this.Y;
    this.wt = { dropped: new Set(), acid: new Set(), popped: false, ranked: false, active: null };
    this.trough = new Vessel([[0, 0.003], [0.13, 0.003], [0.135, 0.01], [0.135, 0.07]], { name: 'Trough', color: '#86efac', level: 0.62, opacity: 0.55 });
    this.lab.add(this.trough, -0.2, Y, 0); this.lab.label(this.trough, 'Water + universal indicator', { y: 0.1 });
    const shield = mesh(new THREE.BoxGeometry(0.34, 0.2, 0.004), new THREE.MeshPhysicalMaterial({ color: '#e0f2fe', transparent: true, opacity: 0.18, roughness: 0.05 })); this.lab.add(shield, -0.2, Y + 0.1, 0.17);
    this.lab.label(shield, 'Safety screen', { y: 0.12, cls: 'dimlab' });
    this.piece = new THREE.Group(); this.trough.add(this.piece); this.piece.visible = false;
    this.ball = mesh(new THREE.SphereGeometry(0.006, 14, 10), mat('#e2e8f0', 0.9, 0.2)); this.piece.add(this.ball);
    this.pfizz = new Bubbles({ r: 0.008, y0: -0.004, y1: 0.004, size: 0.0022, max: 80 }); this.piece.add(this.pfizz);
    this.flame = mesh(new THREE.ConeGeometry(0.012, 0.045, 12, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#c084fc').multiplyScalar(3), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })); this.flame.position.y = 0.025; this.piece.add(this.flame);
    this.sparks = new Sparks('#e9d5ff'); this.piece.add(this.sparks);
    this.steamP = new Puffs({ color: '#ffffff', size: 0.02, rise: 0.06, life: 1.4, opacity: 0.35 }); this.piece.add(this.steamP);
    this.tr = new TubeRack(this, { n: 4, x: 0.2, z: 0.0, spacing: 0.06, label: 'Dilute hydrochloric acid' });
    this.tr.tubes.forEach((t) => this.tr.fill(t, '#e0f2fe', 0.45, 0.45));
    const ui = this.ui;
    this.stw = ui.steps(['Drop **lithium, sodium and potassium** into water', 'Notice the **indicator colour** — what has formed?', 'Add **Mg, Zn, Fe and Cu** to dilute acid', 'Test the gas with a **lighted splint**', 'Put the metals in **order of reactivity**', 'Answer the analysis questions']);
    const sec = ui.section('Group I metals + water');
    ui.buttons(Object.entries(G1).map(([k, d]) => ({ label: `🔪 ${d.name}`, onClick: () => this.dropG1(k) })), sec);
    const s2 = ui.section('Metals + dilute hydrochloric acid');
    ui.buttons(Object.entries(ACIDM).map(([k, d]) => ({ label: `+ ${d.name}`, onClick: () => this.addMetalAcid(k) })), s2);
    ui.buttons([{ label: '🔥 Lighted splint at the magnesium tube', onClick: () => this.splint() }], s2);
    const rs = ui.section('Reactivity order (most reactive at the top)');
    this.rankList = RANK.slice().sort(() => Math.random() - 0.5);
    this.rankBox = h('div'); rs.append(this.rankBox); this.drawRank();
    ui.buttons([{ label: '✔ Check my order', kind: 'primary', onClick: () => this.checkRank() }], rs);
    ui.notes();
    ui.questions([
      { q: 'Sodium + water → ?', opts: ['sodium hydroxide + hydrogen', 'sodium oxide + hydrogen', 'sodium hydroxide + oxygen', 'sodium chloride + water'], e: '2Na + 2H₂O → 2NaOH + H₂. The hydroxide makes the indicator purple.', o: [1], sub: 'C8.2' },
      { q: 'Going **down** Group I, the reactivity with water…', opts: ['increases', 'decreases', 'stays the same', 'first increases then decreases'], e: 'Li < Na < K < Rb < Cs.', o: [1], sub: 'C8.2' },
      { q: 'Predict how **rubidium** (below potassium) reacts with water.', opts: ['Even more violently than potassium — it may explode', 'More slowly than lithium', 'It does not react', 'Exactly like copper'], e: 'Trends let us predict unknown properties.', o: [2], sub: 'C8.2' },
      { q: 'Why does copper not react with dilute hydrochloric acid?', opts: ['It is less reactive than hydrogen', 'It is a non-metal', 'The acid is too weak to react with any metal', 'Copper is coated in oxide'], e: 'Only metals above hydrogen displace it from acids.', o: [2], sub: 'C9.4' },
      { q: 'A metal fizzes slowly in acid and does not react with cold water. Where is it in the series?', opts: ['Between zinc and copper, e.g. iron', 'Above potassium', 'Below gold', 'Between sodium and lithium'], e: 'Use the observations to place unknown metals.', o: [3], sub: 'C9.4' },
      { q: 'Aluminium is used for aircraft bodies and overhead power cables because it…', opts: ['has a low density, resists corrosion and conducts electricity well', 'is very dense and cheap', 'reacts quickly with water', 'is magnetic'], e: 'A thin oxide layer protects aluminium from corrosion.', o: [1], sub: 'C9.2' },
      { q: 'Copper is used for electrical wiring because it…', opts: ['is an excellent electrical conductor and can be drawn into wires (ductile)', 'is the most reactive metal', 'is a poor conductor', 'is very hard and brittle'], e: 'It is also unreactive, so it does not corrode easily — good for water pipes too.', o: [1], sub: 'C9.2' },
    ], { sub: 'C9.4', onDone: () => { this.stw.done(5); this.checkTab('water', this.stw, 6); } });
    this.every((dt, t) => this.simWater(dt, t));
  }
  dropG1(k) {
    if (this.wt.active) { this.ui.hint('Wait for the current piece to finish reacting.', 2000); return; }
    const d = G1[k];
    this.wt.active = { k, t: 0, x: 0, z: 0, vx: (Math.random() - 0.5) * d.speed, vz: (Math.random() - 0.5) * d.speed };
    this.piece.visible = true; this.piece.position.set(0, this.trough.surfaceY() + 0.003, 0); this.piece.scale.setScalar(1);
    this.flame.visible = !!d.flame; this.ball.scale.set(d.melt ? 1 : 1.2, d.melt ? 1 : 0.6, d.melt ? 1 : 1.2);
    this.pfizz.setRate(d.fizz); this.steamP.setRate(d.melt ? 5 : 1);
    if (d.flame) { this.sparks.fire('#e9d5ff'); audio.crackle?.(1); }
    audio.splash?.(0.4); audio.fizz(0.7);
    this.ui.note(d.note);
  }
  addMetalAcid(k) {
    const i = Object.keys(ACIDM).indexOf(k), t = this.tr.tubes[i];
    if (t.content) return;
    const d = ACIDM[k]; t.content = k; audio.clink();
    const strip = mesh(new THREE.BoxGeometry(0.012, 0.03, 0.002), mat(d.col, 0.8, 0.35)); strip.position.y = 0.02; t.v.add(strip); t.strip = strip;
    t.bub.setRate(d.rate);
    this.ui.note(d.note);
    this.wt.acid.add(k);
    if (this.wt.acid.size === 4) { this.stw.done(2); this.ui.note('Order of fizzing in acid: Mg > Zn > Fe > Cu (none).', 'gold'); }
    this.checkTab('water', this.stw, 6);
  }
  splint() {
    if (!this.wt.acid.has('Mg')) { this.ui.hint('Add magnesium to the acid first.', 2400); return; }
    audio.pop(); this.wt.popped = true; this.stw.done(3);
    this.ui.note('**Squeaky pop!** The gas is **hydrogen**. Metal + acid → salt + hydrogen, e.g. Mg + 2HCl → MgCl₂ + H₂.', 'gold');
    this.checkTab('water', this.stw, 6);
  }
  drawRank() {
    clear(this.rankBox);
    this.rankList.forEach((k, i) => {
      this.rankBox.append(h('div', { class: 'row', style: { justifyContent: 'space-between', margin: '3px 0', padding: '4px 8px', background: 'rgba(255,255,255,.04)', borderRadius: '8px' } },
        h('span', null, `${i + 1}. ${NAMES[k]}`),
        h('span', { class: 'row', style: { gap: '4px' } }, h('button', { class: 'btn tiny', onClick: () => { if (i > 0) { [this.rankList[i - 1], this.rankList[i]] = [this.rankList[i], this.rankList[i - 1]]; this.drawRank(); } } }, '▲'), h('button', { class: 'btn tiny', onClick: () => { if (i < this.rankList.length - 1) { [this.rankList[i + 1], this.rankList[i]] = [this.rankList[i], this.rankList[i + 1]]; this.drawRank(); } } }, '▼'))));
    });
  }
  checkRank() {
    const wrong = this.rankList.filter((k, i) => RANK[i] !== k).length;
    if (wrong === 0) { audio.success(); this.stw.done(4); this.ui.note(`Correct! **${RANK.map((k) => k).join(' > ')}**. The full series: ${ORDER.join(' > ')} (C and H included for comparison).`, 'gold'); this.checkTab('water', this.stw, 6); }
    else { audio.fail(); this.ui.note(`${wrong} metal${wrong > 1 ? 's are' : ' is'} out of place. Use your observations: Group I in water, then the acid results.`, 'warn'); }
  }
  simWater(dt, t) {
    this.tr.update(dt); this.trough.update(dt);
    const a = this.wt.active;
    if (a) {
      const d = G1[a.k]; a.t += dt;
      a.vx += (Math.random() - 0.5) * d.speed * dt * 4; a.vz += (Math.random() - 0.5) * d.speed * dt * 4;
      a.x += a.vx * dt; a.z += a.vz * dt;
      const R = 0.1; if (Math.hypot(a.x, a.z) > R) { a.vx *= -1; a.vz *= -1; const k = R / Math.hypot(a.x, a.z); a.x *= k; a.z *= k; }
      this.piece.position.set(a.x, this.trough.surfaceY() + 0.003, a.z);
      const left = 1 - a.t / d.life; this.piece.scale.setScalar(Math.max(0.05, left));
      if (d.flame) { this.flame.scale.set(1, 0.8 + Math.sin(t * 30) * 0.2, 1); if (Math.random() < dt * 3) this.sparks.fire(); }
      this.pfizz.update(dt); this.sparks.update(dt); this.steamP.update(dt);
      this.trough.setColor(new THREE.Color('#86efac').lerp(new THREE.Color('#7e22ce'), clamp(0.3 * this.wt.dropped.size + 0.3 * (a.t / d.life), 0, 1)).getStyle());
      if (a.t >= d.life) {
        this.wt.active = null; this.piece.visible = false; this.pfizz.setRate(0); this.steamP.setRate(0); this.wt.dropped.add(a.k);
        if (this.wt.dropped.size === 3 && !this.stw.isDone(0)) {
          this.stw.done(0); this.stw.done(1);
          this.ui.note('The universal indicator turned **purple**: each metal made an **alkaline hydroxide** (e.g. NaOH) plus hydrogen gas — that is why Group I are called the **alkali metals**.', 'gold');
          this.checkTab('water', this.stw, 6);
        }
      }
    }
  }

  // ======================================================== displacement
  tab_displacement() {
    const Y = this.Y;
    this.dp = { done: new Set(), ranked: false };
    const tile = spottingTile(4, 4); tile.scale.setScalar(1.7); this.lab.add(tile, 0, Y, 0.0);
    this.wells = [];
    DISP_M.forEach((m, r) => DISP_M.forEach((sname, c) => {
      const w = tile.wells[r * 4 + c];
      w.material = w.material.clone(); w.material.color.set(SALT[sname][1]);
      const lumpM = mat(ACIDM[m].col, 0.7, 0.35); lumpM.emissive = new THREE.Color(0, 0, 0);
      const lump = mesh(new THREE.BoxGeometry(0.009, 0.0025, 0.006), lumpM, 0, 0.0035, 0); lump.visible = false; w.add(lump);
      const cell = { m, s: sname, w, lump, r, c, tested: false };
      this.wells.push(cell);
      this.lab.interactive(w, { tip: `${NAMES[m]} + ${SALT[sname][0]} — click to add the metal`, onClick: () => this.testWell(cell) });
    }));
    DISP_M.forEach((m, i) => { const anchor = new THREE.Object3D(); anchor.position.set(-0.115, 0.012, -0.0525 + i * 0.035); tile.add(anchor); this.lab.label(anchor, NAMES[m], { y: 0, cls: 'dimlab' }); });
    DISP_M.forEach((m, i) => { const anchor = new THREE.Object3D(); anchor.position.set(-0.0525 + i * 0.035, 0.012, -0.1); tile.add(anchor); this.lab.label(anchor, SALT[m][0].replace(' sulfate', '').replace('(II)', '') + ' salt', { y: 0, cls: 'dimlab' }); });
    const ui = this.ui;
    this.std = ui.steps(['Add each metal to each **salt solution** (12 different pairs)', 'Use the number of reactions to **rank the four metals**', '(S) Write the **ionic equation** and spot oxidation and reduction', 'Answer the analysis questions']);
    const sec = ui.section('Spotting tile');
    ui.text('Rows = metal added. Columns = salt solution. Click a well to drop in the metal. Skip the diagonal — a metal in its own salt shows nothing.', sec);
    ui.buttons([{ label: '⚡ Fill every well', onClick: () => this.wells.forEach((c) => c.m !== c.s && this.testWell(c, true)) }], sec);
    this.grid = h('table', { class: 'dtable' }); sec.append(h('div', { class: 'table-wrap' }, this.grid)); this.drawGrid();
    const rs = ui.section('Ranking from your results');
    this.rankSeg = ui.seg({ label: 'Most reactive of the four', options: DISP_M.map((m) => [m, NAMES[m]]), value: null, parent: rs, onChange: (v) => this.checkDispRank(v) });
    const eq = ui.section('(S) Ionic equation');
    ui.questions([
      { q: 'Zinc in copper(II) sulfate. Which is the **ionic equation**?', opts: ['Zn + Cu²⁺ → Zn²⁺ + Cu', 'Zn²⁺ + Cu → Zn + Cu²⁺', 'Zn + SO₄²⁻ → ZnSO₄', 'Cu²⁺ + 2e⁻ → Cu only'], e: 'Sulfate ions are spectators.', o: [4], sub: 'C9.4' },
      { q: 'In Zn + Cu²⁺ → Zn²⁺ + Cu, which species is **oxidised**?', opts: ['Zinc — it loses electrons', 'Copper(II) ions — they lose electrons', 'Sulfate ions', 'Nothing — it is not redox'], e: 'OIL RIG: Zn loses 2e⁻ (oxidised); Cu²⁺ gains 2e⁻ (reduced).', o: [5], sub: 'C6.3' },
    ], { sub: 'C9.4', title: 'Equation', parent: eq, onDone: () => { this.std.done(2); this.checkTab('displacement', this.std, 4); } });
    ui.notes();
    ui.questions([
      { q: 'A more reactive metal displaces a less reactive one from its salt because it…', opts: ['has a greater tendency to form positive ions', 'is heavier', 'is a better conductor', 'has more protons'], e: 'Reactivity = tendency to lose electrons and form cations.', o: [4], sub: 'C9.4' },
      { q: 'Railway lines are welded with the **thermite** reaction: aluminium + iron(III) oxide. Why does it work?', opts: ['Aluminium is more reactive than iron, so it takes the oxygen', 'Iron is more reactive than aluminium', 'Iron oxide is a catalyst', 'The reaction is endothermic'], e: 'Displacement also works with metal oxides — and releases a lot of heat.', o: [3, 4], sub: 'C9.4' },
      { q: 'Which pair gives **no** reaction?', opts: ['Copper + zinc sulfate', 'Magnesium + copper(II) sulfate', 'Zinc + iron(II) sulfate', 'Iron + copper(II) sulfate'], e: 'Copper is less reactive than zinc, so it cannot displace it.', o: [3], sub: 'C9.4' },
    ], { sub: 'C9.4', onDone: () => { this.std.done(3); this.checkTab('displacement', this.std, 4); } });
  }
  testWell(cell, silent = false) {
    if (cell.tested) return;
    if (cell.m === cell.s) { if (!silent) this.ui.hint('That is the metal in its own salt — no change. Try another well.', 2500); return; }
    cell.tested = true; cell.lump.visible = true;
    const react = RANK.indexOf(cell.m) < RANK.indexOf(cell.s);
    if (react) {
      tweens.tween(1.6, (e) => { cell.lump.material.color.set(ACIDM[cell.m].col).lerp(new THREE.Color(COAT[cell.s]), e); cell.w.material.color.set(SALT[cell.s][1]).lerp(new THREE.Color(SALT[cell.m][1]), e); });
      if (!silent) { audio.fizz(0.2); this.ui.note(`${NAMES[cell.m]} + ${SALT[cell.s][0].toLowerCase()}: a **${cell.s === 'Cu' ? 'brown copper' : 'dark metal'} coating** forms${cell.s === 'Cu' ? ' and the blue colour fades' : ''} — ${NAMES[cell.m].toLowerCase()} is **more reactive**.`); }
    } else if (!silent) this.ui.note(`${NAMES[cell.m]} + ${SALT[cell.s][0].toLowerCase()}: **no change** — ${NAMES[cell.m].toLowerCase()} is less reactive than ${NAMES[cell.s].toLowerCase()}.`);
    cell.react = react; this.dp.done.add(`${cell.m}${cell.s}`);
    this.drawGrid();
    if (this.dp.done.size === 12 && !this.std.isDone(0)) { this.std.done(0); this.ui.note('All 12 pairs tested. Count the ✓ in each row: the metal with the most reactions is the most reactive.', 'gold'); this.checkTab('displacement', this.std, 4); }
  }
  drawGrid() {
    clear(this.grid);
    this.grid.append(h('thead', null, h('tr', null, h('th', null, 'Metal ↓ / salt →'), ...DISP_M.map((m) => h('th', null, m)), h('th', null, '✓'))));
    const tb = h('tbody');
    for (const m of DISP_M) {
      const cells = this.wells.filter((c) => c.m === m);
      tb.append(h('tr', null, h('td', null, NAMES[m]), ...cells.map((c) => h('td', null, c.m === c.s ? '—' : c.tested ? (c.react ? '✓' : '✗') : '·')), h('td', null, String(cells.filter((c) => c.tested && c.react).length))));
    }
    this.grid.append(tb);
  }
  checkDispRank(v) {
    if (this.dp.done.size < 12) { this.ui.hint('Test all 12 pairs before ranking.', 2500); this.rankSeg.set(null); return; }
    if (v === 'Mg') { audio.success(); this.std.done(1); this.ui.note('Correct: **Mg > Zn > Fe > Cu** — magnesium displaced all three others; copper displaced none.', 'gold'); this.checkTab('displacement', this.std, 4); }
    else { audio.fail(); this.ui.note('Look at the ✓ count in each row of your results table.', 'warn'); }
  }

  // ======================================================== halogens
  tab_halogens() {
    const Y = this.Y;
    this.hg = { seen: new Set(), done: new Set() };
    const jar = (x, name, build) => { const g = new THREE.Group(); this.lab.add(g, x, Y, -0.16); g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 20, 1, true), glassMaterial('#e6f4ff', 0.08, 0.6), 0, 0.06, 0), mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.01, 20), M.dark, 0, 0.125, 0)); build(g); this.lab.label(g, name, { y: 0.17 }); return g; };
    const gasM = new THREE.MeshBasicMaterial({ color: '#d9f99d', transparent: true, opacity: 0.28, depthWrite: false });
    const j1 = jar(-0.2, 'Chlorine', (g) => g.add(mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.115, 20), gasM, 0, 0.06, 0)));
    const j2 = jar(-0.08, 'Bromine', (g) => { g.add(mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.025, 20), mat('#7f1d1d', 0, 0.2), 0, 0.014, 0)); g.add(mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.09, 20), new THREE.MeshBasicMaterial({ color: '#c2410c', transparent: true, opacity: 0.35, depthWrite: false }), 0, 0.07, 0)); });
    const j3 = jar(0.04, 'Iodine', (g) => { for (let i = 0; i < 9; i++) { const c = mesh(new THREE.OctahedronGeometry(0.006), mat('#1e1b2e', 0.7, 0.25), (Math.random() - 0.5) * 0.04, 0.006, (Math.random() - 0.5) * 0.04); c.rotation.set(i, i * 2, 0); g.add(c); } g.add(mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.09, 20), new THREE.MeshBasicMaterial({ color: '#7e22ce', transparent: true, opacity: 0.12, depthWrite: false }), 0, 0.06, 0)); });
    const info = { Cl: [j1, 'Chlorine: a **pale yellow-green gas** at room temperature. Cl₂ molecules are diatomic.'], Br: [j2, 'Bromine: a **red-brown liquid** that gives off orange-brown vapour.'], I: [j3, 'Iodine: a **grey-black solid** that gives a purple vapour when warmed.'] };
    for (const [k, [g, text]] of Object.entries(info)) this.lab.interactive(g, { tip: `${HAL[k].name.split(' ')[0]} — click to inspect`, onClick: () => { this.hg.seen.add(k); this.ui.note(text); if (this.hg.seen.size === 3) { this.stH.done(0); this.ui.note('Down Group VII the colour gets **darker** and the state changes gas → liquid → solid (melting and boiling points rise).', 'gold'); this.checkTab('halogens', this.stH, 4); } } });
    this.tr = new TubeRack(this, { n: 6, x: 0.02, z: 0.08, spacing: 0.055, label: 'Halide solutions + halogen' });
    this.combos = [['Cl', 'Br'], ['Cl', 'I'], ['Br', 'Cl'], ['Br', 'I'], ['I', 'Cl'], ['I', 'Br']];
    this.tr.tubes.forEach((t, i) => { const [, ion] = this.combos[i]; this.tr.fill(t, '#f8fafc', 0.35, 0.4); t.content = { ion, hal: null }; this.lab.label(t.holder, HAL[ion].ion, { y: -0.006, cls: 'dimlab' }); });
    const ui = this.ui;
    this.stH = ui.steps(['Inspect **chlorine, bromine and iodine** (click the jars)', 'Add each halogen to the **two other** halide solutions (6 tubes)', 'Deduce the **order of reactivity**', 'Answer the analysis questions']);
    const sec = ui.section('Halogen solutions');
    ui.text('Select a tube (its label shows the potassium halide inside), then add a halogen solution.', sec);
    ui.buttons(HORDER.map((k) => ({ label: `+ ${HAL[k].name}`, onClick: () => this.addHalogen(k) })), sec);
    ui.buttons([{ label: '⚡ Auto-fill all six tubes', onClick: () => this.tr.tubes.forEach((t, i) => { this.tr.select(i, true); this.addHalogen(this.combos[i][0], true); }) }], sec);
    this.htab = ui.table(['Halogen added', 'Halide', 'Result'], sec);
    const rs = ui.section('Reactivity');
    this.hSeg = ui.seg({ label: 'Most reactive halogen', options: HORDER.map((k) => [k, HAL[k].name.split(' ')[0]]), value: null, parent: rs, onChange: (v) => this.checkHalRank(v) });
    const trend = ui.section('Group VII trends');
    ui.table(['', 'Chlorine', 'Bromine', 'Iodine'], trend).add(['State (r.t.p.)', 'gas', 'liquid', 'solid']);
    trend.querySelector('tbody').append(h('tr', null, h('td', null, 'Colour'), h('td', null, 'pale yellow-green'), h('td', null, 'red-brown'), h('td', null, 'grey-black')), h('tr', null, h('td', null, 'Density'), h('td', { colspan: 3 }, 'increases down the group →')), h('tr', null, h('td', null, 'Reactivity'), h('td', { colspan: 3 }, '← decreases down the group')));
    ui.notes();
    ui.questions([
      { q: 'Chlorine water added to potassium bromide turns **orange**. Why?', opts: ['Chlorine is more reactive and displaces bromine: Cl₂ + 2KBr → 2KCl + Br₂', 'Bromine displaces chlorine', 'Potassium bromide is orange', 'Chlorine reacts with the water only'], e: 'A more reactive halogen displaces a less reactive one from its halide.', o: [3], sub: 'C8.3' },
      { q: 'Predict the state and colour of **astatine**, below iodine.', opts: ['A dark (black) solid', 'A pale green gas', 'A colourless liquid', 'A red-brown gas'], e: 'Colour darkens and melting point rises down the group.', o: [4], sub: 'C8.3' },
      { q: 'In Cl₂ + 2I⁻ → 2Cl⁻ + I₂, chlorine is…', opts: ['reduced — it gains electrons', 'oxidised — it loses electrons', 'a spectator', 'a catalyst'], e: 'Chlorine atoms gain electrons to become chloride ions.', o: [6], sub: 'C6.3' },
      { q: 'Why is chlorine added to drinking water?', opts: ['To kill bacteria (pathogens)', 'To remove salt', 'To make it taste better', 'To make it alkaline'], e: 'Chlorination is the final step of water treatment.', o: [4], sub: 'C10.1' },
    ], { sub: 'C8.3', onDone: () => { this.stH.done(3); this.checkTab('halogens', this.stH, 4); } });
    this.every((dt) => this.tr.update(dt));
  }
  addHalogen(k, silent = false) {
    const t = this.tr.current; const c = t.content;
    if (!c || c.hal) { if (!silent) this.ui.hint('This tube already has a halogen — pick another tube.', 2400); return; }
    if (k === c.ion) { if (!silent) this.ui.hint('Add a **different** halogen from the halide in the tube.', 2400); return; }
    c.hal = k; audio.pour();
    const react = HORDER.indexOf(k) < HORDER.indexOf(c.ion);
    const prod = { Br: ['#f97316', 'orange (bromine formed)'], I: ['#78350f', 'brown (iodine formed)'], Cl: ['#ecfccb', 'pale green'] };
    const col = react ? prod[c.ion][0] : HAL[k].col;
    this.tr.fill(t, col, 0.55, react ? 0.85 : 0.6, 1.2);
    const res = react ? `**Displacement!** Turns ${prod[c.ion][1]}` : 'No reaction — just the colour of the halogen added';
    this.htab.add([HAL[k].name, HAL[c.ion].ion, res.replace(/\*\*/g, '')]);
    if (!silent) this.ui.note(`${HAL[k].name} + ${HAL[c.ion].ionName.toLowerCase()}: ${res}.`, react ? 'gold' : '');
    this.hg.done.add(`${k}${c.ion}`);
    if (this.hg.done.size === 6 && !this.stH.isDone(1)) { this.stH.done(1); this.ui.note('Chlorine displaced both bromine and iodine; bromine displaced only iodine; iodine displaced neither.', 'gold'); }
    this.checkTab('halogens', this.stH, 4);
  }
  checkHalRank(v) {
    if (this.hg.done.size < 6) { this.ui.hint('Complete all six tubes first.', 2500); this.hSeg.set(null); return; }
    if (v === 'Cl') { audio.success(); this.stH.done(2); this.ui.note('Correct: **chlorine > bromine > iodine** — reactivity decreases down Group VII.', 'gold'); this.checkTab('halogens', this.stH, 4); }
    else { audio.fail(); this.ui.note('Which halogen displaced the most others?', 'warn'); }
  }

  checkTab(id, st, n) { if (Array.from({ length: n }, (_, i) => i).every((i) => st.isDone(i))) this.lab.goal(id); }
}
void testTube;
