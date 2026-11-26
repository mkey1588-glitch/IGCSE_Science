import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildTerrain, buildDepthTexture, buildWater, heightAt, coastRadius, roadDist, zoneAt, scatter } from './terrain.js';
import { Sky } from './sky.js';
import { buildZones } from './zones.js';
import { MATS } from './kit.js';
import { Character, makeMarker } from './characters.js';
import { ZONES, ZONE, NPCS, POIS } from '../data/world.js';
import { state, save, subStats, linkState } from '../core/state.js';
import { bus } from '../core/events.js';
import { audio } from '../core/audio.js';
import { game } from '../game.js';
import { clamp, damp, lerp, mulberry32, TAU, h, canvasTex } from '../core/util.js';
import { SUBTOPICS } from '../data/curriculum.js';

const UP = new THREE.Vector3(0, 1, 0);
const CHAR_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.02 });

export class World {
  constructor(engine) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.scene.environment = engine.envMap;
    this.scene.environmentIntensity = 0.25;
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 3200);
    this.labels = engine.createLabelLayer();
    this.bloom = { strength: 0.6, radius: 0.55, threshold: 2.1 };
    this.exposure = 1.0;
    this.mode = 'title';
    this.keys = {};
    this.camYaw = 0.6; this.camPitch = 0.42; this.camDist = 13; this._camDistT = 13;
    this.titleAngle = 0;

    this.scene.add(buildTerrain());
    this.water = buildWater(buildDepthTexture());
    this.scene.add(this.water);
    this.sky = new Sky(this.scene);
    const Z = buildZones();
    this.scene.add(Z.group);
    this.dynamic = Z.dynamic; this.zoneInteract = Z.interact; this.anchors = Z.anchors; this.docks = Z.docks; this.lampMat = Z.lampMat;
    this.colliders = Z.colliders;
    this._buildVegetation();
    this._buildBirds();
    this._buildFireworks();
    this._buildGrid();
    this._buildNPCs();
    this._buildPOIs();
    this._buildPlayer();
    this._buildWaypoint();
    this._bindInput();
    this.raycaster = new THREE.Raycaster();
    this.currentZone = null;
    this._zoneTimer = 0;
    this._stepDist = 0;
    this.refreshSky();
    bus.on('mastery', () => this.refreshSky());
    bus.on('links', () => this.refreshSky());
  }

  // ------------------------------------------------------------------ build
  _buildVegetation() {
    const rnd = mulberry32(31);
    const trunkG = new THREE.CylinderGeometry(0.18, 0.3, 2.2, 6); trunkG.translate(0, 1.1, 0);
    const roundG = new THREE.IcosahedronGeometry(1.6, 0); roundG.translate(0, 3.2, 0);
    const pineG = new THREE.ConeGeometry(1.5, 4.2, 7); pineG.translate(0, 3.6, 0);
    const palmTrunkG = new THREE.CylinderGeometry(0.12, 0.2, 4.6, 6); palmTrunkG.translate(0, 2.3, 0);
    const frondG = new THREE.ConeGeometry(2.2, 0.9, 7); frondG.translate(0, 4.7, 0);
    const trunkM = new THREE.MeshStandardMaterial({ color: '#6b4a2f', flatShading: true, roughness: 0.9 });
    const leafM = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 0.85 });
    const inZone = (x, z, pad = 1.05) => ZONES.some((zn) => zn.id !== 'woods' && Math.hypot(x - zn.x, z - zn.z) < zn.r * pad);
    const blocked = (x, z) => this.colliders.some((c) => c.t === 'c' ? Math.hypot(x - c.x, z - c.z) < c.r + 1.6 : Math.hypot(x - c.x, z - c.z) < Math.max(c.hw, c.hd) + 1.6);
    const W = ZONE.woods;
    const clearings = [[W.x - 2, W.z + 15, 7.5], [W.x + 10, W.z + 12, 6], [W.x + 16, W.z - 12, 8], [W.x + 7, W.z + 7, 3.5], [W.x + 6, W.z - 4, 2.5], [W.x - 12, W.z + 4, 3.5], [W.x - 14, W.z - 9, 5], [W.x + 14, W.z + 9, 4], [W.x, W.z, 4]];
    const okTree = (x, z, hh) => {
      if (hh < 1.6 || roadDist(x, z) < 3.2) return false;
      if (inZone(x, z) || blocked(x, z)) return false;
      if (clearings.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r)) return false;
      return true;
    };
    const woodsPts = [];
    for (let i = 0; i < 900 && woodsPts.length < 230; i++) {
      const a = rnd() * TAU, r = Math.sqrt(rnd()) * 34;
      const x = W.x + Math.cos(a) * r, z = W.z + Math.sin(a) * r, hh = heightAt(x, z);
      if (okTree(x, z, hh)) woodsPts.push([x, hh, z]);
    }
    const islandPts = scatter(300, rnd, (x, z, hh) => okTree(x, z, hh) && Math.hypot(x - W.x, z - W.z) > 36 && rnd() < 0.55);
    const palmPts = scatter(70, rnd, (x, z, hh) => {
      const r = Math.hypot(x, z) / coastRadius(Math.atan2(z, x));
      return hh > 0.9 && hh < 2.6 && r > 0.8 && !inZone(x, z, 0.9) && roadDist(x, z) > 2.5 && !blocked(x, z);
    });
    const add = (pts, trunkGeo, leafGeo, palette, kind) => {
      const tm = new THREE.InstancedMesh(trunkGeo, trunkM, pts.length), lm = new THREE.InstancedMesh(leafGeo, leafM, pts.length);
      const d = new THREE.Object3D(), c = new THREE.Color();
      pts.forEach(([x, y, z], i) => {
        const s = 0.75 + rnd() * 0.7;
        d.position.set(x, y - 0.1, z); d.rotation.set((rnd() - 0.5) * 0.1, rnd() * TAU, (rnd() - 0.5) * 0.1); d.scale.set(s, s * (0.85 + rnd() * 0.35), s); d.updateMatrix();
        tm.setMatrixAt(i, d.matrix); lm.setMatrixAt(i, d.matrix);
        c.set(palette[Math.floor(rnd() * palette.length)]); c.offsetHSL((rnd() - 0.5) * 0.03, 0, (rnd() - 0.5) * 0.06);
        lm.setColorAt(i, c);
        this.colliders.push({ t: 'c', x, z, r: kind === 'palm' ? 0.3 : 0.45 });
      });
      tm.castShadow = lm.castShadow = true; tm.receiveShadow = lm.receiveShadow = true;
      this.scene.add(tm, lm);
    };
    const pines = woodsPts.filter((_, i) => i % 3 === 0), rounds = woodsPts.filter((_, i) => i % 3 !== 0);
    add(rounds.concat(islandPts.filter((_, i) => i % 4 !== 0)), trunkG, roundG, ['#3f8f45', '#4c9a3e', '#2f7a3b', '#5aa64a', '#6aa84f'], 'round');
    add(pines.concat(islandPts.filter((_, i) => i % 4 === 0)), trunkG, pineG, ['#2b6b3b', '#357a44', '#24603a'], 'pine');
    add(palmPts, palmTrunkG, frondG, ['#3d9a3b', '#4fae45', '#5bbd4b'], 'palm');
    // rocks
    const rockPts = scatter(90, rnd, (x, z, hh) => hh > -0.5 && hh < 1.4 && !inZone(x, z, 0.95) && rnd() < 0.6);
    const rockM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#8c8a80', flatShading: true, roughness: 0.95 }), rockPts.length);
    const d = new THREE.Object3D();
    rockPts.forEach(([x, y, z], i) => { const s = 0.4 + rnd() * 1.3; d.position.set(x, y, z); d.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); d.scale.set(s, s * 0.7, s); d.updateMatrix(); rockM.setMatrixAt(i, d.matrix); });
    rockM.castShadow = true; rockM.receiveShadow = true; this.scene.add(rockM);
    // flowers
    const flPts = scatter(650, rnd, (x, z, hh) => hh > 1.8 && roadDist(x, z) > 2 && !inZone(x, z, 0.85));
    const flM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.8 }), flPts.length);
    const cols = ['#f472b6', '#facc15', '#ffffff', '#a78bfa', '#fb7185', '#60a5fa'], c = new THREE.Color();
    flPts.forEach(([x, y, z], i) => { d.position.set(x, y + 0.18, z); d.rotation.set(0, 0, 0); d.scale.setScalar(0.8 + rnd() * 0.8); d.updateMatrix(); flM.setMatrixAt(i, d.matrix); flM.setColorAt(i, c.set(cols[i % cols.length])); });
    this.scene.add(flM);
  }

  _buildBirds() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, -0.9, 0.15, -0.1, 0, 0, -0.2, 0, 0, 0.25, 0.9, 0.15, -0.1, 0, 0, -0.2], 3));
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ color: '#f8fafc', side: THREE.DoubleSide, flatShading: true });
    this.birds = [];
    const H = ZONE.harbour;
    for (let i = 0; i < 12; i++) {
      const b = new THREE.Mesh(g, m);
      b.userData = { cx: i < 8 ? H.x + 10 : 0, cz: i < 8 ? H.z : 0, r: i < 8 ? 18 + Math.random() * 16 : 60 + Math.random() * 60, h: 14 + Math.random() * 14, s: 0.25 + Math.random() * 0.2, p: Math.random() * TAU };
      b.scale.setScalar(1.2);
      this.scene.add(b); this.birds.push(b);
    }
  }

  _buildFireworks() {
    this.fw = [];
    const N = 140;
    const dot = canvasTex(64, 64, (ctx, w, hh) => { const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hh); });
    for (let k = 0; k < 6; k++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      const mat = new THREE.PointsMaterial({ size: 1.6, map: dot.tex, color: new THREE.Color(3, 2, 1), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const p = new THREE.Points(geo, mat); p.visible = false; p.frustumCulled = false;
      p.userData = { vel: new Float32Array(N * 3), t: 99, N };
      this.scene.add(p); this.fw.push(p);
    }
    this._fwTimer = 0;
  }
  _launchFirework() {
    const p = this.fw.find((f) => f.userData.t > 3);
    if (!p) return;
    const u = p.userData, pos = p.geometry.attributes.position.array;
    const cx = (Math.random() - 0.5) * 50, cy = 45 + Math.random() * 25, cz = -10 + (Math.random() - 0.5) * 40;
    for (let i = 0; i < u.N; i++) {
      const th = Math.random() * TAU, ph = Math.acos(2 * Math.random() - 1), sp = 9 + Math.random() * 4;
      pos[i * 3] = cx; pos[i * 3 + 1] = cy; pos[i * 3 + 2] = cz;
      u.vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp; u.vel[i * 3 + 1] = Math.cos(ph) * sp; u.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
    }
    const pal = [[3, 0.6, 0.5], [0.6, 3, 1], [0.6, 1.6, 3.2], [3, 2.4, 0.5], [2.6, 0.8, 3]];
    p.material.color.setRGB(...pal[Math.floor(Math.random() * pal.length)]);
    u.t = 0; p.visible = true; p.geometry.attributes.position.needsUpdate = true;
    setTimeout(() => audio.bang(), 300);
  }

  _buildGrid() {
    this.grid = new Map();
    for (const c of this.colliders) {
      const r = c.t === 'c' ? c.r : Math.hypot(c.hw, c.hd);
      for (let gx = Math.floor((c.x - r) / 10); gx <= Math.floor((c.x + r) / 10); gx++)
        for (let gz = Math.floor((c.z - r) / 10); gz <= Math.floor((c.z + r) / 10); gz++) {
          const k = gx * 1000 + gz; if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(c);
        }
    }
  }

  _bakeCharacter(ch) {
    const groups = [];
    ch.root.traverse((o) => { if (o.isGroup || o === ch.root) groups.push(o); });
    for (const g of groups) {
      const meshes = g.children.filter((o) => o.isMesh && o.material.isMeshStandardMaterial && !o.material.transparent && o.material.side !== THREE.DoubleSide);
      if (meshes.length < 2) continue;
      const geos = meshes.map((m) => {
        m.updateMatrix();
        let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
        geo.applyMatrix4(m.matrix);
        const col = new Float32Array(geo.attributes.position.count * 3); const c = m.material.color;
        for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return geo;
      });
      const merged = mergeGeometries(geos);
      if (!merged) continue;
      const mm = new THREE.Mesh(merged, CHAR_MAT); mm.castShadow = true;
      meshes.forEach((m) => g.remove(m));
      g.add(mm);
    }
  }

  _buildNPCs() {
    this.npcs = {};
    const proxyGeo = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    for (const n of NPCS) {
      const ch = new Character(n.look);
      this._bakeCharacter(ch);
      const y = this.groundAt(n.x, n.z);
      ch.root.position.set(n.x, y, n.z);
      const faces = { N: Math.PI, S: 0, E: Math.PI / 2, W: -Math.PI / 2 };
      ch.root.rotation.y = faces[n.face] ?? 0;
      this.scene.add(ch.root);
      const proxy = new THREE.Mesh(proxyGeo, proxyMat); proxy.position.y = 1; proxy.userData.pick = { kind: 'npc', id: n.id }; ch.root.add(proxy);
      const marker = makeMarker(); marker.position.y = 2.35 * (n.look.small ? 0.8 : 1); ch.root.add(marker); marker.userData.set(null);
      const tag = h('div', { class: 'npc-tag' }, h('div', { class: 'n' }, n.name), h('div', { class: 'r' }, n.role));
      const label = new CSS2DObject(tag); label.position.y = 2.75 * (n.look.small ? 0.82 : 1); ch.root.add(label);
      this.colliders.push({ t: 'c', x: n.x, z: n.z, r: 0.45, h: 1.8 });
      this.npcs[n.id] = { def: n, ch, marker, label, tag, baseYaw: ch.root.rotation.y, proxy };
    }
    this._buildGrid();
  }

  _buildPOIs() {
    this.pois = {};
    const ringGeo = new THREE.TorusGeometry(0.42, 0.04, 6, 28);
    const gemGeo = new THREE.OctahedronGeometry(0.16, 0);
    const proxyGeo = new THREE.SphereGeometry(0.7, 8, 6);
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    for (const p of POIS) {
      const Z = ZONE[p.zone];
      const x = Z.x + p.dx, z = Z.z + p.dz, y = this.groundAt(x, z);
      const g = new THREE.Group(); g.position.set(x, y + 1.3, z);
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.6, 2.2), transparent: true, opacity: 0.95, depthWrite: false });
      const ring = new THREE.Mesh(ringGeo, mat); const gem = new THREE.Mesh(gemGeo, mat);
      const proxy = new THREE.Mesh(proxyGeo, proxyMat); proxy.userData.pick = { kind: 'poi', id: p.id };
      g.add(ring, gem, proxy);
      const tag = h('div', { class: 'poi-tag' }, '◈ ' + p.title);
      const label = new CSS2DObject(tag); label.position.y = 0.75; g.add(label);
      this.scene.add(g);
      this.pois[p.id] = { def: p, g, ring, gem, mat, label, tag, pos: new THREE.Vector3(x, y, z) };
    }
  }

  _buildPlayer() {
    this.player = new Character({ skin: '#c99272', hair: '#2a1b12', hairStyle: 'short', top: '#4f46e5', bottom: '#1f2937', backpack: true });
    this._bakeCharacter(this.player);
    const start = this.anchors.labDoor.clone().add(new THREE.Vector3(1.5, 0, 6));
    this.ppos = state.pos ? new THREE.Vector3(...state.pos) : start;
    this.ppos.y = this.groundAt(this.ppos.x, this.ppos.z);
    this.pvel = new THREE.Vector3();
    this.pyaw = Math.PI;
    this.player.root.position.copy(this.ppos);
    this.scene.add(this.player.root);
    // soft blob shadow helper ring for readability
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2, 1.8), transparent: true, opacity: 0.35, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; this.player.root.add(ring); this.playerRing = ring;
  }

  _buildWaypoint() {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.0, 0.6), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.waypoint = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.9, 40, 16, 1, true), mat);
    this.waypoint.geometry.translate(0, 20, 0);
    this.waypoint.visible = false;
    this.scene.add(this.waypoint);
    const clickMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 2), transparent: true, opacity: 0.8, depthWrite: false });
    this.clickMarker = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.45, 24), clickMat); this.clickMarker.rotation.x = -Math.PI / 2; this.clickMarker.visible = false;
    this.scene.add(this.clickMarker);
  }

  // ------------------------------------------------------------------ input
  _bindInput() {
    const cv = this.engine.canvas;
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys[e.code] = true;
      if (this.engine.view !== this || this.mode !== 'play' || game.ui?.isBlocking()) return;
      if (e.code === 'KeyE' || e.code === 'KeyF') { if (this.focus) this.interact(this.focus); }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    let down = null;
    cv.addEventListener('pointerdown', (e) => {
      if (this.engine.view !== this) return;
      down = { x: e.clientX, y: e.clientY, yaw: this.camYaw, pitch: this.camPitch, moved: 0, id: e.pointerId, btn: e.button };
      cv.setPointerCapture?.(e.pointerId);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!down || this.engine.view !== this) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      down.moved = Math.max(down.moved, Math.abs(dx) + Math.abs(dy));
      if (down.moved > 5 && this.mode === 'play') {
        this.camYaw = down.yaw - dx * 0.006;
        this.camPitch = clamp(down.pitch + dy * 0.004, 0.08, 1.25);
      }
    });
    cv.addEventListener('pointerup', (e) => {
      if (!down || this.engine.view !== this) { down = null; return; }
      const wasClick = down.moved <= 5 && down.btn === 0;
      down = null;
      if (wasClick && this.mode === 'play' && !game.ui?.isBlocking()) this._click(e);
    });
    cv.addEventListener('wheel', (e) => {
      if (this.engine.view !== this || this.mode !== 'play') return;
      this._camDistT = clamp(this._camDistT + e.deltaY * 0.012, 5, 34);
      e.preventDefault();
    }, { passive: false });
  }

  _click(e) {
    const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const proxies = [...Object.values(this.npcs).map((n) => n.proxy), ...Object.values(this.pois).map((p) => p.g.children[2])];
    const hit = this.raycaster.intersectObjects(proxies, false)[0];
    if (hit && hit.object.userData.pick) {
      const t = this._targetFromPick(hit.object.userData.pick);
      if (t) {
        if (t.pos.distanceTo(this.ppos) <= t.r) this.interact(t);
        else this.walkTo(t.pos, t);
        return;
      }
    }
    const terrain = this.scene.getObjectByName('terrain');
    const th = this.raycaster.intersectObject(terrain, false)[0];
    if (th && th.point.y > 0.2) { this.walkTo(th.point); this.clickMarker.position.set(th.point.x, th.point.y + 0.08, th.point.z); this.clickMarker.visible = true; this._clickT = 1; }
  }

  _targetFromPick(p) {
    return this.targets().find((t) => t.kind === p.kind && t.id === p.id);
  }

  walkTo(pos, then = null) { this.auto = { pos: pos.clone(), then, stuck: 0, last: this.ppos.clone() }; }

  /** All interactable targets in the world. */
  targets() {
    if (!this._targets) {
      const list = [];
      for (const n of Object.values(this.npcs)) list.push({ kind: 'npc', id: n.def.id, pos: n.ch.root.position, r: 3.2, label: `Talk to ${n.def.name}`, icon: '💬' });
      for (const p of Object.values(this.pois)) list.push({ kind: 'poi', id: p.def.id, pos: p.pos, r: 3.4, label: `Scan: ${p.def.title}`, icon: '◈' });
      for (const z of this.zoneInteract) list.push({ kind: z.kind, id: z.id, pos: new THREE.Vector3(z.x, z.y, z.z), r: z.r, label: z.label, icon: z.icon });
      this._targets = list;
    }
    return this._targets;
  }

  interact(t) {
    this.auto = null;
    if (t.kind === 'npc') this.faceNPC(t.id);
    game.onInteract?.(t);
  }

  faceNPC(id) {
    const n = this.npcs[id]; if (!n) return;
    const dx = this.ppos.x - n.ch.root.position.x, dz = this.ppos.z - n.ch.root.position.z;
    n.faceTarget = Math.atan2(dx, dz);
    this.pyawTarget = Math.atan2(-dx, -dz);
  }

  // ------------------------------------------------------------------ queries
  onDock(x, z) { for (const d of this.docks) if (x >= d.x1 && x <= d.x2 && z >= d.z1 && z <= d.z2) return d; return null; }
  groundAt(x, z) { const d = this.onDock(x, z); return d ? d.y : heightAt(x, z); }
  walkable(x, z) { if (this.onDock(x, z)) return true; return heightAt(x, z) > 0.35; }
  resolve(p) {
    const gx = Math.floor(p.x / 10), gz = Math.floor(p.z / 10);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const list = this.grid.get((gx + i) * 1000 + gz + j); if (!list) continue;
      for (const c of list) {
        if (c.t === 'c') {
          const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + 0.32;
          if (d < min && d > 1e-5) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min; }
        } else {
          const cs = Math.cos(c.ry), sn = Math.sin(c.ry);
          const dx = p.x - c.x, dz = p.z - c.z;
          let lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
          const hw = c.hw + 0.32, hd = c.hd + 0.32;
          if (Math.abs(lx) < hw && Math.abs(lz) < hd) {
            if (hw - Math.abs(lx) < hd - Math.abs(lz)) lx = Math.sign(lx || 1) * hw; else lz = Math.sign(lz || 1) * hd;
            p.x = c.x + lx * cs + lz * sn; p.z = c.z - lx * sn + lz * cs;
          }
        }
      }
    }
  }

  teleport(pos) {
    this.ppos.set(pos.x, 0, pos.z); this.ppos.y = this.groundAt(pos.x, pos.z); this.pvel.set(0, 0, 0); this.auto = null;
    this.camera.position.copy(this.ppos).add(new THREE.Vector3(0, 8, 12));
  }
  zoneSpawn(id) {
    const z = ZONE[id];
    const dir = new THREE.Vector3(-z.x, 0, -z.z).normalize();
    const p = new THREE.Vector3(z.x + dir.x * (z.r * 0.65), 0, z.z + dir.z * (z.r * 0.65));
    if (id === 'lab') p.set(2, 0, 24);
    return p;
  }

  refreshSky() { this.sky.refreshConstellation(subStats, linkState); }
  beaconProgress() { let n = 0; for (const s of SUBTOPICS) if (subStats(s.id).any) n++; return n / SUBTOPICS.length; }

  // ------------------------------------------------------------------ update
  resize(w, hh) { this.camera.aspect = w / hh; this.camera.updateProjectionMatrix(); }
  onQuality(Q) { this.sky.sun.shadow.mapSize.set(Q.shadowSize, Q.shadowSize); if (this.sky.sun.shadow.map) { this.sky.sun.shadow.map.dispose(); this.sky.sun.shadow.map = null; } }

  update(dt, t) {
    // time of day
    if (this.mode === 'play' && state.settings.cycle) {
      const night = this.sky.night;
      state.time = (state.time + dt / (night > 0.5 ? 150 : 420)) % 1;
    }
    this.sky.setTime(this.mode === 'title' ? 0.71 : state.time);
    const focus = this.mode === 'title' ? new THREE.Vector3(0, 0, 0) : this.ppos;
    this.sky.update(dt, focus, t);
    const night = this.sky.night;
    this.water.material.uniforms.uTime.value = t;
    this.water.material.uniforms.uSunDir.value.copy(this.sky.sunDir);
    this.water.material.uniforms.uSunColor.value.copy(this.sky.uniforms.uSunColor.value);
    this.water.material.uniforms.uSky.value.copy(this.sky.horizon).lerp(this.sky.top, 0.3);
    this.water.material.uniforms.uNight.value = night;
    this.water.material.uniforms.uDeep.value.set('#0a3f73').lerp(new THREE.Color('#020a1a'), night * 0.85);
    this.water.material.uniforms.uShallow.value.set('#2cc9c4').lerp(new THREE.Color('#0b2a3a'), night * 0.85);
    // windows & lamps
    const wn = night;
    // windows glow warmly but stay under the bloom threshold; small lamp heads may bloom
    MATS.glow.color.setRGB(lerp(0.2, 2.4, wn), lerp(0.26, 1.75, wn), lerp(0.34, 0.85, wn));
    this.lampMat.color.setRGB(lerp(0.5, 3.0, wn), lerp(0.48, 2.4, wn), lerp(0.4, 1.2, wn));
    // the studio environment map is daylight-neutral: fade it out at night so moonlight reads as dark blue
    this.scene.environmentIntensity = lerp(0.25, 0.05, night);
    this.exposure = lerp(0.95, 1.0, night);
    this.engine.renderer.toneMappingExposure = this.exposure;
    audio.setAmbience({ ocean: 1, night: night > 0.5 });

    const ctx = { night, flags: state.flags, time: state.time, beacon: this.beaconProgress() };
    for (const d of this.dynamic) d.update(dt, t, ctx);
    for (const b of this.birds) {
      const u = b.userData; u.p += dt * u.s;
      b.position.set(u.cx + Math.cos(u.p) * u.r, u.h + Math.sin(u.p * 3) * 1.5, u.cz + Math.sin(u.p) * u.r);
      b.rotation.y = -u.p; b.scale.y = 1 + Math.sin(t * 9 + u.p * 10) * 0.6;
    }
    // fireworks
    if (state.flags.fireworks && night > 0.5) { this._fwTimer -= dt; if (this._fwTimer < 0) { this._fwTimer = 0.8 + Math.random() * 1.6; this._launchFirework(); } }
    for (const p of this.fw) {
      const u = p.userData; if (u.t > 3) { p.visible = false; continue; }
      u.t += dt; const pos = p.geometry.attributes.position.array;
      for (let i = 0; i < u.N; i++) { u.vel[i * 3 + 1] -= 6 * dt; u.vel[i * 3] *= 0.985; u.vel[i * 3 + 2] *= 0.985; pos[i * 3] += u.vel[i * 3] * dt; pos[i * 3 + 1] += u.vel[i * 3 + 1] * dt; pos[i * 3 + 2] += u.vel[i * 3 + 2] * dt; }
      p.geometry.attributes.position.needsUpdate = true; p.material.opacity = Math.max(0, 1 - u.t / 3);
    }

    if (this.mode === 'title') { this._updateTitleCam(dt); this._updateNPCs(dt, t, false); return; }
    if (this.mode === 'play' && !game.ui?.isBlocking()) this._updatePlayer(dt);
    else { this.pvel.multiplyScalar(0.8); this.player.speed = 0; }
    this.player.update(dt, t);
    this.player.root.position.copy(this.ppos);
    if (this.pyawTarget != null) { this.pyaw = this._lerpAngle(this.pyaw, this.pyawTarget, 1 - Math.exp(-10 * dt)); if (Math.abs(this._angDiff(this.pyaw, this.pyawTarget)) < 0.01) this.pyawTarget = null; }
    this.player.root.rotation.y = this.pyaw;
    this.playerRing.material.opacity = 0.25 + Math.sin(t * 3) * 0.1;
    this._updateNPCs(dt, t, true);
    this._updatePOIs(dt, t);
    this._updateCamera(dt);
    this._updateFocus();
    this._updateWaypoint(t);
    if (this._clickT > 0) { this._clickT -= dt * 1.5; this.clickMarker.scale.setScalar(1 + (1 - this._clickT) * 0.8); this.clickMarker.material.opacity = Math.max(0, this._clickT); if (this._clickT <= 0) this.clickMarker.visible = false; }
    this._zoneTimer -= dt;
    if (this._zoneTimer < 0) {
      this._zoneTimer = 0.5;
      const z = zoneAt(this.ppos.x, this.ppos.z);
      const id = z ? z.id : null;
      if (id !== this.currentZone) {
        this.currentZone = id;
        if (id) { const first = !state.visited[id]; state.visited[id] = true; bus.emit('zone:enter', id, first); }
      }
      state.pos = [this.ppos.x, this.ppos.y, this.ppos.z];
    }
  }

  /** Does scenery occupy the point (x, y, z)? Colliders are treated as prisms of height h (default 7 m). */
  _occludes(x, y, z) {
    const list = this.grid.get(Math.floor(x / 10) * 1000 + Math.floor(z / 10));
    if (!list) return false;
    for (const c of list) {
      const top = (c.base ?? heightAt(c.x, c.z)) + (c.h ?? (c.t === 'c' && c.r < 0.6 ? 5.5 : 7));
      if (y > top) continue;
      if (c.t === 'c') { if (Math.hypot(x - c.x, z - c.z) < c.r + 0.2) return true; }
      else {
        const cs = Math.cos(c.ry), sn = Math.sin(c.ry), dx = x - c.x, dz = z - c.z;
        if (Math.abs(dx * cs - dz * sn) < c.hw + 0.2 && Math.abs(dx * sn + dz * cs) < c.hd + 0.2) return true;
      }
    }
    return false;
  }

  /** True if standing at (x, z) would collide with scenery or water. */
  _blockedAt(x, z) {
    if (!this.walkable(x, z)) return true;
    const p = new THREE.Vector3(x, 0, z), q = p.clone();
    this.resolve(q);
    return q.distanceToSquared(p) > 0.0025;
  }
  /** Local obstacle avoidance for click-to-walk: probe ahead and fan out until a free heading is found. */
  _steer(dir) {
    const probe = 1.6;
    const side = this.auto?.side || 1;
    const fan = [0, 0.45, 0.9, 1.35, 1.8, 2.3];
    for (const a0 of fan) {
      for (const sgn of a0 ? [side, -side] : [1]) {
        const a = a0 * sgn, c = Math.cos(a), s = Math.sin(a);
        const dx = dir.x * c - dir.z * s, dz = dir.x * s + dir.z * c;
        if (!this._blockedAt(this.ppos.x + dx * probe, this.ppos.z + dz * probe) && !this._blockedAt(this.ppos.x + dx * probe * 0.5, this.ppos.z + dz * probe * 0.5)) {
          if (a0 && this.auto) this.auto.side = sgn;
          return new THREE.Vector3(dx, 0, dz);
        }
      }
    }
    return dir;
  }

  _angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
  _lerpAngle(a, b, t) { return a + this._angDiff(a, b) * t; }

  _updatePlayer(dt) {
    const k = this.keys;
    let ix = 0, iz = 0;
    if (k.KeyW || k.ArrowUp) iz -= 1;
    if (k.KeyS || k.ArrowDown) iz += 1;
    if (k.KeyA || k.ArrowLeft) ix -= 1;
    if (k.KeyD || k.ArrowRight) ix += 1;
    const run = k.ShiftLeft || k.ShiftRight;
    const want = new THREE.Vector3();
    if (ix || iz) {
      this.auto = null;
      const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      want.addScaledVector(fwd, -iz).addScaledVector(right, ix).normalize();
    } else if (this.auto) {
      const d = new THREE.Vector3(this.auto.pos.x - this.ppos.x, 0, this.auto.pos.z - this.ppos.z);
      const dist = d.length();
      const stopAt = this.auto.then ? this.auto.then.r * 0.8 : 0.5;
      if (dist < stopAt) { const then = this.auto.then; this.auto = null; if (then) this.interact(then); }
      else {
        want.copy(this._steer(d.normalize()));
        this.auto.stuck += dt;
        if (this.auto.stuck > 1) { if (this.auto.last.distanceTo(this.ppos) < 0.5) this.auto = null; else { this.auto.stuck = 0; this.auto.last.copy(this.ppos); } }
      }
    }
    const speed = run || (this.auto && this.auto.pos.distanceTo(this.ppos) > 25) ? 9.5 : 5.4;
    const target = want.multiplyScalar(speed);
    this.pvel.x = damp(this.pvel.x, target.x, 12, dt);
    this.pvel.z = damp(this.pvel.z, target.z, 12, dt);
    const nx = this.ppos.x + this.pvel.x * dt, nz = this.ppos.z + this.pvel.z * dt;
    const np = new THREE.Vector3(nx, 0, nz);
    this.resolve(np);
    if (this.walkable(np.x, np.z)) { this.ppos.x = np.x; this.ppos.z = np.z; }
    else if (this.walkable(np.x, this.ppos.z)) this.ppos.x = np.x;
    else if (this.walkable(this.ppos.x, np.z)) this.ppos.z = np.z;
    const gy = this.groundAt(this.ppos.x, this.ppos.z);
    this.ppos.y = damp(this.ppos.y, gy, 20, dt);
    const sp = Math.hypot(this.pvel.x, this.pvel.z);
    this.player.speed = sp;
    if (sp > 0.3) { this.pyawTarget = null; this.pyaw = this._lerpAngle(this.pyaw, Math.atan2(this.pvel.x, this.pvel.z), 1 - Math.exp(-12 * dt)); }
    this._stepDist += sp * dt;
    if (this._stepDist > (run ? 1.6 : 1.1)) { this._stepDist = 0; audio.step(); }
  }

  _updateCamera(dt) {
    this.camDist = damp(this.camDist, this._camDistT, 6, dt);
    const target = this.ppos.clone().add(new THREE.Vector3(0, 1.55, 0));
    const cp = Math.cos(this.camPitch);
    const want = new THREE.Vector3(target.x + Math.sin(this.camYaw) * cp * this.camDist, target.y + Math.sin(this.camPitch) * this.camDist, target.z + Math.cos(this.camYaw) * cp * this.camDist);
    const gh = heightAt(want.x, want.z) + 1.0;
    if (want.y < gh) want.y = gh;
    // pull the camera in front of buildings/trees between it and the player
    const steps = 16;
    for (let i = 2; i <= steps; i++) {
      const u = i / steps;
      const x = target.x + (want.x - target.x) * u, y = target.y + (want.y - target.y) * u, z = target.z + (want.z - target.z) * u;
      if (this._occludes(x, y, z)) { want.lerpVectors(target, want, Math.max(0.18, (i - 1.5) / steps)); want.y = Math.max(want.y, target.y + 0.6); break; }
    }
    const k = 1 - Math.exp(-9 * dt);
    this.camera.position.lerp(want, k);
    if (!this._lookAt) this._lookAt = target.clone();
    this._lookAt.lerp(target, 1 - Math.exp(-14 * dt));
    this.camera.lookAt(this._lookAt);
  }

  _updateTitleCam(dt) {
    this.titleAngle += dt * 0.035;
    const a = this.titleAngle;
    this.camera.position.set(Math.cos(a) * 150, 62, Math.sin(a) * 150);
    this.camera.lookAt(0, 8, 0);
  }

  _updateNPCs(dt, t, near) {
    for (const n of Object.values(this.npcs)) {
      const root = n.ch.root;
      const d = near ? root.position.distanceTo(this.ppos) : 99;
      n.ch.speed = 0;
      if (near && d < 6) {
        const dx = this.ppos.x - root.position.x, dz = this.ppos.z - root.position.z;
        const want = Math.atan2(dx, dz) - root.rotation.y;
        n.ch.lookYaw = clamp(this._angDiff(0, want), -1.1, 1.1);
      } else n.ch.lookYaw = Math.sin(t * 0.3 + n.ch.phase) * 0.4;
      if (n.faceTarget != null) { root.rotation.y = this._lerpAngle(root.rotation.y, n.faceTarget, 1 - Math.exp(-6 * dt)); }
      if (d < 40 || !near) n.ch.update(dt, t);
      const mk = game.quests ? game.quests.npcMarker(n.def.id) : null;
      n.marker.userData.set(mk);
      n.marker.position.y = 2.35 * (n.def.look.small ? 0.8 : 1) + Math.sin(t * 2.5) * 0.1;
      n.marker.rotation.y = t * 1.6;
      const show = near && d < 22;
      n.tag.style.opacity = show ? String(clamp((22 - d) / 6, 0, 1)) : '0';
    }
  }

  _updatePOIs(dt, t) {
    const tracked = game.quests?.currentTarget?.();
    for (const p of Object.values(this.pois)) {
      const d = p.pos.distanceTo(this.ppos);
      const scanned = !!state.scanned[p.def.id];
      const isTarget = tracked && tracked.kind === 'poi' && tracked.id === p.def.id;
      p.g.visible = d < 60;
      p.ring.rotation.x = Math.PI / 2 + Math.sin(t * 1.2) * 0.2; p.ring.rotation.z = t;
      p.gem.rotation.y = t * 2; p.gem.position.y = Math.sin(t * 2 + p.pos.x) * 0.08;
      if (isTarget) p.mat.color.setRGB(3, 2.3, 0.6);
      else if (scanned) p.mat.color.setRGB(0.45, 0.5, 0.6);
      else p.mat.color.setRGB(0.4, 2.6, 2.2);
      const s = scanned && !isTarget ? 0.6 : 1;
      p.ring.scale.setScalar(s); p.gem.scale.setScalar(s);
      p.tag.style.opacity = d < 14 ? String(clamp((14 - d) / 4, 0, 1)) : '0';
    }
  }

  _updateFocus() {
    let best = null, bd = 1e9;
    for (const t of this.targets()) {
      const d = t.pos.distanceTo(this.ppos);
      if (d < t.r && d < bd) { bd = d; best = t; }
    }
    if (best !== this.focus) { this.focus = best; game.ui?.setPrompt(best); }
  }

  _updateWaypoint(t) {
    const tgt = game.quests?.currentTarget?.();
    let pos = null;
    if (tgt) {
      if (tgt.kind === 'npc' && this.npcs[tgt.id]) pos = this.npcs[tgt.id].ch.root.position;
      else if (tgt.kind === 'poi' && this.pois[tgt.id]) pos = this.pois[tgt.id].pos;
      else if (tgt.kind === 'zone' && ZONE[tgt.id]) { const z = ZONE[tgt.id]; pos = new THREE.Vector3(z.x, heightAt(z.x, z.z), z.z); }
    }
    this.targetPos = pos;
    if (pos && pos.distanceTo(this.ppos) > 6) {
      this.waypoint.visible = true;
      this.waypoint.position.copy(pos);
      this.waypoint.material.opacity = 0.22 + Math.sin(t * 3) * 0.08;
    } else this.waypoint.visible = false;
  }

  setMode(m) {
    this.mode = m;
    this.labels.domElement.style.visibility = m === 'title' ? 'hidden' : 'visible';
    if (m === 'play') { this.camera.position.copy(this.ppos).add(new THREE.Vector3(Math.sin(this.camYaw) * 13, 8, Math.cos(this.camYaw) * 13)); this._lookAt = null; }
  }
}
