import * as THREE from 'three';
import { Experiment } from '../experiment.js';
import { mesh, mat, M } from '../apparatus.js';
import { h, clear, TAU } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const GENO = { OO: ['O', 'O'], Oo: ['O', 'o'], oo: ['o', 'o'] };
const pheno = (g) => (g.includes('O') ? 'orange' : 'white');
const norm = (a, b) => (a === 'O' ? a + b : b + a);

export default class Genetics extends Experiment {
  constructor(...a) {
    super(...a);
    this.scenario = 'Ravi crossed two orange pumpkins and a quarter of the seeds grew white pumpkins! Predict and test crosses — then watch natural selection in action.';
    this.tabLabels = [['cross', '🎃 Crosses'], ['selection', '🦋 Selection']];
    this.tabObjectives = { cross: ['B16.1', 'B16.3', 'B17.1', 'B15.2'], selection: ['B17.2', 'B17.1', 'B14.1'] };
    this.tabViews = { cross: { pos: [0, 1.6, 1.25], target: [0, 1.0, 0] }, selection: { pos: [0, 1.45, 1.1], target: [0, 1.15, 0] } };
    this.view = this.tabViews.cross;
  }

  // ======================================================== crosses
  tab_cross() {
    const Y = this.Y;
    this.p1 = 'Oo'; this.p2 = 'Oo'; this.done = new Set(); this.big = false;
    const field = mesh(new THREE.BoxGeometry(0.7, 0.02, 0.36), mat('#5b4128', 0, 0.95)); this.lab.add(field, 0, Y, 0.02);
    this.patch = new THREE.Group(); this.lab.add(this.patch, 0, Y + 0.02, 0.02);
    this.parents = [-0.42, 0.42].map((x, i) => { const g = new THREE.Group(); this.lab.add(g, x, Y, -0.1); g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.04, 16), M.dark, 0, 0.02, 0)); const p = mesh(new THREE.SphereGeometry(0.045, 18, 12), mat('#f97316', 0, 0.6), 0, 0.075, 0); p.scale.y = 0.75; g.add(p); g.userData.p = p; g.userData.lbl = this.lab.label(g, '', { y: 0.16 }); return g; });
    const ui = this.ui;
    this.st = ui.steps(['Cross **OO × oo** (pure-breeding parents)', 'Cross two heterozygotes **Oo × Oo**', 'Do a test cross **Oo × oo**', 'Grow **100** offspring from one cross and compare with your prediction', 'Weigh pumpkins: compare **continuous** and **discontinuous** variation', 'Answer the analysis questions']);
    const sec = ui.section('Parents (O = orange, dominant · o = white, recessive)');
    ui.seg({ label: 'Parent 1 genotype', options: [['OO', 'OO'], ['Oo', 'Oo'], ['oo', 'oo']], value: this.p1, parent: sec, onChange: (v) => { this.p1 = v; this.render(); } });
    ui.seg({ label: 'Parent 2 genotype', options: [['OO', 'OO'], ['Oo', 'Oo'], ['oo', 'oo']], value: this.p2, parent: sec, onChange: (v) => { this.p2 = v; this.render(); } });
    this.punnett = h('div', { style: { margin: '8px 0' } }); sec.append(this.punnett);
    ui.buttons([{ label: '🌱 Grow 20 seeds', kind: 'primary', onClick: () => this.grow(20) }, { label: '🌱 Grow 100', onClick: () => this.grow(100) }, { label: '⚖ Weigh 60 pumpkins', onClick: () => this.weigh() }], sec);
    this.ro = ui.readouts([{ id: 'pred', label: 'Predicted' }, { id: 'obs', label: 'Observed' }], sec);
    this.tbl = ui.table(['Cross', 'Predicted orange : white', 'Observed', 'n'], ui.section('Results'));
    this.hist = ui.graph({ x: { label: 'Pumpkin mass / kg', min: 0, max: 14 }, y: { label: 'Number of pumpkins', min: 0, max: 16 }, series: [{ name: 'mass (continuous)', color: '#fb923c', line: true, points: true }] });
    ui.notes();
    ui.questions([
      { q: 'Oo × Oo gives which ratio of orange : white offspring?', opts: ['3 : 1', '1 : 1', '1 : 2 : 1', 'All orange'], e: 'OO, Oo, Oo are orange; oo is white.', o: [11, 12], sub: 'B16.3' },
      { q: 'What genotype must a **white** pumpkin have?', opts: ['oo (homozygous recessive)', 'Oo (heterozygous)', 'OO (homozygous dominant)', 'It could be any'], e: 'The recessive phenotype only shows with no dominant allele.', o: [4, 9], sub: 'B16.3' },
      { q: 'Two orange parents produced a white offspring. The parents must both be…', opts: ['heterozygous (Oo)', 'homozygous dominant (OO)', 'homozygous recessive (oo)', 'one OO and one oo'], e: 'Each parent must have passed on a recessive allele.', o: [6, 10], sub: 'B16.3' },
      { q: 'Pumpkin **mass** shows a range with no clear groups. This is…', opts: ['continuous variation', 'discontinuous variation', 'a mutation', 'selective breeding'], e: 'Skin colour (orange or white) is discontinuous; mass is continuous.', o: [2, 3], sub: 'B17.1' },
      { q: 'A human baby’s sex is decided by…', opts: ['whether the sperm carries an X or a Y chromosome', 'the mother’s diet', 'the egg, which carries a Y', 'the number of genes'], e: 'Eggs always carry X; sperm carry X or Y — a 1 : 1 chance.', o: [4], sub: 'B16.1' },
    ], { sub: 'B16.3', onDone: () => { this.st.done(5); this.checkCross(); } });
    this.render();
  }
  gametes(g) { return GENO[g]; }
  render() {
    const a = this.gametes(this.p1), b = this.gametes(this.p2);
    clear(this.punnett);
    const cell = (txt, head, col) => h('div', { style: { padding: '8px', textAlign: 'center', borderRadius: '8px', fontFamily: 'var(--mono)', fontWeight: 700, background: head ? 'rgba(255,255,255,.06)' : col === 'orange' ? 'rgba(249,115,22,.25)' : 'rgba(248,250,252,.18)', border: '1px solid var(--line)' } }, txt);
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', maxWidth: '230px' } });
    grid.append(cell('♀ \\ ♂', true), cell(b[0], true), cell(b[1], true));
    for (const x of a) { grid.append(cell(x, true)); for (const y of b) { const g = norm(x, y); grid.append(cell(g, false, pheno(g))); } }
    const kids = a.flatMap((x) => b.map((y) => norm(x, y)));
    const o = kids.filter((g) => pheno(g) === 'orange').length;
    this.pred = o / 4;
    this.punnett.append(h('div', { class: 'faint', style: { fontSize: '.82em', marginBottom: '6px' } }, 'Punnett square (gametes on the edges):'), grid);
    this.ro.set('pred', `${o} : ${4 - o} (${Math.round((o / 4) * 100)}% orange)`);
    this.parents.forEach((g, i) => { const gt = i ? this.p2 : this.p1; g.userData.p.material.color.set(pheno(gt) === 'orange' ? '#f97316' : '#f8fafc'); g.userData.lbl.userData.set(`Parent ${i + 1}: ${gt}`); });
  }
  grow(n) {
    while (this.patch.children.length) this.patch.remove(this.patch.children[0]);
    const a = this.gametes(this.p1), b = this.gametes(this.p2);
    let orange = 0;
    const geo = new THREE.SphereGeometry(0.014, 10, 8);
    const om = mat('#f97316', 0, 0.6), wm = mat('#f8fafc', 0, 0.6);
    const cols = n > 20 ? 20 : 10;
    for (let i = 0; i < n; i++) {
      const g = norm(a[Math.random() < 0.5 ? 0 : 1], b[Math.random() < 0.5 ? 0 : 1]);
      const ph = pheno(g); if (ph === 'orange') orange++;
      const m = new THREE.Mesh(geo, ph === 'orange' ? om : wm); m.scale.set(1, 0.7, 1);
      m.position.set(-0.3 + (i % cols) * (0.6 / (cols - 1)), 0.012, -0.14 + Math.floor(i / cols) * (n > 20 ? 0.06 : 0.12) + 0.04);
      m.castShadow = true; this.patch.add(m);
    }
    audio.discover();
    const cross = `${this.p1} × ${this.p2}`;
    this.ro.set('obs', `${orange} : ${n - orange} (${Math.round((orange / n) * 100)}%)`);
    this.tbl.add([cross, `${Math.round(this.pred * 4)} : ${4 - Math.round(this.pred * 4)}`, `${orange} : ${n - orange}`, n]);
    const key = [this.p1, this.p2].sort().join('x');
    if (key === 'OOxoo') this.st.done(0);
    if (key === 'OoxOo') this.st.done(1);
    if (key === 'Ooxoo') this.st.done(2);
    if (n >= 100) { this.st.done(3); this.ui.note(`With 100 offspring the observed ratio (${orange} : ${n - orange}) is close to the prediction — chance evens out in large samples.`, 'gold'); }
    else this.ui.note(`${cross}: ${orange} orange, ${n - orange} white. Small samples vary by chance.`);
    this.checkCross();
  }
  weigh() {
    const bins = new Array(14).fill(0);
    for (let i = 0; i < 60; i++) { let s = 0; for (let k = 0; k < 6; k++) s += Math.random(); const m = 7 + (s - 3) * 2.6; bins[Math.max(0, Math.min(13, Math.floor(m)))]++; }
    this.hist.set(0, bins.map((c, i) => [i + 0.5, c]));
    this.ui.note('Masses form a smooth bell-shaped spread (continuous); skin colour has just two groups (discontinuous).', 'gold');
    this.st.done(4); this.checkCross();
  }
  checkCross() { if ([0, 1, 2, 3, 4, 5].every((i) => this.st.isDone(i))) this.lab.goal('cross'); }

  // ======================================================== selection
  tab_selection() {
    const Y = this.Y;
    this.mode = 'moths'; this.sooty = true; this.gen = 0; this.antibiotic = true;
    this.runs = { sooty: 0, clean: 0, bac: 0 };
    this.trunk = mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.55, 20), mat('#3f3f46', 0, 0.95)); this.lab.add(this.trunk, -0.1, Y, -0.02); this.trunk.position.y = Y + 0.275;
    this.lab.label(this.trunk, 'Birch trunk', { y: 0.32 });
    this.dish = new THREE.Group(); this.lab.add(this.dish, 0.22, Y, 0.05);
    this.dish.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.012, 32), new THREE.MeshPhysicalMaterial({ color: '#fef9c3', transparent: true, opacity: 0.85 }), 0, 0.006, 0));
    this.lab.label(this.dish, 'Bacteria on agar', { y: 0.06 });
    this.moths = []; this.colonies = [];
    for (let i = 0; i < 40; i++) this.moths.push({ dark: Math.random() < 0.1 });
    for (let i = 0; i < 60; i++) this.colonies.push({ res: Math.random() < 0.03 });
    this.mothGroup = new THREE.Group(); this.trunk.add(this.mothGroup);
    this.colGroup = new THREE.Group(); this.dish.add(this.colGroup);
    const ui = this.ui;
    this.st = ui.steps(['Run **5+ generations** of moths on **sooty** bark', 'Run **5+ generations** on **clean** bark', 'Treat bacteria with an **antibiotic** for 5+ generations', 'Answer the analysis questions']);
    const sec = ui.section('Environment');
    ui.seg({ label: 'Bark', options: [['sooty', 'Sooty (polluted)'], ['clean', 'Clean birch']], value: 'sooty', parent: sec, onChange: (v) => { this.sooty = v === 'sooty'; this.gen = 0; this.moths = this.moths.map(() => ({ dark: Math.random() < 0.1 })); this.mGraph.clear(); this.drawMoths(); } });
    ui.buttons([{ label: '🐦 Next moth generation', kind: 'primary', onClick: () => this.mothGen() }, { label: '⏩ 5 generations', onClick: () => { for (let i = 0; i < 5; i++) this.mothGen(); } }], sec);
    this.mGraph = ui.graph({ x: { label: 'Generation', min: 0, max: 12 }, y: { label: '% dark moths', min: 0, max: 100 }, series: [{ name: 'dark moths', color: '#a78bfa', line: true, points: true }], auto: true }, sec);
    const bsec = ui.section('Bacteria and antibiotics');
    ui.seg({ label: 'Antibiotic', options: [[1, 'Applied'], [0, 'None']], value: 1, parent: bsec, onChange: (v) => { this.antibiotic = !!+v; } });
    ui.buttons([{ label: '💊 Next bacterial generation', kind: 'primary', onClick: () => this.bacGen() }], bsec);
    this.bGraph = ui.graph({ x: { label: 'Generation', min: 0, max: 12 }, y: { label: '% resistant bacteria', min: 0, max: 100 }, series: [{ name: 'resistant', color: '#f87171', line: true, points: true }], auto: true }, bsec);
    ui.notes();
    ui.questions([
      { q: 'Why did dark moths become more common on sooty bark?', opts: ['They were better camouflaged, so more survived and reproduced, passing on their alleles', 'The soot dyed them dark', 'Moths chose to become darker', 'Birds prefer pale moths’ taste'], e: 'Natural selection acts on existing variation.', o: [1], sub: 'B17.2' },
      { q: 'Where did the first resistant bacterium come from?', opts: ['A random mutation in its DNA', 'The antibiotic created it', 'It learned to resist', 'It came from a virus'], e: 'Mutations create new alleles; antibiotics then select the resistant ones.', o: [4, 5], sub: 'B17.1' },
      { q: 'Why does overusing antibiotics make them less effective?', opts: ['Each use kills the non-resistant bacteria, leaving resistant ones to multiply', 'Bacteria become immune like people', 'Antibiotics get weaker in the body', 'It makes viruses resistant'], e: 'Use antibiotics only when essential — e.g. to limit MRSA.', o: [4], sub: 'B17.2' },
    ], { sub: 'B17.2', onDone: () => { this.st.done(3); this.checkSel(); } });
    this.drawMoths(); this.drawColonies();
  }
  drawMoths() {
    while (this.mothGroup.children.length) this.mothGroup.remove(this.mothGroup.children[0]);
    this.trunk.material.color.set(this.sooty ? '#3f3f46' : '#e7e5e4');
    const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.014, 0.006, 0, -0.012, -0.008, 0, 0, 0, 0, 0.014, 0.006, 0, 0.012, -0.008, 0], 3)); geo.computeVertexNormals();
    const dm = new THREE.MeshStandardMaterial({ color: '#27272a', side: THREE.DoubleSide }), pm = new THREE.MeshStandardMaterial({ color: '#f5f5f4', side: THREE.DoubleSide });
    this.moths.forEach((m, i) => { const a = (i / this.moths.length) * TAU * 3.1, y = -0.24 + ((i * 37) % 48) / 100; const mm = new THREE.Mesh(geo, m.dark ? dm : pm); mm.position.set(Math.sin(a) * 0.104, y, Math.cos(a) * 0.104); mm.lookAt(Math.sin(a) * 0.5, y, Math.cos(a) * 0.5); this.mothGroup.add(mm); });
  }
  mothGen() {
    const survivors = this.moths.filter((m) => Math.random() > ((m.dark === this.sooty) ? 0.12 : 0.55));
    const pool = survivors.length ? survivors : this.moths;
    this.moths = Array.from({ length: 40 }, () => { const p = pool[Math.floor(Math.random() * pool.length)]; return { dark: Math.random() < 0.02 ? !p.dark : p.dark }; });
    this.gen++;
    const pct = (this.moths.filter((m) => m.dark).length / 40) * 100;
    this.mGraph.add(0, this.gen, pct);
    this.drawMoths(); audio.blip();
    if (this.gen >= 5) { if (this.sooty) this.st.done(0); else this.st.done(1); }
    if (this.gen === 5) this.ui.note(this.sooty ? `After 5 generations on sooty bark, **${pct.toFixed(0)}%** of moths are dark.` : `On clean bark the pale form wins: only **${pct.toFixed(0)}%** dark.`, 'gold');
    this.checkSel();
  }
  drawColonies() {
    while (this.colGroup.children.length) this.colGroup.remove(this.colGroup.children[0]);
    const g = new THREE.CylinderGeometry(0.006, 0.006, 0.004, 10);
    const rm = mat('#ef4444', 0, 0.5), nm = mat('#e5e7eb', 0, 0.6);
    this.colonies.forEach((c, i) => { const a = i * 2.4, r = 0.012 + Math.sqrt(i / this.colonies.length) * 0.09; const m = new THREE.Mesh(g, c.res ? rm : nm); m.position.set(Math.cos(a) * r, 0.014, Math.sin(a) * r); this.colGroup.add(m); });
  }
  bacGen() {
    const surv = this.colonies.filter((c) => !this.antibiotic || c.res || Math.random() < 0.05);
    const pool = surv.length ? surv : [{ res: true }];
    this.colonies = Array.from({ length: 60 }, () => { const p = pool[Math.floor(Math.random() * pool.length)]; return { res: p.res || Math.random() < 0.01 }; });
    this.runs.bac++;
    const pct = (this.colonies.filter((c) => c.res).length / 60) * 100;
    this.bGraph.add(0, this.runs.bac, pct); this.drawColonies(); audio.blip();
    if (this.runs.bac >= 5 && this.antibiotic) { this.st.done(2); if (this.runs.bac === 5) this.ui.note(`With the antibiotic, resistant bacteria rose to **${pct.toFixed(0)}%** — natural selection in a few days.`, 'gold'); }
    this.checkSel();
  }
  checkSel() { if ([0, 1, 2, 3].every((i) => this.st.isDone(i))) this.lab.goal('selection'); }
}
