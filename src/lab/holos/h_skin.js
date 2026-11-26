import * as THREE from 'three';
import { Holo, hm, hmesh, tube } from '../holo.js';
import { mulberry32 } from '../../core/util.js';

export default class Skin extends Holo {
  constructor(...a) {
    super(...a);
    this.scenario = 'Heatstroke at the beach, shivering at the night market: your skin is working hard to keep you at 37 °C. Switch the weather and watch it respond.';
    this.view = { pos: [0.25, 1.5, 1.9], target: [0, 1.15, 0] };
    this.state = 0; this.target = 0; // −1 cold … +1 hot
  }
  build() {
    const s = this.stage(1.15, 1.3); const rnd = mulberry32(4);
    const W = 0.6, D = 0.36;
    s.add(hmesh(new THREE.BoxGeometry(W, 0.05, D), hm('#f5d0c5', { glow: 0.2 }), 0, 0.2, 0));
    s.add(hmesh(new THREE.BoxGeometry(W, 0.22, D), hm('#fbcfe8', { opacity: 0.45, glow: 0.2 }), 0, 0.06, 0));
    const fat = hm('#fde68a', { glow: 0.25, opacity: 0.85 });
    for (let i = 0; i < 40; i++) s.add(hmesh(new THREE.SphereGeometry(0.035 + rnd() * 0.012, 12, 10), fat, (rnd() - 0.5) * W * 0.9, -0.1 - rnd() * 0.06, (rnd() - 0.5) * D * 0.9));
    // hairs + erector muscles
    this.hairs = [];
    for (let i = 0; i < 3; i++) {
      const x = -0.2 + i * 0.2, g = new THREE.Group(); g.position.set(x, 0.0, -0.05); s.add(g);
      g.add(hmesh(new THREE.CylinderGeometry(0.018, 0.012, 0.2, 12, 1, true), hm('#fca5a5', { opacity: 0.6, side: THREE.DoubleSide }), 0, 0.08, 0));
      const hair = new THREE.Group(); hair.position.y = 0.0; g.add(hair); hair.add(hmesh(new THREE.CylinderGeometry(0.004, 0.006, 0.42, 8), hm('#78350f'), 0, 0.21, 0));
      const mus = tube([[0.012, 0.06, 0], [0.05, 0.13, 0], [0.08, 0.18, 0]], 0.006, hm('#dc2626', { glow: 0.3 }), 10); g.add(mus);
      this.hairs.push({ hair, mus });
    }
    // sweat glands
    this.drops = [];
    for (let i = 0; i < 2; i++) {
      const x = -0.1 + i * 0.22, z = 0.08;
      const pts = []; for (let k = 0; k < 30; k++) pts.push([x + Math.cos(k * 0.9) * 0.025, -0.06 + Math.sin(k * 0.9) * 0.015 + k * 0.0008, z + Math.sin(k * 1.3) * 0.02]);
      s.add(tube(pts, 0.005, hm('#60a5fa', { glow: 0.4 }), 60), tube([[x, -0.035, z], [x + 0.01, 0.1, z], [x, 0.225, z]], 0.004, hm('#60a5fa', { glow: 0.4 }), 12));
      const d = hmesh(new THREE.SphereGeometry(0.014, 12, 10), hm('#bae6fd', { opacity: 0.85, glow: 0.4 }), x, 0.235, z); d.visible = false; s.add(d); this.drops.push(d);
    }
    // blood vessels: arteriole loop near the surface
    this.cap = tube([[-0.28, -0.02, 0.12], [-0.1, 0.16, 0.12], [0.1, 0.16, 0.12], [0.28, -0.02, 0.12]], 0.008, hm('#ef4444', { glow: 0.4 }), 40); s.add(this.cap);
    this.deep = tube([[-0.28, -0.05, 0.13], [0.28, -0.05, 0.13]], 0.009, hm('#b91c1c', { glow: 0.3 }), 20); s.add(this.deep);
    this.shunt = hmesh(new THREE.TorusGeometry(0.012, 0.003, 6, 16), hm('#f8fafc', { glow: 0.6 }), -0.18, 0.02, 0.12); s.add(this.shunt);
    // receptors & nerve
    s.add(hmesh(new THREE.SphereGeometry(0.014, 12, 10), hm('#facc15', { glow: 0.6 }), 0.15, 0.13, -0.12), tube([[0.15, 0.13, -0.12], [0.2, 0.0, -0.1], [0.3, -0.1, -0.1]], 0.004, hm('#facc15', { glow: 0.5 }), 12));
    const H = (id, pos, title, text, ids) => this.hotspot({ id, pos, title, text, ids });
    H('epi', [-0.27, 0.23, 0.17], 'Epidermis', 'The outer layer: a barrier to pathogens and water loss.', ['B13.3.4']);
    H('hair', [-0.2, 0.33, -0.05], 'Hairs', 'When cold, hairs are raised to trap a layer of insulating air (much more useful for furry mammals!).', ['B13.3.4', 'B13.3.5']);
    H('erector', [0.06, 0.17, -0.05], 'Hair erector muscles', 'Contract to raise the hairs when you are cold — “goose bumps”.', ['B13.3.4', 'B13.3.5']);
    H('sweat', [0.13, -0.06, 0.1], 'Sweat glands', 'Release sweat onto the skin when hot. Sweat **evaporates**, transferring thermal energy away from the skin.', ['B13.3.4', 'B13.3.5']);
    H('vessels', [0.0, 0.18, 0.13], 'Arterioles & capillaries', '**Vasodilation** when hot: arterioles widen, more blood flows near the surface and loses heat. **Vasoconstriction** when cold keeps warm blood deeper.', ['B13.3.4', 'B13.3.5']);
    H('receptor', [0.15, 0.15, -0.12], 'Temperature receptors & neurones', 'Detect changes in skin temperature; sensory neurones send impulses to the brain, which also monitors blood temperature.', ['B13.3.4']);
    H('fat', [0.25, -0.13, 0.15], 'Fatty tissue', 'A layer of fat under the skin **insulates** the body.', ['B13.3.4', 'B13.3.5']);
    H('feedback', [-0.3, -0.2, -0.15], 'Negative feedback', 'Body temperature has a **set point** of about 37 °C. Any change triggers responses that **reverse** it — negative feedback. Blood glucose is controlled the same way: **insulin** lowers it, **glucagon** raises it, using the **liver**.', ['B13.3.1', 'B13.3.2', 'B13.3.3']);
    this.story([
      { title: 'Set point: 37 °C', text: 'Homeostasis keeps the internal environment constant. The brain compares body temperature with a set point of about 37 °C.', apply: () => { this.target = 0; } },
      { title: 'Too hot (the beach)', text: '**Sweating** (evaporation cools the skin), **vasodilation** (more blood near the surface), hairs lie flat.', apply: () => { this.target = 1; } },
      { title: 'Too cold (night market)', text: '**Vasoconstriction**, hairs raised by **erector muscles**, and **shivering** — muscle contractions that release heat by respiration.', apply: () => { this.target = -1; } },
      { title: 'Negative feedback', text: 'As temperature returns to normal, the responses switch off. (S) Blood glucose works the same way: insulin makes the liver store glucose as glycogen; glucagon makes it release glucose.', apply: () => { this.target = 0; } },
    ]);
    this.finish({ intro: 'Use the steps to make the island hot or cold and watch the skin respond.', sub: 'B13.3', questions: [
      { q: 'On a hot day, **vasodilation** cools you because…', opts: ['arterioles widen, so more blood flows near the skin surface and loses heat', 'blood vessels move to the surface', 'blood stops flowing', 'sweat glands get smaller'], e: 'Vessels don’t move — they widen or narrow.', o: [5] },
      { q: 'Shivering warms the body because…', opts: ['rapid muscle contractions release energy from respiration as heat', 'it makes hairs stand up', 'it reduces sweating', 'it widens blood vessels'], e: 'An example of a negative-feedback response.', o: [5] },
      { q: '(S) After a sugary meal, the pancreas secretes…', opts: ['insulin, so the liver stores glucose as glycogen', 'glucagon, which raises blood glucose', 'adrenaline', 'bile'], e: 'Glucagon does the reverse when blood glucose is low.', o: [3] },
    ] });
  }
  animate(dt, t) {
    this.state += (this.target - this.state) * Math.min(1, dt * 1.5);
    const hot = Math.max(0, this.state), cold = Math.max(0, -this.state);
    this.hairs.forEach(({ hair }) => { hair.rotation.z = -0.9 + cold * 0.75 + hot * -0.15; });
    this.cap.position.y = hot * 0.03 - cold * 0.06; this.cap.scale.set(1, 1, 1); this.cap.material.emissiveIntensity = 0.6 + hot * 2 - cold * 0.4;
    this.shunt.material.emissiveIntensity = cold * 3;
    this.drops.forEach((d, i) => { d.visible = hot > 0.3; d.position.y = 0.235 + ((t * 0.3 + i * 0.5) % 1) * 0.01; d.scale.setScalar(0.6 + ((t * 0.5 + i) % 1) * 0.6); });
    this.pivot.position.x = cold > 0.5 ? Math.sin(t * 60) * 0.003 : 0;
  }
}
