import * as THREE from 'three';
import { Holo, hm, hmesh, tube } from '../holo.js';
import { h } from '../../core/util.js';

export default class Lungs extends Holo {
  constructor(...a) {
    super(...a);
    this.scenario = 'Runners at the Fun Run breathe harder — but why, and how does oxygen actually get into the blood? Explore the breathing system down to a single alveolus.';
    this.view = { pos: [0.15, 1.3, 2.4], target: [0.15, 1.18, 0] };
    this.rate = 14; this.ph = 0; this.depth = 1;
  }
  build() {
    const s = this.stage(1.2, 1.1);
    // ribs
    this.ribs = new THREE.Group(); s.add(this.ribs);
    for (let i = 0; i < 7; i++) {
      const y = 0.25 - i * 0.075, r = 0.26 - Math.abs(i - 2.5) * 0.012;
      const rib = new THREE.Mesh(new THREE.TorusGeometry(r, 0.009, 8, 40, Math.PI * 1.65), hm('#d6d3d1', { glow: 0.05 })); rib.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI * 0.67); rib.position.y = y; rib.scale.set(1, 0.75, 1); this.ribs.add(rib);
      if (i < 6) { const im = hmesh(new THREE.CylinderGeometry(r, r, 0.05, 36, 1, true, Math.PI * 0.2, Math.PI * 0.6), hm('#f43f5e', { opacity: 0.25, side: THREE.DoubleSide }), 0, y - 0.037, 0); im.scale.set(1, 1, 0.75); this.ribs.add(im); }
    }
    // trachea & bronchi
    s.add(tube([[0, 0.55, 0], [0, 0.22, 0]], 0.03, hm('#cbd5e1', { glow: 0.1 })));
    for (let i = 0; i < 8; i++) s.add(hmesh(new THREE.TorusGeometry(0.031, 0.006, 6, 20, Math.PI * 1.6), hm('#cbd5e1'), 0, 0.5 - i * 0.035, 0).rotateX(Math.PI / 2));
    const br = (dir) => { s.add(tube([[0, 0.22, 0], [dir * 0.07, 0.16, 0], [dir * 0.12, 0.08, 0]], 0.02, hm('#e2e8f0', { glow: 0.2 }))); for (let k = 0; k < 6; k++) { const a = -0.8 + k * 0.3; s.add(tube([[dir * 0.12, 0.08, 0], [dir * (0.12 + Math.cos(a) * 0.06), 0.08 + Math.sin(a) * 0.08, 0.02], [dir * (0.14 + Math.cos(a) * 0.1), 0.08 + Math.sin(a) * 0.14, (k % 2 ? 0.03 : -0.03)]], 0.007, hm('#fecdd3', { glow: 0.25 }), 12)); } };
    br(-1); br(1);
    this.lungs = [-1, 1].map((d) => { const l = hmesh(new THREE.SphereGeometry(0.15, 28, 20), hm('#fda4af', { opacity: 0.35, glow: 0.3 }), d * 0.13, 0.03, 0); l.scale.set(0.8, 1.5, 0.9); s.add(l); return l; });
    this.dia = hmesh(new THREE.SphereGeometry(0.27, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), hm('#be123c', { opacity: 0.55, glow: 0.2, side: THREE.DoubleSide }), 0, -0.36, 0); this.dia.scale.set(1, 0.45, 0.8); s.add(this.dia);
    // alveolus close-up
    const al = (this.al = new THREE.Group()); al.position.set(0.58, 0.05, 0); s.add(al);
    for (let i = 0; i < 9; i++) { const a = i * 0.7; al.add(hmesh(new THREE.SphereGeometry(0.045, 18, 14), hm('#fecdd3', { opacity: 0.55, glow: 0.3 }), Math.cos(a) * 0.05 * (i % 3), Math.sin(a) * 0.05 * (i % 3) - 0.02, (i % 2) * 0.03)); }
    al.add(tube([[-0.12, 0.12, 0], [-0.04, 0.05, 0], [0.0, 0.0, 0]], 0.01, hm('#fecdd3')));
    for (let k = 0; k < 4; k++) al.add(tube([[-0.11, -0.1 + k * 0.05, 0.05], [0, -0.06 + k * 0.04, 0.07], [0.11, -0.1 + k * 0.05, 0.05]], 0.006, hm(k % 2 ? '#ef4444' : '#3b82f6', { glow: 0.4 }), 16));
    this.gas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.005, 6, 5), new THREE.MeshBasicMaterial({ color: '#fff' }), 30); this.gas.frustumCulled = false; al.add(this.gas);
    this.gp = Array.from({ length: 30 }, (_, i) => ({ u: Math.random(), o2: i % 2 === 0, x: (Math.random() - 0.5) * 0.06, z: (Math.random() - 0.5) * 0.04 })); this._o = new THREE.Object3D(); this._c = new THREE.Color();
    const H = (id, pos, title, text, ids) => this.hotspot({ id, pos, title, text, ids });
    H('trachea', [0.04, 0.45, 0.03], 'Trachea', 'The windpipe. **Rings of cartilage** keep it open; mucus and cilia trap dust and microbes.', ['B11.1.1']);
    H('bronchi', [-0.08, 0.17, 0.03], 'Bronchi', 'The trachea splits into two bronchi, one to each lung.', ['B11.1.1']);
    H('bronchioles', [0.2, 0.14, 0.05], 'Bronchioles', 'Bronchi branch again and again into thousands of tiny bronchioles ending in air sacs.', ['B11.1.1']);
    H('alveoli', [0.6, 0.12, 0.06], 'Alveoli (S)', 'Gas exchange surface: **huge surface area**, walls **one cell thick**, **moist**, a rich **blood supply** and ventilation keep the concentration gradients steep. O₂ diffuses into the blood; CO₂ diffuses out.', ['B11.1.1', 'B11.1.5']);
    H('capillaries', [0.6, -0.1, 0.08], 'Capillaries', 'Deoxygenated blood (blue) arrives; oxygenated blood (red) leaves for the heart.', ['B11.1.5']);
    H('ribs', [0.24, 0.22, 0.1], 'Ribs', 'Protect the lungs and move up and out when you breathe in, increasing the volume of the chest.', ['B11.1.1']);
    H('intercostal', [-0.24, 0.05, 0.1], 'Intercostal muscles', 'Muscles between the ribs. The external intercostals contract to lift the ribcage during inhalation.', ['B11.1.1']);
    H('diaphragm', [0, -0.3, 0.12], 'Diaphragm', 'A sheet of muscle under the lungs. It **contracts and flattens** when you breathe in, increasing chest volume so air rushes in.', ['B11.1.1']);
    this.story([
      { title: 'Breathing in', text: 'Diaphragm contracts and flattens; external intercostal muscles lift the ribs up and out. Chest volume increases, pressure falls, air flows **in**.', apply: () => { this.rate = 8; this.depth = 1.2; } },
      { title: 'Breathing out', text: 'Diaphragm relaxes and domes up; ribs move down and in. Volume decreases, pressure rises, air flows **out**.', apply: () => { this.rate = 8; this.depth = 1.2; } },
      { title: 'Gas exchange', text: 'In each alveolus oxygen diffuses into the blood and carbon dioxide diffuses out. Expired air has **less O₂, more CO₂** and more water vapour — it turns limewater milky faster.', apply: () => { this.rate = 14; this.depth = 1; } },
      { title: 'Exercise (S)', text: 'Active muscles respire faster and produce more **CO₂**. The brain detects the rise and increases the **rate and depth** of breathing to remove it.', apply: () => { this.rate = 32; this.depth = 1.5; } },
    ]);
    this.extraControls = (ctl) => { const inp = h('input', { type: 'range', min: 8, max: 40, step: 1, value: this.rate }); inp.addEventListener('input', () => { this.rate = +inp.value; }); ctl.append(h('div', { class: 'muted', style: { fontSize: '.85em' } }, 'Breaths per minute'), inp); };
    this.finish({
      intro: 'Watch the ribs and diaphragm move. The close-up on the right shows gases crossing an alveolus wall.',
      sub: 'B11.1',
      questions: [
        { q: 'When you breathe **in**, the diaphragm…', opts: ['contracts and flattens', 'relaxes and domes upwards', 'stays still', 'pushes the ribs down'], e: 'This increases the volume of the chest.', o: [1] },
        { q: 'Compared with inspired air, expired air contains…', opts: ['less oxygen, more carbon dioxide and more water vapour', 'more oxygen', 'less carbon dioxide', 'exactly the same gases'], e: 'Test it: expired air turns limewater milky quickly.', o: [2, 3] },
        { q: '(S) Which feature does **not** help the alveoli exchange gases?', opts: ['A thick wall', 'A large surface area', 'A good blood supply', 'A moist surface'], e: 'Walls are one cell thick for a short diffusion distance.', o: [5] },
      ],
    });
  }
  animate(dt, t) {
    this.ph += dt * this.rate / 60 * Math.PI * 2;
    const b = (Math.sin(this.ph) + 1) / 2 * this.depth;
    this.lungs.forEach((l) => l.scale.set(0.8 + b * 0.1, 1.5 + b * 0.12, 0.9 + b * 0.1));
    this.ribs.position.y = b * 0.02; this.ribs.scale.set(1 + b * 0.04, 1, 1 + b * 0.06);
    this.dia.position.y = -0.36 - b * 0.05; this.dia.scale.y = 0.45 - b * 0.15;
    this.gp.forEach((p, i) => { p.u = (p.u + dt * 0.25) % 1; const y = p.o2 ? 0.05 - p.u * 0.13 : -0.08 + p.u * 0.13; this._o.position.set(p.x, y, 0.04 + p.z); this._o.updateMatrix(); this.gas.setMatrixAt(i, this._o.matrix); this.gas.setColorAt(i, this._c.set(p.o2 ? '#38bdf8' : '#f8fafc')); });
    this.gas.instanceMatrix.needsUpdate = true; if (this.gas.instanceColor) this.gas.instanceColor.needsUpdate = true;
  }
}
