import * as THREE from 'three';
import { Holo, hm, hmesh, tube } from '../holo.js';

const BASES = ['#ef4444', '#3b82f6', '#22c55e', '#facc15'];

export default class DNA extends Holo {
  constructor(...a) {
    super(...a);
    this.scenario = 'Why do Leo’s prize pumpkins look like their parents — but not exactly? Zoom from a cell to its chromosomes and down to the DNA, then watch cells divide.';
    this.view = { pos: [0, 1.3, 2.4], target: [0, 1.2, 0] };
    this.mode = 'dna'; this.t0 = 0;
  }
  build() {
    const s = this.stage(1.2, 1);
    // DNA helix
    const helix = (this.helix = new THREE.Group()); helix.position.set(-0.3, 0, 0); s.add(helix);
    const N = 40, H = 0.9, R = 0.07;
    const a1 = [], a2 = [];
    for (let i = 0; i <= N; i++) { const y = -H / 2 + (i / N) * H, a = i * 0.45; a1.push([Math.cos(a) * R, y, Math.sin(a) * R]); a2.push([Math.cos(a + Math.PI) * R, y, Math.sin(a + Math.PI) * R]); }
    helix.add(tube(a1, 0.008, hm('#cbd5e1', { glow: 0.3 }), 160), tube(a2, 0.008, hm('#cbd5e1', { glow: 0.3 }), 160));
    this.gene = [];
    for (let i = 0; i <= N; i += 1) {
      const p1 = new THREE.Vector3(...a1[i]), p2 = new THREE.Vector3(...a2[i]), mid = p1.clone().add(p2).multiplyScalar(0.5);
      const k = i % 4, pairCol = [BASES[k], BASES[k ^ 1]];
      for (const [p, c] of [[p1, pairCol[0]], [p2, pairCol[1]]]) { const half = mid.clone().add(p).multiplyScalar(0.5); const r = hmesh(new THREE.CylinderGeometry(0.006, 0.006, p.distanceTo(mid), 6), hm(c, { glow: 0.4 })); r.position.copy(half); r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().sub(mid).normalize()); helix.add(r); if (i >= 14 && i <= 24) this.gene.push(r); }
    }
    // chromosome and nucleus
    const chrom = (col, len = 0.18) => { const g = new THREE.Group(); for (const sd of [-1, 1]) { const arm = hmesh(new THREE.CapsuleGeometry(0.018, len, 6, 12), hm(col, { glow: 0.3 }), sd * 0.018, 0, 0); arm.rotation.z = sd * 0.25; g.add(arm); } g.add(hmesh(new THREE.SphereGeometry(0.016, 10, 8), hm('#f8fafc', { glow: 0.3 }))); return g; };
    this.nucleus = hmesh(new THREE.SphereGeometry(0.22, 32, 24), hm('#a78bfa', { opacity: 0.18, glow: 0.3, side: THREE.DoubleSide }), 0.25, 0.15, 0); s.add(this.nucleus);
    this.chroms = [];
    const cols = ['#f472b6', '#f472b6', '#38bdf8', '#38bdf8', '#a3e635', '#a3e635'];
    cols.forEach((c, i) => { const ch = chrom(c, 0.12 - Math.floor(i / 2) * 0.025); ch.position.set(0.15 + (i % 3) * 0.1, 0.22 - Math.floor(i / 3) * 0.14, 0); ch.rotation.z = (i % 2 ? 0.4 : -0.3); this.nucleus.add(ch); ch.position.sub(this.nucleus.position); this.chroms.push(ch); });
    this.xy = new THREE.Group(); this.xy.position.set(0.3, -0.33, 0.05); s.add(this.xy);
    const X = chrom('#fb923c', 0.13); X.position.x = -0.05; this.xy.add(X); const Y = new THREE.Group(); Y.add(hmesh(new THREE.CapsuleGeometry(0.018, 0.07, 6, 12), hm('#60a5fa', { glow: 0.3 }), -0.015, 0.02, 0).rotateZ(0.2), hmesh(new THREE.CapsuleGeometry(0.018, 0.04, 6, 12), hm('#60a5fa', { glow: 0.3 }), 0.012, 0.0, 0).rotateZ(-0.3)); Y.position.x = 0.06; this.xy.add(Y);
    // dividing cells (for mitosis/meiosis)
    this.cells = new THREE.Group(); this.cells.position.set(0.25, 0.15, 0); s.add(this.cells); this.cells.visible = false;
    this.daughters = [0, 1, 2, 3].map((i) => { const c = new THREE.Group(); c.add(hmesh(new THREE.SphereGeometry(0.09, 24, 18), hm('#c4b5fd', { opacity: 0.25, glow: 0.3, side: THREE.DoubleSide }))); const k = new THREE.Group(); c.add(k); c.userData.k = k; this.cells.add(c); return c; });
    const Hs = (id, pos, title, text, ids) => this.hotspot({ id, pos, title, text, ids });
    Hs('dna', [-0.38, 0.35, 0.05], 'DNA', 'A double helix — two strands joined by pairs of **bases**. Its sequence of bases is the genetic code.', ['B16.1.1']);
    Hs('gene', [-0.22, 0.0, 0.08], 'A gene', 'A **gene** is a length of DNA that codes for a **protein** (the glowing section).', ['B16.1.2']);
    Hs('allele', [-0.24, -0.25, 0.08], 'Alleles', 'An **allele** is an alternative form of a gene — e.g. a gene for pumpkin colour has an orange allele and a green allele.', ['B16.1.3']);
    Hs('chromosome', [0.33, 0.3, 0.1], 'Chromosomes', 'Chromosomes are long, coiled DNA molecules in the **nucleus**. (S) Body cells are **diploid** — chromosomes in **pairs**; humans have 23 pairs.', ['B16.1.1', 'B16.1.6', 'B16.1.7']);
    Hs('xy', [0.3, -0.25, 0.1], 'Sex chromosomes', 'Females are **XX**, males **XY**. A sperm carries X or Y, so the father’s gamete decides the sex — a 50 : 50 chance.', ['B16.1.4']);
    Hs('haploid', [0.5, 0.05, 0.1], 'Haploid gametes (S)', 'Gametes have **one** set of chromosomes (haploid). Fertilisation restores the diploid number.', ['B16.1.5', 'B15.2.3']);
    Hs('mitosis', [0.1, 0.4, 0.1], 'Mitosis (S)', 'Chromosomes are copied exactly, then the copies separate: **two genetically identical** daughter cells with the same chromosome number. Used for **growth, repair, replacement** and asexual reproduction.', ['B16.2.1', 'B16.2.2', 'B16.2.3', 'B16.2.4']);
    Hs('meiosis', [0.48, 0.4, 0.1], 'Meiosis (S)', 'Makes **gametes**: the chromosome number is **halved** and the four daughter cells are **genetically different** — a source of variation.', ['B16.2.5', 'B16.2.6']);
    Hs('asexual', [-0.45, -0.35, 0.05], 'Asexual reproduction', 'One parent, offspring **genetically identical** to it (made by mitosis): strawberry runners, potato tubers, bacteria splitting in two. (S) Fast and needs no partner — but no variation, so one disease or change in conditions can wipe out the whole population.', ['B15.1.1', 'B15.1.2', 'B15.1.3', 'B16.2.2']);
    this.story([
      { title: 'DNA and genes', text: 'Inside the nucleus, DNA carries the code. A **gene** (glowing) codes for one protein.', apply: () => { this.mode = 'dna'; } },
      { title: 'Chromosomes', text: 'DNA is packed into **chromosomes**. Body cells have them in matching pairs (diploid).', apply: () => { this.mode = 'chrom'; } },
      { title: 'Mitosis (S)', text: 'Copy every chromosome, line up, separate: **two identical** cells. Leo’s pumpkin vine grows this way.', apply: () => { this.mode = 'mitosis'; this.t0 = 0; } },
      { title: 'Meiosis (S)', text: 'Two divisions make **four** haploid gametes, each with a different mix of alleles — so offspring vary.', apply: () => { this.mode = 'meiosis'; this.t0 = 0; } },
    ]);
    this.finish({ intro: 'DNA (left), a nucleus with chromosome pairs (right) and the sex chromosomes (bottom).', sub: 'B16.1', questions: [
      { q: 'A **gene** is…', opts: ['a length of DNA that codes for a protein', 'a whole chromosome', 'a type of cell', 'an alternative form of an allele'], e: 'Alleles are alternative forms of a gene.', o: [2, 3] },
      { q: 'A baby’s sex is decided by…', opts: ['whether the sperm carries an X or a Y chromosome', 'the mother’s egg', 'the temperature', 'how many chromosomes the egg has'], e: 'Eggs always carry X.', o: [4] },
      { q: '(S) Mitosis produces…', opts: ['two genetically identical diploid cells', 'four different haploid cells', 'gametes', 'one cell with double the chromosomes'], e: 'Meiosis makes the gametes.', o: [1, 2], sub: 'B16.2' },
    ] });
  }
  animate(dt, t) {
    this.t0 += dt; this.helix.rotation.y += dt * 0.6;
    this.gene.forEach((g) => { g.material.emissiveIntensity = this.mode === 'dna' ? 2 + Math.sin(t * 4) : 1; });
    const div = this.mode === 'mitosis' || this.mode === 'meiosis';
    this.nucleus.visible = !div; this.cells.visible = div;
    if (div) {
      const four = this.mode === 'meiosis', k = Math.min(1, this.t0 * 0.3);
      this.daughters.forEach((c, i) => {
        const show = four || i < 2; c.visible = show; if (!show) return;
        const dx = four ? (i % 2 ? 1 : -1) * 0.12 * k : (i ? 1 : -1) * 0.13 * k, dy = four ? (i < 2 ? 1 : -1) * 0.1 * Math.max(0, k * 2 - 1) : 0;
        c.position.set(dx, dy, 0); const sc = four ? 1 - 0.35 * k : 1 - 0.1 * k; c.scale.setScalar(sc);
        const kk = c.userData.k; if (!kk.children.length) { const n = four ? 3 : 6; for (let j = 0; j < 6; j++) { const m = hmesh(new THREE.CapsuleGeometry(0.008, 0.04, 4, 8), hm(['#f472b6', '#38bdf8', '#a3e635'][j % 3], { glow: 0.4 }), (j % 3 - 1) * 0.03, (Math.floor(j / 3) - 0.5) * 0.05, 0); m.rotation.z = j * 0.7; kk.add(m); m.userData.j = j; } void n; }
        kk.children.forEach((m) => { m.visible = !four || m.userData.j < 3 || (k < 0.5); if (four && m.userData.j < 3) m.material.color.set(['#f472b6', '#38bdf8', '#a3e635'][(m.userData.j + i) % 3]); });
      });
    }
  }
}
