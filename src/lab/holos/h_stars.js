import * as THREE from 'three';
import { Holo, hm, hmesh } from '../holo.js';
import { mulberry32 } from '../../core/util.js';

export default class Stars extends Holo {
  constructor(...a) {
    super(...a);
    this.scenario = 'For the stargazing finale, Juno at the observatory wants a guide to how stars are born, live and die — and where our Sun sits in the Milky Way.';
    this.view = { pos: [0, 1.35, 2.5], target: [0, 1.2, 0] };
    this.mode = 'idle'; this.t0 = 0;
  }
  build() {
    const s = this.stage(1.2, 1); this.spin = false; const rnd = mulberry32(17);
    const cloud = (n, r, col, size = 0.012) => { const g = new THREE.BufferGeometry(); const p = []; for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(Math.cbrt(rnd()) * r); p.push(v.x, v.y * 0.6, v.z); } g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); return new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color(col).multiplyScalar(1.4), size, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending })); };
    const star = (r, col, x, y, z = 0) => { const m = hmesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2) }), x, y, z); s.add(m); return m; };
    this.neb = cloud(500, 0.13, '#c084fc'); this.neb.position.set(-0.62, 0.15, 0); s.add(this.neb);
    this.proto = star(0.03, '#fb923c', -0.38, 0.15); this.ms = star(0.045, '#fde68a', -0.15, 0.15);
    this.rg = star(0.09, '#f87171', 0.12, 0.32); this.pn = cloud(300, 0.08, '#5eead4', 0.01); this.pn.position.set(0.36, 0.32, 0); s.add(this.pn); this.wd = star(0.015, '#e0f2fe', 0.36, 0.32);
    this.rsg = star(0.12, '#ef4444', 0.12, -0.05); this.sn = cloud(500, 0.11, '#fef08a', 0.014); this.sn.position.set(0.38, -0.05, 0); s.add(this.sn);
    this.ns = star(0.012, '#93c5fd', 0.6, 0.02); this.bh = hmesh(new THREE.SphereGeometry(0.03, 20, 14), new THREE.MeshBasicMaterial({ color: '#000' }), 0.6, -0.12, 0); s.add(this.bh);
    this.disk = hmesh(new THREE.TorusGeometry(0.05, 0.008, 8, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.2, 0.4) }), 0.6, -0.12, 0); this.disk.rotation.x = 1.2; s.add(this.disk);
    const arrowM = new THREE.MeshBasicMaterial({ color: '#64748b' });
    const arr = (a, b) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, A.distanceTo(B), 6), arrowM); m.position.copy(A.clone().add(B).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); s.add(m); };
    arr([-0.5, 0.15, 0], [-0.42, 0.15, 0]); arr([-0.34, 0.15, 0], [-0.2, 0.15, 0]); arr([-0.1, 0.18, 0], [0.04, 0.3, 0]); arr([-0.1, 0.12, 0], [0.02, -0.02, 0]); arr([0.22, 0.32, 0], [0.28, 0.32, 0]); arr([0.25, -0.05, 0], [0.3, -0.05, 0]); arr([0.47, -0.03, 0], [0.57, 0.01, 0]); arr([0.47, -0.07, 0], [0.56, -0.11, 0]);
    // galaxy
    const gal = (this.gal = new THREE.Group()); gal.position.set(0, -0.36, -0.1); s.add(gal);
    const gp = []; for (let i = 0; i < 2500; i++) { const arm = i % 2, r = Math.pow(rnd(), 0.7) * 0.3, a = r * 12 + arm * Math.PI + (rnd() - 0.5) * 0.6; gp.push(Math.cos(a) * r, (rnd() - 0.5) * 0.015 * (1 - r * 2), Math.sin(a) * r); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    gal.add(new THREE.Points(gg, new THREE.PointsMaterial({ color: new THREE.Color(1.4, 1.5, 2.2), size: 0.006, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })));
    gal.add(hmesh(new THREE.SphereGeometry(0.03, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.0, 1.4) })));
    this.sunMark = hmesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 0.6) }), 0.17, 0.0, 0.06); gal.add(this.sunMark);
    gal.rotation.x = 0.5;
    this.others = []; for (let i = 0; i < 10; i++) { const o = hmesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.3, 2) }), (rnd() - 0.5) * 1.4, -0.4 + (rnd() - 0.5) * 0.3, -0.4 - rnd() * 0.2); o.userData.p0 = o.position.clone(); s.add(o); this.others.push(o); }
    const H = (id, pos, title, text, ids) => this.hotspot({ id, pos, title, text, ids });
    H('neb', [-0.62, 0.3, 0.05], 'Nebula', 'A cloud of **gas (mostly hydrogen) and dust**. Gravity pulls parts of it together.', ['P6.2.2.1']);
    H('proto', [-0.38, 0.22, 0.05], 'Protostar', 'The collapsing cloud heats up — a **protostar** — until it is hot enough for nuclear fusion to start.', ['P6.2.2.1']);
    H('ms', [-0.15, 0.24, 0.05], 'Stable star (like the Sun)', '(S) **Fusion** of hydrogen into helium releases energy. The star is stable because the inward pull of **gravity** is balanced by the outward pressure from the hot core.', ['P6.2.1.5', 'P6.2.1.8', 'P1.6.3.5']);
    H('rg', [0.12, 0.45, 0.05], 'Red giant', 'When a Sun-sized star runs out of hydrogen in its core it swells into a **red giant**.', ['P6.2.2.2']);
    H('wd', [0.36, 0.42, 0.05], 'White dwarf', 'The outer layers drift away as a planetary nebula, leaving a hot, dense **white dwarf** that slowly cools.', ['P6.2.2.2']);
    H('rsg', [0.12, 0.1, 0.06], 'Red supergiant', 'A star much **more massive** than the Sun becomes a **red supergiant**.', ['P6.2.2.2']);
    H('sn', [0.38, 0.08, 0.05], 'Supernova', 'The supergiant explodes as a **supernova**. (S) Its debris forms a new nebula that can make **new stars and planets** — the elements in your body were made this way!', ['P6.2.2.2', 'P6.2.2.3']);
    H('ns', [0.62, 0.1, 0.05], 'Neutron star or black hole', 'The core left behind becomes a super-dense **neutron star** — or, for the most massive stars, a **black hole**.', ['P6.2.2.2']);
    H('gal', [0.2, -0.32, 0.12], 'The Milky Way', 'Our galaxy: **billions of stars**, about **100 000 light-years** across. The Sun is one star in it (yellow dot).', ['P6.2.3.1', 'P6.2.3.2', 'P6.2.1.1']);
    H('bb', [-0.5, -0.38, -0.35], 'An expanding Universe (S)', 'The Milky Way is one of **billions of galaxies**. Light from distant galaxies is **redshifted**: they are moving away — evidence that the Universe is expanding from a **Big Bang**.', ['P6.2.3.2', 'P6.2.3.3']);
    this.story([
      { title: 'Birth', text: 'Gravity collapses a nebula into a protostar; fusion starts and a stable star is born.', apply: () => { this.mode = 'birth'; this.t0 = 0; } },
      { title: 'A Sun-like star', text: 'Main sequence → **red giant** → planetary nebula + **white dwarf**.', apply: () => { this.mode = 'low'; this.t0 = 0; } },
      { title: 'A massive star', text: 'Main sequence → **red supergiant** → **supernova** → neutron star or black hole.', apply: () => { this.mode = 'high'; this.t0 = 0; } },
      { title: 'Galaxies', text: 'Stars gather in galaxies. Ours is the Milky Way; it is one of billions.', apply: () => { this.mode = 'gal'; } },
      { title: 'The Big Bang (S)', text: 'Galaxies are moving apart. Run the film backwards and everything began from a tiny, hot point about 13.8 billion years ago.', apply: () => { this.mode = 'expand'; this.t0 = 0; } },
    ]);
    this.finish({ intro: 'The top branch is a Sun-sized star; the bottom branch a much more massive one. The Milky Way is below.', sub: 'P6.2.2', questions: [
      { q: 'What will our Sun eventually become?', opts: ['A red giant, then a white dwarf', 'A supernova, then a black hole', 'A neutron star', 'A nebula immediately'], e: 'Only stars much more massive than the Sun explode as supernovae.', o: [2] },
      { q: 'Stars form from…', opts: ['clouds of gas and dust (nebulae) pulled together by gravity', 'exploding planets', 'black holes', 'comets'], e: 'The cloud heats up as it collapses into a protostar.', o: [1] },
      { q: 'The Milky Way is…', opts: ['a galaxy of billions of stars, about 100 000 light-years across', 'the Solar System', 'the only galaxy', 'a nebula'], e: 'There are billions of other galaxies.', o: [1, 2], sub: 'P6.2.3' },
    ] });
  }
  animate(dt, t) {
    this.t0 += dt;
    this.neb.rotation.y += dt * 0.1; this.pn.rotation.y += dt * 0.2; this.gal.rotation.y += dt * 0.08;
    [this.proto, this.ms, this.rg, this.rsg, this.wd, this.ns].forEach((m, i) => m.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.04));
    const hi = (m, on) => { if (m.material) m.material.opacity = on ? 1 : 0.25; m.material.transparent = true; };
    const low = this.mode === 'low', high = this.mode === 'high', birth = this.mode === 'birth';
    hi(this.rg, !high); hi(this.wd, !high); hi(this.rsg, !low); hi(this.ns, !low); hi(this.proto, true); hi(this.ms, true);
    this.pn.material.opacity = high ? 0.15 : 0.75; this.sn.material.opacity = low ? 0.1 : 0.75;
    if (high) { const k = (this.t0 % 4) / 4; this.sn.scale.setScalar(0.3 + k * 1.2); this.sn.material.opacity = 1 - k * 0.6; }
    if (birth) { const k = Math.min(1, this.t0 * 0.3); this.neb.scale.setScalar(1 - k * 0.4); }
    this.disk.rotation.z += dt * 2;
    this.others.forEach((o) => { if (this.mode === 'expand') { const dir = o.userData.p0.clone().sub(new THREE.Vector3(0, -0.4, -0.45)); o.position.copy(o.userData.p0.clone().add(dir.multiplyScalar(Math.min(1.2, this.t0 * 0.12)))); o.material.color.setRGB(2, 0.6, 0.5); } else { o.position.copy(o.userData.p0); o.material.color.setRGB(1.2, 1.3, 2); } });
    this.sunMark.scale.setScalar(this.mode === 'gal' ? 1.6 + Math.sin(t * 6) * 0.4 : 1);
  }
}
