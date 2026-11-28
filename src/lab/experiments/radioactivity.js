import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { stand, mesh, mat, M } from '../apparatus.js';
import { h, clamp, canvasTex } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const BG = 22; // background counts per minute
const SRC = {
  none: { name: 'No source (background)', col: '#94a3b8' },
  alpha: { name: 'α source (americium-241)', col: '#ef4444', base: 3200, range: 5, abs: { none: 1, paper: 0, al: 0, lead: 0 } },
  beta: { name: 'β source (strontium-90)', col: '#3b82f6', base: 2100, range: 100, abs: { none: 1, paper: 0.95, al: 0.002, lead: 0 } },
  gamma: { name: 'γ source (cobalt-60)', col: '#facc15', base: 900, range: 1000, abs: { none: 1, paper: 1, al: 0.96, lead: 0.22 } },
};
const ABS = { none: { name: 'None', col: null }, paper: { name: 'Paper', col: '#f8fafc', t: 0.0015 }, al: { name: 'Aluminium (3 mm)', col: '#cbd5e1', t: 0.005 }, lead: { name: 'Lead (2 cm)', col: '#3f3f46', t: 0.03 } };
function poisson(l) { if (l > 50) return Math.max(0, Math.round(l + Math.sqrt(l) * (Math.random() + Math.random() + Math.random() - 1.5) * 1.41)); let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= Math.random(); } while (p > L); return k - 1; }

export default class Radioactivity extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'The clinic’s new scanner uses a radioactive tracer, and the island’s smoke alarms contain americium. Measure what α, β and γ can get through — and how quickly a sample decays.';
    this.tabLabels = [['penetration', '☢️ Penetration'], ['halflife', '⏳ Half-life']];
    this.tabObjectives = { penetration: ['P5.2.1', 'P5.2.2', 'P5.2.5'], halflife: ['P5.2.3', 'P5.2.4', 'P5.1'] };
    this.tabViews = { penetration: { pos: [0, 1.32, 0.75], target: [0, 1.0, 0] }, halflife: { pos: [0, 1.4, 0.8], target: [0, 1.0, 0] } };
    this.view = this.tabViews.penetration;
  }
  checkTab(id, st) { st.check(); }

  // ======================================================== penetration
  tab_penetration() {
    const Y = this.Y;
    this.pn = { src: 'none', abs: 'none', d: 4, counting: null, bg: null, res: new Set() };
    const st = stand(0.25); this.lab.add(st, 0.22, Y, -0.04);
    this.gm = new THREE.Group(); this.lab.add(this.gm, 0.14, Y + 0.1, 0);
    this.gm.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 18), mat('#cbd5e1', 0.7, 0.3), 0.05, 0, 0).rotateZ(Math.PI / 2), mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 18), mat('#7c2d12', 0, 0.5), -0.002, 0, 0).rotateZ(Math.PI / 2));
    this.lab.label(this.gm, 'Geiger–Müller tube', { y: 0.04, x: 0.05 });
    const counter = new THREE.Group(); this.lab.add(counter, 0.25, Y, 0.14);
    counter.add(mesh(new THREE.BoxGeometry(0.14, 0.06, 0.08), mat('#334155'), 0, 0.03, 0));
    this.lcd = canvasTex(256, 96); const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.04), new THREE.MeshBasicMaterial({ map: this.lcd.tex, toneMapped: false })); scr.position.set(0, 0.035, 0.0405); counter.add(scr);
    this.lab.label(counter, 'Counter', { y: 0.09, cls: 'dimlab' });
    this.srcG = new THREE.Group(); this.lab.add(this.srcG, 0.14 - 0.04 - 0.002, Y + 0.1, 0);
    this.srcG.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.03, 16), mat('#475569', 0.6, 0.4), -0.015, 0, 0).rotateZ(Math.PI / 2), mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.15, 8), M.steel, -0.1, 0, 0).rotateZ(Math.PI / 2));
    this.srcDot = mesh(new THREE.SphereGeometry(0.005, 10, 8), new THREE.MeshBasicMaterial({ color: '#94a3b8' }), 0.001, 0, 0); this.srcG.add(this.srcDot);
    this.srcLbl = this.lab.label(this.srcG, 'Source holder (handled with tongs)', { y: 0.04 });
    this.absM = mesh(new THREE.BoxGeometry(0.004, 0.08, 0.08), mat('#f8fafc', 0, 0.8)); this.absM.visible = false; this.lab.add(this.absM, 0.128, Y + 0.1, 0);
    this.particles = []; this.pGeo = new THREE.SphereGeometry(1, 8, 6);
    const ui = this.ui;
    this.stP = ui.steps(['Measure the **background count** first (no source)', '**α:** what stops it?', '**β:** what stops it?', '**γ:** what reduces it?', 'Answer the analysis questions']);
    const sec = ui.section('Set-up');
    ui.select({ label: 'Source', options: Object.entries(SRC).map(([k, v]) => [k, v.name]), value: 'none', parent: sec, onChange: (v) => { this.pn.src = v; this.srcDot.material.color.set(SRC[v].col); this.srcLbl.userData.set(SRC[v].name); } });
    ui.seg({ label: 'Absorber', options: Object.entries(ABS).map(([k, v]) => [k, v.name]), value: 'none', parent: sec, onChange: (v) => { this.pn.abs = v; const a = ABS[v]; this.absM.visible = !!a.col; if (a.col) { this.absM.material.color.set(a.col); this.absM.scale.x = a.t / 0.004; } } });
    ui.slider({ label: 'Source–tube distance', min: 2, max: 20, step: 1, value: this.pn.d, unit: 'cm', parent: sec, onInput: (v) => { this.pn.d = v; this.srcG.position.x = 0.14 - v / 100 - 0.002; } });
    ui.buttons([{ label: '▶ Count for one minute', kind: 'primary', onClick: () => this.count() }], sec);
    this.tP = ui.table(['Source', 'Absorber', 'd / cm', 'counts/min', '− background'], sec);
    const safe = ui.section('Handling sources safely');
    ui.text('Keep **time** short, keep your **distance** (tongs, never fingers), use **shielding** (lead-lined box), never point a source at anyone, and store it locked away.', safe);
    ui.notes();
    ui.questions([
      { q: 'Which radiation is the **most ionising** but stopped by a sheet of paper?', opts: ['Alpha (α)', 'Beta (β)', 'Gamma (γ)', 'All equally'], e: 'α particles are helium nuclei: heavy, strongly ionising, short range.', o: [1], sub: 'P5.2.2' },
      { q: 'Why must the background count be measured and subtracted?', opts: ['There is always some radiation from rocks, cosmic rays, food and the air (radon)', 'The tube is faulty', 'The source gets stronger with time', 'To warm up the counter'], e: 'Background radiation is all around us.', o: [1, 2], sub: 'P5.2.1' },
      { q: 'A smoke alarm uses an **α source** because…', opts: ['α ionises the air between two plates; smoke absorbs the α particles and the current drops, setting off the alarm', 'γ would be too weak', 'α passes through walls to warn neighbours', 'it never decays'], e: 'Its short range also keeps it safe inside the alarm.', o: [1], sub: 'P5.2.5' },
      { q: 'Paper-mill thickness gauges use **β** sources because…', opts: ['β is partly absorbed by paper — the count rate changes with thickness', 'β passes straight through anything', 'β is stopped by air', 'β is not ionising'], e: 'α would be stopped completely; γ would pass through unchanged.', o: [1], sub: 'P5.2.5' },
      { q: 'Ionising radiation is dangerous to living cells because it can…', opts: ['kill cells or damage DNA, causing mutations and cancer', 'make cells radioactive forever', 'only heat the skin', 'turn cells into metal'], e: 'That same cell-killing effect is used to treat cancer.', o: [2], sub: 'P5.2.5' },
    ], { sub: 'P5.2.2', onDone: () => { this.stP.done(4); this.checkTab('penetration', this.stP, 5); } });
    this.drawLCD(0, 0);
    this.every((dt) => this.simPen(dt));
  }
  rate() {
    const p = this.pn, s = SRC[p.src];
    if (p.src === 'none') return BG;
    const geo = (4 / p.d) ** 2, air = p.src === 'alpha' ? (p.d <= s.range ? 1 : 0) : 1;
    return BG + s.base * geo * air * s.abs[p.abs];
  }
  count() {
    if (this.pn.counting) return;
    this.pn.counting = { t: 0, n: 0, lam: this.rate(), key: `${this.pn.src}|${this.pn.abs}` };
  }
  simPen(dt) {
    const c = this.pn.counting;
    if (c) {
      c.t += dt * 6; // one minute in 10 s
      const exp = c.lam * (dt * 6) / 60; const k = poisson(exp); c.n += k;
      for (let i = 0; i < Math.min(k, 3); i++) audio.geiger();
      this.drawLCD(c.n, Math.min(60, c.t));
      if (c.t >= 60) {
        this.pn.counting = null; const cpm = c.n, corr = Math.max(0, cpm - (this.pn.bg ?? BG));
        if (this.pn.src === 'none') { this.pn.bg = cpm; this.stP.done(0); this.ui.note(`Background: **${cpm} counts per minute** — from rocks, cosmic rays, food and radon in the air. Subtract it from every reading.`, 'gold'); }
        this.tP.add([this.pn.src === 'none' ? 'none' : this.pn.src, ABS[this.pn.abs].name, this.pn.d, cpm, this.pn.src === 'none' ? '—' : corr]);
        this.pn.res.add(c.key + (corr < 20 ? '|0' : '|1'));
        this.judge();
      }
    }
    // particle stream
    const p = this.pn;
    if (c && p.src !== 'none' && Math.random() < dt * 30) {
      const s = SRC[p.src], m = new THREE.Mesh(this.pGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(s.col).multiplyScalar(2) }));
      const size = p.src === 'alpha' ? 0.004 : p.src === 'beta' ? 0.0022 : 0.0018; m.scale.setScalar(size);
      const start = this.srcG.position.clone(); m.position.copy(start); m.userData = { v: p.src === 'alpha' ? 0.15 : p.src === 'beta' ? 0.4 : 0.7, life: 0, z0: (Math.random() - 0.5) * 0.03, y0: (Math.random() - 0.5) * 0.03, kind: p.src };
      this.lab.tabRoot.add(m); this.particles.push(m);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const m = this.particles[i], u = m.userData; u.life += dt; m.position.x += u.v * dt;
      m.position.y = this.Y + 0.1 + u.y0 * (m.position.x - this.srcG.position.x) * 4 + (u.kind === 'gamma' ? Math.sin(u.life * 80) * 0.002 : 0); m.position.z = u.z0 * (m.position.x - this.srcG.position.x) * 4;
      const sx = SRC[u.kind]; const passAbs = Math.random() < (sx.abs[this.pn.abs] ?? 1) || !this.absM.visible;
      const dead = (u.kind === 'alpha' && m.position.x - this.srcG.position.x > 0.05) || (this.absM.visible && m.position.x > this.absM.position.x && !u.checked && (u.checked = true) && !passAbs) || m.position.x > 0.16;
      if (dead) { this.lab.tabRoot.remove(m); m.material.dispose(); this.particles.splice(i, 1); }
    }
  }
  judge() {
    const r = this.pn.res;
    if (r.has('alpha|none|1') && (r.has('alpha|paper|0')) && !this.stP.isDone(1)) { this.stP.done(1); this.ui.note('**α** is stopped by a sheet of **paper** (or a few cm of air).', 'gold'); }
    if (r.has('beta|paper|1') && r.has('beta|al|0') && !this.stP.isDone(2)) { this.stP.done(2); this.ui.note('**β** passes through paper but is stopped by a few mm of **aluminium**.', 'gold'); }
    if (r.has('gamma|al|1') && r.has('gamma|lead|1') && !this.stP.isDone(3)) { this.stP.done(3); this.ui.note('**γ** passes through aluminium and is only **reduced** by thick **lead** (or concrete). It is the least ionising.', 'gold'); }
    this.checkTab('penetration', this.stP, 5);
  }
  drawLCD(n, t) { this.lcd.redraw((ctx, W, H) => { ctx.fillStyle = '#0b1f17'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#6ff7b0'; ctx.font = '700 46px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(String(n).padStart(5, '0'), W / 2, 52); ctx.font = '600 22px ui-monospace, monospace'; ctx.fillText(`${t.toFixed(0)} s`, W / 2, 84); }); }

  // ======================================================== half-life
  tab_halflife() {
    const Y = this.Y;
    const choices = [20, 30, 40, 50];
    this.hl = { T: choices[Math.floor(Math.random() * choices.length)], N0: 400, t: 0, run: false, alive: null, eq: false };
    const tray = mesh(new THREE.BoxGeometry(0.42, 0.01, 0.42), mat('#1e293b', 0.3, 0.5)); this.lab.add(tray, 0, Y + 0.005, 0);
    this.nuc = new THREE.InstancedMesh(new THREE.SphereGeometry(0.007, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, emissive: '#000000' }), 400); this.nuc.frustumCulled = false; this.lab.add(this.nuc, 0, Y + 0.018, 0);
    const o = new THREE.Object3D(); for (let i = 0; i < 400; i++) { o.position.set(-0.19 + (i % 20) * 0.02, 0, -0.19 + Math.floor(i / 20) * 0.02); o.updateMatrix(); this.nuc.setMatrixAt(i, o.matrix); this.nuc.setColorAt(i, new THREE.Color('#22c55e')); }
    this.nuc.instanceMatrix.needsUpdate = true; this.nuc.instanceColor.needsUpdate = true;
    this.lab.label(tray, 'Sample of 400 unstable nuclei (green = undecayed)', { y: 0.05 });
    const ui = this.ui;
    this.stL = ui.steps(['Start the decay and watch it happen **randomly**', { t: 'Read the **half-life** from your graph', q: true }, { t: '(S) Complete a **decay equation**', o: ['P5.2.3.4'] }, 'Answer the analysis questions']);
    const sec = ui.section('Decay');
    ui.buttons([{ label: '▶ Start', kind: 'primary', onClick: () => this.startDecay() }, { label: '⟲ Fresh sample', onClick: () => this.resetDecay() }], sec);
    this.roL = ui.readouts([{ id: 't', label: 'Time', unit: 's' }, { id: 'N', label: 'Undecayed nuclei' }], sec);
    this.gL = ui.graph({ x: { label: 'Time / s', min: 0, max: 200 }, y: { label: 'Undecayed nuclei', min: 0, max: 400 }, series: [{ name: 'N', color: '#22c55e', line: true, points: false }], height: 170 }, sec);
    const eq = ui.section('(S) Decay equation: carbon-14 (used in carbon dating)');
    eq.append(h('div', { style: { fontFamily: 'var(--display)', margin: '6px 0' } }, '¹⁴₆C → ? + ⁰₋₁e'));
    ui.seg({ options: [['n', '¹⁴₇N'], ['b', '¹⁴₅B'], ['c', '¹³₆C'], ['o', '¹⁰₄Be']], value: null, parent: eq, onChange: (v) => { if (v === 'n') { audio.success(); this.stL.done(2); this.ui.note('**¹⁴₆C → ¹⁴₇N + ⁰₋₁e.** In β decay a neutron turns into a proton (Z rises by 1) and an electron is emitted; the nucleon number stays 14. The element changes to nitrogen.', 'gold'); this.checkTab('halflife', this.stL, 4); } else { audio.fail(); this.ui.note('Balance the top (nucleon) numbers and the bottom (proton) numbers on both sides.', 'warn'); } } });
    ui.notes();
    this.qsL = ui.questions([
      { q: 'Use your graph: how long did it take for the undecayed nuclei to fall from 400 to 200?', ans: () => (this.hl.t > this.hl.T * 1.2 ? this.hl.T : null), tol: 0.15, unit: 's', e: 'Half-life ≈ {ans} s. Check: 200 → 100 takes the same time again.', o: [1], sub: 'P5.2.4' },
      { q: 'After **three** half-lives, what fraction of the original nuclei is left undecayed?', opts: ['1/8', '1/3', '1/6', '1/2'], e: '½ × ½ × ½ = 1/8.', o: [1], sub: 'P5.2.4' },
      { q: 'Radioactive decay is described as **random** because…', opts: ['you cannot predict which nucleus will decay next, or when', 'it happens at random temperatures', 'the half-life keeps changing', 'nuclei choose to decay'], e: 'But for large numbers, the half-life is very predictable.', o: [1], sub: 'P5.2.3' },
      { q: 'A medical tracer should have a half-life of…', opts: ['a few hours — long enough to scan, short enough to fade quickly in the body', 'thousands of years', 'a fraction of a second', 'exactly one year'], e: 'Technetium-99m (6 hours) is the most used medical tracer.', o: [1], sub: 'P5.2.5' },
      { q: 'In α decay, the nucleus loses…', opts: ['2 protons and 2 neutrons', '1 electron', 'only energy', '1 neutron'], e: 'So the proton number falls by 2 and the nucleon number by 4 — a new element forms.', o: [2], sub: 'P5.2.3' },
    ], { sub: 'P5.2.4', onDone: () => { this.stL.done(3); this.checkTab('halflife', this.stL, 4); } });
    this.every((dt) => this.simDecay(dt));
  }
  resetDecay() { this.hl.t = 0; this.hl.run = false; this.hl.alive = new Uint8Array(400).fill(1); for (let i = 0; i < 400; i++) this.nuc.setColorAt(i, new THREE.Color('#22c55e')); this.nuc.instanceColor.needsUpdate = true; this.gL.clear(); this.roL.set('t', 0); this.roL.set('N', 400); }
  startDecay() { if (!this.hl.alive) this.resetDecay(); this.hl.run = true; audio.click(); }
  simDecay(dt) {
    const hl = this.hl; if (!hl.run) return;
    const step = dt * 6; hl.t += step;
    const p = 1 - Math.pow(0.5, step / hl.T);
    let n = 0, changed = false;
    for (let i = 0; i < 400; i++) { if (!hl.alive[i]) continue; if (Math.random() < p) { hl.alive[i] = 0; this.nuc.setColorAt(i, new THREE.Color('#475569')); changed = true; if (Math.random() < 0.1) audio.geiger(); } else n++; }
    if (changed) this.nuc.instanceColor.needsUpdate = true;
    this._gs = (this._gs || 0) + step; if (this._gs > 2) { this._gs = 0; this.gL.add(0, +hl.t.toFixed(1), n); }
    this.roL.set('t', hl.t.toFixed(0)); this.roL.set('N', n);
    if (hl.t > hl.T * 0.6 && !this.stL.isDone(0)) { this.stL.done(0); this.ui.note('Nuclei decay at **random** — you can’t tell which green dot will go grey next. But the total halves every half-life.', 'gold'); }
    if (hl.t >= 200 || n === 0) { hl.run = false; this.ui.note('Run finished. Read the time for 400 → 200 (and 200 → 100) from the graph.'); }
    const b = this.qsL?.querySelector('.aq'); if (b?.classList.contains('solved') && !this.stL.isDone(1)) { this.stL.done(1); this.checkTab('halflife', this.stL, 4); }
  }
  update(dt, t) { super.update(dt, t); if (this.tab === 'halflife' && this.stL && !this.stL.isDone(1)) { const b = this.qsL?.querySelector('.aq'); if (b?.classList.contains('solved')) { this.stL.done(1); this.checkTab('halflife', this.stL, 4); } } }
}
void clamp;
