import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { WaterBath, conicalFlask, GasSyringe, testTube, Bubbles, wire, mesh, mat } from '../apparatus.js';
import { tweens, ease } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const yeastRate = (T) => (T >= 56 ? 0 : T <= 35 ? 3.2 * Math.exp(-(((T - 35) / 12) ** 2)) : 3.2 * Math.exp(-(((T - 35) / 8) ** 2)));

export default class Yeast extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Lucia’s bread stayed flat after a cold night. Yeast respires sugar anaerobically, releasing carbon dioxide that makes dough rise. Find its best temperature.';
    this.view = { pos: [0, 1.55, 1.28], target: [0, 1.02, 0] };
    this.T = 35; this.sugar = true; this.live = true; this.running = false; this.temps = new Set();
  }
  build() {
    const Y = this.Y;
    this.bath = new WaterBath(); this.lab.add(this.bath, -0.2, Y, 0); this.bath.set(this.T);
    this.flask = conicalFlask({ rb: 0.045, rn: 0.012, h: 0.11, color: '#e7d7b0', level: 0.45, opacity: 0.9 }); this.flask.position.set(0, 0.1, 0); this.bath.add(this.flask);
    this.lab.label(this.flask, 'Yeast + sugar solution', { y: 0.15 });
    this.bub = new Bubbles({ r: 0.03, y0: 0.008, y1: 0.05, size: 0.0016, rate: 0, color: '#fff7e6' }); this.flask.add(this.bub);
    this.syr = new GasSyringe(100); this.lab.add(this.syr, 0.14, Y + 0.2, -0.02);
    this.lab.label(this.syr, 'Gas syringe (CO₂ collected)', { y: 0.05 });
    this.lab.add(wire([[-0.2, Y + 0.23, 0], [-0.1, Y + 0.3, 0], [-0.03, Y + 0.24, -0.02], [-0.01, Y + 0.2, -0.02]], '#94a3b8', 0.003));
    this.lime = testTube({ color: '#f1f5f9', level: 0.6, opacity: 0.45 }); this.lab.add(this.lime, 0.3, Y, 0.08);
    this.lab.label(this.lime, 'Limewater', { y: 0.17 });
    this.limeBub = new Bubbles({ r: 0.006, y0: 0.01, y1: 0.07, size: 0.0015, rate: 0 }); this.lime.add(this.limeBub);
    // dough bowl
    const bowl = mesh(new THREE.SphereGeometry(0.07, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#e2e8f0', 0.1, 0.5)); bowl.material.side = THREE.DoubleSide; this.lab.add(bowl, 0.06, Y + 0.07, 0.17);
    this.dough = mesh(new THREE.SphereGeometry(0.06, 24, 14), mat('#f5e1b8', 0, 0.85)); this.dough.scale.set(1, 0.4, 1); this.dough.position.set(0.06, Y + 0.035, 0.17); (this.lab.tabRoot || this.root).add(this.dough);
    this.lab.label(this.dough, 'Lucia’s dough', { y: 0.06, cls: 'dimlab' });
    const ui = this.ui;
    this.st = ui.steps(['Run the fermentation at **35 °C** for 10 minutes', 'Repeat at **four or more** temperatures', 'Run a control: **no sugar** or **boiled yeast**', 'Test the gas with **limewater**', 'Answer the analysis questions']);
    const sec = ui.section('Conditions');
    ui.slider({ label: 'Water bath temperature', min: 5, max: 70, step: 5, value: this.T, unit: '°C', parent: sec, onInput: (v) => { this.T = v; this.bath.set(v); } });
    ui.seg({ label: 'Sugar in the flask', options: [[1, 'Sugar'], [0, 'No sugar']], value: 1, parent: sec, onChange: (v) => { this.sugar = !!+v; } });
    ui.seg({ label: 'Yeast', options: [[1, 'Live yeast'], [0, 'Boiled yeast']], value: 1, parent: sec, onChange: (v) => { this.live = !!+v; } });
    ui.buttons([{ label: '▶ Run for 10 minutes', kind: 'primary', onClick: () => this.run() }, { label: '🫧 Bubble gas through limewater', onClick: () => this.limewater() }], sec);
    this.ro = ui.readouts([{ id: 'v', label: 'CO₂ collected', unit: 'cm³' }, { id: 'r', label: 'Rate', unit: 'cm³/min' }], sec);
    const res = ui.section('Results');
    this.tbl = ui.table(['T /°C', 'Sugar', 'Yeast', 'CO₂ /cm³'], res);
    this.graph = ui.graph({ x: { label: 'Temperature / °C', min: 0, max: 72 }, y: { label: 'CO₂ in 10 min / cm³', min: 0, max: 40 }, series: [{ name: 'live yeast + sugar', color: '#fbbf24', points: true, line: true }, { name: 'controls', color: '#94a3b8', points: true }] }, res);
    ui.notes();
    ui.questions([
      { q: 'From your graph, at what temperature does yeast produce CO₂ fastest?', ans: 35, tol: 0.2, unit: '°C', e: 'Yeast enzymes work fastest at about {ans} °C.', o: [2], sub: 'B5.1' },
      { q: 'The limewater turned milky. Which gas did the yeast produce?', opts: ['Carbon dioxide', 'Oxygen', 'Hydrogen', 'Ethanol vapour'], e: 'Limewater turns milky with CO₂ — a product of respiration.', o: [7], sub: 'B12.1' },
      { q: 'Which word equation describes anaerobic respiration in yeast?', opts: ['glucose → ethanol + carbon dioxide', 'glucose → lactic acid', 'glucose + oxygen → carbon dioxide + water', 'carbon dioxide + water → glucose + oxygen'], e: 'This is fermentation: ethanol for brewing, CO₂ for baking.', o: [5, 7], sub: 'B12.1' },
      { q: 'Why was no gas produced at 65 °C?', opts: ['The yeast’s enzymes were denatured', 'The sugar melted', 'Yeast only works in the dark', 'The CO₂ dissolved in the water bath'], e: 'High temperatures permanently change the shape of enzymes’ active sites.', o: [2], sub: 'B5.1' },
      { q: 'Why did the flask with **no sugar** produce almost no CO₂?', opts: ['Glucose is the fuel that yeast respires', 'Sugar is a catalyst', 'Without sugar yeast photosynthesises', 'Sugar provides oxygen'], e: 'Respiration breaks down nutrient molecules such as glucose to release energy.', o: [2], sub: 'B12.1' },
    ], { sub: 'B12.1', onDone: () => { this.st.done(4); this.check(); } });
  }
  run() {
    if (this.running) return;
    this.running = true;
    const r = (this.live ? 1 : 0) * (this.sugar ? 1 : 0.08) * yeastRate(this.T) * (0.93 + Math.random() * 0.14);
    const v = r * 10;
    this.bub.setRate(r * 25);
    this.ui.hint('⏩ Ten minutes pass…');
    const v0 = 0; this.syr.set(0);
    tweens.tween(4.5, (e) => { this.syr.set(v0 + v * e); this.ro.set('v', +(v * e).toFixed(1)); this.dough.scale.set(1 + (v * e) / 120, 0.4 + (v * e) / 70, 1 + (v * e) / 120); }, { ease: ease.inOut }).promise.then(() => {
      this.running = false; this.bub.setRate(0); this.ui.hint('');
      this.ro.set('r', +(v / 10).toFixed(2));
      const control = !this.sugar || !this.live;
      this.tbl.add([this.T, this.sugar ? 'yes' : 'no', this.live ? 'live' : 'boiled', v.toFixed(1)]);
      this.graph.add(control ? 1 : 0, this.T, v);
      this.graph.series[0].data.sort((a, b) => a[0] - b[0]); this.graph.draw();
      this.lastV = v;
      if (!control) { this.temps.add(this.T); if (this.T === 35) this.st.done(0); if (this.temps.size >= 4) this.st.done(1); }
      else { this.st.done(2); this.ui.note(this.live ? 'No sugar → almost no CO₂: yeast needs glucose to respire.' : 'Boiled yeast → no CO₂: its enzymes are denatured.', 'gold'); }
      this.ui.note(`${this.T} °C → **${v.toFixed(1)} cm³** of CO₂ in 10 minutes.${this.T >= 56 ? ' Nothing! Too hot.' : ''}`);
      this.check();
    });
  }
  limewater() {
    if (!this.lastV || this.lastV < 2) { this.ui.hint('Collect some gas first (run a live yeast + sugar test).', 3000); return; }
    this.limeBub.setRate(30); audio.bubble();
    this.lime.setColor('#f8fafc', 3); this.lime.setOpacity(0.95);
    setTimeout(() => { this.limeBub.setRate(0); this.ui.note('The limewater turned **milky** — the gas is **carbon dioxide**.', 'gold'); this.st.done(3); this.check(); }, 2500);
  }
  check() { if ([0, 1, 2, 3, 4].every((i) => this.st.isDone(i))) this.lab.complete(); }
  update(dt) { this.bub.update(dt); this.limeBub.update(dt, this.lime.surfaceY()); this.flask.update(dt); this.lime.update(dt); }
}
