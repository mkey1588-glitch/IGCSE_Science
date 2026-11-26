import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { ruler, mesh, mat, M } from '../apparatus.js';
import { h, clamp } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const NX = 192, NY = 128, W = 0.48, D = 0.32, DX = W / NX; // lab units = metres
const C_DEEP = 0.25, C_SHALLOW = 0.14;

export default class Waves extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'The harbour wall should calm the waves where the festival boats moor. Use a ripple tank to see how waves reflect, refract and diffract — exactly what the harbour engineers model.';
    this.view = { pos: [0, 1.52, 0.72], target: [0, 0.94, 0.0] };
    this.f = 4; this.src = 'line'; this.scene = 'open'; this.gap = 0.03; this.frozen = false; this.t = 0;
    this.seen = new Set(); this.gaps = new Set();
  }
  build() {
    const Y = this.Y;
    const tank = new THREE.Group(); this.lab.add(tank, 0, Y, 0); this.tank = tank;
    tank.add(mesh(new THREE.BoxGeometry(W + 0.04, 0.03, D + 0.04), mat('#334155', 0.2, 0.6), 0, 0.015, 0));
    tank.add(mesh(new THREE.BoxGeometry(W + 0.02, 0.002, D + 0.02), mat('#e2e8f0', 0, 0.9), 0, 0.031, 0));
    // simulation buffers
    this.u = new Float32Array(NX * NY); this.u0 = new Float32Array(NX * NY); this.c2 = new Float32Array(NX * NY); this.wall = new Uint8Array(NX * NY); this.sponge = new Float32Array(NX * NY);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const e = Math.min(NX - 1 - i, j, NY - 1 - j); this.sponge[j * NX + i] = e < 14 ? (14 - e) / 14 * 0.06 : 0; }
    this.tex = new THREE.DataTexture(this.u, NX, NY, THREE.RedFormat, THREE.FloatType); this.tex.magFilter = THREE.NearestFilter; this.tex.minFilter = THREE.NearestFilter; this.tex.needsUpdate = true;
    this.wallTex = new THREE.DataTexture(new Uint8Array(NX * NY * 4), NX, NY, THREE.RGBAFormat); this.wallTex.needsUpdate = true;
    const geo = new THREE.PlaneGeometry(W, D, NX - 1, NY - 1); geo.rotateX(-Math.PI / 2);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: this.tex }, uWall: { value: this.wallTex }, uTexel: { value: new THREE.Vector2(1 / NX, 1 / NY) }, uAmp: { value: 0.006 } },
      vertexShader: /* glsl */`
        uniform sampler2D uTex; uniform float uAmp; varying vec2 vUv;
        void main() { vUv = uv; vec3 p = position; p.y += texture2D(uTex, vec2(uv.x, 1.0 - uv.y)).r * uAmp; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uTex; uniform sampler2D uWall; uniform vec2 uTexel; varying vec2 vUv;
        void main() {
          vec2 q = vec2(vUv.x, 1.0 - vUv.y);
          float c = texture2D(uTex, q).r, l = texture2D(uTex, q - vec2(uTexel.x, 0.)).r, r = texture2D(uTex, q + vec2(uTexel.x, 0.)).r;
          float d = texture2D(uTex, q - vec2(0., uTexel.y)).r, u = texture2D(uTex, q + vec2(0., uTexel.y)).r;
          float lap = (l + r + u + d - 4.0 * c);
          vec3 n = normalize(vec3((l - r) * 4.0, 1.0, (d - u) * 4.0));
          float diff = clamp(dot(n, normalize(vec3(0.4, 1.0, 0.3))), 0.0, 1.0);
          vec3 base = mix(vec3(0.05, 0.22, 0.36), vec3(0.62, 0.86, 1.0), clamp(0.5 + c * 0.9, 0.0, 1.0));
          base += vec3(0.9, 0.95, 1.0) * clamp(-lap * 2.2, 0.0, 0.6);
          vec4 w = texture2D(uWall, q);
          vec3 col = mix(base * (0.55 + 0.6 * diff), w.rgb, w.a);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.water = new THREE.Mesh(geo, this.mat); this.water.position.y = 0.04; tank.add(this.water);
    this.dipper = mesh(new THREE.BoxGeometry(0.008, 0.012, D * 0.9), mat('#94a3b8', 0.6, 0.3), -W / 2 + 0.012, 0.05, 0); tank.add(this.dipper);
    this.ball = mesh(new THREE.SphereGeometry(0.006, 12, 10), mat('#94a3b8', 0.6, 0.3), -W / 2 + 0.03, 0.045, 0); tank.add(this.ball);
    this.cork = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.006, 12), mat('#d6a76c', 0, 0.9), -0.02, 0.045, -0.1); tank.add(this.cork);
    this.lab.label(this.cork, 'cork', { y: 0.02, cls: 'dimlab' });
    this.plate = mesh(new THREE.BoxGeometry(0.2, 0.004, D * 0.98), new THREE.MeshPhysicalMaterial({ color: '#e0f2fe', transparent: true, opacity: 0.15, roughness: 0.05 }), 0.13, 0.036, 0); this.plate.visible = false; tank.add(this.plate);
    this.rl = ruler(0.3); this.rl.rotation.x = 0; this.lab.add(this.rl, 0.02, Y + 0.046, D / 2 + 0.03); this.rl.visible = true;
    this.lab.label(tank, 'Ripple tank (seen from above)', { y: 0.09, x: -0.18 });
    const ui = this.ui;
    this.st = ui.steps(['Make straight waves, **freeze** them and measure the wavelength', 'Show **reflection** from a barrier', 'Show **refraction** as waves enter shallow water', '(S) Show **diffraction** through a narrow and a wide gap', 'Answer the analysis questions']);
    const sec = ui.section('Wave generator');
    ui.seg({ label: 'Dipper', options: [['line', 'Straight bar (plane waves)'], ['point', 'Ball (circular waves)']], value: 'line', parent: sec, onChange: (v) => { this.src = v; this.reset(); } });
    ui.slider({ label: 'Frequency', min: 2, max: 8, step: 1, value: this.f, unit: 'Hz', parent: sec, onInput: (v) => { this.f = v; this.reset(); } });
    ui.seg({ label: 'In the tank', options: [['open', 'Nothing'], ['reflect', 'Angled barrier'], ['refract', 'Shallow region'], ['diffract', 'Wall with gap']], value: 'open', parent: sec, onChange: (v) => { this.scene = v; this.setup(); } });
    this.gapSl = ui.slider({ label: 'Gap width', min: 1, max: 12, step: 1, value: 3, unit: 'cm', parent: sec, onInput: (v) => { this.gap = v / 100; if (this.scene === 'diffract') this.setup(); } });
    ui.buttons([{ label: '❄️ Freeze (strobe)', kind: 'primary', onClick: () => this.freeze() }, { label: '⟲ Restart waves', onClick: () => this.reset() }], sec);
    this.ro = ui.readouts([{ id: 'f', label: 'Frequency', unit: 'Hz' }, { id: 'l', label: 'Wavelength (deep)', unit: 'cm' }, { id: 'v', label: 'Wave speed' }], sec);
    ui.notes();
    this.qs = ui.questions([
      { q: 'With the waves frozen, measure across several waves with the ruler. Using v = f λ, what is the wave speed in the deep water?', ans: () => (this.measured ? C_DEEP * 100 : null), tol: 0.06, unit: 'cm/s', e: 'v = f × λ = {ans} cm/s. Measuring across several wavelengths makes λ more accurate.', o: [5] },
      { q: 'When waves pass into **shallow** water…', opts: ['they slow down, their wavelength gets shorter and they change direction', 'their frequency changes', 'they speed up', 'nothing happens'], e: 'Refraction is caused by the change in speed. Frequency stays the same.', o: [4] },
      { q: '(S) Waves spread out most when passing through a gap that is…', opts: ['about the same size as the wavelength', 'much wider than the wavelength', 'any size — it makes no difference', 'blocked'], e: 'That is diffraction — why harbour mouths are narrow and why you hear around corners.', o: [8, 9] },
      { q: 'The cork bobs up and down but does not travel with the waves. This shows waves…', opts: ['transfer energy without transferring matter', 'transfer water across the tank', 'have no energy', 'are longitudinal'], e: 'The water particles oscillate about fixed positions.', o: [1] },
      { q: '(S) Water waves are **transverse** because…', opts: ['the vibration is at right angles to the direction the wave travels', 'the vibration is along the direction of travel', 'they need a medium', 'they reflect'], e: 'Sound in air is longitudinal: vibrations parallel to travel.', o: [6, 7] },
    ], { sub: 'P3.1', onDone: () => { this.st.done(4); this.check(); } });
    this.setup();
    this.every((dt) => this.sim(dt));
  }
  reset() { this.u.fill(0); this.u0.fill(0); this.t = 0; this.frozen = false; this.ro.set('f', this.f); this.ro.set('l', '—'); this.ro.set('v', '—'); this.dipper.visible = this.src === 'line'; this.ball.visible = this.src === 'point'; }
  setup() {
    this.wall.fill(0); const wpx = this.wallTex.image.data; wpx.fill(0);
    const setWall = (i, j) => { if (i < 0 || j < 0 || i >= NX || j >= NY) return; const k = j * NX + i; this.wall[k] = 1; wpx[k * 4] = 60; wpx[k * 4 + 1] = 65; wpx[k * 4 + 2] = 80; wpx[k * 4 + 3] = 255; };
    for (let k = 0; k < NX * NY; k++) this.c2[k] = C_DEEP * C_DEEP;
    this.plate.visible = false;
    if (this.scene === 'reflect') { for (let t = 0; t < 120; t++) { const i = Math.round(NX * 0.62 + t * 0.5), j = Math.round(NY * 0.05 + t * 0.75); for (let w = 0; w < 3; w++) setWall(i + w, j); } }
    if (this.scene === 'refract') { this.plate.visible = true; for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { if (i > NX * 0.5 + (j - NY / 2) * 0.55) { const k = j * NX + i; this.c2[k] = C_SHALLOW * C_SHALLOW; wpx[k * 4] = 200; wpx[k * 4 + 1] = 230; wpx[k * 4 + 2] = 255; wpx[k * 4 + 3] = 30; } } this.plate.position.x = 0.13; this.plate.rotation.y = -0.5; }
    if (this.scene === 'diffract') { const gi = Math.round(NX * 0.5), half = Math.round(this.gap / DX / 2); for (let j = 0; j < NY; j++) if (Math.abs(j - NY / 2) > half) for (let w = 0; w < 3; w++) setWall(gi + w, j); this.gaps.add(this.gap); }
    this.wallTex.needsUpdate = true; this.reset();
    if (this.scene !== 'open') { this.seen.add(this.scene); audio.click(); }
  }
  freeze() {
    this.frozen = !this.frozen; audio.click();
    if (this.frozen) {
      const lam = (C_DEEP / this.f) * 100;
      this.ro.set('l', lam.toFixed(1)); this.ro.set('v', '= f × λ ?');
      this.measured = true; this.ui.note(`Frozen! The ruler shows about **${(5 * lam).toFixed(1)} cm for 5 wavelengths**, so λ = **${lam.toFixed(1)} cm** at ${this.f} Hz.`, 'gold');
      this.st.done(0); this.check();
    }
  }
  sim(dt) {
    if (this.frozen) return;
    const sub = 4, h2 = (1 / 240) ** 2 / (DX * DX), om = 2 * Math.PI * this.f;
    const c2 = this.c2, wall = this.wall, sp = this.sponge;
    for (let s = 0; s < sub; s++) {
      const u = this.u, u0 = this.u0;
      this.t += 1 / 240;
      const drive = Math.sin(om * this.t) * Math.min(1, this.t * 2);
      if (this.src === 'line') for (let j = 4; j < NY - 4; j++) u[j * NX + 4] = drive;
      else { const ci = 12, cj = NY / 2; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (di * di + dj * dj <= 4) u[(cj + dj) * NX + ci + di] = drive; }
      for (let j = 1; j < NY - 1; j++) {
        const row = j * NX;
        for (let i = 1; i < NX - 1; i++) {
          const k = row + i;
          if (wall[k]) { u0[k] = 0; continue; }
          const lap = u[k - 1] + u[k + 1] + u[k - NX] + u[k + NX] - 4 * u[k];
          const nv = (2 * u[k] - u0[k] + c2[k] * h2 * lap) * (1 - sp[k]);
          u0[k] = nv;
        }
      }
      // swap
      const tmp = this.u0; this.u0 = this.u; this.u = tmp; this.tex.image.data = this.u;
      for (let k = 0; k < NX * NY; k++) if (wall[k]) this.u[k] = 0;
    }
    this.tex.needsUpdate = true;
    // cork bobs
    const ci = Math.round((this.cork.position.x + W / 2) / DX), cj = Math.round((this.cork.position.z + D / 2) / DX);
    this.cork.position.y = 0.045 + (this.u[clamp(cj, 0, NY - 1) * NX + clamp(ci, 0, NX - 1)] || 0) * 0.006;
    this.dipper.position.y = 0.05 + Math.sin(om * this.t) * 0.002; this.ball.position.y = this.dipper.position.y - 0.005;
    // progress
    if (this.t > 2) {
      if (this.scene === 'reflect' && !this.st.isDone(1)) { this.st.done(1); this.ui.note('**Reflection:** the waves bounce off the barrier at the same angle they hit it — angle of incidence = angle of reflection.', 'gold'); this.check(); }
      if (this.scene === 'refract' && !this.st.isDone(2)) { this.st.done(2); this.ui.note('**Refraction:** over the shallow region the waves slow down, the wavelength shortens and the wavefronts change direction. The frequency is unchanged.', 'gold'); this.check(); }
      if (this.scene === 'diffract' && !this.st.isDone(3)) {
        const lam = C_DEEP / this.f, sizes = [...this.gaps];
        const narrow = sizes.some((g) => g <= lam * 1.3), wide = sizes.some((g) => g >= lam * 3);
        if (narrow && wide) { this.st.done(3); this.ui.note('**Diffraction:** a gap similar in size to the wavelength spreads the waves into semicircles; a much wider gap lets them through almost straight, with only slight spreading at the edges.', 'gold'); this.check(); }
        else if (!this._dh) { this._dh = true; this.ui.hint(`Now try a gap ${narrow ? 'much wider than' : 'about the same as'} the wavelength (${(lam * 100).toFixed(1)} cm).`, 4000); }
      }
    }
  }
  check() {
    const b = this.qs?.querySelector('.aq'); void b;
    if ([0, 1, 2, 3, 4].every((i) => this.st.isDone(i))) this.lab.complete();
  }
}
void h; void M;
