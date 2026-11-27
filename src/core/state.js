import { store } from './util.js';
import { bus } from './events.js';
import { expandIds, OBJ, SUB, SUBTOPICS, OBJECTIVES, isSupplement } from '../data/curriculum.js';
import { LINKS } from '../data/links.js';

const KEY = 'catalyst.save.v1'; // storage key stays the same; the save format is versioned by `v`
const VERSION = 2;
const DEFAULT = () => ({
  v: VERSION, name: '', created: Date.now(), playTime: 0,
  xp: 0, level: 1,
  mastery: {}, // objectiveId -> 0..3 (1 discovered, 2 practised, 3 mastered), always derived from `evidence`
  // objectiveId -> { v: seen it, p: did practical work on it, c: [different questions answered right first time], w: wrong answers }
  evidence: {},
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
  if (!s || (s.v !== 1 && s.v !== VERSION)) return false;
  const d = DEFAULT();
  Object.assign(state, d, s, { settings: { ...d.settings, ...(s.settings || {}) }, stats: { ...d.stats, ...(s.stats || {}) } });
  if (s.v === 1) migrateV1();
  return true;
}
/**
 * Version 1 saves kept only a level per objective. A 3 could come from one correct answer, and
 * opening a lab or finishing a quest credited every objective of a sub-topic, Supplement ones included,
 * whatever the tier. Rebuild the evidence conservatively: 1 → seen, 2 → practised, 3 → one correct
 * answer (shown as practised until more evidence arrives). On the Core tier, Supplement entries came
 * from that sub-topic crediting, so they are dropped. Quests, XP, links, achievements and flags are kept.
 */
function migrateV1() {
  const evidence = {};
  for (const [id, lvl] of Object.entries(state.mastery || {})) {
    if (!OBJ[id] || !lvl) continue;
    if (state.settings.tier !== 'extended' && OBJ[id].tier === 'S') continue;
    evidence[id] = lvl >= 3 ? { v: 1, c: ['v1-answer'] } : lvl >= 2 ? { v: 1, p: 1 } : { v: 1 };
  }
  state.evidence = evidence;
  state.mastery = {};
  for (const id in evidence) state.mastery[id] = levelOf(evidence[id]);
  state.v = VERSION;
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
/** Is this work required of the learner? Supplement work is an optional extra on the Core tier. */
export const requiredFor = (ids) => state.settings.tier === 'extended' || !isSupplement(ids);

/** Mastery level from evidence: one correct answer or practical work is "practised"; mastery needs more. */
export function levelOf(e) {
  if (!e) return 0;
  const right = e.c ? e.c.length : 0;
  if (right >= 2 || (right >= 1 && e.p)) return 3;
  if (right >= 1 || e.p) return 2;
  return e.v || e.w ? 1 : 0;
}

/**
 * The objectives a piece of work credits. Objective ids are credited as given: the learner did that
 * work. Sub-topics, topics and sections expand to the learner's own tier only, so Core work never
 * credits Supplement objectives, and switching to Extended later shows them as not yet done.
 */
export function creditTargets(ids) {
  const out = new Set(), broad = [];
  for (const id of ids || []) { if (OBJ[id]) out.add(id); else broad.push(id); }
  for (const id of expandIds(broad, state.settings.tier)) out.add(id);
  return [...out];
}

function addEvidence(objIds, kind, source, key) {
  const raised = new Map(); // new level -> objective ids
  for (const id of objIds) {
    const e = (state.evidence[id] ||= {});
    const before = state.mastery[id] || 0;
    e.v = 1;
    if (kind === 'p') e.p = 1;
    else if (kind === 'w') e.w = (e.w || 0) + 1;
    else if (kind === 'c') { e.c ||= []; if (!e.c.includes(key) && e.c.length < 3) e.c.push(key); }
    const after = levelOf(e);
    state.mastery[id] = after;
    if (after > before) { if (!raised.has(after)) raised.set(after, []); raised.get(after).push(id); }
  }
  const changed = [...raised.values()].flat();
  if (changed.length) {
    for (const [lvl, ids] of raised) bus.emit('mastery', ids, lvl, source);
    checkLinks(source);
  }
  save();
  return changed;
}

/** Credit work: level 1 = seen it, level 2 = did practical work on it. Answers go through recordAnswer. */
export function raise(ids, level, source) {
  return addEvidence(creditTargets(ids), level >= 2 ? 'p' : 'v', source);
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

let anonymous = 0;
/**
 * Record one answer as evidence for the objectives the question tests. `correct` means right first
 * time. `key` names the question, so answering the same question again is not new evidence.
 * A question tagged only with a sub-topic cannot say which objective it tested, so it counts as "seen".
 */
export function recordAnswer(correct, ids, { key = `answer-${++anonymous}`, source = 'quiz' } = {}) {
  const s = state.stats;
  s.answered++;
  if (correct) { s.correct++; s.streak++; s.best = Math.max(s.best, s.streak); addXP(10, 'answer'); }
  else s.streak = 0;
  const objectives = (ids || []).filter((id) => OBJ[id]);
  const broad = (ids || []).filter((id) => !OBJ[id]);
  if (objectives.length) addEvidence(objectives, correct ? 'c' : 'w', source, key);
  if (broad.length) addEvidence(creditTargets(broad), 'v', source);
  checkAchievements();
  save();
}

export const allSubtopicIds = () => SUBTOPICS.map((s) => s.id);
