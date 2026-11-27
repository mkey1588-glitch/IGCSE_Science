import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { mesh, mat, M } from '../apparatus.js';
import { h, clamp, canvasTex } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const SPECTRUM = [['red', '#ff2a2a', 1.5], ['orange', '#ff8c1a', 1.51], ['yellow', '#ffe11a', 1.52], ['green', '#2aff5a', 1.531], ['blue', '#2a7dff', 1.545], ['indigo', '#5a3dff', 1.556], ['violet', '#b04dff', 1.566]];
const v2 = (x, z) => new THREE.Vector2(x, z);

// ---------------------------------------------------------------- 2D ray tracing helpers (board plane: x right, z towards viewer)
function hitSeg(p, d, a, b) {
  const e = b.clone().sub(a), den = d.x * e.y - d.y * e.x; if (Math.abs(den) < 1e-9) return null;
  const w = a.clone().sub(p), t = (w.x * e.y - w.y * e.x) / den, s = (w.x * d.y - w.y * d.x) / den;
  return t > 1e-6 && s >= 0 && s <= 1 ? t : null;
}
function refract(d, n, n1, n2) { // n points against d (towards incoming side)
  const cosi = -d.dot(n), eta = n1 / n2, k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) return null;
  return d.clone().multiplyScalar(eta).add(n.clone().multiplyScalar(eta * cosi - Math.sqrt(k))).normalize();
}
const reflect = (d, n) => d.clone().sub(n.clone().multiplyScalar(2 * d.dot(n))).normalize();
/** Trace a ray through a convex polygon of glass (index ng). Returns { pts, events }. */
function trace(p0, d0, poly, ng, maxLen = 0.6) {
  let p = p0.clone(), d = d0.clone().normalize(), inside = false; const pts = [p.clone()], events = [];
  for (let bounce = 0; bounce < 10; bounce++) {
    let best = null;
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const t = hitSeg(p, d, a, b); if (t != null && (!best || t < best.t)) best = { t, a, b }; }
    if (!best) { pts.push(p.clone().addScaledVector(d, maxLen)); break; }
    p = p.clone().addScaledVector(d, best.t); pts.push(p.clone());
    const e = best.b.clone().sub(best.a); let n = v2(e.y, -e.x).normalize(); // one of the normals
    if (n.dot(d) > 0) n.negate(); // make n face the incoming ray
    const n1 = inside ? ng : 1, n2 = inside ? 1 : ng;
    const ang = Math.acos(clamp(-d.dot(n), -1, 1)) * R2D;
    const r = refract(d, n, n1, n2);
    if (!r) { events.push({ type: 'tir', p: p.clone(), i: ang, n }); d = reflect(d, n); }
    else { events.push({ type: inside ? 'exit' : 'enter', p: p.clone(), i: ang, r: Math.acos(clamp(r.dot(n.clone().negate()), -1, 1)) * R2D, n, refl: reflect(d, n) }); d = r; inside = !inside; }
  }
  return { pts, events };
}

export default class Optics extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'The lighthouse needs a new lens, the harbour wants fibre-optic internet and the festival needs a rainbow light show. Master reflection, refraction, lenses and dispersion on the light bench.';
    this.tabLabels = [['reflect', '🪞 Reflection'], ['refract', '🧊 Refraction & TIR'], ['lens', '🔍 Lenses'], ['prism', '🌈 Prism']];
    this.tabObjectives = { reflect: ['P3.2.1'], refract: ['P3.2.2'], lens: ['P3.2.3'], prism: ['P3.2.4'] };
    const V = { pos: [0, 1.62, 0.5], target: [0, 0.9, 0.02] };
    this.tabViews = { reflect: V, refract: V, lens: V, prism: V };
    this.view = V;
  }
  boardSetup() {
    const Y = this.Y;
    const { tex } = canvasTex(1024, 720, (ctx, w, hh) => { ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, w, hh); ctx.strokeStyle = 'rgba(148,163,184,.12)'; ctx.lineWidth = 1; for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, hh); ctx.stroke(); } for (let y = 0; y < hh; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); } });
    const board = mesh(new THREE.PlaneGeometry(0.72, 0.5), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })); board.rotation.x = -Math.PI / 2; this.lab.add(board, 0, Y + 0.002, 0);
    this.beamRoot = new THREE.Group(); this.lab.add(this.beamRoot, 0, Y + 0.008, 0);
    this.beamY = 0.008;
  }
  clearBeams() { while (this.beamRoot.children.length) { const c = this.beamRoot.children[0]; this.beamRoot.remove(c); c.geometry.dispose(); c.material.dispose(); } }
  beam(pts, color = '#fef08a', width = 0.0035, opacity = 1, dashed = false) {
    const pos = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], dir = b.clone().sub(a), len = dir.length(); if (len < 1e-6) continue;
      const nrm = v2(-dir.y, dir.x).normalize().multiplyScalar(width / 2);
      const segs = dashed ? Math.max(1, Math.floor(len / 0.012)) : 1;
      for (let s = 0; s < segs; s++) {
        if (dashed && s % 2) continue;
        const p = a.clone().addScaledVector(dir, s / segs), q = a.clone().addScaledVector(dir, (s + 1) / segs);
        const A = [p.x + nrm.x, p.y + nrm.y], B = [p.x - nrm.x, p.y - nrm.y], C = [q.x - nrm.x, q.y - nrm.y], Dd = [q.x + nrm.x, q.y + nrm.y];
        pos.push(A[0], 0, A[1], B[0], 0, B[1], C[0], 0, C[1], A[0], 0, A[1], C[0], 0, C[1], Dd[0], 0, Dd[1]);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(opacity > 0.6 ? 2.2 : 1), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beamRoot.add(m); return m;
  }
  glassShape(poly, color = '#bae6fd') {
    const s = new THREE.Shape(); s.moveTo(poly[0].x, -poly[0].y); poly.slice(1).forEach((p) => s.lineTo(p.x, -p.y)); s.closePath();
    const m = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }), new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, clearcoat: 1, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = this.Y + 0.002; this.lab.tabRoot.add(m); return m;
  }
  rayBox(p, ang) {
    if (!this.box) { this.box = mesh(new THREE.BoxGeometry(0.06, 0.03, 0.035), mat('#1f2937', 0.3, 0.5)); this.lab.tabRoot.add(this.box); this.lab.label(this.box, 'Ray box', { y: 0.04, cls: 'dimlab' }); }
    this.box.position.set(p.x, this.Y + 0.017, p.y); this.box.rotation.y = -ang;
  }
  checkTab(id, st) { st.check(); }

  // ======================================================== reflection
  tab_reflect() {
    this.box = null; this.boardSetup();
    this.rf = { i: 30, rec: new Set(), img: false };
    const mir = mesh(new THREE.BoxGeometry(0.3, 0.05, 0.006), new THREE.MeshStandardMaterial({ color: '#e5e7eb', metalness: 1, roughness: 0.05 })); this.lab.add(mir, 0, this.Y + 0.025, -0.1);
    this.lab.label(mir, 'Plane mirror', { y: 0.05, cls: 'dimlab' });
    const ui = this.ui;
    this.stF = ui.steps(['Record the angles of incidence and reflection for **three** angles', { t: '(S) Construct the **image** of a pin in the mirror', o: ['P3.2.1.5'] }, 'Answer the analysis questions']);
    const sec = ui.section('Ray box');
    ui.slider({ label: 'Angle of incidence (to the normal)', min: 0, max: 75, step: 5, value: this.rf.i, unit: '°', parent: sec, onInput: (v) => { this.rf.i = v; this.drawReflect(); } });
    ui.buttons([{ label: '📐 Record angles', kind: 'primary', onClick: () => this.recReflect() }, { label: '📍 Pin & image (S)', onClick: () => { this.rf.img = !this.rf.img; this.drawReflect(); if (this.rf.img) { this.stF.done(1); this.ui.note('Rays from the pin reflect into your eye. Traced **back** (dashed), they seem to come from a point **behind** the mirror — a **virtual** image, the same distance behind as the pin is in front, upright, same size, laterally inverted.', 'gold'); this.checkTab('reflect', this.stF, 3); } } }], sec);
    this.roF = ui.readouts([{ id: 'i', label: 'Angle of incidence', unit: '°' }, { id: 'r', label: 'Angle of reflection', unit: '°' }], sec);
    this.tF = ui.table(['i / °', 'r / °'], sec);
    ui.notes();
    ui.questions([
      { q: 'The **normal** is…', opts: ['a line at 90° to the mirror surface where the ray hits it', 'the mirror surface itself', 'the reflected ray', 'a line parallel to the mirror'], e: 'Angles are always measured from the normal.', o: [1] },
      { q: 'The image in a plane mirror is…', opts: ['virtual, upright, the same size and as far behind the mirror as the object is in front', 'real and inverted', 'magnified', 'in front of the mirror'], e: 'It is virtual because no light actually passes through the image position.', o: [2, 4] },
      { q: 'A ray hits a mirror at 35° to the normal. The angle of reflection is…', ans: 35, tol: 0, abs: 0.5, unit: '°', e: 'Law of reflection: i = r.', o: [3] },
    ], { sub: 'P3.2.1', onDone: () => { this.stF.done(2); this.checkTab('reflect', this.stF, 3); } });
    this.drawReflect();
  }
  drawReflect() {
    this.clearBeams();
    const i = this.rf.i * D2R, hit = v2(0, -0.1);
    const src = hit.clone().add(v2(-Math.sin(i), Math.cos(i)).multiplyScalar(0.28));
    this.rayBox(src, Math.atan2(hit.y - src.y, hit.x - src.x));
    const out = hit.clone().add(v2(Math.sin(i), Math.cos(i)).multiplyScalar(0.28));
    this.beam([src, hit, out]);
    this.beam([v2(0, -0.1), v2(0, 0.15)], '#94a3b8', 0.0015, 0.5, true);
    if (this.rf.img) {
      const pin = v2(-0.06, 0.02), img = v2(-0.06, -0.22), eye = v2(0.18, 0.16);
      for (const ex of [0.12, 0.18]) {
        const e = v2(ex, 0.16), dir = e.clone().sub(img), t = (-0.1 - img.y) / dir.y, m = img.clone().addScaledVector(dir, t);
        this.beam([pin, m, e], '#fde68a', 0.0025, 0.8); this.beam([m, img], '#fde68a', 0.0018, 0.45, true);
      }
      this.beam([pin.clone().add(v2(0, 0.012)), pin.clone().add(v2(0, -0.012))], '#f43f5e', 0.008, 1);
      this.beam([img.clone().add(v2(0, 0.012)), img.clone().add(v2(0, -0.012))], '#f43f5e', 0.008, 0.4);
      void eye;
    }
    this.roF.set('i', this.rf.i); this.roF.set('r', this.rf.i);
  }
  recReflect() {
    if (this.rf.rec.has(this.rf.i)) { this.ui.hint('Already recorded — change the angle.', 1800); return; }
    this.rf.rec.add(this.rf.i); this.tF.add([this.rf.i, `<b>${this.rf.i}</b>`]); audio.blip();
    if (this.rf.rec.size >= 3 && !this.stF.isDone(0)) { this.stF.done(0); this.ui.note('Every time: **angle of incidence = angle of reflection**, both measured from the normal.', 'gold'); }
    this.checkTab('reflect', this.stF, 3);
  }

  // ======================================================== refraction & TIR
  tab_refract() {
    this.box = null; this.boardSetup();
    this.rr = { i: 40, shape: 'rect', rec: [], tir: false, crit: false };
    this.rectPoly = [v2(-0.1, -0.06), v2(0.1, -0.06), v2(0.1, 0.06), v2(-0.1, 0.06)];
    const semi = [v2(0.1, 0)]; for (let k = 1; k < 32; k++) { const a = (k / 32) * Math.PI; semi.push(v2(0.1 * Math.cos(a), 0.1 * Math.sin(a))); }
    semi.push(v2(-0.1, 0)); this.semiPoly = semi;
    this.glass = null;
    const ui = this.ui;
    this.stR = ui.steps(['Measure **angles of incidence and refraction** for a glass block (three angles)', { t: '(S) Calculate the **refractive index** n = sin i ÷ sin r', o: ['P3.2.2.5'] }, { t: '(S) Use the semicircular block to find the **critical angle** and see **total internal reflection**', o: ['P3.2.2.6', 'P3.2.2.7'] }, 'Answer the analysis questions']);
    const sec = ui.section('Set-up');
    ui.seg({ label: 'Glass block', options: [['rect', 'Rectangular'], ['semi', 'Semicircular (S)']], value: 'rect', parent: sec, onChange: (v) => { this.rr.shape = v; this.drawRefract(); } });
    ui.slider({ label: 'Angle of incidence', min: 0, max: 80, step: 1, value: this.rr.i, unit: '°', parent: sec, onInput: (v) => { this.rr.i = v; this.drawRefract(); } });
    ui.buttons([{ label: '📐 Record angles', kind: 'primary', onClick: () => this.recRefract() }], sec);
    this.roR = ui.readouts([{ id: 'i', label: 'Incidence', unit: '°' }, { id: 'r', label: 'Refraction', unit: '°' }, { id: 'n', label: 'sin i ÷ sin r' }, { id: 'tir', label: 'At flat face' }], sec);
    this.tR = ui.table(['i / °', 'r / °', 'sin i / sin r'], sec);
    const fb = ui.section('(S) Optical fibres');
    ui.text('Light inside a glass fibre always hits the wall at more than the critical angle, so it is **totally internally reflected** again and again — carrying internet data across oceans and letting doctors see inside the body (endoscopes).', fb);
    ui.notes();
    this.qsR = ui.questions([
      { q: '(S) Use one row of your table: n = sin i ÷ sin r. What is the refractive index of this glass?', ans: () => (this.rr.rec.length ? 1.5 : null), tol: 0.04, unit: '', e: 'n = {ans} for this glass.', o: [5] },
      { q: 'When light enters the glass block it bends **towards** the normal because…', opts: ['it slows down in the denser material', 'it speeds up', 'its frequency increases', 'the glass reflects it'], e: '(S) Refractive index = speed in air ÷ speed in glass.', o: [1, 4] },
      { q: '(S) The critical angle is…', opts: ['the angle of incidence (in the denser material) at which the refracted ray just travels along the boundary', 'always 90°', 'the angle where light enters the glass', 'the angle of reflection in a mirror'], e: 'For this glass it is about 42°; above it, light is totally internally reflected.', o: [7] },
      { q: 'The ray that leaves a rectangular block is…', opts: ['parallel to the ray that entered, but shifted sideways', 'bent back the way it came', 'at 90° to the original ray', 'stopped by the glass'], e: 'Equal and opposite bending at the two parallel faces.', o: [3] },
    ], { sub: 'P3.2.2', onDone: () => { this.stR.done(3); this.checkTab('refract', this.stR, 4); } });
    this.drawRefract();
  }
  drawRefract() {
    this.clearBeams();
    if (this.glass) { this.glass.parent?.remove(this.glass); this.glass = null; }
    const rect = this.rr.shape === 'rect', poly = rect ? this.rectPoly : this.semiPoly;
    this.glass = this.glassShape(poly);
    const i = this.rr.i * D2R;
    let src, d;
    if (rect) { const hit = v2(-0.02, 0.06); d = v2(Math.sin(i), -Math.cos(i)); src = hit.clone().addScaledVector(d, -0.25); this.beam([hit.clone().add(v2(0, 0.1)), hit.clone().add(v2(0, -0.25))], '#94a3b8', 0.0012, 0.4, true); }
    else { d = v2(Math.sin(i), -Math.cos(i)); src = v2(0, 0).addScaledVector(d, -0.3); this.beam([v2(0, 0.16), v2(0, -0.16)], '#94a3b8', 0.0012, 0.4, true); }
    this.rayBox(src, Math.atan2(d.y, d.x));
    const { pts, events } = trace(src, d, poly, 1.5);
    this.beam(pts);
    const crit = Math.asin(1 / 1.5) * R2D;
    if (rect) {
      const e0 = events[0]; this.lastR = e0 ? e0.r : 0;
      this.roR.set('i', this.rr.i); this.roR.set('r', this.lastR.toFixed(0)); this.roR.set('n', this.rr.i > 0 ? (Math.sin(i) / Math.sin(this.lastR * D2R)).toFixed(2) : '—'); this.roR.set('tir', '—');
    } else {
      const flat = events.find((e) => Math.abs(e.p.y) < 1e-3);
      this.roR.set('i', this.rr.i); this.roR.set('r', flat && flat.type === 'exit' ? flat.r.toFixed(0) : '—'); this.roR.set('n', '—');
      if (flat) {
        if (flat.type === 'tir') { this.roR.set('tir', 'TOTAL internal reflection'); if (!this.rr.tir) { this.rr.tir = true; this.ui.note(`Above the **critical angle (≈ ${crit.toFixed(0)}°)** no light escapes — it is **totally internally reflected**.`, 'gold'); } }
        else { this.roR.set('tir', 'refracts out (+ weak reflection)'); const r = flat.refl; this.beam([flat.p, flat.p.clone().addScaledVector(r, 0.12)], '#fef08a', 0.0025, 0.3); if (Math.abs(this.rr.i - crit) < 3) { this.rr.crit = true; this.ui.hint(`At about ${crit.toFixed(0)}° the emerging ray skims along the flat face — the critical angle!`, 3000); } }
      }
      if (this.rr.tir && this.rr.crit && !this.stR.isDone(2)) { this.stR.done(2); this.checkTab('refract', this.stR, 4); }
    }
  }
  recRefract() {
    if (this.rr.shape !== 'rect') { this.ui.hint('Record angles with the rectangular block.', 2000); return; }
    if (this.rr.i === 0) { this.ui.hint('At 0° the ray goes straight through — choose another angle.', 2200); return; }
    if (this.rr.rec.some((r) => r[0] === this.rr.i)) return;
    const r = this.lastR; this.rr.rec.push([this.rr.i, r]);
    this.tR.add([this.rr.i, r.toFixed(0), (Math.sin(this.rr.i * D2R) / Math.sin(r * D2R)).toFixed(2)]); audio.blip();
    if (this.rr.rec.length >= 3 && !this.stR.isDone(0)) { this.stR.done(0); this.ui.note('The ray bends **towards the normal** entering glass and **away** leaving it. sin i ÷ sin r is the same every time — the refractive index.', 'gold'); }
    this.checkTab('refract', this.stR, 4);
  }

  // ======================================================== lens
  tab_lens() {
    this.box = null; this.boardSetup();
    this.ln = { u: 30, mode: 'object', seen: new Set() };
    const lens = mesh(new THREE.SphereGeometry(0.2, 32, 16), new THREE.MeshPhysicalMaterial({ color: '#bae6fd', transparent: true, opacity: 0.35, roughness: 0.05, clearcoat: 1, depthWrite: false })); lens.scale.set(0.06, 0.12, 0.6); this.lab.add(lens, 0, this.Y + 0.015, 0);
    this.lab.label(lens, 'Converging lens (f = 10 cm)', { y: 0.06 });
    const ui = this.ui;
    this.stL = ui.steps(['Shine a **parallel beam** and find the principal focus', 'Place the object **beyond 2F** — describe the image', 'Place the object **between F and 2F**', { t: '(S) Place the object **inside F**: a magnifying glass', o: ['P3.2.3.7'] }, 'Answer the analysis questions']);
    const sec = ui.section('Optical bench');
    ui.seg({ label: 'Light source', options: [['parallel', 'Parallel beam'], ['object', 'Object (arrow)']], value: 'object', parent: sec, onChange: (v) => { this.ln.mode = v; this.drawLens(); } });
    ui.slider({ label: 'Object distance u', min: 4, max: 40, step: 1, value: this.ln.u, unit: 'cm', parent: sec, onInput: (v) => { this.ln.u = v; this.drawLens(); } });
    this.roL = ui.readouts([{ id: 'v', label: 'Image distance', unit: 'cm' }, { id: 'm', label: 'Magnification' }, { id: 'k', label: 'Image' }], sec);
    ui.notes();
    ui.questions([
      { q: 'A camera forms an image of a distant tree. The image is…', opts: ['real, inverted and diminished', 'virtual and upright', 'real and magnified', 'the same size'], e: 'Object beyond 2F → image between F and 2F, smaller and upside down.', o: [3, 4] },
      { q: 'The **focal length** is the distance from the lens to…', opts: ['the principal focus, where a parallel beam converges', 'the object', 'the image', 'the edge of the lens'], e: 'Measure it with a distant object or a parallel beam.', o: [2] },
      { q: '(S) A magnifying glass works when the object is…', opts: ['closer to the lens than the principal focus — the image is virtual, upright and magnified', 'beyond 2F', 'exactly at 2F', 'at infinity'], e: 'The rays diverge after the lens; your eye traces them back to a larger virtual image.', o: [5, 6, 7] },
      { q: 'A projector makes a large image on a screen, so the slide is placed…', opts: ['between F and 2F', 'beyond 2F', 'inside F', 'at the lens'], e: 'This gives a real, inverted, enlarged image.', o: [3, 4] },
    ], { sub: 'P3.2.3', onDone: () => { this.stL.done(4); this.checkTab('lens', this.stL, 5); } });
    this.drawLens();
  }
  drawLens() {
    this.clearBeams();
    const S = 0.006, f = 10;
    const P = (x, z) => v2(x * S, -z * S); // cm → board (z up the page is -z on board)
    this.beam([P(-58, 0), P(58, 0)], '#64748b', 0.0012, 0.5); // principal axis
    for (const x of [-2 * f, -f, f, 2 * f]) this.beam([P(x, -1.2), P(x, 1.2)], '#94a3b8', 0.003, 0.7);
    if (this.ln.mode === 'parallel') {
      for (const z of [-6, -3, 0, 3, 6]) this.beam([P(-55, z), P(0, z), P(f, 0), P(f + (f * 3), -z * 3)], '#fef08a', 0.0028);
      this.roL.set('v', f); this.roL.set('m', '—'); this.roL.set('k', 'rays meet at F');
      if (!this.stL.isDone(0)) { this.stL.done(0); this.ui.note('The parallel rays converge at the **principal focus F**, 10 cm from the lens — the **focal length**.', 'gold'); this.checkTab('lens', this.stL, 5); }
      return;
    }
    const u = this.ln.u, h0 = 5;
    this.beam([P(-u, 0), P(-u, h0)], '#22c55e', 0.006);
    const real = u > f, v = real ? (u * f) / (u - f) : -(u * f) / (f - u), m = Math.abs(v / u), hi = -h0 * (v / u);
    // ray 1: parallel then through F
    const r1end = P(55, h0 - (55 / f) * h0);
    this.beam([P(-u, h0), P(0, h0), r1end], '#fef08a', 0.0026);
    // ray 2: through optical centre
    const sl = -h0 / u; this.beam([P(-u, h0), P(55, h0 + sl * (55 + u))], '#fde047', 0.0026);
    // ray 3: through near focus then parallel (only if object beyond F)
    if (real) { const z3 = (-h0 * f) / (u - f); this.beam([P(-u, h0), P(0, z3), P(55, z3)], '#facc15', 0.0026); }
    if (real) this.beam([P(v, 0), P(v, hi)], '#f97316', 0.006);
    else { this.beam([P(v, 0), P(v, hi)], '#f97316', 0.006, 0.5, true); this.beam([P(0, h0), P(v, hi)], '#fef08a', 0.0016, 0.4, true); this.beam([P(0, 0), P(v, hi)], '#fef08a', 0.0016, 0.4, true); }
    const kind = real ? `real, inverted, ${m > 1.05 ? 'enlarged' : m < 0.95 ? 'diminished' : 'same size'}` : 'virtual, upright, enlarged';
    this.roL.set('v', real ? v.toFixed(1) : `${v.toFixed(1)} (same side)`); this.roL.set('m', m.toFixed(2)); this.roL.set('k', kind);
    if (u > 2 * f && !this.stL.isDone(1)) { this.stL.done(1); this.ui.note('Object beyond 2F → image between F and 2F: **real, inverted, diminished** (a camera or your eye).', 'gold'); }
    if (u > f && u < 2 * f && !this.stL.isDone(2)) { this.stL.done(2); this.ui.note('Object between F and 2F → image beyond 2F: **real, inverted, enlarged** (a projector).', 'gold'); }
    if (u < f && !this.stL.isDone(3)) { this.stL.done(3); this.ui.note('Object inside F → the rays diverge; traced back they form a **virtual, upright, magnified** image on the same side — a **magnifying glass**.', 'gold'); }
    this.checkTab('lens', this.stL, 5);
  }

  // ======================================================== prism
  tab_prism() {
    this.box = null; this.boardSetup();
    this.pz = { ang: 50, white: true, ordered: false };
    const s = 0.16, hgt = s * Math.sqrt(3) / 2;
    this.prismPoly = [v2(-s / 2, hgt / 3), v2(s / 2, hgt / 3), v2(0, -2 * hgt / 3)];
    this.glassShape(this.prismPoly, '#e0f2fe');
    this.screen = mesh(new THREE.BoxGeometry(0.004, 0.06, 0.24), mat('#f8fafc', 0, 0.9)); this.lab.add(this.screen, 0.3, this.Y + 0.03, 0.02);
    this.lab.label(this.screen, 'Screen', { y: 0.05, cls: 'dimlab' });
    const ui = this.ui;
    this.stP = ui.steps(['Shine **white light** through the prism', 'Put the colours in order — which is refracted **most**?', 'Answer the analysis questions']);
    const sec = ui.section('Prism');
    ui.slider({ label: 'Ray angle', min: 35, max: 65, step: 1, value: this.pz.ang, unit: '°', parent: sec, onInput: (v) => { this.pz.ang = v; this.drawPrism(); } });
    ui.seg({ label: 'Light', options: [[true, 'White light'], [false, 'Red light only']], value: true, parent: sec, onChange: (v) => { this.pz.white = v === true || v === 'true'; this.drawPrism(); } });
    const order = ui.section('Order of the spectrum');
    this.ordSel = ui.select({ label: 'Most refracted colour', options: [['', '— choose —'], ...SPECTRUM.map(([n]) => [n, n])], value: '', parent: order, onChange: (v) => { if (v === 'violet') { audio.success(); this.stP.done(1); this.ui.note('**Violet** bends most and **red** least: red, orange, yellow, green, blue, indigo, violet — in order of increasing frequency (decreasing wavelength).', 'gold'); this.checkTab('prism', this.stP, 3); } else { audio.fail(); this.ui.note('Look at which colour is deviated furthest from the original direction.', 'warn'); } } });
    ui.notes();
    ui.questions([
      { q: 'White light splits into colours in a prism because…', opts: ['each colour (frequency) is refracted by a slightly different amount', 'the prism adds colours to the light', 'the prism reflects only some colours', 'light slows down only for red'], e: 'This is dispersion — rainbows are made the same way by raindrops.', o: [1] },
      { q: 'Which colour has the **highest frequency**?', opts: ['Violet', 'Red', 'Green', 'Yellow'], e: 'Red: longest wavelength, lowest frequency. Violet: shortest wavelength, highest frequency.', o: [2] },
      { q: 'With red light only, the prism…', opts: ['bends the light but produces no spectrum', 'turns it white', 'makes a full rainbow', 'stops the light'], e: 'A single colour cannot be dispersed.', o: [1] },
    ], { sub: 'P3.2.4', onDone: () => { this.stP.done(2); this.checkTab('prism', this.stP, 3); } });
    this.drawPrism();
  }
  drawPrism() {
    this.clearBeams();
    const tt = (this.pz.ang - 50) * D2R * 0.8 - 18 * D2R; const d = v2(Math.cos(tt), Math.sin(tt));
    const hit = v2(-0.045, -0.005), src = hit.clone().addScaledVector(d, -0.3);
    this.rayBox(src, Math.atan2(d.y, d.x));
    const list = this.pz.white ? SPECTRUM : SPECTRUM.slice(0, 1);
    let first = true;
    for (const [, col, n] of list) {
      const { pts } = trace(src, d, this.prismPoly, n, 0.5);
      if (first) { this.beam([pts[0], pts[1]], '#ffffff', 0.004); first = false; }
      this.beam(pts.slice(1), col, 0.0025, 0.9);
    }
    if (this.pz.white && !this.stP.isDone(0)) { this.stP.done(0); this.ui.note('White light is **dispersed** into a spectrum: it is a mixture of colours.', 'gold'); this.checkTab('prism', this.stP, 3); }
  }

  update(dt, t) {
    super.update(dt, t);
    if (this.tab === 'refract' && this.stR && !this.stR.isDone(1)) { const b = this.qsR?.querySelector('.aq'); if (b?.classList.contains('solved')) { this.stR.done(1); this.checkTab('refract', this.stR, 4); } }
  }
}
void h; void M;
