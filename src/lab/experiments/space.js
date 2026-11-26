import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { mesh, mat } from '../apparatus.js';
import { h, clamp, canvasTex } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const PLANETS = [
  { id: 'mercury', name: 'Mercury', au: 0.39, days: 88, temp: '167 °C (−173 to 427)', g: 3.7, moons: 0, col: '#a8a29e', r: 0.006 },
  { id: 'venus', name: 'Venus', au: 0.72, days: 225, temp: '464 °C', g: 8.9, moons: 0, col: '#fde68a', r: 0.009 },
  { id: 'earth', name: 'Earth', au: 1.0, days: 365.25, temp: '15 °C', g: 9.8, moons: 1, col: '#3b82f6', r: 0.0095 },
  { id: 'mars', name: 'Mars', au: 1.52, days: 687, temp: '−65 °C', g: 3.7, moons: 2, col: '#ef4444', r: 0.0075 },
  { id: 'jupiter', name: 'Jupiter', au: 5.2, days: 4333, temp: '−110 °C', g: 23.1, moons: 95, col: '#d6a76c', r: 0.02 },
  { id: 'saturn', name: 'Saturn', au: 9.54, days: 10759, temp: '−140 °C', g: 9.0, moons: 146, col: '#facc15', r: 0.017, ring: true },
  { id: 'uranus', name: 'Uranus', au: 19.2, days: 30687, temp: '−195 °C', g: 8.7, moons: 28, col: '#67e8f9', r: 0.013 },
  { id: 'neptune', name: 'Neptune', au: 30.1, days: 60190, temp: '−200 °C', g: 11.0, moons: 16, col: '#2563eb', r: 0.0125 },
];
const AU = 1.5e11, C = 3e8;
const rv = (au) => 0.06 + 0.06 * Math.sqrt(au);

export default class Space extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'The observatory’s stargazing night is the festival finale. Build the Solar System model for visitors — and work out how long sunlight takes to reach each world.';
    this.view = { pos: [0, 1.5, 0.72], target: [0, 0.96, 0] };
    this.speed = 20; this.days = 0; this.order = []; this.sel = null; this.cometSeen = { fast: false, slow: false };
  }
  build() {
    const Y = this.Y;
    const base = mesh(new THREE.CylinderGeometry(0.42, 0.43, 0.012, 64), mat('#0b1020', 0.4, 0.4)); this.lab.add(base, 0, Y + 0.006, 0);
    const sys = (this.sys = new THREE.Group()); this.lab.add(sys, 0, Y + 0.05, 0);
    this.sun = mesh(new THREE.SphereGeometry(0.032, 32, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 0.8) })); sys.add(this.sun);
    const sl = new THREE.PointLight('#fff1c1', 1.6, 1.2, 1.5); sys.add(sl);
    this.lab.interactive(this.sun, { tip: 'The Sun — click for facts', onClick: () => this.info(null) });
    this.pl = PLANETS.map((p) => {
      const r = rv(p.au);
      const orbit = new THREE.Mesh(new THREE.RingGeometry(r - 0.0006, r + 0.0006, 128), new THREE.MeshBasicMaterial({ color: '#475569', side: THREE.DoubleSide, transparent: true, opacity: 0.6 })); orbit.rotation.x = -Math.PI / 2; sys.add(orbit);
      const g = new THREE.Group(); sys.add(g);
      const ball = mesh(new THREE.SphereGeometry(p.r, 24, 16), new THREE.MeshStandardMaterial({ color: p.col, roughness: 0.7, emissive: new THREE.Color(p.col).multiplyScalar(0.15) })); g.add(ball);
      if (p.ring) { const ring = new THREE.Mesh(new THREE.RingGeometry(p.r * 1.4, p.r * 2.2, 40), new THREE.MeshBasicMaterial({ color: '#fde68a', side: THREE.DoubleSide, transparent: true, opacity: 0.7 })); ring.rotation.x = -Math.PI / 2 + 0.4; g.add(ring); }
      const lbl = this.lab.label(g, p.name, { y: p.r + 0.012, cls: 'dimlab' });
      this.lab.interactive(ball, { tip: `${p.name} — click to select`, onClick: () => this.pick(p) });
      const phase = Math.random() * Math.PI * 2;
      return { p, g, r, phase, lbl };
    });
    // Moon
    this.moon = mesh(new THREE.SphereGeometry(0.0035, 12, 8), mat('#e5e7eb')); this.pl[2].g.add(this.moon);
    // asteroid belt
    const N = 360, belt = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.0016), mat('#78716c'), N); const o = new THREE.Object3D();
    for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, r = rv(2.2) + Math.random() * (rv(3.3) - rv(2.2)); o.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 0.006, Math.sin(a) * r); o.updateMatrix(); belt.setMatrixAt(i, o.matrix); }
    sys.add(belt); this.belt = belt;
    // comet
    this.comet = new THREE.Group(); sys.add(this.comet);
    this.comet.add(mesh(new THREE.SphereGeometry(0.004, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 2.2, 2.6) })));
    this.tail = mesh(new THREE.ConeGeometry(0.006, 0.06, 12, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.2, 2.2), transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); this.comet.add(this.tail);
    this.cometLbl = this.lab.label(this.comet, 'Comet', { y: 0.02, cls: 'dimlab' });
    const ui = this.ui;
    this.st = ui.steps(['Click the planets **in order** from the Sun', 'Calculate how long **sunlight takes to reach Earth**', '(S) Calculate Earth’s **orbital speed**', '(S) Watch the **comet**: where does it move fastest?', 'Answer the analysis questions']);
    const sec = ui.section('Orrery');
    ui.slider({ label: 'Time speed', min: 1, max: 400, step: 1, value: this.speed, unit: 'days/s', parent: sec, onInput: (v) => { this.speed = v; } });
    this.ro = ui.readouts([{ id: 'd', label: 'Days passed' }, { id: 'o', label: 'Order so far' }, { id: 'cv', label: 'Comet speed' }], sec);
    this.infoBox = h('div', { class: 'muted', style: { fontSize: '.88em', lineHeight: 1.55, minHeight: '70px' } }, 'Click the Sun or a planet.'); sec.append(this.infoBox);
    ui.notes();
    this.qs = ui.questions([
      { q: 'The Sun is 1.5 × 10¹¹ m from Earth and light travels at 3.0 × 10⁸ m/s. How many **seconds** does sunlight take to reach us?', ans: 500, tol: 0.01, unit: 's', e: 't = d ÷ v = {ans} s — just over 8 minutes. We always see the Sun as it was 8 minutes ago.', o: [2], sub: 'P6.2.1' },
      { q: '(S) Earth orbits at r = 1.5 × 10¹¹ m once every 365 days (3.15 × 10⁷ s). Orbital speed v = 2πr ÷ T, in **km/s**?', ans: 29.9, tol: 0.03, unit: 'km/s', e: 'v = 2π × 1.5 × 10¹¹ ÷ 3.15 × 10⁷ ≈ {ans} km/s.', o: [6], sub: 'P6.2.1' },
      { q: 'What keeps the planets in orbit around the Sun?', opts: ['The gravitational attraction of the Sun, which has most of the Solar System’s mass', 'Magnetism', 'Their own rockets', 'The solar wind'], e: 'Gravity provides the force towards the centre.', o: [3, 4], sub: 'P6.2.1' },
      { q: 'A **light-year** is…', opts: ['the distance light travels in one year', 'the time light takes to cross the Solar System', 'one year on a planet near a star', 'the brightness of a star'], e: 'About 9.5 × 10¹⁵ m. The next nearest star is about 4.2 light-years away.', o: [1], sub: 'P6.2.1' },
      { q: 'Which list is in order from the Sun?', opts: ['Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune', 'Mercury, Venus, Mars, Earth, Jupiter, Saturn, Neptune, Uranus', 'Venus, Mercury, Earth, Mars, Saturn, Jupiter, Uranus, Neptune', 'Earth, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune'], e: '“My Very Easy Method Just Speeds Up Naming.” Minor planets (like Pluto), moons, asteroids and comets also orbit.', o: [1], sub: 'P6.1' },
    ], { sub: 'P6.2.1', onDone: () => { this.st.done(4); this.check(); } });
    this.every((dt) => this.sim(dt));
  }
  pick(p) {
    this.info(p);
    if (this.st.isDone(0)) return;
    const next = PLANETS[this.order.length];
    if (p.id === next.id) { this.order.push(p.id); audio.blip(); this.pl.find((x) => x.p === p).lbl.userData.el.classList.add('hot'); if (this.order.length === 8) { this.st.done(0); audio.success(); this.ui.note('All eight in order! The four small rocky planets are close to the Sun; the four giants are far out — with the asteroid belt in between.', 'gold'); this.check(); } }
    else { audio.fail(); this.ui.note(`Not ${p.name} yet — which planet comes after ${this.order.length ? PLANETS[this.order.length - 1].name : 'the Sun'}?`, 'warn'); this.order = []; this.pl.forEach((x) => x.lbl.userData.el.classList.remove('hot')); }
    this.ro.set('o', `${this.order.length} / 8`);
  }
  info(p) {
    if (!p) { this.infoBox.innerHTML = '<b style="color:#fff">The Sun</b> — our closest star: a **medium-sized** star made mostly of **hydrogen and helium**. It contains over 99.8% of the Solar System’s mass. It emits **infrared, visible light and ultraviolet**. (S) It is powered by **nuclear fusion** of hydrogen into helium.'.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); audio.discover(); return; }
    const d = p.au * AU, t = d / C;
    this.infoBox.innerHTML = `<b style="color:#fff">${p.name}</b> · ${p.au} AU (${(d / 1e9).toFixed(0)} million km)<br>Year: ${p.days > 1000 ? (p.days / 365.25).toFixed(1) + ' Earth years' : p.days + ' days'} · Surface: ${p.temp}<br>g = ${p.g} N/kg · Moons: ${p.moons}<br>Sunlight takes <b>${t > 3600 ? (t / 3600).toFixed(1) + ' hours' : (t / 60).toFixed(1) + ' minutes'}</b> to arrive.`;
  }
  kepler(M, e) { let E = M; for (let i = 0; i < 8; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; }
  sim(dt) {
    this.days += dt * this.speed; this.ro.set('d', this.days.toFixed(0));
    for (const x of this.pl) { const a = x.phase + (2 * Math.PI * this.days) / x.p.days; x.g.position.set(Math.cos(a) * x.r, 0, -Math.sin(a) * x.r); x.g.rotation.y += dt * 0.5; }
    const ma = (2 * Math.PI * this.days) / 27.3; this.moon.position.set(Math.cos(ma) * 0.016, 0, -Math.sin(ma) * 0.016);
    this.belt.rotation.y += dt * this.speed * 0.00004;
    // comet: a = 0.22 (vis), e = 0.82, period 6 years (vis)
    const e = 0.82, A = 0.22, T = 6 * 365.25, M = (2 * Math.PI * this.days) / T, E = this.kepler(M % (2 * Math.PI), e);
    const x = A * (Math.cos(E) - e), z = A * Math.sqrt(1 - e * e) * Math.sin(E), r = Math.hypot(x, z);
    this.comet.position.set(x * Math.cos(0.6) - z * Math.sin(0.6), 0.004, x * Math.sin(0.6) + z * Math.cos(0.6));
    const away = this.comet.position.clone().normalize(); this.tail.position.copy(away.clone().multiplyScalar(0.03)); this.tail.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), away.clone().negate());
    this.tail.scale.setScalar(clamp(0.05 / r, 0.3, 1.6));
    const v = Math.sqrt(2 / r - 1 / A); // vis-viva, relative units
    this.ro.set('cv', v > 3 ? 'very fast (near the Sun)' : v < 1 ? 'slow (far from the Sun)' : 'medium');
    if (v > 3) this.cometSeen.fast = true; if (v < 1) this.cometSeen.slow = true;
    if (this.cometSeen.fast && this.cometSeen.slow && !this.st.isDone(3)) { this.st.done(3); this.ui.note('The comet races round close to the Sun and crawls far away: **orbital speed is greater closer to the Sun**, where the gravitational field is stronger.', 'gold'); this.check(); }
    const bx = this.qs?.querySelectorAll('.aq');
    if (bx?.[0]?.classList.contains('solved') && !this.st.isDone(1)) { this.st.done(1); this.check(); }
    if (bx?.[1]?.classList.contains('solved') && !this.st.isDone(2)) { this.st.done(2); this.check(); }
  }
  check() { if ([0, 1, 2, 3, 4].every((i) => this.st.isDone(i))) this.lab.complete(); }
}
void canvasTex;
