import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Experiment } from './experiment.js';
import { h, clear, rich } from '../core/util.js';
import { audio } from '../core/audio.js';
import { raise } from '../core/state.js';

/** Holo material helper: physically shaded with a faint inner glow. */
export function hm(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.45, metalness: o.metal ?? 0.05, emissive: new THREE.Color(color).multiplyScalar(o.glow ?? 0.18), transparent: o.opacity != null, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide, depthWrite: o.opacity == null || o.opacity > 0.6, flatShading: !!o.flat });
}
export function hmesh(geo, material, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
export function tube(points, r, material, seg = 48, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p))), closed);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, 10, closed), material); m.castShadow = true; m.userData.curve = curve; return m;
}

/**
 * Base for holo-models: a pedestal stage that slowly spins, hotspots to discover,
 * optional story steps and quick check questions.
 */
export class Holo extends Experiment {
  constructor(lab, opts, meta) {
    super(lab, opts, meta);
    this.spots = []; this.seen = new Set(); this.spin = true; this.steps = null; this.stepIdx = 0;
    this.view = { pos: [0, 1.75, 2.5], target: [0, 1.2, 0] };
  }
  /** Creates the rotating stage group (centred above the pedestal). */
  stage(y = 1.2, scale = 1) {
    this.pivot = new THREE.Group(); this.pivot.position.y = y; this.pivot.scale.setScalar(scale);
    this.root.add(this.pivot);
    return this.pivot;
  }
  hotspot({ id, pos, title, text, ids = [], parent = null }) {
    const dot = h('div', { class: 'holo-dot', title });
    const obj = new CSS2DObject(dot);
    obj.position.set(...pos);
    (parent || this.pivot).add(obj);
    const spot = { id, title, text, ids, obj, dot };
    dot.addEventListener('pointerdown', (e) => e.stopPropagation());
    dot.addEventListener('click', (e) => { e.stopPropagation(); this.select(spot); });
    this.spots.push(spot);
    return spot;
  }
  select(spot) {
    audio.discover();
    this.current = spot;
    spot.dot.classList.add('seen');
    if (!this.seen.has(spot.id)) { this.seen.add(spot.id); if (spot.ids.length) raise(spot.ids, 1, 'holo'); }
    this._renderInfo(); this._renderList();
    if (this.seen.size === this.spots.length && !this._completed) { this._completed = true; this.lab.complete(); }
  }
  /** Story steps: [{ title, text, apply(stepIndex) }] */
  story(steps) { this.steps = steps; }

  /** Build the side panel. Call at the end of build(). */
  finish({ questions = null, sub = null, intro = null } = {}) {
    const ui = this.ui;
    if (intro) ui.text(intro);
    const ctl = ui.section('Model');
    ui.buttons([
      { label: '⟳ Auto-rotate', onClick: () => { this.spin = !this.spin; } },
      { label: '◎ Reset view', onClick: () => this.lab.frame(this.view) },
    ], ctl);
    if (this.extraControls) this.extraControls(ctl);
    if (this.steps) {
      this.stepSec = ui.section('Step through');
      this._renderStep();
    }
    this.infoSec = ui.section('Selected part');
    this.infoBox = h('div', { class: 'muted', style: { lineHeight: 1.6, fontSize: '.92em' } }, 'Click a glowing dot on the model to learn about that part.');
    this.infoSec.append(this.infoBox);
    this.listSec = ui.section(`Discover · 0 / ${this.spots.length}`);
    this.list = h('div', { class: 'lp-steps' }); this.listSec.append(this.list);
    this._renderList();
    if (questions) ui.questions(questions, { sub, title: 'Check your understanding' });
    this.defaultHint = 'Drag to orbit · scroll to zoom · click the glowing dots';
    ui.hint(this.defaultHint, 6000);
  }
  _renderList() {
    if (!this.list) return;
    clear(this.list);
    this.listSec.querySelector('.st').textContent = `Discover · ${this.seen.size} / ${this.spots.length}`;
    for (const s of this.spots) {
      const done = this.seen.has(s.id);
      this.list.append(h('div', { class: `lp-step ${done ? 'done' : ''} ${this.current === s ? 'cur' : ''}`, style: { cursor: 'pointer', textDecoration: 'none' }, onClick: () => this.select(s) }, h('span', { class: 'ck' }, done ? '✓' : ''), h('span', null, s.title)));
    }
  }
  _renderInfo() {
    const s = this.current; if (!s) return;
    clear(this.infoBox).append(h('div', { style: { color: '#fff', fontWeight: 700, fontFamily: 'var(--display)', fontSize: '1.08em', marginBottom: '4px' } }, s.title), h('div', { html: rich(s.text) }),
      s.ids.length ? h('div', { class: 'row wrap', style: { gap: '4px', marginTop: '8px' } }, ...s.ids.map((id) => h('span', { class: `chip ${id[0]}` }, id))) : null);
  }
  _renderStep() {
    const st = this.steps[this.stepIdx];
    clear(this.stepSec);
    this.stepSec.append(h('div', { class: 'st' }, `Step through · ${this.stepIdx + 1} / ${this.steps.length}`),
      h('div', { style: { fontWeight: 700, marginBottom: '4px' } }, st.title), h('div', { class: 'muted', style: { lineHeight: 1.55, fontSize: '.9em' }, html: rich(st.text) }));
    const row = h('div', { class: 'ctl-row' });
    row.append(h('button', { class: 'btn small', onClick: () => { if (this.stepIdx > 0) { this.stepIdx--; this._applyStep(); } } }, '◀ Back'),
      h('button', { class: 'btn small primary', onClick: () => { if (this.stepIdx < this.steps.length - 1) { this.stepIdx++; this._applyStep(); } } }, 'Next ▶'));
    this.stepSec.append(row);
    st.apply?.(this.stepIdx);
  }
  _applyStep() { audio.click(); this._renderStep(); }
  update(dt, t) {
    super.update(dt, t);
    if (this.pivot && this.spin) this.pivot.rotation.y += dt * 0.18;
    this.animate?.(dt, t);
  }
}
