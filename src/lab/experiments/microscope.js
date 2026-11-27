import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { M, mesh, mat } from '../apparatus.js';
import { h, clear, mulberry32, clamp, TAU } from '../../core/util.js';
import { audio } from '../../core/audio.js';
import { raise } from '../../core/state.js';

// Specimens: real sizes (µm) drive the magnification maths; `px` is the drawing scale at ×400.
const SPECIMENS = {
  onion: { name: 'Onion epidermis (iodine stain)', kind: 'plant', size: '250 × 60 µm', px: 1.25, find: ['Cell wall', 'Nucleus', 'Cytoplasm', 'Vacuole'], focus: 0.52, real: 250 },
  cheek: { name: 'Human cheek cells (methylene blue)', kind: 'animal', size: '≈ 60 µm', px: 4.2, find: ['Cell membrane', 'Nucleus', 'Cytoplasm'], focus: 0.47, real: 60 },
  leaf: { name: 'Leaf palisade cells', kind: 'plant', size: '80 × 30 µm', px: 3.4, find: ['Cell wall', 'Chloroplast', 'Nucleus', 'Vacuole'], focus: 0.58, real: 80 },
  root: { name: 'Root hair cell', kind: 'plant', size: '≈ 1 mm', px: 0.45, find: ['Root hair', 'Cell wall', 'Nucleus'], focus: 0.44, real: 1000 },
  blood: { name: 'Blood smear (Leishman stain)', kind: 'blood', size: 'RBC 7.5 µm', px: 9, find: ['Red blood cell', 'Phagocyte', 'Lymphocyte', 'Platelet'], focus: 0.61, real: 7.5 },
  bacteria: { name: 'Bacterium (electron micrograph ×20 000)', kind: 'em', size: '≈ 2 µm', px: 1, find: ['Cell wall', 'Circular DNA', 'Plasmid', 'Ribosomes'], focus: 0.5, real: 2 },
};
const INFO = {
  'Cell wall': 'Made of cellulose; strengthens the cell and stops it bursting. Plants and bacteria have one — animal cells do not.',
  'Cell membrane': 'Controls what enters and leaves the cell. Every cell has one.',
  Nucleus: 'Contains the chromosomes (DNA) that control the cell’s activities.',
  Cytoplasm: 'Jelly-like fluid where most chemical reactions happen.',
  Vacuole: 'Large permanent vacuole full of cell sap — keeps a plant cell turgid.',
  Chloroplast: 'Contains chlorophyll; absorbs light for photosynthesis. Not found in onion epidermis or root cells — they get no light!',
  'Root hair': 'A long extension of a root hair cell giving a huge surface area for absorbing water and mineral ions.',
  'Red blood cell': 'Biconcave disc with no nucleus, packed with haemoglobin to carry oxygen.',
  Phagocyte: 'White blood cell with a lobed nucleus; engulfs pathogens by phagocytosis.',
  Lymphocyte: 'White blood cell with a large round nucleus; makes antibodies.',
  Platelet: 'Cell fragment that helps blood to clot.',
  'Circular DNA': 'A bacterium’s main DNA: one circular chromosome loose in the cytoplasm — there is no nucleus.',
  Plasmid: 'Small extra ring of DNA, often carrying genes such as antibiotic resistance.',
  Ribosomes: 'Tiny structures where proteins are made.',
};

export default class Microscope extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Is the fig tree alive? Every living thing is made of cells. View real specimens, find their structures and calculate how big they really are.';
    this.view = { pos: [0.02, 1.5, 0.98], target: [0, 1.1, 0] };
    this.spec = 'onion'; this.obj = 4; this.focus = 0.2; this.ox = 0; this.oy = 0;
    this.found = {}; this.viewed = new Set();
  }

  build() {
    const Y = this.Y;
    // ---- 3D microscope
    const g = new THREE.Group(); this.lab.add(g, 0, Y, -0.05);
    const black = mat('#1f2430', 0.4, 0.35), cream = mat('#e8e2d0', 0.1, 0.4);
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.03, 0.26), black, 0, 0.015, 0));
    const arm = mesh(new THREE.BoxGeometry(0.05, 0.3, 0.06), cream, 0, 0.17, -0.09); arm.rotation.x = 0.15; g.add(arm);
    this.stage = new THREE.Group(); g.add(this.stage);
    this.stage.add(mesh(new THREE.BoxGeometry(0.15, 0.012, 0.13), black, 0, 0.13, 0.02));
    for (const x of [-0.04, 0.04]) this.stage.add(mesh(new THREE.BoxGeometry(0.005, 0.004, 0.05), M.steel, x, 0.138, 0.04));
    this.slide = mesh(new THREE.BoxGeometry(0.075, 0.002, 0.025), M.glass, 0, 0.138, 0.02); this.stage.add(this.slide);
    this.specDot = mesh(new THREE.BoxGeometry(0.018, 0.0015, 0.016), new THREE.MeshStandardMaterial({ color: '#c4a35a', transparent: true, opacity: 0.8 }), 0, 0.1395, 0.02); this.stage.add(this.specDot);
    g.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 1.8) }), 0, 0.045, 0.02));
    const head = mesh(new THREE.BoxGeometry(0.06, 0.04, 0.08), cream, 0, 0.3, -0.03); g.add(head);
    const tubeM = mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.12, 16), black, 0, 0.36, 0.0); tubeM.rotation.x = -0.45; g.add(tubeM);
    this.eye = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 16), black, 0, 0.42, 0.03); this.eye.rotation.x = -0.45; g.add(this.eye);
    this.turret = new THREE.Group(); this.turret.position.set(0, 0.265, 0.02); g.add(this.turret);
    this.turret.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 20), M.steel));
    this.lenses = [];
    [4, 10, 40].forEach((m, i) => {
      const a = (i / 3) * TAU;
      const l = mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.03 + i * 0.012, 12), m === 40 ? mat('#ffd166', 0.8, 0.3) : m === 10 ? mat('#60a5fa', 0.8, 0.3) : mat('#ef4444', 0.8, 0.3), Math.cos(a) * 0.018, -0.022 - i * 0.006, Math.sin(a) * 0.018);
      this.turret.add(l); this.lenses.push(l);
      this.lab.interactive(l, { tip: `×${m} objective lens — click to rotate into place`, onClick: () => this.setObjective(m) });
    });
    this.knob = mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.016, 20), black, 0.06, 0.16, -0.08); this.knob.rotation.z = Math.PI / 2; g.add(this.knob);
    this.lab.interactive(this.knob, { tip: 'Coarse focus knob — use the Focus slider', onClick: () => this.ui.hint('Use the <b>Focus</b> slider in the panel to turn the knob.', 3000) });
    this.lab.interactive(this.eye, { tip: 'Eyepiece (×10)', onClick: () => this.ui.hint('The eyepiece view is shown on the left.', 2500) });
    this.lab.label(g, 'Light microscope', { y: 0.5 });
    // slide box
    const box = new THREE.Group(); this.lab.add(box, 0.38, this.Y, 0.08);
    box.add(mesh(new THREE.BoxGeometry(0.2, 0.03, 0.12), mat('#7c4a2d', 0, 0.7), 0, 0.015, 0));
    Object.keys(SPECIMENS).forEach((k, i) => {
      const s = mesh(new THREE.BoxGeometry(0.025, 0.002, 0.075), M.glass, -0.08 + i * 0.032, 0.034, 0);
      const tag = mesh(new THREE.BoxGeometry(0.02, 0.0025, 0.018), mat(['#fde68a', '#bfdbfe', '#bbf7d0', '#fbcfe8', '#fecaca', '#ddd6fe'][i]), -0.08 + i * 0.032, 0.035, -0.025);
      box.add(s, tag);
      this.lab.interactive(tag, { tip: `Slide: ${SPECIMENS[k].name}`, onClick: () => this.setSpecimen(k) });
    });
    this.lab.label(box, 'Prepared slides', { y: 0.08 });
    // ---- eyepiece overlay
    this.ep = h('canvas', { width: 460, height: 460, style: { width: '100%', height: '100%', borderRadius: '50%', cursor: 'crosshair', display: 'block' } });
    this.epTitle = h('div', { style: { position: 'absolute', top: '-30px', left: 0, right: 0, textAlign: 'center', fontWeight: 700, fontSize: '13px', textShadow: '0 1px 4px #000' } });
    this.epMag = h('div', { class: 'chip gold', style: { position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)' } });
    this.overlay = h('div', { style: { position: 'absolute', left: 'max(24px, calc(50vw - 640px))', top: '50%', transform: 'translateY(-46%)', width: 'min(40vw, 46vh)', height: 'min(40vw, 46vh)', borderRadius: '50%', boxShadow: '0 0 0 10px #0b0f18, 0 0 0 12px rgba(255,255,255,.12), 0 30px 90px rgba(0,0,0,.7)', background: '#000', pointerEvents: 'auto' } }, this.epTitle, this.ep, this.epMag);
    this.ui.el.append(this.overlay);
    let drag = null;
    this.ep.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, ox: this.ox, oy: this.oy, moved: 0 }; this.ep.setPointerCapture(e.pointerId); });
    this.ep.addEventListener('pointermove', (e) => { if (!drag) return; const s = this.ep.width / this.ep.clientWidth; this.ox = drag.ox + (e.clientX - drag.x) * s; this.oy = drag.oy + (e.clientY - drag.y) * s; drag.moved = Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y); this.draw(); });
    this.ep.addEventListener('pointerup', (e) => { if (drag && drag.moved < 4) this.clickAt(e); drag = null; });

    // ---- panel
    const ui = this.ui;
    this.st = ui.steps(['Pick the **onion** slide and focus with the ×4 objective', 'Switch to **×40** and refocus', 'Find **all structures** on the onion slide', 'Compare with an **animal** specimen (cheek cells)', 'Examine a **leaf palisade** or **root hair** slide', 'Answer the analysis questions']);
    const sec = ui.section('Microscope');
    this.specSel = ui.select({ label: 'Slide on the stage', options: Object.entries(SPECIMENS).map(([k, s]) => [k, s.name]), value: this.spec, onChange: (v) => this.setSpecimen(v), parent: sec });
    this.objSeg = ui.seg({ label: 'Objective lens (eyepiece ×10)', options: [[4, '×4'], [10, '×10'], [40, '×40']], value: 4, onChange: (v) => this.setObjective(+v), parent: sec });
    this.focusS = ui.slider({ label: 'Focus', min: 0, max: 1, step: 0.002, value: this.focus, fmt: (v) => (v * 100).toFixed(0), unit: '', onInput: (v) => { this.focus = v; this.updateStage(); this.draw(); this.checkFocus(); }, parent: sec });
    this.ro = ui.readouts([{ id: 'mag', label: 'Total magnification' }, { id: 'size', label: 'Real cell size' }, { id: 'sharp', label: 'Sharpness' }], sec);
    this.findSec = ui.section('Identify structures — click them in the eyepiece');
    this.findList = h('div', { class: 'lp-steps' }); this.findSec.append(this.findList);
    this.infoEl = h('div', { class: 'muted', style: { fontSize: '.88em', lineHeight: 1.55, marginTop: '6px' } }, 'Tip: drag inside the eyepiece to move the slide.');
    this.findSec.append(this.infoEl);
    ui.notes();
    ui.questions([
      { q: 'You used a ×10 eyepiece with the ×40 objective. What is the **total magnification**?', ans: 400, tol: 0.001, unit: '×', e: 'Total magnification = eyepiece × objective = 10 × 40 = ×400.', o: [1], sub: 'B2.2' },
      { q: 'At ×400 you draw an onion cell **100 mm** long. What is its **actual length in mm**?', ans: 0.25, tol: 0.01, unit: 'mm', e: 'Actual size = image ÷ magnification = 100 ÷ 400 = 0.25 mm.', o: [1, 2], sub: 'B2.2' },
      { q: 'Convert **0.25 mm** into micrometres.', ans: 250, tol: 0.001, unit: 'µm', e: '× 1000: 0.25 mm = 250 µm.', o: [3], sub: 'B2.2' },
      { q: 'Which structure did you find in **palisade** cells but **not** in onion epidermis cells?', opts: ['Chloroplasts', 'Cell wall', 'Nucleus', 'Vacuole'], e: 'Onion epidermis grows underground in the bulb, with no light — so it has no chloroplasts.', o: [1, 4], sub: 'B2.1' },
      { q: 'Why does a cheek cell have **no cell wall**?', opts: ['It is an animal cell — only plant cells and bacteria have walls', 'The stain dissolved it', 'It was cut off on the slide', 'Cell walls are too small to see'], e: 'Animal cells have only a cell membrane.', o: [1], sub: 'B2.1' },
    ], { sub: 'B2.1', onDone: () => { this.st.done(5); this.tryComplete(); } });
    this.setSpecimen('onion');
    this.setObjective(4);
  }

  setSpecimen(k) {
    this.spec = k; this.specSel.set(k); this.ox = 0; this.oy = 0;
    this.focus = clamp(this.focus, 0, 1);
    const colors = { onion: '#d9b35a', cheek: '#7aa7d9', leaf: '#4caf50', root: '#c9b98a', blood: '#d86b8a', bacteria: '#9aa7b8' };
    this.specDot.material.color.set(colors[k]);
    this.viewed.add(k);
    this.found[k] = this.found[k] || new Set();
    this.layout = buildLayout(k);
    this.epTitle.textContent = SPECIMENS[k].name;
    this.renderFind();
    this.draw();
    audio.clink();
    if (k === 'cheek') this.st.done(3);
    if (k === 'leaf' || k === 'root') this.st.done(4);
    this.ro.set('size', SPECIMENS[k].size);
  }
  setObjective(m) {
    this.obj = m; this.objSeg.set(m);
    const idx = [4, 10, 40].indexOf(m);
    const target = -(idx / 3) * TAU + Math.PI / 2;
    this.turretTarget = target;
    this.ro.set('mag', `×${m * 10}`);
    this.epMag.textContent = this.spec === 'bacteria' ? 'Electron micrograph ×20 000' : `×${m * 10}`;
    this.draw(); this.checkFocus();
    audio.clink();
  }
  updateStage() { this.stage.position.y = (this.focus - 0.5) * 0.02; this.knob.rotation.x = this.focus * 12; }
  sharpness() {
    const s = SPECIMENS[this.spec];
    const tol = this.obj === 40 ? 0.025 : this.obj === 10 ? 0.06 : 0.12;
    return clamp(1 - Math.abs(this.focus - s.focus) / tol, 0, 1);
  }
  checkFocus() {
    const sh = this.sharpness();
    this.ro.set('sharp', `${Math.round(sh * 100)}%`);
    if (sh > 0.75) {
      if (this.spec === 'onion' && this.obj === 4) { if (!this.st.isDone(0)) { this.st.done(0); this.ui.note('In focus at ×40 total — now switch to the ×40 objective for detail.'); } }
      if (this.spec === 'onion' && this.obj === 40 && this.st.isDone(0)) { if (!this.st.isDone(1)) { this.st.done(1); this.ui.note('High power: you can see individual walls and nuclei. Click structures to identify them.'); } }
    }
  }
  renderFind() {
    clear(this.findList);
    const s = SPECIMENS[this.spec], f = this.found[this.spec];
    for (const name of s.find) this.findList.append(h('div', { class: `lp-step ${f.has(name) ? 'done' : ''}` }, h('span', { class: 'ck' }, f.has(name) ? '✓' : ''), h('span', null, name)));
  }
  clickAt(e) {
    const r = this.ep.getBoundingClientRect(); const sc = this.ep.width / r.width;
    const x = (e.clientX - r.left) * sc, y = (e.clientY - r.top) * sc;
    if (this.sharpness() < 0.5) { this.ui.hint('The image is blurry — focus first!', 2500); audio.fail(); return; }
    const hit = this.hitTest(x, y);
    if (!hit) { this.ui.hint('Nothing identifiable there — try clicking right on a structure.', 2000); return; }
    const s = SPECIMENS[this.spec], f = this.found[this.spec];
    this.flash = { x, y, t: 1.2, text: hit };
    this.infoEl.innerHTML = `<b>${hit}</b> — ${INFO[hit] || ''}`;
    if (s.find.includes(hit) && !f.has(hit)) {
      f.add(hit); audio.discover(); this.renderFind();
      const ids = { 'Cell wall': 'B2.1.4', Nucleus: 'B2.1.4', Chloroplast: 'B2.1.4', 'Root hair': 'B8.2.1', 'Red blood cell': 'B9.4.2', Phagocyte: 'B9.4.4', Lymphocyte: 'B9.4.4', 'Circular DNA': 'B2.1.2', Plasmid: 'B2.1.2' };
      raise([ids[hit] || 'B2.1.3'], 1, 'lab');
      if (this.spec === 'onion' && f.size === s.find.length) { this.st.done(2); this.ui.note('Onion cell: wall, membrane, cytoplasm, nucleus and a large vacuole — but **no chloroplasts**.', 'gold'); }
      if (this.spec === 'blood' && f.has('Red blood cell') && (f.has('Phagocyte') || f.has('Lymphocyte'))) { this.lab.goal('blood'); this.ui.note('Red cells (no nucleus) carry oxygen; white cells (with nuclei) defend against pathogens.', 'gold'); }
      if (this.spec === 'cheek' && f.size === s.find.length) this.ui.note('Animal cell: membrane, cytoplasm, nucleus — no wall, no large vacuole, no chloroplasts.');
      if (this.spec === 'bacteria' && f.size === s.find.length) this.ui.note('Bacteria: no nucleus — DNA lies free in the cytoplasm as a loop, plus plasmids.', 'gold');
    }
    this.draw();
    this.tryComplete();
  }
  tryComplete() { this.st.check(); }

  // ---------------------------------------------------------------- drawing
  zoom() { return this.spec === 'bacteria' ? 1 : this.obj / 40; }
  toScreen(p) { const W = this.ep.width, z = this.zoom(); return [W / 2 + (p[0] * z) + this.ox, W / 2 + (p[1] * z) + this.oy]; }
  hitTest(x, y) {
    const z = this.zoom();
    const lx = (x - this.ep.width / 2 - this.ox) / z, ly = (y - this.ep.width / 2 - this.oy) / z;
    const items = this.layout.items;
    for (let i = items.length - 1; i >= 0; i--) { const it = items[i]; const res = it.hit?.(lx, ly, z); if (res) return res; }
    return null;
  }
  draw() {
    const c = this.ep, ctx = c.getContext('2d'), W = c.width, z = this.zoom();
    ctx.save(); ctx.clearRect(0, 0, W, W);
    ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2, 0, TAU); ctx.clip();
    ctx.fillStyle = this.layout.bg; ctx.fillRect(0, 0, W, W);
    ctx.translate(W / 2 + this.ox, W / 2 + this.oy); ctx.scale(z, z);
    for (const it of this.layout.items) it.draw(ctx, z);
    ctx.restore();
    // vignette
    const g = ctx.createRadialGradient(W / 2, W / 2, W * 0.3, W / 2, W / 2, W / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2, 0, TAU); ctx.fill();
    const blur = (1 - this.sharpness()) * 9;
    c.style.filter = `blur(${blur.toFixed(1)}px)`;
    if (this.flash) { ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.font = '700 20px Inter'; ctx.textAlign = 'center'; ctx.strokeText(this.flash.text, this.flash.x, this.flash.y - 16); ctx.fillText(this.flash.text, this.flash.x, this.flash.y - 16); ctx.beginPath(); ctx.arc(this.flash.x, this.flash.y, 7, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.stroke(); }
  }
  update(dt, t) {
    if (this.turretTarget != null) { this.turret.rotation.y += (this.turretTarget - this.turret.rotation.y) * Math.min(1, dt * 8); }
    if (this.flash) { this.flash.t -= dt; if (this.flash.t <= 0) { this.flash = null; this.draw(); } }
    void t;
  }
  dispose() { super.dispose(); this.overlay?.remove(); }
}

// ------------------------------------------------------------------ specimen layouts (local px at ×400 scale)
function buildLayout(kind) {
  const rnd = mulberry32(kind.length * 97 + 3);
  const items = [];
  const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  if (kind === 'onion') {
    const W = 310, H = 78;
    for (let r = -4; r <= 4; r++) for (let c = -3; c <= 3; c++) {
      const x = c * W + (r % 2 ? W / 2 : 0) - W / 2, y = r * H - H / 2;
      const nx = x + W * (0.25 + rnd() * 0.5), ny = y + H * (0.35 + rnd() * 0.3);
      items.push({
        draw(ctx) {
          ctx.fillStyle = '#f2dfa4'; ctx.fillRect(x, y, W, H);
          ctx.fillStyle = 'rgba(214,180,90,0.35)'; ctx.fillRect(x + 6, y + 6, W - 12, H - 12);
          ctx.strokeStyle = '#8a6a28'; ctx.lineWidth = 4; ctx.strokeRect(x, y, W, H);
          ctx.fillStyle = '#7a5a1c'; ctx.beginPath(); ctx.ellipse(nx, ny, 13, 10, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#5a3f10'; ctx.beginPath(); ctx.arc(nx + 3, ny - 2, 3, 0, TAU); ctx.fill();
        },
        hit(px, py, z) {
          if (px < x || px > x + W || py < y || py > y + H) return null;
          if (inEllipse(px, py, nx, ny, 16, 13)) return 'Nucleus';
          const edge = Math.min(px - x, x + W - px, py - y, y + H - py);
          if (edge < 4 / Math.max(z, 0.2) + 2) return 'Cell wall';
          if (edge < 10) return 'Cytoplasm';
          return 'Vacuole';
        },
      });
    }
    return { bg: '#efe3bd', items };
  }
  if (kind === 'cheek') {
    for (let i = 0; i < 16; i++) {
      const cx = (rnd() - 0.5) * 900, cy = (rnd() - 0.5) * 900, R = 110 + rnd() * 50, rot = rnd() * TAU;
      const pts = Array.from({ length: 9 }, (_, k) => { const a = (k / 9) * TAU; const rr = R * (0.8 + rnd() * 0.3); return [cx + Math.cos(a + rot) * rr, cy + Math.sin(a + rot) * rr * 0.85]; });
      const nx = cx + (rnd() - 0.5) * 30, ny = cy + (rnd() - 0.5) * 30;
      items.push({
        draw(ctx) {
          ctx.fillStyle = 'rgba(140,175,230,0.45)'; ctx.strokeStyle = '#3c6aa8'; ctx.lineWidth = 2;
          ctx.beginPath(); pts.forEach(([a, b], k) => (k ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.fill(); ctx.stroke();
          for (let k = 0; k < 14; k++) { ctx.fillStyle = 'rgba(60,100,170,0.35)'; ctx.beginPath(); ctx.arc(cx + Math.sin(k * 7.3) * R * 0.5, cy + Math.cos(k * 4.1) * R * 0.45, 2.5, 0, TAU); ctx.fill(); }
          ctx.fillStyle = '#1e3a78'; ctx.beginPath(); ctx.ellipse(nx, ny, 22, 18, 0.3, 0, TAU); ctx.fill();
        },
        hit(px, py) {
          const d = Math.hypot(px - cx, py - cy);
          if (inEllipse(px, py, nx, ny, 25, 21)) return 'Nucleus';
          if (d < R * 0.78) return 'Cytoplasm';
          if (d < R * 1.08) return 'Cell membrane';
          return null;
        },
      });
    }
    return { bg: '#e7eef8', items };
  }
  if (kind === 'leaf') {
    const W = 92, H = 250;
    for (let c = -6; c <= 6; c++) for (let r = -1; r <= 1; r++) {
      const x = c * (W + 6) - W / 2, y = r * (H + 8) - H / 2;
      const chl = Array.from({ length: 22 }, () => { const side = rnd(); return side < 0.5 ? [x + 10 + rnd() * 10, y + 12 + rnd() * (H - 24)] : [x + W - 20 + rnd() * 10, y + 12 + rnd() * (H - 24)]; });
      const nx = x + W / 2 + (rnd() - 0.5) * 20, ny = y + H * (0.3 + rnd() * 0.4);
      items.push({
        draw(ctx) {
          ctx.fillStyle = '#dff2c6'; ctx.fillRect(x, y, W, H); ctx.strokeStyle = '#4b7a2a'; ctx.lineWidth = 4; ctx.strokeRect(x, y, W, H);
          for (const [a, b] of chl) { ctx.fillStyle = '#2f8f2f'; ctx.beginPath(); ctx.ellipse(a, b, 7, 4.5, 0.4, 0, TAU); ctx.fill(); }
          ctx.fillStyle = '#5f6b2a'; ctx.beginPath(); ctx.ellipse(nx, ny, 11, 9, 0, 0, TAU); ctx.fill();
        },
        hit(px, py, z) {
          if (px < x || px > x + W || py < y || py > y + H) return null;
          for (const [a, b] of chl) if (inEllipse(px, py, a, b, 9, 7)) return 'Chloroplast';
          if (inEllipse(px, py, nx, ny, 13, 11)) return 'Nucleus';
          const edge = Math.min(px - x, x + W - px, py - y, y + H - py);
          if (edge < 4 / Math.max(z, 0.2) + 2) return 'Cell wall';
          return 'Vacuole';
        },
      });
    }
    return { bg: '#cde8b0', items };
  }
  if (kind === 'root') {
    for (let k = -3; k <= 3; k++) {
      const x = k * 180 - 90, y = -60, W = 180, Hh = 120;
      const hasHair = k === 0 || k === 2 || k === -2;
      const nx = x + W * 0.4, ny = y + Hh * 0.5;
      items.push({
        draw(ctx) {
          ctx.fillStyle = '#f1ead2'; ctx.strokeStyle = '#8b7a4a'; ctx.lineWidth = 4;
          ctx.fillRect(x, y, W, Hh); ctx.strokeRect(x, y, W, Hh);
          if (hasHair) { ctx.beginPath(); ctx.moveTo(x + W * 0.6, y); ctx.bezierCurveTo(x + W * 0.7, y - 160, x + W * 0.4, y - 320, x + W * 0.75, y - 520); ctx.lineWidth = 26; ctx.strokeStyle = '#8b7a4a'; ctx.stroke(); ctx.lineWidth = 18; ctx.strokeStyle = '#f1ead2'; ctx.stroke(); }
          ctx.fillStyle = '#6b5a2a'; ctx.beginPath(); ctx.ellipse(nx, ny, 14, 11, 0, 0, TAU); ctx.fill();
        },
        hit(px, py, z) {
          if (hasHair && py < y && py > y - 540 && Math.abs(px - (x + W * 0.62)) < 60) return 'Root hair';
          if (px < x || px > x + W || py < y || py > y + Hh) return null;
          if (inEllipse(px, py, nx, ny, 16, 13)) return 'Nucleus';
          const edge = Math.min(px - x, x + W - px, py - y, y + Hh - py);
          if (edge < 5 / Math.max(z, 0.2) + 2) return 'Cell wall';
          return 'Cytoplasm';
        },
      });
    }
    return { bg: '#ece3c2', items };
  }
  if (kind === 'blood') {
    const cells = [];
    for (let i = 0; i < 170; i++) cells.push([(rnd() - 0.5) * 1200, (rnd() - 0.5) * 1200]);
    items.push({
      draw(ctx) { for (const [x, y] of cells) { const g = ctx.createRadialGradient(x, y, 5, x, y, 34); g.addColorStop(0, '#f0a6b4'); g.addColorStop(0.55, '#d9566e'); g.addColorStop(1, '#b8324e'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 34, 0, TAU); ctx.fill(); } },
      hit(px, py) { for (const [x, y] of cells) if (Math.hypot(px - x, py - y) < 34) return 'Red blood cell'; return null; },
    });
    const wbc = [[-120, 80, 'p'], [200, -150, 'l'], [-300, -260, 'p'], [330, 280, 'l'], [60, 380, 'p']];
    for (const [x, y, t] of wbc) items.push({
      draw(ctx) { ctx.fillStyle = 'rgba(220,200,240,0.95)'; ctx.beginPath(); ctx.arc(x, y, t === 'p' ? 62 : 48, 0, TAU); ctx.fill(); ctx.fillStyle = '#5b2a86';
        if (t === 'p') for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(x - 22 + k * 22, y + Math.sin(k * 2) * 12, 16, 22, k, 0, TAU); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(x, y, 38, 0, TAU); ctx.fill(); } },
      hit(px, py) { return Math.hypot(px - x, py - y) < (t === 'p' ? 62 : 48) ? (t === 'p' ? 'Phagocyte' : 'Lymphocyte') : null; },
    });
    const plates = Array.from({ length: 24 }, () => [(rnd() - 0.5) * 900, (rnd() - 0.5) * 900]);
    items.push({ draw(ctx) { ctx.fillStyle = '#7c3aed'; for (const [x, y] of plates) { ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); } }, hit(px, py) { for (const [x, y] of plates) if (Math.hypot(px - x, py - y) < 12) return 'Platelet'; return null; } });
    return { bg: '#f6e9ee', items };
  }
  // bacteria electron micrograph
  const B = { x: -150, y: -60, w: 300, h: 120 };
  items.push({
    draw(ctx) {
      ctx.fillStyle = '#1f2937'; ctx.fillRect(-400, -400, 800, 800);
      const r = B.h / 2;
      ctx.fillStyle = '#9aa5b5'; rr(ctx, B.x - 10, B.y - 10, B.w + 20, B.h + 20, r + 10); ctx.fill();
      ctx.fillStyle = '#c9d1dc'; rr(ctx, B.x, B.y, B.w, B.h, r); ctx.fill();
      ctx.fillStyle = '#e8edf3'; rr(ctx, B.x + 8, B.y + 8, B.w - 16, B.h - 16, r - 8); ctx.fill();
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 3; ctx.beginPath(); for (let k = 0; k <= 60; k++) { const a = (k / 60) * TAU; const rad = 38 + Math.sin(a * 5) * 8; ctx.lineTo(-20 + Math.cos(a) * rad * 1.4, Math.sin(a) * rad * 0.8); } ctx.closePath(); ctx.stroke();
      ctx.lineWidth = 2.5; for (const [px, py] of [[90, -25], [100, 30]]) { ctx.beginPath(); ctx.arc(px, py, 12, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = '#64748b'; for (let k = 0; k < 60; k++) { ctx.beginPath(); ctx.arc(B.x + 25 + ((k * 37) % (B.w - 50)), B.y + 22 + ((k * 53) % (B.h - 44)), 2.5, 0, TAU); ctx.fill(); }
    },
    hit(px, py) {
      if (Math.hypot(px - 90, py + 25) < 16 || Math.hypot(px - 100, py - 30) < 16) return 'Plasmid';
      if (inEllipse(px, py, -20, 0, 66, 40)) return 'Circular DNA';
      const inside = px > B.x - 10 && px < B.x + B.w + 10 && py > B.y - 10 && py < B.y + B.h + 10;
      if (!inside) return null;
      const edge = Math.min(px - (B.x - 10), B.x + B.w + 10 - px, py - (B.y - 10), B.y + B.h + 10 - py);
      if (edge < 16) return 'Cell wall';
      return 'Ribosomes';
    },
  });
  return { bg: '#111827', items };
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
