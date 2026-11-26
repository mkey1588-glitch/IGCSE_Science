import * as THREE from 'three';
import { Holo, hm, hmesh, tube } from '../holo.js';
import { h, clear } from '../../core/util.js';

export default class Reproduction extends Holo {
  constructor(...a) {
    super(...a);
    this.scenario = 'Hana runs the clinic’s health-education class. Use this model to explain the reproductive systems, how fertilisation happens, and how infections like HIV are prevented.';
    this.view = { pos: [0, 1.3, 2.4], target: [0, 1.2, 0] };
    this.mode = 'idle'; this.day = 1; this.t0 = 0;
  }
  build() {
    const s = this.stage(1.2, 1.05);
    // ---- female (left)
    const F = (this.F = new THREE.Group()); F.position.set(-0.35, 0.05, 0); s.add(F);
    this.uterus = hmesh(new THREE.SphereGeometry(0.09, 24, 18), hm('#f9a8d4', { opacity: 0.65, glow: 0.3 }), 0, 0.02, 0); this.uterus.scale.set(1, 1.15, 0.7); F.add(this.uterus);
    this.lining = hmesh(new THREE.SphereGeometry(0.07, 20, 14), hm('#be123c', { opacity: 0.5, glow: 0.3 }), 0, 0.03, 0); this.lining.scale.set(0.9, 1.05, 0.6); F.add(this.lining);
    this.ovaries = [-1, 1].map((sd) => { F.add(tube([[sd * 0.07, 0.08, 0], [sd * 0.14, 0.13, 0], [sd * 0.2, 0.08, 0.0]], 0.012, hm('#fda4af', { glow: 0.3 }), 20)); const o = hmesh(new THREE.SphereGeometry(0.03, 16, 12), hm('#fb7185', { glow: 0.3 }), sd * 0.19, 0.02, 0); o.scale.set(1.2, 0.8, 0.8); F.add(o); return o; });
    F.add(tube([[0, -0.08, 0], [0, -0.13, 0]], 0.02, hm('#fda4af', { glow: 0.2 }), 6), tube([[0, -0.13, 0], [0, -0.3, 0]], 0.028, hm('#fecdd3', { opacity: 0.7, glow: 0.2 }), 10));
    this.egg = hmesh(new THREE.SphereGeometry(0.018, 16, 12), hm('#fef3c7', { glow: 0.5 }), 0.19, 0.03, 0.03); F.add(this.egg);
    this.eggPath = new THREE.CatmullRomCurve3([[0.19, 0.03, 0.03], [0.2, 0.09, 0.02], [0.14, 0.13, 0.02], [0.07, 0.08, 0.02], [0.0, 0.03, 0.03]].map((p) => new THREE.Vector3(...p)));
    this.lab.label(F, 'Female', { y: 0.25 });
    // ---- male (right)
    const M = (this.M = new THREE.Group()); M.position.set(0.35, 0.05, 0); s.add(M);
    for (const sd of [-1, 1]) { M.add(hmesh(new THREE.SphereGeometry(0.035, 16, 12), hm('#93c5fd', { glow: 0.3 }), sd * 0.04, -0.2, 0.02)); M.add(tube([[sd * 0.04, -0.17, 0.02], [sd * 0.08, -0.05, -0.02], [sd * 0.05, 0.1, -0.04], [0, 0.06, -0.02], [0, -0.02, 0.02]], 0.006, hm('#60a5fa', { glow: 0.4 }), 30)); }
    M.add(hmesh(new THREE.CapsuleGeometry(0.055, 0.12, 6, 16), hm('#bfdbfe', { opacity: 0.3, glow: 0.2 }), 0, -0.2, 0.03).rotateZ(Math.PI / 2));
    M.add(hmesh(new THREE.SphereGeometry(0.028, 14, 10), hm('#a5b4fc', { glow: 0.3 }), 0, 0.01, -0.01));
    M.add(tube([[0, 0.0, 0.0], [0, -0.06, 0.06], [0, -0.1, 0.16]], 0.016, hm('#bfdbfe', { opacity: 0.55, glow: 0.2 }), 12), tube([[0, 0.0, 0.0], [0, -0.06, 0.06], [0, -0.1, 0.16]], 0.004, hm('#60a5fa', { glow: 0.5 }), 12));
    this.lab.label(M, 'Male', { y: 0.25 });
    // gametes close-up (centre)
    const G = (this.G = new THREE.Group()); G.position.set(0, -0.32, 0.1); s.add(G);
    this.bigEgg = hmesh(new THREE.SphereGeometry(0.07, 28, 20), hm('#fef3c7', { glow: 0.3 }), 0, 0, 0); G.add(this.bigEgg);
    G.add(hmesh(new THREE.SphereGeometry(0.085, 28, 20), hm('#e0f2fe', { opacity: 0.25, glow: 0.3 })), hmesh(new THREE.SphereGeometry(0.025, 16, 12), hm('#f59e0b', { glow: 0.4 }), 0.01, 0.01, 0.02));
    this.sperm = []; for (let i = 0; i < 5; i++) { const sp = new THREE.Group(); sp.add(hmesh(new THREE.SphereGeometry(0.008, 10, 8), hm('#e0e7ff', { glow: 0.5 }))); const tail = tube([[-0.008, 0, 0], [-0.03, 0.006, 0], [-0.055, -0.004, 0]], 0.0015, hm('#e0e7ff', { glow: 0.6 }), 10); sp.add(tail); sp.userData = { a: (i / 5) * Math.PI * 2, r: 0.2 + i * 0.015 }; G.add(sp); this.sperm.push(sp); }
    const H = (id, pos, title, text, ids) => this.hotspot({ id, pos, title, text, ids });
    H('ovary', [-0.54, 0.09, 0.03], 'Ovaries', 'Release an **egg** (ovulation) about once a month and make **oestrogen**, which causes female secondary sexual characteristics.', ['B15.4.2', 'B15.4.4']);
    H('oviduct', [-0.47, 0.2, 0.02], 'Oviducts', 'Carry the egg to the uterus. **Fertilisation** happens here.', ['B15.4.2', 'B15.4.3']);
    H('uterus', [-0.35, 0.12, 0.07], 'Uterus & lining', 'Where a fertilised egg implants and develops. The **lining** thickens each cycle and is shed during menstruation.', ['B15.4.2', 'B15.4.5']);
    H('cervix', [-0.35, -0.1, 0.03], 'Cervix & vagina', 'The cervix is a ring of muscle at the entrance to the uterus; the vagina receives sperm.', ['B15.4.2']);
    H('testis', [0.39, -0.2, 0.07], 'Testes & scrotum', 'Testes make **sperm** and **testosterone** (male secondary sexual characteristics). The scrotum holds them outside the body, slightly cooler.', ['B15.4.1', 'B15.4.4']);
    H('duct', [0.43, 0.0, 0.0], 'Sperm ducts & glands', 'Carry sperm to the urethra; glands (e.g. prostate) add fluid that nourishes the sperm.', ['B15.4.1']);
    H('urethra', [0.35, -0.08, 0.16], 'Urethra & penis', 'Carry semen (or urine) out of the body.', ['B15.4.1']);
    H('gametes', [0.09, -0.28, 0.18], 'Egg and sperm (S)', '**Sperm:** tiny, millions made, a **flagellum** to swim, **mitochondria** for energy, **enzymes** to digest into the egg. **Egg:** large, few, an **energy store** and a **jelly coat** that changes after fertilisation. Gametes are **haploid**; the zygote is **diploid**.', ['B15.4.6', 'B15.4.7', 'B15.4.8', 'B15.2.1', 'B15.2.3']);
    H('sti', [0, 0.32, 0.05], 'STIs and HIV', 'Sexually transmitted infections pass by sexual contact. **HIV** can also spread through shared needles, blood, and from mother to baby, and may lead to **AIDS**. Condoms, testing and treatment control the spread.', ['B15.5.1', 'B15.5.2', 'B15.5.3', 'B15.5.4', 'B15.5.5']);
    this.story([
      { title: 'Two systems', text: 'The female and male reproductive systems make the **gametes** — eggs and sperm — and the hormones oestrogen and testosterone.', apply: () => { this.mode = 'idle'; } },
      { title: 'Ovulation', text: 'Around day 14 of the menstrual cycle an egg is released from an ovary and moves along the oviduct.', apply: () => { this.mode = 'ovulate'; this.t0 = 0; } },
      { title: 'Fertilisation', text: 'A sperm’s nucleus **fuses** with the egg’s nucleus, forming a **zygote**. Only one sperm gets in.', apply: () => { this.mode = 'fert'; this.t0 = 0; } },
      { title: 'The menstrual cycle', text: 'The uterus lining thickens after menstruation, ready for implantation. If no fertilisation happens, it breaks down — a period (days 1–5).', apply: () => { this.mode = 'cycle'; } },
    ]);
    this.extraControls = (ctl) => { this.cycleEl = h('div', { class: 'muted', style: { fontSize: '.85em', marginTop: '6px' } }, ''); ctl.append(this.cycleEl); };
    this.finish({ intro: 'Schematic diagrams of the female (left) and male (right) systems, with the gametes in the centre.', sub: 'B15.4', questions: [
      { q: 'Where does **fertilisation** usually happen?', opts: ['In the oviduct', 'In the ovary', 'In the uterus lining', 'In the vagina'], e: 'The zygote then moves to the uterus to implant.', o: [2, 3] },
      { q: '(S) Why does a sperm cell contain many **mitochondria**?', opts: ['To release energy from respiration for swimming', 'To store food for the embryo', 'To make hormones', 'To carry oxygen'], e: 'The flagellum needs lots of energy.', o: [6] },
      { q: 'Which method helps prevent the spread of **HIV**?', opts: ['Using condoms and not sharing needles', 'Taking antibiotics', 'Washing hands only', 'Vaccination with a flu vaccine'], e: 'HIV is a virus, so antibiotics don’t work against it.', o: [5], sub: 'B15.5' },
    ] });
  }
  animate(dt, t) {
    this.t0 += dt;
    if (this.mode === 'ovulate' || this.mode === 'fert') { const u = Math.min(1, this.t0 * 0.25); this.egg.position.copy(this.eggPath.getPointAt(u * 0.75)); }
    else this.egg.position.copy(this.eggPath.getPointAt(0));
    this.sperm.forEach((sp, i) => { const u = sp.userData; if (this.mode === 'fert') { u.r = Math.max(i === 0 ? 0.075 : 0.1, u.r - dt * 0.03); } else u.r = 0.2 + i * 0.015; u.a += dt * (0.8 + i * 0.1); sp.position.set(Math.cos(u.a) * u.r, Math.sin(u.a * 1.3) * 0.03, Math.sin(u.a) * u.r * 0.6); sp.rotation.y = -u.a + Math.PI / 2; sp.children[1].rotation.z = Math.sin(t * 20 + i) * 0.3; });
    this.bigEgg.material.emissiveIntensity = this.mode === 'fert' && this.t0 > 3 ? 2 + Math.sin(t * 5) : 1;
    if (this.mode === 'cycle') { this.day = (this.day + dt * 3) % 28; } const d = Math.floor(this.day) + 1;
    const thick = d <= 5 ? 0.6 - d * 0.05 : d <= 14 ? 0.4 + (d - 5) * 0.06 : 1;
    this.lining.scale.set(0.9 * (0.6 + thick * 0.4), 1.05 * (0.6 + thick * 0.4), 0.6 * (0.6 + thick * 0.4));
    if (this.cycleEl) this.cycleEl.textContent = `Menstrual cycle: day ${d} — ${d <= 5 ? 'menstruation (lining shed)' : d < 14 ? 'lining thickening' : d === 14 ? 'ovulation' : 'lining maintained'}`;
    this.ovaries[1].material.emissiveIntensity = d === 14 ? 3 : 1;
  }
}
void clear;
