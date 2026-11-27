import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { Puffs, Thermometer, Lamp, mesh, mat, glassMaterial } from '../apparatus.js';
import { h, clamp } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const SOURCES = [
  ['CO₂', 'Burning fossil fuels (complete combustion)'],
  ['CO', 'Incomplete combustion of carbon-containing fuels'],
  ['Particulates (soot)', 'Incomplete combustion, e.g. diesel engines'],
  ['Methane', 'Livestock and decomposing waste in landfill'],
  ['Oxides of nitrogen', 'Nitrogen and oxygen reacting in hot car engines'],
  ['SO₂', 'Burning fossil fuels that contain sulfur'],
];

export default class Climate extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Smog from the old flare stack hangs over Brightwater and the reef is bleaching. Run the island’s atmosphere, find what each pollutant does — then fix it.';
    this.view = { pos: [0.02, 1.42, 0.95], target: [0.02, 1.08, 0] };
    this.v = { coal: 60, cars: 60, farm: 50, defor: 40, cat: false, fgd: false, renew: false, trees: false, capture: false };
    this.flags = { air: false, sources: false, crisis: false, fixed: false }; this.warned = new Set();
  }
  model() {
    const v = this.v, k = (x) => x / 100;
    const co2 = 280 + 240 * (k(v.coal) * 0.45 + k(v.cars) * 0.35 + k(v.defor) * 0.3) * (v.renew ? 0.45 : 1) - (v.trees ? 25 : 0);
    const ch4 = 700 + 2400 * k(v.farm) * (v.capture ? 0.5 : 1);
    const warm = 1.8 * Math.log2(Math.max(co2, 200) / 280) + 0.2 * (ch4 - 700) / 1200;
    const so2 = v.coal * (v.fgd ? 0.15 : 1) * (v.renew ? 0.5 : 1);
    const nox = v.cars * (v.cat ? 0.2 : 1) * (v.renew ? 0.6 : 1) + 0.3 * v.coal * (v.renew ? 0.5 : 1);
    const co = v.cars * (v.cat ? 0.15 : 1) * (v.renew ? 0.6 : 1);
    const pm = (0.5 * v.coal * (v.fgd ? 0.5 : 1) * (v.renew ? 0.5 : 1) + 0.5 * v.cars * (v.cat ? 0.7 : 1) * (v.renew ? 0.6 : 1));
    const pH = clamp(5.6 - 1.6 * so2 / 100 - 0.5 * nox / 100, 3.6, 5.6);
    const aqi = (nox + co + pm + so2) / 4;
    return { co2, ch4, warm, so2, nox, co, pm, pH, aqi };
  }
  build() {
    const Y = this.Y;
    const base = new THREE.Group(); this.lab.add(base, 0, Y, 0); this.base = base;
    base.add(mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.02, 48), mat('#1e293b', 0.4, 0.4), 0, 0.01, 0));
    base.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.008, 48), mat('#0ea5e9', 0.1, 0.25), 0, 0.022, 0));
    this.land = mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.03, 40), mat('#4d7c0f', 0, 0.85), 0, 0.034, 0); base.add(this.land);
    const road = mesh(new THREE.TorusGeometry(0.11, 0.008, 4, 48), mat('#374151', 0, 0.8), 0, 0.05, 0); road.rotation.x = Math.PI / 2; road.scale.z = 0.3; base.add(road);
    // power station
    const ps = new THREE.Group(); ps.position.set(-0.06, 0.05, -0.05); base.add(ps);
    ps.add(mesh(new THREE.BoxGeometry(0.05, 0.03, 0.035), mat('#94a3b8', 0.3, 0.5), 0, 0.015, 0), mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.08, 10), mat('#64748b', 0.3, 0.5), 0.018, 0.04, 0));
    this.smoke = new Puffs({ color: '#6b7280', size: 0.03, rise: 0.05, life: 3, opacity: 0.5, spread: 0.006 }); this.smoke.position.set(0.018, 0.085, 0); ps.add(this.smoke);
    this.lab.label(ps, 'Coal power station', { y: 0.13, cls: 'dimlab' });
    // cars
    this.cars = []; for (let i = 0; i < 6; i++) { const c = mesh(new THREE.BoxGeometry(0.014, 0.007, 0.008), mat(['#ef4444', '#3b82f6', '#f59e0b', '#e5e7eb', '#22c55e', '#a855f7'][i], 0.4, 0.4)); base.add(c); this.cars.push(c); }
    this.exhaust = new Puffs({ color: '#9ca3af', size: 0.015, rise: 0.03, life: 1.5, opacity: 0.35, spread: 0.2 }); this.exhaust.position.set(0, 0.06, 0); base.add(this.exhaust);
    // cows + landfill
    this.cows = []; for (let i = 0; i < 4; i++) { const c = new THREE.Group(); c.add(mesh(new THREE.BoxGeometry(0.012, 0.007, 0.006), mat('#f8fafc')), mesh(new THREE.BoxGeometry(0.004, 0.005, 0.004), mat('#111827'), 0.007, 0.002, 0)); c.position.set(0.06 + (i % 2) * 0.025, 0.054, 0.04 + Math.floor(i / 2) * 0.02); base.add(c); this.cows.push(c); }
    this.lab.label(this.cows[0], 'Farm & landfill', { y: 0.04, cls: 'dimlab' });
    // forest
    this.trees = []; for (let i = 0; i < 18; i++) { const a = -2.4 + i * 0.12, r = 0.06 + (i % 3) * 0.022; const t = new THREE.Group(); t.add(mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.01, 5), mat('#78350f'), 0, 0.005, 0), mesh(new THREE.ConeGeometry(0.008, 0.024, 7), mat('#166534', 0, 0.8), 0, 0.02, 0)); t.position.set(Math.cos(a) * r, 0.049, Math.sin(a) * r); base.add(t); this.trees.push(t); }
    // wind turbines
    this.turb = []; for (let i = 0; i < 3; i++) { const t = new THREE.Group(); t.add(mesh(new THREE.CylinderGeometry(0.0015, 0.002, 0.07, 6), mat('#f1f5f9'), 0, 0.035, 0)); const hub = new THREE.Group(); hub.position.y = 0.07; for (let b = 0; b < 3; b++) { const bl = mesh(new THREE.BoxGeometry(0.003, 0.03, 0.001), mat('#f8fafc')); bl.geometry.translate(0, 0.015, 0); bl.rotation.z = (b / 3) * Math.PI * 2; hub.add(bl); } t.add(hub); t.userData.hub = hub; t.position.set(0.1 - i * 0.03, 0.05, -0.08 + i * 0.01); t.visible = false; base.add(t); this.turb.push(t); }
    // dome, haze, cloud, rain
    base.add(mesh(new THREE.SphereGeometry(0.26, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), glassMaterial('#e0f2fe', 0.03, 0.45), 0, 0.02, 0));
    this.haze = mesh(new THREE.SphereGeometry(0.25, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#a16207', transparent: true, opacity: 0, depthWrite: false, side: THREE.BackSide })); this.haze.position.y = 0.02; base.add(this.haze);
    this.cloud = new THREE.Group(); this.cloud.position.set(0.04, 0.2, 0.02); base.add(this.cloud);
    for (let i = 0; i < 5; i++) this.cloud.add(mesh(new THREE.SphereGeometry(0.022 + (i % 2) * 0.008, 12, 8), mat('#e5e7eb', 0, 1), (i - 2) * 0.022, (i % 2) * 0.01, 0));
    const N = 60; this.rain = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0007, 0.0007, 0.012, 4), new THREE.MeshBasicMaterial({ color: '#60a5fa' }), N); this.rain.frustumCulled = false; base.add(this.rain);
    this.drops = Array.from({ length: N }, () => ({ x: 0.04 + (Math.random() - 0.5) * 0.1, y: 0.05 + Math.random() * 0.14, z: 0.02 + (Math.random() - 0.5) * 0.04 }));
    this._o = new THREE.Object3D();
    this.th = new Thermometer(0.3, -1, 4); this.lab.add(this.th, 0.32, Y, 0.02); this.lab.label(this.th, 'Warming / °C', { y: 0.34 });
    this.sun = new Lamp(); this.lab.add(this.sun, -0.36, Y, -0.1); this.sun.rotation.y = 0.6; this.sun.set(0.9);
    this.lab.label(this.sun, 'Sun lamp', { y: 0.3, cls: 'dimlab' });

    const ui = this.ui;
    this.st = ui.steps(['Analyse a sample of **clean, dry air**', 'Match each pollutant to its **source**', 'Push the island into **crisis** and note the effects', 'Use strategies to hit all **three targets**', 'Answer the analysis questions']);
    const air = ui.section('Clean, dry air');
    ui.buttons([{ label: '🔍 Analyse clean air', onClick: () => this.analyseAir() }], air);
    this.pie = h('canvas', { width: 640, height: 230, class: 'graph', style: { height: '120px', display: 'none' } }); air.append(this.pie);
    const sec = ui.section('Emissions');
    const sl = (key, label) => ui.slider({ label, min: 0, max: 100, step: 5, value: this.v[key], unit: '%', parent: sec, onInput: (x) => { this.v[key] = x; this.refresh(); } });
    sl('coal', 'Coal-fired power'); sl('cars', 'Traffic (petrol & diesel)'); sl('farm', 'Livestock & landfill'); sl('defor', 'Deforestation');
    const strat = ui.section('Strategies');
    const tog = (key, label) => ui.seg({ label, options: [[false, 'Off'], [true, 'On']], value: false, parent: strat, onChange: (x) => { this.v[key] = x === true || x === 'true'; audio.click(); this.refresh(); } });
    tog('cat', 'Catalytic converters on cars (S)'); tog('fgd', 'Flue-gas desulfurisation / low-sulfur fuel (S)'); tog('renew', 'Renewable electricity & electric buses'); tog('trees', 'Plant trees'); tog('capture', 'Capture landfill methane, better cattle feed');
    this.ro = ui.readouts([{ id: 'co2', label: 'CO₂', unit: 'ppm' }, { id: 'ch4', label: 'Methane', unit: 'ppb' }, { id: 'w', label: 'Warming', unit: '°C' }, { id: 'pH', label: 'Rain pH' }, { id: 'aqi', label: 'Air quality' }, { id: 't', label: 'Targets met' }], sec);
    this.gh = h('canvas', { width: 640, height: 260, class: 'graph', style: { height: '140px' } }); ui.section('(S) Greenhouse effect').append(this.gh);
    const ms = ui.section('Where does each pollutant come from?');
    const opts = SOURCES.map((s) => s[1]).sort();
    this.srcSel = SOURCES.map(([p]) => ui.select({ label: p, options: [['', '— source —'], ...opts.map((o) => [o, o])], value: '', parent: ms }));
    ui.buttons([{ label: '✔ Check sources', kind: 'primary', onClick: () => this.checkSources() }], ms);
    ui.notes();
    ui.questions([
      { q: 'Clean, dry air is about…', opts: ['78% nitrogen, 21% oxygen, plus argon and a little CO₂', '78% oxygen, 21% nitrogen', '50% nitrogen, 50% oxygen', '21% CO₂'], e: 'Nitrogen 78%, oxygen 21%, argon ~0.9%, CO₂ ~0.04%.', o: [1], sub: 'C10.2' },
      { q: 'Carbon monoxide is dangerous because it…', opts: ['is toxic — it stops haemoglobin carrying oxygen', 'causes acid rain', 'destroys the ozone layer', 'is a greenhouse gas only'], e: 'CO binds to haemoglobin more strongly than oxygen.', o: [3], sub: 'C10.2' },
      { q: '(S) How do CO₂ and methane cause global warming?', opts: ['They absorb infrared radiation emitted by the Earth and re-emit some back towards it', 'They block sunlight from reaching Earth', 'They make the ozone hole bigger', 'They react with oxygen to release heat'], e: 'Short-wave radiation passes in; long-wave infrared from the warm surface is absorbed by greenhouse gases.', o: [6], sub: 'C10.2' },
      { q: '(S) A catalytic converter reduces NOₓ by…', opts: ['converting oxides of nitrogen into nitrogen gas', 'filtering them out', 'burning them', 'turning them into SO₂'], e: 'e.g. 2NO + 2CO → N₂ + 2CO₂ over a platinum catalyst.', o: [7], sub: 'C10.2' },
      { q: 'Sulfur dioxide is an **acidic oxide**, so it…', opts: ['dissolves in rain to make acid rain', 'neutralises acid rain', 'is a basic oxide like CaO', 'has no effect on rain'], e: 'Non-metal oxides such as SO₂ and CO₂ are acidic.', o: [1], sub: 'C7.2' },
      { q: '(S) The Earth’s average temperature depends on…', opts: ['the balance between radiation absorbed and radiation emitted', 'only the distance to the Sun', 'only the amount of oxygen', 'the speed of the wind'], e: 'More greenhouse gas → less infrared escapes → the Earth warms until a new balance is reached.', o: [3], sub: 'P2.3.3' },
    ], { sub: 'C10.2', onDone: () => { this.st.done(4); this.check(); } });
    this.refresh();
    this.every((dt, t) => this.sim(dt, t));
  }
  analyseAir() {
    this.pie.style.display = '';
    const ctx = this.pie.getContext('2d'), W = this.pie.width, H = this.pie.height;
    ctx.clearRect(0, 0, W, H);
    const parts = [['Nitrogen 78%', 78, '#60a5fa'], ['Oxygen 21%', 21, '#34d399'], ['Argon 0.9%', 0.9, '#c084fc'], ['CO₂ 0.04% + others', 0.1, '#f87171']];
    let a = -Math.PI / 2; const cx = 120, cy = H / 2, r = 95;
    for (const [, v, c] of parts) { const da = (v / 100) * Math.PI * 2; ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a, a + Math.max(da, 0.03)); ctx.fill(); a += da; }
    ctx.font = '600 24px Inter'; parts.forEach(([l, , c], i) => { ctx.fillStyle = c; ctx.fillRect(260, 40 + i * 44, 22, 22); ctx.fillStyle = '#e2e8f0'; ctx.fillText(l, 294, 59 + i * 44); });
    audio.blip(); this.st.done(0); this.check();
  }
  checkSources() {
    const wrong = SOURCES.filter(([, s], i) => this.srcSel[i].get() !== s).length;
    if (!wrong) { audio.success(); this.st.done(1); this.ui.note('All sources matched. Note how many come from **combustion** of fossil fuels.', 'gold'); }
    else { audio.fail(); this.ui.note(`${wrong} source${wrong > 1 ? 's are' : ' is'} wrong.`, 'warn'); }
    this.check();
  }
  refresh() {
    const m = this.model(); this.m = m;
    this.ro.set('co2', m.co2.toFixed(0)); this.ro.set('ch4', m.ch4.toFixed(0)); this.ro.set('w', `+${m.warm.toFixed(2)}`); this.ro.set('pH', m.pH.toFixed(1));
    const aq = m.aqi < 25 ? 'good' : m.aqi < 50 ? 'moderate' : m.aqi < 75 ? 'poor' : 'hazardous'; this.ro.set('aqi', aq);
    const t1 = m.warm < 1.5, t2 = m.pH >= 5.3, t3 = m.aqi < 25;
    this.ro.set('t', `${[t1, t2, t3].filter(Boolean).length} / 3`);
    this.th.set(m.warm);
    this.trees.forEach((t, i) => { t.visible = i < Math.round(18 * (1 - this.v.defor / 100)) + (this.v.trees ? 4 : 0); });
    this.turb.forEach((t) => { t.visible = this.v.renew; });
    this.cows.forEach((c, i) => { c.visible = i < Math.ceil(this.v.farm / 25); });
    this.smoke.setColor(this.v.fgd ? '#cbd5e1' : '#4b5563');
    this.haze.material.opacity = clamp(m.aqi / 100, 0, 0.85) * 0.5;
    this.rain.material.color.set(m.pH > 5.2 ? '#60a5fa' : m.pH > 4.5 ? '#a3e635' : '#f97316');
    this.land.material.color.set(m.pH < 4.4 ? '#6b7a2b' : '#4d7c0f');
    this.base.parent && this.drawGreenhouse(m);
    // effects
    const effect = (key, cond, text) => { if (cond && !this.warned.has(key)) { this.warned.add(key); this.ui.note(text, 'warn'); } };
    effect('acid', m.pH < 4.6, '🌧️ **Acid rain** (pH < 4.6): SO₂ and NOₓ dissolve in rain — it corrodes limestone buildings, damages trees and acidifies lakes.');
    effect('smog', m.aqi > 70, '😷 **Smog**: particulates and NOₓ cause breathing problems; particulates are linked to lung disease and cancer. CO is toxic.');
    effect('hot', m.warm > 2, '🌡️ **Global warming > 2 °C**: more extreme weather, rising sea levels, and warmer, more acidic seas that **bleach coral reefs**.');
    if ((m.pH < 4.6 || m.aqi > 70) && m.warm > 2 && !this.st.isDone(2)) { this.st.done(2); this.ui.note('Crisis reached. Now use the strategies (and lower the emissions) to fix the island.', 'gold'); }
    if (this.st.isDone(2) && t1 && t2 && t3 && !this.st.isDone(3)) { this.st.done(3); audio.complete?.(); this.ui.note('All three targets met: warming below 1.5 °C, rain pH above 5.3 and good air quality. The reef can recover!', 'gold'); }
    this.check();
  }
  drawGreenhouse(m) {
    const c = this.gh, ctx = c.getContext('2d'), W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1220'); g.addColorStop(1, '#13233b'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#166534'; ctx.fillRect(0, H - 30, W, 30);
    const dens = clamp((m.co2 - 280) / 300 + (m.ch4 - 700) / 4000, 0.05, 1);
    ctx.fillStyle = `rgba(148,163,184,${0.12 + dens * 0.35})`; ctx.fillRect(0, 60, W, 46);
    ctx.fillStyle = '#e2e8f0'; ctx.font = '600 18px Inter'; ctx.fillText('greenhouse gases (CO₂, CH₄)', 14, 88);
    const arrow = (x1, y1, x2, y2, col, w = 4, dash = []) => { ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]); const a = Math.atan2(y2 - y1, x2 - x1); ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 12 * Math.cos(a - 0.4), y2 - 12 * Math.sin(a - 0.4)); ctx.lineTo(x2 - 12 * Math.cos(a + 0.4), y2 - 12 * Math.sin(a + 0.4)); ctx.fill(); };
    arrow(60, 6, 150, H - 34, '#fde047', 5); ctx.fillStyle = '#fde047'; ctx.fillText('sunlight (short wavelength)', 160, 30);
    const nTrap = Math.round(1 + dens * 4);
    for (let i = 0; i < 5; i++) { const x = 260 + i * 70; if (i < nTrap) { arrow(x, H - 34, x + 18, 100, '#f87171', 3); arrow(x + 18, 100, x + 36, H - 34, '#fb923c', 3, [6, 4]); } else arrow(x, H - 34, x + 30, 10, '#f87171', 3); }
    ctx.fillStyle = '#fca5a5'; ctx.fillText('infrared (long wavelength) from the warm ground', 250, H - 40 > 140 ? 140 : H - 40);
  }
  sim(dt, t) {
    const m = this.m; if (!m) return;
    this.smoke.setRate(this.v.coal / 100 * 4 * (this.v.renew ? 0.5 : 1)); this.smoke.update(dt);
    this.exhaust.setRate(this.v.cars / 100 * 3 * (this.v.cat ? 0.4 : 1)); this.exhaust.update(dt);
    const nCars = Math.ceil(this.v.cars / 17);
    this.cars.forEach((c, i) => { c.visible = i < nCars; const a = t * 0.6 + i * 1.05; c.position.set(Math.cos(a) * 0.11, 0.054, Math.sin(a) * 0.11 * 0.3); c.rotation.y = -a; });
    this.turb.forEach((tb, i) => { tb.userData.hub.rotation.z += dt * (3 + i); });
    const o = this._o;
    this.drops.forEach((d, i) => { d.y -= dt * 0.12; if (d.y < 0.05) d.y = 0.19; o.position.set(d.x, d.y, d.z); o.updateMatrix(); this.rain.setMatrixAt(i, o.matrix); });
    this.rain.instanceMatrix.needsUpdate = true;
  }
  check() { this.st.check(); }
}
