import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { mesh, mat } from '../apparatus.js';
import { h, clear, TAU } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const ORG = [
  { id: 'algae', name: 'Algae', level: 1, color: '#22c55e', pop: 100 },
  { id: 'pondweed', name: 'Pondweed', level: 1, color: '#16a34a', pop: 100 },
  { id: 'flea', name: 'Water flea', level: 2, color: '#fca5a5', pop: 60 },
  { id: 'larva', name: 'Mayfly larva', level: 2, color: '#a16207', pop: 50 },
  { id: 'snail', name: 'Pond snail', level: 2, color: '#a8a29e', pop: 40 },
  { id: 'minnow', name: 'Minnow', level: 3, color: '#94a3b8', pop: 30 },
  { id: 'frog', name: 'Frog', level: 3, color: '#4d7c0f', pop: 14 },
  { id: 'kingfisher', name: 'Kingfisher', level: 4, color: '#0ea5e9', pop: 4 },
  { id: 'heron', name: 'Heron', level: 4, color: '#64748b', pop: 3 },
  { id: 'fungi', name: 'Fungi & bacteria (decomposers)', level: 0, color: '#f59e0b', pop: 80 },
];
const EDGES = [['algae', 'flea'], ['algae', 'snail'], ['algae', 'larva'], ['pondweed', 'snail'], ['pondweed', 'larva'], ['flea', 'minnow'], ['larva', 'minnow'], ['larva', 'frog'], ['snail', 'frog'], ['minnow', 'kingfisher'], ['minnow', 'heron'], ['frog', 'heron'], ['heron', 'fungi'], ['kingfisher', 'fungi'], ['minnow', 'fungi'], ['algae', 'fungi']];
const key = (a, b) => `${a}>${b}`;

export default class Ecosystem extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Should the festival hold a fishing contest in the woodland pond? Build the pond’s food web, follow the energy and test what overfishing does.';
    this.view = { pos: [0, 1.95, 1.1], target: [0, 0.94, 0.06] };
    this.links = new Set(); this.sel = null; this.pops = Object.fromEntries(ORG.map((o) => [o.id, o.pop]));
  }
  build() {
    const Y = this.Y;
    const pond = mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.03, 48), new THREE.MeshStandardMaterial({ color: '#2b8a9a', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 })); this.lab.add(pond, 0, Y, 0);
    this.nodes = {};
    ORG.forEach((o, i) => {
      const a = (i / ORG.length) * TAU - Math.PI / 2;
      const r = o.id === 'fungi' ? 0 : 0.3;
      const g = new THREE.Group(); this.lab.add(g, Math.cos(a) * r, Y + 0.05, Math.sin(a) * r * 0.75);
      g.add(this.model(o));
      const ring = mesh(new THREE.TorusGeometry(0.045, 0.004, 6, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.5, 0.5) })); ring.rotation.x = Math.PI / 2; ring.position.y = -0.03; g.add(ring);
      g.userData = { o, ring, lbl: this.lab.label(g, `${o.name}`, { y: 0.09 }) };
      this.lab.interactive(g, { tip: `${o.name} — click, then click what eats it`, onClick: () => this.pick(o.id) });
      this.nodes[o.id] = g;
    });
    this.arrows = new THREE.Group(); this.lab.add(this.arrows, 0, 0, 0);
    const ui = this.ui;
    this.st = ui.steps(['Link **eight** feeding relationships (click food, then its consumer)', 'Complete a chain with **four trophic levels**', 'Show the **energy pyramid**', 'Simulate **overfishing** the minnows', 'Answer the analysis questions']);
    ui.text('Arrows show the direction of **energy flow**: from the organism eaten → to the organism that eats it.');
    const sec = ui.section('Food web');
    this.ro = ui.readouts([{ id: 'links', label: 'Links made' }, { id: 'sel', label: 'Selected' }], sec);
    ui.buttons([{ label: '🔺 Show energy pyramid', onClick: () => this.pyramid() }, { label: '🎣 Overfish minnows', kind: 'primary', onClick: () => this.overfish() }, { label: '⟲ Reset populations', onClick: () => this.resetPops() }], sec);
    this.pyr = h('div', { style: { margin: '8px 0' } }); sec.append(this.pyr);
    this.popBox = h('div'); ui.section('Populations').append(this.popBox);
    this.drawPops();
    ui.notes();
    ui.questions([
      { q: 'Which organisms are the **producers** in this pond?', opts: ['Algae and pondweed', 'Water fleas and snails', 'Fungi and bacteria', 'Minnows and frogs'], e: 'Producers make their own food by photosynthesis — the start of every chain.', o: [4], sub: 'B18.2' },
      { q: 'Algae capture 10 000 kJ; the water fleas that eat them gain 1000 kJ. What percentage is transferred?', ans: 10, tol: 0.01, unit: '%', e: '1000 ÷ 10 000 × 100 = 10%.', o: [13], sub: 'B18.2' },
      { q: 'Why do food chains rarely have more than five trophic levels?', opts: ['Energy is lost at every level (respiration, heat, waste), so too little reaches the top', 'Top predators are too big to eat', 'Producers stop growing', 'Decomposers eat the top level'], e: 'Only about 10% passes on each time.', o: [14], sub: 'B18.2' },
      { q: 'If most minnows are caught, what happens first?', opts: ['Water fleas increase and kingfishers decrease', 'Algae increase and herons increase', 'Nothing changes', 'Fungi disappear'], e: 'Fewer predators lets prey multiply; predators that depend on minnows decline.', o: [10], sub: 'B18.2' },
      { q: 'What is the role of the fungi and bacteria?', opts: ['Decomposers: they feed on dead material and recycle nutrients', 'Producers', 'Top predators', 'Herbivores'], e: 'Decomposers return carbon (as CO₂) and minerals to the environment.', o: [9], sub: 'B18.2' },
    ], { sub: 'B18.2', onDone: () => { this.st.done(4); this.check(); } });
  }
  model(o) {
    const g = new THREE.Group(); const m = mat(o.color, 0, 0.6);
    switch (o.id) {
      case 'algae': for (let i = 0; i < 6; i++) g.add(mesh(new THREE.SphereGeometry(0.012, 8, 6), m, Math.cos(i) * 0.02, 0, Math.sin(i) * 0.02)); break;
      case 'pondweed': for (let i = 0; i < 4; i++) { const s = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.08, 5), m, (i - 1.5) * 0.012, 0.03, 0); s.rotation.z = (i - 1.5) * 0.2; g.add(s); } break;
      case 'flea': g.add(mesh(new THREE.SphereGeometry(0.014, 10, 8), m)); break;
      case 'larva': { const b = mesh(new THREE.CapsuleGeometry(0.008, 0.04, 4, 8), m); b.rotation.z = Math.PI / 2; g.add(b); break; }
      case 'snail': g.add(mesh(new THREE.TorusGeometry(0.014, 0.008, 8, 16), m, 0, 0.012, 0), mesh(new THREE.BoxGeometry(0.04, 0.008, 0.012), mat('#d6d3d1'), 0, -0.002, 0)); break;
      case 'minnow': { const b = mesh(new THREE.SphereGeometry(0.02, 12, 8), m); b.scale.set(1.8, 0.7, 0.5); g.add(b, mesh(new THREE.ConeGeometry(0.012, 0.02, 4), m, -0.04, 0, 0).rotateZ(Math.PI / 2)); break; }
      case 'frog': g.add(mesh(new THREE.SphereGeometry(0.022, 12, 10), m), mesh(new THREE.SphereGeometry(0.006, 6, 4), mat('#111'), 0.012, 0.016, 0.01), mesh(new THREE.SphereGeometry(0.006, 6, 4), mat('#111'), 0.012, 0.016, -0.01)); break;
      case 'kingfisher': { const b = mesh(new THREE.SphereGeometry(0.02, 12, 10), m); b.scale.set(1.3, 1, 0.9); g.add(b, mesh(new THREE.SphereGeometry(0.014, 10, 8), mat('#f97316'), 0, -0.008, 0), mesh(new THREE.ConeGeometry(0.005, 0.03, 6), mat('#111'), 0.035, 0.004, 0).rotateZ(-Math.PI / 2)); break; }
      case 'heron': g.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.06, 4), mat('#d6d3d1'), 0, -0.01, 0), mesh(new THREE.SphereGeometry(0.02, 10, 8), m, 0, 0.03, 0), mesh(new THREE.ConeGeometry(0.005, 0.035, 6), mat('#eab308'), 0.03, 0.05, 0).rotateZ(-Math.PI / 2)); break;
      default: g.add(mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.03, 8), mat('#fef3c7'), 0, 0.015, 0), mesh(new THREE.SphereGeometry(0.02, 12, 8, 0, TAU, 0, Math.PI / 2), mat('#dc2626'), 0, 0.03, 0));
    }
    return g;
  }
  pick(id) {
    if (!this.sel) { this.sel = id; this.nodes[id].userData.ring.material.color.setRGB(2.6, 2, 0.5); this.ro.set('sel', ORG.find((o) => o.id === id).name); return; }
    const a = this.sel, b = id; this.sel = null;
    this.nodes[a].userData.ring.material.color.setRGB(0.5, 0.5, 0.5); this.ro.set('sel', '—');
    if (a === b) return;
    const ok = EDGES.some(([x, y]) => x === a && y === b);
    const A = ORG.find((o) => o.id === a), B = ORG.find((o) => o.id === b);
    if (!ok) { audio.fail(); this.ui.note(EDGES.some(([x, y]) => x === b && y === a) ? `Other way round! Energy flows from the food to the eater: ${B.name} → ${A.name}.` : `${B.name} doesn’t feed on ${A.name} in this pond.`, 'warn'); return; }
    if (this.links.has(key(a, b))) return;
    this.links.add(key(a, b));
    this.arrow(this.nodes[a].position, this.nodes[b].position, b === 'fungi');
    audio.connect();
    this.ro.set('links', this.links.size);
    this.ui.note(`${A.name} → ${B.name}${b === 'fungi' ? ' (decomposition)' : ''}`);
    if (this.links.size >= 8) this.st.done(0);
    const chain = ['flea', 'larva'].some((p) => ['algae', 'pondweed'].some((q) => this.links.has(key(q, p))) && this.links.has(key(p, 'minnow'))) && (this.links.has(key('minnow', 'kingfisher')) || this.links.has(key('minnow', 'heron')));
    const chain2 = this.links.has(key('larva', 'frog')) && this.links.has(key('frog', 'heron')) && ['algae', 'pondweed'].some((q) => this.links.has(key(q, 'larva')));
    if ((chain || chain2) && !this.st.isDone(1)) { this.st.done(1); this.ui.note('A four-level chain: **producer → primary consumer → secondary consumer → tertiary consumer**.', 'gold'); }
    this.check();
  }
  arrow(p, q, dashed) {
    const from = p.clone().add(new THREE.Vector3(0, 0.02, 0)), to = q.clone().add(new THREE.Vector3(0, 0.02, 0));
    const dir = to.clone().sub(from); const len = dir.length() - 0.06; dir.normalize();
    const col = dashed ? '#f59e0b' : '#ffd166';
    const shaft = mesh(new THREE.CylinderGeometry(0.003, 0.003, len, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.6) }));
    shaft.position.copy(from).addScaledVector(dir, 0.03 + len / 2); shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const head = mesh(new THREE.ConeGeometry(0.01, 0.025, 10), shaft.material); head.position.copy(from).addScaledVector(dir, 0.03 + len); head.quaternion.copy(shaft.quaternion);
    this.arrows.add(shaft, head);
  }
  pyramid() {
    clear(this.pyr);
    const levels = [['Tertiary consumers', 10, '#0ea5e9'], ['Secondary consumers', 100, '#94a3b8'], ['Primary consumers', 1000, '#fca5a5'], ['Producers', 10000, '#22c55e']];
    for (const [n, e, c] of levels) this.pyr.append(h('div', { style: { margin: '3px auto', width: `${Math.max(12, Math.log10(e) * 25)}%`, background: c, color: '#0b1020', borderRadius: '6px', textAlign: 'center', fontSize: '.78em', fontWeight: 700, padding: '4px 2px' } }, `${n}: ${e.toLocaleString()} kJ`));
    this.pyr.append(h('div', { class: 'faint', style: { fontSize: '.8em', textAlign: 'center' } }, 'About 10% of the energy passes to the next level; the rest is lost as heat, movement and waste.'));
    this.st.done(2); this.check();
  }
  overfish() {
    const steps = 6; let k = 0;
    this.pops.minnow = 4;
    const tick = () => {
      const P = this.pops;
      P.flea = Math.min(160, P.flea * 1.18); P.larva = Math.min(140, P.larva * 1.15);
      P.algae = Math.max(20, P.algae - (P.flea - 60) * 0.25); P.kingfisher = Math.max(0, P.kingfisher - 0.8); P.heron = Math.max(1, P.heron - 0.3); P.frog = Math.min(30, P.frog * 1.06);
      this.drawPops();
      if (++k < steps) setTimeout(tick, 350);
      else { this.ui.note('Overfishing: minnows crash → water fleas and mayfly larvae boom → algae fall → kingfishers starve. Every species is linked.', 'warn'); this.st.done(3); this.check(); }
    };
    audio.splash(); tick();
  }
  resetPops() { this.pops = Object.fromEntries(ORG.map((o) => [o.id, o.pop])); this.drawPops(); }
  drawPops() {
    clear(this.popBox);
    for (const o of ORG) {
      const v = this.pops[o.id], max = o.pop * 1.8;
      this.popBox.append(h('div', { class: 'cov-row', style: { gridTemplateColumns: '120px 1fr 40px', margin: '4px 0' } }, h('span', { class: 'muted', style: { fontSize: '.82em' } }, o.name.split(' (')[0]), h('div', { class: 'bar' }, h('i', { style: { width: `${Math.min(100, (v / max) * 100)}%`, background: o.color } })), h('span', { class: 'faint', style: { fontSize: '.8em' } }, Math.round(v))));
      const g = this.nodes?.[o.id]; if (g) g.scale.setScalar(0.6 + Math.min(1.4, v / o.pop) * 0.4);
    }
  }
  check() { if ([0, 1, 2, 3, 4].every((i) => this.st.isDone(i))) this.lab.complete(); }
  update(dt, t) { Object.values(this.nodes).forEach((g, i) => { g.children[0].position.y = Math.sin(t * 1.5 + i) * 0.005; }); void dt; }
}
