import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { META, loaderFor } from './registry.js';
import { LabUI } from './labui.js';
import { canvasTex, roundRect, h, tweens, ease, disposeTree, mulberry32 } from '../core/util.js';
import { state, save, raise, addXP, checkAchievements } from '../core/state.js';
import { bus } from '../core/events.js';
import { audio } from '../core/audio.js';
import { SUBJECTS, isSupplementOnly } from '../data/curriculum.js';
import { game } from '../game.js';

const BENCH_Y = 0.9;

export class LabView {
  constructor(engine, uiRoot) {
    this.engine = engine;
    this.registry = META;
    this.scene = new THREE.Scene();
    this.scene.environment = engine.envMap;
    this.scene.environmentIntensity = 0.6;
    this.camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.02, 80);
    this.camera.position.set(0, 1.55, 1.5);
    this.labels = engine.createLabelLayer();
    this.ui = new LabUI(uiRoot);
    this.bloom = { strength: 0.45, radius: 0.5, threshold: 1.9 };
    this.controls = new OrbitControls(this.camera, engine.canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 0.25, maxDistance: 3.4, minPolarAngle: 0.2, maxPolarAngle: 1.5, screenSpacePanning: true, rotateSpeed: 0.6, zoomSpeed: 0.8 });
    this.controls.target.set(0, 1.0, 0);
    this.controls.enabled = false;
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.interactives = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-9, -9);
    this._buildRooms();
    this._bindPointer();
    this.active = null;
  }

  // ------------------------------------------------------------ rooms
  _buildRooms() {
    // ---- laboratory
    const lab = (this.labRoom = new THREE.Group());
    const floorTex = canvasTex(512, 512, (ctx, w, hh) => { ctx.fillStyle = '#c9cdd4'; ctx.fillRect(0, 0, w, hh); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { ctx.fillStyle = (i + j) % 2 ? '#bfc4cc' : '#d3d7de'; ctx.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); } });
    floorTex.tex.wrapS = floorTex.tex.wrapT = THREE.RepeatWrapping; floorTex.tex.repeat.set(6, 6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ map: floorTex.tex, roughness: 0.6 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; lab.add(floor);
    const wallM = new THREE.MeshStandardMaterial({ color: '#e8eaee', roughness: 0.9 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), wallM); back.position.set(0, 2.5, -2.2); back.receiveShadow = true; lab.add(back);
    for (const s of [-1, 1]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), wallM); side.position.set(s * 5, 2.5, 2.5); side.rotation.y = -s * Math.PI / 2; lab.add(side); }
    // windows (bright panels)
    const winM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 2.1, 2.3) });
    for (const x of [-3.2, 3.2]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.4), winM); w.position.set(x, 2.1, -2.19); lab.add(w); const fr = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 0.04), new THREE.MeshStandardMaterial({ color: '#94a3b8' })); fr.position.set(x, 2.1, -2.22); lab.add(fr); }
    // poster: periodic table impression + whiteboard
    const poster = canvasTex(1024, 600, (ctx, w, hh) => {
      ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, w, hh); ctx.fillStyle = '#e2e8f0'; ctx.font = '700 44px Outfit, Inter'; ctx.fillText('The Periodic Table of the Elements', 40, 64);
      const cols = 18, rows = 7, cw = 52, ch = 62, ox = 40, oy = 100; const shape = (r, c) => (r === 0 ? c === 0 || c === 17 : r < 3 ? c < 2 || c > 11 : true);
      const pal = ['#f87171', '#fbbf24', '#a3e635', '#34d399', '#22d3ee', '#818cf8', '#e879f9'];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (!shape(r, c)) continue; ctx.fillStyle = c < 2 ? pal[0] : c > 11 ? (c === 17 ? pal[5] : pal[3]) : pal[1]; ctx.globalAlpha = 0.85; roundRect(ctx, ox + c * cw, oy + r * ch, cw - 5, ch - 5, 6); ctx.fill(); }
      ctx.globalAlpha = 1;
    });
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.29), new THREE.MeshStandardMaterial({ map: poster.tex, roughness: 0.7 })); pm.position.set(0, 2.25, -2.18); lab.add(pm);
    // shelves with bottles
    const shelfM = new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.7 });
    const rnd = mulberry32(5);
    for (const x of [-3.2, 3.2]) for (const y of [0.9, 1.25]) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.03, 0.3), shelfM); sh.position.set(x, y, -2.05); sh.castShadow = true; lab.add(sh);
      for (let k = 0; k < 9; k++) { const bc = ['#f59e0b', '#22d3ee', '#a78bfa', '#f472b6', '#84cc16', '#fef3c7'][k % 6]; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.16 + rnd() * 0.1, 12), new THREE.MeshPhysicalMaterial({ color: bc, transparent: true, opacity: 0.7, roughness: 0.1 })); b.position.set(x - 0.8 + k * 0.2, y + 0.1, -2.05); lab.add(b); }
    }
    // bench
    const benchTop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.05, 1.3), new THREE.MeshStandardMaterial({ color: '#263241', roughness: 0.35, metalness: 0.1 }));
    benchTop.position.set(0, BENCH_Y - 0.025, 0); benchTop.receiveShadow = true; benchTop.castShadow = true; lab.add(benchTop); this.benchTop = benchTop;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.3, BENCH_Y - 0.05, 1.2), new THREE.MeshStandardMaterial({ color: '#dfe6ee', roughness: 0.7 })); cab.position.set(0, (BENCH_Y - 0.05) / 2, 0); cab.receiveShadow = true; lab.add(cab);
    for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.5, 0.01), new THREE.MeshStandardMaterial({ color: '#cbd5e1' })); d.position.set(-1.2 + i * 0.8, 0.45, 0.605); lab.add(d); const hd = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.8 })); hd.position.set(-1.2 + i * 0.8, 0.62, 0.62); lab.add(hd); }
    // pendant lights
    for (const x of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.3, 2.1) })); l.position.set(x, 3.0, 0); lab.add(l); }
    const hemi = new THREE.HemisphereLight('#ffffff', '#8a8f99', 0.75); lab.add(hemi);
    const key = new THREE.DirectionalLight('#fff6e6', 1.9); key.position.set(1.5, 3.2, 1.8); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 8 }); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.01;
    lab.add(key, key.target); key.target.position.set(0, BENCH_Y, 0);
    const fill = new THREE.PointLight('#cfe3ff', 6, 8, 2); fill.position.set(-2, 2.4, 1.5); lab.add(fill);
    this.scene.add(lab);

    // ---- holo theatre
    const holo = (this.holoRoom = new THREE.Group());
    const hf = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.MeshStandardMaterial({ color: '#070b16', roughness: 0.4, metalness: 0.3 })); hf.rotation.x = -Math.PI / 2; hf.receiveShadow = true; holo.add(hf);
    const grid = new THREE.GridHelper(16, 64, '#1e3a5f', '#10213a'); grid.position.y = 0.002; holo.add(grid);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.5, 48), new THREE.MeshStandardMaterial({ color: '#111827', metalness: 0.7, roughness: 0.3 })); ped.position.y = 0.25; ped.castShadow = true; ped.receiveShadow = true; holo.add(ped);
    this.holoRing = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.015, 8, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.6, 2.4) })); this.holoRing.rotation.x = Math.PI / 2; this.holoRing.position.y = 0.51; holo.add(this.holoRing);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 2.4, 48, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.8, 0.9), transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 1.7; holo.add(beam);
    const hHemi = new THREE.HemisphereLight('#bfe8ff', '#0b1020', 1.2); holo.add(hHemi);
    const hKey = new THREE.DirectionalLight('#ffffff', 2.4); hKey.position.set(2, 4, 3); hKey.castShadow = true; hKey.shadow.mapSize.set(1024, 1024); Object.assign(hKey.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1 }); holo.add(hKey);
    const rim = new THREE.PointLight('#5eead4', 20, 6, 2); rim.position.set(-1.5, 2.5, -1.5); holo.add(rim);
    const rim2 = new THREE.PointLight('#8ea2ff', 16, 6, 2); rim2.position.set(1.8, 1.5, -1.2); holo.add(rim2);
    this.holoDust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 900 }, () => (Math.random() - 0.5) * 8), 3)), new THREE.PointsMaterial({ size: 0.012, color: '#5eead4', transparent: true, opacity: 0.5 }));
    holo.add(this.holoDust);
    holo.visible = false;
    this.scene.add(holo);
    this.scene.background = new THREE.Color('#dfe4ea');
  }

  setRoom(kind) {
    const isHolo = kind === 'holo';
    this.labRoom.visible = !isHolo; this.holoRoom.visible = isHolo;
    this.scene.background = new THREE.Color(isHolo ? '#03060d' : '#dfe4ea');
    this.scene.fog = isHolo ? new THREE.Fog('#03060d', 4, 12) : null;
    this.bloom = isHolo ? { strength: 0.6, radius: 0.55, threshold: 1.4 } : { strength: 0.45, radius: 0.5, threshold: 1.9 };
  }

  // ------------------------------------------------------------ registry helpers
  entry(id) { return META.find((m) => m.id === id); }
  isAvailable(id) { return !!loaderFor(id); }
  isUnlocked(id) { return state.settings.teacher || !!state.exps[id]?.unlocked || !!state.holos[id]?.unlocked || !!state.exps[id]?.done || !!state.holos[id]?.done; }
  unlock(id) {
    const m = this.entry(id); if (!m) return;
    const bag = m.kind === 'holo' ? state.holos : state.exps;
    if (!bag[id]) bag[id] = {};
    if (!bag[id].unlocked) { bag[id].unlocked = true; save(); game.ui?.toast(m.icon, `Unlocked: <b>${m.title}</b> (${m.kind === 'holo' ? 'Holo-Theatre' : 'Lumen Lab'})`); }
  }

  // ------------------------------------------------------------ open / close
  async open(id, opts = {}) {
    const m = this.entry(id);
    const loader = loaderFor(id);
    if (!m || !loader) { game.ui.toast('🧪', `<b>${m?.title || id}</b> is still being built in this version.`); return false; }
    this.close(true);
    this.setRoom(m.kind);
    this._sessionComplete = false;
    let mod;
    try { mod = await loader(); } catch (e) { console.error(e); game.ui.toast('⚠️', `Could not load ${m.title}.`); return false; }
    const Klass = mod.default;
    this.meta = m;
    this.opts = opts;
    this.active = new Klass(this, opts, m);
    const bag = m.kind === 'holo' ? state.holos : state.exps;
    if (!bag[id]) bag[id] = {};
    bag[id].unlocked = true; bag[id].opened = (bag[id].opened || 0) + 1;
    const questStep = opts.quest ? game.quests.stepOf(opts.quest) : null;
    // a tab whose objectives are all Supplement is optional on the Core tier
    this.optionalTabs = state.settings.tier === 'extended' ? [] : (m.tabs || []).filter((t) => isSupplementOnly(this.active.tabObjectives?.[t] || []));
    const tabs = m.tabs ? (this.active.tabLabels || m.tabs.map((t) => [t, t])).map(([t, l]) => [t, this.optionalTabs.includes(t) ? `${l} · optional (S)` : l]) : null;
    const done = bag[id].goals || {};
    this.ui.mount(m, {
      onExit: () => game.closeLab(),
      onReset: this.active.reset ? () => this.active.reset() : null,
      tabs, activeTab: opts.tab || (tabs ? tabs[0][0] : null), done,
      onTab: (t) => this.active.setTab?.(t),
      scenario: this.active.scenario,
      goalText: questStep ? questStep.text : null,
    });
    raise(m.objectives, 1, 'lab');
    this.controls.enabled = true;
    this.applyOffset();
    await this.active.build?.();
    const firstTab = tabs ? (opts.tab || tabs[0][0]) : null;
    if (tabs && this.active.setTab) this.active.setTab(firstTab);
    this.frame((firstTab && this.active.tabViews?.[firstTab]) || this.active.view || null, true);
    audio.setMood('lab');
    this.ui.focusStart();
    return true;
  }

  close(silent = false) {
    if (this.active) { try { this.active.dispose?.(); } catch (e) { console.error(e); } }
    this.active = null;
    this.applyOffset();
    this.clearRoot();
    this.ui.hide();
    this.engine.setOutline([]);
    this.controls.enabled = false;
    if (!silent) audio.setMood('world');
  }

  clearRoot(target = this.root) {
    this.interactives = this.interactives.filter((it) => { let o = it.obj; while (o) { if (o === target) return false; o = o.parent; } return true; });
    for (const c of [...target.children]) { target.remove(c); disposeTree(c); }
  }

  /** Smoothly frame the camera. view = { pos:[x,y,z], target:[x,y,z] } */
  frame(view, instant = false) {
    const v = view || (this.meta?.kind === 'holo' ? { pos: [0, 1.75, 2.7], target: [0, 1.25, 0] } : { pos: [0, 1.56, 1.3], target: [0, 0.99, 0] });
    const p = new THREE.Vector3(...v.pos), t = new THREE.Vector3(...v.target);
    if (instant) { this.camera.position.copy(p); this.controls.target.copy(t); this.controls.update(); return; }
    const p0 = this.camera.position.clone(), t0 = this.controls.target.clone();
    tweens.tween(0.8, (e) => { this.camera.position.lerpVectors(p0, p, e); this.controls.target.lerpVectors(t0, t, e); }, { ease: ease.inOut });
  }

  // ------------------------------------------------------------ module API
  add(obj, x = 0, y = BENCH_Y, z = 0) { obj.position.set(x, y, z); (this.tabRoot || this.root).add(obj); return obj; }
  get benchY() { return BENCH_Y; }

  /** Make an object clickable/hoverable. opts: { label, onClick, onDown, tip, cursor } */
  interactive(obj, opts = {}) { this.interactives.push({ obj, ...opts }); return obj; }
  removeInteractive(obj) { this.interactives = this.interactives.filter((i) => i.obj !== obj); }

  /** Drag an object on a plane. opts: { axis: 'x'|'y'|'z'|'xz', min, max, onMove(pos), onEnd(pos) } */
  draggable(obj, opts = {}) { this.interactives.push({ obj, drag: { axis: 'xz', ...opts }, label: opts.label, tip: opts.tip }); return obj; }

  label(obj, text, { y = 0.1, x = 0, z = 0, cls = '', always = true } = {}) {
    const el = h('div', { class: `lab-label ${cls}` }, text);
    const l = new CSS2DObject(el); l.position.set(x, y, z); obj.add(l);
    l.userData.set = (t) => { el.textContent = t; };
    l.userData.el = el;
    if (!always) el.style.opacity = '0';
    return l;
  }

  goal(name) {
    const m = this.meta; if (!m) return;
    const bag = m.kind === 'holo' ? state.holos : state.exps;
    const rec = (bag[m.id] = bag[m.id] || {}); rec.goals = rec.goals || {};
    if (rec.goals[name]) return;
    rec.goals[name] = true;
    save();
    bus.emit('exp:goal', m.id, name);
    if (m.tabs && m.tabs.includes(name)) {
      this.ui.markTab(name);
      // no practical credit here: the tab's checklist credited its hands-on steps as they were done
      addXP(40, 'lab');
      game.ui.toast(m.icon, `<b>${m.title}</b> — “${(this.active?.tabLabels || []).find((t) => t[0] === name)?.[1] || name}” complete!`, 'good');
      audio.success();
      if (m.tabs.every((t) => rec.goals[t] || this.optionalTabs?.includes(t))) this.complete();
    }
  }

  /** Complete the open experiment or model. Runs once per visit, however many paths ask for it. */
  complete() {
    const m = this.meta; if (!m || this._sessionComplete) return;
    this._sessionComplete = true;
    const bag = m.kind === 'holo' ? state.holos : state.exps;
    const rec = (bag[m.id] = bag[m.id] || {}); rec.goals = rec.goals || {};
    const first = !rec.done;
    rec.done = true; rec.goals.complete = true;
    // A model is explored (seen). An experiment's practical work was credited by its checklist as the
    // hands-on steps were done (practical.js), and its answers as they were given, so completing adds nothing.
    if (m.kind === 'holo') raise(m.objectives, 1, 'holo');
    if (first) { addXP(m.kind === 'holo' ? 50 : 80, 'lab'); state.stats.experiments++; }
    save();
    checkAchievements();
    bus.emit('exp:goal', m.id, 'complete');
    if (m.kind === 'holo') bus.emit('holo:done', m.id);
    if (first) { audio.complete(); game.ui.toast(m.icon, `<b>${m.title} complete!</b> Your practical work and answers are saved as evidence in the Codex.`, 'gold'); this.ui.note(`🏅 <b>${m.kind === 'holo' ? 'Model' : 'Experiment'} complete.</b> You can keep exploring, or return to the island.`, 'gold'); }
  }

  // ------------------------------------------------------------ input
  _bindPointer() {
    const cv = this.engine.canvas;
    let dragging = null, downAt = null;
    const plane = new THREE.Plane(), hit = new THREE.Vector3(), offset = new THREE.Vector3();
    const setPointer = (e) => { this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); };
    const pick = () => {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const objs = this.interactives.filter((i) => i.obj.visible !== false && isVisible(i.obj)).map((i) => i.obj);
      const hits = this.raycaster.intersectObjects(objs, true);
      for (const hh of hits) { let o = hh.object; while (o) { const it = this.interactives.find((i) => i.obj === o); if (it) return { it, point: hh.point }; o = o.parent; } }
      return null;
    };
    cv.addEventListener('pointermove', (e) => {
      if (this.engine.view !== this || !this.active) return;
      setPointer(e);
      if (dragging) {
        this.raycaster.setFromCamera(this.pointer, this.camera);
        if (this.raycaster.ray.intersectPlane(plane, hit)) {
          const d = dragging.it.drag, o = dragging.it.obj;
          const local = o.parent.worldToLocal(hit.clone().sub(offset));
          const np = o.position.clone();
          if (d.axis.includes('x')) np.x = clamp3(local.x, d.min?.x ?? d.min, d.max?.x ?? d.max);
          if (d.axis.includes('z')) np.z = clamp3(local.z, d.min?.z ?? d.min, d.max?.z ?? d.max);
          if (d.axis === 'y') np.y = clamp3(local.y, d.min, d.max);
          o.position.copy(np);
          d.onMove?.(np);
        }
        return;
      }
      const p = pick();
      const it = p?.it;
      if (it !== this.hovered) {
        this.hovered = it;
        this.engine.setOutline(it ? [it.obj] : []);
        cv.style.cursor = it ? (it.drag ? 'grab' : 'pointer') : '';
        if (it?.tip || it?.label) this.ui.hint(it.tip || it.label); else if (!it) this.ui.hint(this.active?.defaultHint || '');
        if (it) audio.hover();
      }
    });
    cv.addEventListener('pointerdown', (e) => {
      if (this.engine.view !== this || !this.active) return;
      setPointer(e); downAt = { x: e.clientX, y: e.clientY };
      const p = pick();
      if (p?.it?.drag && p.it.drag.enabled?.() !== false) {
        const o = p.it.obj; const wp = new THREE.Vector3(); o.getWorldPosition(wp);
        if (p.it.drag.axis === 'y') { const n = new THREE.Vector3(); this.camera.getWorldDirection(n); n.y = 0; n.normalize(); plane.setFromNormalAndCoplanarPoint(n, wp); }
        else plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), wp);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        this.raycaster.ray.intersectPlane(plane, hit); offset.copy(hit).sub(wp);
        dragging = p; this.controls.enabled = false; cv.style.cursor = 'grabbing'; p.it.drag.onStart?.();
      } else if (p?.it?.onDown) p.it.onDown(p.point);
    });
    window.addEventListener('pointerup', (e) => {
      if (this.engine.view !== this || !this.active) { dragging = null; return; }
      if (dragging) { dragging.it.drag.onEnd?.(dragging.it.obj.position); dragging = null; this.controls.enabled = true; cv.style.cursor = 'grab'; return; }
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5 || e.target !== cv) { downAt = null; return; }
      downAt = null;
      setPointer(e);
      const p = pick();
      if (p?.it?.onClick) { audio.click(); p.it.onClick(p.point); }
    });
  }

  resize(w, hh) { this.camera.aspect = w / hh; this.applyOffset(); }
  /** Centre the 3D scene in the space left of the side panel. */
  applyOffset() {
    const w = innerWidth, hh = innerHeight;
    const panel = this.active && w > 900 ? 410 : 0;
    if (panel) this.camera.setViewOffset(w, hh, panel / 2, 0, w, hh); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }
  update(dt, t) {
    this.controls.update();
    if (this.holoRoom.visible) { this.holoRing.material.color.setRGB(0.4, 2.2 + Math.sin(t * 2) * 0.4, 2.2); this.holoDust.rotation.y += dt * 0.02; }
    if (this.active?.update) { try { this.active.update(dt, t); } catch (e) { console.error(e); this.active.update = null; } }
  }
}

function clamp3(v, a, b) { if (a != null && v < a) return a; if (b != null && v > b) return b; return v; }
function isVisible(o) { while (o) { if (o.visible === false) return false; o = o.parent; } return true; }
export { BENCH_Y };
void SUBJECTS;
