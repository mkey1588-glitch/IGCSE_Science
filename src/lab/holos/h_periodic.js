import * as THREE from 'three';
import { Holo, hm, hmesh } from '../holo.js';
import { canvasTex, h } from '../../core/util.js';

// [symbol, period, group column (1–18), category]
const EL = 'H 1 1 n|He 1 18 g|Li 2 1 a|Be 2 2 e|B 2 13 m|C 2 14 n|N 2 15 n|O 2 16 n|F 2 17 h|Ne 2 18 g|Na 3 1 a|Mg 3 2 e|Al 3 13 p|Si 3 14 m|P 3 15 n|S 3 16 n|Cl 3 17 h|Ar 3 18 g|K 4 1 a|Ca 4 2 e|Sc 4 3 t|Ti 4 4 t|V 4 5 t|Cr 4 6 t|Mn 4 7 t|Fe 4 8 t|Co 4 9 t|Ni 4 10 t|Cu 4 11 t|Zn 4 12 t|Ga 4 13 p|Ge 4 14 m|As 4 15 m|Se 4 16 n|Br 4 17 h|Kr 4 18 g|Rb 5 1 a|Sr 5 2 e|Y 5 3 t|Zr 5 4 t|Nb 5 5 t|Mo 5 6 t|Tc 5 7 t|Ru 5 8 t|Rh 5 9 t|Pd 5 10 t|Ag 5 11 t|Cd 5 12 t|In 5 13 p|Sn 5 14 p|Sb 5 15 m|Te 5 16 m|I 5 17 h|Xe 5 18 g'.split('|').map((s, i) => { const [sym, p, g, c] = s.split(' '); return { sym, Z: i + 1, p: +p, g: +g, c }; });
const CAT = { a: ['#ef4444', 'Alkali metals (Group I)'], e: ['#f97316', 'Alkaline earth metals'], t: ['#eab308', 'Transition elements'], p: ['#14b8a6', 'Other metals'], m: ['#a855f7', 'Metalloids'], n: ['#22c55e', 'Non-metals'], h: ['#06b6d4', 'Halogens (Group VII)'], g: ['#8b5cf6', 'Noble gases (Group 0)'] };
const outer = (e) => (e.g <= 2 ? e.g : e.g >= 13 ? (e.g === 18 ? (e.sym === 'He' ? 2 : 8) : e.g - 10) : 2);

export default class Periodic extends Holo {
  constructor(...a) {
    super(...a);
    this.scenario = 'Mendeleev left gaps in his table and predicted the missing elements. Explore groups, periods and trends in 3D — and see why elements in a group behave alike.';
    this.view = { pos: [0, 1.32, 2.25], target: [0, 1.2, 0] };
    this.mode = 'flat';
  }
  build() {
    const s = this.stage(1.15, 1); this.spin = false;
    const S = 0.062;
    this.tiles = EL.map((e) => {
      const { tex } = canvasTex(128, 128, (ctx, w, hh) => { ctx.fillStyle = CAT[e.c][0]; ctx.fillRect(0, 0, w, hh); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 0, w, 6); ctx.fillStyle = '#fff'; ctx.font = '700 58px Outfit, Inter'; ctx.textAlign = 'center'; ctx.fillText(e.sym, w / 2, 84); ctx.font = '600 22px Inter'; ctx.fillText(String(e.Z), w / 2, 116); ctx.textAlign = 'left'; });
      const top = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.25, roughness: 0.5 });
      const side = hm(CAT[e.c][0], { glow: 0.2 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(S * 0.92, S * 0.92, 1), [side, side, side, side, top, side]);
      m.position.set((e.g - 9.5) * S, (3 - e.p) * S, 0); m.scale.z = 0.02; m.castShadow = true;
      s.add(m); return { e, m, h: 0.02 };
    });
    const lbl = (text, x, y) => { const o = new THREE.Object3D(); o.position.set(x, y, 0.02); s.add(o); this.lab.label(o, text, { y: 0, cls: 'dimlab' }); };
    lbl('Group I', (1 - 9.5) * S, 2.9 * S); lbl('VII', (17 - 9.5) * S, 2.9 * S); lbl('0', (18 - 9.5) * S, 2.9 * S); lbl('Period 3', -11.4 * S, 0);
    const H = (id, pos, title, text, ids) => this.hotspot({ id, pos, title, text, ids });
    H('arr', [0, 0.17, 0.03], 'Proton number order', 'Elements are arranged in order of **proton number**: rows are **periods**, columns are **groups**.', ['C8.1.1']);
    H('g1', [(1 - 9.5) * S, -0.15, 0.04], 'Group I — alkali metals', 'Soft metals with **one** outer electron. Down the group: lower melting point, higher density and **more reactive** with water.', ['C8.2.1', 'C8.2.2', 'C8.1.3']);
    H('g7', [(17 - 9.5) * S, -0.15, 0.04], 'Group VII — halogens', 'Diatomic non-metals with **seven** outer electrons. Down the group: darker colour, denser, **less reactive**.', ['C8.3.1', 'C8.3.4', 'C8.1.3']);
    H('g0', [(18 - 9.5) * S, 0.15, 0.04], 'Group 0 — noble gases', 'Full outer shells, so they are **unreactive** and **monatomic** — used in lights and balloons.', ['C8.5.1']);
    H('trans', [(8 - 9.5) * S, -0.08, 0.04], 'Transition elements', 'High density, high melting points, form **coloured compounds**, and are often **catalysts** (iron in the Haber process).', ['C8.4.1']);
    H('period', [(-0.5) * S, 0.0, 0.04], 'Across period 3', 'From sodium to argon the elements change from **metals** to **non-metals**.', ['C8.1.2']);
    H('outer', [(14 - 9.5) * S, 0.1, 0.04], 'Outer electrons', 'Elements in the same group have the same number of **outer-shell electrons**, so they react in similar ways.', ['C8.1.3', 'C8.1.4']);
    this.story([
      { title: 'The table', text: 'Each tile is an element. Colours show families. Rows = periods; columns = groups.', apply: () => { this.mode = 'flat'; } },
      { title: 'Outer electrons', text: 'Tile height = number of **outer electrons** for the main groups: equal heights down a group → similar chemistry.', apply: () => { this.mode = 'outer'; } },
      { title: 'Metallic character', text: 'Tall = metallic. Metals on the left, non-metals on the right, with a staircase of metalloids in between.', apply: () => { this.mode = 'metal'; } },
      { title: 'Group trends (S)', text: 'Height = reactivity in Groups I and VII: alkali metals get **more** reactive down the group; halogens get **less** reactive.', apply: () => { this.mode = 'react'; } },
    ]);
    this.extraControls = (ctl) => { const box = h('div', { class: 'row wrap', style: { gap: '4px', marginTop: '6px' } }); for (const [k, [c, n]] of Object.entries(CAT)) box.append(h('span', { class: 'chip', style: { background: c, color: '#fff' } }, n)); ctl.append(box); };
    this.finish({ intro: 'Elements 1–54 in 3D. Step through to change what the tile heights show.', sub: 'C8.1', questions: [
      { q: 'Why do lithium, sodium and potassium react in similar ways?', opts: ['They all have one electron in their outer shell', 'They are in the same period', 'They have the same mass', 'They are all non-metals'], e: 'Same group → same number of outer electrons.', o: [3] },
      { q: 'Across a period, the elements change from…', opts: ['metals to non-metals', 'non-metals to metals', 'gases to solids only', 'reactive to unreactive metals'], e: 'Sodium is a metal; chlorine is a non-metal.', o: [2] },
      { q: 'Noble gases are unreactive because…', opts: ['they have full outer shells of electrons', 'they are too heavy', 'they have no electrons', 'they are metals'], e: 'They exist as single atoms (monatomic).', o: [1], sub: 'C8.5' },
    ] });
  }
  targetH(e) {
    if (this.mode === 'outer') return e.g <= 2 || e.g >= 13 ? outer(e) * 0.03 : 0.02;
    if (this.mode === 'metal') return ({ a: 1, e: 0.9, t: 0.85, p: 0.7, m: 0.4, n: 0.1, h: 0.08, g: 0.05 }[e.c]) * 0.22;
    if (this.mode === 'react') { if (e.g === 1 && e.sym !== 'H') return 0.04 * (e.p - 1); if (e.g === 17) return 0.04 * (6 - e.p); return 0.01; }
    return 0.02;
  }
  animate(dt) {
    for (const t of this.tiles) { const target = this.targetH(t.e); t.h += (target - t.h) * Math.min(1, dt * 4); t.m.scale.z = Math.max(0.01, t.h); t.m.position.z = t.h / 2; }
  }
}
