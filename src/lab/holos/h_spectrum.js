import * as THREE from 'three';
import { Holo, hm, hmesh, tube } from '../holo.js';

const REG = [
  { id: 'radio', name: 'Radio waves', col: '#ef4444', uses: 'radio and TV broadcasting, astronomy, RFID', danger: 'very little at normal levels' },
  { id: 'micro', name: 'Microwaves', col: '#f97316', uses: 'mobile phones, satellite TV, Wi-Fi, microwave ovens', danger: 'internal heating of body tissue' },
  { id: 'ir', name: 'Infrared', col: '#facc15', uses: 'remote controls, thermal imaging, heaters, optical fibres, intruder alarms', danger: 'skin burns' },
  { id: 'vis', name: 'Visible light', col: '#22c55e', uses: 'vision, photography, illumination, optical fibres', danger: 'very bright light can damage the eye' },
  { id: 'uv', name: 'Ultraviolet', col: '#6366f1', uses: 'security marking, sterilising water, detecting forged banknotes', danger: 'damage to surface cells and eyes — skin cancer, eye conditions' },
  { id: 'xray', name: 'X-rays', col: '#a855f7', uses: 'medical imaging of bones, airport security scanners', danger: 'mutation or damage to cells (cancer)' },
  { id: 'gamma', name: 'Gamma rays', col: '#ec4899', uses: 'sterilising food and medical equipment, detecting and treating cancer', danger: 'mutation or damage to cells (cancer)' },
];

export default class Spectrum extends Holo {
  constructor(...a) {
    super(...a);
    this.scenario = 'From the lighthouse radio to the clinic’s X-ray machine and the festival UV glow-paint: they are all the same kind of wave. Explore the whole electromagnetic spectrum.';
    this.view = { pos: [0, 1.35, 2.4], target: [0, 1.2, 0] };
    this.sel = -1; this.ph = 0;
  }
  build() {
    const s = this.stage(1.2, 1); this.spin = false;
    // the wave: wavelength shrinks from left to right
    const pts = []; let ph = 0; const N = 900;
    for (let i = 0; i <= N; i++) { const x = -0.75 + (i / N) * 1.5; const k = 9 * Math.exp(((x + 0.75) / 1.5) * 3.6); ph += k * (1.5 / N); pts.push(new THREE.Vector3(x, Math.sin(ph) * 0.07, 0)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 1600, 0.006, 6, false);
    const cols = []; const c = new THREE.Color(); const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); const idx = Math.min(6, Math.max(0, Math.floor(((x + 0.75) / 1.5) * 7))); c.set(REG[idx].col); cols.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    this.wave = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.4 })); s.add(this.wave);
    // region blocks
    this.blocks = REG.map((r, i) => { const x = -0.75 + (i + 0.5) * (1.5 / 7); const b = hmesh(new THREE.BoxGeometry(1.5 / 7 - 0.01, 0.03, 0.12), hm(r.col, { glow: 0.4, opacity: 0.8 }), x, -0.18, 0); s.add(b); return { b, x }; });
    // icons
    const ic = (i, obj) => { obj.position.set(this.blocks[i].x, 0.2, 0); s.add(obj); return obj; };
    const mast = new THREE.Group(); mast.add(hmesh(new THREE.ConeGeometry(0.025, 0.14, 4, 1, true), hm('#cbd5e1', { side: THREE.DoubleSide })), hmesh(new THREE.SphereGeometry(0.01, 8, 6), hm('#ef4444', { glow: 1 }), 0, 0.075, 0)); ic(0, mast);
    const oven = new THREE.Group(); oven.add(hmesh(new THREE.BoxGeometry(0.09, 0.055, 0.06), hm('#e5e7eb')), hmesh(new THREE.BoxGeometry(0.05, 0.035, 0.002), hm('#111827', { glow: 0.2 }), -0.01, 0, 0.031)); ic(1, oven);
    const heater = new THREE.Group(); for (let k = 0; k < 3; k++) heater.add(hmesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.5, 0.1) }), 0, k * 0.02 - 0.02, 0).rotateZ(Math.PI / 2)); ic(2, heater);
    const prism = hmesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 3), hm('#e0f2fe', { opacity: 0.5, glow: 0.3 })); prism.rotation.x = Math.PI / 2; ic(3, prism);
    const sun = hmesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, 2.6) })); ic(4, sun);
    const bone = new THREE.Group(); bone.add(hmesh(new THREE.CapsuleGeometry(0.008, 0.07, 4, 8), hm('#f8fafc', { glow: 0.5 })).rotateZ(Math.PI / 2)); for (const sx of [-1, 1]) for (const sy of [-1, 1]) bone.add(hmesh(new THREE.SphereGeometry(0.012, 10, 8), hm('#f8fafc', { glow: 0.5 }), sx * 0.045, sy * 0.008, 0)); ic(5, bone);
    const tre = new THREE.Group(); tre.add(hmesh(new THREE.CircleGeometry(0.04, 24), hm('#facc15', { glow: 0.4, side: THREE.DoubleSide }))); for (let k = 0; k < 3; k++) { const blade = hmesh(new THREE.CircleGeometry(0.034, 12, (k * 2 * Math.PI) / 3 - 0.5, 1.0), hm('#111827', { side: THREE.DoubleSide }), 0, 0, 0.001); tre.add(blade); } tre.add(hmesh(new THREE.CircleGeometry(0.008, 12), hm('#111827', { side: THREE.DoubleSide }), 0, 0, 0.002)); ic(6, tre);
    this.icons = [mast, oven, heater, prism, sun, bone, tre];
    const arrow = (y, txt) => { const o = new THREE.Object3D(); o.position.set(0, y, 0); s.add(o); this.lab.label(o, txt, { y: 0, cls: 'dimlab' }); };
    arrow(-0.28, 'wavelength gets shorter →   frequency gets higher →   energy increases →');
    arrow(0.36, 'All travel at 3.0 × 10⁸ m/s in a vacuum');
    REG.forEach((r, i) => this.hotspot({ id: r.id, pos: [this.blocks[i].x, -0.13, 0.07], title: r.name, text: `**Uses:** ${r.uses}.<br>**Dangers:** ${r.danger}.`, ids: ['P3.3.1', 'P3.3.3', 'P3.3.4'].concat(r.id === 'vis' ? ['P3.2.4.2'] : []) }));
    this.hotspot({ id: 'speed', pos: [0, 0.3, 0.05], title: 'Same speed (S)', text: 'Every electromagnetic wave travels at the **same speed** in a vacuum: **3.0 × 10⁸ m/s**. That is why we see lightning before we hear thunder (sound is far slower).', ids: ['P3.3.2', 'P3.3.5'] });
    this.story([
      { title: 'One family of waves', text: 'Seven regions, all **transverse** electromagnetic waves that can travel through a vacuum.', apply: () => { this.sel = -1; } },
      { title: 'Order', text: '**Radio → microwaves → infrared → visible → ultraviolet → X-rays → gamma**: wavelength decreases and frequency increases.', apply: () => { this.sel = 7; } },
      { title: 'Visible light', text: 'Our eyes detect only a tiny slice: **red, orange, yellow, green, blue, indigo, violet** (lowest to highest frequency).', apply: () => { this.sel = 3; } },
      { title: 'Ionising end', text: 'UV, X-rays and gamma carry the most energy per photon and can damage cells and DNA — useful for sterilising and treating cancer, dangerous in excess.', apply: () => { this.sel = 5; } },
    ]);
    this.finish({ intro: 'Click each coloured region for its uses and dangers.', sub: 'P3.3', questions: [
      { q: 'Which list is in order of **increasing frequency**?', opts: ['radio, microwave, infrared, visible, ultraviolet, X-ray, gamma', 'gamma, X-ray, ultraviolet, visible, infrared, microwave, radio', 'visible, infrared, radio, X-ray, gamma, ultraviolet, microwave', 'microwave, radio, visible, infrared, gamma, X-ray, ultraviolet'], e: 'Wavelength decreases in the same direction.', o: [1] },
      { q: 'Which waves are used to sterilise surgical instruments?', opts: ['Gamma rays', 'Radio waves', 'Infrared', 'Microwaves'], e: 'Their high energy kills microorganisms.', o: [3] },
      { q: '(S) In a vacuum, X-rays travel…', opts: ['at the same speed as radio waves, 3.0 × 10⁸ m/s', 'faster than radio waves', 'slower than visible light', 'not at all'], e: 'All electromagnetic waves share this speed.', o: [2, 5] },
    ] });
  }
  animate(dt, t) {
    this.wave.position.x = Math.sin(t * 0.8) * 0.004;
    this.icons.forEach((ic, i) => { ic.rotation.y += dt * 0.6; ic.position.y = 0.2 + Math.sin(t * 2 + i) * 0.01; });
    this.blocks.forEach(({ b }, i) => { const on = this.sel === -1 || this.sel === 7 || this.sel === i || (this.sel === 5 && i >= 4); b.material.opacity = on ? 0.85 : 0.2; b.scale.y = this.sel === 7 ? 1 + i * 0.4 : 1; });
  }
}
