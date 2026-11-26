import * as THREE from 'three';
import { Holo, hm, hmesh, tube } from '../holo.js';
import { mulberry32 } from '../../core/util.js';

export default class Immune extends Holo {
  constructor(...a) {
    super(...a);
    this.scenario = 'An outbreak at the clinic: Dr. Chen needs everyone to understand how the body fights pathogens — and why antibiotics won’t cure the flu.';
    this.view = { pos: [0, 1.3, 2.2], target: [0, 1.2, 0] };
    this.mode = 'idle'; this.t0 = 0;
  }
  build() {
    const s = this.stage(1.2, 1.1); const rnd = mulberry32(9);
    s.add(hmesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 40, 1, true), hm('#fecaca', { opacity: 0.12, side: THREE.DoubleSide, glow: 0.3 }), 0, 0, 0).rotateZ(Math.PI / 2));
    const rbcGeo = new THREE.TorusGeometry(0.035, 0.018, 12, 24);
    this.rbc = []; for (let i = 0; i < 16; i++) { const r = hmesh(rbcGeo, hm('#dc2626', { glow: 0.25 }), (rnd() - 0.5) * 1.0, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.4); r.rotation.set(rnd() * 3, rnd() * 3, 0); s.add(r); this.rbc.push(r); }
    this.plate = []; for (let i = 0; i < 10; i++) { const p = hmesh(new THREE.DodecahedronGeometry(0.012), hm('#fde68a', { glow: 0.4 }), (rnd() - 0.5) * 1.0, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.4); s.add(p); this.plate.push(p); }
    // bacteria with antigens
    this.bact = []; for (let i = 0; i < 6; i++) { const b = new THREE.Group(); b.add(hmesh(new THREE.CapsuleGeometry(0.018, 0.05, 6, 12), hm('#84cc16', { glow: 0.3 }))); for (let k = 0; k < 6; k++) { const ag = hmesh(new THREE.ConeGeometry(0.006, 0.014, 6), hm('#a855f7', { glow: 0.5 }), Math.cos(k) * 0.02, (k - 2.5) * 0.012, Math.sin(k) * 0.02); ag.lookAt(0, ag.position.y, 0); ag.rotateX(-Math.PI / 2); b.add(ag); } b.rotation.z = Math.PI / 2 + rnd(); b.position.set(0.15 + rnd() * 0.3, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3); s.add(b); this.bact.push(b); }
    // phagocyte
    this.phago = hmesh(new THREE.SphereGeometry(0.09, 28, 20), hm('#e0f2fe', { opacity: 0.75, glow: 0.3 }), -0.25, 0, 0); s.add(this.phago);
    this.phago.add(hmesh(new THREE.SphereGeometry(0.035, 16, 12), hm('#7c3aed', { glow: 0.3 }), 0.02, 0.02, 0));
    // lymphocyte + antibodies
    this.lymph = hmesh(new THREE.SphereGeometry(0.06, 24, 18), hm('#dbeafe', { opacity: 0.8, glow: 0.3 }), 0.05, 0.2, 0.05); s.add(this.lymph);
    this.lymph.add(hmesh(new THREE.SphereGeometry(0.048, 16, 12), hm('#4f46e5', { glow: 0.3 })));
    this.abs = []; for (let i = 0; i < 14; i++) { const y = new THREE.Group(); y.add(hmesh(new THREE.CylinderGeometry(0.003, 0.003, 0.02, 6), hm('#38bdf8', { glow: 0.8 }), 0, -0.01, 0)); for (const sd of [-1, 1]) { const arm = hmesh(new THREE.CylinderGeometry(0.003, 0.003, 0.016, 6), hm('#38bdf8', { glow: 0.8 }), sd * 0.006, 0.006, 0); arm.rotation.z = -sd * 0.6; y.add(arm); } y.visible = false; s.add(y); this.abs.push({ y, target: this.bact[i % this.bact.length], off: new THREE.Vector3((rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.06, (rnd() - 0.5) * 0.04) }); }
    // virus
    this.virus = new THREE.Group(); this.virus.position.set(-0.4, 0.22, 0.1); s.add(this.virus);
    this.virus.add(hmesh(new THREE.IcosahedronGeometry(0.035, 0), hm('#f472b6', { glow: 0.3, opacity: 0.7, flat: true })), tube([[-0.012, -0.01, 0], [0, 0.01, 0.005], [0.012, -0.005, -0.005]], 0.003, hm('#fde047', { glow: 0.8 }), 10));
    for (let k = 0; k < 12; k++) { const sp = hmesh(new THREE.CylinderGeometry(0.002, 0.002, 0.02, 4), hm('#f472b6', { glow: 0.5 })); const d = new THREE.Vector3().randomDirection(); sp.position.copy(d.clone().multiplyScalar(0.04)); sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); this.virus.add(sp); }
    // memory cells
    this.memory = []; for (let i = 0; i < 4; i++) { const m = hmesh(new THREE.SphereGeometry(0.03, 14, 10), hm('#facc15', { glow: 0.5 }), 0.3 + i * 0.07, 0.25, -0.12); m.visible = false; s.add(m); this.memory.push(m); }
    const H = (id, pos, title, text, ids) => this.hotspot({ id, pos, title, text, ids });
    H('pathogen', [0.3, 0.12, 0.12], 'Pathogens', 'A **pathogen** is a disease-causing organism — bacteria, viruses, fungi and protoctists. Transmissible diseases pass between hosts by **direct contact** or **indirectly** (air, water, food, insects).', ['B10.1.1', 'B10.1.2', 'B10.1.3']);
    H('virus', [-0.4, 0.28, 0.14], 'Virus (S)', 'Not a cell: a **protein coat** around genetic material. Antibiotics **cannot** kill viruses like flu or HIV.', ['B10.1.7', 'B14.1.4']);
    H('rbc', [0.0, -0.18, 0.2], 'Red blood cells', 'Carry oxygen using **haemoglobin**. No nucleus — more room for haemoglobin.', ['B9.4.1', 'B9.4.3']);
    H('phagocyte', [-0.25, 0.1, 0.1], 'Phagocyte (S)', 'A white blood cell that **engulfs and digests** pathogens (phagocytosis). Lobed nucleus.', ['B9.4.4', 'B9.4.5']);
    H('lymphocyte', [0.05, 0.28, 0.1], 'Lymphocyte (S)', 'A white blood cell with a large round nucleus that **makes antibodies**.', ['B9.4.4', 'B9.4.5', 'B10.1.8']);
    H('antibody', [0.2, 0.05, 0.15], 'Antibodies & antigens (S)', 'Each pathogen has **antigens** with specific shapes. Antibodies have a **complementary shape**, bind to them, and destroy the pathogen or mark it for phagocytes.', ['B10.1.9', 'B10.1.10', 'B10.1.11']);
    H('platelet', [-0.1, -0.15, 0.18], 'Platelets & plasma', 'Platelets help **clot** the blood at a wound — stopping blood loss and pathogen entry. **Plasma** carries cells, nutrients, CO₂, urea and hormones.', ['B9.4.1', 'B9.4.3', 'B9.4.6']);
    H('defences', [-0.45, -0.15, 0.1], 'Body defences', 'Skin, hairs in the nose, **mucus**, stomach acid and white blood cells stop pathogens. Clean water, food hygiene, handwashing and proper sewage disposal reduce spread.', ['B10.1.4', 'B10.1.5']);
    H('memory', [0.4, 0.3, -0.08], 'Vaccination & memory cells (S)', 'A vaccine contains harmless **antigens**. Lymphocytes make antibodies and **memory cells**, so a real infection is fought off fast — **active immunity**.', ['B10.1.6', 'B10.1.12', 'B10.1.13', 'B10.1.14']);
    H('antibiotic', [0.45, -0.2, 0.05], 'Antibiotics', 'Kill **bacteria**, not viruses. Overuse lets **resistant** bacteria (like MRSA) survive and spread — so use them only when essential.', ['B14.1.2', 'B14.1.3', 'B14.1.4', 'B14.1.5']);
    this.story([
      { title: 'Infection', text: 'Bacteria have got past the skin into the blood. Each one carries **antigens** on its surface.', apply: () => { this.mode = 'idle'; } },
      { title: 'Phagocytes attack', text: 'A **phagocyte** flows around a bacterium and engulfs it, then digests it with enzymes.', apply: () => { this.mode = 'phago'; this.t0 = 0; } },
      { title: 'Antibodies (S)', text: 'Lymphocytes release **antibodies** that fit the bacteria’s antigens like a key in a lock, clumping and marking them.', apply: () => { this.mode = 'antibody'; this.t0 = 0; } },
      { title: 'Memory and vaccination (S)', text: 'Memory cells remain. Next time, antibodies are made faster and in greater numbers — the basis of **vaccination**.', apply: () => { this.mode = 'memory'; } },
      { title: 'Antibiotics', text: 'Antibiotics can cure bacterial infections — but a virus is not affected. Finish the course, and only use them when needed.', apply: () => { this.mode = 'antibiotic'; this.t0 = 0; } },
    ]);
    this.finish({ intro: 'Inside a blood vessel: step through an infection and the immune response.', sub: 'B10.1', questions: [
      { q: 'Why don’t antibiotics cure **flu**?', opts: ['Flu is caused by a virus, and antibiotics only kill bacteria', 'Flu bacteria are too small', 'Antibiotics only work on fungi', 'Flu is not a disease'], e: 'Overusing antibiotics also breeds resistant bacteria.', o: [4], sub: 'B14.1' },
      { q: '(S) Antibodies work because they…', opts: ['have a shape complementary to a specific antigen', 'engulf bacteria', 'carry oxygen', 'clot the blood'], e: 'A different pathogen needs a different antibody.', o: [9, 11] },
      { q: 'Which is a white blood cell that engulfs pathogens?', opts: ['Phagocyte', 'Red blood cell', 'Platelet', 'Lymphocyte'], e: 'Lymphocytes make antibodies.', o: [4, 5], sub: 'B9.4' },
    ] });
  }
  animate(dt, t) {
    this.t0 += dt;
    this.rbc.forEach((r, i) => { r.position.x += dt * 0.05; if (r.position.x > 0.55) r.position.x = -0.55; r.rotation.x += dt * 0.3; });
    this.plate.forEach((p) => { p.position.x += dt * 0.04; if (p.position.x > 0.55) p.position.x = -0.55; });
    this.bact.forEach((b, i) => { b.rotation.y += dt * 0.5; if (this.mode === 'antibiotic') { b.scale.setScalar(Math.max(0.01, 1 - this.t0 * 0.3)); } else if (!(this.mode === 'phago' && i === 0)) b.scale.setScalar(1); });
    if (this.mode === 'phago') { const b = this.bact[0]; const target = b.position.clone(); this.phago.position.lerp(target, dt * 0.6); if (this.phago.position.distanceTo(target) < 0.05) b.scale.setScalar(Math.max(0.01, b.scale.x - dt * 0.5)); this.phago.scale.set(1 + Math.sin(t * 3) * 0.05, 1 - Math.sin(t * 3) * 0.05, 1); }
    else this.phago.position.lerp(new THREE.Vector3(-0.25, 0, 0), dt);
    const showAb = this.mode === 'antibody' || this.mode === 'memory';
    this.abs.forEach((a, i) => { a.y.visible = showAb; if (!showAb) return; const k = Math.min(1, this.t0 * 0.4 - i * 0.02); const dest = a.target.position.clone().add(a.off); a.y.position.lerpVectors(this.lymph.position, dest, Math.max(0, k)); a.y.lookAt(dest); });
    this.memory.forEach((m, i) => { m.visible = this.mode === 'memory'; m.position.y = 0.25 + Math.sin(t * 2 + i) * 0.01; });
    this.virus.rotation.y += dt * 0.4;
  }
}
