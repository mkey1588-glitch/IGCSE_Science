import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { beaker, ruler, mesh, mat, M } from '../apparatus.js';
import { h, canvasTex, clamp } from '../../core/util.js';
import { audio } from '../../core/audio.js';

// dyes: Rf values in water/ethanol solvent
const DYES = { blue: { col: '#2563eb', rf: 0.78 }, pink: { col: '#ec4899', rf: 0.55 }, yellow: { col: '#eab308', rf: 0.88 }, purple: { col: '#7c3aed', rf: 0.33 }, black: { col: '#111827', rf: 0.0 }, teal: { col: '#0d9488', rf: 0.66 } };
const SAMPLES = [
  { id: 'X', name: 'Forged ticket', dyes: ['purple', 'pink', 'yellow'] },
  { id: 'A', name: 'Festival pen', dyes: ['purple', 'pink', 'blue'] },
  { id: 'B', name: 'Pen B', dyes: ['purple', 'pink', 'yellow'] },
  { id: 'C', name: 'Pen C', dyes: ['purple', 'teal'] },
  { id: 'D', name: 'Pen D', dyes: ['pink'] },
];
const W = 512, H = 768;          // paper texture
const BASE = 0.1, FRONT_MAX = 0.9; // as a fraction of paper height (from bottom)

export default class Chromatography extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Fake festival tickets are circulating. Genuine ones are signed with the special purple festival pen. Separate the inks and prove which pen signed the forgery.';
    this.view = { pos: [0, 1.38, 0.78], target: [0, 1.06, 0] };
    this.front = 0; this.running = false; this.spotted = false; this.pencil = true; this.solventLevel = 'below'; this.measured = false;
  }
  build() {
    const Y = this.Y;
    this.tank = beaker({ r: 0.11, h: 0.26, color: '#e0f2fe', level: 0.06, opacity: 0.4 }); this.lab.add(this.tank, 0, Y, 0);
    this.lab.label(this.tank, 'Chromatography tank (solvent: water)', { y: 0.32 });
    this.lid = mesh(new THREE.CylinderGeometry(0.116, 0.116, 0.006, 32), new THREE.MeshPhysicalMaterial({ color: '#e0f2fe', transparent: true, opacity: 0.25, roughness: 0.05 }), 0, 0.265, 0); this.tank.add(this.lid);
    this.paperTex = canvasTex(W, H);
    this.paper = mesh(new THREE.PlaneGeometry(0.16, 0.24), new THREE.MeshStandardMaterial({ map: this.paperTex.tex, roughness: 0.95, side: THREE.DoubleSide }));
    this.paper.position.set(0, 0.135, 0); this.tank.add(this.paper);
    this.rod = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.26, 8), M.glass, 0, 0.258, 0); this.rod.rotation.z = Math.PI / 2; this.tank.add(this.rod);
    this.rl = ruler(0.3); this.lab.add(this.rl, 0.26, Y + 0.002, 0.08); this.rl.rotation.y = Math.PI / 2;
    this.lab.interactive(this.paper, { tip: 'Chromatography paper', onClick: () => {} });
    const ui = this.ui;
    this.st = ui.steps(['Draw the baseline in **pencil** and spot each ink on it', 'Set the solvent level **below** the baseline', 'Run the chromatogram until the solvent front nears the top', 'Mark the **solvent front** and measure the spots', { t: '(S) Calculate the **Rf** of the purple dye', o: ['C12.3.3'], q: true }, 'Name the pen that signed the forged ticket', 'Answer the analysis questions']);
    const sec = ui.section('Set up');
    this.penSeg = ui.seg({ label: 'Draw the baseline with', options: [['pencil', '✏️ Pencil'], ['ink', '🖊️ Ballpoint pen']], value: 'pencil', parent: sec, onChange: (v) => { this.pencil = v === 'pencil'; this.draw(); } });
    this.lvlSeg = ui.seg({ label: 'Solvent depth', options: [['below', 'Below the baseline'], ['above', 'Above the baseline']], value: 'below', parent: sec, onChange: (v) => { this.solventLevel = v; this.tank.setLevel(v === 'below' ? 0.06 : 0.16); } });
    ui.buttons([{ label: '💧 Spot the inks', onClick: () => this.spot() }, { label: '▶ Run', kind: 'primary', onClick: () => this.run() }, { label: '⏹ Remove paper', onClick: () => this.stop() }, { label: '⟲ New paper', onClick: () => this.reset() }], sec);
    this.ro = ui.readouts([{ id: 'f', label: 'Solvent front', unit: 'cm' }, { id: 's', label: 'Status' }], sec);
    const ms = ui.section('Measurements (from the baseline)');
    this.mt = ui.table(['Ink', 'Spots (distance / cm)'], ms);
    ui.buttons([{ label: '📏 Measure the chromatogram', onClick: () => this.measure() }], ms);
    const id = ui.section('Verdict');
    this.who = ui.select({ label: 'The forged ticket was signed with…', options: [['', '— choose —'], ['A', 'Festival pen (A)'], ['B', 'Pen B'], ['C', 'Pen C'], ['D', 'Pen D']], value: '', parent: id, onChange: (v) => this.verdict(v) });
    ui.notes();
    ui.questions([
      { q: '(S) Rf of the purple dye = distance moved by the dye ÷ distance moved by the solvent front. Use your measurements.', ans: () => (this.measured ? DYES.purple.rf : null), tol: 0.06, abs: 0.02, unit: '', e: 'Rf = {ans}. Rf has no units and is always less than 1.', o: [3], sub: 'C12.3', id: 'rf' },
      { q: 'Why is the baseline drawn in **pencil**, not ink?', opts: ['Pencil (graphite) is insoluble, so it does not run with the solvent', 'Pencil is easier to see', 'Ink would dissolve the paper', 'Pencil absorbs the solvent'], e: 'Ink lines would separate too and confuse the chromatogram.', o: [1], sub: 'C12.3' },
      { q: 'Why must the solvent start **below** the baseline?', opts: ['Otherwise the spots dissolve into the solvent in the tank', 'So the paper stays dry', 'To make the solvent move faster', 'So the spots move further'], e: 'The ink would wash off the paper instead of travelling up it.', o: [1], sub: 'C12.3' },
      { q: 'Pen D gave a single spot. This shows its ink is…', opts: ['a pure substance (one dye)', 'a mixture of dyes', 'insoluble', 'the same as the forgery'], e: 'A pure substance gives one spot; a mixture gives several.', o: [2], sub: 'C12.3' },
      { q: 'Which method separates a soluble coloured dye from a mixture of dyes?', opts: ['Chromatography', 'Filtration', 'Simple distillation', 'Crystallisation'], e: 'Different dyes have different solubilities and attraction to the paper.', o: [2], sub: 'C12.4' },
    ], { sub: 'C12.3', onDone: () => { this.st.done(6); this.check(); } });
    this.draw();
    this.every((dt) => this.sim(dt));
    this.ui.hint('Draw the baseline (pencil!), spot the inks, then run the chromatogram.', 6000);
  }
  spot() {
    if (this.running || this.front > 0) { this.ui.hint('Use a new paper to spot again.', 2500); return; }
    this.spotted = true; audio.blip(); this.draw();
    this.st.done(0);
    if (!this.pencil) this.ui.note('You drew the baseline in **ink** — watch what happens to it…', 'warn');
    else this.ui.note('Small, concentrated spots on a **pencil** baseline, 1.5 cm from the bottom.');
  }
  run() {
    if (!this.spotted) { this.ui.hint('Spot the inks first.', 2500); return; }
    if (this.front >= 1) return;
    this.running = true; audio.pour();
    if (this.solventLevel === 'above') this.ui.note('⚠️ The solvent is **above** the baseline — the spots are dissolving into the tank!', 'warn');
    else if (this.pencil) this.st.done(1);
  }
  stop() { if (!this.running && this.front === 0) return; this.running = false; this.ui.note('Paper removed and the **solvent front marked** in pencil before it evaporates.'); }
  reset() { this.front = 0; this.running = false; this.spotted = false; this.measured = false; this.mt.clear(); this.draw(); }
  sim(dt) {
    this.tank.update(dt);
    if (!this.running) return;
    this.front = Math.min(1, this.front + dt * 0.06 * (1 - this.front * 0.4));
    this.draw();
    const cm = (this.front * (FRONT_MAX - BASE) * 24).toFixed(1);
    this.ro.set('f', cm); this.ro.set('s', this.front >= 0.97 ? 'Front near the top' : 'Running…');
    if (this.front >= 0.97) { this.running = false; if (this.solventLevel === 'below' && this.pencil) { this.st.done(2); this.ui.note('The solvent front is near the top. Remove the paper and mark the front.', 'gold'); } else this.ui.note('Run finished — but the method was flawed. Fix it and use a new paper.', 'warn'); }
  }
  draw() {
    this.paperTex.redraw((ctx, w, hh) => {
      ctx.fillStyle = '#fbfaf5'; ctx.fillRect(0, 0, w, hh);
      const yOf = (f) => hh - f * hh;
      // wet region
      const fy = yOf(BASE + this.front * (FRONT_MAX - BASE));
      if (this.front > 0) { ctx.fillStyle = 'rgba(186,230,253,0.35)'; ctx.fillRect(0, fy, w, hh - fy); ctx.strokeStyle = 'rgba(30,64,175,.6)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(w, fy); ctx.stroke(); ctx.setLineDash([]); }
      // baseline
      const by = yOf(BASE);
      if (this.pencil) { ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(20, by); ctx.lineTo(w - 20, by); ctx.stroke(); }
      else { ctx.strokeStyle = '#1d4ed8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(20, by); ctx.lineTo(w - 20, by); ctx.stroke(); if (this.front > 0.05) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#1d4ed8'; ctx.fillRect(20, yOf(BASE + this.front * 0.7 * (FRONT_MAX - BASE)) - 6, w - 40, 12); ctx.globalAlpha = 1; } }
      ctx.fillStyle = '#374151'; ctx.font = '600 26px Inter'; ctx.textAlign = 'center';
      SAMPLES.forEach((s, i) => {
        const x = 60 + i * ((w - 120) / (SAMPLES.length - 1));
        ctx.fillText(s.id, x, hh - 14);
        if (!this.spotted) return;
        const washed = this.solventLevel === 'above' && this.front > 0;
        for (const d of s.dyes) {
          const dye = DYES[d];
          const f = BASE + dye.rf * this.front * (FRONT_MAX - BASE);
          const y = yOf(f);
          const spread = 10 + 22 * this.front * (0.5 + dye.rf * 0.5);
          ctx.globalAlpha = washed ? 0.12 : 0.85;
          const g = ctx.createRadialGradient(x, y, 2, x, y, spread);
          g.addColorStop(0, dye.col); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, spread * 0.9, spread * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      });
    });
  }
  measure() {
    if (this.front < 0.97) { this.ui.hint('Let the chromatogram finish first.', 2500); return; }
    if (this.solventLevel !== 'below' || !this.pencil) { this.ui.hint('Your chromatogram is not valid — fix the method and use new paper.', 3000); return; }
    if (this.measured) return;
    this.measured = true; audio.clink();
    const solv = (FRONT_MAX - BASE) * 24; // cm
    this.mt.add(['Solvent front', `<b>${solv.toFixed(1)}</b>`]);
    for (const s of SAMPLES) this.mt.add([`${s.id} — ${s.name}`, s.dyes.map((d) => `<span style="color:${DYES[d].col}">●</span> ${(DYES[d].rf * solv).toFixed(1)}`).join('  ')]);
    this.st.done(3);
    this.ui.note(`Solvent front: ${solv.toFixed(1)} cm. Purple dye: ${(DYES.purple.rf * solv).toFixed(1)} cm → Rf = ${(DYES.purple.rf * solv).toFixed(1)} ÷ ${solv.toFixed(1)}.`);
    const q = [...this.ui.body.querySelectorAll('.aq')][0]; q?.scrollIntoView?.({ block: 'nearest' });
    this.check();
  }
  verdict(v) {
    if (!this.measured) { this.ui.hint('Measure your chromatogram first.', 2500); this.who.set(''); return; }
    if (v === 'B') { audio.success(); this.st.done(5); this.ui.note('**Pen B** matches the forgery exactly — three spots at the same heights (same Rf values). The festival pen (A) has a blue dye instead of yellow.', 'gold'); }
    else { audio.fail(); this.ui.note('Compare the spots: the matching ink must have the **same number of spots at the same heights**.', 'warn'); }
    this.check();
  }
  check() {
    const rfBox = [...this.ui.body.querySelectorAll('.aq')][0];
    if (rfBox?.classList.contains('solved')) this.st.done(4);
    this.st.check();
  }
  update(dt, t) { super.update(dt, t); if (!this.st.isDone(4)) { const rfBox = this.ui.body?.querySelector('.aq'); if (rfBox?.classList.contains('solved')) { this.st.done(4); this.check(); } } }
}
void h; void clamp; void mat;
