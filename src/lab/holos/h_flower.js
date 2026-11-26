import * as THREE from 'three';
import { Holo, hm, hmesh, tube } from '../holo.js';

export default class Flower extends Holo {
  constructor(...a) {
    super(...a);
    this.scenario = 'The island’s bees are disappearing and the pumpkin harvest is failing. See exactly what bees do inside a flower — and how grasses manage without them.';
    this.view = { pos: [0.15, 1.45, 2.2], target: [0.15, 1.2, 0] };
    this.beeT = 0; this.tubeT = 0; this.mode = 'idle';
  }
  build() {
    const s = this.stage(1.15, 1.2);
    const fl = (this.fl = new THREE.Group()); s.add(fl);
    fl.add(tube([[0, -0.5, 0], [0, -0.2, 0], [0, -0.06, 0]], 0.018, hm('#4d7c0f')));
    for (let i = 0; i < 5; i++) { const g = new THREE.Group(); g.rotation.y = (i / 5) * Math.PI * 2; fl.add(g); const sp = hmesh(new THREE.SphereGeometry(0.08, 16, 10), hm('#65a30d', { glow: 0.15 }), 0.07, -0.07, 0); sp.scale.set(1, 0.18, 0.45); sp.rotation.z = -0.5; g.add(sp); }
    for (let i = 0; i < 5; i++) { const g = new THREE.Group(); g.rotation.y = (i / 5) * Math.PI * 2 + 0.6; fl.add(g); const pt = hmesh(new THREE.SphereGeometry(0.14, 24, 14), hm('#f472b6', { glow: 0.3, opacity: 0.85, side: THREE.DoubleSide }), 0.14, 0.02, 0); pt.scale.set(1, 0.1, 0.55); pt.rotation.z = 0.35; g.add(pt); }
    // carpel: ovary + style + stigma; ovules inside
    this.ovary = hmesh(new THREE.SphereGeometry(0.045, 20, 16), hm('#a3e635', { opacity: 0.55, glow: 0.3 }), 0, -0.01, 0); this.ovary.scale.y = 1.2; fl.add(this.ovary);
    this.ovules = []; for (let i = 0; i < 4; i++) { const o = hmesh(new THREE.SphereGeometry(0.009, 10, 8), hm('#fef08a', { glow: 0.5 }), Math.cos(i * 1.6) * 0.018, -0.02 + (i % 2) * 0.02, Math.sin(i * 1.6) * 0.018); fl.add(o); this.ovules.push(o); }
    fl.add(tube([[0, 0.03, 0], [0, 0.16, 0]], 0.007, hm('#bef264', { glow: 0.3 })));
    this.stigma = hmesh(new THREE.SphereGeometry(0.018, 14, 10), hm('#84cc16', { glow: 0.4 }), 0, 0.17, 0); fl.add(this.stigma);
    this.nectary = hmesh(new THREE.TorusGeometry(0.05, 0.008, 8, 24), hm('#fbbf24', { glow: 0.5 }), 0, -0.04, 0); this.nectary.rotation.x = Math.PI / 2; fl.add(this.nectary);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; fl.add(tube([[Math.cos(a) * 0.04, -0.02, Math.sin(a) * 0.04], [Math.cos(a) * 0.07, 0.07, Math.sin(a) * 0.07], [Math.cos(a) * 0.08, 0.12, Math.sin(a) * 0.08]], 0.003, hm('#fef3c7'))); fl.add(hmesh(new THREE.CapsuleGeometry(0.009, 0.02, 4, 8), hm('#f59e0b', { glow: 0.4 }), Math.cos(a) * 0.08, 0.13, Math.sin(a) * 0.08)); }
    this.pollenTube = tube([[0, 0.17, 0], [0, 0.03, 0], [0.01, -0.01, 0.012]], 0.003, hm('#fde047', { glow: 1.2 }), 20); this.pollenTube.visible = false; fl.add(this.pollenTube);
    // bee
    const bee = (this.bee = new THREE.Group()); s.add(bee);
    bee.add(hmesh(new THREE.SphereGeometry(0.03, 14, 10), hm('#facc15', { glow: 0.3 })), hmesh(new THREE.SphereGeometry(0.02, 12, 8), hm('#111827'), 0.035, 0, 0));
    for (const z of [-0.02, 0.02]) { const w = hmesh(new THREE.SphereGeometry(0.03, 10, 6), hm('#e0f2fe', { opacity: 0.5 }), 0, 0.025, z); w.scale.set(1, 0.1, 0.6); bee.add(w); }
    this.pollenOnBee = hmesh(new THREE.SphereGeometry(0.01, 8, 6), hm('#f59e0b', { glow: 0.6 }), -0.01, -0.025, 0); this.pollenOnBee.visible = false; bee.add(this.pollenOnBee);
    bee.position.set(0.45, 0.35, 0.1);
    // wind-pollinated grass
    const gr = (this.grass = new THREE.Group()); gr.position.set(0.55, -0.25, -0.1); s.add(gr);
    gr.add(tube([[0, -0.25, 0], [0.01, 0.05, 0], [0.02, 0.3, 0]], 0.006, hm('#84cc16')));
    this.grAnthers = []; for (let i = 0; i < 6; i++) { const y = 0.12 + i * 0.03; const a = hmesh(new THREE.CapsuleGeometry(0.006, 0.02, 4, 6), hm('#eab308', { glow: 0.3 }), 0.045 * (i % 2 ? 1 : -1), y - 0.03, 0); gr.add(tube([[0.015, y, 0], [0.045 * (i % 2 ? 1 : -1), y - 0.02, 0]], 0.0015, hm('#fef3c7'))); gr.add(a); this.grAnthers.push(a); }
    for (const sd of [-1, 1]) gr.add(tube([[0.02, 0.27, 0], [0.05 * sd, 0.3, 0.02], [0.07 * sd, 0.33, 0.0]], 0.004, hm('#f8fafc', { glow: 0.5 })));
    this.lab.label(gr, 'Wind-pollinated grass', { y: 0.4, cls: 'dimlab' });
    this.pollen = new THREE.InstancedMesh(new THREE.SphereGeometry(0.004, 6, 4), new THREE.MeshBasicMaterial({ color: '#fde047' }), 40); this.pollen.frustumCulled = false; gr.add(this.pollen); this.pp = Array.from({ length: 40 }, () => ({ x: 0, y: 0.15, z: 0, vx: 0.05 + Math.random() * 0.08, vy: (Math.random() - 0.3) * 0.05, z0: (Math.random() - 0.5) * 0.1, t: Math.random() * 3 }));
    const H = (id, pos, title, text, ids) => this.hotspot({ id, pos, title, text, ids });
    H('sepal', [0.12, -0.12, 0.06], 'Sepals', 'Protect the flower while it is a bud.', ['B15.3.1', 'B15.3.2']);
    H('petal', [-0.2, 0.06, 0.1], 'Petals', 'Large, brightly coloured and often scented — they **attract insects**.', ['B15.3.1', 'B15.3.2', 'B15.3.5']);
    H('anther', [0.09, 0.16, 0.06], 'Stamen: anther & filament', 'The **anther** makes **pollen** (male gametes); the **filament** holds it up.', ['B15.3.1', 'B15.3.2']);
    H('stigma', [0, 0.21, 0.02], 'Stigma', 'Sticky surface that **receives pollen**. Part of the carpel with the style and ovary.', ['B15.3.1', 'B15.3.2']);
    H('style', [0.02, 0.1, 0.03], 'Style', 'Connects the stigma to the ovary; the **pollen tube** grows down it.', ['B15.3.2']);
    H('ovary', [0.05, -0.02, 0.04], 'Ovary & ovules', 'The **ovary** contains **ovules**, each with a female gamete. After fertilisation ovules become **seeds** and the ovary becomes the **fruit**.', ['B15.3.1', 'B15.3.2', 'B15.3.4']);
    H('nectary', [-0.06, -0.05, 0.05], 'Nectary', 'Makes sugary nectar — the bee’s reward for visiting.', ['B15.3.5']);
    H('grassanther', [0.6, -0.08, -0.06], 'Wind-pollinated anthers (S)', 'Hang **outside** the flower on long filaments so the wind blows away huge amounts of light, smooth pollen. No petals, scent or nectar.', ['B15.3.5', 'B15.3.7']);
    H('grassstigma', [0.62, 0.08, -0.08], 'Feathery stigmas (S)', 'Large, **feathery** stigmas hang outside to **catch** pollen grains from the air.', ['B15.3.5', 'B15.3.7']);
    this.story([
      { title: 'A flower’s parts', text: 'Male parts: **stamens** (anther + filament). Female parts: the **carpel** (stigma + style + ovary).', apply: () => { this.mode = 'idle'; } },
      { title: 'Pollination', text: 'A bee collecting nectar brushes against the anthers and picks up pollen; at the next flower some pollen sticks to the **stigma**. Pollination = transfer of pollen from anther to stigma.', apply: () => { this.mode = 'bee'; this.beeT = 0; } },
      { title: 'Pollen tube', text: 'A **pollen tube** grows from the pollen grain down through the style to an ovule.', apply: () => { this.mode = 'tube'; this.tubeT = 0; } },
      { title: 'Fertilisation', text: 'The pollen nucleus **fuses** with the ovule nucleus. The ovule develops into a **seed**; the ovary becomes the **fruit** (like a pumpkin!).', apply: () => { this.mode = 'fert'; } },
      { title: 'Wind pollination', text: 'Grasses don’t need insects: anthers and feathery stigmas hang outside, and enormous amounts of light pollen blow on the wind.', apply: () => { this.mode = 'wind'; } },
    ]);
    this.finish({
      intro: 'An insect-pollinated flower (left) and a wind-pollinated grass (right). Step through pollination and fertilisation.',
      sub: 'B15.3',
      questions: [
        { q: '**Pollination** is…', opts: ['the transfer of pollen from an anther to a stigma', 'the fusion of male and female nuclei', 'the growth of a seed', 'the making of nectar'], e: 'Fertilisation happens later, inside the ovule.', o: [3] },
        { q: 'Which part of the flower becomes the **seed**?', opts: ['The ovule', 'The petal', 'The anther', 'The stigma'], e: 'The ovary becomes the fruit.', o: [2, 4] },
        { q: 'A wind-pollinated flower usually has…', opts: ['small dull petals (or none), feathery stigmas and anthers hanging outside', 'large scented petals and nectar', 'sticky heavy pollen', 'anthers hidden inside'], e: 'No need to attract insects.', o: [5] },
      ],
    });
  }
  animate(dt, t) {
    this.bee.children.slice(2, 4).forEach((w, i) => { w.rotation.x = Math.sin(t * 60 + i * Math.PI) * 0.6; });
    if (this.mode === 'bee') {
      this.beeT = Math.min(1, this.beeT + dt * 0.3);
      const a = this.beeT * Math.PI * 2; this.bee.position.set(0.45 * Math.cos(a) * (1 - this.beeT * 0.6), 0.2 + 0.15 * Math.cos(a), 0.12 + 0.1 * Math.sin(a));
      if (this.beeT > 0.5) this.pollenOnBee.visible = true; if (this.beeT >= 1) { this.bee.position.set(0.02, 0.22, 0.03); this.stigma.material.color.set('#facc15'); }
    } else if (this.mode !== 'idle' && this.mode !== 'bee') { this.bee.position.lerp(new THREE.Vector3(0.45, 0.35, 0.1), dt); }
    if (this.mode === 'tube' || this.mode === 'fert') { this.pollenTube.visible = true; this.tubeT = Math.min(1, this.tubeT + dt * 0.4); this.pollenTube.scale.y = this.mode === 'fert' ? 1 : this.tubeT; this.pollenTube.position.y = 0.17 * (1 - this.pollenTube.scale.y); }
    else this.pollenTube.visible = false;
    if (this.mode === 'fert') { this.ovules[0].material.emissiveIntensity = 2 + Math.sin(t * 6); this.ovary.scale.setScalar(1 + Math.min(0.3, (this.fertT = (this.fertT || 0) + dt * 0.05))); }
    const o = new THREE.Object3D();
    this.pp.forEach((p, i) => { p.t += dt * (this.mode === 'wind' ? 1 : 0.2); const k = p.t % 3; o.position.set(0.04 + k * p.vx, 0.15 + k * p.vy, p.z0 * k); o.updateMatrix(); this.pollen.setMatrixAt(i, o.matrix); });
    this.pollen.instanceMatrix.needsUpdate = true; this.pollen.visible = this.mode === 'wind' || this.mode === 'idle';
    this.grAnthers.forEach((a, i) => { a.position.x += Math.sin(t * 2 + i) * 0.0003; });
  }
}
