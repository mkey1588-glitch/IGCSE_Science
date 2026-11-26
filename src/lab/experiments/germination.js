import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { boilingTube, rack, mesh, mat } from '../apparatus.js';
import { h, clear, tweens } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const DEFAULTS = [
  { water: true, oxygen: true, warm: true, light: true },
  { water: false, oxygen: true, warm: true, light: true },
  { water: true, oxygen: false, warm: true, light: true },
  { water: true, oxygen: true, warm: false, light: true },
  { water: true, oxygen: true, warm: true, light: false },
];

export default class Germination extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Hana wants to sow wildflower seeds for the bees. Which conditions do seeds really need to germinate? Design a fair test.';
    this.view = { pos: [0, 1.5, 1.15], target: [0, 1.0, 0] };
    this.tubes = DEFAULTS.map((d) => ({ ...d, predict: null }));
    this.ran = false;
  }
  build() {
    const Y = this.Y;
    this.rack = rack(5, 0.08); this.lab.add(this.rack, -0.02, Y, 0);
    this.vs = this.tubes.map((c, i) => {
      const v = boilingTube({ color: '#bae6fd', level: 0, opacity: 0.5 }); v.position.copy(this.rack.slots[i]); this.rack.add(v);
      const cotton = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 12), mat('#f8fafc', 0, 1), 0, 0.03, 0); v.add(cotton);
      const oil = mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.006, 14), new THREE.MeshStandardMaterial({ color: '#facc15', transparent: true, opacity: 0.7 }), 0, 0.045, 0); v.add(oil);
      const foil = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.17, 16, 1, true), mat('#cbd5e1', 0.9, 0.25)); foil.position.y = 0.085; v.add(foil);
      const seeds = new THREE.Group(); seeds.position.y = 0.042; v.add(seeds);
      for (let k = 0; k < 4; k++) { const s = new THREE.Group(); s.position.set(Math.cos(k * 1.6) * 0.007, 0, Math.sin(k * 1.6) * 0.007); s.add(mesh(new THREE.SphereGeometry(0.0028, 8, 6), mat('#7c4a2d'))); const stem = mesh(new THREE.CylinderGeometry(0.0008, 0.0008, 1, 4), mat('#d9f99d'), 0, 0.5, 0); stem.scale.y = 0.0001; s.add(stem); const leaves = mesh(new THREE.SphereGeometry(0.004, 8, 6), mat('#4ade80')); leaves.scale.set(1.6, 0.4, 0.8); leaves.visible = false; s.add(leaves); s.userData = { stem, leaves, k }; seeds.add(s); }
      this.lab.label(v, 'ABCDE'[i], { y: 0.2 });
      this.lab.interactive(v, { tip: `Tube ${'ABCDE'[i]} — set its conditions in the panel` });
      return { v, oil, foil, seeds, cotton };
    });
    this.fridge = mesh(new THREE.BoxGeometry(0.12, 0.2, 0.12), new THREE.MeshPhysicalMaterial({ color: '#bfdbfe', transparent: true, opacity: 0.25, side: THREE.DoubleSide })); this.lab.add(this.fridge, 0.3, Y, 0.0); this.fridge.position.y = Y + 0.1;
    this.lab.label(this.fridge, 'Fridge (4 °C)', { y: 0.13, cls: 'dimlab' });
    const ui = this.ui;
    this.st = ui.steps(['Keep **A** as the control (water, oxygen, warmth, light)', 'Set up tubes that each remove **one** condition', 'Predict which tubes will germinate', 'Fast-forward **5 days** and compare', 'Answer the analysis questions']);
    this.grid = h('div'); ui.section('Conditions for each tube').append(this.grid);
    this.drawGrid();
    ui.buttons([{ label: '⏩ Fast-forward 5 days', kind: 'primary', onClick: () => this.grow() }, { label: '⟲ Reset seeds', onClick: () => this.resetSeeds() }]);
    this.tbl = ui.table(['Tube', 'Water', 'O₂', 'Warm', 'Light', 'Predicted', 'Result'], ui.section('Results'));
    ui.notes();
    ui.questions([
      { q: 'Which conditions do seeds need to germinate?', opts: ['Water, oxygen and a suitable temperature', 'Water, light and soil', 'Light, carbon dioxide and warmth', 'Only water'], e: 'Tubes missing water, oxygen or warmth failed; the dark tube still germinated.', o: [6], sub: 'B15.3' },
      { q: 'Why was the water for tube C **boiled** and covered with **oil**?', opts: ['To remove dissolved oxygen and stop more dissolving', 'To kill the seeds', 'To keep the seeds warm', 'To add nutrients'], e: 'Boiling drives out oxygen; the oil layer stops air re-dissolving.', o: [6], sub: 'B15.3' },
      { q: 'The seeds in the dark germinated. What does this show?', opts: ['Light is not needed for germination', 'Seeds photosynthesise in the dark', 'Darkness speeds up all plant growth', 'The foil let light in'], e: 'Seeds use their stored food until leaves can photosynthesise.', o: [6], sub: 'B15.3' },
      { q: 'Why put several seeds in each tube?', opts: ['Some seeds may not be viable — more seeds make the result reliable', 'Seeds need company', 'To use up the cotton wool', 'It makes the test unfair'], e: 'Repeats reduce the effect of individual dead seeds.', o: [6], sub: 'B15.3' },
    ], { sub: 'B15.3', onDone: () => { this.st.done(4); this.check(); } });
    this.applyVisuals();
  }
  drawGrid() {
    clear(this.grid);
    const tbl = h('table', { class: 'dtable' });
    tbl.append(h('thead', null, h('tr', null, h('th', null, 'Tube'), h('th', null, 'Water'), h('th', null, 'Oxygen'), h('th', null, 'Warm'), h('th', null, 'Light'), h('th', null, 'Predict'))));
    const tb = h('tbody');
    this.tubes.forEach((c, i) => {
      const cell = (k) => { const b = h('button', { class: `btn tiny ${c[k] ? 'good' : ''}`, onClick: () => { if (this.ran) return; c[k] = !c[k]; audio.click(); this.applyVisuals(); this.drawGrid(); } }, c[k] ? '✓' : '✗'); return h('td', null, b); };
      const pred = h('button', { class: 'btn tiny', onClick: () => { c.predict = c.predict === 'yes' ? 'no' : 'yes'; audio.click(); this.drawGrid(); if (this.tubes.every((x) => x.predict)) this.st.done(2); } }, c.predict ? (c.predict === 'yes' ? '🌱 yes' : '✗ no') : '?');
      tb.append(h('tr', null, h('td', null, 'ABCDE'[i]), cell('water'), cell('oxygen'), cell('warm'), cell('light'), h('td', null, pred)));
    });
    tbl.append(tb); this.grid.append(tbl);
    const a = this.tubes[0];
    if (a.water && a.oxygen && a.warm && a.light) this.st.done(0);
    const singles = this.tubes.slice(1).filter((c) => ['water', 'oxygen', 'warm', 'light'].filter((k) => !c[k]).length === 1);
    const removed = new Set(singles.map((c) => ['water', 'oxygen', 'warm', 'light'].find((k) => !c[k])));
    if (removed.size >= 3) this.st.done(1);
  }
  applyVisuals() {
    this.tubes.forEach((c, i) => {
      const v = this.vs[i];
      v.cotton.material.color.set(c.water ? '#e0f2fe' : '#f8fafc');
      v.oil.visible = !c.oxygen;
      v.foil.visible = !c.light;
      const inFridge = !c.warm;
      const target = inFridge ? new THREE.Vector3(0.3 - (-0.02) + (i - 2) * 0.0, 0.02, 0) : this.rack.slots[i].clone();
      v.v.position.copy(inFridge ? new THREE.Vector3(0.32 + (i % 2) * 0.03 - this.rack.position.x, 0.03, (i % 2) * 0.03) : target);
    });
  }
  resetSeeds() { this.ran = false; this.vs.forEach((v) => v.seeds.children.forEach((s) => { s.userData.stem.scale.y = 0.0001; s.userData.leaves.visible = false; })); this.drawGrid(); }
  grow() {
    if (this.ran) return;
    if (!this.st.isDone(2)) { this.ui.hint('Make a prediction for every tube first (click the ? buttons).', 3000); audio.fail(); return; }
    this.ran = true; this.tbl.clear();
    tweens.tween(3, (e) => {
      this.tubes.forEach((c, i) => {
        const ok = c.water && c.oxygen && c.warm;
        this.vs[i].seeds.children.forEach((s) => { const len = ok ? (0.05 + s.userData.k * 0.006) * e : 0.0001; s.userData.stem.scale.y = len; s.userData.leaves.position.y = len; s.userData.leaves.visible = ok && e > 0.3; s.rotation.z = Math.sin(s.userData.k) * 0.25; });
      });
    }).promise.then(() => {
      this.tubes.forEach((c, i) => {
        const ok = c.water && c.oxygen && c.warm;
        this.tbl.add(['ABCDE'[i], c.water ? '✓' : '✗', c.oxygen ? '✓' : '✗', c.warm ? '✓' : '✗', c.light ? '✓' : '✗', c.predict, ok ? '🌱 germinated' : '✗ none']);
      });
      const right = this.tubes.filter((c) => (c.predict === 'yes') === (c.water && c.oxygen && c.warm)).length;
      this.ui.note(`After 5 days: seeds germinated only with **water, oxygen and warmth**. Your predictions: ${right}/5 correct.`, 'gold');
      this.st.done(3); this.check();
    });
  }
  check() { if ([0, 1, 2, 3, 4].every((i) => this.st.isDone(i))) this.lab.complete(); }
  update(dt) { this.vs.forEach((v) => v.v.update(dt)); }
}
