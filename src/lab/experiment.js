import * as THREE from 'three';
import { BENCH_Y } from './lab.js';

/**
 * Base class for experiments. Subclasses implement build(), optional tab_<id>() builders,
 * update(dt, t) and dispose(). Tabs get their own 3D group and their own panel body.
 *
 * Completion: a checklist made with ui.steps() runs one shared check on every step update. When all
 * of its required steps are done it completes the experiment, or, inside a tab, finishes that tab
 * (LabView completes the experiment when every tab is finished). Both happen at most once.
 */
export class Experiment {
  constructor(lab, opts, meta) {
    this.lab = lab; this.ui = lab.ui; this.opts = opts || {}; this.meta = meta;
    this.root = lab.root; this.Y = BENCH_Y;
    this.tabRoot = null; this.tab = null;
    this.updaters = [];
    this.ui.stepsTarget = () => this.complete();
  }
  /** Register per-frame callbacks that are cleared on tab switch. */
  every(fn) { this.updaters.push(fn); return fn; }
  setTab(id) {
    if (this.tab === id && this.tabRoot) return;
    this.tab = id;
    this.lab.ui.setTabActive(id);
    if (this.tabRoot) { this._disposeTab?.(); this.lab.clearRoot(this.tabRoot); this.root.remove(this.tabRoot); }
    this.updaters = [];
    this._disposeTab = null;
    this.tabRoot = new THREE.Group(); this.root.add(this.tabRoot);
    this.lab.tabRoot = this.tabRoot;
    this.ui.reset();
    this.ui.stepsTarget = () => this.done(id);
    const fn = this[`tab_${id}`];
    if (fn) fn.call(this);
    if (this.tabViews?.[id]) this.lab.frame(this.tabViews[id]);
  }
  onTabDispose(fn) { this._disposeTab = fn; }
  update(dt, t) { for (const f of this.updaters) f(dt, t); }
  dispose() { this._disposeTab?.(); this.lab.tabRoot = null; }
  done(goal) { this.lab.goal(goal); }
  /** Complete the experiment, once. */
  complete() { if (this._completed) return; this._completed = true; this.lab.complete(); }
}
