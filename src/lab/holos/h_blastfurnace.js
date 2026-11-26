import * as THREE from 'three';
import { Holo, hm, hmesh, tube } from '../holo.js';
import { mulberry32 } from '../../core/util.js';

export default class BlastFurnace extends Holo {
  constructor(...a) {
    super(...a);
    this.scenario = 'The harbour crane needs new steel. Look inside a blast furnace to see how rock (hematite) becomes molten iron — and why aluminium needs electricity instead.';
    this.view = { pos: [0.1, 1.3, 2.3], target: [0.05, 1.15, 0] };
    this.zone = null;
  }
  build() {
    const s = this.stage(1.15, 1.05); const rnd = mulberry32(6);
    const prof = [[0.12, -0.5], [0.16, -0.45], [0.22, -0.3], [0.26, -0.15], [0.24, 0.05], [0.2, 0.25], [0.15, 0.42], [0.12, 0.5]].map(([r, y]) => new THREE.Vector2(r, y));
    s.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 48, 0, Math.PI * 1.5), hm('#64748b', { opacity: 0.35, side: THREE.DoubleSide, metal: 0.5 })));
    const zone = (y0, y1, col, glow) => { const p = prof.filter((q) => q.y >= y0 - 0.001 && q.y <= y1 + 0.001).map((q) => new THREE.Vector2(q.x - 0.015, q.y)); if (p.length < 2) return null; const m = new THREE.Mesh(new THREE.LatheGeometry(p, 40), hm(col, { glow, opacity: 0.55, side: THREE.DoubleSide })); s.add(m); return m; };
    this.zones = { top: zone(0.25, 0.5, '#7f1d1d', 0.3), mid: zone(-0.15, 0.25, '#ea580c', 0.6), bot: zone(-0.45, -0.15, '#fbbf24', 1.2) };
    this.iron = hmesh(new THREE.CylinderGeometry(0.15, 0.12, 0.05, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.3, 0.3) }), 0, -0.47, 0); s.add(this.iron);
    this.slag = hmesh(new THREE.CylinderGeometry(0.17, 0.15, 0.035, 32), hm('#a8a29e', { glow: 0.8 }), 0, -0.43, 0); s.add(this.slag);
    s.add(tube([[0.14, -0.47, 0.05], [0.26, -0.5, 0.08], [0.35, -0.58, 0.1]], 0.012, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.2) }), 12));
    s.add(tube([[-0.16, -0.43, 0.04], [-0.28, -0.46, 0.06], [-0.36, -0.55, 0.08]], 0.012, hm('#d6d3d1', { glow: 0.6 }), 12));
    for (const sd of [-1, 1]) s.add(tube([[sd * 0.45, -0.3, 0.05], [sd * 0.3, -0.33, 0.04], [sd * 0.2, -0.34, 0.03]], 0.018, hm('#60a5fa', { glow: 0.5 }), 10));
    s.add(hmesh(new THREE.ConeGeometry(0.15, 0.12, 24, 1, true), hm('#475569', { side: THREE.DoubleSide }), 0, 0.58, 0).rotateX(Math.PI));
    s.add(tube([[0.1, 0.5, 0], [0.25, 0.55, 0], [0.35, 0.6, -0.05]], 0.02, hm('#94a3b8'), 10));
    // falling raw materials
    const cols = ['#7c2d12', '#111827', '#f1f5f9'];
    this.ch = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.014), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 90); this.ch.frustumCulled = false; s.add(this.ch);
    this.cp = Array.from({ length: 90 }, (_, i) => ({ k: i % 3, y: 0.5 - rnd() * 0.9, a: rnd() * 6.28, r: rnd() * 0.12 })); this.cp.forEach((p, i) => this.ch.setColorAt(i, new THREE.Color(cols[p.k])));
    this.gas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.01, 6, 5), new THREE.MeshBasicMaterial({ color: '#94a3b8', transparent: true, opacity: 0.6 }), 30); this.gas.frustumCulled = false; s.add(this.gas);
    this.gp = Array.from({ length: 30 }, (_, i) => ({ u: i / 30, z: (rnd() - 0.5) * 0.05 }));
    const H = (id, pos, title, text, ids) => this.hotspot({ id, pos, title, text, ids });
    H('raw', [0.12, 0.62, 0.05], 'Raw materials', 'Added at the top: **hematite** (iron(III) oxide ore), **coke** (carbon) and **limestone** (calcium carbonate).', ['C9.6.2', 'C9.6.4']);
    H('air', [0.4, -0.3, 0.08], 'Hot air blast', 'Hot air is blown in near the bottom. Its oxygen burns the coke.', ['C9.6.4']);
    H('burn', [0.18, -0.25, 0.12], 'Coke burns', '**C + O₂ → CO₂** — very exothermic: the bottom of the furnace reaches about 1500–2000 °C.', ['C9.6.4', 'C5.1.1']);
    H('co', [0.2, -0.02, 0.12], 'Carbon monoxide forms', '**CO₂ + C → 2CO** — carbon monoxide is the reducing agent.', ['C9.6.4']);
    H('reduce', [0.17, 0.2, 0.1], 'Iron oxide is reduced', '**Fe₂O₃ + 3CO → 2Fe + 3CO₂.** Iron(III) oxide **loses oxygen** (reduced); carbon monoxide **gains oxygen** (oxidised) — a **redox** reaction.', ['C9.6.2', 'C9.6.4', 'C6.3.1', 'C6.3.2', 'C6.3.3']);
    H('lime', [-0.2, 0.05, 0.12], 'Limestone decomposes', '**CaCO₃ → CaO + CO₂** (thermal decomposition).', ['C9.6.4']);
    H('slag', [-0.25, -0.42, 0.1], 'Slag', '**CaO + SiO₂ → CaSiO₃.** Calcium oxide (basic) reacts with sandy impurities (silicon dioxide, acidic) to form **slag**, which floats on the iron and is tapped off — used for building roads.', ['C9.6.4', 'C7.2.1']);
    H('iron', [0.3, -0.55, 0.12], 'Molten iron', 'Dense molten iron collects at the bottom and is tapped off. Most is turned into **steel** (an alloy).', ['C9.6.2', 'C9.3.1']);
    H('al', [-0.38, 0.4, 0.05], 'Why not aluminium?', 'Metals **below carbon** in the reactivity series (like iron) can be reduced by carbon. **Aluminium is more reactive than carbon**, so it is extracted from bauxite by **electrolysis**.', ['C9.6.1', 'C9.6.3']);
    this.story([
      { title: 'Charging the furnace', text: 'Hematite, coke and limestone are tipped in at the top and slowly sink through rising hot gases.', apply: () => { this.zone = 'top'; } },
      { title: 'Heat and carbon monoxide', text: 'At the bottom, coke burns in the hot air blast. Higher up, CO₂ reacts with more coke to make **carbon monoxide**.', apply: () => { this.zone = 'bot'; } },
      { title: 'Reduction', text: 'In the middle, CO **reduces** iron(III) oxide to iron — and is itself oxidised to CO₂.', apply: () => { this.zone = 'mid'; } },
      { title: 'Removing impurities', text: 'Limestone decomposes to calcium oxide, which neutralises silicon dioxide to form slag. Iron and slag are tapped off separately.', apply: () => { this.zone = 'bot'; } },
    ]);
    this.finish({ intro: 'A cut-away blast furnace. Red-brown = hematite, black = coke, white = limestone.', sub: 'C9.6', questions: [
      { q: 'In the blast furnace, iron(III) oxide is…', opts: ['reduced by carbon monoxide', 'oxidised by oxygen', 'electrolysed', 'decomposed by heat alone'], e: 'Fe₂O₃ + 3CO → 2Fe + 3CO₂.', o: [2, 4] },
      { q: 'Why is limestone added?', opts: ['It decomposes to calcium oxide, which removes acidic impurities as slag', 'It is the iron ore', 'It is the fuel', 'It cools the furnace'], e: 'Slag floats on the molten iron.', o: [4] },
      { q: 'Aluminium is extracted by electrolysis instead of with carbon because…', opts: ['aluminium is more reactive than carbon', 'aluminium is less reactive than carbon', 'carbon dissolves aluminium', 'electrolysis is cheaper'], e: 'Position in the reactivity series decides the method.', o: [1, 3] },
    ] });
  }
  animate(dt, t) {
    const o = new THREE.Object3D();
    this.cp.forEach((p, i) => { p.y -= dt * 0.05; if (p.y < -0.38) p.y = 0.5; const w = 0.1 + (0.5 - Math.abs(p.y)) * 0.15; o.position.set(Math.cos(p.a) * p.r * w * 8, p.y, Math.sin(p.a) * p.r * w * 8); o.rotation.set(p.y * 10, p.a, 0); o.scale.setScalar(p.y < -0.1 ? 0.6 : 1); o.updateMatrix(); this.ch.setMatrixAt(i, o.matrix); });
    this.ch.instanceMatrix.needsUpdate = true; if (this.ch.instanceColor) this.ch.instanceColor.needsUpdate = true;
    this.gp.forEach((g, i) => { g.u = (g.u + dt * 0.12) % 1; o.position.set(0.1 + g.u * 0.25, 0.5 + g.u * 0.12, g.z - g.u * 0.05); o.rotation.set(0, 0, 0); o.scale.setScalar(1 + g.u); o.updateMatrix(); this.gas.setMatrixAt(i, o.matrix); });
    this.gas.instanceMatrix.needsUpdate = true;
    for (const [k, m] of Object.entries(this.zones)) if (m) m.material.opacity = this.zone ? (this.zone === k ? 0.85 : 0.25) : 0.55;
    this.iron.material.color.setRGB(3 + Math.sin(t * 3) * 0.3, 1.3, 0.3);
  }
}
