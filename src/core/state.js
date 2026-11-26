import { store } from './util.js';
import { bus } from './events.js';
import { expandIds, OBJ, SUB, SUBTOPICS, OBJECTIVES } from '../data/curriculum.js';
import { LINKS } from '../data/links.js';

const KEY = 'catalyst.save.v1';
const DEFAULT = () => ({
  v: 1, name: '', created: Date.now(), playTime: 0,
  xp: 0, level: 1,
  mastery: {}, // objectiveId -> 0..3 (1 discovered, 2 practised, 3 mastered)
  quests: {}, // questId -> { status: 'active'|'done', step: n }
  tracked: null,
  scanned: {}, exps: {}, holos: {}, links: {}, visited: {}, flags: {}, achievements: {},
  stats: { answered: 0, correct: 0, streak: 0, best: 0, experiments: 0, scans: 0, chains: 0 },
  pos: null, time: 0.32,
  settings: { tier: 'extended', quality: 'high', music: 0.45, sfx: 0.7, teacher: false, cycle: true, textScale: 1, hints: true },
});

export const state = DEFAULT();
export const hasSave = () => !!store.get(KEY);
export function load() {
  const s = store.get(KEY);
  if (!s || s.v !== 1) return false;
  const d = DEFAULT();
  Object.assign(state, d, s, { settings: { ...d.settings, ...(s.settings || {}) }, stats: { ...d.stats, ...(s.stats || {}) } });
  return true;
}
export function save() { store.set(KEY, state); }
export function newGame(name, tier) {
  const settings = { ...state.settings, tier };
  Object.assign(state, DEFAULT());
  state.settings = settings; state.name = name || 'Scientist';
  save();
}

// ---------------- levels ----------------
export const xpToNext = (l) => 100 + 75 * (l - 1);
export function rankOf(l) {
  return l >= 15 ? 'Island Laureate' : l >= 12 ? 'Senior Scientist' : l >= 9 ? 'Research Fellow' : l >= 6 ? 'Field Scientist' : l >= 3 ? 'Junior Investigator' : 'Lab Apprentice';
}
export function levelProgress() {
  let xp = state.xp, l = 1;
  while (xp >= xpToNext(l)) { xp -= xpToNext(l); l++; }
  return { level: l, into: xp, need: xpToNext(l) };
}
export function addXP(n, reason) {
  if (!n) return;
  const before = levelProgress().level;
  state.xp += Math.round(n);
  const after = levelProgress().level;
  state.level = after;
  bus.emit('xp', n, reason);
  if (after > before) bus.emit('levelup', after);
  save();
}

// ---------------- mastery ----------------
export const tierOK = (objId) => state.settings.tier === 'extended' || OBJ[objId]?.tier === 'C';
export function raise(ids, level, source) {
  const objIds = expandIds(ids, 'extended');
  const changed = [];
  for (const id of objIds) {
    const cur = state.mastery[id] || 0;
    if (level > cur) { state.mastery[id] = level; changed.push(id); }
  }
  if (changed.length) {
    bus.emit('mastery', changed, level, source);
    checkLinks(source);
    save();
  }
  return changed;
}
export const objLevel = (id) => state.mastery[id] || 0;
export function subStats(subId) {
  const st = SUB[subId];
  const objs = st.objectives.filter((o) => tierOK(o.id));
  let sum = 0, seen = 0;
  for (const o of objs) { const m = state.mastery[o.id] || 0; sum += m; if (m) seen++; }
  return { frac: objs.length ? sum / (objs.length * 3) : 0, seen, total: objs.length, any: seen > 0, max: Math.max(0, ...objs.map((o) => state.mastery[o.id] || 0)) };
}
export const subMastery = (subId) => subStats(subId).frac;
export function coverage(subject) {
  const objs = OBJECTIVES.filter((o) => (!subject || o.sub[0] === subject) && tierOK(o.id));
  const c = { total: objs.length, seen: 0, practised: 0, mastered: 0 };
  for (const o of objs) { const m = state.mastery[o.id] || 0; if (m >= 1) c.seen++; if (m >= 2) c.practised++; if (m >= 3) c.mastered++; }
  return c;
}

// ---------------- concept links ----------------
/** 0 hidden, 1 visible (both ends discovered), 2 sparked (both ends practised or solved in a chain). */
export function linkState(link) {
  if (state.links[link.id]) return 2;
  const a = subStats(link.a), b = subStats(link.b);
  if (a.max >= 2 && b.max >= 2) return 2;
  if (a.any && b.any) return 1;
  return 0;
}
export function checkLinks(source) {
  const fresh = [];
  for (const l of LINKS) {
    if (state.links[l.id]) continue;
    const a = subStats(l.a), b = subStats(l.b);
    if (a.max >= 2 && b.max >= 2) { state.links[l.id] = Date.now(); fresh.push(l); }
  }
  if (fresh.length) {
    bus.emit('links', fresh, source);
    addXP(15 * fresh.length, 'connections');
  }
}
export function sparkLink(id) {
  const l = LINKS.find((x) => x.id === id);
  if (!l || state.links[id]) return;
  state.links[id] = Date.now();
  raise([l.a, l.b], 1, 'link');
  bus.emit('links', [l], 'chain');
  addXP(15, 'connections');
}
export const sparkedCount = () => Object.keys(state.links).length;

// ---------------- achievements ----------------
export const ACHIEVEMENTS = [
  { id: 'first_scan', icon: '🔍', name: 'Curious Mind', desc: 'Scan your first point of interest.' },
  { id: 'scans25', icon: '🛰️', name: 'Field Surveyor', desc: 'Scan 25 points of interest.' },
  { id: 'first_exp', icon: '🧪', name: 'Hands-On', desc: 'Complete your first virtual experiment.' },
  { id: 'exp10', icon: '⚗️', name: 'Lab Regular', desc: 'Complete 10 experiments.' },
  { id: 'exp25', icon: '🥼', name: 'Master of the Bench', desc: 'Complete 25 experiments.' },
  { id: 'q1', icon: '🤝', name: 'Helping Hand', desc: 'Complete your first quest.' },
  { id: 'q10', icon: '🏅', name: 'Problem Solver', desc: 'Complete 10 quests.' },
  { id: 'q25', icon: '🏆', name: 'Island Hero', desc: 'Complete 25 quests.' },
  { id: 'links10', icon: '✨', name: 'Connector', desc: 'Spark 10 cross-concept connections.' },
  { id: 'links40', icon: '🌌', name: 'Polymath', desc: 'Spark 40 connections.' },
  { id: 'streak5', icon: '🔥', name: 'On a Roll', desc: 'Answer 5 questions correctly in a row.' },
  { id: 'streak15', icon: '⚡', name: 'Unstoppable', desc: 'Answer 15 questions correctly in a row.' },
  { id: 'explorer', icon: '🧭', name: 'Explorer', desc: 'Visit every district of Brightwater.' },
  { id: 'bio50', icon: '🧬', name: 'Life Scientist', desc: 'Reach 50% Biology mastery.' },
  { id: 'chem50', icon: '⚗️', name: 'Alchemist', desc: 'Reach 50% Chemistry mastery.' },
  { id: 'phys50', icon: '⚛️', name: 'Natural Philosopher', desc: 'Reach 50% Physics mastery.' },
  { id: 'stargazer', icon: '🔭', name: 'Stargazer', desc: 'Open the Constellation of Knowledge at night.' },
  { id: 'festival', icon: '🎆', name: 'Festival of Light', desc: 'Relight the Lumen Beacon.' },
];
export function grant(id) {
  if (state.achievements[id]) return;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return;
  state.achievements[id] = Date.now();
  bus.emit('achievement', a);
  addXP(40, 'achievement');
}
export function checkAchievements() {
  const s = state.stats;
  const qDone = Object.values(state.quests).filter((q) => q.status === 'done').length;
  const expDone = Object.values(state.exps).filter((e) => e.done).length;
  if (s.scans >= 1) grant('first_scan');
  if (s.scans >= 25) grant('scans25');
  if (expDone >= 1) grant('first_exp');
  if (expDone >= 10) grant('exp10');
  if (expDone >= 25) grant('exp25');
  if (qDone >= 1) grant('q1');
  if (qDone >= 10) grant('q10');
  if (qDone >= 25) grant('q25');
  if (sparkedCount() >= 10) grant('links10');
  if (sparkedCount() >= 40) grant('links40');
  if (s.best >= 5) grant('streak5');
  if (s.best >= 15) grant('streak15');
  if (Object.keys(state.visited).length >= 9) grant('explorer');
  for (const [k, id] of [['B', 'bio50'], ['C', 'chem50'], ['P', 'phys50']]) {
    const c = coverage(k);
    const frac = c.total ? (c.seen + c.practised + c.mastered) / (3 * c.total) : 0;
    if (frac >= 0.5) grant(id);
  }
}

export function recordAnswer(correct, ids) {
  const s = state.stats;
  s.answered++;
  if (correct) { s.correct++; s.streak++; s.best = Math.max(s.best, s.streak); raise(ids, 3, 'quiz'); addXP(10, 'answer'); }
  else { s.streak = 0; raise(ids, 1, 'quiz'); }
  checkAchievements();
  save();
}

export const allSubtopicIds = () => SUBTOPICS.map((s) => s.id);
