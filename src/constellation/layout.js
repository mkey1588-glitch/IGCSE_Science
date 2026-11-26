import { SUBTOPICS, TOPICS } from '../data/curriculum.js';
import { LINKS } from '../data/links.js';
import { mulberry32 } from '../core/util.js';

let cached = null;
/**
 * Deterministic 3D layout for the Constellation of Knowledge.
 * Subjects form three galaxies; topics form clusters; links pull related ideas together.
 */
export function constellationLayout() {
  if (cached) return cached;
  const rnd = mulberry32(2025);
  const centers = { B: [-150, -55, 0], C: [0, 115, 0], P: [150, -55, 0] };
  const nodes = [];
  const index = {};
  for (const s of ['B', 'C', 'P']) {
    const topics = TOPICS.filter((t) => t.subject === s);
    topics.forEach((t, ti) => {
      const ang = (ti / topics.length) * Math.PI * 2 + (s === 'C' ? 0.3 : s === 'P' ? 1.1 : 0);
      const rad = 62 + (ti % 2) * 14;
      const tc = [centers[s][0] + Math.cos(ang) * rad, centers[s][1] + Math.sin(ang) * rad, (rnd() - 0.5) * 50];
      t.subs.forEach((st, k) => {
        const a2 = (k / Math.max(1, t.subs.length)) * Math.PI * 2 + rnd();
        const r2 = t.subs.length > 1 ? 9 + t.subs.length * 2.2 : 0;
        const n = { id: st.id, subject: s, topic: t.id, x: tc[0] + Math.cos(a2) * r2, y: tc[1] + Math.sin(a2) * r2, z: tc[2] + (rnd() - 0.5) * 18, vx: 0, vy: 0, vz: 0 };
        index[st.id] = nodes.length; nodes.push(n);
      });
    });
  }
  // relaxation
  const edges = LINKS.map((l) => [index[l.a], index[l.b], l.cross ? 95 : 34]);
  for (const st of SUBTOPICS) {
    const t = TOPICS.find((x) => x.id === st.topic);
    const i = t.subs.indexOf(st);
    if (i > 0) edges.push([index[t.subs[i - 1].id], index[st.id], 16]);
  }
  for (let it = 0; it < 140; it++) {
    const cool = 1 - it / 140;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
      const d2 = dx * dx + dy * dy + dz * dz + 0.01;
      if (d2 > 2500) continue;
      const f = 60 / d2;
      a.vx += dx * f; a.vy += dy * f; a.vz += dz * f; b.vx -= dx * f; b.vy -= dy * f; b.vz -= dz * f;
    }
    for (const [i, j, rest] of edges) {
      const a = nodes[i], b = nodes[j];
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
      const f = ((d - rest) / d) * 0.012;
      a.vx += dx * f; a.vy += dy * f; a.vz += dz * f; b.vx -= dx * f; b.vy -= dy * f; b.vz -= dz * f;
    }
    for (const n of nodes) {
      const c = centers[n.subject];
      n.vx += (c[0] - n.x) * 0.0016; n.vy += (c[1] - n.y) * 0.0016; n.vz += (0 - n.z) * 0.003;
      n.x += n.vx * cool; n.y += n.vy * cool; n.z += n.vz * cool;
      n.vx *= 0.6; n.vy *= 0.6; n.vz *= 0.6;
    }
  }
  const topicCenters = {};
  for (const t of TOPICS) {
    const ns = t.subs.map((s) => nodes[index[s.id]]);
    topicCenters[t.id] = [ns.reduce((a, n) => a + n.x, 0) / ns.length, ns.reduce((a, n) => a + n.y, 0) / ns.length, ns.reduce((a, n) => a + n.z, 0) / ns.length];
  }
  cached = { nodes, index, centers, topicCenters };
  return cached;
}
