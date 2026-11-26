import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { damp } from '../core/util.js';

const matCache = new Map();
function M(color, rough = 0.75) {
  const k = color + rough;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02, flatShading: false }));
  return matCache.get(k);
}
function part(geo, color, x = 0, y = 0, z = 0, rough) { const m = new THREE.Mesh(geo, M(color, rough)); m.position.set(x, y, z); m.castShadow = true; return m; }

/**
 * Stylised character: ~1.75 m tall, slightly large head. Returns a Character with animation helpers.
 */
export class Character {
  constructor(look = {}) {
    const L = { skin: '#c58c63', hair: '#2b1a10', hairStyle: 'short', top: '#3b82f6', bottom: '#334155', shoes: '#1f2937', ...look };
    const s = L.small ? 0.78 : 1;
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.body.scale.setScalar(s); this.root.add(this.body);
    const hips = (this.hips = new THREE.Group()); hips.position.y = 0.92; this.body.add(hips);
    // torso
    const torso = (this.torso = new THREE.Group()); hips.add(torso);
    const tg = new THREE.CapsuleGeometry(0.21, 0.42, 4, 10); tg.scale(1, 1, 0.78);
    torso.add(part(tg, L.top, 0, 0.36, 0));
    if (L.coat) { const cg = new THREE.CylinderGeometry(0.25, 0.3, 0.75, 12, 1, true); const c = part(cg, '#f8fafc'); c.position.y = 0.2; c.material = new THREE.MeshStandardMaterial({ color: '#f8fafc', side: THREE.DoubleSide, roughness: 0.8 }); torso.add(c); }
    if (L.acc === 'vest') torso.add(part(new THREE.CylinderGeometry(0.235, 0.23, 0.42, 12), '#facc15', 0, 0.42, 0));
    if (L.acc === 'sash') { const sg = new THREE.TorusGeometry(0.24, 0.035, 4, 16); const sm = part(sg, '#fbbf24', 0, 0.45, 0); sm.rotation.set(Math.PI / 2, 0.6, 0); torso.add(sm); }
    if (L.acc === 'stethoscope') { const sg = new THREE.TorusGeometry(0.12, 0.015, 4, 12, Math.PI); const sm = part(sg, '#1f2937', 0, 0.62, 0.17); sm.rotation.z = Math.PI; torso.add(sm); }
    if (L.acc === 'scarf') torso.add(part(new THREE.TorusGeometry(0.13, 0.05, 6, 12), '#a855f7', 0, 0.72, 0)).children;
    if (L.acc === 'whistle') torso.add(part(new THREE.SphereGeometry(0.03, 6, 4), '#e5e7eb', 0, 0.5, 0.19));
    torso.add(part(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 8), L.skin, 0, 0.78, 0));
    // head
    const head = (this.head = new THREE.Group()); head.position.y = 1.02; torso.add(head);
    head.add(part(new THREE.SphereGeometry(0.2, 18, 14), L.skin, 0, 0.0, 0, 0.6));
    const eyeGeo = new THREE.SphereGeometry(0.025, 8, 6);
    for (const sx of [-0.07, 0.07]) { head.add(part(eyeGeo, '#111111', sx, 0.03, 0.182, 0.3)); }
    head.add(part(new THREE.SphereGeometry(0.03, 6, 4), L.skin, 0, -0.02, 0.2));
    const smile = part(new THREE.TorusGeometry(0.04, 0.008, 4, 10, Math.PI), '#7f1d1d', 0, -0.07, 0.185); smile.rotation.z = Math.PI; head.add(smile);
    this._hair(head, L);
    this._hat(head, L);
    if (L.acc === 'glasses') { for (const sx of [-0.07, 0.07]) { const g = part(new THREE.TorusGeometry(0.035, 0.007, 4, 12), '#111827', sx, 0.03, 0.19); head.add(g); } }
    if (L.acc === 'shades') head.add(part(new THREE.BoxGeometry(0.22, 0.05, 0.03), '#0f172a', 0, 0.035, 0.19));
    if (L.acc === 'goggles') { const g = part(new THREE.TorusGeometry(0.19, 0.025, 4, 16), '#0ea5e9', 0, 0.1, 0); g.rotation.x = Math.PI / 2 - 0.3; head.add(g); }
    if (L.acc === 'beard') head.add(part(new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), L.hair, 0, -0.06, 0.05));
    // arms
    this.arms = [];
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * 0.27, 0.66, 0); torso.add(sh);
      const ag = new THREE.CapsuleGeometry(0.062, 0.42, 4, 8); ag.translate(0, -0.27, 0);
      sh.add(part(ag, L.coat ? '#f8fafc' : L.top));
      sh.add(part(new THREE.SphereGeometry(0.065, 8, 6), L.skin, 0, -0.56, 0));
      sh.rotation.z = sx * 0.08;
      this.arms.push(sh);
    }
    // legs
    this.legs = [];
    for (const sx of [-1, 1]) {
      const hp = new THREE.Group(); hp.position.set(sx * 0.11, 0.02, 0); hips.add(hp);
      const lg = new THREE.CapsuleGeometry(0.08, 0.6, 4, 8); lg.translate(0, -0.42, 0);
      hp.add(part(lg, L.bottom));
      const sh = part(new THREE.BoxGeometry(0.14, 0.08, 0.24), L.shoes, 0, -0.86, 0.04); hp.add(sh);
      this.legs.push(hp);
    }
    if (L.backpack) {
      const bp = part(new THREE.BoxGeometry(0.32, 0.38, 0.16), '#334155', 0, 0.42, -0.2); torso.add(bp);
      const vial = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.4, 1.8) }));
      vial.position.set(0.12, 0.48, -0.3); torso.add(vial); this.vial = vial;
    }
    this.phase = Math.random() * 10;
    this.speed = 0;
    this.lookYaw = 0;
    this.talking = 0;
    this.wave = 0;
  }

  _hair(head, L) {
    const c = L.hair;
    const st = L.hairStyle;
    if (st === 'bald') { head.add(part(new THREE.SphereGeometry(0.205, 14, 10, 0, Math.PI * 2, 0.9, 0.9), c, 0, 0, 0)); return; }
    const cap = part(new THREE.SphereGeometry(0.212, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), c, 0, 0.01, -0.005);
    head.add(cap);
    if (st === 'long') { const g = new THREE.CapsuleGeometry(0.17, 0.25, 4, 10); g.scale(1.15, 1, 0.6); head.add(part(g, c, 0, -0.15, -0.08)); }
    if (st === 'bun') head.add(part(new THREE.SphereGeometry(0.09, 10, 8), c, 0, 0.18, -0.12));
    if (st === 'pony') { const g = new THREE.CapsuleGeometry(0.05, 0.22, 4, 8); const p = part(g, c, 0, -0.04, -0.22); p.rotation.x = 0.5; head.add(p); }
    if (st === 'curly') for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; head.add(part(new THREE.SphereGeometry(0.07, 8, 6), c, Math.cos(a) * 0.15, 0.12, Math.sin(a) * 0.15)); }
  }

  _hat(head, L) {
    switch (L.hat) {
      case 'chef': head.add(part(new THREE.CylinderGeometry(0.2, 0.18, 0.22, 14), '#ffffff', 0, 0.26, 0)); head.add(part(new THREE.SphereGeometry(0.21, 12, 8), '#ffffff', 0, 0.38, 0)); break;
      case 'hard': head.add(part(new THREE.SphereGeometry(0.225, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#facc15', 0, 0.06, 0)); head.add(part(new THREE.CylinderGeometry(0.27, 0.27, 0.025, 16), '#facc15', 0, 0.06, 0.03)); break;
      case 'captain': head.add(part(new THREE.CylinderGeometry(0.22, 0.2, 0.12, 14), '#f8fafc', 0, 0.2, 0)); head.add(part(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 12), '#0f172a', 0, 0.15, 0.12)); break;
      case 'straw': head.add(part(new THREE.CylinderGeometry(0.4, 0.4, 0.025, 18), '#eab308', 0, 0.1, 0)); head.add(part(new THREE.CylinderGeometry(0.16, 0.2, 0.16, 14), '#eab308', 0, 0.18, 0)); break;
      case 'ranger': head.add(part(new THREE.CylinderGeometry(0.34, 0.34, 0.025, 18), '#78716c', 0, 0.1, 0)); head.add(part(new THREE.ConeGeometry(0.2, 0.2, 14), '#78716c', 0, 0.2, 0)); break;
      case 'beanie': head.add(part(new THREE.SphereGeometry(0.218, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), '#f59e0b', 0, 0.03, 0)); break;
      case 'cap': head.add(part(new THREE.SphereGeometry(0.215, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), '#2563eb', 0, 0.03, 0)); { const b = part(new THREE.BoxGeometry(0.2, 0.02, 0.14), '#2563eb', 0, 0.1, 0.22); head.add(b); } break;
      case 'bee': head.add(part(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 16), '#f5f5f4', 0, 0.12, 0)); { const v = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.35, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#e7e5e4', transparent: true, opacity: 0.35, side: THREE.DoubleSide })); v.position.y = -0.05; head.add(v); } break;
      default: break;
    }
  }

  /** speed in m/s drives walk cycle. */
  update(dt, t) {
    const sp = this.speed;
    const walkAmt = Math.min(1, sp / 4);
    this.phase += dt * (2.2 + sp * 1.75);
    const sw = Math.sin(this.phase);
    this.legs[0].rotation.x = sw * 0.7 * walkAmt;
    this.legs[1].rotation.x = -sw * 0.7 * walkAmt;
    this.arms[0].rotation.x = -sw * 0.6 * walkAmt;
    this.arms[1].rotation.x = sw * 0.6 * walkAmt;
    this.hips.position.y = 0.92 + Math.abs(Math.cos(this.phase)) * 0.05 * walkAmt;
    const breathe = Math.sin(t * 1.8 + this.phase * 0.1) * 0.012 * (1 - walkAmt);
    this.torso.scale.y = 1 + breathe;
    this.torso.rotation.x = walkAmt * 0.08;
    // talk gestures
    this.talking = damp(this.talking, this._talkTarget || 0, 4, dt);
    if (this.talking > 0.01) {
      this.arms[1].rotation.x = -0.6 * this.talking + Math.sin(t * 3) * 0.25 * this.talking;
      this.arms[1].rotation.z = 0.25 * this.talking;
      this.head.rotation.x = Math.sin(t * 4.2) * 0.06 * this.talking;
    } else this.arms[1].rotation.z = 0.08;
    if (this.wave > 0) {
      this.wave -= dt;
      this.arms[0].rotation.z = -2.6;
      this.arms[0].rotation.x = 0;
      this.arms[0].rotation.y = Math.sin(t * 12) * 0.4;
    } else { this.arms[0].rotation.z = damp(this.arms[0].rotation.z, -0.08, 8, dt); this.arms[0].rotation.y = 0; }
    this.head.rotation.y = damp(this.head.rotation.y, this.lookYaw, 5, dt);
    if (this.vial) this.vial.material.color.setRGB(0.4, 1.6 + Math.sin(t * 3) * 0.8, 1.4);
  }
  setTalking(on) { this._talkTarget = on ? 1 : 0; }
}

/** Floating quest marker (diamond). state: 'new' | 'active' | 'turnin' | null */
export function makeMarker() {
  const g = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(0.22, 0);
  geo.scale(1, 1.6, 1);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.3, 0.6) });
  const m = new THREE.Mesh(geo, mat); g.add(m);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 24), mat); ring.rotation.x = Math.PI / 2; ring.position.y = -0.45; g.add(ring);
  g.userData = { mat, set(state) {
    g.visible = !!state;
    if (state === 'new') mat.color.setRGB(3, 2.3, 0.5);
    else if (state === 'turnin') mat.color.setRGB(0.6, 3, 1.2);
    else if (state === 'active') mat.color.setRGB(0.6, 2.2, 3);
  } };
  return g;
}

/** Merge a character into a static instance (not used for animated NPCs, kept for crowds). */
export function bakeCharacter(c) {
  const geos = [];
  c.root.updateMatrixWorld(true);
  c.root.traverse((o) => { if (o.isMesh) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); geos.push(g); } });
  return mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; }));
}
