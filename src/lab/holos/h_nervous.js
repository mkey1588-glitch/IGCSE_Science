import * as THREE from 'three';
import { Holo, hm, hmesh, tube } from '../holo.js';

export default class Nervous extends Holo {
  constructor(...a) {
    super(...a);
    this.scenario = 'Teo touched a hot sparkler and pulled away before he even felt the pain. Trace the reflex — then see how hormones like adrenaline prepare the body for action.';
    this.view = { pos: [0.1, 1.35, 2.5], target: [0.1, 1.2, 0] };
    this.mode = 'idle'; this.pulse = 0; this.adr = 0;
  }
  build() {
    const s = this.stage(1.2, 1.1);
    const body = hm('#93c5fd', { opacity: 0.12, glow: 0.3, side: THREE.DoubleSide });
    s.add(hmesh(new THREE.SphereGeometry(0.1, 24, 18), body, 0, 0.55, 0), hmesh(new THREE.CapsuleGeometry(0.15, 0.4, 6, 18), body, 0, 0.18, 0));
    for (const sd of [-1, 1]) { s.add(tube([[sd * 0.17, 0.36, 0], [sd * 0.3, 0.15, 0.02], [sd * 0.36, -0.05, 0.1]], 0.04, body, 12), tube([[sd * 0.08, -0.12, 0], [sd * 0.1, -0.35, 0], [sd * 0.1, -0.6, 0.02]], 0.05, body, 12)); }
    this.brain = hmesh(new THREE.SphereGeometry(0.075, 24, 18), hm('#f9a8d4', { glow: 0.5 }), 0, 0.57, 0); this.brain.scale.set(1, 0.85, 1.1); s.add(this.brain);
    this.cord = tube([[0, 0.5, -0.04], [0, 0.2, -0.06], [0, -0.1, -0.05]], 0.012, hm('#f472b6', { glow: 0.6 }), 20); s.add(this.cord);
    const nerve = hm('#fde047', { glow: 0.5 });
    for (const sd of [-1, 1]) { s.add(tube([[0, 0.32, -0.06], [sd * 0.18, 0.33, 0], [sd * 0.31, 0.12, 0.03], [sd * 0.37, -0.06, 0.11]], 0.003, nerve, 30), tube([[0, -0.08, -0.05], [sd * 0.08, -0.14, 0], [sd * 0.1, -0.6, 0.03]], 0.003, nerve, 30)); }
    // reflex arc: right hand (viewer's left), sensory to cord, relay, motor to biceps
    this.sensory = new THREE.CatmullRomCurve3([[-0.37, -0.07, 0.12], [-0.3, 0.12, 0.06], [-0.15, 0.25, 0.0], [-0.02, 0.24, -0.05]].map((p) => new THREE.Vector3(...p)));
    this.relay = new THREE.CatmullRomCurve3([[-0.02, 0.24, -0.05], [0, 0.22, -0.07], [0.02, 0.2, -0.05]].map((p) => new THREE.Vector3(...p)));
    this.motor = new THREE.CatmullRomCurve3([[0.02, 0.2, -0.05], [-0.12, 0.2, 0.02], [-0.25, 0.2, 0.06]].map((p) => new THREE.Vector3(...p)));
    s.add(new THREE.Mesh(new THREE.TubeGeometry(this.sensory, 30, 0.005, 6), hm('#38bdf8', { glow: 0.8 })), new THREE.Mesh(new THREE.TubeGeometry(this.relay, 10, 0.005, 6), hm('#a78bfa', { glow: 0.8 })), new THREE.Mesh(new THREE.TubeGeometry(this.motor, 20, 0.005, 6), hm('#f97316', { glow: 0.8 })));
    this.muscle = hmesh(new THREE.SphereGeometry(0.035, 16, 12), hm('#ef4444', { glow: 0.3 }), -0.26, 0.2, 0.06); this.muscle.scale.set(0.8, 1.6, 0.8); s.add(this.muscle);
    this.flame = hmesh(new THREE.ConeGeometry(0.03, 0.08, 12, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.3), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), -0.42, -0.12, 0.16); s.add(this.flame);
    this.spark = hmesh(new THREE.SphereGeometry(0.014, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 1.5) })); this.spark.visible = false; s.add(this.spark);
    // glands
    const gl = (x, y, z, col) => { const m = hmesh(new THREE.SphereGeometry(0.022, 14, 10), hm(col, { glow: 0.5 }), x, y, z); s.add(m); return m; };
    this.adrenal = [gl(-0.06, 0.02, -0.03, '#fb923c'), gl(0.06, 0.02, -0.03, '#fb923c')];
    this.pancreas = gl(0.03, 0.08, 0.06, '#fcd34d'); this.pancreas.scale.set(2.2, 0.7, 0.8);
    this.gonads = [gl(-0.06, -0.12, 0.04, '#c084fc'), gl(0.06, -0.12, 0.04, '#c084fc')];
    this.heartM = gl(0.05, 0.28, 0.06, '#dc2626');
    this.eyes = [gl(-0.03, 0.58, 0.08, '#e0f2fe'), gl(0.03, 0.58, 0.08, '#e0f2fe')].map((e) => { e.scale.setScalar(0.5); return e; });
    this.hormone = new THREE.InstancedMesh(new THREE.SphereGeometry(0.006, 6, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.2, 0.2) }), 50); this.hormone.frustumCulled = false; s.add(this.hormone); this.hormone.count = 0;
    this.hp = Array.from({ length: 50 }, () => ({ a: Math.random() * 6.28, r: Math.random() * 0.3, y: Math.random() * 0.6 - 0.2 }));
    const H = (id, pos, title, text, ids) => this.hotspot({ id, pos, title, text, ids });
    H('cns', [0.06, 0.6, 0.06], 'Brain & spinal cord (CNS)', 'The **central nervous system** coordinates and regulates body functions. Nerves form the **peripheral** nervous system.', ['B13.1.2', 'B13.1.3']);
    H('receptor', [-0.42, -0.06, 0.16], 'Receptor', 'Temperature and pain receptors in the skin detect the hot sparkler — a **stimulus**. Sense organs have receptors for light, sound, touch, temperature and chemicals.', ['B13.1.5', 'B13.1.7']);
    H('sensory', [-0.3, 0.12, 0.08], 'Sensory neurone', 'Carries **electrical impulses** from the receptor to the spinal cord.', ['B13.1.1', 'B13.1.4']);
    H('relay', [0.0, 0.25, -0.02], 'Relay neurone', 'In the spinal cord: passes the impulse from the sensory to the motor neurone — no thinking needed.', ['B13.1.4', 'B13.1.5']);
    H('motor', [-0.12, 0.22, 0.05], 'Motor neurone', 'Carries the impulse to the **effector**.', ['B13.1.4', 'B13.1.5']);
    H('effector', [-0.27, 0.27, 0.08], 'Effector (muscle)', 'The biceps contracts and pulls the hand away: a fast, **automatic** response — a **reflex**.', ['B13.1.5', 'B13.1.6']);
    H('adrenal', [-0.08, 0.04, 0.0], 'Adrenal glands', 'Secrete **adrenaline** into the blood in “fight or flight”: faster breathing and heart rate, wider pupils.', ['B13.2.1', 'B13.2.2', 'B13.2.3']);
    H('pancreas', [0.07, 0.09, 0.09], 'Pancreas', 'Secretes **insulin** — and (S) **glucagon** — to control blood glucose.', ['B13.2.2', 'B13.2.4']);
    H('gonads', [0.07, -0.13, 0.07], 'Testes / ovaries', 'Testes secrete **testosterone**; ovaries secrete **oestrogen**.', ['B13.2.2']);
    this.story([
      { title: 'Nervous system', text: 'Brain and spinal cord form the **CNS**; nerves carry **electrical impulses** to and from every part of the body (the PNS).', apply: () => { this.mode = 'idle'; } },
      { title: 'A reflex arc', text: 'Stimulus → **receptor** → **sensory** neurone → **relay** neurone (spinal cord) → **motor** neurone → **effector** → response. Watch the impulse.', apply: () => { this.mode = 'reflex'; this.pulse = 0; } },
      { title: 'Hormones', text: 'Hormones are chemicals made by **glands**, carried in the **blood**, that change how target organs work. Slower than nerves, but longer-lasting.', apply: () => { this.mode = 'hormone'; } },
      { title: 'Adrenaline', text: 'A loud bang at the fireworks: the adrenal glands release **adrenaline** — heart rate and breathing rise, pupils widen, ready for action.', apply: () => { this.mode = 'adrenaline'; this.adr = 0; } },
    ]);
    this.finish({
      intro: 'Step 2 fires a nerve impulse around the reflex arc. Step 4 releases adrenaline.',
      sub: 'B13.1',
      questions: [
        { q: 'The correct order in a reflex arc is…', opts: ['receptor → sensory neurone → relay neurone → motor neurone → effector', 'effector → motor → relay → sensory → receptor', 'receptor → motor → relay → sensory → effector', 'brain → receptor → effector'], e: 'The relay neurone is in the spinal cord.', o: [5] },
        { q: 'A hormone is…', opts: ['a chemical made by a gland and carried by the blood to target organs', 'an electrical impulse', 'a type of neurone', 'an enzyme in the gut'], e: 'Nerves are fast and short-lived; hormones are slower and longer-lasting.', o: [1], sub: 'B13.2' },
        { q: 'Which is **not** an effect of adrenaline?', opts: ['Pupils get smaller', 'Heart rate increases', 'Breathing rate increases', 'More glucose released into the blood'], e: 'Pupils widen to let more light in.', o: [3], sub: 'B13.2' },
      ],
    });
  }
  animate(dt, t) {
    this.flame.visible = this.mode === 'reflex';
    if (this.mode === 'reflex') {
      this.pulse = (this.pulse + dt * 0.5) % 1.4; const p = this.pulse;
      this.spark.visible = p < 1;
      if (p < 0.5) this.spark.position.copy(this.sensory.getPointAt(p / 0.5)); else if (p < 0.6) this.spark.position.copy(this.relay.getPointAt((p - 0.5) / 0.1)); else if (p < 1) this.spark.position.copy(this.motor.getPointAt((p - 0.6) / 0.4));
      this.muscle.scale.set(0.8 + (p > 1 ? 0.25 : 0), p > 1 ? 1.3 : 1.6, 0.8 + (p > 1 ? 0.25 : 0));
    } else this.spark.visible = false;
    const hormoneOn = this.mode === 'hormone' || this.mode === 'adrenaline';
    this.hormone.count = hormoneOn ? 50 : 0;
    if (hormoneOn) { const o = new THREE.Object3D(); this.hp.forEach((q, i) => { q.a += dt * 1.2; o.position.set(Math.cos(q.a) * q.r * 0.6, q.y + Math.sin(q.a * 2) * 0.02, Math.sin(q.a) * q.r * 0.3); o.updateMatrix(); this.hormone.setMatrixAt(i, o.matrix); }); this.hormone.instanceMatrix.needsUpdate = true; }
    const rate = this.mode === 'adrenaline' ? 3 : 1.2; this.heartM.scale.setScalar(1 + Math.max(0, Math.sin(t * rate * Math.PI * 2)) * 0.25);
    this.eyes.forEach((e) => e.scale.setScalar(this.mode === 'adrenaline' ? 0.75 : 0.5));
    this.adrenal.forEach((a) => { a.material.emissiveIntensity = this.mode === 'adrenaline' ? 2 + Math.sin(t * 8) : 1; });
  }
}
