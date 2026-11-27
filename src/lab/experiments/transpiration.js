import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { Lamp, stand, mesh, mat, M, ruler, Stopwatch } from '../apparatus.js';
import { tweens, clamp } from '../../core/util.js';
import { audio } from '../../core/audio.js';

export default class Transpiration extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'A hot, windy day left Ravi’s lettuces limp. A potometer measures how fast a leafy shoot takes up water — and so how fast it loses it.';
    this.view = { pos: [0, 1.55, 1.25], target: [0, 1.02, 0] };
    this.T = 20; this.wind = 0; this.hum = 1; this.light = 1; this.vas = false; this.cut = false;
    this.bubbleX = 0; this.measuring = false; this.runs = []; this.wilt = 0;
  }
  rate() { return 6 * Math.pow(1.06, this.T - 20) * [1, 1.6, 2.3][this.wind] * [1.45, 1, 0.45][this.hum] * (this.light ? 1 : 0.3) * (this.vas ? 0.35 : 1); }
  build() {
    const Y = this.Y;
    const st = stand(0.5); this.lab.add(st, -0.25, Y, -0.04); st.clamp(0.28, 0.12);
    // capillary + scale
    const cap = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 10, 1, true), M.glass); cap.rotation.z = Math.PI / 2; this.lab.add(cap, 0.0, Y + 0.08, 0.02);
    this.water = mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.5, 8), new THREE.MeshStandardMaterial({ color: '#bae6fd', transparent: true, opacity: 0.6 })); this.water.rotation.z = Math.PI / 2; this.lab.add(this.water, 0, Y + 0.08, 0.02);
    const sc = ruler(0.5); this.lab.add(sc, 0, Y + 0.066, 0.045);
    this.bubble = mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.012, 10), new THREE.MeshStandardMaterial({ color: '#f8fafc', metalness: 0.6, roughness: 0.1 })); this.bubble.rotation.z = Math.PI / 2; this.lab.add(this.bubble, 0.22, Y + 0.08, 0.02);
    this.lab.label(this.bubble, 'Air bubble', { y: 0.025, cls: 'dimlab' });
    const riser = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 12, 1, true), M.glass); this.lab.add(riser, -0.25, Y + 0.08, 0.02);
    // reservoir with tap
    const resv = mesh(new THREE.CylinderGeometry(0.025, 0.006, 0.07, 16, 1, true), M.glass); this.lab.add(resv, 0.12, Y + 0.17, 0.02);
    this.lab.label(resv, 'Reservoir (click to reset bubble)', { y: 0.06, cls: 'dimlab' });
    this.lab.interactive(resv, { tip: 'Open the reservoir tap to push the bubble back', onClick: () => this.resetBubble() });
    // shoot
    this.shoot = new THREE.Group(); this.lab.add(this.shoot, -0.25, Y + 0.18, 0.02);
    this.shoot.add(mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.22, 8), mat('#3f6212'), 0, 0.11, 0));
    this.leafM = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.55, side: THREE.DoubleSide });
    this.leafs = [];
    for (let k = 0; k < 8; k++) {
      const pivot = new THREE.Group(); pivot.position.y = 0.06 + k * 0.022; pivot.rotation.y = k * 2.4; this.shoot.add(pivot);
      const lf = mesh(new THREE.SphereGeometry(0.03, 12, 8), this.leafM); lf.scale.set(1.2, 0.08, 0.55); lf.position.x = 0.034; pivot.add(lf);
      pivot.userData.base = 0.25; pivot.rotation.z = 0.25; this.leafs.push(pivot);
    }
    this.lab.label(this.shoot, 'Leafy shoot', { y: 0.27 });
    // fan
    this.fan = new THREE.Group(); this.lab.add(this.fan, 0.02, Y, -0.14);
    this.fan.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.02, 16), M.dark, 0, 0.01, 0), mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 8), M.dark, 0, 0.07, 0));
    this.blades = new THREE.Group(); this.blades.position.set(0, 0.14, 0); this.blades.rotation.y = -1.1; this.fan.add(this.blades);
    for (let i = 0; i < 4; i++) { const b = mesh(new THREE.BoxGeometry(0.06, 0.018, 0.003), mat('#60a5fa')); b.geometry.translate(0.032, 0, 0); b.rotation.z = (i / 4) * Math.PI * 2; this.blades.add(b); }
    this.lab.label(this.fan, 'Fan', { y: 0.2, cls: 'dimlab' });
    this.lamp = new Lamp(); this.lab.add(this.lamp, -0.42, Y, -0.05); this.lamp.rotation.y = -Math.PI / 2; this.lamp.set(1);
    this.bag = mesh(new THREE.SphereGeometry(0.09, 18, 12), new THREE.MeshPhysicalMaterial({ color: '#e0f2fe', transparent: true, opacity: 0.22, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false })); this.bag.scale.set(1, 1.5, 1); this.bag.position.set(0, 0.15, 0); this.bag.visible = false; this.shoot.add(this.bag);
    this.sw = new Stopwatch(); this.lab.add(this.sw, 0.2, Y, 0.16);
    const ui = this.ui;
    this.st = ui.steps(['Measure the rate in **normal** conditions', 'Turn the **fan** on and measure again', 'Raise the **temperature** and measure', 'Cover the shoot with a **plastic bag** (high humidity)', 'Answer the analysis questions']);
    const sec = ui.section('Conditions');
    ui.slider({ label: 'Air temperature', min: 10, max: 35, step: 5, value: this.T, unit: '°C', parent: sec, onInput: (v) => { this.T = v; } });
    ui.seg({ label: 'Wind (fan)', options: [[0, 'Off'], [1, 'Low'], [2, 'High']], value: 0, parent: sec, onChange: (v) => { this.wind = +v; } });
    ui.seg({ label: 'Humidity', options: [[0, 'Dry'], [1, 'Normal'], [2, 'Plastic bag']], value: 1, parent: sec, onChange: (v) => { this.hum = +v; this.bag.visible = this.hum === 2; } });
    ui.seg({ label: 'Light', options: [[1, 'Bright'], [0, 'Dark']], value: 1, parent: sec, onChange: (v) => { this.light = +v; this.lamp.set(this.light ? 1 : 0); } });
    ui.seg({ label: 'Petroleum jelly on lower leaf surfaces', options: [[0, 'No'], [1, 'Yes']], value: 0, parent: sec, onChange: (v) => { this.vas = !!+v; this.leafM.roughness = this.vas ? 0.15 : 0.55; } });
    ui.buttons([{ label: '⏱ Measure for 2 minutes', kind: 'primary', onClick: () => this.measure() }, { label: '⟲ Reset bubble', onClick: () => this.resetBubble() }], sec);
    ui.seg({ label: 'Water supply to the roots (S)', options: [[0, 'Normal'], [1, 'Cut off']], value: 0, parent: sec, onChange: (v) => { this.cut = !!+v; if (this.cut) this.ui.note('Water supply cut: the leaves keep losing water by transpiration…', 'warn'); } });
    this.ro = ui.readouts([{ id: 'r', label: 'Rate', unit: 'mm/min' }, { id: 'd', label: 'Bubble moved', unit: 'mm' }], sec);
    const res = ui.section('Results');
    this.tbl = ui.table(['Run', 'T', 'Wind', 'Humidity', 'Light', 'mm/min'], res);
    this.graph = ui.graph({ x: { label: 'Run number', min: 0, max: 8 }, y: { label: 'Water uptake / mm per min', min: 0, max: 30 }, series: [{ name: 'rate', color: '#38bdf8', points: true, line: true }], auto: true }, res);
    ui.notes();
    ui.questions([
      { q: 'Why did switching the fan on **increase** the rate?', opts: ['Moving air removes water vapour near the leaf, keeping the diffusion gradient steep', 'The fan blew water into the leaves', 'Wind cools the leaf so it opens more stomata', 'Wind makes the xylem wider'], e: 'Water vapour diffuses out of stomata faster when the air outside is drier.', o: [3, 4], sub: 'B8.3' },
      { q: 'A plastic bag over the shoot **slowed** transpiration because…', opts: ['the humidity rose, reducing the water-vapour concentration gradient', 'the bag blocked the light completely', 'plastic absorbs water', 'the leaves stopped making sugar'], e: 'Humid air means a smaller gradient between the air spaces and the air outside.', o: [4], sub: 'B8.3' },
      { q: 'Inside the leaf, water evaporates from the surfaces of…', opts: ['mesophyll cells into the air spaces', 'phloem tubes', 'the cuticle', 'root hair cells'], e: 'It then diffuses out through the stomata.', o: [2], sub: 'B8.3' },
      { q: 'The bubble moved 24 mm in 3 minutes. What is the rate?', ans: 8, tol: 0.01, unit: 'mm/min', e: '24 ÷ 3 = 8 mm per minute.', o: [3], sub: 'B8.3' },
      { q: 'With the water supply cut off the shoot wilted. Why?', opts: ['It lost water faster than it took it up, so cells lost turgor', 'It made too much glucose', 'The phloem stopped working', 'Light was too bright'], e: 'Flaccid cells cannot hold the leaf up.', o: [5], sub: 'B8.3' },
    ], { sub: 'B8.3', onDone: () => { this.st.done(4); this.check(); } });
  }
  resetBubble() { this.bubbleX = 0; this.bubble.position.x = 0.22; audio.pour(); }
  measure() {
    if (this.measuring) return;
    this.measuring = true;
    const r = this.rate() * (0.94 + Math.random() * 0.12);
    const dist = r * 2;
    if (this.bubbleX + dist > 420) this.resetBubble();
    const x0 = this.bubbleX;
    tweens.tween(4, (e) => { this.bubbleX = x0 + dist * e; this.bubble.position.x = 0.22 - this.bubbleX / 1000; this.ro.set('d', +(dist * e).toFixed(1)); this.sw.set(120 * e); }).promise.then(() => {
      this.measuring = false;
      this.ro.set('r', +r.toFixed(1));
      const run = this.runs.length + 1;
      this.runs.push({ T: this.T, wind: this.wind, hum: this.hum, light: this.light, r });
      this.tbl.add([run, this.T, ['off', 'low', 'high'][this.wind], ['dry', 'normal', 'bag'][this.hum], this.light ? 'bright' : 'dark', r.toFixed(1)]);
      this.graph.add(0, run, r);
      this.ui.note(`Run ${run}: bubble moved ${dist.toFixed(1)} mm in 2 min → **${r.toFixed(1)} mm/min**.`);
      const base = this.runs.find((x) => x.T === 20 && x.wind === 0 && x.hum === 1 && x.light);
      if (base) this.st.done(0);
      if (this.runs.some((x) => x.wind > 0)) this.st.done(1);
      if (this.runs.some((x) => x.T >= 30)) this.st.done(2);
      if (this.runs.some((x) => x.hum === 2)) this.st.done(3);
      this.check();
    });
  }
  check() { this.st.check(); }
  update(dt) {
    this.blades.rotation.x += dt * [0, 8, 20][this.wind];
    const loss = this.rate();
    const target = this.cut ? clamp((loss - 3) / 10, 0, 1) : 0;
    this.wilt += (target - this.wilt) * dt * 0.3;
    this.leafs.forEach((p, i) => { p.rotation.z = 0.25 - this.wilt * (1.2 + (i % 3) * 0.2) + Math.sin(performance.now() * 0.002 + i) * 0.03 * (1 + this.wind); });
    this.leafM.color.set('#22c55e').lerp(new THREE.Color('#a3a33a'), this.wilt * 0.7);
  }
}
