import { BIO } from './curriculum_bio.js';
import { CHEM } from './curriculum_chem.js';
import { PHYS } from './curriculum_phys.js';

export const SYLLABUS = {
  name: 'Cambridge IGCSE Co-ordinated Sciences (Double Award) 0654',
  years: '2025–2027',
  note: 'Learning objectives are paraphrased from the published subject content. Core objectives are required for all learners; Supplement (S) objectives form the Extended tier. CATALYST is an independent study game, not affiliated with or endorsed by Cambridge International.',
};

export const SUBJECTS = {
  B: { id: 'B', name: 'Biology', color: '#34d399', glow: '#6ff7c4', icon: '🧬' },
  C: { id: 'C', name: 'Chemistry', color: '#fbbf24', glow: '#ffd979', icon: '⚗️' },
  P: { id: 'P', name: 'Physics', color: '#60a5fa', glow: '#9cc8ff', icon: '⚛️' },
};

export const TOPIC_NAMES = {
  B1: 'Characteristics of living organisms', B2: 'Cells', B3: 'Movement into and out of cells', B4: 'Biological molecules',
  B5: 'Enzymes', B6: 'Plant nutrition', B7: 'Human nutrition', B8: 'Transport in plants', B9: 'Transport in animals',
  B10: 'Diseases and immunity', B11: 'Gas exchange in humans', B12: 'Respiration', B13: 'Coordination and response',
  B14: 'Drugs', B15: 'Reproduction', B16: 'Inheritance', B17: 'Variation and selection', B18: 'Organisms and their environment',
  B19: 'Human influences on ecosystems',
  C1: 'States of matter', C2: 'Atoms, elements and compounds', C3: 'Stoichiometry', C4: 'Electrochemistry',
  C5: 'Chemical energetics', C6: 'Chemical reactions', C7: 'Acids, bases and salts', C8: 'The Periodic Table', C9: 'Metals',
  C10: 'Chemistry of the environment', C11: 'Organic chemistry', C12: 'Experimental techniques and chemical analysis',
  P1: 'Motion, forces and energy', P2: 'Thermal physics', P3: 'Waves', P4: 'Electricity and magnetism', P5: 'Nuclear physics', P6: 'Space physics',
};

export const SECTION_NAMES = {
  'P1.5': 'Forces', 'P1.6': 'Energy, work and power', 'P2.1': 'Kinetic particle model of matter', 'P2.2': 'Thermal properties and temperature',
  'P2.3': 'Transfer of thermal energy', 'P3.2': 'Light', 'P4.2': 'Electrical quantities', 'P4.3': 'Electrical circuits',
  'P4.5': 'Electromagnetic effects', 'P5.2': 'Radioactivity', 'P6.2': 'Stars and the Universe',
};

/** Sub-topics ("lessons"): { id, subject, topic, section, title, summary, life, objectives[] } */
export const SUBTOPICS = [];
/** Objectives: { id, sub, n, tier: 'C'|'S', text } */
export const OBJECTIVES = [];
export const SUB = {};
export const OBJ = {};

for (const raw of [...BIO, ...CHEM, ...PHYS]) {
  const [id, title, summary, life, objs] = raw;
  const subject = id[0];
  const topic = id.split('.')[0];
  const parts = id.split('.');
  const section = parts.length >= 3 ? parts.slice(0, 2).join('.') : null;
  const st = { id, subject, topic, section, title, summary, life, objectives: [] };
  for (const line of objs) {
    const m = line.match(/^(\d+)(S?)\s+(.*)$/);
    if (!m) { console.warn('Bad objective line', id, line); continue; }
    const o = { id: `${id}.${m[1]}`, sub: id, n: +m[1], tier: m[2] ? 'S' : 'C', text: m[3] };
    st.objectives.push(o); OBJECTIVES.push(o); OBJ[o.id] = o;
  }
  SUBTOPICS.push(st); SUB[id] = st;
}

export const TOPICS = [];
for (const st of SUBTOPICS) {
  let t = TOPICS.find((x) => x.id === st.topic);
  if (!t) { t = { id: st.topic, subject: st.subject, title: TOPIC_NAMES[st.topic] || st.topic, subs: [] }; TOPICS.push(t); }
  t.subs.push(st);
}

/** Expand a list of ids (sub-topics, topics or objectives) into objective ids, optionally filtered by tier. */
export function expandIds(ids, tier = 'extended') {
  const out = new Set();
  for (const id of ids || []) {
    if (OBJ[id]) { out.add(id); continue; }
    if (SUB[id]) { for (const o of SUB[id].objectives) if (tier === 'extended' || o.tier === 'C') out.add(o.id); continue; }
    const t = TOPICS.find((x) => x.id === id);
    if (t) { for (const s of t.subs) for (const o of s.objectives) if (tier === 'extended' || o.tier === 'C') out.add(o.id); continue; }
    // section like P1.5
    for (const s of SUBTOPICS) if (s.section === id) for (const o of s.objectives) if (tier === 'extended' || o.tier === 'C') out.add(o.id);
  }
  return [...out];
}

/** Map an id (objective or sub-topic) to its sub-topic id. */
export function subOf(id) { if (SUB[id]) return id; if (OBJ[id]) return OBJ[id].sub; return null; }
export function subjectOf(id) { return id ? id[0] : null; }
export function labelOf(id) {
  if (SUB[id]) return `${id} ${SUB[id].title}`;
  if (OBJ[id]) return `${id} ${OBJ[id].text}`;
  const t = TOPICS.find((x) => x.id === id); if (t) return `${id} ${t.title}`;
  return id;
}
export const COUNTS = {
  total: OBJECTIVES.length,
  core: OBJECTIVES.filter((o) => o.tier === 'C').length,
  supplement: OBJECTIVES.filter((o) => o.tier === 'S').length,
  subtopics: SUBTOPICS.length,
};
