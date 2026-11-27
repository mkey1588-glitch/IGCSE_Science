import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { beaker, Thermometer, ParticleBox, Puffs, mesh, mat, M, ruler } from '../apparatus.js';
import { canvasTex } from '../../core/util.js';
import { clamp } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const C_ICE = 2100, C_W = 4200, LF = 334000, LV = 2.26e6, MASS = 0.1;

export default class Particles extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Why does ice-cream melt, why do balloons shrink at night, and how does the smell of bread reach the plaza? One idea explains them all: moving particles.';
    this.tabLabels = [['states', '🧊 States & heating curve'], ['gas', '🎈 Gas pressure'], ['diffusion', '💨 Diffusion race']];
    this.tabObjectives = { states: ['C1.1', 'P2.1.1', 'P2.2.2'], gas: ['P2.1.2', 'P2.1.3', 'C1.1'], diffusion: ['C1.2', 'P2.1.2'] };
    this.tabViews = { states: { pos: [0, 1.5, 1.2], target: [0, 1.08, 0] }, gas: { pos: [0, 1.5, 1.2], target: [0, 1.1, 0] }, diffusion: { pos: [0, 1.45, 1.05], target: [0, 1.0, 0] } };
    this.view = this.tabViews.states;
  }

  // ======================================================== states
  tab_states() {
    const Y = this.Y;
    this.P = 600; this.on = false; this.cooling = false; this.t = 0; this.T = -20; this.melt = 0; this.boil = 0; this.seenMelt = false; this.seenBoil = false;
    const plate = mesh(new THREE.BoxGeometry(0.2, 0.04, 0.2), M.dark); this.lab.add(plate, -0.15, Y, 0);
    this.plateTop = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.006, 24), new THREE.MeshStandardMaterial({ color: '#334155', emissive: '#000000' })); this.plateTop.position.set(-0.15, Y + 0.043, 0); (this.lab.tabRoot).add(this.plateTop);
    this.bk = beaker({ r: 0.06, h: 0.12, color: '#bfdbfe', level: 0, opacity: 0.6 }); this.lab.add(this.bk, -0.15, Y + 0.046, 0);
    this.ice = new THREE.Group(); this.bk.add(this.ice);
    for (let i = 0; i < 7; i++) { const c = mesh(new THREE.BoxGeometry(0.028, 0.026, 0.028), new THREE.MeshPhysicalMaterial({ color: '#e0f2fe', transparent: true, opacity: 0.8, roughness: 0.1 })); c.position.set(Math.cos(i * 1.9) * 0.025, 0.016 + (i > 3 ? 0.026 : 0), Math.sin(i * 1.9) * 0.025); c.rotation.y = i; this.ice.add(c); }
    this.th = new Thermometer(0.22, -30, 110); this.lab.add(this.th, -0.13, Y + 0.05, 0.02); this.th.rotation.z = -0.25;
    this.steam = new Puffs({ color: '#ffffff', size: 0.05, rise: 0.08, life: 2.5, opacity: 0.35, spread: 0.06 }); this.steam.position.set(-0.15, Y + 0.18, 0); this.lab.tabRoot.add(this.steam);
    this.pb = new ParticleBox({ w: 0.26, h: 0.18, d: 0.1, n: 54, r: 0.009, color: '#60a5fa' }); this.lab.add(this.pb, 0.17, Y + 0.08, -0.02);
    this.pb.mode = 'solid'; this.lab.label(this.pb, 'Particle model', { y: 0.23 });
    const ui = this.ui;
    this.st = ui.steps(['Heat the ice and watch the **melting** plateau', 'Keep heating until the water **boils**', 'Answer the analysis questions']);
    const sec = ui.section('Heater');
    ui.slider({ label: 'Heater power', min: 200, max: 1000, step: 100, value: this.P, unit: 'W', parent: sec, onInput: (v) => { this.P = v; } });
    ui.buttons([{ label: '🔥 Heat', kind: 'primary', onClick: () => { this.on = true; this.cooling = false; } }, { label: '⏸ Off', onClick: () => { this.on = false; } }, { label: '❄️ Cool (freezer)', onClick: () => { this.on = false; this.cooling = true; } }, { label: '⟲ New ice', onClick: () => this.resetIce() }], sec);
    this.ro = ui.readouts([{ id: 'T', label: 'Temperature', unit: '°C' }, { id: 't', label: 'Time', unit: 's' }, { id: 's', label: 'State' }], sec);
    this.g = ui.graph({ x: { label: 'Time / s', min: 0, max: 900 }, y: { label: 'Temperature / °C', min: -30, max: 115 }, series: [{ name: 'heating', color: '#f97316', line: true, points: false }], auto: true }, ui.section('Heating curve'));
    ui.notes();
    ui.questions([
      { q: 'While the ice was melting, the temperature stayed at 0 °C even though the heater was on. Why?', opts: ['The energy was used to overcome the forces between particles, not to raise their speed', 'The thermometer was broken', 'The heater turned itself off', 'Ice absorbs no energy'], e: 'This energy (latent heat) separates particles during melting and boiling.', o: [5], sub: 'P2.2.2' },
      { q: 'In a liquid, particles are…', opts: ['close together, randomly arranged and sliding past each other', 'far apart and moving fast in straight lines', 'in fixed positions in a regular pattern', 'not moving at all'], e: 'Liquids flow because particles can move past each other.', o: [2], sub: 'C1.1' },
      { q: 'What is the melting point of pure water at standard pressure?', ans: 0, tol: 0, abs: 0.5, unit: '°C', e: 'Pure water melts at 0 °C and boils at 100 °C.', o: [1], sub: 'P2.2.2' },
      { q: 'Sweat cools you because during evaporation…', opts: ['the most energetic particles escape, so the average energy of the rest falls', 'water absorbs cold from the air', 'particles stop moving', 'the skin gets wetter'], e: 'Evaporation removes the fastest particles from the surface.', o: [3, 4], sub: 'P2.2.2' },
    ], { sub: 'P2.2.2', onDone: () => { this.st.done(2); this.checkTab('states', 3); } });
    this.every((dt) => this.simStates(dt));
  }
  resetIce() { this.t = 0; this.T = -20; this.melt = 0; this.boil = 0; this.on = false; this.cooling = false; this.g.clear(); this.ice.visible = true; this.ice.scale.setScalar(1); this.bk.setLevel(0); }
  simStates(dt) {
    const speed = 12;
    let E = (this.on ? this.P : this.cooling ? -350 : 0) * dt * speed;
    if (E !== 0) this.t += dt * speed;
    const step = (dE) => {
      if (dE > 0) {
        if (this.melt < 1) { if (this.T < 0) { const need = (0 - this.T) * C_ICE * MASS; if (dE < need) { this.T += dE / (C_ICE * MASS); return 0; } this.T = 0; return dE - need; } const need = (1 - this.melt) * LF * MASS; if (dE < need) { this.melt += dE / (LF * MASS); return 0; } this.melt = 1; return dE - need; }
        if (this.T < 100) { const need = (100 - this.T) * C_W * MASS; if (dE < need) { this.T += dE / (C_W * MASS); return 0; } this.T = 100; return dE - need; }
        const need = (1 - this.boil) * LV * MASS; if (dE < need) { this.boil += dE / (LV * MASS); return 0; } this.boil = 1; this.on = false; return 0;
      } else {
        dE = -dE;
        if (this.melt >= 1 && this.T > 0) { const can = this.T * C_W * MASS; if (dE < can) { this.T -= dE / (C_W * MASS); return 0; } this.T = 0; return -(dE - can); }
        if (this.melt > 0) { const can = this.melt * LF * MASS; if (dE < can) { this.melt -= dE / (LF * MASS); return 0; } this.melt = 0; return -(dE - can); }
        this.T = Math.max(-25, this.T - dE / (C_ICE * MASS)); if (this.T <= -25) this.cooling = false; return 0;
      }
    };
    let guard = 0; while (E !== 0 && guard++ < 6) E = step(E);
    const state = this.boil >= 1 ? 'all boiled away' : this.T >= 100 ? 'boiling' : this.melt >= 1 ? 'liquid' : this.melt > 0 ? 'melting' : 'solid';
    this.ro.set('T', +this.T.toFixed(1)); this.ro.set('t', Math.round(this.t)); this.ro.set('s', state);
    this.th.set(this.T);
    this.plateTop.material.emissive.setRGB(this.on ? 0.9 * (this.P / 1000) + 0.2 : 0, this.on ? 0.15 : 0, 0);
    this.ice.scale.setScalar(Math.max(0.001, 1 - this.melt));
    this.ice.visible = this.melt < 0.999;
    this.bk.setLevel(this.melt * 0.4 * (1 - this.boil));
    this.steam.setRate(state === 'boiling' ? 6 : this.melt >= 1 && this.T > 40 ? 1 : 0); this.steam.update(dt);
    this.pb.mode = this.melt < 0.5 ? 'solid' : this.T >= 100 && this.boil > 0.02 ? 'gas' : 'liquid';
    this.pb.liquidTop = 0.11; this.pb.speed = Math.sqrt((this.T + 273) / 273) * (this.pb.mode === 'gas' ? 1.6 : 1);
    this.pb.update(dt);
    this.bk.update(dt);
    if (E !== 0 || this.on || this.cooling) { this._gt = (this._gt || 0) + dt; if (this._gt > 0.15) { this._gt = 0; this.g.add(0, this.t, this.T); } }
    if (!this.seenMelt && this.melt > 0.6) { this.seenMelt = true; this.st.done(0); this.ui.note('Melting: the temperature stays at **0 °C** while the ice turns to water.', 'gold'); }
    if (!this.seenBoil && this.T >= 100 && this.boil > 0.05) { this.seenBoil = true; this.st.done(1); this.ui.note('Boiling: stuck at **100 °C** — energy is breaking the forces between particles.', 'gold'); }
  }

  // ======================================================== gas
  tab_gas() {
    const Y = this.Y;
    this.Tg = 20; this.V = 1; this.gmode = 'V'; this.pts = { V: [], T: [] };
    const cyl = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 32, 1, true), M.glass); this.lab.add(cyl, -0.12, Y + 0.17, 0); cyl.position.y = Y + 0.17;
    this.piston = mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.02, 32), M.steel); this.lab.add(this.piston, -0.12, Y + 0.3, 0);
    this.rod = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 10), M.steel); this.lab.add(this.rod, -0.12, Y + 0.41, 0);
    this.heater = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 32), new THREE.MeshStandardMaterial({ color: '#334155', emissive: '#000' })); this.lab.add(this.heater, -0.12, Y + 0.01, 0);
    this.gpb = new ParticleBox({ w: 0.13, h: 0.26, d: 0.13, n: 50, r: 0.0065, color: '#f472b6', frame: false }); this.lab.add(this.gpb, -0.12, Y + 0.025, 0);
    this.gpb.mode = 'gas'; this.hits = 0; this.gpb.onHit = () => { this.hits++; };
    // pressure gauge
    this.gauge = canvasTex(256, 256); const gm = mesh(new THREE.CircleGeometry(0.06, 32), new THREE.MeshBasicMaterial({ map: this.gauge.tex })); this.lab.add(gm, 0.08, Y + 0.32, 0.0); gm.rotation.y = -0.3;
    this.lab.label(gm, 'Pressure gauge', { y: 0.08, cls: 'dimlab' });
    // Brownian box
    this.bb = new ParticleBox({ w: 0.14, h: 0.1, d: 0.06, n: 40, r: 0.003, color: '#94a3b8' }); this.lab.add(this.bb, 0.22, Y + 0.04, 0.05); this.bb.mode = 'gas'; this.bb.speed = 2.5;
    this.smoke = mesh(new THREE.SphereGeometry(0.008, 14, 10), new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#64748b', emissiveIntensity: 0.6 })); this.bb.add(this.smoke); this.smoke.position.set(0, 0.05, 0);
    this.smokeV = new THREE.Vector3();
    this.trail = []; this.trailLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#fde68a' })); this.bb.add(this.trailLine);
    this.lab.label(this.bb, 'Smoke cell (Brownian motion)', { y: 0.14 });
    const ui = this.ui;
    this.st = ui.steps(['Heat the gas at **fixed volume** (record 3+ pressures)', 'Compress the gas at **fixed temperature** (record 3+)', 'Watch the smoke particle’s **Brownian motion**', 'Answer the analysis questions']);
    const sec = ui.section('Gas syringe');
    ui.seg({ label: 'What stays fixed?', options: [['V', 'Volume'], ['T', 'Temperature'], ['P', 'Pressure (free piston)']], value: 'V', parent: sec, onChange: (v) => { this.gmode = v; } });
    this.tS = ui.slider({ label: 'Temperature', min: -50, max: 200, step: 10, value: 20, unit: '°C', parent: sec, onInput: (v) => { if (this.gmode !== 'T') this.Tg = v; else this.tS.set(this.Tg); } });
    this.vS = ui.slider({ label: 'Volume (piston)', min: 0.5, max: 1, step: 0.05, value: 1, fmt: (v) => `${Math.round(v * 100)}%`, parent: sec, onInput: (v) => { if (this.gmode === 'T') this.V = v; else this.vS.set(this.V); } });
    ui.buttons([{ label: '📋 Record pressure', kind: 'primary', onClick: () => this.recordGas() }, { label: '👀 Watch smoke particle', onClick: () => { this.st.done(2); this.ui.note('The smoke particle jiggles randomly: invisible, fast air molecules keep colliding with it from all sides.', 'gold'); this.checkTab('gas', 4); } }], sec);
    this.ro = ui.readouts([{ id: 'p', label: 'Pressure', unit: 'kPa' }, { id: 'T', label: 'Temperature', unit: 'K' }, { id: 'v', label: 'Volume', unit: 'cm³' }], sec);
    this.gg = ui.graph({ x: { label: 'Temperature / °C (fixed V)  ·  1/V (fixed T)', min: -60, max: 210 }, y: { label: 'Pressure / kPa', min: 0, max: 300 }, series: [{ name: 'fixed V: p vs T', color: '#f472b6', points: true, line: true }, { name: 'fixed T: p vs V%', color: '#38bdf8', points: true, line: true }] });
    ui.notes();
    ui.questions([
      { q: 'Heating the gas at **constant volume** raised the pressure because the particles…', opts: ['move faster, so they hit the walls harder and more often', 'get bigger and push on the walls', 'multiply when heated', 'stick to the walls'], e: 'Pressure comes from particle collisions with the walls.', o: [1], sub: 'P2.1.3' },
      { q: 'Pushing the piston in at constant temperature raised the pressure because…', opts: ['the same particles hit a smaller area more frequently', 'the particles moved faster', 'the gas got hotter', 'new particles were made'], e: 'Smaller volume → more collisions per second per unit area.', o: [1], sub: 'P2.1.3' },
      { q: 'The lowest possible temperature, where particles have the least kinetic energy, is about…', opts: ['−273 °C (absolute zero)', '0 °C', '−100 °C', '−459 °C'], e: 'Absolute zero = 0 K = −273 °C.', o: [2], sub: 'P2.1.2' },
      { q: 'What causes the Brownian motion of the smoke particle?', opts: ['Collisions with fast-moving, much smaller air molecules', 'The smoke particle is alive', 'Light pushes it', 'Convection currents only'], e: 'Unequal random impacts from tiny molecules make the larger particle jiggle.', o: [3, 5], sub: 'P2.1.2' },
    ], { sub: 'P2.1.3', onDone: () => { this.st.done(3); this.checkTab('gas', 4); } });
    this.every((dt) => this.simGas(dt));
  }
  pressure() { return 101 * ((this.Tg + 273) / 293) / this.V; }
  simGas(dt) {
    if (this.gmode === 'P') { this.V = clamp((this.Tg + 273) / 293, 0.5, 1.6); }
    const p = this.pressure();
    const h = 0.26 * Math.min(1.15, this.V);
    this.gpb.dim.h = h; this.gpb.speed = Math.sqrt((this.Tg + 273) / 293);
    this.piston.position.y = this.Y + 0.025 + h + 0.01; this.rod.position.y = this.piston.position.y + 0.11;
    this.heater.material.emissive.setRGB(clamp((this.Tg - 20) / 200, 0, 1), 0.05, 0);
    this.gpb.update(dt);
    this.ro.set('p', p.toFixed(0)); this.ro.set('T', Math.round(this.Tg + 273)); this.ro.set('v', Math.round(this.V * 100));
    this.gauge.redraw((ctx, w) => { ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.arc(w / 2, w / 2, w / 2 - 4, 0, 7); ctx.fill(); ctx.strokeStyle = '#334155'; ctx.lineWidth = 6; ctx.stroke(); ctx.fillStyle = '#111827'; ctx.font = '700 30px Inter'; ctx.textAlign = 'center'; ctx.fillText(`${p.toFixed(0)} kPa`, w / 2, w * 0.78); const a = -Math.PI * 0.75 + clamp(p / 300, 0, 1) * Math.PI * 1.5; ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(w / 2, w / 2); ctx.lineTo(w / 2 + Math.cos(a - Math.PI / 2) * w * 0.38, w / 2 + Math.sin(a - Math.PI / 2) * w * 0.38); ctx.stroke(); });
    // brownian
    this.bb.update(dt);
    this.smokeV.add(new THREE.Vector3((Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.02)).multiplyScalar(0.92);
    this.smoke.position.addScaledVector(this.smokeV, dt);
    this.smoke.position.x = clamp(this.smoke.position.x, -0.06, 0.06); this.smoke.position.y = clamp(this.smoke.position.y, 0.01, 0.09); this.smoke.position.z = clamp(this.smoke.position.z, -0.02, 0.02);
    this.trail.push(this.smoke.position.clone()); if (this.trail.length > 90) this.trail.shift();
    this.trailLine.geometry.setFromPoints(this.trail);
  }
  recordGas() {
    const p = this.pressure();
    if (this.gmode === 'V') { this.pts.V.push(this.Tg); this.gg.add(0, this.Tg, p); this.gg.series[0].data.sort((a, b) => a[0] - b[0]); this.gg.draw(); if (new Set(this.pts.V).size >= 3) this.st.done(0); }
    else if (this.gmode === 'T') { this.pts.T.push(this.V); this.gg.add(1, this.V * 200 - 50, p); if (new Set(this.pts.T).size >= 3) this.st.done(1); }
    this.ui.note(`${this.gmode === 'V' ? 'Fixed volume' : this.gmode === 'T' ? 'Fixed temperature' : 'Free piston'}: ${this.Tg} °C, volume ${Math.round(this.V * 100)}% → **${p.toFixed(0)} kPa**`);
    audio.clink(); this.checkTab('gas', 4);
  }

  // ======================================================== diffusion
  tab_diffusion() {
    const Y = this.Y;
    this.Td = 20; this.running = false; this.dt0 = 0; this.ringAt = null;
    const L = 0.6; this.L = L;
    const tube = mesh(new THREE.CylinderGeometry(0.018, 0.018, L, 24, 1, true), M.glass); tube.rotation.z = Math.PI / 2; this.lab.add(tube, 0, Y + 0.12, 0);
    for (const [x, c, n] of [[-L / 2 + 0.02, '#bfdbfe', 'Cotton wool + conc. ammonia'], [L / 2 - 0.02, '#bbf7d0', 'Cotton wool + conc. hydrochloric acid']]) { const w = mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.04, 16), mat(c, 0, 1)); w.rotation.z = Math.PI / 2; this.lab.add(w, x, Y + 0.12, 0); this.lab.label(w, n, { y: 0.05 }); }
    for (const x of [-0.2, 0.2]) { this.lab.add(mesh(new THREE.BoxGeometry(0.03, 0.1, 0.05), M.wood), x, Y, 0); }
    const r = ruler(0.6); this.lab.add(r, 0, Y + 0.095, 0.035);
    this.ring = mesh(new THREE.TorusGeometry(0.017, 0.006, 8, 24), new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#94a3b8', emissiveIntensity: 0.4 })); this.ring.rotation.y = Math.PI / 2; this.ring.visible = false; this.lab.add(this.ring, 0, Y + 0.12, 0);
    const geo = new THREE.SphereGeometry(0.0035, 6, 4);
    this.nh3 = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#60a5fa', emissive: '#1d4ed8', emissiveIntensity: 0.5 }), 90);
    this.hcl = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#4ade80', emissive: '#15803d', emissiveIntensity: 0.5 }), 90);
    this.lab.add(this.nh3, 0, Y + 0.12, 0); this.lab.add(this.hcl, 0, Y + 0.12, 0);
    this.seeds = Array.from({ length: 90 }, () => [Math.random(), (Math.random() - 0.5) * 0.026, (Math.random() - 0.5) * 0.026]);
    const ui = this.ui;
    this.st = ui.steps(['Start the race: ammonia (Mr 17) vs hydrogen chloride (Mr 36.5)', 'Measure where the **white ring** of ammonium chloride forms', 'Answer the analysis questions']);
    const sec = ui.section('Race');
    ui.slider({ label: 'Room temperature', min: 10, max: 40, step: 5, value: 20, unit: '°C', parent: sec, onInput: (v) => { this.Td = v; } });
    ui.buttons([{ label: '▶ Insert the cotton wool plugs', kind: 'primary', onClick: () => { this.running = true; this.dt0 = 0; this.ringAt = null; this.ring.visible = false; audio.whoosh(); this.st.done(0); } }], sec);
    this.ro = ui.readouts([{ id: 't', label: 'Time', unit: 's' }, { id: 'x', label: 'Ring from NH₃ end', unit: 'cm' }], sec);
    ui.notes();
    ui.questions([
      { q: 'In a **100 cm** tube, how far from the **ammonia** end does the ring form? (Use your result.)', ans: 59.4, tol: 0.06, unit: 'cm', e: 'Ammonia travels √(36.5/17) ≈ 1.47 times as fast, so the ring forms about 59 cm from the NH₃ end.', o: [2], sub: 'C1.2' },
      { q: 'Why does the ring form **closer to the HCl** end?', opts: ['Ammonia molecules are lighter (lower Mr), so they diffuse faster', 'Hydrogen chloride is pushed by the ammonia', 'HCl is more concentrated', 'Ammonia is a liquid'], e: 'Lower relative molecular mass → faster random motion → faster diffusion.', o: [2], sub: 'C1.2' },
      { q: 'Raising the temperature made the ring form sooner because particles…', opts: ['move faster at higher temperature', 'get lighter', 'stop colliding', 'become ions'], e: 'Diffusion is caused by random particle motion, which speeds up when heated.', o: [1], sub: 'C1.2' },
    ], { sub: 'C1.2', onDone: () => { this.st.done(2); this.checkTab('diffusion', 3); } });
    this.every((dt) => this.simDiff(dt));
  }
  simDiff(dt) {
    const d = new THREE.Object3D(), L = this.L;
    let fa = 0, fb = 0;
    if (this.running) {
      this.dt0 += dt * 22 * Math.sqrt((this.Td + 273) / 293);
      const k = 0.0175;
      fa = Math.min(1, k * Math.sqrt(this.dt0 / 17) * 10); fb = Math.min(1, k * Math.sqrt(this.dt0 / 36.5) * 10);
      if (!this.ringAt && fa + fb >= 1) {
        this.ringAt = fa / (fa + fb); this.ring.visible = true; this.ring.position.x = -L / 2 + this.ringAt * L; audio.discover();
        const cm = this.ringAt * 100; this.ro.set('x', cm.toFixed(1));
        this.ui.note(`A white ring of **ammonium chloride** appeared ${cm.toFixed(1)} cm along a 100 cm tube from the ammonia end.`, 'gold');
        this.st.done(1); this.checkTab('diffusion', 3);
      }
      if (this.ringAt) { const s = fa + fb; fa = this.ringAt * Math.min(1, s); fb = (1 - this.ringAt) * Math.min(1, s); }
      this.ro.set('t', Math.round(this.dt0));
    }
    this.seeds.forEach(([u, y, z], i) => {
      const jx = Math.sin(performance.now() * 0.004 + i) * 0.004;
      d.position.set(-L / 2 + 0.04 + u * fa * (L - 0.08) + jx, y, z); d.updateMatrix(); this.nh3.setMatrixAt(i, d.matrix);
      d.position.set(L / 2 - 0.04 - u * fb * (L - 0.08) - jx, -y, z); d.updateMatrix(); this.hcl.setMatrixAt(i, d.matrix);
    });
    this.nh3.instanceMatrix.needsUpdate = true; this.hcl.instanceMatrix.needsUpdate = true;
    this.nh3.visible = this.hcl.visible = this.running;
  }
  checkTab() { this.st.check(); }
}
