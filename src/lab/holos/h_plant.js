import * as THREE from 'three';
import { Holo, hm, hmesh, tube } from '../holo.js';

export default class Plant extends Holo {
  constructor(...a) {
    super(...a);
    this.scenario = 'Ravi’s tomato plants droop at midday and their fruit is small. Follow water up from the roots and sugar down from the leaves.';
    this.view = { pos: [0.1, 1.25, 2.5], target: [0.1, 1.15, 0] };
    this.flow = 1;
  }
  build() {
    const s = this.stage(1.2, 1.05);
    s.add(hmesh(new THREE.CylinderGeometry(0.42, 0.42, 0.35, 40, 1, true), hm('#78350f', { opacity: 0.18, side: THREE.DoubleSide }), 0, -0.4, 0));
    const stem = [[0, -0.25, 0], [0, 0.0, 0], [0.01, 0.25, 0], [0, 0.5, 0]];
    s.add(tube(stem, 0.028, hm('#65a30d', { opacity: 0.55, glow: 0.2 }), 30));
    s.add(tube(stem, 0.008, hm('#3b82f6', { glow: 0.5 }), 30), tube(stem.map(([x, y, z]) => [x + 0.016, y, z]), 0.006, hm('#f59e0b', { glow: 0.5 }), 30));
    const roots = [];
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const pts = [[0, -0.25, 0], [Math.cos(a) * 0.08, -0.35, Math.sin(a) * 0.08], [Math.cos(a) * 0.18, -0.48, Math.sin(a) * 0.16], [Math.cos(a) * 0.24, -0.56, Math.sin(a) * 0.2]]; roots.push(pts); s.add(tube(pts, 0.01, hm('#fef3c7', { glow: 0.2 }), 16)); for (let k = 0; k < 6; k++) { const p = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q))).getPointAt(0.4 + k * 0.1); s.add(tube([p.toArray(), [p.x + Math.cos(a + k) * 0.03, p.y - 0.02, p.z + Math.sin(a + k) * 0.03]], 0.0025, hm('#fde68a', { glow: 0.3 }), 4)); } }
    const leaf = (y, dir) => { const g = new THREE.Group(); g.position.set(0, y, 0); g.rotation.y = dir; s.add(g); g.add(tube([[0, 0, 0], [0.12, 0.04, 0], [0.24, 0.05, 0]], 0.006, hm('#4d7c0f'))); const lf = hmesh(new THREE.SphereGeometry(0.09, 20, 12), hm('#22c55e', { glow: 0.2 }), 0.2, 0.05, 0); lf.scale.set(1.3, 0.12, 0.6); g.add(lf); return g; };
    leaf(0.15, 0.3); leaf(0.3, 2.6); leaf(0.42, 4.4); leaf(0.05, 3.8);
    this.fruit = hmesh(new THREE.SphereGeometry(0.06, 20, 16), hm('#ef4444', { glow: 0.3 }), -0.14, 0.22, 0.1); s.add(this.fruit);
    s.add(tube([[0, 0.24, 0], [-0.08, 0.26, 0.06], [-0.13, 0.27, 0.09]], 0.006, hm('#4d7c0f')));
    // stem cut section (vascular bundles in a ring)
    const sec = new THREE.Group(); sec.position.set(0.45, 0.25, 0); s.add(sec);
    sec.add(hmesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 36), hm('#d9f99d', { opacity: 0.6, glow: 0.2 })));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; sec.add(hmesh(new THREE.CylinderGeometry(0.012, 0.012, 0.032, 12), hm('#3b82f6', { glow: 0.4 }), Math.cos(a) * 0.045, 0.001, Math.sin(a) * 0.045), hmesh(new THREE.CylinderGeometry(0.008, 0.008, 0.032, 12), hm('#f59e0b', { glow: 0.4 }), Math.cos(a) * 0.062, 0.002, Math.sin(a) * 0.062)); }
    // root cut section (central xylem star)
    const rs = new THREE.Group(); rs.position.set(0.45, -0.35, 0); s.add(rs);
    rs.add(hmesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 36), hm('#fef3c7', { opacity: 0.6, glow: 0.2 })));
    for (let i = 0; i < 4; i++) { const arm = hmesh(new THREE.BoxGeometry(0.06, 0.032, 0.014), hm('#3b82f6', { glow: 0.4 })); arm.rotation.y = (i / 4) * Math.PI; rs.add(arm); }
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; rs.add(hmesh(new THREE.CylinderGeometry(0.008, 0.008, 0.033, 10), hm('#f59e0b', { glow: 0.4 }), Math.cos(a) * 0.03, 0.002, Math.sin(a) * 0.03)); }
    // root hair close-up
    const rh = new THREE.Group(); rh.position.set(-0.45, -0.45, 0.05); s.add(rh);
    rh.add(hmesh(new THREE.BoxGeometry(0.08, 0.05, 0.05), hm('#fef3c7', { opacity: 0.6, glow: 0.2 })), tube([[0.0, -0.01, 0], [-0.08, -0.02, 0.01], [-0.16, -0.01, 0.0]], 0.012, hm('#fef3c7', { opacity: 0.6, glow: 0.2 })));
    this.ions = new THREE.InstancedMesh(new THREE.SphereGeometry(0.006, 6, 5), new THREE.MeshBasicMaterial({ color: '#c084fc' }), 12); this.ions.frustumCulled = false; rh.add(this.ions);
    // flowing particles
    this.water = new THREE.InstancedMesh(new THREE.SphereGeometry(0.006, 6, 5), new THREE.MeshBasicMaterial({ color: '#7dd3fc' }), 40); this.water.frustumCulled = false; s.add(this.water);
    this.sugar = new THREE.InstancedMesh(new THREE.SphereGeometry(0.006, 6, 5), new THREE.MeshBasicMaterial({ color: '#fbbf24' }), 30); this.sugar.frustumCulled = false; s.add(this.sugar);
    this.wPath = new THREE.CatmullRomCurve3([[-0.2, -0.53, 0.15], [-0.08, -0.35, 0.06], [0, -0.25, 0], [0, 0.1, 0], [0, 0.3, 0], [0.16, 0.36, -0.1]].map((p) => new THREE.Vector3(...p)));
    this.sPaths = [new THREE.CatmullRomCurve3([[0.2, 0.2, 0.06], [0.016, 0.15, 0], [0.016, 0.22, 0], [-0.13, 0.27, 0.09]].map((p) => new THREE.Vector3(...p))), new THREE.CatmullRomCurve3([[0.2, 0.2, 0.06], [0.016, 0.15, 0], [0.016, -0.25, 0], [0.12, -0.42, 0.1]].map((p) => new THREE.Vector3(...p)))];
    this.wu = Array.from({ length: 40 }, (_, i) => i / 40); this.su = Array.from({ length: 30 }, (_, i) => i / 30); this.iu = Array.from({ length: 12 }, (_, i) => i / 12); this._o = new THREE.Object3D();
    const H = (id, pos, title, text, ids) => this.hotspot({ id, pos, title, text, ids });
    H('roothair', [-0.55, -0.43, 0.08], 'Root hair cells', 'Long thin extensions give a **huge surface area** for absorbing water (by osmosis) and mineral ions. (S) Ions are taken up by **active transport** against their gradient, using energy from respiration and carrier proteins.', ['B8.2.1', 'B8.2.2', 'B3.3.1', 'B3.3.2']);
    H('path', [-0.1, -0.33, 0.1], 'Water pathway', 'Root hair → root **cortex** cells → **xylem** → up the stem → leaf **mesophyll** cells → evaporates and diffuses out of stomata.', ['B8.2.3', 'B8.3.1', 'B8.3.2']);
    H('xylem', [0.03, 0.05, 0.03], 'Xylem', 'Dead, hollow, lignified tubes carrying **water and mineral ions** upwards. The lignin also gives **support**.', ['B8.1.1']);
    H('phloem', [0.04, -0.05, 0.03], 'Phloem', 'Living tubes carrying **sucrose and amino acids** — up **or** down the plant.', ['B8.1.1']);
    H('stemsec', [0.55, 0.28, 0.04], 'Stem cross-section', 'Vascular bundles form a ring near the outside: **xylem on the inside**, **phloem on the outside** of each bundle.', ['B8.1.2']);
    H('rootsec', [0.55, -0.32, 0.04], 'Root cross-section', 'In a root the **xylem** forms a central star with **phloem** between its arms.', ['B8.1.2']);
    H('source', [0.22, 0.24, 0.08], 'Source (S)', 'A **source** releases sucrose — here a photosynthesising **leaf**.', ['B8.4.1', 'B8.4.2']);
    H('sink', [-0.16, 0.3, 0.14], 'Sink (S)', 'A **sink** uses or stores sucrose — growing **fruit**, roots and buds. **Translocation** moves sucrose in phloem from sources to sinks.', ['B8.4.1', 'B8.4.2']);
    this.story([
      { title: 'Into the roots', text: 'Water enters root hair cells by **osmosis**; mineral ions by active transport (S).', apply: () => { this.flow = 1; } },
      { title: 'Up the xylem', text: 'Water moves through the cortex into the **xylem** and is pulled up the stem in a continuous column.', apply: () => { this.flow = 1.5; } },
      { title: 'Transpiration', text: 'Water evaporates from mesophyll cells and diffuses out through stomata — on a hot, windy day this happens fast and the plant may **wilt** if roots can’t keep up.', apply: () => { this.flow = 2.5; } },
      { title: 'Translocation (S)', text: 'Sugar made in the leaves (sources) travels in the **phloem** to the fruit and roots (sinks).', apply: () => { this.flow = 1; } },
    ]);
    this.finish({
      intro: 'Blue = water in the xylem, gold = sugar in the phloem. Cut sections of the stem and root are on the right.',
      sub: 'B8.1',
      questions: [
        { q: 'Which tissue carries **water** up the plant?', opts: ['Xylem', 'Phloem', 'Epidermis', 'Cortex'], e: 'Phloem carries sugars.', o: [1] },
        { q: 'Root hairs help absorb water because they…', opts: ['give a large surface area', 'contain chloroplasts', 'are waterproof', 'are made of xylem'], e: 'Thousands of hairs — a huge surface for osmosis.', o: [2], sub: 'B8.2' },
        { q: '(S) Translocation moves sucrose from…', opts: ['sources (e.g. leaves) to sinks (e.g. fruit, roots)', 'roots to leaves only', 'xylem to phloem', 'stomata to roots'], e: 'Phloem can carry sugars up or down.', o: [1], sub: 'B8.4' },
      ],
    });
  }
  animate(dt) {
    const o = this._o;
    this.wu = this.wu.map((u) => (u + dt * 0.08 * this.flow) % 1); this.wu.forEach((u, i) => { o.position.copy(this.wPath.getPointAt(u)); o.updateMatrix(); this.water.setMatrixAt(i, o.matrix); }); this.water.instanceMatrix.needsUpdate = true;
    this.su = this.su.map((u) => (u + dt * 0.06) % 1); this.su.forEach((u, i) => { o.position.copy(this.sPaths[i % 2].getPointAt(u)); o.updateMatrix(); this.sugar.setMatrixAt(i, o.matrix); }); this.sugar.instanceMatrix.needsUpdate = true;
    this.iu = this.iu.map((u) => (u + dt * 0.15) % 1); this.iu.forEach((u, i) => { o.position.set(-0.16 + u * 0.2, -0.01 + Math.sin(i) * 0.008, (i % 3 - 1) * 0.006); o.updateMatrix(); this.ions.setMatrixAt(i, o.matrix); }); this.ions.instanceMatrix.needsUpdate = true;
  }
}
