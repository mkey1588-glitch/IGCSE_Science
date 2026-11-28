import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { boilingTube, rack, mesh, mat, M } from '../apparatus.js';
import { h, clear, clamp } from '../../core/util.js';
import { audio } from '../../core/audio.js';

// rate = relative rusting rate over one week; 0 = protected
const TUBES = [
  { id: 'ctrl', name: 'Air + tap water', short: 'Control', water: '#dbeafe', level: 0.45, rate: 1, why: 'Iron in contact with **both water and oxygen** rusts.' },
  { id: 'dry', name: 'Dry air (calcium chloride)', short: 'Dry air', water: null, drier: true, bung: true, rate: 0, why: 'Anhydrous calcium chloride removes water vapour — **no water, no rust**.' },
  { id: 'boiled', name: 'Boiled water + oil layer', short: 'No air', water: '#e0f2fe', level: 0.6, oil: true, bung: true, rate: 0, why: 'Boiling removes dissolved air; the oil stops oxygen dissolving again — **no oxygen, no rust**.' },
  { id: 'salt', name: 'Salt water + air', short: 'Salt water', water: '#f1f5f9', level: 0.45, rate: 1.7, why: 'Dissolved salt speeds up rusting — that is why the harbour crane and cars near the sea rust fast.' },
  { id: 'paint', name: 'Painted nail in water', short: 'Painted', water: '#dbeafe', level: 0.45, coat: '#dc2626', rate: 0, why: 'Paint is a **barrier** that keeps out oxygen and water.' },
  { id: 'grease', name: 'Greased nail in water', short: 'Greased', water: '#dbeafe', level: 0.45, coat: '#3f3f46', shiny: true, rate: 0, why: 'Grease (or oil) is a **barrier** — used on bike chains and machinery.' },
  { id: 'galv', name: 'Galvanised (zinc-coated) nail, scratched', short: 'Galvanised', water: '#dbeafe', level: 0.45, coat: '#a1a1aa', rate: 0, sacrificial: 'zinc', why: '(S) Zinc is a barrier — and even where scratched it corrodes **instead of** the iron: **sacrificial protection**.' },
  { id: 'mg', name: 'Nail wrapped in magnesium ribbon', short: 'Mg-wrapped', water: '#dbeafe', level: 0.45, wrap: '#d4d4d8', rate: 0, sacrificial: 'magnesium', why: '(S) Magnesium is more reactive than iron, so it **loses electrons first** and corrodes away instead — used on ship hulls.' },
  { id: 'cu', name: 'Nail wrapped in copper wire', short: 'Cu-wrapped', water: '#dbeafe', level: 0.45, wrap: '#c8743c', rate: 1.45, why: 'Copper is **less reactive** than iron, so the iron corrodes even faster — never fix steel with copper nails!' },
];
const STEEL = new THREE.Color('#9ca3af'), RUST = new THREE.Color('#9a3412');

function nail(coat) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: coat || '#9ca3af', metalness: coat ? 0.25 : 0.85, roughness: coat ? 0.5 : 0.35 });
  g.add(mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.09, 10), m, 0, 0.05, 0), mesh(new THREE.ConeGeometry(0.0022, 0.008, 10), m, 0, 0.001, 0).rotateX(Math.PI), mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.0025, 14), m, 0, 0.096, 0));
  g.userData.mat = m;
  return g;
}

export default class Rusting extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'The harbour crane is crumbling into orange flakes. Before Kofi repaints it, find out exactly what iron needs to rust — and how to stop it.';
    this.view = { pos: [0, 1.38, 0.9], target: [0, 1.0, 0] };
    this.day = 0; this.running = false; this.pred = {}; this.revealed = false;
  }
  build() {
    const Y = this.Y, n = TUBES.length, sp = 0.062;
    const rk = rack(n, sp); this.lab.add(rk, 0, Y, 0);
    this.tubes = TUBES.map((d, i) => {
      const v = boilingTube({ level: d.water ? d.level : 0, color: d.water || '#ffffff', opacity: 0.45 });
      const holder = new THREE.Group(); holder.position.copy(rk.slots[i]); holder.add(v); rk.add(holder);
      const nl = nail(d.coat); nl.position.set(0.002, 0.006, 0); nl.rotation.z = 0.08; v.add(nl);
      if (d.shiny) { nl.userData.mat.metalness = 0.6; nl.userData.mat.roughness = 0.12; }
      if (d.oil) v.add(mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.008, 16), new THREE.MeshStandardMaterial({ color: '#facc15', transparent: true, opacity: 0.8 }), 0, v.surfaceY() + 0.004, 0));
      if (d.drier) for (let k = 0; k < 6; k++) v.add(mesh(new THREE.DodecahedronGeometry(0.004), mat('#f8fafc', 0, 0.9), (Math.random() - 0.5) * 0.016, 0.006 + Math.random() * 0.01, (Math.random() - 0.5) * 0.012));
      if (d.bung) v.add(mesh(new THREE.CylinderGeometry(0.019, 0.016, 0.022, 14), M.rubber, 0, 0.165, 0));
      if (d.wrap) { const coil = mesh(new THREE.TorusGeometry(0.0034, 0.0011, 6, 16), mat(d.wrap, 0.8, 0.3)); for (let k = 0; k < 5; k++) { const c = coil.clone(); c.position.set(0.002, 0.03 + k * 0.007, 0); c.rotation.x = Math.PI / 2; nl.add(c); } }
      if (d.id === 'galv') nl.add(mesh(new THREE.BoxGeometry(0.0046, 0.012, 0.0004), mat('#9ca3af', 0.9, 0.3), 0, 0.05, 0.0023));
      const flakes = new THREE.Group(); nl.add(flakes);
      const lbl = this.lab.label(holder, d.short, { y: 0.21, cls: 'dimlab' });
      this.lab.interactive(v, { tip: `${d.name} — click to predict rust / no rust`, onClick: () => this.togglePred(d.id) });
      return { d, v, nl, flakes, lbl, rust: 0 };
    });
    this.lab.label(rk, 'Iron nails · one week', { y: 0.27 });
    const ui = this.ui;
    this.st = ui.steps(['**Predict** which nails will rust (click a tube or use the table)', '**Fast-forward** one week', 'Compare: what does iron need in order to rust?', { t: '(S) Explain **sacrificial protection**', o: ['C9.5.4', 'C9.5.5'], q: true }, 'Answer the analysis questions']);
    const sec = ui.section('Predictions');
    this.predBox = h('div'); sec.append(this.predBox); this.drawPred();
    ui.buttons([{ label: '⏩ Fast-forward one week', kind: 'primary', onClick: () => this.go() }, { label: '⟲ Fresh nails', onClick: () => this.reset() }], sec);
    this.ro = ui.readouts([{ id: 'd', label: 'Day', value: '0' }, { id: 'p', label: 'Predictions right' }], sec);
    this.resSec = ui.section('Results');
    this.res = ui.table(['Tube', 'Rusted?', 'Mass gain / g', 'Why'], this.resSec);
    const ss = ui.section('(S) Sacrificial protection');
    ui.questions([
      { q: 'Why does the **magnesium-wrapped** nail stay shiny while the magnesium corrodes?', opts: ['Magnesium is more reactive, so it loses electrons (is oxidised) instead of the iron', 'Magnesium is a barrier that keeps out water', 'Magnesium reacts with the rust and removes it', 'Magnesium is less reactive than iron'], e: 'Mg → Mg²⁺ + 2e⁻ happens in preference to Fe → Fe²⁺ + 2e⁻.', o: [5], sub: 'C9.5' },
      { q: 'A galvanised bucket is scratched through to the iron. Why does it still not rust?', opts: ['The zinc corrodes sacrificially instead of the exposed iron', 'Zinc paint fills the scratch', 'Iron is more reactive than zinc', 'Water cannot reach iron'], e: 'Galvanising gives a barrier **and** sacrificial protection.', o: [4], sub: 'C9.5' },
    ], { sub: 'C9.5', title: 'Explain', parent: ss, onDone: () => { this.st.done(3); this.check(); } });
    ui.notes();
    ui.questions([
      { q: 'Which pair of tubes shows that rusting needs **water**?', opts: ['Control (air + water) and dry air', 'Control and salt water', 'Painted and greased', 'Galvanised and magnesium-wrapped'], e: 'Only the water differs between them — a fair comparison.', o: [1], sub: 'C9.5' },
      { q: 'Why was the water boiled and covered with oil in one tube?', opts: ['To remove dissolved oxygen and stop more dissolving', 'To kill bacteria', 'To make the water warmer', 'To add oxygen'], e: 'This tube tests whether oxygen is needed.', o: [1], sub: 'C9.5' },
      { q: 'Painting, greasing and plastic coating all prevent rusting because they…', opts: ['form a barrier that keeps out oxygen and water', 'are more reactive than iron', 'react with the rust', 'make the iron an alloy'], e: 'Barrier methods exclude both reactants.', o: [2, 3], sub: 'C9.5' },
      { q: 'iron + oxygen + water → hydrated iron(III) oxide. Iron is…', opts: ['oxidised — it gains oxygen', 'reduced — it loses oxygen', 'neither oxidised nor reduced', 'a catalyst'], e: 'Rusting is an oxidation (and the nails get heavier).', o: [2, 3], sub: 'C6.3' },
    ], { sub: 'C9.5', onDone: () => { this.st.done(4); this.check(); } });
    this.every((dt) => this.sim(dt));
    this.ui.hint('Predict first: click a tube (or the table) to mark it ✔ will rust / ✖ won’t rust.', 6000);
  }
  togglePred(id) {
    if (this.revealed) return;
    this.pred[id] = this.pred[id] === 'rust' ? 'no' : 'rust'; audio.click(); this.drawPred();
  }
  drawPred() {
    clear(this.predBox);
    const tb = h('tbody');
    for (const t of TUBES) {
      const p = this.pred[t.id];
      const ok = this.revealed ? (p === (t.rate > 0 ? 'rust' : 'no')) : null;
      tb.append(h('tr', null, h('td', { style: { fontSize: '.86em' } }, t.name),
        h('td', null, h('div', { class: 'row', style: { gap: '4px' } }, ...['rust', 'no'].map((k) => h('button', { class: `btn tiny ${p === k ? (ok === false ? 'danger' : 'good') : ''}`, onClick: () => { if (this.revealed) return; this.pred[t.id] = k; audio.click(); this.drawPred(); } }, k === 'rust' ? '✔ rusts' : '✖ no rust')))),
        h('td', null, this.revealed ? (ok ? '✅' : '❌') : '')));
    }
    this.predBox.append(h('div', { class: 'table-wrap', style: { maxHeight: '250px' } }, h('table', { class: 'dtable' }, tb)));
    if (!this.st) return;
    if (TUBES.every((t) => this.pred[t.id]) && !this.st.isDone(0)) { this.st.done(0); this.ui.note('Predictions locked in — now fast-forward a week.'); }
  }
  go() {
    if (this.running || this.revealed) return;
    if (!TUBES.every((t) => this.pred[t.id])) { this.ui.hint('Make a prediction for every tube first.', 2600); return; }
    this.running = true; audio.whoosh?.();
  }
  reset() {
    this.day = 0; this.running = false; this.revealed = false; this.pred = {};
    for (const t of this.tubes) { t.rust = 0; while (t.flakes.children.length) t.flakes.remove(t.flakes.children[0]); t.nl.userData.mat.color.set(t.d.coat || '#9ca3af'); t.v.setColor(t.d.water || '#ffffff'); }
    this.res.clear(); this.drawPred(); this.ro.set('d', '0'); this.ro.set('p', '—');
  }
  sim(dt) {
    for (const t of this.tubes) t.v.update(dt);
    if (!this.running) return;
    this.day = Math.min(7, this.day + dt * 1.2);
    this.ro.set('d', this.day.toFixed(1));
    for (const t of this.tubes) {
      const r = t.d.rate * this.day / 7;
      t.rust = r;
      if (t.d.rate > 0) {
        t.nl.userData.mat.color.copy(STEEL).lerp(RUST, clamp(r, 0, 1)); t.nl.userData.mat.roughness = 0.35 + 0.55 * clamp(r, 0, 1); t.nl.userData.mat.metalness = 0.85 - 0.75 * clamp(r, 0, 1);
        if (t.flakes.children.length < Math.floor(r * 14)) { const f = mesh(new THREE.BoxGeometry(0.003, 0.004, 0.0012), mat('#b45309', 0, 0.95)); const a = Math.random() * 6.28; f.position.set(Math.cos(a) * 0.0024, 0.01 + Math.random() * 0.08, Math.sin(a) * 0.0024); f.rotation.set(Math.random(), a, Math.random()); t.flakes.add(f); }
        if (t.d.water) t.v.liqMat.color.lerp(new THREE.Color('#c2410c'), dt * 0.05 * t.d.rate);
      }
      if (t.d.id === 'mg') t.nl.children.filter((c) => c.geometry?.type === 'TorusGeometry').forEach((c) => { c.material.color.set('#d4d4d8').lerp(new THREE.Color('#f8fafc'), this.day / 7); c.scale.setScalar(1 - 0.25 * this.day / 7); });
    }
    if (this.day >= 7) this.reveal();
  }
  reveal() {
    this.running = false; this.revealed = true; audio.discover();
    let right = 0;
    for (const t of this.tubes) {
      const rusted = t.d.rate > 0; if (this.pred[t.d.id] === (rusted ? 'rust' : 'no')) right++;
      this.res.add([t.d.short, rusted ? `<b style="color:#fb923c">Yes${t.d.rate > 1.2 ? ' — badly' : ''}</b>` : 'No', rusted ? `+${(0.04 * t.d.rate).toFixed(3)}` : (t.d.sacrificial ? `0.000 (${t.d.sacrificial} corroded)` : '0.000'), `<span style="font-size:.85em">${t.d.why.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</span>`]);
    }
    this.ro.set('p', `${right} / ${TUBES.length}`);
    this.drawPred();
    this.st.done(1);
    this.ui.note('Rusting needs **both oxygen and water**. Salt water and contact with a less reactive metal (copper) speed it up; barriers and more reactive metals protect the iron.', 'gold');
    this.st.done(2);
    this.check();
  }
  check() { this.st.check(); }
}
