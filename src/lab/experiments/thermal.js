import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { Bunsen, tripod, beaker, Thermometer, Bulb, PowerSupply, stand, wire, mesh, mat, M } from '../apparatus.js';
import { h, clear, clamp, tweens } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const RODS = [
  { id: 'cu', name: 'Copper', a: 1.0, col: '#c8743c', metal: 0.9 },
  { id: 'al', name: 'Aluminium', a: 0.82, col: '#d1d5db', metal: 0.85 },
  { id: 'brass', name: 'Brass', a: 0.34, col: '#c9a24a', metal: 0.9 },
  { id: 'steel', name: 'Steel', a: 0.13, col: '#9ca3af', metal: 0.8 },
  { id: 'glass', name: 'Glass', a: 0.006, col: '#bae6fd', metal: 0 },
  { id: 'wood', name: 'Wood', a: 0.001, col: '#8a5a33', metal: 0 },
];
const FACES = [
  { id: 'black', name: 'Matt black', e: 0.95, col: '#111827', rough: 1 },
  { id: 'shblack', name: 'Shiny black', e: 0.8, col: '#1f2937', rough: 0.15 },
  { id: 'white', name: 'Matt white', e: 0.45, col: '#f8fafc', rough: 1 },
  { id: 'silver', name: 'Shiny silver', e: 0.1, col: '#e5e7eb', rough: 0.05, metal: 1 },
];

export default class Thermal extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Lucia is designing the festival food stalls: pans that heat fast, cool boxes that don’t, and a thermostat for the soup urn. Investigate every way thermal energy moves.';
    this.tabLabels = [['conduction', '🥄 Conduction'], ['convection', '🌀 Convection'], ['radiation', '☀️ Radiation'], ['expansion', '🌡️ Expansion']];
    this.tabObjectives = { conduction: ['P2.3.1', 'P2.3.4'], convection: ['P2.3.2', 'P2.3.4'], radiation: ['P2.3.3', 'P2.3.4'], expansion: ['P2.2.1'] };
    this.tabViews = { conduction: { pos: [0, 1.4, 0.85], target: [0, 0.96, 0] }, convection: { pos: [0, 1.36, 0.8], target: [0, 1.1, 0] }, radiation: { pos: [0, 1.38, 0.95], target: [0, 1.02, 0] }, expansion: { pos: [0, 1.38, 0.92], target: [0, 1.06, 0] } };
    this.view = this.tabViews.conduction;
  }
  checkTab(id, st) { st.check(); }

  // ======================================================== conduction
  tab_conduction() {
    const Y = this.Y;
    this.cd = { on: false, t: 0, fallen: [], order: [] };
    this.burner = new Bunsen(); this.lab.add(this.burner, 0, Y, 0.0);
    const hub = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 20), M.dark); this.lab.add(hub, 0, Y + 0.16, 0);
    this.rods = RODS.map((r, i) => {
      const a = Math.PI + (i / (RODS.length - 1)) * Math.PI; const g = new THREE.Group(); g.position.set(0, Y + 0.16, 0); g.rotation.y = -a; this.lab.tabRoot.add(g);
      const rm = new THREE.MeshStandardMaterial({ color: r.col, metalness: r.metal, roughness: r.metal ? 0.3 : 0.7, emissive: '#000000', transparent: r.id === 'glass', opacity: r.id === 'glass' ? 0.6 : 1 });
      const rod = mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.26, 10), rm, 0.16, 0, 0); rod.rotation.z = Math.PI / 2; g.add(rod);
      const pins = [0.07, 0.12, 0.17, 0.22].map((d) => { const p = new THREE.Group(); p.position.set(0.03 + d, 0.005, 0); p.add(mesh(new THREE.SphereGeometry(0.005, 10, 8), mat('#fef3c7', 0, 0.6)), mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.002, 12), M.brass, 0, 0.007, 0)); g.add(p); return { p, d, fallen: false }; });
      const end = new THREE.Object3D(); end.position.set(0.3, 0.02, 0); g.add(end); this.lab.label(end, r.name, { y: 0, cls: 'dimlab' });
      return { r, g, rm, pins };
    });
    const ui = this.ui;
    this.stC = ui.steps(['Heat the centre of the rods', 'Watch the waxed pins fall and **rank the conductors**', 'Answer the analysis questions']);
    const sec = ui.section('Conduction “star”');
    ui.buttons([{ label: '🔥 Heat', kind: 'primary', onClick: () => { this.burner.set('roaring'); this.cd.on = true; } }, { label: '⏹ Stop', onClick: () => { this.burner.set('off'); this.cd.on = false; } }], sec);
    this.tC = ui.table(['Rod', 'Pins fallen', 'First pin at'], sec);
    this.rodRows = RODS.map((r) => this.tC.add([r.name, '0', '—']));
    const rk = ui.section('Your ranking (best conductor first)');
    this.rank = RODS.map((r) => r.id).sort(() => Math.random() - 0.5); this.rankBox = h('div'); rk.append(this.rankBox); this.drawRank();
    ui.buttons([{ label: '✔ Check ranking', kind: 'primary', onClick: () => this.checkRank() }], rk);
    ui.notes();
    ui.questions([
      { q: 'Why are saucepans made of metal but have plastic or wooden handles?', opts: ['Metals conduct thermal energy well; plastic and wood are poor conductors (insulators)', 'Plastic conducts better', 'Metal handles are too heavy', 'Wood is a good conductor'], e: 'Use good conductors where you want heat to flow, insulators where you don’t.', o: [1], sub: 'P2.3.4' },
      { q: '(S) Metals conduct much better than glass because…', opts: ['as well as lattice vibrations, metals have free (delocalised) electrons that carry energy quickly', 'metal atoms are bigger', 'glass has no atoms', 'metals are always hotter'], e: 'In non-metals, energy passes only by atoms vibrating and bumping their neighbours.', o: [2], sub: 'P2.3.1' },
      { q: 'A cold metal bench feels colder than a wooden bench at the same temperature because…', opts: ['metal conducts energy away from your hand faster', 'metal is colder', 'wood is warmer', 'metal absorbs radiation'], e: 'Both are at room temperature — the rate of energy transfer differs.', o: [1], sub: 'P2.3.1' },
    ], { sub: 'P2.3.1', onDone: () => { this.stC.done(2); this.checkTab('conduction', this.stC, 3); } });
    this.every((dt, t) => this.simCond(dt, t));
    this.onTabDispose(() => { this.burner?.dispose(); this.burner = null; });
  }
  simCond(dt, t) {
    this.burner?.update(dt, t);
    const cd = this.cd; if (!cd.on) return;
    cd.t += dt; if (cd.t > 0.5) this.stC.done(0);
    for (const rd of this.rods) {
      const reach = 0.035 * Math.sqrt(rd.r.a * cd.t * 6);
      rd.rm.emissive.setRGB(clamp(reach * 4, 0, 0.6), clamp(reach, 0, 0.12), 0);
      rd.pins.forEach((pn, k) => {
        if (!pn.fallen && reach > pn.d) {
          pn.fallen = true; audio.clink();
          tweens.to(pn.p.position, { y: -0.16 }, 0.6, { ease: (x) => x * x }); tweens.to(pn.p.rotation, { z: 1.4 }, 0.6);
          const n = rd.pins.filter((p) => p.fallen).length;
          const row = this.rodRows[RODS.indexOf(rd.r)]; row.children[1].textContent = String(n); if (n === 1) row.children[2].textContent = `${cd.t.toFixed(0)} s`;
          if (n === 1) cd.order.push(rd.r.id);
        }
      });
    }
  }
  drawRank() {
    clear(this.rankBox);
    this.rank.forEach((id, i) => {
      const r = RODS.find((x) => x.id === id);
      this.rankBox.append(h('div', { class: 'row', style: { justifyContent: 'space-between', margin: '2px 0', padding: '3px 8px', background: 'rgba(255,255,255,.04)', borderRadius: '8px' } }, h('span', null, `${i + 1}. ${r.name}`),
        h('span', { class: 'row', style: { gap: '4px' } }, h('button', { class: 'btn tiny', onClick: () => { if (i > 0) { [this.rank[i - 1], this.rank[i]] = [this.rank[i], this.rank[i - 1]]; this.drawRank(); } } }, '▲'), h('button', { class: 'btn tiny', onClick: () => { if (i < this.rank.length - 1) { [this.rank[i + 1], this.rank[i]] = [this.rank[i], this.rank[i + 1]]; this.drawRank(); } } }, '▼'))));
    });
  }
  checkRank() {
    if (this.cd.order.length < 4) { this.ui.hint('Heat for longer — let pins fall from at least four rods.', 2600); return; }
    const ok = this.rank.every((id, i) => id === RODS[i].id);
    if (ok) { audio.success(); this.stC.done(1); this.ui.note('Correct: **copper > aluminium > brass > steel ≫ glass > wood**. Metals are good thermal conductors; glass and wood are insulators.', 'gold'); }
    else { audio.fail(); this.ui.note('Not quite — the pins fell first on the best conductor. Glass and wood barely warmed.', 'warn'); }
    this.checkTab('conduction', this.stC, 3);
  }

  // ======================================================== convection
  tab_convection() {
    const Y = this.Y;
    this.cv = { on: false, crystal: false, t: 0, breeze: null };
    this.burner = new Bunsen(); this.lab.add(this.burner, -0.04, Y, 0);
    this.lab.add(tripod(), 0, Y, 0);
    this.bk = beaker({ r: 0.07, h: 0.14, color: '#bfdbfe', level: 0.8, opacity: 0.22 }); this.lab.add(this.bk, 0, Y + 0.205, 0);
    this.lab.label(this.bk, 'Water — heated under the left side only', { y: 0.18 });
    const N = 420; this.dye = new THREE.InstancedMesh(new THREE.SphereGeometry(0.003, 6, 5), new THREE.MeshBasicMaterial({ color: '#86198f', transparent: true, opacity: 0.85 }), N); this.dye.frustumCulled = false; this.dye.count = 0; this.bk.add(this.dye);
    this.dp = []; this._o = new THREE.Object3D();
    this.cr = mesh(new THREE.OctahedronGeometry(0.005), mat('#6b21a8', 0.2, 0.3)); this.cr.visible = false; this.bk.add(this.cr);
    this.arrows = new THREE.Group(); this.bk.add(this.arrows); this.arrows.visible = false;
    const am = new THREE.MeshBasicMaterial({ color: '#f472b6', transparent: true, opacity: 0.7 });
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.0015, 6, 48), am); loop.position.set(0, 0.065, 0); this.arrows.add(loop);
    const ui = this.ui;
    this.stV = ui.steps(['Heat one side of the beaker', 'Drop a crystal of **potassium manganate(VII)** at the bottom, above the flame', 'Trace the **convection current**', 'Answer the analysis questions']);
    const sec = ui.section('Convection current');
    ui.buttons([{ label: '🔥 Heat left side', kind: 'primary', onClick: () => { this.burner.set('roaring'); this.cv.on = true; this.stV.done(0); } }, { label: '💜 Drop the crystal', onClick: () => this.dropCrystal() }, { label: '⏹ Stop heating', onClick: () => { this.burner.set('off'); this.cv.on = false; } }], sec);
    this.ui.text('Watch the purple dye: **up** above the flame, **across** the top, **down** the cool side, then back along the bottom.', sec);
    const sb = ui.section('Sea breezes');
    ui.seg({ label: 'Island at…', options: [['day', '☀️ Daytime'], ['night', '🌙 Night']], value: null, parent: sb, onChange: (v) => { this.ui.note(v === 'day' ? '**Day:** land heats faster than the sea. Warm air over the land rises; cooler air flows in from the sea — a **sea breeze**.' : '**Night:** land cools faster. Air over the warmer sea rises; air flows from land to sea — a **land breeze**.'); this.cv.breeze = (this.cv.breeze || new Set()).add(v); } });
    ui.notes();
    ui.questions([
      { q: '(S) Why does the heated water rise?', opts: ['It expands, becomes less dense, and is pushed up by the denser cooler water', 'Heat rises by itself', 'Its particles get lighter', 'The flame pushes it'], e: 'Convection is driven by density differences.', o: [3], sub: 'P2.3.2' },
      { q: 'Convection can happen in…', opts: ['liquids and gases, but not solids', 'solids only', 'a vacuum', 'metals only'], e: 'Particles must be free to move.', o: [1], sub: 'P2.3.2' },
      { q: 'The freezing compartment is at the **top** of a fridge because…', opts: ['cold air sinks, setting up a convection current that cools everything below', 'warm air sinks', 'it is easier to reach', 'radiation travels downwards'], e: 'An everyday application of convection.', o: [1], sub: 'P2.3.4' },
    ], { sub: 'P2.3.2', onDone: () => { this.stV.done(3); this.checkTab('convection', this.stV, 4); } });
    this.every((dt, t) => this.simConv(dt, t));
    this.onTabDispose(() => { this.burner?.dispose(); this.burner = null; });
  }
  dropCrystal() {
    if (this.cv.crystal) return;
    this.cv.crystal = true; this.cr.visible = true; this.cr.position.set(-0.045, 0.12, 0); audio.splash?.(0.2);
    tweens.to(this.cr.position, { y: 0.008 }, 1.2).promise.then(() => { this.stV.done(1); this.checkTab('convection', this.stV, 4); });
  }
  vel(x, y) { // circulating cell in the x–y plane of the beaker (local); centre (0, 0.065)
    const cx = 0, cy = 0.065, rx = x - cx, ry = y - cy; const s = this.cv.on ? 0.06 : 0.01;
    return [ry * s * 8, -rx * s * 8];
  }
  simConv(dt, t) {
    this.burner?.update(dt, t); this.bk?.update(dt);
    const cv = this.cv; if (!cv.crystal) return;
    if (cv.crystal && this.cr.position.y < 0.01) {
      cv.t += dt;
      if (this.dp.length < 420 && Math.random() < dt * 60) this.dp.push({ x: -0.045 + (Math.random() - 0.5) * 0.006, y: 0.01, z: (Math.random() - 0.5) * 0.01, a: 0 });
      this.dp.forEach((p, i) => {
        let [vx, vy] = this.vel(p.x, p.y); if (!cv.on) { vx *= 0.2; vy = 0.002; }
        if (p.x < -0.03 && cv.on) vy += 0.02; // plume above flame
        p.x = clamp(p.x + vx * dt, -0.065, 0.065); p.y = clamp(p.y + vy * dt, 0.005, 0.115); p.z += (Math.random() - 0.5) * 0.001; p.a += dt;
        this._o.position.set(p.x, p.y, p.z); this._o.updateMatrix(); this.dye.setMatrixAt(i, this._o.matrix);
      });
      this.dye.count = this.dp.length; this.dye.instanceMatrix.needsUpdate = true;
      if (cv.on && cv.t > 4 && !this.stV.isDone(2)) { this.stV.done(2); this.arrows.visible = true; this.ui.note('A **convection current**: hot water above the flame rises, moves across, cools and sinks on the far side, then flows back to be heated again.', 'gold'); this.checkTab('convection', this.stV, 4); }
    }
  }

  // ======================================================== radiation
  tab_radiation() {
    const Y = this.Y;
    this.rd = { face: 0, seen: new Set(), plates: null };
    this.cube = new THREE.Group(); this.lab.add(this.cube, -0.12, Y + 0.07, 0);
    FACES.forEach((f, i) => { const p = mesh(new THREE.PlaneGeometry(0.12, 0.12), new THREE.MeshStandardMaterial({ color: f.col, roughness: f.rough, metalness: f.metal || 0 })); p.rotation.y = (i * Math.PI) / 2; p.position.set(Math.sin((i * Math.PI) / 2) * 0.0601, 0, Math.cos((i * Math.PI) / 2) * 0.0601); this.cube.add(p); });
    this.cube.add(mesh(new THREE.BoxGeometry(0.119, 0.121, 0.119), mat('#475569', 0.3, 0.6)));
    this.lab.label(this.cube, 'Leslie’s cube (filled with water at 80 °C)', { y: 0.1 });
    const det = new THREE.Group(); this.lab.add(det, -0.12, Y + 0.07, 0.2);
    det.add(mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.05, 16), mat('#1f2937', 0.4, 0.4), 0, 0, 0).rotateX(Math.PI / 2));
    this.meter = mesh(new THREE.BoxGeometry(0.05, 0.03, 0.02), mat('#334155'), 0.06, -0.04, 0.02); det.add(this.meter);
    this.detLbl = this.lab.label(det, 'IR detector: — ', { y: 0.05, cls: 'val' });
    // absorber plates + heater
    const heater = mesh(new THREE.BoxGeometry(0.02, 0.1, 0.06), new THREE.MeshBasicMaterial({ color: '#7f1d1d' })); this.lab.add(heater, 0.22, Y + 0.08, 0); this.heater = heater;
    this.lab.label(heater, 'Radiant heater', { y: 0.08, cls: 'dimlab' });
    this.plates = [[0.13, '#111827', 'Matt black'], [0.31, '#e5e7eb', 'Shiny silver']].map(([x, col, name]) => { const g = new THREE.Group(); this.lab.add(g, x, Y, 0); g.add(mesh(new THREE.BoxGeometry(0.004, 0.12, 0.08), new THREE.MeshStandardMaterial({ color: col, roughness: name.startsWith('Matt') ? 1 : 0.05, metalness: name.startsWith('Matt') ? 0 : 1 }), 0, 0.07, 0)); const ball = mesh(new THREE.SphereGeometry(0.007, 12, 10), M.steel, (x < 0.22 ? -1 : 1) * 0.008, 0.09, 0); g.add(ball); this.lab.label(g, name, { y: 0.16, cls: 'dimlab' }); return { g, ball, name, k: name.startsWith('Matt') ? 1 : 0.12, T: 20, fell: false }; });
    const ui = this.ui;
    this.stR = ui.steps(['Measure the infrared emitted by **all four faces**', 'Switch on the heater: which plate is the better **absorber**?', 'Answer the analysis questions']);
    const sec = ui.section('Emitters');
    ui.buttons(FACES.map((f, i) => ({ label: f.name, onClick: () => this.turnCube(i) })), sec);
    this.tR = ui.table(['Surface', 'Detector reading'], sec);
    const ab = ui.section('Absorbers');
    ui.buttons([{ label: '🔥 Switch heater on', kind: 'primary', onClick: () => { this.rd.plates = { t: 0 }; this.heater.material.color.set('#ff6a2a'); audio.click(); } }], ab);
    ui.notes();
    ui.questions([
      { q: 'Thermal radiation is…', opts: ['infrared radiation, which can travel through a vacuum', 'a flow of hot particles', 'only possible in air', 'the same as convection'], e: 'That is how the Sun’s energy reaches Earth across space.', o: [1], sub: 'P2.3.3' },
      { q: 'Which surface is the best **emitter** and the best **absorber** of infrared?', opts: ['Matt (dull) black', 'Shiny silver', 'Matt white', 'Shiny white'], e: 'Shiny silver surfaces are the poorest — they reflect infrared.', o: [2], sub: 'P2.3.3' },
      { q: 'Why are houses in hot countries often painted white, and emergency blankets shiny?', opts: ['Light, shiny surfaces are poor absorbers and poor emitters of infrared', 'White surfaces conduct better', 'Shiny surfaces convect better', 'They are cheaper'], e: 'A shiny blanket reflects your body’s infrared back to you.', o: [1], sub: 'P2.3.4' },
    ], { sub: 'P2.3.3', onDone: () => { this.stR.done(2); this.checkTab('radiation', this.stR, 3); } });
    this.every((dt) => this.simRad(dt));
  }
  turnCube(i) {
    this.rd.face = i; const f = FACES[i];
    tweens.to(this.cube.rotation, { y: -(i * Math.PI) / 2 }, 0.8).promise.then(() => {
      const reading = 80 * f.e + (Math.random() - 0.5) * 2; this.detLbl.userData.set(`IR detector: ${reading.toFixed(0)} units`);
      if (!this.rd.seen.has(f.id)) { this.rd.seen.add(f.id); this.tR.add([f.name, `<b>${reading.toFixed(0)}</b>`]); }
      audio.blip();
      if (this.rd.seen.size === 4 && !this.stR.isDone(0)) { this.stR.done(0); this.ui.note('Same temperature, very different emission: **matt black emits most; shiny silver least**. Colour and texture both matter.', 'gold'); this.checkTab('radiation', this.stR, 3); }
    });
  }
  simRad(dt) {
    const p = this.rd.plates; if (!p) return;
    p.t += dt;
    for (const pl of this.plates) {
      pl.T += dt * 14 * pl.k * (1 - (pl.T - 20) / 60);
      if (!pl.fell && pl.T > 52) { pl.fell = true; audio.clink(); tweens.to(pl.ball.position, { y: 0.007 }, 0.5, { ease: (x) => x * x }); this.ui.note(`The wax melted on the **${pl.name.toLowerCase()}** plate first — its ball bearing dropped after ${p.t.toFixed(0)} s.`, pl.k === 1 ? 'gold' : ''); if (pl.k === 1) { this.stR.done(1); this.checkTab('radiation', this.stR, 3); } }
    }
  }

  // ======================================================== expansion
  tab_expansion() {
    const Y = this.Y;
    this.ex = { T: 20, on: false, set: 60, ballHot: false };
    this.burner = new Bunsen(); this.lab.add(this.burner, -0.18, Y, 0);
    const st = stand(0.3); this.lab.add(st, -0.32, Y, -0.04);
    this.strip = new THREE.Group(); this.lab.add(this.strip, -0.3, Y + 0.24, 0);
    this.brass = mesh(new THREE.BoxGeometry(0.2, 0.004, 0.02), M.brass); this.brass.geometry.translate(0.1, 0.002, 0); this.strip.add(this.brass);
    this.steel = mesh(new THREE.BoxGeometry(0.2, 0.004, 0.02), M.steel); this.steel.geometry.translate(0.1, -0.002, 0); this.strip.add(this.steel);
    this.lab.label(this.strip, 'Bimetallic strip: brass (top) + steel (bottom)', { y: 0.05, x: 0.1 });
    this.contact = mesh(new THREE.BoxGeometry(0.01, 0.01, 0.02), M.copper); this.lab.add(this.contact, -0.1, Y + 0.247, 0);
    this.bulb = new Bulb(); this.lab.add(this.bulb, 0.0, Y, 0.1); this.ps = new PowerSupply(); this.lab.add(this.ps, 0.1, Y, 0.12); this.ps.set(6);
    this.lab.add(wire([[-0.1, Y + 0.23, 0], [-0.06, Y + 0.12, 0.05], [0.0, Y + 0.02, 0.1]], '#dc2626'));
    this.th = new Thermometer(0.18, 0, 120); this.lab.add(this.th, -0.2, Y + 0.12, 0.04);
    // ball & ring
    this.ring = mesh(new THREE.TorusGeometry(0.02, 0.004, 10, 28), M.brass); this.ring.rotation.x = Math.PI / 2; this.lab.add(this.ring, 0.26, Y + 0.12, 0);
    this.ringStand = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.12, 8), M.steel); this.lab.add(this.ringStand, 0.285, Y + 0.06, 0);
    this.ball = mesh(new THREE.SphereGeometry(0.0185, 18, 14), M.brass); this.lab.add(this.ball, 0.26, Y + 0.18, 0);
    this.lab.label(this.ring, 'Ball & ring', { y: 0.12, cls: 'dimlab' });
    const ui = this.ui;
    this.stE = ui.steps(['Heat the **bimetallic strip** and watch it bend', 'Use it as a **thermostat**: the lamp switches off when hot', 'Try the **ball and ring** hot and cold', 'Answer the analysis questions']);
    const sec = ui.section('Bimetallic thermostat');
    ui.buttons([{ label: '🔥 Heat strip', kind: 'primary', onClick: () => { this.burner.set('roaring'); this.ex.on = true; } }, { label: '❄️ Let it cool', onClick: () => { this.burner.set('off'); this.ex.on = false; } }], sec);
    this.roE = ui.readouts([{ id: 'T', label: 'Strip temperature', unit: '°C' }, { id: 'L', label: 'Lamp' }], sec);
    const br = ui.section('Ball and ring');
    ui.buttons([{ label: '🔥 Heat the ball', onClick: () => { this.ex.ballHot = true; this.ball.material = this.ball.material.clone(); this.ball.material.emissive = new THREE.Color('#7c2d12'); this.ball.scale.setScalar(1.12); audio.click(); } }, { label: '⬇ Try to pass it through', onClick: () => this.tryBall() }, { label: '❄️ Cool the ball', onClick: () => { this.ex.ballHot = false; this.ball.scale.setScalar(1); if (this.ball.material.emissive) this.ball.material.emissive.set('#000000'); } }], br);
    ui.notes();
    ui.questions([
      { q: 'Why does the strip bend **downwards** when heated?', opts: ['Brass expands more than steel, so the brass side becomes longer', 'Steel expands more than brass', 'Both shrink', 'The flame pushes it'], e: 'Different metals expand by different amounts — the longer side ends up on the outside of the curve.', o: [1], sub: 'P2.2.1' },
      { q: '(S) Why do railway lines and bridges have small gaps?', opts: ['To allow the metal to expand on hot days without buckling', 'To save metal', 'To drain rain', 'To make a clicking sound'], e: 'Overhead cables also sag more in summer for the same reason.', o: [2], sub: 'P2.2.1' },
      { q: 'For the same temperature rise, which expands the **most**?', opts: ['A gas', 'A liquid', 'A solid', 'They all expand equally'], e: 'Gases expand most; solids least — liquid-in-glass thermometers rely on liquids expanding more than glass.', o: [1], sub: 'P2.2.1' },
    ], { sub: 'P2.2.1', onDone: () => { this.stE.done(3); this.checkTab('expansion', this.stE, 4); } });
    this.every((dt, t) => this.simExp(dt, t));
    this.onTabDispose(() => { this.burner?.dispose(); this.burner = null; });
  }
  tryBall() {
    const hot = this.ex.ballHot; audio.click();
    tweens.to(this.ball.position, { y: this.Y + (hot ? 0.142 : 0.06) }, 0.8, { ease: (x) => x * x }).promise.then(() => {
      if (hot) { this.ui.note('The hot ball **won’t pass** through the ring — it has expanded.', 'gold'); this.ex.hotTried = true; }
      else { this.ui.note('The cold ball passes through easily.'); this.ex.coldTried = true; setTimeout(() => { if (this.ball) this.ball.position.y = this.Y + 0.18; }, 700); }
      if (this.ex.hotTried && this.ex.coldTried) { this.stE.done(2); this.checkTab('expansion', this.stE, 4); }
      if (hot) setTimeout(() => { if (this.ball) this.ball.position.y = this.Y + 0.18; }, 900);
    });
  }
  simExp(dt, t) {
    const ex = this.ex; this.burner?.update(dt, t);
    ex.T = clamp(ex.T + (ex.on ? 9 : -5) * dt, 20, 110); this.th.set(ex.T);
    const bend = (ex.T - 20) * 0.0016; this.strip.rotation.z = -bend * 0.6;
    this.brass.scale.x = 1 + (ex.T - 20) * 0.00019; this.steel.scale.x = 1 + (ex.T - 20) * 0.00012;
    const touching = bend < 0.05;
    this.bulb.set(touching ? 1 : 0);
    this.roE.set('T', ex.T.toFixed(0)); this.roE.set('L', touching ? 'ON' : 'OFF');
    if (ex.T > 45 && !this.stE.isDone(0)) { this.stE.done(0); this.ui.note('The strip bends away from the brass side — brass expands more than steel.', 'gold'); }
    if (!touching && !this.stE.isDone(1)) { this.stE.done(1); this.ui.note('At about **50 °C** the strip bent away from the contact: the circuit broke and the lamp (heater) switched **off**. When it cools it reconnects — a thermostat!', 'gold'); }
    this.checkTab('expansion', this.stE, 4);
  }
}
void h;
