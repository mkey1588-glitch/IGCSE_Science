import * as THREE from 'three';
import { Holo, hm, hmesh, tube } from '../holo.js';
import { mulberry32 } from '../../core/util.js';

export default class Leaf extends Holo {
  constructor(...a) {
    super(...a);
    this.scenario = 'Ravi’s greenhouse lettuces are wilting and pale. Zoom inside a leaf to see the factory where photosynthesis happens.';
    this.view = { pos: [0.3, 1.55, 1.9], target: [0, 1.18, 0] };
    this.open = 1;
  }
  build() {
    const s = this.stage(1.2, 1.25); const rnd = mulberry32(11);
    const W = 0.7, D = 0.4;
    s.add(hmesh(new THREE.BoxGeometry(W, 0.012, D), hm('#d9f99d', { opacity: 0.35, glow: 0.4 }), 0, 0.2, 0));
    const epi = (y) => { for (let i = 0; i < 14; i++) for (let j = 0; j < 8; j++) s.add(hmesh(new THREE.BoxGeometry(W / 14 - 0.004, 0.03, D / 8 - 0.004), hm('#bbf7d0', { opacity: 0.7, glow: 0.15 }), -W / 2 + (i + 0.5) * (W / 14), y, -D / 2 + (j + 0.5) * (D / 8))); };
    epi(0.175); epi(-0.175);
    const chl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.006, 6, 5), hm('#16a34a', { glow: 0.5 }), 1400); let n = 0; const o = new THREE.Object3D();
    for (let i = 0; i < 16; i++) for (let j = 0; j < 9; j++) {
      const x = -W / 2 + (i + 0.5) * (W / 16), z = -D / 2 + (j + 0.5) * (D / 9);
      s.add(hmesh(new THREE.CapsuleGeometry(0.017, 0.09, 4, 10), hm('#4ade80', { opacity: 0.55, glow: 0.2 }), x, 0.085, z));
      for (let k = 0; k < 8; k++) { o.position.set(x + (rnd() - 0.5) * 0.024, 0.04 + rnd() * 0.09, z + (rnd() - 0.5) * 0.024); o.updateMatrix(); chl.setMatrixAt(n++, o.matrix); }
    }
    for (let i = 0; i < 60; i++) { const x = (rnd() - 0.5) * W * 0.95, z = (rnd() - 0.5) * D * 0.95, y = -0.07 - rnd() * 0.07; s.add(hmesh(new THREE.SphereGeometry(0.03 + rnd() * 0.012, 12, 10), hm('#86efac', { opacity: 0.5, glow: 0.2 }), x, y, z)); for (let k = 0; k < 3; k++) { o.position.set(x + (rnd() - 0.5) * 0.03, y + (rnd() - 0.5) * 0.03, z + (rnd() - 0.5) * 0.03); o.updateMatrix(); chl.setMatrixAt(n++, o.matrix); } }
    chl.count = n; s.add(chl);
    // vein with xylem and phloem
    s.add(tube([[-W / 2, -0.03, 0.0], [W / 2, -0.03, 0.0]], 0.04, hm('#a3e635', { opacity: 0.35, glow: 0.2 })));
    s.add(tube([[-W / 2, -0.015, 0.0], [W / 2, -0.015, 0.0]], 0.016, hm('#60a5fa', { glow: 0.4 })), tube([[-W / 2, -0.05, 0.0], [W / 2, -0.05, 0.0]], 0.012, hm('#f59e0b', { glow: 0.4 })));
    // stomata with guard cells on the lower surface
    this.guards = [];
    for (let i = 0; i < 4; i++) { const g = new THREE.Group(); g.position.set(-0.24 + i * 0.16, -0.193, 0.12 - (i % 2) * 0.24); s.add(g); for (const sd of [-1, 1]) { const gc = hmesh(new THREE.CapsuleGeometry(0.008, 0.03, 4, 8), hm('#22c55e', { glow: 0.4 }), sd * 0.012, 0, 0); gc.rotation.x = Math.PI / 2; g.add(gc); this.guards.push({ gc, sd }); } }
    // gas particles
    this.gas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.006, 6, 5), new THREE.MeshBasicMaterial({ color: '#fff' }), 40); this.gas.frustumCulled = false; s.add(this.gas);
    this.gp = Array.from({ length: 40 }, (_, i) => ({ u: Math.random(), k: i % 3, x: -0.24 + (i % 4) * 0.16, z: 0.12 - ((i % 4) % 2) * 0.24 })); this._c = new THREE.Color();
    this.rays = new THREE.Group(); s.add(this.rays);
    for (let i = 0; i < 6; i++) this.rays.add(hmesh(new THREE.CylinderGeometry(0.003, 0.003, 0.22, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 0.6), transparent: true, opacity: 0.5 }), -0.25 + i * 0.1, 0.33, -0.05 + (i % 2) * 0.1));
    const H = (id, pos, title, text, ids) => this.hotspot({ id, pos, title, text, ids });
    H('cuticle', [0.3, 0.215, 0.18], 'Waxy cuticle', 'Transparent, waterproof layer: lets light through and reduces water loss.', ['B6.2.2', 'B6.2.3']);
    H('upper', [-0.3, 0.18, 0.2], 'Upper epidermis', 'Thin and transparent — light passes straight through to the palisade.', ['B6.2.2', 'B6.2.3']);
    H('palisade', [0.1, 0.1, 0.2], 'Palisade mesophyll', 'Tall cells packed with **chloroplasts**, near the top surface to absorb the most light. Most photosynthesis happens here.', ['B6.2.2', 'B6.2.3', 'B6.1.1', 'B6.1.2']);
    H('chloroplast', [-0.15, 0.12, 0.2], 'Chloroplasts', 'Contain **chlorophyll**, which absorbs light energy to make glucose from carbon dioxide and water. (S) It transfers light energy into chemical energy.', ['B6.1.3', 'B6.1.6']);
    H('spongy', [0.22, -0.1, 0.2], 'Spongy mesophyll & air spaces', 'Loosely packed cells with **air spaces**, so CO₂ can diffuse quickly to every cell.', ['B6.2.2', 'B6.2.3']);
    H('stomata', [-0.24, -0.21, 0.12], 'Stomata', 'Pores mostly on the lower surface: CO₂ diffuses **in**, O₂ and water vapour diffuse **out**.', ['B6.2.2', 'B6.2.3']);
    H('guard', [0.08, -0.21, -0.12], 'Guard cells', 'Open the stoma in light and close it in the dark or drought, controlling gas exchange and water loss.', ['B6.2.2']);
    H('xylem', [0.33, -0.015, 0.03], 'Xylem', 'Brings **water** and mineral ions (like magnesium for chlorophyll) to the leaf.', ['B6.2.2', 'B8.1.1', 'B6.1.8']);
    H('phloem', [0.33, -0.05, -0.03], 'Phloem', 'Carries away **sucrose** made from the glucose of photosynthesis.', ['B6.2.2', 'B8.1.1']);
    H('thin', [-0.34, 0.24, -0.18], 'Thin, broad leaf', 'A **large surface area** traps light; **thin** so gases diffuse a short distance.', ['B6.2.1']);
    this.story([
      { title: 'Light', text: 'Sunlight passes through the transparent cuticle and epidermis and is absorbed by chlorophyll in the palisade layer.', apply: () => { this.open = 1; this.rays.visible = true; } },
      { title: 'Carbon dioxide in', text: 'CO₂ diffuses in through open **stomata**, through the air spaces, and into the mesophyll cells.', apply: () => { this.open = 1; } },
      { title: 'Water and minerals', text: '**Xylem** in the vein delivers water; (S) magnesium ions are needed to make chlorophyll and nitrate ions to make amino acids.', apply: () => { this.open = 1; } },
      { title: 'Products', text: 'carbon dioxide + water → glucose + oxygen. O₂ diffuses out of the stomata; sugars leave in the **phloem**.', apply: () => { this.open = 1; } },
      { title: 'Night or drought', text: 'Guard cells close the stomata: water loss falls, but CO₂ can no longer enter — photosynthesis slows.', apply: () => { this.open = 0; this.rays.visible = false; } },
    ]);
    this.finish({
      intro: 'A block cut out of a leaf. Light comes from above; stomata are on the lower surface.',
      sub: 'B6.2',
      questions: [
        { q: 'Why are palisade cells near the **upper** surface?', opts: ['To absorb the most light for photosynthesis', 'To store water', 'To make the leaf heavier', 'To let CO₂ escape'], e: 'They are packed with chloroplasts.', o: [2, 3] },
        { q: 'What enters the leaf through the stomata for photosynthesis?', opts: ['Carbon dioxide', 'Oxygen', 'Glucose', 'Water'], e: 'Water arrives through the xylem.', o: [2], sub: 'B6.2' },
        { q: '(S) Why does the spongy mesophyll have air spaces?', opts: ['So gases can diffuse quickly between the stomata and the cells', 'To store sugar', 'To make the leaf float', 'To carry water'], e: 'A large internal surface area for gas exchange.', o: [3] },
      ],
    });
  }
  animate(dt, t) {
    this.guards.forEach(({ gc, sd }) => { gc.position.x = sd * (0.008 + 0.006 * this.open); });
    const o = new THREE.Object3D();
    this.gp.forEach((p, i) => {
      p.u = (p.u + dt * 0.18 * (this.open ? 1 : 0.15)) % 1;
      const up = p.k === 0; // CO2 in (up), O2/water out (down)
      const y = up ? -0.27 + p.u * 0.25 : -0.02 - p.u * 0.25;
      o.position.set(p.x + Math.sin(p.u * 6 + i) * 0.01, y, p.z); o.updateMatrix(); this.gas.setMatrixAt(i, o.matrix); this.gas.setColorAt(i, this._c.set(p.k === 0 ? '#e5e7eb' : p.k === 1 ? '#38bdf8' : '#93c5fd'));
    });
    this.gas.instanceMatrix.needsUpdate = true; if (this.gas.instanceColor) this.gas.instanceColor.needsUpdate = true;
    this.rays.children.forEach((r, i) => { r.material.opacity = 0.35 + Math.sin(t * 2 + i) * 0.15; });
  }
}
