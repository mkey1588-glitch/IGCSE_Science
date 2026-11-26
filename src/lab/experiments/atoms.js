import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { mesh, mat } from '../apparatus.js';
import { h, clear, TAU } from '../../core/util.js';
import { audio } from '../../core/audio.js';

// [symbol, name, group (1-8), period, stable mass numbers, radioactive mass numbers]
const EL = [null,
  ['H', 'Hydrogen', 1, 1, [1, 2], [3]], ['He', 'Helium', 8, 1, [3, 4], []], ['Li', 'Lithium', 1, 2, [6, 7], []], ['Be', 'Beryllium', 2, 2, [9], [10]],
  ['B', 'Boron', 3, 2, [10, 11], []], ['C', 'Carbon', 4, 2, [12, 13], [14]], ['N', 'Nitrogen', 5, 2, [14, 15], []], ['O', 'Oxygen', 6, 2, [16, 17, 18], []],
  ['F', 'Fluorine', 7, 2, [19], []], ['Ne', 'Neon', 8, 2, [20, 21, 22], []], ['Na', 'Sodium', 1, 3, [23], [22, 24]], ['Mg', 'Magnesium', 2, 3, [24, 25, 26], []],
  ['Al', 'Aluminium', 3, 3, [27], []], ['Si', 'Silicon', 4, 3, [28, 29, 30], []], ['P', 'Phosphorus', 5, 3, [31], [32]], ['S', 'Sulfur', 6, 3, [32, 33, 34], []],
  ['Cl', 'Chlorine', 7, 3, [35, 37], [36]], ['Ar', 'Argon', 8, 3, [36, 38, 40], []], ['K', 'Potassium', 1, 4, [39, 41], [40]], ['Ca', 'Calcium', 2, 4, [40, 42, 44], []],
];
const config = (e) => { const out = []; const caps = [2, 8, 8, 2]; let r = e; for (const c of caps) { if (r <= 0) break; out.push(Math.min(c, r)); r -= c; } return out; };
const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻' };
const SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
const sup = (s) => String(s).split('').map((c) => SUP[c] || c).join('');
const sub = (s) => String(s).split('').map((c) => SUB[c] || c).join('');

export default class Atoms extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Prof. Okafor’s festival exhibit: everything on Brightwater is built from protons, neutrons and electrons. Build atoms, isotopes and ions.';
    this.view = { pos: [0, 1.32, 0.95], target: [0, 1.17, 0] };
    this.p = 1; this.n = 0; this.e = 1;
  }
  build() {
    const Y = this.Y;
    const base = mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.03, 32), mat('#1e293b', 0.6, 0.3)); this.lab.add(base, 0, Y, 0);
    const glow = mesh(new THREE.TorusGeometry(0.12, 0.004, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.4, 2.2) })); glow.rotation.x = Math.PI / 2; this.lab.add(glow, 0, Y + 0.031, 0);
    this.atom = new THREE.Group(); this.lab.add(this.atom, 0, Y + 0.27, 0);
    this.nuc = new THREE.Group(); this.atom.add(this.nuc);
    this.shellG = new THREE.Group(); this.atom.add(this.shellG);
    this.pM = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.35, emissive: '#7f1d1d', emissiveIntensity: 0.35 });
    this.nM = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.35, emissive: '#334155', emissiveIntensity: 0.3 });
    this.eM = new THREE.MeshStandardMaterial({ color: '#60a5fa', emissive: '#2563eb', emissiveIntensity: 1.2 });
    this.symLabel = this.lab.label(this.atom, '', { y: 0.24, cls: 'big' });
    const ui = this.ui;
    this.st = ui.steps(['Build a **carbon-12** atom', 'Make an **isotope**: carbon-14', 'Make a **sodium ion, Na⁺**', 'Make a **chloride ion, Cl⁻**', 'Build an atom of a **noble gas**', 'Answer the analysis questions']);
    const sec = ui.section('Build');
    const row = (label, key, max) => ui.buttons([{ label: `− ${label}`, onClick: () => this.change(key, -1) }, { label: `+ ${label}`, kind: 'primary', onClick: () => this.change(key, 1) }], sec);
    row('proton', 'p', 20); row('neutron', 'n', 26); row('electron', 'e', 22);
    ui.buttons([{ label: '⚡ Make neutral', onClick: () => { this.e = this.p; this.render(); } }, { label: '⟲ Hydrogen', onClick: () => { this.p = 1; this.n = 0; this.e = 1; this.render(); } }], sec);
    this.ro = ui.readouts([{ id: 'el', label: 'Element' }, { id: 'z', label: 'Proton number Z' }, { id: 'a', label: 'Mass number A' }, { id: 'q', label: 'Charge' }, { id: 'cfg', label: 'Configuration' }, { id: 'not', label: 'Symbol' }, { id: 'gp', label: 'Group / period' }, { id: 'iso', label: 'Nucleus' }], sec);
    this.pt = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '3px', margin: '6px 0' } }); ui.section('Periodic Table (elements 1–20)').append(this.pt);
    ui.notes();
    ui.questions([
      { q: 'How many **neutrons** are in an atom of chlorine-37 (Z = 17)?', ans: 20, tol: 0, abs: 0.1, e: 'Neutrons = A − Z = 37 − 17 = 20.', o: [3, 4], sub: 'C2.2' },
      { q: 'What is the electronic configuration of **magnesium** (Z = 12)?', opts: ['2,8,2', '2,10', '2,8,1,1', '8,2,2'], e: 'Shells fill 2, then 8, then the rest.', o: [5], sub: 'C2.2' },
      { q: 'An element in **Group VII** has how many outer-shell electrons?', opts: ['7', '1', '8', '17'], e: 'Group number = number of outer-shell electrons (for Groups I–VII).', o: [6], sub: 'C2.2' },
      { q: 'Carbon-12 and carbon-14 react in the same way because…', opts: ['they have the same number of electrons', 'they have the same mass', 'they have the same number of neutrons', 'they are both radioactive'], e: 'Chemical properties depend on electrons; isotopes differ only in neutrons.', o: [1, 3], sub: 'C2.3' },
      { q: 'Which of these is a **mixture**?', opts: ['Sea water', 'Pure water', 'Sodium chloride', 'Copper'], e: 'Sea water contains water and dissolved salts that are not chemically combined.', o: [1], sub: 'C2.1' },
    ], { sub: 'C2.2', onDone: () => { this.st.done(5); this.check(); } });
    this.render();
  }
  change(k, d) {
    const lim = { p: [1, 20], n: [0, 26], e: [0, 22] }[k];
    const v = this[k] + d; if (v < lim[0] || v > lim[1]) { audio.fail(); return; }
    this[k] = v; audio.blip(); this.render();
  }
  render() {
    const [sym, name, grp, per, stable, radio] = EL[this.p];
    const A = this.p + this.n, q = this.p - this.e;
    const qs = q === 0 ? '' : `${Math.abs(q) > 1 ? Math.abs(q) : ''}${q > 0 ? '+' : '-'}`;
    const cfg = config(this.e);
    // nucleus
    while (this.nuc.children.length) this.nuc.remove(this.nuc.children[0]);
    const N = A, R = 0.011 * Math.cbrt(N);
    const g = new THREE.SphereGeometry(0.0085, 14, 10);
    const order = [];
    for (let i = 0; i < this.p; i++) order.push('p'); for (let i = 0; i < this.n; i++) order.push('n');
    order.sort((a, b) => (Math.sin(a.charCodeAt(0) * 7 + order.length) - 0.5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N, rr = Math.sqrt(1 - y * y), th = i * 2.39996;
      const k = R * Math.cbrt((i + 0.5) / N) * 1.25;
      const m = new THREE.Mesh(g, (i % 2 === 0 ? (order.filter((x) => x === 'p').length > i / 2 ? this.pM : this.nM) : (i / 2 < this.n ? this.nM : this.pM)));
      m.position.set(Math.cos(th) * rr * k, y * k, Math.sin(th) * rr * k); this.nuc.add(m);
    }
    // recolour exactly p protons
    this.nuc.children.forEach((m, i) => { m.material = i < this.p ? this.pM : this.nM; });
    this.nuc.children.sort(() => 0.5 - Math.random());
    // shells
    while (this.shellG.children.length) this.shellG.remove(this.shellG.children[0]);
    this.shells = cfg.map((count, si) => {
      const r = 0.06 + si * 0.042;
      const s = new THREE.Group(); s.rotation.set(0.35 + si * 0.25, si * 0.7, 0.1 * si); this.shellG.add(s);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0012, 6, 64), new THREE.MeshBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.45 })); ring.rotation.x = Math.PI / 2; s.add(ring);
      for (let k = 0; k < count; k++) { const a = (k / count) * TAU; const e = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 10, 8), this.eM); e.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); s.add(e); }
      s.userData.speed = 0.9 / (si + 1);
      return s;
    });
    const note = radio.includes(A) ? 'radioactive isotope' : stable.includes(A) ? 'stable isotope' : 'unstable (not found naturally)';
    this.ro.set('el', `${name} (${sym})`); this.ro.set('z', this.p); this.ro.set('a', A); this.ro.set('q', q === 0 ? '0 (neutral atom)' : `${q > 0 ? '+' : ''}${q} (${q > 0 ? 'cation' : 'anion'})`);
    this.ro.set('cfg', cfg.join(',') || '—'); this.ro.set('not', `${sup(A)}${sub(this.p)}${sym}${sup(qs)}`); this.ro.set('gp', `${grp === 8 ? 'VIII (0)' : ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][grp - 1]} / ${per}`); this.ro.set('iso', note);
    this.symLabel.userData.set(`${sup(A)}${sub(this.p)}${sym}${sup(qs)} — ${name}${q ? (q > 0 ? ' ion' : ' ion') : ''}`);
    // periodic table
    clear(this.pt);
    const cells = Array(32).fill(null);
    for (let z = 1; z <= 20; z++) { const [s2, , g2, p2] = EL[z]; cells[(p2 - 1) * 8 + (g2 - 1)] = [z, s2]; }
    cells.forEach((c) => this.pt.append(h('div', { style: { padding: '4px 0', textAlign: 'center', borderRadius: '6px', fontSize: '.78em', fontWeight: 700, background: c ? (c[0] === this.p ? 'var(--gold)' : 'rgba(255,255,255,.07)') : 'transparent', color: c && c[0] === this.p ? '#2a1600' : '#cbd5e1', cursor: c ? 'pointer' : 'default' }, onClick: c ? () => { this.p = c[0]; this.e = c[0]; this.n = EL[c[0]][4][EL[c[0]][4].length > 1 && c[0] > 1 ? EL[c[0]][4].length - 1 : 0] - c[0]; if (this.n < 0) this.n = 0; audio.click(); this.render(); } : null }, c ? c[1] : '')));
    // challenges
    if (this.p === 6 && this.n === 6 && this.e === 6) { if (!this.st.isDone(0)) { this.st.done(0); this.ui.note('Carbon-12: 6 protons, 6 neutrons, 6 electrons (2,4).'); } }
    if (this.p === 6 && this.n === 8 && this.e === 6) { if (!this.st.isDone(1)) { this.st.done(1); this.ui.note('Carbon-14: same element (6 protons) but 8 neutrons — a radioactive **isotope** used for dating.', 'gold'); } }
    if (this.p === 11 && this.e === 10) { if (!this.st.isDone(2)) { this.st.done(2); this.ui.note('Na⁺: sodium lost its single outer electron, leaving a full shell (2,8) and a 1+ charge.', 'gold'); } }
    if (this.p === 17 && this.e === 18) { if (!this.st.isDone(3)) { this.st.done(3); this.ui.note('Cl⁻: chlorine gained one electron to complete its outer shell (2,8,8).', 'gold'); } }
    if ([2, 10, 18].includes(this.p) && this.e === this.p && stable.includes(A)) { if (!this.st.isDone(4)) { this.st.done(4); this.ui.note(`${name}: a full outer shell — that is why noble gases are unreactive.`, 'gold'); } }
    this.check();
  }
  check() { if ([0, 1, 2, 3, 4, 5].every((i) => this.st.isDone(i))) this.lab.complete(); }
  update(dt, t) {
    this.nuc.rotation.y += dt * 0.6; this.nuc.rotation.x = Math.sin(t * 0.4) * 0.3;
    (this.shells || []).forEach((s) => { s.children.forEach((c, i) => { if (i === 0) return; }); s.rotation.y += dt * s.userData.speed; });
  }
}
