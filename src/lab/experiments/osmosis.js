import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { boilingTube, rack, Balance, mesh, mat, M } from '../apparatus.js';
import { clamp, linearFit, tweens, ease } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const CONC = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
const pct = (c) => 16 - 52 * c + 12 * c * c;

export default class Osmosis extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Why did Ravi’s salted lettuce wilt? Soak potato cylinders in sugar solutions, weigh them and find the concentration that matches the inside of the cells.';
    this.view = { pos: [0, 1.56, 1.3], target: [0, 0.99, 0] };
    this.phase = 'fresh';
  }

  build() {
    const Y = this.Y;
    this.rack = rack(6, 0.06); this.lab.add(this.rack, -0.12, Y, -0.04);
    this.tubes = CONC.map((c, i) => {
      const t = boilingTube({ color: '#f1f5f9', level: 0.6, opacity: 0.35 });
      t.position.copy(this.rack.slots[i]); this.rack.add(t);
      this.lab.label(t, `${c.toFixed(1)} M`, { y: 0.19, cls: 'dimlab' });
      return t;
    });
    this.lab.label(this.rack, 'Sucrose solutions', { y: 0.24 });
    const tile = mesh(new THREE.BoxGeometry(0.36, 0.01, 0.08), M.ceramic); this.lab.add(tile, -0.12, Y, 0.1);
    this.bal = new Balance(); this.lab.add(this.bal, 0.22, Y, 0.03);
    const potato = new THREE.MeshStandardMaterial({ color: '#f3e3b3', roughness: 0.75 });
    this.cyl = CONC.map((c, i) => {
      const m = mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.05, 14), potato.clone());
      const home = new THREE.Vector3(-0.12 - 0.15 + i * 0.06, Y + 0.018, 0.1);
      m.rotation.z = Math.PI / 2; m.position.copy(home);
      (this.lab.tabRoot || this.root).add(m);
      m.userData = { c, home, m0: +(2.35 + Math.random() * 0.35).toFixed(2), m1: null };
      this.lab.interactive(m, { tip: `Potato cylinder ${i + 1} → ${c.toFixed(1)} M`, onClick: () => this.weighOne(i) });
      return m;
    });
    this._buildCellView();
    const ui = this.ui;
    this.st = ui.steps(['**Weigh** every potato cylinder (click them, or Weigh all)', 'Put each cylinder into its sucrose solution', 'Leave them for **30 minutes**', 'Remove, **blot dry** and reweigh', 'Plot % change in mass and find where the line crosses zero', 'Answer the analysis questions']);
    const sec = ui.section('Procedure controls');
    ui.buttons([{ label: '⚖ Weigh all', onClick: () => this.weighAll() }, { label: '⬇ Into tubes', onClick: () => this.place() }, { label: '⏩ Wait 30 min', kind: 'primary', onClick: () => this.wait() }, { label: '⚖ Blot & reweigh', onClick: () => this.reweigh() }], sec);
    this.tbl = ui.table(['Sucrose /M', 'Start /g', 'End /g', 'Change /g', '% change'], ui.section('Results'));
    this.graph = ui.graph({ x: { label: 'Sucrose concentration / mol/dm³', min: 0, max: 1 }, y: { label: '% change in mass', min: -30, max: 20 }, series: [{ name: 'data', color: '#facc15', points: true, fit: true }] });
    const cs = ui.section('Inside a cell');
    ui.seg({ label: 'Show a cell from tube…', options: CONC.map((c, i) => [i, `${c.toFixed(1)}`]), value: 0, parent: cs, onChange: (v) => this.showCell(+v) });
    this.cellText = ui.text('Choose a tube to see the cells after soaking.', cs);
    ui.notes();
    ui.questions([
      { q: 'From your graph, estimate the sucrose concentration with **no change in mass** (the isotonic point).', ans: () => this.isotonic(), tol: 0.3, abs: 0.06, unit: 'mol/dm³', e: 'Where the best-fit line crosses 0%, the water potential inside and outside the cells is equal — about {ans} mol/dm³.', o: [3], sub: 'B3.2' },
      { q: 'The cylinder in **1.0 M** sucrose became soft and floppy because its cells…', opts: ['lost water by osmosis and became flaccid (plasmolysed)', 'gained sugar and swelled', 'gained water and burst', 'were killed by sugar'], e: 'Water left the cells into the more concentrated solution.', o: [2, 3, 5], sub: 'B3.2' },
      { q: 'The cylinder in pure water gained mass. In terms of water potential…', opts: ['water moved from the higher water potential outside to the lower water potential inside the cells', 'sugar moved into the cells', 'water moved from low to high water potential', 'the potato absorbed air'], e: 'Osmosis: net movement of water from high to low water potential across a partially permeable membrane.', o: [4, 6], sub: 'B3.2' },
      { q: 'Why compare **percentage** change rather than change in grams?', opts: ['The cylinders started with slightly different masses', 'It makes the numbers bigger', 'Balances only measure percentages', 'Grams cannot be negative'], e: 'Percentages allow a fair comparison between samples of different sizes.', o: [3], sub: 'B3.2' },
    ], { sub: 'B3.2', onDone: () => { this.st.done(5); this.check(); } });
  }

  _buildCellView() {
    const g = new THREE.Group(); this.lab.add(g, 0.26, this.Y + 0.17, -0.12); this.cellG = g;
    g.add(mesh(new THREE.BoxGeometry(0.12, 0.08, 0.04), new THREE.MeshPhysicalMaterial({ color: '#86efac', transparent: true, opacity: 0.25, roughness: 0.2 })));
    const wall = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.12, 0.08, 0.04)), new THREE.LineBasicMaterial({ color: '#166534' })); g.add(wall);
    this.memb = mesh(new THREE.BoxGeometry(0.114, 0.074, 0.036), new THREE.MeshStandardMaterial({ color: '#bbf7d0', transparent: true, opacity: 0.5 })); g.add(this.memb);
    this.vac = mesh(new THREE.SphereGeometry(0.03, 20, 14), new THREE.MeshStandardMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.65 })); this.vac.scale.set(1.6, 0.95, 0.5); g.add(this.vac);
    g.add(mesh(new THREE.SphereGeometry(0.008, 12, 10), mat('#4c1d95'), -0.035, 0.015, 0.012));
    this.cellLabel = this.lab.label(g, 'Plant cell (fresh)', { y: 0.07 });
  }
  showCell(i) {
    const c = CONC[i];
    const soaked = this.phase === 'soaked' || this.phase === 'done';
    const d = soaked ? pct(c) : 0;
    const k = clamp(1 + d / 40, 0.45, 1.25);
    tweens.to(this.memb.scale, { x: Math.min(1, k), y: Math.min(1, k * 1.02), z: 1 }, 0.6, { ease: ease.outCubic });
    tweens.to(this.vac.scale, { x: 1.6 * k, y: 0.95 * k, z: 0.5 * Math.min(1.1, k) }, 0.6, { ease: ease.outCubic });
    const state = !soaked ? 'fresh — soak it first!' : d > 3 ? 'turgid: water entered, the vacuole pushes on the wall' : d < -6 ? 'plasmolysed: water left, the membrane pulls away from the wall' : 'roughly isotonic: little net movement';
    this.cellLabel.userData.set(`${c.toFixed(1)} M → ${state.split(':')[0]}`);
    this.cellText.innerHTML = `<b>${c.toFixed(1)} M:</b> ${state}.`;
  }

  async weighOne(i) {
    const m = this.cyl[i]; const u = m.userData;
    if (this.phase !== 'fresh' || u.weighed) return;
    const p0 = m.position.clone(), top = this.bal.position.clone().add(new THREE.Vector3(0, 0.072, -0.02));
    await tweens.tween(0.5, (e) => m.position.lerpVectors(p0, top, e), { ease: ease.inOut }).promise;
    this.bal.set(u.m0); audio.clink(); u.weighed = true;
    this.ui.note(`Cylinder for ${u.c.toFixed(1)} M: **${u.m0.toFixed(2)} g**`);
    await tweens.tween(0.35, () => {}).promise;
    await tweens.tween(0.5, (e) => m.position.lerpVectors(top, u.home, e), { ease: ease.inOut }).promise;
    this.bal.set(0);
    if (this.cyl.every((x) => x.userData.weighed)) this.st.done(0);
  }
  async weighAll() { for (let i = 0; i < 6; i++) if (!this.cyl[i].userData.weighed) await this.weighOne(i); }
  place() {
    if (!this.st.isDone(0)) { this.ui.hint('Weigh every cylinder first — you need the starting masses!', 3000); audio.fail(); return; }
    if (this.phase !== 'fresh') return;
    this.cyl.forEach((m, i) => {
      const target = this.rack.localToWorld(this.rack.slots[i].clone()).add(new THREE.Vector3(0, 0.035, 0));
      const p0 = m.position.clone();
      tweens.tween(0.7, (e) => { m.position.lerpVectors(p0, target, e); m.rotation.z = (Math.PI / 2) * (1 - e); }, { delay: i * 0.08, ease: ease.inOut });
    });
    audio.splash();
    this.phase = 'placed'; this.st.done(1);
  }
  wait() {
    if (this.phase !== 'placed') { this.ui.hint(this.phase === 'fresh' ? 'Weigh and place the cylinders first.' : 'They have already soaked for 30 minutes.', 2500); return; }
    this.phase = 'soaking'; this.ui.hint('⏩ 30 minutes pass…', 2000);
    tweens.tween(2.2, (e) => {
      this.cyl.forEach((m) => { const d = pct(m.userData.c) / 100; m.scale.set(1 + d * 0.5 * e, 1 + d * 0.6 * e, 1 + d * 0.5 * e); m.material.color.set('#f3e3b3').lerp(new THREE.Color(d < 0 ? '#e6d9a8' : '#fff4cf'), Math.abs(d) * 3 * e); });
    }).promise.then(() => { this.phase = 'soaked'; this.st.done(2); this.ui.note('Half an hour later: some cylinders feel firm, others soft and bendy.'); this.showCell(0); });
  }
  reweigh() {
    if (this.phase !== 'soaked') { this.ui.hint('Let them soak for 30 minutes first.', 2500); return; }
    this.phase = 'done';
    this.tbl.clear(); const pts = [];
    for (const m of this.cyl) {
      const u = m.userData; const d = pct(u.c) + (Math.random() - 0.5) * 2.2;
      u.m1 = +(u.m0 * (1 + d / 100)).toFixed(2);
      const p = ((u.m1 - u.m0) / u.m0) * 100;
      this.tbl.add([u.c.toFixed(1), u.m0.toFixed(2), u.m1.toFixed(2), (u.m1 - u.m0).toFixed(2), p.toFixed(1)]);
      pts.push([u.c, p]);
    }
    this.graph.set(0, pts);
    this.pts = pts;
    audio.clink(); this.st.done(3); this.st.done(4);
    this.ui.note(`The best-fit line crosses 0% at about **${this.isotonic().toFixed(2)} M** — the concentration of the potato cells’ sap.`, 'gold');
    this.check();
  }
  isotonic() { if (!this.pts) return null; const f = linearFit(this.pts); return f ? -f.c / f.m : null; }
  check() { this.st.check(); }
  update(dt) { for (const t of this.tubes) t.update(dt); }
}
