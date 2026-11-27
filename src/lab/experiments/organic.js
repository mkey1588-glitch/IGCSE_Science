import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { mesh, mat } from '../apparatus.js';
import { h, tweens, ease } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const STEM = ['meth', 'eth', 'prop', 'but'];
const SUBS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉', '₁₀'];
const sub = (n) => (n === 1 ? '' : String(n).split('').map((d) => SUBS[+d]).join(''));
const AT = { C: { r: 0.014, c: '#374151' }, H: { r: 0.0095, c: '#f8fafc' }, O: { r: 0.013, c: '#ef4444' } };

function nameOf(fam, n) {
  if (fam === 'alkane') return `${STEM[n - 1]}ane`;
  if (fam === 'alkene') return n <= 3 ? `${STEM[n - 1]}ene` : 'but-1-ene';
  return n <= 2 ? `${STEM[n - 1]}anol` : `${STEM[n - 1]}an-1-ol`;
}
function formulaOf(fam, n) {
  if (fam === 'alkane') return `C${sub(n)}H${sub(2 * n + 2)}`;
  if (fam === 'alkene') return `C${sub(n)}H${sub(2 * n)}`;
  return `C${sub(n)}H${sub(2 * n + 1)}OH`;
}

/** Builds an atom/bond graph for an unbranched alkane, alkene (C1=C2) or alcohol (OH on C1). */
function graph(fam, n) {
  const atoms = [], bonds = [];
  const add = (el, p) => { atoms.push({ el, p: new THREE.Vector3(...p) }); return atoms.length - 1; };
  const C = [];
  for (let i = 0; i < n; i++) C.push(add('C', [(i - (n - 1) / 2) * 0.055, (i % 2 ? 0.016 : -0.016), 0]));
  for (let i = 0; i < n - 1; i++) bonds.push([C[i], C[i + 1], fam === 'alkene' && i === 0 ? 2 : 1]);
  const used = C.map(() => 0); for (const [a, b, o] of bonds) { used[C.indexOf(a)] += o; used[C.indexOf(b)] += o; }
  const dirs = (i) => {
    if (n === 1) return [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]];
    const s = i % 2 ? 1 : -1, end = i === 0 ? -1 : i === n - 1 ? 1 : 0;
    const sp2 = fam === 'alkene' && i <= 1;
    if (sp2) return end ? [[end, 0.75, 0], [end * 0.35, -0.95, 0]].map(([x, y, z]) => [x, y * -s * -1, z]) : [[0, s, 0]];
    const out = []; if (end) out.push([end, 0.35 * s, 0]); out.push([0, 0.55 * s, 0.83], [0, 0.55 * s, -0.83], [0, s, 0]); return out;
  };
  C.forEach((ci, i) => {
    let free = 4 - used[i];
    const ds = dirs(i);
    if (fam === 'alcohol' && i === 0) {
      const d = new THREE.Vector3(...(n === 1 ? ds.shift() : [-1, 0.35 * (i % 2 ? 1 : -1), 0])).normalize();
      if (n > 1) ds.shift();
      const o = add('O', atoms[ci].p.clone().addScaledVector(d, 0.05).toArray()); bonds.push([ci, o, 1]);
      const hh = add('H', atoms[o].p.clone().add(new THREE.Vector3(-0.012, 0.032, 0)).toArray()); bonds.push([o, hh, 1]);
      free--;
    }
    for (let k = 0; k < free; k++) { const d = new THREE.Vector3(...ds[k % ds.length]).normalize(); const hh = add('H', atoms[ci].p.clone().addScaledVector(d, 0.04).toArray()); bonds.push([ci, hh, 1]); }
  });
  return { atoms, bonds };
}
function buildMesh({ atoms, bonds }, scale = 1) {
  const g = new THREE.Group();
  const geo = { C: new THREE.SphereGeometry(AT.C.r, 20, 14), H: new THREE.SphereGeometry(AT.H.r, 16, 12), O: new THREE.SphereGeometry(AT.O.r, 20, 14) };
  const mats = { C: mat(AT.C.c, 0.2, 0.35), H: mat(AT.H.c, 0, 0.3), O: mat(AT.O.c, 0.1, 0.35) };
  for (const a of atoms) g.add(mesh(geo[a.el], mats[a.el], a.p.x, a.p.y, a.p.z));
  const bm = mat('#cbd5e1', 0.3, 0.4), up = new THREE.Vector3(0, 1, 0);
  for (const [i, j, o] of bonds) {
    const a = atoms[i].p, b = atoms[j].p, len = a.distanceTo(b), mid = a.clone().add(b).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(up, b.clone().sub(a).normalize());
    const offs = o === 2 ? [-0.0045, 0.0045] : [0];
    for (const off of offs) { const c = mesh(new THREE.CylinderGeometry(0.0028, 0.0028, len, 8), o === 2 ? mat('#fbbf24', 0.2, 0.4) : bm); c.quaternion.copy(q); c.position.copy(mid).add(new THREE.Vector3(0, 0, off)); g.add(c); }
  }
  g.scale.setScalar(scale);
  return g;
}

export default class Organic extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Plastic washes up on Brightwater’s beaches every tide. To fix it, people need to understand what plastics actually are — starting with the molecules they are built from.';
    this.view = { pos: [0, 1.36, 0.72], target: [0, 1.12, 0] };
    this.fam = 'alkane'; this.n = 1; this.built = new Set();
  }
  build() {
    const Y = this.Y;
    this.stage = new THREE.Group(); this.lab.add(this.stage, 0, Y + 0.22, 0);
    const ped = mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.02, 40), mat('#1e293b', 0.6, 0.3)); this.lab.add(ped, 0, Y, 0);
    const ring = mesh(new THREE.TorusGeometry(0.125, 0.003, 6, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 2) })); ring.rotation.x = Math.PI / 2; this.lab.add(ring, 0, Y + 0.021, 0);
    this.nameLbl = this.lab.label(this.stage, '', { y: 0.1, cls: 'big' });
    const ui = this.ui;
    this.st = ui.steps(['Build **methane, ethane, ethene and ethanol**', { t: '(S) Build the first **four members** of one homologous series', o: ['C11.1.5', 'C11.2.3'] }, 'Zip ethene into **poly(ethene)** (addition polymerisation)', { t: '(S) Make **nylon** (condensation polymerisation)', o: ['C11.7.5', 'C11.7.6'] }, 'Balance the **complete combustion of ethanol**', 'Answer the analysis questions']);
    const sec = ui.section('Molecule builder');
    this.famSeg = ui.seg({ label: 'Family', options: [['alkane', 'Alkane (C–C)'], ['alkene', 'Alkene (C=C)'], ['alcohol', 'Alcohol (–OH)']], value: this.fam, parent: sec, onChange: (v) => { this.fam = v; if (v === 'alkene' && this.n < 2) { this.n = 2; this.nSl.set(2); } this.show(); } });
    this.nSl = ui.slider({ label: 'Carbon atoms', min: 1, max: 4, step: 1, value: this.n, parent: sec, onInput: (v) => { this.n = this.fam === 'alkene' ? Math.max(2, v) : v; this.show(); } });
    this.ro = ui.readouts([{ id: 'n', label: 'Name' }, { id: 'f', label: 'Molecular formula' }, { id: 's', label: 'Saturated?' }, { id: 'g', label: 'General formula' }], sec);
    this.dCanvas = h('canvas', { width: 640, height: 260, class: 'graph', style: { height: '140px' } }); ui.section('Displayed formula').append(this.dCanvas);
    const ps = ui.section('Polymers');
    ui.buttons([{ label: '🔗 Polymerise ethene', kind: 'primary', onClick: () => this.polymerise() }, { label: '🧵 Make nylon (S)', onClick: () => this.nylon() }], ps);
    const cs = ui.section('Burning ethanol (a biofuel)');
    cs.append(h('div', { style: { fontFamily: 'var(--display)', margin: '6px 0' } }, 'C₂H₅OH + ? O₂ → 2CO₂ + 3H₂O'));
    ui.seg({ options: [['1', '1'], ['2', '2'], ['3', '3'], ['3.5', '3½']], value: null, parent: cs, onChange: (v) => { if (v === '3') { audio.success(); this.st.done(4); this.ui.note('Balanced: **C₂H₅OH + 3O₂ → 2CO₂ + 3H₂O**. Oxygen atoms: 1 + 6 = 4 + 3 = 7 on each side.', 'gold'); this.check(); } else { audio.fail(); this.ui.note('Count the oxygen atoms on the right: 2×2 + 3×1 = 7. One is already in ethanol.', 'warn'); } } });
    ui.notes();
    ui.questions([
      { q: 'Ethene is described as **unsaturated** because…', opts: ['it contains a C=C double bond', 'it contains only single bonds', 'it contains oxygen', 'it is a gas'], e: 'Saturated: only C–C single bonds. Unsaturated: at least one C=C.', o: [2, 3], sub: 'C11.1' },
      { q: 'Which formula is an **alkane**?', opts: ['C₃H₈', 'C₃H₆', 'C₂H₅OH', 'C₂H₄'], e: 'Alkanes fit CₙH₂ₙ₊₂.', o: [2], sub: 'C11.2' },
      { q: '(S) CH₃CH₂CH₂OH is named…', opts: ['propanol (propan-1-ol)', 'propane', 'propene', 'ethanol'], e: '“prop” = 3 carbons; “-ol” = alcohol.', o: [3], sub: 'C11.2' },
      { q: '(S) Members of a homologous series…', opts: ['share a general formula and have similar chemical properties', 'all have the same boiling point', 'all have the same molecular formula', 'are always gases'], e: 'Physical properties show a trend as the chain gets longer.', o: [4, 5], sub: 'C11.1' },
      { q: 'Two uses of ethanol are…', opts: ['as a solvent and as a fuel', 'as a catalyst and a plastic', 'as a fertiliser and a fuel', 'as a refrigerant and a dye'], e: 'Ethanol is in perfumes, hand gels and biofuels.', o: [2], sub: 'C11.6' },
      { q: '(S) PVC has the repeat unit –[CH₂–CHCl]–. Its monomer is…', opts: ['chloroethene, CH₂=CHCl', 'chloroethane, CH₃CH₂Cl', 'ethene, CH₂=CH₂', 'vinyl alcohol'], e: 'Put the C=C back into the repeat unit to find the monomer.', o: [4], sub: 'C11.7' },
      { q: '(S) Nylon forms by **condensation** polymerisation, so every new link also makes…', opts: ['a small molecule — water', 'nothing else', 'a C=C double bond', 'hydrogen gas'], e: 'Addition polymers form a single product; condensation polymers release a small molecule.', o: [5, 6], sub: 'C11.7' },
    ], { sub: 'C11.7', onDone: () => { this.st.done(5); this.check(); } });
    this.show();
    this.every((dt) => { if (this.mol && !this.busy) this.mol.rotation.y += dt * 0.5; });
  }
  show() {
    if (this.busy) return;
    if (this.mol) { this.stage.remove(this.mol); }
    const fam = this.fam, n = this.n;
    this.mol = buildMesh(graph(fam, n), 1.25); this.stage.add(this.mol);
    this.mol.scale.setScalar(0.01); tweens.to(this.mol.scale, { x: 1.25, y: 1.25, z: 1.25 }, 0.5, { ease: ease.outBack || ease.out });
    const name = nameOf(fam, n);
    this.nameLbl.userData.set(`${name} · ${formulaOf(fam, n)}`);
    this.ro.set('n', name); this.ro.set('f', formulaOf(fam, n)); this.ro.set('s', fam === 'alkene' ? 'No — has C=C' : 'Yes — single bonds only');
    this.ro.set('g', fam === 'alkane' ? 'CₙH₂ₙ₊₂' : fam === 'alkene' ? 'CₙH₂ₙ' : 'CₙH₂ₙ₊₁OH');
    this.drawDisplayed(fam, n); audio.blip();
    this.built.add(`${fam}${n}`);
    if (['alkane1', 'alkane2', 'alkene2', 'alcohol2'].every((k) => this.built.has(k)) && !this.st.isDone(0)) { this.st.done(0); this.ui.note('Methane, ethane, ethene and ethanol — the four molecules every IGCSE chemist must name and draw.', 'gold'); }
    const series = (f, from) => [from, from + 1, from + 2, from + 3].filter((k) => k <= 4).every((k) => this.built.has(`${f}${k}`));
    if (!this.st.isDone(1) && (series('alkane', 1) || series('alcohol', 1) || ['alkene2', 'alkene3', 'alkene4'].every((k) => this.built.has(k)))) { this.st.done(1); this.ui.note('A **homologous series**: each member differs by –CH₂–, shares a general formula and has similar chemical properties, with a trend in physical properties.', 'gold'); }
    this.check();
  }
  drawDisplayed(fam, n) {
    const c = this.dCanvas, ctx = c.getContext('2d'), W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(0, 0, W, H);
    const s = 70, cx = W / 2 - ((n - 1) * s) / 2 + (fam === 'alcohol' ? 40 : 0), cy = H / 2;
    const at = (x, y, t, col = '#e2e8f0') => { ctx.fillStyle = col; ctx.font = '700 30px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); };
    const line = (x1, y1, x2, y2, dbl = false) => { ctx.strokeStyle = dbl ? '#fbbf24' : '#94a3b8'; ctx.lineWidth = 3; const k = (a, b, o) => { ctx.beginPath(); ctx.moveTo(x1 + a, y1 + b); ctx.lineTo(x2 + a, y2 + b); ctx.stroke(); }; if (dbl) { const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy); const px = (-dy / L) * 5, py = (dx / L) * 5; k(px, py); k(-px, -py); } else k(0, 0); };
    for (let i = 0; i < n; i++) {
      const x = cx + i * s;
      if (i < n - 1) line(x + 16, cy, x + s - 16, cy, fam === 'alkene' && i === 0);
      at(x, cy, 'C');
      const sp2 = fam === 'alkene' && i <= 1;
      const ohHere = fam === 'alcohol' && i === 0;
      const hs = [];
      if (sp2) { if (i === 0) hs.push([-0.75, -0.75], [-0.75, 0.75]); else if (n === 2) hs.push([0.75, -0.75], [0.75, 0.75]); else hs.push([0, -1]); }
      else { hs.push([0, -1], [0, 1]); if (i === n - 1) hs.push([1, 0]); if (i === 0 && !ohHere) hs.push([-1, 0]); if (n === 1 && ohHere) { /* methanol: three H + O */ } }
      for (const [dx, dy] of hs) { const hx = x + dx * s * 0.85, hy = cy + dy * s * 0.85; line(x + dx * 16, cy + dy * 16, hx - dx * 14, hy - dy * 14); at(hx, hy, 'H', '#cbd5e1'); }
      if (ohHere) { const ox = x - s * 0.85; line(x - 16, cy, ox + 14, cy); at(ox, cy, 'O', '#f87171'); line(ox - 14, cy, ox - s * 0.7 + 14, cy); at(ox - s * 0.7, cy, 'H', '#cbd5e1'); }
    }
  }
  async polymerise() {
    if (this.busy) return; this.busy = true; audio.whoosh?.();
    if (this.mol) this.stage.remove(this.mol);
    const monos = []; const N = 5;
    for (let i = 0; i < N; i++) { const m = buildMesh(graph('alkene', 2), 0.9); m.position.set((i - (N - 1) / 2) * 0.12, (i % 2 ? 0.05 : -0.04), (Math.random() - 0.5) * 0.08); m.rotation.set(Math.random(), Math.random() * 3, 0); this.stage.add(m); monos.push(m); }
    this.nameLbl.userData.set('n × ethene (monomers)');
    await tweens.tween(1.2, () => {}).promise;
    await Promise.all(monos.map((m, i) => tweens.to(m.position, { x: (i - (N - 1) / 2) * 0.099, y: 0, z: 0 }, 1.2, { ease: ease.inOut }).promise.then(() => tweens.to(m.rotation, { x: 0, y: 0, z: 0 }, 0.4).promise)));
    monos.forEach((m) => this.stage.remove(m));
    const poly = buildMesh(graph('alkane', 10), 0.9); this.stage.add(poly); this.mol = poly;
    const box = mesh(new THREE.BoxGeometry(0.1, 0.12, 0.08), new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.12, depthWrite: false })); box.position.set(-0.0247, 0, 0); poly.add(box);
    this.nameLbl.userData.set('poly(ethene): –[CH₂–CH₂]ₙ–');
    audio.success(); this.busy = false;
    this.st.done(2);
    this.ui.note('**Addition polymerisation:** the C=C double bonds open and thousands of ethene monomers join into one long chain. The highlighted box is the **repeat unit** –CH₂–CH₂–. No other product forms.', 'gold');
    this.check();
  }
  async nylon() {
    if (this.busy) return; this.busy = true; audio.whoosh?.();
    if (this.mol) this.stage.remove(this.mol);
    const g = new THREE.Group(); this.stage.add(g); this.mol = g;
    const A = mat('#60a5fa', 0.1, 0.4), B = mat('#f59e0b', 0.1, 0.4);
    const blocks = [];
    for (let i = 0; i < 6; i++) { const b = mesh(new THREE.BoxGeometry(0.05, 0.022, 0.022), i % 2 ? B : A); b.position.set((i - 2.5) * 0.11, (i % 2 ? 0.06 : -0.05), 0); g.add(b); blocks.push(b); }
    this.nameLbl.userData.set('diamine (blue) + dicarboxylic acid (orange)');
    await tweens.tween(0.8, () => {}).promise;
    const waters = [];
    await Promise.all(blocks.map((b, i) => tweens.to(b.position, { x: (i - 2.5) * 0.056, y: 0 }, 1.2).promise));
    for (let i = 0; i < 5; i++) {
      const w = new THREE.Group(); w.add(mesh(new THREE.SphereGeometry(0.009, 12, 8), mat('#ef4444')), mesh(new THREE.SphereGeometry(0.006, 10, 8), mat('#f8fafc'), 0.009, 0.006, 0), mesh(new THREE.SphereGeometry(0.006, 10, 8), mat('#f8fafc'), -0.009, 0.006, 0));
      w.position.set((i - 2) * 0.056, 0, 0); g.add(w); waters.push(w);
      const link = mesh(new THREE.BoxGeometry(0.008, 0.026, 0.026), mat('#a3e635', 0.1, 0.4)); link.position.set((i - 2) * 0.056, 0, 0); g.add(link);
    }
    await Promise.all(waters.map((w, i) => tweens.to(w.position, { y: 0.09 + (i % 2) * 0.02, z: 0.05 }, 1.4, { ease: ease.out || ease.inOut }).promise));
    this.nameLbl.userData.set('nylon (a polyamide) + water');
    audio.success(); this.busy = false;
    this.st.done(3);
    this.ui.note('**Condensation polymerisation:** each amide link (green) forms as a **water molecule** is released. Nylon’s repeat unit: –[CO–(CH₂)₄–CO–NH–(CH₂)₆–NH]–.', 'gold');
    this.check();
  }
  check() { this.st.check(); }
}
