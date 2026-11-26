import * as THREE from 'three';
import { testTube, rack, dropperBottle, Bubbles, Puffs, mesh, mat } from './apparatus.js';
import { tweens, ease } from '../core/util.js';
import { audio } from '../core/audio.js';

/**
 * A rack of test tubes with selection, liquids, precipitates, bubbles and simple moves.
 * Used by the food tests, chemical analysis and reactivity labs.
 */
export class TubeRack {
  constructor(exp, { n = 6, x = -0.1, z = -0.02, spacing = 0.06, label = 'Test tubes', r = 0.013, h = 0.14 } = {}) {
    this.exp = exp; this.lab = exp.lab;
    this.rack = rack(n, spacing);
    this.lab.add(this.rack, x, exp.Y, z);
    this.lab.label(this.rack, label, { y: 0.21 });
    this.sel = 0;
    this.tubes = [];
    for (let i = 0; i < n; i++) {
      const v = testTube({ r, h, level: 0, color: '#ffffff', opacity: 0.6 });
      const holder = new THREE.Group(); holder.position.copy(this.rack.slots[i]); holder.add(v); this.rack.add(holder);
      const sed = mesh(new THREE.CylinderGeometry(r * 0.85, r * 0.6, 0.01, 14), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }), 0, r * 0.5, 0); sed.visible = false; v.add(sed);
      const bub = new Bubbles({ r: r * 0.7, y0: 0.006, y1: h * 0.5, size: 0.0018, rate: 0, sound: true }); v.add(bub);
      const puff = new Puffs({ color: '#ffffff', size: 0.02, rise: 0.05, life: 2.4, opacity: 0.4 }); puff.position.y = h + 0.005; v.add(puff);
      const lbl = this.lab.label(holder, String(i + 1), { y: h + 0.035, cls: 'dimlab' });
      const t = { i, v, holder, sed, bub, puff, lbl, content: null, home: holder.position.clone() };
      this.lab.interactive(v, { tip: `Tube ${i + 1} — click to select`, onClick: () => this.select(i) });
      this.tubes.push(t);
    }
    this.marker = mesh(new THREE.TorusGeometry(r + 0.006, 0.002, 6, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2, 0.5) }));
    this.marker.rotation.x = Math.PI / 2;
    this.select(0, true);
  }
  get current() { return this.tubes[this.sel]; }
  select(i, silent) {
    this.sel = i;
    const t = this.tubes[i];
    t.holder.add(this.marker); this.marker.position.set(0, 0.093, 0);
    this.tubes.forEach((x) => x.lbl.userData.el.classList.toggle('hot', x === t));
    if (!silent) { audio.clink(); this.onSelect?.(t); }
  }
  firstEmpty() { return this.tubes.find((t) => !t.content); }
  fill(t, color, level = 0.55, opacity = 0.88, seconds = 0) { t.v.setLevel(level); t.v.setColor(color, seconds); t.v.setOpacity(opacity); }
  precipitate(t, color, amount = 1) {
    t.sed.visible = true; t.sed.material.color.set(color); t.sed.scale.set(1, 0.01, 1);
    tweens.to(t.sed.scale, { y: 0.4 + amount * 0.8 }, 1.4, { ease: ease.outCubic });
  }
  clearTube(t) { t.content = null; t.v.setLevel(0); t.sed.visible = false; t.bub.setRate(0); t.puff.setRate(0); }
  clearAll() { this.tubes.forEach((t) => this.clearTube(t)); }
  async moveTo(t, worldPos, dur = 0.6) {
    const p0 = t.holder.position.clone();
    const target = this.rack.worldToLocal(worldPos.clone());
    const lift = Math.max(p0.y, target.y) + 0.12;
    await tweens.tween(dur, (e) => { t.holder.position.set(p0.x + (target.x - p0.x) * e, e < 0.5 ? p0.y + (lift - p0.y) * e * 2 : lift + (target.y - lift) * (e - 0.5) * 2, p0.z + (target.z - p0.z) * e); }, { ease: ease.inOut }).promise;
  }
  async back(t, dur = 0.6) { await this.moveTo(t, this.rack.localToWorld(t.home.clone()), dur); }
  update(dt) { for (const t of this.tubes) { t.v.update(dt); t.bub.update(dt, t.v.surfaceY()); t.puff.update(dt); } }
}

/** A row of labelled dropper bottles. onPick(index) is called on click. */
export function reagentShelf(exp, list, { x = -0.25, z = -0.17, spacing = 0.075 } = {}, onPick) {
  return list.map((r, i) => {
    const b = dropperBottle(r.name, r.color, r.glass || '#6b4a2a');
    exp.lab.add(b, x + i * spacing, exp.Y, z);
    exp.lab.interactive(b, { tip: `${r.name} — click to add to the selected tube`, onClick: () => onPick(i, r) });
    return b;
  });
}
void mat;
