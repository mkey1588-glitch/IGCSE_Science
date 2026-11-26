import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { Stopwatch, stand, ruler, mesh, mat, M } from '../apparatus.js';
import { h, clear, canvasTex, roundRect } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const SCALE = 0.009, X0 = -0.45; // 1 m of track = 0.009 lab units; 0 m at x = -0.45
const QTY = [['distance', 'scalar'], ['speed', 'scalar'], ['time', 'scalar'], ['mass', 'scalar'], ['energy', 'scalar'], ['temperature', 'scalar'], ['velocity', 'vector'], ['force', 'vector'], ['weight', 'vector'], ['acceleration', 'vector']];

export default class Motion extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Ravi is building a go-kart track for the festival and the harbour road needs speed limits. Program a kart, then read its motion from the graphs — the way engineers and police do.';
    this.tabLabels = [['track', '🏎️ Motion track'], ['timing', '⏱️ Timing bench']];
    this.tabObjectives = { track: ['P1.2'], timing: ['P1.1', 'P1.2', 'P1.3'] };
    this.tabViews = { track: { pos: [0, 1.38, 0.95], target: [0, 0.95, 0] }, timing: { pos: [0.05, 1.5, 1.65], target: [0.05, 1.38, 0] } };
    this.view = this.tabViews.track;
  }

  // ======================================================== track
  tab_track() {
    const Y = this.Y;
    this.p = { rest: 2, a: 2, ta: 4, cruise: 6, b: 4 };
    this.run = null; this.result = null;
    const { tex } = canvasTex(2048, 256, (ctx, w, hh) => {
      ctx.fillStyle = '#374151'; ctx.fillRect(0, 0, w, hh);
      ctx.fillStyle = '#f8fafc'; for (let x = 0; x < w; x += 64) ctx.fillRect(x, hh / 2 - 3, 36, 6);
      ctx.font = '700 40px Inter'; ctx.textAlign = 'center';
      for (let m = 0; m <= 100; m += 10) { const x = 20 + (m / 100) * (w - 40); ctx.fillRect(x - 2, 0, 4, 46); ctx.fillText(`${m} m`, x, 92); }
    });
    const track = mesh(new THREE.BoxGeometry(0.94, 0.006, 0.14), [M.dark, M.dark, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), M.dark, M.dark, M.dark]);
    this.lab.add(track, 0, Y + 0.003, 0);
    this.lab.add(mesh(new THREE.BoxGeometry(0.012, 0.04, 0.16), mat('#ef4444', 0.1, 0.5)), X0 + 100 * SCALE + 0.012, Y + 0.02, 0);
    this.lab.label(track, 'Festival kart track (0–100 m)', { y: 0.06, x: -0.3 });
    const kart = (this.kart = new THREE.Group());
    kart.add(mesh(new THREE.BoxGeometry(0.05, 0.012, 0.03), mat('#dc2626', 0.3, 0.35), 0, 0.014, 0), mesh(new THREE.SphereGeometry(0.008, 14, 10), mat('#facc15', 0.2, 0.3), -0.004, 0.028, 0));
    this.wheels = [];
    for (const [x, z] of [[-0.017, 0.017], [-0.017, -0.017], [0.017, 0.017], [0.017, -0.017]]) { const w = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 14), M.black, x, 0.008, z); w.rotation.x = Math.PI / 2; kart.add(w); this.wheels.push(w); }
    this.lab.add(kart, X0, Y + 0.006, 0);
    this.sw = new Stopwatch(); this.lab.add(this.sw, -0.3, Y, 0.17);
    this.speedo = this.lab.label(kart, '0.0 m/s', { y: 0.06, cls: 'val' });
    const ui = this.ui;
    this.st = ui.steps(['Program and run a trip with **rest, acceleration, constant speed and braking**', 'Find the **speed** from the gradient of the distance–time graph', 'Find the **distance** from the area under the speed–time graph', '(S) Find the **acceleration** from the gradient of the speed–time graph', 'Answer the analysis questions']);
    const sec = ui.section('Kart program');
    const sl = (k, label, min, max, step, unit) => ui.slider({ label, min, max, step, value: this.p[k], unit, parent: sec, onInput: (v) => { this.p[k] = v; } });
    sl('rest', '1 · Wait at the start', 0, 4, 1, 's'); sl('a', '2 · Acceleration', 0.5, 4, 0.5, 'm/s²'); sl('ta', '2 · …for', 1, 6, 1, 's'); sl('cruise', '3 · Constant speed for', 0, 10, 1, 's'); sl('b', '4 · Braking deceleration', 1, 8, 1, 'm/s²');
    ui.buttons([{ label: '▶ Run program', kind: 'primary', onClick: () => this.start() }, { label: '⟲ Back to start', onClick: () => this.toStart() }], sec);
    this.ro = ui.readouts([{ id: 't', label: 'Time', unit: 's' }, { id: 'd', label: 'Distance', unit: 'm' }, { id: 'v', label: 'Speed', unit: 'm/s' }], sec);
    this.gd = ui.graph({ x: { label: 'Time / s', min: 0, max: 20 }, y: { label: 'Distance / m', min: 0, max: 100 }, series: [{ name: 'd', color: '#38bdf8', line: true, points: false }], auto: true, height: 150 }, ui.section('Distance–time graph'));
    this.gv = ui.graph({ x: { label: 'Time / s', min: 0, max: 20 }, y: { label: 'Speed / m/s', min: 0, max: 12 }, series: [{ name: 'v', color: '#f472b6', line: true, points: false }], auto: true, height: 150 }, ui.section('Speed–time graph'));
    ui.notes();
    this.qs = ui.questions([
      { q: 'Use your **distance–time** graph: what was the speed during the constant-speed section? (gradient = distance ÷ time)', ans: () => this.result?.v ?? null, tol: 0.04, abs: 0.05, unit: 'm/s', e: 'Gradient of the straight section = {ans} m/s.', o: [6] },
      { q: 'Use the **area under the speed–time** graph to find the total distance travelled.', ans: () => this.result?.total ?? null, tol: 0.04, abs: 0.3, unit: 'm', e: 'Triangle + rectangle + triangle = {ans} m.', o: [7] },
      { q: '(S) Use the **gradient of the speed–time** graph to find the acceleration.', ans: () => this.result?.a ?? null, tol: 0.03, abs: 0.05, unit: 'm/s²', e: 'a = Δv ÷ Δt = {ans} m/s².', o: [9, 11] },
      { q: 'What was the **average speed** for the whole trip (including the wait)?', ans: () => (this.result ? this.result.total / this.result.T : null), tol: 0.05, abs: 0.05, unit: 'm/s', e: 'Average speed = total distance ÷ total time = {ans} m/s.', o: [2] },
      { q: 'On a distance–time graph, a **horizontal** line means the kart is…', opts: ['at rest', 'moving at constant speed', 'accelerating', 'decelerating'], e: 'Distance is not changing.', o: [5] },
      { q: '(S) Braking at 4 m/s² can be written as an acceleration of…', opts: ['−4 m/s² (deceleration is negative acceleration)', '+4 m/s²', '0 m/s²', '4 m/s'], e: 'The velocity is decreasing.', o: [12] },
    ], { sub: 'P1.2', onDone: () => { this.st.done(4); this.checkTab('track', this.st, 5); } });
    this.every((dt) => this.simTrack(dt));
  }
  toStart() { this.run = null; this.kart.position.x = X0; this.sw.set(0); this.speedo.userData.set('0.0 m/s'); }
  start() {
    const p = this.p, v = p.a * p.ta, tb = v / p.b;
    const T = p.rest + p.ta + p.cruise + tb;
    const total = 0.5 * p.a * p.ta * p.ta + v * p.cruise + 0.5 * v * tb;
    this.run = { t: 0, ...p, v, tb, T, total, crashed: false };
    this.gd.clear(); this.gv.clear(); this.gd.o.x.max = Math.max(20, T + 1); this.gv.o.x.max = Math.max(20, T + 1); this.gv.o.y.max = Math.max(12, v + 1);
    this.kart.position.x = X0; audio.click(); this._sample = 0;
  }
  state(r, t) {
    const t1 = r.rest, t2 = t1 + r.ta, t3 = t2 + r.cruise, t4 = t3 + r.tb;
    if (t < t1) return [0, 0];
    if (t < t2) { const u = t - t1; return [0.5 * r.a * u * u, r.a * u]; }
    const d2 = 0.5 * r.a * r.ta * r.ta;
    if (t < t3) return [d2 + r.v * (t - t2), r.v];
    const d3 = d2 + r.v * r.cruise;
    if (t < t4) { const u = t - t3; return [d3 + r.v * u - 0.5 * r.b * u * u, r.v - r.b * u]; }
    return [r.total, 0];
  }
  simTrack(dt) {
    const r = this.run; if (!r || r.done) return;
    r.t = Math.min(r.T, r.t + dt);
    let [d, v] = this.state(r, r.t);
    if (d > 100 && !r.crashed) { r.crashed = true; audio.bang?.(); this.ui.note('💥 **Crash!** The kart hit the barrier at 100 m. Its stopping distance was too long — reduce the speed or brake harder.', 'warn'); }
    if (r.crashed) { d = 100; v = 0; }
    this.kart.position.x = X0 + d * SCALE;
    this.wheels.forEach((w) => { w.rotation.y = -d * 6; });
    this.sw.set(r.t); this.speedo.userData.set(`${v.toFixed(1)} m/s`);
    this.ro.set('t', r.t.toFixed(1)); this.ro.set('d', d.toFixed(1)); this.ro.set('v', v.toFixed(1));
    this._sample += dt; if (this._sample > 0.1 || r.t >= r.T) { this._sample = 0; this.gd.add(0, +r.t.toFixed(2), +d.toFixed(2)); this.gv.add(0, +r.t.toFixed(2), +v.toFixed(2)); }
    if (r.t >= r.T || r.crashed) {
      r.done = true;
      if (!r.crashed) { this.result = { v: r.v, total: r.total, a: r.a, T: r.T }; this.ui.note(`Trip complete: top speed ${r.v.toFixed(1)} m/s, total distance ${r.total.toFixed(1)} m in ${r.T.toFixed(1)} s. Read your graphs to answer the questions.`, 'gold'); if (r.rest > 0 && r.cruise > 0) this.st.done(0); else this.ui.note('Include a wait at the start and a constant-speed section to see all four graph shapes.', 'warn'); }
    }
  }
  update(dt, t) {
    super.update(dt, t);
    if (this.tab === 'track' && this.qs) { const boxes = this.qs.querySelectorAll('.aq'); [1, 2, 3].forEach((s, i) => { if (boxes[i]?.classList.contains('solved') && !this.st.isDone(s)) { this.st.done(s); this.checkTab('track', this.st, 5); } }); }
  }

  // ======================================================== timing
  tab_timing() {
    const Y = this.Y;
    this.tm = { L: 0.6, theta: 0.2, t: 0, trials: [], lengths: new Set(), sorted: {}, g: null };
    const st = stand(1.15); this.lab.add(st, -0.15, Y, -0.06);
    this.pivot = new THREE.Group(); this.lab.add(this.pivot, -0.1, Y + 1.1, -0.06);
    this.pivot.add(mesh(new THREE.BoxGeometry(0.1, 0.012, 0.03), M.steel, -0.02, 0.006, 0));
    this.string = mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 1, 6), mat('#e5e7eb')); this.string.geometry.translate(0, -0.5, 0); this.pivot.add(this.string);
    this.bob = mesh(new THREE.SphereGeometry(0.018, 20, 14), M.brass); this.pivot.add(this.bob);
    this.rule = ruler(1.0); this.rule.rotation.order = 'ZXY'; this.rule.rotation.set(Math.PI / 2, 0, Math.PI / 2); this.lab.add(this.rule, -0.03, Y + 0.6, -0.06);
    this.sw2 = new Stopwatch(); this.lab.add(this.sw2, 0.12, Y, 0.12);
    this.lenLbl = this.lab.label(this.pivot, '', { y: 0.04, x: 0.08 });
    // light gates for free fall
    const lg = new THREE.Group(); this.lab.add(lg, 0.3, Y, -0.04);
    lg.add(mesh(new THREE.BoxGeometry(0.012, 1.15, 0.012), M.steel, -0.04, 0.575, 0));
    for (const y of [1.05, 0.05]) lg.add(mesh(new THREE.BoxGeometry(0.03, 0.02, 0.05), mat('#1d4ed8', 0.3, 0.4), 0, y, 0));
    this.ball = mesh(new THREE.SphereGeometry(0.012, 16, 12), mat('#f97316', 0.2, 0.4), 0, 1.07, 0); lg.add(this.ball);
    this.lab.label(lg, 'Light gates 1.00 m apart', { y: 1.2 });
    const ui = this.ui;
    this.st2 = ui.steps(['Time **one swing** three times', 'Time **ten swings** three times and compare the spread', 'Measure the period for **three different lengths**', '(S) Measure **g** by timing a falling ball', '(S) Sort the quantities into **scalars and vectors**', 'Answer the analysis questions']);
    const sec = ui.section('Pendulum');
    ui.slider({ label: 'String length (measured with a metre rule)', min: 0.2, max: 1.0, step: 0.1, value: this.tm.L, unit: 'm', parent: sec, onInput: (v) => { this.tm.L = v; this.tm.t = 0; } });
    ui.buttons([{ label: '⏱ Time 1 swing', onClick: () => this.timeSwings(1) }, { label: '⏱ Time 10 swings', kind: 'primary', onClick: () => this.timeSwings(10) }], sec);
    this.ttab = ui.table(['L / m', 'Swings', 'Time / s', 'Period / s'], sec);
    this.gT = ui.graph({ x: { label: 'Length / m', min: 0, max: 1.1 }, y: { label: 'Period / s', min: 0, max: 2.2 }, series: [{ name: 'T', color: '#a3e635', points: true }], height: 140 }, sec);
    const ff = ui.section('(S) Free fall');
    ui.buttons([{ label: '⬇ Drop the ball', onClick: () => this.drop() }], ff);
    this.ffro = ui.readouts([{ id: 't', label: 'Timer (gate 1 → gate 2)', unit: 's' }, { id: 'h', label: 'Height', value: '1.00 m' }], ff);
    const sv = ui.section('(S) Scalar or vector?');
    this.svBox = h('div'); sv.append(this.svBox); this.drawSV();
    ui.notes();
    ui.questions([
      { q: 'Why is it better to time **10 swings** and divide by 10?', opts: ['Your reaction-time error is shared over 10 swings, so the period is more accurate', 'The pendulum swings faster', 'It is quicker', 'Stop-watches cannot time one swing'], e: 'Measuring multiples reduces the effect of human reaction time.', o: [3], sub: 'P1.1' },
      { q: '(S) Use your free-fall time: g = 2h ÷ t² with h = 1.00 m. Calculate g.', ans: () => this.tm.g, tol: 0.03, abs: 0.05, unit: 'm/s²', e: 'g = 2 × 1.00 ÷ t² = {ans} m/s² — close to 9.8 m/s².', o: [13], sub: 'P1.2' },
      { q: 'A 70 kg runner on Earth (g = 9.8 N/kg) has a weight of…', ans: 686, tol: 0.01, unit: 'N', e: 'W = m × g = 70 × 9.8 = {ans} N.', o: [3], sub: 'P1.3' },
      { q: 'An astronaut’s **mass** on the Moon compared with on Earth is…', opts: ['the same — only weight changes', 'smaller', 'larger', 'zero'], e: 'Mass is the amount of matter; weight is the gravitational force on it.', o: [1, 2], sub: 'P1.3' },
    ], { sub: 'P1.1', onDone: () => { this.st2.done(5); this.checkTab('timing', this.st2, 6); } });
    this.every((dt) => this.simTiming(dt));
  }
  period() { return 2 * Math.PI * Math.sqrt(this.tm.L / 9.81); }
  timeSwings(n) {
    if (this._timing) return;
    const T = this.period(); const err = () => (Math.random() - 0.5) * 0.36;
    const measured = Math.max(0.1, n * T + err() - err());
    this._timing = { n, left: n * T, measured, t: 0 };
    audio.click();
  }
  simTiming(dt) {
    const tm = this.tm; tm.t += dt;
    const T = this.period(); const th = tm.theta * Math.cos((2 * Math.PI * tm.t) / T);
    this.pivot.rotation.z = th; this.string.scale.y = tm.L; this.bob.position.y = -tm.L;
    this.lenLbl.userData.set(`L = ${tm.L.toFixed(1)} m`);
    const tg = this._timing;
    if (tg) {
      tg.t += dt; this.sw2.set(Math.min(tg.t, tg.measured));
      if (tg.t >= tg.left) {
        this._timing = null;
        const per = tg.measured / tg.n;
        tm.trials.push({ L: tm.L, n: tg.n, time: tg.measured, per });
        this.ttab.add([tm.L.toFixed(1), tg.n, tg.measured.toFixed(2), `<b>${per.toFixed(2)}</b>`]);
        audio.blip();
        const ones = tm.trials.filter((x) => x.n === 1), tens = tm.trials.filter((x) => x.n === 10);
        if (ones.length >= 3) this.st2.done(0);
        if (tens.length >= 3 && !this.st2.isDone(1)) {
          this.st2.done(1);
          const spread = (arr) => Math.max(...arr.map((x) => x.per)) - Math.min(...arr.map((x) => x.per));
          if (ones.length >= 3) this.ui.note(`Spread of periods — single swings: **${spread(ones).toFixed(2)} s**; ten swings: **${spread(tens).toFixed(2)} s**. Timing multiples is far more precise.`, 'gold');
        }
        if (tg.n === 10) { tm.lengths.add(tm.L.toFixed(1)); this.gT.add(0, tm.L, per); }
        if (tm.lengths.size >= 3 && !this.st2.isDone(2)) { this.st2.done(2); this.ui.note('Longer pendulums swing more slowly — the period increases with length (but not in direct proportion).', 'gold'); }
        this.checkTab('timing', this.st2, 6);
      }
    }
    if (this._drop) {
      const d = this._drop; d.t += dt * 0.5; const y = 1.07 - 0.5 * 9.81 * d.t * d.t;
      this.ball.position.y = Math.max(0.03, y);
      if (y <= 0.05) { this._drop = null; this.ffro.set('t', d.meas.toFixed(3)); tm.g = 2 / (d.meas * d.meas); audio.clink(); this.ui.note(`Timer: **${d.meas.toFixed(3)} s** for 1.00 m. Now calculate g.`); this.st2.done(3); this.checkTab('timing', this.st2, 6); }
    }
  }
  drop() { if (this._drop) return; this.ball.position.y = 1.07; this._drop = { t: 0, meas: Math.sqrt(2 / 9.81) * (1 + (Math.random() - 0.5) * 0.01) }; audio.whoosh?.(); }
  drawSV() {
    clear(this.svBox);
    const wrap = h('div', { class: 'row wrap', style: { gap: '6px' } });
    for (const [q, ans] of QTY) {
      const cur = this.tm.sorted[q];
      wrap.append(h('div', { style: { background: 'rgba(255,255,255,.04)', borderRadius: '8px', padding: '4px 6px', fontSize: '.85em' } }, `${cur ? (cur === ans ? '✅' : '❌') : ''} ${q} `,
        ...['scalar', 'vector'].map((k) => h('button', { class: `btn tiny ${cur === k ? (k === ans ? 'good' : 'danger') : ''}`, onClick: () => { this.tm.sorted[q] = k; audio.click(); this.drawSV(); } }, k[0].toUpperCase()))));
    }
    this.svBox.append(wrap);
    if (QTY.every(([q, a]) => this.tm.sorted[q] === a) && !this.st2.isDone(4)) { this.st2.done(4); this.ui.note('Vectors have **magnitude and direction** (velocity, force, weight, acceleration); scalars have magnitude only.', 'gold'); this.checkTab('timing', this.st2, 6); }
  }
  checkTab(id, st, n) { if (Array.from({ length: n }, (_, i) => i).every((i) => st.isDone(i))) this.lab.goal(id); }
}
void roundRect;
