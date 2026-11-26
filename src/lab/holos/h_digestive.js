import * as THREE from 'three';
import { Holo, hm, hmesh, tube } from '../holo.js';

export default class Digestive extends Holo {
  constructor(...a) {
    super(...a);
    this.scenario = 'Festival food means festival tummy-aches. Follow a mouthful of food from the mouth to the anus and see where each enzyme does its job.';
    this.view = { pos: [0, 1.3, 2.4], target: [0, 1.15, 0] };
    this.pos = 0; this.speed = 0;
  }
  build() {
    const s = this.stage(1.2, 1.1);
    s.add(hmesh(new THREE.CapsuleGeometry(0.3, 0.62, 8, 24), hm('#93c5fd', { opacity: 0.08, glow: 0.3, side: THREE.DoubleSide })));
    this.org = {};
    const add = (k, m) => { this.org[k] = m; s.add(m); return m; };
    add('mouth', hmesh(new THREE.TorusGeometry(0.035, 0.012, 10, 24), hm('#f472b6'), 0, 0.56, 0.06)).rotation.x = Math.PI / 2;
    const gut = [[0, 0.55, 0.04], [0, 0.45, 0.02], [0.01, 0.3, 0], [0.03, 0.16, 0], [0.08, 0.12, 0.02], [0.14, 0.05, 0.02], [0.1, -0.02, 0.02], [0.02, -0.02, 0.02], [-0.04, -0.04, 0.03]];
    add('oes', tube(gut.slice(0, 4), 0.014, hm('#fb7185')));
    add('stomach', tube(gut.slice(3, 8), 0.055, hm('#f9a8d4', { glow: 0.2 }), 40));
    add('liver', hmesh(new THREE.SphereGeometry(0.15, 24, 16), hm('#7f1d1d', { glow: 0.12 }), -0.12, 0.1, 0)).scale.set(1.1, 0.5, 0.7);
    add('gall', hmesh(new THREE.SphereGeometry(0.025, 14, 10), hm('#4d7c0f'), -0.06, 0.04, 0.09));
    const pan = add('pancreas', hmesh(new THREE.CapsuleGeometry(0.018, 0.14, 6, 12), hm('#fcd34d'), 0.05, -0.07, -0.05)); pan.rotation.z = Math.PI / 2.4;
    const si = []; for (let i = 0; i < 14; i++) { const row = Math.floor(i / 3.5); si.push([(i % 2 ? 0.12 : -0.12) * (row % 2 ? -1 : 1), -0.1 - i * 0.015, 0.04 + Math.sin(i) * 0.03]); }
    this.siPath = [[-0.04, -0.04, 0.03], ...si];
    add('small', tube(this.siPath, 0.022, hm('#fdba74', { glow: 0.15 }), 120));
    this.liPath = [[-0.12, -0.3, 0.0], [-0.21, -0.3, 0], [-0.21, -0.05, 0], [0.21, -0.05, -0.01], [0.21, -0.32, 0], [0.08, -0.4, 0], [0, -0.44, 0]];
    add('large', tube(this.liPath, 0.035, hm('#d6a76c', { glow: 0.12 }), 80));
    add('anus', hmesh(new THREE.TorusGeometry(0.018, 0.006, 8, 18), hm('#f472b6'), 0, -0.48, 0)).rotation.x = Math.PI / 2;
    // the whole route for the food bolus
    this.route = new THREE.CatmullRomCurve3([...gut, ...this.siPath.slice(1), [-0.12, -0.3, 0.0], ...this.liPath.slice(1), [0, -0.48, 0]].map((p) => new THREE.Vector3(...p)));
    this.bolus = hmesh(new THREE.SphereGeometry(0.02, 14, 10), hm('#a3e635', { glow: 0.6 })); s.add(this.bolus);
    const H = (id, pos, title, text, ids) => this.hotspot({ id, pos, title, text, ids });
    H('mouth', [0, 0.6, 0.08], 'Mouth & teeth', '**Ingestion** and **physical digestion**: teeth break food into smaller pieces, increasing the surface area for enzymes. Saliva contains **amylase** (starch → maltose).', ['B7.2.1', 'B7.2.2', 'B7.3.1', 'B7.3.2']);
    H('oes', [0.04, 0.35, 0.03], 'Oesophagus', 'A muscular tube: waves of muscle contraction (peristalsis) push food to the stomach.', ['B7.2.1']);
    H('stomach', [0.16, 0.08, 0.06], 'Stomach', 'Churns food (physical digestion). Gastric juice contains **protease** and **hydrochloric acid**, which kills microbes and gives the acid pH that stomach protease needs.', ['B7.2.1', 'B7.3.6', 'B7.3.7']);
    H('liver', [-0.2, 0.15, 0.08], 'Liver', 'Makes **bile**. (S) Bile is alkaline: it neutralises acid from the stomach and **emulsifies fats** into droplets — a bigger surface area for lipase. Also where absorbed food is **assimilated**.', ['B7.2.1', 'B7.3.8', 'B7.3.9']);
    H('gall', [-0.06, 0.04, 0.12], 'Gall bladder', 'Stores bile and releases it into the duodenum.', ['B7.2.1']);
    H('pancreas', [0.1, -0.08, -0.02], 'Pancreas', 'Secretes pancreatic juice into the duodenum: **amylase**, **protease** and **lipase** (fats → fatty acids + glycerol).', ['B7.2.1', 'B7.3.5', 'B7.3.6']);
    H('small', [0.14, -0.2, 0.08], 'Small intestine', 'Duodenum then ileum. Digestion finishes; small soluble molecules are **absorbed** through millions of **villi** into the blood.', ['B7.2.1', 'B7.2.2', 'B7.3.3', 'B7.3.4']);
    H('large', [-0.24, -0.15, 0.04], 'Large intestine (colon)', 'Absorbs **water** from the undigested food, forming faeces.', ['B7.2.1', 'B7.2.2']);
    H('anus', [0, -0.5, 0.04], 'Rectum & anus', 'Faeces are stored in the rectum and leave through the anus — **egestion**.', ['B7.2.1', 'B7.2.2']);
    const show = (keys, from, to) => { for (const [k, m] of Object.entries(this.org)) { m.material.emissiveIntensity = keys.includes(k) ? 3 : 0.6; } this.goTo = [from, to]; };
    this.story([
      { title: 'Ingestion', text: 'Food enters the **mouth**. Teeth chew it — physical digestion — and salivary **amylase** starts breaking starch into maltose.', apply: () => show(['mouth'], 0, 0.04) },
      { title: 'Down to the stomach', text: 'The bolus is squeezed down the oesophagus. In the **stomach**, protease starts digesting protein in **acidic** conditions.', apply: () => show(['oes', 'stomach'], 0.04, 0.2) },
      { title: 'Duodenum', text: 'Bile from the liver/gall bladder and enzymes from the **pancreas** pour in. Bile neutralises the acid and emulsifies fats.', apply: () => show(['liver', 'gall', 'pancreas'], 0.2, 0.26) },
      { title: 'Absorption in the ileum', text: 'Large insoluble molecules are now small soluble ones (glucose, amino acids, fatty acids and glycerol) — **absorbed** through the villi into the blood.', apply: () => show(['small'], 0.26, 0.7) },
      { title: 'Water and egestion', text: 'The **large intestine** absorbs water. What is left is **egested** through the anus.', apply: () => show(['large', 'anus'], 0.7, 1) },
    ]);
    this.finish({
      intro: 'Click the glowing dots, or step through the journey of one mouthful.',
      sub: 'B7.3',
      questions: [
        { q: 'Where does the chemical digestion of **protein** begin?', opts: ['Stomach', 'Mouth', 'Large intestine', 'Oesophagus'], e: 'Stomach protease works best in acid.', o: [6] },
        { q: '(S) Bile helps digestion by…', opts: ['emulsifying fats into small droplets and neutralising stomach acid', 'digesting protein', 'absorbing water', 'killing all bacteria'], e: 'Bile is not an enzyme — it increases the surface area for lipase.', o: [8, 9] },
        { q: 'Most digested food is **absorbed** in the…', opts: ['small intestine', 'stomach', 'large intestine', 'oesophagus'], e: 'Villi give a huge surface area.', o: [4], sub: 'B7.3' },
      ],
    });
    this.goTo = [0, 0];
  }
  animate(dt, t) {
    const [a, b] = this.goTo || [0, 0];
    this.pos += ((b - this.pos) * dt) * 0.8; if (this.pos < a) this.pos = a;
    this.bolus.position.copy(this.route.getPointAt(Math.min(1, Math.max(0, this.pos))));
    if (this.org.stomach) this.org.stomach.scale.setScalar(1 + Math.sin(t * 3) * 0.02);
  }
}
