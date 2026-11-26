import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { WaterBath, boilingTube, spottingTile, Stopwatch, mesh, mat, dropperBottle } from '../apparatus.js';
import { clamp } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const fT = (T) => (T <= 37 ? Math.exp(-(((T - 37) / 15) ** 2)) : Math.exp(-(((T - 37) / 10) ** 2))) * (T >= 62 ? 0.02 : 1);
const fpH = (p) => Math.exp(-(((p - 7) / 1.7) ** 2));

export default class Enzymes extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Iris boiled her costumes with biological washing powder — and the stains stayed. Find out how temperature and pH affect amylase, an enzyme that digests starch.';
    this.view = { pos: [0, 1.56, 1.3], target: [0, 1.0, 0] };
    this.T = 37; this.pH = 7; this.running = false; this.temps = new Set(); this.phs = new Set();
  }
  build() {
    const Y = this.Y;
    this.bath = new WaterBath(); this.lab.add(this.bath, -0.2, Y, 0); this.bath.set(this.T);
    this.lab.label(this.bath, 'Water bath', { y: 0.2 });
    this.tube = boilingTube({ color: '#e5e7eb', level: 0.55, opacity: 0.55 }); this.tube.position.set(-0.03, 0.03, 0); this.bath.add(this.tube);
    this.lab.label(this.tube, 'Starch + amylase', { y: 0.2, cls: 'dimlab' });
    this.tile = spottingTile(3, 7); this.lab.add(this.tile, 0.08, Y, 0.08);
    this.lab.label(this.tile, 'Spotting tile (iodine in each well)', { y: 0.05 });
    this.tile.wells.forEach((w) => w.material.color.set('#c2410c'));
    const iod = dropperBottle('Iodine', '#b45309'); this.lab.add(iod, 0.26, Y, 0.08);
    this.sw = new Stopwatch(); this.lab.add(this.sw, 0.1, Y, -0.08);
    this._buildModel();
    const ui = this.ui;
    this.st = ui.steps(['Run the reaction at **37 °C, pH 7**', 'Repeat at **three or more** temperatures', 'Repeat at **three or more** pH values', 'Watch the 3D enzyme at **60 °C or hotter**', 'Answer the analysis questions']);
    const sec = ui.section('Conditions');
    this.tS = ui.slider({ label: 'Temperature', min: 10, max: 70, step: 5, value: this.T, unit: '°C', parent: sec, onInput: (v) => { this.T = v; this.bath.set(v); } });
    this.pS = ui.seg({ label: 'pH buffer', options: [[3, 'pH 3'], [5, 'pH 5'], [7, 'pH 7'], [9, 'pH 9'], [11, 'pH 11']], value: 7, parent: sec, onChange: (v) => { this.pH = +v; } });
    ui.buttons([{ label: '▶ Mix and start sampling', kind: 'primary', onClick: () => this.start() }, { label: '⏩ ×3 speed', onClick: () => { this.fast = !this.fast; } }], sec);
    this.ro = ui.readouts([{ id: 't', label: 'Time', unit: 's' }, { id: 's', label: 'Starch left', unit: '%' }, { id: 'r', label: 'Activity' }], sec);
    const res = ui.section('Results');
    this.tbl = ui.table(['T /°C', 'pH', 'Time /s', 'Rate (1000/t)'], res);
    this.gT = ui.graph({ x: { label: 'Temperature / °C', min: 0, max: 75 }, y: { label: 'Rate (1000 ÷ time)', min: 0, max: 12 }, series: [{ name: 'pH 7', color: '#a78bfa', points: true, line: true }, { name: 'other pH', color: '#94a3b8', points: true }], height: 160 }, res);
    this.gP = ui.graph({ x: { label: 'pH', min: 2, max: 12 }, y: { label: 'Rate (1000 ÷ time)', min: 0, max: 12 }, series: [{ name: 'at 37 °C', color: '#5eead4', points: true, line: true }], height: 140 }, res);
    ui.notes();
    ui.questions([
      { q: 'From your temperature graph, what is the **optimum temperature** for amylase?', ans: 37, tol: 0.18, unit: '°C', e: 'The fastest rate is close to body temperature, about 37 °C.', o: [2], sub: 'B5.1' },
      { q: 'At 70 °C the starch never disappeared. Why?', opts: ['The enzyme was denatured — its active site changed shape so starch no longer fits', 'The enzyme was killed like a living cell', 'Starch melts at 70 °C', 'The iodine stopped working'], e: 'Enzymes are proteins; heat breaks the bonds that hold the active site’s shape.', o: [2, 5], sub: 'B5.1' },
      { q: 'Why is the reaction faster at 37 °C than at 20 °C?', opts: ['Molecules have more kinetic energy, so enzyme–substrate collisions are more frequent', 'The enzyme is bigger', 'There is more starch', 'The active site changes shape'], e: 'More kinetic energy → more frequent successful collisions → more enzyme–substrate complexes.', o: [5], sub: 'B5.1' },
      { q: 'Amylase digests starch but not protein because…', opts: ['its active site is complementary in shape only to starch', 'protein is too big', 'protein is already digested', 'amylase only works in the mouth'], e: 'Enzymes are specific: the substrate must fit the active site.', o: [3, 4], sub: 'B5.1' },
      { q: 'Amylase breaks starch down into…', opts: ['simple reducing sugars', 'amino acids', 'fatty acids and glycerol', 'cellulose'], e: 'Then Benedict’s would turn brick red!', o: [5], sub: 'B7.3' },
    ], { sub: 'B5.1', onDone: () => { this.st.done(4); this.check(); } });
  }
  _buildModel() {
    const g = new THREE.Group(); this.lab.add(g, 0.18, this.Y + 0.22, -0.16); this.model = g;
    const enz = new THREE.Group(); g.add(enz); this.enz = enz;
    this.enzM = new THREE.MeshStandardMaterial({ color: '#8b5cf6', roughness: 0.35, emissive: '#4c1d95', emissiveIntensity: 0.3 });
    const body = mesh(new THREE.SphereGeometry(0.05, 28, 20, 0, Math.PI * 2, 0.55, Math.PI - 0.55), this.enzM); body.rotation.x = Math.PI; enz.add(body);
    this.site = mesh(new THREE.TorusGeometry(0.017, 0.006, 8, 20), new THREE.MeshStandardMaterial({ color: '#fbbf24', emissive: '#b45309', emissiveIntensity: 0.6 }), 0, 0.044, 0); this.site.rotation.x = Math.PI / 2; enz.add(this.site);
    this.lab.label(g, 'Amylase: active site (gold ring)', { y: 0.13 });
    this.subs = [];
    for (let k = 0; k < 6; k++) {
      const s = new THREE.Group();
      s.add(mesh(new THREE.BoxGeometry(0.014, 0.014, 0.014), mat('#38bdf8', 0, 0.4), -0.008, 0, 0), mesh(new THREE.BoxGeometry(0.014, 0.014, 0.014), mat('#38bdf8', 0, 0.4), 0.008, 0, 0));
      s.userData = { phase: Math.random() * 6, state: 'free', t: 0 };
      g.add(s); this.subs.push(s);
    }
  }
  start() {
    if (this.running) return;
    this.running = true; this.clock = 0; this.next = 0; this.well = 0; this.runT = this.T; this.runP = this.pH; this.found = null;
    this.k = (Math.log(20) / 120) * fT(this.T) * fpH(this.pH);
    this.tile.wells.forEach((w) => w.material.color.set('#c2410c'));
    audio.pour();
    this.ui.note(`Started at ${this.T} °C, pH ${this.pH}. A drop is tested with iodine every 30 s.`);
    if (this.T >= 60) { this.st.done(3); this.ui.note('Look at the 3D enzyme: the active site has lost its shape — the substrate cannot bind. **Denatured.**', 'warn'); }
  }
  finish(time) {
    this.running = false;
    const rate = time ? 1000 / time : 0;
    this.tbl.add([this.runT, this.runP, time ? time : '> 600', rate.toFixed(2)]);
    if (this.runP === 7) this.gT.add(0, this.runT, rate); else this.gT.add(1, this.runT, rate);
    if (this.runT === 37) this.gP.add(0, this.runP, rate);
    this.gT.series[0].data.sort((a, b) => a[0] - b[0]); this.gT.draw(); this.gP.series[0].data.sort((a, b) => a[0] - b[0]); this.gP.draw();
    if (this.runT === 37 && this.runP === 7) this.st.done(0);
    if (this.runP === 7) this.temps.add(this.runT); if (this.runT === 37) this.phs.add(this.runP);
    if (this.temps.size >= 3) this.st.done(1);
    if (this.phs.size >= 3) this.st.done(2);
    this.ui.note(time ? `Starch gone after **${time} s** → rate ${rate.toFixed(2)}.` : 'Even after 10 minutes the iodine still turns blue-black: the starch was not digested.', time ? '' : 'warn');
    this.check();
  }
  check() { if ([0, 1, 2, 3, 4].every((i) => this.st.isDone(i))) this.lab.complete(); }
  update(dt, t) {
    this.tube.update(dt);
    const act = fT(this.T) * fpH(this.pH);
    this.ro.set('r', `${Math.round(act * 100)}%`);
    if (this.running) {
      this.clock += dt * (this.fast ? 30 : 10);
      const starch = Math.exp(-this.k * this.clock);
      this.ro.set('t', Math.round(this.clock)); this.ro.set('s', Math.round(starch * 100)); this.sw.set(this.clock);
      this.tube.setColor(new THREE.Color('#e5e7eb').lerp(new THREE.Color('#f8fafc'), 1 - starch).getStyle());
      while (this.clock >= this.next && this.well < this.tile.wells.length) {
        const s = Math.exp(-this.k * this.next);
        const w = this.tile.wells[this.well];
        w.material.color.set(s > 0.05 ? '#1e1b4b' : '#c2410c');
        audio.clink();
        if (s <= 0.05 && !this.found) { this.found = this.next; this.finish(this.next); break; }
        this.next += 30; this.well++;
      }
      if (this.running && (this.well >= this.tile.wells.length || this.clock > 600)) this.finish(null);
    }
    // 3D enzyme animation
    const hot = this.T >= 55 ? clamp((this.T - 55) / 10, 0, 1) : 0;
    this.enz.rotation.y += dt * 0.4;
    this.enz.scale.set(1 + Math.sin(t * 9) * 0.03 * hot, 1 - hot * 0.25 + Math.sin(t * 7) * 0.03 * hot, 1 + hot * 0.2);
    this.site.scale.setScalar(1 - hot * 0.75);
    this.enzM.color.set('#8b5cf6').lerp(new THREE.Color('#9ca3af'), hot * 0.8);
    const speed = 0.5 + act * 2;
    for (const s of this.subs) {
      const u = s.userData; u.phase += dt * speed;
      if (u.state === 'free') {
        const r = 0.12, a = u.phase;
        s.position.set(Math.cos(a) * r, 0.06 + Math.sin(a * 1.3) * 0.03, Math.sin(a) * r * 0.6);
        s.children.forEach((c, i) => { c.position.x = i ? 0.008 : -0.008; });
        if (hot < 0.5 && Math.random() < dt * act * 0.8) { u.state = 'bound'; u.t = 0; }
      } else if (u.state === 'bound') {
        u.t += dt; const p = Math.min(1, u.t * 2);
        s.position.lerp(new THREE.Vector3(0, 0.06, 0), p * 0.3);
        if (u.t > 0.8) { u.state = 'split'; u.t = 0; audio.bubble(); }
      } else {
        u.t += dt; s.children.forEach((c, i) => { c.position.x = (i ? 1 : -1) * (0.008 + u.t * 0.08); });
        s.position.y += dt * 0.05;
        if (u.t > 1.2) { u.state = 'free'; u.phase = Math.random() * 6; }
      }
    }
  }
}
