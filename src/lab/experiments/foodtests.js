import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { WaterBath } from '../apparatus.js';
import { TubeRack, reagentShelf } from '../tubes.js';
import { h, clear } from '../../core/util.js';
import { audio } from '../../core/audio.js';

// 0 none, 1 trace, 2 some, 3 lots
const FOODS = [
  { id: 'milk', name: 'Milk', color: '#f8fafc', op: 0.92, starch: 0, sugar: 2, protein: 2, fat: 2 },
  { id: 'bread', name: 'Bread', color: '#e7d3a8', op: 0.85, starch: 3, sugar: 1, protein: 1, fat: 0 },
  { id: 'juice', name: 'Apple juice', color: '#f5d06b', op: 0.7, starch: 0, sugar: 3, protein: 0, fat: 0 },
  { id: 'egg', name: 'Egg white', color: '#f4f1de', op: 0.55, starch: 0, sugar: 0, protein: 3, fat: 0 },
  { id: 'oil', name: 'Cooking oil', color: '#facc15', op: 0.75, starch: 0, sugar: 0, protein: 0, fat: 3 },
  { id: 'potato', name: 'Potato', color: '#efe6c8', op: 0.85, starch: 3, sugar: 1, protein: 0, fat: 0 },
  { id: 'glucose', name: 'Sports drink', color: '#fde68a', op: 0.6, starch: 0, sugar: 3, protein: 0, fat: 0 },
  { id: 'chicken', name: 'Chicken (blended)', color: '#f1d4c0', op: 0.85, starch: 0, sugar: 0, protein: 3, fat: 1 },
];
const TESTS = [
  { id: 'iodine', name: 'Iodine solution', color: '#b45309', nutrient: 'starch', label: 'Starch' },
  { id: 'benedicts', name: 'Benedict’s', color: '#2563eb', nutrient: 'sugar', label: 'Reducing sugar', heat: true },
  { id: 'biuret', name: 'Biuret', color: '#3b82f6', nutrient: 'protein', label: 'Protein' },
  { id: 'ethanol', name: 'Ethanol', color: '#e0f2fe', glass: '#cbd5e1', nutrient: 'fat', label: 'Fat / oil' },
];

export default class FoodTests extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Sam needs a balanced lunch for the Fun Run athletes. Test each food for starch, reducing sugar, protein and fat.';
    this.view = { pos: [-0.03, 1.5, 1.15], target: [-0.03, 0.99, 0] };
    this.food = 'milk'; this.results = {}; this.done = new Set(); this.tested = new Set();
  }
  build() {
    this.tr = new TubeRack(this, { n: 6, x: -0.12, label: 'Test tubes' });
    this.bath = new WaterBath(); this.lab.add(this.bath, 0.22, this.Y, 0.02); this.bath.set(80);
    this.lab.label(this.bath, 'Water bath (80 °C)', { y: 0.17 });
    this.lab.interactive(this.bath, { tip: 'Water bath — click to heat the selected tube', onClick: () => this.heat() });
    reagentShelf(this, TESTS, { x: -0.27, z: -0.15, spacing: 0.08 }, (i) => this.addReagent(TESTS[i]));
    const ui = this.ui;
    this.st = ui.steps(['Do an **iodine** test (starch)', 'Do a **Benedict’s** test — don’t forget to heat it', 'Do a **biuret** test (protein)', 'Do an **ethanol emulsion** test (fats)', 'Test at least **four different foods**', 'Answer the analysis questions']);
    const sec = ui.section('Sample');
    ui.select({ label: 'Food to test', options: FOODS.map((f) => [f.id, f.name]), value: this.food, parent: sec, onChange: (v) => { this.food = v; } });
    ui.buttons([{ label: '🥄 Add food to next empty tube', kind: 'primary', onClick: () => this.addFood() }, { label: '🔥 Heat selected', onClick: () => this.heat() }, { label: '🧽 Wash all tubes', onClick: () => { this.tr.clearAll(); this.ui.note('Tubes washed and rinsed.'); } }], sec);
    ui.buttons(TESTS.map((t) => ({ label: `+ ${t.name}`, onClick: () => this.addReagent(t) })), sec);
    ui.text('Click a tube to select it, then click a reagent bottle (or the buttons above).', sec);
    this.matrixSec = ui.section('Results');
    this.matrix = h('table', { class: 'dtable' }); this.matrixSec.append(h('div', { class: 'table-wrap', style: { maxHeight: '220px' } }, this.matrix));
    this.drawMatrix();
    ui.notes();
    ui.questions([
      { q: 'Which food contains **protein** but **no reducing sugar**?', opts: ['Egg white', 'Apple juice', 'Milk', 'Sports drink'], e: 'Egg white turns biuret purple, but Benedict’s stays blue.', o: [3], sub: 'B4.1' },
      { q: 'Why must the Benedict’s test be **heated**?', opts: ['The colour change only happens when the mixture is heated', 'To kill bacteria in the food', 'To melt the fat', 'Heating turns starch into sugar'], e: 'Benedict’s reacts with reducing sugars only at about 80 °C: blue → green → orange → brick red.', o: [3], sub: 'B4.1' },
      { q: 'A positive iodine test for starch is…', opts: ['blue-black', 'brick red', 'purple', 'a milky emulsion'], e: 'Iodine solution turns from orange-brown to blue-black with starch.', o: [3], sub: 'B4.1' },
      { q: 'For slow-release energy on race day, which foods supply the most starch?', opts: ['Bread and potato', 'Cooking oil and egg white', 'Apple juice and sports drink', 'Chicken and milk'], e: 'Starch is a carbohydrate built from glucose — the main energy source in a balanced diet.', o: [2], sub: 'B7.1' },
    ], { sub: 'B4.1', onDone: () => { this.st.done(5); this.check(); } });
    this.ui.hint('Choose a food, add it to a tube, then add a reagent bottle.', 5000);
  }
  addFood() {
    const t = this.tr.firstEmpty();
    if (!t) { this.ui.hint('All tubes are full — wash them first.', 2500); audio.fail(); return; }
    const f = FOODS.find((x) => x.id === this.food);
    t.content = { food: f, test: null, heated: false };
    this.tr.fill(t, f.color, 0.38, f.op);
    this.tr.select(t.i, true);
    audio.pour();
    this.ui.note(`Tube ${t.i + 1}: ${f.name} added.`);
  }
  addReagent(test) {
    const t = this.tr.current;
    if (!t.content) { this.ui.hint('Select a tube that contains a food sample first.', 2500); audio.fail(); return; }
    if (t.content.test) { this.ui.hint('This tube already has a reagent — use a clean tube.', 2500); audio.fail(); return; }
    const f = t.content.food; t.content.test = test;
    audio.bubble();
    const level = f[test.nutrient];
    if (test.id === 'iodine') { this.tr.fill(t, level >= 2 ? '#1e1b4b' : level === 1 ? '#3b2f5c' : '#c2410c', 0.62, 0.92, 1.2); this.record(t, level >= 1 ? 'Blue-black' : 'Orange-brown (no change)', level >= 1); }
    else if (test.id === 'biuret') { this.tr.fill(t, level >= 2 ? '#7e22ce' : level === 1 ? '#a78bfa' : '#3b82f6', 0.62, 0.9, 1.5); this.record(t, level >= 1 ? (level >= 2 ? 'Purple' : 'Pale lilac') : 'Blue (no change)', level >= 1); }
    else if (test.id === 'ethanol') { this.tr.fill(t, level >= 1 ? '#f8fafc' : '#e0f2fe', 0.66, level >= 1 ? 0.97 : 0.55, 1.2); this.record(t, level >= 1 ? 'Milky white emulsion' : 'Clear (no change)', level >= 1); }
    else if (test.id === 'benedicts') { this.tr.fill(t, '#2563eb', 0.62, 0.9, 0.8); this.ui.note(`Tube ${t.i + 1}: Benedict’s added — it stays blue until heated.`); }
  }
  async heat() {
    const t = this.tr.current;
    if (!t.content || !t.content.test) { this.ui.hint('Select a tube with food and Benedict’s solution first.', 2500); return; }
    if (t.content.heated) return;
    const wp = this.bath.localToWorld(new THREE.Vector3(0, 0.04, 0));
    await this.tr.moveTo(t, wp);
    t.bub.setRate(14); audio.fizz(0.6);
    await new Promise((r) => setTimeout(r, 1600));
    t.bub.setRate(0);
    t.content.heated = true;
    if (t.content.test.id === 'benedicts') {
      const lv = t.content.food.sugar;
      const col = ['#2563eb', '#65a30d', '#ea580c', '#991b1b'][lv];
      this.tr.fill(t, col, 0.62, 0.92, 1.6);
      if (lv >= 2) this.tr.precipitate(t, lv === 3 ? '#9a3412' : '#c2410c', lv / 3);
      this.record(t, ['Blue (no change)', 'Green (trace)', 'Orange (some)', 'Brick-red precipitate (lots)'][lv], lv >= 1);
    } else this.ui.note('Heating made no difference to this test.');
    await this.tr.back(t);
  }
  record(t, obs, positive) {
    const f = t.content.food, test = t.content.test;
    (this.results[f.id] = this.results[f.id] || {})[test.id] = { obs, positive };
    this.tested.add(f.id);
    const idx = TESTS.findIndex((x) => x.id === test.id);
    this.st.done(idx);
    if (this.tested.size >= 4) this.st.done(4);
    this.ui.note(`Tube ${t.i + 1} — ${f.name} + ${test.name}: **${obs}** → ${positive ? `${test.label} present` : `no ${test.label.toLowerCase()}`}.`, positive ? 'gold' : '');
    this.drawMatrix(); this.check();
  }
  drawMatrix() {
    clear(this.matrix);
    this.matrix.append(h('thead', null, h('tr', null, h('th', null, 'Food'), ...TESTS.map((t) => h('th', null, t.label)))));
    const tb = h('tbody');
    for (const f of FOODS) {
      const r = this.results[f.id]; if (!r) continue;
      tb.append(h('tr', null, h('td', null, f.name), ...TESTS.map((t) => h('td', { style: { color: r[t.id] ? (r[t.id].positive ? '#4ade80' : '#94a3b8') : '#475569' } }, r[t.id] ? (r[t.id].positive ? '✓' : '✗') : '·'))));
    }
    this.matrix.append(tb);
  }
  check() { this.st.check(); }
  update(dt) { this.tr.update(dt); }
}
