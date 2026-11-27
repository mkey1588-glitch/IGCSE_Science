import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { conicalFlask, beaker, dropperBottle, stand, mesh, mat, M, glassMaterial } from '../apparatus.js';
import { h, clamp, canvasTex, tweens, ease } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const ACID = 0.1;            // mol/dm³ HCl in the burette
const FLOW = { closed: 0, drop: 0.1, fast: 1.5 }; // cm³ per second
const IND = {
  mo: { name: 'Methyl orange', bottle: '#f97316' },
  thy: { name: 'Thymolphthalein', bottle: '#93c5fd' },
  ui: { name: 'Universal indicator', bottle: '#22c55e' },
};
const UI_SCALE = [[0, '#dc2626'], [2, '#f97316'], [4, '#facc15'], [6, '#a3e635'], [7, '#22c55e'], [8, '#14b8a6'], [10, '#2563eb'], [12, '#4f46e5'], [14, '#7e22ce']];
const lerpHex = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), clamp(k, 0, 1)).getHexString();
const r05 = (v) => Math.round(v * 20) / 20;
const TOP = 0.7, BOT = 0.24, TAP = 0.2; // burette geometry (local y)
export const ENDPOINT_TOL = 0.1; // cm³ (two drops): a titre recorded further past the colour change has overshot
export const CONCORDANT = 0.1; // cm³: titres in a qualifying set must all lie within this range

/**
 * The largest set of titres that all agree within `tol` (largest minus smallest ≤ tol), as indices
 * into `titres`, or [] when no two agree. Ties go to the tighter set. This judges agreement only;
 * end-point validity is checked separately, before titres get here.
 */
export function concordantSubset(titres, tol = CONCORDANT) {
  const sorted = titres.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  let best = null;
  for (let a = 0; a < sorted.length; a++) {
    let b = a;
    while (b + 1 < sorted.length && sorted[b + 1].v - sorted[a].v <= tol + 1e-9) b++;
    const size = b - a + 1, range = sorted[b].v - sorted[a].v;
    if (size >= 2 && (!best || size > best.size || (size === best.size && range < best.range - 1e-9))) best = { size, range, members: sorted.slice(a, b + 1) };
  }
  return best ? best.members.map((m) => m.i).sort((x, y) => x - y) : [];
}

export default class Titration extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Omar sells two antacid tablets and customers ask which is stronger. Dissolve each tablet, then find exactly how much stomach-strength acid it neutralises.';
    this.view = { pos: [-0.07, 1.52, 1.5], target: [-0.07, 1.25, 0] };
    const cA = 0.068 + Math.random() * 0.012;
    this.C = { A: +cA.toFixed(4), B: +(cA * 1.4).toFixed(4) };
    this.sample = 'A'; this.reading = 50; this.filled = false; this.tap = 'closed';
    this.flaskState = 'empty'; this.ind = null; this.added = 0; this.startReading = 0; this.endV = null;
    this.records = []; this.mean = { A: null, B: null }; this.rows = []; this.drops = []; this.flash = 0; this.lastPt = -1;
  }

  // ------------------------------------------------------------------ chemistry
  pH() {
    if (this.flaskState === 'empty') return 7;
    const nOH = this.C[this.flaskSample] * 0.025, nH = ACID * this.added / 1000, Vt = (25 + this.added) / 1000;
    const x = (nH - nOH) / Vt, Kw = 1e-14;
    return -Math.log10((x + Math.sqrt(x * x + 4 * Kw)) / 2);
  }
  colour(pH) {
    const i = this.ind;
    if (!i || this.flaskState === 'empty') return ['#f8fafc', 0.35];
    if (i === 'mo') return [pH >= 4.4 ? '#facc15' : pH <= 3.1 ? '#dc2626' : pH > 3.75 ? lerpHex('#f97316', '#facc15', (pH - 3.75) / 0.65) : lerpHex('#dc2626', '#f97316', (pH - 3.1) / 0.65), 0.82];
    if (i === 'thy') { const k = clamp((pH - 9.3) / 1.2, 0, 1); return [lerpHex('#f8fafc', '#1d4ed8', k), 0.35 + 0.47 * k]; }
    for (let k = 0; k < UI_SCALE.length - 1; k++) { const [p0, c0] = UI_SCALE[k], [p1, c1] = UI_SCALE[k + 1]; if (pH <= p1) return [lerpHex(c0, c1, (pH - p0) / (p1 - p0)), 0.82]; }
    return ['#7e22ce', 0.82];
  }
  atEnd(pH) { return this.ind === 'mo' ? pH < 4.2 : this.ind === 'thy' ? pH < 9.4 : false; }

  build() {
    const Y = this.Y;
    // stand + burette
    const st = stand(0.8); this.lab.add(st, 0.05, Y, -0.07);
    this.lab.add(mesh(new THREE.BoxGeometry(0.012, 0.012, 0.075), M.steel), 0, Y + 0.6, -0.035);
    const bur = (this.bur = new THREE.Group()); this.lab.add(bur, 0, Y, 0);
    bur.add(mesh(new THREE.CylinderGeometry(0.0085, 0.0085, TOP - TAP + 0.04, 16, 1, true), glassMaterial('#e6f4ff', 0.08, 0.7), 0, (TOP + TAP + 0.04) / 2, 0));
    this.col = new THREE.Mesh(new THREE.CylinderGeometry(0.0072, 0.0072, 1, 14), new THREE.MeshStandardMaterial({ color: '#dbeafe', transparent: true, opacity: 0.55, roughness: 0.2, depthWrite: false }));
    this.col.geometry.translate(0, 0.5, 0); this.col.position.y = TAP; this.col.renderOrder = 4; bur.add(this.col);
    const tip = mesh(new THREE.ConeGeometry(0.0045, 0.03, 10, 1, true), glassMaterial(), 0, TAP - 0.015, 0); tip.rotation.x = Math.PI; bur.add(tip);
    bur.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.016, 10), mat('#334155', 0.3, 0.5), 0, TAP, 0));
    this.tapH = mesh(new THREE.BoxGeometry(0.05, 0.007, 0.007), mat('#1d4ed8', 0.2, 0.4), 0, TAP, 0.008); bur.add(this.tapH);
    const funnel = mesh(new THREE.CylinderGeometry(0.03, 0.006, 0.04, 16, 1, true), glassMaterial(), 0, TOP + 0.08, 0); bur.add(funnel); this.funnel = funnel;
    const { tex } = canvasTex(64, 1024, (ctx, w, hh) => {
      ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.font = '700 22px Inter';
      for (let i = 0; i <= 500; i++) { const y = 12 + (i / 500) * (hh - 24); const big = i % 10 === 0; ctx.fillRect(0, y - 1, big ? 26 : i % 5 === 0 ? 16 : 9, big ? 3 : 1.5); if (i % 50 === 0) ctx.fillText(String(i / 10), 28, y + 8); }
    });
    const scale = new THREE.Mesh(new THREE.PlaneGeometry(0.012, (TOP - BOT) * (1 + 24 / 1000)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    scale.position.set(0.0035, (TOP + BOT) / 2, 0.0095); bur.add(scale);
    this.lab.label(bur, 'Burette: 0.100 mol/dm³ hydrochloric acid', { y: TOP + 0.13 });
    this.lab.interactive(this.tapH, { tip: 'Burette tap — click to cycle closed → dropwise → fast', onClick: () => this.cycleTap() });
    // white tile and flask
    this.lab.add(mesh(new THREE.BoxGeometry(0.17, 0.006, 0.17), M.ceramic), 0, Y + 0.003, 0);
    this.lab.label(this.bur, 'White tile', { y: 0.012, x: 0.115, z: 0.06, cls: 'dimlab' });
    this.prep = new THREE.Vector3(-0.17, Y, 0.15); this.under = new THREE.Vector3(0, Y + 0.006, 0);
    this.flask = conicalFlask({ rb: 0.06, rn: 0.016, h: 0.15, level: 0, color: '#f8fafc', opacity: 0.35 });
    this.lab.add(this.flask, this.prep.x, this.prep.y, this.prep.z);
    this.flaskLabel = this.lab.label(this.flask, 'Conical flask', { y: 0.19, cls: 'dimlab' });
    this.lab.interactive(this.flask, { tip: 'Conical flask — click to swirl', onClick: () => this.swirl() });
    this.flashM = new THREE.MeshBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0, depthWrite: false });
    this.flashDisc = new THREE.Mesh(new THREE.CircleGeometry(0.026, 24), this.flashM); this.flashDisc.rotation.x = -Math.PI / 2; this.flashDisc.renderOrder = 6; this.flask.add(this.flashDisc);
    this.stream = mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 1, 6), new THREE.MeshStandardMaterial({ color: '#bfdbfe', transparent: true, opacity: 0.7 })); this.stream.geometry.translate(0, -0.5, 0); this.stream.visible = false; this.lab.add(this.stream, 0, Y + TAP - 0.03, 0);
    this.dropGeo = new THREE.SphereGeometry(0.0026, 8, 6); this.dropMat = new THREE.MeshStandardMaterial({ color: '#bfdbfe', transparent: true, opacity: 0.85 });
    // antacid solution, pipette, indicators
    this.stock = beaker({ r: 0.04, h: 0.09, color: '#f1f5f9', level: 0.75, opacity: 0.55 }); this.lab.add(this.stock, -0.36, Y, 0.06);
    this.stockLabel = this.lab.label(this.stock, 'Antacid A solution', { y: 0.13 });
    this.pip = new THREE.Group(); this.lab.add(this.pip, -0.36, Y + 0.02, 0.06);
    this.pip.add(mesh(new THREE.CylinderGeometry(0.0028, 0.002, 0.11, 10), M.glass, 0, 0.055, 0), mesh(new THREE.SphereGeometry(0.011, 16, 12), M.glass, 0, 0.13, 0), mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.15, 10), M.glass, 0, 0.215, 0));
    this.pip.children[1].scale.set(1, 1.9, 1);
    this.pipLiq = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.036, 12), new THREE.MeshStandardMaterial({ color: '#e2e8f0', transparent: true, opacity: 0.6 }), 0, 0.13, 0); this.pipLiq.visible = false; this.pip.add(this.pipLiq);
    this.pip.add(mesh(new THREE.TorusGeometry(0.0034, 0.0008, 4, 12), mat('#f8fafc'), 0, 0.27, 0).rotateX(Math.PI / 2));
    this.lab.label(this.pip, 'Volumetric pipette (25.0 cm³)', { y: 0.33, cls: 'dimlab' });
    this.lab.interactive(this.pip, { tip: 'Volumetric pipette — click to transfer exactly 25.0 cm³', onClick: () => this.pipette() });
    Object.entries(IND).forEach(([k, d], i) => { const b = dropperBottle(d.name, d.bottle); this.lab.add(b, 0.2 + i * 0.075, Y, 0.12); this.lab.interactive(b, { tip: `${d.name} — click to add 3 drops to the flask`, onClick: () => this.addIndicator(k) }); });

    // ---------------------------------------------------------------- panel
    const ui = this.ui;
    this.st = ui.steps([
      'Rinse and fill the burette with **0.100 mol/dm³ hydrochloric acid**',
      'Use the **volumetric pipette** to put 25.0 cm³ of antacid solution in the flask',
      'Add a few drops of a suitable **indicator**',
      'Do a **rough titration** quickly and record it',
      'Titrate **dropwise** near the end-point until two titres are **concordant** (within 0.10 cm³)',
      'Repeat for **Tablet B** and compare the two tablets',
      'Answer the analysis questions',
    ]);
    const sec = ui.section('Titration');
    this.sampleSeg = ui.seg({ label: 'Antacid solution', options: [['A', 'Tablet A'], ['B', 'Tablet B']], value: 'A', parent: sec, onChange: (v) => this.setSample(v) });
    ui.buttons([{ label: '⛽ Fill burette', onClick: () => this.fill() }, { label: '💧 Pipette 25.0 cm³', onClick: () => this.pipette() }, { label: '↺ New flask', onClick: () => this.newFlask() }], sec);
    this.tapSeg = ui.seg({ label: 'Burette tap', options: [['closed', '⛔ Closed'], ['drop', '💧 Dropwise'], ['fast', '🚿 Fast']], value: 'closed', parent: sec, onChange: (v) => this.setTap(v) });
    ui.buttons([{ label: '+1 drop (0.05 cm³)', kind: 'primary', onClick: () => this.oneDrop() }, { label: '🌀 Swirl', onClick: () => this.swirl() }, { label: '📝 Record titre', kind: 'primary', onClick: () => this.record() }], sec);
    this.ro = ui.readouts([{ id: 'r', label: 'Burette reading', unit: 'cm³' }, { id: 'v', label: 'Acid added', unit: 'cm³' }, { id: 'p', label: 'pH in flask' }], sec);
    const rs = ui.section('Burette reading (magnified)');
    this.rc = h('canvas', { width: 600, height: 230, class: 'graph', style: { height: '125px' } }); rs.append(this.rc);
    this.graph = ui.graph({ x: { label: 'Volume of acid added / cm³', min: 0, max: 30 }, y: { label: 'pH', min: 0, max: 14 }, series: [{ name: 'pH', color: '#f472b6', line: true, points: false }], auto: true, height: 170 }, ui.section('pH curve'));
    const ts = ui.section('Results');
    this.table = ui.table(['#', 'Tablet', 'Initial', 'Final', 'Titre / cm³', 'Use'], ts);
    this.ro2 = ui.readouts([{ id: 'A', label: 'Mean titre A', unit: 'cm³' }, { id: 'B', label: 'Mean titre B', unit: 'cm³' }], ts);
    ui.notes();
    ui.questions([
      { q: 'Why is a **volumetric pipette** used to measure the 25.0 cm³ of antacid solution?', opts: ['It delivers one fixed volume very accurately', 'It is quicker than a measuring cylinder', 'It measures any volume from 0 to 50 cm³', 'It stops the solution reacting'], e: 'Burettes and volumetric pipettes are the precise volume apparatus.', sub: 'C12.2', o: [1] },
      { q: 'Methyl orange is **yellow** in the antacid solution. At the end-point it turns…', opts: ['orange-red — the solution has just become acidic', 'blue', 'colourless', 'green'], e: 'Methyl orange: yellow in alkali, red in acid.', sub: 'C7.1', o: [2, 5] },
      { q: 'Why is the flask stood on a **white tile**?', opts: ['To see the colour change at the end-point clearly', 'To keep the flask warm', 'To catch drips of acid', 'To weigh the flask'], e: 'A white background makes a faint colour change obvious.', sub: 'C12.2', o: [2] },
      { q: 'Why is the **rough** titration left out of the mean titre?', opts: ['Acid was added quickly, so the end-point was probably overshot', 'It is always too small', 'It used a different acid', 'The indicator was missing'], e: 'Use only accurate, concordant titres (within 0.10 cm³).', sub: 'C12.2', o: [2] },
      { q: 'Why is **universal indicator** not used for titrations?', opts: ['It changes colour gradually across the pH range, so there is no sharp end-point', 'It is too expensive', 'It reacts with the acid', 'It only works in alkalis'], e: 'Titrations need an indicator with one sharp colour change.', sub: 'C7.1', o: [6] },
      { q: 'On your pH curve, where does the pH change **fastest**?', opts: ['At the end-point, where one drop can change the pH by several units', 'At the very start', 'After all the acid has been added', 'It changes at a steady rate throughout'], e: 'Near neutralisation, tiny amounts of excess acid change [H⁺] enormously.', sub: 'C7.1', o: [6] },
      { q: 'The ionic equation for neutralisation is…', opts: ['H⁺ + OH⁻ → H₂O', 'Na⁺ + Cl⁻ → NaCl', 'H₂ + O₂ → H₂O', 'H⁺ + Cl⁻ → HCl'], e: 'The other ions are spectators.', sub: 'C7.1', o: [7] },
      { q: '(S) Use your **mean titre for Tablet A**: concentration of the alkali = 0.100 × mean titre ÷ 25.0. Calculate it.', ans: () => (this.mean.A ? (ACID * this.mean.A) / 25 : null), tol: 0.02, unit: 'mol/dm³', e: 'c = 0.100 × titre ÷ 25.0 = {ans} mol/dm³ (1 : 1 reaction).', sub: 'C3.3', o: [5] },
      { q: 'How many **percent more** acid does Tablet B neutralise than Tablet A? (100 × (B − A) ÷ A)', ans: () => (this.mean.A && this.mean.B ? ((this.mean.B - this.mean.A) / this.mean.A) * 100 : null), tol: 0.12, abs: 1, unit: '%', e: 'Using your mean titres: {ans} % more.', sub: 'C12.2', o: [1] },
      { q: 'The tablet was dissolved in water. In this solution, the water is the…', opts: ['solvent', 'solute', 'residue', 'filtrate'], e: 'The solvent dissolves the solute to make a solution.', sub: 'C12.1', o: [2] },
    ], { sub: 'C12.2', onDone: () => { this.st.done(6); this.check(); } });

    this.updateBurette(); this.drawReading();
    this.every((dt, t) => this.sim(dt, t));
    this.ui.hint('Start by filling the burette — then pipette the antacid solution into the flask.', 6000);
  }

  // ------------------------------------------------------------------ actions
  setSample(v) {
    if (this.flaskState !== 'empty' && this.flaskSample !== v) this.ui.note('The flask still holds the other tablet’s solution — press **↺ New flask** before pipetting this one.', 'warn');
    this.sample = v; this.stockLabel.userData.set(`Antacid ${v} solution`);
  }
  fill() {
    if (this.added > 0 && this.flaskState !== 'done') { this.ui.hint('Finish (or discard) this titration before refilling — otherwise the titre is lost.', 3500); return; }
    if (this.tap !== 'closed') this.setTap('closed');
    audio.pour();
    this.reading = r05(Math.random() * 1.2); this.filled = true; this.funnel.visible = false;
    this.updateBurette(); this.drawReading();
    if (!this.st.isDone(0)) { this.st.done(0); this.ui.note('Burette rinsed with the acid, filled, funnel removed and the jet filled. Always read the **bottom of the meniscus** at eye level.', 'gold'); }
    if (this.added === 0 || this.flaskState === 'done' || this.flaskState === 'empty') this.startReading = this.reading;
  }
  async pipette() {
    if (this.busy) return;
    if (this.flaskState !== 'empty') { this.ui.hint('The flask already has solution in it — use **↺ New flask** for a fresh one.', 3000); return; }
    this.busy = true; audio.pour();
    const p = this.pip, home = p.position.clone();
    this.pipLiq.visible = true;
    const fp = this.flask.position;
    await tweens.to(p.position, { x: fp.x, y: this.Y + 0.09, z: fp.z }, 0.9, { ease: ease.inOut }).promise;
    await tweens.tween(1.0, (e) => { this.flask.setLevel(0.2 * e); this.pipLiq.scale.y = 1 - e; }).promise;
    this.pipLiq.visible = false; this.pipLiq.scale.y = 1;
    await tweens.to(p.position, { x: home.x, y: home.y, z: home.z }, 0.8, { ease: ease.inOut }).promise;
    this.flaskState = 'alkali'; this.flaskSample = this.sample; this.ind = null; this.added = 0; this.endV = null; this.lastPt = -1;
    this.flaskLabel.userData.set(`25.0 cm³ antacid ${this.sample}`);
    this.graph.clear(); this.busy = false;
    this.st.done(1); audio.clink();
    this.refreshFlask();
  }
  addIndicator(k) {
    if (this.flaskState === 'empty') { this.ui.hint('Pipette the antacid solution into the flask first.', 2500); return; }
    if (this.ind && this.ind !== k) { this.ui.note('Mixing two indicators gives confusing colours — start a **new flask**.', 'warn'); return; }
    if (this.ind === k) return;
    this.ind = k; audio.blip();
    if (k === 'ui') this.ui.note('Universal indicator shows the pH, but it changes **gradually** through many colours — there is no sharp end-point. Choose methyl orange or thymolphthalein for a titration.', 'warn');
    else { this.st.done(2); this.ui.note(`${IND[k].name} added: ${k === 'mo' ? '**yellow** in alkali → **orange-red** when the solution just turns acidic' : '**blue** in alkali → **colourless** at the end-point'}.`); }
    this.refreshFlask();
  }
  newFlask() {
    if (this.busy) return;
    this.setTap('closed');
    this.flaskState = 'empty'; this.ind = null; this.added = 0; this.endV = null; this.lastPt = -1;
    this.flask.setLevel(0); this.flask.position.copy(this.prep); this.flask.rotation.set(0, 0, 0); this._swirl = 0; this.flaskLabel.userData.set('Conical flask'); this.graph.clear();
    this.startReading = this.reading; audio.clink(); this.refreshFlask();
  }
  setTap(v) {
    if (v !== 'closed') {
      if (!this.filled) { this.ui.hint('Fill the burette first.', 2500); this.tapSeg.set('closed'); return; }
      if (this.flaskState === 'empty' || this.flaskState === 'done') { this.ui.hint(this.flaskState === 'done' ? 'This titration is recorded — press **↺ New flask**.' : 'Pipette antacid solution into a flask first.', 2800); this.tapSeg.set('closed'); return; }
      this.moveUnder();
      if (!this.ind && !this._noIndWarn) { this._noIndWarn = true; this.ui.note('No indicator in the flask — how will you see the end-point?', 'warn'); }
    }
    this.tap = v; this.tapSeg.set(v);
    this.tapH.rotation.z = v === 'closed' ? 0 : v === 'drop' ? Math.PI / 4 : Math.PI / 2;
    audio.click();
  }
  cycleTap() { this.setTap(this.tap === 'closed' ? 'drop' : this.tap === 'drop' ? 'fast' : 'closed'); }
  moveUnder() {
    if (this.flask.position.distanceTo(this.under) < 0.001) return;
    if (this.added === 0) this.startReading = this.reading;
    this.flask.position.copy(this.under);
  }
  oneDrop() {
    if (this.tap !== 'closed') { this.setTap('closed'); }
    if (!this.filled || this.flaskState === 'empty' || this.flaskState === 'done') { this.setTap('drop'); return; }
    this.moveUnder();
    this.addAcid(0.05); this.spawnDrop();
  }
  swirl() { if (this.flaskState === 'empty') return; this._swirl = 1; this.flash *= 0.3; audio.splash?.(0.2); }
  addAcid(v) {
    if (this.reading + v > 50) { v = Math.max(0, 50 - this.reading); this.setTap('closed'); this.ui.note('The burette is empty — refill it (after recording).', 'warn'); }
    this.added += v; this.reading += v;
  }
  spawnDrop() {
    const d = new THREE.Mesh(this.dropGeo, this.dropMat); d.position.set(0, this.Y + TAP - 0.035, 0); d.userData.v = 0; this.lab.add(d, 0, this.Y + TAP - 0.035, 0); this.drops.push(d);
  }
  record() {
    if (this.flaskState === 'empty') { this.ui.hint('There is no titration to record yet.', 2500); return; }
    if (this.flaskState === 'done') { this.ui.hint('Already recorded — start a **new flask**.', 2500); return; }
    if (this.ind === 'ui' || !this.ind) { this.ui.note(this.ind ? 'Universal indicator gives no sharp end-point — this result cannot be trusted. Use a new flask with methyl orange or thymolphthalein.' : 'Without an indicator there is no end-point to record.', 'warn'); return; }
    if (this.endV == null) { this.ui.hint('The indicator has not changed colour yet — keep adding acid.', 2800); return; }
    this.setTap('closed');
    const initial = r05(this.startReading), final = r05(this.reading), titre = +(final - initial).toFixed(2);
    const s = this.flaskSample;
    const rough = !this.records.some((r) => r.sample === s);
    // end-point validity: how far past the colour change this titre was recorded
    const over = Math.max(0, this.added - this.endV);
    const valid = over <= ENDPOINT_TOL + 1e-9;
    const rec = { sample: s, ind: this.ind, initial, final, titre, rough, over, valid };
    this.records.push(rec);
    rec.tr = this.table.add([this.records.length, s, initial.toFixed(2), final.toFixed(2), `<b>${titre.toFixed(2)}</b>`, rough ? '<span class="faint">rough</span>' : '—']);
    this.flaskState = 'done'; audio.success();
    if (rough) { this.st.done(3); this.ui.note(`Rough titre ${titre.toFixed(2)} cm³. Now repeat: run fast to about **${Math.max(0, titre - 1.5).toFixed(1)} cm³**, then add acid **one drop at a time**, swirling.`, 'gold'); }
    else if (!valid) this.ui.note(`You went **${over.toFixed(2)} cm³** past the end-point, so this titre is too large. It stays in the table but is left out of the mean. Add acid one drop at a time near the end-point.`, 'warn');
    this.checkConcordant(s);
  }
  /** Agreement between readings: the largest set of valid titres (same tablet, same indicator) within 0.10 cm³. */
  checkConcordant(s) {
    const acc = this.records.filter((r) => r.sample === s && !r.rough);
    const valid = acc.filter((r) => r.valid);
    let group = [];
    for (const ind of new Set(valid.map((r) => r.ind))) {
      const same = valid.filter((r) => r.ind === ind);
      const members = concordantSubset(same.map((r) => r.titre)).map((i) => same[i]);
      if (members.length > group.length) group = members;
    }
    for (const r of acc) r.tr.lastChild.innerHTML = !r.valid ? `<span class="warn-text">overshot by ${r.over.toFixed(2)} cm³ — not used</span>` : group.includes(r) ? '✓ concordant' : '<span class="faint">✗ not concordant</span>';
    if (group.length < 2) {
      this.mean[s] = null; this.ro2.set(s, '—');
      if (valid.length >= 2) this.ui.note('Not concordant yet — accurate titres must all agree within **0.10 cm³**. Do another.', 'warn');
      return;
    }
    const mean = group.reduce((t, r) => t + r.titre, 0) / group.length;
    const first = this.mean[s] == null;
    this.mean[s] = +mean.toFixed(2);
    this.ro2.set(s, this.mean[s].toFixed(2));
    if (first) {
      this.ui.note(`Concordant! Mean titre for Tablet ${s} = **${this.mean[s].toFixed(2)} cm³**.`, 'gold');
      if (s === 'A') this.st.done(4);
      if (s === 'B') this.st.done(5);
      if (this.mean.A && this.mean.B) this.ui.note(`Tablet B needed **${(((this.mean.B - this.mean.A) / this.mean.A) * 100).toFixed(0)} %** more acid to neutralise — it is the stronger antacid.`, 'gold');
      if (s === 'A' && !this.mean.B) this.ui.hint('Now switch to **Tablet B**: new flask, pipette, indicator, titrate.', 5000);
    }
    this.check();
  }
  check() { this.st.check(); }

  // ------------------------------------------------------------------ visuals
  updateBurette() {
    const level = TOP - (this.reading / 50) * (TOP - BOT);
    this.col.scale.y = Math.max(0.001, level - TAP); this.col.visible = this.reading < 50 || this.filled;
    this.ro?.set('r', r05(this.reading).toFixed(2));
  }
  refreshFlask() {
    const pH = this.pH(); const [c, o] = this.colour(pH);
    this.flask.setColor(c); this.flask.setOpacity(o);
    if (this.flaskState !== 'empty') this.flask.setLevel(0.2 + (this.added / 50) * 0.25);
    this.ro.set('v', this.flaskState === 'empty' ? '—' : this.added.toFixed(2)); this.ro.set('p', this.flaskState === 'empty' ? '—' : pH.toFixed(2));
    // end-point detection
    if (this.flaskState === 'alkali' && this.ind && this.endV == null && this.atEnd(pH)) {
      this.endV = this.added; audio.discover();
      this.ui.note(`🎯 **End-point!** The ${IND[this.ind].name.toLowerCase()} has changed colour permanently. Close the tap and **record** the reading.`, 'gold');
      this.ui.hint('End-point reached — close the tap and press 📝 Record titre.', 3500);
    }
    // pH curve sampling
    const Veq = (this.C[this.flaskSample || 'A'] * 25) / ACID;
    const stepV = Math.abs(this.added - Veq) < 1 ? 0.05 : 0.25;
    if (this.flaskState === 'alkali' && (this.lastPt < 0 || this.added - this.lastPt >= stepV - 1e-9)) { this.lastPt = this.added; this.graph.add(0, +this.added.toFixed(2), +pH.toFixed(2)); }
  }
  drawReading() {
    const c = this.rc; if (!c) return;
    const ctx = c.getContext('2d'), W = c.width, H = c.height, r = this.reading, ppc = 70;
    const y = (v) => H / 2 + (v - r) * ppc;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, W, H);
    const x0 = W / 2 - 110, x1 = W / 2 + 110;
    ctx.fillStyle = 'rgba(148,197,255,0.08)'; ctx.fillRect(x0, 0, x1 - x0, H);
    if (this.filled) { ctx.fillStyle = 'rgba(186,230,253,0.28)'; ctx.fillRect(x0, y(r), x1 - x0, H - y(r)); ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y(r) - 13); ctx.quadraticCurveTo(W / 2, y(r) + 13, x1, y(r) - 13); ctx.stroke(); }
    const lo = Math.floor((r - H / 2 / ppc) * 10), hi = Math.ceil((r + H / 2 / ppc) * 10);
    for (let k = lo; k <= hi; k++) {
      if (k < 0 || k > 500) continue;
      const yy = y(k / 10), major = k % 10 === 0, half = k % 5 === 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = major ? 2.5 : 1.4;
      ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + (major ? 80 : half ? 52 : 30), yy); ctx.stroke();
      if (major) { ctx.fillStyle = '#fff'; ctx.font = '700 24px Inter'; ctx.fillText(String(k / 10), x0 + 90, yy + 8); }
    }
    ctx.setLineDash([7, 5]); ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(14, y(r)); ctx.lineTo(x0 - 6, y(r)); ctx.moveTo(x1 + 6, y(r)); ctx.lineTo(W - 14, y(r)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#fbbf24'; ctx.font = '600 19px Inter'; ctx.fillText('eye level', x1 + 14, y(r) - 10);
    ctx.fillStyle = '#e2e8f0'; ctx.font = '700 22px Inter'; ctx.fillText(this.filled ? `${r05(r).toFixed(2)} cm³` : 'empty', 18, 34);
  }

  sim(dt) {
    this.flask.update(dt);
    const rate = FLOW[this.tap];
    if (rate > 0 && this.flaskState === 'alkali') {
      this.addAcid(rate * dt);
      if (this.tap === 'drop') { this._dt = (this._dt || 0) + dt; if (this._dt > 0.05 / rate) { this._dt = 0; this.spawnDrop(); } }
    }
    this.stream.visible = this.tap === 'fast' && this.flaskState === 'alkali';
    if (this.stream.visible) { const top = this.Y + TAP - 0.03, bot = this.flask.position.y + this.flask.surfaceY(); this.stream.scale.y = Math.max(0.01, top - bot); }
    // drops falling
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.userData.v += 9.8 * dt * 0.35; d.position.y -= d.userData.v * dt;
      if (d.position.y < this.flask.position.y + this.flask.surfaceY()) {
        d.parent?.remove(d); this.drops.splice(i, 1);
        const Veq = (this.C[this.flaskSample || 'A'] * 25) / ACID;
        if (this.ind && this.ind !== 'ui' && Veq - this.added < 1.3 && Veq - this.added > 0) { this.flashM.color.set(this.ind === 'mo' ? '#ef4444' : '#f8fafc'); this.flash = 0.9; }
      }
    }
    if (rate > 0 || this.drops.length || this._last !== this.added) { this._last = this.added; this.updateBurette(); this.drawReading(); this.refreshFlask(); }
    // swirl & flash
    if (this._swirl > 0) { this._swirl = Math.max(0, this._swirl - dt); const a = this._swirl * 0.06; this.flask.rotation.set(Math.sin(this._swirl * 25) * a, 0, Math.cos(this._swirl * 25) * a); }
    this.flash = Math.max(0, this.flash - dt * (this._swirl > 0 ? 4 : 1.2));
    this.flashM.opacity = this.flash; this.flashDisc.visible = this.flash > 0.01 && this.flaskState !== 'empty';
    this.flashDisc.position.y = this.flask.surfaceY() + 0.001;
    this.tapH.material.emissive?.setRGB(this.tap === 'closed' ? 0 : 0.2, this.tap === 'closed' ? 0 : 0.35, this.tap === 'closed' ? 0 : 0.9);
  }
  dispose() { this.drops.length = 0; super.dispose(); }
}
