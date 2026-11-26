import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { Puffs, mesh, mat, M } from '../apparatus.js';
import { h, clear, clamp, mulberry32 } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const PLANTS = {
  coal: { name: 'Coal', icon: '🏭', mw: 60, co2: 0.95, renew: false, kind: 'base', col: '#57534e', pro: 'reliable, cheap fuel', con: 'most CO₂, SO₂ (acid rain), non-renewable' },
  gas: { name: 'Gas', icon: '🔥', mw: 50, co2: 0.45, renew: false, kind: 'flex', col: '#f59e0b', pro: 'starts quickly to meet peaks', con: 'CO₂, non-renewable' },
  nuclear: { name: 'Nuclear', icon: '⚛️', mw: 80, co2: 0, renew: false, kind: 'base', col: '#a78bfa', pro: 'large, reliable, no CO₂', con: 'radioactive waste, high cost, uranium is finite' },
  wind: { name: 'Wind', icon: '🌬️', mw: 30, co2: 0, renew: true, kind: 'wind', col: '#38bdf8', pro: 'renewable, no fuel', con: 'unreliable when calm, visual impact' },
  solar: { name: 'Solar', icon: '☀️', mw: 30, co2: 0, renew: true, kind: 'solar', col: '#facc15', pro: 'renewable, quiet', con: 'nothing at night, weather dependent' },
  hydro: { name: 'Hydroelectric', icon: '💧', mw: 40, co2: 0, renew: true, kind: 'hydro', col: '#2563eb', pro: 'renewable and can follow demand', con: 'floods valleys, needs rain and the right land' },
  geo: { name: 'Geothermal', icon: '🌋', mw: 20, co2: 0.03, renew: true, kind: 'base', col: '#ef4444', pro: 'reliable, renewable', con: 'only where hot rocks are near the surface' },
  bio: { name: 'Biofuel', icon: '🌾', mw: 25, co2: 0.1, renew: true, kind: 'base', col: '#84cc16', pro: 'renewable; crops absorb CO₂ as they grow', con: 'uses farmland, still releases some pollution' },
  tidal: { name: 'Tidal', icon: '🌊', mw: 25, co2: 0, renew: true, kind: 'tidal', col: '#14b8a6', pro: 'renewable and predictable', con: 'only twice-daily peaks, affects estuary wildlife' },
};
const KEYS = Object.keys(PLANTS);
const demand = (hr) => 112 + 45 * Math.exp(-(((hr - 8) / 2) ** 2)) + 75 * Math.exp(-(((hr - 19) / 2.5) ** 2)) - 28 * Math.exp(-(((hr - 3.5) / 3) ** 2)) - 28 * Math.exp(-(((hr - 27.5) / 3) ** 2));

export default class Grid extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Brightwater’s lights must stay on for the Festival of Light — without choking the island. Choose the power stations, run a day of demand and keep supply, emissions and renewables in balance.';
    this.view = { pos: [0, 1.5, 0.95], target: [0, 1.0, 0] };
    this.n = { coal: 2, gas: 1, nuclear: 0, wind: 0, solar: 0, hydro: 0, geo: 0, bio: 0, tidal: 0 };
    this.hv = false; this.day = null; this.seed = 7;
  }
  build() {
    const Y = this.Y;
    const base = (this.base = new THREE.Group()); this.lab.add(base, 0, Y, 0);
    base.add(mesh(new THREE.CylinderGeometry(0.3, 0.31, 0.02, 56), mat('#0c4a6e', 0.2, 0.3), 0, 0.01, 0));
    base.add(mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.03, 48), mat('#3f6212', 0, 0.9), 0, 0.03, 0));
    // city
    this.windows = [];
    const city = new THREE.Group(); city.position.set(0, 0.045, 0); base.add(city);
    const rnd = mulberry32(3);
    for (let i = 0; i < 16; i++) { const hgt = 0.02 + rnd() * 0.05, x = (rnd() - 0.5) * 0.12, z = (rnd() - 0.5) * 0.1; const b = mesh(new THREE.BoxGeometry(0.018, hgt, 0.018), mat('#cbd5e1', 0.2, 0.6), x, hgt / 2, z); city.add(b); const w = new THREE.Mesh(new THREE.PlaneGeometry(0.012, hgt * 0.8), new THREE.MeshBasicMaterial({ color: '#fde68a' })); w.position.set(x, hgt / 2, z + 0.0095); city.add(w); this.windows.push(w); }
    this.lab.label(city, 'Brightwater town', { y: 0.09 });
    // plant slots around the coast
    this.slots = {};
    KEYS.forEach((k, i) => { const a = (i / KEYS.length) * Math.PI * 2 + 0.3; const g = new THREE.Group(); g.position.set(Math.cos(a) * 0.19, 0.045, Math.sin(a) * 0.17); base.add(g); this.slots[k] = { g, a, items: [] }; const lbl = this.lab.label(g, `${PLANTS[k].icon} 0`, { y: 0.075, cls: 'dimlab' }); this.slots[k].lbl = lbl; });
    this.puffs = new Puffs({ color: '#6b7280', size: 0.02, rise: 0.05, life: 2.4, opacity: 0.4, spread: 0.02 }); this.puffs.position.copy(this.slots.coal.g.position).add(new THREE.Vector3(0, 0.07, 0)); base.add(this.puffs);
    this.sun = mesh(new THREE.SphereGeometry(0.02, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 1.2) })); base.add(this.sun);
    this.moon = mesh(new THREE.SphereGeometry(0.012, 14, 10), new THREE.MeshBasicMaterial({ color: '#e2e8f0' })); base.add(this.moon);
    this.rotors = [];
    for (const k of KEYS) this.rebuildSlot(k);

    const ui = this.ui;
    this.st = ui.steps(['Run a day with **no blackouts**', 'Reach at least **60% renewable** electricity', 'Keep CO₂ under **500 tonnes per day** — all three at once', '(S) Compare transmission at **11 kV and 132 kV**', 'Answer the analysis questions']);
    const sec = ui.section('Power stations (units)');
    this.ctl = h('div'); sec.append(this.ctl); this.drawCtl();
    ui.buttons([{ label: '▶ Run a 24-hour day', kind: 'primary', onClick: () => this.runDay() }], sec);
    this.ro = ui.readouts([{ id: 'hr', label: 'Time', unit: 'h' }, { id: 'bo', label: 'Blackout hours' }, { id: 'ren', label: 'Renewable', unit: '%' }, { id: 'co2', label: 'CO₂', unit: 't' }], sec);
    this.cv = h('canvas', { width: 680, height: 300, class: 'graph', style: { height: '160px' } }); ui.section('Supply and demand over the day').append(this.cv);
    const tx = ui.section('(S) Transmission lines');
    ui.seg({ label: 'Transmission voltage', options: [[false, '11 kV (no step-up)'], [true, '132 kV (step-up transformer)']], value: false, parent: tx, onChange: (v) => { this.hv = v === true || v === 'true'; this.txInfo(); } });
    this.txro = ui.readouts([{ id: 'I', label: 'Current for 100 MW', unit: 'A' }, { id: 'loss', label: 'Lost heating cables', unit: '%' }], tx);
    ui.notes();
    ui.questions([
      { q: '(S) Which energy resources do **not** get their energy from the Sun?', opts: ['Geothermal, nuclear and tidal', 'Wind, solar and hydroelectric', 'Coal, gas and oil', 'Biofuel and wind'], e: 'Fossil fuels, biofuels, wind, waves and hydro all trace back to sunlight.', o: [4], sub: 'P1.6.3' },
      { q: 'A big disadvantage of wind and solar power is that they…', opts: ['are not always available, so supply is unreliable', 'produce CO₂', 'use up fuel', 'are non-renewable'], e: 'They must be backed up by flexible supplies or storage.', o: [2], sub: 'P1.6.3' },
      { q: '(S) The Sun releases energy by nuclear ___; nuclear power stations use nuclear ___.', opts: ['fusion; fission', 'fission; fusion', 'combustion; fission', 'fusion; combustion'], e: 'Fusion joins light nuclei; fission splits heavy ones.', o: [5, 6], sub: 'P1.6.3' },
      { q: '(S) A power station takes in 2000 MJ of chemical energy and outputs 700 MJ of electrical energy. Efficiency?', ans: 35, tol: 0.01, unit: '%', e: '700 ÷ 2000 × 100 = {ans} %.', o: [7], sub: 'P1.6.3' },
      { q: '(S) Why is electricity transmitted at a **very high voltage**?', opts: ['For the same power the current is smaller, so much less energy is wasted heating the cables (P = I²R)', 'High voltage is safer in homes', 'It makes electricity travel faster', 'Transformers only work at high voltage'], e: 'Step-up transformers at the station; step-down transformers near homes.', o: [5, 6], sub: 'P4.5.6' },
      { q: 'Burning coal and gas in power stations releases CO₂, which…', opts: ['is a greenhouse gas contributing to climate change', 'causes the ozone hole', 'is toxic in small amounts', 'makes rain alkaline'], e: 'Coal also releases SO₂, causing acid rain.', o: [3], sub: 'C10.2' },
    ], { sub: 'P1.6.3', onDone: () => { this.st.done(4); this.check(); } });
    this.txInfo(); this.drawChart(null);
    this.every((dt, t) => this.sim(dt, t));
  }
  drawCtl() {
    clear(this.ctl);
    for (const k of KEYS) {
      const p = PLANTS[k];
      this.ctl.append(h('div', { class: 'row', style: { justifyContent: 'space-between', margin: '3px 0', padding: '3px 6px', background: 'rgba(255,255,255,.04)', borderRadius: '8px' }, title: `+ ${p.pro}\n− ${p.con}` },
        h('span', { style: { fontSize: '.86em' } }, `${p.icon} ${p.name} `, h('span', { class: 'faint' }, `${p.mw} MW${p.renew ? ' · renewable' : ''}`)),
        h('span', { class: 'row', style: { gap: '4px', alignItems: 'center' } }, h('button', { class: 'btn tiny', onClick: () => this.setN(k, this.n[k] - 1) }, '−'), h('b', { style: { minWidth: '14px', textAlign: 'center' } }, String(this.n[k])), h('button', { class: 'btn tiny', onClick: () => this.setN(k, this.n[k] + 1) }, '+'))));
    }
  }
  setN(k, v) { this.n[k] = clamp(v, 0, 3); audio.click(); this.drawCtl(); this.rebuildSlot(k); }
  rebuildSlot(k) {
    const s = this.slots[k]; s.items.forEach((o) => s.g.remove(o)); s.items = []; this.rotors = this.rotors.filter((r) => r.userData.k !== k);
    const n = this.n[k]; s.lbl.userData.set(`${PLANTS[k].icon} ${n}`);
    for (let i = 0; i < n; i++) {
      const o = new THREE.Group(); o.position.set((i - (n - 1) / 2) * 0.03, 0, 0);
      if (k === 'coal' || k === 'gas' || k === 'bio' || k === 'geo') { o.add(mesh(new THREE.BoxGeometry(0.022, 0.016, 0.018), mat(PLANTS[k].col, 0.2, 0.6), 0, 0.008, 0), mesh(new THREE.CylinderGeometry(0.003, 0.004, k === 'coal' ? 0.05 : 0.035, 8), M.steel, 0.006, k === 'coal' ? 0.025 : 0.018, 0)); }
      else if (k === 'nuclear') { o.add(mesh(new THREE.SphereGeometry(0.012, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e2e8f0', 0.2, 0.4)), mesh(new THREE.CylinderGeometry(0.009, 0.013, 0.035, 14, 1, true), mat('#cbd5e1', 0, 0.7, { side: THREE.DoubleSide }), 0.018, 0.0175, 0)); }
      else if (k === 'wind') { o.add(mesh(new THREE.CylinderGeometry(0.0012, 0.0016, 0.06, 6), mat('#f8fafc'), 0, 0.03, 0)); const hub = new THREE.Group(); hub.position.y = 0.06; for (let b = 0; b < 3; b++) { const bl = mesh(new THREE.BoxGeometry(0.0025, 0.025, 0.001), mat('#f8fafc')); bl.geometry.translate(0, 0.0125, 0); bl.rotation.z = (b / 3) * Math.PI * 2; hub.add(bl); } o.add(hub); hub.userData.k = k; this.rotors.push(hub); }
      else if (k === 'solar') { for (let j = 0; j < 4; j++) { const p = mesh(new THREE.BoxGeometry(0.012, 0.001, 0.008), mat('#1e3a8a', 0.6, 0.2), (j % 2) * 0.014 - 0.007, 0.006, Math.floor(j / 2) * 0.01 - 0.005); p.rotation.x = -0.5; o.add(p); } }
      else if (k === 'hydro') { o.add(mesh(new THREE.BoxGeometry(0.026, 0.024, 0.006), mat('#94a3b8', 0.1, 0.7), 0, 0.012, 0), mesh(new THREE.BoxGeometry(0.024, 0.016, 0.02), mat('#2563eb', 0.1, 0.2, { transparent: true, opacity: 0.8 }), 0, 0.009, -0.013)); }
      else if (k === 'tidal') { o.add(mesh(new THREE.BoxGeometry(0.03, 0.008, 0.008), mat('#64748b', 0.3, 0.5), 0, 0.002, 0)); }
      s.g.add(o); s.items.push(o);
    }
  }
  output(k, hr, rnd) {
    const p = PLANTS[k], n = this.n[k], cap = p.mw * n; if (!n) return 0;
    if (p.kind === 'base') return cap;
    if (p.kind === 'solar') return cap * Math.max(0, Math.sin(((hr - 6) / 12) * Math.PI)) ** 1.2;
    if (p.kind === 'wind') return cap * clamp(0.45 + 0.4 * Math.sin(hr * 0.55 + 1.3) + 0.25 * Math.sin(hr * 1.7) + (rnd() - 0.5) * 0.2, 0.02, 1);
    if (p.kind === 'tidal') return cap * Math.max(0, Math.sin((hr / 12.4) * Math.PI * 2));
    return 0;
  }
  runDay() {
    const rnd = mulberry32(this.seed++);
    const hours = [];
    let blackout = 0, co2 = 0, ren = 0, tot = 0, hydroLeft = 160 * this.n.hydro;
    for (let hr = 0; hr < 24; hr++) {
      const D = demand(hr + 0.5), row = { hr, D, parts: {} };
      let sup = 0;
      for (const k of KEYS) { const p = PLANTS[k]; if (p.kind === 'flex' || p.kind === 'hydro') continue; const o = this.output(k, hr + 0.5, rnd); row.parts[k] = o; sup += o; }
      let gap = Math.max(0, D - sup);
      const hy = Math.min(gap, 40 * this.n.hydro, hydroLeft); row.parts.hydro = hy; hydroLeft -= hy; gap -= hy; sup += hy;
      const gs = Math.min(gap, 50 * this.n.gas); row.parts.gas = gs; gap -= gs; sup += gs;
      row.sup = sup; row.short = gap > 0.5; if (row.short) blackout++;
      const used = Math.min(sup, D);
      const scale = sup > 0 ? used / sup : 0;
      for (const k of KEYS) { const e = (row.parts[k] || 0) * scale; tot += e; co2 += e * PLANTS[k].co2; if (PLANTS[k].renew) ren += e; }
      hours.push(row);
    }
    this.day = { hours, blackout, co2, ren: tot ? (100 * ren) / tot : 0, t: 0 };
    audio.whoosh?.();
  }
  txInfo() {
    const V = this.hv ? 132000 : 11000, I = 100e6 / V, loss = (I * I * 0.2) / 100e6 * 100;
    this.txro.set('I', I.toFixed(0)); this.txro.set('loss', loss.toFixed(2));
    this.lossSeen = this.lossSeen || new Set(); this.lossSeen.add(this.hv);
    if (this.lossSeen.size === 2 && !this.st.isDone(3)) { this.st.done(3); this.ui.note('Stepping up 11 kV → 132 kV cuts the current 12 times, so heating losses (I²R) fall about **144 times**. Step-down transformers then bring the voltage down safely for homes.', 'gold'); this.check(); }
  }
  sim(dt, t) {
    const d = this.day;
    const hr = d ? Math.min(24, d.t) : 12;
    const a = ((hr - 6) / 24) * Math.PI * 2;
    this.sun.position.set(Math.cos(a) * 0.32, 0.03 + Math.sin(a) * 0.25, -0.05); this.sun.visible = Math.sin(a) > -0.1;
    this.moon.position.set(-Math.cos(a) * 0.32, 0.03 - Math.sin(a) * 0.25, -0.05); this.moon.visible = Math.sin(a) < 0.1;
    this.rotors.forEach((r) => { r.rotation.z += dt * 4; });
    this.puffs.setRate(this.n.coal ? 2 * this.n.coal : 0); this.puffs.update(dt);
    if (!d) return;
    d.t += dt * 2.4;
    const i = Math.min(23, Math.floor(d.t)); const row = d.hours[i];
    const dark = row.short;
    this.windows.forEach((w, k) => w.material.color.set(dark && k % 3 !== 0 ? '#111827' : (Math.sin(a) < 0 ? '#fde68a' : '#94a3b8')));
    this.ro.set('hr', Math.floor(hr)); this.ro.set('bo', d.hours.slice(0, i + 1).filter((r) => r.short).length);
    this.drawChart(d, d.t);
    if (d.t >= 24 && !d.done) {
      d.done = true;
      this.ro.set('ren', d.ren.toFixed(0)); this.ro.set('co2', d.co2.toFixed(0));
      const okB = d.blackout === 0, okR = d.ren >= 60, okC = d.co2 <= 500;
      this.ui.note(`Day complete: **${d.blackout}** blackout hour${d.blackout === 1 ? '' : 's'}, **${d.ren.toFixed(0)}%** renewable, **${d.co2.toFixed(0)} t** CO₂.`, okB && okR && okC ? 'gold' : '');
      if (okB) this.st.done(0); if (okR) this.st.done(1);
      if (okB && okR && okC) { this.st.done(2); audio.complete?.(); this.ui.note('All three targets met at once — a balanced, low-carbon grid with enough flexible supply for the evening peak.', 'gold'); }
      else if (!okB) this.ui.note('Blackouts happen when supply < demand — usually at the **evening peak** or when the wind drops. Add flexible (gas, hydro) or reliable (geothermal, nuclear) supply.', 'warn');
      this.check();
    }
  }
  drawChart(d, upTo = 24) {
    const c = this.cv, ctx = c.getContext('2d'), W = c.width, H = c.height; ctx.clearRect(0, 0, W, H);
    const L = 50, B = 30, maxMW = 260, px = (hr) => L + (hr / 24) * (W - L - 10), py = (mw) => H - B - (mw / maxMW) * (H - B - 12);
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.moveTo(L, 8); ctx.lineTo(L, H - B); ctx.lineTo(W - 8, H - B); ctx.stroke();
    ctx.fillStyle = '#cbd5e1'; ctx.font = '16px Inter'; for (let hr = 0; hr <= 24; hr += 6) ctx.fillText(`${hr}h`, px(hr) - 10, H - 8); for (let mw = 0; mw <= 250; mw += 50) ctx.fillText(String(mw), 8, py(mw) + 5);
    if (d) {
      const n = Math.min(24, Math.ceil(upTo));
      for (let i = 0; i < n; i++) { let acc = 0; const r = d.hours[i]; for (const k of KEYS) { const v = r.parts[k] || 0; if (!v) continue; ctx.fillStyle = PLANTS[k].col; ctx.fillRect(px(i), py(acc + v), px(i + 1) - px(i) + 0.5, py(acc) - py(acc + v)); acc += v; } if (r.short) { ctx.fillStyle = 'rgba(239,68,68,.35)'; ctx.fillRect(px(i), 8, px(i + 1) - px(i), H - B - 8); } }
    }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.setLineDash([8, 5]); ctx.beginPath(); for (let hr = 0; hr <= 24; hr += 0.25) { const y = py(demand(hr)); if (hr === 0) ctx.moveTo(px(hr), y); else ctx.lineTo(px(hr), y); } ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#fff'; ctx.fillText('demand', W - 90, 24);
  }
  check() { if ([0, 1, 2, 3, 4].every((i) => this.st.isDone(i))) this.lab.complete(); }
}
