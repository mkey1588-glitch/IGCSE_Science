import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _c = new THREE.Color();

export function prismGeo(w, d, h) {
  const hw = w / 2, hd = d / 2;
  const v = [
    -hw, 0, hd, hw, 0, hd, hw, h, 0, -hw, 0, hd, hw, h, 0, -hw, h, 0,
    hw, 0, -hd, -hw, 0, -hd, -hw, h, 0, hw, 0, -hd, -hw, h, 0, hw, h, 0,
    -hw, 0, -hd, -hw, 0, hd, -hw, h, 0,
    hw, 0, hd, hw, 0, -hd, hw, h, 0,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/** Shared materials for merged static scenery. */
export const MATS = {
  solid: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0.04 }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(0.2, 0.26, 0.34) }),
  glass: new THREE.MeshPhysicalMaterial({ vertexColors: true, color: '#cfefff', transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1,
    envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1 }),
};

/**
 * A "kit" accumulates simple primitives (with vertex colours) and merges them
 * into a handful of meshes. Positions use base semantics: y is the bottom.
 */
export class Kit {
  constructor(seedJitter = 0.035) { this.parts = { solid: [], glow: [], glass: [] }; this.colliders = []; this.jit = seedJitter; }

  add(geo, color, x = 0, y = 0, z = 0, o = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
    _q.setFromEuler(_e);
    _s.set(o.sx || 1, o.sy || 1, o.sz || 1);
    _p.set(x, y, z);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    _c.set(color);
    const j = o.jitter ?? this.jit;
    if (j) { const r = (Math.random() - 0.5) * j; _c.r = Math.max(0, _c.r + r); _c.g = Math.max(0, _c.g + r); _c.b = Math.max(0, _c.b + r); }
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = _c.r; arr[i * 3 + 1] = _c.g; arr[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.parts[o.kind || 'solid'].push(g);
    return this;
  }
  box(w, h, d, x, y, z, color, o = {}) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return this.add(g, color, x, y, z, o); }
  cyl(rt, rb, h, seg, x, y, z, color, o = {}) { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open); g.translate(0, h / 2, 0); return this.add(g, color, x, y, z, o); }
  cone(r, h, seg, x, y, z, color, o = {}) { const g = new THREE.ConeGeometry(r, h, seg); g.translate(0, h / 2, 0); return this.add(g, color, x, y, z, o); }
  sphere(r, x, y, z, color, o = {}) { const g = o.ico ? new THREE.IcosahedronGeometry(r, o.detail ?? 0) : new THREE.SphereGeometry(r, o.ws || 12, o.hs || 8, 0, Math.PI * 2, 0, o.half ? Math.PI / 2 : Math.PI); return this.add(g, color, x, y, z, o); }
  gable(w, d, h, x, y, z, color, o = {}) { return this.add(prismGeo(w, d, h), color, x, y, z, o); }
  torus(r, tube, x, y, z, color, o = {}) { const g = new THREE.TorusGeometry(r, tube, o.rs || 6, o.ts || 24, o.arc || Math.PI * 2); return this.add(g, color, x, y, z, o); }
  /** A simple house: walls, gable roof, door and windows. Returns this. */
  house(x, y, z, w, h, d, wall, roof, o = {}) {
    const ry = o.ry || 0;
    const c = Math.cos(ry), s = Math.sin(ry);
    const T = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    this.box(w, h, d, x, y, z, wall, { ry });
    if (o.flat) this.box(w + 0.4, 0.4, d + 0.4, x, y + h, z, roof, { ry });
    else this.gable(w + 0.6, d + 0.8, o.roofH || h * 0.55, x, y + h, z, roof, { ry: ry + Math.PI / 2 * (o.ridgeZ ? 1 : 0) });
    const [dx, dz] = T(o.doorX || 0, d / 2 + 0.02);
    this.box(1.2, 2.1, 0.12, dx, y, dz, o.door || '#5b3a24', { ry });
    const nw = Math.max(1, Math.floor(w / 2.6));
    for (let i = 0; i < nw; i++) {
      const lx = -w / 2 + (i + 0.5) * (w / nw);
      if (Math.abs(lx - (o.doorX || 0)) < 1.1) continue;
      const [wx, wz] = T(lx, d / 2 + 0.03);
      this.box(1.1, 1.0, 0.08, wx, y + h * 0.45, wz, '#ffffff', { ry, kind: 'glow', jitter: 0 });
      if (h > 5.5) { const [ux, uz] = T(lx, d / 2 + 0.03); this.box(1.1, 1.0, 0.08, ux, y + h * 0.75, uz, '#ffffff', { ry, kind: 'glow', jitter: 0 }); }
    }
    if (o.collide !== false) this.rect(x, z, w + 0.6, d + 0.6, ry);
    return this;
  }
  circle(x, z, r) { this.colliders.push({ t: 'c', x, z, r }); return this; }
  rect(x, z, w, d, ry = 0) { this.colliders.push({ t: 'r', x, z, hw: w / 2, hd: d / 2, ry }); return this; }

  build(name = 'kit') {
    const g = new THREE.Group(); g.name = name;
    for (const kind of ['solid', 'glow', 'glass']) {
      const list = this.parts[kind];
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, MATS[kind]);
      if (kind === 'solid') { mesh.castShadow = true; mesh.receiveShadow = true; }
      if (kind === 'glass') mesh.renderOrder = 3;
      g.add(mesh);
      list.forEach((x) => x.dispose());
    }
    return g;
  }
}

/** Standalone mesh helpers for dynamic objects. */
export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0.05, flatShading: o.flat ?? true, ...o.extra });
export const glowMat = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
export function mesh(geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  return m;
}
