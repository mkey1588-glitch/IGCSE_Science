import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { constellationLayout } from './layout.js';
import { SUBJECTS, SUB, TOPICS, COUNTS } from '../data/curriculum.js';
import { LINKS, linksOf } from '../data/links.js';
import { state, subStats, linkState, sparkedCount, coverage, grant } from '../core/state.js';
import { h, clear, rich, canvasTex, mulberry32 } from '../core/util.js';
import { audio } from '../core/audio.js';
import { game } from '../game.js';

export class ConstellationView {
  constructor(engine, uiRoot) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#02040b');
    this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 5000);
    this.camera.position.set(0, 40, 520);
    this.labels = engine.createLabelLayer();
    this.bloom = { strength: 0.7, radius: 0.45, threshold: 0.6 };
    this.controls = new OrbitControls(this.camera, engine.canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.07, minDistance: 80, maxDistance: 1100, autoRotate: true, autoRotateSpeed: 0.25 });
    this.controls.enabled = false;
    this.L = constellationLayout();
    this.filter = 'all';
    this._build();
    this.ui = h('div', { class: 'hud hidden' });
    uiRoot.append(this.ui);
    this.raycaster = new THREE.Raycaster(); this.raycaster.params.Points = { threshold: 6 };
    this._bind();
  }

  _build() {
    const rnd = mulberry32(3);
    // background stars
    const N = 2500, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = 1500 + rnd() * 1500; const s = Math.sqrt(1 - u * u); pos.set([Math.cos(th) * s * r, u * r, Math.sin(th) * s * r], i * 3); }
    const bg = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), new THREE.PointsMaterial({ size: 2.2, color: '#9fb3d9', sizeAttenuation: false, transparent: true, opacity: 0.7 }));
    this.scene.add(bg);
    // nebulae
    const neb = canvasTex(256, 256, (ctx) => { const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.4, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256); });
    for (const [s, c] of Object.entries(this.L.centers)) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: neb.tex, color: SUBJECTS[s].color, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.position.set(...c); sp.scale.setScalar(420); this.scene.add(sp);
      const el = h('div', { class: 'cs-label', style: { color: SUBJECTS[s].color, fontSize: '18px' } }, `${SUBJECTS[s].icon} ${SUBJECTS[s].name}`);
      const lab = new CSS2DObject(el); lab.position.set(c[0], c[1] + 120, c[2]); this.scene.add(lab);
    }
    // nodes
    const n = this.L.nodes.length;
    this.nodeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffffff' }), n);
    this.nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.nodeMesh);
    // halo sprites for mastered nodes
    this.halos = [];
    const halo = canvasTex(128, 128, (ctx) => { const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.25, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); });
    for (const nd of this.L.nodes) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo.tex, color: SUBJECTS[nd.subject].glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.position.set(nd.x, nd.y, nd.z); this.scene.add(sp); this.halos.push(sp);
    }
    // topic labels
    for (const t of TOPICS) {
      const c = this.L.topicCenters[t.id];
      const el = h('div', { class: 'cs-label', style: { color: SUBJECTS[t.subject].glow, fontSize: '10.5px', opacity: 0.7 } }, `${t.id} ${t.title}`);
      const lab = new CSS2DObject(el); lab.position.set(c[0], c[1] + 16, c[2]); this.scene.add(lab);
    }
    // links
    const lp = new Float32Array(LINKS.length * 6);
    LINKS.forEach((l, i) => { const a = this.L.nodes[this.L.index[l.a]], b = this.L.nodes[this.L.index[l.b]]; lp.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6); });
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(LINKS.length * 6), 3));
    this.linkMesh = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(this.linkMesh);
    // selection ring
    this.sel = new THREE.Mesh(new THREE.TorusGeometry(9, 0.6, 8, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 0.8) })); this.sel.visible = false; this.scene.add(this.sel);
  }

  refresh() {
    const d = new THREE.Object3D(), c = new THREE.Color();
    this.L.nodes.forEach((nd, i) => {
      const st = subStats(nd.id);
      const s = st.any ? 3 + st.frac * 3.5 : 2.2;
      d.position.set(nd.x, nd.y, nd.z); d.scale.setScalar(s); d.updateMatrix(); this.nodeMesh.setMatrixAt(i, d.matrix);
      if (st.any) c.set(SUBJECTS[nd.subject].glow).multiplyScalar(0.75 + st.frac * 1.1); else c.set('#3b4560');
      if (this.filter !== 'all' && this.filter !== nd.subject && this.filter !== 'cross') c.multiplyScalar(0.15);
      this.nodeMesh.setColorAt(i, c);
      this.halos[i].material.opacity = st.any ? 0.1 + st.frac * 0.32 : 0;
      this.halos[i].scale.setScalar(st.any ? 14 + st.frac * 16 : 1);
    });
    this.nodeMesh.instanceMatrix.needsUpdate = true; this.nodeMesh.instanceColor.needsUpdate = true;
    const col = this.linkMesh.geometry.attributes.color;
    const gold = new THREE.Color(1.5, 1.1, 0.3);
    LINKS.forEach((l, i) => {
      const s = linkState(l);
      let a = new THREE.Color(0, 0, 0), b = a;
      const show = this.filter === 'all' || (this.filter === 'cross' ? l.cross : (l.a[0] === this.filter || l.b[0] === this.filter));
      if (show && s === 2) { a = l.cross ? gold : new THREE.Color(SUBJECTS[l.a[0]].glow).multiplyScalar(0.9); b = l.cross ? gold : a; }
      else if (show && s === 1) { a = new THREE.Color('#2b3a64').multiplyScalar(1.2); b = a; }
      else if (show && this.reveal) { a = new THREE.Color('#151d33'); b = a; }
      col.array.set([a.r, a.g, a.b, b.r, b.g, b.b], i * 6);
    });
    col.needsUpdate = true;
    this._renderTop();
  }

  enter() {
    this.controls.enabled = true;
    this.ui.classList.remove('hidden');
    this._renderUI();
    this.refresh();
    if (game.world?.sky.night > 0.5) grant('stargazer');
    audio.setMood('night');
  }
  leave() { this.controls.enabled = false; this.ui.classList.add('hidden'); this.sel.visible = false; this.tip?.remove(); }

  _renderUI() {
    clear(this.ui);
    this.top = h('div', { class: 'cs-top' });
    this.info = h('div', { class: 'cs-info glass' });
    this.legend = h('div', { class: 'cs-legend glass' },
      h('div', null, '● Star = a lesson (sub-topic). Brighter = more mastered.'),
      h('div', null, h('span', { style: { color: '#ffd166' } }, '━'), ' Golden line = cross-subject connection sparked'),
      h('div', null, h('span', { style: { color: '#4b5a8a' } }, '━'), ' Dim line = both ideas discovered — practise both to spark'),
      h('div', { class: 'faint' }, 'Drag to orbit · scroll to zoom · click a star'));
    this.tip = h('div', { class: 'cs-tip glass hidden' });
    this.ui.append(this.top, this.info, this.legend, this.tip);
    this._renderTop();
    this._renderInfo(null);
  }
  _renderTop() {
    if (!this.top) return;
    clear(this.top);
    const seg = h('div', { class: 'seg' });
    for (const [v, l] of [['all', 'All'], ['cross', '✦ Cross-links'], ['B', '🧬 Biology'], ['C', '⚗️ Chemistry'], ['P', '⚛️ Physics']]) seg.append(h('span', { class: this.filter === v ? 'on' : '', onClick: () => { audio.click(); this.filter = v; this.refresh(); } }, l));
    const all = coverage();
    this.top.append(
      h('div', { class: 'glass row' }, h('div', { style: { fontSize: '20px' } }, '✨'), h('div', null, h('div', { style: { fontFamily: 'var(--display)', fontWeight: 700 } }, 'Constellation of Knowledge'), h('div', { class: 'faint', style: { fontSize: '.8em' } }, `${all.seen}/${all.total} objectives discovered · ${sparkedCount()}/${LINKS.length} connections sparked`))),
      h('div', { class: 'glass' }, seg),
      h('div', { class: 'glass row' }, h('span', { class: 'faint', style: { fontSize: '.85em' } }, 'Show hidden links'), (() => { const s = h('div', { class: `switch ${this.reveal ? 'on' : ''}` }); s.addEventListener('click', () => { this.reveal = !this.reveal; s.classList.toggle('on', this.reveal); this.refresh(); }); return s; })()),
      h('div', { class: 'grow' }),
      h('button', { class: 'btn', onClick: () => { audio.click(); game.closeConstellation(); } }, '↩ Back to island'));
  }
  _renderInfo(id) {
    clear(this.info);
    if (!id) {
      this.info.append(h('div', { class: 'eyebrow' }, 'How it works'), h('h3', { style: { margin: '6px 0 10px' } }, 'One island, one web of ideas'),
        h('p', { class: 'muted', style: { lineHeight: 1.65 } }, `Each of the ${COUNTS.subtopics} stars is one lesson from the syllabus. Stars brighten as you discover, practise and master their objectives. The lines are explained connections — ${LINKS.filter((l) => l.cross).length} of them cross between Biology, Chemistry and Physics.`),
        h('p', { class: 'muted', style: { lineHeight: 1.65 } }, 'Spark a connection by practising both of its ideas, or by solving a cause-and-effect chain in a quest. At night the same constellation glows in the sky above Brightwater.'));
      const top = LINKS.filter((l) => l.cross && linkState(l) === 2).slice(-5).reverse();
      if (top.length) { this.info.append(h('div', { class: 'eyebrow', style: { marginTop: '14px' } }, 'Recently sparked')); for (const l of top) this.info.append(h('div', { class: 'link-card', style: { marginTop: '8px' } }, h('b', null, `${SUB[l.a].title} ↔ ${SUB[l.b].title}`), h('div', { class: 'muted', style: { marginTop: '4px', fontSize: '.9em' } }, l.text))); }
      return;
    }
    const st = SUB[id], ss = subStats(id), S = SUBJECTS[st.subject];
    this.info.append(h('div', { class: 'eyebrow', style: { color: S.color } }, `${S.icon} ${S.name} · ${st.topic}`), h('h3', { style: { margin: '6px 0 6px' } }, `${id} ${st.title}`),
      h('div', { class: 'bar', style: { margin: '8px 0 12px' } }, h('i', { style: { width: `${ss.frac * 100}%`, background: S.color } })),
      h('div', { class: 'muted', style: { lineHeight: 1.6, fontSize: '.92em' }, html: rich(st.summary) }),
      h('div', { class: 'row', style: { margin: '12px 0', gap: '8px' } }, h('button', { class: 'btn small primary', onClick: () => game.ui.openCodex(id) }, '📚 Lesson'), h('button', { class: 'btn small', onClick: () => game.ui.quiz({ title: `${id} ${st.title}`, subs: [id], n: 3 }).then(() => this.refresh()) }, '🎯 Practise')));
    const ls = linksOf(id);
    this.info.append(h('div', { class: 'eyebrow' }, `Connections · ${ls.length}`));
    for (const l of ls) {
      const o = l.a === id ? l.b : l.a, s2 = linkState(l);
      this.info.append(h('div', { class: `link-card ${s2 ? '' : 'locked'}`, style: { marginTop: '8px' }, onClick: () => this.focus(o) },
        h('div', { class: 'row' }, h('span', { class: `chip ${o[0]}` }, o), h('b', null, SUB[o].title), h('div', { class: 'grow' }), s2 === 2 ? h('span', { class: 'chip gold' }, '✨') : null),
        h('div', { style: { marginTop: '6px', fontSize: '.9em' }, class: s2 ? 'muted' : 'faint' }, s2 ? l.text : 'Discover both ideas to reveal this connection.')));
    }
  }
  focus(id) {
    const nd = this.L.nodes[this.L.index[id]]; if (!nd) return;
    audio.discover();
    this.sel.visible = true; this.sel.position.set(nd.x, nd.y, nd.z);
    this.controls.autoRotate = false;
    const t0 = this.controls.target.clone(), t1 = new THREE.Vector3(nd.x, nd.y, nd.z);
    const p0 = this.camera.position.clone(); const dir = p0.clone().sub(t0).normalize(); const p1 = t1.clone().add(dir.multiplyScalar(220));
    let k = 0; const step = () => { k = Math.min(1, k + 0.04); const e = k * k * (3 - 2 * k); this.controls.target.lerpVectors(t0, t1, e); this.camera.position.lerpVectors(p0, p1, e); if (k < 1) requestAnimationFrame(step); }; step();
    this._renderInfo(id);
  }

  _bind() {
    const cv = this.engine.canvas;
    let down = null;
    const pick = (e) => {
      const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      const hit = this.raycaster.intersectObject(this.nodeMesh, false)[0];
      return hit ? this.L.nodes[hit.instanceId] : null;
    };
    cv.addEventListener('pointerdown', (e) => { if (this.engine.view === this) down = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener('pointerup', (e) => {
      if (this.engine.view !== this || !down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
      if (moved > 5) return;
      const nd = pick(e); if (nd) this.focus(nd.id);
    });
    cv.addEventListener('pointermove', (e) => {
      if (this.engine.view !== this || !this.tip) return;
      const nd = pick(e);
      if (nd) { const st = SUB[nd.id]; this.tip.classList.remove('hidden'); this.tip.style.left = e.clientX + 14 + 'px'; this.tip.style.top = e.clientY + 10 + 'px'; this.tip.textContent = `${nd.id} ${st.title}`; cv.style.cursor = 'pointer'; }
      else { this.tip.classList.add('hidden'); cv.style.cursor = ''; }
    });
  }
  resize(w, hh) { this.camera.aspect = w / hh; this.camera.updateProjectionMatrix(); }
  update(dt, t) { this.controls.update(); if (this.sel.visible) { this.sel.lookAt(this.camera.position); this.sel.scale.setScalar(1 + Math.sin(t * 4) * 0.08); } }
}
