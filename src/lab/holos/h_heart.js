import * as THREE from 'three';
import { Holo, hm, hmesh, tube } from '../holo.js';
import { h } from '../../core/util.js';

const RED = '#ef4444', BLUE = '#3b82f6';

export default class Heart extends Holo {
  constructor(...a) {
    super(...a);
    this.scenario = 'The Fun Run is on Saturday. Look inside the pump that keeps every runner going — and see why exercise makes it beat faster.';
    this.view = { pos: [0.1, 1.35, 2.3], target: [0.1, 1.2, 0] };
    this.bpm = 70; this.beat = 0; this.blocked = false;
  }
  build() {
    const s = this.stage(1.2, 1.15);
    const ch = (col, x, y, sx, sy, sz) => { const m = hmesh(new THREE.SphereGeometry(0.1, 28, 20), hm(col, { glow: 0.25, opacity: 0.88 }), x, y, 0); m.scale.set(sx, sy, sz); s.add(m); return m; };
    this.RA = ch(BLUE, -0.11, 0.12, 0.85, 0.75, 0.8); this.LA = ch(RED, 0.11, 0.13, 0.8, 0.7, 0.8);
    this.RV = ch(BLUE, -0.08, -0.08, 1.05, 1.5, 1.05); this.LV = ch(RED, 0.08, -0.1, 1.15, 1.7, 1.15);
    s.add(hmesh(new THREE.BoxGeometry(0.012, 0.3, 0.16), hm('#fde2e4', { glow: 0.1 }), 0, -0.06, 0));
    const valve = (x, y) => { const v = hmesh(new THREE.CylinderGeometry(0.035, 0.035, 0.008, 18), hm('#f8fafc', { glow: 0.4 }), x, y, 0.02); s.add(v); return v; };
    valve(-0.09, 0.04); valve(0.09, 0.04); valve(0.03, 0.1); valve(-0.03, 0.1);
    const aorta = [[0.03, 0.08, 0], [0.05, 0.3, 0], [-0.02, 0.4, -0.02], [-0.12, 0.34, -0.06], [-0.15, 0.1, -0.12], [-0.15, -0.36, -0.12]];
    s.add(tube(aorta, 0.032, hm(RED, { glow: 0.3 }), 60));
    const pa = [[-0.03, 0.08, 0.05], [-0.01, 0.24, 0.06], [0.14, 0.3, 0.02], [0.32, 0.3, -0.02]];
    s.add(tube(pa, 0.026, hm(BLUE, { glow: 0.3 }), 40), tube([[0.0, 0.25, 0.06], [-0.18, 0.3, 0.03], [-0.34, 0.28, -0.02]], 0.022, hm(BLUE, { glow: 0.3 }), 30));
    s.add(tube([[-0.15, 0.48, 0], [-0.14, 0.32, 0], [-0.12, 0.18, 0]], 0.028, hm('#1d4ed8', { glow: 0.3 }), 20), tube([[-0.14, -0.4, -0.03], [-0.13, -0.15, -0.02], [-0.12, 0.06, 0]], 0.03, hm('#1d4ed8', { glow: 0.3 }), 20));
    s.add(tube([[0.34, 0.18, -0.05], [0.22, 0.16, -0.05], [0.13, 0.14, -0.02]], 0.018, hm('#f87171', { glow: 0.3 }), 20), tube([[-0.34, 0.16, -0.08], [-0.05, 0.2, -0.1], [0.1, 0.15, -0.04]], 0.016, hm('#f87171', { glow: 0.3 }), 30));
    this.coronary = tube([[0.04, 0.08, 0.09], [0.12, 0.0, 0.11], [0.12, -0.15, 0.1], [0.04, -0.28, 0.06]], 0.007, hm('#dc2626', { glow: 0.5 }), 30); s.add(this.coronary);
    this.plaque = hmesh(new THREE.SphereGeometry(0.012, 10, 8), hm('#fde68a', { glow: 0.3 }), 0.12, -0.05, 0.11); this.plaque.visible = false; s.add(this.plaque);
    for (const x of [-0.42, 0.42]) s.add(hmesh(new THREE.SphereGeometry(0.11, 20, 14), hm('#fda4af', { opacity: 0.35, glow: 0.3 }), x, 0.28, -0.04));
    s.add(hmesh(new THREE.BoxGeometry(0.5, 0.08, 0.14), hm('#c084fc', { opacity: 0.35, glow: 0.3 }), 0, -0.5, -0.06));
    // vessel cross-sections
    const vx = new THREE.Group(); vx.position.set(0.62, -0.25, 0); s.add(vx);
    const xs = (y, ro, ri, col, name) => { const g = new THREE.Group(); g.position.y = y; g.add(hmesh(new THREE.CylinderGeometry(ro, ro, 0.05, 28, 1, true), hm(col, { side: THREE.DoubleSide })), hmesh(new THREE.CylinderGeometry(ri, ri, 0.051, 24), hm('#7f1d1d', { glow: 0.3 }))); g.rotation.x = Math.PI / 2; vx.add(g); return g; };
    xs(0.22, 0.05, 0.018, '#fca5a5', 'artery'); xs(0.06, 0.05, 0.04, '#93c5fd', 'vein'); xs(-0.07, 0.012, 0.008, '#fecaca', 'capillary');
    // blood particles around the double circulation
    const loop = [[-0.11, 0.12, 0.04], [-0.08, -0.08, 0.06], [-0.02, 0.1, 0.06], [0.0, 0.26, 0.06], [0.3, 0.3, 0], [0.4, 0.24, 0], [0.3, 0.18, -0.03], [0.12, 0.14, 0.02], [0.08, -0.1, 0.06], [0.04, 0.2, 0.02], [-0.04, 0.4, -0.02], [-0.15, 0.1, -0.12], [-0.12, -0.4, -0.1], [0.12, -0.5, 0], [-0.14, -0.38, -0.02], [-0.13, 0.0, 0.02]];
    this.path = new THREE.CatmullRomCurve3(loop.map((p) => new THREE.Vector3(...p)), true);
    const N = 70; this.cells = new THREE.InstancedMesh(new THREE.SphereGeometry(0.009, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff' }), N); this.cells.frustumCulled = false; s.add(this.cells);
    this.cu = Array.from({ length: N }, (_, i) => i / N); this._o = new THREE.Object3D(); this._c = new THREE.Color();
    const H = (id, pos, title, text, ids) => this.hotspot({ id, pos, title, text, ids });
    H('ra', [-0.17, 0.2, 0.08], 'Right atrium', 'Receives **deoxygenated** blood from the body through the **vena cava**.', ['B9.2.1', 'B9.3.5']);
    H('rv', [-0.14, -0.15, 0.1], 'Right ventricle', 'Pumps deoxygenated blood to the **lungs** through the **pulmonary artery** — a short trip, so its wall is thinner.', ['B9.2.1', 'B9.2.2']);
    H('lv', [0.16, -0.18, 0.1], 'Left ventricle', 'Thickest, most muscular wall: pumps **oxygenated** blood at high pressure through the **aorta** to the whole body.', ['B9.2.1', 'B9.2.2']);
    H('septum', [0, -0.2, 0.09], 'Septum', 'A wall of muscle that keeps oxygenated and deoxygenated blood apart.', ['B9.2.1']);
    H('valves', [0.09, 0.05, 0.08], 'Valves', 'Atrioventricular and semilunar valves make blood flow **one way only**. (S) They snap shut to prevent backflow — the “lub-dub” heart sounds.', ['B9.1.1', 'B9.2.1', 'B9.2.3', 'B9.2.7']);
    H('aorta', [0.0, 0.42, 0], 'Aorta', 'The main **artery**: carries oxygenated blood **away** from the heart to the body.', ['B9.2.2', 'B9.3.5']);
    H('pa', [0.16, 0.33, 0.04], 'Pulmonary artery', 'Carries **deoxygenated** blood from the right ventricle to the lungs (the only artery carrying deoxygenated blood).', ['B9.3.5']);
    H('pv', [0.25, 0.18, -0.02], 'Pulmonary vein', 'Brings **oxygenated** blood from the lungs back to the left atrium.', ['B9.3.5']);
    H('cor', [0.13, -0.02, 0.13], 'Coronary arteries', 'Supply the heart muscle itself with oxygen and glucose. If they are blocked by fatty deposits → **coronary heart disease** (heart attack). Risks: fatty diet, smoking, stress, inactivity.', ['B9.2.1', 'B9.2.5', 'B9.2.6']);
    H('vessels', [0.7, 0.05, 0.05], 'Artery · vein · capillary', '**Arteries**: thick, muscular, elastic walls for high pressure. **Veins**: thin walls, wide lumen, valves. **Capillaries**: one cell thick — exchange of substances with tissues.', ['B9.3.1', 'B9.3.2', 'B9.3.3', 'B9.3.4']);
    H('double', [0, -0.56, 0.06], 'Double circulation (S)', 'Blood passes through the heart **twice** per circuit: heart → lungs → heart → body. This keeps pressure high for the body. A fish has a **single** circulation.', ['B9.1.2', 'B9.1.3', 'B9.1.4']);
    this.story([
      { title: 'Two pumps side by side', text: 'The **right** side pumps blue (deoxygenated) blood to the lungs; the **left** side pumps red (oxygenated) blood to the body.', apply: () => { this.bpm = 70; this.blocked = false; this.plaque.visible = false; } },
      { title: 'Atria contract', text: '(S) Both atria contract together, pushing blood through the open atrioventricular valves into the ventricles.', apply: () => { this.bpm = 40; } },
      { title: 'Ventricles contract', text: '(S) Then the ventricles contract: the AV valves snap shut and blood is forced into the arteries through the semilunar valves.', apply: () => { this.bpm = 40; } },
      { title: 'Exercise', text: 'During the Fun Run, muscles respire faster and need more oxygen and glucose — and must lose more CO₂. (S) So heart rate and stroke volume increase.', apply: () => { this.bpm = 150; } },
      { title: 'Coronary heart disease', text: 'A fatty plaque narrows a coronary artery. Less oxygen reaches the heart muscle → chest pain or a heart attack. A good diet and exercise reduce the risk.', apply: () => { this.bpm = 90; this.blocked = true; this.plaque.visible = true; } },
    ]);
    this.extraControls = (ctl) => { const lbl = h('div', { class: 'muted', style: { fontSize: '.85em' } }, 'Heart rate'); const inp = h('input', { type: 'range', min: 40, max: 180, step: 5, value: this.bpm }); inp.addEventListener('input', () => { this.bpm = +inp.value; }); ctl.append(lbl, inp); };
    this.finish({
      intro: 'Red = oxygenated blood, blue = deoxygenated. Use the heart-rate slider to see the effect of exercise.',
      sub: 'B9.2',
      questions: [
        { q: 'Why is the wall of the **left ventricle** thicker than the right?', opts: ['It pumps blood all around the body at higher pressure', 'It holds more blood', 'It pumps blood to the lungs', 'It receives blood from the body'], e: 'The right ventricle only pumps to the nearby lungs.', o: [1] },
        { q: 'Arteries carry blood…', opts: ['away from the heart', 'towards the heart', 'only to the lungs', 'only to the brain'], e: 'Veins return blood to the heart.', o: [2] },
        { q: '(S) An advantage of a **double** circulation is…', opts: ['blood returns to the heart after the lungs, so it can be pumped to the body at high pressure', 'it needs fewer blood vessels', 'blood never mixes with oxygen', 'the heart can be smaller'], e: 'High pressure delivers oxygen quickly to active tissues.', o: [4], sub: 'B9.1' },
      ],
    });
  }
  animate(dt, t) {
    this.beat += dt * this.bpm / 60;
    const ph = this.beat % 1, atr = ph < 0.15 ? Math.sin((ph / 0.15) * Math.PI) : 0, ven = ph > 0.15 && ph < 0.45 ? Math.sin(((ph - 0.15) / 0.3) * Math.PI) : 0;
    this.RA.scale.set(0.85 - atr * 0.08, 0.75 - atr * 0.08, 0.8 - atr * 0.08); this.LA.scale.set(0.8 - atr * 0.08, 0.7 - atr * 0.08, 0.8 - atr * 0.08);
    this.RV.scale.set(1.05 - ven * 0.1, 1.5 - ven * 0.08, 1.05 - ven * 0.1); this.LV.scale.set(1.15 - ven * 0.1, 1.7 - ven * 0.08, 1.15 - ven * 0.1);
    const sp = (this.bpm / 70) * 0.06 * dt;
    this.cu = this.cu.map((u) => (u + sp) % 1);
    this.cu.forEach((u, i) => { this._o.position.copy(this.path.getPointAt(u)); this._o.updateMatrix(); this.cells.setMatrixAt(i, this._o.matrix); this.cells.setColorAt(i, this._c.set(u > 0.27 && u < 0.78 ? '#ef4444' : '#3b82f6')); });
    this.cells.instanceMatrix.needsUpdate = true; if (this.cells.instanceColor) this.cells.instanceColor.needsUpdate = true;
    if (this.blocked) this.coronary.material.emissiveIntensity = 0.3 + Math.sin(t * 6) * 0.2;
  }
}
