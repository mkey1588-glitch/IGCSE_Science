import * as THREE from 'three';
import { Holo, hm, hmesh, tube } from '../holo.js';
import { mulberry32 } from '../../core/util.js';

const FLOWS = [
  { id: 'photo', from: [0, 0.55, 0], to: [-0.25, 0.12, 0.05], col: '#22c55e', label: 'photosynthesis' },
  { id: 'resp_p', from: [-0.22, 0.15, 0.05], to: [-0.05, 0.55, 0], col: '#f8fafc', label: 'respiration (plants)' },
  { id: 'feed', from: [-0.22, 0.05, 0.08], to: [0.02, 0.04, 0.12], col: '#f59e0b', label: 'feeding' },
  { id: 'resp_a', from: [0.04, 0.08, 0.12], to: [0.08, 0.55, 0], col: '#f8fafc', label: 'respiration (animals)' },
  { id: 'death', from: [0.0, 0.02, 0.1], to: [-0.05, -0.1, 0.12], col: '#a16207', label: 'death & waste' },
  { id: 'decomp', from: [-0.05, -0.1, 0.12], to: [0.15, 0.55, 0], col: '#f8fafc', label: 'decomposers respire' },
  { id: 'fossil', from: [-0.05, -0.14, 0.1], to: [0.25, -0.3, 0], col: '#57534e', label: 'fossilisation (millions of years)' },
  { id: 'burn', from: [0.32, -0.05, 0.02], to: [0.3, 0.55, 0], col: '#ef4444', label: 'combustion' },
  { id: 'ocean', from: [-0.35, 0.55, 0], to: [-0.45, -0.05, -0.05], col: '#38bdf8', label: 'dissolves in oceans' },
];

export default class Carbon extends Holo {
  constructor(...a) {
    super(...a);
    this.scenario = 'Every carbon atom in Ravi’s lettuces, the market’s diesel and your own body has been round the carbon cycle. Follow the atoms — and see what deforestation does.';
    this.view = { pos: [0, 1.3, 2.3], target: [0, 1.15, 0] };
    this.cut = 0; this.focus = null; this.co2 = 1;
  }
  build() {
    const s = this.stage(1.15, 1.1); const rnd = mulberry32(21);
    s.add(hmesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 48), hm('#4d7c0f', { glow: 0.15 }), 0, 0, 0));
    s.add(hmesh(new THREE.CylinderGeometry(0.55, 0.55, 0.35, 48, 1, true), hm('#78350f', { opacity: 0.3, side: THREE.DoubleSide }), 0, -0.2, 0));
    this.coal = hmesh(new THREE.BoxGeometry(0.35, 0.06, 0.2), hm('#1c1917', { glow: 0.1 }), 0.25, -0.3, 0); s.add(this.coal);
    s.add(hmesh(new THREE.SphereGeometry(0.06, 16, 10), hm('#422006', { glow: 0.2 }), 0.1, -0.28, -0.1));
    const sea = hmesh(new THREE.CylinderGeometry(0.2, 0.2, 0.065, 32, 1, false, Math.PI * 0.75, Math.PI * 0.5), hm('#0ea5e9', { opacity: 0.8, glow: 0.3 }), -0.38, 0.0, -0.05); s.add(sea);
    this.atm = hmesh(new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.2), hm('#e2e8f0', { opacity: 0.08, glow: 0.3, side: THREE.DoubleSide }), 0, 0.03, 0); s.add(this.atm);
    this.trees = []; for (let i = 0; i < 12; i++) { const t = new THREE.Group(); t.add(hmesh(new THREE.CylinderGeometry(0.008, 0.01, 0.08, 6), hm('#78350f'), 0, 0.04, 0), hmesh(new THREE.ConeGeometry(0.04, 0.12, 8), hm('#15803d', { glow: 0.2 }), 0, 0.13, 0)); t.position.set(-0.35 + rnd() * 0.25, 0.03, -0.25 + rnd() * 0.45); s.add(t); this.trees.push(t); }
    this.cow = new THREE.Group(); this.cow.add(hmesh(new THREE.BoxGeometry(0.07, 0.035, 0.035), hm('#f8fafc')), hmesh(new THREE.BoxGeometry(0.025, 0.025, 0.025), hm('#111827'), 0.045, 0.01, 0)); this.cow.position.set(0.03, 0.065, 0.13); s.add(this.cow);
    for (let i = 0; i < 6; i++) s.add(hmesh(new THREE.SphereGeometry(0.012, 8, 6), hm('#fde68a', { glow: 0.3 }), -0.08 + i * 0.015, -0.1, 0.13 + (i % 2) * 0.01));
    const fac = new THREE.Group(); fac.position.set(0.32, 0.03, 0.02); s.add(fac);
    fac.add(hmesh(new THREE.BoxGeometry(0.1, 0.06, 0.08), hm('#94a3b8'), 0, 0.03, 0), hmesh(new THREE.CylinderGeometry(0.01, 0.012, 0.14, 8), hm('#64748b'), 0.03, 0.1, 0));
    this.fire = hmesh(new THREE.ConeGeometry(0.03, 0.07, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.2), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), -0.3, 0.08, 0.1); this.fire.visible = false; s.add(this.fire);
    // flows: atoms travelling along arcs
    this.flowObjs = FLOWS.map((f) => {
      const a = new THREE.Vector3(...f.from), b = new THREE.Vector3(...f.to), mid = a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.12, 0.08));
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.003, 6), hm(f.col, { opacity: 0.45, glow: 0.6 })); s.add(line);
      const atoms = Array.from({ length: 4 }, (_, i) => { const m = hmesh(new THREE.SphereGeometry(0.01, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(f.col).multiplyScalar(1.6) })); s.add(m); return { m, u: i / 4 }; });
      return { f, curve, line, atoms };
    });
    const H = (id, pos, title, text, ids) => this.hotspot({ id, pos, title, text, ids });
    H('atm', [0, 0.58, 0.05], 'CO₂ in the air', 'The atmosphere’s carbon store: about 0.04% CO₂ — rising because of combustion and deforestation.', ['B18.3.1', 'C10.2.1']);
    H('photo', [-0.14, 0.38, 0.08], 'Photosynthesis', 'Plants take CO₂ **out** of the air and turn it into glucose and other carbon compounds.', ['B18.3.1']);
    H('resp', [0.02, 0.38, 0.12], 'Respiration', 'Plants, animals and decomposers all release CO₂ back **into** the air when they respire.', ['B18.3.1']);
    H('feed', [-0.1, 0.12, 0.14], 'Feeding', 'Carbon compounds pass along food chains when animals eat plants (and each other).', ['B18.3.1']);
    H('decomp', [-0.05, -0.08, 0.16], 'Decomposers', 'Bacteria and fungi break down dead organisms and waste, respiring and releasing CO₂.', ['B18.3.1']);
    H('fossil', [0.25, -0.26, 0.12], 'Fossil fuels', 'Over millions of years, buried remains form coal, oil and natural gas — carbon locked away.', ['B18.3.1', 'C11.3.1']);
    H('burn', [0.34, 0.2, 0.05], 'Combustion', 'Burning fossil fuels returns that ancient carbon to the air as CO₂ — very quickly.', ['B18.3.1', 'C10.2.2']);
    H('defor', [-0.3, 0.25, -0.1], 'Deforestation', 'Cutting and burning forests: less photosynthesis, more CO₂ released, loss of **biodiversity** and habitats, soil erosion and flooding.', ['B19.1.2', 'B19.1.3', 'B19.1.4', 'B19.1.5']);
    H('ocean', [-0.45, 0.05, 0.05], 'Oceans', 'CO₂ dissolves in sea water. As more dissolves, the sea becomes more acidic — harmful to coral reefs.', ['C10.2.3']);
    H('conserve', [-0.2, 0.05, -0.3], 'Conservation', 'Species become endangered through **habitat loss**, hunting, pollution, introduced species and climate change. Conservation: **monitoring and protecting** species and habitats, **education**, **captive breeding** and **seed banks** — and replanting forests.', ['B19.2.1', 'B19.2.2']);
    this.story([
      { title: 'A balanced cycle', text: 'For thousands of years, photosynthesis removed about as much CO₂ as respiration and decomposition put back.', apply: () => { this.cut = 0; this.focus = null; this.fire.visible = false; } },
      { title: 'Into living things', text: 'Photosynthesis → feeding: carbon moves into plants, then animals.', apply: () => { this.focus = ['photo', 'feed']; } },
      { title: 'Back to the air', text: 'Respiration by plants, animals and **decomposers** returns CO₂.', apply: () => { this.focus = ['resp_p', 'resp_a', 'decomp', 'death']; } },
      { title: 'The fossil shortcut', text: 'Carbon locked away for millions of years is returned in decades by **combustion**.', apply: () => { this.focus = ['fossil', 'burn']; } },
      { title: 'Deforestation', text: 'Forests are cleared and burned: photosynthesis falls, CO₂ rises — and habitats, species and soil are lost.', apply: () => { this.focus = null; this.cut = 1; this.fire.visible = true; } },
    ]);
    this.finish({ intro: 'Glowing atoms follow each process. Step 5 clears the forest.', sub: 'B18.3', questions: [
      { q: 'Which process **removes** CO₂ from the atmosphere?', opts: ['Photosynthesis', 'Respiration', 'Combustion', 'Decomposition'], e: 'All the others release CO₂.', o: [1] },
      { q: 'How do decomposers return carbon to the air?', opts: ['They respire as they break down dead material', 'They photosynthesise', 'They burn it', 'They eat CO₂'], e: 'Bacteria and fungi are decomposers.', o: [1] },
      { q: 'Which is **not** an effect of deforestation?', opts: ['More oxygen in the air', 'Loss of biodiversity', 'Soil erosion and flooding', 'More CO₂ in the atmosphere'], e: 'Fewer trees means less photosynthesis.', o: [4], sub: 'B19.1' },
    ] });
  }
  animate(dt, t) {
    this.trees.forEach((tr, i) => { const gone = this.cut && i % 3 !== 0; tr.scale.y += ((gone ? 0.01 : 1) - tr.scale.y) * dt * 2; });
    for (const fo of this.flowObjs) {
      let rate = 0.18; if (this.cut && fo.f.id === 'photo') rate = 0.05; if (this.cut && fo.f.id === 'burn') rate = 0.35;
      const dim = this.focus && !this.focus.includes(fo.f.id); fo.line.material.opacity = dim ? 0.1 : 0.5;
      fo.atoms.forEach((a) => { a.u = (a.u + dt * rate) % 1; a.m.position.copy(fo.curve.getPointAt(a.u)); a.m.visible = !dim; });
    }
    this.fire.scale.y = 1 + Math.sin(t * 20) * 0.1;
    this.atm.material.opacity = 0.08 + this.cut * 0.08;
  }
}
