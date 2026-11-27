import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { mesh, mat, Bulb } from '../apparatus.js';
import { tweens, ease, TAU } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const ACOL = { H: '#f8fafc', C: '#334155', O: '#ef4444', N: '#3b82f6', Cl: '#22c55e' };
const ARAD = { H: 0.017, C: 0.025, O: 0.024, N: 0.024, Cl: 0.031 };
const MOL = {
  H2: { atoms: [['H', -0.037, 0, 0], ['H', 0.037, 0, 0]], bonds: [[0, 1, 1]], note: 'One shared pair: each H gets a full first shell (2).' },
  Cl2: { atoms: [['Cl', -0.05, 0, 0], ['Cl', 0.05, 0, 0]], bonds: [[0, 1, 1]], note: 'One shared pair completes both outer shells (8).' },
  HCl: { atoms: [['H', -0.055, 0, 0], ['Cl', 0.035, 0, 0]], bonds: [[0, 1, 1]], note: 'H shares its electron with Cl.' },
  H2O: { atoms: [['O', 0, 0.01, 0], ['H', -0.058, -0.036, 0], ['H', 0.058, -0.036, 0]], bonds: [[0, 1, 1], [0, 2, 1]], note: 'Two shared pairs; oxygen also keeps two lone pairs.' },
  NH3: { atoms: [['N', 0, 0.02, 0], ['H', 0.06, -0.02, 0], ['H', -0.03, -0.02, 0.052], ['H', -0.03, -0.02, -0.052]], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]], note: 'Three shared pairs and one lone pair on nitrogen.' },
  CH4: { atoms: [['C', 0, 0, 0], ['H', 0.04, 0.04, 0.04], ['H', -0.04, -0.04, 0.04], ['H', -0.04, 0.04, -0.04], ['H', 0.04, -0.04, -0.04]], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]], note: 'Four shared pairs — carbon has 4 outer electrons.' },
  O2: { atoms: [['O', -0.045, 0, 0], ['O', 0.045, 0, 0]], bonds: [[0, 1, 2]], s: true, note: 'A double bond: two shared pairs.' },
  N2: { atoms: [['N', -0.042, 0, 0], ['N', 0.042, 0, 0]], bonds: [[0, 1, 3]], s: true, note: 'A triple bond: three shared pairs.' },
  CO2: { atoms: [['C', 0, 0, 0], ['O', -0.075, 0, 0], ['O', 0.075, 0, 0]], bonds: [[0, 1, 2], [0, 2, 2]], s: true, note: 'Two C=O double bonds.' },
  C2H4: { atoms: [['C', -0.04, 0, 0], ['C', 0.04, 0, 0], ['H', -0.075, 0.045, 0], ['H', -0.075, -0.045, 0], ['H', 0.075, 0.045, 0], ['H', 0.075, -0.045, 0]], bonds: [[0, 1, 2], [0, 2, 1], [0, 3, 1], [1, 4, 1], [1, 5, 1]], s: true, note: 'Ethene has a C=C double bond.' },
  CH3OH: { atoms: [['C', -0.035, 0, 0], ['O', 0.045, 0.01, 0], ['H', 0.07, -0.035, 0], ['H', -0.06, 0.05, 0.02], ['H', -0.06, -0.03, 0.04], ['H', -0.06, -0.025, -0.045]], bonds: [[0, 1, 1], [1, 2, 1], [0, 3, 1], [0, 4, 1], [0, 5, 1]], s: true, note: 'Methanol: all single bonds; O has two lone pairs.' },
};
const IONIC = {
  NaCl: { metal: ['Na', 1, '#a855f7'], nm: [['Cl', 7, '#22c55e']], formula: 'NaCl', note: 'Na (2,8,1) gives 1 electron to Cl (2,8,7): Na⁺ and Cl⁻.' },
  LiF: { metal: ['Li', 1, '#c084fc'], nm: [['F', 7, '#a3e635']], formula: 'LiF', note: 'Li (2,1) gives 1 electron to F (2,7): Li⁺ and F⁻.' },
  MgO: { metal: ['Mg', 2, '#94a3b8'], nm: [['O', 6, '#ef4444']], formula: 'MgO', note: 'Mg (2,8,2) gives 2 electrons to O (2,6): Mg²⁺ and O²⁻.', s: true },
  CaCl2: { metal: ['Ca', 2, '#f5f5f4'], nm: [['Cl', 7, '#22c55e'], ['Cl', 7, '#22c55e']], formula: 'CaCl₂', note: 'Ca gives one electron to each of two Cl atoms: Ca²⁺ and 2Cl⁻.', s: true },
};

export default class Bonding extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Why does salty water conduct but sugary water doesn’t? Why is diamond hard and graphite slippery? It all comes down to how atoms bond.';
    this.view = { pos: [0, 1.32, 0.66], target: [0, 1.13, 0] };
    this.modeDone = new Set(); this.mols = new Set();
  }
  build() {
    const Y = this.Y;
    const base = mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.025, 32), mat('#1e293b', 0.5, 0.3)); this.lab.add(base, 0, Y, 0);
    this.stage = new THREE.Group(); this.lab.add(this.stage, 0, Y + 0.22, 0);
    this.bulb = new Bulb(); this.lab.add(this.bulb, 0.26, Y, 0.06); this.lab.label(this.bulb, 'Conductivity tester', { y: 0.09, cls: 'dimlab' });
    const ui = this.ui;
    this.st = ui.steps(['Form an **ionic** compound by transferring electrons', 'Build **three** covalent molecules', 'Explore **diamond and graphite**', 'Compare a **pure metal** with an **alloy**', 'Answer the analysis questions']);
    const sec = ui.section('Bond type');
    ui.seg({ options: [['ionic', 'Ionic'], ['covalent', 'Covalent'], ['giant', 'Giant covalent'], ['lattice', 'Ionic lattice'], ['metal', 'Metals & alloys']], value: 'ionic', parent: sec, onChange: (v) => this.mode(v) });
    this.ctl = document.createElement('div'); sec.append(this.ctl);
    this.ro = ui.readouts([{ id: 'f', label: 'Formula' }, { id: 'c', label: 'Conducts?' }], sec);
    ui.notes();
    ui.questions([
      { q: 'What is the formula of **calcium chloride** (Ca²⁺ and Cl⁻)?', opts: ['CaCl₂', 'CaCl', 'Ca₂Cl', 'Ca₂Cl₃'], e: 'Two Cl⁻ ions balance one Ca²⁺ ion.', o: [6], sub: 'C3.1' },
      { q: 'Sodium chloride has a high melting point because…', opts: ['strong electrostatic forces act between oppositely charged ions in a giant lattice', 'its molecules are heavy', 'covalent bonds are weak', 'it contains delocalised electrons'], e: 'Lots of energy is needed to overcome the attraction between ions.', o: [4, 6], sub: 'C2.4' },
      { q: 'Graphite conducts electricity because…', opts: ['each carbon atom has one delocalised electron that can move', 'it contains ions', 'its layers are strongly bonded', 'it is a metal'], e: 'Only three of each carbon’s four outer electrons are used in bonds.', o: [1, 2], sub: 'C2.6' },
      { q: 'Alloys are harder than pure metals because…', opts: ['different-sized atoms disrupt the layers so they cannot slide easily', 'alloys contain ions', 'alloys have no electrons', 'alloys are compounds'], e: 'Distorted layers resist sliding.', o: [5], sub: 'C9.3' },
      { q: 'How many shared pairs of electrons are in a molecule of water?', opts: ['2', '1', '4', '3'], e: 'Each O–H bond is one shared pair.', o: [2], sub: 'C2.5' },
    ], { sub: 'C2.4', onDone: () => { this.st.done(4); this.check(); } });
    this.mode('ionic');
  }
  clear() { while (this.stage.children.length) { this.stage.remove(this.stage.children[0]); } this.animate = null; this.ctl.innerHTML = ''; this.bulb.set(0); }
  btns(list) { this.ui.buttons(list, this.ctl); }
  mode(m) {
    this.clear(); this.m = m;
    if (m === 'ionic') { this.btns(Object.keys(IONIC).map((k) => ({ label: IONIC[k].formula + (IONIC[k].s ? ' (S)' : ''), onClick: () => this.ionic(k) }))); this.ionic('NaCl'); }
    if (m === 'covalent') { this.btns(Object.keys(MOL).map((k) => ({ label: k.replace(/(\d)/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]) + (MOL[k].s ? ' (S)' : ''), onClick: () => this.molecule(k) }))); this.molecule('H2O'); }
    if (m === 'giant') { this.btns([{ label: '💎 Diamond', onClick: () => this.diamond() }, { label: '✏️ Graphite', onClick: () => this.graphite() }, { label: '↔ Slide graphite layers', onClick: () => this.slide() }]); this.diamond(); }
    if (m === 'lattice') { this.lattice(); this.btns([{ label: '⚡ Test: solid', onClick: () => this.test('solid') }, { label: '⚡ Test: molten', onClick: () => this.test('molten') }, { label: '⚡ Test: dissolved', onClick: () => this.test('aq') }]); }
    if (m === 'metal') { this.btns([{ label: '🔩 Pure metal', onClick: () => this.metal(false) }, { label: '⚙️ Alloy', onClick: () => this.metal(true) }, { label: '🔨 Apply force', onClick: () => this.hammer() }]); this.metal(false); }
  }
  atomShell(sym, count, color, r = 0.05, cross = false) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.SphereGeometry(0.018, 16, 12), mat(color, 0.1, 0.4)));
    const ring = mesh(new THREE.TorusGeometry(r, 0.0012, 6, 48), new THREE.MeshBasicMaterial({ color: '#94a3b8', transparent: true, opacity: 0.6 })); g.add(ring);
    g.userData.es = [];
    for (let k = 0; k < count; k++) { const a = (k / 8) * TAU + 0.2; const e = cross ? mesh(new THREE.BoxGeometry(0.008, 0.008, 0.008), mat('#ef4444', 0, 0.4)) : mesh(new THREE.SphereGeometry(0.005, 10, 8), mat('#3b82f6', 0, 0.4)); e.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); g.add(e); g.userData.es.push(e); }
    g.userData.ring = ring; g.userData.r = r;
    this.lab.label(g, sym, { y: 0.075, cls: 'big' });
    return g;
  }
  ionic(k) {
    while (this.stage.children.length) this.stage.remove(this.stage.children[0]);
    const d = IONIC[k];
    const metal = this.atomShell(d.metal[0], d.metal[1], d.metal[2], 0.05, true); metal.position.x = d.nm.length > 1 ? 0 : -0.08; this.stage.add(metal);
    const nms = d.nm.map(([s, n, c], i) => { const g = this.atomShell(s, n, c, 0.055, false); g.position.x = d.nm.length > 1 ? (i ? 0.14 : -0.14) : 0.08; this.stage.add(g); return g; });
    this.ro.set('f', '?'); this.ro.set('c', '—');
    this._tb?.parentNode?.remove();
    this._tb = this.ui.buttons([{ label: '➡ Transfer electrons', kind: 'primary', onClick: () => this.transfer(metal, nms, d) }], this.ctl)[0];
  }
  async transfer(metal, nms, d) {
    const es = metal.userData.es.slice();
    let target = 0;
    for (const e of es) {
      const nm = nms[target % nms.length]; target++;
      const wp = new THREE.Vector3(); e.getWorldPosition(wp);
      const slot = nm.userData.es.length; const a = (slot / 8) * TAU + 0.2; const r = nm.userData.r;
      const dest = nm.localToWorld(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
      this.stage.worldToLocal(wp); this.stage.worldToLocal(dest);
      metal.remove(e); this.stage.add(e); e.position.copy(wp);
      await tweens.tween(0.7, (t) => { e.position.lerpVectors(wp, dest, t); e.position.y += Math.sin(t * Math.PI) * 0.04; }, { ease: ease.inOut }).promise;
      this.stage.remove(e); nm.add(e); e.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); nm.userData.es.push(e);
      audio.blip();
    }
    metal.userData.ring.visible = false;
    this.ro.set('f', d.formula); this.ui.note(d.note + ' Oppositely charged ions attract: an **ionic bond**.', 'gold');
    this.st.done(0); this.check();
  }
  molecule(k) {
    while (this.stage.children.length) this.stage.remove(this.stage.children[0]);
    const d = MOL[k]; const g = new THREE.Group(); g.scale.setScalar(1.4); this.stage.add(g);
    const pos = d.atoms.map(([s, x, y, z]) => new THREE.Vector3(x, y, z));
    d.atoms.forEach(([s], i) => { const a = mesh(new THREE.SphereGeometry(ARAD[s], 20, 16), mat(ACOL[s], 0.1, 0.35)); a.position.copy(pos[i]); g.add(a); });
    for (const [i, j, order] of d.bonds) {
      const A = pos[i], B = pos[j], dir = B.clone().sub(A), len = dir.length(); dir.normalize();
      const perp = new THREE.Vector3(0, 0, 1).cross(dir).normalize();
      for (let k2 = 0; k2 < order; k2++) {
        const off = (k2 - (order - 1) / 2) * 0.012;
        const b = mesh(new THREE.CylinderGeometry(0.004, 0.004, len, 8), mat('#cbd5e1', 0.3, 0.4));
        b.position.copy(A).add(B).multiplyScalar(0.5).addScaledVector(perp, off); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.add(b);
        // shared pair (dot + cross)
        const mid = A.clone().lerp(B, 0.5).addScaledVector(perp, off).add(new THREE.Vector3(0, 0, 0.012));
        const dot = mesh(new THREE.SphereGeometry(0.0035, 8, 6), mat('#3b82f6')); dot.position.copy(mid).addScaledVector(dir, -0.005); g.add(dot);
        const crs = mesh(new THREE.BoxGeometry(0.005, 0.005, 0.005), mat('#ef4444')); crs.position.copy(mid).addScaledVector(dir, 0.005); g.add(crs);
      }
    }
    this.animate = (dt) => { g.rotation.y += dt * 0.6; };
    this.ro.set('f', k.replace(/(\d)/g, (x) => '₀₁₂₃₄₅₆₇₈₉'[x])); this.ro.set('c', 'No — no ions or free electrons');
    this.ui.note(`${k}: ${d.note} Shared pairs shown as a blue dot and red cross.`);
    this.mols.add(k); if (this.mols.size >= 3) { this.st.done(1); this.check(); }
  }
  diamond() {
    while (this.stage.children.length) this.stage.remove(this.stage.children[0]);
    const g = new THREE.Group(); this.stage.add(g); const a = 0.09;
    const base = [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]];
    const pts = [];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) for (const b of base) for (const off of [[0, 0, 0], [0.25, 0.25, 0.25]]) pts.push(new THREE.Vector3((i + b[0] + off[0] - 1) * a, (j + b[1] + off[1] - 1) * a, (k + b[2] + off[2] - 1) * a));
    const cm = mat('#94a3b8', 0.2, 0.3); const bm = mat('#64748b', 0.3, 0.4); const sg = new THREE.SphereGeometry(0.009, 10, 8);
    pts.forEach((p) => { const m = new THREE.Mesh(sg, cm); m.position.copy(p); g.add(m); });
    const bl = a * Math.sqrt(3) / 4;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = pts[i].distanceTo(pts[j]); if (Math.abs(d - bl) < 0.002) { const b = mesh(new THREE.CylinderGeometry(0.0025, 0.0025, d, 6), bm); b.position.copy(pts[i]).add(pts[j]).multiplyScalar(0.5); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pts[j].clone().sub(pts[i]).normalize()); g.add(b); } }
    this.animate = (dt) => { g.rotation.y += dt * 0.4; g.rotation.x = 0.4; };
    this.bulb.set(0); this.ro.set('f', 'C (diamond)'); this.ro.set('c', 'No');
    this.ui.note('Diamond: each carbon makes **four** strong covalent bonds in a rigid 3D lattice — very hard, very high melting point, no free electrons.');
    this.seenD = true; if (this.seenG) { this.st.done(2); this.check(); }
  }
  graphite() {
    while (this.stage.children.length) this.stage.remove(this.stage.children[0]);
    const g = new THREE.Group(); this.stage.add(g); this.layers = [];
    const cm = mat('#334155', 0.3, 0.4), bm = mat('#475569'); const sg = new THREE.SphereGeometry(0.007, 10, 8), s = 0.022;
    for (let L = 0; L < 3; L++) {
      const layer = new THREE.Group(); layer.position.y = (L - 1) * 0.06; g.add(layer); this.layers.push(layer);
      const pts = [];
      for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { const x = i * s * Math.sqrt(3) + (j % 2 ? s * Math.sqrt(3) / 2 : 0), z = j * s * 1.5; for (const dz of [0, s]) { const p = new THREE.Vector3(x + (L % 2) * s * 0.8, 0, z + dz - s * 0.5); if (p.length() < 0.13) pts.push(p); } }
      pts.forEach((p) => { const m = new THREE.Mesh(sg, cm); m.position.copy(p); layer.add(m); });
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = pts[i].distanceTo(pts[j]); if (d < s * 1.05) { const b = mesh(new THREE.CylinderGeometry(0.002, 0.002, d, 5), bm); b.position.copy(pts[i]).add(pts[j]).multiplyScalar(0.5); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pts[j].clone().sub(pts[i]).normalize()); layer.add(b); } }
    }
    this.animate = (dt) => { g.rotation.y += dt * 0.3; };
    this.bulb.set(1); this.ro.set('f', 'C (graphite)'); this.ro.set('c', 'Yes — delocalised electrons');
    this.ui.note('Graphite: layers of hexagons, each carbon bonded to **three** others. Weak forces between layers let them slide; delocalised electrons conduct.', 'gold');
    this.seenG = true; if (this.seenD) { this.st.done(2); this.check(); }
  }
  slide() { if (!this.layers) this.graphite(); const top = this.layers[2]; const x0 = top.position.x; tweens.tween(1.2, (e) => { top.position.x = x0 + Math.sin(e * Math.PI) * 0.06; }); audio.whoosh(); }
  lattice() {
    const g = new THREE.Group(); this.stage.add(g); const a = 0.045;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const na = (i + j + k) % 2 === 0; const m = mesh(new THREE.SphereGeometry(na ? 0.012 : 0.02, 14, 10), mat(na ? '#a855f7' : '#22c55e', 0.1, 0.4)); m.position.set(i * a, j * a, k * a); g.add(m); }
    this.animate = (dt) => { g.rotation.y += dt * 0.4; g.rotation.x = 0.35; };
    this.ro.set('f', 'NaCl (giant ionic lattice)'); this.ro.set('c', 'Test it!');
    this.ui.note('A giant lattice of alternating Na⁺ (purple) and Cl⁻ (green) ions held by strong electrostatic attraction.');
  }
  test(state) {
    const on = state !== 'solid';
    this.bulb.set(on ? 1 : 0); audio.zap();
    this.ro.set('c', on ? 'Yes — ions free to move' : 'No — ions fixed in place');
    this.ui.note(on ? `NaCl ${state === 'aq' ? 'dissolved in water' : 'molten'}: the lamp lights — the ions can move and carry charge.` : 'Solid NaCl: no current — the ions cannot move.', on ? 'gold' : '');
  }
  metal(alloy) {
    while (this.stage.children.length) this.stage.remove(this.stage.children[0]);
    const g = new THREE.Group(); this.stage.add(g); this.metalLayers = []; this.isAlloy = alloy;
    const im = mat('#cbd5e1', 0.7, 0.3), big = mat('#f59e0b', 0.6, 0.3);
    for (let L = 0; L < 3; L++) { const layer = new THREE.Group(); layer.position.y = (L - 1) * 0.04; g.add(layer); this.metalLayers.push(layer); for (let i = -3; i <= 3; i++) for (let k = -1; k <= 1; k++) { const isBig = alloy && (i * 7 + k * 3 + L) % 5 === 0; const m = mesh(new THREE.SphereGeometry(isBig ? 0.026 : 0.018, 14, 10), isBig ? big : im); m.position.set(i * 0.04, 0, k * 0.04); layer.add(m); } }
    this.sea = []; const em = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.4, 3) });
    for (let i = 0; i < 40; i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 4), em); e.position.set((Math.random() - 0.5) * 0.28, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12); e.userData.v = new THREE.Vector3().randomDirection().multiplyScalar(0.05); g.add(e); this.sea.push(e); }
    this.animate = (dt) => { for (const e of this.sea) { e.position.addScaledVector(e.userData.v, dt); for (const ax of ['x', 'y', 'z']) { const lim = ax === 'x' ? 0.14 : 0.06; if (Math.abs(e.position[ax]) > lim) e.userData.v[ax] *= -1; } } g.rotation.y = Math.sin(performance.now() * 0.0004) * 0.4; };
    this.bulb.set(1); this.ro.set('f', alloy ? 'Alloy (e.g. steel)' : 'Pure metal'); this.ro.set('c', 'Yes — delocalised electrons');
    this.ui.note(alloy ? 'Alloy: larger atoms (gold) distort the regular layers.' : 'Metallic bonding: positive ions in a sea of delocalised electrons (blue).');
    this.triedPure = this.triedPure || !alloy; this.triedAlloy = this.triedAlloy || alloy;
  }
  hammer() {
    if (!this.metalLayers) return;
    const top = this.metalLayers[2]; const x0 = top.position.x;
    audio.clink();
    if (this.isAlloy) { tweens.tween(0.6, (e) => { top.position.x = x0 + Math.sin(e * Math.PI * 3) * 0.006; }); this.ui.note('The alloy resists: the layers can’t slide past the larger atoms — **harder and stronger**.', 'gold'); this.hitAlloy = true; }
    else { tweens.to(top.position, { x: x0 + 0.04 }, 0.8, { ease: ease.outBack }); this.ui.note('Pure metal: the layers slide over each other — **malleable**.', 'gold'); this.hitPure = true; }
    if (this.hitAlloy && this.hitPure) { this.st.done(3); this.check(); }
  }
  check() { this.st.check(); }
  update(dt) { this.animate?.(dt); }
}
