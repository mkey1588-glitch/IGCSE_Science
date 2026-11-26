import * as THREE from 'three';
import { Kit, std, glowMat, mesh, MATS } from './kit.js';
import { ZONE } from '../data/world.js';
import { heightAt } from './terrain.js';
import { textPlane, mulberry32, TAU, lerp } from '../core/util.js';

/**
 * Builds every district. Returns { group, colliders, docks, dynamic[], anchors, interact[] }.
 * Dynamic entries: { update(dt, t, ctx) } where ctx = { night, flags, time }.
 */
export function buildZones() {
  const root = new THREE.Group(); root.name = 'zones';
  const kit = new Kit();
  const dynamic = [], interact = [], docks = [], anchors = {};
  const rnd = mulberry32(9);
  const sign = (text, x, y, z, ry = 0, width = 3, o = {}) => {
    const m = textPlane(text, { width, fg: o.fg || '#1e293b', bg: o.bg || '#f8fafc', font: o.font || '700 64px Outfit, Inter, sans-serif', emissive: o.emissive || 0, border: o.border || null });
    m.position.set(x, y, z); m.rotation.y = ry; root.add(m); return m;
  };
  const lampPost = (x, z, y, mat) => {
    kit.cyl(0.08, 0.1, 3.6, 6, x, y, z, '#334155');
    kit.box(0.5, 0.12, 0.12, x + 0.2, y + 3.5, z, '#334155');
    const b = mesh(new THREE.SphereGeometry(0.2, 10, 8), mat, x + 0.42, y + 3.32, z, false); root.add(b);
    return b;
  };
  const lampMat = glowMat(0.4, 0.38, 0.3);
  const marketLampMat = glowMat(0.4, 0.38, 0.3);
  const holoMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 2.0), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });

  // ======================= LUMEN LAB PLAZA =======================
  {
    const Z = ZONE.lab, H = Z.h, X = Z.x, Q = Z.z;
    // main rotunda
    kit.cyl(9.2, 9.6, 0.6, 32, X, H, Q - 4, '#b9b2a3');
    kit.cyl(8.6, 8.6, 5.6, 32, X, H + 0.6, Q - 4, '#f1ece0');
    kit.cyl(8.9, 8.9, 0.5, 32, X, H + 6.1, Q - 4, '#cfc6b3');
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      if (Math.abs(a - Math.PI / 2) < 0.35) continue;
      kit.box(1.3, 2.2, 0.15, X + Math.cos(a) * 8.62, H + 2.4, Q - 4 + Math.sin(a) * 8.62, '#ffffff', { ry: -a + Math.PI / 2, kind: 'glow', jitter: 0 });
    }
    kit.sphere(8.7, X, H + 6.5, Q - 4, '#d9f2ff', { half: true, ws: 28, hs: 12, kind: 'glass', jitter: 0 });
    for (let i = 0; i < 8; i++) kit.torus(8.75, 0.1, X, H + 6.5, Q - 4, '#e5e7eb', { arc: Math.PI, ry: (i / 8) * Math.PI, rs: 4, ts: 20, jitter: 0 });
    kit.sphere(0.8, X, H + 15.2, Q - 4, '#ffd166', { ico: true, detail: 1 });
    // portico
    kit.box(7, 0.5, 4, X, H, Q + 5.5, '#b9b2a3');
    for (const dx of [-2.8, -0.95, 0.95, 2.8]) kit.cyl(0.32, 0.36, 4.4, 10, X + dx, H + 0.5, Q + 6.9, '#f8f5ee');
    kit.box(7.2, 0.7, 4.2, X, H + 4.9, Q + 5.6, '#e7e0d1');
    kit.gable(7.4, 4.4, 1.6, X, H + 5.6, Q + 5.6, '#d6cdb8');
    kit.box(2.4, 3.2, 0.15, X, H + 0.5, Q + 4.6, '#ffffff', { kind: 'glow', jitter: 0 });
    kit.circle(X, Q - 4, 9.4).rect(X, Q + 5.2, 7.4, 3.2);
    sign('LUMEN LAB', X, H + 5.25, Q + 7.75, 0, 5.2, { bg: '#1e293b', fg: '#ffd166' });
    anchors.labDoor = new THREE.Vector3(X, H, Q + 8.5);
    interact.push({ id: 'labdoor', kind: 'lab', x: X, z: Q + 8.6, y: H + 1.5, r: 3.4, label: 'Enter the Lumen Lab', icon: '🧪' });
    // fountain
    const F = [X, Q + 18];
    kit.cyl(3.3, 3.5, 0.7, 24, F[0], H, F[1], '#c4bdae');
    kit.cyl(0.5, 0.6, 2.2, 10, F[0], H, F[1], '#d6d0c2');
    kit.cyl(1.3, 0.4, 0.4, 16, F[0], H + 2.2, F[1], '#d6d0c2');
    kit.circle(F[0], F[1], 3.6);
    const pool = mesh(new THREE.CylinderGeometry(3.05, 3.05, 0.1, 28), new THREE.MeshStandardMaterial({ color: '#3fb5d9', roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 }), F[0], H + 0.55, F[1], false);
    root.add(pool);
    const jets = new THREE.Group(); root.add(jets);
    const dropGeo = new THREE.SphereGeometry(0.07, 6, 4), dropMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 1.2, 1.6) });
    const drops = [];
    for (let i = 0; i < 90; i++) { const d = new THREE.Mesh(dropGeo, dropMat); d.userData = { t: Math.random() * 1.4, a: Math.random() * TAU, s: 0.9 + Math.random() * 0.6 }; jets.add(d); drops.push(d); }
    dynamic.push({ update(dt, t, ctx) {
      const on = !!ctx.flags.water_fixed;
      jets.visible = on; pool.material.color.set(on ? '#3fb5d9' : '#9a8f7a'); pool.scale.y = 1; pool.position.y = on ? H + 0.55 : H + 0.38;
      if (!on) return;
      for (const d of drops) { const u = d.userData; u.t += dt; if (u.t > 1.4) { u.t = 0; u.a = Math.random() * TAU; }
        const r = u.t * 1.6 * u.s, y = 2.7 + u.t * 4.2 - 4.9 * u.t * u.t * 1.2; d.position.set(F[0] + Math.cos(u.a) * r, H + Math.max(0.6, y), F[1] + Math.sin(u.a) * r); }
    } });
    // holo pavilion
    const HP = [X - 13, Q + 8];
    kit.cyl(2.4, 2.6, 0.5, 16, HP[0], H, HP[1], '#cbd5e1');
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; kit.cyl(0.12, 0.12, 3.4, 6, HP[0] + Math.cos(a) * 2.1, H + 0.5, HP[1] + Math.sin(a) * 2.1, '#e2e8f0'); }
    kit.cyl(2.6, 2.6, 0.25, 16, HP[0], H + 3.9, HP[1], '#475569');
    kit.circle(HP[0], HP[1], 2.6);
    const helix = new THREE.Group(); helix.position.set(HP[0], H + 1.4, HP[1]); root.add(helix);
    const hg = new THREE.SphereGeometry(0.11, 8, 6);
    for (let i = 0; i < 24; i++) {
      const y = i * 0.09, a = i * 0.5;
      const m1 = new THREE.Mesh(hg, holoMat); m1.position.set(Math.cos(a) * 0.55, y, Math.sin(a) * 0.55);
      const m2 = new THREE.Mesh(hg, holoMat); m2.position.set(-Math.cos(a) * 0.55, y, -Math.sin(a) * 0.55);
      helix.add(m1, m2);
      if (i % 2 === 0) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 4), holoMat); r.position.y = y; r.rotation.z = Math.PI / 2; r.rotation.y = -a; helix.add(r); }
    }
    dynamic.push({ update(dt) { helix.rotation.y += dt * 0.8; } });
    sign('HOLO-THEATRE', HP[0], H + 4.4, HP[1] + 2.62, 0, 3, { bg: '#0f172a', fg: '#5eead4' });
    interact.push({ id: 'holo', kind: 'holo', x: HP[0], z: HP[1] + 2.5, y: H + 1.5, r: 3.2, label: 'Open the Holo-Theatre', icon: '🧬' });
    // codex kiosk
    const CK = [X + 13, Q + 8];
    kit.box(1.4, 2.2, 0.8, CK[0], H, CK[1], '#334155');
    kit.box(1.1, 0.8, 0.06, CK[0], H + 1.2, CK[1] + 0.42, '#ffffff', { kind: 'glow', jitter: 0 });
    kit.rect(CK[0], CK[1], 1.6, 1);
    sign('CODEX', CK[0], H + 2.5, CK[1] + 0.42, 0, 1.3, { bg: '#0f172a', fg: '#8ea2ff' });
    interact.push({ id: 'codex', kind: 'codex', x: CK[0], z: CK[1] + 1.4, y: H + 1.2, r: 2.8, label: 'Use the Codex terminal', icon: '📚' });
    // benches, lamps, planters
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + 0.3, r = 17;
      const x = X + Math.cos(a) * r, z = Q + 6 + Math.sin(a) * r * 0.9;
      if (i % 2) { kit.box(2, 0.12, 0.6, x, H + 0.45, z, '#8b5a2b', { ry: -a }); kit.box(0.15, 0.45, 0.5, x, H, z, '#475569', { ry: -a }); }
      else { lampPost(x, z, H, lampMat); }
    }
    for (const [dx, dz] of [[-6, 12], [6, 12], [-10, -14], [10, -14]]) {
      kit.cyl(1.2, 1.3, 0.6, 10, X + dx, H, Q + dz, '#a8a29e');
      for (let k = 0; k < 5; k++) kit.sphere(0.35, X + dx + (rnd() - 0.5) * 1.4, H + 0.8, Q + dz + (rnd() - 0.5) * 1.4, ['#f472b6', '#facc15', '#a78bfa', '#fb7185'][k % 4], { ico: true });
      kit.circle(X + dx, Q + dz, 1.3);
    }
    // fig tree
    kit.cyl(0.6, 0.9, 4, 8, X - 16, H, Q + 4, '#6b4a2f');
    for (let k = 0; k < 6; k++) kit.sphere(2.2 + rnd(), X - 16 + (rnd() - 0.5) * 3.5, H + 4.5 + rnd() * 2, Q + 4 + (rnd() - 0.5) * 3.5, '#3f8f45', { ico: true, detail: 0 });
    kit.circle(X - 16, Q + 4, 1.2);
    // festival grounds + ferris wheel
    const FW = [X + 24, Q - 14], FH = heightAt(FW[0], FW[1]);
    kit.box(1, 13.5, 1, FW[0] - 3.2, FH, FW[1] - 1.3, '#64748b', { rz: 0.24 });
    kit.box(1, 13.5, 1, FW[0] + 3.2, FH, FW[1] - 1.3, '#64748b', { rz: -0.24 });
    kit.box(1, 13.5, 1, FW[0] - 3.2, FH, FW[1] + 1.3, '#64748b', { rz: 0.24 });
    kit.box(1, 13.5, 1, FW[0] + 3.2, FH, FW[1] + 1.3, '#64748b', { rz: -0.24 });
    kit.box(4, 1.2, 4, FW[0], FH, FW[1] + 2.2, '#334155');
    kit.circle(FW[0], FW[1], 4.5);
    const wheel = new THREE.Group(); wheel.position.set(FW[0], FH + 13, FW[1]); root.add(wheel);
    const rimMat = std('#e2e8f0', { metal: 0.6, rough: 0.3 });
    for (const zz of [-0.9, 0.9]) { const rim = mesh(new THREE.TorusGeometry(10, 0.16, 6, 48), rimMat, 0, 0, zz); wheel.add(rim); }
    for (let i = 0; i < 12; i++) { const sp = mesh(new THREE.BoxGeometry(0.12, 20, 0.12), rimMat); sp.rotation.z = (i / 12) * Math.PI; wheel.add(sp); }
    const bulbMat = glowMat(2.5, 1.9, 0.9);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; const b = mesh(new THREE.SphereGeometry(0.16, 6, 4), bulbMat, Math.cos(a) * 10.1, Math.sin(a) * 10.1, 1.05, false); wheel.add(b); }
    const gondolas = [];
    const gCols = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const g = new THREE.Group(); g.position.set(Math.cos(a) * 10, Math.sin(a) * 10, 0);
      const cab = mesh(new THREE.BoxGeometry(1.4, 1.1, 1.3), std(gCols[i % 6]), 0, -1.1, 0); g.add(cab);
      const roof = mesh(new THREE.ConeGeometry(1.05, 0.5, 4), std('#f8fafc'), 0, -0.3, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
      wheel.add(g); gondolas.push(g);
    }
    dynamic.push({ update(dt, t, ctx) {
      const sp = ctx.flags.ferris_fixed ? 0.12 : 0;
      wheel.rotation.z += sp * dt;
      for (const g of gondolas) g.rotation.z = -wheel.rotation.z;
      bulbMat.color.setRGB(ctx.flags.ferris_fixed ? 2.5 : 0.25, ctx.flags.ferris_fixed ? 1.9 : 0.22, ctx.flags.ferris_fixed ? 0.9 : 0.2);
    } });
    for (const [dx, dz, c] of [[-8, -6, '#ef4444'], [-10, 4, '#3b82f6'], [8, 8, '#f59e0b']]) {
      const tx = FW[0] + dx, tz = FW[1] + dz, th = heightAt(tx, tz);
      kit.cyl(2.2, 2.2, 2, 8, tx, th, tz, '#f8fafc'); kit.cone(2.6, 2.4, 8, tx, th + 2, tz, c); kit.circle(tx, tz, 2.3);
    }
    anchors.ferris = new THREE.Vector3(FW[0], FH, FW[1]);
  }

  // ======================= OBSERVATORY HILL =======================
  {
    const Z = ZONE.observatory, H = Z.h, X = Z.x, Q = Z.z;
    kit.cyl(4.6, 4.8, 4.2, 24, X, H, Q + 2, '#f1f5f9');
    kit.cyl(4.9, 4.9, 0.4, 24, X, H + 4.2, Q + 2, '#cbd5e1');
    kit.box(1.4, 2.2, 0.2, X, H, Q + 6.7, '#ffffff', { kind: 'glow', jitter: 0 });
    kit.circle(X, Q + 2, 5);
    const dome = new THREE.Group(); dome.position.set(X, H + 4.6, Q + 2); root.add(dome);
    const dm = mesh(new THREE.SphereGeometry(4.7, 24, 12, 0, TAU, 0, Math.PI / 2), std('#cbd5e1', { metal: 0.6, rough: 0.35, flat: false })); dome.add(dm);
    const slit = mesh(new THREE.BoxGeometry(1.2, 4.8, 3.2), std('#111827'), 0, 2.2, 2.4); dome.add(slit);
    const scope = mesh(new THREE.CylinderGeometry(0.35, 0.45, 4.5, 10), std('#334155', { metal: 0.5 }), 0, 2.4, 2.6); scope.rotation.x = 0.8; dome.add(scope);
    dynamic.push({ update(dt) { dome.rotation.y += dt * 0.05; } });
    sign('OBSERVATORY', X, H + 3.4, Q + 6.75, 0, 3.4, { bg: '#1e1b4b', fg: '#c4b5fd' });
    // beacon tower
    const B = [X, Q - 7];
    const cols = ['#f8fafc', '#dc2626'];
    for (let i = 0; i < 5; i++) kit.cyl(2.5 - i * 0.18 - 0.18, 2.5 - i * 0.18, 3.2, 16, B[0], H + i * 3.2, B[1], cols[i % 2]);
    kit.cyl(2.2, 2.2, 0.4, 16, B[0], H + 16, B[1], '#334155');
    kit.cyl(1.5, 1.5, 2.4, 16, B[0], H + 16.4, B[1], '#e0f2fe', { kind: 'glass', jitter: 0, open: true });
    kit.cone(1.8, 1.6, 16, B[0], H + 18.8, B[1], '#1f2937');
    kit.circle(B[0], B[1], 2.7);
    const beaconMat = glowMat(0.3, 0.28, 0.22);
    const lamp = mesh(new THREE.SphereGeometry(0.75, 16, 12), beaconMat, B[0], H + 17.5, B[1], false); root.add(lamp);
    const beams = new THREE.Group(); beams.position.copy(lamp.position); root.add(beams);
    const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 0.9), transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    for (const s of [1, -1]) { const c = new THREE.Mesh(new THREE.ConeGeometry(5, 90, 24, 1, true), beamMat); c.rotation.z = (s * Math.PI) / 2; c.position.x = s * 45; beams.add(c); }
    const beaconLight = new THREE.PointLight('#ffe2a8', 0, 80, 1.5); beaconLight.position.copy(lamp.position); root.add(beaconLight);
    dynamic.push({ update(dt, t, ctx) {
      const p = ctx.beacon || 0; // 0..1 progress
      beaconMat.color.setRGB(0.3 + p * 4, 0.28 + p * 3.4, 0.22 + p * 2.2);
      beams.rotation.y += dt * 0.6;
      beamMat.opacity = ctx.flags.festival ? 0.22 * (0.4 + ctx.night * 0.6) : p > 0.25 ? 0.06 * p * ctx.night : 0;
      beaconLight.intensity = p * 40 * (0.3 + ctx.night);
    } });
    anchors.beacon = new THREE.Vector3(B[0], H, B[1] + 3);
    interact.push({ id: 'beacon', kind: 'constellation', x: B[0], z: B[1] + 3.2, y: H + 1.5, r: 3.2, label: 'View the Constellation of Knowledge', icon: '✨' });
    // radio dish
    const D = [X + 10, Q + 6];
    kit.cyl(0.5, 0.8, 3, 8, D[0], H, D[1], '#94a3b8'); kit.circle(D[0], D[1], 2);
    const dish = new THREE.Group(); dish.position.set(D[0], H + 3.4, D[1]); root.add(dish);
    const prof = []; for (let i = 0; i <= 10; i++) { const r = i * 0.32; prof.push(new THREE.Vector2(r, r * r * 0.12)); }
    const bowl = mesh(new THREE.LatheGeometry(prof, 24), std('#e2e8f0', { metal: 0.3, rough: 0.4, extra: { side: THREE.DoubleSide } })); bowl.rotation.x = -0.9; dish.add(bowl);
    const feed = mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), std('#64748b'), 0, 0.9, 0.7); feed.rotation.x = -0.9; dish.add(feed);
    dynamic.push({ update(dt, t) { dish.rotation.y = Math.sin(t * 0.05) * 1.2; } });
    // telescope + sundial
    const T = [X - 5, Q + 4];
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; kit.cyl(0.05, 0.05, 1.6, 4, T[0] + Math.cos(a) * 0.4, H, T[1] + Math.sin(a) * 0.4, '#334155', { rx: Math.sin(a) * 0.25, rz: -Math.cos(a) * 0.25 }); }
    kit.cyl(0.18, 0.24, 1.8, 10, T[0], H + 1.5, T[1], '#1e3a8a', { rx: -0.7 });
    kit.circle(T[0], T[1], 0.8);
    kit.cyl(0.9, 1, 0.8, 16, X - 9, H, Q - 4, '#d6d3d1'); kit.box(0.08, 0.7, 0.9, X - 9, H + 0.8, Q - 4, '#78716c', { rx: 0.6 }); kit.circle(X - 9, Q - 4, 1.1);
    for (const [dx, dz] of [[-6, 9], [6, 10]]) { kit.box(2, 0.12, 0.6, X + dx, H + 0.45, Q + dz, '#8b5a2b'); kit.box(0.15, 0.45, 0.5, X + dx, H, Q + dz, '#475569'); }
  }

  // ======================= POWER & WORKS =======================
  {
    const Z = ZONE.power, H = Z.h, X = Z.x, Q = Z.z;
    const turbines = [];
    for (const [dx, dz] of [[8, -14], [-5, -20], [19, -5]]) {
      const tx = X + dx, tz = Q + dz, th = heightAt(tx, tz);
      kit.cyl(0.38, 0.75, 21, 12, tx, th, tz, '#f8fafc'); kit.circle(tx, tz, 1.1);
      kit.box(1.2, 1.2, 3, tx, th + 21, tz - 0.4, '#e2e8f0');
      const rot = new THREE.Group(); rot.position.set(tx, th + 21.6, tz + 1.2); root.add(rot);
      const hub = mesh(new THREE.SphereGeometry(0.55, 10, 8), std('#f1f5f9')); rot.add(hub);
      for (let i = 0; i < 3; i++) {
        const blade = mesh(new THREE.BoxGeometry(0.5, 9.5, 0.12), std('#ffffff', { rough: 0.4 }));
        blade.geometry.translate(0, 4.8, 0); blade.rotation.z = (i / 3) * TAU; rot.add(blade);
      }
      rot.rotation.z = rnd() * TAU;
      turbines.push(rot);
    }
    dynamic.push({ update(dt, t, ctx) { const sp = ctx.flags.grid_fixed ? 1.4 : 0.05; for (const r of turbines) r.rotation.z += sp * dt; } });
    // solar farm
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      const sx = X - 20 + c * 2.6, sz = Q - 12 + r * 3;
      kit.cyl(0.06, 0.06, 0.9, 4, sx, H, sz, '#64748b');
      kit.box(2.3, 0.08, 1.5, sx, H + 0.9, sz, '#1e3a8a', { rx: -0.5, jitter: 0.01 });
    }
    kit.rect(X - 13.5, Q - 7.5, 16, 12);
    // backup power station
    kit.house(X - 15, H, Q + 9, 11, 6, 8, '#cfc9bd', '#57534e', { flat: true });
    kit.cyl(0.9, 1.1, 14, 12, X - 19, H, Q + 6, '#a8a29e'); kit.cyl(1.0, 1.0, 0.8, 12, X - 19, H + 10, Q + 6, '#dc2626'); kit.circle(X - 19, Q + 6, 1.2);
    sign('BACKUP DIESEL', X - 15, H + 4.8, Q + 13.05, 0, 3.4, { bg: '#292524', fg: '#fbbf24' });
    const smoke = makeSmoke(root, new THREE.Vector3(X - 19, H + 14.4, Q + 6), '#6b6b6b');
    dynamic.push({ update(dt, t, ctx) { smoke.update(dt, !ctx.flags.grid_fixed); } });
    // transformer yard
    const TY = [X + 10, Q + 6];
    for (const dx of [-1.8, 1.8]) {
      kit.box(2.4, 2.4, 2, TY[0] + dx, H, TY[1], '#9ca3af');
      for (let k = 0; k < 5; k++) kit.box(0.08, 2, 2.4, TY[0] + dx - 1.25, H + 0.2, TY[1] - 1 + k * 0.5, '#6b7280', { ry: Math.PI / 2 });
      for (let k = 0; k < 3; k++) kit.cyl(0.12, 0.18, 1.1, 8, TY[0] + dx - 0.7 + k * 0.7, H + 2.4, TY[1], '#a16207');
    }
    for (let k = 0; k < 8; k++) kit.box(0.08, 1.6, 0.08, TY[0] - 4 + k * 1.15, H, TY[1] - 2.4, '#6b7280');
    kit.rect(TY[0], TY[1], 8, 5.4);
    sign('⚡ DANGER — HIGH VOLTAGE', TY[0], H + 1.3, TY[1] + 2.75, 0, 2.6, { bg: '#facc15', fg: '#111827' });
    // pylons toward the plaza
    const pyl = [[X - 2, Q + 16], [X - 22, Q + 27], [X - 42, Q + 38]];
    const tops = [];
    for (const [px, pz] of pyl) {
      const ph = heightAt(px, pz);
      for (const [ox, oz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) kit.box(0.14, 12.5, 0.14, px + ox * 0.6, ph, pz + oz * 0.6, '#9ca3af', { rx: oz * 0.06, rz: -ox * 0.06 });
      kit.box(5, 0.18, 0.2, px, ph + 10.5, pz, '#9ca3af', { ry: 0.5 });
      kit.box(3.4, 0.18, 0.2, px, ph + 12.2, pz, '#9ca3af', { ry: 0.5 });
      kit.circle(px, pz, 1.2);
      tops.push(new THREE.Vector3(px, ph + 10.4, pz));
    }
    const cableMat = new THREE.LineBasicMaterial({ color: '#1f2937' });
    for (let i = 0; i < tops.length - 1; i++) for (const off of [-2.2, 2.2]) {
      const a = tops[i].clone(), b = tops[i + 1].clone();
      const dir = new THREE.Vector3(Math.cos(0.5), 0, -Math.sin(0.5));
      a.addScaledVector(dir, off); b.addScaledVector(dir, off);
      const pts = []; for (let k = 0; k <= 16; k++) { const u = k / 16; const p = a.clone().lerp(b, u); p.y -= Math.sin(u * Math.PI) * 1.4; pts.push(p); }
      root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableMat));
    }
    // workshop
    kit.house(X + 14, H, Q + 13, 7, 4, 6, '#a3b1c2', '#334155', { ry: -0.3 });
    sign("ROSA'S ELECTRICAL", X + 14 + 3.05 * Math.sin(-0.3), H + 3.3, Q + 13 + 3.05 * Math.cos(-0.3), -0.3, 3.2, { bg: '#0ea5e9', fg: '#ffffff' });
    // hydrogen bus stop
    const BS = [X - 18, Q + 18];
    for (const dx of [-1.6, 1.6]) kit.cyl(0.06, 0.06, 2.6, 4, BS[0] + dx, H, BS[1], '#475569');
    kit.box(3.8, 0.12, 1.6, BS[0], H + 2.6, BS[1] - 0.4, '#334155');
    kit.box(7, 2.6, 2.4, BS[0] + 1, H + 0.4, BS[1] + 2.6, '#14b8a6');
    kit.box(6.6, 0.9, 0.06, BS[0] + 1, H + 1.7, BS[1] + 3.82, '#ffffff', { kind: 'glow', jitter: 0 });
    for (const dx of [-2, 3.4]) for (const dz of [1.4, 3.8]) kit.cyl(0.45, 0.45, 0.35, 10, BS[0] + dx, H + 0.45, BS[1] + dz, '#111827', { rx: Math.PI / 2 });
    kit.rect(BS[0] + 1, BS[1] + 2.6, 7.4, 2.8);
    sign('H₂ BUS', BS[0] + 1, H + 2.25, BS[1] + 3.83, 0, 1.4, { bg: '#0f766e', fg: '#ffffff' });
  }

  // ======================= HARBOUR =======================
  {
    const Z = ZONE.harbour, H = Z.h, X = Z.x, Q = Z.z;
    kit.house(X - 6, H, Q - 4, 6, 4, 5, '#e0e7ff', '#1e3a8a', { flat: true });
    sign('HARBOUR MASTER', X - 6, H + 3.3, Q - 1.45, 0, 3, { bg: '#1e3a8a', fg: '#e0f2fe' });
    kit.cyl(0.08, 0.08, 3, 4, X - 6, H + 4.4, Q - 4, '#475569');
    const radar = mesh(new THREE.BoxGeometry(2, 0.15, 0.3), std('#e2e8f0'), X - 6, H + 7.5, Q - 4); root.add(radar);
    dynamic.push({ update(dt) { radar.rotation.y += dt * 1.5; } });
    // piers (deck top at y = H)
    const rustMat = std('#8b5a3c');
    const pierPosts = [];
    const pier = (x1, x2, z, w) => {
      kit.box(x2 - x1, 0.3, w, (x1 + x2) / 2, H - 0.3, z, '#8b6b4a');
      for (let x = x1 + 1; x < x2; x += 3.5) for (const s of [-1, 1]) {
        const p = mesh(new THREE.CylinderGeometry(0.22, 0.22, 6, 8), rustMat, x, H - 3.3, z + s * (w / 2 - 0.2)); root.add(p); pierPosts.push(p);
        kit.box(0.32, 0.4, 0.2, x, H - 1.6, z + s * (w / 2 - 0.05), '#a3a3a3');
      }
      docks.push({ x1, x2, z1: z - w / 2, z2: z + w / 2, y: H });
    };
    pier(X + 10, X + 42, Q - 3, 4);
    pier(X + 12, X + 32, Q + 11, 3);
    docks.push({ x1: X + 8, x2: X + 13, z1: Q - 5, z2: Q + 13, y: H });
    kit.box(5, 0.3, 18, X + 10.5, H - 0.3, Q + 4, '#8b6b4a');
    dynamic.push({ update(dt, t, ctx) { rustMat.color.set(ctx.flags.rust_fixed ? '#6b7280' : '#8b5a3c'); } });
    // breakwater
    for (let i = 0; i < 26; i++) {
      const z = Q - 20 + i * 1.6; if (z > Q + 3 && z < Q + 13) continue;
      const s = 1.2 + rnd() * 0.8; kit.sphere(s, X + 47 + (rnd() - 0.5) * 1.2, -0.6, z, '#78716c', { ico: true, detail: 0 });
    }
    // boats
    const boats = [];
    const boat = (x, z, len, col, ry, mast) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
      const shape = new THREE.Shape(); shape.moveTo(-len / 2, 0.4); shape.lineTo(len / 2 - 1, 0.4); shape.lineTo(len / 2, 1.3); shape.lineTo(-len / 2, 1.3); shape.lineTo(-len / 2, 0.4);
      const hull = mesh(new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: false }), std(col)); hull.position.set(0, -0.6, -1.1); g.add(hull);
      const deck = mesh(new THREE.BoxGeometry(len - 1.2, 0.1, 2.1), std('#d6c3a0'), -0.4, 0.72, 0); g.add(deck);
      const cab = mesh(new THREE.BoxGeometry(len * 0.3, 1.2, 1.6), std('#f8fafc'), -len * 0.15, 1.35, 0); g.add(cab);
      if (mast) { const m = mesh(new THREE.CylinderGeometry(0.07, 0.07, 6, 6), std('#e7e5e4'), len * 0.1, 3.7, 0); g.add(m);
        const sail = mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 5, 0), new THREE.Vector3(-2.8, 0.3, 0)]), new THREE.MeshStandardMaterial({ color: '#fafaf9', side: THREE.DoubleSide }), len * 0.1, 1.2, 0);
        sail.geometry.computeVertexNormals(); g.add(sail); }
      g.userData.ph = rnd() * 10; boats.push(g);
    };
    boat(X + 24, Q + 4, 7, '#dc2626', 0, false);
    boat(X + 22, Q + 17.5, 10, '#1d4ed8', 0, false);
    boat(X + 36, Q + 6, 6, '#f8fafc', 0.2, true);
    dynamic.push({ update(dt, t) { for (const b of boats) { const p = b.userData.ph; b.position.y = Math.sin(t * 1.2 + p) * 0.12; b.rotation.z = Math.sin(t * 0.9 + p) * 0.03; b.rotation.x = Math.sin(t * 0.7 + p) * 0.02; } } });
    // crane
    const CR = [X + 10, Q - 12];
    kit.box(3, 1, 3, CR[0], H, CR[1], '#475569'); kit.box(1, 11, 1, CR[0], H + 1, CR[1], '#f59e0b');
    kit.box(12, 0.8, 0.8, CR[0] + 3, H + 12, CR[1], '#f59e0b'); kit.box(2, 1.6, 1.4, CR[0] - 2.4, H + 10.6, CR[1], '#57534e');
    kit.cyl(0.04, 0.04, 6, 4, CR[0] + 8.5, H + 6, CR[1], '#1f2937');
    kit.box(2.5, 1.4, 1.4, CR[0] + 8.5, H + 4.6, CR[1], '#0ea5e9');
    kit.rect(CR[0], CR[1], 3.2, 3.2);
    // cargo, market stall, desal, beach
    for (let i = 0; i < 5; i++) kit.box(2.4, 1.2, 1.2, X + 2 + (i % 3) * 2.5, H + Math.floor(i / 3) * 1.2, Q + 9, ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'][i]);
    kit.rect(X + 4.5, Q + 9, 8, 1.6);
    kit.box(4, 0.9, 1.8, X - 4, H, Q + 8, '#a16207'); kit.box(4.4, 0.08, 2.4, X - 4, H + 2.4, Q + 8, '#0ea5e9', { rx: 0.15 });
    for (const dx of [-2, 2]) kit.cyl(0.06, 0.06, 2.4, 4, X - 4 + dx, H, Q + 7.2, '#475569');
    kit.rect(X - 4, Q + 8, 4.4, 2.2);
    kit.house(X - 13, H, Q + 6, 6, 4.5, 5, '#e5e7eb', '#0f766e', { flat: true });
    for (const dz of [-2, 2]) { kit.cyl(1.5, 1.5, 3.5, 14, X - 18, H, Q + 6 + dz * 1.3, '#cbd5e1'); kit.circle(X - 18, Q + 6 + dz * 1.3, 1.6); }
    sign('DESALINATION', X - 13, H + 3.6, Q + 8.55, 0, 2.6, { bg: '#0f766e', fg: '#ffffff' });
    // lifeguard tower
    const LG = [X - 2, Q + 16];
    for (const [ox, oz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) kit.box(0.12, 3, 0.12, LG[0] + ox, H, LG[1] + oz, '#f8fafc');
    kit.box(2.2, 1.2, 2.2, LG[0], H + 3, LG[1], '#ef4444'); kit.gable(2.6, 2.6, 0.8, LG[0], H + 4.2, LG[1], '#fef3c7');
    kit.rect(LG[0], LG[1], 2.2, 2.2);
    sign('UV INDEX 9', LG[0], H + 1.6, LG[1] + 1.2, 0, 1.4, { bg: '#7c3aed', fg: '#ffffff' });
    for (const [dx, dz, c] of [[6, 19, '#f43f5e'], [-8, 20, '#facc15'], [12, 21, '#22d3ee']]) {
      const ux = X + dx, uz = Q + dz, uh = Math.max(0.6, heightAt(ux, uz));
      kit.cyl(0.04, 0.04, 2.4, 4, ux, uh, uz, '#e5e7eb'); kit.cone(1.6, 0.6, 10, ux, uh + 2.1, uz, c);
    }
    // anchor
    kit.box(0.35, 2.4, 0.35, X + 4, H, Q - 8, '#7c4a2d'); kit.torus(1.0, 0.18, X + 4, H + 0.3, Q - 8, '#7c4a2d', { arc: Math.PI, rz: Math.PI }); kit.torus(0.35, 0.1, X + 4, H + 2.6, Q - 8, '#7c4a2d');
    kit.circle(X + 4, Q - 8, 1);
    // rock pool
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; kit.sphere(0.6 + rnd() * 0.4, X - 16 + Math.cos(a) * 2, H - 0.2, Q + 16 + Math.sin(a) * 2, '#78716c', { ico: true }); }
    const rp = mesh(new THREE.CircleGeometry(1.8, 16), new THREE.MeshStandardMaterial({ color: '#2aa7b8', roughness: 0.1, transparent: true, opacity: 0.85 }), X - 16, H + 0.05, Q + 16, false); rp.rotation.x = -Math.PI / 2; root.add(rp);
    kit.circle(X - 16, Q + 16, 2.4);
  }

  // ======================= MARKET STREET =======================
  {
    const Z = ZONE.market, H = Z.h, X = Z.x, Q = Z.z;
    kit.box(50, 0.06, 6, X, H, Q, '#b9a88f', { jitter: 0.01 });
    const shops = [
      [-16, '#f5deb3', '#b45309', 'BAKERY', '#b91c1c', '#ffffff'],
      [-6, '#d1fae5', '#065f46', 'CAFÉ KINETIC', '#15803d', '#ffffff'],
      [4, '#e0f2fe', '#0f172a', 'PHARMACY', '#0f766e', '#ffffff'],
      [14, '#f5d0fe', '#581c87', 'IRIS CRAFTS', '#a21caf', '#ffffff'],
    ];
    for (const [dx, wall, roof, label, awn, fg] of shops) {
      kit.house(X + dx, H, Q - 9, 8, 5, 6, wall, roof, { doorX: -2 });
      for (let k = 0; k < 6; k++) kit.box(1.33, 0.08, 1.6, X + dx - 3.33 + k * 1.33, H + 3.1, Q - 5.4, k % 2 ? '#ffffff' : awn, { rx: 0.35, jitter: 0 });
      sign(label, X + dx, H + 4.2, Q - 5.95, 0, 3.6, { bg: awn, fg });
    }
    kit.cyl(0.5, 0.5, 2.5, 8, X - 19, H + 5.5, Q - 10, '#7c2d12');
    const bakeSmoke = makeSmoke(root, new THREE.Vector3(X - 19, H + 8.2, Q - 10), '#e7e5e4');
    dynamic.push({ update(dt, t, ctx) { bakeSmoke.update(dt, !!ctx.flags.bread_fixed); } });
    kit.box(4, 0.15, 1.2, X + 4 - 2, H + 5.3, Q - 6.1, '#16a34a', { kind: 'glow', jitter: 0 });
    // café tables
    for (const dx of [-8, -4]) { kit.cyl(0.5, 0.5, 0.06, 10, X + dx, H + 0.75, Q - 3.6, '#f8fafc'); kit.cyl(0.05, 0.05, 0.75, 4, X + dx, H, Q - 3.6, '#334155'); kit.circle(X + dx, Q - 3.6, 0.7); }
    // fruit stall
    kit.box(4.5, 0.9, 1.8, X - 10, H, Q + 9, '#92400e');
    for (let k = 0; k < 18; k++) kit.sphere(0.2, X - 12 + (k % 9) * 0.5, H + 1.05, Q + 8.6 + Math.floor(k / 9) * 0.7, ['#f97316', '#ef4444', '#84cc16', '#facc15'][k % 4], { ico: true });
    kit.box(5, 0.08, 2.6, X - 10, H + 2.6, Q + 9, '#f59e0b', { rx: -0.12 });
    for (const dx of [-2.2, 2.2]) kit.cyl(0.05, 0.05, 2.6, 4, X - 10 + dx, H, Q + 10, '#475569');
    kit.rect(X - 10, Q + 9, 4.8, 2.2);
    // ice cream cart
    kit.box(2.2, 1.1, 1.2, X - 20, H + 0.3, Q + 6, '#fbcfe8'); kit.cyl(0.28, 0.28, 0.1, 10, X - 20.8, H, Q + 6.65, '#1f2937', { rx: Math.PI / 2 });
    kit.cyl(0.05, 0.05, 2, 4, X - 20, H + 1.4, Q + 6, '#e5e7eb'); kit.cone(1.4, 0.6, 10, X - 20, H + 3.2, Q + 6, '#38bdf8');
    kit.rect(X - 20, Q + 6, 2.4, 1.4);
    // ticket booth
    kit.box(2.2, 2.6, 2.2, X + 18, H, Q + 8, '#fde68a'); kit.cone(1.9, 1.3, 4, X + 18, H + 2.6, Q + 8, '#ef4444', { ry: Math.PI / 4 });
    kit.box(1.4, 0.7, 0.06, X + 18, H + 1.3, Q + 6.88, '#ffffff', { kind: 'glow', jitter: 0 }); kit.rect(X + 18, Q + 8, 2.4, 2.4);
    sign('TICKETS', X + 18, H + 2.3, Q + 6.86, 0, 1.5, { bg: '#7c2d12', fg: '#fde68a' });
    // fireworks crate
    kit.box(1.6, 0.9, 1.1, X + 20, H, Q - 4, '#7f1d1d'); kit.rect(X + 20, Q - 4, 1.7, 1.2);
    // Mr Teo's cottage
    kit.house(X + 10, H, Q + 15, 6, 3.6, 5, '#fef3c7', '#9a3412', { ry: Math.PI });
    for (let k = 0; k < 10; k++) kit.box(0.08, 0.8, 0.08, X + 5.5 + k * 1, H, Q + 11.3, '#f8fafc');
    kit.box(9, 0.08, 0.08, X + 10, H + 0.7, Q + 11.3, '#f8fafc');
    // lamps + bunting
    const mLamps = [];
    for (let i = 0; i < 6; i++) mLamps.push(lampPost(X - 20 + i * 8, Q + 3.4, H, marketLampMat));
    const flagCols = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];
    for (let i = 0; i < 5; i++) {
      const ax = X - 20 + i * 8 + 0.4, bx = ax + 8;
      for (let k = 1; k < 10; k++) { const u = k / 10; const x = lerp(ax, bx, u); const y = H + 3.3 - Math.sin(u * Math.PI) * 0.7;
        kit.cone(0.18, 0.4, 3, x, y - 0.4, Q + 3.4, flagCols[(k + i) % 5], { rx: Math.PI, jitter: 0 }); }
    }
    dynamic.push({ update(dt, t, ctx) {
      if (ctx.flags.lights_fixed) { const v = ctx.night > 0.3 ? 2.6 : 0.5; marketLampMat.color.setRGB(v, v * 0.82, v * 0.5); }
      else { const fl = ctx.night > 0.3 && Math.sin(t * 23) * Math.sin(t * 7.7) > 0.6 ? 1.2 : 0.18; marketLampMat.color.setRGB(fl, fl * 0.8, fl * 0.5); }
    } });
  }

  // ======================= CLINIC & SPORTS =======================
  {
    const Z = ZONE.clinic, H = Z.h, X = Z.x, Q = Z.z;
    kit.house(X - 14, H, Q - 15, 14, 6, 8, '#f8fafc', '#94a3b8', { flat: true, doorX: 2 });
    kit.house(X - 23, H, Q - 13, 5, 5, 9, '#f1f5f9', '#94a3b8', { flat: true });
    kit.box(14.2, 0.6, 0.1, X - 14, H + 5.2, Q - 10.95, '#0d9488', { jitter: 0 });
    kit.box(5, 0.2, 3, X - 12, H + 3, Q - 9.6, '#0d9488');
    for (const dx of [-14, -10]) kit.cyl(0.08, 0.08, 3, 4, X + dx, H, Q - 8.3, '#94a3b8');
    const cross = new THREE.Group(); cross.position.set(X - 17, H + 4.2, Q - 10.9); root.add(cross);
    const cm = glowMat(2.2, 0.3, 0.4);
    cross.add(mesh(new THREE.BoxGeometry(1.4, 0.45, 0.1), cm, 0, 0, 0, false), mesh(new THREE.BoxGeometry(0.45, 1.4, 0.1), cm, 0, 0, 0, false));
    sign('BRIGHTWATER CLINIC', X - 12, H + 5.95, Q - 10.9, 0, 4.6, { bg: '#0f766e', fg: '#ffffff' });
    // ambulance
    kit.box(4.6, 2, 2.1, X - 4, H + 0.4, Q - 17, '#ffffff'); kit.box(1.6, 1.5, 2.1, X - 1.2, H + 0.4, Q - 17, '#f8fafc');
    kit.box(4.6, 0.25, 2.14, X - 4, H + 1.2, Q - 17, '#dc2626', { jitter: 0 });
    for (const dx of [-5.5, -2]) for (const dz of [-1.05, 1.05]) kit.cyl(0.42, 0.42, 0.3, 10, X + dx, H + 0.42, Q - 17 + dz, '#111827', { rx: Math.PI / 2 });
    kit.rect(X - 3.6, Q - 17, 6.6, 2.4);
    // running track (stadium shape)
    const T = [X + 10, Q + 6];
    const stadium = (L, R) => { const s = new THREE.Shape(); s.moveTo(-L, -R); s.lineTo(L, -R); s.absarc(L, 0, R, -Math.PI / 2, Math.PI / 2, false); s.lineTo(-L, R); s.absarc(-L, 0, R, Math.PI / 2, (3 * Math.PI) / 2, false); return s; };
    const outer = stadium(9, 9.5); outer.holes.push(stadium(9, 6.5));
    const tr = mesh(new THREE.ShapeGeometry(outer, 24), std('#c2410c', { rough: 0.95 }), T[0], H + 0.05, T[1], false); tr.rotation.x = -Math.PI / 2; tr.receiveShadow = true; root.add(tr);
    const fld = mesh(new THREE.ShapeGeometry(stadium(9, 6.5), 24), std('#4d9a3f', { rough: 1 }), T[0], H + 0.04, T[1], false); fld.rotation.x = -Math.PI / 2; fld.receiveShadow = true; root.add(fld);
    for (const r of [7.5, 8.5]) {
      const ring = stadium(9, r + 0.06); ring.holes.push(stadium(9, r - 0.06));
      const lm = mesh(new THREE.ShapeGeometry(ring, 24), new THREE.MeshBasicMaterial({ color: '#fef3c7' }), T[0], H + 0.07, T[1], false); lm.rotation.x = -Math.PI / 2; root.add(lm);
    }
    for (let k = 0; k < 4; k++) kit.box(12, 0.5, 1, T[0], H + k * 0.5, T[1] - 12 - k * 0.9, '#94a3b8');
    kit.rect(T[0], T[1] - 13.3, 12.4, 4);
    for (const s of [-1, 1]) { kit.box(0.12, 2.2, 0.12, T[0] + s * 13, H, T[1] - 1.2, '#f8fafc'); kit.box(0.12, 2.2, 0.12, T[0] + s * 13, H, T[1] + 1.2, '#f8fafc'); kit.box(0.12, 0.12, 2.5, T[0] + s * 13, H + 2.2, T[1], '#f8fafc'); }
    anchors.track = new THREE.Vector3(T[0], H, T[1]);
    // fountain + sanitiser + heat sign
    kit.cyl(0.25, 0.3, 1, 8, X - 2, H, Q + 2, '#94a3b8'); kit.cyl(0.4, 0.3, 0.2, 10, X - 2, H + 1, Q + 2, '#cbd5e1'); kit.circle(X - 2, Q + 2, 0.5);
    kit.box(0.5, 1.4, 0.4, X - 6, H, Q - 10, '#0ea5e9'); kit.circle(X - 6, Q - 10, 0.5);
    kit.box(0.1, 2.2, 0.1, X + 22, H, Q - 4, '#475569');
    sign('⚠ HEAT WARNING', X + 22, H + 2.1, Q - 3.9, 0, 1.6, { bg: '#f97316', fg: '#ffffff' });
    kit.box(1.6, 1.2, 0.1, X - 18, H + 0.8, Q - 4, '#ffffff'); kit.box(0.08, 0.8, 0.08, X - 18.6, H, Q - 4, '#475569'); kit.box(0.08, 0.8, 0.08, X - 17.4, H, Q - 4, '#475569');
    sign('GET VACCINATED', X - 18, H + 1.4, Q - 3.93, 0, 1.4, { bg: '#ffffff', fg: '#0f766e' });
  }

  // ======================= HARVEST FIELDS =======================
  {
    const Z = ZONE.farm, H = Z.h, X = Z.x, Q = Z.z;
    // barn & silo
    kit.house(X - 2, H, Q - 16, 10, 6.5, 8, '#b91c1c', '#f5f5f4', { roofH: 3.4 });
    kit.box(3.2, 3.6, 0.1, X - 2, H, Q - 11.95, '#7f1d1d');
    kit.cyl(2.2, 2.2, 10, 16, X + 5.5, H, Q - 17, '#d6d3d1'); kit.sphere(2.2, X + 5.5, H + 10, Q - 17, '#94a3b8', { half: true }); kit.circle(X + 5.5, Q - 17, 2.3);
    // fertiliser sacks
    for (let k = 0; k < 4; k++) kit.box(0.9, 0.45, 0.6, X - 0.5 + (k % 2) * 1, H + Math.floor(k / 2) * 0.45, Q - 7.5, '#e7e5e4');
    kit.rect(X, Q - 7.5, 2.2, 1);
    // greenhouse
    const G = [X + 12, Q - 8];
    kit.box(10, 0.3, 6, G[0], H, G[1], '#a8a29e');
    kit.box(10, 3.2, 6, G[0], H + 0.3, G[1], '#dff6ff', { kind: 'glass', jitter: 0 });
    kit.gable(10, 6, 1.6, G[0], H + 3.5, G[1], '#dff6ff', { kind: 'glass', jitter: 0 });
    for (let k = 0; k <= 5; k++) kit.box(0.1, 3.4, 6.05, G[0] - 5 + k * 2, H + 0.3, G[1], '#e7e5e4');
    kit.rect(G[0], G[1], 10.4, 6.4);
    const ghPlants = new THREE.Group(); root.add(ghPlants);
    const ghMat = std('#4d7c0f');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) { const p = mesh(new THREE.IcosahedronGeometry(0.35, 0), ghMat, G[0] - 4 + c * 1.15, H + 0.75, G[1] - 1.8 + r * 1.8); ghPlants.add(p); }
    dynamic.push({ update(dt, t, ctx) { const s = ctx.flags.crops_fixed ? 1.6 : 0.8; ghPlants.children.forEach((p) => p.scale.setScalar(s)); ghMat.color.set(ctx.flags.crops_fixed ? '#3f9d2f' : '#8a9a3b'); } });
    // lettuce bed (wilts until fixed)
    kit.box(8, 0.25, 4, X - 10, H, Q - 12, '#6b4a2f');
    const lettuce = new THREE.Group(); root.add(lettuce);
    const letMat = std('#84cc16');
    for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) { const p = mesh(new THREE.SphereGeometry(0.4, 8, 6), letMat, X - 13 + c * 1.0, H + 0.5, Q - 13.2 + r * 1.2); lettuce.add(p); }
    dynamic.push({ update(dt, t, ctx) { const ok = ctx.flags.wilting_fixed; lettuce.children.forEach((p) => p.scale.set(ok ? 1 : 1.2, ok ? 0.9 : 0.35, ok ? 1 : 1.2)); letMat.color.set(ok ? '#65d02a' : '#b5a542'); } });
    // wheat strip
    const wheatGeo = new THREE.ConeGeometry(0.12, 1.1, 4); const wheatMat = std('#e3c35a');
    const wheat = new THREE.InstancedMesh(wheatGeo, wheatMat, 160); const dm = new THREE.Object3D();
    for (let i = 0; i < 160; i++) { dm.position.set(X - 9 + (i % 20) * 0.5 + (rnd() - 0.5) * 0.2, H + 0.55, Q + 1 + Math.floor(i / 20) * 0.6); dm.rotation.set((rnd() - 0.5) * 0.2, 0, (rnd() - 0.5) * 0.2); dm.updateMatrix(); wheat.setMatrixAt(i, dm.matrix); }
    wheat.castShadow = true; root.add(wheat);
    // scarecrow
    kit.box(0.12, 2.2, 0.12, X - 4, H, Q + 3, '#7c4a2d'); kit.box(1.6, 0.1, 0.1, X - 4, H + 1.6, Q + 3, '#7c4a2d'); kit.sphere(0.25, X - 4, H + 2.35, Q + 3, '#fde68a'); kit.cone(0.4, 0.4, 8, X - 4, H + 2.5, Q + 3, '#a16207');
    // pumpkins
    kit.box(10, 0.15, 6, X + 8, H, Q + 10, '#5b4128');
    for (let k = 0; k < 16; k++) { const s = 0.3 + rnd() * 0.45; kit.sphere(s, X + 4 + (k % 8) * 1.1, H + 0.1 + s * 0.6, Q + 8.2 + Math.floor(k / 8) * 2.6 + rnd() * 0.6, k === 5 ? '#f8fafc' : '#f97316', { sy: 0.7, ws: 10, hs: 6 }); }
    // strawberries
    for (let k = 0; k < 24; k++) kit.sphere(0.12, X - 3 + (k % 12) * 0.5, H + 0.25, Q + 13.5 + Math.floor(k / 12) * 0.8, '#dc2626', { ico: true });
    for (let k = 0; k < 24; k++) kit.sphere(0.22, X - 3 + (k % 12) * 0.5, H + 0.15, Q + 13.7 + Math.floor(k / 12) * 0.8, '#15803d', { ico: true, sy: 0.5 });
    // beehives + flowers
    for (let k = 0; k < 3; k++) { kit.box(0.8, 0.9, 0.8, X - 14 + k * 1.4, H, Q + 12, '#fde68a'); kit.box(0.9, 0.12, 0.9, X - 14 + k * 1.4, H + 0.9, Q + 12, '#f8fafc'); kit.circle(X - 14 + k * 1.4, Q + 12, 0.6); }
    for (let k = 0; k < 40; k++) kit.sphere(0.13, X - 16 + rnd() * 7, H + 0.35, Q + 7 + rnd() * 4, ['#f472b6', '#facc15', '#a78bfa', '#f8fafc', '#fb7185'][k % 5], { ico: true });
    const bees = new THREE.Group(); bees.position.set(X - 12.6, H + 1.2, Q + 10); root.add(bees);
    for (let k = 0; k < 10; k++) { const b = mesh(new THREE.SphereGeometry(0.06, 5, 4), std('#facc15'), 0, 0, 0, false); b.userData.p = rnd() * 10; bees.add(b); }
    dynamic.push({ update(dt, t) { bees.children.forEach((b) => { const p = b.userData.p; b.position.set(Math.sin(t * 1.7 + p) * 2.5, Math.sin(t * 3 + p * 2) * 0.4, Math.cos(t * 1.3 + p * 1.5) * 2); }); } });
    // cows paddock
    const C = [X + 18, Q + 3];
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; kit.box(0.1, 1, 0.1, C[0] + Math.cos(a) * 5, H, C[1] + Math.sin(a) * 4, '#a16207'); }
    for (let k = 0; k < 3; k++) {
      const cx = C[0] - 2 + k * 2, cz = C[1] - 1 + (k % 2) * 2;
      kit.box(1.6, 0.9, 0.8, cx, H + 0.6, cz, '#f8fafc'); kit.box(0.5, 0.5, 0.5, cx + 1, H + 1.1, cz, '#f8fafc');
      kit.box(0.4, 0.4, 0.82, cx - 0.2, H + 0.9, cz, '#1f2937', { jitter: 0 });
      for (const [lx, lz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) kit.box(0.15, 0.6, 0.15, cx + lx, H, cz + lz, '#f8fafc');
    }
    kit.circle(C[0], C[1], 4.6);
    // compost + windmill
    kit.box(2.4, 1, 2.4, X - 18, H, Q, '#57412a'); kit.sphere(1.1, X - 18, H + 1, Q, '#4d3b25', { ico: true, sy: 0.5 }); kit.rect(X - 18, Q, 2.6, 2.6);
    const WM = [X - 22, Q - 16];
    kit.cyl(1.6, 2.4, 8, 8, WM[0], H, WM[1], '#e7e5e4'); kit.cone(2, 2, 8, WM[0], H + 8, WM[1], '#78350f'); kit.circle(WM[0], WM[1], 2.5);
    const sails = new THREE.Group(); sails.position.set(WM[0], H + 8, WM[1] + 2); root.add(sails);
    for (let i = 0; i < 4; i++) { const s = mesh(new THREE.BoxGeometry(1.1, 6, 0.08), std('#fef3c7')); s.geometry.translate(0, 3.2, 0); s.rotation.z = (i / 4) * TAU; sails.add(s); }
    dynamic.push({ update(dt) { sails.rotation.z += dt * 0.5; } });
    // tractor
    kit.box(2.2, 1.2, 1.4, X + 2, H + 0.6, Q - 4, '#16a34a'); kit.box(1, 1, 1.2, X + 1.4, H + 1.8, Q - 4, '#15803d');
    for (const [dx, r] of [[1.4, 0.75], [3, 0.5]]) for (const dz of [-0.85, 0.85]) kit.cyl(r, r, 0.35, 12, X + dx - 0.6, H + r, Q - 4 + dz, '#1c1917', { rx: Math.PI / 2 });
    kit.rect(X + 2, Q - 4, 3.6, 2);
  }

  // ======================= ECO WORKS =======================
  {
    const Z = ZONE.eco, H = Z.h, X = Z.x, Q = Z.z;
    const FC = [X - 6, Q - 10];
    kit.cyl(1.7, 1.9, 19, 16, FC[0], H, FC[1], '#a8a29e');
    for (let k = 1; k < 8; k++) kit.torus(1.95, 0.12, FC[0], H + k * 2.4, FC[1], '#78716c', { rx: Math.PI / 2, ts: 20 });
    for (let k = 1; k < 6; k++) kit.box(4, 0.25, 0.25, FC[0] + 3.5, H + k * 3, FC[1], '#57534e');
    kit.circle(FC[0], FC[1], 2.2);
    for (const [dx, dz] of [[-14, -4], [-14, 4.5]]) { kit.cyl(3, 3, 4, 20, X + dx, H, Q + dz, '#f5f5f4'); kit.sphere(3, X + dx, H + 4, Q + dz, '#e7e5e4', { half: true, ws: 20 }); kit.circle(X + dx, Q + dz, 3.1); }
    const CU = [X + 6, Q - 10];
    kit.cyl(1.2, 1.2, 6, 12, CU[0], H, CU[1], '#94a3b8'); kit.cyl(0.8, 0.8, 4, 12, CU[0] + 2.6, H, CU[1] + 1, '#cbd5e1');
    kit.box(3, 0.3, 0.3, CU[0] + 1.3, H + 3.6, CU[1] + 0.5, '#57534e', { ry: -0.3 });
    kit.cyl(0.2, 0.3, 12, 8, CU[0] - 3, H, CU[1] - 2, '#78716c');
    kit.rect(CU[0] + 1, CU[1], 6, 4);
    const flare = mesh(new THREE.ConeGeometry(0.5, 1.8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.3), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), CU[0] - 3, H + 12.9, CU[1] - 2, false);
    root.add(flare);
    const ecoSmoke = makeSmoke(root, new THREE.Vector3(CU[0] - 3, H + 13.8, CU[1] - 2), '#3f3f46');
    dynamic.push({ update(dt, t, ctx) { const dirty = !ctx.flags.air_fixed; flare.visible = dirty; flare.scale.y = 1 + Math.sin(t * 12) * 0.15; ecoSmoke.update(dt, dirty); } });
    // recycling yard
    const bins = ['#2563eb', '#16a34a', '#facc15', '#9ca3af'];
    bins.forEach((c, k) => { kit.box(1.6, 1.3, 1.2, X - 7 + k * 1.9, H, Q + 8, c); });
    kit.rect(X - 4.2, Q + 8, 7.8, 1.4);
    for (let k = 0; k < 6; k++) kit.box(1.3, 1.3, 1.3, X - 1 + (k % 3) * 1.4, H + Math.floor(k / 3) * 1.3, Q + 11.5, ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#e5e7eb', '#a78bfa'][k], { jitter: 0.08 });
    kit.rect(X + 0.4, Q + 11.5, 4.4, 1.6);
    // electromagnet crane
    const EM = [X - 12, Q + 12];
    kit.box(1.2, 8, 1.2, EM[0], H, EM[1], '#eab308'); kit.box(6, 0.6, 0.6, EM[0] + 2.6, H + 8, EM[1], '#eab308');
    kit.cyl(0.03, 0.03, 3, 4, EM[0] + 5, H + 5, EM[1], '#1f2937');
    kit.cyl(1.0, 1.0, 0.5, 16, EM[0] + 5, H + 4.6, EM[1], '#374151');
    for (let k = 0; k < 14; k++) kit.cyl(0.16, 0.16, 0.45, 8, EM[0] + 4 + rnd() * 2.4, H + (k > 9 ? 0.45 : 0), EM[1] - 1 + rnd() * 2, k % 3 ? '#cbd5e1' : '#b45309', { rx: rnd() > 0.5 ? Math.PI / 2 : 0 });
    kit.rect(EM[0], EM[1], 1.5, 1.5);
    // air quality station + anemometer
    const AQ = [X + 10, Q + 4];
    kit.box(1.4, 1.6, 1, AQ[0], H, AQ[1], '#e2e8f0'); kit.box(1, 0.5, 0.05, AQ[0], H + 1.1, AQ[1] + 0.52, '#ffffff', { kind: 'glow', jitter: 0 });
    kit.cyl(0.05, 0.05, 3.5, 4, AQ[0] + 0.5, H + 1.6, AQ[1], '#64748b'); kit.rect(AQ[0], AQ[1], 1.6, 1.2);
    const anem = new THREE.Group(); anem.position.set(AQ[0] + 0.5, H + 5.1, AQ[1]); root.add(anem);
    for (let i = 0; i < 3; i++) { const arm = mesh(new THREE.BoxGeometry(0.6, 0.03, 0.03), std('#64748b'), 0.3, 0, 0, false); const cup = mesh(new THREE.SphereGeometry(0.1, 6, 4, 0, TAU, 0, Math.PI / 2), std('#f8fafc'), 0.6, 0, 0, false); cup.rotation.z = Math.PI / 2;
      const g = new THREE.Group(); g.add(arm, cup); g.rotation.y = (i / 3) * TAU; anem.add(g); }
    dynamic.push({ update(dt) { anem.rotation.y += dt * 3; } });
    sign('AIR QUALITY', AQ[0], H + 1.9, AQ[1] + 0.53, 0, 1.3, { bg: '#0f766e', fg: '#ffffff' });
    // car + biofuel
    kit.box(3.8, 0.9, 1.8, X + 14, H + 0.35, Q + 12, '#dc2626'); kit.box(2, 0.7, 1.6, X + 13.8, H + 1.25, Q + 12, '#fecaca');
    for (const dx of [-1.2, 1.2]) for (const dz of [-0.9, 0.9]) kit.cyl(0.35, 0.35, 0.25, 10, X + 14 + dx, H + 0.35, Q + 12 + dz, '#111827', { rx: Math.PI / 2 });
    kit.rect(X + 14, Q + 12, 4, 2);
    kit.cyl(1.4, 1.4, 3, 14, X + 2, H, Q + 15, '#65a30d'); kit.circle(X + 2, Q + 15, 1.5);
    sign('ECO WORKS', X - 6 + 2.0, H + 2.5, Q - 7.8, 0, 2.6, { bg: '#134e4a', fg: '#5eead4' });
  }

  // ======================= WHISPERING WOODS =======================
  {
    const Z = ZONE.woods, H = Z.h, X = Z.x, Q = Z.z;
    // ranger hut (log cabin)
    const RH = [X + 10, Q + 12];
    for (let k = 0; k < 7; k++) { kit.cyl(0.25, 0.25, 6.4, 8, RH[0] - 3.2, H + 0.25 + k * 0.5, RH[1] - 2.5, '#7c4a2d', { rz: Math.PI / 2 }); kit.cyl(0.25, 0.25, 6.4, 8, RH[0] - 3.2, H + 0.25 + k * 0.5, RH[1] + 2.5, '#7c4a2d', { rz: Math.PI / 2 }); }
    kit.box(6, 3.5, 5, RH[0], H, RH[1], '#8b5a2b');
    kit.gable(7, 6, 2.2, RH[0], H + 3.5, RH[1], '#3f2a1a');
    kit.box(1.1, 2, 0.1, RH[0], H, RH[1] - 2.56, '#3f2a1a');
    kit.box(1, 0.9, 0.08, RH[0] + 1.8, H + 1.5, RH[1] - 2.56, '#ffffff', { kind: 'glow', jitter: 0 });
    kit.rect(RH[0], RH[1], 6.6, 5.6);
    sign('RANGER STATION', RH[0], H + 3.2, RH[1] - 2.62, Math.PI, 2.6, { bg: '#365314', fg: '#ecfccb' });
    // pond
    const PD = [X - 2, Q + 15];
    const pond = mesh(new THREE.CircleGeometry(5.2, 24), new THREE.MeshStandardMaterial({ color: '#2b8a9a', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.88 }), PD[0], H - 0.15, PD[1], false);
    pond.rotation.x = -Math.PI / 2; root.add(pond);
    kit.circle(PD[0], PD[1], 5.2);
    for (let k = 0; k < 7; k++) { const a = rnd() * TAU, r = rnd() * 4; kit.cyl(0.45, 0.45, 0.03, 10, PD[0] + Math.cos(a) * r, H - 0.12, PD[1] + Math.sin(a) * r, '#4d7c0f'); }
    for (let k = 0; k < 26; k++) { const a = (k / 26) * TAU; kit.cyl(0.03, 0.04, 1.2 + rnd() * 0.6, 4, PD[0] + Math.cos(a) * 5.4, H - 0.2, PD[1] + Math.sin(a) * 5.4, '#65a30d'); }
    // fallen log with fungi
    kit.cyl(0.6, 0.6, 5, 10, X - 12.5, H + 0.6, Q + 4, '#6b4a2f', { rz: Math.PI / 2 });
    for (let k = 0; k < 7; k++) { const fx = X - 12 + k * 0.6; kit.cyl(0.04, 0.05, 0.3, 5, fx, H + 1.05, Q + 4.3, '#fef3c7'); kit.sphere(0.22, fx, H + 1.35, Q + 4.3, k % 2 ? '#dc2626' : '#f59e0b', { half: true, ws: 8 }); }
    kit.rect(X - 10, Q + 4, 5.4, 1.4);
    // cleared hillside stumps + saplings
    const stumpsC = [X + 16, Q - 12];
    for (let k = 0; k < 12; k++) { const sx = stumpsC[0] + (rnd() - 0.5) * 12, sz = stumpsC[1] + (rnd() - 0.5) * 9; kit.cyl(0.45, 0.55, 0.5, 8, sx, heightAt(sx, sz), sz, '#8b6b4a'); }
    const saplings = new THREE.Group(); root.add(saplings);
    for (let k = 0; k < 14; k++) { const sx = stumpsC[0] + (rnd() - 0.5) * 12, sz = stumpsC[1] + (rnd() - 0.5) * 9; const s = new THREE.Group(); s.position.set(sx, heightAt(sx, sz), sz);
      s.add(mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.8, 5), std('#6b4a2f'), 0, 0.4, 0), mesh(new THREE.IcosahedronGeometry(0.5, 0), std('#4ade80'), 0, 1.0, 0)); saplings.add(s); }
    dynamic.push({ update(dt, t, ctx) { saplings.visible = !!ctx.flags.forest_fixed; } });
    // seed bank box, moth trap, oak, reef lookout
    kit.box(1.2, 0.8, 0.8, X + 6, H + 0.6, Q - 4, '#64748b'); for (const dx of [-0.5, 0.5]) kit.box(0.08, 0.6, 0.08, X + 6 + dx, H, Q - 4, '#334155'); kit.rect(X + 6, Q - 4, 1.4, 1);
    kit.box(2, 1.6, 0.05, X - 14, H + 0.2, Q - 8, '#f8fafc'); kit.box(0.08, 1.8, 0.08, X - 15, H, Q - 8, '#78716c'); kit.box(0.08, 1.8, 0.08, X - 13, H, Q - 8, '#78716c');
    const mothLamp = mesh(new THREE.SphereGeometry(0.18, 8, 6), glowMat(2.4, 2.4, 3), X - 14, H + 2.1, Q - 7.9, false); root.add(mothLamp);
    for (let k = 0; k < 5; k++) { const bx = X - 18 + k * 1.6, bz = Q - 11 + (k % 2) * 1.5; kit.cyl(0.18, 0.22, 6, 7, bx, heightAt(bx, bz), bz, '#f5f5f4'); kit.sphere(1.3, bx, heightAt(bx, bz) + 6.2, bz, '#a3e635', { ico: true }); kit.circle(bx, bz, 0.4); }
    kit.cyl(1.2, 1.7, 6, 9, X + 14, H, Q + 8, '#5b3f28');
    for (let k = 0; k < 9; k++) kit.sphere(2.6 + rnd() * 1.4, X + 14 + (rnd() - 0.5) * 7, H + 7 + rnd() * 3, Q + 8 + (rnd() - 0.5) * 7, ['#2f6b2f', '#3b7d33', '#2a5e2a'][k % 3], { ico: true });
    kit.circle(X + 14, Q + 8, 1.8);
    const RL = [X - 22, Q - 16], rlh = heightAt(RL[0], RL[1]);
    kit.box(4, 0.25, 3, RL[0], rlh + 0.6, RL[1], '#8b6b4a');
    for (const [ox, oz] of [[-1.9, -1.4], [1.9, -1.4], [-1.9, 1.4], [1.9, 1.4]]) kit.box(0.12, 1.6, 0.12, RL[0] + ox, rlh, RL[1] + oz, '#78716c');
    docks.push({ x1: RL[0] - 2, x2: RL[0] + 2, z1: RL[1] - 1.5, z2: RL[1] + 1.5, y: rlh + 0.85 });
    const reefCols = ['#f472b6', '#fb923c', '#facc15', '#a78bfa', '#22d3ee', '#f87171'];
    for (let k = 0; k < 40; k++) {
      const a = -2.35 + (rnd() - 0.5) * 0.35, r = 128 + rnd() * 14;
      const rx = Math.cos(a) * r, rz = Math.sin(a) * r, ry = heightAt(rx, rz);
      if (ry > -0.6 || ry < -5) continue;
      if (k % 2) kit.cone(0.4 + rnd() * 0.5, 1 + rnd() * 1.4, 5, rx, ry, rz, reefCols[k % 6]);
      else kit.sphere(0.5 + rnd() * 0.6, rx, ry + 0.3, rz, reefCols[k % 6], { ico: true, detail: 1 });
    }
  }

  // signposts at the plaza
  root.add(kit.build('static'));
  return { group: root, colliders: kit.colliders, docks, dynamic, interact, anchors, lampMat };
}

/** A tiny puff-particle emitter (CPU) for chimneys. */
function makeSmoke(root, origin, color) {
  const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false, roughness: 1 });
  const geo = new THREE.IcosahedronGeometry(0.6, 0);
  const puffs = [];
  for (let i = 0; i < 18; i++) { const m = new THREE.Mesh(geo, mat.clone()); m.userData.t = i / 18 * 6; root.add(m); puffs.push(m); }
  return {
    update(dt, on) {
      for (const p of puffs) {
        p.userData.t += dt; if (p.userData.t > 6) p.userData.t = 0;
        const u = p.userData.t / 6;
        p.visible = on;
        p.position.set(origin.x + u * 6 + Math.sin(u * 9) * 0.4, origin.y + u * 9, origin.z + u * 2);
        p.scale.setScalar(0.6 + u * 2.6);
        p.material.opacity = 0.5 * (1 - u);
      }
    },
  };
}
