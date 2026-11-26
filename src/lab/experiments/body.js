import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { boilingTube, Bubbles, ruler, mesh, mat, M, wire } from '../apparatus.js';
import { Character } from '../../world/characters.js';
import { clamp, tweens, h } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const LEVELS = [['0', 'Rest'], ['0.25', 'Walk'], ['0.5', 'Jog'], ['0.75', 'Run'], ['1', 'Sprint']];

export default class Body extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Coach Tomás’s runners collapse panting after a sprint, and his goalkeeper reacts too slowly. Measure what really happens inside the body.';
    this.tabLabels = [['exercise', '🏃 Exercise'], ['reaction', '⚡ Reaction time']];
    this.tabObjectives = { exercise: ['B9.2', 'B11.1', 'B12.1'], reaction: ['B13.1', 'B13.2'] };
    this.tabViews = { exercise: { pos: [0.1, 1.55, 1.6], target: [0.05, 1.12, 0] }, reaction: { pos: [0, 1.4, 0.95], target: [0, 1.15, 0] } };
    this.view = this.tabViews.exercise;
  }

  // ======================================================== exercise
  tab_exercise() {
    const Y = this.Y;
    this.I = 0; this.HR = 68; this.BR = 13; this.Vt = 0.5; this.lactic = 0.4; this.simT = 0; this.beat = 0; this.breathPh = 0;
    const tm = new THREE.Group(); this.lab.add(tm, -0.1, Y, 0);
    tm.add(mesh(new THREE.BoxGeometry(0.5, 0.05, 0.22), M.dark, 0, 0.025, 0));
    this.belt = mesh(new THREE.BoxGeometry(0.46, 0.01, 0.16), mat('#111827', 0, 0.9), 0, 0.055, 0); tm.add(this.belt);
    for (const z of [-0.1, 0.1]) { tm.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 6), M.steel, 0.2, 0.2, z)); tm.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), M.steel, 0.14, 0.35, z).rotateZ(Math.PI / 2)); }
    this.runner = new Character({ skin: '#a9765a', hair: '#1f1309', hairStyle: 'short', top: '#ef4444', bottom: '#1e293b', acc: 'whistle' });
    this.runner.root.scale.setScalar(0.24); this.runner.root.position.set(0, 0.06, 0); this.runner.root.rotation.y = Math.PI / 2; tm.add(this.runner.root);
    // heart & lungs icons
    this.heart = mesh(new THREE.SphereGeometry(0.03, 18, 14), new THREE.MeshStandardMaterial({ color: '#dc2626', emissive: '#7f1d1d', emissiveIntensity: 0.6 })); this.heart.scale.set(1, 1.1, 0.8);
    this.lab.add(this.heart, 0.22, Y + 0.38, -0.05); this.lab.label(this.heart, 'Heart', { y: 0.05, cls: 'dimlab' });
    this.lungs = [-1, 1].map((s) => { const l = mesh(new THREE.SphereGeometry(0.03, 16, 12), new THREE.MeshStandardMaterial({ color: '#f9a8d4', emissive: '#9d174d', emissiveIntensity: 0.25 })); l.scale.set(0.7, 1.2, 0.6); this.lab.add(l, 0.32 + s * 0.035, Y + 0.38, -0.05); return l; });
    this.lab.label(this.lungs[1], 'Lungs', { y: 0.06, cls: 'dimlab' });
    // limewater tubes
    this.limeA = boilingTube({ color: '#f1f5f9', level: 0.6, opacity: 0.4 }); this.lab.add(this.limeA, 0.25, Y, 0.12);
    this.limeB = boilingTube({ color: '#f1f5f9', level: 0.6, opacity: 0.4 }); this.lab.add(this.limeB, 0.32, Y, 0.12);
    this.lab.label(this.limeA, 'A: air in', { y: 0.2, cls: 'dimlab' }); this.lab.label(this.limeB, 'B: air out', { y: 0.2, cls: 'dimlab' });
    this.bA = new Bubbles({ r: 0.01, y0: 0.01, y1: 0.09, size: 0.002 }); this.limeA.add(this.bA);
    this.bB = new Bubbles({ r: 0.01, y0: 0.01, y1: 0.09, size: 0.002 }); this.limeB.add(this.bB);
    this.lab.add(wire([[0.25, Y + 0.17, 0.12], [0.285, Y + 0.24, 0.16], [0.32, Y + 0.17, 0.12]], '#94a3b8', 0.003));
    const ui = this.ui;
    this.st = ui.steps(['Record heart rate and breathing **at rest**', '**Jog** for a minute and record', '**Sprint** until lactic acid builds up', 'Return to **rest** and watch the oxygen debt being repaid', 'Compare **inspired and expired air** with limewater', 'Answer the analysis questions']);
    const sec = ui.section('Treadmill');
    ui.seg({ label: 'Exercise intensity', options: LEVELS, value: '0', parent: sec, onChange: (v) => { this.I = +v; } });
    ui.buttons([{ label: '⏩ Exercise for 1 minute', kind: 'primary', onClick: () => this.fastForward(60) }, { label: '📋 Record readings', onClick: () => this.record() }, { label: '🫧 Limewater test', onClick: () => this.limewater() }], sec);
    this.ro = ui.readouts([{ id: 'hr', label: 'Heart rate', unit: 'bpm' }, { id: 'br', label: 'Breathing', unit: '/min' }, { id: 'vt', label: 'Depth', unit: 'L' }, { id: 'la', label: 'Lactic acid', unit: 'mmol/L' }, { id: 'o2', label: 'O₂ demand', unit: 'L/min' }, { id: 'mode', label: 'Respiration' }], sec);
    const gsec = ui.section('Live monitors');
    this.gHR = ui.graph({ x: { label: 'Time / s (last 2 min)', min: 0, max: 120 }, y: { label: 'Heart rate / bpm', min: 40, max: 220 }, series: [{ name: 'HR', color: '#f87171', line: true, points: false }], height: 140 }, gsec);
    this.gBr = ui.graph({ x: { label: 'Time / s (last 30 s)', min: 0, max: 30 }, y: { label: 'Lung volume / L', min: -2, max: 2.5 }, series: [{ name: 'spirometer', color: '#5eead4', line: true, points: false }], height: 120 }, gsec);
    this.tbl = ui.table(['Activity', 'HR /bpm', 'Breaths /min', 'Depth /L', 'Lactic /mM'], ui.section('Readings'));
    ui.notes();
    ui.questions([
      { q: 'Why does heart rate increase during exercise?', opts: ['To deliver more oxygen and glucose to muscles and remove more CO₂', 'To cool the body down', 'Because the blood gets thicker', 'To make more red blood cells'], e: 'Working muscles respire faster.', o: [4, 8], sub: 'B9.2' },
      { q: 'After the sprint, breathing stayed fast even at rest. Why?', opts: ['Oxygen is needed to break down the lactic acid — the oxygen debt', 'The lungs were damaged', 'The body needed more carbon dioxide', 'The heart had stopped'], e: 'Lactic acid from anaerobic respiration is removed using extra oxygen.', o: [8, 9], sub: 'B12.1' },
      { q: 'Expired air turned limewater milky faster because it contains…', opts: ['more carbon dioxide', 'more oxygen', 'more nitrogen', 'less water vapour'], e: 'Respiration adds CO₂ (and water vapour) to the air you breathe out.', o: [2, 3], sub: 'B11.1' },
      { q: 'During the sprint, oxygen demand exceeded supply, so muscles also respired…', opts: ['anaerobically, making lactic acid', 'aerobically, making extra oxygen', 'by photosynthesis', 'without using glucose'], e: 'Anaerobic respiration releases less energy and produces lactic acid.', o: [5, 7], sub: 'B12.1' },
    ], { sub: 'B9.2', onDone: () => { this.st.done(5); if ([0, 1, 2, 3, 4, 5].every((i) => this.st.isDone(i))) this.lab.goal('exercise'); } });
    this.hrHist = []; this.brHist = [];
    this.every((dt, t) => this.simExercise(dt, t));
    this.records = {};
  }
  simExercise(dt, t, silent = false) {
    const I = this.I;
    const D = 0.3 + 3.4 * I, S = 2.6;
    const anaer = Math.max(0, D - S);
    this.lactic = clamp(this.lactic + (anaer * 1.6 - (D < S * 0.8 ? 0.55 : 0)) * dt / 60, 0.4, 14);
    const debt = Math.max(0, this.lactic - 0.6);
    const HRt = 68 + 125 * I + 16 * debt, BRt = 13 + 30 * I + 7 * debt, Vt = 0.5 + 2.0 * I + 0.25 * debt;
    const k = 1 - Math.exp(-dt / 12);
    this.HR += (HRt - this.HR) * k; this.BR += (BRt - this.BR) * k; this.Vt += (Vt - this.Vt) * k;
    this.simT += dt;
    if (silent) return;
    this.runner.speed = I * 9; this.runner.update(dt, t);
    this.belt.material.color.setHSL(0, 0, 0.07 + Math.sin(t * 30 * I) * 0.01);
    this.beat += dt * this.HR / 60;
    if (this.beat >= 1) { this.beat -= 1; audio.heartbeat(); }
    const pulse = Math.max(0, Math.sin(this.beat * Math.PI * 2)) ** 4;
    this.heart.scale.set(1 + pulse * 0.25, 1.1 + pulse * 0.25, 0.8 + pulse * 0.2);
    this.breathPh += dt * this.BR / 60 * Math.PI * 2;
    const vol = Math.sin(this.breathPh) * this.Vt / 2;
    this.lungs.forEach((l) => l.scale.set(0.7 + vol * 0.15, 1.2 + vol * 0.2, 0.6 + vol * 0.12));
    this.ro.set('hr', Math.round(this.HR)); this.ro.set('br', Math.round(this.BR)); this.ro.set('vt', this.Vt.toFixed(2)); this.ro.set('la', this.lactic.toFixed(1)); this.ro.set('o2', D.toFixed(1)); this.ro.set('mode', anaer > 0 ? 'aerobic + anaerobic' : 'aerobic');
    this._g = (this._g || 0) + dt;
    if (this._g > 0.25) {
      this._g = 0;
      this.hrHist.push([this.simT, this.HR]); this.brHist.push([this.simT, vol]);
      while (this.hrHist.length && this.hrHist[0][0] < this.simT - 120) this.hrHist.shift();
      while (this.brHist.length && this.brHist[0][0] < this.simT - 30) this.brHist.shift();
      const t0 = Math.max(0, this.simT - 120), b0 = Math.max(0, this.simT - 30);
      this.gHR.set(0, this.hrHist.map(([a, b]) => [a - t0, b])); this.gBr.set(0, this.brHist.map(([a, b]) => [a - b0, b]));
    }
    if (this.records.sprint && this.I === 0 && this.lactic < 1.2 && !this.st.isDone(3)) { this.st.done(3); this.ui.note('Lactic acid is falling back to normal — but heart rate and breathing stayed high while the **oxygen debt** was repaid.', 'gold'); }
    for (const b of [this.bA, this.bB]) b.update(dt);
    this.limeA.update(dt); this.limeB.update(dt);
  }
  fastForward(sec) { const steps = sec * 10; for (let i = 0; i < steps; i++) this.simExercise(0.1, 0, true); this.ui.note(`⏩ ${sec} s at ${LEVELS.find((l) => +l[0] === this.I)[1].toLowerCase()} intensity.`); }
  record() {
    const name = LEVELS.find((l) => +l[0] === this.I)[1];
    this.tbl.add([name, Math.round(this.HR), Math.round(this.BR), this.Vt.toFixed(2), this.lactic.toFixed(1)]);
    if (this.I === 0 && this.HR < 80) { this.records.rest = true; this.st.done(0); }
    if (this.I === 0.5 && this.HR > 120) { this.records.jog = true; this.st.done(1); }
    if (this.I === 1 && this.lactic > 2) { this.records.sprint = true; this.st.done(2); this.ui.note('Lactic acid is building up: oxygen cannot be delivered fast enough, so muscles also respire **anaerobically**.', 'warn'); }
    if (this.I > 0 && !this.records[name]) this.ui.hint('Tip: use “Exercise for 1 minute” so your body reaches a steady state before recording.', 3500);
    audio.clink();
  }
  limewater() {
    this.bA.setRate(25); this.bB.setRate(25); audio.bubble();
    this.limeB.setColor('#f8fafc', 2); this.limeB.setOpacity(0.95);
    this.limeA.setColor('#f1f5f9', 6); this.limeA.setOpacity(0.55);
    setTimeout(() => { this.bA.setRate(0); this.bB.setRate(0); this.ui.note('Tube B (breathed out) went milky quickly; tube A (breathed in) barely changed — expired air contains more CO₂.', 'gold'); this.st.done(4); }, 2500);
  }

  // ======================================================== reaction
  tab_reaction() {
    const Y = this.Y;
    this.trials = []; this.state = 'idle';
    const st = new THREE.Group(); this.lab.add(st, -0.05, Y, 0);
    st.add(mesh(new THREE.BoxGeometry(0.16, 0.012, 0.12), M.dark, 0, 0.006, 0), mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.6, 8), M.steel, -0.06, 0.3, 0));
    st.add(mesh(new THREE.BoxGeometry(0.1, 0.012, 0.03), M.dark, -0.02, 0.58, 0));
    this.rulerObj = ruler(0.3); this.rulerObj.rotation.z = Math.PI / 2; this.rulerObj.rotation.y = Math.PI / 2;
    this.rulerG = new THREE.Group(); this.rulerG.add(this.rulerObj); this.rulerG.position.set(0.02, 0.42, 0); st.add(this.rulerG);
    // hand (fingers either side of the ruler)
    this.hand = new THREE.Group(); this.hand.position.set(0.02, 0.24, 0); st.add(this.hand);
    const skin = mat('#d8a07a', 0, 0.6);
    this.fingerA = mesh(new THREE.BoxGeometry(0.02, 0.012, 0.05), skin, 0, 0, 0.035); this.fingerB = mesh(new THREE.BoxGeometry(0.02, 0.012, 0.05), skin, 0, 0, -0.035);
    this.hand.add(this.fingerA, this.fingerB, mesh(new THREE.BoxGeometry(0.06, 0.04, 0.08), skin, 0.05, -0.01, 0));
    this.lab.label(st, 'Ruler-drop test', { y: 0.66 });
    // reflex arc model
    const arc = new THREE.Group(); this.lab.add(arc, 0.26, Y + 0.05, -0.05); this.arc = arc;
    const pts = [[-0.08, 0.05, 0.05], [-0.03, 0.2, 0.02], [0.03, 0.28, 0], [0.08, 0.2, 0.02], [0.1, 0.06, 0.06]];
    const names = ['Receptor (skin)', 'Sensory neurone', 'Relay neurone (spinal cord)', 'Motor neurone', 'Effector (muscle)'];
    this.arcNodes = pts.map((p, i) => { const m = mesh(new THREE.SphereGeometry(0.012, 14, 10), new THREE.MeshStandardMaterial({ color: '#64748b', emissive: '#000000' })); m.position.set(...p); arc.add(m); this.lab.label(m, names[i], { y: 0.025, cls: 'dimlab' }); return m; });
    arc.add(wire(pts, '#94a3b8', 0.003));
    const cord = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 14), new THREE.MeshStandardMaterial({ color: '#cbd5e1', transparent: true, opacity: 0.45 }), 0.03, 0.28, -0.01); arc.add(cord);
    const ui = this.ui;
    this.st = ui.steps(['Do **five** ruler-drop trials', 'Work out your **mean reaction time**', 'Trigger the **reflex arc** (hand on a hot pan)', 'Give the body a fright — release **adrenaline**', 'Answer the analysis questions']);
    const sec = ui.section('Ruler drop');
    ui.text('Press **Get ready**, then click **CATCH!** (or press Space) the instant the ruler starts to fall. Distance fallen d → time t = √(2d ÷ g).', sec);
    this.catchBtns = ui.buttons([{ label: '✋ Get ready', kind: 'primary', onClick: () => this.ready() }, { label: '🫳 CATCH!', kind: 'gold', onClick: () => this.catch() }], sec);
    this.ro2 = ui.readouts([{ id: 'd', label: 'Distance fallen', unit: 'cm' }, { id: 't', label: 'Reaction time', unit: 's' }, { id: 'm', label: 'Mean', unit: 's' }], sec);
    this.tbl2 = ui.table(['Trial', 'Distance /cm', 'Time /s'], sec);
    const rsec = ui.section('Reflex & hormones');
    ui.buttons([{ label: '🔥 Hand on hot pan (reflex)', onClick: () => this.reflex() }, { label: '😱 Sudden fright (adrenaline)', onClick: () => this.adrenaline() }], rsec);
    this.ro3 = ui.readouts([{ id: 'hr', label: 'Heart rate', unit: 'bpm' }, { id: 'br', label: 'Breathing', unit: '/min' }, { id: 'pu', label: 'Pupil', unit: 'mm' }], rsec);
    this.ro3.set('hr', 70); this.ro3.set('br', 14); this.ro3.set('pu', 3);
    ui.notes();
    ui.questions([
      { q: 'A ruler fell **0.18 m** before it was caught. What was the reaction time? (g = 9.8 m/s²)', ans: Math.sqrt((2 * 0.18) / 9.8), tol: 0.03, unit: 's', e: 't = √(2d ÷ g) = √(0.36 ÷ 9.8) ≈ 0.19 s.', o: [6], sub: 'B13.1' },
      { q: 'Why take the **mean** of several trials?', opts: ['To reduce the effect of random variation between trials', 'To make the reaction time shorter', 'Because the first trial is always wrong', 'To practise catching'], e: 'Averages are more reliable than single measurements.', o: [6], sub: 'B13.1' },
      { q: 'In a reflex arc, the relay neurone is found in the…', opts: ['spinal cord (central nervous system)', 'muscle', 'skin receptor', 'blood'], e: 'Receptor → sensory → relay (CNS) → motor → effector.', o: [4, 5], sub: 'B13.1' },
      { q: 'Which change is caused by **adrenaline**?', opts: ['Faster heart and breathing rate, wider pupils', 'Lower blood glucose', 'Slower heart rate', 'Smaller pupils'], e: 'Adrenaline prepares the body for fight or flight.', o: [3], sub: 'B13.2' },
    ], { sub: 'B13.1', onDone: () => { this.st.done(4); if ([0, 1, 2, 3, 4].every((i) => this.st.isDone(i))) this.lab.goal('reaction'); } });
    this._key = (e) => { if (e.code === 'Space' && this.tab === 'reaction') { e.preventDefault(); this.catch(); } };
    window.addEventListener('keydown', this._key);
    this.onTabDispose(() => window.removeEventListener('keydown', this._key));
    this.every((dt) => this.simReaction(dt));
  }
  ready() {
    if (this.state === 'waiting' || this.state === 'falling') return;
    this.rulerG.position.y = 0.42; this.state = 'waiting'; this.ui.hint('Watch the ruler…');
    this.dropAt = performance.now() + 1200 + Math.random() * 2500;
  }
  catch() {
    if (this.state === 'waiting') { this.ui.hint('Too early! Wait for the ruler to fall.', 2000); audio.fail(); this.state = 'idle'; return; }
    if (this.state !== 'falling') return;
    const t = Math.max(0.08, (performance.now() - this.fallStart) / 1000);
    this.finishCatch(t);
  }
  finishCatch(t) {
    const d = Math.min(0.3, 0.5 * 9.8 * t * t);
    this.state = 'idle';
    this.rulerG.position.y = 0.42 - d;
    tweens.to(this.fingerA.position, { z: 0.012 }, 0.08); tweens.to(this.fingerB.position, { z: -0.012 }, 0.08);
    setTimeout(() => { this.fingerA.position.z = 0.035; this.fingerB.position.z = -0.035; }, 900);
    const tt = Math.sqrt((2 * d) / 9.8);
    this.trials.push(tt); audio.clink();
    this.ro2.set('d', (d * 100).toFixed(1)); this.ro2.set('t', tt.toFixed(3));
    this.tbl2.add([this.trials.length, (d * 100).toFixed(1), tt.toFixed(3)]);
    const mean = this.trials.reduce((a, b) => a + b, 0) / this.trials.length;
    this.ro2.set('m', mean.toFixed(3));
    if (d >= 0.3) this.ui.note('Missed — the ruler fell all the way!', 'warn');
    if (this.trials.length >= 5) { this.st.done(0); this.st.done(1); this.ui.note(`Mean reaction time **${mean.toFixed(3)} s** from ${this.trials.length} trials.`, 'gold'); }
    this.ui.hint('');
  }
  async reflex() {
    audio.zap();
    this.arcNodes.forEach((n) => n.material.emissive.set('#000000'));
    for (const n of this.arcNodes) { n.material.emissive.set('#facc15'); n.material.emissiveIntensity = 2; audio.blip(); await tweens.tween(0.28, () => {}).promise; }
    this.ui.note('Reflex: **receptor → sensory neurone → relay neurone (spinal cord) → motor neurone → effector**. Automatic and fast — the brain is told afterwards.', 'gold');
    this.st.done(2);
  }
  adrenaline() {
    audio.heartbeat(); audio.heartbeat();
    tweens.tween(1.2, (e) => { this.ro3.set('hr', Math.round(70 + 55 * e)); this.ro3.set('br', Math.round(14 + 12 * e)); this.ro3.set('pu', (3 + 3.5 * e).toFixed(1)); });
    this.ui.note('Adrenaline from the **adrenal glands**: faster heart rate and breathing, wider pupils — ready for fight or flight.', 'gold');
    this.st.done(3);
  }
  simReaction(dt) {
    if (this.state === 'waiting' && performance.now() >= this.dropAt) { this.state = 'falling'; this.fallStart = performance.now(); }
    if (this.state === 'falling') {
      const t = (performance.now() - this.fallStart) / 1000;
      const d = 0.5 * 9.8 * t * t;
      this.rulerG.position.y = 0.42 - Math.min(0.3, d);
      if (d >= 0.3) this.finishCatch(Math.sqrt(0.6 / 9.8));
    }
    void dt;
  }
}
