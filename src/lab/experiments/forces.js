import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { stand, ruler, mesh, mat, M } from '../apparatus.js';
import { h, clamp, tweens } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const K = 25, LOP = 6; // spring constant N/m, limit of proportionality N

function springGeo(turns = 14, r = 0.012, len = 0.1) {
  const pts = []; const N = turns * 16;
  for (let i = 0; i <= N; i++) { const a = (i / 16) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, -(i / N) * len, Math.sin(a) * r)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, 0.0012, 6, false);
}
function arrow(color) {
  const g = new THREE.Group(); const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.4) });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1, 8), m); shaft.geometry.translate(0, 0.5, 0); g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.02, 10), m); g.add(head);
  g.setLen = (L) => { g.visible = Math.abs(L) > 0.002; shaft.scale.y = Math.max(0.001, Math.abs(L)); head.position.y = Math.abs(L) + 0.01; g.rotation.z = L < 0 ? Math.PI : 0; };
  return g;
}

export default class Forces extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Bungee cords, bike brakes, see-saws and tipping buses: forces are behind every ride at the festival fairground. Measure them before anyone gets on.';
    this.tabLabels = [['springs', '🪀 Springs'], ['motion', '🪂 Force & motion'], ['moments', '⚖️ Moments'], ['cog', '🚌 Centre of gravity']];
    this.tabObjectives = { springs: ['P1.5.1'], motion: ['P1.5.1', 'P1.3'], moments: ['P1.5.2'], cog: ['P1.5.3'] };
    this.tabViews = { springs: { pos: [0, 1.36, 0.9], target: [0, 1.12, 0] }, motion: { pos: [0, 1.4, 1.1], target: [0, 1.12, 0] }, moments: { pos: [0, 1.3, 0.85], target: [0, 1.06, 0] }, cog: { pos: [0, 1.36, 0.95], target: [0, 1.1, 0] } };
    this.view = this.tabViews.springs;
  }

  // ======================================================== springs
  tab_springs() {
    const Y = this.Y;
    this.sp = { load: 0, max: 0, rec: [], set: 0 };
    const st = stand(0.5); this.lab.add(st, -0.05, Y, -0.04);
    this.top = new THREE.Group(); this.lab.add(this.top, 0.04, Y + 0.48, -0.04);
    this.top.add(mesh(new THREE.BoxGeometry(0.11, 0.012, 0.02), M.steel, -0.04, 0.006, 0));
    this.spring = mesh(springGeo(), mat('#94a3b8', 0.9, 0.25)); this.top.add(this.spring);
    this.hanger = new THREE.Group(); this.top.add(this.hanger);
    this.hanger.add(mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.04, 6), M.steel, 0, -0.02, 0), mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 18), M.steel, 0, -0.04, 0));
    this.pointer = mesh(new THREE.BoxGeometry(0.03, 0.002, 0.002), mat('#ef4444'), 0.025, -0.005, 0); this.hanger.add(this.pointer);
    this.masses = new THREE.Group(); this.hanger.add(this.masses);
    const rl = ruler(0.5); rl.rotation.order = 'ZXY'; rl.rotation.set(Math.PI / 2, 0, Math.PI / 2); this.lab.add(rl, 0.085, Y + 0.25, -0.04);
    this.lab.label(this.top, 'Spring + slotted masses (1 N each)', { y: 0.06 });
    const ui = this.ui;
    this.stS = ui.steps(['Add loads one at a time and **record the extension** (at least 6 readings)', 'Keep loading past the **limit of proportionality**', { t: '(S) Calculate the **spring constant** k = F ÷ x', o: ['P1.5.1.9'], q: true }, 'Unload: does it return to its original length?', 'Answer the analysis questions']);
    const sec = ui.section('Loading');
    ui.buttons([{ label: '+ Add 1 N', kind: 'primary', onClick: () => this.setLoad(this.sp.load + 1) }, { label: '− Remove 1 N', onClick: () => this.setLoad(this.sp.load - 1) }, { label: '📏 Record', onClick: () => this.record() }], sec);
    this.roS = ui.readouts([{ id: 'F', label: 'Load', unit: 'N' }, { id: 'L', label: 'Length', unit: 'cm' }, { id: 'x', label: 'Extension', unit: 'cm' }], sec);
    this.tS = ui.table(['Load / N', 'Extension / cm'], sec);
    this.gS = ui.graph({ x: { label: 'Extension / cm', min: 0, max: 40 }, y: { label: 'Load / N', min: 0, max: 10 }, series: [{ name: 'data', color: '#f472b6', points: true, line: true }], height: 160 }, sec);
    ui.notes();
    ui.questions([
      { q: '(S) Use a point on the straight part of your graph: k = F ÷ x (x in metres).', ans: K, tol: 0.06, unit: 'N/m', e: 'e.g. 4 N ÷ 0.16 m = {ans} N/m.', o: [9] },
      { q: 'Where does the graph stop being a straight line through the origin?', opts: ['At the limit of proportionality', 'At the origin', 'At the spring constant', 'It never curves'], e: 'Beyond it, extension is no longer proportional to load.', o: [10] },
      { q: 'Forces can change an object’s…', opts: ['size, shape and motion', 'mass only', 'colour', 'temperature only'], e: 'A spring changes shape; a kicked ball changes motion.', o: [1] },
      { q: 'A bungee cord must stretch **without** passing its limit. Why?', opts: ['Beyond it the cord stays permanently stretched and its behaviour is unpredictable', 'It would become shorter', 'It would turn into a vector', 'Its mass would change'], e: 'Engineers keep loads well inside the elastic region.', o: [8] },
    ], { sub: 'P1.5.1', onDone: () => { this.stS.done(4); this.checkTab('springs', this.stS, 5); } });
    this.setLoad(0);
  }
  ext(F) { const e = F <= LOP ? F / K : LOP / K + (F - LOP) / K * 1.9 + 0.01 * (F - LOP) ** 2; return e + this.sp.set; }
  setLoad(F) {
    F = clamp(F, 0, 10); const sp = this.sp;
    if (F < sp.load && sp.max > LOP + 1) sp.set = 0.02 * (sp.max - LOP - 1);
    sp.load = F; sp.max = Math.max(sp.max, F);
    const x = this.ext(F), len = 0.1 + x;
    this.spring.scale.y = len / 0.1; this.hanger.position.y = -len;
    while (this.masses.children.length) this.masses.remove(this.masses.children[0]);
    for (let i = 0; i < F; i++) this.masses.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 18), M.brass, 0, -0.035 + i * 0.007, 0));
    this.roS.set('F', F); this.roS.set('L', (len * 100).toFixed(1)); this.roS.set('x', (x * 100).toFixed(1));
    audio.clink();
    if (F === 0 && sp.max > LOP + 1 && !this.stS.isDone(3)) { this.stS.done(3); this.ui.note(`Unloaded, the spring is now **${(sp.set * 100).toFixed(1)} cm longer** than at the start — it was stretched beyond its **elastic limit** and is permanently deformed.`, 'gold'); this.checkTab('springs', this.stS, 5); }
  }
  record() {
    const sp = this.sp, x = this.ext(sp.load) * 100;
    if (sp.rec.some((r) => r[0] === sp.load)) { this.ui.hint('Already recorded this load.', 1800); return; }
    sp.rec.push([sp.load, x]); this.tS.add([sp.load, x.toFixed(1)]);
    this.gS.set(0, sp.rec.map(([F, e]) => [e, F]).sort((a, b) => a[0] - b[0]));
    audio.blip();
    if (sp.rec.length >= 6) this.stS.done(0);
    if (sp.rec.some((r) => r[0] >= LOP + 2) && !this.stS.isDone(1)) { this.stS.done(1); this.ui.note(`The graph curves after about **${LOP} N** — the **limit of proportionality**. Up to there, extension ∝ load (Hooke’s law).`, 'gold'); }
    this.checkTab('springs', this.stS, 5);
    const k = [...this.ui.body.querySelectorAll('.aq')][0]; if (k?.classList.contains('solved')) this.stS.done(2);
  }

  // ======================================================== force & motion
  tab_motion() {
    const Y = this.Y;
    this.fm = { F: 2, m: 1, fric: false, runs: [], trolley: null, sky: null, para: false };
    const runway = mesh(new THREE.BoxGeometry(0.7, 0.01, 0.08), M.wood); this.lab.add(runway, -0.1, Y + 0.005, 0.08);
    this.trolley = new THREE.Group(); this.trolley.add(mesh(new THREE.BoxGeometry(0.06, 0.02, 0.045), mat('#2563eb', 0.3, 0.4), 0, 0.02, 0));
    for (const [x, z] of [[-0.02, 0.022], [-0.02, -0.022], [0.02, 0.022], [0.02, -0.022]]) { const w = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.005, 12), M.black, x, 0.009, z); w.rotation.x = Math.PI / 2; this.trolley.add(w); }
    this.lab.add(this.trolley, -0.42, Y + 0.01, 0.08);
    this.fArrow = arrow('#22c55e'); this.fArrow.rotation.z = -Math.PI / 2; this.trolley.add(this.fArrow); this.fArrow.position.set(0.035, 0.02, 0);
    this.lab.label(this.trolley, 'Trolley', { y: 0.06 });
    // skydiver column
    const col = new THREE.Group(); this.lab.add(col, 0.36, Y, -0.05); this.colG = col;
    col.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }), 0, 0.3, 0));
    this.diver = new THREE.Group(); this.diver.position.y = 0.32; col.add(this.diver);
    this.diver.add(mesh(new THREE.CapsuleGeometry(0.008, 0.03, 4, 8), mat('#f97316'), 0, 0, 0));
    this.diver.children[0].rotation.z = Math.PI / 2;
    this.chute = mesh(new THREE.SphereGeometry(0.05, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), mat('#e11d48', 0, 0.6, { side: THREE.DoubleSide }), 0, 0.07, 0); this.chute.visible = false; this.diver.add(this.chute);
    this.wArrow = arrow('#ef4444'); this.diver.add(this.wArrow); this.dArrow = arrow('#22d3ee'); this.diver.add(this.dArrow);
    this.clouds = []; for (let i = 0; i < 6; i++) { const c = mesh(new THREE.SphereGeometry(0.015, 10, 8), mat('#f8fafc', 0, 1, { transparent: true, opacity: 0.6 }), (Math.random() - 0.5) * 0.12, 0.08 + i * 0.08, (Math.random() - 0.5) * 0.08); col.add(c); this.clouds.push(c); }
    this.lab.label(col, 'Skydiver (red = weight, cyan = air resistance)', { y: 0.6 });
    const ui = this.ui;
    this.stM = ui.steps(['Change the **force** at constant mass (3 runs)', 'Change the **mass** at constant force (3 runs)', 'Turn on **friction** and note the effect', 'Drop the skydiver to **terminal velocity**', 'Open the **parachute**', 'Answer the analysis questions']);
    const sec = ui.section('Trolley: F = ma (S)');
    ui.slider({ label: 'Pulling force', min: 1, max: 5, step: 1, value: this.fm.F, unit: 'N', parent: sec, onInput: (v) => { this.fm.F = v; } });
    ui.slider({ label: 'Trolley mass', min: 0.5, max: 2, step: 0.5, value: this.fm.m, unit: 'kg', parent: sec, onInput: (v) => { this.fm.m = v; } });
    ui.seg({ label: 'Friction', options: [[false, 'Off (air track)'], [true, 'On (0.5 N)']], value: false, parent: sec, onChange: (v) => { this.fm.fric = v === true || v === 'true'; } });
    ui.buttons([{ label: '▶ Release trolley', kind: 'primary', onClick: () => this.release() }], sec);
    this.tM = ui.table(['F / N', 'm / kg', 'Friction', 'a / m/s²'], sec);
    const sk = ui.section('Skydiver');
    ui.buttons([{ label: '🪂 Jump', kind: 'primary', onClick: () => this.jump() }, { label: '🎈 Open parachute', onClick: () => this.openChute() }], sk);
    this.roK = ui.readouts([{ id: 'v', label: 'Speed', unit: 'm/s' }, { id: 'W', label: 'Weight', unit: 'N' }, { id: 'D', label: 'Air resistance', unit: 'N' }, { id: 'R', label: 'Resultant', unit: 'N' }], sk);
    this.gK = ui.graph({ x: { label: 'Time / s', min: 0, max: 40 }, y: { label: 'Speed / m/s', min: 0, max: 60 }, series: [{ name: 'v', color: '#f97316', line: true, points: false }], auto: true, height: 140 }, sk);
    ui.notes();
    ui.questions([
      { q: '(S) A 2 N resultant force acts on a 0.5 kg trolley. Its acceleration is…', ans: 4, tol: 0.01, unit: 'm/s²', e: 'a = F ÷ m = 2 ÷ 0.5 = {ans} m/s².', o: [7] },
      { q: 'At terminal velocity, the skydiver’s weight and air resistance are…', opts: ['equal, so the resultant force is zero and speed is constant', 'zero', 'unequal, so they keep accelerating', 'both upwards'], e: 'No resultant force → constant velocity.', o: [6] },
      { q: 'Opening the parachute makes the skydiver…', opts: ['decelerate, because air resistance becomes bigger than weight', 'accelerate upwards and fly away', 'stop instantly', 'fall faster'], e: 'A bigger area means much more air resistance until a new, slower terminal velocity is reached.', o: [5, 6] },
      { q: 'Friction between the trolley wheels and the runway…', opts: ['opposes motion and transfers energy to heating', 'speeds the trolley up', 'has no effect', 'only acts in water'], e: 'That is why brakes get hot.', o: [3] },
      { q: 'The skydiver’s mass is 70 kg and g = 9.8 N/kg. What is the weight?', ans: 686, tol: 0.01, unit: 'N', e: 'W = mg = {ans} N.', o: [3], sub: 'P1.3' },
    ], { sub: 'P1.5.1', onDone: () => { this.stM.done(5); this.checkTab('motion', this.stM, 6); } });
    this.every((dt) => this.simMotion(dt));
  }
  release() {
    if (this.fm.trolley) return;
    const fr = this.fm.fric ? 0.5 : 0; const a = Math.max(0, (this.fm.F - fr) / this.fm.m);
    this.fm.trolley = { t: 0, a, x0: -0.42 };
    this.fArrow.setLen(this.fm.F * 0.02);
    const runs = this.fm.runs; runs.push({ F: this.fm.F, m: this.fm.m, fric: this.fm.fric, a });
    this.tM.add([this.fm.F, this.fm.m, this.fm.fric ? 'on' : 'off', `<b>${a.toFixed(2)}</b>`]);
    audio.whoosh?.();
    const noF = runs.filter((r) => !r.fric);
    const byM = {}; noF.forEach((r) => { (byM[r.m] = byM[r.m] || new Set()).add(r.F); });
    if (Object.values(byM).some((s) => s.size >= 3) && !this.stM.isDone(0)) { this.stM.done(0); this.ui.note('Doubling the force doubles the acceleration: **a ∝ F**.', 'gold'); }
    const byF = {}; noF.forEach((r) => { (byF[r.F] = byF[r.F] || new Set()).add(r.m); });
    if (Object.values(byF).some((s) => s.size >= 3) && !this.stM.isDone(1)) { this.stM.done(1); this.ui.note('Doubling the mass halves the acceleration: **a ∝ 1/m**. Together: **F = ma**.', 'gold'); }
    if (this.fm.fric && !this.stM.isDone(2)) { this.stM.done(2); this.ui.note('Friction (0.5 N) opposes the pull: resultant force = F − 0.5 N, so the acceleration is smaller — and the wheels warm up.', 'gold'); }
    this.checkTab('motion', this.stM, 6);
  }
  jump() { this.fm.sky = { t: 0, v: 0, s: 0 }; this.fm.para = false; this.chute.visible = false; this.gK.clear(); audio.whoosh?.(); }
  openChute() { if (!this.fm.sky) { this.ui.hint('Jump first!', 2000); return; } if (this.fm.para) return; this.fm.para = true; this.chute.visible = true; audio.whoosh?.(); }
  simMotion(dt) {
    const tr = this.fm.trolley;
    if (tr) { tr.t += dt; const x = tr.x0 + 0.5 * tr.a * tr.t * tr.t * 0.12; this.trolley.position.x = Math.min(0.22, x); if (x >= 0.22) { this.fm.trolley = null; this.fArrow.setLen(0); setTimeout(() => { if (this.trolley) this.trolley.position.x = -0.42; }, 600); } }
    const s = this.fm.sky;
    if (s) {
      const m = 70, W = m * 9.8, k = this.fm.para ? 4.5 : 0.23;
      const D = k * s.v * s.v; const R = W - D;
      s.v = Math.max(0, s.v + (R / m) * dt * 2); s.t += dt * 2;
      this.wArrow.setLen(-W / 6000); this.dArrow.setLen(D / 6000);
      this.roK.set('v', s.v.toFixed(1)); this.roK.set('W', W.toFixed(0)); this.roK.set('D', D.toFixed(0)); this.roK.set('R', R.toFixed(0));
      this.clouds.forEach((c) => { c.position.y += s.v * dt * 0.004; if (c.position.y > 0.52) c.position.y = 0.06; });
      this._g = (this._g || 0) + dt; if (this._g > 0.12) { this._g = 0; this.gK.add(0, +s.t.toFixed(2), +s.v.toFixed(2)); }
      if (!this.fm.para && Math.abs(R) < W * 0.02 && !this.stM.isDone(3)) { this.stM.done(3); this.ui.note(`**Terminal velocity ≈ ${s.v.toFixed(0)} m/s**: air resistance has grown until it equals the weight. Resultant force = 0, so the speed stays constant.`, 'gold'); this.checkTab('motion', this.stM, 6); }
      if (this.fm.para && Math.abs(R) < W * 0.03 && !this.stM.isDone(4)) { this.stM.done(4); this.ui.note(`Parachute open: air resistance briefly exceeded weight, so the skydiver **decelerated** to a new, safe terminal velocity of **${s.v.toFixed(1)} m/s**.`, 'gold'); this.checkTab('motion', this.stM, 6); }
      if (s.t > 80) this.fm.sky = null;
    }
  }

  // ======================================================== moments
  tab_moments() {
    const Y = this.Y;
    this.mo = { W1: 3, d1: 20, W2: 2, d2: 30, ang: 0, balanced: false, mystery: false, rock: 0 };
    const piv = mesh(new THREE.ConeGeometry(0.03, 0.08, 3), mat('#64748b', 0.4, 0.4)); this.lab.add(piv, 0, Y + 0.04, 0);
    this.beam = new THREE.Group(); this.lab.add(this.beam, 0, Y + 0.085, 0);
    this.beam.add(mesh(new THREE.BoxGeometry(1.0, 0.012, 0.03), M.wood));
    const rl = ruler(1.0); rl.position.y = 0.0075; rl.scale.z = 0.9; this.beam.add(rl);
    this.hang = [0, 1].map((side) => { const g = new THREE.Group(); this.beam.add(g); const s = mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 0.06, 6), mat('#e5e7eb'), 0, -0.03, 0); g.add(s); const stack = new THREE.Group(); stack.position.y = -0.06; g.add(stack); return { g, stack }; });
    this.rockM = mesh(new THREE.DodecahedronGeometry(0.022), mat('#78716c', 0, 0.9)); this.rockM.visible = false; this.hang[0].stack.add(this.rockM);
    this.lab.label(this.beam, 'Metre rule on a pivot at 50 cm', { y: 0.06 });
    const ui = this.ui;
    this.stO = ui.steps(['Balance the rule with **different weights** on each side', 'Find the weight of the **mystery rock** using moments', 'Answer the analysis questions']);
    const sec = ui.section('Left side (anticlockwise)');
    this.s1 = ui.slider({ label: 'Weight W₁', min: 1, max: 5, step: 1, value: this.mo.W1, unit: 'N', parent: sec, onInput: (v) => { this.mo.W1 = v; this.refreshMo(); } });
    ui.slider({ label: 'Distance from pivot d₁', min: 5, max: 45, step: 5, value: this.mo.d1, unit: 'cm', parent: sec, onInput: (v) => { this.mo.d1 = v; this.refreshMo(); } });
    const sec2 = ui.section('Right side (clockwise)');
    ui.slider({ label: 'Weight W₂', min: 1, max: 5, step: 1, value: this.mo.W2, unit: 'N', parent: sec2, onInput: (v) => { this.mo.W2 = v; this.refreshMo(); } });
    ui.slider({ label: 'Distance from pivot d₂', min: 5, max: 45, step: 5, value: this.mo.d2, unit: 'cm', parent: sec2, onInput: (v) => { this.mo.d2 = v; this.refreshMo(); } });
    ui.buttons([{ label: '🪨 Hang the mystery rock on the left', onClick: () => { this.mo.mystery = true; this.mo.rock = 3.5; this.rockM.visible = true; this.s1.disable(true); this.refreshMo(); } }], sec2);
    this.roO = ui.readouts([{ id: 'a', label: 'Anticlockwise moment', unit: 'N cm' }, { id: 'c', label: 'Clockwise moment', unit: 'N cm' }, { id: 'b', label: 'Balanced?' }], sec2);
    ui.notes();
    ui.questions([
      { q: 'With the rock at 20 cm, a **2 N** weight balanced it at **35 cm**. What does the rock weigh?', ans: 3.5, tol: 0.01, unit: 'N', e: 'W × 20 = 2 × 35 → W = {ans} N.', o: [4] },
      { q: 'Why is it easier to undo a tight nut with a **long spanner**?', opts: ['The larger distance gives a bigger moment for the same force', 'Long spanners are heavier', 'The force is smaller', 'It reduces friction'], e: 'Moment = force × perpendicular distance from the pivot.', o: [1, 2] },
      { q: 'An object is in **equilibrium** when…', opts: ['there is no resultant force and no resultant moment', 'it is moving', 'the clockwise moment is larger', 'only the forces balance'], e: 'Both conditions are needed.', o: [3] },
    ], { sub: 'P1.5.2', onDone: () => { this.stO.done(2); this.checkTab('moments', this.stO, 3); } });
    this.refreshMo();
    this.every((dt) => { const target = this.mo.target || 0; this.mo.ang += (target - this.mo.ang) * Math.min(1, dt * 4); this.beam.rotation.z = this.mo.ang; });
  }
  refreshMo() {
    const mo = this.mo; const W1 = mo.mystery ? mo.rock : mo.W1, d1 = mo.mystery ? 20 : mo.d1;
    const A = W1 * d1, C = mo.W2 * mo.d2;
    this.hang[0].g.position.x = -d1 / 100; this.hang[1].g.position.x = mo.d2 / 100;
    const fill = (stack, n) => { stack.children.filter((c) => c !== this.rockM).forEach((c) => stack.remove(c)); for (let i = 0; i < n; i++) stack.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 16), M.brass, 0, -i * 0.009, 0)); };
    fill(this.hang[0].stack, mo.mystery ? 0 : mo.W1); fill(this.hang[1].stack, mo.W2);
    const bal = Math.abs(A - C) < 0.01;
    mo.target = bal ? 0 : clamp((A - C) * 0.002, -0.12, 0.12);
    this.roO.set('a', A.toFixed(0)); this.roO.set('c', C.toFixed(0)); this.roO.set('b', bal ? '✅ yes' : 'no');
    if (bal && !mo.mystery && mo.W1 !== mo.W2 && !this.stO.isDone(0)) { this.stO.done(0); audio.success(); this.ui.note(`Balanced: ${mo.W1} N × ${mo.d1} cm = ${mo.W2} N × ${mo.d2} cm. **Principle of moments**: clockwise moment = anticlockwise moment.`, 'gold'); }
    if (bal && mo.mystery && !this.stO.isDone(1)) { this.stO.done(1); audio.success(); this.ui.note(`Balanced with the rock! Rock × 20 cm = ${mo.W2} N × ${mo.d2} cm → rock = **${(C / 20).toFixed(1)} N**.`, 'gold'); }
    this.checkTab('moments', this.stO, 3);
  }

  // ======================================================== centre of gravity
  tab_cog() {
    const Y = this.Y;
    this.cg = { hole: null, lines: [], tilt: 0, toppled: new Set() };
    const shape = new THREE.Shape(); const P = [[0, 0], [0.16, 0.02], [0.2, 0.12], [0.12, 0.2], [0.04, 0.17], [-0.02, 0.09]];
    shape.moveTo(...P[0]); P.slice(1).forEach((p) => shape.lineTo(...p)); shape.closePath();
    this.holes = [[0.02, 0.05], [0.17, 0.1], [0.1, 0.17]];
    // centroid (approx. polygon centroid)
    let A = 0, cx = 0, cy = 0; for (let i = 0; i < P.length; i++) { const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length]; const c = x0 * y1 - x1 * y0; A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c; } A /= 2; this.cgPt = [cx / (6 * A), cy / (6 * A)];
    this.lam = new THREE.Group(); this.lab.add(this.lam, -0.18, Y + 0.45, 0);
    this.plate = new THREE.Group(); this.lam.add(this.plate);
    this.plate.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: false }), mat('#fbbf24', 0, 0.8)));
    this.holes.forEach(([x, y], i) => { const hm = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.006, 10), M.black, x, y, 0.002); hm.rotation.x = Math.PI / 2; this.plate.add(hm); this.lab.interactive(hm, { tip: `Hole ${i + 1} — hang the lamina from here`, onClick: () => this.hangFrom(i) }); });
    this.plumb = new THREE.Group(); this.lam.add(this.plumb); this.plumb.add(mesh(new THREE.CylinderGeometry(0.0006, 0.0006, 0.3, 4), mat('#e5e7eb'), 0, -0.15, 0.008), mesh(new THREE.ConeGeometry(0.006, 0.014, 8), M.brass, 0, -0.3, 0.008));
    this.plumb.visible = false;
    this.cgMark = mesh(new THREE.SphereGeometry(0.006, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.4, 0.4) }), this.cgPt[0], this.cgPt[1], 0.006); this.cgMark.visible = false; this.plate.add(this.cgMark);
    this.lab.label(this.lam, 'Irregular card lamina', { y: 0.08 });
    // tilt platform
    this.plat = new THREE.Group(); this.lab.add(this.plat, 0.2, Y + 0.02, 0);
    this.plat.add(mesh(new THREE.BoxGeometry(0.3, 0.01, 0.12), M.dark));
    const mk = (x, w, hgt, col, name) => { const g = new THREE.Group(); g.position.x = x; const piv = new THREE.Group(); piv.position.set(-w / 2, 0.005, 0); g.add(piv); const b = mesh(new THREE.BoxGeometry(w, hgt, 0.05), mat(col, 0.2, 0.5), w / 2, hgt / 2, 0); piv.add(b); this.plat.add(g); this.lab.label(b, name, { y: hgt / 2 + 0.03, cls: 'dimlab' }); return { g, piv, w, hgt, name, crit: Math.atan((w / 2) / (hgt / 2)) }; };
    this.objs = [mk(-0.07, 0.04, 0.13, '#ef4444', 'Double-decker bus'), mk(0.08, 0.08, 0.035, '#22c55e', 'Racing car')];
    const ui = this.ui;
    this.stG = ui.steps(['Hang the lamina from **two holes** and draw the plumb lines', 'Mark the **centre of gravity** where the lines cross', 'Tilt the platform until **both** vehicles topple', 'Answer the analysis questions']);
    const sec = ui.section('Plumb-line method');
    ui.buttons(this.holes.map((_, i) => ({ label: `📌 Hang from hole ${i + 1}`, onClick: () => this.hangFrom(i) })), sec);
    ui.buttons([{ label: '✏️ Draw the plumb line', kind: 'primary', onClick: () => this.drawLine() }], sec);
    const tl = ui.section('Stability');
    ui.slider({ label: 'Platform tilt', min: 0, max: 75, step: 1, value: 0, unit: '°', parent: tl, onInput: (v) => { this.cg.tilt = v; this.tiltTo(v); } });
    this.roG = ui.readouts([{ id: 'bus', label: 'Bus topples at', unit: '°' }, { id: 'car', label: 'Car topples at', unit: '°' }], tl);
    ui.notes();
    ui.questions([
      { q: 'Why does the lamina’s centre of gravity lie on the plumb line?', opts: ['A freely hanging object rests with its centre of gravity directly below the pivot', 'The string is heavy', 'Gravity acts sideways', 'The holes are at the centre'], e: 'Any other position would create a turning moment.', o: [2] },
      { q: 'Why is a racing car more stable than a double-decker bus?', opts: ['Its centre of gravity is lower and its base is wider', 'It is heavier', 'It is faster', 'It has more wheels'], e: 'It must tilt further before its centre of gravity passes outside the base.', o: [3] },
      { q: 'Where is the centre of gravity of a uniform rectangular sheet?', opts: ['Where its diagonals cross (the centre)', 'At one corner', 'At the bottom edge', 'Outside the sheet'], e: 'For regular shapes, it is at the geometric centre.', o: [1] },
    ], { sub: 'P1.5.3', onDone: () => { this.stG.done(3); this.checkTab('cog', this.stG, 4); } });
    this.hangFrom(0);
  }
  hangFrom(i) {
    const [hx, hy] = this.holes[i]; const [gx, gy] = this.cgPt;
    this.cg.hole = i;
    this.plate.position.set(-hx, -hy, 0);
    const ang = Math.atan2(gx - hx, -(gy - hy));
    this.lam.rotation.z = 0;
    tweens.to(this.lam.rotation, { z: -ang }, 1.2, { ease: (t) => 1 - Math.pow(1 - t, 3) * Math.cos(t * 9) });
    this.plumb.visible = true; this.plumb.rotation.z = 0; this.plumbFix = ang;
    audio.click();
  }
  drawLine() {
    if (this.cg.hole == null) return;
    const i = this.cg.hole; if (this.cg.lines.includes(i)) { this.ui.hint('Already drawn from this hole — try another.', 2000); return; }
    const [hx, hy] = this.holes[i], [gx, gy] = this.cgPt;
    const dir = new THREE.Vector2(gx - hx, gy - hy).normalize();
    const len = 0.26; const line = mesh(new THREE.BoxGeometry(0.0018, len, 0.001), mat('#111827'));
    line.position.set(hx + dir.x * len / 2, hy + dir.y * len / 2, 0.0045); line.rotation.z = Math.atan2(dir.y, dir.x) - Math.PI / 2;
    this.plate.add(line); this.cg.lines.push(i); audio.blip();
    if (this.cg.lines.length >= 2 && !this.stG.isDone(0)) { this.stG.done(0); this.stG.done(1); this.cgMark.visible = true; this.ui.note('The two plumb lines cross at the **centre of gravity** (red dot). A third line would pass through the same point.', 'gold'); }
    this.checkTab('cog', this.stG, 4);
  }
  tiltTo(deg) {
    const a = THREE.MathUtils.degToRad(deg);
    this.plat.rotation.z = a;
    this.objs.forEach((o, k) => {
      if (a > o.crit) { if (!this.cg.toppled.has(o.name)) { this.cg.toppled.add(o.name); audio.bang?.(); this.roG.set(k === 0 ? 'bus' : 'car', THREE.MathUtils.radToDeg(o.crit).toFixed(0)); this.ui.note(`The **${o.name.toLowerCase()}** toppled at about ${THREE.MathUtils.radToDeg(o.crit).toFixed(0)}° — its centre of gravity moved outside its base.`, k === 0 ? 'warn' : ''); } o.piv.rotation.z = Math.PI / 2 * 0.95; }
      else o.piv.rotation.z = 0;
    });
    if (this.cg.toppled.size === 2 && !this.stG.isDone(2)) { this.stG.done(2); this.ui.note('The low, wide racing car tilted much further before toppling than the tall, narrow bus.', 'gold'); }
    this.checkTab('cog', this.stG, 4);
  }

  checkTab(id, st) { st.check(); }
  update(dt, t) {
    super.update(dt, t);
    if (this.tab === 'springs' && this.stS && !this.stS.isDone(2)) { const k = this.ui.body?.querySelector('.aq'); if (k?.classList.contains('solved')) { this.stS.done(2); this.checkTab('springs', this.stS, 5); } }
    if (this.tab === 'cog' && this.plumb?.visible) this.plumb.rotation.z = -this.lam.rotation.z;
  }
}
void h;
