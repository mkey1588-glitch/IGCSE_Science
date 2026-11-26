import { QUESTS, QUEST } from '../data/quests.js';
import { NPC, POI, ZONE } from '../data/world.js';
import { state, save, raise, addXP, checkAchievements, grant } from '../core/state.js';
import { bus } from '../core/events.js';
import { audio } from '../core/audio.js';
import { shuffle, pick } from '../core/util.js';
import { game } from '../game.js';

const fill = (text) => text.replace(/\{name\}/g, state.name || 'Scientist');
const lines = (arr) => arr.map(([who, text]) => ({ who, text: fill(text) }));

export class QuestSystem {
  constructor() {
    bus.on('scan', (id) => this._event((s) => s.type === 'scan' && s.poi === id));
    bus.on('exp:goal', (id, goal) => this._event((s) => s.type === 'exp' && s.id === id && (s.goal || 'complete') === goal));
    bus.on('holo:done', (id) => this._event((s) => s.type === 'holo' && s.id === id));
    bus.on('zone:enter', (id) => this._event((s) => s.type === 'visit' && s.zone === id));
  }

  all() { return QUESTS; }
  get(id) { return QUEST[id]; }
  doneCount() { return Object.values(state.quests).filter((q) => q.status === 'done').length; }
  status(id) {
    const s = state.quests[id];
    if (s) return s.status;
    const q = QUEST[id];
    if (q.requiresCount && this.doneCount() < q.requiresCount) return 'locked';
    if ((q.requires || []).every((r) => state.quests[r]?.status === 'done')) return 'available';
    return 'locked';
  }
  list(status) { return QUESTS.filter((q) => this.status(q.id) === status); }
  availableCount() { return this.list('available').length; }
  stepOf(id) { const s = state.quests[id]; if (!s || s.status !== 'active') return null; return QUEST[id].steps[s.step]; }
  tracked() {
    if (state.tracked && state.quests[state.tracked]?.status === 'active') return QUEST[state.tracked];
    const a = QUESTS.find((q) => state.quests[q.id]?.status === 'active');
    if (a) { state.tracked = a.id; return a; }
    return null;
  }

  npcMarker(npcId) {
    let best = null;
    for (const q of QUESTS) {
      const st = state.quests[q.id];
      if (st?.status === 'active') {
        const step = q.steps[st.step];
        if (step && (step.type === 'talk' || step.type === 'choice') && step.npc === npcId) return st.step === q.steps.length - 1 ? 'turnin' : 'active';
      }
    }
    for (const q of QUESTS) if (q.giver === npcId && this.status(q.id) === 'available' && !q.auto) best = 'new';
    return best;
  }

  /** Where the tracked quest wants the player to go. */
  currentTarget() {
    const q = this.tracked(); if (!q) return null;
    const s = this.stepOf(q.id); if (!s) return null;
    if (s.type === 'talk' || s.type === 'choice') return { kind: 'npc', id: s.npc, zone: NPC[s.npc].zone };
    if (s.type === 'scan') return { kind: 'poi', id: s.poi, zone: POI[s.poi].zone };
    if (s.type === 'visit') return { kind: 'zone', id: s.zone, zone: s.zone };
    return null;
  }

  stepAction(qid) {
    const s = this.stepOf(qid); if (!s) return null;
    const q = QUEST[qid];
    if (s.type === 'exp') { const e = game.lab.entry(s.id); return { label: `🧪 Open ${e?.title || 'experiment'}`, run: () => game.openLab(s.id, { tab: s.goal && s.goal !== 'complete' ? s.goal : null, quest: qid }) }; }
    if (s.type === 'holo') { const e = game.lab.entry(s.id); return { label: `🧬 Open ${e?.title || 'model'}`, run: () => game.openLab(s.id, { quest: qid }) }; }
    if (s.type === 'quiz') return { label: '🎯 Answer the questions', run: () => this.runQuiz(qid) };
    if (s.type === 'chain') return { label: '🔗 Solve the chain', run: () => this.runChain(qid) };
    void q;
    return null;
  }

  // ------------------------------------------------------------ flow
  start(id) {
    if (state.quests[id]) return;
    state.quests[id] = { status: 'active', step: 0, started: Date.now() };
    state.tracked = id;
    save();
    audio.discover();
    const q = QUEST[id];
    game.ui.toast('📜', `<b>Quest started:</b> ${q.title}`, 'good');
    raise(q.objectives, 1, 'quest');
    this._enterStep(id);
    game.ui.updateQuestTracker();
  }

  _enterStep(id) {
    const st = state.quests[id]; const q = QUEST[id]; const s = q.steps[st.step];
    if (!s) return;
    if (s.type === 'exp' || s.type === 'holo') game.lab.unlock(s.id);
    // auto-complete steps the player already did
    const already = (s.type === 'scan' && state.scanned[s.poi]) ||
      (s.type === 'exp' && (state.exps[s.id]?.goals?.[s.goal || 'complete'])) ||
      (s.type === 'holo' && state.holos[s.id]?.done) ||
      (s.type === 'visit' && game.world?.currentZone === s.zone);
    if (already) { setTimeout(() => this.advance(id, true), 600); return; }
    game.ui.updateQuestTracker();
  }

  advance(id, silent = false) {
    const st = state.quests[id]; if (!st || st.status !== 'active') return;
    const q = QUEST[id];
    st.step++;
    addXP(20, 'step');
    if (st.step >= q.steps.length) { this.complete(id); return; }
    save();
    if (!silent) audio.success();
    const next = q.steps[st.step];
    game.ui.toast('◆', `<b>${q.title}</b> — next: ${next.text.replace(/\*\*/g, '')}`);
    this._enterStep(id);
    game.ui.updateQuestTracker();
  }

  async complete(id) {
    const q = QUEST[id];
    state.quests[id].status = 'done';
    state.quests[id].finished = Date.now();
    if (q.flag) state.flags[q.flag] = true;
    if (state.tracked === id) state.tracked = null;
    raise(q.objectives, 2, 'quest');
    save();
    if (q.outro) await game.ui.dialogue(lines(q.outro));
    const before = this.availableCount();
    addXP(q.xp || 150, 'quest');
    await game.ui.bigReward({ title: q.title, subtitle: q.summary, xp: q.xp || 150, objectives: q.objectives, icon: q.flag === 'festival' ? '🎆' : q.thread ? '✦' : '🏆' });
    if (q.flag === 'festival') { grant('festival'); state.flags.fireworks = true; state.time = 0.88; save(); }
    checkAchievements();
    this.tracked();
    const after = this.availableCount();
    if (after > before) game.ui.toast('◆', `${after - before} new quest${after - before > 1 ? 's' : ''} available — look for golden markers.`, 'gold');
    if (this.status('q_festival') === 'available' && !state.flags.festivalHint) { state.flags.festivalHint = true; game.ui.toast('🎆', 'The Mayor is ready to open the <b>Festival of Light</b>!', 'gold'); }
    game.world?.refreshSky();
    game.ui.updateHUD();
  }

  _event(match) {
    for (const q of QUESTS) {
      const st = state.quests[q.id];
      if (st?.status !== 'active') continue;
      const s = q.steps[st.step];
      if (s && match(s)) this.advance(q.id);
    }
  }

  // ------------------------------------------------------------ steps
  async runQuiz(qid) {
    const s = this.stepOf(qid); if (!s || s.type !== 'quiz') return;
    const res = await game.ui.quiz({ title: QUEST[qid].title, subs: s.subs, n: s.n || 3, pass: s.pass });
    if (res.passed) this.advance(qid);
  }
  async runChain(qid) {
    const s = this.stepOf(qid); if (!s || s.type !== 'chain') return;
    const ok = await game.ui.chain(s.chain);
    if (ok) this.advance(qid);
  }

  async talkTo(npcId) {
    // 1) active quest step with this NPC
    for (const q of QUESTS) {
      const st = state.quests[q.id];
      if (st?.status !== 'active') continue;
      const s = q.steps[st.step];
      if (!s || s.npc !== npcId) continue;
      if (s.type === 'talk') { await game.ui.dialogue(lines(s.lines || [[npcId, 'Thanks — let’s keep going.']])); this.advance(q.id); return; }
      if (s.type === 'choice') {
        const opts = shuffle(s.options);
        const res = await game.ui.dialogue(lines(s.lines), { choices: opts });
        if (res && res.ok) this.advance(q.id);
        return;
      }
    }
    // 2) active quest whose current step needs something else — give a hint
    const active = QUESTS.find((q) => q.giver === npcId && state.quests[q.id]?.status === 'active');
    // 3) available quest from this NPC
    const avail = QUESTS.find((q) => q.giver === npcId && this.status(q.id) === 'available');
    if (avail) {
      const res = await game.ui.dialogue(lines(avail.intro), { choices: [{ label: `✔ Accept: “${avail.title}”`, value: 'yes' }, { label: 'Maybe later', value: 'no' }], tags: avail.objectives.map((id) => game.ui.chip(id)) });
      if (res?.value === 'yes') this.start(avail.id);
      return;
    }
    if (active) {
      const s = this.stepOf(active.id);
      await game.ui.dialogue([{ who: npcId, text: `How is it going with “${active.title}”? Next you need to: ${s.text.replace(/\*\*/g, '')}` }]);
      return;
    }
    const n = NPC[npcId];
    const others = this.list('available').filter((q) => q.giver !== npcId);
    const hint = others.length ? ` By the way — ${NPC[others[0].giver].name} in ${ZONE[NPC[others[0].giver].zone].name} could use your help.` : '';
    await game.ui.dialogue([{ who: npcId, text: pick(n.idle) + hint }]);
  }

  /** Start the auto tutorial quest. */
  async kickoff() {
    const q = QUEST.q_first_day;
    if (state.quests[q.id]) return;
    await game.ui.dialogue(lines(q.intro));
    this.start(q.id);
  }
}

export function questCoverage() {
  const covered = new Set();
  for (const q of QUESTS) for (const id of q.objectives) covered.add(id);
  return covered;
}
void checkAchievements;
