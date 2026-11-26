import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { mesh, mat, M } from '../apparatus.js';
import { h, clamp } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const S = 0.0062, G = 9.8, BRAKE_X = 96, END_X = 124;

export default class Energy extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'The festival roller-coaster needs a safety certificate. Track every joule — from the lift motor to the final brakes — and prove the ride is safe.';
    this.view = { pos: [0.0, 1.36, 1.32], target: [0.0, 1.06, 0] };
    this.p = { h0: 30, m: 400, fric: false, Fb: 4000, P: 20 };
    this.run = null; this.flags = {};
  }
  profile(h0) {
    const pts = [[0, 2], [5, h0 * 0.55], [10, h0], [14, h0 * 0.97], [24, h0 * 0.45], [34, 2], [44, h0 * 0.35], [56, h0 * 0.62], [66, h0 * 0.35], [78, 2.5], [88, 2], [BRAKE_X, 2], [END_X, 2]];
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
    const N = 700, P = curve.getSpacedPoints(N);
    const cum = [0]; for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + P[i].distanceTo(P[i - 1]));
    return { curve, P, cum, L: cum[N], N };
  }
  at(s) {
    const pr = this.pr; s = clamp(s, 0, pr.L);
    let lo = 0, hi = pr.N; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pr.cum[mid] < s) lo = mid; else hi = mid; }
    const k = (s - pr.cum[lo]) / Math.max(1e-6, pr.cum[hi] - pr.cum[lo]);
    const p = pr.P[lo].clone().lerp(pr.P[hi], k), d = pr.P[hi].clone().sub(pr.P[lo]).normalize();
    return { p, d };
  }
  sAtX(x) { const pr = this.pr; for (let i = 0; i <= pr.N; i++) if (pr.P[i].x >= x) return pr.cum[i]; return pr.L; }
  build() {
    const ui = this.ui;
    this.trackG = new THREE.Group(); this.lab.add(this.trackG, -0.38, this.Y, 0);
    this.cart = new THREE.Group(); this.trackG.add(this.cart);
    this.cart.add(mesh(new THREE.BoxGeometry(0.03, 0.012, 0.026), mat('#dc2626', 0.4, 0.35), 0, 0.01, 0), mesh(new THREE.BoxGeometry(0.008, 0.012, 0.024), mat('#111827'), -0.008, 0.02, 0));
    this.cartLbl = this.lab.label(this.cart, '', { y: 0.05, cls: 'val' });
    this.buildTrack();
    this.st = ui.steps(['Release the cart **without friction** and watch GPE ↔ KE', '(S) Calculate the **speed** at the bottom of the first drop', 'Turn **friction on**: where does the energy go? (Sankey)', 'Stop the cart in the brake run: **work = force × distance**', 'Haul the cart up the lift hill: **power = work ÷ time**', 'Answer the analysis questions']);
    const sec = ui.section('Ride settings');
    ui.slider({ label: 'Lift-hill height', min: 20, max: 40, step: 5, value: this.p.h0, unit: 'm', parent: sec, onInput: (v) => { this.p.h0 = v; this.buildTrack(); } });
    ui.slider({ label: 'Cart + riders mass', min: 200, max: 600, step: 100, value: this.p.m, unit: 'kg', parent: sec, onInput: (v) => { this.p.m = v; } });
    ui.seg({ label: 'Friction & air resistance', options: [[false, 'Off (ideal)'], [true, 'On (realistic)']], value: false, parent: sec, onChange: (v) => { this.p.fric = v === true || v === 'true'; } });
    ui.slider({ label: 'Brake force', min: 2000, max: 8000, step: 1000, value: this.p.Fb, unit: 'N', parent: sec, onInput: (v) => { this.p.Fb = v; } });
    ui.slider({ label: 'Lift motor power', min: 10, max: 50, step: 10, value: this.p.P, unit: 'kW', parent: sec, onInput: (v) => { this.p.P = v; } });
    ui.buttons([{ label: '▶ Release from the top', kind: 'primary', onClick: () => this.release() }, { label: '⛓️ Haul up the lift hill', onClick: () => this.haul() }], sec);
    this.ro = ui.readouts([{ id: 'v', label: 'Speed', unit: 'm/s' }, { id: 'h', label: 'Height', unit: 'm' }, { id: 't', label: 'Time', unit: 's' }], sec);
    this.bars = h('canvas', { width: 640, height: 230, class: 'graph', style: { height: '125px' } }); ui.section('Energy stores (kJ)').append(this.bars);
    this.sankey = h('canvas', { width: 640, height: 230, class: 'graph', style: { height: '125px', display: 'none' } }); ui.section('Sankey diagram').append(this.sankey);
    ui.notes();
    this.qs = ui.questions([
      { q: '(S) Use ½mv² = mgΔh: what is the speed at the bottom of the **first drop** (Δh = lift height − 2 m), with no friction?', ans: () => (this.lastH0 ? Math.sqrt(2 * G * (this.lastH0 - 2)) : null), tol: 0.03, abs: 0.1, unit: 'm/s', e: 'v = √(2gΔh) = {ans} m/s — the mass cancels!', o: [4, 5], sub: 'P1.6.1' },
      { q: 'Use your brake-run note: distance needed to stop = KE ÷ brake force. What is it?', ans: () => (this.brake ? this.brake.KE / this.brake.F : null), tol: 0.04, abs: 0.1, unit: 'm', e: 'W = F × d, so d = {ans} m.', o: [2], sub: 'P1.6.2' },
      { q: 'Use your lift note: time = work done ÷ power. How long did the lift take?', ans: () => (this.lift ? this.lift.W / this.lift.P : null), tol: 0.04, abs: 0.1, unit: 's', e: 'P = W ÷ t, so t = {ans} s.', o: [1], sub: 'P1.6.4' },
      { q: 'As the cart rolls down a hill, energy is transferred from…', opts: ['the gravitational potential store to the kinetic store', 'the kinetic store to the chemical store', 'the thermal store to the nuclear store', 'the elastic store to the GPE store'], e: 'The total energy stays the same: energy is conserved.', o: [1, 2], sub: 'P1.6.1' },
      { q: 'With friction on, the cart cannot reach the same height again because…', opts: ['some energy is transferred to the thermal store of the track, wheels and air', 'energy is destroyed', 'the mass increases', 'gravity gets stronger'], e: 'Energy is conserved but dissipated, so the useful output is less than the input.', o: [3], sub: 'P1.6.1' },
      { q: 'The lift motor gives 600 kJ of useful work for every 800 kJ of electrical energy supplied. Its efficiency is…', ans: 75, tol: 0.01, unit: '%', e: 'Efficiency = useful ÷ total × 100 = {ans} %.', o: [7], sub: 'P1.6.3' },
    ], { sub: 'P1.6.1', onDone: () => { this.st.done(5); this.check(); } });
    this.every((dt) => this.sim(dt));
    this.placeAt(this.sAtX(10));
    this.drawBars(this.p.m * G * this.p.h0, 0, 0);
  }
  buildTrack() {
    if (this.run) this.run = null;
    if (this.rails) this.trackG.remove(this.rails);
    this.pr = this.profile(this.p.h0);
    const g = (this.rails = new THREE.Group()); this.trackG.add(g);
    const pts = this.pr.P.map((p) => new THREE.Vector3(p.x * S, p.y * S + 0.03, 0));
    const curve = new THREE.CatmullRomCurve3(pts);
    for (const z of [-0.011, 0.011]) { const t = new THREE.Mesh(new THREE.TubeGeometry(curve, 400, 0.0018, 6, false), mat('#94a3b8', 0.8, 0.3)); t.position.z = z; g.add(t); }
    for (let x = 2; x < END_X; x += 6) { const s = this.sAtX(x), { p } = this.at(s); const hgt = p.y * S + 0.03; g.add(mesh(new THREE.CylinderGeometry(0.0022, 0.0022, hgt, 6), mat('#475569', 0.5, 0.4), p.x * S, hgt / 2, -0.011), mesh(new THREE.CylinderGeometry(0.0022, 0.0022, hgt, 6), mat('#475569', 0.5, 0.4), p.x * S, hgt / 2, 0.011)); }
    for (let x = BRAKE_X; x < END_X - 2; x += 2.5) g.add(mesh(new THREE.BoxGeometry(0.004, 0.006, 0.008), mat('#facc15', 0.3, 0.4), x * S, 2 * S + 0.03, 0));
    const lift = new THREE.Object3D(); lift.position.set(5 * S, this.p.h0 * 0.6 * S + 0.04, 0); g.add(lift); this.lab.label(lift, 'Lift hill', { y: 0.02, cls: 'dimlab' });
    const br = new THREE.Object3D(); br.position.set((BRAKE_X + 10) * S, 0.05, 0); g.add(br); this.lab.label(br, 'Brake run', { y: 0.02, cls: 'dimlab' });
    this.placeAt(this.sAtX(10));
  }
  placeAt(s) {
    const { p, d } = this.at(s);
    this.cart.position.set(p.x * S, p.y * S + 0.03 + 0.002, 0);
    this.cart.rotation.z = Math.atan2(d.y, d.x);
  }
  release() {
    const p = this.p; const pr = this.pr;
    let iPk = 0; for (let i = 0; i <= pr.N; i++) { if (pr.P[i].x > 22) break; if (pr.P[i].y > pr.P[iPk].y) iPk = i; }
    const s0 = pr.cum[iPk] + 0.3, y0 = this.at(s0).p.y;
    this.run = { s: s0, dir: 1, t: 0, E0: p.m * G * y0 + 0.5 * p.m * 1.2 * 1.2, m: p.m, fric: p.fric, Fb: p.Fb, thermal: 0, braked: 0, done: false, h0: p.h0, vmax: 0, entered: false };
    this.lastH0 = p.h0; audio.whoosh?.();
  }
  haul() {
    if (this.run && !this.run.done) return;
    const p = this.p, s1 = this.sAtX(10);
    const W = p.m * G * (p.h0 - 2), P = p.P * 1000, T = W / P;
    this.hauling = { s: 0, s1, T, t: 0, W, P };
    this.placeAt(0); audio.click();
  }
  sim(dt) {
    if (this.hauling) {
      const hl = this.hauling; hl.t += dt * Math.max(1, hl.T / 6);
      const s = (hl.t / hl.T) * hl.s1; this.placeAt(Math.min(s, hl.s1));
      const { p } = this.at(s); this.ro.set('h', p.y.toFixed(1)); this.ro.set('v', (hl.s1 / hl.T).toFixed(2)); this.ro.set('t', Math.min(hl.t, hl.T).toFixed(1));
      this.drawBars(this.p.m * G * p.y, 0, 0);
      if (hl.t >= hl.T) {
        this.hauling = null; this.lift = { W: hl.W, P: hl.P };
        this.ui.note(`Lift: work done raising ${this.p.m} kg by ${(this.p.h0 - 2).toFixed(0)} m = mgΔh = **${(hl.W / 1000).toFixed(1)} kJ**, motor power **${this.p.P} kW**. Now calculate the time.`, 'gold');
        this.st.done(4); this.check();
      }
      return;
    }
    const r = this.run; if (!r || r.done) return;
    const steps = 4; const h = dt / steps;
    for (let k = 0; k < steps; k++) {
      const { p } = this.at(r.s);
      const inBrake = p.x >= BRAKE_X;
      const KE = r.E0 - r.m * G * p.y - r.thermal - r.braked;
      if (KE <= 0) {
        if (inBrake) { r.done = true; break; }
        r.dir *= -1; r.thermal = Math.max(0, r.E0 - r.m * G * p.y - r.braked); if (!r.fric) { r.done = true; break; }
      }
      const v = Math.sqrt(Math.max(0, 2 * Math.max(0, KE) / r.m));
      const ds = Math.max(v, 0.3) * h * r.dir;
      r.s = clamp(r.s + ds, 0, this.pr.L);
      if (r.fric) r.thermal += 0.035 * r.m * G * Math.abs(ds);
      if (inBrake && r.dir > 0) { if (!r.entered) { r.entered = true; r.KEin = Math.max(0, KE); r.sIn = r.s; } r.braked += r.Fb * Math.abs(ds); }
      r.vmax = Math.max(r.vmax, v);
      if (r.s >= this.pr.L - 0.01) { r.done = true; r.crash = true; break; }
    }
    r.t += dt;
    const { p } = this.at(r.s); this.placeAt(r.s);
    const KE = Math.max(0, r.E0 - r.m * G * p.y - r.thermal - r.braked), v = Math.sqrt(2 * KE / r.m);
    this.ro.set('v', v.toFixed(1)); this.ro.set('h', p.y.toFixed(1)); this.ro.set('t', r.t.toFixed(1));
    this.cartLbl.userData.set(`${v.toFixed(1)} m/s`);
    this.drawBars(r.m * G * p.y, KE, r.thermal + r.braked);
    if (r.done) this.finish(r);
  }
  finish(r) {
    audio.clink();
    if (r.crash) { this.ui.note('💥 The cart reached the end of the brake run still moving! Increase the brake force.', 'warn'); return; }
    if (r.entered) {
      const d = (r.s - r.sIn);
      this.brake = { KE: r.KEin, F: r.Fb };
      this.ui.note(`Brake run: the cart entered with **${(r.KEin / 1000).toFixed(1)} kJ** of kinetic energy and the brakes pushed with **${r.Fb} N**. It stopped after ${d.toFixed(1)} m. Work done by the brakes = F × d → kinetic → thermal.`, 'gold');
      this.st.done(3);
    }
    if (!r.fric && r.entered) { this.st.done(0); this.ui.note(`No friction: the cart reached **${r.vmax.toFixed(1)} m/s** at the lowest point. GPE → KE → GPE → KE… total energy constant at ${(r.E0 / 1000).toFixed(1)} kJ.`, 'gold'); }
    if (r.fric) {
      this.st.done(2);
      const total = r.E0, heat = r.thermal, brake = r.braked;
      this.drawSankey(total, heat, brake);
      this.ui.note(`With friction, **${(heat / 1000).toFixed(1)} kJ** was dissipated to the thermal store (warm wheels, rails and air) before the brakes. Energy is conserved — but spread out and less useful.`, 'gold');
    }
    this.check();
  }
  drawBars(gpe, ke, th) {
    const c = this.bars, ctx = c.getContext('2d'), W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const E0 = this.p.m * G * 40 || 1; const items = [['GPE', gpe, '#60a5fa'], ['Kinetic', ke, '#f97316'], ['Thermal', th, '#f43f5e'], ['Total', gpe + ke + th, '#e2e8f0']];
    items.forEach(([n, v, col], i) => {
      const bh = clamp(v / E0, 0, 1) * (H - 60), x = 40 + i * 150;
      ctx.fillStyle = col; ctx.fillRect(x, H - 30 - bh, 90, bh);
      ctx.fillStyle = '#e2e8f0'; ctx.font = '600 22px Inter'; ctx.textAlign = 'center'; ctx.fillText(n, x + 45, H - 6); ctx.fillText((v / 1000).toFixed(0), x + 45, H - 36 - bh);
    });
  }
  drawSankey(total, heat, brake) {
    const c = this.sankey; c.style.display = ''; const ctx = c.getContext('2d'), W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const k = 140 / total, wIn = total * k, wHeat = heat * k, wB = brake * k;
    ctx.fillStyle = '#60a5fa'; ctx.fillRect(20, 40, 260, wIn);
    ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.moveTo(280, 40 + wIn - wHeat); ctx.lineTo(330, 40 + wIn - wHeat); ctx.quadraticCurveTo(380, 40 + wIn, 380, H - 10); ctx.lineTo(380 - wHeat, H - 10); ctx.quadraticCurveTo(380 - wHeat, 40 + wIn, 280, 40 + wIn); ctx.fill();
    ctx.fillStyle = '#f97316'; ctx.fillRect(280, 40, 330, Math.max(2, wB));
    ctx.fillStyle = '#e2e8f0'; ctx.font = '600 20px Inter';
    ctx.fillText(`GPE at top ${(total / 1000).toFixed(0)} kJ (100%)`, 24, 30);
    ctx.fillText(`friction → thermal ${(100 * heat / total).toFixed(0)}%`, 390, H - 20);
    ctx.fillText(`kinetic → brakes ${(100 * brake / total).toFixed(0)}%`, 400, 30);
  }
  check() {
    const boxes = this.qs?.querySelectorAll('.aq');
    if (boxes?.[0]?.classList.contains('solved')) this.st.done(1);
    if ([0, 1, 2, 3, 4, 5].every((i) => this.st.isDone(i))) this.lab.complete();
  }
  update(dt, t) { super.update(dt, t); if (!this.st?.isDone(1) && this.qs?.querySelector('.aq')?.classList.contains('solved')) { this.st.done(1); this.check(); } }
}
void M;
