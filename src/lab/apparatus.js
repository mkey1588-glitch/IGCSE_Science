import * as THREE from 'three';
import { canvasTex, roundRect, clamp, lerp, TAU } from '../core/util.js';
import { audio } from '../core/audio.js';

// ------------------------------------------------------------------ materials
const std = (color, metal = 0.05, rough = 0.55, extra = {}) => new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, ...extra });
/** Fresnel-rim glass: nearly clear face-on, bright at grazing angles — keeps liquids readable. */
export function glassMaterial(tint = '#e6f4ff', base = 0.05, rim = 0.55) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(tint) }, uBase: { value: base }, uRim: { value: rim } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uBase; uniform float uRim; varying vec3 vN; varying vec3 vV;
      void main() { float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6); gl_FragColor = vec4(uColor * (0.55 + 0.9 * f), uBase + uRim * f); }`,
  });
  return m;
}
export const M = {
  glass: glassMaterial(),
  steel: std('#c7ccd4', 0.85, 0.28), dark: std('#2b313c', 0.6, 0.4), black: std('#111318', 0.2, 0.6), brass: std('#c9a24a', 0.9, 0.3),
  copper: std('#c8743c', 0.9, 0.3), rubber: std('#1f2937', 0, 0.8), white: std('#f4f6f8', 0, 0.4), ceramic: std('#f8fafc', 0, 0.25),
  wood: std('#8a5a33', 0, 0.75), cork: std('#b7895a', 0, 0.9), blue: std('#1e40af', 0.1, 0.5), red: std('#b91c1c', 0.1, 0.5), plastic: std('#e2e8f0', 0, 0.45),
};
export const mat = std;
const mk = (geo, material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };
export { mk as mesh };

// ------------------------------------------------------------------ liquids & vessels
function interpR(profile, y) {
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i], b = profile[i + 1];
    if (y >= a[1] && y <= b[1]) return lerp(a[0], b[0], (y - a[1]) / (b[1] - a[1] || 1));
  }
  return profile[profile.length - 1][0];
}
function liquidGeo(profile, level) {
  const pts = [new THREE.Vector2(0, profile[0][1])];
  for (const [r, y] of profile) { if (y >= level) break; pts.push(new THREE.Vector2(Math.max(0.0005, r), y)); }
  pts.push(new THREE.Vector2(interpR(profile, level), level), new THREE.Vector2(0, level));
  return new THREE.LatheGeometry(pts, 28);
}

/**
 * A glass vessel defined by an inner profile [[r, y], ...] (bottom → top).
 * Methods: setLevel(0..1), setColor(hex, seconds), setOpacity, addSolid(mesh)
 */
export class Vessel extends THREE.Group {
  constructor(profile, { thickness = 0.0025, color = '#9fd9ff', level = 0, opacity = 0.85, maxFill = 0.92, name = 'vessel' } = {}) {
    super();
    this.name = name;
    this.profile = profile;
    this.height = profile[profile.length - 1][1];
    this.maxFill = maxFill;
    const outer = profile.map(([r, y]) => new THREE.Vector2(r + thickness, y - (y === profile[0][1] ? thickness : 0)));
    const glass = new THREE.Mesh(new THREE.LatheGeometry(outer, 32), M.glass);
    glass.renderOrder = 5;
    this.add(glass); this.glass = glass;
    this.liqMat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.55, metalness: 0, depthWrite: false, envMapIntensity: 0.25, side: THREE.DoubleSide });
    this.liqMat.emissive = new THREE.Color(color).multiplyScalar(0.32);
    this.liquid = new THREE.Mesh(new THREE.BufferGeometry(), this.liqMat);
    this.liquid.renderOrder = 4;
    this.add(this.liquid);
    this._level = -1;
    this.setLevel(level);
    this._target = null;
  }
  get level() { return this._level; }
  surfaceY() { return this.profile[0][1] + (this.height - this.profile[0][1]) * this.maxFill * this._level; }
  innerR(y) { return interpR(this.profile, y ?? this.surfaceY()); }
  setLevel(f) {
    f = clamp(f, 0, 1);
    if (Math.abs(f - this._level) < 0.002) return;
    this._level = f;
    this.liquid.geometry.dispose();
    if (f <= 0.001) { this.liquid.visible = false; this.liquid.geometry = new THREE.BufferGeometry(); return; }
    this.liquid.visible = true;
    this.liquid.geometry = liquidGeo(this.profile.map(([r, y]) => [r - 0.0006, y]), this.surfaceY());
  }
  setColor(hex, seconds = 0) {
    if (!seconds) { this.liqMat.color.set(hex); this.liqMat.emissive.copy(this.liqMat.color).multiplyScalar(0.32); this._target = null; return; }
    this._from = this.liqMat.color.clone(); this._to = new THREE.Color(hex); this._t = 0; this._dur = seconds; this._target = true;
  }
  setOpacity(o) { this.liqMat.opacity = o; }
  update(dt) {
    if (this._target) { this._t += dt; const k = clamp(this._t / this._dur, 0, 1); this.liqMat.color.copy(this._from).lerp(this._to, k * k * (3 - 2 * k)); this.liqMat.emissive.copy(this.liqMat.color).multiplyScalar(0.32); if (k >= 1) this._target = null; }
  }
}

const roundBottom = (r, h, seg = 6) => { const p = []; for (let i = 0; i <= seg; i++) { const a = (i / seg) * (Math.PI / 2); p.push([Math.sin(a) * r, r - Math.cos(a) * r]); } p.push([r, h]); return p; };
export const shapes = {
  beaker: (r = 0.05, h = 0.11) => [[0, 0.003], [r * 0.97, 0.003], [r, 0.01], [r, h]],
  testTube: (r = 0.011, h = 0.13) => roundBottom(r, h),
  boilingTube: (r = 0.0165, h = 0.16) => roundBottom(r, h),
  conical: (rb = 0.06, rn = 0.016, h = 0.15) => [[0, 0.003], [rb * 0.95, 0.003], [rb, 0.012], [rn * 1.05, h * 0.72], [rn, h * 0.78], [rn, h]],
  cylinder: (r = 0.02, h = 0.22) => [[0, 0.012], [r, 0.012], [r, h]],
  dish: (r = 0.07, h = 0.018) => [[0, 0.002], [r, 0.002], [r, h]],
  cup: (r = 0.045, h = 0.1) => [[0, 0.004], [r * 0.8, 0.004], [r, h]],
};
export function beaker(o = {}) { const v = new Vessel(shapes.beaker(o.r, o.h), { name: 'Beaker', ...o }); const lip = mk(new THREE.TorusGeometry((o.r || 0.05) + 0.0025, 0.0018, 6, 32), M.glass, 0, o.h || 0.11, 0); lip.rotation.x = Math.PI / 2; v.add(lip); return v; }
export function testTube(o = {}) { return new Vessel(shapes.testTube(o.r, o.h), { name: 'Test tube', ...o }); }
export function boilingTube(o = {}) { return new Vessel(shapes.boilingTube(o.r, o.h), { name: 'Boiling tube', ...o }); }
export function conicalFlask(o = {}) { return new Vessel(shapes.conical(o.rb, o.rn, o.h), { name: 'Conical flask', ...o }); }
export function measuringCylinder(o = {}) {
  const v = new Vessel(shapes.cylinder(o.r || 0.02, o.h || 0.24), { name: 'Measuring cylinder', ...o });
  const base = mk(new THREE.CylinderGeometry(0.035, 0.04, 0.012, 6), M.glass, 0, 0.006, 0); v.add(base);
  const { tex } = canvasTex(64, 512, (ctx, w, hh) => { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '22px Inter'; for (let i = 0; i <= 50; i++) { const y = hh - 30 - i * ((hh - 60) / 50); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(i % 5 ? 14 : 30, y); ctx.lineWidth = 2; ctx.stroke(); if (i % 10 === 0) ctx.fillText(String(i * 2), 34, y + 8); } });
  const scale = new THREE.Mesh(new THREE.PlaneGeometry(0.012, (o.h || 0.24) * 0.9), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  scale.position.set(0, (o.h || 0.24) * 0.5, (o.r || 0.02) + 0.003); v.add(scale);
  return v;
}

// ------------------------------------------------------------------ heat sources & supports
export class Bunsen extends THREE.Group {
  constructor() {
    super(); this.name = 'Bunsen burner';
    this.add(mk(new THREE.CylinderGeometry(0.05, 0.055, 0.015, 24), M.dark, 0, 0.0075, 0));
    this.add(mk(new THREE.CylinderGeometry(0.011, 0.012, 0.12, 16), M.steel, 0, 0.075, 0));
    this.add(mk(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 16), M.brass, 0, 0.04, 0));
    const hose = mk(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 8), std('#d97706', 0, 0.7), 0.05, 0.02, 0); hose.rotation.z = Math.PI / 2; this.add(hose);
    this.flame = new THREE.Group(); this.flame.position.y = 0.135; this.add(this.flame);
    this.inner = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.035, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.2, 4), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.inner.position.y = 0.0175;
    this.outer = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.09, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.5, 2.4), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.outer.position.y = 0.045;
    this.flame.add(this.inner, this.outer);
    this.light = new THREE.PointLight('#9ec5ff', 0, 1.2, 2); this.light.position.y = 0.17; this.add(this.light);
    this.state = 'off'; this.flame.visible = false; this._loop = null;
  }
  set(state, color = null) {
    this.state = state;
    this.flame.visible = state !== 'off';
    if (state === 'off') { this._loop?.stop(); this._loop = null; this.light.intensity = 0; return; }
    if (!this._loop) { this._loop = audio.loop('flame'); }
    this._loop.set(state === 'roaring' ? 1 : 0.5);
    if (state === 'safety') { this.outer.material.color.setRGB(3, 1.6, 0.4); this.outer.material.opacity = 0.75; this.outer.scale.set(1.3, 1.5, 1.3); this.inner.visible = false; this.light.color.set('#ffb347'); }
    else { this.outer.material.color.setRGB(0.3, 0.5, 2.4); this.outer.material.opacity = 0.4; this.outer.scale.set(1, 1, 1); this.inner.visible = true; this.light.color.set('#9ec5ff'); }
    if (color) { this.outer.material.color.set(color).multiplyScalar(1.6); this.outer.material.opacity = 0.9; this.outer.scale.set(1.35, 1.25, 1.35); this.inner.visible = false; this.light.color.set(color); }
    this.light.intensity = state === 'safety' ? 0.6 : 0.35;
  }
  update(dt, t) { if (!this.flame.visible) return; const f = 1 + Math.sin(t * 31) * 0.05 + Math.sin(t * 17) * 0.04; this.outer.scale.y = (this.state === 'safety' ? 1.5 : 1) * f; this.inner.scale.y = 1 + Math.sin(t * 40) * 0.04; }
  dispose() { this._loop?.stop(); }
}
export function tripod() {
  const g = new THREE.Group(); g.name = 'Tripod & gauze';
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; const leg = mk(new THREE.CylinderGeometry(0.003, 0.003, 0.2, 6), M.dark, Math.cos(a) * 0.05, 0.1, Math.sin(a) * 0.05); leg.rotation.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18); g.add(leg); }
  const ring = mk(new THREE.TorusGeometry(0.055, 0.004, 6, 24), M.dark, 0, 0.2, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
  g.add(mk(new THREE.BoxGeometry(0.14, 0.003, 0.14), std('#9ca3af', 0.6, 0.6, { wireframe: false }), 0, 0.203, 0));
  g.userData.top = 0.205;
  return g;
}
export function stand(height = 0.6) {
  const g = new THREE.Group(); g.name = 'Clamp stand';
  g.add(mk(new THREE.BoxGeometry(0.16, 0.012, 0.11), M.dark, 0, 0.006, 0));
  g.add(mk(new THREE.CylinderGeometry(0.005, 0.005, height, 8), M.steel, -0.05, height / 2, 0));
  g.clamp = (y, reach = 0.09) => { const c = new THREE.Group(); c.add(mk(new THREE.BoxGeometry(0.02, 0.02, 0.02), M.dark, -0.05, y, 0)); const arm = mk(new THREE.CylinderGeometry(0.003, 0.003, reach, 6), M.steel, -0.05 + reach / 2, y, 0); arm.rotation.z = Math.PI / 2; c.add(arm); c.add(mk(new THREE.BoxGeometry(0.012, 0.02, 0.03), M.cork, -0.05 + reach, y, 0)); g.add(c); return c; };
  return g;
}
export class Thermometer extends THREE.Group {
  constructor(len = 0.26, min = -10, max = 110) {
    super(); this.name = 'Thermometer'; this.min = min; this.max = max; this.len = len;
    this.add(mk(new THREE.CylinderGeometry(0.0035, 0.0035, len, 10), M.glass, 0, len / 2, 0));
    this.add(mk(new THREE.SphereGeometry(0.0055, 10, 8), std('#ef4444', 0, 0.3), 0, 0.004, 0));
    this.col = mk(new THREE.CylinderGeometry(0.0015, 0.0015, 1, 6), new THREE.MeshBasicMaterial({ color: '#ef4444' }), 0, 0, 0); this.col.geometry.translate(0, 0.5, 0);
    this.add(this.col); this.set(20);
  }
  set(T) { this.T = T; const f = clamp((T - this.min) / (this.max - this.min), 0.01, 1); this.col.scale.y = 0.008 + f * (this.len - 0.02); this.col.position.y = 0.008; }
}
export class WaterBath extends THREE.Group {
  constructor() {
    super(); this.name = 'Water bath';
    this.add(mk(new THREE.BoxGeometry(0.26, 0.1, 0.18), std('#94a3b8', 0.4, 0.35), 0, 0.05, 0));
    const water = mk(new THREE.BoxGeometry(0.22, 0.01, 0.14), new THREE.MeshStandardMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.7, roughness: 0.1 }), 0, 0.096, 0); this.add(water);
    this.lcd = canvasTex(256, 96); this.display = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.034), new THREE.MeshBasicMaterial({ map: this.lcd.tex }));
    this.display.position.set(0, 0.055, 0.0905); this.add(this.display);
    this.set(25);
  }
  set(T) { this.T = T; this.lcd.redraw((ctx, w, hh) => { ctx.fillStyle = '#0b1f17'; ctx.fillRect(0, 0, w, hh); ctx.fillStyle = '#6ff7b0'; ctx.font = '700 64px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(`${T.toFixed(0)} °C`, w / 2, 70); }); }
}

// ------------------------------------------------------------------ instruments
function lcdMesh(w, hh, text, color = '#6ff7b0', bg = '#0b1f17') {
  const lcd = canvasTex(256, 96);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ map: lcd.tex, toneMapped: false }));
  m.userData.set = (t) => lcd.redraw((ctx, W, H) => { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); ctx.fillStyle = color; ctx.font = '700 56px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(t, W / 2, 66); });
  m.userData.set(text);
  return m;
}
export class Balance extends THREE.Group {
  constructor() {
    super(); this.name = 'Electronic balance';
    this.add(mk(new THREE.BoxGeometry(0.2, 0.05, 0.22), std('#e5e7eb', 0.1, 0.4), 0, 0.025, 0));
    this.add(mk(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 32), M.steel, 0, 0.054, -0.02));
    this.lcd = lcdMesh(0.1, 0.036, '0.00 g'); this.lcd.position.set(0, 0.03, 0.1105); this.add(this.lcd);
    this.top = 0.058;
  }
  set(g) { this.lcd.userData.set(`${g.toFixed(2)} g`); }
}
export class Stopwatch extends THREE.Group {
  constructor() {
    super(); this.name = 'Stop-watch';
    this.add(mk(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 24), std('#334155', 0.3, 0.4), 0, 0.006, 0));
    this.lcd = lcdMesh(0.04, 0.016, '0.0 s'); this.lcd.rotation.x = -Math.PI / 2; this.lcd.position.set(0, 0.0125, 0); this.add(this.lcd);
  }
  set(s) { this.lcd.userData.set(s >= 100 ? `${s.toFixed(0)} s` : `${s.toFixed(1)} s`); }
}
export class Meter extends THREE.Group {
  constructor(kind = 'A') {
    super(); this.name = kind === 'A' ? 'Ammeter' : kind === 'V' ? 'Voltmeter' : 'Meter';
    this.add(mk(new THREE.BoxGeometry(0.1, 0.06, 0.07), std(kind === 'A' ? '#1d4ed8' : '#b91c1c', 0.1, 0.5), 0, 0.03, 0));
    this.lcd = lcdMesh(0.08, 0.03, `0.00 ${kind}`); this.lcd.position.set(0, 0.035, 0.0355); this.add(this.lcd);
    this.kind = kind;
  }
  set(v, unit = this.kind) { this.lcd.userData.set(`${v.toFixed(2)} ${unit}`); }
}
export class PowerSupply extends THREE.Group {
  constructor() {
    super(); this.name = 'Power supply';
    this.add(mk(new THREE.BoxGeometry(0.2, 0.1, 0.14), std('#475569', 0.2, 0.5), 0, 0.05, 0));
    this.lcd = lcdMesh(0.09, 0.034, '0.0 V'); this.lcd.position.set(-0.03, 0.06, 0.0705); this.add(this.lcd);
    this.add(mk(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16), M.black, 0.06, 0.06, 0.075).rotateX(Math.PI / 2));
    for (const [x, c] of [[0.03, '#dc2626'], [0.07, '#111827']]) this.add(mk(new THREE.CylinderGeometry(0.006, 0.006, 0.014, 10), std(c), x, 0.025, 0.075).rotateX(Math.PI / 2));
  }
  set(v) { this.lcd.userData.set(`${v.toFixed(1)} V`); }
}
export class Lamp extends THREE.Group {
  constructor() {
    super(); this.name = 'Lamp';
    this.add(mk(new THREE.CylinderGeometry(0.05, 0.06, 0.02, 20), M.dark, 0, 0.01, 0));
    this.add(mk(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 8), M.steel, 0, 0.12, 0));
    const head = new THREE.Group(); head.position.set(0, 0.23, 0.02); head.rotation.x = 0.9; this.add(head);
    head.add(mk(new THREE.ConeGeometry(0.045, 0.06, 20, 1, true), std('#1e293b', 0.3, 0.4, { side: THREE.DoubleSide })));
    this.bulb = mk(new THREE.SphereGeometry(0.02, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1) }), 0, -0.02, 0); head.add(this.bulb);
    this.light = new THREE.SpotLight('#fff3d6', 0, 3, 0.7, 0.5, 1.5); this.light.position.set(0, -0.02, 0); head.add(this.light);
    const tgt = new THREE.Object3D(); tgt.position.set(0, -1, 0); head.add(tgt); this.light.target = tgt;
    this.head = head; this.set(1);
  }
  set(k) { this.k = k; this.light.intensity = k * 2.2; this.bulb.material.color.setRGB(0.4 + k * 1.7, 0.4 + k * 1.6, 0.35 + k * 1.3); }
}
export class Bulb extends THREE.Group {
  constructor() {
    super(); this.name = 'Lamp';
    this.add(mk(new THREE.CylinderGeometry(0.012, 0.014, 0.02, 12), M.brass, 0, 0.01, 0));
    this.glassM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, roughness: 0.05, emissive: new THREE.Color(0, 0, 0) });
    this.add(mk(new THREE.SphereGeometry(0.022, 16, 12), this.glassM, 0, 0.04, 0));
    this.fil = mk(new THREE.TorusGeometry(0.006, 0.0012, 4, 12), new THREE.MeshBasicMaterial({ color: '#333' }), 0, 0.04, 0); this.add(this.fil);
    this.light = new THREE.PointLight('#ffd9a0', 0, 0.8, 2); this.light.position.y = 0.04; this.add(this.light);
    this.set(0);
  }
  set(k) { k = clamp(k, 0, 1.5); this.fil.material.color.setRGB(0.2 + k * 4, 0.15 + k * 3, 0.1 + k * 1.2); this.glassM.emissive.setRGB(k * 1.2, k * 0.9, k * 0.4); this.light.intensity = k * 0.8; }
}
export function wire(points, color = '#dc2626', radius = 0.0025) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 10), radius, 6, false), std(color, 0.1, 0.5));
  m.castShadow = true; m.name = 'Wire';
  return m;
}
export function dropperBottle(label, liquid = '#d97706', glassColor = '#7c4a1d') {
  const g = new THREE.Group(); g.name = label;
  g.add(mk(new THREE.CylinderGeometry(0.022, 0.024, 0.07, 18), new THREE.MeshPhysicalMaterial({ color: glassColor, transparent: true, opacity: 0.75, roughness: 0.1 }), 0, 0.035, 0));
  g.add(mk(new THREE.CylinderGeometry(0.019, 0.019, 0.045, 14), new THREE.MeshStandardMaterial({ color: liquid, transparent: true, opacity: 0.8 }), 0, 0.025, 0));
  g.add(mk(new THREE.CylinderGeometry(0.009, 0.011, 0.02, 12), M.black, 0, 0.08, 0));
  g.add(mk(new THREE.SphereGeometry(0.009, 10, 8), std('#ef4444', 0, 0.6), 0, 0.095, 0));
  const { tex } = canvasTex(256, 96, (ctx, w, hh) => { ctx.fillStyle = '#f8fafc'; roundRect(ctx, 0, 0, w, hh, 10); ctx.fill(); ctx.fillStyle = '#111827'; ctx.font = '700 34px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label.length > 14 ? label.slice(0, 13) + '…' : label, w / 2, 60); });
  const lbl = new THREE.Mesh(new THREE.CylinderGeometry(0.0245, 0.0245, 0.03, 18, 1, true, -0.9, 1.8), new THREE.MeshStandardMaterial({ map: tex, transparent: true }));
  lbl.position.y = 0.035; g.add(lbl);
  return g;
}
export function rack(n = 6, spacing = 0.055) {
  const g = new THREE.Group(); g.name = 'Test-tube rack';
  const w = n * spacing + 0.03;
  g.add(mk(new THREE.BoxGeometry(w, 0.01, 0.07), M.wood, 0, 0.005, 0));
  g.add(mk(new THREE.BoxGeometry(w, 0.01, 0.07), M.wood, 0, 0.085, 0));
  for (const x of [-w / 2 + 0.005, w / 2 - 0.005]) g.add(mk(new THREE.BoxGeometry(0.01, 0.09, 0.07), M.wood, x, 0.045, 0));
  g.slots = Array.from({ length: n }, (_, i) => new THREE.Vector3(-((n - 1) * spacing) / 2 + i * spacing, 0.012, 0));
  return g;
}
export function spottingTile(rows = 2, cols = 6) {
  const g = new THREE.Group(); g.name = 'Spotting tile';
  g.add(mk(new THREE.BoxGeometry(cols * 0.035 + 0.02, 0.012, rows * 0.035 + 0.02), M.ceramic, 0, 0.006, 0));
  g.wells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = -((cols - 1) * 0.035) / 2 + c * 0.035, z = -((rows - 1) * 0.035) / 2 + r * 0.035;
    const w = mk(new THREE.CylinderGeometry(0.012, 0.012, 0.002, 16), new THREE.MeshStandardMaterial({ color: '#e5e7eb', roughness: 0.3 }), x, 0.0125, z);
    g.add(w); g.wells.push(w);
  }
  return g;
}
export class GasSyringe extends THREE.Group {
  constructor(maxVol = 100) {
    super(); this.name = 'Gas syringe'; this.maxVol = maxVol;
    const L = 0.3;
    const barrel = mk(new THREE.CylinderGeometry(0.018, 0.018, L, 20, 1, true), glassMaterial('#e6f4ff', 0.09, 0.75), 0, 0, 0); barrel.rotation.z = Math.PI / 2; this.add(barrel);
    const noz = mk(new THREE.CylinderGeometry(0.0045, 0.0045, 0.022, 10), M.glass, -L / 2 - 0.011, 0, 0); noz.rotation.z = Math.PI / 2; this.add(noz);
    this.gas = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0165, 1, 18), new THREE.MeshBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.25, depthWrite: false }));
    this.gas.rotation.z = Math.PI / 2; this.gas.renderOrder = 4; this.add(this.gas);
    this.plunger = new THREE.Group(); this.add(this.plunger);
    const p = mk(new THREE.CylinderGeometry(0.017, 0.017, 0.01, 16), M.rubber); p.rotation.z = Math.PI / 2; this.plunger.add(p);
    const rod = mk(new THREE.CylinderGeometry(0.004, 0.004, L, 8), M.glass, L / 2, 0, 0); rod.rotation.z = Math.PI / 2; this.plunger.add(rod);
    const { tex } = canvasTex(512, 48, (ctx, w, hh) => { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '18px Inter'; for (let i = 0; i <= 100; i += 5) { const x = 10 + (i / 100) * (w - 20); ctx.fillRect(x, 0, 2, i % 10 ? 12 : 22); if (i % 20 === 0) ctx.fillText(String((i / 100) * maxVol), x + 3, 40); } });
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.9, 0.025), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })); sc.position.set(0, 0.0, 0.019); this.add(sc);
    this.L = L; this.set(0);
  }
  set(vol) { this.vol = clamp(vol, 0, this.maxVol); this.plunger.position.x = -this.L / 2 + 0.01 + (this.vol / this.maxVol) * (this.L * 0.9); const len = Math.max(0.0005, this.plunger.position.x + this.L / 2); this.gas.scale.y = len; this.gas.position.x = -this.L / 2 + len / 2; this.gas.visible = this.vol > 0.2; }
}
export function ruler(len = 0.3) {
  const { tex } = canvasTex(1024, 64, (ctx, w, hh) => { ctx.fillStyle = '#fde68a'; ctx.fillRect(0, 0, w, hh); ctx.fillStyle = '#1f2937'; ctx.font = '16px Inter'; const cm = len * 100; for (let i = 0; i <= cm * 10; i++) { const x = 8 + (i / (cm * 10)) * (w - 16); ctx.fillRect(x, 0, 1.5, i % 10 ? (i % 5 ? 10 : 16) : 26); if (i % 10 === 0) ctx.fillText(String(i / 10), x + 2, 46); } });
  const m = mk(new THREE.BoxGeometry(len, 0.003, 0.03), [M.wood, M.wood, new THREE.MeshStandardMaterial({ map: tex }), M.wood, M.wood, M.wood]);
  m.name = 'Ruler';
  return m;
}

// ------------------------------------------------------------------ effects
/** Rising bubbles inside a cylinder volume (local to parent). */
export class Bubbles extends THREE.Group {
  constructor({ r = 0.03, y0 = 0.01, y1 = 0.1, size = 0.003, color = '#ffffff', max = 90, rate = 0, opacity = 0.6, sound = false } = {}) {
    super();
    this.o = { r, y0, y1, size };
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.05, metalness: 0.2, depthWrite: false }), max);
    this.mesh.renderOrder = 6; this.mesh.frustumCulled = false;
    this.add(this.mesh);
    this.items = []; this.max = max; this.rate = rate; this.acc = 0; this.sound = sound;
    this._d = new THREE.Object3D(); this.mesh.count = 0;
    this.source = null; // optional [x,z] emission point
  }
  setRate(r) { this.rate = r; }
  burst(n) { for (let i = 0; i < n; i++) this._spawn(); }
  _spawn() {
    if (this.items.length >= this.max) return;
    const { r, y0, size } = this.o;
    const a = Math.random() * TAU, rr = Math.sqrt(Math.random()) * r * 0.8;
    const src = this.source;
    this.items.push({ x: src ? src[0] + (Math.random() - 0.5) * 0.004 : Math.cos(a) * rr, z: src ? src[1] + (Math.random() - 0.5) * 0.004 : Math.sin(a) * rr, y: y0, s: size * (0.6 + Math.random() * 0.8), v: 0.04 + Math.random() * 0.05, p: Math.random() * 10 });
  }
  update(dt, top = null) {
    this.acc += this.rate * dt;
    while (this.acc > 1) { this.acc--; this._spawn(); }
    const y1 = top ?? this.o.y1;
    const d = this._d;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const b = this.items[i]; b.y += b.v * dt; b.p += dt * 8;
      if (b.y > y1) { this.items.splice(i, 1); if (this.sound && Math.random() < 0.15) audio.bubble(); }
    }
    this.items.forEach((b, i) => { d.position.set(b.x + Math.sin(b.p) * 0.0015, b.y, b.z); d.scale.setScalar(b.s); d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix); });
    this.mesh.count = this.items.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
/** Soft puffs of gas or vapour. */
const puffTex = (() => { let t = null; return () => { if (t) return t; const c = canvasTex(64, 64, (ctx, w, hh) => { const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh); }); t = c.tex; return t; }; })();
export class Puffs extends THREE.Group {
  constructor({ color = '#ffffff', rate = 0, size = 0.03, rise = 0.06, life = 2.5, opacity = 0.5, spread = 0.01 } = {}) {
    super(); this.o = { color, size, rise, life, opacity, spread }; this.rate = rate; this.acc = 0; this.items = [];
  }
  setRate(r) { this.rate = r; }
  setColor(c) { this.o.color = c; }
  update(dt) {
    this.acc += this.rate * dt;
    while (this.acc > 1) {
      this.acc--;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex(), color: this.o.color, transparent: true, opacity: 0, depthWrite: false }));
      s.position.set((Math.random() - 0.5) * this.o.spread, 0, (Math.random() - 0.5) * this.o.spread);
      s.userData.t = 0; this.add(s); this.items.push(s);
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const s = this.items[i]; s.userData.t += dt; const u = s.userData.t / this.o.life;
      if (u >= 1) { this.remove(s); s.material.dispose(); this.items.splice(i, 1); continue; }
      s.position.y += this.o.rise * dt; s.position.x += Math.sin(u * 6 + i) * 0.002;
      const sc = this.o.size * (0.5 + u * 1.6); s.scale.set(sc, sc, sc);
      s.material.opacity = this.o.opacity * Math.sin(u * Math.PI);
    }
  }
}
/** Additive spark burst. */
export class Sparks extends THREE.Group {
  constructor(color = '#ffcf7a') {
    super();
    const N = 60; this.N = N;
    this.geo = new THREE.BufferGeometry(); this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.pts = new THREE.Points(this.geo, new THREE.PointsMaterial({ size: 0.006, color: new THREE.Color(color).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.pts.frustumCulled = false; this.add(this.pts); this.vel = new Float32Array(N * 3); this.t = 9;
  }
  fire(color) { if (color) this.pts.material.color.set(color).multiplyScalar(3); const p = this.geo.attributes.position.array; for (let i = 0; i < this.N; i++) { p[i * 3] = p[i * 3 + 1] = p[i * 3 + 2] = 0; const a = Math.random() * TAU, e = Math.random() * 1.2; this.vel[i * 3] = Math.cos(a) * 0.4 * e; this.vel[i * 3 + 1] = 0.3 + Math.random() * 0.6; this.vel[i * 3 + 2] = Math.sin(a) * 0.4 * e; } this.t = 0; }
  update(dt) { if (this.t > 1.2) { this.pts.visible = false; return; } this.pts.visible = true; this.t += dt; const p = this.geo.attributes.position.array; for (let i = 0; i < this.N; i++) { this.vel[i * 3 + 1] -= 2.5 * dt; p[i * 3] += this.vel[i * 3] * dt; p[i * 3 + 1] += this.vel[i * 3 + 1] * dt; p[i * 3 + 2] += this.vel[i * 3 + 2] * dt; } this.geo.attributes.position.needsUpdate = true; this.pts.material.opacity = 1 - this.t / 1.2; }
}

/** Simple glowing particle "molecule" field inside a box — used for particle-model insets. */
export class ParticleBox extends THREE.Group {
  constructor({ w = 0.3, h = 0.2, d = 0.12, n = 60, r = 0.008, color = '#60a5fa', frame = true } = {}) {
    super();
    this.dim = { w, h, d }; this.n = n; this.r = r;
    if (frame) { const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), new THREE.LineBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.5 })); box.position.y = h / 2; this.add(box); this.frame = box; }
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1, emissive: new THREE.Color(color).multiplyScalar(0.25) }), n);
    this.mesh.castShadow = false; this.add(this.mesh);
    this.p = []; for (let i = 0; i < n; i++) this.p.push({ x: (Math.random() - 0.5) * w * 0.9, y: Math.random() * h * 0.9 + 0.01, z: (Math.random() - 0.5) * d * 0.9, vx: 0, vy: 0, vz: 0, hx: 0, hy: 0, hz: 0 });
    this.mode = 'gas'; this.speed = 1; this.lattice(); this._d = new THREE.Object3D(); this.colors = null;
  }
  lattice() {
    const { w, h, d } = this.dim; const s = this.r * 2.4;
    const nx = Math.max(1, Math.floor((w * 0.5) / s)), nz = Math.max(1, Math.floor((d * 0.8) / s));
    this.p.forEach((q, i) => { const ix = i % nx, iz = Math.floor(i / nx) % nz, iy = Math.floor(i / (nx * nz)); q.hx = (ix - (nx - 1) / 2) * s; q.hz = (iz - (nz - 1) / 2) * s; q.hy = this.r + iy * s; });
  }
  setColor(i, c) { this.mesh.setColorAt(i, new THREE.Color(c)); this.mesh.instanceColor.needsUpdate = true; }
  /** mode: 'solid' | 'liquid' | 'gas'; speed ~ sqrt(T) */
  update(dt) {
    const { w, h, d } = this.dim; const r = this.r; const sp = this.speed;
    for (const q of this.p) {
      if (this.mode === 'solid') {
        const j = 0.0025 * sp;
        q.x += (q.hx + (Math.random() - 0.5) * j - q.x) * 0.5; q.y += (q.hy + (Math.random() - 0.5) * j - q.y) * 0.5; q.z += (q.hz + (Math.random() - 0.5) * j - q.z) * 0.5;
        continue;
      }
      const k = this.mode === 'liquid' ? 0.6 : 1.6;
      q.vx += (Math.random() - 0.5) * 2 * sp * k * dt * 3; q.vy += (Math.random() - 0.5) * 2 * sp * k * dt * 3; q.vz += (Math.random() - 0.5) * 2 * sp * k * dt * 3;
      const vmax = 0.12 * sp * k; const vl = Math.hypot(q.vx, q.vy, q.vz); if (vl > vmax) { q.vx *= vmax / vl; q.vy *= vmax / vl; q.vz *= vmax / vl; }
      if (this.mode === 'liquid') q.vy -= 0.25 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const top = this.mode === 'liquid' ? Math.min(h, this.liquidTop || h * 0.45) : h;
      if (q.x < -w / 2 + r) { q.x = -w / 2 + r; q.vx = Math.abs(q.vx); this.onHit?.(); } if (q.x > w / 2 - r) { q.x = w / 2 - r; q.vx = -Math.abs(q.vx); this.onHit?.(); }
      if (q.z < -d / 2 + r) { q.z = -d / 2 + r; q.vz = Math.abs(q.vz); } if (q.z > d / 2 - r) { q.z = d / 2 - r; q.vz = -Math.abs(q.vz); }
      if (q.y < r) { q.y = r; q.vy = Math.abs(q.vy); } if (q.y > top - r) { q.y = top - r; q.vy = -Math.abs(q.vy); this.onHit?.(); }
    }
    const dd = this._d;
    this.p.forEach((q, i) => { dd.position.set(q.x, q.y, q.z); dd.updateMatrix(); this.mesh.setMatrixAt(i, dd.matrix); });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
