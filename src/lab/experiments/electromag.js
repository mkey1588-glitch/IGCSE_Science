import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { PowerSupply, Meter, Bulb, wire, mesh, mat, M } from '../apparatus.js';
import { h, clear, clamp, tweens, canvasTex } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const RED = '#dc2626', BLUE = '#2563eb';
function barMagnet(len = 0.12, w = 0.025) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(len / 2, w, w), mat(RED, 0.3, 0.4), len / 4, w / 2, 0), mesh(new THREE.BoxGeometry(len / 2, w, w), mat(BLUE, 0.3, 0.4), -len / 4, w / 2, 0));
  const { tex: tn } = canvasTex(64, 64, (c, W, H) => { c.fillStyle = '#fff'; c.font = '700 48px Inter'; c.textAlign = 'center'; c.fillText('N', W / 2, 50); });
  const { tex: ts } = canvasTex(64, 64, (c, W, H) => { c.fillStyle = '#fff'; c.font = '700 48px Inter'; c.textAlign = 'center'; c.fillText('S', W / 2, 50); });
  const n = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.02), new THREE.MeshBasicMaterial({ map: tn, transparent: true })); n.rotation.x = -Math.PI / 2; n.position.set(len / 4, w + 0.001, 0); g.add(n);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.02), new THREE.MeshBasicMaterial({ map: ts, transparent: true })); s.rotation.x = -Math.PI / 2; s.position.set(-len / 4, w + 0.001, 0); g.add(s);
  g.userData.len = len; return g;
}
function compass() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.003, 16), mat('#e2e8f0', 0.2, 0.4)));
  const nd = new THREE.Group(); nd.position.y = 0.003; g.add(nd);
  nd.add(mesh(new THREE.ConeGeometry(0.0025, 0.008, 6), mat(RED), 0.004, 0, 0).rotateZ(-Math.PI / 2), mesh(new THREE.ConeGeometry(0.0025, 0.008, 6), mat('#e5e7eb'), -0.004, 0, 0).rotateZ(Math.PI / 2));
  g.userData.needle = nd; return g;
}
function coilGeo(turns, r, len, wireR = 0.0016) {
  const pts = []; const N = turns * 24;
  for (let i = 0; i <= N; i++) { const a = (i / 24) * Math.PI * 2; pts.push(new THREE.Vector3(-len / 2 + (i / N) * len, Math.sin(a) * r, Math.cos(a) * r)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, wireR, 6, false);
}

export default class Electromag extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Kofi’s power station runs on generators and transformers, the scrapyard crane on an electromagnet, and every fan on the island on a motor. Discover the links between electricity and magnetism.';
    this.tabLabels = [['magnets', '🧲 Magnets'], ['electromagnet', '🔩 Electromagnet'], ['motor', '⚙️ Motor (S)'], ['generator', '⚡ Generator (S)'], ['transformer', '🔁 Transformer (S)']];
    this.tabObjectives = { magnets: ['P4.1'], electromagnet: ['P4.5.3', 'P4.1'], motor: ['P4.5.4', 'P4.5.5'], generator: ['P4.5.1', 'P4.5.2'], transformer: ['P4.5.6'] };
    const v = { pos: [0, 1.36, 0.8], target: [0, 0.98, 0] };
    this.tabViews = { magnets: v, electromagnet: v, motor: { pos: [0, 1.34, 0.78], target: [0, 1.04, 0] }, generator: { pos: [0, 1.34, 0.8], target: [0, 1.03, 0] }, transformer: { pos: [0, 1.32, 0.8], target: [0, 1.03, 0] } };
    this.view = v;
  }
  checkTab(id, st) { st.check(); }

  // ======================================================== magnets
  tab_magnets() {
    const Y = this.Y;
    this.mg = { flip: false, tested: new Set(), mags: false, kept: null };
    this.m1 = barMagnet(); this.lab.add(this.m1, -0.15, Y, 0);
    this.m2 = barMagnet(); this.lab.add(this.m2, 0.15, Y, 0);
    this.lab.draggable(this.m2, { axis: 'x', min: -0.02, max: 0.3, tip: 'Drag the magnet', onMove: () => this.fieldUpdate() });
    this.comps = [];
    for (let i = -4; i <= 4; i++) for (let j = -2; j <= 2; j++) { if (j === 0 && Math.abs(i) <= 3) continue; const c = compass(); this.lab.add(c, i * 0.05, Y, j * 0.045); this.comps.push(c); }
    const things = [['Iron nail', true, '#6b7280'], ['Steel paper clip', true, '#94a3b8'], ['Nickel coin', true, '#d1d5db'], ['Copper wire', false, '#c8743c'], ['Aluminium can', false, '#e5e7eb'], ['Plastic ruler', false, '#22c55e'], ['Wooden peg', false, '#b45309']];
    this.things = things;
    const ui = this.ui;
    this.stM = ui.steps(['Show **attraction and repulsion** between two magnets', 'Sort materials into **magnetic and non-magnetic**', { t: '(S) Read the **field direction** from the plotting compasses', o: ['P4.1.6'] }, 'Compare **soft iron and steel**: temporary or permanent?', 'Answer the analysis questions']);
    const sec = ui.section('Two bar magnets');
    ui.buttons([{ label: '🔄 Turn the right magnet round', onClick: () => this.flipM2() }, { label: '🤝 Push them together', kind: 'primary', onClick: () => this.pushTogether() }], sec);
    const ms = ui.section('Test materials with a magnet');
    this.matBox = h('div', { class: 'row wrap', style: { gap: '4px' } }); ms.append(this.matBox);
    things.forEach(([n, mag]) => this.matBox.append(h('button', { class: 'btn small', onClick: (e) => { this.mg.tested.add(n); e.target.classList.add(mag ? 'good' : 'danger'); e.target.textContent = `${n}: ${mag ? 'attracted ✓' : 'not attracted'}`; audio[mag ? 'clink' : 'click'](); if (this.mg.tested.size === things.length) { this.stM.done(1); this.ui.note('Only **iron, steel, nickel and cobalt** (and their alloys) are magnetic. Copper and aluminium are metals but **not** magnetic.', 'gold'); this.checkTab('magnets', this.stM, 5); } } }, n)));
    const fs = ui.section('(S) Plotting compasses');
    ui.buttons([{ label: '🧭 Read the field', onClick: () => { this.stM.done(2); this.ui.note('Each compass points along the field: field lines run **from N to S** outside a magnet. The field direction is the direction of the force on a **north** pole.', 'gold'); this.checkTab('magnets', this.stM, 5); } }], fs);
    const ir = ui.section('Soft iron vs steel');
    ui.buttons([{ label: '🔩 Stroke soft iron, then remove magnet', onClick: () => this.induce('iron') }, { label: '📎 Stroke steel, then remove magnet', onClick: () => this.induce('steel') }], ir);
    ui.notes();
    ui.questions([
      { q: 'Two north poles brought together will…', opts: ['repel', 'attract', 'do nothing', 'stick only if pushed'], e: 'Like poles repel; unlike poles attract.', o: [1] },
      { q: 'Why is **soft iron** used in electromagnets but **steel** in permanent magnets?', opts: ['Soft iron magnetises and demagnetises easily; steel keeps its magnetism', 'Steel is lighter', 'Soft iron is not magnetic', 'Steel conducts better'], e: 'Temporary vs permanent magnetism.', o: [2] },
      { q: '(S) A magnetic field is…', opts: ['the region where a magnetic pole experiences a force', 'the inside of a magnet', 'a flow of electrons', 'an electric charge'], e: 'Field lines show its shape and direction.', o: [5, 6] },
      { q: '(S) A nail touching a magnet can pick up paper clips because…', opts: ['magnetism is induced in the nail', 'the nail is charged', 'clips are made of copper', 'gravity is reversed'], e: 'Induced magnetism — the nail becomes a temporary magnet.', o: [7] },
    ], { sub: 'P4.1', onDone: () => { this.stM.done(4); this.checkTab('magnets', this.stM, 5); } });
    this.fieldUpdate();
  }
  poles() {
    const out = [];
    for (const [m, flip] of [[this.m1, false], [this.m2, this.mg.flip]]) { const L = m.userData.len / 2 - 0.01, x = m.position.x; out.push({ x: x + (flip ? -L : L), q: 1 }, { x: x + (flip ? L : -L), q: -1 }); }
    return out;
  }
  fieldUpdate() {
    const P = this.poles();
    for (const c of this.comps) {
      let bx = 0, bz = 0; const cx = c.position.x, cz = c.position.z;
      for (const p of P) { const dx = cx - p.x, dz = cz, r2 = dx * dx + dz * dz + 1e-4, r3 = r2 * Math.sqrt(r2); bx += (p.q * dx) / r3; bz += (p.q * dz) / r3; }
      c.userData.needle.rotation.y = -Math.atan2(bz, bx);
    }
  }
  flipM2() { this.mg.flip = !this.mg.flip; tweens.to(this.m2.rotation, { y: this.mg.flip ? Math.PI : 0 }, 0.6).promise.then(() => this.fieldUpdate()); audio.click(); }
  async pushTogether() {
    const facing = this.mg.flip ? 'N–N' : 'N–S';
    await tweens.to(this.m2.position, { x: -0.028 }, 0.6).promise;
    if (this.mg.flip) { audio.whoosh?.(); await tweens.to(this.m2.position, { x: 0.22 }, 0.5, { ease: (t) => 1 - (1 - t) * (1 - t) }).promise; this.ui.note('**Like poles repel** — the magnets pushed apart.'); this.mg.rep = true; }
    else { audio.clink(); this.ui.note('**Unlike poles attract** — N and S snapped together.'); this.mg.att = true; }
    void facing; this.fieldUpdate();
    if (this.mg.rep && this.mg.att) { this.stM.done(0); this.checkTab('magnets', this.stM, 5); }
  }
  induce(k) {
    this.mg[k] = true; audio.clink();
    this.ui.note(k === 'iron' ? 'Soft iron picked up 6 clips while touching the magnet — and dropped them all when the magnet was removed: **temporary magnet**.' : 'Steel picked up 4 clips — and still held 3 after the magnet was removed: **permanent magnet**.');
    if (this.mg.iron && this.mg.steel) { this.stM.done(3); this.ui.note('Soft iron = easy to magnetise, loses it quickly (electromagnet cores, transformers). Steel = harder to magnetise, keeps it (permanent magnets).', 'gold'); this.checkTab('magnets', this.stM, 5); }
  }

  // ======================================================== electromagnet
  tab_electromagnet() {
    const Y = this.Y;
    this.em = { I: 1, N: 40, core: true, dir: 1, seenI: new Set([1]), seenN: new Set([40]), nocore: false, rev: false };
    this.coilG = new THREE.Group(); this.lab.add(this.coilG, -0.05, Y + 0.12, 0);
    this.core = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 16), mat('#52525b', 0.8, 0.4)); this.core.rotation.z = Math.PI / 2; this.coilG.add(this.core);
    this.coilMesh = null; this.rebuildCoil();
    this.lab.add(mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02), M.dark), -0.16, Y + 0.06, 0);
    this.ps = new PowerSupply(); this.lab.add(this.ps, 0.25, Y, -0.08);
    this.lab.add(wire([[-0.12, Y + 0.12, 0.012], [-0.1, Y + 0.05, 0.08], [0.2, Y + 0.03, 0.02], [0.22, Y + 0.025, -0.01]], '#dc2626'));
    this.lab.add(wire([[0.02, Y + 0.12, 0.012], [0.05, Y + 0.06, 0.06], [0.25, Y + 0.03, 0.03], [0.27, Y + 0.025, -0.01]], '#111827'));
    this.clips = new THREE.Group(); this.lab.add(this.clips, -0.05, Y, 0);
    for (let i = 0; i < 14; i++) { const c = mesh(new THREE.TorusGeometry(0.006, 0.0012, 4, 12), M.steel); c.scale.y = 1.8; c.position.set((Math.random() - 0.5) * 0.08, 0.003, (Math.random() - 0.5) * 0.05); c.rotation.x = Math.PI / 2; this.clips.add(c); }
    this.ring = []; for (let i = 0; i < 8; i++) { const c = compass(); const a = (i / 8) * Math.PI * 2; this.lab.add(c, -0.05 + Math.cos(a) * 0.13, Y, Math.sin(a) * 0.09); this.ring.push(c); }
    const ui = this.ui;
    this.stE = ui.steps(['Increase the **current** — how many clips?', 'Increase the **number of turns**', 'Take out the **iron core**', { t: '(S) **Reverse** the current and watch the compasses', o: ['P4.5.3.2'] }, 'Answer the analysis questions']);
    const sec = ui.section('Electromagnet');
    ui.slider({ label: 'Current', min: 0, max: 3, step: 0.5, value: this.em.I, unit: 'A', parent: sec, onInput: (v) => { this.em.I = v; this.em.seenI.add(v); this.emUpdate(); } });
    ui.seg({ label: 'Turns of wire', options: [[20, '20'], [40, '40'], [80, '80']], value: 40, parent: sec, onChange: (v) => { this.em.N = +v; this.em.seenN.add(+v); this.rebuildCoil(); this.emUpdate(); } });
    ui.seg({ label: 'Core', options: [[true, 'Soft iron'], [false, 'None (air)']], value: true, parent: sec, onChange: (v) => { this.em.core = v === true || v === 'true'; if (!this.em.core) this.em.nocore = true; this.core.visible = this.em.core; this.emUpdate(); } });
    ui.buttons([{ label: '🔁 Reverse current', onClick: () => { this.em.dir *= -1; this.em.rev = true; audio.click(); this.emUpdate(); } }], sec);
    this.roE = ui.readouts([{ id: 'c', label: 'Paper clips held' }, { id: 'p', label: 'Left end is' }], sec);
    ui.notes();
    ui.questions([
      { q: 'Name **three** ways to make an electromagnet stronger.', opts: ['More current, more turns, and an iron core', 'Less current, fewer turns, plastic core', 'A thicker plastic case', 'Reverse the current'], e: 'Reversing the current only swaps the poles.', o: [2], sub: 'P4.5.3' },
      { q: 'Why does a scrapyard crane use an **electromagnet** instead of a permanent magnet?', opts: ['It can be switched off to drop the scrap', 'It is lighter', 'It needs no electricity', 'It only attracts aluminium'], e: 'Electromagnets can be turned on and off and their strength controlled.', o: [4], sub: 'P4.1' },
      { q: '(S) The field around a current-carrying **straight wire** is…', opts: ['circles around the wire', 'parallel lines along the wire', 'zero', 'just like a bar magnet'], e: 'Reverse the current and the circles reverse direction. A solenoid’s field looks like a bar magnet’s.', o: [1, 2], sub: 'P4.5.3' },
    ], { sub: 'P4.5.3', onDone: () => { this.stE.done(4); this.checkTab('electromagnet', this.stE, 5); } });
    this.emUpdate();
  }
  rebuildCoil() {
    if (this.coilMesh) { this.coilG.remove(this.coilMesh); this.coilMesh.geometry.dispose(); }
    this.coilMesh = mesh(coilGeo(Math.round(this.em.N / 4), 0.013, 0.12), M.copper); this.coilG.add(this.coilMesh);
  }
  emUpdate() {
    const e = this.em; const strength = e.I * e.N * (e.core ? 1 : 0.08) * e.dir;
    const nClips = clamp(Math.round(Math.abs(strength) / 12), 0, 14);
    this.clips.children.forEach((c, i) => { const held = i < nClips; c.position.y = held ? 0.1 - (i % 5) * 0.012 : 0.003; c.position.x = held ? -0.06 + Math.floor(i / 5) * 0.03 + 0.02 : c.position.x; });
    const sg = Math.sign(strength); this.ring.forEach((c) => { if (Math.abs(strength) < 1) { c.userData.needle.rotation.y = 0; return; } let bx = 0, bz = 0; for (const [px, q] of [[-0.05 + 0.06, sg], [-0.05 - 0.06, -sg]]) { const dx = c.position.x - px, dz = c.position.z, r3 = Math.pow(dx * dx + dz * dz + 1e-4, 1.5); bx += (q * dx) / r3; bz += (q * dz) / r3; } c.userData.needle.rotation.y = -Math.atan2(bz, bx); });
    this.ps.set(e.I * 4);
    this.roE.set('c', nClips); this.roE.set('p', Math.abs(strength) < 1 ? '—' : strength > 0 ? 'South' : 'North');
    if (e.seenI.size >= 2 && !this.stE.isDone(0)) { this.stE.done(0); this.ui.note('**More current → stronger field → more clips.**', 'gold'); }
    if (e.seenN.size >= 2 && !this.stE.isDone(1)) { this.stE.done(1); this.ui.note('**More turns → stronger electromagnet.**', 'gold'); }
    if (e.nocore && !this.stE.isDone(2)) { this.stE.done(2); this.ui.note('Without the soft-iron core the field is far weaker — the iron becomes magnetised and concentrates the field.', 'gold'); }
    if (e.rev && !this.stE.isDone(3)) { this.stE.done(3); this.ui.note('Reversing the current **reverses the field**: every compass needle turned round and the poles swapped.', 'gold'); }
    this.checkTab('electromagnet', this.stE, 5);
  }

  // ======================================================== motor
  tab_motor() {
    const Y = this.Y;
    this.mo = { I: 1, B: 1, N: 1, dir: 1, ang: 0, runs: new Set(), rev: false };
    const mag = (x, col, txt) => { const m = mesh(new THREE.BoxGeometry(0.05, 0.12, 0.08), mat(col, 0.3, 0.4)); this.lab.add(m, x, Y + 0.12, 0); this.lab.label(m, txt, { y: 0.09 }); return m; };
    mag(-0.14, RED, 'N'); mag(0.14, BLUE, 'S');
    this.rotor = new THREE.Group(); this.lab.add(this.rotor, 0, Y + 0.12, 0);
    const loopPts = [[-0.075, 0, -0.04], [-0.075, 0, 0.04], [0.075, 0, 0.04], [0.075, 0, -0.04]].map((p) => new THREE.Vector3(...p));
    this.coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([...loopPts, loopPts[0]], false, 'catmullrom', 0), 60, 0.003, 8, false), M.copper);
    this.rotor.add(this.coil);
    const axle = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.16, 8), M.steel, 0, 0, 0.0); axle.rotation.x = Math.PI / 2; this.rotor.add(axle);
    this.rotor.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 16, 1, false, 0.15, Math.PI - 0.3), M.brass, 0, 0, 0.07).rotateX(Math.PI / 2), mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 16, 1, false, Math.PI + 0.15, Math.PI - 0.3), M.brass, 0, 0, 0.07).rotateX(Math.PI / 2));
    const brushM = mat('#1f2937', 0, 0.9);
    this.lab.add(mesh(new THREE.BoxGeometry(0.008, 0.02, 0.008), brushM), -0.017, Y + 0.12, 0.07); this.lab.add(mesh(new THREE.BoxGeometry(0.008, 0.02, 0.008), brushM), 0.017, Y + 0.12, 0.07);
    this.lab.label(this.rotor, 'Coil on an axle · split-ring commutator + brushes', { y: 0.12 });
    this.fArrows = [0, 1].map(() => { const g = new THREE.Group(); const sh = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.05, 8), new THREE.MeshBasicMaterial({ color: '#22c55e' })); sh.position.y = 0.025; g.add(sh); const hd = mesh(new THREE.ConeGeometry(0.008, 0.016, 10), new THREE.MeshBasicMaterial({ color: '#22c55e' })); hd.position.y = 0.055; g.add(hd); this.rotor.add(g); return g; });
    const ui = this.ui;
    this.stO = ui.steps(['Switch on the **d.c. motor**', 'Make it spin **faster** (three ways)', 'Make it spin the **other way**', 'Explain the **split-ring commutator**', 'Answer the analysis questions']);
    const sec = ui.section('d.c. motor');
    ui.slider({ label: 'Current', min: 0, max: 3, step: 0.5, value: this.mo.I, unit: 'A', parent: sec, onInput: (v) => { this.mo.I = v; this.mo.runs.add(`I${v}`); this.moCheck(); } });
    ui.seg({ label: 'Magnets', options: [[1, 'Normal'], [2, 'Stronger']], value: 1, parent: sec, onChange: (v) => { this.mo.B = +v; this.mo.runs.add(`B${v}`); this.moCheck(); } });
    ui.seg({ label: 'Turns on the coil', options: [[1, '1×'], [3, '3×']], value: 1, parent: sec, onChange: (v) => { this.mo.N = +v; this.mo.runs.add(`N${v}`); this.moCheck(); } });
    ui.buttons([{ label: '🔁 Reverse the current', onClick: () => { this.mo.dir *= -1; this.mo.rev = true; audio.click(); this.moCheck(); } }], sec);
    this.roO = ui.readouts([{ id: 'rpm', label: 'Speed', unit: 'rev/min' }, { id: 'd', label: 'Direction' }], sec);
    const cm = ui.section('Split-ring commutator');
    ui.questions([{ q: 'What does the split-ring commutator do?', opts: ['Reverses the current in the coil every half turn, so the coil keeps turning the same way', 'Makes the current bigger', 'Stops the coil overheating', 'Turns d.c. into a.c. for the battery'], e: 'Without it the coil would just rock back and forth.', o: [2], sub: 'P4.5.5' }], { sub: 'P4.5.5', title: 'Why the split ring?', parent: cm, onDone: () => { this.stO.done(3); this.checkTab('motor', this.stO, 5); } });
    ui.notes();
    ui.questions([
      { q: 'Fleming’s **left-hand rule**: First finger = Field, seCond finger = Current. The thuMb shows…', opts: ['the direction of the force (motion)', 'the magnetic field', 'the current', 'the voltage'], e: 'Field, Current and Force are all at right angles.', o: [2], sub: 'P4.5.4' },
      { q: 'Reversing **both** the current and the magnetic field makes the motor turn…', opts: ['the same way as before', 'the opposite way', 'faster', 'not at all'], e: 'Two reversals cancel out.', o: [1], sub: 'P4.5.4' },
      { q: 'Which change does **not** increase the turning effect on the coil?', opts: ['Reversing the current', 'More current', 'Stronger magnets', 'More turns on the coil'], e: 'Reversing only changes direction.', o: [1], sub: 'P4.5.5' },
    ], { sub: 'P4.5.4', onDone: () => { this.stO.done(4); this.checkTab('motor', this.stO, 5); } });
    this.every((dt) => this.simMotor(dt));
  }
  moCheck() {
    const m = this.mo;
    if (m.I > 0) this.stO.done(0);
    const faster = ['I2', 'I2.5', 'I3'].some((k) => m.runs.has(k)) + (m.runs.has('B2') ? 1 : 0) + (m.runs.has('N3') ? 1 : 0);
    if ((['I2', 'I2.5', 'I3'].some((k) => m.runs.has(k)) && m.runs.has('B2') && m.runs.has('N3')) && !this.stO.isDone(1)) { this.stO.done(1); this.ui.note('Faster with **more current**, **stronger magnets** or **more turns** — each increases the turning effect.', 'gold'); }
    void faster;
    if (m.rev && !this.stO.isDone(2)) { this.stO.done(2); this.ui.note('Reversing the current reversed the force on each side of the coil, so the motor turned the **other way**.', 'gold'); }
    this.checkTab('motor', this.stO, 5);
  }
  simMotor(dt) {
    const m = this.mo, w = m.I * m.B * m.N * m.dir * 3.2;
    m.ang += w * dt; this.rotor.rotation.z = m.ang;
    const s = Math.sign(Math.cos(m.ang)) || 1;
    this.fArrows[0].position.set(-0.075, 0, 0); this.fArrows[1].position.set(0.075, 0, 0);
    const show = m.I > 0; this.fArrows.forEach((a, i) => { a.visible = show; a.rotation.z = (i ? Math.PI : 0) + (m.dir > 0 ? 0 : Math.PI) + (s < 0 ? Math.PI : 0); a.scale.setScalar(0.4 + 0.25 * m.I * m.B * m.N / 3); });
    this.roO.set('rpm', Math.abs(w * 60 / (2 * Math.PI) * 10).toFixed(0)); this.roO.set('d', w === 0 ? '—' : w > 0 ? 'anticlockwise' : 'clockwise');
    if (Math.abs(w) > 0.1) { this._hum = (this._hum || 0) + dt; if (this._hum > 0.25) { this._hum = 0; audio.tone(80 + Math.abs(w) * 12, 0.08, { type: 'sawtooth', gain: 0.012 }); } }
  }

  // ======================================================== generator
  tab_generator() {
    const Y = this.Y;
    this.gn = { rpm: 0, ang: 0, ring: 'slip', pushes: new Set(), spun: new Set(), mag: null, t: 0 };
    const mag = (x, col, txt) => { const m = mesh(new THREE.BoxGeometry(0.05, 0.12, 0.08), mat(col, 0.3, 0.4)); this.lab.add(m, x, Y + 0.12, -0.05); this.lab.label(m, txt, { y: 0.09 }); return m; };
    mag(-0.22, RED, 'N'); mag(0.0, BLUE, 'S');
    this.grotor = new THREE.Group(); this.lab.add(this.grotor, -0.11, Y + 0.12, -0.05);
    const loopPts = [[-0.065, 0, -0.04], [-0.065, 0, 0.04], [0.065, 0, 0.04], [0.065, 0, -0.04]].map((p) => new THREE.Vector3(...p));
    const gcoil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([...loopPts, loopPts[0]], false, 'catmullrom', 0), 60, 0.003, 8, false), M.copper); this.grotor.add(gcoil);
    this.grotor.add(mesh(new THREE.TorusGeometry(0.01, 0.003, 8, 20), M.brass, 0, 0, 0.065), mesh(new THREE.TorusGeometry(0.01, 0.003, 8, 20), M.brass, 0, 0, 0.08));
    this.lab.label(this.grotor, 'Coil + slip rings', { y: 0.11 });
    this.trace = canvasTex(512, 256); const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.11), new THREE.MeshBasicMaterial({ map: this.trace.tex, toneMapped: false })); this.lab.add(scr, 0.22, Y + 0.13, -0.05);
    this.lab.add(mesh(new THREE.BoxGeometry(0.24, 0.13, 0.05), mat('#334155')), 0.22, Y + 0.13, -0.08);
    this.lab.label(scr, 'Output e.m.f. (oscilloscope)', { y: 0.08 });
    this.hist = [];
    // magnet + coil + galvanometer demo
    this.coil2 = mesh(coilGeo(10, 0.018, 0.08), M.copper); this.coil2.rotation.y = 0; this.lab.add(this.coil2, 0.05, Y + 0.03, 0.15);
    this.bm = barMagnet(0.1, 0.02); this.lab.add(this.bm, -0.12, Y + 0.02, 0.15);
    this.galv = new Meter('G'); this.lab.add(this.galv, 0.22, Y, 0.15); this.galv.name = 'Galvanometer';
    this.lab.label(this.galv, 'Galvanometer', { y: 0.08, cls: 'dimlab' });
    const ui = this.ui;
    this.stG = ui.steps(['Push the magnet **in** and pull it **out** of the coil', 'Move the magnet **faster** — what changes?', 'Spin the **a.c. generator**', 'Spin it **faster** and compare the trace', 'Answer the analysis questions']);
    const s1 = ui.section('Magnet and coil');
    ui.buttons([{ label: '➡ Push in (slow)', onClick: () => this.pushMag(1, 1) }, { label: '⬅ Pull out (slow)', onClick: () => this.pushMag(-1, 1) }, { label: '⏩ Push in (fast)', onClick: () => this.pushMag(1, 3) }], s1);
    this.roG = ui.readouts([{ id: 'g', label: 'Galvanometer reading' }], s1);
    const s2 = ui.section('a.c. generator');
    ui.slider({ label: 'Turning speed', min: 0, max: 600, step: 60, value: 0, unit: 'rev/min', parent: s2, onInput: (v) => { this.gn.rpm = v; if (v > 0) { this.gn.spun.add(v); this.stG.done(2); } if (this.gn.spun.size >= 2 && [...this.gn.spun].some((x) => x >= 360)) { this.stG.done(3); this.ui.note('Faster turning → **bigger peaks** (larger e.m.f.) **and** more cycles per second (higher frequency).', 'gold'); } this.checkTab('generator', this.stG, 5); } });
    ui.notes();
    ui.questions([
      { q: '(S) An e.m.f. is induced in a coil when…', opts: ['there is relative movement between the coil and a magnetic field (or the field changes)', 'a magnet is held still inside it', 'it is heated', 'a battery is connected to it'], e: 'No movement → no change in field → no induced e.m.f.', o: [1], sub: 'P4.5.1' },
      { q: '(S) Which **increases** the induced e.m.f.?', opts: ['Moving the magnet faster, using a stronger magnet, or more turns on the coil', 'Moving the magnet more slowly', 'Using a plastic core', 'Using fewer turns'], e: 'Faster change = bigger e.m.f.', o: [2], sub: 'P4.5.1' },
      { q: '(S) The a.c. generator uses **slip rings** so that…', opts: ['the output current reverses every half turn — alternating current', 'the output is always d.c.', 'the coil spins faster', 'no brushes are needed'], e: 'A d.c. dynamo would use a split-ring commutator instead.', o: [1], sub: 'P4.5.2' },
      { q: '(S) On the e.m.f.–time graph, the e.m.f. is **largest** when the coil is…', opts: ['parallel to the field lines — cutting them fastest', 'perpendicular to the field', 'stopped', 'outside the magnets'], e: 'The peaks happen twice per turn, in opposite directions.', o: [2], sub: 'P4.5.2' },
    ], { sub: 'P4.5.1', onDone: () => { this.stG.done(4); this.checkTab('generator', this.stG, 5); } });
    this.every((dt) => this.simGen(dt));
  }
  async pushMag(dir, speed) {
    if (this.gn.mag) return; this.gn.mag = true;
    const x0 = this.bm.position.x, x1 = dir > 0 ? -0.02 : -0.12;
    if ((dir > 0 && x0 > -0.05) || (dir < 0 && x0 < -0.09)) { this.gn.mag = null; this.ui.hint(dir > 0 ? 'The magnet is already in — pull it out.' : 'Push it in first.', 2000); return; }
    const reading = dir * speed * 1.2;
    this._g = reading; this.roG.set('g', `${reading > 0 ? '+' : ''}${reading.toFixed(1)} (needle ${reading > 0 ? 'right' : 'left'})`);
    await tweens.to(this.bm.position, { x: x1 }, 0.9 / speed).promise;
    this._g = 0; this.gn.mag = null; this.gn.pushes.add(`${dir}${speed}`);
    audio.click();
    if (this.gn.pushes.has('11') && this.gn.pushes.has('-11') && !this.stG.isDone(0)) { this.stG.done(0); this.ui.note('Moving in → needle one way; moving out → the **other** way. Holding the magnet still → **zero**.', 'gold'); }
    if (this.gn.pushes.has('13') && !this.stG.isDone(1)) { this.stG.done(1); this.ui.note('Faster movement → **bigger** induced e.m.f.', 'gold'); }
    this.checkTab('generator', this.stG, 5);
  }
  simGen(dt) {
    const g = this.gn; const w = (g.rpm / 60) * 2 * Math.PI;
    g.ang += w * dt * 0.25; g.t += dt; this.grotor.rotation.z = g.ang;
    const emf = (g.rpm / 600) * Math.sin(g.ang);
    this.hist.push(emf); if (this.hist.length > 240) this.hist.shift();
    const needle = this._g || 0; this.galv.set(needle, 'G');
    this.trace.redraw((ctx, W, H) => {
      ctx.fillStyle = '#04130c'; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = 'rgba(74,222,128,.2)'; ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
      ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 3; ctx.beginPath(); this.hist.forEach((v, i) => { const x = (i / 240) * W, y = H / 2 - v * H * 0.42; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
    });
  }

  // ======================================================== transformer
  tab_transformer() {
    const Y = this.Y;
    this.tf = { Np: 100, Ns: 200, Vp: 12, up: false, down: false };
    const core = new THREE.Group(); this.lab.add(core, 0, Y + 0.12, 0);
    const cm = mat('#52525b', 0.7, 0.45);
    core.add(mesh(new THREE.BoxGeometry(0.22, 0.025, 0.03), cm, 0, 0.0875, 0), mesh(new THREE.BoxGeometry(0.22, 0.025, 0.03), cm, 0, -0.0875, 0), mesh(new THREE.BoxGeometry(0.025, 0.2, 0.03), cm, -0.0975, 0, 0), mesh(new THREE.BoxGeometry(0.025, 0.2, 0.03), cm, 0.0975, 0, 0));
    this.lab.label(core, 'Laminated soft-iron core', { y: 0.12 });
    this.pCoil = null; this.sCoil = null; this.coreG = core;
    this.psT = new PowerSupply(); this.lab.add(this.psT, -0.3, Y, 0);
    this.bulbT = new Bulb(); this.lab.add(this.bulbT, 0.26, Y, 0.04);
    this.lab.add(wire([[-0.24, Y + 0.03, 0.06], [-0.15, Y + 0.08, 0.04], [-0.1, Y + 0.1, 0.02]], '#dc2626'));
    this.lab.add(wire([[0.1, Y + 0.1, 0.02], [0.18, Y + 0.06, 0.05], [0.26, Y + 0.02, 0.05]], '#111827'));
    this.vm = [new Meter('V'), new Meter('V')]; this.lab.add(this.vm[0], -0.18, Y, 0.16); this.lab.add(this.vm[1], 0.16, Y, 0.16);
    this.lab.label(this.vm[0], 'Primary V', { y: 0.08, cls: 'dimlab' }); this.lab.label(this.vm[1], 'Secondary V', { y: 0.08, cls: 'dimlab' });
    const ui = this.ui;
    this.stT = ui.steps(['Make a **step-up** transformer', 'Make a **step-down** transformer', 'Try **d.c.** on the primary', 'Answer the analysis questions']);
    const sec = ui.section('Coils');
    ui.seg({ label: 'Primary turns Np', options: [[50, '50'], [100, '100'], [200, '200'], [400, '400']], value: 100, parent: sec, onChange: (v) => { this.tf.Np = +v; this.tfUpdate(); } });
    ui.seg({ label: 'Secondary turns Ns', options: [[50, '50'], [100, '100'], [200, '200'], [400, '400']], value: 200, parent: sec, onChange: (v) => { this.tf.Ns = +v; this.tfUpdate(); } });
    ui.slider({ label: 'Primary voltage (a.c.)', min: 2, max: 12, step: 1, value: this.tf.Vp, unit: 'V', parent: sec, onInput: (v) => { this.tf.Vp = v; this.tfUpdate(); } });
    ui.seg({ label: 'Supply', options: [['ac', 'a.c.'], ['dc', 'd.c.']], value: 'ac', parent: sec, onChange: (v) => { this.tf.dc = v === 'dc'; if (this.tf.dc) { this.stT.done(2); this.ui.note('With **d.c.** the secondary output is **zero**: a steady current makes a steady field, and only a **changing** field induces a voltage.', 'gold'); } this.tfUpdate(); } });
    this.roT = ui.readouts([{ id: 'Vs', label: 'Secondary voltage', unit: 'V' }, { id: 'type', label: 'Type' }], sec);
    ui.notes();
    ui.questions([
      { q: '(S) A transformer has 100 primary turns and 2000 secondary turns. The primary is 230 V. What is the secondary voltage?', ans: 4600, tol: 0.01, unit: 'V', e: 'Vs = Vp × Ns ÷ Np = 230 × 2000 ÷ 100 = {ans} V.', o: [3] },
      { q: '(S) A 100% efficient transformer steps 230 V down to 11.5 V and delivers 2.0 A. What is the primary current?', ans: 0.1, tol: 0.01, unit: 'A', e: 'IpVp = IsVs → Ip = 11.5 × 2.0 ÷ 230 = {ans} A.', o: [4] },
      { q: '(S) Why is the core made of **soft iron**?', opts: ['It is easily magnetised and demagnetised, so it carries the changing field efficiently', 'It is a good insulator', 'It is cheap and heavy', 'It makes the current d.c.'], e: 'The core links the changing magnetic field from the primary to the secondary.', o: [1] },
    ], { sub: 'P4.5.6', onDone: () => { this.stT.done(3); this.checkTab('transformer', this.stT, 4); } });
    this.tfUpdate();
  }
  tfUpdate() {
    const t = this.tf;
    if (this.pCoil) { this.coreG.remove(this.pCoil); this.pCoil.geometry.dispose(); } if (this.sCoil) { this.coreG.remove(this.sCoil); this.sCoil.geometry.dispose(); }
    this.pCoil = mesh(coilGeo(Math.round(t.Np / 25), 0.024, 0.13, 0.0022), M.copper); this.pCoil.rotation.z = Math.PI / 2; this.pCoil.position.x = -0.0975; this.coreG.add(this.pCoil);
    this.sCoil = mesh(coilGeo(Math.round(t.Ns / 25), 0.024, 0.13, 0.0022), mat('#b45309', 0.8, 0.35)); this.sCoil.rotation.z = Math.PI / 2; this.sCoil.position.x = 0.0975; this.coreG.add(this.sCoil);
    const Vs = t.dc ? 0 : (t.Vp * t.Ns) / t.Np;
    this.psT.set(t.Vp); this.vm[0].set(t.Vp); this.vm[1].set(Vs); this.bulbT.set(clamp(Vs / 12, 0, 1.4));
    this.roT.set('Vs', Vs.toFixed(1)); this.roT.set('type', t.dc ? 'no output (d.c.)' : t.Ns > t.Np ? 'step-up' : t.Ns < t.Np ? 'step-down' : '1 : 1');
    if (!t.dc && t.Ns > t.Np && !this.stT.isDone(0)) { this.stT.done(0); this.ui.note(`Step-up: more turns on the secondary → Vs = ${t.Vp} × ${t.Ns} ÷ ${t.Np} = **${Vs.toFixed(1)} V**.`, 'gold'); }
    if (!t.dc && t.Ns < t.Np && !this.stT.isDone(1)) { this.stT.done(1); this.ui.note(`Step-down: fewer turns on the secondary → **${Vs.toFixed(1)} V**. Phone chargers and doorbells use these.`, 'gold'); }
    this.checkTab('transformer', this.stT, 4);
  }
}
void h; void clear;
